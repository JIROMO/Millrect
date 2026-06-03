(function () {
  "use strict";

  var SPECIMENS = [
    {
      id: "module_joint_1",
      image: "module-joint-1-millrect.png",
      image2: "3d-panel.png",
      labels: {
        ja: {
          title: "Module Joint 1",
          badge: "REAL PRODUCT",
          summary:
            "24×100 mm、板厚 2 mm の実プロダクト由来ジョイントプレート。Ø6 穴、R2、10 mm ピッチ、切り込み線を持つ標準作例。",
          alt: "Millrect で作図した Module Joint 1",
          alt2: "Module Joint 1 の3Dプレビュー",
          capabilities: ["実プロダクト", "寸法線", "穴ピッチ", "STL"],
          routes: [
            ["UIで作る", "multiview-3d.html#workflow"],
            ["AI/MCPで作る", "ai-mcp.html#part-dsl-workflow"],
            ["STLへ出す", "export.html#stl"],
          ],
        },
        en: {
          title: "Module Joint 1",
          badge: "REAL PRODUCT",
          summary:
            "A real-product 24×100 mm joint plate with 2 mm thickness, Ø6 holes, R2 radii, 10 mm pitch, and cut-in lines.",
          alt: "Module Joint 1 drawn in Millrect",
          alt2: "3D preview of Module Joint 1",
          capabilities: ["Real product", "Dimensions", "Hole pitch", "STL"],
          routes: [
            ["Build in UI", "multiview-3d.html#workflow"],
            ["Build with AI/MCP", "ai-mcp.html#part-dsl-workflow"],
            ["Export STL", "export.html#stl"],
          ],
        },
      },
    },
    {
      id: "sketch_trace_plate",
      image: "sketch-digitize.png",
      image2: "reference-image-panel.png",
      labels: {
        ja: {
          title: "スケッチ取り込み",
          badge: "IMAGE → DRAWING",
          summary:
            "参照画像を下絵に置き、実寸が分かる線でスケール校正。AI 提案はゴーストとして確認してから確定する。",
          alt: "スケッチ取り込みのゴースト図形",
          alt2: "参照画像パネル",
          capabilities: ["参照画像", "スケール校正", "ゴースト確認", "AI補助"],
          routes: [
            ["下絵を置く", "drawing.html#sketch-import"],
            ["AIで拾う", "ai-mcp.html#sketch-digitize"],
            ["パネルを見る", "interface.html#reference-image-panel"],
          ],
        },
        en: {
          title: "Sketch import",
          badge: "IMAGE → DRAWING",
          summary:
            "Place a reference image, calibrate scale from a known length, and review AI ghost proposals before committing them.",
          alt: "Sketch digitize ghost shapes",
          alt2: "Reference image panel",
          capabilities: [
            "Reference image",
            "Scale calibration",
            "Ghost review",
            "AI assist",
          ],
          routes: [
            ["Place underlay", "drawing.html#sketch-import"],
            ["Digitize with AI", "ai-mcp.html#sketch-digitize"],
            ["Panel details", "interface.html#reference-image-panel"],
          ],
        },
      },
    },
    {
      id: "annotation_plate",
      image: "drawing-text.png",
      image2: "design-panel-text.png",
      labels: {
        ja: {
          title: "注記入り図面",
          badge: "DRAWING DETAIL",
          summary:
            "図面上にテキスト注記を置き、フォント、太さ、折り返し幅を調整。アウトライン化すれば 3D 輪郭にも使える。",
          alt: "テキスト注記を含む図面",
          alt2: "テキストのデザインパネル",
          capabilities: ["注記", "Google Fonts", "折り返し", "アウトライン化"],
          routes: [
            ["テキストを置く", "drawing.html#text"],
            ["フォントを登録", "drawing.html#project-fonts"],
            ["アウトライン化", "drawing.html#text-outline"],
          ],
        },
        en: {
          title: "Annotated drawing",
          badge: "DRAWING DETAIL",
          summary:
            "Add text notes, tune font, weight, and wrap width. Outline text when it should become usable 3D geometry.",
          alt: "Drawing with text notes",
          alt2: "Text design panel",
          capabilities: ["Notes", "Google Fonts", "Wrapping", "Text outline"],
          routes: [
            ["Add text", "drawing.html#text"],
            ["Register fonts", "drawing.html#project-fonts"],
            ["Outline text", "drawing.html#text-outline"],
          ],
        },
      },
    },
    {
      id: "workspace_orientation",
      image: "main-window.png",
      image2: "pages-multiview.png",
      labels: {
        ja: {
          title: "作図ワークスペース",
          badge: "UI MAP",
          summary:
            "ツール、キャンバス、ページ、レイヤー、3D プレビューの関係を把握するための UI 標本。機能説明の起点として使う。",
          alt: "Millrect のメイン画面",
          alt2: "ページ追加と多ビュー設定のページパネル",
          capabilities: ["ツール", "ページ", "レイヤー", "3Dプレビュー"],
          routes: [
            ["画面構成", "interface.html"],
            ["ページとレイヤー", "drawing.html#layers"],
            ["ページ追加", "multiview-3d.html#view-type"],
          ],
        },
        en: {
          title: "Drawing workspace",
          badge: "UI MAP",
          summary:
            "A UI specimen for understanding tools, canvas, pages, layers, and 3D preview before diving into feature pages.",
          alt: "Millrect main window",
          alt2: "Pages panel with add-page and multiview settings",
          capabilities: ["Tools", "Pages", "Layers", "3D preview"],
          routes: [
            ["Interface", "interface.html"],
            ["Pages and layers", "drawing.html#layers"],
            ["Add pages", "multiview-3d.html#view-type"],
          ],
        },
      },
    },
  ];

  var UI = {
    ja: {
      scenario: "scenario",
      capabilities: "できること",
      routes: "入口",
      controls: "ドラッグ調整",
      dragHint:
        "図面上のダイヤ型ハンドルをドラッグすると、寸法と DSL が同時に変わります。穴配置は 2×2 で固定です。",
      drawing: "2D 図面",
      solid: "寸法アイソメ図",
      dsl: "Part DSL",
      width: "幅 W",
      depth: "奥行き D",
      height: "高さ H",
      holeDia: "穴径",
      fixedHoles: "穴配置",
      fixedHolesValue: "2×2 固定",
      dragWidth: "幅 W をドラッグ",
      dragDepth: "奥行き D をドラッグ",
      dragHeight: "高さ H をドラッグ",
      dragHoleDia: "穴径をドラッグ",
      mm: "mm",
      pitch: "ピッチ",
      through: "貫通穴",
    },
    en: {
      scenario: "scenario",
      capabilities: "Capabilities",
      routes: "Routes",
      controls: "Drag controls",
      dragHint:
        "Drag the diamond handles on the drawings to update dimensions and DSL together. The hole layout stays fixed at 2×2.",
      drawing: "2D drawing",
      solid: "Dimensioned isometric",
      dsl: "Part DSL",
      width: "Width W",
      depth: "Depth D",
      height: "Height H",
      holeDia: "Hole dia.",
      fixedHoles: "Hole layout",
      fixedHolesValue: "2×2 fixed",
      dragWidth: "Drag width W",
      dragDepth: "Drag depth D",
      dragHeight: "Drag height H",
      dragHoleDia: "Drag hole diameter",
      mm: "mm",
      pitch: "pitch",
      through: "through holes",
    },
  };

  var LIVE_SPECIMEN_DEFAULTS = {
    width: 120,
    depth: 80,
    height: 50,
    holeDia: 8,
    holesX: 2,
    holesY: 2,
  };

  var LIVE_SPECIMEN_LIMITS = {
    width: { min: 80, max: 180, step: 10, sensitivity: 0.5 },
    depth: { min: 50, max: 120, step: 10, sensitivity: 0.45 },
    height: { min: 20, max: 80, step: 5, sensitivity: 0.45 },
    holeDia: { min: 4, max: 20, step: 2, sensitivity: 0.08 },
  };

  var labValues = Object.assign({}, LIVE_SPECIMEN_DEFAULTS);
  var activeDrag = null;

  function locale() {
    if (document.body.dataset.locale) return document.body.dataset.locale;
    return window.location.pathname.indexOf("/docs/en/") >= 0 ? "en" : "ja";
  }

  function imagePath(file, loc) {
    return loc === "en" ? "../images/en/" + file : "images/" + file;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderRoute(route) {
    return (
      '<a class="atlas-route" href="' +
      escapeHtml(route[1]) +
      '">' +
      escapeHtml(route[0]) +
      "</a>"
    );
  }

  function renderSpecimen(specimen, loc) {
    var copy = UI[loc] || UI.ja;
    var labels = specimen.labels[loc] || specimen.labels.ja;
    return (
      '<article class="atlas-card" id="' +
      escapeHtml(specimen.id) +
      '">' +
      '<div class="atlas-card-media">' +
      '<img src="' +
      escapeHtml(imagePath(specimen.image, loc)) +
      '" alt="' +
      escapeHtml(labels.alt) +
      '">' +
      '<img src="' +
      escapeHtml(imagePath(specimen.image2, loc)) +
      '" alt="' +
      escapeHtml(labels.alt2) +
      '">' +
      "</div>" +
      '<div class="atlas-card-body">' +
      '<div class="atlas-card-kicker"><span>' +
      escapeHtml(labels.badge) +
      "</span><code>" +
      escapeHtml(specimen.id) +
      "</code></div>" +
      "<h3>" +
      escapeHtml(labels.title) +
      "</h3>" +
      "<p>" +
      escapeHtml(labels.summary) +
      "</p>" +
      '<div class="atlas-card-section"><strong>' +
      escapeHtml(copy.capabilities) +
      '</strong><div class="atlas-tags">' +
      labels.capabilities
        .map(function (tag) {
          return '<span class="atlas-tag">' + escapeHtml(tag) + "</span>";
        })
        .join("") +
      "</div></div>" +
      '<div class="atlas-card-section"><strong>' +
      escapeHtml(copy.routes) +
      '</strong><div class="atlas-routes">' +
      labels.routes.map(renderRoute).join("") +
      "</div></div>" +
      "</div>" +
      "</article>"
    );
  }

  function mountSpecimens(loc) {
    var root = document.getElementById("atlas-specimens");
    if (!root) return;
    root.innerHTML = SPECIMENS.map(function (specimen) {
      return renderSpecimen(specimen, loc);
    }).join("");
  }

  function readoutHtml(id, label, value, unit) {
    return (
      '<div class="specimen-readout">' +
      "<span>" +
      escapeHtml(label) +
      "</span>" +
      '<strong><output id="' +
      id +
      '-value">' +
      escapeHtml(value) +
      "</output>" +
      (unit ? " " + escapeHtml(unit) : "") +
      "</strong>" +
      "</div>"
    );
  }

  function updateOutput(id, value) {
    var output = document.getElementById(id + "-value");
    if (output) output.textContent = String(value);
  }

  function clampRound(value, limits) {
    var snapped = Math.round(value / limits.step) * limits.step;
    return Math.max(limits.min, Math.min(limits.max, snapped));
  }

  function currentLabValues() {
    return {
      width: labValues.width,
      depth: labValues.depth,
      height: labValues.height,
      holeDia: labValues.holeDia,
      holesX: LIVE_SPECIMEN_DEFAULTS.holesX,
      holesY: LIVE_SPECIMEN_DEFAULTS.holesY,
    };
  }

  function holePositions(w, d, dia, holesX, holesY) {
    var insetX = Math.max(dia * 2.5, Math.min(24, w * 0.22));
    var insetY = Math.max(dia * 2.5, Math.min(20, d * 0.25));
    var usableW = Math.max(1, w - insetX * 2);
    var usableD = Math.max(1, d - insetY * 2);
    var positions = [];
    for (var yi = 0; yi < holesY; yi++) {
      for (var xi = 0; xi < holesX; xi++) {
        positions.push({
          x: holesX === 1 ? w / 2 : insetX + (usableW * xi) / (holesX - 1),
          y: holesY === 1 ? d / 2 : insetY + (usableD * yi) / (holesY - 1),
        });
      }
    }
    return {
      insetX: Math.round(insetX),
      insetY: Math.round(insetY),
      positions: positions,
      pitchX: holesX > 1 ? Math.round(usableW / (holesX - 1)) : 0,
      pitchY: holesY > 1 ? Math.round(usableD / (holesY - 1)) : 0,
    };
  }

  function renderDrawingSvg(values, copy) {
    var w = values.width;
    var d = values.depth;
    var dia = values.holeDia;
    var layout = holePositions(w, d, dia, values.holesX, values.holesY);
    var scale = Math.min(240 / w, 138 / d);
    var x = (360 - w * scale) / 2;
    var y = 44;
    var rectW = w * scale;
    var rectD = d * scale;
    var r = Math.max(2, (dia / 2) * scale);
    var holes = layout.positions
      .map(function (p) {
        return (
          '<circle cx="' +
          (x + p.x * scale).toFixed(1) +
          '" cy="' +
          (y + p.y * scale).toFixed(1) +
          '" r="' +
          r.toFixed(1) +
          '" fill="#fff" stroke="#14213d" stroke-width="2"/>'
        );
      })
      .join("");
    var firstHole = layout.positions[0] || { x: w / 2, y: d / 2 };
    var holeHandleX = x + firstHole.x * scale + r + 18;
    var holeHandleY = y + firstHole.y * scale;
    function dragHandle(type, label, value, px, py, path) {
      var limits = LIVE_SPECIMEN_LIMITS[type];
      return (
        '<g class="specimen-drag-handle" data-drag-handle="' +
        type +
        '" tabindex="0" role="slider" aria-label="' +
        escapeHtml(label) +
        '" aria-valuemin="' +
        limits.min +
        '" aria-valuemax="' +
        limits.max +
        '" aria-valuenow="' +
        value +
        '" transform="translate(' +
        px.toFixed(1) +
        " " +
        py.toFixed(1) +
        ')">' +
        '<rect x="-7" y="-7" width="14" height="14" rx="2" transform="rotate(45)"/>' +
        '<path d="' +
        path +
        '"/>' +
        "</g>"
      );
    }
    return (
      '<svg viewBox="0 0 360 240" role="img" aria-label="' +
      escapeHtml(copy.drawing) +
      '" class="specimen-live-svg">' +
      '<defs><pattern id="atlas-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="#eef2f7" stroke-width="1"/></pattern></defs>' +
      '<rect width="360" height="240" fill="url(#atlas-grid)"/>' +
      '<rect x="' +
      x.toFixed(1) +
      '" y="' +
      y.toFixed(1) +
      '" width="' +
      rectW.toFixed(1) +
      '" height="' +
      rectD.toFixed(1) +
      '" fill="#8fb7ff" stroke="#14213d" stroke-width="2"/>' +
      '<line x1="' +
      x.toFixed(1) +
      '" y1="' +
      (y + rectD / 2).toFixed(1) +
      '" x2="' +
      (x + rectW).toFixed(1) +
      '" y2="' +
      (y + rectD / 2).toFixed(1) +
      '" stroke="#94a3b8" stroke-width="1"/>' +
      '<line x1="' +
      (x + rectW / 2).toFixed(1) +
      '" y1="' +
      y.toFixed(1) +
      '" x2="' +
      (x + rectW / 2).toFixed(1) +
      '" y2="' +
      (y + rectD).toFixed(1) +
      '" stroke="#94a3b8" stroke-width="1"/>' +
      holes +
      '<line x1="' +
      (x + rectW).toFixed(1) +
      '" y1="' +
      (y + rectD / 2).toFixed(1) +
      '" x2="' +
      (x + rectW + 22).toFixed(1) +
      '" y2="' +
      (y + rectD / 2).toFixed(1) +
      '" class="specimen-drag-guide"/>' +
      '<line x1="' +
      (x + rectW / 2).toFixed(1) +
      '" y1="' +
      (y + rectD).toFixed(1) +
      '" x2="' +
      (x + rectW / 2).toFixed(1) +
      '" y2="' +
      (y + rectD + 22).toFixed(1) +
      '" class="specimen-drag-guide"/>' +
      '<line x1="' +
      (x + firstHole.x * scale + r).toFixed(1) +
      '" y1="' +
      holeHandleY.toFixed(1) +
      '" x2="' +
      holeHandleX.toFixed(1) +
      '" y2="' +
      holeHandleY.toFixed(1) +
      '" class="specimen-drag-guide"/>' +
      dragHandle(
        "width",
        copy.dragWidth,
        w,
        x + rectW + 22,
        y + rectD / 2,
        "M-4 -4 L0 0 L-4 4 M4 -4 L0 0 L4 4",
      ) +
      dragHandle(
        "depth",
        copy.dragDepth,
        d,
        x + rectW / 2,
        y + rectD + 22,
        "M-4 -4 L0 0 L4 -4 M-4 4 L0 0 L4 4",
      ) +
      dragHandle(
        "holeDia",
        copy.dragHoleDia,
        dia,
        holeHandleX,
        holeHandleY,
        "M-4 0 L4 0 M1 -3 L4 0 L1 3",
      ) +
      '<text x="180" y="' +
      (y - 16).toFixed(1) +
      '" text-anchor="middle" class="specimen-svg-label">' +
      w +
      " " +
      copy.mm +
      "</text>" +
      '<text x="' +
      (x - 28).toFixed(1) +
      '" y="' +
      (y + rectD / 2 + 4).toFixed(1) +
      '" text-anchor="middle" class="specimen-svg-label">' +
      d +
      " " +
      copy.mm +
      "</text>" +
      '<text x="180" y="' +
      (y + rectD + 28).toFixed(1) +
      '" text-anchor="middle" class="specimen-svg-label specimen-svg-label-strong">' +
      values.holesX * values.holesY +
      "×Ø" +
      dia +
      " " +
      copy.through +
      "</text>" +
      (layout.pitchX
        ? '<text x="180" y="' +
          (y + 24).toFixed(1) +
          '" text-anchor="middle" class="specimen-svg-label specimen-svg-label-small">' +
          layout.pitchX +
          " " +
          copy.mm +
          " " +
          copy.pitch +
          "</text>"
        : "") +
      "</svg>"
    );
  }

  function renderSolidSvg(values, copy) {
    var w = values.width;
    var d = values.depth;
    var h = values.height;
    var dia = values.holeDia;
    var layout = holePositions(w, d, dia, values.holesX, values.holesY);
    var scale = Math.min(1.35, 170 / w, 118 / d, 70 / h);
    var xVec = { x: 1.16 * scale, y: 0.42 * scale };
    var yVec = { x: -0.92 * scale, y: 0.45 * scale };
    var zVec = { x: 0, y: 1.05 * scale };
    function rawPoint(x, y, z) {
      return {
        x: x * xVec.x + y * yVec.x + z * zVec.x,
        y: x * xVec.y + y * yVec.y + z * zVec.y,
      };
    }
    var rawCorners = {
      a: rawPoint(0, 0, 0),
      b: rawPoint(w, 0, 0),
      c: rawPoint(w, d, 0),
      d: rawPoint(0, d, 0),
      ab: rawPoint(0, 0, h),
      bb: rawPoint(w, 0, h),
      cb: rawPoint(w, d, h),
      db: rawPoint(0, d, h),
    };
    var all = Object.keys(rawCorners).map(function (key) {
      return rawCorners[key];
    });
    var minX = Math.min.apply(
      null,
      all.map(function (p) {
        return p.x;
      }),
    );
    var maxX = Math.max.apply(
      null,
      all.map(function (p) {
        return p.x;
      }),
    );
    var minY = Math.min.apply(
      null,
      all.map(function (p) {
        return p.y;
      }),
    );
    var maxY = Math.max.apply(
      null,
      all.map(function (p) {
        return p.y;
      }),
    );
    var tx = (360 - (maxX - minX)) / 2 - minX;
    var ty = Math.max(18, (202 - (maxY - minY)) / 2) - minY;
    function point(x, y, z) {
      var p = rawPoint(x, y, z);
      return { x: p.x + tx, y: p.y + ty };
    }
    function t(p) {
      return { x: p.x + tx, y: p.y + ty };
    }
    var a = t(rawCorners.a);
    var b = t(rawCorners.b);
    var c = t(rawCorners.c);
    var d0 = t(rawCorners.d);
    var ab = t(rawCorners.ab);
    var bb = t(rawCorners.bb);
    var cb = t(rawCorners.cb);
    var db = t(rawCorners.db);
    function xy(p) {
      return p.x.toFixed(1) + " " + p.y.toFixed(1);
    }
    function polygon(points, fill, stroke, extra) {
      return (
        '<polygon points="' +
        points.map(xy).join(" ") +
        '" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width="1.4" ' +
        (extra || "") +
        "/>"
      );
    }
    function mid(p1, p2) {
      return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }
    function label(text, p, cls) {
      return (
        '<text x="' +
        p.x.toFixed(1) +
        '" y="' +
        p.y.toFixed(1) +
        '" text-anchor="middle" class="' +
        (cls || "specimen-iso-label") +
        '">' +
        escapeHtml(text) +
        "</text>"
      );
    }
    function dimLine(p1, p2, text, dx, dy) {
      var s = { x: p1.x + dx, y: p1.y + dy };
      var e = { x: p2.x + dx, y: p2.y + dy };
      var m = mid(s, e);
      return (
        '<line x1="' +
        s.x.toFixed(1) +
        '" y1="' +
        s.y.toFixed(1) +
        '" x2="' +
        e.x.toFixed(1) +
        '" y2="' +
        e.y.toFixed(1) +
        '" class="specimen-iso-dim" marker-start="url(#iso-arrow)" marker-end="url(#iso-arrow)"/>' +
        label(
          text,
          { x: m.x, y: m.y - 6 },
          "specimen-iso-label specimen-iso-label-dim",
        )
      );
    }
    var holes = layout.positions
      .slice(0, 16)
      .map(function (hp) {
        var center = point(hp.x, hp.y, 0);
        var rx = Math.max(3.2, dia * scale * 0.5);
        var ry = Math.max(1.6, dia * scale * 0.22);
        var angle = 12;
        return (
          '<ellipse cx="' +
          center.x.toFixed(1) +
          '" cy="' +
          (center.y + 1.2).toFixed(1) +
          '" rx="' +
          rx.toFixed(1) +
          '" ry="' +
          ry.toFixed(1) +
          '" transform="rotate(' +
          angle +
          " " +
          center.x.toFixed(1) +
          " " +
          center.y.toFixed(1) +
          ')" fill="#41699f" opacity="0.35"/>' +
          '<ellipse cx="' +
          center.x.toFixed(1) +
          '" cy="' +
          center.y.toFixed(1) +
          '" rx="' +
          rx.toFixed(1) +
          '" ry="' +
          ry.toFixed(1) +
          '" transform="rotate(' +
          angle +
          " " +
          center.x.toFixed(1) +
          " " +
          center.y.toFixed(1) +
          ')" fill="#f8fafc" stroke="#315f99" stroke-width="1.35"/>'
        );
      })
      .join("");
    function dragHandle(type, label, value, px, py, path) {
      var limits = LIVE_SPECIMEN_LIMITS[type];
      return (
        '<g class="specimen-drag-handle specimen-drag-handle-iso" data-drag-handle="' +
        type +
        '" tabindex="0" role="slider" aria-label="' +
        escapeHtml(label) +
        '" aria-valuemin="' +
        limits.min +
        '" aria-valuemax="' +
        limits.max +
        '" aria-valuenow="' +
        value +
        '" transform="translate(' +
        px.toFixed(1) +
        " " +
        py.toFixed(1) +
        ')">' +
        '<rect x="-7" y="-7" width="14" height="14" rx="2" transform="rotate(45)"/>' +
        '<path d="' +
        path +
        '"/>' +
        "</g>"
      );
    }
    var heightHandle = mid({ x: c.x + 18, y: c.y }, { x: cb.x + 18, y: cb.y });
    var floorY = Math.max(ab.y, bb.y, cb.y, db.y) + 14;
    return (
      '<svg viewBox="0 0 360 240" role="img" aria-label="' +
      escapeHtml(copy.solid) +
      '" class="specimen-live-svg">' +
      "<defs>" +
      '<linearGradient id="iso-top" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e8fbff"/><stop offset="0.55" stop-color="#b8dcff"/><stop offset="1" stop-color="#8fb7ff"/></linearGradient>' +
      '<linearGradient id="iso-front" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7aa1dd"/><stop offset="1" stop-color="#5576b4"/></linearGradient>' +
      '<linearGradient id="iso-side" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#91b5ef"/><stop offset="1" stop-color="#6d8fca"/></linearGradient>' +
      '<marker id="iso-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M1 1 L6 3.5 L1 6 Z" fill="#64748b"/></marker>' +
      "</defs>" +
      '<rect width="360" height="240" fill="#f8fafc"/>' +
      '<ellipse cx="180" cy="' +
      floorY.toFixed(1) +
      '" rx="' +
      Math.min(142, (maxX - minX) * 0.62).toFixed(1) +
      '" ry="16" fill="#dbe3ef" opacity="0.7"/>' +
      polygon([d0, c, cb, db], "url(#iso-front)", "#496aa4") +
      polygon([b, c, cb, bb], "url(#iso-side)", "#5678b2") +
      polygon([a, b, bb, ab], "#6386c4", "#496aa4") +
      polygon([a, b, c, d0], "url(#iso-top)", "#315f99") +
      holes +
      '<polyline points="' +
      [ab, bb, cb, db, ab].map(xy).join(" ") +
      '" fill="none" stroke="#40516f" stroke-width="1"/>' +
      dimLine(a, b, "W " + w + " " + copy.mm, 0, -14) +
      dimLine(d0, c, "D " + d + " " + copy.mm, 0, 18) +
      dimLine(c, cb, "H " + h + " " + copy.mm, 18, 0) +
      dragHandle(
        "height",
        copy.dragHeight,
        h,
        heightHandle.x,
        heightHandle.y,
        "M-4 -4 L0 0 L4 -4 M-4 4 L0 0 L4 4",
      ) +
      label(
        values.holesX * values.holesY + "×Ø" + dia,
        { x: 180, y: 222 },
        "specimen-iso-label specimen-iso-label-title",
      ) +
      "</svg>"
    );
  }

  function renderDsl(values) {
    var layout = holePositions(
      values.width,
      values.depth,
      values.holeDia,
      values.holesX,
      values.holesY,
    );
    return JSON.stringify(
      {
        part: "panel",
        params: { W: values.width, D: values.depth, H: values.height },
        features: [
          {
            type: "hole_grid",
            countX: values.holesX,
            countY: values.holesY,
            diameter: values.holeDia,
            insetX: layout.insetX,
            insetY: layout.insetY,
            through: true,
          },
        ],
      },
      null,
      2,
    );
  }

  function updateLab(loc) {
    var copy = UI[loc] || UI.ja;
    var values = currentLabValues();
    updateOutput("spec-width", values.width);
    updateOutput("spec-depth", values.depth);
    updateOutput("spec-height", values.height);
    updateOutput("spec-hole-dia", values.holeDia);
    updateOutput("spec-holes", copy.fixedHolesValue);
    document.getElementById("specimen-drawing").innerHTML = renderDrawingSvg(
      values,
      copy,
    );
    document.getElementById("specimen-solid").innerHTML = renderSolidSvg(
      values,
      copy,
    );
    document.getElementById("specimen-dsl").textContent = renderDsl(values);
    bindDragHandles(loc);
  }

  function dragAxisDelta(type, event) {
    if (type === "depth" || type === "height") {
      return event.clientY - activeDrag.startY;
    }
    return event.clientX - activeDrag.startX;
  }

  function updateDraggedValue(event) {
    if (!activeDrag) return;
    var limits = LIVE_SPECIMEN_LIMITS[activeDrag.type];
    var delta = dragAxisDelta(activeDrag.type, event);
    labValues[activeDrag.type] = clampRound(
      activeDrag.startValue + delta * limits.sensitivity,
      limits,
    );
    updateLab(activeDrag.loc);
  }

  function stopDrag() {
    window.removeEventListener("pointermove", updateDraggedValue);
    activeDrag = null;
  }

  function bindDragHandles(loc) {
    var root = document.getElementById("specimen-lab");
    if (!root) return;
    root.querySelectorAll("[data-drag-handle]").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (event) {
        var type = handle.getAttribute("data-drag-handle");
        activeDrag = {
          type: type,
          loc: loc,
          startX: event.clientX,
          startY: event.clientY,
          startValue: labValues[type],
        };
        event.preventDefault();
        window.addEventListener("pointermove", updateDraggedValue);
        window.addEventListener("pointerup", stopDrag, { once: true });
        window.addEventListener("pointercancel", stopDrag, { once: true });
      });
      handle.addEventListener("keydown", function (event) {
        var type = handle.getAttribute("data-drag-handle");
        var limits = LIVE_SPECIMEN_LIMITS[type];
        var direction = 0;
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          direction = 1;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          direction = -1;
        }
        if (!direction) return;
        labValues[type] = clampRound(
          labValues[type] + limits.step * direction,
          limits,
        );
        event.preventDefault();
        updateLab(loc);
      });
    });
  }

  function mountLab(loc) {
    var root = document.getElementById("specimen-lab");
    if (!root) return;
    var copy = UI[loc] || UI.ja;
    labValues = Object.assign({}, LIVE_SPECIMEN_DEFAULTS);
    root.innerHTML =
      '<div class="specimen-controls" aria-label="' +
      escapeHtml(copy.controls) +
      '">' +
      "<h3>" +
      escapeHtml(copy.controls) +
      "</h3>" +
      '<p class="specimen-control-note">' +
      escapeHtml(copy.dragHint) +
      "</p>" +
      '<div class="specimen-readout-list">' +
      readoutHtml("spec-width", copy.width, labValues.width, copy.mm) +
      readoutHtml("spec-depth", copy.depth, labValues.depth, copy.mm) +
      readoutHtml("spec-height", copy.height, labValues.height, copy.mm) +
      readoutHtml("spec-hole-dia", copy.holeDia, labValues.holeDia, copy.mm) +
      readoutHtml("spec-holes", copy.fixedHoles, copy.fixedHolesValue, "") +
      "</div>" +
      "</div>" +
      '<div class="specimen-preview-grid">' +
      '<section class="specimen-preview-panel"><h3>' +
      escapeHtml(copy.drawing) +
      '</h3><div id="specimen-drawing" class="specimen-svg"></div></section>' +
      '<section class="specimen-preview-panel"><h3>' +
      escapeHtml(copy.solid) +
      '</h3><div id="specimen-solid" class="specimen-svg"></div></section>' +
      '<section class="specimen-preview-panel specimen-preview-code"><h3>' +
      escapeHtml(copy.dsl) +
      '</h3><pre><code id="specimen-dsl"></code></pre></section>' +
      "</div>";

    updateLab(loc);
  }

  function init() {
    var loc = locale();
    mountSpecimens(loc);
    mountLab(loc);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
