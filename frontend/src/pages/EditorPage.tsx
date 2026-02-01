import { useState, useRef, useEffect } from "react";
import { WaveformPlayer } from "../components/editor/WaveformPlayer";
import { SubtitleList } from "../components/editor/SubtitleList";
import type { SubtitleSegment } from "../types/task";
import { Clapperboard, Save, Scissors } from "lucide-react";
import { parseSRT } from "../utils/subtitleParser";

// Storage Keys
const STORAGE_KEY_LAST_MEDIA = "editor_last_media_path";
const STORAGE_KEY_LAST_SUBS = "editor_last_subtitles";

export function EditorPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [regions, setRegions] = useState<SubtitleSegment[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Restore last session on mount
  // Try to find and load related subtitle file
  const tryLoadRelatedSubtitle = async (videoPath: string) => {
    // Replace video extension with .srt
    const srtPath = videoPath.replace(/\.[^.]+$/, '.srt');
    try {
      // Use Electron IPC to read local file
      if (window.electronAPI?.readFile) {
        const content = await window.electronAPI.readFile(srtPath);
        if (content) {
          const parsed = parseSRT(content);
          if (parsed.length > 0) {
            setRegions(parsed);
            localStorage.setItem(STORAGE_KEY_LAST_SUBS, JSON.stringify(parsed));
            console.log(`[Editor] Auto-loaded ${parsed.length} subtitles from ${srtPath}`);
          }
        }
      }
    } catch (e) {
      console.log("[Editor] No matching subtitle file found, using empty list.");
    }
  };

  // Restore last session on mount
  useEffect(() => {
    const lastMedia = localStorage.getItem(STORAGE_KEY_LAST_MEDIA);
    const lastSubs = localStorage.getItem(STORAGE_KEY_LAST_SUBS);
    
    if (lastMedia) {
      // Normalize Windows path: replace backslashes with forward slashes
      const normalizedPath = lastMedia.replace(/\\/g, "/");
      const url = `file:///${normalizedPath}`;
      setMediaUrl(url);
      
      // If we have media but NO saved session (or explicitly cleared), try to load from disk
      if (!lastSubs) {
          tryLoadRelatedSubtitle(lastMedia);
      }
    }
    
    if (lastSubs) {
      try {
        setRegions(JSON.parse(lastSubs));
      } catch (e) {
        console.warn("Failed to parse saved subtitles", e);
      }
    }
  }, []);

  // Load file from Electron or Drag/Drop
  const handleOpenFile = async () => {
    if (window.electronAPI?.openFile) {
        const path = await window.electronAPI.openFile();
        if (path) {
             const normalizedPath = path.replace(/\\/g, "/");
             const url = `file:///${encodeURI(normalizedPath)}`;
             setMediaUrl(url);
             localStorage.setItem(STORAGE_KEY_LAST_MEDIA, path);
             // Try to find matching subtitle
             tryLoadRelatedSubtitle(path);
        }
    } else {
        // Fallback or Web Demo
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,audio/*';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                setMediaUrl(URL.createObjectURL(file));
                // Can't auto-discover subtitles in web mode
            }
        };
        input.click();
    }
  };

  const handleRegionUpdate = (id: string, start: number, end: number) => {
      setRegions(prev => prev.map(r => r.id === id ? { ...r, start, end } : r));
  };

  const handleRegionClick = (id: string) => {
      setActiveSegmentId(id);
  };

  const handleTextUpdate = (id: string, text: string) => {
      setRegions(prev => prev.map(r => r.id === id ? { ...r, text } : r));
  };

  const handleDelete = (id: string) => {
      if(confirm("Delete this subtitle?")) {
          setRegions(prev => prev.filter(r => r.id !== id));
      }
  };

  const handleMerge = (ids: string[]) => {
      const selected = regions.filter(r => ids.includes(String(r.id)));
      if (selected.length < 2) return;
      
      // Sort by start time
      selected.sort((a, b) => a.start - b.start);
      
      const first = selected[0];
      const last = selected[selected.length - 1];
      const mergedText = selected.map(s => s.text).join(" ");
      
      const newSegment = {
          ...first,
          end: last.end,
          text: mergedText
      };
      
      setRegions(prev => {
          // Remove all merged
          const filtered = prev.filter(r => !ids.includes(String(r.id)));
          return [...filtered, newSegment].sort((a, b) => a.start - b.start);
      });
  };

  const handleSplit = () => {
      if (!activeSegmentId || !videoRef.current) return;
      
      const time = videoRef.current.currentTime;
      const segment = regions.find(r => r.id === activeSegmentId);
      
      if (!segment) return;
      
      if (time <= segment.start || time >= segment.end) {
          alert("Split cursor must be inside the active segment.");
          return;
      }
      
      const part1 = { ...segment, end: time, id: segment.id + "_1" }; // temporary ID generation
      const part2 = { ...segment, start: time, id: segment.id + "_2", text: "..." };
      
      setRegions(prev => {
          const filtered = prev.filter(r => r.id !== activeSegmentId);
          return [...filtered, part1, part2].sort((a, b) => a.start - b.start);
      });
  };
  
  // Update active segment based on playback time
  const handleTimeUpdate = () => {
      if(videoRef.current) {
          const t = videoRef.current.currentTime;
          setCurrentTime(t);
          
          const current = regions.find(r => t >= r.start && t < r.end);
          if (current && current.id !== activeSegmentId) {
             // Optional: Auto-select? Might interfere with manual editing.
             // setActiveSegmentId(String(current.id));
          }
      }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-slate-700 flex items-center justify-between px-4 bg-slate-900">
            <div className="flex items-center gap-3">
                <Clapperboard className="text-indigo-500" />
                <h1 className="font-bold text-lg">Editor Workspace</h1>
                <div className="h-4 w-[1px] bg-slate-700 mx-2"></div>
                <button onClick={handleOpenFile} className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded transition-colors">
                    Open Media
                </button>
            </div>
            <div className="flex items-center gap-2">
                 <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded text-sm font-medium transition-colors">
                     <Save size={16} /> Save Project
                 </button>
            </div>
        </header>

        {/* Main Workspace: Top Split */}
        <div className="flex-1 flex min-h-0">
             {/* Left: Subtitle List */}
             <div className="w-1/3 min-w-[280px] max-w-[500px] border-r border-slate-700 flex flex-col">
                 <SubtitleList 
                    segments={regions}
                    activeSegmentId={activeSegmentId}
                    onSegmentClick={handleRegionClick}
                    onSegmentUpdate={handleTextUpdate}
                    onSegmentDelete={handleDelete}
                    onSegmentMerge={handleMerge}
                 />
             </div>
             
             {/* Right: Video Preview */}
             <div className="flex-1 bg-black flex flex-col relative justify-center items-center">
                 {mediaUrl ? (
                     <div className="w-full h-full relative p-4 flex flex-col">
                         <div className="flex-1 relative flex items-center justify-center bg-black/50 rounded-lg overflow-hidden border border-slate-800">
                             <video 
                                ref={videoRef}
                                src={mediaUrl}
                                className="max-w-full max-h-full shadow-2xl"
                                controls={false} // Custom controls via Waveform/Keys
                                onTimeUpdate={handleTimeUpdate}
                                onClick={() => {
                                    if(videoRef.current?.paused) videoRef.current.play();
                                    else videoRef.current?.pause();
                                }}
                             />
                             {/* Overlay Subtitles */}
                             <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
                                 <span className="bg-black/60 text-white px-2 py-1 rounded text-lg font-medium shadow-sm backdrop-blur-sm">
                                     {regions.find(r => currentTime >= r.start && currentTime < r.end)?.text || ""}
                                 </span>
                             </div>
                         </div>
                         
                         {/* Mini Controls */}
                         <div className="h-12 flex items-center justify-center gap-4 bg-slate-900 border-t border-slate-800 mt-2 rounded-lg">
                             <span className="font-mono text-cyan-400 text-sm">
                                 {new Date(currentTime * 1000).toISOString().substr(11, 8)}
                             </span>
                             <button
                               onClick={handleSplit}
                               disabled={!activeSegmentId}
                               className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded disabled:opacity-50"
                               title="Split at Current Time"
                             >
                                 <Scissors size={14} /> Split
                             </button>
                         </div>
                     </div>
                 ) : (
                     <div className="text-slate-600 flex flex-col items-center">
                         <Clapperboard size={48} className="mb-4 opacity-50" />
                         <p>No media loaded</p>
                     </div>
                 )}
             </div>
        </div>
        
        {/* Bottom: Waveform Timeline */}
        <div className="h-48 min-h-[150px] bg-slate-900 border-t border-slate-700 relative z-20">
             {mediaUrl && (
                 <WaveformPlayer 
                    mediaUrl={mediaUrl}
                    videoRef={videoRef}
                    regions={regions}
                    onRegionUpdate={handleRegionUpdate}
                    onRegionClick={handleRegionClick}
                 />
             )}
        </div>
    </div>
  );
}
