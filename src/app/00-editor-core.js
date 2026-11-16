/* Source: 00-editor-core.js */
const SCRIPT_URL = '';  // 舊 Apps Script 網址已不再使用（保留名稱供舊程式參照）。

    const NOTE_TOOLBAR_PATHS = {
        history: '<path d="M3 11a9 9 0 1 1 2.5 7"/><path d="M3 4v7h7"/><path d="M12 7v5l3 2"/>',
        category: '<path d="M3 3h7l10.4 10.4a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0L3 11V3Z"/><circle cx="7" cy="7" r="1"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
        edit: '<path d="m16 3 5 5-11 11-6 1 1-6L16 3Z"/><path d="m13 6 5 5M3 22h18"/>',
        move: '<path d="M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5"/>',
        add: '<path d="M12 5v14M5 12h14"/>',
        star: '<path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 3Z"/>',
        random: '<path d="M3 6h2c5 0 9 12 14 12h2M3 18h2c1.8 0 3.4-1.5 5-3.6M14 9.6c1.7-2.1 3.2-3.6 5-3.6h2"/><path d="m18 3 3 3-3 3M18 15l3 3-3 3"/>',
        cloud: '<path d="M6 18a4.5 4.5 0 0 1-.8-8.9 7 7 0 0 1 13.6 0A4.5 4.5 0 0 1 18 18H6Z"/>',
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'
    };
    function noteToolbarIcon(name, filled = false) {
        return `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${NOTE_TOOLBAR_PATHS[name] || ''}</svg>`;
    }
    function renderStarFilterControl() {
        const button = document.getElementById('btn-filter-star');
        if (!button) return;
        button.classList.toggle('active', isStarFilterActive);
        button.setAttribute('aria-pressed', String(isStarFilterActive));
        button.dataset.toolLabel = isStarFilterActive ? '顯示全部筆記' : '顯示星號';
        button.setAttribute('aria-label', button.dataset.toolLabel);
        button.innerHTML = noteToolbarIcon('star', isStarFilterActive);
    }
    function positionToolbarSyncDetails() {
        const panel = document.getElementById('sync-details'), button = document.getElementById('sync-status');
        if (!panel || panel.hidden || !button) return;
        const rect = button.getBoundingClientRect();
        panel.style.left = Math.max(8, Math.min(rect.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 8)) + 'px';
        panel.style.top = Math.max(8, Math.min(rect.bottom + 10, innerHeight - panel.offsetHeight - 8)) + 'px';
    }
    function initializeNoteToolbar() {
        const root = document.getElementById('note-toolbar'), tooltip = document.getElementById('note-toolbar-tooltip');
        if (!root || root.dataset.initialized) return;
        root.dataset.initialized = '1';
        renderStarFilterControl();
        let target = null;
        function hide() {
            target?.removeAttribute('aria-describedby');
            target = null; tooltip.hidden = true;
        }
        function show(button) {
            if (!button) return;
            if (target !== button) target?.removeAttribute('aria-describedby');
            target = button;
            const name = button.dataset.toolLabel || button.getAttribute('aria-label');
            let detail = '';
            if (button.disabled) detail = '請先返回編輯模式';
            else if (button.id === 'fab-history') detail = '今天編輯了 ' + (document.getElementById('today-history-count')?.textContent || '0') + ' 則筆記';
            else if (button.id === 'btn-category-overview') detail = '共 ' + (document.getElementById('category-count-badge')?.textContent || '0') + ' 個分類';
            else if (button.id === 'fab-add') detail = '滑鼠側鍵上：新增；編輯筆記時儲存';
            else if (button.id === 'sync-status') detail = (document.getElementById('status-text')?.textContent || '正在連接雲端') + '\n點擊查看同步詳情';
            tooltip.querySelector('strong').textContent = name;
            tooltip.querySelector('small').textContent = detail;
            tooltip.hidden = false;
            button.setAttribute('aria-describedby', tooltip.id);
            const rect = button.getBoundingClientRect();
            tooltip.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - tooltip.offsetWidth / 2, innerWidth - tooltip.offsetWidth - 8)) + 'px';
            let top = rect.bottom + 9;
            if (top + tooltip.offsetHeight > innerHeight - 8) top = rect.top - tooltip.offsetHeight - 9;
            tooltip.style.top = Math.max(8, top) + 'px';
        }
        root.addEventListener('pointerover', event => {
            if (event.pointerType === 'touch') return;
            const button = event.target.closest('button');
            if (button && root.contains(button)) show(button);
        });
        root.addEventListener('pointerout', event => { if (target && !target.contains(event.relatedTarget)) hide(); });
        root.addEventListener('focusin', event => show(event.target.closest('button')));
        root.addEventListener('focusout', hide);
        root.addEventListener('click', hide);
        new MutationObserver(() => { if (target) show(target); }).observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-tool-label','aria-pressed','disabled','data-sync-state']});
        document.addEventListener('pointerdown', event => {
            const panel = document.getElementById('sync-details');
            if (panel && !panel.hidden && !panel.contains(event.target) && !document.getElementById('sync-status').contains(event.target)) panel.hidden = true;
        }, true);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') { hide(); const panel = document.getElementById('sync-details'); if (panel) panel.hidden = true; }
        });
        window.addEventListener('scroll', () => { hide(); positionToolbarSyncDetails(); }, {passive:true});
        window.addEventListener('resize', () => { hide(); positionToolbarSyncDetails(); }, {passive:true});
    }


    let notesData = [];
    let currentPastedImages = [];
    let currentGalleryImageEdits = {};
    let editingNoteId = null; 
    let isStarFilterActive = false;
    let editHistory = [];
    let categoryDefinitions = [];
    let activeCategoryFilterId = null;
    let pendingCategoryIds = [];
    let categoryAssignTargetNoteId = null;
    let categoryAssignPendingIds = [];
    let categoryAssignEditingId = null;
    let savedEditorRange = null;
    let savedEditorSelectionBackward = false;
    let savedEditorFocusHost = null;
    let draggedInlineImage = null;
    let inlineDropMarker = null;
    let inlineDropRange = null;
    let inlineImagePointer = null;
    let inlineImageScrollFrame = null;
    let suppressInlineImageClickUntil = 0;
    let previewSortable = null;
    let suppressGalleryImageClickUntil = 0;
    let isPreviewMode = false;
    let previewToastTimer = null;

    let draggedNoteTable = null;
    let tableDropMarker = null;
    let tableSelectionState = {
        wrapper: null,
        anchorCell: null,
        focusCell: null,
        cells: [],
        dragging: false
    };

    let pendingNoteLinkRange = null;
    let selectedNoteLinkTargetId = null;
    let selectedNoteLinkOriginalText = '';

    let randomDrawState = { active:false, selectedIds:[], count:1, scope:'filtered' };

    const HISTORY_SYSTEM_ID = '__EDIT_HISTORY_V1__';
    const CATEGORY_SYSTEM_ID = '__NOTE_CATEGORIES_V1__';
    const PREVIEW_MODE_STORAGE_KEY = 'pharmacy-note-preview-mode-v1';
    const HISTORY_RETENTION_DAYS = 90;
    const HISTORY_MAX_RECORDS = 3000;



    let removedLegacyDrawingData = false;

    function stripLegacyImageDrawingMarkup(html = '') {
        const source = String(html || '');

        if (
            !source.includes('data-image-annotation') &&
            !source.includes('inline-annotation-overlay') &&
            !source.includes('annotation-badge')
        ) {
            return source;
        }

        const template = document.createElement('template');
        template.innerHTML = source;

        template.content
            .querySelectorAll(
                '.inline-annotation-overlay, .annotation-badge'
            )
            .forEach(element => element.remove());

        template.content
            .querySelectorAll('[data-image-annotation]')
            .forEach(element => {
                element.removeAttribute('data-image-annotation');
            });

        return template.innerHTML;
    }


    function normalizeLegacyImageSource(value) {
        if (!value) return '';

        if (typeof value === 'string') {
            const source = value.trim();
            return (
                source.startsWith('data:image/') ||
                source.startsWith('blob:') || source.startsWith('note-local-asset:') ||
                /^https?:\/\//i.test(source)
            ) ? source : '';
        }

        if (typeof value === 'object') {
            const candidates = [
                value.src,
                value.url,
                value.image,
                value.imageUrl,
                value.dataUrl,
                value.data,
                value.base64
            ];

            for (const candidate of candidates) {
                const normalized = normalizeLegacyImageSource(candidate);
                if (normalized) return normalized;
            }
        }

        return '';
    }

    function collectLegacyGalleryImages(note) {
        if (!note || typeof note !== 'object') return [];

        const result = [];
        const seen = new Set();

        const append = value => {
            if (Array.isArray(value)) {
                value.forEach(append);
                return;
            }

            const source = normalizeLegacyImageSource(value);
            if (!source || seen.has(source)) return;

            seen.add(source);
            result.push(source);
        };

        append(note.images);
        append(note.image);

        /* 相容更早期可能使用過的欄位名稱。 */
        append(note.galleryImages);
        append(note.pastedImages);
        append(note.uploadedImages);
        append(note.imageUrls);

        return result;
    }

    function getInlineImageLayoutClasses(element) {
        const classes = new Set([
            ...Array.from(element?.classList || []),
            ...Array.from(
                element?.querySelector?.('img')?.classList || []
            )
        ]);

        const size =
            [
                'image-size-xs',
                'image-size-sm',
                'image-size-md',
                'image-size-lg',
                'image-size-full'
            ].find(className => classes.has(className)) ||
            'image-size-md';

        const align =
            [
                'image-align-left',
                'image-align-inline',
                'image-align-center',
                'image-align-right'
            ].find(className => classes.has(className)) ||
            'image-align-inline';

        return `${size} ${align}`;
    }

    function replaceLegacyImageElement(element, sourceElement = element) {
        if (!element?.isConnected) return null;

        // 修復舊拖曳可能造成的圖片互相包覆；每張原圖都要保留。
        const allImages = sourceElement?.matches?.('img')
            ? [sourceElement]
            : Array.from(sourceElement?.querySelectorAll?.('img:not(.inline-annotation-overlay)') || []);
        if (allImages.length > 1) {
            const fragment = document.createDocumentFragment();
            let firstWrapper = null;
            for (const original of allImages) {
                const source = normalizeLegacyImageSource(original.currentSrc || original.getAttribute('src') || original.dataset.src);
                if (!source) continue;
                const layout = original.closest('.inline-note-image, [data-inline-image="1"], .note-image-frame, .annotated-image-stack') || element;
                const wrapper = createInlineImageElement(source, getInlineImageLayoutClasses(layout));
                if (layout.style?.cssText) wrapper.style.cssText = layout.style.cssText;
                const image = inlineImageNode(wrapper);
                if (original.style?.cssText) image.style.cssText = original.style.cssText;
                if (original.alt) image.alt = original.alt;
                if (original.hasAttribute('data-note-image-edit')) image.setAttribute('data-note-image-edit', original.getAttribute('data-note-image-edit'));
                fragment.appendChild(wrapper);
                firstWrapper ||= wrapper;
            }
            if (firstWrapper) element.replaceWith(fragment);
            return firstWrapper;
        }

        const image =
            sourceElement?.matches?.('img')
                ? sourceElement
                : sourceElement?.querySelector?.(
                    'img:not(.inline-annotation-overlay)'
                );

        const source = normalizeLegacyImageSource(
            image?.currentSrc ||
            image?.getAttribute?.('src') ||
            image?.dataset?.src
        );

        if (!source) return null;

        const wrapper = createInlineImageElement(
            source,
            getInlineImageLayoutClasses(element)
        );

        if (element.style?.cssText) {
            wrapper.style.cssText = element.style.cssText;
        }

        const newImage = inlineImageNode(wrapper);
        if (newImage && image?.style?.cssText) {
            newImage.style.cssText = image.style.cssText;
        }

        if (image?.alt) newImage.alt = image.alt;
        if (image?.hasAttribute('data-note-image-edit')) newImage.setAttribute('data-note-image-edit', image.getAttribute('data-note-image-edit'));
        element.replaceWith(wrapper);
        return wrapper;
    }

    function deriveTitleFromHtml(html='') { const temp=document.createElement('div'); temp.innerHTML=html; const lines=(temp.innerText||temp.textContent||'').split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean); return (lines[0]||'').slice(0,100); }
    function cleanNoteTitle(value='') { return String(value||'').replace(/\s+/g,' ').trim().slice(0,100); }
    function changeFontSize(step) {
        const bulkCells = getBulkFormatTableCells();

        if (bulkCells.length) {
            const currentSize = getFirstSelectedCellFontSize(bulkCells);
            const newSize = Math.max(1, Math.min(7, currentSize + step));
            applyCommandToTableCells(bulkCells, 'fontSize', String(newSize));
            return;
        }

        restoreEditorSelection();

        let currentSize = parseInt(document.queryCommandValue('fontSize'), 10);
        if (!Number.isFinite(currentSize) || currentSize < 1 || currentSize > 7) currentSize = 3;

        const newSize = Math.max(1, Math.min(7, currentSize + step));
        document.execCommand('fontSize', false, String(newSize));
        rememberEditorSelection();
    }

    function toggleUnorderedList() {
        applyEditorCommand('insertUnorderedList');
    }

    // --- 階層箭頭筆記 ---
    // 使用瀏覽器原生清單編輯，保留文字格式、選取範圍與復原／重做。
    function getArrowNoteContext() {
        const editor = document.getElementById('modal-text');
        const selection = window.getSelection();
        if (!selection?.rangeCount) return null;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return null;
        const host = getEditorFocusHostFromRange(range);
        let element = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer : range.startContainer.parentElement;
        // 點在空白項目、選取整段清單時，Range 可能位於 ul／外層 div。
        // 從該邊界找出真正的文字行，避免把同一箭頭判成一般段落。
        if (!element?.closest('li') && range.startContainer.nodeType === Node.ELEMENT_NODE) {
            let boundary = range.startContainer.childNodes[range.startOffset];
            while (boundary?.nodeType === Node.ELEMENT_NODE &&
                /^(DIV|UL|OL|LI)$/.test(boundary.tagName)) {
                if (boundary.tagName === 'LI') { element = boundary; break; }
                boundary = boundary.firstChild;
            }
        }
        const item = element?.closest('li');
        const list = item?.parentElement;
        const arrow = list?.closest('ul.note-arrow-list');
        return {
            editor, range, host, element,
            item: item && host.contains(item) ? item : null,
            list: list && host.contains(list) ? list : null,
            arrow: arrow && host.contains(arrow) ? arrow : null
        };
    }

    function markArrowNoteList(list) {
        if (list?.tagName !== 'UL') return;
        list.classList.add('note-arrow-list');
        // 行內樣式讓貼上、原生縮排及另存 HTML 時也能保留箭頭符號。
        list.style.listStyleType = '"↳  "';
    }

    function prepareArrowNoteLists() {
        const editor = document.getElementById('modal-text');
        editor.querySelectorAll('ul.note-arrow-list').forEach(list => {
            markArrowNoteList(list);
            list.querySelectorAll('ul').forEach(nested => {
                // 表格裡的清單是另一個編輯範圍，不連帶改動。
                if (nested.closest('td, th') === list.closest('td, th')) {
                    markArrowNoteList(nested);
                }
            });
        });
        tidyArrowNoteBranches();
        updateArrowNoteTools();
    }

    function arrowNoteOwnContent(item) {
        // 直接讀取節點，不為每次輸入複製整張圖片的資料。
        function hasContent(node) {
            for (const child of node.childNodes) {
                if (child.nodeType === Node.TEXT_NODE && child.data.replace(/[\s\u200B\uFEFF]/g, '')) return true;
                if (child.nodeType !== Node.ELEMENT_NODE) continue;
                if (child.matches('ul, ol, [data-selection-bookmark], .inline-image-controls')) continue;
                if (child.matches('img, table, hr, video, audio, [data-inline-image="1"]') || hasContent(child)) return true;
            }
            return false;
        }
        return hasContent(item);
    }

    function tidyArrowNoteBranches(scope = null) {
        const editor=document.getElementById('modal-text'),items=new Set();
        if(scope&&editor.contains(scope)){
            let node=scope.nodeType===Node.ELEMENT_NODE?scope:scope.parentElement;
            let item=node?.closest('li');
            if(!item&&node?.matches('ul,ol'))for(const child of node.children)if(child.matches('li'))items.add(child);
            while(item&&editor.contains(item)){items.add(item);if(item.previousElementSibling?.matches('li'))items.add(item.previousElementSibling);if(item.nextElementSibling?.matches('li'))items.add(item.nextElementSibling);item=item.parentElement?.closest('li');}
        }else editor.querySelectorAll('ul.note-arrow-list li').forEach(item=>items.add(item));
        items.forEach(item => {
            if(!item.closest('ul.note-arrow-list'))return;
            const childList = Array.from(item.children).some(child => /^(UL|OL)$/.test(child.tagName));
            const branch=childList&&!arrowNoteOwnContent(item);
            if(item.classList.contains('note-arrow-branch')!==branch)item.classList.toggle('note-arrow-branch',branch);
        });
    }

    function arrowNoteCaretAtStart(context) {
        if (!context.item || !context.range.collapsed) return false;
        const before = document.createRange();
        before.selectNodeContents(context.item);
        before.setEnd(context.range.startContainer, context.range.startOffset);
        const content = document.createElement('div');
        content.append(before.cloneContents());
        return !content.textContent.replace(/[\u200B\uFEFF]/g, '') &&
            !content.querySelector('br, img, table, hr, [data-inline-image="1"]');
    }

    let arrowNoteEditInProgress = false;

    function cancelArrowNoteLine() {
        let context = getArrowNoteContext();
        if (!context?.arrow) return false;
        arrowNoteEditInProgress = true;
        try {
            // 一次取消到一般段落；子清單與其他行的內容都交由原生復原紀錄保留。
            // 只執行一次 outdent 會讓內層項目變成外層箭頭，看起來像刪了又新增。
            const limit = context.host.querySelectorAll('ul, ol').length + 1;
            for (let step = 0; step < limit && context?.arrow; step++) {
                const before = context.host.innerHTML;
                document.execCommand('outdent', false, null);
                context = getArrowNoteContext();
                if (!context || context.host.innerHTML === before) break;
            }
            // 取消後固定成獨立段落，下一個 Enter 不會重新進入旁邊的清單。
            if (context && !context.list) {
                document.execCommand('formatBlock', false, 'div');
            }
        } finally {
            arrowNoteEditInProgress = false;
        }
        tidyArrowNoteBranches();
        rememberEditorSelection();
        updateArrowNoteTools();
        return true;
    }

    function handleArrowNoteBeforeInput(event) {
        if (event.defaultPrevented || event.isComposing || arrowNoteEditInProgress ||
            getSelectedTableCells().length > 1) return;
        const context = getArrowNoteContext();
        if (!context?.arrow || !context.item || !context.range.collapsed) return;
        const empty = !arrowNoteOwnContent(context.item);
        const type = event.inputType;
        if ((type === 'deleteContentBackward' && (empty || arrowNoteCaretAtStart(context))) ||
            (type === 'deleteContentForward' && empty)) {
            event.preventDefault();
            cancelArrowNoteLine();
        } else if (type === 'insertParagraph' && empty) {
            event.preventDefault();
            // 空白箭頭 Enter：內層退一層，最外層回到一般文字。
            const parentList = context.list.parentElement?.closest('ul, ol');
            if (parentList && context.host.contains(parentList)) {
                rememberEditorSelection();
                changeArrowNoteIndent(-1);
            } else {
                cancelArrowNoteLine();
            }
        }
    }

    function arrowNoteBlockHasContent(context) {
        let block = context.item || context.element;
        while (block && block !== context.host &&
            !/^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE)$/.test(block.tagName)) {
            block = block.parentElement;
        }
        return arrowNoteOwnContent(block || context.host);
    }

    function convertSelectionToArrowNotes() {
        let context = getArrowNoteContext();
        if (!context) return;
        const previousLists = new Set(context.host.querySelectorAll('ul'));
        // 已有一般項目清單時直接換符號，不觸發原生「取消清單」。
        if (!document.queryCommandState('insertUnorderedList')) {
            document.execCommand('insertUnorderedList', false, null);
        }
        context = getArrowNoteContext();
        if (!context) return;
        const newLists = Array.from(context.host.querySelectorAll('ul'))
            .filter(list => !previousLists.has(list));
        newLists.forEach(markArrowNoteList);
        // 空白編輯器建立清單後，Chromium 有時仍把游標留在外層 div。
        // 明確放進新項目，才能立即按 Tab，並顯示正確的箭頭狀態。
        if (context.range.collapsed && !context.item && newLists.length) {
            const item = newLists[0].querySelector('li');
            if (item) {
                const caret = document.createRange();
                caret.selectNodeContents(item);
                caret.collapse(true);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(caret);
                context = getArrowNoteContext();
            }
        }
        markArrowNoteList(context.list);
        if (!context.range.collapsed) {
            context.host.querySelectorAll('ul').forEach(list => {
                if (context.range.intersectsNode(list) &&
                    list.closest('td, th') === context.element.closest('td, th')) {
                    markArrowNoteList(list);
                }
            });
        }
        prepareArrowNoteLists();
        rememberEditorSelection();
    }

    function addArrowNoteLine() {
        const bulkCells = getBulkFormatTableCells();
        if (bulkCells.length) {
            bulkCells.forEach(cell => {
                selectCellContents(cell);
                convertSelectionToArrowNotes();
            });
            return;
        }
        restoreEditorSelection();
        const context = getArrowNoteContext();
        if (!context) return;

        if (context.arrow) {
            cancelArrowNoteLine();
            return;
        }

        // 直接轉換游標所在行／選取範圍，保留原生清單的內容與復原紀錄。
        // Enter 與 Tab／Shift+Tab 仍由原有處理器負責，不在此自動換行或縮排。
        convertSelectionToArrowNotes();
    }

    function changeArrowNoteIndent(direction) {
        restoreEditorSelection();
        if (!getArrowNoteContext()?.arrow) return false;
        document.execCommand(direction > 0 ? 'indent' : 'outdent', false, null);
        markArrowNoteList(getArrowNoteContext()?.list);
        prepareArrowNoteLists();
        rememberEditorSelection();
        return true;
    }

    function updateArrowNoteTools() {
        const context = getArrowNoteContext();
        const active = Boolean(context?.arrow);
        const button = document.getElementById('arrow-note-add');
        if (button && button.getAttribute('aria-pressed') !== String(active)) {
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        }
        ['arrow-note-indent', 'arrow-note-outdent'].forEach(id => {
            const control = document.getElementById(id);
            if (control && control.disabled === active) control.disabled = !active;
        });
    }

    function handleArrowNoteKeydown(event) {
        // 中文選字的 Enter／Tab 必須交還輸入法。
        if (event.isComposing || event.keyCode === 229) return false;
        const code = event.code || event.key;
        if (event.altKey && !event.ctrlKey && !event.metaKey &&
            !event.shiftKey && (code === 'KeyA' || code === 'a')) {
            event.preventDefault();
            event.stopPropagation();
            rememberEditorSelection();
            addArrowNoteLine();
            return true;
        }
        if (code === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey &&
            getArrowNoteContext()?.arrow) {
            event.preventDefault();
            event.stopPropagation();
            rememberEditorSelection();
            changeArrowNoteIndent(event.shiftKey ? -1 : 1);
            return true;
        }
        return false;
    }

    document.addEventListener('selectionchange', updateArrowNoteTools);
    document.getElementById('modal-text').addEventListener('beforeinput', handleArrowNoteBeforeInput);
    document.getElementById('modal-text').addEventListener('input', event => {
        // 一般輸入只更新附近的分支；復原、貼上及其他結構操作仍檢查全部分支。
        const selection=window.getSelection(),local=/^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward)$/.test(event.inputType);
        tidyArrowNoteBranches(local&&selection?.rangeCount?selection.getRangeAt(0).startContainer:null);
        updateArrowNoteTools();
    });


    let editorSelectionRevision = 0;
    let applyingTableCellColor = false;
    const editorColorMemoryManagement = {textColor: false, bgColor: false};
    const EDITOR_COLOR_MEMORY_KEY = 'pharmacy-note-editor-color-memory-v1';
    const EDITOR_COLOR_MEMORY_LIMIT = 6;
    let editorColorMemory = {
        textColor: ['#ef4444'],
        bgColor: ['#fef08a']
    };

    function normalizeHexColorValue(value, fallback) {
        const color = String(value || '').trim().toLowerCase();
        return /^#[0-9a-f]{6}$/.test(color) ? color : fallback;
    }

    function loadEditorColorMemory() {
        try {
            const stored = JSON.parse(localStorage.getItem(EDITOR_COLOR_MEMORY_KEY) || '{}');
            ['textColor', 'bgColor'].forEach(pickerId => {
                const fallback = pickerId === 'textColor' ? '#ef4444' : '#fef08a';
                const colors = Array.isArray(stored[pickerId]) ? stored[pickerId] : [];
                const normalized = colors
                    .map(color => normalizeHexColorValue(color, ''))
                    .filter(Boolean)
                    .filter((color, index, arr) => arr.indexOf(color) === index)
                    .slice(0, EDITOR_COLOR_MEMORY_LIMIT);
                editorColorMemory[pickerId] = Array.isArray(stored?.[pickerId]) ? normalized : [fallback];
            });
        } catch (error) {
            editorColorMemory = {
                textColor: ['#ef4444'],
                bgColor: ['#fef08a']
            };
        }
    }

    function saveEditorColorMemory() {
        try {
            localStorage.setItem(EDITOR_COLOR_MEMORY_KEY, JSON.stringify(editorColorMemory));
        } catch (error) {
            // 瀏覽器禁止 localStorage 時，仍可在本次開啟期間使用。
        }
    }

    function updateEditorColorIcon(pickerId) {
        const picker = document.getElementById(pickerId);
        const icon = document.getElementById(pickerId === 'textColor' ? 'text-color-icon' : 'bg-color-icon');
        if (picker && icon) icon.style.color = picker.value;
    }

    function rememberEditorColor(pickerId, rawColor) {
        const fallback = pickerId === 'textColor' ? '#ef4444' : '#fef08a';
        const color = normalizeHexColorValue(rawColor, fallback);
        const existing = Array.isArray(editorColorMemory[pickerId]) ? editorColorMemory[pickerId] : [];

        editorColorMemory[pickerId] = [color, ...existing.filter(item => item !== color)]
            .slice(0, EDITOR_COLOR_MEMORY_LIMIT);

        saveEditorColorMemory();
        renderEditorColorMemory(pickerId);
        return color;
    }

    function endEditorColorMemoryManagement() {
        for (const pickerId of ['textColor', 'bgColor']) {
            if (!editorColorMemoryManagement[pickerId]) continue;
            editorColorMemoryManagement[pickerId] = false;
            renderEditorColorMemory(pickerId);
        }
    }

    function removeRememberedEditorColor(pickerId, color) {
        // 只修改色票偏好，不對筆記或目前選取範圍執行上色命令。
        finishEditorColorChord();
        const colors = (editorColorMemory[pickerId] || []).filter(item => item !== color);
        editorColorMemory[pickerId] = colors;
        const picker = document.getElementById(pickerId);
        if (picker.value.toLowerCase() === color && colors.length) {
            picker.value = colors[0];
            updateEditorColorIcon(pickerId);
        }
        saveEditorColorMemory();
        renderEditorColorMemory(pickerId);
    }

    function renderEditorColorMemory(pickerId) {
        const containerId = pickerId === 'textColor' ? 'text-color-memory' : 'bg-color-memory';
        const container = document.getElementById(containerId);
        const picker = document.getElementById(pickerId);
        if (!container || !picker) return;

        const editing = editorColorMemoryManagement[pickerId];
        const colors = editorColorMemory[pickerId] || [];
        const label = pickerId === 'textColor' ? '文字' : '螢光筆';
        container.replaceChildren();
        container.classList.toggle('color-memory-removing', editing);
        container.setAttribute('role', 'group');
        container.setAttribute('aria-label', label + '記憶色票' + (editing ? '，點色票刪除' : ''));

        colors.forEach((color, index) => {
            const swatch = document.createElement('button');
            swatch.type = 'button';
            swatch.dataset.color = color;
            swatch.className = 'color-memory-swatch' + (color === picker.value.toLowerCase() ? ' active' : '');
            swatch.style.backgroundColor = color;
            swatch.title = editing ? `刪除記憶顏色 ${color}` : `${color}｜按一下直接套用；長按 ${pickerId === 'textColor' ? 'Alt+F' : 'Alt+H'} 開色盤，按住 Alt 再點同一鍵換色`;
            swatch.setAttribute('aria-label', (editing ? '刪除記憶顏色 ' : '套用顏色 ') + color);
            swatch.addEventListener('mousedown', event => event.preventDefault());
            swatch.addEventListener('click', () => {
                if (!editorColorMemoryManagement[pickerId]) {
                    applyRememberedEditorColor(pickerId, color);
                    return;
                }
                const restoreFocus = document.activeElement === swatch;
                removeRememberedEditorColor(pickerId, color);
                if (restoreFocus) {
                    const next = container.querySelectorAll('.color-memory-swatch')[Math.min(index, colors.length - 2)]
                        || container.querySelector('.color-memory-manage');
                    next?.focus({preventScroll: true});
                }
            });
            container.appendChild(swatch);
        });

        if (!colors.length) {
            const empty = document.createElement('span');
            empty.className = 'color-memory-empty';
            empty.textContent = '無記憶色';
            container.appendChild(empty);
        }
        const manage = document.createElement('button');
        manage.type = 'button';
        manage.className = 'color-memory-manage';
        manage.textContent = editing ? '完成' : '管理';
        manage.disabled = !colors.length && !editing;
        manage.title = editing ? '結束刪除色票（Esc）' : '管理記憶色：點開後可刪除不常用的顏色';
        manage.setAttribute('aria-label', (editing ? '完成管理' : '管理') + label + '記憶色');
        manage.setAttribute('aria-pressed', String(editing));
        manage.addEventListener('mousedown', event => event.preventDefault());
        manage.addEventListener('click', () => {
            const restoreFocus = document.activeElement === manage;
            finishEditorColorChord();
            endEditorColorMemoryManagement();
            editorColorMemoryManagement[pickerId] = !editing;
            renderEditorColorMemory(pickerId);
            if (restoreFocus) container.querySelector('.color-memory-manage').focus({preventScroll: true});
        });
        container.appendChild(manage);
    }

    function initializeEditorColorMemoryManagement() {
        document.addEventListener('pointerdown', event => {
            for (const pickerId of ['textColor', 'bgColor']) {
                const row = document.getElementById(pickerId === 'textColor' ? 'text-color-memory' : 'bg-color-memory');
                if (!editorColorMemoryManagement[pickerId] || row.contains(event.target)) continue;
                editorColorMemoryManagement[pickerId] = false;
                renderEditorColorMemory(pickerId);
            }
        }, true);
        document.addEventListener('keydown', event => {
            if (event.code !== 'Escape' || !Object.values(editorColorMemoryManagement).some(Boolean)) return;
            event.preventDefault();
            event.stopPropagation();
            endEditorColorMemoryManagement();
        }, true);
        document.getElementById('modal-text').addEventListener('focusin', endEditorColorMemoryManagement);
    }


    function applyRememberedEditorColor(pickerId, color) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;

        picker.value = normalizeHexColorValue(color, picker.value);
        updateEditorColorIcon(pickerId);
        rememberEditorColor(pickerId, picker.value);
        toggleFormatColor(pickerId === 'textColor' ? 'foreColor' : 'backColor', pickerId);
    }

    function handleEditorColorPickerInput(pickerId) {
        updateEditorColorIcon(pickerId);
        renderEditorColorMemory(pickerId);
    }

    function handleEditorColorPickerChange(pickerId) {
        const picker = document.getElementById(pickerId);
        if (!picker) return;
        rememberEditorColor(pickerId, picker.value);
        updateEditorColorIcon(pickerId);
    }

    function initializeEditorColorMemory() {
        loadEditorColorMemory();
        initializeEditorColorMemoryManagement();

        ['textColor', 'bgColor'].forEach(pickerId => {
            const picker = document.getElementById(pickerId);
            if (!picker) return;

            const lastColor = editorColorMemory[pickerId]?.[0];
            if (lastColor) picker.value = lastColor;

            picker.addEventListener('input', () => handleEditorColorPickerInput(pickerId));
            picker.addEventListener('change', () => handleEditorColorPickerChange(pickerId));

            updateEditorColorIcon(pickerId);
            renderEditorColorMemory(pickerId);
        });
    }

    function normalizeCssColor(color) {
        const probe = document.createElement('span');
        probe.style.color = color;
        probe.style.position = 'fixed';
        probe.style.opacity = '0';
        document.body.appendChild(probe);
        const normalized = getComputedStyle(probe).color;
        probe.remove();
        return normalized;
    }


    function getEditorFocusHostFromRange(range) {
        const editor = document.getElementById('modal-text');
        if (!range) return editor;

        const node = range.commonAncestorContainer;
        const element = node?.nodeType === Node.ELEMENT_NODE
            ? node
            : node?.parentElement;

        const nestedHost = element?.closest?.(
            '#modal-text th[contenteditable="true"], ' +
            '#modal-text td[contenteditable="true"], ' +
            '#modal-text [data-table-caption="1"][contenteditable="true"], ' +
            '#modal-text [contenteditable="true"]'
        );

        return nestedHost || editor;
    }

    function focusEditorHostForRange(range) {
        const editor = document.getElementById('modal-text');
        let host = savedEditorFocusHost;

        if (
            !host ||
            !host.isConnected ||
            !editor.contains(host)
        ) {
            host = getEditorFocusHostFromRange(range);
        }

        try {
            host.focus({ preventScroll: true });
        } catch (error) {
            host.focus();
        }

        savedEditorFocusHost = host;
        return host;
    }

    function rememberEditorSelection() {
        const editor = document.getElementById('modal-text');
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return;

        savedEditorRange = range.cloneRange();
        savedEditorSelectionBackward = !range.collapsed && sel.anchorNode === range.endContainer && sel.anchorOffset === range.endOffset;
        savedEditorFocusHost = getEditorFocusHostFromRange(range);
    }

    function restoreEditorSelection() {
        const editor = document.getElementById('modal-text');
        const sel = window.getSelection();

        let range = savedEditorRange;
        if (
            !range ||
            !editor.contains(range.commonAncestorContainer)
        ) {
            range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            savedEditorFocusHost = editor;
        }

        focusEditorHostForRange(range);
        sel.removeAllRanges();
        sel.addRange(range.cloneRange());
        if (savedEditorSelectionBackward && !range.collapsed && sel.setBaseAndExtent) sel.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
    }

    function selectedTextNodes(range) {
        const editor = document.getElementById('modal-text');
        const root = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentNode
            : range.commonAncestorContainer;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!editor.contains(node) || !(node.nodeValue || '').trim()) return NodeFilter.FILTER_REJECT;
                // Range.intersectsNode 會把「剛好碰到邊界、但實際選到 0 個字」也算進來；先排除這兩種情況。
                if (node === range.startContainer && range.startOffset >= node.nodeValue.length) return NodeFilter.FILTER_REJECT;
                if (node === range.endContainer && range.endOffset <= 0) return NodeFilter.FILTER_REJECT;
                try { return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
                catch { return NodeFilter.FILTER_REJECT; }
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE && (range.commonAncestorContainer.nodeValue || '').trim()) {
            return [range.commonAncestorContainer];
        }
        return nodes;
    }

    function effectiveBackgroundColor(element, editor) {
        let node = element;
        while (node && node !== editor) {
            const value = getComputedStyle(node).backgroundColor;
            if (value && value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)') return value;
            node = node.parentElement;
        }
        return 'rgba(0, 0, 0, 0)';
    }

    function selectionHasColor(range, command, targetColor) {
        if (range.collapsed) return false;
        const editor = document.getElementById('modal-text');
        const nodes = selectedTextNodes(range);
        if (!nodes.length) return false;
        const normalizedTarget = normalizeCssColor(targetColor);
        return nodes.every(node => {
            const parent = node.parentElement || editor;
            const actual = command === 'foreColor'
                ? getComputedStyle(parent).color
                : effectiveBackgroundColor(parent, editor);
            return actual === normalizedTarget;
        });
    }

    function unwrapElement(element) {
        const parent = element.parentNode;
        if (!parent) return;
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        element.remove();
    }

    function removeSpecificFormatFromSelection(kind) {
        const editor = document.getElementById('modal-text');
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return;

        const fragment = range.extractContents();
        const all = Array.from(fragment.querySelectorAll('*'));
        all.forEach(el => {
            if (el.matches('[data-inline-image="1"], .inline-image-controls') || el.closest('[data-inline-image="1"]')) return;
            if (kind === 'color') {
                el.style.removeProperty('color');
                if (el.tagName === 'FONT') el.removeAttribute('color');
            } else {
                el.style.removeProperty('background');
                el.style.removeProperty('background-color');
            }
            if (el.getAttribute('style') === '') el.removeAttribute('style');
        });
        if (kind === 'color') {
            Array.from(fragment.querySelectorAll('font:not([style]):not([class])')).forEach(unwrapElement);
        } else {
            Array.from(fragment.querySelectorAll('mark:not([style]):not([class])')).forEach(unwrapElement);
        }

        const insertedNodes = Array.from(fragment.childNodes);
        range.insertNode(fragment);
        const newRange = document.createRange();
        if (insertedNodes.length) {
            newRange.setStartBefore(insertedNodes[0]);
            newRange.setEndAfter(insertedNodes[insertedNodes.length - 1]);
        } else {
            newRange.setStart(range.startContainer, range.startOffset);
            newRange.collapse(true);
        }
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedEditorRange = newRange.cloneRange();
    }


    // 只記錄選取位置，不向文件插入隱藏節點，讓瀏覽器原生復原保持完整。
    function editorSelectionUnits(editor) {
        const walker=document.createTreeWalker(editor,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{
            acceptNode(node) {
                if(node.nodeType===Node.ELEMENT_NODE) {
                    if(node.matches('.inline-image-controls,.note-table-controls,.inline-drop-marker,.table-drop-marker,[data-selection-bookmark]'))return NodeFilter.FILTER_REJECT;
                    return node.matches('img,br,hr')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;
                }
                return node.nodeValue.length?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
            }
        });
        const units=[];while(walker.nextNode()){const node=walker.currentNode;units.push({node,length:node.nodeType===Node.TEXT_NODE?node.nodeValue.length:1});}return units;
    }
    function editorBoundaryOffset(editor,units,container,offset) {
        const point=document.createRange();point.setStart(container,offset);point.collapse(true);
        let total=0;
        for(const unit of units) {
            if(unit.node===container&&container.nodeType===Node.TEXT_NODE)return total+offset;
            const text=unit.node.nodeType===Node.TEXT_NODE,parent=unit.node.parentNode;
            const endNode=text?unit.node:parent,endOffset=text?unit.length:Array.prototype.indexOf.call(parent.childNodes,unit.node)+1;
            if(point.comparePoint(endNode,endOffset)<=0)total+=unit.length;else return total;
        }
        return total;
    }
    function editorBoundaryAt(editor,units,offset,isEnd) {
        let count=0;
        for(let i=0;i<units.length;i++) {
            const {node,length}=units[i],next=count+length;
            if(offset<next || (isEnd&&offset===next) || i===units.length-1) {
                const part=Math.max(0,Math.min(length,offset-count));
                if(node.nodeType===Node.TEXT_NODE)return {node,offset:part};
                return {node:node.parentNode,offset:Array.prototype.indexOf.call(node.parentNode.childNodes,node)+(part>0?1:0)};
            }
            count=next;
        }
        return {node:editor,offset:0};
    }
    function createEditorSelectionBookmark(editor,sourceRange=null) {
        const selection=window.getSelection(),range=sourceRange|| (selection?.rangeCount?selection.getRangeAt(0):null);
        if(!range||range.collapsed||!editor.contains(range.commonAncestorContainer))return null;
        const units=editorSelectionUnits(editor);
        return {
            editor,
            start:editorBoundaryOffset(editor,units,range.startContainer,range.startOffset),
            end:editorBoundaryOffset(editor,units,range.endContainer,range.endOffset),
            backward:selection.anchorNode===range.endContainer&&selection.anchorOffset===range.endOffset,
            focusHost:getEditorFocusHostFromRange(range),
            noteId:editingNoteId
        };
    }
    function removeEditorSelectionBookmark(bookmark,restoreSelection=true) {
        if(!bookmark||!restoreSelection)return false;
        const revision=++editorSelectionRevision;
        function restore() {
            const {editor}=bookmark,units=editorSelectionUnits(editor);
            const start=editorBoundaryAt(editor,units,bookmark.start,false),end=editorBoundaryAt(editor,units,bookmark.end,true);
            const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);
            savedEditorFocusHost=bookmark.focusHost?.isConnected&&editor.contains(bookmark.focusHost)?bookmark.focusHost:getEditorFocusHostFromRange(range);
            focusEditorHostForRange(range);
            const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
            if(bookmark.backward&&selection.setBaseAndExtent)selection.setBaseAndExtent(end.node,end.offset,start.node,start.offset);
            savedEditorRange=range.cloneRange();savedEditorSelectionBackward=bookmark.backward;
        }
        restore();
        requestAnimationFrame(()=>{
            if(revision===editorSelectionRevision&&document.getElementById('noteModal')?.classList.contains('active')&&editingNoteId===bookmark.noteId)restore();
        });
        return true;
    }


    function selectionTextOffsets(editor, range) {
        const before = range.cloneRange();
        before.selectNodeContents(editor);
        before.setEnd(range.startContainer, range.startOffset);
        const start = before.toString().length;
        return { start, end: start + range.toString().length };
    }

    function restoreSelectionByTextOffsets(editor, start, end) {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let node;
        let count = 0;
        let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
        while ((node = walker.nextNode())) {
            if (node.parentElement?.closest('.inline-image-controls')) continue;
            const next = count + node.nodeValue.length;
            if (!startNode && start >= count && start <= next) {
                startNode = node;
                startOffset = start - count;
            }
            if (!endNode && end >= count && end <= next) {
                endNode = node;
                endOffset = end - count;
                break;
            }
            count = next;
        }
        if (!startNode) return false;
        if (!endNode) { endNode = startNode; endOffset = startOffset; }
        const range = document.createRange();
        range.setStart(startNode, Math.min(startOffset, startNode.nodeValue.length));
        range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue.length));
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        savedEditorRange = range.cloneRange();
        return true;
    }

    function cleanupEmptyFormattingElements(editor) {
        editor.querySelectorAll('span, font, mark, b, strong, i, em, u, s, strike').forEach(el => {
            if (el.closest('[data-inline-image="1"]')) return;
            const hasMeaningfulContent = (el.textContent || '').replace(/\u200B/g, '').length > 0 || el.querySelector('img, br');
            if (!hasMeaningfulContent) el.remove();
        });
    }

    function toggleFormatColor(command, pickerId, {forceApply = false, remember = true} = {}) {
        const editor = document.getElementById('modal-text');
        const pickerColor = document.getElementById(pickerId).value;
        const color = remember ? rememberEditorColor(pickerId, pickerColor) : normalizeHexColorValue(pickerColor, pickerId === 'textColor' ? '#ef4444' : '#fef08a');
        updateEditorColorIcon(pickerId);

        const bulkCells = getBulkFormatTableCells();
        const supportsHighlight = document.queryCommandSupported('hiliteColor');

        if (bulkCells.length) {
            const allSameColor = !forceApply && bulkCells.every(cell => {
                const range = document.createRange();
                range.selectNodeContents(cell);
                return selectionHasColor(range, command, color);
            });

            const priorColorOperation = applyingTableCellColor;
            applyingTableCellColor = true;
            try {
                bulkCells.forEach(cell => {
                    selectCellContents(cell);
    
                    if (allSameColor) {
                        if (command === 'foreColor') {
                            document.execCommand(
                                'foreColor',
                                false,
                                getComputedStyle(editor).color || '#333333'
                            );
                        } else {
                            document.execCommand(
                                supportsHighlight ? 'hiliteColor' : 'backColor',
                                false,
                                'transparent'
                            );
                        }
                    } else {
                        document.execCommand(
                            command === 'backColor' && supportsHighlight
                                ? 'hiliteColor'
                                : command,
                            false,
                            color
                        );
                    }
                });
            } finally {
                applyingTableCellColor = priorColorOperation;
            }

            tableSelectionState.cells.forEach(cell =>
                cell.classList.add('table-cell-selected')
            );
            tableSelectionState.anchorCell?.classList.add('table-cell-anchor');
            tableSelectionState.focusCell?.classList.add('table-active-cell');
            return;
        }

        restoreEditorSelection();

        const selection = window.getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (
            range.collapsed ||
            !editor.contains(range.commonAncestorContainer)
        ) {
            return;
        }

        // 記錄文字與圖片的選取位置，不插入會破壞原生復原的隱藏節點。
        const isSameColor = !forceApply && selectionHasColor(range, command, color);
        const bookmark = createEditorSelectionBookmark(editor, range);
        if (!bookmark) return;

        try {
            if (isSameColor) {
                if (command === 'foreColor') {
                    document.execCommand(
                        'foreColor',
                        false,
                        getComputedStyle(editor).color || '#333333'
                    );
                } else {
                    document.execCommand(
                        supportsHighlight ? 'hiliteColor' : 'backColor',
                        false,
                        'transparent'
                    );
                }
            } else {
                document.execCommand(
                    command === 'backColor' && supportsHighlight
                        ? 'hiliteColor'
                        : command,
                    false,
                    color
                );
            }
        } finally {
            // 依文字與圖片的邏輯位置還原原本選取範圍。
            removeEditorSelectionBookmark(bookmark, true);
            rememberEditorSelection();
        }
    }

    // Tap to toggle; hold to open a palette, then tap the same key while keeping Alt down.
    let editorColorChord=null,editorColorAltUsed=false;
    const EDITOR_COLOR_HOLD_MS=100;
    function hasEditorColorTarget(){
        if(getBulkFormatTableCells().length)return true;
        const selection=getSelection(),editor=document.getElementById('modal-text');
        return !!(selection?.rangeCount&&!selection.isCollapsed&&editor.contains(selection.getRangeAt(0).commonAncestorContainer));
    }
    function editorColorScrollSnapshot(){
        const positions=[],editor=document.getElementById('modal-text');
        let node=getEditorFocusHostFromRange(savedEditorRange)||editor;
        while(node){if(node.scrollHeight>node.clientHeight||node.scrollWidth>node.clientWidth)positions.push([node,node.scrollLeft,node.scrollTop]);node=node.parentElement;}
        return()=>positions.forEach(([element,x,y])=>{element.scrollLeft=x;element.scrollTop=y;});
    }
    function validEditorColorChord(chord){
        const editor=document.getElementById('modal-text');
        return chord&&editingNoteId===chord.noteId&&!document.hidden&&!noteImageEditor.isOpen()
            &&document.getElementById('noteModal').classList.contains('active')
            &&(document.activeElement===editor||editor.contains(document.activeElement));
    }
    function applyEditorChordColor(chord,forceApply){
        if(!validEditorColorChord(chord))return false;
        const target=hasEditorColorTarget(),restoreScroll=editorColorScrollSnapshot();
        toggleFormatColor(chord.command,chord.pickerId,{forceApply,remember:false});
        chord.used=chord.used||target;renderEditorColorMemory(chord.pickerId);restoreScroll();return true;
    }
    function finishEditorColorChord(options={}){
        const chord=editorColorChord;editorColorChord=null;
        if(chord)clearTimeout(chord.timer);
        const hint=document.getElementById('editor-color-cycle-hint');if(hint)hint.hidden=true;
        if(!chord)return;
        if(options.applyTap&&chord.phase==='pending')applyEditorChordColor(chord,false);
        const color=document.getElementById(chord.pickerId).value;
        // Deleting a remembered color must not silently recreate it via a pending shortcut.
        if(chord.used&&chord.remembered.includes(color))rememberEditorColor(chord.pickerId,color);
    }
    function showEditorColorCycleHint(chord){
        const hint=document.getElementById('editor-color-cycle-hint');if(!hint)return;
        const key=chord.code==='KeyF'?'F':'H',label=chord.pickerId==='textColor'?'文字色':'螢光筆';
        hint.querySelector('strong').textContent=label;
        hint.querySelector('.color-cycle-arrows').textContent='Alt + '+key+' 換色';
        const swatches=hint.querySelector('.color-cycle-swatches');swatches.replaceChildren();
        chord.palette.forEach((color,index)=>{const swatch=document.createElement('span');swatch.style.backgroundColor=color;swatch.className='color-cycle-swatch'+(index===chord.index?' current':'');swatches.appendChild(swatch);});
        hint.dataset.color=chord.palette[chord.index];
        hint.setAttribute('aria-label',label+' '+chord.palette[chord.index]+'，第 '+(chord.index+1)+'／'+chord.palette.length+' 色；按住 Alt 再按 '+key+' 換色，放開 Alt 完成');
        hint.hidden=false;
        const selection=getSelection(),rect=selection?.rangeCount?selection.getRangeAt(0).getBoundingClientRect():document.getElementById('modal-text').getBoundingClientRect();
        hint.style.left=Math.max(8,Math.min(rect.left,innerWidth-hint.offsetWidth-8))+'px';
        let top=rect.bottom+9;if(top+hint.offsetHeight>innerHeight-8)top=rect.top-hint.offsetHeight-9;
        hint.style.top=Math.max(8,Math.min(top,innerHeight-hint.offsetHeight-8))+'px';
    }
    function openEditorColorPalette(chord,step=0){
        if(editorColorChord!==chord||!validEditorColorChord(chord)){finishEditorColorChord();return;}
        clearTimeout(chord.timer);chord.phase='palette';
        const n=chord.palette.length;
        chord.index=chord.index<0?(step<0?n-1:0):(chord.index+step+n)%n;
        document.getElementById(chord.pickerId).value=chord.palette[chord.index];
        applyEditorChordColor(chord,true);showEditorColorCycleHint(chord);
    }
    function cycleEditorChordColor(chord,step=1){
        if(chord.phase==='pending'){openEditorColorPalette(chord,step);return;}
        chord.index=(chord.index+step+chord.palette.length)%chord.palette.length;
        document.getElementById(chord.pickerId).value=chord.palette[chord.index];
        applyEditorChordColor(chord,true);showEditorColorCycleHint(chord);
    }
    function handleEditorColorShortcut(event){
        const code=event.code||'',chord=editorColorChord;
        if(!event.altKey||event.ctrlKey||event.metaKey||event.isComposing||event.keyCode===229||event.getModifierState?.('AltGraph')){
            if(chord)finishEditorColorChord();return false;
        }
        if(code==='KeyF'||code==='KeyH'){
            event.preventDefault();event.stopPropagation();editorColorAltUsed=true;
            if(event.repeat)return true;
            if(chord?.code===code){chord.keyDown=true;if(chord.phase==='palette')cycleEditorChordColor(chord);return true;}
            finishEditorColorChord();rememberEditorSelection();
            const pickerId=code==='KeyF'?'textColor':'bgColor',color=normalizeHexColorValue(document.getElementById(pickerId).value,pickerId==='textColor'?'#ef4444':'#fef08a');
            const remembered=[...new Set((editorColorMemory[pickerId]||[]).map(value=>normalizeHexColorValue(value,'')).filter(Boolean))];
            const palette=remembered.length?[...remembered]:[color];
            const next=editorColorChord={code,pickerId,command:code==='KeyF'?'foreColor':'backColor',palette,remembered,index:palette.indexOf(color),used:false,keyDown:true,phase:'pending',noteId:editingNoteId,timer:0};
            next.timer=setTimeout(()=>{if(editorColorChord===next&&next.keyDown)openEditorColorPalette(next);},EDITOR_COLOR_HOLD_MS);
            return true;
        }
        // Keep the previous arrow-key gesture available as an optional way to cycle.
        if(chord&&(code==='ArrowLeft'||code==='ArrowRight')){
            event.preventDefault();event.stopPropagation();cycleEditorChordColor(chord,code==='ArrowRight'?1:-1);return true;
        }
        if(chord&&!['AltLeft','AltRight','ShiftLeft','ShiftRight'].includes(code))finishEditorColorChord();
        return false;
    }
    function initializeEditorColorShortcuts(){
        if(document.getElementById('editor-color-cycle-hint'))return;
        document.body.insertAdjacentHTML('beforeend','<div id="editor-color-cycle-hint" role="status" aria-live="polite" hidden><strong></strong><span class="color-cycle-swatches" aria-hidden="true"></span><span class="color-cycle-arrows" aria-hidden="true"></span></div>');
        window.addEventListener('keyup',event=>{
            const chord=editorColorChord,altRelease=event.code==='AltLeft'||event.code==='AltRight';
            if(altRelease&&editorColorAltUsed){event.preventDefault();editorColorAltUsed=false;}
            if(!chord)return;
            if(altRelease||!event.altKey){finishEditorColorChord({applyTap:chord.phase==='pending'});return;}
            if(event.code===chord.code){event.preventDefault();chord.keyDown=false;if(chord.phase==='pending')finishEditorColorChord({applyTap:true});}
        },true);
        const interrupt=()=>{editorColorAltUsed=false;finishEditorColorChord();};
        window.addEventListener('blur',interrupt);window.addEventListener('pagehide',interrupt);
        document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
        document.addEventListener('pointerdown',()=>{editorSelectionRevision++;finishEditorColorChord();},true);
        const editor=document.getElementById('modal-text');
        editor.addEventListener('input',()=>{editorSelectionRevision++;});
        editor.addEventListener('compositionstart',interrupt);
        editor.addEventListener('focusout',event=>{if(!editor.contains(event.relatedTarget))finishEditorColorChord();});
    }


    function initializeDismissibleNotePanels() {
        const panels=[['categoryOverviewModal',closeCategoryOverviewModal,'btn-category-overview'],['moveModal',closeMoveModal,'fab-sort-move'],['randomDrawModal',closeRandomDrawModal,'btn-random-draw']];
        panels.forEach(([id,close,triggerId])=>{
            const overlay=document.getElementById(id);let startedOnBackdrop=false,endedOnBackdrop=false;
            overlay.addEventListener('pointerdown',event=>{startedOnBackdrop=event.target===overlay&&event.button===0;});
            overlay.addEventListener('pointerup',event=>{endedOnBackdrop=event.target===overlay;});
            overlay.addEventListener('pointercancel',()=>{startedOnBackdrop=endedOnBackdrop=false;});
            overlay.addEventListener('click',event=>{
                const shouldClose=startedOnBackdrop&&endedOnBackdrop&&event.target===overlay;startedOnBackdrop=endedOnBackdrop=false;
                if(shouldClose){close();document.getElementById(triggerId)?.focus({preventScroll:true});}
            });
        });
    }


    function clearFormatting() {
        const bulkCells = getBulkFormatTableCells();

        if (bulkCells.length) {
            applyCommandToTableCells(bulkCells, 'removeFormat');
            return;
        }

        restoreEditorSelection();

        const editor = document.getElementById('modal-text');
        const selection = window.getSelection();

        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (
            range.collapsed ||
            !editor.contains(range.commonAncestorContainer)
        ) {
            return;
        }

        const bookmark = createEditorSelectionBookmark(editor, range);
        if (!bookmark) return;

        try {
            document.execCommand('removeFormat', false, null);
        } finally {
            removeEditorSelectionBookmark(bookmark, true);
            rememberEditorSelection();
        }
    }

    // --- 編輯器快捷鍵監聽 ---
    // 使用 e.code 判斷實體鍵位，不受中文輸入法或鍵盤配置影響。
    document.getElementById('modal-text').addEventListener('keydown', function(e) {
        const code = e.code || '';
        const key = String(e.key || '').toLowerCase();

        if (e.isComposing || e.keyCode === 229) return;
        editorSelectionRevision++;
        if (handleEditorColorShortcut(e)) return;
        if (handleInlineImageKeydown(e)) return;
        if (handleArrowNoteKeydown(e)) return;

        if ((code === 'Delete' || code === 'Backspace') &&
            getSelectedTableCells().length > 1) {
            e.preventDefault();
            clearSelectedTableCellContents();
            return;
        }

        if (code === 'Tab') {
            const tableCell = e.target.closest?.('[data-note-table="1"] th, [data-note-table="1"] td');
            if (tableCell && handleTableCellTab(e, tableCell)) return;
            return;
        }

        // 左手單手快捷鍵
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            if (code === 'KeyC') {
                e.preventDefault();
                e.stopPropagation();
                clearFormatting();
                return;
            }
            if (code === 'KeyW') {
                e.preventDefault();
                e.stopPropagation();
                changeFontSize(1);
                return;
            }
            if (code === 'KeyS') {
                e.preventDefault();
                e.stopPropagation();
                changeFontSize(-1);
                return;
            }
            if (code === 'KeyV') {
                e.preventDefault();
                e.stopPropagation();
                toggleUnorderedList();
                return;
            }
        }

        if (e.ctrlKey && !e.metaKey) {
            if (code === 'KeyB') {
                e.preventDefault();
                applyEditorCommand('bold');
                return;
            }
            if (code === 'KeyI') {
                e.preventDefault();
                applyEditorCommand('italic');
                return;
            }
            if (code === 'KeyU') {
                e.preventDefault();
                applyEditorCommand('underline');
                return;
            }
            if (code === 'Backslash' || key === '\\') {
                e.preventDefault();
                clearFormatting();
                return;
            }

        }
    });

    ['keyup', 'mouseup', 'input', 'focus'].forEach(type => {
        document.getElementById('modal-text').addEventListener(type, rememberEditorSelection);
    });


