/* ============================================================
   ToonReel — service worker (PWA offline shell)
   Strategy:
     • App shell (css/js/icons/manifest): cache-first
     • catalog.json: network-first (fresh catalog from admin)
     • Pages: network-first, fall back to cache offline
     • Videos & posters: never cached (streamed fresh)
   Bump CACHE_VERSION to invalidate everything.
   ============================================================ */

const CACHE_VERSION = 'toonreel-v4';
const SHELL = [
  'index.html', 'watch.html', 'download.html',
  'css/style.css',
  'js/data.js', 'js/store.js', 'js/i18n.js', 'js/payments.js', 'js/app.js', 'js/watch.js',
  'manifest.webmanifest',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  /* stream media & posters fresh, never cache */
  if (url.pathname.startsWith('/uploads/') || /\.(mp4|webm|m3u8|ts|jpg|jpeg|png|webp)(\?|$)/.test(url.pathname)) {
    return;
  }

  if (url.pathname.endsWith('catalog.json')) {
    /* network-first so admin publishes show up immediately */
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (e.request.mode === 'navigate') {
    /* pages: network-first with offline cache fallback */
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
    );
    return;
  }

  /* static shell: cache-first */
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
        return res;
      })
    )
  );
});
