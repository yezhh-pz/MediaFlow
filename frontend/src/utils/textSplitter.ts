/**
 * Text Splitter Utility for Subtitles
 * Inspired by Subtitle Edit's logic (TextSplit.cs / Utilities.cs)
 */

interface SplitResult {
  index: number;
  score: number;
  reason: "dialog" | "sentence" | "comma" | "length" | "fallback";
}

const ABBREVIATIONS = [
  "Mr.",
  "Mrs.",
  "Dr.",
  "Ms.",
  "Prof.",
  "Sr.",
  "Jr.",
  "St.",
  "No.",
  "Vol.",
  "Fig.",
  "vs.",
];

// CJK characters range
const REGEX_CJK =
  /[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uFF00-\uFFEF\u4E00-\u9FAF\u3400-\u4DBF]/;

/**
 * Checks if a split at the given index is safe.
 * Prevents splitting:
 * 1. Inside numbers (1.5, 2,000)
 * 2. After abbreviations (Mr. Smith)
 * 3. Inside brackets/quotes (basic check)
 */
function canBreakAt(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return false;

  const prev = text[index - 1];
  const curr = text[index];
  const next = text[index + 1];

  // 1. Check for floating point numbers or versions (e.g., 1.5, v2.0)
  // If break char is '.' and surrounded by digits
  if (curr === "." && /\d/.test(prev) && next && /\d/.test(next)) {
    return false;
  }

  // 2. Check for abbreviations
  // We check if the text ending at 'index' matches any abbreviation
  const textUpToSplit = text.substring(0, index + 1); // include the split char (e.g. '.')
  const lastWord = textUpToSplit.trim().split(/\s+/).pop();

  if (lastWord && ABBREVIATIONS.some((abbr) => lastWord.endsWith(abbr))) {
    // Double check it's not the end of a sentence?
    // Subtitle Edit uses a "NoBreakAfter" list.
    // Assuming if next char is lower case, it's definitely an abbreviation.
    if (next && /[a-z]/.test(next)) return false;

    // Even if uppercase, assume abbreviation if the list says so (safer)
    return false;
  }

  // 3. Check for quoting/bracketing (Simple balance check is too expensive here,
  // relying on local context).
  // Avoid splitting immediately after an opening bracket/quote if possible.
  if ("([".includes(prev)) return false;
  if (")].".includes(next)) return false; // Don't split before a closing bracket or dot

  return true;
}

/**
 * Calculates the visual/length score.
 * Lower score is better (closer to middle).
 */
function getBalanceScore(index: number, totalLength: number): number {
  const middle = totalLength / 2;
  return Math.abs(index - middle);
}

/**
 * Finds the best character index to split the text.
 * Returns the index relative to the start of the string.
 * The split should happen AFTER this index (i.e. text[index] is the last char of first part).
 */
export function getBestSplitIndex(text: string): number {
  if (!text || text.length < 2) return -1;

  const len = text.length;
  const candidates: SplitResult[] = [];

  // Priority 1: Dialog Dash (- ...)
  // Look for a dash that is preceded by space or newline, indicating a second speaker.
  // Index will be the character BEFORE the dash (usually a space).
  for (let i = 1; i < len - 1; i++) {
    // Pattern: " - " or "\n- "
    if (text[i] === "-" && (text[i - 1] === " " || text[i - 1] === "\n")) {
      // We want to split BEFORE the dash, so the second line starts with "- "
      // So the split index is i - 1 (the space/newline)
      candidates.push({
        index: i - 1,
        score: getBalanceScore(i, len),
        reason: "dialog",
      });
    }
  }

  // If dialog splits found, pick best balanced one
  if (candidates.length > 0) {
    return candidates.sort((a, b) => a.score - b.score)[0].index + 1; // +1 because we split after index
  }

  // Priority 2: Strong Sentence Endings
  const strongEndings = [".", "?", "!", "。", "？", "！"];
  for (let i = 0; i < len - 1; i++) {
    const char = text[i];
    if (strongEndings.includes(char)) {
      if (canBreakAt(text, i)) {
        candidates.push({
          index: i,
          score: getBalanceScore(i, len),
          reason: "sentence",
        });
      }
    }
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => a.score - b.score)[0].index + 1;
  }

  // Priority 3: Weak Pauses (Comma, Semicolon)
  const weakPauses = [",", ";", ":", "，", "；", "：", "、"];
  for (let i = 0; i < len - 1; i++) {
    const char = text[i];
    if (weakPauses.includes(char)) {
      if (canBreakAt(text, i)) {
        candidates.push({
          index: i,
          score: getBalanceScore(i, len),
          reason: "comma",
        });
      }
    }
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => a.score - b.score)[0].index + 1;
  }

  // Priority 4: Search for Space (Western) or Midpoint (CJK)
  const mid = Math.floor(len / 2);
  const isCJK = REGEX_CJK.test(text);

  if (isCJK) {
    // For CJK, just split at middle
    return mid;
  } else {
    // For Western, find closest space to middle
    let bestSpaceIndex = -1;
    let bestDist = Infinity;

    for (let i = 0; i < len; i++) {
      if (text[i] === " ") {
        const dist = Math.abs(i - mid);
        if (dist < bestDist) {
          bestDist = dist;
          bestSpaceIndex = i;
        }
      }
    }

    if (bestSpaceIndex !== -1) {
      return bestSpaceIndex + 1; // Split after the space? Or replace space? usually replace space with newline conceptually
      // Here we are returning index to valid "end of part 1".
      // If we return space index, part 1 ends with space.
      return bestSpaceIndex + 1;
    }
  }

  // Total fallback
  return mid;
}
