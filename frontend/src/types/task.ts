export interface SubtitleSegment {
  id: number | string;
  start: number;
  end: number;
  text: string;
}

export interface FileRef {
  type: string; // "video", "audio", "subtitle", "image"
  path: string;
  label?: string;
  mime_type?: string;
}

export interface TaskResult {
  success: boolean;
  files: FileRef[];
  meta: Record<string, any>;
  error?: string;
}

export interface Task {
  id: string;
  type: "download" | "transcribe" | "translate" | "pipeline" | "synthesis";
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "paused";
  progress: number;
  name?: string;
  message?: string;
  error?: string;
  result?: TaskResult;
  request_params?: any;
  created_at: number;
}
