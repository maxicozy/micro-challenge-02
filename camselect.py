import cv2

def list_cameras():
    """List all available cameras and their basic info"""
    camera_list = []
    for i in range(10):
        cap = cv2.VideoCapture(i)
        if cap.isOpened():
            ret, frame = cap.read()
            if ret:
                camera_list.append({
                    'id': i,
                    'name': f'Camera {i}',
                    'width': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                    'height': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                })
            cap.release()
    return camera_list

def get_best_camera():
    """Get the best available camera (preferring external over internal)"""
    cameras = list_cameras()
    if not cameras:
        raise RuntimeError("No cameras found!")
    return cameras[1] if len(cameras) > 1 else cameras[0]

def init_camera(camera_id=None, width=1280, height=720):
    """Initialize a camera with given parameters"""
    if camera_id is None:
        camera_id = get_best_camera()['id']
    
    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open camera at index {camera_id}")
    
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    
    return cap