export interface SubtitleSegment {
  id: number | string;
  start: number;
  end: number;
  text: string;
}

export interface Task {
  id: string;
  type: "download" | "transcribe" | "translate" | "pipeline";
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
  result?: any;
  created_at: number;
}
