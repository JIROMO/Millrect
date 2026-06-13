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
