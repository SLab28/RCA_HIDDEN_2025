# TASKS.md — Sequential Implementation Tasks
# IDE: Windsurf (Cascade) | Env: Anaconda `stjohn`

---

## Pre-Flight Checklist (before ANY task)

```bash
# 1. Activate environment
conda activate stjohn

# 2. Verify environment
python --version  # Should show Python 3.11.x
which python      # Should point to anaconda envs/stjohn/...

# 3. Start dev server (if not running)
cd stjohn-hidden
python -m http.server 8080
```

---

## Task 1: Project Scaffold & Dev Server

**Goal:** Create directory structure, index.html, empty JS modules, verify dev server.

**Input:** PROJECT_CONFIG.md directory structure

**Steps:**
1. `conda activate stjohn`
2. Create all directories and empty placeholder files per PROJECT_CONFIG.md
3. Create `index.html` with importmap, module scripts, and basic `<body>`
4. Create `css/main.css` with `body { margin: 0; overflow: hidden; }`
5. Create `js/app.js` with a console.log confirming module loading
6. Run `python -m http.server 8080` and verify in browser

**Acceptance Criteria:**
- [ ] All directories and files exist
- [ ] `index.html` loads without console errors
- [ ] Console shows "HIDDEN AR app initialising" message
- [ ] Dev server runs on port 8080 from stjohn env

**Dependencies:** None
**Estimated Effort:** 30 min

---

## Task 2: Three.js Scene Bootstrap

**Goal:** Initialise Three.js scene, camera, renderer, and animation loop.

**Input:** Task 1 scaffold

**Steps:**
1. In `js/scene.js`: export `createScene()` returning `{ scene, camera, renderer }`
2. Renderer: `antialias: true`, `alpha: true`, `outputColorSpace: THREE.SRGBColorSpace`
3. Camera: `PerspectiveCamera(70, aspect, 0.01, 20)`
4. Add resize handler via `ResizeObserver` or `window resize`
5. In `js/app.js`: import scene module, start `requestAnimationFrame` loop
6. Add a test cube (`BoxGeometry` + `MeshNormalMaterial`) to verify rendering

**Acceptance Criteria:**
- [ ] Coloured test cube visible and rotating on screen
- [ ] No console errors
- [ ] Canvas auto-resizes on window resize
- [ ] 60 fps on desktop (check via Stats.js or console)

**Dependencies:** Task 1
**Estimated Effort:** 45 min

---

## Task 3: AR Session & Marker Tracking

**Goal:** Activate WebXR/AR.js session, detect floor marker, anchor content.

**Input:** Task 2 scene, marker pattern file

**Steps:**
1. In `js/marker-tracking.js`: export `initMarkerTracking(scene)`
2. Configure AR.js with `THREEx.ArToolkitSource` (webcam) and `THREEx.ArToolkitContext`
3. Create `THREEx.ArMarkerControls` linked to `marker.patt`
4. Create an anchor `THREE.Group` that follows the marker
5. Place test cube inside anchor group to verify tracking
6. Add marker-lost / marker-found event handling (opacity fade)

**Acceptance Criteria:**
- [ ] Camera feed visible as AR background
- [ ] Test cube appears on printed/displayed marker
- [ ] Cube stays anchored when device moves
- [ ] Console logs marker found/lost events
- [ ] Works on Android Chrome with camera permission

**Dependencies:** Task 2
**Estimated Effort:** 1.5 hours

---

## Task 4: Point Cloud Loading & Rendering

**Goal:** Load .ply file, create BufferGeometry with per-point RGB, render as point cloud.

**Input:** Task 3 anchor group, tree.ply file

**Steps:**
1. In `js/point-cloud-loader.js`: export `loadPointCloud(url, anchorGroup)`
2. Use `PLYLoader` from Three.js addons to load `.ply`
3. Extract position and color attributes into `BufferGeometry`
4. Create `Points` object with `PointsMaterial({ vertexColors: true, size: 0.01 })`
5. Scale and position point cloud to fit within 2×2m marker area
6. Add to anchor group
7. Store original positions in a separate `Float32Array` for animation reference

**Acceptance Criteria:**
- [ ] Point cloud renders with correct per-point colours
- [ ] Point cloud is positioned relative to marker (centred)
- [ ] Point cloud fits within 2m × 2m footprint
- [ ] ≥ 30 fps with full point cloud on desktop
- [ ] Original positions stored for later displacement/restore

**Dependencies:** Task 3
**Estimated Effort:** 1.5 hours

---

## Task 5: Proximity Glow Effect

**Goal:** Points glow subtly brighter near the visitor; blend with environment lighting.

**Input:** Task 4 point cloud

**Steps:**
1. In `js/glow-shader.js`: create custom `ShaderMaterial` for points
2. Vertex shader: pass world position to fragment
3. Fragment shader: increase emissive based on `1.0 / distance(pointWorldPos, cameraPos)`
4. Clamp glow to subtle range (0.0 – 0.15 additive)
5. If WebXR Lighting Estimation API available: query `XRLightProbe`, pass ambient RGB as uniform
6. If not available: use default warm ambient (0.4, 0.35, 0.3)
7. Blend shader lighting with environment light estimate

**Acceptance Criteria:**
- [ ] Points near camera appear subtly brighter
- [ ] Glow is barely noticeable (not a halo or bloom)
- [ ] Light estimation adjusts if environment light changes
- [ ] Fallback works without WebXR lighting API
- [ ] No fps drop below 30

**Dependencies:** Task 4
**Estimated Effort:** 2 hours

---

## Task 6: Touch Interaction (Fluid Displacement)

**Goal:** Touch pushes nearby points outward with fluid-like physics, points drift back slowly.

**Input:** Task 4 point cloud with stored original positions

**Steps:**
1. In `js/touch-interaction.js`: export `initTouchInteraction(pointCloud, camera)`
2. On `touchstart` / `touchmove`: cast ray from touch point using `Raycaster`
3. Find intersection point on bounding sphere / plane of point cloud
4. For each point within radius (e.g., 0.15m): apply radial displacement force
5. Displacement: `currentPos += normalize(pointPos - touchPos) * force * falloff`
6. Each frame: lerp displaced points back toward original position (`t = 0.02`)
7. Update `geometry.attributes.position.needsUpdate = true` each frame

**Acceptance Criteria:**
- [ ] Touching the tree causes visible point displacement
- [ ] Displacement feels fluid (radial push, smooth falloff)
- [ ] Points drift back to original positions when touch releases
- [ ] Works with multi-touch (each touch point is independent)
- [ ] No fps drop below 30

**Dependencies:** Task 4 (parallel with Task 7 after Task 5)
**Estimated Effort:** 2 hours

---

## Task 7: Audio-Reactive Flock

**Goal:** Flock points around the tree move in boid-like patterns driven by ambient sound.

**Input:** Task 4 (flock-points.ply or procedurally generated particles)

**Steps:**
1. In `js/audio-flock.js`: export `initAudioFlock(scene, anchorGroup)`
2. `navigator.mediaDevices.getUserMedia({ audio: true })` → `AnalyserNode`
3. FFT: compute amplitude (RMS of frequency data) and variability (std deviation across bins)
4. Create flock particles as separate `Points` with ~2000–5000 points
5. Each frame: update positions using simplified boid rules:
   - Separation: avoid crowding neighbours
   - Alignment: steer toward average heading
   - Cohesion: steer toward centre of mass
6. Amplitude → flock speed multiplier (louder = faster)
7. Variability → flock spread radius (more varied sound = wider spread)

**Acceptance Criteria:**
- [ ] Flock particles visible around the tree
- [ ] Particles exhibit emergent flocking behaviour
- [ ] Louder sound → faster flock movement
- [ ] Varied sound spectrum → wider flock dispersion
- [ ] Graceful fallback if microphone permission denied (static gentle drift)
- [ ] ≥ 30 fps

**Dependencies:** Task 4 (parallel with Task 6 after Task 5)
**Estimated Effort:** 2.5 hours

---

## Task 8: Dissolution Effect

**Goal:** Tree points gradually scatter/dissolve after ~30s of idle (no touch).

**Input:** Tasks 4, 6 (touch interaction resets timer)

**Steps:**
1. In `js/dissolve.js`: export `initDissolve(pointCloud, touchInteraction)`
2. Track idle timer: reset on any touch event
3. After 30s idle: begin dissolution
4. Dissolution: each point gets random velocity vector (small magnitude)
5. Each frame during dissolution: `position += velocity * deltaTime`
6. Apply slight gravity-like downward drift
7. Optional: reduce point opacity over time (alpha in shader)
8. On touch during dissolution: reverse — lerp points back to original positions

**Acceptance Criteria:**
- [ ] Points start dissolving after 30s of no interaction
- [ ] Dissolution looks organic (not uniform explosion)
- [ ] Touch during dissolution reverses the effect
- [ ] After full dissolution, point cloud can reform on next touch
- [ ] Timer resets correctly on each interaction

**Dependencies:** Tasks 4, 6
**Estimated Effort:** 1.5 hours

---

## Task 9: Integration, Polish & Deploy

**Goal:** Wire all modules together, performance tune, deploy to GitHub Pages.

**Input:** All previous tasks

**Steps:**
1. Wire all modules in `app.js` with correct initialisation order
2. Performance audit: profile on Android device
   - Reduce point count if fps < 30
   - Adjust glow calculation frequency (every 2nd frame)
   - LOD: reduce flock count at distance
3. Add loading screen / progress indicator
4. Ensure graceful degradation (no AR → show point cloud in 3D viewer mode)
5. Push to GitHub, enable GitHub Pages on `main` branch
6. Configure Hostinger DNS: CNAME → `<username>.github.io`
7. Verify HTTPS works on custom domain
8. Test full flow: scan QR → open URL → grant camera + mic → experience

**Acceptance Criteria:**
- [ ] Full experience works end-to-end on Android Chrome
- [ ] ≥ 30 fps on Pixel 6 class device
- [ ] Total page load (assets + code) < 20 MB
- [ ] Custom domain serves over HTTPS
- [ ] QR code opens correct URL
- [ ] Graceful fallback if AR not supported

**Dependencies:** All tasks 1–8
**Estimated Effort:** 3 hours

---

## Optional: Task 10 — Multi-User Shared Session (POST-MVP)

**Goal:** Multiple visitors see same point cloud state via WebSocket sync.

Only attempt if Tasks 1–9 are complete and stable.

- Deploy lightweight WebSocket relay on Fly.io (free tier)
- Broadcast point displacement deltas as compressed Float32Array
- Merge remote + local displacement forces
- Handle disconnect / reconnect gracefully

**Dependencies:** Task 9 complete and deployed