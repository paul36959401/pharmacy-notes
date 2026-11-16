// Computed-style regression check for CSS refactoring.
//   node test/style-snapshot.mjs seed                  -> builds a fixed test Drive (test/.seed.json)
//   node test/style-snapshot.mjs capture <css> <out>   -> records computed styles with <css> as css/app.css
//   node test/style-snapshot.mjs compare <a> <b>       -> lists every element/property that differs
import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {createRequire} from 'node:module';
import {createMockDrive} from './mock-drive.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const sharp = require('/opt/npm-tools/node_modules/sharp');

const SITE = new URL('..', import.meta.url).pathname;
const SEED = new URL('.seed.json', import.meta.url).pathname;
const BASE = 'http://localhost:8766/pharmacy-notes/';
const [mode, arg1, arg2] = process.argv.slice(2);
let cssOverride = null;
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.gz': 'application/gzip'};
const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, BASE).pathname).replace(/^\/pharmacy-notes\//, '/');
    if (path.endsWith('/')) path += 'index.html';
    try {
        let body = path === '/css/app.css' && cssOverride ? await readFile(cssOverride) : await readFile(join(SITE, normalize(path)));
        if (path === '/js/config.js') body = Buffer.from(body.toString().replace(/clientId: '[^']*'/, "clientId: 'test'").replace(/imageProxyUrl: '[^']*'/, "imageProxyUrl: ''"));
        res.writeHead(200, {'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store'}); res.end(body);
    } catch (_) {res.writeHead(404); res.end();}
}).listen(8766);

const drive = createMockDrive();
async function loadSeed() {
    const saved = JSON.parse(await readFile(SEED, 'utf8'));
    for (const f of saved) drive.files.set(f.id, {...f, content: Buffer.from(f.content, 'base64')});
}
const browser = await chromium.launch();
async function openPage(width, write = false) {
    const context = await browser.newContext({viewport: {width, height: 900}});
    await drive.install(context);
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    await page.addInitScript(w => {try {localStorage.setItem('nd-allow-write', w ? '1' : '0'); localStorage.setItem('nd-theme', 'light');} catch (_) {}}, write);
    await page.goto(BASE + '?book=pharmacology');
    await page.waitForFunction(() => !document.getElementById('site-gate-button').hidden || window.noteDriveStartupComplete);
    if (await page.isVisible('#site-gate-button')) await page.click('#site-gate-button');
    await page.waitForFunction(() => window.noteDriveStartupComplete === true && window.noteDriveCloud?.state().loaded, null, {timeout: 60000});
    await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 30000}).catch(() => {});
    await page.addStyleTag({content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
    await page.waitForTimeout(1500);
    await page.mouse.move(5, 895);
    return {context, page};
}

// Each state is reached from a fresh list view.
const STATES = {
    list: async () => {},
    settings: async p => p.evaluate(() => {document.getElementById('drive-tools').open = true;}),
    search: async p => {await p.fill('#search-input', 'Omeprazole'); await p.waitForTimeout(400);},
    preview: async p => p.evaluate(() => togglePreviewMode()),
    editor: async p => {await p.evaluate(() => openEditModal('n1')); await p.waitForTimeout(600);},
    editorGallery: async p => {await p.evaluate(() => openEditModal('n2')); await p.waitForTimeout(600);},
    category: async p => p.evaluate(() => openCategoryOverviewModal()),
    history: async p => p.evaluate(() => openHistoryModal()),
    random: async p => p.evaluate(() => openRandomDrawModal()),
    table: async p => {await p.evaluate(() => openEditModal('n1')); await p.waitForTimeout(400); await p.evaluate(() => openTableCreateModal());},
    link: async p => {await p.evaluate(() => openEditModal('n1')); await p.waitForTimeout(400); await p.evaluate(() => openNoteLinkModal());}
};
const WIDTHS = [1280, 760, 600, 480, 390, 340];

const collect = () => {
    const fnv = s => {let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36);};
    const out = {};
    const key = el => {const parts = []; for (let n = el; n && n !== document.documentElement; n = n.parentElement) {if (n.id && !/^(note-|tab-)?[0-9a-f-]{8,}|^\d+$/.test(n.id)) {parts.push('#' + n.id); break;} parts.push(n.tagName + '.' + (n.getAttribute('class') || '').split(/\s+/).sort().join('.') + ':' + [...n.parentElement.children].filter(c => c.tagName === n.tagName).indexOf(n));} return parts.reverse().join('>');};
    const describe = cs => {let s = ''; for (let i = 0; i < cs.length; i++) {const p = cs[i]; if (p.startsWith('--')) continue; s += p + ':' + cs.getPropertyValue(p) + ';';} return s;};
    for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg') && el.tagName !== 'svg') continue;
        let s = describe(getComputedStyle(el));
        for (const pseudo of ['::before', '::after']) {const cs = getComputedStyle(el, pseudo); if (cs.content && cs.content !== 'none' && cs.content !== 'normal') s += pseudo + describe(cs);}
        out[key(el)] = fnv(s);
    }
    return out;
};
const detail = keys => {
    const out = {};
    const key = el => {const parts = []; for (let n = el; n && n !== document.documentElement; n = n.parentElement) {if (n.id && !/^(note-|tab-)?[0-9a-f-]{8,}|^\d+$/.test(n.id)) {parts.push('#' + n.id); break;} parts.push(n.tagName + '.' + (n.getAttribute('class') || '').split(/\s+/).sort().join('.') + ':' + [...n.parentElement.children].filter(c => c.tagName === n.tagName).indexOf(n));} return parts.reverse().join('>');};
    const want = new Set(keys);
    for (const el of document.querySelectorAll('body *')) {
        const k = key(el); if (!want.has(k)) continue;
        const props = {}; const cs = getComputedStyle(el);
        for (let i = 0; i < cs.length; i++) if (!cs[i].startsWith('--')) props[cs[i]] = cs.getPropertyValue(cs[i]);
        for (const pseudo of ['::before', '::after']) {const c = getComputedStyle(el, pseudo); if (c.content && c.content !== 'none' && c.content !== 'normal') for (let i = 0; i < c.length; i++) props[pseudo + c[i]] = c.getPropertyValue(c[i]);}
        out[k] = {cls: el.className?.baseVal ?? el.className, props};
    }
    return out;
};

try {
    if (mode === 'seed') {
        drive.add({name: '藥學筆記雲端工作台', mimeType: 'application/vnd.google-apps.folder'});
        const png = async (w, h, color) => 'data:image/png;base64,' + (await sharp({create: {width: w, height: h, channels: 3, background: color}}).png().toBuffer()).toString('base64');
        const notes = [
            {id: 'n1', title: '', text: '<p><b>Omeprazole</b>：弱鹼性的 <mark>Prodrug</mark>，<span style="color:#dc2626">紅字</span></p><ul><li>清單一</li><li>清單二</li></ul><table><tr><td>A</td><td>B</td></tr></table><p><img src="' + await png(400, 250, '#dc2626') + '"></p>', categoryIds: ['c1'], starred: true, createdAt: '2025-01-01T00:00:00Z'},
            {id: 'n2', title: '舊格式圖片區', text: '<p>圖片區</p>', images: [await png(300, 200, '#2563eb'), await png(200, 200, '#16a34a')], categoryIds: ['c2'], createdAt: '2025-01-02T00:00:00Z'},
            ...Array.from({length: 14}, (_, i) => ({id: 'm' + i, title: i % 3 ? '' : '標題 ' + i, text: '<p>筆記內容 ' + i + '：<b>粗體</b>與<i>斜體</i></p>', categoryIds: i % 2 ? ['c1'] : [], starred: i % 4 === 0, createdAt: '2025-02-0' + (1 + i % 9) + 'T00:00:00Z'})),
            {id: '__NOTE_CATEGORIES__', _type: 'system-categories', records: [{id: 'c1', name: '胃藥', abbr: '胃藥', color: '#f59e0b'}, {id: 'c2', name: '抗生素', abbr: '抗', color: '#2563eb'}]}
        ];
        const path = '/tmp/nd-style-backup.json';
        await writeFile(path, JSON.stringify({notes}));
        const {context, page} = await openPage(1280, true);
        await page.setInputFiles('#drive-file', path);
        await page.waitForFunction(() => /JSON 已同步/.test(document.getElementById('drive-message')?.textContent || ''), null, {timeout: 120000});
        await page.waitForFunction(() => document.getElementById('sync-status')?.dataset.syncState === 'success', null, {timeout: 120000}).catch(() => console.log('sync state not success, continuing'));
        await page.waitForTimeout(4000);
        await context.close();
        await writeFile(SEED, JSON.stringify([...drive.files.values()].map(f => ({...f, content: f.content.toString('base64')}))));
        console.log('seeded', drive.files.size, 'files');
    } else if (mode === 'capture') {
        cssOverride = arg1; await loadSeed();
        const result = {};
        for (const width of WIDTHS) {
            for (const [name, enter] of Object.entries(STATES)) {
                const {context, page} = await openPage(width);
                await enter(page); await page.waitForTimeout(300);
                result[width + ':' + name] = await page.evaluate(collect);
                await context.close();
            }
            process.stdout.write(width + ' ');
        }
        await writeFile(arg2, JSON.stringify({css: arg1, result}));
        console.log('\ncaptured', Object.keys(result).length, 'states');
    } else if (mode === 'flaky') {
        cssOverride = arg1; await loadSeed();
        const runs = [];
        for (let i = 0; i < 2; i++) {
            const {context, page} = await openPage(1280);
            runs.push(await page.evaluate(() => {
                const out = {}; let i = 0;
                for (const el of document.querySelectorAll('body *')) {const cs = getComputedStyle(el); const o = {}; for (let j = 0; j < cs.length; j++) o[cs[j]] = cs.getPropertyValue(cs[j]); out[(el.id || el.className?.baseVal || el.className || el.tagName) + '#' + (i++)] = o;}
                return out;
            }));
            await context.close();
        }
        const props = {};
        for (const k of Object.keys(runs[0])) for (const p of Object.keys(runs[0][k])) if (runs[1][k] && runs[0][k][p] !== runs[1][k][p]) props[p] = (props[p] || 0) + 1;
        console.log(props);
    } else if (mode === 'match') {
        await loadSeed();
        const selectors = JSON.parse(await readFile(arg1, 'utf8'));
        const hit = new Set();
        for (const width of [1280, 390]) for (const [name, enter] of Object.entries(STATES)) {
            const {context, page} = await openPage(width);
            await enter(page); await page.waitForTimeout(300);
            const found = await page.evaluate(list => list.filter(s => {try {return document.querySelector(s.replace(/::?(before|after|placeholder|marker|selection|-webkit-[a-z-]+)\b/g, '')) !== null;} catch (_) {return false;}}), selectors);
            found.forEach(s => hit.add(s));
            await context.close();
        }
        await writeFile(arg2, JSON.stringify([...hit]));
        console.log('matched', hit.size, 'of', selectors.length);
    } else if (mode === 'compare') {
        const a = JSON.parse(await readFile(arg1, 'utf8')), b = JSON.parse(await readFile(arg2, 'utf8'));
        const diffs = {};
        for (const state of Object.keys(a.result)) {
            const x = a.result[state], y = b.result[state] || {};
            const keys = Object.keys(x).filter(k => k in y && x[k] !== y[k]);
            if (keys.length) diffs[state] = keys;
        }
        const total = Object.values(diffs).reduce((n, k) => n + k.length, 0);
        await writeFile('/tmp/last-diff-keys.json', JSON.stringify([...new Set(Object.values(diffs).flat())]));
        console.log('states with differences:', Object.keys(diffs).length, 'elements:', total);
        let shown = process.env.QUICK ? 999 : 0; const propSet = new Set();
        const limit = process.env.ALL ? 999 : 6;
        await loadSeed();
        for (const [state, keys] of Object.entries(diffs)) {
            if (shown >= limit) break; shown++;
            const [width, name] = state.split(':');
            const details = [];
            for (const css of [a.css, b.css]) {
                cssOverride = css;
                const {context, page} = await openPage(Number(width));
                await STATES[name](page); await page.waitForTimeout(300);
                details.push(await page.evaluate(detail, keys.slice(0, 5)));
                await context.close();
            }
            for (const k of keys.slice(0, 5)) {
                const p = details[0][k]?.props || {}, q = details[1][k]?.props || {};
                const changed = [...new Set([...Object.keys(p), ...Object.keys(q)])].filter(n => p[n] !== q[n]).map(n => n + ': ' + p[n] + ' -> ' + q[n]);
                [...new Set([...Object.keys(p), ...Object.keys(q)])].filter(n => p[n] !== q[n]).forEach(n => propSet.add(n.replace(/^::(before|after)/, '')));
                console.log(state, k.split('>').slice(-3).join('>'), '.' + (details[0][k]?.cls || ''), '\n   ', changed.slice(0, 6).join('\n    '));
            }
        }
        await writeFile('/tmp/last-diff-props.json', JSON.stringify([...propSet]));
        process.exitCode = total ? 1 : 0;
    }
} catch (error) {console.error('ERROR', error); process.exitCode = 2;}
finally {await browser.close(); server.close();}
