# TESTING_CHECKLIST.md — Per-Task Verification Protocol
# IDE: Windsurf (Cascade) | Env: Anaconda `stjohn`

---

## Pre-Test Setup (EVERY task)

```bash
conda activate stjohn
cd stjohn-hidden
python -m http.server 8080
```

Open Chrome → `http://localhost:8080` → DevTools Console (F12)

---

## Task 1: Scaffold
| # | Check | Pass? |
|---|---|---|
| 1.1 | All directories exist per PROJECT_CONFIG.md | ☐ |
| 1.2 | `index.html` loads without 404s in Network tab | ☐ |
| 1.3 | Console shows init message, zero errors | ☐ |
| 1.4 | Server running from `(stjohn)` environment | ☐ |

---

## Task 2: Three.js Scene
| # | Check | Pass? |
|---|---|---|
| 2.1 | Test cube visible and rotating | ☐ |
| 2.2 | Zero console errors | ☐ |
| 2.3 | Canvas resizes correctly on window resize | ☐ |
| 2.4 | `renderer.info.render.triangles` > 0 in console | ☐ |

---

## Task 3: AR Marker Tracking
| # | Check | Pass? |
|---|---|---|
| 3.1 | Camera feed visible as background | ☐ |
| 3.2 | Test cube appears on marker | ☐ |
| 3.3 | Cube stays anchored during device movement | ☐ |
| 3.4 | Marker found/lost events logged in console | ☐ |
| 3.5 | Works on Android Chrome with camera permission | ☐ |

---

## Task 4: Point Cloud
| # | Check | Pass? |
|---|---|---|
| 4.1 | Points render with per-vertex colours | ☐ |
| 4.2 | Cloud centred on marker position | ☐ |
| 4.3 | Cloud fits within 2m × 2m footprint | ☐ |
| 4.4 | ≥ 30 fps (check `renderer.info`) | ☐ |
| 4.5 | `originalPositions` Float32Array stored | ☐ |

---

## Task 5: Glow
| # | Check | Pass? |
|---|---|---|
| 5.1 | Points near camera appear subtly brighter | ☐ |
| 5.2 | Glow is barely perceptible (not bloom/halo) | ☐ |
| 5.3 | Moving camera changes which points glow | ☐ |
| 5.4 | No fps regression below 30 | ☐ |
| 5.5 | Shader compiles without GLSL errors | ☐ |

---

## Task 6: Touch Interaction
| # | Check | Pass? |
|---|---|---|
| 6.1 | Touch/click displaces nearby points | ☐ |
| 6.2 | Displacement is radial with smooth falloff | ☐ |
| 6.3 | Points drift back on release (lerp visible) | ☐ |
| 6.4 | Multi-touch works independently | ☐ |
| 6.5 | ≥ 30 fps during interaction | ☐ |

---

## Task 7: Audio Flock
| # | Check | Pass? |
|---|---|---|
| 7.1 | Flock particles visible around the tree | ☐ |
| 7.2 | Particles show flocking behaviour (not random) | ☐ |
| 7.3 | Louder sound → visibly faster flock | ☐ |
| 7.4 | Varied sound → wider flock spread | ☐ |
| 7.5 | Mic denied → gentle static drift fallback | ☐ |
| 7.6 | ≥ 30 fps | ☐ |

---

## Task 8: Dissolution
| # | Check | Pass? |
|---|---|---|
| 8.1 | Points scatter after 30s idle | ☐ |
| 8.2 | Dissolution looks organic (varied velocities) | ☐ |
| 8.3 | Touch during dissolution reverses it | ☐ |
| 8.4 | Timer resets on interaction | ☐ |
| 8.5 | After full dissolve, touch reforms the cloud | ☐ |

---

## Task 9: Integration & Deploy
| # | Check | Pass? |
|---|---|---|
| 9.1 | Full flow works: QR → URL → camera → experience | ☐ |
| 9.2 | ≥ 30 fps on mid-range Android | ☐ |
| 9.3 | Total assets < 20 MB (Network tab, check) | ☐ |
| 9.4 | Custom domain serves HTTPS | ☐ |
| 9.5 | Fallback mode works when AR unsupported | ☐ |
| 9.6 | No console errors in production build | ☐ |