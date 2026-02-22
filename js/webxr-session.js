// webxr-session.js — WebXR immersive-ar session with hit-test
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

let xrSession = null;
let hitTestSource = null;
let referenceSpace = null;
let _onFrame = null;

/**
 * Check if immersive-ar is supported on this device.
 * @returns {Promise<boolean>}
 */
export async function isWebXRSupported() {
  if (!navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
}

/**
 * Start a WebXR immersive-ar session with hit-test.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {object} callbacks
 * @param {function} callbacks.onHitTest — called each frame with (hitPose: {position, orientation}) or null
 * @param {function} [callbacks.onSessionEnd] — called when session ends
 * @returns {Promise<{ session: XRSession, referenceSpace: XRReferenceSpace }>}
 */
export async function startWebXRSession(renderer, scene, camera, callbacks = {}) {
  const arOverlay = document.getElementById('ar-overlay');
  const arStatus = document.getElementById('ar-status');

  // Build feature lists
  const requiredFeatures = ['hit-test'];
  const optionalFeatures = ['dom-overlay'];
  const sessionInit = {
    requiredFeatures,
    optionalFeatures,
  };

  // Attach DOM overlay if element exists
  if (arOverlay) {
    sessionInit.domOverlay = { root: arOverlay };
  }

  // Request session
  console.log('[WebXR] Requesting immersive-ar session…');
  xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
  console.log('[WebXR] Session started');

  // Show DOM overlay
  if (arOverlay) arOverlay.classList.remove('hidden');
  if (arStatus) arStatus.textContent = 'Scanning floor…';

  // Enable XR on renderer now (not earlier — interferes with Phase 1 canvas)
  renderer.xr.enabled = true;

  // Bind session to Three.js renderer
  await renderer.xr.setSession(xrSession);

  // Reference spaces — try 'local-floor' first (better Y=floor), fall back to 'local'
  try {
    referenceSpace = await xrSession.requestReferenceSpace('local-floor');
    console.log('[WebXR] Using local-floor reference space');
  } catch {
    referenceSpace = await xrSession.requestReferenceSpace('local');
    console.log('[WebXR] Using local reference space');
  }
  const viewerSpace = await xrSession.requestReferenceSpace('viewer');

  // Hit-test source (ray from screen centre)
  try {
    hitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });
    console.log('[WebXR] Hit-test source created');
  } catch (err) {
    console.warn('[WebXR] Hit-test not available:', err);
  }

  // Session end handler
  xrSession.addEventListener('end', () => {
    console.log('[WebXR] Session ended');
    xrSession = null;
    hitTestSource = null;
    referenceSpace = null;
    if (callbacks.onSessionEnd) callbacks.onSessionEnd();
  });

  // XR render loop via Three.js
  _onFrame = (timestamp, frame) => {
    if (!frame) {
      renderer.render(scene, camera);
      return;
    }

    // Process hit-test
    if (hitTestSource && callbacks.onHitTest) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const hit = results[0];
        const pose = hit.getPose(referenceSpace);
        if (pose) {
          callbacks.onHitTest({
            position: pose.transform.position,
            orientation: pose.transform.orientation,
            matrix: pose.transform.matrix,
          });
        }
      } else {
        callbacks.onHitTest(null);
      }
    }

    renderer.render(scene, camera);
  };

  renderer.setAnimationLoop(_onFrame);

  return { session: xrSession, referenceSpace };
}

/**
 * Stop the hit-test source (call after tree is placed).
 */
export function stopHitTest() {
  if (hitTestSource) {
    hitTestSource.cancel();
    hitTestSource = null;
    console.log('[WebXR] Hit-test stopped');
  }
}

/**
 * End the WebXR session.
 */
export async function endWebXRSession() {
  if (xrSession) {
    await xrSession.end();
  }
}

/**
 * Request screen wake lock to prevent dimming.
 * @returns {Promise<WakeLockSentinel|null>}
 */
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.warn('[WebXR] Wake Lock API not supported');
    return null;
  }
  try {
    const sentinel = await navigator.wakeLock.request('screen');
    console.log('[WebXR] Wake lock acquired');
    sentinel.addEventListener('release', () => {
      console.log('[WebXR] Wake lock released');
    });
    return sentinel;
  } catch (err) {
    console.warn('[WebXR] Wake lock failed:', err);
    return null;
  }
}
