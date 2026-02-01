import React from "react";
import { Download } from "lucide-react";

interface VideoDownloadOptionsProps {
  resolution: string;
  setResolution: (res: string) => void;
  downloadSubs: boolean;
  setDownloadSubs: (subs: boolean) => void;
  loading: boolean;
  analyzing: boolean;
  url: string;
  onAction: () => void;
}

export function VideoDownloadOptions({
  resolution,
  setResolution,
  downloadSubs,
  setDownloadSubs,
  loading,
  analyzing,
  url,
  onAction,
}: VideoDownloadOptionsProps) {
  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: "1fr auto auto", 
      gap: 20,
      alignItems: "end" 
    }}>
      {/* Resolution Selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ fontSize: "0.85em", color: "#9ca3af", fontWeight: 500, letterSpacing: "0.02em" }}>
          QUALITY
        </label>
        <div style={{ position: "relative" }}>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#252525",
              border: "1px solid #404040",
              color: "white",
              borderRadius: 8,
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              fontSize: "0.95em",
            }}
          >
            <option value="best">Best Quality (Default)</option>
            <option value="4k">4K Ultra HD</option>
            <option value="2k">2K QHD</option>
            <option value="1080p">1080p Full HD</option>
            <option value="720p">720p HD</option>
            <option value="480p">480p SD</option>
            <option value="audio">Audio Only (m4a/mp3)</option>
          </select>
          <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7280" }}>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Subtitles Toggle */}
      <label 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 12, 
          cursor: "pointer",
          background: downloadSubs ? "rgba(99, 102, 241, 0.1)" : "#252525",
          border: `1px solid ${downloadSubs ? "#6366f1" : "#404040"}`,
          padding: "11px 16px",
          borderRadius: 8,
          height: 46, // Match select height roughly
          transition: "all 0.2s"
        }}
      >
        <div style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${downloadSubs ? "#6366f1" : "#6b7280"}`,
          background: downloadSubs ? "#6366f1" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s"
        }}>
          {downloadSubs && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <input 
          type="checkbox" 
          checked={downloadSubs} 
          onChange={e => setDownloadSubs(e.target.checked)}
          style={{ display: "none" }}
        />
        <span style={{ fontSize: "0.95em", fontWeight: 500, color: downloadSubs ? "#fff" : "#9ca3af" }}>
          Download Subtitles
        </span>
      </label>

      {/* Action Button */}
      <button
        onClick={onAction}
        disabled={loading || analyzing || !url}
        style={{
          height: 46,
          background: loading || analyzing ? "#374151" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          color: loading || analyzing ? "#9ca3af" : "#fff",
          border: "none",
          borderRadius: 8,
          padding: "0 28px",
          fontSize: "1em",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: loading || analyzing || !url ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1)",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!loading && !analyzing && url) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(79, 70, 229, 0.3), 0 4px 6px -2px rgba(79, 70, 229, 0.1)";
          }
        }}
        onMouseLeave={(e) => {
          if (loading || analyzing || !url) return;
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1)";
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>
          {analyzing ? "Analyzing..." : loading ? "Downloading..." : "Start Download"}
        </span>
        {!loading && !analyzing && <Download size={20} />}
      </button>
    </div>
  );
}
