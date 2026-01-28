import type { SubtitleSegment } from "../types/task";

/**
 * Parse SRT (SubRip) subtitle content into SubtitleSegment array.
 * Handles both Unix (\n) and Windows (\r\n) line endings.
 * Supports comma (,) and period (.) as millisecond separators.
 */
export function parseSRT(content: string): SubtitleSegment[] {
  // Normalize line endings to \n
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Split by blank lines (one or more empty lines)
  const blocks = normalized.trim().split(/\n\s*\n/);

  const segments: SubtitleSegment[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const lines = block.split("\n");

    // Find the line with timestamp (contains -->)
    let timeLineIdx = -1;
    for (let j = 0; j < lines.length; j++) {
      if (lines[j].includes("-->")) {
        timeLineIdx = j;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );

    if (!timeMatch) continue;

    const start =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;
    const end =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;

    // Text is everything after the timestamp line
    const textLines = lines.slice(timeLineIdx + 1).filter((l) => l.trim());
    const text = textLines.join(" ").trim();

    if (text) {
      segments.push({ id: String(segments.length + 1), start, end, text });
    }
  }

  return segments;
}

/**
 * Format seconds to SRT timestamp format (HH:MM:SS,mmm)
 */
export function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Convert SubtitleSegment array to SRT string format
 */
export function toSRT(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, idx) => {
      return `${idx + 1}\n${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}\n${seg.text}`;
    })
    .join("\n\n");
}
