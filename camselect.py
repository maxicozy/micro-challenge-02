import cv2

def list_cameras():
    """List all available cameras and their indices."""
    camera_list = []
    for i in range(10):  # Check first 10 indices
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret:
                camera_list.append({"id": i, "name": f"Camera {i}"})
            cap.release()
    return camera_list

def select_camera():
    cameras = list_cameras()
    if not cameras:
        raise RuntimeError("No cameras found!")
    
    print("\nAvailable cameras:")
    for i, cam in enumerate(cameras):
        print(f"{i}: {cam['name']}")
    
    while True:
        try:
            selection = int(input("\nSelect camera (enter number): "))
            if 0 <= selection < len(cameras):
                return cameras[selection]['id']
            print("Invalid selection. Try again.")
        except ValueError:
            print("Please enter a number.")