/* Source: 99-manual.js */
/* 使用說明書: the version in the header, plus features & shortcuts, Q&A and the update
 * history from assets/manual.json (loaded only when opened, so start-up is unaffected).
 * Every release adds its "what's new" lines to that file (tools/release.sh checks). */
const noteManual = (() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const release = String(window.NOTE_SITE_CONFIG?.release || '');
    const number = (/pages-(v\d+)/.exec(release) || [])[1] || '';
    const date = release.slice(0, 10);
    let data = null, tab = 'features';

    async function load() {
        if (data) return data;
        const response = await fetch('assets/manual.json?v=' + encodeURIComponent(release));
        if (!response.ok) throw new Error('說明書讀取失敗（' + response.status + '）。');
        return data = await response.json();
    }
    const hit = (query, ...texts) => !query || texts.some(t => String(t).toLowerCase().includes(query));
    function render() {
        const body = $('manual-body'), query = $('manual-search').value.trim().toLowerCase();
        if (!data) {body.innerHTML = '<p class="manual-empty">正在讀取…</p>'; return;}
        let html = '';
        if (tab === 'features') {
            for (const section of data.sections) {
                const rows = section.rows.filter(([what, how]) => hit(query, section.title, what, how));
                if (!rows.length) continue;
                html += '<h4>' + escapeHtml(section.title) + '</h4><table class="manual-table"><tbody>' +
                    rows.map(([what, how]) => '<tr><th>' + escapeHtml(what) + '</th><td>' + keys(how) + '</td></tr>').join('') + '</tbody></table>';
            }
        } else if (tab === 'faq') {
            html = data.faq.filter(item => hit(query, item.q, item.a))
                .map(item => '<details class="manual-faq"' + (query ? ' open' : '') + '><summary>' + escapeHtml(item.q) + '</summary><p>' + escapeHtml(item.a) + '</p></details>').join('');
        } else {
            html = data.changelog.filter(entry => hit(query, entry.version, entry.date, ...entry.items))
                .map(entry => '<section class="manual-release"><h4>' + escapeHtml(entry.version) + '<small>' + escapeHtml(entry.date) + '</small>' +
                    (entry.version === number ? '<span>目前版本</span>' : '') + '</h4><ul>' + entry.items.map(item => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul></section>').join('');
        }
        body.innerHTML = html || '<p class="manual-empty">找不到「' + escapeHtml(query) + '」。</p>';
    }
    /* Show key names like Alt+F, Ctrl+Z, F3, Esc as small keycaps. */
    function keys(text) {
        return escapeHtml(text).replace(/(?<![\w])((?:(?:Ctrl|Alt|Shift)\+)*(?:Ctrl|Alt|Shift|Esc|Enter|Tab|Delete|Backspace|F3|[A-Z0](?![a-z])|[+−\-\\←→]))(?![\w])/g, '<kbd>$1</kbd>');
    }
    function setTab(next) {
        tab = next;
        document.querySelectorAll('[data-manual-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.manualTab === tab)));
        render();
    }
    async function open(startTab = 'features') {
        $('manualModal').classList.add('active');
        $('manual-version').textContent = number ? number + '（' + date + '）' : '';
        setTab(startTab);
        try {await load(); render();} catch (error) {$('manual-body').innerHTML = '<p class="manual-empty">' + escapeHtml(error.message) + '</p>';}
        setTimeout(() => $('manual-search').focus({preventScroll: true}), 30);
    }
    function close() {$('manualModal').classList.remove('active');}
    function start() {
        const button = $('drive-manual');
        if (button && number) button.textContent = number + '・使用說明書';
        button?.addEventListener('click', () => void open());
        document.querySelectorAll('[data-manual-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.manualTab)));
        $('manual-search')?.addEventListener('input', render);
        $('manualModal')?.addEventListener('keydown', event => {if (event.key === 'Escape') close();});
    }
    return {start, open, close, version: number};
})();
function closeManualModal() {noteManual.close();}
noteManual.start();
