import torch
import cv2

# Load YOLOv5 model
model = torch.hub.load('ultralytics/yolov8', 'yolov8s', pretrained=True)

def detect_objects(video_path):
    cap = cv2.VideoCapture(video_path)
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        results = model(frame)
        annotated_frame = results.render()[0]
        cv2.imshow('YOLOv8 Object Detection', annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
