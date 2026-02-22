// app.js — Bootstrap & AR session init
// HIDDEN Exhibition · AR Point Cloud Experience

console.log('[HIDDEN] AR app initialising');

// Future imports will be added as tasks progress:
// import { createScene } from './scene.js';
// import { initMarkerTracking } from './marker-tracking.js';
// import { loadPointCloud } from './point-cloud-loader.js';
// import { initTouchInteraction } from './touch-interaction.js';
// import { initAudioFlock } from './audio-flock.js';
// import { initDissolve } from './dissolve.js';

function init() {
  console.log('[HIDDEN] init() called — scaffold complete');

  // Hide loading overlay
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

// Wait for DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
