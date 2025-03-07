let detections = [];
let blobs = new Map();

class AnimatedBlob {
    constructor() {
        this.points = 35;         // Fewer points for less curved shape
        this.angleOffsets = Array(this.points).fill(0).map(() => random(TWO_PI));
        this.noiseOffset = random(1000);
        this.phase = random(TWO_PI);
    }
    
    draw(x, y, size) {
        this.phase += 0.008;     // Slightly slower for smoother movement
        
        fill(255, 0, 0);     // Slightly more transparent
        noStroke();
        
        beginShape();
        for (let i = 0; i <= this.points + 1; i++) {
            let angle = (i / this.points) * TWO_PI;
            
            // Simpler noise with less variation
            let r1 = noise(
                cos(angle) + frameCount * 0.0008,
                sin(angle) + this.noiseOffset,
                this.phase
            );
            
            // Very subtle sine influence
            let r2 = sin(angle * 1.5 + this.phase + this.angleOffsets[i % this.points]) * 0.05;
            
            // Smoother radius calculation with more weight on base circle
            let radius = size/2 * (0.95 + r1 * 0.12 + r2);
            
            let px = x + cos(angle) * radius;
            let py = y + sin(angle) * radius;
            
            curveVertex(px, py);
        }
        endShape();
    }
}

function setup() {
    const container = document.getElementById('p5-container');
    let canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent(container);
    canvas.style('position', 'absolute');
    canvas.style('top', '0');
    canvas.style('left', '0');
    canvas.style('pointer-events', 'none');
}

function draw() {
    clear();
    
    if (document.getElementById('p5-container').style.display !== 'none') {
        detections.forEach(det => {
            // Create or retrieve blob for this detection
            if (!blobs.has(det.id)) {
                blobs.set(det.id, new AnimatedBlob());
            }
            
            // Map detection coordinates to canvas
            let x = map(det.x, 0, 1280, 0, width);
            let y = map(det.y, 0, 720, 0, height);
            
            // Calculate size from bounding box
            let [x1, y1, x2, y2] = det.bbox;
            let size = map(Math.min(x2 - x1, y2 - y1), 0, 1280, 0, width) * 0.8;
            
            // Draw the blob
            blobs.get(det.id).draw(x, y, size);
        });
        
        // Clean up unused blobs
        for (let [id, blob] of blobs) {
            if (!detections.find(d => d.id === id)) {
                blobs.delete(id);
            }
        }
    }
}

function updateDetections(newDetections) {
    detections = newDetections;
}