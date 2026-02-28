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
 * Load a PLY point cloud and prepare it for GPU-driven shader rendering.
 *
 * CRITICAL: Vertex positions are NOT modified. Centering and scaling are applied
 * via mesh-level transforms (points.position, points.scale) so the vertex shader
 * receives raw PLY coordinates — matching the playground's coordinate space exactly.
 *
 * @param {string} url — path to the .ply file
 * @param {object} [options]
 * @param {function} [options.onProgress] — XHR progress callback
 * @returns {Promise<{ points: THREE.Points, geometry: THREE.BufferGeometry, material: THREE.ShaderMaterial }>}
 */
export async function loadPointCloud(url, options = {}) {
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

  // Ensure colour attribute exists and is normalised to 0–1
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
  } else {
    // Default grey if PLY has no vertex colors
    const c = new Float32Array(vertexCount * 3).fill(0.8);
    geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
    console.log('[PointCloud] No vertex colors in PLY — using default grey');
  }

  // ── Assign particleRole attribute (30% fireflies, deterministic xorshift hash) ──
  const roles = new Float32Array(vertexCount);
  let seed = 0xdeadbeef;
  for (let i = 0; i < vertexCount; i++) {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 17)) >>> 0;
    seed = (seed ^ (seed << 5))  >>> 0;
    roles[i] = (seed / 0xffffffff) < 0.30 ? 1.0 : 0.0;
  }
  geometry.setAttribute('particleRole', new THREE.BufferAttribute(roles, 1));
  console.log(`[PointCloud] Assigned particleRole: ${roles.filter(v => v > 0.5).length} fireflies / ${vertexCount} total`);

  // ── posOffset attribute (zero-filled, for future touch physics) ──
  const offBuf = new Float32Array(vertexCount * 3);
  const posOffsetAttr = new THREE.BufferAttribute(offBuf, 3);
  posOffsetAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('posOffset', posOffsetAttr);

  // ── Compute bounding box for mesh-level transforms ──
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox;
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const centre = new THREE.Vector3();
  bbox.getCenter(centre);

  console.log(`[PointCloud] Raw bounding box: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);

  // Load shaders
  const shaders = await loadShaders();

  // Start hidden for fade-in
  uniforms.uOpacity.value = 0.0;

  console.log('[ShaderLoader] Creating ShaderMaterial with loaded shaders...');

  // GPU-driven point cloud material
  // Additive blending restores color pop/glow accumulation in AR
  const material = new THREE.ShaderMaterial({
    vertexShader: shaders.vertexShader,
    fragmentShader: shaders.fragmentShader,
    uniforms: uniforms,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'point-cloud';
  points.frustumCulled = false;

  // ── Mesh-level transforms (DO NOT modify vertex positions) ──
  // Centre the mesh so its bounding box centre is at origin
  points.position.set(-centre.x, -centre.y, -centre.z);
  // Normalise scale: largest axis maps to 6 world units
  const uniformScale = 13 / Math.max(size.x, size.y, size.z);
  points.scale.setScalar(uniformScale);

  console.log(`[PointCloud] Mesh offset: (${(-centre.x).toFixed(2)}, ${(-centre.y).toFixed(2)}, ${(-centre.z).toFixed(2)})`);
  console.log(`[PointCloud] Mesh scale: ${uniformScale.toFixed(4)}`);

  return { points, geometry, material };
}
