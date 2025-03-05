# app.py
from flask import Flask, render_template, Response
import cv2
from ultralytics import YOLO

app = Flask(__name__)

# Load YOLOv8 model
model = YOLO('yolov8n.pt')

# Initialize webcam
# cap = cv2.VideoCapture(0)
cap = cv2.VideoCapture('uploads/IMG_1067.MOV')

def generate_frames():
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return
    while True:
        success, frame = cap.read()
        if not success:
            break

        # Run YOLOv8 inference
        results = model(frame)
        annotated_frame = results[0].plot()

        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        frame = buffer.tobytes()

        # Stream frame to browser
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    try:
        return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')
    except Exception as e:
        print(f"Error in video feed: {e}")
        return "Video feed error"
        
if __name__ == '__main__':
    app.run(debug=True)
