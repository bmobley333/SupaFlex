// src/utils/canonicalPropagation.ts
// S-Tier Dual-Shield Canonical Entity Propagation Engine:
// 1. Active Database Propagation: Synchronizes updates across all characters in the Supabase database.
// 2. JIT Self-Healing: Reconciles equipped character snapshots against the latest master catalogs on sheet load.

import { CharacterSheetData, AbilitySlot, WeaponSlot, TraitQuirkItem, SimpleGearItem } from '../types/game';

export type CanonicalEntityType =
  | 'path'
  | 'power'
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'gear'
  | 'supplies'
  | 'trait'
  | 'skill'
  | 'chaos_gem';

export interface CanonicalPropagationParams {
  entityType: CanonicalEntityType;
  oldName: string;
  updatedItem: any;
}

export interface CharacterPropagationResult {
  updatedSheet: CharacterSheetData;
  wasModified: boolean;
  changesCount: number;
}

/**
 * Deterministically updates any occurrences of a canonical item inside a character's sheet_data.
 * Preserves player state (checked usage boxes, equip status, custom roll overrides).
 */
export function updateCharacterSheetCanonicalItem(
  sheetData: CharacterSheetData,
  entityType: CanonicalEntityType,
  oldName: string,
  updatedItem: any
): CharacterPropagationResult {
  if (!sheetData || !oldName || !updatedItem) {
    return { updatedSheet: sheetData, wasModified: false, changesCount: 0 };
  }

  const cleanOldName = oldName.trim().toLowerCase();
  const cleanNewName = (updatedItem.name || oldName).trim();
  let wasModified = false;
  let changesCount = 0;

  // Deep clone to prevent unintended mutations
  const updatedSheet: CharacterSheetData = JSON.parse(JSON.stringify(sheetData));

  // --- 1. POWERS ---
  if (entityType === 'power') {
    const updateSlot = (slot: AbilitySlot): AbilitySlot => {
      const slotName = (slot.name || '').trim().toLowerCase();
      const baseName = (slot.base_name || '').trim().toLowerCase();
      if (slotName === cleanOldName || baseName === cleanOldName) {
        wasModified = true;
        changesCount++;
        return {
          ...slot,
          name: cleanNewName,
          base_name: cleanNewName,
          action: updatedItem.action !== undefined ? updatedItem.action : slot.action,
          usage: updatedItem.usage !== undefined ? updatedItem.usage : slot.usage,
          effect: updatedItem.effect !== undefined ? updatedItem.effect : slot.effect,
          ready: updatedItem.ready !== undefined ? updatedItem.ready : slot.ready,
          notes: updatedItem.notes !== undefined ? updatedItem.notes : slot.notes,
          path: updatedItem.path || updatedItem.kit || slot.path,
        };
      }
      return slot;
    };

    if (Array.isArray(updatedSheet.power_slots)) {
      updatedSheet.power_slots = updatedSheet.power_slots.map(updateSlot);
    }
    if (Array.isArray(updatedSheet.character_power_codex)) {
      updatedSheet.character_power_codex = updatedSheet.character_power_codex.map(updateSlot);
    }

    // Handle ability overrides key migration if renamed
    if (cleanOldName !== cleanNewName.toLowerCase() && updatedSheet.ability_overrides) {
      for (const key of Object.keys(updatedSheet.ability_overrides)) {
        if (key.trim().toLowerCase() === cleanOldName) {
          updatedSheet.ability_overrides[cleanNewName] = updatedSheet.ability_overrides[key];
          delete updatedSheet.ability_overrides[key];
          wasModified = true;
        }
      }
    }
  }

  // --- 2. WEAPONS ---
  if (entityType === 'weapon') {
    if (Array.isArray(updatedSheet.weapons)) {
      updatedSheet.weapons = updatedSheet.weapons.map((w: WeaponSlot) => {
        if ((w.name || '').trim().toLowerCase() === cleanOldName) {
          wasModified = true;
          changesCount++;
          return {
            ...w,
            name: cleanNewName,
            atk: updatedItem.atk !== undefined ? updatedItem.atk : w.atk,
            dmg: updatedItem.dmg !== undefined ? updatedItem.dmg : w.dmg,
            max_blk:
              updatedItem.max_block !== undefined
                ? String(updatedItem.max_block)
                : updatedItem.max_blk !== undefined
                ? String(updatedItem.max_blk)
                : w.max_blk,
            requirement: updatedItem.requirement !== undefined ? updatedItem.requirement : w.requirement,
            effect: updatedItem.effect !== undefined ? updatedItem.effect : w.effect,
            notes: updatedItem.notes !== undefined ? updatedItem.notes : w.notes,
          };
        }
        return w;
      });
    }
  }

  // --- 3. ARMOR ---
  if (entityType === 'armor') {
    if (updatedSheet.armor_slot && (updatedSheet.armor_slot.name || '').trim().toLowerCase() === cleanOldName) {
      wasModified = true;
      changesCount++;
      updatedSheet.armor_slot = {
        ...updatedSheet.armor_slot,
        name: cleanNewName,
        ar: updatedItem.ar !== undefined ? Number(updatedItem.ar) || updatedSheet.armor_slot.ar : updatedSheet.armor_slot.ar,
        mr: updatedItem.mr !== undefined ? updatedItem.mr : updatedSheet.armor_slot.mr,
        requirement: updatedItem.requirement !== undefined ? updatedItem.requirement : updatedSheet.armor_slot.requirement,
        cost: updatedItem.cost !== undefined ? updatedItem.cost : updatedSheet.armor_slot.cost,
        effect: updatedItem.effect !== undefined ? updatedItem.effect : updatedSheet.armor_slot.effect,
        notes: updatedItem.notes !== undefined ? updatedItem.notes : updatedSheet.armor_slot.notes,
      };
    }
  }

  // --- 4. SHIELDS ---
  if (entityType === 'shield') {
    if (updatedSheet.shield_slot && (updatedSheet.shield_slot.name || '').trim().toLowerCase() === cleanOldName) {
      wasModified = true;
      changesCount++;
      updatedSheet.shield_slot = {
        ...updatedSheet.shield_slot,
        name: cleanNewName,
        max_block:
          updatedItem.max_block !== undefined
            ? Number(updatedItem.max_block) || updatedSheet.shield_slot.max_block
            : updatedSheet.shield_slot.max_block,
        mr_adjustment: updatedItem.mr !== undefined ? updatedItem.mr : updatedSheet.shield_slot.mr_adjustment,
        requirement: updatedItem.requirement !== undefined ? updatedItem.requirement : updatedSheet.shield_slot.requirement,
        cost: updatedItem.cost !== undefined ? updatedItem.cost : updatedSheet.shield_slot.cost,
        effect: updatedItem.effect !== undefined ? updatedItem.effect : updatedSheet.shield_slot.effect,
        notes: updatedItem.notes !== undefined ? updatedItem.notes : updatedSheet.shield_slot.notes,
      };
    }
    if (Array.isArray(updatedSheet.armory)) {
      updatedSheet.armory = updatedSheet.armory.map((s) => {
        if ((s.name || '').trim().toLowerCase() === cleanOldName) {
          wasModified = true;
          changesCount++;
          return {
            ...s,
            name: cleanNewName,
            max_block:
              updatedItem.max_block !== undefined
                ? Number(updatedItem.max_block) || s.max_block
                : s.max_block,
            mr_adjustment: updatedItem.mr !== undefined ? updatedItem.mr : s.mr_adjustment,
            requirement: updatedItem.requirement !== undefined ? updatedItem.requirement : s.requirement,
            effect: updatedItem.effect !== undefined ? updatedItem.effect : s.effect,
            notes: updatedItem.notes !== undefined ? updatedItem.notes : s.notes,
          };
        }
        return s;
      });
    }
  }

  // --- 5. GEAR / SUPPLIES ---
  if (entityType === 'gear' || entityType === 'supplies') {
    if (Array.isArray(updatedSheet.simple_gear)) {
      updatedSheet.simple_gear = updatedSheet.simple_gear.map((g: SimpleGearItem) => {
        if ((g.name || '').trim().toLowerCase() === cleanOldName) {
          wasModified = true;
          changesCount++;
          return {
            ...g,
            name: cleanNewName,
            category: updatedItem.category || g.category,
            notes: updatedItem.notes !== undefined ? updatedItem.notes : g.notes,
          };
        }
        return g;
      });
    }
    if (Array.isArray(updatedSheet.gear_slots)) {
      updatedSheet.gear_slots = updatedSheet.gear_slots.map((slot) => {
        if ((slot.name || '').trim().toLowerCase() === cleanOldName) {
          wasModified = true;
          changesCount++;
          return {
            ...slot,
            name: cleanNewName,
            effect: updatedItem.effect !== undefined ? updatedItem.effect : slot.effect,
            usage: updatedItem.usage !== undefined ? updatedItem.usage : slot.usage,
          };
        }
        return slot;
      });
    }
  }

  // --- 6. TRAITS ---
  if (entityType === 'trait') {
    if (Array.isArray(updatedSheet.traits_quirks)) {
      updatedSheet.traits_quirks = updatedSheet.traits_quirks.map((t: TraitQuirkItem) => {
        if ((t.name || '').trim().toLowerCase() === cleanOldName) {
          wasModified = true;
          changesCount++;
          return {
            ...t,
            name: cleanNewName,
            effect: updatedItem.effect !== undefined ? updatedItem.effect : t.effect,
            notes: updatedItem.notes !== undefined ? updatedItem.notes : t.notes,
          };
        }
        return t;
      });
    }
  }

  // --- 7. CHAOS GEMS ---
  if (entityType === 'chaos_gem') {
    if (Array.isArray(updatedSheet.chaos_gauntlet_slots)) {
      updatedSheet.chaos_gauntlet_slots = updatedSheet.chaos_gauntlet_slots.map((gem: any) => {
        if (gem && (gem.name || '').trim().toLowerCase() === cleanOldName) {
          wasModified = true;
          changesCount++;
          return {
            ...gem,
            name: cleanNewName,
            effect: updatedItem.effect !== undefined ? updatedItem.effect : gem.effect,
            action: updatedItem.action !== undefined ? updatedItem.action : gem.action,
            usage: updatedItem.usage !== undefined ? updatedItem.usage : gem.usage,
            notes: updatedItem.notes !== undefined ? updatedItem.notes : gem.notes,
          };
        }
        return gem;
      });
    }
  }

  // --- 8. PATHS ---
  if (entityType === 'path') {
    if (cleanOldName !== cleanNewName.toLowerCase()) {
      // Migrate favorite path tables
      if (Array.isArray(updatedSheet.favorite_power_tables)) {
        updatedSheet.favorite_power_tables = updatedSheet.favorite_power_tables.map((p) =>
          p.trim().toLowerCase() === cleanOldName ? cleanNewName : p
        );
      }
      if (Array.isArray(updatedSheet.favorite_trait_kits)) {
        updatedSheet.favorite_trait_kits = updatedSheet.favorite_trait_kits.map((p) =>
          p.trim().toLowerCase() === cleanOldName ? cleanNewName : p
        );
      }
      // Migrate path references in power slots
      const updatePathRef = (slot: AbilitySlot): AbilitySlot => {
        if (slot.path && slot.path.toLowerCase().includes(cleanOldName)) {
          wasModified = true;
          return {
            ...slot,
            path: slot.path.replace(new RegExp(oldName, 'gi'), cleanNewName),
          };
        }
        return slot;
      };
      if (Array.isArray(updatedSheet.power_slots)) {
        updatedSheet.power_slots = updatedSheet.power_slots.map(updatePathRef);
      }
      if (Array.isArray(updatedSheet.character_power_codex)) {
        updatedSheet.character_power_codex = updatedSheet.character_power_codex.map(updatePathRef);
      }
    }
  }

  return { updatedSheet, wasModified, changesCount };
}

/**
 * JIT Self-Healing Reconciler:
 * Cross-references a character's equipped abilities, weapons, armor, shields, and traits
 * against the latest cached master catalogs upon character load in the store.
 */
export function reconcileCanonicalSnapshots(
  sheetData: CharacterSheetData,
  catalogs: {
    powers?: any[];
    weapons?: any[];
    armor?: any[];
    shields?: any[];
    traits?: any[];
    supplies?: any[];
  }
): { updatedSheetData: CharacterSheetData; modifiedCount: number } {
  if (!sheetData) {
    return { updatedSheetData: sheetData, modifiedCount: 0 };
  }

  let modifiedCount = 0;
  const updatedSheet: CharacterSheetData = JSON.parse(JSON.stringify(sheetData));

  // Build O(1) canonical lookup maps
  const powersMap = new Map<string, any>();
  (catalogs.powers || []).forEach((p) => {
    if (p && p.name) powersMap.set(p.name.trim().toLowerCase(), p);
  });

  const weaponsMap = new Map<string, any>();
  (catalogs.weapons || []).forEach((w) => {
    if (w && w.name) weaponsMap.set(w.name.trim().toLowerCase(), w);
  });

  const armorMap = new Map<string, any>();
  (catalogs.armor || []).forEach((a) => {
    if (a && a.name) armorMap.set(a.name.trim().toLowerCase(), a);
  });

  const shieldsMap = new Map<string, any>();
  (catalogs.shields || []).forEach((s) => {
    if (s && s.name) shieldsMap.set(s.name.trim().toLowerCase(), s);
  });

  const traitsMap = new Map<string, any>();
  (catalogs.traits || []).forEach((t) => {
    if (t && t.name) traitsMap.set(t.name.trim().toLowerCase(), t);
  });

  // 1. Reconcile Powers
  const reconcilePower = (slot: AbilitySlot): AbilitySlot => {
    const key = (slot.base_name || slot.name || '').trim().toLowerCase();
    const canon = powersMap.get(key);
    if (!canon) return slot;

    // Check if player has an intentional override for this slot
    const override = updatedSheet.ability_overrides?.[slot.name];
    const canonicalAction = override?.action || canon.action || slot.action;
    const canonicalUsage = override?.usage || canon.usage || slot.usage;
    const canonicalEffect = override?.effect || canon.effect || slot.effect;
    const canonicalReady = canon.ready || canon.ready_category || slot.ready;

    if (
      slot.action !== canonicalAction ||
      slot.usage !== canonicalUsage ||
      slot.effect !== canonicalEffect ||
      slot.ready !== canonicalReady
    ) {
      modifiedCount++;
      return {
        ...slot,
        action: canonicalAction,
        usage: canonicalUsage,
        effect: canonicalEffect,
        ready: canonicalReady,
      };
    }
    return slot;
  };

  if (Array.isArray(updatedSheet.power_slots)) {
    updatedSheet.power_slots = updatedSheet.power_slots.map(reconcilePower);
  }
  if (Array.isArray(updatedSheet.character_power_codex)) {
    updatedSheet.character_power_codex = updatedSheet.character_power_codex.map(reconcilePower);
  }

  // 2. Reconcile Weapons
  if (Array.isArray(updatedSheet.weapons)) {
    updatedSheet.weapons = updatedSheet.weapons.map((w: WeaponSlot) => {
      const key = (w.name || '').trim().toLowerCase();
      const canon = weaponsMap.get(key);
      if (!canon) return w;

      const canonMaxBlk = canon.max_block || canon.max_blk || w.max_blk;
      if (
        w.atk !== canon.atk ||
        w.dmg !== canon.dmg ||
        w.max_blk !== String(canonMaxBlk) ||
        w.requirement !== canon.requirement
      ) {
        modifiedCount++;
        return {
          ...w,
          atk: canon.atk || w.atk,
          dmg: canon.dmg || w.dmg,
          max_blk: String(canonMaxBlk),
          requirement: canon.requirement || w.requirement,
        };
      }
      return w;
    });
  }

  // 3. Reconcile Armor
  if (updatedSheet.armor_slot) {
    const key = (updatedSheet.armor_slot.name || '').trim().toLowerCase();
    const canon = armorMap.get(key);
    if (canon) {
      const canonAr = Number(canon.ar) || updatedSheet.armor_slot.ar;
      if (
        updatedSheet.armor_slot.ar !== canonAr ||
        updatedSheet.armor_slot.mr !== canon.mr ||
        updatedSheet.armor_slot.requirement !== canon.requirement
      ) {
        modifiedCount++;
        updatedSheet.armor_slot = {
          ...updatedSheet.armor_slot,
          ar: canonAr,
          mr: canon.mr || updatedSheet.armor_slot.mr,
          requirement: canon.requirement || updatedSheet.armor_slot.requirement,
        };
      }
    }
  }

  // 4. Reconcile Shield
  if (updatedSheet.shield_slot) {
    const key = (updatedSheet.shield_slot.name || '').trim().toLowerCase();
    const canon = shieldsMap.get(key);
    if (canon) {
      const canonBlock = Number(canon.max_block) || updatedSheet.shield_slot.max_block;
      if (
        updatedSheet.shield_slot.max_block !== canonBlock ||
        updatedSheet.shield_slot.mr_adjustment !== canon.mr ||
        updatedSheet.shield_slot.requirement !== canon.requirement
      ) {
        modifiedCount++;
        updatedSheet.shield_slot = {
          ...updatedSheet.shield_slot,
          max_block: canonBlock,
          mr_adjustment: canon.mr || updatedSheet.shield_slot.mr_adjustment,
          requirement: canon.requirement || updatedSheet.shield_slot.requirement,
        };
      }
    }
  }

  // 5. Reconcile Traits
  if (Array.isArray(updatedSheet.traits_quirks)) {
    updatedSheet.traits_quirks = updatedSheet.traits_quirks.map((t: TraitQuirkItem) => {
      const key = (t.name || '').trim().toLowerCase();
      const canon = traitsMap.get(key);
      if (!canon) return t;

      if (canon.effect && t.effect !== canon.effect) {
        modifiedCount++;
        return {
          ...t,
          effect: canon.effect,
        };
      }
      return t;
    });
  }

  return { updatedSheetData: updatedSheet, modifiedCount };
}

export interface CharacterPurgeResult {
  updatedSheet: CharacterSheetData;
  wasModified: boolean;
  purgedItemsCount: number;
}

/**
 * Deterministically removes all occurrences of a deleted canonical item from a character's sheet_data.
 * Purges from equipped slots, inventories, vaults, overrides, and wishlists.
 */
export function removeCharacterSheetCanonicalItem(
  sheetData: CharacterSheetData,
  entityType: CanonicalEntityType,
  targetName: string,
  targetId?: string | number
): CharacterPurgeResult {
  if (!sheetData || !targetName) {
    return { updatedSheet: sheetData, wasModified: false, purgedItemsCount: 0 };
  }

  const cleanTargetName = targetName.trim().toLowerCase();
  const strId = targetId !== undefined ? String(targetId) : '';
  let wasModified = false;
  let purgedItemsCount = 0;

  // Deep clone to prevent unintended mutations
  const updatedSheet: CharacterSheetData = JSON.parse(JSON.stringify(sheetData));

  // --- 1. POWERS ---
  if (entityType === 'power') {
    const isPowerMatch = (slot: AbilitySlot) => {
      const sName = (slot.name || '').trim().toLowerCase();
      const bName = (slot.base_name || '').trim().toLowerCase();
      return sName === cleanTargetName || bName === cleanTargetName;
    };

    if (Array.isArray(updatedSheet.power_slots)) {
      const initialLen = updatedSheet.power_slots.length;
      updatedSheet.power_slots = updatedSheet.power_slots.filter((slot) => !isPowerMatch(slot));
      if (updatedSheet.power_slots.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.power_slots.length);
      }
    }
    if (Array.isArray(updatedSheet.spell_slots)) {
      const initialLen = updatedSheet.spell_slots.length;
      updatedSheet.spell_slots = updatedSheet.spell_slots.filter((slot) => !isPowerMatch(slot));
      if (updatedSheet.spell_slots.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.spell_slots.length);
      }
    }
    if (Array.isArray(updatedSheet.character_power_codex)) {
      const initialLen = updatedSheet.character_power_codex.length;
      updatedSheet.character_power_codex = updatedSheet.character_power_codex.filter((slot) => !isPowerMatch(slot));
      if (updatedSheet.character_power_codex.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.character_power_codex.length);
      }
    }
    if (updatedSheet.ability_overrides) {
      for (const key of Object.keys(updatedSheet.ability_overrides)) {
        if (key.trim().toLowerCase() === cleanTargetName) {
          delete updatedSheet.ability_overrides[key];
          wasModified = true;
        }
      }
    }
    if (Array.isArray(updatedSheet.starred_powers)) {
      const initialLen = updatedSheet.starred_powers.length;
      updatedSheet.starred_powers = updatedSheet.starred_powers.filter(
        (id) => String(id) !== strId && String(id).toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.starred_powers.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  // --- 2. WEAPONS ---
  if (entityType === 'weapon') {
    const isWeaponMatch = (w: WeaponSlot) => (w.name || '').trim().toLowerCase() === cleanTargetName;
    if (Array.isArray(updatedSheet.weapons)) {
      const initialLen = updatedSheet.weapons.length;
      updatedSheet.weapons = updatedSheet.weapons.filter((w) => !isWeaponMatch(w));
      if (updatedSheet.weapons.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.weapons.length);
      }
    }
    if (Array.isArray(updatedSheet.starred_weapons)) {
      const initialLen = updatedSheet.starred_weapons.length;
      updatedSheet.starred_weapons = updatedSheet.starred_weapons.filter(
        (id) => String(id) !== strId && String(id).toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.starred_weapons.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  // --- 3. ARMOR ---
  if (entityType === 'armor') {
    if (updatedSheet.armor_slot && (updatedSheet.armor_slot.name || '').trim().toLowerCase() === cleanTargetName) {
      delete (updatedSheet as any).armor_slot;
      wasModified = true;
      purgedItemsCount++;
    }
    if (Array.isArray(updatedSheet.wardrobe)) {
      const initialLen = updatedSheet.wardrobe.length;
      updatedSheet.wardrobe = updatedSheet.wardrobe.filter(
        (a) => (a.name || '').trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.wardrobe.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.wardrobe.length);
      }
    }
    if (Array.isArray(updatedSheet.starred_armor)) {
      const initialLen = updatedSheet.starred_armor.length;
      updatedSheet.starred_armor = updatedSheet.starred_armor.filter(
        (id) => String(id) !== strId && String(id).toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.starred_armor.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  // --- 4. SHIELDS ---
  if (entityType === 'shield') {
    if (updatedSheet.shield_slot && (updatedSheet.shield_slot.name || '').trim().toLowerCase() === cleanTargetName) {
      delete (updatedSheet as any).shield_slot;
      wasModified = true;
      purgedItemsCount++;
    }
    if (Array.isArray(updatedSheet.armory)) {
      const initialLen = updatedSheet.armory.length;
      updatedSheet.armory = updatedSheet.armory.filter(
        (s) => (s.name || '').trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.armory.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.armory.length);
      }
    }
    if (Array.isArray(updatedSheet.starred_shields)) {
      const initialLen = updatedSheet.starred_shields.length;
      updatedSheet.starred_shields = updatedSheet.starred_shields.filter(
        (id) => String(id) !== strId && String(id).toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.starred_shields.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  // --- 5. GEAR / SUPPLIES ---
  if (entityType === 'gear' || entityType === 'supplies') {
    if (Array.isArray(updatedSheet.simple_gear)) {
      const initialLen = updatedSheet.simple_gear.length;
      updatedSheet.simple_gear = updatedSheet.simple_gear.filter(
        (g) => (g.name || '').trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.simple_gear.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.simple_gear.length);
      }
    }
    if (Array.isArray(updatedSheet.gear_slots)) {
      const initialLen = updatedSheet.gear_slots.length;
      updatedSheet.gear_slots = updatedSheet.gear_slots.filter(
        (slot) => (slot.name || '').trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.gear_slots.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.gear_slots.length);
      }
    }
    if (Array.isArray(updatedSheet.character_vault)) {
      const initialLen = updatedSheet.character_vault.length;
      updatedSheet.character_vault = updatedSheet.character_vault.filter(
        (item) => (item.name || '').trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.character_vault.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.character_vault.length);
      }
    }
    if (Array.isArray(updatedSheet.starred_gear)) {
      const initialLen = updatedSheet.starred_gear.length;
      updatedSheet.starred_gear = updatedSheet.starred_gear.filter(
        (id) => String(id) !== strId && String(id).toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.starred_gear.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  // --- 6. TRAITS ---
  if (entityType === 'trait') {
    if (Array.isArray(updatedSheet.traits_quirks)) {
      const initialLen = updatedSheet.traits_quirks.length;
      updatedSheet.traits_quirks = updatedSheet.traits_quirks.filter(
        (t) => (t.name || '').trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.traits_quirks.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.traits_quirks.length);
      }
    }
    if (Array.isArray(updatedSheet.starred_traits)) {
      const initialLen = updatedSheet.starred_traits.length;
      updatedSheet.starred_traits = updatedSheet.starred_traits.filter(
        (id) => String(id) !== strId && String(id).toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.starred_traits.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  // --- 7. CHAOS GEMS ---
  if (entityType === 'chaos_gem') {
    if (Array.isArray(updatedSheet.chaos_gauntlet_slots)) {
      updatedSheet.chaos_gauntlet_slots = updatedSheet.chaos_gauntlet_slots.map((slot: any) => {
        if (slot && (slot.name || '').trim().toLowerCase() === cleanTargetName) {
          wasModified = true;
          purgedItemsCount++;
          return {
            ...slot,
            gem: null,
            name: '',
            effect: '',
            action: '',
            usage: '',
          };
        }
        return slot;
      });
    }
  }

  // --- 8. PATHS ---
  if (entityType === 'path') {
    if (Array.isArray(updatedSheet.favorite_power_tables)) {
      const initialLen = updatedSheet.favorite_power_tables.length;
      updatedSheet.favorite_power_tables = updatedSheet.favorite_power_tables.filter(
        (p) => p.trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.favorite_power_tables.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.favorite_power_tables.length);
      }
    }
    if (Array.isArray(updatedSheet.favorite_trait_kits)) {
      const initialLen = updatedSheet.favorite_trait_kits.length;
      updatedSheet.favorite_trait_kits = updatedSheet.favorite_trait_kits.filter(
        (p) => p.trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.favorite_trait_kits.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.favorite_trait_kits.length);
      }
    }
  }

  // --- 9. SKILLS ---
  if (entityType === 'skill') {
    if (Array.isArray(updatedSheet.known_individual_skills)) {
      const initialLen = updatedSheet.known_individual_skills.length;
      updatedSheet.known_individual_skills = updatedSheet.known_individual_skills.filter(
        (s) => s.trim().toLowerCase() !== cleanTargetName
      );
      if (updatedSheet.known_individual_skills.length !== initialLen) {
        wasModified = true;
        purgedItemsCount += (initialLen - updatedSheet.known_individual_skills.length);
      }
    }
    if (Array.isArray(updatedSheet.starred_skills)) {
      const initialLen = updatedSheet.starred_skills.length;
      updatedSheet.starred_skills = updatedSheet.starred_skills.filter(
        (s) => String(s).trim().toLowerCase() !== cleanTargetName && String(s) !== strId
      );
      if (updatedSheet.starred_skills.length !== initialLen) {
        wasModified = true;
      }
    }
  }

  return { updatedSheet, wasModified, purgedItemsCount };
}
