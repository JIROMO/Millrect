"use strict";

const _DB_NAME = "millrect";
const _DB_VERSION = 3;
const _STORE = "projects";
// 参照画像(base64 dataUrl)を projects レコードから分離して保持するストア。
// autosave のたびに毎回 JSON.stringify するコストを避けるため（onStateChanged 参照）。
const _REFIMG_STORE = "refImages";
const _REFIMG_PLACEHOLDER_KEY = "__refImagePlaceholder";

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, _DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_STORE)) {
        db.createObjectStore(_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(_REFIMG_STORE)) {
        db.createObjectStore(_REFIMG_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function _refImageKey(projectId, pageId) {
  return `${projectId}:${pageId}`;
}

async function dbSaveReferenceImage(projectId, pageId, dataUrl) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_REFIMG_STORE, "readwrite");
    tx.objectStore(_REFIMG_STORE).put({
      key: _refImageKey(projectId, pageId),
      dataUrl,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbLoadReferenceImage(projectId, pageId) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(_REFIMG_STORE, "readonly")
      .objectStore(_REFIMG_STORE)
      .get(_refImageKey(projectId, pageId));
    req.onsuccess = () => resolve(req.result?.dataUrl ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function dbDeleteReferenceImagesForProject(projectId) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_REFIMG_STORE, "readwrite");
    const store = tx.objectStore(_REFIMG_STORE);
    const prefix = `${projectId}:`;
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) return;
      if (String(cursor.value.key).startsWith(prefix)) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbSaveProject(id, name, data, thumbnail = "") {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_STORE, "readwrite");
    tx.objectStore(_STORE).put({
      id,
      name,
      data,
      thumbnail,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// autosave 時に _REFIMG_PLACEHOLDER_KEY で除外された参照画像を、別ストアから復元して差し戻す。
// プレースホルダが無いプロジェクト（大半）は JSON.parse すら行わず素通しする。
async function _rehydrateReferenceImages(projectId, jsonStr) {
  if (
    typeof jsonStr !== "string" ||
    !jsonStr.includes(_REFIMG_PLACEHOLDER_KEY)
  ) {
    return jsonStr;
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return jsonStr;
  }
  for (const page of parsed.pages || []) {
    if (!page.referenceImage?.[_REFIMG_PLACEHOLDER_KEY]) continue;
    const dataUrl = await dbLoadReferenceImage(projectId, page.id);
    if (dataUrl) {
      const ref = { ...page.referenceImage, dataUrl };
      delete ref[_REFIMG_PLACEHOLDER_KEY];
      page.referenceImage = ref;
    } else {
      page.referenceImage = null;
    }
  }
  return JSON.stringify(parsed);
}

async function dbLoadProject(id) {
  const db = await _openDB();
  const row = await new Promise((resolve, reject) => {
    const req = db.transaction(_STORE, "readonly").objectStore(_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  if (row?.data) row.data = await _rehydrateReferenceImages(id, row.data);
  return row;
}

async function dbListProjects() {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_STORE, "readonly").objectStore(_STORE).getAll();
    req.onsuccess = () => {
      resolve(req.result.sort((a, b) => b.updatedAt - a.updatedAt));
    };
    req.onerror = () => reject(req.error);
  });
}

async function dbDeleteProject(id) {
  const db = await _openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(_STORE, "readwrite");
    tx.objectStore(_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await dbDeleteReferenceImagesForProject(id);
}
