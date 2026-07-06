"use strict";

// Design パネルの「配置・位置」「ブール演算」セクション。
// ui.js から分割（updatePropertiesPanel() から呼ばれる）。

const BOOLEAN_ICONS = {
  union:
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="8" height="8" rx="1" fill="currentColor" opacity="0.55"/><rect x="6" y="2" width="8" height="8" rx="1" fill="currentColor"/></svg>',
  subtract:
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="6" width="10" height="8" rx="1" fill="currentColor"/><rect x="6" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 1.5"/></svg>',
  intersect:
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="6" y="4" width="4" height="6" rx="0.5" fill="currentColor"/></svg>',
  exclude:
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="4" height="6" rx="0.5" fill="currentColor"/><rect x="10" y="4" width="4" height="6" rx="0.5" fill="currentColor"/><rect x="6" y="2" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  flatten:
    '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v5M5.5 4.5 8 2l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="9" width="10" height="2" rx="0.5" fill="currentColor"/><rect x="4" y="12" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.55"/></svg>',
};

const BOOLEAN_ACTIONS = [
  {
    op: "union",
    labelKey: "props.boolean.union",
    shortcut: "⌥⇧U",
    fn: () => mergeSelectedShapes(),
  },
  {
    op: "subtract",
    labelKey: "props.boolean.subtract",
    shortcut: "⌥⇧S",
    fn: () => subtractSelectedShapes(),
  },
  {
    op: "intersect",
    labelKey: "props.boolean.intersect",
    shortcut: "⌥⇧I",
    fn: () => intersectSelectedShapes(),
  },
  {
    op: "exclude",
    labelKey: "props.boolean.exclude",
    shortcut: "⌥⇧E",
    fn: () => excludeSelectedShapes(),
  },
  {
    op: "flatten",
    labelKey: "props.boolean.flatten",
    shortcut: "⌥⇧F",
    fn: () => flattenSelectedShapes(),
    minSelection: 1,
  },
];

function buildBooleanMenuHTML(selectedCount) {
  const items = BOOLEAN_ACTIONS.map(
    ({ op, labelKey, shortcut, minSelection = 2 }) => {
      const label = t(labelKey || "props.boolean." + op);
      const disabled = selectedCount < minSelection;
      return `<button type="button" class="boolean-item${
        disabled ? " boolean-item-disabled" : ""
      }" data-boolean="${op}"${
        disabled ? " disabled" : ""
      } title="${label} (${shortcut})">
      <span class="boolean-icon">${BOOLEAN_ICONS[op]}</span>
      <span class="boolean-label">${label}</span>
      <kbd>${shortcut}</kbd>
    </button>`;
    },
  ).join("");
  return panelSectionHTML(
    "panel.design.boolean",
    t("panel.design.boolean"),
    `<div class="prop-boolean-menu">${items}</div>`,
    false,
  );
}

function bindBooleanMenuEvents(container) {
  container.querySelectorAll("[data-boolean]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const action = BOOLEAN_ACTIONS.find((a) => a.op === btn.dataset.boolean);
      if (!action?.fn()) {
        if (typeof showErrorToast === "function") {
          showErrorToast(t("toast.boolean.failed"));
        }
        return;
      }
      render();
      uiUpdate();
    });
  });
}

const BOOLEAN_KEY_MAP = {
  KeyU: { fn: () => mergeSelectedShapes(), minSelection: 2 },
  KeyS: { fn: () => subtractSelectedShapes(), minSelection: 2 },
  KeyI: { fn: () => intersectSelectedShapes(), minSelection: 2 },
  KeyE: { fn: () => excludeSelectedShapes(), minSelection: 2 },
  KeyF: { fn: () => flattenSelectedShapes(), minSelection: 1 },
};

function runBooleanShortcut(code) {
  const action = BOOLEAN_KEY_MAP[code];
  if (!action) return false;
  const count = getState().selectedShapeIds.length;
  if (count < action.minSelection) return false;
  if (!action.fn()) {
    if (typeof showErrorToast === "function") {
      showErrorToast(t("toast.boolean.failed"));
    }
    return false;
  }
  render();
  uiUpdate();
  return true;
}

function _buildTransformSectionBodyHTML() {
  return `<div class="prop-transform-section">
      <div class="prop-transform-inputs">
        <div class="prop-transform-field"><span class="prop-xy-label">X</span><input type="number" id="transform-dx" value="10" step="1"><span class="prop-unit-suffix">mm</span></div>
        <div class="prop-transform-field"><span class="prop-xy-label">Y</span><input type="number" id="transform-dy" value="10" step="1"><span class="prop-unit-suffix">mm</span></div>
      </div>
      <div class="prop-transform-actions">
        <button id="btn-transform-move">${t("props.move")}</button>
        <button id="btn-transform-copy">${t("props.copy")}</button>
      </div>
    </div>`;
}

function buildAlignPositionHTML(ids) {
  const isMulti = ids.length > 1;
  const pageScale = getCurrentPage().scale;
  let bb = null;
  let rotation = 0;
  let shapeType = null;
  if (!isMulti) {
    const res = findShapeById(ids[0]);
    if (res) {
      bb = shapeBBoxMM(res.shape, pageScale);
      rotation = res.shape.rotation || 0;
      shapeType = res.shape.type;
    }
  }

  const alignBtn = (dir, title, svg) =>
    `<button class="align-btn" data-align="${dir}" title="${title}">${svg}</button>`;

  const svgAL = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="6" height="4" rx="1" fill="currentColor"/><rect x="1" y="8" width="9" height="4" rx="1" fill="currentColor"/><line x1="1" y1="1" x2="1" y2="13" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const svgAC = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="3" rx="1" fill="currentColor"/><rect x="4" y="7" width="6" height="3" rx="1" fill="currentColor"/><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const svgAR = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="7" y="2" width="6" height="4" rx="1" fill="currentColor"/><rect x="4" y="8" width="9" height="4" rx="1" fill="currentColor"/><line x1="13" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const svgAT = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="4" height="7" rx="1" fill="currentColor"/><rect x="8" y="2" width="4" height="10" rx="1" fill="currentColor"/><line x1="1" y1="1" x2="13" y2="1" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const svgAM = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="3" width="4" height="8" rx="1" fill="currentColor"/><rect x="8" y="1" width="4" height="12" rx="1" fill="currentColor"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const svgAB = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="4" height="10" rx="1" fill="currentColor"/><rect x="8" y="5" width="4" height="7" rx="1" fill="currentColor"/><line x1="1" y1="13" x2="13" y2="13" stroke="currentColor" stroke-width="1.5"/></svg>`;
  const svgDH = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="0" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="5" y="4" width="4" height="6" rx="1" fill="currentColor"/><rect x="11" y="2" width="3" height="10" rx="1" fill="currentColor"/></svg>`;
  const svgDV = `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="0" width="10" height="3" rx="1" fill="currentColor"/><rect x="4" y="5" width="6" height="4" rx="1" fill="currentColor"/><rect x="2" y="11" width="10" height="3" rx="1" fill="currentColor"/></svg>`;

  const disableDistrib = ids.length < 3 ? " disabled" : "";

  const posSection = bb
    ? `
    <div class="prop-section-title">${t("props.position")}</div>
    <div class="prop-xy-row">
      <div class="prop-xy-field"><span class="prop-xy-label">X</span><input type="number" id="pos-x" value="${fmtNum(bb.x)}" step="0.1"><span class="prop-xy-unit">mm</span></div>
      <div class="prop-xy-field"><span class="prop-xy-label">Y</span><input type="number" id="pos-y" value="${fmtNum(bb.y)}" step="0.1"><span class="prop-xy-unit">mm</span></div>
    </div>`
    : "";

  const rotSection = !isMulti
    ? (() => {
        const rotDisplay = `${rotation}°`;
        return `
    <div class="prop-rotation-block">
      <div class="prop-rotation-label">${t("props.rotation")}</div>
      <div class="prop-rotation-row">
        <div class="prop-rotation-angle">
          <span class="prop-rotation-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3.5 10.5V3.5h7"/>
            </svg>
          </span>
          <span class="prop-rotation-value">
            <input type="text" id="rot-angle" value="${rotDisplay}" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="${t("props.rotationAngle")}">
          </span>
        </div>
        <div class="prop-rotation-actions">
          <button type="button" class="prop-rotation-btn" id="btn-rot-90" title="${t("props.rotate90")}">
            <i data-lucide="rotate-cw-square"></i>
          </button>
          <button type="button" class="prop-rotation-btn" id="btn-flip-h" title="${t("props.flipH")}">
            <i data-lucide="flip-horizontal"></i>
          </button>
          <button type="button" class="prop-rotation-btn" id="btn-flip-v" title="${t("props.flipV")}">
            <i data-lucide="flip-vertical"></i>
          </button>
        </div>
      </div>
    </div>`;
      })()
    : "";

  // Path-edit toggle, placed right under rotation for discoverability.
  const editable =
    shapeType === "bezier" || shapeType === "path" || shapeType === "rect";
  const editActive =
    (shapeType === "bezier" && _bezierEditId === ids[0]) ||
    ((shapeType === "path" || shapeType === "rect") &&
      _vertexEditId === ids[0]);
  const editSection =
    !isMulti && editable
      ? `
    <div class="prop-pathedit-block">
      <button type="button" id="btn-pathedit-toggle" class="prop-pathedit-btn${editActive ? " active" : ""}" data-shape-type="${shapeType}">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M3 13l2-1 7-7-1-1-7 7-1 2Z"/><circle cx="3" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="3.5" r="1.1" fill="currentColor" stroke="none"/></svg>
        <span>${editActive ? t("props.pathEditDone") : t("props.pathEdit")}</span>
      </button>
    </div>`
      : "";

  const body = `
    <div class="prop-align-section">
      <div class="prop-align-grid">
        <div class="prop-align-row">
          ${alignBtn("left", t("props.align.left"), svgAL)}
          ${alignBtn("centerH", t("props.align.centerH"), svgAC)}
          ${alignBtn("right", t("props.align.right"), svgAR)}
          ${alignBtn("top", t("props.align.top"), svgAT)}
          ${alignBtn("centerV", t("props.align.centerV"), svgAM)}
          ${alignBtn("bottom", t("props.align.bottom"), svgAB)}
          <button class="align-btn" data-distrib="h" title="${t("props.distribute.h")}"${disableDistrib}>${svgDH}</button>
          <button class="align-btn" data-distrib="v" title="${t("props.distribute.v")}"${disableDistrib}>${svgDV}</button>
        </div>
      </div>
      ${posSection}
      ${rotSection}
      ${editSection}
    </div>`;

  return panelSectionHTML(
    "panel.design.layout",
    t("panel.design.layout"),
    body,
    true,
  );
}

function bindAlignPositionEvents(c, ids) {
  c.querySelectorAll("[data-align]").forEach((btn) => {
    btn.addEventListener("click", () => {
      alignShapes(btn.dataset.align);
      render();
      uiUpdate();
    });
  });
  c.querySelectorAll("[data-distrib]").forEach((btn) => {
    btn.addEventListener("click", () => {
      distributeShapes(btn.dataset.distrib);
      render();
      uiUpdate();
    });
  });
  const btnPE = c.querySelector("#btn-pathedit-toggle");
  if (btnPE) {
    btnPE.addEventListener("click", () => {
      const id = ids[0];
      const type = btnPE.getAttribute("data-shape-type");
      if (type === "bezier") {
        // Toggle bezier point-edit mode.
        _bezierEditId = _bezierEditId === id ? null : id;
        if (_bezierEditId == null && typeof exitBezierEditMode === "function")
          exitBezierEditMode();
      } else {
        // path / rect → vertex edit (rect converts to an editable path).
        if (_vertexEditId === id) _vertexEditId = null;
        else enterVertexEditMode(id);
      }
      render();
      uiUpdate();
    });
  }
  const posX = c.querySelector("#pos-x");
  const posY = c.querySelector("#pos-y");
  if (posX)
    posX.addEventListener("change", () => {
      const id = ids[0];
      const res = findShapeById(id);
      if (!res) return;
      const pageScale = getCurrentPage().scale;
      const bb = shapeBBoxMM(res.shape, pageScale);
      if (!bb) return;
      const targetMm = parseFloat(posX.value);
      if (isNaN(targetMm)) return;
      shiftShape(res.shape, mmToReal(targetMm - bb.x), 0);
      pushHistory();
      render();
    });
  if (posY)
    posY.addEventListener("change", () => {
      const id = ids[0];
      const res = findShapeById(id);
      if (!res) return;
      const pageScale = getCurrentPage().scale;
      const bb = shapeBBoxMM(res.shape, pageScale);
      if (!bb) return;
      const targetMm = parseFloat(posY.value);
      if (isNaN(targetMm)) return;
      shiftShape(res.shape, 0, mmToReal(targetMm - bb.y));
      pushHistory();
      render();
    });
  const rotAngle = c.querySelector("#rot-angle");
  if (rotAngle) {
    const parseRotInput = (raw) => {
      const n = parseFloat(String(raw).replace(/°/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    };
    const formatRotDisplay = (deg) => `${normalizeRotationDeg(deg)}°`;
    const commitRotInput = () => {
      const next = normalizeRotationDeg(parseRotInput(rotAngle.value));
      rotateShapes(next);
      rotAngle.value = formatRotDisplay(next);
      render();
    };
    rotAngle.addEventListener("focus", () => {
      rotAngle.value = String(parseRotInput(rotAngle.value));
      rotAngle.select();
    });
    rotAngle.addEventListener("change", commitRotInput);
    rotAngle.addEventListener("blur", () => {
      rotAngle.value = formatRotDisplay(parseRotInput(rotAngle.value));
    });
    rotAngle.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitRotInput();
        rotAngle.blur();
        return;
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 10 : 1;
      const delta = e.key === "ArrowUp" ? step : -step;
      const next = normalizeRotationDeg(parseRotInput(rotAngle.value) + delta);
      rotAngle.value = String(next);
      rotateShapes(next);
      render();
    });
    const rotAngleWrap = c.querySelector(".prop-rotation-angle");
    rotAngleWrap?.addEventListener("click", (e) => {
      if (e.target === rotAngle) return;
      rotAngle.focus();
    });
  }
  c.querySelector("#btn-rot-90")?.addEventListener("click", () => {
    rotateShapesBy(90);
    render();
    uiUpdate();
  });
  c.querySelector("#btn-flip-h")?.addEventListener("click", () => {
    flipShapes("h");
    render();
    uiUpdate();
  });
  c.querySelector("#btn-flip-v")?.addEventListener("click", () => {
    flipShapes("v");
    render();
    uiUpdate();
  });
  if (window.lucide) {
    window.lucide.createIcons({ nameAttr: "data-lucide", nodes: [c] });
  }
}
