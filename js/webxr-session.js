// webxr-session.js — WebXR immersive-ar session with hit-test + reticle
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { uniforms } from '../uniformsRegistry.js';

let xrSession = null;
let hitTestSource = null;
let referenceSpace = null;
let _onFrame = null;
let _reticle = null;
let _currentHitPose = null;
let wakeLockSentinel = null; // Store wake lock for cleanup
let xrLightProbe = null;

function updateXRLightUniforms(frame) {
  if (!xrLightProbe || !frame) return;

  const estimate = frame.getLightEstimate(xrLightProbe);
  if (!estimate || !estimate.primaryLightIntensity) return;

  const r = Math.max(estimate.primaryLightIntensity.x, 0.0001);
  const g = Math.max(estimate.primaryLightIntensity.y, 0.0001);
  const b = Math.max(estimate.primaryLightIntensity.z, 0.0001);
  const avg = (r + g + b) / 3.0;

  // Tone-map raw intensity to a stable range for point cloud shading.
  const mappedIntensity = THREE.MathUtils.clamp(Math.log2(1.0 + avg) * 0.35, 0.45, 1.75);
  uniforms.xrLightIntensity.value = mappedIntensity;

  const maxChannel = Math.max(r, g, b);
  uniforms.xrLightColor.value.set(r / maxChannel, g / maxChannel, b / maxChannel);
}

/**
 * Check if immersive-ar is supported on this device.
 * @returns {Promise<boolean>}
 */
export async function isWebXRSupported() {
  console.log('[WebXR] Checking support...');
  console.log('[WebXR] navigator.xr exists:', !!navigator.xr);
  
  if (!navigator.xr) {
    console.log('[WebXR] No navigator.xr found');
    return false;
  }
  
  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    console.log('[WebXR] immersive-ar supported:', supported);
    
    // For emulators, also check if requestSession is available
    const canRequest = typeof navigator.xr.requestSession === 'function';
    console.log('[WebXR] requestSession available:', canRequest);
    
    // Return true if either is supported (some emulators might not report correctly)
    return supported || canRequest;
  } catch (err) {
    console.warn('[WebXR] Support check failed:', err);
    // Still return true if requestSession exists (for emulator compatibility)
    return typeof navigator.xr.requestSession === 'function';
  }
}

/**
 * Create the reticle mesh — white wireframe square, flat on floor.
 * @param {number} size — side length in metres
 * @returns {THREE.LineSegments}
 */
function createReticle(size = 0.35) {
  // Create a square wireframe reticle
  const geometry = new THREE.PlaneGeometry(size, size);
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ 
    color: 0xffffff, 
    linewidth: 3
  });
  const reticle = new THREE.LineSegments(edges, material);
  reticle.name = 'placement-reticle';
  reticle.rotateX(-Math.PI / 2); // flat on floor
  reticle.frustumCulled = false;
  reticle.visible = false;
  console.log('[WebXR] Created square wireframe reticle, size:', size);
  geometry.dispose(); // edges cloned it
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

  // Build feature lists with reference space negotiation
  const requiredFeatures = ['hit-test'];
  const optionalFeatures = ['dom-overlay', 'local-floor', 'local', 'viewer', 'light-estimation'];
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
  console.log('[WebXR] Session init:', sessionInit);
  
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', sessionInit);
    console.log('[WebXR] Session started successfully');
    console.log('[WebXR] Session environment integration:', xrSession.environmentIntegration);
  } catch (err) {
    console.error('[WebXR] Session request failed:', err);
    console.log('[WebXR] Error name:', err.name);
    console.log('[WebXR] Error message:', err.message);
    throw err;
  }

  // Show DOM overlay
  if (arOverlay) arOverlay.classList.remove('hidden');
  if (arStatus) arStatus.textContent = 'Scanning floor…';

  // Prevent anything from hiding the DOM overlay root during WebXR
  let overlayObserver = null;
  if (arOverlay) {
    overlayObserver = new MutationObserver(() => {
      if (arOverlay.style.display === 'none' || arOverlay.classList.contains('hidden')) {
        arOverlay.classList.remove('hidden');
        arOverlay.style.display = '';
        console.warn('[WebXR] Prevented DOM overlay root from being hidden');
      }
    });
    overlayObserver.observe(arOverlay, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // Enable XR on renderer now (not earlier — interferes with Phase 1 canvas)
  renderer.xr.enabled = true;

  // Bind session to Three.js renderer
  await renderer.xr.setSession(xrSession);

  // Reference spaces - use viewer space for emulator compatibility
  let viewerSpace;
  try {
    viewerSpace = await xrSession.requestReferenceSpace('viewer');
    console.log('[WebXR] Viewer reference space created');
  } catch (err) {
    console.error('[WebXR] Failed to create viewer space:', err);
    throw err;
  }

  // Get reference space with fallback logic for mobile compatibility
  async function getReferenceSpace(session) {
    // Prefer 'local' for mobile compatibility, then 'local-floor', then 'viewer'
    const types = ['local', 'local-floor', 'viewer']; // mobile-first order
    for (const type of types) {
      try {
        const refSpace = await session.requestReferenceSpace(type);
        console.log('[WebXR] Using reference space:', type);
        return refSpace;
      } catch (e) {
        console.warn('[WebXR] Reference space not supported:', type, e.name);
      }
    }
    throw new Error('No supported reference space found');
  }

  try {
    referenceSpace = await getReferenceSpace(xrSession);
  } catch (err) {
    console.error('[WebXR] Failed to get any reference space:', err);
    throw err;
  }

  // Hit-test source (ray from screen centre)
  try {
    hitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });
    console.log('[WebXR] Hit-test source created');
  } catch (err) {
    console.warn('[WebXR] Hit-test not available:', err);
  }

  // Light estimation (optional)
  xrLightProbe = null;
  try {
    xrLightProbe = await xrSession.requestLightProbe();
    console.log('[WebXR] Light estimation enabled');
  } catch (err) {
    console.warn('[WebXR] Light estimation unavailable:', err?.name || err);
    uniforms.xrLightIntensity.value = 1.0;
    uniforms.xrLightColor.value.set(1, 1, 1);
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
    xrLightProbe = null;
    _currentHitPose = null;
    uniforms.xrLightIntensity.value = 1.0;
    uniforms.xrLightColor.value.set(1, 1, 1);
    
    // Release wake lock when session ends
    releaseWakeLock();
    
    // Disconnect overlay observer
    if (overlayObserver) {
      overlayObserver.disconnect();
    }
    
    // Restore DOM overlay root visibility for potential re-entry
    if (arOverlay) {
      arOverlay.style.opacity = '';
      arOverlay.style.pointerEvents = '';
      arOverlay.style.transition = '';
    }
    
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
          
          // Position reticle on detected surface
          const adjustedY = pose.transform.position.y; // No adjustment - use original floor level
          _reticle.position.set(
            pose.transform.position.x,
            adjustedY,
            pose.transform.position.z
          );
          
          // Align reticle with surface normal and lay flat on floor
          // The hit pose orientation represents the detected surface orientation
          const hitQuaternion = new THREE.Quaternion(
            pose.transform.orientation.x,
            pose.transform.orientation.y,
            pose.transform.orientation.z,
            pose.transform.orientation.w
          );
          
          // Apply the surface orientation to the reticle
          _reticle.quaternion.copy(hitQuaternion);
          
          // Ensure the reticle lies flat by applying an additional -90° rotation on X axis
          // This makes the square face-up on the detected surface
          const flatRotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0), 
            -Math.PI / 2
          );
          _reticle.quaternion.multiplyQuaternions(flatRotation, _reticle.quaternion);

          _currentHitPose = {
            position: {
              x: pose.transform.position.x,
              y: pose.transform.position.y, // Use original Y for tree placement
              z: pose.transform.position.z
            },
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
      // After tree placement, both are null — this is expected, no logging needed
    }

    // Update animation uniforms from app loop
    if (window.updateAnimations) {
      window.updateAnimations();
    }

    // Update shader light response from WebXR light estimation
    updateXRLightUniforms(frame);
    
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
    // Release any existing wake lock
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
    
    const sentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel = sentinel;
    console.log('[WebXR] Wake lock acquired');
    sentinel.addEventListener('release', () => {
      console.log('[WebXR] Wake lock released');
      wakeLockSentinel = null;
    });
    return sentinel;
  } catch (err) {
    console.warn('[WebXR] Wake lock failed:', err);
    return null;
  }
}

/**
 * Release the wake lock if active.
 */
export async function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      console.log('[WebXR] Wake lock manually released');
      wakeLockSentinel = null;
    } catch (err) {
      console.warn('[WebXR] Failed to release wake lock:', err);
    }
  }
}
