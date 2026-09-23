// src/utils/entityHydration.ts
// S-Tier Dynamic Hydration & Graceful Tombstoning Engine:
// 1. Resolves lightweight EntityPointerInstances against in-memory Master Catalogs.
// 2. Overlays player runtime instance state (equipped, slot, qty, charges, mods, overrides).
// 3. Graceful Tombstoning: Protects against missing IDs if an item was removed by Designer/Author.

import {
  EntityPointerInstance,
  EntityCatalogTable,
  Power,
  SupabaseWeapon,
  SupabaseArmor,
  SupabaseShield,
  SupabaseSupply,
  SupabaseTrait,
  SupabaseChaosGem,
  AbilitySlot,
  WeaponSlot,
  ArmorData,
  ShieldData,
  SimpleGearItem,
  TraitQuirkItem,
  CharacterSheetData,
} from '../types/game';

export interface CatalogsContext {
  powers?: Power[];
  weapons?: SupabaseWeapon[];
  armor?: SupabaseArmor[];
  shields?: SupabaseShield[];
  supplies?: SupabaseSupply[];
  traits?: SupabaseTrait[];
  chaosGems?: SupabaseChaosGem[];
  functions?: any[];
  mods?: any[];
}

/**
 * Creates a unique instance ID for a character item
 */
export function generateInstanceId(prefix: string = 'inst'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Normalizes an item into an EntityPointerInstance representation
 */
export function ensurePointerInstance(
  item: any,
  refTable: EntityCatalogTable,
  catalogs?: CatalogsContext
): EntityPointerInstance {
  if (!item) {
    return {
      instance_id: generateInstanceId(refTable),
      ref_table: refTable,
      ref_name: 'Unknown',
    };
  }

  // Already a pointer instance
  if (item.ref_table && item.instance_id) {
    return item as EntityPointerInstance;
  }

  const cleanName = (item.name || item.ref_name || '').trim();
  let foundId = item.ref_id || item.id;

  // If no ID or legacy ID, attempt catalog match by name
  if (!foundId && cleanName && catalogs) {
    const list = (catalogs as any)[refTable];
    if (Array.isArray(list)) {
      const match = list.find((c: any) => (c.name || '').trim().toLowerCase() === cleanName.toLowerCase());
      if (match && match.id) {
        foundId = match.id;
      }
    }
  }

  return {
    instance_id: item.instance_id || generateInstanceId(refTable.substring(0, 3)),
    ref_id: foundId,
    ref_table: refTable,
    ref_name: cleanName,
    equipped: item.equipped !== undefined ? item.equipped : item.ready !== undefined ? item.ready : true,
    slot: item.slot || item.type || undefined,
    qty: typeof item.quantity === 'number' ? item.quantity : typeof item.qty === 'number' ? item.qty : 1,
    attached_mods: Array.isArray(item.attached_mods)
      ? item.attached_mods
      : Array.isArray(item.mods)
      ? item.mods.map((m: any) => (typeof m === 'object' ? m.id || m.name : m))
      : [],
    runtime: {
      usage_checked: item.checked_count || item.usage_checked || 0,
      custom_name: item.custom_name || undefined,
      custom_notes: item.notes || item.custom_notes || undefined,
      action_override: item.action_override || undefined,
      usage_override: item.usage_override || undefined,
      effect_override: item.effect_override || undefined,
    },
    cached_snapshot: { ...item },
    is_archived: false,
  };
}

/**
 * Hydrates a Power AbilitySlot against live powers catalog.
 * Instantly reflects Master updates to effect, action, usage, while preserving player state.
 */
export function hydratePowerSlot(slot: AbilitySlot, powersCatalog: Power[] = []): AbilitySlot {
  if (!slot) return slot;

  const targetName = (slot.base_name || slot.name || '').trim().toLowerCase();
  const targetId = slot.ref_id;

  const master = powersCatalog.find((p) => {
    if (targetId !== undefined && targetId !== null && p.id === Number(targetId)) return true;
    return (p.name || '').trim().toLowerCase() === targetName;
  });

  if (master) {
    return {
      ...slot,
      name: master.name,
      base_name: master.name,
      action: (slot.action_override || master.action || slot.action || '') as AbilitySlot['action'],
      usage: slot.usage_override || master.usage || slot.usage,
      effect: slot.effect_override || master.effect || slot.effect,
      ready: slot.ready !== undefined ? slot.ready : master.ready,
      path: master.path || master.kit || slot.path,
      ref_id: master.id,
      ref_table: 'powers',
      is_archived: false,
    };
  }

  // Not found in catalog -> Graceful Tombstone
  return {
    ...slot,
    is_archived: true,
    archived_notice: '⚠️ Removed from Master Database by Designer',
  };
}

/**
 * Hydrates a WeaponSlot against live weapons catalog.
 * Instantly reflects Master updates to dmg, requirement, atk, max_block, while preserving player state.
 */
export function hydrateWeaponSlot(weapon: WeaponSlot, weaponsCatalog: SupabaseWeapon[] = []): WeaponSlot {
  if (!weapon) return weapon;

  const targetName = (weapon.name || '').trim().toLowerCase();
  const targetId = weapon.ref_id || weapon.id;

  const master = weaponsCatalog.find((w) => {
    if (targetId !== undefined && targetId !== null && w.id === Number(targetId)) return true;
    return (w.name || '').trim().toLowerCase() === targetName;
  });

  if (master) {
    return {
      ...weapon,
      name: master.name,
      dmg: master.dmg || weapon.dmg,
      atk: master.atk || weapon.atk,
      requirement: master.requirement || weapon.requirement,
      max_blk: String(master.max_block || weapon.max_blk),
      cost: master.cost || weapon.cost,
      type: master.type || weapon.type,
      notes: weapon.notes || master.notes,
      ref_id: master.id,
      ref_table: 'weapons',
      is_archived: false,
    };
  }

  // Tombstone fallback
  return {
    ...weapon,
    is_archived: true,
    archived_notice: '⚠️ Removed from Master Database by Designer',
  };
}

/**
 * Hydrates ArmorData against live armor catalog.
 */
export function hydrateArmorData(armor: ArmorData, armorCatalog: SupabaseArmor[] = []): ArmorData {
  if (!armor) return armor;

  const targetName = (armor.name || '').trim().toLowerCase();
  const targetId = (armor as any).ref_id || (armor as any).id;

  const master = armorCatalog.find((a) => {
    if (targetId !== undefined && targetId !== null && a.id === Number(targetId)) return true;
    return (a.name || '').trim().toLowerCase() === targetName;
  });

  if (master) {
    return {
      ...armor,
      name: master.name,
      ar: Number(master.ar) || armor.ar,
      mr: master.mr || armor.mr,
      requirement: master.requirement || armor.requirement,
      cost: master.cost || armor.cost,
      ref_id: master.id,
      ref_table: 'armor',
      is_archived: false,
    };
  }

  return {
    ...armor,
    is_archived: true,
    archived_notice: '⚠️ Removed from Master Database by Designer',
  };
}

/**
 * Hydrates ShieldData against live shields catalog.
 */
export function hydrateShieldData(shield: ShieldData, shieldsCatalog: SupabaseShield[] = []): ShieldData {
  if (!shield) return shield;

  const targetName = (shield.name || '').trim().toLowerCase();
  const targetId = (shield as any).ref_id || (shield as any).id;

  const master = shieldsCatalog.find((s) => {
    if (targetId !== undefined && targetId !== null && s.id === Number(targetId)) return true;
    return (s.name || '').trim().toLowerCase() === targetName;
  });

  if (master) {
    return {
      ...shield,
      name: master.name,
      max_block: Number(master.max_block) || shield.max_block,
      mr_adjustment: master.mr || shield.mr_adjustment,
      requirement: master.requirement || shield.requirement,
      cost: master.cost || shield.cost,
      ref_id: master.id,
      ref_table: 'shields',
      is_archived: false,
    };
  }

  return {
    ...shield,
    is_archived: true,
    archived_notice: '⚠️ Removed from Master Database by Designer',
  };
}

/**
 * Hydrates SimpleGearItem against live supplies catalog.
 */
export function hydrateSimpleGear(gear: SimpleGearItem, suppliesCatalog: SupabaseSupply[] = []): SimpleGearItem {
  if (!gear) return gear;

  const targetName = (gear.name || '').trim().toLowerCase();
  const targetId = (gear as any).ref_id || (gear as any).id;

  const master = suppliesCatalog.find((s) => {
    if (targetId !== undefined && targetId !== null && s.id === Number(targetId)) return true;
    return (s.name || '').trim().toLowerCase() === targetName;
  });

  if (master) {
    return {
      ...gear,
      name: master.name,
      cost: master.cost || gear.cost,
      notes: gear.notes || master.notes,
      ref_id: master.id,
      ref_table: 'supplies',
      is_archived: false,
    };
  }

  return {
    ...gear,
    is_archived: true,
    archived_notice: '⚠️ Removed from Master Database by Designer',
  };
}

/**
 * Hydrates TraitQuirkItem against live traits catalog.
 */
export function hydrateTraitQuirk(trait: TraitQuirkItem, traitsCatalog: SupabaseTrait[] = []): TraitQuirkItem {
  if (!trait) return trait;

  const targetName = (trait.name || '').trim().toLowerCase();
  const targetId = (trait as any).ref_id || (trait as any).id;

  const master = traitsCatalog.find((t) => {
    if (targetId !== undefined && targetId !== null && t.id === Number(targetId)) return true;
    return (t.name || '').trim().toLowerCase() === targetName;
  });

  if (master) {
    return {
      ...trait,
      name: master.name,
      effect: master.effect || trait.effect,
      notes: trait.notes || master.notes,
      ref_id: master.id,
      ref_table: 'traits',
      is_archived: false,
    };
  }

  return {
    ...trait,
    is_archived: true,
    archived_notice: '⚠️ Removed from Master Database by Designer',
  };
}

/**
 * Hydrates all items across a character sheet against master catalogs.
 * Instantly reflects updates to weapons, armor, shields, powers, gear, and traits,
 * while safely preserving all player usage, equipped state, quantities, and custom notes.
 */
export function applyEntityHydration(
  sheet: CharacterSheetData,
  catalogs: {
    powers?: Power[];
    weapons?: SupabaseWeapon[];
    armor?: SupabaseArmor[];
    shields?: SupabaseShield[];
    supplies?: SupabaseSupply[];
    traits?: SupabaseTrait[];
  }
): CharacterSheetData {
  if (!sheet) return sheet;
  const powersList = catalogs.powers || [];
  const weaponsList = catalogs.weapons || [];
  const armorList = catalogs.armor || [];
  const shieldsList = catalogs.shields || [];
  const suppliesList = catalogs.supplies || [];
  const traitsList = catalogs.traits || [];

  const hydrated = { ...sheet };

  if (Array.isArray(hydrated.power_slots)) {
    hydrated.power_slots = hydrated.power_slots.map((s: AbilitySlot) => hydratePowerSlot(s, powersList));
  }
  if (Array.isArray(hydrated.spell_slots)) {
    hydrated.spell_slots = hydrated.spell_slots.map((s: AbilitySlot) => hydratePowerSlot(s, powersList));
  }
  if (Array.isArray(hydrated.character_power_codex)) {
    hydrated.character_power_codex = hydrated.character_power_codex.map((s: AbilitySlot) => hydratePowerSlot(s, powersList));
  }
  if (Array.isArray(hydrated.weapons)) {
    hydrated.weapons = hydrated.weapons.map((w: WeaponSlot) => hydrateWeaponSlot(w, weaponsList));
  }
  if (hydrated.armor_slot) {
    hydrated.armor_slot = hydrateArmorData(hydrated.armor_slot, armorList);
  }
  if (Array.isArray(hydrated.wardrobe)) {
    hydrated.wardrobe = hydrated.wardrobe.map((a: ArmorData) => hydrateArmorData(a, armorList));
  }
  if (hydrated.shield_slot) {
    hydrated.shield_slot = hydrateShieldData(hydrated.shield_slot, shieldsList);
  }
  if (Array.isArray(hydrated.armory)) {
    hydrated.armory = hydrated.armory.map((s: ShieldData) => hydrateShieldData(s, shieldsList));
  }
  if (Array.isArray(hydrated.simple_gear)) {
    hydrated.simple_gear = hydrated.simple_gear.map((g: SimpleGearItem) => hydrateSimpleGear(g, suppliesList));
  }
  if (Array.isArray(hydrated.traits_quirks)) {
    hydrated.traits_quirks = hydrated.traits_quirks.map((t: TraitQuirkItem) => hydrateTraitQuirk(t, traitsList));
  }

  return hydrated;
}

