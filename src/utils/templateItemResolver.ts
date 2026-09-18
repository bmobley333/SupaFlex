// src/utils/templateItemResolver.ts
// Authoritative Resolver & Utility Engine for Template Items with bracketed [Weapon], [Armor], and [Shield] placeholders.

import { compareMsoItems } from './kitUtils';

export type TemplateBracketType = 'weapon' | 'armor' | 'shield';

export const TEMPLATE_BRACKET_REGEX = /\[(Weapon|Armor|Shield)\]/i;

/**
 * Checks if a name contains a template bracket placeholder ([Weapon], [Armor], or [Shield]).
 */
export const hasTemplateBracket = (name?: string | null): boolean => {
  if (!name) return false;
  return TEMPLATE_BRACKET_REGEX.test(name);
};

/**
 * Extracts the target bracket type from a template name ('weapon', 'armor', or 'shield').
 */
export const getTemplateBracketType = (name?: string | null): TemplateBracketType | null => {
  if (!name) return null;
  const match = name.match(TEMPLATE_BRACKET_REGEX);
  if (!match) return null;
  const lower = match[1].toLowerCase();
  if (lower === 'weapon') return 'weapon';
  if (lower === 'armor') return 'armor';
  if (lower === 'shield') return 'shield';
  return null;
};

/**
 * Replaces the bracket placeholder in templateName with baseItemName.
 * E.g. "[Weapon] of Echoes" + "TurboPlaz (mso)" -> "TurboPlaz (mso) of Echoes"
 * E.g. "Flamebrand [Weapon]" + "Broadsword" -> "Flamebrand Broadsword"
 * E.g. "Ember [Armor]" + "Plate Harness" -> "Ember Plate Harness"
 * E.g. "Mirror [Shield]" + "Kite Shield" -> "Mirror Kite Shield"
 */
export const replaceTemplateBracket = (templateName: string, baseItemName: string): string => {
  if (!templateName || !baseItemName) return templateName || '';
  return templateName.replace(TEMPLATE_BRACKET_REGEX, baseItemName.trim());
};

/**
 * Helper to check if an item is an Artifact (cost === 'Artifact' or category === 'Artifact').
 */
export const isArtifactItem = (item: any): boolean => {
  if (!item) return false;
  const cost = String(item.cost || '').toLowerCase().trim();
  const cat = String(item.category || '').toLowerCase().trim();
  const itemType = String(item.item_type || '').toLowerCase().trim();
  return cost === 'artifact' || cat.includes('artifact') || itemType === 'artifact';
};

export interface CatalogCollection {
  weapons: any[];
  armor: any[];
  shields: any[];
}

/**
 * Returns candidate non-artifact base items for resolving a template.
 * Allows both Standard Gear AND Exotics (e.g. TurboPlaz (mso), Pulse Laser Rifle).
 * Strictly excludes Artifacts (cost === 'Artifact') and items that are themselves templates (contain [...]).
 */
export const getNonArtifactCandidates = (
  type: TemplateBracketType,
  catalogs: CatalogCollection,
  isGsUnlocked: boolean = false
): any[] => {
  let pool: any[] = [];
  if (type === 'weapon') pool = catalogs.weapons || [];
  else if (type === 'armor') pool = catalogs.armor || [];
  else if (type === 'shield') pool = catalogs.shields || [];

  const candidates = pool.filter((item) => {
    if (!item || !item.name) return false;
    // Exclude artifacts
    if (isArtifactItem(item)) return false;
    // Exclude recursive template placeholders
    if (hasTemplateBracket(item.name)) return false;
    // If GuildSpace is locked, hide MSO items
    if (!isGsUnlocked && /\(mso\)/i.test(item.name)) return false;
    return true;
  });

  return [...candidates].sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
};
