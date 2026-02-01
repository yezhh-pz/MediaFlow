import React from "react";
import { List, X } from "lucide-react";
import type { AnalyzeResult } from "../../api/client";

interface PlaylistDialogProps {
  playlistInfo: AnalyzeResult;
  selectedItems: number[];
  onClose: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDownloadCurrent: () => void;
  onDownloadSelected: () => void;
  onToggleItem: (index: number) => void;
}

export function PlaylistDialog({
  playlistInfo,
  selectedItems,
  onClose,
  onSelectAll,
  onClearSelection,
  onDownloadCurrent,
  onDownloadSelected,
  onToggleItem,
}: PlaylistDialogProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#1e1e1e",
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: "90%",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <List size={24} color="#4F46E5" />
            Playlist Detected
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            <X size={24} color="#888" />
          </button>
        </div>

        <p style={{ color: "#888", margin: "0 0 16px 0" }}>
          <strong>{playlistInfo.title}</strong> contains{" "}
          <strong>{playlistInfo.count}</strong> videos.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            onClick={onSelectAll}
            style={{ background: "#333", border: "1px solid #555", padding: "6px 12px", fontSize: "0.85em" }}
          >
            Select All
          </button>
          <button
            onClick={onClearSelection}
            style={{ background: "#333", border: "1px solid #555", padding: "6px 12px", fontSize: "0.85em" }}
          >
            Clear Selection
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: 300,
            marginBottom: 16,
            border: "1px solid #333",
            borderRadius: 8,
          }}
        >
          {playlistInfo.items?.map((item, index) => (
            <label
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid #333",
                cursor: "pointer",
                background: selectedItems.includes(index)
                  ? "rgba(79, 70, 229, 0.1)"
                  : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={selectedItems.includes(index)}
                onChange={() => onToggleItem(index)}
                style={{ marginRight: 12 }}
              />
              <span style={{ color: "#666", marginRight: 12, minWidth: 30 }}>
                {item.index}.
              </span>
              <span style={{ flex: 1 }}>{item.title}</span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onDownloadCurrent}
            style={{ background: "#333", border: "1px solid #555" }}
          >
            Download Current Only
          </button>
          <button
            onClick={onDownloadSelected}
            style={{ background: "#4F46E5" }}
            disabled={selectedItems.length === 0}
          >
            Download Selected ({selectedItems.length})
          </button>
        </div>
      </div>
    </div>
  );
}
