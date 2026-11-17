/* The only file you may ever need to edit by hand.
 * clientId: the "OAuth 用戶端 ID" from Google Cloud (ends with .apps.googleusercontent.com).
 */
window.NOTE_SITE_CONFIG = {
    clientId: '763409300868-6vuidharbkm839vkag59kft4h1a02c6m.apps.googleusercontent.com',
    // 圖片代理的網址（Apps Script 網頁應用程式，結尾是 /exec），讓阿摩、Google 圖片等能直接拖進筆記。程式碼在 tools/image-proxy.gs。
    imageProxyUrl: 'https://script.google.com/macros/s/AKfycbzLXHpnMfkGNwwSzASxlAYo1NLyAW4k5OJOlAa2GvQ382JZvVi2T7yihutq6xoVW8fSpQ/exec',
    release: '2026-11-18-pages-v17',
    books: [
        {id: 'pharmacology', title: '藥理藥化'},
        {id: 'biopharmaceutics', title: '生物藥劑'},
        {id: 'herbal', title: '生藥＋中藥藥物學'},
        {id: 'pharmaceutics', title: '藥劑'},
        {id: 'analysis', title: '藥分'}
    ]
};
