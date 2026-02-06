
import { useState, useEffect } from 'react';
import { translatorService, type GlossaryTerm } from '../services/translator/translatorService';
import type { SubtitleSegment } from '../types/task';
import { 
    Wand2, FolderOpen, Loader2, 
    Book, Plus, Trash2, Globe, Settings2, Download
} from 'lucide-react';
import { parseSRT } from '../utils/subtitleParser';

export const TranslatorPage = () => {
    // Data State
    const [sourceSegments, setSourceSegments] = useState<SubtitleSegment[]>([]);
    const [targetSegments, setTargetSegments] = useState<SubtitleSegment[]>([]);
    const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
    
    // UI State
    const [targetLang, setTargetLang] = useState("Chinese");
    const [mode, setMode] = useState<"standard" | "intelligent">("standard");
    const [taskId, setTaskId] = useState<string | null>(null);
    const [taskStatus, setTaskStatus] = useState<string>("");
    const [progress, setProgress] = useState(0);
    const [showGlossary, setShowGlossary] = useState(false);
    
    // Glossary Inputs
    const [newTermSource, setNewTermSource] = useState("");
    const [newTermTarget, setNewTermTarget] = useState("");

    // Initial Load & Persistence
    useEffect(() => {
        refreshGlossary();
        
        // Load persisted state
        const savedSource = localStorage.getItem("translator_sourceSegments");
        const savedTarget = localStorage.getItem("translator_targetSegments");
        if (savedSource) {
            try { setSourceSegments(JSON.parse(savedSource)); } catch (e) { console.error(e); }
        }
        if (savedTarget) {
            try { setTargetSegments(JSON.parse(savedTarget)); } catch (e) { console.error(e); }
        }
    }, []);

    // Persist changes
    useEffect(() => {
        localStorage.setItem("translator_sourceSegments", JSON.stringify(sourceSegments));
    }, [sourceSegments]);

    useEffect(() => {
        localStorage.setItem("translator_targetSegments", JSON.stringify(targetSegments));
    }, [targetSegments]);

    const refreshGlossary = async () => {
        try {
            const terms = await translatorService.listTerms();
            setGlossary(terms);
        } catch (e) {
            console.error("Failed to load glossary");
        }
    };

    const handleAddTerm = async () => {
        if (!newTermSource || !newTermTarget) return;
        await translatorService.addTerm({ source: newTermSource, target: newTermTarget });
        setNewTermSource("");
        setNewTermTarget("");
        refreshGlossary();
    };
    
    const handleDeleteTerm = async (id: string) => {
        await translatorService.deleteTerm(id);
        refreshGlossary();
    };

    const handleOpenFile = async () => {
         if (window.electronAPI) {
            const fileData = await window.electronAPI.openFile() as any;
            if (fileData && fileData.path) {
                const content = await window.electronAPI.readFile(fileData.path);
                if (content) {
                    const parsed = parseSRT(content);
                    setSourceSegments(parsed);
                    setTargetSegments([]); // Clear previous
                }
            }
         }
    };

    const handleTranslate = async () => {
        if (sourceSegments.length === 0) return;
        try {
            setTaskStatus("starting");
            setProgress(0);
            const res = await translatorService.startTranslation({
                segments: sourceSegments,
                target_language: targetLang,
                mode: mode
            });
            setTaskId(res.task_id);
            setTaskStatus("running");
        } catch (e) {
            console.error(e);
            alert("Failed to start translation");
        }
    };

    // Polling Logic
    useEffect(() => {
        if (!taskId || taskStatus === "completed" || taskStatus === "failed") return;

        const interval = setInterval(async () => {
            try {
                const statusRes = await translatorService.getTaskStatus(taskId);
                setTaskStatus(statusRes.status);
                setProgress(statusRes.progress || 0);

                if (statusRes.status === "completed" && statusRes.result?.segments) {
                    setTargetSegments(statusRes.result.segments);
                    setTaskId(null); // Stop polling
                } else if (statusRes.status === "failed") {
                    setTaskId(null);
                    alert(`Translation failed: ${statusRes.error}`);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [taskId, taskStatus]);

    // Export Logic
    const handleExport = () => {
        if (targetSegments.length === 0) return;
        // Generate SRT
        const srtContent = targetSegments.map(s => {
             const fmt = (t: number) => new Date(t * 1000).toISOString().substr(11, 12).replace('.', ',');
             return `${s.id}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`;
        }).join('\n');
        
        // Save using Electron
        if (window.electronAPI) {
            // Need save dialog logic, or just download api
            // For now simple console log or alert as placeholder if no native save
            console.log(srtContent);
            alert("Export functionality not fully wired to file system yet. Check console for SRT.");
        }
    };

    // Safety: Warn before closing if there is data
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (targetSegments.length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [targetSegments]); // Re-bind is fine here as data changes less often than Editor

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden relative">
             {/* Header - Added pr-40 for Window Controls */}
             <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between pl-4 pr-40 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
                 <div className="flex items-center gap-3 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                     <div className="p-2 bg-indigo-600/20 rounded-lg">
                        <Globe className="w-5 h-5 text-indigo-400" />
                     </div>
                     <div>
                        <h1 className="font-bold text-lg">AI Translator</h1>
                        <p className="text-xs text-slate-400">Context-Aware • Glossary-Enforced</p>
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-4 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                     <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                         <select 
                            value={targetLang} 
                            onChange={e => setTargetLang(e.target.value)}
                            className="bg-transparent text-sm px-2 py-1 outline-none text-slate-200"
                         >
                             <option value="Chinese">Chinese (简体中文)</option>
                             <option value="English">English</option>
                             <option value="Japanese">Japanese</option>
                             <option value="Spanish">Spanish</option>
                             <option value="French">French</option>
                         </select>
                         <div className="w-[1px] h-4 bg-slate-700"></div>
                         <select 
                            value={mode} 
                            onChange={e => setMode(e.target.value as any)}
                            className="bg-transparent text-sm px-2 py-1 outline-none text-slate-200"
                         >
                             <option value="standard">Standard (1-to-1)</option>
                             <option value="intelligent">Intelligent (Smart Split)</option>
                         </select>
                     </div>

                     <button 
                        onClick={() => setShowGlossary(!showGlossary)}
                        className={`p-2 rounded-lg transition-colors ${showGlossary ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                        title="Glossary Manager"
                     >
                         <Book size={18} />
                     </button>
                     
                     <div className="h-6 w-[1px] bg-slate-700"></div>

                     <button 
                         onClick={handleOpenFile}
                         className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-slate-700 hover:border-slate-600"
                     >
                         <FolderOpen size={16} /> Import
                     </button>
                     
                     <button 
                         onClick={handleTranslate}
                         disabled={!!taskId || sourceSegments.length === 0}
                         className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:opacity-50 rounded text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
                     >
                         {taskId ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                         Translate
                     </button>
                     
                     {targetSegments.length > 0 && (
                         <button 
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
                         >
                             <Download size={16} /> Export
                         </button>
                     )}
                 </div>
             </header>
             
             {/* Progress Bar */}
             {progress > 0 && progress < 100 && (
                 <div className="h-1 bg-slate-900 w-full relative overflow-hidden">
                     <div className="absolute top-0 left-0 h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                 </div>
             )}

             {/* Main Content */}
             <div className="flex-1 flex min-h-0 relative">
                 {/* Left: Source */}
                 <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900/50">
                     <div className="p-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800 flex justify-between">
                        <span>Source ({sourceSegments.length})</span>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
                         {sourceSegments.map(seg => (
                             <div key={seg.id} className="group p-3 rounded-lg hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700">
                                 <div className="flex justify-between text-xs text-slate-500 font-mono mb-1">
                                     <span>#{seg.id}</span>
                                     <span>{seg.start.toFixed(2)} - {seg.end.toFixed(2)}</span>
                                 </div>
                                 <div className="text-sm text-slate-300 leading-relaxed">
                                     {seg.text}
                                 </div>
                             </div>
                         ))}
                         {sourceSegments.length === 0 && (
                             <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                 <FolderOpen size={48} className="mb-4 opacity-20" />
                                 <p>Import subtitles to start</p>
                             </div>
                         )}
                     </div>
                 </div>

                 {/* Right: Target */}
                 <div className="flex-1 flex flex-col bg-slate-950">
                     <div className="p-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800 flex justify-between">
                         <span>Target ({targetSegments.length})</span>
                         {mode === 'intelligent' && <span className="text-indigo-400 text-[10px] border border-indigo-900/50 px-1 rounded">Smart Mode</span>}
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
                         {targetSegments.map(seg => (
                             <div key={seg.id} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 transition-colors">
                                 <div className="flex justify-between text-xs text-slate-500 font-mono mb-1 gap-2">
                                     <span>#{seg.id}</span>
                                     <span className="flex-1 h-[1px] bg-slate-800 my-auto mx-2"></span>
                                     {/* Editable Time? Maybe later */}
                                     {/* <span>{seg.start.toFixed(2)} - {seg.end.toFixed(2)}</span> */}
                                 </div>
                                 <textarea 
                                     className="w-full bg-transparent text-sm text-indigo-100 placeholder-slate-600 focus:outline-none resize-none leading-relaxed"
                                     value={seg.text}
                                     onChange={(e) => {
                                         const newSegments = [...targetSegments];
                                         const idx = newSegments.findIndex(s => s.id === seg.id);
                                         if(idx !== -1) {
                                             newSegments[idx].text = e.target.value;
                                             setTargetSegments(newSegments);
                                         }
                                     }}
                                     rows={Math.max(2, Math.ceil(seg.text.length / 50))} // Auto-grow rough
                                 />
                             </div>
                         ))}
                         {targetSegments.length === 0 && (
                             <div className="flex flex-col items-center justify-center h-full text-slate-600">
                                 <Wand2 size={48} className="mb-4 opacity-20" />
                                 <p>{taskId ? 'Translating...' : 'Ready to translate'}</p>
                             </div>
                         )}
                     </div>
                 </div>
                 
                 {/* Glossary Sidebar (Overlay) */}
                 {showGlossary && (
                     <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-20 animate-in slide-in-from-right duration-200">
                         <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                             <h2 className="font-bold flex items-center gap-2">
                                 <Book size={16} className="text-indigo-500"/> Glossary
                             </h2>
                             <button onClick={() => setShowGlossary(false)} className="text-slate-500 hover:text-slate-300">
                                 <Settings2 size={16} />
                             </button>
                         </div>
                         
                         <div className="p-4 bg-slate-800/50 border-b border-slate-800 space-y-2">
                             <div className="flex gap-2">
                                 <input 
                                     className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" 
                                     placeholder="Source (e.g. Mediaflow)"
                                     value={newTermSource}
                                     onChange={e => setNewTermSource(e.target.value)}
                                 />
                                 <input 
                                     className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" 
                                     placeholder="Target (e.g. 媒体流)"
                                     value={newTermTarget}
                                     onChange={e => setNewTermTarget(e.target.value)}
                                 />
                             </div>
                             <button 
                                 onClick={handleAddTerm}
                                 className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 py-1 rounded text-xs font-bold transition-colors"
                             >
                                 <Plus size={12} /> Add Term
                             </button>
                         </div>
                         
                         <div className="flex-1 overflow-y-auto p-2">
                             {glossary.length === 0 ? (
                                 <p className="text-center text-slate-600 text-xs mt-10">No terms yet.</p>
                             ) : (
                                 <div className="space-y-2">
                                     {glossary.map(term => (
                                         <div key={term.id} className="group flex justify-between items-start bg-slate-800 p-2 rounded border border-transparent hover:border-slate-700">
                                             <div>
                                                 <div className="text-xs font-bold text-indigo-300">{term.source}</div>
                                                 <div className="text-xs text-slate-300">➜ {term.target}</div>
                                             </div>
                                             <button 
                                                 onClick={() => handleDeleteTerm(term.id)}
                                                 className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                             >
                                                 <Trash2 size={12} />
                                             </button>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     </div>
                 )}
             </div>
        </div>
    );
};
