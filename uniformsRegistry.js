import * as THREE from 'three';

export const uniforms = {
  // Core
  uTime:               { value: 0 },
  uPointSize:          { value: 3.0 }, // Reduced from 6.0 (too huge)

  // Visual / Exhibition calibration
  uAmbientBrightness:  { value: 0.3 },
  uGlowIntensity:      { value: 1.0 },
  uGlowColour:         { value: new THREE.Color(0.85, 0.95, 1.0) },
  uRefractionStrength: { value: 0.15 },
  uBackgroundTex:      { value: null },

  // Flocking
  uFlockTex:           { value: null },
  uFlockStrength:      { value: 1.0 },

  // Audio (Phase 6+)
  uAudioBass:          { value: 0 },
  uAudioMid:           { value: 0 },
  uAudioHigh:          { value: 0 },

  // Touch (Phase 7+)
  uTouchPos:           { value: new THREE.Vector2() },
  uTouchActive:        { value: 0 },

  // Hand tracking (Phase 8+)
  uHandPos:            { value: [new THREE.Vector3(), new THREE.Vector3()] },
  uHandPresence:       { value: 0 },
  uHandRadius:         { value: 0.3 },

  // Existing uniforms from current implementation
  uFadeProgress:       { value: 0.0 },
  uTreeHeight:         { value: 1.0 },
  uEmissiveIntensity:  { value: 1.0 }, // Reduced from 0.8 (too strong)
};
