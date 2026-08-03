"use strict";

// The same Google tag used by the marketing and documentation sites.
// app/index.html is also bundled into Electron, so only enable analytics on the
// production web origins and never while running the desktop app or locally.
(function initializeGoogleTag() {
  const measurementId = "G-0JMRZXG11T";
  const productionHosts = new Set(["millrect.com", "www.millrect.com"]);

  if (
    window.location.protocol !== "https:" ||
    !productionHosts.has(window.location.hostname)
  ) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
})();
