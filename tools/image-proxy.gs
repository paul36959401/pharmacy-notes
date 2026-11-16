/* 筆記圖片代理（給 GitHub Pages 版筆記網站用）
 *
 * 用途：把「從阿摩、Google 圖片或其他網站拖進筆記的圖片」下載下來，交給筆記網站存進你的 Google Drive。
 * 瀏覽器不能直接讀別的網站的圖片內容，所以需要這個小代理幫忙。
 *
 * 安全：
 *  - 只替「這個 Apps Script 的擁有者本人」服務：每次請求都要附上筆記網站的 Google 登入憑證，
 *    代理會向 Google 確認憑證屬於本人、而且是發給筆記網站的，才會幫忙下載。
 *  - 不讀寫你的 Google Drive，也不碰筆記資料；憑證只用來確認身分。
 *  - 只回傳真正的圖片（檢查檔案開頭），最大 16 MB。
 *
 * 部署：部署 → 新增部署作業 → 網頁應用程式；執行身分「我」；存取權「所有人」。
 */
var NOTE_SITE_CLIENT_ID = '763409300868-6vuidharbkm839vkag59kft4h1a02c6m.apps.googleusercontent.com';

function doPost(e) {
  var out;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    checkCaller_(body.token);
    out = fetchImage_(body.url);
  } catch (err) {
    out = {success: false, code: err.code || 'EXTERNAL_IMAGE', error: String(err.message || err).slice(0, 300), retryable: err.retryable !== false};
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({success: true, service: 'note-image-proxy'})).setMimeType(ContentService.MimeType.JSON);
}

/* Only the owner, signed in on the notes website, may use the proxy. */
function checkCaller_(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) throw fail_('缺少登入憑證，請重新整理筆記網站。', 'PROXY_AUTH', false);
  var cache = CacheService.getScriptCache();
  var key = 'ok-' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  if (cache.get(key)) return;
  var info = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), {muteHttpExceptions: true});
  if (info.getResponseCode() !== 200) throw fail_('登入憑證已過期，請在筆記網站重新連線。', 'PROXY_AUTH', false);
  var data = JSON.parse(info.getContentText());
  if (data.aud !== NOTE_SITE_CLIENT_ID && data.azp !== NOTE_SITE_CLIENT_ID) throw fail_('登入憑證不是筆記網站發出的。', 'PROXY_AUTH', false);
  var about = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true});
  if (about.getResponseCode() !== 200) throw fail_('無法確認登入身分。', 'PROXY_AUTH', false);
  var email = String(JSON.parse(about.getContentText()).user.emailAddress || '').toLowerCase();
  if (!email || email !== String(Session.getEffectiveUser().getEmail()).toLowerCase()) throw fail_('這個圖片代理只供擁有者本人使用。', 'PROXY_AUTH', false);
  cache.put(key, '1', Math.max(60, Math.min(1800, Number(data.expires_in || 0) - 60)));
}

function imageUrl_(value) {
  var match = String(value || '').trim().match(/^https?:\/\/([a-z0-9.-]+)(?::(\d{2,5}))?([/?][^\s#]*)?(?:#[^\s]*)?$/i);
  if (!match || String(value).length > 10000) throw fail_('圖片網址格式不正確。', 'EXTERNAL_IMAGE_URL', false);
  var host = match[1].toLowerCase();
  if (host === 'localhost' || /^[\d.]+$/.test(host) || host.indexOf('.') < 0) throw fail_('這個圖片網址不能使用。', 'EXTERNAL_IMAGE_URL', false);
  var port = match[2] && match[2] !== '80' && match[2] !== '443' ? ':' + match[2] : '';
  var scheme = /^http:/i.test(value) && !/(^|\.)yamol\.tw$/.test(host) ? 'http://' : 'https://';
  return scheme + host + port + (match[3] ? (match[3][0] === '?' ? '/' : '') + match[3] : '/');
}

function fetchImage_(value) {
  var url = imageUrl_(value);
  for (var attempt = 0; attempt < 5; attempt++) {
    var host = url.match(/^https?:\/\/([^/:]+)/)[1];
    var referer = /(^|\.)yamol\.tw$/.test(host) ? 'https://yamol.tw/' : url.match(/^https?:\/\/[^/]+/)[0] + '/';
    var response = UrlFetchApp.fetch(url, {method: 'get', muteHttpExceptions: true, followRedirects: false,
      headers: {Accept: 'image/avif,image/webp,image/*;q=0.9,*/*;q=0.5', Referer: referer}});
    var status = response.getResponseCode(), headers = response.getAllHeaders();
    var header = function (name) {
      var k = Object.keys(headers).filter(function (x) {return x.toLowerCase() === name;})[0];
      return String(k ? headers[k] : '');
    };
    if ([301, 302, 303, 307, 308].indexOf(status) >= 0) {
      var next = header('location');
      if (!next) throw fail_('圖片重新導向缺少網址。');
      if (next.indexOf('//') === 0) next = 'https:' + next;
      else if (!/^https?:\/\//i.test(next)) {
        var origin = url.match(/^https?:\/\/[^/]+/)[0];
        next = next[0] === '/' ? origin + next : next[0] === '?' ? url.split('?')[0] + next : url.split('?')[0].replace(/[^/]*$/, '') + next;
      }
      url = imageUrl_(next);
      continue;
    }
    if (status !== 200) throw fail_(status === 401 || status === 403 ? '來源網站限制這張圖片的讀取；圖片連結與筆記仍保留。' : '來源圖片暫時無法讀取（HTTP ' + status + '）。', 'EXTERNAL_IMAGE_HTTP', status >= 500 || status === 429);
    var max = 16 * 1024 * 1024;
    if (Number(header('content-length')) > max) throw fail_('單張外部圖片超過 16 MB。', 'EXTERNAL_IMAGE_SIZE', false);
    var bytes = response.getBlob().getBytes();
    if (!bytes.length || bytes.length > max) throw fail_('外部圖片為空或超過 16 MB。', 'EXTERNAL_IMAGE_SIZE', false);
    var b = bytes.slice(0, 256).map(function (v) {return (v + 256) % 256;}), prefix = String.fromCharCode.apply(null, b);
    var mime = header('content-type').split(';')[0].trim().toLowerCase();
    if (b[0] === 137 && prefix.slice(1, 4) === 'PNG') mime = 'image/png';
    else if (b[0] === 255 && b[1] === 216 && b[2] === 255) mime = 'image/jpeg';
    else if (/^GIF8[79]a/.test(prefix)) mime = 'image/gif';
    else if (prefix.slice(0, 4) === 'RIFF' && prefix.slice(8, 12) === 'WEBP') mime = 'image/webp';
    else if (prefix.indexOf('BM') === 0) mime = 'image/bmp';
    else if (/<svg[\s>]/i.test(prefix) && !/<html[\s>]/i.test(prefix)) mime = 'image/svg+xml';
    else if (['image/avif', 'image/heic', 'image/heif'].indexOf(mime) < 0 || prefix.slice(4, 8) !== 'ftyp') throw fail_('來源連結回覆的不是圖片，可能是登入或錯誤頁面。', 'EXTERNAL_IMAGE_TYPE', false);
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function (v) {var h = ((v + 256) % 256).toString(16); return h.length < 2 ? '0' + h : h;}).join('');
    return {success: true, mime: mime, bytes: bytes.length, key: digest, data: Utilities.base64Encode(bytes)};
  }
  throw fail_('圖片重新導向次數過多。');
}

function fail_(message, code, retryable) {
  var e = new Error(message);
  e.code = code || 'EXTERNAL_IMAGE';
  e.retryable = retryable !== false;
  return e;
}
