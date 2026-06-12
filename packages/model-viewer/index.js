"use strict";

(function initModelViewer(root, factory) {
  const api = factory(root?.THREE);
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MillrectModelViewer = api;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : null,
  function factory(THREE) {
    function createGeometry(meshData, materialOverride) {
      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      for (const face of meshData.faces || []) {
        for (const index of face) {
          const vertex = meshData.vertices[index];
          if (!vertex) continue;
          vertices.push(vertex[0], vertex[1], vertex[2]);
        }
      }
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.computeVertexNormals();
      return new THREE.Mesh(
        geometry,
        materialOverride ||
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(meshData.material?.color || "#5965f9"),
            roughness: 0.38,
            metalness: 0.04,
          }),
      );
    }

    function createModelViewer(canvas, options = {}) {
      if (!THREE) throw new Error("Three.js is required for model-viewer");

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(options.background || "#20242c");
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
      camera.position.set(140, 100, 140);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(90, 130, 80);
      scene.add(key);
      const grid = new THREE.GridHelper(240, 24, 0x3d4450, 0x313741);
      grid.position.y = -0.02;
      scene.add(grid);

      const controls =
        typeof THREE.OrbitControls === "function"
          ? new THREE.OrbitControls(camera, renderer.domElement)
          : null;
      if (controls) {
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
      }

      const modelGroup = new THREE.Group();
      scene.add(modelGroup);
      let frame = null;
      const _sizeScratch = new THREE.Vector2();

      function resize() {
        const width = canvas.clientWidth || 480;
        const height = canvas.clientHeight || 320;
        const size = renderer.getSize(_sizeScratch);
        if (size.x !== width || size.y !== height) {
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
      }

      function clear() {
        while (modelGroup.children.length) {
          const child = modelGroup.children.pop();
          child.geometry?.dispose();
          child.material?.dispose?.();
        }
      }

      function frameObject() {
        if (!modelGroup.children.length) return;
        const box = new THREE.Box3().setFromObject(modelGroup);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const radius = Math.max(size.x, size.y, size.z, 1);
        camera.position.set(
          center.x + radius * 1.2,
          center.y + radius * 0.9,
          center.z + radius * 1.2,
        );
        camera.lookAt(center);
        controls?.target.copy(center);
        controls?.update();
      }

      function setGeometryData(data) {
        clear();
        for (const meshData of data?.meshes || []) {
          modelGroup.add(createGeometry(meshData));
        }
        frameObject();
      }

      function renderLoop() {
        frame = globalThis.requestAnimationFrame(renderLoop);
        resize();
        controls?.update();
        renderer.render(scene, camera);
      }

      renderLoop();

      function dispose() {
        if (frame) globalThis.cancelAnimationFrame(frame);
        clear();
        controls?.dispose?.();
        renderer.dispose();
      }

      return {
        scene,
        camera,
        renderer,
        setGeometryData,
        resize,
        dispose,
      };
    }

    return {
      createGeometry,
      createModelViewer,
    };
  },
);
