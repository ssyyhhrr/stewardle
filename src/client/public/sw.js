/**
 * Service worker: makes Stewardle installable and quick to reopen.
 *
 * - Pages: network first, so a deploy shows up at once; the cached copy is
 *   only used offline (the page then explains it can't load the puzzle).
 * - /assets/* (fingerprinted by Vite), fonts, flags, logos, icons: cache
 *   first, since they never change under the same URL (flags/logos rarely).
 * - /api/*: never cached. The puzzle must be today's and guesses must reach
 *   the server.
 *
 * Bump CACHE when the caching rules change; old caches are deleted on activate.
 */
const CACHE = "stewardle-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) ?? (await cache.match("/"));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/healthz") return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
  } else if (/^\/(assets|flags|logos|icons)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
