import React from "react";
import { Link, Clipboard } from "lucide-react";

interface DownloaderInputProps {
  url: string;
  onChange: (url: string) => void;
  onPaste: () => void;
}

export function DownloaderInput({ url, onChange, onPaste }: DownloaderInputProps) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 16, top: 16, color: "#666" }}>
        <Link size={20} />
      </div>
      <input
        type="text"
        placeholder="Paste video URL here (e.g. YouTube, Bilibili...)"
        value={url}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          background: "#252525",
          border: "1px solid #404040",
          color: "#fff",
          padding: "16px 50px 16px 50px",
          borderRadius: 12,
          fontSize: "1.05em",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "#6366f1";
          e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "#404040";
          e.target.style.boxShadow = "none";
        }}
      />
      <button
        onClick={onPaste}
        title="Paste from clipboard"
        style={{
          position: "absolute",
          right: 12,
          top: 10,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          cursor: "pointer",
          padding: "8px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        }}
      >
        <Clipboard size={18} color="#9ca3af" />
      </button>
    </div>
  );
}
