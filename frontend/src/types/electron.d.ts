/**
 * Type definitions for Electron IPC API exposed via preload.ts
 * This eliminates the need for @ts-ignore when using window.electronAPI
 */

interface ElectronAPI {
  /** Send a message to the main process */
  sendMessage: (message: unknown) => void;

  /** Open native file dialog and return selected file path */
  openFile: () => Promise<any>; // actually returns {path, name, size}
  openSubtitleFile: () => Promise<{ path: string; name: string } | null>;
  showSaveDialog: (options: {
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string | null>;

  /** Open native directory dialog and return selected path */
  selectDirectory: () => Promise<string | null>;

  /** Read file content from local filesystem */
  readFile: (filePath: string) => Promise<string | null>;

  /** Show file in system explorer/finder */
  showInExplorer: (filePath: string) => Promise<void>;

  /** Fetch cookies for a specific URL via Electron session */
  fetchCookies: (targetUrl: string) => Promise<unknown[]>;

  /** Extract data from Douyin (deprecated, backend handles this now) */
  extractDouyinData: (
    url: string,
  ) => Promise<{ error?: string; [key: string]: unknown }>;

  /** Get full path from File object (for Drag & Drop) */
  getPathForFile: (file: File) => string;

  /** Write file content to local filesystem */
  writeFile: (filePath: string, content: string) => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
}

/** Electron File object has an additional 'path' property for local files */
interface File {
  readonly path?: string;
}
