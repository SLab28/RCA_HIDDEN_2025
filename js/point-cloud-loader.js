// point-cloud-loader.js — PLY / splat loading + BufferGeometry
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

/**
 * Load a PLY point cloud, scale to fit a target footprint, centre on origin,
 * and add to the provided parent group.
 *
 * @param {string} url — path to the .ply file
 * @param {THREE.Group} parentGroup — group to add the Points mesh to
 * @param {object} [options]
 * @param {number} [options.footprint=2] — max width/depth in metres
 * @param {number} [options.pointSize=0.008] — point sprite size
 * @param {function} [options.onProgress] — progress callback (event)
 * @returns {Promise<{ points: THREE.Points, originalPositions: Float32Array, geometry: THREE.BufferGeometry }>}
 */
export async function loadPointCloud(url, parentGroup, options = {}) {
  const footprint = options.footprint ?? 2;
  const pointSize = options.pointSize ?? 0.008;
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
    // PLYLoader for uchar returns 0–255; check if values exceed 1
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

  console.log(`[PointCloud] Bounding box: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);
  console.log(`[PointCloud] Centre: (${centre.x.toFixed(2)}, ${centre.y.toFixed(2)}, ${centre.z.toFixed(2)})`);

  // Scale to fit within footprint (based on max of width and depth)
  const maxHorizontal = Math.max(size.x, size.z);
  const scaleFactor = maxHorizontal > 0 ? footprint / maxHorizontal : 1;
  console.log(`[PointCloud] Scale factor: ${scaleFactor.toFixed(4)} (fitting to ${footprint}m footprint)`);

  // Apply scale and re-centre by transforming the positions directly
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]     = (positions[i]     - centre.x) * scaleFactor;
    positions[i + 1] = (positions[i + 1] - bbox.min.y) * scaleFactor; // base at Y=0
    positions[i + 2] = (positions[i + 2] - centre.z) * scaleFactor;
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeBoundingBox();

  // Store original positions for animation reference (dissolve, touch, etc.)
  const originalPositions = new Float32Array(positions.length);
  originalPositions.set(positions);

  // Create material and Points mesh
  const material = new THREE.PointsMaterial({
    vertexColors: true,
    size: pointSize,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'point-cloud';
  parentGroup.add(points);

  const finalSize = new THREE.Vector3();
  geometry.boundingBox.getSize(finalSize);
  console.log(`[PointCloud] Final size: ${finalSize.x.toFixed(2)} × ${finalSize.y.toFixed(2)} × ${finalSize.z.toFixed(2)}m`);

  return { points, originalPositions, geometry };
}
