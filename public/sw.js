/* eslint-disable no-restricted-globals */
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js"
);

const { registerRoute } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { RangeRequestsPlugin } = workbox.rangeRequests;

// ── Install & Activate ─────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    // Delete the old local-media cache (previously held background.mp4).
    // We no longer cache that file through the SW — stale entries would
    // cause the video to be served from cache as a full 200 response
    // when the browser expects a 206 range response, breaking playback.
    caches.delete("local-media").then(() => self.clients.claim())
  )
);

// ── 1. Cache-First: PocketBase files (background videos/images via proxy) ──
registerRoute(
  ({ url }) => url.pathname.startsWith("/pb/api/files/"),
  new CacheFirst({
    cacheName: "pb-media",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new RangeRequestsPlugin(),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// ── 2. Cache-First: local audio files (/sounds/*) ──
registerRoute(
  ({ url }) => url.pathname.startsWith("/sounds/"),
  new CacheFirst({
    cacheName: "audio",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ── 3. background.mp4 — pass through to network (no SW caching)
// Browsers stream video via HTTP range requests (206 responses). Caching
// these through a Cache-First strategy requires a full 200 in cache first,
// which never happens when the server only ever returns 206. Let the browser
// talk directly to the network so native range-request streaming works.
// (The login page requires network access anyway to authenticate.)

// ── 4. Cache-First: same-origin SVGs ──
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    request.destination === "image" &&
    url.pathname.endsWith(".svg"),
  new CacheFirst({
    cacheName: "svgs",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ── 5. Stale-While-Revalidate: PocketBase API GET requests (via proxy) ──
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/pb/api/collections/") &&
    url.pathname.includes("/records") &&
    request.method === "GET",
  new StaleWhileRevalidate({
    cacheName: "pb-api",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }),
    ],
  })
);

// Everything else (HTML, auth, mutations) falls through to the network.
