// src/utils/gearFunctionSync.ts
// Centralized, authoritative reconciliation engine for physically owned gear in simple_gear
// and character_vault functions.

import {
  CharacterSheetData,
  FunctionItem,
  ModItem,
  MagicItem,
  AbilitySlot,
  SimpleGearItem,
  getCategorySlotWeight,
} from '../types/game';

/**
 * Normalizes belongs_to strings by stripping table/category prefixes
 * such as "Mod:", "Armor:", "Weapon:", "Supplies:", "Equipment:", "Exotic:", "Relic:",
 * and tag markers like {Free}, (x2), etc.
 */
export const cleanBelongsToName = (raw?: string | null): string => {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^[A-Za-z0-9_\-\s]+:\s*/, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\(x\d+\)/gi, '')
    .trim()
    .toLowerCase();
};

/**
 * Checks if a mod is inherently {Free} for a specific physically owned host item.
 */
export const isModFreeForHost = (
  mod: { belongs_to?: string | null },
  hostItemName: string
): boolean => {
  if (!mod.belongs_to || !hostItemName) return false;
  const hostClean = cleanBelongsToName(hostItemName);
  const hostStripped = hostClean.replace(/\(mso\)/gi, '').trim();

  const parts = mod.belongs_to.split(',');
  return parts.some((p) => {
    const trimmed = p.trim();
    if (!/\{free\}/i.test(trimmed)) return false;
    const targetClean = cleanBelongsToName(trimmed);
    const targetStripped = targetClean.replace(/\(mso\)/gi, '').trim();
    return (
      targetClean === hostClean ||
      targetStripped === hostStripped ||
      targetClean === hostStripped ||
      targetStripped === hostClean
    );
  });
};

/**
 * Strict Table- and MSO-aware matcher for mod compatibility with a host gear item.
 */
export const isModCompatibleWithItem = (
  mod: { belongs_to?: string | null },
  item: { name: string; item_type?: string; category?: string }
): boolean => {
  if (!mod.belongs_to || !item.name) return false;
  const itemNameClean = cleanBelongsToName(item.name);
  const itemTypeLower = (item.item_type || item.category || '').toLowerCase();

  const parts = mod.belongs_to.split(',');
  return parts.some((p) => {
    const trimmed = p.trim();
    if (!trimmed) return false;
    const withoutFree = trimmed.replace(/\{free\}/gi, '').trim();
    if (!withoutFree.includes(':')) {
      return cleanBelongsToName(withoutFree) === itemNameClean;
    }
    const [prefix, target] = withoutFree.split(':', 2);
    const prefLower = prefix.trim().toLowerCase();
    const targetClean = cleanBelongsToName(target);

    // Validate table prefix against item type
    if (prefLower === 'armor' && !(itemTypeLower.includes('armor') || itemTypeLower === 'armor')) return false;
    if ((prefLower === 'weapons' || prefLower === 'weapon') && !(itemTypeLower.includes('weapon') || itemTypeLower === 'weapon')) return false;
    if ((prefLower === 'shields' || prefLower === 'shield') && !(itemTypeLower.includes('shield') || itemTypeLower === 'shield')) return false;
    if (prefLower === 'supplies') {
      if (itemTypeLower.includes('armor') || itemTypeLower.includes('weapon') || itemTypeLower.includes('shield') || itemTypeLower.includes('kit')) return false;
    }
    if (prefLower === 'kit' && !itemTypeLower.includes('kit')) return false;

    return targetClean === itemNameClean;
  });
};

/**
 * Resolves all functions belonging to an installed mod.
 * Prefers exact name matches (e.g. MSO variant for MSO mod), falling back to stripped name.
 */
export const getFunctionsForMod = (
  modName: string,
  functionsCatalog: FunctionItem[]
): FunctionItem[] => {
  if (!modName || !functionsCatalog || functionsCatalog.length === 0) return [];
  const cleanMod = cleanBelongsToName(modName);
  const cleanStripped = cleanMod.replace(/\(mso\)/gi, '').trim();

  // First pass: exact matches
  const exactMatches = functionsCatalog.filter((fn) => {
    if (!fn.belongs_to) return false;
    const parts = fn.belongs_to.split(',');
    return parts.some((p) => {
      const trimmed = p.trim();
      if (!/^Mod:\s*/i.test(trimmed)) return false;
      const cleaned = cleanBelongsToName(trimmed);
      return cleaned === cleanMod;
    });
  });

  if (exactMatches.length > 0) return exactMatches;

  // Second pass: stripped (mso) fallback matches
  return functionsCatalog.filter((fn) => {
    if (!fn.belongs_to) return false;
    const parts = fn.belongs_to.split(',');
    return parts.some((p) => {
      const trimmed = p.trim();
      if (!/^Mod:\s*/i.test(trimmed)) return false;
      const cleaned = cleanBelongsToName(trimmed);
      const stripped = cleaned.replace(/\(mso\)/gi, '').trim();
      return (
        cleaned === cleanMod ||
        stripped === cleanStripped ||
        cleaned === cleanStripped ||
        stripped === cleanMod
      );
    });
  });
};

/**
 * Resolves all direct functions belonging to a physically owned gear item.
 */
export const getFunctionsForGearItem = (
  itemName: string,
  functionsCatalog: FunctionItem[]
): FunctionItem[] => {
  if (!itemName || !functionsCatalog || functionsCatalog.length === 0) return [];
  const cleanItem = cleanBelongsToName(itemName);
  const cleanStripped = cleanItem.replace(/\(mso\)/gi, '').trim();

  return functionsCatalog.filter((fn) => {
    if (!fn.belongs_to) return false;
    const parts = fn.belongs_to.split(',');
    return parts.some((p) => {
      const trimmed = p.trim();
      if (/^Mod:\s*/i.test(trimmed)) return false;
      const cleaned = cleanBelongsToName(trimmed);
      const stripped = cleaned.replace(/\(mso\)/gi, '').trim();
      return (
        cleaned === cleanItem ||
        stripped === cleanStripped ||
        cleaned === cleanStripped ||
        stripped === cleanItem
      );
    });
  });
};

/**
 * Converts a FunctionItem into a MagicItem object ready for character_vault.
 */
export const mapFunctionToVaultItem = (
  fn: FunctionItem,
  hostName: string,
  modName?: string
): MagicItem => {
  let finalGear = hostName;
  let finalMod = modName;
  const parentMatch = hostName.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (!finalMod && parentMatch) {
    finalMod = parentMatch[1];
    finalGear = parentMatch[2];
  }

  const sourceDesc = finalMod
    ? `${finalGear} > ${finalMod}`
    : `Exotic Gear: ${finalGear}`;

  return {
    id: typeof fn.id === 'number' ? fn.id : Date.now() + Math.floor(Math.random() * 10000),
    name: fn.name,
    base_name: fn.name.replace(/\s*v\d+$/i, '').trim(),
    version: 1,
    action: (fn.action?.toUpperCase() as any) || 'P',
    usage: fn.usage || '1-Enc',
    effect: fn.effect || '',
    notes: fn.notes || `Inherent function of ${hostName}`,
    source: sourceDesc,
    source_gear: finalGear,
    source_mod: finalMod,
    created_at: new Date().toISOString(),
    category: fn.tier || (fn as any).category || 'Minor',
    slot_weight: (getCategorySlotWeight(fn.tier || (fn as any).category) ?? 1) as 0 | 1 | 2 | 3 | 4,
    is_hardware: true,
  };
};

export interface ReconcileResult {
  updatedSheet: CharacterSheetData;
  addedFunctions: string[];
  removedFunctions: string[];
}

/**
 * Universally reconciles character_vault against physically owned gear in simple_gear.
 * Strictly adheres to the separation mandate: SK cards are martial training only and have
 * ZERO relation to gear custody. All hardware functions stem exclusively from simple_gear.
 */
export const reconcileCharacterVaultWithGear = (
  sheetData: CharacterSheetData | null | undefined,
  functionsCatalog: FunctionItem[] = [],
  modsCatalog: ModItem[] = []
): ReconcileResult => {
  if (!sheetData) {
    return {
      updatedSheet: sheetData as any,
      addedFunctions: [],
      removedFunctions: [],
    };
  }

  // If functions catalog is not loaded, do not modify vault
  if (!functionsCatalog || functionsCatalog.length === 0) {
    return {
      updatedSheet: sheetData,
      addedFunctions: [],
      removedFunctions: [],
    };
  }

  const rawGear: SimpleGearItem[] = Array.isArray(sheetData.simple_gear)
    ? sheetData.simple_gear.filter((g) => g && g.name && g.name.trim() !== '')
    : [];

  // Base host gear items in simple_gear (not child mod items)
  let baseGearItems = rawGear.filter(
    (g) => g.category !== '🔌 Mod' && !/mod_free|mod_/i.test(g.id || '')
  );

  // Installed child mod items in simple_gear (legacy standalone entries)
  const childModItems = rawGear.filter(
    (g) => g.category === '🔌 Mod' || /mod_free|mod_/i.test(g.id || '')
  );

  let gearCleaned = false;

  // Seamless legacy migration: consolidate childModItems into baseGearItems' installed_mods
  if (childModItems.length > 0) {
    gearCleaned = true;
    baseGearItems = baseGearItems.map((base) => {
      const baseClean = cleanBelongsToName(base.name);
      const installedMods = new Set<string>(base.installed_mods || []);

      for (const child of childModItems) {
        const match = child.name.match(/^(.+?)\s*\(([^)]+)\)$/);
        const childModName = match ? match[1].trim() : child.name;
        const parentHostName = match
          ? match[2].trim()
          : child.belongs_to
          ? cleanBelongsToName(child.belongs_to)
          : '';

        if (cleanBelongsToName(parentHostName) === baseClean) {
          // Avoid adding {Free} mods to installed_mods (they are dynamically resolved as inherent)
          const isFree = modsCatalog.some(
            (m) => cleanBelongsToName(m.name) === cleanBelongsToName(childModName) && isModFreeForHost(m, base.name)
          );
          if (!isFree) {
            installedMods.add(childModName);
          }
        }
      }

      return {
        ...base,
        installed_mods: Array.from(installedMods),
      };
    });
  }

  // Collect all functions that should be in the vault based on physical simple_gear ownership
  const expectedFunctions: MagicItem[] = [];

  for (const hostItem of baseGearItems) {
    const hostName = hostItem.name;

    // 1. Direct functions of this gear item
    const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
    for (const fn of directFns) {
      expectedFunctions.push(mapFunctionToVaultItem(fn, hostName));
    }

    // 2. Inherent {Free} mods for this host item
    const freeModsForHost = modsCatalog.filter((m) => isModFreeForHost(m, hostName));
    for (const fm of freeModsForHost) {
      const fns = getFunctionsForMod(fm.name, functionsCatalog);
      for (const fn of fns) {
        expectedFunctions.push(mapFunctionToVaultItem(fn, hostName, fm.name));
      }
    }

    // 3. Purchased aftermarket mods installed on this host item
    if (Array.isArray(hostItem.installed_mods)) {
      for (const modName of hostItem.installed_mods) {
        const fns = getFunctionsForMod(modName, functionsCatalog);
        for (const fn of fns) {
          expectedFunctions.push(mapFunctionToVaultItem(fn, hostName, modName));
        }
      }
    }
  }

  const currentVault: MagicItem[] = Array.isArray(sheetData.character_vault)
    ? [...sheetData.character_vault]
    : [];
  const currentSlots: AbilitySlot[] = Array.isArray(sheetData.spell_slots)
    ? sheetData.spell_slots
    : [];

  const addedFunctions: string[] = [];
  const nextVault: MagicItem[] = [...currentVault];

  for (const expFn of expectedFunctions) {
    const cleanExp = cleanBelongsToName(expFn.name);
    const inVault = nextVault.some((v) => cleanBelongsToName(v.name) === cleanExp);

    if (!inVault) {
      nextVault.push(expFn);
      addedFunctions.push(expFn.name);
    }
  }

  // Ensure any abilities currently equipped in Stance Alpha or Beta are also in the Vault library
  const betaSlots: AbilitySlot[] = Array.isArray(sheetData.stance_beta_slots)
    ? sheetData.stance_beta_slots
    : [];
  const allActiveSlots = [...currentSlots, ...betaSlots];

  for (const slot of allActiveSlots) {
    if (!slot || !slot.name) continue;
    const cleanSlotName = cleanBelongsToName(slot.name);
    const inVault = nextVault.some((v) => cleanBelongsToName(v.name) === cleanSlotName);
    if (!inVault) {
      nextVault.push({
        id: (slot as any).id || Date.now() + Math.floor(Math.random() * 1000),
        name: slot.name,
        base_name: slot.base_name,
        version: slot.version || 1,
        action: slot.action,
        usage: slot.usage,
        effect: slot.effect,
        notes: slot.notes,
        source: (slot as any).source || 'Installed Gear Function',
        source_gear: (slot as any).source_gear,
        source_mod: (slot as any).source_mod,
        created_at: new Date().toISOString(),
        category: (slot as any).category || null,
        slot_weight: (slot as any).slot_weight ?? 1,
        checked_state: slot.checked || [false, false, false],
        is_hardware: true,
      });
    }
  }

  // Pruning: remove hardware functions if their host gear is completely absent from simple_gear
  const allHostNamesClean = new Set(
    baseGearItems.map((g) => cleanBelongsToName(g.name))
  );

  const removedFunctions: string[] = [];
  const finalVault = nextVault.filter((item) => {
    // If not marked as hardware or has no source_gear, preserve it (relics, unattached loot)
    if (!item.is_hardware || !item.source_gear) return true;
    const cleanSource = cleanBelongsToName(item.source_gear);
    // If the host gear is still physically owned, keep the function
    if (allHostNamesClean.has(cleanSource)) return true;

    removedFunctions.push(item.name);
    return false;
  });

  const changed = addedFunctions.length > 0 || removedFunctions.length > 0 || gearCleaned;

  return {
    updatedSheet: changed
      ? {
          ...sheetData,
          simple_gear: gearCleaned ? baseGearItems : sheetData.simple_gear,
          character_vault: finalVault,
        }
      : sheetData,
    addedFunctions,
    removedFunctions,
  };
};
