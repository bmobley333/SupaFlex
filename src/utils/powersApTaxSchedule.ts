// src/utils/powersApTaxSchedule.ts
// Progressive Powers-Known AP Soft Tax schedule and calculation engine

/**
 * Returns the effective AP cost to learn the n-th power (1-indexed).
 * Powers 1–6: 1 AP (Base)
 * Powers 7–9: 2 AP (+1 Surcharge)
 * Powers 10–14: 3 AP (+2 Surcharge)
 * Powers 15+: 4 AP (+3 Surcharge)
 */
export function getPowerApCostForIndex(index: number): number {
  if (index <= 0) return 0;
  if (index <= 6) return 1;
  if (index <= 9) return 2;
  if (index <= 14) return 3;
  return 4;
}

/**
 * Calculates the total cumulative AP invested into learning a given number of powers.
 */
export function calculatePowersKnownApCost(totalPowersKnown: number): number {
  let totalAp = 0;
  for (let i = 1; i <= totalPowersKnown; i++) {
    totalAp += getPowerApCostForIndex(i);
  }
  return totalAp;
}

/**
 * Returns descriptive soft tax tier metadata for UI tooltips and AP managers.
 */
export function getPowersSoftTaxBracket(totalPowersKnown: number): {
  tierName: string;
  costPerNextPower: number;
  powersInTierRange: string;
  nextTierStartsAt: number | null;
} {
  const nextIndex = totalPowersKnown + 1;
  if (nextIndex <= 6) {
    return {
      tierName: 'Base Threshold',
      costPerNextPower: 1,
      powersInTierRange: 'Powers 1–6',
      nextTierStartsAt: 7,
    };
  }
  if (nextIndex <= 9) {
    return {
      tierName: 'Tier 1 Scaling',
      costPerNextPower: 2,
      powersInTierRange: 'Powers 7–9',
      nextTierStartsAt: 10,
    };
  }
  if (nextIndex <= 14) {
    return {
      tierName: 'Tier 2 Scaling',
      costPerNextPower: 3,
      powersInTierRange: 'Powers 10–14',
      nextTierStartsAt: 15,
    };
  }
  return {
    tierName: 'Tier 3 Scaling (Max Tax)',
    costPerNextPower: 4,
    powersInTierRange: 'Powers 15+',
    nextTierStartsAt: null,
  };
}
