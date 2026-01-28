import { useState, useEffect } from "react";
import {
  Download,
  Link,
  FolderOpen,
  ArrowRight,
  Clipboard,
  List,
  X,
} from "lucide-react";
import { apiClient } from "../api/client";
import type { AnalyzeResult } from "../api/client";
import { TaskMonitor } from "../components/TaskMonitor";
// ElectronAPI types are now defined in src/types/electron.d.ts

export function DownloaderPage() {
  const [url, setUrl] = useState(() => localStorage.getItem("downloader_url") || "");
  
  // Persist URL
  // Persist URL
  useEffect(() => {
    localStorage.setItem("downloader_url", url);
  }, [url]);

  // Debug Electron API
  useEffect(() => {
    console.log("[Debug] DownloaderPage mounted");
    console.log("[Debug] window.electronAPI:", window.electronAPI);
    if (window.electronAPI) {
        console.log("[Debug] Available methods:", Object.keys(window.electronAPI));
    } else {
        console.warn("[Debug] electronAPI is undefined!");
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Playlist detection state
  const [playlistInfo, setPlaylistInfo] = useState<AnalyzeResult | null>(null);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // Subtitle state - Persisted
  const [downloadSubs, setDownloadSubs] = useState(() => {
    return localStorage.getItem("downloader_subs") === "true";
  });
  
  // Resolution state - Persisted
  const [resolution, setResolution] = useState(() => {
    return localStorage.getItem("downloader_resolution") || "best";
  });

  // Persist Subtitles and Resolution
  useEffect(() => {
    localStorage.setItem("downloader_subs", String(downloadSubs));
    localStorage.setItem("downloader_resolution", resolution);
  }, [downloadSubs, resolution]);

  const handleAnalyzeAndDownload = async () => {
    if (!url) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setPlaylistInfo(null);

    try {
      // First analyze the URL
      const analysis = await apiClient.analyzeUrl(url);

      if (analysis.type === "playlist" && analysis.items && analysis.items.length > 1) {
        // Show playlist dialog
        setPlaylistInfo(analysis);
        setSelectedItems([]); // Default: nothing selected
        setShowPlaylistDialog(true);
        setAnalyzing(false);
      } else {
        // Single video - download directly
        setAnalyzing(false);
        // Use normalized URL from analysis (important for platforms like Douyin)
        // Pass direct_src if available so downloadVideos can use it
        const extraWithDirect = analysis.extra_info || {};
        if (analysis.direct_src) {
            extraWithDirect.direct_src = analysis.direct_src;
        }
        if (analysis.title) {
            extraWithDirect.title = analysis.title;
        }
        await downloadVideos([analysis.url || url], undefined, extraWithDirect);
      }
    } catch (e: any) {
      const errorMessage = e.message || "Analysis failed";
      
      // Check if this is a COOKIES_REQUIRED error
      if (errorMessage.includes("COOKIES_REQUIRED:")) {
        // Extract domain, handling JSON format like {"detail":"COOKIES_REQUIRED:douyin.com"}
        const match = errorMessage.match(/COOKIES_REQUIRED:([a-zA-Z0-9.-]+)/);
        const domain = match?.[1];
        if (domain && window.electronAPI?.fetchCookies) {
          console.log(`[Cookie] Opening browser for domain: ${domain}`);
          setError(`正在打开浏览器，请在新窗口中访问网站，完成后关闭窗口...`);
          
          try {
            // Silently fetch cookies via Electron
            const targetUrl = `https://www.${domain}`;
            const cookies = await window.electronAPI.fetchCookies(targetUrl);
            
            if (cookies && cookies.length > 0) {
              // Save cookies to backend
              await apiClient.saveCookies(domain, cookies);
              console.log(`[Cookie] Saved ${cookies.length} cookies for ${domain}`);
              
              // Retry analysis
              setError(null);
              const analysis = await apiClient.analyzeUrl(url);
              
              if (analysis.type === "playlist" && analysis.items && analysis.items.length > 1) {
                setPlaylistInfo(analysis);
                setSelectedItems([]);
                setShowPlaylistDialog(true);
              } else {
                // Use normalized URL from analysis
                await downloadVideos([analysis.url || url], undefined, analysis.extra_info);
              }
              setAnalyzing(false);
              return;
            } else {
              setError(`无法获取 ${domain} 的 Cookie。请尝试在浏览器中登录后重试。`);
            }
          } catch (cookieError: any) {
            console.error("[Cookie] Fetch failed:", cookieError);
            setError(`Cookie 获取失败: ${cookieError.message}`);
          }
        } else {
          setError("需要登录验证，但 Electron API 不可用。请使用桌面版应用。");
        }
      } else {
        setError(errorMessage);
      }
      setAnalyzing(false);
    }
  };

  const downloadVideos = async (urls: string[], playlistTitle?: string, extraInfo?: Record<string, any>) => {
    setLoading(true);
    setShowPlaylistDialog(false);
    setError(null);
    setResult(null); // Clear previous result if any

    // Submit tasks
    let successCount = 0;
    for (let i = 0; i < urls.length; i++) {
        try {
            let currentUrl = urls[i];
            let directUrl: string | null = null;
            let finalExtraInfo: any = { ...extraInfo };
            let customFilename: string | undefined = undefined;

            // Use analysis title if available for filename
            // result is only for the current one if single mode, but loop iterates 'urls'.
            // If extracting, we need a title.
            // If single URL mode
            if (urls.length === 1) {
                 // Prioritize title passed via extraInfo (from analysis)
                 if (finalExtraInfo.title) {
                     customFilename = finalExtraInfo.title;
                 } else if (result?.title) {
                     customFilename = result.title;
                 }
            } else if (playlistInfo && playlistInfo.items) {
                 // Try to find item matching URL
                 const found = playlistInfo.items.find(item => item.url === currentUrl);
                 if (found) customFilename = found.title;
            }

            // Ensure we HAVE a filename for direct downloads if title is missing
            if (!customFilename && currentUrl.includes("douyin.com")) {
                 customFilename = `Douyin_Video_${Date.now()}`;
            }

            // Special handling for Douyin: Backend now handles sniffing via Playwright
            // If the analysis provided a direct_src, use it.
            // Generic handling for platforms where backend provides a direct source (Douyin, Kuaishou, etc.)
            // If the analysis provided a direct_src, use it.
            if (finalExtraInfo && finalExtraInfo.direct_src) {
                directUrl = finalExtraInfo.direct_src;
                console.log("[Downloader] Using backend-sniffed direct URL:", directUrl);
            }

            await apiClient.runPipeline({
                pipeline_id: "downloader_tool",
                task_name: customFilename,
                steps: [
                {
                    step_name: "download",
                    params: { 
                        url: directUrl || currentUrl, // Use direct URL if extracted
                        playlist_title: playlistTitle,
                        download_subs: downloadSubs,
                        resolution: resolution,
                         ...finalExtraInfo,
                         filename: customFilename // Pass filename hint
                    },
                },
                ],
            });
            successCount++;
        } catch (e: any) {
            console.error(e);
            setError(`Failed to queue ${urls[i]}: ${e.message}`);
        }
    }
    setLoading(false);
    if (successCount > 0) {
        // Optional: show a toast "Tasks started"
        // For now, the TaskMonitor will show them.
    }
  };

  const handlePlaylistDownload = (mode: "current" | "all" | "selected") => {
    if (!playlistInfo?.items) return;

    let urlsToDownload: string[] = [];
    // Append ID to title to prevent collisions
    const playlistTitle = playlistInfo.id 
        ? `${playlistInfo.title} [${playlistInfo.id}]`
        : playlistInfo.title;

    if (mode === "current") {
      // Use original URL if possible, or the one from items matching current?
      // Actually 'current' usually means the one that was pasted.
      // But if it's a playlist URL, 'current' is ambiguous if not referring to specific video ID.
      // Assuming 'url' state is the specific video if provided, or we default to invalid?
      // For Bilibili/YouTube playlist URL usually contains video ID too, but not always.
      // Let's just use the 'url' state variable for 'current'.
      urlsToDownload = [url];
    } else if (mode === "all") {
      urlsToDownload = playlistInfo.items.map((item) => item.url);
    } else {
      urlsToDownload = selectedItems.map((i) => playlistInfo.items![i].url);
    }

    downloadVideos(urlsToDownload, playlistTitle);
  };

  const toggleItemSelection = (index: number) => {
    setSelectedItems((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleOpenFolder = () => {
    if (result?.video_path && window.electronAPI?.showInExplorer) {
      window.electronAPI.showInExplorer(result.video_path);
    } else {
      alert("Cannot open folder: path not available or not running in Electron");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  return (
    <div
      className="container"
      style={{ maxWidth: 800, margin: "40px auto", padding: "0 20px" }}
    >
      <h1
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Download className="text-indigo-500" size={32} color="#4F46E5" />
        Video Downloader
      </h1>
      <p style={{ color: "#888", marginBottom: 30 }}>
        Download high-quality video and audio from YouTube, Bilibili, and more.
      </p>

      <div
        className="card"
        style={{
          background: "#1e1e1e",
          padding: 30,
          borderRadius: 12,
          border: "1px solid #333",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Input Section */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 16, top: 16, color: "#666" }}>
              <Link size={20} />
            </div>
            <input
              type="text"
              placeholder="Paste video URL here (e.g. YouTube, Bilibili...)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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
              onClick={handlePaste}
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

          {/* Controls Row */}
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
              onClick={handleAnalyzeAndDownload}
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
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              padding: 15,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            Error: {error}
          </div>
        )}

        {result && (
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
                onClick={handleOpenFolder}
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
        )}
        
        {/* Task Monitor */}
        <TaskMonitor />
      </div>

      {/* Playlist Selection Dialog */}
      {showPlaylistDialog && playlistInfo && (
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
                onClick={() => setShowPlaylistDialog(false)}
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
                onClick={() => setSelectedItems(playlistInfo.items?.map((_, i) => i) || [])}
                style={{ background: "#333", border: "1px solid #555", padding: "6px 12px", fontSize: "0.85em" }}
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedItems([])}
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
                    onChange={() => toggleItemSelection(index)}
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
                onClick={() => handlePlaylistDownload("current")}
                style={{ background: "#333", border: "1px solid #555" }}
              >
                Download Current Only
              </button>
              <button
                onClick={() => handlePlaylistDownload("selected")}
                style={{ background: "#4F46E5" }}
                disabled={selectedItems.length === 0}
              >
                Download Selected ({selectedItems.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
