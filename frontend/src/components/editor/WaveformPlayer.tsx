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
    onRegionClick: (id: string) => void;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ 
    mediaUrl, 
    videoRef, 
    regions,
    onRegionUpdate,
    onRegionClick
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const wsRegions = useRef<RegionsPlugin | null>(null);
    const [zoom, setZoom] = useState(10);

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current || !videoRef.current) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#4F46E5',
            progressColor: '#818cf8',
            height: 128,
            minPxPerSec: zoom,
            media: videoRef.current, // Use the video element as media source
            plugins: [
                TimelinePlugin.create({
                    container: '#waveform-timeline'
                })
            ]
        });

        // Initialize Regions
        const regionsPlugin = RegionsPlugin.create();
        ws.registerPlugin(regionsPlugin);
        wsRegions.current = regionsPlugin;
        
        // Region Events
        regionsPlugin.on('region-updated', (region) => {
             onRegionUpdate(region.id, region.start, region.end);
        });

        regionsPlugin.on('region-clicked', (region, e) => {
            e.stopPropagation(); // Prevent seeking
            ws.setTime(region.start);
            onRegionClick(region.id);
        });

        ws.on('ready', () => {
            console.log("Waveform ready");
        });
        
        ws.on('error', (e) => {
            console.error("Waveform error", e);
        });

        wavesurfer.current = ws;

        return () => {
            ws.destroy();
            wavesurfer.current = null;
        };
    }, [mediaUrl]);

    // Update Regions when props change
    useEffect(() => {
        if (!wsRegions.current) return;
        
        wsRegions.current.clearRegions();
        
        regions.forEach(seg => {
            wsRegions.current?.addRegion({
                id: String(seg.id),
                start: seg.start,
                end: seg.end,
                content: seg.text.substring(0, 10) + '...',
                color: 'rgba(79, 70, 229, 0.2)',
                drag: true,
                resize: true
            });
        });

    }, [regions]);

    // Update Zoom
    useEffect(() => {
        if(wavesurfer.current) {
            try {
                wavesurfer.current.zoom(zoom);
            } catch (e) {
                console.warn("WaveSurfer zoom failed (media not ready?)", e);
            }
        }
    }, [zoom]);

    return (
        <div className="bg-slate-900 border-t border-slate-700 p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                 <span>Audio Waveform</span>
                 <div className="flex items-center gap-2">
                     <span className="text-xs">Zoom</span>
                     <input 
                        type="range" 
                        min="5" 
                        max="200" 
                        value={zoom} 
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-32 accent-indigo-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                     />
                 </div>
            </div>
            
            <div id="waveform-timeline" className="mb-1"></div>
            <div ref={containerRef} className="w-full"></div>
            
            <div className="text-center text-xs text-slate-500 mt-1">
                Drag regions to adjust timing • Drag edges to trim
            </div>
        </div>
    );
};
