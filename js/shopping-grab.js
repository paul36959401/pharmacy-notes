/* 一鍵記錄 bookmark. This file is turned into the bookmark by tools/build.mjs
 * (js/shopping-grab.min.js) and the 購物紀錄 page wraps it as
 *   javascript:void (function (SHOP, DRY) {...})("<購物紀錄網址>", false)
 *
 * It runs on the shop's own page when the bookmark is clicked, reads the products shown
 * there and opens the 購物紀錄 page with them. Whatever happens, at least the page address
 * and title are sent, so the click is never wasted. The data travels only in the address
 * after "#", which stays in the browser (it is not sent to GitHub or anywhere else).
 * DRY = true returns what was found instead of sending it (used by the tests).
 * Bump V together with GRAB_VERSION in js/shopping.js when this file changes.
 */
(function (SHOP, DRY) {
    'use strict';
    var V = 1;
    var host = location.hostname.replace(/^www\./, '');
    var lang = String(document.documentElement.lang || '').toLowerCase();

    function clean(value, max) {return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 200);}
    function abs(value) {
        try {var u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.href : '';} catch (e) {return '';}
    }
    function lines(el) {return String(el.innerText || el.textContent || '').split(/\n+/).map(function (s) {return clean(s, 400);}).filter(Boolean);}

    /* ---------- prices ---------- */
    function currencyOf(symbol) {
        if (/NT|TWD/.test(symbol)) return 'TWD';
        if (/円|JPY/.test(symbol)) return 'JPY';
        if (/RMB|CNY|人民幣|人民币/.test(symbol)) return 'CNY';
        var chinaShop = /taobao|tmall|1688\.com|jd\.com|weidian|pinduoduo|alicdn/.test(host);
        if (/[¥￥]/.test(symbol)) return chinaShop ? 'CNY' : /\.jp$/.test(host) || lang.indexOf('ja') === 0 ? 'JPY' : /zh-(cn|hans)/.test(lang) ? 'CNY' : 'JPY';
        if (symbol === '元') return chinaShop ? 'CNY' : 'TWD';
        return /\.jp$/.test(host) ? 'JPY' : 'TWD';
    }
    function prices(text) {
        var out = [], m, re = /(NT\$|NTD|TWD|JPY|RMB|CNY|\$|＄|¥|￥)\s*([0-9][0-9,，]*(?:\.[0-9]{1,2})?)|([0-9][0-9,，]*(?:\.[0-9]{1,2})?)\s*(円|元|JPY|TWD|RMB|人民幣|人民币)/g;
        while ((m = re.exec(text))) {
            var amount = (m[2] || m[3]).replace(/[,，]/g, '');
            if (!(parseFloat(amount) > 0) || parseFloat(amount) > 9999999) continue;
            out.push({amount: amount, currency: currencyOf(m[1] || m[4]), index: m.index});
        }
        return out;
    }
    var LABELS = ['結帳總金額', '實付款', '实付款', '実付', '支付金額', '支付金额', 'お支払い金額', 'お支払金額', 'ご請求金額', 'ご注文金額', 'お買い上げ金額', '合計金額', '総合計', '總金額', '总金额', '應付金額', '应付金额', '訂單金額', '订单金额', '合計', '合计', '總計', '总计', '小計', '小计', 'Total'];
    function pickPrice(text, labelsFirst) {
        var all = prices(text);
        if (!all.length) return null;
        if (labelsFirst) {
            for (var i = 0; i < LABELS.length; i++) {
                var at = text.indexOf(LABELS[i]);
                if (at < 0) continue;
                for (var j = 0; j < all.length; j++) if (all[j].index > at && all[j].index - at < 40) return all[j];
            }
        }
        return all[0];
    }

    /* ---------- pictures ---------- */
    var BAD_PICTURE = /logo|icon|sprite|banner|avatar|badge|qr[-_]?code|loading|blank|spacer|arrow|btn|button|placeholder|tps-\d+-\d+|\/ad\//i;
    function bigger(url) {
        // Shop pictures are often thumbnails: ask for the full picture instead.
        return url.replace(/(\/\/[^/]*alicdn\.com\/.+?\.(?:jpe?g|png|gif|webp))_[^/]*$/i, '$1')
            .replace(/(\/\/[^/]*\.rimg\.com\.tw\/.+?)_[sm]\.(jpe?g|png)$/i, '$1.$2');
    }
    function pictureUrl(img) {
        var src = img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('data-ks-lazyload') || '';
        if (/^data:image\//.test(src)) return src.length < 60000 ? src : '';
        return src ? bigger(abs(src)) : '';
    }
    function backgroundUrl(el) {
        var bg = el.style && el.style.backgroundImage;
        if (!bg || bg === 'none') bg = getComputedStyle(el).backgroundImage;
        var m = /url\(["']?([^"')]+)["']?\)/.exec(bg || '');
        return m ? bigger(abs(m[1])) : '';
    }
    function goodPicture(img) {
        var r = img.getBoundingClientRect();
        if (r.width < 40 || r.height < 40 || r.width / r.height > 3.5 || r.height / r.width > 3.5) return false;
        var src = pictureUrl(img);
        if (!src || BAD_PICTURE.test(src) || BAD_PICTURE.test(img.className || '') || /logo|icon/i.test(img.alt || '')) return false;
        return !img.closest('header, nav, footer');
    }
    function picturesIn(el, max) {
        var out = [];
        [].forEach.call(el.querySelectorAll('img'), function (img) {
            var u = goodPicture(img) && pictureUrl(img);
            if (u && out.indexOf(u) < 0) out.push(u);
        });
        if (!out.length) {
            var nodes = el.querySelectorAll('div, span, a, i, figure');
            for (var i = 0; i < nodes.length && i < 300; i++) {
                var r = nodes[i].getBoundingClientRect();
                if (r.width < 40 || r.height < 40) continue;
                var u = backgroundUrl(nodes[i]);
                if (u && !BAD_PICTURE.test(u) && out.indexOf(u) < 0) out.push(u);
            }
        }
        return out.slice(0, max || 4);
    }

    /* ---------- names ---------- */
    var NOT_NAME = /^(詳細|詳情|详情|查看|view|more|再買一單|再买一单|確認收貨|确认收货|加入購物車|加入购物车|退款|評價|评价|訂單詳情|订单详情|交易快照|商品詳細|カートに入れる|購入|再購入)/i;
    function nameIn(card, img) {
        var best = '';
        [].forEach.call(card.querySelectorAll('a, h1, h2, h3, h4, h5, [class*="name"], [class*="title"], [class*="Name"], [class*="Title"]'), function (el) {
            var t = clean(el.textContent);
            if (t.length > best.length && t.length >= 4 && !NOT_NAME.test(t) && !/^[\d\s,.$¥￥円元NT:：\/-]+$/.test(t) && !prices(t).length) best = t;
        });
        if (!best && img) best = clean(img.alt || img.title);
        if (!best) lines(card).some(function (t) {
            if (t.length >= 4 && !NOT_NAME.test(t) && !prices(t).length && !/^[\d\s,./:：-]+$/.test(t)) {best = t; return true;}
            return false;
        });
        return clean(best.replace(/\[交易快照\]|\[交易快照]/g, ''));
    }

    /* ---------- one record for a whole order: "共同名稱（A＋B＋C）" ---------- */
    function mergeNames(parts) {
        var names = parts.map(function (p) {return p.name;});
        var specs = parts.map(function (p) {return p.spec || '';});
        var first = names[0] || '';
        if (names.length < 2) return clean(first + (specs[0] ? '（' + specs[0] + '）' : ''));
        var pre = first.length;
        names.forEach(function (n) {var i = 0; while (i < pre && i < n.length && n[i] === first[i]) i++; pre = i;});
        var cut = first.slice(0, pre).search(/[\s】)\]）」][^\s】)\]）」]*$/);
        if (cut >= 0 && pre < first.length) pre = cut + 1;
        var suf = 0;
        names.forEach(function (n, k) {
            if (!k) {suf = first.length - pre; return;}
            var i = 0;
            while (i < suf && i < n.length - pre && n[n.length - 1 - i] === first[first.length - 1 - i]) i++;
            suf = i;
        });
        var rests = names.map(function (n, k) {return clean(n.slice(pre, n.length - suf) + (specs[k] ? ' ' + specs[k] : ''));});
        var head = clean(first.slice(0, pre));
        if (head.length < 6) return clean(names.map(function (n, k) {return n + (specs[k] ? ' ' + specs[k] : '');}).join('＋'), 300);
        return clean(head + '（' + rests.filter(Boolean).join('＋') + '）', 300);
    }
    function deliveryOf(text) {
        if (/取貨付款|取货付款|貨到付款|货到付款|代收/.test(text)) return '取貨付款';
        if (/超商取貨|門市取貨|店到店|純取貨|取貨不付款|7-11|全家|萊爾富|OK超商/.test(text)) return '純取貨';
        if (/集運|集运|転送|轉運/.test(text)) return '集運倉';
        if (/宅配|郵寄|寄送|黑貓|新竹物流|宅急便|ゆうパック|配送/.test(text)) return '寄到家';
        return '';
    }
    function payDate(text) {
        var m = /(補款|补款|尾款|残金|殘金)\s*(?:期限|時間|时间|日期|開始|开始)?[：:\s]*(20\d{2})\s*[\/年.-]\s*(\d{1,2})\s*(?:[\/月.-]\s*(\d{1,2}))?/.exec(text);
        if (!m) return '';
        return m[2] + '-' + ('0' + m[3]).slice(-2) + '-' + ('0' + (m[4] || 1)).slice(-2);
    }

    /* ---------- 露天：訂單明細 → one record for the order ---------- */
    function ruten() {
        if (!/(^|\.)ruten\.com\.tw$/.test(location.hostname) || !/view_transaction/.test(location.pathname)) return null;
        var rows = document.querySelectorAll('.col-goods-inner-item-main');
        if (!rows.length) return null;
        var parts = [], pages = [], month = '';
        [].forEach.call(rows, function (row) {
            var a = row.querySelector('a[href*="/item/"]');
            if (!a) return;
            var spec = '';
            lines(row).forEach(function (t) {
                var s = /^規格[：:]\s*(.+)$/.exec(t); if (s) spec = clean(s[1], 60);
                var mo = /出貨年月[：:].*?(20\d{2})\s*\/\s*(\d{1,2})/.exec(t);
                if (mo) {var v = mo[1] + '-' + ('0' + mo[2]).slice(-2); if (v > month) month = v;}
            });
            parts.push({name: clean(a.textContent, 160), spec: spec});
            var page = abs(a.href);
            if (page && pages.indexOf(page) < 0) pages.push(page);
        });
        if (!parts.length) return null;
        var all = document.body.innerText;
        var total = (/結帳總金額\s*\$?\s*([0-9][0-9,]*)/.exec(all) || [])[1] || '';
        var address = '';
        [].some.call(document.querySelectorAll('.transaction-section-main-item-label, span, div, th'), function (el) {
            if (clean(el.textContent) !== '門市 / 地址' && clean(el.textContent) !== '門市/地址') return false;
            var box = el.nextElementSibling || el.parentElement;
            var first = box && (box.querySelector('span, strong, b') || box);
            address = clean(first && first.textContent, 60).split(/\s{2,}/)[0];
            return !!address;
        });
        var shipping = document.querySelector('.transaction-section-header-content');
        return [{
            name: mergeNames(parts), price: total.replace(/,/g, ''), currency: 'TWD', url: location.href,
            delivery: deliveryOf(clean(shipping && shipping.textContent) || (/運送方式\s*\n?\s*([^\n]+)/.exec(all) || [])[1] || ''),
            address: address, month: month, imagePages: pages.slice(0, 4)
        }];
    }

    /* ---------- 淘寶／天貓：已買到的寶貝 → one record per product ---------- */
    function taobao() {
        var orders = document.querySelectorAll('[id^="shopOrderContainer_"]');
        if (!orders.length) return null;
        var out = [];
        [].forEach.call(orders, function (order, orderIndex) {
            var infos = order.querySelectorAll('[class*="trade-bought-list-order-info"]');
            var paid = (/实付款\s*[￥¥]\s*([0-9][0-9,]*(?:\.[0-9]+)?)/.exec(order.innerText) || [])[1];
            [].forEach.call(infos, function (info) {
                var a = info.querySelector('a[class*="title"]') || info.querySelector('a[href*="item.htm"]');
                if (!a) return;
                var p = prices(info.innerText)[0];
                var box = info;
                for (var i = 0; i < 3 && !picturesIn(box, 1).length && box.parentElement && box.parentElement !== order; i++) box = box.parentElement;
                out.push({
                    name: clean(a.textContent.replace(/\[交易快照\]/g, '')),
                    price: String(infos.length === 1 && paid ? paid : p ? p.amount : '').replace(/,/g, ''),
                    currency: 'CNY', url: abs(a.href), images: picturesIn(box, 1),
                    paymentDate: payDate(info.innerText), group: orderIndex
                });
            });
        });
        return out.length ? out : null;
    }

    /* ---------- product page (structured data) ---------- */
    function meta(name) {
        var m = document.querySelector('meta[property="' + name + '"], meta[name="' + name + '"]');
        return m ? m.getAttribute('content') || '' : '';
    }
    function normalCurrency(c) {
        c = String(c || '').toUpperCase();
        return c === 'RMB' ? 'CNY' : c === 'NTD' ? 'TWD' : /^(JPY|CNY|TWD)$/.test(c) ? c : '';
    }
    function product() {
        var found = null;
        function walk(node) {
            if (!node || found) return;
            if (Array.isArray(node)) {node.forEach(walk); return;}
            if (typeof node !== 'object') return;
            if (/Product/i.test([].concat(node['@type'] || []).join(' ')) && node.name) {
                var offer = [].concat(node.offers || [])[0] || {};
                if (offer.offers) offer = [].concat(offer.offers)[0] || offer;
                var image = [].concat(node.image || [])[0];
                if (image && typeof image === 'object') image = image.url || image.contentUrl;
                var price = String(offer.price || offer.lowPrice || '').replace(/[^0-9.]/g, '');
                found = {name: clean(node.name), price: price, currency: normalCurrency(offer.priceCurrency) || (price ? currencyOf('$') : ''),
                    url: location.href, images: image ? [bigger(abs(image))] : []};
                return;
            }
            if (node['@graph']) walk(node['@graph']);
        }
        [].forEach.call(document.querySelectorAll('script[type="application/ld+json"]'), function (s) {
            try {walk(JSON.parse(s.textContent));} catch (e) {}
        });
        if (!found) {
            var amount = meta('product:price:amount') || meta('og:price:amount');
            if (/product/i.test(meta('og:type')) || amount) {
                found = {name: clean(meta('og:title') || document.title), price: String(amount).replace(/[^0-9.]/g, ''),
                    currency: normalCurrency(meta('product:price:currency') || meta('og:price:currency')) || currencyOf('$'),
                    url: location.href, images: meta('og:image') ? [bigger(abs(meta('og:image')))] : []};
            }
        }
        if (found && !found.price) {
            var p = pickPrice(clean(document.body.innerText, 20000), false);
            if (p) {found.price = p.amount; found.currency = p.currency;}
        }
        return found && found.name ? [found] : null;
    }

    /* ---------- any other page: product cards = a picture with its own text ---------- */
    var NOISE = /recommend|suggest|ranking|carousel|slider|swiper|banner|footprint|guess|related|推薦|推荐|おすすめ|猜你喜欢|最近浏览|最近瀏覽/i;
    function generic() {
        var pics = [].filter.call(document.images, goodPicture);
        var cards = [];
        pics.forEach(function (img) {
            var card = img, best = null;
            for (var i = 0; i < 8 && card.parentElement && card.parentElement !== document.body; i++) {
                var parent = card.parentElement, others = 0;
                for (var k = 0; k < pics.length && others < 2; k++) if (pics[k] !== img && parent.contains(pics[k]) && pictureUrl(pics[k]) !== pictureUrl(img)) others++;
                if (others) break;
                card = parent;
                var t = clean(card.innerText, 2000);
                if (t.length >= 4 && t.length < 1500) best = card;
            }
            if (!best) return;
            for (var c = 0; c < cards.length; c++) if (cards[c].el === best || cards[c].el.contains(best) || best.contains(cards[c].el)) return;
            var marker = best;
            for (var up = 0; up < 6 && marker; up++, marker = marker.parentElement) if (NOISE.test((marker.id || '') + ' ' + (typeof marker.className === 'string' ? marker.className : ''))) return;
            cards.push({el: best, img: img});
        });
        return cards.map(function (c) {
            var link = c.img.closest('a[href]') || c.el.querySelector('a[href]');
            var price = pickPrice(clean(c.el.innerText, 1500), true);
            return {name: nameIn(c.el, c.img), price: price ? price.amount : '', currency: price ? price.currency : '',
                url: link && abs(link.href) && !/^javascript:/i.test(link.getAttribute('href') || '') && !/#$/.test(link.getAttribute('href') || '') ? abs(link.href) : location.href,
                images: [pictureUrl(c.img)], paymentDate: payDate(c.el.innerText)};
        }).filter(function (it) {return it.name.length >= 2;}).slice(0, 30);
    }

    /* ---------- sending ---------- */
    function payload(items, merged) {
        return {v: V, from: location.href, title: clean(document.title), site: host, merged: !!merged,
            items: items.map(function (it) {
                var o = {};
                ['name', 'price', 'currency', 'url', 'delivery', 'address', 'month', 'paymentDate'].forEach(function (k) {if (it[k]) o[k] = clean(it[k], k === 'url' ? 2000 : 300);});
                var images = [].concat(it.images || []).filter(Boolean).slice(0, 4);
                if (images.length) o.images = images;
                if (it.imagePages && it.imagePages.length) o.imagePages = it.imagePages.slice(0, 4);
                return o;
            })};
    }
    function send(items, merged) {
        var data = payload(items, merged);
        if (DRY) return data;
        var json = JSON.stringify(data);
        var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        var url = SHOP + '#grab=' + b64;
        var w = null;
        try {w = window.open(url, 'nd-shopping');} catch (e) {}
        if (!w) location.href = url;
        return data;
    }
    function combine(items) {
        var total = pickPrice(clean(document.body.innerText, 30000), true);
        var images = [];
        items.forEach(function (it) {[].concat(it.images || []).forEach(function (u) {if (u && images.indexOf(u) < 0) images.push(u);});});
        return [{
            name: mergeNames(items.map(function (it) {return {name: it.name};})),
            price: total ? total.amount : items[0].price, currency: total ? total.currency : items[0].currency,
            url: location.href, images: images.slice(0, 4), paymentDate: items[0].paymentDate
        }];
    }

    /* ---------- the small window on the shop page ---------- */
    function panel(items) {
        var old = document.getElementById('nd-shop-grab');
        if (old) old.remove();
        var hostEl = document.createElement('div');
        hostEl.id = 'nd-shop-grab';
        hostEl.style.all = 'initial';
        hostEl.style.position = 'fixed'; hostEl.style.top = '16px'; hostEl.style.right = '16px'; hostEl.style.zIndex = '2147483647';
        var root = hostEl.attachShadow ? hostEl.attachShadow({mode: 'closed'}) : hostEl;
        var css = ':host,*{box-sizing:border-box;font-family:"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif}' +
            '.box{width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;background:#fff;color:#223;border:1px solid #cfe3dc;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.25);overflow:hidden;font-size:14px}' +
            '.head{padding:12px 14px;background:#f0fdfa;color:#0f766e;font-weight:800;display:flex;justify-content:space-between;align-items:center;gap:8px}' +
            '.head small{font-weight:500;color:#4b6b63}.list{overflow:auto;padding:6px 8px}' +
            'label.row{display:grid;grid-template-columns:22px 48px 1fr;gap:8px;align-items:center;padding:7px 6px;border-radius:9px;cursor:pointer}' +
            'label.row:hover{background:#f6faf8}.row img,.row .ph{width:48px;height:48px;object-fit:contain;border-radius:6px;background:#f1f4f3}' +
            '.name{line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.price{color:#b45309;font-size:12px;font-weight:700}' +
            '.foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;padding:10px 12px;border-top:1px solid #e5eeea;background:#fbfdfc}' +
            '.merge{margin-right:auto;font-size:13px;color:#3f5a53;display:flex;gap:5px;align-items:center;cursor:pointer}' +
            'button{font:inherit;border-radius:999px;padding:7px 14px;cursor:pointer;border:1px solid #cfe3dc;background:#fff;color:#245b52}' +
            'button.go{background:#0f766e;border-color:#0f766e;color:#fff;font-weight:800}button.x{border:0;background:transparent;font-size:20px;padding:0 4px;color:#4b6b63}';
        try {var sheet = new CSSStyleSheet(); sheet.replaceSync(css); root.adoptedStyleSheets = [sheet];}
        catch (e) {var style = document.createElement('style'); style.textContent = css; root.appendChild(style);}
        function el(tag, cls, text) {var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e;}
        var box = el('div', 'box'), head = el('div', 'head'), list = el('div', 'list'), foot = el('div', 'foot');
        var title = el('div', '', '🛍 記錄購物');
        title.appendChild(el('small', '', '　找到 ' + items.length + ' 個商品，勾選要記錄的'));
        var close = el('button', 'x', '×');
        head.appendChild(title); head.appendChild(close);
        var firstGroup = items[0].group;
        var boxes = items.map(function (it, i) {
            var row = el('label', 'row'), cb = el('input');
            cb.type = 'checkbox';
            cb.checked = firstGroup != null ? it.group === firstGroup : i === 0;
            var pic = it.images && it.images[0];
            var thumb = pic ? el('img') : el('div', 'ph');
            if (pic) {thumb.src = pic; thumb.referrerPolicy = 'no-referrer';}
            var text = el('div');
            text.appendChild(el('div', 'name', it.name));
            if (it.price) text.appendChild(el('div', 'price', (it.currency === 'JPY' ? '¥' : it.currency === 'CNY' ? '¥' : '$') + it.price + (it.currency === 'JPY' ? '（日幣）' : it.currency === 'CNY' ? '（人民幣）' : '')));
            row.appendChild(cb); row.appendChild(thumb); row.appendChild(text);
            list.appendChild(row);
            return cb;
        });
        var mergeLabel = el('label', 'merge'), merge = el('input');
        merge.type = 'checkbox';
        mergeLabel.appendChild(merge); mergeLabel.appendChild(document.createTextNode('合併成一筆'));
        var onlyUrl = el('button', '', '只記網址'), go = el('button', 'go', '');
        function count() {
            var n = boxes.filter(function (b) {return b.checked;}).length;
            go.textContent = n ? (merge.checked && n > 1 ? '記錄成 1 筆' : '記錄 ' + n + ' 筆') : '只記網址';
        }
        boxes.forEach(function (b) {b.addEventListener('change', count);});
        merge.addEventListener('change', count);
        count();
        function done() {hostEl.remove(); document.removeEventListener('keydown', keys, true);}
        function keys(e) {if (e.key === 'Escape') done();}
        document.addEventListener('keydown', keys, true);
        close.addEventListener('click', done);
        onlyUrl.addEventListener('click', function () {done(); send([], false);});
        go.addEventListener('click', function () {
            var chosen = items.filter(function (it, i) {return boxes[i].checked;});
            done();
            send(merge.checked && chosen.length > 1 ? combine(chosen) : chosen, merge.checked && chosen.length > 1);
        });
        foot.appendChild(mergeLabel); foot.appendChild(onlyUrl); foot.appendChild(go);
        box.appendChild(head); box.appendChild(list); box.appendChild(foot);
        root.appendChild(box);
        document.documentElement.appendChild(hostEl);
        setTimeout(function () {try {go.focus();} catch (e) {}}, 30);
    }

    /* ---------- main ---------- */
    if (SHOP && location.href.indexOf(SHOP.split('#')[0]) === 0) {alert('這個書籤要在購物網站的訂單頁或商品頁按喔！'); return;}
    var items = null;
    try {items = ruten() || taobao() || product() || generic();} catch (e) {items = null;}
    if (DRY) return payload(items || []);
    if (!items || !items.length) return void send([], false);
    if (items.length === 1) return void send(items, false);
    try {panel(items);} catch (e) {send([], false);}
})
