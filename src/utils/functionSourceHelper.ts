// src/utils/functionSourceHelper.ts
// Universal resolution engine to determine host Equipment & Mod source for Functions

import { AbilitySlot, MagicItem, FunctionItem, ModItem, Character } from '../types/game';

export interface FunctionSourceResult {
  gearName: string;
  modName?: string;
  badgeText: string;
}

/**
 * Strips noise such as (mso), {Free}, and table prefixes from item/mod names
 */
export const cleanSourceText = (name?: string | null): string => {
  if (!name) return '';
  let s = String(name);
  // Strip {Free} and variants
  s = s.replace(/\{free\}/gi, '');
  // Strip (mso)
  s = s.replace(/\(mso\)/gi, '');
  // Strip table classification prefixes
  s = s.replace(/^(Gear|Armor|Weapon|Equipment|Supplies|Mod):\s*/i, '');
  // Clean whitespace and edge punctuation
  s = s.trim().replace(/^,+|,+$/g, '').trim();
  return s;
};

/**
 * Normalizes a function or item name for catalog matching
 */
const normalizeBaseName = (name: string): string => {
  return cleanSourceText(name)
    .replace(/\s*v\d+$/i, '')
    .trim()
    .toLowerCase();
};

/**
 * Resolves the host gear and installed mod origin for any Function item.
 * Adheres to S-Tier multi-tier resolution:
 * 1. Explicit stamps (`source_gear`, `source_mod`)
 * 2. Embedded source strings (`Exotic Gear: ModName (ParentGearName)`)
 * 3. Catalog cross-referencing via `functionsCatalog` and `modsCatalog`
 */
export const resolveFunctionSource = (
  item: AbilitySlot | MagicItem | FunctionItem | null | undefined,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = [],
  activeCharacter?: Character | null
): FunctionSourceResult | null => {
  if (!item) return null;

  // Tier 1: Explicit metadata stamps
  const explicitGear = (item as any).source_gear;
  const explicitMod = (item as any).source_mod;
  if (explicitGear) {
    const gearName = cleanSourceText(explicitGear);
    const modName = explicitMod ? cleanSourceText(explicitMod) : undefined;
    const badgeText = modName ? `${gearName}, ${modName}` : gearName;
    return { gearName, modName, badgeText };
  }

  // Tier 2: Check embedded source string (e.g. "Exotic Gear: Mod (Host)")
  const rawSource = (item as any).source || (item as any).notes || '';
  if (typeof rawSource === 'string' && rawSource.includes('Exotic Gear:')) {
    const afterPrefix = rawSource.replace(/^.*Exotic Gear:\s*/i, '').trim();
    // Check for "ModName (ParentGearName)"
    const parentMatch = afterPrefix.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parentMatch) {
      const modName = cleanSourceText(parentMatch[1]);
      const gearName = cleanSourceText(parentMatch[2]);
      if (gearName) {
        return {
          gearName,
          modName: modName || undefined,
          badgeText: modName ? `${gearName}, ${modName}` : gearName,
        };
      }
    } else {
      const gearName = cleanSourceText(afterPrefix);
      if (gearName && !gearName.toLowerCase().includes('hardware purchase') && !gearName.toLowerCase().includes('unequipped')) {
        return { gearName, badgeText: gearName };
      }
    }
  }

  // Tier 3: Catalog cross-reference
  const rawItemName = item.name || '';
  const itemNorm = normalizeBaseName(rawItemName);
  if (!itemNorm) return null;

  const catalogFn = functionsCatalog.find((fn) => normalizeBaseName(fn.name) === itemNorm);
  if (!catalogFn || !catalogFn.belongs_to) {
    // If no catalog match and explicitMod was set, fallback
    if (explicitMod) {
      const modName = cleanSourceText(explicitMod);
      return { gearName: '', modName, badgeText: modName };
    }
    return null;
  }

  // Parse belongs_to string (e.g. "Mod: Suit Biometer (mso), Gear: Biometer (mso)")
  const parts = catalogFn.belongs_to.split(',').map((p) => p.trim()).filter(Boolean);
  const gearCandidates: string[] = [];
  const modCandidates: string[] = [];

  for (const part of parts) {
    if (/^Mod:/i.test(part)) {
      modCandidates.push(part.replace(/^Mod:\s*/i, '').trim());
    } else if (/^(Gear|Armor|Weapon|Equipment|Supplies):/i.test(part)) {
      gearCandidates.push(part.replace(/^(Gear|Armor|Weapon|Equipment|Supplies):\s*/i, '').trim());
    } else {
      gearCandidates.push(part.trim());
    }
  }

  let resolvedGear: string | null = gearCandidates.length > 0 ? gearCandidates[0] : null;
  const resolvedMod: string | null = modCandidates.length > 0 ? modCandidates[0] : null;

  // If mod exists but no gear candidate in function belongs_to, look up mod in modsCatalog
  if (!resolvedGear && resolvedMod) {
    const modNorm = normalizeBaseName(resolvedMod);
    const catalogMod = modsCatalog.find((m) => normalizeBaseName(m.name) === modNorm);
    if (catalogMod && catalogMod.belongs_to) {
      const modHostParts = catalogMod.belongs_to.split(',').map((p) => p.trim()).filter(Boolean);
      const hostGears = modHostParts.map((p) => p.replace(/^(Gear|Armor|Weapon|Equipment|Supplies):\s*/i, '').trim());

      // If active character is available, check if the character owns any of these compatible gear/armor items
      if (activeCharacter?.sheet_data) {
        const ownedItems: string[] = [];
        const simpleGear = activeCharacter.sheet_data.simple_gear || [];
        simpleGear.forEach((g: any) => {
          if (g?.name) ownedItems.push(normalizeBaseName(g.name));
        });
        const armor = activeCharacter.sheet_data.armor_slot;
        if (armor?.name) ownedItems.push(normalizeBaseName(armor.name));
        const shield = activeCharacter.sheet_data.shield_slot;
        if (shield?.name) ownedItems.push(normalizeBaseName(shield.name));
        const weaponList = activeCharacter.sheet_data.weapons || [];
        weaponList.forEach((w: any) => {
          if (w?.name) ownedItems.push(normalizeBaseName(w.name));
        });

        const ownedMatch = hostGears.find((hg) => ownedItems.includes(normalizeBaseName(hg)));
        if (ownedMatch) {
          resolvedGear = ownedMatch;
        }
      }

      // Default to first host gear in mod's belongs_to
      if (!resolvedGear && hostGears.length > 0) {
        resolvedGear = hostGears[0];
      }
    }
  }

  const cleanGear = cleanSourceText(resolvedGear);
  const cleanMod = cleanSourceText(resolvedMod);

  if (cleanGear && cleanMod) {
    return {
      gearName: cleanGear,
      modName: cleanMod,
      badgeText: `${cleanGear}, ${cleanMod}`,
    };
  }

  if (cleanGear) {
    return {
      gearName: cleanGear,
      badgeText: cleanGear,
    };
  }

  if (cleanMod) {
    return {
      gearName: '',
      modName: cleanMod,
      badgeText: cleanMod,
    };
  }

  return null;
};

/**
 * Helper to match a search query against a function's resolved source badge
 */
export const matchFunctionSourceSearch = (
  query: string,
  item: AbilitySlot | MagicItem | FunctionItem | null | undefined,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = [],
  activeCharacter?: Character | null
): boolean => {
  if (!query.trim() || !item) return false;
  const source = resolveFunctionSource(item, functionsCatalog, modsCatalog, activeCharacter);
  if (!source) return false;
  const q = query.toLowerCase().trim();
  return (
    source.badgeText.toLowerCase().includes(q) ||
    source.gearName.toLowerCase().includes(q) ||
    (source.modName ? source.modName.toLowerCase().includes(q) : false)
  );
};
