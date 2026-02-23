// floating-animation.js — Flocking algorithm for surface points
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

/**
 * Creates flocking animation for all tree points
 * All points move as a coordinated flock like fireflies
 */
export class FloatingAnimation {
  constructor(points, options = {}) {
    this.points = points;
    this.geometry = points.geometry;
    this.originalPositions = null;
    // this.surfacePoints = null; // Removed - using all points
    this.sampledIndices = null; // Sampled point indices for performance
    this.boids = null; // Flocking data for each point
    this.lastFrameTime = null; // Performance monitoring
    this.isActive = false;
    this.startTime = null;
    this.clock = new THREE.Clock();
    
    // Flocking parameters
    this.config = {
      maxSpeed: 0.015,       // Slower movement for tighter groups
      maxForce: 0.002,       // Stronger steering forces
      neighborRadius: 0.8,   // 80cm perception radius (larger groups)
      separationRadius: 0.12, // 12cm personal space (tighter groups)
      alignmentWeight: 1.2,  // Very strong alignment
      cohesionWeight: 0.8,   // Strong cohesion
      separationWeight: 0.8, // Moderate separation
      windStrength: 0.005,  // Very gentle wind
      delay: 0,             // No delay - start immediately
      fadeInDuration: 1000, // 1 second fade-in (faster)
      surfaceThreshold: 0.02, // Distance threshold for surface detection
      ...options
    };
    
    this.init();
  }
  
  /**
   * Initialize animation data - identify surface points and create boids
   */
  init() {
    if (!this.geometry || !this.geometry.attributes.position) {
      console.warn('[FloatingAnimation] No position attributes found');
      return;
    }
    
    console.log('[FloatingAnimation] Starting initialization...');
    
    // Store original positions
    const positions = this.geometry.attributes.position;
    this.originalPositions = new Float32Array(positions.array);
    
    // Detect mobile device for performance optimization
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const maxPoints = isMobile ? 1500 : 5000; // Much lower for mobile
    
    // Sample points for animation to prevent crashes with large point clouds
    const sampleRate = Math.ceil(positions.count / maxPoints);
    this.sampledIndices = [];
    
    for (let i = 0; i < positions.count; i += sampleRate) {
      this.sampledIndices.push(i);
    }
    
    console.log(`[FloatingAnimation] ${isMobile ? 'Mobile' : 'Desktop'} detected: using ${this.sampledIndices.length} sampled points out of ${positions.count}`);
    
    this.boids = this.createBoids(this.sampledIndices.length);
    console.log(`[FloatingAnimation] Using ${this.sampledIndices.length} sampled points out of ${positions.count} for flocking animation`);
    console.log(`[FloatingAnimation] Sample rate: 1 in ${sampleRate}`);
    console.log(`[FloatingAnimation] Flocking system initialized successfully`);
  }
  
  /**
   * Create boid data for each point
   */
  createBoids(count) {
    const boids = [];
    
    for (let i = 0; i < count; i++) {
      boids.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        ),
        acceleration: new THREE.Vector3(),
        maxSpeed: this.config.maxSpeed,
        maxForce: this.config.maxForce
      });
    }
    
    return boids;
  }
  
  /**
   * Start the floating animation (called after tree placement)
   */
  start() {
    if (this.isActive) return;
    
    this.startTime = performance.now();
    this.isActive = true;
    this.clock.start();
    
    console.log('[FloatingAnimation] Flocking started - effect will begin in 3s with fade-in');
  }
  
  /**
   * Update flocking animation (call in render loop)
   */
  update() {
    if (!this.isActive || !this.originalPositions || !this.boids) {
      return;
    }
    
    // Performance monitoring - skip frames if needed
    if (this.lastFrameTime && performance.now() - this.lastFrameTime < 16) {
      return; // Skip frame if running too fast (mobile optimization)
    }
    this.lastFrameTime = performance.now();
    
    const currentTime = this.clock.getElapsedTime() * 1000; // Convert to ms
    const elapsed = currentTime - (this.startTime ? this.startTime - performance.now() + currentTime : 0);
    
    // No delay - start immediately
    // if (elapsed < this.config.delay) {
    //   return;
    // }
    
    const animationTime = (elapsed - this.config.delay) / 1000; // Convert to seconds
    
    // Calculate fade-in factor (0 to 1 over fadeInDuration)
    const fadeProgress = Math.min(1.0, (elapsed - this.config.delay) / this.config.fadeInDuration);
    const fadeFactor = this.easeInOutCubic(fadeProgress);
    
    const positions = this.geometry.attributes.position.array;
    
    // Update boid positions and apply flocking
    this.updateFlocking(animationTime);
    
    // Apply boid positions to sampled points only
    for (let i = 0; i < this.boids.length; i++) {
      const pointIndex = this.sampledIndices[i];
      const posIndex = pointIndex * 3;
      const boid = this.boids[i];
      
      // Original position
      const origX = this.originalPositions[posIndex];
      const origY = this.originalPositions[posIndex + 1];
      const origZ = this.originalPositions[posIndex + 2];
      
      // Apply flocking offset with fade-in
      const offsetX = boid.position.x * fadeFactor;
      const offsetY = boid.position.y * fadeFactor;
      const offsetZ = boid.position.z * fadeFactor;
      
      // Update position
      positions[posIndex] = origX + offsetX;
      positions[posIndex + 1] = origY + offsetY;
      positions[posIndex + 2] = origZ + offsetZ;
    }
    
    // Mark positions as needing update
    this.geometry.attributes.position.needsUpdate = true;
  }
  
  /**
   * Update flocking behavior for all boids
   */
  updateFlocking(deltaTime) {
    // Update each boid
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];
      
      // Reset acceleration
      boid.acceleration.set(0, 0, 0);
      
      // Apply flocking forces
      const alignment = this.align(boid, i);
      const cohesion = this.cohere(boid, i);
      const separation = this.separate(boid, i);
      
      // Weight the forces
      alignment.multiplyScalar(this.config.alignmentWeight);
      cohesion.multiplyScalar(this.config.cohesionWeight);
      separation.multiplyScalar(this.config.separationWeight);
      
      // Apply forces to acceleration
      boid.acceleration.add(alignment);
      boid.acceleration.add(cohesion);
      boid.acceleration.add(separation);
      
      // Update velocity and position
      boid.velocity.add(boid.acceleration);
      
      // Limit speed
      const speed = boid.velocity.length();
      if (speed > boid.maxSpeed) {
        boid.velocity.normalize().multiplyScalar(boid.maxSpeed);
      }
      
      boid.position.add(boid.velocity);
      
      // Add upward wind force with turbulence
      const windX = Math.sin(deltaTime * 0.1 + i) * this.config.windStrength;
      const windY = Math.sin(deltaTime * 0.15 + i * 0.5) * this.config.windStrength * 0.5 + 0.003; // Upward bias + turbulence
      const windZ = Math.cos(deltaTime * 0.08 + i) * this.config.windStrength;
      boid.position.x += windX;
      boid.position.y += windY;
      boid.position.z += windZ;
      
      // Keep boids relatively close to original position but allow more upward movement
      const maxOffset = 0.4; // 40cm max offset
      const maxY = 0.5; // Allow 50cm upward movement
      boid.position.x = Math.max(-maxOffset, Math.min(maxOffset, boid.position.x));
      boid.position.y = Math.max(-0.1, Math.min(maxY, boid.position.y)); // More upward range
      boid.position.z = Math.max(-maxOffset, Math.min(maxOffset, boid.position.z));
    }
  }
  
  /**
   * Alignment: steer towards average heading of neighbors
   */
  align(boid, index) {
    const perceptionRadius = this.config.neighborRadius;
    const steering = new THREE.Vector3();
    let total = 0;
    
    for (let i = 0; i < this.boids.length; i++) {
      if (i === index) continue;
      
      const other = this.boids[i];
      const distance = boid.position.distanceTo(other.position);
      
      if (distance < perceptionRadius && distance > 0) {
        steering.add(other.velocity);
        total++;
      }
    }
    
    if (total > 0) {
      steering.divideScalar(total);
      steering.normalize();
      steering.multiplyScalar(boid.maxSpeed);
      steering.sub(boid.velocity);
      
      // Limit steering force
      if (steering.length() > boid.maxForce) {
        steering.normalize().multiplyScalar(boid.maxForce);
      }
    }
    
    return steering;
  }
  
  /**
   * Cohesion: steer towards average position of neighbors
   */
  cohere(boid, index) {
    const perceptionRadius = this.config.neighborRadius;
    const steering = new THREE.Vector3();
    let total = 0;
    
    for (let i = 0; i < this.boids.length; i++) {
      if (i === index) continue;
      
      const other = this.boids[i];
      const distance = boid.position.distanceTo(other.position);
      
      if (distance < perceptionRadius && distance > 0) {
        steering.add(other.position);
        total++;
      }
    }
    
    if (total > 0) {
      steering.divideScalar(total);
      steering.sub(boid.position);
      steering.normalize();
      steering.multiplyScalar(boid.maxSpeed);
      steering.sub(boid.velocity);
      
      // Limit steering force
      if (steering.length() > boid.maxForce) {
        steering.normalize().multiplyScalar(boid.maxForce);
      }
    }
    
    return steering;
  }
  
  /**
   * Separation: steer to avoid crowding neighbors
   */
  separate(boid, index) {
    const perceptionRadius = this.config.separationRadius;
    const steering = new THREE.Vector3();
    let total = 0;
    
    for (let i = 0; i < this.boids.length; i++) {
      if (i === index) continue;
      
      const other = this.boids[i];
      const distance = boid.position.distanceTo(other.position);
      
      if (distance < perceptionRadius && distance > 0) {
        const diff = new THREE.Vector3().subVectors(boid.position, other.position);
        diff.normalize();
        diff.divideScalar(distance); // Weight by distance
        steering.add(diff);
        total++;
      }
    }
    
    if (total > 0) {
      steering.divideScalar(total);
      steering.normalize();
      steering.multiplyScalar(boid.maxSpeed);
      steering.sub(boid.velocity);
      
      // Limit steering force
      if (steering.length() > boid.maxForce) {
        steering.normalize().multiplyScalar(boid.maxForce);
      }
    }
    
    return steering;
  }
  
  /**
   * Stop animation and reset positions
   */
  stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    
    // Reset to original positions
    if (this.originalPositions && this.geometry) {
      const positions = this.geometry.attributes.position.array;
      positions.set(this.originalPositions);
      this.geometry.attributes.position.needsUpdate = true;
    }
    
    console.log('[FloatingAnimation] Flocking stopped');
  }
  
  /**
   * Ease in-out cubic function for smooth fade-in
   */
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.stop();
    this.originalPositions = null;
    // this.surfacePoints = null; // Removed - using all points
    this.sampledIndices = null;
    this.boids = null;
    this.geometry = null;
    this.points = null;
  }
}
