from flask import Flask, render_template, Response, request, jsonify
from flask_cors import CORS  # Add this import
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from camselect import list_cameras
import atexit
from collections import deque

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Add this at the top with other global variables
latest_results = None

# Load YOLO model
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = YOLO('yolo11n.pt')
model.to(device)
yolo_classes = model.names

# Initialize with first available camera
available_cameras = list_cameras()
if not available_cameras:
    raise RuntimeError("No cameras found!")

# Start with the first camera
cap = cv2.VideoCapture(available_cameras[0]['id'])
width, height = 1280, 720

if not cap.isOpened():
    raise RuntimeError(f"Failed to open camera at index {available_cameras[0]['id']}")

# Simplified tracking vars
position_history = {}
HISTORY_LENGTH = 120  # Reduced from 155
SMOOTHING_FACTOR = 0.9  # Less aggressive smoothing

def smooth_position(track_id, new_pos):
    """Simple position smoothing"""
    if track_id not in position_history:
        position_history[track_id] = deque(maxlen=HISTORY_LENGTH)
    
    position_history[track_id].append(new_pos)
    
    if len(position_history[track_id]) > 2:
        positions = np.array(position_history[track_id])
        return tuple(map(int, np.mean(positions, axis=0)))
    return new_pos

def process_detections(results):
    """Simplified detection processing with bounding boxes"""
    detections = []
    if len(results) > 0 and results[0].boxes is not None:
        boxes = results[0].boxes
        for box in boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            
            if cls == 0 and conf >= 0.4:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                track_id = int(box.id[0]) if box.id is not None else 0
                
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                
                if track_id != 0:
                    center_x, center_y = smooth_position(track_id, (center_x, center_y))
                
                detections.append({
                    'x': center_x,
                    'y': center_y,
                    'id': track_id,
                    'bbox': (x1, y1, x2, y2),
                    'confidence': conf
                })
    return detections

def draw_detections(frame, detections):
    """Drawing function with bounding boxes"""
    output_frame = frame.copy()
    for det in detections:
        # Draw bounding box
        x1, y1, x2, y2 = det['bbox']
        cv2.rectangle(output_frame, (x1, y1), (x2, y2), (0, 0, 255), 2)
        
        # Draw label with confidence
        label = f"Person: {det['confidence']:.2f}"
        cv2.putText(output_frame, label, (x1, y1 - 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 1)
                    
        # Draw ID near the center point
        x, y = int(det['x']), int(det['y'])
        cv2.circle(output_frame, (x, y), 5, (0, 255, 0), -1)
        cv2.putText(output_frame, f"ID: {det['id']}", (x + 10, y), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    return output_frame

def process_frame(frame):
    """Process frame with detections"""
    global latest_results
    frame = cv2.resize(frame, (width, height))
    results = model.track(frame, verbose=False, device=device)
    latest_results = results
    
    # Get and process detections
    detections = process_detections(results)
    
    # Draw detections on frame
    return draw_detections(frame, detections)

def generate_frames():
    while True:
        success, frame = cap.read()
        if not success:
            break
            
        output_frame = process_frame(frame)
        
        ret, buffer = cv2.imencode('.jpg', output_frame)
        frame = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/switch_camera/<int:camera_id>')
def switch_camera(camera_id):
    global cap
    cap.release()  # Release current camera
    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        return jsonify({"success": False, "error": "Failed to open camera"})
    return jsonify({"success": True})

@app.route('/')
def index():
    cameras = list_cameras()
    return render_template('index.html', cameras=cameras)

@app.route('/video_feed')
def video_feed():
    def generate():
        while True:
            success, frame = cap.read()
            if not success:
                break
            
            output_frame = process_frame(frame)
            ret, buffer = cv2.imencode('.jpg', output_frame)
            frame = buffer.tobytes()
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
    
    return Response(generate(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/detections')
def get_detections():
    if latest_results and len(latest_results) > 0:
        boxes = latest_results[0].boxes
        detections = []
        if boxes is not None:
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                track_id = int(box.id[0]) if box.id is not None else 0
                
                if cls in [0] and conf >= 0.25:  # Only people
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2  # Changed to use box center
                    
                    detections.append({
                        'x': center_x,
                        'y': center_y,
                        'id': track_id,
                        'bbox': (x1, y1, x2, y2),
                        'confidence': conf
                    })
        return jsonify(detections)
    return jsonify([])

def cleanup():
    global cap
    if cap is not None:
        cap.release()
    cv2.destroyAllWindows()

# Register the cleanup function to run at exit
atexit.register(cleanup)

if __name__ == '__main__':
    try:
        app.run(debug=True, host='0.0.0.0', port=3300)  # Changed host to '0.0.0.0'
    finally:
        cleanup()
