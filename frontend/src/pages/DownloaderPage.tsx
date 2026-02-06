import { Download } from "lucide-react";
import { TaskMonitor } from "../components/TaskMonitor";
import { useDownloaderController } from "../hooks/useDownloaderController";
import { DownloaderInput } from "../components/downloader/DownloaderInput";
import { VideoDownloadOptions } from "../components/downloader/VideoDownloadOptions";
import { PlaylistDialog } from "../components/downloader/PlaylistDialog";
import { DownloadResultCard } from "../components/downloader/DownloadResultCard";

export function DownloaderPage() {
  const {
    // State
    url, loading, analyzing, error, result, playlistInfo, showPlaylistDialog, selectedItems, downloadSubs, resolution,
    // Actions
    setUrl, setResolution, setDownloadSubs, setShowPlaylistDialog, setSelectedItems,
    analyzeAndDownload, downloadPlaylist, toggleItemSelection
  } = useDownloaderController();

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
    <div className="container max-w-[800px] mx-auto px-5 my-10">
      <h1 className="flex items-center gap-2.5 mb-2.5">
        <Download className="text-indigo-500" size={32} color="#4F46E5" />
        Video Downloader
      </h1>
      <p className="text-gray-400 mb-8">
        Download high-quality video and audio from YouTube, Bilibili, and more.
      </p>

      <div className="card bg-[#1e1e1e] p-[30px] rounded-xl border border-[#333]">
        <div className="flex flex-col gap-6">
          {/* Input Section */}
          <DownloaderInput 
            url={url} 
            onChange={setUrl} 
            onPaste={handlePaste} 
          />

          {/* Controls Row */}
          <VideoDownloadOptions 
            resolution={resolution}
            setResolution={setResolution}
            downloadSubs={downloadSubs}
            setDownloadSubs={setDownloadSubs}
            loading={loading}
            analyzing={analyzing}
            url={url}
            onAction={analyzeAndDownload}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-4 rounded-lg mb-5 mt-6">
            Error: {error}
          </div>
        )}

        {result && (
            <div className="mt-6">
                <DownloadResultCard result={result} onOpenFolder={handleOpenFolder} />
            </div>
        )}
        
        {/* Task Monitor */}
        <TaskMonitor filterTypes={['pipeline', 'download']} />
      </div>

      {/* Playlist Selection Dialog */}
      {showPlaylistDialog && playlistInfo && (
        <PlaylistDialog
           playlistInfo={playlistInfo}
           selectedItems={selectedItems}
           onClose={() => setShowPlaylistDialog(false)}
           onSelectAll={() => setSelectedItems(playlistInfo?.items?.map((_, i) => i) || [])}
           onClearSelection={() => setSelectedItems([])}
           onDownloadCurrent={() => downloadPlaylist("current")}
           onDownloadSelected={() => downloadPlaylist("selected")}
           onToggleItem={toggleItemSelection}
        />
      )}
    </div>
  );
}
