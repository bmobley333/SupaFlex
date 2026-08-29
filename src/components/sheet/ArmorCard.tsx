// src/components/sheet/ArmorCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, X, Check, Shirt, Search, Loader2, Star } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { QuickDeckBar } from '../common/QuickDeckBar';
import {
  ArmorData,
  MovementRateData,
  SupabaseArmor,
  isRequirementLearnable,
  calculateAvailableAp,
  calculateMovementRate,
} from '../../types/game';
import { resolveStatHooks } from '../../utils/statHooks';

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

export const ArmorCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();
  const statHooks = useMemo(() => resolveStatHooks(activeCharacter?.sheet_data), [activeCharacter?.sheet_data]);

  const armor: ArmorData = activeCharacter?.sheet_data?.armor_slot || {
    id: 'arm_none',
    name: 'Unarmored',
    sk: true,
    ar: 0,
    requirement: '💪 4',
    mr: '👣8',
  };

  const wardrobe: ArmorData[] = useMemo(() => {
    const list = activeCharacter?.sheet_data?.wardrobe;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return [armor];
  }, [activeCharacter?.sheet_data?.wardrobe, armor]);

  const mrData: MovementRateData = activeCharacter?.sheet_data?.movement_rate || {
    armored: 6,
    shield: 'n/a',
  };

  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const derivedDodge = getDieNum(attributeDice.motion);

  const isArmorSkilled = (item: ArmorData): boolean => {
    if (!item || item.id === 'arm_none') return false;
    if (item.sk === true) return true;
    if (item.sk === false) return false;
    return isRequirementLearnable(item.requirement || '💪 4', attributeDice);
  };

  const skilledArmorList = useMemo(() => {
    return wardrobe.filter(isArmorSkilled);
  }, [wardrobe, attributeDice]);

  const skilledArmorCount = skilledArmorList.length;
  const armorApSpent = skilledArmorCount * 1;
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'armor') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');
  const [armorCatalog, setArmorCatalog] = useState<SupabaseArmor[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getArmor()
        .then(setArmorCatalog)
        .catch(console.error)
        .finally(() => setIsLoadingCatalog(false));
    }
  }, [showManageModal]);

  const handleCloseManageModal = () => {
    setShowManageModal(false);
    window.dispatchEvent(new CustomEvent('supaflex:close-manager'));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseManageModal();
      }
    };
    if (showManageModal) document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);


  const handleSelectActiveArmor = (selectedArmor: ArmorData) => {
    updateActiveSheetData((prev) => {
      const updatedSheet = {
        ...prev,
        armor_slot: selectedArmor,
        armor: selectedArmor.ar,
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };

  const handleSkToggle = (skChecked: boolean) => {
    const updatedArmor = { ...armor, sk: skChecked };
    updateActiveSheetData((prev) => {
      const updatedWardrobe = (prev.wardrobe || wardrobe).map((item) =>
        item.name.toLowerCase() === armor.name.toLowerCase() ? { ...item, sk: skChecked } : item
      );
      const updatedSheet = {
        ...prev,
        armor_slot: updatedArmor,
        wardrobe: updatedWardrobe,
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };

  const handleAddToWardrobe = (item: SupabaseArmor) => {
    const numericAr = typeof item.ar === 'number' ? item.ar : parseInt(String(item.ar || 0).replace(/[^0-9]/g, ''), 10) || 0;
    const isLearnable = isRequirementLearnable(item.requirement, attributeDice);
    const newArmorItem: ArmorData = {
      id: `arm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      sk: isLearnable,
      ar: numericAr,
      requirement: item.requirement,
      mr: item.mr,
      cost: item.cost,
      notes: item.notes,
    };
    updateActiveSheetData((prev) => {
      const existingWardrobe = prev.wardrobe || wardrobe;
      const isAlreadyInWardrobe = existingWardrobe.some(
        (w) => w.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!isAlreadyInWardrobe) {
        if (isLearnable) {
          recordApExpenditure(1, 'Armor', `Learned Skilled Armor: ${item.name} (1 AP)`, 1, 'Manage Armor');
        } else {
          recordApExpenditure(0, 'Armor', `Added Unskilled Armor: ${item.name} (0 AP - Unskilled)`, 1, 'Manage Armor');
        }
      }
      const updatedWardrobe = isAlreadyInWardrobe ? existingWardrobe : [...existingWardrobe, newArmorItem];
      const updatedSheet = {
        ...prev,
        armor_slot: newArmorItem,
        armor: numericAr,
        wardrobe: updatedWardrobe,
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };

  const handleDropFromWardrobe = (armorName: string) => {
    const targetArmor = wardrobe.find((w) => w.name.toLowerCase() === armorName.toLowerCase());
    const wasSkilled = targetArmor ? isArmorSkilled(targetArmor) : false;

    updateActiveSheetData((prev) => {
      const existingWardrobe = prev.wardrobe || wardrobe;
      const updatedWardrobe = existingWardrobe.filter((w) => w.name.toLowerCase() !== armorName.toLowerCase());
      let nextActiveArmor = prev.armor_slot;
      if (armor.name.toLowerCase() === armorName.toLowerCase()) {
        nextActiveArmor = updatedWardrobe.length > 0 ? updatedWardrobe[0] : {
          id: 'arm_none',
          name: 'Unarmored',
          sk: true,
          ar: 0,
          requirement: '💪 4',
          mr: '👣8',
        };
      }

      if (wasSkilled) {
        recordApExpenditure(-1, 'Armor', `Unlearned Skilled Armor: ${armorName} (-1 AP Refunded)`, 1, 'Manage Armor');
      } else {
        recordApExpenditure(0, 'Armor', `Dropped Unskilled Armor: ${armorName} (0 AP)`, 1, 'Manage Armor');
      }

      const updatedSheet = {
        ...prev,
        armor_slot: nextActiveArmor,
        armor: nextActiveArmor ? nextActiveArmor.ar : 0,
        wardrobe: updatedWardrobe,
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };



  // Check if armor item is starred
  const isItemStarred = useCallback(
    (targetItem: SupabaseArmor | ArmorData | { name: string; id?: number | string }) => {
      const starredList = activeCharacter?.sheet_data?.starred_armor || [];
      if (!starredList.length) return false;

      const rawName = targetItem.name || '';
      const targetId = (targetItem as any).id;

      const catalogMatch = armorCatalog.find(
        (a) => a.name.toLowerCase() === rawName.toLowerCase()
      );

      return starredList.some((k) => {
        const kStr = String(k);
        if (targetId && kStr === String(targetId)) return true;
        if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return true;
        if (kStr === String(rawName)) return true;
        return false;
      });
    },
    [activeCharacter?.sheet_data?.starred_armor, armorCatalog]
  );

  // Toggle Starred Armor Item
  const handleToggleStarItem = (targetItem: SupabaseArmor | ArmorData | { name: string; id?: number | string }) => {
    const rawName = targetItem.name || '';
    const catalogMatch = armorCatalog.find(
      (a) => a.name.toLowerCase() === rawName.toLowerCase()
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
  const [skillFilterMode, setSkillFilterMode] = useState<'all' | 'skilled' | 'unskilled'>('all');
  const [activeArmorTable, setActiveArmorTable] = useState<string>('ALL');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const favoriteArmorTables: string[] = useMemo(() => {
    const favs = activeCharacter?.sheet_data?.favorite_armor_tables;
    if (Array.isArray(favs) && favs.length > 0) {
      return favs;
    }
    return [];
  }, [activeCharacter?.sheet_data?.favorite_armor_tables]);

  const handleUpdatePinnedArmorTables = (tables: string[]) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      favorite_armor_tables: tables,
    }));
    saveActiveCharacter();
  };

  const starredArmorCount = useMemo(() => {
    return armorCatalog.filter((a) => isItemStarred(a)).length;
  }, [armorCatalog, isItemStarred]);

  const wardrobeNamesSet = useMemo(() => new Set(wardrobe.map((w) => w.name.toLowerCase())), [wardrobe]);
  const filteredWardrobe = useMemo(() => {
    if (!leftSearchQuery.trim()) return wardrobe;
    const q = leftSearchQuery.toLowerCase().trim();
    return wardrobe.filter((w) => w.name.toLowerCase().includes(q));
  }, [wardrobe, leftSearchQuery]);

  const filteredCatalogArmor = useMemo(() => {
    return armorCatalog.filter((item) => {
      if (localGenreFilter !== 'ALL' && !matchesGenre(item.genres, localGenreFilter as any)) return false;
      if (wardrobeNamesSet.has(item.name.toLowerCase())) return false;

      const isLearnable = isRequirementLearnable(item.requirement, attributeDice);
      if (skillFilterMode === 'skilled' && !isLearnable) return false;
      if (skillFilterMode === 'unskilled' && isLearnable) return false;

      // Table Quick Deck Filter
      if (activeArmorTable === 'STARRED' && !isItemStarred(item)) return false;
      if (activeArmorTable !== 'ALL' && activeArmorTable !== 'STARRED') {
        const tbl = (item.kit || item.table_group || (item as any).category || '').toLowerCase();
        const activeLower = activeArmorTable.toLowerCase();
        if (tbl !== activeLower && !tbl.includes(activeLower)) {
          return false;
        }
      }

      if (rightSearchQuery.trim()) {
        const q = rightSearchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.requirement || '').toLowerCase().includes(q) ||
          (item.notes || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [armorCatalog, wardrobeNamesSet, skillFilterMode, activeArmorTable, rightSearchQuery, attributeDice, isItemStarred, localGenreFilter]);

  const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
  const isShieldEquipped = shieldSlot?.equipped ?? false;
  let derivedShieldDrawn: string | number = 'n/a';
  if (isShieldEquipped) {
    const mrAdjustmentStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
    const match = mrAdjustmentStr.match(/-?\d+/);
    const penalty = match ? parseInt(match[0], 10) : 0;
    const armoredMR = mrData.armored ?? 6;
    derivedShieldDrawn = Math.max(0, armoredMR + penalty);
  }

  return (
    <div className="bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-amber-500/90 p-4 flex flex-col gap-3 shadow-lg shadow-amber-950/20">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <span className="text-base leading-none">🧥</span>
          </div>
          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-amber-200 uppercase">
            Armor
          </h3>
          <CardHelpButton ruleKey="col.armor.ar" />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal ? 'bg-amber-600/30 text-amber-200 border-amber-400' : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
            }`}
          >
            <span className="font-outfit font-bold">Manage Armor</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {wardrobe.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div ref={modalRef} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300">🧥</div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">Armor Manager</h3>
                    </div>
                  </div>

                  {/* KISS Top-Center Header Status Pill */}
                  <div className="px-3.5 py-1 bg-amber-950/70 border border-amber-500/40 rounded-full font-mono font-bold text-xs text-amber-200 flex items-center gap-2 shadow-md">
                    <span>
                      Skilled <strong className="text-amber-300">{skilledArmorCount}</strong>; Used{' '}
                      <strong className="text-rose-300">{armorApSpent} AP</strong>; Available{' '}
                      <strong className="text-emerald-400">{availableAp} AP</strong>
                    </span>
                  </div>

                  <button onClick={handleCloseManageModal} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 shrink-0"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                      <div className="flex items-center gap-1.5"><Shirt className="w-4 h-4 text-amber-400" /><span className="text-xs font-outfit font-bold uppercase tracking-wider text-amber-300">Armory</span></div>
                      <div className="relative"><Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" /><input type="text" value={leftSearchQuery} onChange={(e) => setLeftSearchQuery(e.target.value)} className="bg-slate-900 text-slate-200 text-[11px] pl-6 py-0.5 rounded border border-slate-700 w-24" /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto mt-2.5 flex flex-col gap-2.5">
                      {filteredWardrobe.map((item) => {
                        const isActive = armor.name.toLowerCase() === item.name.toLowerCase();
                        return (
                          <div key={item.id} className={`p-3 rounded-xl border flex flex-col gap-2 ${isActive ? 'bg-amber-950/40 border-amber-500/60' : 'bg-slate-900/90 border-slate-800'}`}>
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleSelectActiveArmor(item)} className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${isActive ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>{isActive ? '● Active' : '○ Wear'}</button>
                                <span className="font-outfit font-bold text-sm text-slate-100">{item.name}</span>
                                <ItemNotesPopover notes={item.notes || armorCatalog.find((a) => a.name.toLowerCase() === item.name.toLowerCase())?.notes} itemName={item.name} />
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
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
                                <button onClick={() => handleDropFromWardrobe(item.name)} className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold rounded-lg">Forget</button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400"><span>AR: {item.ar} | MR: {item.mr}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* --- RIGHT COLUMN: STOCK CATALOG PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Catalog Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        🌐 Stock Catalog ({filteredCatalogArmor.length})
                      </span>
                    </div>

                    {/* Stock Catalog Content */}
                    <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
                      {/* 1. DENSE DROPDOWN FACET TOOLBAR */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {/* Local Setting Genre Selector */}
                        <select
                          value={localGenreFilter}
                          onChange={(e) => setLocalGenreFilter(e.target.value)}
                          className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 cursor-pointer flex-1 min-w-[110px]"
                        >
                          <option value="ALL">🌐 All Genres</option>
                          <option value="Medieval">🏰 Medieval</option>
                          <option value="Modern">⚙️ Modern</option>
                          <option value="SciFi">🚀 SciFi</option>
                        </select>

                        {/* Qualification Dropdown */}
                        <select
                          value={skillFilterMode}
                          onChange={(e) => setSkillFilterMode(e.target.value as any)}
                          className="bg-slate-900 text-emerald-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 cursor-pointer flex-1 min-w-[130px]"
                        >
                          <option value="all">🌐 All Qualifications</option>
                          <option value="skilled">🎓 Skilled Only</option>
                          <option value="unskilled">⚪ Unskilled Only</option>
                        </select>
                      </div>

                      {/* 2. Universal Quick Deck Bar */}
                      <QuickDeckBar
                        domain="armor"
                        activeTable={activeArmorTable}
                        onSelectTable={setActiveArmorTable}
                        pinnedTables={favoriteArmorTables}
                        onUpdatePinnedTables={handleUpdatePinnedArmorTables}
                        catalogItems={armorCatalog}
                        starredCount={starredArmorCount}
                        colorTheme="amber"
                        totalCatalogCount={armorCatalog.length}
                        placeholderText="➕ Pin Armor Table"
                      />

                      {/* 3. Search Bar + Dynamic Result Breadcrumb */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={rightSearchQuery}
                            onChange={(e) => setRightSearchQuery(e.target.value)}
                            placeholder="Search armor, requirements, notes..."
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 w-full"
                          />
                        </div>
                        <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                          {filteredCatalogArmor.length} {filteredCatalogArmor.length === 1 ? 'item' : 'items'}
                        </div>
                      </div>

                      {/* Zero Matches Feedback & 1-Click Reset */}
                      {filteredCatalogArmor.length === 0 && !isLoadingCatalog && (
                        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-amber-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                          <span className="text-amber-300 font-semibold">
                            0 armor sets match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                            {skillFilterMode !== 'all' ? ` • ${skillFilterMode}` : ''}
                            {activeArmorTable !== 'ALL' && activeArmorTable !== 'STARRED' ? ` • ${activeArmorTable}` : ''})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLocalGenreFilter(activeGenre || 'SciFi');
                              setSkillFilterMode('all');
                              setActiveArmorTable('ALL');
                              setRightSearchQuery('');
                            }}
                            className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      )}

                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                        {isLoadingCatalog ? (
                          <div className="h-full flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span>Loading catalog...</span>
                          </div>
                        ) : filteredCatalogArmor.length > 0 ? (
                          filteredCatalogArmor.map((item, idx) => {
                            const qualifies = isRequirementLearnable(item.requirement, attributeDice);
                            return (
                              <div
                                key={item.id || idx}
                                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-amber-500/40 transition-all shrink-0"
                              >
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-100">{item.name}</span>
                                    <ItemNotesPopover notes={item.notes} itemName={item.name} />
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-200 border border-slate-750">
                                      {item.cost}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
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
                                      onClick={() => handleAddToWardrobe(item)}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                        qualifies
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50'
                                          : 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50'
                                      }`}
                                    >
                                      + Learn
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                                  <span>Req: <strong className="text-slate-200">{item.requirement}</strong></span>
                                  <span>AR: <strong className="text-amber-300">{item.ar}</strong></span>
                                  <span>MR: <strong className="text-cyan-300">{item.mr}</strong></span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic py-6 text-center">
                            No armor sets match catalog search.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Status Bar with Standardized "Done" Button */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-outfit font-bold text-slate-300">🧥 Armor Manager</span>
                  </div>
                  
                  {/* Standardized Master Blueprint Done Footer Button */}
                  <button 
                    onClick={handleCloseManageModal} 
                    className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Character Sheet Card View - High Density Single Line */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 animate-fadeIn">
        {/* Sk Checkbox / Red X Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs font-bold text-slate-300 cursor-pointer">
            Sk
          </label>
          <button
            type="button"
            onClick={() => handleSkToggle(!(armor.sk ?? true))}
            className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-pointer shrink-0 ${
              (armor.sk ?? true)
                ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm hover:bg-cyan-600/50'
                : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md hover:bg-rose-900/90'
            }`}
            title={(armor.sk ?? true) ? 'Skilled (Click to mark Unskilled)' : 'Unskilled (Click to mark Skilled)'}
          >
            {(armor.sk ?? true) ? (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            ) : (
              <X className="w-3.5 h-3.5 stroke-[3]" />
            )}
          </button>
        </div>

        {/* Armor Name (Unboxed Clean Text) + Notes Popover */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[130px] pr-1">
          <span className="font-semibold text-slate-100 text-xs truncate min-w-[100px]" title={armor.name}>
            {armor.name}
          </span>
          <ItemNotesPopover notes={armor.notes || armorCatalog.find((a) => a.name.toLowerCase() === armor.name.toLowerCase())?.notes} itemName={armor.name} />
        </div>

        {/* Dodge Cell (Auto-Updated from Motion) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">Dodge</span>
            <span className="text-sm">🏃</span>
          </div>
          <div
            className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
            title="Auto-updated matching Character Motion rating"
          >
            {derivedDodge}
          </div>
        </div>

        {/* AR Cell (Auto-Updated Read-Only Display Box with Stat Hook Support) */}
        <div className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 shrink-0 ${
          statHooks.effectiveArOverride !== undefined || statHooks.arBonus !== 0
            ? 'bg-purple-950/40 border-purple-500/50 shadow-sm'
            : 'bg-slate-950/70 border-slate-800'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">AR</span>
            <span className="text-sm">🧥</span>
          </div>
          <div
            className={`w-10 bg-slate-900 border rounded py-1 text-xs font-mono font-extrabold text-center ${
              statHooks.effectiveArOverride !== undefined || statHooks.arBonus !== 0
                ? 'text-cyan-300 border-purple-500/50'
                : 'text-amber-300 border-slate-800'
            }`}
            title={
              statHooks.effectiveArOverride !== undefined || statHooks.arBonus !== 0
                ? `Derived by active trait hook (${statHooks.activeHooks.filter((h) => h.target === 'ar').map((h) => h.effectDescription).join(', ')})`
                : 'Auto-updated matching equipped armor AR rating'
            }
          >
            {(statHooks.effectiveArOverride !== undefined ? statHooks.effectiveArOverride : (armor.ar ?? 0)) + statHooks.arBonus}
          </div>
        </div>
      </div>

      {/* Integrated Movement Rate (MR) Footer Sub-Card */}
      <div className="pt-2.5 mt-1 border-t border-slate-800/80 flex flex-col gap-2">
        <span className="font-outfit font-bold text-teal-300 flex items-center gap-1.5 uppercase tracking-wider text-xs">
          <span>👣</span> MR <span className="text-[10px] text-slate-400 normal-case font-normal">(Movement Rate)</span>
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {/* Armored MR Box */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 w-fit ${
            statHooks.mrBonus !== 0 ? 'bg-purple-950/40 border-purple-500/50' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <span className="text-[11px] font-bold text-slate-300">Armored 👣</span>
            <div
              className="w-9 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
              title={
                statHooks.mrBonus !== 0
                  ? `Modified by active trait hook (${statHooks.mrBonus >= 0 ? '+' : ''}${statHooks.mrBonus} MR)`
                  : 'Auto-updated matching equipped armor Armored Movement Rate'
              }
            >
              {Math.max(0, (mrData.armored ?? 6) + statHooks.mrBonus)}
            </div>
          </div>

          {/* Shield Drawn MR Box */}
          <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2 w-fit">
            <span className="text-[11px] font-bold text-slate-300">Shield Drawn 👣</span>
            <div
              className="px-2 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
              title="Auto-calculated Armored MR reduced by shield MR penalty (min 0)"
            >
              {derivedShieldDrawn}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
