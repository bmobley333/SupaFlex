// src/utils/pathReconciliationUtils.ts
// Universal Path Mastery & SkillSet Bundle AP Rebalancing Engine for SupaFlex
// Implements the Path Mastery Auto-Credit Mandate, SkillSet Bundle Deduplication Mandate,
// Requirement Surcharge Auto-Refund Engine, and {Free} 0-AP Path Grant Reconciler.

import { Character, CharacterSheetData, AbilitySlot, WeaponSlot, ArmorData, ShieldData, TraitQuirkItem, AttributeKey, DieRating, SupabaseTrait } from '../types/game';
import { cleanPathName, parseKit, cleanKitName } from './kitUtils';
import { getCharacterKnownPaths, evaluateItemAp, isItemInPath, parseItemPaths, getCharacterMatchingPath, isPathStringMatch } from './pathApUtils';

export interface PathReconciliationResult {
  updatedSheetData: CharacterSheetData;
  totalRefund: number;
  refundLogDetails: string[];
}

export interface EquipmentReconciliationResult {
  updatedSheetData: CharacterSheetData;
  totalRefund: number;
  refundLogDetails: string[];
}

export interface SkillsetReconciliationResult {
  updatedIndividualSkills: string[];
  refundedSkills: string[];
  totalRefund: number;
}

const DIE_SCALE = [4, 6, 8, 10, 12];

export const getStepDownDie = (num: number): number => {
  const idx = DIE_SCALE.indexOf(num);
  if (idx > 0) return DIE_SCALE[idx - 1];
  return 4;
};

export const getDieNum = (die?: string): number => {
  if (!die) return 4;
  const num = parseInt(die.replace(/^d/i, ''), 10);
  return isNaN(num) ? 4 : num;
};

export const calculateWeaponAtk = (name: string, mhsCategory: string | undefined, attributeDice: Record<string, string>): number => {
  const cleanName = (name || '').toLowerCase();
  let baseVal = getDieNum(attributeDice?.might);
  const cat = (mhsCategory || '').trim().toLowerCase();
  if (cat.startsWith('h')) {
    baseVal = getDieNum(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNum(attributeDice?.mind);
  }

  if (cleanName.includes('throw object') || cleanName === 'throw') {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

export const calculateWeaponDmg = (name: string, mhsCategory: string | undefined, attributeDice: Record<string, string>): number => {
  const cleanName = (name || '').toLowerCase();
  let baseVal = getDieNum(attributeDice?.might);
  const cat = (mhsCategory || '').trim().toLowerCase();
  if (cat.startsWith('h')) {
    baseVal = getDieNum(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNum(attributeDice?.mind);
  }

  if (cleanName.includes('brawl') || cleanName.includes('unarmed') || cleanName.includes('improvised')) {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

/**
 * Reconciles currently owned abilities when a new Path is learned or unlocked.
 * Scans powers, weapons, armor, shields, and traits:
 * 1. If an ability is granted {Free} (0 AP) in the new Path, its entire AP cost is refunded and set to 0 AP.
 * 2. If an ability was purchased at Out-of-Path rates (3 AP or 4 AP) and now matches the new Path,
 *    it is adjusted down to In-Path rates (1 AP or 2 AP), and the difference is refunded.
 */
export const reconcileAbilitiesOnPathAdded = (
  sheetData: CharacterSheetData,
  newPathName: string,
  character?: Character | null,
  freeGrantNames?: Set<string>
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

  const isFreeGrant = (rawKitOrPath?: string | null, rawSource?: string | null, name?: string): boolean => {
    if (freeGrantNames && name && freeGrantNames.has(name.toLowerCase().trim())) {
      return true;
    }
    const target = rawKitOrPath || '';
    const parsed = parseKit(target);
    if (parsed.isTrait || parsed.isFreeTrait || (rawSource && rawSource.toLowerCase().includes('{free}'))) {
      const base = cleanKitName(parsed.baseKit).toLowerCase().trim();
      if (isPathStringMatch(base, cleanNewPath)) {
        return true;
      }
    }
    return false;
  };

  // 1. Reconcile Powers (power_slots)
  const powerSlots: AbilitySlot[] = Array.isArray(sheetData.power_slots)
    ? sheetData.power_slots.map((p) => {
        if (!p || typeof p.ap_cost !== 'number' || p.ap_cost <= 0) return p;

        if (isFreeGrant(p.path || (p as any).kit, (p as any).source, p.name)) {
          const diff = p.ap_cost;
          totalRefund += diff;
          refundLogDetails.push(`${p.name} (-${diff} AP Free Grant)`);
          return {
            ...p,
            ap_cost: 0,
            source: `${cleanNewPath} {Free}`,
            kit: `${cleanNewPath} {Free}`,
          };
        }

        if (p.ap_cost <= 1) return p;
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
        if (!p || typeof p.ap_cost !== 'number' || p.ap_cost <= 0) return p;

        if (isFreeGrant(p.path || (p as any).kit, (p as any).source, p.name)) {
          const diff = p.ap_cost;
          totalRefund += diff;
          refundLogDetails.push(`${p.name} (-${diff} AP Free Grant)`);
          return {
            ...p,
            ap_cost: 0,
            source: `${cleanNewPath} {Free}`,
            kit: `${cleanNewPath} {Free}`,
          };
        }

        if (p.ap_cost <= 1) return p;
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
        if (!w || !w.sk || typeof w.ap_cost !== 'number' || w.ap_cost <= 0) return w;

        if (isFreeGrant(w.path, undefined, w.name)) {
          const diff = w.ap_cost;
          totalRefund += diff;
          refundLogDetails.push(`${w.name} (-${diff} AP Free Grant)`);
          return { ...w, ap_cost: 0 };
        }

        if (w.ap_cost <= 1) return w;
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
        if (!a || !a.sk || typeof a.ap_cost !== 'number' || a.ap_cost <= 0) return a;

        if (isFreeGrant(a.path, undefined, a.name)) {
          const diff = a.ap_cost;
          totalRefund += diff;
          refundLogDetails.push(`${a.name} (-${diff} AP Free Grant)`);
          const updatedArmor = { ...a, ap_cost: 0 };
          if (nextArmorSlot && nextArmorSlot.name.toLowerCase() === a.name.toLowerCase()) {
            nextArmorSlot = { ...nextArmorSlot, ap_cost: 0 };
          }
          return updatedArmor;
        }

        if (a.ap_cost <= 1) return a;
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
        if (!s || !s.sk || typeof s.ap_cost !== 'number' || s.ap_cost <= 0) return s;

        if (isFreeGrant(s.path, undefined, s.name)) {
          const diff = s.ap_cost;
          totalRefund += diff;
          refundLogDetails.push(`${s.name} (-${diff} AP Free Grant)`);
          const updatedShield = { ...s, ap_cost: 0 };
          if (nextShieldSlot && nextShieldSlot.name.toLowerCase() === s.name.toLowerCase()) {
            nextShieldSlot = { ...nextShieldSlot, ap_cost: 0 };
          }
          return updatedShield;
        }

        if (s.ap_cost <= 1) return s;
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
        if (!t || typeof t.ap_cost !== 'number' || t.ap_cost <= 0) return t;

        if (isFreeGrant(t.path || (t as any).kit, (t as any).source, t.name)) {
          const diff = t.ap_cost;
          totalRefund += diff;
          refundLogDetails.push(`${t.name} (-${diff} AP Free Grant)`);
          return {
            ...t,
            ap_cost: 0,
            source: `${cleanNewPath} {Free}`,
            kit: `${cleanNewPath} {Free}`,
          };
        }

        if (t.ap_cost <= 1) return t;
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
 * Reconciles weapons, armor, and shields whenever a character's attributes change
 * (via vertical die increase or downtime reshuffle/swap).
 * 
 * 1. Unmet Requirement Auto-Refund: Any item previously purchased at unmet requirement rates
 *    (2 AP In-Path or 4 AP Out-of-Path) that now meets requirements has its +1 AP surcharge
 *    refunded and ap_cost decreased by 1.
 * 2. Attribute Scaling & Legacy Healing: Combat stats always spec cleanly to the character's
 *    current attributes without artificial downscaled penalties (-1 die, -2 AR, -4 Blk).
 *    Any legacy items containing "(Downscaled...)" are automatically healed to native stats.
 */
export const reconcileEquipmentOnAttributesChanged = (
  sheetData: CharacterSheetData,
  newAttributeDice: Record<string, string>,
  character?: Character | null
): EquipmentReconciliationResult => {
  if (!sheetData) {
    return { updatedSheetData: sheetData, totalRefund: 0, refundLogDetails: [] };
  }

  const rawDice = newAttributeDice || sheetData.attribute_dice || {};
  const attributeDice: Record<AttributeKey, DieRating> = {
    might: (rawDice.might || 'd4') as DieRating,
    motion: (rawDice.motion || 'd4') as DieRating,
    mind: (rawDice.mind || 'd4') as DieRating,
    magic: (rawDice.magic || 'd4') as DieRating,
    moxie: (rawDice.moxie || 'd4') as DieRating,
  };

  const knownPaths = new Set(getCharacterKnownPaths(character));
  let totalRefund = 0;
  const refundLogDetails: string[] = [];

  // 1. Reconcile Weapons
  const weapons: WeaponSlot[] = Array.isArray(sheetData.weapons)
    ? sheetData.weapons.map((w) => {
        if (!w || !w.sk || typeof w.ap_cost !== 'number') return w;
        const evalResult = evaluateItemAp(
          w.path,
          w.requirement,
          attributeDice,
          knownPaths,
          w.variantType
        );

        let updatedApCost = w.ap_cost;
        if (evalResult.meetsReq) {
          // If was previously burdened by unmet requirement surcharge (2 AP In-Path or 4 AP Out-of-Path)
          if (evalResult.inPath && w.ap_cost > 1) {
            const diff = w.ap_cost - 1;
            totalRefund += diff;
            refundLogDetails.push(`${w.name} (-${diff} AP, Requirement Met)`);
            updatedApCost = 1;
          } else if (!evalResult.inPath && w.ap_cost > 3) {
            const diff = w.ap_cost - 3;
            totalRefund += diff;
            refundLogDetails.push(`${w.name} (-${diff} AP, Requirement Met)`);
            updatedApCost = 3;
          }
        }

        // Always calculate Attack and Damage at current attribute ratings (no -1 die step down)
        const nativeAtk = calculateWeaponAtk(w.name, w.mhs, attributeDice);
        const nativeDmg = w.dmg === '❌' ? '❌' : String(calculateWeaponDmg(w.name, w.mhs, attributeDice));
        const cleanEffect = (w.effect || '')
          .replace(/,\s*Downscaled/gi, '')
          .replace(/\s*\(Downscaled\)/gi, '')
          .trim();

        return {
          ...w,
          ap_cost: updatedApCost,
          atk: String(nativeAtk),
          dmg: nativeDmg,
          effect: cleanEffect,
        };
      })
    : [];

  // 2. Reconcile Armor
  let nextArmorSlot = sheetData.armor_slot;
  const wardrobe: ArmorData[] = Array.isArray(sheetData.wardrobe)
    ? sheetData.wardrobe.map((a) => {
        if (!a || !a.sk || typeof a.ap_cost !== 'number') return a;
        const evalResult = evaluateItemAp(a.path, a.requirement, attributeDice, knownPaths);
        const isDownscaled = Boolean(a.effect && a.effect.toLowerCase().includes('downscaled'));

        let updatedApCost = a.ap_cost;
        if (evalResult.meetsReq) {
          if (evalResult.inPath && a.ap_cost > 1) {
            const diff = a.ap_cost - 1;
            totalRefund += diff;
            refundLogDetails.push(`${a.name} (-${diff} AP, Requirement Met)`);
            updatedApCost = 1;
          } else if (!evalResult.inPath && a.ap_cost > 3) {
            const diff = a.ap_cost - 3;
            totalRefund += diff;
            refundLogDetails.push(`${a.name} (-${diff} AP, Requirement Met)`);
            updatedApCost = 3;
          }
        }

        // Restore any legacy downscaled AR (-2 AR) back to standard
        let restoredAr = a.ar || 0;
        if (isDownscaled) {
          restoredAr = Math.min(10, restoredAr + 2);
        }

        const cleanEffect = (a.effect || '')
          .replace(/\s*\(Downscaled\s*-2\s*AR\)/gi, '')
          .replace(/\s*\(Downscaled\)/gi, '')
          .trim();

        const updatedArmor = {
          ...a,
          ap_cost: updatedApCost,
          ar: restoredAr,
          effect: cleanEffect,
        };

        if (nextArmorSlot && nextArmorSlot.name.toLowerCase() === a.name.toLowerCase()) {
          nextArmorSlot = {
            ...nextArmorSlot,
            ap_cost: updatedApCost,
            ar: restoredAr,
            effect: cleanEffect,
          };
        }

        return updatedArmor;
      })
    : [];

  // 3. Reconcile Shields
  let nextShieldSlot = sheetData.shield_slot;
  const armory: ShieldData[] = Array.isArray(sheetData.armory)
    ? sheetData.armory.map((s) => {
        if (!s || !s.sk || typeof s.ap_cost !== 'number') return s;
        const evalResult = evaluateItemAp(s.path, s.requirement, attributeDice, knownPaths);
        const isDownscaled = Boolean(s.effect && s.effect.toLowerCase().includes('downscaled'));

        let updatedApCost = s.ap_cost;
        if (evalResult.meetsReq) {
          if (evalResult.inPath && s.ap_cost > 1) {
            const diff = s.ap_cost - 1;
            totalRefund += diff;
            refundLogDetails.push(`${s.name} (-${diff} AP, Requirement Met)`);
            updatedApCost = 1;
          } else if (!evalResult.inPath && s.ap_cost > 3) {
            const diff = s.ap_cost - 3;
            totalRefund += diff;
            refundLogDetails.push(`${s.name} (-${diff} AP, Requirement Met)`);
            updatedApCost = 3;
          }
        }

        // Restore any legacy downscaled Block Cap (-4 Blk) back to standard
        let restoredBlock = typeof s.max_block === 'number'
          ? s.max_block
          : parseInt(String(s.max_block || 8).replace(/\D/g, ''), 10) || 8;
        if (isDownscaled) {
          restoredBlock = Math.min(20, restoredBlock + 4);
        }

        const cleanEffect = (s.effect || '')
          .replace(/\s*\(Downscaled\s*-4\s*Blk\)/gi, '')
          .replace(/\s*\(Downscaled\)/gi, '')
          .trim();

        const updatedShield = {
          ...s,
          ap_cost: updatedApCost,
          max_block: restoredBlock,
          effect: cleanEffect,
        };

        if (nextShieldSlot && nextShieldSlot.name.toLowerCase() === s.name.toLowerCase()) {
          nextShieldSlot = {
            ...nextShieldSlot,
            ap_cost: updatedApCost,
            max_block: restoredBlock,
            effect: cleanEffect,
          };
        }

        return updatedShield;
      })
    : [];

  return {
    updatedSheetData: {
      ...sheetData,
      attribute_dice: attributeDice,
      weapons,
      wardrobe,
      armor_slot: nextArmorSlot,
      armory,
      shield_slot: nextShieldSlot,
      armor: nextArmorSlot?.ar ?? sheetData.armor,
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

/**
 * Automatically identifies all {Free} traits matching the character's known paths
 * (Race, Class, and learned favorite_trait_kits) and equips any missing ones to traits_quirks with ap_cost = 0.
 */
export const reconcileCharacterFreeTraits = (
  sheetData: CharacterSheetData,
  character: Character | null | undefined,
  catalogTraits: SupabaseTrait[] = []
): { updatedSheetData: CharacterSheetData; newlyGrantedCount: number } => {
  if (!character || !catalogTraits || catalogTraits.length === 0) {
    return { updatedSheetData: sheetData, newlyGrantedCount: 0 };
  }

  const knownPaths = getCharacterKnownPaths(character);
  if (knownPaths.size === 0) {
    return { updatedSheetData: sheetData, newlyGrantedCount: 0 };
  }

  const existingTraits: TraitQuirkItem[] = Array.isArray(sheetData.traits_quirks)
    ? [...sheetData.traits_quirks]
    : [];
  const existingNames = new Set(existingTraits.map((t) => (t.name || '').toLowerCase().trim()));

  let newlyGrantedCount = 0;

  for (const trait of catalogTraits) {
    const rawPath = trait.path || trait.kit || trait.table_group || '';
    if (!rawPath) continue;

    const lowerRaw = rawPath.toLowerCase();
    const isFree = lowerRaw.includes('{free}') || lowerRaw.includes('{perk}') || lowerRaw.includes('{trait}');
    if (!isFree) continue;

    const itemPaths = parseItemPaths(rawPath);
    const matchesKnown = itemPaths.some((p) => {
      for (const kp of knownPaths) {
        if (isPathStringMatch(p, kp)) {
          return true;
        }
      }
      return false;
    });

    if (matchesKnown && !existingNames.has((trait.name || '').toLowerCase().trim())) {
      const resolvedMatchingPath = getCharacterMatchingPath(rawPath, character);
      existingTraits.push({
        name: trait.name,
        effect: trait.effect || '',
        notes: trait.notes || '',
        stat_hook: trait.stat_hook || null,
        kit: resolvedMatchingPath,
        table_group: resolvedMatchingPath,
        source: `${resolvedMatchingPath} {Free}`,
        path: resolvedMatchingPath,
        ap_cost: 0,
        is_hidden: false,
      });
      existingNames.add((trait.name || '').toLowerCase().trim());
      newlyGrantedCount++;
    }
  }

  return {
    updatedSheetData: {
      ...sheetData,
      traits_quirks: existingTraits,
    },
    newlyGrantedCount,
  };
};
