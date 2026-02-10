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
    <div className="flex flex-col gap-6">
       {/* Section Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 uppercase tracking-widest pl-1">
        <Settings className="w-3.5 h-3.5" />
        <span>Configuration</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Model Size</label>
          <div className="relative group">
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 appearance-none cursor-pointer hover:bg-black/60 transition-all shadow-sm font-medium truncate pr-8"
            >
              <option value="tiny" className="bg-[#1a1a1a]">Tiny (Fastest)</option>
              <option value="base" className="bg-[#1a1a1a]">Base (Balanced)</option>
              <option value="small" className="bg-[#1a1a1a]">Small (Good)</option>
              <option value="medium" className="bg-[#1a1a1a]">Medium (Better)</option>
              <option value="large-v1" className="bg-[#1a1a1a]">Large-v1</option>
              <option value="large-v2" className="bg-[#1a1a1a]">Large-v2</option>
              <option value="large-v3" className="bg-[#1a1a1a]">Large-v3 (Best)</option>
              <option value="large-v3-turbo" className="bg-[#1a1a1a]">Large-v3-Turbo (New)</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Compute Device</label>
           <div className="relative group">
            <select 
              value={device} 
              onChange={(e) => setDevice(e.target.value)}
              className="w-full h-10 bg-black/40 border border-white/10 rounded-lg px-3 text-xs text-white focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 appearance-none cursor-pointer hover:bg-black/60 transition-all shadow-sm font-medium truncate pr-8"
            >
              <option value="cpu" className="bg-[#1a1a1a]">CPU (Int8)</option>
              <option value="cuda" className="bg-[#1a1a1a]">GPU (CUDA/Float16)</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onTranscribe}
        disabled={!isFileSelected || !!activeTaskId}
        className={`w-full h-12 rounded-xl flex items-center justify-center gap-2.5 font-bold text-sm transition-all shadow-lg relative overflow-hidden group/btn
          ${!isFileSelected || activeTaskId 
            ? 'bg-slate-800/50 border border-white/5 text-slate-500 cursor-not-allowed shadow-none' 
            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-500/20 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 border border-white/10'}
        `}
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 pointer-events-none" />
        <span className="relative z-10 flex items-center gap-2">
          {activeTaskId ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Start Transcription
              <Play className="w-4 h-4 fill-current" />
            </>
          )}
        </span>
      </button>
    </div>
  );
}
