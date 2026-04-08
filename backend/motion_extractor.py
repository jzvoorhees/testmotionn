# backend/motion_extractor.py
import cv2
import numpy as np
import json
import os
import sys

# Warn if there is a local 'mediapipe' package shadowing site-packages
if os.path.isdir(os.path.join(os.getcwd(), "mediapipe")):
    print("WARNING: A local 'mediapipe' directory exists in the working directory and may shadow the installed package.")

# Robust import for MediaPipe (do NOT attempt to pip install here)
try:
    import mediapipe as mp
    # Try to obtain the pose and drawing modules in a few ways to handle packaging differences
    try:
        mp_pose = mp.solutions.pose
        mp_drawing = mp.solutions.drawing_utils
    except Exception:
        # fallback to explicit submodule import
        from mediapipe.solutions import pose as mp_pose  # type: ignore
        from mediapipe.solutions import drawing_utils as mp_drawing  # type: ignore

    print(f"DEBUG: MediaPipe loaded from {getattr(mp, '__file__', 'unknown')}, version={getattr(mp, '__version__', 'unknown')}")
except Exception as e:
    # Do not auto-install here (it can cause version churn). Give the user a clear actionable error.
    raise ImportError(
        "Could not import MediaPipe submodules (mediapipe.solutions). "
        "Please install a compatible MediaPipe release in the environment and restart the process. "
        "Recommended: pip install mediapipe==0.10.13 --no-cache-dir\n"
        f"Original error: {e}"
    ) from e


class MotionExtractor:
    def __init__(self):
        # mp_pose and mp_drawing are set above
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

            # Convert to RGB
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(image_rgb)

            if results and getattr(results, "pose_landmarks", None):
                # Save landmarks for this frame
                landmarks = []
                for lm in results.pose_landmarks.landmark:
                    landmarks.append({
                        'x': lm.x,
                        'y': lm.y,
                        'z': lm.z,
                        'visibility': lm.visibility
                    })
                pose_data.append(landmarks)

                # Generate Pose Image (ControlNet input)
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

        # Save full sequence data
        with open(f"{output_dir}/motion_data.json", 'w') as f:
            json.dump(pose_data, f)

        return frame_count
