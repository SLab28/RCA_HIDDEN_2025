// marker-tracking.js — AR.js / MindAR anchor logic
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

const AR_JS_URL = 'https://raw.githack.com/AR-js-org/AR.js/master/three.js/build/ar-threex.js';
const CAMERA_PARAM_URL = 'https://raw.githack.com/AR-js-org/AR.js/master/data/data/camera_para.dat';

let arToolkitSource = null;
let arToolkitContext = null;
let _anchorGroup = null;
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
  if (arToolkitContext && arToolkitContext.arController !== null) {
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

  // Reset camera for AR.js — it manages the projection matrix
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, 0);

  // ArToolkitSource — webcam
  arToolkitSource = new THREEx.ArToolkitSource({ sourceType: 'webcam' });

  await new Promise((resolve) => {
    arToolkitSource.init(function onReady() {
      console.log('[AR] ArToolkitSource ready');
      onResize(renderer);
      resolve();
    });
  });

  window.addEventListener('resize', () => {
    onResize(renderer);
  });

  // ArToolkitContext — marker detection engine
  arToolkitContext = new THREEx.ArToolkitContext({
    cameraParametersUrl: CAMERA_PARAM_URL,
    detectionMode: 'mono',
  });

  await new Promise((resolve) => {
    arToolkitContext.init(function onCompleted() {
      console.log('[AR] ArToolkitContext initialised');
      camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
      resolve();
    });
  });

  // Anchor group — all AR content parents to this
  const anchorGroup = new THREE.Group();
  anchorGroup.name = 'ar-anchor';
  scene.add(anchorGroup);
  _anchorGroup = anchorGroup;

  // ArMarkerControls — custom pattern marker
  new THREEx.ArMarkerControls(arToolkitContext, anchorGroup, {
    type: 'pattern',
    patternUrl: 'assets/position_marker.patt',
    changeMatrixMode: 'modelViewMatrix',
  });

  console.log('[AR] Marker tracking initialised (custom pattern: position_marker.patt)');

  return { anchorGroup };
}

/**
 * Call once per frame to update AR tracking.
 */
export function updateAR() {
  if (!arToolkitSource || !arToolkitSource.ready) return;

  arToolkitContext.update(arToolkitSource.domElement);

  // Manually track marker visibility via the anchor group's matrix
  if (_anchorGroup) {
    const wasFound = markerFound;
    // AR.js sets the object visible when marker is detected
    markerFound = _anchorGroup.visible;
    if (markerFound && !wasFound) {
      console.log('[AR] Marker FOUND');
    } else if (!markerFound && wasFound) {
      console.log('[AR] Marker LOST');
    }
  }
}

/**
 * Check if the marker is currently detected.
 * @returns {boolean}
 */
export function isMarkerVisible() {
  return markerFound;
}
