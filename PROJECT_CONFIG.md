# PROJECT_CONFIG.md — Project Constitution
# HIDDEN Exhibition · AR Point Cloud Experience
# IDE: Windsurf (Cascade Agent) | Env: Anaconda `stjohn`

---

## 🔒 LOCKED DECISIONS (Do NOT change without human approval)

| Decision | Value | Rationale |
|---|---|---|
| IDE | **Windsurf** (Cascade agent) | Primary development environment |
| Python Env | **Anaconda `stjohn`** | All terminal commands run inside this env |
| Runtime | Browser (Chrome on Android) | WebXR target platform |
| Framework | Three.js r160+ (ES modules via CDN) | No build step, no npm |
| Marker Tracking | AR.js or MindAR.js | Marker-based spatial anchoring |
| Splat Viewer | GaussianSplats3D / PLYLoader fallback | Point cloud rendering |
| Audio | Web Audio API (native) | Microphone FFT analysis |
| Lighting | WebXR Lighting Estimation API | Environment-matched glow |
| Hosting | GitHub Pages + custom domain (Hostinger DNS) | Static only, no server |
| Build Step | **NONE** | All deps via CDN `<script type="module">` |
| Server Code | **NONE in MVP** | No Node, no npm, no WebSocket server |

---

## 🐍 Anaconda Environment

**Environment name:** `stjohn`

### First-time setup (run once)
```bash
conda create -n stjohn python=3.11 -y
conda activate stjohn
pip install http-server  # or use: python -m http.server
```

### Every terminal session
```bash
conda activate stjohn
```

> ⚠️ **CRITICAL**: Cascade MUST run `conda activate stjohn` as the FIRST command in EVERY terminal interaction. No terminal command should execute outside this environment. If the terminal does not show `(stjohn)` in the prompt, stop and activate it before proceeding.

---

## 📁 Directory Structure

```
stjohn-hidden/
├── .windsurf/
│   └── rules/
│       ├── project-rules.md        # Always On — project constitution (this file's rules)
│       ├── threejs-patterns.md     # Always On — Three.js/WebXR coding standards
│       ├── terminal-rules.md       # Always On — conda activation enforcement
│       └── pitfalls.md             # Always On — known failure modes
├── index.html                      # Entry point — single HTML file
├── css/
│   └── main.css
├── js/
│   ├── app.js                      # Bootstrap & AR session init
│   ├── scene.js                    # Three.js scene, camera, renderer
│   ├── marker-tracking.js          # AR.js / MindAR anchor logic
│   ├── point-cloud-loader.js       # PLY / splat loading + BufferGeometry
│   ├── glow-shader.js              # Proximity glow + light estimation
│   ├── touch-interaction.js        # Raycaster + fluid displacement
│   ├── audio-flock.js              # Mic FFT → flock behaviour
│   └── dissolve.js                 # Idle timer → point scatter
├── assets/
│   ├── tree.ply                    # Main olive tree point cloud
│   ├── flock-points.ply            # Surrounding flock particles
│   └── marker.patt / marker.mind   # AR tracking marker
├── lib/                            # Vendored CDN fallbacks (offline safety)
│   ├── three.module.min.js
│   ├── ar.js / mindar-image.js
│   └── gaussian-splats-3d.module.js
├── TASKS.md
├── AGENT_RULES.md
├── KNOWN_PITFALLS.md
├── TESTING_CHECKLIST.md
├── WORKFLOW_STATE.md
└── README.md
```

---

## 🎯 Exhibition Context

| Parameter | Value |
|---|---|
| Location | Royal College of Art, London |
| Floor Marker | 2 × 2 m white tape square |
| Physical Setup | Screen on plinth, QR code plinth, tape square |
| Target Device | Mid-range Android (Pixel 6 class), Chrome |
| FPS Target | ≥ 30 fps sustained |
| Total Assets | < 20 MB |
| Point Budget | ≤ 500,000 points (tree + flock combined) |

---

## 🧱 Three-Tier Boundary System

### ✅ ALWAYS (agent does autonomously)
- Activate `conda activate stjohn` before any terminal command
- Use ES module imports via CDN (`import * as THREE from '...'`)
- Dispose geometries, materials, textures in cleanup
- Use `BufferGeometry` (never legacy `Geometry`)
- Use `requestAnimationFrame` loop (never `setInterval`)
- Place AR content relative to marker anchor, not world origin
- Test on `python -m http.server 8080` (from stjohn env)
- Commit working code at each task boundary

### ⚠️ ASK FIRST (agent must confirm with human)
- Changing any LOCKED decision above
- Adding new JS files beyond the directory structure
- Modifying marker type or tracking library
- Changing point cloud file format
- Exceeding 500K point budget
- Any network request to external APIs (beyond CDN)

### 🚫 NEVER (hard constraints)
- `npm install`, `npx`, `yarn`, or any Node package manager
- `pip install` in the global Python (always use stjohn env)
- Build tools: webpack, vite, rollup, parcel, esbuild
- `document.write()` or inline `<script>` without `type="module"`
- `var` keyword (use `const` / `let`)
- `new THREE.Geometry()` — deprecated, will crash
- Synchronous XHR (`XMLHttpRequest` with `async=false`)
- WebSocket server code in MVP
- Modifying files outside `stjohn-hidden/` directory
- Running terminal commands without `(stjohn)` env active

---

## 🌐 CDN Sources (Pinned Versions)

```html
<!-- Three.js r160 -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>

<!-- AR.js (if marker-based) -->
<script src="https://raw.githack.com/AR-js-org/AR.js/master/three.js/build/ar-threex.js"></script>

<!-- GaussianSplats3D -->
<script type="module">
  import * as GaussianSplats3D from 'https://cdn.jsdelivr.net/npm/@mkkellogg/gaussian-splats-3d@0.4.0/build/gaussian-splats-3d.module.min.js';
</script>
```

---

## 🚀 Local Development Server

```bash
# Always from project root, inside stjohn env
conda activate stjohn
cd stjohn-hidden
python -m http.server 8080
# Then open Chrome: http://localhost:8080
# For mobile testing: use local IP e.g. http://192.168.x.x:8080
```

> HTTPS is required for WebXR camera access on mobile. For local testing use Chrome flags or ngrok:
> ```bash
> # Option A: Chrome flag (device)
> chrome://flags/#unsafely-treat-insecure-origin-as-secure
> # Add: http://192.168.x.x:8080
>
> # Option B: ngrok tunnel (provides HTTPS)
> conda activate stjohn
> ngrok http 8080
> ```

---

## 📱 Multi-User Extension (POST-MVP)

Not required for MVP. If time permits:
- Use lightweight WebSocket on Fly.io / Render / Railway (free tier)
- Broadcast point positions as Float32Array snapshots
- See TASKS.md Task 9 for details