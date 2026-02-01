# Discovered Bugs via Testing Suite

The following bugs were identified by running edge-case tests on the existing codebase.

## 1. Subtitle Text Skipping (DownloaderService)

- **Problem**: Subtitle content that consists only of digits (e.g., "123") is incorrectly skipped during VTT to SRT conversion.
- **Cause**: The code uses `if line.isdigit(): continue` to skip VTT sequence numbers, but doesn't distinguish between sequence numbers and actual content.
- **Impact**: Loss of data for subtitles containing only numbers.

## 2. Invalid Timestamp Parsing (DownloaderService)

- **Problem**: Short VTT timestamps (MM:SS.mmm) are completely ignored.
- **Cause**: The regex `(\d{2}:\d{2}:\d{2})` strictly expects the hours component.
- **Impact**: SRT conversion fails for short videos (like TikTok/Douyin) that omit the hours part in VTT.

## 3. Potential Floating Point Precision (ASRService)

- **Observation**: `_format_timestamp` uses `int((seconds - int(seconds)) * 1000)` which might lead to off-by-one millisecond errors due to floating point precision.
- **Recommendation**: Use `round(seconds % 1 * 1000)` or `timedelta` more effectively.
