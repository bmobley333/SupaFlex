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
} from '../../types/game';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { QuickDeckBar, QuickDeckDomain } from '../common/QuickDeckBar';
import { gameApi } from '../../services/api';
import { parseCostToSilver, formatCostAbbreviated, deductFundsWithChange } from '../../utils/moneyUtils';

export type EquipmentCategoryTab = 'gear' | 'weapons' | 'armor' | 'shields' | 'exotics' | 'kits';

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
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const rawGearList: SimpleGearItem[] = sheet?.simple_gear || [];
  const gearList: SimpleGearItem[] = useMemo(() => {
    return rawGearList.filter((g) => g && g.name && g.name.trim() !== '');
  }, [rawGearList]);

  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Active Category Tab: gear | weapons | armor | shields
  const [activeCategoryTab, setActiveCategoryTab] = useState<EquipmentCategoryTab>('gear');

  // Supabase Catalogs State
  const [gearCatalog, setGearCatalog] = useState<SupabaseGear[]>([]);
  const [weaponsCatalog, setWeaponsCatalog] = useState<SupabaseWeapon[]>([]);
  const [armorCatalog, setArmorCatalog] = useState<SupabaseArmor[]>([]);
  const [shieldsCatalog, setShieldsCatalog] = useState<SupabaseShield[]>([]);
  const [exoticsCatalog, setExoticsCatalog] = useState<MagicItem[]>([]);
  const [kitsCatalog, setKitsCatalog] = useState<SupabaseBundle[]>([]);
  const [modsCatalog, setModsCatalog] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Search & Filter State
  const [gearInventorySearchQuery, setGearInventorySearchQuery] = useState<string>('');
  const [gearCatalogSearchQuery, setGearCatalogSearchQuery] = useState<string>('');
  const [activeFilterTable, setActiveFilterTable] = useState<string>('ALL');
  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [gearCatalogFeedback, setGearCatalogFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Calculate total inventory value (gold & silver, 100s = 1g)
  const inventoryValue = useMemo(() => calculateInventoryValue(gearList), [gearList]);

  // Fetch all Supabase Catalogs concurrently on modal open
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      Promise.all([
        gameApi.getGear(),
        gameApi.getWeapons(),
        gameApi.getArmor(),
        gameApi.getShields(),
        gameApi.getExotics(),
        gameApi.getBundles(),
        gameApi.getMods(),
      ])
        .then(([gearData, weaponsData, armorData, shieldsData, exoticsData, kitsData, modsData]) => {
          setGearCatalog(gearData || []);
          setWeaponsCatalog(weaponsData || []);
          setArmorCatalog(armorData || []);
          setShieldsCatalog(shieldsData || []);
          setExoticsCatalog(exoticsData || []);
          setKitsCatalog(kitsData || []);
          setModsCatalog(modsData || []);
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

  // Reset active filter table when switching categories
  useEffect(() => {
    setActiveFilterTable('ALL');
  }, [activeCategoryTab]);

  // Click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowManageModal(false);
      }
    };
    if (showManageModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);

  // Current Raw Catalog for Active Tab
  const currentRawCatalog = useMemo(() => {
    switch (activeCategoryTab) {
      case 'weapons':
        return weaponsCatalog;
      case 'armor':
        return armorCatalog;
      case 'shields':
        return shieldsCatalog;
      case 'exotics':
        return exoticsCatalog;
      case 'kits':
        return kitsCatalog;
      case 'gear':
      default:
        return gearCatalog;
    }
  }, [activeCategoryTab, gearCatalog, weaponsCatalog, armorCatalog, shieldsCatalog, exoticsCatalog, kitsCatalog]);

  // QuickDeck Domain and Theme
  const quickDeckDomain: QuickDeckDomain = useMemo(() => {
    return activeCategoryTab;
  }, [activeCategoryTab]);

  const categoryColorTheme = useMemo<'emerald' | 'rose' | 'amber' | 'cyan' | 'purple'>(() => {
    switch (activeCategoryTab) {
      case 'weapons':
        return 'rose';
      case 'armor':
        return 'amber';
      case 'shields':
        return 'cyan';
      case 'exotics':
      case 'kits':
        return 'purple';
      case 'gear':
      default:
        return 'emerald';
    }
  }, [activeCategoryTab]);

  const categoryPlaceholderText = useMemo<string>(() => {
    switch (activeCategoryTab) {
      case 'weapons':
        return '➕ Pin Weapon Table';
      case 'armor':
        return '➕ Pin Armor Table';
      case 'shields':
        return '➕ Pin Shield Table';
      case 'exotics':
        return '➕ Pin Exotics Table';
      case 'kits':
        return '➕ Pin Kits Table';
      case 'gear':
      default:
        return '➕ Pin Gear Table';
    }
  }, [activeCategoryTab]);

  // Pinned Tables per Category
  const currentPinnedTables: string[] = useMemo(() => {
    const sheetData = activeCharacter?.sheet_data;
    if (!sheetData) return [];
    switch (activeCategoryTab) {
      case 'weapons':
        return sheetData.favorite_weapon_tables || [];
      case 'armor':
        return sheetData.favorite_armor_tables || [];
      case 'shields':
        return sheetData.favorite_shield_tables || [];
      case 'gear':
      default:
        return sheetData.favorite_gear_tables || [];
    }
  }, [activeCategoryTab, activeCharacter?.sheet_data]);

  const handleUpdatePinnedTables = (tables: string[]) => {
    const key =
      activeCategoryTab === 'weapons'
        ? 'favorite_weapon_tables'
        : activeCategoryTab === 'armor'
        ? 'favorite_armor_tables'
        : activeCategoryTab === 'shields'
        ? 'favorite_shield_tables'
        : 'favorite_gear_tables';

    updateActiveSheetData((prev) => ({
      ...prev,
      [key]: tables,
    }));
    saveActiveCharacter();
  };

  // Starred Items per Category
  const isItemStarred = useCallback(
    (targetItem: any) => {
      const sheetData = activeCharacter?.sheet_data;
      if (!sheetData) return false;

      let starredList: (string | number)[] = [];
      switch (activeCategoryTab) {
        case 'weapons':
          starredList = sheetData.starred_weapons || [];
          break;
        case 'armor':
          starredList = sheetData.starred_armor || [];
          break;
        case 'shields':
          starredList = sheetData.starred_shields || [];
          break;
        case 'gear':
        default:
          starredList = sheetData.starred_gear || sheetData.starred_armor || [];
          break;
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
    const key =
      activeCategoryTab === 'weapons'
        ? 'starred_weapons'
        : activeCategoryTab === 'armor'
        ? 'starred_armor'
        : activeCategoryTab === 'shields'
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

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    const equippedNames = new Set(gearList.map((g) => g.name.toLowerCase()));
    const unequipped = currentRawCatalog.filter((g) => !equippedNames.has(g.name.toLowerCase()));

    let base = unequipped.filter((g) =>
      localGenreFilter === 'ALL' ? true : matchesGenre(g.genres, localGenreFilter as any)
    );

    if (activeFilterTable === 'STARRED') {
      base = base.filter((g) => isItemStarred(g));
    } else if (activeFilterTable !== 'ALL' && activeFilterTable !== 'STARRED') {
      const activeLower = activeFilterTable.toLowerCase();
      base = base.filter((g: any) => {
        const tbl = (
          g.table_group ||
          g.discipline ||
          g.category ||
          g.kit ||
          g.type ||
          'General'
        ).toLowerCase();
        return tbl === activeLower || tbl.includes(activeLower);
      });
    }

    if (!gearCatalogSearchQuery.trim()) return base;
    const query = gearCatalogSearchQuery.toLowerCase().trim();
    return base.filter((g: any) => {
      const nameMatch = (g.name || '').toLowerCase().includes(query);
      const catMatch = (g.category || g.discipline || g.type || '').toLowerCase().includes(query);
      const noteMatch = (g.notes || '').toLowerCase().includes(query);
      return nameMatch || catMatch || noteMatch;
    });
  }, [
    currentRawCatalog,
    gearList,
    activeFilterTable,
    isItemStarred,
    gearCatalogSearchQuery,
    localGenreFilter,
  ]);

  // Filtered Equipped Inventory
  const filteredGearInventory = useMemo(() => {
    if (!gearInventorySearchQuery.trim()) return gearList;
    const query = gearInventorySearchQuery.toLowerCase();
    return gearList.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        (item.notes && item.notes.toLowerCase().includes(query))
    );
  }, [gearList, gearInventorySearchQuery]);

  // Equip / Purchase Handler
  const handleEquipItem = (
    catalogItem: any,
    itemType: 'gear' | 'weapon' | 'armor' | 'shield' | 'exotic' | 'kit'
  ) => {
    setGearCatalogFeedback(null);
    const itemName = catalogItem.name;
    const costStr = catalogItem.cost || '0s';
    const costInSilver = parseCostToSilver(costStr);
    const currentGold = sheet?.gold ?? 0;
    const currentSilver = sheet?.silver ?? 0;
    const deduction = deductFundsWithChange(currentGold, currentSilver, costInSilver);

    if (itemType === 'kit') {
      const kitName = catalogItem.name;
      const matchedGear = gearCatalog.filter((g: any) => g.belongs_to && g.belongs_to.includes(kitName));
      const matchedWeapons = weaponsCatalog.filter((w: any) => w.belongs_to && w.belongs_to.includes(kitName));
      const matchedArmor = armorCatalog.filter((a: any) => a.belongs_to && a.belongs_to.includes(kitName));
      const matchedShields = shieldsCatalog.filter((s: any) => s.belongs_to && s.belongs_to.includes(kitName));
      const matchedExotics = exoticsCatalog.filter((e: any) => e.belongs_to && e.belongs_to.includes(kitName));

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
          category: '🎒 Kits',
          cost: costStr,
          qty: 1,
          notes: catalogItem.notes || 'Equipment Kit package',
          item_type: 'kit' as const,
        },
      ];

      updateActiveSheetData((prev) => {
        const currentGear = prev.simple_gear || [];
        const currentVault = prev.character_vault || [];
        const updatePayload: any = {
          ...prev,
          simple_gear: [...currentGear, ...newGearItems],
          character_vault: [...currentVault, ...matchedExotics],
        };
        if (deduction.success) {
          updatePayload.gold = deduction.newGold;
          updatePayload.silver = deduction.newSilver;
        }
        return updatePayload;
      });
      saveActiveCharacter();

      setGearCatalogFeedback({
        type: deduction.success ? 'success' : 'error',
        message: deduction.success
          ? `Purchased kit "${kitName}" for ${costStr}! Constituent items added to inventory and vault.`
          : `Insufficient funds for kit "${kitName}" (${costStr})! Added unpaid.`,
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
        category: '🚀 Spec Gear',
        cost: costStr,
        qty: 1,
        notes: catalogItem.notes || '',
        item_type: 'exotic',
        genres: catalogItem.genres,
        pic: catalogItem.pic,
      };

      updateActiveSheetData((prev) => {
        const currentVault = prev.character_vault || [];
        const updatePayload: any = {
          ...prev,
          simple_gear: [...(prev.simple_gear || []), newGearItem],
          character_vault: [...currentVault, catalogItem],
        };
        if (deduction.success) {
          updatePayload.gold = deduction.newGold;
          updatePayload.silver = deduction.newSilver;
        }
        return updatePayload;
      });
      saveActiveCharacter();

      setGearCatalogFeedback({
        type: deduction.success ? 'success' : 'error',
        message: deduction.success
          ? `Purchased Spec Gear "${itemName}" for ${costStr}! Added to gear and vault.`
          : `Insufficient funds! "${itemName}" costs ${costStr}. Added unpaid.`,
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
        const updatePayload: any = {
          ...prev,
          simple_gear: currentGear,
        };
        if (deduction.success) {
          updatePayload.gold = deduction.newGold;
          updatePayload.silver = deduction.newSilver;
        }
        return updatePayload;
      });
      saveActiveCharacter();

      if (deduction.success) {
        setGearCatalogFeedback({
          type: 'success',
          message: `Purchased another "${itemName}" for ${costStr}!`,
        });
      } else {
        setGearCatalogFeedback({
          type: 'error',
          message: `Insufficient funds! "${itemName}" costs ${costStr}, but you only have ${currentGold}g ${currentSilver}s. Added to inventory unpaid.`,
        });
      }
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

    updateActiveSheetData((prev) => {
      const updatePayload: any = {
        ...prev,
        simple_gear: [...(prev.simple_gear || []), newGearItem],
      };
      if (deduction.success) {
        updatePayload.gold = deduction.newGold;
        updatePayload.silver = deduction.newSilver;
      }
      return updatePayload;
    });
    saveActiveCharacter();

    if (deduction.success) {
      setGearCatalogFeedback({
        type: 'success',
        message: `Purchased "${itemName}" for ${costStr}!`,
      });
    } else {
      setGearCatalogFeedback({
        type: 'error',
        message: `Insufficient funds! "${itemName}" costs ${costStr}, but you only have ${currentGold}g ${currentSilver}s. Added to inventory unpaid.`,
      });
    }
  };

  // Purchase Optional Component / Mod on Owned Item
  const handlePurchaseOptionalMod = (modItem: any, parentItemName: string) => {
    const modName = modItem.name;
    const costStr = modItem.cost || '0s';
    const costInSilver = parseCostToSilver(costStr);
    const currentGold = sheet?.gold ?? 0;
    const currentSilver = sheet?.silver ?? 0;
    const deduction = deductFundsWithChange(currentGold, currentSilver, costInSilver);

    const newModGearItem: SimpleGearItem = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: `${modName} (${parentItemName})`,
      category: '🔌 Mod',
      cost: costStr,
      qty: 1,
      notes: modItem.notes || `Installed modification on ${parentItemName}`,
      item_type: 'gear',
      belongs_to: `Exotic: ${parentItemName}`,
    };

    updateActiveSheetData((prev) => {
      const updatePayload: any = {
        ...prev,
        simple_gear: [...(prev.simple_gear || []), newModGearItem],
      };
      if (deduction.success) {
        updatePayload.gold = deduction.newGold;
        updatePayload.silver = deduction.newSilver;
      }
      return updatePayload;
    });
    saveActiveCharacter();

    setGearCatalogFeedback({
      type: deduction.success ? 'success' : 'error',
      message: deduction.success
        ? `Purchased and installed "${modName}" on ${parentItemName} for ${costStr}!`
        : `Insufficient funds for "${modName}" (${costStr})! Installed unpaid.`,
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

  const getCategoryDisplayLabel = (category?: string, itemType?: string) => {
    const cat = (category || '').toLowerCase();
    const type = (itemType || '').toLowerCase();
    if (type === 'weapon' || cat.includes('weapon')) return '⚔️ Weapons';
    if (type === 'armor' || cat.includes('armor')) return '🥋 Armor';
    if (type === 'shield' || cat.includes('shield')) return '🛡️ Shields';
    if (type === 'exotic' || cat.includes('exotic')) return '🚀 Spec Gear';
    if (type === 'kit' || cat.includes('kit')) return '🎒 Kit';
    return category || '🎒 Gear';
  };

  const handleDropGear = (itemId: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      simple_gear: (prev.simple_gear || []).filter((g) => g.id !== itemId),
    }));
    saveActiveCharacter();
  };

  const handleUpdateGearQty = (itemId: string, delta: number) => {
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
                    Manage and purchase adventuring gear, weapons, armor, and shields from the Supabase stock catalog.
                  </p>
                </div>
              </div>

              {/* Inventory Total Value Pill in Header */}
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs font-bold text-teal-300 shadow-inner">
                <span>Value: 🪙 {inventoryValue.gold}g 🥈 {inventoryValue.silver}s</span>
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
                    filteredGearInventory.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2 shadow-sm"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                              {item.name}
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

                          {/* Optional Mods on Owned Exotics/Artifacts */}
                          {modsCatalog
                            .filter((m: any) => m.belongs_to && m.belongs_to.includes(item.name))
                            .map((m: any) => {
                              const isInstalled = gearList.some((g) => g.name.includes(m.name));
                              if (isInstalled) {
                                return (
                                  <span key={m.id || m.name} className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5">
                                    ✓ Installed: {m.name}
                                  </span>
                                );
                              }
                              return (
                                <div key={m.id || m.name} className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/60 text-[10px]">
                                  <span className="text-indigo-300 font-semibold truncate">🔌 {m.name} ({m.cost || 'Free'})</span>
                                  <button
                                    type="button"
                                    onClick={() => handlePurchaseOptionalMod(m, item.name)}
                                    className="px-2 py-0.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded font-bold cursor-pointer transition text-[9px]"
                                  >
                                    + Install Mod
                                  </button>
                                </div>
                              );
                            })}
                        </div>

                        {/* Qty & Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
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

                          <ItemNotesPopover
                            notes={item.notes || ''}
                            itemName={item.name}
                          />

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
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Supabase Stock Multi-Category Catalog */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                {/* 1. Category Multi-Option Pill Switch (KISS Dyslexia-Friendly Standard) */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md mb-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryTab('gear')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'gear'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🎒 Gear
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
                    onClick={() => setActiveCategoryTab('exotics')}
                    className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === 'exotics'
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🚀 Exotics
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
                    🎒 Kits
                  </button>
                </div>

                {/* 2. QuickDeckBar & Search Filter Stack */}
                <div className="flex flex-col gap-2 pb-2 border-b border-slate-800/80 shrink-0">
                  {/* Genre Dropdown */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={localGenreFilter}
                      onChange={(e) => setLocalGenreFilter(e.target.value)}
                      className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-teal-500 cursor-pointer flex-1"
                    >
                      <option value="ALL">🌐 All Genres</option>
                      <option value="Medieval">🏰 Medieval</option>
                      <option value="Modern">⚙️ Modern</option>
                      <option value="SciFi">🚀 SciFi</option>
                    </select>
                  </div>

                  {/* Universal Quick Deck Bar */}
                  <QuickDeckBar
                    domain={quickDeckDomain}
                    activeTable={activeFilterTable}
                    onSelectTable={setActiveFilterTable}
                    pinnedTables={currentPinnedTables}
                    onUpdatePinnedTables={handleUpdatePinnedTables}
                    catalogItems={currentRawCatalog}
                    starredCount={starredCount}
                    colorTheme={categoryColorTheme}
                    totalCatalogCount={currentRawCatalog.length}
                    placeholderText={categoryPlaceholderText}
                  />

                  {/* Search Bar + Dynamic Result Breadcrumb */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder={`Search ${activeCategoryTab}, categories, notes...`}
                        value={gearCatalogSearchQuery}
                        onChange={(e) => setGearCatalogSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                      {filteredCatalog.length} {filteredCatalog.length === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                </div>

                {/* Zero Matches Feedback & 1-Click Reset */}
                {filteredCatalog.length === 0 && !isLoadingCatalog && (
                  <div className="p-3.5 bg-slate-950/60 rounded-xl border border-teal-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                    <span className="text-teal-300 font-semibold">
                      0 {activeCategoryTab} match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                      {activeFilterTable !== 'ALL' && activeFilterTable !== 'STARRED' ? ` • ${activeFilterTable}` : ''})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalGenreFilter(activeGenre || 'SciFi');
                        setActiveFilterTable('ALL');
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
                  ) : filteredCatalog.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic">
                      <span>No matching {activeCategoryTab} in catalog.</span>
                    </div>
                  ) : (
                    filteredCatalog.map((catalogItem: any) => {
                      const starred = isItemStarred(catalogItem);
                      const costStr = catalogItem.cost || '0s';

                      let itemSubtext = catalogItem.category || 'General';
                      if (activeCategoryTab === 'weapons') {
                        itemSubtext = [catalogItem.type, catalogItem.discipline].filter(Boolean).join(' • ') || 'Weapon';
                      } else if (activeCategoryTab === 'armor') {
                        itemSubtext = [catalogItem.ar ? `AR: ${catalogItem.ar}` : null, catalogItem.discipline].filter(Boolean).join(' • ') || 'Armor';
                      } else if (activeCategoryTab === 'shields') {
                        itemSubtext = [catalogItem.max_block ? `Block: ${catalogItem.max_block}` : null, catalogItem.discipline].filter(Boolean).join(' • ') || 'Shield';
                      } else if (activeCategoryTab === 'exotics') {
                        itemSubtext = ['🚀 Spec Gear', catalogItem.discipline].filter(Boolean).join(' • ') || 'Spec Gear';
                      } else if (activeCategoryTab === 'kits') {
                        itemSubtext = ['🎒 Kit Suite', catalogItem.category].filter(Boolean).join(' • ') || 'Equipment Kit';
                      }

                      const itemTypeKey: 'gear' | 'weapon' | 'armor' | 'shield' | 'exotic' | 'kit' =
                        activeCategoryTab === 'weapons'
                          ? 'weapon'
                          : activeCategoryTab === 'armor'
                          ? 'armor'
                          : activeCategoryTab === 'shields'
                          ? 'shield'
                          : activeCategoryTab === 'exotics'
                          ? 'exotic'
                          : activeCategoryTab === 'kits'
                          ? 'kit'
                          : 'gear';

                      const buyButtonLabel =
                        activeCategoryTab === 'kits'
                          ? '+ Buy Kit'
                          : activeCategoryTab === 'exotics'
                          ? '+ Buy Spec Gear'
                          : '+ Equip';

                      return (
                        <div
                          key={catalogItem.id || catalogItem.name}
                          className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-teal-500/40 transition flex items-center justify-between gap-2 shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleToggleStarItem(catalogItem)}
                              className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${
                                starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                              }`}
                              title={starred ? 'Unstar item' : 'Star item'}
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                            </button>

                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                                {catalogItem.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="font-mono text-teal-300 font-bold">
                                  {formatCostAbbreviated(costStr)}
                                </span>
                                <span>•</span>
                                <span className="truncate">{itemSubtext}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <ItemNotesPopover
                              notes={catalogItem.notes || ''}
                              itemName={catalogItem.name}
                            />
                            <button
                              type="button"
                              onClick={() => handleEquipItem(catalogItem, itemTypeKey)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer shadow-sm border ${
                                activeCategoryTab === 'kits'
                                  ? 'bg-purple-950/80 hover:bg-purple-900 border-purple-500/40 text-purple-300'
                                  : activeCategoryTab === 'exotics'
                                  ? 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-500/40 text-indigo-300'
                                  : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/40 text-emerald-300'
                              }`}
                              title={`Purchase ${catalogItem.name} for ${costStr}`}
                            >
                              {buyButtonLabel}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-teal-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-sans font-semibold text-[11px]">Total Gear Value:</span>
                <span>🪙 {inventoryValue.gold}g 🥈 {inventoryValue.silver}s</span>
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
