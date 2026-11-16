/* Start-up: sign in, find the notes folder, then start the note app. */
(() => {
    'use strict';
    const config = window.NOTE_SITE_CONFIG;
    const gate = document.getElementById('site-gate');
    const gateText = document.getElementById('site-gate-text');
    const gateButton = document.getElementById('site-gate-button');
    const params = new URLSearchParams(location.search);
    const book = config.books.find(b => b.id === params.get('book')) || config.books[0];
    document.title = book.title + '｜藥學筆記雲端';

    function say(text, button = '') {
        gateText.textContent = text;
        gateButton.hidden = !button;
        if (button) gateButton.textContent = button;
    }
    function startupError(error) {
        const panel = document.getElementById('drive-start-error'), text = document.getElementById('drive-start-error-text');
        text.textContent = '網頁啟動失敗：' + (error?.message || error) + '〔版本：' + config.release + '〕';
        panel.hidden = false; gate.hidden = true;
    }
    document.getElementById('drive-start-reload').onclick = () => location.reload();

    function readOnlyBanner() {
        // Verification is finished (2026-11-16), so editing is on by default. Setting
        // localStorage 'nd-allow-write' to '0' brings the read-only check mode back.
        const allowed = localStorage.getItem('nd-allow-write') !== '0';
        noteDriveServer.setReadOnly(!allowed);
        const bar = document.getElementById('site-readonly');
        bar.hidden = allowed;
        document.getElementById('site-readonly-enable').onclick = () => {
            if (!confirm('確定開啟編輯嗎？\n\n開啟後，新網站的修改會存回 Google Drive。\n之後請不要再用舊的 Apps Script 網站編輯，以免兩邊版本打架。')) return;
            localStorage.setItem('nd-allow-write', '1');
            location.reload();
        };
    }

    async function loadApp() {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'js/app.js?v=' + encodeURIComponent(config.release);
            script.onload = resolve;
            script.onerror = () => reject(new Error('前端程式下載失敗，請重新整理。'));
            document.body.append(script);
        });
        if (typeof window.noteDriveStart !== 'function') throw new Error('未取得前端啟動函式');
        await window.noteDriveStart();
        window.noteDriveStartupComplete = true;
    }

    async function afterSignIn() {
        say('正在尋找你 Google Drive 裡的「藥學筆記雲端工作台」資料夾…');
        const root = await noteDriveServer.initialize({books: config.books});
        try {
            const about = await (await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {headers: {Authorization: 'Bearer ' + await noteAuth.getToken()}})).json();
            if (about.user?.emailAddress) localStorage.setItem('nd-login-hint', about.user.emailAddress);
        } catch (_) {}
        window.NOTE_CLOUD_BOOTSTRAP = {native: true, release: config.release, workspace: root, book: book.id, title: book.title,
            books: config.books, appUrl: location.origin + location.pathname};
        readOnlyBanner();
        gate.hidden = true;
        await loadApp();
    }

    async function signIn(prompt) {
        gateButton.disabled = true;
        try {
            say('請在跳出的 Google 視窗中選擇存放筆記的帳號…');
            await noteAuth.request(prompt);
            await afterSignIn();
        } catch (error) {
            say(error.message, '再試一次');
        } finally {gateButton.disabled = false;}
    }

    if (!config.clientId) {
        say('網站還沒設定 Google 登入（config.js 的 clientId 是空的）。');
        return;
    }
    noteAuth.loadLibrary().catch(error => say(error.message));
    gateButton.onclick = () => signIn(localStorage.getItem('nd-login-hint') ? '' : 'consent');
    if (noteAuth.hasToken()) afterSignIn().catch(startupError);
    else say('用你的 Google 帳號登入，網站會直接讀取你 Google Drive 裡的筆記。', '用 Google 登入');
})();
