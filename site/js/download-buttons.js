(function () {
  "use strict";

  var cfg = window.MILLRECT_DOWNLOAD;
  if (!cfg) return;

  function assetUrl(name) {
    return cfg.assetBaseUrl + encodeURIComponent(name);
  }

  function render(root) {
    var html =
      '<a class="btn btn-primary" href="' +
      cfg.releasesUrl +
      '" rel="noopener noreferrer">GitHub Releases（v' +
      cfg.version +
      "）</a>" +
      '<a class="btn btn-secondary" href="' +
      assetUrl(cfg.assets.macArm64) +
      '">macOS（Apple Silicon）</a>' +
      '<a class="btn btn-secondary" href="' +
      assetUrl(cfg.assets.macX64) +
      '">macOS（Intel）</a>';

    root.innerHTML = html;
  }

  document.querySelectorAll("[data-millrect-download]").forEach(render);
})();
