/* Source: 99-ai-assistant.js */
/* 問 AI (Gemini) and AI 便條紙.
 *  - Select text, right-click → small menu → 問 AI opens the AI window. Nothing pops up
 *    while just selecting text. Shift+right-click, or a second right-click, gives the
 *    browser's own menu. On phones, the 問 AI button in the bottom bar does the same.
 *  - The AI only receives the selected words and the question, never the note itself.
 *  - Answers can be kept as 便條紙 (sticky notes). They never change the note's own
 *    content: they are stored in a separate Drive file (nd-ai-notes-<subject>.json) and
 *    shown as a small star at the top-right of the paragraph they belong to. If that
 *    text is later changed, the star moves to the note's top-right corner.
 *  - Structures come from PubChem (U.S. National Institutes of Health), never from AI
 *    drawing. The AI is only used to turn a Chinese name into the English name.
 *  - The Gemini key is kept in the owner's own Drive (nd-ai-settings.json), never in the
 *    site's public code.
 */
const noteAi = (() => {
    'use strict';
    const API = 'https://generativelanguage.googleapis.com/v1beta';
    const DEFAULT_MODELS = {quick: 'gemini-3.5-flash-lite', detail: 'gemini-3.8-flash'};
    const SETTINGS_FILE = 'nd-ai-settings.json';
    const DEFAULT_LIMIT = 1500;
    const SYSTEM = [
        '你是台灣藥學系學生的讀書助理，使用者正在準備藥師國考。',
        '一律用繁體中文（台灣用語）回答，藥名、受體、酵素等專有名詞附上英文。',
        '回答精簡、條列、重點在前，可用 Markdown 的標題、條列和表格；不要寒暄，不要重複題目。',
        '若資料不確定或有爭議，直接寫「不確定」並說明，不可編造。',
        '不要用文字或符號畫化學結構；結構圖由網站另外從 PubChem 資料庫顯示。'
    ].join('\n');
    const QUICK = [
        ['重點整理', t => '「' + t + '」：請條列說明分類、作用機轉、主要用途、重要副作用與交互作用，以及國考常考點。'],
        ['機轉', t => '「' + t + '」的作用機轉：作用標的、訊息路徑與最後的生理效果。'],
        ['同類比較', t => '「' + t + '」屬於哪一類？列出同類代表藥，並用表格比較差異。'],
        ['副作用', t => '「' + t + '」的重要副作用、禁忌與交互作用。']
    ];
    const $ = id => document.getElementById(id);
    const book = () => noteDriveBoot.book;
    const notesFile = () => 'nd-ai-notes-' + book() + '.json';
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
    const monthKey = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);

    let key = '', limit = DEFAULT_LIMIT, settingsLoaded = false;
    let models = (() => {try {return {...DEFAULT_MODELS, ...JSON.parse(localStorage.getItem('nd-ai-models') || '{}')};} catch (_) {return {...DEFAULT_MODELS};}})();
    let stickies = new Map(), stickiesLoaded = false, stickiesAt = 0;
    let context = null;          // {text, noteId, quote, prefix, suffix}
    let thread = [];             // Gemini conversation (contents) for follow-up questions
    let lastSelection = null, menu = null, panel = null, pop = null, busy = null;

    /* ---------- settings (key + monthly limit) ---------- */
    try {key = localStorage.getItem('nd-ai-key') || ''; limit = Number(localStorage.getItem('nd-ai-limit')) || DEFAULT_LIMIT;} catch (_) {}
    async function loadSettings() {
        if (settingsLoaded) return;
        try {
            const value = await noteDriveServer.rootJsonRead(SETTINGS_FILE);
            if (value?.key) {key = value.key; localStorage.setItem('nd-ai-key', key);}
            if (value?.monthlyLimit) {limit = Number(value.monthlyLimit) || DEFAULT_LIMIT; localStorage.setItem('nd-ai-limit', String(limit));}
            settingsLoaded = true;
        } catch (_) {}
    }
    async function saveSettings(nextKey, nextLimit) {
        await noteDriveServer.rootJsonUpdate(SETTINGS_FILE, current => ({...(current || {}), key: nextKey, monthlyLimit: nextLimit, updatedAt: new Date().toISOString()}));
        key = nextKey; limit = nextLimit; settingsLoaded = true;
        localStorage.setItem('nd-ai-key', key); localStorage.setItem('nd-ai-limit', String(limit));
    }
    function usage() {
        try {const u = JSON.parse(localStorage.getItem('nd-ai-usage') || '{}'); return u.month === monthKey() ? u.count || 0 : 0;} catch (_) {return 0;}
    }
    function countUse() {localStorage.setItem('nd-ai-usage', JSON.stringify({month: monthKey(), count: usage() + 1})); footer();}

    /* ---------- Gemini ---------- */
    function aiError(status, message) {
        if (status === 400 && /api key/i.test(message)) return new Error('Gemini 金鑰不正確，請到「AI 設定」重新貼上。');
        if (status === 403) return new Error('這個 Gemini 金鑰沒有權限（可能已停用），請到「AI 設定」更換。');
        if (status === 429) return new Error('Gemini 暫時達到次數上限，請過一分鐘再試；若常發生，可改用付費版金鑰。');
        if (status >= 500) return new Error('Gemini 暫時忙碌，請稍後再試。');
        return new Error('Gemini 回覆 ' + status + '：' + String(message || '').slice(0, 160));
    }
    async function pickModel(kind) {
        // The model name stored here is no longer offered: choose the newest stable one of the same kind.
        const response = await fetch(API + '/models?pageSize=200', {headers: {'x-goog-api-key': key}});
        if (!response.ok) throw aiError(response.status, '');
        const names = ((await response.json()).models || [])
            .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''))
            .filter(n => /^gemini-[\d.]+-flash(-lite)?$/.test(n) && (kind === 'quick') === /-lite$/.test(n));
        names.sort((a, b) => parseFloat(b.slice(7)) - parseFloat(a.slice(7)));
        if (!names[0]) throw new Error('找不到可用的 Gemini 模型。');
        models[kind] = names[0];
        localStorage.setItem('nd-ai-models', JSON.stringify(models));
        return names[0];
    }
    async function post(kind, path, body, signal, retried = false) {
        if (!key) throw new Error('還沒有設定 Gemini 金鑰。');
        if (usage() >= limit) throw new Error('本月已用 ' + usage() + ' 次，達到你設定的上限 ' + limit + ' 次。可以在「AI 設定」調高。');
        let response;
        try {
            response = await fetch(API + '/models/' + models[kind] + path, {method: 'POST', signal,
                headers: {'Content-Type': 'application/json', 'x-goog-api-key': key}, body: JSON.stringify(body)});
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            throw new Error(navigator.onLine === false ? '目前沒有網路，連上網路後再問。' : '連不到 Gemini，請檢查網路。');
        }
        if (response.status === 404 && !retried) {await pickModel(kind); return post(kind, path, body, signal, true);}
        if (!response.ok) {
            let message = '';
            try {message = (await response.json()).error?.message || '';} catch (_) {}
            throw aiError(response.status, message);
        }
        countUse();
        return response;
    }
    const partsText = candidate => (candidate?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
    async function streamAnswer(kind, contents, onText, signal) {
        const response = await post(kind, ':streamGenerateContent?alt=sse', {
            systemInstruction: {parts: [{text: SYSTEM}]}, contents,
            generationConfig: {temperature: 0.3, maxOutputTokens: kind === 'detail' ? 8192 : 4096}
        }, signal);
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '', text = '', blocked = '';
        for (;;) {
            const {value, done} = await reader.read();
            if (done) break;
            buffer += value;
            let cut;
            while ((cut = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, cut).trim(); buffer = buffer.slice(cut + 1);
                if (!line.startsWith('data:')) continue;
                try {
                    const data = JSON.parse(line.slice(5));
                    if (data.promptFeedback?.blockReason) blocked = data.promptFeedback.blockReason;
                    const piece = partsText(data.candidates?.[0]);
                    if (piece) {text += piece; onText(text);}
                } catch (_) {}
            }
        }
        if (!text) throw new Error(blocked ? 'Gemini 拒絕回答這個問題（' + blocked + '）。' : 'Gemini 沒有回覆內容，請再試一次。');
        return text;
    }
    async function englishName(term) {
        const response = await post('quick', ':generateContent', {
            contents: [{role: 'user', parts: [{text: '把「' + term + '」轉成 PubChem 可以查詢的英文化合物名稱（藥物用 INN 學名，鹽類可省略）。如果它不是單一化合物（例如藥物類別、受體、結構片段名稱或多種成分的混合物），single 設為 false。'}]}],
            generationConfig: {temperature: 0, responseMimeType: 'application/json',
                responseSchema: {type: 'OBJECT', properties: {name: {type: 'STRING'}, single: {type: 'BOOLEAN'}}, required: ['name', 'single']}}
        });
        const data = await response.json();
        try {return JSON.parse(partsText(data.candidates?.[0]));} catch (_) {return {name: '', single: false};}
    }

    /* ---------- PubChem structures ---------- */
    async function pubchem(name) {
        const url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + encodeURIComponent(name) + '/property/Title,MolecularFormula/JSON';
        let response;
        try {response = await fetch(url);} catch (_) {throw new Error('連不到 PubChem 資料庫，請檢查網路。');}
        if (response.status === 404 || response.status === 400) return null;
        if (!response.ok) throw new Error('PubChem 資料庫暫時無法使用（' + response.status + '）。');
        const p = (await response.json()).PropertyTable?.Properties?.[0];
        return p ? {cid: p.CID, title: p.Title || name, formula: p.MolecularFormula || '', image: 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/' + p.CID + '/PNG?image_size=500x500'} : null;
    }
    async function structure(term) {
        const plain = norm(term);
        let found = /^[\x20-\x7e]{2,80}$/.test(plain) ? await pubchem(plain) : null;
        if (found) return found;
        const english = await englishName(plain);
        if (!english.single || !english.name) return {notSingle: true, name: english.name};
        found = await pubchem(english.name);
        return found || {missing: true, name: english.name};
    }
    async function imageData(url) {
        try {
            const blob = await (await fetch(url)).blob();
            return await new Promise(resolve => {const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(url); reader.readAsDataURL(blob);});
        } catch (_) {return url;}
    }

    /* ---------- small, safe Markdown → HTML ---------- */
    function inline(text) {
        return escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>');
    }
    function markdown(source) {
        const lines = String(source || '').replace(/\r/g, '').split('\n'), out = [];
        let list = null;
        const closeList = () => {if (list) {out.push('</' + list + '>'); list = null;}};
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
                closeList();
                const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
                out.push('<table><thead><tr>' + cells(line).map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>');
                i += 2;
                for (; i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]); i++) out.push('<tr>' + cells(lines[i]).map(c => '<td>' + c + '</td>').join('') + '</tr>');
                i--; out.push('</tbody></table>'); continue;
            }
            let m;
            if ((m = /^\s*#{1,6}\s+(.*)$/.exec(line))) {closeList(); out.push('<h4>' + inline(m[1]) + '</h4>'); continue;}
            if ((m = /^(\s*)[-*•]\s+(.*)$/.exec(line)) || (m = /^(\s*)\d+[.)]\s+(.*)$/.exec(line))) {
                const type = /^\s*\d/.test(line) ? 'ol' : 'ul';
                if (list !== type) {closeList(); out.push('<' + type + '>'); list = type;}
                out.push('<li' + (m[1].length >= 2 ? ' class="ai-sub"' : '') + '>' + inline(m[2]) + '</li>'); continue;
            }
            closeList();
            if (line.trim()) out.push('<p>' + inline(line) + '</p>');
        }
        closeList();
        return out.join('');
    }

    /* ---------- remembered answers (this device only, IndexedDB) ---------- */
    const memory = (() => {
        let job = null;
        const open = () => job ||= new Promise(resolve => {
            try {
                const request = indexedDB.open('nd-ai', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('answers');
                request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null);
            } catch (_) {resolve(null);}
        });
        const run = async (mode, fn) => {
            const db = await open(); if (!db) return null;
            return new Promise(resolve => {
                try {const tx = db.transaction('answers', mode), r = fn(tx.objectStore('answers')); tx.oncomplete = () => resolve(r?.result ?? null); tx.onerror = () => resolve(null);}
                catch (_) {resolve(null);}
            });
        };
        const id = (kind, question) => kind + '|' + norm(question);
        return {
            get: (kind, question) => run('readonly', s => s.get(id(kind, question))),
            put: (kind, question, value) => run('readwrite', s => s.put({...value, question, kind, at: Date.now()}, id(kind, question))),
            remove: (kind, question) => run('readwrite', s => s.delete(id(kind, question))),
            recent: async () => ((await run('readonly', s => s.getAll())) || []).sort((a, b) => b.at - a.at).slice(0, 60)
        };
    })();

    /* ---------- sticky notes (Drive file, separate from the notes) ---------- */
    function mergeStickies(current, changes) {
        const map = new Map((current?.items || []).map(item => [item.id, item]));
        for (const item of changes) {const old = map.get(item.id); if (!old || (Date.parse(item.updatedAt) || 0) >= (Date.parse(old.updatedAt) || 0)) map.set(item.id, item);}
        const cutoff = Date.now() - 90 * 86400000;   // forget deletions after 90 days
        return {schema: 1, book: book(), items: [...map.values()].filter(item => !item.deleted || Date.parse(item.updatedAt) > cutoff)};
    }
    async function loadStickies() {
        try {
            const value = await noteDriveServer.rootJsonRead(notesFile());
            stickies = new Map((value?.items || []).filter(item => !item.deleted).map(item => [item.id, item]));
            stickiesLoaded = true; stickiesAt = Date.now();
            decorate(document.getElementById('note-list'));
        } catch (_) {}
    }
    async function writeStickies(changes) {
        const result = await noteDriveServer.rootJsonUpdate(notesFile(), current => mergeStickies(current, changes));
        stickies = new Map(result.items.filter(item => !item.deleted).map(item => [item.id, item]));
        stickiesLoaded = true; stickiesAt = Date.now();
        decorate(document.getElementById('note-list'));
    }
    async function addSticky(entry) {
        if (!context?.noteId) throw new Error('請在筆記裡選字再問，才能貼成這則筆記的便條紙。');
        const now = new Date().toISOString();
        const item = {id: crypto.randomUUID(), noteId: String(context.noteId), quote: context.quote, prefix: context.prefix, suffix: context.suffix,
            question: entry.question || '', answer: entry.answer || '', model: entry.model || '', createdAt: now, updatedAt: now};
        if (entry.structure) item.structure = {...entry.structure, image: await imageData(entry.structure.image)};
        await writeStickies([item]);
        return item;
    }
    async function removeSticky(id) {
        const item = stickies.get(id); if (!item) return;
        await writeStickies([{...item, deleted: true, answer: '', structure: undefined, updatedAt: new Date().toISOString()}]);
    }

    /* Where a sticky belongs: the paragraph that contains its words (matched with a little
       text before and after); null when the words are no longer in the note. */
    function locate(root, item) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let text = '', map = [], space = true;
        for (let node; (node = walker.nextNode());) {
            for (const ch of node.data) {
                if (/\s/.test(ch)) {if (!space) {text += ' '; map.push(node); space = true;}}
                else {text += ch; map.push(node); space = false;}
            }
        }
        const quote = norm(item.quote);
        if (!quote) return null;
        let best = -1, bestScore = -1;
        for (let at = text.indexOf(quote); at >= 0; at = text.indexOf(quote, at + 1)) {
            let score = 0;
            const before = text.slice(Math.max(0, at - 40), at), after = text.slice(at + quote.length, at + quote.length + 40);
            for (let n = Math.min(norm(item.prefix).length, before.length); n > 0; n--) if (before.endsWith(norm(item.prefix).slice(-n))) {score += n; break;}
            for (let n = Math.min(norm(item.suffix).length, after.length); n > 0; n--) if (after.startsWith(norm(item.suffix).slice(0, n))) {score += n; break;}
            if (score > bestScore) {bestScore = score; best = at;}
        }
        if (best < 0) return null;
        const block = map[best].parentElement?.closest('p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,pre,div');
        return block && root.contains(block) && block !== root ? block : root;
    }
    function decorate(list) {
        if (!list || !stickiesLoaded) return;
        list.querySelectorAll('.ai-sticky-star').forEach(star => star.remove());
        list.querySelectorAll('.ai-sticky-anchor').forEach(el => el.classList.remove('ai-sticky-anchor'));
        if (!stickies.size) return;
        const byNote = new Map();
        for (const item of stickies.values()) {if (!byNote.has(item.noteId)) byNote.set(item.noteId, []); byNote.get(item.noteId).push(item);}
        for (const card of list.querySelectorAll('.note-item[data-id]')) {
            const items = byNote.get(String(card.dataset.id));
            if (!items) continue;
            const root = card.querySelector('.note-text'), groups = new Map();
            for (const item of items) {
                const place = root && root.style.display !== 'none' ? locate(root, item) : null;
                const target = place || card.querySelector('.note-content-area');
                if (!target) continue;
                if (!groups.has(target)) groups.set(target, {ids: [], loose: !place});
                groups.get(target).ids.push(item.id);
            }
            for (const [target, group] of groups) {
                target.classList.add('ai-sticky-anchor');
                const star = document.createElement('button');
                star.type = 'button';
                star.className = 'ai-sticky-star' + (group.loose ? ' ai-sticky-loose' : '');
                star.dataset.stickies = group.ids.join(',');
                star.title = group.loose ? 'AI 便條紙（原本的文字已修改，移到這裡）' : 'AI 便條紙';
                star.setAttribute('aria-label', 'AI 便條紙 ' + group.ids.length + ' 張');
                star.contentEditable = 'false';
                if (group.ids.length > 1) star.dataset.count = String(group.ids.length);
                const pos = group.ids.map(id => stickies.get(id)?.pos).find(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
                if (pos) {star.style.translate = pos.x + 'px ' + pos.y + 'px'; star.dataset.moved = '1';}
                target.append(star);
            }
        }
    }

    /* ---------- selection, right-click menu ---------- */
    function contextOf(range) {
        const text = norm(range.toString()).slice(0, 300);
        if (!text) return null;
        const node = range.startContainer, el = node.nodeType === 1 ? node : node.parentElement;
        const card = el?.closest('.note-item[data-id]'), editor = el?.closest('#modal-text');
        const root = card ? card.querySelector('.note-text') : editor;
        const noteId = card ? card.dataset.id : editor ? editingNoteId : null;
        let prefix = '', suffix = '';
        if (root && root.contains(range.startContainer)) {
            try {
                const before = document.createRange(); before.selectNodeContents(root); before.setEnd(range.startContainer, range.startOffset);
                const after = document.createRange(); after.selectNodeContents(root); after.setStart(range.endContainer, range.endOffset);
                prefix = norm(before.toString()).slice(-40); suffix = norm(after.toString()).slice(0, 40);
            } catch (_) {}
        }
        return {text, noteId: noteId == null ? null : String(noteId), quote: text, prefix, suffix};
    }
    function closeMenu() {menu?.remove(); menu = null;}
    function showMenu(x, y, ctx) {
        closeMenu();
        menu = document.createElement('div');
        menu.className = 'ai-menu'; menu.setAttribute('role', 'menu');
        const items = [['ask', '✦ 問 AI'], ['structure', '⌬ 查結構圖'], ['copy', '複製']];
        if (document.getElementById('noteModal')?.classList.contains('active') && document.getElementById('note-keyboard-toggle')) items.push(['keyboard', '⌨ 鍵盤']);
        menu.innerHTML = items.map(([a, label]) => '<button type="button" role="menuitem" data-ai-menu="' + a + '">' + label + '</button>').join('') +
            '<small>再按一次右鍵：瀏覽器選單</small>';
        document.body.append(menu);
        const r = menu.getBoundingClientRect();
        menu.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
        menu.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
        menu.addEventListener('mousedown', event => event.preventDefault());   // keep the selection
        menu.addEventListener('click', event => {
            const action = event.target.closest('[data-ai-menu]')?.dataset.aiMenu;
            if (!action) return;
            closeMenu();
            if (action === 'ask') open(ctx);
            else if (action === 'structure') {open(ctx); void showStructure();}
            else if (action === 'copy') navigator.clipboard?.writeText(ctx.text).catch(() => document.execCommand('copy'));
            else if (action === 'keyboard') document.getElementById('note-keyboard-toggle')?.click();
        });
    }
    function onContextMenu(event) {
        if (menu) {closeMenu(); return;}                       // second right-click: browser menu
        if (event.shiftKey || event.target.closest?.('#ai-panel, input, textarea, select')) return;
        const selection = getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!range.intersectsNode(event.target) && !event.target.contains?.(range.commonAncestorContainer)) return;
        const ctx = contextOf(range);
        if (!ctx) return;
        event.preventDefault(); event.stopPropagation();
        showMenu(event.clientX, event.clientY, ctx);
    }

    /* ---------- the AI window ---------- */
    function build() {
        if (panel) return panel;
        panel = document.createElement('section');
        panel.id = 'ai-panel'; panel.className = 'ai-panel'; panel.hidden = true;
        panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '問 AI');
        panel.innerHTML = `
            <header class="ai-head"><b>✦ 問 AI</b><span class="ai-sub-title">Gemini</span>
                <button type="button" data-ai="history" title="之前問過的問題">紀錄</button>
                <button type="button" data-ai="settings" title="金鑰與每月上限">設定</button>
                <button type="button" data-ai="close" aria-label="關閉">✕</button></header>
            <div class="ai-topic"><span>主題</span><b id="ai-topic"></b></div>
            <div class="ai-quick">${QUICK.map(([label], i) => `<button type="button" data-ai-quick="${i}">${label}</button>`).join('')}<button type="button" data-ai="structure">結構圖</button></div>
            <div id="ai-thread" class="ai-thread" aria-live="polite"></div>
            <form id="ai-form" class="ai-form"><textarea id="ai-input" rows="2" placeholder="輸入問題，Enter 送出（Shift+Enter 換行）"></textarea><button type="submit">送出</button></form>
            <div id="ai-foot" class="ai-foot"></div>`;
        document.body.append(panel);
        panel.addEventListener('click', event => {
            const quick = event.target.closest('[data-ai-quick]');
            if (quick) {void ask(QUICK[Number(quick.dataset.aiQuick)][1](context?.text || ''), 'quick'); return;}
            const action = event.target.closest('[data-ai]')?.dataset.ai;
            if (action === 'close') close();
            else if (action === 'history') void showHistory();
            else if (action === 'settings') showSettings();
            else if (action === 'structure') void showStructure();
            const answer = event.target.closest('[data-ai-answer]');
            if (answer) void answerAction(answer.dataset.aiAnswer, event.target.closest('.ai-msg'));
            const old = event.target.closest('[data-ai-old]');
            if (old) void reopen(old.dataset.aiOld);
        });
        $('ai-form').addEventListener('submit', event => {event.preventDefault(); const q = $('ai-input').value.trim(); if (q) {$('ai-input').value = ''; void ask(q, 'quick', {followUp: thread.length > 0});}});
        $('ai-input').addEventListener('keydown', event => {if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {event.preventDefault(); $('ai-form').requestSubmit();}});
        panel.addEventListener('keydown', event => {if (event.key === 'Escape' && !event.isComposing) {event.preventDefault(); close();}});
        // Drag by the title bar (desktop).
        const head = panel.querySelector('.ai-head');
        head.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button') || matchMedia('(max-width: 700px)').matches) return;
            const r = panel.getBoundingClientRect(), dx = event.clientX - r.left, dy = event.clientY - r.top;
            const move = e => {panel.style.left = Math.max(0, Math.min(innerWidth - 120, e.clientX - dx)) + 'px'; panel.style.top = Math.max(0, Math.min(innerHeight - 60, e.clientY - dy)) + 'px'; panel.style.right = 'auto';};
            const up = () => {removeEventListener('pointermove', move); removeEventListener('pointerup', up);};
            addEventListener('pointermove', move); addEventListener('pointerup', up);
        });
        return panel;
    }
    function footer() {
        const el = $('ai-foot');
        if (el) el.textContent = 'AI 註解僅供參考，請以課本為準・本月已問 ' + usage() + '／' + limit + ' 次';
    }
    function message(role, html, extra = '') {
        const el = document.createElement('div');
        el.className = 'ai-msg ai-' + role;
        el.innerHTML = '<div class="ai-body">' + html + '</div>' + extra;
        const list = $('ai-thread');
        list.append(el);
        // A new question goes to the top of the window, so the answer can be read from its start.
        if (role === 'user') list.scrollTop = el.offsetTop - 6;
        else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = Math.min(el.offsetTop - 6, list.scrollHeight);
        return el;
    }
    const answerButtons = '<div class="ai-actions"><button type="button" data-ai-answer="stick">貼成便條紙</button><button type="button" data-ai-answer="detail">更詳細</button><button type="button" data-ai-answer="copy">複製</button></div>';
    function open(ctx) {
        build();
        if (ctx) {context = ctx; thread = []; $('ai-thread').innerHTML = '';}
        $('ai-topic').textContent = context?.text || '（沒有選取文字）';
        panel.hidden = false;
        footer();
        void loadSettings().then(() => {footer(); if (!key) showSettings();});
        if (context?.text && !$('ai-input').value) $('ai-input').placeholder = '例如：' + context.text.slice(0, 20) + ' 的機轉？（Enter 送出）';
        setTimeout(() => $('ai-input').focus({preventScroll: true}), 30);
    }
    function close() {busy?.abort(); if (panel) panel.hidden = true;}

    async function ask(question, kind, {followUp = false, fresh = false} = {}) {
        build();
        if (!key) {await loadSettings(); if (!key) {showSettings(); return;}}
        busy?.abort();
        const controller = busy = new AbortController();
        message('user', escapeHtml(question));
        const box = message('bot', '<p class="ai-wait">思考中…</p>');
        box.dataset.question = question; box.dataset.kind = kind;
        const cached = !followUp && !fresh ? await memory.get(kind, question) : null;
        if (cached?.answer) {
            box.querySelector('.ai-body').innerHTML = markdown(cached.answer);
            box.insertAdjacentHTML('beforeend', '<div class="ai-note">之前問過，直接顯示當時的回答。<button type="button" data-ai-answer="again">重新問一次</button></div>' + answerButtons);
            box.dataset.answer = cached.answer; box.dataset.model = cached.model || '';
            thread.push({role: 'user', parts: [{text: question}]}, {role: 'model', parts: [{text: cached.answer}]});
            return;
        }
        const contents = [...(followUp ? thread : []), {role: 'user', parts: [{text: question}]}];
        try {
            let shown = 0;
            const answer = await streamAnswer(kind, contents, text => {
                if (text.length - shown < 40 && shown) return;      // redraw in steps, not on every token
                shown = text.length; box.querySelector('.ai-body').innerHTML = markdown(text);
            }, controller.signal);
            box.querySelector('.ai-body').innerHTML = markdown(answer);
            box.insertAdjacentHTML('beforeend', answerButtons);
            box.dataset.answer = answer; box.dataset.model = models[kind];
            thread = [...contents, {role: 'model', parts: [{text: answer}]}].slice(-12);
            if (!followUp) void memory.put(kind, question, {answer, model: models[kind], topic: context?.text || ''});
        } catch (error) {
            if (error.name === 'AbortError') {box.querySelector('.ai-body').innerHTML = '<p class="ai-error">已停止。</p>'; return;}
            box.querySelector('.ai-body').innerHTML = '<p class="ai-error">' + escapeHtml(error.message) + '</p>';
        } finally {if (busy === controller) busy = null;}
    }
    async function answerAction(action, box) {
        if (!box) return;
        const button = box.querySelector('[data-ai-answer="' + action + '"]');
        if (action === 'copy') {await navigator.clipboard?.writeText(box.dataset.answer || box.innerText).catch(() => {}); flash(button, '已複製'); return;}
        if (action === 'again') {box.querySelector('.ai-note')?.remove(); await memory.remove(box.dataset.kind, box.dataset.question); return ask(box.dataset.question, box.dataset.kind, {fresh: true});}
        if (action === 'detail') return ask('請更詳細說明：' + box.dataset.question, 'detail', {followUp: true});
        if (action === 'stick') {
            if (!button || button.disabled) return;
            button.disabled = true; button.textContent = '正在貼上…';
            try {
                await addSticky({question: box.dataset.question || '', answer: box.dataset.answer || '', model: box.dataset.model || '',
                    structure: box.dataset.structure ? JSON.parse(box.dataset.structure) : null});
                button.textContent = '✓ 已貼到筆記';
            } catch (error) {button.disabled = false; button.textContent = '貼成便條紙'; message('bot', '<p class="ai-error">' + escapeHtml(error.message) + '</p>');}
        }
    }
    function flash(button, text) {if (!button) return; const old = button.textContent; button.textContent = text; setTimeout(() => {button.textContent = old;}, 1200);}

    async function showStructure() {
        build();
        const term = context?.text || '';
        if (!term) return;
        message('user', '結構圖：' + escapeHtml(term));
        const box = message('bot', '<p class="ai-wait">正在 PubChem 資料庫查詢…</p>');
        box.dataset.question = '結構圖：' + term;
        try {
            if (!key && !/^[\x20-\x7e]{2,80}$/.test(norm(term))) {await loadSettings();}
            const found = await structure(term);
            if (found.notSingle) {box.querySelector('.ai-body').innerHTML = '<p>「' + escapeHtml(term) + '」' + (found.name ? '（' + escapeHtml(found.name) + '）' : '') + '不是單一化合物（例如藥物類別或結構名稱），所以沒有單一結構圖。可以選取其中一個具體藥名再查。</p>'; return;}
            if (found.missing) {box.querySelector('.ai-body').innerHTML = '<p>PubChem 查不到「' + escapeHtml(found.name || term) + '」。可以改選英文學名再試一次。</p>'; return;}
            box.querySelector('.ai-body').innerHTML = structureHtml(found);
            box.insertAdjacentHTML('beforeend', '<div class="ai-actions"><button type="button" data-ai-answer="stick">貼成便條紙</button></div>');
            box.dataset.structure = JSON.stringify(found); box.dataset.answer = ''; box.dataset.model = 'PubChem';
        } catch (error) {box.querySelector('.ai-body').innerHTML = '<p class="ai-error">' + escapeHtml(error.message) + '</p>';}
    }
    function structureHtml(s) {
        return '<figure class="ai-structure"><img src="' + escapeAttribute(s.image) + '" alt="' + escapeAttribute(s.title) + ' 的結構" loading="lazy">' +
            '<figcaption><b>' + escapeHtml(s.title) + '</b>' + (s.formula ? '　' + escapeHtml(s.formula) : '') +
            '<br><a href="https://pubchem.ncbi.nlm.nih.gov/compound/' + encodeURIComponent(s.cid) + '" target="_blank" rel="noopener">來源：PubChem（CID ' + escapeHtml(String(s.cid)) + '）</a></figcaption></figure>';
    }

    async function showHistory() {
        build();
        const items = await memory.recent();
        const box = message('bot', items.length ? '<p><b>之前問過的問題</b>（點一下再看一次）</p><ul class="ai-history">' + items.map(item =>
            '<li><button type="button" data-ai-old="' + escapeAttribute(item.kind + '|' + item.question) + '">' + escapeHtml(item.question.slice(0, 80)) + '</button></li>').join('') + '</ul>' : '<p>還沒有問過問題。</p>');
        box.classList.add('ai-history-box');
    }
    async function reopen(id) {
        const cut = id.indexOf('|');
        await ask(id.slice(cut + 1), id.slice(0, cut));
    }
    function showSettings() {
        build();
        $('ai-thread').querySelector('.ai-settings')?.remove();
        const box = message('bot', `
            <div class="ai-settings"><p><b>AI 設定</b></p>
            ${key ? '<p>已設定 Gemini 金鑰（只存在你自己的 Google 雲端硬碟，不會放在網站程式裡）。要更換再貼新的。</p>' : '<p>第一次使用要貼上 Gemini 金鑰：到 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio 金鑰頁</a> 按「Create API key」，複製後貼在下面。金鑰只會存在你自己的 Google 雲端硬碟。</p>'}
            <label>Gemini 金鑰<input id="ai-key" type="password" autocomplete="off" placeholder="${key ? '••••••••（已設定）' : '貼上金鑰'}"></label>
            <label>每月最多問幾次<input id="ai-limit" type="number" min="10" max="100000" value="${limit}"></label>
            <div class="ai-actions"><button type="button" id="ai-save">儲存</button></div><p id="ai-settings-msg" role="status"></p></div>`);
        box.querySelector('#ai-save').addEventListener('click', async () => {
            const msg = box.querySelector('#ai-settings-msg'), nextKey = box.querySelector('#ai-key').value.trim() || key;
            const nextLimit = Math.max(10, Number(box.querySelector('#ai-limit').value) || DEFAULT_LIMIT);
            if (!nextKey) {msg.textContent = '請先貼上金鑰。'; return;}
            msg.textContent = '正在確認金鑰…';
            try {
                const response = await fetch(API + '/models?pageSize=1', {headers: {'x-goog-api-key': nextKey}});
                if (!response.ok) {let m = ''; try {m = (await response.json()).error?.message || '';} catch (_) {} throw aiError(response.status, m);}
                await saveSettings(nextKey, nextLimit);
                msg.textContent = '✓ 已儲存。其他裝置登入後也會自動使用這把金鑰。';
                footer();
                setTimeout(() => box.remove(), 1500);
            } catch (error) {msg.textContent = error.message;}
        });
    }

    /* ---------- moving a star (press and drag) ----------
       A click still opens the sticky note; only a press that moves more than a few pixels
       is a drag. The new place is saved with the sticky note (synced like the rest). */
    function dragStar(event) {
        const star = event.target.closest?.('.ai-sticky-star');
        if (!star || event.button !== 0) return;
        event.preventDefault();                                      // no text selection while dragging
        const card = star.closest('.note-item') || document.body;
        const scale = (star.getBoundingClientRect().width / star.offsetWidth) || 1;   // reading size zooms the note
        const [bx, by] = (star.style.translate || '0px 0px').split(/\s+/).map(v => parseFloat(v) || 0);
        const start = {x: event.clientX, y: event.clientY, rect: star.getBoundingClientRect(), box: card.getBoundingClientRect()};
        let moved = false, nx = bx, ny = by;
        star.setPointerCapture?.(event.pointerId);
        const move = e => {
            let dx = e.clientX - start.x, dy = e.clientY - start.y;
            if (!moved && Math.hypot(dx, dy) < 5) return;
            moved = true; star.classList.add('dragging'); closePop();
            dx = Math.max(start.box.left + 2 - start.rect.left, Math.min(start.box.right - 2 - start.rect.right, dx));   // stay on the note
            dy = Math.max(start.box.top + 2 - start.rect.top, Math.min(start.box.bottom - 2 - start.rect.bottom, dy));
            nx = Math.round(bx + dx / scale); ny = Math.round(by + dy / scale);
            star.style.translate = nx + 'px ' + ny + 'px';
        };
        const up = () => {
            star.removeEventListener('pointermove', move); star.removeEventListener('pointerup', up); star.removeEventListener('pointercancel', up);
            star.classList.remove('dragging');
            if (!moved) return;
            star.dataset.dragged = '1'; star.dataset.moved = '1';
            setTimeout(() => {delete star.dataset.dragged;}, 400);
            void savePos(star, {x: nx, y: ny});
        };
        star.addEventListener('pointermove', move); star.addEventListener('pointerup', up); star.addEventListener('pointercancel', up);
    }
    async function savePos(star, pos) {
        const now = new Date().toISOString();
        const changes = star.dataset.stickies.split(',').map(id => stickies.get(id)).filter(Boolean).map(item => ({...item, pos, updatedAt: now}));
        changes.forEach(item => stickies.set(item.id, item));
        try {await writeStickies(changes);} catch (_) {}   // offline / read-only: the star stays here for now
    }
    function dragPop(event) {
        if (event.button !== 0 || event.target.closest('button')) return;
        event.preventDefault();
        const r = pop.getBoundingClientRect(), dx = event.clientX - r.left, dy = event.clientY - r.top;
        const move = e => {
            pop.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - dx)) + 'px';
            pop.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - dy)) + 'px';
        };
        const up = () => {removeEventListener('pointermove', move); removeEventListener('pointerup', up);};
        addEventListener('pointermove', move); addEventListener('pointerup', up);
    }

    /* ---------- sticky-note popover ---------- */
    function closePop() {pop?.remove(); pop = null;}
    function openPop(star) {
        closePop();
        const items = star.dataset.stickies.split(',').map(id => stickies.get(id)).filter(Boolean);
        if (!items.length) return;
        pop = document.createElement('div');
        pop.className = 'ai-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'AI 便條紙');
        pop.innerHTML = '<header title="按住這裡可以拖曳移動"><b>✦ AI 便條紙</b><span>' + (star.dataset.moved ? '<button type="button" data-pop="home" title="把星星移回段落右上角">星星歸位</button>' : '') +
            '<button type="button" data-pop="close" aria-label="關閉">✕</button></span></header>' +
            (star.classList.contains('ai-sticky-loose') ? '<p class="ai-note">原本貼的文字已修改或刪除，所以移到筆記右上角。</p>' : '') +
            items.map(item => '<article data-sticky="' + escapeAttribute(item.id) + '"><p class="ai-quote">「' + escapeHtml(item.quote) + '」</p>' +
                (item.question ? '<p class="ai-q">' + escapeHtml(item.question) + '</p>' : '') +
                (item.structure ? structureHtml(item.structure) : '') + (item.answer ? '<div class="ai-body">' + markdown(item.answer) + '</div>' : '') +
                '<footer><span>' + escapeHtml(new Date(item.createdAt).toLocaleDateString('zh-TW')) + (item.model ? '・' + escapeHtml(item.model) : '') + '</span>' +
                '<button type="button" data-pop="delete">刪除這張</button></footer></article>').join('');
        document.body.append(pop);
        const r = star.getBoundingClientRect(), w = Math.min(460, innerWidth - 16);
        pop.style.width = w + 'px';
        pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
        const below = r.bottom + 6, room = innerHeight - below - 8;
        pop.style.top = (room > 260 ? below : Math.max(8, r.top - 6 - Math.min(pop.offsetHeight, innerHeight * .7))) + 'px';
        pop.querySelector('header').addEventListener('pointerdown', dragPop);
        pop.addEventListener('click', async event => {
            const action = event.target.closest('[data-pop]')?.dataset.pop;
            if (action === 'close') closePop();
            if (action === 'home') {star.style.translate = ''; delete star.dataset.moved; closePop(); void savePos(star, null);}
            if (action === 'delete') {
                const card = event.target.closest('[data-sticky]');
                if (!confirm('要刪除這張 AI 便條紙嗎？（你的筆記內容不會受影響）')) return;
                event.target.disabled = true; event.target.textContent = '正在刪除…';
                try {await removeSticky(card.dataset.sticky); card.remove(); if (!pop.querySelector('[data-sticky]')) closePop();}
                catch (error) {event.target.disabled = false; event.target.textContent = '刪除這張'; alert('刪除失敗：' + error.message);}
            }
        });
    }

    /* ---------- start ---------- */
    function start() {
        document.addEventListener('contextmenu', onContextMenu, true);
        document.addEventListener('pointerdown', event => {
            if (menu && !menu.contains(event.target) && event.button !== 2) closeMenu();
            if (pop && !pop.contains(event.target) && !event.target.closest('.ai-sticky-star')) closePop();
        }, true);
        document.addEventListener('keydown', event => {if (event.key === 'Escape' && (menu || pop)) {event.preventDefault(); closeMenu(); closePop();}});
        addEventListener('scroll', () => closeMenu(), {passive: true, capture: true});
        // Phones: remember the last selection, for the 問 AI button in the bottom bar.
        document.addEventListener('selectionchange', () => {
            const s = getSelection();
            if (s && !s.isCollapsed && s.rangeCount) {
                const r = s.getRangeAt(0), el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
                if (el?.closest('#note-list, #modal-text')) lastSelection = r.cloneRange();
            }
        });
        document.addEventListener('click', event => {
            const star = event.target.closest('.ai-sticky-star');
            if (star) {event.preventDefault(); event.stopPropagation(); if (!star.dataset.dragged) openPop(star);}
        }, true);
        document.addEventListener('pointerdown', dragStar, true);
        const quick = document.getElementById('note-quick-actions');
        if (quick) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'ai-dock-button'; button.textContent = '✦ 問 AI';
            button.addEventListener('pointerdown', event => event.preventDefault());
            button.addEventListener('click', () => {const ctx = lastSelection ? contextOf(lastSelection) : null; open(ctx || {text: '', noteId: null, quote: '', prefix: '', suffix: ''});});
            quick.prepend(button);
        }
        window.noteAiDecorate = list => decorate(list);
        const later = () => setTimeout(() => void noteTypingIdle(2000, 60000).then(loadStickies), 1500);
        if (window.noteDriveStartupComplete) later(); else window.addEventListener('note-drive-state', function once(event) {if (event.detail?.loaded) {removeEventListener('note-drive-state', once); later();}});
        document.addEventListener('visibilitychange', () => {if (!document.hidden && stickiesLoaded && Date.now() - stickiesAt > 5 * 60000) void loadStickies();});
    }
    return {start, open, close, ask, decorate, loadStickies, markdown, locate, state: () => ({stickies: [...stickies.values()], key: !!key, models, usage: usage(), limit})};
})();
noteAi.start();
