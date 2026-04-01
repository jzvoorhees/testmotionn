/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Video, 
  Image as ImageIcon, 
  Play, 
  Cpu, 
  Layers, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Info,
  ExternalLink,
  Download,
  RefreshCw,
  Terminal,
  Github,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

interface FileData {
  file: File;
  preview: string;
  base64: string;
}

enum AppState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  UPLOADING = 'UPLOADING',
  EXTRACTING_POSES = 'EXTRACTING_POSES',
  GENERATING_VIDEO = 'GENERATING_VIDEO',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// --- Components ---

const Header = ({ showDevMode, setShowDevMode }: { showDevMode: boolean, setShowDevMode: (v: boolean) => void }) => (
  <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <Zap className="w-5 h-5 text-black fill-current" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">OpenMotion <span className="text-emerald-500">AI</span></h1>
      </div>
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
        <a href="#setup" className="hover:text-white transition-colors">Setup Guide</a>
        <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
        <button 
          onClick={() => setShowDevMode(!showDevMode)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-bold transition-all",
            showDevMode ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"
          )}
        >
          {showDevMode ? 'DEV MODE: ON' : 'DEV MODE: OFF'}
        </button>
        <div className="h-4 w-px bg-zinc-800" />
        <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-500 font-mono uppercase tracking-widest">v2.0.0-open-source</span>
      </nav>
    </div>
  </header>
);

const UploadZone = ({ 
  label, 
  icon: Icon, 
  accept, 
  onFileSelect, 
  fileData 
}: { 
  label: string; 
  icon: any; 
  accept: string; 
  onFileSelect: (file: File) => void;
  fileData: FileData | null;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-2xl transition-all duration-300 overflow-hidden aspect-video flex flex-col items-center justify-center gap-4",
        isDragging ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/50",
        fileData && "border-solid border-emerald-500/50"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={inputRef} 
        className="hidden" 
        accept={accept} 
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} 
      />
      
      {fileData ? (
        <div className="absolute inset-0 w-full h-full">
          {accept.includes('video') ? (
            <video src={fileData.preview} className="w-full h-full object-cover" muted loop autoPlay />
          ) : (
            <img src={fileData.preview} className="w-full h-full object-cover" alt="Preview" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-white" />
          </div>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6 text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-200">{label}</p>
            <p className="text-xs text-zinc-500 mt-1">Drag and drop or click to upload</p>
          </div>
        </>
      )}
    </div>
  );
};

export default function App() {
  const [image, setImage] = useState<FileData | null>(null);
  const [video, setVideo] = useState<FileData | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDevMode, setShowDevMode] = useState(false);
  const [backendUrl, setBackendUrl] = useState('http://localhost:8000');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulate Pose Extraction Visualization
  useEffect(() => {
    if (appState === AppState.EXTRACTING_POSES && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      let frame = 0;
      const interval = setInterval(() => {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        const centerX = canvasRef.current!.width / 2;
        const centerY = canvasRef.current!.height / 2;
        const offset = Math.sin(frame * 0.2) * 20;
        ctx.beginPath(); ctx.arc(centerX, centerY - 60 + offset, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX, centerY - 45 + offset); ctx.lineTo(centerX, centerY + 40 + offset); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(centerX - 40, centerY - 20 + offset); ctx.lineTo(centerX + 40, centerY - 20 + offset); ctx.stroke();
        frame++;
        if (frame > 100) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [appState]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageSelect = async (file: File) => {
    const base64 = await fileToBase64(file);
    setImage({ file, preview: URL.createObjectURL(file), base64: base64.split(',')[1] });
  };

  const handleVideoSelect = async (file: File) => {
    const base64 = await fileToBase64(file);
    setVideo({ file, preview: URL.createObjectURL(file), base64: base64.split(',')[1] });
  };

  const runPipeline = async () => {
    if (!image || !video) return;
    
    setAppState(AppState.CONNECTING);
    setError(null);
    setResultVideoUrl(null);
    setStatusMessage('Connecting to local backend...');

    try {
      // 1. Check if backend is alive
      const healthCheck = await fetch(`${backendUrl}/docs`).catch(() => null);
      if (!healthCheck) {
        throw new Error(`Could not connect to backend at ${backendUrl}. Please ensure your Python FastAPI server is running.`);
      }

      setAppState(AppState.UPLOADING);
      setStatusMessage('Uploading assets to GPU server...');

      const formData = new FormData();
      formData.append('image', image.file);
      formData.append('video', video.file);

      const response = await fetch(`${backendUrl}/api/process`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to start processing task');
      
      const { task_id } = await response.json();
      
      // 2. Poll for status
      const pollStatus = async () => {
        const statusRes = await fetch(`${backendUrl}/api/status/${task_id}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'extracting_motion') {
          setAppState(AppState.EXTRACTING_POSES);
          setStatusMessage('MediaPipe: Extracting skeleton keypoints...');
        } else if (statusData.status === 'generating_animation') {
          setAppState(AppState.GENERATING_VIDEO);
          setStatusMessage('AnimateDiff: Synthesizing diffusion frames...');
        } else if (statusData.status === 'completed') {
          setResultVideoUrl(`${backendUrl}${statusData.result_url}`);
          setAppState(AppState.COMPLETED);
          setStatusMessage('Motion transfer complete!');
          return;
        } else if (statusData.status === 'error') {
          throw new Error(statusData.error || 'Pipeline failed');
        }

        setTimeout(pollStatus, 3000);
      };

      pollStatus();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
      setAppState(AppState.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 font-sans selection:bg-emerald-500/30">
      <Header showDevMode={showDevMode} setShowDevMode={setShowDevMode} />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="mb-16 text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold mb-6 uppercase tracking-widest"
          >
            <Zap className="w-3 h-3 fill-current" />
            100% Open Source • No API Keys
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4"
          >
            Realistic Motion Transfer <br />
            <span className="text-emerald-500">Without Paid APIs</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 max-w-2xl mx-auto text-lg"
          >
            A full-stack solution using MediaPipe, ControlNet, and AnimateDiff. Run it locally or on Google Colab for free.
          </motion.p>
        </section>

        {/* Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          {/* Inputs */}
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100 uppercase tracking-wider">
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  Character Image
                </div>
                <UploadZone 
                  label="Character Photo" 
                  icon={ImageIcon} 
                  accept="image/*" 
                  onFileSelect={handleImageSelect}
                  fileData={image}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100 uppercase tracking-wider">
                  <Video className="w-4 h-4 text-emerald-500" />
                  Reference Motion
                </div>
                <UploadZone 
                  label="Motion Video" 
                  icon={Video} 
                  accept="video/*" 
                  onFileSelect={handleVideoSelect}
                  fileData={video}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-full p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center gap-4">
                <Terminal className="w-5 h-5 text-zinc-500" />
                <div className="flex-grow">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Backend URL</p>
                  <input 
                    type="text" 
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none"
                    placeholder="http://localhost:8000"
                  />
                </div>
              </div>

              <button
                disabled={!image || !video || (appState !== AppState.IDLE && appState !== AppState.COMPLETED && appState !== AppState.ERROR)}
                onClick={runPipeline}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300",
                  (!image || !video) 
                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                    : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                )}
              >
                {appState === AppState.IDLE || appState === AppState.COMPLETED || appState === AppState.ERROR ? (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Start Open-Source Pipeline
                  </>
                ) : (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {statusMessage}
                  </>
                )}
              </button>
            </div>

            {/* Status & Error */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-bold">Backend Connection Error</p>
                    <p className="opacity-80">{error}</p>
                    <div className="mt-2 flex gap-4">
                      <a href="#setup" className="underline font-bold">Follow Setup Guide</a>
                      <a href="https://colab.research.google.com" target="_blank" className="underline font-bold flex items-center gap-1">
                        Open Google Colab <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Result Preview */}
          <div className="lg:col-span-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Output Preview</h3>
                {resultVideoUrl && (
                  <span className="flex items-center gap-1 text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">
                    <CheckCircle2 className="w-3 h-3" />
                    READY
                  </span>
                )}
              </div>

              <div className="flex-grow flex items-center justify-center bg-black rounded-2xl border border-zinc-800 overflow-hidden relative aspect-[9/16] lg:aspect-auto min-h-[400px]">
                {resultVideoUrl ? (
                  <video 
                    src={resultVideoUrl} 
                    className="w-full h-full object-contain" 
                    controls 
                    autoPlay 
                    loop 
                  />
                ) : (
                  <div className="text-center p-8 w-full h-full flex flex-col items-center justify-center">
                    {appState === AppState.EXTRACTING_POSES ? (
                      <div className="space-y-4 w-full">
                        <canvas ref={canvasRef} width={300} height={400} className="mx-auto" />
                        <p className="text-sm text-emerald-500 font-mono animate-pulse">{statusMessage}</p>
                      </div>
                    ) : appState === AppState.GENERATING_VIDEO || appState === AppState.UPLOADING || appState === AppState.CONNECTING ? (
                      <div className="space-y-4">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
                        <p className="text-sm text-zinc-400">{statusMessage}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Play className="w-12 h-12 text-zinc-800 mx-auto" />
                        <p className="text-sm text-zinc-500">Generated video will appear here after processing</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {resultVideoUrl && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <a 
                    href={resultVideoUrl} 
                    download="motion-transfer.mp4"
                    className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  <button 
                    onClick={() => {
                      setResultVideoUrl(null);
                      setAppState(AppState.IDLE);
                    }}
                    className="flex items-center justify-center gap-2 py-3 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Setup Guide Section */}
        <section id="setup" className="space-y-12 pt-12 border-t border-zinc-800">
          <div className="max-w-4xl">
            <h2 className="text-3xl font-bold text-white mb-4">Setup Guide: Run Locally or on Colab</h2>
            <p className="text-zinc-400 mb-8">
              Since this application uses heavy open-source models (Stable Diffusion, AnimateDiff), it requires a GPU with at least 12GB VRAM. Follow these steps to set up your own backend.
            </p>

            <div className="space-y-6">
              <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Terminal className="w-6 h-6 text-emerald-500" />
                  <h3 className="text-xl font-bold text-white">1. Local Installation</h3>
                </div>
                <div className="bg-black/50 p-4 rounded-lg font-mono text-xs text-zinc-300 space-y-2 overflow-x-auto">
                  <p># Clone the repository</p>
                  <p>git clone https://github.com/jzvoorhees/testmotionn.git</p>
                  <p>cd backend</p>
                  <p># Create virtual environment</p>
                  <p>python -m venv venv && source venv/bin/activate</p>
                  <p># Install dependencies</p>
                  <p>pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121</p>
                  <p>pip install fastapi uvicorn mediapipe diffusers transformers accelerate xformers</p>
                  <p># Run the server</p>
                  <p>python main.py</p>
                </div>
              </div>

              <div className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                  <h3 className="text-xl font-bold text-white">2. Run on Google Colab (Free GPU)</h3>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  If you don't have a local GPU, you can run the backend on Google Colab. This will provide a temporary URL (via ngrok or localtunnel) that you can paste into the "Backend URL" field above.
                </p>
                <a 
                  href="https://colab.research.google.com/github/jzvoorhees/testmotionn/blob/main/colab_backend.ipynb" 
                  target="_blank"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Colab Notebook
                </a>
              </div>
            </div>
          </div>

          <div id="architecture" className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Open-Source AI Pipeline</h3>
                <p className="text-zinc-500 text-sm">How the motion transfer works without proprietary APIs</p>
              </div>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-mono">MediaPipe</span>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-mono">ControlNet</span>
                <span className="px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-xs font-mono">AnimateDiff</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-emerald-500 font-bold">1</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Motion Extraction</h4>
                    <p className="text-sm text-zinc-500">MediaPipe Pose detects 33 landmarks in the reference video. These are converted into a sequence of skeleton images that serve as the "motion blueprint".</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-emerald-500 font-bold">2</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Identity Locking</h4>
                    <p className="text-sm text-zinc-500">The character image is processed through a VAE and optionally an IP-Adapter. This ensures the generated character looks exactly like the source image.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-emerald-500 font-bold">3</div>
                  <div>
                    <h4 className="text-white font-bold mb-1">Diffusion Guidance</h4>
                    <p className="text-sm text-zinc-500">ControlNet Pose uses the skeleton sequence to guide the Stable Diffusion denoising process, forcing the character into the specific poses from the reference video.</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-black/50 p-6 rounded-2xl border border-zinc-800">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Pipeline Visualization</h4>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <div className="flex-grow h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="w-full h-full bg-emerald-500"></div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">VIDEO_IN</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <div className="flex-grow h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="w-3/4 h-full bg-blue-500"></div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">POSE_EXTRACT</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <div className="flex-grow h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="w-1/2 h-full bg-orange-500"></div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">DIFFUSION</span>
                  </div>
                  <div className="mt-8 p-4 bg-zinc-900 rounded-lg">
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      The system uses **Realistic Vision V5.1** as the base checkpoint to ensure photographic quality, while **AnimateDiff v3** provides the temporal consistency required for smooth video output.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 py-12 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Zap className="w-5 h-5 text-emerald-500" />
            <span className="font-bold text-white">OpenMotion AI</span>
          </div>
          <p className="text-zinc-600 text-sm">© 2026 OpenMotion AI Research. All rights reserved.</p>
          <div className="flex gap-6 text-zinc-500 text-sm">
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
