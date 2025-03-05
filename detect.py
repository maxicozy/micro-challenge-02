# detect.py
import cv2
from ultralytics import YOLO

# Load YOLOv8 model
model = YOLO('yolov8n.pt')  # Make sure to have yolov8n.pt in the same folder or specify the path

# Initialize webcam (0 is usually the default camera)
cap = cv2.VideoCapture(1)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Run YOLOv8 inference
    results = model(frame)

    # Draw bounding boxes
    annotated_frame = results[0].plot()  # Plot detection boxes on the frame

    # Display in a window (for testing)
    cv2.imshow('YOLOv8 Webcam Detection', annotated_frame)

    # Exit with 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
