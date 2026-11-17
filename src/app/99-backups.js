/* Source: 99-backups.js */
/* Weekly backups, restore, and tidying old version files.
 * - Once a week (checked when the site opens) the current version of this subject is
 *   copied to Drive folder 每週備份. The newest 8 are kept.
 * - Restore makes the chosen backup the current version again. The current content is
 *   backed up first, so a restore can itself be undone.
 * - 整理舊版本 moves old version files (one is written per save) to Drive trash,
 *   keeping the newest 200 and one per month. Notes and images are not touched.
 */
const noteBackups = (() => {
    'use strict';
    const KIND = {weekly: '每週自動', manual: '手動', 'before-restore': '還原前'};
    const $ = id => document.getElementById(id);
    const say = text => {const el = $('backup-status'); if (el) el.textContent = text;};
    const when = iso => new Date(iso).toLocaleString('zh-TW', {year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'});
    let busy = false;

    async function render() {
        const list = $('backup-list');
        list.innerHTML = '<p class="backup-empty">正在讀取備份清單…</p>';
        try {
            const {backups} = await noteDriveRpc('backups');
            if (!backups.length) {list.innerHTML = '<p class="backup-empty">還沒有備份。按「立即備份」建立第一份；之後每週會自動備份。</p>'; return;}
            list.innerHTML = backups.map(b => '<div class="backup-row"><div><b>' + escapeHtml(when(b.createdTime)) + '</b><span>' +
                escapeHtml((KIND[b.kind] || b.kind) + (b.count ? '・' + b.count + ' 筆資料' : '')) + '</span></div>' +
                '<button type="button" data-on-click="noteRestoreBackup" data-args="' + escapeHtml(JSON.stringify([b.id, when(b.createdTime)])) + '">還原這份</button></div>').join('');
        } catch (error) {list.innerHTML = '<p class="backup-empty">' + escapeHtml(error.message) + '</p>';}
    }
    function open() {$('backupModal').classList.add('active'); say(''); void render();}
    function close() {$('backupModal').classList.remove('active');}

    async function backupNow() {
        if (busy) return; busy = true; $('backup-now').disabled = true; say('正在備份…');
        try {await notePersistence.flush(); await noteDriveRpc('backupNow'); say('已備份。'); await render();}
        catch (error) {say('備份失敗：' + error.message);}
        finally {busy = false; $('backup-now').disabled = false;}
    }
    async function restore(fileId, label) {
        if (busy) return;
        if (!confirm('要把這個科目還原成「' + label + '」的內容嗎？\n\n之後新增或修改的筆記會回到那時候的樣子。\n還原前會先自動備份目前的內容，所以之後也可以再還原回來。')) return;
        busy = true; say('正在保存目前內容並備份…');
        try {
            await notePersistence.flush();
            if (notePersistence.hasUnsavedChanges()) throw new Error('目前還有尚未存到雲端的修改，請等右上角顯示已同步後再試。');
            await noteDriveServer.call({action: 'backupNow', book: noteDriveBoot.book, kind: 'before-restore'});
            say('正在還原…');
            const result = await noteDriveRpc('restoreBackup', {fileId});
            if (!result.success) throw new Error(result.error || '還原未完成。');
            say('已還原，正在重新載入…');
            setTimeout(() => location.reload(), 300);
        } catch (error) {say('還原失敗：' + error.message); busy = false;}
    }

    async function tidy() {
        const message = $('drive-message'), button = $('drive-tidy');
        if (busy) return; busy = true; button.disabled = true;
        try {
            message.textContent = '正在清點舊版本檔案…';
            const plan = await noteDriveServer.call({action: 'versionPlan', book: noteDriveBoot.book});
            if (!plan.success) throw new Error(plan.error);
            if (!plan.trash) {message.textContent = '舊版本檔案共 ' + plan.total + ' 個，都在保留範圍內，不需要整理。'; return;}
            if (!confirm('這個科目每次存檔都會留下一個小的「版本檔」，目前共有 ' + plan.total + ' 個。\n\n會保留 ' + plan.keep + ' 個（最新 200 個＋每個月最後一個），其餘 ' + plan.trash +
                ' 個移到 Google 雲端硬碟的垃圾桶（30 天內都能救回）。\n\n筆記內容、圖片和每週備份都不會受影響。要開始嗎？')) {message.textContent = '已取消整理。'; return;}
            const result = await noteDriveServer.call({action: 'cleanupVersions', book: noteDriveBoot.book,
                onProgress: (done, total) => {message.textContent = '正在整理舊版本：' + done + ' / ' + total;}});
            if (!result.success) throw new Error(result.error);
            message.textContent = '整理完成：保留 ' + result.kept + ' 個，' + result.trashed + ' 個已移到雲端硬碟垃圾桶。';
        } catch (error) {message.textContent = '整理未完成：' + error.message + '（可以再按一次繼續）';}
        finally {busy = false; button.disabled = false;}
    }

    /* Weekly check: at most twice a day, after the subject has loaded and the writer is idle. */
    let checked = false;
    async function weekly() {
        if (checked) return; checked = true;
        const key = 'nd-weekly-check-' + noteDriveBoot.book;
        if (Date.now() - Number(localStorage.getItem(key) || 0) < 12 * 3600000) return;
        await new Promise(r => setTimeout(r, window.NOTE_BACKUP_DELAY ?? 20000));
        await noteTypingIdle(3000, 120000);
        try {
            const result = await noteDriveServer.call({action: 'weeklyBackup', book: noteDriveBoot.book});
            if (result.success && !result.readOnly) localStorage.setItem(key, String(Date.now()));
        } catch (_) {}
    }
    function start() {
        $('drive-backups')?.addEventListener('click', open);
        $('drive-tidy')?.addEventListener('click', () => void tidy());
        window.addEventListener('note-drive-state', event => {if (event.detail?.loaded) void weekly();});
    }
    return {start, open, close, backupNow, restore, tidy};
})();
function closeBackupModal() {noteBackups.close();}
function noteBackupNow() {void noteBackups.backupNow();}
function noteRestoreBackup(fileId, label) {void noteBackups.restore(fileId, label);}
noteBackups.start();
