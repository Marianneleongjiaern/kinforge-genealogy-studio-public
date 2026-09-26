importScripts("./precache.js");
const CACHE = self.KINFORGE_CACHE;
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(self.KINFORGE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("kinforge-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (new URL(request.url).pathname.startsWith("/api/") || /\/(signin-with-chatgpt|signout-with-chatgpt|callback)/.test(new URL(request.url).pathname)) return;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(new URL("./index.html", self.location.href), { ignoreVary: true })));
    return;
  }
  // Same-origin hashed assets are identical regardless of the request Origin header.
  event.respondWith(caches.match(request, { ignoreVary: true }).then(cached => cached || fetch(request)));
});
