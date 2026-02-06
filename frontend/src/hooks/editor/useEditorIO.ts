import { useState, useEffect, useCallback } from "react";
import { parseSRT } from "../../utils/subtitleParser";
import type { SubtitleSegment } from "../../types/task";
import { apiClient } from "../../api/client";

const STORAGE_KEY_LAST_MEDIA = "editor_last_media_path";
const STORAGE_KEY_LAST_SUBS = "editor_last_subtitles";

export function useEditorIO(
  setRegions: (regions: SubtitleSegment[]) => void,
  setPeaks: (peaks: any) => void,
) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // --- Private Helpers ---

  const tryLoadRelatedSubtitle = async (videoPath: string) => {
    const srtPath = videoPath.replace(/\.[^.]+$/, ".srt");
    try {
      if (window.electronAPI?.readFile) {
        const content = await window.electronAPI.readFile(srtPath);
        if (content) {
          const parsed = parseSRT(content);
          if (parsed.length > 0) {
            setRegions(parsed);
            localStorage.setItem(STORAGE_KEY_LAST_SUBS, JSON.stringify(parsed));
          }
        }
      }
    } catch (e) {
      console.log("[EditorIO] No matching subtitle file found.");
    }
  };

  const tryLoadPeaks = async (videoPath: string) => {
    const peaksPath = videoPath + ".peaks.json";
    try {
      if (window.electronAPI?.readFile) {
        const content = await window.electronAPI.readFile(peaksPath);
        if (content) {
          const data = JSON.parse(content);
          if (Array.isArray(data) || Array.isArray(data[0])) {
            setPeaks(data);
          }
        }
      }
    } catch (e) {
      console.log("[EditorIO] No cached peaks found", e);
    }
  };

  const loadMediaAndResources = useCallback(
    async (path: string) => {
      if (!path || typeof path !== "string") return;

      const normalizedPath = path.replace(/\\/g, "/");
      const url = `file:///${encodeURI(normalizedPath)}`;

      setPeaks(null);
      localStorage.setItem(STORAGE_KEY_LAST_MEDIA, path);
      setCurrentFilePath(path);

      await tryLoadPeaks(path);

      setMediaUrl(url);
      await tryLoadRelatedSubtitle(path);
    },
    [setRegions, setPeaks],
  );

  // --- Actions ---

  const handleOpenFile = useCallback(async () => {
    if (window.electronAPI?.openFile) {
      try {
        const result = await window.electronAPI.openFile();
        const fileObj = result as any;
        const path = fileObj?.path || fileObj;

        if (path) {
          await loadMediaAndResources(path);
        }
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    } else {
      // Browser Fallback (limited)
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "video/*,audio/*";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setMediaUrl(URL.createObjectURL(file));
          setPeaks(null);
          // Cannot load related files in browser mode easily
        }
      };
      input.click();
    }
  }, [loadMediaAndResources, setPeaks]);

  const handlePeaksExport = useCallback(async (generatedPeaks: any) => {
    const lastMedia = localStorage.getItem(STORAGE_KEY_LAST_MEDIA);
    if (lastMedia && window.electronAPI?.writeFile) {
      try {
        await window.electronAPI.writeFile(
          lastMedia + ".peaks.json",
          JSON.stringify(generatedPeaks),
        );
      } catch (e) {
        console.error("[EditorIO] Failed to save peaks", e);
      }
    }
  }, []);

  // --- Restoration Effect ---

  // --- Restoration Effect ---

  useEffect(() => {
    const restoreSession = async () => {
      const lastMedia = localStorage.getItem(STORAGE_KEY_LAST_MEDIA);
      const lastSubs = localStorage.getItem(STORAGE_KEY_LAST_SUBS);

      if (lastMedia) {
        // Load peaks FIRST to avoid WaveformPlayer causing a full decode
        await tryLoadPeaks(lastMedia);

        const normalizedPath = lastMedia.replace(/\\/g, "/");
        setMediaUrl(`file:///${normalizedPath}`);
        setCurrentFilePath(lastMedia); // Restore path state
      }

      if (lastSubs) {
        try {
          const parsed = JSON.parse(lastSubs);
          setRegions(parsed);
        } catch (e) {
          console.warn("Failed to parse saved subtitles", e);
        }
      }

      // If we have media but no subs, maybe try reloading?
      // The original logic only loaded related if !lastSubs.
      if (lastMedia && !lastSubs) {
        await tryLoadRelatedSubtitle(lastMedia);
      }
      setIsReady(true);
    };
    restoreSession();
  }, []); // Run once

  const detectSilence = useCallback(
    async (threshold = "-30dB", minDuration = 0.5) => {
      // Use currentFilePath or fallback to localStorage
      const path =
        currentFilePath || localStorage.getItem(STORAGE_KEY_LAST_MEDIA);
      if (!path) throw new Error("No file loaded");

      try {
        const res = await apiClient.detectSilence({
          file_path: path,
          threshold,
          min_duration: minDuration,
        });
        return res.silence_intervals as [number, number][];
      } catch (e) {
        console.error("Silence detection failed", e);
        throw e;
      }
    },
    [currentFilePath],
  );

  // --- Persistence Actions ---

  const saveSubtitleFile = useCallback(
    async (regionsToSave: SubtitleSegment[]) => {
      // Use currentFilePath or fallback to localStorage path
      const path =
        currentFilePath || localStorage.getItem(STORAGE_KEY_LAST_MEDIA);
      if (!path) {
        alert("No file path found to save to.");
        return;
      }

      const srtPath = path.replace(/\.[^.]+$/, ".srt");

      // Generate SRT content
      const srtContent = regionsToSave
        .map((s) => {
          const fmt = (t: number) => {
            const date = new Date(0);
            date.setMilliseconds(t * 1000);
            return date.toISOString().substr(11, 12).replace(".", ",");
          };
          return `${s.id}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`;
        })
        .join("\n");

      if (window.electronAPI?.writeFile) {
        try {
          await window.electronAPI.writeFile(srtPath, srtContent);
          console.log("[EditorIO] Saved subtitles to", srtPath);
          return true; // value to indicate success
        } catch (e) {
          console.error("[EditorIO] Failed to save subtitle file", e);
          throw e;
        }
      } else {
        console.warn("Saving not supported in browser mode (yet)");
      }
    },
    [currentFilePath],
  );

  // Expose Actions
  return {
    mediaUrl,
    currentFilePath,
    isReady,
    openFile: handleOpenFile,
    savePeaks: handlePeaksExport,
    saveSubtitleFile, // New action
    detectSilence,
  };
}
