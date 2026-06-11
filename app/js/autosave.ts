"use strict";

const AUTOSAVE_DELAY = 2000;

let _autosaveTimer = null;
let _lastSavedAt = null;
let _statusEl = null;
let _currentProjectId = null;

function setCurrentProjectId(id) {
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
    const json = exportProjectJsonString();
    await dbSaveProject(_currentProjectId, state.projectName, json);
    _lastSavedAt = Date.now();
    setAutosaveStatus("saved");
  } catch (e) {
    setAutosaveStatus("error");
    console.warn("[autosave] failed:", e);
  }
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

// バンドル時の global 面。script タグ時代のトップレベル宣言による
// グローバル公開と同等の面を明示的に維持する（ADR 0002 フェーズ 3）。
if (typeof window !== "undefined") {
  Object.assign(window, {
    setCurrentProjectId,
    getCurrentProjectId,
    markProjectSaved,
    scheduleAutosave,
    doAutosave,
    setAutosaveStatus,
    initAutosaveCheckbox,
    onStateChanged,
    AUTOSAVE_DELAY,
  });
}
