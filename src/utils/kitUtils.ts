// src/utils/kitUtils.ts
// Universal Utilities for Parsing, Normalizing, and Evaluating [Kit] {Trait[Level]} Architecture

export interface ParsedKit {
  baseKit: string;
  isTrait: boolean;
  minLevel: number;
  rawKit: string;
}

/**
 * Parses a raw kit string to extract the base kit name, trait status, and minimum required level.
 * Examples:
 *   "Dwarf {Trait}"   -> { baseKit: "Dwarf", isTrait: true, minLevel: 1, rawKit: "Dwarf {Trait}" }
 *   "Dwarf {Trait1}"  -> { baseKit: "Dwarf", isTrait: true, minLevel: 1, rawKit: "Dwarf {Trait1}" }
 *   "Dwarf {Trait5}"  -> { baseKit: "Dwarf", isTrait: true, minLevel: 5, rawKit: "Dwarf {Trait5}" }
 *   "Dwarf {3}"       -> { baseKit: "Dwarf", isTrait: false, minLevel: 3, rawKit: "Dwarf {3}" }
 *   "Dwarf {1}"       -> { baseKit: "Dwarf", isTrait: false, minLevel: 1, rawKit: "Dwarf {1}" }
 *   "Dwarf"           -> { baseKit: "Dwarf", isTrait: false, minLevel: 1, rawKit: "Dwarf" }
 *   "Warrior - Ranger" -> { baseKit: "Warrior - Ranger", isTrait: false, minLevel: 1, rawKit: "Warrior - Ranger" }
 */
export const parseKit = (rawKit?: string | null): ParsedKit => {
  if (!rawKit || !rawKit.trim()) {
    return {
      baseKit: 'General',
      isTrait: false,
      minLevel: 1,
      rawKit: '',
    };
  }

  const trimmed = rawKit.trim();

  // Match Curly-Brace Kit Syntax: "{Trait}", "{Trait5}", "{3}", "{1}", "{Trait 5}"
  const curlyMatch = trimmed.match(/^(.*?)(?:\s*\{([a-zA-Z]*)\s*(\d+)?\})$/i);

  if (curlyMatch) {
    const base = curlyMatch[1].trim() || 'General';
    const tag = (curlyMatch[2] || '').toLowerCase();
    const levelNum = curlyMatch[3] ? parseInt(curlyMatch[3], 10) : 1;
    const isTrait = tag.includes('trait') || tag.includes('innate') || tag.includes('free');

    return {
      baseKit: base,
      isTrait,
      minLevel: Math.max(1, isNaN(levelNum) ? 1 : levelNum),
      rawKit: trimmed,
    };
  }

  return {
    baseKit: trimmed,
    isTrait: false,
    minLevel: 1,
    rawKit: trimmed,
  };
};

/**
 * Returns true if an item has a {Trait} or {Trait[Level]} suffix in its kit or table_group.
 */
export const isTraitItem = (item?: { kit?: string | null; table_group?: string | null } | null): boolean => {
  if (!item) return false;
  const target = item.kit || item.table_group;
  if (!target) return false;
  return parseKit(target).isTrait;
};

/**
 * Returns the minimum required level for an item based on its kit syntax (defaults to 1).
 */
export const getKitMinLevel = (item?: { kit?: string | null; table_group?: string | null } | null): number => {
  if (!item) return 1;
  const target = item.kit || item.table_group;
  if (!target) return 1;
  return parseKit(target).minLevel;
};

/**
 * Strips the {...} suffix to return the clean base kit name (e.g. "Dwarf {Trait5}" -> "Dwarf").
 */
export const cleanKitName = (rawKit?: string | null): string => {
  return parseKit(rawKit).baseKit;
};

/**
 * Formats a base kit name with curly-brace level or trait notation.
 */
export const formatKitWithLevel = (
  baseKit: string,
  isTrait: boolean = false,
  minLevel: number = 1
): string => {
  const clean = cleanKitName(baseKit);
  if (isTrait) {
    return minLevel > 1 ? `${clean} {Trait${minLevel}}` : `${clean} {Trait}`;
  }
  return minLevel > 1 ? `${clean} {${minLevel}}` : clean;
};

/**
 * Matches an item's kit against a selected filter.
 * If filter is "Human", matches "Human", "Human {Trait}", "Human {Trait5}", "Human {3}".
 */
export const matchesKitFilter = (
  itemKit?: string | null,
  selectedFilterKit?: string | null
): boolean => {
  if (!selectedFilterKit || selectedFilterKit === 'all' || selectedFilterKit === 'All') {
    return true;
  }

  const cleanItemBase = cleanKitName(itemKit).toLowerCase();
  const cleanFilterBase = cleanKitName(selectedFilterKit).toLowerCase();

  return cleanItemBase === cleanFilterBase;
};

/**
 * Sanitizes user input in kit name fields by stripping curly braces { and }.
 */
export const sanitizeKitInput = (input: string): string => {
  return (input || '').replace(/[{}]/g, '');
};

/**
 * Takes a list of raw kit strings and returns a sorted, de-duplicated list of base kits.
 */
export const getUniqueBaseKits = (rawKits: (string | null | undefined)[]): string[] => {
  const set = new Set<string>();
  rawKits.forEach((k) => {
    if (k && k.trim()) {
      const base = cleanKitName(k);
      if (base) set.add(base);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};
