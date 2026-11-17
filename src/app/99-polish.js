/* Source: 99-polish.js */
/* Small comforts:
 *  - Esc closes the top window; clicking / tapping outside a small window closes it too.
 *    The note editor only closes with Esc or 完成 (never by an outside click), and Esc
 *    first closes anything open inside it (keyboard, colour palette, picture selection).
 *  - Ctrl+S saves to the cloud right away (instead of the browser's "save page").
 *  - The editor's shortcut list can be folded away (remembered).
 */
const notePolish = (() => {
    'use strict';
    const NO_OUTSIDE_CLOSE = new Set(['noteModal', 'noteImageEditModal', 'imageViewer']);
    const OWN_KEYS = new Set(['noteImageEditModal', 'imageViewer']);   // these handle Esc themselves
    function openWindows() {
        return [...document.querySelectorAll('.modal-overlay.active, dialog.modal-overlay[open]')]
            .filter(el => !el.hidden && getComputedStyle(el).display !== 'none');
    }
    function topWindow() {
        let best = null, bestZ = -Infinity;
        for (const el of openWindows()) {
            const z = Number(getComputedStyle(el).zIndex) || 0;
            if (z >= bestZ) {best = el; bestZ = z;}
        }
        return best;
    }
    function closeWindow(el) {
        if (el.tagName === 'DIALOG') {el.querySelector('[data-recovery-close]')?.click(); return;}
        if (el.id === 'noteModal') {closeModal(); return;}
        const button = el.querySelector('[data-on-click^="close"]') || el.querySelector('.btn-cancel');
        if (button) button.click(); else el.classList.remove('active');
    }
    function onKey(event) {
        if (event.isComposing) return;
        const editing = document.getElementById('noteModal')?.classList.contains('active');
        if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === 'KeyS') {
            event.preventDefault();
            if (editing && !noteImageEditor.isOpen()) notePersistence.saveCurrent({automatic: true, close: false});
            void notePersistence.flush?.();
            showPreviewModeToast('已存檔，正在同步到雲端');
            return;
        }
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (!document.getElementById('sync-details')?.hidden) return;              // the sync panel closes itself
        if (document.querySelector('#ai-panel:not([hidden])')?.contains(document.activeElement)) return;
        const top = topWindow();
        if (!top || OWN_KEYS.has(top.id) || top.tagName === 'DIALOG') return;    // native dialogs close on Esc already
        if (top.id === 'noteModal' && noteImageEditor.isOpen()) return;
        event.preventDefault();
        closeWindow(top);
    }
    function outsideClose() {
        let pressed = null;
        document.addEventListener('pointerdown', event => {
            const el = event.target;
            pressed = event.button === 0 && el instanceof Element && (el.matches('.modal-overlay.active') || el.matches('dialog.modal-overlay[open]')) ? {el, x: event.clientX, y: event.clientY} : null;
        }, true);
        document.addEventListener('pointerup', event => {
            const start = pressed; pressed = null;
            if (!start || event.target !== start.el || NO_OUTSIDE_CLOSE.has(start.el.id) || start.el.id === 'categoryOverviewModal' || start.el.id === 'moveModal' || start.el.id === 'randomDrawModal') return;
            if (start.el.tagName === 'DIALOG') {   // a click on the dialog box itself also targets it: only close when outside its box
                const r = start.el.getBoundingClientRect();
                if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return;
            }
            if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12) return;   // a drag, not a tap
            if (start.el !== topWindow()) return;
            closeWindow(start.el);
        }, true);
    }
    function hintsToggle() {
        const modal = document.getElementById('noteModal'), button = document.getElementById('note-hints-toggle');
        if (!modal || !button) return;
        const apply = open => {modal.classList.toggle('show-hints', open); button.setAttribute('aria-expanded', String(open)); button.textContent = open ? '⌨ 收起快捷鍵' : '⌨ 快捷鍵';};
        let open = false;
        try {open = localStorage.getItem('nd-editor-hints') === '1';} catch (_) {}
        apply(open);
        button.addEventListener('mousedown', event => event.preventDefault());   // keep the caret in the note
        button.addEventListener('click', () => {open = !open; apply(open); try {localStorage.setItem('nd-editor-hints', open ? '1' : '0');} catch (_) {}});
    }
    function start() {
        document.addEventListener('keydown', onKey);
        outsideClose();
        hintsToggle();
    }
    return {start, topWindow};
})();
notePolish.start();
