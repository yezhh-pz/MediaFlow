import { useCallback } from "react";
import { apiClient } from "../../api/client";

// ─── Types ──────────────────────────────────────────────────────
interface UseEditorActionsArgs {
  currentFilePath: string | null;
  regions: Array<{ id: string; start: number; end: number; text: string }>;
  saveSubtitleFile: (regions: any[]) => Promise<string | boolean>;
  detectSilence: () => Promise<[number, number][] | null>;
  setRegions: (regions: any[]) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

interface UseEditorActionsReturn {
  handleSave: () => Promise<void>;
  handleTranslate: () => Promise<void>;
  handleSmartSplit: () => Promise<void>;
}

// ─── Hook ───────────────────────────────────────────────────────
export function useEditorActions({
  currentFilePath,
  regions,
  saveSubtitleFile,
  detectSilence,
  setRegions,
  videoRef,
}: UseEditorActionsArgs): UseEditorActionsReturn {
  const handleSave = useCallback(async () => {
    try {
      console.log(
        "[EditorActions] handleSave called with regions:",
        regions.length,
      );
      const savedPath = await saveSubtitleFile(regions);
      if (savedPath) {
        alert(`Saved successfully to:\n${savedPath}`);
      }
    } catch (e) {
      console.error("[EditorActions] Save failed", e);
      alert("Failed to save file. See console.");
    }
  }, [saveSubtitleFile, regions]);

  const handleTranslate = useCallback(async () => {
    if (!currentFilePath) return;

    // 1. Force Save FIRST
    try {
      await saveSubtitleFile(regions);
    } catch (e) {
      console.error("Failed to save before translate", e);
      if (!confirm("Failed to save subtitles. Continue with unsaved file?"))
        return;
    }

    // 2. Set Session Storage & Navigate
    const srtPath = currentFilePath.replace(/\.[^.]+$/, ".srt");
    sessionStorage.setItem(
      "mediaflow:pending_file",
      JSON.stringify({ video_path: currentFilePath, subtitle_path: srtPath }),
    );
    window.dispatchEvent(
      new CustomEvent("mediaflow:navigate", { detail: "translator" }),
    );
  }, [currentFilePath, regions, saveSubtitleFile]);

  const handleSmartSplit = useCallback(async () => {
    if (
      !confirm(
        "Start Smart Split (Voice Detection)?\n\nThis will OVERWRITE segments based on detected voice activity (non-silence).",
      )
    )
      return;

    try {
      const silences = await detectSilence();
      const duration = videoRef.current?.duration || 0;

      if (silences && silences.length > 0 && duration > 0) {
        const speechSegments: { start: number; end: number }[] = [];
        let lastEnd = 0;

        silences.forEach(([silStart, silEnd]) => {
          if (silStart > lastEnd + 0.1) {
            speechSegments.push({ start: lastEnd, end: silStart });
          }
          lastEnd = Math.max(lastEnd, silEnd);
        });

        if (lastEnd < duration - 0.1) {
          speechSegments.push({ start: lastEnd, end: duration });
        }

        const newSegments = speechSegments.map((seg, idx) => ({
          id: String(idx + 1),
          start: seg.start,
          end: seg.end,
          text: "",
        }));

        setRegions(newSegments);
      } else {
        alert("No silence/speech pattern detected.");
      }
    } catch (e) {
      alert("Failed to run detection. " + e);
    }
  }, [detectSilence, setRegions, videoRef]);

  return { handleSave, handleTranslate, handleSmartSplit };
}
