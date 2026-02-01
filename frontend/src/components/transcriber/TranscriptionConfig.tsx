import React from "react";
import { Settings, Play } from "lucide-react";

interface TranscriptionConfigProps {
  model: string;
  setModel: (model: string) => void;
  device: string;
  setDevice: (device: string) => void;
  onTranscribe: () => void;
  isFileSelected: boolean;
  activeTaskId: string | null;
}

export function TranscriptionConfig({
  model,
  setModel,
  device,
  setDevice,
  onTranscribe,
  isFileSelected,
  activeTaskId,
}: TranscriptionConfigProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4 shrink-0">
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
            <option value="large-v1">Large-v1</option>
            <option value="large-v2">Large-v2</option>
            <option value="large-v3">Large-v3 (Best)</option>
            <option value="large-v3-turbo">Large-v3-Turbo (New)</option>
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
        onClick={onTranscribe}
        disabled={!isFileSelected || !!activeTaskId}
        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-all
          ${!isFileSelected || activeTaskId 
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
  );
}
