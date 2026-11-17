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
    /* 今日讀書小統計: from the edit history and today's draws (both already synced). */
    function todayStats() {
        const today = localDateKey(), added = new Set(), edited = new Set();
        for (const r of getHistoryForDate(today)) {
            if (r.action === '新增') added.add(String(r.noteId));
            else if (r.action === '編輯') edited.add(String(r.noteId));
        }
        added.forEach(id => edited.delete(id));
        const sessions = drawLog.filter(s => localDateKey(s.at) === today), drawn = new Set(), known = new Set(), unknown = new Set();
        for (const s of sessions) for (const i of s.items) {
            drawn.add(i.noteId);
            if (i.mark === 'known') {known.add(i.noteId); unknown.delete(i.noteId);}
            if (i.mark === 'unknown') {unknown.add(i.noteId); known.delete(i.noteId);}
        }
        return {added: added.size, edited: edited.size, draws: sessions.length, drawn: drawn.size, known: known.size, unknown: unknown.size};
    }
    function renderStats() {
        const box = document.getElementById('draw-log-stats');
        if (!box) return;
        const s = todayStats();
        box.innerHTML = [['新增筆記', s.added, '則'], ['修改筆記', s.edited, '則'], ['抽筆記', s.draws, '次・' + s.drawn + ' 則'], ['熟／不熟', s.known + '／' + s.unknown, '則']]
            .map(([label, value, unit]) => '<div><b>' + escapeHtml(String(value)) + '</b><span>' + label + '（' + unit + '）</span></div>').join('');
        box.setAttribute('aria-label', '今日讀書小統計：新增 ' + s.added + ' 則、修改 ' + s.edited + ' 則、抽 ' + s.draws + ' 次共 ' + s.drawn + ' 則、熟 ' + s.known + ' 則、不熟 ' + s.unknown + ' 則');
    }
    function render() {
        const box = document.getElementById('draw-log-list');
        if (!box) return;
        renderStats();
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
    return {normalize, prune, record, mark, markBarHtml, markOf, open, render, refreshEntry, todayUnknownIds, todayStats, show, setFilter: value => {filter = value === 'unknown' ? 'unknown' : 'all'; render();},
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
