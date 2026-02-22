# HIDDEN — AR Point Cloud Experience

An augmented reality browser experience for the **HIDDEN** exhibition at the Royal College of Art.

## Overview

Visitors point their Android phone at a floor marker and see a coloured point-cloud tree rendered in AR. The tree responds to touch (fluid displacement), slowly dissolves when idle, and is surrounded by an audio-reactive flock of particles driven by ambient sound.

## Tech Stack

- **Three.js r160+** — 3D rendering (ES modules via CDN)
- **WebXR / AR.js** — augmented reality & marker tracking
- **Web Audio API** — microphone FFT for flock behaviour
- **GitHub Pages** — static hosting

## Local Development

```bash
conda activate stjohn
python -m http.server 8080
# Open http://localhost:8080 in Chrome
```

For mobile AR testing (HTTPS required):
```bash
# Option A: Chrome flag on device
# chrome://flags/#unsafely-treat-insecure-origin-as-secure
# Add: http://<your-local-ip>:8080

# Option B: ngrok tunnel
conda activate stjohn
ngrok http 8080
```

## Project Structure

```
├── index.html              Entry point
├── css/main.css            Styles
├── js/
│   ├── app.js              Bootstrap & init
│   ├── scene.js            Three.js scene setup
│   ├── marker-tracking.js  AR anchor logic
│   ├── point-cloud-loader.js  PLY loading
│   ├── glow-shader.js      Proximity glow
│   ├── touch-interaction.js   Touch displacement
│   ├── audio-flock.js      Audio-reactive flock
│   └── dissolve.js         Idle dissolution
├── assets/                 Point clouds & markers
└── lib/                    Vendored CDN fallbacks
```

## Exhibition

- **Location:** Royal College of Art, London
- **Floor marker:** 2 × 2 m white tape square
- **Target device:** Mid-range Android (Pixel 6 class), Chrome
- **Performance:** ≥ 30 fps, < 20 MB total assets

## License

All rights reserved © 2025
