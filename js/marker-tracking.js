// marker-tracking.js — AR.js / MindAR anchor logic
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

const AR_JS_URL = 'https://raw.githack.com/AR-js-org/AR.js/3.4.5/three.js/build/ar-threex.js';

let arToolkitSource = null;
let arToolkitContext = null;
let markerFound = false;

/**
 * Dynamically load AR.js (ar-threex.js).
 * AR.js expects THREE on window.
 */
function loadARjs() {
  window.THREE = THREE;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = AR_JS_URL;
    script.onload = () => {
      console.log('[AR] ar-threex.js loaded');
      resolve();
    };
    script.onerror = () => reject(new Error('[AR] Failed to load ar-threex.js'));
    document.head.appendChild(script);
  });
}

/**
 * Handle resize for AR.js source and context (Pitfall 4).
 * @param {THREE.WebGLRenderer} renderer
 */
function onResize(renderer) {
  arToolkitSource.onResizeElement();
  arToolkitSource.copyElementSizeTo(renderer.domElement);
  if (arToolkitContext.arController !== null) {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
  }
}

/**
 * Initialise AR.js marker tracking.
 * @param {THREE.Scene} scene
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @returns {Promise<{ anchorGroup: THREE.Group }>}
 */
export async function initMarkerTracking(scene, camera, renderer) {
  await loadARjs();

  /* global THREEx */

  // ArToolkitSource — webcam
  arToolkitSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });

  arToolkitSource.init(function onReady() {
    console.log('[AR] ArToolkitSource ready');
    onResize(renderer);
  });

  window.addEventListener('resize', () => {
    onResize(renderer);
  });

  // ArToolkitContext — marker detection engine
  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: THREEx.ArToolkitContext.baseURL + 'data/camera_para.dat',
    detectionMode: 'mono',
  });

  arToolkitContext.init(function onCompleted() {
    console.log('[AR] ArToolkitContext initialised');
    // Copy projection matrix from AR.js to our Three.js camera
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });

  // Anchor group — all AR content parents to this
  const anchorGroup = new THREE.Group();
  anchorGroup.name = 'ar-anchor';
  scene.add(anchorGroup);

  // ArMarkerControls — custom pattern marker
  const markerControls = new THREEx.ArMarkerControls(arToolkitContext, anchorGroup, {
    type: 'pattern',
    patternUrl: 'assets/position_marker.patt',
    changeMatrixMode: 'modelViewMatrix',
  });

  // Marker found/lost detection
  anchorGroup.visible = false;

  console.log('[AR] Marker tracking initialised (custom pattern: position_marker.patt)');

  return { anchorGroup };
}

/**
 * Call once per frame to update AR tracking.
 * @param {THREE.WebGLRenderer} renderer
 */
export function updateAR(renderer) {
  if (!arToolkitSource || !arToolkitSource.ready) return;

  arToolkitContext.update(arToolkitSource.domElement);

  // The anchor group's .visible is managed by ArMarkerControls internally,
  // but we also track state for logging
  // AR.js sets the markerRoot visible/invisible automatically via matrixAutoUpdate
}

/**
 * Check if the marker is currently detected.
 * @returns {boolean}
 */
export function isMarkerVisible() {
  return markerFound;
}
