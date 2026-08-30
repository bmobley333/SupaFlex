// src/components/sheet/GearCard.tsx
// Dedicated Card for Adventuring Gear Inventory & Catalog (Coin badge omitted for KISS/DRY)

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
import { SimpleGearItem, SupabaseGear } from '../../types/game';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { QuickDeckBar } from '../common/QuickDeckBar';
import { gameApi } from '../../services/api';
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

  // Supabase Gear Catalog State
  const [gearCatalog, setGearCatalog] = useState<SupabaseGear[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Search & Filter State
  const [gearInventorySearchQuery, setGearInventorySearchQuery] = useState<string>('');
  const [gearCatalogSearchQuery, setGearCatalogSearchQuery] = useState<string>('');
  const [gearCatalogFeedback, setGearCatalogFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Calculate total inventory value (gold & silver, 100s = 1g)
  const inventoryValue = useMemo(() => calculateInventoryValue(gearList), [gearList]);

  // Fetch Supabase Gear Catalog on modal open
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getGear()
        .then((data) => setGearCatalog(data))
        .catch((err) => console.error('Failed to load gear catalog:', err))
        .finally(() => setIsLoadingCatalog(false));
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

  // Filtered Inventory
  const filteredGearInventory = useMemo(() => {
    if (!gearInventorySearchQuery.trim()) return gearList;
    const query = gearInventorySearchQuery.toLowerCase();
    return gearList.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query))
    );
  }, [gearList, gearInventorySearchQuery]);

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

  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [activeGearTable, setActiveGearTable] = useState<string>('ALL');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const favoriteGearTables: string[] = useMemo(() => {
    const favs = activeCharacter?.sheet_data?.favorite_gear_tables;
    if (Array.isArray(favs) && favs.length > 0) {
      return favs;
    }
    return [];
  }, [activeCharacter?.sheet_data?.favorite_gear_tables]);

  const handleUpdatePinnedGearTables = (tables: string[]) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      favorite_gear_tables: tables,
    }));
    saveActiveCharacter();
  };

  const starredGearCount = useMemo(() => {
    return gearCatalog.filter((g) => isItemStarred(g)).length;
  }, [gearCatalog, isItemStarred]);

  const filteredGearCatalog = useMemo(() => {
    const equippedNames = new Set(gearList.map((g) => g.name.toLowerCase()));
    const unequipped = gearCatalog.filter((g) => !equippedNames.has(g.name.toLowerCase()));

    let base = unequipped.filter((g) => localGenreFilter === 'ALL' ? true : matchesGenre(g.genres, localGenreFilter as any));

    if (activeGearTable === 'STARRED') {
      base = base.filter((g) => isItemStarred(g));
    } else if (activeGearTable !== 'ALL' && activeGearTable !== 'STARRED') {
      const activeLower = activeGearTable.toLowerCase();
      base = base.filter((g) => {
        const tbl = (g.kit || g.table_group || g.category || 'General').toLowerCase();
        return tbl === activeLower || tbl.includes(activeLower);
      });
    }

    if (!gearCatalogSearchQuery.trim()) return base;
    const query = gearCatalogSearchQuery.toLowerCase().trim();
    return base.filter((g) => {
      const nameMatch = g.name.toLowerCase().includes(query);
      const catMatch = (g.category || '').toLowerCase().includes(query);
      const noteMatch = (g.notes || '').toLowerCase().includes(query);
      return nameMatch || catMatch || noteMatch;
    });
  }, [gearCatalog, gearList, activeGearTable, isItemStarred, gearCatalogSearchQuery, localGenreFilter]);

  const handleEquipGear = (catalogItem: SupabaseGear) => {
    setGearCatalogFeedback(null);
    const existingIndex = gearList.findIndex(
      (g) => g.name.toLowerCase() === catalogItem.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      updateActiveSheetData((prev) => {
        const currentGear = [...(prev.simple_gear || [])];
        currentGear[existingIndex] = {
          ...currentGear[existingIndex],
          qty: (currentGear[existingIndex].qty || 1) + 1,
        };
        return { ...prev, simple_gear: currentGear };
      });
      saveActiveCharacter();
      return;
    }

    const currentGold = sheet?.gold ?? 0;
    const currentSilver = sheet?.silver ?? 0;
    const deduction = deductFundsWithChange(currentGold, currentSilver, parseCostToSilver(catalogItem.cost || '0s'));

    const newGearItem: SimpleGearItem = {
      id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: catalogItem.name,
      category: catalogItem.category || 'General',
      cost: catalogItem.cost || '0s',
      qty: 1,
      notes: catalogItem.notes || '',
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
        message: `Purchased "${catalogItem.name}" for ${catalogItem.cost}!`,
      });
    }
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
          title="Open Gear Inventory & Catalog Modal"
        >
          <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
        </button>
      </div>

      {/* ⚙️ GEAR INVENTORY & CATALOG MODAL */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-left"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-500/30 text-teal-300 flex items-center justify-center">
                  <span className="text-lg leading-none">⚙️</span>
                </div>
                <div>
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    Gear Inventory & Catalog
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Equip adventuring gear, supplies, and tools from the Supabase stock catalog.
                  </p>
                </div>
              </div>

              {/* Inventory Total Value Pill in Header */}
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs font-bold text-teal-300">
                <span>Value: 🪙 {inventoryValue.gold}g 🥈 {inventoryValue.silver}s</span>
              </div>

              <button
                onClick={() => setShowManageModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0"
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
                      className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-teal-500 w-24 sm:w-28"
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                              {item.name}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-teal-950 text-teal-300 border border-teal-800 rounded">
                              {item.category || 'General'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-teal-300/80 font-semibold">
                            Cost: {formatCostAbbreviated(item.cost)}
                          </span>
                        </div>

                        {/* Qty & Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-1 py-0.5 text-xs font-mono font-bold">
                            <button
                              onClick={() => handleUpdateGearQty(item.id, -1)}
                              className="px-1 hover:text-teal-400 text-slate-400"
                            >
                              -
                            </button>
                            <span className="px-1 text-white">{item.qty || 1}</span>
                            <button
                              onClick={() => handleUpdateGearQty(item.id, 1)}
                              className="px-1 hover:text-teal-400 text-slate-400"
                            >
                              +
                            </button>
                          </div>

                          <ItemNotesPopover
                            notes={item.notes || ''}
                            itemName={item.name}
                          />

                          <button
                            onClick={() => handleDropGear(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
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

              {/* Right Column: Supabase Stock Gear Catalog */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                {/* QuickDeckBar & Search Filter */}
                <div className="flex flex-col gap-2 pb-2 border-b border-slate-800/80 shrink-0">
                  {/* 1. Dense Facet Toolbar: Local Genre */}
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

                  {/* 2. Universal Quick Deck Bar */}
                  <QuickDeckBar
                    domain="gear"
                    activeTable={activeGearTable}
                    onSelectTable={setActiveGearTable}
                    pinnedTables={favoriteGearTables}
                    onUpdatePinnedTables={handleUpdatePinnedGearTables}
                    catalogItems={gearCatalog}
                    starredCount={starredGearCount}
                    colorTheme="emerald"
                    totalCatalogCount={gearCatalog.length}
                    placeholderText="➕ Pin Gear Table"
                  />

                  {/* 3. Search Bar + Dynamic Result Breadcrumb */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search gear, categories, notes..."
                        value={gearCatalogSearchQuery}
                        onChange={(e) => setGearCatalogSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-teal-500"
                      />
                    </div>
                    <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                      {filteredGearCatalog.length} {filteredGearCatalog.length === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                </div>

                {/* Zero Matches Feedback & 1-Click Reset */}
                {filteredGearCatalog.length === 0 && !isLoadingCatalog && (
                  <div className="p-3.5 bg-slate-950/60 rounded-xl border border-teal-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                    <span className="text-teal-300 font-semibold">
                      0 gear items match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                      {activeGearTable !== 'ALL' && activeGearTable !== 'STARRED' ? ` • ${activeGearTable}` : ''})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalGenreFilter(activeGenre || 'SciFi');
                        setActiveGearTable('ALL');
                        setGearCatalogSearchQuery('');
                      }}
                      className="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}

                {gearCatalogFeedback && (
                  <div className="p-2 bg-emerald-950/80 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 font-semibold my-1.5 flex items-center justify-between shrink-0">
                    <span>{gearCatalogFeedback.message}</span>
                    <button onClick={() => setGearCatalogFeedback(null)} className="text-emerald-400">
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
                  ) : filteredGearCatalog.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic">
                      <span>No matching gear in catalog.</span>
                    </div>
                  ) : (
                    filteredGearCatalog.map((catalogItem) => {
                      const starred = isItemStarred(catalogItem);
                      return (
                        <div
                          key={catalogItem.id}
                          className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-teal-500/40 transition flex items-center justify-between gap-2 shadow-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              onClick={() => handleToggleStarItem(catalogItem)}
                              className={`p-1 rounded hover:bg-slate-800 transition ${
                                starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                              }`}
                              title={starred ? 'Unstar gear' : 'Star gear'}
                            >
                              <Star className="w-3.5 h-3.5 fill-current" />
                            </button>

                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                                {catalogItem.name}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="font-mono text-teal-300 font-bold">
                                  {formatCostAbbreviated(catalogItem.cost)}
                                </span>
                                <span>•</span>
                                <span>{catalogItem.category || 'General'}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleEquipGear(catalogItem)}
                            className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-lg transition shrink-0"
                          >
                            + Equip
                          </button>
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
