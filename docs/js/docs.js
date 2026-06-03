(function () {
  "use strict";

  var TRANSLATED_PAGES = {
    "index.html": true,
    "getting-started.html": true,
    "philosophy.html": true,
    "atlas.html": true,
    "interface.html": true,
    "drawing.html": true,
    "editing.html": true,
    "multiview-3d.html": true,
    "export.html": true,
    "shortcuts.html": true,
    "ai-mcp.html": true,
    "desktop-download.html": true,
    "developer.html": true,
  };

  var PAGE_TITLES_JA = {
    "index.html": "ドキュメント TOP",
    "getting-started.html": "はじめに",
    "philosophy.html": "設計思想",
    "atlas.html": "設計標本帳",
    "interface.html": "画面構成",
    "drawing.html": "2D 描画",
    "editing.html": "編集操作",
    "multiview-3d.html": "3D 生成",
    "export.html": "保存と出力",
    "shortcuts.html": "ショートカット",
    "ai-mcp.html": "AI 連携",
    "desktop-download.html": "デスクトップ版",
    "developer.html": "開発者ガイド",
  };

  var PAGE_TITLES_EN = {
    "index.html": "Documentation home",
    "getting-started.html": "Getting Started",
    "philosophy.html": "Philosophy",
    "atlas.html": "Design Atlas",
    "interface.html": "Interface",
    "drawing.html": "2D Drawing",
    "editing.html": "Editing",
    "multiview-3d.html": "3D Generation",
    "export.html": "Save & Export",
    "shortcuts.html": "Shortcuts",
    "ai-mcp.html": "AI / MCP",
    "desktop-download.html": "Desktop app",
    "developer.html": "Developer guide",
  };

  var STORAGE_KEY = "millrect-docs-lang";
  var FALLBACK_KEY = "millrect-docs-i18n-fallback";

  var page = document.body.dataset.page || "";

  var toggle = document.getElementById("docs-menu-toggle");
  var sidebar = document.getElementById("docs-sidebar");
  if (toggle && sidebar) {
    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("is-open");
    });
    sidebar.addEventListener("click", function (e) {
      if (e.target === sidebar) sidebar.classList.remove("is-open");
    });
  }

  function bindSidebarNavClose() {
    if (!sidebar) return;
    sidebar.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        sidebar.classList.remove("is-open");
      });
    });
  }

  function getDocsContext() {
    var path = window.location.pathname || "";
    var segments = path.split("/").filter(Boolean);
    var enIndex = segments.indexOf("en");

    if (enIndex !== -1) {
      return {
        locale: "en",
        page: segments[enIndex + 1] || "index.html",
        inEnDir: true,
      };
    }

    var filename = segments[segments.length - 1] || "index.html";
    if (filename.indexOf(".html") === -1) filename = "index.html";

    return {
      locale: "ja",
      page: filename,
      inEnDir: false,
    };
  }

  function resolveLocaleUrl(ctx, targetLocale) {
    var pageName = ctx.page;
    var hasTranslation = !!TRANSLATED_PAGES[pageName];
    var isIndex = pageName === "index.html";

    if (targetLocale === ctx.locale) {
      return { href: null, fallback: false };
    }

    if (targetLocale === "en") {
      if (hasTranslation) {
        return {
          href: ctx.inEnDir
            ? isIndex
              ? "./"
              : pageName
            : isIndex
              ? "en/"
              : "en/" + pageName,
          fallback: false,
        };
      }
      return {
        href: ctx.inEnDir ? "./" : "en/",
        fallback: true,
      };
    }

    if (hasTranslation) {
      return {
        href: ctx.inEnDir
          ? isIndex
            ? "../"
            : "../" + pageName
          : isIndex
            ? "./"
            : pageName,
        fallback: false,
      };
    }
    return {
      href: ctx.inEnDir ? "../" : "./",
      fallback: true,
    };
  }

  function rememberLocale(locale) {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (_e) {}
  }

  function rememberFallback(ctx, targetLocale, fallback) {
    if (!fallback) return;
    try {
      sessionStorage.setItem(
        FALLBACK_KEY,
        JSON.stringify({
          page: ctx.page,
          fromLocale: ctx.locale,
          toLocale: targetLocale,
        }),
      );
    } catch (_e) {}
  }

  function pageTitle(pageName, locale) {
    if (locale === "en") return PAGE_TITLES_EN[pageName] || pageName;
    return PAGE_TITLES_JA[pageName] || pageName;
  }

  function mountLangSwitch(ctx) {
    var actions = document.querySelector(".docs-header-actions");
    if (!actions || actions.querySelector(".docs-lang-switch")) return;

    var switcher = document.createElement("div");
    switcher.className = "docs-lang-switch";
    switcher.setAttribute("role", "group");
    switcher.setAttribute(
      "aria-label",
      ctx.locale === "en" ? "Language" : "言語",
    );

    ["ja", "en"].forEach(function (targetLocale) {
      var resolved = resolveLocaleUrl(ctx, targetLocale);
      var isActive = targetLocale === ctx.locale;
      var label = targetLocale === "ja" ? "日本語" : "English";
      var shortLabel = targetLocale === "ja" ? "JA" : "EN";

      if (isActive) {
        var current = document.createElement("span");
        current.className = "docs-lang-switch-btn is-active";
        current.setAttribute("aria-current", "true");
        current.innerHTML =
          '<span class="docs-lang-switch-long">' +
          label +
          '</span><span class="docs-lang-switch-short">' +
          shortLabel +
          "</span>";
        switcher.appendChild(current);
        return;
      }

      var link = document.createElement("a");
      link.className = "docs-lang-switch-btn";
      link.href = resolved.href;
      link.innerHTML =
        '<span class="docs-lang-switch-long">' +
        label +
        '</span><span class="docs-lang-switch-short">' +
        shortLabel +
        "</span>";
      link.addEventListener("click", function () {
        rememberLocale(targetLocale);
        rememberFallback(ctx, targetLocale, resolved.fallback);
      });
      switcher.appendChild(link);
    });

    actions.insertBefore(switcher, actions.firstChild);
  }

  function maybeShowFallbackNotice(ctx) {
    var raw;
    try {
      raw = sessionStorage.getItem(FALLBACK_KEY);
    } catch (_e) {
      return;
    }
    if (!raw) return;

    var data;
    try {
      data = JSON.parse(raw);
    } catch (_e) {
      sessionStorage.removeItem(FALLBACK_KEY);
      return;
    }

    if (!data || data.toLocale !== ctx.locale) return;
    sessionStorage.removeItem(FALLBACK_KEY);

    var host =
      document.querySelector(".docs-content") ||
      document.querySelector(".docs-main") ||
      document.querySelector("main") ||
      document.body;
    if (!host) return;

    var requested = pageTitle(data.page, data.fromLocale);
    var message =
      ctx.locale === "en"
        ? '"' +
          requested +
          '" is not available in English yet. Showing the English documentation home.'
        : "「" +
          requested +
          "」の英語版はまだありません。英語ドキュメント TOP を表示しています。";

    var notice = document.createElement("div");
    notice.className = "docs-i18n-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML =
      "<p>" +
      message +
      '</p><button type="button" class="docs-i18n-notice-dismiss" aria-label="' +
      (ctx.locale === "en" ? "Dismiss" : "閉じる") +
      '">×</button>';

    notice
      .querySelector(".docs-i18n-notice-dismiss")
      .addEventListener("click", function () {
        notice.remove();
      });

    host.insertBefore(notice, host.firstChild);
  }

  function maybeRedirectHomePreference(ctx) {
    if (ctx.page !== "index.html") return;

    var preferred;
    try {
      preferred = localStorage.getItem(STORAGE_KEY);
    } catch (_e) {
      return;
    }
    if (!preferred || preferred === ctx.locale) return;

    var resolved = resolveLocaleUrl(ctx, preferred);
    if (!resolved.href || resolved.fallback) return;

    var targetPath = resolved.href.split("#")[0].split("?")[0];
    var currentPath = window.location.pathname.split("/").pop() || "index.html";
    if (ctx.inEnDir) currentPath = "en/" + currentPath;
    if (targetPath === currentPath) return;

    window.location.replace(resolved.href);
  }

  var ctx = getDocsContext();
  if (typeof mountDocsGuideNav === "function") {
    mountDocsGuideNav(ctx.locale, page);
  }
  bindSidebarNavClose();
  mountLangSwitch(ctx);
  maybeShowFallbackNotice(ctx);
  maybeRedirectHomePreference(ctx);
})();
