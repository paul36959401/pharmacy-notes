/* Service worker: keeps a copy of the site's own files (pages, scripts, styles, icons) on
 * the device so the site opens without internet. Notes themselves are already kept on the
 * device by the app (IndexedDB); Google sign-in and Drive requests are never cached here.
 *  - The page itself: network first (so updates arrive at once), the saved copy when offline.
 *  - Files with ?v=<release>: saved copy first (the version number changes on every release).
 */
const CACHE = 'nd-shell-v2';
const SHELL = ['./', 'manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
        await self.clients.claim();
    })());
});

const scopeUrl = () => new URL('./', self.registration.scope).href;
async function fromNetwork(request, key) {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(key || request, response.clone());
    }
    return response;
}
self.addEventListener('fetch', event => {
    const request = event.request, url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (request.mode === 'navigate') {
        // One saved copy of the notes page serves every ?book= address; 購物紀錄 has its own.
        const key = /\/shopping\.html$/.test(url.pathname) ? new URL('shopping.html', scopeUrl()).href : scopeUrl();
        event.respondWith(fromNetwork(request, key).catch(async () =>
            (await caches.match(key)) || new Response('離線中，且這台裝置還沒有存過這一頁。請連上網路後再開一次。', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}})));
        return;
    }
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached && url.searchParams.has('v')) return cached;
        if (cached) {event.waitUntil(fromNetwork(request).catch(() => {})); return cached;}
        return fromNetwork(request);
    })());
});

/* The page sends the files it loaded before this worker took over (first visit), and the
   current release so copies from older releases can be removed. */
self.addEventListener('message', event => {
    const {type, urls = [], release} = event.data || {};
    if (type !== 'cache-files') return;
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        for (const href of urls) {
            const url = new URL(href, self.registration.scope);
            if (url.origin !== self.location.origin || await cache.match(url.href)) continue;
            try {const response = await fetch(url.href); if (response.ok) await cache.put(url.href, response);} catch (_) {}
        }
        if (release) for (const request of await cache.keys()) {
            const v = new URL(request.url).searchParams.get('v');
            if (v && v !== release) await cache.delete(request);
        }
    })());
});
