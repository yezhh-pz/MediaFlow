import React, { useState, useEffect } from 'react';
import { Upload, Play, FileAudio, Settings, FileText, ArrowRight } from 'lucide-react';
import { useTaskContext } from '../context/TaskContext';

interface TranscribeResult {
  segments: {
    id: number;
    start: number;
    end: number;
    text: string;
  }[];
  text: string;
  language: string;
}

export const TranscriberPage = () => {
  const { tasks, addTask: _addTask } = useTaskContext(); // TODO: Integrate addTask for multi-task support
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState("base");
  const [device, setDevice] = useState("cpu");
  const [_isUploading, setIsUploading] = useState(false); // TODO: Show loading state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<TranscribeResult | null>(null);

  // Poll for active task updates
  useEffect(() => {
    if (!activeTaskId) return;

    const task = tasks.find(t => t.id === activeTaskId);
    if (task) {
      if (task.status === 'completed' && task.result) {
        setResult(task.result as TranscribeResult);
        setActiveTaskId(null); // Stop polling focus
      } else if (task.status === 'failed') {
        setActiveTaskId(null);
      }
    }
  }, [tasks, activeTaskId]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type.startsWith('audio/') || droppedFile.type.startsWith('video/'))) {
      setFile(droppedFile);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      // 1. Upload File (Mocking upload to temp path for now, or using a direct path if Electron)
      // In a real Electron app, we might just pass the path. 
      // Assuming we have access to the file path directly in Electron context or via a specific upload API.
      // For this implementation, let's assume valid 'audio_path' is required by backend.
      // If web-based, we'd upload to /api/v1/upload first. 
      // IMPLEMENTATION NOTE: Creating a simplified direct path usage for local Electron.
      
      // Electron File object has 'path' property for local files
      const filePath = file.path; 
      
      if (!filePath) {
        alert("Cannot detect file path. Are you running in Electron?");
        setIsUploading(false);
        return;
      }

      // 2. Submit Task
      const response = await fetch('http://127.0.0.1:8000/api/v1/transcribe/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_path: filePath,
          model: model,
          device: device,
          vad_filter: true
        }),
      });

      if (!response.ok) throw new Error('Failed to start transcription');
      
      const data = await response.json();
      setActiveTaskId(data.task_id);
      
      // Add to local context to track immediately (optional, context likely polls backend)
      // addTask({
      //   id: data.task_id,
      //   type: 'transcribe',
      //   status: 'pending',
      //   progress: 0,
      //   name: `Transcribe ${file.name}`
      // });

    } catch (err) {
      console.error(err);
      alert("Transcription failed to start.");
    } finally {
      setIsUploading(false);
    }
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-slate-900 text-slate-100 overflow-hidden">
      <header className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <FileAudio className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Transcriber
            </h1>
            <p className="text-xs text-slate-400">Faster-Whisper • VAD Slicing • Local Processing</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 h-full min-h-0">
        {/* Left Panel: Controls */}
        <div className="col-span-4 flex flex-col gap-4">
          
          {/* File Upload */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer
              ${file ? 'border-purple-500 bg-purple-500/5' : 'border-slate-700 hover:border-slate-500 bg-slate-800/50'}
            `}
          >
            {file ? (
              <>
                <FileAudio className="w-12 h-12 text-purple-400" />
                <div className="text-center">
                  <p className="font-medium text-slate-200">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => setFile(null)}
                  className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                >
                  Change File
                </button>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-500" />
                <div className="text-center">
                  <p className="text-slate-300 font-medium">Drag & drop audio/video</p>
                  <p className="text-xs text-slate-500 mt-1">Supports MP3, WAV, MP4, MKV</p>
                </div>
              </>
            )}
          </div>

          {/* Settings */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
              <Settings className="w-4 h-4" />
              <span>Configuration</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Model Size</label>
                <select 
                  value={model} 
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="tiny">Tiny (Fastest)</option>
                  <option value="base">Base (Balanced)</option>
                  <option value="small">Small (Good)</option>
                  <option value="medium">Medium (Better)</option>
                  <option value="large-v3">Large-v3 (Best)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Compute Device</label>
                <select 
                  value={device} 
                  onChange={(e) => setDevice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="cpu">CPU (Int8)</option>
                  <option value="cuda">GPU (CUDA/Float16)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleTranscribe}
              disabled={!file || !!activeTaskId}
              className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all
                ${!file || activeTaskId 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'}
              `}
            >
              {activeTaskId ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Transcription
                </>
              )}
            </button>
          </div>

          {/* Progress Card */}
          {activeTask && (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-xs font-semibold text-purple-300">
                   {activeTask.status.toUpperCase()}
                 </span>
                 <span className="text-xs text-slate-400">{activeTask.progress.toFixed(0)}%</span>
               </div>
               <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-purple-500 transition-all duration-300"
                   style={{ width: `${activeTask.progress}%` }}
                 />
               </div>
               <p className="text-xs text-slate-400 mt-2 truncate">
                 {activeTask.message || "Initializing..."}
               </p>
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <div className="col-span-8 flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-purple-400" />
              Result Preview
            </h2>
            {result && (
              <button className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                Send to Translator <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
            {result ? (
              result.segments.map((seg) => (
                <div key={seg.id} className="flex gap-4 p-2 hover:bg-slate-700/50 rounded group">
                  <div className="text-slate-500 w-24 shrink-0 select-none text-xs pt-1">
                    {new Date(seg.start * 1000).toISOString().substr(11, 8)}
                  </div>
                  <div className="text-slate-300 group-hover:text-white transition-colors">
                    {seg.text}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
                <FileText className="w-12 h-12 opacity-20" />
                <p>No transcription results yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
