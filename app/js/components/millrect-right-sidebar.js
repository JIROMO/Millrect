"use strict";

class MillrectRightSidebar extends HTMLElement {
  connectedCallback() {
    this.id = "sidebar-right";
    this.innerHTML = `
      <div class="panel-resize-handle" id="right-panel-resize"></div>

      <div class="panel-split-top" id="panel-split-top">
        <div class="panel-tabs">
          <button class="panel-tab active" data-tab="design" data-i18n="panel.tab.design">デザイン</button>
          <button class="panel-tab" data-tab="history" data-i18n="panel.tab.history">履歴</button>
        </div>
        <div class="tab-pane active" data-pane="design">
          <div class="tab-pane-scroll">
            <div id="properties-panel" class="panel-props">
              <p class="prop-empty" data-i18n="props.selectShape">図形を選択してください</p>
            </div>
          </div>
        </div>
        <div class="tab-pane" data-pane="history">
          <div class="tab-pane-scroll">
            <div id="history-panel" class="panel-history">
              <p class="prop-empty" data-i18n="props.noHistory">履歴なし</p>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-split-handle" id="panel-split-handle" data-i18n-title="panel.splitHandle.title">
        <span class="panel-split-grip" aria-hidden="true"></span>
      </div>

      <div class="panel-split-bottom" id="panel-split-bottom">
        <div class="panel-tabs">
          <button class="panel-tab active" data-tab="layers" data-i18n="panel.tab.layers">レイヤー</button>
          <button class="panel-tab" data-tab="pages" data-i18n="panel.tab.pages">ページ</button>
        </div>
        <div class="tab-pane active" data-pane="layers">
          <div class="panel-body list-scroll"><div id="layers-list"></div></div>
        </div>
        <div class="tab-pane" data-pane="pages">
          <div class="tab-pane-scroll">
            <div class="panel-collapse" data-section="panel.pages.list">
              <button type="button" class="panel-collapse-trigger" data-default-open="true" aria-expanded="true">
                <svg class="panel-collapse-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="panel-collapse-title" data-i18n="panel.pages.list">ページ一覧</span>
              </button>
              <div class="panel-collapse-body">
                <div class="panel-body list-scroll list-scroll--compact"><div id="pages-list"></div></div>
              </div>
            </div>
            <div class="panel-collapse" data-section="panel.pages.settings">
              <button type="button" class="panel-collapse-trigger" data-default-open="true" aria-expanded="true">
                <svg class="panel-collapse-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="panel-collapse-title" data-i18n="panel.pages.settings">ページ設定</span>
              </button>
              <div class="panel-collapse-body">
              <div id="page-settings" class="panel-fields">
                <div class="settings-row">
                  <label data-i18n="page.current">表示ページ</label>
                  <button class="custom-select" id="page-current" data-value="">
                    <span class="custom-select-label" data-i18n="page.current.empty">ページなし</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover"></div>
                  </button>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.addView">ビュー追加</label>
                  <button class="custom-select" id="page-add-view" data-value="">
                    <span class="custom-select-label" data-i18n="page.addView.placeholder">選択して追加</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover">
                      <div class="custom-select-option" data-value="top" data-i18n="view.add.top">上面図を追加</div>
                      <div class="custom-select-option" data-value="front" data-i18n="view.add.front">正面図を追加</div>
                      <div class="custom-select-option" data-value="right" data-i18n="view.add.right">右側面図を追加</div>
                      <div class="custom-select-option" data-value="left" data-i18n="view.add.left">左側面図を追加</div>
                      <div class="custom-select-option" data-value="back" data-i18n="view.add.back">背面図を追加</div>
                      <div class="custom-select-option" data-value="bottom" data-i18n="view.add.bottom">下面図を追加</div>
                    </div>
                  </button>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.paper">用紙</label>
                  <button class="custom-select" id="page-paper" data-value="A4">
                    <span class="custom-select-label">A4</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover">
                      <div class="custom-select-option selected" data-value="A4">A4</div>
                      <div class="custom-select-option" data-value="A3">A3</div>
                      <div class="custom-select-option" data-value="A2">A2</div>
                      <div class="custom-select-option" data-value="A1">A1</div>
                    </div>
                  </button>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.orientation">向き</label>
                  <button class="custom-select" id="page-orientation" data-value="landscape">
                    <span class="custom-select-label" data-i18n="page.orientation.landscape">横</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover">
                      <div class="custom-select-option" data-value="portrait" data-i18n="page.orientation.portrait">縦</div>
                      <div class="custom-select-option selected" data-value="landscape" data-i18n="page.orientation.landscape">横</div>
                    </div>
                  </button>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.scale">縮尺</label>
                  <button class="custom-select" id="page-scale" data-value="1/10">
                    <span class="custom-select-label">1/10</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover">
                      <div class="custom-select-option" data-value="1/1">1/1</div>
                      <div class="custom-select-option" data-value="1/2">1/2</div>
                      <div class="custom-select-option" data-value="1/5">1/5</div>
                      <div class="custom-select-option selected" data-value="1/10">1/10</div>
                      <div class="custom-select-option" data-value="1/20">1/20</div>
                      <div class="custom-select-option" data-value="1/50">1/50</div>
                      <div class="custom-select-option" data-value="1/100">1/100</div>
                    </div>
                  </button>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.grid">グリッド</label>
                  <button class="custom-select" id="grid-size" data-value="1">
                    <span class="custom-select-label" data-i18n="page.grid.1mm">1 mm</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover">
                      <div class="custom-select-option selected" data-value="1" data-i18n="page.grid.1mm">1 mm</div>
                      <div class="custom-select-option" data-value="5" data-i18n="page.grid.5mm">5 mm</div>
                      <div class="custom-select-option" data-value="10" data-i18n="page.grid.10mm">10 mm</div>
                    </div>
                  </button>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.snap">スナップ</label>
                  <label class="custom-toggle">
                    <input type="checkbox" id="snap-enabled" checked>
                    <span class="custom-toggle-track"></span>
                  </label>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.showGrid">グリッド表示</label>
                  <label class="custom-toggle">
                    <input type="checkbox" id="show-grid" checked>
                    <span class="custom-toggle-track"></span>
                  </label>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.showViewGuides">ビューガイド</label>
                  <label class="custom-toggle">
                    <input type="checkbox" id="show-view-guides" checked>
                    <span class="custom-toggle-track"></span>
                  </label>
                </div>
                <div class="settings-row">
                  <label data-i18n="page.language">言語</label>
                  <button class="custom-select" id="app-locale" data-value="ja">
                    <span class="custom-select-label">日本語</span>
                    <svg class="custom-select-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <div class="custom-select-popover">
                      <div class="custom-select-option selected" data-value="ja" data-i18n="page.language.ja">日本語</div>
                      <div class="custom-select-option" data-value="en" data-i18n="page.language.en">English</div>
                    </div>
                  </button>
                </div>
              </div>
              </div>
            </div>
            <div class="panel-collapse" data-section="panel.pages.referenceImage">
              <button type="button" class="panel-collapse-trigger" data-default-open="false" aria-expanded="false">
                <svg class="panel-collapse-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="panel-collapse-title" data-i18n="panel.pages.referenceImage">参照画像</span>
              </button>
              <div class="panel-collapse-body">
                <div id="reference-image-panel" class="panel-fields">
                  <p class="project-font-hint" data-i18n="refImage.hint">スケッチや写真を背景に置き、スケール校正してトレースできます。</p>
                  <div class="ref-image-load-row">
                    <input type="file" id="ref-image-file" accept="image/png,image/jpeg,image/webp" class="ref-image-file-hidden" tabindex="-1" aria-hidden="true">
                    <button type="button" id="ref-image-load-btn" class="project-font-browse-btn ref-image-load-btn" data-i18n="refImage.chooseImage">画像を読み込む</button>
                  </div>
                  <div class="settings-row ref-image-edit-row" id="ref-image-edit-row" hidden>
                    <button type="button" id="ref-image-edit-btn" class="project-font-browse-btn" data-i18n="refImage.editTransform">位置・サイズを編集</button>
                  </div>
                  <div class="settings-row" id="ref-image-opacity-row" hidden>
                    <label data-i18n="refImage.opacity">不透明度</label>
                    <input type="range" id="ref-image-opacity" min="0.1" max="1" step="0.05" value="0.45">
                  </div>
                  <div class="settings-row ref-image-actions" id="ref-image-actions" hidden>
                    <button type="button" id="ref-image-scale-btn" class="project-font-browse-btn" data-i18n="refImage.scaleCalibrate">スケール校正</button>
                    <button type="button" id="ref-image-clear-btn" class="project-font-add-btn" data-i18n="refImage.clear">クリア</button>
                  </div>
                  <div id="ref-image-scale-panel" class="panel-fields" hidden>
                    <p id="ref-image-scale-status" class="project-font-hint"></p>
                    <div class="settings-row" id="ref-image-length-row" hidden>
                      <label data-i18n="refImage.lengthMm">実長 (mm)</label>
                      <div class="project-font-add-controls">
                        <input type="number" id="ref-image-length-mm" class="pl-text-input" min="0.01" step="0.1" placeholder="120">
                        <button type="button" id="ref-image-scale-apply" class="project-font-add-btn" data-i18n="refImage.apply">適用</button>
                      </div>
                    </div>
                    <button type="button" id="ref-image-scale-cancel" class="project-font-browse-btn" data-i18n="refImage.cancel">キャンセル</button>
                  </div>
                  <div id="ref-image-digitize-panel" class="panel-fields" hidden>
                    <p class="project-font-hint" id="ref-image-digitize-count"></p>
                    <button type="button" id="ref-image-digitize-confirm" class="project-font-browse-btn" data-i18n="refImage.confirmGhost">ゴーストを確定</button>
                    <button type="button" id="ref-image-digitize-clear" class="project-font-add-btn" data-i18n="refImage.clearGhost">ゴーストを削除</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="panel-collapse" data-section="panel.project.fonts">
              <button type="button" class="panel-collapse-trigger" data-default-open="false" aria-expanded="false">
                <svg class="panel-collapse-chevron" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span class="panel-collapse-title" data-i18n="panel.project.fonts">プロジェクトフォント（任意）</span>
              </button>
              <div class="panel-collapse-body">
                <div id="project-fonts-panel" class="panel-fields project-fonts-panel">
                  <p class="project-font-hint" data-i18n="font.hint">Fontsource から検索して登録するか、Google Fonts の CSS URL を直接入力できます。</p>
                  <div class="project-font-browse-row">
                    <button type="button" id="project-font-browse-btn" class="project-font-browse-btn" data-i18n="font.browse">フォントを探す…</button>
                  </div>
                  <div class="settings-row project-font-add-row">
                    <label for="project-font-url" data-i18n="font.googleUrl">Google Fonts URL</label>
                    <div class="project-font-add-controls">
                      <input type="url" id="project-font-url" class="pl-text-input" data-i18n-placeholder="font.googleUrlPlaceholder" placeholder="https://fonts.googleapis.com/css2?family=...">
                      <button type="button" id="project-font-add-btn" class="project-font-add-btn" data-i18n="font.ok">OK</button>
                    </div>
                  </div>
                  <p id="project-font-error" class="project-font-error" hidden></p>
                  <div class="project-font-section">
                    <div class="project-font-section-title" data-i18n="font.thisProject">このプロジェクト</div>
                    <ul id="project-fonts-list" class="project-fonts-list"></ul>
                  </div>
                  <div class="project-font-section">
                    <div class="project-font-section-title" data-i18n="font.library">ライブラリ</div>
                    <ul id="font-library-list" class="project-fonts-list font-library-list"></ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
    if (typeof applyI18nToRoot === "function") applyI18nToRoot(this);
  }
}

customElements.define("millrect-right-sidebar", MillrectRightSidebar);
