// marker-tracking.js — AR.js marker detection (Phase 1 only)
// HIDDEN Exhibition · AR Point Cloud Experience
//
// AR.js is used ONLY to detect the custom marker, confirming the user
// is pointing at the correct floor position. After detection, AR.js is
// cleaned up and WebXR takes over for world-tracked persistence.

import * as THREE from 'three';

const AR_JS_URL = 'https://raw.githack.com/AR-js-org/AR.js/master/three.js/build/ar-threex.js';
const CAMERA_PARAM_URL = 'https://raw.githack.com/AR-js-org/AR.js/master/data/data/camera_para.dat';

let arToolkitSource = null;
let arToolkitContext = null;
let _animFrameId = null;

/**
 * Dynamically load AR.js (ar-threex.js).
 */
function loadARjs() {
  window.THREE = THREE;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = AR_JS_URL;
    script.onload = () => {
      console.log('[AR.js] ar-threex.js loaded');
      resolve();
    };
    script.onerror = () => reject(new Error('[AR.js] Failed to load ar-threex.js'));
    document.head.appendChild(script);
  });
}

/**
 * Handle resize for AR.js source and context.
 * @param {THREE.WebGLRenderer} renderer
 */
function onResize(renderer) {
  if (!arToolkitSource) return;
  arToolkitSource.onResizeElement();
  arToolkitSource.copyElementSizeTo(renderer.domElement);
  if (arToolkitContext && arToolkitContext.arController !== null) {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
  }
}

/**
 * Start AR.js and wait until the custom marker is detected.
 * Resolves as soon as the marker is found for the first time.
 * Does NOT manage the tree or any scene content.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @returns {Promise<void>} Resolves when marker is detected
 */
export async function waitForMarkerDetection(renderer) {
  await loadARjs();

  /* global THREEx */

  // Hide Three.js canvas during Phase 1 — AR.js video shows directly
  const canvas = renderer.domElement;
  canvas.style.display = 'none';

  // ArToolkitSource — webcam
  arToolkitSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });

  await new Promise((resolve) => {
    arToolkitSource.init(function onReady() {
      console.log('[AR.js] Camera ready');
      // Make the video element fill the screen
      const video = arToolkitSource.domElement;
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100vw';
      video.style.height = '100vh';
      video.style.objectFit = 'cover';
      video.style.zIndex = '0';
      resolve();
    });
  });

  // ArToolkitContext — marker detection engine (needs a dummy camera for projection)
  const arCamera = new THREE.PerspectiveCamera();
  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: CAMERA_PARAM_URL,
    detectionMode: 'mono',
  });

  await new Promise((resolve) => {
    arToolkitContext.init(function onCompleted() {
      console.log('[AR.js] ArToolkit context ready');
      arCamera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
      resolve();
    });
  });

  // Marker probe group — just used to detect marker visibility
  const arScene = new THREE.Scene();
  const probeGroup = new THREE.Group();
  arScene.add(probeGroup);

  new THREEx.ArMarkerControls(arToolkitContext, probeGroup, {
    type: 'pattern',
    patternUrl: 'assets/position_marker.patt',
    changeMatrixMode: 'modelViewMatrix',
  });

  console.log('[AR.js] Waiting for marker detection…');

  // Poll for marker detection
  return new Promise((resolve) => {
    function tick() {
      if (!arToolkitSource || !arToolkitSource.ready) {
        _animFrameId = requestAnimationFrame(tick);
        return;
      }

      // Feed video frame to artoolkit for marker detection (no Three.js render needed)
      arToolkitContext.update(arToolkitSource.domElement);

      // AR.js sets probeGroup.visible = true when marker is detected
      if (probeGroup.visible) {
        console.log('[AR.js] ✓ Marker detected!');
        // Restore canvas for Phase 2
        canvas.style.display = 'block';
        cleanupARjs();
        resolve();
        return;
      }

      _animFrameId = requestAnimationFrame(tick);
    }

    _animFrameId = requestAnimationFrame(tick);
  });
}

/**
 * Clean up AR.js resources (video element, scripts, etc.)
 */
function cleanupARjs() {
  if (_animFrameId) {
    cancelAnimationFrame(_animFrameId);
    _animFrameId = null;
  }

  // Stop and remove the video element AR.js created
  if (arToolkitSource && arToolkitSource.domElement) {
    const video = arToolkitSource.domElement;
    if (video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
    }
    video.remove();
    console.log('[AR.js] Camera stream stopped');
  }

  arToolkitSource = null;
  arToolkitContext = null;
}
