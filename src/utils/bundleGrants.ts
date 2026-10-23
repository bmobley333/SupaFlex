// src/utils/bundleGrants.ts
// Auto-Grant Kit & Bundle Engine for SupaFlex
// Automatically equips starting {Trait} items across kits and collects hardware bundle modules

import {
  Character,
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
  SimpleGearItem,
  SupabaseSet,
  SupabasePath,
  splitWeaponIntoVariants,
  getCanonicalWeaponBaseName,
} from '../types/game';
import { cleanKitName, parseKit, cleanPathName, isMsoEntry } from './kitUtils';
import { parseItemPaths, isPathStringMatch, getCharacterKnownPaths, getCharacterFreeSets, getCharacterFreeElementNames } from './pathApUtils';
import { calculateWeaponAtk, calculateWeaponDmg } from './pathReconciliationUtils';

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
      .map((gt) => {
        const firstPath = Array.isArray(gt.path) ? gt.path[0] : gt.path;
        const pathStr = firstPath || gt.kit || gt.table_group || `${kitLabel} {Free}`;
        return {
          name: gt.name,
          effect: gt.effect || '',
          notes: gt.notes || '',
          stat_hook: gt.stat_hook,
          kit: pathStr,
          table_group: pathStr,
          source: `${cleanPathName(firstPath || kitLabel)} {Free}`,
          path: gt.path,
          ap_cost: 0,
          is_hidden: false,
        };
      });

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
  skillsets: string[];
  skills: SupabaseSkill[];
  traits: SupabaseTrait[];
  weapons: SupabaseWeapon[];
  armor: SupabaseArmor[];
  shields: SupabaseShield[];
  supplies: SupabaseGear[];
}

/**
 * Scans all game catalogs (Powers, SkillSets, Skills, Traits, Weapons, Armor, Shields, Supplies) for abilities
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
  pathsCatalog: SupabasePath[] = [],
  catalogSupplies: SupabaseGear[] = [],
  isMsoCharacter?: boolean
): PathAndSetGrants => {
  const cleanPath = cleanPathName(pathName).toLowerCase().trim();
  const isSharedInnatePath = cleanPath === 'innate' || cleanPath === 'base' || cleanPath === 'universal';
  const effectiveIsMso = typeof isMsoCharacter === 'boolean' ? isMsoCharacter : isMsoEntry(pathName);
  const hasMsoFlag = typeof isMsoCharacter === 'boolean' || isMsoEntry(pathName);
  const matchesInnateGenre = (itemName: string, isSkill: boolean = false): boolean => {
    if (!hasMsoFlag) return true;
    const itemMso = isMsoEntry(itemName);
    if (effectiveIsMso) {
      if (isSharedInnatePath && isSkill) return true;
      return itemMso;
    }
    return !itemMso;
  };
  const knownPathSet = new Set<string>([cleanPath]);

  // 1. Identify all Sets that are {Free} on this path
  const freeSets = getCharacterFreeSets(knownPathSet, setsCatalog, pathsCatalog);

  // 1b. Identify {Free} SkillSets (Sets whose category is 'Skills')
  const matchedSkillsets: string[] = [];
  setsCatalog.forEach((s) => {
    if (!s || !s.name) return;
    const setClean = cleanPathName(s.name).toLowerCase().trim();
    if (freeSets.has(setClean) && (s.category || '').toLowerCase() === 'skills') {
      matchedSkillsets.push(s.name);
    }
  });

  // 2. Identify all direct abilities that are {Free} on this path
  const allCatalogItems = [
    ...catalogPowers,
    ...catalogSkills,
    ...catalogTraits,
    ...catalogWeapons,
    ...catalogArmor,
    ...catalogShields,
    ...catalogSupplies,
  ];
  const freeElementNames = getCharacterFreeElementNames(knownPathSet, allCatalogItems);

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
  const matchedSuppliesMap = new Map<string, SupabaseGear>();

  const itemBelongsToFreeSetOrElement = (name: string, itemSets?: string[] | null) => {
    const rawItemName = (name || '').replace(/\s*\{[^}]*\}/g, '').toLowerCase().trim();
    if (freeElementNames.has(rawItemName)) return true;
    if (itemSets && Array.isArray(itemSets) && freeSets.size > 0) {
      for (const s of itemSets) {
        if (s && freeSets.has(cleanPathName(s).toLowerCase().trim())) {
          return true;
        }
      }
    }
    return false;
  };

  // Powers from {Free} sets or direct {Free} elements
  catalogPowers.forEach((p) => {
    if (itemBelongsToFreeSetOrElement(p.name, p.sets)) {
      matchedPowersMap.set(p.name.toLowerCase().trim(), p);
    }
  });

  // Skills from {Free} sets or direct {Free} elements
  catalogSkills.forEach((s) => {
    if (itemBelongsToFreeSetOrElement(s.name, s.sets)) {
      matchedSkillsMap.set(s.name.toLowerCase().trim(), s);
    }
  });

  // Traits from {Free} sets or direct {Free} elements
  catalogTraits.forEach((t) => {
    if (itemBelongsToFreeSetOrElement(t.name, t.sets)) {
      matchedTraitsMap.set(t.name.toLowerCase().trim(), t);
    }
  });

  // Weapons from {Free} sets or direct {Free} elements
  catalogWeapons.forEach((w) => {
    if (itemBelongsToFreeSetOrElement(w.name, w.sets)) {
      matchedWeaponsMap.set(w.name.toLowerCase().trim(), w);
    }
  });

  // Armor from {Free} sets or direct {Free} elements
  catalogArmor.forEach((a) => {
    if (itemBelongsToFreeSetOrElement(a.name, a.sets)) {
      matchedArmorMap.set(a.name.toLowerCase().trim(), a);
    }
  });

  // Shields from {Free} sets or direct {Free} elements
  catalogShields.forEach((s) => {
    if (itemBelongsToFreeSetOrElement(s.name, s.sets)) {
      matchedShieldsMap.set(s.name.toLowerCase().trim(), s);
    }
  });

  // Supplies from {Free} sets or direct {Free} elements
  catalogSupplies.forEach((sp) => {
    if (itemBelongsToFreeSetOrElement(sp.name, (sp as any).sets)) {
      matchedSuppliesMap.set(sp.name.toLowerCase().trim(), sp);
    }
  });

  return {
    pathName: cleanPath,
    powers: Array.from(matchedPowersMap.values()).filter((x) => matchesInnateGenre(x.name)),
    skillsets: matchedSkillsets,
    skills: Array.from(matchedSkillsMap.values()).filter((x) => matchesInnateGenre(x.name, true)),
    traits: Array.from(matchedTraitsMap.values()).filter((x) => matchesInnateGenre(x.name)),
    weapons: Array.from(matchedWeaponsMap.values()).filter((x) => matchesInnateGenre(x.name)),
    armor: Array.from(matchedArmorMap.values()).filter((x) => matchesInnateGenre(x.name)),
    shields: Array.from(matchedShieldsMap.values()).filter((x) => matchesInnateGenre(x.name)),
    supplies: Array.from(matchedSuppliesMap.values()).filter((x) => matchesInnateGenre(x.name)),
  };
};

/**
 * Equips harvested 0 AP {Free} abilities across all catalogs into a character sheet.
 * Guarantees zero duplicate entries, heals existing matching entries to ap_cost = 0,
 * and updates free_skillsets and free_individual_skills.
 */
export const applyPathAndSetGrantsToSheet = (
  currentSheet: CharacterSheetData,
  grants: PathAndSetGrants
): CharacterSheetData => {
  const updated = { ...currentSheet };
  const pathLabel = cleanPathName(grants.pathName);
  const attributeDice: Record<string, string> = {
    might: updated.attribute_dice?.might || 'd4',
    motion: updated.attribute_dice?.motion || 'd4',
    mind: updated.attribute_dice?.mind || 'd4',
    magic: updated.attribute_dice?.magic || 'd4',
    moxie: updated.attribute_dice?.moxie || 'd4',
  };

  // 1. Add Powers (power_slots / character_power_codex) with ap_cost = 0
  if (grants.powers.length > 0) {
    const grantPowerNames = new Set(grants.powers.map((gp) => gp.name.toLowerCase().trim()));
    const grantPowerCleanNames = new Set(grants.powers.map((gp) => cleanPathName(gp.name).toLowerCase().trim()));

    const existingSlots: AbilitySlot[] = (updated.power_slots || []).map((vp) => {
      if (!vp || !vp.name) return vp;
      const lower = vp.name.toLowerCase().trim();
      const clean = cleanPathName(vp.name).toLowerCase().trim();
      if (grantPowerNames.has(lower) || grantPowerCleanNames.has(clean)) {
        return { ...vp, ap_cost: 0 };
      }
      return vp;
    });

    const existingCodex: AbilitySlot[] = (updated.character_power_codex || []).map((vp) => {
      if (!vp || !vp.name) return vp;
      const lower = vp.name.toLowerCase().trim();
      const clean = cleanPathName(vp.name).toLowerCase().trim();
      if (grantPowerNames.has(lower) || grantPowerCleanNames.has(clean)) {
        return { ...vp, ap_cost: 0 };
      }
      return vp;
    });

    const getBasePowerKey = (n: string) =>
      cleanPathName(n || '').replace(/\s+v\d+$/i, '').toLowerCase().trim();

    const allExistingPowerNames = new Set(
      [...existingSlots, ...existingCodex]
        .filter((vp) => vp && vp.name)
        .flatMap((vp) => [vp.name.toLowerCase().trim(), getBasePowerKey(vp.name)])
    );

    const newPowerSlots: AbilitySlot[] = grants.powers
      .filter((gp) => !allExistingPowerNames.has(gp.name.toLowerCase().trim()) && !allExistingPowerNames.has(getBasePowerKey(gp.name)))
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
        path: gp.path,
        sets: gp.sets,
        is_readied: true,
        ap_cost: 0,
      }));

    updated.power_slots = [...existingSlots, ...newPowerSlots];
    if (existingCodex.length > 0) {
      updated.character_power_codex = existingCodex;
    }
  }

  // 1b. Add SkillSets (known_skillsets & free_skillsets) with ap_cost = 0
  if (grants.skillsets && grants.skillsets.length > 0) {
    const existingSetList = Array.isArray(updated.known_skillsets) ? [...updated.known_skillsets] : [];
    const existingFreeSetList = Array.isArray(updated.free_skillsets) ? [...updated.free_skillsets] : [];
    const skillsetApCosts = { ...(updated.skillset_ap_costs || {}) };

    grants.skillsets.forEach((setName) => {
      const lower = setName.toLowerCase().trim();
      if (!existingSetList.some((s) => (s || '').toLowerCase().trim() === lower)) {
        existingSetList.push(setName);
      }
      if (!existingFreeSetList.some((s) => (s || '').toLowerCase().trim() === lower)) {
        existingFreeSetList.push(setName);
      }
      skillsetApCosts[lower] = 0;
    });

    updated.known_skillsets = existingSetList;
    updated.free_skillsets = existingFreeSetList;
    updated.skillset_ap_costs = skillsetApCosts;
  }

  // 2. Add Skills (known_individual_skills & free_individual_skills)
  if (grants.skills.length > 0) {
    const existingSkills = Array.isArray(updated.known_individual_skills) ? [...updated.known_individual_skills] : [];
    const existingFree = Array.isArray(updated.free_individual_skills) ? [...updated.free_individual_skills] : [];
    const skillApCosts = { ...(updated.skill_ap_costs || {}) };

    grants.skills.forEach((s) => {
      const sName = s.name;
      const lower = sName.toLowerCase().trim();
      if (!existingSkills.some((es) => (es || '').toLowerCase().trim() === lower)) {
        existingSkills.push(sName);
      }
      if (!existingFree.some((ef) => (ef || '').toLowerCase().trim() === lower)) {
        existingFree.push(sName);
      }
      skillApCosts[lower] = 0;
    });

    updated.known_individual_skills = existingSkills;
    updated.free_individual_skills = existingFree;
    updated.skill_ap_costs = skillApCosts;
  }

  // 3. Add Traits (traits_quirks) with ap_cost = 0
  if (grants.traits.length > 0) {
    const grantTraitNames = new Set(grants.traits.map((gt) => gt.name.toLowerCase().trim()));
    const existingTraits = (updated.traits_quirks || []).map((et) => {
      if (!et || !et.name) return et;
      if (grantTraitNames.has(et.name.toLowerCase().trim())) {
        return { ...et, ap_cost: 0 };
      }
      return et;
    });
    const newTraits: TraitQuirkItem[] = grants.traits
      .filter((gt) => !existingTraits.some((et) => et && et.name && et.name.toLowerCase().trim() === gt.name.toLowerCase().trim()))
      .map((gt) => {
        const firstPath = Array.isArray(gt.path) ? gt.path[0] : gt.path;
        const pathStr = firstPath || gt.kit || gt.table_group || `${pathLabel} {Free}`;
        return {
          name: gt.name,
          effect: gt.effect || '',
          notes: gt.notes || '',
          stat_hook: gt.stat_hook,
          kit: pathStr,
          table_group: pathStr,
          source: `${cleanPathName(firstPath || pathLabel)} {Free}`,
          path: gt.path,
          sets: gt.sets,
          ap_cost: 0,
          is_hidden: false,
        };
      });

    updated.traits_quirks = [...existingTraits, ...newTraits];
  }

  // 4. Add Weapons (weapons) with ap_cost = 0 and sk = true (supporting multi-mode variants)
  if (grants.weapons.length > 0) {
    const grantWeaponBaseKeys = new Set(
      grants.weapons.map((gw) => getCanonicalWeaponBaseName(gw.name).toLowerCase().trim())
    );
    const grantWeaponCleanKeys = new Set(
      grants.weapons.map((gw) => cleanPathName(getCanonicalWeaponBaseName(gw.name)).toLowerCase().trim())
    );

    const existingWeapons: WeaponSlot[] = (updated.weapons || []).map((ew) => {
      if (!ew || !ew.name) return ew;
      const baseKey = getCanonicalWeaponBaseName(ew.name).toLowerCase().trim();
      const cleanKey = cleanPathName(getCanonicalWeaponBaseName(ew.name)).toLowerCase().trim();
      if (grantWeaponBaseKeys.has(baseKey) || grantWeaponCleanKeys.has(cleanKey)) {
        return { ...ew, sk: true, ap_cost: 0 };
      }
      return ew;
    });

    const existingBaseKeys = new Set(
      existingWeapons
        .filter((ew) => ew && ew.name)
        .map((ew) => getCanonicalWeaponBaseName(ew.name).toLowerCase().trim())
    );

    const newWeapons: WeaponSlot[] = [];
    for (const gw of grants.weapons) {
      const baseKey = getCanonicalWeaponBaseName(gw.name).toLowerCase().trim();
      if (existingBaseKeys.has(baseKey)) continue;

      const variants = splitWeaponIntoVariants(gw);
      const isMultiMode = (gw.type || '').includes(',');
      for (const variant of variants) {
        const calculatedAtk = calculateWeaponAtk(variant.name, variant.mhs, attributeDice);
        const isSpecialDmg = variant.dmg === '❌' || gw.dmg === '❌';
        const calculatedDmg = isSpecialDmg ? '❌' : `d${calculateWeaponDmg(variant.name, variant.mhs, attributeDice)}`;
        const cleanBlockNum = variant.max_block ? variant.max_block.replace('🛡️', '') : 'n/a';
        const slotName = isMultiMode ? `${variant.name} (${variant.variantType})` : variant.name;

        newWeapons.push({
          id: `wep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: slotName,
          sk: true,
          mhs: variant.mhs,
          atk: String(calculatedAtk),
          dmg: calculatedDmg,
          max_blk: cleanBlockNum,
          effect: `${pathLabel} {Free}`,
          notes: gw.notes || '',
          cost: gw.cost || '1g',
          path: gw.path,
          sets: gw.sets || [],
          requirement: variant.requirementStr,
          variantType: variant.variantType,
          ap_cost: 0,
        });
      }
    }

    updated.weapons = [...existingWeapons, ...newWeapons];
  }

  // 5. Add Armor (wardrobe) with ap_cost = 0 and sk = true
  if (grants.armor.length > 0) {
    const grantArmorNames = new Set(grants.armor.map((ga) => ga.name.toLowerCase().trim()));
    const grantArmorCleanNames = new Set(grants.armor.map((ga) => cleanPathName(ga.name).toLowerCase().trim()));

    const existingWardrobe: ArmorData[] = (updated.wardrobe || []).map((ea) => {
      if (!ea || !ea.name) return ea;
      const lower = ea.name.toLowerCase().trim();
      const clean = cleanPathName(ea.name).toLowerCase().trim();
      if (grantArmorNames.has(lower) || grantArmorCleanNames.has(clean)) {
        return { ...ea, sk: true, ap_cost: 0 };
      }
      return ea;
    });

    const newArmor: ArmorData[] = grants.armor
      .filter((ga) => !existingWardrobe.some((ea) => ea && ea.name && ea.name.toLowerCase().trim() === ga.name.toLowerCase().trim()))
      .map((ga) => ({
        id: ga.id ? String(ga.id) : `arm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: ga.name,
        requirement: ga.requirement || '💪 4',
        ar: parseInt((ga.ar || '4').toString().replace(/\D/g, ''), 10) || 4,
        mr: ga.mr || '12',
        cost: ga.cost || '10s',
        notes: ga.notes || '',
        path: ga.path,
        sets: ga.sets,
        sk: true,
        ap_cost: 0,
      }));

    updated.wardrobe = [...existingWardrobe, ...newArmor];
  }

  // 6. Add Shields (armory) with ap_cost = 0 and sk = true
  if (grants.shields.length > 0) {
    const grantShieldNames = new Set(grants.shields.map((gs) => gs.name.toLowerCase().trim()));
    const grantShieldCleanNames = new Set(grants.shields.map((gs) => cleanPathName(gs.name).toLowerCase().trim()));

    const existingArmory: ShieldData[] = (updated.armory || []).map((es) => {
      if (!es || !es.name) return es;
      const lower = es.name.toLowerCase().trim();
      const clean = cleanPathName(es.name).toLowerCase().trim();
      if (grantShieldNames.has(lower) || grantShieldCleanNames.has(clean)) {
        return { ...es, sk: true, ap_cost: 0 };
      }
      return es;
    });

    const newShields: ShieldData[] = grants.shields
      .filter((gs) => !existingArmory.some((es) => es && es.name && es.name.toLowerCase().trim() === gs.name.toLowerCase().trim()))
      .map((gs) => ({
        id: gs.id ? String(gs.id) : `shd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        equipped: false,
        name: gs.name,
        requirement: gs.requirement || '💪 4',
        max_block: parseInt((gs.max_block || '12').toString().replace(/\D/g, ''), 10) || 12,
        mr_adjustment: gs.mr || '0',
        cost: gs.cost || '5s',
        notes: gs.notes || '',
        path: gs.path,
        sets: gs.sets,
        sk: true,
        ap_cost: 0,
      }));

    updated.armory = [...existingArmory, ...newShields];
  }

  // 7. Add {Free} Supplies (simple_gear)
  if (grants.supplies && grants.supplies.length > 0) {
    const existingGear: SimpleGearItem[] = Array.isArray(updated.simple_gear) ? [...updated.simple_gear] : [];
    const newGear: SimpleGearItem[] = grants.supplies
      .filter((sp) => !existingGear.some((eg) => eg && eg.name && eg.name.toLowerCase().trim() === sp.name.toLowerCase().trim()))
      .map((sp) => ({
        id: `gear_free_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: sp.name,
        qty: 1,
        cost: '0s',
        notes: sp.notes || (sp as any).effect || `${pathLabel} {Free}`,
        category: sp.category || 'Supplies',
      }));
    if (newGear.length > 0) {
      updated.simple_gear = [...existingGear, ...newGear];
    }
  }

  return updated;
};

/**
 * Reconciles all 0 AP ({Free}) Path & Set grants across every path known by the character
 * (Innate, Universal, Race, Class, and favorite_trait_kits).
 */
export const reconcileAllCharacterFreeGrants = (
  sheetData: CharacterSheetData,
  character: Character | null | undefined,
  catalogs: {
    powers?: Power[];
    skills?: SupabaseSkill[];
    traits?: SupabaseTrait[];
    weapons?: SupabaseWeapon[];
    armor?: SupabaseArmor[];
    shields?: SupabaseShield[];
    sets?: SupabaseSet[];
    paths?: SupabasePath[];
    supplies?: SupabaseGear[];
  }
): CharacterSheetData => {
  if (!sheetData || !character) return sheetData;
  const knownPaths = getCharacterKnownPaths({
    ...character,
    sheet_data: sheetData,
  } as Character);
  if (knownPaths.size === 0) return sheetData;

  let currentSheet = { ...sheetData };
  const level = currentSheet.level || 1;
  const isMsoChar = Boolean(
    isMsoEntry(character.race) ||
      isMsoEntry(character.class) ||
      (currentSheet.favorite_trait_kits || []).some((k) => isMsoEntry(k))
  );

  for (const kp of knownPaths) {
    const grants = collectPathAndSetGrants(
      kp,
      level,
      catalogs.powers || [],
      catalogs.skills || [],
      catalogs.traits || [],
      catalogs.weapons || [],
      catalogs.armor || [],
      catalogs.shields || [],
      catalogs.sets || [],
      catalogs.paths || [],
      catalogs.supplies || [],
      isMsoChar
    );
    currentSheet = applyPathAndSetGrantsToSheet(currentSheet, grants);
  }

  return currentSheet;
};

