// app.js — Bootstrap & two-phase AR flow
// HIDDEN Exhibition · AR Point Cloud Experience
//
// Phase 0: Load point cloud
// Phase 1: AR.js detects custom marker (confirms user is at correct spot)
// Phase 2: WebXR immersive-ar session with hit-test (world-tracked tree)

import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadPointCloud } from './point-cloud-loader.js';
import { waitForMarkerDetection } from './marker-tracking.js';
import {
  isWebXRSupported,
  startWebXRSession,
  stopHitTest,
  requestWakeLock,
} from './webxr-session.js';

console.log('[HIDDEN] AR app initialising');

const TREE_PLY_URL = 'assets/St_John_Tree_point_cloud_niagara_yup_green_4k_points.ply';
const TREE_FOOTPRINT_M = 2.0; // tree base always fills 2 × 2 m (real-world metres)

let scene, camera, renderer;
let treeData = null;
let treePlaced = false;

// --- UI helpers ---
const ui = {
  overlay: () => document.getElementById('loading-overlay'),
  loadingText: () => document.getElementById('loading-text'),
  arOverlay: () => document.getElementById('ar-overlay'),
  arStatus: () => document.getElementById('ar-status'),
  startBtn: () => document.getElementById('ar-start-btn'),
  fallback: () => document.getElementById('fallback-message'),
};

function setLoadingText(msg) {
  const el = ui.loadingText();
  if (el) el.textContent = msg;
}

function setArStatus(msg) {
  const el = ui.arStatus();
  if (el) el.textContent = msg;
}

// ─────────────────────────────────────────────
// Phase 0: Load assets
// ─────────────────────────────────────────────
async function loadAssets() {
  setLoadingText('Loading point cloud…');
  const t0 = performance.now();

  treeData = await loadPointCloud(TREE_PLY_URL, {
    footprint: TREE_FOOTPRINT_M,
    pointSize: 0.012,
    onProgress: (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(Math.round((event.loaded / event.total) * 100), 99);
        setLoadingText(`Loading point cloud… ${pct}%`);
      } else if (event.loaded) {
        const mb = (event.loaded / (1024 * 1024)).toFixed(1);
        setLoadingText(`Loading point cloud… ${mb} MB`);
      }
    },
  });

  const dt = performance.now() - t0;
  console.log(`[HIDDEN] Point cloud loaded in ${dt.toFixed(0)}ms`);
}

// ─────────────────────────────────────────────
// Phase 1: AR.js marker detection
// ─────────────────────────────────────────────
async function detectMarker() {
  // Hide opaque loading overlay so camera feed is visible
  const overlay = ui.overlay();
  if (overlay) overlay.classList.add('hidden');

  // Show transparent AR overlay with prompt on top of video
  const arOverlay = ui.arOverlay();
  if (arOverlay) arOverlay.classList.remove('hidden');
  setArStatus('Point camera at the floor marker');

  console.log('[HIDDEN] Phase 1: waiting for marker…');
  await waitForMarkerDetection(renderer);
  console.log('[HIDDEN] Phase 1 complete: marker detected');
}

// ─────────────────────────────────────────────
// Phase 2: WebXR world-tracked session
// ─────────────────────────────────────────────
/**
 * Wait for user to tap the 'Enter AR' button.
 * This tap provides the user gesture required by Chrome for requestSession.
 * Returns a Promise that resolves when the button is tapped.
 */
function waitForUserTapAndStartAR() {
  return new Promise((resolve) => {
    setArStatus('Marker found!');
    const btn = ui.startBtn();
    if (!btn) { resolve(); return; }
    btn.classList.remove('hidden');
    btn.addEventListener('click', async () => {
      btn.classList.add('hidden');
      btn.disabled = true;

      // IMPORTANT: keep requestSession call in this click task to preserve
      // Chrome's transient user activation requirement for immersive-ar.
      try {
        await startWorldAR();
      } catch (err) {
        console.error('[HIDDEN] WebXR failed:', err);
        setArStatus('AR start failed — showing fallback');
        startFallbackMode();
      } finally {
        resolve();
      }
    }, { once: true });
  });
}

async function startWorldAR() {
  console.log('[HIDDEN] Phase 2: starting WebXR…');
  setArStatus('Starting AR…');

  let hitCount = 0;
  const REQUIRED_HITS = 3; // require a few stable hits before placing

  await startWebXRSession(renderer, scene, camera, {
    onHitTest: (hitPose) => {
      if (treePlaced) return;

      if (hitPose) {
        hitCount++;
        setArStatus('Floor detected — placing tree…');

        if (hitCount >= REQUIRED_HITS) {
          placeTree(hitPose);
        }
      } else {
        hitCount = 0;
        setArStatus('Scanning floor…');
      }
    },
    onSessionEnd: () => {
      console.log('[HIDDEN] WebXR session ended');
    },
  });

  // Request wake lock to prevent screen dimming
  await requestWakeLock();
}

// ─────────────────────────────────────────────
// Place tree at hit-test position
// ─────────────────────────────────────────────
function placeTree(hitPose) {
  if (treePlaced || !treeData) return;
  treePlaced = true;

  const { points } = treeData;

  // Position at hit-test location (floor surface)
  points.position.set(
    hitPose.position.x,
    hitPose.position.y,
    hitPose.position.z
  );

  // Apply floor orientation (align Y-up with surface normal)
  const q = new THREE.Quaternion(
    hitPose.orientation.x,
    hitPose.orientation.y,
    hitPose.orientation.z,
    hitPose.orientation.w
  );
  points.quaternion.copy(q);

  scene.add(points);

  // Stop hit-testing — tree is placed
  stopHitTest();

  // Fade out AR status
  setArStatus('');
  setTimeout(() => {
    const arOverlay = ui.arOverlay();
    if (arOverlay) arOverlay.classList.add('hidden');
  }, 1000);

  console.log(`[HIDDEN] ✓ Tree placed at (${hitPose.position.x.toFixed(2)}, ${hitPose.position.y.toFixed(2)}, ${hitPose.position.z.toFixed(2)})`);
}

// ─────────────────────────────────────────────
// Fallback: AR.js-only mode (no WebXR)
// ─────────────────────────────────────────────
function startFallbackMode() {
  console.log('[HIDDEN] Fallback: no WebXR, using 3D viewer');
  // Hide all overlays
  const overlay = ui.overlay();
  if (overlay) overlay.classList.add('hidden');
  const arOverlay = ui.arOverlay();
  if (arOverlay) arOverlay.classList.add('hidden');

  if (treeData) {
    treeData.points.position.set(0, 0, -3);
    scene.add(treeData.points);
  }

  // Simple render loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

// ─────────────────────────────────────────────
// Main init
// ─────────────────────────────────────────────
async function init() {
  console.log('[HIDDEN] init()');

  // Create Three.js scene (XR-ready)
  const sceneObjects = createScene();
  scene = sceneObjects.scene;
  camera = sceneObjects.camera;
  renderer = sceneObjects.renderer;

  // Phase 0: Load point cloud
  try {
    await loadAssets();
    setLoadingText('Assets loaded ✓');
  } catch (err) {
    console.error('[HIDDEN] Asset load failed:', err);
    setLoadingText('Failed to load assets');
    return;
  }

  // Check WebXR support
  const webxrOK = await isWebXRSupported();
  console.log(`[HIDDEN] WebXR supported: ${webxrOK}`);

  if (!webxrOK) {
    // No WebXR — fallback to simple 3D viewer
    startFallbackMode();
    return;
  }

  // Phase 1: AR.js marker detection
  try {
    await detectMarker();
  } catch (err) {
    console.warn('[HIDDEN] Marker detection failed, skipping to WebXR:', err);
  }

  // User gesture gate — WebXR requestSession requires a tap on Chrome Android.
  // We start Phase 2 directly inside the click handler to preserve activation.
  await waitForUserTapAndStartAR();
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
