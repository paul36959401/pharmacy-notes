/* 購物紀錄 (shopping.html) — part of 藥學筆記雲端.
 *
 * Same data as the old 購物紀錄網站 HTML file, read and written directly with the owner's
 * Google sign-in (the old public Apps Script address is no longer needed):
 *  - 敗家紀錄雲端備份.json : the product list, with small pictures inside (same format).
 *  - 購物紀錄網站圖片       : folder with the full-size pictures.
 * Before the first change of each week the list is copied to
 * 藥學筆記雲端工作台／購物紀錄備份 (the newest 8 copies are kept).
 * Fields the old site did not have: note (備註), paymentDate (補款日期), balance (尾款金額),
 * currency ('JPY' / 'CNY'; empty = 台幣). Unknown fields are always kept as they are.
 * The 購物紀錄小幫手 browser extension (extension/) saves straight to the same Drive file and
 * tells an open 購物紀錄 page to reload (event 'nd-shopping-saved').
 */
(() => {
    'use strict';
    const config = window.NOTE_SITE_CONFIG;
    const release = String(config.release || '');
    const DATA_FILE_NAME = '敗家紀錄雲端備份.json';
    const IMAGE_FOLDER_NAME = '購物紀錄網站圖片';
    const WORKSPACE_NAME = '藥學筆記雲端工作台';
    const BACKUP_FOLDER_NAME = '購物紀錄備份';
    const BACKUP_KEEP = 8;
    const API = 'https://www.googleapis.com/drive/v3';
    const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
    const FOLDER = 'application/vnd.google-apps.folder';
    const DELIVERIES = ['補款', '取貨付款', '純取貨', '寄到家', '集運倉'];
    const DELIVERY_ORDER = {'補款': 1, '取貨付款': 2, '純取貨': 3, '寄到家': 4, '集運倉': 5};
    const DELIVERY_CLASS = {'補款': 'bg-balance', '取貨付款': 'bg-pickup-pay', '純取貨': 'bg-pickup-only', '寄到家': 'bg-home', '集運倉': 'bg-warehouse'};
    const CURRENCY_LABEL = {JPY: '日幣', CNY: '人民幣'};
    const $ = id => document.getElementById(id);
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const defaultImg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'%3E%3Crect width='100%25' height='100%25' fill='%23f0f2f5'/%3E%3Ctext x='50%25' y='50%25' font-size='40' text-anchor='middle' dominant-baseline='middle' opacity='0.3'%3E📦%3C/text%3E%3C/svg%3E";

    /* ================= small helpers ================= */
    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[ch]));
    const idsEqual = (a, b) => String(a) === String(b);
    const fail = (message, code = 'DRIVE') => Object.assign(new Error(message), {code});
    const q = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    function parseMaybeJson(value) {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) return value;
        try {return JSON.parse(trimmed);} catch (_) {return value;}
    }
    /* Same text for the same content, whatever the order of the keys. */
    function canonical(value) {
        if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
        if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
        return JSON.stringify(value ?? null);
    }
    function amountText(value) {
        const s = String(value ?? '').replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^0-9.]/g, '');
        const [whole, ...rest] = s.split('.');
        const decimals = rest.join('').slice(0, 2);
        return whole || decimals ? (whole || '0') + (decimals ? '.' + decimals : '') : '';
    }
    function formatMoney(value, currency) {
        const amount = amountText(value);
        if (!amount) return '-';
        const [whole, decimals] = amount.split('.');
        const text = Number(whole).toLocaleString('en-US') + (decimals ? '.' + decimals : '');
        if (currency === 'JPY' || currency === 'CNY') return '¥' + text + '（' + CURRENCY_LABEL[currency] + '）';
        return '$' + text;
    }
    function formatDate(value) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (!m) return String(value || '');
        return (Number(m[1]) === new Date().getFullYear() ? '' : m[1] + '/') + Number(m[2]) + '/' + Number(m[3]);
    }
    function sanitizeName(value, max = 80) {
        return String(value || '商品圖片').replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, max) || '商品圖片';
    }
    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob);});
    }
    async function dataUrlToBlob(dataUrl) {return (await fetch(dataUrl)).blob();}

    /* ================= this device's copy (IndexedDB) ================= */
    const local = (() => {
        let job = null;
        const open = () => job ||= new Promise(resolve => {
            try {
                const request = indexedDB.open('nd-shopping', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('kv');
                request.onsuccess = () => resolve(request.result);
                request.onerror = request.onblocked = () => resolve(null);
            } catch (_) {resolve(null);}
        });
        async function run(mode, fn) {
            const db = await open(); if (!db) return null;
            return new Promise(resolve => {
                try {
                    const tx = db.transaction('kv', mode), request = fn(tx.objectStore('kv'));
                    tx.oncomplete = () => resolve(request?.result ?? null); tx.onerror = tx.onabort = () => resolve(null);
                } catch (_) {resolve(null);}
            });
        }
        return {
            get: key => run('readonly', store => store.get(key)),
            set: (key, value) => run('readwrite', store => store.put(value, key)),
            del: key => run('readwrite', store => store.delete(key)),
            keys: () => run('readonly', store => store.getAllKeys())
        };
    })();

    /* ================= Google Drive ================= */
    async function http(url, options = {}, attempt = 0) {
        if (navigator.onLine === false) throw fail('目前沒有網路。修改會先存在這台裝置，連上網路後自動上傳。', 'NETWORK');
        const token = await noteAuth.getToken();
        let response;
        try {
            response = await fetch(url, {...options, headers: {Authorization: 'Bearer ' + token, ...(options.headers || {})}});
        } catch (_) {
            if (attempt < 2) {await sleep(800 * (attempt + 1)); return http(url, options, attempt + 1);}
            throw fail('無法連線到 Google Drive，請檢查網路。', 'NETWORK');
        }
        if (response.status === 401 && attempt === 0) {noteAuth.invalidate(); return http(url, options, 1);}
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
            await sleep(1000 * 2 ** attempt + Math.random() * 400);
            return http(url, options, attempt + 1);
        }
        if (!response.ok) {
            let detail = '';
            try {detail = (await response.json()).error?.message || '';} catch (_) {}
            throw fail('Google Drive 回覆 ' + response.status + (detail ? '：' + detail.slice(0, 160) : ''), response.status === 404 ? 'NOT_FOUND' : 'DRIVE');
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
    async function createFolder(name, parents) {
        return api('/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, mimeType: FOLDER, ...(parents ? {parents} : {})})});
    }
    async function uploadNew(metadata, blob) {
        const boundary = 'nd' + crypto.randomUUID().replace(/-/g, '');
        const body = new Blob([
            '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: ' + (metadata.mimeType || blob.type || 'application/octet-stream') + '\r\n\r\n',
            blob, '\r\n--' + boundary + '--'
        ]);
        return (await http(UPLOAD + '/files?uploadType=multipart&fields=id,name,mimeType,size', {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + boundary}, body})).json();
    }
    const stampOf = meta => meta ? String(meta.modifiedTime || '') + '|' + String(meta.md5Checksum || meta.size || '') : '';

    const drive = {
        fileId: '', imageFolderId: '', backupFolderId: '',
        async locate() {
            const saved = localStorage.getItem('nd-shop-file') || '';
            const found = (await list("name='" + q(DATA_FILE_NAME) + "' and trashed=false", 'id,name,mimeType,modifiedTime', 'modifiedTime desc'))
                .filter(f => f.mimeType !== FOLDER);
            let file = found.find(f => f.id === saved) || found[0];
            if (!file) {
                // First use without the old site: start an empty list in My Drive.
                file = await uploadNew({name: DATA_FILE_NAME, mimeType: 'text/plain'}, new Blob(['[]'], {type: 'text/plain'}));
            }
            this.fileId = file.id;
            try {localStorage.setItem('nd-shop-file', file.id);} catch (_) {}
            return file.id;
        },
        meta() {return api('/files/' + encodeURIComponent(this.fileId) + '?fields=id,modifiedTime,size,md5Checksum');},
        async download() {return (await http(API + '/files/' + encodeURIComponent(this.fileId) + '?alt=media', {cache: 'no-store'})).text();},
        async upload(text) {
            await http(UPLOAD + '/files/' + encodeURIComponent(this.fileId) + '?uploadType=media', {method: 'PATCH', headers: {'Content-Type': 'text/plain; charset=utf-8'}, body: text});
        },
        async imageFolder(create = false) {
            if (this.imageFolderId) return this.imageFolderId;
            const folders = await list("name='" + q(IMAGE_FOLDER_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false", 'id,createdTime', 'createdTime');
            if (folders[0]) return this.imageFolderId = folders[0].id;
            if (!create) return '';
            return this.imageFolderId = (await createFolder(IMAGE_FOLDER_NAME)).id;
        },
        async backupFolder() {
            if (this.backupFolderId) return this.backupFolderId;
            const roots = await list("name='" + q(WORKSPACE_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false", 'id,createdTime', 'createdTime');
            const parent = roots[0]?.id;
            const query = "name='" + q(BACKUP_FOLDER_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false" + (parent ? " and '" + parent + "' in parents" : '');
            const found = await list(query, 'id,createdTime', 'createdTime');
            return this.backupFolderId = found[0]?.id || (await createFolder(BACKUP_FOLDER_NAME, parent ? [parent] : undefined)).id;
        }
    };

    /* Weekly copy of the list as it was before this week's first change. */
    function weekLabel(date = new Date()) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return d.getUTCFullYear() + '-W' + String(Math.ceil(((d - yearStart) / 86400000 + 1) / 7)).padStart(2, '0');
    }
    async function weeklyBackup(text) {
        const week = weekLabel();
        if (localStorage.getItem('nd-shop-backup') === week || !text || text === '[]') return;
        try {
            const folder = await drive.backupFolder();
            const name = '購物紀錄_' + week + '.json';
            const existing = await list("name='" + q(name) + "' and '" + folder + "' in parents and trashed=false");
            if (!existing.length) await uploadNew({name, mimeType: 'application/json', parents: [folder], description: '購物紀錄每週備份（這週第一次修改前的內容）'}, new Blob([text], {type: 'application/json'}));
            const all = await list("'" + folder + "' in parents and trashed=false", 'id,name,createdTime', 'createdTime desc');
            for (const old of all.filter(f => /^購物紀錄_\d{4}-W\d{2}\.json$/.test(f.name)).slice(BACKUP_KEEP)) {
                await api('/files/' + encodeURIComponent(old.id) + '?fields=id', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({trashed: true})}).catch(() => {});
            }
            localStorage.setItem('nd-shop-backup', week);
        } catch (error) {
            console.warn('購物紀錄每週備份失敗，下次修改時再試：', error);
        }
    }

    /* ================= pictures ================= */
    function normalizeImageData(raw, settings = {}, originalRaw = '', originalMeta = {}, visibility = true, originalId = '') {
        raw = parseMaybeJson(raw);
        settings = parseMaybeJson(settings) || {};
        originalRaw = parseMaybeJson(originalRaw);
        originalMeta = parseMaybeJson(originalMeta) || {};
        originalId = parseMaybeJson(originalId);
        const sourceObj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        const originalObj = originalRaw && typeof originalRaw === 'object' && !Array.isArray(originalRaw) ? originalRaw : {};
        const src = typeof raw === 'string' ? raw : (sourceObj.src || sourceObj.data || sourceObj.url || sourceObj.image || '');
        const originalSrc = typeof originalRaw === 'string' ? originalRaw : (originalObj.originalSrc || originalObj.src || sourceObj.originalSrc || sourceObj.original || '');
        const fileId = typeof originalId === 'string' ? originalId : (originalId?.id || originalObj.originalFileId || sourceObj.originalFileId || sourceObj.fileId || '');
        const x = Number(sourceObj.x ?? sourceObj.positionX ?? settings.x ?? settings.positionX ?? 50);
        const y = Number(sourceObj.y ?? sourceObj.positionY ?? settings.y ?? settings.positionY ?? 50);
        const zoom = Number(sourceObj.zoom ?? sourceObj.scale ?? settings.zoom ?? settings.scale ?? 1);
        const rawVisible = sourceObj.visible ?? sourceObj.isVisible ?? settings.visible ?? settings.isVisible ?? visibility;
        const visible = !(rawVisible === false || rawVisible === 0 || rawVisible === '0' || String(rawVisible).toLowerCase() === 'false');
        return {
            src,
            originalSrc: originalSrc || (!fileId ? src : ''),
            originalFileId: fileId || '',
            originalName: originalMeta.name || sourceObj.originalName || '',
            originalType: originalMeta.type || sourceObj.originalType || '',
            x: clamp(Number.isFinite(x) ? x : 50, 0, 100),
            y: clamp(Number.isFinite(y) ? y : 50, 0, 100),
            zoom: clamp(Number.isFinite(zoom) ? zoom : 1, 0.35, 3),
            visible
        };
    }
    function asList(value, keepEmpty = false) {
        value = parseMaybeJson(value);
        if (Array.isArray(value)) return value;
        if (keepEmpty) return value === '' || value == null ? [] : [value];
        return value ? [value] : [];
    }
    function getItemImages(item) {
        const raw = asList(item.image ?? item.images ?? item.imageData ?? []);
        const settings = asList(item.imageSettings ?? item.imagesSettings ?? []);
        const originals = asList(item.imageOriginals ?? item.originalImages ?? []);
        const ids = asList(item.imageOriginalIds ?? item.originalImageIds ?? []);
        const meta = asList(item.imageOriginalMeta ?? item.originalImageMeta ?? []);
        const visibility = asList(item.imageVisibility ?? item.imagesVisibility ?? [], true);
        return raw.map((r, i) => normalizeImageData(r, settings[i] || {}, originals[i] || '', meta[i] || {}, visibility[i] ?? true, ids[i] || ''))
            .filter(img => typeof img.src === 'string' && img.src.trim());
    }
    const IMAGE_KEYS = ['image', 'images', 'imageData', 'imageSettings', 'imagesSettings', 'imageOriginals', 'originalImages', 'imageOriginalIds', 'originalImageIds', 'imageOriginalMeta', 'originalImageMeta', 'imageVisibility', 'imagesVisibility'];
    function applyImages(item, images) {
        for (const key of IMAGE_KEYS) delete item[key];
        item.image = images.map(img => img.src);
        item.imageSettings = images.map(img => ({x: img.x, y: img.y, zoom: img.zoom}));
        item.imageOriginalIds = images.map(img => img.originalFileId || '');
        item.imageOriginals = images.map(img => img.originalFileId ? null : (img.originalSrc || img.src));
        item.imageOriginalMeta = images.map(img => ({name: img.originalName || '', type: img.originalType || ''}));
        item.imageVisibility = images.map(img => img.visible !== false);
        return item;
    }
    const imageCssVars = img => '--image-x:' + img.x + '%;--image-y:' + img.y + '%;--image-zoom:' + img.zoom + ';';
    function compressImage(dataUrl) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
                const maxSide = 520;
                if (w > maxSide || h > maxSide) {
                    if (w > h) {h *= maxSide / w; w = maxSide;} else {w *= maxSide / h; h = maxSide;}
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(w)); canvas.height = Math.max(1, Math.round(h));
                const ctx = canvas.getContext('2d', {alpha: false});
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.66));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }
    function extensionFor(img) {
        const byName = String(img.originalName || '').match(/\.([a-zA-Z0-9]{2,5})$/);
        if (byName) return byName[1].toLowerCase() === 'jpeg' ? 'jpg' : byName[1].toLowerCase();
        const type = String(img.originalType || (String(img.originalSrc || img.src || '').match(/^data:image\/([^;,]+)/i) || [])[1] || '').toLowerCase();
        if (type.includes('png')) return 'png';
        if (type.includes('webp')) return 'webp';
        if (type.includes('gif')) return 'gif';
        return 'jpg';
    }
    async function uploadOriginal(img, label, productName) {
        if (img.originalFileId) return img.originalFileId;
        const source = img.originalSrc || img.src;
        if (!source || !source.startsWith('data:image/')) throw new Error('第 ' + (label || '?') + ' 張圖片沒有可上傳的原圖。');
        const blob = await dataUrlToBlob(source);
        if (blob.size > 25 * 1024 * 1024) throw new Error('圖片超過 25 MB，請先縮小後再貼上。');
        const type = img.originalType && img.originalType.startsWith('image/') ? img.originalType : (blob.type || 'image/jpeg');
        const name = sanitizeName(img.originalName || sanitizeName(productName || '商品') + '_' + (label || Date.now()) + '.' + extensionFor(img), 180);
        const folder = await drive.imageFolder(true);
        const result = await uploadNew({name, mimeType: type, parents: [folder], description: '購物紀錄網站高清原圖｜建立時間：' + new Date().toISOString()}, blob);
        img.originalFileId = result.id;
        img.originalName = result.name || name;
        img.originalType = result.mimeType || type;
        img.originalSrc = '';
        void local.set('orig:' + result.id, {blob, usedAt: Date.now()});
        return result.id;
    }
    async function originalBlob(img) {
        if (!img) throw new Error('找不到圖片。');
        if (img.originalSrc && img.originalSrc.startsWith('data:image/')) return dataUrlToBlob(img.originalSrc);
        if (!img.originalFileId) return dataUrlToBlob(img.src);
        const cached = await local.get('orig:' + img.originalFileId);
        if (cached?.blob instanceof Blob) {void local.set('orig:' + img.originalFileId, {blob: cached.blob, usedAt: Date.now()}); return cached.blob;}
        const blob = await (await http(API + '/files/' + encodeURIComponent(img.originalFileId) + '?alt=media')).blob();
        await local.set('orig:' + img.originalFileId, {blob, usedAt: Date.now()});
        void pruneOriginalCache();
        return blob;
    }
    async function pruneOriginalCache() {
        const keys = (await local.keys() || []).filter(k => String(k).startsWith('orig:'));
        if (keys.length <= 60) return;
        const entries = [];
        for (const key of keys) entries.push([key, (await local.get(key))?.usedAt || 0]);
        entries.sort((a, b) => a[1] - b[1]);
        for (const [key] of entries.slice(0, keys.length - 60)) await local.del(key);
    }
    async function deleteCloudImages(ids) {
        const unique = [...new Set((ids || []).filter(Boolean))];
        if (!unique.length) return;
        try {
            const folder = await drive.imageFolder();
            for (const id of unique) {
                try {
                    const meta = await api('/files/' + encodeURIComponent(id) + '?fields=id,parents');
                    if (!folder || !(meta.parents || []).includes(folder)) continue;   // only pictures of this site
                    await api('/files/' + encodeURIComponent(id) + '?fields=id', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({trashed: true})});
                    await local.del('orig:' + id);
                } catch (_) {}
            }
        } catch (_) {
            // A leftover picture does not affect the records.
        }
    }
    /* ================= records ================= */
    /* The stored form of a record: like the old site's compact form, but every field the
       page does not know about is kept as it is. */
    function compactItem(item) {
        const out = {id: item.id, name: item.name || '', delivery: item.delivery || ''};
        for (const [key, value] of Object.entries(item)) {
            if (key in out || IMAGE_KEYS.includes(key) || key === 'isCompleted' || key === 'completedAt' || key === 'archiveOrder') continue;
            if (value === '' || value == null) continue;
            out[key] = value;
        }
        if (item.isCompleted) {
            out.isCompleted = true;
            if (Number.isFinite(Number(item.completedAt)) && item.completedAt !== '' && item.completedAt != null) out.completedAt = Number(item.completedAt);
            if (Number.isFinite(Number(item.archiveOrder)) && item.archiveOrder !== '' && item.archiveOrder != null) out.archiveOrder = Number(item.archiveOrder);
        }
        const images = getItemImages(item);
        if (images.length) {
            out.image = images.map(img => img.src);
            const settings = images.map(img => {
                const s = {};
                if (Math.abs(img.x - 50) > 0.001) s.x = img.x;
                if (Math.abs(img.y - 50) > 0.001) s.y = img.y;
                if (Math.abs(img.zoom - 1) > 0.001) s.zoom = img.zoom;
                return Object.keys(s).length ? s : null;
            });
            if (settings.some(Boolean)) out.imageSettings = settings;
            const ids = images.map(img => img.originalFileId || null);
            if (ids.some(Boolean)) out.imageOriginalIds = ids;
            const pending = images.map(img => img.originalFileId || !img.originalSrc || img.originalSrc === img.src ? null : img.originalSrc);
            if (pending.some(Boolean)) out.imageOriginals = pending;
            const meta = images.map(img => {
                const m = {};
                if (img.originalName) m.name = img.originalName;
                if (img.originalType) m.type = img.originalType;
                return Object.keys(m).length ? m : null;
            });
            if (meta.some(Boolean)) out.imageOriginalMeta = meta;
            const visibility = images.map(img => img.visible !== false);
            if (visibility.some(v => v === false)) out.imageVisibility = visibility;
        }
        return out;
    }
    const serialize = items => JSON.stringify(items.map(compactItem));
    function parseList(text) {
        let data;
        try {data = JSON.parse(text || '[]');} catch (_) {throw new Error('雲端的購物紀錄檔不是有效的資料，請先不要修改，並告訴 Claude。');}
        if (!Array.isArray(data)) throw new Error('雲端的購物紀錄檔格式不正確，請先不要修改，並告訴 Claude。');
        return data.filter(item => item && typeof item === 'object');
    }
    /* Combine this device's changes with changes made elsewhere since the last sync.
       A record changed here wins; a record changed only elsewhere is taken from there;
       records added on either side are kept; a deletion is applied unless the other side
       changed that record. */
    function merge(base, mine, theirs) {
        const key = item => String(item.id);
        const sig = item => canonical(compactItem(item));
        const baseMap = new Map(base.map(i => [key(i), sig(i)]));
        const theirMap = new Map(theirs.map(i => [key(i), i]));
        const mineKeys = new Set(mine.map(key));
        const out = [];
        for (const item of mine) {
            const k = key(item), b = baseMap.get(k), other = theirMap.get(k);
            const changedHere = b === undefined || sig(item) !== b;
            if (other) out.push(changedHere ? item : other);
            else if (b === undefined || changedHere) out.push(item);   // new here, or changed here after a deletion elsewhere
        }
        theirs.forEach((item, index) => {
            const k = key(item);
            if (mineKeys.has(k)) return;
            const b = baseMap.get(k);
            if (b !== undefined && sig(item) === b) return;   // deleted here
            let at = 0;
            for (let i = index - 1; i >= 0; i--) {
                const pos = out.findIndex(x => key(x) === key(theirs[i]));
                if (pos >= 0) {at = pos + 1; break;}
            }
            out.splice(at, 0, item);
        });
        return out;
    }
    function archiveKey(item) {
        for (const value of [item?.archiveOrder, item?.completedAt, item?.id]) {
            const n = Number(value);
            if (value !== '' && value != null && Number.isFinite(n)) return n;
        }
        return 0;
    }
    function compareArchive(a, b) {return (archiveKey(b) - archiveKey(a)) || (Number(b?.id || 0) - Number(a?.id || 0));}
    function nextArchiveOrder(items) {
        const max = items.filter(i => i?.isCompleted).reduce((m, i) => Math.max(m, archiveKey(i)), 0);
        return Math.max(max + 1, Date.now());
    }
    function sortItems(items) {
        return items.sort((a, b) => {
            if (!!a.isCompleted !== !!b.isCompleted) return a.isCompleted ? 1 : -1;
            if (a.isCompleted && b.isCompleted) return compareArchive(a, b);
            const mA = a.month || '0000-00', mB = b.month || '0000-00';
            if (mA !== mB) return mA.localeCompare(mB);
            return (DELIVERY_ORDER[a.delivery] || 99) - (DELIVERY_ORDER[b.delivery] || 99);
        });
    }
    let lastId = 0;
    function newId() {
        let id = Date.now();
        if (id <= lastId) id = lastId + 1;
        while (state.items.some(i => idsEqual(i.id, id))) id++;
        return lastId = id;
    }

    /* ================= sync ================= */
    const state = {items: [], base: [], baseText: '[]', stamp: '', dirty: false, ready: false, loadedFromCloud: false};
    let pushTimer = null, pushing = null, pushQueued = false, pulling = null, lastCheck = 0;

    /* The cloud button shows the state by colour (like the notes); the words are in its
       hover note, and an error or notice also pops up once at the bottom. */
    let lastNotice = '';
    function setStatus(kind, text, notify = kind === 'error') {
        const el = $('syncStatus');
        el.dataset.syncState = kind === 'synced' ? 'success' : kind;
        el.dataset.toolDetail = text.replace(/^[^\p{L}\p{N}]+/u, '');
        $('syncText').textContent = text;
        if (notify && text !== lastNotice) toast(el.dataset.toolDetail);
        lastNotice = notify ? text : '';
    }
    async function persistLocal() {
        await local.set('state', {items: state.items, baseText: state.baseText, stamp: state.stamp, dirty: state.dirty, fileId: drive.fileId, savedAt: Date.now()});
    }
    async function loadLocal() {
        const saved = await local.get('state');
        if (!saved || !Array.isArray(saved.items)) return false;
        state.items = saved.items;
        state.baseText = saved.baseText || '[]';
        try {state.base = JSON.parse(state.baseText);} catch (_) {state.base = [];}
        state.stamp = saved.stamp || '';
        state.dirty = !!saved.dirty;
        if (saved.fileId && !drive.fileId) drive.fileId = saved.fileId;
        return true;
    }
    async function pull({quiet = false} = {}) {
        if (pulling) return pulling;
        pulling = (async () => {
            lastCheck = Date.now();
            if (!quiet) setStatus('syncing', '☁️ 同步雲端紀錄中…');
            try {
                const meta = await drive.meta();
                const stamp = stampOf(meta);
                if (stamp !== state.stamp) {
                    const text = await drive.download();
                    const remote = parseList(text);
                    if (state.dirty) {
                        state.items = merge(state.base, state.items, parseList(text));
                    } else {
                        state.items = parseList(text);
                    }
                    state.base = remote; state.baseText = text; state.stamp = stamp;
                    state.loadedFromCloud = true;
                    await persistLocal();
                    render();
                }
                state.loadedFromCloud = true;
                if (state.dirty) schedulePush(true);
                else setStatus('synced', '🟢 雲端同步成功');
            } catch (error) {
                setStatus('error', '🔴 ' + (error.code === 'NETWORK' ? '離線中：顯示這台裝置上的紀錄' : (error.message || '同步失敗')));
                if (!state.loadedFromCloud) throw error;
            } finally {pulling = null;}
        })();
        return pulling;
    }
    function schedulePush(immediate = false) {
        if (pushTimer !== null) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => {pushTimer = null; void push();}, immediate ? 0 : 550);
    }
    async function push() {
        if (pushing) {pushQueued = true; return pushing;}
        if (!drive.fileId || !state.loadedFromCloud) return;
        pushing = (async () => {
            setStatus('syncing', '⬆️ 備份至雲端…');
            try {
                const meta = await drive.meta();
                if (stampOf(meta) !== state.stamp) {
                    // Someone (another device) saved in the meantime: combine first.
                    const text = await drive.download();
                    state.items = merge(state.base, state.items, parseList(text));
                    state.base = parseList(text); state.baseText = text; state.stamp = stampOf(meta);
                    render();
                }
                const payload = serialize(state.items);
                if (payload === state.baseText) {
                    state.dirty = false; await persistLocal();
                    setStatus('synced', '🟢 已是最新');
                    return;
                }
                await weeklyBackup(state.baseText);
                await drive.upload(payload);
                const after = await drive.meta();
                state.stamp = stampOf(after); state.baseText = payload; state.base = JSON.parse(payload); state.dirty = false;
                await persistLocal();
                setStatus('synced', '🟢 已自動備份');
            } catch (error) {
                setStatus('error', '🔴 ' + (error.code === 'NETWORK' ? '離線中：修改已存在這台裝置，連上網路後自動上傳' : '備份失敗：' + (error.message || '')));
            } finally {
                pushing = null;
                if (pushQueued) {pushQueued = false; setTimeout(() => void push(), 120);}
            }
        })();
        return pushing;
    }
    /* Every change: keep it on this device at once, then upload. */
    async function commit({immediate = false, sort = false} = {}) {
        if (sort) sortItems(state.items);
        state.dirty = true;
        render();
        await persistLocal();
        schedulePush(immediate);
    }
    function checkForChanges() {
        if (!state.ready || document.hidden || pushing || pulling || Date.now() - lastCheck < 20000) return;
        void pull({quiet: true}).catch(() => {});
    }
    document.addEventListener('visibilitychange', checkForChanges);
    window.addEventListener('focus', checkForChanges);
    window.addEventListener('online', () => {if (state.ready) void pull().catch(() => {});});
    window.addEventListener('beforeunload', event => {
        if (state.dirty && (pushing || pushTimer !== null) && navigator.onLine !== false) {event.preventDefault(); event.returnValue = '';}
    });

    /* ================= list ================= */
    let previewMode = false;
    function render() {
        const fMonth = $('filterMonth').value, fDeliv = $('filterDelivery').value, fStatus = $('filterStatus').value;
        const query = $('searchInput').value.trim().toLowerCase();
        $('clearFiltersBtn').hidden = !(fMonth || fDeliv !== 'all' || fStatus !== 'all' || query);
        const items = state.items.filter(i => (!fMonth || i.month === fMonth)
            && (fDeliv === 'all' || (i.delivery || '') === fDeliv)
            && (fStatus === 'all' || (fStatus === 'completed' ? i.isCompleted : !i.isCompleted))
            && (!query || [i.name, i.address, i.note, i.url].join(' ').toLowerCase().includes(query)));
        const container = $('itemList');
        container.innerHTML = '';
        if (!items.length) {
            container.innerHTML = '<div class="empty-state">' + (query ? '找不到「' + escapeHtml(query) + '」的紀錄。' : state.loadedFromCloud || state.items.length ? '目前沒有符合條件的紀錄喔！' : '正在讀取購物紀錄…') + '</div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        const active = items.filter(i => !i.isCompleted), archive = items.filter(i => i.isCompleted);
        if (active.length) {
            const groups = {};
            active.forEach(i => {const m = i.month || '未設定'; (groups[m] ||= []).push(i);});
            Object.keys(groups).sort((a, b) => a === '未設定' ? -1 : b === '未設定' ? 1 : a.localeCompare(b)).forEach(m => {
                const h = document.createElement('div');
                h.className = m === '未設定' ? 'month-header pinned' : 'month-header';
                h.textContent = m === '未設定' ? '📌 特別關注 / 待確認到貨' : '📅 ' + m.split('-')[0] + ' 年 ' + m.split('-')[1] + ' 月';
                fragment.append(h);
                groups[m].forEach(item => fragment.append(createCard(item)));
            });
        }
        if (archive.length) {
            const h = document.createElement('div');
            h.className = 'month-header archive';
            h.innerHTML = '<span>📜 歷史完成存檔 (' + archive.length + ' 筆)</span><small>(已收貨之項目)</small>';
            fragment.append(h);
            archive.sort(compareArchive).forEach(item => fragment.append(createCard(item)));
        }
        container.append(fragment);
    }
    function createCard(item) {
        const imgs = getItemImages(item).filter(img => img.visible !== false);
        const gallery = imgs.length
            ? imgs.map((img, i) => '<div class="gallery-frame"><img src="' + escapeHtml(img.src) + '" style="' + imageCssVars(img) + '" alt="' + escapeHtml(item.name || '商品') + ' 圖片 ' + (i + 1) + '" loading="lazy" decoding="async"></div>').join('')
            : '<div class="gallery-frame"><img src="' + defaultImg + '" alt="無商品圖片" loading="lazy" decoding="async"></div>';
        const count = imgs.length || 1;
        const delivery = item.delivery || '';
        const badgeClass = DELIVERY_CLASS[delivery] || 'bg-unknown';
        const link = item.url
            ? '<a href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" class="item-link">🔗 前往購買頁面</a>'
            : '<div class="no-link">🔗 未提供網址</div>';
        const payment = item.paymentDate || amountText(item.balance)
            ? '<p class="item-meta item-payment" title="補款日期與尾款金額">🧾 ' + [item.paymentDate ? '補款 ' + escapeHtml(formatDate(item.paymentDate)) : '', amountText(item.balance) ? '尾款 ' + escapeHtml(formatMoney(item.balance, item.currency)) : ''].filter(Boolean).join('・') + '</p>'
            : '';
        const note = item.note ? '<p class="item-note" title="' + escapeHtml(item.note) + '">📝 ' + escapeHtml(item.note) + '</p>' : '';
        const div = document.createElement('div');
        div.className = 'item-card' + (item.isCompleted ? ' is-completed' : '');
        div.dataset.itemId = String(item.id);
        div.innerHTML =
            '<div class="image-gallery-container gallery-count-' + Math.min(count, 4) + '"><div class="image-gallery ' + (count <= 4 ? 'gallery-' + count : 'gallery-more') + '">' + gallery + '</div></div>' +
            '<div class="item-details">' +
            '<h3 class="item-title" title="' + escapeHtml(item.name || '') + '">' + escapeHtml(item.name) + '</h3>' +
            '<div class="delivery-badge ' + badgeClass + '">' + escapeHtml(delivery || '待選付款／取貨') + '</div>' +
            '<div class="item-info-stack">' +
            '<div class="address-badge" title="' + escapeHtml(item.address || '-') + '">📍 ' + escapeHtml(item.address || '-') + '</div>' +
            '<p class="item-meta">💰 金額：' + escapeHtml(formatMoney(item.price, item.currency)) + '</p>' +
            payment + note + link +
            '</div></div>' +
            '<div class="card-actions"><button type="button" class="' + (item.isCompleted ? 'btn-uncomplete' : 'btn-complete') + '">' + (item.isCompleted ? '還原' : '確認收貨') + '</button>' +
            '<div class="action-group-right"><button type="button" class="btn-delete">刪除</button></div></div>';
        div.querySelector(item.isCompleted ? '.btn-uncomplete' : '.btn-complete').addEventListener('click', event => {event.stopPropagation(); toggleComplete(item.id);});
        div.querySelector('.btn-delete').addEventListener('click', event => {event.stopPropagation(); void deleteItem(item.id);});
        // Double-click an empty part of the card to edit it.
        div.addEventListener('dblclick', event => {
            if (previewMode || event.button !== 0 || event.target.closest('button, a, input, select, textarea, label')) return;
            event.preventDefault();
            editItem(item.id);
        });
        return div;
    }
    function findCard(id) {return [...document.querySelectorAll('.item-card')].find(card => idsEqual(card.dataset.itemId, id));}
    function flashCard(card) {
        if (!card) return;
        card.classList.add('just-updated');
        setTimeout(() => card.classList.remove('just-updated'), 1600);
    }
    function toggleComplete(id) {
        if (previewMode) return;
        const item = state.items.find(i => idsEqual(i.id, id));
        if (!item) return;
        if (item.isCompleted) {
            item.isCompleted = false; delete item.completedAt; delete item.archiveOrder;
        } else {
            item.isCompleted = true; item.completedAt = Date.now();
            item.archiveOrder = nextArchiveOrder(state.items);   // newest first in the archive
        }
        void commit({immediate: true});
    }
    async function deleteItem(id) {
        if (previewMode) return;
        if (!confirm('確定要永久刪除這筆購買紀錄嗎？')) return;
        const target = state.items.find(item => idsEqual(item.id, id));
        const imageIds = target ? getItemImages(target).map(img => img.originalFileId).filter(Boolean) : [];
        state.items = state.items.filter(item => !idsEqual(item.id, id));
        await commit({immediate: true});
        void deleteCloudImages(imageIds);
    }
    function forceAutoSort() {
        if (previewMode) return;
        void commit({sort: true});
    }
    function togglePreviewMode(force) {
        previewMode = typeof force === 'boolean' ? force : !previewMode;
        document.body.classList.toggle('preview-mode', previewMode);
        const button = $('previewModeBtn');
        button.classList.toggle('preview-active', previewMode);
        button.setAttribute('aria-pressed', String(previewMode));
        button.dataset.toolLabel = previewMode ? '退出預覽' : '預覽模式';
        button.dataset.toolShort = previewMode ? '返回' : '預覽';
        button.setAttribute('aria-label', button.dataset.toolLabel);
    }
    function clearFilters() {
        $('filterMonth').value = ''; $('filterDelivery').value = 'all'; $('filterStatus').value = 'all'; $('searchInput').value = '';
        render();
    }

    /* ================= form ================= */
    let editingId = null, editReturnPosition = null, currentImages = [], pendingDeletedIds = new Set();
    let formHistoryActive = false, formReturnScrollY = 0, pendingListOptions = null, formSession = 0, popPendingFor = 0;
    let previewDragIndex = null, suppressPreviewClickUntil = 0;
    let editorIndex = null, editorDraft = null, editorPointer = null;

    function setMonthParts(value) {
        const m = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
        $('itemYear').value = m ? m[1] : '';
        $('itemMonthNumber').value = m ? String(Number(m[2])) : '';
        $('itemMonth').value = m ? m[1] + '-' + m[2] : '';
    }
    function syncMonthValue() {
        const year = normalizeDigits($('itemYear').value).slice(0, 4);
        const month = normalizeDigits($('itemMonthNumber').value).slice(0, 2);
        $('itemYear').value = year; $('itemMonthNumber').value = month;
        const n = Number(month);
        $('itemMonth').value = year.length === 4 && n >= 1 && n <= 12 ? year + '-' + String(n).padStart(2, '0') : '';
        return $('itemMonth').value;
    }
    function resetFormState() {
        editingId = null; editReturnPosition = null; pendingDeletedIds = new Set();
        $('addForm').reset();
        $('itemDelivery').value = '取貨付款';
        $('itemCurrency').value = 'TWD';
        setMonthParts('');
        resetImageSelection();
        $('formTitle').textContent = '➕ 新增購買紀錄';
        $('submitBtn').textContent = '儲存資料';
    }
    function showListView(options = {}) {
        const listView = $('listView');
        const {restoreId = null, restoreViewportTop = null, restoreScrollY = null, centerId = null} = options;
        const hide = (restoreId !== null && Number.isFinite(restoreViewportTop)) || Number.isFinite(restoreScrollY) || centerId !== null;
        if (hide) listView.style.visibility = 'hidden';
        listView.classList.add('active');
        $('formView').classList.remove('active');
        document.body.classList.remove('form-open');
        if (restoreId !== null && Number.isFinite(restoreViewportTop)) {
            const card = findCard(restoreId);
            if (card) {window.scrollTo({top: Math.max(0, window.scrollY + card.getBoundingClientRect().top - restoreViewportTop), behavior: 'auto'}); flashCard(card);}
        } else if (centerId !== null) {
            const card = findCard(centerId);
            if (card) {card.scrollIntoView({behavior: 'auto', block: 'center'}); flashCard(card);}
        } else if (Number.isFinite(restoreScrollY)) {
            window.scrollTo({top: Math.max(0, restoreScrollY), behavior: 'auto'});
        }
        if (hide) listView.style.visibility = '';
        formHistoryActive = false; pendingListOptions = null;
        resetFormState();
    }
    function showFormView(options = {}) {
        const fromList = $('listView').classList.contains('active');
        if (fromList) {formReturnScrollY = window.scrollY; formSession++;}
        $('listView').classList.remove('active');
        $('formView').classList.add('active');
        document.body.classList.add('form-open');
        if (fromList && options.pushHistory !== false) {
            try {history.pushState({trackerView: 'form'}, '', location.href); formHistoryActive = true;} catch (_) {formHistoryActive = false;}
        }
        window.scrollTo({top: 0, behavior: 'auto'});
        if (options.focusId) requestAnimationFrame(() => $(options.focusId)?.focus({preventScroll: true}));
    }
    function closeFormView(options = {}) {
        if (!$('formView').classList.contains('active')) return;
        const listOptions = Object.keys(options).length ? options : {restoreScrollY: formReturnScrollY};
        if (formHistoryActive && history.state?.trackerView === 'form') {
            // Leave the form's history entry, so the browser's back button keeps working.
            pendingListOptions = listOptions;
            const session = popPendingFor = formSession;
            history.back();
            setTimeout(() => {if ($('formView').classList.contains('active') && formSession === session) showListView(listOptions);}, 180);
        } else showListView(listOptions);
    }
    window.addEventListener('popstate', () => {
        if (popPendingFor) {
            // The back step started by closeFormView: only act if that same form is still open.
            const session = popPendingFor;
            popPendingFor = 0;
            if ($('formView').classList.contains('active') && formSession === session) showListView(pendingListOptions || {restoreScrollY: formReturnScrollY});
            return;
        }
        if ($('formView').classList.contains('active')) showListView({restoreScrollY: formReturnScrollY});
    });
    function startNewPurchase() {
        if (previewMode || !state.ready) return;
        const open = $('formView').classList.contains('active');
        if (open && editingId === null) {$('itemUrl').focus(); return;}
        if (open && editingId !== null && !confirm('目前正在編輯商品。要放棄尚未儲存的修改，改成新增商品嗎？')) return;
        resetFormState();
        showFormView({focusId: 'itemUrl'});
    }
    function focusQuickField(id) {
        const target = $(id);
        if (!target) return;
        target.focus({preventScroll: false});
        target.classList.add('quick-flow-active');
        setTimeout(() => target.classList.remove('quick-flow-active'), 500);
    }
    function editItem(id, options = {}) {
        if (previewMode) return;
        const card = findCard(id);
        const viewportTop = card ? card.getBoundingClientRect().top : 120;
        const item = state.items.find(x => idsEqual(x.id, id));
        if (!item) return;
        if ($('formView').classList.contains('active')) showListView({});
        editReturnPosition = {id: item.id, viewportTop};
        $('itemName').value = item.name || '';
        setMonthParts(item.month || '');
        $('itemDelivery').value = DELIVERIES.includes(item.delivery) ? item.delivery : '';
        $('itemAddress').value = item.address || '';
        $('itemUrl').value = item.url || '';
        $('itemPrice').value = amountText(item.price);
        $('itemCurrency').value = CURRENCY_LABEL[item.currency] ? item.currency : 'TWD';
        $('itemBalance').value = amountText(item.balance);
        $('itemPaymentDate').value = /^\d{4}-\d{2}-\d{2}$/.test(item.paymentDate || '') ? item.paymentDate : '';
        $('itemNote').value = item.note || '';
        editingId = item.id;
        pendingDeletedIds = new Set();
        currentImages = getItemImages(item).map(img => ({...img}));
        renderPreview();
        $('formTitle').textContent = options.title || '✏️ 編輯購買紀錄';
        $('submitBtn').textContent = '更新資料';
        showFormView({focusId: options.focusId});
    }
    async function submitForm(event) {
        event.preventDefault();
        const button = $('submitBtn');
        const previousText = button.textContent;
        button.disabled = true; button.textContent = '儲存中…';
        try {
            syncMonthValue();
            const productName = $('itemName').value;
            for (let i = 0; i < currentImages.length; i++) {
                if (currentImages[i].originalFileId) continue;
                setStatus('syncing', '⬆️ 上傳高清原圖 ' + (i + 1) + '/' + currentImages.length + '…');
                await uploadOriginal(currentImages[i], i + 1, productName);
            }
            const data = {
                name: productName,
                month: $('itemMonth').value,
                delivery: $('itemDelivery').value,
                address: $('itemAddress').value,
                url: $('itemUrl').value,
                price: amountText($('itemPrice').value),
                currency: $('itemCurrency').value === 'TWD' ? '' : $('itemCurrency').value,
                balance: amountText($('itemBalance').value),
                paymentDate: $('itemPaymentDate').value,
                note: $('itemNote').value.trim()
            };
            applyImages(data, currentImages);
            let savedId;
            const returnPosition = editingId !== null && editReturnPosition && idsEqual(editReturnPosition.id, editingId) ? {...editReturnPosition} : null;
            const existing = editingId !== null ? state.items.find(i => idsEqual(i.id, editingId)) : null;
            if (existing) {
                savedId = existing.id;
                for (const key of IMAGE_KEYS) delete existing[key];
                Object.assign(existing, data);
            } else {
                data.id = newId(); data.isCompleted = false; savedId = data.id;
                state.items.push(data);
            }
            const deletedIds = [...pendingDeletedIds];
            pendingDeletedIds.clear();
            sortItems(state.items);
            render();
            if (returnPosition) closeFormView({restoreId: savedId, restoreViewportTop: returnPosition.viewportTop});
            else closeFormView({centerId: savedId});
            await commit({immediate: true});
            void deleteCloudImages(deletedIds);
        } catch (error) {
            setStatus('error', '🔴 儲存失敗：' + (error.message || ''));
            alert('圖片或商品資料尚未儲存：\n' + (error.message || error));
        } finally {
            button.disabled = false;
            button.textContent = editingId !== null ? '更新資料' : previousText;
        }
    }

    /* Digits keep working while the Chinese input method is on (read from the key position). */
    function normalizeDigits(value, allowDot = false) {
        const s = String(value || '').replace(/[０-９．]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
        if (!allowDot) return s.replace(/[^0-9]/g, '');
        const [whole, ...rest] = s.replace(/[^0-9.]/g, '').split('.');
        return rest.length ? whole + '.' + rest.join('').slice(0, 2) : whole;
    }
    function physicalKey(event, allowDot) {
        const m = /^(?:Digit|Numpad)([0-9])$/.exec(event.code || '');
        if (m) return m[1];
        if (allowDot && (event.code === 'Period' || event.code === 'NumpadDecimal')) return '.';
        if (/^[0-9]$/.test(event.key || '')) return event.key;
        if (/^[０-９]$/.test(event.key || '')) return String(event.key.charCodeAt(0) - 0xFEE0);
        return null;
    }
    function insertAtCursor(input, text, maxLength, allowDot) {
        const current = normalizeDigits(input.value, allowDot);
        const start = Number.isInteger(input.selectionStart) ? input.selectionStart : current.length;
        const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : start;
        const next = normalizeDigits(current.slice(0, start) + text + current.slice(end), allowDot).slice(0, maxLength);
        input.value = next;
        const caret = Math.min(start + text.length, next.length);
        try {input.setSelectionRange(caret, caret);} catch (_) {}
        input.dispatchEvent(new Event('input', {bubbles: true}));
    }
    function digitsOnly(input, {maxLength = Infinity, allowDot = false} = {}) {
        input.addEventListener('keydown', event => {
            const key = physicalKey(event, allowDot);
            if (key === null || event.ctrlKey || event.metaKey || event.altKey) return;
            event.preventDefault(); event.stopPropagation();
            insertAtCursor(input, key, maxLength, allowDot);
        }, true);
        input.addEventListener('beforeinput', event => {
            if (event.inputType?.startsWith('delete') || event.inputType === 'historyUndo' || event.inputType === 'historyRedo') return;
            if (['insertText', 'insertCompositionText', 'insertFromComposition'].includes(event.inputType)) {
                event.preventDefault();
                const text = normalizeDigits(event.data || '', allowDot);
                if (text) insertAtCursor(input, text, maxLength, allowDot);
            }
        });
        input.addEventListener('paste', event => {
            const text = normalizeDigits(event.clipboardData?.getData('text') || '', allowDot);
            if (!text) return;
            event.preventDefault();
            insertAtCursor(input, text, maxLength, allowDot);
        });
        input.addEventListener('input', () => {
            const value = normalizeDigits(input.value, allowDot).slice(0, maxLength);
            if (input.value !== value) input.value = value;
        });
    }
    function bindEnterNext(sourceId, targetId) {
        $(sourceId).addEventListener('keydown', event => {
            if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
            event.preventDefault();
            focusQuickField(targetId);
        });
    }

    /* ================= pictures in the form ================= */
    function renderPreview() {
        const listEl = $('imagePreviewList'), container = $('imagePreviewContainer');
        listEl.innerHTML = '';
        container.style.display = currentImages.length ? 'block' : 'none';
        currentImages.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'preview-item' + (img.visible === false ? ' is-hidden' : '');
            item.draggable = true;
            item.dataset.index = index;
            item.title = '拖曳可調整順序；點圖片可查看原始高清圖';
            item.innerHTML =
                '<button type="button" class="btn-remove-img" draggable="false" data-act="remove" aria-label="刪除第 ' + (index + 1) + ' 張圖片">✖</button>' +
                '<div class="preview-thumb-window" role="button" tabindex="0" aria-label="查看第 ' + (index + 1) + ' 張原始高清圖片">' +
                '<span class="preview-number">第 ' + (index + 1) + ' 張</span>' +
                '<img src="' + escapeHtml(img.src) + '" style="' + imageCssVars(img) + '" alt="商品圖片 ' + (index + 1) + '"></div>' +
                '<div class="preview-item-actions">' +
                '<button type="button" class="btn-image-visibility ' + (img.visible === false ? 'is-hidden' : 'is-visible') + '" draggable="false" data-act="visibility">' + (img.visible === false ? '僅保存，不顯示' : '顯示在商品卡片') + '</button>' +
                '<button type="button" class="btn-image-adjust" draggable="false" data-act="adjust">✥ 調整畫面</button>' +
                '<button type="button" class="btn-image-download" draggable="false" data-act="download">⇩ 下載原圖</button></div>';
            item.addEventListener('click', event => {
                const act = event.target.closest('[data-act]')?.dataset.act;
                if (act === 'remove') removeImg(index);
                else if (act === 'visibility') {currentImages[index].visible = currentImages[index].visible === false; renderPreview();}
                else if (act === 'adjust') openImageEditor(index);
                else if (act === 'download') void downloadImage(index);
            });
            const thumb = item.querySelector('.preview-thumb-window');
            const openViewer = event => {
                if (Date.now() < suppressPreviewClickUntil) return;
                event.preventDefault(); event.stopPropagation();
                void openImageViewer(index);
            };
            thumb.addEventListener('click', openViewer);
            thumb.addEventListener('keydown', event => {if (event.key === 'Enter' || event.key === ' ') openViewer(event);});
            listEl.append(item);
        });
    }
    function removeImg(index) {
        const removed = currentImages[index];
        if (removed?.originalFileId) pendingDeletedIds.add(removed.originalFileId);
        currentImages.splice(index, 1);
        if (editorIndex === index) closeImageEditor(false);
        renderPreview();
    }
    function resetImageSelection() {
        currentImages = []; pendingDeletedIds = new Set();
        closeImageEditor(false);
        renderPreview();
    }
    async function downloadImage(index) {
        const img = currentImages[index];
        if (!img) return;
        try {
            setStatus('syncing', '☁️ 讀取高清原圖…');
            const blob = await originalBlob(img);
            const base = img.originalName ? img.originalName.replace(/\.[^.]+$/, '') : ($('itemName').value || '商品圖片') + '_第' + (index + 1) + '張';
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url; link.download = sanitizeName(base) + '.' + extensionFor(img);
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
            setStatus('synced', '🟢 原圖已準備');
        } catch (error) {
            setStatus('error', '🔴 原圖讀取失敗');
            alert(error.message || '原圖讀取失敗。');
        }
    }
    let viewerUrl = '';
    async function openImageViewer(index) {
        const img = currentImages[index];
        if (!img) return;
        const modal = $('imageViewerModal'), image = $('imageViewerImage'), loading = $('imageViewerLoading');
        image.removeAttribute('src');
        loading.hidden = false;
        modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        try {
            const blob = await originalBlob(img);
            if (!modal.classList.contains('open')) return;
            viewerUrl = URL.createObjectURL(blob);
            image.src = viewerUrl;
            image.alt = '第 ' + (index + 1) + ' 張原始高清商品圖片';
        } catch (error) {
            closeImageViewer();
            alert(error.message || '高清原圖載入失敗。');
        } finally {loading.hidden = true;}
    }
    function closeImageViewer() {
        const modal = $('imageViewerModal');
        modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
        $('imageViewerImage').removeAttribute('src');
        $('imageViewerLoading').hidden = true;
        if (viewerUrl) {URL.revokeObjectURL(viewerUrl); viewerUrl = '';}
        if (!$('imageEditorModal').classList.contains('open')) document.body.classList.remove('modal-open');
    }
    function openImageEditor(index) {
        if (!currentImages[index]) return;
        editorIndex = index; editorDraft = {...currentImages[index]};
        const modal = $('imageEditorModal');
        modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        updateImageEditor();
    }
    function updateImageEditor() {
        if (!editorDraft) return;
        const image = $('imageEditorImage');
        image.src = editorDraft.src;
        image.style.setProperty('--image-x', editorDraft.x + '%');
        image.style.setProperty('--image-y', editorDraft.y + '%');
        image.style.setProperty('--image-zoom', editorDraft.zoom);
        $('imageZoomRange').value = editorDraft.zoom;
        $('imageZoomValue').textContent = Math.round(editorDraft.zoom * 100) + '%';
    }
    function closeImageEditor(apply) {
        if (apply && editorIndex !== null && editorDraft && currentImages[editorIndex]) {
            currentImages[editorIndex] = {...editorDraft};
            renderPreview();
        }
        editorIndex = null; editorDraft = null; editorPointer = null;
        const modal = $('imageEditorModal');
        modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        $('imageEditorFrame').classList.remove('dragging');
    }
    function changeEditorZoom(delta) {
        if (!editorDraft) return;
        editorDraft.zoom = clamp(Math.round((editorDraft.zoom + delta) * 100) / 100, 0.35, 3);
        updateImageEditor();
    }
    async function addPastedImage(file) {
        const originalSrc = await blobToDataUrl(file);
        const compressed = await compressImage(originalSrc);
        currentImages.push(normalizeImageData(compressed, {}, originalSrc,
            {name: '剪貼簿圖片_' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + (file.type.includes('jpeg') ? 'jpg' : (file.type.split('/')[1] || 'png')), type: file.type || 'image/png'}));
        renderPreview();
        if ($('listView').classList.contains('active')) {
            // Pasting a screenshot on the list starts a new record and continues at the address field.
            editingId = null; editReturnPosition = null;
            $('addForm').reset(); $('itemDelivery').value = '取貨付款'; $('itemCurrency').value = 'TWD'; setMonthParts('');
            $('formTitle').textContent = '➕ 新增購買紀錄';
            $('submitBtn').textContent = '儲存資料';
            showFormView({focusId: 'itemUrl'});
        } else if (editingId === null) focusQuickField('itemUrl');
    }

    /* ================= right-button drag to reorder cards ================= */
    let rightPending = null, rightActive = null, rightTarget = null, suppressMenuUntil = 0, autoScrollFrame = null, pointerY = 0;
    const isInteractive = target => !!target.closest('button, a, input, select, textarea, label');
    function clearRightTarget() {rightTarget?.classList.remove('right-drag-over'); rightTarget = null;}
    function stopAutoScroll() {if (autoScrollFrame !== null) cancelAnimationFrame(autoScrollFrame); autoScrollFrame = null;}
    function runAutoScroll() {
        if (!rightActive) {stopAutoScroll(); return;}
        const edge = 72;
        let delta = 0;
        if (pointerY < edge) delta = -Math.max(3, (edge - pointerY) * 0.16);
        else if (pointerY > innerHeight - edge) delta = Math.max(3, (pointerY - (innerHeight - edge)) * 0.16);
        if (delta) window.scrollBy(0, delta);
        autoScrollFrame = requestAnimationFrame(runAutoScroll);
    }
    function finishRightDrag() {
        stopAutoScroll(); rightPending = null; clearRightTarget();
        rightActive?.card.classList.remove('right-dragging');
        rightActive = null;
        document.body.classList.remove('right-drag-active');
        document.querySelectorAll('.item-card').forEach(card => card.classList.remove('right-dragging', 'right-drag-over'));
    }
    function commitRightDrag(sourceId, targetId) {
        if (!sourceId || !targetId || idsEqual(sourceId, targetId)) return;
        const items = state.items;
        const source = items.find(i => idsEqual(i.id, sourceId)), target = items.find(i => idsEqual(i.id, targetId));
        if (!source || !target || !!source.isCompleted !== !!target.isCompleted) return;   // active and archive are sorted separately
        if (source.isCompleted) {
            const archive = items.filter(i => i.isCompleted).sort(compareArchive);
            const from = archive.findIndex(i => idsEqual(i.id, sourceId)), to = archive.findIndex(i => idsEqual(i.id, targetId));
            const [moved] = archive.splice(from, 1);
            archive.splice(to, 0, moved);
            const top = Math.max(archive.reduce((m, i) => Math.max(m, archiveKey(i)), 0) + archive.length + 1, Date.now());
            archive.forEach((i, index) => {i.archiveOrder = top - index;});
        } else {
            const from = items.findIndex(i => idsEqual(i.id, sourceId)), to = items.findIndex(i => idsEqual(i.id, targetId));
            const [moved] = items.splice(from, 1);
            items.splice(to, 0, moved);
        }
        void commit({immediate: true});
    }
    document.addEventListener('mousedown', event => {
        if (event.button !== 2 || previewMode) return;
        const card = event.target.closest('.item-card');
        if (!card || isInteractive(event.target)) return;
        rightPending = {card, itemId: card.dataset.itemId || '', startX: event.clientX, startY: event.clientY};
    }, true);
    document.addEventListener('mousemove', event => {
        if (rightPending && (event.buttons & 2) && Math.hypot(event.clientX - rightPending.startX, event.clientY - rightPending.startY) >= 2) {
            const pending = rightPending;
            rightPending = null;
            if (!previewMode && document.body.contains(pending.card)) {
                rightActive = {card: pending.card, itemId: pending.itemId};
                suppressMenuUntil = Date.now() + 1200;
                pending.card.classList.add('right-dragging');
                document.body.classList.add('right-drag-active');
                pointerY = event.clientY;
                stopAutoScroll();
                autoScrollFrame = requestAnimationFrame(runAutoScroll);
            }
            event.preventDefault();
        }
        if (!rightActive) return;
        event.preventDefault();
        pointerY = event.clientY;
        const candidate = document.elementFromPoint(event.clientX, event.clientY)?.closest('.item-card') || null;
        const next = candidate && candidate !== rightActive.card ? candidate : null;
        if (next !== rightTarget) {clearRightTarget(); rightTarget = next; rightTarget?.classList.add('right-drag-over');}
    }, {capture: true, passive: false});
    document.addEventListener('mouseup', event => {
        if (event.button !== 2) return;
        if (rightPending && !rightActive) {rightPending = null; return;}
        if (!rightActive) return;
        event.preventDefault(); event.stopPropagation();
        suppressMenuUntil = Date.now() + 800;
        const sourceId = rightActive.itemId, targetId = rightTarget?.dataset.itemId || '';
        finishRightDrag();
        commitRightDrag(sourceId, targetId);
    }, true);
    document.addEventListener('contextmenu', event => {
        if (event.target.closest('.item-card') && (rightActive || Date.now() < suppressMenuUntil)) {event.preventDefault(); event.stopPropagation();}
    }, true);
    window.addEventListener('blur', finishRightDrag);

    /* Mouse side button "forward" (button 4) anywhere: new record. */
    let sideLocked = false;
    function sideButton(event) {
        if (event.button !== 4) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        if (event.type !== 'mousedown' || sideLocked) return;
        sideLocked = true;
        startNewPurchase();
        setTimeout(() => {sideLocked = false;}, 350);
    }
    ['mousedown', 'mouseup', 'auxclick'].forEach(name => window.addEventListener(name, sideButton, {capture: true, passive: false}));

    /* ================= 購物紀錄小幫手 (browser extension) ================= */
    /* The extension saves straight to Drive; when this page is open it is told, so the list
       reloads at once and the new records light up. */
    window.addEventListener('nd-shopping-saved', async event => {
        if (!state.ready) return;
        try {await pull({quiet: true});} catch (_) {}
        const ids = event.detail?.ids || [];
        ids.forEach(id => flashCard(findCard(id)));
        findCard(ids[0])?.scrollIntoView({behavior: 'smooth', block: 'center'});
        if (ids.length) toast('小幫手剛剛存了 ' + ids.length + ' 筆。');
    });
    const helperInstalled = () => document.documentElement.dataset.ndShopHelper || '';
    let latestHelper = '';
    async function checkHelper() {
        try {latestHelper = (await (await fetch('extension/manifest.json?v=' + encodeURIComponent(release))).json()).version || '';} catch (_) {}
        const installed = helperInstalled();
        const old = installed && latestHelper && installed !== latestHelper;
        $('helperDot').hidden = !old;
        return {installed, old};
    }
    async function openHelperDialog() {
        $('helperDialog').classList.add('open');
        const {installed, old} = await checkHelper();
        const box = $('helperState');
        box.className = 'helper-state ' + (installed ? (old ? 'is-old' : 'is-ok') : 'is-missing');
        box.textContent = installed
            ? (old ? '這台電腦裝的是 ' + installed + ' 版，有新版 ' + latestHelper + '：請照「更新」的步驟更新。' : '✓ 這台電腦已經裝好小幫手（' + installed + ' 版）。')
            : '這台電腦還沒裝小幫手（或瀏覽器還沒重新整理這一頁）。';
    }

    let toastTimer = null;
    function toast(message) {
        const el = $('shop-toast');
        el.textContent = message;
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {el.hidden = true;}, 6000);
    }

    /* ================= help, menu ================= */
    async function openHelp() {
        const dialog = $('helpDialog');
        dialog.classList.add('open');
        const number = (/pages-(v\d+)/.exec(release) || [])[1] || '';
        $('helpVersion').textContent = number ? '目前版本：' + number + '（' + release.slice(0, 10) + '）' : '';
        const body = $('helpBody');
        try {
            const manual = await (await fetch('assets/manual.json?v=' + encodeURIComponent(release))).json();
            const section = manual.sections.find(s => s.title === '購物紀錄');
            const faq = manual.faq.filter(item => item.tag === 'shopping');
            body.innerHTML = (section ? '<table class="help-table"><tbody>' + section.rows.map(([what, how]) => '<tr><th>' + escapeHtml(what) + '</th><td>' + escapeHtml(how) + '</td></tr>').join('') + '</tbody></table>' : '') +
                faq.map(item => '<details class="help-faq"><summary>' + escapeHtml(item.q) + '</summary><p>' + escapeHtml(item.a) + '</p></details>').join('') +
                '<p class="help-more">更新紀錄和完整說明：切換到任一科目，按上方「使用說明書」。</p>';
        } catch (_) {
            body.textContent = '說明讀取失敗，請重新整理。';
        }
    }
    function setupMenu() {
        const number = (/pages-(v\d+)/.exec(release) || [])[1];
        if (number) $('shop-help').textContent = number + '・使用說明';
        const select = $('shop-book');
        for (const book of config.books || []) {
            const option = document.createElement('option');
            option.value = book.id; option.textContent = book.title;
            select.append(option);
        }
        const option = document.createElement('option');
        option.value = '__shopping'; option.textContent = '🛍 購物紀錄';
        select.append(option);
        select.value = '__shopping';
        select.onchange = () => {
            if (select.value === '__shopping') return;
            location.href = new URL('./?book=' + encodeURIComponent(select.value), location.href).href;
        };
    }

    /* ================= wiring ================= */
    function wire() {
        $('filterMonth').addEventListener('change', render);
        $('filterDelivery').addEventListener('change', render);
        $('filterStatus').addEventListener('change', render);
        $('clearFiltersBtn').addEventListener('click', clearFilters);
        let searchTimer = null;
        $('searchInput').addEventListener('input', () => {clearTimeout(searchTimer); searchTimer = setTimeout(render, 120);});
        $('searchInput').addEventListener('keydown', event => {if (event.key === 'Escape' && event.currentTarget.value) {event.stopPropagation(); event.currentTarget.value = ''; render();}});
        $('syncStatus').addEventListener('click', () => {
            toast($('syncStatus').dataset.toolDetail || '');
            if (state.ready && !pushing && !pulling) void pull({quiet: true}).catch(() => {});
        });
        $('sortBtn').addEventListener('click', forceAutoSort);
        $('previewModeBtn').addEventListener('click', () => togglePreviewMode());
        $('navToAddBtn').addEventListener('click', startNewPurchase);
        $('cancelFormBtn').addEventListener('click', () => closeFormView());
        $('addForm').addEventListener('submit', submitForm);
        $('helperBtn').addEventListener('click', () => void openHelperDialog());
        $('shop-help').addEventListener('click', () => void openHelp());
        document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('.shop-dialog').classList.remove('open')));
        document.querySelectorAll('.shop-dialog').forEach(dialog => dialog.addEventListener('click', event => {if (event.target === dialog) dialog.classList.remove('open');}));

        digitsOnly($('itemYear'), {maxLength: 4});
        digitsOnly($('itemMonthNumber'), {maxLength: 2});
        digitsOnly($('itemPrice'), {allowDot: true, maxLength: 12});
        digitsOnly($('itemBalance'), {allowDot: true, maxLength: 12});
        bindEnterNext('itemUrl', 'itemName');
        bindEnterNext('itemName', 'itemYear');
        bindEnterNext('itemAddress', 'itemPrice');
        bindEnterNext('itemPaymentDate', 'itemBalance');
        $('itemYear').addEventListener('input', syncMonthValue);
        $('itemMonthNumber').addEventListener('input', syncMonthValue);
        $('itemYear').addEventListener('keydown', event => {
            if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
            event.preventDefault(); syncMonthValue(); focusQuickField('itemMonthNumber');
        });
        $('itemMonthNumber').addEventListener('keydown', event => {
            if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
            event.preventDefault();
            if (!$('itemYear').value.trim() && !event.currentTarget.value.trim()) {$('itemMonth').value = ''; focusQuickField('itemDelivery'); return;}
            if (!syncMonthValue()) {event.currentTarget.focus(); event.currentTarget.select(); return;}
            event.currentTarget.value = String(Number(event.currentTarget.value));
            focusQuickField('itemDelivery');
        });
        $('itemDelivery').addEventListener('keydown', event => {
            const key = physicalKey(event, false);
            if (key && DELIVERIES[Number(key) - 1]) {
                event.preventDefault(); event.stopPropagation();
                event.currentTarget.value = DELIVERIES[Number(key) - 1];
                event.currentTarget.dispatchEvent(new Event('change', {bubbles: true}));
                focusQuickField('itemAddress');
                return;
            }
            if (event.key === 'Enter') {event.preventDefault(); focusQuickField('itemAddress');}
        }, true);
        for (const id of ['itemPrice', 'itemBalance']) {
            $(id).addEventListener('keydown', event => {
                if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
                event.preventDefault();
                $('addForm').requestSubmit();
            });
        }
        $('itemNote').addEventListener('keydown', event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault(); $('addForm').requestSubmit();}
        });
        // After pasting an address, continue at the product name.
        $('itemUrl').addEventListener('paste', event => {
            if (!(event.clipboardData?.getData('text') || '').trim()) return;
            setTimeout(() => {if ($('formView').classList.contains('active')) focusQuickField('itemName');}, 0);
        });

        const previewList = $('imagePreviewList');
        previewList.addEventListener('dragstart', event => {
            const item = event.target.closest('.preview-item');
            if (!item) return;
            previewDragIndex = Number(item.dataset.index);
            suppressPreviewClickUntil = Date.now() + 700;
            item.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', 'preview:' + previewDragIndex);
            event.stopPropagation();
        });
        previewList.addEventListener('dragover', event => {
            const item = event.target.closest('.preview-item');
            if (!item) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            previewList.querySelectorAll('.preview-item').forEach(el => el.classList.remove('drag-over'));
            item.classList.add('drag-over');
            event.stopPropagation();
        });
        previewList.addEventListener('drop', event => {
            const item = event.target.closest('.preview-item');
            if (!item || previewDragIndex === null) return;
            event.preventDefault();
            const target = Number(item.dataset.index);
            if (target !== previewDragIndex) {
                const [moved] = currentImages.splice(previewDragIndex, 1);
                currentImages.splice(target, 0, moved);
            }
            previewDragIndex = null;
            renderPreview();
            event.stopPropagation();
        });
        previewList.addEventListener('dragend', event => {
            suppressPreviewClickUntil = Date.now() + 250;
            previewDragIndex = null;
            previewList.querySelectorAll('.preview-item').forEach(el => el.classList.remove('dragging', 'drag-over'));
            event.stopPropagation();
        });

        $('editorCloseBtn').addEventListener('click', () => closeImageEditor(false));
        $('editorCancelBtn').addEventListener('click', () => closeImageEditor(false));
        $('editorApplyBtn').addEventListener('click', () => closeImageEditor(true));
        $('editorResetBtn').addEventListener('click', () => {if (editorDraft) {editorDraft.x = 50; editorDraft.y = 50; editorDraft.zoom = 1; updateImageEditor();}});
        $('zoomOutBtn').addEventListener('click', () => changeEditorZoom(-0.1));
        $('zoomInBtn').addEventListener('click', () => changeEditorZoom(0.1));
        $('imageZoomRange').addEventListener('input', event => {if (editorDraft) {editorDraft.zoom = clamp(Number(event.target.value), 0.35, 3); updateImageEditor();}});
        $('viewerCloseBtn').addEventListener('click', closeImageViewer);
        const frame = $('imageEditorFrame');
        frame.addEventListener('pointerdown', event => {
            if (!editorDraft) return;
            editorPointer = {pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, startX: editorDraft.x, startY: editorDraft.y};
            frame.setPointerCapture(event.pointerId);
            frame.classList.add('dragging');
            event.preventDefault();
        });
        frame.addEventListener('pointermove', event => {
            if (!editorPointer || event.pointerId !== editorPointer.pointerId || !editorDraft) return;
            const rect = frame.getBoundingClientRect();
            editorDraft.x = clamp(editorPointer.startX - ((event.clientX - editorPointer.clientX) / Math.max(rect.width, 1)) * 100 / editorDraft.zoom, 0, 100);
            editorDraft.y = clamp(editorPointer.startY - ((event.clientY - editorPointer.clientY) / Math.max(rect.height, 1)) * 100 / editorDraft.zoom, 0, 100);
            updateImageEditor();
            event.preventDefault();
        });
        const endPointer = event => {
            if (!editorPointer || event.pointerId !== editorPointer.pointerId) return;
            if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
            editorPointer = null;
            frame.classList.remove('dragging');
        };
        frame.addEventListener('pointerup', endPointer);
        frame.addEventListener('pointercancel', endPointer);
        $('imageEditorModal').addEventListener('click', event => {if (event.target.id === 'imageEditorModal') closeImageEditor(false);});
        $('imageViewerModal').addEventListener('click', event => {if (event.target.id === 'imageViewerModal') closeImageViewer();});
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if ($('imageViewerModal').classList.contains('open')) closeImageViewer();
            else if ($('imageEditorModal').classList.contains('open')) closeImageEditor(false);
            else document.querySelectorAll('.shop-dialog.open').forEach(d => d.classList.remove('open'));
        });
        document.addEventListener('paste', event => {
            if (!state.ready || previewMode) return;
            for (const entry of event.clipboardData?.items || []) {
                if (!entry.type.startsWith('image/')) continue;
                const file = entry.getAsFile();
                if (file) void addPastedImage(file);
            }
        });
    }

    /* ================= start-up ================= */
    const gate = $('site-gate'), gateText = $('site-gate-text'), gateButton = $('site-gate-button');
    function say(message, button = '') {
        gateText.textContent = message;
        gateButton.hidden = !button;
        if (button) gateButton.textContent = button;
    }
    async function start() {
        say('正在讀取你 Google Drive 裡的購物紀錄…');
        const hadLocal = await loadLocal();
        if (hadLocal) {gate.hidden = true; render();}
        try {
            await drive.locate();
            await pull();
        } catch (error) {
            if (!hadLocal) {say('讀取失敗：' + (error.message || error), '再試一次'); gateButton.onclick = () => location.reload(); return;}
        }
        gate.hidden = true;
        state.ready = true;
        render();
        if (state.dirty) schedulePush(true);
        setTimeout(() => void checkHelper(), 1500);
    }
    async function offlineStart() {
        if (!await loadLocal()) {say('目前沒有網路，而且這台裝置還沒有存過購物紀錄。請連上網路後再開一次。'); return;}
        gate.hidden = true;
        state.ready = true; state.loadedFromCloud = true;
        render();
        setStatus('error', '🔴 離線中：顯示這台裝置上的紀錄');
        window.addEventListener('online', () => location.reload(), {once: true});
    }
    async function signIn(prompt) {
        gateButton.disabled = true;
        try {
            say('請在跳出的 Google 視窗中選擇存放筆記的帳號…');
            await noteAuth.request(prompt);
            await start();
        } catch (error) {
            say(error.message, '再試一次');
        } finally {gateButton.disabled = false;}
    }

    /* Home-screen app + offline: the service worker keeps this page's files on the device. */
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(registration => {
            const urls = [location.pathname, ...performance.getEntriesByType('resource').map(e => e.name)]
                .filter(u => new URL(u, location.href).origin === location.origin);
            registration.active?.postMessage({type: 'cache-files', urls, release});
        }).catch(() => {});
    }
    try {window.opener = null;} catch (_) {}
    window.name = 'nd-shopping';
    try {localStorage.setItem('nd-last-page', 'shopping');} catch (_) {}
    setupMenu();
    wire();
    resetFormState();
    window.noteShopping = {state, merge, compactItem, serialize};   // for the tests
    if (!config.clientId) {say('網站還沒設定 Google 登入（config.js 的 clientId 是空的）。'); return;}
    if (navigator.onLine === false) {void offlineStart(); return;}
    noteAuth.loadLibrary().catch(error => say(error.message));
    gateButton.onclick = () => signIn(localStorage.getItem('nd-login-hint') ? '' : 'consent');
    if (noteAuth.hasToken()) start().catch(error => say(error.message, '再試一次'));
    else say('用你的 Google 帳號登入，網站會直接讀取你 Google Drive 裡的購物紀錄。', '用 Google 登入');
})();
