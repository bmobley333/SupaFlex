import { getCategorySlotWeight } from '../types/game';

/**
 * Baseline Loadout Capacity at Level 1 (0 AP cost).
 */
export const BASELINE_LOADOUT_CAPACITY = 5;

/**
 * Calculates total available Loadout Capacity based on number of +1 expansions purchased.
 * Formula: 5 + expansionsPurchased (1 slot per expansion)
 */
export function calculateTotalLoadoutCapacity(expansionsPurchased: number = 0): number {
  const k = Math.max(0, expansionsPurchased);
  return BASELINE_LOADOUT_CAPACITY + k;
}

/**
 * Calculates the AP cost for the NEXT Loadout Slot expansion step.
 * In the new flat economy, each additional slot costs 1 AP indefinitely.
 */
export function getApCostForNextExpansion(_currentExpansions: number = 0): number {
  return 1;
}

/**
 * Calculates the total cumulative AP invested into Loadout Capacity expansions.
 * Formula: 1 AP per purchased slot = expansionsPurchased AP
 */
export function calculateSpentApOnLoadoutExpansions(expansionsPurchased: number = 0): number {
  return Math.max(0, expansionsPurchased);
}

/**
 * Returns slot weight for a given item (0, 1, 2, 3, or 4 slots).
 */
export function getItemSlotWeight(item: any): 0 | 1 | 2 | 3 | 4 {
  if (!item) return 1;
  if (typeof item.slot_weight === 'number') return item.slot_weight as 0 | 1 | 2 | 3 | 4;
  return getCategorySlotWeight(item.category || item.rarity || item.tier);
}

/**
 * Calculates the total Loadout Slots consumed by an array of active loadout items (Artifacts + Gear Powers).
 * Items occupy: 0 Slots for Free utilities, 1 Slot for standard Gear Powers.
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
 * Generates an explicit schedule table array up to a given number of expansion steps (default 10 steps / 15 slots).
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
      slotsGained: 1,
      apCost: 1,
      cumulativeAp: k,
    });
  }

  return rows;
}
