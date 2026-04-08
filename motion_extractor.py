import importlib

try:
    mediapipe = importlib.import_module('mediapipe')
except ImportError as e:
    print(f'Error importing mediapipe: {e}')
    mediapipe = None  # Handle case when mediapipe is not available

# Add the rest of your motion_extractor.py code here, utilizing mediapipe where appropriate.