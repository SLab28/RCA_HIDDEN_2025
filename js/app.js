// app.js — Bootstrap & AR session init
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { createScene } from './scene.js';
import { initMarkerTracking, updateAR } from './marker-tracking.js';
import { loadPointCloud } from './point-cloud-loader.js';

// Future imports will be added as tasks progress:
// import { initTouchInteraction } from './touch-interaction.js';
// import { initAudioFlock } from './audio-flock.js';
// import { initDissolve } from './dissolve.js';

console.log('[HIDDEN] AR app initialising');

const TREE_PLY_URL = 'assets/St_John_Tree_point_cloud_niagara_yup_green_4k_points.ply';

let scene, camera, renderer;
let anchorGroup;
let treeData = null; // { points, originalPositions, geometry }

async function init() {
  console.log('[HIDDEN] init() called');

  const overlay = document.getElementById('loading-overlay');
  const loadingText = overlay ? overlay.querySelector('p') : null;

  // Create Three.js scene
  const sceneObjects = createScene();
  scene = sceneObjects.scene;
  camera = sceneObjects.camera;
  renderer = sceneObjects.renderer;

  // Initialise AR marker tracking
  try {
    const ar = await initMarkerTracking(scene, camera, renderer);
    anchorGroup = ar.anchorGroup;
    console.log('[HIDDEN] AR marker tracking ready');
  } catch (err) {
    console.warn('[HIDDEN] AR init failed, falling back to 3D viewer:', err);
    anchorGroup = new THREE.Group();
    scene.add(anchorGroup);
  }

  // Load tree point cloud
  if (loadingText) loadingText.textContent = 'Loading point cloud…';
  try {
    const t0 = performance.now();
    treeData = await loadPointCloud(TREE_PLY_URL, anchorGroup, {
      footprint: 2,
      pointSize: 0.008,
      onProgress: (event) => {
        if (event.lengthComputable && loadingText) {
          const pct = Math.round((event.loaded / event.total) * 100);
          loadingText.textContent = `Loading point cloud… ${pct}%`;
        }
      },
    });
    const dt = performance.now() - t0;
    console.log(`[HIDDEN] Tree loaded in ${dt.toFixed(0)}ms`);
  } catch (err) {
    console.error('[HIDDEN] Failed to load point cloud:', err);
  }

  // Hide loading overlay
  if (overlay) {
    overlay.classList.add('hidden');
  }

  console.log('[HIDDEN] Scene ready — starting animation loop');

  // Start render loop
  animate();
}

function animate() {
  requestAnimationFrame(animate);

  // Update AR tracking each frame
  updateAR();

  renderer.render(scene, camera);
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
