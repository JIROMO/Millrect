"use strict";

// ── 3D View Module ────────────────────────────────────────────
// Three.js scene for real-time 3D preview derived from orthographic views.
// 2D drawings are the source of truth; 3D is rebuilt via multiview CSG.
// Coordinate convention: Three.js Y-up, shape data in real units
// (10 real units = 1mm), so realToMM = v / 10.
// 3D は図面スケール（page.scale）に依存しない — real units → mm のみ変換する。

const _REAL_PER_MM = 10;

/** real units → Three.js シーン mm（図面 scale は反映しない） */
function _realToThreeMM(v) {
  return v / _REAL_PER_MM;
}

let _3scene = null;
let _3camera = null;
let _3renderer = null;
let _3controls = null;
let _3meshes = [];
let _3animId = null;
let _3canvas = null;
let _3dStatus = { meshCount: 0, message: null };
let _3modelPipelineState = {
  ok: false,
  modelIr: null,
  geometryData: null,
  errors: [],
  warnings: [],
  logs: [],
};
// 派生パイプライン（Model IR / geometry-data）は重い（全プロジェクトの
// JSON 直列化 + 検証）ため、3D 更新ごとには走らせず dirty フラグで遅延評価する。
let _3modelPipelineDirty = false;
const UPDATE3D_DEBOUNCE_MS = 300;
let _update3dTimer = null;

function _disposeMesh(mesh) {
  if (!mesh) return;
  mesh.geometry?.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) mat.forEach((m) => m?.dispose());
  else mat?.dispose();
}

// axisVolumes の各エントリ（{ any, byColor } | null）を破棄する。
function _disposeAxisEntry(entry) {
  if (!entry) return;
  _disposeMesh(entry.any);
  if (entry.byColor) for (const m of entry.byColor.values()) _disposeMesh(m);
}

// mesh のワールド bbox を指定軸（'x'|'y'|'z'）に投影した [min,max] を返す。
function _worldRangeAlongAxis(mesh, axis) {
  if (!mesh?.geometry) return null;
  mesh.updateMatrixWorld(true);
  const g = mesh.geometry;
  g.computeBoundingBox();
  if (!g.boundingBox) return null;
  const bb = g.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  return [bb.min[axis], bb.max[axis]];
}

// 三角形が 1 枚も無い（縮退した）メッシュは csg.js の BSP で plane=null と
// なり、union/intersect の invert() が null.flip() でクラッシュする。
// そのようなメッシュは CSG に渡さず、空でない側をそのまま返す。
function _meshHasGeometry(mesh) {
  const pos = mesh?.geometry?.attributes?.position;
  return !!pos && pos.count >= 3;
}

// ワールド変換を焼き込んだ非インデックスジオメトリを返す（連結用）
function _bakedWorldGeometry(mesh) {
  mesh.updateMatrixWorld(true);
  const g = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  return g;
}

// bbox が交差しない（=体積を共有しない）2 メッシュをジオメトリ連結で合成する。
// 非交差の union は BSP と結果が同一で、逐次 BSP union の膨張を避けられる。
function _concatDisjointMeshes(meshA, meshB, material) {
  const ga = _bakedWorldGeometry(meshA);
  const gb = _bakedWorldGeometry(meshB);
  const pa = ga.attributes.position.array;
  const pb = gb.attributes.position.array;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa, 0);
  pos.set(pb, pa.length);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const na = ga.attributes.normal;
  const nb = gb.attributes.normal;
  if (na && nb) {
    const nrm = new Float32Array(na.array.length + nb.array.length);
    nrm.set(na.array, 0);
    nrm.set(nb.array, na.array.length);
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  } else {
    geo.computeVertexNormals();
  }
  geo.computeBoundingBox();
  ga.dispose();
  gb.dispose();
  const mesh = new THREE.Mesh(geo, material || meshA.material?.clone());
  _disposeMesh(meshA);
  _disposeMesh(meshB);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function _worldBox(mesh) {
  mesh.updateMatrixWorld(true);
  const g = mesh.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  return g.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
}

function _csgUnion(meshA, meshB, material) {
  if (!meshA) return meshB || null;
  if (!meshB) return meshA;
  if (!_meshHasGeometry(meshA)) {
    _disposeMesh(meshA);
    return meshB;
  }
  if (!_meshHasGeometry(meshB)) {
    _disposeMesh(meshB);
    return meshA;
  }
  // 体積を共有しない場合は BSP を使わず連結（同一結果・大幅に高速）
  try {
    if (!_worldBox(meshA).intersectsBox(_worldBox(meshB))) {
      return _concatDisjointMeshes(meshA, meshB, material);
    }
  } catch (e) {
    console.warn("[3D] disjoint-union fast path failed:", e);
  }
  try {
    const result = CSGAdapter.union(
      meshA,
      meshB,
      material || meshA.material?.clone(),
    );
    _disposeMesh(meshA);
    _disposeMesh(meshB);
    return result;
  } catch (e) {
    console.warn("[3D] CSG union failed:", e);
    _disposeMesh(meshB);
    return meshA;
  }
}

function _csgIntersect(meshA, meshB, material) {
  if (!meshA) return meshB || null;
  if (!meshB) return meshA;
  // 縮退メッシュとの交差は空集合だが、ここでは安全に空でない側を返す。
  if (!_meshHasGeometry(meshA)) {
    _disposeMesh(meshA);
    return meshB;
  }
  if (!_meshHasGeometry(meshB)) {
    _disposeMesh(meshB);
    return meshA;
  }
  try {
    const result = CSGAdapter.intersect(
      meshA,
      meshB,
      material || meshA.material?.clone(),
    );
    _disposeMesh(meshA);
    _disposeMesh(meshB);
    return result;
  } catch (e) {
    console.warn("[3D] CSG intersect failed:", e);
    _disposeMesh(meshB);
    return meshA;
  }
}

function _disposeSceneObject(obj) {
  if (!obj) return;
  obj.traverse?.((node) => {
    node.geometry?.dispose();
    const mat = node.material;
    if (Array.isArray(mat)) mat.forEach((m) => m?.dispose());
    else mat?.dispose();
  });
}

// ── Init ──────────────────────────────────────────────────────
function init3DView(canvas) {
  if (_3renderer) destroy3DView();
  _3canvas = canvas;

  const w = canvas.clientWidth || 400;
  const h = canvas.clientHeight || 400;

  // Scene
  _3scene = new THREE.Scene();
  _3scene.background = new THREE.Color(0x1e1e1e);

  // Grid (100mm × 100mm, 10mm steps)
  const grid = new THREE.GridHelper(200, 20, 0x383838, 0x2c2c2c);
  grid.position.y = -0.02;
  _3scene.add(grid);

  // Lights
  _3scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(80, 120, 60);
  _3scene.add(sun);
  const fill = new THREE.DirectionalLight(0x99aaff, 0.25);
  fill.position.set(-60, 30, -80);
  _3scene.add(fill);

  // Camera
  _3camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
  _3camera.position.set(80, 60, 80);
  _3camera.lookAt(0, 0, 0);

  // Renderer
  _3renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  _3renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _3renderer.setSize(w, h, false);
  _3renderer.shadowMap.enabled = true;

  // OrbitControls
  _3controls = new THREE.OrbitControls(_3camera, _3renderer.domElement);
  _3controls.enableDamping = true;
  _3controls.dampingFactor = 0.06;
  _3controls.minDistance = 5;
  _3controls.maxDistance = 2000;

  function tick() {
    _3animId = requestAnimationFrame(tick);
    resize3DView();
    _3controls.update();
    _3renderer.render(_3scene, _3camera);
  }
  tick();
}

function resize3DView() {
  if (!_3renderer || !_3canvas) return;
  const w = _3canvas.clientWidth;
  const h = _3canvas.clientHeight;
  if (!w || !h) return;
  const size = _3renderer.getSize(new THREE.Vector2());
  if (size.x === w && size.y === h) return;
  _3renderer.setSize(w, h, false);
  _3camera.aspect = w / h;
  _3camera.updateProjectionMatrix();
}

function reset3DViewCamera() {
  if (!_3camera || !_3controls) return;
  _3camera.position.set(80, 60, 80);
  _3controls.target.set(0, 0, 0);
  _3controls.update();
}

function destroy3DView() {
  cancelScheduledUpdate3DScene();
  if (_3animId) cancelAnimationFrame(_3animId);
  _3animId = null;

  for (const m of _3meshes) _disposeMesh(m);
  _3meshes = [];

  if (_3scene) {
    _disposeSceneObject(_3scene);
    _3scene.clear();
  }

  _3controls?.dispose?.();
  _3renderer?.dispose();

  _3scene = _3camera = _3renderer = _3controls = _3canvas = null;
  _3dStatus = { meshCount: 0, message: null };
  _3modelPipelineState = {
    ok: false,
    modelIr: null,
    geometryData: null,
    errors: [],
    warnings: [],
    logs: [],
  };
  _3modelPipelineDirty = false;
}

function get3DSceneStatus() {
  const materialColors = _3meshes
    .map((m) =>
      m.material?.color ? `#${m.material.color.getHexString()}` : null,
    )
    .filter(Boolean);
  return {
    meshCount: _3dStatus.meshCount,
    message: _3dStatus.message,
    materialColor: materialColors[0] ?? null,
    materialColors,
  };
}

function get3DModelPipelineState() {
  if (_3modelPipelineDirty) {
    _refreshModelPipelineState();
    _3modelPipelineDirty = false;
  }
  return _3modelPipelineState;
}

function _projectJsonForModelPipeline() {
  const state = getState();
  if (typeof _projectDataFromState === "function") {
    return _projectDataFromState(state);
  }
  return {
    projectName: state.projectName,
    unit: state.unit,
    fonts: state.fonts || [],
    pages: state.pages || [],
    ...(state.partIntent ? { partIntent: state.partIntent } : {}),
    ...(state.projectBrief ? { projectBrief: state.projectBrief } : {}),
  };
}

function _refreshModelPipelineState() {
  const generator = globalThis.MillrectModelGenerator;
  const geometryCore = globalThis.MillrectGeometryCore;
  if (
    !generator?.generateModelIrFromProject ||
    !geometryCore?.generateGeometryFromModelIr
  ) {
    _3modelPipelineState = {
      ok: false,
      modelIr: null,
      geometryData: null,
      errors: ["Model pipeline packages are not loaded"],
      warnings: [],
      logs: [],
    };
    return _3modelPipelineState;
  }

  try {
    const project = _projectJsonForModelPipeline();
    const irResult = generator.generateModelIrFromProject(project, {
      mode: "legacy-3d-view-wrapper",
    });
    const geometryResult = irResult.ir
      ? geometryCore.generateGeometryFromModelIr(irResult.ir, {
          mode: "legacy-3d-view-wrapper",
        })
      : null;
    _3modelPipelineState = {
      ok: Boolean(irResult.ok && geometryResult?.ok),
      modelIr: irResult.ir || null,
      geometryData: geometryResult?.data || null,
      errors: [...(irResult.errors || []), ...(geometryResult?.errors || [])],
      warnings: [
        ...(irResult.warnings || []),
        ...(geometryResult?.warnings || []),
      ],
      logs: [...(irResult.logs || []), ...(geometryResult?.logs || [])],
    };
  } catch (e) {
    _3modelPipelineState = {
      ok: false,
      modelIr: null,
      geometryData: null,
      errors: [e?.message || "Model pipeline failed"],
      warnings: [],
      logs: [],
    };
  }
  return _3modelPipelineState;
}

function _edgeKey(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function _validateMeshGeometry(geometry) {
  const pos = geometry?.attributes?.position;
  if (!pos || pos.count < 3) {
    return { ok: false, message: t("view3d.noValidVertices") };
  }

  for (let i = 0; i < pos.count; i++) {
    if (
      !Number.isFinite(pos.getX(i)) ||
      !Number.isFinite(pos.getY(i)) ||
      !Number.isFinite(pos.getZ(i))
    ) {
      return { ok: false, message: t("view3d.invalidVertices") };
    }
  }

  const warnings = [];
  const index = geometry.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const edgeCount = new Map();
  let degenerate = 0;
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let t = 0; t < triCount; t++) {
    const ia = index ? index.getX(t * 3) : t * 3;
    const ib = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const ic = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    va.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia));
    vb.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib));
    vc.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic));
    ab.subVectors(vb, va);
    ac.subVectors(vc, va);
    cross.crossVectors(ab, ac);
    if (cross.lengthSq() < 1e-12) degenerate++;

    for (const [a, b] of [
      [ia, ib],
      [ib, ic],
      [ic, ia],
    ]) {
      const key = _edgeKey(a, b);
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  }

  if (degenerate > 0) {
    warnings.push(t("view3d.degenerateTriangles", { count: degenerate }));
  }
  for (const count of edgeCount.values()) {
    if (count !== 2) {
      warnings.push(t("view3d.openEdges"));
      break;
    }
  }

  return { ok: true, warnings };
}

function validateMeshesForExport(meshes) {
  if (!meshes?.length) {
    return {
      ok: false,
      message: _3dStatus.message || t("view3d.noMesh"),
    };
  }

  const warnings = [];
  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) {
      return {
        ok: false,
        message: t("view3d.zeroVolume"),
      };
    }

    const geoResult = _validateMeshGeometry(mesh.geometry);
    if (!geoResult.ok) return geoResult;
    if (geoResult.warnings?.length) warnings.push(...geoResult.warnings);
  }

  const unique = [...new Set(warnings)];
  return {
    ok: true,
    warnings: unique,
    message: unique.length ? unique.join("\n") : null,
  };
}

function _normalizeViewType(type) {
  if (type === "section" || type === "detail") return "top";
  return type ?? "top";
}

function _sync3DEmptyOverlay(message) {
  const el = document.getElementById("panel-3d-empty");
  if (!el) return;
  const msgEl = el.querySelector(".panel-3d-empty-msg");
  if (message) {
    el.hidden = false;
    if (msgEl) msgEl.textContent = message;
  } else {
    el.hidden = true;
    if (msgEl) msgEl.textContent = "";
  }
}

// ── ViewDefinition → Three.js 変換 ────────────────────────────
//
// 正規ワールド空間:  X=[0,W]  Y=[0,H]  Z=[-D,0]
//
function _applyViewTransform(mesh, viewType) {
  switch (viewType) {
    case "front":
    case "back":
      break;
    case "bottom":
      mesh.rotation.x = Math.PI / 2;
      break;
    case "right":
    case "left":
      mesh.rotation.y = Math.PI / 2;
      break;
    case "top":
    default:
      mesh.rotation.x = -Math.PI / 2;
      break;
  }
}

function _applyViewPosition(mesh, viewType, dims) {
  const { H, D } = dims;
  switch (viewType) {
    case "front":
    case "back":
      mesh.position.z = -D;
      break;
    case "bottom":
      mesh.position.y = H;
      mesh.position.z = -D;
      break;
    default:
      break;
  }
}

function _profileFrameForPage(page) {
  const profiles =
    typeof getProfileEntriesFromPage === "function"
      ? getProfileEntriesFromPage(page).map((entry) => entry.profile)
      : typeof extractProfilesFromPage === "function"
        ? extractProfilesFromPage(page)
        : [];
  const boxes = profiles.map((p) => p.bbox).filter(Boolean);
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((b) => b.minX ?? b.x));
  const minY = Math.min(...boxes.map((b) => b.minY ?? b.y));
  const maxX = Math.max(...boxes.map((b) => b.maxX ?? b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.maxY ?? b.y + b.h));
  return {
    profiles,
    bbox: {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      minX,
      minY,
      maxX,
      maxY,
    },
  };
}

function _frameSizeMM(frame, axis) {
  const value = axis === "h" ? frame?.bbox?.h : frame?.bbox?.w;
  return Number(value) > 0 ? _realToThreeMM(value) : null;
}

function _maxFrameSizeMM(frames, axis) {
  const values = (frames || [])
    .map((frame) => _frameSizeMM(frame, axis))
    .filter((value) => Number(value) > 0);
  return values.length ? Math.max(...values) : null;
}

function _profileToThreeShapesForView(profile, page, viewType, frame) {
  const m = _realToThreeMM;
  const bbox = frame?.bbox || profile.bbox;
  if (!bbox) return [];
  const frameW = m(bbox.w);
  const frameH = m(bbox.h);
  const rings = profile.rings;
  if (!rings || rings.length === 0) return [];

  // 図形ジオメトリ（profile.rings）をビュー内ローカル座標へ正規化して押し出す。
  // これにより上面図・正面図・側面図が紙面上の別位置にあっても 3D 軸が一致する。
  // 切り欠きは 2D 図形側に
  // 焼き込まれている前提（role:"cut" 線は 2D 注釈であり 3D には影響しない）。
  const polygons = [rings];

  function tx(rawX, rawY) {
    const x = m(rawX - bbox.x);
    const y = m(rawY - bbox.y);
    switch (viewType) {
      case "top":
        // rotation.x = -π/2 が入るため、他ビューと同じく y を反転しないと
        // 真上から見たとき鏡像になる（drawing 上端=モデル奥の CAD 平面図準拠）。
        return [x, frameH - y];
      case "bottom":
        return [x, frameH - y];
      case "front":
        return [x, frameH - y];
      case "back":
        return [frameW - x, frameH - y];
      case "right":
        return [x, frameH - y];
      case "left":
        return [frameW - x, frameH - y];
      default:
        return [x, y];
    }
  }

  function buildPath(ring, isHole) {
    const p = isHole ? new THREE.Path() : new THREE.Shape();
    // polygon-clipping は最初と最後の点が同一（閉じている）。重複末尾は除く。
    let n = ring.length;
    if (
      n > 1 &&
      ring[0][0] === ring[n - 1][0] &&
      ring[0][1] === ring[n - 1][1]
    ) {
      n -= 1;
    }
    const [x0, y0] = tx(ring[0][0], ring[0][1]);
    p.moveTo(x0, y0);
    for (let i = 1; i < n; i++) {
      const [xi, yi] = tx(ring[i][0], ring[i][1]);
      p.lineTo(xi, yi);
    }
    p.closePath();
    return p;
  }

  const shapes = [];
  for (const poly of polygons) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const s = buildPath(outer, false);
    for (let h = 1; h < poly.length; h++) {
      if (poly[h]?.length >= 3) s.holes.push(buildPath(poly[h], true));
    }
    shapes.push(s);
  }
  return shapes;
}

// ── 多ビュー交差（6面対応）──────────────────────────────────
//
// 正規ワールド空間: X=[0,W]  Y=[0,H]  Z=[-D,0]
// 各ビューの輪郭を CSG 交差して立体を生成する。
//
function _build3DSceneFromViews() {
  const state = getState();

  const byType = {};
  for (const p of state.pages) {
    const t = _normalizeViewType(p.viewDefinition?.type);
    if (!byType[t]) byType[t] = [];
    byType[t].push(p);
  }
  const pageFrames = new Map(
    state.pages
      .map((page) => [page.id, _profileFrameForPage(page)])
      .filter(([, frame]) => frame),
  );

  const hasTop = !!(byType.top || byType.bottom);
  const hasFront = !!(byType.front || byType.back);
  if (!hasTop && !hasFront) {
    return {
      ok: false,
      message: t("view3d.needViews"),
    };
  }

  const topFrames = [...(byType.top || []), ...(byType.bottom || [])].map(
    (page) => pageFrames.get(page.id),
  );
  const frontFrames = [...(byType.front || []), ...(byType.back || [])].map(
    (page) => pageFrames.get(page.id),
  );
  const rightFrames = [...(byType.right || []), ...(byType.left || [])].map(
    (page) => pageFrames.get(page.id),
  );

  const W =
    _maxFrameSizeMM(frontFrames, "w") ?? _maxFrameSizeMM(topFrames, "w") ?? 210;
  const H =
    _maxFrameSizeMM(frontFrames, "h") ??
    _maxFrameSizeMM(rightFrames, "h") ??
    210;
  const D =
    _maxFrameSizeMM(topFrames, "h") ?? _maxFrameSizeMM(rightFrames, "w") ?? 210;
  const dims = { W, H, D };

  const sweepDepthFor = {
    top: H,
    bottom: H,
    front: D,
    back: D,
    right: W,
    left: W,
  };

  function buildUnion(pages, viewType) {
    if (!pages?.length) return null;
    let mesh = null;
    for (const page of pages) {
      const m = _buildPageUnionMesh(
        page,
        sweepDepthFor[viewType],
        viewType,
        dims,
        pageFrames,
      );
      if (!m) continue;
      if (!mesh) {
        mesh = m;
        continue;
      }
      mesh = _csgUnion(mesh, m, mesh.material?.clone());
    }
    return mesh;
  }

  function axisVolume(a, b) {
    return _csgUnion(a, b, a?.material?.clone());
  }

  // 色別の clamp volume を構築する。多ビューで「色＝積層レイヤー」を表現するため、
  // 各 top パーツを同色の secondary-view volume と交差させる。色が一致しない場合は
  // any（全色 union）にフォールバックし、従来の色無視の挙動を維持する。
  function buildColorVolumes(specs) {
    const byColor = new Map();
    for (const { pages, viewType } of specs) {
      if (!pages?.length) continue;
      for (const page of pages) {
        const entries =
          typeof getProfileEntriesFromPage === "function"
            ? getProfileEntriesFromPage(page)
            : [...iterProfileSourcesFromPage(page)]
                .map(({ shape, ancestorGroups }) => ({
                  shape,
                  ancestorGroups,
                  profile: shapeToProfile(shape, page.id, ancestorGroups),
                }))
                .filter((entry) => entry.profile);
        for (const { shape, profile } of entries) {
          if (shape.type === "line" || shape.type === "text") continue;
          const color = _colorForShape(shape);
          const mesh = _buildMeshFromProfile(
            profile,
            page,
            viewType,
            dims,
            _makeMaterial(color),
            pageFrames?.get(page.id),
          );
          if (!mesh) continue;
          const prev = byColor.get(color);
          byColor.set(
            color,
            prev ? _csgUnion(prev, mesh, _makeMaterial(color)) : mesh,
          );
        }
      }
    }
    return byColor;
  }

  function makeAxisEntry(unionAny, specs) {
    if (!unionAny) return null;
    // specs（元ページ情報）は revolve の 2D 母線サンプリングが参照する
    return { any: unionAny, byColor: buildColorVolumes(specs), specs };
  }

  const axisVolumes = {
    y: makeAxisEntry(
      axisVolume(
        buildUnion(byType.top, "top"),
        buildUnion(byType.bottom, "bottom"),
      ),
      [
        { pages: byType.top, viewType: "top" },
        { pages: byType.bottom, viewType: "bottom" },
      ],
    ),
    z: makeAxisEntry(
      axisVolume(
        buildUnion(byType.front, "front"),
        buildUnion(byType.back, "back"),
      ),
      [
        { pages: byType.front, viewType: "front" },
        { pages: byType.back, viewType: "back" },
      ],
    ),
    x: makeAxisEntry(
      axisVolume(
        buildUnion(byType.right, "right"),
        buildUnion(byType.left, "left"),
      ),
      [
        { pages: byType.right, viewType: "right" },
        { pages: byType.left, viewType: "left" },
      ],
    ),
  };

  const activeAxisCount = [axisVolumes.y, axisVolumes.z, axisVolumes.x].filter(
    Boolean,
  ).length;
  if (activeAxisCount < 2) {
    for (const vol of [axisVolumes.y, axisVolumes.z, axisVolumes.x]) {
      _disposeAxisEntry(vol);
    }
    return _buildSingleViewExtrusionScene(byType, dims, pageFrames);
  }

  const primary = _getPrimaryPartAxis(byType);
  if (!primary) {
    for (const vol of [axisVolumes.y, axisVolumes.z, axisVolumes.x]) {
      _disposeAxisEntry(vol);
    }
    return {
      ok: false,
      message: t("view3d.needViews"),
    };
  }

  const parts = [];
  for (const page of state.pages) {
    const viewType = _normalizeViewType(page.viewDefinition?.type);
    if (!primary.viewTypes.has(viewType)) continue;
    if (!pageFrames.get(page.id)) continue;
    for (const { shape, ancestorGroups } of iterProfileSourcesFromPage(page)) {
      if (shape.type === "line" || shape.type === "text") continue;
      const part = _buildPartMesh(
        page,
        shape,
        ancestorGroups,
        axisVolumes,
        dims,
        pageFrames,
      );
      if (part) parts.push(part);
    }
  }

  for (const vol of [axisVolumes.y, axisVolumes.z, axisVolumes.x]) {
    _disposeAxisEntry(vol);
  }

  if (!parts.length) {
    return {
      ok: false,
      message: t("view3d.needClosedProfiles"),
    };
  }

  const byColor = new Map();
  for (const { mesh, color } of parts) {
    if (!byColor.has(color)) byColor.set(color, []);
    byColor.get(color).push(mesh);
  }

  let added = 0;
  for (const [color, meshes] of byColor) {
    let merged = meshes[0];
    const mat = _makeMaterial(color);
    for (let i = 1; i < meshes.length; i++) {
      merged = _csgUnion(merged, meshes[i], mat.clone());
    }
    // role:"cut" は 2D プロファイル段階で _profileToThreeShapesForView() が
    // 差し引き済み（押し出し前にキーホール輪郭化）。ここでの CSG 差し引きは不要。
    merged.material = mat;
    _3scene.add(merged);
    _3meshes.push(merged);
    added++;
  }

  if (!added) {
    return {
      ok: false,
      message: t("view3d.generateFailed"),
    };
  }

  return { ok: true, message: null };
}

function _viewAxis(viewType) {
  switch (viewType) {
    case "top":
    case "bottom":
      return "y";
    case "front":
    case "back":
      return "z";
    case "right":
    case "left":
      return "x";
    default:
      return "y";
  }
}

function _getPrimaryPartAxis(byType) {
  const count = (t) => byType[t]?.length || 0;
  if (count("top") + count("bottom") > 0) {
    return { axis: "y", viewTypes: new Set(["top", "bottom"]) };
  }
  if (count("front") + count("back") > 0) {
    return { axis: "z", viewTypes: new Set(["front", "back"]) };
  }
  if (count("right") + count("left") > 0) {
    return { axis: "x", viewTypes: new Set(["right", "left"]) };
  }
  return null;
}

function _inferSingleViewDepthMM() {
  const params = getState()?.partIntent?.params || {};
  const candidates = [
    params.T,
    params.t,
    params.thickness,
    params.thicknessMm,
    params.thickness_mm,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 2;
}

function _colorForShape(shape) {
  if (shape?.fill && shape.fill !== "none") return shape.fill;
  return "#5965f9";
}

function _makeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.35,
    metalness: 0.08,
  });
}

// 輪郭（profile）を 1 ビュー分スイープして Mesh 化する共通ルーチン。
function _buildMeshFromProfile(profile, page, viewType, dims, material, frame) {
  const sweepDepthFor = {
    top: dims.H,
    bottom: dims.H,
    front: dims.D,
    back: dims.D,
    right: dims.W,
    left: dims.W,
  };
  const sweepDepth = sweepDepthFor[viewType];
  const threeShapes = _profileToThreeShapesForView(
    profile,
    page,
    viewType,
    frame,
  );
  if (!threeShapes.length) return null;

  const geo = new THREE.ExtrudeGeometry(threeShapes, {
    depth: sweepDepth,
    bevelEnabled: false,
  });
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material.clone());
  _applyViewTransform(mesh, viewType);
  if (dims) _applyViewPosition(mesh, viewType, dims);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function _buildSingleShapeMesh(
  page,
  shape,
  ancestorGroups,
  viewType,
  dims,
  material,
  pageFrames,
) {
  const profile = shapeToProfile(shape, page.id, ancestorGroups);
  if (!profile) return null;
  return _buildMeshFromProfile(
    profile,
    page,
    viewType,
    dims,
    material,
    pageFrames?.get(page.id),
  );
}

// 共有 clamp volume を CSG 入力用に複製する。_csgIntersect は入力を dispose する
// ため、axisVolumes 内の volume 本体を渡すと後続パーツで使えなくなる。
// ワールド変換をジオメトリに焼き込み、変換なしの Mesh として返す。
function _cloneMeshForCsg(mesh, material) {
  if (!mesh?.geometry) return null;
  mesh.updateMatrixWorld(true);
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  const clone = new THREE.Mesh(geo, material);
  clone.updateMatrixWorld(true);
  return clone;
}

// 垂直線 x=rx と輪郭リング群の交点のうち最小の drawing y（=最上面）を返す。
function _ringTopAtX(rings, rx) {
  let minY = Infinity;
  for (const ring of rings || []) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      if (rx < Math.min(x1, x2) || rx > Math.max(x1, x2)) continue;
      if (x1 === x2) {
        minY = Math.min(minY, y1, y2);
      } else {
        const t = (rx - x1) / (x2 - x1);
        minY = Math.min(minY, y1 + t * (y2 - y1));
      }
    }
  }
  return Number.isFinite(minY) ? minY : null;
}

// 円 + solidIntersect: 直交ビューの輪郭を「回転体の母線」として解釈する。
// 直交ビューの交差ヴォールトは斜め方向の拘束が無く先端に耳が残るため、
// 回転対称な部品（丸頭ピン等）は revolve（LatheGeometry）で滑らかに生成する。
// 半径 u における上面高さ f(u) を直交ビューの 2D プロファイルから直接サンプリングし
// （_profileToThreeShapesForView の tx() と同じ座標対応）、その包絡線を軸まわりに
// 回転させる（正面図の丸キャップなら真の半球になる）。
// 現状はスイープ軸が Y（top/bottom 主ビュー）の場合のみ。失敗時は null を返し
// CSG 交差 → バンド近似へ順にフォールバックする。
function _buildPartMeshByRevolve(
  page,
  shape,
  ancestorGroups,
  viewType,
  color,
  mat,
  clampEntries,
  dims,
  pageFrames,
) {
  if (_viewAxis(viewType) !== "y") return null;

  // 円柱のワールド配置（中心・半径）は既存の押し出しパスで実測する
  const probe = _buildSingleShapeMesh(
    page,
    shape,
    ancestorGroups,
    viewType,
    dims,
    mat,
    pageFrames,
  );
  if (!probe) return null;
  const bb = new THREE.Box3().setFromObject(probe);
  _disposeMesh(probe);
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  const r = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2;
  if (!(r > 0)) return null;

  // バンド下端 lo はバンド近似と同じ規則（同色 volume 優先の bbox 範囲）
  let lo = -Infinity;
  let hi = Infinity;
  for (const entry of clampEntries) {
    const vol = entry.byColor?.get(color) || entry.any;
    const range = _worldRangeAlongAxis(vol, "y");
    if (!range) continue;
    lo = Math.max(lo, range[0]);
    hi = Math.min(hi, range[1]);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi - lo <= 1e-4) {
    return null;
  }

  // ビュー内ローカル mm（tx() の正規化と同じ向き）とワールド水平座標の相互変換。
  // front/back は world X、right/left は world Z が水平軸に対応する。
  function _viewHorizMaps(vt, fw) {
    switch (vt) {
      case "front":
        return { toLx: (h) => h, toWorld: (lx) => lx };
      case "back":
        return { toLx: (h) => fw - h, toWorld: (lx) => fw - lx };
      case "right":
        return { toLx: (h) => -h, toWorld: (lx) => -lx };
      case "left":
        return { toLx: (h) => fw + h, toWorld: (lx) => lx - fw };
      default:
        return null;
    }
  }

  // 1 軸ぶんの上面高さ（world Y）。同色プロファイルの union（max）。
  function axisTopAt(specs, horizWorld) {
    let best = null;
    for (const spec of specs || []) {
      for (const pg of spec.pages || []) {
        const frame = pageFrames?.get(pg.id);
        if (!frame) continue;
        const fw = _realToThreeMM(frame.bbox.w);
        const fh = _realToThreeMM(frame.bbox.h);
        const maps = _viewHorizMaps(spec.viewType, fw);
        if (!maps) continue;
        const lx = maps.toLx(horizWorld);
        if (lx < 0 || lx > fw) continue;
        const rawX = frame.bbox.x + lx * _REAL_PER_MM;
        for (const prof of frame.profiles || []) {
          const found = findShapeById(prof.sourceId);
          if (!found?.shape) continue;
          if (_colorForShape(found.shape) !== color) continue;
          const rawTop = _ringTopAtX(prof.rings, rawX);
          if (rawTop == null) continue;
          const yw = fh - _realToThreeMM(rawTop - frame.bbox.y);
          best = best == null ? yw : Math.max(best, yw);
        }
      }
    }
    return best;
  }

  // ピン直上にある同色プロファイル（=このピンの側面シルエット）の中心と半幅。
  // 手描き図面ではバーと円の中心が数百 µm ずれるため、母線はピン中心ではなく
  // バー自身の中心を基準にサンプリングする（ズレで母線が欠けて段差が出るのを防ぐ）。
  function axisBarCenter(specs, pinHoriz) {
    let best = null;
    for (const spec of specs || []) {
      for (const pg of spec.pages || []) {
        const frame = pageFrames?.get(pg.id);
        if (!frame) continue;
        const fw = _realToThreeMM(frame.bbox.w);
        const maps = _viewHorizMaps(spec.viewType, fw);
        if (!maps) continue;
        const lx = maps.toLx(pinHoriz);
        if (lx < 0 || lx > fw) continue;
        const rawX = frame.bbox.x + lx * _REAL_PER_MM;
        for (const prof of frame.profiles || []) {
          const found = findShapeById(prof.sourceId);
          if (!found?.shape) continue;
          if (_colorForShape(found.shape) !== color) continue;
          const bbMinX = prof.bbox.minX ?? prof.bbox.x;
          const bbMaxX = prof.bbox.maxX ?? prof.bbox.x + prof.bbox.w;
          if (rawX < bbMinX || rawX > bbMaxX) continue;
          const halfW = _realToThreeMM(bbMaxX - bbMinX) / 2;
          const centerLx = _realToThreeMM(
            (bbMinX + bbMaxX) / 2 - frame.bbox.x,
          );
          const center = maps.toWorld(centerLx);
          if (!best || halfW < best.halfW) best = { center, halfW };
        }
      }
    }
    return best;
  }

  const axisInfos = [];
  for (const entry of clampEntries) {
    const isZAxisEntry = entry.specs?.some(
      (s) => s.viewType === "front" || s.viewType === "back",
    );
    const bar = axisBarCenter(entry.specs, isZAxisEntry ? cx : cz);
    if (!bar) return null; // ピン直上に同色材料の無い軸がある → fallback
    axisInfos.push({ specs: entry.specs, bar });
  }
  if (!axisInfos.length) return null;

  // 母線: 底面 → 外周側壁 → 先端キャップ（u: r → 0）。
  // 各軸で ±u の min（非対称輪郭でも内側に収める）、軸間は min（ビュー交差）。
  // u はバー半幅にクランプ（円よりバーが僅かに細くても母線を欠けさせない）。
  const STEPS = 24;
  const points = [new THREE.Vector2(0, lo), new THREE.Vector2(r, lo)];
  let added = 0;
  for (let i = 0; i <= STEPS; i++) {
    const u = (r * (STEPS - i)) / STEPS;
    let f = Infinity;
    for (const { specs, bar } of axisInfos) {
      const uu = Math.min(u, Math.max(bar.halfW - 1e-3, 0));
      const probes = [
        axisTopAt(specs, bar.center + uu),
        axisTopAt(specs, bar.center - uu),
      ].filter((v) => v != null);
      if (!probes.length) {
        f = null;
        break;
      }
      f = Math.min(f, ...probes);
    }
    if (f == null) continue;
    points.push(new THREE.Vector2(u, Math.max(lo, Math.min(f, hi))));
    added++;
  }
  if (!added) return null;

  const geo = new THREE.LatheGeometry(points, 48);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat.clone());
  mesh.position.set(cx, 0, cz);
  mesh.updateMatrixWorld(true);
  return { mesh, color };
}

// 案A（opt-in）: フットプリント押し出しを直交ビューの volume と実際に CSG 交差し、
// 丸頭など「高さが面内で変化する」輪郭を 3D に反映する。
// 交差が空・失敗時は null を返し、呼び出し側がバンド近似へフォールバックする。
function _buildPartMeshBySolidIntersect(
  page,
  shape,
  ancestorGroups,
  viewType,
  color,
  mat,
  clampEntries,
  dims,
  pageFrames,
) {
  let mesh = _buildSingleShapeMesh(
    page,
    shape,
    ancestorGroups,
    viewType,
    dims,
    mat,
    pageFrames,
  );
  if (!mesh) return null;
  for (const entry of clampEntries) {
    const vol = entry.byColor?.get(color) || entry.any;
    const clamp = _cloneMeshForCsg(vol, mat.clone());
    if (!clamp) continue;
    mesh = _csgIntersect(mesh, clamp, mat.clone());
    if (!mesh || !_meshHasGeometry(mesh)) {
      _disposeMesh(mesh);
      return null;
    }
  }
  mesh.material = mat.clone();
  return { mesh, color };
}

function _buildPartMesh(
  page,
  shape,
  ancestorGroups,
  axisVolumes,
  dims,
  pageFrames,
) {
  const viewType = _normalizeViewType(page.viewDefinition?.type);
  const axis = _viewAxis(viewType); // パーツの押し出し（スイープ）軸
  const color = _colorForShape(shape);
  const mat = _makeMaterial(color);

  // 直交ビュー（front/right 等）が定めるスイープ軸方向の範囲 [lo,hi] を求める。
  // 同色の clamp volume を優先（色＝積層レイヤー）、無ければ any にフォールバック。
  const clampEntries = [];
  if (axis !== "y" && axisVolumes.y) clampEntries.push(axisVolumes.y);
  if (axis !== "z" && axisVolumes.z) clampEntries.push(axisVolumes.z);
  if (axis !== "x" && axisVolumes.x) clampEntries.push(axisVolumes.x);

  // 案A: shape.solidIntersect === true の部品だけ、直交ビューの輪郭（丸頭など）を
  // 3D に反映する。円は回転体（滑らかなドーム）、それ以外は真の CSG 交差。
  // 既定はバンド bbox 近似（後段）のままで挙動を変えない。
  if (shape.solidIntersect) {
    if (shape.type === "circle") {
      const revolved = _buildPartMeshByRevolve(
        page,
        shape,
        ancestorGroups,
        viewType,
        color,
        mat,
        clampEntries,
        dims,
        pageFrames,
      );
      if (revolved) return revolved;
    }
    const solid = _buildPartMeshBySolidIntersect(
      page,
      shape,
      ancestorGroups,
      viewType,
      color,
      mat,
      clampEntries,
      dims,
      pageFrames,
    );
    if (solid) return solid;
    // 交差が空 / 失敗した場合はバンド近似へフォールバック。
  }

  let lo = -Infinity;
  let hi = Infinity;
  for (const entry of clampEntries) {
    const vol = entry.byColor?.get(color) || entry.any;
    const r = _worldRangeAlongAxis(vol, axis);
    if (!r) continue;
    lo = Math.max(lo, r[0]);
    hi = Math.min(hi, r[1]);
  }
  const hasBand = Number.isFinite(lo) && Number.isFinite(hi) && hi - lo > 1e-4;

  // フットプリント（このビューの輪郭）を、求めたバンドぶんだけ直接押し出して配置する。
  // CSG 交差を使わないため、コーム/スロット等の複雑な輪郭でも面落ちしない。
  // 注: 直交ビューが矩形でない（高さが面内で変化する）場合はバンド bbox 近似になる。
  const sweepDimKey = { y: "H", z: "D", x: "W" }[axis];
  const partDims = hasBand ? { ...dims, [sweepDimKey]: hi - lo } : dims;
  const mesh = _buildSingleShapeMesh(
    page,
    shape,
    ancestorGroups,
    viewType,
    partDims,
    mat,
    pageFrames,
  );
  if (!mesh) return null;

  if (hasBand) {
    // 実際のワールド最小値を lo に合わせ、スイープ軸方向へ平行移動。
    const cur = _worldRangeAlongAxis(mesh, axis);
    if (cur) {
      mesh.position[axis] += lo - cur[0];
      mesh.updateMatrixWorld(true);
    }
  }
  mesh.material = mat.clone();
  return { mesh, color };
}

function _buildSingleViewExtrusionScene(byType, dims, pageFrames) {
  const primary = _getPrimaryPartAxis(byType);
  if (!primary) {
    return {
      ok: false,
      message: t("view3d.needViews"),
    };
  }

  const viewType = [...primary.viewTypes].find((type) => byType[type]?.length);
  const pages = byType[viewType] || [];
  const depth = Math.max(0.1, _inferSingleViewDepthMM());
  const singleDims = { ...dims };
  if (primary.axis === "y") singleDims.H = depth;
  if (primary.axis === "z") singleDims.D = depth;
  if (primary.axis === "x") singleDims.W = depth;

  const byColor = new Map();
  for (const page of pages) {
    const entries =
      typeof getProfileEntriesFromPage === "function"
        ? getProfileEntriesFromPage(page)
        : [...iterProfileSourcesFromPage(page)]
            .map(({ shape, ancestorGroups }) => ({
              shape,
              ancestorGroups,
              profile: shapeToProfile(shape, page.id, ancestorGroups),
            }))
            .filter((entry) => entry.profile);
    for (const { shape, profile } of entries) {
      if (shape.type === "line" || shape.type === "text") continue;
      const color = _colorForShape(shape);
      const mat = _makeMaterial(color);
      const mesh = _buildMeshFromProfile(
        profile,
        page,
        viewType,
        singleDims,
        mat,
        pageFrames?.get(page.id),
      );
      if (!mesh) continue;
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color).push(mesh);
    }
  }

  let added = 0;
  for (const [color, meshes] of byColor) {
    let merged = meshes[0];
    const mat = _makeMaterial(color);
    for (let i = 1; i < meshes.length; i++) {
      merged = _csgUnion(merged, meshes[i], mat.clone());
    }
    merged.material = mat;
    _3scene.add(merged);
    _3meshes.push(merged);
    added++;
  }

  if (!added) {
    return {
      ok: false,
      message: t("view3d.needClosedProfiles"),
    };
  }

  return { ok: true, message: null };
}

function _buildPageUnionMesh(page, sweepDepth, viewType, dims, pageFrames) {
  const mat = _makeMaterial("#5965f9");

  let unionMesh = null;
  const entries =
    typeof getProfileEntriesFromPage === "function"
      ? getProfileEntriesFromPage(page)
      : [...iterProfileSourcesFromPage(page)]
          .map(({ shape, ancestorGroups }) => ({
            shape,
            ancestorGroups,
            profile: shapeToProfile(shape, page.id, ancestorGroups),
          }))
          .filter((entry) => entry.profile);
  for (const { shape, profile } of entries) {
    if (shape.type === "line" || shape.type === "text") continue;
    const mesh = _buildMeshFromProfile(
      profile,
      page,
      viewType,
      dims,
      mat,
      pageFrames?.get(page.id),
    );
    if (!mesh) continue;

    if (!unionMesh) {
      unionMesh = mesh;
    } else {
      unionMesh = _csgUnion(unionMesh, mesh, mat.clone());
    }
  }
  return unionMesh;
}

function _resolve3DColor() {
  const counts = {};
  for (const page of getState().pages) {
    for (const { shape } of iterProfileSourcesFromPage(page)) {
      if (shape.type === "line" || shape.type === "text") continue;
      if (shape.fill && shape.fill !== "none") {
        counts[shape.fill] = (counts[shape.fill] || 0) + 1;
      }
    }
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || "#5965f9";
}

// ── 公開エントリポイント ──────────────────────────────────────
function cancelScheduledUpdate3DScene() {
  if (_update3dTimer == null) return;
  clearTimeout(_update3dTimer);
  _update3dTimer = null;
}

/** 図面編集中の連続 render / UI 更新後の 3D 再生成向け。 */
function scheduleUpdate3DScene(delayMs = UPDATE3D_DEBOUNCE_MS) {
  if (!_3scene) return;
  cancelScheduledUpdate3DScene();
  _update3dTimer = setTimeout(
    () => {
      _update3dTimer = null;
      requestAnimationFrame(() => update3DScene());
    },
    Math.max(0, delayMs),
  );
}

function update3DScene() {
  cancelScheduledUpdate3DScene();
  if (!_3scene) return;
  _3modelPipelineDirty = true;

  for (const m of _3meshes) {
    _3scene.remove(m);
    _disposeMesh(m);
  }
  _3meshes = [];

  let result;
  try {
    result = _build3DSceneFromViews();
  } catch (e) {
    console.warn("[3D] update failed:", e);
    result = { ok: false, message: e?.message || t("view3d.generateFailed") };
  }
  _3dStatus = {
    meshCount: _3meshes.length,
    message: result?.message ?? null,
  };
  _sync3DEmptyOverlay(_3dStatus.message);

  if (_3meshes.length) {
    const box = new THREE.Box3();
    for (const mesh of _3meshes) {
      mesh.updateMatrixWorld(true);
      box.union(new THREE.Box3().setFromObject(mesh));
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const offset = new THREE.Vector3(center.x, box.min.y, center.z);
    for (const mesh of _3meshes) mesh.position.sub(offset);
    _3controls?.target.set(0, (box.max.y - box.min.y) / 2, 0);
  }
}

// ── STL export ────────────────────────────────────────────────
function exportSTL() {
  update3DScene();
  const validation = validateMeshesForExport(_3meshes);
  if (!validation.ok) {
    alert(validation.message);
    return;
  }
  if (validation.message) {
    const proceed = confirm(
      t("view3d.stlWarningConfirm", { message: validation.message }),
    );
    if (!proceed) return;
  }

  const exporter = new THREE.STLExporter();
  const group = new THREE.Group();
  const clones = [];
  for (const m of _3meshes) {
    const clone = m.clone();
    clones.push(clone);
    group.add(clone);
  }
  const stl = exporter.parse(group, { binary: false });
  for (const clone of clones) _disposeMesh(clone);
  const blob = new Blob([stl], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download =
    (document.getElementById("project-name")?.value || "model") + ".stl";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
