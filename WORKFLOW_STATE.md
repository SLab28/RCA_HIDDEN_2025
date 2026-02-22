# WORKFLOW_STATE.md — Progress Tracker
# IDE: Windsurf (Cascade) | Env: Anaconda `stjohn`

---

## Current State

| Field | Value |
|---|---|
| Phase | CONSTRUCT |
| Current Task | Task 4 |
| Status | NOT_STARTED |
| Blocked By | — |
| Conda Env | `stjohn` (must be active) |

---

## Task Progress

| Task | Status | Notes |
|---|---|---|
| 1. Scaffold | ✅ DONE | Committed dcf59ae, pushed to GitHub |
| 2. Three.js Scene | ✅ DONE | scene.js + app.js with test cube |
| 3. AR + Marker | ✅ DONE | AR.js dynamic load, Hiro marker, anchor group |
| 4. Point Cloud | ⬜ NOT_STARTED | |
| 5. Glow | ⬜ NOT_STARTED | |
| 6. Touch | ⬜ NOT_STARTED | Can parallel with 7 |
| 7. Audio Flock | ⬜ NOT_STARTED | Can parallel with 6 |
| 8. Dissolution | ⬜ NOT_STARTED | |
| 9. Integration | ⬜ NOT_STARTED | |

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
| 7 | AR.js (not native WebXR) | No flags needed, getUserMedia-based, QR→open→works | 2026-02-22 |
| 8 | Point budget raised to ~650K | 389K tree + 259K flock subsampled, will profile in Task 9 | 2026-02-22 |

---

## Environment Verification

Before starting any task, verify:
```bash
conda activate stjohn
python --version  # expect 3.11.x
echo $CONDA_DEFAULT_ENV  # expect: stjohn
```