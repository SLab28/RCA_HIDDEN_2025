// scene.js — Three.js scene, camera, renderer
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { uniforms } from '../uniformsRegistry.js';

// Background render target for glass refraction
let backgroundRenderTarget = null;

/**
 * Create and return the core Three.js objects.
 * Renderer is XR-ready; camera is managed by WebXR during Phase 2.
 * @returns {{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer }}
 */
export function createScene() {
  const scene = new THREE.Scene();

  // Camera — WebXR overrides projection + view matrices in AR mode
  // Fallback position for non-AR / AR.js Phase 1
  const camera = new THREE.PerspectiveCamera(
    120, // Adjusted FOV from 71 to 120 degrees
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0, 1.0, 3);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Set clear color to black for background render target
  renderer.setClearColor(0x000000, 1.0);
  document.body.appendChild(renderer.domElement);

  // Create background render target for glass refraction
  backgroundRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  uniforms.uBackgroundTex.value = backgroundRenderTarget.texture;

  // Resize handler (only applies outside XR session)
  window.addEventListener('resize', () => {
    if (!renderer.xr.isPresenting) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      // Recreate background render target with new size
      if (backgroundRenderTarget) {
        backgroundRenderTarget.dispose();
        backgroundRenderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        uniforms.uBackgroundTex.value = backgroundRenderTarget.texture;
      }
    }
  });

  return { scene, camera, renderer };
}

/**
 * Render background to render target for glass refraction
 * Call this before rendering the point cloud
 */
export function renderBackground(renderer, scene, camera) {
  if (backgroundRenderTarget) {
    // Render scene background to render target
    renderer.setRenderTarget(backgroundRenderTarget);
    renderer.clear();
    
    // Create a simple background gradient
    const time = uniforms.uTime.value;
    const gradientColor1 = new THREE.Color(0.1, 0.05, 0.15);
    const gradientColor2 = new THREE.Color(0.05, 0.1, 0.2);
    
    // Simple procedural background
    renderer.setClearColor(gradientColor1.lerp(gradientColor2, Math.sin(time * 0.5) * 0.5 + 0.5));
    renderer.render(scene, camera);
    
    // Reset render target
    renderer.setRenderTarget(null);
  }
}

/**
 * Animation loop - updates uniforms before render
 * Call this each frame before renderer.render()
 */
export function updateUniforms() {
  uniforms.uTime.value = performance.now() * 0.001;
  
  // Log every 60 frames (approximately 1 second) to confirm GPU loop is active
  if (!updateUniforms.frameCount) updateUniforms.frameCount = 0;
  if (++updateUniforms.frameCount % 60 === 0) {
    console.log('[Uniforms] GPU loop active - uTime:', uniforms.uTime.value.toFixed(2));
  }
}

/**
 * Dispose of all scene resources.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 */
export function disposeScene(renderer, scene) {
  // Dispose background render target
  if (backgroundRenderTarget) {
    backgroundRenderTarget.dispose();
    backgroundRenderTarget = null;
  }
  
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  });
  renderer.dispose();
}
