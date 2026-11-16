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
