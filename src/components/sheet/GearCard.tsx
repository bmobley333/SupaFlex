// src/components/sheet/GearCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Search,
  Loader2,
  Package,
  Star,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { gameApi } from '../../services/api';
import { SimpleGearItem, SupabaseGear } from '../../types/game';
import { parseCostToSilver, formatCostAbbreviated, deductFundsWithChange } from '../../utils/moneyUtils';

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
  const silver = totalSilver % 100; // Guaranteed 0 - 99
  return { gold, silver, totalSilver };
};

export const GearCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const rawGearList: SimpleGearItem[] = activeCharacter?.sheet_data?.simple_gear || [];
  const gearList: SimpleGearItem[] = useMemo(() => {
    return rawGearList.filter((g) => g && g.name && g.name.trim() !== '');
  }, [rawGearList]);

  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Supabase Gear Catalog State
  const [gearCatalog, setGearCatalog] = useState<SupabaseGear[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Search & Filter State
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [catalogFeedback, setCatalogFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Calculate total inventory value (gold & silver, 100s = 1g)
  const inventoryValue = useMemo(() => calculateInventoryValue(gearList), [gearList]);

  // Fetch Supabase Gear Catalog on modal open
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getGear()
        .then((data) => {
          setGearCatalog(data);
        })
        .catch((err) => {
          console.error('Failed to load gear catalog:', err);
        })
        .finally(() => {
          setIsLoadingCatalog(false);
        });
    }
  }, [showManageModal]);

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

  // Derived unique categories from Supabase catalog
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    gearCatalog.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [gearCatalog]);

  // Filtered active character inventory
  const filteredInventory = useMemo(() => {
    if (!inventorySearchQuery.trim()) return gearList;
    const query = inventorySearchQuery.toLowerCase();
    return gearList.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query))
    );
  }, [gearList, inventorySearchQuery]);

  // Check if armor/gear item is starred
  const isItemStarred = useCallback(
    (targetItem: SupabaseGear | SimpleGearItem | { name: string; id?: number | string }) => {
      const starredList = activeCharacter?.sheet_data?.starred_armor || [];
      if (!starredList.length) return false;

      const rawName = targetItem.name || '';
      const targetId = (targetItem as any).id;

      const catalogMatch = gearCatalog.find(
        (g) => g.name.toLowerCase() === rawName.toLowerCase()
      );

      return starredList.some((k) => {
        const kStr = String(k);
        if (targetId && kStr === String(targetId)) return true;
        if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return true;
        if (kStr === String(rawName)) return true;
        return false;
      });
    },
    [activeCharacter?.sheet_data?.starred_armor, gearCatalog]
  );

  // Toggle Starred Armor/Gear Item
  const handleToggleStarItem = (targetItem: SupabaseGear | SimpleGearItem | { name: string; id?: number | string }) => {
    const rawName = targetItem.name || '';
    const catalogMatch = gearCatalog.find(
      (g) => g.name.toLowerCase() === rawName.toLowerCase()
    );

    const itemKey = (targetItem as any).id || (catalogMatch ? catalogMatch.id : null) || rawName;

    updateActiveSheetData((prev) => {
      const currentStarred = prev.starred_armor || [];
      const currentlyStarred = isItemStarred(targetItem);
      let updated: (string | number)[];

      if (currentlyStarred) {
        updated = currentStarred.filter((k) => {
          const kStr = String(k);
          if ((targetItem as any).id && kStr === String((targetItem as any).id)) return false;
          if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return false;
          if (kStr === String(rawName)) return false;
          return true;
        });
      } else {
        updated = currentStarred.some((k) => String(k) === String(itemKey))
          ? currentStarred
          : [...currentStarred, itemKey];
      }

      return {
        ...prev,
        starred_armor: updated,
      };
    });
    saveActiveCharacter();
  };

  const starredArmorCount = useMemo(() => {
    return gearCatalog.filter((g) => isItemStarred(g)).length;
  }, [gearCatalog, isItemStarred]);

  // Filtered gear catalog based on search & category filter & active genre
  const filteredCatalog = useMemo(() => {
    return gearCatalog.filter((item) => {
      if (!matchesGenre(item.genres, activeGenre)) return false;

      const matchesSearch =
        item.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(catalogSearchQuery.toLowerCase()));

      if (selectedCategoryFilter === 'STARRED') {
        return matchesSearch && isItemStarred(item);
      }

      const matchesCategory =
        selectedCategoryFilter === 'ALL' ||
        (item.category && item.category.toLowerCase() === selectedCategoryFilter.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [gearCatalog, catalogSearchQuery, selectedCategoryFilter, isItemStarred, activeGenre]);

  // Add stock item from Supabase catalog to character sheet inventory with funds check & change-making
  const handleAddStockGear = (stockItem: SupabaseGear) => {
    const itemCostSilver = parseCostToSilver(stockItem.cost);
    const costAbbrev = formatCostAbbreviated(stockItem.cost);

    const curGold = activeCharacter?.sheet_data?.gold ?? 0;
    const curSilver = activeCharacter?.sheet_data?.silver ?? 0;
    const deductRes = deductFundsWithChange(curGold, curSilver, itemCostSilver);

    if (!deductRes.success) {
      setCatalogFeedback({
        type: 'error',
        message: `Insufficient funds! "${stockItem.name}" costs ${costAbbrev} (${itemCostSilver}s), but you have ${formatCostAbbreviated(deductRes.totalAvailableSilver)} (${deductRes.totalAvailableSilver}s). Need ${deductRes.shortfallSilver}s more.`,
      });
      return;
    }

    let addedSuccessfully = false;

    updateActiveSheetData((prev) => {
      const prevGold = prev.gold ?? 0;
      const prevSilver = prev.silver ?? 0;
      const reDeduct = deductFundsWithChange(prevGold, prevSilver, itemCostSilver);
      if (!reDeduct.success) {
        return prev;
      }

      addedSuccessfully = true;
      const currentList = prev.simple_gear || [];
      const existingIndex = currentList.findIndex(
        (g) => g.name.toLowerCase() === stockItem.name.toLowerCase()
      );

      let updatedList: SimpleGearItem[];
      if (existingIndex >= 0) {
        updatedList = [...currentList];
        updatedList[existingIndex] = {
          ...updatedList[existingIndex],
          qty: updatedList[existingIndex].qty + 1,
        };
      } else {
        const newItem: SimpleGearItem = {
          id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          qty: 1,
          name: stockItem.name,
          category: stockItem.category,
          cost: stockItem.cost,
          notes: stockItem.notes,
        };
        updatedList = [...currentList, newItem];
      }

      return {
        ...prev,
        gold: reDeduct.newGold,
        silver: reDeduct.newSilver,
        simple_gear: updatedList,
      };
    });
    saveActiveCharacter();

    if (addedSuccessfully) {
      setCatalogFeedback({
        type: 'success',
        message: `Purchased "${stockItem.name}" for ${costAbbrev} and added to gear! (Remaining: ${deductRes.newGold}g ${deductRes.newSilver}s)`,
      });
      setTimeout(() => setCatalogFeedback(null), 4000);
    }
  };

  // Update item quantity or attributes in active character sheet inventory
  const handleUpdateGear = (id: string, updates: Partial<SimpleGearItem>) => {
    updateActiveSheetData((prev) => {
      const updated = (prev.simple_gear || []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      return { ...prev, simple_gear: updated };
    });
    saveActiveCharacter();
  };

  // Remove item from character sheet inventory
  const handleRemoveGear = (id: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      simple_gear: (prev.simple_gear || []).filter((item) => item.id !== id),
    }));
    saveActiveCharacter();
  };



  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all">
      {/* Title Header */}
      <h3 className="font-outfit font-bold text-sm tracking-widest text-cyan-300 uppercase flex items-center gap-2">
        <span className="text-base">🧰</span>
        Gear
      </h3>

      {/* Manage Gear Trigger Button & Value Summary */}
      <div className="flex items-center gap-2">
        {inventoryValue.totalSilver > 0 && (
          <div
            className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-950/80 rounded-md border border-slate-800 text-amber-300"
            title="Total Inventory Value (100s = 1g)"
          >
            <span>🪙 {inventoryValue.gold}g</span>
            <span>🥈 {inventoryValue.silver}s</span>
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
                : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
            }`}
            title="Manage gear inventory and catalog"
          >
            <span className="font-outfit font-bold">Manage Gear</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {gearList.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* 2-Column Split-Pane Glassmorphic Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Top Bar */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 flex items-center justify-center">
                      <span className="text-lg leading-none">🧰</span>
                    </div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        Gear Manager
                      </h3>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage character equipment side-by-side with the SupaFlex stock catalog and custom creator.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowManageModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 2-COLUMN SPLIT-PANE BODY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  
                  {/* --- LEFT COLUMN: CHARACTER INVENTORY PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Package className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-outfit font-bold uppercase tracking-wider text-cyan-300">
                          Inventory
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                          {gearList.length}
                        </span>
                      </div>

                      {/* Inventory Search Filter */}
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={inventorySearchQuery}
                          onChange={(e) => setInventorySearchQuery(e.target.value)}
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-cyan-500 w-24 sm:w-28"
                        />
                      </div>
                    </div>

                    {/* Scrollable Inventory Items List */}
                    <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-1.5 min-h-0">
                      {filteredInventory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                          <Package className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                          {inventorySearchQuery ? (
                            <span>No items matching "{inventorySearchQuery}"</span>
                          ) : (
                            <span>No specific gear listed. Standard adventuring kit assumed.</span>
                          )}
                        </div>
                      ) : (
                        filteredInventory.map((item) => (
                          <div
                            key={item.id}
                            className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/90 flex items-center justify-between gap-2 hover:border-cyan-500/40 transition-all shrink-0"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) =>
                                  handleUpdateGear(item.id, {
                                    qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                                  })
                                }
                                className="w-11 bg-slate-950 text-cyan-300 text-xs font-mono font-extrabold px-1 py-1 rounded border border-slate-800 text-center outline-none focus:border-cyan-500 shrink-0"
                              />
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs font-semibold text-slate-100 truncate">
                                    {item.name}
                                  </span>
                                  <ItemNotesPopover notes={item.notes || gearCatalog.find((g) => g.name.toLowerCase() === item.name.toLowerCase())?.notes} itemName={item.name} />
                                </div>
                                {(item.category || item.cost) && (
                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    {item.category && (
                                      <span className="text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800/80 truncate max-w-[130px]">
                                        {item.category}
                                      </span>
                                    )}
                                    {item.cost && (
                                      <span className="text-amber-400 font-mono font-bold">
                                        {item.cost}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleStarItem(item)}
                                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                  isItemStarred(item)
                                    ? 'text-amber-400'
                                    : 'text-slate-600 hover:text-amber-400'
                                }`}
                                title={isItemStarred(item) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                              >
                                <Star className={`w-3.5 h-3.5 ${isItemStarred(item) ? 'fill-amber-400' : ''}`} />
                              </button>
                              <button
                                onClick={() => handleRemoveGear(item.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all shrink-0"
                                title="Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* --- RIGHT COLUMN: STOCK CATALOG PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Catalog Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0">
                      <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                        🌐 Stock Catalog ({gearCatalog.length})
                      </span>
                    </div>

                    {/* Stock Catalog Content */}
                    <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
                      {/* Catalog Search & Category Filter Bar */}
                      <div className="flex items-center gap-2 pb-1 shrink-0">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={catalogSearchQuery}
                            onChange={(e) => setCatalogSearchQuery(e.target.value)}
                            placeholder="Search gear..."
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 w-full"
                          />
                        </div>

                        <select
                          value={selectedCategoryFilter}
                          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                          className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 max-w-[170px] truncate cursor-pointer"
                        >
                          <option value="ALL">🌐 All Categories</option>
                          <option value="STARRED">⭐ Starred Favorites ({starredArmorCount})</option>
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              📁 {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Catalog Action Feedback Banner */}
                      {catalogFeedback && (
                        <div
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 shrink-0 transition-all ${
                            catalogFeedback.type === 'error'
                              ? 'bg-rose-950/90 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/50'
                              : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-950/50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {catalogFeedback.type === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            ) : (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <span className="font-medium">{catalogFeedback.message}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCatalogFeedback(null)}
                            className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 transition-colors"
                            title="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Catalog Items Scrollable Grid */}
                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0">
                        {isLoadingCatalog ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            Loading stock gear from SupaFlex catalog...
                          </div>
                        ) : filteredCatalog.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-6 text-center">
                            No matching items found in catalog.
                          </p>
                        ) : (
                          filteredCatalog.map((item) => {
                            const inInventory = gearList.find(
                              (g) => g.name.toLowerCase() === item.name.toLowerCase()
                            );
                            const itemCostSilver = parseCostToSilver(item.cost);
                            const costAbbrev = formatCostAbbreviated(item.cost);
                            const curGold = activeCharacter?.sheet_data?.gold ?? 0;
                            const curSilver = activeCharacter?.sheet_data?.silver ?? 0;
                            const totalCharSilver = curGold * 100 + curSilver;
                            const hasFunds = totalCharSilver >= itemCostSilver;

                            return (
                              <div
                                key={item.id || item.name}
                                className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/90 flex items-center justify-between gap-2 hover:border-cyan-500/40 transition-all shrink-0"
                              >
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-slate-100 truncate">
                                      {item.name}
                                    </span>
                                    <ItemNotesPopover notes={item.notes} itemName={item.name} />
                                    {inInventory && (
                                      <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-500/40">
                                        {inInventory.qty}x
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px]">
                                    <span className="text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800/80 truncate max-w-[130px]">
                                      {item.category || 'Adventuring'}
                                    </span>
                                    <span className="text-amber-400 font-mono font-bold">
                                      {costAbbrev}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStarItem(item)}
                                    className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                      isItemStarred(item)
                                        ? 'text-amber-400'
                                        : 'text-slate-600 hover:text-amber-400'
                                    }`}
                                    title={isItemStarred(item) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isItemStarred(item) ? 'fill-amber-400' : ''}`} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddStockGear(item)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
                                      hasFunds
                                        ? 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/50'
                                        : 'bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/50'
                                    }`}
                                    title={
                                      hasFunds
                                        ? `Purchase 1x for ${costAbbrev} and add to gear`
                                        : `Insufficient funds! Requires ${costAbbrev} (${itemCostSilver}s). You have ${formatCostAbbreviated(totalCharSilver)} (${totalCharSilver}s).`
                                    }
                                  >
                                    + Add [{costAbbrev}]
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                    <span className="text-slate-400 font-sans font-semibold text-[11px]">Total Gear Value:</span>
                    <span>🪙 {inventoryValue.gold}g</span>
                    <span>🥈 {inventoryValue.silver}s</span>
                  </div>

                  <button
                    onClick={() => setShowManageModal(false)}
                    className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer text-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
