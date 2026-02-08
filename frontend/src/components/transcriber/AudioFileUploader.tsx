import React from "react";
import { Upload, FileAudio } from "lucide-react";

interface AudioFileUploaderProps {
  file: File | null;
  onFileSelect: () => void;
  onFileDrop: (e: React.DragEvent) => void;
  onClearFile: (e: React.MouseEvent) => void;
}

export function AudioFileUploader({ file, onFileSelect, onFileDrop, onClearFile }: AudioFileUploaderProps) {
  return (
    <div 
      onClick={onFileSelect}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onFileDrop}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer shrink-0
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
            onClick={(e) => { e.stopPropagation(); onFileSelect(); }}
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
  );
}
