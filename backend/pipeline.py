import torch
from diffusers import (
    AnimateDiffSDXLControlNetPipeline, 
    LCMScheduler, 
    MotionAdapter, 
    ControlNetModel
)
from diffusers.utils import export_to_video
from PIL import Image
import os
import glob
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

class AnimationPipeline:
    def __init__(self, device="cuda"):
        self.device = device
        
        # 1. Load Motion Adapter (SDXL version)
        self.adapter = MotionAdapter.from_pretrained(
            "guoyww/animatediff-motion-adapter-sdxl-beta", 
            torch_dtype=torch.float16
        )
        
        # 2. Load ControlNet Pose (SDXL version)
        self.controlnet = ControlNetModel.from_pretrained(
            "thibaud/controlnet-openpose-sdxl-1.0", 
            torch_dtype=torch.float16
        )
        
        # 3. Initialize Pipeline with SDXL Base Model
        # RealVisXL is one of the most realistic SDXL models
        self.pipe = AnimateDiffSDXLControlNetPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0", 
            motion_adapter=self.adapter,
            controlnet=self.controlnet,
            torch_dtype=torch.float16,
            variant="fp16"
        ).to(self.device)
        
        # 4. Load LCM-LoRA for speed (4-8 steps)
        self.pipe.load_lora_weights(
            "latent-consistency/lcm-lora-sdxl", 
            adapter_name="lcm"
        )
        
        # 5. Set Scheduler to LCM
        self.pipe.scheduler = LCMScheduler.from_config(self.pipe.scheduler.config)
        
        # 6. Enable Optimizations for T4 (16GB)
        self.pipe.enable_vae_slicing()
        self.pipe.enable_model_cpu_offload() # CRITICAL for T4
        self.pipe.enable_xformers_memory_efficient_attention()

    def generate(self, character_image_path, pose_dir, output_path, prompt):
        # Load character image
        character_image = Image.open(character_image_path).convert("RGB")
        
        # Load pose sequence
        pose_files = sorted(glob.glob(f"{pose_dir}/pose_*.png"))
        pose_images = [Image.open(f).convert("RGB") for f in pose_files]
        
        # Limit frames for memory (SDXL is heavy, 16 frames is safe)
        pose_images = pose_images[:16]
        
        # Generate with Kling-like realism prompt
        # We use a fixed high-quality prompt internally
        full_prompt = f"{prompt}, cinematic lighting, highly detailed, realistic skin, 4k, masterpiece, fluid motion"
        negative_prompt = "bad quality, distorted, lowres, flickering, blurry, cartoon, anime, 3d render"
        
        output = self.pipe(
            prompt=full_prompt,
            negative_prompt=negative_prompt,
            num_frames=len(pose_images),
            guidance_scale=1.5, # Low for LCM
            num_inference_steps=8, # Fast!
            controlnet_conditioning_scale=0.8,
            control_image=pose_images,
            width=512, # SDXL native is 1024, but 512 is safer for T4 VRAM
            height=512,
        )
        
        # Export
        export_to_video(output.frames[0], output_path, fps=12)
        return output_path
