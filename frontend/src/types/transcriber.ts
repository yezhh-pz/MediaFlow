export interface TranscribeSegment {
  id: string | number;
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResult {
  segments: TranscribeSegment[];
  text: string;
  language: string;
  srt_path?: string;
  // Fields that might be present when result is from a Task
  video_path?: string;
  audio_path?: string;
  subtitle_path?: string;
}
