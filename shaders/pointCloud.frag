varying vec3 vColor;
varying float vFadeAlpha;
uniform float uEmissiveIntensity;
uniform float uGlowIntensity;
uniform float uAmbientBrightness;
uniform float uRefractionStrength;
uniform sampler2D uBackgroundTex;
uniform float uTime;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  
  // Sharp circular edges - no blurring
  float alpha = 1.0;
  
  // Apply base-to-top fade
  alpha *= vFadeAlpha;
  
  // Glass refraction with chromatic aberration
  vec2 uv = gl_PointCoord;
  vec2 distortionOffset = (uv - 0.5) * uRefractionStrength * sin(uTime * 3.0);
  
  vec3 refracted = vec3(0.0);
  // Sample background texture with chromatic aberration
  if (uRefractionStrength > 0.0) {
    vec2 distortedUV = uv + distortionOffset;
    float r = texture2D(uBackgroundTex, distortedUV * 1.0).r;
    float g = texture2D(uBackgroundTex, distortedUV * 0.97).g;
    float b = texture2D(uBackgroundTex, distortedUV * 0.94).b;
    refracted = vec3(r, g, b) * uRefractionStrength;
  }
  
  // Warm white glow that preserves point color
  vec3 warmWhite = vec3(1.0, 0.95, 0.85);
  // Remove glow falloff for sharp appearance
  vec3 glowColor = warmWhite * uGlowIntensity;
  
  // Mix glow with point's original color (50% glow, 50% original)
  vec3 finalGlow = mix(vColor, glowColor, 0.5);
  
  // Basic emissive glow
  vec3 emissiveColor = vColor * uEmissiveIntensity;
  
  // Combine all effects
  vec3 finalColor = refracted + finalGlow + emissiveColor;
  finalColor *= uAmbientBrightness;
  
  gl_FragColor = vec4(finalColor, alpha);
}
