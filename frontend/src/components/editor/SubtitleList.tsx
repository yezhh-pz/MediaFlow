import React, { useEffect, useRef } from 'react';
import type { SubtitleSegment } from '../../types/task';
import { Trash2, AlertCircle, Wand2 } from 'lucide-react';
import { validateSegment, fixOverlaps } from '../../utils/validation';

interface SubtitleListProps {
    segments: SubtitleSegment[];
    activeSegmentId: string | null;
    playingSegmentId: string | null;
    autoScroll: boolean;
    selectedIds: string[];
    onSegmentClick: (id: string, multi: boolean, shift?: boolean) => void;
    onSegmentDelete: (id: string) => void;
    onSegmentMerge: (ids: string[]) => void;
    onSegmentDoubleClick: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, id: string) => void;
    onAutoFix?: (newSegments: SubtitleSegment[]) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = (props) => {
    const {
        segments,
        activeSegmentId,
        playingSegmentId,
        autoScroll,
        selectedIds,
        onSegmentClick,
        onSegmentDelete,
        onSegmentMerge,
        onSegmentDoubleClick,
        onContextMenu,
        onAutoFix
    } = props;

    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Keep itemRefs clean
    useEffect(() => {
        itemRefs.current = {};
    }, [segments]);

    // Auto-scroll logic: Native scrollIntoView
    useEffect(() => {
        if (autoScroll && playingSegmentId) {
            const el = itemRefs.current[playingSegmentId];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [playingSegmentId, autoScroll]);
    
    // Scroll to active (manual selection)
    useEffect(() => {
        if (activeSegmentId && !playingSegmentId) {
            const el = itemRefs.current[activeSegmentId];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeSegmentId, playingSegmentId]);

    // Check continuity for merge
    const activeIndices = selectedIds.map(id => segments.findIndex(s => String(s.id) === id)).sort((a,b) => a-b);
    let isContinuous = selectedIds.length >= 2;
    for(let i=0; i < activeIndices.length - 1; i++) {
        if(activeIndices[i+1] !== activeIndices[i] + 1) isContinuous = false;
    }

    const handleMerge = () => {
        if (selectedIds.length < 2 || !isContinuous) return;
        onSegmentMerge(selectedIds);
    };

    // Check for global overlaps to enable Auto-fix button
    const hasOverlaps = React.useMemo(() => {
        for (let i = 1; i < segments.length; i++) {
             // Tolerance 0.05s
             if (segments[i].start < segments[i - 1].end - 0.05) return true;
        }
        return false;
    }, [segments]);

    const handleAutoFix = () => {
        if (!onAutoFix) return;
        const fixed = fixOverlaps(segments);
        onAutoFix(fixed);
    };

    return (
        <div className="flex flex-col h-full bg-slate-800 border-r border-slate-700">
             {/* Toolbar */}
             <div className="p-2 border-b border-slate-700 flex gap-2 bg-slate-800 shrink-0">
                <button 
                  disabled={selectedIds.length < 2 || !isContinuous}
                  title={!isContinuous && selectedIds.length >= 2 ? "Can only merge adjacent segments" : "Merge selected subtitles"}
                  onClick={handleMerge}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-xs rounded text-white transition-colors"
                >
                    Merge Selected ({selectedIds.length})
                </button>
                
                {onAutoFix && hasOverlaps && (
                    <button
                        onClick={handleAutoFix}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-xs rounded text-white transition-colors flex items-center gap-1"
                        title="Auto-fix overlapping subtitles"
                    >
                        <Wand2 size={12} /> Auto-fix Overlaps
                    </button>
                )}
             </div>

             {/* Header */}
             <div className="flex bg-slate-900 border-b border-slate-700 text-xs uppercase text-slate-400 font-medium shadow-sm shrink-0">
                  <div className="w-10 text-center py-2">#</div>
                  <div className="flex-1 py-2 px-2">Subtitle Text</div>
                  <div className="w-8 py-2"></div>
             </div>

            {/* Native List Container */}
            <div ref={containerRef} className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
                {segments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 text-sm">
                        <p>No subtitles</p>
                    </div>
                ) : (
                    segments.map((seg, index) => {
                        const idStr = String(seg.id);
                        const isActive = activeSegmentId === idStr;
                        const isPlaying = playingSegmentId === idStr;
                        const isSelected = selectedIds.includes(idStr);
                        
                        // Validation
                        const issues = validateSegment(seg);
                        
                        // Overlap Check (using previous segment if sorted)
                        // Note: segments are typically sorted by ID/Start.
                        // We check if current.start < previous.end
                        if (index > 0) {
                            const prev = segments[index - 1];
                            if (seg.start < prev.end - 0.05) { // 0.05s tolerance
                                issues.push({
                                    type: "error",
                                    message: `Overlap with #${prev.id} (${(prev.end - seg.start).toFixed(2)}s)`,
                                    code: "overlap"
                                });
                            }
                        }
                        const hasError = issues.some(i => i.type === 'error');
                        const hasWarning = issues.some(i => i.type === 'warning');
                        const issueColor = hasError ? 'text-red-400' : (hasWarning ? 'text-yellow-400' : '');
                        const validationTooltip = issues.map(i => `[${i.type.toUpperCase()}] ${i.message}`).join('\n');

                        return (
                            <div 
                                key={seg.id}
                                ref={(el) => { itemRefs.current[idStr] = el; }}
                                className={`
                                    group flex items-start border-b border-slate-800 transition-colors cursor-pointer border-l-4
                                    ${isPlaying ? 'border-l-green-400 bg-slate-700/60' : 
                                      isActive ? 'bg-indigo-900/40 border-l-indigo-500' : 'border-l-transparent hover:bg-slate-800/50'}
                                    ${isSelected && !isActive && !isPlaying ? 'bg-indigo-900/60' : ''}
                                `}
                                onClick={(e) => onSegmentClick(idStr, e.ctrlKey || e.metaKey, e.shiftKey)}
                                onDoubleClick={() => onSegmentDoubleClick(idStr)}
                                onContextMenu={(e) => onContextMenu(e, idStr)}
                            >
                                {/* Index */}
                                <div className={`w-10 text-center py-2 font-mono text-xs select-none flex flex-col items-center gap-1 shrink-0 ${isPlaying ? 'text-green-400 font-bold' : 'text-slate-500'}`}>
                                    {isPlaying ? "▶" : index + 1}
                                    {(hasError || hasWarning) && (
                                        <div title={validationTooltip} className={issueColor}>
                                            <AlertCircle size={10} />
                                        </div>
                                    )}
                                </div>
                                
                                {/* Text */}
                                <div className="flex-1 py-1 px-2 select-none min-w-0">
                                    <div className={`break-words leading-tight text-sm font-medium ${!seg.text ? 'text-slate-600 italic' : 'text-slate-200'} ${isPlaying ? 'text-white' : ''}`}>
                                        {seg.text || "Empty segment"}
                                    </div>
                                </div>
                                
                                {/* Actions */}
                                <div className="w-8 pr-1 py-1 flex justify-end shrink-0">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onSegmentDelete(idStr); }}
                                        className="p-1 hover:bg-red-500/20 rounded text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
