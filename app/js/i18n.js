"use strict";

(function (g) {
  const STORAGE_KEY = "millrect-locale";
  const DOCS_STORAGE_KEY = "millrect-docs-lang";
  const SUPPORTED = ["ja", "en"];
  const locales = {};

  g.__millrectRegisterLocale = function (code, dict) {
    locales[code] = dict || {};
  };

  function normalizeLocale(code) {
    const c = String(code || "")
      .trim()
      .toLowerCase()
      .split("-")[0];
    return SUPPORTED.includes(c) ? c : "ja";
  }

  function getLocale() {
    try {
      return normalizeLocale(localStorage.getItem(STORAGE_KEY));
    } catch (_e) {
      return "ja";
    }
  }

  function interpolate(text, params) {
    if (!params) return text;
    return String(text).replace(/\{(\w+)\}/g, (_, key) =>
      params[key] !== undefined && params[key] !== null
        ? String(params[key])
        : `{${key}}`,
    );
  }

  const IS_MAC =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");

  // macOS ではショートカット表記を Cmd 記号に変換（Ctrl+P → ⌘P, Ctrl+Shift+G → ⌘⇧G）
  function platformShortcuts(text) {
    if (!IS_MAC || typeof text !== "string") return text;
    return text.replace(/Ctrl\+Shift\+/g, "⌘⇧").replace(/Ctrl\+/g, "⌘");
  }

  function t(key, params) {
    const locale = getLocale();
    const dict = locales[locale] || locales.ja || {};
    const fallback = locales.ja || {};
    const raw = dict[key] ?? fallback[key] ?? key;
    return platformShortcuts(interpolate(raw, params));
  }

  function applyI18nToRoot(root) {
    if (!root || typeof t !== "function") return;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => {
      el.title = t(el.getAttribute("data-i18n-title"));
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    root.querySelectorAll("option[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
  }

  function applyI18nToDocument() {
    applyI18nToRoot(document);
    document.documentElement.lang = getLocale();
  }

  function translateHistoryLabel(label) {
    if (!label || getLocale() === "ja") return label;
    const rules = [
      [/^読み込み$/, "history.loaded"],
      [/^操作$/, "history.action"],
      [/^編集$/, "history.edit"],
      [/^寸法線追加$/, "history.dimAdd"],
      [/^寸法線削除$/, "history.dimDelete"],
      [/^図形追加 \((\d+)個\)$/, "history.shapeAdd"],
      [/^図形削除 \((\d+)個\)$/, "history.shapeDelete"],
    ];
    for (const rule of rules) {
      const m = label.match(rule[0]);
      if (!m) continue;
      if (m.length > 1) {
        return t(rule[1], { count: m[1] });
      }
      return t(rule[1]);
    }
    return label;
  }

  function syncDocsLocale(locale) {
    try {
      localStorage.setItem(DOCS_STORAGE_KEY, locale);
    } catch (_e) {}
  }

  function setLocale(code, options) {
    const next = normalizeLocale(code);
    const prev = getLocale();
    if (next === prev && !options?.force) return prev;

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_e) {}

    syncDocsLocale(next);
    applyI18nToDocument();

    if (typeof updatePageSettingsLabels === "function") {
      updatePageSettingsLabels();
    }
    if (typeof updateAll === "function") {
      updateAll();
    }

    window.dispatchEvent(
      new CustomEvent("millrect-localechange", { detail: { locale: next } }),
    );

    if (window.electronAPI?.setAppLocale) {
      window.electronAPI.setAppLocale(next);
    }

    return next;
  }

  function initMillrectI18n() {
    applyI18nToDocument();
    if (window.electronAPI?.setAppLocale) {
      window.electronAPI.setAppLocale(getLocale());
    }
    window.addEventListener("millrect-localechange", () => {
      applyI18nToDocument();
    });
  }

  g.getLocale = getLocale;
  g.setLocale = setLocale;
  g.t = t;
  g.applyI18nToRoot = applyI18nToRoot;
  g.applyI18nToDocument = applyI18nToDocument;
  g.translateHistoryLabel = translateHistoryLabel;
  g.initMillrectI18n = initMillrectI18n;
})(typeof window !== "undefined" ? window : globalThis);
