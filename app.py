from flask import Flask, render_template, Response, request, jsonify
import cv2
import numpy as np
import torch
from ultralytics import YOLO
from camselect import select_camera

app = Flask(__name__)

# Add this at the top with other global variables
latest_results = None

# Load YOLO model
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = YOLO('yolo11n.pt')
model.to(device)
yolo_classes = model.names

# Initialize video capture with selected camera
camera_index = select_camera()
cap = cv2.VideoCapture(camera_index)
width, height = 1280, 720

if not cap.isOpened():
    raise RuntimeError(f"Failed to open camera at index {camera_index}")

def process_frame(frame, bev_enabled=False):
    global latest_results
    # Resize frame
    frame = cv2.resize(frame, (width, height))
    
    # Run detection
    results = model.track(frame, verbose=False, device=device)
    latest_results = results  # Store the latest results

    if not bev_enabled:
        # Return normal detection view
        if len(results) > 0:
            return results[0].plot()
        return frame
    
    # Create blank images for BEV
    image_ = np.zeros((height, width, 3), dtype=np.uint8)
    transformed_image_with_centroids = image_.copy()
    
    # Run detection
    results = model.track(frame, verbose=False, device=device)
    
    if len(results) > 0:
        boxes = results[0].boxes
        if boxes is not None:
            objs = []
            for box in boxes:
                # Get coordinates and class
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                
                if cls in [0, 1, 2, 3, 5, 7] and conf >= 0.3:
                    centroid_x = (x1 + x2) // 2
                    centroid_y = y2  # bottom center
                    objs.append([(centroid_x, centroid_y), yolo_classes[cls]])
    
    # Define BEV transform points
    src_points = np.float32([
        (10, 720), (530, 400),
        (840, 400), (1270, 720)
    ])
    dst_points = np.float32([
        (370, 720), (150, 0),
        (width-150, 0), (900, 720)
    ])
    
    # Transform points to BEV
    M = cv2.getPerspectiveTransform(src_points, dst_points)
    
    # Plot objects in BEV
    for obj in objs:
        centroid_coords = np.array([list(obj[0])], dtype=np.float32)
        transformed_coords = cv2.perspectiveTransform(centroid_coords.reshape(-1, 1, 2), M)
        transformed_coords_ = tuple(transformed_coords[0][0].astype(int))
        
        # Draw circles and labels
        cv2.circle(transformed_image_with_centroids, transformed_coords_, radius=3, 
                  color=(0, 255, 0), thickness=-1)
        cv2.circle(transformed_image_with_centroids, transformed_coords_, radius=12, 
                  color=(255, 255, 255), thickness=1)
        cv2.putText(transformed_image_with_centroids, obj[1], 
                    (transformed_coords_[0] + 10, transformed_coords_[1]), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
    
    # Draw reference points
    cv2.polylines(transformed_image_with_centroids, [src_points.astype(int)], 
                  True, (0, 0, 255), 2)
    cv2.polylines(transformed_image_with_centroids, [dst_points.astype(int)], 
                  True, (255, 0, 0), 2)
    
    return transformed_image_with_centroids

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
    # Get the BEV parameter from the query string once, at route level
    bev_enabled = request.args.get('bev', '0') == '1'
    
    def generate():
        while True:
            success, frame = cap.read()
            if not success:
                break
            
            output_frame = process_frame(frame, bev_enabled)
            
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
                
                if cls in [0] and conf >= 0.3:  # Only people
                    width = x2 - x1
                    height = y2 - y1
                    center_x = x1 + (width/2)
                    center_y = y1 + (height/2)
                    size = min(width, height) * 0.75  # 75% of the smaller dimension
                    
                    detections.append({
                        'x': center_x,
                        'y': center_y,
                        'id': track_id,
                        'size': size
                    })
        return jsonify(detections)
    return jsonify([])

if __name__ == '__main__':
    app.run(debug=True)
