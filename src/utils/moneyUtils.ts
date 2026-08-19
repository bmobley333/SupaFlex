// src/utils/moneyUtils.ts

/**
 * Parses cost string or number into total silver value.
 * Gold (g/gp/gold) = 100 silver. Silver (s/sp/silver) = 1 silver.
 * Examples:
 *   "5s" -> 5
 *   "10g" -> 1000
 *   "1g 50s" -> 150
 *   "2g 1s" -> 201
 *   "100s" -> 100
 *   "0" -> 0
 */
export const parseCostToSilver = (costStr?: string | number | null): number => {
  if (costStr === undefined || costStr === null) return 0;
  if (typeof costStr === 'number') return Math.max(0, Math.floor(costStr));
  const str = costStr.toLowerCase().trim();
  if (!str) return 0;

  let totalSilver = 0;

  // Match gold patterns: e.g. "2g", "2gp", "2 gold"
  const goldMatch = str.match(/(\d+)\s*(g|gp|gold)/);
  if (goldMatch) {
    totalSilver += parseInt(goldMatch[1], 10) * 100;
  }

  // Match silver patterns: e.g. "50s", "50sp", "50 silver"
  const silverMatch = str.match(/(\d+)\s*(s|sp|silver)/);
  if (silverMatch) {
    totalSilver += parseInt(silverMatch[1], 10);
  }

  // If no unit matched, check if raw numeric digits exist
  if (!goldMatch && !silverMatch) {
    const rawNum = str.match(/\d+/);
    if (rawNum) {
      totalSilver += parseInt(rawNum[0], 10);
    }
  }

  return Math.max(0, totalSilver);
};

/**
 * Formats a cost string, numeric silver value, or combined currency into
 * standard abbreviated format (e.g. "2g 1s", "12g", "27s", or "0s").
 */
export const formatCostAbbreviated = (costStr?: string | number | null): string => {
  const totalSilver = parseCostToSilver(costStr);
  if (totalSilver <= 0) return '0s';

  const gold = Math.floor(totalSilver / 100);
  const silver = totalSilver % 100;

  if (gold > 0 && silver > 0) {
    return `${gold}g ${silver}s`;
  }
  if (gold > 0) {
    return `${gold}g`;
  }
  return `${silver}s`;
};

export interface DeductFundsResult {
  success: boolean;
  newGold: number;
  newSilver: number;
  totalAvailableSilver: number;
  costInSilver: number;
  shortfallSilver: number;
}

/**
 * Calculates fund deduction and automatic change-making based on:
 * 1 Gold = 100 Silver.
 *
 * Automatically breaks gold into silver when needed and normalizes the
 * final wallet balance so silver remains between 0 and 99s.
 */
export const deductFundsWithChange = (
  currentGold: number = 0,
  currentSilver: number = 0,
  costInSilver: number = 0
): DeductFundsResult => {
  const validGold = Math.max(0, currentGold || 0);
  const validSilver = Math.max(0, currentSilver || 0);
  const validCost = Math.max(0, costInSilver || 0);

  const totalAvailableSilver = validGold * 100 + validSilver;

  if (totalAvailableSilver < validCost) {
    return {
      success: false,
      newGold: validGold,
      newSilver: validSilver,
      totalAvailableSilver,
      costInSilver: validCost,
      shortfallSilver: validCost - totalAvailableSilver,
    };
  }

  const remainingTotalSilver = totalAvailableSilver - validCost;
  const newGold = Math.floor(remainingTotalSilver / 100);
  const newSilver = remainingTotalSilver % 100;

  return {
    success: true,
    newGold,
    newSilver,
    totalAvailableSilver,
    costInSilver: validCost,
    shortfallSilver: 0,
  };
};

/**
 * Checks whether the character has sufficient funds for a given silver cost.
 */
export const hasSufficientFunds = (
  currentGold: number = 0,
  currentSilver: number = 0,
  costInSilver: number = 0
): boolean => {
  const totalAvailableSilver = Math.max(0, currentGold || 0) * 100 + Math.max(0, currentSilver || 0);
  return totalAvailableSilver >= Math.max(0, costInSilver || 0);
};
