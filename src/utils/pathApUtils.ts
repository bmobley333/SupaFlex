// src/utils/pathApUtils.ts
// Universal Path & AP Cost Evaluation Engine for SupaFlex
// Implements the 4-tier AP Cost Vector (1, 2, 3, 4 AP) and In-Path / Out-of-Path Resolution

import { Character } from '../types/game';
import { cleanPathName } from './kitUtils';

export type ApCostCategory = 'all' | '1AP' | '2AP' | '3AP' | '4AP';

export interface ApEvaluationResult {
  inPath: boolean;
  meetsReq: boolean;
  category: '1AP' | '2AP' | '3AP' | '4AP';
  apCost: number;
  requiresGmApproval: boolean;
  statDownscaled: boolean;
}

/**
 * Extracts all known Path names for an active character (Race, Class, and learned Paths from favorite_trait_kits).
 * Returns a Set of lowercased, cleaned base path names for fast lookup.
 */
export const getCharacterKnownPaths = (character: Character | null | undefined): Set<string> => {
  const set = new Set<string>();
  if (!character) return set;

  // 1. Race Path
  if (character.race) {
    const cleanRace = cleanPathName(character.race).toLowerCase().trim();
    if (cleanRace) set.add(cleanRace);
  }

  // 2. Class Path
  if (character.class) {
    const cleanClass = cleanPathName(character.class).toLowerCase().trim();
    if (cleanClass) set.add(cleanClass);
  }

  // 3. Learned Extra Paths from sheet
  const fromSheet: string[] = character.sheet_data?.favorite_trait_kits || [];
  fromSheet.forEach((p) => {
    if (p && typeof p === 'string') {
      const clean = cleanPathName(p).toLowerCase().trim();
      if (clean) set.add(clean);
    }
  });

  return set;
};

/**
 * Parses raw path values (which can be a single string, comma-separated string, or JSON array string)
 * into a list of normalized, cleaned path names.
 */
export const parseItemPaths = (rawPath?: string | null): string[] => {
  if (!rawPath || rawPath === 'None' || rawPath.trim() === '') {
    return [];
  }

  const trimmed = rawPath.trim();

  // Try parsing JSON array string: e.g. '["Archaic Weapons (mso)", "Dragon (mso) {Perk}"]'
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((p) => cleanPathName(String(p)).trim()).filter(Boolean);
      }
    } catch (_) {
      // Fall through to standard string splitting
    }
  }

  // Comma or semicolon-separated fallback
  return trimmed
    .split(/[,;]/)
    .map((p) => cleanPathName(p).trim())
    .filter(Boolean);
};

/**
 * Evaluates whether an item is within the character's known Paths.
 * Items with NO path specified (None, empty, General, Universal) are considered universally In-Path.
 */
export const isItemInPath = (
  rawPath: string | null | undefined,
  knownPaths: Set<string>
): boolean => {
  const paths = parseItemPaths(rawPath);

  // If item has no path constraints or is tagged General/Universal, it is available In-Path for all
  if (paths.length === 0) {
    return true;
  }

  // Check if any path is General / Universal
  if (paths.some((p) => p.toLowerCase() === 'general' || p.toLowerCase() === 'universal')) {
    return true;
  }

  // If character has no known paths, anything with a path constraint is out-of-path
  if (knownPaths.size === 0) {
    return false;
  }

  // Check for direct or partial match against character known paths
  return paths.some((p) => {
    const cleanLower = p.toLowerCase();
    if (knownPaths.has(cleanLower)) return true;

    // Substring match for MSO variants (e.g. "Tech Melee Weapons" in "Tech Melee Weapons (mso)")
    const strippedMso = cleanLower.replace(/\(mso\)/g, '').trim();
    if (knownPaths.has(strippedMso)) return true;

    for (const kp of knownPaths) {
      const cleanKp = kp.replace(/\(mso\)/g, '').trim();
      if (cleanKp === strippedMso || cleanLower.includes(cleanKp) || cleanKp.includes(cleanLower)) {
        return true;
      }
    }
    return false;
  });
};

const parseAttributeNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace(/^d/i, ''), 10);
  return isNaN(num) ? 4 : num;
};

/**
 * Checks whether the character meets the attribute requirements for an item (Weapons, Armor, Shields).
 */
export const isItemRequirementMet = (
  requirementStr: string | null | undefined,
  attributeDice: Record<string, string>,
  variantType?: 'Melee' | 'Hurled' | 'Shot'
): boolean => {
  if (!requirementStr || requirementStr.trim() === '' || requirementStr.toLowerCase() === 'n/a') {
    return true;
  }

  const match = requirementStr.match(/\d+/);
  if (!match) return true;
  const reqNum = parseInt(match[0], 10);

  // If variantType is provided (Weapon variant)
  if (variantType === 'Shot') {
    return parseAttributeNum(attributeDice.mind) >= reqNum;
  }
  if (variantType === 'Hurled') {
    return parseAttributeNum(attributeDice.motion) >= reqNum;
  }
  if (variantType === 'Melee') {
    return parseAttributeNum(attributeDice.might) >= reqNum;
  }

  // Inspect emoji in requirement string
  if (requirementStr.includes('🏃')) {
    return parseAttributeNum(attributeDice.motion) >= reqNum;
  }
  if (requirementStr.includes('👁️') || requirementStr.includes('👁')) {
    return parseAttributeNum(attributeDice.mind) >= reqNum;
  }
  if (requirementStr.includes('✨')) {
    return parseAttributeNum(attributeDice.magic) >= reqNum;
  }
  if (requirementStr.includes('🫀') || requirementStr.includes('🎭')) {
    return parseAttributeNum(attributeDice.moxie) >= reqNum;
  }

  // Default to Might (💪) for Armor, Shields, and standard Melee weapons
  return parseAttributeNum(attributeDice.might) >= reqNum;
};

/**
 * Full evaluation of an item's AP category and cost based on Path and Requirement status.
 *
 * 1 AP: In-Path & Meets Requirement (Path & Req)
 * 2 AP: In-Path & Unmet Requirement (Path, ~Req)
 * 3 AP: Out-of-Path & Meets Requirement (~Path & Req)
 * 4 AP: Out-of-Path & Unmet Requirement (~Path, ~Req)
 */
export const evaluateItemAp = (
  rawPath: string | null | undefined,
  requirementStr: string | null | undefined,
  attributeDice: Record<string, string>,
  knownPaths: Set<string>,
  variantType?: 'Melee' | 'Hurled' | 'Shot'
): ApEvaluationResult => {
  const inPath = isItemInPath(rawPath, knownPaths);
  const meetsReq = isItemRequirementMet(requirementStr, attributeDice, variantType);

  if (inPath && meetsReq) {
    return {
      inPath: true,
      meetsReq: true,
      category: '1AP',
      apCost: 1,
      requiresGmApproval: false,
      statDownscaled: false,
    };
  }

  if (inPath && !meetsReq) {
    return {
      inPath: true,
      meetsReq: false,
      category: '2AP',
      apCost: 2,
      requiresGmApproval: false,
      statDownscaled: true,
    };
  }

  if (!inPath && meetsReq) {
    return {
      inPath: false,
      meetsReq: true,
      category: '3AP',
      apCost: 3,
      requiresGmApproval: true,
      statDownscaled: false,
    };
  }

  // !inPath && !meetsReq
  return {
    inPath: false,
    meetsReq: false,
    category: '4AP',
    apCost: 4,
    requiresGmApproval: true,
    statDownscaled: true,
  };
};

/**
 * Filters an item by the selected AP cost category tab ('all', '1AP', '2AP', '3AP', '4AP').
 */
export const matchesApCategoryFilter = (
  targetCategory: ApCostCategory,
  evalResult: ApEvaluationResult
): boolean => {
  if (targetCategory === 'all') return true;
  return evalResult.category === targetCategory;
};
