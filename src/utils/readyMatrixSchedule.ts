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
 * All learned powers are ALWAYS all available in SupaFlex (no artificial bucket limits or slot caps).
 */
export const validateReadyMatrix = (
  _readiedPowers: AbilitySlot[] = [],
  level: number = 1
): { valid: boolean; error?: string; arsenalCount: number; mobilityCount: number; config: ReadySlotConfig } => {
  const config = getReadySlotConfig(level);
  return {
    valid: true,
    arsenalCount: 0,
    mobilityCount: 0,
    config,
  };
};

/**
 * Zero-Loss Migration helper: Migrates existing character sheet powers to the Auto-Readied Power Architecture.
 * In accordance with MetaScape Core Rules: "All powers that are learned (for various AP costs) are ALWAYS all available."
 * Merges any powers previously stored in `character_power_codex` into `power_slots` (deduplicating by unique baseName, keeping highest version).
 * Clears `character_power_codex` to empty array [].
 */
export const migrateCharacterPowersToCodex = (sheetData: any): CharacterSheetData => {
  if (!sheetData || typeof sheetData !== 'object') return sheetData;

  const rawPowerSlots: AbilitySlot[] = Array.isArray(sheetData.power_slots) ? sheetData.power_slots : [];
  const rawCodex: AbilitySlot[] = Array.isArray(sheetData.character_power_codex) ? sheetData.character_power_codex : [];

  // Combine all known powers without duplicating by unique baseName
  const allPowersMap = new Map<string, AbilitySlot>();

  for (const p of [...rawPowerSlots, ...rawCodex]) {
    if (!p || !p.name || p.name.trim() === '') continue;
    const cleanName = p.name.trim();
    const versionMatch = cleanName.match(/v(\d+)$/i);
    const version = versionMatch ? parseInt(versionMatch[1], 10) : (p.version || 1);
    const baseName = p.base_name || cleanName.replace(/\s*v\d+$/i, '').trim();
    const key = baseName.toLowerCase();

    const existing = allPowersMap.get(key);
    if (!existing) {
      allPowersMap.set(key, {
        ...p,
        base_name: baseName,
        version,
        is_readied: true,
      });
    } else {
      const existingVersion = existing.version || 1;
      if (version >= existingVersion) {
        allPowersMap.set(key, {
          ...p,
          base_name: baseName,
          version,
          is_readied: true,
        });
      }
    }
  }

  return {
    ...sheetData,
    power_slots: Array.from(allPowersMap.values()),
    character_power_codex: [],
    tactical_pivot_used_in_encounter: false,
  };
};
