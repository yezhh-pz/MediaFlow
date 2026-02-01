import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../api/client";
import { useTaskContext } from "../context/TaskContext";
import type { TranscribeResult } from "../types/transcriber";

export function useTranscriber() {
  const { tasks } = useTaskContext();

  // Settings
  const [model, setModel] = useState(
    () => localStorage.getItem("transcriber_model") || "base",
  );
  const [device, setDevice] = useState(
    () => localStorage.getItem("transcriber_device") || "cuda",
  );

  const [isUploading, setIsUploading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() =>
    localStorage.getItem("transcriber_activeTaskId"),
  );

  // Persistence
  const [result, setResult] = useState<TranscribeResult | null>(() => {
    const saved = localStorage.getItem("transcriber_result");
    return saved ? JSON.parse(saved) : null;
  });

  const [file, setFile] = useState<File | null>(() => {
    const saved = localStorage.getItem("transcriber_file");
    if (saved) {
      try {
        const meta = JSON.parse(saved);
        return {
          name: meta.name,
          path: meta.path,
          size: meta.size,
          type: "video/mp4", // Mock
        } as unknown as File;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Save Persistence
  useEffect(() => {
    localStorage.setItem("transcriber_model", model);
    localStorage.setItem("transcriber_device", device);

    if (activeTaskId)
      localStorage.setItem("transcriber_activeTaskId", activeTaskId);
    else localStorage.removeItem("transcriber_activeTaskId");

    if (result)
      localStorage.setItem("transcriber_result", JSON.stringify(result));
    else localStorage.removeItem("transcriber_result");

    if (file && (file as any).path) {
      localStorage.setItem(
        "transcriber_file",
        JSON.stringify({
          name: file.name,
          path: (file as any).path,
          size: file.size,
        }),
      );
    } else {
      localStorage.removeItem("transcriber_file");
    }
  }, [model, device, activeTaskId, result, file]);

  // Recover active task
  useEffect(() => {
    if (activeTaskId) return;
    const runningTask = tasks.find(
      (t) =>
        t.type === "transcribe" && ["running", "pending"].includes(t.status),
    );
    if (runningTask) {
      setActiveTaskId(runningTask.id);
    }
  }, [tasks]);

  // Poll for active task updates
  useEffect(() => {
    if (!activeTaskId) return;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (task) {
      if (task.status === "completed" && task.result) {
        setResult(task.result as TranscribeResult);
        setActiveTaskId(null);
      } else if (task.status === "failed") {
        // Keep it active to show error in UI if needed, or handle here
      }
    }
  }, [tasks, activeTaskId]);

  const handleTranscribe = async () => {
    if (!file) return;
    setResult(null);

    try {
      setIsUploading(true);

      let filePath = (file as any).path;
      if (
        !filePath &&
        window.electronAPI &&
        window.electronAPI.getPathForFile
      ) {
        filePath = window.electronAPI.getPathForFile(file);
      }

      if (!filePath) {
        alert("Cannot detect file path. Are you running in Electron?");
        setIsUploading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/transcribe/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_path: filePath,
          model: model,
          device: device,
          vad_filter: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to start transcription");

      const data = await response.json();
      setActiveTaskId(data.task_id);
    } catch (err: any) {
      console.error("[Transcriber] Error submitting task:", err);
      const msg = err.message || JSON.stringify(err);
      alert(`Transcription failed to start.\nDetails: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendToTranslator = () => {
    if (!result) return;
    let textContent = "";
    result.segments.forEach((seg, i) => {
      const start = new Date(seg.start * 1000).toISOString().substr(11, 8);
      const end = new Date(seg.end * 1000).toISOString().substr(11, 8);
      textContent += `${i + 1}\n${start},000 --> ${end},000\n${seg.text}\n\n`;
    });
    localStorage.setItem("translator_sourceText", textContent);
    window.dispatchEvent(
      new CustomEvent("mediaflow:navigate", { detail: "translator" }),
    );
  };

  const handleSendToEditor = () => {
    if (file && (file as any).path) {
      localStorage.setItem("editor_last_media_path", (file as any).path);
      localStorage.removeItem("editor_last_subtitles");
      window.dispatchEvent(
        new CustomEvent("mediaflow:navigate", { detail: "editor" }),
      );
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (
      droppedFile &&
      (droppedFile.type.startsWith("audio/") ||
        droppedFile.type.startsWith("video/") ||
        droppedFile.name.endsWith(".mkv"))
    ) {
      if (window.electronAPI && window.electronAPI.getPathForFile) {
        try {
          const path = window.electronAPI.getPathForFile(droppedFile);
          Object.defineProperty(droppedFile, "path", { value: path });
        } catch (err) {
          console.warn("Failed to get path via electronAPI:", err);
        }
      }
      setFile(droppedFile);
    }
  };

  const handleFileSelect = async () => {
    if (window.electronAPI) {
      const fileData = (await window.electronAPI.openFile()) as any;
      if (fileData && fileData.path) {
        const fakeFile = {
          name: fileData.name,
          path: fileData.path,
          size: fileData.size,
          type: "video/mp4",
        } as unknown as File;
        setFile(fakeFile);
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/*,video/*";
      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          setFile(files[0]);
        }
      };
      input.click();
    }
  };

  return {
    state: {
      file,
      model,
      device,
      isUploading,
      activeTaskId,
      result,
      activeTask: tasks.find((t) => t.id === activeTaskId),
    },
    actions: {
      setFile,
      setModel,
      setDevice,
      startTranscription: handleTranscribe,
      sendToTranslator: handleSendToTranslator,
      sendToEditor: handleSendToEditor,
      onFileDrop: handleFileDrop,
      onFileSelect: handleFileSelect,
    },
  };
}
