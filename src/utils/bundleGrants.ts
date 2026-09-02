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
} from '../types/game';
import { matchesKitFilter, cleanKitName, parseKit } from './kitUtils';

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
    const parsed = parseKit(p.kit || p.table_group);
    return parsed.isTrait && matchesKitFilter(parsed.baseKit, cleanTarget) && parsed.minLevel <= lvl;
  });

  const matchedSkills = catalogSkills.filter((s) => {
    const parsed = parseKit(s.kit || s.table_group);
    return parsed.isTrait && matchesKitFilter(parsed.baseKit, cleanTarget) && parsed.minLevel <= lvl;
  });

  const matchedTraits = catalogTraits.filter((t) => {
    const parsed = parseKit(t.kit || t.table_group);
    return matchesKitFilter(parsed.baseKit, cleanTarget) && parsed.minLevel <= lvl;
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

  // 1. Add Trait Powers to Codex / Vault
  if (grants.powers.length > 0) {
    const existingCodex: AbilitySlot[] = updated.character_power_codex || [];
    const newPowerSlots: AbilitySlot[] = grants.powers
      .filter((gp) => !existingCodex.some((vp) => vp.name.toLowerCase() === gp.name.toLowerCase()))
      .map((gp) => ({
        select: false,
        name: gp.name,
        action: (gp.action || '') as AbilitySlot['action'],
        usage: gp.usage || '',
        effect: gp.effect || '',
        checked: [false, false, false, false, false],
        kit: gp.kit || gp.table_group || `${kitLabel} {Trait}`,
        table_group: gp.kit || gp.table_group || `${kitLabel} {Trait}`,
        discipline: gp.discipline,
        source: `${kitLabel} {Trait}`,
      }));

    if (newPowerSlots.length > 0) {
      updated.character_power_codex = [...existingCodex, ...newPowerSlots];
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
        kit: gt.kit || gt.table_group || `${kitLabel} {Trait}`,
        table_group: gt.kit || gt.table_group || `${kitLabel} {Trait}`,
        source: `${kitLabel} {Trait}`,
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
    const existingCodexNames = new Set((updated.character_power_codex || []).map((p) => p.name.toLowerCase()));
    const existingSkillNames = new Set((updated.known_individual_skills || []).map((s) => s.toLowerCase()));
    const existingTraitNames = new Set((updated.traits_quirks || []).map((t) => t.name.toLowerCase()));

    const freshPowers = grants.powers.filter((p) => !existingCodexNames.has(p.name.toLowerCase()));
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
    const cleanField = bundleField.toLowerCase();
    return cleanField.includes(cleanTarget);
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

