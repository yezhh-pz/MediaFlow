import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

interface TimelineEditorProps {
  mediaUrl: string;
  initialRegions?: { start: number; end: number; content: string; id: string }[];
}

export function TimelineEditor({ mediaUrl, initialRegions = [] }: TimelineEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkContainerRef = useRef<HTMLDivElement>(null); // To double check styles
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(100);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    setIsReady(false); // Reset ready state on new media

    // Initialize Regions Plugin
    const wsRegions = RegionsPlugin.create();
    regionsPluginRef.current = wsRegions;

    // Initialize WaveSurfer
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4F46E5",
      progressColor: "#818cf8",
      url: mediaUrl,
      cursorColor: "#ddd",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 128,
      minPxPerSec: 100, // Important for zoom
      plugins: [wsRegions],
    });

    wavesurferRef.current = ws;
    
    // Wait for ready before allowing interaction/zoom
    ws.on("decode", () => {
        setIsReady(true);
    });

    ws.on("interaction", () => {
      ws.play();
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("error", (e) => console.error("WaveSurfer Error:", e));

    // ... (regions code same) ...
    
    // Add regions from props
    // Clear existing first to avoid duplicates if re-rendering
    wsRegions.clearRegions();
    
    initialRegions.forEach((region) => {
        wsRegions.addRegion({
            start: region.start,
            end: region.end,
            content: region.content,
            color: "rgba(0, 255, 0, 0.1)",
            drag: true,
            resize: true,
            id: region.id
        });
    });
    
    // Cleanup
    return () => {
      ws.destroy();
    };
  }, [mediaUrl, initialRegions]); 

  // Zoom Handler
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
        wavesurferRef.current.zoom(zoom);
    }
  }, [zoom, isReady]);

  const togglePlay = () => {
    wavesurferRef.current?.playPause();
  };

  return (
    <div style={{ padding: 20, background: "#1e1e1e", borderRadius: 8, color: "white" }}>
      <div style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={togglePlay} style={{ cursor: "pointer", padding: "5px 15px" }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <label>
            Zoom: 
            <input 
                type="range" 
                min="10" 
                max="500" 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))} 
            />
        </label>
      </div>

      <div 
        ref={containerRef} 
        style={{ width: "100%", border: "1px solid #333", borderRadius: 4 }} 
      />
      
      <div ref={checkContainerRef} style={{marginTop: 5, fontSize: 12, color: '#666'}}>
        Drag regions to adjust timing.
      </div>
    </div>
  );
}
