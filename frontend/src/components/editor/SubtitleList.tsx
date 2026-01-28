import React, { useEffect, useRef } from 'react';
import type { SubtitleSegment } from '../../types/task';
import { Trash2 } from 'lucide-react';

interface SubtitleListProps {
    segments: SubtitleSegment[];
    activeSegmentId: string | null;
    onSegmentClick: (id: string) => void;
    onSegmentUpdate: (id: string, text: string) => void;
    onSegmentDelete: (id: string) => void;
    onSegmentMerge: (ids: string[]) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({
    segments,
    activeSegmentId,
    onSegmentClick,
    onSegmentUpdate,
    onSegmentDelete,
    onSegmentMerge
}) => {
    const activeRef = useRef<HTMLTableRowElement>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    
    // Auto-scroll to active segment
    useEffect(() => {
        if (activeRef.current && !editingId) {
            activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeSegmentId, editingId]);

    const handleTextBlur = (id: string, newText: string) => {
        setEditingId(null);
        onSegmentUpdate(id, newText);
    };

    const handleKeyDown = (e: React.KeyboardEvent, id: string, newText: string) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTextBlur(id, newText);
        }
    };

    const toggleSelection = (id: string, multi: boolean) => {
        if (multi) {
            setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else {
             onSegmentClick(id);
        }
    };
    
    const handleMerge = () => {
        if (selectedIds.length < 2) return;
        onSegmentMerge(selectedIds);
        setSelectedIds([]);
    };

    return (
        <div className="flex flex-col h-full bg-slate-800 border-r border-slate-700">
             {/* Toolbar */}
             <div className="p-2 border-b border-slate-700 flex gap-2 bg-slate-800">
                <button 
                  disabled={selectedIds.length < 2}
                  onClick={handleMerge}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-xs rounded text-white transition-colors"
                >
                    Merge Selected ({selectedIds.length})
                </button>
             </div>

             {/* Table */}
             <div className="flex-1 overflow-y-auto">
                 <table className="w-full text-left border-collapse table-fixed">
                    <thead className="bg-slate-900 sticky top-0 z-10 text-xs uppercase text-slate-400 font-medium shadow-sm">
                        <tr>
                            <th className="px-2 py-2 w-10 text-center border-b border-slate-700">#</th>
                            <th className="px-2 py-2 border-b border-slate-700">Subtitle Text</th>
                            <th className="px-2 py-2 w-8 border-b border-slate-700"></th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-800">
                        {segments.map((seg, idx) => {
                            const isActive = activeSegmentId === String(seg.id);
                            const isSelected = selectedIds.includes(String(seg.id));
                            const isEditing = editingId === String(seg.id);
                            
                            return (
                                <tr 
                                    key={seg.id}
                                    ref={isActive ? activeRef : null}
                                    onClick={(e) => toggleSelection(String(seg.id), e.ctrlKey || e.metaKey)}
                                    className={`
                                        group transition-colors cursor-pointer border-l-2
                                        ${isActive ? 'bg-indigo-900/40 border-indigo-500' : 'border-transparent hover:bg-slate-800/50'}
                                        ${isSelected ? 'bg-indigo-900/60' : ''}
                                    `}
                                >
                                    <td className="px-1 py-1 text-center text-slate-500 font-mono text-xs select-none">
                                        {idx + 1}
                                    </td>
                                    <td className="px-2 py-1.5" onDoubleClick={() => setEditingId(String(seg.id))}>
                                        {isEditing ? (
                                            <textarea
                                                autoFocus
                                                className="w-full bg-slate-950 border border-indigo-500 rounded p-1.5 text-slate-100 outline-none resize-none text-sm leading-snug"
                                                defaultValue={seg.text}
                                                rows={2}
                                                onBlur={(e) => handleTextBlur(String(seg.id), e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e, String(seg.id), e.currentTarget.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="flex flex-col gap-0.5">
                                                <div className={`break-words leading-snug font-medium ${!seg.text ? 'text-slate-600 italic' : 'text-slate-200'}`}>
                                                    {seg.text || "Empty segment"}
                                                </div>
                                                <div className="text-[10px] text-slate-600 font-mono">
                                                    {new Date(seg.start * 1000).toISOString().substr(14, 5)} - {new Date(seg.end * 1000).toISOString().substr(14, 5)}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-1 py-1 text-right">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onSegmentDelete(String(seg.id)); }}
                                            className="p-1 hover:bg-red-500/20 rounded text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                 </table>
             </div>
        </div>
    );
};
