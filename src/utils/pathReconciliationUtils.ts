// src/utils/pathReconciliationUtils.ts
// Universal Path Mastery & SkillSet Bundle AP Rebalancing Engine for SupaFlex
// Implements the Path Mastery Auto-Credit Mandate and SkillSet Bundle Deduplication Mandate

import { Character, CharacterSheetData, AbilitySlot, WeaponSlot, ArmorData, ShieldData, TraitQuirkItem } from '../types/game';
import { cleanPathName } from './kitUtils';
import { getCharacterKnownPaths, evaluateItemAp, isItemInPath } from './pathApUtils';

export interface PathReconciliationResult {
  updatedSheetData: CharacterSheetData;
  totalRefund: number;
  refundLogDetails: string[];
}

export interface SkillsetReconciliationResult {
  updatedIndividualSkills: string[];
  refundedSkills: string[];
  totalRefund: number;
}

/**
 * Reconciles currently owned abilities when a new Path is learned or unlocked.
 * Scans powers, weapons, armor, shields, and traits: any ability previously purchased
 * at out-of-path rates (3 AP or 4 AP) that now matches the new Path is adjusted to
 * In-Path rates (1 AP or 2 AP), and the AP difference is returned for crediting.
 */
export const reconcileAbilitiesOnPathAdded = (
  sheetData: CharacterSheetData,
  newPathName: string,
  character?: Character | null
): PathReconciliationResult => {
  if (!sheetData) {
    return { updatedSheetData: sheetData, totalRefund: 0, refundLogDetails: [] };
  }

  const cleanNewPath = cleanPathName(newPathName).toLowerCase().trim();
  const knownPaths = new Set(getCharacterKnownPaths(character));
  if (cleanNewPath) {
    knownPaths.add(cleanNewPath);
  }

  const rawAttributeDice = sheetData.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd4',
    moxie: 'd4',
  };

  const attributeDice: Record<string, string> = {
    might: rawAttributeDice.might || 'd4',
    motion: rawAttributeDice.motion || 'd4',
    mind: rawAttributeDice.mind || 'd4',
    magic: rawAttributeDice.magic || 'd4',
    moxie: rawAttributeDice.moxie || 'd4',
  };

  let totalRefund = 0;
  const refundLogDetails: string[] = [];

  // 1. Reconcile Powers (power_slots)
  const powerSlots: AbilitySlot[] = Array.isArray(sheetData.power_slots)
    ? sheetData.power_slots.map((p) => {
        if (!p || typeof p.ap_cost !== 'number' || p.ap_cost <= 1) return p;
        const evalResult = evaluateItemAp(
          p.path || (p as any).kit,
          (p as any).requirement,
          attributeDice,
          knownPaths
        );
        if (evalResult.inPath && evalResult.apCost < p.ap_cost) {
          const diff = p.ap_cost - evalResult.apCost;
          totalRefund += diff;
          refundLogDetails.push(`${p.name} (-${diff} AP)`);
          return { ...p, ap_cost: evalResult.apCost };
        }
        return p;
      })
    : [];

  // 2. Reconcile Powers in Codex (character_power_codex)
  const powerCodex: AbilitySlot[] = Array.isArray(sheetData.character_power_codex)
    ? sheetData.character_power_codex.map((p) => {
        if (!p || typeof p.ap_cost !== 'number' || p.ap_cost <= 1) return p;
        const evalResult = evaluateItemAp(
          p.path || (p as any).kit,
          (p as any).requirement,
          attributeDice,
          knownPaths
        );
        if (evalResult.inPath && evalResult.apCost < p.ap_cost) {
          const diff = p.ap_cost - evalResult.apCost;
          totalRefund += diff;
          refundLogDetails.push(`${p.name} (-${diff} AP)`);
          return { ...p, ap_cost: evalResult.apCost };
        }
        return p;
      })
    : [];

  // 3. Reconcile Weapons (weapons)
  const weapons: WeaponSlot[] = Array.isArray(sheetData.weapons)
    ? sheetData.weapons.map((w) => {
        if (!w || !w.sk || typeof w.ap_cost !== 'number' || w.ap_cost <= 1) return w;
        const evalResult = evaluateItemAp(
          w.path,
          w.requirement,
          attributeDice,
          knownPaths,
          w.variantType
        );
        if (evalResult.inPath && evalResult.apCost < w.ap_cost) {
          const diff = w.ap_cost - evalResult.apCost;
          totalRefund += diff;
          refundLogDetails.push(`${w.name} (-${diff} AP)`);
          return { ...w, ap_cost: evalResult.apCost };
        }
        return w;
      })
    : [];

  // 4. Reconcile Wardrobe (Armor)
  let nextArmorSlot = sheetData.armor_slot;
  const wardrobe: ArmorData[] = Array.isArray(sheetData.wardrobe)
    ? sheetData.wardrobe.map((a) => {
        if (!a || !a.sk || typeof a.ap_cost !== 'number' || a.ap_cost <= 1) return a;
        const evalResult = evaluateItemAp(a.path, a.requirement, attributeDice, knownPaths);
        if (evalResult.inPath && evalResult.apCost < a.ap_cost) {
          const diff = a.ap_cost - evalResult.apCost;
          totalRefund += diff;
          refundLogDetails.push(`${a.name} (-${diff} AP)`);
          const updatedArmor = { ...a, ap_cost: evalResult.apCost };
          if (nextArmorSlot && nextArmorSlot.name.toLowerCase() === a.name.toLowerCase()) {
            nextArmorSlot = { ...nextArmorSlot, ap_cost: evalResult.apCost };
          }
          return updatedArmor;
        }
        return a;
      })
    : [];

  // 5. Reconcile Armory (Shields)
  let nextShieldSlot = sheetData.shield_slot;
  const armory: ShieldData[] = Array.isArray(sheetData.armory)
    ? sheetData.armory.map((s) => {
        if (!s || !s.sk || typeof s.ap_cost !== 'number' || s.ap_cost <= 1) return s;
        const evalResult = evaluateItemAp(s.path, s.requirement, attributeDice, knownPaths);
        if (evalResult.inPath && evalResult.apCost < s.ap_cost) {
          const diff = s.ap_cost - evalResult.apCost;
          totalRefund += diff;
          refundLogDetails.push(`${s.name} (-${diff} AP)`);
          const updatedShield = { ...s, ap_cost: evalResult.apCost };
          if (nextShieldSlot && nextShieldSlot.name.toLowerCase() === s.name.toLowerCase()) {
            nextShieldSlot = { ...nextShieldSlot, ap_cost: evalResult.apCost };
          }
          return updatedShield;
        }
        return s;
      })
    : [];

  // 6. Reconcile Traits (traits_quirks)
  const traitsQuirks: TraitQuirkItem[] = Array.isArray(sheetData.traits_quirks)
    ? sheetData.traits_quirks.map((t) => {
        if (!t || typeof t.ap_cost !== 'number' || t.ap_cost <= 1) return t;
        const inPath = isItemInPath(t.path || (t as any).kit, knownPaths);
        if (inPath) {
          const diff = t.ap_cost - 1;
          totalRefund += diff;
          refundLogDetails.push(`${t.name} (-${diff} AP)`);
          return { ...t, ap_cost: 1 };
        }
        return t;
      })
    : [];

  return {
    updatedSheetData: {
      ...sheetData,
      power_slots: powerSlots,
      character_power_codex: powerCodex,
      weapons,
      wardrobe,
      armor_slot: nextArmorSlot,
      armory,
      shield_slot: nextShieldSlot,
      traits_quirks: traitsQuirks,
    },
    totalRefund,
    refundLogDetails,
  };
};

/**
 * Reconciles individual skills when a new SkillSet is learned.
 * Removes constituent skills from `known_individual_skills` if they are NOT
 * already granted by another currently active SkillSet, crediting back 1 AP each.
 */
export const reconcileSkillsOnSkillsetAdded = (
  sheetData: CharacterSheetData,
  skillsInNewSet: string[],
  otherKnownSkillsetsSkills: Set<string>
): SkillsetReconciliationResult => {
  if (!sheetData) {
    return { updatedIndividualSkills: [], refundedSkills: [], totalRefund: 0 };
  }

  const currentIndiv = Array.isArray(sheetData.known_individual_skills)
    ? sheetData.known_individual_skills
    : [];

  const lowerSkillsInNewSet = new Set(skillsInNewSet.map((s) => s.toLowerCase().trim()));
  const refundedSkills: string[] = [];
  const updatedIndividualSkills: string[] = [];

  currentIndiv.forEach((skName) => {
    const lowerName = skName.toLowerCase().trim();
    // If the skill is in the new set and was NOT already granted by another skillset
    if (lowerSkillsInNewSet.has(lowerName) && !otherKnownSkillsetsSkills.has(lowerName)) {
      refundedSkills.push(skName);
    } else {
      updatedIndividualSkills.push(skName);
    }
  });

  return {
    updatedIndividualSkills,
    refundedSkills,
    totalRefund: refundedSkills.length,
  };
};
