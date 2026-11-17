/* Browser-side replacement for the old Apps Script backend (code.gs).
 *
 * call(packet) accepts the same packets the old noteDriveCall(packet) accepted and
 * returns the same response shapes, so the note editor, renderer and image tools
 * keep working unchanged. Data stays in the same Google Drive folder, in the same
 * format, so notes written by the old site are read as-is.
 *
 * What changed compared with the server version:
 *  - Script properties are replaced by Drive lookups (root folder, buckets, heads,
 *    OCR shards) plus a per-subject pointer file for the current version.
 *  - Files are read and written directly with the Drive REST API (no base64 relay).
 *  - The old HMAC "proof" was only needed to stop a browser from forging file ids
 *    sent to a server. Here the browser is the owner, so proofs are plain checksums.
 */
const noteDriveServer = (() => {
    'use strict';
    const APP = 'pharmacy-notes-drive-v2';
    const ROOT_NAME = '藥學筆記雲端工作台';
    const OCR_FOLDER_NAME = '圖片文字索引';
    const OCR_ENGINE = 'drive-ocr-auto-v2';
    const API = 'https://www.googleapis.com/drive/v3';
    const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
    const FOLDER = 'application/vnd.google-apps.folder';
    const HEX64 = /^[a-f0-9]{64}$/;
    const enc = new TextEncoder();

    let books = [];
    let root = null;
    let bucketMap = null;            // "ab" -> folder id
    let bucketJob = null;
    const pointerIds = new Map();    // book id -> pointer file id
    const headCache = new Map();     // book id -> {head, fileId}
    let ocrFolder = null;
    let ocrShardMap = null;          // prefix -> file id
    const ocrLeases = new Map();
    let mutex = Promise.resolve();
    let readOnly = true;

    /* ---------- small helpers ---------- */
    const fail = (message, code = 'DRIVE', retryable = true) => Object.assign(new Error(message), {code, retryable});
    const q = value => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const hex = buffer => [...new Uint8Array(buffer)].map(v => v.toString(16).padStart(2, '0')).join('');
    const sha256 = async data => hex(await crypto.subtle.digest('SHA-256', data instanceof Uint8Array ? data : new Uint8Array(data)));
    const b64 = bytes => {let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(s);};
    const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const uuid = () => crypto.randomUUID();
    function serialize(fn) {const job = mutex.then(fn, fn); mutex = job.catch(() => {}); return job;}
    async function limit(items, fn, size = 6) {
        const out = new Array(items.length); let i = 0;
        await Promise.all(Array.from({length: Math.min(size, items.length)}, async () => {while (i < items.length) {const n = i++; out[n] = await fn(items[n], n);}}));
        return out;
    }
    function guardWrite() {
        if (readOnly) throw fail('目前是「唯讀檢查模式」，不會寫入雲端。確認筆記都正確後，可在上方黃色橫幅開啟編輯。', 'READ_ONLY', false);
    }

    /* ---------- text-page cache on this device ----------
       Text pages are named by the SHA-256 of their content, so a copy whose checksum
       matches the name is exactly the cloud file. Pages already on this device are not
       downloaded again; only new or changed pages travel over the network. */
    const pageCache = (() => {
        let dbJob = null;
        const open = () => dbJob ||= new Promise(resolve => {
            try {
                const request = indexedDB.open('nd-page-cache', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('pages');
                request.onsuccess = () => resolve(request.result);
                request.onerror = request.onblocked = () => resolve(null);
            } catch (_) {resolve(null);}
        });
        const run = async (mode, fn) => {
            const db = await open(); if (!db) return null;
            return new Promise(resolve => {
                try {
                    const tx = db.transaction('pages', mode), result = fn(tx.objectStore('pages'));
                    tx.oncomplete = () => resolve(result?.result ?? null); tx.onerror = tx.onabort = () => resolve(null);
                } catch (_) {resolve(null);}
            });
        };
        async function get(key) {
            const item = await run('readonly', store => store.get(key));
            return item && item.blob instanceof Blob ? item.blob : null;
        }
        async function put(key, blob) {
            await run('readwrite', store => store.put({blob, usedAt: Date.now()}, key));
            if (Math.random() < 0.1) void prune();
        }
        async function prune() {   // keep the newest 400 pages
            const all = await run('readonly', store => store.getAll()), keys = await run('readonly', store => store.getAllKeys());
            if (!all || !keys || keys.length <= 400) return;
            const old = keys.map((k, i) => [k, all[i].usedAt]).sort((a, b) => a[1] - b[1]).slice(0, keys.length - 400);
            await run('readwrite', store => {old.forEach(([k]) => store.delete(k)); return null;});
        }
        return {get, put};
    })();

    /* ---------- HTTP ---------- */
    async function http(url, options = {}, attempt = 0) {
        if (navigator.onLine === false) throw fail('目前沒有網路，修改先存在這台裝置，連上網路後會自動上傳。', 'NETWORK');
        const token = await noteAuth.getToken();
        let response;
        try {
            response = await fetch(url, {...options, headers: {Authorization: 'Bearer ' + token, ...(options.headers || {})}});
        } catch (_) {
            if (attempt < 2) {await new Promise(r => setTimeout(r, 800 * (attempt + 1))); return http(url, options, attempt + 1);}
            throw fail('無法連線到 Google Drive，請檢查網路；本機草稿仍保留。', 'NETWORK');
        }
        if (response.status === 401 && attempt === 0) {noteAuth.invalidate(); return http(url, options, 1);}
        if ((response.status === 429 || response.status >= 500) && attempt < 3) {
            await new Promise(r => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 400));
            return http(url, options, attempt + 1);
        }
        return response;
    }
    async function ok(response, what = 'Google Drive') {
        if (response.ok) return response;
        let detail = '';
        try {detail = (await response.json()).error?.message || '';} catch (_) {}
        const e = fail(what + ' 回覆 ' + response.status + (detail ? '：' + detail.slice(0, 200) : '') + '；請檢查剩餘空間、授權或稍後重試。',
            response.status === 403 ? 'DRIVE_PERMISSION_OR_QUOTA' : response.status === 404 ? 'DRIVE_NOT_FOUND' : 'DRIVE_HTTP',
            response.status === 429 || response.status >= 500);
        e.status = response.status;
        throw e;
    }
    async function api(path, options = {}) {return (await ok(await http(API + path, options))).json();}
    async function list(query, fields = 'id,name', orderBy = '', pageSize = 1000) {
        const files = []; let pageToken = '';
        do {
            const params = new URLSearchParams({q: query, fields: 'nextPageToken,files(' + fields + ')', pageSize: String(pageSize), spaces: 'drive'});
            if (orderBy) params.set('orderBy', orderBy);
            if (pageToken) params.set('pageToken', pageToken);
            const page = await api('/files?' + params);
            files.push(...(page.files || []));
            pageToken = page.nextPageToken || '';
        } while (pageToken);
        return files;
    }
    /* First file (in the requested order) that passes a test, reading only as many pages as needed. */
    async function firstMatch(query, fields, orderBy, test, pageSize = 50) {
        let pageToken = '';
        do {
            const params = new URLSearchParams({q: query, fields: 'nextPageToken,files(' + fields + ')', pageSize: String(pageSize), spaces: 'drive', orderBy});
            if (pageToken) params.set('pageToken', pageToken);
            const page = await api('/files?' + params);
            const hit = (page.files || []).find(test);
            if (hit) return hit;
            pageToken = page.nextPageToken || '';
        } while (pageToken);
        return null;
    }
    async function mediaBlob(fileId) {return (await ok(await http(API + '/files/' + encodeURIComponent(fileId) + '?alt=media'))).blob();}
    async function mediaBytes(fileId) {return new Uint8Array(await (await mediaBlob(fileId)).arrayBuffer());}
    async function mediaText(fileId) {return new TextDecoder('utf-8').decode(await mediaBytes(fileId));}
    async function createFile(metadata, body, mime, fields = 'id,size,sha256Checksum,mimeType') {
        guardWrite();
        const boundary = 'nd_' + uuid().replace(/-/g, '');
        const blob = new Blob([
            '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n',
            '--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n', body, '\r\n--' + boundary + '--\r\n'
        ]);
        return (await ok(await http(UPLOAD + '/files?uploadType=multipart&fields=' + fields,
            {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + boundary}, body: blob}))).json();
    }
    async function replaceContent(fileId, body, mime) {
        guardWrite();
        return (await ok(await http(UPLOAD + '/files/' + encodeURIComponent(fileId) + '?uploadType=media&fields=id',
            {method: 'PATCH', headers: {'Content-Type': mime}, body}))).json();
    }

    /* ---------- workspace discovery (replaces script properties) ---------- */
    async function findRoot() {
        const saved = localStorage.getItem('nd-root');
        if (saved) {
            try {
                const meta = await api('/files/' + encodeURIComponent(saved) + '?fields=id,name,trashed,mimeType');
                if (!meta.trashed && meta.mimeType === FOLDER) return saved;
            } catch (_) {}
        }
        const folders = await list("name='" + q(ROOT_NAME) + "' and mimeType='" + FOLDER + "' and trashed=false", 'id,name,createdTime', 'createdTime');
        if (!folders.length) throw fail('在你的 Google Drive 找不到「' + ROOT_NAME + '」資料夾。請確認登入的是存放筆記的那個 Google 帳號。', 'NO_WORKSPACE', false);
        let chosen = folders[0];
        if (folders.length > 1) {
            // Prefer the folder that actually holds bucket folders.
            const counts = await limit(folders, async f => (await list("'" + f.id + "' in parents and mimeType='" + FOLDER + "' and trashed=false", 'id', '', 300)).length);
            chosen = folders[counts.indexOf(Math.max(...counts))];
        }
        localStorage.setItem('nd-root', chosen.id);
        return chosen.id;
    }
    async function buckets() {
        if (bucketMap) return bucketMap;
        if (!bucketJob) bucketJob = (async () => {
            const folders = await list("'" + root + "' in parents and mimeType='" + FOLDER + "' and trashed=false", 'id,name,createdTime', 'createdTime');
            const map = new Map();
            for (const f of folders) {
                if (/^[0-9a-f]{2}$/.test(f.name) && !map.has(f.name)) map.set(f.name, f.id);
                if (f.name === OCR_FOLDER_NAME && !ocrFolder) ocrFolder = f.id;
            }
            bucketMap = map; return map;
        })().finally(() => {bucketJob = null;});
        return bucketJob;
    }
    async function bucket(hash, create) {
        const map = await buckets(), name = hash.slice(0, 2);
        if (map.has(name)) return map.get(name);
        if (!create) return null;
        guardWrite();
        const folder = await api('/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name, mimeType: FOLDER, parents: [root]})});
        map.set(name, folder.id); return folder.id;
    }

    /* ---------- descriptors ---------- */
    async function proofOf(d) {return 'sha256:' + await sha256(enc.encode(JSON.stringify([d.key, d.fileId, d.bytes, d.mime, d.role, d.count || 0])));}
    async function describe(fileId, key, bytes, mime, role, count) {
        const d = {fileId, key, bytes, mime, role};
        if (role === 'catalog') d.count = count;
        d.proof = await proofOf(d);
        return d;
    }
    function checkFile(d, role) {
        if (!d || !HEX64.test(d.key) || !/^[\w-]{1,128}$/.test(d.fileId) || !Number.isSafeInteger(d.bytes) || d.bytes < 0 ||
            typeof d.mime !== 'string' || d.mime.length > 100 || (role && d.role !== role))
            throw fail('檔案識別碼不正確。', 'DESCRIPTOR', false);
        return d;
    }
    async function find(key, role, bytes, mime, knownCount = null) {
        const id = await bucket(key, false); if (!id) return null;
        const files = await list("name='nd-" + q(role) + '-' + key + "' and '" + id + "' in parents and trashed=false", 'id,size,sha256Checksum', '', 10);
        const file = files.find(f => Number(f.size) === bytes);
        if (!file) return null;
        if (file.sha256Checksum && file.sha256Checksum !== key) throw fail('既有雲端檔案校驗失敗，未確認儲存；請保留本機備份。', 'CHECKSUM', false);
        let count = 0;
        if (role === 'catalog') count = knownCount != null && file.sha256Checksum === key ? knownCount : await validateCatalog(await mediaBlob(file.id), mime);
        return describe(file.id, key, bytes, mime, role, count);
    }

    /* ---------- catalog validation (same rules as the server) ---------- */
    async function validateCatalog(blob, mime) {
        let raw = blob;
        if (mime === 'application/gzip') raw = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
        if (raw.size > 8 * 1024 * 1024) throw fail('單一文字頁過大，請保留本機內容並將超長單篇分開。', 'CATALOG', false);
        const page = JSON.parse(await raw.text());
        if (page.schema !== 1 || !Array.isArray(page.records) || !page.assets || Array.isArray(page.assets)) throw fail('文字頁格式不正確。', 'CATALOG', false);
        const ids = new Set();
        for (const note of page.records) {
            const id = JSON.stringify(note?.id);
            if (!note || (typeof note.id !== 'string' && typeof note.id !== 'number') || ids.has(id)) throw fail('文字頁有重複或不正確的筆記。', 'CATALOG', false);
            ids.add(id);
        }
        for (const [id, asset] of Object.entries(page.assets)) {
            if (!/^[\w-]+$/.test(id)) throw fail('圖片識別碼不正確。', 'CATALOG', false);
            validateAsset(asset, 0);
        }
        for (const ref of JSON.stringify(page.records).match(/note-local-asset:[a-zA-Z0-9-]+/g) || [])
            if (!page.assets[ref.slice(17)]) throw fail('文字頁缺少原圖參照，未取代原版本。', 'CATALOG', false);
        return page.records.length;
    }
    function validateAsset(asset, depth) {
        if (!asset || depth > 6 || !HEX64.test(asset.valueHash)) throw fail('圖片索引不完整。', 'CATALOG', false);
        if (asset.kind === 'legacy') return;
        if (!['text', 'data-url', 'svg-template', 'json-source'].includes(asset.kind)) throw fail('不支援的圖片格式。', 'CATALOG', false);
        checkFile(asset.file, 'asset');
        if (asset.preview) checkFile(asset.preview, 'preview');
    }

    /* ---------- storing files ---------- */
    async function storeBytes(bytes, key, mime, role) {
        let count = 0;
        if (role === 'catalog') count = await validateCatalog(new Blob([bytes], {type: mime}), mime);
        const existing = await find(key, role, bytes.length, mime, role === 'catalog' ? count : null);
        if (role === 'catalog') await pageCache.put(key, new Blob([bytes], {type: mime}));
        if (existing) return existing;
        const folder = await bucket(key, true);
        const file = await createFile({name: 'nd-' + role + '-' + key, parents: [folder], mimeType: mime,
            appProperties: {ndApp: APP, ndHash: key, ndRole: role}}, new Blob([bytes], {type: mime}), mime);
        if (file.sha256Checksum && file.sha256Checksum !== key) throw fail('Google Drive 原檔校驗未通過，尚未確認儲存。', 'CHECKSUM', false);
        return describe(file.id, key, bytes.length, mime, role, count);
    }
    async function storeSmall(entry, role) {
        if (!entry || typeof entry.data !== 'string' || !HEX64.test(entry.key) || !Number.isSafeInteger(entry.bytes) || typeof entry.mime !== 'string' || entry.mime.length > 100)
            throw fail('單次小型檔案內容不正確。', 'UPLOAD', false);
        const bytes = un64(entry.data);
        if (bytes.length !== entry.bytes || await sha256(bytes) !== entry.key) throw fail('檔案內容檢查失敗。', 'CHECKSUM', false);
        return storeBytes(bytes, entry.key, entry.mime, role);
    }
    /* Large files: one resumable session straight from the browser, 8 MB pieces. */
    async function uploadBlob(blob, role, onProgress = () => {}) {
        guardWrite();
        const bytesAll = new Uint8Array(await blob.arrayBuffer()), key = await sha256(bytesAll), mime = blob.type || 'application/octet-stream';
        if (!['asset', 'preview', 'catalog'].includes(role)) throw fail('上傳資訊不正確。', 'UPLOAD', false);
        if (blob.size <= 5 * 1024 * 1024) return storeBytes(bytesAll, key, mime, role);
        const found = await find(key, role, blob.size, mime);
        if (found) return found;
        const folder = await bucket(key, true);
        const start = await ok(await http(UPLOAD + '/files?uploadType=resumable&fields=id,size,sha256Checksum', {
            method: 'POST',
            headers: {'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(blob.size)},
            body: JSON.stringify({name: 'nd-' + role + '-' + key, parents: [folder], mimeType: mime, appProperties: {ndApp: APP, ndHash: key, ndRole: role}})
        }));
        const session = start.headers.get('Location');
        if (!session) throw fail('無法建立 Google Drive 續傳工作階段。', 'UPLOAD');
        const piece = 8 * 1024 * 1024;
        let offset = 0, result = null;
        for (let tries = 0; offset < blob.size;) {
            const end = Math.min(offset + piece, blob.size);
            let response;
            try {
                response = await fetch(session, {method: 'PUT', headers: {'Content-Range': 'bytes ' + offset + '-' + (end - 1) + '/' + blob.size}, body: blob.slice(offset, end)});
            } catch (_) {response = null;}
            if (response && (response.status === 200 || response.status === 201)) {result = await response.json(); offset = blob.size; break;}
            if (response && response.status === 308) {
                const range = response.headers.get('Range');
                offset = range ? Number(range.split('-').pop()) + 1 : 0; tries = 0; onProgress(offset, blob.size); continue;
            }
            if (++tries > 4) throw fail('原圖上傳中斷，請稍後重試；本機草稿仍保留。', 'UPLOAD');
            await new Promise(r => setTimeout(r, 1500 * tries));
            const status = await fetch(session, {method: 'PUT', headers: {'Content-Range': 'bytes */' + blob.size}}).catch(() => null);
            if (status && (status.status === 200 || status.status === 201)) {result = await status.json(); break;}
            if (status && status.status === 308) {const range = status.headers.get('Range'); offset = range ? Number(range.split('-').pop()) + 1 : 0;}
        }
        if (!result?.id) throw fail('續傳尚未確認。', 'UPLOAD');
        const meta = await api('/files/' + encodeURIComponent(result.id) + '?fields=id,size,sha256Checksum');
        if (Number(meta.size) !== blob.size || (meta.sha256Checksum && meta.sha256Checksum !== key)) throw fail('Google Drive 原檔校驗未通過，尚未確認儲存。', 'CHECKSUM', false);
        let count = 0;
        if (role === 'catalog') {count = await validateCatalog(blob, mime); await pageCache.put(key, blob);}
        onProgress(blob.size, blob.size);
        return describe(result.id, key, blob.size, mime, role, count);
    }
    async function downloadBlob(d) {
        checkFile(d);
        const blob = await mediaBlob(d.fileId);
        if (blob.size !== d.bytes) throw fail('雲端回傳原檔長度不正確。', 'RANGE');
        return new Blob([blob], {type: d.mime});
    }

    /* ---------- versions (head files) ---------- */
    const headName = book => new RegExp('^' + book.id + '-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.json$');
    async function readHeadFile(fileId) {
        const head = JSON.parse(await mediaText(fileId));
        if (head.format !== APP || !Array.isArray(head.pages)) throw fail('筆記版本索引損壞，原資料未更動。', 'CATALOG', false);
        return head;
    }
    async function pointerFile(book, create) {
        if (pointerIds.has(book.id)) return pointerIds.get(book.id);
        const name = 'nd-pointer-' + book.id + '.json';
        const files = await list("name='" + q(name) + "' and '" + root + "' in parents and trashed=false", 'id,modifiedTime', 'modifiedTime desc', 10);
        if (files[0]) {pointerIds.set(book.id, files[0].id); return files[0].id;}
        if (!create) return null;
        const file = await createFile({name, parents: [root], mimeType: 'application/json'}, '{}', 'application/json', 'id');
        pointerIds.set(book.id, file.id); return file.id;
    }
    /* Current version = the newer of (a) the pointer written by this site and
       (b) the newest head file found by search, which also covers versions saved
       by the old Apps Script site. */
    async function currentHead(book) {
        const candidates = [];
        const pointerId = await pointerFile(book, false);
        if (pointerId) {
            try {
                const pointer = JSON.parse(await mediaText(pointerId));
                if (pointer.headId) {
                    const meta = await api('/files/' + encodeURIComponent(pointer.headId) + '?fields=id,createdTime,trashed');
                    if (!meta.trashed) candidates.push(meta);
                }
            } catch (_) {}
        }
        // Only the newest head matters: the old site kept one file per save (thousands), so stop at the first match.
        const pattern = headName(book);
        const newest = await firstMatch("name contains '" + q(book.id) + "' and mimeType='application/json' and trashed=false", 'id,name,createdTime', 'createdTime desc', f => pattern.test(f.name));
        if (newest) candidates.push(newest);
        if (!candidates.length) {headCache.set(book.id, {head: {revision: null, pages: [], count: 0, preload: []}, fileId: null}); return headCache.get(book.id).head;}
        candidates.sort((a, b) => String(b.createdTime).localeCompare(String(a.createdTime)));
        const fileId = candidates[0].id, cached = headCache.get(book.id);
        if (cached?.fileId === fileId) return cached.head;
        const head = await readHeadFile(fileId);
        headCache.set(book.id, {head, fileId});
        return head;
    }
    /* A text page: from this device when its checksum matches, otherwise from Drive.
       When confirming a save (verify), Drive is still asked that the file exists with
       the same checksum, but the content is not downloaded again. */
    async function pageData(d, verify = false) {
        checkFile(d, 'catalog');
        const cached = await pageCache.get(d.key);
        if (cached && cached.size === d.bytes) {
            if (!verify) return {file: d, data: cached};
            const meta = await api('/files/' + encodeURIComponent(d.fileId) + '?fields=size,sha256Checksum,trashed').catch(() => null);
            if (meta && !meta.trashed && Number(meta.size) === d.bytes && meta.sha256Checksum === d.key) return {file: d, data: cached};
        }
        const blob = await mediaBlob(d.fileId);   // the client accepts a Blob here as well as base64
        if (blob.size === d.bytes && await sha256(new Uint8Array(await blob.arrayBuffer())) === d.key) await pageCache.put(d.key, new Blob([blob], {type: d.mime}));
        return {file: d, data: blob};
    }
    async function read(book, knownRevision, skipPreviews, verify = false) {
        const head = await currentHead(book);
        if (head.revision && knownRevision === head.revision) return {success: true, format: APP, unchanged: true, head};
        // Direct Drive reads are cheap, so fetch every text page in parallel.
        const pages = await limit(head.pages.map((d, index) => ({d, index})), async ({d, index}) => ({...await pageData(d, verify), index}), 8);
        const previews = skipPreviews ? [] : (await getPreviews((head.preload || []).slice(0, 4))).files;
        return {success: true, format: APP, head, pages, previews};
    }
    async function pages(book, revision, indices) {
        const head = await currentHead(book);
        if (head.revision !== revision) return {success: false, code: 'CONFLICT', error: '雲端已有新版本，請重新讀取。', retryable: true};
        if (!Array.isArray(indices) || indices.some(i => !Number.isInteger(i) || i < 0 || i >= head.pages.length)) throw fail('讀取頁碼不正確。', 'PAGES', false);
        return {success: true, revision, pages: await limit(indices, async i => ({...await pageData(head.pages[i]), index: i}))};
    }
    function commit(book, packet) {
        return serialize(async () => {
            guardWrite();
            if (!Array.isArray(packet.pages) || !Array.isArray(packet.preload) || packet.preload.length > 4) throw fail('儲存格式不正確。', 'COMMIT', false);
            headCache.delete(book.id);
            const previous = await currentHead(book);
            if (packet.baseRevision !== previous.revision) return {success: false, code: 'CONFLICT', error: '其他裝置也有修改，請重新讀取後合併。', retryable: true};
            const stored = await limit(packet.pages, p => p.inline ? storeSmall(p.inline, 'catalog') : checkFile(p.file, 'catalog'), 4);
            packet.preload.forEach(d => checkFile(d, 'preview'));
            const revision = uuid();
            const head = {format: APP, revision, previous: previous.revision, pages: stored, count: stored.reduce((n, d) => n + d.count, 0),
                preload: packet.preload, updatedAt: new Date().toISOString()};
            const folder = await bucket(await sha256(enc.encode(book.id + revision)), true);
            const file = await createFile({name: book.id + '-' + revision + '.json', parents: [folder], mimeType: 'application/json'},
                JSON.stringify(head), 'application/json', 'id');
            const pointerId = await pointerFile(book, true);
            await replaceContent(pointerId, JSON.stringify({format: APP, book: book.id, revision, headId: file.id, updatedAt: head.updatedAt}), 'application/json');
            headCache.set(book.id, {head, fileId: file.id});
            return {success: true, revision, head};
        });
    }

    /* ---------- small JSON files in the root folder (AI settings, AI sticky notes) ----------
       Kept apart from the notes themselves, so they never slow down note saving. */
    const rootFileIds = new Map();
    const ROOT_JSON = /^nd-(ai-settings|ai-notes-[a-z]+)\.json$/;
    async function rootJsonFile(name, create) {
        if (!ROOT_JSON.test(name)) throw fail('檔名不正確。', 'REQUEST', false);
        if (rootFileIds.has(name)) return rootFileIds.get(name);
        const files = await list("name='" + q(name) + "' and '" + root + "' in parents and trashed=false", 'id,modifiedTime', 'modifiedTime desc', 10);
        if (files[0]) {rootFileIds.set(name, files[0].id); return files[0].id;}
        if (!create) return null;
        const file = await createFile({name, parents: [root], mimeType: 'application/json'}, '{}', 'application/json', 'id');
        rootFileIds.set(name, file.id); return file.id;
    }
    async function rootJsonRead(name) {
        const id = await rootJsonFile(name, false);
        if (!id) return null;
        try {return JSON.parse(await mediaText(id));} catch (_) {return null;}
    }
    /* update(current) returns the new value; read + write run as one step so two saves never mix. */
    function rootJsonUpdate(name, update) {
        return serialize(async () => {
            guardWrite();
            const id = await rootJsonFile(name, true);
            let current = null;
            try {current = JSON.parse(await mediaText(id));} catch (_) {}
            const next = update(current);
            await replaceContent(id, JSON.stringify(next), 'application/json');
            return next;
        });
    }

    /* ---------- weekly backups ----------
       A backup is a copy of one version's index (the list of text pages). Text pages and
       images are never deleted by this site, so a backup stays complete on its own.
       They live in the folder 每週備份; the newest KEEP_BACKUPS per subject are kept. */
    const BACKUP_FOLDER_NAME = '每週備份', KEEP_BACKUPS = 8, WEEK = 7 * 24 * 3600 * 1000;
    let backupFolderId = null;
    async function backupFolder(create) {
        if (backupFolderId) return backupFolderId;
        const found = await list("name='" + q(BACKUP_FOLDER_NAME) + "' and '" + root + "' in parents and mimeType='" + FOLDER + "' and trashed=false", 'id', 'createdTime', 10);
        if (found[0]) return backupFolderId = found[0].id;
        if (!create) return null;
        guardWrite();
        backupFolderId = (await api('/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: BACKUP_FOLDER_NAME, mimeType: FOLDER, parents: [root]})})).id;
        return backupFolderId;
    }
    async function listBackups(book) {
        const folder = await backupFolder(false);
        if (!folder) return [];
        const files = await list("'" + folder + "' in parents and name contains 'backup-" + q(book.id) + "-' and trashed=false", 'id,name,createdTime,appProperties', 'createdTime desc', 100);
        return files.filter(f => f.name.startsWith('backup-' + book.id + '-')).map(f => ({id: f.id, name: f.name, createdTime: f.appProperties?.ndCreatedAt || f.createdTime,
            count: Number(f.appProperties?.ndCount || 0), kind: f.appProperties?.ndKind || 'weekly'}));
    }
    function backupNow(book, kind = 'manual') {
        return serialize(async () => {
            guardWrite();
            headCache.delete(book.id);
            const head = await currentHead(book);
            if (!head.revision) return {success: true, skipped: true};
            const folder = await backupFolder(true), now = new Date();
            const day = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
            await createFile({name: 'backup-' + book.id + '-' + day + '-' + head.revision.slice(0, 8) + '.json', parents: [folder], mimeType: 'application/json',
                appProperties: {ndApp: APP, ndKind: kind, ndCount: String(head.count || 0), ndRevision: head.revision, ndCreatedAt: now.toISOString()}},
                JSON.stringify({format: APP, kind: 'backup', book: book.id, createdAt: now.toISOString(), head}), 'application/json', 'id');
            const backups = await listBackups(book);
            await limit(backups.slice(KEEP_BACKUPS), b => trashFile(b.id), 4);   // to Drive trash, recoverable for 30 days
            return {success: true, backups: backups.slice(0, KEEP_BACKUPS)};
        });
    }
    async function weeklyBackup(book) {
        if (readOnly) return {success: true, skipped: true, readOnly: true};
        const backups = await listBackups(book);
        if (backups[0] && Date.now() - Date.parse(backups[0].createdTime) < WEEK) return {success: true, skipped: true, backups};
        return backupNow(book, 'weekly');
    }
    function restoreBackup(book, fileId) {
        return serialize(async () => {
            guardWrite();
            const backups = await listBackups(book), chosen = backups.find(b => b.id === fileId);
            if (!chosen) throw fail('找不到這份備份。', 'BACKUP', false);
            const saved = JSON.parse(await mediaText(fileId)), old = saved?.head;
            if (saved?.format !== APP || saved.book !== book.id || !old || !Array.isArray(old.pages)) throw fail('備份檔格式不正確，沒有還原。', 'BACKUP', false);
            old.pages.forEach(d => checkFile(d, 'catalog'));
            // Every text page must still be in Drive before anything changes.
            await limit(old.pages, async d => {
                const meta = await api('/files/' + encodeURIComponent(d.fileId) + '?fields=size,trashed');
                if (meta.trashed || Number(meta.size) !== d.bytes) throw fail('備份需要的文字頁已不在雲端，沒有還原。', 'BACKUP', false);
            }, 6);
            headCache.delete(book.id);
            const previous = await currentHead(book);
            const revision = uuid();
            const head = {format: APP, revision, previous: previous.revision, pages: old.pages, count: old.count, preload: old.preload || [],
                updatedAt: new Date().toISOString(), restoredFrom: chosen.name};
            const folder = await bucket(await sha256(enc.encode(book.id + revision)), true);
            const file = await createFile({name: book.id + '-' + revision + '.json', parents: [folder], mimeType: 'application/json'}, JSON.stringify(head), 'application/json', 'id');
            const pointerId = await pointerFile(book, true);
            await replaceContent(pointerId, JSON.stringify({format: APP, book: book.id, revision, headId: file.id, updatedAt: head.updatedAt}), 'application/json');
            headCache.set(book.id, {head, fileId: file.id});
            return {success: true, revision, count: head.count};
        });
    }

    /* ---------- tidying old versions ----------
       Every save writes a small version file. Keep the newest KEEP_VERSIONS, plus the
       last one of each month, plus the current one; move the rest to Drive trash
       (recoverable there for 30 days). Text pages and images are never touched. */
    const KEEP_VERSIONS = 200;
    async function trashFile(id) {
        guardWrite();
        return api('/files/' + encodeURIComponent(id) + '?fields=id', {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({trashed: true})});
    }
    async function versionPlan(book) {
        const pattern = headName(book);
        const heads = (await list("name contains '" + q(book.id) + "' and mimeType='application/json' and trashed=false", 'id,name,createdTime', 'createdTime desc'))
            .filter(f => pattern.test(f.name));
        headCache.delete(book.id); await currentHead(book);
        const current = headCache.get(book.id)?.fileId, keep = new Set(heads.slice(0, KEEP_VERSIONS).map(f => f.id)), months = new Set();
        if (current) keep.add(current);
        for (const f of heads) {
            const month = new Date(Date.parse(f.createdTime) + 8 * 3600000).toISOString().slice(0, 7);
            if (!months.has(month)) {months.add(month); keep.add(f.id);}
        }
        return {total: heads.length, keep: heads.filter(f => keep.has(f.id)).length, trash: heads.filter(f => !keep.has(f.id)).map(f => f.id)};
    }
    async function cleanupVersions(book, onProgress = () => {}) {
        guardWrite();
        const plan = await versionPlan(book);
        let done = 0;
        await limit(plan.trash, async id => {await trashFile(id); if (++done % 20 === 0 || done === plan.trash.length) onProgress(done, plan.trash.length);}, 6);
        return {success: true, total: plan.total, kept: plan.keep, trashed: done};
    }

    /* ---------- previews ---------- */
    async function getPreviews(files) {
        if (!Array.isArray(files) || files.length > 12) throw fail('預覽清單不正確。', 'PREVIEW', false);
        const result = await limit(files, async d => {
            try {
                checkFile(d, 'preview');
                const bytes = await mediaBytes(d.fileId);
                if (bytes.length !== d.bytes || await sha256(bytes) !== d.key) throw new Error('預覽內容不完整。');
                return {file: d, data: b64(bytes)};
            } catch (_) {return {file: d, error: '這張預覽暫時無法讀取，點擊可重試。'};}
        });
        return {success: true, files: result};
    }

    /* ---------- OCR (image text search), same index files as before ---------- */
    function ocrEntry(entry) {
        if (!entry || entry.complete || entry.engine === OCR_ENGINE || !['OCR_SERVICE', 'OCR_REQUEST', 'OCR_PERMISSION'].includes(entry.code)) return entry;
        const value = {...entry, engine: OCR_ENGINE};
        for (const name of ['error', 'code', 'retryAfter', 'diagnostic']) delete value[name];
        return value;
    }
    const ocrPrefix = key => Math.floor(parseInt(key.slice(0, 2), 16) / 4).toString(16).padStart(2, '0');
    async function ocrShards() {
        if (ocrShardMap) return ocrShardMap;
        await buckets();
        const map = new Map();
        if (ocrFolder) for (const f of await list("'" + ocrFolder + "' in parents and trashed=false", 'id,name,createdTime', 'createdTime'))
            {const m = /^ocr-v1-([0-9a-f]{2})\.json$/.exec(f.name); if (m && !map.has(m[1])) map.set(m[1], f.id);}
        ocrShardMap = map; return map;
    }
    async function ocrShard(prefix) {
        const id = (await ocrShards()).get(prefix);
        if (!id) return {schema: 1, entries: {}};
        const value = JSON.parse(await mediaText(id));
        if (value.schema !== 1 || !value.entries || Array.isArray(value.entries)) throw fail('圖片文字索引暫時無法讀取，原筆記未更動。', 'OCR_INDEX');
        return value;
    }
    async function ocrIndex(packet) {
        if (!Array.isArray(packet.keys) || packet.keys.length > 5000 || packet.keys.some(k => !HEX64.test(k))) throw fail('圖片文字索引清單不正確。', 'OCR_INDEX', false);
        const groups = {};
        for (const key of new Set(packet.keys)) (groups[ocrPrefix(key)] ||= []).push(key);
        const entries = {};
        await limit(Object.keys(groups), async prefix => {
            const shard = await ocrShard(prefix);
            for (const key of groups[prefix]) if (shard.entries[key]) entries[key] = ocrEntry(shard.entries[key]);
        }, 6);
        return {success: true, entries};
    }
    function ocrStore(key, update) {
        return serialize(async () => {
            const prefix = ocrPrefix(key), shard = await ocrShard(prefix);
            const entry = update(shard.entries[key] || {parts: {}, text: '', complete: false});
            shard.entries[key] = entry;
            const raw = JSON.stringify(shard), map = await ocrShards();
            if (map.has(prefix)) await replaceContent(map.get(prefix), raw, 'application/json');
            else {
                if (!ocrFolder) {
                    guardWrite();
                    ocrFolder = (await api('/files?fields=id', {method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({name: OCR_FOLDER_NAME, mimeType: FOLDER, parents: [root]})})).id;
                }
                const file = await createFile({name: 'ocr-v1-' + prefix + '.json', parents: [ocrFolder], mimeType: 'application/json'}, raw, 'application/json', 'id');
                map.set(prefix, file.id);
            }
            return entry;
        });
    }
    async function ocrHttp(response, stage) {
        if (response.ok) return;
        let body = {};
        try {body = (await response.json()).error || {};} catch (_) {}
        const clean = v => String(v || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 240);
        const status = response.status, message = clean(body.message) || 'Google 未提供詳細原因。';
        const reasons = (Array.isArray(body.errors) ? body.errors.slice(0, 5) : []).map(e => clean(e.reason)).filter(Boolean);
        const quota = status === 429 || /quota|rate.?limit|too many|limit.?exceeded/i.test([message, ...reasons].join(' '));
        const code = quota ? 'OCR_QUOTA' : status === 400 ? 'OCR_REQUEST' : [401, 403].includes(status) ? 'OCR_PERMISSION' : 'OCR_SERVICE';
        throw Object.assign(new Error(quota ? 'Google 圖片辨識額度暫時用完，稍後會接續辨識。' : 'Google 圖片辨識回覆 ' + status + '（' + stage + '）：' + message),
            {code, diagnostic: {engine: OCR_ENGINE, stage, status, message, reasons, fields: []},
                retryAfter: Date.now() + (quota ? 3600000 : ['OCR_REQUEST', 'OCR_PERMISSION'].includes(code) ? 300000 : 60000)});
    }
    async function ocrRecognize(packet) {
        const d = checkFile(packet.file, 'asset'), part = packet.part || {index: 0, total: 1}, {index, total} = part;
        if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total || total < 1 || total > 64) throw fail('圖片辨識分區不正確。', 'OCR_REQUEST', false);
        const existing = ocrEntry((await ocrShard(ocrPrefix(d.key))).entries[d.key]);
        if (existing?.complete || (existing?.parts && Object.prototype.hasOwnProperty.call(existing.parts, String(index)))) return {success: true, entry: existing};
        if (existing?.retryAfter > Date.now() && !packet.force) return {success: true, entry: existing};
        if (readOnly) return {success: true, entry: {...(existing || {parts: {}, text: '', complete: false}), retryAfter: Date.now() + 600000}};
        const leaseKey = d.key + '-' + index;
        if (ocrLeases.get(leaseKey) > Date.now()) return {success: true, pending: true, retryAfter: Date.now() + 5000};
        ocrLeases.set(leaseKey, Date.now() + 420000);
        let documentId = null;
        try {
            let bytes, mime;
            if (typeof part.data === 'string') {
                if (part.data.length > 2800000 || !['image/jpeg', 'image/png'].includes(part.mime)) throw new Error('圖片辨識分區過大或格式不支援。');
                bytes = un64(part.data); mime = part.mime;
            } else {
                if (index !== 0 || total !== 1 || d.bytes > 2000000 || !['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(d.mime)) throw new Error('這張圖片需要先準備辨識分區。');
                bytes = await mediaBytes(d.fileId); mime = d.mime;
                if (bytes.length !== d.bytes || await sha256(bytes) !== d.key) throw new Error('原圖校驗未通過，已停止辨識。');
            }
            if (!bytes.length || bytes.length > 2000000) throw new Error('圖片辨識分區需小於 2 MB。');
            // Uploading an image as a Google Doc makes Drive run its built-in OCR.
            const boundary = 'nd_ocr_' + uuid().replace(/-/g, '');
            const metadata = {name: '_note_ocr_' + d.key + '_' + index, mimeType: 'application/vnd.google-apps.document', parents: [root]};
            const body = new Blob(['--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n', bytes, '\r\n--' + boundary + '--\r\n']);
            const created = await http(UPLOAD + '/files?uploadType=multipart&fields=id', {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + boundary}, body});
            await ocrHttp(created, '上傳圖片並轉換文字');
            documentId = (await created.json()).id;
            const exported = await http(API + '/files/' + encodeURIComponent(documentId) + '/export?mimeType=text%2Fplain');
            await ocrHttp(exported, '讀取辨識文字');
            const text = (await exported.text()).replace(/\u0000/g, '').trim();
            const entry = await ocrStore(d.key, previous => {
                if (previous.complete) return previous;
                if (previous.total && previous.total !== total) throw new Error('圖片辨識分區版本不同，請重新開啟後重試。');
                const parts = {...previous.parts, [index]: text};
                const complete = Array.from({length: total}, (_, i) => Object.prototype.hasOwnProperty.call(parts, String(i))).every(Boolean);
                return {parts, total, text: Object.keys(parts).sort((a, b) => a - b).map(k => parts[k]).join('\n'), complete, engine: OCR_ENGINE, updatedAt: new Date().toISOString()};
            });
            return {success: true, entry};
        } catch (error) {
            if (error.code === 'READ_ONLY') throw error;
            const retryAfter = error.retryAfter || Date.now() + 60000;
            const entry = await ocrStore(d.key, previous => previous.complete ? previous : ({...previous, retryAfter, code: error.code || 'OCR_IMAGE',
                error: String(error.message || error).slice(0, 300), diagnostic: error.diagnostic || null, engine: OCR_ENGINE, updatedAt: new Date().toISOString()}));
            return {success: true, entry};
        } finally {
            if (documentId) http(API + '/files/' + encodeURIComponent(documentId), {method: 'DELETE'}).catch(() => {});
            ocrLeases.delete(leaseKey);
        }
    }

    /* ---------- Images dragged in from other websites (Yamol, Google Images, ...).
       Browsers may not read another site's image bytes, so a small Apps Script proxy owned
       by the user downloads them (tools/image-proxy.gs). The proxy only serves the owner:
       it checks this site's Google sign-in token before fetching anything. ---------- */
    async function externalImage(url) {
        const proxy = window.NOTE_SITE_CONFIG?.imageProxyUrl;
        if (!proxy) throw fail('圖片代理尚未設定；圖片連結與筆記都會保留。截圖貼上或「複製圖片」再貼上仍可使用。', 'EXTERNAL_IMAGE_PROXY', false);
        let response;
        try {
            response = await fetch(proxy, {method: 'POST', credentials: 'omit', redirect: 'follow',
                headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({url, token: await noteAuth.getToken()})});
        } catch (_) {throw fail('無法連到圖片代理，請檢查網路；圖片連結仍保留。', 'EXTERNAL_IMAGE_PROXY');}
        if (!response.ok) throw fail('圖片代理回覆 ' + response.status + '；圖片連結仍保留。', 'EXTERNAL_IMAGE_PROXY');
        let value;
        try {value = await response.json();}
        catch (_) {throw fail('圖片代理回覆格式不正確（請確認部署的存取權是「所有人」）。', 'EXTERNAL_IMAGE_PROXY', false);}
        if (!value?.success) throw fail(value?.error || '圖片讀取失敗。', value?.code || 'EXTERNAL_IMAGE_HTTP', value?.retryable !== false);
        return value;
    }

    /* ---------- entry point ---------- */
    function bookOf(id) {const book = books.find(b => b.id === id); if (!book) throw fail('找不到這個科目。', 'BOOK', false); return book;}
    async function call(packet) {
        try {
            if (!packet || typeof packet !== 'object') throw fail('請求格式不正確。', 'REQUEST', false);
            const book = bookOf(packet.book);
            switch (packet.action) {
                case 'read': return await read(book, packet.knownRevision, packet.skipPreviews === true, packet.verify === true);
                case 'pages': return await pages(book, packet.revision, packet.indices);
                case 'commit': return await commit(book, packet);
                case 'small': {
                    if (!['asset', 'preview'].includes(packet.role) || (packet.role === 'preview' && packet.bytes > 500000)) throw fail('小型檔案類型不正確。', 'UPLOAD', false);
                    guardWrite();
                    return {success: true, done: true, file: await storeSmall(packet, packet.role)};
                }
                case 'previews': return await getPreviews(packet.files);
                case 'ocrIndex': return await ocrIndex(packet);
                case 'ocrRecognize': return await ocrRecognize(packet);
                case 'rootJsonRead': return {success: true, value: await rootJsonRead(packet.name)};
                case 'backups': return {success: true, backups: await listBackups(book)};
                case 'backupNow': return await backupNow(book, packet.kind === 'before-restore' ? 'before-restore' : 'manual');
                case 'weeklyBackup': return await weeklyBackup(book);
                case 'restoreBackup': return await restoreBackup(book, packet.fileId);
                case 'versionPlan': {const plan = await versionPlan(book); return {success: true, total: plan.total, keep: plan.keep, trash: plan.trash.length};}
                case 'cleanupVersions': return await cleanupVersions(book, packet.onProgress);
                case 'quota': return {success: true, ...await api('/about?fields=storageQuota,user(emailAddress,displayName)')};
                case 'externalImage': return await externalImage(packet.url);
                case 'legacyRead': throw fail('舊版雲端已全部搬移完成，新版網站不再讀取舊雲端。', 'LEGACY_REMOVED', false);
                default: throw fail('不支援的動作。', 'REQUEST', false);
            }
        } catch (e) {
            return {success: false, code: e.code || 'CLIENT', error: String(e.message || e).slice(0, 500), retryable: e.retryable !== false};
        }
    }

    async function initialize(config) {
        books = config.books;
        if (config.offline) {   // no internet: use the folder found last time; Drive is contacted again once online
            root = localStorage.getItem('nd-root');
            if (!root) throw fail('這台裝置還沒有連線開過筆記，請先連上網路開一次。', 'OFFLINE', false);
            return root;
        }
        root = await findRoot();
        await buckets();
        return root;
    }
    function setReadOnly(value) {readOnly = !!value;}
    return {initialize, call, uploadBlob, downloadBlob, setReadOnly, isReadOnly: () => readOnly, rootJsonRead, rootJsonUpdate};
})();
