let detections = [];
let blobs = new Map();
let persistentDetections = new Map(); // Store detections with timestamps
let lastBlobUpdate = 0;
const DETECTION_PERSISTENCE = 1400; // 3 seconds in milliseconds
const BLOB_UPDATE_INTERVAL = 900; // 2 seconds between blob updates
const DETECTION_COOLDOWN = 300; // 3 seconds cooldown before re-detecting
let connections = new Map();
const connectionThreshhold = 0.35; // 30% of screen width

window.p5UpdateDetections = function(newDetections) {
    console.log('Received new detections:', newDetections.length);
    const currentTime = Date.now();
    
    // Process new detections
    newDetections.forEach(det => {
        const existing = persistentDetections.get(det.id);
        if (!existing) {
            // New detection
            persistentDetections.set(det.id, {
                ...det,
                lastSeen: currentTime,
                state: 'active',
                nextAllowedDetection: 0
            });
        } else if (existing.state === 'active' && currentTime > existing.nextAllowedDetection) {
            // Update existing active detection
            existing.x = det.x;
            existing.y = det.y;
            existing.bbox = det.bbox;
            existing.lastSeen = currentTime;
        }
    });

    // Update persistent detections
    for (const [id, det] of persistentDetections) {
        const timeSinceLastSeen = currentTime - det.lastSeen;
        
        if (timeSinceLastSeen > DETECTION_PERSISTENCE) {
            if (det.state === 'active') {
                // Mark for cooldown
                det.state = 'cooldown';
                det.nextAllowedDetection = currentTime + DETECTION_COOLDOWN;
            } else if (currentTime > det.nextAllowedDetection) {
                // Remove after cooldown
                persistentDetections.delete(id);
            }
        }
    }

    // Update the detections array with persistent detections
    detections = Array.from(persistentDetections.values())
        .filter(det => det.state === 'active');
}  

class AnimatedBlob {
    constructor(parentPos = null) {
        this.points = 30;         // Fewer points for less curved shape
        this.angleOffsets = Array(this.points).fill(0).map(() => random(TWO_PI));
        this.noiseOffset = random(1000);
        this.phase = random(TWO_PI);
        
        // Growth animation properties
        this.currentSize = 0;
        this.targetSize = 1;
        this.growth = 0;
        this.growthSpeed = 0.01; // Slower initial growth (was 0.1)
        this.parentPos = parentPos;

        this.currentDisplaySize = 0;
        this.targetDisplaySize = 0;
        this.sizeSmoothing = 0.05; // Lower = more inertia (0.01 to 0.1)

        // Add disappearing animation properties
        this.isDisappearing = false;
        this.disappearProgress = 0;
        this.disappearSpeed = 0.01; // Match growthSpeed for symmetry

        // Add last known position properties
        this.lastX = 0;
        this.lastY = 0;
        this.lastSize = 0;

        // Initialize position and size tracking
        this.lastX = parentPos ? parentPos.x : 0;
        this.lastY = parentPos ? parentPos.y : 0;
        this.lastSize = 0;
        this.currentPos = {
            x: this.lastX,
            y: this.lastY
        };
    }

    startDisappearing() {
      this.isDisappearing = true;
    }
    
    draw(x, y, size) {
        // Update phase for continuous animation
        this.phase += 0.008;

        // If coordinates are provided, update last known position
        if (x !== undefined && y !== undefined) {
            this.lastX = x;
            this.lastY = y;
            this.lastSize = size;
            this.currentPos.x = x;
            this.currentPos.y = y;
        }

        // Use last known position if no coordinates provided
        let drawX = this.currentPos.x;
        let drawY = this.currentPos.y;
        let drawSize = this.lastSize;

        // Size smoothing
        this.targetDisplaySize = drawSize;
        this.currentDisplaySize = lerp(
            this.currentDisplaySize, 
            this.targetDisplaySize, 
            this.sizeSmoothing
        );

        // Handle appearing and disappearing animations
        if (!this.isDisappearing) {
            if (this.growth < 1) {
                this.growthSpeed *= 0.99;
                this.growth = min(1, this.growth + this.growthSpeed);
                this.currentSize = this.targetSize * (1 - Math.pow(1 - this.growth, 3));
                
                // If growing from parent, interpolate position
                if (this.parentPos && this.growth < 0.3) {
                    drawX = lerp(this.parentPos.x, drawX + (this.offset?.x || 0), this.growth / 0.3);
                    drawY = lerp(this.parentPos.y, drawY + (this.offset?.y || 0), this.growth / 0.3);
                }
            }
        } else {
            // Reverse of growth animation for disappearing
            this.disappearProgress = min(1, this.disappearProgress + this.disappearSpeed);
            this.currentSize = this.targetSize * (1 - this.disappearProgress * this.disappearProgress);
            
            if (this.disappearProgress >= 1) return false;
        }
        
        fill(255, 0, 0);  // Full opacity
        noStroke();
        
        let displaySize = this.currentDisplaySize * this.currentSize;

        // Only draw if we have valid coordinates
        if (displaySize > 0) {
            beginShape();
            for (let i = 0; i <= this.points + 1; i++) {
                let angle = (i / this.points) * TWO_PI;
                
                let r1 = noise(
                    cos(angle) + frameCount * 0.0008,
                    sin(angle) + this.noiseOffset,
                    this.phase
                );
                
                let r2 = sin(angle * 1.2 + this.phase + this.angleOffsets[i % this.points]) * 0.03;
                
                let radius = displaySize/2 * (0.95 + r1 * 0.12 + r2) * this.currentSize;
                
                let px = drawX + cos(angle) * radius;
                let py = drawY + sin(angle) * radius;
                
                curveVertex(px, py);
            }
            endShape(CLOSE);
        }

        return true;
    }
}

class BubbleConnection {
    constructor() {
        this.bubbles = [];
        this.mergeThreshold = 30;
        this.lastBubbleTime = 0;
        this.bubbleInterval = random(500, 800);
        this.hasConnection = false;
    }
    
    update(pos1, pos2, size1, size2) {
        const d = dist(pos1.x, pos1.y, pos2.x, pos2.y);
        const angle = atan2(pos2.y - pos1.y, pos2.x - pos1.x);

        // Only create bubbles if blobs are close enough
        if (d < width * connectionThreshhold && frameCount - this.lastBubbleTime > this.bubbleInterval) {
            // Create bubbles moving between the two blobs
            const offset1 = random(-PI/6, PI/6);
            const offset2 = random(-PI/6, PI/6);
            
            // First bubble: from pos1 to pos2
            const droplet1 = {
                x: pos1.x + cos(angle + offset1) * (size1/2),
                y: pos1.y + sin(angle + offset1) * (size1/2),
                targetX: pos2.x,  // Target is the other blob
                targetY: pos2.y,
                size: size1 * 0.15,
                initialSize: size1 * 0.1,
                finalSize: size1 * 0.15,
                speed: 0.002,  // Slightly faster for shorter distances
                progress: 0,
                formProgress: 0,
                pathOffset: random(-20, 20),  // Less path variation
                meanderPhase: random(TWO_PI),
                meanderSpeed: random(0.01, 0.015),
                meanderAmount: random(15, 20)  // Less meandering
            };
            
            // Second bubble: from pos2 to pos1
            const droplet2 = {
                x: pos2.x + cos(angle + PI + offset2) * (size2/2),
                y: pos2.y + sin(angle + PI + offset2) * (size2/2),
                targetX: pos1.x,  // Target is the other blob
                targetY: pos1.y,
                size: size2 * 0.15,
                initialSize: size2 * 0.1,
                finalSize: size2 * 0.15,
                speed: 0.002,
                progress: 0,
                formProgress: 0,
                pathOffset: random(-20, 20),
                meanderPhase: random(TWO_PI),
                meanderSpeed: random(0.01, 0.015),
                meanderAmount: random(15, 20)
            };
            
            this.bubbles.push(droplet1, droplet2);
            this.lastBubbleTime = frameCount;
        }
        
        // Update existing bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            let bubble = this.bubbles[i];
            
            // Update droplet formation
            if (bubble.formProgress < 1) {
                bubble.formProgress += 0.05;
                // Create stretching effect during formation
                bubble.size = lerp(0, bubble.finalSize, 
                    (1 - cos(bubble.formProgress * PI)) / 2);
            }
            
            // Update position with eased movement
            bubble.progress += bubble.speed;
            let easeProgress = 1 - Math.pow(1 - bubble.progress, 3); // Cubic ease-out
            
            let midX = (bubble.x + bubble.targetX) / 2;
            let midY = (bubble.y + bubble.targetY) / 2;
            
            // Add slight arc to path
            bubble.meanderPhase += bubble.meanderSpeed;
            let meander = sin(bubble.meanderPhase) * bubble.meanderAmount;
            
            // Modify the position calculation to include meandering
            bubble.currentX = lerp(
                lerp(bubble.x, midX, easeProgress),
                lerp(midX, bubble.targetX, easeProgress),
                easeProgress
            ) + sin(easeProgress * PI) * bubble.pathOffset 
              + cos(bubble.meanderPhase) * meander;
            
            bubble.currentY = lerp(
                lerp(bubble.y, midY, easeProgress),
                lerp(midY, bubble.targetY, easeProgress),
                easeProgress
            ) + sin(bubble.meanderPhase) * meander;
            
            // Check if bubble has left the screen margins
            if (bubble.currentX < -this.screenMargin || 
                bubble.currentX > width + this.screenMargin ||
                bubble.currentY < -this.screenMargin || 
                bubble.currentY > height + this.screenMargin) {
                this.bubbles.splice(i, 1);
                continue;
            }

            // Check for merging
            for (let j = i - 1; j >= 0; j--) {
                let otherBubble = this.bubbles[j];
                let bubbleDist = dist(bubble.currentX, bubble.currentY, 
                                   otherBubble.currentX, otherBubble.currentY);
                
                if (bubbleDist < this.mergeThreshold) {
                    otherBubble.size = (otherBubble.size + bubble.size) * 0.4;
                    otherBubble.currentX = (otherBubble.currentX + bubble.currentX) / 2;
                    otherBubble.currentY = (otherBubble.currentY + bubble.currentY) / 2;
                    this.bubbles.splice(i, 1);
                    break;
                }
            }

            // Remove bubble when it reaches its target (near the other blob)
            let distToTarget = dist(bubble.currentX, bubble.currentY, 
                                 bubble.targetX, bubble.targetY);
            if (distToTarget < size1/2 || distToTarget < size2/2) {
                this.bubbles.splice(i, 1);
                continue;
            }
        }
    }
    
    draw() {
        fill(255, 0, 0);
        noStroke();
        
        // Draw bubbles
        this.bubbles.forEach(bubble => {
            if (bubble.formProgress < 1) {
                // Draw stretching effect during formation
                let stretchX = bubble.x + (bubble.currentX - bubble.x) * bubble.formProgress;
                let stretchY = bubble.y + (bubble.currentY - bubble.y) * bubble.formProgress;
                
                beginShape();
                for (let a = 0; a < TWO_PI; a += 0.2) {
                    let r = bubble.size * (1 + 0.5 * sin(a) * (1 - bubble.formProgress));
                    let x = stretchX + cos(a) * r;
                    let y = stretchY + sin(a) * r;
                    curveVertex(x, y);
                }
                endShape(CLOSE);
            } else {
                circle(bubble.currentX, bubble.currentY, bubble.size);
            }
        });
    }
}

function setup() {
    const container = document.getElementById('p5-container');
    const videoFeed = document.getElementById('videoFeed');

    let canvas = createCanvas(videoFeed.offsetWidth, videoFeed.offsetHeight);
    canvas.parent(container);
    canvas.style('position', 'absolute');
    canvas.style('top', '0');
    canvas.style('left', '0');
    canvas.style('pointer-events', 'none');
    
    // Ensure p5 is hidden initially
    container.style.display = 'none';
    console.log('Canvas created with size:', width, height);

    clear();
}

function draw() {
    const p5Container = document.getElementById('p5-container');
    
    if (p5Container.style.display !== 'none') {
        // Clear with semi-transparent background for trail effect
        clear();
        
        const currentTime = Date.now();
        let activePositions = [];

        // Update animation state regardless of blob updates
        for (let [id, blob] of blobs) {
            blob.phase += 0.008; // Keep the phase updating for animation
        }

        // Update blob positions less frequently
        if (currentTime - lastBlobUpdate > BLOB_UPDATE_INTERVAL) {
            detections.forEach(det => {
                let x = map(det.x, 0, 1280, 0, width);
                let y = map(det.y, 0, 720, 0, height);
                
                if (!blobs.has(det.id)) {
                    blobs.set(det.id, new AnimatedBlob());
                }
                
                let [x1, y1, x2, y2] = det.bbox;
                let size = map(Math.min(x2 - x1, y2 - y1), 0, 1280, 0, width) * 0.8;
                
                activePositions.push({
                    id: det.id,
                    x: x,
                    y: y,
                    size: size
                });
            });
            
            lastBlobUpdate = currentTime;
        } else {
            // Keep using existing positions but maintain animation
            activePositions = Array.from(blobs.keys()).map(id => {
                const det = detections.find(d => d.id === id);
                if (det) {
                    let x = map(det.x, 0, 1280, 0, width);
                    let y = map(det.y, 0, 720, 0, height);
                    let [x1, y1, x2, y2] = det.bbox;
                    let size = map(Math.min(x2 - x1, y2 - y1), 0, 1280, 0, width) * 0.8;
                    return { id, x, y, size };
                }
                return null;
            }).filter(Boolean);
        }

        // Create array of active positions for connection checking
        // First pass: Update and store positions
        detections.forEach(det => {
            // Find nearest existing blob for spawning
            let nearestBlob = null;
            let nearestDist = Infinity;
            let [x1, y1, x2, y2] = det.bbox;
            // Calculate center of bounding box
            let x = map((x1 + x2) / 2, 0, 1280, 0, width);
            let y = map((y1 + y2) / 2, 0, 720, 0, height);
            let size = map(Math.min(x2 - x1, y2 - y1), 0, 1280, 0, width) * 0.9;
            
            if (!blobs.has(det.id)) {
                for (let [existingId, blob] of blobs) {
                    let existingDet = detections.find(d => d.id === existingId);
                    if (existingDet) {
                        let existingX = map(existingDet.x, 0, 1280, 0, width);
                        let existingY = map(existingDet.y, 0, 720, 0, height);
                        let d = dist(x, y, existingX, existingY);
                        if (d < width * 0.3 && d < nearestDist) {
                            nearestDist = d;
                            nearestBlob = {x: existingX, y: existingY};
                        }
                    }
                }
                blobs.set(det.id, new AnimatedBlob(nearestBlob));
            }
                
            // Store last known position if blob exists
            if (blobs.has(det.id)) {
              const blob = blobs.get(det.id);
              blob.lastX = x;
              blob.lastY = y;
              blob.lastSize = size;
          }
            
            activePositions.push({
                id: det.id,
                x: x,
                y: y,
                size: size
            });
        });
        
        // Update and draw connections
        for (let i = 0; i < activePositions.length; i++) {
            for (let j = i + 1; j < activePositions.length; j++) {
                const pos1 = activePositions[i];
                const pos2 = activePositions[j];
                const d = dist(pos1.x, pos1.y, pos2.x, pos2.y);
                
                if (d < width * connectionThreshhold) { // Connection threshold
                    const connectionId = `${pos1.id}-${pos2.id}`;
                    if (!connections.has(connectionId)) {
                        connections.set(connectionId, new BubbleConnection());
                    }
                    connections.get(connectionId).update(pos1, pos2, pos1.size, pos2.size);
                    connections.get(connectionId).draw();
                }
            }
        }
        
        // Clean up unused connections
        for (let [id, connection] of connections) {
            const [id1, id2] = id.split('-');
            if (!activePositions.find(p => p.id === parseInt(id1)) || 
                !activePositions.find(p => p.id === parseInt(id2))) {
                connections.delete(id);
            }
        }
        
        // Draw blobs on top
        activePositions.forEach(pos => {
            if (blobs.has(pos.id)) {
                blobs.get(pos.id).draw(pos.x, pos.y, pos.size);
            }
        });
        
        // Clean up unused blobs
        for (let [id, blob] of blobs) {
            if (!detections.find(d => d.id === id)) {
                if (!blob.isDisappearing) {
                    blob.startDisappearing();
                }
                // Use the blob's stored position for disappearing animation
                if (!blob.draw()) {  // No parameters needed, use stored position
                    blobs.delete(id);
                }
            }
        }
        
    } else {
        // When p5 is not active, clear canvas and show video
        clear();
    }
}