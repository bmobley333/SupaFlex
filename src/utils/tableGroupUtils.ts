// src/utils/tableGroupUtils.ts
// Universal Utilities for Parsing, Normalizing, and Evaluating [Table_Group] (Trait) Architecture

export interface ParsedTableGroup {
  baseGroup: string;
  isTrait: boolean;
  rawGroup: string;
}

/**
 * Parses a raw table_group string to extract the base table name and whether it is a trait grant.
 * Examples:
 *   "Human (Trait)" -> { baseGroup: "Human", isTrait: true, rawGroup: "Human (Trait)" }
 *   "Dwarf (trait)" -> { baseGroup: "Dwarf", isTrait: true, rawGroup: "Dwarf (trait)" }
 *   "Warrior - Ranger" -> { baseGroup: "Warrior - Ranger", isTrait: false, rawGroup: "Warrior - Ranger" }
 */
export const parseTableGroup = (rawGroup?: string | null): ParsedTableGroup => {
  if (!rawGroup || !rawGroup.trim()) {
    return {
      baseGroup: 'General',
      isTrait: false,
      rawGroup: '',
    };
  }

  const trimmed = rawGroup.trim();
  const traitMatch = trimmed.match(/^(.*?)(?:\s*\((?:trait|innate|free)\))$/i);

  if (traitMatch) {
    return {
      baseGroup: traitMatch[1].trim(),
      isTrait: true,
      rawGroup: trimmed,
    };
  }

  return {
    baseGroup: trimmed,
    isTrait: false,
    rawGroup: trimmed,
  };
};

/**
 * Returns true if an item has a (Trait) suffix in its table_group.
 */
export const isTraitItem = (item?: { table_group?: string | null } | null): boolean => {
  if (!item || !item.table_group) return false;
  return parseTableGroup(item.table_group).isTrait;
};

/**
 * Strips the (Trait) suffix to return the clean base table group name.
 */
export const cleanTableGroupName = (rawGroup?: string | null): string => {
  return parseTableGroup(rawGroup).baseGroup;
};

/**
 * Matches an item's table_group against a selected filter.
 * If filter is "Human", matches both "Human" and "Human (Trait)".
 */
export const matchesTableGroupFilter = (
  itemGroup?: string | null,
  selectedFilterGroup?: string | null
): boolean => {
  if (!selectedFilterGroup || selectedFilterGroup === 'all' || selectedFilterGroup === 'All') {
    return true;
  }

  const cleanItemBase = cleanTableGroupName(itemGroup).toLowerCase();
  const cleanFilterBase = cleanTableGroupName(selectedFilterGroup).toLowerCase();

  return cleanItemBase === cleanFilterBase;
};

/**
 * Takes a list of raw table_group strings and returns a sorted, de-duplicated list of base groups.
 */
export const getUniqueBaseTableGroups = (rawGroups: (string | null | undefined)[]): string[] => {
  const set = new Set<string>();
  rawGroups.forEach((g) => {
    if (g && g.trim()) {
      const base = cleanTableGroupName(g);
      if (base) set.add(base);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};
