(function () {
  "use strict";

  var LANDING_KEY = "millrect-landing-lang";
  var DOCS_KEY = "millrect-docs-lang";

  function getCurrentLocale() {
    var path = window.location.pathname || "/";
    return /\/en(\/|$)/.test(path) ? "en" : "ja";
  }

  function localePath(locale) {
    return locale === "en" ? "/en/" : "/";
  }

  function rememberLocale(locale) {
    if (locale !== "ja" && locale !== "en") return;
    try {
      localStorage.setItem(LANDING_KEY, locale);
      localStorage.setItem(DOCS_KEY, locale);
    } catch (_e) {}
  }

  function readStoredLocale() {
    try {
      var landing = localStorage.getItem(LANDING_KEY);
      if (landing === "ja" || landing === "en") return landing;
      var docs = localStorage.getItem(DOCS_KEY);
      if (docs === "ja" || docs === "en") return docs;
    } catch (_e) {}
    return null;
  }

  function detectBrowserLocale() {
    var langs =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || "ja"];
    for (var i = 0; i < langs.length; i++) {
      var code = String(langs[i]).toLowerCase().split("-")[0];
      if (code === "ja") return "ja";
      if (code === "en") return "en";
    }
    return "en";
  }

  function preferredLocale() {
    return readStoredLocale() || detectBrowserLocale();
  }

  function maybeAutoRedirect() {
    var current = getCurrentLocale();
    var preferred = preferredLocale();
    if (preferred === current) return;

    var target = localePath(preferred);
    if (window.location.pathname === target) return;
    window.location.replace(target);
  }

  function wireLangSwitch() {
    document
      .querySelectorAll(".lang-switch a[hreflang]")
      .forEach(function (link) {
        link.addEventListener("click", function () {
          var lang = link.getAttribute("hreflang");
          rememberLocale(lang);
        });
      });
  }

  maybeAutoRedirect();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireLangSwitch);
  } else {
    wireLangSwitch();
  }
})();
