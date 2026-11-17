/* Built from src/app by tools/build.mjs. Edit the files in src/app, not this file. */
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
    const DRAW_LOG_SYSTEM_ID = '__NOTE_DRAW_LOG_V1__';   // 抽取記錄 (random draw log)
    let drawLog = [];
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


/* Source: 05-content-safety.js */
/* Typing pause: heavy background work (cloud read-back, re-processing notes) waits until
   the writer has not typed for a moment, so keystrokes are never held up. Saving to this
   device still happens immediately; only the cloud confirmation is delayed. */
let noteLastTypingAt = 0;
document.addEventListener('keydown', event => {if (event.target?.closest?.('#noteModal')) noteLastTypingAt = performance.now();}, true);
document.addEventListener('input', event => {if (event.target?.closest?.('#noteModal')) noteLastTypingAt = performance.now();}, true);
function noteTypingIdle(quiet = 1200, maxWait = 15000) {
    const start = performance.now();
    const typing = () => document.getElementById('noteModal')?.classList.contains('active') && performance.now() - noteLastTypingAt < quiet;
    if (!typing()) return Promise.resolve();
    return new Promise(resolve => {
        const check = () => (!typing() || performance.now() - start > maxWait) ? resolve() : setTimeout(check, 150);
        setTimeout(check, 150);
    });
}

/* Waits until an <img> has loaded. Used instead of noteImageReady(image), which can hang
   forever for off-screen images in some browsers (seen in the Claude desktop browser). */
function noteImageReady(image, ms = 20000) {
    if (image.complete && image.naturalWidth) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const clear = () => {clearTimeout(timer); image.removeEventListener('load', done); image.removeEventListener('error', fail);};
        const done = () => {clear(); resolve();};
        const fail = () => {clear(); reject(new Error('圖片無法讀取'));};
        const timer = setTimeout(() => {clear(); image.naturalWidth ? resolve() : reject(new Error('圖片讀取逾時'));}, ms);
        image.addEventListener('load', done); image.addEventListener('error', fail);
    });
}
/* Shared boundary for note HTML, pasted content and imported image URLs. */
const NOTE_RECOVERY_ID = '__NOTE_RECOVERY_V1__';
const noteSafeContent = (() => {
    const tags = new Set('a b strong i em u s strike sub sup font p div span br hr h1 h2 h3 h4 h5 h6 ol ul li table thead tbody tfoot tr th td colgroup col caption blockquote pre code mark details summary img'.split(' '));
    const discard = new Set('script style iframe object embed link meta base template svg math form input button select textarea audio video source canvas'.split(' '));
    const attributes = new Set('class title dir lang align color face size width height colspan rowspan span start reversed type scope valign border cellpadding cellspacing alt loading decoding role aria-label'.split(' '));
    const dataAttributes = new Set('data-inline-image data-note-image-edit data-note-table data-note-link data-note-arrow-list data-note-arrow-item data-arrow-note data-arrow-list data-arrow-item'.split(' '));
    const styles = new Set('color background-color font font-family font-size font-weight font-style text-decoration text-decoration-line text-decoration-color text-align text-indent line-height letter-spacing word-spacing white-space overflow-wrap word-break vertical-align width height min-width min-height max-width max-height margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left border border-top border-right border-bottom border-left border-width border-style border-color border-collapse border-spacing border-radius table-layout list-style-type list-style-position display float clear object-fit'.split(' '));
    const cache = new Map();let cacheSize=0;
    function url(value, image = false) {
        const source = String(value || '').trim();
        if (!source || /[\u0000-\u0020\u007f]/.test(source.slice(0, 32))) return '';
        if (image && /^note-local-asset:[a-zA-Z0-9-]+$/.test(source)) return source;
        if (image && /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif|x-icon|svg\+xml)[;,]/i.test(source)) return source;
        if (!image && source.startsWith('#')) return source;
        try {
            const parsed = new URL(source);
            if (['http:', 'https:'].includes(parsed.protocol) || !image && ['mailto:', 'tel:'].includes(parsed.protocol)) return source;
            if (image && parsed.protocol === 'blob:' && parsed.origin === location.origin) return source;
        } catch (_) { /* Relative and executable URLs are not note assets. */ }
        return '';
    }
    function html(value = '') {
        const source = String(value || '');
        if (cache.has(source)) {const result=cache.get(source);cache.delete(source);cache.set(source,result);return result;}
        const template = document.createElement('template');
        template.innerHTML = source;
        for (const element of [...template.content.querySelectorAll('*')]) {
            const tag = element.localName.toLowerCase();
            if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml' || discard.has(tag)) { element.remove(); continue; }
            if (!tags.has(tag)) { element.replaceWith(...element.childNodes); continue; }
            for (const attribute of [...element.attributes]) {
                const name = attribute.name.toLowerCase();
                if (name === 'style') {
                    for (const property of [...element.style]) {
                        const text = element.style.getPropertyValue(property);
                        if (!styles.has(property) || /url\s*\(|expression\s*\(|var\s*\(|[\\@]/i.test(text)) element.style.removeProperty(property);
                        else element.style.setProperty(property, text, '');
                    }
                    if (!element.style.length) element.removeAttribute('style');
                } else if (name === 'href' && tag === 'a' || name === 'src' && tag === 'img') {
                    const safe = url(attribute.value, tag === 'img');
                    if (safe) element.setAttribute(name, safe); else element.removeAttribute(name);
                } else if (name === 'contenteditable' && attribute.value === 'false' && (element.hasAttribute('data-inline-image') || element.hasAttribute('data-note-table'))) {
                    // Atomic editor blocks retain their browser selection behavior.
                } else if (!(attributes.has(name) || dataAttributes.has(name))) {
                    element.removeAttribute(attribute.name);
                }
            }
            if (tag === 'a') {
                element.setAttribute('rel', 'noopener noreferrer');
                if (/^https?:/i.test(element.getAttribute('href')||'')) element.setAttribute('target','_blank');
            }
        }
        const result = template.innerHTML;
        if(source.length<2*1024*1024){cache.set(source,result);cacheSize+=source.length+result.length;while(cache.size>8000||cacheSize>48*1024*1024){const key=cache.keys().next().value;cacheSize-=key.length+cache.get(key).length;cache.delete(key);}}
        return result;
    }
    function note(record) {
        const next = {...record, text: html(record.text)};
        for (const name of ['images', 'galleryImages', 'pastedImages', 'uploadedImages', 'imageUrls']) {
            if (Array.isArray(next[name])) next[name] = next[name].map(value => url(value, true)).filter(Boolean);
        }
        if (next.image) next.image = url(next.image, true);
        return next;
    }
    return {html, url, note};
})();

function sanitizeNoteHtml(value) { return noteSafeContent.html(value); }
function inlineJsArgument(value) { return escapeAttribute(JSON.stringify(String(value))); }

function normalizeSearchText(value = '') {
    return String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function notePlainText(html = '') {
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('script,style,template').forEach(node => node.remove());
    template.content.querySelectorAll('br,hr').forEach(node => node.replaceWith(' '));
    template.content.querySelectorAll('p,div,li,tr,td,th,blockquote,h1,h2,h3,h4,h5,h6').forEach(node => node.append(' '));
    return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

/* Source: 06-clipboard-content.js */
/* Clipboard HTML is a selection plus source-page layout, not a saved note.
   Use the clipboard's selected text for spacing and HTML for inline formatting. */
const noteClipboardContent=(()=>{
    const inlineTags=new Set('a b strong i em u s strike sub sup font mark code'.split(' '));
    const textStyles='color background-color font-family font-size font-weight font-style font-variant text-decoration text-decoration-line text-decoration-color vertical-align'.split(' ');
    const blockTags=new Set('p div h1 h2 h3 h4 h5 h6 blockquote li td th caption section article header footer'.split(' '));
    const structures='table,ol,ul,img,pre,hr,[data-note-table],[data-inline-image]';
    const hiddenSelector='[hidden],[aria-hidden="true"],[data-selection-bookmark],.inline-image-controls,.inline-drop-marker,.inline-annotation-overlay,.annotation-badge,.note-table-controls,.table-drop-marker';
    const asciiSpace=/[\t\n\r\f ]+/g;
    function selectedHtml(raw){
        const doc=new DOMParser().parseFromString(String(raw||''),'text/html'),walker=doc.createTreeWalker(doc,NodeFilter.SHOW_COMMENT);let start=null,end=null,node;
        while(node=walker.nextNode()){if(/^\s*StartFragment\s*$/i.test(node.data))start=node;else if(start&&/^\s*EndFragment\s*$/i.test(node.data)){end=node;break;}}
        let root=doc.body;
        if(start&&end&&(start.compareDocumentPosition(end)&Node.DOCUMENT_POSITION_FOLLOWING)){
            const range=doc.createRange();range.setStartAfter(start);range.setEndBefore(end);let fragment=range.cloneContents(),parent=range.commonAncestorContainer;
            if(parent.nodeType!==Node.ELEMENT_NODE)parent=parent.parentElement;
            const cell=start.parentElement?.closest('td,th'),singleCell=cell&&end.parentElement?.closest('td,th')===cell;
            while(parent&&parent!==doc.body&&parent!==doc.documentElement){const wrapper=singleCell&&parent===cell?doc.createElement('span'):parent.cloneNode(false);if(singleCell&&parent===cell)for(const a of parent.attributes)wrapper.setAttribute(a.name,a.value);wrapper.append(fragment);fragment=wrapper;if(singleCell&&parent===cell)break;parent=parent.parentElement;}
            root=doc.createElement('div');root.append(fragment);
        }
        root.querySelectorAll(hiddenSelector).forEach(n=>n.remove());
        for(const element of root.querySelectorAll('[style]'))if(element.style.display==='none'||element.style.visibility==='hidden')element.remove();
        return root.innerHTML;
    }
    function formatChain(text,root){
        const chain=[];
        for(let parent=text.parentElement;parent&&parent!==root;parent=parent.parentElement){
            const tag=parent.localName,semantic=inlineTags.has(tag),copy=document.createElement(semantic?tag:'span');
            if(semantic)for(const a of parent.attributes)if(a.name!=='style'&&a.name!=='class')copy.setAttribute(a.name,a.value);
            if(parent.classList.contains('note-internal-link'))copy.className='note-internal-link';
            for(const name of ['dir','lang'])if(parent.hasAttribute(name))copy.setAttribute(name,parent.getAttribute(name));
            if(/^h[1-6]$/.test(tag)){copy.style.fontWeight='bold';copy.style.fontSize=[2,1.5,1.17,1,.83,.67][Number(tag[1])-1]+'em';}
            for(const key of textStyles){const v=parent.style.getPropertyValue(key);if(v)copy.style.setProperty(key,v);}
            if(semantic||copy.attributes.length)chain.unshift(copy);
        }
        return chain;
    }
    function addText(root,value){const lines=value.split('\n');for(let i=0;i<lines.length;i++){if(i)root.append(document.createElement('br'));if(lines[i])root.append(document.createTextNode(lines[i]));}}
    function selectedTextMarkup(root,plain){
        if(root.querySelector(structures)||root.textContent.replace(/\s/g,'')!==plain.replace(/\s/g,''))return null;
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
        while(node=walker.nextNode())if(/\S/.test(node.data))nodes.push(node);
        if(!nodes.length){const output=document.createElement('div');addText(output,plain);return output.innerHTML;}
        const positions=[];for(let i=0;i<plain.length;i++)if(/\S/.test(plain[i]))positions.push(i);
        const runs=[];let used=0,cursor=0;
        for(const source of nodes){
            used+=source.data.replace(/\s/g,'').length;const end=positions[used-1]+1,chain=formatChain(source,root),key=chain.map(n=>n.outerHTML).join('|'),value=plain.slice(cursor,end);cursor=end;
            if(runs.at(-1)?.key===key)runs.at(-1).value+=value;else runs.push({key,chain,value});
        }
        runs.at(-1).value+=plain.slice(cursor);
        const output=document.createElement('div');
        for(const run of runs){let target=output;for(const prototype of run.chain){const next=prototype.cloneNode(false);target.append(next);target=next;}addText(target,run.value);}
        return output.innerHTML;
    }
    function compactStructures(root,plain=null){
        const preformatted=new WeakSet();
        for(const node of root.querySelectorAll('*'))if(['pre','code'].includes(node.localName)||/^pre/.test(node.style.whiteSpace))preformatted.add(node);
        // A rectangular TSV selection identifies actual spaces inside table cells.
        const tables=root.querySelectorAll('table');
        if(typeof plain==='string'&&tables.length===1){
            const rows=[...tables[0].rows],lines=plain.split('\n');if(lines.at(-1)===''&&lines.length===rows.length+1)lines.pop();const cells=lines.map(line=>line.split('\t'));
            if(rows.length===cells.length&&rows.every((row,i)=>row.cells.length===cells[i].length&&[...row.cells].every(c=>c.colSpan===1&&c.rowSpan===1)))for(let i=0;i<rows.length;i++)for(let j=0;j<rows[i].cells.length;j++){const cell=rows[i].cells[j],exact=selectedTextMarkup(cell,cells[i][j]);if(exact!==null){cell.innerHTML=exact;preformatted.add(cell);}}
        }
        const keepSpace=node=>{for(let p=node.parentElement;p&&p!==root;p=p.parentElement)if(preformatted.has(p))return true;return false;};
        const atomic=node=>!!node.closest('img,table,[data-inline-image],[data-note-table]');
        for(const node of root.querySelectorAll('*')){
            if(atomic(node))continue;
            for(const key of [...node.style]){if(key==='white-space'&&preformatted.has(node))continue;if(/^(?:margin|padding)(?:-|$)/.test(key)||['width','height','min-width','min-height','max-width','max-height','text-indent','letter-spacing','word-spacing','line-height','white-space','float','clear'].includes(key))node.style.removeProperty(key);}
            if(node.localName==='p'){node.style.marginTop='0';node.style.marginBottom='0';}
        }
        const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
        while(node=walker.nextNode())if(!keepSpace(node))node.data=node.data.replace(asciiSpace,' ');
        for(const block of [root,...root.querySelectorAll([...blockTags].join(','))]){
            const leaves=[],walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let n;
            while(n=walker.nextNode())if(!keepSpace(n))leaves.push(n);
            if(leaves.length){leaves[0].data=leaves[0].data.replace(/^[\t\r\n\f ]+/,'');leaves.at(-1).data=leaves.at(-1).data.replace(/[\t\r\n\f ]+$/,'');}
        }
        const comments=[],commentWalker=document.createTreeWalker(root,NodeFilter.SHOW_COMMENT);while(node=commentWalker.nextNode())comments.push(node);comments.forEach(n=>n.remove());
        return root.innerHTML;
    }
    function html(value,plain=null){
        const root=document.createElement('div');root.innerHTML=sanitizeNoteHtml(selectedHtml(value));
        if(typeof plain==='string'){plain=plain.replace(/\r\n?/g,'\n');const exact=selectedTextMarkup(root,plain);if(exact!==null)return exact;}
        return compactStructures(root,plain);
    }
    function text(value){const root=document.createElement('div');addText(root,String(value||'').replace(/\r\n?/g,'\n'));return root.innerHTML;}
    return {html,text};
})();

/* Source: 07-actions.js */
/* Buttons in the HTML name the function they run instead of carrying inline JavaScript:
 *   <button data-on-click="deleteNote" data-args='["123"]' data-stop>
 * Each element gets its own listener (not one shared page listener), so stopPropagation
 * and preventDefault behave exactly as the old inline onclick="..." did.
 *   data-on-<click|mousedown|input|change|keydown>  function name(s), space separated
 *   data-args   JSON array; "$event" is replaced by the event
 *   data-stop   event.stopPropagation()   data-prevent   event.preventDefault()
 *   data-key    only for this key (keydown) */
const noteActions = (() => {
    'use strict';
    const EVENTS = ['click', 'mousedown', 'input', 'change', 'keydown'];
    const bound = new WeakMap(), cache = new Map();
    const resolve = name => {
        if (!cache.has(name)) {
            // Function() runs in global scope, so it also finds top-level const/let objects.
            let fn = null, owner = null;
            try {
                const path = name.split('.');
                owner = path.length > 1 ? Function('return ' + path.slice(0, -1).join('.'))() : null;
                fn = path.length > 1 ? owner?.[path.at(-1)] : Function('return typeof ' + name + "==='function'?" + name + ':null')();
            } catch (_) {fn = null;}
            cache.set(name, fn ? {fn, owner} : null);
        }
        return cache.get(name);
    };
    function run(element, type, event) {
        const names = element.getAttribute('data-on-' + type);
        if (!names) return;
        const key = element.dataset.key;
        if (key && event.key !== key) return;
        if (element.hasAttribute('data-prevent')) event.preventDefault();
        if (element.hasAttribute('data-stop')) event.stopPropagation();
        let args = [];
        if (element.dataset.args) {
            try {args = JSON.parse(element.dataset.args).map(a => a === '$event' ? event : a);}
            catch (_) {console.error('動作參數格式不正確：', element.dataset.args); return;}
        }
        for (const name of names.trim().split(/\s+/)) {
            const target = resolve(name);
            if (!target) {console.error('找不到動作：', name); continue;}
            target.fn.apply(target.owner, args);
        }
    }
    function bind(element) {
        let done = bound.get(element);
        for (const type of EVENTS) {
            if (!element.hasAttribute('data-on-' + type) || done?.has(type)) continue;
            element.addEventListener(type, event => run(element, type, event));
            if (!done) {done = new Set(); bound.set(element, done);}
            done.add(type);
        }
    }
    const selector = EVENTS.map(type => '[data-on-' + type + ']').join(',');
    function scan(root) {
        if (root.nodeType !== 1) return;
        if (root.matches(selector)) bind(root);
        root.querySelectorAll(selector).forEach(bind);
    }
    scan(document.body);
    new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') bind(record.target);
            else record.addedNodes.forEach(scan);
        }
    }).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: EVENTS.map(type => 'data-on-' + type)});
    return {scan};
})();
/* Source: 10-notes-and-filters.js */
    function setSyncStatus(status, message = '') {
        const dot = document.getElementById('status-dot'), label = document.getElementById('status-text');
        dot.className = 'status-dot dot-' + (status === 'success' ? 'success' : status === 'error' ? 'error' : 'syncing');
        label.textContent = message || (status === 'success' ? '同步完成' : status === 'error' ? '同步失敗' : '同步中…');
        label.style.color = status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#555';
        const control = document.getElementById('sync-status');
        control.dataset.syncState = status;
        control.setAttribute('aria-label', '雲端同步：' + label.textContent);
    }

    function normalizeLoadedData(data) {
        const previousNotes = new Map(notesData.map(note => [String(note.id), note]));
        let rawNotes = [];
        if (Array.isArray(data)) rawNotes = data;
        else if (data && Array.isArray(data.notes)) rawNotes = data.notes;

        noteRecovery.load(rawNotes.filter(isRecoveryCarrier));
        const historyCarrier = rawNotes.find(item => item && (item.id === HISTORY_SYSTEM_ID || item._type === 'system-history'));
        const categoryCarrier = rawNotes.find(item => item && (item.id === CATEGORY_SYSTEM_ID || item._type === 'system-categories'));
        const drawLogCarrier = rawNotes.find(item => item && item.id === DRAW_LOG_SYSTEM_ID);
        drawLog = noteDrawLog.normalize(drawLogCarrier?.records);
        editHistory = Array.isArray(historyCarrier?.records) ? historyCarrier.records : (Array.isArray(data?.editHistory) ? data.editHistory : []);
        const rawCategoryDefinitions = Array.isArray(categoryCarrier?.records)
            ? categoryCarrier.records
            : (Array.isArray(data?.categories) ? data.categories : []);
        categoryDefinitions = rawCategoryDefinitions
            .filter(item => item && item.id && item.name)
            .map(item => {
                const name = String(item.name).trim().slice(0, 30);
                return {
                    id: String(item.id),
                    name,
                    abbr: normalizeCategoryAbbr(item.abbr ?? item.shortLabel ?? item.shortName ?? '', name),
                    color: normalizeCategoryColor(item.color)
                };
            });

        notesData = rawNotes
            .filter(item => item && !isRecoveryCarrier(item) && item.id !== HISTORY_SYSTEM_ID && item._type !== 'system-history' && item.id !== CATEGORY_SYSTEM_ID && item._type !== 'system-categories' && item.id !== DRAW_LOG_SYSTEM_ID)
            .map(note => noteSafeContent.note(note));
        notesData.forEach(note => {
            note.title = cleanNoteTitle(note.title || '');

            if (Object.prototype.hasOwnProperty.call(note, 'imageAnnotations')) {
                delete note.imageAnnotations;
                removedLegacyDrawingData = true;
            }

            const cleanedText = sanitizeNoteHtml(stripLegacyImageDrawingMarkup(note.text || ''));
            if (cleanedText !== (note.text || '')) {
                note.text = cleanedText;
                removedLegacyDrawingData = true;
            }
        });

        // 相容未來或舊版可能使用的 categories 欄位；分類名稱也會自動建立成正式分類。
        notesData.forEach(note => {
            const rawIds = Array.isArray(note.categoryIds) ? note.categoryIds : (Array.isArray(note.categories) ? note.categories : []);
            note.categoryIds = rawIds.map(value => {
                const raw = String(value);
                const byId = categoryDefinitions.find(category => category.id === raw);
                if (byId) return byId.id;
                const byName = categoryDefinitions.find(category => category.name === raw);
                if (byName) return byName.id;
                if (!raw.trim()) return null;
                const created = createCategoryDefinition(raw.trim(), nextCategoryColor(), false);
                return created?.id || null;
            }).filter((id, index, arr) => id && arr.indexOf(id) === index);
            delete note.categories;
        });
        // Keep the same object for notes whose content did not change, so the save
        // step can reuse its earlier work instead of re-processing every note.
        notesData = notesData.map(note => {
            const previous = previousNotes.get(String(note.id));
            return previous && previous !== note && JSON.stringify(previous) === JSON.stringify(note) ? previous : note;
        });
        pruneHistory();
    }

    window.noteDriveStart = async function () {
        for (const initialize of [initializeNoteToolbar, initializeEditorColorMemory, initializeEditorColorShortcuts, initializeDismissibleNotePanels, initializePreviewMode, setupUpperSideMouseAddShortcut, setupLowerSideMouseBackShortcut, setupNoteListInteractions, setupImageImport, setupInlineImageEditor, setupNoteTableEditor, setupPreviewSorting]) {
            try { initialize(); } catch (error) { console.error('編輯功能初始化未完成：', error.name); }
        }
        noteBrowse.initialize();
        noteSearchNavigation.initialize();
        noteRecovery.initialize();
        initializeDriveWorkspace();
        noteInstantEditor.initialize();
        noteFloatingKeyboard.initialize();
        noteGalleryConverter.initialize();
        noteLinkedImages.initialize();
        noteAppearance.initialize();
        noteDrawLog.refreshEntry();
        noteImageSearch.start();
        await notePersistence.start();
    };

    let autoSaveTimer = null;
    let autoSaveInFlight = false;
    let autoSaveQueued = false;

    function buildSavePayload() {
        pruneHistory();

        return [
            ...notesData,
            ...noteRecovery.carriers(),
            {
                id: HISTORY_SYSTEM_ID,
                _type: 'system-history',
                records: editHistory
            },
            {
                id: CATEGORY_SYSTEM_ID,
                _type: 'system-categories',
                records: categoryDefinitions
            },
            {
                id: DRAW_LOG_SYSTEM_ID,
                _type: 'system-draw-log',
                records: noteDrawLog.prune(drawLog)
            }
        ];
    }

    function autoSave(delay = null) { notePersistence.queueSave(delay); }
    function flushAutoSave() { return notePersistence.flush(); }

    function readPreviewModePreference() {
        try {
            return localStorage.getItem(PREVIEW_MODE_STORAGE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function savePreviewModePreference() {
        try {
            localStorage.setItem(
                PREVIEW_MODE_STORAGE_KEY,
                isPreviewMode ? '1' : '0'
            );
        } catch (error) {}
    }

    function showPreviewModeToast(message) {
        const toast = document.getElementById('preview-mode-toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('active');

        if (previewToastTimer) clearTimeout(previewToastTimer);
        previewToastTimer = setTimeout(() => {
            toast.classList.remove('active');
        }, 1600);
    }

    function resetEditingFiltersForPreview() {
        clearRandomDraw(false);

        if (isStarFilterActive) {
            isStarFilterActive = false;
            const button = document.getElementById('btn-filter-star');
            if (button) {
                button.classList.remove('active');
                renderStarFilterControl();
            }
        }

        /* 不清除 activeCategoryFilterId：
           預覽模式必須保留並允許分類標籤篩選。 */
        updateCategoryUi();
    }

    function updatePreviewModeUi(options = {}) {
        const showToast = !!options.showToast;

        document.body.classList.toggle('preview-mode', isPreviewMode);

        const previewButton =
            document.getElementById('fab-preview-toggle');
        const previewIcon =
            document.getElementById('fab-preview-icon');

        previewButton?.classList.toggle(
            'preview-active',
            isPreviewMode
        );
        previewButton?.setAttribute(
            'aria-pressed',
            String(isPreviewMode)
        );

        if (previewIcon) previewIcon.innerHTML = noteToolbarIcon(isPreviewMode ? 'edit' : 'eye');
        const previewLabel = isPreviewMode ? '返回編輯模式' : '預覽模式';
        if (previewButton) {
            previewButton.dataset.toolLabel = previewLabel;
            previewButton.setAttribute('aria-label', previewLabel);
        }
        for (const id of ['fab-history', 'btn-category-overview', 'fab-sort-move', 'fab-add', 'btn-filter-star', 'btn-random-draw']) {
            const button = document.getElementById(id);
            if (button) button.disabled = isPreviewMode;
        }

        if (showToast) {
            showPreviewModeToast(
                isPreviewMode
                    ? '已進入預覽模式：可搜尋及點分類標籤篩選'
                    : '已返回編輯模式'
            );
        }
    }

    function initializePreviewMode() {
        isPreviewMode = readPreviewModePreference();

        if (isPreviewMode) {
            resetEditingFiltersForPreview();
        }

        updatePreviewModeUi();
    }


    function capturePreviewViewportAnchor() {
        const viewportX = Math.max(
            10,
            Math.min(window.innerWidth - 10, window.innerWidth * 0.5)
        );
        const viewportY = Math.max(
            10,
            Math.min(window.innerHeight - 10, window.innerHeight * 0.45)
        );

        const anchorNote = document
            .elementsFromPoint(viewportX, viewportY)
            .map(element => element.closest?.('.note-item[data-id]'))
            .find(Boolean);

        return {
            noteId: anchorNote?.dataset?.id || null,
            noteTop: anchorNote?.getBoundingClientRect().top ?? null,
            scrollX: window.scrollX,
            scrollY: window.scrollY
        };
    }

    function restorePreviewViewportAnchor(anchor) {
        if (!anchor) return;
        if (anchor.noteId) noteBrowse.reveal(anchor.noteId);

        const restore = () => {
            if (anchor.noteId && Number.isFinite(anchor.noteTop)) {
                const note = document.querySelector(
                    `.note-item[data-id="${CSS.escape(anchor.noteId)}"]`
                );

                if (note) {
                    const newTop = note.getBoundingClientRect().top;
                    window.scrollBy({
                        left: 0,
                        top: newTop - anchor.noteTop,
                        behavior: 'auto'
                    });
                    return;
                }
            }

            window.scrollTo({
                left: anchor.scrollX,
                top: anchor.scrollY,
                behavior: 'auto'
            });
        };

        /* body class、上方工具列與筆記重新渲染都完成後再復原位置。 */
        requestAnimationFrame(() => {
            requestAnimationFrame(restore);
        });
    }

    function togglePreviewMode() {
        const viewportAnchor = capturePreviewViewportAnchor();

        isPreviewMode = !isPreviewMode;

        if (isPreviewMode) {
            resetEditingFiltersForPreview();
            closeMoveModal();
        }

        savePreviewModePreference();
        updatePreviewModeUi({ showToast: true });
        filterNotes();
        restorePreviewViewportAnchor(viewportAnchor);
    }

    function previewModeBlocksEditing() {
        if (!isPreviewMode) return false;

        showPreviewModeToast(
            '目前是預覽模式，請先按上方預覽圖示返回編輯'
        );
        return true;
    }

    const ADD_NOTE_MOUSE_BUTTON = 4;
    let lastUpperSideMouseAddAt = 0;

    function upperSideMouseButtonPressed(event) {
        return (
            event.button === ADD_NOTE_MOUSE_BUTTON ||
            (event.buttons & 16) === 16
        );
    }

    function handleUpperSideMouseAddShortcut(event) {
        if (!upperSideMouseButtonPressed(event)) return;

        /* 阻止瀏覽器把側邊上鍵當成上一頁／下一頁。 */
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        const now = Date.now();

        /* mousedown、mouseup、auxclick 可能連續觸發，只執行一次。 */
        if (now - lastUpperSideMouseAddAt < 450) return;
        lastUpperSideMouseAddAt = now;

        if (event.type !== 'mousedown') return;

        const noteModal = document.getElementById('noteModal');
        const noteModalActive =
            noteModal?.classList.contains('active');

        const activeOverlays = Array.from(
            document.querySelectorAll('.modal-overlay.active')
        );

        /* 編輯／新增筆記時，側邊上鍵直接等同「儲存筆記」。
           若上面另有表格、圖片或其他子視窗，則先不誤觸儲存。 */
        if (
            noteModalActive &&
            activeOverlays.length === 1 &&
            activeOverlays[0] === noteModal
        ) {
            saveNote();
            return;
        }

        /* 其他視窗開啟時，不執行新增或儲存。 */
        if (activeOverlays.length > 0) return;

        if (isPreviewMode) {
            showPreviewModeToast(
                '預覽模式不會新增筆記，請先返回編輯模式'
            );
            return;
        }

        openAddModal();
    }

    function setupUpperSideMouseAddShortcut() {
        if (setupUpperSideMouseAddShortcut.done) return;
        setupUpperSideMouseAddShortcut.done = true;

        ['mousedown', 'mouseup', 'auxclick'].forEach(type => {
            window.addEventListener(
                type,
                handleUpperSideMouseAddShortcut,
                true
            );
        });
    }


    const BACK_MOUSE_BUTTON = 3;
    let lastLowerSideMouseBackAt = 0;

    function lowerSideMouseButtonPressed(event) {
        return (
            event.button === BACK_MOUSE_BUTTON ||
            (event.buttons & 8) === 8
        );
    }

    function closeActiveOverlayForMouseBack() {
        const actions = [
            ['noteImageEditModal', () => noteImageEditor.close()],
            ['noteLinkModal', () => closeNoteLinkModal()],
            ['tableCreateModal', () => closeTableCreateModal()],
            ['randomDrawModal', () => closeRandomDrawModal()],
            ['categoryAssignModal', () => closeCategoryAssignModal()],
            ['categoryOverviewModal', () => closeCategoryOverviewModal()],
            ['imageViewer', () => closeImageViewer()],
            ['historyModal', () => closeHistoryModal()],
            ['moveModal', () => closeMoveModal()],
            ['noteModal', () => closeModal()]
        ];

        for (const [id, closeAction] of actions) {
            const element = document.getElementById(id);
            if (element?.classList.contains('active')) {
                closeAction();
                return true;
            }
        }

        return false;
    }

    function returnOneStepInNoteWebsite() {
        /* 第一優先：退出目前正在編輯或開啟的視窗。 */
        if (closeActiveOverlayForMouseBack()) return;

        /* 分類篩選先解除；在預覽模式中仍留在預覽模式。 */
        if (activeCategoryFilterId) {
            clearCategoryFilter();
            showPreviewModeToast('已取消分類篩選，顯示全部筆記');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        /* 若目前是星號篩選，也回到全部筆記。 */
        if (isStarFilterActive) {
            isStarFilterActive = false;
            const button = document.getElementById('btn-filter-star');
            if (button) {
                button.classList.remove('active');
                renderStarFilterControl();
            }
            filterNotes();
            showPreviewModeToast('已取消星號篩選');
            return;
        }

        /* 有搜尋內容時，先清除搜尋。 */
        const searchInput = document.getElementById('search-input');
        if (searchInput?.value) {
            searchInput.value = '';
            filterNotes();
            showPreviewModeToast('已清除搜尋，顯示全部筆記');
            return;
        }

        /* 預覽模式沒有其他上一層時，返回完整編輯模式。 */
        if (isPreviewMode) {
            togglePreviewMode();
            return;
        }

        showPreviewModeToast('目前沒有可返回的上一步');
    }

    function handleLowerSideMouseBackShortcut(event) {
        if (!lowerSideMouseButtonPressed(event)) return;

        /* 阻止瀏覽器把側邊下鍵當成上一頁，避免離開筆記網站。 */
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
            event.stopImmediatePropagation();
        }

        if (event.type !== 'mousedown') return;

        const now = Date.now();
        if (now - lastLowerSideMouseBackAt < 420) return;
        lastLowerSideMouseBackAt = now;

        returnOneStepInNoteWebsite();
    }

    function setupLowerSideMouseBackShortcut() {
        if (setupLowerSideMouseBackShortcut.done) return;
        setupLowerSideMouseBackShortcut.done = true;

        ['mousedown', 'mouseup', 'auxclick'].forEach(type => {
            window.addEventListener(
                type,
                handleLowerSideMouseBackShortcut,
                true
            );
        });
    }


    function localDateKey(value = new Date()) {
        const d = value instanceof Date ? value : new Date(value);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function stripHtml(html = '') { return notePlainText(html); }

    function notePreview(note) {
        const title = cleanNoteTitle(note?.title || '');
        const text = stripHtml(note?.text || '');
        if (title && text) return `${title}｜${text}`.slice(0,160);
        if (title) return title.slice(0,160);
        if (text) return text.slice(0,160);
        const galleryCount = Array.isArray(note?.images) ? note.images.length : (note?.image ? 1 : 0);
        const temp = document.createElement('div');
        temp.innerHTML = note?.text || '';
        const inlineCount = temp.querySelectorAll('[data-inline-image="1"], .inline-note-image').length;
        const total = galleryCount + inlineCount;
        return total ? `純圖片筆記（共 ${total} 張；行內 ${inlineCount} 張）` : '空白筆記';
    }

    function pruneHistory() {
        const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        editHistory = editHistory
            .filter(record => record && record.timestamp && new Date(record.timestamp).getTime() >= cutoff)
            .slice(-HISTORY_MAX_RECORDS);
    }

    function addHistoryRecord(action, note, detail = '') {
        editHistory.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            action,
            noteId: note?.id || '',
            preview: notePreview(note),
            detail
        });
        pruneHistory();
        updateHistoryBadge();
    }

    function getHistoryForDate(dateKey) {
        return editHistory.filter(record => localDateKey(record.timestamp) === dateKey);
    }

    function updateHistoryBadge() {
        const badge = document.getElementById('today-history-count');
        if (!badge) return;
        const todayRecords = getHistoryForDate(localDateKey());
        const uniqueNoteIds = new Set(todayRecords.map(r => r.noteId).filter(Boolean));
        badge.textContent = uniqueNoteIds.size;
        badge.title = `今天共有 ${todayRecords.length} 次內容異動，涉及 ${uniqueNoteIds.size} 則筆記`;
    }

    function escapeHtml(value = '') {
        return String(value).replace(/[&<>'"]/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        })[char]);
    }

    function escapeAttribute(value = '') {
        return escapeHtml(value);
    }


    const CATEGORY_PALETTE = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#d946ef','#ec4899','#64748b'];

    function normalizeCategoryColor(color) {
        const value = String(color || '').trim();
        return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '#8b5cf6';
    }

    function nextCategoryColor() {
        return CATEGORY_PALETTE[categoryDefinitions.length % CATEGORY_PALETTE.length];
    }

    function categoryGraphemes(value) {
        const clean = String(value || '').trim();
        if (!clean) return [];

        try {
            if (typeof Intl !== 'undefined' && Intl.Segmenter) {
                const segmenter = new Intl.Segmenter(
                    'zh-TW',
                    { granularity: 'grapheme' }
                );
                return Array.from(
                    segmenter.segment(clean),
                    item => item.segment
                );
            }
        } catch (error) {}

        return Array.from(clean);
    }

    function takeCategoryGraphemes(value, limit = 4) {
        return categoryGraphemes(value)
            .slice(0, Math.max(1, limit))
            .join('');
    }

    function normalizeCategoryAbbr(value, fallbackName = '') {
        const custom = takeCategoryGraphemes(value, 4);
        const fallback = takeCategoryGraphemes(fallbackName, 4);

        /* 舊版只有一個字的簡寫，會自動升級成分類名稱前四個字。
           若使用者輸入兩至四個字，則保留自訂內容。 */
        if (categoryGraphemes(custom).length >= 2) return custom;
        return fallback || custom || '分類';
    }

    function categoryDisplayAbbr(category) {
        return takeCategoryGraphemes(
            category?.abbr || category?.name || '分類',
            4
        ) || '分類';
    }

    function categoryVerticalLabelHtml(category) {
        return categoryGraphemes(categoryDisplayAbbr(category))
            .map(character => (
                `<span class="note-category-character">${
                    escapeHtml(character)
                }</span>`
            ))
            .join('');
    }

    function categoryTextColor() {
        /* 分類標籤統一使用白色文字，避免同一組標籤黑白混雜。 */
        return '#ffffff';
    }

    function getCategoryById(id) {
        return categoryDefinitions.find(category => category.id === id) || null;
    }

    function getNoteCategoryIds(note) {
        return Array.isArray(note?.categoryIds) ? note.categoryIds.filter(id => getCategoryById(id)) : [];
    }

    function createCategoryDefinition(name, color, refresh = true, abbreviation = '') {
        const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        if (!cleanName) return null;
        const duplicate = categoryDefinitions.find(category => category.name.toLowerCase() === cleanName.toLowerCase());
        if (duplicate) return duplicate;
        const category = {
            id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: cleanName,
            abbr: normalizeCategoryAbbr(abbreviation, cleanName),
            color: normalizeCategoryColor(color || nextCategoryColor())
        };
        categoryDefinitions.push(category);
        if (refresh) {
            updateCategoryUi();
            renderCategoryOverview();
            renderNoteCategoryPicker();
            renderCategoryAssignList();
        }
        return category;
    }

    function updateCategoryUi() {
        const badge = document.getElementById('category-count-badge');

        if (badge) badge.textContent = categoryDefinitions.length;

        const active = getCategoryById(activeCategoryFilterId);
        if (activeCategoryFilterId && !active) activeCategoryFilterId = null;
        const bar = document.getElementById('active-category-filter-bar');
        const button = document.getElementById('btn-category-overview');
        if (active) {
            bar?.classList.remove('hidden');
            const name = document.getElementById('active-category-name');
            const dot = document.getElementById('active-category-dot');
            if (name) name.textContent = active.name;
            if (dot) dot.style.background = active.color;
            button?.classList.add('active');
        } else {
            bar?.classList.add('hidden');
            button?.classList.remove('active');
        }
    }

    function categoryChipHtml(category, extraClass = '', attrs = '') {
        return `<button type="button" class="category-choice ${extraClass}" style="background:${escapeAttribute(category.color)};color:${categoryTextColor(category.color)}" ${attrs}>${escapeHtml(category.name)}</button>`;
    }

    function openCategoryOverviewModal() {
        renderCategoryOverview();
        document.getElementById('categoryOverviewModal').classList.add('active');
    }

    function closeCategoryOverviewModal() {
        document.getElementById('categoryOverviewModal').classList.remove('active');
    }

    function renderCategoryOverview() {
        const grid = document.getElementById('category-overview-grid');
        const manager = document.getElementById('category-manager-list');
        if (!grid || !manager) return;
        if (!categoryDefinitions.length) {
            grid.innerHTML = '<div class="category-empty-hint">目前還沒有分類。請在下方先建立「抗體藥」、「心血管用藥」或「要再複習」等分類。</div>';
        } else {
            grid.innerHTML = categoryDefinitions.map(category => {
                const count = notesData.filter(note => getNoteCategoryIds(note).includes(category.id)).length;
                return `<button type="button" class="category-overview-card ${activeCategoryFilterId === category.id ? 'active' : ''}" data-on-click="applyCategoryFilter" data-args="[${inlineJsArgument(category.id)}]">
                    <div class="category-card-color" style="background:${escapeAttribute(category.color)}"></div>
                    <div class="category-card-main">
                        <span class="category-card-abbr" style="background:${escapeAttribute(category.color)};color:${categoryTextColor(category.color)}">${escapeHtml(categoryDisplayAbbr(category))}</span>
                        <div>
                            <div class="category-card-name">${escapeHtml(category.name)}</div>
                            <div class="category-card-count">${count} 則筆記｜點擊直接篩選</div>
                        </div>
                    </div>
                </button>`;
            }).join('');
        }
        manager.innerHTML = categoryDefinitions.length ? categoryDefinitions.map(category => `
            <div class="category-manager-row" data-category-id="${escapeAttribute(category.id)}">
                <input type="color" id="category-color-${escapeAttribute(category.id)}" value="${escapeAttribute(category.color)}" title="調整顏色">
                <input class="category-abbr-input" type="text" id="category-abbr-${escapeAttribute(category.id)}" value="${escapeAttribute(category.abbr)}" maxlength="4" title="左側直排顯示最多四個字">
                <input type="text" id="category-name-${escapeAttribute(category.id)}" value="${escapeAttribute(category.name)}" maxlength="30" title="完整分類名稱">
                <button type="button" class="btn-category-save" data-on-click="updateCategoryDefinition" data-args="[${inlineJsArgument(category.id)}]">儲存</button>
                <button type="button" class="btn-category-delete" data-on-click="deleteCategoryDefinition" data-args="[${inlineJsArgument(category.id)}]">刪除</button>
            </div>`).join('') : '<div class="category-empty-hint">建立後可在這裡改名、換顏色或刪除。</div>';
    }

    function createCategoryFromManager() {
        const abbrInput = document.getElementById('category-manager-new-abbr');
        const nameInput = document.getElementById('category-manager-new-name');
        const colorInput = document.getElementById('category-manager-new-color');
        const category = createCategoryDefinition(nameInput.value, colorInput.value, true, abbrInput?.value);
        if (!category) return alert('請輸入分類名稱。');
        if (abbrInput) abbrInput.value = '';
        nameInput.value = '';
        colorInput.value = nextCategoryColor();
        autoSave();
    }

    function updateCategoryDefinition(id) {
        const category = getCategoryById(id);
        if (!category) return;
        const abbrInput = document.getElementById(`category-abbr-${id}`);
        const nameInput = document.getElementById(`category-name-${id}`);
        const colorInput = document.getElementById(`category-color-${id}`);
        const cleanName = String(nameInput?.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        if (!cleanName) return alert('分類名稱不能是空白。');
        const duplicate = categoryDefinitions.find(item => item.id !== id && item.name.toLowerCase() === cleanName.toLowerCase());
        if (duplicate) return alert('已經有相同名稱的分類。');
        category.name = cleanName;
        category.abbr = normalizeCategoryAbbr(abbrInput?.value, cleanName);
        category.color = normalizeCategoryColor(colorInput?.value);
        updateCategoryUi();
        renderCategoryOverview();
        renderNoteCategoryPicker();
        renderCategoryAssignList();
        filterNotes();
        autoSave();
    }

    function deleteCategoryDefinition(id) {
        const category = getCategoryById(id);
        if (!category) return;
        const affected = notesData.filter(note => getNoteCategoryIds(note).includes(id));
        if (!confirm(`確定要刪除分類「${category.name}」嗎？\n這會從 ${affected.length} 則筆記移除該分類，但不會刪除筆記。`)) return;
        affected.forEach(note => {
            noteRecovery.beforeEdit(note);
            note.categoryIds = getNoteCategoryIds(note).filter(categoryId => categoryId !== id);
            note.updatedAt = new Date().toISOString();
            addHistoryRecord('編輯', note, `移除已刪除的分類「${category.name}」`);
        });
        categoryDefinitions = categoryDefinitions.filter(item => item.id !== id);
        pendingCategoryIds = pendingCategoryIds.filter(categoryId => categoryId !== id);
        categoryAssignPendingIds = categoryAssignPendingIds.filter(categoryId => categoryId !== id);
        if (activeCategoryFilterId === id) activeCategoryFilterId = null;
        updateCategoryUi();
        renderCategoryOverview();
        renderNoteCategoryPicker();
        renderCategoryAssignList();
        filterNotes();
        autoSave();
    }

    function applyCategoryFilter(id) {
        if (!getCategoryById(id)) return;
        clearRandomDraw(false);
        // 點分類時直接顯示該分類的全部筆記，避免先前搜尋字或星號篩選把結果又縮小。
        document.getElementById('search-input').value = '';
        if (isStarFilterActive) {
            isStarFilterActive = false;
            const starButton = document.getElementById('btn-filter-star');
            starButton.classList.remove('active');
            renderStarFilterControl();
        }
        activeCategoryFilterId = id;
        closeCategoryOverviewModal();
        updateCategoryUi();
        filterNotes();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function clearCategoryFilter() {
        clearRandomDraw(false);
        activeCategoryFilterId = null;
        updateCategoryUi();
        filterNotes();
    }

    function renderNoteCategoryPicker() {
        const picker = document.getElementById('note-category-picker');
        if (!picker) return;
        if (!categoryDefinitions.length) {
            picker.innerHTML = '<div class="category-empty-hint">尚未建立分類；可在下方直接輸入名稱建立。</div>';
            return;
        }
        picker.innerHTML = categoryDefinitions.map(category => categoryChipHtml(
            category,
            pendingCategoryIds.includes(category.id) ? 'selected' : '',
            `data-on-click="togglePendingCategory" data-args="[${inlineJsArgument(category.id)}]" title="點擊勾選／取消"`
        )).join('');
    }

    function togglePendingCategory(id) {
        if (pendingCategoryIds.includes(id)) pendingCategoryIds = pendingCategoryIds.filter(categoryId => categoryId !== id);
        else pendingCategoryIds.push(id);
        renderNoteCategoryPicker();
    }

    function createCategoryFromNoteEditor() {
        const abbrInput = document.getElementById('note-category-new-abbr');
        const nameInput = document.getElementById('note-category-new-name');
        const colorInput = document.getElementById('note-category-new-color');
        const category = createCategoryDefinition(nameInput.value, colorInput.value, true, abbrInput?.value);
        if (!category) return alert('請輸入分類名稱。');
        if (!pendingCategoryIds.includes(category.id)) pendingCategoryIds.push(category.id);
        if (abbrInput) abbrInput.value = '';
        nameInput.value = '';
        colorInput.value = nextCategoryColor();
        renderNoteCategoryPicker();
        autoSave();
    }

    function openNoteCategoryModal(noteId) {
        if (previewModeBlocksEditing()) return;
        const note = resolveLinkedNote(noteId);
        if (!note) return;

        categoryAssignTargetNoteId = note.id;
        categoryAssignPendingIds = [...getNoteCategoryIds(note)];
        categoryAssignEditingId = null;

        const abbrInput = document.getElementById('category-assign-new-abbr');
        const nameInput = document.getElementById('category-assign-new-name');
        const colorInput = document.getElementById('category-assign-new-color');

        if (abbrInput) abbrInput.value = '';
        if (nameInput) nameInput.value = '';
        if (colorInput) colorInput.value = nextCategoryColor();

        renderCategoryAssignList();
        document.getElementById('categoryAssignModal').classList.add('active');

        requestAnimationFrame(() => nameInput?.focus());
    }

    function closeCategoryAssignModal() {
        document.getElementById('categoryAssignModal').classList.remove('active');
        categoryAssignTargetNoteId = null;
        categoryAssignPendingIds = [];
        categoryAssignEditingId = null;
    }

    function renderCategoryAssignList() {
        const list = document.getElementById('category-assign-list');
        if (!list) return;

        if (!categoryDefinitions.length) {
            list.innerHTML = '<div class="category-empty-hint">還沒有分類，可在下方直接建立。</div>';
            return;
        }

        list.innerHTML = categoryDefinitions.map(category => {
            const categoryId = escapeAttribute(category.id);

            if (categoryAssignEditingId === category.id) {
                return `<div class="category-assign-row editing" data-category-id="${categoryId}">
                    <input type="color" id="assign-category-color-${categoryId}" value="${escapeAttribute(category.color)}" title="分類顏色">
                    <input class="category-abbr-input" type="text" id="assign-category-abbr-${categoryId}" value="${escapeAttribute(category.abbr)}" maxlength="4" title="左側直排顯示最多四個字" data-on-keydown="handleAssignCategoryEditKeydown" data-args="[&quot;$event&quot;,${inlineJsArgument(category.id)}]">
                    <input type="text" id="assign-category-name-${categoryId}" value="${escapeAttribute(category.name)}" maxlength="30" title="完整分類名稱" data-on-keydown="handleAssignCategoryEditKeydown" data-args="[&quot;$event&quot;,${inlineJsArgument(category.id)}]">
                    <div class="category-assign-edit-actions">
                        <button type="button" class="category-assign-edit-save" data-on-click="saveCategoryEditFromAssignModal" data-args="[${inlineJsArgument(category.id)}]">儲存</button>
                        <button type="button" class="category-assign-edit-cancel" data-on-click="cancelCategoryEditFromAssignModal">取消</button>
                        <button type="button" class="category-assign-edit-delete" data-on-click="deleteCategoryFromAssignModal" data-args="[${inlineJsArgument(category.id)}]">刪除</button>
                    </div>
                </div>`;
            }

            const selected = categoryAssignPendingIds.includes(category.id);
            return `<div class="category-assign-row ${selected ? 'selected' : ''}" data-category-id="${categoryId}">
                ${categoryChipHtml(
                    category,
                    selected ? 'selected' : '',
                    `data-on-click="toggleAssignCategory" data-args="[${inlineJsArgument(category.id)}]" title="點擊勾選／取消"`
                )}
                <div class="category-assign-row-actions">
                    <button type="button" class="category-assign-icon-button" data-on-click="beginCategoryEditFromAssignModal" data-args="[${inlineJsArgument(category.id)}]" title="編輯分類" aria-label="編輯分類"><i class="fas fa-pen"></i></button>
                    <button type="button" class="category-assign-icon-button delete" data-on-click="deleteCategoryFromAssignModal" data-args="[${inlineJsArgument(category.id)}]" title="刪除分類" aria-label="刪除分類"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
    }


    function beginCategoryEditFromAssignModal(id) {
        if (!getCategoryById(id)) return;
        categoryAssignEditingId = id;
        renderCategoryAssignList();

        requestAnimationFrame(() => {
            const input = document.getElementById(`assign-category-name-${id}`);
            input?.focus();
            input?.select();
        });
    }

    function cancelCategoryEditFromAssignModal() {
        categoryAssignEditingId = null;
        renderCategoryAssignList();
    }

    function handleAssignCategoryEditKeydown(event, id) {
        if (event.key === 'Enter') {
            event.preventDefault();
            saveCategoryEditFromAssignModal(id);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelCategoryEditFromAssignModal();
        }
    }

    function saveCategoryEditFromAssignModal(id) {
        const category = getCategoryById(id);
        if (!category) return;

        const abbrInput = document.getElementById(`assign-category-abbr-${id}`);
        const nameInput = document.getElementById(`assign-category-name-${id}`);
        const colorInput = document.getElementById(`assign-category-color-${id}`);

        const cleanName = String(nameInput?.value || '')
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 30);

        if (!cleanName) {
            alert('分類名稱不能是空白。');
            nameInput?.focus();
            return;
        }

        const duplicate = categoryDefinitions.find(item =>
            item.id !== id &&
            item.name.toLowerCase() === cleanName.toLowerCase()
        );

        if (duplicate) {
            alert('已經有相同名稱的分類。');
            nameInput?.focus();
            return;
        }

        category.name = cleanName;
        category.abbr = normalizeCategoryAbbr(
            abbrInput?.value,
            cleanName
        );
        category.color = normalizeCategoryColor(colorInput?.value);

        categoryAssignEditingId = null;

        updateCategoryUi();
        renderCategoryOverview();
        renderNoteCategoryPicker();
        renderCategoryAssignList();
        filterNotes();
        autoSave();
    }

    function deleteCategoryFromAssignModal(id) {
        categoryAssignEditingId = null;
        deleteCategoryDefinition(id);
    }

    function toggleAssignCategory(id) {
        if (categoryAssignPendingIds.includes(id)) categoryAssignPendingIds = categoryAssignPendingIds.filter(categoryId => categoryId !== id);
        else categoryAssignPendingIds.push(id);
        renderCategoryAssignList();
    }

    function handleCategoryAssignQuickCreateKeydown(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        saveCategoryAssignment();
    }

    function createCategoryFromAssignModal(options = {}) {
        const {
            silentIfEmpty = false,
            clearInputs = true
        } = options;

        const abbrInput = document.getElementById('category-assign-new-abbr');
        const nameInput = document.getElementById('category-assign-new-name');
        const colorInput = document.getElementById('category-assign-new-color');

        const nameValue = String(nameInput?.value || '').trim();
        const abbrValue = String(abbrInput?.value || '').trim();

        if (!nameValue) {
            if (abbrValue && !silentIfEmpty) {
                alert('請輸入完整分類名稱。');
                nameInput?.focus();
            }
            return null;
        }

        const category = createCategoryDefinition(
            nameValue,
            colorInput?.value,
            true,
            abbrValue
        );

        if (!category) {
            if (!silentIfEmpty) {
                alert('請輸入分類名稱。');
                nameInput?.focus();
            }
            return null;
        }

        if (!categoryAssignPendingIds.includes(category.id)) {
            categoryAssignPendingIds.push(category.id);
        }

        if (clearInputs) {
            if (abbrInput) abbrInput.value = '';
            if (nameInput) nameInput.value = '';
            if (colorInput) colorInput.value = nextCategoryColor();
        }

        renderCategoryAssignList();
        autoSave();
        return category;
    }

    function saveCategoryAssignment() {
        const note = notesData.find(
            item => item.id === categoryAssignTargetNoteId
        );

        if (!note) {
            closeCategoryAssignModal();
            return;
        }

        const abbrInput = document.getElementById('category-assign-new-abbr');
        const nameInput = document.getElementById('category-assign-new-name');
        const hasDraftName = !!String(nameInput?.value || '').trim();
        const hasDraftAbbr = !!String(abbrInput?.value || '').trim();

        /* 快速新增欄只要有輸入名稱，就先建立並自動勾選，
           接著立刻套用到目前筆記，不需要再點兩次。 */
        if (hasDraftName) {
            const created = createCategoryFromAssignModal({
                silentIfEmpty: false,
                clearInputs: true
            });
            if (!created) return;
        } else if (hasDraftAbbr) {
            alert('請輸入完整分類名稱。');
            nameInput?.focus();
            return;
        }

        const oldIds = getNoteCategoryIds(note);
        const newIds = categoryAssignPendingIds.filter(
            id => getCategoryById(id)
        );

        if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
            noteRecovery.beforeEdit(note);
            note.categoryIds = [...newIds];
            note.updatedAt = new Date().toISOString();

            const names = newIds
                .map(id => getCategoryById(id)?.name)
                .filter(Boolean);

            addHistoryRecord(
                '編輯',
                note,
                `分類改為：${names.length ? names.join('、') : '未分類'}`
            );
            autoSave();
        }

        closeCategoryAssignModal();
        filterNotes();
    }

    function openHistoryModal() {
        const input = document.getElementById('history-date');
        if (!input.value) input.value = localDateKey();
        renderHistory();
        document.getElementById('historyModal').classList.add('active');
    }

    function closeHistoryModal() { document.getElementById('historyModal').classList.remove('active'); }

    function setHistoryDateToday() {
        document.getElementById('history-date').value = localDateKey();
        renderHistory();
    }

    function renderHistory() {
        const dateKey = document.getElementById('history-date').value || localDateKey();
        const records = getHistoryForDate(dateKey).slice().reverse();
        const list = document.getElementById('history-list');
        const summary = document.getElementById('history-summary');
        const uniqueNoteIds = new Set(records.map(r => r.noteId).filter(Boolean));
        summary.textContent = `${dateKey}：共 ${records.length} 次內容異動，涉及 ${uniqueNoteIds.size} 則筆記（保留最近 ${HISTORY_RETENTION_DAYS} 天）`;

        if (records.length === 0) {
            list.innerHTML = '<div class="history-empty"><i class="far fa-calendar-check" style="font-size:2rem; margin-bottom:8px;"></i><br>這一天沒有新增、編輯或刪除紀錄。</div>';
            return;
        }

        list.innerHTML = records.map(record => {
            const noteIndex = notesData.findIndex(n => n.id === record.noteId);
            const stillExists = noteIndex !== -1;
            const actionClass = record.action === '新增' ? 'add' : record.action === '刪除' ? 'delete' : 'edit';
            const timeText = new Date(record.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return `
                <div class="history-item ${actionClass}">
                    <div class="history-head">
                        <span class="history-action">${escapeHtml(record.action)}${stillExists ? `｜目前第 ${noteIndex + 1} 則` : ''}</span>
                        <span class="history-time">${escapeHtml(timeText)}</span>
                    </div>
                    <div class="history-preview">${escapeHtml(record.preview || '（無文字預覽）')}</div>
                    ${record.detail ? `<div class="history-detail">變更：${escapeHtml(record.detail)}</div>` : ''}
                    ${stillExists ? `<button class="btn-locate-note" data-on-click="locateHistoryNote" data-args="[${inlineJsArgument(record.noteId)}]"><i class="fas fa-location-crosshairs"></i> 定位筆記</button>` : '<div class="history-detail">此筆記目前已被刪除</div>'}
                </div>`;
        }).join('');
    }

    function locateHistoryNote(id) {
        closeHistoryModal();
        clearRandomDraw(false);
        noteBrowse.requestReveal(id);
        document.getElementById('search-input').value = '';
        if (isStarFilterActive) {
            isStarFilterActive = false;
            const btn = document.getElementById('btn-filter-star');
            btn.classList.remove('active');
            renderStarFilterControl();
        }
        activeCategoryFilterId = null;
        updateCategoryUi();
        renderNotes();
        requestAnimationFrame(() => {
            const item = document.querySelector(`.note-item[data-id="${CSS.escape(id)}"]`);
            if (!item) return;
            item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            item.classList.remove('history-flash');
            void item.offsetWidth;
            item.classList.add('history-flash');
        });
    }

    function openImageViewer(src) {
        return noteImageViewer.open(src);
    }

    function closeImageViewer() {
        noteImageViewer.close();
    }

    window.toggleStar = function(id) {
        if (previewModeBlocksEditing()) return;
        const note = resolveLinkedNote(id);
        if (note) { noteRecovery.beforeEdit(note); note.starred = !note.starred; filterNotes(); autoSave(); }
    };

    function toggleStarFilter() {
        clearRandomDraw(false);
        isStarFilterActive = !isStarFilterActive;
        renderStarFilterControl();
        filterNotes();
    }

    const noteSearchCache = new WeakMap();
    let searchRenderTimer = null;

    function searchableNoteText(note) {
        const categoryNames = getNoteCategoryIds(note)
            .map(id => getCategoryById(id)?.name || '')
            .join(' ');

        const imageText=noteImageSearch.text(note);
        const signature = [
            imageText,
            note.title || '',
            note.text || '',
            categoryNames
        ].join('\u0001');

        const cached = noteSearchCache.get(note);
        if (cached?.signature === signature) return cached.value;

        const value = normalizeSearchText(`${imageText} ${note.title || ''} ${
            notePlainText(note.text || '')
        } ${categoryNames}`);

        noteSearchCache.set(note, { signature, value });
        return value;
    }

    function getNormallyFilteredNotes() {
        const query = normalizeSearchText(document.getElementById('search-input').value);

        return notesData.filter(note => {
            const categoryIds = getNoteCategoryIds(note);

            return (
                (!query || searchableNoteText(note).includes(query)) &&
                (!isStarFilterActive || note.starred) &&
                (
                    !activeCategoryFilterId ||
                    categoryIds.includes(activeCategoryFilterId)
                )
            );
        });
    }

    function filterNotes(options = {}) {
        options = noteSearchViewport.filterOptions(options);
        if (randomDrawState.active) {
            renderNotes(
                randomDrawState.selectedIds
                    .map(id => notesData.find(note => note.id === id))
                    .filter(Boolean), options
            );
            updateRandomFilterBar();
            return;
        }

        renderNotes(getNormallyFilteredNotes(), options);
        updateRandomFilterBar();
    }

    function handleSearchInput(event) {
        if (event?.isComposing) return;
        savedNoteFocusSession++;
        clearRandomDraw(false);

        if (searchRenderTimer) {
            clearTimeout(searchRenderTimer);
        }

        searchRenderTimer = setTimeout(filterNotes, 90);
    }
    function getRandomCandidates(scope='filtered'){if(scope==='all')return [...notesData];if(scope==='starred')return notesData.filter(n=>n.starred);if(scope==='category')return activeCategoryFilterId?notesData.filter(n=>getNoteCategoryIds(n).includes(activeCategoryFilterId)):[];return getNormallyFilteredNotes()}
    function openRandomDrawModal(){const s=document.getElementById('random-draw-scope');s.value=activeCategoryFilterId?'category':(randomDrawState.scope||'filtered');document.getElementById('random-draw-count').value=randomDrawState.count||1;if(s.value==='review'||![...s.options].some(o=>o.value===s.value))s.value='filtered';updateRandomCandidateHint();noteDrawLog.refreshEntry();document.getElementById('randomDrawModal').classList.add('active')}
    function closeRandomDrawModal(){document.getElementById('randomDrawModal').classList.remove('active')}
    function updateRandomCandidateHint(){const scope=document.getElementById('random-draw-scope')?.value||'filtered',c=getRandomCandidates(scope),count=Math.max(1,Math.min(50,Number(document.getElementById('random-draw-count')?.value)||1)),cat=getCategoryById(activeCategoryFilterId),label={filtered:'目前篩選結果',all:'全部筆記',starred:'星號筆記',category:cat?`分類「${cat.name}」`:'目前分類（尚未選取分類）'}[scope];document.getElementById('random-candidate-hint').textContent=`${label}共有 ${c.length} 則；本次最多會抽出 ${Math.min(count,c.length)} 則。`}
    function shuffledCopy(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
    function performRandomDraw(reuse=false){const scope=reuse?randomDrawState.scope:(document.getElementById('random-draw-scope')?.value||'filtered'),count=reuse?randomDrawState.count:Math.max(1,Math.min(50,Number(document.getElementById('random-draw-count')?.value)||1)),c=getRandomCandidates(scope);if(!c.length)return alert(scope==='category'&&!activeCategoryFilterId?'請先在分類總覽選擇一個分類。':'目前範圍內沒有可以抽取的筆記。');const selected=shuffledCopy(c).slice(0,Math.min(count,c.length));randomDrawState={active:true,selectedIds:selected.map(n=>n.id),count,scope,sessionId:noteDrawLog.record(selected,scope)};closeRandomDrawModal();renderNotes(selected);updateRandomFilterBar();window.scrollTo({top:0,behavior:'smooth'})}
    function repeatRandomDraw(){randomDrawState.active&&randomDrawState.scope!=='review'?performRandomDraw(true):openRandomDrawModal()}
    function clearRandomDraw(refresh=true){randomDrawState.active=false;randomDrawState.selectedIds=[];updateRandomFilterBar();if(refresh)filterNotes()}
    function updateRandomFilterBar(){const bar=document.getElementById('active-random-filter-bar');if(!bar)return;bar.classList.toggle('hidden',!randomDrawState.active);if(!randomDrawState.active)return;const count=randomDrawState.selectedIds.filter(id=>notesData.some(n=>n.id===id)).length,cat=getCategoryById(activeCategoryFilterId),label={filtered:'目前篩選結果',all:'全部筆記',starred:'星號筆記',category:cat?`分類「${cat.name}」`:'分類筆記'}[randomDrawState.scope]||'筆記';document.getElementById('active-random-summary').textContent=randomDrawState.scope==='review'?`正在看：${randomDrawState.reviewLabel||'抽取記錄'}（${count} 則）`:`已從${label}隨機抽出 ${count} 則完整筆記`}

    function executeSwap() {
        if (previewModeBlocksEditing()) return;
        const idx1 = parseInt(document.getElementById('swap-idx-1').value) - 1;
        const idx2 = parseInt(document.getElementById('swap-idx-2').value) - 1;
        if (isNaN(idx1) || isNaN(idx2)) return alert("請輸入完整的編號數字！");
        if (idx1 < 0 || idx1 >= notesData.length || idx2 < 0 || idx2 >= notesData.length) return alert(`編號超出範圍！目前共有 ${notesData.length} 則筆記。`);
        if (idx1 === idx2) return;
        const temp = notesData[idx1]; notesData[idx1] = notesData[idx2]; notesData[idx2] = temp;
        document.getElementById('swap-idx-1').value = ''; document.getElementById('swap-idx-2').value = '';
        filterNotes(); autoSave();
    }

    function openMoveModal() {
        if (previewModeBlocksEditing()) return;
        document.getElementById('total-notes-hint').innerText = `(目前總數：${notesData.length})`;
        document.getElementById('moveModal').classList.add('active');
    }
    function closeMoveModal() { document.getElementById('moveModal').classList.remove('active'); }

    function executeAdvancedMove(actionType) {
        if (previewModeBlocksEditing()) return;
        const targetIdx = parseInt(document.getElementById('move-target').value) - 1;
        if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= notesData.length) return alert(`請輸入正確的目標筆記編號 (1 ~ ${notesData.length})`);
        
        let newIdx; const itemToMove = notesData[targetIdx];
        if (actionType === 'top') newIdx = 0;
        else if (actionType === 'bottom') newIdx = notesData.length - 1;
        else {
            const step = parseInt(document.getElementById('move-step').value);
            if (isNaN(step) || step <= 0) return alert("請輸入要移動的正確格數 X (必須大於 0)！");
            if (actionType === 'up') newIdx = Math.max(0, targetIdx - step);
            else if (actionType === 'down') newIdx = Math.min(notesData.length - 1, targetIdx + step);
        }
        if (targetIdx === newIdx) { closeMoveModal(); return; }
        
        notesData.splice(targetIdx, 1); notesData.splice(newIdx, 0, itemToMove);
        document.getElementById('move-target').value = ''; closeMoveModal(); filterNotes(); autoSave();
    }


/* Source: 20-note-renderer.js */
    function optimizeRenderedImages(root) {
        root.querySelectorAll('img').forEach(image => {
            image.loading = 'lazy';
            image.decoding = 'async';
            image.draggable = false;
            if (!image.hasAttribute('alt')) image.alt = '筆記圖片';
        });
    }

    function setupNoteListInteractions() {
        const list = document.getElementById('note-list');
        if (!list || list.dataset.interactionsBound === '1') return;

        list.dataset.interactionsBound = '1';

        list.addEventListener('click', async event => {
            const internalLink = internalNoteLinkFromElement(event.target);

            if (internalLink) {
                event.preventDefault();
                event.stopPropagation();
                jumpToLinkedNote(internalLink.noteId);
                return;
            }

            const galleryFrame =
                event.target.closest('.note-image-frame[data-view-src]');

            if (galleryFrame) {
                event.preventDefault();
                event.stopPropagation();
                openImageViewer(()=>notePersistence.renderedImageSource(galleryFrame));
                return;
            }

            const inlineImage =
                event.target.closest('.note-text img.inline-note-image, .note-text .inline-note-image img, .note-text img[data-cloud-asset]');

            if (inlineImage) {
                event.preventDefault();
                event.stopPropagation();
                openImageViewer(()=>notePersistence.renderedImageSource(inlineImage));
            }
        });

        list.addEventListener('dblclick', event => {
            if (isPreviewMode) return;

            if (
                event.target.closest(
                    '.inline-note-image, .note-image-frame, img, ' +
                    '.note-category-chip, .note-category-add, ' +
                    '.star-icon, .note-star-button, .btn-delete, .note-internal-link, ' +
                    'a, button'
                )
            ) {
                return;
            }

            const noteItem = event.target.closest('.note-item[data-id]');
            if (!noteItem) return;

            event.preventDefault();
            event.stopPropagation();
            openEditModal(noteItem.dataset.id);
        });

        list.addEventListener(
            'error',
            event => {
                const image = event.target;
                if (!(image instanceof HTMLImageElement) || image.dataset.cloudAsset) return;

                const holder = image.closest(
                    '.note-image-frame, .inline-note-image'
                );
                holder?.classList.add('image-load-error');
                image.style.display = 'none';
            },
            true
        );
    }

    function renderNotes(dataToRender = notesData, options = {}) {
        dataToRender = noteBrowse.select(dataToRender);
        const list = document.getElementById('note-list');
        list.dataset.readerStablePage = dataToRender.length <= 20 ? '1' : '0';
        const update = noteSearchViewport.begin(list, dataToRender, options);
        if (update.unchanged) { notePersistence.prepareRenderedImages(list); noteImageSearch.markImages(list); noteSearchNavigation.decorate(list,{preserveViewport:options.background}); return; }
        if (!update.background) notePersistence.resetRenderedImages();
        const noteIndexMap = new Map(
            notesData.map((note, index) => [note.id, index])
        );

        dataToRender.forEach(note => {
            const absoluteIndex = noteIndexMap.get(note.id) ?? 0;
            if (noteSearchViewport.reuse(update, note)) return;
            const item = document.createElement('li');

            item.className = 'note-item';
            item.dataset.id = note.id;
            item.id = `note-${note.id}`;

            const imageSources =
                Array.isArray(note.images) && note.images.length
                    ? note.images
                    : (note.image ? [note.image] : []);

            const imagesHtml = imageSources.length
                ? `<div class="note-images-container">${
                    imageSources.map((source, index) => `
                        <div
                            class="note-image-frame"
                            data-view-src="${escapeAttribute(source)}"
                            title="點一下放大"
                        >
                            <img
                                src="${escapeAttribute(source)}"
                                loading="lazy"
                                decoding="async"
                                alt="筆記圖片 ${index + 1}"
                            >
                        </div>
                    `).join('')
                }</div>`
                : '';

            const starClass =
                note.starred ? 'fa-solid star-active' : 'fa-regular';

            const noteCategories = getNoteCategoryIds(note)
                .map(id => getCategoryById(id))
                .filter(Boolean);

            const categoryRailHtml = noteCategories
                .map(category => `
                    <button
                        type="button"
                        class="note-category-chip"
                        style="background:${escapeAttribute(category.color)};color:${categoryTextColor(category.color)}"
                        title="${escapeAttribute(category.name)}｜點擊只顯示此分類"
                        aria-label="${escapeAttribute(category.name)}"
                        data-on-click="applyCategoryFilter" data-args="[${inlineJsArgument(category.id)}]" data-stop
                    >${categoryVerticalLabelHtml(category)}</button>
                `)
                .join('');

            item.innerHTML = `
                <div class="note-number-container">
                    <div class="note-star-number-row">
                        <button type="button" class="note-star-button" data-note-star="${escapeAttribute(note.id)}" aria-label="${note.starred?'取消最愛':'加入最愛'}" aria-pressed="${!!note.starred}" data-on-click="toggleStar" data-args="[${inlineJsArgument(note.id)}]">
                            <svg viewBox="0 0 24 24" fill="${note.starred?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 3Z"/></svg>
                        </button>
                        <div class="note-number">${absoluteIndex + 1}.</div>
                    </div>
                    <div class="note-category-stack">${categoryRailHtml}</div>
                    <button
                        type="button"
                        class="note-category-add"
                        data-on-click="openNoteCategoryModal" data-args="[${inlineJsArgument(note.id)}]" data-stop
                        title="${noteCategories.length ? '修改分類' : '新增分類'}"
                        aria-label="${noteCategories.length ? '修改分類' : '新增分類'}"
                    >
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3h7l10 10-7 7L3 10Z"/><circle cx="7" cy="7" r="1"/></svg>
                    </button>
                </div>

                <div class="note-content-area">
                    ${
                        note.title
                            ? `<div class="note-title-display">${escapeHtml(note.title)}</div>`
                            : ''
                    }
                    ${
                        note.text
                            ? `<div class="note-text" id="text-${escapeAttribute(note.id)}">${sanitizeNoteHtml(note.text)}</div>`
                            : `<div class="note-text" id="text-${escapeAttribute(note.id)}" style="display:none;"></div>`
                    }
                    ${imagesHtml}
                    ${randomDrawState.active && randomDrawState.selectedIds.some(id => String(id) === String(note.id)) ? noteDrawLog.markBarHtml(note.id) : ''}
                </div>

                <div class="note-actions">
                    <button
                        class="btn-delete"
                        data-on-click="deleteNote" data-args="[${inlineJsArgument(note.id)}]" data-stop
                        title="移到垃圾桶（30 天內可還原）"
                        aria-label="將這則筆記移到垃圾桶"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>
                    </button>
                </div>
            `;

            notePersistence.prepareRenderedImages(item);
            noteSearchViewport.add(update, note, item);
        });

        noteSearchViewport.commit(update);
        optimizeRenderedImages(list);
        notePersistence.prepareRenderedImages(list);
        noteImageSearch.markImages(list);
        noteSearchNavigation.decorate(list,{preserveViewport:options.background});
    }

    function openGalleryImageViewer(index) {
        if (Date.now() < suppressGalleryImageClickUntil) return;
        const source = currentPastedImages[index];
        if (source) openImageViewer(source);
    }

    function renderPreviewGrid() {
        const grid = document.getElementById('preview-grid');
        const manager = document.getElementById(
            'legacy-gallery-manager'
        );
        const count = document.getElementById(
            'legacy-gallery-count'
        );

        if (!grid) return;

        if (count) count.textContent = currentPastedImages.length;

        if (manager) {
            manager.classList.toggle(
                'hidden',
                currentPastedImages.length === 0
            );
        }

        const fragment = document.createDocumentFragment();

        currentPastedImages.forEach((imageSource, index) => {
            const item = document.createElement('div');

            item.className = 'preview-item';
            item.dataset.index = String(index);
            item.innerHTML = `
                <button
                    type="button"
                    class="preview-drag-handle"
                    title="拖曳排序"
                >
                    <i class="fas fa-grip-vertical"></i>
                </button>

                <div
                    class="preview-image-box"
                    data-on-click="openGalleryImageViewer" data-args="[${index}]"
                    title="點一下放大；按住圖片可拖曳排序"
                >
                    <img
                        src="${escapeAttribute(imageSource)}"
                        loading="lazy"
                        decoding="async"
                        draggable="false"
                        alt="待儲存圖片 ${index + 1}"
                    >
                </div>

                <div class="preview-order">
                    第 ${index + 1} 張｜按住圖片拖曳排序
                </div>

                <div class="preview-actions">
                    <button type="button" class="btn-preview-edit" data-on-click="noteImageEditor.open" data-args="[{&quot;gallery&quot;:${index}}]">編輯／標記</button>
                    <button
                        type="button"
                        class="btn-preview-insert"
                        data-on-click="moveGalleryImageInline" data-args="[${index}]"
                    >
                        <i class="fas fa-arrow-up"></i> 移入文字
                    </button>

                    <button
                        type="button"
                        class="btn-preview-remove"
                        data-on-click="removeSingleImage" data-args="[${index}]"
                    >
                        <i class="fas fa-trash"></i> 移除
                    </button>
                </div>
            `;

            fragment.appendChild(item);
        });

        grid.replaceChildren(fragment);
        noteInstantEditor.prepareGallery();
    }

    window.removeSingleImage = function(index) {
        currentPastedImages.splice(index, 1);
        renderPreviewGrid();
    };

    window.moveGalleryImageInline = function(index) {
        const source = currentPastedImages[index];
        if (!source) return;

        currentPastedImages.splice(index, 1);
        renderPreviewGrid();
        const insertionRange = savedEditorRange?.cloneRange();
        if (insertionRange) insertionRange.collapse(false);
        insertInlineImage(source, insertionRange, currentGalleryImageEdits[noteImageEditor.galleryKey(source)]);
    };

    let noteOpenRequest = 0;
    function openAddModal() {
        noteOpenRequest++;
        editorSelectionRevision++;
        finishEditorColorChord();
        endEditorColorMemoryManagement();
        clearInlineImageSelection();
        if (previewModeBlocksEditing()) return;
        clearTableCellSelection();
        savedEditorFocusHost = null;
        editingNoteId = null;
        document.getElementById('note-title-input').value = '';
        document.getElementById('modal-text').innerHTML = ''; currentPastedImages = [];
        currentGalleryImageEdits = {};
        pendingCategoryIds = [];
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


/* Source: 40-cache.js */
    function createNoteReadCache(space) {
        let db = null, opening = null, writable = true;
        async function open() {
            if (opening) return opening;
            opening = new Promise(resolve => {
                let storage;try{storage=globalThis.indexedDB;}catch(_){return resolve(null);}
                if (!storage) return resolve(null);
                let done = false, request;
                const finish = value => {if(done){value?.close();return;}done=true;clearTimeout(timer);db=value;resolve(value);};
                const timer=setTimeout(()=>finish(null),1200);
                try {
                    request=storage.open(space+'-cloud-read-cache-v1',1);
                    request.onupgradeneeded=()=>request.result.createObjectStore('entries');
                    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();db=null;};finish(request.result);};
                    request.onerror=request.onblocked=()=>finish(null);
                } catch (_) {finish(null);}
            });
            return opening;
        }
        async function get(key) {
            await open();if(!db)return undefined;
            return new Promise(resolve=>{try{const request=db.transaction('entries').objectStore('entries').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(undefined);}catch(_){resolve(undefined);}});
        }
        async function put(entries) {
            await open();if(!db||!writable)return false;
            return new Promise(resolve=>{try{const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries');for(const [key,value]of entries)store.put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>{writable=false;resolve(false);};}catch(_){writable=false;resolve(false);}});
        }
        async function remove(key) {
            await open();if(!db)return;
            return new Promise(resolve=>{try{const tx=db.transaction('entries','readwrite');tx.objectStore('entries').delete(key);tx.oncomplete=tx.onerror=tx.onabort=()=>resolve();}catch(_){resolve();}});
        }
        return {get,put,remove};
    }

    // 圖片及每則筆記各自以內容雜湊保存；大型物件再切成小段。
function createNotePreviewCache(cache,{maxBytes=48*1024*1024,pinned=()=>[]}={}){
    const key='preview-index-v1',prefix='preview-v1:';let entries=new Map(),ready=null,writing=Promise.resolve();
    async function initialize(){
        if(!ready)ready=(async()=>{const saved=await cache.get(key);if(Array.isArray(saved))for(const item of saved){if(item&&/^[a-f0-9]{64}$/.test(item.key)&&Number.isSafeInteger(item.bytes)&&item.bytes>0&&item.bytes<=500000)entries.set(item.key,item);}})();
        return ready;
    }
    function serial(fn){const job=writing.then(fn,fn);writing=job.catch(()=>{});return job;}
    async function put(items){
        await initialize();return serial(async()=>{
            const before=new Map(entries),now=Date.now(),writes=[];
            for(const item of items){entries.set(item.file.key,{key:item.file.key,bytes:item.file.bytes,used:now});writes.push([prefix+item.file.key,item.blob]);}
            let size=[...entries.values()].reduce((n,item)=>n+item.bytes,0);const keep=new Set(pinned()),removed=[];
            for(const item of [...entries.values()].sort((a,b)=>a.used-b.used)){
                if(size<=maxBytes)break;if(keep.has(item.key))continue;
                entries.delete(item.key);size-=item.bytes;removed.push(item.key);
            }
            if(!await cache.put([...writes,[key,[...entries.values()]]])){entries=before;return false;}
            for(const id of removed)await cache.remove(prefix+id);
            return true;
        });
    }
    async function get(file){
        await initialize();const blob=await cache.get(prefix+file.key)||await cache.get('binary:'+file.key);
        const item=entries.get(file.key);if(item)item.used=Date.now();return blob;
    }
    async function remove(id){await initialize();return serial(async()=>{entries.delete(id);await cache.remove(prefix+id);await cache.remove('binary:'+id);await cache.put([[key,[...entries.values()]]]);});}
    return {initialize,get,put,remove,has:id=>entries.has(id),size:()=>[...entries.values()].reduce((n,item)=>n+item.bytes,0)};
}


/* Source: 50-drive-transport.js */
/* Private Drive transport. Preview data never enters the editable original asset store. */
const noteDriveBoot = window.NOTE_CLOUD_BOOTSTRAP;
const noteDriveError = (message, code='DRIVE', retryable=true) => Object.assign(new Error(message),{code,retryable});
let noteDriveActive=0,noteDriveBackground=0;
const noteDriveQueue=[];
function noteDriveAbortError(){return noteDriveError('已停止舊雲端搬移，已完成的進度會保留。','CANCELLED',false);}
function noteDriveCheckSignal(signal){if(signal?.aborted)throw noteDriveAbortError();}
function noteDrivePump(){while(noteDriveActive<4&&noteDriveQueue.length){noteDriveQueue.sort((a,b)=>a.priority-b.priority);const index=noteDriveQueue.findIndex(job=>job.priority<10||noteDriveBackground<1&&noteDriveActive<3);if(index<0)break;const [job]=noteDriveQueue.splice(index,1);noteDriveActive++;if(job.priority>=10)noteDriveBackground++;job.start();}}
async function noteDriveRpc(action,body={},book=noteDriveBoot.book,signal,priority=0){
    noteDriveCheckSignal(signal);
    await new Promise((resolve,reject)=>{
        const cancel=()=>{const i=noteDriveQueue.indexOf(job);if(i>=0){noteDriveQueue.splice(i,1);reject(noteDriveAbortError());}};
        const job={priority,start:()=>{signal?.removeEventListener('abort',cancel);resolve();}};
        signal?.addEventListener('abort',cancel,{once:true});noteDriveQueue.push(job);noteDrivePump();
    });
    try{return await new Promise((resolve,reject)=>{
        let settled=false;
        const cancel=()=>finish(reject,noteDriveAbortError());
        const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);fn(value);};
        const timer=setTimeout(()=>finish(reject,noteDriveError('Google 雲端回覆逾時，本機草稿仍保留。','TIMEOUT')),120000);
        signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted){cancel();return;}
        // The old Apps Script server is replaced by direct Google Drive calls from this browser.
        noteDriveServer.call({...body,action,book}).then(value=>{
            if(!value||value.success!==true)return finish(reject,noteDriveError(value?.error||'雲端未確認操作。',value?.code,value?.retryable!==false));
            finish(resolve,value);
        },e=>finish(reject,noteDriveError(String(e?.message||e).slice(0,350),'RPC')));
    });}finally{noteDriveActive--;if(priority>=10)noteDriveBackground--;noteDrivePump();}
}

function createNoteDriveCloud(options){
    const {getAsset,loadAsset=async()=>undefined,installAsset,progress=()=>{}}=options;
    const prefix='note-local-asset:',enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
    const cache=createNoteReadCache(options.space+'-drive-v2'),assets=new Map(),confirmed=new Set(),jobs=new Map(),previewJobs=new Map();
    const binaries=new Map(),previewValues=new Map(),encoded=new Map(),legacyReaders=new Map(),scopedLegacyReaders=new WeakMap(),restoredLegacy=new Set();
    let head={revision:null,pages:[],preload:[]},records=[],initialized=null,loaded=false,expected=null,transferred=0;
    const previewDisk=createNotePreviewCache(cache,{pinned:()=>head.preload.map(d=>d.key)});
    let mutations=Promise.resolve();
    function serialize(fn){const job=mutations.then(fn,fn);mutations=job.catch(()=>{});return job;}
    let previewTimer=null,previewDue=0,previewQueue=[],activePreviewBatches=0;
    function rememberPreview(key,value){previewValues.delete(key);previewValues.set(key,value);while(previewValues.size>40)previewValues.delete(previewValues.keys().next().value);return value;}
    const ids=value=>[...new Set((JSON.stringify(value).match(/note-local-asset:[a-zA-Z0-9-]+/g)||[]).map(s=>s.slice(prefix.length)))];
    const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
    const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
    async function hash(bytes){if(!crypto?.subtle)throw noteDriveError('瀏覽器不支援安全校驗，請更新瀏覽器。','CRYPTO',false);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
    async function parallel(items,fn,limit=3){let i=0,failed=null;const out=new Array(items.length);await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(!failed&&i<items.length){const n=i++;try{out[n]=await fn(items[n],n);}catch(e){failed=e;}}}));if(failed)throw failed;return out;}
    async function initializeCache(){
        if(initialized)return initialized;
        initialized=(async()=>{const saved=await cache.get('snapshot');if(saved&&await hash(enc.encode(JSON.stringify(saved.data)))===saved.hash){
            head=saved.data.head;records=saved.data.records;for(const[id,d]of Object.entries(saved.data.assets))assets.set(id,d);
        }await previewDisk.initialize();} )();return initialized;
    }
    async function saveSnapshot(){const data={head,records,assets:Object.fromEntries(assets)};await cache.put([['snapshot',{data,hash:await hash(enc.encode(JSON.stringify(data)))}]]);}
    async function checkedBlob(d,data){const bytes=typeof data==='string'?un64(data):new Uint8Array(await data.arrayBuffer());if(bytes.length!==d.bytes||await hash(bytes)!==d.key)throw noteDriveError('雲端檔案校驗失敗，未取代原內容。','CHECKSUM',false);return new Blob([bytes],{type:d.mime});}
    async function download(d,priority=0){
        if(binaries.has(d.key))return binaries.get(d.key);
        const saved=await cache.get('binary:'+d.key);
        if(saved instanceof Blob){try{const blob=await checkedBlob(d,saved);binaries.set(d.key,blob);return blob;}catch(_){await cache.remove('binary:'+d.key);}}
        const blob=await checkedBlob(d,await noteDriveServer.downloadBlob(d));await cache.put([['binary:'+d.key,blob]]);binaries.set(d.key,blob);
        // Bound in-memory raw binary cache; persistent cache remains available.
        while(binaries.size>8||[...binaries.values()].reduce((n,b)=>n+b.size,0)>32*1024*1024)binaries.delete(binaries.keys().next().value);
        return blob;
    }
    async function upload(blob,role,signal){
        noteDriveCheckSignal(signal);
        const key=await hash(await blob.arrayBuffer()),mime=blob.type||'application/octet-stream';
        noteDriveCheckSignal(signal);
        let result;
        try{result={file:await noteDriveServer.uploadBlob(blob,role,(done,total)=>{progress({phase:'保存新增原圖',completed:done,total,bytes:transferred+done});})};}
        catch(e){throw noteDriveError(e.message,e.code,e.retryable!==false);}
        transferred+=blob.size;
        noteDriveCheckSignal(signal);
        if(!result.file||result.file.key!==key||result.file.bytes!==blob.size)throw noteDriveError('原檔儲存確認不完整。','CHECKSUM',false);
        await cache.put([['binary:'+key,blob]]);return result.file;
    }
    async function makePreview(value){
        if(!/^data:image\//i.test(value))return null;
        const image=new Image();image.src=value;
        try{
            await noteImageReady(image);
            const scale=Math.min(1,1280/image.naturalWidth,4096/image.naturalHeight,Math.sqrt(3000000/(image.naturalWidth*image.naturalHeight)));
            const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
            canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
            let blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.86));
            if(blob?.size>490000){canvas.width=Math.max(1,Math.round(canvas.width*.65));canvas.height=Math.max(1,Math.round(canvas.height*.65));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.74));}
            if(!blob||blob.size>500000)throw new Error('preview');
            const dimensions={width:image.naturalWidth,height:image.naturalHeight};canvas.width=canvas.height=1;
            return {blob,...dimensions};
        }catch(_){return null;}
    }
    async function encode(value,withPreview=true,depth=0,signal){
        noteDriveCheckSignal(signal);
        const valueHash=await hash(enc.encode(value)),cached=encoded.get(valueHash);
        if(cached&&(!withPreview||cached.preview||!/^data:image\//.test(value)))return cached;
        const saved=await cache.get('encoded:'+valueHash);
        if(saved&&(!withPreview||saved.preview||!/^data:image\//.test(value))){encoded.set(valueHash,saved);return saved;}
        if(depth>6)throw noteDriveError('圖片巢狀封裝過深。','IMAGE_FORMAT',false);
        let descriptor,blob;
        // Existing editor SVGs contain unchanged canonical base64 source images.
        // Keep literal slices so reconstruction is byte-for-byte identical.
        const embedded=/^data:image\/svg\+xml[;,]/i.test(value)&&!/^data:[^,]*;base64,/.test(value)?[...value.matchAll(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi)]:[];
        if(embedded.length){
            const parts=[],sources=[];let offset=0;
            for(const match of embedded){parts.push(value.slice(offset,match.index));sources.push(await encode(match[0],false,depth+1,signal));offset=match.index+match[0].length;}
            parts.push(value.slice(offset));blob=new Blob([JSON.stringify({parts,sources})],{type:'application/json'});descriptor={kind:'svg-template',valueHash};
        }else if(/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value)){
            const comma=value.indexOf(','),header=value.slice(0,comma+1),bytes=un64(value.slice(comma+1));
            if(b64(bytes)!==value.slice(comma+1))throw noteDriveError('圖片 base64 格式不正確。','IMAGE_FORMAT',false);
            blob=new Blob([bytes],{type:header.slice(5,header.indexOf(';'))});descriptor={kind:'data-url',valueHash,header};
        }else{
            let data;try{data=JSON.parse(value);}catch(_){}
            if(data&&typeof data.source==='string'&&/^data:image\//.test(data.source)&&JSON.stringify(data)===value){
                const source=await encode(data.source,false,depth+1,signal);delete data.source;
                // Retain property order exactly, including the source slot.
                const original=JSON.parse(value);original.source={noteDriveSource:source};blob=new Blob([JSON.stringify(original)],{type:'application/json'});descriptor={kind:'json-source',valueHash};
            }else{blob=new Blob([enc.encode(value)],{type:'text/plain'});descriptor={kind:'text',valueHash};}
        }
        descriptor.file=await upload(blob,'asset',signal);
        if(withPreview){const preview=await makePreview(value);noteDriveCheckSignal(signal);if(preview){descriptor.preview=await upload(preview.blob,'preview',signal);descriptor.width=preview.width;descriptor.height=preview.height;rememberPreview(descriptor.preview.key,'data:'+preview.blob.type+';base64,'+b64(new Uint8Array(await preview.blob.arrayBuffer())));}}
        encoded.set(valueHash,descriptor);await cache.put([['encoded:'+valueHash,descriptor]]);return descriptor;
    }
    async function decode(d,depth=0,priority=0){
        if(depth>6)throw noteDriveError('圖片封裝不正確。','IMAGE_FORMAT',false);
        const blob=await download(d.file,priority);let value;
        if(d.kind==='data-url')value=d.header+b64(new Uint8Array(await blob.arrayBuffer()));
        else if(d.kind==='svg-template'){const template=JSON.parse(await blob.text());value=template.parts[0];for(let i=0;i<template.sources.length;i++)value+=await decode(template.sources[i],depth+1,priority)+template.parts[i+1];}
        else if(d.kind==='json-source'){const body=JSON.parse(await blob.text());body.source=await decode(body.source.noteDriveSource,depth+1,priority);value=JSON.stringify(body);}
        else if(d.kind==='text')value=dec.decode(await blob.arrayBuffer());
        else throw noteDriveError('未知的原圖封裝。','IMAGE_FORMAT',false);
        if(await hash(enc.encode(value))!==d.valueHash)throw noteDriveError('圖片重建校驗失敗，原筆記仍保留。','CHECKSUM',false);return value;
    }
    function legacyReader(){throw noteDriveError('舊版雲端已全部搬移完成，新版網站不再讀取舊雲端；可改用完整 JSON 備份補圖。','LEGACY_REMOVED',false);}
    async function ensureAsset(id,signal,priority=0){
        noteDriveCheckSignal(signal);
        if(jobs.has(id))return jobs.get(id);
        const job=(async()=>{
            await initializeCache();const d=assets.get(id);let value=getAsset(id)??await loadAsset(id);
            if(typeof value==='string'&&(!d||await hash(enc.encode(value))===d.valueHash))return value;
            if(!d)throw noteDriveError('找不到完整原圖，已保留草稿。','LOCAL_ASSET',false);
            if(d.kind==='legacy'){
                const reader=legacyReader(d.sourceBook,signal);reader.adoptAssets({[id]:d.source});value=await reader.ensureAsset(id);
            }else value=await decode(d,0,priority);
            noteDriveCheckSignal(signal);
            installAsset(id,value);return value;
        })();jobs.set(id,job);try{return await job;}finally{jobs.delete(id);}
    }
    async function ensureAssetIds(list){await parallel([...new Set(list)],id=>ensureAsset(id));}
    async function receivePreviews(list){
        const checked=[];
        for(const item of list||[]){if(!item.data)continue;try{const blob=await checkedBlob(item.file,item.data);checked.push({file:item.file,blob});rememberPreview(item.file.key,'data:'+blob.type+';base64,'+item.data);}catch(_){/* A display preview cannot invalidate readable note text. */}}
        if(checked.length)await previewDisk.put(checked);
    }
    function schedulePreviews(delay=12){const due=Date.now()+delay;if(!previewTimer||due<previewDue){clearTimeout(previewTimer);previewDue=due;previewTimer=setTimeout(pumpPreviews,delay);}}
    function pumpPreviews(){
        previewTimer=null;
        while(activePreviewBatches<2&&previewQueue.length){
            previewQueue.sort((a,b)=>a.priority-b.priority);const background=previewQueue[0].priority>=10;
            if(background&&(activePreviewBatches||options.isBusy?.()||document.hidden)){schedulePreviews(500);break;}
            const items=[];let bytes=0;
            while(previewQueue.length&&items.length<12){const item=previewQueue[0];if((item.priority>=10)!==background||items.length&&bytes+item.file.bytes>1200000)break;previewQueue.shift();items.push(item);bytes+=item.file.bytes;item.started=true;}
            activePreviewBatches++;
            void(async()=>{
                try{const result=await noteDriveRpc('previews',{files:items.map(x=>x.file)},noteDriveBoot.book,undefined,background?10:1);await receivePreviews(result.files);for(const item of items){const value=previewValues.get(item.file.key);value?item.resolve(value):item.reject(noteDriveError('預覽暫時無法載入，點擊可讀取原圖。'));}}
                catch(e){items.forEach(item=>item.reject(e));}
                finally{activePreviewBatches--;if(previewQueue.length)schedulePreviews();}
            })();
        }
    }
    async function ensurePreview(id,{priority=0}={}){
        const d=assets.get(id);
        if(!d)return getAsset(id)??ensureAsset(id);
        if(!d.preview)throw noteDriveError(d.kind==='legacy'?'舊原圖尚未搬移完成，點擊可先讀取原圖。':'這張圖片未產生預覽，點擊可讀取原圖。','NO_PREVIEW',false);
        const p=d.preview;if(previewValues.has(p.key))return previewValues.get(p.key);
        if(previewJobs.has(p.key)){const existing=previewJobs.get(p.key);existing.priority=Math.min(existing.priority,priority);schedulePreviews();return existing.promise;}
        const entry={file:p,priority,started:false,promise:null};
        entry.promise=(async()=>{const cached=await previewDisk.get(p);if(cached instanceof Blob){try{const blob=await checkedBlob(p,cached);const src='data:'+blob.type+';base64,'+b64(new Uint8Array(await blob.arrayBuffer()));rememberPreview(p.key,src);if(!previewDisk.has(p.key))await previewDisk.put([{file:p,blob}]);return src;}catch(_){await previewDisk.remove(p.key);}}
            return new Promise((resolve,reject)=>{Object.assign(entry,{resolve,reject});previewQueue.push(entry);schedulePreviews();});})();
        previewJobs.set(p.key,entry);try{return await entry.promise;}finally{previewJobs.delete(p.key);}
    }
    async function prefetchPreviews(list){
        await previewDisk.initialize();const wanted=[...new Set(list)].filter(id=>assets.get(id)?.preview&&!previewValues.has(assets.get(id).preview.key)&&!previewDisk.has(assets.get(id).preview.key));
        const bytes=wanted.reduce((n,id)=>n+assets.get(id).preview.bytes,0);
        await Promise.allSettled(wanted.map(id=>ensurePreview(id,{priority:10})));return {bytes,images:wanted.length};
    }
    async function decodePage(item){
        const blob=await checkedBlob(item.file,item.data);let raw=blob;
        if(item.file.mime==='application/gzip'){if(typeof DecompressionStream==='undefined')throw noteDriveError('請更新瀏覽器以讀取壓縮文字。','CODEC',false);raw=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();}
        const page=JSON.parse(await raw.text());if(page.schema!==1||!Array.isArray(page.records)||!page.assets||page.records.length!==item.file.count)throw noteDriveError('筆記文字頁不完整。','CATALOG',false);
        await cache.put([['page:'+item.file.key,{page,file:item.file,pageHash:await hash(enc.encode(JSON.stringify(page)))}]]);return page;
    }
    async function read({verify=false}={}){
        await initializeCache();const result=await noteDriveRpc('read',{knownRevision:verify?null:head.revision,skipPreviews:verify&&loaded,verify});
        if(verify&&result.unchanged)throw noteDriveError('雲端尚未提供可重新校驗的內容，未確認同步完成。','VERIFY');
        if(expected&&result.head.revision!==expected){expected=null;throw noteDriveError('另一個裝置已修改雲端，正在合併。','CONFLICT');}expected=null;
        if(result.format!=='pharmacy-notes-drive-v2')throw noteDriveError('雲端版本不相容。','FORMAT',false);
        if(!result.unchanged){
            const newHead=result.head,pages=new Array(newHead.pages.length);await receivePreviews(result.previews);
            for(const item of result.pages||[])pages[item.index]=await decodePage(item);
            const missing=[];for(let i=0;i<pages.length;i++){if(pages[i])continue;const saved=verify?null:await cache.get('page:'+newHead.pages[i].key);if(saved&&saved.file.proof===newHead.pages[i].proof&&await hash(enc.encode(JSON.stringify(saved.page)))===saved.pageHash)pages[i]=saved.page;else missing.push(i);}
            const groups=[];for(let i=0;i<missing.length;i+=8)groups.push(missing.slice(i,i+8));
            await parallel(groups,async indices=>{const response=await noteDriveRpc('pages',{revision:newHead.revision,indices});for(const item of response.pages)pages[item.index]=await decodePage(item);});
            const nextRecords=pages.flatMap(p=>p.records),nextAssets=Object.assign({},...pages.map(p=>p.assets));
            if(nextRecords.length!==newHead.count||new Set(nextRecords.map(n=>String(n.id))).size!==nextRecords.length||ids(nextRecords).some(id=>!nextAssets[id]))throw noteDriveError('筆記索引不完整或有重複識別碼，未取代本機內容。','CATALOG',false);
            head=newHead;records=nextRecords;assets.clear();for(const[id,d]of Object.entries(nextAssets))assets.set(id,d);await saveSnapshot();
        }
        loaded=true;window.dispatchEvent(new CustomEvent('note-drive-state',{detail:state()}));return {packed:structuredClone(records)};
    }
    async function pageBlob(page){let blob=new Blob([JSON.stringify(page)],{type:'application/json'});if(blob.size>7*1024*1024)throw noteDriveError('單篇筆記文字超過 7 MB，請拆成數篇；圖片另存，不計入這個大小。','PAGE_TOO_LARGE',false);if(typeof CompressionStream!=='undefined'&&blob.size>4096){const zipped=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();if(zipped.size<blob.size*.95)blob=new Blob([zipped],{type:'application/gzip'});}return blob;}
    function write(nextRecords){return serialize(()=>writeNow(nextRecords));}
    async function writeNow(nextRecords){
        if(!loaded)throw noteDriveError('請先完整讀取文字再儲存。','NOT_READY');
        const nextAssets={},list=ids(nextRecords);transferred=0;
        await parallel(list,async id=>{
            const d=assets.get(id),value=getAsset(id);
            const matches=d&&(typeof value!=='string'||await hash(enc.encode(value))===d.valueHash);
            if(matches&&!(d.kind==='legacy'&&restoredLegacy.has(id)&&typeof value==='string')){nextAssets[id]=d;return;}
            const original=value??await loadAsset(id);if(typeof original!=='string')throw noteDriveError('這張原圖尚未準備完成，草稿仍保留。','LOCAL_ASSET',false);
            nextAssets[id]=await encode(original);
        },2);
        // Fixed note-count pages avoid repartitioning the whole catalog on each keystroke.
        const groups=[];let group=[],size=0;
        for(const record of nextRecords){const length=enc.encode(JSON.stringify(record)).length;if(group.length&&(group.length>=120||size+length>700000)){groups.push(group);group=[];size=0;}group.push(record);size+=length;}if(group.length)groups.push(group);
        const pages=await parallel(groups,async group=>{
            const page={schema:1,records:group,assets:Object.fromEntries(ids(group).map(id=>[id,nextAssets[id]]))};
            const blob=await pageBlob(page),key=await hash(await blob.arrayBuffer()),previous=head.pages.find(p=>p.key===key);
            if(previous)return {file:previous};
            if(blob.size<=260000)return {inline:{key,bytes:blob.size,mime:blob.type,data:b64(new Uint8Array(await blob.arrayBuffer()))}};
            return {file:await upload(blob,'catalog')};
        });
        const preload=[];for(const id of list){const p=nextAssets[id].preview;if(p&&!preload.some(d=>d.key===p.key))preload.push(p);if(preload.length===4)break;}
        progress({phase:'保存筆記文字',completed:0,total:1,bytes:transferred});
        const result=await noteDriveRpc('commit',{baseRevision:head.revision,pages,preload});
        head=result.head;records=structuredClone(nextRecords);assets.clear();for(const[id,d]of Object.entries(nextAssets)){assets.set(id,d);if(d.kind!=='legacy')restoredLegacy.delete(id);}expected=head.revision;
        await saveSnapshot();progress({phase:'已確認雲端版本',completed:1,total:1,bytes:transferred});window.dispatchEvent(new CustomEvent('note-drive-state',{detail:state()}));return result;
    }
    function state(){const list=ids(records),remaining=list.filter(id=>assets.get(id)?.kind==='legacy').length;return {loaded,records:records.length,images:list.length,remaining,revision:head.revision};}
    async function importLegacy(signal){
        if(!loaded||records.length)throw noteDriveError('只可將舊雲端匯入空白科目，避免覆蓋現有筆記。','IMPORT',false);
        const reader=legacyReader(noteDriveBoot.book,signal),result=await reader.read();noteDriveCheckSignal(signal);
        if(result.packed){for(const[id,source]of Object.entries(reader.exportAssetDescriptors()))assets.set(id,{kind:'legacy',valueHash:source.key,sourceBook:noteDriveBoot.book,source});return {packed:result.packed};}
        return result;
    }
    async function matchBackupAssets(entries,signal){
        const byHash=new Map(),fingerprints={},aliases={},recovered=new Set();
        for(const[id,d]of assets){fingerprints[id]=d.valueHash;if(!byHash.has(d.valueHash))byHash.set(d.valueHash,[]);byHash.get(d.valueHash).push(id);}
        for(const[id,value]of entries){
            noteDriveCheckSignal(signal);const key=await hash(enc.encode(value));fingerprints[id]=key;
            const matches=byHash.get(key)||[];
            for(const target of matches)if(assets.get(target)?.kind==='legacy'){installAsset(target,value);restoredLegacy.add(target);recovered.add(target);}
            if(matches.length)aliases[id]=matches[0];
        }
        return {aliases,fingerprints,recovered:recovered.size};
    }
    async function migrateOriginals(onProgress=()=>{},shouldStop=()=>false,signal){
        if(!loaded)throw noteDriveError('請先載入科目。');
        const pending=ids(records).filter(id=>assets.get(id)?.kind==='legacy'),failures=[];let done=0;
        for(let i=0;i<pending.length;i+=4){
            if(shouldStop())break;noteDriveCheckSignal(signal);
            const group=pending.slice(i,i+4),changes=[];let fatal=null;
            await parallel(group,async id=>{
                if(fatal)return;
                try{const value=await ensureAsset(id,signal);changes.push([id,await encode(value,true,0,signal)]);}
                catch(e){if(['LEGACY_PART_MISSING','PART','CHECKSUM'].includes(e.code))failures.push({id,message:e.message});else fatal=e;}
            },2);
            noteDriveCheckSignal(signal);
            if(changes.length)await serialize(async()=>{
                noteDriveCheckSignal(signal);
                const previous=new Map(changes.map(([id])=>[id,assets.get(id)]));changes.forEach(([id,d])=>assets.set(id,d));
                try{await writeNow(records);}catch(e){previous.forEach((d,id)=>assets.set(id,d));throw e;}
            });
            done+=changes.length;onProgress(done,pending.length,failures.length);window.dispatchEvent(new CustomEvent('note-drive-state',{detail:state()}));
            if(fatal)throw fatal;
        }
        return {...state(),failed:failures.length,failures};
    }
    const api={read,write,initializeCache,ensureAsset,ensureAssetIds,ensurePreview,prefetchPreviews,
        snapshotAssetDescriptors:list=>Object.fromEntries(list.filter(id=>assets.has(id)).map(id=>[id,assets.get(id)])),
        restoreAssetDescriptors:descriptors=>{for(const[id,d]of Object.entries(descriptors||{}))if(!assets.has(id))assets.set(id,d);},
        peekPreview:id=>previewValues.get(assets.get(id)?.preview?.key),previewBytes:id=>assets.get(id)?.preview?.bytes||0,
        primeRecords:()=>{},rememberRemoteIds:list=>list.forEach(id=>confirmed.add(id)),hasRemoteAsset:id=>assets.has(id)||confirmed.has(id),isSupported:()=>true,needsMigration:()=>false,
        legacyWrite:()=>{throw noteDriveError('此工作台只使用 Drive 新版儲存。','FORMAT',false);},state,importLegacy,migrateOriginals,matchBackupAssets,
        canReleaseAsset:id=>assets.has(id)&&assets.get(id).kind!=='legacy'&&!jobs.size,
        dimensions:id=>({width:assets.get(id)?.width,height:assets.get(id)?.height}),
        assetDescriptor:id=>assets.get(id),isBusy:()=>!!options.isBusy?.()};
    window.noteDriveCloud=api;return api;
}
function createNoteChunkCloud(options){return createNoteDriveCloud(options);}


/* Source: 60-persistence.js */
    // 草稿、離線快取與雲端佇列分開保存；讀取失敗時絕不以空陣列覆蓋雲端。
    const notePersistence = (() => {
        const $ = id => document.getElementById(id);
        const tokenPrefix = 'note-local-asset:';
        let hash = 2166136261;
        for (const c of (noteDriveBoot.workspace||noteDriveBoot.appUrl||SCRIPT_URL)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
        const scope = 'pharmacy-notes-drive-v2-' + noteDriveBoot.book + '-' + (hash >>> 0).toString(36);
        const tailKey = scope + ':draft';
        const assets = new Map(), byValue = new Map(), pendingAssets = new Map(), htmlCache = new WeakMap(), imageCache = new WeakMap(), packedNoteCache=new WeakMap();
        let db = null, dbError = '', localError = '', cloudError = '', loading = true, ready = false, dirty = false, running = false;
        let workspace = [], base = [], draft = null, stamp = 0, durableStamp = 0, seq = 0, ackSeq = 0, savingLocal = false;
        let captureTimer = null, checkpointTimer = null, syncTimer = null, retryTimer = null, retryCount = 0, firstDirtyAt = 0;
        let editSession = null, restoring = false, ending = false, lastCloudAt = '', lastLocalAt = '', tailSafe = false;
        let firstCaptureAt = 0, firstCheckpointAt = 0, tailStamp = -1, tailTimer = null;
        let initialized = false, lastStatus = '', lastDetailTimes = '', viewError = '', editorPending = false, capturePending = false;
        let cloudStage = '', uploadBytes = 0, originalUploadBytes = 0;
        const comparisonCache = new WeakMap();
        let chunkProgress = null;
        let cloudVerified = false, lastContentAt = '', upgradePending = false;
        let syncFinished = Promise.resolve();
        const chunkCloud = createNoteChunkCloud({endpoint: SCRIPT_URL, space: scope,
            getAsset: id => assets.get(id),
            loadAsset: async id => {if(!db)return undefined;const value=await request(db.transaction('assets').objectStore('assets').get(id));if(typeof value==='string'){assets.set(id,value);byValue.set(value,id);}return value;},
            installAsset: (id,value) => { if (assets.get(id)!==value) {assets.set(id,value);pendingAssets.set(id,value);} byValue.set(value,id);void persist(); },
            progress: value => {chunkProgress=value;cloudStage=value.phase;uploadBytes=value.bytes;status();},
            isBusy:()=>running||dirty||editorPending
        });
        const uid = () => crypto.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
        const request = req => new Promise((resolve,reject) => { req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
        const transaction = tx => new Promise((resolve,reject) => { tx.oncomplete=resolve; tx.onerror=tx.onabort=()=>reject(tx.error || new Error('本機寫入未完成')); });
        const stampNow = () => stamp = Math.max(Date.now(), stamp + 1);
        function asset(value) {
            if (!value) return value;
            let id=byValue.get(value);
            if (!id) { id=uid(); byValue.set(value,id); assets.set(id,value); pendingAssets.set(id,value); }
            return tokenPrefix+id;
        }
        function resolveAsset(value) {
            if (typeof value !== 'string' || !value.startsWith(tokenPrefix)) return value;
            const found=assets.get(value.slice(tokenPrefix.length));
            if (found == null && chunkCloud.hasRemoteAsset(value.slice(tokenPrefix.length))) return value;
            if (found == null) throw new Error('部分圖片草稿尚未完整寫入，已保留可用的備份');
            return found;
        }
        function packImages(clone, original = null) {
            const originals=original?.querySelectorAll('img');
            clone.querySelectorAll('img').forEach((img,index)=>{
                const real=originals?.[index] || img;
                let cache=imageCache.get(real); if (!cache) { cache={}; imageCache.set(real,cache); }
                for (const name of ['src','data-note-image-edit']) {
                    const value=real.getAttribute(name);
                    if (!value || value.startsWith(tokenPrefix) || (name==='src' && !value.startsWith('data:'))) continue;
                    if (cache[name]?.value !== value) cache[name]={value,token:asset(value)};
                    img.setAttribute(name,cache[name].token);
                }
            });
        }
        function unpackHtml(html) {
            if (!html?.includes(tokenPrefix)) return html || '';
            // token 僅由本程式寫入屬性值；替換時保留 HTML 屬性跳脫。
            return html.replace(/note-local-asset:([a-zA-Z0-9-]+)/g,(_,id)=>{
                const value=assets.get(id); if(value==null && chunkCloud.hasRemoteAsset(id))return tokenPrefix+id;
                if (value==null) throw new Error('部分圖片草稿尚未完整寫入');
                return escapeAttribute(value);
            });
        }
        function sameShape(a,b){
            if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
            const ak=Object.keys(a),bk=Object.keys(b);if(ak.length!==bk.length)return false;for(let i=0;i<ak.length;i++)if(ak[i]!==bk[i]||!sameShape(a[ak[i]],b[bk[i]]))return false;return true;
        }
        function copyShape(value){if(!value||typeof value!=='object')return value;return Array.isArray(value)?value.map(copyShape):Object.fromEntries(Object.entries(value).map(([key,v])=>[key,copyShape(v)]));}
        function packNote(note) {
            if (isRecoveryCarrier(note)) return JSON.parse(JSON.stringify({...note,record:{...note.record,...(note.record.snapshot?{snapshot:packNote(note.record.snapshot)}:{})}}));
            const prior=packedNoteCache.get(note);if(prior&&sameShape(note,prior.source))return copyShape(prior.packed);
            const packed={...note};
            if (note.text) {
                let cached=htmlCache.get(note);
                if (!cached || cached.source!==note.text) {
                    const t=document.createElement('template');t.innerHTML=sanitizeNoteHtml(note.text);packImages(t.content);
                    cached={source:note.text,text:t.innerHTML};htmlCache.set(note,cached);
                }
                packed.text=cached.text;
            }
            if (Array.isArray(note.images)) packed.images=note.images.map(src=>typeof src==='string'&&src.startsWith('data:')?asset(src):src);
            if (note.image?.startsWith?.('data:')) packed.image=asset(note.image);
            if (note.galleryImageEdits) packed.galleryImageEdits=Object.fromEntries(Object.entries(note.galleryImageEdits).map(([k,v])=>[k,typeof v==='string'&&v.startsWith(tokenPrefix)?v:asset(JSON.stringify(v))]));
            const result=JSON.parse(JSON.stringify(packed));packedNoteCache.set(note,{source:copyShape(note),packed:copyShape(result)});return result;
        }
        function unpackNote(note) {
            if (isRecoveryCarrier(note)) return {...note,record:{...note.record,...(note.record.snapshot?{snapshot:unpackNote(note.record.snapshot)}:{})}};
            const n={...note}; if (n.text) n.text=unpackHtml(n.text);
            if (Array.isArray(n.images)) n.images=n.images.map(resolveAsset);
            if (n.image) n.image=resolveAsset(n.image);
            if (n.galleryImageEdits) n.galleryImageEdits=Object.fromEntries(Object.entries(n.galleryImageEdits).map(([k,v])=>[k,typeof v==='string'?(resolveAsset(v).startsWith(tokenPrefix)?v:JSON.parse(resolveAsset(v))):v]));
            return n;
        }
        const packPayload = () => buildSavePayload().map(packNote);
        const unpackPayload = payload => payload.map(unpackNote);
        const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
        const stable = value => JSON.stringify(value, (_,v) => v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v);
        function comparable(note) {
            if (!note) return '';
            if (comparisonCache.has(note)) return comparisonCache.get(note);
            const n=unpackNote(note);
            if (n.text?.includes('<img')) {
                const t=document.createElement('template');t.innerHTML=n.text;
                for(const img of t.content.querySelectorAll('img')) {
                    const metadata=JSON.parse(img.getAttribute('data-note-image-edit'));
                    const identity=noteImageEditor.imageIdentity(img.getAttribute('src'),metadata);
                    img.setAttribute('src',identity?.key || noteImageEditor.sourceKey(img.getAttribute('src')||''));
                    if(identity&&!identity.plain)img.setAttribute('data-note-image-edit',stable({doc:identity.doc}));
                    else if(identity?.plain)img.removeAttribute('data-note-image-edit');
                }
                n.text=t.innerHTML;
            }
            if(n.galleryImageEdits||['images','galleryImages','pastedImages','uploadedImages','imageUrls'].some(name=>n[name]?.length)||n.image) {
                const edits={...n.galleryImageEdits};
                for(const name of ['images','galleryImages','pastedImages','uploadedImages','imageUrls','image']) {
                    const sources=name==='image'?[n.image]:n[name];if(!Array.isArray(sources))continue;
                    const values=sources.map(src=>{if(!src)return src;const key=noteImageEditor.galleryKey(src),metadata=edits[key],identity=noteImageEditor.imageIdentity(src,metadata);if(identity)delete edits[key];return 'note-comparable:'+stable({source:identity?.key||noteImageEditor.sourceKey(src),doc:identity&&!identity.plain?identity.doc:null});});
                    n[name]=name==='image'?values[0]:values;
                }
                n.galleryImageEdits=edits;
            }
            const result=stable(packNote(n));comparisonCache.set(note,result);return result;
        }
        function sameNote(a,b) {
            if(same(a,b))return true;
            try{return comparable(a)===comparable(b);}catch(_){return false;}
        }
        function matchesStoredNote(expected,actual) {
            return !!actual && Object.keys(expected).every(key=>stable(expected[key])===stable(actual[key]));
        }
        function status() {
            const protectedLocal=(tailSafe || durableStamp>=stamp)&&!capturePending;
            const imageDraft=typeof noteImageEditor!=='undefined'&&noteImageEditor.isOpen();
            const matched=cloudVerified&&ready&&seq===ackSeq&&!dirty&&!running&&!editorPending&&!capturePending&&!imageDraft;
            let text,kind;
            if (loading) { text=workspace.length?'已載入本機備份 · 背景檢查雲端':'正在讀取雲端…';kind='syncing'; }
            else if (viewError) {text='雲端已連線 · 畫面更新異常';kind='error';}
            else if (localError) {text='本機備份未完成';kind='error';}
            else if (cloudError) {text=stamp>0?(protectedLocal?'已存本機 · 雲端待重試':'雲端待重試 · 本機儲存中'):'雲端讀取失敗 · 待重試';kind='error';}
            else if (imageDraft) {text='圖片編輯中 · 尚未套用到雲端';kind='syncing';}
            else if (dirty || running || editorPending || capturePending) {const phase=cloudStage==='整理圖片資料'?'整理圖片…':cloudStage==='上傳筆記'?'上傳雲端中…':cloudStage==='確認雲端已保存內容'?'確認雲端內容…':'同步中…';text=protectedLocal?'已存本機 · '+phase:'正在儲存…';kind='syncing';}
            else if (matched) {text='雲端同步完成 · 已確認內容一致';kind='success';}
            else {text='已存本機 · 等待雲端內容確認';kind='syncing';}
            const key=kind+text;
            if (lastStatus!==key) {setSyncStatus(kind,text);lastStatus=key;}
            const hint=$('note-autosave-hint');
            if (hint) {
                const msg=imageDraft?'圖片編輯草稿會保留；套用圖片後自動同步。':`${protectedLocal?'本機草稿已儲存':'正在保存草稿…'}${cloudError?' · 雲端連線後會自動重試':dirty||running?' · 等待雲端同步':' · 編輯會自動儲存，關閉不會捨棄修改'}`;
                if (hint.textContent!==msg) hint.textContent=msg;
            }
            const detail=$('sync-detail-message');
            const detailText=viewError || localError || cloudError || (imageDraft?'圖片修改目前是本機草稿，套用到筆記後才會上傳雲端。':cloudStage?cloudStage+'…':loading?'正在檢查筆記文字更新，圖片會按需要讀取。':matched?'已重新讀取雲端內容並確認與目前筆記一致。':'目前內容尚未確認全部存到雲端；本機草稿會保留。');
            if (detail && detail.textContent!==detailText) detail.textContent=detailText;
            const size=$('sync-detail-size');
            const sizeText=chunkProgress?`本次新增傳輸 ${(uploadBytes/1000000).toFixed(2)} MB；${chunkProgress.phase}。原圖與畫記另外保存，不隨整本筆記重送。`:'Google Drive 私人儲存：文字與預覽優先，編輯或放大時才讀取原圖。';
            if(size && size.textContent!==sizeText)size.textContent=sizeText;
            const times=$('sync-detail-times');
            const timesKey=JSON.stringify([matched,imageDraft,lastContentAt,lastCloudAt,lastLocalAt]);
            if (times && timesKey!==lastDetailTimes) {lastDetailTimes=timesKey;times.textContent=`內容狀態：${matched?'已確認與雲端一致':imageDraft?'圖片草稿尚未套用':'尚待確認／同步'}\n最近內容修改：${lastContentAt?new Date(lastContentAt).toLocaleString('zh-TW'):'本次尚無內容修改'}\n雲端讀回確認：${lastCloudAt?new Date(lastCloudAt).toLocaleString('zh-TW'):'尚未確認'}\n本機快取寫入：${lastLocalAt?new Date(lastLocalAt).toLocaleTimeString('zh-TW'):'尚未完成'}（快取時間不代表有新的未同步內容）`;}

        }
        function installUi() {
            if ($('sync-details')) return;
            $('sync-status').tabIndex=0;
            document.body.insertAdjacentHTML('beforeend','<div id="sync-details" hidden><strong>自動儲存狀態</strong><p id="sync-detail-message"></p><p id="sync-detail-size"></p><small id="sync-detail-times"></small><div class="sync-detail-actions"><button type="button" id="sync-retry">立即重試</button><button type="button" id="sync-backup">下載完整備份</button><button type="button" id="sync-text-backup">下載純文字備份</button><button type="button" id="sync-detail-close">關閉</button></div></div>');
            const toggle=()=>{$('sync-details').hidden=!$('sync-details').hidden;status();positionToolbarSyncDetails();};
            $('sync-status').addEventListener('click',toggle);$('sync-status').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
            $('sync-detail-close').onclick=()=>$('sync-details').hidden=true;
            $('sync-retry').onclick=()=>{capture();checkpoint();clearTimeout(retryTimer);retryCount=0;void synchronize(true);};
            $('sync-backup').onclick=downloadBackup;
            $('sync-text-backup').onclick=downloadTextBackup;
        }
        let imageObserver=null,noteObserver=null,activeImageLoads=0,imageGeneration=0,scanTimer=null,warmTimer=null,warmingActive=false;
        let lookahead=Math.max(2400,innerHeight*3),scrollDirection=1,lastScrollY=scrollY,lastScrollTime=performance.now(),warmCursor=0,warmBytes=0,warmCount=0;
        let observerMargin='',warmIds=[];
        const queuedImages=new Map(),imageLoads=new WeakMap(),preparedImages=new Set(),preparedNotes=new Set(),nearNotes=new Set(),loadedImages=new Set();
        const imageSlots=new WeakMap(),recentImageSizes=new Map();
        const imageId=image=>image.dataset.cloudAsset||image.dataset.cloudOriginal;
        const validImageSize=size=>size&&Number.isFinite(size.width)&&Number.isFinite(size.height)&&size.width>0&&size.height>0;
        function readerImageSize(image,id){
            const cloud=chunkCloud.dimensions(id);
            if(validImageSize(cloud))return cloud;
            const remembered=recentImageSizes.get(id);if(remembered)return remembered;
            const attrs={width:Number(image.getAttribute('width')),height:Number(image.getAttribute('height'))};
            return validImageSize(attrs)?attrs:null;
        }
        function imageSlotChanged(image,size){
            const current=imageSlots.get(image);
            return validImageSize(size)&&(current?.width!==size.width||current?.height!==size.height);
        }
        function reserveImageSlot(image,size){
            imageSlots.set(image,size);image.dataset.readerImageSized='1';
            image.style.setProperty('--reader-image-width',size.width+'px');
            image.style.aspectRatio=size.width+'/'+size.height;
            if(!image.hasAttribute('width'))image.setAttribute('width',size.width);
            if(!image.hasAttribute('height'))image.setAttribute('height',size.height);
        }
        function readerLineAt(list){
            const bounds=list.getBoundingClientRect(),dock=document.getElementById('note-reader-dock')||document.getElementById('note-page-dock');
            const headerBottom=Math.max(0,document.querySelector('.top-bar')?.getBoundingClientRect().bottom||0);
            // Leave a newly opened page at its start until the reader scrolls into it.
            if(bounds.top>=headerBottom-1)return null;
            const top=headerBottom;
            const bottom=Math.min(innerHeight,bounds.bottom,dock&&!dock.hidden?dock.getBoundingClientRect().top:innerHeight);
            if(bottom-top<8||bounds.right<=bounds.left)return null;
            const middle=(bounds.left+bounds.right)/2;
            let fallback=null;
            for(const part of [.4,.23,.57,.08,.74,.9,.98]){
                const y=top+(bottom-top)*part,hit=document.elementFromPoint(middle,y);
                const content=hit?.closest('.note-content-area');if(!content||!list.contains(content))continue;
                const block=hit.closest('img,.note-title-display,p,li,td,th,blockquote,pre')||content;
                if(!fallback&&content.contains(block))fallback={node:block,box:block,top:block.getBoundingClientRect().top};
                if(!hit.closest('.note-text,.note-title-display')||hit.closest('img'))continue;
                const rect=content.getBoundingClientRect();
                for(const offset of [.09,.48,.83]){
                    const range=caretRangeFromPoint(rect.left+rect.width*offset,y),node=range?.startContainer;
                    if(node?.nodeType!==3||!node.data.trim()||!content.contains(node))continue;
                    const start=Math.min(range.startOffset,node.length-1);
                    range.setStart(node,start);range.setEnd(node,start+1);
                    const line=range.getBoundingClientRect();
                    if(line.height>0&&line.top<bottom&&line.bottom>top&&y>=line.top-6&&y<=line.bottom+6)return {node,box:range,top:line.top};
                }
            }
            return fallback;
        }
        function changeReaderImageLayout(images,apply){
            // Snapshot the live line only for mutations that can move visible content.
            // No saved scroll position survives a load, user scroll, or page turn.
            const list=scrollY>0&&!document.hidden&&!noteBrowse.isFlipping()&&!document.querySelector('.modal-overlay.active, .container[inert]')&&document.getElementById('note-list');
            const anchor=list&&images.some(image=>list.contains(image)&&image.getBoundingClientRect().top<innerHeight)?readerLineAt(list):null;
            apply();
            if(!anchor?.node.isConnected||!list.contains(anchor.node))return;
            // Measuring after layout also accounts for any native scroll anchoring already applied.
            const delta=anchor.box.getBoundingClientRect().top-anchor.top;
            if(Number.isFinite(delta)&&Math.abs(delta)>.5)window.scrollBy({top:delta,left:0,behavior:'instant'});
        }
        function resetRenderedImages(){
            imageGeneration++;imageObserver?.disconnect();noteObserver?.disconnect();imageObserver=noteObserver=null;observerMargin='';
            clearTimeout(scanTimer);clearTimeout(warmTimer);scanTimer=warmTimer=null;
            queuedImages.clear();preparedImages.clear();preparedNotes.clear();nearNotes.clear();loadedImages.clear();warmIds=[];warmCursor=warmBytes=warmCount=0;
        }
        function imageDistance(image){
            const rect=image.getBoundingClientRect();return rect.bottom<0?-rect.bottom:rect.top>innerHeight?rect.top-innerHeight:0;
        }
        function queueImage(image){
            if(!image.isConnected||!image.dataset.cloudAsset||imageLoads.has(image)||image.classList.contains('cloud-image-error'))return;
            const distance=imageDistance(image);queuedImages.set(image,distance);
        }
        function pumpImages(){
            if(noteBrowse.isFlipping())return;
            if(document.body.dataset.noteView==='home')return;
            if(!queuedImages.size)return;
            const sorted=[...queuedImages].filter(([image])=>image.isConnected).sort((a,b)=>a[1]-b[1]);
            queuedImages.clear();for(const pair of sorted)queuedImages.set(...pair);
            while(activeImageLoads<16&&queuedImages.size){
                const [image,distance]=queuedImages.entries().next().value;queuedImages.delete(image);
                if(!image.isConnected||!image.dataset.cloudAsset)continue;
                activeImageLoads++;
                hydrateRenderedImage(image,distance<innerHeight?0:2).catch(()=>{}).finally(()=>{activeImageLoads--;pumpImages();});
            }
        }
        function observeImages(){
            if(typeof IntersectionObserver==='undefined')return;
            const back=Math.max(1200,Math.round(lookahead*.45)),margin=scrollDirection>0?`${back}px 0px ${Math.round(lookahead)}px 0px`:`${Math.round(lookahead)}px 0px ${back}px 0px`;
            if(margin===observerMargin&&imageObserver)return;observerMargin=margin;
            imageObserver?.disconnect();noteObserver?.disconnect();
            imageObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)queueImage(entry.target);else queuedImages.delete(entry.target);}pumpImages();},{rootMargin:margin});
            noteObserver=new IntersectionObserver(entries=>{
                for(const entry of entries){const note=entry.target;if(entry.isIntersecting){nearNotes.add(note);for(const image of [...note.querySelectorAll('img[data-cloud-asset]')].slice(0,8))queueImage(image);}else nearNotes.delete(note);}
                pumpImages();
            },{rootMargin:margin});
            for(const image of preparedImages)if(image.isConnected&&image.dataset.cloudAsset)imageObserver.observe(image);
            for(const note of preparedNotes)if(note.isConnected)noteObserver.observe(note);
        }
        function trimRenderedImages(){
            const distance=Math.max(6000,innerHeight*8);
            for(const image of loadedImages){
                if(!image.isConnected){loadedImages.delete(image);continue;}
                const note=image.closest('.note-item'),rect=(note||image).getBoundingClientRect();
                const far=rect.bottom < -distance||rect.top>innerHeight+distance;
                if(!far&&!(loadedImages.size>64&&imageDistance(image)>innerHeight*3))continue;
                const id=imageId(image);if(!id||!imageSlots.has(image))continue;
                image.dataset.cloudAsset=id;image.removeAttribute('src');image.classList.add('cloud-image-pending');
                const frame=image.closest('.note-image-frame');if(frame)frame.dataset.viewSrc=tokenPrefix+id;
                loadedImages.delete(image);imageObserver?.observe(image);
            }
        }
        function scheduleImageScan(){
            if(document.body.dataset.noteView==='home')return;
            if(scanTimer)return;scanTimer=setTimeout(()=>{
                scanTimer=null;observeImages();
                for(const note of nearNotes)for(const image of note.querySelectorAll('img[data-cloud-asset]')){
                    const rect=image.getBoundingClientRect();if(rect.top<innerHeight+lookahead&&rect.bottom>-lookahead)queueImage(image);
                }
                pumpImages();trimRenderedImages();
            },90);
        }
        function scheduleWarm(delay=1200){clearTimeout(warmTimer);warmTimer=setTimeout(warmPreviews,delay);}
        async function warmPreviews(){
            if(noteBrowse.isFlipping())return;
            warmTimer=null;if(warmingActive){scheduleWarm(400);return;}
            if(document.hidden||navigator.connection?.saveData||document.body.dataset.noteView==='home')return;
            if(running||dirty||editorPending){scheduleWarm(900);return;}
            const budget=(navigator.deviceMemory&&navigator.deviceMemory<=4?12:24)*1024*1024;
            if(warmBytes>=budget||warmCount>=240||warmCursor>=warmIds.length)return;
            const generation=imageGeneration,batch=warmIds.slice(warmCursor,warmCursor+12);warmCursor+=batch.length;warmingActive=true;
            try{const result=await chunkCloud.prefetchPreviews(batch);warmBytes+=result.bytes;warmCount+=result.images;}finally{warmingActive=false;if(generation===imageGeneration&&warmCursor<warmIds.length)scheduleWarm(120);else if(generation!==imageGeneration)scheduleWarm(1200);}
        }
        window.addEventListener('scroll',()=>{
            const now=performance.now(),delta=scrollY-lastScrollY,elapsed=Math.max(16,now-lastScrollTime);
            if(Math.abs(delta)>4)scrollDirection=delta>0?1:-1;
            const target=Math.max(innerHeight*3,2400,Math.min(8000,Math.abs(delta)/elapsed*1800+innerHeight*2));
            if(Math.abs(target-lookahead)>700)lookahead=target;
            lastScrollY=scrollY;lastScrollTime=now;scheduleImageScan();
        },{passive:true});
        window.addEventListener('resize',()=>{lookahead=Math.max(2400,innerHeight*3);scheduleImageScan();},{passive:true});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden){scheduleImageScan();scheduleWarm(500);}});
        function prepareRenderedImages(root){
            if(root.id==='note-list'){
                for(const image of preparedImages)if(!image.isConnected){imageObserver?.unobserve(image);preparedImages.delete(image);queuedImages.delete(image);loadedImages.delete(image);}
                for(const note of preparedNotes)if(!note.isConnected){noteObserver?.unobserve(note);preparedNotes.delete(note);nearNotes.delete(note);}
            }
            const sizing=[],connected=[];
            root.querySelectorAll('img').forEach(image=>{
                const source=image.getAttribute('src')||'';
                if(!source.startsWith(tokenPrefix)&&!image.dataset.cloudAsset&&!image.dataset.cloudOriginal)return;
                if(source.startsWith(tokenPrefix)){image.dataset.cloudAsset=source.slice(tokenPrefix.length);image.removeAttribute('src');}
                preparedImages.add(image);const id=imageId(image),size=readerImageSize(image,id);
                if(imageSlotChanged(image,size))sizing.push([image,size]);
                if(image.dataset.cloudAsset&&!image.classList.contains('cloud-image-pending')){image.classList.add('cloud-image-pending');image.title='圖片會提前載入；點一下可讀取原圖';}
                if(image.isConnected)connected.push([image,id]);
            });
            if(sizing.length){
                const apply=()=>{for(const [image,size] of sizing)reserveImageSlot(image,size);};
                if(root.isConnected)changeReaderImageLayout(sizing.map(([image])=>image),apply);else apply();
            }
            if(!root.isConnected)return;
            for(const [image,id] of connected){
                const note=image.closest('.note-item');if(note)preparedNotes.add(note);
                if(chunkCloud.peekPreview(id)){const rect=(note||image).getBoundingClientRect();if(rect.top<innerHeight+lookahead&&rect.bottom>-lookahead)queueImage(image);}
            }
            observeImages();pumpImages();
            if(typeof IntersectionObserver==='undefined')for(const image of preparedImages)if(imageDistance(image)<lookahead)queueImage(image);
            const visibleIds=[...preparedImages].map(imageId),adjacentIds=noteBrowse.adjacentImageIds();
            warmIds=[...new Set([...visibleIds.slice(0,12),...adjacentIds,...visibleIds.slice(12)].filter(id=>chunkCloud.previewBytes(id)))];
            scheduleWarm();scheduleImageScan();
        }
        async function hydrateRenderedImage(image,priority=0){
            if(!image)return '';
            if(imageLoads.has(image))return imageLoads.get(image);
            const id=image.dataset.cloudAsset;if(!id)return image.getAttribute('src')||'';
            const generation=imageGeneration;
            const job=(async()=>{
                image.classList.remove('cloud-image-error');
                try{
                    const source=await chunkCloud.ensurePreview(id,{priority});
                    const decoded=new Image();decoded.src=source;await noteImageReady(decoded);
                    if(image.isConnected&&generation===imageGeneration&&imageId(image)===id){
                        const size=readerImageSize(image,id)||{width:decoded.naturalWidth,height:decoded.naturalHeight};
                        const changed=imageSlotChanged(image,size);
                        const apply=()=>{
                            if(changed)reserveImageSlot(image,size);
                            image.dataset.cloudOriginal=id;image.loading='eager';image.src=source;
                            image.classList.remove('cloud-image-pending','cloud-image-error');delete image.dataset.cloudAsset;
                            image.title='點一下讀取原圖並放大';imageObserver?.unobserve(image);loadedImages.add(image);
                            const frame=image.closest('.note-image-frame');if(frame)frame.dataset.viewSrc=source;
                        };
                        if(changed||!imageSlots.has(image))changeReaderImageLayout([image],apply);else apply();
                        if(validImageSize(size)){
                            recentImageSizes.delete(id);recentImageSizes.set(id,size);
                            if(recentImageSizes.size>512)recentImageSizes.delete(recentImageSizes.keys().next().value);
                        }
                    }
                    return source;
                }catch(e){if(image.isConnected&&generation===imageGeneration){image.classList.add('cloud-image-error');image.title='預覽暫時無法讀取；點一下可重試原圖，文字與同步仍可使用。';imageObserver?.unobserve(image);}throw e;}
            })();imageLoads.set(image,job);try{return await job;}finally{imageLoads.delete(image);}
        }
        async function renderedImageSource(element) {
            const image=element.matches('img')?element:element.querySelector('img');
            try{const id=image?.dataset.cloudOriginal||image?.dataset.cloudAsset;return id?await chunkCloud.ensureAsset(id):await hydrateRenderedImage(image);}catch(e){showPreviewModeToast('這張圖片尚未載入，請稍後再點一次重試。');return '';}
        }
        async function prepareNoteForEditing(note) {return packNote(note);}
        async function resolveEditorValue(value){return typeof value==='string'&&value.startsWith(tokenPrefix)?chunkCloud.ensureAsset(value.slice(tokenPrefix.length)):value;}
        function imageSearchIds(note){return tokenIds(packNote(note)).filter(id=>{const d=chunkCloud.assetDescriptor(id);return d&&(d.preview||d.kind==='data-url'&&/^image\//.test(d.file?.mime||''));});}

        async function openDatabase() {
            const req=indexedDB.open(scope,1);
            req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('assets');};
            db=await request(req);db.onversionchange=()=>db.close();
        }
        function tokenIds(value) {
            const ids=new Set();
            function visit(item){
                if(typeof item==='string'){for(const match of item.matchAll(/note-local-asset:([a-zA-Z0-9-]+)/g))ids.add(match[1]);}
                else if(Array.isArray(item))item.forEach(visit);
                else if(item&&typeof item==='object')for(const[key,child]of Object.entries(item)){visit(key);visit(child);}
            }
            visit(value);return [...ids];
        }
        function writeTail() {
            clearTimeout(tailTimer);tailTimer=null;
            if (tailSafe && tailStamp===stamp) return;
            tailSafe=false;
            try {
                const missing=tokenIds([workspace,base,draft]).filter(id=>pendingAssets.has(id));
                let length=0;const embedded={};
                for (const id of missing) {length+=assets.get(id).length;if(length>750000) break;embedded[id]=assets.get(id);}
                const complete=missing.every(id=>id in embedded);
                if(!complete)return; // 等 IndexedDB 寫完大圖後，才發布指向該圖片的新草稿版本。
                localStorage.setItem(tailKey,JSON.stringify({stamp,draft,workspace,base,dirty,lastCloudAt,lastContentAt,verificationVersion:upgradePending?2:3,assets:complete?embedded:{}}));
                tailSafe=complete;tailStamp=stamp;
            } catch (_) { /* IndexedDB 可容納大圖；同步寫入失敗時由離開頁面保護補上。 */ }
        }
        async function persist() {
            if (savingLocal || !db) {if(!db&&dbError){localError=dbError;status();}return;}
            savingLocal=true;
            const savedStamp=stamp, pending=[...pendingAssets], saved={workspace,base,draft,dirty,stamp,lastCloudAt,lastContentAt,verificationVersion:upgradePending?2:3};
            try {
                const tx=db.transaction(['state','assets'],'readwrite'),done=transaction(tx);
                for(const [id,value] of pending)tx.objectStore('assets').put(value,id);
                tx.objectStore('state').put(saved,'current');await done;
                for(const [id,value]of pending)if(pendingAssets.get(id)===value)pendingAssets.delete(id);
                durableStamp=Math.max(durableStamp,savedStamp);lastLocalAt=new Date().toISOString();localError='';
                // IndexedDB is already durable; the synchronous fallback waits for a pause in typing.
            } catch(e) {writeTail();localError='瀏覽器的本機空間不足或無法寫入，請用「下載備份」保留內容。';}
            finally {savingLocal=false;if(!editSession&&!running&&!pendingAssets.size){for(const[id,value]of assets){if(value.length>100000&&chunkCloud.canReleaseAsset(id)){assets.delete(id);if(byValue.get(value)===id)byValue.delete(value);}}}status();if(savedStamp!==stamp)setTimeout(()=>void persist(),100);}
        }
        function touch() {
            stampNow();tailSafe=false;clearTimeout(tailTimer);
            if(!db)writeTail();else tailTimer=setTimeout(writeTail,1500);
            void persist();status();
        }
        function capture() {
            clearTimeout(captureTimer);captureTimer=null;firstCaptureAt=0;
            if (restoring || !editSession || !$('noteModal').classList.contains('active')) return;
            const imageDraft=noteImageEditor.exportDraft?.();capturePending=false;
            const next={id:editingNoteId||editSession.id,isNew:editSession.isNew,title:$('note-title-input').value,text:serializeEditorContent({prepare:false,packAssets:true}),images:currentPastedImages.map(src=>src.startsWith('data:')?asset(src):src),galleryImageEdits:Object.fromEntries(Object.entries(noteImageEditor.galleryData()).map(([k,v])=>[k,typeof v==='string'&&v.startsWith(tokenPrefix)?v:asset(JSON.stringify(v))])),categoryIds:[...pendingCategoryIds],createdAt:editSession.createdAt,original:editSession.original?packNote(editSession.original):null,imageEditor:packImageDraft(imageDraft)};
            if(sameShape(next,draft)){status();return;}draft=next;
            touch();
        }
        function packImageDraft(value){if(!value)return null;return {...value,source:value.source.startsWith(tokenPrefix)?value.source:asset(value.source),...(value.images?{images:Object.fromEntries(Object.entries(value.images).map(([id,source])=>[id,source.startsWith(tokenPrefix)?source:asset(source)]))}:{})};}
        function unpackImageDraft(value){if(!value)return null;return {...value,source:resolveAsset(value.source),...(value.images?{images:Object.fromEntries(Object.entries(value.images).map(([id,source])=>[id,resolveAsset(source)]))}:{})};}
        function changed() {
            if (!initialized || restoring || !editSession) return;
            editorPending=true;capturePending=true;clearTimeout(tailTimer);tailTimer=null;status();
            const now=Date.now();if(!firstCaptureAt)firstCaptureAt=now;if(!firstCheckpointAt)firstCheckpointAt=now;
            clearTimeout(captureTimer);captureTimer=setTimeout(capture,Math.max(0,Math.min(180,1000-(now-firstCaptureAt))));
            clearTimeout(checkpointTimer);checkpointTimer=setTimeout(checkpoint,Math.max(0,Math.min(1800,8000-(now-firstCheckpointAt))));
        }
        function begin() {
            if (restoring) return;
            clearTimeout(captureTimer);clearTimeout(checkpointTimer);
            const original=editingNoteId?notesData.find(n=>n.id===editingNoteId):null;
            editSession={id:editingNoteId||('note-'+uid()),isNew:!original,createdAt:original?.createdAt||new Date().toISOString(),original:original?{...original}:null,historyRecorded:false};
            capture();
        }
        function checkpoint() {
            clearTimeout(checkpointTimer);checkpointTimer=null;firstCheckpointAt=0;
            if (!editSession || restoring || !$('noteModal').classList.contains('active') || noteImageEditor.isOpen()) return;
            saveCurrent({automatic:true,close:false});
        }
        function saveCurrent({automatic=false,close=true}={}) {
            if (noteImageEditor.isOpen()) return;
            if (!editSession) begin();
            capture();if(!draft)return;
            const text=unpackHtml(draft.text),title=cleanNoteTitle(draft.title),existing=notesData.find(n=>n.id===draft.id);
            const empty=!title&&!$('modal-text').textContent.trim()&&!currentPastedImages.length&&(!text||text==='<br>'||text==='<div><br></div>');
            if (empty&&!existing) {editorPending=false;status();if(!automatic)alert('請至少輸入文字或附上一張圖片！');return;}
            const now=new Date().toISOString();
            const next={...(existing||{}),id:draft.id,title,text:empty?'':text,images:[...currentPastedImages],galleryImageEdits:noteImageEditor.galleryData(),categoryIds:pendingCategoryIds.filter(id=>getCategoryById(id)),starred:existing?.starred||false,createdAt:existing?.createdAt||editSession.createdAt};
            for(const name of ['image','imageAnnotations','galleryImages','pastedImages','uploadedImages','imageUrls'])delete next[name];
            // Capture already sanitized this exact DOM; reuse its packed HTML for the checkpoint.
            htmlCache.set(next,{source:next.text,text:draft.text});
            const comparison=n=>[n?.title||'',n?.text||'',n?.images||[],n?.galleryImageEdits||{},n?.categoryIds||[]];
            let updated=false;
            if(!existing||(!sameShape(comparison(existing),comparison(next))&&!sameNote(packNote(existing),packNote(next)))){
                if(existing)noteRecovery.beforeEdit(existing,editSession);
                next.updatedAt=now;const index=notesData.findIndex(n=>n.id===next.id);if(index<0)notesData.push(next);else notesData[index]=next;
                // 同一份 DOM 的緊湊 HTML 可重用，避免每次鍵入重新解析大圖。
                htmlCache.set(next,{source:next.text,text:draft.text});updated=true;
            }
            editingNoteId=next.id;draft.id=next.id;
            editorPending=false;
            if (!automatic) recordHistory();
            if(updated||!automatic)queueSave(automatic?null:100);
            status();
            if(close){const id=next.id;finishSession();ending=true;closeModal();ending=false;filterNotes();focusSavedNoteAfterSave(id);}
        }
        function recordHistory() {
            if(!editSession||editSession.historyRecorded)return;
            const current=notesData.find(n=>n.id===(editingNoteId||editSession.id));
            if(current&&(!editSession.original||!sameNote(packNote(current),packNote(editSession.original)))) {
                addHistoryRecord(editSession.isNew?'新增':'編輯',current,'自動儲存筆記');editSession.historyRecorded=true;
            }
        }
        function finishSession() {
            clearTimeout(captureTimer);clearTimeout(checkpointTimer);firstCaptureAt=firstCheckpointAt=0;draft=null;editSession=null;editorPending=capturePending=false;touch();
        }
        function closing() {
            if(ending||restoring||!editSession)return;
            saveCurrent({automatic:true,close:false});recordHistory();queueSave(100);finishSession();filterNotes();
        }
        function queueSave(delay=null) {
            if(restoring)return;
            const next=packPayload();
            if(sameShape(next,workspace)){
                if(dirty&&delay!=null){clearTimeout(syncTimer);syncTimer=setTimeout(()=>void synchronize(),delay);}
                return;
            }
            workspace=next;seq++;dirty=true;cloudVerified=false;lastContentAt=new Date().toISOString();if(!firstDirtyAt)firstDirtyAt=Date.now();touch();
            const quiet=delay??1600,max=8000;
            clearTimeout(syncTimer);syncTimer=setTimeout(()=>void synchronize(),Math.max(0,Math.min(quiet,max-(Date.now()-firstDirtyAt))));
        }
        async function fetchBackend(method='GET',payload=null,packed=null,verify=false) {
            if (method==='GET') {
                const result=await chunkCloud.read({verify});
                return result?.packed ? result.packed : result;
            }
            if(chunkCloud.isSupported()) return chunkCloud.write(packed || payload.map(packNote));
            return chunkCloud.legacyWrite(payload);
        }
        function merge(local,old,remote) {
            const oldMap=new Map(old.map(n=>[n.id,n])),localMap=new Map(local.map(n=>[n.id,n])),result=new Map(remote.map(n=>[n.id,n]));
            // A save timestamp alone is not a competing edit. Keep strict readback
            // verification unchanged; this comparison is only for merging notes.
            const sameContent=(a,b)=>sameNote(a,b)||!!(a&&b&&sameNote({...a,updatedAt:undefined},{...b,updatedAt:undefined}));
            const cloudCategories=remote.find(n=>n.id===CATEGORY_SYSTEM_ID)?.records||[];
            let conflicts=0;
            function preserveCloudVersion(note) {
                const existing=[...result.values(),...localMap.values()].some(carrier=>isRecoveryCarrier(carrier)&&!carrier.record.removedAt&&carrier.record.kind==='version'&&carrier.record.noteId===note.id&&sameContent(carrier.record.snapshot,note));
                if(existing)return;
                const versionId=uid(),now=new Date().toISOString(),id=NOTE_RECOVERY_ID+':'+versionId;
                result.set(id,{id,_type:'system-recovery',record:{id:versionId,noteId:note.id,kind:'version',source:'sync-conflict',capturedAt:now,updatedAt:now,reason:'同步差異：另一份雲端修改；原筆記保留本機內容',snapshot:structuredClone(note),index:remote.indexOf(note),categories:structuredClone(cloudCategories.filter(category=>(note.categoryIds||[]).includes(category.id)))}});
                conflicts++;
            }
            for(const [id,n]of localMap){
                if(sameContent(n,oldMap.get(id)))continue;
                const cloud=result.get(id),baseline=oldMap.get(id);
                if(isRecoveryCarrier(n)) {
                    const localTime=Date.parse(n.record.updatedAt||n.record.capturedAt)||0,remoteTime=Date.parse(cloud?.record?.updatedAt||cloud?.record?.capturedAt)||0;
                    if(!cloud||localTime>=remoteTime)result.set(id,n);continue;
                }
                if(id===CATEGORY_SYSTEM_ID){
                    const prior=new Map((baseline?.records||[]).map(item=>[item.id,item])),localItems=new Map((n.records||[]).map(item=>[item.id,item])),items=new Map((cloud?.records||[]).map(item=>[item.id,item]));
                    for(const[key,item]of localItems)if(!same(item,prior.get(key)))items.set(key,item);
                    for(const[key,item]of prior)if(!localItems.has(key)&&same(items.get(key),item))items.delete(key);
                    result.set(id,{...n,records:[...items.values()]});continue;
                }
                if(id===DRAW_LOG_SYSTEM_ID){
                    // 抽取記錄: one entry per draw; keep both devices' draws, newer edit of the same draw wins.
                    const items=new Map((cloud?.records||[]).map(x=>[x.id,x]));
                    for(const x of n.records||[]){const c=items.get(x.id);if(!c||(Date.parse(x.updatedAt)||0)>=(Date.parse(c.updatedAt)||0))items.set(x.id,x);}
                    result.set(id,{...n,records:[...items.values()]});continue;
                }
                if(id===HISTORY_SYSTEM_ID){
                    const items=new Map((cloud?.records||[]).map(x=>[x.id,x]));for(const x of n.records||[])items.set(x.id,x);result.set(id,{...n,records:[...items.values()]});continue;
                }
                if(cloud&&!sameContent(cloud,baseline)&&!sameContent(cloud,n))preserveCloudVersion(cloud);
                // Keep the note's identity, links and open editor attached to the
                // same note. The alternative belongs in versions, not the list.
                result.set(id,n);
            }
            for(const[id,n]of oldMap)if(!localMap.has(id)&&sameContent(result.get(id),n))result.delete(id);
            if(conflicts)showPreviewModeToast('已保留目前筆記；另一份修改已存到「垃圾桶與版本 → 筆記版本」。');
            return [...result.values()];
        }
        function refreshUi() {
            try{updateCategoryUi();filterNotes({background:true});updateHistoryBadge();updatePreviewModeUi();viewError='';}
            catch(e){viewError='雲端資料已讀取，但畫面更新未完成。內容仍保留，可先下載備份再重整。';console.error('筆記畫面更新失敗：',e.name);}
        }
        async function protectUpgradeSnapshot() {
            if(!upgradePending)return null;
            const descriptors=chunkCloud.snapshotAssetDescriptors(tokenIds(workspace));
            const saved={workspace:structuredClone(workspace),base:structuredClone(base),draft:draft?structuredClone(draft):null,descriptors,createdAt:new Date().toISOString()};
            // Keep the complete previous local state before a fresh read can replace it.
            if(db){const prior=await request(db.transaction('state').objectStore('state').get('before-reader-sync-v3'));if(prior)return prior;const tx=db.transaction('state','readwrite'),done=transaction(tx);tx.objectStore('state').put(saved,'before-reader-sync-v3');await done;}
            else {const prior=localStorage.getItem(scope+':before-reader-sync-v3');if(prior)return JSON.parse(prior);localStorage.setItem(scope+':before-reader-sync-v3',JSON.stringify(saved));}
            return saved;
        }
        function preserveUpgradeDifferences(saved,remote,merged) {
            if(!saved)return merged;
            chunkCloud.restoreAssetDescriptors(saved.descriptors);
            const remoteMap=new Map(remote.map(note=>[note.id,note])),mergedMap=new Map(merged.map(note=>[note.id,note]));
            const categories=saved.workspace.find(note=>note.id===CATEGORY_SYSTEM_ID)?.records||[];
            let recovered=0;
            for(const note of saved.workspace){
                if(isRecoveryCarrier(note)){
                    const current=mergedMap.get(note.id);
                    if(!current||(Date.parse(note.record.updatedAt||note.record.capturedAt)||0)>(Date.parse(current.record.updatedAt||current.record.capturedAt)||0))mergedMap.set(note.id,note);
                    continue;
                }
                if(note.id===HISTORY_SYSTEM_ID||note.id===CATEGORY_SYSTEM_ID||note.id===DRAW_LOG_SYSTEM_ID||sameNote(note,remoteMap.get(note.id)))continue;
                const id=uid(),now=new Date().toISOString();
                mergedMap.set(NOTE_RECOVERY_ID+':'+id,{id:NOTE_RECOVERY_ID+':'+id,_type:'system-recovery',record:{id,noteId:note.id,kind:'version',capturedAt:now,updatedAt:now,reason:'升級前本機內容與雲端不同，已保留供還原',snapshot:note,index:saved.workspace.indexOf(note),categories:categories.filter(category=>(note.categoryIds||[]).includes(category.id))}});
                recovered++;
            }
            upgradePending=false;
            if(recovered)showPreviewModeToast('已保留 '+recovered+' 份更新前本機差異，可從「垃圾桶與版本 → 筆記版本」還原。');
            return [...mergedMap.values()];
        }
        async function synchronize(forceRead=false) {
            if(running)return syncFinished;
            clearTimeout(syncTimer);clearTimeout(retryTimer);syncTimer=retryTimer=null;
            let finishSync;syncFinished=new Promise(resolve=>{finishSync=resolve;});
            running=true;status();
            try{
                if(!ready||forceRead){
                    cloudStage='讀取雲端筆記';status();
                    const upgrade=await protectUpgradeSnapshot();
                    const remote=await fetchBackend('GET',null,null,true);await noteTypingIdle();checkpoint();
                    const local=workspace,old=base,hadLocal=dirty;
                    normalizeLoadedData(remote);const remotePacked=packPayload();
                    const merged=preserveUpgradeDifferences(upgrade,remotePacked,hadLocal?merge(local,old,remotePacked):remotePacked);
                    normalizeLoadedData(merged);workspace=packPayload();base=remotePacked;ready=true;dirty=chunkCloud.needsMigration()||!same(workspace,base);loading=false;
                    cloudVerified=!dirty;if(cloudVerified){ackSeq=seq;lastCloudAt=new Date().toISOString();}
                    refreshUi();touch();
                }
                if(dirty){
                    const sent=workspace,sentSeq=seq,previous=base,payload=unpackPayload(sent);
                    cloudStage='整理圖片資料';status();originalUploadBytes=chunkCloud.isSupported()?0:new Blob([JSON.stringify(payload)]).size;
                    // 舊後端沒有分段能力時，先停止大包重送，不能把新協定物件寫入舊資料檔。
                    if(!chunkCloud.isSupported() && originalUploadBytes>4*1048576) await chunkCloud.legacyWrite(payload);
                    const compacted=chunkCloud.isSupported() ? {notes:payload} : await noteImageEditor.compactPayload(payload,{compressAll:false});
                    cloudStage='上傳筆記';status();await fetchBackend('POST',compacted.notes,chunkCloud.isSupported()?sent:null);
                    // 成功回覆後重新讀回；不能只因 HTTP 200 就清掉尚未寫入的圖片草稿。
                    cloudStage='確認雲端已保存內容';status();
                    await noteTypingIdle();
                    const confirmed=await fetchBackend('GET',null,null,true),list=Array.isArray(confirmed)?confirmed:confirmed.notes;
                    await noteTypingIdle();
                    const confirmedMap=new Map(list.map(n=>[n.id,packNote(n)])),oldMap=new Map(previous.map(n=>[n.id,n]));
                    const submitted=compacted.notes.map(packNote);
                    if(submitted.length!==confirmedMap.size||submitted.some(n=>!matchesStoredNote(n,confirmedMap.get(n.id)))||previous.some(n=>!sent.some(x=>x.id===n.id)&&confirmedMap.has(n.id)))throw new Error('雲端回覆成功，但重新讀取的內容尚未完整包含這次修改。本機草稿仍保留，沒有標示為同步完成。');
                    const sentMap=new Map(sent.map(n=>[n.id,n]));
                    // 讀回已確認的較小圖片格式，避免往後每次打字都重新編碼全部舊圖片。
                    // 正在輸入的新版本與筆記 DOM 保持原狀，既有游標、拖曳與復原不受影響。
                    workspace=workspace.map(n=>same(n,sentMap.get(n.id))?(confirmedMap.get(n.id)||n):n);
                    base=sent.map(n=>confirmedMap.get(n.id)||n);ackSeq=sentSeq;dirty=seq!==sentSeq;lastCloudAt=new Date().toISOString();firstDirtyAt=dirty?Date.now():0;
                    cloudVerified=!dirty;
                    normalizeLoadedData(workspace);refreshUi();touch();
                }
                cloudError='';retryCount=0;
            }catch(e){loading=false;cloudVerified=false;cloudError=(cloudStage?cloudStage+'失敗：':'')+e.message;ready=false;if(e.retryable!==false){const delay=Math.min(120000,5000*2**Math.min(retryCount++,5));retryTimer=setTimeout(()=>void synchronize(),delay);}}
            finally{running=false;cloudStage='';status();if(dirty&&!cloudError){clearTimeout(syncTimer);syncTimer=setTimeout(()=>void synchronize(),2200);}finishSync();}
        }
        async function flush(){
            capture();checkpoint();
            // An in-flight request may contain an older snapshot. Wait for it, then
            // persist the changes captured by this explicit save before returning.
            while(running)await syncFinished;
            if(dirty||!ready||!cloudVerified||cloudError)await synchronize();
        }
        async function restoreForm(savedDraft) {
            if(!savedDraft)return;
            savedDraft=noteSafeContent.note(savedDraft);
            if(savedDraft.original)savedDraft.original=noteSafeContent.note(savedDraft.original);
            await chunkCloud.ensureAssetIds(tokenIds(savedDraft));
            restoring=true;
            try{
                const original=savedDraft.original?unpackNote(savedDraft.original):null;
                if(!notesData.some(n=>n.id===savedDraft.id)&&original)notesData.push(original);
                if(notesData.some(n=>n.id===savedDraft.id))await openEditModal(savedDraft.id);else openAddModal();
                editingNoteId=notesData.some(n=>n.id===savedDraft.id)?savedDraft.id:null;
                $('note-title-input').value=savedDraft.title||'';$('modal-text').innerHTML=sanitizeNoteHtml(unpackHtml(savedDraft.text));
                currentPastedImages=(savedDraft.images||[]).map(resolveAsset);currentGalleryImageEdits=Object.fromEntries(Object.entries(savedDraft.galleryImageEdits||{}).map(([k,v])=>[k,typeof v==='string'?JSON.parse(resolveAsset(v)):structuredClone(v)]));pendingCategoryIds=savedDraft.categoryIds||[];
                renderPreviewGrid();prepareInlineImagesInEditor();prepareNoteTablesInEditor();prepareArrowNoteLists();
                editSession={id:savedDraft.id,isNew:savedDraft.isNew,createdAt:savedDraft.createdAt||new Date().toISOString(),original,historyRecorded:false};draft=savedDraft;
                const range=document.createRange();range.selectNodeContents($('modal-text'));range.collapse(false);setInlineImageRange(range);
                if(savedDraft.imageEditor){const recovered=unpackImageDraft(savedDraft.imageEditor);const target=recovered.gallery!=null?{gallery:recovered.gallery}:{image:$('modal-text').querySelectorAll('img[data-inline-image="1"]')[recovered.imageIndex]};if(target.image||target.gallery!=null)await noteImageEditor.open(target,recovered);}
                showPreviewModeToast('已還原上次尚未關閉的筆記草稿。');
            }finally{restoring=false;changed();}
        }
        async function start() {
            installUi();initialized=true;
            await chunkCloud.initializeCache();
            let record=null,tail=null;
            try{tail=JSON.parse(localStorage.getItem(tailKey)||'null');}catch(_){}
            try{await openDatabase();record=await request(db.transaction('state').objectStore('state').get('current'));}
            catch(e){dbError='瀏覽器無法使用大型圖片草稿空間；文字仍會嘗試保留，建議先下載備份。';}
            try{
                for(const[id,value]of Object.entries(tail?.assets||{})){assets.set(id,value);byValue.set(value,id);pendingAssets.set(id,value);}
                const restoreSource=tail&&tail.stamp>(record?.stamp||0)?tail:record;
                chunkCloud.rememberRemoteIds(tokenIds(restoreSource?.base||[]));
                chunkCloud.primeRecords(restoreSource?.base||[]);
                const draftIds=new Set(tokenIds([record?.draft,tail?.draft]));
                const ids=tokenIds([record,tail]).filter(id=>draftIds.has(id)||!chunkCloud.hasRemoteAsset(id));
                if(ids.length&&db){const tx=db.transaction('assets'),store=tx.objectStore('assets');await Promise.all(ids.map(async id=>{if(assets.has(id))return;const value=await request(store.get(id));if(value!=null){assets.set(id,value);byValue.set(value,id);}}));}
                const latest=tail&&tail.stamp>(record?.stamp||0)?tail:record;
                if(latest){workspace=latest.workspace||[];base=latest.base||[];upgradePending=latest.verificationVersion!==3&&workspace.length>0;dirty=!!latest.dirty;lastCloudAt=latest.lastCloudAt||'';lastContentAt=latest.lastContentAt||'';stamp=latest.stamp||0;durableStamp=record?.stamp||0;normalizeLoadedData(workspace);refreshUi();if(latest.draft)await restoreForm(latest.draft);}
            }catch(e){localError='部分本機備份無法完整讀取，請在同步狀態中下載備份，並檢查瀏覽器儲存空間。';}
            const noteModal=$('noteModal');
            noteModal.addEventListener('input',changed,true);noteModal.addEventListener('change',changed,true);
            // Selection, drag markers and preview decorations are not saved content.
            const transientClasses=new Set('image-selected inline-image-dragging controls-open note-table-dragging cell-selection-mode table-cell-selected table-cell-anchor table-active-cell note-editor-image-loading note-editor-image-error'.split(' '));
            const contentClasses=value=>(value||'').split(/\s+/).filter(name=>name&&!transientClasses.has(name)).sort().join(' ');
            const transientNode=node=>node.nodeType===Node.TEXT_NODE?!node.data.replace(/\u200B/g,''):node.nodeType===Node.ELEMENT_NODE&&node.matches('.inline-image-controls,.inline-drop-marker,.inline-annotation-overlay,.annotation-badge,.note-table-controls,.table-drop-marker,[data-selection-bookmark]');
            new MutationObserver(records=>{
                const relevant=records.some(record=>{
                    if(record.target.parentElement?.closest('.inline-image-controls,.note-table-controls,[data-selection-bookmark]'))return false;
                    if(record.type==='attributes'&&record.attributeName==='class')return contentClasses(record.oldValue)!==contentClasses(record.target.getAttribute('class'));
                    if(record.type==='childList')return [...record.addedNodes,...record.removedNodes].some(node=>!transientNode(node));
                    return true;
                });
                if(relevant)changed();
            }).observe($('modal-text'),{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['src','data-note-image-edit','style','class','colspan','rowspan']});
            new MutationObserver(changed).observe($('preview-grid'),{childList:true});
            window.addEventListener('online',()=>{cloudError='';void synchronize(true);});
            window.addEventListener('offline',()=>{cloudError='目前已離線，本機內容會保留；連線後自動重試。';status();});
            document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){capture();checkpoint();writeTail();void persist();}});
            window.addEventListener('pagehide',()=>{capture();writeTail();void persist();});
            window.addEventListener('beforeunload',event=>{capture();writeTail();if((editSession||dirty)&&!tailSafe&&durableStamp<stamp){event.preventDefault();event.returnValue='';}});
            void synchronize();status();
        }
        function downloadTextBackup() {
            capture();checkpoint();
            const payload={format:'pharmacy-notes-text-backup-v1',textOnly:true,book:noteDriveBoot.book,exportedAt:new Date().toISOString(),notes:notesData.map(note=>({id:note.id,title:note.title||'',text:notePlainText(note.text),categoryIds:getNoteCategoryIds(note),starred:!!note.starred})),draft:draft?{title:draft.title||'',text:notePlainText(draft.text)}:null};
            const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=document.title+'-純文字備份-'+localDateKey()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
        }
        async function downloadBackup() {
            const button=$('sync-backup');if(button.disabled)return;button.disabled=true;button.textContent='準備完整備份…';
            try{
                capture();const savedNotes=packPayload(),savedDraft=draft?structuredClone(draft):null;
                await chunkCloud.ensureAssetIds(tokenIds([savedNotes,savedDraft]));
                const payload={notes:unpackPayload(savedNotes),draft:savedDraft?{...savedDraft,text:unpackHtml(savedDraft.text),images:savedDraft.images.map(resolveAsset),galleryImageEdits:Object.fromEntries(Object.entries(savedDraft.galleryImageEdits||{}).map(([k,v])=>[k,JSON.parse(resolveAsset(v))])),original:savedDraft.original?unpackNote(savedDraft.original):null,imageEditor:unpackImageDraft(savedDraft.imageEditor)}:null,exportedAt:new Date().toISOString()};
                const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=document.title+'-備份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
            }catch(error){alert('完整備份需要讀取尚未下載的圖片；目前未能全部讀取，沒有輸出缺圖備份。請連線後重試。');}
            finally{button.disabled=false;button.textContent='下載完整備份';}
        }
        async function waitForCloud(signal){
            noteDriveCheckSignal(signal);capture();checkpoint();
            while(running){noteDriveCheckSignal(signal);await new Promise(r=>setTimeout(r,80));}
            noteDriveCheckSignal(signal);if(dirty)await synchronize();noteDriveCheckSignal(signal);
            if(dirty||cloudError)throw new Error(cloudError||'目前仍有待同步修改，請先重試同步。');
        }
        async function importDriveData(data,{merge=false,legacy=false,signal}={}){
            noteDriveCheckSignal(signal);
            if(!ready||running)throw new Error('請先完成雲端連線，再匯入備份。');
            if(!merge&&(notesData.length||editHistory.length||categoryDefinitions.length))throw new Error('舊雲端搬移只可匯入空白科目；已有資料請改用 JSON 補入。');
            const packed=legacy&&Array.isArray(data?.packed),raw=packed?data.packed:(data?.notes||data),importedDraft=data?.draft;
            const validList=Array.isArray(raw)&&!raw.some(n=>!n||!['string','number'].includes(typeof n.id)||!String(n.id)||String(n.id).length>250)&&new Set(raw.map(n=>String(n.id))).size===raw.length;
            if(!validList)throw new Error('備份缺少有效的筆記清單，沒有寫入雲端。');
            if(!packed&&tokenIds([raw,importedDraft]).length)throw new Error('這份備份含有尚未下載的圖片參照；請回舊網站下載「完整備份」。');
            if(importedDraft&&(!['string','number'].includes(typeof importedDraft.id)||typeof importedDraft.text!=='string'))throw new Error('備份的未完成草稿格式不正確，沒有寫入雲端。');
            if(noteImageEditor.isOpen())throw new Error('請先套用或關閉目前的圖片編輯，再匯入備份。');
            if(data?.textOnly)throw new Error('這是純文字備份，適合閱讀與另存文字；請使用完整備份 JSON 還原圖片、格式與版本。');
            const before=packPayload();let incoming,draftCopy=null,draftId=null,draftTargetId=null;
            try{
                normalizeLoadedData(packed?unpackPayload(raw):Array.isArray(data)?raw:{...data,notes:raw});
                if(importedDraft){
                    const backup={...importedDraft,title:(importedDraft.title||'未命名筆記')+'（匯入的未完成草稿）',createdAt:importedDraft.createdAt||data?.exportedAt,categoryIds:importedDraft.categoryIds||[]};
                    delete backup.original;delete backup.isNew;delete backup.imageEditor;
                    draftCopy=packNote(backup);
                }
                incoming=packPayload();
            }finally{normalizeLoadedData(before);}
            const candidates=tokenIds([incoming,draftCopy]).map(id=>[id,assets.get(id)]).filter(([,value])=>typeof value==='string');
            const matched=await chunkCloud.matchBackupAssets(candidates,signal);noteDriveCheckSignal(signal);
            const rewrite=value=>JSON.parse(JSON.stringify(value).replace(/note-local-asset:([a-zA-Z0-9-]+)/g,(all,id)=>matched.aliases[id]?tokenPrefix+matched.aliases[id]:all));
            incoming=rewrite(incoming);if(draftCopy)draftCopy=rewrite(draftCopy);
            const canonical=note=>{
                const value=JSON.parse(JSON.stringify(note).replace(/note-local-asset:([a-zA-Z0-9-]+)/g,(all,id)=>matched.fingerprints[id]?'note-sha256:'+matched.fingerprints[id]:all));
                delete value.updatedAt;return stable(value);
            };
            const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
            if(draftCopy){draftId='imported-draft-'+(await digest(canonical(draftCopy))).slice(0,24);draftCopy.id=draftId;draftTargetId=draftId;incoming.splice(Math.max(0,incoming.length-2),0,draftCopy);}
            const result={added:0,unchanged:0,copies:0,recovered:matched.recovered};
            let next=incoming;
            if(merge){
                next=structuredClone(before);
                const categoryCarrier=list=>list.find(n=>n.id===CATEGORY_SYSTEM_ID),historyCarrier=list=>list.find(n=>n.id===HISTORY_SYSTEM_ID);
                const currentCategories=categoryCarrier(next),importedCategories=categoryCarrier(incoming),categoryMap=new Map((currentCategories?.records||[]).map(n=>[n.id,n])),categoryAliases=new Map();
                for(const item of importedCategories?.records||[]){
                    const current=categoryMap.get(item.id);
                    if(!current)categoryMap.set(item.id,item);
                    else if(current.name!==item.name){
                        const existing=[...categoryMap.values()].find(n=>n.name===item.name);
                        const id=existing?.id||'json-category-'+(await digest(stable(item))).slice(0,20);categoryAliases.set(item.id,id);if(!existing)categoryMap.set(id,{...item,id});
                    }
                }
                if(currentCategories)currentCategories.records=[...categoryMap.values()];
                const history=historyCarrier(next),historyMap=new Map((history?.records||[]).map(n=>[n.id,n]));
                for(const item of historyCarrier(incoming)?.records||[])if(!historyMap.has(item.id))historyMap.set(item.id,item);
                if(history)history.records=[...historyMap.values()];
                const byId=new Map(next.map(n=>[JSON.stringify(n.id),n]));
                for(const original of incoming){
                    if(original.id===CATEGORY_SYSTEM_ID||original.id===HISTORY_SYSTEM_ID||original.id===DRAW_LOG_SYSTEM_ID)continue;
                    if(isRecoveryCarrier(original)){
                        const existing=next.find(n=>n.id===original.id);
                        if(!existing)next.push(original);
                        else if((Date.parse(original.record.updatedAt||original.record.capturedAt)||0)>(Date.parse(existing.record.updatedAt||existing.record.capturedAt)||0))next[next.indexOf(existing)]=original;
                        continue;
                    }
                    const note={...original,categoryIds:(original.categoryIds||[]).map(id=>categoryAliases.get(id)||id)},key=JSON.stringify(note.id),current=byId.get(key);
                    if(!current){next.push(note);byId.set(key,note);result.added++;continue;}
                    if(canonical(note)===canonical(current)){result.unchanged++;continue;}
                    const copyId='json-copy-'+(await digest(canonical(note))).slice(0,24);
                    if(note.id===draftId)draftTargetId=copyId;
                    if(byId.has(JSON.stringify(copyId))){result.unchanged++;continue;}
                    const copy={...note,id:copyId,title:(note.title||'未命名筆記')+'（JSON 備份副本）'};next.push(copy);byId.set(JSON.stringify(copyId),copy);result.copies++;
                }
            }else result.added=incoming.filter(n=>n.id!==CATEGORY_SYSTEM_ID&&n.id!==HISTORY_SYSTEM_ID&&n.id!==DRAW_LOG_SYSTEM_ID&&!isRecoveryCarrier(n)).length;
            noteDriveCheckSignal(signal);
            normalizeLoadedData(next);workspace=packPayload();seq++;dirty=true;touch();refreshUi();await synchronize();
            if(cloudError||dirty)throw new Error(cloudError||'匯入資料尚未完全同步，本機草稿已保留。');
            if(importedDraft?.imageEditor){
                // Preserve unfinished annotations separately from the saved note.
                const copy={...importedDraft,id:draftTargetId,isNew:false,original:null};await restoreForm(copy);capture();await persist();
                showPreviewModeToast('筆記已匯入，另保留未完成的圖片編輯草稿；請套用後儲存。');
            }
            return {...result,remaining:chunkCloud.state().remaining};
        }

        return {refreshStatus:status,snapshot:note=>structuredClone(packNote(note)),restoreSnapshot:async note=>{await chunkCloud.ensureAssetIds(tokenIds(note));return noteSafeContent.note(unpackNote(structuredClone(note)));},hasOpenEditor:()=>!!editSession,resolveEditorValue,imageSearchIds,waitForCloud,importDriveData,hasUnsavedChanges:()=>dirty||editorPending||noteImageEditor.isOpen(),hasPendingCloud:()=>!cloudVerified||!ready||dirty||running||editorPending||capturePending||noteImageEditor.isOpen()||!!cloudError,refreshCloudImages:()=>refreshUi(),start,begin,changed,capture,closing,saveCurrent,queueSave,flush,packImages,resetRenderedImages,prepareRenderedImages,renderedImageSource,prepareNoteForEditing};
    })();



/* Source: 70-workspace-and-pagination.js */
function initializeDriveWorkspace(){
    const boot=noteDriveBoot,select=document.getElementById('drive-book');
    for(const book of boot.books){const option=document.createElement('option');option.value=book.id;option.textContent=book.title;select.append(option);}
    select.value=boot.book;document.title=boot.title+'｜藥學筆記雲端工作台';
    const message=document.getElementById('drive-message'),migrate=document.getElementById('drive-migrate'),convert=document.getElementById('drive-convert'),importButton=document.getElementById('drive-import'),cancel=document.getElementById('drive-cancel');
    let active=null,resultText='';
    function update(){
        const state=window.noteDriveCloud?.state();if(!state)return;
        migrate.disabled=!!active||!state.loaded||state.records>0;
        importButton.disabled=!state.loaded||active?.kind==='json';
        importButton.textContent=active?.kind==='legacy'?'停止並改用 JSON 備份':state.records?'匯入 JSON 補圖／補筆記':'匯入完整備份 JSON';
        convert.hidden=!state.remaining;convert.disabled=!!active;
        cancel.hidden=!active||active.kind!=='legacy';select.disabled=!!active;
        if(!active)message.textContent=resultText||(!state.loaded?'正在連線到私人 Google Drive…':state.remaining?`文字已可閱讀。還有 ${state.remaining} 個舊圖片／畫記待搬移；也可直接匯入完整 JSON 補圖。`:state.records?'此科目已使用新版儲存。JSON 可補入新筆記；內容不同會保留備份副本。':'此科目是空白的。可從舊雲端搬移，或匯入舊網站下載的完整 JSON 備份。');
    }
    function stopLegacy(){
        if(active?.kind!=='legacy')return;
        active.controller.abort();cancel.disabled=true;
        message.textContent='正在停止舊搬移；已送出的保存會完成，之後可改用 JSON。';
    }
    function work(fn,kind='legacy'){
        if(active)return active.promise;
        const task={kind,controller:new AbortController(),promise:null};active=task;resultText='';cancel.disabled=false;
        const container=document.querySelector('.container');container.inert=true;update();
        task.promise=(async()=>{
            try{await notePersistence.waitForCloud(task.controller.signal);await fn(task.controller.signal);}
            catch(e){resultText=e.code==='CANCELLED'?'已停止舊雲端搬移；已保存的筆記與圖片會保留，可直接匯入 JSON 補圖。':e.message+' 已完成的內容會保留，可重試或改用完整 JSON 備份。';}
            finally{if(active===task){active=null;container.inert=false;cancel.disabled=false;update();}}
        })();return task.promise;
    }
    async function migrateImages(signal){
        noteDriveCheckSignal(signal);message.textContent='正在將舊原圖與畫記轉存為 Drive 檔案；可隨時停止並改用 JSON…';
        const result=await noteDriveCloud.migrateOriginals((done,total,failed)=>message.textContent=`已搬移 ${done}／${total} 個原圖／畫記${failed?`；${failed} 個讀取失敗，其他項目繼續保存`:''}。`,()=>signal.aborted,signal);
        noteDriveCheckSignal(signal);notePersistence.refreshCloudImages();
        resultText=result.failed?`已保留成功搬移的圖片；${result.failed} 個原圖／畫記讀取失敗。可直接匯入完整 JSON 補圖，或按「繼續搬移原圖」重試。${result.failures[0]?.message||''}`:result.remaining?`進度已保存，還有 ${result.remaining} 個原圖／畫記待搬移。`:'搬移完成。文字、原圖與畫記已保存至新版 Google Drive。';
    }
    migrate.onclick=()=>work(async signal=>{
        message.textContent='正在讀取舊雲端文字索引；可停止並改用 JSON 備份…';
        const snapshot=await noteDriveCloud.importLegacy(signal);noteDriveCheckSignal(signal);
        await notePersistence.importDriveData(snapshot,{legacy:true,signal});
        await migrateImages(signal);
    });
    convert.onclick=()=>work(migrateImages);
    cancel.onclick=stopLegacy;
    const input=document.getElementById('drive-file');
    importButton.onclick=()=>{stopLegacy();input.click();};
    input.onchange=async()=>{
        const file=input.files[0];input.value='';if(!file)return;
        while(active){if(active.kind==='json')return;stopLegacy();await active.promise;}
        void work(async signal=>{
            message.textContent='正在讀取完整 JSON，補入筆記與圖片；現有內容會保留…';let data;
            try{data=JSON.parse(await file.text());}catch(_){throw new Error('備份不是有效的 JSON。');}
            const result=await notePersistence.importDriveData(data,{merge:true,signal});
            resultText=`JSON 已同步：新增 ${result.added} 則、相同 ${result.unchanged} 則、差異保留副本 ${result.copies} 則，補回 ${result.recovered} 個原圖／畫記。`+(result.remaining?` 仍有 ${result.remaining} 個舊圖片參照未補齊；請使用含這些原圖的完整備份。`:' 目前沒有待搬移的舊圖片。');
        },'json');
    };
    select.onchange=async()=>{
        const next=select.value;select.disabled=true;document.getElementById('drive-open-book').hidden=true;
        await notePersistence.flush();
        if(notePersistence.hasPendingCloud()){message.textContent='這個科目仍有待同步內容，請先完成同步再切換。';select.value=boot.book;select.disabled=false;return;}
        // A normal web page can switch subjects directly (no Apps Script frame any more).
        location.href=boot.appUrl+'?book='+encodeURIComponent(next);
    };
    document.getElementById('drive-quota').onclick=async()=>{
        const button=document.getElementById('drive-quota');button.disabled=true;
        document.getElementById('drive-quota-text').textContent='正在讀取 Google 儲存空間…';
        try{const result=await noteDriveRpc('quota'),q=result.storageQuota||{},gb=n=>(Number(n)/1e9).toFixed(2)+' GB';document.getElementById('drive-quota-text').textContent='Google 儲存空間已使用 '+gb(q.usage||0)+(q.limit?'／'+gb(q.limit):'（帳號未回報容量上限）');}
        catch(e){document.getElementById('drive-quota-text').textContent=e.message;}
        finally{button.disabled=false;}
    };
    window.addEventListener('note-drive-state',update);update();
}

/* Pagination only changes the rendered slice. Every record stays in notesData and cloud storage. */
const noteBrowse=(()=>{
    const allowed=new Set([-1,0,1,3,5,10,20]);   // -1 = 捲動載入 (load more while scrolling)
    const STEP=20;let infinite=false,loaded=STEP,loadObserver=null;
    let size=5,page=0,items=[],lastContext=null,pendingId=null,restored=false,initialized=false,saved={},storageKey='',printState=null,hold=null,scrollFrame=0,composing=false,scrollHold=null;
    const consumedClicks=new WeakMap();
    const el=id=>document.getElementById(id);
    const normalContext=()=>JSON.stringify(['',false,null,null]);
    function context(){return JSON.stringify([el('search-input').value.trim().toLowerCase(),!!isStarFilterActive,activeCategoryFilterId||null,randomDrawState.active?randomDrawState.selectedIds:null]);}
    const pageCount=()=>size?Math.max(1,Math.ceil(items.length/size)):1;
    const message=text=>{el('note-reader-message').textContent=text;el('note-reader-message').hidden=!text;};
    function remember(){
        saved={...saved,size:infinite?-1:size};
        if(lastContext===normalContext()&&items.length)saved={size:infinite?-1:size,page,anchorId:String(items[size?page*size:0]?.id??'')};
        try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_){}
    }
    function update(){
        const count=pageCount(),start=items.length?(size?page*size+1:1):0,end=size?Math.min(items.length,(page+1)*size):infinite?Math.min(items.length,loaded):items.length;
        const filtered=lastContext!==null&&lastContext!==normalContext();
        const summary=lastContext===null?'正在讀取…':(filtered?'篩選 ':'')+start+'–'+end+'／'+items.length+' 則';
        el('note-page-summary').textContent=summary;el('note-page-summary').setAttribute('aria-live',hold?'off':'polite');
        el('note-page-size').title=summary+'；調整每頁筆記數';
        el('note-page-size').value=String(infinite?-1:size);el('note-page-total').textContent='／'+count+' 頁';
        const more=el('note-load-more');if(more){more.hidden=!infinite||end>=items.length;more.textContent='往下捲載入更多（已顯示 '+end+'／'+items.length+' 則）';}
        if(document.activeElement!==el('note-page-input'))el('note-page-input').value=String(page+1);
        el('note-page-input').disabled=!size||count<=1;
        el('note-page-first').disabled=el('note-page-prev').disabled=el('note-side-prev').disabled=page===0;
        el('note-page-last').disabled=el('note-page-next').disabled=el('note-side-next').disabled=page>=count-1;
        el('note-page-dock').hidden=!items.length;
        el('note-side-prev').hidden=el('note-side-next').hidden=!size||count<=1;
        document.body.classList.toggle('note-paging-docked',!el('note-page-dock').hidden);
        if(typeof noteSearchNavigation!=='undefined')noteSearchNavigation.layoutDock();
    }
    function select(list){
        if(printState)return list;
        const nextContext=context();
        if(lastContext!==null&&lastContext!==nextContext){page=0;loaded=STEP;message('');}
        lastContext=nextContext;items=list;
        if(!restored&&list.length){
            if(lastContext===normalContext()){
                const index=list.findIndex(note=>String(note.id)===saved.anchorId);
                page=size&&index>=0?Math.floor(index/size):(Number.isSafeInteger(saved.page)?saved.page:0);
            }
            restored=true;
        }
        if(pendingId!==null){const index=list.findIndex(note=>String(note.id)===pendingId);if(index>=0){page=size?Math.floor(index/size):0;if(infinite)loaded=Math.max(loaded,index+5);}pendingId=null;}
        page=Math.max(0,Math.min(page,pageCount()-1));update();
        return size?list.slice(page*size,(page+1)*size):infinite?list.slice(0,loaded):list;
    }
    function scrollToStart(){
        cancelAnimationFrame(scrollFrame);scrollFrame=requestAnimationFrame(()=>{
            scrollFrame=0;
            const list=el('note-list'),inset=(document.querySelector('.top-bar')?.offsetHeight||0)+12;
            window.scrollTo({top:Math.max(0,scrollY+list.getBoundingClientRect().top-inset),behavior:'auto'});
            notePersistence.prepareRenderedImages(list);
        });
    }
    function go(index){
        if(document.querySelector('.container').inert||!size)return false;
        if(context()!==lastContext)filterNotes();
        const next=Math.max(0,Math.min(Number(index)||0,pageCount()-1));
        if(next===page)return false;
        savedNoteFocusSession++;page=next;message('');window.scrollTo(0,0);filterNotes();if(!hold)remember();scrollToStart();return true;
    }
    function typingTarget(node){return !!(node?.isContentEditable||node?.closest?.('input,textarea,select,[role="textbox"],[role="combobox"]'));}
    function readingAllowed(event,kind='page'){
        return (kind==='scroll'||!!size&&pageCount()>1)&&!printState&&!composing&&!document.hidden&&!document.querySelector('.container').inert
            &&!document.querySelector('.modal-overlay.active')&&!typingTarget(document.activeElement)&&!typingTarget(event?.target)
            &&!event?.isComposing&&event?.keyCode!==229&&!event?.altKey&&!event?.ctrlKey&&!event?.metaKey;
    }
    function stopHold(){
        if(!hold)return;const previous=hold;hold=null;clearTimeout(previous.timer);
        if(previous.button){delete previous.button.dataset.holding;consumedClicks.set(previous.button,performance.now()+500);}
        remember();update();
        if(!document.hidden&&!printState&&!document.querySelector('.container').inert)notePersistence.prepareRenderedImages(el('note-list'));
    }
    function startHold(direction,source){
        stopScroll();stopHold();if(!readingAllowed())return;
        const session=hold={...source,direction,started:performance.now(),timer:0};
        if(session.button)session.button.dataset.holding='true';
        if(!go(page+direction)){stopHold();return;}
        function repeat(){
            if(hold!==session)return;
            if(!readingAllowed()||!go(page+direction)){stopHold();return;}
            if(page===0||page===pageCount()-1){stopHold();return;}
            session.timer=setTimeout(repeat,performance.now()-session.started>1100?45:90);
        }
        if(page===0||page===pageCount()-1){stopHold();return;}
        session.timer=setTimeout(repeat,270);
    }
    function stopScroll(){if(!scrollHold)return;const previous=scrollHold;scrollHold=null;cancelAnimationFrame(previous.frame);}
    function startScroll(direction,source){
        stopHold();if(!readingAllowed(null,'scroll')){stopScroll();return;}
        savedNoteFocusSession++;
        const now=performance.now(),limit=Math.max(0,document.scrollingElement.scrollHeight-innerHeight);
        // Repeated taps share their destination and velocity instead of restarting an animation.
        if(scrollHold&&!scrollHold.down&&!scrollHold.continuous){
            Object.assign(scrollHold,source,{direction,down:true,started:now,target:Math.max(0,Math.min(limit,scrollHold.target+direction*120))});
            return;
        }
        stopScroll();
        const position=scrollY,target=Math.max(0,Math.min(limit,position+direction*120));if(target===position)return;
        const session=scrollHold={...source,direction,down:true,continuous:false,started:now,last:now,frame:0,position,target,velocity:0,applied:position};
        function tick(now){
            if(scrollHold!==session)return;
            if(!readingAllowed(null,'scroll')){stopScroll();return;}
            const dt=Math.max(0,Math.min(40,now-session.last));session.last=now;
            const shift=scrollY-session.applied;
            if(Math.abs(shift)>1){session.position+=shift;session.target+=shift;}
            const max=Math.max(0,document.scrollingElement.scrollHeight-innerHeight);
            session.target=Math.max(0,Math.min(max,session.target));
            if(session.down&&now-session.started>=120)session.continuous=true;
            if(session.continuous){
                // Carry the tap's velocity into the held motion, without a stationary gap.
                const speed=session.direction*1.8,decay=Math.exp(-dt/60);
                session.position+=speed*dt+(session.velocity-speed)*60*(1-decay);
                session.velocity=speed+(session.velocity-speed)*decay;
            }else{
                // Critically damped motion reaches each 120px target without overshoot.
                const spring=.032,offset=session.position-session.target,c=session.velocity+spring*offset,decay=Math.exp(-spring*dt);
                session.position=session.target+(offset+c*dt)*decay;
                session.velocity=(session.velocity-spring*c*dt)*decay;
            }
            session.position=Math.max(0,Math.min(max,session.position));
            window.scrollTo({top:session.position,behavior:'instant'});session.applied=scrollY;
            if((session.direction<0&&session.position<=0)||(session.direction>0&&session.position>=max)){stopScroll();return;}
            if(!session.down&&!session.continuous&&Math.abs(session.position-session.target)<.25&&Math.abs(session.velocity)<.01){
                window.scrollTo({top:session.target,behavior:'instant'});stopScroll();return;
            }
            session.frame=requestAnimationFrame(tick);
        }
        session.frame=requestAnimationFrame(tick);
    }
    function releaseScroll(code){
        if(scrollHold?.code!==code)return;
        scrollHold.down=false;
        // A quick tap finishes its small eased step; a held scroll stops on release.
        if(scrollHold.continuous)stopScroll();
    }
    function stopReadingMotion(){stopScroll();stopHold();}
    function bindHold(button){
        const direction=Number(button.dataset.notePageHold);
        button.addEventListener('pointerdown',event=>{
            if(event.button!==0||event.isPrimary===false||button.disabled)return;
            event.preventDefault();button.focus({preventScroll:true});
            consumedClicks.set(button,performance.now()+60000);
            startHold(direction,{source:'pointer',id:event.pointerId,button});
            if(hold?.button===button)try{button.setPointerCapture(event.pointerId);}catch(_){}
        });
        button.addEventListener('click',event=>{
            if(event.detail>0&&performance.now()<(consumedClicks.get(button)||0)){event.preventDefault();return;}
            stopHold();if(readingAllowed())go(page+direction);
        });
        button.addEventListener('contextmenu',event=>event.preventDefault());
        button.addEventListener('lostpointercapture',()=>{if(hold?.button===button)stopHold();});
    }
    function requestReveal(id){pendingId=String(id);}
    function reveal(id){
        const index=items.findIndex(note=>String(note.id)===String(id));if(index<0)return false;
        if(infinite&&index>=loaded){loaded=index+5;renderNotes(items);return true;}
        const next=size?Math.floor(index/size):0;if(next!==page){page=next;renderNotes(items);remember();}
        return true;
    }
    /* 捲動載入: a marker under the list; when it comes near the screen, show 20 more notes. */
    function setupLoadMore(){
        const list=el('note-list');if(!list||el('note-load-more'))return;
        const more=document.createElement('div');more.id='note-load-more';more.className='note-load-more';more.hidden=true;more.setAttribute('role','status');
        list.after(more);
        const grow=()=>{if(!infinite||loaded>=items.length||document.querySelector('.container').inert)return;loaded+=STEP;filterNotes({background:true});
            requestAnimationFrame(()=>{if(!more.hidden&&more.getBoundingClientRect().top<innerHeight+800)grow();});};
        more.addEventListener('click',grow);
        if(typeof IntersectionObserver==='function'){loadObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))grow();},{rootMargin:'0px 0px 800px 0px'});loadObserver.observe(more);}
    }
    function integer(value){const text=String(value).normalize('NFKC').trim(),n=Number(text);return /^[0-9]+$/.test(text)&&Number.isSafeInteger(n)&&n>0?n:null;}
    function initialize(){
        if(initialized)return;initialized=true;
        let hash=2166136261;for(const c of (noteDriveBoot.workspace||noteDriveBoot.appUrl||SCRIPT_URL))hash=Math.imul(hash^c.charCodeAt(0),16777619);
        storageKey='pharmacy-note-reading-v1-'+noteDriveBoot.book+'-'+(hash>>>0).toString(36);
        try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};if(allowed.has(saved.size)){infinite=saved.size===-1;size=infinite?0:saved.size;}}catch(_){saved={};}
        setupLoadMore();
        const search=el('search-input');search.enterKeyHint='search';
        search.addEventListener('keydown',event=>{
            if(event.key!=='Enter'||event.repeat||event.isComposing||composing||(event.keyCode||event.which)===229||event.altKey||event.ctrlKey||event.metaKey)return;
            event.preventDefault();event.stopPropagation();
            clearTimeout(searchRenderTimer);searchRenderTimer=null;savedNoteFocusSession++;
            filterNotes({background:true});
            search.blur();document.body.focus({preventScroll:true});
        });
        el('note-page-size').value=String(size);
        el('note-page-size').addEventListener('change',()=>{
            stopReadingMotion();
            const anchor=items[size?page*size:0]?.id,value=Number(el('note-page-size').value);if(!allowed.has(value))return;
            infinite=value===-1;size=infinite?0:value;page=0;loaded=STEP;if(anchor!=null)requestReveal(anchor);savedNoteFocusSession++;filterNotes();remember();
            if(anchor!=null)focusSavedNoteAfterSave(anchor);else scrollToStart();
        });
        el('note-page-first').onclick=()=>{stopReadingMotion();go(0);};el('note-page-last').onclick=()=>{stopReadingMotion();go(pageCount()-1);};
        document.querySelectorAll('[data-note-page-hold]').forEach(bindHold);
        window.addEventListener('keydown',event=>{
            const key=event.key?.toLowerCase();
            if(event.altKey||event.ctrlKey||event.metaKey)stopScroll();
            if(!['a','d','w','s'].includes(key)){if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape'].includes(event.key))stopScroll();return;}
            const scrolling=key==='w'||key==='s';
            if(!readingAllowed(event,scrolling?'scroll':'page')){stopReadingMotion();return;}
            event.preventDefault();event.stopPropagation();if(event.repeat)return;
            if(scrolling)startScroll(key==='w'?-1:1,{code:event.code||key});
            else startHold(key==='a'?-1:1,{source:'keyboard',code:event.code||key});
        },true);
        window.addEventListener('keyup',event=>{const code=event.code||event.key?.toLowerCase();if(hold?.source==='keyboard'&&code===hold.code)stopHold();releaseScroll(code);},true);
        document.addEventListener('pointerup',event=>{if(hold?.source==='pointer'&&hold.id===event.pointerId)stopHold();},true);
        document.addEventListener('pointercancel',stopReadingMotion,true);
        document.addEventListener('pointermove',event=>{
            if(hold?.source!=='pointer'||hold.id!==event.pointerId)return;const r=hold.button.getBoundingClientRect(),pad=18;
            if(event.clientX<r.left-pad||event.clientX>r.right+pad||event.clientY<r.top-pad||event.clientY>r.bottom+pad)stopHold();
        },{passive:true});
        document.addEventListener('pointerdown',event=>{stopScroll();if(!event.target.closest?.('[data-note-page-hold]'))stopHold();},true);
        document.addEventListener('focusin',event=>{if(typingTarget(event.target))stopReadingMotion();});
        document.addEventListener('compositionstart',()=>{composing=true;stopReadingMotion();},true);
        document.addEventListener('compositionend',()=>{composing=false;},true);
        window.addEventListener('blur',stopReadingMotion);window.addEventListener('pagehide',stopReadingMotion);
        window.addEventListener('wheel',stopScroll,{passive:true});window.addEventListener('touchstart',stopScroll,{passive:true});
        document.addEventListener('visibilitychange',()=>{if(document.hidden)stopReadingMotion();});
        function goToInputPage(){
            const n=integer(el('note-page-input').value);
            if(!n||n>pageCount()){update();message('請輸入 1 到 '+pageCount()+' 之間的頁碼。');return;}
            go(n-1);update();
        }
        el('note-page-input').addEventListener('change',goToInputPage);
        el('note-page-jump').addEventListener('submit',event=>{event.preventDefault();el('note-page-input').blur();goToInputPage();});
        window.addEventListener('beforeprint',()=>{
            stopReadingMotion();if(printState)return;printState={page,x:scrollX,y:scrollY};filterNotes();
        });
        window.addEventListener('afterprint',()=>{
            if(!printState)return;const previous=printState;printState=null;page=previous.page;filterNotes();
            requestAnimationFrame(()=>scrollTo(previous.x,previous.y));
        });
        // The Apps Script page lives in an iframe. Give the reading surface keyboard focus on startup.
        if(!document.body.hasAttribute('tabindex'))document.body.tabIndex=-1;
        if(document.activeElement===document.body)document.body.focus({preventScroll:true});
        update();
    }
    function adjacentImageIds(){
        if(!size||!items.length)return[];
        const nearby=[...items.slice((page+1)*size,(page+2)*size),...items.slice(Math.max(0,(page-1)*size),page*size)];
        const ids=new Set();for(const note of nearby){
            // Packed HTML can also contain annotation ids; only ids with preview descriptors are fetched.
            for(const match of JSON.stringify(note).matchAll(/note-local-asset:([a-zA-Z0-9-]+)/g)){ids.add(match[1]);if(ids.size>=48)return[...ids];}
        }
        return[...ids];
    }
    return {initialize,select,requestReveal,reveal,adjacentImageIds,isFlipping:()=>!!hold,bottomInset:()=>{const dock=el('note-reader-dock')||el('note-page-dock');return dock&&!dock.hidden?dock.offsetHeight+24:18;},state:()=>({size,page,count:pageCount(),total:items.length})};
})();

/* Background search updates keep existing rows, decoded images and the reader's viewport. */
const noteSearchViewport=(()=>{
    const signatures=new WeakMap();let renderedContext=null;
    const context=()=>JSON.stringify([document.getElementById('search-input').value.trim().toLowerCase(),!!isStarFilterActive,activeCategoryFilterId||null,randomDrawState.active?randomDrawState.selectedIds:null]);
    function signature(note,index){
        const images=Array.isArray(note.images)&&note.images.length?note.images:note.image?[note.image]:[];
        return JSON.stringify([index,note.title||'',note.text||'',images,!!note.starred,getNoteCategoryIds(note).map(id=>getCategoryById(id)||null)]);
    }
    function filterOptions(options={}){
        // A newly typed query or explicit filter change still follows the normal first-page behavior.
        if(!options.background||renderedContext!==context())return {background:false};
        const anchor=noteBrowse.isFlipping()||document.querySelector('.modal-overlay.active')?null:capturePreviewViewportAnchor();
        if(anchor?.noteId)noteBrowse.requestReveal(anchor.noteId);
        return {background:true,anchor};
    }
    function begin(list,notes,options){
        const indices=new Map(notesData.map((note,index)=>[String(note.id),index]));
        const rows=notes.map(note=>({id:String(note.id),signature:signature(note,indices.get(String(note.id))??0)}));
        const current=[...list.children],byId=new Map(current.map(node=>[node.dataset.id,node]));
        const unchanged=!!options.background&&current.length===rows.length&&rows.every((row,index)=>current[index].dataset.id===row.id&&signatures.get(current[index])===row.signature);
        const update={list,rows:new Map(rows.map(row=>[row.id,row])),byId,nodes:[],background:!!options.background,anchor:options.anchor,unchanged};
        renderedContext=context();return update;
    }
    function reuse(update,note){
        if(!update.background)return null;
        const id=String(note.id),node=update.byId.get(id);
        if(node&&signatures.get(node)===update.rows.get(id)?.signature){update.nodes.push(node);return node;}
        return null;
    }
    function add(update,note,node){signatures.set(node,update.rows.get(String(note.id)).signature);update.nodes.push(node);}
    function commit(update){
        const {list,nodes,anchor}=update;
        if(!update.background){const fragment=document.createDocumentFragment();for(const node of nodes)fragment.appendChild(node);list.replaceChildren(fragment);return;}
        // Never detach unchanged rows into a fragment: that discards cached layout and image state.
        const wanted=new Set(nodes);
        for(const node of [...list.children])if(!wanted.has(node))node.remove();
        let cursor=list.firstElementChild;
        for(const node of nodes){if(node===cursor)cursor=cursor.nextElementSibling;else list.insertBefore(node,cursor);}
        if(!anchor)return;
        const node=nodes.find(node=>node.dataset.id===anchor.noteId);
        if(node&&Number.isFinite(anchor.noteTop)){
            const delta=node.getBoundingClientRect().top-anchor.noteTop;
            if(Math.abs(delta)>.5)window.scrollTo({left:anchor.scrollX,top:window.scrollY+delta,behavior:'instant'});
        }else if(Math.abs(window.scrollY-anchor.scrollY)>.5){
            window.scrollTo({left:anchor.scrollX,top:anchor.scrollY,behavior:'instant'});
        }
        // Position correction is synchronous. No delayed timer can pull the reader back after scrolling.
    }
    // Manual reading cancels a saved-note positioning request even before its first animation frame.
    window.addEventListener('wheel',()=>{savedNoteFocusSession++;},{passive:true});
    window.addEventListener('touchstart',()=>{savedNoteFocusSession++;},{passive:true});
    return {filterOptions,begin,reuse,add,commit};
})();

/* Canonical asset references stay in src/metadata; srcset is a disposable display preview. */
const noteInstantEditor=(()=>{
    const prefix='note-local-asset:',pending=new WeakMap();let initialized=false;
    const placeholder='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#edf2ef"/></svg>');
    const isToken=value=>typeof value==='string'&&value.startsWith(prefix);
    function clean(clone){
        for(const image of clone.querySelectorAll('img[data-note-editor-dimensions]')){image.removeAttribute('width');image.removeAttribute('height');image.removeAttribute('data-note-editor-dimensions');}
        for(const image of clone.querySelectorAll('img[data-note-editor-preview]')){
            image.removeAttribute('srcset');image.removeAttribute('data-note-editor-preview');
            image.classList.remove('note-editor-image-loading','note-editor-image-error');
            image.removeAttribute('title');
        }
    }
    function decorate(image){
        const source=image.getAttribute('src')||'';if(!isToken(source))return;
        const id=source.slice(prefix.length);if(pending.get(image)===id)return;pending.set(image,id);
        const d=window.noteDriveCloud?.dimensions(id)||{};
        if(d.width&&d.height&&!image.hasAttribute('width')&&!image.hasAttribute('height')){image.width=d.width;image.height=d.height;image.dataset.noteEditorDimensions='1';}
        image.dataset.noteEditorPreview=id;image.srcset=(window.noteDriveCloud?.peekPreview(id)||placeholder)+' 1x';
        image.classList.add('note-editor-image-loading');image.title='圖片預覽在背景載入，現在可以編輯文字。';
        const job=window.noteDriveCloud?.hasRemoteAsset(id)?window.noteDriveCloud.ensurePreview(id):notePersistence.resolveEditorValue(source);
        Promise.resolve(job).then(value=>{
            if(!image.isConnected||image.getAttribute('src')!==source)return;
            image.srcset=value+' 1x';image.classList.remove('note-editor-image-loading','note-editor-image-error');image.title='放大或畫記時讀取這張原圖。';
        }).catch(()=>{if(image.isConnected&&image.getAttribute('src')===source){image.classList.remove('note-editor-image-loading');image.classList.add('note-editor-image-error');image.title='預覽暫時無法讀取；原圖與畫記保留，可稍後開啟這張圖片重試。';pending.delete(image);}});
    }
    function prepare(){document.getElementById('modal-text')?.querySelectorAll('img').forEach(decorate);}
    function prepareGallery(){document.getElementById('preview-grid')?.querySelectorAll('img').forEach(decorate);}
    async function resolveGallery(index){
        const source=currentPastedImages[index],request=noteOpenRequest;
        if(!source)return false;
        const full=await notePersistence.resolveEditorValue(source),key=noteImageEditor.galleryKey(full),metadata=currentGalleryImageEdits[key];
        const resolved=isToken(metadata)?JSON.parse(await notePersistence.resolveEditorValue(metadata)):metadata;
        if(request!==noteOpenRequest||currentPastedImages[index]!==source||!document.getElementById('noteModal').classList.contains('active'))return false;
        currentPastedImages[index]=full;if(resolved)currentGalleryImageEdits[key]=resolved;
        renderPreviewGrid();return true;
    }
    function initialize(){
        if(initialized)return;initialized=true;
        const editor=document.getElementById('modal-text');new MutationObserver(records=>{
            for(const record of records)for(const node of record.addedNodes){
                if(node.nodeType!==Node.ELEMENT_NODE)continue;
                if(node.matches('img'))decorate(node);node.querySelectorAll('img').forEach(decorate);
            }
        }).observe(editor,{childList:true,subtree:true});
        const originalGalleryData=noteImageEditor.galleryData;
        noteImageEditor.galleryData=()=>currentPastedImages.some(isToken)?{...currentGalleryImageEdits}:originalGalleryData();
        const originalOpen=noteImageEditor.open;
        noteImageEditor.open=async(target,recoveredDraft=null)=>{
            const request=noteOpenRequest;
            try{
                if(target.image){
                    const image=inlineImageNode(target.image),source=image?.getAttribute('src')||'',metadata=image?.getAttribute('data-note-image-edit');
                    const [full,edit]=await Promise.all([notePersistence.resolveEditorValue(source),isToken(metadata)?notePersistence.resolveEditorValue(metadata):metadata]);
                    if(request!==noteOpenRequest||!image?.isConnected||image.getAttribute('src')!==source||!document.getElementById('noteModal').classList.contains('active'))return;
                    image.src=full;image.removeAttribute('srcset');image.removeAttribute('data-note-editor-preview');image.classList.remove('note-editor-image-loading','note-editor-image-error');
                    if(edit)image.setAttribute('data-note-image-edit',edit);target={...target,image};
                }else if(target.gallery!=null&&!await resolveGallery(target.gallery))return;
                if(request===noteOpenRequest)return originalOpen(target,recoveredDraft);
            }catch(_){showPreviewModeToast('這張原圖尚未讀取完成；文字仍可編輯，原圖與畫記保留。');}
        };
        const originalMove=window.moveGalleryImageInline;
        window.moveGalleryImageInline=async index=>{try{if(await resolveGallery(index))originalMove(index);}catch(_){showPreviewModeToast('這張圖片尚未讀取完成，請稍後再移入文字；原圖仍保留。');}};
    }
    return {initialize,prepare,prepareGallery,clean};
})();


/* Source: 80-ocr-search.js */
/* OCR is derived, resumable and low priority. It never enters a note revision. */
const noteImageSearch=(()=>{
    const engine='drive-ocr-auto-v2',holdCodes=['OCR_QUOTA','OCR_REQUEST','OCR_PERMISSION'];
    const entries=new Map(),assets=new Map(),noteCache=new WeakMap(),checked=new Set(),localRead=new Set(),failed=new Map(),holds=new Map();let assetVersion=0;
    const scope='note-ocr-v1-'+(noteDriveBoot.workspace||noteDriveBoot.appUrl)+'-'+noteDriveBoot.book;
    const cache=createNoteReadCache(scope);let started=false,paused=false,timer=null,busy=false,indexReady=false,indexError='',noticeTimer=null,refreshTimer=null,renderCache=null,force=false,holdUntil=0,idleUntil=0;
    const activeEditor=()=>!!document.querySelector('.modal-overlay.active');
    const canWork=()=>!paused&&Date.now()>=idleUntil&&(force||Date.now()>=holdUntil)&&!document.hidden&&navigator.onLine!==false&&!activeEditor()&&!window.noteDriveCloud?.isBusy();
    function refreshHold(){holdUntil=Math.max(0,...[...holds].filter(([key])=>assets.has(key)).map(([,until])=>until));}
    function schedule(delay=1500){clearTimeout(timer);timer=setTimeout(()=>void pump(),delay);}
    function publish(){
        renderStatus();clearTimeout(noticeTimer);
        function refreshResults(){
            if(Date.now()<idleUntil||noteBrowse.isFlipping()){noticeTimer=setTimeout(refreshResults,350);return;}
            if(document.getElementById('search-input').value.trim()&&!activeEditor())filterNotes({background:true});
        }
        noticeTimer=setTimeout(refreshResults,180);
    }
    function setEntry(key,entry){
        if(!entry.complete&&entry.engine!==engine&&['OCR_SERVICE','OCR_REQUEST','OCR_PERMISSION'].includes(entry.code)){
            entry={...entry,engine};for(const name of ['error','code','retryAfter','diagnostic'])delete entry[name];
        }
        if(!entry.complete&&holdCodes.includes(entry.code))holds.set(key,entry.retryAfter||0);else holds.delete(key);
        refreshHold();entries.set(key,entry);return entry;
    }
    async function remember(key,entry){entry=setEntry(key,entry);await cache.put([['entry:'+key,entry]]);publish();}
    function errorDetails(){
        const entry=[...assets.keys()].map(key=>entries.get(key)).find(entry=>entry?.error),d=entry?.diagnostic;
        return ['圖片文字辨識錯誤','網站版本：'+(noteDriveBoot.release||'未知'),entry?.error||indexError||[...failed.values()].find(value=>value.message)?.message||'',d?'階段：'+d.stage+'\nHTTP：'+d.status+'\n原因：'+(d.reasons||[]).join(', ')+'\n欄位：'+((d.fields||[]).join(', ')||'Google 未指定'):'', '筆記與原圖儲存不受辨識失敗影響；可按「重試辨識」接續。'].filter(Boolean).join('\n\n');
    }
    function keysFor(note){
        const saved=noteCache.get(note);if(saved?.version===assetVersion)return saved.keys;
        const keys=[...new Set(notePersistence.imageSearchIds(note).map(id=>window.noteDriveCloud.assetDescriptor(id)?.file?.key).filter(Boolean))];
        noteCache.set(note,{version:assetVersion,keys});return keys;
    }
    function refresh(){
        if(!started)return;
        assets.clear();assetVersion++;
        for(const note of notesData){
            const keys=[];for(const id of notePersistence.imageSearchIds(note)){
                const d=window.noteDriveCloud.assetDescriptor(id);if(!d?.file)continue;
                const key=d.file.key;if(!assets.has(key))assets.set(key,{id,descriptor:d});keys.push(key);
            }
            noteCache.set(note,{version:assetVersion,keys:[...new Set(keys)]});
        }
        refreshHold();publish();schedule(1500);
    }
    function renderStatus(){
        const root=document.getElementById('note-image-search-status');if(!root)return;
        root.hidden=!assets.size;
        const list=[...assets.keys()],done=list.filter(key=>entries.get(key)?.complete).length;
        const errored=list.map(key=>entries.get(key)?.error||failed.get(key)?.message).find(Boolean)||indexError,httpError=list.map(key=>entries.get(key)?.diagnostic?.status).find(Boolean);
        const text=done===list.length?'圖片文字已可搜尋：'+done+' 張':paused?'圖片文字辨識已暫停：'+done+'／'+list.length+' 張':errored?(httpError?'圖片文字辨識遇到 '+httpError+'：':'圖片文字辨識稍後接續：')+done+'／'+list.length+' 張':'正在背景建立圖片文字索引：'+done+'／'+list.length+' 張；現在可搜尋已完成的圖片。';
        root.querySelector('span').textContent=text;root.title=errored||'只辨識新圖片，結果會保存在 Drive；原圖、畫記與筆記不會被改寫。';
        const pause=root.querySelector('[data-ocr-pause]');pause.hidden=done===list.length;pause.textContent=paused?'繼續辨識':'暫停';
        root.querySelector('[data-ocr-retry]').hidden=!errored;
        root.querySelector('[data-ocr-details]').hidden=!errored;
    }
    async function loadIndex(){
        const keys=[...assets.keys()].filter(key=>!checked.has(key));if(!keys.length){indexReady=true;return;}
        const localKeys=keys.filter(key=>!localRead.has(key));
        for(let i=0;i<localKeys.length;i+=64){const group=localKeys.slice(i,i+64),values=await Promise.all(group.map(key=>cache.get('entry:'+key)));group.forEach((key,n)=>{localRead.add(key);if(values[n])setEntry(key,values[n]);});}
        publish();
        if(document.hidden||navigator.onLine===false)return;
        for(let i=0;i<keys.length;i+=2000){
            const group=keys.slice(i,i+2000),result=await noteDriveRpc('ocrIndex',{keys:group},noteDriveBoot.book,undefined,20);
            const saved=Object.entries(result.entries||{}).map(([key,entry])=>[key,setEntry(key,entry)]);if(saved.length)await cache.put(saved.map(([key,entry])=>['entry:'+key,entry]));publish();
            group.forEach(key=>checked.add(key));
        }
        indexReady=true;indexError='';
    }
    async function tile(item,entry){
        const d=item.descriptor;
        if(d.kind==='data-url'&&['image/jpeg','image/png','image/gif','image/bmp'].includes(d.file.mime)&&d.file.bytes<=2000000)return {index:0,total:1};
        if(renderCache?.key!==d.file.key){
            const source=await window.noteDriveCloud.ensureAsset(item.id,undefined,20),image=new Image();image.src=source;await noteImageReady(image);
            const cols=Math.max(1,Math.ceil((image.naturalWidth-64)/1936)),rows=Math.max(1,Math.ceil((image.naturalHeight-64)/1936));
            if(cols*rows>64)throw new Error('這張圖片過長，暫時無法建立完整文字索引；原圖仍可閱讀與編輯。');
            if(renderCache)renderCache.image.src='';renderCache={key:d.file.key,image,cols,rows};
        }
        const {image,cols,rows}=renderCache,total=cols*rows;
        const index=Array.from({length:total},(_,i)=>i).find(i=>!Object.prototype.hasOwnProperty.call(entry?.parts||{},String(i)));
        if(index==null)return null;
        const x=index%cols*1936,y=Math.floor(index/cols)*1936,w=Math.min(2000,image.naturalWidth-x),h=Math.min(2000,image.naturalHeight-y);
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,w,h);context.drawImage(image,x,y,w,h,0,0,w,h);
        let blob;for(const quality of [.92,.82,.68]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=2000000)break;}
        canvas.width=canvas.height=1;if(!blob||blob.size>2000000)throw new Error('這張圖片的辨識分區過大，稍後可重試。');
        const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
        return {index,total,mime:'image/jpeg',data:btoa(binary)};
    }
    async function pump(){
        timer=null;if(busy)return;busy=true;
        try{
            if(!indexReady||[...assets.keys()].some(key=>!checked.has(key)))await loadIndex();
            if(!canWork())return;
            const key=[...assets.keys()].find(key=>!entries.get(key)?.complete&&(force||Math.max(entries.get(key)?.retryAfter||0,failed.get(key)?.until||0)<=Date.now()));
            if(!key)return;
            const item=assets.get(key),entry=entries.get(key),part=await tile(item,entry);
            if(!part||!canWork())return;
            const result=await noteDriveRpc('ocrRecognize',{file:item.descriptor.file,part,force},noteDriveBoot.book,undefined,20);force=false;
            if(result.entry)await remember(key,result.entry);
            if(result.pending)failed.set(key,{until:result.retryAfter||Date.now()+30000,message:'另一個視窗正在辨識，完成後會接續。'});else failed.delete(key);
        }catch(error){
            indexError=String(error.message||error);
            const key=renderCache?.key;if(key)failed.set(key,{until:Date.now()+60000,message:indexError});
        }finally{busy=false;if(renderCache&&(!canWork()||entries.get(renderCache.key)?.complete)){renderCache.image.src='';renderCache=null;}renderStatus();if([...assets.keys()].some(key=>!entries.get(key)?.complete))schedule(indexError||holdUntil>Date.now()?30000:1800);}
    }
    function start(){
        if(started)return;started=true;try{paused=localStorage.getItem(scope+':paused')==='1';}catch(_){}
        const status=document.createElement('div');status.id='note-image-search-status';status.hidden=true;
        status.innerHTML='<span role="status" aria-live="polite"></span><button type="button" data-ocr-pause>暫停</button><button type="button" data-ocr-details hidden>錯誤內容</button><button type="button" data-ocr-retry hidden>重試辨識</button>';
        document.querySelector('.top-bar').after(status);
        status.querySelector('[data-ocr-pause]').onclick=()=>{paused=!paused;try{localStorage.setItem(scope+':paused',paused?'1':'0');}catch(_){}renderStatus();if(!paused)schedule(100);};
        status.querySelector('[data-ocr-retry]').onclick=()=>{indexError='';failed.clear();holds.clear();force=true;holdUntil=0;paused=false;try{localStorage.setItem(scope+':paused','0');}catch(_){}schedule(100);};
        status.querySelector('[data-ocr-details]').onclick=()=>alert(errorDetails());
        window.addEventListener('note-drive-state',()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,350);});
        document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(300);});window.addEventListener('online',()=>schedule(300));
        window.addEventListener('scroll',()=>{idleUntil=Date.now()+1500;},{passive:true});
        refresh();
    }
    function markImages(root){
        const query=normalizeSearchText(document.getElementById('search-input').value);
        for(const image of root.querySelectorAll('img')){
            const src=image.getAttribute('src')||'',id=image.dataset.cloudOriginal||image.dataset.cloudAsset||(src.startsWith('note-local-asset:')?src.slice(17):'');
            const key=window.noteDriveCloud?.assetDescriptor(id)?.file?.key,value=entries.get(key)?.text,text=typeof value==='string'?normalizeSearchText(value):'';
            image.classList.toggle('note-image-text-match',!!query&&text.includes(query));
        }
    }
    return {start,refresh,markImages,text:note=>keysFor(note).map(key=>entries.get(key)?.text||'').join(' '),state:()=>({total:assets.size,completed:[...assets.keys()].filter(key=>entries.get(key)?.complete).length,busy,paused})};
})();


/* Source: 85-search-navigation.js */
/* Search decorations affect reader DOM only; canonical note HTML is unchanged. */
const noteSearchNavigation = (() => {
    let initialized = false, cursor = null, lastQuery = '', busy = false, layoutFrame = 0;
    function layoutDock() {
        cancelAnimationFrame(layoutFrame);
        layoutFrame=requestAnimationFrame(()=>{
            const dock=document.getElementById('note-reader-dock');if(!dock)return;
            const quick=document.getElementById('note-quick-actions');if(quick)quick.hidden=document.getElementById('note-page-dock').hidden;
            dock.hidden=[...dock.children].every(node=>node.hidden);
            document.body.classList.toggle('note-reader-docked',!dock.hidden);
            const height=dock.hidden?0:Math.ceil(dock.getBoundingClientRect().height);
            document.documentElement.style.setProperty('--note-reader-dock-height',height+'px');
        });
    }
    const query = () => normalizeSearchText(document.getElementById('search-input').value);
    const candidates = () => randomDrawState.active
        ? randomDrawState.selectedIds.map(resolveLinkedNote).filter(Boolean)
        : getNormallyFilteredNotes();
    function normalizedMap(text) {
        let normalized = ''; const starts = [], ends = [];
        const fallback = function*(){let index=0;for(const segment of text){yield {segment,index};index+=segment.length;}};
        const chunks = typeof Intl.Segmenter === 'function'
            ? new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(text)
            : fallback();
        for (const chunk of chunks) for (const character of chunk.segment.normalize('NFKC').toLowerCase()) {
            const value = /\s/.test(character) ? ' ' : character;
            if (value === ' ' && normalized.endsWith(' ')) { if (ends.length) ends[ends.length-1] = chunk.index + chunk.segment.length; continue; }
            for (let i = 0; i < value.length; i++) { starts.push(chunk.index); ends.push(chunk.index + chunk.segment.length); }
            normalized += value;
        }
        return {text:normalized, starts, ends};
    }
    function ranges(text, term, limit = 150) {
        if (!term || !normalizeSearchText(text).includes(term)) return [];
        const map = normalizedMap(text), result = [];
        for (let from = 0; term && result.length < limit;) {
            const index = map.text.indexOf(term, from); if (index < 0) break;
            result.push([map.starts[index], map.ends[index + term.length - 1]]); from = index + term.length;
        }
        return result;
    }
    function markedText(text, term) {
        const found = ranges(text, term, 20); let output = '', start = 0;
        for (const [a,b] of found) { output += escapeHtml(text.slice(start,a)) + '<mark>' + escapeHtml(text.slice(a,b)) + '</mark>'; start = b; }
        return output + escapeHtml(text.slice(start));
    }
    function excerpt(text, term) {
        const compact = String(text || '').replace(/\s+/g, ' ').trim(), first = ranges(compact, term, 1)[0];
        if (!first) return '';
        const start = Math.max(0, first[0]-40), end = Math.min(compact.length, first[1]+90);
        return (start ? '…' : '') + markedText(compact.slice(start,end), term) + (end < compact.length ? '…' : '');
    }
    function decorate(root, options = {}) {
        if (!root) return;
        const hit=options.preserveViewport&&!noteBrowse.isFlipping()&&!document.querySelector('.modal-overlay.active')?document.elementFromPoint(innerWidth*.5,innerHeight*.45):null;
        const anchor=hit?.closest('.note-text,.note-images-container,.note-title-display');
        const anchorTop=anchor&&root.contains(anchor)?anchor.getBoundingClientRect().top:null;
        const term = query();
        root.querySelectorAll('mark[data-search-hit]').forEach(mark => mark.replaceWith(...mark.childNodes));
        root.querySelectorAll('.note-search-excerpt').forEach(node => node.remove());
        if (!term) { update(); return; }
        for (const item of root.querySelectorAll('.note-item')) {
            const note = resolveLinkedNote(item.dataset.id); if (!note) continue;
            let count = 0;
            for (const content of item.querySelectorAll('.note-title-display,.note-text')) {
                content.normalize();
                const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {acceptNode:node => node.parentElement.closest('script,style,button,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
                const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
                for (const text of nodes) {
                    if (count >= 150) break;
                    const found = ranges(text.data, term, 150-count); if (!found.length) continue;
                    const fragment = document.createDocumentFragment(); let offset = 0;
                    for (const [a,b] of found) {
                        fragment.append(text.data.slice(offset,a)); const mark = document.createElement('mark');
                        mark.dataset.searchHit = '1'; mark.textContent = text.data.slice(a,b); fragment.append(mark); offset = b; count++;
                    }
                    fragment.append(text.data.slice(offset)); text.replaceWith(fragment);
                }
            }
            const ocr = noteImageSearch.text(note), ocrSnippet = excerpt(ocr, term);
            const textSnippet = !count ? excerpt(notePlainText(note.text), term) : '';
            if (ocrSnippet || textSnippet) {
                const summary = document.createElement('div'); summary.className = 'note-search-excerpt';
                summary.innerHTML = (textSnippet ? '<div>內文命中：' + textSnippet + '</div>' : '') + (ocrSnippet ? '<div>圖片文字命中：' + ocrSnippet + '</div>' : '');
                summary.querySelectorAll('mark').forEach(mark => mark.dataset.searchHit='1');
                item.querySelector('.note-content-area').prepend(summary);
            }
            if (!count && !ocrSnippet && !textSnippet) {
                const summary = document.createElement('div'); summary.className = 'note-search-excerpt';
                summary.textContent = '分類命中：' + getNoteCategoryIds(note).map(id=>getCategoryById(id)?.name||'').join('、');
                item.querySelector('.note-content-area').prepend(summary);
            }
        }
        update();
        if(anchor?.isConnected&&Number.isFinite(anchorTop)){
            const delta=anchor.getBoundingClientRect().top-anchorTop;
            if(Math.abs(delta)>.5)window.scrollBy({top:delta,left:0,behavior:'instant'});
        }
    }
    function update() {
        const panel = document.getElementById('note-search-navigation'); if (!panel) return;
        const term = query(), list = candidates(); panel.hidden = !term;
        if (term !== lastQuery) { cursor = null; lastQuery = term; }
        const index = cursor ? list.findIndex(note=>String(note.id)===cursor.id) : -1;
        panel.querySelector('[data-search-count]').textContent = !list.length ? '找不到符合的筆記' : index < 0 ? '找到 '+list.length+' 則筆記' : '第 '+(index+1)+'／'+list.length+' 則 · 第 '+(cursor.hit+1)+' 處';
        panel.querySelectorAll('[data-search-step]').forEach(button=>button.disabled=!list.length||busy);
        layoutDock();
    }
    async function move(direction) {
        if (busy || !query() || document.querySelector('.container')?.inert || document.querySelector('.modal-overlay.active')) return;
        const list = candidates(); if (!list.length) return;
        busy = true;
        try {
            let index = cursor ? list.findIndex(note=>String(note.id)===cursor.id) : -1;
            let hit = cursor?.hit ?? -1;
            let current = index >= 0 ? findRenderedNoteElement(list[index].id) : null;
            // Manual page changes should continue within the newly displayed page.
            if (!current && (cursor || noteBrowse.state().page>0)) {
                const visible=[...document.querySelectorAll('#note-list > .note-item')];
                current=direction>0?visible[0]:visible[visible.length-1];
                if(current)index=list.findIndex(note=>String(note.id)===current.dataset.id);
            }
            const marks = current ? [...current.querySelectorAll('mark[data-search-hit]')] : [];
            if(current&&(!cursor||cursor.id!==current.dataset.id))hit=direction>0?-1:marks.length;
            if (index >= 0 && hit + direction >= 0 && hit + direction < marks.length) hit += direction;
            else { index = index < 0 ? direction > 0 ? 0 : list.length-1 : (index+direction+list.length)%list.length; hit = direction > 0 ? 0 : -1; }
            noteBrowse.requestReveal(list[index].id); filterNotes();
            const item = findRenderedNoteElement(list[index].id), targets = item ? [...item.querySelectorAll('mark[data-search-hit]')] : [];
            if (hit < 0) hit = Math.max(0, targets.length-1);
            cursor = {id:String(list[index].id),hit};
            const target = targets[hit] || item;
            document.querySelectorAll('.note-current-search-hit').forEach(node=>node.classList.remove('note-current-search-hit'));
            if (target) { target.classList.add('note-current-search-hit'); target.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }
        } finally { busy = false; update(); }
    }
    function clear() { document.getElementById('search-input').value='';cursor=null;filterNotes();document.getElementById('search-input').focus(); }
    function initialize() {
        if (initialized) return; initialized=true;
        const panel = document.createElement('div'); panel.id='note-search-navigation';panel.hidden=true;
        panel.setAttribute('role','region');panel.setAttribute('aria-label','搜尋結果定位');
        panel.innerHTML='<span data-search-count role="status" aria-live="polite"></span><button type="button" data-search-step="-1">上一處</button><button type="button" data-search-step="1">下一處</button><button type="button" data-search-clear>清除搜尋</button>';
        const pagination=document.getElementById('note-page-dock'),dock=document.createElement('div');
        dock.id='note-reader-dock';dock.hidden=true;
        const quick=document.createElement('div');quick.id='note-quick-actions';quick.setAttribute('role','group');quick.setAttribute('aria-label','閱讀快捷操作');
        quick.innerHTML='<button type="button" data-reader-quick="search">搜尋</button><button type="button" data-reader-quick="add">＋ 筆記</button><button type="button" data-reader-quick="categories">分類</button><button type="button" data-reader-quick="top" aria-label="回到頁面頂端">↑ 頂端</button><button type="button" data-reader-quick="bottom" aria-label="前往目前這一頁底部">↓ 底部</button>';
        quick.addEventListener('click',event=>{const name=event.target.closest('[data-reader-quick]')?.dataset.readerQuick;if(name==='search'){const input=document.getElementById('search-input');input.focus({preventScroll:true});input.select();}else if(name==='add')openAddModal();else if(name==='categories')openCategoryOverviewModal();else if(name==='top'||name==='bottom')window.scrollTo({top:name==='top'?0:(document.scrollingElement||document.documentElement).scrollHeight,behavior:'instant'});});
        pagination.before(dock);dock.append(quick,panel,pagination);
        if(typeof ResizeObserver==='function')new ResizeObserver(layoutDock).observe(dock);
        window.addEventListener('resize',layoutDock,{passive:true});layoutDock();
        panel.addEventListener('click',event=>{const step=event.target.closest('[data-search-step]');if(step)void move(Number(step.dataset.searchStep));if(event.target.closest('[data-search-clear]'))clear();});
        document.getElementById('search-input').addEventListener('compositionend',()=>handleSearchInput());
        window.addEventListener('keydown',event=>{if(event.key==='F3'&&!document.querySelector('.modal-overlay.active')&&query()){event.preventDefault();void move(event.shiftKey?-1:1);}});
    }
    return {initialize,decorate,update,move,excerpt,layoutDock};
})();

/* Source: 86-recovery.js */
/* Recovery entries are independent catalog records, so large libraries stay pageable. */
function isRecoveryCarrier(value) { return value?._type === 'system-recovery' && String(value.id || '').startsWith(NOTE_RECOVERY_ID + ':'); }

const noteRecovery = (() => {
    const day = 86400000, trashDays = 30, tombstoneDays = 90, maxVersions = 200, perNote = 10;
    let entries = [], initialized = false, selected = null, tab = 'trash', busy = false, opener = null;
    const uid = () => crypto.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const time = entry => Date.parse(entry.updatedAt || entry.capturedAt) || 0;
    const copy = value => JSON.parse(JSON.stringify(value));
    function trim() {
        const now = Date.now(), byNote = new Map(); let total = 0;
        entries.sort((a,b)=>time(b)-time(a));
        for (const entry of entries) {
            if (entry.removedAt) continue;
            const count = byNote.get(String(entry.noteId)) || 0;
            const expired = entry.kind === 'trash' ? now-Date.parse(entry.capturedAt)>trashDays*day : count>=perNote || total>=maxVersions;
            if (expired) { entry.removedAt=new Date(now).toISOString();entry.updatedAt=entry.removedAt;delete entry.snapshot;delete entry.categories; }
            else if (entry.kind==='version') {byNote.set(String(entry.noteId),count+1);total++;}
        }
        entries=entries.filter(entry=>!entry.removedAt || now-Date.parse(entry.removedAt)<tombstoneDays*day);
    }
    function load(carriers) {
        const found = new Map();
        for (const carrier of carriers || []) {
            const entry=carrier?.record;
            if (!entry || typeof entry.id!=='string' || !/^[a-zA-Z0-9-]{1,100}$/.test(entry.id) || !['trash','version'].includes(entry.kind) || !Number.isFinite(Date.parse(entry.capturedAt))) continue;
            if (!entry.removedAt && (!entry.snapshot || !['string','number'].includes(typeof entry.snapshot.id))) continue;
            const value=copy(entry);if(value.snapshot)value.snapshot=noteSafeContent.note(value.snapshot);
            const old=found.get(value.id);if(!old||time(value)>time(old))found.set(value.id,value);
        }
        entries=[...found.values()];trim();updateBadge();
    }
    function carriers() {trim();return entries.map(record=>({id:NOTE_RECOVERY_ID+':'+record.id,_type:'system-recovery',record:copy(record)}));}
    function capture(note, kind, reason) {
        const snapshot=notePersistence.snapshot(note);
        const latest=entries.find(entry=>!entry.removedAt&&entry.kind===kind&&entry.noteId===note.id);
        if (kind==='version'&&latest&&JSON.stringify(latest.snapshot)===JSON.stringify(snapshot)) return latest;
        const now=new Date().toISOString(),entry={id:uid(),noteId:note.id,kind,capturedAt:now,updatedAt:now,reason,snapshot,index:notesData.indexOf(note),categories:getNoteCategoryIds(note).map(getCategoryById).filter(Boolean).map(copy)};
        entries.unshift(entry);trim();updateBadge();return entry;
    }
    function beforeEdit(note, session) {
        if (!note) return;
        if (!session || !session.versionRecorded || Date.now()-(session.lastVersionAt||0)>=300000) {
            capture(note,'version','編輯前的內容');
            if(session){session.versionRecorded=true;session.lastVersionAt=Date.now();}
        }
    }
    function trash(note) {return capture(note,'trash','刪除前的完整內容');}
    function updateBadge() {
        const button=document.getElementById('note-recovery-open');
        if(button){const count=entries.filter(entry=>entry.kind==='trash'&&!entry.removedAt).length;button.textContent='垃圾桶與版本'+(count?'（'+count+'）':'');}
    }
    function open(nextTab='trash') {
        const dialog=document.getElementById('note-recovery-dialog');
        if(!dialog)return;tab=nextTab;selected=null;opener=document.activeElement;
        if(!dialog.open){dialog.classList.add('active');dialog.showModal();}render();
    }
    function render() {
        const dialog=document.getElementById('note-recovery-dialog');if(!dialog?.open)return;
        const term=normalizeSearchText(dialog.querySelector('[data-recovery-filter]').value);
        const visible=entries.filter(entry=>!entry.removedAt&&entry.kind===tab&&(!term||normalizeSearchText((entry.snapshot?.title||'')+' '+notePlainText(entry.snapshot?.text||'')).includes(term)));
        dialog.querySelectorAll('[data-recovery-tab]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.recoveryTab===tab));});
        const list=dialog.querySelector('[data-recovery-list]');list.replaceChildren();
        for(const entry of visible){
            const button=document.createElement('button');button.type='button';button.className='note-recovery-entry';button.dataset.recoveryEntry=entry.id;
            button.setAttribute('aria-pressed',String(selected===entry.id));
            const title=document.createElement('strong');title.textContent=entry.snapshot?.title||notePlainText(entry.snapshot?.text||'').slice(0,50)||'圖片筆記';
            const detail=document.createElement('small');detail.textContent=new Date(entry.capturedAt).toLocaleString('zh-TW')+' · '+entry.reason;
            button.append(title,detail);list.append(button);
        }
        if(!visible.length)list.textContent=tab==='trash'?'垃圾桶沒有符合的筆記。':'沒有符合的版本。新版本會在內容修改時開始保留。';
        if(!visible.some(entry=>entry.id===selected))selected=visible[0]?.id||null;
        list.querySelectorAll('[data-recovery-entry]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.recoveryEntry===selected)));
        const entry=entries.find(item=>item.id===selected&&!item.removedAt),preview=dialog.querySelector('[data-recovery-preview]');preview.replaceChildren();
        dialog.querySelector('[data-recovery-restore]').disabled=!entry||busy;
        dialog.querySelector('[data-recovery-remove]').disabled=!entry||busy;
        if(entry){
            const title=document.createElement('h3');title.textContent=entry.snapshot.title||'未命名筆記';preview.append(title);
            const content=document.createElement('div');content.className='note-recovery-text';content.innerHTML=sanitizeNoteHtml(entry.snapshot.text);
            content.querySelectorAll('img').forEach(image=>{const label=document.createElement('span');label.className='note-recovery-image-label';label.textContent='〔圖片會隨筆記還原〕';image.replaceWith(label);});
            preview.append(content);
            const gallery=entry.snapshot.images?.length||(entry.snapshot.image?1:0);
            if(gallery){const label=document.createElement('p');label.textContent='另有 '+gallery+' 張圖片會一併還原。';preview.append(label);}
        }
        updateBadge();
    }
    async function restore(id=selected) {
        const entry=entries.find(item=>item.id===id&&!item.removedAt);if(!entry||busy)return false;
        if(previewModeBlocksEditing())return false;
        if(notePersistence.hasOpenEditor()){alert('請先儲存並關閉目前編輯的筆記，再進行還原。');return false;}
        busy=true;render();
        const status=document.querySelector('[data-recovery-message]');if(status)status.textContent='正在準備完整內容與圖片…';
        try{
            const restored=await notePersistence.restoreSnapshot(entry.snapshot);
            for(const category of entry.categories||[])if(!getCategoryById(category.id))categoryDefinitions.push({id:String(category.id),name:String(category.name).slice(0,30),abbr:normalizeCategoryAbbr(category.abbr,category.name),color:normalizeCategoryColor(category.color)});
            const current=resolveLinkedNote(entry.noteId);
            if(entry.kind==='version'&&current){capture(current,'version','還原其他版本前的內容');restored.id=current.id;notesData[notesData.indexOf(current)]=restored;}
            else {if(current)restored.id='restored-'+uid();notesData.splice(Math.max(0,Math.min(notesData.length,entry.index??notesData.length)),0,restored);}
            restored.updatedAt=new Date().toISOString();
            if(entry.kind==='trash'){entry.removedAt=new Date().toISOString();entry.updatedAt=entry.removedAt;delete entry.snapshot;delete entry.categories;}
            addHistoryRecord('還原',restored,entry.kind==='trash'?'從垃圾桶還原':'還原筆記版本');
            autoSave(100);updateCategoryUi();noteBrowse.requestReveal(restored.id);filterNotes();
            if(status)status.textContent='已還原到筆記，正在自動同步。';showPreviewModeToast('已還原筆記，修改會自動同步。');return true;
        }catch(error){if(status)status.textContent='還原未完成：'+error.message;return false;}
        finally{busy=false;render();}
    }
    function remove() {
        const entry=entries.find(item=>item.id===selected&&!item.removedAt);if(!entry||busy)return;
        if(previewModeBlocksEditing())return;
        if(!confirm('確定移除此'+(entry.kind==='trash'?'垃圾桶項目':'版本')+'？這不會刪除目前的筆記。'))return;
        entry.removedAt=new Date().toISOString();entry.updatedAt=entry.removedAt;delete entry.snapshot;delete entry.categories;autoSave(100);render();
    }
    function initialize() {
        if(initialized)return;initialized=true;
        const button=document.createElement('button');button.id='note-recovery-open';button.type='button';button.textContent='垃圾桶與版本';button.addEventListener('click',()=>open());
        document.querySelector('.drive-workspace-top').append(button);
        const dialog=document.createElement('dialog');dialog.id='note-recovery-dialog';dialog.className='modal-overlay note-recovery-dialog';dialog.setAttribute('aria-labelledby','note-recovery-title');
        dialog.innerHTML='<div class="note-recovery-header"><h2 id="note-recovery-title">垃圾桶與筆記版本</h2><button type="button" data-recovery-close aria-label="關閉垃圾桶與版本">關閉</button></div><p class="note-recovery-hint">垃圾桶保留 30 天。版本每篇最多 10 份、全科目最多 200 份；還原前會保留目前內容。</p><div class="note-recovery-tools"><button type="button" data-recovery-tab="trash" aria-pressed="true">垃圾桶</button><button type="button" data-recovery-tab="version" aria-pressed="false">筆記版本</button><input type="search" data-recovery-filter placeholder="搜尋標題或內文" aria-label="搜尋垃圾桶或版本"></div><div class="note-recovery-grid"><div data-recovery-list aria-label="可還原的項目"></div><section data-recovery-preview aria-label="版本內容預覽"></section></div><p data-recovery-message role="status"></p><div class="note-recovery-actions"><button type="button" data-recovery-remove>移除此項目</button><button type="button" data-recovery-restore>還原選取內容</button></div>';
        document.body.append(dialog);
        dialog.addEventListener('click',event=>{const target=event.target.closest('button');if(!target)return;if(target.hasAttribute('data-recovery-close')&&!busy)dialog.close();if(target.dataset.recoveryTab){tab=target.dataset.recoveryTab;selected=null;render();}if(target.dataset.recoveryEntry){selected=target.dataset.recoveryEntry;render();}if(target.hasAttribute('data-recovery-restore'))void restore();if(target.hasAttribute('data-recovery-remove'))remove();});
        dialog.querySelector('[data-recovery-filter]').addEventListener('input',render);
        dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
        dialog.addEventListener('close',()=>{dialog.classList.remove('active');opener?.focus?.({preventScroll:true});});
        updateBadge();
    }
    return {initialize,load,carriers,beforeEdit,trash,open,restore,render,entries:()=>copy(entries)};
})();

/* Source: 87-draw-log.js */
/* 抽取記錄 — every random draw is remembered (time, range, which notes), and each drawn
 * note can be marked 熟 / 不熟. Stored with the notes in Google Drive, so it is the same
 * on phone and computer. Kept for 180 days. Marks never change how notes are drawn. */
const noteDrawLog = (() => {
    'use strict';
    const KEEP_DAYS = 180, KEEP_SESSIONS = 1500;
    const SCOPE_LABEL = {filtered: '目前篩選結果', all: '全部筆記', starred: '星號筆記', category: '分類筆記', review: '複習'};
    let filter = 'all';
    const uid = () => crypto.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

    const dayKey = iso => {const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');};
    const today = () => dayKey(new Date().toISOString());
    const noteById = id => notesData.find(n => String(n.id) === String(id));
    const noteLabel = note => note ? (note.title || notePlainText(note.text || '').slice(0, 40) || '（沒有文字的筆記）') : '（這則筆記已刪除）';

    function normalize(records) {
        if (!Array.isArray(records)) return [];
        return records.filter(s => s && typeof s.id === 'string' && !Number.isNaN(Date.parse(s.at)) && Array.isArray(s.items))
            .map(s => ({id: s.id, at: s.at, scope: String(s.scope || ''), categoryName: s.categoryName ? String(s.categoryName).slice(0, 40) : undefined,
                updatedAt: s.updatedAt || s.at,
                items: s.items.filter(i => i && i.noteId != null).map(i => ({noteId: String(i.noteId), mark: i.mark === 'known' || i.mark === 'unknown' ? i.mark : null, markedAt: i.markedAt || null}))}));
    }
    function prune(list) {
        const limit = Date.now() - KEEP_DAYS * 86400000;
        return list.filter(s => Date.parse(s.at) >= limit).sort((a, b) => a.at.localeCompare(b.at)).slice(-KEEP_SESSIONS);
    }
    function record(selected, scope) {
        const now = new Date().toISOString(), id = 'draw-' + uid();
        const cat = scope === 'category' ? getCategoryById(activeCategoryFilterId) : null;
        drawLog.push({id, at: now, updatedAt: now, scope, ...(cat ? {categoryName: cat.name} : {}), items: selected.map(n => ({noteId: String(n.id), mark: null, markedAt: null}))});
        drawLog = prune(drawLog);
        autoSave();
        refreshEntry();
        return id;
    }
    /* Which draw does a mark belong to: the draw on screen, otherwise the latest one with this note. */
    function sessionFor(noteId) {
        const current = drawLog.find(s => s.id === randomDrawState.sessionId && s.items.some(i => i.noteId === String(noteId)));
        return current || [...drawLog].reverse().find(s => s.items.some(i => i.noteId === String(noteId)));
    }
    function markOf(noteId) {return sessionFor(noteId)?.items.find(i => i.noteId === String(noteId))?.mark || null;}
    function mark(noteId, value) {
        const session = sessionFor(noteId);
        if (!session) return;
        const item = session.items.find(i => i.noteId === String(noteId));
        const now = new Date().toISOString();
        item.mark = item.mark === value ? null : value;   // pressing the same button again clears it
        item.markedAt = item.mark ? now : null;
        session.updatedAt = now;
        autoSave();
        document.querySelectorAll('[data-draw-mark="' + CSS.escape(String(noteId)) + '"]').forEach(bar => paintBar(bar, item.mark));
        if (document.getElementById('drawLogModal')?.classList.contains('active')) render();
        refreshEntry();
    }
    function paintBar(bar, value) {
        bar.dataset.mark = value || '';
        bar.querySelectorAll('button[data-mark]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mark === value)));
    }
    function markBarHtml(noteId) {
        const value = markOf(noteId), id = escapeAttribute(String(noteId));
        return `<div class="draw-mark" data-draw-mark="${id}" data-mark="${value || ''}"><span>這則熟嗎？</span>` +
            `<button type="button" data-mark="known" aria-pressed="${value === 'known'}" data-on-click="markDrawnNote" data-args="[${inlineJsArgument(noteId)},&quot;known&quot;]" data-stop>熟</button>` +
            `<button type="button" data-mark="unknown" aria-pressed="${value === 'unknown'}" data-on-click="markDrawnNote" data-args="[${inlineJsArgument(noteId)},&quot;unknown&quot;]" data-stop>不熟</button></div>`;
    }
    function todayUnknownIds() {
        const ids = [];
        for (const s of drawLog) if (dayKey(s.at) === today()) for (const i of s.items) if (i.mark === 'unknown' && !ids.includes(i.noteId) && noteById(i.noteId)) ids.push(i.noteId);
        return ids.filter(id => markOf(id) === 'unknown');
    }
    function show(ids, label, sessionId = null) {
        const list = ids.filter(id => noteById(id));
        if (!list.length) {showPreviewModeToast('這裡沒有可以顯示的筆記（可能已刪除）。'); return;}
        closeDrawLogModal();
        randomDrawState = {active: true, selectedIds: list.map(id => noteById(id).id), count: randomDrawState.count || 1, scope: 'review', reviewLabel: label, sessionId};
        renderNotes(list.map(noteById));
        updateRandomFilterBar();
        window.scrollTo({top: 0, behavior: 'smooth'});
    }
    function dayTitle(key) {
        const d = new Date(key + 'T00:00:00'), t = new Date(today() + 'T00:00:00'), diff = Math.round((t - d) / 86400000);
        const week = '日一二三四五六'[d.getDay()];
        return (diff === 0 ? '今天' : diff === 1 ? '昨天' : (d.getMonth() + 1) + '月' + d.getDate() + '日') + '（週' + week + '）';
    }
    function render() {
        const box = document.getElementById('draw-log-list');
        if (!box) return;
        document.querySelectorAll('#drawLogModal [data-draw-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.drawFilter === filter)));
        const unknownToday = todayUnknownIds();
        const todayBtn = document.getElementById('draw-log-today-unknown');
        todayBtn.disabled = !unknownToday.length;
        todayBtn.textContent = unknownToday.length ? '顯示今天不熟的 ' + unknownToday.length + ' 則' : '今天沒有標記不熟的筆記';
        const sessions = [...drawLog].reverse().filter(s => filter === 'all' || s.items.some(i => i.mark === 'unknown'));
        if (!sessions.length) {box.innerHTML = '<p class="draw-log-empty">' + (filter === 'all' ? '還沒有抽取記錄。抽一次筆記後就會出現在這裡。' : '沒有標記為「不熟」的筆記。') + '</p>'; return;}
        let html = '', lastDay = '';
        for (const s of sessions) {
            const key = dayKey(s.at);
            if (key !== lastDay) {html += '<h4 class="draw-log-day">' + escapeHtml(dayTitle(key)) + '</h4>'; lastDay = key;}
            const time = new Date(s.at).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit', hour12: false});
            const scope = s.scope === 'category' && s.categoryName ? '分類「' + s.categoryName + '」' : (SCOPE_LABEL[s.scope] || '筆記');
            const items = s.items.filter(i => filter === 'all' || i.mark === 'unknown');
            const known = s.items.filter(i => i.mark === 'known').length, unknown = s.items.filter(i => i.mark === 'unknown').length;
            html += '<section class="draw-log-session"><div class="draw-log-head"><b>' + escapeHtml(time) + '</b><span>從' + escapeHtml(scope) + '抽 ' + s.items.length + ' 則' +
                (known || unknown ? '・熟 ' + known + '・不熟 ' + unknown : '') + '</span>' +
                '<button type="button" data-on-click="showDrawSession" data-args="[' + inlineJsArgument(s.id) + ']">再看這次</button></div><ul>';
            for (const i of items) {
                const note = noteById(i.noteId);
                const badge = i.mark === 'known' ? '<em class="is-known">熟</em>' : i.mark === 'unknown' ? '<em class="is-unknown">不熟</em>' : '<em>未標記</em>';
                html += '<li>' + badge + (note ? '<button type="button" class="draw-log-note" data-on-click="locateDrawLogNote" data-args="[' + inlineJsArgument(i.noteId) + ']">' + escapeHtml(noteLabel(note)) + '</button>' : '<span class="draw-log-gone">' + noteLabel(null) + '</span>') + '</li>';
            }
            html += '</ul></section>';
        }
        box.innerHTML = html;
    }
    /* Small summary on the 隨機抽筆記 window's entry button. */
    function refreshEntry() {
        const button = document.getElementById('btn-open-draw-log');
        if (!button) return;
        const todays = drawLog.filter(s => dayKey(s.at) === today());
        const unknown = todayUnknownIds().length;
        button.textContent = '抽取記錄' + (todays.length ? '（今天 ' + todays.length + ' 次' + (unknown ? '、' + unknown + ' 則不熟' : '') + '）' : '');
    }
    function open() {filter = 'all'; render(); document.getElementById('drawLogModal').classList.add('active');}
    return {normalize, prune, record, mark, markBarHtml, markOf, open, render, refreshEntry, todayUnknownIds, show, setFilter: value => {filter = value === 'unknown' ? 'unknown' : 'all'; render();},
        session: id => drawLog.find(s => s.id === id)};
})();

function openDrawLogModal() {closeRandomDrawModal(); noteDrawLog.open();}
function closeDrawLogModal() {document.getElementById('drawLogModal')?.classList.remove('active');}
function markDrawnNote(noteId, value) {noteDrawLog.mark(noteId, value);}
function setDrawLogFilter(value) {noteDrawLog.setFilter(value);}
function showTodayUnknownNotes() {noteDrawLog.show(noteDrawLog.todayUnknownIds(), '今天不熟的筆記');}
function showDrawSession(id) {
    const s = noteDrawLog.session(id);
    if (s) noteDrawLog.show(s.items.map(i => i.noteId), new Date(s.at).toLocaleString('zh-TW', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false}) + ' 抽到的筆記', s.id);
}
function locateDrawLogNote(id) {closeDrawLogModal(); locateHistoryNote(id);}
/* Source: 88-image-preferences.js */
/* Image annotation preferences are independent of note text colors and note/image data. */
const noteImagePalette=Object.freeze(['#ef4444','#facc15','#22c55e','#2563eb','#8b5cf6','#111827','#ffffff']);
function createNoteImageColorMemory(options={}){
    const defaults=noteImagePalette;
    const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value.trim())?value.trim().toLowerCase():null;
    const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(color).filter(Boolean))];
    const boot=typeof noteDriveBoot==='undefined'?{}:noteDriveBoot;
    let hash=2166136261;for(const c of String(boot.workspace||boot.appUrl||'pharmacy-notes'))hash=Math.imul(hash^c.charCodeAt(0),16777619);
    const key=options.key||'pharmacy-note-image-colors-v1-'+(hash>>>0).toString(36);
    let storage,failed=false,editing=false,view=null,viewColor=defaults[0],viewReady=false,viewSignature='',paletteSignature='';
    const empty=()=>({v:1,colors:[],last:defaults[0],removed:[]});
    let state=empty();
    try{storage=Object.prototype.hasOwnProperty.call(options,'storage')?options.storage:window.localStorage;if(!storage)failed=true;}catch(_){failed=true;}
    function read(){
        if(failed)return;
        let raw;try{raw=storage.getItem(key);}catch(_){failed=true;return;}
        if(!raw){state=empty();return;}
        try{
            const value=JSON.parse(raw);if(value?.v!==1)return;
            const removed=unique(value.removed).filter(c=>!defaults.includes(c));
            state={v:1,colors:unique(value.colors).filter(c=>!defaults.includes(c)&&!removed.includes(c)),last:color(value.last)||defaults[0],removed};
            if(removed.includes(state.last))state.last=defaults[0];
        }catch(_){/* A malformed optional preference must never block image editing. */}
    }
    function mutate(change){
        read();const before=JSON.stringify(state);change();
        if(before!==JSON.stringify(state))try{if(!storage)throw Error('No color storage');storage.setItem(key,JSON.stringify(state));failed=false;}catch(_){failed=true;}
        render(viewColor,viewReady);
    }
    function add(value,explicit=false){
        const c=color(value);if(!c)return;
        if(explicit)state.removed=state.removed.filter(old=>old!==c);
        if(!defaults.includes(c)&&!state.removed.includes(c)&&!state.colors.includes(c))state.colors.push(c);
    }
    function remember(value,previous=[]){
        const c=color(value);if(!c)return;
        mutate(()=>{for(const old of previous)add(old);add(c,true);state.last=c;});
    }
    function adopt(values){mutate(()=>{for(const c of values||[])add(c);});}
    function forget(value){
        const c=color(value);if(!c||defaults.includes(c))return;
        mutate(()=>{state.colors=state.colors.filter(old=>old!==c);if(!state.removed.includes(c))state.removed.push(c);if(state.last===c)state.last=defaults[0];});
    }
    function render(active=state.last,ready=false){
        viewColor=color(active)||defaults[0];viewReady=!!ready;if(!view)return;
        const signature=JSON.stringify([state.colors,editing,viewColor,viewReady,failed]);if(signature===viewSignature)return;viewSignature=signature;
        view.root.hidden=!state.colors.length&&!editing&&!failed;
        view.manage.hidden=!state.colors.length&&!editing;view.manage.disabled=!viewReady;
        view.manage.textContent=editing?'完成':'刪色';view.manage.setAttribute('aria-pressed',String(editing));
        view.status.textContent=failed?'此瀏覽器目前無法保存色票，本次開啟仍可使用。':editing?'點色票移除記憶；圖片上的標記會保留。':'';
        const colorsKey=JSON.stringify(state.colors);
        if(colorsKey!==paletteSignature){
            const fragment=document.createDocumentFragment();
            for(const c of state.colors){
                const button=document.createElement('button');button.type='button';button.className='nie-swatch nie-memory-swatch';
                button.dataset.nieMemoryColor=c;button.style.setProperty('--swatch',c);fragment.appendChild(button);
            }
            view.swatches.replaceChildren(fragment);paletteSignature=colorsKey;
        }
        // A selected-mark/color/readiness update must not replace a button under the pointer or keyboard focus.
        for(const button of view.swatches.children){
            const c=button.dataset.nieMemoryColor;button.disabled=!viewReady;
            button.setAttribute('aria-label',(editing?'刪除記憶色 ':'使用記憶色 ')+c);button.setAttribute('aria-pressed',String(!editing&&c===viewColor));
            button.title=(editing?'刪除色票 ':'使用顏色 ')+c;if(editing)button.dataset.removing='true';else delete button.dataset.removing;
        }
    }
    function mount(root,choose){
        if(!root||view)return;
        view={root,choose,swatches:root.querySelector('[data-nie-memory-swatches]'),manage:root.querySelector('[data-nie-memory-manage]'),status:root.querySelector('[data-nie-memory-status]')};
        root.addEventListener('click',event=>{
            const button=event.target.closest('button');if(!button||button.disabled||!root.contains(button))return;
            event.preventDefault();event.stopPropagation();
            if(button.hasAttribute('data-nie-memory-manage')){editing=!editing;render(viewColor,viewReady);return;}
            const c=color(button.dataset.nieMemoryColor);if(!c)return;
            if(editing)forget(c);else choose(c);
        });
        render(viewColor,viewReady);
    }
    function begin(){read();editing=false;render(state.last,false);return state.last;}
    read();
    if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===key&&!failed){read();render(viewColor,viewReady);}});
    return {begin,remember,adopt,forget,mount,render,snapshot:()=>JSON.parse(JSON.stringify({...state,failed,key}))};
}


/* Source: 89-external-images.js */
/* Images dragged or pasted as web links (Yamol, Google Images, any site) are downloaded and
   stored with the note. Sites that allow it are read directly by the browser; the rest go
   through the owner's image proxy, because a browser may show another site's image but not
   read its bytes. */
const noteExternalImages=(()=>{
    const pending=new Map(),cache=new Map();
    function normalize(value){
        const u=new URL(String(value).trim(),location.href);
        if(!['http:','https:','blob:','data:'].includes(u.protocol)||u.username||u.password)throw Error('圖片網址無效');
        if(u.protocol==='http:'&&isYamol(u.hostname))u.protocol='https:';
        if(/^https?:$/.test(u.protocol))u.hash='';return u.href;
    }
    const isYamol=host=>host==='yamol.tw'||host.endsWith('.yamol.tw');
    function supported(value){try{return /^https?:$/.test(new URL(normalize(value)).protocol);}catch(_){return false;}}
    const fallbacks=new Map();
    function setFallback(url,fallback){if(url&&fallback&&url!==fallback)fallbacks.set(url,fallback);while(fallbacks.size>50)fallbacks.delete(fallbacks.keys().next().value);}
    function abort(signal){if(signal?.aborted)throw Error('已停止圖片載入');}
    function read(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('圖片讀取失敗'));r.readAsDataURL(blob);});}
    async function direct(url){
        if(isYamol(new URL(url).hostname))return null;          // Yamol never allows direct reads
        try{
            const response=await fetch(url,{credentials:'omit',referrerPolicy:'no-referrer'});
            if(!response.ok)return null;
            const blob=await response.blob();
            return blob.type.startsWith('image/')&&blob.size<=16*1024*1024?read(blob):null;
        }catch(_){return null;}
    }
    async function fetchImage(url){
        const quick=await direct(url);if(quick)return quick;
        const result=await noteDriveRpc('externalImage',{url},noteDriveBoot.book,undefined,0);
        if(!result.data||!/^image\//.test(result.mime)||!Number.isSafeInteger(result.bytes)||result.bytes>16*1024*1024)throw Error('外部圖片回覆不完整');
        const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0)),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
        if(bytes.length!==result.bytes||hash!==result.key)throw Error('外部圖片校驗失敗，請重試');
        return 'data:'+result.mime+';base64,'+result.data;
    }
    async function resolve(value,{signal}={}){
        abort(signal);const url=normalize(value);if(url.startsWith('data:image/'))return url;
        if(cache.has(url)){const source=cache.get(url);cache.delete(url);cache.set(url,source);return source;}
        if(!pending.has(url))pending.set(url,fetchImage(url).then(source=>{
            cache.set(url,source);while(cache.size>8||[...cache.values()].reduce((sum,v)=>sum+v.length,0)>32*1024*1024)cache.delete(cache.keys().next().value);return source;
        }).finally(()=>pending.delete(url)));
        const result=await pending.get(url);abort(signal);return result;
    }
    async function prepareInsert(source){
        if(!supported(source))return source;
        try{return await resolve(source);}
        catch(error){
            const fallback=fallbacks.get(source);   // e.g. the Google Images thumbnail when the full-size page blocks downloads
            if(fallback){try{return fallback.startsWith('data:image/')?fallback:await resolve(fallback);}catch(_){}}
            showPreviewModeToast('圖片連結已保留，原圖匯入未完成：'+error.message+'。可稍後按「編輯／標記」重試。');return source;
        }
    }
    return {resolve,supported,prepareInsert,normalize,setFallback};
})();

/* Source: 90-image-storage.js */
/* Compatibility and lossless storage for images created before Studio v4.
 * UI and event handlers live only in noteImageStudio. */
const noteImageStorage = (() => {
        const ATTR = 'data-note-image-edit', MAX_PIXELS = 12000000, MAX_EDGE = 4096;
        const IDENTITY = [1, 0, 0, 1, 0, 0];
        const matrixOf = mark => mark.matrix || IDENTITY;
        const copy = value => JSON.parse(JSON.stringify(value));
        const bounded = (n, low, high) => Math.max(low, Math.min(high, Number(n) || 0));
        const galleryKey = source => {
            let hash = 2166136261;
            for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
            return source.length + '-' + (hash >>> 0).toString(36);
        };
        const galleryData = () => Object.fromEntries(currentPastedImages.map(src => [galleryKey(src), currentGalleryImageEdits[galleryKey(src)]]).filter(([, value]) => value));
        const blankDoc = (w, h) => ({ crop: { x: 0, y: 0, w, h }, rotation: 0, flip: false, marks: [] });
        const compactCache = new Map(), sourceCache = new Map(), losslessCache = new Map();
        function sourceKey(source) {
            let a = 2166136261, b = 2246822507;
            for (let i = 0; i < source.length; i++) { const c = source.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 3266489909); }
            return 'note-image-source:' + source.length + ':' + (a >>> 0).toString(36) + ':' + (b >>> 0).toString(36);
        }
        function cacheSource(src, source) {
            if (src.length > 16000000) return;
            sourceCache.set(src, source);
            while (sourceCache.size > 4 || [...sourceCache.keys()].reduce((n, key) => n + key.length, 0) > 16000000) sourceCache.delete(sourceCache.keys().next().value);
        }
        function embeddedSource(src) {
            if (sourceCache.has(src)) return sourceCache.get(src);
            if (!/^data:image\/svg\+xml[;,]/i.test(src)) throw new Error('圖片的原圖封裝格式不正確');
            const comma = src.indexOf(','), header = src.slice(0, comma);
            const xml = /;base64/i.test(header) ? new TextDecoder().decode(Uint8Array.from(atob(src.slice(comma + 1)), c => c.charCodeAt(0))) : decodeURIComponent(src.slice(comma + 1));
            const root = new DOMParser().parseFromString(xml, 'image/svg+xml');
            const source = root.querySelector('image[id="note-image-source"]')?.getAttribute('href');
            if (root.querySelector('parsererror') || !/^data:image\//i.test(source || '')) throw new Error('圖片中的原圖資料不完整');
            cacheSource(src, source);
            return source;
        }
        function imageIdentity(src, metadata) {
            if (![1, 2, 3].includes(metadata?.v) || !metadata.doc) return null;
            const source = metadata.v === 3 ? embeddedSource(src) : metadata.source;
            if (!/^data:image\//i.test(source || '')) return null;
            const doc = copy(metadata.doc);
            doc.marks = (doc.marks || []).map(mark => ({ ...mark, matrix: mark.matrix || [...IDENTITY] }));
            const storedKey = sourceKey(source);
            const key = metadata.v === 3 && metadata.storedKey === storedKey && /^note-image-source:\d+:[a-z0-9]+:[a-z0-9]+$/.test(metadata.sourceKey || '') ? metadata.sourceKey : storedKey;
            const plain = metadata.plain === true && !doc.marks.length && !doc.rotation && !doc.flip && doc.crop?.x === 0 && doc.crop?.y === 0 && doc.crop.w === metadata.w && doc.crop.h === metadata.h;
            return { source, doc, key, plain };
        }
        function readBlob(blob) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('圖片讀取失敗')); r.readAsDataURL(blob); }); }
        async function loadSource(src, signal) {
            if (!/^data:image\//i.test(src)) {
                src = await noteExternalImages.resolve(src,{signal});
            }
            const image = new Image(); image.decoding = 'async'; image.src = src;
            await noteImageReady(image);
            if (!image.naturalWidth || !image.naturalHeight) throw new Error('圖片尺寸無效');
            const probe = document.createElement('canvas'); probe.width = probe.height = 1;
            probe.getContext('2d').drawImage(image, 0, 0, 1, 1); probe.toDataURL();
            return { image, src };
        }
        function validateDoc(value, w, h) {
            if (!value || !Array.isArray(value.marks) || value.marks.length > 1000) throw new Error('標記資料格式無效');
            const d = blankDoc(w, h), c = value.crop || d.crop;
            d.crop = { x: bounded(c.x, 0, w - 1), y: bounded(c.y, 0, h - 1), w: 1, h: 1 };
            d.crop.w = bounded(c.w, 1, w - d.crop.x); d.crop.h = bounded(c.h, 1, h - d.crop.y);
            d.rotation = bounded(Math.round(value.rotation), 0, 3); d.flip = !!value.flip;
            d.marks = value.marks.map(m => {
                if (!['pen', 'arrow', 'rect', 'highlight', 'text'].includes(m.type) || !Array.isArray(m.points) || !m.points.length || m.points.length > 20000) throw new Error('標記資料格式無效');
                const matrix = m.matrix || IDENTITY;
                if (!Array.isArray(matrix) || matrix.length !== 6 || !matrix.every(n => Number.isFinite(n) && Math.abs(n) < 1e7) || Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]) < 1e-8) throw new Error('標記變形資料無效');
                return { type: m.type, points: m.points.map(p => ({ x: bounded(p.x, 0, w), y: bounded(p.y, 0, h) })), color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#ef4444', width: bounded(m.width, 1, 200), font: bounded(m.font, 8, 500), text: String(m.text || '').slice(0, 2000), matrix: [...matrix] };
            });
            return d;
        }
        function sceneGeometry(s, full = false) {
            const c = full ? { x: 0, y: 0, w: s.w, h: s.h } : s.doc.crop;
            const r = s.doc.rotation, w = r % 2 ? c.h : c.w, h = r % 2 ? c.w : c.h;
            let m = [[1, 0, 0, 1, -c.x, -c.y], [0, 1, -1, 0, c.h + c.y, -c.x], [-1, 0, 0, -1, c.w + c.x, c.h + c.y], [0, -1, 1, 0, -c.y, c.w + c.x]][r];
            if (s.doc.flip) m = [-m[0], m[1], -m[2], m[3], w - m[4], m[5]];
            return { w, h, m };
        }
        function pointsBox(points) { const xs = points.map(p => p.x), ys = points.map(p => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }
        function drawMark(ctx, m) {
            const p = m.points[0], q = m.points[m.points.length - 1];
            ctx.save(); ctx.transform(...matrixOf(m)); ctx.strokeStyle = ctx.fillStyle = m.color; ctx.lineWidth = m.width; ctx.lineJoin = ctx.lineCap = 'round';
            if (m.type === 'text') { ctx.font = `600 ${m.font}px system-ui, sans-serif`; ctx.textBaseline = 'top'; m.text.split('\n').forEach((line, i) => ctx.fillText(line, p.x, p.y + i * m.font * 1.25)); }
            else if (m.type === 'rect' || m.type === 'highlight') { const b = pointsBox(m.points); if (m.type === 'highlight') { ctx.globalAlpha = .28; ctx.fillRect(b.x, b.y, b.w, b.h); } else ctx.strokeRect(b.x, b.y, b.w, b.h); }
            else {
                ctx.beginPath(); ctx.moveTo(p.x, p.y); m.points.slice(1).forEach(t => ctx.lineTo(t.x, t.y));
                if (m.points.length === 1) { ctx.lineTo(p.x + .01, p.y); } ctx.stroke();
                if (m.type === 'arrow') {
                    const angle = Math.atan2(q.y - p.y, q.x - p.x), length = Math.min(Math.hypot(q.x - p.x, q.y - p.y) * .45, Math.max(m.width * 4, 12));
                    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - length * Math.cos(angle - .48), q.y - length * Math.sin(angle - .48)); ctx.lineTo(q.x - length * Math.cos(angle + .48), q.y - length * Math.sin(angle + .48)); ctx.closePath(); ctx.fill();
                }
            }
            ctx.restore();
        }
        function drawScene(canvas, g, scale, preview = false, scene = null, original = true) {
            canvas.width = Math.max(1, Math.round(g.w * scale)); canvas.height = Math.max(1, Math.round(g.h * scale));
            const ctx = canvas.getContext('2d'), sx = canvas.width / g.w, sy = canvas.height / g.h, m = g.m;
            ctx.setTransform(sx * m[0], sy * m[1], sx * m[2], sy * m[3], sx * m[4], sy * m[5]);
            if (original) ctx.drawImage(scene.image, 0, 0);
            scene.doc.marks.forEach((mark, index) => { if (!preview || scene.textEdit?.index !== index) drawMark(ctx, mark); });
            ctx.setTransform(sx, 0, 0, sy, 0, 0); return ctx;
        }
        function encodedImageAttribute(src) {
            // 二進位 base64 本身不必再做 URL/base64 編碼，避免原圖多出三分之一。
            if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(src)) return src;
            return encodeURIComponent(src.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        }
        async function smallerSource(source, image) {
            if (!/^data:image\/png[;,]/i.test(source) || image.naturalWidth * image.naturalHeight > MAX_PIXELS) return source;
            if (losslessCache.has(source)) return losslessCache.get(source);
            const promise = (async () => {
                const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const ctx = canvas.getContext('2d', {willReadFrequently:true});
                try {
                    ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 1));
                    if (!blob || blob.type !== 'image/webp') return source;
                    const candidate = await readBlob(blob);
                    if (candidate.length >= source.length * .97) return source;
                    const check = new Image(); check.src = candidate; await noteImageReady(check);
                    if (check.naturalWidth !== canvas.width || check.naturalHeight !== canvas.height) return source;
                    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(check, 0, 0);
                    const verified = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                    // 不假設瀏覽器的品質 1 一定無損；逐一核對所有 RGBA 通道才採用。
                    for (let i = 0; i < pixels.length; i++) if (pixels[i] !== verified[i]) return source;
                    return candidate;
                } catch (_) { return source; }
                finally { canvas.width = canvas.height = 1; }
            })();
            losslessCache.set(source, promise);
            while (losslessCache.size > 24 || [...losslessCache.keys()].reduce((n,key)=>n+key.length,0)>24000000) losslessCache.delete(losslessCache.keys().next().value);
            return promise;
        }
        async function packageImage(scene, {plain = false, source = null} = {}) {
            const g = sceneGeometry(scene), scale = Math.min(1, MAX_EDGE / Math.max(g.w, g.h), Math.sqrt(MAX_PIXELS / (g.w * g.h)));
            const stored = source || await smallerSource(scene.original, scene.image);
            const width = Math.max(1, Math.round(g.w * scale)), height = Math.max(1, Math.round(g.h * scale));
            let marks = '';
            if (scene.doc.marks.length) {
                const overlay = document.createElement('canvas'); drawScene(overlay, g, scale, false, scene, false);
                const blob = await new Promise((resolve, reject) => overlay.toBlob(b => b ? resolve(b) : reject(new Error('無法產生標記圖層')), 'image/png'));
                marks = await readBlob(blob); overlay.width = overlay.height = 1;
            }
            const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${g.w} ${g.h}" overflow="hidden"><g transform="matrix(${g.m.join(' ')})"><image id="note-image-source" width="${scene.w}" height="${scene.h}" href="NOTE_SOURCE_DATA"/></g>${marks?`<image width="${g.w}" height="${g.h}" href="NOTE_MARKS_DATA"/>`:''}</svg>`;
            const src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml).replace('NOTE_SOURCE_DATA', encodedImageAttribute(stored)).replace('NOTE_MARKS_DATA', encodedImageAttribute(marks));
            // 套用前確認瀏覽器真的能顯示，失敗時保留原筆記與編輯視窗。
            const check = new Image(); check.src = src; await noteImageReady(check);
            cacheSource(src, stored);
            return { src, metadata: { v: 3, sourceKey: scene.originalKey || sourceKey(scene.original), storedKey: sourceKey(stored), w:scene.w, h:scene.h, ...(plain?{plain:true}:{}), doc: copy(scene.doc) } };
        }
        async function compactImage(src, metadata) {
            if (![1, 2].includes(metadata?.v)) return { src, metadata };
            const key = JSON.stringify(metadata), cached = compactCache.get(src);
            if (cached?.key === key) return cached.promise;
            const promise = (async () => {
                const identity = imageIdentity(src, metadata);
                if (!identity) throw new Error('舊圖片的原圖或標記資料不完整；已保留本機內容');
                const loaded = await loadSource(identity.source);
                const w = loaded.image.naturalWidth, h = loaded.image.naturalHeight;
                const doc = validateDoc(identity.doc, w, h);
                return packageImage({ original: loaded.src, originalKey: identity.key, image: loaded.image, w, h, doc });
            })();
            compactCache.set(src, { key, promise });
            while (compactCache.size > 4) compactCache.delete(compactCache.keys().next().value);
            try { return await promise; } catch (error) { compactCache.delete(src); throw error; }
        }
        async function compactPlainImage(src) {
            if (!/^data:image\/png[;,]/i.test(src || '')) return null;
            const cached = compactCache.get(src); if (cached?.key === 'plain') return cached.promise;
            const promise = (async () => {
                const loaded = await loadSource(src), source = await smallerSource(loaded.src, loaded.image);
                if (source === loaded.src) return null;
                const w = loaded.image.naturalWidth, h = loaded.image.naturalHeight;
                return packageImage({ original:loaded.src, image:loaded.image, w,h,doc:blankDoc(w,h) }, {plain:true,source});
            })();
            compactCache.set(src,{key:'plain',promise});while(compactCache.size>24)compactCache.delete(compactCache.keys().next().value);
            try{return await promise;}catch(_){compactCache.delete(src);return null;}
        }
        async function compactPayload(payload, {compressAll = false} = {}) {
            let converted = 0;
            const notes = [];
            for (const note of payload) {
                let next = note;
                if (note.text?.includes(ATTR) || (compressAll && note.text?.includes('<img'))) {
                    const template = document.createElement('template'); template.innerHTML = note.text;
                    let changed = false;
                    for (const img of template.content.querySelectorAll('img')) {
                        let metadata; try { metadata = JSON.parse(img.getAttribute(ATTR)); } catch (_) { throw new Error('圖片標記資料無法讀取；已停止上傳以保留原圖'); }
                        const result = [1,2].includes(metadata?.v) ? await compactImage(img.getAttribute('src'), metadata) : compressAll && !metadata ? await compactPlainImage(img.getAttribute('src')) : null;
                        if (!result) continue;
                        img.setAttribute('src', result.src); img.setAttribute(ATTR, JSON.stringify(result.metadata)); changed = true; converted++;
                    }
                    if (changed) next = { ...next, text: template.innerHTML };
                }
                if (note.galleryImageEdits || compressAll) {
                    const edits = { ...note.galleryImageEdits };let galleryChanged = false;
                    for (const name of ['images', 'galleryImages', 'pastedImages', 'uploadedImages', 'imageUrls', 'image']) {
                        const sources = name === 'image' ? [note.image] : note[name]; if (!Array.isArray(sources)) continue;
                        let changed = false; const values = [];
                        for (const src of sources) {
                            const metadata = edits[galleryKey(src || '')];
                            const result = [1,2].includes(metadata?.v) ? await compactImage(src, metadata) : compressAll && !metadata ? await compactPlainImage(src) : null;
                            if (!result) { values.push(src); continue; }
                            values.push(result.src); edits[galleryKey(result.src)] = result.metadata; changed = galleryChanged = true; converted++;
                        }
                        if (changed) next = { ...next, [name]: name === 'image' ? values[0] : values };
                    }
                    if (galleryChanged) {
                        const keys = new Set(['images', 'galleryImages', 'pastedImages', 'uploadedImages', 'imageUrls'].flatMap(name => next[name] || []).concat(next.image || []).map(galleryKey));
                        next.galleryImageEdits = Object.fromEntries(Object.entries(edits).filter(([key]) => keys.has(key)));
                    }
                }
                notes.push(next);
            }
            return { notes, converted };
        }
        return {galleryKey, galleryData, imageIdentity, sourceKey, compactPayload};
})();


/* Source: 91-image-studio-model.js */
/* Editable image documents: immutable source assets plus ordered vector objects. */
const noteStudioModel = (() => {
    const I=[1,0,0,1,0,0], TYPES=new Set(['image','pen','arrow','line','rect','ellipse','highlight','text','badge','callout']);
    const fonts={sans:'Arial, "PingFang TC", "Microsoft JhengHei", sans-serif',serif:'Georgia, "Noto Serif TC", serif',mono:'Consolas, monospace'};
    const copy=value=>JSON.parse(JSON.stringify(value));
    const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    const n=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,n(v,a)));
    const color=(v,fallback='#2563eb')=>/^#[a-f0-9]{6}$/i.test(v||'')?v:fallback;
    const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
    const translate=(x,y)=>[1,0,0,1,x,y];
    const transform=(p,m)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
    function inverse(p,m){const d=m[0]*m[3]-m[1]*m[2],x=p.x-m[4],y=p.y-m[5];return {x:(m[3]*x-m[2]*y)/d,y:(-m[1]*x+m[0]*y)/d};}
    const around=(matrix,p)=>mul(translate(p.x,p.y),mul(matrix,translate(-p.x,-p.y)));
    const rotate=degrees=>{const a=degrees*Math.PI/180;return [Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0];};
    const corners=b=>[{x:b.x||0,y:b.y||0},{x:(b.x||0)+b.w,y:b.y||0},{x:(b.x||0)+b.w,y:(b.y||0)+b.h},{x:b.x||0,y:(b.y||0)+b.h}];
    function box(points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};}
    const objectCorners=o=>corners({w:o.w,h:o.h}).map(p=>transform(p,o.matrix));
    const bounds=o=>box(objectCorners(o));
    const weight=o=>Math.round(clamp(o.weight??(o.bold?700:400),100,900)/100)*100;
    const font=o=>`${o.italic?'italic ':''}${weight(o)} ${o.font}px ${fonts[o.family]||fonts.sans}`;
    const context=document.createElement('canvas').getContext('2d');
    function textLines(o){
        if(o.type==='text')return String(o.text||'').split('\n');
        context.font=font(o);const width=Math.max(1,o.w-12),lines=[];
        for(const paragraph of String(o.text||'').split('\n')){
            let line='';const words=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'word'}).segment(paragraph)].map(v=>v.segment):[...paragraph];
            for(const word of words){
                if(line&&context.measureText(line+word).width>width){lines.push(line);line='';}
                if(context.measureText(word).width<=width){line+=word;continue;}
                for(const char of word){if(line&&context.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}
            }
            lines.push(line);
        }
        return lines;
    }
    function textSize(o){context.font=font(o);return {w:Math.max(24,...textLines(o).map(line=>context.measureText(line).width))+12,h:Math.max(o.font*1.2+12,textLines(o).length*o.font*o.lineHeight+12)};}
    function fitText(o){
        if(o.type==='text'){const size=textSize(o);o.w=o.manualSize?Math.max(o.w,size.w):size.w;o.h=o.manualSize?Math.max(o.h,size.h):size.h;}
        else if(o.type==='callout')o.h=Math.max(o.font*1.2+12,textLines(o).length*o.font*o.lineHeight+30);
        return o;
    }
    function object(type,x,y,w=160,h=100,style={}){
        return {id:uid(),type,name:'',matrix:translate(x,y),w:Math.max(1,w),h:Math.max(1,h),visible:true,locked:false,opacity:type==='highlight'?.28:1,color:'#2563eb',fill:type==='highlight'?'#facc15':null,stroke:3,dash:'solid',font:24,family:'sans',bold:false,italic:false,align:'left',lineHeight:1.4,text:'',...(type==='text'?{textLayout:'manual-lines',manualSize:false}:{}),...style};
    }
    function blank(w,h){return {schema:4,bounds:{x:0,y:0,w,h},crop:{x:0,y:0,w,h},angle:0,flipX:false,flipY:false,background:null,assets:{original:{w,h}},objects:[object('image',0,0,w,h,{id:'background-original',name:'原圖',assetId:'original',locked:true,crop:{x:0,y:0,w,h},brightness:100,contrast:100,saturation:100})]};}
    function geometry(doc,full=false){
        const c=full?doc.bounds:doc.crop,a=rotate(doc.angle),rotated=box(corners(c).map(p=>transform(p,a)));
        let m=mul(translate(-rotated.x,-rotated.y),a);
        if(doc.flipX)m=mul([-1,0,0,1,rotated.w,0],m);
        if(doc.flipY)m=mul([1,0,0,-1,0,rotated.h],m);
        return {w:rotated.w,h:rotated.h,m};
    }
    function validate(value,w,h){
        if(value?.schema!==4||!Array.isArray(value.objects)||value.objects.length>1000)throw Error('圖片文件格式不完整');
        const d=copy(value),validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(id);
        const rect=(v,base)=>({x:clamp(v?.x??base.x,-100000,100000),y:clamp(v?.y??base.y,-100000,100000),w:clamp(v?.w??base.w,1,50000),h:clamp(v?.h??base.h,1,50000)});
        d.bounds=rect(d.bounds,{x:0,y:0,w,h});d.crop=rect(d.crop,d.bounds);
        d.crop.x=clamp(d.crop.x,d.bounds.x,d.bounds.x+d.bounds.w-1);d.crop.y=clamp(d.crop.y,d.bounds.y,d.bounds.y+d.bounds.h-1);
        d.crop.w=Math.min(d.crop.w,d.bounds.x+d.bounds.w-d.crop.x);d.crop.h=Math.min(d.crop.h,d.bounds.y+d.bounds.h-d.crop.y);
        d.angle=clamp(d.angle,-36000,36000);d.flipX=!!d.flipX;d.flipY=!!d.flipY;d.background=color(d.background,null);
        if(!d.assets||Array.isArray(d.assets)||Object.keys(d.assets).length>32)throw Error('圖片素材數量超過限制');
        const assets={};for(const[id,asset]of Object.entries(d.assets)){if(!validId(id))throw Error('圖片素材識別碼無效');assets[id]={w:clamp(asset.w,1,50000),h:clamp(asset.h,1,50000),...(asset.key?{key:String(asset.key).slice(0,120)}:{})};}d.assets=assets;
        const ids=new Set();
        d.objects=d.objects.map(raw=>{
            if(!validId(raw.id)||ids.has(raw.id)||!TYPES.has(raw.type))throw Error('圖片物件識別碼或類型無效');ids.add(raw.id);
            if(!Array.isArray(raw.matrix)||raw.matrix.length!==6||!raw.matrix.every(v=>Number.isFinite(v)&&Math.abs(v)<1e7)||Math.abs(raw.matrix[0]*raw.matrix[3]-raw.matrix[1]*raw.matrix[2])<1e-8)throw Error('圖片物件變形資料無效');
            const o=object(raw.type,0,0,clamp(raw.w,1,50000),clamp(raw.h,1,50000));
            Object.assign(o,{id:raw.id,matrix:[...raw.matrix],name:String(raw.name||'').slice(0,80),visible:raw.visible!==false,locked:!!raw.locked,opacity:clamp(raw.opacity??1,0,1),color:color(raw.color),fill:color(raw.fill,null),stroke:clamp(raw.stroke??3,.1,200),dash:['solid','dashed','dotted'].includes(raw.dash)?raw.dash:'solid',font:clamp(raw.font??24,8,500),family:fonts[raw.family]?raw.family:'sans',bold:!!raw.bold,italic:!!raw.italic,align:['left','center','right'].includes(raw.align)?raw.align:'left',lineHeight:clamp(raw.lineHeight??1.4,.8,3),text:String(raw.text||'').slice(0,4000)});
            if(o.type==='text'){o.weight=weight(raw);o.bold=o.weight>=600;o.manualSize=!!raw.manualSize;if(raw.textLayout!=='manual-lines')fitText(o);}
            if(validId(raw.groupId))o.groupId=raw.groupId;
            if(o.type==='image'){
                if(!assets[raw.assetId])throw Error('圖片物件缺少原始素材');o.assetId=raw.assetId;const a=assets[o.assetId];o.crop=rect(raw.crop,{x:0,y:0,w:a.w,h:a.h});
                o.crop.x=clamp(o.crop.x,0,a.w-1);o.crop.y=clamp(o.crop.y,0,a.h-1);o.crop.w=Math.min(o.crop.w,a.w-o.crop.x);o.crop.h=Math.min(o.crop.h,a.h-o.crop.y);
                for(const key of ['brightness','contrast','saturation'])o[key]=clamp(raw[key]??100,0,200);
            }
            if(['pen','line','arrow'].includes(o.type)){
                if(!Array.isArray(raw.points)||!raw.points.length||raw.points.length>20000)throw Error('筆畫資料無效');
                o.points=raw.points.map(p=>({x:clamp(p.x,-100000,100000),y:clamp(p.y,-100000,100000)}));
            }
            return o;
        });return d;
    }
    function migrate(old,w,h){
        if(old?.schema===4)return validate(old,w,h);
        const d=blank(w,h);if(!old)return d;
        d.crop={...d.crop,...old.crop};d.angle=(old.rotation||0)*90;d.flipX=!!old.flip;
        for(const mark of old.marks||[]){
            const b=box(mark.points),isText=mark.type==='text',o=object(mark.type,b.x,b.y,Math.max(b.w,1),Math.max(b.h,1),{color:mark.color,stroke:mark.width||3,font:mark.font||24,text:mark.text||'',bold:true,opacity:mark.type==='highlight'?.28:1,fill:mark.type==='highlight'?mark.color:null});
            o.matrix=mul(mark.matrix||I,translate(b.x,b.y));
            if(['pen','arrow','line'].includes(o.type))o.points=mark.points.map(p=>({x:p.x-b.x,y:p.y-b.y}));
            if(isText){context.font=font(o);o.w=Math.max(30,...o.text.split('\n').map(line=>context.measureText(line).width))+12;o.lineHeight=1.25;fitText(o);o.matrix=mul(o.matrix,translate(-6,-6));}
            d.objects.push(o);
        }
        return validate(d,w,h);
    }
    function cropImage(o,a){return o.crop||{x:0,y:0,w:a.w,h:a.h};}
    function objectMarkup(o,d){
        const stroke=`stroke="${o.color}" stroke-width="${o.stroke}" stroke-linecap="round" stroke-linejoin="round"${o.dash!=='solid'?` stroke-dasharray="${o.dash==='dotted'?o.stroke+' '+o.stroke*2:o.stroke*4+' '+o.stroke*2}"`:''}`;
        const fill=o.fill||'none';
        if(o.type==='image'){
            const a=d.assets[o.assetId],c=cropImage(o,a),sx=o.w/c.w,sy=o.h/c.h,B=o.brightness/100,C=o.contrast/100,S=o.saturation/100,slope=B*C,intercept=.5*(1-C);
            return `<defs><clipPath id="clip-${o.id}"><rect width="${o.w}" height="${o.h}"/></clipPath><filter id="filter-${o.id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feComponentTransfer>${['R','G','B'].map(channel=>`<feFunc${channel} type="linear" slope="${slope}" intercept="${intercept}"/>`).join('')}</feComponentTransfer><feColorMatrix type="saturate" values="${S}"/></filter></defs><g clip-path="url(#clip-${o.id})"><use href="#asset-${o.assetId}" transform="matrix(${sx} 0 0 ${sy} ${-c.x*sx} ${-c.y*sy})" filter="url(#filter-${o.id})"/></g>`;
        }
        if(o.type==='rect'||o.type==='highlight')return `<rect width="${o.w}" height="${o.h}" fill="${o.type==='highlight'?o.fill||o.color:fill}" ${o.type==='highlight'?'':stroke}/>`;
        if(o.type==='ellipse')return `<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}" fill="${fill}" ${stroke}/>`;
        if(['pen','arrow','line'].includes(o.type)){
            const points=o.points||[{x:0,y:0},{x:o.w,y:o.h}],last=points.at(-1),prior=points.length>1?points.at(-2):{x:last.x-1,y:last.y},angle=Math.atan2(last.y-prior.y,last.x-prior.x),length=Math.max(o.stroke*4,12);
            if(points.length===1)return `<circle cx="${last.x}" cy="${last.y}" r="${o.stroke/2}" fill="${o.color}"/>`;
            return `<polyline points="${points.map(p=>p.x+','+p.y).join(' ')}" fill="none" ${stroke}/>`+(o.type==='arrow'?`<polygon points="${last.x},${last.y} ${last.x-length*Math.cos(angle-.48)},${last.y-length*Math.sin(angle-.48)} ${last.x-length*Math.cos(angle+.48)},${last.y-length*Math.sin(angle+.48)}" fill="${o.color}"/>`:'');
        }
        if(o.type==='badge')return `<ellipse cx="${o.w/2}" cy="${o.h/2}" rx="${o.w/2}" ry="${o.h/2}" fill="${o.fill||o.color}"/><text x="${o.w/2}" y="${o.h/2}" dominant-baseline="central" text-anchor="middle" font-family="${xml(fonts[o.family])}" font-size="${o.font}" font-weight="700" fill="${o.fill?o.color:'#ffffff'}">${xml(o.text)}</text>`;
        let background='';if(o.type==='callout')background=`<path d="M0 0H${o.w}V${o.h-18}H${o.w*.4}L${o.w*.25} ${o.h}V${o.h-18}H0Z" fill="${o.fill||'#ffffff'}" ${stroke}/>`;
        else if(o.fill)background=`<rect width="${o.w}" height="${o.h}" rx="3" fill="${o.fill}"/>`;
        const x=o.align==='center'?o.w/2:o.align==='right'?o.w-6:6,anchor={left:'start',center:'middle',right:'end'}[o.align];
        return background+`<text fill="${o.color}" font-family="${xml(fonts[o.family])}" font-size="${o.font}" font-weight="${weight(o)}" font-style="${o.italic?'italic':'normal'}" text-anchor="${anchor}" xml:space="preserve">${textLines(o).map((line,index)=>`<tspan x="${x}" y="${6+o.font*.85+index*o.font*o.lineHeight}">${xml(line)}</tspan>`).join('')}</text>`;
    }
    function assetMarkup(doc,sources){return Object.entries(doc.assets).map(([id,a])=>{
        const source=sources[id];if(!/^data:image\//i.test(source||''))throw Error('部分原圖尚未準備好');
        return `<image id="asset-${id}" data-note-studio-asset="${id}" width="${a.w}" height="${a.h}" href="${xml(source)}"/>`;
    }).join('');}
    function svg(doc,sources,scale=1){
        const g=geometry(doc),body=doc.objects.filter(o=>o.visible).map(o=>`<g transform="matrix(${o.matrix.join(' ')})" opacity="${o.opacity}">${objectMarkup(o,doc)}</g>`).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1,Math.round(g.w*scale))}" height="${Math.max(1,Math.round(g.h*scale))}" viewBox="0 0 ${g.w} ${g.h}" overflow="hidden"><defs>${assetMarkup(doc,sources)}<clipPath id="studio-output-crop"><rect x="${doc.crop.x}" y="${doc.crop.y}" width="${doc.crop.w}" height="${doc.crop.h}"/></clipPath></defs><g transform="matrix(${g.m.join(' ')})" clip-path="url(#studio-output-crop)">${doc.background?`<rect x="${doc.crop.x}" y="${doc.crop.y}" width="${doc.crop.w}" height="${doc.crop.h}" fill="${doc.background}"/>`:''}${body}</g></svg>`;
    }
    function dataUrl(doc,sources,scale=1){
        const placeholders={};let serial=0;
        const safe=Object.fromEntries(Object.entries(sources).map(([id,src])=>{const token='NOTE_STUDIO_BINARY_'+serial++;placeholders[token]=src;return [id,token];}));
        // Build first using real validated sources, then leave canonical base64 slices unescaped.
        let raw=svg(doc,sources,scale);
        for(const[id,src]of Object.entries(sources))raw=raw.split(xml(src)).join(safe[id]);
        let encoded=encodeURIComponent(raw);
        for(const[token,src]of Object.entries(placeholders)){
            const attr=/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(src)?src:encodeURIComponent(xml(src));
            encoded=encoded.split(token).join(attr);
        }
        return 'data:image/svg+xml;charset=utf-8,'+encoded;
    }
    const sourceCache=new Map();
    function embedded(src){
        if(sourceCache.has(src))return sourceCache.get(src);
        if(!/^data:image\/svg\+xml[;,]/i.test(src))throw Error('圖片的可編輯原始資料無效');
        const comma=src.indexOf(','),xmlSource=/;base64/i.test(src.slice(0,comma))?new TextDecoder().decode(Uint8Array.from(atob(src.slice(comma+1)),c=>c.charCodeAt(0))):decodeURIComponent(src.slice(comma+1));
        const root=new DOMParser().parseFromString(xmlSource,'image/svg+xml');if(root.querySelector('parsererror'))throw Error('圖片的可編輯原始資料無效');
        const sources={};for(const image of root.querySelectorAll('image[data-note-studio-asset]')){const id=image.getAttribute('data-note-studio-asset'),value=image.getAttribute('href');if(!/^[a-zA-Z0-9-]{1,100}$/.test(id)||!/^data:image\//i.test(value||''))throw Error('圖片素材內容無效');sources[id]=value;}
        if(!sources.original)throw Error('圖片缺少原圖');sourceCache.set(src,sources);while(sourceCache.size>3)sourceCache.delete(sourceCache.keys().next().value);return sources;
    }
    return {I,TYPES,fonts,copy,uid,n,clamp,color,xml,mul,translate,transform,inverse,around,rotate,corners,box,objectCorners,bounds,weight,font,textLines,textSize,fitText,object,blank,geometry,validate,migrate,objectMarkup,assetMarkup,svg,dataUrl,embedded};
})();

/* Source: 91-studio-ui.js */
/* Presentation catalog: no document or persistence state here. */
const noteStudioUI = (() => {
    const tools = [['select','↖','選取','V'],['hand','✥','移動','M'],['pen','✎','畫筆','P'],['text','T','文字','T'],['arrow','↗','箭頭','A'],['rect','□','方框','R'],['highlight','▰','螢光筆','H'],['line','╱','直線','L'],['ellipse','○','圓形','E'],['crop','⌗','裁切','C']];
    function markup(){
    const NS="http://www.w3.org/2000/svg";
    return `<section class="studio-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-title">
          <header class="studio-header"><div><h2 id="studio-title">圖片工作室</h2><p>滾輪縮放 · 長按拖移 · 套用後仍可編輯</p></div><div class="studio-header-actions"><button type="button" data-studio-action="fullscreen" aria-pressed="false">全螢幕</button><button type="button" data-studio-action="cancel" data-nie-action="cancel">取消</button><button type="button" class="studio-primary" data-studio-action="apply" data-nie-action="apply">套用到筆記</button></div></header>
          <div id="studio-discard" class="studio-notice" hidden><span>尚有未套用的修改，草稿會保留。</span><button type="button" data-studio-action="continue">繼續編輯</button><button type="button" data-studio-action="discard">放棄這次修改</button></div>
          <div class="studio-commandbar"><button type="button" data-studio-action="undo" title="Ctrl／⌘+Z">↶ 復原</button><button type="button" data-studio-action="redo" title="Ctrl／⌘+Shift+Z">↷ 重做</button><span class="studio-divider"></span><button type="button" data-studio-action="duplicate" title="Ctrl／⌘+D">複製物件</button><button type="button" data-studio-action="next-object" title="逐一選取，重疊的物件也能選到">切換物件</button><button type="button" data-studio-action="multi" aria-pressed="false">多選</button><button type="button" data-studio-action="delete">刪除</button><label class="studio-snap"><input type="checkbox" id="studio-snap" checked>對齊吸附</label><button type="button" data-studio-action="inspector" aria-pressed="false">進階調整</button></div>
          <div class="studio-stylebar" aria-label="常用畫筆設定"><span class="studio-style-label">顏色</span><div class="studio-palette" role="group" aria-label="常用顏色">${noteImagePalette.map(color=>`<button type="button" class="nie-swatch" data-studio-color="${color}" style="--swatch:${color}" aria-label="使用顏色 ${color}" title="${color}" aria-pressed="false"></button>`).join('')}</div><label>自訂<input id="studio-color" type="color" value="#2563eb"></label><label id="studio-stroke-label">筆粗<input id="studio-stroke" type="number" min="1" max="100" value="3"></label><label id="studio-dash-label">線條<select id="studio-dash"><option value="solid">實線</option><option value="dashed">虛線</option><option value="dotted">點線</option></select></label><div id="studio-color-memory" class="studio-color-memory"><div data-nie-memory-swatches></div><button type="button" data-nie-memory-manage>刪色</button><small data-nie-memory-status></small></div></div><div id="studio-textbar" class="studio-textbar" aria-label="文字設定"><button type="button" data-studio-action="edit-text" id="studio-edit-text">編輯文字</button><label>字級<input id="studio-text-size" type="number" min="8" max="500" step="1" list="studio-text-sizes" aria-label="文字字級"><datalist id="studio-text-sizes">${[12,16,18,20,24,28,32,36,48,60,72,96].map(size=>`<option value="${size}">`).join('')}</datalist><button type="button" data-studio-action="font-down" aria-label="字級減小">−</button><button type="button" data-studio-action="font-up" aria-label="字級加大">＋</button></label><label>字重<select id="studio-text-weight" aria-label="文字粗細">${[[100,'極細'],[200,'特細'],[300,'細體'],[400,'一般'],[500,'中等'],[600,'半粗'],[700,'粗體'],[800,'特粗'],[900,'最粗']].map(([weight,label])=>`<option value="${weight}">${label}</option>`).join('')}</select></label><label><input id="studio-bold" type="checkbox">粗體</label><label><input id="studio-italic" type="checkbox">斜體</label><label>字型<select id="studio-family"><option value="sans">黑體／無襯線</option><option value="serif">襯線字</option><option value="mono">等寬字</option></select></label><small>Enter 換行</small></div>
          <div class="studio-workspace"><nav class="studio-tools" aria-label="圖片工具">${tools.map(([tool,icon,label,key])=>`<button type="button" data-studio-tool="${tool}" title="${label}（${key}）"><b aria-hidden="true">${icon}</b><span>${label}</span></button>`).join('')}<button type="button" class="studio-continuous" data-studio-continuous aria-pressed="${(()=>{try{return localStorage.getItem('nd-studio-continuous')!=='0';}catch(_){return true;}})()}" title="連續繪製：畫完方框、圓形、箭頭、直線後留在同一個工具（Esc 回到選取）"><b aria-hidden="true">⟳</b><span>連續</span></button></nav>
          <div id="studio-viewport" tabindex="0" aria-label="圖片畫布，滾輪縮放；長按後拖移"><div class="studio-space"><div id="studio-surface"><svg id="studio-artboard" xmlns="${NS}" tabindex="0" aria-label="可編輯圖片"><defs id="studio-assets"></defs><g id="studio-scene"></g><g id="studio-guides"></g><g id="studio-selection"></g></svg><textarea id="studio-text-editor" hidden wrap="off" maxlength="4000" spellcheck="false" aria-label="編輯物件文字"></textarea></div></div></div>
          <aside id="studio-inspector" class="studio-inspector" aria-label="進階調整"><section><button type="button" class="studio-inspector-close" data-studio-action="inspector" aria-label="關閉進階調整">×</button><h3 id="studio-property-title">畫布設定</h3><p id="studio-selection-help" class="studio-muted">選取物件後調整屬性</p>
          <div id="studio-object-properties" hidden><label>名稱<input id="studio-name" type="text" maxlength="80"></label><div class="studio-property-grid">${[['x','X'],['y','Y'],['w','寬度'],['h','高度'],['angle','角度']].map(([key,label])=>`<label>${label}<input id="studio-${key}" type="number" step="1"></label>`).join('')}<label>透明度<input id="studio-opacity" type="number" min="0" max="100" value="100"></label></div>
          <div id="studio-vector-properties"><div class="studio-property-grid"><label>填色<input id="studio-fill" type="color" value="#ffffff"></label><label><input id="studio-no-fill" type="checkbox" checked>無填色</label></div></div>
          <div id="studio-text-properties" hidden><div class="studio-property-grid"><label>行距<input id="studio-line-height" type="number" min="0.8" max="3" step="0.1"></label></div><label>對齊<select id="studio-text-align"><option value="left">靠左</option><option value="center">置中</option><option value="right">靠右</option></select></label></div>
          <div id="studio-image-properties" hidden><h4>圖片調整</h4>${[['brightness','亮度'],['contrast','對比'],['saturation','飽和度']].map(([key,label])=>`<label>${label}<input id="studio-${key}" type="range" min="0" max="200" value="100"><output id="studio-${key}-value">100</output></label>`).join('')}<div class="studio-button-grid"><button type="button" data-studio-action="image-crop">裁切這張圖片</button><button type="button" data-studio-action="image-reset">還原圖片調整</button></div></div>
          <h4>排列與對齊</h4><div class="studio-button-grid"><button type="button" data-studio-action="group">群組</button><button type="button" data-studio-action="ungroup">解散群組</button></div><div class="studio-button-grid">${[['flip-x','水平翻轉'],['flip-y','垂直翻轉'],['front','置頂'],['back','置底'],['align-left','靠左'],['align-center','水平置中'],['align-right','靠右'],['align-top','靠上'],['align-middle','垂直置中'],['align-bottom','靠下'],['distribute-x','水平等距'],['distribute-y','垂直等距']].map(([action,label])=>`<button type="button" data-studio-action="${action}">${label}</button>`).join('')}</div></div>
          <div id="studio-canvas-properties"><div class="studio-property-grid"><label>背景<input id="studio-background" type="color" value="#ffffff"></label><label><input id="studio-transparent" type="checkbox" checked>透明背景</label><label>畫布角度<input id="studio-canvas-angle" type="number" step="1" value="0"></label><label>裁切比例<select id="studio-crop-ratio"><option value="0">自由</option><option value="1">1:1</option><option value="1.3333333333">4:3</option><option value="1.7777777778">16:9</option><option value="0.75">3:4</option><option value="0.5625">9:16</option></select></label></div><div class="studio-button-grid"><button type="button" data-studio-action="canvas-left">左轉 90°</button><button type="button" data-studio-action="canvas-right">右轉 90°</button><button type="button" data-studio-action="canvas-flip-x">整張水平翻轉</button><button type="button" data-studio-action="canvas-flip-y">整張垂直翻轉</button><button type="button" data-studio-action="uncrop">取消畫布裁切</button><button type="button" data-studio-action="finish-crop">完成裁切</button></div><h4>四周留白（像素）</h4><div class="studio-property-grid">${[['left','左'],['top','上'],['right','右'],['bottom','下']].map(([key,label])=>`<label>${label}<input type="number" id="studio-padding-${key}" min="0" max="10000" value="0"></label>`).join('')}</div><button type="button" data-studio-action="padding">更新留白</button><button type="button" data-studio-action="reset">還原整張原圖</button></div>
          <div class="studio-legacy-actions"><button type="button" data-studio-action="unlock-all">解鎖舊物件</button><button type="button" data-studio-action="show-all">顯示隱藏物件</button></div></section></aside></div>
          <div id="studio-image-crop-panel" class="studio-crop-panel" hidden><h3>裁切圖片</h3><p>在原圖上拖曳選取要顯示的範圍，原圖會保留。</p><canvas id="studio-crop-preview" width="500" height="340" tabindex="0" aria-label="圖片裁切預覽"></canvas><div><label>比例<select id="studio-image-ratio"><option value="0">自由</option><option value="1">1:1</option><option value="1.3333333333">4:3</option><option value="1.7777777778">16:9</option><option value="0.75">3:4</option><option value="0.5625">9:16</option></select></label><button type="button" data-studio-action="crop-reset">顯示完整原圖</button><button type="button" data-studio-action="crop-cancel">取消</button><button type="button" class="studio-primary" data-studio-action="crop-apply">套用裁切</button></div></div>
          <footer class="studio-footer"><span id="studio-status" role="status" aria-live="polite">正在讀取圖片…</span><div class="studio-zoom"><button type="button" data-studio-action="zoom-out" aria-label="縮小">−</button><span id="studio-zoom-value">100%</span><button type="button" data-studio-action="zoom-in" aria-label="放大">＋</button><button type="button" data-studio-action="fit">符合視窗</button><select id="studio-export-scale" aria-label="匯出倍率"><option value="1">1×</option><option value="2">2×</option></select><button type="button" data-studio-action="png">PNG</button><button type="button" data-studio-action="jpg">JPG</button></div></footer></section>`;
    }
    return {tools, markup, shortcuts:Object.fromEntries(tools.map(([tool,,,key])=>[key.toLowerCase(),tool]))};
})();

/* Source: 92-image-studio.js */
/* Note image studio. Original assets are retained separately from editable objects. */
const noteImageStudio = (() => {
    const M=noteStudioModel,NS='http://www.w3.org/2000/svg',ATTR='data-note-image-edit';
    const names={image:'圖片',pen:'畫筆',arrow:'箭頭',line:'直線',rect:'方框',ellipse:'圓形',highlight:'螢光標記',text:'文字',badge:'編號',callout:'說明框'};
    const colorMemory=createNoteImageColorMemory();
    let session=null,sequence=0,frame=0,clipboard=null,space=false;
    const el=id=>document.getElementById(id),isOpen=()=>!!session;
    const snapshot=()=>JSON.stringify(session.doc);
    const selected=()=>session?.doc?session.doc.objects.filter(o=>session.selected.includes(o.id)):[];
    const editable=()=>selected().filter(o=>!o.locked&&o.visible);
    function units(items){const groups=new Map();for(const o of items){const key=o.groupId||o.id;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}return [...groups.values()].map(objects=>({objects,bounds:M.box(objects.flatMap(M.objectCorners))}));}
    function toolStyle(type){const d={...session.defaults};if(!['text','callout','badge'].includes(type))delete d.weight;return {...d,opacity:type==='highlight'?d.opacity*.28:d.opacity,fill:type==='highlight'?d.fill||d.color:type==='callout'?d.fill||'#ffffff':d.fill};}
    const inputTarget=node=>!!node?.closest?.('input,textarea,select,[contenteditable="true"]');
    const readBlob=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('圖片讀取失敗'));r.readAsDataURL(blob);});
    function message(text){if(el('studio-status'))el('studio-status').textContent=text;}
    function setSelection(ids,{individual=false}={}){
        if(!session)return;const wanted=new Set(ids),groups=new Set(session.doc.objects.filter(o=>wanted.has(o.id)&&o.groupId).map(o=>o.groupId));
        const next=session.doc.objects.filter(o=>o.visible&&(wanted.has(o.id)||!individual&&groups.has(o.groupId))).map(o=>o.id);
        if(next.length===session.selected.length&&next.every((id,i)=>id===session.selected[i]))return;
        session.selected=next;update();schedule();
    }
    function commit(before){
        if(!session)return;
        if(snapshot()!==before){session.undo.push(before);if(session.undo.length>80)session.undo.shift();session.redo=[];notePersistence.changed();}
        update();schedule();
    }
    function change(fn){if(!session?.ready||session.busy)return;finishText();cancelGesture();const before=snapshot();fn();commit(before);}
    function init(){
        if(el('noteImageEditModal'))return;
        const root=document.createElement('div');root.id='noteImageEditModal';root.className='modal-overlay';root.hidden=true;
        root.innerHTML=noteStudioUI.markup();
        document.body.append(root);
        root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.studioColor)setStyle({color:button.dataset.studioColor});if(button.dataset.studioAction)void action(button.dataset.studioAction);if(button.dataset.studioTool)setTool(button.dataset.studioTool);});
        root.addEventListener('change',propertyChange);
        root.addEventListener('input',event=>{if(['studio-brightness','studio-contrast','studio-saturation'].includes(event.target.id))el(event.target.id+'-value').textContent=event.target.value;if(['studio-text-size'].includes(event.target.id)&&event.target.value!=='')propertyChange(event);});
        root.addEventListener('pointerdown',event=>{if(session?.textEdit&&event.target!==el('studio-text-editor')){if(event.target.closest('[data-studio-action="edit-text"]')){event.preventDefault();return;}finishText();}},true);
        root.addEventListener('focusout',event=>{if(['studio-text-size','studio-w','studio-h'].includes(event.target.id)&&selected().some(o=>o.type==='text'))requestAnimationFrame(()=>{if(session)update();});});
        const viewport=el('studio-viewport');viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);viewport.addEventListener('pointerup',pointerUp);viewport.addEventListener('pointercancel',event=>{cancelGesture();session?.pointers.delete(event.pointerId);if(session?.pointers.size<2)session.pinch=null;});
        viewport.addEventListener('lostpointercapture',event=>{if(session?.gesture?.id===event.pointerId||session?.pendingPress?.event.pointerId===event.pointerId){cancelGesture();session?.pointers.delete(event.pointerId);}});
        viewport.addEventListener('dblclick',event=>{if(!session?.ready||session.busy||inputTarget(event.target))return;const hit=document.elementFromPoint(event.clientX,event.clientY);if(hit?.closest('[data-studio-handle]'))return;const item=hit?.closest('[data-studio-object]')||event.target.closest('[data-studio-object]'),o=session.doc.objects.find(o=>o.id===item?.dataset.studioObject);if(o&&!o.locked&&['text','callout','badge'].includes(o.type))beginText(o.id);else if(o?.type==='image'){setSelection([o.id],{individual:true});void openImageCrop();}});
        viewport.addEventListener('wheel',wheelZoom,{passive:false});
        viewport.addEventListener('dragover',event=>{if(event.dataTransfer?.types.includes('Files'))event.preventDefault();});
        viewport.addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();message('請先將圖片加入筆記，再開啟編輯。');}});
        const text=el('studio-text-editor');text.addEventListener('input',()=>{const o=session?.doc.objects.find(o=>o.id===session.textEdit?.id);if(o){o.text=text.value;M.fitText(o);positionText();schedule();notePersistence.changed();}});text.addEventListener('compositionstart',()=>{if(session?.textEdit)session.textEdit.composing=true;});text.addEventListener('compositionend',()=>{if(session?.textEdit)session.textEdit.composing=false;});text.addEventListener('blur',()=>finishText());
        const crop=el('studio-crop-preview');crop.addEventListener('pointerdown',cropPointer);crop.addEventListener('pointermove',cropPointer);crop.addEventListener('pointerup',cropPointer);crop.addEventListener('pointercancel',event=>{if(session?.imageCrop)session.imageCrop.drag=null;});
        colorMemory.mount(el('studio-color-memory'),color=>setStyle({color}));
        new ResizeObserver(scheduleViewportResize).observe(viewport);
    }
    async function loadSource(src,signal){
        src=await notePersistence.resolveEditorValue(src);
        if(!/^data:image\//i.test(src||'')){
            if(!/^https?:|^blob:/i.test(src||''))throw Error('圖片網址無效');
            src=await noteExternalImages.resolve(src,{signal});
        }
        const image=new Image();image.decoding='async';image.src=src;await noteImageReady(image);if(signal?.aborted)throw Error('已停止圖片載入');
        if(!image.naturalWidth||!image.naturalHeight)throw Error('圖片尺寸無效');
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;canvas.getContext('2d').drawImage(image,0,0,1,1);canvas.toDataURL();return {src,image};
    }
    function identity(src,metadata){
        if(metadata?.v!==4)return noteImageStorage.imageIdentity(src,metadata);
        const sources=M.embedded(src),doc=M.validate(metadata.doc,metadata.w,metadata.h);
        for(const[id,a]of Object.entries(doc.assets))if(!sources[id]||a.key!==noteImageStorage.sourceKey(sources[id]))throw Error('圖片素材校驗不符，原圖與標記均已保留');
        const storedKey=noteImageStorage.sourceKey(sources.original);
        return {source:sources.original,sources,doc,key:metadata.storedKey===storedKey&&/^note-image-source:\d+:[a-z0-9]+:[a-z0-9]+$/.test(metadata.sourceKey||'')?metadata.sourceKey:storedKey,plain:false};
    }
    async function open(target,recovered=null){
        if(session||!el('noteModal')?.classList.contains('active'))return;
        const source=target.image?.getAttribute('src')||currentPastedImages[target.gallery];if(!source)return;
        init();resetInlineImageDrag();clearInlineImageSelection();window.getSelection()?.removeAllRanges();
        const root=el('noteImageEditModal'),note=el('noteModal');
        const s=session={id:++sequence,target,source,ready:false,busy:false,doc:null,sources:{},loaded:new Map(),selected:[],tool:'select',undo:[],redo:[],zoom:1,fit:true,resizeFrame:0,gesture:null,pointers:new Map(),abort:new AbortController(),inert:note.inert,overflow:document.body.style.overflow,color:colorMemory.begin(),stroke:3,font:24,dragGuides:[],nodes:new Map(),assetSignature:'',textEdit:null,imageCrop:null};
        s.defaults={color:s.color,stroke:s.stroke,font:s.font,fill:null,opacity:1,dash:'solid',family:'sans',bold:true,weight:600,italic:false,lineHeight:1.4,align:'left'};
        note.inert=true;document.body.style.overflow='hidden';root.hidden=false;root.classList.add('active');root.classList.remove('studio-inspector-open','studio-cropping');for(const node of root.querySelectorAll('.studio-workspace,.studio-commandbar,.studio-stylebar,.studio-textbar,.studio-footer'))node.inert=false;el('studio-discard').hidden=true;el('studio-image-crop-panel').hidden=true;
        el('studio-scene').replaceChildren();el('studio-assets').replaceChildren();el('studio-selection').replaceChildren();el('studio-guides').replaceChildren();message('正在讀取原圖與標記…');notePersistence.refreshStatus();update();root.querySelector('[data-studio-action="cancel"]').focus();
        const timer=setTimeout(()=>s.abort.abort(),20000);
        try{
            let metadata=null;try{metadata=target.image?JSON.parse(target.image.getAttribute(ATTR)||'null'):currentGalleryImageEdits[noteImageStorage.galleryKey(source)];}catch(_){throw Error('圖片編輯資料無法讀取，未修改原圖片');}
            const rawTextDoc=recovered?.studioVersion===4?recovered.doc:metadata?.v===4?metadata.doc:null;s.needsTextMigration=!!recovered?.textLayoutUpgrade||!!rawTextDoc?.objects?.some(o=>o.type==='text'&&o.textLayout!=='manual-lines');
            const originalIdentity=recovered?null:identity(source,metadata);
            const initialSource=recovered?.source||originalIdentity?.source||source;
            const loaded=await loadSource(initialSource,s.abort.signal);if(session!==s)return;
            s.original=loaded.src;s.originalKey=recovered?.sourceKey||originalIdentity?.key||noteImageStorage.sourceKey(loaded.src);s.w=loaded.image.naturalWidth;s.h=loaded.image.naturalHeight;
            s.sources=recovered?.studioVersion===4?{...recovered.images,original:loaded.src}:originalIdentity?.sources?{...originalIdentity.sources}: {original:loaded.src};
            s.doc=M.migrate(recovered?.doc||originalIdentity?.doc,s.w,s.h);
            for(const[id,asset]of Object.entries(s.doc.assets)){
                const data=id==='original'?loaded:await loadSource(s.sources[id],s.abort.signal);if(session!==s)return;
                s.sources[id]=data.src;s.loaded.set(id,data.image);asset.key=noteImageStorage.sourceKey(data.src);
            }
            s.initial=recovered?.initial?JSON.stringify(M.migrate(recovered.initial,s.w,s.h)):JSON.stringify(s.doc);
            // Older drafts carry no asset keys; canonicalize their initial original reference too.
            if(recovered?.initial){const initial=JSON.parse(s.initial);for(const[id,a]of Object.entries(initial.assets))if(s.sources[id])a.key=noteImageStorage.sourceKey(s.sources[id]);s.initial=JSON.stringify(initial);}
            s.ready=true;s.font=Math.round(M.clamp(Math.max(s.w,s.h)/24,18,64));s.stroke=Math.round(M.clamp(Math.max(s.w,s.h)/200,2,12));colorMemory.adopt(s.doc.objects.map(o=>o.color));
            Object.assign(s.defaults,{font:s.font,stroke:s.stroke});
            fit();update();schedule();message('選取物件調整；長按後拖動畫布；滾輪縮放。');
        }catch(error){if(session===s){message('圖片開啟未完成：'+error.message+'。原內容未更動。');update();}}
        finally{clearTimeout(timer);}
    }
    function close(force=false){
        if(!session)return;finishText();const s=session;
        if(!force&&s.ready&&(s.gesture||snapshot()!==s.initial)){el('studio-discard').hidden=false;el('studio-discard').querySelector('button').focus();return;}
        cancelGesture();clearWheel();s.abort.abort();cancelAnimationFrame(s.resizeFrame);s.resizeFrame=0;cancelAnimationFrame(frame);frame=0;session=null;space=false;
        el('noteImageEditModal').hidden=true;el('noteImageEditModal').classList.remove('active');el('studio-text-editor').hidden=true;
        el('noteModal').inert=s.inert;document.body.style.overflow=s.overflow;el('studio-scene').replaceChildren();el('studio-assets').replaceChildren();s.loaded.clear();notePersistence.changed();
        if(s.target.image?.isConnected)selectInlineImage(s.target.image);else el('modal-text').focus({preventScroll:true});
    }
    function frameFor(items=selected()){
        if(!items.length)return null;if(items.length===1)return M.objectCorners(items[0]);return M.corners(M.box(items.flatMap(M.objectCorners)));
    }
    function selectedBox(){const f=frameFor();return f?M.box(f):null;}
    function sceneGeometry(full=session?.tool==='crop'){return M.geometry(session.doc,full);}
    function render(){
        if(frame)cancelAnimationFrame(frame);frame=0;const s=session;if(!s?.ready)return;const d=s.doc,g=sceneGeometry(),scene=el('studio-scene');
        renderViewport(g);
        const assetSignature=Object.keys(d.assets).join('|');if(assetSignature!==s.assetSignature){el('studio-assets').innerHTML=M.assetMarkup(d,s.sources);s.assetSignature=assetSignature;}
        let clip=el('studio-canvas-clip');if(!clip){clip=document.createElementNS(NS,'clipPath');clip.id='studio-canvas-clip';clip.append(document.createElementNS(NS,'rect'));el('studio-assets').append(clip);}const c=s.tool==='crop'?d.bounds:d.crop;for(const[key,value]of Object.entries({x:c.x,y:c.y,width:c.w,height:c.h}))clip.firstElementChild.setAttribute(key,value);scene.setAttribute('clip-path','url(#studio-canvas-clip)');
        let bg=scene.querySelector('[data-studio-background]');if(!bg){bg=document.createElementNS(NS,'rect');bg.dataset.studioBackground='1';scene.prepend(bg);}for(const[key,value]of Object.entries({x:d.bounds.x,y:d.bounds.y,width:d.bounds.w,height:d.bounds.h,fill:d.background||'transparent'}))bg.setAttribute(key,value);
        const wanted=new Set(d.objects.map(o=>o.id));for(const[id,node]of s.nodes)if(!wanted.has(id)){node.remove();s.nodes.delete(id);}
        let previous=bg;
        for(const o of d.objects){
            let node=s.nodes.get(o.id);if(!node){node=document.createElementNS(NS,'g');node.dataset.studioObject=o.id;s.nodes.set(o.id,node);}
            const content={...o,matrix:null,visible:null,locked:null,name:null};const signature=JSON.stringify(content);
            if(node._signature!==signature){node.innerHTML=`<rect width="${o.w}" height="${o.h}" fill="transparent" pointer-events="all"/>`+M.objectMarkup(o,d);node._signature=signature;}
            node.setAttribute('transform',`matrix(${o.matrix.join(' ')})`);node.setAttribute('opacity',o.opacity);node.setAttribute('visibility',o.visible&&s.textEdit?.id!==o.id?'visible':'hidden');node.style.cursor=o.locked?'default':s.tool==='select'?'move':'inherit';
            if(previous.nextElementSibling!==node)previous.after(node);previous=node;
        }
        renderSelection(g);positionText();
    }
    function renderSelection(g){
        const s=session,overlay=el('studio-selection'),guides=el('studio-guides');let markup='';overlay.dataset.selectedIds=JSON.stringify(s.selected);
        if(s.tool==='crop'){
            const c=M.corners(s.doc.crop).map(p=>M.transform(p,g.m));markup=`<path d="M0 0H${g.w}V${g.h}H0Z M${c.map(p=>p.x+' '+p.y).join('L')}Z" fill="#0f172a77" fill-rule="evenodd"/><polygon points="${c.map(p=>p.x+','+p.y)}" fill="none" stroke="#ffffff" stroke-width="${2/s.zoom}"/>`;
        }else if(s.gesture?.mode==='marquee'){
            const b=M.box([s.gesture.startDisplay,s.gesture.currentDisplay||s.gesture.startDisplay]);markup=`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#2563eb18" stroke="#2563eb" stroke-width="${1.5/s.zoom}"/>`;
        }else if(s.tool==='select'){
            const f=frameFor()?.map(p=>M.transform(p,g.m));if(f){
                const movable=editable().length===selected().length;
                markup=`<polygon points="${f.map(p=>p.x+','+p.y)}" fill="none" stroke="${movable?'#7c3aed':'#64748b'}" stroke-width="${1.5/s.zoom}"/>`;
                if(movable){
                    const handles=[];for(let i=0;i<4;i++){handles.push({p:f[i],corner:i});handles.push({p:{x:(f[i].x+f[(i+1)%4].x)/2,y:(f[i].y+f[(i+1)%4].y)/2},edge:i});}
                    const size=10/s.zoom;markup+=handles.map(h=>`<rect data-studio-handle="resize" ${h.corner!=null?'data-corner="'+h.corner+'"':'data-edge="'+h.edge+'"'} x="${h.p.x-size/2}" y="${h.p.y-size/2}" width="${size}" height="${size}" rx="${2/s.zoom}" fill="#fff" stroke="#7c3aed" stroke-width="${1.5/s.zoom}"/>`).join('');
                    const top={x:(f[0].x+f[1].x)/2,y:(f[0].y+f[1].y)/2},center={x:(f[0].x+f[2].x)/2,y:(f[0].y+f[2].y)/2},length=Math.hypot(top.x-center.x,top.y-center.y)||1,turn={x:top.x+(top.x-center.x)/length*28/s.zoom,y:top.y+(top.y-center.y)/length*28/s.zoom};
                    markup+=`<path d="M${top.x} ${top.y}L${turn.x} ${turn.y}" stroke="#7c3aed" stroke-width="${1/s.zoom}"/><circle data-studio-handle="rotate" cx="${turn.x}" cy="${turn.y}" r="${8/s.zoom}" fill="#fff" stroke="#7c3aed" stroke-width="${1.5/s.zoom}"/>`;
                }
            }
        }
        if(overlay._markup!==markup){overlay.innerHTML=markup;overlay._markup=markup;}
        const guideMarkup=s.dragGuides.map(line=>`<line x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" stroke="#db2777" stroke-dasharray="${4/s.zoom} ${3/s.zoom}" stroke-width="${1/s.zoom}"/>`).join('');
        if(guides._markup!==guideMarkup){guides.innerHTML=guideMarkup;guides._markup=guideMarkup;}
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(render);}
    function scheduleViewportResize(){
        const s=session;if(!s?.ready||s.resizeFrame)return;
        // ResizeObserver only schedules work; writing layout inside its callback
        // can make scrollbar changes trigger another resize in the same frame.
        s.resizeFrame=requestAnimationFrame(()=>{
            s.resizeFrame=0;if(session!==s||!s.ready)return;
            if(s.fit)fit();else schedule();
        });
    }
    // View changes do not serialize every stroke or rebuild any object markup.
    function renderViewport(g=sceneGeometry()){
        const s=session,svg=el('studio-artboard'),surface=el('studio-surface');
        svg.setAttribute('viewBox',`0 0 ${g.w} ${g.h}`);
        svg.style.width=surface.style.width=g.w*s.zoom+'px';
        svg.style.height=surface.style.height=g.h*s.zoom+'px';
        el('studio-scene').setAttribute('transform',`matrix(${g.m.join(' ')})`);
    }
    function fit(){
        if(!session?.ready)return;
        const g=sceneGeometry(),v=el('studio-viewport');if(!v.clientWidth||!v.clientHeight)return;
        // Use the actual space around the image. The previous 64px allowance
        // was smaller than its 48px + 48px padding, so scrollbars oscillated.
        const space=getComputedStyle(v.querySelector('.studio-space'));
        const inset=(a,b)=>(parseFloat(space[a])||0)+(parseFloat(space[b])||0);
        const width=Math.max(1,v.clientWidth-inset('paddingLeft','paddingRight')-2),height=Math.max(1,v.clientHeight-inset('paddingTop','paddingBottom')-2);
        session.zoom=Math.max(.01,Math.min(width/g.w,height/g.h,1));session.fit=true;render();update();
    }
    function zoomAt(factor,x,y){
        const s=session;if(!s?.ready)return;const v=el('studio-viewport'),vr=v.getBoundingClientRect(),r=el('studio-artboard').getBoundingClientRect();x=x??vr.left+vr.width/2;y=y??vr.top+vr.height/2;
        const p={x:(x-r.left)/s.zoom,y:(y-r.top)/s.zoom};s.zoom=M.clamp(s.zoom*factor,.02,8);s.fit=false;renderViewport();const next=el('studio-artboard').getBoundingClientRect();v.scrollLeft+=next.left+p.x*s.zoom-x;v.scrollTop+=next.top+p.y*s.zoom-y;
        renderSelection(sceneGeometry());positionText();el('studio-zoom-value').textContent=Math.round(s.zoom*100)+'%';
    }
    function clearWheel(){const s=session;if(!s)return;cancelAnimationFrame(s.wheelFrame);s.wheelFrame=0;s.wheel=null;}
    function flushWheel(){const s=session,zoom=s?.wheel;clearWheel();if(zoom)zoomAt(Math.exp(zoom.delta),zoom.x,zoom.y);}
    function wheelZoom(event){
        const s=session;if(!s?.ready||s.busy||s.imageCrop||inputTarget(event.target))return;
        event.preventDefault();clearPendingPress();if(s.gesture||s.pinch)return;
        const unit=event.deltaMode===1?16:event.deltaMode===2?el('studio-viewport').clientHeight:1;
        const delta=M.clamp(-event.deltaY*unit*.0018,-.55,.55);
        s.wheel={delta:M.clamp((s.wheel?.delta||0)+delta,-2,2),x:event.clientX,y:event.clientY};
        if(!s.wheelFrame)s.wheelFrame=requestAnimationFrame(flushWheel);
    }
    function positionText(){
        const s=session;if(!s?.textEdit)return;const o=s.doc.objects.find(o=>o.id===s.textEdit.id);if(!o)return;
        const input=el('studio-text-editor'),matrix=M.mul(sceneGeometry().m,o.matrix);
        Object.assign(input.style,{width:o.w+'px',height:o.h+'px',font:M.font(o),lineHeight:o.lineHeight,textAlign:o.align,color:o.color,backgroundColor:o.fill||'#ffffffdd',transform:`matrix(${matrix.map((v,i)=>i<4?v*s.zoom:v*s.zoom).join(',')})`});
    }
    function value(id,next){const node=el(id);if(node&&document.activeElement!==node)node.value=next;}
    function update(){
        const s=session;if(!s)return;const ready=s.ready&&!s.busy,items=selected(),o=items.length===1?items[0]:null,locked=items.some(o=>o.locked),style=o||s.defaults;
        el('noteImageEditModal').querySelectorAll('button').forEach(button=>button.disabled=!ready&&!['cancel','discard','continue','fullscreen','inspector'].includes(button.dataset.studioAction));
        el('studio-inspector').querySelectorAll('input,select').forEach(node=>node.disabled=!ready||locked&&!!node.closest('#studio-object-properties'));
        for(const action of ['duplicate','group','ungroup','delete','front','back','up','down','align-left','align-center','align-right','align-top','align-middle','align-bottom','distribute-x','distribute-y','flip-x','flip-y','image-crop','image-reset','edit-text']){
            const min=action==='group'?2:action.startsWith('distribute')?3:1;
            el('noteImageEditModal').querySelectorAll('[data-studio-action="'+action+'"]').forEach(button=>button.disabled=!ready||(action.startsWith('distribute')?units(items).length:items.length)<min||locked||action==='ungroup'&&!items.some(o=>o.groupId));
        }
        el('noteImageEditModal').querySelector('[data-studio-action="undo"]').disabled=!ready||!s.undo.length;el('noteImageEditModal').querySelector('[data-studio-action="redo"]').disabled=!ready||!s.redo.length;
        el('noteImageEditModal').querySelectorAll('[data-studio-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.studioTool===s.tool)));
        el('studio-zoom-value').textContent=Math.round(s.zoom*100)+'%';
        const drawing=!['select','hand','crop'].includes(s.tool);el('studio-object-properties').hidden=!items.length&&!drawing;
        const textContext=items.length?items.every(o=>['text','callout','badge'].includes(o.type)):s.tool==='text';
        el('studio-textbar').hidden=false;el('studio-textbar').querySelectorAll('input,select,[data-studio-action^="font-"]').forEach(node=>node.disabled=!ready||locked||!textContext);el('studio-edit-text').textContent=s.textEdit?'完成輸入':'編輯文字';el('studio-edit-text').disabled=!ready||locked||!o||!textContext;el('studio-textbar').querySelector('small').textContent=textContext?'只在 Enter 換行':'選取文字以調整';
        el('studio-stroke-label').hidden=false;el('studio-dash-label').hidden=false;el('studio-stroke').disabled=!ready||locked||textContext;el('studio-dash').disabled=!ready||locked||textContext;
        el('studio-property-title').textContent=items.length>1?'已選 '+items.length+' 個物件':o?(o.name||names[o.type]):drawing?'工具樣式':'畫布設定';
        el('studio-selection-help').textContent=locked?'已鎖定；在進階調整按「解鎖舊物件」。':items.length>1?'可群組、對齊或一起調整透明度。':o?.type==='text'?'雙擊或按 Enter 編輯；邊緣把手調框大小，角落調整字級。':drawing?'這些設定會用於接下來建立的物件。':'拖曳選取，Shift 加選；Alt 可單獨選取群組內物件。';
        el('studio-name').closest('label').hidden=!o;el('studio-x').closest('.studio-property-grid').hidden=!items.length;
        el('studio-canvas-properties').hidden=!!items.length&&s.tool!=='crop';el('studio-vector-properties').hidden=o?.type==='image'||items.length>1&&items.every(o=>o.type==='image');
        el('studio-text-properties').hidden=!(o&&['text','callout','badge'].includes(o.type)||!items.length&&['text','callout','badge'].includes(s.tool));
        el('studio-image-properties').hidden=o?.type!=='image';
        const b=selectedBox();if(b){value('studio-x',Math.round(o?o.matrix[4]:b.x));value('studio-y',Math.round(o?o.matrix[5]:b.y));value('studio-w',Math.round(o?o.w*Math.hypot(o.matrix[0],o.matrix[1]):b.w));value('studio-h',Math.round(o?o.h*Math.hypot(o.matrix[2],o.matrix[3]):b.h));value('studio-angle',o?Math.round(Math.atan2(o.matrix[1],o.matrix[0])*180/Math.PI):0);}
        value('studio-name',o?.name||'');value('studio-opacity',Math.round(style.opacity*100));value('studio-color',style.color);value('studio-stroke',style.stroke);value('studio-fill',style.fill||'#ffffff');el('studio-no-fill').checked=!style.fill;
        value('studio-dash',style.dash);value('studio-text-size',style.font);value('studio-text-weight',String(M.weight(style)));value('studio-family',style.family);value('studio-line-height',style.lineHeight);value('studio-text-align',style.align);el('studio-bold').checked=M.weight(style)>=600;el('studio-italic').checked=!!style.italic;
        for(const key of ['brightness','contrast','saturation']){value('studio-'+key,o?.[key]??100);el('studio-'+key+'-value').textContent=o?.[key]??100;}
        if(s.ready){value('studio-canvas-angle',s.doc.angle);value('studio-background',s.doc.background||'#ffffff');el('studio-transparent').checked=!s.doc.background;
            value('studio-padding-left',Math.max(0,-s.doc.bounds.x));value('studio-padding-top',Math.max(0,-s.doc.bounds.y));value('studio-padding-right',Math.max(0,s.doc.bounds.x+s.doc.bounds.w-s.w));value('studio-padding-bottom',Math.max(0,s.doc.bounds.y+s.doc.bounds.h-s.h));}
        colorMemory.render(style.color,ready);
        for(const button of el('noteImageEditModal').querySelectorAll('[data-studio-color]')){button.disabled=!ready||locked;button.setAttribute('aria-pressed',String(button.dataset.studioColor===style.color));}
        for(const node of el('noteImageEditModal').querySelectorAll('.studio-stylebar input,.studio-stylebar select'))node.disabled=!ready||locked||textContext&&['studio-stroke','studio-dash'].includes(node.id);
        el('noteImageEditModal').querySelector('[data-studio-action="multi"]').setAttribute('aria-pressed',String(!!s.multi));
        for(const [name,key,test] of [['unlock-all','locked',true],['show-all','visible',false]]){const button=el('noteImageEditModal').querySelector('[data-studio-action="'+name+'"]');if(button)button.hidden=!s.doc?.objects.some(o=>o[key]===test);}
        el('studio-artboard').style.cursor=space||s.tool==='hand'?'grab':s.tool==='select'?'default':'crosshair';
    }
    /* 連續繪製 (continuous drawing) setting, remembered on this device; on by default. */
    function studioContinuous(){try{return localStorage.getItem('nd-studio-continuous')!=='0';}catch(_){return true;}}
    function setStudioContinuous(on){try{localStorage.setItem('nd-studio-continuous',on?'1':'0');}catch(_){}const b=document.querySelector('[data-studio-continuous]');if(b)b.setAttribute('aria-pressed',String(on));}
    document.addEventListener('click',event=>{const b=event.target.closest?.('[data-studio-continuous]');if(!b)return;setStudioContinuous(!studioContinuous());message(studioContinuous()?'連續繪製：開啟。畫完方框等形狀會留在同一個工具，按 Esc 或 V 回到選取。':'連續繪製：關閉。畫完一個形狀就回到選取。');});
    function setTool(tool){if(!session?.ready||session.busy)return;finishText();cancelGesture();session.tool=tool;session.selected=[];update();if(tool==='crop')fit();else schedule();message(({select:'拖曳選取；Shift 多選，Alt 選群組內物件。',hand:'拖曳移動畫布；滾輪縮放。',crop:'拖曳選取裁切範圍，設定比例後按「完成裁切」。',text:'點畫布新增文字，雙擊已有文字編輯。'})[tool]||'在畫布上拖曳新增'+(names[tool]||'標記')+'；按 V 返回選取。');}
    function setStyle(values){
        const s=session;if(!s?.ready||s.busy)return;const items=editable();
        if(Object.hasOwn(values,'bold'))values={...values,weight:values.bold?700:400};if(Object.hasOwn(values,'weight'))values={...values,bold:values.weight>=600};
        if(values.color){s.color=values.color;colorMemory.remember(values.color,selected().map(o=>o.color));}if(values.stroke)s.stroke=values.stroke;if(values.font)s.font=values.font;
        for(const[key,value]of Object.entries(values))if(Object.hasOwn(s.defaults,key))s.defaults[key]=value;
        if(items.length)change(()=>{for(const o of editable()){Object.assign(o,values);M.fitText(o);}});else update();
    }
    function propertyChange(event){
        const s=session;if(!s?.ready||s.busy)return;const id=event.target.id,v=event.target.value,items=selected(),o=items.length===1?items[0]:null;
        if(id==='studio-image-ratio'){if(id==='studio-image-ratio')resetCropRatio();return;}
        if(id==='studio-snap')return;
        if(id==='studio-background'||id==='studio-transparent'){change(()=>s.doc.background=el('studio-transparent').checked?null:el('studio-background').value);return;}
        if(id==='studio-canvas-angle'){change(()=>s.doc.angle=M.clamp(v,-36000,36000));fit();return;}
        if(id==='studio-crop-ratio'){if(s.tool==='crop')change(()=>s.doc.crop=ratioRect(s.doc.crop,Number(v),s.doc.bounds));return;}
        if(items.some(o=>o.locked))return;
        if(id==='studio-text-size'){setStyle({font:M.clamp(v,8,500)});return;}
        if(id==='studio-text-weight'){setStyle({weight:M.clamp(v,100,900)});return;}
        const mapping={'studio-color':['color',M.color(v)],'studio-stroke':['stroke',M.clamp(v,.1,200)],'studio-fill':['fill',M.color(v)],'studio-no-fill':['fill',event.target.checked?null:el('studio-fill').value],'studio-opacity':['opacity',M.clamp(v,0,100)/100],'studio-name':['name',v.slice(0,80)],'studio-dash':['dash',v],'studio-family':['family',v],'studio-line-height':['lineHeight',M.clamp(v,.8,3)],'studio-text-align':['align',v],'studio-bold':['bold',event.target.checked],'studio-italic':['italic',event.target.checked]};
        if(mapping[id]){const[key,value]=mapping[id];setStyle({[key]:value});return;}
        for(const key of ['brightness','contrast','saturation'])if(id==='studio-'+key){setStyle({[key]:M.clamp(v,0,200)});return;}
        if(id==='studio-angle'&&o){change(()=>{const current=Math.atan2(o.matrix[1],o.matrix[0])*180/Math.PI,center=M.transform({x:o.w/2,y:o.h/2},o.matrix);o.matrix=M.mul(M.around(M.rotate(M.clamp(v,-36000,36000)-current),center),o.matrix);});return;}
        if(['studio-x','studio-y','studio-w','studio-h'].includes(id)&&items.length){
            change(()=>{const b=selectedBox();if(id==='studio-x'||id==='studio-y'){const key=id.endsWith('x')?'x':'y',current=o?o.matrix[key==='x'?4:5]:b[key],delta=M.clamp(v,-100000,100000)-current;applyTransform(M.translate(key==='x'?delta:0,key==='y'?delta:0));}
                else if(o){const x=id==='studio-w',scale=Math.hypot(...(x?o.matrix.slice(0,2):o.matrix.slice(2,4))),size=(x?o.w:o.h)*scale,factor=M.clamp(v,1,50000)/size;if(o.type==='text'){o[x?'w':'h']=M.clamp(v,1,50000)/scale;o.manualSize=true;M.fitText(o);}else o.matrix=M.mul(o.matrix,[x?factor:1,0,0,x?1:factor,0,0]);}
                else {const x=id==='studio-w',factor=M.clamp(v,1,50000)/(x?b.w:b.h);applyTransform(M.around([x?factor:1,0,0,x?1:factor,0,0],{x:b.x,y:b.y}));}});return;
        }
    }
    function applyTransform(matrix,originals=null){const items=editable();for(const o of items){const original=originals?.find(item=>item.id===o.id)||o;o.matrix=M.mul(matrix,original.matrix);}}
    function beginText(id,before=null){
        const s=session;if(!s?.ready||s.busy)return;finishText();cancelGesture();const o=s.doc.objects.find(o=>o.id===id);if(!o||o.locked||!['text','badge','callout'].includes(o.type))return;
        s.tool='select';setSelection([id],{individual:true});s.textEdit={id,before:before||snapshot(),composing:false};const input=el('studio-text-editor');input.value=o.text;input.maxLength=o.type==='badge'?12:4000;input.hidden=false;update();positionText();render();input.focus({preventScroll:true});input.select();message('直接編輯文字；Enter 換行，按「完成輸入」或 Ctrl／⌘ + Enter 完成。');
    }
    function finishText(cancel=false){
        const s=session,e=s?.textEdit;if(!e)return;s.textEdit=null;const o=s.doc.objects.find(o=>o.id===e.id);
        if(cancel)s.doc=JSON.parse(e.before);else if(o){o.text=el('studio-text-editor').value.replace(/\r/g,'').slice(0,o.type==='badge'?12:4000);if(!o.text.trim()){s.doc.objects=s.doc.objects.filter(item=>item.id!==o.id);s.selected=[];}else M.fitText(o);}
        el('studio-text-editor').hidden=true;if(cancel){update();schedule();}else commit(e.before);
    }
    function duplicate(objects=editable(),offset=18){
        const s=session,newIds=[],groups=new Map();
        if(objects.length+s.doc.objects.length>1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}
        for(const item of objects){const o=M.copy(item);o.id=M.uid();o.locked=false;o.matrix=M.mul(M.translate(offset,offset),o.matrix);if(o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,M.uid());o.groupId=groups.get(o.groupId);}s.doc.objects.push(o);newIds.push(o.id);}s.selected=newIds;
    }
    function arrange(name){
        const s=session,items=editable();if(!items.length||items.length!==selected().length)return;
        if(['front','back','up','down'].includes(name)){
            change(()=>{const chosen=new Set(items.map(o=>o.id)),all=s.doc.objects;
                if(name==='front'||name==='back'){const rest=all.filter(o=>!chosen.has(o.id));s.doc.objects=name==='front'?[...rest,...items]:[...items,...rest];}
                else if(name==='up'){for(let i=all.length-2;i>=0;i--)if(chosen.has(all[i].id)&&!chosen.has(all[i+1].id))[all[i],all[i+1]]=[all[i+1],all[i]];}
                else for(let i=1;i<all.length;i++)if(chosen.has(all[i].id)&&!chosen.has(all[i-1].id))[all[i],all[i-1]]=[all[i-1],all[i]];
            });return;
        }
        const parts=units(items),union=parts.length>1?M.box(items.flatMap(M.objectCorners)):s.doc.crop;
        if(name.startsWith('align-'))change(()=>{for(const part of parts){const b=part.bounds;let dx=0,dy=0;if(name==='align-left')dx=union.x-b.x;if(name==='align-center')dx=union.x+union.w/2-b.x-b.w/2;if(name==='align-right')dx=union.x+union.w-b.x-b.w;if(name==='align-top')dy=union.y-b.y;if(name==='align-middle')dy=union.y+union.h/2-b.y-b.h/2;if(name==='align-bottom')dy=union.y+union.h-b.y-b.h;for(const o of part.objects)o.matrix=M.mul(M.translate(dx,dy),o.matrix);}});
        if(name.startsWith('distribute')&&parts.length>=3)change(()=>{const x=name==='distribute-x',key=x?'x':'y',size=x?'w':'h',sorted=[...parts].sort((a,b)=>a.bounds[key]-b.bounds[key]),gap=(union[size]-sorted.reduce((n,part)=>n+part.bounds[size],0))/(sorted.length-1);let position=union[key];for(const part of sorted){const b=part.bounds,delta=position-b[key];for(const o of part.objects)o.matrix=M.mul(M.translate(x?delta:0,x?0:delta),o.matrix);position+=b[size]+gap;}});
    }
    async function action(name){
        const s=session;if(!s)return;
        if(name==='cancel')return close();if(name==='discard')return close(true);if(name==='continue'){el('studio-discard').hidden=true;return el('studio-artboard').focus();}
        if(name==='fullscreen'){const root=el('noteImageEditModal'),on=root.classList.toggle('studio-fullscreen');root.querySelector('[data-studio-action="fullscreen"]').setAttribute('aria-pressed',String(on));if(s.ready)fit();return;}
        if(name==='inspector'){const on=el('noteImageEditModal').classList.toggle('studio-inspector-open');el('noteImageEditModal').querySelector('.studio-commandbar [data-studio-action="inspector"]').setAttribute('aria-pressed',String(on));if(!on)el('noteImageEditModal').querySelector('.studio-commandbar [data-studio-action="inspector"]').focus({preventScroll:true});if(s.ready&&s.fit)scheduleViewportResize();return;}
        if(name==='multi'){s.multi=!s.multi;update();message(s.multi?'多選已開啟：逐一點選物件即可加選／取消。':'多選已關閉。');return;}
        if(name==='edit-text'){if(s.textEdit){finishText();el('studio-artboard').focus({preventScroll:true});}else beginText(selected()[0]?.id);return;}
        if(!s.ready||s.busy)return;finishText();if(!name.startsWith('crop-'))cancelGesture();
        if(name==='next-object'){const objects=s.doc.objects.filter(o=>o.visible);if(objects.length){s.tool='select';const index=objects.findIndex(o=>o.id===s.selected.at(-1)),o=objects[(index+1)%objects.length];setSelection([o.id],{individual:true});message('已選取：'+(o.name||names[o.type])+(o.locked?'（已鎖定）':''));}return;}
        if(name==='apply')return apply();if(name==='png'||name==='jpg')return exportImage(name);
        if(name==='font-up'||name==='font-down')return setStyle({font:M.clamp((selected()[0]||s.defaults).font+(name==='font-up'?2:-2),8,500)});
        if(name==='fit'){clearWheel();return fit();}if(name==='zoom-in'||name==='zoom-out')return zoomAt(name==='zoom-in'?1.25:.8);
        
        if(name==='image-crop')return openImageCrop();if(name==='crop-cancel'){closeImageCrop();return;}
        if(name==='crop-reset'){if(s.imageCrop){const a=s.doc.assets[s.imageCrop.assetId];s.imageCrop.rect={x:0,y:0,w:a.w,h:a.h};drawImageCrop();}return;}
        if(name==='crop-apply'){if(s.imageCrop){const crop=s.imageCrop,o=s.doc.objects.find(o=>o.id===crop.id);closeImageCrop();change(()=>{o.crop={...crop.rect};o.h=o.w*o.crop.h/o.crop.w;});}return;}
        if(name==='undo'||name==='redo'){
            const from=name==='undo'?s.undo:s.redo,to=name==='undo'?s.redo:s.undo;if(from.length){to.push(snapshot());s.doc=JSON.parse(from.pop());s.selected=[];s.assetSignature='';notePersistence.changed();update();if(s.fit)fit();else schedule();}return;
        }
        if(name==='unlock-all')return change(()=>s.doc.objects.forEach(o=>o.locked=false));
        if(name==='show-all')return change(()=>s.doc.objects.forEach(o=>o.visible=true));
        if(name==='duplicate')return change(()=>duplicate());
        if(name==='delete')return change(()=>{const ids=new Set(editable().map(o=>o.id));s.doc.objects=s.doc.objects.filter(o=>!ids.has(o.id));s.selected=[];});
        if(name==='group'&&editable().length>1)return change(()=>{const id=M.uid();for(const o of editable())o.groupId=id;});
        if(name==='ungroup')return change(()=>editable().forEach(o=>delete o.groupId));
        if(name==='flip-x'||name==='flip-y')return change(()=>editable().forEach(o=>o.matrix=M.mul(o.matrix,name==='flip-x'?[-1,0,0,1,o.w,0]:[1,0,0,-1,0,o.h])));
        if(name==='image-reset')return change(()=>editable().filter(o=>o.type==='image').forEach(o=>{const a=s.doc.assets[o.assetId];Object.assign(o,{brightness:100,contrast:100,saturation:100,opacity:1,crop:{x:0,y:0,w:a.w,h:a.h}});o.h=o.w*a.h/a.w;}));
        if(name==='reset'){if(!confirm('要還原整張原圖嗎？這次操作可用復原返回。'))return;change(()=>{s.doc=M.blank(s.w,s.h);s.doc.assets.original.key=noteImageStorage.sourceKey(s.original);s.selected=[];s.assetSignature='';});fit();return;}
        if(['canvas-left','canvas-right','canvas-flip-x','canvas-flip-y','uncrop','padding'].includes(name)){
            change(()=>{if(name==='canvas-left')s.doc.angle-=90;if(name==='canvas-right')s.doc.angle+=90;if(name==='canvas-flip-x')s.doc.flipX=!s.doc.flipX;if(name==='canvas-flip-y')s.doc.flipY=!s.doc.flipY;
                if(name==='uncrop')s.doc.crop={...s.doc.bounds};if(name==='padding'){const p=Object.fromEntries(['left','right','top','bottom'].map(key=>[key,M.clamp(el('studio-padding-'+key).value,0,10000)]));s.doc.bounds={x:-p.left,y:-p.top,w:s.w+p.left+p.right,h:s.h+p.top+p.bottom};s.doc.crop={...s.doc.bounds};}});fit();return;
        }
        if(name==='finish-crop'){setTool('select');fit();return;}
        arrange(name);
    }
    function eventPoint(event){const r=el('studio-artboard').getBoundingClientRect(),g=sceneGeometry(),display={x:(event.clientX-r.left)/session.zoom,y:(event.clientY-r.top)/session.zoom};return {display,world:M.inverse(display,g.m)};}
    function overlaps(a,b){for(const poly of [a,b])for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],axis={x:q.y-p.y,y:p.x-q.x},ap=a.map(p=>p.x*axis.x+p.y*axis.y),bp=b.map(p=>p.x*axis.x+p.y*axis.y);if(Math.max(...ap)<Math.min(...bp)||Math.max(...bp)<Math.min(...ap))return false;}return true;}
    function clearPendingPress(){
        const s=session,pending=s?.pendingPress;if(!pending)return;
        clearTimeout(pending.timer);s.pendingPress=null;
        const viewport=el('studio-viewport');if(viewport.hasPointerCapture(pending.event.pointerId))viewport.releasePointerCapture(pending.event.pointerId);
    }
    function pointerDown(event){
        const s=session;if(!s?.ready||s.busy||s.imageCrop||inputTarget(event.target)||![0,1].includes(event.button))return;
        flushWheel();clearPendingPress();
        // Touch keeps immediate drawing/pinch. Mouse starts drawing as soon as it moves;
        // holding still switches to pan without creating an annotation or undo entry.
        if(event.pointerType!=='mouse'||event.button===1||space||s.tool==='hand'||event.target.closest('[data-studio-handle]'))return beginPointer(event);
        event.preventDefault();finishText();el('studio-artboard').focus({preventScroll:true});
        const pending=s.pendingPress={event,timer:0};el('studio-viewport').setPointerCapture(event.pointerId);
        pending.timer=setTimeout(()=>{
            if(session!==s||s.pendingPress!==pending)return;s.pendingPress=null;
            const viewport=el('studio-viewport');s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
            s.gesture={id:event.pointerId,mode:'pan',startClient:{x:event.clientX,y:event.clientY},scroll:{x:viewport.scrollLeft,y:viewport.scrollTop}};
            viewport.classList.add('is-panning');message('拖曳移動畫布；放開後繼續使用原工具。');
        },420);
    }
    function beginPointer(event){
        const s=session;if(!s?.ready||s.busy||s.imageCrop||event.target===el('studio-text-editor')||![0,1].includes(event.button))return;
        event.preventDefault();el('studio-artboard').focus({preventScroll:true});finishText();s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        const viewport=el('studio-viewport');
        if(event.pointerType==='touch'&&s.pointers.size===2){cancelGesture();const values=[...s.pointers.values()];s.pinch={distance:Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y),center:{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2}};for(const id of s.pointers.keys())viewport.setPointerCapture(id);return;}
        if(s.pointers.size>1)return;
        const point=eventPoint(event),before=snapshot(),g={id:event.pointerId,before,start:point.world,startDisplay:point.display,startClient:{x:event.clientX,y:event.clientY},previous:[...s.selected],originals:[],frame:null};
        const handle=event.target.closest('[data-studio-handle]');
        if(space||s.tool==='hand'||event.button===1){g.mode='pan';g.scroll={x:viewport.scrollLeft,y:viewport.scrollTop};}
        else if(handle&&editable().length===selected().length){g.mode=handle.dataset.studioHandle;g.corner=handle.hasAttribute('data-corner')?Number(handle.dataset.corner):null;g.edge=handle.hasAttribute('data-edge')?Number(handle.dataset.edge):null;g.frame=frameFor();g.originals=M.copy(editable());g.center={x:(g.frame[0].x+g.frame[2].x)/2,y:(g.frame[0].y+g.frame[2].y)/2};g.angle=Math.atan2(point.world.y-g.center.y,point.world.x-g.center.x);}
        else if(s.tool==='select'){
            const id=event.target.closest('[data-studio-object]')?.dataset.studioObject,o=s.doc.objects.find(o=>o.id===id);
            if(o&&!o.locked){
                if(!s.selected.includes(id)||event.shiftKey||event.altKey||s.multi)setSelection(event.shiftKey||s.multi?s.selected.includes(id)?s.selected.filter(key=>key!==id):[...s.selected,id]:[id],{individual:event.altKey});
                if(event.altKey&&editable().length){duplicate();update();}
                if(!editable().length||editable().length!==selected().length)return;
                g.mode='move';g.originals=M.copy(editable());g.frame=frameFor();g.box=M.box(g.originals.flatMap(M.objectCorners));g.snapTargets=[s.doc.crop,...s.doc.objects.filter(o=>o.visible&&!s.selected.includes(o.id)).map(M.bounds)];
            }else{g.mode='marquee';g.clickId=o?.id||null;g.additive=event.shiftKey;if(!event.shiftKey)setSelection(o?[o.id]:[]);}
        }else if(s.tool==='crop'){g.mode='crop';}
        else if(s.tool==='text'){
            const hit=event.target.closest('[data-studio-object]'),existing=s.doc.objects.find(o=>o.id===hit?.dataset.studioObject);if(existing?.type==='text'&&!existing.locked){beginText(existing.id);return;}
            if(s.doc.objects.length>=1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}
            const o=M.fitText(M.object('text',point.world.x,point.world.y,220,80,{...toolStyle('text'),text:'輸入文字'}));
            s.doc.objects.push(o);s.tool='select';setSelection([o.id]);beginText(o.id,before);return;
        }else{
            if(s.doc.objects.length>=1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}
            const o=M.object(s.tool,point.world.x,point.world.y,1,1,toolStyle(s.tool));if(['pen','line','arrow'].includes(o.type))o.points=[{x:0,y:0}];s.doc.objects.push(o);s.selected=[o.id];g.mode='draw';g.objectId=o.id;
        }
        s.gesture=g;viewport.setPointerCapture(event.pointerId);schedule();
    }
    function snappedDelta(g,dx,dy,event){
        const s=session;s.dragGuides=[];if(!el('studio-snap').checked||event.ctrlKey||event.metaKey)return {dx,dy};
        const moving={x:g.box.x+dx,y:g.box.y+dy,w:g.box.w,h:g.box.h},targets=g.snapTargets,threshold=6/s.zoom;
        const find=(key,size)=>{let best=null;for(const target of targets)for(const a of [moving[key],moving[key]+moving[size]/2,moving[key]+moving[size]])for(const b of [target[key],target[key]+target[size]/2,target[key]+target[size]]){const offset=b-a;if(Math.abs(offset)<=threshold&&(!best||Math.abs(offset)<Math.abs(best.offset)))best={offset,position:b};}return best;};
        const x=find('x','w'),y=find('y','h'),c=s.doc.crop,m=sceneGeometry().m;
        if(x){dx+=x.offset;const a=M.transform({x:x.position,y:c.y},m),b=M.transform({x:x.position,y:c.y+c.h},m);s.dragGuides.push([a.x,a.y,b.x,b.y]);}
        if(y){dy+=y.offset;const a=M.transform({x:c.x,y:y.position},m),b=M.transform({x:c.x+c.w,y:y.position},m);s.dragGuides.push([a.x,a.y,b.x,b.y]);}
        return {dx,dy};
    }
    function resizeGesture(g,p,event){
        const single=g.originals.length===1,o=g.originals[0],b=single?{x:0,y:0,w:o.w,h:o.h}:M.box(g.frame),start=single?M.inverse(g.start,o.matrix):g.start,current=single?M.inverse(p,o.matrix):p;
        const signs=g.corner!=null?[[-1,-1],[1,-1],[1,1],[-1,1]][g.corner]:[[0,-1],[1,0],[0,1],[-1,0]][g.edge];
        let sx=signs[0]?M.clamp((b.w+signs[0]*(current.x-start.x))/b.w,.02,30):1,sy=signs[1]?M.clamp((b.h+signs[1]*(current.y-start.y))/b.h,.02,30):1;
        if(g.corner!=null&&(event.shiftKey||!single||['image','text','badge','callout'].includes(o.type))){const ratio=Math.abs(sx-1)>Math.abs(sy-1)?sx:sy;sx=sy=ratio;}
        const anchor={x:signs[0]<0?b.x+b.w:b.x,y:signs[1]<0?b.y+b.h:b.y},scale=M.around([sx,0,0,sy,0,0],anchor);
        if(single&&o.type==='text'){
            const next=session.doc.objects.find(item=>item.id===o.id);next.w=o.w*sx;next.h=o.h*sy;next.font=g.corner!=null?M.clamp(o.font*sx,8,500):o.font;next.manualSize=g.corner!=null?!!o.manualSize:true;M.fitText(next);
            next.matrix=M.mul(o.matrix,M.translate(signs[0]<0?o.w-next.w:0,signs[1]<0?o.h-next.h:0));return;
        }
        if(single)session.doc.objects.find(item=>item.id===o.id).matrix=M.mul(o.matrix,scale);else applyTransform(scale,g.originals);
    }
    function pointerMove(event){
        const s=session;if(!s?.ready)return;
        const pending=s.pendingPress;if(pending&&pending.event.pointerId===event.pointerId){
            if(event.buttons===0){clearPendingPress();return;}
            if(Math.hypot(event.clientX-pending.event.clientX,event.clientY-pending.event.clientY)<4)return;
            clearTimeout(pending.timer);s.pendingPress=null;beginPointer(pending.event);
        }
        if(s.gesture&&event.pointerType==='mouse'&&event.buttons===0&&event.type==='pointermove'){cancelGesture();s.pointers.clear();return;}
        if(s.pointers.has(event.pointerId))s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(s.pinch&&s.pointers.size>=2){const points=[...s.pointers.values()],distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y),center={x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2};zoomAt(distance/(s.pinch.distance||1),center.x,center.y);el('studio-viewport').scrollLeft-=center.x-s.pinch.center.x;el('studio-viewport').scrollTop-=center.y-s.pinch.center.y;s.pinch={distance,center};return;}
        const g=s.gesture;if(!g||g.id!==event.pointerId)return;event.preventDefault();const {world:p,display}=eventPoint(event);
        if(g.mode==='pan'){el('studio-viewport').scrollLeft=g.scroll.x-(event.clientX-g.startClient.x);el('studio-viewport').scrollTop=g.scroll.y-(event.clientY-g.startClient.y);return;}
        if(g.mode==='move'){const delta=snappedDelta(g,p.x-g.start.x,p.y-g.start.y,event);applyTransform(M.translate(delta.dx,delta.dy),g.originals);}
        else if(g.mode==='resize')resizeGesture(g,p,event);
        else if(g.mode==='rotate'){let delta=Math.atan2(p.y-g.center.y,p.x-g.center.x)-g.angle;if(event.shiftKey)delta=Math.round(delta/(Math.PI/12))*Math.PI/12;applyTransform(M.around(M.rotate(delta*180/Math.PI),g.center),g.originals);}
        else if(g.mode==='marquee'){
            g.currentDisplay=display;const selection=M.corners(M.box([g.startDisplay,display])),matrix=sceneGeometry().m,found=s.doc.objects.filter(o=>!o.locked&&o.visible&&overlaps(selection,M.objectCorners(o).map(p=>M.transform(p,matrix)))).map(o=>o.id);setSelection(g.additive?[...g.previous,...found]:found);
        }else if(g.mode==='crop'){const b=M.box([g.start,p]),bounds=s.doc.bounds;s.doc.crop=ratioRect({x:M.clamp(b.x,bounds.x,bounds.x+bounds.w-1),y:M.clamp(b.y,bounds.y,bounds.y+bounds.h-1),w:Math.max(1,b.w),h:Math.max(1,b.h)},Number(el('studio-crop-ratio').value),bounds);}
        else if(g.mode==='draw'){
            const o=s.doc.objects.find(o=>o.id===g.objectId);if(!o)return;
            if(o.type==='pen'){const point={x:p.x-g.start.x,y:p.y-g.start.y},last=o.points.at(-1);if(o.points.length<20000&&Math.hypot(point.x-last.x,point.y-last.y)*s.zoom>1.2)o.points.push(point);}
            else{let q=p;if(event.shiftKey&&['rect','ellipse','highlight'].includes(o.type)){const length=Math.max(Math.abs(p.x-g.start.x),Math.abs(p.y-g.start.y));q={x:g.start.x+Math.sign(p.x-g.start.x)*length,y:g.start.y+Math.sign(p.y-g.start.y)*length};}if(['line','arrow'].includes(o.type)&&event.shiftKey){const angle=Math.round(Math.atan2(p.y-g.start.y,p.x-g.start.x)/(Math.PI/4))*Math.PI/4,length=Math.hypot(p.x-g.start.x,p.y-g.start.y);q={x:g.start.x+length*Math.cos(angle),y:g.start.y+length*Math.sin(angle)};}
                const b=M.box([g.start,q]);o.w=Math.max(1,b.w);o.h=Math.max(1,b.h);o.matrix=M.translate(b.x,b.y);if(['line','arrow'].includes(o.type))o.points=[{x:g.start.x-b.x,y:g.start.y-b.y},{x:q.x-b.x,y:q.y-b.y}];}
        }
        schedule();
    }
    function pointerUp(event){
        const s=session;if(!s)return;const pending=s.pendingPress;
        if(pending?.event.pointerId===event.pointerId){clearTimeout(pending.timer);s.pendingPress=null;beginPointer(pending.event);}
        s.pointers.delete(event.pointerId);if(s.pinch){if(s.pointers.size<2)s.pinch=null;return;}
        const g=s.gesture;if(!g||g.id!==event.pointerId)return;pointerMove(event);s.gesture=null;s.dragGuides=[];const viewport=el('studio-viewport');if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
        if(g.mode==='pan'){viewport.classList.remove('is-panning');update();return;}
        if(g.mode==='marquee'&&Math.hypot(event.clientX-g.startClient.x,event.clientY-g.startClient.y)<3)setSelection(g.clickId?[g.clickId]:g.additive?g.previous:[]);
        if(g.mode==='draw'){
            const o=s.doc.objects.find(o=>o.id===g.objectId);
            if(o?.type==='pen'){const b=M.box(o.points);o.points=o.points.map(p=>({x:p.x-b.x,y:p.y-b.y}));o.matrix=M.mul(o.matrix,M.translate(b.x,b.y));o.w=Math.max(1,b.w);o.h=Math.max(1,b.h);}
            else if(Math.hypot(event.clientX-g.startClient.x,event.clientY-g.startClient.y)<3){s.doc=JSON.parse(g.before);s.selected=[];}
            // 連續繪製: stay on the shape tool so several boxes can be drawn in a row.
            if(!['pen','highlight'].includes(s.tool)&&!studioContinuous())s.tool='select';
        }
        commit(g.before);
    }
    function cancelGesture(){clearPendingPress();const s=session,g=s?.gesture;if(!g)return;s.gesture=null;if(g.mode!=='pan'){s.doc=JSON.parse(g.before);s.selected=g.previous;}s.dragGuides=[];const viewport=el('studio-viewport');viewport.classList.remove('is-panning');if(viewport.hasPointerCapture(g.id))viewport.releasePointerCapture(g.id);update();schedule();}
    function ratioRect(rect,ratio,bounds){
        let {x,y,w,h}=rect;w=Math.max(1,w);h=Math.max(1,h);x=M.clamp(x,bounds.x,bounds.x+bounds.w-1);y=M.clamp(y,bounds.y,bounds.y+bounds.h-1);
        if(ratio>0){if(w/h>ratio)w=h*ratio;else h=w/ratio;}const scale=Math.min(1,(bounds.x+bounds.w-x)/w,(bounds.y+bounds.h-y)/h);return {x,y,w:Math.max(1,w*scale),h:Math.max(1,h*scale)};
    }
    function copyObjects(event,cut=false){
        const s=session;if(!s?.ready||inputTarget(event.target)||!selected().length)return;
        const objects=M.copy(selected()),assetIds=new Set(objects.filter(o=>o.type==='image').map(o=>o.assetId)),assets=Object.fromEntries([...assetIds].map(id=>[id,{...s.doc.assets[id],source:s.sources[id]}]));clipboard={objects,assets};
        event.preventDefault();event.stopImmediatePropagation();const json=JSON.stringify(clipboard);if(json.length<32000000)event.clipboardData?.setData('application/x-pharmacy-studio',json);event.clipboardData?.setData('text/plain',objects.map(o=>o.text||names[o.type]).join('\n'));
        if(cut)change(()=>{const ids=new Set(editable().map(o=>o.id));s.doc.objects=s.doc.objects.filter(o=>!ids.has(o.id));s.selected=[];});message('已複製 '+objects.length+' 個物件。');
    }
    async function pasteObjects(event){
        const s=session;if(!s?.ready||s.busy||inputTarget(event.target))return;event.preventDefault();event.stopImmediatePropagation();
        try{
            const data=event.clipboardData,raw=data?.getData('application/x-pharmacy-studio');
            if(raw){if(raw.length>32000000)throw Error('貼上的物件資料過大');const value=JSON.parse(raw);await pasteDocument(value);return;}
            const files=[...(data?.files||[])].filter(file=>file.type.startsWith('image/'));if(files.length){message('請先將圖片加入筆記，再開啟編輯。');return;}
            const text=data?.getData('text/plain');if(text){const c=s.doc.crop;change(()=>{if(s.doc.objects.length>=1000){message('這張圖片已達 1000 個物件，請先整理標記。');return;}const o=M.fitText(M.object('text',c.x+c.w*.2,c.y+c.h*.2,Math.min(300,c.w),80,{...toolStyle('text'),text:text.slice(0,4000)}));s.doc.objects.push(o);s.selected=[o.id];});}
            else if(clipboard)await pasteDocument(clipboard);
        }catch(error){message('貼上未完成：'+error.message);}
    }
    async function pasteDocument(value){
        const s=session;if(!s||!Array.isArray(value?.objects)||value.objects.length+s.doc.objects.length>1000)throw Error('物件資料無效或數量過多');
        if(Object.keys(value.assets||{}).length>32)throw Error('貼上的原始圖片過多');
        s.busy=true;update();
        try{
        const imports={},aliases={};for(const[id,a]of Object.entries(value.assets||{})){
            const loaded=await loadSource(a.source,s.abort.signal);if(session!==s)return;const key=noteImageStorage.sourceKey(loaded.src),same=Object.entries(s.doc.assets).find(([,asset])=>asset.key===key);
            const nextId=same?.[0]||M.uid();aliases[id]=nextId;if(!same)imports[nextId]={loaded,key};
        }
        if(Object.keys(s.doc.assets).length+Object.keys(imports).length>32)throw Error('每張畫布最多可使用 32 張原始圖片');
        if([...Object.values(s.sources),...Object.values(imports).map(v=>v.loaded.src)].reduce((sum,src)=>sum+src.length,0)>64*1024*1024)throw Error('這張畫布的原圖資料已較大，請分成另一張圖片編輯');
        const test=M.copy(s.doc);for(const[id,{loaded,key}]of Object.entries(imports))test.assets[id]={w:loaded.image.naturalWidth,h:loaded.image.naturalHeight,key};
        const groups=new Map();let next=value.objects.map(item=>{const o=M.copy(item);o.id=M.uid();o.locked=false;if(o.assetId)o.assetId=aliases[o.assetId]||o.assetId;o.matrix=M.mul(M.translate(18,18),o.matrix);if(o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,M.uid());o.groupId=groups.get(o.groupId);}return o;});test.objects.push(...next);next=M.validate(test,s.w,s.h).objects.slice(s.doc.objects.length);
        if(session!==s)return;s.busy=false;
        change(()=>{for(const[id,{loaded,key}]of Object.entries(imports)){s.sources[id]=loaded.src;s.loaded.set(id,loaded.image);s.doc.assets[id]={w:loaded.image.naturalWidth,h:loaded.image.naturalHeight,key};}s.doc.objects.push(...next);s.selected=next.map(o=>o.id);s.assetSignature='';});
        }finally{if(session===s){s.busy=false;update();}}
    }
    window.addEventListener('copy',event=>copyObjects(event),true);window.addEventListener('cut',event=>copyObjects(event,true),true);window.addEventListener('paste',event=>{if(session)void pasteObjects(event);},true);
    window.addEventListener('keydown',event=>{
        const s=session;if(!s)return;event.stopImmediatePropagation();if(event.isComposing||s.textEdit?.composing)return;
        if(event.key==='Tab'){
            const items=[...(s.imageCrop?el('studio-image-crop-panel'):el('noteImageEditModal')).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[inert]')),first=items[0],last=items.at(-1);
            if(event.shiftKey&&(document.activeElement===first||!el('noteImageEditModal').contains(document.activeElement))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;
        }
        if(event.target===el('studio-text-editor')){if(event.key==='Escape'){event.preventDefault();finishText(true);}else if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();finishText();el('studio-artboard').focus();}return;}
        if(event.key==='Escape'){event.preventDefault();if(s.imageCrop)closeImageCrop();else if(s.gesture)cancelGesture();else if(['arrow','rect','line','ellipse'].includes(s.tool))setTool('select');else if(s.selected.length)setSelection([]);else close();return;}
        if(s.imageCrop){if(event.key==='Enter'&&!inputTarget(event.target)){event.preventDefault();void action('crop-apply');}return;}
        if(inputTarget(event.target))return;const key=event.key.toLowerCase(),mod=event.ctrlKey||event.metaKey;
        if(mod&&(key==='c'||key==='v'||key==='x'))return;
        if(mod&&key==='z'){event.preventDefault();void action(event.shiftKey?'redo':'undo');}else if(mod&&key==='y'){event.preventDefault();void action('redo');}
        else if(mod&&key==='d'){event.preventDefault();void action('duplicate');}else if(mod&&key==='g'){event.preventDefault();void action(event.shiftKey?'ungroup':'group');}
        else if(mod&&key==='a'){event.preventDefault();s.tool='select';setSelection(s.doc.objects.filter(o=>o.visible&&!o.locked).map(o=>o.id));}
        else if(mod&&event.key==='Enter'){event.preventDefault();void action('apply');}
        else if(event.key==='Enter'&&selected().length===1&&['text','callout','badge'].includes(selected()[0].type)){event.preventDefault();beginText(selected()[0].id);}
        else if(event.code==='Space'){event.preventDefault();space=true;update();}
        else if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();void action('delete');}
        else if(event.key.startsWith('Arrow')){event.preventDefault();const step=event.shiftKey?10:1;change(()=>applyTransform(M.translate(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0,event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)));}
        else if(!mod&&!event.altKey&&noteStudioUI.shortcuts[key]){event.preventDefault();setTool(noteStudioUI.shortcuts[key]);}
    },true);
    window.addEventListener('keyup',event=>{if(session&&event.code==='Space'){event.preventDefault();space=false;update();}},true);
    function releaseInteraction(){if(session){space=false;cancelGesture();clearWheel();session.pointers.clear();session.pinch=null;}}
    window.addEventListener('blur',releaseInteraction);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseInteraction();});
    async function openImageCrop(){
        const s=session,o=selected()[0];if(!s?.ready||!o||o.type!=='image'||o.locked)return;
        const image=s.loaded.get(o.assetId);if(!image)return;finishText();s.imageCrop={id:o.id,assetId:o.assetId,rect:{...o.crop},image,drag:null};el('studio-image-ratio').value='0';el('studio-image-crop-panel').hidden=false;el('noteImageEditModal').classList.add('studio-cropping');for(const node of el('noteImageEditModal').querySelectorAll('.studio-workspace,.studio-commandbar,.studio-stylebar,.studio-textbar,.studio-footer'))node.inert=true;drawImageCrop();el('studio-crop-preview').focus();
    }
    function closeImageCrop(){if(session)session.imageCrop=null;el('studio-image-crop-panel').hidden=true;el('noteImageEditModal').classList.remove('studio-cropping');for(const node of el('noteImageEditModal').querySelectorAll('.studio-workspace,.studio-commandbar,.studio-stylebar,.studio-textbar,.studio-footer'))node.inert=false;el('studio-artboard').focus({preventScroll:true});}
    function drawImageCrop(){
        const s=session,c=s?.imageCrop;if(!c)return;const canvas=el('studio-crop-preview'),ctx=canvas.getContext('2d'),a=s.doc.assets[c.assetId],scale=Math.min((canvas.width-24)/a.w,(canvas.height-24)/a.h),x=(canvas.width-a.w*scale)/2,y=(canvas.height-a.h*scale)/2;
        c.view={scale,x,y};ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#e2e8f0';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(c.image,x,y,a.w*scale,a.h*scale);
        const r={x:x+c.rect.x*scale,y:y+c.rect.y*scale,w:c.rect.w*scale,h:c.rect.h*scale};ctx.fillStyle='#0f172a99';ctx.fillRect(x,y,a.w*scale,r.y-y);ctx.fillRect(x,r.y+r.h,a.w*scale,y+a.h*scale-r.y-r.h);ctx.fillRect(x,r.y,r.x-x,r.h);ctx.fillRect(r.x+r.w,r.y,x+a.w*scale-r.x-r.w,r.h);ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#ffffff';for(const p of M.corners(r))ctx.fillRect(p.x-4,p.y-4,8,8);
    }
    function resetCropRatio(){const s=session,c=s?.imageCrop;if(!c)return;const a=s.doc.assets[c.assetId],center={x:c.rect.x+c.rect.w/2,y:c.rect.y+c.rect.h/2};c.rect=ratioRect(c.rect,Number(el('studio-image-ratio').value),{x:0,y:0,w:a.w,h:a.h});c.rect.x=M.clamp(center.x-c.rect.w/2,0,a.w-c.rect.w);c.rect.y=M.clamp(center.y-c.rect.h/2,0,a.h-c.rect.h);drawImageCrop();}
    function cropPointer(event){
        const c=session?.imageCrop;if(!c)return;const canvas=el('studio-crop-preview'),r=canvas.getBoundingClientRect(),a=session.doc.assets[c.assetId],p={x:M.clamp(((event.clientX-r.left)/r.width*canvas.width-c.view.x)/c.view.scale,0,a.w),y:M.clamp(((event.clientY-r.top)/r.height*canvas.height-c.view.y)/c.view.scale,0,a.h)};
        if(event.type==='pointerdown'){event.preventDefault();canvas.setPointerCapture(event.pointerId);c.drag={id:event.pointerId,start:p};}
        else if(c.drag?.id===event.pointerId){event.preventDefault();const b=M.box([c.drag.start,p]);c.rect=ratioRect(b,Number(el('studio-image-ratio').value),{x:0,y:0,w:a.w,h:a.h});if(event.type==='pointerup'){c.drag=null;canvas.releasePointerCapture(event.pointerId);}drawImageCrop();}
    }
    function packagedDoc(){
        const d=M.copy(session.doc),used=new Set(['original',...d.objects.filter(o=>o.type==='image').map(o=>o.assetId)]);d.assets=Object.fromEntries(Object.entries(d.assets).filter(([id])=>used.has(id)));return M.validate(d,session.w,session.h);
    }
    async function packageImage(){
        const s=session,d=packagedDoc(),g=M.geometry(d),scale=Math.min(1,4096/Math.max(g.w,g.h),Math.sqrt(12000000/(g.w*g.h))),src=M.dataUrl(d,s.sources,scale);
        const image=new Image();image.src=src;await noteImageReady(image);if(session!==s)throw Error('圖片編輯已取消');
        return {src,metadata:{v:4,sourceKey:s.originalKey,storedKey:noteImageStorage.sourceKey(s.original),w:s.w,h:s.h,doc:d}};
    }
    async function apply(){
        const s=session;if(!s?.ready||s.busy)return;finishText();cancelGesture();if(snapshot()===s.initial&&!s.needsTextMigration&&!/^https?:/i.test(s.source)){close(true);return;}s.busy=true;update();message('正在校驗並產生可再次編輯的圖片…');
        try{
            const {src,metadata}=await packageImage();if(session!==s)return;
            if(s.target.image){
                const image=s.target.image;if(!image.isConnected||!el('modal-text').contains(image))throw Error('原圖片位置已變更，請取消後重新開啟');
                const clone=image.cloneNode(true);clone.src=src;clone.setAttribute(ATTR,JSON.stringify(metadata));for(const key of ['height','srcset','sizes'])clone.removeAttribute(key);clone.style.removeProperty('height');clone.style.removeProperty('aspect-ratio');
                const range=document.createRange();range.selectNode(image);el('noteModal').inert=s.inert;s.target.image=insertImageHtmlWithHistory(cleanInlineImageHtml(clone),range);
            }else{
                if(currentPastedImages[s.target.gallery]!==s.source)throw Error('原圖片順序已變更，請重新開啟');const key=noteImageStorage.galleryKey(src);currentPastedImages[s.target.gallery]=src;currentGalleryImageEdits[key]=metadata;renderPreviewGrid();
            }
            close(true);
        }catch(error){if(session===s){el('noteModal').inert=true;s.busy=false;update();message('套用未完成：'+error.message+'。原筆記與編輯草稿仍保留。');}}
    }
    async function exportImage(type){
        const s=session;if(!s?.ready||s.busy)return;finishText();s.busy=true;update();
        try{
            const d=packagedDoc(),g=M.geometry(d),requested=Number(el('studio-export-scale').value)||1,scale=Math.min(requested,4096/Math.max(g.w,g.h),Math.sqrt(12000000/(g.w*g.h))),image=new Image();image.src=M.dataUrl(d,s.sources,scale);await noteImageReady(image);if(session!==s)return;
            const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(g.w*scale));canvas.height=Math.max(1,Math.round(g.h*scale));const ctx=canvas.getContext('2d');if(type==='jpg'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);}ctx.drawImage(image,0,0,canvas.width,canvas.height);
            const blob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('無法產生輸出檔案')),type==='jpg'?'image/jpeg':'image/png',.95));if(session!==s)return;
            const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='筆記圖片-'+Date.now()+'.'+type;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(`已匯出 ${canvas.width} × ${canvas.height} ${type.toUpperCase()}；原圖與標記仍保留。`);canvas.width=canvas.height=1;
        }catch(error){if(session===s)message('匯出未完成：'+error.message);}
        finally{if(session===s){s.busy=false;update();}}
    }
    function exportDraft(){
        const s=session;if(!s?.ready)return null;const initial=JSON.parse(s.initial),used=new Set([...Object.keys(s.doc.assets),...Object.keys(initial.assets)]);
        return {studioVersion:4,source:s.original,sourceKey:s.originalKey,doc:M.copy(s.doc),initial,textLayoutUpgrade:!!s.needsTextMigration,images:Object.fromEntries([...used].filter(id=>id!=='original'&&s.sources[id]).map(id=>[id,s.sources[id]])),imageIndex:s.target.image?[...el('modal-text').querySelectorAll('img[data-inline-image="1"]')].indexOf(s.target.image):null,gallery:s.target.gallery??null};
    }
    return {open,close,isOpen,identity,exportDraft};
})();

const noteImageEditor={
    open:noteImageStudio.open,close:noteImageStudio.close,isOpen:noteImageStudio.isOpen,
    galleryKey:noteImageStorage.galleryKey,galleryData:noteImageStorage.galleryData,
    imageIdentity:noteImageStudio.identity,sourceKey:noteImageStorage.sourceKey,
    compactPayload:noteImageStorage.compactPayload,exportDraft:noteImageStudio.exportDraft
};

/* Source: 93-interface-shortcuts.js */
/* Shared note dialog shortcuts and lazy optional assets. */
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (document.getElementById('noteLinkModal').classList.contains('active')) closeNoteLinkModal();
        else if (document.getElementById('tableCreateModal').classList.contains('active')) closeTableCreateModal();
        else if (document.getElementById('randomDrawModal').classList.contains('active')) closeRandomDrawModal();
        else if (document.getElementById('categoryAssignModal').classList.contains('active')) closeCategoryAssignModal();
        else if (document.getElementById('categoryOverviewModal').classList.contains('active')) closeCategoryOverviewModal();
        else if (document.getElementById('imageViewer').classList.contains('active')) closeImageViewer();
        else if (document.getElementById('historyModal').classList.contains('active')) closeHistoryModal();
    });


/* Optional editor assets */
(function () {
    var sort = false;  // icons are local now (css/icons.css); only the optional sorter loads later
    document.addEventListener('pointerdown', function () {
        if (!sort && document.getElementById('noteModal').classList.contains('active')) { sort = true; var script = document.createElement('script'); script.async = true; script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/Sortable.min.js'; script.onload = function () { setupPreviewSorting(); }; document.head.appendChild(script); }
    }, {capture:true});
}());

/* Source: 94-image-viewer.js */
/* One cancellable viewing session owns loading, zooming and pointer capture. */
const noteImageViewer=(()=>{
    let initialized=false,sequence=0,frame=0,active=null,lastSource='',lastSize=null;
    const el=id=>document.getElementById(id),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
    function init(){
        if(initialized)return;initialized=true;const root=el('imageViewer'),viewport=el('image-viewer-viewport');
        root.addEventListener('click',event=>{
            if(event.target.closest('[data-viewer-action="close"]'))return close();
            if(!active||active.ignoreBackdropClick)return;
            const background=event.target===root||event.target===viewport||event.target.classList.contains('image-viewer-content');
            if(background){const r=el('image-viewer-img').getBoundingClientRect(),overImage=active.ready&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;if(!overImage)close();}
        });
        root.addEventListener('wheel',event=>{if(!active)return;event.preventDefault();if(active.ready){const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?active.view.h:1);zoomBy(Math.exp(-clamp(delta,-300,300)*.0025),event.clientX,event.clientY);}},{passive:false});
        viewport.addEventListener('dragstart',event=>event.preventDefault());viewport.addEventListener('pointerdown',pointerDown);viewport.addEventListener('pointermove',pointerMove);viewport.addEventListener('pointerup',pointerEnd);viewport.addEventListener('pointercancel',pointerEnd);viewport.addEventListener('lostpointercapture',pointerEnd);
        window.addEventListener('blur',releasePointers);window.addEventListener('pagehide',close);document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePointers();});
        window.addEventListener('keydown',event=>{
            if(!active)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
            if(event.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;}
            if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing)return;
            if(['+','=','-','0','f','F','ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(!active.ready)return;
                if(event.key==='+'||event.key==='=')zoomBy(1.25);else if(event.key==='-')zoomBy(.8);else if(event.key==='0')zoomTo(1);else if(event.key.toLowerCase()==='f')fit();else if(event.key.startsWith('Arrow')){active.x+=event.key==='ArrowLeft'?60:event.key==='ArrowRight'?-60:0;active.y+=event.key==='ArrowUp'?60:event.key==='ArrowDown'?-60:0;bound();schedule();}}
        },true);
        new ResizeObserver(()=>{if(!active?.ready)return;measure();if(active.fitted)fit();else{bound();schedule();}}).observe(viewport);
    }
    function measure(){if(active){const r=el('image-viewer-viewport').getBoundingClientRect();active.view={x:r.left,y:r.top,w:r.width,h:r.height};}}
    function bound(){const s=active;if(!s?.ready)return;const w=s.w*s.scale,h=s.h*s.scale,v=s.view;s.x=w<=v.w?(v.w-w)/2:clamp(s.x,v.w-w-24,24);s.y=h<=v.h?(v.h-h)/2:clamp(s.y,v.h-h-24,24);}
    function paint(){frame=0;const s=active;if(!s?.ready)return;el('image-viewer-img').style.transform=`translate(${s.x}px,${s.y}px) scale(${s.scale})`;el('image-viewer-viewport').classList.toggle('viewer-can-pan',s.w*s.scale>s.view.w||s.h*s.scale>s.view.h);}
    function schedule(){if(!frame)frame=requestAnimationFrame(paint);}
    function fit(){const s=active;if(!s?.ready)return;measure();s.scale=Math.min(1,(s.view.w-40)/s.w,(s.view.h-40)/s.h);s.scale=Math.max(.001,s.scale);s.fitted=true;s.x=(s.view.w-s.w*s.scale)/2;s.y=(s.view.h-s.h*s.scale)/2;s.fitScale=s.scale;bound();schedule();}
    function zoomTo(next,clientX,clientY){const s=active;if(!s?.ready)return;const v=s.view,x=Number.isFinite(clientX)?clamp(clientX-v.x,0,v.w):v.w/2,y=Number.isFinite(clientY)?clamp(clientY-v.y,0,v.h):v.h/2,scale=clamp(next,Math.min(.05,s.fitScale/4),8),ratio=scale/s.scale;s.x=x-(x-s.x)*ratio;s.y=y-(y-s.y)*ratio;s.scale=scale;s.fitted=false;bound();schedule();}
    function zoomBy(factor,x,y){if(active?.ready)zoomTo(active.scale*factor,x,y);}
    function releasePointers(){const s=active;if(!s)return;const viewport=el('image-viewer-viewport'),ids=[...s.pointers.keys()];s.pointers.clear();s.drag=null;s.pinch=null;viewport.classList.remove('viewer-dragging');for(const id of ids)try{if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);}catch(_){} }
    function pointerDown(event){const s=active;if(!s?.ready||event.button!==0)return;event.preventDefault();const v=el('image-viewer-viewport');v.focus({preventScroll:true});if(!s.pointers.size)s.ignoreBackdropClick=false;s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});try{v.setPointerCapture(event.pointerId);}catch(_){}
        if(s.pointers.size===2){s.ignoreBackdropClick=true;const p=[...s.pointers.values()];s.pinch={distance:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};s.drag=null;}else if(s.pointers.size===1){s.drag={id:event.pointerId,x:event.clientX,y:event.clientY,tx:s.x,ty:s.y};v.classList.add('viewer-dragging');}}
    function pointerMove(event){const s=active;if(!s?.ready||!s.pointers.has(event.pointerId))return;if(event.pointerType==='mouse'&&!(event.buttons&1)){releasePointers();return;}event.preventDefault();s.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(s.pinch&&s.pointers.size>=2){const p=[...s.pointers.values()],distance=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),x=(p[0].x+p[1].x)/2,y=(p[0].y+p[1].y)/2;zoomBy(distance/(s.pinch.distance||1),x,y);s.x+=x-s.pinch.x;s.y+=y-s.pinch.y;s.pinch={distance,x,y};bound();schedule();}
        else if(s.drag?.id===event.pointerId){if(Math.hypot(event.clientX-s.drag.x,event.clientY-s.drag.y)>6)s.ignoreBackdropClick=true;s.x=s.drag.tx+event.clientX-s.drag.x;s.y=s.drag.ty+event.clientY-s.drag.y;s.fitted=false;bound();schedule();}}
    function pointerEnd(event){const s=active;if(!s?.pointers.has(event.pointerId))return;releasePointers();}
    function message(value){el('image-viewer-message').textContent=value;el('image-viewer-message').hidden=!value;}
    async function open(source){
        init();const root=el('imageViewer'),image=el('image-viewer-img'),previous=active?.focus||document.activeElement;close(false);
        const s=active={id:++sequence,ready:false,w:0,h:0,scale:1,x:0,y:0,fitted:true,view:null,pointers:new Map(),drag:null,pinch:null,ignoreBackdropClick:false,abort:new AbortController(),focus:previous};
        root.hidden=false;root.classList.add('active');root.setAttribute('aria-busy','true');image.hidden=true;message('正在讀取原圖…');root.querySelector('[data-viewer-action="close"]').focus({preventScroll:true});
        const editorRequest=noteOpenRequest,fromEditor=el('noteModal').classList.contains('active');let timer,abort;
        try{
            const cancelled=new Promise((_,reject)=>{abort=()=>reject(Error('已取消圖片載入'));s.abort.signal.addEventListener('abort',abort,{once:true});}),timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('原圖讀取逾時，請關閉後重試')),30000);});
            const full=await Promise.race([(async()=>notePersistence.resolveEditorValue(typeof source==='function'?await source():source))(),cancelled,timeout]);
            if(active!==s)return;if(fromEditor&&(editorRequest!==noteOpenRequest||!el('noteModal').classList.contains('active'))){close();return;}if(!full)throw Error('這張原圖目前無法讀取，請稍後重試');
            let size=lastSource===full&&image.complete&&image.naturalWidth?lastSize:null;
            if(!size){const decoded=new Image();decoded.decoding='async';decoded.src=full;await Promise.race([noteImageReady(decoded),cancelled,timeout]);size={w:decoded.naturalWidth,h:decoded.naturalHeight};}
            if(active!==s)return;if(fromEditor&&(editorRequest!==noteOpenRequest||!el('noteModal').classList.contains('active'))){close();return;}if(!size?.w||!size?.h)throw Error('圖片尺寸無效');if(lastSource!==full)image.src=full;lastSource=full;lastSize=size;s.w=size.w;s.h=size.h;s.ready=true;image.style.width=s.w+'px';image.style.height=s.h+'px';image.hidden=false;message('');root.removeAttribute('aria-busy');fit();
        }catch(error){if(active===s){root.removeAttribute('aria-busy');message(error.message+'；筆記與原圖仍保留。');}}
        finally{clearTimeout(timer);if(abort)s.abort.signal.removeEventListener('abort',abort);}
    }
    function close(restoreFocus=true){const s=active;releasePointers();active=null;sequence++;cancelAnimationFrame(frame);frame=0;s?.abort.abort();const root=el('imageViewer');if(root){root.classList.remove('active');root.hidden=true;root.removeAttribute('aria-busy');}if(restoreFocus&&s?.focus?.isConnected&&!root?.contains(s.focus))s.focus.focus?.({preventScroll:true});}
    return {open,close};
})();

/* Source: 95-note-keyboard.js */
/* Floating mouse keyboard. It owns no note content or cloud persistence state.
 * Zhuyin data derived from McBopomofo (https://github.com/openvanilla/McBopomofo).
 * MIT License, Copyright (c) 2011-2026 Mengjuei Hsieh et al.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const noteFloatingKeyboard=(()=>{
    const $=id=>document.getElementById(id),modes=['symbols','english','zhuyin','custom'];
    const defaultWidth=420,minWidth=300,maxWidth=760,candidateCount=6,commands={};
    const symbolGroups={
        common:{name:'常用',values:['→','←','↑','↓','↔','⇒','⇔','↗','↘','↳','★','☆','✓','✗','☑','☐','●','○','■','□','▲','△','▼','▽','◆','◇','※','±','×','÷','≠','≈','≤','≥','∞','℃','α','β','γ','δ']},
        greek:{name:'希臘字母',values:[...'αβγδεζηθικλμνξοπρστυφχψω','ς',...'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ']},
        math:{name:'數學／上下標',values:['+','−','×','÷','=','≠','≈','≡','≤','≥','±','∓','∞','∝','√','∑','∏','∫','∂','∆','∇','∈','∉','∪','∩','⊂','⊃','∴','∵',...'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻',...'₀₁₂₃₄₅₆₇₈₉₊₋']},
        punctuation:{name:'標點／單位',values:['，','。','、','；','：','！','？','「','」','『','』','（','）','【','】','《','》','〈','〉','…','—','·','～','％','‰','°','℃','℉','μg','mg','g','mL','L','mmHg','mEq','mol/L','®','©','™']}
    };
    const greekNames=['alpha','beta','gamma','delta','epsilon','zeta','eta','theta','iota','kappa','lambda','mu','nu','xi','omicron','pi','rho','sigma','tau','upsilon','phi','chi','psi','omega'];
    const greekLabels=Object.fromEntries([... 'αβγδεζηθικλμνξοπρστυφχψω'].flatMap((c,i)=>[[c,greekNames[i]],[c.toUpperCase(),greekNames[i]+' 大寫']]));
    const englishRows=['1234567890-=','qwertyuiop[]','asdfghjkl;\'','zxcvbnm,./'];
    const shifted={'1':'!','2':'@','3':'#','4':'$','5':'%','6':'^','7':'&','8':'*','9':'(','0':')','-':'_','=':'+','[':'{',']':'}',';':':',"'":'"',',':'<','.':'>','/':'?','`':'~','\\':'|'};
    const phoneticRows=[['ㄅ','ㄉ','ˇ','ˋ','ㄓ','ˊ','˙','ㄚ','ㄞ','ㄢ','ㄦ'],['ㄆ','ㄊ','ㄍ','ㄐ','ㄔ','ㄗ','ㄧ','ㄛ','ㄟ','ㄣ'],['ㄇ','ㄋ','ㄎ','ㄑ','ㄕ','ㄘ','ㄨ','ㄜ','ㄠ','ㄤ'],['ㄈ','ㄌ','ㄏ','ㄒ','ㄖ','ㄙ','ㄩ','ㄝ','ㄡ','ㄥ']];
    const phoneticHints=['1234567890-','qwertyuiop','asdfghjkl;','zxcvbnm,./'];
    const phoneticGroups=['ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ','ㄧㄨㄩ','ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ','ˉˊˇˋ˙'];
    let panel,modal,editor,title,trigger,initialized=false,shown=false,mode='symbols',group='common',shift=false,englishShift=null,lastSymbolKey='';
    let target=null,epoch=-1,ownEdit=false,physicalComposing=false,drag=null,sizing=null,panelWidth=defaultWidth,resizeFrame=0,statusTimer=0;
    let preferences={v:1,layout:2,custom:[],recent:[],position:null,width:defaultWidth},storageKey='',storageFailed=false,editingCustom=null,removing=false,cancelNextClick=false;
    let phonetic=['','','',''],candidatePage=0,candidates=[],dictionary=null,dictionaryJob=null;
    const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    function safeText(value,limit=64){return typeof value==='string'?[...value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().normalize('NFC')].slice(0,limit).join(''):'';}
    function cleanPreferences(value){
        const seen=new Set(),custom=[];
        for(const item of Array.isArray(value?.custom)?value.custom.slice(0,200):[]){
            const text=safeText(item?.text);if(!text||seen.has(text))continue;seen.add(text);
            custom.push({id:/^[a-zA-Z0-9-]{1,100}$/.test(item.id||'')?item.id:uid(),text,label:safeText(item.label,30)});
        }
        const p=value?.position;
        const width=Number.isFinite(value?.width)?Math.max(minWidth,Math.min(value.width,maxWidth)):defaultWidth;
        return {v:1,layout:2,custom,recent:[...new Set((Array.isArray(value?.recent)?value.recent:[]).map(x=>safeText(x)).filter(Boolean))].slice(0,16),position:p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:p.y}:null,width:value?.layout===2?width:Math.min(defaultWidth,width)};
    }
    function readPreferences(){try{const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw?.v===1)preferences=cleanPreferences(raw);}catch(_){storageFailed=true;}}
    function savePreferences(){try{localStorage.setItem(storageKey,JSON.stringify(preferences));storageFailed=false;}catch(_){storageFailed=true;}updateStorageHint();}
    function updateStorageHint(){const node=$('nk-custom-hint');if(node)node.textContent=storageFailed?'此瀏覽器目前無法永久保存，請匯出備份；本次仍可使用。':'自訂符號保存在目前瀏覽器，可匯出備份或匯入其他裝置。';}
    function message(text){if(!panel)return;clearTimeout(statusTimer);$('nk-status').textContent=text;statusTimer=setTimeout(()=>{if(panel)$('nk-status').textContent='';},4500);}
    function available(){return modal?.classList.contains('active')&&!modal.inert&&!isPreviewMode&&!document.querySelector('.modal-overlay.active:not(#noteModal),dialog[open],#imageViewer.active');}
    function resetTarget(){target=null;epoch=noteOpenRequest;phonetic=['','','',''];candidatePage=0;candidates=[];physicalComposing=false;}
    function captureTarget(){
        if(!modal?.classList.contains('active')||ownEdit)return;
        if(epoch!==noteOpenRequest)resetTarget();
        if(document.activeElement===title){target={kind:'title',start:title.selectionStart??title.value.length,end:title.selectionEnd??title.value.length,direction:title.selectionDirection};}
        else{
            const selection=window.getSelection();if(!selection?.rangeCount)return;
            const range=selection.getRangeAt(0);if(!editor.contains(range.commonAncestorContainer))return;
            target={kind:'body',range:range.cloneRange(),backward:!range.collapsed&&selection.anchorNode===range.endContainer&&selection.anchorOffset===range.endOffset};
        }
    }
    function restoreTarget(){
        if(!available()||epoch!==noteOpenRequest){hide();return null;}
        if(physicalComposing){message('請先完成目前輸入法的選字。');return null;}
        if(!target){message('請先點一下筆記中的插入位置。');return null;}
        if(target.kind==='title'){
            title.focus({preventScroll:true});title.setSelectionRange(Math.min(target.start,title.value.length),Math.min(target.end,title.value.length),target.direction||'none');return title;
        }
        if(!target.range.startContainer.isConnected||!target.range.endContainer.isConnected||!editor.contains(target.range.commonAncestorContainer)){
            target=null;message('文字位置已變動，請點一下要繼續輸入的位置。');return null;
        }
        savedEditorRange=target.range.cloneRange();savedEditorSelectionBackward=target.backward;savedEditorFocusHost=getEditorFocusHostFromRange(savedEditorRange);restoreEditorSelection();return savedEditorFocusHost||editor;
    }
    function notifyInput(host,type,data=null){host.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:type,data}));}
    function beforeInput(host,type,data=null){return host.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:type,data}));}
    function typeText(text){
        const host=restoreTarget();if(!host)return false;
        ownEdit=true;let done=false;
        try{
            if(host===title){
                const room=title.maxLength-(title.value.length-(title.selectionEnd-title.selectionStart));let limited='';
                for(const char of text){if(limited.length+char.length>room)break;limited+=char;}
                if(limited!==text)message('標題最多 100 個字元。');text=limited;if(!text)return false;
            }
            if(!beforeInput(host,'insertText',text)){done=true;return true;}
            done=document.execCommand('insertText',false,text);
            if(!done){
                if(host===title)title.setRangeText(text,title.selectionStart,title.selectionEnd,'end');
                else{const r=window.getSelection().getRangeAt(0),node=document.createTextNode(text);r.deleteContents();r.insertNode(node);r.setStartAfter(node);r.collapse(true);window.getSelection().removeAllRanges();window.getSelection().addRange(r);}
                notifyInput(host,'insertText',text);done=true;
            }
            return done;
        }finally{ownEdit=false;captureTarget();} // Native/fallback input already reaches note autosave.
    }
    function keyCommand(action){
        if(mode==='zhuyin'&&phonetic.some(Boolean)){
            if(action==='backspace'){for(let i=3;i>=0;i--)if(phonetic[i]){phonetic[i]='';break;}candidatePage=0;renderPhonetic();return;}
            if(action==='space'&&!phonetic[3]){phonetic[3]='ˉ';candidatePage=0;renderPhonetic();return;}
            if(action==='enter'||action==='space'){const first=candidates[candidatePage*candidateCount];if(first)chooseCandidate(first);else message('目前沒有候選字，請調整注音或聲調。');return;}
        }
        if(action==='space'){typeText(' ');return;}
        const host=restoreTarget();if(!host)return;ownEdit=true;
        try{
            const keys={enter:'Enter',backspace:'Backspace',delete:'Delete',left:'ArrowLeft',right:'ArrowRight'};
            if(keys[action]&&!host.dispatchEvent(new KeyboardEvent('keydown',{key:keys[action],code:keys[action],bubbles:true,cancelable:true})))return;
            if(action==='left'||action==='right'){
                if(host===title){
                    let pos=action==='left'?title.selectionStart:title.selectionEnd;
                    if(title.selectionStart===title.selectionEnd){let chunks=[];if(typeof Intl.Segmenter==='function')chunks=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(title.value)].map(x=>x.index);else{let offset=0;for(const c of title.value){chunks.push(offset);offset+=c.length;}}const points=[...new Set([0,...chunks,title.value.length])];pos=action==='left'?(points.filter(x=>x<pos).at(-1)??0):(points.find(x=>x>pos)??title.value.length);}
                    title.setSelectionRange(pos,pos);
                }else window.getSelection()?.modify?.('move',action==='left'?'backward':'forward','character');
                return;
            }
            if(action==='enter'&&host===title){message('標題是單行；請點正文後再換行。');return;}
            const types={enter:'insertParagraph',backspace:'deleteContentBackward',delete:'deleteContentForward',undo:'historyUndo',redo:'historyRedo'};
            if(types[action]&&beforeInput(host,types[action]))document.execCommand(({enter:'insertParagraph',backspace:'delete',delete:'forwardDelete',undo:'undo',redo:'redo'})[action],false,null);
        }finally{ownEdit=false;captureTarget();}
    }
    function button(text,attributes={},label=''){
        const node=document.createElement('button');node.type='button';node.textContent=text;
        for(const [key,value] of Object.entries(attributes))node.dataset[key]=value;
        if(label){node.title=label;node.setAttribute('aria-label',label);}return node;
    }
    function insertSymbol(text){if(typeText(text)){preferences.recent=[text,...preferences.recent.filter(x=>x!==text)].slice(0,16);savePreferences();}}
    function renderSymbols(){
        const renderKey=group+(group==='recent'?JSON.stringify(preferences.recent):'');if(lastSymbolKey===renderKey)return;lastSymbolKey=renderKey;
        const grid=$('nk-symbol-grid');grid.replaceChildren();
        const values=group==='recent'?preferences.recent:symbolGroups[group].values;
        for(const text of values)grid.append(button(text,{nkText:text},greekLabels[text]?text+' '+greekLabels[text]:'輸入 '+text));
        if(!values.length){const hint=document.createElement('p');hint.className='nk-hint';hint.textContent='點過的符號會出現在這裡。';grid.append(hint);}
        panel.querySelectorAll('[data-nk-group]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.nkGroup===group)));
    }
    function renderEnglish(){
        if(englishShift===shift)return;englishShift=shift;
        const grid=$('nk-english-grid');
        if(grid.children.length){
            grid.querySelectorAll('[data-nk-base]').forEach(key=>{const base=key.dataset.nkBase,value=shift?(shifted[base]||base.toUpperCase()):base;key.textContent=value;key.dataset.nkLetter=value;key.title='輸入 '+value;key.setAttribute('aria-label',key.title);});
            grid.querySelector('[data-nk-action="shift"]').setAttribute('aria-pressed',String(shift));return;
        }
        const letter=base=>{const value=shift?(shifted[base]||base.toUpperCase()):base;return button(value,{nkLetter:value,nkBase:base},'輸入 '+value);};
        for(const raw of englishRows){const row=document.createElement('div');row.className='nk-key-row nk-letter-row';for(const c of raw)row.append(letter(c));grid.append(row);}
        const shiftKey=button('⇧',{nkAction:'shift'},'大寫／Shift');shiftKey.className='nk-command';shiftKey.setAttribute('aria-pressed',String(shift));
        grid.lastChild.prepend(shiftKey);grid.lastChild.append(letter('\\'));
        const row=document.createElement('div');row.className='nk-key-row nk-space-row';row.append(letter('`'));grid.append(row);
    }
    function mountCommands(){
        // Move one set of command keys into the active layout; no duplicate handlers.
        const mount=(row,names)=>names.forEach(name=>{if(commands[name].parentNode!==row)row.append(commands[name]);});
        if(mode==='english'||mode==='zhuyin'){
            const grid=$(mode==='english'?'nk-english-grid':'nk-phonetic-grid'),rows=grid.querySelectorAll('.nk-letter-row');
            ['backspace','delete','enter'].forEach((name,i)=>mount(rows[i],[name]));
            mount(grid.querySelector('.nk-space-row'),['undo','redo','space','left','right']);
        }else{
            const section=$('nk-'+mode);
            mount(section.querySelector('.nk-edit-row'),['backspace','delete','space','enter']);
            mount(section.querySelector('.nk-nav-row'),['undo','left','right','redo']);
        }
    }
    async function loadDictionary(){
        if(dictionary)return dictionary;if(dictionaryJob)return dictionaryJob;
        dictionaryJob=(async()=>{
            // Dictionary is a separate static file, downloaded only when Zhuyin mode is first used.
            const response=await fetch(new URL('assets/zhuyin-dict.json.gz',document.baseURI));if(!response.ok)throw Error('注音字典下載失敗（'+response.status+'）');const bytes=new Uint8Array(await response.arrayBuffer());
            const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
            dictionary=JSON.parse(text);return dictionary;
        })().catch(error=>{dictionaryJob=null;throw error;});return dictionaryJob;
    }
    function readingKey(){const base=phonetic.slice(0,3).join('');return phonetic[3]?base+(phonetic[3]==='ˉ'?'':phonetic[3]):'*'+base;}
    function renderPhonetic(){
        $('nk-composition').textContent=phonetic.join('')||'點注音，再點候選字';
        const base=phonetic.slice(0,3).join('');candidates=dictionary&&base?[...(dictionary[readingKey()]||'')]:[];
        const pages=Math.max(1,Math.ceil(candidates.length/candidateCount));candidatePage=Math.min(candidatePage,pages-1);
        $('nk-candidate-page').textContent=(candidatePage+1)+' / '+pages;
        $('nk-candidate-prev').disabled=candidatePage===0;$('nk-candidate-next').disabled=candidatePage>=pages-1;
        const grid=$('nk-candidates');grid.replaceChildren();
        for(const text of candidates.slice(candidatePage*candidateCount,(candidatePage+1)*candidateCount))grid.append(button(text,{nkCandidate:text},'選字 '+text));
        const hint=!dictionary?'正在準備離線字庫…':!base?'點注音，再點候選字':!candidates.length?'沒有符合的字，請調整注音或聲調。':!phonetic[3]?'尚未指定聲調，顯示各聲調的候選字。':'點候選字輸入，或按換行選這頁第一個字。';
        $('nk-composition').title=hint;grid.setAttribute('aria-label',hint);
    }
    function chooseCandidate(text){if(typeText(text)){phonetic=['','','',''];candidatePage=0;renderPhonetic();}}
    function renderCustom(){
        const grid=$('nk-custom-grid');grid.replaceChildren();
        for(const item of preferences.custom){const node=button(item.text,{nkCustom:item.id},(removing?'刪除 ':editingCustom?'編輯 ':'輸入 ')+(item.label||item.text));if(removing)node.classList.add('nk-remove');grid.append(node);}
        $('nk-custom-manage').textContent=removing?'完成刪除':'刪除符號';$('nk-custom-manage').setAttribute('aria-pressed',String(removing));
        $('nk-custom-edit').textContent=editingCustom?'完成編輯':'編輯符號';$('nk-custom-edit').setAttribute('aria-pressed',String(!!editingCustom));
        updateStorageHint();
    }
    function render(){
        if(!panel)return;
        panel.querySelectorAll('[data-nk-mode]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.nkMode===mode)));
        for(const name of modes)$('nk-'+name).hidden=name!==mode;
        if(mode==='symbols')renderSymbols();if(mode==='english')renderEnglish();if(mode==='zhuyin')renderPhonetic();if(mode==='custom')renderCustom();
        mountCommands();applySize();scheduleClamp();
    }
    function setMode(next){if(!modes.includes(next))return;mode=next;render();if(mode==='zhuyin'&&!dictionary)void loadDictionary().then(()=>{if(mode==='zhuyin')renderPhonetic();}).catch(()=>{message('字庫未能載入，請再點注音重試。');});}
    function viewportBounds(){const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight};}
    function applySize(width=panelWidth){
        panelWidth=Math.max(minWidth,Math.min(Number.isFinite(width)?width:defaultWidth,maxWidth));
        const visibleWidth=Math.max(160,Math.min(panelWidth,viewportBounds().w-16));
        panel.style.width=Math.round(visibleWidth)+'px';panel.classList.toggle('nk-compact',visibleWidth<420);
        panel.style.setProperty('--nk-key-height',Math.round(Math.max(25,Math.min(48,visibleWidth*.075)))+'px');
        panel.style.setProperty('--nk-key-font',Math.round(Math.max(13,Math.min(23,visibleWidth*.037)))+'px');
        panel.style.setProperty('--nk-phonetic-font',Math.round(Math.max(15,Math.min(25,visibleWidth*.04)))+'px');
    }
    function clampPosition(x,y){
        if(!panel||panel.hidden)return;const v=viewportBounds(),r=panel.getBoundingClientRect();
        x=Math.max(v.x+8,Math.min(Number.isFinite(x)?x:r.left,v.x+v.w-r.width-8));y=Math.max(v.y+8,Math.min(Number.isFinite(y)?y:r.top,v.y+v.h-r.height-8));
        panel.style.left=Math.round(x)+'px';panel.style.top=Math.round(y)+'px';
    }
    function scheduleClamp(){if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(shown&&!panel.hidden){if(sizing)applySize(sizing.nextWidth);clampPosition(drag?.active?drag.nextX:undefined,drag?.active?drag.nextY:undefined);}});}
    function stopDrag(event){
        if(!drag||event?.pointerId!=null&&event.pointerId!==drag.id)return;
        const state=drag;drag=null;panel.classList.remove('nk-dragging');cancelNextClick=state.active||event?.type!=='pointerup';
        if(state.active){clampPosition(state.nextX,state.nextY);const r=panel.getBoundingClientRect();preferences.position={x:r.left,y:r.top};savePreferences();}
        if(state.handle.hasPointerCapture(state.id))state.handle.releasePointerCapture(state.id);
    }
    function stopSizing(){
        if(!sizing)return;const state=sizing;sizing=null;applySize(state.nextWidth);clampPosition();panel.classList.remove('nk-resizing');
        const handle=$('nk-resize-handle');if(handle.hasPointerCapture(state.id))handle.releasePointerCapture(state.id);
        const r=panel.getBoundingClientRect();preferences.width=panelWidth;preferences.position={x:r.left,y:r.top};savePreferences();
    }
    function show(event){
        if(!available())return;if(epoch!==noteOpenRequest)resetTarget();captureTarget();
        if(!target){const range=savedEditorRange?.cloneRange()||document.createRange();if(!editor.contains(range.commonAncestorContainer)){range.selectNodeContents(editor);range.collapse(false);}target={kind:'body',range,backward:false};}
        const wasShown=shown;shown=true;panel.hidden=false;trigger.setAttribute('aria-expanded','true');render();
        if(!wasShown){const v=viewportBounds(),r=panel.getBoundingClientRect(),p=preferences.position||{x:event?.clientX??v.x+v.w-r.width-16,y:event?.clientY??v.y+v.h-r.height-16};clampPosition(p.x+(!preferences.position&&event?12:0),p.y+(!preferences.position&&event?12:0));}
    }
    function hide(){if(!panel)return;stopDrag();stopSizing();shown=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');cancelAnimationFrame(resizeFrame);resizeFrame=0;phonetic=['','','',''];candidatePage=0;}
    function modalChanged(){
        if(!modal.classList.contains('active')||epoch!==noteOpenRequest){hide();resetTarget();return;}
        if(modal.inert){stopDrag();stopSizing();}panel.hidden=!shown||modal.inert;if(shown&&!panel.hidden)scheduleClamp();
    }
    function saveCustom(){
        const raw=$('nk-custom-value').value;
        if([...safeText(raw,129)].length>64){message('每個符號或短語最多 64 個字，請縮短後再保存。');return;}
        const text=safeText(raw),label=safeText($('nk-custom-label').value,30);
        if(!text){message('請先貼上想保存的符號或短語。');$('nk-custom-value').focus();return;}
        const existing=preferences.custom.find(x=>x.text===text),editing=typeof editingCustom==='string'?preferences.custom.find(x=>x.id===editingCustom):null;
        if(existing&&existing!==editing){message('這個符號已經在自訂鍵盤裡。');return;}
        if(editing)Object.assign(editing,{text,label});else if(preferences.custom.length<200)preferences.custom.push({id:uid(),text,label});else{message('最多保存 200 個自訂符號，請先移除不需要的項目。');return;}
        editingCustom=null;$('nk-custom-value').value='';$('nk-custom-label').value='';$('nk-custom-save').textContent='加入';savePreferences();renderCustom();message('已保存，可直接點選使用。');
    }
    function exportCustom(){
        const payload={format:'pharmacy-note-symbols-v1',symbols:preferences.custom.map(({text,label})=>({text,label}))};
        const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='藥學筆記-自訂符號.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    async function importCustom(file){
        if(!file)return;try{
            if(file.size>128*1024)throw Error('備份檔太大');const data=JSON.parse(await file.text());
            if(data?.format!=='pharmacy-note-symbols-v1'||!Array.isArray(data.symbols)||data.symbols.length>200||data.symbols.some(x=>!x||typeof x.text!=='string'||!safeText(x.text)||[...x.text].length>64||x.label!=null&&typeof x.label!=='string'))throw Error('不是有效的自訂符號備份');
            const known=new Set(preferences.custom.map(x=>x.text)),added=[];
            for(const item of data.symbols){const text=safeText(item.text);if(!known.has(text)){known.add(text);added.push({id:uid(),text,label:safeText(item.label,30)});}}
            if(preferences.custom.length+added.length>200)throw Error('匯入後超過 200 個符號，請先整理目前清單');
            preferences.custom.push(...added);savePreferences();renderCustom();message('已匯入 '+added.length+' 個符號，重複的已略過。');
        }catch(error){message('匯入未完成：'+error.message+'。');}finally{$('nk-import-file').value='';}
    }
    function click(event){
        const node=event.target.closest('button');if(!node||!panel.contains(node))return;
        if(node.dataset.nkMode)return setMode(node.dataset.nkMode);
        if(node.dataset.nkGroup){group=node.dataset.nkGroup;renderSymbols();return;}
        if(node.dataset.nkText)return insertSymbol(node.dataset.nkText);
        if(node.dataset.nkLetter)return typeText(node.dataset.nkLetter);
        if(node.dataset.nkCandidate)return chooseCandidate(node.dataset.nkCandidate);
        if(node.dataset.nkPhonetic){const c=node.dataset.nkPhonetic,index=phoneticGroups.findIndex(g=>g.includes(c));if(index>=0)phonetic[index]=c;candidatePage=0;renderPhonetic();return;}
        if(node.dataset.nkCustom){
            const item=preferences.custom.find(x=>x.id===node.dataset.nkCustom);if(!item)return;
            if(removing){preferences.custom=preferences.custom.filter(x=>x!==item);savePreferences();renderCustom();message('已刪除自訂符號「'+(item.label||item.text)+'」。');}
            else if(editingCustom){editingCustom=item.id;$('nk-custom-value').value=item.text;$('nk-custom-label').value=item.label;$('nk-custom-save').textContent='保存修改';}
            else insertSymbol(item.text);return;
        }
        const action=node.dataset.nkAction;
        if(action==='shift'){shift=!shift;renderEnglish();return;}
        if(action==='clear-phonetic'){phonetic=['','','',''];candidatePage=0;renderPhonetic();return;}
        if(action==='literal-phonetic'){if(phonetic.some(Boolean)&&typeText(phonetic.join(''))){phonetic=['','','',''];renderPhonetic();}return;}
        if(action==='candidate-prev'||action==='candidate-next'){candidatePage+=action==='candidate-next'?1:-1;renderPhonetic();return;}
        if(action==='save-custom'){saveCustom();return;}
        if(action==='remove-custom'){removing=!removing;editingCustom=null;$('nk-custom-value').value='';$('nk-custom-label').value='';$('nk-custom-save').textContent='加入';renderCustom();return;}
        if(action==='edit-custom'){editingCustom=editingCustom?null:true;removing=false;$('nk-custom-value').value='';$('nk-custom-label').value='';$('nk-custom-save').textContent='加入';renderCustom();message(editingCustom?'點一個自訂符號後，可修改內容與名稱。':'');return;}
        if(action==='export'){exportCustom();return;}if(action==='import'){$('nk-import-file').click();return;}
        if(['backspace','delete','space','enter','left','right','undo','redo'].includes(action))keyCommand(action);
    }
    function initialize(){
        if(initialized)return;initialized=true;modal=$('noteModal');editor=$('modal-text');title=$('note-title-input');
        let hash=2166136261;for(const c of String(noteDriveBoot.workspace||noteDriveBoot.appUrl||'pharmacy-notes'))hash=Math.imul(hash^c.charCodeAt(0),16777619);storageKey='pharmacy-note-keyboard-v1-'+(hash>>>0).toString(36);readPreferences();panelWidth=preferences.width;
        panel=document.createElement('section');panel.id='note-floating-keyboard';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','浮動文字鍵盤');
        const editRows='<div class="nk-command-rows"><div class="nk-key-row nk-edit-row"></div><div class="nk-key-row nk-nav-row"></div></div>';
        panel.setAttribute('aria-description','右鍵關閉；按住左鍵拖曳移動；右下角縮放。');
        panel.innerHTML=`<div class="nk-content"><nav class="nk-tabs" aria-label="鍵盤類型" title="按住左鍵拖曳移動；右鍵關閉；右下角縮放">${[['symbols','符號'],['english','英文／數字'],['zhuyin','注音'],['custom','自訂']].map(([id,label])=>`<button type="button" data-nk-mode="${id}" aria-pressed="false">${label}</button>`).join('')}</nav>
          <div class="nk-body"><section id="nk-symbols"><nav id="nk-groups" aria-label="符號分類"></nav><div id="nk-symbol-grid" class="nk-symbol-grid"></div>${editRows}</section>
          <section id="nk-english" hidden><div id="nk-english-grid"></div></section>
          <section id="nk-zhuyin" hidden><div class="nk-composition-row"><output id="nk-composition" aria-label="注音組字"></output><button type="button" data-nk-action="clear-phonetic">清除</button><button type="button" data-nk-action="literal-phonetic" title="直接輸入注音符號">注音原字</button><span class="nk-candidate-controls"><button type="button" id="nk-candidate-prev" data-nk-action="candidate-prev" aria-label="上一頁候選字" title="上一頁候選字">‹</button><span id="nk-candidate-page"></span><button type="button" id="nk-candidate-next" data-nk-action="candidate-next" aria-label="下一頁候選字" title="下一頁候選字">›</button></span></div><div id="nk-candidates" class="nk-candidates" role="group"></div><div id="nk-phonetic-grid"></div></section>
          <section id="nk-custom" hidden><div class="nk-custom-form"><label>符號／短語<input id="nk-custom-value" type="text" maxlength="128" placeholder="貼上想保存的符號" autocomplete="off"></label><label>名稱（選填）<input id="nk-custom-label" type="text" maxlength="30" placeholder="方便辨識的名稱" autocomplete="off"></label><button type="button" id="nk-custom-save" data-nk-action="save-custom">加入</button></div><div class="nk-custom-tools"><button type="button" id="nk-custom-edit" data-nk-action="edit-custom">編輯符號</button><button type="button" id="nk-custom-manage" data-nk-action="remove-custom">刪除符號</button><button type="button" data-nk-action="export">匯出備份</button><button type="button" data-nk-action="import">匯入</button><input id="nk-import-file" type="file" accept="application/json,.json" hidden></div><p id="nk-custom-hint" class="nk-hint"></p><div id="nk-custom-grid" class="nk-symbol-grid"></div>${editRows}</section></div>
          <div id="nk-status" role="status" aria-live="polite"></div><button type="button" id="nk-resize-handle" aria-label="調整鍵盤大小" title="拖曳縮放鍵盤；雙擊還原大小；方向鍵也可調整"><span aria-hidden="true">◢</span></button></div>`;
        // A sibling avoids sending custom-symbol form input through note autosave.
        // Its stacking order stays below the later image/table/link dialogs.
        modal.after(panel);
        for(const [key,value]of Object.entries(symbolGroups))$('nk-groups').append(button(value.name,{nkGroup:key}));$('nk-groups').append(button('最近',{nkGroup:'recent'}));
        for(const [name,text,label] of [['backspace','⌫','退格'],['delete','Del','刪除下一字'],['space','空白','空白'],['enter','↵','換行／注音選字'],['left','←','游標往左'],['right','→','游標往右'],['undo','↶','復原'],['redo','↷','重做']]){commands[name]=button(text,{nkAction:name},label);commands[name].className='nk-command';}
        phoneticRows.forEach((values,i)=>{const row=document.createElement('div');row.className='nk-key-row nk-letter-row';values.forEach((c,j)=>{const key=button(c,{nkPhonetic:c},'注音 '+c);const hint=document.createElement('small');hint.textContent=phoneticHints[i][j];key.append(hint);row.append(key);});$('nk-phonetic-grid').append(row);});
        const tone=button('一聲',{nkPhonetic:'ˉ'},'注音一聲（ˉ）');tone.className='nk-command';$('nk-phonetic-grid').lastChild.prepend(tone);
        const spaceRow=document.createElement('div');spaceRow.className='nk-key-row nk-space-row';$('nk-phonetic-grid').append(spaceRow);
        trigger=button('⌨ 鍵盤',{},'開啟／關閉浮動鍵盤（也可按右鍵）');trigger.id='note-keyboard-toggle';trigger.setAttribute('aria-controls',panel.id);trigger.setAttribute('aria-expanded','false');modal.querySelector('.toolbar-row-main').append(trigger);
        trigger.addEventListener('pointerdown',event=>{if(event.button===0){captureTarget();event.preventDefault();}});trigger.addEventListener('click',()=>{if(shown&&!panel.hidden)hide();else show();});
        const toggleContext=event=>{if(event.shiftKey||!available()||panel.contains(event.target)&&event.target.closest('input,textarea,select'))return;event.preventDefault();if(shown&&!panel.hidden){captureTarget();hide();restoreTarget();}else show(event);};
        modal.addEventListener('contextmenu',toggleContext);panel.addEventListener('contextmenu',toggleContext);
        modal.addEventListener('pointerdown',event=>{if(event.button===2)captureTarget();},true);
        for(const type of ['select','input','keyup','pointerup','focus'])title.addEventListener(type,()=>{if(shown)captureTarget();});
        document.addEventListener('selectionchange',()=>{if(shown&&!drag&&!sizing&&!panel.contains(document.activeElement))captureTarget();});
        modal.addEventListener('compositionstart',()=>physicalComposing=true,true);modal.addEventListener('compositionend',()=>{physicalComposing=false;captureTarget();},true);
        panel.addEventListener('pointerdown',event=>{
            if(event.button!==0||event.isPrimary===false||event.target.closest('input,textarea,select,#nk-resize-handle'))return;
            event.preventDefault();stopDrag();cancelNextClick=false;
            const handle=event.target.closest('button')||panel;drag={id:event.pointerId,x:event.clientX,y:event.clientY,handle,active:false};handle.setPointerCapture(event.pointerId);
        });
        panel.addEventListener('click',event=>{if(cancelNextClick&&event.detail!==0){cancelNextClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);panel.addEventListener('click',click);
        $('nk-custom-value').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();saveCustom();}});$('nk-custom-label').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();saveCustom();}});
        $('nk-import-file').addEventListener('change',event=>void importCustom(event.target.files[0]));
        document.addEventListener('pointermove',event=>{
            if(drag?.id!==event.pointerId)return;if(!event.buttons){stopDrag(event);return;}
            const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
            if(!drag.active){if(Math.hypot(dx,dy)<6)return;const r=panel.getBoundingClientRect();drag.active=true;drag.left=r.left;drag.top=r.top;panel.classList.add('nk-dragging');}
            drag.nextX=drag.left+dx;drag.nextY=drag.top+dy;scheduleClamp();
        });
        for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,stopDrag);
        const sizeHandle=$('nk-resize-handle');
        sizeHandle.addEventListener('pointerdown',event=>{
            if(event.button!==0)return;event.preventDefault();stopDrag();cancelNextClick=false;
            const r=panel.getBoundingClientRect();sizing={id:event.pointerId,x:event.clientX,y:event.clientY,width:r.width,height:r.height,nextWidth:r.width};
            sizeHandle.setPointerCapture(event.pointerId);panel.classList.add('nk-resizing');
        });
        sizeHandle.addEventListener('pointermove',event=>{if(sizing?.id!==event.pointerId)return;const s=sizing,dx=event.clientX-s.x,dy=event.clientY-s.y;s.nextWidth=s.width*(1+(dx*s.width+dy*s.height)/(s.width*s.width+s.height*s.height));scheduleClamp();});
        for(const type of ['pointerup','pointercancel','lostpointercapture'])sizeHandle.addEventListener(type,stopSizing);
        sizeHandle.addEventListener('dblclick',()=>{stopSizing();applySize(defaultWidth);clampPosition();preferences.width=panelWidth;savePreferences();});
        sizeHandle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key))return;event.preventDefault();event.stopPropagation();applySize(event.key==='Home'?defaultWidth:panelWidth+(['ArrowLeft','ArrowUp'].includes(event.key)?-20:20));clampPosition();preferences.width=panelWidth;savePreferences();});
        window.addEventListener('blur',()=>{stopDrag();stopSizing();});
        const viewportChanged=()=>{applySize();scheduleClamp();};window.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('resize',viewportChanged);
        new ResizeObserver(scheduleClamp).observe(panel);new MutationObserver(modalChanged).observe(modal,{attributes:true,attributeFilter:['class','inert']});
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&shown&&!panel.hidden&&available()){event.preventDefault();event.stopPropagation();hide();restoreTarget();}},true);
        window.addEventListener('storage',event=>{if(event.key===storageKey){readPreferences();if(!sizing){applySize(preferences.width);scheduleClamp();}if(mode==='custom')renderCustom();if(mode==='symbols'&&group==='recent')renderSymbols();}});
        render();
    }
    return {initialize};
})();
/* Source: 96-gallery-converter.js */
/* One-time conversion: move images from the old separate image area (gallery) into
 * the note text, at the end of each note — exactly what pressing「移入文字」on every
 * image does, using that same code path. Image totals are counted before and after;
 * if they differ the run stops and nothing more is changed. */
const noteGalleryConverter = (() => {
    'use strict';
    let running = false;
    const inlineCount = html => (String(html || '').match(/<img\b/gi) || []).length;
    const waitFor = async (test, ms = 30000) => {
        const end = Date.now() + ms;
        while (!test()) {if (Date.now() > end) throw new Error('等待逾時'); await new Promise(r => setTimeout(r, 60));}
    };
    function pending() {return notesData.filter(note => collectLegacyGalleryImages(note).length);}
    function totals() {
        let gallery = 0, inline = 0;
        for (const note of notesData) {gallery += collectLegacyGalleryImages(note).length; inline += inlineCount(note.text);}
        return {gallery, inline, all: gallery + inline};
    }
    async function convertNote(note) {
        const modal = document.getElementById('noteModal');
        await openEditModal(note.id);
        await waitFor(() => modal.classList.contains('active') && editingNoteId === note.id);
        const expected = collectLegacyGalleryImages(note).length;
        await waitFor(() => currentPastedImages.length === expected, 10000);
        while (currentPastedImages.length) {
            const before = currentPastedImages.length;
            savedEditorRange = null;            // insert at the end of the note text
            await window.moveGalleryImageInline(0);
            if (currentPastedImages.length >= before) throw new Error('「' + (note.title || notePlainText(note.text).slice(0, 20)) + '」的圖片尚未讀取完成，請稍後再試。');
        }
        saveNote();
        await waitFor(() => !modal.classList.contains('active'));
    }
    async function run(onProgress = () => {}) {
        if (running) return;
        if (noteDriveServer.isReadOnly()) throw new Error('目前是唯讀檢查模式，請先開啟編輯。');
        if (previewModeBlocksEditing()) throw new Error('請先關閉「預覽模式」再轉換。');
        running = true;
        try {
            await notePersistence.flush();
            const list = pending(), before = totals();
            let done = 0;
            for (const note of list) {
                const expectedAfter = inlineCount(note.text) + collectLegacyGalleryImages(note).length;
                await convertNote(note);
                const saved = notesData.find(n => n.id === note.id);
                if (!saved || collectLegacyGalleryImages(saved).length || inlineCount(saved.text) !== expectedAfter)
                    throw new Error('轉換「' + (note.title || notePlainText(note.text).slice(0, 20)) + '」後圖片數不符，已停止；這則筆記可從「垃圾桶與版本」還原。');
                onProgress(++done, list.length);
            }
            await notePersistence.flush();
            const after = totals();
            if (after.gallery !== 0 || after.all !== before.all) throw new Error('圖片總數不符（轉換前 ' + before.all + '、轉換後 ' + after.all + '），請從「垃圾桶與版本」還原並回報。');
            return {notes: list.length, images: before.gallery, total: after.all};
        } finally {running = false;}
    }
    function initialize() {
        const button = document.getElementById('drive-gallery-convert'), message = document.getElementById('drive-message');
        if (!button) return;
        const refresh = () => {
            if (!document.getElementById('drive-tools')?.open) return;
            const count = pending().length;
            button.hidden = !count;
            button.textContent = '把舊圖片區移進文字（' + count + ' 則）';
            button.disabled = running || noteDriveServer.isReadOnly();
            button.title = noteDriveServer.isReadOnly() ? '唯讀檢查模式下不能轉換' : '';
        };
        window.addEventListener('note-drive-state', refresh);
        document.getElementById('drive-tools')?.addEventListener('toggle', refresh);
        button.onclick = async () => {
            const list = pending(), images = list.reduce((n, note) => n + collectLegacyGalleryImages(note).length, 0);
            if (!confirm('要把 ' + list.length + ' 則筆記、共 ' + images + ' 張舊圖片區的圖片，移到各自筆記文字的最後面嗎？\n\n效果和在編輯畫面逐張按「移入文字」一樣，畫記也會保留。轉換前後會核對圖片總數。')) return;
            button.disabled = true;
            try {
                const result = await run((done, total) => {message.textContent = '正在轉換舊圖片區：' + done + '／' + total + ' 則…';});
                message.textContent = '轉換完成：' + result.notes + ' 則筆記、' + result.images + ' 張圖片已移進文字；全部圖片共 ' + result.total + ' 張，數量一致。';
            } catch (error) {
                message.textContent = error.message;
            } finally {refresh();}
        };
        refresh();
    }
    return {initialize, run, pending, totals};
})();
/* Source: 97-linked-images.js */
/* Some older notes show pictures straight from another website (for example
 * <img src="https://img.yamol.tw/...">). They disappear if that site removes them.
 * This tool downloads each one (directly, or through the owner's image proxy) and
 * stores it with the note, using the normal editor and save path. Images that cannot
 * be downloaded keep their link and are listed. */
const noteLinkedImages = (() => {
    'use strict';
    let running = false;
    const isLinked = src => /^https?:\/\//i.test(String(src || '').trim());
    const imagesIn = html => [...new DOMParser().parseFromString(String(html || ''), 'text/html').querySelectorAll('img')].map(i => i.getAttribute('src') || '');
    const linkedIn = html => imagesIn(html).filter(isLinked);
    const waitFor = async (test, ms = 30000) => {
        const end = Date.now() + ms;
        while (!test()) {if (Date.now() > end) throw new Error('等待逾時'); await new Promise(r => setTimeout(r, 60));}
    };
    const label = note => '「' + (note.title || notePlainText(note.text).slice(0, 20) || '未命名') + '」';
    function pending() {return notesData.filter(note => linkedIn(note.text).length);}
    // Cheap text scan (no HTML parsing): this runs whenever the save status changes.
    const LINKED = /<img\b[^>]*?\ssrc\s*=\s*["']\s*https?:\/\//gi;
    function count() {return notesData.reduce((n, note) => n + (String(note.text || '').match(LINKED) || []).length, 0);}

    /* The editor treats a downloaded copy as "the same image" as its web link (so it
       never stores duplicates), which means swapping it in the editor is not saved.
       So the note's HTML is updated directly and saved through the normal autosave. */
    async function storeNote(note, failures) {
        const urls = [...new Set(linkedIn(note.text))], ready = new Map();
        for (const url of urls) {
            try {
                const data = await noteExternalImages.resolve(url);
                if (!/^data:image\//.test(data)) throw new Error('不是圖片');
                ready.set(url, data);
            } catch (error) {failures.push({note: label(note), url, message: error.message});}
        }
        if (!ready.size) return 0;
        const current = notesData.find(n => n.id === note.id);
        if (!current) return 0;
        const template = document.createElement('template');
        template.innerHTML = current.text;
        let changed = 0;
        for (const image of template.content.querySelectorAll('img')) {
            const data = ready.get(image.getAttribute('src'));
            if (!data) continue;
            image.setAttribute('src', data); image.removeAttribute('srcset'); changed++;
        }
        if (!changed) return 0;
        const before = imagesIn(current.text).length, linkedBefore = linkedIn(current.text).length;
        const next = {...current, text: template.innerHTML, updatedAt: new Date().toISOString()};
        if (imagesIn(next.text).length !== before) throw new Error(label(note) + '處理後圖片數不符，已停止。');
        notesData[notesData.indexOf(current)] = next;
        return linkedBefore - linkedIn(next.text).length;
    }
    async function run(onProgress = () => {}) {
        if (running) return;
        if (noteDriveServer.isReadOnly()) throw new Error('目前是唯讀檢查模式，請先開啟編輯。');
        if (previewModeBlocksEditing()) throw new Error('請先關閉「預覽模式」再執行。');
        running = true;
        try {
            await notePersistence.flush();
            const list = pending(), total = count(), failures = [];
            let stored = 0, done = 0;
            if (document.getElementById('noteModal').classList.contains('active')) throw new Error('請先關閉正在編輯的筆記。');
            for (const note of list) {
                stored += await storeNote(note, failures);
                onProgress(++done, list.length, stored, total);
                if (done % 10 === 0) {autoSave(100); await notePersistence.flush();}
            }
            autoSave(100);
            await notePersistence.flush();
            filterNotes();
            return {notes: list.length, total, stored, failures};
        } finally {running = false;}
    }
    function initialize() {
        const button = document.getElementById('drive-linked-images'), message = document.getElementById('drive-message');
        if (!button) return;
        const refresh = () => {
            if (!document.getElementById('drive-tools')?.open) return;   // only needed while the panel is open
            const n = count();
            button.hidden = !n;
            button.textContent = '把連結圖片存進雲端（' + n + ' 張）';
            button.disabled = running || noteDriveServer.isReadOnly();
            button.title = noteDriveServer.isReadOnly() ? '唯讀檢查模式下不能執行' : '';
        };
        window.addEventListener('note-drive-state', refresh);
        document.getElementById('drive-tools')?.addEventListener('toggle', refresh);
        button.onclick = async () => {
            const n = count();
            if (!confirm('有 ' + n + ' 張圖片目前只是連到其他網站（例如阿摩）。\n要把它們下載並存進你的 Google Drive 嗎？\n\n存好後，就算原網站刪掉圖片，筆記裡的圖也還在。下載不到的圖會保留原連結並列出來。')) return;
            button.disabled = true;
            try {
                const result = await run((done, total, stored) => {message.textContent = '正在儲存連結圖片：' + done + '／' + total + ' 則筆記，已存 ' + stored + ' 張…';});
                message.textContent = '完成：' + result.stored + '／' + result.total + ' 張連結圖片已存進雲端。' +
                    (result.failures.length ? ' 有 ' + result.failures.length + ' 張下載不到，保留原連結：' + result.failures.slice(0, 5).map(f => f.note + '（' + f.message + '）').join('、') + (result.failures.length > 5 ? '…' : '') : '');
                window.noteLinkedImageFailures = result.failures;
            } catch (error) {
                message.textContent = error.message;
            } finally {refresh();}
        };
        refresh();
    }
    return {initialize, run, pending, count};
})();
/* Source: 98-appearance.js */
/* Appearance: light / dark / follow the device, and the phone bottom bar that tucks
 * away while reading. The chosen theme is applied before the page draws (index.html). */
const noteAppearance = (() => {
    'use strict';
    const KEY = 'nd-theme';
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const read = () => {try {return localStorage.getItem(KEY) || 'light';} catch (_) {return 'light';}};   // default: same look as before
    function apply(choice = read()) {
        const dark = choice === 'dark' || (choice === 'system' && media?.matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }
    function setupSetting() {
        const tools = document.getElementById('drive-tools');
        if (!tools || document.getElementById('site-theme')) return;
        const row = document.createElement('label');
        row.className = 'site-appearance';
        row.innerHTML = '外觀 <select id="site-theme"><option value="light">淺色</option><option value="dark">深色</option><option value="system">跟隨裝置</option></select>';
        tools.querySelector('.drive-actions')?.before(row);
        const select = row.querySelector('select');
        select.value = read();
        select.onchange = () => {try {localStorage.setItem(KEY, select.value);} catch (_) {} apply(select.value);};
    }
    function setupDock() {
        let lastY = window.scrollY, ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return; ticking = true;
            requestAnimationFrame(() => {
                ticking = false;
                const y = window.scrollY, phone = window.innerWidth <= 650;
                const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 80;
                if (!phone || y < 120 || nearBottom) document.body.classList.remove('note-dock-tucked');
                else if (y > lastY + 6) document.body.classList.add('note-dock-tucked');
                else if (y < lastY - 6) document.body.classList.remove('note-dock-tucked');
                lastY = y;
            });
        }, {passive: true});
    }
    function initialize() {
        apply();
        media?.addEventListener?.('change', () => apply());
        setupSetting();
        setupDock();
    }
    return {initialize, apply};
})();
/* Source: 99-backups.js */
/* Weekly backups, restore, and tidying old version files.
 * - Once a week (checked when the site opens) the current version of this subject is
 *   copied to Drive folder 每週備份. The newest 8 are kept.
 * - Restore makes the chosen backup the current version again. The current content is
 *   backed up first, so a restore can itself be undone.
 * - 整理舊版本 moves old version files (one is written per save) to Drive trash,
 *   keeping the newest 200 and one per month. Notes and images are not touched.
 */
const noteBackups = (() => {
    'use strict';
    const KIND = {weekly: '每週自動', manual: '手動', 'before-restore': '還原前'};
    const $ = id => document.getElementById(id);
    const say = text => {const el = $('backup-status'); if (el) el.textContent = text;};
    const when = iso => new Date(iso).toLocaleString('zh-TW', {year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'});
    let busy = false;

    async function render() {
        const list = $('backup-list');
        list.innerHTML = '<p class="backup-empty">正在讀取備份清單…</p>';
        try {
            const {backups} = await noteDriveRpc('backups');
            if (!backups.length) {list.innerHTML = '<p class="backup-empty">還沒有備份。按「立即備份」建立第一份；之後每週會自動備份。</p>'; return;}
            list.innerHTML = backups.map(b => '<div class="backup-row"><div><b>' + escapeHtml(when(b.createdTime)) + '</b><span>' +
                escapeHtml((KIND[b.kind] || b.kind) + (b.count ? '・' + b.count + ' 筆資料' : '')) + '</span></div>' +
                '<button type="button" data-on-click="noteRestoreBackup" data-args="' + escapeHtml(JSON.stringify([b.id, when(b.createdTime)])) + '">還原這份</button></div>').join('');
        } catch (error) {list.innerHTML = '<p class="backup-empty">' + escapeHtml(error.message) + '</p>';}
    }
    function open() {$('backupModal').classList.add('active'); say(''); void render();}
    function close() {$('backupModal').classList.remove('active');}

    async function backupNow() {
        if (busy) return; busy = true; $('backup-now').disabled = true; say('正在備份…');
        try {await notePersistence.flush(); await noteDriveRpc('backupNow'); say('已備份。'); await render();}
        catch (error) {say('備份失敗：' + error.message);}
        finally {busy = false; $('backup-now').disabled = false;}
    }
    async function restore(fileId, label) {
        if (busy) return;
        if (!confirm('要把這個科目還原成「' + label + '」的內容嗎？\n\n之後新增或修改的筆記會回到那時候的樣子。\n還原前會先自動備份目前的內容，所以之後也可以再還原回來。')) return;
        busy = true; say('正在保存目前內容並備份…');
        try {
            await notePersistence.flush();
            if (notePersistence.hasUnsavedChanges()) throw new Error('目前還有尚未存到雲端的修改，請等右上角顯示已同步後再試。');
            await noteDriveServer.call({action: 'backupNow', book: noteDriveBoot.book, kind: 'before-restore'});
            say('正在還原…');
            const result = await noteDriveRpc('restoreBackup', {fileId});
            if (!result.success) throw new Error(result.error || '還原未完成。');
            say('已還原，正在重新載入…');
            setTimeout(() => location.reload(), 300);
        } catch (error) {say('還原失敗：' + error.message); busy = false;}
    }

    async function tidy() {
        const message = $('drive-message'), button = $('drive-tidy');
        if (busy) return; busy = true; button.disabled = true;
        try {
            message.textContent = '正在清點舊版本檔案…';
            const plan = await noteDriveServer.call({action: 'versionPlan', book: noteDriveBoot.book});
            if (!plan.success) throw new Error(plan.error);
            if (!plan.trash) {message.textContent = '舊版本檔案共 ' + plan.total + ' 個，都在保留範圍內，不需要整理。'; return;}
            if (!confirm('這個科目每次存檔都會留下一個小的「版本檔」，目前共有 ' + plan.total + ' 個。\n\n會保留 ' + plan.keep + ' 個（最新 200 個＋每個月最後一個），其餘 ' + plan.trash +
                ' 個移到 Google 雲端硬碟的垃圾桶（30 天內都能救回）。\n\n筆記內容、圖片和每週備份都不會受影響。要開始嗎？')) {message.textContent = '已取消整理。'; return;}
            const result = await noteDriveServer.call({action: 'cleanupVersions', book: noteDriveBoot.book,
                onProgress: (done, total) => {message.textContent = '正在整理舊版本：' + done + ' / ' + total;}});
            if (!result.success) throw new Error(result.error);
            message.textContent = '整理完成：保留 ' + result.kept + ' 個，' + result.trashed + ' 個已移到雲端硬碟垃圾桶。';
        } catch (error) {message.textContent = '整理未完成：' + error.message + '（可以再按一次繼續）';}
        finally {busy = false; button.disabled = false;}
    }

    /* Weekly check: at most twice a day, after the subject has loaded and the writer is idle. */
    let checked = false;
    async function weekly() {
        if (checked) return; checked = true;
        const key = 'nd-weekly-check-' + noteDriveBoot.book;
        if (Date.now() - Number(localStorage.getItem(key) || 0) < 12 * 3600000) return;
        await new Promise(r => setTimeout(r, window.NOTE_BACKUP_DELAY ?? 20000));
        await noteTypingIdle(3000, 120000);
        try {
            const result = await noteDriveServer.call({action: 'weeklyBackup', book: noteDriveBoot.book});
            if (result.success && !result.readOnly) localStorage.setItem(key, String(Date.now()));
        } catch (_) {}
    }
    function start() {
        $('drive-backups')?.addEventListener('click', open);
        $('drive-tidy')?.addEventListener('click', () => void tidy());
        window.addEventListener('note-drive-state', event => {if (event.detail?.loaded) void weekly();});
    }
    return {start, open, close, backupNow, restore, tidy};
})();
function closeBackupModal() {noteBackups.close();}
function noteBackupNow() {void noteBackups.backupNow();}
function noteRestoreBackup(fileId, label) {void noteBackups.restore(fileId, label);}
noteBackups.start();
