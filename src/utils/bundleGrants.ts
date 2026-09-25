// src/utils/bundleGrants.ts
// Auto-Grant Kit & Bundle Engine for SupaFlex
// Automatically equips starting {Trait} items across kits and collects hardware bundle modules

import {
  Power,
  SupabaseSkill,
  SupabaseTrait,
  TraitQuirkItem,
  AbilitySlot,
  CharacterSheetData,
  SupabaseArmor,
  SupabaseGear,
  SupabaseWeapon,
  SupabaseShield,
  MagicItem,
  HardwareBundleSubItem,
  WeaponSlot,
  ArmorData,
  ShieldData,
  SupabaseSet,
  SupabasePath,
} from '../types/game';
import { cleanKitName, parseKit, cleanPathName } from './kitUtils';
import { parseItemPaths, isPathStringMatch, getCharacterFreeSets, getCharacterFreeElementNames } from './pathApUtils';

export interface KitTraitGrants {
  kitName: string;
  tableName: string; // Alias for backward compatibility
  powers: Power[];
  skills: SupabaseSkill[];
  traits: SupabaseTrait[];
}

export type TableTraitGrants = KitTraitGrants;

/**
 * Scans all loaded catalog items across kits for items matching a target kit with {Trait} or {Trait[Level]} suffix.
 * Filters grants by character level (only unlocks grants where minLevel <= characterLevel).
 */
export const collectKitTraitGrants = (
  targetKit: string,
  characterLevel: number = 1,
  catalogPowers: Power[] = [],
  catalogSkills: SupabaseSkill[] = [],
  catalogTraits: SupabaseTrait[] = []
): KitTraitGrants => {
  const cleanTarget = cleanKitName(targetKit);
  const lvl = Math.max(1, characterLevel);

  const matchedPowers = catalogPowers.filter((p) => {
    const raw = p.path || p.kit || p.table_group;
    if (!raw) return false;
    const paths = parseItemPaths(raw);
    return paths.some((pathStr) => {
      const parsed = parseKit(pathStr);
      const isFree = pathStr.toLowerCase().includes('{free}') || parsed.isFreeTrait || parsed.isTrait;
      return isFree && isPathStringMatch(parsed.baseKit, cleanTarget) && parsed.minLevel <= lvl;
    });
  });

  const matchedSkills = catalogSkills.filter((s) => {
    const raw = s.path || s.kit || s.table_group;
    if (!raw) return false;
    const paths = parseItemPaths(raw);
    return paths.some((pathStr) => {
      const parsed = parseKit(pathStr);
      const isFree = pathStr.toLowerCase().includes('{free}') || parsed.isFreeTrait || parsed.isTrait;
      return isFree && isPathStringMatch(parsed.baseKit, cleanTarget) && parsed.minLevel <= lvl;
    });
  });

  const matchedTraits = catalogTraits.filter((t) => {
    const rawPath = t.path || t.kit || t.table_group;
    if (!rawPath) return false;
    const paths = parseItemPaths(rawPath);
    return paths.some((p) => {
      const parsed = parseKit(p);
      const isFree = p.toLowerCase().includes('{free}') || parsed.isFreeTrait || parsed.isTrait;
      return isFree && isPathStringMatch(parsed.baseKit, cleanTarget) && parsed.minLevel <= lvl;
    });
  });

  return {
    kitName: cleanTarget,
    tableName: cleanTarget,
    powers: matchedPowers,
    skills: matchedSkills,
    traits: matchedTraits,
  };
};

export const collectTableTraitGrants = collectKitTraitGrants;

/**
 * Merges kit trait grants into a character sheet data object with 0 AP cost.
 */
export const applyKitTraitGrantsToSheet = (
  currentSheet: CharacterSheetData,
  grants: KitTraitGrants
): CharacterSheetData => {
  const updated = { ...currentSheet };
  const kitLabel = grants.kitName || grants.tableName;

  // 1. Add Trait Powers to Active Power Slots
  if (grants.powers.length > 0) {
    const existingSlots: AbilitySlot[] = updated.power_slots || [];
    const newPowerSlots: AbilitySlot[] = grants.powers
      .filter((gp) => !existingSlots.some((vp) => vp.name.toLowerCase() === gp.name.toLowerCase()))
      .map((gp) => ({
        select: false,
        name: gp.name,
        action: (gp.action || '') as AbilitySlot['action'],
        usage: gp.usage || '',
        effect: gp.effect || '',
        checked: [false, false, false, false, false],
        kit: gp.kit || gp.table_group || `${kitLabel} {Free}`,
        table_group: gp.kit || gp.table_group || `${kitLabel} {Free}`,
        discipline: gp.discipline,
        source: `${kitLabel} {Free}`,
        is_readied: true,
      }));

    if (newPowerSlots.length > 0) {
      updated.power_slots = [...existingSlots, ...newPowerSlots];
    }
  }

  // 2. Add Trait Skills to Known Individual Skills
  if (grants.skills.length > 0) {
    const existingSkills = updated.known_individual_skills || [];
    const newSkills = grants.skills
      .map((s) => s.name)
      .filter((sName) => !existingSkills.some((es) => es.toLowerCase() === sName.toLowerCase()));
    if (newSkills.length > 0) {
      updated.known_individual_skills = [...existingSkills, ...newSkills];
    }
  }

  // 3. Add Pure Traits & Quirks
  if (grants.traits.length > 0) {
    const existingTraits = updated.traits_quirks || [];
    const newTraits: TraitQuirkItem[] = grants.traits
      .filter((gt) => !existingTraits.some((et) => et.name.toLowerCase() === gt.name.toLowerCase()))
      .map((gt) => ({
        name: gt.name,
        effect: gt.effect || '',
        notes: gt.notes || '',
        stat_hook: gt.stat_hook,
        kit: gt.path || gt.kit || gt.table_group || `${kitLabel} {Free}`,
        table_group: gt.path || gt.kit || gt.table_group || `${kitLabel} {Free}`,
        source: `${cleanPathName(gt.path || kitLabel)} {Free}`,
        path: gt.path,
        ap_cost: 0,
        is_hidden: false,
      }));

    if (newTraits.length > 0) {
      updated.traits_quirks = [...existingTraits, ...newTraits];
    }
  }

  return updated;
};

export const applyTableTraitGrantsToSheet = applyKitTraitGrantsToSheet;

/**
 * Scans active kits on the character sheet upon leveling up, discovers newly unlocked {Trait[Level]} items,
 * and auto-equips them with 0 AP cost.
 */
export const checkAndAutoEquipLevelUpTraits = (
  currentSheet: CharacterSheetData,
  newLevel: number,
  catalogPowers: Power[] = [],
  catalogSkills: SupabaseSkill[] = [],
  catalogTraits: SupabaseTrait[] = []
): { updatedSheet: CharacterSheetData; newlyGrantedNames: string[] } => {
  let updated = { ...currentSheet, level: newLevel };
  const newlyGrantedNames: string[] = [];

  // 1. Identify all active base kits associated with this character
  const activeKitsSet = new Set<string>();

  (currentSheet.traits_quirks || []).forEach((t) => {
    const k = cleanKitName(t.kit || t.table_group || t.source);
    if (k && k !== 'General') activeKitsSet.add(k);
  });

  (currentSheet.favorite_trait_kits || currentSheet.favorite_trait_tables || []).forEach((k) => {
    const clean = cleanKitName(k);
    if (clean && clean !== 'General') activeKitsSet.add(clean);
  });

  (currentSheet.power_slots || []).concat(currentSheet.character_power_codex || []).forEach((p) => {
    const k = cleanKitName(p.kit || p.table_group);
    if (k && k !== 'General') activeKitsSet.add(k);
  });

  // 2. For each active kit, collect trait grants unlocked at or below newLevel
  activeKitsSet.forEach((kitName) => {
    const grants = collectKitTraitGrants(
      kitName,
      newLevel,
      catalogPowers,
      catalogSkills,
      catalogTraits
    );

    // Filter out already equipped
    const existingPowerNames = new Set((updated.power_slots || []).map((p) => p.name.toLowerCase()));
    const existingSkillNames = new Set((updated.known_individual_skills || []).map((s) => s.toLowerCase()));
    const existingTraitNames = new Set((updated.traits_quirks || []).map((t) => t.name.toLowerCase()));

    const freshPowers = grants.powers.filter((p) => !existingPowerNames.has(p.name.toLowerCase()));
    const freshSkills = grants.skills.filter((s) => !existingSkillNames.has(s.name.toLowerCase()));
    const freshTraits = grants.traits.filter((t) => !existingTraitNames.has(t.name.toLowerCase()));

    if (freshPowers.length > 0 || freshSkills.length > 0 || freshTraits.length > 0) {
      freshPowers.forEach((p) => newlyGrantedNames.push(p.name));
      freshSkills.forEach((s) => newlyGrantedNames.push(s.name));
      freshTraits.forEach((t) => newlyGrantedNames.push(t.name));

      updated = applyKitTraitGrantsToSheet(updated, {
        ...grants,
        powers: freshPowers,
        skills: freshSkills,
        traits: freshTraits,
      });
    }
  });

  return { updatedSheet: updated, newlyGrantedNames };
};

/**
 * Scans equipment catalogs for items tagged with a specific bundle name.
 */
export const collectHardwareBundleSubItems = (
  targetBundleName: string,
  catalogArmor: SupabaseArmor[] = [],
  catalogGear: SupabaseGear[] = [],
  catalogWeapons: SupabaseWeapon[] = [],
  catalogShields: SupabaseShield[] = [],
  catalogExotics: MagicItem[] = []
): HardwareBundleSubItem[] => {
  const cleanTarget = targetBundleName.trim().toLowerCase();
  const subItems: HardwareBundleSubItem[] = [];

  const matchesBundle = (bundleField?: string) => {
    if (!bundleField) return false;
    const parts = bundleField.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    return parts.some((p) => p === cleanTarget);
  };

  catalogArmor.filter((a) => matchesBundle(a.bundle)).forEach((a) => {
    subItems.push({
      name: a.name,
      table: 'armor',
      cost: a.cost,
      notes: a.notes,
    });
  });

  catalogGear.filter((g) => matchesBundle(g.bundle)).forEach((g) => {
    subItems.push({
      name: g.name,
      table: 'gear',
      action: g.action,
      usage: g.usage,
      cost: g.cost,
      notes: g.notes,
    });
  });

  catalogWeapons.filter((w) => matchesBundle(w.bundle)).forEach((w) => {
    subItems.push({
      name: w.name,
      table: 'weapons',
      cost: w.cost,
      notes: w.notes,
    });
  });

  catalogShields.filter((s) => matchesBundle(s.bundle)).forEach((s) => {
    subItems.push({
      name: s.name,
      table: 'shields',
      cost: s.cost,
      notes: s.notes,
    });
  });

  catalogExotics.filter((e) => matchesBundle(e.bundle)).forEach((e) => {
    subItems.push({
      name: e.name,
      table: 'exotics',
      action: e.action || undefined,
      usage: e.usage || undefined,
      tier: e.tier,
      cost: e.cost,
      effect: e.effect || undefined,
      notes: e.notes,
    });
  });

  return subItems;
};

// =========================================================================
// PATH TRAIT ENGINE ALIASES (Paths: Race, Class, Discipline, Specialization)
// =========================================================================
export type PathTraitGrants = KitTraitGrants;
export const collectPathTraitGrants = collectKitTraitGrants;
export const applyPathTraitGrantsToSheet = applyKitTraitGrantsToSheet;

// =========================================================================
// FIRST-CLASS SETS & PATH GRANTS ENGINE (Phase 3 Multi-Catalog 0 AP Free Grants)
// =========================================================================
export interface PathAndSetGrants {
  pathName: string;
  powers: Power[];
  skills: SupabaseSkill[];
  traits: SupabaseTrait[];
  weapons: SupabaseWeapon[];
  armor: SupabaseArmor[];
  shields: SupabaseShield[];
}

/**
 * Scans all game catalogs (Powers, Skills, Traits, Weapons, Armor, Shields) for abilities
 * belonging to Sets tagged {Free} on the given Path or linked directly with {Free} tags.
 * Collects them with 0 AP acquisition status.
 */
export const collectPathAndSetGrants = (
  pathName: string,
  characterLevel: number = 1,
  catalogPowers: Power[] = [],
  catalogSkills: SupabaseSkill[] = [],
  catalogTraits: SupabaseTrait[] = [],
  catalogWeapons: SupabaseWeapon[] = [],
  catalogArmor: SupabaseArmor[] = [],
  catalogShields: SupabaseShield[] = [],
  setsCatalog: SupabaseSet[] = [],
  pathsCatalog: SupabasePath[] = []
): PathAndSetGrants => {
  const cleanPath = cleanPathName(pathName).toLowerCase().trim();
  const knownPathSet = new Set<string>([cleanPath]);

  // 1. Identify all Sets that are {Free} on this path
  const freeSets = getCharacterFreeSets(knownPathSet, setsCatalog, pathsCatalog);

  // 2. Identify all direct abilities that are {Free} on this path in linked_elements
  const freeElementNames = getCharacterFreeElementNames(knownPathSet, pathsCatalog);

  // 3. Harvest legacy trait grants (Powers, Skills, Traits with {Free}/{Trait})
  const baseGrants = collectKitTraitGrants(cleanPath, characterLevel, catalogPowers, catalogSkills, catalogTraits);

  const matchedPowersMap = new Map<string, Power>();
  baseGrants.powers.forEach((p) => matchedPowersMap.set(p.name.toLowerCase().trim(), p));

  const matchedSkillsMap = new Map<string, SupabaseSkill>();
  baseGrants.skills.forEach((s) => matchedSkillsMap.set(s.name.toLowerCase().trim(), s));

  const matchedTraitsMap = new Map<string, SupabaseTrait>();
  baseGrants.traits.forEach((t) => matchedTraitsMap.set(t.name.toLowerCase().trim(), t));

  const matchedWeaponsMap = new Map<string, SupabaseWeapon>();
  const matchedArmorMap = new Map<string, SupabaseArmor>();
  const matchedShieldsMap = new Map<string, SupabaseShield>();

  const itemBelongsToFreeSetOrElement = (name: string, itemSets?: string[] | null) => {
    const cleanItemName = (name || '').toLowerCase().trim();
    if (freeElementNames.has(cleanItemName)) return true;
    if (itemSets && Array.isArray(itemSets) && freeSets.size > 0) {
      for (const s of itemSets) {
        if (s && freeSets.has(cleanPathName(s).toLowerCase().trim())) {
          return true;
        }
      }
    }
    return false;
  };

  // Powers from {Free} sets
  catalogPowers.forEach((p) => {
    if (itemBelongsToFreeSetOrElement(p.name, p.sets)) {
      matchedPowersMap.set(p.name.toLowerCase().trim(), p);
    }
  });

  // Skills from {Free} sets
  catalogSkills.forEach((s) => {
    if (itemBelongsToFreeSetOrElement(s.name, s.sets)) {
      matchedSkillsMap.set(s.name.toLowerCase().trim(), s);
    }
  });

  // Traits from {Free} sets
  catalogTraits.forEach((t) => {
    if (itemBelongsToFreeSetOrElement(t.name, t.sets)) {
      matchedTraitsMap.set(t.name.toLowerCase().trim(), t);
    }
  });

  // Weapons from {Free} sets
  catalogWeapons.forEach((w) => {
    if (itemBelongsToFreeSetOrElement(w.name, w.sets)) {
      matchedWeaponsMap.set(w.name.toLowerCase().trim(), w);
    }
  });

  // Armor from {Free} sets
  catalogArmor.forEach((a) => {
    if (itemBelongsToFreeSetOrElement(a.name, a.sets)) {
      matchedArmorMap.set(a.name.toLowerCase().trim(), a);
    }
  });

  // Shields from {Free} sets
  catalogShields.forEach((s) => {
    if (itemBelongsToFreeSetOrElement(s.name, s.sets)) {
      matchedShieldsMap.set(s.name.toLowerCase().trim(), s);
    }
  });

  return {
    pathName: cleanPath,
    powers: Array.from(matchedPowersMap.values()),
    skills: Array.from(matchedSkillsMap.values()),
    traits: Array.from(matchedTraitsMap.values()),
    weapons: Array.from(matchedWeaponsMap.values()),
    armor: Array.from(matchedArmorMap.values()),
    shields: Array.from(matchedShieldsMap.values()),
  };
};

/**
 * Equips harvested 0 AP {Free} abilities across all 6 catalogs into a character sheet.
 * Guarantees zero duplicate entries, sets ap_cost = 0, and updates free_individual_skills.
 */
export const applyPathAndSetGrantsToSheet = (
  currentSheet: CharacterSheetData,
  grants: PathAndSetGrants
): CharacterSheetData => {
  const updated = { ...currentSheet };
  const pathLabel = cleanPathName(grants.pathName);

  // 1. Add Powers (power_slots) with ap_cost = 0
  if (grants.powers.length > 0) {
    const existingSlots: AbilitySlot[] = updated.power_slots || [];
    const newPowerSlots: AbilitySlot[] = grants.powers
      .filter((gp) => !existingSlots.some((vp) => vp.name.toLowerCase() === gp.name.toLowerCase()))
      .map((gp) => ({
        select: false,
        name: gp.name,
        action: (gp.action || '') as AbilitySlot['action'],
        usage: gp.usage || '',
        effect: gp.effect || '',
        checked: [false, false, false, false, false],
        kit: gp.kit || gp.table_group || `${pathLabel} {Free}`,
        table_group: gp.kit || gp.table_group || `${pathLabel} {Free}`,
        discipline: gp.discipline,
        source: `${pathLabel} {Free}`,
        is_readied: true,
        ap_cost: 0,
      }));

    if (newPowerSlots.length > 0) {
      updated.power_slots = [...existingSlots, ...newPowerSlots];
    }
  }

  // 2. Add Skills (known_individual_skills & free_individual_skills)
  if (grants.skills.length > 0) {
    const existingSkills = updated.known_individual_skills || [];
    const existingFree = updated.free_individual_skills || [];
    const newSkills = grants.skills
      .map((s) => s.name)
      .filter((sName) => !existingSkills.some((es) => es.toLowerCase() === sName.toLowerCase()));

    if (newSkills.length > 0) {
      updated.known_individual_skills = [...existingSkills, ...newSkills];
      updated.free_individual_skills = Array.from(new Set([...existingFree, ...newSkills]));
    }
  }

  // 3. Add Traits (traits_quirks) with ap_cost = 0
  if (grants.traits.length > 0) {
    const existingTraits = updated.traits_quirks || [];
    const newTraits: TraitQuirkItem[] = grants.traits
      .filter((gt) => !existingTraits.some((et) => et.name.toLowerCase() === gt.name.toLowerCase()))
      .map((gt) => ({
        name: gt.name,
        effect: gt.effect || '',
        notes: gt.notes || '',
        stat_hook: gt.stat_hook,
        kit: gt.path || gt.kit || gt.table_group || `${pathLabel} {Free}`,
        table_group: gt.path || gt.kit || gt.table_group || `${pathLabel} {Free}`,
        source: `${cleanPathName(gt.path || pathLabel)} {Free}`,
        path: gt.path,
        ap_cost: 0,
        is_hidden: false,
      }));

    if (newTraits.length > 0) {
      updated.traits_quirks = [...existingTraits, ...newTraits];
    }
  }

  // 4. Add Weapons (weapons) with ap_cost = 0 and sk = true
  if (grants.weapons.length > 0) {
    const existingWeapons: WeaponSlot[] = updated.weapons || [];
    const newWeapons: WeaponSlot[] = grants.weapons
      .filter((gw) => !existingWeapons.some((ew) => ew.name.toLowerCase() === gw.name.toLowerCase()))
      .map((gw) => {
        const rawType = (gw.type || 'Melee').toLowerCase();
        const mhs: 'M' | 'H' | 'S' = rawType.includes('shot') ? 'S' : rawType.includes('hurled') ? 'H' : 'M';
        return {
          id: gw.id ? String(gw.id) : `wpn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: gw.name,
          atk: gw.atk || '💪4',
          dmg: gw.dmg || 'd6',
          max_blk: gw.max_block || '0',
          mhs,
          sk: true,
          ap_cost: 0,
          effect: `${pathLabel} {Free}`,
          notes: gw.notes || '',
        };
      });

    if (newWeapons.length > 0) {
      updated.weapons = [...existingWeapons, ...newWeapons];
    }
  }

  // 5. Add Armor (wardrobe) with ap_cost = 0 and sk = true
  if (grants.armor.length > 0) {
    const existingWardrobe: ArmorData[] = updated.wardrobe || [];
    const newArmor: ArmorData[] = grants.armor
      .filter((ga) => !existingWardrobe.some((ea) => ea.name.toLowerCase() === ga.name.toLowerCase()))
      .map((ga) => ({
        id: ga.id ? String(ga.id) : `arm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: ga.name,
        requirement: ga.requirement || '💪 4',
        ar: parseInt((ga.ar || '4').toString().replace(/\D/g, ''), 10) || 4,
        mr: ga.mr || '12',
        cost: ga.cost || '10s',
        notes: ga.notes || '',
        sk: true,
        ap_cost: 0,
      }));

    if (newArmor.length > 0) {
      updated.wardrobe = [...existingWardrobe, ...newArmor];
    }
  }

  // 6. Add Shields (armory) with ap_cost = 0 and sk = true
  if (grants.shields.length > 0) {
    const existingArmory: ShieldData[] = updated.armory || [];
    const newShields: ShieldData[] = grants.shields
      .filter((gs) => !existingArmory.some((es) => es.name.toLowerCase() === gs.name.toLowerCase()))
      .map((gs) => ({
        id: gs.id ? String(gs.id) : `shd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        equipped: false,
        name: gs.name,
        requirement: gs.requirement || '💪 4',
        max_block: parseInt((gs.max_block || '12').toString().replace(/\D/g, ''), 10) || 12,
        mr_adjustment: gs.mr || '0',
        cost: gs.cost || '5s',
        notes: gs.notes || '',
        sk: true,
        ap_cost: 0,
      }));

    if (newShields.length > 0) {
      updated.armory = [...existingArmory, ...newShields];
    }
  }

  return updated;
};

