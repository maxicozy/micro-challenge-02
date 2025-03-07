import cv2
import numpy as np
import torch
from ultralytics import YOLO
import math
from collections import deque
from app import model, process_detections, draw_detections
from camselect import init_camera

# Load the YOLO model
device = 'cuda' if torch.cuda.is_available() else 'cpu'
# model = YOLO('yolov5n.pt')  # load an official model
model = YOLO('yolo11n.pt')  # load an official model
model.to(device)
yolo_classes = model.names

# Initialize camera with desired resolution
width, height = 1280, 720
cap = init_camera(width=width, height=height)

# Verify camera opened successfully
if not cap.isOpened():
    raise RuntimeError(f"Failed to open camera")

# Video writer setup
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
output_path = 'output.mp4'
fps = 30
videoOut = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

# Verify video writer initialized successfully
if not videoOut.isOpened():
    raise RuntimeError("Failed to create output video file")

# Main loop
while True:
    success, frame = cap.read()
    if not success:
        break
    
    frame = cv2.resize(frame, (width, height))
    results = model.track(frame, verbose=False, device=device)
    detections = process_detections(results)
    output_frame = draw_detections(frame, detections)
    
    videoOut.write(output_frame)
    cv2.imshow("Video", output_frame)
    
    if cv2.waitKey(400) & 0xFF == ord('q'):
        break

cap.release()
videoOut.release()
cv2.destroyAllWindows()