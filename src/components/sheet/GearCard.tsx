// src/components/sheet/GearCard.tsx
// Dedicated Card & Manager for Adventuring Gear, Weapons, Armor, and Shields (Coin badge omitted for KISS/DRY)

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  Trash2,
  X,
  Search,
  Package,
  Star,
  Loader2,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import {
  SimpleGearItem,
  SupabaseGear,
  SupabaseWeapon,
  SupabaseArmor,
  SupabaseShield,
  MagicItem,
  SupabaseBundle,
  ModItem,
  FunctionItem,
  getCategorySlotWeight,
} from '../../types/game';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { gameApi } from '../../services/api';
import { parseCostToSilver, formatCostAbbreviated, deductFundsWithChange } from '../../utils/moneyUtils';
import { isMsoEntry, compareMsoItems } from '../../utils/kitUtils';
import {
  reconcileCharacterVaultWithGear,
  cleanBelongsToName,
  isModFreeForHost,
  getFunctionsForMod as getFunctionsForModSync,
  getFunctionsForGearItem as getFunctionsForGearItemSync,
} from '../../utils/gearFunctionSync';

export type EquipmentCategoryTab = 'all' | 'supplies' | 'weapons' | 'armor' | 'shields' | 'kits';
export type GearTierFilter = 'ALL' | 'STANDARD' | 'EXOTIC';
export type GearDomainFilter =
  | 'ALL'
  | 'Archaic'
  | 'BioTech'
  | 'CyberTech'
  | 'Tech'
  | 'Psionics'
  | 'Somatics'
  | 'Void Magic';
export type GearViewFilter = 'ALL' | 'STARRED';

/**
 * Calculates total gold and silver inventory value for equipped gear items.
 * Enforces 100s = 1g rule so silver never exceeds 99s.
 */
export const calculateInventoryValue = (gearList: SimpleGearItem[]) => {
  let totalSilver = 0;
  for (const item of gearList) {
    const qty = Math.max(1, item.qty || 1);
    totalSilver += qty * parseCostToSilver(item.cost);
  }
  const gold = Math.floor(totalSilver / 100);
  const silver = totalSilver % 100;
  return { gold, silver, totalSilver };
};

interface GearCardProps {
  className?: string;
}

export const GearCard: React.FC<GearCardProps> = ({ className = '' }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, isGuildSpaceUnlocked: isGsUnlocked } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const rawGearList: SimpleGearItem[] = sheet?.simple_gear || [];
  const gearList: SimpleGearItem[] = useMemo(() => {
    return rawGearList.filter((g) => g && g.name && g.name.trim() !== '');
  }, [rawGearList]);

  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Active Category Tab: all | supplies | weapons | armor | shields | kits
  const [activeCategoryTab, setActiveCategoryTab] = useState<EquipmentCategoryTab>('all');

  // Supabase Catalogs State
  const [gearCatalog, setGearCatalog] = useState<SupabaseGear[]>([]);
  const [weaponsCatalog, setWeaponsCatalog] = useState<SupabaseWeapon[]>([]);
  const [armorCatalog, setArmorCatalog] = useState<SupabaseArmor[]>([]);
  const [shieldsCatalog, setShieldsCatalog] = useState<SupabaseShield[]>([]);
  const [kitsCatalog, setKitsCatalog] = useState<SupabaseBundle[]>([]);
  const [modsCatalog, setModsCatalog] = useState<ModItem[]>([]);
  const [functionsCatalog, setFunctionsCatalog] = useState<FunctionItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Search & Filter State
  const [gearInventorySearchQuery, setGearInventorySearchQuery] = useState<string>('');
  const [gearCatalogSearchQuery, setGearCatalogSearchQuery] = useState<string>('');
  const [gearTierFilter, setGearTierFilter] = useState<GearTierFilter>('ALL');
  const [gearDomainFilter, setGearDomainFilter] = useState<GearDomainFilter>('ALL');
  const [gearViewFilter, setGearViewFilter] = useState<GearViewFilter>('ALL');
  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [gearCatalogFeedback, setGearCatalogFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [expandedCatalogModId, setExpandedCatalogModId] = useState<string | null>(null);
  const [expandedEquippedModIds, setExpandedEquippedModIds] = useState<Set<string>>(new Set());

  // Character Currency & Wallet Funds
  const gold = sheet?.gold ?? 0;
  const silver = sheet?.silver ?? 0;
  const totalAvailableSilver = useMemo(() => (gold * 100) + silver, [gold, silver]);

  // Ephemeral "Not Enough Money" Popover Target State
  const [notEnoughMoneyTarget, setNotEnoughMoneyTarget] = useState<{ id: string; name: string; costStr: string } | null>(null);

  const triggerNotEnoughMoney = useCallback((id: string, name: string, costStr: string, costInSilver: number) => {
    setNotEnoughMoneyTarget({ id, name, costStr });
    setGearCatalogFeedback({
      type: 'error',
      message: `⚠️ Not Enough Money! "${name}" costs ${costStr} (${costInSilver}s), but you only have ${gold}g ${silver}s.`,
    });
    setTimeout(() => {
      setNotEnoughMoneyTarget((prev) => (prev?.id === id ? null : prev));
    }, 2500);
  }, [gold, silver]);

  // Calculate total inventory value (gold & silver, 100s = 1g)
  const inventoryValue = useMemo(() => calculateInventoryValue(gearList), [gearList]);

  // Fetch all Supabase Catalogs concurrently on modal open
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      Promise.all([
        gameApi.getSupplies(),
        gameApi.getWeapons(),
        gameApi.getArmor(),
        gameApi.getShields(),
        gameApi.getBundles(),
        gameApi.getMods(),
        gameApi.getFunctions(),
      ])
        .then(([gearData, weaponsData, armorData, shieldsData, kitsData, modsData, functionsData]) => {
          setGearCatalog(gearData || []);
          setWeaponsCatalog(weaponsData || []);
          setArmorCatalog(armorData || []);
          setShieldsCatalog(shieldsData || []);
          setKitsCatalog(kitsData || []);
          setModsCatalog(modsData || []);
          setFunctionsCatalog(functionsData || []);
        })
        .catch((err) => console.error('Failed to load equipment catalogs:', err))
        .finally(() => setIsLoadingCatalog(false));
    }
  }, [showManageModal]);

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  // Reconcile Function Vault with physically owned simple_gear when Gear Manager opens
  useEffect(() => {
    if (showManageModal && functionsCatalog.length > 0) {
      updateActiveSheetData((prev) => {
        const res = reconcileCharacterVaultWithGear(prev, functionsCatalog, modsCatalog);
        if (res.addedFunctions.length > 0 || res.removedFunctions.length > 0) {
          return res.updatedSheet;
        }
        return prev;
      });
    }
  }, [showManageModal, functionsCatalog, modsCatalog, updateActiveSheetData]);

  // Strict Table- and MSO-aware matcher for mod compatibility
  const isModCompatibleWithItem = useCallback(
    (
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
    },
    []
  );

  // Mods that have at least one function in functionsCatalog
  const modsWithFunctions = useMemo(() => {
    const set = new Set<string>();
    functionsCatalog.forEach((fn) => {
      if (!fn.belongs_to) return;
      const parts = fn.belongs_to.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (/^Mod:\s*/i.test(trimmed)) {
          const cleaned = cleanBelongsToName(trimmed);
          if (cleaned) {
            set.add(cleaned);
            set.add(cleaned.replace(/\(mso\)/gi, '').trim());
          }
        }
      }
    });
    return set;
  }, [functionsCatalog]);

  // Host gear names directly referenced in functionsCatalog
  const functionHostNames = useMemo(() => {
    const set = new Set<string>();
    functionsCatalog.forEach((fn) => {
      if (!fn.belongs_to) return;
      const parts = fn.belongs_to.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!/^Mod:\s*/i.test(trimmed)) {
          const cleaned = cleanBelongsToName(trimmed);
          if (cleaned) {
            set.add(cleaned);
            set.add(cleaned.replace(/\(mso\)/gi, '').trim());
          }
        }
      }
    });
    return set;
  }, [functionsCatalog]);

  // Host gear names referenced in modsCatalog that have a function
  const modFunctionHostNames = useMemo(() => {
    const set = new Set<string>();
    modsCatalog.forEach((m) => {
      const modClean = cleanBelongsToName(m.name || '');
      const modStripped = modClean.replace(/\(mso\)/gi, '').trim();
      const hasFunction = modsWithFunctions.has(modClean) || modsWithFunctions.has(modStripped);
      if (!hasFunction || !m.belongs_to) return;

      const parts = m.belongs_to.split(',');
      for (const part of parts) {
        const cleaned = cleanBelongsToName(part);
        if (cleaned) {
          set.add(cleaned);
          set.add(cleaned.replace(/\(mso\)/gi, '').trim());
        }
      }
    });
    return set;
  }, [modsCatalog, modsWithFunctions]);

  // Canonical Exotic Detection across all gear categories
  const isItemExotic = useCallback(
    (item: any): boolean => {
      if (!item) return false;
      if (item.is_exotic) return true;
      const cat = (item.category || '').toLowerCase();
      if (cat.includes('exotic') || cat.includes('artifact')) return true;
      const costLower = (item.cost || '').toLowerCase();
      if (costLower === 'artifact') return true;

      const rawName = cleanBelongsToName(item.name || '');
      const strippedName = rawName.replace(/\(mso\)/gi, '').trim();
      if (rawName && (functionHostNames.has(rawName) || functionHostNames.has(strippedName))) return true;
      if (rawName && (modFunctionHostNames.has(rawName) || modFunctionHostNames.has(strippedName))) return true;
      return false;
    },
    [functionHostNames, modFunctionHostNames]
  );

  // Helper to find all direct functions belonging to a gear item
  const getFunctionsForGearItem = useCallback(
    (itemName: string): FunctionItem[] => getFunctionsForGearItemSync(itemName, functionsCatalog),
    [functionsCatalog]
  );

  // Helper to find all functions belonging to an installed mod
  const getFunctionsForMod = useCallback(
    (modName: string): FunctionItem[] => getFunctionsForModSync(modName, functionsCatalog),
    [functionsCatalog]
  );

  // Convert FunctionItem to MagicItem for character_vault
  const mapFunctionToVaultItem = useCallback((fn: FunctionItem, hostName: string, modName?: string): MagicItem => {
    let finalGear = hostName;
    let finalMod = modName;
    const parentMatch = hostName.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (!finalMod && parentMatch) {
      finalMod = parentMatch[1];
      finalGear = parentMatch[2];
    }

    return {
      id: typeof fn.id === 'number' ? fn.id : Date.now() + Math.floor(Math.random() * 10000),
      name: fn.name,
      base_name: fn.name.replace(/\s*v\d+$/i, '').trim(),
      version: 1,
      action: (fn.action?.toUpperCase() as any) || 'P',
      usage: fn.usage || '1-Enc',
      effect: fn.effect || '',
      notes: fn.notes || `Inherent function of ${hostName}`,
      source: `Exotic Gear: ${hostName}`,
      source_gear: finalGear,
      source_mod: finalMod,
      created_at: new Date().toISOString(),
      category: fn.tier || (fn as any).category || 'Minor',
      slot_weight: ((fn as any).slot_weight || getCategorySlotWeight(fn.tier || (fn as any).category) || 1) as 1 | 2 | 3 | 4,
      is_hardware: true,
    };
  }, []);

  // Current Raw Catalog for Active Shelf Tab
  const currentRawCatalog = useMemo(() => {
    switch (activeCategoryTab) {
      case 'weapons':
        return weaponsCatalog.map((w: any) => ({ ...w, item_type: 'weapon' as const }));
      case 'armor':
        return armorCatalog.map((a: any) => ({ ...a, item_type: 'armor' as const }));
      case 'shields':
        return shieldsCatalog.map((s: any) => ({ ...s, item_type: 'shield' as const }));
      case 'kits':
        return kitsCatalog.map((k: any) => ({ ...k, item_type: 'kit' as const }));
      case 'supplies':
        return gearCatalog.map((g: any) => ({
          ...g,
          item_type: isItemExotic(g) ? ('exotic' as const) : ('gear' as const),
        }));
      case 'all':
      default: {
        const suppliesItems = gearCatalog.map((g: any) => ({
          ...g,
          item_type: isItemExotic(g) ? ('exotic' as const) : ('gear' as const),
        }));
        const weaponsItems = weaponsCatalog.map((w: any) => ({ ...w, item_type: 'weapon' as const }));
        const armorItems = armorCatalog.map((a: any) => ({ ...a, item_type: 'armor' as const }));
        const shieldsItems = shieldsCatalog.map((s: any) => ({ ...s, item_type: 'shield' as const }));
        const kitsItems = kitsCatalog.map((k: any) => ({ ...k, item_type: 'kit' as const }));
        return [...suppliesItems, ...weaponsItems, ...armorItems, ...shieldsItems, ...kitsItems];
      }
    }
  }, [
    activeCategoryTab,
    gearCatalog,
    weaponsCatalog,
    armorCatalog,
    shieldsCatalog,
    kitsCatalog,
    isItemExotic,
  ]);

  // Starred Items Check
  const isItemStarred = useCallback(
    (targetItem: any) => {
      const sheetData = activeCharacter?.sheet_data;
      if (!sheetData) return false;

      let starredList: (string | number)[] = [];
      if (activeCategoryTab === 'all') {
        starredList = [
          ...(sheetData.starred_gear || []),
          ...(sheetData.starred_weapons || []),
          ...(sheetData.starred_armor || []),
          ...(sheetData.starred_shields || []),
        ];
      } else if (activeCategoryTab === 'weapons') {
        starredList = sheetData.starred_weapons || [];
      } else if (activeCategoryTab === 'armor') {
        starredList = sheetData.starred_armor || [];
      } else if (activeCategoryTab === 'shields') {
        starredList = sheetData.starred_shields || [];
      } else {
        starredList = sheetData.starred_gear || sheetData.starred_armor || [];
      }

      if (!starredList.length) return false;
      const rawName = targetItem.name || '';
      const targetId = targetItem.id;

      return starredList.some((k) => {
        const kStr = String(k);
        if (targetId && kStr === String(targetId)) return true;
        if (kStr === String(rawName)) return true;
        return false;
      });
    },
    [activeCategoryTab, activeCharacter?.sheet_data]
  );

  const handleToggleStarItem = (targetItem: any) => {
    const rawName = targetItem.name || '';
    const itemKey = targetItem.id || rawName;
    const itemType = targetItem.item_type || activeCategoryTab;
    const key =
      itemType === 'weapon' || itemType === 'weapons'
        ? 'starred_weapons'
        : itemType === 'armor'
        ? 'starred_armor'
        : itemType === 'shield' || itemType === 'shields'
        ? 'starred_shields'
        : 'starred_gear';

    updateActiveSheetData((prev: any) => {
      const currentStarred = prev[key] || [];
      const currentlyStarred = isItemStarred(targetItem);
      let updated: (string | number)[];

      if (currentlyStarred) {
        updated = currentStarred.filter((k: any) => {
          const kStr = String(k);
          if (targetItem.id && kStr === String(targetItem.id)) return false;
          if (kStr === String(rawName)) return false;
          return true;
        });
      } else {
        updated = currentStarred.some((k: any) => String(k) === String(itemKey))
          ? currentStarred
          : [...currentStarred, itemKey];
      }

      return {
        ...prev,
        [key]: updated,
      };
    });
    saveActiveCharacter();
  };

  const starredCount = useMemo(() => {
    return currentRawCatalog.filter((item) => isItemStarred(item)).length;
  }, [currentRawCatalog, isItemStarred]);

  // Domain Matcher (Exact canonical match on domain or fallback discipline)
  const matchesDomain = useCallback((item: any, domain: GearDomainFilter): boolean => {
    if (domain === 'ALL') return true;
    const itemDomain = (item.domain || item.discipline || '').toLowerCase().trim();
    return itemDomain === domain.toLowerCase().trim();
  }, []);

  // Filtered Catalog Pipeline
  const filteredCatalog = useMemo(() => {
    const equippedNames = new Set(gearList.map((g) => g.name.toLowerCase()));
    const unequipped = currentRawCatalog.filter((g: any) => {
      if (equippedNames.has(g.name.toLowerCase())) return false;
      const costLower = (g.cost || '').toLowerCase().trim();
      const catLower = (g.category || '').toLowerCase().trim();
      if (costLower === 'artifact' || catLower === 'artifact') return false;
      return true;
    });

    // 1. Genre filter
    let base = unequipped.filter((g) =>
      localGenreFilter === 'ALL' ? true : matchesGenre(g.genres, localGenreFilter as any)
    );

    // 2. Exotic / Tier filter
    if (gearTierFilter === 'STANDARD') {
      base = base.filter((g) => !isItemExotic(g));
    } else if (gearTierFilter === 'EXOTIC') {
      base = base.filter((g) => isItemExotic(g));
    }

    // 3. Domain filter
    if (gearDomainFilter !== 'ALL') {
      base = base.filter((g) => matchesDomain(g, gearDomainFilter));
    }

    // 4. View / Starred filter
    if (gearViewFilter === 'STARRED') {
      base = base.filter((g) => isItemStarred(g));
    }

    // 5. Keyword search filter
    const result = !gearCatalogSearchQuery.trim()
      ? base
      : base.filter((g: any) => {
          const query = gearCatalogSearchQuery.toLowerCase().trim();
          const nameMatch = (g.name || '').toLowerCase().includes(query);
          const catMatch = (g.category || g.domain || g.discipline || g.type || '').toLowerCase().includes(query);
          const noteMatch = (g.notes || '').toLowerCase().includes(query);
          return nameMatch || catMatch || noteMatch;
        });

    return [...result].sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [
    currentRawCatalog,
    gearList,
    gearTierFilter,
    gearDomainFilter,
    gearViewFilter,
    isItemStarred,
    isItemExotic,
    matchesDomain,
    gearCatalogSearchQuery,
    localGenreFilter,
    isGsUnlocked,
  ]);

  // Filtered Equipped Inventory
  const filteredGearInventory = useMemo(() => {
    let list = gearList;
    if (gearInventorySearchQuery.trim()) {
      const query = gearInventorySearchQuery.toLowerCase();
      list = gearList.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.category && item.category.toLowerCase().includes(query)) ||
          (item.notes && item.notes.toLowerCase().includes(query))
      );
    }
    return [...list].sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [gearList, gearInventorySearchQuery, isGsUnlocked]);

  // Equip / Purchase Handler
  const handleEquipItem = (
    catalogItem: any,
    itemType: 'gear' | 'weapon' | 'armor' | 'shield' | 'exotic' | 'kit'
  ) => {
    setGearCatalogFeedback(null);
    const itemName = catalogItem.name;
    const costStr = catalogItem.cost || '0s';
    const costInSilver = parseCostToSilver(costStr);
    const itemKey = String(catalogItem.id || catalogItem.name);

    if (costInSilver > totalAvailableSilver) {
      triggerNotEnoughMoney(itemKey, itemName, costStr, costInSilver);
      return;
    }

    const deduction = deductFundsWithChange(gold, silver, costInSilver);

    if (itemType === 'kit') {
      const kitName = catalogItem.name;
      const matchedGear = gearCatalog.filter((g: any) => g.belongs_to && g.belongs_to.includes(kitName));
      const matchedWeapons = weaponsCatalog.filter((w: any) => w.belongs_to && w.belongs_to.includes(kitName));
      const matchedArmor = armorCatalog.filter((a: any) => a.belongs_to && a.belongs_to.includes(kitName));
      const matchedShields = shieldsCatalog.filter((s: any) => s.belongs_to && s.belongs_to.includes(kitName));

      const newGearItems: SimpleGearItem[] = [
        ...matchedGear.map((g: any) => ({
          id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: g.name,
          category: g.category || 'Kit Item',
          cost: '0s',
          qty: 1,
          notes: g.notes || '',
          item_type: 'gear' as const,
          belongs_to: `Kit: ${kitName} {Free}`,
        })),
        ...matchedWeapons.map((w: any) => ({
          id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: w.name,
          category: 'Weapons',
          cost: '0s',
          qty: 1,
          notes: w.notes || '',
          item_type: 'weapon' as const,
          belongs_to: `Kit: ${kitName} {Free}`,
        })),
        ...matchedArmor.map((a: any) => ({
          id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: a.name,
          category: 'Armor',
          cost: '0s',
          qty: 1,
          notes: a.notes || '',
          item_type: 'armor' as const,
          belongs_to: `Kit: ${kitName} {Free}`,
        })),
        ...matchedShields.map((s: any) => ({
          id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: s.name,
          category: 'Shields',
          cost: '0s',
          qty: 1,
          notes: s.notes || '',
          item_type: 'shield' as const,
          belongs_to: `Kit: ${kitName} {Free}`,
        })),
        {
          id: `kit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: kitName,
          category: '📦 Kits',
          cost: costStr,
          qty: 1,
          notes: catalogItem.notes || 'Equipment Kit package',
          item_type: 'kit' as const,
        },
      ];

      // Collect any real functions from constituent items
      const kitConstituents = [...matchedGear, ...matchedWeapons, ...matchedArmor, ...matchedShields];
      const kitFunctions: MagicItem[] = [];
      kitConstituents.forEach((item) => {
        const fns = getFunctionsForGearItem(item.name);
        fns.forEach((fn) => {
          kitFunctions.push(mapFunctionToVaultItem(fn, item.name));
        });
      });

      updateActiveSheetData((prev) => {
        const currentGear = prev.simple_gear || [];
        const currentVault = prev.character_vault || [];
        const newFunctionsToAdd = kitFunctions.filter(
          (kf) => !currentVault.some((v: any) => cleanBelongsToName(v.name) === cleanBelongsToName(kf.name))
        );
        return {
          ...prev,
          simple_gear: [...currentGear, ...newGearItems],
          character_vault: [...currentVault, ...newFunctionsToAdd],
          gold: deduction.newGold,
          silver: deduction.newSilver,
        };
      });
      saveActiveCharacter();

      setGearCatalogFeedback({
        type: 'success',
        message: `Purchased kit "${kitName}" for ${costStr}! Constituent items added to inventory.`,
      });
      return;
    }

    if (itemType === 'exotic') {
      const existingIndex = gearList.findIndex((g) => g.name.toLowerCase() === itemName.toLowerCase());
      if (existingIndex >= 0) {
        setGearCatalogFeedback({
          type: 'error',
          message: `You already own "${itemName}"!`,
        });
        return;
      }
      const newGearItem: SimpleGearItem = {
        id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: itemName,
        category: '🧿 Exotic',
        cost: costStr,
        qty: 1,
        notes: catalogItem.notes || '',
        item_type: 'exotic',
        genres: catalogItem.genres,
        pic: catalogItem.pic,
      };

      const linkedFns = getFunctionsForGearItem(itemName).map((fn) => mapFunctionToVaultItem(fn, itemName));

      updateActiveSheetData((prev) => {
        const currentVault = prev.character_vault || [];
        const fnsToAdd = linkedFns.filter(
          (lf) => !currentVault.some((v: any) => cleanBelongsToName(v.name) === cleanBelongsToName(lf.name))
        );
        return {
          ...prev,
          simple_gear: [...(prev.simple_gear || []), newGearItem],
          character_vault: [...currentVault, ...fnsToAdd],
          gold: deduction.newGold,
          silver: deduction.newSilver,
        };
      });
      saveActiveCharacter();

      setGearCatalogFeedback({
        type: 'success',
        message: `Purchased Exotic "${itemName}" for ${costStr}! Added to equipment${linkedFns.length ? ' and Function Vault' : ''}.`,
      });
      return;
    }

    const existingIndex = gearList.findIndex(
      (g) => g.name.toLowerCase() === itemName.toLowerCase()
    );

    if (existingIndex >= 0) {
      updateActiveSheetData((prev) => {
        const currentGear = [...(prev.simple_gear || [])];
        currentGear[existingIndex] = {
          ...currentGear[existingIndex],
          qty: (currentGear[existingIndex].qty || 1) + 1,
        };
        return {
          ...prev,
          simple_gear: currentGear,
          gold: deduction.newGold,
          silver: deduction.newSilver,
        };
      });
      saveActiveCharacter();

      setGearCatalogFeedback({
        type: 'success',
        message: `Purchased another "${itemName}" for ${costStr}!`,
      });
      return;
    }

    let defaultCategory = 'General';
    if (itemType === 'weapon') defaultCategory = 'Weapons';
    else if (itemType === 'armor') defaultCategory = 'Armor';
    else if (itemType === 'shield') defaultCategory = 'Shields';
    else if ((catalogItem as SupabaseGear).category) defaultCategory = (catalogItem as SupabaseGear).category;

    const newGearItem: SimpleGearItem = {
      id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: itemName,
      category: defaultCategory,
      cost: costStr,
      qty: 1,
      notes: catalogItem.notes || '',
      item_type: itemType,
      genres: catalogItem.genres,
      pic: catalogItem.pic,
    };

    const linkedFns = getFunctionsForGearItem(itemName).map((fn) => mapFunctionToVaultItem(fn, itemName));

    // Auto-install inherent {Free} mods for this equipped item
    const freeModsForThisItem = modsCatalog.filter((m: any) =>
      isModFreeForHost(m, itemName)
    );

    const freeModGearItems: SimpleGearItem[] = freeModsForThisItem.map((fm: any) => ({
      id: `mod_free_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${fm.name} (${itemName})`,
      category: '🔌 Mod',
      cost: '0s',
      qty: 1,
      notes: fm.notes || `Inherent modification on ${itemName}`,
      item_type: 'gear' as const,
      belongs_to: `${defaultCategory}: ${itemName} {Free}`,
    }));

    const freeModFunctions: MagicItem[] = freeModsForThisItem.flatMap((fm: any) =>
      getFunctionsForMod(fm.name).map((fn) => mapFunctionToVaultItem(fn, itemName, fm.name))
    );

    const allLinkedFns = [...linkedFns, ...freeModFunctions];

    updateActiveSheetData((prev) => {
      const currentGear = prev.simple_gear || [];
      const currentVault = prev.character_vault || [];
      const fnsToAdd = allLinkedFns.filter(
        (lf) => !currentVault.some((v: any) => cleanBelongsToName(v.name) === cleanBelongsToName(lf.name))
      );
      return {
        ...prev,
        simple_gear: [...currentGear, newGearItem, ...freeModGearItems],
        character_vault: [...currentVault, ...fnsToAdd],
        gold: deduction.newGold,
        silver: deduction.newSilver,
      };
    });
    saveActiveCharacter();

    setGearCatalogFeedback({
      type: 'success',
      message: `Purchased "${itemName}" for ${costStr}!`,
    });
  };

  // Purchase Optional Component / Mod on Owned Item
  const handlePurchaseOptionalMod = (modItem: any, parentItemName: string, parentCategory?: string) => {
    const modName = modItem.name;
    const costStr = modItem.cost || '0s';
    const costInSilver = parseCostToSilver(costStr);
    const modKey = String(modItem.id || modItem.name);

    if (costInSilver > totalAvailableSilver) {
      triggerNotEnoughMoney(modKey, modName, costStr, costInSilver);
      return;
    }

    const newModGearItem: SimpleGearItem = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `${modName} (${parentItemName})`,
      category: '🔌 Mod',
      cost: costStr,
      qty: 1,
      notes: modItem.notes || `Installed modification on ${parentItemName}`,
      item_type: 'gear',
      belongs_to: `${parentCategory || 'Gear'}: ${parentItemName}`,
    };

    const modFunctions = getFunctionsForMod(modName).map((fn) =>
      mapFunctionToVaultItem(fn, parentItemName, modName)
    );

    updateActiveSheetData((prev) => {
      const currentGold = prev.gold ?? 0;
      const currentSilver = prev.silver ?? 0;
      const deduction = deductFundsWithChange(currentGold, currentSilver, costInSilver);
      if (!deduction.success) return prev;

      const currentVault = prev.character_vault || [];
      const fnsToAdd = modFunctions.filter(
        (mf) => !currentVault.some((v: any) => cleanBelongsToName(v.name) === cleanBelongsToName(mf.name))
      );
      const intermediateSheet = {
        ...prev,
        simple_gear: [...(prev.simple_gear || []), newModGearItem],
        character_vault: [...currentVault, ...fnsToAdd],
        gold: deduction.newGold,
        silver: deduction.newSilver,
      };

      // Ensure all vault links are cleanly reconciled
      return reconcileCharacterVaultWithGear(intermediateSheet, functionsCatalog, modsCatalog).updatedSheet;
    });
    saveActiveCharacter();

    setGearCatalogFeedback({
      type: 'success',
      message: `Purchased and installed "${modName}" on ${parentItemName} for ${costStr}!`,
    });
  };

  // Helper for Category Badges
  const getCategoryBadgeClass = (category?: string, itemType?: string) => {
    const cat = (category || '').toLowerCase();
    const type = (itemType || '').toLowerCase();
    if (type === 'weapon' || cat.includes('weapon')) {
      return 'bg-rose-950/80 text-rose-300 border-rose-800/80';
    }
    if (type === 'armor' || cat.includes('armor')) {
      return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
    }
    if (type === 'shield' || cat.includes('shield')) {
      return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80';
    }
    if (type === 'exotic' || cat.includes('exotic')) {
      return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
    }
    if (type === 'kit' || cat.includes('kit')) {
      return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
    }
    return 'bg-teal-950/80 text-teal-300 border-teal-800/80';
  };

  const getCategoryDisplayLabel = (category?: string, itemType?: string, cost?: string) => {
    const cat = (category || '').toLowerCase();
    const type = (itemType || '').toLowerCase();
    const costLower = (cost || '').toLowerCase();
    if (type === 'weapon' || cat.includes('weapon')) return '⚔️ Weapons';
    if (type === 'armor' || cat.includes('armor')) return '🥋 Armor';
    if (type === 'shield' || cat.includes('shield')) return '🛡️ Shields';
    if (type === 'artifact' || cat.includes('artifact') || costLower === 'artifact') return '🔮 Artifact';
    if (type === 'exotic' || cat.includes('exotic')) return '🧿 Exotic';
    if (type === 'kit' || cat.includes('kit')) return '📦 Kit';
    return category || '🎒 Supplies';
  };

  const handleDropGear = (itemId: string) => {
    const droppedItem = gearList.find((g) => g.id === itemId);
    if (!droppedItem) return;

    // Find any direct functions or mod functions belonging to this dropped item
    const directFns = getFunctionsForGearItem(droppedItem.name);
    const modFns = getFunctionsForMod(droppedItem.name);

    // Also collect functions of any installed child mods referencing this item
    const droppedMods = gearList.filter(
      (g) =>
        (g.name && g.name.endsWith(`(${droppedItem.name})`)) ||
        (g.belongs_to && g.belongs_to.includes(droppedItem.name))
    );
    const droppedModFns = droppedMods.flatMap((dm) => {
      const baseModName = dm.name.replace(/\s*\([^)]+\)$/, '').trim();
      return getFunctionsForMod(baseModName);
    });

    const allFnNames = new Set([
      ...directFns.map((fn) => cleanBelongsToName(fn.name)),
      ...modFns.map((fn) => cleanBelongsToName(fn.name)),
      ...droppedModFns.map((fn) => cleanBelongsToName(fn.name)),
    ]);

    updateActiveSheetData((prev) => {
      const remainingGear = (prev.simple_gear || []).filter((g) => {
        if (g.id === itemId) return false;
        // Drop installed child mods that belong to this item
        if (g.name && g.name.endsWith(`(${droppedItem.name})`)) return false;
        if (g.belongs_to && g.belongs_to.includes(droppedItem.name)) return false;
        return true;
      });
      const stillHasSameGear = remainingGear.some(
        (g) => cleanBelongsToName(g.name) === cleanBelongsToName(droppedItem.name)
      );

      let updatedVault = prev.character_vault || [];
      let updatedSlots = prev.spell_slots || [];

      if (!stillHasSameGear && allFnNames.size > 0) {
        updatedVault = updatedVault.filter((v: any) => !allFnNames.has(cleanBelongsToName(v.name)));
        updatedSlots = updatedSlots.filter((s: any) => !allFnNames.has(cleanBelongsToName(s.name)));
      }

      return {
        ...prev,
        simple_gear: remainingGear,
        character_vault: updatedVault,
        spell_slots: updatedSlots,
      };
    });
    saveActiveCharacter();
  };

  const handleUpdateGearQty = (itemId: string, delta: number) => {
    const targetItem = (sheet?.simple_gear || gearList).find((g) => g.id === itemId);
    if (!targetItem) return;

    if (delta > 0) {
      setGearCatalogFeedback(null);
      const unitCostStr = targetItem.cost || '0s';
      const unitCostInSilver = parseCostToSilver(unitCostStr);

      if (unitCostInSilver > 0) {
        if (unitCostInSilver > totalAvailableSilver) {
          triggerNotEnoughMoney(targetItem.id, targetItem.name, unitCostStr, unitCostInSilver);
          return;
        }

        const deduction = deductFundsWithChange(gold, silver, unitCostInSilver);
        if (!deduction.success) {
          triggerNotEnoughMoney(targetItem.id, targetItem.name, unitCostStr, unitCostInSilver);
          return;
        }

        updateActiveSheetData((prev) => ({
          ...prev,
          simple_gear: (prev.simple_gear || []).map((g) => {
            if (g.id === itemId) {
              const newQty = (g.qty || 1) + delta;
              return { ...g, qty: newQty };
            }
            return g;
          }),
          gold: deduction.newGold,
          silver: deduction.newSilver,
        }));
        saveActiveCharacter();
        return;
      }
    }

    // delta < 0 or free item (unitCostInSilver === 0)
    // Note: No funds refunded when quantity is reduced (strict no-selling policy)
    updateActiveSheetData((prev) => ({
      ...prev,
      simple_gear: (prev.simple_gear || []).map((g) => {
        if (g.id === itemId) {
          const newQty = Math.max(1, (g.qty || 1) + delta);
          return { ...g, qty: newQty };
        }
        return g;
      }),
    }));
    saveActiveCharacter();
  };

  return (
    <>
      <div className={`bg-gradient-to-b from-teal-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-teal-500/90 p-3.5 flex items-center justify-between transition-all gap-3 flex-wrap shadow-lg shadow-teal-950/20 ${className}`}>
        {/* Left: Title */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Gear Manager"
          >
            <div className="p-1.5 rounded-xl bg-teal-950/90 border border-teal-500/50 text-teal-300 flex items-center justify-center shadow-[0_0_12px_rgba(20,184,166,0.25)] group-hover:scale-105 group-hover:border-teal-400 transition-all">
              <span className="text-base leading-none">⚙️</span>
            </div>
            <span className="font-outfit font-extrabold text-xs tracking-wider text-teal-200 uppercase group-hover:text-white transition-colors flex items-center gap-1">
              <span>Gear</span>
              <ChevronDown className="w-3 h-3 text-teal-400/70 group-hover:text-teal-300 group-hover:translate-y-0.5 transition-all" />
            </span>
          </button>
        </div>

        {/* Right: Manage Gear Action Button */}
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm bg-teal-950/80 hover:bg-teal-900/90 border-teal-500/40 hover:border-teal-400 text-teal-200 hover:text-white cursor-pointer shrink-0 group"
          title="Open Gear Manager"
        >
          <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
        </button>
      </div>

      {/* ⚙️ GEAR MANAGER MODAL */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden text-left"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-500/30 text-teal-300 flex items-center justify-center shadow-[0_0_12px_rgba(20,184,166,0.25)]">
                  <span className="text-lg leading-none">⚙️</span>
                </div>
                <div>
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    Gear Manager
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Manage and purchase supplies, weapons, armor, shields, exotics, and kits from the stock catalog.
                  </p>
                </div>
              </div>

              {/* Currency Funds & Total Value in Header */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Character Wallet Funds Pill */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 border border-amber-500/50 rounded-xl font-mono text-xs font-extrabold text-amber-300 shadow-md shadow-amber-950/30">
                  <span className="text-sm leading-none">💰</span>
                  <span className="text-amber-200">Funds:</span>
                  <span className="text-white">🪙 {gold}g</span>
                  <span className="text-white">🥈 {silver}s</span>
                </div>

                {/* Inventory Total Value Pill in Header */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs font-bold text-teal-300 shadow-inner hidden sm:flex">
                  <span className="text-slate-400 font-sans font-semibold text-[11px]">Gear Value:</span>
                  <span>🪙 {inventoryValue.gold}g 🥈 {inventoryValue.silver}s</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
                title="Close Gear Manager"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2-Column Split-Pane Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
              {/* Left Column: Equipped Gear Inventory */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-outfit font-bold uppercase tracking-wider text-teal-300">
                      Equipped Gear ({gearList.length})
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={gearInventorySearchQuery}
                      onChange={(e) => setGearInventorySearchQuery(e.target.value)}
                      className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-teal-500 w-24 sm:w-32"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2 min-h-0">
                  {filteredGearInventory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                      <Package className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                      <span>No gear items in inventory. Select items from the catalog on the right.</span>
                    </div>
                  ) : (
                    filteredGearInventory.map((item) => {
                      const compatibleMods = modsCatalog.filter((m: any) =>
                        isModCompatibleWithItem(m, item)
                      );
                      const installedModsCount = compatibleMods.filter(
                        (m: any) => isModFreeForHost(m, item.name) || gearList.some((g) => g.name.includes(m.name))
                      ).length;
                      const availableModsCount = compatibleMods.length - installedModsCount;
                      const isModsOpen = expandedEquippedModIds.has(item.id);

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2 shadow-sm"
                        >
                          {/* Top Row: Item Details (Left) and Quantity + Drop (Right) */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-outfit font-bold text-xs inline-flex items-center align-baseline ${
                                  isGsUnlocked && isMsoEntry(item.name) ? 'text-purple-300' : 'text-slate-100'
                                }`}>
                                  <span className="truncate">{isGsUnlocked && isMsoEntry(item.name) ? `🌌 ${item.name}` : item.name}</span>
                                  <ItemNotesPopover notes={item.notes || ''} itemName={item.name} inline />
                                </span>
                                <span
                                  className={`text-[9px] font-mono px-1.5 py-0.2 border rounded ${getCategoryBadgeClass(
                                    item.category,
                                    item.item_type
                                  )}`}
                                >
                                  {getCategoryDisplayLabel(item.category, item.item_type)}
                                </span>
                                {item.belongs_to && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-500/30 truncate max-w-[130px]" title={item.belongs_to}>
                                    🎒 {item.belongs_to.replace(/\{Free\}/g, '').trim()}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-teal-300/80 font-semibold">
                                Cost: {formatCostAbbreviated(item.cost)}
                              </span>
                            </div>

                            {/* Qty & Actions - Permanently locked to the Top Header Row */}
                            <div className="flex items-center gap-1.5 shrink-0 self-start">
                              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-1 py-0.5 text-xs font-mono font-bold">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateGearQty(item.id, -1)}
                                  className="px-1 hover:text-teal-400 text-slate-400 cursor-pointer"
                                  title="Decrease quantity"
                                >
                                  -
                                </button>
                                <span className="px-1 text-white">{item.qty || 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateGearQty(item.id, 1)}
                                  className="px-1 hover:text-teal-400 text-slate-400 cursor-pointer"
                                  title="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDropGear(item.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Drop gear item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Collapsible Compatible Mods Disclosure */}
                          {compatibleMods.length > 0 && (
                            <div className="pt-1 border-t border-slate-800/60 flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedEquippedModIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className="flex items-center justify-between w-full px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 text-[10px] font-mono transition text-slate-300 hover:text-white cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>🔌</span>
                                  <span className="font-bold text-slate-200">Compatible Mods:</span>
                                  <span className="text-emerald-400 font-semibold">{installedModsCount} Installed</span>
                                  {availableModsCount > 0 && (
                                    <>
                                      <span className="text-slate-600">•</span>
                                      <span className="text-indigo-300 font-semibold">{availableModsCount} Available</span>
                                    </>
                                  )}
                                </div>
                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isModsOpen ? 'rotate-180' : ''}`} />
                              </button>

                              {isModsOpen && (
                                <div className="flex flex-col gap-1 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                                  {compatibleMods.map((m: any) => {
                                    const isFree = isModFreeForHost(m, item.name);
                                    const isInstalled = isFree || gearList.some((g) => g.name.includes(m.name));

                                    if (isInstalled) {
                                      return (
                                        <div key={m.id || m.name} className="flex items-center justify-between py-0.5 text-[10px] text-emerald-400">
                                          <span className="inline-flex items-center align-baseline gap-1 font-mono truncate">
                                            <span>✓ {m.name}</span>
                                            <ItemNotesPopover notes={m.notes || ''} itemName={m.name} inline />
                                          </span>
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                                            Installed
                                          </span>
                                        </div>
                                      );
                                    }

                                    const modCostSilver = parseCostToSilver(m.cost);
                                    const canAffordMod = modCostSilver <= totalAvailableSilver;
                                    const modKey = String(m.id || m.name);
                                    const isMsoMod = isGsUnlocked && isMsoEntry(m.name);
                                    const modRowTextColor = isMsoMod ? 'text-purple-300' : 'text-indigo-300';
                                    const formattedCost = (m.cost || '').toLowerCase() === 'artifact' ? 'Artifact' : formatCostAbbreviated(m.cost || '0s');

                                    const modButtonClass = !canAffordMod
                                      ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-500 border-slate-700/80 opacity-60 cursor-not-allowed'
                                      : isMsoMod
                                      ? 'bg-purple-950/80 hover:bg-purple-900 border-purple-500/40 text-purple-200 cursor-pointer shadow-sm'
                                      : 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-500/40 text-indigo-200 cursor-pointer shadow-sm';

                                    return (
                                      <div key={modKey} className="flex items-center justify-between py-1 border-t border-slate-800/40 text-[10px] gap-2">
                                        <span className={`${modRowTextColor} font-semibold inline-flex items-center align-baseline truncate`}>
                                          <span>🔌 {m.name} ({m.cost || '0s'})</span>
                                          <ItemNotesPopover notes={m.notes || ''} itemName={m.name} inline />
                                        </span>
                                        <div className="relative flex items-center shrink-0">
                                          {notEnoughMoneyTarget?.id === modKey && (
                                            <div className="absolute bottom-full right-0 mb-1 z-30 px-2 py-0.5 bg-rose-950 border border-rose-500 rounded-lg shadow-xl text-[9px] font-bold text-rose-200 whitespace-nowrap animate-fadeIn flex items-center gap-1 pointer-events-none">
                                              <span>❌ Not Enough Money</span>
                                            </div>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!canAffordMod) {
                                                triggerNotEnoughMoney(modKey, m.name, m.cost || '0s', modCostSilver);
                                              } else {
                                                handlePurchaseOptionalMod(m, item.name, item.category || item.item_type || 'Gear');
                                              }
                                            }}
                                            className={`px-2 py-0.5 rounded font-bold transition text-[9px] border ${modButtonClass}`}
                                            title={
                                              canAffordMod
                                                ? `Install ${m.name} for ${m.cost || '0s'}`
                                                : `Not Enough Money (Costs ${m.cost || '0s'}, you have ${gold}g ${silver}s)`
                                            }
                                          >
                                            +Mod [{formattedCost}]
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Supabase Stock Multi-Category Catalog */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                {/* 1. 4-Dropdown Filter Strip (Genre, Domain, Exotic, Filter) */}
                <div className="grid grid-cols-4 gap-1.5 mb-2 shrink-0">
                  {/* 1. Genre Filter */}
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] uppercase tracking-wider mb-0.5 px-0.5 truncate transition-colors ${
                      localGenreFilter !== 'ALL' ? 'text-amber-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                    }`}>
                      {localGenreFilter !== 'ALL' && <span className="text-[7px]">●</span>} Genre
                    </span>
                    <select
                      value={localGenreFilter}
                      onChange={(e) => setLocalGenreFilter(e.target.value)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                        localGenreFilter !== 'ALL'
                          ? 'bg-amber-950/90 border-amber-400 text-amber-100 ring-1 ring-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-teal-500'
                      }`}
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                      <option value="Medieval" className="bg-slate-900 text-slate-200">🏰 Medieval</option>
                      <option value="Modern" className="bg-slate-900 text-slate-200">⚙️ Modern</option>
                      <option value="SciFi" className="bg-slate-900 text-slate-200">🚀 SciFi</option>
                    </select>
                  </div>

                  {/* 2. Domain Filter */}
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] uppercase tracking-wider mb-0.5 px-0.5 truncate transition-colors ${
                      gearDomainFilter !== 'ALL' ? 'text-cyan-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                    }`}>
                      {gearDomainFilter !== 'ALL' && <span className="text-[7px]">●</span>} Domain
                    </span>
                    <select
                      value={gearDomainFilter}
                      onChange={(e) => setGearDomainFilter(e.target.value as any)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                        gearDomainFilter !== 'ALL'
                          ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-teal-500'
                      }`}
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                      <option value="Archaic" className="bg-slate-900 text-slate-200">🗡️ Archaic</option>
                      <option value="BioTech" className="bg-slate-900 text-slate-200">🧬 BioTech</option>
                      <option value="CyberTech" className="bg-slate-900 text-slate-200">🦾 CyberTech</option>
                      <option value="Tech" className="bg-slate-900 text-slate-200">⚡ Tech</option>
                      <option value="Psionics" className="bg-slate-900 text-slate-200">🧠 Psionics</option>
                      <option value="Somatics" className="bg-slate-900 text-slate-200">🌀 Somatics</option>
                      <option value="Void Magic" className="bg-slate-900 text-slate-200">🌌 Void Magic</option>
                    </select>
                  </div>

                  {/* 3. Exotic Filter */}
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] uppercase tracking-wider mb-0.5 px-0.5 truncate transition-colors ${
                      gearTierFilter !== 'ALL' ? 'text-indigo-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                    }`}>
                      {gearTierFilter !== 'ALL' && <span className="text-[7px]">●</span>} Exotic
                    </span>
                    <select
                      value={gearTierFilter}
                      onChange={(e) => setGearTierFilter(e.target.value as any)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                        gearTierFilter !== 'ALL'
                          ? 'bg-indigo-950/90 border-indigo-400 text-indigo-100 ring-1 ring-indigo-400/50 shadow-[0_0_12px_rgba(99,102,241,0.3)] font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-teal-500'
                      }`}
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                      <option value="STANDARD" className="bg-slate-900 text-slate-200">⚙️ Standard</option>
                      <option value="EXOTIC" className="bg-slate-900 text-slate-200">🧿 Exotics</option>
                    </select>
                  </div>

                  {/* 4. Filter (formerly View) */}
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] uppercase tracking-wider mb-0.5 px-0.5 truncate transition-colors ${
                      gearViewFilter !== 'ALL' ? 'text-yellow-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                    }`}>
                      {gearViewFilter !== 'ALL' && <span className="text-[7px]">●</span>} Filter
                    </span>
                    <select
                      value={gearViewFilter}
                      onChange={(e) => setGearViewFilter(e.target.value as any)}
                      className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                        gearViewFilter !== 'ALL'
                          ? 'bg-yellow-950/90 border-yellow-400 text-yellow-100 ring-1 ring-yellow-400/50 shadow-[0_0_12px_rgba(250,204,21,0.3)] font-extrabold'
                          : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-teal-500'
                      }`}
                    >
                      <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                      <option value="STARRED" className="bg-slate-900 text-slate-200">⭐ Starred ({starredCount})</option>
                    </select>
                  </div>
                </div>

                {/* 2. Category Multi-Option Pill Switch (KISS Dyslexia-Friendly Standard) */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('all')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'all'
                        ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🌐 All
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('supplies')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'supplies'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🎒 Supplies
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('weapons')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'weapons'
                        ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    ⚔️ Weapons
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('armor')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'armor'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🥋 Armor
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('shields')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'shields'
                        ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🛡️ Shields
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('kits')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'kits'
                        ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    📦 Kits
                  </button>
                </div>

                {/* 3. Search Bar + Dynamic Result Breadcrumb */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80 shrink-0">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Search ${activeCategoryTab === 'all' ? 'all gear' : activeCategoryTab}, categories, notes...`}
                      value={gearCatalogSearchQuery}
                      onChange={(e) => setGearCatalogSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-teal-500"
                    />
                  </div>
                  <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                    {filteredCatalog.length} {filteredCatalog.length === 1 ? 'item' : 'items'}
                  </div>
                </div>

                {/* Zero Matches Feedback & 1-Click Reset */}
                {filteredCatalog.length === 0 && !isLoadingCatalog && (
                  <div className="p-3.5 bg-slate-950/60 rounded-xl border border-teal-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                    <span className="text-teal-300 font-semibold">
                      0 items match active filters
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategoryTab('all');
                        setGearTierFilter('ALL');
                        setLocalGenreFilter(activeGenre || 'SciFi');
                        setGearDomainFilter('ALL');
                        setGearViewFilter('ALL');
                        setGearCatalogSearchQuery('');
                      }}
                      className="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}

                {gearCatalogFeedback && (
                  <div
                    className={`p-2 rounded-lg text-xs font-semibold my-1.5 flex items-center justify-between shrink-0 ${
                      gearCatalogFeedback.type === 'success'
                        ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <span>{gearCatalogFeedback.message}</span>
                    <button
                      type="button"
                      onClick={() => setGearCatalogFeedback(null)}
                      className="p-0.5 hover:opacity-80 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Catalog List */}
                <div className="flex-1 overflow-y-auto pr-1 mt-2 flex flex-col gap-2 min-h-0">
                  {isLoadingCatalog ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                      <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                      <span>Loading stock catalog...</span>
                    </div>
                  ) : filteredCatalog.length === 0 ? null : (
                    filteredCatalog.map((catalogItem: any) => {
                      const starred = isItemStarred(catalogItem);
                      const costStr = catalogItem.cost || '0s';
                      const itemCostSilver = parseCostToSilver(costStr);
                      const canAfford = itemCostSilver <= totalAvailableSilver;

                      const isExoticItem = isItemExotic(catalogItem);
                      const isWeapon = catalogItem.item_type === 'weapon' || activeCategoryTab === 'weapons';
                      const isArmor = catalogItem.item_type === 'armor' || activeCategoryTab === 'armor';
                      const isShield = catalogItem.item_type === 'shield' || activeCategoryTab === 'shields';
                      const isKit = catalogItem.item_type === 'kit' || activeCategoryTab === 'kits';

                      const itemTypeKey: 'gear' | 'weapon' | 'armor' | 'shield' | 'exotic' | 'kit' =
                        catalogItem.item_type ||
                        (activeCategoryTab === 'weapons'
                          ? 'weapon'
                          : activeCategoryTab === 'armor'
                          ? 'armor'
                          : activeCategoryTab === 'shields'
                          ? 'shield'
                          : activeCategoryTab === 'kits'
                          ? 'kit'
                          : isExoticItem
                          ? 'exotic'
                          : 'gear');

                      const itemDomain = catalogItem.domain || catalogItem.discipline;
                      let itemSubtext = catalogItem.category || 'Supplies';
                      if (isWeapon) {
                        itemSubtext = [isExoticItem ? '🧿 Exotic Weapon' : '⚔️ Weapon', catalogItem.type, itemDomain].filter(Boolean).join(' • ') || 'Weapon';
                      } else if (isArmor) {
                        itemSubtext = [isExoticItem ? '🧿 Exotic Armor' : '🥋 Armor', catalogItem.ar ? `AR: ${catalogItem.ar}` : null, itemDomain].filter(Boolean).join(' • ') || 'Armor';
                      } else if (isShield) {
                        itemSubtext = [isExoticItem ? '🧿 Exotic Shield' : '🛡️ Shield', catalogItem.max_block ? `Block: ${catalogItem.max_block}` : null, itemDomain].filter(Boolean).join(' • ') || 'Shield';
                      } else if (isKit) {
                        itemSubtext = ['📦 Kit', catalogItem.category, itemDomain].filter(Boolean).join(' • ') || 'Kit';
                      } else if (isExoticItem) {
                        itemSubtext = ['🧿 Exotic', itemDomain || catalogItem.category].filter(Boolean).join(' • ') || 'Exotic';
                      } else {
                        itemSubtext = ['🎒 Supplies', catalogItem.category || itemDomain].filter(Boolean).join(' • ') || 'Supplies';
                      }

                      const itemKey = `${catalogItem.item_type || activeCategoryTab}_${catalogItem.id || 'x'}_${catalogItem.name}`;
                      const isModsExpanded = expandedCatalogModId === itemKey;
                      const availableMods = modsCatalog.filter((m: any) =>
                        isModCompatibleWithItem(m, {
                          name: catalogItem.name,
                          item_type: itemTypeKey,
                          category: catalogItem.category,
                        })
                      );

                      return (
                        <div
                          key={itemKey}
                          className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-teal-500/40 transition flex flex-col gap-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStarItem(catalogItem)}
                                  className={`p-1 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                                    starred
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-amber-300 hover:border-slate-700'
                                  }`}
                                  title={starred ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                >
                                  <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                                </button>

                                <span className={`font-outfit font-bold text-xs inline-flex items-center align-baseline ${
                                  isGsUnlocked && isMsoEntry(catalogItem.name) ? 'text-purple-300' : 'text-slate-100'
                                }`}>
                                  <span className="truncate">{isGsUnlocked && isMsoEntry(catalogItem.name) ? `🌌 ${catalogItem.name}` : catalogItem.name}</span>
                                  <ItemNotesPopover notes={catalogItem.notes || ''} itemName={catalogItem.name} inline />
                                </span>
                                {availableMods.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedCatalogModId(isModsExpanded ? null : itemKey)}
                                    className="px-1.5 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-500/30 text-[9px] font-mono flex items-center gap-1 cursor-pointer transition shrink-0"
                                    title="Toggle compatible modifications"
                                  >
                                    <span>🔌 {availableMods.length} {availableMods.length === 1 ? 'Mod' : 'Mods'}</span>
                                    <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isModsExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span className="font-mono text-teal-300 font-bold">
                                  {formatCostAbbreviated(costStr)}
                                </span>
                                <span>•</span>
                                <span className="truncate">{itemSubtext}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="relative flex items-center shrink-0">
                                {notEnoughMoneyTarget?.id === itemKey && (
                                  <div className="absolute bottom-full right-0 mb-1.5 z-30 px-2.5 py-1 bg-rose-950 border border-rose-500 rounded-lg shadow-xl text-[10px] font-bold text-rose-200 whitespace-nowrap animate-fadeIn flex items-center gap-1 pointer-events-none">
                                    <span>❌ Not Enough Money</span>
                                    <span className="text-rose-300/80">({notEnoughMoneyTarget.costStr})</span>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!canAfford) {
                                      triggerNotEnoughMoney(itemKey, catalogItem.name, costStr, itemCostSilver);
                                    } else {
                                      handleEquipItem(catalogItem, itemTypeKey);
                                    }
                                  }}
                                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition shrink-0 shadow-sm border ${
                                    !canAfford
                                      ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-500 border-slate-700/80 opacity-60 cursor-not-allowed'
                                      : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/40 text-emerald-300 cursor-pointer'
                                  }`}
                                  title={
                                    canAfford
                                      ? `Purchase ${catalogItem.name} for ${costStr}`
                                      : `Not Enough Money (Costs ${costStr}, you have ${gold}g ${silver}s)`
                                  }
                                >
                                  + Buy
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Inline Expandable Mod Preview */}
                          {isModsExpanded && availableMods.length > 0 && (
                            <div className="mt-1 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5 bg-slate-950/60 p-2 rounded-lg">
                              <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wide flex items-center gap-1">
                                <span>🔌 Compatible Modifications ({availableMods.length}):</span>
                              </span>
                              {availableMods.map((mod: any) => {
                                const isModFree = isModFreeForHost(mod, catalogItem.name);
                                return (
                                  <div
                                    key={mod.id || mod.name}
                                    className="flex items-center justify-between gap-2 text-[10px] bg-slate-900/80 p-1.5 rounded border border-slate-800/80"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-slate-200 font-semibold inline-flex items-center align-baseline truncate">
                                        <span>🔌 {mod.name}</span>
                                        <ItemNotesPopover notes={mod.notes || ''} itemName={mod.name} inline />
                                      </span>
                                      <span className="font-mono text-teal-300 font-bold">
                                        ({isModFree ? 'Free' : formatCostAbbreviated(mod.cost || '0s')})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[9px] text-slate-400 italic">
                                        {isModFree ? 'Inherent to gear' : 'Install once owned'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2.5 text-xs font-mono font-bold flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-500/40 rounded-lg text-amber-300">
                  <span className="text-slate-400 font-sans font-semibold text-[11px]">Available Funds:</span>
                  <span className="text-white">🪙 {gold}g</span>
                  <span className="text-white">🥈 {silver}s</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-teal-300">
                  <span className="text-slate-400 font-sans font-semibold text-[11px]">Total Gear Value:</span>
                  <span>🪙 {inventoryValue.gold}g 🥈 {inventoryValue.silver}s</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManageModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700 transition shadow-sm cursor-pointer text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const EquipmentCard = GearCard;

