/**
 * ImagiFix service worker.
 *
 * Strategy:
 *  - Precache the full app shell on install (HTML, CSS, every JS module,
 *    icons, manifest) so the editor works fully offline.
 *  - Code (JS/CSS) is network-first: a stale module is worse than a slow one,
 *    and stale-while-revalidate served the *previous* build on every reload.
 *    Falls back to cache when offline, which is the whole point of the PWA.
 *  - Everything else is stale-while-revalidate: serve from cache instantly,
 *    refresh the cache in the background.
 *  - Navigation requests fall back to the cached index.html when offline.
 *  - Old caches are pruned on activate; skipWaiting + clients.claim make a
 *    new version take over promptly.
 *
 * Bump CACHE_NAME to ship a new shell.
 */
const CACHE_NAME = 'imagifix-v12';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  // styles
  './css/main.css',
  './css/base/tokens.css',
  './css/base/reset.css',
  './css/base/typography.css',
  './css/layout/header.css',
  './css/layout/editor.css',
  './css/layout/sidebar.css',
  './css/layout/toolbar.css',
  './css/layout/canvas.css',
  './css/components/buttons.css',
  './css/components/range.css',
  './css/components/text-overlay.css',
  './css/components/empty-state.css',
  './css/components/install-popup.css',
  './css/components/toast.css',
  './css/components/tooltip.css',
  './css/components/canvas-bar.css',
  './css/components/save-panel.css',
  // scripts
  './js/main.js',
  './js/config/constants.js',
  './js/core/store.js',
  './js/core/eventBus.js',
  './js/core/state.js',
  './js/canvas/renderer.js',
  './js/canvas/filters.js',
  './js/canvas/geometry.js',
  './js/features/imageIO.js',
  './js/features/transform.js',
  './js/features/filtersPanel.js',
  './js/features/text.js',
  './js/features/crop.js',
  './js/features/history.js',
  './js/features/guards.js',
  './js/features/dropzone.js',
  './js/ui/dom.js',
  './js/ui/controls.js',
  './js/ui/panels.js',
  './js/ui/range.js',
  './js/ui/shortcuts.js',
  './js/ui/toast.js',
  './js/pwa/pwa.js',
  './js/utils/helpers.js',
  './assets/icons.js',
  './assets/images/placeholder.png',
  './assets/images/logo-icon.png',
  './assets/images/logo-192.png',
  './assets/images/logo-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GETs; let everything else hit the network.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navigations: network-first with an offline fallback to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html')),
    );
    return;
  }

  // App code: network-first, so a reload always runs the current build.
  if (/\.(?:js|css)$/.test(new URL(request.url).pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
