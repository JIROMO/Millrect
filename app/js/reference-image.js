"use strict";

let _scaleAnchorSession = null;
let _scaleAnchorCursor = null;

let _refImageSelected = false;
/** @type {{ action: 'move'|'resize', hi?: number, startRP: {x,y}, orig: {x,y,width,height} } | null} */
let _refImageEdit = null;

const REF_IMAGE_MIN_REAL = 100;

// 下絵は原寸である必要がない（配置サイズは mm 指定で決まる）。取り込み時に長辺を
// 上限へ縮小し JPEG 再エンコードして base64 を小さくする。state・履歴ストア・
// autosave・保存ファイルすべてが軽くなる。失敗時は元の dataUrl をそのまま返す。
function compressImageDataUrl(dataUrl, opts = {}) {
  const maxDim = opts.maxDim ?? 2000;
  const quality = opts.quality ?? 0.82;
  return new Promise((resolve) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        // JPEG は透過を持てない。下絵の透過部は白で潰す（半透明トレース下地として中立）
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        const out = canvas.toDataURL("image/jpeg", quality);
        // 縮小も再圧縮も効かず逆に大きくなったら元を採用
        resolve(out && out.length < dataUrl.length ? out : dataUrl);
      } catch (_e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function _pageById(pageId) {
  const state = getState();
  if (pageId) {
    return state.pages.find((p) => p.id === pageId) || null;
  }
  return getCurrentPage();
}

/**
 * 参照画像をページに設定（real units / data URL）
 */
async function setReferenceImage(pageId, spec) {
  const page = _pageById(pageId);
  if (!page) return { ok: false, error: "Page not found" };

  if (spec.dataUrl) {
    spec = { ...spec, dataUrl: await compressImageDataUrl(spec.dataUrl) };
  }

  const widthMm = spec.widthMm ?? spec.width_mm;
  const heightMm = spec.heightMm ?? spec.height_mm;
  let width = spec.width;
  let height = spec.height;
  let x = spec.x;
  let y = spec.y;

  if (widthMm != null && heightMm != null) {
    width = mmToReal(widthMm);
    height = mmToReal(heightMm);
  }
  if (width == null || height == null) {
    return { ok: false, error: "width/height or widthMm/heightMm required" };
  }

  const paperMm = getPaperDimensions(page);
  const scale = page.scale || { numerator: 1, denominator: 10 };
  if (x == null || y == null) {
    const centered = layoutCenteredRectMm(
      realToMM(width),
      realToMM(height),
      paperMm,
      scale,
    );
    x = centered.x;
    y = centered.y;
  }

  page.referenceImage = {
    dataUrl: spec.dataUrl,
    x,
    y,
    width,
    height,
    opacity: spec.opacity ?? 0.45,
  };

  pushHistory();
  render();
  uiUpdate();
  return {
    ok: true,
    referenceImage: { ...page.referenceImage, dataUrl: "(set)" },
  };
}

function isReferenceImageSelected() {
  return _refImageSelected;
}

function selectReferenceImageForEdit() {
  const page = getCurrentPage();
  if (!page?.referenceImage?.dataUrl) {
    return { ok: false, error: "No reference image" };
  }
  if (_refImageSelected) {
    endReferenceImageTransformEdit();
    return { ok: true, ended: true };
  }
  _refImageSelected = true;
  document.getElementById("ref-image-edit-btn")?.blur();
  if (typeof updateReferenceImagePanel === "function") {
    updateReferenceImagePanel();
  }
  render();
  uiUpdate();
  return { ok: true };
}

function endReferenceImageTransformEdit() {
  deselectReferenceImage();
  render();
  uiUpdate();
}

function deselectReferenceImage() {
  if (!_refImageSelected && !_refImageEdit) return;
  _refImageSelected = false;
  _refImageEdit = null;
  if (typeof updateReferenceImagePanel === "function") {
    updateReferenceImagePanel();
  }
}

/** 図形ツールなどへ切り替えたときに編集モードを終了 */
function onActiveToolChanged(tool) {
  if (tool === "select" || tool === "hand") return;
  if (!_refImageSelected && !_refImageEdit) return;
  deselectReferenceImage();
  render();
}

function isReferenceImageEditActive() {
  return Boolean(_refImageEdit);
}

/** 矩形選択ハンドルと同じ 8 点（paper 座標） */
function _refImageHandleLayout(img, scale, zoom) {
  const x = realToPaper(img.x, scale);
  const y = realToPaper(img.y, scale);
  const w = realToPaperDist(img.width, scale);
  const h = realToPaperDist(img.height, scale);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const hs = 5.5 / (zoom || 1);
  const pts = [
    [0, x, y],
    [1, cx, y],
    [2, x + w, y],
    [3, x + w, cy],
    [4, x + w, y + h],
    [5, cx, y + h],
    [6, x, y + h],
    [7, x, cy],
  ];
  return { x, y, w, h, cx, cy, hs, pts };
}

function hitTestReferenceImage(rp, page, zoom) {
  const img = page?.referenceImage;
  if (!img?.dataUrl) return null;
  const scale = page.scale || { numerator: 1, denominator: 1 };
  const px = realToPaper(rp.x, scale);
  const py = realToPaper(rp.y, scale);
  const { x, y, w, h, hs, pts } = _refImageHandleLayout(img, scale, zoom);
  const slop = hs * 0.85;

  for (const [hi, hx, hy] of pts) {
    if (Math.hypot(px - hx, py - hy) <= slop) {
      return { type: "handle", hi };
    }
  }
  if (px >= x && px <= x + w && py >= y && py <= y + h) {
    return { type: "body" };
  }
  return null;
}

/** ホバー・ドラッグ時カーソル（renderer.js の HANDLE_CURSORS と同じ） */
function getReferenceImageHoverCursor(rp, zoom) {
  if (isReferenceScaleAnchorActive()) return null;
  if (isReferenceImageEditActive() && _refImageEdit) {
    if (_refImageEdit.action === "move") return "move";
    if (
      _refImageEdit.action === "resize" &&
      _refImageEdit.hi != null &&
      typeof HANDLE_CURSORS !== "undefined"
    ) {
      return HANDLE_CURSORS[_refImageEdit.hi] || "crosshair";
    }
  }
  if (!isReferenceImageSelected()) return null;
  const page = getCurrentPage();
  const hit = hitTestReferenceImage(rp, page, zoom);
  if (!hit) return null;
  if (hit.type === "handle" && typeof HANDLE_CURSORS !== "undefined") {
    return HANDLE_CURSORS[hit.hi] || "crosshair";
  }
  if (hit.type === "body") return "move";
  return null;
}

function _clampRefSize(w, h) {
  return {
    width: Math.max(REF_IMAGE_MIN_REAL, w),
    height: Math.max(REF_IMAGE_MIN_REAL, h),
  };
}

function _applyReferenceImageGeometry(page, geom, recordHistory) {
  const img = page.referenceImage;
  if (!img) return;
  img.x = geom.x;
  img.y = geom.y;
  img.width = geom.width;
  img.height = geom.height;
  if (recordHistory) pushHistory();
  render();
  uiUpdate();
}

function handleReferenceImagePointerDown(rp, zoom, tool) {
  if (isReferenceScaleAnchorActive()) return false;
  if (tool !== "select" && tool !== "hand") return false;
  if (!isReferenceImageSelected()) return false;

  const page = getCurrentPage();
  const hit = hitTestReferenceImage(rp, page, zoom);

  if (hit) {
    document.getElementById("ref-image-edit-btn")?.blur();
    const img = page.referenceImage;
    const orig = { x: img.x, y: img.y, width: img.width, height: img.height };
    if (hit.type === "handle") {
      _refImageEdit = {
        action: "resize",
        hi: hit.hi,
        startRP: { x: rp.x, y: rp.y },
        orig,
      };
    } else {
      _refImageEdit = {
        action: "move",
        startRP: { x: rp.x, y: rp.y },
        orig,
      };
    }
    document.body.classList.add("dragging");
    if (typeof updateReferenceImagePanel === "function") {
      updateReferenceImagePanel();
    }
    return true;
  }

  if (_refImageSelected) {
    deselectReferenceImage();
    render();
    uiUpdate();
  }
  return false;
}

/** interaction.js の矩形リサイズと同じ Shift 比率固定 */
function _computeRefBboxAfterResize(o, hi, dx, dy, shiftKey, ratio) {
  let ndx = dx;
  let ndy = dy;
  if (shiftKey) {
    if (hi === 0) {
      ndx = dx;
      ndy = dx / -ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio)) {
        ndy = dy;
        ndx = dy * -ratio;
      }
    }
    if (hi === 2) {
      ndx = dx;
      ndy = -dx / ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio)) {
        ndy = dy;
        ndx = -dy * ratio;
      }
    }
    if (hi === 4) {
      ndx = dx;
      ndy = dx / ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio)) {
        ndy = dy;
        ndx = dy * ratio;
      }
    }
    if (hi === 6) {
      ndx = dx;
      ndy = -dx / ratio;
      if (Math.abs(dy) > Math.abs(dx / ratio)) {
        ndy = dy;
        ndx = -dy * ratio;
      }
    }
    if (hi === 3 || hi === 7) {
      ndy = ndx / ratio;
    }
    if (hi === 1 || hi === 5) {
      ndx = ndy * ratio;
    }
  }
  let x = o.x;
  let y = o.y;
  let width = o.width;
  let height = o.height;
  if (hi === 0) {
    x += ndx;
    y += ndy;
    width -= ndx;
    height -= ndy;
  }
  if (hi === 1) {
    y += ndy;
    height -= ndy;
  }
  if (hi === 2) {
    y += ndy;
    width += ndx;
    height -= ndy;
  }
  if (hi === 3) {
    width += ndx;
  }
  if (hi === 4) {
    width += ndx;
    height += ndy;
  }
  if (hi === 5) {
    height += ndy;
  }
  if (hi === 6) {
    x += ndx;
    width -= ndx;
    height += ndy;
  }
  if (hi === 7) {
    x += ndx;
    width -= ndx;
  }
  return { x, y, width, height };
}

function _clampRefSizeWithAspect(width, height, ratio, lockAspect) {
  if (!lockAspect || !ratio) return _clampRefSize(width, height);
  let w = width;
  let h = height;
  if (w < REF_IMAGE_MIN_REAL) {
    w = REF_IMAGE_MIN_REAL;
    h = w / ratio;
  }
  if (h < REF_IMAGE_MIN_REAL) {
    h = REF_IMAGE_MIN_REAL;
    w = h * ratio;
  }
  return { width: w, height: h };
}

function _resizeReferenceFromHandle(hi, rp, orig, startRP, shiftKey) {
  const dx = rp.x - startRP.x;
  const dy = rp.y - startRP.y;
  const ratio = orig.width / (orig.height || 1);
  let { x, y, width, height } = _computeRefBboxAfterResize(
    orig,
    hi,
    dx,
    dy,
    shiftKey,
    ratio,
  );
  if (shiftKey) {
    const clamped = _clampRefSizeWithAspect(width, height, ratio, true);
    width = clamped.width;
    height = clamped.height;
  } else {
    width = Math.max(REF_IMAGE_MIN_REAL, width);
    height = Math.max(REF_IMAGE_MIN_REAL, height);
  }
  if (width === REF_IMAGE_MIN_REAL && (hi === 0 || hi === 2 || hi === 6)) {
    x = orig.x + orig.width - REF_IMAGE_MIN_REAL;
  }
  if (height === REF_IMAGE_MIN_REAL && (hi === 0 || hi === 1 || hi === 2)) {
    y = orig.y + orig.height - REF_IMAGE_MIN_REAL;
  }
  return { x, y, width, height };
}

function handleReferenceImagePointerMove(rp, shiftKey) {
  if (!_refImageEdit) return false;
  const page = getCurrentPage();
  const img = page?.referenceImage;
  if (!img) return false;

  const { orig, startRP, action, hi } = _refImageEdit;
  if (action === "move") {
    const dx = rp.x - startRP.x;
    const dy = rp.y - startRP.y;
    _applyReferenceImageGeometry(
      page,
      {
        x: orig.x + dx,
        y: orig.y + dy,
        width: orig.width,
        height: orig.height,
      },
      false,
    );
  } else {
    _applyReferenceImageGeometry(
      page,
      _resizeReferenceFromHandle(hi, rp, orig, startRP, shiftKey),
      false,
    );
  }
  return true;
}

function handleReferenceImagePointerUp() {
  if (!_refImageEdit) return false;
  const edit = _refImageEdit;
  const page = getCurrentPage();
  const img = page?.referenceImage;
  let changed = false;
  if (img && edit.orig) {
    changed =
      img.x !== edit.orig.x ||
      img.y !== edit.orig.y ||
      img.width !== edit.orig.width ||
      img.height !== edit.orig.height;
  }
  _refImageEdit = null;
  document.body.classList.remove("dragging");
  if (changed) pushHistory();
  render();
  uiUpdate();
  return true;
}

function clearReferenceImage(pageId) {
  const page = _pageById(pageId);
  if (!page) return { ok: false, error: "Page not found" };
  cancelReferenceScaleAnchor();
  deselectReferenceImage();
  page.referenceImage = null;
  pushHistory();
  render();
  uiUpdate();
  return { ok: true };
}

/** 2 点間を既知 mm 長に合わせて参照画像をスケール */
function setReferenceImageScaleAnchor(pageId, from, to, lengthMm) {
  const page = _pageById(pageId);
  if (!page?.referenceImage) {
    return { ok: false, error: "No reference image on page" };
  }
  const result = applyReferenceScaleAnchor(
    page.referenceImage,
    from,
    to,
    lengthMm,
  );
  if (!result.ok) return result;
  pushHistory();
  render();
  uiUpdate();
  return result;
}

function getReferenceImage(pageId) {
  const page = _pageById(pageId);
  if (!page) return null;
  const img = page.referenceImage;
  if (!img) return null;
  return {
    x: img.x,
    y: img.y,
    width: img.width,
    height: img.height,
    widthMm: realToMM(img.width),
    heightMm: realToMM(img.height),
    opacity: img.opacity,
    hasData: Boolean(img.dataUrl),
  };
}

function isReferenceScaleAnchorActive() {
  return Boolean(_scaleAnchorSession);
}

function getReferenceScaleAnchorState() {
  if (!_scaleAnchorSession) return null;
  let step = "from";
  if (_scaleAnchorSession.from) {
    step = _scaleAnchorSession.to ? "length" : "to";
  }
  return {
    pageId: _scaleAnchorSession.pageId,
    from: _scaleAnchorSession.from,
    to: _scaleAnchorSession.to,
    cursor: _scaleAnchorCursor,
    step,
  };
}

function setReferenceScaleAnchorCursor(pt) {
  if (!_scaleAnchorSession) return;
  _scaleAnchorCursor = pt ? { x: pt.x, y: pt.y } : null;
}

/** 対話式スケール校正を開始 */
function beginReferenceScaleAnchor(pageId) {
  const page = _pageById(pageId);
  if (!page?.referenceImage?.dataUrl) {
    return { ok: false, error: "No reference image on page" };
  }
  deselectReferenceImage();
  _scaleAnchorSession = {
    pageId: page.id,
    from: null,
    to: null,
  };
  _scaleAnchorCursor = null;
  if (typeof updateReferenceImagePanel === "function")
    updateReferenceImagePanel();
  render();
  return { ok: true, step: "from" };
}

/** キャンバス上のクリックをアンカー点として記録。消費したら true */
function handleReferenceScaleAnchorClick(rp) {
  if (!_scaleAnchorSession) return false;
  const page = getCurrentPage();
  if (!page || page.id !== _scaleAnchorSession.pageId) return false;

  const pt = { x: rp.x, y: rp.y };
  if (!_scaleAnchorSession.from) {
    _scaleAnchorSession.from = pt;
  } else if (!_scaleAnchorSession.to) {
    _scaleAnchorSession.to = pt;
  } else {
    return false;
  }

  if (typeof updateReferenceImagePanel === "function")
    updateReferenceImagePanel();
  render();
  return true;
}

/** mm 長を入力してスケール確定 */
function completeReferenceScaleAnchor(lengthMm) {
  if (!_scaleAnchorSession?.from || !_scaleAnchorSession.to) {
    return { ok: false, error: "Two anchor points required" };
  }
  const len = Number(lengthMm);
  if (!Number.isFinite(len) || len <= 0) {
    return { ok: false, error: "Invalid length_mm" };
  }

  const result = setReferenceImageScaleAnchor(
    _scaleAnchorSession.pageId,
    _scaleAnchorSession.from,
    _scaleAnchorSession.to,
    len,
  );

  _scaleAnchorSession = null;
  _scaleAnchorCursor = null;
  if (typeof updateReferenceImagePanel === "function")
    updateReferenceImagePanel();
  return result;
}

function cancelReferenceScaleAnchor() {
  if (!_scaleAnchorSession) return { ok: false };
  _scaleAnchorSession = null;
  _scaleAnchorCursor = null;
  if (typeof updateReferenceImagePanel === "function")
    updateReferenceImagePanel();
  render();
  return { ok: true };
}
