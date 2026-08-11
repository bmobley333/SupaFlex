// src/utils/magicSlotSchedule.ts
import { MagicItem, AbilitySlot } from '../types/game';

export interface SlotUpgradeInfo {
  canUpgrade: boolean;
  apCost: number;
  reqLevel: number;
  nextSlotNum: number;
  reason?: string;
}

export interface MagicItemLike {
  name?: string | null;
  title?: string | null;
  effect?: string | null;
  usage?: string | null;
  action?: string | null;
  rarity?: string | null;
  sub?: string | null;
  category?: string | null;
  dropdown?: string | null;
  table_name?: string | null;
  slot_weight?: number | null;
  [key: string]: any;
}

const cleanName = (name: string) => name.replace(/\s*\[[A-Z]+\]$/i, '').trim();

/**
 * Returns the item slot weight (1 to 4) based on item rarity, category, or sub-text.
 * Optional catalog array enables matching item base names against master catalog to extract true rarity if item instance lacks properties.
 * Minor = 1 Slot
 * Lesser = 2 Slots
 * Greater = 3 Slots
 * Relic / Epic = 4 Slots
 */
export const getItemSlotWeight = (item: MagicItemLike, catalog?: MagicItemLike[]): number => {
  if (!item) return 1;

  let itemSub = `${item.rarity || ''} ${item.sub || ''} ${item.table_name || ''} ${item.category || ''} ${item.dropdown || ''}`.trim();
  let explicitWeight = typeof item.slot_weight === 'number' && item.slot_weight >= 1 && item.slot_weight <= 4 ? item.slot_weight : null;

  if (catalog && catalog.length > 0) {
    const rawName = item.name || item.title || '';
    const cleanRaw = cleanName(rawName);
    const baseName = cleanRaw.replace(/\s+v\d+$/i, '').toLowerCase();

    const found = catalog.find((c) => {
      const cRaw = c.name || c.title || '';
      const cClean = cleanName(cRaw);
      const cBase = cClean.replace(/\s+v\d+$/i, '').toLowerCase();
      return cBase === baseName || cClean.toLowerCase().includes(baseName) || baseName.includes(cClean.toLowerCase());
    });

    if (found) {
      if (typeof found.slot_weight === 'number' && found.slot_weight >= 1 && found.slot_weight <= 4) {
        explicitWeight = found.slot_weight;
      }
      const foundSub = `${found.rarity || ''} ${found.sub || ''} ${found.table_name || ''} ${found.category || ''} ${found.dropdown || ''}`.trim();
      itemSub = `${itemSub} ${foundSub}`.trim();
    }
  }

  const fullStr = `${itemSub} ${item.name || item.title || ''}`.toLowerCase();

  if (fullStr.includes('relic') || fullStr.includes('epic') || fullStr.includes('artifact')) {
    return 4;
  }
  if (fullStr.includes('greater')) {
    return 3;
  }
  if (fullStr.includes('lesser')) {
    return 2;
  }
  if (fullStr.includes('minor')) {
    return 1;
  }

  return explicitWeight !== null ? explicitWeight : 1;
};

/**
 * Calculates the maximum allowable magic item slots for a character level.
 */
export const getMaxSlotsForLevel = (level: number): number => {
  const lvl = Math.max(1, level || 1);
  if (lvl === 1) return 3;
  if (lvl <= 3) return 4;
  if (lvl <= 5) return 5;
  if (lvl <= 7) return 6;
  if (lvl <= 9) return 7;
  if (lvl <= 14) return 8;
  if (lvl <= 19) return 9;
  if (lvl <= 29) return 10;
  if (lvl <= 39) return 11;
  if (lvl <= 49) return 12;
  if (lvl <= 69) return 13;
  if (lvl <= 89) return 14;
  return 15;
};

/**
 * Returns the AP cost and level requirement for purchasing the next Magic Item Slot.
 * Base starting slots = 3 (0 AP).
 */
export const getApCostForNextSlot = (currentUnlocked: number = 3, level: number = 1): SlotUpgradeInfo => {
  const current = Math.max(3, currentUnlocked || 3);
  const nextSlot = current + 1;
  const maxAllowedForLevel = getMaxSlotsForLevel(level);

  let reqLevel = 1;
  let apCost = 1;

  if (nextSlot === 4) {
    reqLevel = 2;
    apCost = 1;
  } else if (nextSlot === 5) {
    reqLevel = 4;
    apCost = 1;
  } else if (nextSlot === 6) {
    reqLevel = 6;
    apCost = 1;
  } else if (nextSlot === 7) {
    reqLevel = 8;
    apCost = 1;
  } else if (nextSlot === 8) {
    reqLevel = 10;
    apCost = 1;
  } else if (nextSlot === 9) {
    reqLevel = 15;
    apCost = 2;
  } else if (nextSlot === 10) {
    reqLevel = 20;
    apCost = 2;
  } else if (nextSlot === 11) {
    reqLevel = 30;
    apCost = 2;
  } else if (nextSlot === 12) {
    reqLevel = 40;
    apCost = 2;
  } else if (nextSlot === 13) {
    reqLevel = 50;
    apCost = 3;
  } else if (nextSlot === 14) {
    reqLevel = 70;
    apCost = 3;
  } else if (nextSlot === 15) {
    reqLevel = 90;
    apCost = 3;
  }

  if (nextSlot > 15) {
    return {
      canUpgrade: false,
      apCost: 0,
      reqLevel: 90,
      nextSlotNum: nextSlot,
      reason: 'Maximum magic item slot capacity reached (15 slots max).',
    };
  }

  if (level < reqLevel) {
    return {
      canUpgrade: false,
      apCost,
      reqLevel,
      nextSlotNum: nextSlot,
      reason: `Requires Character Level ${reqLevel} to unlock Slot ${nextSlot}.`,
    };
  }

  if (current >= maxAllowedForLevel) {
    return {
      canUpgrade: false,
      apCost,
      reqLevel,
      nextSlotNum: nextSlot,
      reason: `Requires higher Character Level to unlock Slot ${nextSlot}.`,
    };
  }

  return {
    canUpgrade: true,
    apCost,
    reqLevel,
    nextSlotNum: nextSlot,
  };
};

/**
 * Calculates total magic item slots currently consumed by active equipped loadout.
 * Pass optional catalog to cross-reference item rarities.
 */
export const calculateTotalLoadoutSlotsUsed = (
  spellSlots: AbilitySlot[] = [],
  catalog?: MagicItemLike[]
): number => {
  if (!Array.isArray(spellSlots)) return 0;
  return spellSlots.reduce((sum, slot) => {
    if (!slot || !slot.name || slot.name.trim() === '') return sum;
    const weight = getItemSlotWeight(slot, catalog);
    return sum + weight;
  }, 0);
};

/**
 * Calculates cumulative AP spent on Magic Item Slots for character sheet AP tracking.
 * Base = 3 free slots (0 AP).
 */
export const calculateSpentApOnMagicSlots = (unlockedSlots: number = 3): number => {
  const current = Math.max(3, unlockedSlots || 3);
  let totalSpent = 0;
  for (let s = 4; s <= current; s++) {
    if (s <= 8) totalSpent += 1;
    else if (s <= 12) totalSpent += 2;
    else if (s <= 15) totalSpent += 3;
  }
  return totalSpent;
};

/**
 * Automatically migrates existing character sheet magic items from spell_slots to character_vault
 * if total active slot weight exceeds unlocked_magic_slots (default 3).
 * Keeps items up to unlocked_magic_slots weight in spell_slots (first-come-first-serve);
 * moves excess items into character_vault so zero items are lost.
 */
export const migrateCharacterMagicItemsToVault = (sheetData: any): any => {
  if (!sheetData) return sheetData;

  const unlockedSlots = typeof sheetData.unlocked_magic_slots === 'number' ? sheetData.unlocked_magic_slots : 3;
  const spellSlots: AbilitySlot[] = Array.isArray(sheetData.spell_slots) ? sheetData.spell_slots : [];
  const vault: MagicItem[] = Array.isArray(sheetData.character_vault) ? sheetData.character_vault : [];

  if (spellSlots.length === 0) return sheetData;

  let currentWeight = 0;
  const keptSlots: AbilitySlot[] = [];
  const migratedVaultItems: MagicItem[] = [];

  for (const slot of spellSlots) {
    if (!slot || !slot.name || slot.name.trim() === '') continue;
    const weight = getItemSlotWeight(slot);

    if (currentWeight + weight <= unlockedSlots) {
      currentWeight += weight;
      keptSlots.push(slot);
    } else {
      migratedVaultItems.push({
        id: Date.now() + Math.floor(Math.random() * 10000) + migratedVaultItems.length,
        name: slot.name,
        usage: slot.usage || '1-Enc',
        action: slot.action || 'P',
        effect: slot.effect || '',
        source: 'Migrated from Sheet Loadout',
        created_at: new Date().toISOString(),
        dropdown: null,
        sub: null,
        table_name: null,
        slot_weight: (weight as 1 | 2 | 3 | 4),
      });
    }
  }

  if (migratedVaultItems.length === 0) return sheetData;

  return {
    ...sheetData,
    unlocked_magic_slots: unlockedSlots,
    spell_slots: keptSlots,
    character_vault: [...vault, ...migratedVaultItems],
  };
};
