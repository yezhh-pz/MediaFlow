import { Clapperboard } from "lucide-react";
import React, { type RefObject, useState, useCallback, useMemo } from "react";
import type { SubtitleSegment } from "../../types/task";

interface VideoPreviewProps {
    mediaUrl: string | null;
    videoRef: RefObject<HTMLVideoElement | null>;
    regions: SubtitleSegment[];
}

function VideoPreviewComponent({
    mediaUrl,
    videoRef,
    regions,
}: VideoPreviewProps) {
    // 内部管理时间状态，不传递给父组件
    const [currentTime, setCurrentTime] = useState(0);

    const handleTimeUpdate = useCallback(() => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    }, [videoRef]);

    // 缓存当前字幕，避免每次渲染都遍历
    const currentSubtitle = useMemo(() => 
        regions.find(r => currentTime >= r.start && currentTime < r.end)?.text || "",
        [regions, currentTime]
    );

    return (
        <div className="flex-1 bg-black flex flex-col relative justify-center items-center">
            {mediaUrl ? (
                <div className="w-full h-full relative p-4 flex flex-col">
                    <div className="flex-1 relative flex items-center justify-center bg-black/50 rounded-lg overflow-hidden border border-slate-800">
                        <video 
                           ref={videoRef as any}
                           src={mediaUrl}
                           className="max-w-full max-h-full shadow-2xl"
                           controls={true}
                           onTimeUpdate={handleTimeUpdate}
                        />
                        {/* Overlay Subtitles */}
                        <div className="absolute bottom-24 left-0 right-0 text-center pointer-events-none">
                            <span className="bg-black/60 text-white px-3 py-1.5 rounded text-xl font-medium shadow-sm backdrop-blur-sm">
                                {currentSubtitle}
                            </span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-slate-600 flex flex-col items-center">
                    <Clapperboard size={48} className="mb-4 opacity-50" />
                    <p>No media loaded</p>
                </div>
            )}
        </div>
    );
}

export const VideoPreview = React.memo(VideoPreviewComponent);
