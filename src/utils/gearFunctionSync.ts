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
/**
 * Resolves all direct functions belonging to a physically owned gear item.
 * Prefers exact name matches, falling back to stripped name.
 */
export const getFunctionsForGearItem = (
  itemName: string,
  functionsCatalog: FunctionItem[]
): FunctionItem[] => {
  if (!itemName || !functionsCatalog || functionsCatalog.length === 0) return [];
  const cleanItem = cleanBelongsToName(itemName);
  const cleanStripped = cleanItem.replace(/\(mso\)/gi, '').trim();

  // First pass: exact matches
  const exactMatches = functionsCatalog.filter((fn) => {
    if (!fn.belongs_to) return false;
    const parts = fn.belongs_to.split(',');
    return parts.some((p) => {
      const trimmed = p.trim();
      if (/^Mod:\s*/i.test(trimmed)) return false;
      const cleaned = cleanBelongsToName(trimmed);
      return cleaned === cleanItem;
    });
  });

  if (exactMatches.length > 0) return exactMatches;

  // Second pass: stripped (mso) fallback matches
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
  if (!finalMod && parentMatch && parentMatch[2].trim().toLowerCase() !== 'mso') {
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
 * Universally reconciles character_vault, spell_slots (Stance A), and stance_beta_slots (Stance B)
 * against physically owned gear in simple_gear.
 * Strictly adheres to the single-source-of-truth mandate:
 * Physical inventory (simple_gear) dictates reality.
 * All hardware functions stem exclusively from physically owned gear and installed mods.
 * When a gear item is dropped or removed, its inherent and installed functions are
 * immediately and deterministically evicted everywhere (Vault, Stance A, Stance B).
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

  // If functions catalog is not loaded yet, avoid destructive modifications
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

  // Base host gear items in simple_gear (not standalone child mod items)
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

  // 1. Collect all valid functions granted by physically owned gear in simple_gear
  const expectedFunctions: MagicItem[] = [];
  const expectedNamesSet = new Set<string>();
  const expectedFnMap = new Map<string, MagicItem>();

  const registerExpected = (fnItem: MagicItem) => {
    const cName = cleanBelongsToName(fnItem.name);
    const sName = cName.replace(/\(mso\)/gi, '').trim();
    if (!expectedNamesSet.has(cName)) {
      expectedFunctions.push(fnItem);
      expectedNamesSet.add(cName);
      expectedNamesSet.add(sName);
      expectedFnMap.set(cName, fnItem);
      expectedFnMap.set(sName, fnItem);
    }
  };

  for (const hostItem of baseGearItems) {
    const hostName = hostItem.name;

    // A. Direct functions of this gear item
    const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
    for (const fn of directFns) {
      registerExpected(mapFunctionToVaultItem(fn, hostName));
    }

    // B. Inherent {Free} mods for this host item
    const freeModsForHost = modsCatalog.filter((m) => isModFreeForHost(m, hostName));
    for (const fm of freeModsForHost) {
      const fns = getFunctionsForMod(fm.name, functionsCatalog);
      for (const fn of fns) {
        registerExpected(mapFunctionToVaultItem(fn, hostName, fm.name));
      }
    }

    // C. Purchased aftermarket mods installed on this host item
    if (Array.isArray(hostItem.installed_mods)) {
      for (const modName of hostItem.installed_mods) {
        const fns = getFunctionsForMod(modName, functionsCatalog);
        for (const fn of fns) {
          registerExpected(mapFunctionToVaultItem(fn, hostName, modName));
        }
      }
    }
  }

  // Helper sets of all known function names and host gear names
  const catalogFunctionNames = new Set<string>();
  const catalogHostNames = new Set<string>();

  for (const fn of functionsCatalog) {
    const c = cleanBelongsToName(fn.name);
    catalogFunctionNames.add(c);
    catalogFunctionNames.add(c.replace(/\(mso\)/gi, '').trim());
    if (fn.belongs_to) {
      const parts = fn.belongs_to.split(',');
      for (const p of parts) {
        const hc = cleanBelongsToName(p);
        if (hc) {
          catalogHostNames.add(hc);
          catalogHostNames.add(hc.replace(/\(mso\)/gi, '').trim());
        }
      }
    }
  }

  for (const m of modsCatalog) {
    const c = cleanBelongsToName(m.name);
    catalogFunctionNames.add(c);
    catalogFunctionNames.add(c.replace(/\(mso\)/gi, '').trim());
    if (m.belongs_to) {
      const parts = m.belongs_to.split(',');
      for (const p of parts) {
        const hc = cleanBelongsToName(p);
        if (hc) {
          catalogHostNames.add(hc);
          catalogHostNames.add(hc.replace(/\(mso\)/gi, '').trim());
        }
      }
    }
  }

  // Helper to check if any item is a hardware function
  const isHardwareFunction = (item: { name?: string; is_hardware?: boolean; source_gear?: string | null; source?: string | null; category?: string | null }): boolean => {
    // Pure Artifacts are standalone magical relics, not hardware chassis mods
    if (item.category && item.category.includes('Artifact')) return false;
    if (item.is_hardware === false) return false;

    if (item.is_hardware === true) return true;
    if (item.source_gear && item.source_gear.trim() !== '') return true;
    const cName = cleanBelongsToName(item.name);
    const sName = cName.replace(/\(mso\)/gi, '').trim();
    if (catalogFunctionNames.has(cName) || catalogFunctionNames.has(sName)) return true;
    if (catalogHostNames.has(cName) || catalogHostNames.has(sName)) return true;
    const src = (item.source || '').toLowerCase();
    if (src.includes('exotic gear') || src.includes('hardware purchase') || src.includes('installed gear function')) return true;
    return false;
  };

  const currentVault: MagicItem[] = Array.isArray(sheetData.character_vault)
    ? sheetData.character_vault
    : [];
  const currentSlotsA: AbilitySlot[] = Array.isArray(sheetData.spell_slots)
    ? sheetData.spell_slots
    : [];
  const currentSlotsB: AbilitySlot[] = Array.isArray(sheetData.stance_beta_slots)
    ? sheetData.stance_beta_slots
    : [];

  const addedFunctions: string[] = [];
  const removedFunctions: string[] = [];
  let metadataHealed = false;

  // 2. Reconcile character_vault
  const finalVault: MagicItem[] = [];
  const vaultProcessedNames = new Set<string>();

  for (const vItem of currentVault) {
    if (!vItem || !vItem.name) continue;
    const cName = cleanBelongsToName(vItem.name);
    const sName = cName.replace(/\(mso\)/gi, '').trim();

    if (isHardwareFunction(vItem)) {
      // Must be currently valid based on simple_gear ownership
      const isExpected = expectedNamesSet.has(cName) || expectedNamesSet.has(sName);
      if (isExpected) {
        // De-duplicate if multiple identical items exist in vault
        if (!vaultProcessedNames.has(cName) && !vaultProcessedNames.has(sName)) {
          vaultProcessedNames.add(cName);
          vaultProcessedNames.add(sName);
          const template = expectedFnMap.get(cName) || expectedFnMap.get(sName);
          const isStaleMso = vItem.source_gear?.trim().toLowerCase() === 'mso';
          if (isStaleMso) metadataHealed = true;
          const validGear = !isStaleMso && vItem.source_gear ? vItem.source_gear : template?.source_gear;
          const validMod = isStaleMso ? template?.source_mod : (vItem.source_mod || template?.source_mod);
          const validSource = isStaleMso || !vItem.source || vItem.source.startsWith('mso >')
            ? (template?.source || `Exotic Gear: ${validGear || 'Owned Gear'}`)
            : vItem.source;

          // Preserve item but ensure robust metadata
          finalVault.push({
            ...vItem,
            is_hardware: true,
            source_gear: validGear,
            source_mod: validMod,
            source: validSource,
          });
        }
      } else {
        // Orphaned hardware function whose host gear is no longer owned
        removedFunctions.push(vItem.name);
      }
    } else {
      // Pure relic, unattached magic item, or custom player power -> preserve
      finalVault.push(vItem);
    }
  }

  // Add any expected functions that were completely missing from the vault
  for (const expFn of expectedFunctions) {
    const cName = cleanBelongsToName(expFn.name);
    const sName = cName.replace(/\(mso\)/gi, '').trim();
    if (!vaultProcessedNames.has(cName) && !vaultProcessedNames.has(sName)) {
      vaultProcessedNames.add(cName);
      vaultProcessedNames.add(sName);
      finalVault.push(expFn);
      addedFunctions.push(expFn.name);
    }
  }

  // 3. Reconcile Stance Alpha (spell_slots)
  const finalSlotsA: AbilitySlot[] = [];
  for (const slot of currentSlotsA) {
    if (!slot || !slot.name) continue;
    const cName = cleanBelongsToName(slot.name);
    const sName = cName.replace(/\(mso\)/gi, '').trim();

    if (isHardwareFunction(slot as any)) {
      const isExpected = expectedNamesSet.has(cName) || expectedNamesSet.has(sName);
      if (isExpected) {
        const template = expectedFnMap.get(cName) || expectedFnMap.get(sName);
        const isStaleMso = (slot as any).source_gear?.trim().toLowerCase() === 'mso';
        if (isStaleMso) metadataHealed = true;
        const validGear = !isStaleMso && (slot as any).source_gear ? (slot as any).source_gear : template?.source_gear;
        const validMod = isStaleMso ? template?.source_mod : ((slot as any).source_mod || template?.source_mod);
        finalSlotsA.push({
          ...slot,
          is_hardware: true,
          source_gear: validGear,
          source_mod: validMod,
          source: isStaleMso || !(slot as any).source || (slot as any).source.startsWith('mso >')
            ? (template?.source || `Exotic Gear: ${validGear || 'Owned Gear'}`)
            : (slot as any).source,
        } as any);
      } else {
        // Evicted from Stance Alpha because host gear was dropped!
        removedFunctions.push(`${slot.name} (from Stance Alpha)`);
      }
    } else {
      finalSlotsA.push(slot);
    }
  }

  // 4. Reconcile Stance Beta (stance_beta_slots)
  const finalSlotsB: AbilitySlot[] = [];
  for (const slot of currentSlotsB) {
    if (!slot || !slot.name) continue;
    const cName = cleanBelongsToName(slot.name);
    const sName = cName.replace(/\(mso\)/gi, '').trim();

    if (isHardwareFunction(slot as any)) {
      const isExpected = expectedNamesSet.has(cName) || expectedNamesSet.has(sName);
      if (isExpected) {
        const template = expectedFnMap.get(cName) || expectedFnMap.get(sName);
        const isStaleMso = (slot as any).source_gear?.trim().toLowerCase() === 'mso';
        if (isStaleMso) metadataHealed = true;
        const validGear = !isStaleMso && (slot as any).source_gear ? (slot as any).source_gear : template?.source_gear;
        const validMod = isStaleMso ? template?.source_mod : ((slot as any).source_mod || template?.source_mod);
        finalSlotsB.push({
          ...slot,
          is_hardware: true,
          source_gear: validGear,
          source_mod: validMod,
          source: isStaleMso || !(slot as any).source || (slot as any).source.startsWith('mso >')
            ? (template?.source || `Exotic Gear: ${validGear || 'Owned Gear'}`)
            : (slot as any).source,
        } as any);
      } else {
        // Evicted from Stance Beta because host gear was dropped!
        removedFunctions.push(`${slot.name} (from Stance Beta)`);
      }
    } else {
      finalSlotsB.push(slot);
    }
  }

  const changed =
    addedFunctions.length > 0 ||
    removedFunctions.length > 0 ||
    gearCleaned ||
    metadataHealed ||
    finalVault.length !== currentVault.length ||
    finalSlotsA.length !== currentSlotsA.length ||
    finalSlotsB.length !== currentSlotsB.length;

  return {
    updatedSheet: changed
      ? {
          ...sheetData,
          simple_gear: gearCleaned ? baseGearItems : sheetData.simple_gear,
          character_vault: finalVault,
          spell_slots: finalSlotsA,
          stance_beta_slots: finalSlotsB,
        }
      : sheetData,
    addedFunctions,
    removedFunctions,
  };
};
