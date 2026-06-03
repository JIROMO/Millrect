"use strict";

class MillrectToolbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <span class="toolbar-logo">MILLRECT</span>

      <div class="toolbar-group toolbar-mode-switch" role="group" data-i18n-title="toolbar.mode.title">
        <button id="btn-mode-2d" class="toolbar-mode-btn active" data-mode="2d" aria-pressed="true" data-i18n="toolbar.mode.2d">2D</button>
        <button id="btn-mode-3d" class="toolbar-mode-btn" data-mode="3d" aria-pressed="false" data-i18n="toolbar.mode.3d">3D</button>
      </div>

      <div class="toolbar-sep"></div>

      <div class="toolbar-group">
        <button class="toolbar-icon-btn" id="btn-toggle-left" data-i18n-title="toolbar.panelLeft" aria-pressed="true">
          <i data-lucide="panel-left"></i>
        </button>
        <button class="toolbar-icon-btn" id="btn-toggle-right" data-i18n-title="toolbar.panelRight" aria-pressed="true">
          <i data-lucide="panel-right"></i>
        </button>
      </div>

      <div class="toolbar-sep"></div>

      <div class="toolbar-group">
        <button id="btn-new" class="toolbar-icon-btn" data-i18n-title="toolbar.new.title"><i data-lucide="file"></i></button>
        <button id="btn-open" class="toolbar-icon-btn" data-i18n-title="toolbar.open.title"><i data-lucide="folder-open"></i></button>
        <button id="btn-import-svg" class="toolbar-icon-btn" data-i18n-title="toolbar.importSvg.title"><i data-lucide="image-up"></i></button>
        <button id="btn-import-image" class="toolbar-icon-btn" data-i18n-title="toolbar.importImage.title"><i data-lucide="image-plus"></i></button>
        <button id="btn-save" class="toolbar-icon-btn" data-i18n-title="toolbar.save.title"><i data-lucide="save"></i></button>
      </div>

      <div class="toolbar-sep"></div>

      <div class="toolbar-group">
        <button id="btn-export-svg" class="toolbar-icon-btn" data-i18n-title="toolbar.exportSvg.title"><i data-lucide="file-code"></i></button>
        <button id="btn-export-pdf" class="toolbar-icon-btn" data-i18n-title="toolbar.exportPdf.title"><i data-lucide="file-text"></i></button>
        <button id="btn-print-mode" class="toolbar-icon-btn" data-i18n-title="toolbar.print.title" aria-pressed="false"><i data-lucide="printer"></i></button>
        <button id="btn-export-json" class="toolbar-icon-btn" data-i18n-title="toolbar.exportJson.title"><i data-lucide="file-json"></i></button>
      </div>

      <div class="toolbar-sep"></div>

      <div class="toolbar-group">
        <button id="btn-undo" class="toolbar-icon-btn" data-i18n-title="toolbar.undo.title"><i data-lucide="undo-2"></i></button>
        <button id="btn-redo" class="toolbar-icon-btn" data-i18n-title="toolbar.redo.title"><i data-lucide="redo-2"></i></button>
        <button id="btn-help-docs" class="toolbar-icon-btn" data-i18n-title="toolbar.helpDocs.title"><i data-lucide="circle-help"></i></button>
      </div>

      <div class="toolbar-spacer"></div>

      <button class="custom-select toolbar-locale-select" id="toolbar-locale" data-value="ja" data-i18n-title="page.language">
        <i data-lucide="languages"></i>
        <span class="custom-select-label">日本語</span>
        <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="custom-select-popover">
          <div class="custom-select-option selected" data-value="ja" data-i18n="page.language.ja">日本語</div>
          <div class="custom-select-option" data-value="en" data-i18n="page.language.en">English</div>
        </div>
      </button>

      <input type="text" id="project-name" data-i18n-placeholder="toolbar.projectName.placeholder" data-i18n-title="toolbar.projectName" placeholder="Untitled">
    `;
    if (typeof applyI18nToRoot === "function") applyI18nToRoot(this);
  }
}

customElements.define("millrect-toolbar", MillrectToolbar);
