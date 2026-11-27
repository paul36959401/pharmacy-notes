// End-to-end test of 購物紀錄 (shopping.html) and the 一鍵記錄 bookmark against an in-memory
// Drive. Run: node test/shopping-e2e.mjs   (needs: node tools/build.mjs first)
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {createRequire} from 'node:module';
import {createMockDrive} from './mock-drive.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const sharp = require('/opt/npm-tools/node_modules/sharp');

const SITE = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:8766/pharmacy-notes/';
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json'};
const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, BASE).pathname).replace(/^\/pharmacy-notes\//, '/');
    if (path.endsWith('/')) path += 'index.html';
    try {
        let body = await readFile(join(SITE, normalize(path)));
        if (path === '/js/config.js') body = Buffer.from(body.toString().replace(/clientId: '[^']*'/, "clientId: 'test-client.apps.googleusercontent.com'").replace(/imageProxyUrl: '[^']*'/, "imageProxyUrl: 'https://script.google.com/macros/s/TEST/exec'"));
        res.writeHead(200, {'content-type': types[extname(path)] || 'application/octet-stream'}); res.end(body);
    } catch (_) {res.writeHead(404); res.end('not found');}
}).listen(8766);

const results = [];
const check = (name, ok, detail = '') => {results.push({name, ok: !!ok}); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : ' — ' + detail));};
async function png(w, h, color) {
    return sharp({create: {width: w, height: h, channels: 3, background: color}}).png().toBuffer();
}
const redPng = await png(800, 600, '#dc2626'), bluePng = await png(640, 480, '#2563eb'), greenPng = await png(500, 500, '#16a34a');
const dataUrl = buf => 'data:image/png;base64,' + buf.toString('base64');

/* ---------- Drive with data written by the old site ---------- */
const drive = createMockDrive();
const FOLDER = 'application/vnd.google-apps.folder';
const workspace = drive.add({name: '藥學筆記雲端工作台', mimeType: FOLDER});
const imageFolder = drive.add({name: '購物紀錄網站圖片', mimeType: FOLDER});
const oldOriginal = drive.add({name: '商品_2-1.jpg', mimeType: 'image/png', parents: [imageFolder.id], content: redPng});
const oldItems = [
    {id: '1773750101208', name: '蕾潔吊飾扭蛋 (2026/5~6月補款)', delivery: '補款', url: 'https://item.taobao.com/item.htm?id=1018659829324&spm=x',
        image: [dataUrl(await png(60, 40, '#f59e0b'))], imageOriginalIds: [oldOriginal.id], imageOriginalMeta: [{name: '商品_2-1.jpg', type: 'image/png'}], imageSettings: [{x: 42.5, y: 20}]},
    {id: 1781455310160, name: '【怨念事務所】預約8月 史黛菈', delivery: '取貨付款', address: '小7煙波門市', month: '2026-08', price: '4320',
        url: 'https://mybid.ruten.com.tw/master/view_transaction.php?tno=26060758932454', customField: {keep: true}},
    {id: '1774119928128', name: '风堇1/8手办', delivery: '補款', month: '2026-09', isCompleted: true, completedAt: 1794609049390, archiveOrder: 1794609049391,
        url: 'https://detail.tmall.com/item.htm?id=1025804757583'},
    {id: '1774117886334', name: '黏土人 澤田綱吉', delivery: '寄到家', month: '2026-07', url: 'https://www.goodsmile.com/zh/product/1140164', price: 1650,
        image: [dataUrl(await png(50, 50, '#111111')), dataUrl(await png(50, 50, '#222222'))], imageVisibility: [true, false]}
];
const oldText = JSON.stringify(oldItems);
const dataFile = drive.add({name: '敗家紀錄雲端備份.json', mimeType: 'text/plain', content: Buffer.from(oldText)});
const readCloud = () => JSON.parse(drive.files.get(dataFile.id).content.toString('utf8'));

/* ---------- pretend shop pages for the bookmark ---------- */
const shopPages = {
    'https://mybid.ruten.com.tw/master/view_transaction.php?tno=1': `<!doctype html><html lang="zh-Hant-TW"><head><title>訂單明細 - 露天市集</title></head><body>
        <div class="col-goods-inner-item-main"><a href="https://www.ruten.com.tw/item/111/" class="rt-text-large">【怨念事務所】預購11月(免訂金)Twincre 家庭教師 REBORN! 黑色與洋紅色 極光壓克力吊飾 分售 0928</a>
          <div>規格：雲雀恭彌（10年後）</div><div class="rt-text-medium">出貨年月：預計 2026/11 出貨</div></div>
        <div class="col-goods-inner-item-main"><a href="https://www.ruten.com.tw/item/222/" class="rt-text-large">【怨念事務所】預購11月(免訂金)Twincre 家庭教師 REBORN! 黑色與洋紅色 角色壓克力立牌 分售 0928</a>
          <div>規格：六道 骸（10年後）</div><div class="rt-text-medium">出貨年月：預計 2026/11 出貨</div></div>
        <div class="fee-list-item-wrap"><div class="fee-list-item-label">結帳總金額</div> <div><span>1,170</span></div></div>
        <div class="transaction-header"><h4>運送方式</h4> <strong class="transaction-section-header-content">7-11取貨付款</strong></div>
        <div><span class="transaction-section-main-item-label">門市 / 地址</span> <span class="transaction-section-main-item-content"><span>醫學門市</span> <span>台北市信義區吳興街257號</span></span></div>
        </body></html>`,
    'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm': `<!doctype html><html lang="zh-CN"><head><title>已买到的宝贝</title></head><body>
        <div id="shopOrderContainer_1"><span>2026-11-18</span>
          <div class="itemInfo--a trade-bought-list-order-info"><div style="width:80px;height:80px;background-image:url(https://img.alicdn.com/imgextra/i1/1/pic-a.jpg_80x80.jpg)"></div>
            <a class="title--x" href="https://item.taobao.com/item.htm?id=1095294879125&mi_id=abc">【GSC补款】粘土人 云雀恭弥 10年后Ver. [交易快照]</a> 补款期限2026/11/4-2026/11/25 ￥245.76 ￥249.00 x1</div>
          <div>实付款￥245.76含运费:￥0.00</div></div>
        <div id="shopOrderContainer_2"><span>2026-11-10</span>
          <div class="itemInfo--a trade-bought-list-order-info"><img src="https://img.alicdn.com/imgextra/i2/2/pic-b.jpg_320x320q95.jpg" width="80" height="80">
            <a class="title--x" href="https://item.taobao.com/item.htm?id=781705400332">Q版娃娃系列毛绒玩偶公仔 miHoYo</a> ￥82.71 ￥99.00 x1</div>
          <div class="itemInfo--a trade-bought-list-order-info"><img src="https://img.alicdn.com/imgextra/i3/3/pic-c.jpg_320x320q95.jpg" width="80" height="80">
            <a class="title--x" href="https://item.taobao.com/item.htm?id=922806671468">帕姆留影簿系列马口铁徽章 miHoYo</a> ￥12.83 ￥15.00 x1</div>
          <div>实付款￥95.54</div></div>
        </body></html>`,
    'https://shop.example.jp/mypage/history/9': `<!doctype html><html lang="ja"><head><title>ご注文履歴 | Example Shop</title></head><body>
        <header><img src="https://shop.example.jp/img/logo.png" width="200" height="60"></header>
        <table><tr><td><img src="https://shop.example.jp/img/item1.jpg" width="90" height="90"></td><td><a href="https://shop.example.jp/products/1">ダンまち アクリルスタンド リュー</a></td><td>1,650円</td></tr>
        <tr><td><img src="https://shop.example.jp/img/item2.jpg" width="90" height="90"></td><td><a href="https://shop.example.jp/products/2">ダンまち 缶バッジ ベル</a></td><td>550円</td></tr></table>
        <div>お支払い金額 2,750円</div></body></html>`,
    'https://shop.example.jp/products/1': `<!doctype html><html lang="ja"><head><title>リュー</title>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"ダンまち アクリルスタンド リュー 12月発売予定","image":"https://shop.example.jp/img/item1.jpg","offers":{"@type":"Offer","price":"1650","priceCurrency":"JPY"}}</script>
        </head><body><h1>リュー</h1></body></html>`,
    'https://login.example.com/orders': `<!doctype html><html><head><title>我的訂單</title></head><body><p>沒有商品資料的頁面</p></body></html>`
};
const shopImages = {'pic-a.jpg': redPng, 'pic-b.jpg': bluePng, 'pic-c.jpg': greenPng, 'item1.jpg': bluePng, 'item2.jpg': greenPng};

const browser = await chromium.launch();
async function newContext() {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}, serviceWorkers: 'block'});
    return setupRoutes(context);
}
// What a shop server would have to send for a normal page to read it (an extension needs none of this).
const cors = route => ({'access-control-allow-origin': route.request().headers().origin || '*', 'access-control-allow-credentials': 'true'});
async function setupRoutes(context) {
    await drive.install(context);
    await context.route(/^https:\/\/(mybid\.ruten\.com\.tw|buyertrade\.taobao\.com|shop\.example\.jp|login\.example\.com)\/.*/, async route => {
        const url = route.request().url();
        const file = Object.keys(shopImages).find(name => url.includes(name));
        if (file) return route.fulfill({status: 200, contentType: 'image/png', headers: cors(route), body: shopImages[file]});
        if (shopPages[url]) return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: shopPages[url]});
        return route.fulfill({status: 404, body: 'nf'});
    });
    await context.route(/^https:\/\/www\.ruten\.com\.tw\/item\/.*/, route => {
        const pic = /item\/111/.test(route.request().url()) ? 'https://img.alicdn.com/imgextra/x/pic-a.jpg' : 'https://img.alicdn.com/imgextra/x/pic-b.jpg';
        return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', headers: cors(route), body: '<html><head><meta property="og:image" content="' + pic + '" /></head><body>商品</body></html>'});
    });
    await context.route(/^https:\/\/img\.alicdn\.com\/.*/, route => {
        const url = route.request().url();
        const file = Object.keys(shopImages).find(name => url.includes(name));
        return route.fulfill({status: file ? 200 : 404, contentType: 'image/png', headers: cors(route), body: file ? shopImages[file] : ''});
    });
    return context;
}
const problems = [];
async function openShop(context, hash = '') {
    const page = await context.newPage();
    page.on('console', m => {if (m.type() === 'error') problems.push('console: ' + m.text());});
    page.on('pageerror', e => problems.push('pageerror: ' + e.message));
    page.on('dialog', d => d.accept());
    await page.goto(BASE + 'shopping.html' + hash);
    await page.waitForFunction(() => window.noteShopping?.state.ready || !document.getElementById('site-gate-button').hidden, null, {timeout: 30000});
    if (await page.isVisible('#site-gate-button')) await page.click('#site-gate-button');
    await page.waitForFunction(() => window.noteShopping?.state.ready, null, {timeout: 30000});
    return page;
}
const idle = page => page.waitForFunction(() => /已自動備份|已是最新|雲端同步成功/.test(document.getElementById('syncStatus').textContent) && !window.noteShopping.state.dirty, null, {timeout: 30000});

try {
    const context = await newContext();
    const page = await openShop(context);

    /* 1. reads the old data as it is */
    check('reads all records', await page.locator('.item-card').count() === 4);
    check('month groups and archive', await page.locator('.month-header').count() === 4, await page.locator('.month-header').allTextContents().then(t => t.join(' | ')));
    check('pinned group for records without month', (await page.locator('.month-header').first().textContent()).includes('特別關注'));
    check('hidden picture stays off the card', await page.locator('.item-card[data-item-id="1774117886334"] .gallery-frame').count() === 1);
    await page.fill('#searchInput', '澤田');
    await page.waitForTimeout(250);
    check('search finds by name and shows 清除篩選', await page.locator('.item-card').count() === 1 && await page.isVisible('#clearFiltersBtn'));
    await page.click('#clearFiltersBtn');
    check('清除篩選 shows everything again', await page.locator('.item-card').count() === 4 && !(await page.isVisible('#clearFiltersBtn')));
    check('price shown with thousands separator', (await page.locator('.item-card[data-item-id="1781455310160"] .item-meta').first().textContent()).includes('$4,320'));
    const roundTrip = await page.evaluate(() => {
        const {state, compactItem} = window.noteShopping;
        const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => k + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
        return state.items.map(i => canon(compactItem(i)) === canon(state.base.find(b => String(b.id) === String(i.id))));
    });
    check('saving unchanged data loses nothing (unknown fields kept)', roundTrip.every(Boolean), JSON.stringify(roundTrip));

    /* 2. a new record typed by hand, with the new fields and a pasted picture */
    await page.click('#navToAddBtn');
    await page.fill('#itemUrl', 'https://www.animate-onlineshop.jp/pd/123');
    await page.fill('#itemName', 'ダンまち 缶バッジ');
    await page.fill('#itemYear', '2027');
    await page.fill('#itemMonthNumber', '1');
    await page.focus('#itemDelivery'); await page.keyboard.press('Digit4');
    await page.fill('#itemAddress', '');
    await page.fill('#itemPrice', '1980');
    await page.selectOption('#itemCurrency', 'JPY');
    await page.fill('#itemPaymentDate', '2026-12-05');
    await page.fill('#itemBalance', '300');
    await page.fill('#itemNote', '12/20 去 7-11 領貨');
    await page.evaluate(async b64 => {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'shot.png', {type: 'image/png'}));
        document.dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true}));
    }, greenPng.toString('base64'));
    await page.waitForFunction(() => document.querySelectorAll('#imagePreviewList .preview-item').length === 1);
    await page.click('#submitBtn');
    await idle(page);
    let cloud = readCloud();
    const added = cloud.find(i => i.name === 'ダンまち 缶バッジ');
    check('new record saved to Drive', !!added);
    check('new fields saved', added && added.currency === 'JPY' && added.price === '1980' && added.balance === '300' && added.paymentDate === '2026-12-05' && added.note === '12/20 去 7-11 領貨' && added.month === '2027-01' && added.delivery === '寄到家', JSON.stringify(added));
    check('full-size picture uploaded to 購物紀錄網站圖片', added?.imageOriginalIds?.[0] && drive.files.get(added.imageOriginalIds[0])?.parents[0] === imageFolder.id);
    check('small picture kept inside the list', String(added?.image?.[0]).startsWith('data:image/jpeg'));
    check('old records unchanged in Drive', JSON.stringify(cloud.find(i => i.id === 1781455310160)) === JSON.stringify(oldItems[1]));
    const backupFolder = [...drive.files.values()].find(f => f.name === '購物紀錄備份');
    const backup = [...drive.files.values()].find(f => /^購物紀錄_\d{4}-W\d{2}\.json$/.test(f.name));
    check('weekly backup made before the first change', backupFolder?.parents[0] === workspace.id && backup?.parents[0] === backupFolder.id && backup.content.toString() === oldText);
    const card = page.locator('.item-card', {hasText: 'ダンまち 缶バッジ'});
    check('card shows 日幣, 補款日期, 尾款 and 備註', /¥1,980（日幣）/.test(await card.textContent()) && /補款 12\/5・尾款 ¥300（日幣）/.test(await card.textContent()) && /12\/20 去 7-11 領貨/.test(await card.textContent()), await card.textContent());

    /* 3. edit keeps unknown fields; archive */
    await page.locator('.item-card[data-item-id="1781455310160"] .item-title').dblclick();
    await page.fill('#itemNote', '已付款');
    await page.click('#submitBtn');
    await idle(page);
    cloud = readCloud();
    const edited = cloud.find(i => i.id === 1781455310160);
    check('editing keeps fields the page does not know', edited?.customField?.keep === true && edited.note === '已付款');
    await page.locator('.item-card[data-item-id="1781455310160"] .btn-complete').click();
    await idle(page);
    check('確認收貨 moves it to the archive', readCloud().find(i => i.id === 1781455310160)?.isCompleted === true);

    /* 4. another device saved in the meantime: both changes are kept */
    const other = readCloud();
    other.push({id: 99, name: '手機上新增的', delivery: '集運倉'});
    other.find(i => i.id === '1774117886334').note = '手機改的備註';
    const f = drive.files.get(dataFile.id); f.content = Buffer.from(JSON.stringify(other)); f.modifiedTime = new Date(Date.now() + 86400000).toISOString();
    await page.locator('.item-card[data-item-id="1773750101208"] .btn-complete').click();
    await idle(page);
    cloud = readCloud();
    check('changes from two devices are combined', cloud.some(i => i.id === 99) && cloud.find(i => i.id === '1774117886334')?.note === '手機改的備註' && cloud.find(i => i.id === '1773750101208')?.isCompleted === true);
    check('the other device’s record appears without reloading', await page.locator('.item-card[data-item-id="99"]').count() === 1);

    /* 5. 小幫手: reading shop pages (extension/grab.js) */
    const grabFile = join(SITE, 'extension/grab.js');
    async function readPage(url) {
        const p = await context.newPage();
        await p.goto(url);
        await p.addScriptTag({path: grabFile});
        const result = await p.evaluate(() => globalThis.__ndShopGrab.collect());
        return {p, result};
    }
    let r = await readPage('https://mybid.ruten.com.tw/master/view_transaction.php?tno=1');
    const rutenItem = r.result.items[0];
    check('Ruten: one record per order', r.result.items.length === 1 && /黑色與洋紅色（極光壓克力吊飾 雲雀恭彌（10年後）＋角色壓克力立牌 六道 骸（10年後））/.test(rutenItem.name), rutenItem?.name);
    check('Ruten: total, store, delivery, month and product pages read', rutenItem.price === '1170' && rutenItem.address === '醫學門市' && rutenItem.delivery === '取貨付款' && rutenItem.month === '2026-11' && rutenItem.imagePages.length === 2, JSON.stringify(rutenItem));
    await r.p.close();
    r = await readPage('https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm');
    check('Taobao: products, prices and pictures read', r.result.items.length === 3 && r.result.items[0].price === '245.76' && r.result.items[0].currency === 'CNY'
        && r.result.items[0].images?.[0] === 'https://img.alicdn.com/imgextra/i1/1/pic-a.jpg' && r.result.items[0].paymentDate === '2026-11-04' && r.result.items[1].price === '82.71', JSON.stringify(r.result.items));
    // several products: the small window, then the ticked ones are handed to the extension
    await r.p.evaluate(() => {window.__sent = null; globalThis.chrome = {runtime: {sendMessage: m => {window.__sent = m;}}};});
    await r.p.addScriptTag({path: grabFile});
    await r.p.evaluate(items => globalThis.__ndShopGrab.panel(items), r.result.items);
    await r.p.waitForSelector('#nd-shop-grab');
    await r.p.waitForTimeout(100);
    await r.p.keyboard.press('Enter');
    const sent = await r.p.evaluate(() => window.__sent);
    check('Taobao: the small window sends the first order to the extension', sent?.type === 'nd-save' && sent.payload.items.length === 1 && /云雀恭弥/.test(sent.payload.items[0].name) && await r.p.locator('#nd-shop-toast').count() === 1, JSON.stringify(sent));
    await r.p.close();
    r = await readPage('https://shop.example.jp/mypage/history/9');
    check('Japanese order history: products with 日幣, logo skipped', r.result.items.length === 2 && r.result.items[0].name === 'ダンまち アクリルスタンド リュー' && r.result.items[0].price === '1650' && r.result.items[0].currency === 'JPY' && r.result.items[0].url === 'https://shop.example.jp/products/1', JSON.stringify(r.result.items));
    await r.p.close();
    r = await readPage('https://shop.example.jp/products/1');
    check('product page read from its structured data', r.result.items.length === 1 && r.result.items[0].price === '1650' && r.result.items[0].currency === 'JPY' && r.result.items[0].images[0] === 'https://shop.example.jp/img/item1.jpg', JSON.stringify(r.result.items));
    await r.p.close();
    r = await readPage('https://login.example.com/orders');
    check('page without products: still gives the address and title', r.result.items.length === 0 && r.result.from === 'https://login.example.com/orders' && r.result.title === '我的訂單');
    await r.p.close();

    /* 6. 小幫手: saving straight to Drive (extension/save.js) */
    const beforeHelper = readCloud();
    const listBefore = beforeHelper.length;
    await page.exposeFunction('__otherDeviceSaves', () => {
        const other = readCloud();
        other.push({id: 77, name: '另一台電腦同時存的', delivery: '集運倉'});
        const file = drive.files.get(dataFile.id); file.content = Buffer.from(JSON.stringify(other)); file.modifiedTime = new Date(Date.now() + 2 * 86400000).toISOString();
    });
    const saveRun = (payload, otherDevice = false) => page.evaluate(async ({payload, otherDevice}) => {
        const {saveGrab} = await import('./extension/save.js');
        let first = true;
        const fetchFn = async (url, options) => {
            if (otherDevice && first && /uploadType=multipart/.test(String(url))) {first = false; await window.__otherDeviceSaves();}
            return fetch(url, options);
        };
        try {return await saveGrab(payload, {auth: {get: async () => 'tok-test', invalidate() {}}, fetchFn});}
        catch (error) {return {error: error.message};}
    }, {payload, otherDevice});
    const rutenSaved = await saveRun({v: 2, from: 'https://mybid.ruten.com.tw/master/view_transaction.php?tno=1', title: '訂單明細', items: [rutenItem]}, true);
    cloud = readCloud();
    const rutenRecord = cloud.find(i => /極光壓克力吊飾/.test(i.name));
    check('Ruten: saved straight to Drive with pictures from the product pages', rutenSaved.added?.length === 1 && rutenRecord?.image?.length === 2 && rutenRecord.imageOriginalIds.every(id => drive.files.get(id)?.parents[0] === imageFolder.id), JSON.stringify(rutenSaved));
    check('Ruten: total, store, delivery and month saved', rutenRecord?.price === '1170' && rutenRecord.address === '醫學門市' && rutenRecord.delivery === '取貨付款' && rutenRecord.month === '2026-11');
    check('another device saving at the same time is kept', cloud.some(i => i.id === 77) && cloud.length === listBefore + 2);
    check('old records untouched by the helper', beforeHelper.every(old => JSON.stringify(cloud.find(i => String(i.id) === String(old.id))) === JSON.stringify(old)));
    const again = await saveRun({v: 2, from: 'https://mybid.ruten.com.tw/master/view_transaction.php?tno=1', title: '訂單明細', items: [rutenItem]});
    check('same order again is not saved twice', again.added?.length === 0 && again.skipped?.length === 1 && readCloud().length === listBefore + 2);
    const tbSaved = await saveRun({v: 2, from: 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm', title: '已买到的宝贝', items: [sent.payload.items[0]]});
    const tb = readCloud().find(i => /云雀恭弥/.test(i.name));
    check('Taobao: saved with 人民幣, picture and the previous Taobao delivery', tbSaved.added?.length === 1 && tb.currency === 'CNY' && tb.price === '245.76' && tb.delivery === '補款' && tb.paymentDate === '2026-11-04' && tb.image?.length === 1, JSON.stringify({...tb, image: undefined}));
    const urlSaved = await saveRun({v: 2, from: 'https://login.example.com/orders', title: '我的訂單', items: []});
    const urlOnly = readCloud().find(i => i.url === 'https://login.example.com/orders');
    check('"only the address" saved as a record named after the page', urlSaved.added?.length === 1 && urlOnly?.name === '我的訂單' && !urlOnly.month && !urlOnly.image);
    const shown = await page.locator('.item-card').count();
    await page.evaluate(ids => window.dispatchEvent(new CustomEvent('nd-shopping-saved', {detail: {ids}})), urlSaved.added.map(a => a.id));
    await page.waitForFunction(n => document.querySelectorAll('.item-card').length > n, shown, {timeout: 15000});
    check('an open 購物紀錄 page shows what the helper saved at once', await page.locator('.item-card', {hasText: '我的訂單'}).count() === 1 && await page.locator('.item-card', {hasText: '另一台電腦同時存的'}).count() === 1);
    const roundTrip2 = await page.evaluate(() => {
        const {state, compactItem} = window.noteShopping;
        const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => k + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
        return state.items.every(i => canon(compactItem(i)) === canon(state.base.find(b => String(b.id) === String(i.id))));
    });
    check('records saved by the helper are in the page’s own format', roundTrip2);

    /* 7. month guessing */
    const months = await page.evaluate(async () => {
        const {guessMonth} = await import('./extension/save.js');
        return ['【八月預購】代理版', '預約8月(免訂金)', '12月発売予定 アクスタ', '(2026/5~6月補款)', '普通的商品'].map(n => guessMonth(n, new Date(2026, 10, 27)));
    });
    check('month guessed from the name', JSON.stringify(months) === JSON.stringify(['2027-08', '2027-08', '2026-12', '2026-05', '']), JSON.stringify(months));

    /* 8. the 小幫手 window on the 購物紀錄 page */
    await page.click('#helperBtn');
    await page.waitForFunction(() => /還沒裝/.test(document.getElementById('helperState').textContent));
    check('helper window: says this computer does not have it yet', await page.isVisible('#helperDialog.open') && await page.getAttribute('#helperDownload', 'href') === 'assets/shopping-helper.zip');
    await page.click('#helperDialog [data-close-dialog]');
    await page.evaluate(() => {document.documentElement.dataset.ndShopHelper = '0.9.0';});
    await page.click('#helperBtn');
    await page.waitForFunction(() => /有新版/.test(document.getElementById('helperState').textContent));
    await page.click('#helperDialog [data-close-dialog]');
    await page.evaluate(() => {document.documentElement.dataset.ndShopHelper = '1.0.0';});
    await page.click('#helperBtn');
    await page.waitForFunction(() => /已經裝好/.test(document.getElementById('helperState').textContent));
    check('helper window: notices old and current versions', true);
    await page.click('#helperDialog [data-close-dialog]');
    const zip = await (await fetch(BASE + 'assets/shopping-helper.zip')).arrayBuffer();
    check('the helper download is there', zip.byteLength > 10000);

    /* 9. the notes page menu has 購物紀錄 */
    const notes = await context.newPage();
    notes.on('dialog', d => d.accept());
    await notes.goto(BASE + '?book=pharmacology');
    await notes.waitForFunction(() => document.querySelector('#drive-book option[value="__shopping"]') || !document.getElementById('site-gate-button').hidden, null, {timeout: 60000});
    if (await notes.isVisible('#site-gate-button')) await notes.click('#site-gate-button');
    await notes.waitForSelector('#drive-book option[value="__shopping"]', {state: 'attached', timeout: 60000});
    await notes.waitForFunction(() => window.noteDriveStartupComplete === true, null, {timeout: 60000});
    await Promise.all([notes.waitForURL(/shopping\.html$/, {timeout: 30000}), notes.selectOption('#drive-book', '__shopping')]);
    check('notes menu → 購物紀錄', notes.url().endsWith('shopping.html'));
    await notes.waitForFunction(() => window.noteShopping?.state.ready, null, {timeout: 30000});
    await Promise.all([notes.waitForURL(/\?book=analysis$/, {timeout: 30000}), notes.selectOption('#shop-book', 'analysis')]);
    check('購物紀錄 menu → back to a subject', notes.url().endsWith('?book=analysis'));
    await notes.close();

    /* 10. offline: opens this device's copy */
    const n2 = (await readCloud()).length;
    const offline = await context.newPage();
    await offline.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', {get: () => false}));
    await offline.goto(BASE + 'shopping.html');
    await offline.waitForFunction(() => window.noteShopping?.state.ready, null, {timeout: 30000});
    check('offline: shows the records kept on this device', await offline.locator('.item-card').count() === n2 && /離線/.test(await offline.textContent('#syncStatus')), (await offline.locator('.item-card').count()) + ' vs ' + n2);
    await offline.close();
    await context.close();

    check('no page errors', !problems.length, problems.slice(0, 5).join(' | '));

    /* 11. the real extension in Chromium: fixed ID, and one click saves a Ruten order */
    const extDir = join(SITE, 'extension');
    const ext = await chromium.launchPersistentContext('/tmp/nd-ext-profile-' + Date.now(), {channel: 'chromium', headless: true,
        args: ['--disable-extensions-except=' + extDir, '--load-extension=' + extDir]});
    try {
        let [sw] = ext.serviceWorkers();
        if (!sw) sw = await ext.waitForEvent('serviceworker', {timeout: 20000});
        check('extension loads with its fixed ID', new URL(sw.url()).host === 'jhlnccbeohgdnkpmbcmnenpaholabnea', sw.url());
        check('sign-in return address is the one to add in Google Cloud', await sw.evaluate(() => chrome.identity.getRedirectURL()) === 'https://jhlnccbeohgdnkpmbcmnenpaholabnea.chromiumapp.org/');
        await setupRoutes(ext);
        if (!ext.pages().some(p => /options\.html/.test(p.url()))) await ext.waitForEvent('page', {timeout: 10000}).catch(() => null);
        check('settings page opens after installing', ext.pages().some(p => /options\.html/.test(p.url())), ext.pages().map(p => p.url()).join(', '));
        await sw.evaluate(() => chrome.storage.session.set({token: 'tok-ext', expiresAt: Date.now() + 3600000}));
        const before = readCloud().length;
        async function press(url) {
            const shop = await ext.newPage();
            await shop.goto(url);
            const pressed = await sw.evaluate(async host => {
                const [tab] = await chrome.tabs.query({url: 'https://' + host + '/*'});
                if (!tab) return 'no tab';
                await globalThis.ndRecordForTests(tab);
                return 'ok';
            }, new URL(url).host);
            const shown = await shop.waitForSelector('#nd-shop-toast', {state: 'attached', timeout: 20000}).then(() => true, () => false);
            return {shop, pressed, shown};
        }
        let press1 = await press('https://mybid.ruten.com.tw/master/view_transaction.php?tno=1');
        check('extension click on a saved order: message on the page, not saved twice', press1.pressed === 'ok' && press1.shown && readCloud().length === before, JSON.stringify({...press1, shop: undefined}));
        const press2 = await press('https://shop.example.jp/products/1');
        const deadline = Date.now() + 30000;
        while (readCloud().length === before && Date.now() < deadline) await new Promise(r => setTimeout(r, 300));
        const viaExtension = readCloud().find(i => /アクリルスタンド リュー 12月発売予定/.test(i.name));
        check('extension click on a product page: saved with picture, 日幣 and month', press2.shown && viaExtension?.price === '1650' && viaExtension.currency === 'JPY' && viaExtension.month === '2026-12' && viaExtension.image?.length === 1, JSON.stringify({...viaExtension, image: viaExtension?.image?.length}));
    } catch (error) {
        check('extension test ran', false, String(error.message || error).slice(0, 300));
    } finally {await ext.close();}
} catch (error) {
    console.log('FAIL test crashed — ' + (error.stack || error));
    results.push({ok: false});
} finally {
    await browser.close();
    server.close();
}
const failed = results.filter(r => !r.ok).length;
console.log(failed ? failed + ' FAILED' : 'ALL ' + results.length + ' PASS');
process.exit(failed ? 1 : 0);
