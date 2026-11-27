/* 購物紀錄小幫手 — the button. Click it (or press Alt+Shift+S) on a shop page:
 *  1. grab.js reads the products on the page (several → a small window to tick them),
 *  2. save.js adds them straight to 敗家紀錄雲端備份.json in the owner's Google Drive,
 *  3. a small message on the page says what was saved; an open 購物紀錄 page refreshes.
 * If saving fails (no internet, sign-in), the page is kept on this computer and saved later.
 */
import {saveGrab, safeUrl} from './save.js';

const SHOP_URL = 'https://paul36959401.github.io/pharmacy-notes/shopping.html';
const CLIENT_ID = '763409300868-6vuidharbkm839vkag59kft4h1a02c6m.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive';
const cache = {};

/* ---------- Google sign-in (the same Google login as the notes site) ---------- */
async function authFlow(interactive) {
    const {email} = await chrome.storage.local.get('email');
    const params = new URLSearchParams({client_id: CLIENT_ID, redirect_uri: chrome.identity.getRedirectURL(), response_type: 'token', scope: SCOPE, include_granted_scopes: 'true'});
    if (email) params.set('login_hint', email);
    if (!interactive) params.set('prompt', 'none');
    else if (!email) params.set('prompt', 'select_account consent');
    let redirect;
    try {
        redirect = await chrome.identity.launchWebAuthFlow({url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params, interactive});
    } catch (error) {
        throw Object.assign(new Error(interactive ? '沒有完成 Google 登入。' : '需要重新登入 Google。'), {code: 'AUTH', detail: String(error?.message || error)});
    }
    const answer = new URLSearchParams(new URL(redirect).hash.slice(1));
    if (answer.get('error')) throw Object.assign(new Error('Google 登入失敗：' + answer.get('error')), {code: 'AUTH'});
    const token = answer.get('access_token');
    if (!token || !String(answer.get('scope') || '').split(' ').includes(SCOPE)) {
        throw Object.assign(new Error('登入時需要勾選「查看、編輯、建立及刪除你的所有 Google 雲端硬碟檔案」，小幫手才能把紀錄存進你的雲端。'), {code: 'AUTH'});
    }
    const expiresAt = Date.now() + (Number(answer.get('expires_in') || 3600) - 120) * 1000;
    await chrome.storage.session.set({token, expiresAt});
    if (!email) {
        try {
            const about = await (await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {headers: {Authorization: 'Bearer ' + token}})).json();
            if (about.user?.emailAddress) await chrome.storage.local.set({email: about.user.emailAddress});
        } catch (_) {}
    }
    return token;
}
function makeAuth(interactive) {
    return {
        async get() {
            const {token, expiresAt} = await chrome.storage.session.get(['token', 'expiresAt']);
            if (token && Date.now() < expiresAt) return token;
            try {return await authFlow(false);}
            catch (error) {if (!interactive) throw error; return authFlow(true);}
        },
        async invalidate() {await chrome.storage.session.remove(['token', 'expiresAt']);}
    };
}

/* ---------- messages on the shop page ---------- */
async function toast(tabId, state, text, link) {
    try {
        await chrome.scripting.executeScript({target: {tabId}, func: (s, t, l) => globalThis.__ndShopGrab?.toast(s, t, l), args: [state, text, link || '']});
    } catch (_) {}
    await chrome.action.setBadgeBackgroundColor({tabId, color: state === 'ok' ? '#0f766e' : state === 'busy' ? '#b45309' : '#b91c1c'}).catch(() => {});
    await chrome.action.setBadgeText({tabId, text: state === 'ok' ? '✓' : state === 'busy' ? '…' : state === 'info' ? '' : '!'}).catch(() => {});
}

/* ---------- the button ---------- */
async function record(tab) {
    if (!tab?.id) return;
    if (!/^https?:/.test(tab.url || '') || tab.url.startsWith(SHOP_URL)) {
        await chrome.tabs.create({url: SHOP_URL});
        return;
    }
    let found = {v: 2, from: tab.url, title: tab.title || '', items: []};
    try {
        await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['grab.js']});
        const [{result}] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: () => globalThis.__ndShopGrab.collect()});
        if (result && safeUrl(result.from)) found = result;
    } catch (error) {
        // This page cannot be read (for example the Chrome Web Store): the address is still saved.
        console.warn('這一頁讀不到內容：', error);
    }
    if (found.items.length > 1) {
        try {
            await chrome.scripting.executeScript({target: {tabId: tab.id}, func: items => globalThis.__ndShopGrab.panel(items), args: [found.items]});
            return;   // the small window sends 'nd-save' with the ticked products
        } catch (_) {found.items = found.items.slice(0, 1);}
    }
    await save(tab.id, found, true);
}

async function save(tabId, payload, interactive) {
    await toast(tabId, 'busy', '正在存到購物紀錄…');
    try {
        const result = await saveGrab(payload, {auth: makeAuth(interactive), cache});
        const names = result.added.map(r => '「' + r.name.slice(0, 40) + (r.name.length > 40 ? '…' : '') + '」').join('、');
        const pictures = result.added.reduce((n, r) => n + r.pictures, 0);
        if (result.added.length) {
            await toast(tabId, 'ok', '已存到購物紀錄：' + names + (pictures ? '（' + pictures + ' 張圖片）' : '（沒有讀到圖片，可以之後自己貼）') +
                (result.skipped.length ? '\n已經記錄過的 ' + result.skipped.length + ' 筆沒有重複存。' : ''), SHOP_URL);
            await refreshShopPages(result.added.map(r => r.id));
        } else {
            await toast(tabId, 'info', '這筆已經記錄過了，沒有重複存：' + result.skipped.slice(0, 2).join('、'), SHOP_URL);
        }
        void retryQueue();
    } catch (error) {
        if (error.code === 'FORMAT' || error.code === 'INPUT') {await toast(tabId, 'error', error.message); return;}
        await keep(payload);
        await toast(tabId, 'warn', '現在存不到雲端（' + error.message + '）。\n已經先存在這台電腦，之後會自動補存' + (error.code === 'AUTH' ? '；請再按一次小幫手，完成 Google 登入。' : '。'));
    }
}

/* ---------- kept on this computer until it can be saved ---------- */
async function keep(payload) {
    const {queue = []} = await chrome.storage.local.get('queue');
    queue.push({payload, at: Date.now()});
    await chrome.storage.local.set({queue: queue.slice(-50)});
    await chrome.action.setBadgeText({text: String(queue.length)}).catch(() => {});
}
let retrying = null;
async function retryQueue() {
    if (retrying) return retrying;
    retrying = (async () => {
        const {queue = []} = await chrome.storage.local.get('queue');
        if (!queue.length) return;
        const left = [];
        let added = [];
        for (const entry of queue) {
            try {added = added.concat((await saveGrab(entry.payload, {auth: makeAuth(false), cache})).added);}
            catch (error) {left.push(entry); if (error.code === 'AUTH' || error.code === 'NETWORK') {left.push(...queue.slice(queue.indexOf(entry) + 1)); break;}}
        }
        await chrome.storage.local.set({queue: left});
        await chrome.action.setBadgeText({text: left.length ? String(left.length) : ''}).catch(() => {});
        if (added.length) await refreshShopPages(added.map(r => r.id));
    })().finally(() => {retrying = null;});
    return retrying;
}

/* An open 購物紀錄 page reloads the list and highlights the new records. */
async function refreshShopPages(ids) {
    const tabs = await chrome.tabs.query({url: SHOP_URL + '*'});
    for (const tab of tabs) {
        chrome.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', func: list => window.dispatchEvent(new CustomEvent('nd-shopping-saved', {detail: {ids: list}})), args: [ids]}).catch(() => {});
    }
}

chrome.action.onClicked.addListener(tab => void record(tab));
globalThis.ndRecordForTests = record;   // lets test/shopping-e2e.mjs press the button
chrome.commands.onCommand.addListener((command, tab) => {if (command === 'record') void record(tab);});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type === 'nd-save' && sender.tab?.id) void save(sender.tab.id, message.payload, true);
    if (message?.type === 'nd-status') {
        Promise.all([chrome.storage.local.get(['email', 'queue']), chrome.storage.session.get(['token', 'expiresAt'])])
            .then(([l, s]) => reply({email: l.email || '', waiting: (l.queue || []).length, signedIn: !!(s.token && Date.now() < s.expiresAt), redirect: chrome.identity.getRedirectURL()}));
        return true;
    }
    if (message?.type === 'nd-signin') {
        chrome.storage.session.remove(['token', 'expiresAt'])
            .then(() => message.switchAccount ? chrome.storage.local.remove('email') : null)
            .then(() => authFlow(true)).then(() => retryQueue()).then(() => reply({ok: true}), error => reply({ok: false, error: error.message}));
        return true;
    }
    if (message?.type === 'nd-retry') {retryQueue().then(() => reply({ok: true}), () => reply({ok: false})); return true;}
    return false;
});
chrome.runtime.onStartup.addListener(() => void retryQueue());
chrome.runtime.onInstalled.addListener(details => {
    chrome.alarms.create('nd-retry', {periodInMinutes: 10});
    if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.alarms.onAlarm.addListener(alarm => {if (alarm.name === 'nd-retry') void retryQueue();});
