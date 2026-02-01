import { Download } from "lucide-react";
import { TaskMonitor } from "../components/TaskMonitor";
import { useDownloader } from "../hooks/useDownloader";
import { DownloaderInput } from "../components/downloader/DownloaderInput";
import { VideoDownloadOptions } from "../components/downloader/VideoDownloadOptions";
import { PlaylistDialog } from "../components/downloader/PlaylistDialog";
import { DownloadResultCard } from "../components/downloader/DownloadResultCard";

export function DownloaderPage() {
  const { state, actions } = useDownloader();

  const handleOpenFolder = () => {
    if (state.result?.video_path && window.electronAPI?.showInExplorer) {
      window.electronAPI.showInExplorer(state.result.video_path);
    } else {
      alert("Cannot open folder: path not available or not running in Electron");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        actions.setUrl(text.trim());
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
          <DownloaderInput 
            url={state.url} 
            onChange={actions.setUrl} 
            onPaste={handlePaste} 
          />

          {/* Controls Row */}
          <VideoDownloadOptions 
            resolution={state.resolution}
            setResolution={actions.setResolution}
            downloadSubs={state.downloadSubs}
            setDownloadSubs={actions.setDownloadSubs}
            loading={state.loading}
            analyzing={state.analyzing}
            url={state.url}
            onAction={actions.analyzeAndDownload}
          />
        </div>

        {state.error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              padding: 15,
              borderRadius: 8,
              marginBottom: 20,
              marginTop: 24,
            }}
          >
            Error: {state.error}
          </div>
        )}

        {state.result && (
            <div style={{ marginTop: 24 }}>
                <DownloadResultCard result={state.result} onOpenFolder={handleOpenFolder} />
            </div>
        )}
        
        {/* Task Monitor */}
        <TaskMonitor filterTypes={['pipeline', 'download']} />
      </div>

      {/* Playlist Selection Dialog */}
      {state.showPlaylistDialog && state.playlistInfo && (
        <PlaylistDialog
           playlistInfo={state.playlistInfo}
           selectedItems={state.selectedItems}
           onClose={() => actions.setShowPlaylistDialog(false)}
           onSelectAll={() => actions.setSelectedItems(state.playlistInfo?.items?.map((_, i) => i) || [])}
           onClearSelection={() => actions.setSelectedItems([])}
           onDownloadCurrent={() => actions.downloadPlaylist("current")}
           onDownloadSelected={() => actions.downloadPlaylist("selected")}
           onToggleItem={actions.toggleItemSelection}
        />
      )}
    </div>
  );
}
