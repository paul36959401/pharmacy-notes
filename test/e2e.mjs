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
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/gzip', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png'};
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
async function open(label, {fresh = true, serviceWorkers = 'block'} = {}) {
    const context = await browser.newContext({viewport: {width: 1100, height: 900}, serviceWorkers});
    await drive.install(context);
    const page = await context.newPage();
    page.on('console', m => {if (m.type() === 'error') problems.push(label + ' console: ' + m.text());});
    page.on('pageerror', e => problems.push(label + ' pageerror: ' + e.message));
    page.on('dialog', d => d.accept());
    await page.goto(BASE + '?book=pharmacology');
    return {context, page};
}
async function signInAndWait(page) {
    await page.waitForFunction(() => window.noteDriveStartupComplete === true || !document.getElementById('site-gate-button').hidden, null, {timeout: 60000});
    if (await page.isVisible('#site-gate-button')) await page.click('#site-gate-button');
    await page.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 60000});
}
const headFiles = () => [...drive.files.values()].filter(f => /^pharmacology-[0-9a-f-]{36}\.json$/.test(f.name));
const check = (cond, message) => {console.log((cond ? 'PASS ' : 'FAIL ') + message); if (!cond) process.exitCode = 1;};

try {
    // 1. First visit: read-only by default.
    let {context, page} = await open('visit1');
    await page.evaluate(() => localStorage.setItem('nd-allow-write', '0'));
    await page.reload();
    await signInAndWait(page);
    check(await page.isVisible('#site-readonly'), 'read-only banner shown on first visit');
    const writesBefore = drive.stats.writes;
    await page.waitForTimeout(1500);
    check(drive.stats.writes === writesBefore, 'read-only mode wrote nothing to Drive');

    // 2. Enable editing (reloads), then import the backup JSON.
    await page.evaluate(() => localStorage.setItem('nd-allow-write', '1'));
    await page.reload();
    await signInAndWait(page);
    check(!(await page.isVisible('#site-readonly')), 'banner hidden after enabling edits');
    await page.setInputFiles('#drive-file', backupPath);
    await page.waitForFunction(() => /JSON 已同步/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 120000});
    console.log('import message:', await page.textContent('#drive-message'));
    await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 120000}).catch(() => {});
    await page.waitForTimeout(2000);
    const heads = headFiles();
    check(heads.length >= 1, 'a version (head) file was written: ' + heads.length);
    const head = JSON.parse(heads.at(-1).content.toString());
    check(head.count === 19, 'head counts 19 records (16 notes + categories + edit history + draw log): ' + head.count);
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
    await page.waitForSelector('#drive-gallery-convert', {state: 'visible', timeout: 3000}).catch(() => {});
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
    // Buttons wired through data-on-* (no inline JavaScript).
    check(await page.evaluate(() => document.querySelectorAll('[onclick],[onmousedown],[oninput],[onchange],[onkeydown]').length) === 0, 'no inline JavaScript handlers left in the page');
    await page.click('#fab-history');
    check(await page.evaluate(() => document.getElementById('historyModal').classList.contains('active')), 'toolbar button opens the history window');
    await page.click('#historyModal [data-on-click="closeHistoryModal"]');
    check(await page.evaluate(() => !document.getElementById('historyModal').classList.contains('active')), 'close button closes it');
    await page.evaluate(() => openEditModal('m3'));
    await page.waitForFunction(() => document.getElementById('noteModal').classList.contains('active'));
    await page.click('#modal-text');
    await page.keyboard.press('Control+A');
    await page.click('[data-on-mousedown="applyEditorCommand"][data-args*="bold"]');
    await page.waitForTimeout(200);
    check(await page.evaluate(() => /<(b|strong)\b/.test(document.getElementById('modal-text').innerHTML)), 'editor bold button still works');
    await page.evaluate(() => saveNote()); await page.waitForTimeout(500);
    const starBefore = await page.evaluate(() => !!notesData.find(n => n.id === 'm2').starred);
    await page.click('#note-m2 [data-on-click="toggleStar"]').catch(async () => page.evaluate(() => document.querySelector('[data-on-click="toggleStar"][data-args*="m2"]')?.click()));
    await page.waitForTimeout(300);
    check(await page.evaluate(() => !!notesData.find(n => n.id === 'm2').starred) !== starBefore, 'star button toggles the star');
    // Image studio: 連續繪製 keeps the box tool after drawing.
    await page.evaluate(() => openEditModal('n1'));
    await page.waitForFunction(() => document.getElementById('noteModal').classList.contains('active'));
    await page.waitForTimeout(800);
    await page.evaluate(() => {const img = document.querySelector('#modal-text img'); const wrapper = img.closest('[data-inline-image-wrapper],.inline-image-wrapper') || img; noteImageEditor.open({image: wrapper});});
    await page.waitForFunction(() => noteImageEditor.isOpen() && !document.querySelector('#noteImageEditModal [data-studio-tool="rect"]').disabled, null, {timeout: 20000});
    await page.waitForTimeout(800);
    await page.click('#noteImageEditModal [data-studio-tool="rect"]');
    const box = await page.locator('#studio-viewport').boundingBox();
    const drag = async (x1, y1, x2, y2) => {await page.mouse.move(box.x + x1, box.y + y1); await page.mouse.down(); await page.mouse.move(box.x + x2, box.y + y2, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(250);};
    await drag(box.width * .30, box.height * .30, box.width * .45, box.height * .45);
    await drag(box.width * .55, box.height * .55, box.width * .70, box.height * .70);
    const studio = await page.evaluate(() => ({rectPressed: document.querySelector('#noteImageEditModal [data-studio-tool="rect"]').getAttribute('aria-pressed'), rects: (noteImageEditor.exportDraft?.()?.doc?.objects || []).filter(o => o.type === 'rect').length, shapes: document.querySelectorAll('#noteImageEditModal [data-studio-object]').length}));
    console.log('studio', studio);
    check(studio.rectPressed === 'true' && (studio.rects >= 2 || studio.shapes >= 2), 'box tool stays selected after drawing; two boxes drawn in a row');
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => document.querySelector('#noteImageEditModal [data-studio-tool="select"]').getAttribute('aria-pressed')) === 'true', 'Esc returns to the select tool');
    {
        // No separate 移動 tool; drag the empty part of the photo to move the view; Ctrl+drag box-selects.
        const noHand = await page.evaluate(() => !document.querySelector('#noteImageEditModal [data-studio-tool="hand"]'));
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 6; i++) {await page.mouse.wheel(0, -240); await page.waitForTimeout(60);}
        await page.waitForTimeout(400);
        const scroll = () => page.evaluate(() => {const v = document.getElementById('studio-viewport'); return [v.scrollLeft, v.scrollTop];});
        const count = () => page.evaluate(() => (noteImageEditor.exportDraft?.()?.doc?.objects || []).length);
        const s0 = await scroll(), c0 = await count();
        await drag(box.width * .9, box.height * .15, box.width * .6, box.height * .05);
        const s1 = await scroll(), c1 = await count();
        check(noHand && (s1[0] !== s0[0] || s1[1] !== s0[1]) && c1 === c0, 'no 移動 button; dragging the empty photo moves the view (zoomed by the wheel) and draws nothing: ' + JSON.stringify({s0, s1, c0, c1}));
        // Shapes share one button: ▾ menu, and A / L / E keys update it.
        const main = () => page.evaluate(() => {const b = document.querySelector('#noteImageEditModal [data-studio-shape-main]'); return b.dataset.studioTool + ':' + b.getAttribute('aria-pressed');});
        const m0 = await main();
        await page.click('#noteImageEditModal [data-studio-shape-more]');
        await page.click('#noteImageEditModal [data-studio-shape="ellipse"]');
        const m1 = await main();
        const rectAlone = await page.evaluate(() => !!document.querySelector('#noteImageEditModal .studio-tools > [data-studio-tool="rect"]'));
        check(m0.startsWith('arrow') && m1 === 'ellipse:true' && rectAlone, 'line/arrow/ellipse share one button (▾ menu); 方框 stays separate: ' + [m0, m1].join(' → '));
        // W / S move up / down the tool column; the old letter keys do nothing now.
        const pressed = () => page.evaluate(() => document.querySelector('#noteImageEditModal .studio-tools [data-studio-tool][aria-pressed="true"]')?.dataset.studioTool);
        const seq = [];
        await page.keyboard.press('s'); seq.push(await pressed());
        await page.keyboard.press('w'); seq.push(await pressed());
        await page.keyboard.press('w'); seq.push(await pressed());
        await page.keyboard.press('v'); seq.push(await pressed());
        for (let i = 0; i < 3; i++) await page.keyboard.press('w');
        seq.push(await pressed());
        await page.keyboard.press('w'); seq.push(await pressed());
        check(seq.join(',') === 'highlight,ellipse,rect,rect,select,crop', 'W/S step through the tools (wrapping), V no longer switches: ' + seq.join(','));
        await page.keyboard.press('s');
    }
    await page.evaluate(() => noteImageEditor.close(true));
    await page.waitForTimeout(500);
    await page.evaluate(() => closeModal()); await page.waitForTimeout(300);
    check(await page.evaluate(() => !noteImageEditor.isOpen() && !document.querySelector('.modal-overlay.active')), 'studio and editor closed');
    // 抽取記錄: draw, mark, review, sync to another device.
    await page.click('#btn-random-draw');
    await page.fill('#random-draw-count', '3');
    await page.selectOption('#random-draw-scope', 'all');
    await page.click('#randomDrawModal .btn-save');
    await page.waitForTimeout(500);
    const bars = await page.$$eval('.note-item .draw-mark', l => l.map(b => b.dataset.drawMark));
    check(bars.length === 3, '3 drawn notes each show 熟／不熟 buttons');
    await page.click(`.draw-mark[data-draw-mark="${bars[0]}"] button[data-mark="unknown"]`);
    await page.click(`.draw-mark[data-draw-mark="${bars[1]}"] button[data-mark="known"]`);
    check(await page.getAttribute(`.draw-mark[data-draw-mark="${bars[0]}"] button[data-mark="unknown"]`, 'aria-pressed') === 'true', '不熟 button shows as pressed');
    await page.click('#active-random-filter-bar [data-on-click="openDrawLogModal"]');
    await page.waitForTimeout(300);
    const logText = await page.textContent('#draw-log-list');
    check(/今天/.test(logText) && /抽 3 則/.test(logText) && /熟 1・不熟 1/.test(logText), 'log window lists today\'s draw with marks');
    {
        const stats = await page.evaluate(() => noteDrawLog.todayStats());
        const shown = await page.$$eval('#draw-log-stats b', b => b.map(x => x.textContent));
        check(shown.length === 4 && stats.draws >= 1 && stats.drawn >= 3 && shown[2] === String(stats.draws) && shown[3] === '1／1' && stats.added + stats.edited >= 1, 'today stats shown in 抽取記錄: ' + JSON.stringify({stats, shown}));
        await page.screenshot({path: '/tmp/stats.png'});
    }
    await page.click('#drawLogModal [data-draw-filter="unknown"]');
    check((await page.$$('#draw-log-list li')).length === 1, '只看不熟 shows only the 不熟 note');
    await page.click('#draw-log-today-unknown');
    await page.waitForTimeout(400);
    check((await page.$$('#note-list .note-item')).length === 1 && /正在看：今天不熟的筆記/.test(await page.textContent('#active-random-summary')), '顯示今天不熟的 shows that note on the main screen');
    await page.evaluate(() => clearRandomDraw());
    await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 60000}).catch(() => {});
    await page.waitForTimeout(1500);
    {
        const other = await open('device2');
        await signInAndWait(other.page);
        await other.page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        const synced = await other.page.evaluate(() => ({sessions: drawLog.length, unknown: noteDrawLog.todayUnknownIds().length, marks: drawLog.at(-1)?.items.map(i => i.mark)}));
        check(synced.sessions >= 1 && synced.unknown === 1 && synced.marks.filter(Boolean).length === 2, 'draw log and marks sync to another device: ' + JSON.stringify(synced));
        await other.context.close();
    }
    // Text pages already on this device are not downloaded again (open, and save confirmation).
    {
        const before = drive.stats.catalogDownloads || 0, headsBefore = headFiles().length;
        await page.evaluate(() => {const n = notesData.find(x => x.id === 'n1'); n.text += '<p>快取測試</p>'; autoSave(100);});
        await page.waitForFunction(n => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 60000}).catch(() => {});
        await page.waitForTimeout(1500);
        await page.reload();
        await signInAndWait(page);
        await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        check(headFiles().length > headsBefore && (drive.stats.catalogDownloads || 0) === before, 'save + reopen downloads no text pages already on this device: ' + ((drive.stats.catalogDownloads || 0) - before));
    }
    // Backups: weekly automatic backup, list, restore (with a safety backup first).
    {
        const folder = () => [...drive.files.values()].find(f => f.name === '每週備份');
        const backupsNow = () => [...drive.files.values()].filter(f => f.name.startsWith('backup-pharmacology-') && !f.trashed);
        await page.evaluate(() => {localStorage.removeItem('nd-weekly-check-pharmacology'); window.NOTE_BACKUP_DELAY = 0;});
        await page.evaluate(() => noteDriveServer.call({action: 'weeklyBackup', book: 'pharmacology'}));
        const weeklyCount = backupsNow().length;
        check(folder() && weeklyCount >= 1, 'weekly backup exists in 每週備份: ' + weeklyCount);
        await page.evaluate(() => noteDriveServer.call({action: 'weeklyBackup', book: 'pharmacology'}));
        check(backupsNow().length === weeklyCount, 'weekly backup does not repeat within a week');
        const marker = await page.evaluate(() => notesData.find(x => x.id === 'n1').text);
        await page.evaluate(() => {const n = notesData.find(x => x.id === 'n1'); n.text += '<p>還原後應消失</p>'; autoSave(100);});
        await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 60000}).catch(() => {});
        await page.waitForTimeout(1500);
        if (!await page.isVisible('#drive-backups')) await page.click('#drive-tools summary');
        await page.waitForSelector('#drive-backups', {state: 'visible'});
        await page.click('#drive-backups');
        await page.waitForSelector('#backup-list .backup-row button');
        await page.waitForTimeout(800); await page.screenshot({path: '/tmp/backup-modal.png'});
        await page.click('#backup-list .backup-row button');   // confirm() is accepted automatically
        await page.waitForEvent('load', {timeout: 60000});
        await signInAndWait(page);
        await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        const after = await page.evaluate(() => notesData.find(x => x.id === 'n1').text);
        check(after === marker && backupsNow().length === weeklyCount + 1 && backupsNow().some(f => f.appProperties?.ndKind === 'before-restore'), 'restore brings back the backup and keeps a 還原前 backup: ' + backupsNow().length);
    }
    // Tidy old versions: keep the newest 200 + one per month, the rest to Drive trash.
    {
        const bucketFolder = [...drive.files.values()].find(f => f.mimeType === 'application/vnd.google-apps.folder' && /^[0-9a-f]{2}$/.test(f.name));
        const sample = headFiles()[0];
        for (let i = 0; i < 230; i++) {
            const f = drive.add({name: 'pharmacology-' + crypto.randomUUID() + '.json', mimeType: 'application/json', parents: [bucketFolder.id], content: sample.content});
            f.createdTime = f.modifiedTime = new Date(Date.parse('2025-01-01T00:00:00Z') + i * 86400000).toISOString();   // ~8 months, all older than the mock clock
        }
        const live = () => headFiles().filter(f => !f.trashed).length, total = live();
        if (!await page.isVisible('#drive-tidy')) await page.click('#drive-tools summary');
        await page.waitForSelector('#drive-tidy', {state: 'visible'});
        await page.click('#drive-tidy');
        await page.waitForFunction(() => /整理完成|不需要整理|未完成/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 60000});
        const message = await page.textContent('#drive-message');
        const current = JSON.parse([...drive.files.values()].find(f => f.name === 'nd-pointer-pharmacology.json').content).headId;
        check(/整理完成/.test(message) && live() < total && live() >= 200 && !drive.files.get(current).trashed, 'tidy keeps 200+monthly, keeps the current one: ' + total + ' -> ' + live() + ' (' + message + ')');
        await page.reload(); await signInAndWait(page);
        await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        check(await page.evaluate(() => notesData.some(x => x.id === 'n1')), 'notes still open normally after tidying');
    }
    // Home-screen app: manifest + icons, and opening without internet shows the notes kept on the device.
    {
        const pwa = await open('pwa', {serviceWorkers: 'allow'});
        await signInAndWait(pwa.page);
        await pwa.page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        const manifest = await pwa.page.evaluate(async () => {const link = document.querySelector('link[rel=manifest]'); const m = await (await fetch(link.href)).json(); const icons = await Promise.all(m.icons.map(async i => (await fetch(new URL(i.src, link.href))).ok)); return {name: m.name, display: m.display, icons: icons.every(Boolean) && icons.length};});
        check(manifest.name === '藥學筆記雲端' && manifest.display === 'standalone' && manifest.icons === 3, 'manifest and icons for 加入主畫面: ' + JSON.stringify(manifest));
        await pwa.page.waitForFunction(() => navigator.serviceWorker.controller, null, {timeout: 20000}).catch(() => {});
        await pwa.page.waitForTimeout(2500);
        const notesOnline = await pwa.page.$$eval('#note-list .note-item', l => l.length);
        await pwa.context.setOffline(true);
        await pwa.page.reload();
        await pwa.page.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 30000}).catch(() => {});
        await pwa.page.waitForTimeout(1500);
        const offline = await pwa.page.evaluate(() => ({banner: !document.getElementById('site-offline').hidden, gate: !document.getElementById('site-gate').hidden, notes: document.querySelectorAll('#note-list .note-item').length}));
        check(offline.banner && !offline.gate && offline.notes === notesOnline && notesOnline > 0, 'opens offline from this device, without sign-in: ' + JSON.stringify({...offline, notesOnline}));
        await pwa.context.close();
    }
    // 問 AI: right-click menu, Gemini answer, remembered answers, PubChem structure, sticky notes.
    {
        const geminiBodies = [];
        const cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*'};
        await context.route('https://generativelanguage.googleapis.com/**', async route => {
            const r = route.request();
            if (r.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
            if (r.headers()['x-goog-api-key'] !== 'test-gemini-key') return route.fulfill({status: 400, headers: {...cors, 'content-type': 'application/json'}, body: JSON.stringify({error: {message: 'API key not valid. Please pass a valid API key.'}})});
            if (r.method() === 'GET') return route.fulfill({status: 200, headers: {...cors, 'content-type': 'application/json'}, body: JSON.stringify({models: [{name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent']}]})});
            const body = r.postData(); geminiBodies.push(body);
            if (r.url().includes(':generateContent')) return route.fulfill({status: 200, headers: {...cors, 'content-type': 'application/json'}, body: JSON.stringify({candidates: [{content: {parts: [{text: '{"name":"Omeprazole","single":true}'}]}}]})});
            const chunk = text => 'data: ' + JSON.stringify({candidates: [{content: {parts: [{text}]}}]}) + '\r\n\r\n';
            return route.fulfill({status: 200, headers: {...cors, 'content-type': 'text/event-stream'}, body: chunk('## 分類\n- **PPI**（質子幫浦抑制劑）\n') + chunk('## 機轉\n- 不可逆抑制 H+/K+ ATPase\n\n| 項目 | 內容 |\n|---|---|\n| 前驅藥 | 是 |\n')});
        });
        await context.route('https://pubchem.ncbi.nlm.nih.gov/**', async route => {
            const url = route.request().url();
            if (url.includes('/PNG')) return route.fulfill({status: 200, headers: {...cors, 'content-type': 'image/png'}, body: Buffer.from(inlineImg.split(',')[1], 'base64')});
            if (/name\/Omeprazole\//i.test(url)) return route.fulfill({status: 200, headers: {...cors, 'content-type': 'application/json'}, body: JSON.stringify({PropertyTable: {Properties: [{CID: 4594, Title: 'Omeprazole', MolecularFormula: 'C17H19N3O3S'}]}})});
            return route.fulfill({status: 404, headers: cors, body: 'not found'});
        });
        await page.reload(); await signInAndWait(page);
        await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        if (!await page.$('#text-n1')) {await page.fill('#search-input', 'Omeprazole'); await page.waitForTimeout(800);}
        const before = await page.evaluate(() => notesData.find(x => x.id === 'n1').text);
        // Right-click without a selection: no AI menu (the browser's own menu).
        await page.click('#text-n1', {button: 'right', position: {x: 3, y: 3}});
        check(!await page.$('.ai-menu'), 'right-click without selecting text shows no AI menu');
        await page.evaluate(() => {const b = document.querySelector('#text-n1 b'); const r = document.createRange(); r.selectNodeContents(b); getSelection().removeAllRanges(); getSelection().addRange(r);});
        const box = await (await page.$('#text-n1 b')).boundingBox();
        await page.mouse.click(box.x + 5, box.y + 5, {button: 'right'});
        await page.waitForSelector('.ai-menu', {timeout: 3000});
        await page.screenshot({path: '/tmp/ai-menu.png'});
        check(await page.$$eval('.ai-menu button', b => b.map(x => x.textContent).join('|')).then(s => /問 AI/.test(s) && /結構圖/.test(s)), 'select text + right-click shows the 問 AI menu');
        await page.click('[data-ai-menu="ask"]');
        await page.waitForSelector('#ai-panel:not([hidden]) #ai-key', {timeout: 10000});
        check(await page.textContent('#ai-topic') === 'Omeprazole', 'AI window opens with the selected words as the topic');
        await page.fill('#ai-key', 'test-gemini-key');
        await page.click('#ai-save');
        await page.waitForFunction(() => /已儲存/.test(document.getElementById('ai-settings-msg')?.textContent || ''), null, {timeout: 10000});
        const settingsFile = [...drive.files.values()].find(f => f.name === 'nd-ai-settings.json');
        check(settingsFile && JSON.parse(settingsFile.content).key === 'test-gemini-key', 'Gemini key is saved in the owner\'s Drive (not in the site code)');
        await page.click('[data-ai-quick="0"]');
        await page.waitForSelector('.ai-bot [data-ai-answer="stick"]', {timeout: 15000});
        const answerHtml = await page.$eval('.ai-bot:last-child .ai-body', el => el.innerHTML);
        check(/<h4>分類<\/h4>/.test(answerHtml) && /<table>/.test(answerHtml) && /<b>PPI<\/b>/.test(answerHtml), 'streamed answer is shown with headings, lists and a table');
        check(geminiBodies.length === 1 && /Omeprazole/.test(geminiBodies[0]) && !/Prodrug|弱鹼性/.test(geminiBodies[0]), 'only the selected words go to Gemini, not the note');
        await page.screenshot({path: '/tmp/ai-panel.png'});
        await page.click('.ai-bot:last-child [data-ai-answer="stick"]');
        await page.waitForFunction(() => /已貼到筆記/.test(document.querySelector('.ai-bot:last-child [data-ai-answer="stick"]')?.textContent || ''), null, {timeout: 15000});
        const stickyFile = () => JSON.parse([...drive.files.values()].find(f => f.name === 'nd-ai-notes-pharmacology.json').content);
        const after = await page.evaluate(() => notesData.find(x => x.id === 'n1').text);
        const star = await page.evaluate(() => {const s = document.querySelector('#text-n1 .ai-sticky-star'); return s ? s.parentElement.tagName : null;});
        check(stickyFile().items.length === 1 && stickyFile().items[0].quote === 'Omeprazole' && after === before && star === 'P', 'sticky note saved separately; star on the paragraph; note text unchanged (' + star + ')');
        // Stars can be dragged (saved with the sticky); a plain click still opens it; the popover can be moved; 星星歸位 resets.
        {
            await page.evaluate(() => noteAi.close());
            await page.$eval('#text-n1 .ai-sticky-star', el => el.scrollIntoView({block: 'center'})); await page.waitForTimeout(200);
            await page.waitForSelector('#text-n1 .ai-sticky-star', {state: 'visible'}); await page.waitForTimeout(300);
            const s = await page.locator('#text-n1 .ai-sticky-star').boundingBox();
            await page.mouse.move(s.x + 10, s.y + 10); await page.mouse.down();
            await page.mouse.move(s.x - 40, s.y + 30, {steps: 6}); await page.mouse.move(s.x - 120, s.y + 60, {steps: 6});
            await page.mouse.up();
            await page.waitForTimeout(800);
            const moved = await page.evaluate(() => ({translate: document.querySelector('#text-n1 .ai-sticky-star').style.translate, pop: !!document.querySelector('.ai-pop')}));
            const saved = stickyFile().items[0].pos;
            check(/^-\d+px \d+px$/.test(moved.translate) && !moved.pop && saved && saved.x < -100 && saved.y > 40, 'dragging a star moves it, does not open it, and saves the place: ' + JSON.stringify({moved, saved}));
            await page.reload(); await signInAndWait(page);
            await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
            if (!await page.$('#text-n1')) {await page.fill('#search-input', 'Omeprazole'); await page.waitForTimeout(800);}
            await page.waitForSelector('#text-n1 .ai-sticky-star', {timeout: 20000});
            const kept = await page.$eval('#text-n1 .ai-sticky-star', el => el.style.translate);
            await page.$eval('#text-n1 .ai-sticky-star', el => el.scrollIntoView({block: 'center'})); await page.waitForTimeout(200);
            await page.click('#text-n1 .ai-sticky-star');
            await page.waitForSelector('.ai-pop header');
            const h = await (await page.$('.ai-pop header b')).boundingBox(), before = await (await page.$('.ai-pop')).boundingBox();
            await page.mouse.move(h.x + 5, h.y + 5); await page.mouse.down(); await page.mouse.move(h.x + 5 - 150, h.y + 5 + 80, {steps: 5}); await page.mouse.up();
            const after = await (await page.$('.ai-pop')).boundingBox();
            await page.click('.ai-pop [data-pop="home"]');
            await page.waitForTimeout(800);
            const home = await page.$eval('#text-n1 .ai-sticky-star', el => el.style.translate);
            check(kept === moved.translate && Math.round(before.x - after.x) === 150 && Math.round(after.y - before.y) === 80 && home === '' && stickyFile().items[0].pos === null,
                'moved star stays after reopening; popover drags by its title; 星星歸位 resets: ' + JSON.stringify({kept, dx: before.x - after.x, home}));
            await page.evaluate(() => noteAi.open({text: 'Omeprazole', noteId: 'n1', quote: 'Omeprazole', prefix: '', suffix: ''}));
        }
        // Same question again: remembered, no new request.
        await page.click('[data-ai-quick="0"]');
        await page.waitForSelector('.ai-bot:last-child .ai-note', {timeout: 5000});
        check(geminiBodies.length === 1, 'asking the same question again shows the remembered answer (no new request)');
        // Structure from PubChem.
        await page.click('#ai-panel [data-ai="structure"]');
        await page.waitForSelector('.ai-structure img', {timeout: 10000});
        await page.waitForTimeout(300); await page.screenshot({path: '/tmp/ai-structure.png'});
        await page.click('#ai-panel [data-ai="close"]');
        await page.screenshot({path: '/tmp/ai-star.png'});
        await page.click('#text-n1 .ai-sticky-star'); await page.waitForSelector('.ai-pop'); await page.screenshot({path: '/tmp/ai-pop.png'}); await page.keyboard.press('Escape');
        const img = await page.$eval('.ai-structure img', i => i.src);
        check(/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug\/compound\/cid\/4594\/PNG/.test(img) && /PubChem（CID 4594）/.test(await page.textContent('.ai-structure figcaption')), 'structure image comes from PubChem: ' + img);
        await page.evaluate(() => noteAi.close());
        // Text changed → the star moves to the note's top-right corner; it can be deleted.
        await page.evaluate(() => {const n = notesData.find(x => x.id === 'n1'); n.text = n.text.replace('Omeprazole', 'Esomeprazole 改寫'); filterNotes();});
        await page.waitForTimeout(300);
        check(!!await page.$('.note-item[data-id="n1"] .ai-sticky-star.ai-sticky-loose'), 'when the text changes, the sticky moves to the note corner');
        await page.click('.note-item[data-id="n1"] .ai-sticky-star');
        await page.waitForSelector('.ai-pop [data-pop="delete"]');
        check(await page.evaluate(() => !document.getElementById('noteModal').classList.contains('active')), 'clicking the star opens the sticky note, not the editor');
        await page.click('.ai-pop [data-pop="delete"]');
        await page.waitForFunction(() => !document.querySelector('.note-item[data-id="n1"] .ai-sticky-star'), null, {timeout: 15000});
        check(stickyFile().items[0].deleted === true, 'a sticky note can be deleted');
        await page.evaluate(n1 => {notesData.find(x => x.id === 'n1').text = n1; filterNotes();}, before);
        await page.fill('#search-input', ''); await page.evaluate(() => filterNotes()); await page.waitForTimeout(500);
        await page.setViewportSize({width: 390, height: 800}); await page.evaluate(() => {noteAi.open({text: 'Omeprazole', noteId: 'n1', quote: 'Omeprazole', prefix: '', suffix: ''}); noteAi.ask('「Omeprazole」：請條列說明分類、作用機轉、主要用途、重要副作用與交互作用，以及國考常考點。', 'quick');});
        await page.waitForTimeout(800); await page.screenshot({path: '/tmp/ai-phone.png'}); await page.evaluate(() => noteAi.close()); await page.setViewportSize({width: 1100, height: 900});
    }
    // 使用說明書: version in the header, features/shortcuts, Q&A, update history, search.
    {
        const label = await page.textContent('#drive-manual');
        check(/^v\d+・使用說明書$/.test(label), 'header shows the version and 使用說明書: ' + label);
        await page.click('#drive-manual');
        await page.waitForSelector('#manual-body .manual-table');
        const features = await page.$$eval('#manual-body .manual-table tr', r => r.length);
        await page.fill('#manual-search', '回到選取');
        await page.waitForTimeout(100);
        const found = await page.$eval('#manual-body', b => b.textContent);
        await page.screenshot({path: '/tmp/manual.png'});
        await page.click('[data-manual-tab="changelog"]');
        await page.fill('#manual-search', '');
        const current = await page.$eval('#manual-body', b => b.querySelector('.manual-release h4 span')?.textContent);
        await page.click('[data-manual-tab="faq"]');
        const faq = await page.$$eval('#manual-body details', d => d.length);
        check(features > 40 && /按 V/.test(found) && current === '目前版本' && faq >= 10, 'manual lists features, finds 「回到選取」, marks the current version, has Q&A: ' + JSON.stringify({features, current, faq}));
        await page.click('#manualModal .btn-cancel');
    }
    // 閱讀字體／行距: only the reading view changes, never the notes.
    {
        const textBefore = await page.evaluate(() => JSON.stringify(notesData));
        if (!await page.isVisible('#site-reading-zoom')) await page.click('#drive-tools summary');
        await page.selectOption('#site-reading-zoom', '1.3');
        await page.selectOption('#site-reading-line', 'wide');
        const look = await page.evaluate(() => {const t = document.querySelector('#note-list .note-text'); const s = getComputedStyle(t); return {zoom: s.zoom, line: s.lineHeight, font: s.fontSize, editorZoom: getComputedStyle(document.getElementById('modal-text')).zoom};});
        await page.reload(); await signInAndWait(page);
        const kept = await page.evaluate(() => ({zoom: document.documentElement.dataset.readingZoom, line: document.documentElement.dataset.readingLine, select: document.getElementById('site-reading-zoom').value}));
        check(look.zoom === '1.3' && parseFloat(look.line) > parseFloat(look.font) * 1.9 && look.editorZoom === '1' && kept.zoom === '1.3' && kept.line === 'wide' && kept.select === '1.3'
            && await page.evaluate(() => JSON.stringify(notesData)) === textBefore, 'reading size/line spacing change only the reading view and are remembered: ' + JSON.stringify({look, kept}));
        await page.evaluate(() => {localStorage.removeItem('nd-reading-zoom'); localStorage.removeItem('nd-reading-line'); noteAppearance.initialize();});
        await page.reload(); await signInAndWait(page);
        await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
    }
    // Phones: swipe left/right to change page.
    {
        const phone = await browser.newContext({viewport: {width: 390, height: 800}, hasTouch: true, isMobile: true, serviceWorkers: 'block'});
        await drive.install(phone);
        const p = await phone.newPage();
        p.on('dialog', d => d.accept());
        await p.goto(BASE + '?book=pharmacology');
        await signInAndWait(p);
        await p.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        const swipe = (x1, x2, y = 400, ms = 150) => p.evaluate(({x1, x2, y, ms}) => new Promise(resolve => {
            const list = document.getElementById('note-list'), target = list.querySelector('.note-text') || list;
            const touch = x => new Touch({identifier: 1, target, clientX: x, clientY: y});
            list.dispatchEvent(new TouchEvent('touchstart', {touches: [touch(x1)], changedTouches: [touch(x1)], bubbles: true}));
            setTimeout(() => {list.dispatchEvent(new TouchEvent('touchend', {touches: [], changedTouches: [touch(x2)], bubbles: true})); setTimeout(resolve, 300);}, ms);
        }), {x1, x2, y, ms});
        const page0 = await p.evaluate(() => noteBrowse.state().page);
        await swipe(320, 80);
        const page1 = await p.evaluate(() => noteBrowse.state().page);
        await swipe(80, 320);
        const page2 = await p.evaluate(() => noteBrowse.state().page);
        await swipe(320, 260);              // too short: not a page swipe
        await swipe(320, 80, 400, 1200);    // too slow (a drag, not a swipe)
        const page3 = await p.evaluate(() => noteBrowse.state().page);
        check(page1 === page0 + 1 && page2 === page0 && page3 === page0, 'phone swipe changes page; short or slow drags do not: ' + [page0, page1, page2, page3].join('→'));
        await phone.close();
    }
    // Comforts: 完成 button, Esc / outside click, Ctrl+S, foldable shortcut list, remembered draw settings, plain sync text.
    {
        await page.evaluate(() => openEditModal('n1'));
        await page.waitForSelector('#noteModal.active #modal-text');
        const buttons = await page.$$eval('#noteModal .modal-actions button', b => b.map(x => x.textContent.trim()));
        const hintsHidden = await page.isHidden('#note-shortcut-hints');
        await page.click('#note-hints-toggle');
        const hintsShown = await page.isVisible('#note-shortcut-hints');
        await page.click('#note-hints-toggle');
        check(buttons.join('|') === '完成' && hintsHidden && hintsShown && await page.isHidden('#note-shortcut-hints'), 'editor: one 完成 button; shortcut list folded by default and can be opened: ' + buttons.join('|'));
        await page.click('#modal-text');
        await page.keyboard.press('End');
        await page.keyboard.type('Esc測試');
        let dialogSeen = false; page.once('dialog', () => {dialogSeen = true;});
        await page.keyboard.press('Control+s');
        await page.waitForTimeout(300);
        check(!dialogSeen && await page.isVisible('#noteModal.active'), 'Ctrl+S saves without closing the editor');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        const closed = await page.evaluate(() => !document.getElementById('noteModal').classList.contains('active') && notesData.find(x => x.id === 'n1').text.includes('Esc測試'));
        check(closed, 'Esc closes the editor and the text is kept');
        // Outside click leaves the editor open.
        await page.evaluate(() => openEditModal('n1'));
        await page.waitForSelector('#noteModal.active #modal-text');
        await page.mouse.click(5, 5);
        await page.waitForTimeout(300);
        check(await page.isVisible('#noteModal.active'), 'clicking outside does not close the editor');
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        await page.evaluate(() => {const n = notesData.find(x => x.id === 'n1'); n.text = n.text.replace('Esc測試', ''); autoSave(100);});
        // Small windows: Esc and outside click close them; a click inside does not.
        await page.evaluate(() => openHistoryModal());
        await page.keyboard.press('Escape'); await page.waitForTimeout(200);
        const escClosed = await page.isHidden('#historyModal.active');
        await page.click('#drive-manual'); await page.waitForSelector('#manualModal.active');
        await page.click('#manual-search');
        const insideKept = await page.isVisible('#manualModal.active');
        await page.mouse.click(8, 450); await page.waitForTimeout(200);
        check(escClosed && insideKept && await page.isHidden('#manualModal.active'), 'small windows close with Esc or an outside click, not an inside click');
        // Random draw remembers the last settings across visits.
        await page.evaluate(() => {openRandomDrawModal(); document.getElementById('random-draw-count').value = 3; document.getElementById('random-draw-scope').value = 'all'; performRandomDraw(); clearRandomDraw();});
        await page.reload(); await signInAndWait(page);
        await page.waitForFunction(() => noteDriveCloud.state().loaded, null, {timeout: 60000});
        const remembered = await page.evaluate(() => {openRandomDrawModal(); const r = [document.getElementById('random-draw-count').value, document.getElementById('random-draw-scope').value]; closeRandomDrawModal(); return r;});
        check(remembered.join() === '3,all', 'random draw remembers the last count and range: ' + remembered);
        // Plain-language sync panel.
        await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 60000}).catch(() => {});
        await page.click('#sync-status');
        const sync = await page.evaluate(() => ({msg: document.getElementById('sync-detail-message').textContent, h: document.getElementById('sync-detail-headline').textContent, retry: document.getElementById('sync-retry').hidden, details: !document.querySelector('#sync-details details').open}));
        await page.screenshot({path: '/tmp/sync-plain.png'});
        await page.keyboard.press('Escape');
        check(sync.h === '✓ 全部已存到雲端' && sync.retry && sync.details, 'sync panel says it plainly: ' + JSON.stringify(sync));
        // Picture-text line hides when everything is done.
        await page.waitForTimeout(500);
        check(await page.isHidden('#note-image-search-status'), 'picture-text status line is hidden once all pictures are done: ' + await page.textContent('#note-image-search-status').catch(() => ''));
    }
    // Category tags: horizontal, no colour, up to 8 characters on 2 lines; overview colours follow a rainbow with no repeats.
    {
        const info = await page.evaluate(() => {
            for (const n of ['要背的', '血清素', '抗凝血劑與溶栓劑']) if (!categoryDefinitions.some(c => c.name === n)) createCategoryDefinition(n, '#ef4444', false, n);
            const id = document.querySelector('#note-list .note-item[data-id]').dataset.id; window.__tagNote = [id, [...notesData.find(x => String(x.id) === id).categoryIds || []]];
            notesData.find(x => String(x.id) === id).categoryIds = categoryDefinitions.map(c => c.id); filterNotes();
            const chips = [...document.querySelectorAll('.note-item[data-id="' + id + '"] .note-category-chip')];
            const long = chips.find(c => c.textContent.trim() === '抗凝血劑與溶栓劑');
            const one = chips.find(c => c.textContent.trim() === '要背的');
            const colors = categoryDefinitions.map(c => categoryDisplayColor(c));
            return {texts: chips.map(c => c.textContent.trim()), longH: long?.getBoundingClientRect().height, oneH: one?.getBoundingClientRect().height,
                widths: [...new Set(chips.map(c => Math.round(c.getBoundingClientRect().width)))], bg: getComputedStyle(one).backgroundColor, inline: chips.some(c => c.getAttribute('style')),
                colors, unique: new Set(colors).size === colors.length, limit: normalizeCategoryAbbr('一二三四五六七八九十', 'x')};
        });
        check(info.texts.includes('抗凝血劑與溶栓劑') && info.longH > info.oneH * 1.6 && info.widths.length === 1 && !info.inline && /255, 255, 255/.test(info.bg)
            && info.unique && info.limit === '一二三四五六七八', 'tags: same width, 8 characters on two lines, no colour; rainbow colours never repeat: ' + JSON.stringify(info));
        await page.evaluate(() => {const [id, ids] = window.__tagNote; notesData.find(x => String(x.id) === id).categoryIds = ids; filterNotes();});
    }
    // Saved colours: purple restored, 16 per kind, nothing pushed out, shared through Drive.
    {
        await page.waitForTimeout(3500);
        const r = await page.evaluate(() => {
            const before = [...editorColorMemory.textColor];
            for (let i = 0; i < 20; i++) rememberEditorColor('textColor', '#1' + String(i).padStart(2, '0') + '0a0');
            rememberEditorColor('textColor', before[0]);
            return {purple: before.includes('#a242f0'), before, after: [...editorColorMemory.textColor], last: editorColorMemory.last.textColor};
        });
        await page.waitForTimeout(2500);
        const file = [...drive.files.values()].find(f => f.name === 'nd-editor-colors.json');
        const synced = file ? JSON.parse(file.content).textColor : null;
        check(r.purple && r.after.length === 16 && r.before.every((c, i) => r.after[i] === c) && r.last === r.before[0] && JSON.stringify(synced) === JSON.stringify(r.after),
            'saved colours: #a242f0 back, 16 kept in place (new ones never push old ones out), shared via Drive: ' + JSON.stringify({before: r.before, n: r.after.length, synced: !!synced}));
        await page.evaluate(before => {editorColorMemory.textColor = before; saveEditorColorMemory();}, r.before);
    }
    // Sign-in renewal: with < 10 minutes left, the next button click renews it.
    {
        const other = await open('renew');
        await signInAndWait(other.page);
        await other.page.evaluate(() => localStorage.setItem('nd-token-v1', JSON.stringify({token: 'tok-old', expiresAt: Date.now() + 5 * 60000})));
        await other.page.reload();
        await signInAndWait(other.page);
        const before = await other.page.evaluate(() => window.__tokenRequests || 0);
        await other.page.click('#drive-tools summary');
        await other.page.waitForTimeout(400);
        const after = await other.page.evaluate(() => ({n: window.__tokenRequests || 0, left: JSON.parse(localStorage.getItem('nd-token-v1')).expiresAt - Date.now()}));
        check(after.n === before + 1 && after.left > 50 * 60000, 'sign-in renews on a click when under 10 minutes remain: ' + JSON.stringify({before, ...after}));
        await other.context.close();
    }
    // 捲動載入: 20 notes first, more while scrolling.
    await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 60000}).catch(() => {});
    await page.waitForTimeout(1000);
    await page.evaluate(() => {for (let i = 0; i < 50; i++) notesData.push({id: 'x' + i, title: '', text: '<p>捲動測試 ' + i + '</p>', categoryIds: [], createdAt: '2025-03-01T00:00:00Z'}); filterNotes();});
    await page.selectOption('#note-page-size', '-1');
    await page.waitForTimeout(800);
    const first = await page.$$eval('#note-list .note-item', l => l.length);
    for (let y = 0; y < 30; y++) {await page.mouse.wheel(0, 1200); await page.waitForTimeout(120);}
    await page.waitForTimeout(800);
    const later = await page.$$eval('#note-list .note-item', l => l.length);
    check(first === 20 && later === 66, '捲動載入 shows 20 first, then all 66 while scrolling (' + first + ' -> ' + later + ')');
    await context.close();
} catch (error) {
    console.error('TEST ERROR', error); process.exitCode = 1;
} finally {
    console.log('problems:', problems.length ? problems : 'none');
    await browser.close(); server.close();
}
