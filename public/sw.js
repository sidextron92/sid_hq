/* eslint-disable no-restricted-globals */
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js"
);

const { registerRoute } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// ── Install & Activate ─────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// ── 1. Cache-First: PocketBase files (background videos/images via proxy) ──
registerRoute(
  ({ url }) => url.pathname.startsWith("/pb/api/files/"),
  new CacheFirst({
    cacheName: "pb-media",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
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

// ── 3. Cache-First: default background video ──
registerRoute(
  ({ url }) => url.pathname === "/background.webm",
  new CacheFirst({
    cacheName: "local-media",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

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
