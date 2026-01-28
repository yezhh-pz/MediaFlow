import React, { useState } from 'react';
import { useTaskContext } from '../context/TaskContext';
import { ArrowLeftRight, Wand2, Check } from 'lucide-react';

interface SubtitleSegment {
  id: number;
  start: float;
  end: float;
  text: string;
}

export const TranslatorPage = () => {
  const [sourceText, setSourceText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [mode, setMode] = useState("standard");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleTranslate = async () => {
    if (!sourceText) return;
    setIsTranslating(true);
    setProgress(10);
    
    try {
      // Mocking segment parsing for now - in reality we might pass JSON object directly
      // Or parse SRT. For simple demo, let's treat lines as segments.
      const lines = sourceText.split('\n').filter(l => l.trim());
      const segments = lines.map((line, idx) => ({
        id: idx + 1,
        start: 0,
        end: 0,
        text: line
      }));

      const response = await fetch('http://127.0.0.1:8000/api/v1/translate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: segments,
          target_language: targetLang,
          mode: mode
        })
      });

      if (!response.ok) throw new Error("Translation failed");
      
      const reader = response.body?.getReader();
      // Handle streaming progress if implemented, or just wait for JSON
      // Assuming non-streaming for now but async task based
      const data = await response.json();
      
      // If task based, we poll. If sync, we get result.
      // Let's assume sync for small batches or task based for large.
      // For this UI demo, let's assume direct return for simplicity or update this to polling.
      // Given the previous pattern, let's stick to task polling if time permits, 
      // but for "Start" let's implement basic sync wrapper or simplified task.
      
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

      <div className="grid grid-cols-2 gap-6 h-full min-h-0">
        {/* Source Column */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-400">Source Subtitles</label>
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
                 <option value="standard">Standard</option>
                 <option value="reflect">Reflect (Slower, Better)</option>
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
