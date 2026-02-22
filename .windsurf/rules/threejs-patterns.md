# Three.js & WebXR Coding Patterns

## Activation Mode: Always On

## Imports
```javascript
// Use importmap — never bare CDN URLs in JS files
import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
```

## BufferGeometry Only
```javascript
// CORRECT
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));

// WRONG — will crash on Three.js r125+
// const geo = new THREE.Geometry();
```

## Resource Disposal
Every scene object that is created MUST have a corresponding dispose call:
```javascript
geometry.dispose();
material.dispose();
texture?.dispose();
renderer.dispose();
```

## Animation Loop
```javascript
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
// NEVER use setInterval for rendering
```

## Shader Uniforms
Update all uniforms BEFORE render call, not scattered through frame logic:
```javascript
material.uniforms.uTime.value = clock.getElapsedTime();
material.uniforms.uCameraPos.value.copy(camera.position);
renderer.render(scene, camera);
```

## Memory — No Allocations in Render Loop
```javascript
// Pre-allocate OUTSIDE the loop
const _tempVec = new THREE.Vector3();

function animate() {
  _tempVec.set(0, 0, 0); // reuse, never `new`
}
```
