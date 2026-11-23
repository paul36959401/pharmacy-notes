/* Source: 99-editor-history.js */
/* 編輯筆記的「復原／重做」（↶ ↷ 按鈕、Ctrl+Z、Ctrl+Y／Ctrl+Shift+Z）。
 *  - 每次停手約 0.8 秒記一步；貼上、剪下、拖放、按格式快捷鍵（Ctrl／Alt+…）、按工具列按鈕之前
 *    也會先記一步，所以「不小心 Ctrl+V 蓋掉選取的字」按一次復原就回來。
 *  - 記的是編輯區的複本（DOM clone）：圖片資料不會被複製一份，記憶體與速度負擔很小；
 *    打字時只會設一個旗標，真正的複製在停手後才做。
 *  - 復原後會照常自動儲存。關掉再打開同一則筆記（同一次開啟網站內），還能接著復原。
 */
const noteEditorHistory = (() => {
    'use strict';
    const LIMIT = 120, IDLE_MS = 800;
    const TRANSIENT_NODES = '.inline-image-controls,.inline-drop-marker,.inline-annotation-overlay,.annotation-badge,.note-table-controls,.table-drop-marker,[data-selection-bookmark]';
    const TRANSIENT_CLASSES = ['image-selected', 'inline-image-dragging', 'controls-open', 'note-table-dragging', 'cell-selection-mode', 'table-cell-selected', 'table-cell-anchor', 'table-active-cell', 'note-editor-image-loading', 'note-editor-image-error'];
    const byNote = new Map();       // note id → {states, index}
    let editor = null, history = null, noteKey = null, dirty = false, timer = 0, observer = null, restoring = false;

    /* ---------- snapshots ---------- */
    function snapshot() {
        const copy = editor.cloneNode(true);
        copy.querySelectorAll(TRANSIENT_NODES).forEach(node => node.remove());
        copy.querySelectorAll('.' + TRANSIENT_CLASSES.join(',.')).forEach(el => {el.classList.remove(...TRANSIENT_CLASSES); if (!el.classList.length) el.removeAttribute('class');});
        copy.querySelectorAll('img[data-note-editor-preview]').forEach(img => {img.removeAttribute('srcset'); img.removeAttribute('data-note-editor-preview'); img.removeAttribute('title');});
        copy.querySelectorAll('img[data-note-editor-dimensions]').forEach(img => {img.removeAttribute('width'); img.removeAttribute('height'); img.removeAttribute('data-note-editor-dimensions');});
        return {node: copy, sel: caret()};
    }
    // Caret as character offsets in the note text (transient controls skipped).
    function textNodes(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: node => node.parentElement?.closest(TRANSIENT_NODES) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
        const list = []; for (let n; (n = walker.nextNode());) list.push(n); return list;
    }
    function caret() {
        const selection = getSelection();
        if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return null;
        const range = selection.getRangeAt(0), nodes = textNodes(editor);
        const offsetOf = (container, offset) => {
            const point = document.createRange(); point.setStart(container, offset);
            let total = 0;
            for (const node of nodes) {
                if (node === container) return total + offset;
                if (point.comparePoint(node, 0) > 0) return total;   // this text starts after the caret
                total += node.data.length;
            }
            return total;
        };
        return {start: offsetOf(range.startContainer, range.startOffset), end: offsetOf(range.endContainer, range.endOffset)};
    }
    function placeCaret(sel) {
        if (!sel) return;
        const nodes = textNodes(editor), find = target => {
            let total = 0;
            for (const node of nodes) {if (target <= total + node.data.length) return [node, target - total]; total += node.data.length;}
            const last = nodes[nodes.length - 1]; return last ? [last, last.data.length] : [editor, editor.childNodes.length];
        };
        try {
            const range = document.createRange(), [a, ao] = find(sel.start), [b, bo] = find(sel.end);
            range.setStart(a, ao); range.setEnd(b, bo);
            const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
            (a.parentElement || editor).scrollIntoView?.({block: 'nearest'});
        } catch (_) {}
    }

    /* ---------- steps ---------- */
    function checkpoint() {
        clearTimeout(timer); timer = 0;
        if (!history || !dirty || restoring) return;
        dirty = false;
        const state = snapshot();
        if (state.node.isEqualNode(history.states[history.index].node)) {history.states[history.index].sel = state.sel; return refresh();}
        history.states.length = history.index + 1;           // a new change drops the redo branch
        history.states.push(state);
        if (history.states.length > LIMIT) history.states.shift();
        history.index = history.states.length - 1;
        refresh();
    }
    function restore(state) {
        restoring = true;
        try {
            clearInlineImageSelection?.(); clearTableCellSelection?.();
            editor.replaceChildren(...state.node.cloneNode(true).childNodes);
            prepareInlineImagesInEditor(); prepareNoteTablesInEditor(); prepareArrowNoteLists();
            if (typeof noteInstantEditor !== 'undefined') noteInstantEditor.prepare();
            editor.focus({preventScroll: true});
            placeCaret(state.sel);
            rememberEditorSelection?.();
            observer.takeRecords();
            editor.dispatchEvent(new Event('input', {bubbles: true}));   // autosave as usual
            observer.takeRecords();
        } finally {restoring = false; dirty = false;}
        refresh();
    }
    function undo() {
        if (!history) return;
        checkpoint();
        if (history.index <= 0) return flash('已經是最早的內容');
        history.index--; restore(history.states[history.index]);
    }
    function redo() {
        if (!history) return;
        checkpoint();
        if (history.index >= history.states.length - 1) return flash('沒有可以重做的步驟');
        history.index++; restore(history.states[history.index]);
    }
    function flash(text) {showPreviewModeToast?.(text);}
    function refresh() {
        const undoButton = document.getElementById('editor-undo'), redoButton = document.getElementById('editor-redo');
        if (undoButton) undoButton.disabled = !history || (history.index <= 0 && !dirty);
        if (redoButton) redoButton.disabled = !history || dirty || history.index >= history.states.length - 1;
    }

    /* ---------- when the editor opens ---------- */
    function begin() {
        clearTimeout(timer); dirty = false;
        noteKey = editingNoteId == null ? null : String(editingNoteId);
        const first = snapshot(), kept = noteKey && byNote.get(noteKey);
        // Same note reopened in this visit, unchanged since: keep its steps.
        if (kept && kept.states[kept.index]?.node.isEqualNode(first.node)) history = kept;
        else {history = {states: [first], index: 0}; if (noteKey) byNote.set(noteKey, history);}
        observer.takeRecords();
        refresh();
    }
    function end() {checkpoint();}

    function onMutation(records) {
        if (restoring || !history) return;
        const relevant = records.some(r => {
            const target = r.target.nodeType === 1 ? r.target : r.target.parentElement;
            if (target?.closest?.(TRANSIENT_NODES)) return false;
            if (r.type === 'attributes') {
                if (r.attributeName === 'srcset' || r.attributeName === 'title' || r.attributeName === 'data-note-editor-preview') return false;
                if (r.attributeName === 'class') {
                    const strip = v => (v || '').split(/\s+/).filter(c => c && !TRANSIENT_CLASSES.includes(c)).sort().join(' ');
                    return strip(r.oldValue) !== strip(r.target.getAttribute('class'));
                }
            }
            if (r.type === 'childList') return [...r.addedNodes, ...r.removedNodes].some(n => !(n.nodeType === 1 && n.matches?.(TRANSIENT_NODES)));
            return true;
        });
        if (!relevant) return;
        dirty = true; refresh();
        clearTimeout(timer);
        timer = setTimeout(() => (window.requestIdleCallback || setTimeout)(checkpoint, {timeout: 400}), IDLE_MS);
    }

    function start() {
        editor = document.getElementById('modal-text');
        const modal = document.getElementById('noteModal');
        if (!editor || !modal) return;
        observer = new MutationObserver(onMutation);
        observer.observe(editor, {subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true});
        new MutationObserver(() => {
            const open = modal.classList.contains('active');
            if (open && !history) setTimeout(begin, 0);
            else if (!open && history) {end(); history = null;}
        }).observe(modal, {attributes: true, attributeFilter: ['class']});
        // Keys: our undo / redo; a step is recorded before shortcuts that change a lot at once.
        document.addEventListener('keydown', event => {
            if (!history || event.isComposing || !modal.classList.contains('active') || noteImageEditor.isOpen()) return;
            const inEditor = editor.contains(event.target) || event.target === editor;
            const mod = event.ctrlKey || event.metaKey, code = event.code;
            if (inEditor && mod && !event.altKey && code === 'KeyZ') {event.preventDefault(); event.stopImmediatePropagation(); event.shiftKey ? redo() : undo(); return;}
            if (inEditor && mod && !event.altKey && code === 'KeyY') {event.preventDefault(); event.stopImmediatePropagation(); redo(); return;}
            if (!inEditor) return;
            const collapsed = getSelection()?.isCollapsed !== false;
            if ((mod || event.altKey) && !/^(Control|Meta|Alt|Shift)/.test(event.key)) checkpoint();
            else if (event.key === 'Enter' || event.key === 'Tab' || (!collapsed && (event.key === 'Backspace' || event.key === 'Delete' || event.key.length === 1))) checkpoint();
        }, true);
        editor.addEventListener('beforeinput', event => {
            if (event.inputType === 'historyUndo') {event.preventDefault(); undo();}
            else if (event.inputType === 'historyRedo') {event.preventDefault(); redo();}
        });
        for (const type of ['paste', 'cut', 'drop']) window.addEventListener(type, event => {if (history && editor.contains(event.target)) checkpoint();}, true);
        modal.addEventListener('pointerdown', event => {if (history && !event.target.closest('#editor-undo, #editor-redo')) checkpoint();}, true);
        for (const [id, fn] of [['editor-undo', undo], ['editor-redo', redo]]) {
            const button = document.getElementById(id);
            button?.addEventListener('mousedown', event => event.preventDefault());   // keep the caret in the note
            button?.addEventListener('click', fn);
        }
        refresh();
    }
    return {start, undo, redo, checkpoint, state: () => history && {steps: history.states.length, index: history.index, dirty}};
})();
noteEditorHistory.start();
