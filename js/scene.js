// scene.js — Three.js scene, camera, renderer
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

/**
 * Create and return the core Three.js objects.
 * Renderer is XR-ready; camera is managed by WebXR during Phase 2.
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer }}
 */
export function createScene() {
  const scene = new THREE.Scene();

  // Camera — WebXR overrides projection + view matrices in AR mode
  // Fallback position for non-AR / AR.js Phase 1
  const camera = new THREE.PerspectiveCamera(
    71,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0, 1.0, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // XR is NOT enabled here — app.js enables it only when entering Phase 2 (WebXR).
  // Enabling it too early interferes with normal canvas rendering during Phase 1.
  renderer.setClearColor(0x000000, 0); // transparent background so AR.js video shows through
  document.body.appendChild(renderer.domElement);

  // Resize handler (only applies outside XR session)
  window.addEventListener('resize', () => {
    if (!renderer.xr.isPresenting) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });

  return { scene, camera, renderer };
}

/**
 * Dispose of all scene resources.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 */
export function disposeScene(renderer, scene) {
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  renderer.dispose();
}
