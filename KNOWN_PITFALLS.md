# KNOWN_PITFALLS.md — Pre-Emptive Bug Prevention
# Windsurf Cascade Edition

---

## ⚠️ Pitfall 0: Conda Environment Not Active

**Symptom:** Commands fail, wrong Python version, packages not found.

```bash
# 🚫 WRONG: Running commands without activating env
python -m http.server 8080     # Uses system Python, may lack packages

# ✅ CORRECT: Always activate first
conda activate stjohn
python -m http.server 8080
```

**Why this happens with Windsurf:** Cascade opens a new terminal for each command execution. The conda environment does NOT persist across separate terminal invocations unless explicitly activated each time.

**Fix:** Every terminal block must start with `conda activate stjohn`. Add this to `.windsurf/rules/terminal-rules.md` as an "Always On" rule.

---

## ⚠️ Pitfall 1: Legacy THREE.Geometry

**Symptom:** `THREE.Geometry is not a constructor` error.

```javascript
// 🚫 WRONG
const geo = new THREE.Geometry();
geo.vertices.push(new THREE.Vector3(x, y, z));

// ✅ CORRECT
const geo = new THREE.BufferGeometry();
const positions = new Float32Array([x, y, z]);
geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
```

**Why AI generates this:** Training data includes pre-r125 Three.js code. Cascade may reference outdated Stack Overflow answers.

---

## ⚠️ Pitfall 2: Missing `needsUpdate` Flag

**Symptom:** Positions change in JS but points don't move on screen.

```javascript
// 🚫 WRONG
positions[i] = newX;
positions[i + 1] = newY;
positions[i + 2] = newZ;
// forgot to flag!

// ✅ CORRECT
positions[i] = newX;
positions[i + 1] = newY;
positions[i + 2] = newZ;
geometry.attributes.position.needsUpdate = true;
```

---

## ⚠️ Pitfall 3: Import Map Not Declared

**Symptom:** `Failed to resolve module specifier "three"` in browser console.

```html
<!-- 🚫 WRONG: import without importmap -->
<script type="module">
  import * as THREE from 'three';  // fails: browser doesn't know "three"
</script>

<!-- ✅ CORRECT: importmap declared BEFORE any module scripts -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
</script>
<script type="module" src="js/app.js"></script>
```

**Key rule:** `<script type="importmap">` must appear BEFORE any `<script type="module">` tag.

---

## ⚠️ Pitfall 4: AR.js Source / Context Sizing

**Symptom:** AR camera feed is stretched, squished, or offset from actual marker position.

```javascript
// 🚫 WRONG: hardcoded size
arToolkitSource.init(function onReady() {
  // no resize handling
});

// ✅ CORRECT: resize on init and window resize
arToolkitSource.init(function onReady() {
  onResize();
});
window.addEventListener('resize', function () {
  onResize();
});
function onResize() {
  arToolkitSource.onResizeElement();
  arToolkitSource.copyElementSizeTo(renderer.domElement);
  if (arToolkitContext.arController !== null) {
    arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
  }
}
```

---

## ⚠️ Pitfall 5: Audio Context Blocked by Browser

**Symptom:** `AudioContext was not allowed to start` warning. No sound analysis.

```javascript
// 🚫 WRONG: Create AudioContext on page load
const audioCtx = new AudioContext();  // blocked by autoplay policy

// ✅ CORRECT: Create on user gesture
document.addEventListener('touchstart', async function initAudio() {
  const audioCtx = new AudioContext();
  await audioCtx.resume();
  // now set up analyser
  document.removeEventListener('touchstart', initAudio);
}, { once: true });
```

---

## ⚠️ Pitfall 6: CORS Blocked on Asset Load

**Symptom:** `.ply` file fails to load with CORS error when using `file://` protocol.

```bash
# 🚫 WRONG: opening index.html directly
open index.html     # file:// protocol, CORS blocks fetch()

# ✅ CORRECT: serve via HTTP
conda activate stjohn
python -m http.server 8080
# Then open http://localhost:8080
```

---

## ⚠️ Pitfall 7: ShaderMaterial Ignores vertexColors

**Symptom:** Point cloud renders all white / all one colour despite having per-vertex colours.

```javascript
// 🚫 WRONG: ShaderMaterial doesn't automatically use vertex colours
const mat = new THREE.ShaderMaterial({
  vertexShader: vert,
  fragmentShader: frag,
  // Missing: vertexColors not handled
});

// ✅ CORRECT: Read color attribute in shader
const vert = /* glsl */ `
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 2.0;
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;
```

---

## ⚠️ Pitfall 8: Touch Events vs Pointer Events on Mobile

**Symptom:** Touch works on desktop but not on mobile, or events fire twice.

```javascript
// 🚫 WRONG: Using mouse events only
canvas.addEventListener('mousedown', onTouch);

// ✅ CORRECT: Use pointer events (unified mouse + touch)
canvas.addEventListener('pointerdown', onTouch);
canvas.addEventListener('pointermove', onTouch);
canvas.addEventListener('pointerup', onTouchEnd);

// If using touch-specific:
canvas.addEventListener('touchmove', onTouch, { passive: false });
// ↑ passive: false allows preventDefault() to stop scroll
```

---

## ⚠️ Pitfall 9: WebXR Session Ends on Tab Switch

**Symptom:** AR session dies when user switches tabs or locks phone.

```javascript
// ✅ CORRECT: Handle session end gracefully
session.addEventListener('end', () => {
  renderer.xr.setSession(null);
  console.warn('[AR] Session ended — offering restart button');
  showRestartButton();
});
```

---

## ⚠️ Pitfall 10: Allocating Objects in Render Loop

**Symptom:** Garbage collection stutters, fps drops periodically.

```javascript
// 🚫 WRONG: new Vector3 every frame
function animate() {
  const dir = new THREE.Vector3();  // allocation every frame!
  const temp = new THREE.Vector3(); // more garbage
  // ...
}

// ✅ CORRECT: pre-allocate outside loop
const _dir = new THREE.Vector3();
const _temp = new THREE.Vector3();

function animate() {
  _dir.set(0, 0, 0);  // reuse
  _temp.set(0, 0, 0);  // reuse
  // ...
}
```