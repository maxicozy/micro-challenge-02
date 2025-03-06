let detections = [];

function setup() {
    const container = document.getElementById('p5-container');
    let canvas = createCanvas(1280, 720);
    canvas.parent(container);
    noStroke();
    textAlign(CENTER, CENTER);
}

function draw() {
    clear();
    
    // Draw dots for each detection
    detections.forEach(det => {
        // Draw circle
        fill(255, 0, 0, 200);
        circle(det.x, det.y, det.size);
        
        // Draw ID text
        fill(255);
        textSize(det.size * 0.2);  // Text size relative to circle
        text(det.id, det.x, det.y);
    });
}

function updateDetections(newDetections) {
    detections = newDetections;
}