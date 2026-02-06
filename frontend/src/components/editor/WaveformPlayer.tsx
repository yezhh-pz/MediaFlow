import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
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
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ 
    mediaUrl, 
    videoRef, 
    regions,
    onRegionUpdate,
    onRegionClick,
    onContextMenu,
    peaks,
    onPeaksGenerated,
    selectedIds = [],
    autoScroll = true
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const wsRegions = useRef<RegionsPlugin | null>(null);
    const [zoom, setZoom] = useState(10);

    const [isReady, setIsReady] = useState(false);

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current || !videoRef.current) return;
        
        setIsReady(false); // Reset ready state on new media init

        const options: any = {
            container: containerRef.current,
            waveColor: '#4F46E5',
            progressColor: '#818cf8',
            height: 128,
            minPxPerSec: zoom,
            media: videoRef.current,
            plugins: [
                TimelinePlugin.create({
                    container: '#waveform-timeline'
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
        regionsPlugin.on('region-updated', (region) => {
             onRegionUpdate(region.id, region.start, region.end);
        });

        regionsPlugin.on('region-clicked', (region, e) => {
            e.stopPropagation(); 
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
             console.log("Waveform ready");
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
        
        wsRegions.current.clearRegions();
        
        regions.forEach(seg => {
            const width = (seg.end - seg.start) * zoom;
            const charLimit = Math.max(1, Math.floor(width / 6)); 
            const label = document.createElement('div');
            
            // Text Content Logic
            let textContent = "";
            if (width >= 25) {
                if (seg.text.length > charLimit) {
                    textContent = seg.text.substring(0, charLimit) + "...";
                } else {
                    textContent = seg.text;
                }
            }
            label.textContent = textContent;

            // Container Styles: Flexbox for robust alignment
            // Use block+height-full to ensure it takes space, then flex items-start
            label.className = "flex items-start justify-start w-full h-full pointer-events-none overflow-hidden select-none absolute top-0 left-0";
            
            // Text Styles
            label.style.padding = "2px 4px"; 
            label.style.fontFamily = "Inter, system-ui, sans-serif";
            label.style.fontSize = "10px";
            label.style.lineHeight = "1.2"; // Tight line height for consistency
            label.style.color = "rgba(255, 255, 255, 0.9)";
            label.style.fontWeight = "500";
            label.style.textShadow = "0px 1px 1px rgba(0,0,0,0.8), -1px 0px 1px rgba(0,0,0,0.8), 1px 0px 1px rgba(0,0,0,0.8), 0px -1px 1px rgba(0,0,0,0.8)";
            
            const isSelected = selectedIds.includes(String(seg.id));
            wsRegions.current?.addRegion({
                id: String(seg.id),
                start: seg.start,
                end: seg.end,
                content: label,
                color: isSelected ? 'rgba(79, 70, 229, 0.6)' : 'rgba(79, 70, 229, 0.2)',
                drag: true,
                resize: true
            });
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
        <div className="w-full h-full flex flex-col relative bg-slate-900">
            {/* Toolbar */}
            <div className="absolute top-2 right-2 z-10 flex gap-2">
                <button onClick={handleZoomOut} className="bg-slate-800 p-1 rounded hover:bg-slate-700 text-slate-300 pointer-events-auto">
                     -
                </button>
                <button onClick={handleZoomIn} className="bg-slate-800 p-1 rounded hover:bg-slate-700 text-slate-300 pointer-events-auto">
                     +
                </button>
            </div>

            <div className="relative w-full h-full" ref={containerRef} onContextMenu={(e) => e.preventDefault()}>
               {/* Timeline container */}
               <div id="waveform-timeline" className="absolute top-0 left-0 w-full h-4 z-10 pointer-events-none"></div>
            </div>
            
            {/* Loading Overlay */}
            {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-20 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
            )}
        </div>
    );
};
