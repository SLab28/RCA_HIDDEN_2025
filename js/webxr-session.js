// webxr-session.js — WebXR immersive-ar session with hit-test + reticle
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

let xrSession = null;
let hitTestSource = null;
let referenceSpace = null;
let _onFrame = null;
let _reticle = null;
let _currentHitPose = null;

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
 * Create the reticle mesh — white wireframe square, flat on floor.
 * @param {number} size — side length in metres
 * @returns {THREE.LineSegments}
 */
function createReticle(size = 0.35) {
  const plane = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const reticle = new THREE.Mesh(plane, material);
  reticle.name = 'placement-reticle';
  reticle.rotateX(-Math.PI / 2); // flat on floor
  reticle.frustumCulled = false;
  reticle.visible = false;
  console.log('[WebXR] Created solid plane reticle, size:', size);
  return reticle;
}

/**
 * Start a WebXR immersive-ar session with hit-test reticle and tap-to-place.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {object} callbacks
 * @param {function} callbacks.onPlace — called once when user taps to place (hitPose)
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

  // Create reticle and add to scene
  _reticle = createReticle(0.35);
  _currentHitPose = null;
  scene.add(_reticle);
  console.log('[WebXR] Reticle created and added to scene, visible:', _reticle.visible);

  // Tap-to-place via XR 'select' event (fires on screen tap in immersive-ar)
  let placed = false;
  xrSession.addEventListener('select', () => {
    if (placed || !_currentHitPose) return;
    placed = true;
    console.log('[WebXR] Tap-to-place triggered');

    // Remove reticle
    scene.remove(_reticle);
    _reticle.geometry.dispose();
    _reticle.material.dispose();
    _reticle = null;

    // Notify caller
    if (callbacks.onPlace) {
      callbacks.onPlace(_currentHitPose);
    }
  });

  // Session end handler
  xrSession.addEventListener('end', () => {
    console.log('[WebXR] Session ended');
    if (_reticle) {
      scene.remove(_reticle);
      _reticle.geometry.dispose();
      _reticle.material.dispose();
      _reticle = null;
    }
    xrSession = null;
    hitTestSource = null;
    referenceSpace = null;
    _currentHitPose = null;
    if (callbacks.onSessionEnd) callbacks.onSessionEnd();
  });

  // XR render loop via Three.js
  _onFrame = (timestamp, frame) => {
    if (!frame) {
      renderer.render(scene, camera);
      return;
    }

    // Process hit-test → move reticle
    if (hitTestSource && _reticle) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length > 0) {
        const hit = results[0];
        const pose = hit.getPose(referenceSpace);
        if (pose) {
          if (!_reticle.visible) {
            console.log('[WebXR] First hit-test result, showing reticle');
          }
          _reticle.visible = true;
          _reticle.position.set(
            pose.transform.position.x,
            pose.transform.position.y,
            pose.transform.position.z
          );
          // Align reticle with surface normal (hit-test orientation)
          _reticle.quaternion.set(
            pose.transform.orientation.x,
            pose.transform.orientation.y,
            pose.transform.orientation.z,
            pose.transform.orientation.w
          );
          // Apply -90° X rotation to lay flat on the surface
          const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
          _reticle.quaternion.multiplyQuaternions(rot, _reticle.quaternion);

          _currentHitPose = {
            position: pose.transform.position,
            orientation: pose.transform.orientation,
            matrix: pose.transform.matrix,
          };
        }
      } else {
        if (_reticle.visible) {
          console.log('[WebXR] No hit-test results, hiding reticle');
        }
        _reticle.visible = false;
        _currentHitPose = null;
      }
    } else {
      console.log('[WebXR] No hit-test source or reticle');
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
