# SHADER_PHASES.md — Implementation updated for the shader refactoring
# HIDDEN Exhibition · AR Point Cloud Experience
# Last updated: February 2026

---

## Guiding Principle

Get the cloud looking and feeling extraordinary first. Every visitor's first impression is visual.
Performance, audio, and touch responsiveness are meaningless if the spirits don't look like spirits.
We build from the inside out:

> Rendering quality → Flocking beauty → Interactivity

**The implementation order in this file is strict.**
Windsurf must complete and verify each phase on the target device before beginning the next.
Do not combine phases. Do not skip the Phase 5 performance gate.

---

## Phase 1 — Shader Infrastructure
### Goal: No visual change. Pipeline only.

This phase is invisible to the eye but essential. We are creating the GPU pipeline
that all future work depends on. Nothing about the experience should look different
after this phase — if it does, something is wrong.

**1.1 — Create shader files**
Create `shaders/pointCloud.vert` and `shaders/pointCloud.frag`.
These initially replicate the exact current appearance of the point cloud.
Replace the existing Three.js material in `scene.js` with `THREE.ShaderMaterial`
referencing these files, loaded via `fetch()` as per `AGENT_RULES_UPDATED.md`.
Verify on device: experience looks identical to before.

**1.2 — Create uniformsRegistry.js**
Create `uniformsRegistry.js` in the project root.
Declare all uniforms as specified in `AGENT_RULES.md` — including Phase 6–8 uniforms,
even though they are not yet wired. This is the single source of truth for the
CPU-to-GPU contract. Pass this object to `THREE.ShaderMaterial`.
No uniform should be declared anywhere else in the codebase.

**1.3 — Create systems/ directory**
Create the `systems/` directory. Create three empty stub files:
`systems/audioSystem.js`, `systems/handTracker.js`, `systems/flockingSystem.js`.
Each exports a placeholder `init()` and `update()` function.
These will be filled in later phases.

**1.4 — Update agent context files**
Update `WORKFLOW_STATE.md` to record that Phase 1 is complete and the
shader pipeline is active. Confirm `AGENT_RULES.md` reflects the new architecture.

**Completion check:**
- [x] Experience looks identical to before Phase 1 (but without trails - old architecture removed)
- [x] `THREE.ShaderMaterial` is in use with `.vert` / `.frag` files
- [x] `uniformsRegistry.js` exists and is the only place uniforms are declared
- [x] `systems/` directory exists with stub files
- [x] 30fps minimum on target device

---

## Phase 2 — Point Visual Quality
### Goal: The spirits take form.

This is the centrepiece of the project. The point cloud transforms from a scatter
of pixels into something with presence, beauty, and material character.
Take time here. Tune carefully. This is what visitors will remember.

**2.1 — Point size and circular shape**
In the vertex shader, increase base `gl_PointSize` to a starting value of 10–12px.
Scale inversely with depth so closer points appear larger and more volumetric:
```glsl
gl_PointSize = uPointSize * (1.0 / -mvPosition.z);
```
In the fragment shader, discard fragment corners to render each point as a
perfect circle. Add a soft alpha falloff from centre to edge so points feel
like luminous orbs, not flat discs:
```glsl
vec2 coord = gl_PointCoord - vec2(0.5);
float dist = length(coord);
if (dist > 0.5) discard;
float alpha = smoothstep(0.5, 0.2, dist);
```

**2.2 — Glass refraction material**
This is the defining visual effect. Each point acts as a small lens of
highly-deformed clear glass — bending and distorting the environment behind it.

Technique:
- Each frame, render the scene background to a `THREE.WebGLRenderTarget`
  before rendering the point cloud. Store as `uBackgroundTex`.
- In the fragment shader, sample `uBackgroundTex` at a distorted UV offset.
  The offset is derived from the point's screen-space position and a
  time-animated noise function. Distortion should be aggressive, not subtle.
- Apply chromatic aberration: sample the R, G, and B channels at slightly
  different UV offsets to create the prismatic edge quality of real glass:
```glsl
float r = texture2D(uBackgroundTex, uv + offset * 1.0).r;
float g = texture2D(uBackgroundTex, uv + offset * 0.97).g;
float b = texture2D(uBackgroundTex, uv + offset * 0.94).b;
vec3 refracted = vec3(r, g, b);
```
- Keep base alpha low (0.15–0.3). This is genuinely transparent glass,
  not a milky or frosted surface.
- `uRefractionStrength` uniform controls distortion magnitude. Default: 0.15.

**2.3 — Glow and luminosity**
Add a glow layer on top of the glass material. Each point emits soft light
from its centre — a radial gradient in the fragment shader from a bright
near-white warm-white centre to fully transparent at the edge.
The glow radius extends beyond the core circle so each spirit appears to
carry light with it.

Colour target: cool warm-white to read well
against the dim industrial Hangar environment.

The glow layer is additive — use `THREE.AdditiveBlending` on the material
so overlapping spirits accumulate light naturally.

**2.4 — Exhibition lighting calibration**
Add `uAmbientBrightness` uniform to scale overall luminosity.
Expose key visual parameters as URL query parameters for on-site tuning
without code changes:
```
?brightness=1.4&glowIntensity=1.2&pointSize=12&refractionStrength=0.2
```
Parse these in `main.js` on load and write into the uniforms registry.

**Completion check:**
- [ ] Points render as soft circular orbs, not squares
- [ ] Glass refraction visibly bends environment behind each point
- [ ] Chromatic aberration visible at point edges
- [ ] Glow extends beyond point core
- [ ] URL parameter tuning works
- [ ] 30fps minimum on target device

---

## Phase 3 — Flocking Optimisation
### Goal: The spirits move beautifully.

Before adding trails, the underlying flocking must be fast and feel organic.
If the movement looks mechanical or chaotic, trails will make it worse, not better.

**3.1 — Split audio-flock.js**
Separate `audio-flock.js` into `systems/flockingSystem.js` and `systems/audioSystem.js`.
At this stage `audioSystem.js` is created but not yet wired to any uniforms —
we are only separating concerns cleanly for future phases.

**3.2 — Boids proxy and DataTexture**
Reduce the boids simulation from running on all 66k flock points to a proxy
of maximum 5,000 agents in JavaScript.

Each frame:
1. Run separation, alignment, cohesion, and return-to-origin forces on the 5k proxy
2. Encode proxy velocities into a `THREE.DataTexture` (RGB32F format, one texel per agent)
3. Pass the texture as `uFlockTex` uniform

In the vertex shader:
- Flag flock points via vertex attribute `aIsFlock` (set on PLY load, value 1.0 or 0.0)
- For flock points, sample `uFlockTex` using `aPointIndex` to retrieve velocity
- Add velocity to base position as displacement
- Non-flock points ignore the texture entirely

This moves all per-point computation to the GPU. The CPU only runs 5k agents.

**3.3 — Flocking behaviour tuning**
Tune boids parameters until movement feels like a murmuration — organic,
collective, alive. Target behaviour:

| Parameter | Target feel |
|---|---|
| Separation | Strong — spirits never fully overlap |
| Cohesion | Soft — they drift apart and reconvene naturally |
| Alignment | Medium — collective direction shifts slowly and gracefully |
| Return-to-origin | Gentle constant pull — spirits that drift too far are slowly drawn home |

The movement should never feel chaotic or robotic. If it does, tune before proceeding.

**Completion check:**
- [ ] `audio-flock.js` is split into two separate system files
- [ ] Boids proxy runs on ≤ 5,000 agents in JavaScript
- [ ] DataTexture pipeline is working (velocities reach vertex shader)
- [ ] Flock movement feels organic and murmuration-like
- [ ] 30fps minimum on target device

---

## Phase 4 — Trails
### Goal: The spirits leave their mark.

Trails are the feature that elevates this from an interactive point cloud into
something genuinely haunting. A moving spirit that leaves a dissolving smear
of distorted light behind it feels alive in a way that no static effect achieves.

**4.1 — Ping-pong render targets**
Create two `THREE.WebGLRenderTarget` instances: `rtA` and `rtB`.

Each frame:
1. Render the current scene to `rtA`
2. Composite `rtA` over a faded version of `rtB` onto the screen
3. Swap — `rtB` becomes the new previous frame

The fade multiplier on `rtB` controls trail length. Start at 0.97 (trails
persist approximately 1 second at 30fps). Tune for the Hangar space.

**4.2 — Trail visual quality**
Trails must inherit the glass and glow qualities of the points — they should
look like luminous smears of distorted glass, not blurry pixels.

The ping-pong composite shader should:
- Blend `rtA` (current) over `rtB` (history) with additive blending
- Apply the same chromatic aberration offset to the history layer so
  trails retain their prismatic quality as they decay
- Slightly desaturate the history layer so trails cool in colour as they age

Target: trails that resemble bioluminescent organisms or breath on cold glass.

**4.3 — Depth-aware trail decay**
Trails from points closer to the camera should appear brighter and persist longer.
Trails from distant points should fade more quickly.
Pass camera depth information as a render target channel and use it in the
composite shader to scale the decay multiplier per pixel.

Trail render target resolution: **50% of screen resolution** to manage fill cost.

**Completion check:**
- [ ] Trails visible and decaying at target rate (0.5–1.5 seconds)
- [ ] Trails retain glass and glow character — not plain blur
- [ ] Chromatic aberration present in trail decay
- [ ] Depth-aware fading creates sense of atmosphere
- [ ] Render targets at 50% resolution
- [ ] 30fps minimum on target device

---

## Phase 5 — Performance Validation (GATE)
### Goal: Sustained 30fps on the exhibition device. No exceptions.

**Do not begin Phase 6 until this phase is fully complete and passing.**

This phase has no new features. It exists solely to ensure the experience
is stable and performant before the added cost of interactivity systems.

**5.1 — Profile on target device**
Run the application on the actual exhibition device (the device that will be
used in the Hangar). Use Chrome DevTools Performance tab. Target:
- 30fps sustained minimum on mobile / exhibition device
- 60fps on desktop

If frame budget is exceeded, identify whether the bottleneck is CPU (JavaScript)
or GPU (fill rate, shader complexity) before optimising.

**5.2 — Point count LOD if needed**
If GPU fill rate is the bottleneck, implement level of detail. In the vertex
shader, discard distant points based on depth to reduce fill cost without
changing scene setup:
```glsl
if (-mvPosition.z > uLodDistance) discard;
```

**5.3 — Render target resolution**
Confirm trail and background render targets are running at 50% screen resolution.
If still over budget, test at 40% — quality loss at exhibition scale is minimal.

**5.4 — Boids proxy count**
If CPU frame time is too high, reduce the boids proxy agent count from 5,000
toward 3,000. The visual difference is negligible; the performance gain is significant.

**Completion check:**
- [ ] 30fps sustained minimum on the actual exhibition device
- [ ] CPU frame time < 10ms
- [ ] GPU frame time < 20ms (at 30fps target)
- [ ] No memory leaks (profile over 10+ minutes)
- [ ] Signed off before Phase 6 begins

---

## Phase 6 — Audio Responsiveness
### Goal: The spirits hear.

Only begin this phase when the visual experience is signed off as exhibition-ready
and Phase 5 has passed.

**6.1 — Wire audioSystem.js**
In `systems/audioSystem.js`, connect the Web Audio API analyser to the
microphone input (live ambient sound from the exhibition space).
Each frame, extract normalised frequency band values and write to uniforms:
```javascript
// systems/audioSystem.js — update() called each frame
const bass = average(dataArray, 0, 10) / 255;   // 0.0–1.0
const mid  = average(dataArray, 10, 100) / 255;
const high = average(dataArray, 100, 128) / 255;

uniforms.uAudioBass.value = bass;
uniforms.uAudioMid.value  = mid;
uniforms.uAudioHigh.value = high;
```

**6.2 — Audio-driven displacement in vertex shader**
In the vertex shader, apply additive displacements on top of the flocking position.
Displacements should feel like the spirits are breathing with the sound —
not jumping to it. All values should be subtle:

| Frequency | Effect | Character |
|---|---|---|
| Bass (`uAudioBass`) | Gentle radial expansion of the whole cloud | Like a slow inhale |
| Mid (`uAudioMid`) | Per-point shimmer via GLSL noise | Like leaves in wind |
| High (`uAudioHigh`) | Vertical flutter | Like sparks rising |

**6.3 — Audio-driven glow**
Bass amplitude modulates `uGlowIntensity` by 10–20%.
Loud bass makes the spirits fractionally brighter — a breath of light, not a strobe.

**Completion check:**
- [ ] Microphone input active and analysed each frame
- [ ] Bass, mid, high uniforms updating each frame
- [ ] Audio displacement visible but subtle — breathing, not jumping
- [ ] Glow modulation from bass is visible but not distracting
- [ ] 30fps sustained on exhibition device

---

## Phase 7 — Touch Responsiveness
### Goal: The spirits feel.

**7.1 — Touch displacement**
Wire `touch-interaction.js` to pass `uTouchPos` and `uTouchActive` uniforms
to the shader each frame. In the vertex shader, compute a repulsion vector
from the touch point and add it to nearby points' positions.

The repulsion should feel like pressing a finger into water — an immediate
local response that ripples outward and recovers slowly as `uTouchActive` returns to 0.

**7.2 — Touch glow**
Points within the touch influence radius glow brighter via the `vGlow` varying.
This confirms to the visitor that their touch is having an effect before
they see the points move — a moment of recognition before the response.

**Completion check:**
- [ ] Touch repulsion visible and responsive
- [ ] Recovery (return to flock position) feels organic, not snapping
- [ ] Glow brightens near touch point
- [ ] Works on touch device at 30fps

---

## Phase 8 — Hand Tracking
### Goal: The spirits sense presence.

**8.1 — MediaPipe integration**
Add MediaPipe Hands via CDN in `index.html`.
Create `systems/handTracker.js`. Initialise the camera stream and hand detection.
On each detection result, extract key landmarks for up to 2 hands:
- Wrist: landmark index 0
- Index fingertip: landmark index 8

**8.2 — Coordinate mapping**
Convert MediaPipe's normalised 2D screen coordinates to Three.js world space
using `camera.unproject`:
```javascript
// systems/handTracker.js
function landmarkToWorld(landmark, camera) {
  const ndc = new THREE.Vector3(
    landmark.x * 2 - 1,
   -landmark.y * 2 + 1,
    0.5
  );
  ndc.unproject(camera);
  return ndc;
}
```
Write result to `uHandPos[0]` and `uHandPos[1]`.
Set `uHandPresence` to 1.0 when hands detected.
When no hands detected, decay `uHandPresence` smoothly to 0.0 —
do not snap, the decay should feel like the spirits slowly becoming
unaware of the visitor's absence.

**8.3 — Hand repulsion and glow in vertex shader**
For each point, compute distance to the nearest hand position.
If within `uHandRadius`:
- Compute a repulsion vector (point away from hand)
- Scale repulsion by proximity: closer hand = stronger, faster avoidance
- Set `vGlow = smoothstep(uHandRadius, 0.0, minDist)` for glow intensity

The spirits should feel aware and intentional — easing away from the approaching
hand as if sensing it, glowing as they respond, then drifting back once the
hand withdraws.

**8.4 — Graceful degradation**
If MediaPipe fails to load or camera permission is denied:
- `uHandPresence` stays 0.0
- The experience continues fully — flocking, audio, trails all unaffected
- Log a warning: `[HandTracker] Camera unavailable — hand tracking disabled`

**Completion check:**
- [ ] MediaPipe detects hands reliably in exhibition lighting conditions
- [ ] Hand positions correctly mapped to world space
- [ ] Repulsion visible and feels intentional, not mechanical
- [ ] Glow activates near hands
- [ ] Presence decay is smooth, not snapping
- [ ] Graceful fallback confirmed when camera denied
- [ ] 30fps sustained on exhibition device

---

## Phase Summary

| Phase | What changes | Key deliverable | Gate |
|---|---|---|---|
| 1 | Shader infrastructure | ShaderMaterial pipeline active | Identical appearance to before |
| 2 | Point visual quality | Glass refraction, glow, circular orbs | Exhibition-quality visuals |
| 3 | Flocking optimisation | GPU DataTexture boids | Organic murmuration movement |
| 4 | Trails | Ping-pong render targets | Haunting light trails |
| 5 | Performance validation | **30fps on device** | **HARD GATE — do not proceed without** |
| 6 | Audio responsiveness | Spirits breathe with sound | Subtle, not jumpy |
| 7 | Touch responsiveness | Water-like repulsion | Glow confirms contact |
| 8 | Hand tracking | Spirits sense presence | Graceful degradation |