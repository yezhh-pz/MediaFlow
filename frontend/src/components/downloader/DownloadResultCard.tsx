import React from "react";
import { FolderOpen, ArrowRight } from "lucide-react";

interface DownloadResultCardProps {
  result: any;
  onOpenFolder: () => void;
}

export function DownloadResultCard({ result, onOpenFolder }: DownloadResultCardProps) {
  if (!result) return null;

  return (
    <div
      style={{
        background: "rgba(16, 185, 129, 0.1)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
        borderRadius: 8,
        padding: 20,
      }}
    >
      <h3
        style={{
          margin: "0 0 10px 0",
          color: "#10b981",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        ✅ Download Complete
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "10px 20px",
          fontSize: "0.9em",
        }}
      >
        <span style={{ color: "#888" }}>Title:</span>
        <span style={{ fontWeight: 500 }}>
          {result.title || "Unknown Video"}
        </span>

        <span style={{ color: "#888" }}>Path:</span>
        <code
          style={{
            background: "#111",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {result.video_path || "N/A"}
        </code>

        <span style={{ color: "#888" }}>Quality:</span>
        <span>Auto</span>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          style={{ background: "#333", border: "1px solid #555" }}
          onClick={onOpenFolder}
        >
          <FolderOpen size={16} style={{ marginRight: 8 }} />
          Show in Explorer
        </button>
        <button
          style={{ background: "#4F46E5" }}
          onClick={() => alert("Navigate to Editor feature needed")}
        >
          Go to Editor
          <ArrowRight size={16} style={{ marginLeft: 8 }} />
        </button>
      </div>
    </div>
  );
}
