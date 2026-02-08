
import { useState, useEffect, useRef } from 'react';
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
    
    // Skip first persist to avoid overwriting navigation data
    const isFirstRender = useRef(true);
    
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
    
    // File Path State
    const [sourceFilePath, setSourceFilePath] = useState<string | null>(null);

    // Helper to load source segments from localStorage
    const loadSourceFromStorage = () => {
        const savedSource = localStorage.getItem("translator_sourceSegments");
        const savedTarget = localStorage.getItem("translator_targetSegments");
        const savedPath = localStorage.getItem("translator_sourceFilePath");
        
        if (savedSource) {
            try { 
                const parsed = JSON.parse(savedSource);
                setSourceSegments(parsed); 
                console.log('[Translator] Loaded segments from storage:', parsed.length);
            } catch (e) { console.error(e); }
        }
        if (savedTarget) {
            try { setTargetSegments(JSON.parse(savedTarget)); } catch (e) { console.error(e); }
        }
        if (savedPath) {
            setSourceFilePath(savedPath);
        }
    };

    const refreshGlossary = async () => {
        try {
            const terms = await translatorService.listTerms();
            setGlossary(terms);
        } catch (e) {
            console.error("Failed to load glossary");
        }
    };

    // Language Suffix Mapping
    const LANG_SUFFIX_MAP: Record<string, string> = {
        "Chinese": "_CN",
        "English": "_EN",
        "Japanese": "_JP",
        "Spanish": "_ES",
        "French": "_FR",
        "German": "_DE",
        "Russian": "_RU"
    };

    const getSuffixForLang = (lang: string) => LANG_SUFFIX_MAP[lang] || "_CN";

    // Helper to try loading an existing translation file (e.g., _CN.srt)
    // Priority: _CN > _EN > Others
    const tryLoadExistingTarget = async (sourcePath: string) => {
        if (!window.electronAPI) return null;
        
        // Priority list: CN first, then others
        const priorities = ["_CN", "_EN", "_JP", "_ES", "_FR", "_DE", "_RU"];
        
        for (const suffix of priorities) {
             const targetPath = sourcePath.replace(/(\.[^.]+)$/, `${suffix}.srt`);
             try {
                const content = await window.electronAPI.readFile(targetPath);
                if (content) {
                    console.log(`[Translator] Found existing translation (${suffix}):`, targetPath);
                    // attempt to set language based on suffix found?
                    // Optional: Reverse lookup lang from suffix to auto-set dropdown
                    const foundLang = Object.keys(LANG_SUFFIX_MAP).find(key => LANG_SUFFIX_MAP[key] === suffix);
                    if (foundLang) {
                        setTargetLang(foundLang);
                    }
                    return parseSRT(content);
                }
             } catch (e) { /* Ignore */ }
        }
        return null;
    };

    // Check for pending file from TaskMonitor navigation
    const checkPendingNavigation = () => {
        const pendingFile = sessionStorage.getItem('mediaflow:pending_file');
        if (pendingFile) {
            try {
                const data = JSON.parse(pendingFile);
                
                // Ignore if this pending file is meant for Editor
                if (data.target === 'editor') {
                    console.log('[Translator] Skipping pending file intended for Editor');
                    return;
                }

                console.log('[Translator] Found pending navigation file:', data);
                
                if (data.subtitle_path) {
                    // Force update state and storage immediately
                    setSourceFilePath(data.subtitle_path);
                    localStorage.setItem("translator_sourceFilePath", data.subtitle_path);
                    
                    if (window.electronAPI) {
                        window.electronAPI.readFile(data.subtitle_path).then(async (content: string | null) => {
                            if (content) {
                                const parsed = parseSRT(content);
                                setSourceSegments(parsed);
                                
                                // Auto-load existing target if available
                                const existingTarget = await tryLoadExistingTarget(data.subtitle_path);
                                setTargetSegments(existingTarget || []);
                                
                                console.log('[Translator] Auto-loaded subtitle from navigation:', data.subtitle_path);
                            }
                        }).catch((e: any) => console.error('[Translator] Failed to read subtitle:', e));
                    }
                }
                sessionStorage.removeItem('mediaflow:pending_file');
            } catch (e) {
                console.error('[Translator] Failed to parse pending file:', e);
            }
        }
    };

    // Initial Load & Persistence
    useEffect(() => {
        refreshGlossary();
        loadSourceFromStorage();
        checkPendingNavigation();

        // Listen for navigation events to reload data
        const handleNavigate = (e: CustomEvent) => {
            if (e.detail === 'translator') {
                console.log('[Translator] Navigation event received. Checking for pending files...');
                // Small delay to ensure data is written before reading
                setTimeout(() => {
                    checkPendingNavigation();
                    loadSourceFromStorage();
                }, 50);
            }
        };
        window.addEventListener('mediaflow:navigate', handleNavigate as EventListener);
        return () => window.removeEventListener('mediaflow:navigate', handleNavigate as EventListener);
    }, []);

    const handleAddTerm = async () => {
        if (!newTermSource || !newTermTarget) return;
        await translatorService.addTerm({ source: newTermSource, target: newTermTarget });
        setNewTermSource("");
        setNewTermTarget("");
        refreshGlossary();
    };
    
    // Persist changes - ONLY after first render to avoid overwriting navigation data
    useEffect(() => {
        if (isFirstRender.current) {
            return; // Skip first render
        }
        console.log('[Translator] Persisting sourceSegments:', sourceSegments.length);
        localStorage.setItem("translator_sourceSegments", JSON.stringify(sourceSegments));
    }, [sourceSegments]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false; // Mark as initialized after first render cycle
            return;
        }
        localStorage.setItem("translator_targetSegments", JSON.stringify(targetSegments));
    }, [targetSegments]);
    
    useEffect(() => {
        if (sourceFilePath) {
            localStorage.setItem("translator_sourceFilePath", sourceFilePath);
        }
    }, [sourceFilePath]);

    
    const handleDeleteTerm = async (id: string) => {
        await translatorService.deleteTerm(id);
        refreshGlossary();
    };

    const handleOpenFile = async () => {
         if (window.electronAPI) {
            // Use dedicated subtitle file dialog
            const openFn = (window.electronAPI as any).openSubtitleFile || window.electronAPI.openFile;
            const fileData = await openFn() as any;
            console.log('[Translator] File dialog result:', fileData);
            if (fileData && fileData.path) {
                console.log('[Translator] Setting sourceFilePath:', fileData.path);
                // alert(`Debug: Imported ${fileData.path}`); // Temporary Debug
                setSourceFilePath(fileData.path);
                const content = await window.electronAPI.readFile(fileData.path);
                console.log('[Translator] Read file content length:', content?.length || 0);
                if (content) {
                    const parsed = parseSRT(content);
                    console.log('[Translator] Parsed segments:', parsed.length);
                    setSourceSegments(parsed);
                    
                    // Auto-load existing target if available
                    const existingTarget = await tryLoadExistingTarget(fileData.path);
                    setTargetSegments(existingTarget || []);
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
    
    // Helper to generate SRT content
    const generateSRT = (segments: SubtitleSegment[]) => {
        return segments.map(s => {
             const fmt = (t: number) => new Date(t * 1000).toISOString().substr(11, 12).replace('.', ',');
             return `${s.id}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`;
        }).join('\n');
    };

    // --- Editor Integration ---

    const findRelatedVideo = async (subtitlePath: string): Promise<string | null> => {
        if (!window.electronAPI) return null;
        
        // Strip existing extension (including compound like _CN.srt)
        const basePath = subtitlePath.replace(/(_[A-Z]{2})?\.srt$/i, '');
        
        // Placeholder for "Smart" detection without FS access
        // We assume the video has the same basename and is likely mp4.
        return basePath + '.mp4';
    };

    const handleOpenInEditor = async () => {
        if (!sourceFilePath || targetSegments.length === 0) return;
        
        // 1. Auto-save current translation
        const suffix = getSuffixForLang(targetLang);
        const targetPath = sourceFilePath.replace(/(\.[^.]+)$/, `${suffix}.srt`);
        
        if (window.electronAPI) {
            try {
                const srtContent = generateSRT(targetSegments);
                await window.electronAPI.writeFile(targetPath, srtContent);
                console.log('[Translator] Auto-saved before Editor switch:', targetPath);
            } catch (e) {
                console.error("Failed to save before editor open", e);
                alert("Could not save translation. Editor might see stale data.");
            }
        }

        // 2. Find video path using the helper
        let videoPath = await findRelatedVideo(sourceFilePath);
        
        // Fallback if not found: try strictly changing extension to mp4 as last resort
        if (!videoPath) {
             videoPath = sourceFilePath.replace(/(_[A-Z]{2})?\.srt$/i, '.mp4');
             console.log('[Translator] Video not detected, guessing:', videoPath);
             // Verify if we can just pass it? Yes, let Editor handle missing file graceously.
        }

        // 3. Navigation
        // We pass the VIDEO path as the primary 'video_path' 
        // AND the specific subtitle path we just saved.
        sessionStorage.setItem('mediaflow:pending_file', JSON.stringify({
            target: 'editor', // Explicitly mark for Editor
            video_path: videoPath, 
            subtitle_path: targetPath
        }));
        
        window.dispatchEvent(new CustomEvent('mediaflow:navigate', { detail: 'editor' }));
    };

    // Polling Logic & Auto-Save
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
                    
                    // Auto-Save logic
                    if (sourceFilePath && window.electronAPI) {
                        const suffix = getSuffixForLang(targetLang);
                        const autoSavePath = sourceFilePath.replace(/(\.[^.]+)$/, `${suffix}.srt`);
                        const srtContent = generateSRT(statusRes.result.segments);
                        try {
                            await window.electronAPI.writeFile(autoSavePath, srtContent);
                            console.log('[Translator] Auto-saved to:', autoSavePath);
                            alert(`Auto-saved translation to:\n${autoSavePath}`);
                        } catch (saveErr) {
                            console.error('[Translator] Auto-save failed:', saveErr);
                            alert(`Auto-save failed: ${saveErr}`);
                        }
                    }
                } else if (statusRes.status === "failed") {
                    setTaskId(null);
                    alert(`Translation failed: ${statusRes.error}`);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [taskId, taskStatus, sourceFilePath, targetLang]);

    // Export Logic
    const handleExport = async () => {
        console.log('[Translator] handleExport called. sourceFilePath:', sourceFilePath);
        if (targetSegments.length === 0) return;
        
        if (window.electronAPI && window.electronAPI.showSaveDialog) {
            const suffix = getSuffixForLang(targetLang);
            const defaultName = sourceFilePath 
                ? sourceFilePath.replace(/(\.[^.]+)$/, `${suffix}.srt`) 
                : 'translation.srt';
                
            const savePath = await window.electronAPI.showSaveDialog({
                defaultPath: defaultName,
                filters: [
                    { name: "SubRip Subtitle", extensions: ["srt"] },
                    { name: "Text File", extensions: ["txt"] }
                ]
            });

            if (savePath) {
                let content = "";
                if (savePath.toLowerCase().endsWith(".txt")) {
                    // Export as Pure Text
                    content = targetSegments.map(s => s.text).join("\n");
                } else {
                    // Export as SRT
                    content = generateSRT(targetSegments);
                }
                
                await window.electronAPI.writeFile(savePath, content);
            }
        } else {
            // Fallback for non-electron (dev mode browser)
            console.log(generateSRT(targetSegments));
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
             {/* DEBUG OVERLAY - REMOVE AFTER FIX */}

             {/* Header - Added pr-40 for Window Controls */}
             <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between pl-4 pr-40 shrink-0 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
                 <div className="flex items-center gap-3 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                     <div className="p-2 bg-indigo-600/20 rounded-lg">
                        <Globe className="w-5 h-5 text-indigo-400" />
                     </div>
                     <div>
                        <h1 className="font-bold text-lg">AI Translator</h1>
                        <p className="text-xs text-slate-400">
                            {sourceFilePath ? (
                                <span title={sourceFilePath} className="text-indigo-300">
                                    {sourceFilePath.split(/[/\\]/).pop()}
                                </span>
                            ) : (
                                "Context-Aware • Glossary-Enforced"
                            )}
                        </p>
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-2 no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                     <button 
                        onClick={() => setShowGlossary(!showGlossary)}
                        className={`p-2 rounded-lg transition-colors ${showGlossary ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                        title="Glossary Manager"
                     >
                         <Book size={18} />
                     </button>
                     
                     <div className="h-6 w-[1px] bg-slate-700 mx-2"></div>

                     <button 
                         onClick={handleOpenFile}
                         className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors border border-slate-700 hover:border-slate-600"
                     >
                         <FolderOpen size={16} /> <span className="hidden xl:inline">Import</span>
                     </button>
                     
                     <button 
                         onClick={handleTranslate}
                         disabled={!!taskId || sourceSegments.length === 0}
                         className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:opacity-50 rounded text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20"
                     >
                         {taskId ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                         <span className="hidden lg:inline">Translate</span>
                     </button>
                     
                     {targetSegments.length > 0 && (
                         <>
                            <button 
                                onClick={handleExport}
                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium transition-colors"
                            >
                                <Download size={16} /> <span className="hidden xl:inline">Export</span>
                            </button>
                            <button 
                                onClick={handleOpenInEditor}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors border border-slate-600"
                                title="Open in Editor with Video"
                            >
                                <Settings2 size={16} /> Editor
                            </button>
                         </>
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
             {/* Main Content - Unified Scroll */}
             <div className="flex-1 overflow-y-auto min-h-0 relative scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
                 {/* Table Header */}
                 <div className="sticky top-0 z-10 flex border-b border-slate-800 bg-slate-900 text-xs font-bold text-slate-500 uppercase tracking-wider shadow-sm">
                     <div className="flex-1 p-2 border-r border-slate-800 flex justify-between items-center">
                        <span>Source ({sourceSegments.length})</span>
                     </div>
                     <div className="flex-1 p-2 flex justify-between items-center bg-slate-950 gap-4">
                        <div className="flex items-center gap-2">
                             <span>Target ({targetSegments.length})</span>
                             {mode === 'intelligent' && <span className="text-indigo-400 text-[10px] border border-indigo-900/50 px-1 rounded">Smart Mode</span>}
                        </div>
                        
                        {/* Settings Moved Here */}
                        <div className="flex items-center gap-2">
                             <select 
                                value={targetLang} 
                                onChange={e => setTargetLang(e.target.value)}
                                className="bg-slate-900 border border-slate-800 text-xs px-2 py-0.5 rounded outline-none text-slate-400 hover:text-slate-200 focus:border-indigo-500 transition-colors"
                             >
                                 <option value="Chinese">Chinese (中文)</option>
                                 <option value="English">English</option>
                                 <option value="Japanese">Japanese</option>
                                 <option value="Spanish">Spanish</option>
                                 <option value="French">French</option>
                             </select>
                             <select 
                                value={mode} 
                                onChange={e => setMode(e.target.value as any)}
                                className="bg-slate-900 border border-slate-800 text-xs px-2 py-0.5 rounded outline-none text-slate-400 hover:text-slate-200 focus:border-indigo-500 transition-colors"
                             >
                                 <option value="standard">Standard</option>
                                 <option value="intelligent">Smart Split</option>
                             </select>
                        </div>
                     </div>
                 </div>

                 {/* Unified List */}
                 <div className="bg-slate-900/30">
                     {sourceSegments.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                             <FolderOpen size={48} className="mb-4 opacity-20" />
                             <p>Import subtitles to start</p>
                         </div>
                     ) : (
                         sourceSegments.map((srcSeg) => {
                             // Find matching target segment. 
                             // Optimized for standard mode (ID match) or fallback to index if IDs might drift (though ID match is safer for consistency)
                             const tgtSeg = targetSegments.find(t => t.id === srcSeg.id);
                             
                             return (
                                 <div key={srcSeg.id} className="flex border-b border-slate-800 hover:bg-slate-800/50 transition-colors group">
                                     {/* Source Column */}
                                     <div className="flex-1 p-1 border-r border-slate-800 min-w-0">
                                         <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-0.5 select-none">
                                             <span className="opacity-50">#{srcSeg.id}</span>
                                             <span className="bg-slate-800/50 px-1 rounded">{srcSeg.start.toFixed(2)} - {srcSeg.end.toFixed(2)}</span>
                                         </div>
                                         <div className="text-sm text-slate-300 leading-snug whitespace-pre-wrap break-words">
                                             {srcSeg.text}
                                         </div>
                                     </div>

                                     {/* Target Column */}
                                     <div className="flex-1 p-1 min-w-0 bg-slate-950/30 relative">
                                        {tgtSeg ? (
                                            <>
                                                 <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                                                     <span className="opacity-50">#{tgtSeg.id}</span>
                                                 </div>
                                                 <textarea 
                                                     className="w-full bg-transparent text-sm text-indigo-100 placeholder-slate-700 focus:outline-none resize-none leading-snug whitespace-pre-wrap break-words overflow-hidden"
                                                     value={tgtSeg.text}
                                                     onChange={(e) => {
                                                         const newSegments = targetSegments.map(s => 
                                                             s.id === tgtSeg.id ? { ...s, text: e.target.value } : s
                                                         );
                                                         setTargetSegments(newSegments);
                                                     }}
                                                     rows={1}
                                                     style={{ minHeight: '1.2em', height: 'auto', fieldSizing: 'content' } as any}
                                                     spellCheck={false}
                                                 />
                                            </>
                                        ) : (
                                            <div className="h-full flex items-center justify-center opacity-10">
                                                {/* Placeholder for missing target segment */}
                                                <span className="text-xs text-slate-600">...</span>
                                            </div>
                                        )}
                                     </div>
                                 </div>
                             );
                         })
                     )}
                 </div>
                 
                 {/* Empty State / Loading State Overlay for Target if translating */}
                 {taskId && targetSegments.length === 0 && (
                     <div className="fixed bottom-10 right-10 p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex items-center gap-3 z-50">
                         <Loader2 className="animate-spin text-indigo-500" size={20} />
                         <div>
                             <p className="text-sm font-bold text-slate-200">Translating...</p>
                             <p className="text-xs text-slate-400">{taskStatus}</p>
                         </div>
                     </div>
                 )}
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
    );
};
