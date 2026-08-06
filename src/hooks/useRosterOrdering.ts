// src/hooks/useRosterOrdering.ts
import { useState, useCallback, useMemo } from 'react';

export type SortPreset = 'custom' | 'alphabetical' | 'vit_desc' | 'vit_asc';

export interface UseRosterOrderingOptions<T> {
  items: T[];
  storageKey: string;
  getId: (item: T) => string;
  getName?: (item: T) => string;
  getVitPct?: (item: T) => number;
}

export function useRosterOrdering<T>({
  items,
  storageKey,
  getId,
  getName,
  getVitPct,
}: UseRosterOrderingOptions<T>) {
  const [orderIds, setOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn(`[useRosterOrdering] Error reading storage key ${storageKey}:`, e);
    }
    return [];
  });

  const presetStorageKey = `${storageKey}_preset`;

  const [activePreset, setActivePresetState] = useState<SortPreset>(() => {
    try {
      const saved = localStorage.getItem(presetStorageKey);
      if (saved && (saved === 'custom' || saved === 'alphabetical' || saved === 'vit_desc' || saved === 'vit_asc')) {
        return saved as SortPreset;
      }
    } catch (e) {
      console.warn(`[useRosterOrdering] Error reading preset key ${presetStorageKey}:`, e);
    }
    return 'custom';
  });

  const setActivePreset = useCallback(
    (preset: SortPreset) => {
      setActivePresetState(preset);
      try {
        localStorage.setItem(presetStorageKey, preset);
      } catch (e) {
        console.warn(`[useRosterOrdering] Error saving preset key ${presetStorageKey}:`, e);
      }
    },
    [presetStorageKey]
  );

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Sync to localStorage
  const saveOrder = useCallback(
    (newOrder: string[]) => {
      setOrderIds(newOrder);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newOrder));
      } catch (e) {
        console.warn(`[useRosterOrdering] Error saving storage key ${storageKey}:`, e);
      }
    },
    [storageKey]
  );

  // Compute ordered items array
  const orderedItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    if (activePreset === 'alphabetical' && getName) {
      return [...items].sort((a, b) => {
        const nameDiff = getName(a).localeCompare(getName(b));
        if (nameDiff !== 0) return nameDiff;
        return getId(a).localeCompare(getId(b));
      });
    }
    if (activePreset === 'vit_desc' && getVitPct) {
      return [...items].sort((a, b) => {
        const diff = getVitPct(b) - getVitPct(a);
        if (Math.abs(diff) > 0.001) return diff;
        if (getName) {
          const nameDiff = getName(a).localeCompare(getName(b));
          if (nameDiff !== 0) return nameDiff;
        }
        return getId(a).localeCompare(getId(b));
      });
    }
    if (activePreset === 'vit_asc' && getVitPct) {
      return [...items].sort((a, b) => {
        const diff = getVitPct(a) - getVitPct(b);
        if (Math.abs(diff) > 0.001) return diff;
        if (getName) {
          const nameDiff = getName(a).localeCompare(getName(b));
          if (nameDiff !== 0) return nameDiff;
        }
        return getId(a).localeCompare(getId(b));
      });
    }

    if (orderIds.length === 0) return items;

    const itemMap = new Map<string, T>();
    items.forEach((item) => {
      itemMap.set(getId(item), item);
    });

    const result: T[] = [];
    const seen = new Set<string>();

    // Add items matching saved order
    orderIds.forEach((id) => {
      const found = itemMap.get(id);
      if (found) {
        result.push(found);
        seen.add(id);
      }
    });

    // Append any newly joined items not in saved order
    items.forEach((item) => {
      const id = getId(item);
      if (!seen.has(id)) {
        result.push(item);
        seen.add(id);
      }
    });

    return result;
  }, [items, orderIds, activePreset, getId, getName, getVitPct]);

  // Move item from one index to another
  const moveItem = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (
        fromIdx === toIdx ||
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= orderedItems.length ||
        toIdx >= orderedItems.length
      ) {
        return;
      }
      const newItems = [...orderedItems];
      const [removed] = newItems.splice(fromIdx, 1);
      newItems.splice(toIdx, 0, removed);

      const newOrderIds = newItems.map(getId);
      setActivePreset('custom');
      saveOrder(newOrderIds);
    },
    [orderedItems, getId, saveOrder, setActivePreset]
  );

  // Nudge item up or down
  const nudgeItem = useCallback(
    (idx: number, direction: 'up' | 'down') => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      moveItem(idx, targetIdx);
    },
    [moveItem]
  );

  // Apply a sort preset
  const applyPreset = useCallback(
    (preset: SortPreset) => {
      setActivePreset(preset);
      if (preset !== 'custom') {
        const sorted = [...items];
        if (preset === 'alphabetical' && getName) {
          sorted.sort((a, b) => getName(a).localeCompare(getName(b)) || getId(a).localeCompare(getId(b)));
        } else if (preset === 'vit_desc' && getVitPct) {
          sorted.sort((a, b) => {
            const diff = getVitPct(b) - getVitPct(a);
            if (Math.abs(diff) > 0.001) return diff;
            if (getName) {
              const nameDiff = getName(a).localeCompare(getName(b));
              if (nameDiff !== 0) return nameDiff;
            }
            return getId(a).localeCompare(getId(b));
          });
        } else if (preset === 'vit_asc' && getVitPct) {
          sorted.sort((a, b) => {
            const diff = getVitPct(a) - getVitPct(b);
            if (Math.abs(diff) > 0.001) return diff;
            if (getName) {
              const nameDiff = getName(a).localeCompare(getName(b));
              if (nameDiff !== 0) return nameDiff;
            }
            return getId(a).localeCompare(getId(b));
          });
        }
        saveOrder(sorted.map(getId));
      }
    },
    [items, getName, getVitPct, getId, saveOrder, setActivePreset]
  );

  // Reset to initial backend order
  const resetOrder = useCallback(() => {
    setActivePreset('custom');
    saveOrder(items.map(getId));
  }, [items, getId, saveOrder]);

  return {
    orderedItems,
    moveItem,
    nudgeItem,
    applyPreset,
    resetOrder,
    activePreset,
    draggedIndex,
    setDraggedIndex,
  };
}
