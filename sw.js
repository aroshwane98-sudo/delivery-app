/* =========================================================
 *  Service Worker — PWA
 *  فایلەکانی سیستەم کاش دەکات؛ داتای Supabase هەمیشە ڕاستەوخۆ لە ڕایەڵەوە.
 * ========================================================= */

const CACHE_NAME = 'dlv-cache-v1.4.0';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './xlsx.full.min.js',
  './config.js',
  './api.js',
  './store.js',
  './ui.js',
  './view-driver.js',
  './view-reports.js',
  './view-admin.js',
  './view-settings.js',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // داتای Supabase و داواکارییە non-GET: هەمیشە ڕایەڵە
  if (event.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;

  // پەڕەی سەرەکی: ڕایەڵە پێشەوە، کاش لە کاتی ئۆفلاین
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // فایلە جێگیرەکان: ڕایەڵە پێشەوە بۆ دڵنیابوون لە نوێبوونەوە، کاش لە کاتی ئۆفلاین
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
