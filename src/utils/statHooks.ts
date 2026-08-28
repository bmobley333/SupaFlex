// src/utils/statHooks.ts
// Pure utility for resolving dynamic stat alterations triggered by Traits, Quirks, and Flaws

import { CharacterSheetData, TraitQuirkItem } from '../types/game';

export interface ActiveStatHookAnnotation {
  traitName: string;
  target: 'ar' | 'mr' | 'defense' | 'vitality' | 'luck' | 'wounds';
  effectDescription: string;
  adjustmentValue: number | string;
}

export interface ResolvedStatHooks {
  effectiveArOverride?: number; // E.g. Mind die value from Impossible Robes
  arBonus: number; // Flat bonus/penalty to AR
  mrBonus: number; // Flat bonus/penalty to Movement Rate
  vitalityBonus: number; // Flat bonus/penalty to Max Vitality
  luckBonus: number; // Flat bonus/penalty to Max Luck
  woundsBonus: number; // Flat bonus/penalty to Max Wounds
  activeHooks: ActiveStatHookAnnotation[];
}

const parseDieNumber = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace(/^d/i, ''), 10);
  return isNaN(num) ? 4 : num;
};

/**
 * Resolves all active stat hooks from equipped traits and quirks on the character sheet.
 */
export const resolveStatHooks = (sheetData?: CharacterSheetData | null): ResolvedStatHooks => {
  const result: ResolvedStatHooks = {
    arBonus: 0,
    mrBonus: 0,
    vitalityBonus: 0,
    luckBonus: 0,
    woundsBonus: 0,
    activeHooks: [],
  };

  if (!sheetData) return result;

  const traits: TraitQuirkItem[] = Array.isArray(sheetData.traits_quirks) ? sheetData.traits_quirks : [];
  const attributeDice = sheetData.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd4',
    moxie: 'd4',
  };

  traits.forEach((t) => {
    if (!t) return;
    const hook = t.stat_hook;
    const nameLower = (t.name || '').toLowerCase();

    // 1. Explicit stat_hook definition
    if (hook) {
      if (hook.target === 'ar') {
        if (hook.type === 'mind_die') {
          const mindRating = parseDieNumber(attributeDice.mind);
          result.effectiveArOverride = mindRating;
          result.activeHooks.push({
            traitName: t.name,
            target: 'ar',
            effectDescription: `Base AR is set to Mind die rating (🧥${mindRating})`,
            adjustmentValue: `🧥${mindRating}`,
          });
        } else if (hook.type === 'flat_bonus' && typeof hook.value === 'number') {
          result.arBonus += hook.value;
          result.activeHooks.push({
            traitName: t.name,
            target: 'ar',
            effectDescription: `${hook.value >= 0 ? '+' : ''}${hook.value} Natural AR`,
            adjustmentValue: hook.value,
          });
        }
      } else if (hook.target === 'mr') {
        if (hook.type === 'flat_bonus' && typeof hook.value === 'number') {
          result.mrBonus += hook.value;
          result.activeHooks.push({
            traitName: t.name,
            target: 'mr',
            effectDescription: `${hook.value >= 0 ? '+' : ''}${hook.value} Movement Rate`,
            adjustmentValue: hook.value,
          });
        }
      } else if (hook.target === 'vitality') {
        if (hook.type === 'flat_bonus' && typeof hook.value === 'number') {
          result.vitalityBonus += hook.value;
          result.activeHooks.push({
            traitName: t.name,
            target: 'vitality',
            effectDescription: `${hook.value >= 0 ? '+' : ''}${hook.value} Max Vitality`,
            adjustmentValue: hook.value,
          });
        }
      } else if (hook.target === 'luck') {
        if (hook.type === 'flat_bonus' && typeof hook.value === 'number') {
          result.luckBonus += hook.value;
          result.activeHooks.push({
            traitName: t.name,
            target: 'luck',
            effectDescription: `${hook.value >= 0 ? '+' : ''}${hook.value} Max Luck`,
            adjustmentValue: hook.value,
          });
        }
      } else if (hook.target === 'wounds') {
        if (hook.type === 'flat_bonus' && typeof hook.value === 'number') {
          result.woundsBonus += hook.value;
          result.activeHooks.push({
            traitName: t.name,
            target: 'wounds',
            effectDescription: `${hook.value >= 0 ? '+' : ''}${hook.value} Max Wounds`,
            adjustmentValue: hook.value,
          });
        }
      }
      return;
    }

    // 2. Name-based fallback inference for iconic stock quirks
    if (nameLower.includes('impossible robes')) {
      const mindRating = parseDieNumber(attributeDice.mind);
      result.effectiveArOverride = mindRating;
      result.activeHooks.push({
        traitName: t.name,
        target: 'ar',
        effectDescription: `Base AR set to Mind die rating (🧥${mindRating})`,
        adjustmentValue: `🧥${mindRating}`,
      });
    } else if (nameLower.includes('tough hide') || nameLower.includes('thick hide')) {
      result.arBonus += 1;
      result.activeHooks.push({
        traitName: t.name,
        target: 'ar',
        effectDescription: `+1 Natural AR`,
        adjustmentValue: 1,
      });
    } else if (nameLower.includes('swift step')) {
      result.mrBonus += 1;
      result.activeHooks.push({
        traitName: t.name,
        target: 'mr',
        effectDescription: `+1 Movement Rate`,
        adjustmentValue: 1,
      });
    } else if (nameLower.includes('fortune\'s child')) {
      result.luckBonus += 1;
      result.activeHooks.push({
        traitName: t.name,
        target: 'luck',
        effectDescription: `+1 Max Luck`,
        adjustmentValue: 1,
      });
    } else if (nameLower.includes('glass cannon')) {
      result.vitalityBonus -= 3;
      result.activeHooks.push({
        traitName: t.name,
        target: 'vitality',
        effectDescription: `-3 Max Vitality`,
        adjustmentValue: -3,
      });
    } else if (nameLower.includes('limping gait')) {
      result.mrBonus -= 1;
      result.activeHooks.push({
        traitName: t.name,
        target: 'mr',
        effectDescription: `-1 Movement Rate`,
        adjustmentValue: -1,
      });
    }
  });

  return result;
};
