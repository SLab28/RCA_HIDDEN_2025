attribute vec3 color;
varying vec3 vColor;
varying float vFadeAlpha;
uniform float uPointSize;
uniform float uFadeProgress; // 0.0 to 1.0
uniform float uTreeHeight;
uniform float uTime;

void main() {
  vColor = color;
  
  // Calculate base-to-top fade based on Y position
  float normalizedHeight = position.y / uTreeHeight; // 0.0 at base, 1.0 at top
  float fadeThreshold = uFadeProgress;
  
  // Point is visible if its height is below the fade threshold
  vFadeAlpha = 1.0;
  if (normalizedHeight > fadeThreshold) {
    vFadeAlpha = 0.0;
  } else if (normalizedHeight > fadeThreshold - 0.1) {
    // Smooth transition over 10% of tree height
    float transition = (fadeThreshold - normalizedHeight) / 0.1;
    vFadeAlpha = smoothstep(0.0, 1.0, transition);
  }
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  
  // Minimal point size without perspective scaling
  gl_PointSize = uPointSize;
  gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  
  // Remove size variation for cleaner appearance
  gl_Position = projectionMatrix * mvPosition;
}
