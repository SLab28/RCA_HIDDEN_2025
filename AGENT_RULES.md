# AGENT_RULES.md — Coding Standards for Windsurf Cascade
# HIDDEN Exhibition · AR Point Cloud Experience

---

## 🐍 Environment Rule (HIGHEST PRIORITY)

> **Every terminal command MUST be preceded by `conda activate stjohn`.**
>
> If the terminal prompt does not show `(stjohn)`, the agent must activate it before ANY other command.
>
> Pattern for all terminal blocks:
> ```bash
> conda activate stjohn
> <your actual command here>
> ```

---

## Windsurf-Specific Rules

1. **Rules location:** `.windsurf/rules/` directory with markdown files
2. **Activation mode:** All project rules set to "Always On"
3. **Keep rules concise:** Each rule file ≤ 12,000 characters (Windsurf limit)
4. **Use Cascade Write Mode** for multi-file implementations
5. **Use Cascade Chat Mode** for architecture questions / planning
6. **Accept terminal commands** only after verifying `(stjohn)` is active

---

## JavaScript Standards

### Module Pattern
```javascript
// Every JS file: named exports, no default exports
export function createScene() { /* ... */ }
export function initMarkerTracking(scene) { /* ... */ }

// Never:
// export default class Scene { }  ← hard to tree-shake, ambiguous naming
```

### Variable Declarations
```javascript
const CONFIG = { pointSize: 0.01 };  // immutable bindings
let currentTime = 0;                  // mutable state

// Never: var anything = ...;
```

### Three.js Patterns
```javascript
// ✅ CORRECT: BufferGeometry + dispose
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

// Cleanup
function dispose() {
  geometry.dispose();
  material.dispose();
  if (texture) texture.dispose();
  renderer.dispose();
}

// ✅ CORRECT: Animation loop
function animate() {
  requestAnimationFrame(animate);
  // update logic
  renderer.render(scene, camera);
}

// 🚫 WRONG: Legacy geometry
// const geo = new THREE.Geometry();  // REMOVED in Three.js r125+

// 🚫 WRONG: setInterval for rendering
// setInterval(() => renderer.render(scene, camera), 16);
```

### WebXR / AR Patterns
```javascript
// ✅ CORRECT: Check feature support before using
if ('xr' in navigator) {
  const supported = await navigator.xr.isSessionSupported('immersive-ar');
  if (supported) {
    // init AR
  } else {
    // fallback to 3D viewer
  }
}

// ✅ CORRECT: Request permissions explicitly
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
} catch (err) {
  console.warn('Camera permission denied, falling back to 3D mode');
  initFallbackMode();
}
```

### Shader Patterns
```javascript
// ✅ CORRECT: Inline GLSL with template literals
const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute vec3 aOriginalPosition;
  varying vec3 vWorldPosition;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.0;
  }
`;

// ✅ CORRECT: Uniforms updated per frame
material.uniforms.uCameraPos.value.copy(camera.position);
material.uniforms.uTime.value = performance.now() * 0.001;
```

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files | kebab-case | `point-cloud-loader.js` |
| Functions | camelCase | `loadPointCloud()` |
| Constants | UPPER_SNAKE | `MAX_POINTS` |
| Classes | PascalCase | `FlockBehaviour` |
| CSS classes | kebab-case | `.loading-overlay` |
| Shader uniforms | camelCase with `u` prefix | `uCameraPos` |
| Shader attributes | camelCase with `a` prefix | `aOriginalPosition` |
| Shader varyings | camelCase with `v` prefix | `vWorldPosition` |

---

## Error Handling

```javascript
// ✅ CORRECT: Wrap async operations in try-catch
try {
  const ply = await loader.loadAsync('assets/tree.ply');
} catch (err) {
  console.error('[PointCloud] Failed to load tree.ply:', err);
  showUserError('Could not load point cloud. Check your connection.');
}

// ✅ CORRECT: Feature detection before use
if (!navigator.mediaDevices?.getUserMedia) {
  console.warn('[Audio] getUserMedia not available');
  initSilentFlock();  // graceful fallback
}
```

---

## Performance Rules

1. **Never allocate in the render loop** — create vectors/matrices outside, reuse
2. **`geometry.attributes.position.needsUpdate = true`** — set ONLY when positions change
3. **Batch uniform updates** — set all uniforms before the render call, not scattered
4. **Profile on target device** — Chrome DevTools → Performance tab → throttle to 4× slowdown
5. **Point count budget:** ≤ 500,000 total (tree + flock)

---

## Commit Convention

```
task(N): brief description

- What was implemented
- Key technical decisions
```

Example:
```
task(4): load PLY point cloud with per-vertex colour

- Used PLYLoader from three/addons
- Stored original positions in Float32Array for displacement reference
- Scaled to fit 2m marker footprint
```