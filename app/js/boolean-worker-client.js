"use strict";

let _booleanClipWorker = null;
let _booleanClipRequestId = 0;
const _booleanClipPending = new Map();

function _rejectBooleanWorkerRequests(error) {
  for (const request of _booleanClipPending.values()) request.reject(error);
  _booleanClipPending.clear();
}

function _getBooleanClipWorker() {
  if (_booleanClipWorker) return _booleanClipWorker;
  if (typeof Worker !== "function") return null;
  const worker = new Worker("js/boolean-clip-worker.js");
  worker.onmessage = (event) => {
    const { id, ok, contours, error } = event.data || {};
    const request = _booleanClipPending.get(id);
    if (!request) return;
    _booleanClipPending.delete(id);
    if (ok) request.resolve(contours);
    else {
      const operationError = new Error(error || "Boolean operation failed");
      operationError.booleanOperation = true;
      request.reject(operationError);
    }
  };
  worker.onerror = (event) => {
    const error = new Error(event?.message || "Boolean Worker failed");
    _rejectBooleanWorkerRequests(error);
    worker.terminate();
    if (_booleanClipWorker === worker) _booleanClipWorker = null;
  };
  _booleanClipWorker = worker;
  return worker;
}

function runBooleanClipInWorker(op, polys, options = {}) {
  const worker = _getBooleanClipWorker();
  if (!worker) return Promise.reject(new Error("Boolean Worker unavailable"));
  const id = ++_booleanClipRequestId;
  return new Promise((resolve, reject) => {
    _booleanClipPending.set(id, { resolve, reject });
    try {
      worker.postMessage({ id, op, polys, options });
    } catch (error) {
      _booleanClipPending.delete(id);
      reject(error);
    }
  });
}

// Start and parse polygon-clipping while the UI is idle so the first Boolean
// click does not pay Worker startup cost. Older runtimes defer it with a timer,
// and environments without Worker still keep the synchronous fallback.
function warmBooleanClipWorker() {
  try {
    return Boolean(_getBooleanClipWorker());
  } catch {
    return false;
  }
}
