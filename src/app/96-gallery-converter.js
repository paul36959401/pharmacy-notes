/* Source: 96-gallery-converter.js */
/* One-time conversion: move images from the old separate image area (gallery) into
 * the note text, at the end of each note — exactly what pressing「移入文字」on every
 * image does, using that same code path. Image totals are counted before and after;
 * if they differ the run stops and nothing more is changed. */
const noteGalleryConverter = (() => {
    'use strict';
    let running = false;
    const inlineCount = html => (String(html || '').match(/<img\b/gi) || []).length;
    const waitFor = async (test, ms = 30000) => {
        const end = Date.now() + ms;
        while (!test()) {if (Date.now() > end) throw new Error('等待逾時'); await new Promise(r => setTimeout(r, 60));}
    };
    function pending() {return notesData.filter(note => collectLegacyGalleryImages(note).length);}
    function totals() {
        let gallery = 0, inline = 0;
        for (const note of notesData) {gallery += collectLegacyGalleryImages(note).length; inline += inlineCount(note.text);}
        return {gallery, inline, all: gallery + inline};
    }
    async function convertNote(note) {
        const modal = document.getElementById('noteModal');
        await openEditModal(note.id);
        await waitFor(() => modal.classList.contains('active') && editingNoteId === note.id);
        const expected = collectLegacyGalleryImages(note).length;
        await waitFor(() => currentPastedImages.length === expected, 10000);
        while (currentPastedImages.length) {
            const before = currentPastedImages.length;
            savedEditorRange = null;            // insert at the end of the note text
            await window.moveGalleryImageInline(0);
            if (currentPastedImages.length >= before) throw new Error('「' + (note.title || notePlainText(note.text).slice(0, 20)) + '」的圖片尚未讀取完成，請稍後再試。');
        }
        saveNote();
        await waitFor(() => !modal.classList.contains('active'));
    }
    async function run(onProgress = () => {}) {
        if (running) return;
        if (noteDriveServer.isReadOnly()) throw new Error('目前是唯讀檢查模式，請先開啟編輯。');
        if (previewModeBlocksEditing()) throw new Error('請先關閉「預覽模式」再轉換。');
        running = true;
        try {
            await notePersistence.flush();
            const list = pending(), before = totals();
            let done = 0;
            for (const note of list) {
                const expectedAfter = inlineCount(note.text) + collectLegacyGalleryImages(note).length;
                await convertNote(note);
                const saved = notesData.find(n => n.id === note.id);
                if (!saved || collectLegacyGalleryImages(saved).length || inlineCount(saved.text) !== expectedAfter)
                    throw new Error('轉換「' + (note.title || notePlainText(note.text).slice(0, 20)) + '」後圖片數不符，已停止；這則筆記可從「垃圾桶與版本」還原。');
                onProgress(++done, list.length);
            }
            await notePersistence.flush();
            const after = totals();
            if (after.gallery !== 0 || after.all !== before.all) throw new Error('圖片總數不符（轉換前 ' + before.all + '、轉換後 ' + after.all + '），請從「垃圾桶與版本」還原並回報。');
            return {notes: list.length, images: before.gallery, total: after.all};
        } finally {running = false;}
    }
    function initialize() {
        const button = document.getElementById('drive-gallery-convert'), message = document.getElementById('drive-message');
        if (!button) return;
        const refresh = () => {
            if (!document.getElementById('drive-tools')?.open) return;
            const count = pending().length;
            button.hidden = !count;
            button.textContent = '把舊圖片區移進文字（' + count + ' 則）';
            button.disabled = running || noteDriveServer.isReadOnly();
            button.title = noteDriveServer.isReadOnly() ? '唯讀檢查模式下不能轉換' : '';
        };
        window.addEventListener('note-drive-state', refresh);
        document.getElementById('drive-tools')?.addEventListener('toggle', refresh);
        button.onclick = async () => {
            const list = pending(), images = list.reduce((n, note) => n + collectLegacyGalleryImages(note).length, 0);
            if (!confirm('要把 ' + list.length + ' 則筆記、共 ' + images + ' 張舊圖片區的圖片，移到各自筆記文字的最後面嗎？\n\n效果和在編輯畫面逐張按「移入文字」一樣，畫記也會保留。轉換前後會核對圖片總數。')) return;
            button.disabled = true;
            try {
                const result = await run((done, total) => {message.textContent = '正在轉換舊圖片區：' + done + '／' + total + ' 則…';});
                message.textContent = '轉換完成：' + result.notes + ' 則筆記、' + result.images + ' 張圖片已移進文字；全部圖片共 ' + result.total + ' 張，數量一致。';
            } catch (error) {
                message.textContent = error.message;
            } finally {refresh();}
        };
        refresh();
    }
    return {initialize, run, pending, totals};
})();
