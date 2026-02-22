// app.js — Bootstrap & two-phase AR flow
// HIDDEN Exhibition · AR Point Cloud Experience
//
// Phase 0: Load point cloud
// Phase 1: AR.js detects custom marker (confirms user is at correct spot)
// Phase 2: WebXR immersive-ar session with hit-test (world-tracked tree)

import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadPointCloud } from './point-cloud-loader.js';
import { startMarkerTracking, waitForMarkerDetection } from './marker-tracking.js';
import {
  isWebXRSupported,
  startWebXRSession,
  stopHitTest,
  requestWakeLock,
} from './webxr-session.js';
import { FloatingAnimation } from './floating-animation.js';

console.log('[HIDDEN] AR app initialising');

const TREE_PLY_URL = 'assets/St_John_Tree_point_cloud_niagara_yup_green_4k_points.ply';
const TREE_FOOTPRINT_M = 2.0; // tree base always fills 2 × 2 m (real-world metres)

const MODE = new URLSearchParams(window.location.search).get('mode') || 'auto';

let scene, camera, renderer;
let treeData = null;
let treePlaced = false;
let floatingAnimation = null;

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

function initModeToggle(runningMode, webxrSupported) {
  const btn = document.getElementById('mode-toggle-btn');
  if (!btn) return;

  btn.textContent = runningMode === 'marker' ? 'Marker' : 'WebXR';

  if (!webxrSupported) {
    btn.title = 'WebXR immersive-ar not supported on this device';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.onclick = null;
    return;
  }

  btn.disabled = false;
  btn.style.opacity = '1';
  btn.title = '';

  btn.onclick = () => {
    const next = runningMode === 'marker' ? 'webxr' : 'marker';
    const url = new URL(window.location.href);
    url.searchParams.set('mode', next);
    window.location.href = url.toString();
  };
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
// Phase 2: WebXR world-tracked session (reticle + tap-to-place)
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
        console.error('[HIDDEN] Error name:', err.name);
        console.error('[HIDDEN] Error message:', err.message);
        console.error('[HIDDEN] Error stack:', err.stack);
        setArStatus('WebXR failed: ' + (err.message || err.name || 'Unknown error'));
        // Don't fallback - just show error
      } finally {
        resolve();
      }
    }, { once: true });
  });
}

async function startWorldAR() {
  console.log('[HIDDEN] Starting WebXR…');
  setArStatus('Starting AR…');

  // Reset tree state for clean WebXR session
  treePlaced = false;
  if (treeData && treeData.points) {
    const wasInScene = scene.children.includes(treeData.points);
    if (wasInScene) {
      scene.remove(treeData.points);
      console.log('[HIDDEN] Removed existing tree from scene before WebXR');
    }
    // Reset tree position to origin
    treeData.points.position.set(0, 0, 0);
    treeData.points.quaternion.set(0, 0, 0, 1);
    treeData.points.scale.set(1, 1, 1);
    console.log('[HIDDEN] Reset tree transform for WebXR');
  }

  await startWebXRSession(renderer, scene, camera, {
    onPlace: (hitPose) => {
      placeTree(hitPose);
    },
    onSessionEnd: () => {
      console.log('[HIDDEN] WebXR session ended');
    },
  });

  // Update status once session is live
  setArStatus('Place the square over the marker, then tap');

  // Request wake lock to prevent screen dimming
  await requestWakeLock();
}

// ─────────────────────────────────────────────
// Place tree at hit-test position
// ─────────────────────────────────────────────
function placeTree(hitPose) {
  if (treePlaced || !treeData) {
    console.log('[HIDDEN] placeTree skipped - treePlaced:', treePlaced, 'treeData exists:', !!treeData);
    return;
  }
  treePlaced = true;
  console.log('[HIDDEN] Placing tree at hit pose');

  const { points } = treeData;

  // Position at hit-test location (floor surface)
  points.position.set(
    hitPose.position.x,
    hitPose.position.y,
    hitPose.position.z
  );

  scene.add(points);
  console.log('[HIDDEN] Tree added to scene, total children:', scene.children.length);

  // Initialize floating animation after a short delay to prevent blocking
  setTimeout(() => {
    try {
      floatingAnimation = new FloatingAnimation(points);
      floatingAnimation.start();
      console.log('[HIDDEN] Floating animation initialized - will start in 3s with fade-in');
    } catch (err) {
      console.error('[HIDDEN] Failed to initialize floating animation:', err);
    }
  }, 100); // 100ms delay

  // Stop hit-testing
  stopHitTest();

  // Fade out AR status
  setArStatus('');
  setTimeout(() => {
    const arOverlay = ui.arOverlay();
    if (arOverlay) arOverlay.classList.add('hidden');
  }, 1000);

  console.log(`[HIDDEN] Tree placed at (${hitPose.position.x.toFixed(2)}, ${hitPose.position.y.toFixed(2)}, ${hitPose.position.z.toFixed(2)})`);
}

// ─────────────────────────────────────────────
// No fallback - WebXR required
// ─────────────────────────────────────────────

async function startMarkerAnchoredMode() {
  console.log('[HIDDEN] Marker mode: AR.js continuous tracking');

  const overlay = ui.overlay();
  if (overlay) overlay.classList.add('hidden');

  const arOverlay = ui.arOverlay();
  if (arOverlay) arOverlay.classList.remove('hidden');
  const btn = ui.startBtn();
  if (btn) btn.classList.add('hidden');
  setArStatus('Point camera at the marker');

  let ar;
  try {
    ar = await startMarkerTracking(scene, camera, renderer);
  } catch (err) {
    console.error('[HIDDEN] Marker mode failed:', err);
    setArStatus('Marker mode failed: ' + err.message);
    return;
  }

  if (treeData && treeData.points) {
    // Scale tree to 5.7x marker size (2m / 0.35m ≈ 5.7)
    treeData.points.scale.set(5.7, 5.7, 5.7);
    ar.anchorGroup.add(treeData.points);
  }

  function animate() {
    requestAnimationFrame(animate);
    ar.update();
    
    // Update floating animation
    if (floatingAnimation) {
      floatingAnimation.update();
    }
    
    renderer.render(scene, camera);
  }
  animate();
}

// ─────────────────────────────────────────────
// Global animation update
// ─────────────────────────────────────────────
function updateAnimations() {
  if (floatingAnimation) {
    floatingAnimation.update();
  }
}

// Make globally available for WebXR render loop
window.updateAnimations = updateAnimations;

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

  const requestedMode = MODE;
  const runningMode = requestedMode === 'marker' ? 'marker' : 'webxr'; // Force WebXR
  initModeToggle(runningMode, webxrOK);

  if (runningMode === 'marker') {
    await startMarkerAnchoredMode();
    return;
  }

  if (!webxrOK) {
    console.log('[HIDDEN] WebXR not supported, but trying anyway for emulator');
    // Don't fallback - try WebXR anyway for emulator compatibility
  }

  // Phase 1: AR.js marker detection
  try {
    await detectMarker();
  } catch (err) {
    console.warn('[HIDDEN] Marker detection failed, skipping to WebXR:', err);
  }

  // User gesture gate — WebXR requestSession requires a tap on Chrome Android.
  // We start Phase 2 directly inside the click handler to preserve activation.
  try {
    await waitForUserTapAndStartAR();
  } catch (err) {
    console.error('[HIDDEN] WebXR failed (tap/start):', err);
    await startMarkerAnchoredMode();
  }
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
