# Project Constitution Rules

## Activation Mode: Always On

## LOCKED Decisions — Do NOT Change Without Human Approval

- **Framework:** Three.js r160+ via CDN (ES modules, importmap)
- **AR:** AR.js or MindAR.js for marker tracking
- **Hosting:** GitHub Pages + Hostinger DNS (static only)
- **Build step:** NONE — no webpack, vite, rollup, npm
- **Server code:** NONE in MVP
- **Environment:** Anaconda `stjohn` for all terminal operations

## Three-Tier Boundaries

### ✅ ALWAYS
- Use ES module imports via CDN
- Dispose all Three.js objects (geometries, materials, textures)
- Use BufferGeometry (never legacy Geometry)
- Use requestAnimationFrame (never setInterval for rendering)
- Pre-allocate vectors outside render loops

### ⚠️ ASK FIRST
- Adding new JS files beyond existing structure
- Changing tracking library or marker type
- Exceeding 500K point budget
- Any external API calls beyond CDN

### 🚫 NEVER
- npm install, npx, yarn, or any Node package manager
- Build tools (webpack, vite, rollup, parcel, esbuild)
- `var` keyword — use const/let
- `new THREE.Geometry()` — removed in r125+
- Synchronous XHR
- document.write()
- Running terminal commands without (stjohn) env active
