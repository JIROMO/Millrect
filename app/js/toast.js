"use strict";

// 共通トースト通知。boolean 演算失敗・フォント取得失敗など、これまで
// console.warn 止まりだった失敗をユーザーに見える形で伝えるための最小実装。
const TOAST_AUTO_DISMISS_MS = 4000;

let _toastRoot = null;

function _ensureToastRoot() {
  if (_toastRoot && document.body.contains(_toastRoot)) return _toastRoot;
  _toastRoot = document.getElementById("toast-root");
  if (!_toastRoot) {
    _toastRoot = document.createElement("div");
    _toastRoot.id = "toast-root";
    document.body.appendChild(_toastRoot);
  }
  return _toastRoot;
}

// type: "error" | "warning" | "info"
function showToast(message, type = "info") {
  if (!message) return;
  const root = _ensureToastRoot();
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-visible"));
  const remove = () => {
    el.classList.remove("toast-visible");
    setTimeout(() => el.remove(), 200);
  };
  el.addEventListener("click", remove);
  setTimeout(remove, TOAST_AUTO_DISMISS_MS);
}

function showErrorToast(message) {
  showToast(message, "error");
}

function showWarningToast(message) {
  showToast(message, "warning");
}
