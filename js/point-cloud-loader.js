// point-cloud-loader.js — PLY / splat loading + BufferGeometry
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

// --- Circular point sprite shaders ---
const POINT_VERTEX_SHADER = /* glsl */ `
  attribute vec3 color;
  varying vec3 vColor;
  uniform float uPointSize;

  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uPointSize * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const POINT_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;

  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float alpha = 1.0 - smoothstep(0.35, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha);
  }
`;

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

  // Circular point sprite material (custom shader)
  const material = new THREE.ShaderMaterial({
    vertexShader: POINT_VERTEX_SHADER,
    fragmentShader: POINT_FRAGMENT_SHADER,
    uniforms: {
      uPointSize: { value: pointSize },
    },
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'point-cloud';
  points.frustumCulled = false;

  const finalSize = new THREE.Vector3();
  geometry.boundingBox.getSize(finalSize);
  console.log(`[PointCloud] Final size: ${finalSize.x.toFixed(2)} × ${finalSize.y.toFixed(2)} × ${finalSize.z.toFixed(2)}m`);

  return { points, originalPositions, geometry };
}
