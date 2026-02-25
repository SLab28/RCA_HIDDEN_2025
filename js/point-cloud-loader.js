// point-cloud-loader.js — PLY / splat loading + BufferGeometry
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { uniforms } from '../uniformsRegistry.js';

/**
 * Load shaders via fetch with cache-busting and error checking
 */
async function loadShaders() {
  try {
    console.log('[ShaderLoader] Starting shader load...');
    
    const [vert, frag] = await Promise.all([
      fetch('shaders/pointCloud.vert?t=' + Date.now()).then(r => {
        if (!r.ok) throw new Error('Failed to load vertex shader');
        return r.text();
      }),
      fetch('shaders/pointCloud.frag?t=' + Date.now()).then(r => {
        if (!r.ok) throw new Error('Failed to load fragment shader');
        return r.text();
      }),
    ]);
    
    console.log('[ShaderLoader] Vertex shader loaded:', vert.length, 'bytes');
    console.log('[ShaderLoader] Fragment shader loaded:', frag.length, 'bytes');
    console.log('[ShaderLoader] Vertex shader preview:', vert.substring(0, 50) + '...');
    console.log('[ShaderLoader] Fragment shader preview:', frag.substring(0, 50) + '...');
    
    if (vert.length < 100 || frag.length < 50) {
      console.warn('[ShaderLoader] Suspiciously small shader files - may be empty or cached incorrectly');
    }
    
    return { vertexShader: vert, fragmentShader: frag };
  } catch (error) {
    console.error('[ShaderLoader] Failed to load shaders:', error);
    throw error;
  }
}

/**
 * Load a PLY point cloud, scale to fit a target footprint (metres),
 * centre on origin with base at Y=0, and return a Points mesh.
 * Does NOT add to scene — caller decides where to place it.
 *
 * @param {string} url — path to the .ply file
 * @param {object} [options]
 * @param {number} [options.footprint=2] — max width/depth in real-world metres
 * @param {number} [options.pointSize=0.012] — base point sprite size
 * @param {function} [options.onProgress] — XHR progress callback
 * @returns {Promise<{ points: THREE.Points, originalPositions: Float32Array, geometry: THREE.BufferGeometry }>}
 */
export async function loadPointCloud(url, options = {}) {
  const footprint = options.footprint ?? 2;
  const pointSize = options.pointSize ?? 0.012;
  const onProgress = options.onProgress ?? null;

  const loader = new PLYLoader();

  const geometry = await new Promise((resolve, reject) => {
    loader.load(
      url,
      (geo) => resolve(geo),
      (event) => { if (onProgress) onProgress(event); },
      (err) => reject(err)
    );
  });

  const vertexCount = geometry.attributes.position.count;
  console.log(`[PointCloud] Loaded ${vertexCount} vertices from ${url}`);

  // Ensure colour attribute is normalised to 0–1
  if (geometry.attributes.color) {
    const colorArr = geometry.attributes.color.array;
    let needsNormalise = false;
    for (let i = 0; i < Math.min(colorArr.length, 30); i++) {
      if (colorArr[i] > 1.0) { needsNormalise = true; break; }
    }
    if (needsNormalise) {
      for (let i = 0; i < colorArr.length; i++) {
        colorArr[i] /= 255;
      }
      geometry.attributes.color.needsUpdate = true;
      console.log('[PointCloud] Normalised colour values from 0-255 to 0-1');
    }
  }

  // Compute bounding box for scaling and centring
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const centre = new THREE.Vector3();
  bbox.getCenter(centre);

  console.log(`[PointCloud] Raw bounding box: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);

  // Scale to fit within footprint (metres) based on max horizontal extent
  const maxHorizontal = Math.max(size.x, size.z);
  const scaleFactor = maxHorizontal > 0 ? footprint / maxHorizontal : 1;
  console.log(`[PointCloud] Scale factor: ${scaleFactor.toFixed(4)} (→ ${footprint}m footprint)`);

  // Apply scale, centre horizontally, base at Y=0
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]     = (positions[i]     - centre.x) * scaleFactor;
    positions[i + 1] = (positions[i + 1] - bbox.min.y) * scaleFactor;
    positions[i + 2] = (positions[i + 2] - centre.z) * scaleFactor;
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeBoundingBox();

  // Store original positions for animation reference (dissolve, touch, etc.)
  const originalPositions = new Float32Array(positions.length);
  originalPositions.set(positions);

  // Load shaders and create material
  const shaders = await loadShaders();
  
  // Use uniform values directly from registry (no overrides)
  uniforms.uFadeProgress.value = 0.0; // 0.0 = hidden, 1.0 = fully visible
  uniforms.uTreeHeight.value = 0.0; // Will be set after geometry is computed

  console.log('[ShaderLoader] Creating ShaderMaterial with loaded shaders...');
  console.log('[ShaderLoader] Uniforms count:', Object.keys(uniforms).length);
  console.log('[ShaderLoader] Uniform names:', Object.keys(uniforms));

  // Circular point sprite material (custom shader)
  const material = new THREE.ShaderMaterial({
    vertexShader: shaders.vertexShader,
    fragmentShader: shaders.fragmentShader,
    uniforms: uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // For glow accumulation
  });

  console.log('[ShaderLoader] Material created:', material.constructor.name);
  console.log('[ShaderLoader] Vertex shader length:', material.vertexShader.length);
  console.log('[ShaderLoader] Fragment shader length:', material.fragmentShader.length);

  const points = new THREE.Points(geometry, material);
  points.name = 'point-cloud';
  points.frustumCulled = false;

  const finalSize = new THREE.Vector3();
  geometry.boundingBox.getSize(finalSize);
  console.log(`[PointCloud] Final size: ${finalSize.x.toFixed(2)} × ${finalSize.y.toFixed(2)} × ${finalSize.z.toFixed(2)}m`);
  
  // Set tree height uniform for base-to-top fade animation
  uniforms.uTreeHeight.value = finalSize.y;

  return { points, originalPositions, geometry, material };
}
