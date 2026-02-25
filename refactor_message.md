Hi Cascade. We are resetting the direction of this project based on a full
architectural review. Please read this entire message before touching any files.
Then read AGENT_RULES_UPDATE.md and SHADER_PHASES.md in full before writing a single
line of code.

---

## What This Project Is

This is a browser-based AR point cloud experience for the RCA HIDDEN Exhibition,
Hangar space, Battersea. The point cloud represents St. John Tree — a forest
sanctuary of approximately 200,000 points captured with Luma AI and loaded as
a PLY file. One third of those points (~66k) participate in a flocking simulation.
It is deployed as a static site on GitHub Pages. There is no build step.
There is no server. Everything runs client-side.

---

## What Went Wrong

The current implementation has a fundamental performance and architectural problem:
all per-point computation is running in JavaScript on the CPU. This includes
the flocking simulation, the glow calculations, and the position updates.
Running these operations across 200k points in JavaScript every frame is a
performance bug — not a design choice. The CPU cannot do this work fast enough
at any acceptable frame rate on a mobile or exhibition device.

The second problem is that the experience does not yet look like what it needs
to look like. The points are too small, the material is flat, and there is no
sense of the glass, glow, or trails that are central to the artistic vision.

The existing files — glow-shader.js, audio-flock.js, touch-interaction.js —
represent a working starting point but the wrong architecture. We are not
deleting them immediately, but we are restructuring around them.

---

## The Decisions We Have Made

**1. Shaders first, interactivity last.**
The implementation order is now strictly: visual quality first, then flocking
optimisation, then trails, then a hard performance gate, then audio, then touch,
then hand tracking. Do not deviate from this order. Do not add interactivity
features while the rendering is still being built. The full phase plan is in
SHADER_PHASES.md — read it now.

**2. All per-point work moves to the GPU.**
If an operation runs on every point every frame, it belongs in a GLSL shader,
not JavaScript. JavaScript's only job is to update uniform values and run the
boids proxy (maximum 10,000 agents — not 66,000, not 200,000). The vertex shader
does the rest.

**3. The material is glass, not a point cloud.**
Each point must render as a small highly-deformed lens of clear glass that bends
and distorts the environment behind it with chromatic aberration. Points glow
softly with a warm white light and each point preserves its colour even when they are glowing (e.g. the glow 'goes through' the point material so that the final effect is the glow mixed with the point colour). Base alpha is 0.15–0.3 — genuinely
transparent, not milky. When points move they leave trails: luminous smears of
distorted light that decay like breath on cold glass, implemented via ping-pong
render targets.

**4. A single uniforms registry.**
All shader uniforms are declared once in uniformsRegistry.js and nowhere else.
This is the CPU-to-GPU contract for the entire project. See AGENT_RULES.md for
the full uniforms interface.

**5. Separate systems files.**
audio-flock.js must be split into systems/audioSystem.js and
systems/flockingSystem.js. These are separate concerns and must be separate files.
audioSystem.js is not wired to anything until Phase 6.

**6. Naming convention is camelCase with prefix.**
Uniforms: uTime, uAudioBass, uHandPos. Attributes: aIsFlock, aPointIndex.
Varyings: vGlow, vWorldPosition. Do not use underscore style.

---

## Where To Start

Begin with Phase 1 from SHADER_PHASES.md. This means:

1. Create shaders/pointCloud.vert and shaders/pointCloud.frag that replicate
   the current appearance exactly — no visual change yet.
2. Replace the existing Three.js material in scene.js with THREE.ShaderMaterial
   loading those files via fetch().
3. Create uniformsRegistry.js with the full uniforms interface from AGENT_RULES.md.
4. Create the systems/ directory with stub init() and update() functions in
   audioSystem.js, handTracker.js, and flockingSystem.js.
5. Verify the experience looks identical to before Phase 1 on the target device.
6. Update WORKFLOW_STATE.md to record Phase 1 complete.

Do not begin Phase 2 until Phase 1 is verified. Do not combine phases.
Do not start on glass refraction, glow, trails, audio, touch, or hand tracking
until the shader pipeline is confirmed working end to end.

One phase at a time. Before you begin each phase read again the AGENT_RULES_UPDATE.md and SHADER_PHASES.md in full, update the progress in the SHADER_PHASES.md Completion check, and outline the baby steps you aim to take. The exhibition is in the Hangar. It has to work.

I have included a copy of this message in the project root directory as refactor_message.md for your reference.