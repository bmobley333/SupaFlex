// src/utils/lootAbilityResolver.ts
// Centralized, authoritative resolver for extracting Action, Usage, Effect, Notes,
// and Inherent Functions / Inherent {Free} Mods across loot generation and essence draft cards.

import { FunctionItem, ModItem } from '../types/game';
import {
  getFunctionsForGearItem,
  isModFreeForHost,
  getFunctionsForMod,
} from './gearFunctionSync';

export interface ResolvedFunctionAbility {
  id: string | number;
  name: string;
  action?: string | null;
  usage?: string | null;
  effect?: string | null;
  notes?: string | null;
  sourceMod?: string;
  isFreeMod?: boolean;
}

export interface ResolvedLootAbilities {
  primaryAction?: string | null;
  primaryUsage?: string | null;
  primaryEffect?: string | null;
  primaryNotes?: string | null;
  functions: ResolvedFunctionAbility[];
  hasMultiFunctions: boolean;
}

export const ACTION_BADGE_COLORS: Record<string, string> = {
  AM: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  A: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  M: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  P: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  F: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

/**
 * Resolves all direct abilities, inherent functions, and free mod abilities for any loot item.
 */
export const resolveLootAbilities = (
  item: any,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = []
): ResolvedLootAbilities => {
  if (!item) {
    return {
      functions: [],
      hasMultiFunctions: false,
    };
  }

  const rawName = item.name || item.title || '';
  const directAction = item.action ? String(item.action).toUpperCase().trim() : null;
  const directUsage = item.usage ? String(item.usage).trim() : null;
  const directEffect = item.effect ? String(item.effect).trim() : null;
  const directNotes = item.notes ? String(item.notes).trim() : null;

  // 1. Direct inherent functions from functionsCatalog matching host item name
  const directFns = getFunctionsForGearItem(rawName, functionsCatalog);

  // 2. Inherent {Free} mods belonging to host item
  const freeMods = modsCatalog.filter((m) => isModFreeForHost(m, rawName));

  const resolvedFns: ResolvedFunctionAbility[] = [];
  const seenFnNames = new Set<string>();

  // Add direct functions
  directFns.forEach((fn) => {
    const fnKey = fn.name.toLowerCase().trim();
    if (!seenFnNames.has(fnKey)) {
      seenFnNames.add(fnKey);
      resolvedFns.push({
        id: fn.id,
        name: fn.name,
        action: fn.action ? String(fn.action).toUpperCase().trim() : null,
        usage: fn.usage || null,
        effect: fn.effect || null,
        notes: fn.notes || null,
      });
    }
  });

  // Add free mod functions
  freeMods.forEach((fm) => {
    const modFns = getFunctionsForMod(fm.name, functionsCatalog);
    modFns.forEach((fn) => {
      const fnKey = fn.name.toLowerCase().trim();
      if (!seenFnNames.has(fnKey)) {
        seenFnNames.add(fnKey);
        resolvedFns.push({
          id: fn.id,
          name: fn.name,
          action: fn.action ? String(fn.action).toUpperCase().trim() : null,
          usage: fn.usage || null,
          effect: fn.effect || null,
          notes: fn.notes || fm.notes || null,
          sourceMod: fm.name,
          isFreeMod: true,
        });
      }
    });
  });

  // Determine primary display
  let primaryAction = directAction;
  let primaryUsage = directUsage;
  let primaryEffect = directEffect;
  let primaryNotes = directNotes;

  // If item lacks direct action/effect, but has exactly 1 inherent function, promote it to primary view
  if (!primaryAction && !primaryEffect && resolvedFns.length === 1) {
    primaryAction = resolvedFns[0].action || null;
    primaryUsage = primaryUsage || resolvedFns[0].usage || null;
    primaryEffect = resolvedFns[0].effect || null;
    primaryNotes = primaryNotes || resolvedFns[0].notes || null;
  }

  // Has multi-functions if more than 1 function exists, or if direct effect and child functions both exist
  const hasMultiFunctions =
    resolvedFns.length > 1 || (!!directEffect && resolvedFns.length > 0);

  return {
    primaryAction,
    primaryUsage,
    primaryEffect,
    primaryNotes,
    functions: resolvedFns,
    hasMultiFunctions,
  };
};
