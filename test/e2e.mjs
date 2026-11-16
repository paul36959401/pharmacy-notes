// End-to-end test against an in-memory Drive. Run: node test/e2e.mjs
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {createRequire} from 'node:module';
import {createMockDrive} from './mock-drive.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const sharp = require('/opt/npm-tools/node_modules/sharp');

const SITE = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:8765/pharmacy-notes/';
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/gzip', '.json': 'application/json'};
const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, BASE).pathname).replace(/^\/pharmacy-notes\//, '/');
    if (path.endsWith('/')) path += 'index.html';
    try {
        let body = await readFile(join(SITE, normalize(path)));
        if (path === '/js/config.js') body = Buffer.from(body.toString().replace(/clientId: '[^']*'/, "clientId: 'test-client.apps.googleusercontent.com'").replace(/imageProxyUrl: '[^']*'/, "imageProxyUrl: 'https://script.google.com/macros/s/TEST/exec'"));
        res.writeHead(200, {'content-type': types[extname(path)] || 'application/octet-stream'}); res.end(body);
    } catch (_) {res.writeHead(404); res.end('not found');}
}).listen(8765);

const drive = createMockDrive();
const root = drive.add({name: '藥學筆記雲端工作台', mimeType: 'application/vnd.google-apps.folder'});

async function png(w, h, color, label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/><text x="20" y="${h / 2}" font-size="40" fill="#fff">${label}</text></svg>`;
    return 'data:image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}
async function noisePng(w, h) {
    const raw = Buffer.alloc(w * h * 3); for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0;
    return 'data:image/png;base64,' + (await sharp(raw, {raw: {width: w, height: h, channels: 3}}).png({compressionLevel: 0}).toBuffer()).toString('base64');
}
const inlineImg = await png(400, 250, '#dc2626', 'inline');
const gallery1 = await png(500, 300, '#2563eb', 'gallery-1');
const gallery2 = await png(300, 300, '#16a34a', 'gallery-2');
const big = await noisePng(1500, 1400);
console.log('big image MB', (big.length * 3 / 4 / 1e6).toFixed(1));
const backup = {notes: [
    {id: 'n1', title: '', text: '<p><b>Omeprazole</b>：弱鹼性的 <mark>Prodrug</mark></p><p><img src="' + inlineImg + '"></p>', categoryIds: ['c1'], starred: true, createdAt: '2025-01-01T00:00:00Z'},
    {id: 'n2', title: '舊格式圖片區', text: '<p>這則筆記的圖片在獨立圖片區</p>', images: [gallery1, gallery2], categoryIds: [], createdAt: '2025-01-02T00:00:00Z'},
    {id: 'n4', title: '連結圖片', text: '<p>阿摩的圖</p><p><img src="https://img.yamol.tw/file/test.jpg#s-591,250"></p>', categoryIds: [], createdAt: '2025-01-04T00:00:00Z'},
    {id: 'n3', title: '大圖', text: '<p>超過 5 MB 的圖</p><p><img src="' + big + '"></p>', categoryIds: [], createdAt: '2025-01-03T00:00:00Z'},
    ...Array.from({length: 12}, (_, i) => ({id: 'm' + i, title: '', text: '<p>筆記 ' + i + '</p>', categoryIds: [], createdAt: '2025-02-01T00:00:00Z'})),
    {id: '__NOTE_CATEGORIES__', _type: 'system-categories', records: [{id: 'c1', name: '胃藥', abbr: '胃藥', color: '#f59e0b'}]}
]};
const backupPath = '/tmp/nd-backup.json';
await (await import('node:fs/promises')).writeFile(backupPath, JSON.stringify(backup));

const browser = await chromium.launch();
const problems = [];
async function open(label, {fresh = true} = {}) {
    const context = await browser.newContext({viewport: {width: 1100, height: 900}});
    await drive.install(context);
    const page = await context.newPage();
    page.on('console', m => {if (m.type() === 'error') problems.push(label + ' console: ' + m.text());});
    page.on('pageerror', e => problems.push(label + ' pageerror: ' + e.message));
    page.on('dialog', d => d.accept());
    await page.goto(BASE + '?book=pharmacology');
    return {context, page};
}
async function signInAndWait(page) {
    await page.click('#site-gate-button');
    await page.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 60000});
}
const headFiles = () => [...drive.files.values()].filter(f => /^pharmacology-[0-9a-f-]{36}\.json$/.test(f.name));
const check = (cond, message) => {console.log((cond ? 'PASS ' : 'FAIL ') + message); if (!cond) process.exitCode = 1;};

try {
    // 1. First visit: read-only by default.
    let {context, page} = await open('visit1');
    await signInAndWait(page);
    check(await page.isVisible('#site-readonly'), 'read-only banner shown on first visit');
    const writesBefore = drive.stats.writes;
    await page.waitForTimeout(1500);
    check(drive.stats.writes === writesBefore, 'read-only mode wrote nothing to Drive');

    // 2. Enable editing (reloads), then import the backup JSON.
    await page.click('#site-readonly-enable');
    await page.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 60000});
    check(!(await page.isVisible('#site-readonly')), 'banner hidden after enabling edits');
    await page.setInputFiles('#drive-file', backupPath);
    await page.waitForFunction(() => /JSON 已同步/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 120000});
    console.log('import message:', await page.textContent('#drive-message'));
    await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 120000}).catch(() => {});
    await page.waitForTimeout(2000);
    const heads = headFiles();
    check(heads.length >= 1, 'a version (head) file was written: ' + heads.length);
    const head = JSON.parse(heads.at(-1).content.toString());
    check(head.count === 18, 'head counts 18 records (16 notes + categories + edit history): ' + head.count);
    const pointer = [...drive.files.values()].find(f => f.name === 'nd-pointer-pharmacology.json');
    check(pointer && JSON.parse(pointer.content).revision === head.revision, 'pointer file points at newest version');
    const assets = [...drive.files.values()].filter(f => f.name.startsWith('nd-asset-'));
    const previews = [...drive.files.values()].filter(f => f.name.startsWith('nd-preview-'));
    check(assets.length >= 4 && previews.length >= 4, 'images stored as asset + preview files: ' + assets.length + '/' + previews.length);
    check(assets.some(f => f.content.length > 5 * 1024 * 1024), 'large image (>5 MB) uploaded via resumable upload');
    check(assets.every(f => drive.sha(f.content) === f.name.slice(9)), 'every stored image matches its SHA-256 name');
    console.log('drive request kinds:', drive.stats.byKind);

    // 2b. Convert old gallery images into the note text.
    await page.click('#drive-tools summary');
    check(await page.isVisible('#drive-gallery-convert'), 'gallery convert button shows: ' + await page.textContent('#drive-gallery-convert'));
    const totalsBefore = await page.evaluate(() => noteGalleryConverter.totals());
    await page.click('#drive-gallery-convert');
    await page.waitForFunction(() => /轉換完成|不符|尚未|請先/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 120000});
    console.log('convert message:', await page.textContent('#drive-message'));
    const totalsAfter = await page.evaluate(() => noteGalleryConverter.totals());
    check(totalsAfter.gallery === 0 && totalsAfter.all === totalsBefore.all, 'gallery converted, image total unchanged: ' + JSON.stringify([totalsBefore, totalsAfter]));
    const n2 = await page.evaluate(() => {const n = notesData.find(x => x.id === 'n2'); return {images: n.images, text: n.text};});
    check((n2.text.match(/<img\b/g) || []).length === 2 && !n2.images?.length, 'note n2 now has its 2 images inside the text');
    await page.waitForTimeout(3000);
    await context.close();

    // 3. Another "device" (fresh storage): everything must render from Drive.
    ({context, page} = await open('visit2'));
    await signInAndWait(page);
    await page.waitForTimeout(1500);
    const listText = await page.textContent('body');
    check(/Omeprazole/.test(listText) && /舊格式圖片區/.test(listText), 'notes text renders on a fresh device');
    // Show all notes on one page and scroll so lazy images load.
    for (let y = 0; y < 6000; y += 500) {await page.mouse.wheel(0, 500); await page.waitForTimeout(150);}
    await page.waitForTimeout(3000);
    const images = await page.$$eval('img', list => list.filter(i => i.closest('.note-item')).map(i => ({w: i.naturalWidth, src: i.src.slice(0, 30), complete: i.complete})));
    console.log('note images:', images);
    check(images.filter(i => i.w > 0).length >= 3, 'note images load on a fresh device (' + images.filter(i => i.w > 0).length + ')');
    await page.screenshot({path: '/tmp/nd-visit2.png', fullPage: false});
    await context.close();

    // 3b. Drag an image in from Google Images (full image via proxy; thumbnail fallback).
    ({context, page} = await open('drag'));
    const proxied = [];
    const fullPng = Buffer.from((await png(640, 480, '#9333ea', 'full')).split(',')[1], 'base64');
    await context.route('https://script.google.com/macros/s/TEST/exec', async route => {
        const body = JSON.parse(route.request().postData() || '{}'); proxied.push(body); await new Promise(r => setTimeout(r, 1500));
        if (!body.token) return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({success: false, error: 'no token'})});
        if (body.url.includes('blocked')) return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({success: false, code: 'EXTERNAL_IMAGE_HTTP', error: '來源網站限制', retryable: false})});
        route.fulfill({status: 200, contentType: 'application/json', headers: {'access-control-allow-origin': '*'}, body: JSON.stringify({success: true, mime: 'image/png', bytes: fullPng.length, key: drive.sha(fullPng), data: fullPng.toString('base64')})});
    });
    await context.route('https://example.com/**', route => route.abort());
    await signInAndWait(page);
    console.log('step: signed in');
    await page.click('#site-readonly-enable');
    await page.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 60000});
    console.log('step: edit enabled');
    await page.waitForFunction(() => notesData.some(n => n.id === 'm1') && noteDriveCloud.state().loaded, null, {timeout: 60000});
    const thumb = await png(120, 90, '#f97316', 't');
    async function dragInto(html, uri) {
        console.log('step: open editor');
        await page.evaluate(() => openEditModal('m1'));
        await page.waitForFunction(() => document.getElementById('noteModal').classList.contains('active') && editingNoteId === 'm1');
        await page.evaluate(([html, uri]) => {
            const editor = document.getElementById('modal-text'), dt = new DataTransfer();
            dt.setData('text/html', html); dt.setData('text/uri-list', uri);
            const rect = editor.getBoundingClientRect(), opts = {bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.left + 10, clientY: rect.bottom - 5};
            editor.dispatchEvent(new DragEvent('dragenter', opts)); editor.dispatchEvent(new DragEvent('dragover', opts)); editor.dispatchEvent(new DragEvent('drop', opts));
        }, [html, uri]);
        await page.waitForTimeout(2500);
        const srcs = await page.$$eval('#modal-text img', l => l.map(i => i.getAttribute('src').slice(0, 40)));
        await page.evaluate(() => saveNote()); await page.waitForTimeout(500);
        return srcs;
    }
    let srcs = await dragInto('<a href="/imgres?imgurl=https%3A%2F%2Fexample.com%2Ffull.png&imgrefurl=https%3A%2F%2Fexample.com%2F"><img src="' + thumb + '"></a>', 'https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Ffull.png');
    console.log('drag srcs', srcs, 'proxy calls', proxied.map(p => p.url));
    check(proxied.some(p => p.url === 'https://example.com/full.png' && p.token), 'Google Images drag asks the proxy for the full-size image with the sign-in token');
    check(srcs.some(s => s.startsWith('data:image/png')), 'dragged Google image is stored inside the note');
    srcs = await dragInto('<a href="/imgres?imgurl=https%3A%2F%2Fexample.com%2Fblocked.png"><img src="' + thumb + '"></a>', '');
    check(srcs.filter(s => s.startsWith('data:image/png')).length >= 1 && proxied.some(p => p.url.includes('blocked')), 'when the full image is blocked, the thumbnail is used instead');
    srcs = await dragInto('<img src="https://i.yamol.tw/question/abc.png">', 'https://i.yamol.tw/question/abc.png');
    check(proxied.some(p => p.url === 'https://i.yamol.tw/question/abc.png'), 'Yamol image drag goes through the proxy');
    // Linked (hot-linked) images are downloaded and stored with the note.
    check(await page.evaluate(() => noteLinkedImages.count()) === 1, 'linked image tool finds the 1 linked image');
    await page.click('#drive-tools summary');
    await page.click('#drive-linked-images');
    await page.waitForFunction(() => /完成：|不符|請先/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 60000});
    console.log('linked message:', await page.textContent('#drive-message'));
    const n4 = await page.evaluate(() => notesData.find(n => n.id === 'n4').text);
    check(!/https:\/\/img\.yamol/.test(n4) && /<img/.test(n4) && await page.evaluate(() => noteLinkedImages.count()) === 0, 'linked Yamol image now stored inside the note');
    await page.waitForTimeout(2500);
    await context.close();

    // 4. Old-site compatibility: no pointer file, version found by search.
    drive.files.delete(pointer.id);
    ({context, page} = await open('visit3'));
    await signInAndWait(page);
    await page.waitForTimeout(1500);
    check(/Omeprazole/.test(await page.textContent('body')), 'loads by searching head files when no pointer exists (old-site data)');
    await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
    check(await page.evaluate(() => !/img\.yamol/.test(notesData.find(n => n.id === 'n4')?.text || 'img.yamol')), 'stored linked image survives reload from Drive');
    await context.close();
} catch (error) {
    console.error('TEST ERROR', error); process.exitCode = 1;
} finally {
    console.log('problems:', problems.length ? problems : 'none');
    await browser.close(); server.close();
}
