"use strict";

const _DB_NAME = "millrect";
const _DB_VERSION = 2;
const _STORE = "projects";

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, _DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(_STORE)) {
        db.createObjectStore(_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
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

async function dbLoadProject(id) {
  const db = await _openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(_STORE, "readonly").objectStore(_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
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
  return new Promise((resolve, reject) => {
    const tx = db.transaction(_STORE, "readwrite");
    tx.objectStore(_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

