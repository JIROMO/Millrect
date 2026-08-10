"use strict";

// Registers the PWA service worker (app/sw.js). Scope is pinned to /app/ so
// the marketing site (millrect.com/) and docs (millrect.com/docs/) are never
// intercepted — only the app itself.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/app/sw.js", { scope: "/app/" });
  });
}
