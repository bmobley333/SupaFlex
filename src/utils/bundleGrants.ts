// src/utils/bundleGrants.ts
// Auto-Grant Table Bundling Engine for SupaFlex
// Automatically equips starting (Trait) items across all tables (powers, skills, traits, gear, etc.)

import { Power, SupabaseSkill, SupabaseTrait, TraitQuirkItem, AbilitySlot, CharacterSheetData } from '../types/game';
import { isTraitItem, matchesTableGroupFilter, cleanTableGroupName } from './tableGroupUtils';

export interface TableTraitGrants {
  tableName: string;
  powers: Power[];
  skills: SupabaseSkill[];
  traits: SupabaseTrait[];
}

/**
 * Scans all loaded catalog items across tables for items matching a target table group with (Trait) suffix.
 */
export const collectTableTraitGrants = (
  targetTable: string,
  catalogPowers: Power[] = [],
  catalogSkills: SupabaseSkill[] = [],
  catalogTraits: SupabaseTrait[] = []
): TableTraitGrants => {
  const cleanTarget = cleanTableGroupName(targetTable);

  const matchedPowers = catalogPowers.filter(
    (p) => isTraitItem(p) && matchesTableGroupFilter(p.table_group, cleanTarget)
  );

  const matchedSkills = catalogSkills.filter(
    (s) => isTraitItem(s) && matchesTableGroupFilter(s.table_group, cleanTarget)
  );

  const matchedTraits = catalogTraits.filter(
    (t) => matchesTableGroupFilter(t.table_group, cleanTarget)
  );

  return {
    tableName: cleanTarget,
    powers: matchedPowers,
    skills: matchedSkills,
    traits: matchedTraits,
  };
};

/**
 * Merges table trait grants into a character sheet data object with 0 AP cost.
 */
export const applyTableTraitGrantsToSheet = (
  currentSheet: CharacterSheetData,
  grants: TableTraitGrants
): CharacterSheetData => {
  const updated = { ...currentSheet };

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
        table_group: gp.table_group,
        discipline: gp.discipline,
        source: `${grants.tableName} (Trait)`,
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
        type: gt.type || 'trait',
        notes: gt.notes || '',
        flaw_points: gt.flaw_points || 0,
        stat_hook: gt.stat_hook,
        table_group: gt.table_group,
        source: `${grants.tableName} (Trait)`,
      }));
    if (newTraits.length > 0) {
      updated.traits_quirks = [...existingTraits, ...newTraits];
    }
  }

  return updated;
};
