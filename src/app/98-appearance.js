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
