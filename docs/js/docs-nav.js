(function () {
  "use strict";

  var GUIDE_NAV = {
    ja: {
      ariaLabel: "サイドバー",
      sectionLabel: "ガイド",
      homeLabel: "TOP",
      items: [
        {
          id: "getting-started",
          href: "getting-started.html",
          label: "はじめに",
        },
        { id: "philosophy", href: "philosophy.html", label: "設計思想" },
        { id: "atlas", href: "atlas.html", label: "設計標本帳" },
        {
          id: "desktop-download",
          href: "desktop-download.html",
          label: "ダウンロード",
        },
        { id: "interface", href: "interface.html", label: "画面構成" },
        { id: "drawing", href: "drawing.html", label: "2D 描画" },
        { id: "editing", href: "editing.html", label: "編集操作" },
        { id: "multiview-3d", href: "multiview-3d.html", label: "3D 生成" },
        { id: "export", href: "export.html", label: "保存と出力" },
        { id: "shortcuts", href: "shortcuts.html", label: "ショートカット" },
        { id: "ai-mcp", href: "ai-mcp.html", label: "AI 連携" },
      ],
      devSectionLabel: "開発者向け",
      devItems: [
        { id: "developer", href: "developer.html", label: "開発者ガイド" },
      ],
    },
    en: {
      ariaLabel: "Sidebar",
      sectionLabel: "Guide",
      homeLabel: "TOP",
      items: [
        {
          id: "getting-started",
          href: "getting-started.html",
          label: "Getting Started",
        },
        { id: "philosophy", href: "philosophy.html", label: "Philosophy" },
        { id: "atlas", href: "atlas.html", label: "Design Atlas" },
        {
          id: "desktop-download",
          href: "desktop-download.html",
          label: "Download",
        },
        { id: "interface", href: "interface.html", label: "Interface" },
        { id: "drawing", href: "drawing.html", label: "2D Drawing" },
        { id: "editing", href: "editing.html", label: "Editing" },
        {
          id: "multiview-3d",
          href: "multiview-3d.html",
          label: "3D Generation",
        },
        { id: "export", href: "export.html", label: "Save & Export" },
        { id: "shortcuts", href: "shortcuts.html", label: "Shortcuts" },
        { id: "ai-mcp", href: "ai-mcp.html", label: "AI / MCP" },
      ],
      devSectionLabel: "Developer",
      devItems: [
        { id: "developer", href: "developer.html", label: "Developer guide" },
      ],
    },
  };

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGuideNav(locale, activePage) {
    var config = GUIDE_NAV[locale] || GUIDE_NAV.ja;
    var homeCls = activePage === "home" ? ' class="is-active"' : "";
    var parts = [
      '<nav class="docs-sidebar-nav docs-sidebar-nav-main" aria-label="' +
        escapeHtml(config.ariaLabel) +
        '">',
      '<a href="./" data-nav="home"' +
        homeCls +
        ">" +
        escapeHtml(config.homeLabel) +
        "</a>",
      "<hr>",
      '<div class="docs-sidebar-label">' +
        escapeHtml(config.sectionLabel) +
        "</div>",
    ];

    config.items.forEach(function (item) {
      var cls = item.id === activePage ? ' class="is-active"' : "";
      parts.push(
        '<a href="' +
          item.href +
          '" data-nav="' +
          item.id +
          '"' +
          cls +
          ">" +
          escapeHtml(item.label) +
          "</a>",
      );
    });

    if (config.devItems && config.devItems.length) {
      parts.push("<hr>");
      parts.push(
        '<div class="docs-sidebar-label">' +
          escapeHtml(config.devSectionLabel) +
          "</div>",
      );
      config.devItems.forEach(function (item) {
        var cls = item.id === activePage ? ' class="is-active"' : "";
        parts.push(
          '<a href="' +
            item.href +
            '" data-nav="' +
            item.id +
            '"' +
            cls +
            ">" +
            escapeHtml(item.label) +
            "</a>",
        );
      });
    }

    parts.push("</nav>");
    return parts.join("");
  }

  function mountGuideNav(locale, activePage) {
    var sidebar = document.getElementById("docs-sidebar");
    if (!sidebar) return;

    var existing = sidebar.querySelector(".docs-sidebar-nav-main");
    if (existing) existing.remove();

    sidebar.insertAdjacentHTML(
      "afterbegin",
      renderGuideNav(locale, activePage),
    );
  }

  window.mountDocsGuideNav = mountGuideNav;
})();
