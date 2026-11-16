/* 阿摩圖片代理（給 GitHub Pages 版筆記網站用）
 * 只做一件事：下載「阿摩 yamol.tw」的公開圖片，轉成 base64 回傳給筆記網站。
 * - 只允許 yamol.tw 和它的子網域，其他網址一律拒絕。
 * - 不讀寫你的 Google Drive，也不碰筆記資料。
 * 部署方式：部署 → 新增部署作業 → 網頁應用程式；執行身分「我」；存取權「所有人」。
 */
function doGet(e) {
  var out;
  try {
    out = yamolImage_(e && e.parameter && e.parameter.url);
  } catch (err) {
    out = {success: false, code: err.code || 'EXTERNAL_IMAGE', error: String(err.message || err).slice(0, 300), retryable: err.retryable !== false};
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function yamolUrl_(value) {
  var match = String(value || '').trim().match(/^https?:\/\/([a-z0-9.-]+)(?::(?:80|443))?([/?][^\s#]*)?(?:#[^\s]*)?$/i);
  if (!match || String(value).length > 10000) throw fail_('圖片網址格式不正確。', 'EXTERNAL_IMAGE_URL', false);
  var host = match[1].toLowerCase();
  if (host !== 'yamol.tw' && !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.yamol\.tw$/.test(host)) throw fail_('只支援阿摩（yamol.tw）的公開圖片網址。', 'EXTERNAL_IMAGE_HOST', false);
  return 'https://' + host + (match[2] ? (match[2][0] === '?' ? '/' : '') + match[2] : '/');
}

function yamolImage_(value) {
  var url = yamolUrl_(value);
  for (var attempt = 0; attempt < 5; attempt++) {
    var response = UrlFetchApp.fetch(url, {method: 'get', muteHttpExceptions: true, followRedirects: false,
      headers: {Accept: 'image/avif,image/webp,image/*;q=0.9,*/*;q=0.5', Referer: 'https://yamol.tw/'}});
    var status = response.getResponseCode(), headers = response.getAllHeaders();
    var header = function (name) {
      var key = Object.keys(headers).filter(function (k) {return k.toLowerCase() === name;})[0];
      return String(key ? headers[key] : '');
    };
    if ([301, 302, 303, 307, 308].indexOf(status) >= 0) {
      var next = header('location');
      if (!next) throw fail_('圖片重新導向缺少網址。');
      if (next.indexOf('//') === 0) next = 'https:' + next;
      else if (!/^https?:\/\//i.test(next)) {
        var origin = url.match(/^https:\/\/[^/]+/)[0];
        next = next[0] === '/' ? origin + next : next[0] === '?' ? url.split('?')[0] + next : url.split('?')[0].replace(/[^/]*$/, '') + next;
      }
      url = yamolUrl_(next);
      continue;
    }
    if (status !== 200) throw fail_(status === 401 || status === 403 ? '阿摩限制這張圖片的讀取；圖片連結與筆記仍保留。' : '阿摩圖片暫時無法讀取（HTTP ' + status + '）。', 'EXTERNAL_IMAGE_HTTP', status >= 500 || status === 429);
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
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function (v) {return ((v + 256) % 256).toString(16);}).map(function (h) {return h.length < 2 ? '0' + h : h;}).join('');
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
