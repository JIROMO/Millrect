/**
 * csg-three-adapter.js
 * Thin adapter between csg.js (Evan Wallace) and Three.js BufferGeometry.
 * Depends on: csg.js (must be loaded first), THREE (global)
 */
"use strict";

const CSGAdapter = {
  /**
   * Convert a THREE.Mesh (with world matrix applied) to CSG solid.
   * The mesh geometry must be a BufferGeometry with indexed or non-indexed triangles.
   */
  fromMesh(mesh) {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry;
    const pos = geom.attributes.position;
    const index = geom.index;
    const mat = mesh.matrixWorld;

    const polygons = [];
    const triCount = index ? index.count / 3 : pos.count / 3;

    for (let i = 0; i < triCount; i++) {
      const verts = [];
      for (let j = 0; j < 3; j++) {
        const vi = index ? index.getX(i * 3 + j) : i * 3 + j;
        const x = pos.getX(vi);
        const y = pos.getY(vi);
        const z = pos.getZ(vi);
        const v = new THREE.Vector3(x, y, z).applyMatrix4(mat);
        verts.push(
          new CSG.Vertex(
            new CSG.Vector(v.x, v.y, v.z),
            new CSG.Vector(0, 1, 0),
          ),
        );
      }
      // Skip degenerate triangles
      const ab = new THREE.Vector3().subVectors(
        new THREE.Vector3(verts[1].pos.x, verts[1].pos.y, verts[1].pos.z),
        new THREE.Vector3(verts[0].pos.x, verts[0].pos.y, verts[0].pos.z),
      );
      const ac = new THREE.Vector3().subVectors(
        new THREE.Vector3(verts[2].pos.x, verts[2].pos.y, verts[2].pos.z),
        new THREE.Vector3(verts[0].pos.x, verts[0].pos.y, verts[0].pos.z),
      );
      if (ab.cross(ac).lengthSq() < 1e-20) continue;
      polygons.push(new CSG.Polygon(verts));
    }
    return CSG.fromPolygons(polygons);
  },

  /**
   * Convert CSG solid back to a THREE.BufferGeometry (world-space coords).
   */
  toGeometry(csg) {
    const polys = csg.polygons;
    const positions = [];
    const normals = [];

    for (const poly of polys) {
      const vs = poly.vertices;
      const n = poly.plane.normal;
      // Fan triangulation
      for (let i = 2; i < vs.length; i++) {
        for (const v of [vs[0], vs[i - 1], vs[i]]) {
          positions.push(v.pos.x, v.pos.y, v.pos.z);
          normals.push(n.x, n.y, n.z);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(positions), 3),
    );
    geom.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(normals), 3),
    );
    geom.computeBoundingSphere();
    return geom;
  },

  /**
   * Perform CSG intersection of two THREE.Mesh objects.
   * Returns a new THREE.Mesh (world-space, no additional transform).
   */
  intersect(meshA, meshB, material) {
    const csgA = CSGAdapter.fromMesh(meshA);
    const csgB = CSGAdapter.fromMesh(meshB);
    const result = csgA.intersect(csgB);
    const geom = CSGAdapter.toGeometry(result);
    const mat = material || meshA.material.clone();
    return new THREE.Mesh(geom, mat);
  },

  /**
   * Perform CSG union of two THREE.Mesh objects.
   */
  union(meshA, meshB, material) {
    const csgA = CSGAdapter.fromMesh(meshA);
    const csgB = CSGAdapter.fromMesh(meshB);
    const result = csgA.union(csgB);
    const geom = CSGAdapter.toGeometry(result);
    const mat = material || meshA.material.clone();
    return new THREE.Mesh(geom, mat);
  },

  /**
   * Perform CSG subtraction (meshA − meshB) of two THREE.Mesh objects.
   */
  subtract(meshA, meshB, material) {
    const csgA = CSGAdapter.fromMesh(meshA);
    const csgB = CSGAdapter.fromMesh(meshB);
    const result = csgA.subtract(csgB);
    const geom = CSGAdapter.toGeometry(result);
    const mat = material || meshA.material.clone();
    return new THREE.Mesh(geom, mat);
  },
};
