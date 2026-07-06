"use strict";

const AUTOSAVE_DELAY = 2000;

let _autosaveTimer = null;
let _lastSavedAt = null;
let _statusEl = null;
let _currentProjectId = null;
// pageId → 直近保存済み dataUrl。変化が無ければ JSON.stringify から除外する
// （参照画像は数MBの base64 になりうり、毎回の直列化コストが無視できないため）。
let _refImageCache = new Map();

function setCurrentProjectId(id) {
  if (id !== _currentProjectId) _refImageCache = new Map();
  _currentProjectId = id;
}

function getCurrentProjectId() {
  return _currentProjectId;
}

function markProjectSaved(at) {
  _lastSavedAt = at ?? Date.now();
  setAutosaveStatus("saved");
}

function scheduleAutosave() {
  if (!_currentProjectId) return;
  clearTimeout(_autosaveTimer);
  setAutosaveStatus("unsaved");
  _autosaveTimer = setTimeout(doAutosave, AUTOSAVE_DELAY);
}

async function doAutosave() {
  if (!_currentProjectId) return;
  try {
    const state = getState();
    const data =
      typeof _projectDataFromState === "function"
        ? _projectDataFromState(state)
        : null;
    if (data) await _persistReferenceImages(data);
    const json = data
      ? JSON.stringify(data, null, 2)
      : exportProjectJsonString();
    await dbSaveProject(_currentProjectId, state.projectName, json);
    _lastSavedAt = Date.now();
    setAutosaveStatus("saved");
  } catch (e) {
    setAutosaveStatus("error");
    console.warn("[autosave] failed:", e);
  }
}

// 未変更の参照画像はプレースホルダに差し替えて別ストアへ逃がす（db.js 参照）。
// 変更された（or 初回の）参照画像だけを実際に書き込む。
async function _persistReferenceImages(data) {
  for (const page of data.pages || []) {
    const ref = page.referenceImage;
    if (!ref?.dataUrl) continue;
    if (_refImageCache.get(page.id) === ref.dataUrl) {
      const placeholder = { ...ref, __refImagePlaceholder: true };
      delete placeholder.dataUrl;
      page.referenceImage = placeholder;
    } else {
      await dbSaveReferenceImage(_currentProjectId, page.id, ref.dataUrl);
      _refImageCache.set(page.id, ref.dataUrl);
    }
  }
}

// 保留中の autosave があれば即座に書き出す（タブ切替・クローズ前に呼ぶ）。
// dirty でない（タイマー無し）場合は何もしない＝空プロジェクトを勝手に保存しない。
async function flushAutosave() {
  if (!_autosaveTimer) return;
  clearTimeout(_autosaveTimer);
  _autosaveTimer = null;
  await doAutosave();
}

function setAutosaveStatus(state) {
  if (!_statusEl) _statusEl = document.getElementById("status-autosave");
  if (!_statusEl) return;
  if (state === "saved") {
    const timeStr = new Date(_lastSavedAt).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
    _statusEl.textContent = t("status.autosave.saved", { time: timeStr });
    _statusEl.dataset.state = "saved";
  } else if (state === "unsaved") {
    _statusEl.textContent = t("status.autosave.unsaved");
    _statusEl.dataset.state = "unsaved";
  } else if (state === "error") {
    _statusEl.textContent = t("status.autosave.error");
    _statusEl.dataset.state = "error";
  } else {
    _statusEl.textContent = "";
    _statusEl.dataset.state = "";
  }
}

function initAutosaveCheckbox() {
  // autosave は常時有効（チェックボックス不要）
  const el = document.getElementById("autosave-checkbox");
  if (el) el.closest("label")?.remove();
}

function onStateChanged() {
  scheduleAutosave();
}
