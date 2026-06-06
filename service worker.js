/**
 * Tombstone for the legacy ImagiFix service worker.
 *
 * The active service worker was renamed from "service worker.js" to "sw.js".
 * Browsers that still have the OLD worker registered keep serving the OLD
 * (cache-first) app shell forever, which breaks after a refactor. Since the old
 * app re-calls `register("service worker.js")` on every load, the browser
 * re-fetches THIS file (SW scripts bypass the HTTP cache), sees it changed, and
 * installs this version — which wipes every cache, unregisters itself, and
 * reloads open tabs so the fresh app shell (and the new sw.js) take over.
 *
 * This file intentionally does nothing else and is never precached.
 */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
