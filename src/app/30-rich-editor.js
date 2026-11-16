/* Source: 30-rich-editor.js */
    async function openEditModal(id) {
        if (previewModeBlocksEditing()) return;
        const openRequest=++noteOpenRequest;
        let expanded;
        try {
            let settled=false;
            for(let attempt=0;attempt<3;attempt++){
                if(openRequest!==noteOpenRequest||isPreviewMode)return;
                const source=resolveLinkedNote(id);if(!source)return;
                expanded=await notePersistence.prepareNoteForEditing(source);
                if(resolveLinkedNote(id)===source){settled=true;break;}
            }
            if(!settled){showPreviewModeToast('這篇筆記剛收到雲端更新，請重新開啟以編輯最新內容。');return;}
        } catch (error) {showPreviewModeToast('這篇筆記的圖片尚未完整讀取，請稍後重試；原內容仍保留。');return;}
        if(openRequest!==noteOpenRequest||isPreviewMode)return;
        editorSelectionRevision++;
        finishEditorColorChord();
        endEditorColorMemoryManagement();
        clearInlineImageSelection();
        if (previewModeBlocksEditing()) return;
        clearTableCellSelection();
        savedEditorFocusHost = null;
        if(!resolveLinkedNote(id))return;
        const note = expanded;
        editingNoteId = note.id;
        document.getElementById('note-title-input').value = note.title || '';
        document.getElementById('modal-text').innerHTML = sanitizeNoteHtml(note.text); 
        currentPastedImages = collectLegacyGalleryImages(note);
        currentGalleryImageEdits = { ...(note.galleryImageEdits || {}) };
        // 編輯視窗雖然不顯示分類欄，但仍保留原本分類，
        // 儲存文字或圖片時不會把既有分類清掉。
        pendingCategoryIds = [...getNoteCategoryIds(note)];
        savedEditorRange = null;
        renderNoteCategoryPicker();
        renderPreviewGrid(); document.getElementById('noteModal').classList.add('active');
        prepareInlineImagesInEditor();
        prepareNoteTablesInEditor();
        document.getElementById('modal-text').focus();
        rememberEditorSelection();
        prepareArrowNoteLists();
        notePersistence.begin();
    }

    function closeModal() {
        noteOpenRequest++;
        editorSelectionRevision++;
        finishEditorColorChord();
        endEditorColorMemoryManagement();
        if (noteImageEditor.isOpen()) { noteImageEditor.close(); return; }
        notePersistence.closing();
        clearInlineImageSelection();
        resetInlineImageDrag();

        const noteModal = document.getElementById('noteModal');
        const activeElement = document.activeElement;

        if (
            activeElement &&
            noteModal?.contains(activeElement) &&
            typeof activeElement.blur === 'function'
        ) {
            activeElement.blur();
        }

        noteModal.classList.remove('active');
    }

    function readImageFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) return reject(new Error('不是圖片檔案'));
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = () => reject(reader.error || new Error('圖片讀取失敗'));
            reader.readAsDataURL(file); // 保留原圖，不另外轉成 JPEG 或壓縮
        });
    }

    async function addImageFile(file) {
        try {
            currentPastedImages.push(await readImageFile(file));
            renderPreviewGrid();
        } catch (error) { console.warn(error); }
    }

    function addRemoteImageSource(src) {
        if (!src) return false;
        const cleanSrc = src.trim();
        const isUsable = cleanSrc.startsWith('data:image/') || /^https?:\/\//i.test(cleanSrc);
        if (!isUsable || currentPastedImages.includes(cleanSrc)) return false;
        currentPastedImages.push(cleanSrc);
        renderPreviewGrid();
        return true;
    }

    /* Google Images wraps results in links such as /imgres?imgurl=<full image>; prefer the full image
       and keep the thumbnail as a fallback. */
    function fullImageFromLink(href) {
        try {
            const u = new URL(href, 'https://www.google.com/');
            const full = u.searchParams.get('imgurl') || u.searchParams.get('mediaurl');
            return full && /^https?:\/\//i.test(full) ? full : '';
        } catch (_) {return '';}
    }
    function extractImageSources(dataTransfer) {
        const sources = [];
        const html = dataTransfer.getData('text/html');
        const uri = dataTransfer.getData('text/uri-list');
        const uriFull = (uri || '').split(/\r?\n/).map(fullImageFromLink).find(Boolean) || '';
        if (html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            doc.querySelectorAll('img').forEach(img => {
                let src=img.getAttribute('data-original')||img.getAttribute('data-src')||img.getAttribute('src');if(!src)return;
                if(src.startsWith('//'))src='https:'+src;
                const full=fullImageFromLink(img.closest('a')?.getAttribute('href')||'')||(doc.images.length===1?uriFull:'');
                if(full&&full!==src){noteExternalImages.setFallback(full,src);sources.push(full);}else sources.push(src);
            });
        }
        if(sources.length)return [...new Set(sources)];
        if (uri) sources.push(...uri.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => fullImageFromLink(line) || line));
        const plain = dataTransfer.getData('text/plain');
        if (plain && (/^data:image\//i.test(plain.trim()) || /^https?:\/\//i.test(plain.trim()))) sources.push(plain.trim());
        return [...new Set(sources)];
    }

    async function importToGallery(dataTransfer) {
        let imported = false;const request=noteOpenRequest;
        const files = Array.from(dataTransfer.files || []).filter(file => file.type.startsWith('image/'));
        for (const file of files) {
            try {
                currentPastedImages.push(await readImageFile(file));
                imported = true;
            } catch (error) { console.warn(error); }
        }
        if (!files.length) {
            for(const src of extractImageSources(dataTransfer)){
                const clean = src.trim();
                if ((clean.startsWith('data:image/') || /^https?:\/\//i.test(clean)) && !currentPastedImages.includes(clean)) {
                    const original=await noteExternalImages.prepareInsert(clean);if(request!==noteOpenRequest)return imported;
                    if(!currentPastedImages.includes(original)){currentPastedImages.push(original);imported=true;}
                }
            }
        }
        if (imported) renderPreviewGrid();
        return imported;
    }


    function tableControlsHtml() {
        return `<div class="note-table-controls" contenteditable="false">
            <button type="button" class="table-drag-handle" draggable="true" title="抓住這裡拖曳整張表格"><i class="fas fa-grip-vertical"></i> <span>拖曳</span></button>
            <button type="button" data-table-action="select-mode" title="開啟後可用滑鼠拖曳選取多格；也可以用 Shift+點擊選取範圍"><i class="fas fa-border-all"></i> <span>選格</span></button>

            <button type="button" data-table-action="row-above" title="在目前儲存格上方新增一列"><i class="fas fa-arrow-up"></i><i class="fas fa-plus"></i> <span>列</span></button>
            <button type="button" data-table-action="row-below" title="在目前儲存格下方新增一列"><i class="fas fa-arrow-down"></i><i class="fas fa-plus"></i> <span>列</span></button>
            <button type="button" data-table-action="delete-row" title="刪除目前儲存格所在列"><i class="fas fa-minus"></i> <span>列</span></button>

            <button type="button" data-table-action="col-left" title="在目前儲存格左側新增一欄"><i class="fas fa-arrow-left"></i><i class="fas fa-plus"></i> <span>欄</span></button>
            <button type="button" data-table-action="col-right" title="在目前儲存格右側新增一欄"><i class="fas fa-arrow-right"></i><i class="fas fa-plus"></i> <span>欄</span></button>
            <button type="button" data-table-action="delete-col" title="刪除目前儲存格所在欄"><i class="fas fa-minus"></i> <span>欄</span></button>

            <button type="button" data-table-action="toggle-header" title="切換第一列是否為標題列"><i class="fas fa-heading"></i> <span>標題列</span></button>
            <span class="table-selection-help"><i class="fas fa-copy"></i> Ctrl+C／Delete／貼表格</span>
            <button type="button" class="table-delete-button" data-table-action="delete-table" title="刪除整張表格"><i class="fas fa-trash"></i></button>
        </div>`;
    }

    function createEditableCell(tagName, content = '', contentIsHtml = false) {
        const cell = document.createElement(tagName);
        cell.contentEditable = 'true';
        cell.innerHTML = content
            ? (contentIsHtml ? content : escapeHtml(content))
            : '<br>';
        return cell;
    }

    function createNoteTableElement(rows, cols, useHeader = true) {
        const wrapper = document.createElement('div');
        wrapper.className = 'note-table-block';
        wrapper.dataset.noteTable = '1';
        wrapper.contentEditable = 'false';

        wrapper.insertAdjacentHTML('beforeend', tableControlsHtml());

        const scroll = document.createElement('div');
        scroll.className = 'note-table-scroll';

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
            const row = document.createElement('tr');
            const isHeader = useHeader && rowIndex === 0;

            for (let colIndex = 0; colIndex < cols; colIndex++) {
                const label = isHeader ? `欄位 ${colIndex + 1}` : '';
                row.appendChild(createEditableCell(isHeader ? 'th' : 'td', label));
            }

            tbody.appendChild(row);
        }

        table.appendChild(tbody);
        scroll.appendChild(table);
        wrapper.appendChild(scroll);
        bindNoteTableElement(wrapper);
        return wrapper;
    }

    function openTableCreateModal() {
        rememberEditorSelection();
        document.getElementById('tableCreateModal').classList.add('active');
        document.getElementById('table-create-rows').focus();
        document.getElementById('table-create-rows').select();
    }

    function closeTableCreateModal() {
        document.getElementById('tableCreateModal').classList.remove('active');
    }

    function createTableFromModal() {
        const rows = Math.max(1, Math.min(50, Number(document.getElementById('table-create-rows').value) || 3));
        const cols = Math.max(1, Math.min(20, Number(document.getElementById('table-create-cols').value) || 4));
        const useHeader = document.getElementById('table-create-header').checked;
        const tableBlock = createNoteTableElement(rows, cols, useHeader);

        insertTableAtEditorRange(tableBlock, savedEditorRange);
        closeTableCreateModal();

        requestAnimationFrame(() => {
            const firstCell = tableBlock.querySelector('th, td');
            setTableActiveCell(firstCell);
            firstCell?.focus();
        });
    }

    function insertTableAtEditorRange(tableBlock, range = savedEditorRange) {
        const editor = document.getElementById('modal-text');
        let targetRange = range && editor.contains(range.commonAncestorContainer)
            ? range.cloneRange()
            : null;

        if (!targetRange) {
            targetRange = document.createRange();
            targetRange.selectNodeContents(editor);
            targetRange.collapse(false);
        }

        targetRange.collapse(false);
        targetRange.insertNode(tableBlock);

        const spacer = document.createElement('div');
        spacer.innerHTML = '<br>';
        tableBlock.after(spacer);

        const caret = document.createRange();
        caret.selectNodeContents(spacer);
        caret.collapse(true);

        const selection = window.getSelection();
        editor.focus();
        selection.removeAllRanges();
        selection.addRange(caret);
        savedEditorRange = caret.cloneRange();
    }

    function prepareNoteTablesInEditor() {
        const editor = document.getElementById('modal-text');

        editor.querySelectorAll('[data-note-table="1"]').forEach(wrapper => {
            wrapper.classList.add('note-table-block');
            wrapper.contentEditable = 'false';

            if (!wrapper.querySelector('.note-table-controls')) {
                wrapper.insertAdjacentHTML('afterbegin', tableControlsHtml());
            }

            // 舊版本曾加入表格小標題；新版進入編輯時會自動移除。
            wrapper.querySelectorAll('[data-table-caption="1"], .note-table-caption')
                .forEach(caption => caption.remove());

            wrapper.querySelectorAll('th, td').forEach(cell => {
                cell.contentEditable = 'true';
                if (!cell.innerHTML.trim()) cell.innerHTML = '<br>';
            });

            bindNoteTableElement(wrapper);
        });
    }

    function clearTableCellSelection(keepActive = false) {
        const wrapper = tableSelectionState.wrapper;

        if (wrapper) {
            wrapper.querySelectorAll('.table-cell-selected, .table-cell-anchor')
                .forEach(cell => cell.classList.remove('table-cell-selected', 'table-cell-anchor'));

            if (!keepActive) {
                wrapper.querySelectorAll('.table-active-cell')
                    .forEach(cell => cell.classList.remove('table-active-cell'));
            }
        }

        tableSelectionState.wrapper = null;
        tableSelectionState.anchorCell = null;
        tableSelectionState.focusCell = null;
        tableSelectionState.cells = [];
        tableSelectionState.dragging = false;
    }

    function tableCellCoordinates(cell) {
        if (!cell) return null;
        const row = cell.parentElement;
        return {
            row: row?.rowIndex ?? -1,
            col: cell.cellIndex
        };
    }

    function setTableActiveCell(cell) {
        if (!cell) return;
        const wrapper = cell.closest('[data-note-table="1"]');
        if (!wrapper) return;

        wrapper.querySelectorAll('.table-active-cell')
            .forEach(item => item.classList.remove('table-active-cell'));

        cell.classList.add('table-active-cell');
        tableSelectionState.wrapper = wrapper;
        tableSelectionState.focusCell = cell;

        if (!tableSelectionState.anchorCell || !wrapper.contains(tableSelectionState.anchorCell)) {
            tableSelectionState.anchorCell = cell;
        }
    }

    function selectTableCellRange(wrapper, anchorCell, focusCell) {
        if (!wrapper || !anchorCell || !focusCell) return;

        clearTableCellSelection(false);

        const table = wrapper.querySelector('table');
        const anchor = tableCellCoordinates(anchorCell);
        const focus = tableCellCoordinates(focusCell);
        if (!table || !anchor || !focus) return;

        const minRow = Math.min(anchor.row, focus.row);
        const maxRow = Math.max(anchor.row, focus.row);
        const minCol = Math.min(anchor.col, focus.col);
        const maxCol = Math.max(anchor.col, focus.col);
        const cells = [];

        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
            const row = table.rows[rowIndex];
            if (!row) continue;

            for (let colIndex = minCol; colIndex <= maxCol; colIndex++) {
                const cell = row.cells[colIndex];
                if (!cell) continue;
                cell.classList.add('table-cell-selected');
                cells.push(cell);
            }
        }

        anchorCell.classList.add('table-cell-anchor');
        focusCell.classList.add('table-active-cell');

        tableSelectionState.wrapper = wrapper;
        tableSelectionState.anchorCell = anchorCell;
        tableSelectionState.focusCell = focusCell;
        tableSelectionState.cells = cells;
    }

    function getSelectedTableCells() {
        return tableSelectionState.cells.filter(cell => cell?.isConnected);
    }

    function getBulkFormatTableCells() {
        const cells = getSelectedTableCells();
        if (cells.length > 1) return cells;

        const wrapper = tableSelectionState.wrapper;
        if (cells.length === 1 && wrapper?.classList.contains('cell-selection-mode')) {
            return cells;
        }

        return [];
    }

    function getTableReferenceCell(wrapper) {
        if (!wrapper) return null;

        const focused = document.activeElement?.closest?.('th, td');
        if (focused && wrapper.contains(focused)) return focused;

        if (tableSelectionState.wrapper === wrapper && tableSelectionState.focusCell?.isConnected) {
            return tableSelectionState.focusCell;
        }

        return wrapper.querySelector('.table-active-cell, .table-cell-selected, th, td');
    }

    function selectCellContents(cell) {
        if (!cell) return null;

        try {
            cell.focus({ preventScroll: true });
        } catch (error) {
            cell.focus();
        }

        const range = document.createRange();
        range.selectNodeContents(cell);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        savedEditorRange = range.cloneRange();
        savedEditorFocusHost = cell;
        return range;
    }

    function applyCommandToTableCells(cells, command, value = null) {
        if (!cells.length) return false;

        cells.forEach(cell => {
            selectCellContents(cell);
            document.execCommand(command, false, value);
        });

        tableSelectionState.cells.forEach(cell => cell.classList.add('table-cell-selected'));
        tableSelectionState.anchorCell?.classList.add('table-cell-anchor');
        tableSelectionState.focusCell?.classList.add('table-active-cell');
        return true;
    }

    function applyEditorCommand(command, value = null) {
        const bulkCells = getBulkFormatTableCells();

        if (bulkCells.length) {
            applyCommandToTableCells(bulkCells, command, value);
            return;
        }

        restoreEditorSelection();
        document.execCommand(command, false, value);
        rememberEditorSelection();
    }

    function getFirstSelectedCellFontSize(cells) {
        if (!cells.length) return 3;
        selectCellContents(cells[0]);
        const size = parseInt(document.queryCommandValue('fontSize'), 10);
        return Number.isFinite(size) && size >= 1 && size <= 7 ? size : 3;
    }

    function insertTableRow(wrapper, insertIndex) {
        const table = wrapper.querySelector('table');
        const columnCount = Math.max(1, table.rows[0]?.cells.length || 1);
        const headerMode = Array.from(table.rows[0]?.cells || []).every(cell => cell.tagName === 'TH');
        const row = table.insertRow(insertIndex);
        const shouldBeHeader = headerMode && insertIndex === 0;

        for (let index = 0; index < columnCount; index++) {
            row.appendChild(createEditableCell(shouldBeHeader ? 'th' : 'td'));
        }

        return row;
    }

    function insertTableColumn(wrapper, insertIndex) {
        const table = wrapper.querySelector('table');

        Array.from(table.rows).forEach((row, rowIndex) => {
            const isHeaderRow = rowIndex === 0 &&
                Array.from(row.cells).every(cell => cell.tagName === 'TH');
            const newCell = createEditableCell(isHeaderRow ? 'th' : 'td');
            const reference = row.cells[insertIndex] || null;
            row.insertBefore(newCell, reference);
        });
    }

    function handleNoteTableAction(wrapper, action) {
        const table = wrapper.querySelector('table');
        if (!table?.rows.length) return;

        if (action === 'select-mode') {
            const enabled = wrapper.classList.toggle('cell-selection-mode');
            const button = wrapper.querySelector('[data-table-action="select-mode"]');
            button?.classList.toggle('active', enabled);

            if (enabled) {
                const reference = getTableReferenceCell(wrapper) || table.rows[0].cells[0];
                selectTableCellRange(wrapper, reference, reference);
            } else {
                clearTableCellSelection(true);
                const reference = getTableReferenceCell(wrapper) || table.rows[0].cells[0];
                setTableActiveCell(reference);
            }
            return;
        }

        const reference = getTableReferenceCell(wrapper) || table.rows[0].cells[0];
        const rowIndex = reference.parentElement.rowIndex;
        const colIndex = reference.cellIndex;

        if (action === 'row-above') {
            const row = insertTableRow(wrapper, rowIndex);
            const target = row.cells[Math.min(colIndex, row.cells.length - 1)];
            clearTableCellSelection();
            setTableActiveCell(target);
            target.focus();
        }

        if (action === 'row-below') {
            const row = insertTableRow(wrapper, rowIndex + 1);
            const target = row.cells[Math.min(colIndex, row.cells.length - 1)];
            clearTableCellSelection();
            setTableActiveCell(target);
            target.focus();
        }

        if (action === 'delete-row') {
            if (table.rows.length <= 1) return alert('表格至少需要保留一列。');

            table.deleteRow(rowIndex);
            clearTableCellSelection();

            const nextRow = table.rows[Math.min(rowIndex, table.rows.length - 1)];
            const target = nextRow.cells[Math.min(colIndex, nextRow.cells.length - 1)];
            setTableActiveCell(target);
            target.focus();
        }

        if (action === 'col-left') {
            insertTableColumn(wrapper, colIndex);
            clearTableCellSelection();
            const target = table.rows[rowIndex].cells[colIndex];
            setTableActiveCell(target);
            target.focus();
        }

        if (action === 'col-right') {
            insertTableColumn(wrapper, colIndex + 1);
            clearTableCellSelection();
            const target = table.rows[rowIndex].cells[colIndex + 1];
            setTableActiveCell(target);
            target.focus();
        }

        if (action === 'delete-col') {
            const columnCount = table.rows[0]?.cells.length || 0;
            if (columnCount <= 1) return alert('表格至少需要保留一欄。');

            Array.from(table.rows).forEach(row => row.deleteCell(colIndex));
            clearTableCellSelection();

            const targetCol = Math.min(colIndex, table.rows[0].cells.length - 1);
            const target = table.rows[Math.min(rowIndex, table.rows.length - 1)].cells[targetCol];
            setTableActiveCell(target);
            target.focus();
        }

        if (action === 'toggle-header') {
            const firstRow = table.rows[0];
            const currentlyHeader = Array.from(firstRow.cells).every(cell => cell.tagName === 'TH');

            Array.from(firstRow.cells).forEach(oldCell => {
                const replacement = document.createElement(currentlyHeader ? 'td' : 'th');
                replacement.contentEditable = 'true';
                replacement.innerHTML = oldCell.innerHTML || '<br>';
                oldCell.replaceWith(replacement);
            });

            clearTableCellSelection();
            const target = table.rows[0].cells[Math.min(colIndex, table.rows[0].cells.length - 1)];
            setTableActiveCell(target);
        }

        if (action === 'delete-table') {
            if (confirm('確定要刪除整張表格嗎？')) {
                clearTableCellSelection();
                wrapper.remove();
            }
        }

        rememberEditorSelection();
    }

    function handleTableCellTab(event, cell) {
        const table = cell.closest('table');
        const cells = Array.from(table.querySelectorAll('th, td'));
        const currentIndex = cells.indexOf(cell);
        if (currentIndex === -1) return false;

        event.preventDefault();

        let targetIndex = event.shiftKey ? currentIndex - 1 : currentIndex + 1;

        if (!event.shiftKey && targetIndex >= cells.length) {
            const wrapper = table.closest('[data-note-table="1"]');
            const newRow = insertTableRow(wrapper, table.rows.length);
            const target = newRow.cells[0];
            setTableActiveCell(target);
            target.focus();
            return true;
        }

        if (targetIndex >= 0 && targetIndex < cells.length) {
            const target = cells[targetIndex];
            clearTableCellSelection();
            setTableActiveCell(target);
            target.focus();
        }

        return true;
    }

    function removeTableDropMarker() {
        tableDropMarker?.remove();
        tableDropMarker = null;
    }

    function placeTableDropMarker(range) {
        removeTableDropMarker();
        const editor = document.getElementById('modal-text');
        if (!range || !editor.contains(range.commonAncestorContainer)) return;

        tableDropMarker = document.createElement('div');
        tableDropMarker.className = 'table-drop-marker';
        tableDropMarker.contentEditable = 'false';
        range.insertNode(tableDropMarker);
    }

    function tableSelectionBounds(cells) {
        if (!cells.length) return null;

        const positions = cells.map(tableCellCoordinates);
        return {
            minRow: Math.min(...positions.map(item => item.row)),
            maxRow: Math.max(...positions.map(item => item.row)),
            minCol: Math.min(...positions.map(item => item.col)),
            maxCol: Math.max(...positions.map(item => item.col))
        };
    }

    function selectedTableMatrix(cells) {
        const wrapper = cells[0]?.closest('[data-note-table="1"]');
        const table = wrapper?.querySelector('table');
        const bounds = tableSelectionBounds(cells);
        if (!table || !bounds) return [];

        const matrix = [];
        for (let rowIndex = bounds.minRow; rowIndex <= bounds.maxRow; rowIndex++) {
            const rowData = [];
            for (let colIndex = bounds.minCol; colIndex <= bounds.maxCol; colIndex++) {
                const cell = table.rows[rowIndex]?.cells[colIndex];
                rowData.push({
                    text: cell?.innerText || '',
                    html: cell?.innerHTML || ''
                });
            }
            matrix.push(rowData);
        }
        return matrix;
    }

    function selectedMatrixAsTsv(matrix) {
        return matrix
            .map(row => row.map(cell => String(cell.text || '').replace(/\t/g, ' ')).join('\t'))
            .join('\n');
    }

    function selectedMatrixAsHtml(matrix) {
        return `<table>${matrix.map(row =>
            `<tr>${row.map(cell => `<td>${cell.html || ''}</td>`).join('')}</tr>`
        ).join('')}</table>`;
    }

    function clearSelectedTableCellContents() {
        const cells = getSelectedTableCells();
        if (!cells.length) return false;

        cells.forEach(cell => {
            cell.innerHTML = '<br>';
        });
        return true;
    }

    function sanitizePastedCellHtml(rawHtml,plainText=null) { return noteClipboardContent.html(rawHtml,plainText); }

    function clipboardHtmlTableMatrix(html,plainText=null) {
        if (!html) return null;
        const documentFragment = new DOMParser().parseFromString(sanitizePastedCellHtml(html,plainText), 'text/html');
        const table = documentFragment.querySelector('table');
        if (!table) return null;
        const plainRows=typeof plainText==='string'?plainText.replace(/\r\n?/g,'\n').split('\n').map(line=>line.split('\t')):[];if(plainRows.length===table.rows.length+1&&plainRows.at(-1).length===1&&plainRows.at(-1)[0]==='')plainRows.pop();
        const hasCellText=table.rows.length===plainRows.length&&[...table.rows].every((row,i)=>row.cells.length===plainRows[i].length&&[...row.cells].every((c,j)=>c.colSpan===1&&c.rowSpan===1&&c.textContent.replace(/\s/g,'')===plainRows[i][j].replace(/\s/g,'')));

        const rows = Array.from(table.rows).map((row,i) =>
            Array.from(row.cells).map((cell,j) => ({
                text: hasCellText?plainRows[i][j]:cell.innerText || cell.textContent || '',
                html: sanitizePastedCellHtml(cell.innerHTML,hasCellText?plainRows[i][j]:null)
            }))
        ).filter(row => row.length);

        return rows.length ? rows : null;
    }

    function clipboardTextTableMatrix(plainText) {
        const textValue = String(plainText || '').replace(/\r/g, '');
        if (!textValue.trim()) return null;

        if (textValue.includes('\t')) {
            return textValue.split('\n').map(line =>
                line.split('\t').map(value => ({
                    text: value,
                    html: escapeHtml(value).replace(/\n/g, '<br>')
                }))
            );
        }

        const lines = textValue.split('\n').map(line => line.trim()).filter(Boolean);
        const looksLikeMarkdownTable = lines.length >= 2 &&
            lines.filter(line => line.includes('|')).length >= 2;

        if (!looksLikeMarkdownTable) return null;

        const parsed = lines.map(line => {
            const clean = line.replace(/^\|/, '').replace(/\|$/, '');
            return clean.split('|').map(value => value.trim());
        });

        const withoutSeparator = parsed.filter(row =>
            !row.every(value => /^:?-{3,}:?$/.test(value))
        );

        if (!withoutSeparator.length) return null;

        return withoutSeparator.map(row =>
            row.map(value => ({
                text: value,
                html: escapeHtml(value)
            }))
        );
    }

    function extractClipboardTableMatrix(clipboardData) {
        const html = clipboardData.getData('text/html');
        const htmlMatrix = clipboardHtmlTableMatrix(html,clipboardData.getData('text/plain'));
        if (htmlMatrix) return { matrix: htmlMatrix, structured: true };

        const plainText = clipboardData.getData('text/plain');
        const textMatrix = clipboardTextTableMatrix(plainText);
        if (textMatrix) return { matrix: textMatrix, structured: true };

        return {
            matrix: [[{
                text: plainText,
                html: escapeHtml(plainText).replace(/\n/g, '<br>')
            }]],
            structured: false
        };
    }

    function ensureTableSizeForPaste(wrapper, requiredRows, requiredCols) {
        const table = wrapper.querySelector('table');

        while (table.rows.length < requiredRows) {
            insertTableRow(wrapper, table.rows.length);
        }

        while ((table.rows[0]?.cells.length || 0) < requiredCols) {
            insertTableColumn(wrapper, table.rows[0].cells.length);
        }
    }

    function pasteMatrixIntoTable(startCell, matrix) {
        if (!startCell || !matrix?.length) return;

        const wrapper = startCell.closest('[data-note-table="1"]');
        const table = wrapper.querySelector('table');
        const start = tableCellCoordinates(startCell);
        const rowCount = matrix.length;
        const colCount = Math.max(...matrix.map(row => row.length));
        const selected = getSelectedTableCells();

        if (rowCount === 1 && colCount === 1 && selected.length > 1) {
            selected.forEach(cell => {
                cell.innerHTML = matrix[0][0].html || '<br>';
            });
            return;
        }

        ensureTableSizeForPaste(
            wrapper,
            start.row + rowCount,
            start.col + colCount
        );

        matrix.forEach((row, rowOffset) => {
            row.forEach((value, colOffset) => {
                const target = table.rows[start.row + rowOffset]?.cells[start.col + colOffset];
                if (!target) return;
                target.innerHTML = value.html || escapeHtml(value.text || '') || '<br>';
            });
        });

        const focus = table.rows[start.row + rowCount - 1]
            ?.cells[start.col + colCount - 1];

        selectTableCellRange(wrapper, startCell, focus || startCell);
    }

    function bindNoteTableElement(wrapper) {
        if (!wrapper || wrapper.dataset.tableBound === '1') return;
        wrapper.dataset.tableBound = '1';
        wrapper.contentEditable = 'false';

        const controls = wrapper.querySelector('.note-table-controls');
        const dragHandle = wrapper.querySelector('.table-drag-handle');
        let hideTimer = null;

        const showControls = () => {
            if (hideTimer) clearTimeout(hideTimer);
            wrapper.classList.add('controls-open');
        };

        const scheduleHide = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                if (!wrapper.matches(':hover') && !wrapper.contains(document.activeElement)) {
                    wrapper.classList.remove('controls-open');
                }
            }, 350);
        };

        wrapper.addEventListener('mouseenter', showControls);
        wrapper.addEventListener('mouseleave', scheduleHide);

        wrapper.addEventListener('click', event => {
            if (!event.target.closest('.note-table-controls')) showControls();
        });

        wrapper.addEventListener('mousedown', event => {
            const cell = event.target.closest('th, td');
            if (!cell || !wrapper.contains(cell)) return;

            const selectionMode = wrapper.classList.contains('cell-selection-mode');

            if (selectionMode || event.shiftKey) {
                event.preventDefault();

                const anchor = event.shiftKey &&
                    tableSelectionState.wrapper === wrapper &&
                    tableSelectionState.anchorCell?.isConnected
                    ? tableSelectionState.anchorCell
                    : cell;

                tableSelectionState.dragging = true;
                selectTableCellRange(wrapper, anchor, cell);
                tableSelectionState.dragging = true;
                return;
            }

            clearTableCellSelection();
            setTableActiveCell(cell);
        });

        wrapper.addEventListener('mouseover', event => {
            if (!tableSelectionState.dragging || tableSelectionState.wrapper !== wrapper) return;
            if (!(event.buttons & 1)) {tableSelectionState.dragging=false;return;}

            const cell = event.target.closest('th, td');
            if (!cell || !wrapper.contains(cell)) return;

            selectTableCellRange(
                wrapper,
                tableSelectionState.anchorCell || cell,
                cell
            );
            tableSelectionState.dragging = true;
        });

        wrapper.addEventListener('focusin', event => {
            const cell = event.target.closest('th, td');
            if (!cell) return;

            if (!applyingTableCellColor && !wrapper.classList.contains('cell-selection-mode')) {
                clearTableCellSelection();
            }
            setTableActiveCell(cell);
        });

        controls?.addEventListener('mousedown', event => {
            if (!event.target.closest('.table-drag-handle')) event.preventDefault();
        });

        controls?.addEventListener('click', event => {
            const button = event.target.closest('[data-table-action]');
            if (!button) return;
            event.preventDefault();
            event.stopPropagation();
            handleNoteTableAction(wrapper, button.dataset.tableAction);
        });

        dragHandle?.addEventListener('dragstart', event => {
            draggedNoteTable = wrapper;
            wrapper.classList.add('note-table-dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', 'note-table');
        });

        dragHandle?.addEventListener('dragend', () => {
            wrapper.classList.remove('note-table-dragging');
            draggedNoteTable = null;
            removeTableDropMarker();
        });
    }

    function setupNoteTableEditor() {
        if (setupNoteTableEditor.done) return;
        setupNoteTableEditor.done = true;

        const editor = document.getElementById('modal-text');

        const stopTableSelection=()=>{tableSelectionState.dragging=false;};
        document.addEventListener('mouseup',stopTableSelection);
        document.addEventListener('pointercancel',stopTableSelection);
        window.addEventListener('blur',stopTableSelection);
        document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTableSelection();});

        editor.addEventListener('copy', event => {
            const cells = getSelectedTableCells();
            if (cells.length <= 1) return;

            const matrix = selectedTableMatrix(cells);
            event.preventDefault();
            event.clipboardData.setData('text/plain', selectedMatrixAsTsv(matrix));
            event.clipboardData.setData('text/html', selectedMatrixAsHtml(matrix));
        });

        editor.addEventListener('dragover', event => {
            if (!draggedNoteTable) return;
            event.preventDefault();
            event.stopPropagation();

            const range = caretRangeFromPoint(event.clientX, event.clientY);
            if (range && !range.commonAncestorContainer.parentElement?.closest?.('[data-note-table="1"]')) {
                placeTableDropMarker(range);
            }
        });

        editor.addEventListener('drop', event => {
            if (!draggedNoteTable) return;
            event.preventDefault();
            event.stopPropagation();

            let dropRange = document.createRange();

            if (tableDropMarker?.parentNode) {
                dropRange.setStartBefore(tableDropMarker);
                dropRange.collapse(true);
            } else {
                dropRange = caretRangeFromPoint(event.clientX, event.clientY) || dropRange;
            }

            removeTableDropMarker();
            dropRange.insertNode(draggedNoteTable);
            draggedNoteTable.classList.remove('note-table-dragging');

            const spacer = document.createElement('div');
            spacer.innerHTML = '<br>';
            draggedNoteTable.after(spacer);

            const caret = document.createRange();
            caret.selectNodeContents(spacer);
            caret.collapse(true);

            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(caret);
            savedEditorRange = caret.cloneRange();
            draggedNoteTable = null;
        });

        editor.addEventListener('click', event => {
            const link = internalNoteLinkFromElement(event.target);
            if (!link) return;
            event.preventDefault();
            if (event.ctrlKey || event.metaKey) {
                event.stopPropagation();
                jumpToLinkedNote(link.noteId, {closeEditor: true});
            }
        });
    }


    function noteLinkDisplayTitle(note) {
        const index = notesData.findIndex(item => item.id === note.id);
        const title = cleanNoteTitle(note.title || '');
        if (title) return title;

        const preview = stripHtml(note.text || '').replace(/\s+/g, ' ').trim();
        return preview.slice(0, 55) || `第 ${index + 1} 則筆記`;
    }

    function openNoteLinkModal() {
        rememberEditorSelection();

        const editor = document.getElementById('modal-text');
        const selection = window.getSelection();
        pendingNoteLinkRange = savedEditorRange && editor.contains(savedEditorRange.commonAncestorContainer)
            ? savedEditorRange.cloneRange()
            : null;

        selectedNoteLinkOriginalText = '';
        if (selection?.rangeCount) {
            const range = selection.getRangeAt(0);
            if (editor.contains(range.commonAncestorContainer)) {
                selectedNoteLinkOriginalText = selection.toString().trim();
            }
        }

        selectedNoteLinkTargetId = null;
        document.getElementById('note-link-label').value = selectedNoteLinkOriginalText;
        document.getElementById('note-link-search').value = '';
        document.getElementById('note-link-selected').textContent = '尚未選擇目標筆記';
        renderNoteLinkCandidates();
        document.getElementById('noteLinkModal').classList.add('active');

        requestAnimationFrame(() => document.getElementById('note-link-search').focus());
    }

    function closeNoteLinkModal() {
        document.getElementById('noteLinkModal').classList.remove('active');
        selectedNoteLinkTargetId = null;
    }

    // 舊筆記可能使用數字 ID；HTML data-* 讀回時一律是字串。
    // 比對時相容兩者，實際儲存仍沿用原本 ID，連結不依畫面順序綁定。
    function resolveLinkedNote(noteId) {
        if (noteId === null || noteId === undefined || noteId === '') return null;
        return notesData.find(note => note.id === noteId)
            || notesData.find(note => note.id !== null && note.id !== undefined && String(note.id) === String(noteId))
            || null;
    }

    function internalNoteLinkFromElement(element) {
        const link = element?.closest?.('[data-note-link], a[href^="#note-"]');
        if (!link) return null;
        let noteId = link.getAttribute('data-note-link');
        if (noteId === null || noteId === '') {
            const href = link.getAttribute('href') || '';
            if (!href.startsWith('#note-')) return null;
            noteId = href.slice(6);
            try { noteId = decodeURIComponent(noteId); } catch (_) { /* 相容舊版未編碼的連結。 */ }
        }
        return {element: link, noteId};
    }

    function renderNoteLinkCandidates() {
        const query = document.getElementById('note-link-search').value.normalize('NFKC').trim().toLowerCase();
        const list = document.getElementById('note-link-list');
        const numberMatch = query.match(/^(?:#\s*|第\s*)?([0-9]+)\s*(?:[.、]|(?:則|篇)(?:筆記)?)?$/);
        const number = numberMatch && Number.isSafeInteger(Number(numberMatch[1])) && Number(numberMatch[1]) > 0
            ? Number(numberMatch[1]) : null;
        const matches = notesData
            .map((note, index) => ({note, index}))
            .filter(({note, index}) => !query || index + 1 === number
                || `${note.title || ''} ${stripHtml(note.text || '')}`.normalize('NFKC').toLowerCase().includes(query));

        // 精確編號永遠排最前面，再保留原本的數字關鍵字搜尋。
        // 即使有超過 120 則內文包含同個數字，也不會把指定編號截掉。
        if (number !== null) matches.sort((a, b) => Number(b.index + 1 === number) - Number(a.index + 1 === number));

        list.replaceChildren();
        if (!matches.length) {
            const empty = document.createElement('div');
            empty.className = 'note-link-empty';
            empty.textContent = '找不到符合的筆記。';
            list.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        matches.slice(0, 120).forEach(({note, index}) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'note-link-item' + (selectedNoteLinkTargetId === note.id ? ' selected' : '');
            button.dataset.noteLinkTarget = String(note.id);
            const title = noteLinkDisplayTitle(note);
            const snippet = stripHtml(note.text || '').replace(/\s+/g, ' ').trim().slice(0, 100);
            button.innerHTML = `<span class="note-link-index">#${index + 1}</span><span><span class="note-link-title">${escapeHtml(title)}</span>${snippet ? `<span class="note-link-snippet">${escapeHtml(snippet)}</span>` : ''}</span>`;
            button.addEventListener('click', () => selectNoteLinkTarget(note.id));
            fragment.appendChild(button);
        });
        list.appendChild(fragment);
    }


    function selectNoteLinkTarget(noteId) {
        const note = resolveLinkedNote(noteId);
        if (!note) return;

        selectedNoteLinkTargetId = note.id;
        const title = noteLinkDisplayTitle(note);
        const index = notesData.indexOf(note);

        document.getElementById('note-link-selected').textContent = `已選擇：第 ${index + 1} 則｜${title}`;

        const labelInput = document.getElementById('note-link-label');
        if (!labelInput.value.trim()) labelInput.value = `連結到：${title}`;

        renderNoteLinkCandidates();
    }

    function insertSelectedNoteLink() {
        const targetNote = resolveLinkedNote(selectedNoteLinkTargetId);
        if (!targetNote) return alert('請先選擇要連結的目標筆記。');

        const editor = document.getElementById('modal-text');
        const labelInput = document.getElementById('note-link-label');
        const label = labelInput.value.trim() || `連結到：${noteLinkDisplayTitle(targetNote)}`;

        let range = pendingNoteLinkRange && editor.contains(pendingNoteLinkRange.commonAncestorContainer)
            ? pendingNoteLinkRange.cloneRange()
            : null;

        if (!range) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
        }

        range.deleteContents();

        const anchor = document.createElement('a');
        anchor.href = `#note-${encodeURIComponent(String(targetNote.id))}`;
        anchor.className = 'note-internal-link';
        anchor.dataset.noteLink = targetNote.id;
        anchor.title = `跳到：${noteLinkDisplayTitle(targetNote)}（編輯中可按住 Ctrl／⌘ 點擊）`;
        anchor.textContent = label;

        range.insertNode(anchor);

        const spacer = document.createTextNode('\u00A0');
        anchor.after(spacer);

        const caret = document.createRange();
        caret.setStartAfter(spacer);
        caret.collapse(true);

        const selection = window.getSelection();
        editor.focus();
        selection.removeAllRanges();
        selection.addRange(caret);
        savedEditorRange = caret.cloneRange();

        closeNoteLinkModal();
    }

    function resetFiltersForNoteJump() {
        clearTimeout(searchRenderTimer);
        searchRenderTimer = null;
        clearRandomDraw(false);
        document.getElementById('search-input').value = '';
        isStarFilterActive = false;
        renderStarFilterControl();
        activeCategoryFilterId = null;
        updateCategoryUi();
    }

    function jumpToLinkedNote(noteId, {closeEditor = false} = {}) {
        const note = resolveLinkedNote(noteId);
        if (!note) return alert('這個連結指向的筆記可能已經被刪除。');

        if (closeEditor && document.getElementById('noteModal').classList.contains('active')) closeModal();
        resetFiltersForNoteJump();
        noteBrowse.requestReveal(note.id);
        renderNotes();
        // 與儲存後定位共用工具列避讓與圖片載入校正，避免長筆記跳偏。
        focusSavedNoteAfterSave(note.id);
    }


    // 圖片是一個可選取的內容單位；工具列不放進可編輯內容。
    let selectedInlineImage = null;
    let inlineImageEditInProgress = false;
    let inlineImageInsertSequence = 0;

    function inlineImageControlsHtml() {
        return `<div id="inline-image-toolbar" role="toolbar" aria-label="圖片工具" hidden>
            <button type="button" tabindex="-1" data-inline-action="edit" title="畫記、旋轉與裁切圖片">✎ 編輯／標記</button>
            <button type="button" tabindex="-1" data-inline-action="larger" title="放大圖片">＋</button>
            <button type="button" tabindex="-1" data-inline-action="smaller" title="縮小圖片">－</button>
            <button type="button" tabindex="-1" data-inline-action="delete" title="刪除選取圖片（Backspace／Delete）">刪除</button>
        </div>`;
    }

    function inlineImageNode(element) {
        return element?.matches?.('img') ? element : element?.querySelector('img');
    }

    function createInlineImageElement(src, classes = 'image-size-md image-align-inline') {
        // 使用原生 img 作為文字中的一個單位，不再包住不可編輯的容器。
        const image = document.createElement('img');
        image.className = `inline-note-image ${classes}`;
        image.dataset.inlineImage = '1';
        image.src = src;
        image.alt = '行內筆記圖片';
        image.loading = 'lazy';
        image.decoding = 'async';
        bindInlineImageElement(image);
        return image;
    }

    function bindInlineImageElement(image) {
        if (!image) return;
        image.dataset.inlineImage = '1';
        image.removeAttribute('contenteditable');
        image.draggable = false;
    }

    function setInlineImageRange(range) {
        savedEditorFocusHost = getEditorFocusHostFromRange(range);
        focusEditorHostForRange(range);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        rememberEditorSelection();
    }

    function ensureInlineImageCaretStops(wrapper) {
        // 零寬文字只作為游標落點，儲存時移除；不佔版面、不產生空白行。
        for (const before of [true, false]) {
            const sibling = before ? wrapper.previousSibling : wrapper.nextSibling;
            if (sibling?.nodeType === Node.TEXT_NODE && sibling.data.length) continue;
            const stop = document.createTextNode('\u200B');
            if (before) wrapper.before(stop); else wrapper.after(stop);
        }
    }

    function imageSelectedByRange() {
        const editor = document.getElementById('modal-text');
        const selection = window.getSelection();
        if (!selection?.rangeCount) return null;
        const range = selection.getRangeAt(0);
        if (range.collapsed || range.startContainer !== range.endContainer ||
            range.endOffset !== range.startOffset + 1 ||
            !editor.contains(range.startContainer)) return null;
        const node = range.startContainer.childNodes[range.startOffset];
        return node?.matches?.('[data-inline-image="1"]') ? node : null;
    }

    function clearInlineImageSelection() {
        selectedInlineImage?.classList.remove('image-selected');
        selectedInlineImage = null;
        const toolbar = document.getElementById('inline-image-toolbar');
        if (toolbar && !toolbar.hidden) toolbar.hidden = true;
    }

    function positionInlineImageToolbar() {
        const toolbar = document.getElementById('inline-image-toolbar');
        if (!toolbar || !selectedInlineImage?.isConnected || toolbar.hidden) return;
        const rect = selectedInlineImage.getBoundingClientRect();
        toolbar.style.left = Math.max(12, Math.min(rect.left, innerWidth - toolbar.offsetWidth - 12)) + 'px';
        toolbar.style.top = Math.max(12, Math.min(rect.top - toolbar.offsetHeight - 8, innerHeight - toolbar.offsetHeight - 12)) + 'px';
    }

    function syncInlineImageSelection() {
        if (noteImageEditor.isOpen()) { clearInlineImageSelection(); return; }
        const wrapper = imageSelectedByRange();
        if (!wrapper || !document.getElementById('noteModal').classList.contains('active')) {
            clearInlineImageSelection();
            return;
        }
        if (selectedInlineImage !== wrapper) clearInlineImageSelection();
        selectedInlineImage = wrapper;
        if (!wrapper.classList.contains('image-selected')) wrapper.classList.add('image-selected');
        const toolbar = document.getElementById('inline-image-toolbar');
        if (toolbar) { toolbar.hidden = false; positionInlineImageToolbar(); }
    }

    function selectInlineImage(wrapper) {
        if (!wrapper?.isConnected) return;
        clearTableCellSelection();
        const range = document.createRange();
        range.selectNode(wrapper);
        setInlineImageRange(range);
        syncInlineImageSelection();
    }

    function placeCaretBesideInlineImage(wrapper, before = false) {
        if (!wrapper?.isConnected) return;
        clearInlineImageSelection();
        ensureInlineImageCaretStops(wrapper);
        const sibling = before ? wrapper.previousSibling : wrapper.nextSibling;
        const range = document.createRange();
        if (sibling?.nodeType === Node.TEXT_NODE) {
            range.setStart(sibling, before ? sibling.length : /^\u200B/.test(sibling.data) ? 1 : 0);
        } else if (before) range.setStartBefore(wrapper);
        else range.setStartAfter(wrapper);
        range.collapse(true);
        setInlineImageRange(range);
    }

    function cleanInlineImageHtml(wrapper) {
        const clone = wrapper.cloneNode(true);
        clone.querySelectorAll('.inline-image-controls').forEach(element => element.remove());
        clone.classList.remove('image-selected', 'controls-open', 'inline-image-dragging');
        clone.removeAttribute('data-editor-bound');
        clone.removeAttribute('data-image-insert-token');
        return clone.outerHTML;
    }

    function deleteInlineImage(wrapper) {
        if (!wrapper?.isConnected) return false;
        const range = document.createRange();
        range.selectNode(wrapper);
        clearInlineImageSelection();
        setInlineImageRange(range);
        inlineImageEditInProgress = true;
        try {
            // 明確選取整張圖再刪除，沿用原生復原紀錄，不會誤刪相鄰文字。
            if (!document.execCommand('delete', false, null)) {
                range.deleteContents();
                range.collapse(true);
                setInlineImageRange(range);
            }
        } finally { inlineImageEditInProgress = false; }
        rememberEditorSelection();
        return true;
    }

    function adjacentInlineImage(range, backward) {
        if (!range?.collapsed) return null;
        const editor = document.getElementById('modal-text');
        if (!editor.contains(range.startContainer)) return null;
        const isEmpty = text => !text.replace(/[\u200B\uFEFF]/g, '');
        const isBoundary = node => node === editor || node?.nodeType === 1 &&
            /^(DIV|P|LI|UL|OL|TD|TH|BLOCKQUOTE|PRE|H[1-6])$/.test(node.tagName);
        let node = range.startContainer;
        let offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE) {
            if (!isEmpty(backward ? node.data.slice(0, offset) : node.data.slice(offset))) return null;
        } else {
            const child = node.childNodes[backward ? offset - 1 : offset];
            if (child) return inspect(child);
        }
        return beside(node);
        function beside(current) {
            while (current && !isBoundary(current)) {
                const sibling = backward ? current.previousSibling : current.nextSibling;
                if (sibling) return inspect(sibling);
                current = current.parentNode;
            }
            return null;
        }
        function inspect(current) {
            if (current.nodeType === Node.TEXT_NODE) return isEmpty(current.data) ? beside(current) : null;
            if (current.matches?.('[data-inline-image="1"]')) return current;
            if (current.nodeType !== 1) return beside(current);
            if (isBoundary(current) || current.tagName === 'BR' || current.contentEditable === 'false') return null;
            const child = backward ? current.lastChild : current.firstChild;
            return child ? inspect(child) : beside(current);
        }
    }

    function handleInlineImageKeydown(event) {
        if (event.defaultPrevented || event.isComposing || event.keyCode === 229 ||
            getSelectedTableCells().length > 1) return false;
        const wrapper = imageSelectedByRange();
        if (wrapper) {
            if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault(); deleteInlineImage(wrapper); return true;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey &&
                ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(event.key)) {
                event.preventDefault();
                placeCaretBesideInlineImage(wrapper, ['ArrowLeft', 'ArrowUp', 'Home'].includes(event.key));
                return true;
            }
            if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                placeCaretBesideInlineImage(wrapper);
                document.execCommand(event.shiftKey ? 'insertLineBreak' : 'insertParagraph', false, null);
                rememberEditorSelection();
                return true;
            }
            if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
                placeCaretBesideInlineImage(wrapper);
            }
        }
        if (!wrapper && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            const selection = window.getSelection();
            const adjacent = selection?.rangeCount && adjacentInlineImage(selection.getRangeAt(0), event.key === 'ArrowLeft');
            if (adjacent) { event.preventDefault(); selectInlineImage(adjacent); return true; }
        }
        return false;
    }

    function handleInlineImageBeforeInput(event) {
        if (event.defaultPrevented || event.isComposing || inlineImageEditInProgress ||
            getSelectedTableCells().length > 1) return;
        const selected = imageSelectedByRange();
        if (selected && ['insertParagraph', 'insertLineBreak', 'insertText'].includes(event.inputType)) {
            if (event.inputType === 'insertText' && event.data == null) return;
            event.preventDefault();
            placeCaretBesideInlineImage(selected);
            document.execCommand(event.inputType, false, event.data);
            rememberEditorSelection();
            return;
        }
        if (!['deleteContentBackward', 'deleteContentForward'].includes(event.inputType)) return;
        const selection = window.getSelection();
        if (!selection?.rangeCount) return;
        const wrapper = imageSelectedByRange() || adjacentInlineImage(selection.getRangeAt(0), event.inputType === 'deleteContentBackward');
        if (wrapper) { event.preventDefault(); deleteInlineImage(wrapper); }
    }

    function insertImageHtmlWithHistory(html, range) {
        const editor = document.getElementById('modal-text');
        const template = document.createElement('template');
        template.innerHTML = html;
        const image = template.content.querySelector('[data-inline-image="1"]');
        const token = 'image-' + (++inlineImageInsertSequence);
        image.dataset.imageInsertToken = token;
        // 與圖片一起插入文字落點，讓段首／段尾也維持同一段落，並一起支援復原。
        image.before(document.createTextNode('\u200B'));
        image.after(document.createTextNode('\u200B'));
        clearInlineImageSelection();
        // 在段落邊界使用文字節點上的游標，避免 Chromium 把圖片插到段落外。
        if (range.collapsed && range.startContainer.nodeType === Node.ELEMENT_NODE) {
            const container = range.startContainer;
            const before = container.childNodes[range.startOffset - 1];
            const after = container.childNodes[range.startOffset];
            if (before?.nodeType === Node.TEXT_NODE) range.setStart(before, before.length);
            else if (after?.nodeType === Node.TEXT_NODE) range.setStart(after, 0);
            range.collapse(true);
        }
        setInlineImageRange(range);
        inlineImageEditInProgress = true;
        try {
            if (!document.execCommand('insertHTML', false, template.innerHTML)) {
                range.deleteContents();
                range.insertNode(template.content);
            }
        } finally { inlineImageEditInProgress = false; }
        const inserted = editor.querySelector('[data-image-insert-token="' + token + '"]');
        if (!inserted) throw new Error('圖片未能插入目前位置');
        inserted.removeAttribute('data-image-insert-token');
        bindInlineImageElement(inserted);
        ensureInlineImageCaretStops(inserted);
        placeCaretBesideInlineImage(inserted);
        return inserted;
    }

    function handleInlineImageAction(wrapper, action) {
        if (!wrapper?.isConnected) return;
        if (action === 'edit') { noteImageEditor.open({image:wrapper}); return; }
        if (action === 'delete') { deleteInlineImage(wrapper); return; }
        if (action !== 'smaller' && action !== 'larger') return;
        const clone = wrapper.cloneNode(true);
        const sizes = ['image-size-xs', 'image-size-sm', 'image-size-md', 'image-size-lg', 'image-size-full'];
        let index = sizes.findIndex(size => clone.classList.contains(size));
        if (index < 0) index = 2;
        index = action === 'smaller' ? Math.max(0, index - 1) : Math.min(sizes.length - 1, index + 1);
        clone.classList.remove(...sizes);
        clone.classList.add(sizes[index]);
        clone.style.removeProperty('width');
        inlineImageNode(clone)?.style.removeProperty('width');
        const range = document.createRange();
        range.selectNode(wrapper);
        selectInlineImage(insertImageHtmlWithHistory(cleanInlineImageHtml(clone), range));
    }

    function insertInlineImage(src, range = savedEditorRange, imageEdit = null) {
        const editor = document.getElementById('modal-text');
        let target = range && editor.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
        if (!target) { target = document.createRange(); target.selectNodeContents(editor); target.collapse(false); }
        const anchor = target.startContainer.nodeType === 1 ? target.startContainer : target.startContainer.parentElement;
        const existingImage = anchor?.closest('[data-inline-image="1"]');
        if (existingImage) { target.setStartAfter(existingImage); target.collapse(true); }
        // 空白行的 <br> 是瀏覽器占位符，不能把它留在圖片之前。
        const block = anchor?.closest('li, p, div, td, th');
        if (target.collapsed && block && editor.contains(block) &&
            !block.textContent.replace(/[\s\u200B\uFEFF]/g, '') &&
            !block.querySelector('img, table, ul, ol, hr, video, audio') &&
            block.querySelectorAll('br').length <= 1) target.selectNodeContents(block);
        const wrapper = createInlineImageElement(src);
        if (imageEdit) wrapper.setAttribute('data-note-image-edit', JSON.stringify(imageEdit));
        return insertImageHtmlWithHistory(cleanInlineImageHtml(wrapper), target);
    }

    function setupInlineImageSelection() {
        const editor = document.getElementById('modal-text');
        // 委派事件：清單縮排、復原、貼上產生的新圖片也能立即操作。
        editor.addEventListener('pointerdown', event => {
            const image = event.target.closest?.('img[data-inline-image="1"]');
            if (!image || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey || event.isPrimary === false) return;
            event.preventDefault();
            event.stopPropagation();
            resetInlineImageDrag();
            inlineImagePointer = { image, id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
            image.setPointerCapture?.(event.pointerId);
        }, true);
        editor.addEventListener('click', event => {
            const image = event.target.closest?.('img[data-inline-image="1"]');
            if (!image || event.button !== 0 || event.shiftKey || draggedInlineImage) return;
            event.preventDefault();
            event.stopPropagation();
            if (Date.now() >= suppressInlineImageClickUntil) selectInlineImage(image);
        }, true);
        editor.addEventListener('dragstart', event => {
            if (event.target.closest?.('img[data-inline-image="1"]')) event.preventDefault();
        }, true);
        editor.addEventListener('load', event => {
            if (event.target.matches?.('img[data-inline-image="1"]')) positionInlineImageToolbar();
        }, true);
        document.body.insertAdjacentHTML('beforeend', inlineImageControlsHtml());
        const toolbar = document.getElementById('inline-image-toolbar');
        toolbar.addEventListener('mousedown', event => event.preventDefault());
        toolbar.addEventListener('click', event => {
            const action = event.target.closest('[data-inline-action]')?.dataset.inlineAction;
            if (action && selectedInlineImage) handleInlineImageAction(selectedInlineImage, action);
        });
        document.addEventListener('selectionchange', syncInlineImageSelection);
        document.addEventListener('pointermove', updateInlineImagePointer, { passive: false });
        document.addEventListener('pointerup', finishInlineImagePointer);
        document.addEventListener('lostpointercapture', event => {
            if (event.pointerId === inlineImagePointer?.id) resetInlineImageDrag();
        });
        document.addEventListener('visibilitychange', () => {if (document.hidden) resetInlineImageDrag();});
        document.addEventListener('pointercancel', event => {
            if (event.pointerId === inlineImagePointer?.id) resetInlineImageDrag();
        });
        document.addEventListener('scroll', positionInlineImageToolbar, true);
        window.addEventListener('resize', positionInlineImageToolbar);
        editor.addEventListener('beforeinput', handleInlineImageBeforeInput, true);
        editor.addEventListener('compositionstart', () => {
            const wrapper = imageSelectedByRange();
            if (wrapper) placeCaretBesideInlineImage(wrapper);
        });
        editor.addEventListener('input', event => {
            if (['historyUndo', 'historyRedo', 'insertFromPaste'].includes(event.inputType)) {
                prepareInlineImagesInEditor();
                syncInlineImageSelection();
            }
        });

    }

    function prepareInlineImagesInEditor() {
        const editor = document.getElementById('modal-text');
        if (!editor) return;

        /* 先移除舊版非破壞性標記留下的純顯示圖層。 */
        editor.querySelectorAll(
            '.inline-annotation-overlay, .annotation-badge'
        ).forEach(element => element.remove());

        /*
         * 舊版可能留下：
         * 1. inline-note-image 但沒有 data-inline-image
         * 2. wrapper 裡又包了一層 wrapper
         * 3. note-image-frame / annotated-image-stack
         *
         * 全部重建成目前可拖曳、縮放、對齊、刪除的標準格式。
         */
        const legacyWrappers = Array.from(
            editor.querySelectorAll(
                '.inline-note-image, [data-inline-image="1"]'
            )
        ).filter(wrapper => {
            const parentWrapper = wrapper.parentElement?.closest?.(
                '.inline-note-image, [data-inline-image="1"]'
            );
            return !parentWrapper;
        });

        legacyWrappers.forEach(wrapper => {
            // 原生圖片保持原節點；舊容器只在首次開啟時轉換。
            if (wrapper.matches('img')) {
                wrapper.dataset.inlineImage = '1';
                return;
            }
            replaceLegacyImageElement(wrapper, wrapper);
        });

        /* 舊展示用外框中的圖片改成可編輯行內圖片。 */
        editor.querySelectorAll(
            '.note-image-frame, .annotated-image-stack'
        ).forEach(container => {
            replaceLegacyImageElement(container, container);
        });

        /* 最後處理任何仍未包裝的裸圖片。 */
        editor.querySelectorAll('img').forEach(image => {
            if (image.closest('[data-inline-image="1"]')) return;

            replaceLegacyImageElement(image, image);
        });

        /* 某些更舊版本會多包 note-images-container，解除外框。 */
        editor.querySelectorAll('.note-images-container').forEach(container => {
            const parent = container.parentNode;
            if (!parent) return;

            while (container.firstChild) {
                parent.insertBefore(container.firstChild, container);
            }
            container.remove();
        });

        editor.querySelectorAll('[data-inline-image="1"]').forEach(wrapper => {
            wrapper.classList.add('inline-note-image');
            wrapper.removeAttribute('data-image-annotation');

            if (
                ![...wrapper.classList].some(
                    className => className.startsWith('image-size-')
                )
            ) {
                wrapper.classList.add('image-size-md');
            }

            if (
                ![...wrapper.classList].some(
                    className => className.startsWith('image-align-')
                )
            ) {
                wrapper.classList.add('image-align-inline');
            }

            const image = inlineImageNode(wrapper);
            if (!image) {
                wrapper.remove();
                return;
            }

            image.loading = 'lazy';
            image.decoding = 'async';
            image.draggable = false;

            wrapper.querySelectorAll('.inline-image-controls').forEach(control => control.remove());
            wrapper.classList.remove('controls-open', 'image-selected');
            wrapper.style.removeProperty('float');
            ensureInlineImageCaretStops(wrapper);

            bindInlineImageElement(wrapper);
        });
        // 修正舊版在純圖片箭頭列留下的單一換行占位符。
        editor.querySelectorAll('ul.note-arrow-list li').forEach(item => {
            if (item.querySelector('ul, ol') || item.textContent.replace(/[\s\u200B\uFEFF]/g, '') || !item.querySelector('img')) return;
            const breaks = item.querySelectorAll('br');
            if (breaks.length !== 1) return;
            const before = document.createRange();
            before.selectNodeContents(item);
            before.setEndBefore(breaks[0]);
            if (!before.cloneContents().querySelector('img')) breaks[0].remove();
        });
        noteInstantEditor.prepare();
    }

    function chooseInlineImage() {
        rememberEditorSelection();
        document.getElementById('inline-image-file-input').click();
    }

    function caretRangeFromPoint(x, y) {
        if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
        if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (!pos) return null;
            const range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
            return range;
        }
        return null;
    }

    function removeInlineDropMarker() {
        if (inlineDropMarker) inlineDropMarker.remove();
        inlineDropMarker = null;
        inlineDropRange = null;
    }

    function resetInlineImageDrag() {
        const pointer = inlineImagePointer;
        inlineImagePointer = null;
        try {if (pointer?.image.hasPointerCapture?.(pointer.id)) pointer.image.releasePointerCapture(pointer.id);} catch (_) {}
        if (inlineImageScrollFrame) cancelAnimationFrame(inlineImageScrollFrame);
        inlineImageScrollFrame = null;
        draggedInlineImage?.classList.remove('inline-image-dragging');
        draggedInlineImage = null;
        document.body.classList.remove('inline-image-drag-active');
        removeInlineDropMarker();
    }

    function updateInlineImagePointer(event) {
        const pointer = inlineImagePointer;
        if (!pointer || event.pointerId !== pointer.id) return;
        if (event.pointerType === 'mouse' && !(event.buttons & 1)) {resetInlineImageDrag();return;}
        pointer.x = event.clientX; pointer.y = event.clientY;
        if (!pointer.active && Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < 6) return;
        event.preventDefault();
        if (!pointer.active) {
            pointer.active = true;
            clearInlineImageSelection();
            draggedInlineImage = pointer.image;
            pointer.image.classList.add('inline-image-dragging');
            document.body.classList.add('inline-image-drag-active');
            inlineImageScrollFrame = requestAnimationFrame(scrollInlineImagePointer);
        }
        const destination = resolveInlineImageDrop(pointer.x, pointer.y);
        if (destination) placeInlineDropMarker(destination.range, destination.bounds);
        else removeInlineDropMarker();
    }

    function scrollInlineImagePointer() {
        const pointer = inlineImagePointer;
        if (!pointer?.active) return;
        let host = document.getElementById('modal-text');
        while (host && (host.scrollHeight <= host.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(host).overflowY))) host = host.parentElement;
        if (host) {
            const rect = host.getBoundingClientRect();
            const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
            if (pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= top - 24 && pointer.y <= bottom + 24) {
                const amount = pointer.y < top + 32 ? -12 : pointer.y > bottom - 32 ? 12 : 0;
                if (amount) {
                    host.scrollTop += amount;
                    const destination = resolveInlineImageDrop(pointer.x, pointer.y);
                    if (destination) placeInlineDropMarker(destination.range, destination.bounds);
                    else removeInlineDropMarker();
                }
            }
        }
        inlineImageScrollFrame = requestAnimationFrame(scrollInlineImagePointer);
    }

    function finishInlineImagePointer(event) {
        const pointer = inlineImagePointer;
        if (!pointer || pointer.id !== event.pointerId) return;
        try {
            if (pointer.active) {
                const destination = resolveInlineImageDrop(event.clientX, event.clientY);
                if (destination) moveInlineImageToRange(pointer.image, destination.range);
            } else {
                selectInlineImage(pointer.image);
            }
            suppressInlineImageClickUntil = Date.now() + 250;
        } finally {
            resetInlineImageDrag();
        }
    }

    function validInlineImageDropRange(range, source = draggedInlineImage) {
        const editor = document.getElementById('modal-text');
        if (!range || !range.collapsed || !editor.contains(range.startContainer)) return false;
        const node = range.startContainer;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (source?.contains(node) || element?.closest('[data-inline-image="1"], .inline-image-controls, .note-table-controls')) return false;
        return element === editor || Boolean(element?.isContentEditable);
    }

    function resolveInlineImageDrop(x, y) {
        const editor = document.getElementById('modal-text');
        const target = document.elementFromPoint(x, y);
        if (!target || !editor.contains(target)) return null;
        let image = target.closest('[data-inline-image="1"]');
        let range = null;
        if (!image) {
            range = caretRangeFromPoint(x, y);
            const anchor = range?.startContainer;
            image = (anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement)?.closest?.('[data-inline-image="1"]');
        }
        if (image) {
            if (image === draggedInlineImage || draggedInlineImage?.contains(image)) return null;
            const rect = image.getBoundingClientRect();
            const block = getComputedStyle(image).display === 'block';
            const before = block ? y < rect.top + rect.height / 2
                : y < rect.top + rect.height / 4 ? true
                : y > rect.bottom - rect.height / 4 ? false
                : x < rect.left + rect.width / 2;
            range = document.createRange();
            if (before) range.setStartBefore(image); else range.setStartAfter(image);
            range.collapse(true);
            if (!validInlineImageDropRange(range)) return null;
            return {
                range,
                bounds: block
                    ? { left: rect.left, top: (before ? rect.top : rect.bottom) - 2, width: rect.width, height: 3 }
                    : { left: (before ? rect.left : rect.right) - 2, top: rect.top, width: 3, height: rect.height }
            };
        }
        if (!range) return null;
        range.collapse(true);
        if (!validInlineImageDropRange(range)) return null;
        const caretRect = range.getBoundingClientRect();
        return { range, bounds: {
            left: caretRect.height ? caretRect.left : x,
            top: caretRect.height ? caretRect.top : y - 12,
            width: 3, height: Math.max(24, caretRect.height)
        } };
    }

    function placeInlineDropMarker(range, bounds) {
        if (!validInlineImageDropRange(range)) { removeInlineDropMarker(); return; }
        inlineDropRange = range.cloneRange();
        if (!inlineDropMarker) {
            inlineDropMarker = document.createElement('div');
            inlineDropMarker.className = 'inline-drop-marker';
            inlineDropMarker.setAttribute('aria-hidden', 'true');
            // 指示線放在編輯器外，不在 dragover 期間改動文字、圖片或游標。
            document.body.appendChild(inlineDropMarker);
        }
        Object.assign(inlineDropMarker.style, {
            left: bounds.left + 'px', top: bounds.top + 'px',
            width: Math.max(3, bounds.width) + 'px', height: Math.max(3, bounds.height) + 'px'
        });
    }

    function moveInlineImageToRange(wrapper, range) {
        const editor = document.getElementById('modal-text');
        if (!wrapper?.isConnected || !editor.contains(wrapper) || !validInlineImageDropRange(range, wrapper)) return false;
        const destination = range.cloneRange();
        destination.insertNode(wrapper);
        const caret = document.createRange();
        caret.setStartAfter(wrapper);
        caret.collapse(true);
        clearTableCellSelection();
        savedEditorFocusHost = getEditorFocusHostFromRange(caret);
        focusEditorHostForRange(caret);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(caret);
        rememberEditorSelection();
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    }

    function hasIncomingInlineImage(dataTransfer) {
        if (!dataTransfer) return false;
        return Array.from(dataTransfer.items || []).some(item => item.type.startsWith('image/')) ||
            Array.from(dataTransfer.files || []).some(file => file.type.startsWith('image/')) ||
            extractImageSources(dataTransfer).length > 0;
    }

    async function insertDataTransferInline(dataTransfer, range) {
        const request=noteOpenRequest;
        const files = Array.from(dataTransfer.files || []).filter(file => file.type.startsWith('image/'));
        let inserted = false;
        let workingRange = range?.cloneRange();
        for (const file of files) {
            try {
                const wrapper = insertInlineImage(await readImageFile(file), workingRange);
                workingRange = document.createRange();
                workingRange.setStartAfter(wrapper);
                workingRange.collapse(true);
                inserted = true;
            } catch (error) { console.warn(error); }
        }
        if (!files.length) {
            for (const src of extractImageSources(dataTransfer)) {
                const clean = src.trim();
                if (!clean.startsWith('data:image/') && !/^https?:\/\//i.test(clean)) continue;
                const original=await noteExternalImages.prepareInsert(clean);if(request!==noteOpenRequest||!document.getElementById('noteModal').classList.contains('active'))return inserted;
                const wrapper = insertInlineImage(original, workingRange);
                workingRange = document.createRange();
                workingRange.setStartAfter(wrapper);
                workingRange.collapse(true);
                inserted = true;
            }
        }
        return inserted;
    }

    function setupPreviewSorting() {
        if (previewSortable) return;

        const grid = document.getElementById('preview-grid');
        if (!grid || typeof Sortable === 'undefined') return;

        previewSortable = new Sortable(grid, {
            animation: 150,
            handle: '.preview-drag-handle, .preview-image-box',
            forceFallback: true,
            fallbackOnBody: true,
            fallbackTolerance: 5,
            ghostClass: 'preview-ghost',
            onStart() { suppressGalleryImageClickUntil = Date.now() + 1000; },
            onEnd(event) {
                suppressGalleryImageClickUntil = Date.now() + 400;
                if (event.oldIndex === event.newIndex || event.oldIndex == null || event.newIndex == null) return;
                const [moved] = currentPastedImages.splice(
                    event.oldIndex,
                    1
                );
                currentPastedImages.splice(event.newIndex, 0, moved);
                renderPreviewGrid();
            }
        });
    }

    function setupInlineImageEditor() {
        if (setupInlineImageEditor.done) return;
        setupInlineImageEditor.done = true;
        setupInlineImageSelection();
        const editor = document.getElementById('modal-text');
        const inlineInput = document.getElementById('inline-image-file-input');

        inlineInput.addEventListener('change', async event => {
            let range = savedEditorRange?.cloneRange();
            for (const file of Array.from(event.target.files || [])) {
                try {
                    const wrapper = insertInlineImage(await readImageFile(file), range);
                    range = document.createRange();
                    range.setStartAfter(wrapper);
                    range.collapse(true);
                } catch (error) { console.warn(error); }
            }
            event.target.value = '';
        });

        editor.addEventListener('dragover', event => {
            if (draggedNoteTable || (!draggedInlineImage && !hasIncomingInlineImage(event.dataTransfer))) return;
            event.preventDefault();
            event.stopPropagation();
            const destination = resolveInlineImageDrop(event.clientX, event.clientY);
            if (destination) {
                if (event.dataTransfer) event.dataTransfer.dropEffect = draggedInlineImage ? 'move' : 'copy';
                placeInlineDropMarker(destination.range, destination.bounds);
            } else {
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
                removeInlineDropMarker();
            }
        });

        editor.addEventListener('drop', async event => {
            if (draggedNoteTable) return;
            const source = draggedInlineImage;
            if (!source && !hasIncomingInlineImage(event.dataTransfer)) return;
            event.preventDefault();
            event.stopPropagation();
            try {
                // 最終落點重新判定，禁止使用上一張圖片殘留的位置或放進自己內部。
                const destination = resolveInlineImageDrop(event.clientX, event.clientY);
                if (!destination) return;
                if (source) moveInlineImageToRange(source, destination.range);
                else await insertDataTransferInline(event.dataTransfer, destination.range);
            } catch (error) {
                console.warn('圖片移動未完成：', error);
            } finally {
                resetInlineImageDrag();
            }
        });
        editor.addEventListener('dragleave', event => {
            if (!event.relatedTarget || !editor.contains(event.relatedTarget)) removeInlineDropMarker();
        });
        document.addEventListener('dragend', resetInlineImageDrag);
        document.addEventListener('drop', event => {
            if (draggedInlineImage) event.preventDefault();
            resetInlineImageDrag();
        });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && (draggedInlineImage || inlineImagePointer)) resetInlineImageDrag();
        });
        window.addEventListener('blur', resetInlineImageDrag);
    }

    function setupImageImport() {
        if (setupImageImport.done) return;
        setupImageImport.done = true;
        const pasteArea = document.getElementById('paste-container');
        const fileInput = document.getElementById('image-file-input');

        // 下方圖集介面已移除；圖片統一插入文字游標位置。
        if (!pasteArea || !fileInput) return;

        fileInput.addEventListener('change', async event => {
            for (const file of Array.from(event.target.files || [])) await addImageFile(file);
            event.target.value = '';
        });

        ['dragenter', 'dragover'].forEach(type => pasteArea.addEventListener(type, event => {
            event.preventDefault();
            event.stopPropagation();
            pasteArea.classList.add('dragover');
        }));
        ['dragleave', 'drop'].forEach(type => pasteArea.addEventListener(type, event => {
            event.preventDefault();
            event.stopPropagation();
            pasteArea.classList.remove('dragover');
        }));
        pasteArea.addEventListener('drop', event => importToGallery(event.dataTransfer));
    }

    window.addEventListener('paste', async function(e) {
        if (!document.getElementById('noteModal').classList.contains('active')) return;

        const clipboardData = e.clipboardData || window.clipboardData;
        const editor = document.getElementById('modal-text');
        if (!editor.contains(e.target) || !clipboardData) return;
        rememberEditorSelection();
        const targetCell = e.target.closest?.(
            '[data-note-table="1"] th, [data-note-table="1"] td'
        ) || (
            tableSelectionState.focusCell?.isConnected
                ? tableSelectionState.focusCell
                : null
        );

        if (targetCell) {
            const extracted = extractClipboardTableMatrix(clipboardData);
            const selectedCells = getSelectedTableCells();

            if (extracted.structured || selectedCells.length > 1) {
                e.preventDefault();

                const startCell = selectedCells.length
                    ? selectedCells
                        .slice()
                        .sort((a, b) => {
                            const pa = tableCellCoordinates(a);
                            const pb = tableCellCoordinates(b);
                            return pa.row - pb.row || pa.col - pb.col;
                        })[0]
                    : targetCell;

                pasteMatrixIntoTable(startCell, extracted.matrix);
                return;
            }
        }

        const imageItems = Array.from(clipboardData.items || [])
            .filter(item => item.type.startsWith('image/'));

        const targetIsEditor = editor.contains(e.target) ||
            (
                savedEditorRange &&
                editor.contains(savedEditorRange.commonAncestorContainer)
            );

        if (imageItems.length > 0) {
            e.preventDefault();
            let range = savedEditorRange?.cloneRange();

            for (const item of imageItems) {
                try {
                    const wrapper = insertInlineImage(
                        await readImageFile(item.getAsFile()),
                        range
                    );
                    range = document.createRange();
                    range.setStartAfter(wrapper);
                    range.collapse(true);
                } catch (error) {
                    console.warn(error);
                }
            }
            return;
        }

        if (targetIsEditor) {
            e.preventDefault();

            const html = clipboardData.getData('text/html');
            if (html) {
                document.execCommand(
                    'insertHTML',
                    false,
                    sanitizePastedCellHtml(html,clipboardData.getData('text/plain'))
                );
            } else {
                document.execCommand(
                    'insertHTML',
                    false,
                    noteClipboardContent.text(clipboardData.getData('text/plain'))
                );
            }

            prepareInlineImagesInEditor();
            rememberEditorSelection();
        }
    });


    function serializeEditorContent({prepare = true, packAssets = false} = {}) {
        const editor = document.getElementById('modal-text');
        if (prepare) prepareArrowNoteLists();
        const clone = editor.cloneNode(true);
        noteInstantEditor.clean(clone);
        if (packAssets) notePersistence.packImages(clone, editor);
        clone.querySelectorAll(
            '.inline-image-controls, .inline-drop-marker, ' +
            '.inline-annotation-overlay, .annotation-badge, ' +
            '.note-table-controls, .table-drop-marker, ' +
            '[data-selection-bookmark]'
        ).forEach(element => element.remove());

        clone.querySelectorAll('[data-image-annotation]').forEach(element => {
            element.removeAttribute('data-image-annotation');
        });
        clone.querySelectorAll('[data-inline-image="1"]').forEach(wrapper => {
            wrapper.removeAttribute('draggable');
            wrapper.removeAttribute('data-editor-bound');
            wrapper.classList.remove('inline-image-dragging', 'controls-open', 'image-selected');
            wrapper.removeAttribute('data-image-insert-token');
            wrapper.removeAttribute('contenteditable');
        });
        clone.querySelectorAll('[data-note-table="1"]').forEach(wrapper => {
            wrapper.removeAttribute('draggable');
            wrapper.removeAttribute('data-table-bound');
            wrapper.classList.remove(
                'controls-open',
                'note-table-dragging',
                'cell-selection-mode'
            );
            wrapper.setAttribute('contenteditable', 'false');

            wrapper.querySelectorAll(
                '.table-cell-selected, .table-cell-anchor, .table-active-cell'
            ).forEach(cell => cell.classList.remove(
                'table-cell-selected',
                'table-cell-anchor',
                'table-active-cell'
            ));

            wrapper.querySelectorAll('[data-table-caption="1"], .note-table-caption')
                .forEach(caption => caption.remove());

            wrapper.querySelectorAll('table, tbody, tr, th, td').forEach(element => {
                element.removeAttribute('contenteditable');
            });
        });
        // 清掉為了讓游標可停在圖片後方而加入的零寬字元。
        const textNodes = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
        while (textNodes.nextNode()) {const node=textNodes.currentNode;if(node.data.includes('\u200B'))node.data=node.data.replace(/\u200B/g, '');}
        Array.from(clone.querySelectorAll('span, font')).reverse().forEach(element => {
            if (!element.textContent && !element.children.length) element.remove();
        });
        return sanitizeNoteHtml(clone.innerHTML.trim());
    }


    let savedNoteFocusSession = 0;

    function findRenderedNoteElement(noteId) {
        if (!noteId) return null;
        return document.querySelector(
            `.note-item[data-id="${CSS.escape(String(noteId))}"]`
        );
    }

    function savedNoteStickyTopInset() {
        const topBar = document.querySelector('.top-bar');
        if (!topBar) return 12;

        const style = getComputedStyle(topBar);
        const rect = topBar.getBoundingClientRect();

        if (
            (style.position === 'sticky' || style.position === 'fixed') &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight
        ) {
            return Math.max(12, rect.bottom + 10);
        }

        return 12;
    }

    function centerSavedNoteImmediately(noteId) {
        const item = findRenderedNoteElement(noteId);
        if (!item) return null;

        const rect = item.getBoundingClientRect();
        const viewportHeight =
            window.innerHeight ||
            document.documentElement.clientHeight ||
            800;

        const topInset = savedNoteStickyTopInset();
        const bottomInset = noteBrowse.bottomInset();
        const availableHeight = Math.max(
            80,
            viewportHeight - topInset - bottomInset
        );

        /* 筆記比可視範圍高時，對齊到置頂工具列下方；
           一般筆記則置中於剩餘的閱讀區域。 */
        const desiredTop =
            rect.height >= availableHeight
                ? topInset
                : topInset + (availableHeight - rect.height) / 2;

        const rawTarget =
            window.scrollY + rect.top - desiredTop;

        const documentHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body.scrollHeight
        );
        const maxScroll = Math.max(
            0,
            documentHeight - viewportHeight
        );

        window.scrollTo({
            left: window.scrollX,
            top: Math.max(0, Math.min(rawTarget, maxScroll)),
            behavior: 'auto'
        });

        return item;
    }

    function flashSavedNote(item) {
        if (!item) return;

        item.classList.remove('history-flash');
        void item.offsetWidth;
        item.classList.add('history-flash');

        setTimeout(() => {
            item.classList.remove('history-flash');
        }, 1900);
    }

    function clearFiltersToRevealSavedNote() {
        clearRandomDraw(false);

        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';

        if (isStarFilterActive) {
            isStarFilterActive = false;
            const starButton = document.getElementById('btn-filter-star');

            if (starButton) {
                starButton.classList.remove('active');
                renderStarFilterControl();
            }
        }

        activeCategoryFilterId = null;
        updateCategoryUi();
        filterNotes();
    }

    function stabilizeSavedNotePosition(noteId, sessionId) {
        const list = document.getElementById('note-list');
        let item = centerSavedNoteImmediately(noteId);
        if (!item) return;

        flashSavedNote(item);

        const retryDelays = [60, 140, 260, 430, 700, 1050, 1450];
        const timers = [];
        let resizeObserver = null;
        let stopped = false;

        const correctPosition = () => {
            if (
                stopped ||
                sessionId !== savedNoteFocusSession
            ) {
                return;
            }

            item = centerSavedNoteImmediately(noteId) || item;
        };

        retryDelays.forEach(delay => {
            timers.push(setTimeout(correctPosition, delay));
        });

        /* renderNotes 會重新建立所有圖片節點。從頁面最上方跳到
           很後面的新筆記時，圖片解碼會持續改變整張清單高度。
           監聽清單與目標筆記尺寸，在版面變動時重新校正。 */
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(correctPosition);
            });

            if (list) resizeObserver.observe(list);
            resizeObserver.observe(item);
        }

        const stop = () => {
            if (stopped) return;
            stopped = true;
            timers.forEach(timer => clearTimeout(timer));
            resizeObserver?.disconnect();
        };

        /* 使用者主動滾動後不再拉回，避免妨礙手動閱讀。 */
        const stopOnUserScroll = () => stop();
        window.addEventListener('wheel', stopOnUserScroll, {
            once: true,
            passive: true
        });
        window.addEventListener('touchstart', stopOnUserScroll, {
            once: true,
            passive: true
        });

        setTimeout(() => {
            stop();
            window.removeEventListener('wheel', stopOnUserScroll);
            window.removeEventListener('touchstart', stopOnUserScroll);
        }, 1750);
    }

    function focusSavedNoteAfterSave(noteId) {
        if (!noteId) return;

        const sessionId = ++savedNoteFocusSession;

        const beginPositioning = () => {
            if (sessionId !== savedNoteFocusSession) return;

            noteBrowse.reveal(noteId);
            if (!findRenderedNoteElement(noteId)) {
                /* 若目前搜尋／分類／星號／隨機模式把它藏起來，
                   自動回到全部筆記，再重新等待清單完成繪製。 */
                clearFiltersToRevealSavedNote();
                noteBrowse.reveal(noteId);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        stabilizeSavedNotePosition(noteId, sessionId);
                    });
                });
                return;
            }

            stabilizeSavedNotePosition(noteId, sessionId);
        };

        /* 等編輯視窗關閉、瀏覽器焦點釋放，以及筆記清單重繪。 */
        requestAnimationFrame(() => {
            requestAnimationFrame(beginPositioning);
        });
    }

    function saveNote() { notePersistence.saveCurrent(); }

    function deleteNote(id) {
        if (previewModeBlocksEditing()) return;
        const note = resolveLinkedNote(id);
        if (note && confirm("要將這則筆記移到垃圾桶嗎？30 天內可還原。")) {
            noteRecovery.trash(note);
            addHistoryRecord('刪除', note, '已移到垃圾桶，可在 30 天內還原');
            notesData = notesData.filter(n => n.id !== note.id);
            filterNotes();
            autoSave();
        }
    }


