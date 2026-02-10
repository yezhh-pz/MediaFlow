import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.esm.js';
import type { SubtitleSegment } from '../../types/task';

// Note: We need to import styles for regions if they are not bundled
// usually wavesurfer regions has default styles or we inject them.

interface WaveformPlayerProps {
    mediaUrl: string;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    regions: SubtitleSegment[];
    onRegionUpdate: (id: string, start: number, end: number) => void;
    onRegionClick: (id: string, e: MouseEvent) => void;
    onContextMenu: (e: MouseEvent, id: string) => void;
    peaks?: any;
    onPeaksGenerated?: (peaks: any) => void;
    selectedIds?: string[];
    autoScroll?: boolean;
    onInteractStart?: () => void;
}

const WaveformPlayerComponent: React.FC<WaveformPlayerProps> = ({ 
    mediaUrl, 
    videoRef, 
    regions,
    onRegionUpdate,
    onRegionClick,
    onContextMenu,
    peaks,
    onPeaksGenerated,
    selectedIds = [],
    autoScroll = true,
    onInteractStart
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const wsRegions = useRef<RegionsPlugin | null>(null);
    const isDraggingRef = useRef(false);
    const [zoom, setZoom] = useState(80);  // 初始缩放 80，让色块宽度足够

    const [isReady, setIsReady] = useState(false);

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current || !videoRef.current) return;
        
        setIsReady(false); // Reset ready state on new media init

        const options: any = {
            container: containerRef.current,
            waveColor: '#4F46E5',
            progressColor: '#818cf8',
            cursorColor: '#38bdf8', // Cyan Playhead
            cursorWidth: 2,
            height: containerRef.current.clientHeight,
            minPxPerSec: zoom,
            media: videoRef.current,
            plugins: [
                TimelinePlugin.create({
                    container: '#waveform-timeline'
                }),
                HoverPlugin.create({
                    lineColor: 'rgba(255, 255, 255, 0.5)',
                    lineWidth: 2,
                    labelSize: '11px',
                    labelColor: '#fff'
                })
            ]
        };

        if (peaks) {
            options.peaks = peaks;
        }

        const ws = WaveSurfer.create(options);

        // Initialize Regions
        const regionsPlugin = RegionsPlugin.create();
        ws.registerPlugin(regionsPlugin);
        wsRegions.current = regionsPlugin;
        
        // Region Events
        regionsPlugin.on('region-update', () => {
             if (!isDraggingRef.current) {
                 isDraggingRef.current = true;
                 onInteractStart?.();
             }
             // REMOVED: onRegionUpdate(region.id, region.start, region.end); 
             // updating parent state here causes re-render -> clearRegions -> breaks drag lifecycle?
        });

        regionsPlugin.on('region-updated', (region) => {
             isDraggingRef.current = false;
             // Final sync
             onRegionUpdate(region.id, region.start, region.end);
        });

        regionsPlugin.on('region-clicked', (region, e) => {
            onRegionClick(region.id, e);
        });
        
        regionsPlugin.on('region-created', (region) => {
             if(region.element) {
                 region.element.addEventListener('contextmenu', (e) => {
                     e.preventDefault();
                     onContextMenu(e, region.id);
                 });
             }
        });

        ws.on('ready', () => {
             setIsReady(true);
             if (!peaks && onPeaksGenerated) {
                 const exported = ws.exportPeaks();
                 if (exported && exported.length > 0) onPeaksGenerated(exported);
             }
        });
        
        ws.on('decode', () => {
             if (!peaks && onPeaksGenerated) {
                 const exported = ws.exportPeaks();
                 if (exported && exported.length > 0) onPeaksGenerated(exported);
             }
        });
        
        ws.on('error', (e) => {
             console.error("Waveform error", e);
        });

        wavesurfer.current = ws;

        return () => {
            // Explicitly destroy plugins to detach events
            if (wsRegions.current) {
                wsRegions.current.destroy();
                wsRegions.current = null;
            }
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
                wavesurfer.current = null;
            }
            setIsReady(false);
        };
    }, [mediaUrl, videoRef]); // Added videoRef dependency to strictly follow deps

    // Update Regions when props change OR when WaveSurfer is ready
    useEffect(() => {
        if (!wsRegions.current || !isReady) return;
        
        // --- DIFF LOGIC ---
        // 1. Calculate overlaps first (for color logic)
        const overlappingIds = new Set<string>();
        for (let i = 0; i < regions.length; i++) {
            for (let j = i + 1; j < regions.length; j++) {
                const r1 = regions[i];
                const r2 = regions[j];
                const tolerance = 0.01;
                if (r1.start < r2.end - tolerance && r2.start < r1.end - tolerance) {
                    overlappingIds.add(String(r1.id));
                    overlappingIds.add(String(r2.id));
                }
            }
        }
        
        // 2. Identify current regions in WaveSurfer
        const existingRegions = wsRegions.current.getRegions();
        // const existingIds = new Set(existingRegions.map(r => r.id)); // Unused
        const incomingIds = new Set(regions.map(r => String(r.id)));

        // 3. Remove deleted regions
        existingRegions.forEach(r => {
            if (!incomingIds.has(r.id)) {
                r.remove();
            }
        });

        // 4. Add or Update regions
        regions.forEach(seg => {
            const strId = String(seg.id);
            const isSelected = selectedIds.includes(strId);
            const isOverlapping = overlappingIds.has(strId);
            
            // Color Logic
            let color = 'rgba(79, 70, 229, 0.2)'; // Default
            if (isOverlapping) {
                color = 'rgba(239, 68, 68, 0.5)'; // Red for overlap
            }
            if (isSelected) {
                if (isOverlapping) {
                    color = 'rgba(239, 68, 68, 0.7)'; // Darker Red if selected overlap
                } else {
                    color = 'rgba(234, 179, 8, 0.5)'; // Normal Yellow selection
                }
            }

            const existing = existingRegions.find(r => r.id === strId);
            if (existing) {
                // UPDATE: Only if changed to prevent unnecessary re-renders
                // Check if meaningful properties changed
                const startChanged = Math.abs(existing.start - seg.start) > 0.001;
                const endChanged = Math.abs(existing.end - seg.end) > 0.001;
                const colorChanged = existing.color !== color;
                
                if (startChanged || endChanged || colorChanged) {
                    existing.setOptions({
                        start: seg.start,
                        end: seg.end,
                        color: color
                    });
                }
            } else {
                // CREATE
                wsRegions.current?.addRegion({
                    id: strId,
                    start: seg.start,
                    end: seg.end,
                    color: color,
                    drag: true,
                    resize: true
                });
            }
        });

    }, [regions, selectedIds, isReady, zoom]);

    // Zoom setup...
    useEffect(() => {
        if(wavesurfer.current) {
            try {
                wavesurfer.current.zoom(zoom);
            } catch (e) {
                // console.warn("WaveSurfer zoom failed", e);
            }
        }
    }, [zoom]);

    // Placeholder for handleZoomIn/Out, not provided in the instruction
    const handleZoomIn = () => setZoom(prev => Math.min(200, prev + 10));
    const handleZoomOut = () => setZoom(prev => Math.max(5, prev - 10));

    useEffect(() => {
        if (wavesurfer.current) {
            wavesurfer.current.setOptions({
                autoScroll,
                autoCenter: autoScroll
            });
        }
    }, [autoScroll]);
    
    return (
        <div className="w-full h-full flex flex-col relative bg-[#0a0a0a] border-t border-white/10">
            {/* Toolbar */}
            <div className="absolute top-3 right-3 z-30 flex gap-2">
                <button 
                  onClick={handleZoomOut} 
                  className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all shadow-lg active:scale-95"
                  title="Zoom Out"
                >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button 
                  onClick={handleZoomIn} 
                  className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all shadow-lg active:scale-95"
                  title="Zoom In"
                >
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
            </div>

            <div className="relative w-full h-full overflow-x-auto wavesurfer-wrapper custom-scrollbar" ref={containerRef} onContextMenu={(e) => e.preventDefault()}>
               {/* Timeline container */}
               <div id="waveform-timeline" className="absolute top-0 left-0 w-full h-5 z-20 pointer-events-none opacity-70"></div>
            </div>
            
            {/* Loading Overlay */}
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 z-40 backdrop-blur-sm transition-all duration-500">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                        <span className="text-xs font-medium text-indigo-400 tracking-wider uppercase animate-pulse">Generated Waveform</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export const WaveformPlayer = React.memo(WaveformPlayerComponent);
