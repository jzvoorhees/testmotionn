from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import shutil
import os
import uuid
import json
import sys

# Add the current directory to sys.path to ensure local imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from motion_extractor import MotionExtractor
from pipeline import AnimationPipeline

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup directories
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Serve static files for video/image previews
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# Global state for tasks
tasks = {}

@app.post("/api/process")
async def process_motion_transfer(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    video: UploadFile = File(...)
):
    task_id = str(uuid.uuid4())
    tasks[task_id] = {"status": "pending", "progress": 0}
    
    # Save files
    image_path = os.path.join(UPLOAD_DIR, f"{task_id}_image.png")
    video_path = os.path.join(UPLOAD_DIR, f"{task_id}_video.mp4")
    
    with open(image_path, "wb") as f:
        shutil.copyfileobj(image.file, f)
    with open(video_path, "wb") as f:
        shutil.copyfileobj(video.file, f)
        
    # Start background task
    background_tasks.add_task(run_pipeline, task_id, image_path, video_path)
    
    return {"task_id": task_id}

@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    return tasks.get(task_id, {"status": "not_found"})

def run_pipeline(task_id, image_path, video_path):
    try:
        tasks[task_id]["status"] = "extracting_motion"
        extractor = MotionExtractor()
        pose_dir = os.path.join(OUTPUT_DIR, f"{task_id}_poses")
        extractor.extract_motion(video_path, pose_dir)
        
        tasks[task_id]["status"] = "generating_animation"
        tasks[task_id]["progress"] = 50
        
        pipeline = AnimationPipeline()
        output_path = os.path.join(OUTPUT_DIR, f"{task_id}_result.mp4")
        
        # Default prompt for Kling-like realism
        prompt = "Cinematic 4k video, highly detailed realistic person dancing, fluid movement, masterpiece, hyper-realistic skin texture, professional lighting"
        
        pipeline.generate(image_path, pose_dir, output_path, prompt)
        
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["result_url"] = f"/outputs/{task_id}_result.mp4"
        tasks[task_id]["progress"] = 100
        
    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error"] = str(e)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
