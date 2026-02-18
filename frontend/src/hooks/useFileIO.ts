import { useCallback, useEffect } from "react";
import { useTranslatorStore } from "../stores/translatorStore";
import { useEditorStore } from "../stores/editorStore";
import { parseSRT } from "../utils/subtitleParser";
import { NavigationService } from "../services/ui/navigation";

export const useFileIO = () => {
  const {
    sourceFilePath,
    targetLang,
    sourceSegments,
    targetSegments,
    setSourceFilePath,
    setSourceSegments,
    setTargetSegments,
    setTargetLang,
  } = useTranslatorStore();

  // --- Navigation & Session Init ---

  const checkPendingNavigation = useCallback(() => {
    const pendingFile = sessionStorage.getItem("mediaflow:pending_file");
    if (pendingFile) {
      try {
        const data = JSON.parse(pendingFile);
        if (data.subtitle_path) {
          handleFileUpload(data.subtitle_path);
        } else if (data.video_path) {
          if (/\.(srt|vtt|ass)$/i.test(data.video_path)) {
            handleFileUpload(data.video_path);
          }
        }
        sessionStorage.removeItem("mediaflow:pending_file");
      } catch (e) {
        console.error("[useFileIO] Failed to parse pending file:", e);
      }
    }
  }, []);

  useEffect(() => {
    checkPendingNavigation();
    const cleanup = NavigationService.subscribe((dest) => {
      if (dest === "translator") {
        checkPendingNavigation();
      }
    });
    return cleanup;
  }, [checkPendingNavigation]);

  // --- Helper Logic (Private) ---

  const tryLoadExistingTarget = async (sourcePath: string) => {
    if (!window.electronAPI) return;

    // Priority order for auto-detection
    const priorities = ["_CN", "_EN", "_JP", "_ES", "_FR", "_DE", "_RU"];
    const LANG_SUFFIX_MAP: Record<string, string> = {
      Chinese: "_CN",
      English: "_EN",
      Japanese: "_JP",
      Spanish: "_ES",
      French: "_FR",
      German: "_DE",
      Russian: "_RU",
    };

    // Try all suffixes
    for (const suffix of priorities) {
      // Replace extension with suffix.srt
      // Logic: find last dot, replace everything after it with suffix.srt
      // But we need to be careful not to break path if dot is in folder name
      // Simple replace of extension:
      const targetPath = sourcePath.replace(/(\.[^.]+)$/, `${suffix}.srt`);

      try {
        const content = await window.electronAPI.readFile(targetPath);
        if (content) {
          const foundLang = Object.keys(LANG_SUFFIX_MAP).find(
            (key) => LANG_SUFFIX_MAP[key] === suffix,
          );
          if (foundLang) setTargetLang(foundLang);

          const parsed = parseSRT(content);
          // Only if valid segments found
          if (parsed.length > 0) {
            setTargetSegments(parsed);
          }
          break; // Stop after first match
        }
      } catch (e) {
        /* Ignore file not found */
      }
    }
  };

  // --- Public Actions ---

  const handleFileUpload = async (path: string) => {
    if (!window.electronAPI) return;
    setSourceFilePath(path);

    try {
      const content = await window.electronAPI.readFile(path);
      if (!content) throw new Error("File content is empty");

      const parsed = parseSRT(content);
      if (parsed.length === 0) {
        // alert("Warning: No subtitles found.");
        // Toast would be better
      }
      setSourceSegments(parsed);

      // Reset target or keep? Resetting is safer for new file
      setTargetSegments(parsed.map((s) => ({ ...s, text: "" })));

      // Try to load existing translation
      await tryLoadExistingTarget(path);
    } catch (e) {
      console.error("File load error:", e);
      alert(`Failed to load file: ${path}`);
    }
  };

  const exportSRT = async () => {
    if (!sourceFilePath || !window.electronAPI) return;

    const LANG_SUFFIX_MAP: Record<string, string> = {
      Chinese: "_CN",
      English: "_EN",
      Japanese: "_JP",
      Spanish: "_ES",
      French: "_FR",
      German: "_DE",
      Russian: "_RU",
    };
    const suffix = LANG_SUFFIX_MAP[targetLang] || "_CN";

    let defaultPath = sourceFilePath;
    const lastDotIndex = defaultPath.lastIndexOf(".");
    const lastSepIndex = Math.max(
      defaultPath.lastIndexOf("/"),
      defaultPath.lastIndexOf("\\"),
    );

    // Robust extension stripping
    if (lastDotIndex > lastSepIndex) {
      defaultPath = defaultPath.substring(0, lastDotIndex);
    }
    defaultPath += `${suffix}.srt`;

    try {
      const savePath = await window.electronAPI.showSaveDialog({
        defaultPath: defaultPath,
        filters: [
          { name: "Subtitles", extensions: ["srt"] },
          { name: "Text", extensions: ["txt"] },
        ],
      });

      if (!savePath) return;

      let content = "";
      if (savePath.toLowerCase().endsWith(".txt")) {
        content = targetSegments.map((seg) => seg.text).join("\n");
      } else {
        // SRT
        targetSegments.forEach((seg, index) => {
          const startStr = formatTimestamp(seg.start);
          const endStr = formatTimestamp(seg.end);
          content += `${index + 1}\n${startStr} --> ${endStr}\n${seg.text}\n\n`;
        });
      }

      await window.electronAPI.saveFile(savePath, content);
    } catch (e) {
      console.error(e);
      alert("Failed to save file: " + e);
    }
  };

  const handleOpenInEditor = async () => {
    if (!sourceFilePath || targetSegments.length === 0 || !window.electronAPI)
      return;

    // 1. Resolve video path (try multiple extensions)
    const basePath = sourceFilePath.replace(/\.(srt|ass|vtt)$/i, "");
    let videoPath: string | null = null;
    for (const ext of [".mp4", ".mkv", ".avi", ".mov", ".webm"]) {
      try {
        const size = await window.electronAPI?.getFileSize(basePath + ext);
        if (size && size > 0) {
          videoPath = basePath + ext;
          break;
        }
      } catch {}
    }

    if (!videoPath) {
      // Fallback: If we can't find the video, we can't fully open the editor state via session
      // But maybe we can guess or use the source if it IS a video?
      // For now, assume video exists or warn.
      console.warn("Could not find associated video file.");
      alert(
        "Could not find associated video file. Opening editor might be incomplete.",
      );
      // We will try to proceed with a best guess or just the source path if it looks like video?
      // Actually, if sourceFilePath IS a video, basePath + ext might be weird.
      // Assuming sourceFilePath is .srt for now as per logic.
    }

    // 2. Determine target subtitle path (e.g. _CN.srt)
    const LANG_SUFFIX_MAP: Record<string, string> = {
      Chinese: "_CN",
      English: "_EN",
      Japanese: "_JP",
      Spanish: "_ES",
      French: "_FR",
      German: "_DE",
      Russian: "_RU",
    };
    const suffix = LANG_SUFFIX_MAP[targetLang] || "_CN";

    let targetSrtPath = sourceFilePath;
    const lastDot = targetSrtPath.lastIndexOf(".");
    if (lastDot > 0) targetSrtPath = targetSrtPath.substring(0, lastDot);
    targetSrtPath += `${suffix}.srt`;

    // 3. Save the translation to disk (Auto-Save)
    try {
      let content = "";
      targetSegments.forEach((seg, index) => {
        const startStr = formatTimestamp(seg.start);
        const endStr = formatTimestamp(seg.end);
        content += `${index + 1}\n${startStr} --> ${endStr}\n${seg.text || ""}\n\n`;
      });

      await window.electronAPI.writeFile(targetSrtPath, content);
      console.log("[Translator] Auto-saved translation to:", targetSrtPath);
    } catch (e) {
      console.error("Failed to auto-save translation before opening editor", e);
      alert(
        "Failed to save translation file. Editor might not load the correct file.",
      );
      return;
    }

    // 4. Set Session Storage for Navigation
    // This payload tells the Editor (and App.tsx) to load this specific video and subtitle
    sessionStorage.setItem(
      "mediaflow:pending_file",
      JSON.stringify({
        video_path: videoPath || basePath + ".mp4", // Best effort
        subtitle_path: targetSrtPath,
        target: "editor",
      }),
    );

    // 5. Navigate
    NavigationService.navigate("editor");
  };

  return {
    sourceFilePath,
    sourceSegments, // Exposed for checking length
    targetSegments, // Exposed for checking length
    handleFileUpload,
    exportSRT,
    handleOpenInEditor,
  };
};

// Helper
const formatTimestamp = (seconds: number) => {
  const date = new Date(0);
  date.setMilliseconds(Math.round(seconds * 1000));
  const iso = date.toISOString();
  return iso.substring(11, 23).replace(".", ",");
};
