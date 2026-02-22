// floating-animation.js — Flocking algorithm for surface points
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

/**
 * Creates flocking animation for surface points only
 * Surface points move as a coordinated flock like fireflies
 */
export class FloatingAnimation {
  constructor(points, options = {}) {
    this.points = points;
    this.geometry = points.geometry;
    this.originalPositions = null;
    this.surfacePoints = null; // Indices of surface points only
    this.boids = null; // Flocking data for each surface point
    this.isActive = false;
    this.startTime = null;
    this.clock = new THREE.Clock();
    
    // Flocking parameters
    this.config = {
      maxSpeed: 0.02,        // Very slow movement (2cm/s)
      maxForce: 0.001,       // Gentle steering forces
      neighborRadius: 0.5,   // 50cm perception radius
      separationRadius: 0.15, // 15cm personal space
      alignmentWeight: 0.8,  // Strong alignment
      cohesionWeight: 0.3,   // Moderate cohesion
      separationWeight: 1.2, // Strong separation
      windStrength: 0.005,  // Very gentle wind
      delay: 3000,          // 3 seconds before effect starts
      fadeInDuration: 2000, // 2 seconds fade-in
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
    
    // Identify surface points (async to prevent blocking)
    try {
      this.surfacePoints = this.identifySurfacePoints(positions);
      console.log(`[FloatingAnimation] Found ${this.surfacePoints.length} surface points out of ${positions.count}`);
      
      // Create boids for surface points only
      this.boids = this.createBoids(this.surfacePoints.length);
      
      console.log(`[FloatingAnimation] Flocking system initialized successfully`);
    } catch (err) {
      console.error('[FloatingAnimation] Initialization failed:', err);
      // Fallback: use all points if surface detection fails
      this.surfacePoints = Array.from({length: positions.count}, (_, i) => i);
      this.boids = this.createBoids(this.surfacePoints.length);
      console.log('[FloatingAnimation] Fallback: using all points for animation');
    }
  }
  
  /**
   * Identify surface points using optimized neighbor density analysis
   * Surface points have fewer neighbors than interior points
   */
  identifySurfacePoints(positions) {
    const surfaceIndices = [];
    const pointCount = positions.count;
    const searchRadius = 0.1; // 10cm search radius
    const maxNeighbors = 6; // Threshold for surface detection
    
    console.log(`[FloatingAnimation] Analyzing ${pointCount} points for surface detection...`);
    
    // Sample every Nth point for performance (large point clouds)
    const sampleRate = pointCount > 10000 ? 10 : 1;
    
    for (let i = 0; i < pointCount; i += sampleRate) {
      const pos = new THREE.Vector3(
        positions.array[i * 3],
        positions.array[i * 3 + 1],
        positions.array[i * 3 + 2]
      );
      
      // Count neighbors within search radius (optimized)
      let neighborCount = 0;
      const searchRadiusSq = searchRadius * searchRadius;
      
      for (let j = 0; j < pointCount; j += sampleRate) {
        if (i === j) continue;
        
        const dx = positions.array[j * 3] - pos.x;
        const dy = positions.array[j * 3 + 1] - pos.y;
        const dz = positions.array[j * 3 + 2] - pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        
        if (distSq < searchRadiusSq) {
          neighborCount++;
        }
      }
      
      // Surface points have fewer neighbors
      if (neighborCount < maxNeighbors) {
        surfaceIndices.push(i);
      }
    }
    
    console.log(`[FloatingAnimation] Surface detection complete: ${surfaceIndices.length} surface points`);
    return surfaceIndices;
  }
  
  /**
   * Create boid data for each surface point
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
    if (!this.isActive || !this.originalPositions || !this.surfacePoints || !this.boids) {
      return;
    }
    
    const currentTime = this.clock.getElapsedTime() * 1000; // Convert to ms
    const elapsed = currentTime - (this.startTime ? this.startTime - performance.now() + currentTime : 0);
    
    // Check if 3s delay has passed
    if (elapsed < this.config.delay) {
      return;
    }
    
    const animationTime = (elapsed - this.config.delay) / 1000; // Convert to seconds
    
    // Calculate fade-in factor (0 to 1 over fadeInDuration)
    const fadeProgress = Math.min(1.0, (elapsed - this.config.delay) / this.config.fadeInDuration);
    const fadeFactor = this.easeInOutCubic(fadeProgress);
    
    const positions = this.geometry.attributes.position.array;
    
    // Update boid positions and apply flocking
    this.updateFlocking(animationTime);
    
    // Apply boid positions to surface points only
    for (let i = 0; i < this.surfacePoints.length; i++) {
      const pointIndex = this.surfacePoints[i];
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
      
      // Add gentle wind
      const windX = Math.sin(deltaTime * 0.1 + i) * this.config.windStrength;
      const windZ = Math.cos(deltaTime * 0.08 + i) * this.config.windStrength;
      boid.position.x += windX;
      boid.position.z += windZ;
      
      // Keep boids relatively close to original position
      const maxOffset = 0.3; // 30cm max offset
      boid.position.clampLength(0, maxOffset);
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
    this.surfacePoints = null;
    this.boids = null;
    this.geometry = null;
    this.points = null;
  }
}
