"use strict";

class Millrect3DPanel extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div id="panel-3d">
        <div class="panel-3d-header">
          <span class="panel-3d-title" data-i18n="panel3d.title">3D PREVIEW</span>
          <div class="panel-3d-actions">
            <button id="btn-3d-reset" data-i18n-title="panel3d.resetCamera">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </button>
            <button id="btn-export-stl" data-i18n-title="panel3d.exportStl">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>STL</span>
            </button>
            <button id="btn-export-3mf" data-i18n-title="panel3d.export3mf">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>3MF</span>
            </button>
            <button id="btn-3d-close" data-i18n-title="panel3d.close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="panel-3d-canvas-wrap">
          <canvas id="canvas-3d"></canvas>
          <div id="panel-3d-warning" class="panel-3d-warning" hidden></div>
          <div id="panel-3d-empty" class="panel-3d-empty" hidden>
            <div class="panel-3d-empty-inner">
              <p class="panel-3d-empty-msg"></p>
            </div>
          </div>
        </div>
      </div>
    `;
    if (typeof applyI18nToRoot === "function") applyI18nToRoot(this);
  }
}

customElements.define("millrect-3d-panel", Millrect3DPanel);
