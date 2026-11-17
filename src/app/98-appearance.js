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
    /* Reading size and line spacing: only how notes look in the list, never the notes
       themselves. The whole note is scaled, so pictures and text keep their proportions. */
    const READING = {zoom: ['nd-reading-zoom', '1'], line: ['nd-reading-line', 'normal']};
    const readSetting = name => {try {return localStorage.getItem(READING[name][0]) || READING[name][1];} catch (_) {return READING[name][1];}};
    function applyReading() {
        const root = document.documentElement, zoom = readSetting('zoom'), line = readSetting('line');
        if (zoom === '1') delete root.dataset.readingZoom; else {root.dataset.readingZoom = zoom; root.style.setProperty('--reading-zoom', zoom);}
        if (line === 'normal') delete root.dataset.readingLine; else root.dataset.readingLine = line;
    }
    function setupReading() {
        const tools = document.getElementById('drive-tools');
        if (!tools || document.getElementById('site-reading-zoom')) return;
        const row = document.createElement('div');
        row.className = 'site-appearance site-reading';
        row.innerHTML = '<label>閱讀字體 <select id="site-reading-zoom"><option value="0.9">小</option><option value="1">標準</option><option value="1.15">大</option><option value="1.3">特大</option><option value="1.5">超大</option></select></label>' +
            '<label>行距 <select id="site-reading-line"><option value="normal">標準</option><option value="wide">寬</option><option value="wider">更寬</option></select></label>' +
            '<span class="site-reading-hint">只改變閱讀時的大小，不會改到筆記內容</span>';
        (document.querySelector('.site-appearance') || tools.querySelector('.drive-actions'))?.after(row);
        for (const name of ['zoom', 'line']) {
            const select = row.querySelector('#site-reading-' + name);
            select.value = readSetting(name);
            select.onchange = () => {try {localStorage.setItem(READING[name][0], select.value);} catch (_) {} applyReading();};
        }
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
        applyReading();
        setupReading();
        setupDock();
    }
    return {initialize, apply};
})();
