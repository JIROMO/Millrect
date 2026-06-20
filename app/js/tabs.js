"use strict";

// ════════════════════════════════════════════════════════════
//  プロジェクトタブ（ブラウザ風の複数プロジェクト同時編集）
//
//  方針: グローバルは引き続き単一の _state / history を持つ。アクティブな
//  タブ「1枚だけ」がフル state + undo/redo 履歴をメモリに持ち、非アクティブ
//  タブは IndexedDB へ保存してメモリから解放する（dehydrate / hydrate）。
//  アクティブタブの session は null = 中身はライブグローバル内、という状態で管理する。
//
//  クリップボード(_clipboard, commands.js)はタブ非依存のグローバルなので、
//  タブを跨いだコピー&ペーストは自動的に成立する（切替で消さない）。
// ════════════════════════════════════════════════════════════

let _projectTabs = []; // { tabId, projectId, name, session|null }
let _activeProjectTabId = null;
let _tabSeq = 1;

function _newTabId() {
  return `tab-${Date.now()}-${_tabSeq++}`;
}

function getProjectTabs() {
  return _projectTabs;
}
function getActiveProjectTabId() {
  return _activeProjectTabId;
}

function _findTab(tabId) {
  return _projectTabs.find((x) => x.tabId === tabId) || null;
}

// 切替の多重実行ガード（DB I/O が絡むため）
let _tabSwitching = false;

// ── 切替中ローディング表示 ───────────────────────────────────
// hydrate は DB 読み込みを伴うため、待ち時間が出たときだけスピナーを出す
// （一瞬で終わる切替でチラつかないよう、表示は少し遅延させる）。
let _tabLoadingTimer = null;

function _setTabLoadingVisible(on) {
  let el = document.getElementById("tab-loading");
  if (on) {
    if (!el) {
      el = document.createElement("div");
      el.id = "tab-loading";
      el.innerHTML = '<div class="tab-loading-spinner"></div>';
      (document.getElementById("workspace") || document.body).appendChild(el);
    }
    // reflow を挟んで transition を効かせる
    void el.offsetWidth;
    el.classList.add("visible");
  } else if (el) {
    el.classList.remove("visible");
  }
}

function _beginTabLoading() {
  clearTimeout(_tabLoadingTimer);
  _tabLoadingTimer = setTimeout(() => _setTabLoadingVisible(true), 120);
}

function _endTabLoading() {
  clearTimeout(_tabLoadingTimer);
  _tabLoadingTimer = null;
  _setTabLoadingVisible(false);
}

// ── メモリ方針: アクティブタブ「1枚だけ」がフル state + undo/redo 履歴を
//    メモリに持つ。非アクティブタブは IndexedDB に保存してメモリから解放
//    （dehydrate）し、軽量なメタ情報（projectId / 名前 / 表示位置）だけ残す。
//    タブをクリックしたら DB から読み直す（hydrate）。
//    → タブを何枚開いても常駐メモリはほぼ「アクティブ1枚分」で頭打ち。
//    トレードオフ: タブから離れると undo/redo 履歴はリセットされる（履歴は
//    重すぎるため DB に保存しない）。表示位置(zoom/pan/ページ)は保持する。

// アクティブタブを DB に保存してメモリから解放する。
async function _dehydrateActiveTab() {
  const tab = _findTab(_activeProjectTabId);
  if (!tab) return;
  const st = typeof getState === "function" ? getState() : null;
  if (st && st.projectName) tab.name = st.projectName;
  if (typeof getCurrentProjectId === "function") {
    tab.projectId = getCurrentProjectId();
  }
  // 表示位置だけは軽量なので保持（再 hydrate 時に復元）
  if (st) {
    tab.view = {
      zoom: st.zoom,
      panX: st.panX,
      panY: st.panY,
      currentPageId: st.currentPageId,
      currentLayerId: st.currentLayerId,
    };
  }
  // 保留中の autosave を確定（タイマー解除）してから、確実に DB へ書き出す。
  if (typeof flushAutosave === "function") await flushAutosave();
  if (tab.projectId && typeof doAutosave === "function") {
    try {
      await doAutosave();
    } catch (e) {
      console.warn("[tabs] dehydrate save failed:", e);
    }
  }
  // state/history への参照を捨てる → GC 対象になりメモリ解放
  tab.session = { dehydrated: true };
}

// タブを DB から読み込んでアクティブ化する。
async function _hydrateAndActivate(tabId) {
  const target = _findTab(tabId);
  if (!target) return;
  // グローバルを新しい state オブジェクトへ（旧タブとの参照共有を断つ）
  if (typeof initState === "function") initState();
  if (target.projectId && typeof dbLoadProject === "function") {
    try {
      const row = await dbLoadProject(target.projectId);
      if (
        row &&
        row.data &&
        typeof importProjectFromJsonString === "function"
      ) {
        importProjectFromJsonString(row.data);
      }
    } catch (e) {
      console.warn("[tabs] hydrate load failed:", e);
    }
  }
  _activeProjectTabId = tabId;
  target.session = null; // 中身はライブグローバルへ
  if (typeof setCurrentProjectId === "function") {
    setCurrentProjectId(target.projectId);
  }
  const st = typeof getState === "function" ? getState() : null;
  if (st && st.projectName) target.name = st.projectName;
  // 表示位置の復元（無ければ fitPage）
  let viewRestored = false;
  if (st && target.view) {
    const v = target.view;
    if (v.currentPageId && st.pages?.some((p) => p.id === v.currentPageId)) {
      st.currentPageId = v.currentPageId;
    }
    if (v.currentLayerId) st.currentLayerId = v.currentLayerId;
    if (Number.isFinite(v.zoom)) st.zoom = v.zoom;
    if (Number.isFinite(v.panX)) st.panX = v.panX;
    if (Number.isFinite(v.panY)) st.panY = v.panY;
    viewRestored = true;
  }
  // 表示更新
  if (typeof cancelDim === "function") cancelDim();
  if (typeof markProjectSaved === "function") markProjectSaved();
  else if (typeof setAutosaveStatus === "function") setAutosaveStatus("saved");
  if (!viewRestored && typeof fitPage === "function") fitPage();
  if (typeof render === "function") render();
  if (typeof updateAll === "function") updateAll();
  if (typeof refreshAllTextNativePreviews === "function") {
    refreshAllTextNativePreviews();
  }
  if (typeof hydrateProjectFontsFromState === "function") {
    hydrateProjectFontsFromState();
  }
  renderProjectTabs();
}

// プロジェクトを新しいタブで開く。result は showProjectList() の戻り値、
// あるいは applyOpenedProject() に渡せる形のオブジェクト。
// 既に同じ projectId のタブが開いていればそれにフォーカスする。
async function openProjectInNewTab(result) {
  if (!result) return;
  // 既存タブへのフォーカス（再読み込みしない）
  if (result.projectId) {
    const existing = _projectTabs.find((x) => x.projectId === result.projectId);
    if (existing) {
      await switchToProjectTab(existing.tabId);
      return;
    }
  }
  if (_tabSwitching) return;
  _tabSwitching = true;
  _beginTabLoading();
  try {
    // 現アクティブタブを DB に保存してメモリ解放（初回は無し）
    if (_activeProjectTabId) await _dehydrateActiveTab();
    // グローバルを必ず新しい state オブジェクトへ。
    // （applyOpenedProject の JSON 読み込み経路は既存 _state を「上書き」するため）
    if (typeof initState === "function") initState();
    const tabId = _newTabId();
    const tab = {
      tabId,
      projectId: result.projectId || null,
      name: result.projectName || "…",
      session: null,
      view: null,
    };
    _projectTabs.push(tab);
    _activeProjectTabId = tabId;
    // applyOpenedProject はグローバル（_state/history）を差し替えつつ
    // setCurrentProjectId / render / updateAll まで行う。
    await applyOpenedProject(result);
    if (typeof getCurrentProjectId === "function") {
      tab.projectId = getCurrentProjectId();
    }
    const st = typeof getState === "function" ? getState() : null;
    if (st && st.projectName) tab.name = st.projectName;
    renderProjectTabs();
  } finally {
    _endTabLoading();
    _tabSwitching = false;
  }
}

async function switchToProjectTab(tabId) {
  if (tabId === _activeProjectTabId) return;
  if (_tabSwitching) return;
  _tabSwitching = true;
  _beginTabLoading();
  try {
    await _dehydrateActiveTab();
    _activeProjectTabId = null;
    await _hydrateAndActivate(tabId);
  } finally {
    _endTabLoading();
    _tabSwitching = false;
  }
}

async function closeProjectTab(tabId) {
  const idx = _projectTabs.findIndex((x) => x.tabId === tabId);
  if (idx < 0) return;
  const wasActive = tabId === _activeProjectTabId;

  if (!wasActive) {
    // 非アクティブ（既に dehydrate 済み）→ メタを外すだけ。DB のデータは残す。
    _projectTabs.splice(idx, 1);
    renderProjectTabs();
    return;
  }

  if (_tabSwitching) return;
  _tabSwitching = true;
  _beginTabLoading();
  try {
    // アクティブタブの保留中変更を確定してから閉じる
    if (typeof flushAutosave === "function") await flushAutosave();
    _projectTabs.splice(idx, 1);
    _activeProjectTabId = null;
    if (_projectTabs.length === 0) {
      renderProjectTabs();
      _endTabLoading();
      _tabSwitching = false;
      // 最後の1枚を閉じたらプロジェクト選択モーダルを出す
      await promptNewProjectTab();
      return;
    }
    const next = _projectTabs[Math.min(idx, _projectTabs.length - 1)];
    await _hydrateAndActivate(next.tabId);
  } finally {
    _endTabLoading();
    _tabSwitching = false;
  }
}

// デフォルトの「名称未設定」新規プロジェクト（A4・横・1/1）。モーダルを出さず即作成する。
function newUntitledProjectResult() {
  return {
    projectId: null,
    json: null,
    projectName: typeof t === "function" ? t("default.untitled") : "Untitled",
    paper: "A4",
    orientation: "landscape",
    scale: { numerator: 1, denominator: 1 },
  };
}

// 新規ボタン / 起動時: 名称未設定プロジェクトを新しいタブで直接開く（モーダル無し）
async function openUntitledProjectTab() {
  await openProjectInNewTab(newUntitledProjectResult());
}

// 「開く」/「＋」ボタンから: プロジェクトリストを出して保存済みを選ぶ（新規作成も可）
async function promptNewProjectTab() {
  const result = await showProjectList();
  await openProjectInNewTab(result);
}

// ── タブバー描画 ─────────────────────────────────────────────
function _tabsSignature() {
  const st = typeof getState === "function" ? getState() : null;
  return JSON.stringify({
    locale: typeof getLocale === "function" ? getLocale() : "",
    activeId: _activeProjectTabId,
    tabs: _projectTabs.map((tab) => ({
      id: tab.tabId,
      name: tab.tabId === _activeProjectTabId && st ? st.projectName : tab.name,
    })),
  });
}

let _tabsRenderSig = null;

function renderProjectTabs() {
  const bar = document.getElementById("project-tabs");
  if (!bar) return;
  const sig = _tabsSignature();
  if (sig === _tabsRenderSig && bar.childElementCount) return;
  _tabsRenderSig = sig;

  const esc =
    typeof _escapeHtml === "function" ? _escapeHtml : (s) => String(s ?? "");
  const st = typeof getState === "function" ? getState() : null;
  const untitled = typeof t === "function" ? t("default.untitled") : "Untitled";

  bar.innerHTML = "";
  for (const tab of _projectTabs) {
    const isActive = tab.tabId === _activeProjectTabId;
    const name = (isActive && st ? st.projectName : tab.name) || untitled;
    const el = document.createElement("div");
    el.className = "project-tab" + (isActive ? " active" : "");
    el.dataset.tabId = tab.tabId;
    el.title = name;
    el.innerHTML =
      `<span class="project-tab-name">${esc(name)}</span>` +
      `<button class="project-tab-close" aria-label="${typeof t === "function" ? t("tab.close") : "Close"}">×</button>`;
    el.addEventListener("mousedown", (e) => {
      // 中クリックで閉じる
      if (e.button === 1) {
        e.preventDefault();
        closeProjectTab(tab.tabId);
      }
    });
    el.querySelector(".project-tab-name").addEventListener("click", () => {
      switchToProjectTab(tab.tabId);
    });
    el.querySelector(".project-tab-close").addEventListener("click", (e) => {
      e.stopPropagation();
      closeProjectTab(tab.tabId);
    });
    bar.appendChild(el);
  }

  const add = document.createElement("button");
  add.className = "project-tab-add";
  add.setAttribute(
    "aria-label",
    typeof t === "function" ? t("tab.new") : "New tab",
  );
  add.title = typeof t === "function" ? t("tab.new") : "New tab";
  add.textContent = "+";
  add.addEventListener("click", () => promptNewProjectTab());
  bar.appendChild(add);
}
