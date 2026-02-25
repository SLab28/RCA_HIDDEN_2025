# AGENT_RULES.md — Coding Standards for Windsurf Cascade
# HIDDEN Exhibition · AR Point Cloud Experience
# Last updated: February 2026 — Shader-first refactor

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

## Project Vision (Read Before Every Task)

This is an AR point cloud experience for the RCA HIDDEN Exhibition, Hangar space, Battersea.
The point cloud represents St. John Tree — a forest sanctuary rendered as ~200k luminous spirits.

**The aesthetic goal:** Each point is a small, highly-deformed lens of clear glass that bends and
distorts the environment behind it. Points glow softly. When they move, they leave trails — luminous
smears of distorted light that decay like breath on cold glass. The spirits flock together, drift,
and reconvene. They are aware of visitors.

**Implementation order is strict. Do not skip phases:**
1. Shader infrastructure (no visual change — pipeline only)
2. Point visual quality: size, glass refraction, glow, exhibition calibration
3. Flocking optimisation: GPU boids via DataTexture proxy
4. Trails: ping-pong render targets
5. Performance validation — GATE. Do not proceed until 30fps on device.
6. Audio responsiveness
7. Touch responsiveness
8. Hand tracking (MediaPipe)

---

## Windsurf-Specific Rules

1. **Rules location:** `.windsurf/rules/` directory with markdown files
2. **Activation mode:** All project rules set to "Always On"
3. **Keep rules concise:** Each rule file ≤ 12,000 characters (Windsurf limit)
4. **Use Cascade Write Mode** for multi-file implementations
5. **Use Cascade Chat Mode** for architecture questions / planning
6. **Accept terminal commands** only after verifying `(stjohn)` is active
7. **One phase at a time** — complete and verify on device before starting the next

---

## Architecture: The CPU / GPU Split

This is the single most important architectural rule in the project.

| Concern | Where it lives |
|---|---|
| Scene graph, camera, geometry load | Three.js / JavaScript (CPU) |
| Uniforms: update values per frame | Three.js / JavaScript (CPU) |
| Audio FFT analysis | `systems/audioSystem.js` (CPU) |
| Hand position detection | `systems/handTracker.js` (CPU) |
| Boids neighbour lookup | `systems/flockingSystem.js` → DataTexture (CPU → GPU boundary) |
| Per-point position update | Vertex shader (GPU) |
| Per-point repulsion (hand / touch) | Vertex shader (GPU) |
| Per-point glow intensity | Vertex shader → varying → Fragment shader (GPU) |
| Glass refraction, chromatic aberration | Fragment shader (GPU) |
| Trail accumulation | Ping-pong render targets (GPU) |
| Point size, depth scaling | Vertex shader (GPU) |

**Rule:** If an operation runs on every point every frame, it belongs in a shader — not JavaScript.
Moving per-point logic to JavaScript is a performance bug.

---

## File Structure
```
index.html
├── main.js                      # Bootstrap only — imports and calls init
├── scene.js                     # Three.js scene, camera, renderer, render loop
├── uniformsRegistry.js          # Single source of truth for all shader uniforms
├── shaders/
│   ├── pointCloud.vert          # Vertex shader — position, flocking, repulsion, glow
│   └── pointCloud.frag          # Fragment shader — glass, refraction, glow, trails
├── systems/
│   ├── audioSystem.js           # Web Audio API → uAudioBass/Mid/High uniforms
│   ├── handTracker.js           # MediaPipe Hands → uHandPos uniforms
│   └── flockingSystem.js        # Boids proxy → DataTexture → uFlockTex uniform
├── loaders/
│   └── plyLoader.js             # PLY → BufferGeometry with aIsFlock attribute
├── assets/                      # Point clouds, markers
└── lib/                         # Vendored CDN fallbacks
```

---

## Uniforms Interface (camelCase, u prefix)

All uniforms declared in `uniformsRegistry.js`. Never declared in more than one place.
```javascript
export const uniforms = {
  // Core
  uTime:               { value: 0 },
  uPointSize:          { value: 10.0 },

  // Visual / Exhibition calibration
  uAmbientBrightness:  { value: 1.0 },
  uGlowIntensity:      { value: 1.0 },
  uGlowColour:         { value: new THREE.Color(0.85, 0.95, 1.0) },
  uRefractionStrength: { value: 0.15 },
  uBackgroundTex:      { value: null },

  // Flocking
  uFlockTex:           { value: null },
  uFlockStrength:      { value: 1.0 },

  // Audio (Phase 6+)
  uAudioBass:          { value: 0 },
  uAudioMid:           { value: 0 },
  uAudioHigh:          { value: 0 },

  // Touch (Phase 7+)
  uTouchPos:           { value: new THREE.Vector2() },
  uTouchActive:        { value: 0 },

  // Hand tracking (Phase 8+)
  uHandPos:            { value: [new THREE.Vector3(), new THREE.Vector3()] },
  uHandPresence:       { value: 0 },
  uHandRadius:         { value: 0.3 },
};
```

---

## JavaScript Standards

### Module Pattern
```javascript
export function createScene() { /* ... */ }
export function initMarkerTracking(scene) { /* ... */ }
// Never: export default class Scene { }
```

### Variable Declarations
```javascript
const CONFIG = { pointSize: 10.0 };
let currentTime = 0;
// Never: var
```

### Three.js Patterns
```javascript
// ✅ ShaderMaterial with uniformsRegistry
import { uniforms } from './uniformsRegistry.js';
const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader,
  fragmentShader,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// ✅ BufferGeometry with flock attributes
geometry.setAttribute('position',    new THREE.Float32BufferAttribute(positions, 3));
geometry.setAttribute('color',       new THREE.Float32BufferAttribute(colors, 3));
geometry.setAttribute('aIsFlock',    new THREE.Float32BufferAttribute(isFlockFlags, 1));
geometry.setAttribute('aPointIndex', new THREE.Float32BufferAttribute(indices, 1));

// ✅ Animation loop — uniforms before render
function animate() {
  requestAnimationFrame(animate);
  uniforms.uTime.value = performance.now() * 0.001;
  renderer.render(scene, camera);
}

// 🚫 WRONG: Per-point JS position loop
// for (let i = 0; i < positions.length; i++) { positions[i] += delta; }
// This is a performance bug. Move it to the vertex shader.

// 🚫 WRONG: Legacy geometry
// const geo = new THREE.Geometry();
```

### Shader Loading Pattern
```javascript
// Load .vert / .frag as separate files — not inline strings
async function loadShaders() {
  const [vert, frag] = await Promise.all([
    fetch('shaders/pointCloud.vert').then(r => r.text()),
    fetch('shaders/pointCloud.frag').then(r => r.text()),
  ]);
  return { vertexShader: vert, fragmentShader: frag };
}
```

---

## Shader Patterns

### Vertex Shader — Execution Order
```glsl
void main() {
  // 1. Read base position
  // 2. Apply flocking displacement (sample uFlockTex if aIsFlock > 0.5)
  // 3. Apply audio displacement (bass → radial, mid → shimmer, high → flutter)
  // 4. Apply touch repulsion
  // 5. Apply hand repulsion (distance to uHandPos[0] and [1])
  // 6. Compute vGlow from proximity via smoothstep
  // 7. Set gl_PointSize (base × depth scale × audio scale)
  // 8. Set gl_Position
}
```

### Fragment Shader — Execution Order
```glsl
void main() {
  // 1. Discard corners → circular point
  // 2. Sample uBackgroundTex at distorted UV (refraction)
  // 3. Chromatic aberration: split R/G/B offsets
  // 4. Radial glow gradient from point centre
  // 5. Mix glass + glow layers
  // 6. Apply vGlow × uGlowIntensity
  // 7. Output: low base alpha (0.15–0.3) for true transparency
}
```

### Uniform Update Rule
```javascript
// ✅ Batch ALL uniform updates before render
uniforms.uTime.value         = clock.getElapsedTime();
uniforms.uAudioBass.value    = audioSystem.bass;
uniforms.uHandPresence.value = handTracker.presence;
renderer.render(scene, camera);

// 🚫 WRONG: Scattered updates mid-loop
```

---

## Flocking System Rules

- Boids runs on a proxy of **≤ 5,000 agents** in JavaScript — never on all 66k points
- Proxy velocities encoded into `THREE.DataTexture` each frame (RGB32F, one texel per agent)
- Vertex shader samples `uFlockTex` via `aPointIndex` attribute
- Points with `aIsFlock < 0.5` ignore the flock texture
- Boids parameter targets:
  - Separation: strong — spirits never fully overlap
  - Cohesion: soft — drift and reconvene naturally
  - Alignment: medium — murmuration-like collective drift
  - Return-to-origin: gentle — prevents unbounded scatter

---

## Trail System Rules

- Two `THREE.WebGLRenderTarget` instances (ping-pong A/B)
- Each frame: render scene to A, composite A over faded B to screen
- Decay target: trails persist 0.5–1.5 seconds
- Trail render target at **50% screen resolution**
- Trails inherit the glass and glow quality of points
- Depth-aware decay: distant trails fade faster

---

## Exhibition Calibration

The Hangar at RCA Battersea is a dim industrial space. Tune on-site before opening:

| Uniform | Default | Notes |
|---|---|---|
| `uAmbientBrightness` | 1.0 | Increase in dark spaces |
| `uGlowIntensity` | 1.0 | Increase if spirits look faint |
| `uPointSize` | 10.0 | Increase for larger viewing distance |
| `uRefractionStrength` | 0.15 | Increase for more dramatic glass |
| Boids decay rate | 0.98 | Decrease for shorter trails |

Expose as URL parameters for on-site tuning without code changes:
`?brightness=1.4&glowIntensity=1.2&pointSize=12`

---

## Error Handling
```javascript
try {
  const ply = await loader.loadAsync('assets/tree.ply');
} catch (err) {
  console.error('[PointCloud] Failed to load tree.ply:', err);
  showUserError('Could not load point cloud. Check your connection.');
}

if (!navigator.mediaDevices?.getUserMedia) {
  console.warn('[Audio] getUserMedia not available');
  initSilentFlock();
}

// Hand tracking fails gracefully:
// uHandPresence stays 0.0 — experience still works fully without hands
```

---

## Performance Rules

1. **Never allocate in the render loop** — create outside, reuse with `.copy()` / `.set()`
2. **`needsUpdate = true`** — only when base positions actually change
3. **Batch uniform updates** — all before the render call
4. **Profile on target device** — Chrome DevTools → Performance → 4× throttle
5. **Point count budget:** ≤ 500,000 total
6. **Boids proxy budget:** ≤ 5,000 agents in JavaScript
7. **Render target resolution:** 50% of screen resolution
8. **Phase 5 gate:** Do not begin Phases 6–8 until 30fps sustained on exhibition device

---

## Naming Conventions

| Entity | Convention | Example |
|---|---|---|
| Files | kebab-case | `point-cloud-loader.js` |
| Functions | camelCase | `loadPointCloud()` |
| Constants | UPPER_SNAKE | `MAX_POINTS` |
| Classes | PascalCase | `FlockBehaviour` |
| CSS classes | kebab-case | `.loading-overlay` |
| Shader uniforms | camelCase, `u` prefix | `uCameraPos`, `uAudioBass` |
| Shader attributes | camelCase, `a` prefix | `aOriginalPosition`, `aIsFlock` |
| Shader varyings | camelCase, `v` prefix | `vWorldPosition`, `vGlow` |

---

## Commit Convention
```
task(N): brief description

- What was implemented
- Key technical decisions
- Phase: X
```

Example:
```
task(7): move glow calculation to fragment shader

- Removed CPU-side glow loop from glow-shader.js
- vGlow varying passed from vertex shader via hand distance smoothstep
- uGlowIntensity uniform controls overall scale
- Phase: 2
```