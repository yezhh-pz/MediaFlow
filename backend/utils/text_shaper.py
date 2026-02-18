"""
Text Shaper — Smart line breaking for subtitle text.

Implements a simplified Unicode Line Breaking Algorithm for CJK text.
Since libass cannot auto-wrap CJK text (requires libunibreak), we pre-calculate
line breaks and insert ASS \\N markers before rendering.
"""
import unicodedata

# Characters that MUST NOT appear at the START of a line (避头标点)
_LINE_START_FORBIDDEN = set('，。！？；：、）」』】》〉）…—～·')
# Characters that MUST NOT appear at the END of a line (避尾标点)
_LINE_END_FORBIDDEN = set('（「『【《〈（')


def is_cjk(ch: str) -> bool:
    """Check if a character is a CJK ideograph."""
    cp = ord(ch)
    return (
        0x4E00 <= cp <= 0x9FFF or    # CJK Unified Ideographs
        0x3400 <= cp <= 0x4DBF or    # CJK Unified Ideographs Extension A
        0xF900 <= cp <= 0xFAFF or    # CJK Compatibility Ideographs
        0x20000 <= cp <= 0x2A6DF     # CJK Unified Ideographs Extension B
    )


def is_fullwidth(ch: str) -> bool:
    """Check if a character is fullwidth (CJK punctuation, fullwidth forms)."""
    cp = ord(ch)
    return (
        0x3000 <= cp <= 0x303F or    # CJK Symbols and Punctuation
        0xFF01 <= cp <= 0xFF60 or    # Fullwidth Forms
        0xFE30 <= cp <= 0xFE4F       # CJK Compatibility Forms
    )


def estimate_char_width(ch: str, font_size: int) -> float:
    """
    Estimate pixel width of a single character.
    
    Slightly under-estimate to avoid premature wrapping.
    CJK / Fullwidth chars ≈ 0.9 * font_size
    Latin / Half-width chars ≈ 0.5 * font_size
    Space ≈ 0.25 * font_size
    """
    if ch == ' ':
        return font_size * 0.25
    if is_cjk(ch) or is_fullwidth(ch) or ch in _LINE_START_FORBIDDEN or ch in _LINE_END_FORBIDDEN:
        return font_size * 0.9
    # Latin, digits, basic punctuation
    return font_size * 0.5


def _can_break_before(ch: str) -> bool:
    """Check if we can insert a line break BEFORE this character."""
    if ch in _LINE_START_FORBIDDEN:
        return False
    return True


def _can_break_after(ch: str) -> bool:
    """Check if we can insert a line break AFTER this character."""
    if ch in _LINE_END_FORBIDDEN:
        return False
    return True


def _is_cjk_or_fullwidth(ch: str) -> bool:
    """Check if a character is CJK or fullwidth (can be broken at any point)."""
    return is_cjk(ch) or is_fullwidth(ch) or ch in _LINE_START_FORBIDDEN or ch in _LINE_END_FORBIDDEN


def shape_line(text: str, max_width_px: int, font_size: int) -> str:
    """
    Break a single line of text into multiple lines that fit within max_width_px.
    Returns text with \\N inserted at break points.
    
    Algorithm:
    1. Walk through characters, accumulating width
    2. When width exceeds max_width_px, find the best break point:
       a. If current char is CJK → break before it
       b. If there's a previous space → break at the space (Latin word boundary)
       c. If in a Latin word preceded by CJK → backtrack to the CJK/Latin boundary
       d. Last resort → force break here
    
    Args:
        text: Single line of subtitle text (no existing \\N)
        max_width_px: Maximum width in pixels
        font_size: Font size in pixels
    """
    if font_size <= 0 or max_width_px <= 0:
        return text
    
    # Quick check: if entire text fits, return as-is
    total_width = sum(estimate_char_width(ch, font_size) for ch in text)
    if total_width <= max_width_px:
        return text
    
    lines = []
    current_line = []
    current_width = 0.0
    last_break_idx = -1  # Index of last valid break point in current_line
    
    for ch in text:
        ch_width = estimate_char_width(ch, font_size)
        
        # Track valid break points BEFORE adding current char
        if current_line:
            prev_ch = current_line[-1]
            # Space is always a valid break point
            if prev_ch == ' ':
                last_break_idx = len(current_line) - 1
            # After a CJK char, before any char (unless punctuation rules forbid it)
            elif _is_cjk_or_fullwidth(prev_ch) and _can_break_after(prev_ch) and _can_break_before(ch):
                last_break_idx = len(current_line)
        
        # Would adding this char exceed the line width?
        if current_width + ch_width > max_width_px and current_line:
            # Need to break. Find best break point.
            
            if _is_cjk_or_fullwidth(ch) and _can_break_before(ch):
                # Current char is CJK and can start a new line → break here
                if current_line and not _can_break_after(current_line[-1]):
                    # Previous char can't end a line (e.g. （「)
                    carry = current_line.pop()
                    lines.append(''.join(current_line))
                    current_line = [carry, ch]
                    current_width = sum(estimate_char_width(c, font_size) for c in current_line)
                else:
                    lines.append(''.join(current_line))
                    current_line = [ch]
                    current_width = ch_width
                last_break_idx = -1
                continue
                
            elif last_break_idx >= 0 and last_break_idx < len(current_line):
                # Break at last known good break point
                if current_line[last_break_idx] == ' ':
                    # Break at space: content before space | content after space + current char
                    before = current_line[:last_break_idx]
                    after = current_line[last_break_idx + 1:]  # Skip space
                else:
                    # Break at CJK boundary
                    before = current_line[:last_break_idx]
                    after = current_line[last_break_idx:]
                
                lines.append(''.join(before))
                current_line = after + [ch]
                current_width = sum(estimate_char_width(c, font_size) for c in current_line)
                last_break_idx = -1
                continue
            
            else:
                # No good break point found → force break (very long word, no CJK before it)
                lines.append(''.join(current_line))
                current_line = [ch]
                current_width = ch_width
                last_break_idx = -1
                continue
        
        current_line.append(ch)
        current_width += ch_width
    
    # Don't forget the last line
    if current_line:
        lines.append(''.join(current_line))
    
    return r'\N'.join(lines)


def shape(text: str, max_width_px: int, font_size: int) -> str:
    """
    Shape subtitle text to fit within max_width_px.
    Handles existing \\N line breaks by processing each segment independently.
    
    Args:
        text: Subtitle text (may contain existing \\N from SRT newlines)
        max_width_px: Effective width in pixels (PlayResX - MarginL - MarginR)
        font_size: Font size in pixels
    Returns:
        Text with \\N line breaks inserted where needed.
    """
    if not text or font_size <= 0 or max_width_px <= 0:
        return text
    
    # Split on existing \N breaks, process each segment, then rejoin
    # Note: In ASS event text, \N is a literal backslash-N (two chars)
    segments = text.split(r'\N')
    shaped_segments = [shape_line(seg, max_width_px, font_size) for seg in segments]
    return r'\N'.join(shaped_segments)
