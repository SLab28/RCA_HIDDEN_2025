// floating-animation.js — Flocking algorithm for surface points
// HIDDEN Exhibition · AR Point Cloud Experience

import * as THREE from 'three';

/**
 * Creates flocking animation for all tree points
 * The floating animation IS the flocking system - particles move as a coordinated flock like fireflies
 * Only 30% of particles leave trails for performance optimization
 */
export class FloatingAnimation {
  constructor(points, options = {}) {
    this.points = points;
    this.geometry = points.geometry;
    this.originalPositions = null;
    // this.surfacePoints = null; // Removed - using all points
    this.sampledIndices = null; // Sampled point indices for performance
    this.boids = null; // Flocking data for each point
    this.trailIntensities = null; // Trail intensity data for each point
    this.previousVelocities = null; // Previous velocities for trail calculation
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
      trailIntensity: 5.0,  // Maximum trail intensity - increased for maximum visibility
      trailFadeSpeed: 1.0,  // No fading - trails stay permanent
      trailMinIntensity: 0.5,  // Minimum intensity - trails never fade completely (increased)
      trailVelocityThreshold: 0.00001, // Extremely low threshold - almost any movement creates trails
      trailParticleRatio: 0.3, // Only 30% of particles leave trails for performance
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
    
    // Initialize trail data
    this.trailIntensities = new Float32Array(positions.count);
    this.trailIntensities.fill(0.0);
    this.previousVelocities = new Float32Array(this.sampledIndices.length * 3); // x,y,z for each sampled point
    
    console.log(`[FloatingAnimation] Using ${this.sampledIndices.length} sampled points out of ${positions.count} for flocking animation`);
    console.log(`[FloatingAnimation] Sample rate: 1 in ${sampleRate}`);
    console.log(`[FloatingAnimation] Trail system initialized`);
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
   * Start the flocking animation (called after tree placement)
   * This IS the floating animation - the flocking particles that leave trails
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
    
    // Performance monitoring - DISABLED to prevent freezing
    // if (this.lastFrameTime && performance.now() - this.lastFrameTime < 16) {
    //   return; // Skip frame if running too fast (mobile optimization)
    // }
    this.lastFrameTime = performance.now();
    
    const currentTime = this.clock.getElapsedTime() * 1000; // Convert to ms
    const elapsed = currentTime - (this.startTime || 0);
    
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
    
    // Update trail intensities based on particle velocities
    this.updateTrails();
    
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
    
    // Update trail intensity attribute
    if (this.geometry.attributes.trailIntensity) {
      this.geometry.attributes.trailIntensity.array.set(this.trailIntensities);
      this.geometry.attributes.trailIntensity.needsUpdate = true;
    }
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
   * Update trail intensities based on particle velocities
   */
  updateTrails() {
    // Apply minimum intensity to maintain permanent trails
    for (let i = 0; i < this.trailIntensities.length; i++) {
      // Only fade if above minimum, then maintain minimum intensity
      if (this.trailIntensities[i] > this.config.trailMinIntensity) {
        this.trailIntensities[i] = Math.max(
          this.trailIntensities[i] * this.config.trailFadeSpeed,
          this.config.trailMinIntensity
        );
      }
    }
    
    let totalTrailIntensity = 0;
    let activeTrails = 0;
    
    // Calculate new trail intensities based on velocities
    for (let i = 0; i < this.boids.length; i++) {
      const boid = this.boids[i];
      const pointIndex = this.sampledIndices[i];
      const prevVelIndex = i * 3;
      
      // Only 30% of particles create trails for performance
      const shouldCreateTrail = (i % Math.floor(1 / this.config.trailParticleRatio)) === 0;
      
      if (!shouldCreateTrail) {
        // Skip trail creation for this particle
        // Store current velocity for next frame
        const currentVelX = boid.velocity.x;
        const currentVelY = boid.velocity.y;
        const currentVelZ = boid.velocity.z;
        this.previousVelocities[prevVelIndex] = currentVelX;
        this.previousVelocities[prevVelIndex + 1] = currentVelY;
        this.previousVelocities[prevVelIndex + 2] = currentVelZ;
        continue;
      }
      
      // Get current velocity
      const currentVelX = boid.velocity.x;
      const currentVelY = boid.velocity.y;
      const currentVelZ = boid.velocity.z;
      
      // Get previous velocity
      const prevVelX = this.previousVelocities[prevVelIndex];
      const prevVelY = this.previousVelocities[prevVelIndex + 1];
      const prevVelZ = this.previousVelocities[prevVelIndex + 2];
      
      // Calculate velocity change (acceleration)
      const accelX = currentVelX - prevVelX;
      const accelY = currentVelY - prevVelY;
      const accelZ = currentVelZ - prevVelZ;
      const acceleration = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
      
      // Calculate current speed
      const speed = Math.sqrt(currentVelX * currentVelX + currentVelY * currentVelY + currentVelZ * currentVelZ);
      
      // Update trail intensity based on speed and acceleration
      if (speed > this.config.trailVelocityThreshold) {
        // Higher speed and acceleration = more intense trails
        const intensityFactor = Math.min(speed / this.config.maxSpeed, 1.0);
        const accelFactor = Math.min(acceleration * 50, 1.0); // Scale acceleration
        const newIntensity = intensityFactor * (1.0 + accelFactor) * this.config.trailIntensity;
        
        // Set trail intensity for this point (and nearby points for smoother trails)
        this.trailIntensities[pointIndex] = Math.max(this.trailIntensities[pointIndex], newIntensity);
        
        totalTrailIntensity += newIntensity;
        activeTrails++;
        
        // Add trail to nearby points for smoother effect
        for (let j = 1; j <= 2; j++) {
          if (pointIndex - j >= 0) {
            this.trailIntensities[pointIndex - j] = Math.max(this.trailIntensities[pointIndex - j], newIntensity * 0.5);
          }
          if (pointIndex + j < this.trailIntensities.length) {
            this.trailIntensities[pointIndex + j] = Math.max(this.trailIntensities[pointIndex + j], newIntensity * 0.5);
          }
        }
      } else {
        // Fallback: create minimal trails for testing even if velocity is low
        if (Math.random() < 0.01) { // 1% chance per frame
          const minIntensity = 0.2;
          this.trailIntensities[pointIndex] = Math.max(this.trailIntensities[pointIndex], minIntensity);
          totalTrailIntensity += minIntensity;
          activeTrails++;
        }
      }
      
      // Store current velocity for next frame
      this.previousVelocities[prevVelIndex] = currentVelX;
      this.previousVelocities[prevVelIndex + 1] = currentVelY;
      this.previousVelocities[prevVelIndex + 2] = currentVelZ;
    }
    
    // Debug logging every 60 frames (once per second at 60fps) - REMOVED to prevent freezing
    // if (!this.debugFrameCounter) this.debugFrameCounter = 0;
    // this.debugFrameCounter++;
    // if (this.debugFrameCounter % 60 === 0) {
    //   console.log(`[FloatingAnimation] Trail debug - Active trails: ${activeTrails}, Total intensity: ${totalTrailIntensity.toFixed(3)}`);
    //   if (activeTrails > 0) {
    //     const maxIntensity = Math.max(...this.trailIntensities);
    //     console.log(`[FloatingAnimation] Max trail intensity: ${maxIntensity.toFixed(3)}`);
    //   }
    // }
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
    
    // Reset trail intensities
    if (this.trailIntensities && this.geometry && this.geometry.attributes.trailIntensity) {
      this.trailIntensities.fill(0.0);
      this.geometry.attributes.trailIntensity.array.set(this.trailIntensities);
      this.geometry.attributes.trailIntensity.needsUpdate = true;
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
    this.trailIntensities = null;
    this.previousVelocities = null;
    this.geometry = null;
    this.points = null;
  }
}
