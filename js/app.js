// app.js — Bootstrap & two-phase AR flow
// HIDDEN Exhibition · AR Point Cloud Experience
//
// Phase 0: Load point cloud
// Phase 1: AR.js detects custom marker (confirms user is at correct spot)
// Phase 2: WebXR immersive-ar session with hit-test (world-tracked tree)

import * as THREE from 'three';
import { createScene, updateUniforms } from './scene.js';
import { loadPointCloud } from './point-cloud-loader.js';
import { startMarkerTracking, waitForMarkerDetection } from './marker-tracking.js';
import {
  isWebXRSupported,
  startWebXRSession,
  stopHitTest,
  requestWakeLock,
} from './webxr-session.js';
import { uniforms } from '../uniformsRegistry.js';

console.log('[HIDDEN] AR app initialising');

const TREE_PLY_URL = 'assets/stjohn_originbase.ply';

const MODE = new URLSearchParams(window.location.search).get('mode') || 'auto';

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

/**
 * Type out text with a typewriter effect and fade between sentences
 * @param {string} text - The text to type
 * @param {HTMLElement} element - The element to type into
 * @param {number} speed - Typing speed in ms per character
 * @returns {Promise} - Resolves when typing is complete
 */
function typeText(text, element, speed = 80) {
  return new Promise((resolve) => {
    if (!element) {
      resolve();
      return;
    }
    
    // Note: Centering is handled by CSS for the AR status element
    
    const sentences = text.split('. ');
    let currentSentenceIndex = 0;
    
    function typeSentence() {
      if (currentSentenceIndex >= sentences.length) {
        resolve();
        return;
      }
      
      const sentence = sentences[currentSentenceIndex] + (currentSentenceIndex < sentences.length - 1 ? '.' : '');
      element.textContent = '';
      let charIndex = 0;
      
      function typeChar() {
        if (charIndex < sentence.length) {
          const char = sentence[charIndex];
          element.textContent += char;
          charIndex++;
          
          // Add pause after periods (dots)
          const delay = char === '.' ? 500 : speed;
          
          setTimeout(typeChar, delay);
        } else {
          // Sentence complete, wait then fade out - SHORTER DELAY for introduction text
          setTimeout(() => {
            fadeOutAndNext();
          }, 300); // Reduced from 1000ms to 300ms for faster transitions
        }
      }
      
      typeChar();
    }
    
    function fadeOutAndNext() {
      // Fade out current sentence
      element.style.transition = 'opacity 0.5s ease-out';
      element.style.opacity = '0';
      
      setTimeout(() => {
        currentSentenceIndex++;
        
        // If this is the last sentence, keep it visible
        if (currentSentenceIndex >= sentences.length) {
          element.style.opacity = '1';
          resolve();
        } else {
          // Clear and type next sentence
          element.textContent = '';
          element.style.opacity = '1';
          element.style.transition = '';
          setTimeout(typeSentence, 200);
        }
      }, 500);
    }
    
    typeSentence();
  });
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
  return new Promise(async (resolve) => {
    const statusEl = ui.arStatus();
    const btn = ui.startBtn();
    
    if (!btn || !statusEl) { resolve(); return; }
    
    // Hide button initially
    btn.classList.add('hidden');
    btn.style.opacity = '0';
    btn.style.transition = 'opacity 1s ease-in-out';
    
    // Type out the instructions
    const instructionText = 'Hello stranger. Turn around and stand outside of the white square. Point your camera and align the pointer with the marker on the floor. Tap when aligned. Enjoy the tree.';
    
    await typeText(instructionText, statusEl, 80);
    
    // Show button softly after typing completes
    setTimeout(() => {
      btn.classList.remove('hidden');
      // Trigger reflow to ensure transition works
      btn.offsetHeight;
      btn.style.opacity = '1';
    }, 500);
    
    btn.addEventListener('click', async () => {
      // Fade out the last sentence when button is pressed
      statusEl.style.transition = 'opacity 0.5s ease-out';
      statusEl.style.opacity = '0';
      
      btn.style.opacity = '0';
      setTimeout(() => {
        btn.classList.add('hidden');
        btn.disabled = true;
      }, 1000);

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
    console.log('[HIDDEN] Reset tree state for WebXR');
  }

  await startWebXRSession(renderer, scene, camera, {
    onPlace: (hitPose) => {
      placeTree(hitPose);
    },
    onSessionEnd: () => {
      console.log('[HIDDEN] WebXR session ended');
    },
  });

  // Update status once session is live - reticle will appear softly
  setArStatus('Align the white square with the marker on the floor, then tap to place the tree');

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

  // The mesh already has centering offset (points.position) and normalised scale
  // from the loader. We ADD the hit-test position on top of the existing offset.
  const floorOffset = 1.05;
  points.position.x += hitPose.position.x;
  points.position.y += hitPose.position.y - floorOffset;
  points.position.z += hitPose.position.z;

  scene.add(points);
  console.log('[HIDDEN] Tree added to scene, total children:', scene.children.length);

  // Debug tree size
  const bbox = new THREE.Box3().setFromObject(points);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  console.log('[HIDDEN] Tree bounding box:', size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2));
  console.log('[HIDDEN] Tree scale:', points.scale.x.toFixed(2), points.scale.y.toFixed(2), points.scale.z.toFixed(2));

  // Start simple opacity fade-in
  startOpacityFadeIn();

  // Stop hit-testing
  stopHitTest();

  // Fade out AR status — but NEVER set display:none on the DOM overlay root
  // The DOM overlay root must remain in the DOM and visible (even if empty)
  // during the entire WebXR session, or Chrome kills the compositing pipeline
  setArStatus('');
  const arOverlay = ui.arOverlay();
  if (arOverlay) {
    arOverlay.style.pointerEvents = 'none';
    arOverlay.style.opacity = '0';
    arOverlay.style.transition = 'opacity 0.5s ease';
  }

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
    ar.anchorGroup.add(treeData.points);
    uniforms.uOpacity.value = 1.0;
  }

  function animate() {
    requestAnimationFrame(animate);
    updateUniforms();
    renderer.render(scene, camera);
  }
  animate();
}

// ─────────────────────────────────────────────
// Global animation update (called from WebXR render loop)
// ─────────────────────────────────────────────
function updateAnimations() {
  updateUniforms();
}

/**
 * Simple opacity fade-in: animate uOpacity from 0 → 1 over 2 seconds
 */
function startOpacityFadeIn() {
  if (window.fadeAnimationFrameId) {
    cancelAnimationFrame(window.fadeAnimationFrameId);
  }

  uniforms.uOpacity.value = 0.0;
  const fadeDuration = 2000;
  const startTime = performance.now();

  function tick() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / fadeDuration, 1.0);
    // Ease-in-out cubic
    uniforms.uOpacity.value = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    if (t < 1.0) {
      window.fadeAnimationFrameId = requestAnimationFrame(tick);
    } else {
      uniforms.uOpacity.value = 1.0;
      window.fadeAnimationFrameId = null;
      console.log('[HIDDEN] Opacity fade-in complete');
    }
  }

  tick();
  console.log('[HIDDEN] Starting opacity fade-in (2s)');
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

  // Show AR overlay immediately since we're skipping marker detection
  const overlay = ui.overlay();
  if (overlay) overlay.classList.add('hidden');
  const arOverlay = ui.arOverlay();
  if (arOverlay) arOverlay.classList.remove('hidden');

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

  // Skip marker detection - go directly to WebXR
  console.log('[HIDDEN] Skipping marker detection - starting WebXR directly');

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
