/* 購物紀錄小幫手 — saving. Adds products straight to the owner's Google Drive, in the same
 * format the 購物紀錄 page uses:
 *  - 敗家紀錄雲端備份.json : the list (small pictures inside), new records added at the end.
 *  - 購物紀錄網站圖片       : full-size pictures.
 *  - 藥學筆記雲端工作台／購物紀錄備份 : the weekly copy made before the week's first change.
 * Used by background.js (extension) and by test/shopping-e2e.mjs (in a normal page).
 */
export const DATA_FILE_NAME = '敗家紀錄雲端備份.json';
const IMAGE_FOLDER_NAME = '購物紀錄網站圖片';
const WORKSPACE_NAME = '藥學筆記雲端工作台';
const BACKUP_FOLDER_NAME = '購物紀錄備份';
const BACKUP_KEEP = 8;
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const DELIVERIES = ['補款', '取貨付款', '純取貨', '寄到家', '集運倉'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const fail = (message, code = 'DRIVE') => Object.assign(new Error(message), {code});
const text = (value, max = 200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const safeUrl = value => {
    try {const u = new URL(String(value || '')); return /^https?:$/.test(u.protocol) ? u.href : '';} catch (_) {return '';}
};
function amountText(value) {
    const s = String(value ?? '').replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^0-9.]/g, '');
    const [whole, ...rest] = s.split('.');
    const decimals = rest.join('').slice(0, 2);
    return whole || decimals ? (whole || '0') + (decimals ? '.' + decimals : '') : '';
}
function base64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(s);
}
function sanitizeName(value, max = 80) {
    return String(value || '商品圖片').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, max) || '商品圖片';
}

/* ---------- records ---------- */
export function siteKey(url) {
    let host = '';
    try {host = new URL(url).hostname.replace(/^www\./, '');} catch (_) {return '';}
    if (/(^|\.)(taobao|tmall)\.com$/.test(host)) return 'taobao';
    if (/(^|\.)ruten\.com\.tw$/.test(host)) return 'ruten';
    const parts = host.split('.');
    return parts.slice(/\.(co|com|ne|or)\.(jp|tw)$/.test(host) ? -3 : -2).join('.');
}
export function comparableUrl(url) {
    try {
        const u = new URL(url);
        const keep = [...u.searchParams].filter(([k]) => !/^(spm|mi_id|scm|pvid|xxc|utm_.*|from|skuId|sku_properties|upStreamPrice|ns|abbucket|ali_.*|_u|pisk|track.*|ref)$/i.test(k)).sort(([a], [b]) => a.localeCompare(b));
        return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '') + '?' + keep.map(([k, v]) => k + '=' + v).join('&');
    } catch (_) {return String(url || '');}
}
/* "預購11月", "【八月預購】", "12月発売予定", "(2026/5~6月補款)" → year-month. */
export function guessMonth(name, now = new Date()) {
    const s = String(name || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const cn = {一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12};
    const word = '(?:預購|預約|预购|预约|預售|预售|予約|預定|発売|发售|發售|出荷|発送|到貨|預計|预计|出貨)';
    const num = '(十一|十二|十|[一二三四五六七八九]|1[0-2]|0?[1-9])';
    let m = new RegExp('(20\\d{2})\\s*[年/.-]\\s*(1[0-2]|0?[1-9])\\s*月?(?:[^0-9]|$)').exec(s);
    if (m && new RegExp(word + '|補款|补款').test(s)) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
    m = new RegExp(word + '[^0-9一二三四五六七八九十]{0,4}' + num + '\\s*月').exec(s) || new RegExp(num + '\\s*月\\s*(?:上旬|中旬|下旬|頃|ごろ)?\\s*' + word).exec(s);
    if (!m) return '';
    const month = cn[m[1]] || Number(m[1]);
    if (!(month >= 1 && month <= 12)) return '';
    const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    return year + '-' + String(month).padStart(2, '0');
}
/* One product from the page → one record in the 購物紀錄 format (empty fields left out).
   Delivery and pick-up store follow the newest record from the same shop. */
export function recordFromGrab(grab, payload, existing, id) {
    const url = safeUrl(grab.url) || safeUrl(payload.from);
    const site = siteKey(url || payload.from);
    const previous = existing.filter(i => i && i.url && siteKey(i.url) === site).sort((a, b) => Number(b.id) - Number(a.id))[0];
    const delivery = DELIVERIES.includes(grab.delivery) ? grab.delivery : (previous && DELIVERIES.includes(previous.delivery) ? previous.delivery : '');
    const address = text(grab.address, 120) || (previous && previous.delivery === delivery && /取貨/.test(delivery) ? previous.address || '' : '');
    const month = /^\d{4}-\d{2}$/.test(grab.month || '') ? grab.month : guessMonth(grab.name);
    const record = {id, name: text(grab.name) || text(payload.title) || site || '未命名商品', delivery};
    if (month) record.month = month;
    if (address) record.address = address;
    if (url) record.url = url;
    const price = amountText(grab.price);
    if (price) record.price = price;
    if (price && ['JPY', 'CNY'].includes(grab.currency)) record.currency = grab.currency;
    if (/^\d{4}-\d{2}-\d{2}$/.test(grab.paymentDate || '')) record.paymentDate = grab.paymentDate;
    return record;
}
function isDuplicate(record, grab, list) {
    if (!record.url) return null;
    const key = comparableUrl(record.url);
    return list.find(i => i && i.url && comparableUrl(i.url) === key && (!grab.name || !i.name || text(i.name) === record.name)) || null;
}

/* ---------- pictures ---------- */
function sniffImage(bytes) {
    const b = bytes.subarray(0, 16), s = String.fromCharCode(...b);
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (b[0] === 0x89 && s.slice(1, 4) === 'PNG') return 'image/png';
    if (/^GIF8[79]a/.test(s)) return 'image/gif';
    if (s.slice(0, 4) === 'RIFF' && s.slice(8, 12) === 'WEBP') return 'image/webp';
    if (s.slice(4, 8) === 'ftyp') return 'image/avif';
    return '';
}
async function fetchImage(url, fetchFn) {
    if (url.startsWith('data:image/')) return (await fetchFn(url)).blob();
    let lastError = null;
    for (const credentials of ['omit', 'include']) {
        try {
            const response = await fetchFn(url, {credentials, cache: 'no-store'});
            if (!response.ok) {lastError = new Error('HTTP ' + response.status); continue;}
            const bytes = new Uint8Array(await response.arrayBuffer());
            const type = sniffImage(bytes);
            if (!type || bytes.length > 25 * 1024 * 1024) {lastError = new Error('不是圖片'); continue;}
            return new Blob([bytes], {type});
        } catch (error) {lastError = error;}
    }
    throw lastError || new Error('圖片讀取失敗');
}
/* Product page → the address of its main picture (Ruten order pages have no pictures). */
async function pagePicture(pageUrl, fetchFn) {
    let response = await fetchFn(pageUrl, {credentials: 'omit'}).catch(() => null);
    if (!response?.ok) response = await fetchFn(pageUrl, {credentials: 'include'});
    if (!response.ok) throw new Error('商品頁 HTTP ' + response.status);
    const html = (await response.text()).slice(0, 3000000);
    const patterns = [
        /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i,
        /<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i,
        /"image"\s*:\s*\[?\s*"([^"]+)"/i
    ];
    for (const pattern of patterns) {
        const m = pattern.exec(html);
        if (m) return new URL(m[1].replace(/\\\//g, '/').replace(/&amp;/g, '&'), pageUrl).href;
    }
    throw new Error('商品頁找不到圖片');
}
/* Small picture kept inside the list: at most 520 px, JPEG (same as the 購物紀錄 page). */
async function thumbnail(blob) {
    const bitmap = await createImageBitmap(blob);
    let w = bitmap.width, h = bitmap.height;
    const max = 520;
    if (w > max || h > max) {if (w > h) {h *= max / w; w = max;} else {w *= max / h; h = max;}}
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    const ctx = canvas.getContext('2d', {alpha: false});
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const out = await canvas.convertToBlob({type: 'image/jpeg', quality: 0.66});
    return 'data:image/jpeg;base64,' + base64(new Uint8Array(await out.arrayBuffer()));
}

/* ---------- Google Drive ---------- */
function driveClient(auth, fetchFn) {
    async function http(url, options = {}, attempt = 0) {
        const token = await auth.get();
        let response;
        try {
            response = await fetchFn(url, {...options, headers: {Authorization: 'Bearer ' + token, ...(options.headers || {})}});
        } catch (_) {
            if (attempt < 2) {await sleep(800 * (attempt + 1)); return http(url, options, attempt + 1);}
            throw fail('連不上 Google Drive（網路有問題？）', 'NETWORK');
        }
        if (response.status === 401 && attempt === 0) {await auth.invalidate(); return http(url, options, 1);}
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {await sleep(1000 * 2 ** attempt); return http(url, options, attempt + 1);}
        if (!response.ok) {
            let detail = '';
            try {detail = (await response.json()).error?.message || '';} catch (_) {}
            throw fail('Google Drive 回覆 ' + response.status + (detail ? '：' + detail.slice(0, 160) : ''), response.status === 401 || response.status === 403 ? 'AUTH' : 'DRIVE');
        }
        return response;
    }
    const api = async (path, options) => (await http(API + path, options)).json();
    async function list(query, fields = 'id,name', orderBy = '') {
        const out = [];
        let pageToken = '';
        do {
            const params = new URLSearchParams({q: query, fields: 'nextPageToken,files(' + fields + ')', pageSize: '100', spaces: 'drive'});
            if (orderBy) params.set('orderBy', orderBy);
            if (pageToken) params.set('pageToken', pageToken);
            const page = await api('/files?' + params);
            out.push(...(page.files || []));
            pageToken = page.nextPageToken || '';
        } while (pageToken);
        return out;
    }
    const createFolder = (name, parents) => api('/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, mimeType: FOLDER, ...(parents ? {parents} : {})})});
    async function uploadNew(metadata, blob) {
        const boundary = 'nd' + crypto.randomUUID().replace(/-/g, '');
        const body = new Blob(['--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: ' + (metadata.mimeType || blob.type || 'application/octet-stream') + '\r\n\r\n', blob, '\r\n--' + boundary + '--']);
        return (await http(UPLOAD + '/files?uploadType=multipart&fields=id,name,mimeType,size', {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + boundary}, body})).json();
    }
    return {http, api, list, createFolder, uploadNew};
}
const stampOf = meta => String(meta.modifiedTime || '') + '|' + String(meta.md5Checksum || meta.size || '');
function weekLabel(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return d.getUTCFullYear() + '-W' + String(Math.ceil(((d - yearStart) / 86400000 + 1) / 7)).padStart(2, '0');
}

/**
 * Save what the page reader found. payload = {from, title, items: [...]}; an empty items list
 * saves the page address with its title. Returns {added: [{id, name, pictures}], skipped: [names], account}.
 * auth = {get(): Promise<token>, invalidate()}.
 */
export async function saveGrab(payload, {auth, fetchFn = (...a) => fetch(...a), cache = {}} = {}) {
    const drive = driveClient(auth, fetchFn);
    if (!payload || !safeUrl(payload.from)) throw fail('這一頁沒有網址，無法記錄。', 'INPUT');
    const grabs = (Array.isArray(payload.items) && payload.items.length ? payload.items : [{}]).slice(0, 30).filter(g => g && typeof g === 'object');

    // the list file (the newest one with that name)
    let fileId = cache.fileId;
    if (!fileId) {
        const found = (await drive.list("name='" + q(DATA_FILE_NAME) + "' and trashed=false", 'id,mimeType,modifiedTime', 'modifiedTime desc')).filter(f => f.mimeType !== FOLDER);
        fileId = found[0]?.id || (await drive.uploadNew({name: DATA_FILE_NAME, mimeType: 'text/plain'}, new Blob(['[]'], {type: 'text/plain'}))).id;
        cache.fileId = fileId;
    }
    const meta = () => drive.api('/files/' + encodeURIComponent(fileId) + '?fields=id,modifiedTime,size,md5Checksum');
    const download = async () => (await drive.http(API + '/files/' + encodeURIComponent(fileId) + '?alt=media', {cache: 'no-store'})).text();
    const parse = value => {
        const data = JSON.parse(value || '[]');
        if (!Array.isArray(data)) throw fail('雲端的購物紀錄檔格式不正確，沒有存。', 'FORMAT');
        return data;
    };

    let before = await meta();
    let textNow = await download();
    let list = parse(textNow);

    // new records (skip what is already there)
    const records = [], skipped = [];
    let nextId = Math.max(Date.now(), ...list.map(i => Number(i?.id)).filter(Number.isFinite).map(n => n + 1));
    for (const grab of grabs) {
        const record = recordFromGrab(grab, payload, list.concat(records), nextId);
        const same = isDuplicate(record, grab, list.concat(records));
        if (same) {skipped.push(same.name || same.url); continue;}
        nextId++;
        records.push({record, grab});
    }
    if (!records.length) return {added: [], skipped};

    // pictures: from the page, or from the product page when the page has none (Ruten orders)
    let pictureFolder = cache.pictureFolder;
    for (const {record, grab} of records) {
        const sources = [];
        for (const url of [].concat(grab.images || [], grab.image || [])) {
            const u = String(url || '').startsWith('data:image/') ? String(url) : safeUrl(url);
            if (u && !sources.some(s => s.url === u)) sources.push({url: u, page: false});
        }
        for (const url of [].concat(grab.imagePages || [])) {
            const u = safeUrl(url);
            if (u && sources.length < 4) sources.push({url: u, page: true});
        }
        const images = [];
        for (const [index, source] of sources.slice(0, 4).entries()) {
            try {
                const blob = await fetchImage(source.page ? await pagePicture(source.url, fetchFn) : source.url, fetchFn);
                const small = await thumbnail(blob);
                if (!pictureFolder) {
                    const folders = await drive.list("name='" + q(IMAGE_FOLDER_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false", 'id,createdTime', 'createdTime');
                    pictureFolder = cache.pictureFolder = folders[0]?.id || (await drive.createFolder(IMAGE_FOLDER_NAME)).id;
                }
                const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : 'jpg';
                const name = sanitizeName(record.name) + '_' + (index + 1) + '.' + ext;
                const file = await drive.uploadNew({name, mimeType: blob.type, parents: [pictureFolder], description: '購物紀錄網站高清原圖｜建立時間：' + new Date().toISOString()}, blob);
                images.push({src: small, id: file.id, name: file.name || name, type: blob.type});
            } catch (error) {
                console.warn('商品圖片讀取失敗：', source.url, error);
            }
        }
        if (images.length) {
            record.image = images.map(i => i.src);
            record.imageOriginalIds = images.map(i => i.id);
            record.imageOriginalMeta = images.map(i => ({name: i.name, type: i.type}));
        }
    }

    // add to the newest list; if it changed meanwhile (another device), read it again first
    for (let attempt = 0; ; attempt++) {
        if (attempt > 6) throw fail('雲端的購物紀錄一直在變動，請稍後再按一次。', 'BUSY');
        const now = await meta();
        if (stampOf(now) !== stampOf(before)) {
            before = now; textNow = await download(); list = parse(textNow);
            continue;
        }
        const fresh = records.filter(({record}) => !list.some(i => String(i?.id) === String(record.id)));
        const out = JSON.stringify(list.concat(fresh.map(r => r.record)));
        await weeklyBackup(drive, textNow, cache);
        const check = await meta();
        if (stampOf(check) !== stampOf(before) && attempt < 3) {before = check; textNow = await download(); list = parse(textNow); continue;}
        await drive.http(UPLOAD + '/files/' + encodeURIComponent(fileId) + '?uploadType=media', {method: 'PATCH', headers: {'Content-Type': 'text/plain; charset=utf-8'}, body: out});
        break;
    }
    return {added: records.map(({record}) => ({id: record.id, name: record.name, pictures: (record.image || []).length})), skipped};
}

async function weeklyBackup(drive, textNow, cache) {
    const week = weekLabel();
    if (cache.backupWeek === week || !textNow || textNow === '[]') return;
    try {
        const roots = await drive.list("name='" + q(WORKSPACE_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false", 'id,createdTime', 'createdTime');
        const parent = roots[0]?.id;
        const found = await drive.list("name='" + q(BACKUP_FOLDER_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false" + (parent ? " and '" + parent + "' in parents" : ''), 'id,createdTime', 'createdTime');
        const folder = found[0]?.id || (await drive.createFolder(BACKUP_FOLDER_NAME, parent ? [parent] : undefined)).id;
        const name = '購物紀錄_' + week + '.json';
        const existing = await drive.list("name='" + q(name) + "' and '" + folder + "' in parents and trashed=false");
        if (!existing.length) await drive.uploadNew({name, mimeType: 'application/json', parents: [folder], description: '購物紀錄每週備份（這週第一次修改前的內容）'}, new Blob([textNow], {type: 'application/json'}));
        const all = await drive.list("'" + folder + "' in parents and trashed=false", 'id,name,createdTime', 'createdTime desc');
        for (const old of all.filter(f => /^購物紀錄_\d{4}-W\d{2}\.json$/.test(f.name)).slice(BACKUP_KEEP)) {
            await drive.api('/files/' + encodeURIComponent(old.id) + '?fields=id', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({trashed: true})}).catch(() => {});
        }
        cache.backupWeek = week;
    } catch (error) {
        console.warn('每週備份失敗，下次再試：', error);
    }
}
