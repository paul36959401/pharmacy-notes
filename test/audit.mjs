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
async function open(viewport, mobile = false) {
    const context = await browser.newContext({viewport, ...(mobile ? {isMobile: true, hasTouch: true, deviceScaleFactor: 2} : {})});
    await drive.install(context);
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    await page.goto(BASE + '?book=pharmacology');
    await page.click('#site-gate-button');
    await page.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 60000});
    return {context, page};
}
const out = process.argv[2] || '/tmp/audit';
await (await import('node:fs/promises')).mkdir(out, {recursive: true});
try {
    let {context, page} = await open({width: 1100, height: 900});
    await page.setInputFiles('#drive-file', backupPath);
    await page.waitForFunction(() => /JSON 已同步/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 120000});
    await page.waitForTimeout(3000);
    await context.close();
    const shot = async (page, name) => {await page.waitForTimeout(500); await page.screenshot({path: `${out}/${name}.png`});};
    for (const [name, vp, mobile] of [['d', {width: 1280, height: 860}, false], ['m', {width: 390, height: 844}, true]]) {
        ({context, page} = await open(vp, mobile));
        await page.waitForTimeout(2500);
        await shot(page, name + '-01-list');
        await page.click('#drive-tools summary'); await shot(page, name + '-02-settings'); await page.click('#drive-tools summary');
        await page.evaluate(() => openEditModal('n1')); await page.waitForTimeout(1200); await shot(page, name + '-03-editor');
        await page.evaluate(() => {const img = document.querySelector('#modal-text img'); img?.click();}); await shot(page, name + '-04-editor-image-selected');
        await page.evaluate(() => closeModal()); await page.waitForTimeout(400);
        await page.evaluate(() => openAddModal()); await shot(page, name + '-05-add'); await page.evaluate(() => closeModal()); await page.waitForTimeout(300);
        await page.evaluate(() => openRandomDrawModal()); await shot(page, name + '-06-random'); await page.evaluate(() => closeRandomDrawModal?.());
        await page.evaluate(() => openHistoryModal()); await shot(page, name + '-07-history'); await page.keyboard.press('Escape'); await page.evaluate(() => document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')));
        await page.evaluate(() => openCategoryOverviewModal()); await shot(page, name + '-08-categories'); await page.evaluate(() => document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')));
        await page.evaluate(() => openMoveModal()); await shot(page, name + '-09-move'); await page.evaluate(() => document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')));
        await page.click('#note-recovery-open').catch(() => {}); await shot(page, name + '-10-trash'); await page.evaluate(() => document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')));
        await page.keyboard.press('Escape'); await page.evaluate(() => document.getElementById('sync-status').click()); await shot(page, name + '-11-sync'); await page.keyboard.press('Escape');
        await page.evaluate(() => openNoteCategoryModal('n1')); await shot(page, name + '-12-note-category'); await page.evaluate(() => document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')));
        await page.evaluate(() => togglePreviewMode()); await shot(page, name + '-13-preview'); await page.evaluate(() => togglePreviewMode());
        await page.fill('#search-input', '筆記 1'); await page.keyboard.press('Enter'); await shot(page, name + '-14-search'); await page.fill('#search-input', ''); await page.evaluate(() => filterNotes());
        await page.evaluate(() => {const img = document.querySelector('#note-list .note-text img'); img?.click();}); await shot(page, name + '-15-viewer'); await page.keyboard.press('Escape');
        await context.close();
    }
} catch (error) {console.error('SHOT ERROR', error); process.exitCode = 1;}
finally {await browser.close(); server.close();}
