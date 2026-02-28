# WORKFLOW_STATE.md — Progress Tracker
# IDE: Windsurf (Cascade) | Env: Anaconda `stjohn`

---

## Current State

| Field | Value |
|---|---|
| Phase | 2 - GPU_SHADER_MIGRATION |
| Current Task | Shader migration from playground complete — needs visual testing |
| Status | IMPLEMENTATION COMPLETE — AWAITING TEST |
| Blocked By | Local dev server test to verify visuals |
| Conda Env | `stjohn` (must be active) |

---

## Task Progress

| Task | Status | Notes |
|---|---|---|
| 1. Scaffold | ✅ DONE | Committed dcf59ae, pushed to GitHub |
| 2. Three.js Scene | ✅ DONE | scene.js + app.js with test cube |
| 3. AR + Marker | ✅ DONE | AR.js detection-only → WebXR world-tracked persistence |
| 4. Point Cloud | ✅ DONE | PLYLoader, 2m footprint (metres), circular sprites, WebXR placement |
| **S1. GPU Shader Migration** | ✅ DONE | Ported playground shaders (simplex noise, firefly drift, proximity glow) |
| **S2. Mesh-level transforms** | ✅ DONE | Vertex positions untouched; centering/scaling via mesh transform |
| **S3. particleRole + posOffset** | ✅ DONE | 30% fireflies (xorshift hash), posOffset zero-filled for future touch |
| **S4. CPU boids removed** | ✅ DONE | flocking-animation.js gutted; all animation is GPU-driven |
| **S5. Glass refraction removed** | ✅ DONE | backgroundRenderTarget removed; fragment uses proximity glow |
| **S6. Opacity fade-in** | ✅ DONE | Simple uOpacity ramp (2s ease-in-out cubic) |
| 5. Touch physics | ⬜ DEFERRED | posOffset attribute ready; CPU integrator not yet implemented |
| 6. Audio reactivity | ⬜ NOT_STARTED | audioAmp uniform wired but always 0.0 |
| 7. Integration + polish | ⬜ NOT_STARTED | |

### TODO
- **Test AdditiveBlending vs NormalBlending** once shaders are visually verified on device

---

## Decision Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| 1 | Windsurf as IDE | User preference, Cascade agent for autonomous coding | 2026-02-22 |
| 2 | Anaconda env `stjohn` | Consistent Python env across all terminal sessions | 2026-02-22 |
| 3 | `.windsurf/rules/` for project rules | Windsurf Wave 8+ standard, "Always On" activation | 2026-02-22 |
| 4 | No build step | GitHub Pages static hosting, CDN-only deps | 2026-02-22 |
| 5 | GitHub repo: SLab28/RCA_HIDDEN_2025 | App files in repo root, GitHub Pages from main branch | 2026-02-22 |
| 6 | Windsurf rules in .windsurf/rules/ | Moved from root WINDSURF_RULE_*.md to proper location | 2026-02-22 |
| 7 | Hybrid AR.js → WebXR | AR.js for marker detection only; WebXR for world-tracked persistence (no flags) | 2026-02-22 |
| 8 | Point budget raised to ~650K | 389K tree + 259K flock subsampled, will profile in Task 9 | 2026-02-22 |
| 9 | Shader-first architecture | Move all per-point computation to GPU, create uniforms registry | 2026-02-25 |
| 10 | Phase 1 complete | Shader infrastructure pipeline active, trails removed (old architecture) | 2026-02-25 |
| 11 | GPU shader migration from playground | Ported simplex noise, firefly drift, proximity glow shaders; mesh-level transforms (no vertex rewriting) | 2026-02-28 |
| 12 | AdditiveBlending kept for AR | Better against camera passthrough; TODO test NormalBlending later | 2026-02-28 |
| 13 | CPU boids replaced by GPU animation | flocking-animation.js gutted; all motion in vertex shader | 2026-02-28 |
| 14 | Simple opacity fade-in | Replaced base-to-top height fade with uOpacity ramp (2s) | 2026-02-28 |

---

## Environment Verification

Before starting any task, verify:
```bash
conda activate stjohn
python --version  # expect 3.11.x
echo $CONDA_DEFAULT_ENV  # expect: stjohn
```