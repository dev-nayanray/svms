/*
 * SVMS service worker — deliberately conservative.
 *
 * Security rules:
 *  - Never cache /api/* or /api/auth/* responses (student data must not live
 *    in the cache storage of shared devices).
 *  - Never cache authenticated HTML navigations; navigations are network-first
 *    with an offline fallback page.
 *  - Cache only build-hashed static assets (_next/static), icons, and the
 *    offline page — all safe, non-sensitive resources.
 */
const VERSION = "svms-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never intercept API traffic or auth flows — always hit the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/login")) return;

  // Build-hashed static assets: cache-first (they are immutable per build).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navigations: network-first; offline fallback page when the network fails.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
      )
    );
  }
});
