// src/utils/artifactCatalogResolver.ts
// Centralized, authoritative resolver for multi-table Artifact aggregation and tier resolution.
// Evaluates Artifacts across supplies, weapons, armor, and shields that have cost='Artifact',
// dynamically deriving their combat tier (Minor, Lesser, Greater, Epic) from the functions table.

import { MagicItem, FunctionItem, getCategorySlotWeight } from '../types/game';
import { cleanBelongsToName } from './gearFunctionSync';

export type ArtifactTier = 'Minor' | 'Lesser' | 'Greater' | 'Epic';

export interface CatalogArtifact extends MagicItem {
  artifact_tier: ArtifactTier;
  source_table: 'supplies' | 'weapons' | 'armor' | 'shields';
  linked_functions: FunctionItem[];
  description?: string;
}

export interface ArtifactCatalogResult {
  allArtifacts: CatalogArtifact[];
  artifactsByTier: Record<ArtifactTier, CatalogArtifact[]>;
}

export const TIER_RANK: Record<ArtifactTier, number> = {
  Minor: 1,
  Lesser: 2,
  Greater: 3,
  Epic: 4,
};

/**
 * Normalizes raw string input into canonical ArtifactTier.
 */
export const parseArtifactTier = (raw?: string | null): ArtifactTier => {
  const s = String(raw || '').toLowerCase();
  if (s.includes('epic') || s.includes('relic')) return 'Epic';
  if (s.includes('greater') || s.includes('🪬')) return 'Greater';
  if (s.includes('lesser') || s.includes('🪄')) return 'Lesser';
  return 'Minor';
};

/**
 * Checks whether an item qualifies as a true Artifact based on cost or category.
 */
export const isArtifactItem = (item: any): boolean => {
  if (!item) return false;
  const cost = String(item.cost || '').trim().toLowerCase();
  const category = String(item.category || '').trim().toLowerCase();
  return cost === 'artifact' || category === 'artifact';
};

/**
 * Authoritatively aggregates and resolves all Artifacts across all four gear tables
 * (supplies, weapons, armor, shields) and indexes them by their highest function tier.
 */
export const resolveArtifactCatalog = (
  suppliesList: any[] = [],
  weaponsList: any[] = [],
  armorList: any[] = [],
  shieldsList: any[] = [],
  functionsCatalog: FunctionItem[] = []
): ArtifactCatalogResult => {
  const rawPool = [
    ...suppliesList.filter(isArtifactItem).map((x) => ({ ...x, _table: 'supplies' as const })),
    ...weaponsList.filter(isArtifactItem).map((x) => ({ ...x, _table: 'weapons' as const })),
    ...armorList.filter(isArtifactItem).map((x) => ({ ...x, _table: 'armor' as const })),
    ...shieldsList.filter(isArtifactItem).map((x) => ({ ...x, _table: 'shields' as const })),
  ];

  const resolvedList: CatalogArtifact[] = rawPool.map((item) => {
    const rawName = item.name || item.title || '';
    const cleanName = cleanBelongsToName(rawName);

    // Find all functions whose belongs_to matches the artifact name
    const linkedFns = functionsCatalog.filter((fn) => {
      if (!fn.belongs_to) return false;
      const parts = fn.belongs_to.split(',');
      return parts.some((p) => cleanBelongsToName(p) === cleanName);
    });

    // Derive highest tier among linked functions
    let highestTier: ArtifactTier = 'Minor';
    let maxRank = 0;

    for (const fn of linkedFns) {
      const t = parseArtifactTier(fn.tier);
      const rank = TIER_RANK[t] || 1;
      if (rank > maxRank) {
        maxRank = rank;
        highestTier = t;
      }
    }

    // Fallback if no linked functions: check item category or name
    if (linkedFns.length === 0) {
      highestTier = parseArtifactTier(item.category || rawName);
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

    const artifactObj: CatalogArtifact = {
      id: typeof item.id === 'number' ? item.id : Date.now() + Math.floor(Math.random() * 10000),
      name: rawName,
      cost: 'Artifact',
      category: `${highestTier} Artifact`,
      rarity: highestTier,
      artifact_tier: highestTier,
      source_table: item._table,
      action: primaryAction,
      usage: primaryUsage,
      effect: primaryEffect,
      notes: primaryNotes || undefined,
      description: primaryEffect || item.description || primaryNotes || `Enchanted ${highestTier.toLowerCase()} artifact.`,
      created_at: item.created_at || new Date().toISOString(),
      genres: item.genres || ['Fantasy', 'SciFi'],
      slot_weight: getCategorySlotWeight(highestTier),
      linked_functions: linkedFns,
      source_gear: rawName,
      is_exotic: item._table !== 'supplies',
    };

    return artifactObj;
  });

  // Group by tier
  const artifactsByTier: Record<ArtifactTier, CatalogArtifact[]> = {
    Minor: [],
    Lesser: [],
    Greater: [],
    Epic: [],
  };

  for (const art of resolvedList) {
    artifactsByTier[art.artifact_tier].push(art);
  }

  // Sort each bucket alphabetically
  Object.keys(artifactsByTier).forEach((key) => {
    artifactsByTier[key as ArtifactTier].sort((a, b) => a.name.localeCompare(b.name));
  });

  return {
    allArtifacts: resolvedList.sort((a, b) => a.name.localeCompare(b.name)),
    artifactsByTier,
  };
};
