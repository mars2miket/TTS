// Bump CACHE when you want to force-refresh all cached files.
var CACHE = 'recallrx-v2';
var FILES = [
  './', 'index.html', 'manifest.json',
  'styles/base.css', 'styles/layout.css', 'styles/components.css',
  'styles/responsive.css', 'styles/fixes.css',
  'js/storage.js', 'js/state.js', 'js/locales/en.js', 'js/locales/vi.js',
  'js/i18n.js', 'js/nav.js', 'js/onboarding.js', 'js/grid.js', 'js/sorting.js',
  'js/duplicates.js', 'js/modal.js', 'js/lists.js', 'js/notes.js', 'js/speech.js',
  'js/exam.js', 'js/analytics.js', 'js/workspace-toggle.js', 'js/main.js',
  'js/qbank.js', 'styles/qbank.css', 'Q_Bank.csv',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Serve from cache, refresh in the background (updates appear on next load)
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // Question bank: network first so new questions arrive, cache as offline fallback
  if (new URL(e.request.url).pathname.slice(-10) === 'Q_Bank.csv') {
    e.respondWith(fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});
