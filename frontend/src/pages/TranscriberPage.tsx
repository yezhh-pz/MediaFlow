import { FileAudio } from 'lucide-react';
import { useTranscriber } from '../hooks/useTranscriber';
import { AudioFileUploader } from '../components/transcriber/AudioFileUploader';
import { TranscriptionConfig } from '../components/transcriber/TranscriptionConfig';
import { TranscriptionResults } from '../components/transcriber/TranscriptionResults';

export const TranscriberPage = () => {
  const { state, actions } = useTranscriber();

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-slate-900 text-slate-100 overflow-hidden">
      <header className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700 shrink-0">
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

      {/* Main Content Area - Flexible height */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6">
        {/* Left Panel: Controls */}
        <div className="col-span-4 flex flex-col gap-4 overflow-y-auto">
          
          {/* File Upload */}
          <AudioFileUploader 
            file={state.file} 
            onFileSelect={actions.onFileSelect} 
            onFileDrop={actions.onFileDrop}
            onClearFile={(e) => { e.stopPropagation(); actions.setFile(null); }}
          />

          {/* Settings */}
          <TranscriptionConfig 
            model={state.model}
            setModel={actions.setModel}
            device={state.device}
            setDevice={actions.setDevice}
            onTranscribe={actions.startTranscription}
            isFileSelected={!!state.file}
            activeTaskId={state.activeTaskId}
          />

          {/* Progress Card (Local Task View) */}
          {state.activeTask && (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shrink-0">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-xs font-semibold text-purple-300">
                   {state.activeTask.status.toUpperCase()}
                 </span>
                 <span className="text-xs text-slate-400">{state.activeTask.progress.toFixed(0)}%</span>
               </div>
               <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-purple-500 transition-all duration-300"
                   style={{ width: `${state.activeTask.progress}%` }}
                 />
               </div>
               <p className="text-xs text-slate-400 mt-2 truncate">
                 {state.activeTask.message || "Initializing..."}
               </p>
            </div>
          )}
        </div>

        {/* Right Panel: Results */}
        <TranscriptionResults 
            result={state.result}
            onSendToEditor={actions.sendToEditor}
            onSendToTranslator={actions.sendToTranslator}
        />
      </div>
    </div>
  );
};
