import { useState, useCallback } from "react";
import type { SubtitleSegment } from "../../types/task";
import { getBestSplitIndex } from "../../utils/textSplitter";

export function useEditorState(initialRegions: SubtitleSegment[] = []) {
  const [regions, setRegions] = useState<SubtitleSegment[]>(initialRegions);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // History State
  const [history, setHistory] = useState<{
    past: SubtitleSegment[][];
    future: SubtitleSegment[][];
  }>({ past: [], future: [] });

  // --- History Actions ---

  const addToHistory = useCallback((currentRegions: SubtitleSegment[]) => {
    setHistory((prev) => ({
      past: [...prev.past, currentRegions],
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const previous = newPast.pop();

      if (previous) {
        setRegions(previous);
        return {
          past: newPast,
          future: [regions, ...prev.future],
        };
      }
      return prev;
    });
  }, [regions]);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const next = newFuture.shift();

      if (next) {
        setRegions(next);
        return {
          past: [...prev.past, regions],
          future: newFuture,
        };
      }
      return prev;
    });
  }, [regions]);

  // --- Complex Actions ---

  const deleteSegments = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      addToHistory(regions);

      setRegions((prev) => prev.filter((r) => !ids.includes(String(r.id))));

      // Clear selection if deleted
      if (activeSegmentId && ids.includes(activeSegmentId)) {
        setActiveSegmentId(null);
      }
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [regions, activeSegmentId, addToHistory],
  );

  const mergeSegments = useCallback(
    (ids: string[]) => {
      if (ids.length < 2) return;
      addToHistory(regions);

      const selected = regions.filter((r) => ids.includes(String(r.id)));
      if (selected.length < 2) return;

      // Check continuity
      const indices = selected
        .map((s) => regions.findIndex((r) => r.id === s.id))
        .sort((a, b) => a - b);
      for (let i = 0; i < indices.length - 1; i++) {
        if (indices[i + 1] !== indices[i] + 1) {
          alert(
            "Cannot merge non-continuous segments. Please select adjacent subtitles.",
          );
          return;
        }
      }

      selected.sort((a, b) => a.start - b.start);

      const first = selected[0];
      const last = selected[selected.length - 1];
      // Join with space, but trim to avoid double spaces? Simple join is usually fine.
      const mergedText = selected.map((s) => s.text).join(" ");

      const newSegment = {
        ...first,
        end: last.end,
        text: mergedText,
      };

      setRegions((prev) => {
        const filtered = prev.filter((r) => !ids.includes(String(r.id)));
        return [...filtered, newSegment].sort((a, b) => a.start - b.start);
      });

      const newId = String(newSegment.id);
      setSelectedIds([newId]);
      setActiveSegmentId(newId);
    },
    [regions, addToHistory],
  );

  const splitSegment = useCallback(
    (currentTime: number, targetId?: string) => {
      const idToSplit = targetId || activeSegmentId;
      if (!idToSplit) return;

      const segment = regions.find((r) => r.id === idToSplit);
      if (!segment) return;

      const text = segment.text || "";
      const duration = segment.end - segment.start;
      const isPlayheadInside =
        currentTime > segment.start + 0.1 && currentTime < segment.end - 0.1;

      let splitTime = 0;
      let splitIndex = -1;

      // Smart Split Logic
      const smartIndex = getBestSplitIndex(text);

      // Strategy: Prioritize Smart Split unless user is explicitly positioning playhead for a manual split?
      // Current logic: Trust Smart Split if valid.
      // NOTE: If we want to strictly follow the previous logic:
      // "Fallback: If no punctuation, use Playhead position if valid, else Midpoint"
      // But what if punctuation exists but user WANTS to split at playhead?
      // Usually, 'Split' action implies "Split here (cursor)" OR "Smart Split".
      // Let's keep the logic we just implemented and verified.

      if (smartIndex !== -1 && smartIndex !== Math.floor(text.length / 2)) {
        splitIndex = smartIndex;
        const ratio = splitIndex / text.length;
        splitTime = segment.start + duration * ratio;
      } else {
        if (isPlayheadInside) {
          splitTime = currentTime;
          const ratio = (currentTime - segment.start) / duration;
          splitIndex = Math.floor(text.length * ratio);
        } else {
          splitTime = segment.start + duration / 2;
          splitIndex = Math.floor(text.length / 2);
        }
      }

      addToHistory(regions);

      const text1 = text.substring(0, splitIndex).trimEnd();
      const text2 = text.substring(splitIndex).trimStart(); // Trim leading space for part 2

      const part1 = {
        ...segment,
        end: splitTime,
        text: text1,
        id: segment.id + "_1",
      };
      const part2 = {
        ...segment,
        start: splitTime,
        text: text2,
        id: segment.id + "_2",
      };

      setRegions((prev) => {
        const filtered = prev.filter((r) => r.id !== idToSplit);
        return [...filtered, part1, part2].sort((a, b) => a.start - b.start);
      });

      setActiveSegmentId(String(part2.id));
      setSelectedIds([String(part2.id)]);
    },
    [regions, activeSegmentId, addToHistory],
  );

  const updateRegion = useCallback(
    (id: string, updates: Partial<SubtitleSegment>) => {
      setRegions((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      );
    },
    [],
  );

  const updateRegionText = useCallback(
    (id: string, text: string) => {
      const target = regions.find((r) => r.id === id);
      if (target && target.text !== text) {
        addToHistory(regions);
        setRegions((prev) =>
          prev.map((r) => (r.id === id ? { ...r, text } : r)),
        );
      }
    },
    [regions, addToHistory],
  );

  // Snapshot helper for external use (e.g. before bulk drag updates)
  const snapshot = useCallback(() => {
    addToHistory(regions);
  }, [regions, addToHistory]);

  // Selection Logic
  const selectSegment = useCallback(
    (id: string, multi: boolean, range: boolean) => {
      if (range && activeSegmentId) {
        // Range Selection
        const startIdx = regions.findIndex((r) => r.id === activeSegmentId);
        const endIdx = regions.findIndex((r) => r.id === id);

        if (startIdx !== -1 && endIdx !== -1) {
          const min = Math.min(startIdx, endIdx);
          const max = Math.max(startIdx, endIdx);
          const rangeIds = regions.slice(min, max + 1).map((r) => String(r.id));

          setSelectedIds(rangeIds);
          setActiveSegmentId(id);
        }
      } else if (multi) {
        // Multi Toggle
        setSelectedIds((prev) => {
          if (prev.includes(id)) {
            const newVal = prev.filter((i) => i !== id);
            if (id === activeSegmentId) {
              // If deselecting active, set active to last selected?
              // Or simple: set to null if empty, or last
              setActiveSegmentId(
                newVal.length > 0 ? newVal[newVal.length - 1] : null,
              );
            }
            return newVal;
          } else {
            setActiveSegmentId(id);
            return [...prev, id];
          }
        });
      } else {
        // Single Select
        setActiveSegmentId(id);
        setSelectedIds([id]);
      }
    },
    [regions, activeSegmentId],
  );

  return {
    regions,
    setRegions,
    activeSegmentId,
    setActiveSegmentId,
    selectedIds,
    setSelectedIds,
    history,

    // Actions
    undo,
    redo,
    deleteSegments,
    mergeSegments,
    splitSegment,
    updateRegion,
    updateRegionText,
    selectSegment,
    snapshot,
  };
}
