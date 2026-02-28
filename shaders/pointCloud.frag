uniform float glowIntensity;
uniform float glowRadius;
uniform float uOpacity;
uniform vec3 xrLightColor;
uniform float xrLightIntensity;

varying vec3  vColor;
varying float vAlpha;
varying float vGlowDist;
varying float vIsFirefly;
varying vec3  vWorldPos;

void main() {
    vec2  uv   = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float edge          = 1.0 - smoothstep(0.35, 0.5, dist);
    float proximityGlow = glowIntensity * (1.0 - smoothstep(1.0, 6.0, vGlowDist));
    float innerGlow     = 1.0 - smoothstep(0.0, glowRadius, dist);
    vec3  glow          = vColor * (innerGlow * proximityGlow);
    vec3  fireflyBoost  = vColor * innerGlow * vIsFirefly * 0.55;
    vec3  finalColor    = vColor + glow + fireflyBoost;
    finalColor *= xrLightColor * xrLightIntensity;
    float finalAlpha    = vAlpha * edge * uOpacity;

    if (finalAlpha < 0.01) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
}
