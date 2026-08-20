"use strict";

class MillrectCanvas extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div id="canvas-container">
        <div id="print-page-wrap">
          <svg id="main-svg"></svg>
          <table id="print-titleblock">
            <tr>
              <th data-i18n="printMode.titleblock.drawing">図名</th>
              <td id="print-tb-drawing"></td>
            </tr>
            <tr>
              <th data-i18n="printMode.titleblock.project">プロジェクト</th>
              <td id="print-tb-project"></td>
            </tr>
            <tr>
              <th data-i18n="printMode.titleblock.scale">尺度</th>
              <td id="print-tb-scale"></td>
            </tr>
            <tr>
              <th data-i18n="printMode.titleblock.date">日付</th>
              <td id="print-tb-date"></td>
            </tr>
          </table>
        </div>
      </div>

      <div id="print-mode-bar" aria-live="polite">
        <span id="print-mode-summary"></span>
        <label id="print-mode-header-footer" data-i18n-title="printMode.titleblock.toggle.title">
          <input type="checkbox" id="print-mode-header-footer-checkbox">
          <span data-i18n="printMode.titleblock.toggle">表題欄</span>
        </label>
        <button id="print-mode-print" type="button" data-i18n-title="printMode.print.title">
          <i data-lucide="printer"></i>
          <span data-i18n="printMode.print">印刷</span>
        </button>
        <button id="print-mode-exit" type="button" data-i18n-title="printMode.exit.title">
          <i data-lucide="x"></i>
          <span data-i18n="printMode.exit">終了</span>
        </button>
      </div>

      <div id="agent-panel" hidden aria-live="polite">
        <div class="agent-panel-header">
          <span data-i18n="agentPanel.title">エージェント接続</span>
          <button id="agent-panel-close" type="button" data-i18n-title="agentPanel.close">
            <i data-lucide="x"></i>
          </button>
        </div>
        <p class="agent-panel-status" id="agent-panel-status" data-state="disconnected"></p>
        <label class="agent-panel-field-label" data-i18n="agentPanel.pairingUrl">接続用URL</label>
        <div class="agent-panel-url-row">
          <input type="text" id="agent-panel-url" readonly>
          <button id="agent-panel-copy" type="button" data-i18n-title="agentPanel.copy">
            <i data-lucide="copy"></i>
          </button>
        </div>
        <div class="agent-panel-actions">
          <button id="agent-panel-toggle" type="button" data-i18n="agentPanel.start">開始</button>
          <button id="agent-panel-new-session" type="button" data-i18n="agentPanel.newSession">新しいセッション</button>
        </div>
      </div>

      <div id="dim-hint"></div>

      <div id="zoom-controls">
        <button id="btn-help" data-i18n-title="help.button.title">?</button>
        <button id="btn-zoom-in" data-i18n-title="help.zoom.in">+</button>
        <button id="btn-zoom-fit" data-i18n-title="help.zoom.fit">⊡</button>
        <button id="btn-zoom-out" data-i18n-title="help.zoom.out">−</button>
      </div>

      <div id="help-popover" hidden>
        <div class="help-popover-header">
          <span data-i18n="help.title">ショートカット</span>
          <button id="btn-help-close" data-i18n-aria="help.close">✕</button>
        </div>
        <div class="help-popover-body">
          <div class="help-section-title" data-i18n="help.section.tools">ツール</div>
          <div class="help-row"><kbd>V</kbd><span data-i18n="help.tool.select">選択</span></div>
          <div class="help-row"><kbd>L</kbd><span data-i18n="help.tool.line">直線</span></div>
          <div class="help-row"><kbd>R</kbd><span data-i18n="help.tool.rect">矩形</span></div>
          <div class="help-row"><kbd>C</kbd><span data-i18n="help.tool.circle">円</span></div>
          <div class="help-row"><kbd>T</kbd><span data-i18n="help.tool.text">テキスト</span></div>
          <div class="help-row"><kbd>D</kbd><span data-i18n="help.tool.dimension">寸法</span></div>
          <div class="help-row"><kbd>M</kbd><span data-i18n="help.tool.measure">計測</span></div>
          <div class="help-row"><kbd>H</kbd><span data-i18n="help.tool.hand">移動</span></div>
          <div class="help-row"><kbd>B</kbd><span data-i18n="help.tool.bezier">ペン</span></div>
          <div class="help-row"><kbd>P</kbd><span data-i18n="help.tool.pencil">鉛筆</span></div>
          <div class="help-section-title" data-i18n="help.section.edit">編集</div>
          <div class="help-row"><kbd data-i18n="help.kbd.undo">Ctrl+Z</kbd><span data-i18n="help.edit.undo">元に戻す</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.redo">Ctrl+Shift+Z</kbd><span data-i18n="help.edit.redo">やり直し</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.copy">Ctrl+C</kbd><span data-i18n="help.edit.copy">コピー</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.paste">Ctrl+V</kbd><span data-i18n="help.edit.paste">貼り付け</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.pasteInPlace">Ctrl+Shift+V</kbd><span data-i18n="help.edit.pasteInPlace">同じ位置に貼り付け</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.duplicate">Ctrl+D</kbd><span data-i18n="help.edit.duplicate">複製</span></div>
          <div class="help-row"><kbd>Del / BS</kbd><span data-i18n="help.edit.delete">削除</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.group">Ctrl+G</kbd><span data-i18n="help.edit.group">グループ化</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.ungroup">Ctrl+Shift+G</kbd><span data-i18n="help.edit.ungroup">グループ解除</span></div>
          <div class="help-row"><kbd>⌥⇧U</kbd><span data-i18n="help.edit.booleanUnion">パス結合</span></div>
          <div class="help-row"><kbd>⌥⇧S</kbd><span data-i18n="help.edit.booleanSubtract">パス減算</span></div>
          <div class="help-row"><kbd>⌥⇧I</kbd><span data-i18n="help.edit.booleanIntersect">パス交差</span></div>
          <div class="help-row"><kbd>⌥⇧E</kbd><span data-i18n="help.edit.booleanExclude">パス除外</span></div>
          <div class="help-row"><kbd>⌥⇧F</kbd><span data-i18n="help.edit.booleanFlatten">パス統合</span></div>
          <div class="help-section-title" data-i18n="help.section.view">表示</div>
          <div class="help-row"><kbd data-i18n="help.kbd.save">Ctrl+S</kbd><span data-i18n="help.view.save">保存</span></div>
          <div class="help-row"><kbd data-i18n="help.kbd.print">Ctrl+P</kbd><span data-i18n="help.view.print">印刷</span></div>
          <div class="help-row"><kbd>Space + ドラッグ</kbd><span data-i18n="help.view.pan">パン</span></div>
          <div class="help-row"><kbd>スクロール</kbd><span data-i18n="help.view.zoom">ズーム</span></div>
          <div class="help-row"><kbd>Esc</kbd><span data-i18n="help.view.cancel">選択解除 / キャンセル</span></div>
        </div>
      </div>

      <div id="status-bar">
        <span>
          <span class="status-label" data-i18n="status.xy">XY</span>
          <span id="status-coords">x: 0.0  y: 0.0 mm</span>
        </span>
        <span>
          <span class="status-label" data-i18n="status.tool">Tool</span>
          <span id="status-tool">SELECT</span>
        </span>
        <span id="status-measure-wrap" hidden>
          <span class="status-label" data-i18n="status.measure">Measure</span>
          <span id="status-measure"></span>
        </span>
        <span>
          <span class="status-label" data-i18n="status.scale">Scale</span>
          <span id="status-scale">1/10</span>
        </span>
        <span id="status-one-mm-mode" hidden data-i18n="status.oneMmMode">1 mm mode</span>
        <span>
          <span class="status-label" data-i18n="status.zoom">Zoom</span>
          <span id="status-zoom">200%</span>
        </span>
        <label id="autosave-label">
          <input type="checkbox" id="autosave-checkbox">
          <span data-i18n="status.autosave">自動保存</span>
        </label>
        <span id="status-autosave" data-state=""></span>
      </div>
    `;
    if (typeof applyI18nToRoot === "function") applyI18nToRoot(this);
  }
}

customElements.define("millrect-canvas", MillrectCanvas);
