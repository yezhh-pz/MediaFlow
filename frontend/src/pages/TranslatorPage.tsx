import { useState, useEffect } from 'react';
import { API_BASE } from '../api/client';
import { ArrowLeftRight, Wand2, FolderOpen } from 'lucide-react';

interface SubtitleSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export const TranslatorPage = () => {
  const [sourceText, setSourceText] = useState(() => localStorage.getItem("translator_sourceText") || "");
  const [targetText, setTargetText] = useState(() => localStorage.getItem("translator_targetText") || "");
  const [targetLang, setTargetLang] = useState("English");
  const [mode, setMode] = useState("standard");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Persistence
  useEffect(() => {
    localStorage.setItem("translator_sourceText", sourceText);
  }, [sourceText]);

  useEffect(() => {
    localStorage.setItem("translator_targetText", targetText);
  }, [targetText]);

  const handleOpenFile = async () => {
    if (window.electronAPI) {
      try {
        const fileData = await window.electronAPI.openFile() as any;
        if (fileData && fileData.path) {
           const content = await window.electronAPI.readFile(fileData.path);
           if (content) {
               setSourceText(content);
           }
        }
      } catch (e) {
          console.error("Failed to open file:", e);
          alert("Failed to read file");
      }
    } else {
        // Fallback for web (optional)
        alert("File access requires Electron environment");
    }
  };

  const handleTranslate = async () => {
    if (!sourceText) return;
    setIsTranslating(true);
    setProgress(10);
    
    try {
      // Mocking segment parsing for now - in reality we might pass JSON object directly
      // Or parse SRT. For simple demo, let's treat lines as segments.
      const lines = sourceText.split('\n').filter(l => l.trim());
      const segments: SubtitleSegment[] = lines.map((line, idx) => ({
        id: idx + 1,
        start: 0,
        end: 0,
        text: line
      }));

      const response = await fetch(`${API_BASE}/translate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: segments,
          target_language: targetLang,
          mode: mode
        })
      });

      if (!response.ok) throw new Error("Translation failed");
      
      // Handle streaming progress if implemented, or just wait for JSON
      // Assuming non-streaming for now but async task based
      const data = await response.json();
      
      if (data.segments) {
        const translatedLines = data.segments.map((s: any) => s.text).join('\n');
        setTargetText(translatedLines);
      }
      
      setProgress(100);

    } catch (e) {
      console.error(e);
      alert("Translation failed");
    } finally {
      setIsTranslating(false);
      // Reset progress after a delay if needed, or keep 100%
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-slate-900 text-slate-100 overflow-hidden">
      <header className="flex justify-between items-center bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <ArrowLeftRight className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Translator
            </h1>
            <p className="text-xs text-slate-400">LLM-Powered • Context Aware</p>
          </div>
        </div>
      </header>
      
      {/* Progress Bar */}
      {progress > 0 && (
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
              <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
              />
          </div>
      )}

      <div className="grid grid-cols-2 gap-6 h-full min-h-0">
        {/* Source Column */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
             <label className="text-sm font-medium text-slate-400">Source Subtitles</label>
             <button 
                 onClick={handleOpenFile}
                 className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 transition-all hover:text-indigo-400"
                 title="Open SRT File"
             >
                 <FolderOpen className="w-3.5 h-3.5" />
                 Open File
             </button>
          </div>
          <textarea
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-4 font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="Paste source text or SRT content here..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
        </div>

        {/* Target Column */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
             <label className="text-sm font-medium text-slate-400">Target Translation</label>
             <div className="flex gap-2">
               <select 
                 value={targetLang}
                 onChange={(e) => setTargetLang(e.target.value)}
                 className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs"
               >
                 <option value="English">English</option>
                 <option value="Chinese">Chinese</option>
                 <option value="Japanese">Japanese</option>
                 <option value="Spanish">Spanish</option>
               </select>
               <select 
                 value={mode}
                 onChange={(e) => setMode(e.target.value)}
                 className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs"
               >
                  <option value="standard">Standard (Strict 1-to-1)</option>
                  <option value="intelligent">Intelligent (Auto-Split/Merge)</option>
               </select>
               <button 
                 onClick={handleTranslate}
                 disabled={isTranslating || !sourceText}
                 className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
               >
                 {isTranslating ? 'Translating...' : <><Wand2 className="w-3 h-3"/> Translate</>}
               </button>
             </div>
          </div>
          <textarea
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-4 font-mono text-sm focus:outline-none focus:border-cyan-500 resize-none"
            placeholder="Translation will appear here..."
            value={targetText}
            readOnly
          />
        </div>
      </div>
    </div>
  );
};
