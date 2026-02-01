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
}
