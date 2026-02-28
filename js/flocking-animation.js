// flocking-animation.js — DEPRECATED
// HIDDEN Exhibition · AR Point Cloud Experience
//
// All point animation (tree-body noise displacement, firefly drift/wander/flutter)
// is now GPU-driven via shaders/pointCloud.vert. No CPU-side boids needed.
//
// This file is kept as a stub to avoid breaking any remaining imports.
// It will be fully removed once all references are cleaned up.

export class FlockingAnimation {
  constructor() {
    console.warn('[FlockingAnimation] DEPRECATED — animation is now GPU-driven via vertex shader');
  }
  start() {}
  update() {}
  stop() {}
  dispose() {}
}
