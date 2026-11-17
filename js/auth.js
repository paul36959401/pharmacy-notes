/* Google sign-in (Google Identity Services, token model).
 * The access token lives about 1 hour. It is kept in localStorage so reopening the
 * site inside that hour does not ask again. In the last 10 minutes the next button click renews it;
 * if it still runs out and the browser blocks the pop-up, a banner asks for one click to reconnect.
 */
const noteAuth = (() => {
    'use strict';
    const SCOPE = 'https://www.googleapis.com/auth/drive';
    const KEY = 'nd-token-v1';
    let client = null, token = null, expiresAt = 0, waiting = null, ready = null;

    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null');
        if (saved && saved.expiresAt > Date.now() + 60000) {token = saved.token; expiresAt = saved.expiresAt;}
    } catch (_) {}

    function loadLibrary() {
        if (ready) return ready;
        ready = new Promise((resolve, reject) => {
            if (window.google?.accounts?.oauth2) return resolve();
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => {ready = null; reject(new Error('無法載入 Google 登入元件，請檢查網路或關閉擋廣告外掛後重新整理。'));};
            document.head.append(script);
        });
        return ready;
    }
    function store(response) {
        token = response.access_token;
        expiresAt = Date.now() + (Number(response.expires_in || 3600) - 120) * 1000;
        try {localStorage.setItem(KEY, JSON.stringify({token, expiresAt}));} catch (_) {}
    }
    function banner(show) {
        let el = document.getElementById('auth-reconnect');
        if (!show) {el?.remove(); return;}
        if (el) return;
        el = document.createElement('div');
        el.id = 'auth-reconnect';
        el.setAttribute('role', 'alert');
        el.innerHTML = '<span>Google 連線已過期（安全起見每小時會到期一次）。</span><button type="button">重新連線</button>';
        el.querySelector('button').onclick = () => request('').catch(() => {});
        document.body.append(el);
    }
    /* Must run from a click for the very first sign-in, otherwise pop-ups are blocked. */
    async function request(prompt = '') {
        await loadLibrary();
        const config = window.NOTE_SITE_CONFIG;
        if (!client) client = google.accounts.oauth2.initTokenClient({client_id: config.clientId, scope: SCOPE, callback: () => {}});
        return new Promise((resolve, reject) => {
            client.callback = response => {
                if (response.error) {reject(new Error('Google 登入未完成：' + (response.error_description || response.error))); return;}
                if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
                    reject(new Error('需要勾選「查看、編輯、建立及刪除你的所有 Google 雲端硬碟檔案」，網站才讀得到你原本的筆記。請再登入一次並勾選。'));
                    return;
                }
                store(response); banner(false);
                const done = waiting; waiting = null; done?.resolve(token);
                resolve(token);
            };
            client.error_callback = error => {
                if (error?.type === 'popup_failed_to_open' || error?.type === 'popup_closed') banner(true);
                reject(new Error(error?.type === 'popup_closed' ? '登入視窗已關閉。' : '瀏覽器擋住了 Google 登入視窗，請允許彈出式視窗。'));
            };
            const hint = localStorage.getItem('nd-login-hint') || '';
            client.requestAccessToken({prompt, ...(hint ? {login_hint: hint} : {})});
        });
    }
    async function getToken() {
        if (token && Date.now() < expiresAt) return token;
        token = null;
        if (!waiting) {
            let resolve, reject;
            const promise = new Promise((a, b) => {resolve = a; reject = b;});
            waiting = {promise, resolve, reject};
            request('').catch(() => banner(true));
        }
        return waiting.promise;
    }
    /* Renew before the hour runs out. Browsers only allow the Google window during a click,
       so when less than 10 minutes are left (or it already ran out), the next click on a
       button renews it. Clicks inside the note text are skipped so typing is never interrupted. */
    let lastRenew = 0;
    document.addEventListener('click', event => {
        if (!window.google?.accounts?.oauth2) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('[contenteditable="true"], input, textarea, select, #auth-reconnect')) return;
        if (!target.closest('button, a, summary, label, [role="button"], [data-on-click]')) return;
        const left = expiresAt - Date.now();
        if (left > 10 * 60000 || Date.now() - lastRenew < 60000) return;
        lastRenew = Date.now();
        request('').catch(() => {if (!token || Date.now() >= expiresAt) banner(true);});
    }, true);
    function invalidate() {token = null; expiresAt = 0; try {localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);} catch (_) {}}
    function signOut() {
        if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
        invalidate(); localStorage.removeItem('nd-login-hint');
    }
    return {request, getToken, invalidate, signOut, hasToken: () => !!token && Date.now() < expiresAt, loadLibrary};
})();
