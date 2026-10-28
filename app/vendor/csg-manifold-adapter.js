/**
 * csg-manifold-adapter.js
 * CSGAdapter（csg.js / BSP）と同じ API を manifold-3d（WASM）で提供するアダプタ。
 * Depends on: THREE (global), CSGAdapter（フォールバック用）
 *
 * 使い方: manifold-3d の Module を初期化してから ManifoldCSG.init(wasm) を呼ぶ。
 * 未初期化・入力が manifold にならない・WASM 例外のときは CSGAdapter にフォールバックする。
 */
"use strict";

const ManifoldCSG = {
  wasm: null,
  stats: { ops: 0, fallbacks: 0 },

  init(wasm) {
    wasm.setup?.();
    this.wasm = wasm;
  },

  get ready() {
    return !!this.wasm;
  },

  /**
   * THREE.Mesh（ワールド変換を焼き込み）→ Manifold。
   * ExtrudeGeometry は面ごとに頂点が分かれているので位置で溶接してから渡す。
   */
  fromMesh(mesh) {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const index = geom.index;
    const e = mesh.matrixWorld.elements;
    const triCount = index ? index.count / 3 : pos.count / 3;

    const keyToVert = new Map();
    const verts = [];
    const tris = [];
    const q = 1e5; // 1e-5 単位で量子化（mm 座標想定）
    const corner = new Array(3);
    for (let i = 0; i < triCount; i++) {
      for (let j = 0; j < 3; j++) {
        const vi = index ? index.getX(i * 3 + j) : i * 3 + j;
        const x0 = pos.getX(vi),
          y0 = pos.getY(vi),
          z0 = pos.getZ(vi);
        const x = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
        const y = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
        const z = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
        const key =
          Math.round(x * q) + "," + Math.round(y * q) + "," + Math.round(z * q);
        let id = keyToVert.get(key);
        if (id === undefined) {
          id = verts.length / 3;
          keyToVert.set(key, id);
          verts.push(x, y, z);
        }
        corner[j] = id;
      }
      if (corner[0] === corner[1] || corner[1] === corner[2]) continue;
      if (corner[0] === corner[2]) continue;
      tris.push(corner[0], corner[1], corner[2]);
    }

    const { Manifold, Mesh } = this.wasm;
    const m = new Mesh({
      numProp: 3,
      vertProperties: new Float32Array(verts),
      triVerts: new Uint32Array(tris),
    });
    m.merge();
    return new Manifold(m);
  },

  /** Manifold → 非 indexed の BufferGeometry（CSGAdapter.toGeometry と同じ形式） */
  toGeometry(manifold) {
    const mesh = manifold.getMesh();
    const { numProp, vertProperties: vp, triVerts: tv } = mesh;
    const positions = new Float32Array(tv.length * 3);
    for (let i = 0; i < tv.length; i++) {
      const o = tv[i] * numProp;
      positions[i * 3] = vp[o];
      positions[i * 3 + 1] = vp[o + 1];
      positions[i * 3 + 2] = vp[o + 2];
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    return geom;
  },

  // name: CSGAdapter 側のメソッド名 / op: Manifold 側のメソッド名
  _op(name, op, meshA, meshB, material) {
    if (!this.wasm) return CSGAdapter[name](meshA, meshB, material);
    this.stats.ops++;
    let a = null,
      b = null,
      r = null;
    try {
      a = this.fromMesh(meshA);
      b = this.fromMesh(meshB);
      r = a[op](b);
      const geom = this.toGeometry(r);
      return new THREE.Mesh(geom, material || meshA.material.clone());
    } catch (e) {
      this.stats.fallbacks++;
      console.warn(`[3D] manifold ${op} failed, falling back to BSP:`, e);
      return CSGAdapter[name](meshA, meshB, material);
    } finally {
      // WASM ヒープ上のオブジェクトは GC されないので明示的に解放する
      a?.delete();
      b?.delete();
      r?.delete();
    }
  },

  intersect(meshA, meshB, material) {
    return this._op("intersect", "intersect", meshA, meshB, material);
  },

  union(meshA, meshB, material) {
    return this._op("union", "add", meshA, meshB, material);
  },

  subtract(meshA, meshB, material) {
    return this._op("subtract", "subtract", meshA, meshB, material);
  },
};
