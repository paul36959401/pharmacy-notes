/* Settings page: which Google account, sign in, and things waiting to be saved. */
const $ = id => document.getElementById(id);
$('version').textContent = '版本 ' + chrome.runtime.getManifest().version;
async function refresh() {
    const s = await chrome.runtime.sendMessage({type: 'nd-status'});
    const box = $('status');
    box.className = 'status' + (s.email ? '' : ' off');
    box.textContent = (s.email ? '已設定帳號：' + s.email : '還沒有登入。第一次在購物網站按 🛍 時也會請你登入。') +
        (s.waiting ? '\n有 ' + s.waiting + ' 筆還沒存到雲端（會自動補存）。' : '');
    box.style.whiteSpace = 'pre-line';
    $('signin').textContent = s.email ? '重新登入' : '登入 Google';
    $('retry').hidden = !s.waiting;
}
async function signIn(switchAccount) {
    $('status').textContent = '請在跳出的 Google 視窗中選擇帳號…';
    const r = await chrome.runtime.sendMessage({type: 'nd-signin', switchAccount});
    if (!r.ok) alert(r.error || '登入沒有完成。');
    refresh();
}
$('signin').onclick = () => signIn(false);
$('switch').onclick = () => signIn(true);
$('retry').onclick = async () => {await chrome.runtime.sendMessage({type: 'nd-retry'}); refresh();};
refresh();
