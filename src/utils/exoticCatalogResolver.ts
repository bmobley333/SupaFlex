// src/utils/exoticCatalogResolver.ts
// Centralized, authoritative resolver for multi-table Exotic aggregation and tier resolution.
// Evaluates Exotics across supplies, weapons, armor, and shields where cost != 'Artifact'
// AND the item possesses at least one linked combat Function (directly or via mod path),
// dynamically deriving combat tier (Minor, Lesser, Greater, Epic) strictly from the highest linked function.

import { MagicItem, FunctionItem, ModItem, getCategorySlotWeight } from '../types/game';
import { cleanBelongsToName } from './gearFunctionSync';

export type ExoticTier = 'Minor' | 'Lesser' | 'Greater' | 'Epic';

export interface CatalogExotic extends MagicItem {
  exotic_tier: ExoticTier;
  source_table: 'supplies' | 'weapons' | 'armor' | 'shields';
  linked_functions: FunctionItem[];
  description?: string;
}

export interface ExoticCatalogResult {
  allExotics: CatalogExotic[];
  exoticsByTier: Record<ExoticTier, CatalogExotic[]>;
}

export const EXOTIC_TIER_RANK: Record<ExoticTier, number> = {
  Minor: 1,
  Lesser: 2,
  Greater: 3,
  Epic: 4,
};

/**
 * Normalizes raw string input into canonical ExoticTier.
 */
export const parseExoticTier = (raw?: string | null): ExoticTier => {
  const s = String(raw || '').toLowerCase();
  if (s.includes('epic') || s.includes('💫')) return 'Epic';
  if (s.includes('greater') || s.includes('🪬')) return 'Greater';
  if (s.includes('lesser') || s.includes('🪄')) return 'Lesser';
  return 'Minor';
};

/**
 * Checks whether an item qualifies as a true Exotic candidate based on cost and category.
 */
export const isExoticEligible = (item: any): boolean => {
  if (!item) return false;
  const cost = String(item.cost || '').trim().toLowerCase();
  const category = String(item.category || '').trim().toLowerCase();
  return cost !== 'artifact' && category !== 'artifact';
};

/**
 * Authoritatively aggregates and resolves all Exotics across all four gear tables
 * (supplies, weapons, armor, shields) and indexes them by their highest function tier.
 */
export const resolveExoticCatalog = (
  suppliesList: any[] = [],
  weaponsList: any[] = [],
  armorList: any[] = [],
  shieldsList: any[] = [],
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = []
): ExoticCatalogResult => {
  // Map clean function belongs_to target -> FunctionItem[]
  const fnTargetMap = new Map<string, FunctionItem[]>();
  for (const fn of functionsCatalog) {
    if (!fn.belongs_to) continue;
    const parts = fn.belongs_to.split(',');
    for (const part of parts) {
      const cleanTarget = cleanBelongsToName(part);
      if (cleanTarget) {
        const list = fnTargetMap.get(cleanTarget) || [];
        list.push(fn);
        fnTargetMap.set(cleanTarget, list);
      }
    }
  }

  // Map clean mod host target -> FunctionItem[] (inherited from child functions)
  const modHostFnMap = new Map<string, FunctionItem[]>();
  for (const mod of modsCatalog) {
    const modClean = cleanBelongsToName(mod.name);
    const modFns = fnTargetMap.get(modClean) || [];
    if (modFns.length > 0 && mod.belongs_to) {
      const parts = mod.belongs_to.split(',');
      for (const part of parts) {
        const cleanHost = cleanBelongsToName(part);
        if (cleanHost) {
          const list = modHostFnMap.get(cleanHost) || [];
          list.push(...modFns);
          modHostFnMap.set(cleanHost, list);
        }
      }
    }
  }

  const rawPool = [
    ...suppliesList.filter(isExoticEligible).map((x) => ({ ...x, _table: 'supplies' as const })),
    ...weaponsList.filter(isExoticEligible).map((x) => ({ ...x, _table: 'weapons' as const })),
    ...armorList.filter(isExoticEligible).map((x) => ({ ...x, _table: 'armor' as const })),
    ...shieldsList.filter(isExoticEligible).map((x) => ({ ...x, _table: 'shields' as const })),
  ];

  const resolvedList: CatalogExotic[] = [];

  for (const item of rawPool) {
    const rawName = item.name || item.title || '';
    const cleanName = cleanBelongsToName(rawName);
    const cleanNameNoMso = cleanBelongsToName(rawName.replace(/\(mso\)/gi, '').trim());

    // 1. Direct functions
    const directFns = fnTargetMap.get(cleanName) || fnTargetMap.get(cleanNameNoMso) || [];

    // 2. Mod functions
    const modFns = modHostFnMap.get(cleanName) || modHostFnMap.get(cleanNameNoMso) || [];

    // 3. Path functions (e.g. if item.path references a mod with functions)
    const pathFns: FunctionItem[] = [];
    if (item.path) {
      const pathStr = typeof item.path === 'string' ? item.path : JSON.stringify(item.path);
      const parts = pathStr.split(/[\",\[\]]/).map((s: string) => s.trim()).filter(Boolean);
      for (const p of parts) {
        const pClean = cleanBelongsToName(p);
        const f = fnTargetMap.get(pClean);
        if (f) pathFns.push(...f);
        const mf = modHostFnMap.get(pClean);
        if (mf) pathFns.push(...mf);
      }
    }

    // Combine and de-duplicate linked functions
    const fnMap = new Map<number | string, FunctionItem>();
    [...directFns, ...modFns, ...pathFns].forEach((fn) => {
      const key = fn.id || fn.name;
      if (!fnMap.has(key)) fnMap.set(key, fn);
    });
    const linkedFns = Array.from(fnMap.values());

    // Strict Rule: If it has NO functions, it is Standard Gear, NOT an Exotic!
    if (linkedFns.length === 0) {
      continue;
    }

    // Derive highest tier among linked functions
    let highestTier: ExoticTier = 'Minor';
    let maxRank = 0;

    for (const fn of linkedFns) {
      const t = parseExoticTier(fn.tier);
      const rank = EXOTIC_TIER_RANK[t] || 1;
      if (rank > maxRank) {
        maxRank = rank;
        highestTier = t;
      }
    }

    // Direct combat fields or promoted from single primary function
    const directAction = item.action ? String(item.action).toUpperCase().trim() : null;
    const directUsage = item.usage ? String(item.usage).trim() : null;
    const directEffect = item.effect ? String(item.effect).trim() : null;
    const directNotes = item.notes ? String(item.notes).trim() : null;

    const primaryAction = directAction || (linkedFns[0]?.action ? String(linkedFns[0].action).toUpperCase().trim() : null);
    const primaryUsage = directUsage || linkedFns[0]?.usage || null;
    const primaryEffect = directEffect || linkedFns[0]?.effect || null;
    const primaryNotes = directNotes || linkedFns[0]?.notes || null;

    const exoticObj: CatalogExotic = {
      id: typeof item.id === 'number' ? item.id : Date.now() + Math.floor(Math.random() * 10000),
      name: rawName,
      cost: item.cost || '1g',
      category: `${highestTier} Exotic`,
      rarity: highestTier,
      exotic_tier: highestTier,
      source_table: item._table,
      action: primaryAction,
      usage: primaryUsage,
      effect: primaryEffect,
      notes: primaryNotes || undefined,
      description: primaryEffect || item.description || primaryNotes || `Exotic ${highestTier.toLowerCase()} device.`,
      created_at: item.created_at || new Date().toISOString(),
      genres: item.genres || ['SciFi', 'GuildSpace'],
      slot_weight: getCategorySlotWeight(highestTier),
      linked_functions: linkedFns,
      source_gear: rawName,
      is_hardware: true,
      is_exotic: true,
    };

    resolvedList.push(exoticObj);
  }

  // Group by tier
  const exoticsByTier: Record<ExoticTier, CatalogExotic[]> = {
    Minor: [],
    Lesser: [],
    Greater: [],
    Epic: [],
  };

  for (const ex of resolvedList) {
    exoticsByTier[ex.exotic_tier].push(ex);
  }

  return {
    allExotics: resolvedList,
    exoticsByTier,
  };
};
