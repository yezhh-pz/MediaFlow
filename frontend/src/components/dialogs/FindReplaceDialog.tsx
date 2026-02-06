
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowUp, ArrowDown, X, ChevronDown, ChevronRight, Replace, ReplaceAll } from 'lucide-react';
import type { SubtitleSegment } from '../../types/task';

interface FindReplaceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    regions: SubtitleSegment[];
    onSelectSegment: (id: string) => void;
    onUpdateSegment: (id: string, text: string) => void;
}

interface Match {
    id: string; // Region ID
    start: number; // Text index start
    end: number;
}

export const FindReplaceDialog: React.FC<FindReplaceDialogProps> = ({
    isOpen,
    onClose,
    regions,
    onSelectSegment,
    onUpdateSegment
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [replaceTerm, setReplaceTerm] = useState("");
    const [matchCase, setMatchCase] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    
    // Auto-search logic
    useEffect(() => {
        if (!searchTerm) {
            setMatches([]);
            setCurrentIndex(-1);
            return;
        }

        const newMatches: Match[] = [];
        regions.forEach(r => {
            if (!r.text) return;
            const text = matchCase ? r.text : r.text.toLowerCase();
            const term = matchCase ? searchTerm : searchTerm.toLowerCase();
            
            let pos = text.indexOf(term);
            while (pos !== -1) {
                newMatches.push({
                   id: String(r.id),
                   start: pos,
                   end: pos + term.length
                });
                pos = text.indexOf(term, pos + 1);
            }
        });

        setMatches(newMatches);
        if (newMatches.length > 0) {
             setCurrentIndex(0); // Optionally preserve index if possible, but keep simple
             onSelectSegment(newMatches[0].id);
        } else {
             setCurrentIndex(-1);
        }
    }, [searchTerm, matchCase, regions]); // Re-run when regions change (edit happens)

    const handleNext = () => {
        if (matches.length === 0) return;
        const next = (currentIndex + 1) % matches.length;
        setCurrentIndex(next);
        onSelectSegment(matches[next].id);
    };

    const handlePrev = () => {
        if (matches.length === 0) return;
        const prev = (currentIndex - 1 + matches.length) % matches.length;
        setCurrentIndex(prev);
        onSelectSegment(matches[prev].id);
    };

    const handleReplace = () => {
        if (currentIndex === -1 || matches.length === 0) return;
        
        const currentMatch = matches[currentIndex];
        const region = regions.find(r => String(r.id) === currentMatch.id);
        if (!region || !region.text) return;

        // Naive logic: Re-fetch region text just in case? 
        // We rely on 'regions' prop being up to date.
        
        // ISSUE: If multiple matches in same segment, indices shift after replacement.
        // Solution: Only replace ONE, then let useEffect re-calc matches.
        
        // Exact reconstruction
        // Note: 'currentMatch.start' is valid for the text used in the search effect.
        // If user typed elsewhere meanwhile, it might be stale.
        // Ideally we grab the text, verify match is still there.
        
        const text = region.text;
        const prefix = text.substring(0, currentMatch.start);
        const suffix = text.substring(currentMatch.end);
        const newText = prefix + replaceTerm + suffix;
        
        onUpdateSegment(currentMatch.id, newText);
        // Note: This triggers useEffect -> re-search -> matches updated
    };

    const handleReplaceAll = () => {
        if (!searchTerm) return;
        
        // Group matches by region to minimize updates
        const dirtyRegions = new Set<string>();
        matches.forEach(m => dirtyRegions.add(m.id));
        
        dirtyRegions.forEach(id => {
             const region = regions.find(r => String(r.id) === id);
             if (region && region.text) {
                 const flag = matchCase ? 'g' : 'gi';
                 // Escape regex special chars
                 const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                 const regex = new RegExp(escapedTerm, flag);
                 const newText = region.text.replace(regex, replaceTerm);
                 if (newText !== region.text) {
                     onUpdateSegment(id, newText);
                 }
             }
        });
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-16 right-8 w-80 bg-slate-800 border border-slate-700 shadow-xl rounded-lg z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
             {/* Header */}
             <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-700 handle cursor-move">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Find & Replace</span>
                  <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded">
                      <X size={14} />
                  </button>
             </div>
             
             {/* Body */}
             <div className="p-3 flex flex-col gap-3">
                 {/* Search Input */}
                 <div className="relative">
                     <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                     <input 
                        autoFocus
                        type="text" 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Find..."
                        className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-16 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                if (e.shiftKey) handlePrev();
                                else handleNext();
                            }
                        }}
                     />
                     <div className="absolute right-1 top-1 flex">
                          <span className="text-xs text-slate-500 py-1.5 px-2 font-mono">
                             {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '0/0'}
                          </span>
                     </div>
                 </div>
                 
                 {/* Replace Input */}
                 <div className="relative flex gap-2">
                     <div className="relative flex-1">
                        <Replace size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                        <input 
                            type="text" 
                            value={replaceTerm}
                            onChange={e => setReplaceTerm(e.target.value)}
                            placeholder="Replace with..."
                            className="w-full bg-slate-900 border border-slate-700 rounded pl-8 py-1.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                     </div>
                 </div>

                 {/* Options */}
                 <div className="flex items-center gap-2">
                     <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                         <input 
                            type="checkbox" 
                            checked={matchCase}
                            onChange={e => setMatchCase(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-offset-0 focus:ring-1"
                         />
                         Match Case
                     </label>
                 </div>

                 {/* Actions */}
                 <div className="flex gap-2 justify-between mt-1">
                      <div className="flex gap-1">
                          <button onClick={handlePrev} disabled={matches.length === 0} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" title="Previous (Shift+Enter)">
                              <ArrowUp size={14} />
                          </button>
                          <button onClick={handleNext} disabled={matches.length === 0} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-50" title="Next (Enter)">
                              <ArrowDown size={14} />
                          </button>
                      </div>
                      
                      <div className="flex gap-2">
                          <button onClick={handleReplace} disabled={matches.length === 0} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white disabled:opacity-50">
                              Replace
                          </button>
                          <button onClick={handleReplaceAll} disabled={matches.length === 0} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-xs text-white disabled:opacity-50">
                              All
                          </button>
                      </div>
                 </div>
             </div>
        </div>
    );
};
