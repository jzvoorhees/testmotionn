# Versão corrigida do motion_extractor.py
import cv2
import numpy as np
import json
import os
import sys

# --- CRITICAL: PREVENT LOCAL CONFLICTS ---
if sys.path[0] == os.getcwd() or sys.path[0] == '':
    sys.path.pop(0)

try:
    import mediapipe as mp
    from mediapipe.solutions import pose as mp_pose
    from mediapipe.solutions import drawing_utils as mp_drawing
    print(f"DEBUG: MediaPipe loaded from {mp.__file__}")
except ImportError as e:
    print(f"DEBUG: Standard import failed: {e}")
    print("Attempting to reinstall mediapipe...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "--force-reinstall", "mediapipe"])
    
    import mediapipe as mp
    from mediapipe.solutions import pose as mp_pose
    from mediapipe.solutions import drawing_utils as mp_drawing

class MotionExtractor:
    def __init__(self):
        self.mp_pose = mp_pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,
            enable_segmentation=True,
            min_detection_confidence=0.5
        )
        self.mp_drawing = mp_drawing

    def extract_motion(self, video_path, output_dir):
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        cap = cv2.VideoCapture(video_path)
        frame_count = 0
        pose_data = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(image_rgb)

            if results.pose_landmarks:
                landmarks = []
                for lm in results.pose_landmarks.landmark:
                    landmarks.append({
                        'x': lm.x,
                        'y': lm.y,
                        'z': lm.z,
                        'visibility': lm.visibility
                    })
                pose_data.append(landmarks)

                pose_canvas = np.zeros(frame.shape, dtype=np.uint8)
                self.mp_drawing.draw_landmarks(
                    pose_canvas,
                    results.pose_landmarks,
                    self.mp_pose.POSE_CONNECTIONS,
                    landmark_drawing_spec=self.mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2, circle_radius=2),
                    connection_drawing_spec=self.mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2)
                )
                
                cv2.imwrite(f"{output_dir}/pose_{frame_count:04d}.png", pose_canvas)
            
            frame_count += 1

        cap.release()
        
        with open(f"{output_dir}/motion_data.json", 'w') as f:
            json.dump(pose_data, f)
            
        return frame_count
