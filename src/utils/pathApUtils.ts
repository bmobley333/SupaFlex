// src/utils/pathApUtils.ts
// Universal Path & AP Cost Evaluation Engine for SupaFlex
// Implements the 4-tier AP Cost Vector (1, 2, 3, 4 AP) and In-Path / Out-of-Path Resolution

import { Character, SupabaseSet, SupabasePath, PathLinkedElement } from '../types/game';
import { cleanPathName } from './kitUtils';

export type ApCostCategory = 'all' | '1AP' | '2AP' | '3AP' | '3AP_Universal' | '4AP';

export interface ApEvaluationResult {
  inPath: boolean;
  meetsReq: boolean;
  category: '1AP' | '2AP' | '3AP' | '4AP';
  apCost: number;
  requiresGmApproval: boolean;
  statDownscaled: boolean;
  isUniversal?: boolean;
  isFree?: boolean;
  matchedSetName?: string;
}

/**
 * Extracts all known Path names for an active character (Race, Class, and learned Paths from favorite_trait_kits).
 * Returns a Set of lowercased, cleaned base path names for fast lookup.
 */
export const getCharacterKnownPaths = (character: Character | null | undefined): Set<string> => {
  const set = new Set<string>();
  if (!character) return set;

  // 0. Base Path (Innate for all characters)
  set.add('base');

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
 * Resolves all known Sets for a character based on their known Paths, the sets catalog, and paths catalog.
 * Returns a Set of lowercased, cleaned set names for fast O(1) lookup.
 */
export const getCharacterKnownSets = (
  knownPaths: Set<string>,
  setsCatalog: SupabaseSet[] = [],
  pathsCatalog: SupabasePath[] = []
): Set<string> => {
  const set = new Set<string>();
  if (!knownPaths || knownPaths.size === 0) return set;

  // 1. From setsCatalog: s.paths contains any known path
  if (setsCatalog && setsCatalog.length > 0) {
    for (const s of setsCatalog) {
      if (s.paths && Array.isArray(s.paths)) {
        for (const p of s.paths) {
          if (knownPaths.has(cleanPathName(p).toLowerCase().trim())) {
            set.add(cleanPathName(s.name).toLowerCase().trim());
            break;
          }
        }
      }
    }
  }

  // 2. From pathsCatalog: path.linked_elements has { type: 'set', name: setName }
  if (pathsCatalog && pathsCatalog.length > 0) {
    for (const p of pathsCatalog) {
      const cleanPath = cleanPathName(p.name).toLowerCase().trim();
      if (knownPaths.has(cleanPath)) {
        const elements = Array.isArray(p.linked_elements) ? p.linked_elements : [];
        for (const el of elements) {
          const elType = el.type || el.element_type;
          if (elType === 'set' && el.name) {
            set.add(cleanPathName(el.name).toLowerCase().trim());
          }
        }
      }
    }
  }

  return set;
};

/**
 * Resolves all Sets tagged {Free} for a character based on their known Paths.
 * Returns a Set of lowercased, cleaned set names for fast O(1) lookup.
 */
export const getCharacterFreeSets = (
  knownPaths: Set<string>,
  setsCatalog: SupabaseSet[] = [],
  pathsCatalog: SupabasePath[] = []
): Set<string> => {
  const freeSets = new Set<string>();
  if (!knownPaths || knownPaths.size === 0) return freeSets;

  // 1. From setsCatalog: s.paths has a path with {Free} tag matching a known path
  if (setsCatalog && setsCatalog.length > 0) {
    for (const s of setsCatalog) {
      if (s.paths && Array.isArray(s.paths)) {
        for (const p of s.paths) {
          const lower = p.toLowerCase();
          if (lower.includes('{free}') || lower.includes('{free1}') || lower.includes('{trait}')) {
            const clean = cleanPathName(p).toLowerCase().trim();
            if (knownPaths.has(clean)) {
              freeSets.add(cleanPathName(s.name).toLowerCase().trim());
              break;
            }
          }
        }
      }
    }
  }

  // 2. From pathsCatalog: path.linked_elements has { type: 'set', tag: 'Free' }
  if (pathsCatalog && pathsCatalog.length > 0) {
    for (const p of pathsCatalog) {
      const cleanPath = cleanPathName(p.name).toLowerCase().trim();
      if (knownPaths.has(cleanPath)) {
        const elements = Array.isArray(p.linked_elements) ? p.linked_elements : [];
        for (const el of elements) {
          const elType = el.type || el.element_type;
          if (elType === 'set' && el.name) {
            const isFree = el.tag === 'Free' || el.isFree === true || el.is_free === true;
            if (isFree) {
              freeSets.add(cleanPathName(el.name).toLowerCase().trim());
            }
          }
        }
      }
    }
  }

  return freeSets;
};

/**
 * Resolves direct individual abilities (Powers, Skills, Traits, Weapons, Armor, Shields)
 * marked {Free} in the linked_elements of a character's known Paths.
 * Returns a Set of lowercased, cleaned element names for fast O(1) lookup.
 */
export const getCharacterFreeElementNames = (
  knownPaths: Set<string>,
  pathsCatalog: SupabasePath[] = []
): Set<string> => {
  const freeElements = new Set<string>();
  if (!knownPaths || knownPaths.size === 0 || !pathsCatalog) return freeElements;

  for (const p of pathsCatalog) {
    const cleanPath = cleanPathName(p.name).toLowerCase().trim();
    if (knownPaths.has(cleanPath)) {
      const elements = Array.isArray(p.linked_elements) ? p.linked_elements : [];
      for (const el of elements) {
        const elType = el.type || el.element_type;
        if (elType !== 'set' && el.name) {
          const isFree = el.tag === 'Free' || el.isFree === true || el.is_free === true;
          if (isFree) {
            freeElements.add(cleanPathName(el.name).toLowerCase().trim());
          }
        }
      }
    }
  }

  return freeElements;
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
 * Normalizes a path string for comparison:
 * 1. Strips all curly-brace tags like {Free}, {Perk}, {Trait}, {Free1}, {3}, etc.
 * 2. Normalizes case (lowercase) and trims whitespace.
 * 3. Collapses multiple spaces and normalizes hyphens between words to spaces so
 *    "Cyber-Warrior (mso)" and "Cyber Warrior (mso)" match smoothly.
 */
export const normalizePathForComparison = (path?: string | null): string => {
  if (!path) return '';
  return path
    .replace(/\{[^}]+\}/g, '') // Strip curly brace tags like {Free}
    .replace(/^[\["']+|[\]"']+$/g, '') // Strip JSON quotes/brackets
    .toLowerCase()
    .replace(/-/g, ' ') // Normalize hyphens to spaces (e.g. Cyber-Warrior <-> Cyber Warrior)
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
};

/**
 * Strict whole-string matcher between two path strings.
 * Requires that pathA and pathB match in their ENTIRETY (ignoring {Free} / {Perk} / {Trait} tags and casing).
 * Prevents substring false positives: "Warrior (mso)" will NOT match "Cyber-Warrior (mso)".
 */
export const isPathStringMatch = (
  pathA?: string | null,
  pathB?: string | null
): boolean => {
  if (!pathA || !pathB) return false;
  const normA = normalizePathForComparison(pathA);
  const normB = normalizePathForComparison(pathB);
  if (!normA || !normB) return false;
  return normA === normB;
};

/**
 * Evaluates whether an item is within the character's known Paths or known Sets.
 * Items with NO path specified and NO sets specified (None, empty, General, Universal) are considered universally In-Path.
 */
export const isItemInPath = (
  rawPath: string | null | undefined,
  knownPaths: Set<string>,
  itemSets?: string[] | null,
  knownSets?: Set<string>
): boolean => {
  const paths = parseItemPaths(rawPath);

  // If item has no path constraints and no set constraints, it is available In-Path for all
  if (paths.length === 0 && (!itemSets || itemSets.length === 0)) {
    return true;
  }

  // Check if any path is General (universal basic adventuring)
  if (paths.some((p) => p.toLowerCase() === 'general')) {
    return true;
  }

  // Check direct whole-string match against character known paths
  if (knownPaths.size > 0 && paths.length > 0) {
    const directMatch = paths.some((p) => {
      for (const kp of knownPaths) {
        if (isPathStringMatch(p, kp)) {
          return true;
        }
      }
      return false;
    });
    if (directMatch) return true;
  }

  // Check set membership match against character known sets
  if (itemSets && Array.isArray(itemSets) && knownSets && knownSets.size > 0) {
    for (const s of itemSets) {
      if (s && knownSets.has(cleanPathName(s).toLowerCase().trim())) {
        return true;
      }
    }
  }

  // If item has no path (only sets) but no sets matched
  return false;
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
  variantType?: 'Melee' | 'Hurled' | 'Shot',
  itemSets?: string[] | null,
  knownSets?: Set<string>,
  freeSets?: Set<string>,
  freeElementNames?: Set<string>,
  itemName?: string
): ApEvaluationResult => {
  const inPath = isItemInPath(rawPath, knownPaths, itemSets, knownSets);
  const meetsReq = isItemRequirementMet(requirementStr, attributeDice, variantType);

  // Identify matched set name (if any)
  let matchedSetName: string | undefined;
  if (itemSets && Array.isArray(itemSets) && knownSets && knownSets.size > 0) {
    for (const s of itemSets) {
      if (s && knownSets.has(cleanPathName(s).toLowerCase().trim())) {
        matchedSetName = cleanPathName(s);
        break;
      }
    }
  }

  // 0 AP {Free} Check:
  // 1. Direct name in freeElementNames
  // 2. Any itemSets in freeSets
  // 3. rawPath contains {Free} / {Perk} / {Trait} and matches knownPaths
  let isFree = false;
  if (itemName && freeElementNames && freeElementNames.has(cleanPathName(itemName).toLowerCase().trim())) {
    isFree = true;
  }
  if (!isFree && itemSets && Array.isArray(itemSets) && freeSets && freeSets.size > 0) {
    for (const s of itemSets) {
      if (s && freeSets.has(cleanPathName(s).toLowerCase().trim())) {
        isFree = true;
        break;
      }
    }
  }
  if (!isFree && inPath && rawPath) {
    const rawLower = rawPath.toLowerCase();
    if (rawLower.includes('{free}') || rawLower.includes('{free1}') || rawLower.includes('{perk}') || rawLower.includes('{trait}')) {
      const paths = parseItemPaths(rawPath);
      for (const p of paths) {
        const pLower = p.toLowerCase();
        if (pLower.includes('{free}') || pLower.includes('{free1}') || pLower.includes('{perk}') || pLower.includes('{trait}')) {
          for (const kp of knownPaths) {
            if (isPathStringMatch(p, kp)) {
              isFree = true;
              break;
            }
          }
        }
        if (isFree) break;
      }
    }
  }

  if (isFree) {
    return {
      inPath: true,
      meetsReq: true,
      category: '1AP',
      apCost: 0,
      isFree: true,
      requiresGmApproval: false,
      statDownscaled: false,
      matchedSetName,
    };
  }

  if (inPath && meetsReq) {
    return {
      inPath: true,
      meetsReq: true,
      category: '1AP',
      apCost: 1,
      isFree: false,
      requiresGmApproval: false,
      statDownscaled: false,
      matchedSetName,
    };
  }

  if (inPath && !meetsReq) {
    return {
      inPath: true,
      meetsReq: false,
      category: '2AP',
      apCost: 2,
      isFree: false,
      requiresGmApproval: false,
      statDownscaled: false,
      matchedSetName,
    };
  }

  const paths = parseItemPaths(rawPath);
  const isUniversal = paths.some((p) => p.toLowerCase() === 'universal');

  if (!inPath && meetsReq) {
    return {
      inPath: false,
      meetsReq: true,
      category: '3AP',
      apCost: 3,
      isFree: false,
      requiresGmApproval: !isUniversal,
      statDownscaled: false,
      isUniversal,
      matchedSetName,
    };
  }

  // !inPath && !meetsReq
  return {
    inPath: false,
    meetsReq: false,
    category: '4AP',
    apCost: 4,
    isFree: false,
    requiresGmApproval: !isUniversal,
    statDownscaled: false,
    isUniversal,
    matchedSetName,
  };
};

/**
 * Filters an item by the selected AP cost category tab ('all', '1AP', '2AP', '3AP', '3AP_Universal', '4AP').
 */
export const matchesApCategoryFilter = (
  targetCategory: ApCostCategory,
  evalResult: ApEvaluationResult
): boolean => {
  if (targetCategory === 'all') return true;
  if (targetCategory === '3AP_Universal') {
    return !!evalResult.isUniversal;
  }
  if (targetCategory === '3AP') {
    return evalResult.category === '3AP' && !evalResult.isUniversal;
  }
  return evalResult.category === targetCategory;
};

/**
 * Resolves the single path entry matching the character's known paths from a trait's raw path/source/kit.
 * E.g., for a Shanask hero with a trait having '["Kryll (mso) {Free}", "Shanask (mso) {Free}"]',
 * returns 'Shanask (mso) {Free}'.
 */
export const getCharacterMatchingPath = (
  rawPath: string | null | undefined,
  character: Character | null | undefined
): string => {
  if (!rawPath || !rawPath.trim() || rawPath === 'None') return 'General';

  const trimmed = rawPath.trim();
  let entries: string[] = [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        entries = parsed.map((p) => String(p).trim()).filter(Boolean);
      }
    } catch (_) {}
  }

  if (entries.length === 0) {
    entries = trimmed.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  }

  if (entries.length === 0) return 'General';

  const cleanEntryStr = (str: string) => str.replace(/^[\["']+|[\]"']+$/g, '').trim();

  // Match against character's known paths
  const known = getCharacterKnownPaths(character);
  for (const entry of entries) {
    const cleaned = cleanEntryStr(entry);
    for (const kp of known) {
      if (!kp || kp === 'base') continue;
      if (isPathStringMatch(cleaned, kp)) {
        return cleaned;
      }
    }
  }

  // Fallback to first entry
  return cleanEntryStr(entries[0]);
};

/**
 * Parses raw path values (string, comma-separated, or JSON array string)
 * preserving each entry's {Free} / {Trait} / {Perk} status and base clean path.
 */
export const extractPathEntriesWithTags = (
  raw?: string | string[] | null
): { rawEntry: string; cleanPath: string; isFree: boolean }[] => {
  if (!raw) return [];
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((r) => String(r)).filter(Boolean);
  } else {
    const s = String(raw).trim();
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          list = parsed.map((p) => String(p)).filter(Boolean);
        }
      } catch (_) {}
    }
    if (list.length === 0) {
      list = s.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
    }
  }

  return list.map((item) => {
    const isFree = /\{(?:free|free\d+|trait|innate)\}/i.test(item);
    const clean = cleanPathName(item).trim();
    return { rawEntry: item, cleanPath: clean, isFree };
  });
};

export interface PathCatalogsBundle {
  setsCatalog?: SupabaseSet[];
  powers?: any[];
  skills?: any[];
  traits?: any[];
  weaponsCatalog?: any[];
  armorCatalog?: any[];
  shieldsCatalog?: any[];
}

/**
 * Dynamically harvests and builds the full PathLinkedElement array for any given path
 * by scanning all loaded catalogs (Sets, Powers, Skills, Traits, Weapons, Armor, Shields).
 * Used as an instantaneous fallback and hydration engine whenever path.linked_elements is empty.
 */
export const resolvePathElementsFromCatalogs = (
  pathName: string,
  catalogs: PathCatalogsBundle
): PathLinkedElement[] => {
  if (!pathName || !pathName.trim()) return [];
  const cleanTarget = cleanPathName(pathName).trim().toLowerCase();
  const results: PathLinkedElement[] = [];
  const seenIds = new Set<string>();

  // 1. Sets
  (catalogs.setsCatalog || []).forEach((s) => {
    if (!s || !s.name) return;
    const entries = extractPathEntriesWithTags(s.paths);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `set_${s.id || s.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: s.id,
          name: s.name,
          type: 'set',
          element_type: 'set',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          details: s.category || (s.items_count !== undefined ? `${s.items_count} items` : 'Set'),
        });
      }
    }
  });

  // 2. Powers
  (catalogs.powers || []).forEach((p) => {
    if (!p || !p.name) return;
    const raw = p.path || p.kit || p.table_group;
    const entries = extractPathEntriesWithTags(raw);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `power_${p.id || p.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: p.id,
          name: p.name,
          type: 'power',
          element_type: 'power',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          action: p.action || 'AM',
          usage: p.usage || '1-Enc',
          effect: p.effect || '',
          details: p.effect || p.notes || '',
        });
      }
    }
  });

  // 3. Skills
  (catalogs.skills || []).forEach((sk) => {
    if (!sk || !sk.name) return;
    const raw = sk.path || sk.kit || sk.table_group;
    const entries = extractPathEntriesWithTags(raw);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `skill_${sk.id || sk.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: sk.id,
          name: sk.name,
          type: 'skill',
          element_type: 'skill',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          attribute: sk.attribute || 'Moxie',
          discipline: sk.discipline || 'General',
          effect: sk.notes || '',
          details: sk.notes || '',
        });
      }
    }
  });

  // 4. Traits
  (catalogs.traits || []).forEach((t) => {
    if (!t || !t.name) return;
    const raw = t.path || t.kit || t.table_group;
    const entries = extractPathEntriesWithTags(raw);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `trait_${t.id || t.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: t.id,
          name: t.name,
          type: 'trait',
          element_type: 'trait',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          effect: t.effect || '',
          details: t.effect || t.notes || '',
        });
      }
    }
  });

  // 5. Weapons
  (catalogs.weaponsCatalog || []).forEach((w) => {
    if (!w || !w.name) return;
    const raw = w.path || w.kit;
    const entries = extractPathEntriesWithTags(raw);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `weapon_${w.id || w.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: w.id,
          name: w.name,
          type: 'weapon',
          element_type: 'weapon',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          details: `${w.dmg || ''} ${w.type || ''}`.trim(),
        });
      }
    }
  });

  // 6. Armor
  (catalogs.armorCatalog || []).forEach((a) => {
    if (!a || !a.name) return;
    const entries = extractPathEntriesWithTags(a.path);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `armor_${a.id || a.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: a.id,
          name: a.name,
          type: 'armor',
          element_type: 'armor',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          details: `AR ${a.ar || 0}`,
        });
      }
    }
  });

  // 7. Shields
  (catalogs.shieldsCatalog || []).forEach((sh) => {
    if (!sh || !sh.name) return;
    const entries = extractPathEntriesWithTags(sh.path);
    const match = entries.find((e) => isPathStringMatch(e.cleanPath, cleanTarget));
    if (match) {
      const elId = `shield_${sh.id || sh.name}`;
      if (!seenIds.has(elId)) {
        seenIds.add(elId);
        results.push({
          id: sh.id,
          name: sh.name,
          type: 'shield',
          element_type: 'shield',
          tag: match.isFree ? 'Free' : '1 AP',
          isFree: match.isFree,
          is_free: match.isFree,
          details: `AR ${sh.ar || 0}`,
        });
      }
    }
  });

  return results;
};

