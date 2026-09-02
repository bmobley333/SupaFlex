import { getCategorySlotWeight } from '../types/game';

/**
 * Baseline Loadout Capacity at Level 1 (0 AP cost).
 */
export const BASELINE_LOADOUT_CAPACITY = 4;

/**
 * Calculates total available Loadout Capacity based on number of +2 expansions purchased.
 * Formula: 4 + (expansionsPurchased * 2)
 */
export function calculateTotalLoadoutCapacity(expansionsPurchased: number = 0): number {
  const k = Math.max(0, expansionsPurchased);
  return BASELINE_LOADOUT_CAPACITY + (k * 2);
}

/**
 * Calculates the AP cost for the NEXT +2 Loadout Slots expansion step.
 * The k-th expansion step costs k AP (Expansion 1 = 1 AP, Expansion 2 = 2 AP, etc.).
 */
export function getApCostForNextExpansion(currentExpansions: number = 0): number {
  const k = Math.max(0, currentExpansions);
  return k + 1;
}

/**
 * Calculates the total cumulative AP invested into Loadout Capacity expansions.
 * Formula: Triangular sum = (k * (k + 1)) / 2 AP
 */
export function calculateSpentApOnLoadoutExpansions(expansionsPurchased: number = 0): number {
  const k = Math.max(0, expansionsPurchased);
  return (k * (k + 1)) / 2;
}

/**
 * Returns slot weight for a given item (1, 2, 3, or 4 slots).
 */
export function getItemSlotWeight(item: any): 1 | 2 | 3 | 4 {
  if (!item) return 1;
  if (item.slot_weight) return item.slot_weight as 1 | 2 | 3 | 4;
  return getCategorySlotWeight(item.category || item.rarity);
}

/**
 * Calculates the total Loadout Slots consumed by an array of active loadout items (Artifacts + Exotics).
 * Items occupy: 🍺 Minor = 1 Slot, 🪄 Lesser = 2 Slots, 🪬 Greater = 3 Slots, 💫 Epic = 4 Slots.
 */
export function calculateTotalLoadoutSlotsUsed(items: (any | null | undefined)[]): number {
  let totalSlots = 0;
  for (const item of items) {
    if (!item) continue;
    totalSlots += getItemSlotWeight(item);
  }
  return totalSlots;
}

/**
 * Full schedule row descriptor for displaying the uncapped Loadout Capacity table.
 */
export interface LoadoutScheduleRow {
  step: number;
  label: string;
  totalSlots: number;
  slotsGained: number;
  apCost: number;
  cumulativeAp: number;
}

/**
 * Generates an explicit schedule table array up to a given number of expansion steps (default 10 steps / 24 slots).
 */
export function generateLoadoutScheduleRows(maxSteps: number = 10): LoadoutScheduleRow[] {
  const rows: LoadoutScheduleRow[] = [
    {
      step: 0,
      label: 'Baseline (Level 1)',
      totalSlots: BASELINE_LOADOUT_CAPACITY,
      slotsGained: 0,
      apCost: 0,
      cumulativeAp: 0,
    },
  ];

  for (let k = 1; k <= maxSteps; k++) {
    rows.push({
      step: k,
      label: `Expansion ${k}`,
      totalSlots: calculateTotalLoadoutCapacity(k),
      slotsGained: 2,
      apCost: getApCostForNextExpansion(k - 1),
      cumulativeAp: calculateSpentApOnLoadoutExpansions(k),
    });
  }

  return rows;
}
