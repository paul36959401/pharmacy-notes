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
