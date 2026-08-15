// src/utils/readyMatrixSchedule.ts
// Mathematical tier scaling, validation, and zero-loss migration for the Ready Matrix (Model B)

import { AbilitySlot, Power, PowerReadyType, ReadySlotConfig, CharacterSheetData } from '../types/game';

/**
 * Maps character level to game Tier (1 to 5).
 */
export const getTierFromLevel = (level: number = 1): number => {
  const lvl = Math.max(1, level || 1);
  if (lvl <= 4) return 1;
  if (lvl <= 9) return 2;
  if (lvl <= 14) return 3;
  if (lvl <= 19) return 4;
  return 5;
};

/**
 * Returns the Ready Slot limits, category caps, and cross-category floor for a character level or tier.
 */
export const getReadySlotConfig = (levelOrTier: number = 1): ReadySlotConfig => {
  const tier = levelOrTier > 5 ? getTierFromLevel(levelOrTier) : Math.max(1, Math.min(5, levelOrTier || 1));

  switch (tier) {
    case 1:
      return { tier: 1, totalSlots: 4, maxArsenal: 3, maxMobilityDefense: 3, minFloor: 1 };
    case 2:
      return { tier: 2, totalSlots: 5, maxArsenal: 4, maxMobilityDefense: 4, minFloor: 1 };
    case 3:
      return { tier: 3, totalSlots: 6, maxArsenal: 4, maxMobilityDefense: 4, minFloor: 2 };
    case 4:
      return { tier: 4, totalSlots: 7, maxArsenal: 5, maxMobilityDefense: 5, minFloor: 2 };
    case 5:
    default:
      return { tier: 5, totalSlots: 8, maxArsenal: 5, maxMobilityDefense: 5, minFloor: 3 };
  }
};

/**
 * Categorizes an AbilitySlot or Power into 'primary_arsenal', 'mobility_defense', or 'support_passive'.
 */
export const getPowerReadyCategory = (power: AbilitySlot | Power | null | undefined): PowerReadyType => {
  if (!power) return 'support_passive';

  if (power.ready) {
    if (power.ready === 'primary_arsenal' || power.ready === 'mobility_defense' || power.ready === 'support_passive') {
      return power.ready;
    }
    if ((power.ready as any) === 'contextual_passive') {
      return 'support_passive';
    }
  }

  const action = (power.action || '').trim().toUpperCase();
  const effect = (power.effect || '').toLowerCase();
  const name = (power.name || '').toLowerCase();
  const combined = `${name} ${effect}`;

  // Check explicit passive / reaction actions
  if (action === 'P' || action === 'F') {
    if (combined.includes('def+') || combined.includes('def +') || combined.includes('ar+') || combined.includes('dodge') || combined.includes('parry') || combined.includes('shield') || combined.includes('heal')) {
      return 'mobility_defense';
    }
    return 'support_passive';
  }

  if (action === 'M') {
    return 'mobility_defense';
  }

  if (action === 'A' || action === 'AM') {
    if (combined.includes('heal') || combined.includes('teleport') || combined.includes('dash') || combined.includes('defend') || combined.includes('dodge') || combined.includes('shield') || combined.includes('barrier')) {
      return 'mobility_defense';
    }
    return 'primary_arsenal';
  }

  return 'support_passive';
};

/**
 * Validates the currently readied tactical powers against the character's Tier limits.
 */
export const validateReadyMatrix = (
  readiedPowers: AbilitySlot[] = [],
  level: number = 1
): { valid: boolean; error?: string; arsenalCount: number; mobilityCount: number; config: ReadySlotConfig } => {
  const config = getReadySlotConfig(level);
  const cleanPowers = (readiedPowers || []).filter((p) => p && p.name && p.name.trim() !== '');

  const arsenalPowers = cleanPowers.filter((p) => getPowerReadyCategory(p) === 'primary_arsenal');
  const mobilityPowers = cleanPowers.filter((p) => getPowerReadyCategory(p) === 'mobility_defense');
  const tacticalCount = arsenalPowers.length + mobilityPowers.length;

  const arsenalCount = arsenalPowers.length;
  const mobilityCount = mobilityPowers.length;

  if (tacticalCount > config.totalSlots) {
    return {
      valid: false,
      error: `Ready Matrix exceeds total slot capacity (${tacticalCount}/${config.totalSlots} slots).`,
      arsenalCount,
      mobilityCount,
      config,
    };
  }

  if (arsenalCount > config.maxArsenal) {
    return {
      valid: false,
      error: `Primary / Arsenal exceeds maximum of ${config.maxArsenal} slots for Tier ${config.tier}.`,
      arsenalCount,
      mobilityCount,
      config,
    };
  }

  if (mobilityCount > config.maxMobilityDefense) {
    return {
      valid: false,
      error: `Mobility & Defense exceeds maximum of ${config.maxMobilityDefense} slots for Tier ${config.tier}.`,
      arsenalCount,
      mobilityCount,
      config,
    };
  }

  return {
    valid: true,
    arsenalCount,
    mobilityCount,
    config,
  };
};

/**
 * Zero-Loss Migration helper: Migrates existing character sheet powers to Ready Matrix + Power Codex.
 * Keeps all contextual passives active (0 slots). Keeps tactical powers up to Tier limits.
 * Moves any excess tactical powers safely into `character_power_codex`.
 */
export const migrateCharacterPowersToCodex = (sheetData: any): CharacterSheetData => {
  if (!sheetData || typeof sheetData !== 'object') return sheetData;

  const level = sheetData.level || 1;
  const config = getReadySlotConfig(level);

  const rawPowerSlots: AbilitySlot[] = Array.isArray(sheetData.power_slots) ? sheetData.power_slots : [];
  const rawCodex: AbilitySlot[] = Array.isArray(sheetData.character_power_codex) ? sheetData.character_power_codex : [];

  // Combine all known powers without duplicating by unique name
  const allKnownPowers: AbilitySlot[] = [];
  const seenNames = new Set<string>();

  for (const p of [...rawPowerSlots, ...rawCodex]) {
    if (!p || !p.name || p.name.trim() === '') continue;
    const cleanName = p.name.trim();
    if (!seenNames.has(cleanName)) {
      seenNames.add(cleanName);
      allKnownPowers.push({
        ...p,
        ready: getPowerReadyCategory(p),
      });
    }
  }

  const keptPowerSlots: AbilitySlot[] = [];
  const keptCodexPowers: AbilitySlot[] = [];

  let currentArsenal = 0;
  let currentMobility = 0;

  for (const power of allKnownPowers) {
    const cat = getPowerReadyCategory(power);

    if (cat === 'support_passive' || (cat as any) === 'contextual_passive') {
      // 0-cost: always active on sheet
      keptPowerSlots.push({ ...power, is_readied: true, ready: 'support_passive' });
    } else if (cat === 'primary_arsenal') {
      if (
        currentArsenal < config.maxArsenal &&
        currentArsenal + currentMobility < config.totalSlots
      ) {
        currentArsenal += 1;
        keptPowerSlots.push({ ...power, is_readied: true, ready: cat });
      } else {
        keptCodexPowers.push({ ...power, is_readied: false, ready: cat });
      }
    } else if (cat === 'mobility_defense') {
      if (
        currentMobility < config.maxMobilityDefense &&
        currentArsenal + currentMobility < config.totalSlots
      ) {
        currentMobility += 1;
        keptPowerSlots.push({ ...power, is_readied: true, ready: cat });
      } else {
        keptCodexPowers.push({ ...power, is_readied: false, ready: cat });
      }
    }
  }

  return {
    ...sheetData,
    power_slots: keptPowerSlots,
    character_power_codex: keptCodexPowers,
    tactical_pivot_used_in_encounter: sheetData.tactical_pivot_used_in_encounter ?? false,
  };
};
