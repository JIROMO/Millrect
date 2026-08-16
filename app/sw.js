"use strict";

// Millrect PWA service worker.
// Scope: /app/ only (this file must stay at app/sw.js).
//
// Strategy:
//   - index.html and docs/*  → network-first (always fetch the latest HTML;
//     the HTML is the only thing that says which hashed asset to load)
//   - hashed assets (js/app.bundle.js?BUILD, css/app.css?BUILD) → cache-first
//     (the query string changes every build, so a stale cache entry is never
//     served under a new URL)
//
// CACHE_VERSION is rewritten by scripts/build-app-js.js on every
// `npm run build:site`, in lockstep with the app.bundle.js / app.css query
// string. Bumping it is what makes activate() drop the previous cache.
const CACHE_VERSION = "202608161806";
const CACHE_NAME = "millrect-" + CACHE_VERSION;

const NETWORK_FIRST_PATHS = [/\/app\/?$/, /\/app\/index\.html$/, /\/docs\//];

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATHS.some((re) => re.test(url.pathname));
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        }),
    ),
  );
});
