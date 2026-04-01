import torch
from diffusers import AnimateDiffPipeline, DDIMScheduler, MotionAdapter, ControlNetModel
from diffusers.utils import export_to_video
from PIL import Image
import os
import glob

class AnimationPipeline:
    def __init__(self, device="cuda"):
        self.device = device
        
        # 1. Load Motion Adapter
        self.adapter = MotionAdapter.from_pretrained(
            "guoyww/animatediff-motion-adapter-v1-5-2", 
            torch_dtype=torch.float16
        )
        
        # 2. Load ControlNet Pose
        self.controlnet = ControlNetModel.from_pretrained(
            "lllyasviel/sd-controlnet-openpose", 
            torch_dtype=torch.float16
        )
        
        # 3. Initialize Pipeline
        self.pipe = AnimateDiffPipeline.from_pretrained(
            "SG161222/Realistic_Vision_V5.1_noVAE", # High quality base model
            motion_adapter=self.adapter,
            controlnet=self.controlnet,
            torch_dtype=torch.float16
        ).to(self.device)
        
        # 4. Set Scheduler
        self.pipe.scheduler = DDIMScheduler.from_config(
            self.pipe.scheduler.config, 
            clip_sample=False, 
            timestep_spacing="linspace",
            steps_offset=1
        )
        
        # 5. Enable Optimizations
        self.pipe.enable_vae_slicing()
        self.pipe.enable_model_cpu_offload()

    def generate(self, character_image_path, pose_dir, output_path, prompt):
        # Load character image
        character_image = Image.open(character_image_path).convert("RGB")
        
        # Load pose sequence
        pose_files = sorted(glob.glob(f"{pose_dir}/pose_*.png"))
        pose_images = [Image.open(f).convert("RGB") for f in pose_files]
        
        # Limit frames for memory (e.g., 16 or 24)
        pose_images = pose_images[:16]
        
        # Generate
        output = self.pipe(
            prompt=prompt,
            negative_prompt="bad quality, distorted, lowres, flickering, blurry",
            num_frames=len(pose_images),
            guidance_scale=7.5,
            num_inference_steps=25,
            controlnet_conditioning_scale=1.0,
            control_image=pose_images,
            image=character_image # IP-Adapter or Image-to-Video style
        )
        
        # Export
        export_to_video(output.frames[0], output_path, fps=8)
        return output_path
