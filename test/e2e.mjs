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
        if (path === '/js/config.js') body = Buffer.from(body.toString().replace(/clientId: '[^']*'/, "clientId: 'test-client.apps.googleusercontent.com'"));
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
    check(head.count === 17, 'head counts 17 records (15 notes + categories + edit history): ' + head.count);
    const pointer = [...drive.files.values()].find(f => f.name === 'nd-pointer-pharmacology.json');
    check(pointer && JSON.parse(pointer.content).revision === head.revision, 'pointer file points at newest version');
    const assets = [...drive.files.values()].filter(f => f.name.startsWith('nd-asset-'));
    const previews = [...drive.files.values()].filter(f => f.name.startsWith('nd-preview-'));
    check(assets.length >= 4 && previews.length >= 4, 'images stored as asset + preview files: ' + assets.length + '/' + previews.length);
    check(assets.some(f => f.content.length > 5 * 1024 * 1024), 'large image (>5 MB) uploaded via resumable upload');
    check(assets.every(f => drive.sha(f.content) === f.name.slice(9)), 'every stored image matches its SHA-256 name');
    console.log('drive request kinds:', drive.stats.byKind);
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

    // 4. Old-site compatibility: no pointer file, version found by search.
    drive.files.delete(pointer.id);
    ({context, page} = await open('visit3'));
    await signInAndWait(page);
    await page.waitForTimeout(1500);
    check(/Omeprazole/.test(await page.textContent('body')), 'loads by searching head files when no pointer exists (old-site data)');
    await context.close();
} catch (error) {
    console.error('TEST ERROR', error); process.exitCode = 1;
} finally {
    console.log('problems:', problems.length ? problems : 'none');
    await browser.close(); server.close();
}
