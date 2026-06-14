"use strict";

class MillrectLeftSidebar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div id="tools-float">
        <div id="tools-drag-handle" data-i18n-title="tools.dragHandle.title">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
            <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
            <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
          </svg>
        </div>
        <div id="tool-panel">
          <button class="tool-btn active" data-tool="select" data-i18n-title="tools.select.title">
            <span class="tool-icon"><i data-lucide="mouse-pointer-2"></i></span>
          </button>
          <button class="tool-btn" data-tool="hand" data-i18n-title="tools.hand.title">
            <span class="tool-icon"><i data-lucide="hand"></i></span>
          </button>
          <button class="tool-btn" data-tool="rect" data-i18n-title="tools.rect.title">
            <span class="tool-icon"><i data-lucide="square"></i></span>
          </button>
          <button class="tool-btn" data-tool="circle" data-i18n-title="tools.circle.title">
            <span class="tool-icon"><i data-lucide="circle"></i></span>
          </button>
          <button class="tool-btn" data-tool="line" data-i18n-title="tools.line.title">
            <span class="tool-icon"><i data-lucide="pencil-line"></i></span>
          </button>
          <button class="tool-btn" data-tool="bezier" data-i18n-title="tools.bezier.title">
            <span class="tool-icon"><i data-lucide="pen-tool"></i></span>
          </button>
          <button class="tool-btn" data-tool="pencil" data-i18n-title="tools.pencil.title">
            <span class="tool-icon"><i data-lucide="pencil"></i></span>
          </button>
          <button class="tool-btn" data-tool="text" data-i18n-title="tools.text.title">
            <span class="tool-icon"><i data-lucide="type"></i></span>
          </button>
          <button class="tool-btn" data-tool="dimension" data-i18n-title="tools.dimension.title">
            <span class="tool-icon"><i data-lucide="ruler"></i></span>
          </button>
        </div>
      </div>
    `;
    if (typeof applyI18nToRoot === "function") applyI18nToRoot(this);
  }
}

customElements.define("millrect-left-sidebar", MillrectLeftSidebar);
