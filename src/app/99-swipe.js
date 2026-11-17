/* Source: 99-swipe.js */
/* Phones: swipe the note list left / right to change page (like A / D on a keyboard).
 * Only a quick, mostly sideways swipe counts, so scrolling, long-press text selection,
 * and sideways scrolling inside wide tables or pictures keep working as before. */
const noteSwipe = (() => {
    'use strict';
    let start = null, toastTimer = 0;
    const blocked = target => target.closest?.('input, textarea, select, [contenteditable="true"], .ai-panel, .ai-pop, .note-category-stack, button, a');
    function scrollsSideways(node, list) {
        for (let el = node instanceof Element ? node : node?.parentElement; el && el !== list; el = el.parentElement) {
            if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
        }
        return false;
    }
    function toast(text) {
        let el = document.querySelector('.note-swipe-toast');
        if (!el) {el = document.createElement('div'); el.className = 'note-swipe-toast'; el.setAttribute('role', 'status'); document.body.append(el);}
        el.textContent = text; el.style.opacity = '1';
        clearTimeout(toastTimer); toastTimer = setTimeout(() => {el.style.opacity = '0';}, 900);
    }
    function start_(event) {
        const list = event.currentTarget;
        start = null;
        if (event.touches.length !== 1 || document.querySelector('.modal-overlay.active') || blocked(event.target) || scrollsSideways(event.target, list)) return;
        const t = event.touches[0];
        start = {x: t.clientX, y: t.clientY, at: performance.now()};
    }
    function end(event) {
        if (!start) return;
        const t = event.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y, dt = performance.now() - start.at;
        start = null;
        const selection = getSelection();
        if (dt > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || (selection && !selection.isCollapsed)) return;
        const before = noteBrowse.state();
        if (!before.size || before.count <= 1) return;
        if (noteBrowse.step(dx < 0 ? 1 : -1)) {const now = noteBrowse.state(); toast('第 ' + (now.page + 1) + '／' + now.count + ' 頁');}
        else toast(dx < 0 ? '已經是最後一頁' : '已經是第一頁');
    }
    function initialize() {
        const list = document.getElementById('note-list');
        if (!list || list.dataset.swipe) return;
        list.dataset.swipe = '1';
        list.addEventListener('touchstart', start_, {passive: true});
        list.addEventListener('touchend', end, {passive: true});
        list.addEventListener('touchcancel', () => {start = null;}, {passive: true});
    }
    return {initialize};
})();
noteSwipe.initialize();
