// app.js — Bootstrap & AR session init
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { createScene } from './scene.js';

// Future imports will be added as tasks progress:
// import { initMarkerTracking } from './marker-tracking.js';
// import { loadPointCloud } from './point-cloud-loader.js';
// import { initTouchInteraction } from './touch-interaction.js';
// import { initAudioFlock } from './audio-flock.js';
// import { initDissolve } from './dissolve.js';

console.log('[HIDDEN] AR app initialising');

let scene, camera, renderer;
let testCube;

function init() {
  console.log('[HIDDEN] init() called');

  // Create Three.js scene
  const sceneObjects = createScene();
  scene = sceneObjects.scene;
  camera = sceneObjects.camera;
  renderer = sceneObjects.renderer;

  // Test cube — will be removed after Task 2 verification
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshNormalMaterial();
  testCube = new THREE.Mesh(geometry, material);
  testCube.position.set(0, 0.5, 0);
  scene.add(testCube);

  // Hide loading overlay
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  console.log('[HIDDEN] Scene ready — starting animation loop');

  // Start render loop
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  // Rotate test cube
  if (testCube) {
    testCube.rotation.x += 0.01;
    testCube.rotation.y += 0.015;
  }

  renderer.render(scene, camera);
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
