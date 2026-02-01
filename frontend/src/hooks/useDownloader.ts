import { useState, useEffect, useCallback } from "react";
import { apiClient } from "../api/client";
import type { AnalyzeResult } from "../api/client";

export interface DownloaderState {
  url: string;
  loading: boolean;
  analyzing: boolean;
  result: any | null;
  error: string | null;
  playlistInfo: AnalyzeResult | null;
  showPlaylistDialog: boolean;
  selectedItems: number[];
  downloadSubs: boolean;
  resolution: string;
}

export function useDownloader() {
  const [url, setUrl] = useState(
    () => localStorage.getItem("downloader_url") || "",
  );
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Playlist detection state
  const [playlistInfo, setPlaylistInfo] = useState<AnalyzeResult | null>(null);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  // Settings
  const [downloadSubs, setDownloadSubs] = useState(() => {
    return localStorage.getItem("downloader_subs") === "true";
  });

  const [resolution, setResolution] = useState(() => {
    return localStorage.getItem("downloader_resolution") || "best";
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem("downloader_url", url);
  }, [url]);

  useEffect(() => {
    localStorage.setItem("downloader_subs", String(downloadSubs));
    localStorage.setItem("downloader_resolution", resolution);
  }, [downloadSubs, resolution]);

  // Debug Electron
  useEffect(() => {
    // Ideally this should be in a global context or similar, but keeping it here for now as per original
    if (window.electronAPI) {
      // console.log("[Debug] Electron API available");
    }
  }, []);

  const downloadVideos = useCallback(
    async (
      urls: string[],
      playlistTitle?: string,
      extraInfo?: Record<string, any>,
    ) => {
      setLoading(true);
      setShowPlaylistDialog(false);
      setError(null);
      setResult(null);

      let successCount = 0;
      for (let i = 0; i < urls.length; i++) {
        try {
          let currentUrl = urls[i];
          let directUrl: string | null = null;
          let finalExtraInfo: any = { ...extraInfo };
          let customFilename: string | undefined = undefined;

          if (urls.length === 1) {
            if (finalExtraInfo.title) {
              customFilename = finalExtraInfo.title;
            } else if (result?.title) {
              customFilename = result.title;
            }
          } else if (playlistInfo && playlistInfo.items) {
            const found = playlistInfo.items.find(
              (item) => item.url === currentUrl,
            );
            if (found) customFilename = found.title;
          }

          if (!customFilename && currentUrl.includes("douyin.com")) {
            customFilename = `Douyin_Video_${Date.now()}`;
          }

          if (finalExtraInfo && finalExtraInfo.direct_src) {
            directUrl = finalExtraInfo.direct_src;
          }

          await apiClient.runPipeline({
            pipeline_id: "downloader_tool",
            task_name: customFilename,
            steps: [
              {
                step_name: "download",
                params: {
                  url: directUrl || currentUrl,
                  playlist_title: playlistTitle,
                  download_subs: downloadSubs,
                  resolution: resolution,
                  ...finalExtraInfo,
                  filename: customFilename,
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
    },
    [downloadSubs, resolution, playlistInfo, result],
  );

  const handleAnalyzeAndDownload = async () => {
    if (!url) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setPlaylistInfo(null);

    try {
      const analysis = await apiClient.analyzeUrl(url);

      if (
        analysis.type === "playlist" &&
        analysis.items &&
        analysis.items.length > 1
      ) {
        setPlaylistInfo(analysis);
        setSelectedItems([]);
        setShowPlaylistDialog(true);
        setAnalyzing(false);
      } else {
        setAnalyzing(false);
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

      if (errorMessage.includes("COOKIES_REQUIRED:")) {
        const match = errorMessage.match(/COOKIES_REQUIRED:([a-zA-Z0-9.-]+)/);
        const domain = match?.[1];
        if (domain && window.electronAPI?.fetchCookies) {
          setError(`正在打开浏览器，请在新窗口中访问网站，完成后关闭窗口...`);
          try {
            const targetUrl = `https://www.${domain}`;
            const cookies = await window.electronAPI.fetchCookies(targetUrl);

            if (cookies && cookies.length > 0) {
              await apiClient.saveCookies(domain, cookies);
              setError(null);
              const analysis = await apiClient.analyzeUrl(url);

              if (
                analysis.type === "playlist" &&
                analysis.items &&
                analysis.items.length > 1
              ) {
                setPlaylistInfo(analysis);
                setSelectedItems([]);
                setShowPlaylistDialog(true);
              } else {
                await downloadVideos(
                  [analysis.url || url],
                  undefined,
                  analysis.extra_info,
                );
              }
              setAnalyzing(false);
              return;
            } else {
              setError(
                `无法获取 ${domain} 的 Cookie。请尝试在浏览器中登录后重试。`,
              );
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

  const handlePlaylistDownload = (mode: "current" | "all" | "selected") => {
    if (!playlistInfo?.items) return;

    let urlsToDownload: string[] = [];
    const playlistTitle = playlistInfo.id
      ? `${playlistInfo.title} [${playlistInfo.id}]`
      : playlistInfo.title;

    if (mode === "current") {
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
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  return {
    state: {
      url,
      loading,
      analyzing,
      result,
      error,
      playlistInfo,
      showPlaylistDialog,
      selectedItems,
      downloadSubs,
      resolution,
    },
    actions: {
      setUrl,
      setDownloadSubs,
      setResolution,
      setShowPlaylistDialog,
      setSelectedItems,
      analyzeAndDownload: handleAnalyzeAndDownload,
      downloadPlaylist: handlePlaylistDownload,
      toggleItemSelection,
    },
  };
}
