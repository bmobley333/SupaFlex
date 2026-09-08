// src/utils/functionSourceHelper.ts
// Universal resolution engine to determine host Equipment & composite name for Functions

import { AbilitySlot, MagicItem, FunctionItem, ModItem, Character, parseAbilityVersion } from '../types/game';
import { compareMsoOptions } from './kitUtils';
import { getItemSlotWeight } from './loadoutCapacitySchedule';

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
  // Strip table classification prefixes including Exotic and Relic
  s = s.replace(/^(Gear|Armor|Weapon|Equipment|Supplies|Mod|Exotic|Relic):\s*/i, '');
  // Clean whitespace and edge punctuation
  s = s.trim().replace(/^,+|,+$/g, '').trim();
  return s;
};

/**
 * Cleans gear name while strictly PRESERVING (mso) if it exists on the gear item
 */
export const cleanGearTextKeepMso = (name?: string | null): string => {
  if (!name) return '';
  let s = String(name);
  // Strip {Free} and variants
  s = s.replace(/\{free\}/gi, '');
  // Strip table classification prefixes including Exotic and Relic
  s = s.replace(/^(Gear|Armor|Weapon|Equipment|Supplies|Mod|Exotic|Relic):\s*/i, '');
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
    const gearName = cleanGearTextKeepMso(explicitGear);
    const modName = explicitMod ? cleanSourceText(explicitMod) : undefined;
    const badgeText = modName ? `${cleanSourceText(gearName)}, ${modName}` : cleanSourceText(gearName);
    return { gearName, modName, badgeText };
  }

  // Tier 2: Check embedded source string (e.g. "Exotic Gear: Mod (Host)")
  const rawSource = (item as any).source || (item as any).notes || '';
  if (typeof rawSource === 'string' && (rawSource.includes('Exotic Gear:') || rawSource.includes('Inherent function of'))) {
    const afterPrefix = rawSource
      .replace(/^.*Exotic Gear:\s*/i, '')
      .replace(/^.*Inherent function of\s*/i, '')
      .trim();

    // Check for "ModName (ParentGearName)"
    const parentMatch = afterPrefix.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parentMatch) {
      const modName = cleanSourceText(parentMatch[1]);
      const gearName = cleanGearTextKeepMso(parentMatch[2]);
      if (gearName) {
        return {
          gearName,
          modName: modName || undefined,
          badgeText: modName ? `${cleanSourceText(gearName)}, ${modName}` : cleanSourceText(gearName),
        };
      }
    } else {
      const gearName = cleanGearTextKeepMso(afterPrefix);
      if (gearName && !gearName.toLowerCase().includes('hardware purchase') && !gearName.toLowerCase().includes('unequipped')) {
        return { gearName, badgeText: cleanSourceText(gearName) };
      }
    }
  }

  // Tier 3: Catalog cross-reference
  const rawItemName = item.name || '';
  const itemNorm = normalizeBaseName(rawItemName);
  if (!itemNorm && !(item as any).effect) return null;

  let catalogFn = itemNorm ? functionsCatalog.find((fn) => normalizeBaseName(fn.name) === itemNorm) : undefined;
  if (!catalogFn && (item as any).effect && functionsCatalog.length > 0) {
    const trimmedEffect = (item as any).effect.trim().toLowerCase();
    catalogFn = functionsCatalog.find((fn) => fn.effect && fn.effect.trim().toLowerCase() === trimmedEffect);
  }

  if (!catalogFn || !catalogFn.belongs_to) {
    // If no catalog match and explicitMod was set, fallback
    if (explicitMod) {
      const modName = cleanSourceText(explicitMod);
      return { gearName: '', modName, badgeText: modName };
    }
    return null;
  }

  // Parse belongs_to string using regex to preserve item names that contain commas (e.g. "Crawler, Personal (mso)")
  const parts = catalogFn.belongs_to.split(/,\s*(?=[A-Za-z]+:)/).map((p) => p.trim()).filter(Boolean);
  const gearCandidates: string[] = [];
  const modCandidates: string[] = [];

  for (const part of parts) {
    if (/^Mod:/i.test(part)) {
      modCandidates.push(part.replace(/^Mod:\s*/i, '').trim());
    } else if (/^(Gear|Armor|Weapon|Equipment|Supplies|Exotic|Relic):/i.test(part)) {
      gearCandidates.push(part.replace(/^(Gear|Armor|Weapon|Equipment|Supplies|Exotic|Relic):\s*/i, '').trim());
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
      const modHostParts = catalogMod.belongs_to.split(/,\s*(?=[A-Za-z]+:)/).map((p) => p.trim()).filter(Boolean);
      const hostGears = modHostParts.map((p) => p.replace(/^(Gear|Armor|Weapon|Equipment|Supplies|Exotic|Relic):\s*/i, '').trim());

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

  const cleanGear = cleanGearTextKeepMso(resolvedGear);
  const cleanMod = cleanSourceText(resolvedMod);

  if (cleanGear && cleanMod) {
    return {
      gearName: cleanGear,
      modName: cleanMod,
      badgeText: `${cleanSourceText(cleanGear)}, ${cleanMod}`,
    };
  }

  if (cleanGear) {
    return {
      gearName: cleanGear,
      badgeText: cleanSourceText(cleanGear),
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
 * Formats the composite Function Card Name:
 * "[main gear name] • [Function Name]" (skipping mod name entirely).
 * - Gear keeps (mso) if it exists.
 * - Function name drops (mso).
 * - De-duplicates identical gear & function names (e.g. "Banner of Eternity").
 */
export const formatCompositeFunctionName = (
  item: AbilitySlot | MagicItem | FunctionItem | null | undefined,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = [],
  activeCharacter?: Character | null,
  delimiter: string = ' • '
): string => {
  if (!item) return '';

  const rawItemName = item.name || '';
  const itemNorm = normalizeBaseName(rawItemName);

  // 1. Resolve host gear
  const source = resolveFunctionSource(item, functionsCatalog, modsCatalog, activeCharacter);

  // 2. Resolve actual function name (dropping mso and versions)
  let catalogFn = itemNorm ? functionsCatalog.find((fn) => normalizeBaseName(fn.name) === itemNorm) : undefined;
  if (!catalogFn && (item as any).effect && functionsCatalog.length > 0) {
    const trimmedEffect = (item as any).effect.trim().toLowerCase();
    catalogFn = functionsCatalog.find((fn) => fn.effect && fn.effect.trim().toLowerCase() === trimmedEffect);
  }

  const actualFunctionName = cleanSourceText(catalogFn?.name || rawItemName.replace(/\s*v\d+$/i, ''));

  const gearDisplay = source?.gearName ? cleanGearTextKeepMso(source.gearName) : '';

  // If no gear origin resolved, fallback to clean function name
  if (!gearDisplay) {
    return actualFunctionName || cleanSourceText(rawItemName);
  }

  // De-duplication check: If gear name and function name are identical (e.g. Banner of Eternity)
  const cleanGearNoMso = cleanSourceText(gearDisplay).toLowerCase();
  const cleanFnNoMso = actualFunctionName.toLowerCase();
  if (cleanGearNoMso === cleanFnNoMso) {
    return gearDisplay;
  }

  return `${gearDisplay}${delimiter}${actualFunctionName}`;
};

/**
 * Helper to match a search query against a function's composite name and origin
 */
export const matchFunctionSourceSearch = (
  query: string,
  item: AbilitySlot | MagicItem | FunctionItem | null | undefined,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = [],
  activeCharacter?: Character | null
): boolean => {
  if (!query.trim() || !item) return false;
  const q = query.toLowerCase().trim();
  const compositeTitle = formatCompositeFunctionName(item, functionsCatalog, modsCatalog, activeCharacter);
  if (compositeTitle.toLowerCase().includes(q)) return true;
  const source = resolveFunctionSource(item, functionsCatalog, modsCatalog, activeCharacter);
  if (!source) return false;
  return (
    source.badgeText.toLowerCase().includes(q) ||
    source.gearName.toLowerCase().includes(q) ||
    (source.modName ? source.modName.toLowerCase().includes(q) : false)
  );
};

/**
 * Resolves an appropriate icon for the parent gear (Armor, Shield, Weapon, or Tech).
 */
export const getGearIcon = (gearName?: string | null, activeCharacter?: Character | null): string => {
  if (!gearName) return '⚙️';
  const norm = gearName.toLowerCase().trim();
  const sheetData = activeCharacter?.sheet_data;
  if (sheetData) {
    if (sheetData.armor_slot?.name?.toLowerCase().includes(norm)) return '🛡️';
    if (sheetData.shield_slot?.name?.toLowerCase().includes(norm)) return '🛡️';
    if ((sheetData.weapons || []).some((w: any) => w?.name?.toLowerCase().includes(norm))) return '⚔️';
  }
  if (norm.includes('armor') || norm.includes('suit') || norm.includes('plate') || norm.includes('vest') || norm.includes('helm') || norm.includes('exoskeleton')) {
    return '🛡️';
  }
  if (norm.includes('shield')) {
    return '🛡️';
  }
  if (norm.includes('blade') || norm.includes('sword') || norm.includes('rifle') || norm.includes('cannon') || norm.includes('pistol') || norm.includes('bow') || norm.includes('gun') || norm.includes('axe') || norm.includes('dagger')) {
    return '⚔️';
  }
  return '⚙️';
};

export interface FunctionItemInfo<T = any> {
  item: T;
  cleanFnName: string;
  gearName: string | null;
  gearIcon: string;
  version: number;
  baseName: string;
  compositeName: string;
}

export interface FunctionGroupSection<T = any> {
  key: string;
  isGroup: boolean;
  gearName?: string;
  gearIcon?: string;
  items: FunctionItemInfo<T>[];
  totalSlots: number;
  otherPaneCount: number;
}

/**
 * Resolves a function item's parent gear and clean display name.
 */
export const resolveFunctionItemInfo = <T extends { name?: string; effect?: string | null; [key: string]: any }>(
  item: T,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = [],
  activeCharacter?: Character | null
): FunctionItemInfo<T> => {
  const source = resolveFunctionSource(item as any, functionsCatalog, modsCatalog, activeCharacter);
  const compositeName = formatCompositeFunctionName(item as any, functionsCatalog, modsCatalog, activeCharacter, ' • ');

  let gearName: string | null = null;
  if (source?.gearName) {
    gearName = cleanGearTextKeepMso(source.gearName);
  } else if (compositeName.includes(' • ')) {
    gearName = compositeName.split(' • ')[0].trim();
  }

  let cleanFnName = compositeName;
  if (gearName) {
    const escaped = gearName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanFnName = cleanFnName.replace(new RegExp(`^${escaped}\\s*•\\s*`, 'i'), '').trim();
    if (!cleanFnName || cleanFnName.toLowerCase() === gearName.toLowerCase()) {
      cleanFnName = cleanSourceText(item.name || '');
    }
  }

  const parsed = parseAbilityVersion(cleanFnName);
  const gearIcon = gearName ? getGearIcon(gearName, activeCharacter) : '⚙️';

  return {
    item,
    cleanFnName: parsed.baseName || cleanFnName,
    gearName,
    gearIcon,
    version: parsed.version || 1,
    baseName: parsed.baseName || cleanFnName,
    compositeName,
  };
};

/**
 * Groups active or vault functions by parent gear under Option A (Threshold 2+):
 * - If 2+ functions share the same host gear, groups them into a collapsible parent container.
 * - If only 1 function belongs to the host gear, emits as a single item with a subtle host badge.
 * - Standalone functions (no host gear) are emitted as standard items.
 */
export const groupFunctionsByParent = <T extends { name?: string; effect?: string | null; [key: string]: any }>(
  items: T[],
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = [],
  activeCharacter?: Character | null,
  otherPaneItems: any[] = [],
  isGsUnlocked: boolean = false
): FunctionGroupSection<T>[] => {
  // 1. Resolve item info for every item in list
  const itemInfos: FunctionItemInfo<T>[] = items.map((item) =>
    resolveFunctionItemInfo(item, functionsCatalog, modsCatalog, activeCharacter)
  );

  // 2. Group by gearName (if present) or standalone
  const gearMap = new Map<string, FunctionItemInfo<T>[]>();
  const standaloneItems: FunctionItemInfo<T>[] = [];

  for (const info of itemInfos) {
    if (info.gearName) {
      const key = info.gearName.trim();
      const existing = gearMap.get(key) || [];
      existing.push(info);
      gearMap.set(key, existing);
    } else {
      standaloneItems.push(info);
    }
  }

  // 3. Build sections
  const sections: FunctionGroupSection<T>[] = [];

  // Handle gear groups
  for (const [gearName, gearItems] of gearMap.entries()) {
    // Count how many items for this gearName exist in otherPaneItems
    let otherPaneCount = 0;
    if (otherPaneItems && otherPaneItems.length > 0) {
      const gNorm = gearName.toLowerCase().trim();
      otherPaneCount = otherPaneItems.filter((other) => {
        const otherInfo = resolveFunctionItemInfo(other, functionsCatalog, modsCatalog, activeCharacter);
        return otherInfo.gearName && otherInfo.gearName.toLowerCase().trim() === gNorm;
      }).length;
    }

    if (gearItems.length >= 2) {
      // Threshold 2+: Create Parent Group Section
      const totalSlots = gearItems.reduce((sum, i) => {
        return sum + getItemSlotWeight(i.item);
      }, 0);

      // Sort items inside group alphabetically by cleanFnName
      const sortedChildItems = [...gearItems].sort((a, b) => {
        return compareMsoOptions(a.cleanFnName, b.cleanFnName, isGsUnlocked);
      });

      sections.push({
        key: `group:${gearName}`,
        isGroup: true,
        gearName,
        gearIcon: gearItems[0].gearIcon,
        items: sortedChildItems,
        totalSlots,
        otherPaneCount,
      });
    } else {
      // Threshold not met (only 1 function for this gear in this pane):
      // Emit as single item with host badge
      const single = gearItems[0];
      const totalSlots = getItemSlotWeight(single.item);
      sections.push({
        key: `single:${gearName}:${single.cleanFnName}`,
        isGroup: false,
        gearName,
        gearIcon: single.gearIcon,
        items: [single],
        totalSlots,
        otherPaneCount,
      });
    }
  }

  // Handle standalone items (no gearName)
  for (let i = 0; i < standaloneItems.length; i++) {
    const single = standaloneItems[i];
    const totalSlots = getItemSlotWeight(single.item);
    sections.push({
      key: `standalone:${single.cleanFnName}:${i}`,
      isGroup: false,
      items: [single],
      totalSlots,
      otherPaneCount: 0,
    });
  }

  // 4. Sort top-level sections alphabetically
  sections.sort((a, b) => {
    const titleA = a.isGroup ? (a.gearName || '') : (a.items[0]?.cleanFnName || '');
    const titleB = b.isGroup ? (b.gearName || '') : (b.items[0]?.cleanFnName || '');
    return compareMsoOptions(titleA, titleB, isGsUnlocked);
  });

  return sections;
};
