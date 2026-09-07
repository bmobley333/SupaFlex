// src/components/sheet/ArmorCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, X, Check, Shirt, Search, Loader2, Star } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { compareMsoItems, isMsoEntry } from '../../utils/kitUtils';
import {
  ArmorData,
  MovementRateData,
  SupabaseArmor,
  calculateAvailableAp,
  calculateMovementRate,
} from '../../types/game';
import { resolveStatHooks } from '../../utils/statHooks';
import {
  getCharacterKnownPaths,
  evaluateItemAp,
  matchesApCategoryFilter,
  ApCostCategory,
  ApEvaluationResult,
} from '../../utils/pathApUtils';

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

export const ArmorCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
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

  const knownPaths = useMemo(() => getCharacterKnownPaths(activeCharacter), [activeCharacter]);

  const getArmorEvalResult = useCallback(
    (item: SupabaseArmor): ApEvaluationResult => {
      return evaluateItemAp(item.path, item.requirement, attributeDice, knownPaths, undefined);
    },
    [knownPaths, attributeDice]
  );

  const isArmorSkilled = (item: ArmorData): boolean => {
    if (!item || item.id === 'arm_none') return false;
    return item.sk ?? true;
  };

  const skilledArmorList = useMemo(() => {
    return wardrobe.filter(isArmorSkilled);
  }, [wardrobe]);

  const skilledArmorCount = skilledArmorList.length;
  const armorApSpent = useMemo(() => {
    return skilledArmorList.reduce((acc, item) => acc + (item.ap_cost || 1), 0);
  }, [skilledArmorList]);
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
    const evalResult = getArmorEvalResult(item);

    if (evalResult.requiresGmApproval) {
      const confirmed = window.confirm(
        `Learning "${item.name}" is Out-of-Path and costs ${evalResult.apCost} AP.\n\nOut-of-Path equipment requires GM approval in campaign play. Proceed with learning?`
      );
      if (!confirmed) return;
    }

    let numericAr = typeof item.ar === 'number' ? item.ar : parseInt(String(item.ar || 0).replace(/[^0-9]/g, ''), 10) || 0;
    if (!evalResult.meetsReq) {
      numericAr = Math.max(2, numericAr - 2);
    }

    const newArmorItem: ArmorData = {
      id: `arm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      sk: true,
      ar: numericAr,
      requirement: item.requirement,
      mr: item.mr,
      cost: item.cost,
      notes: item.notes,
      ap_cost: evalResult.apCost,
      effect: `${evalResult.apCost} AP${evalResult.statDownscaled ? ' (Downscaled -2 AR)' : ''}`,
    };

    updateActiveSheetData((prev) => {
      const existingWardrobe = prev.wardrobe || wardrobe;
      const isAlreadyInWardrobe = existingWardrobe.some(
        (w) => w.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!isAlreadyInWardrobe) {
        recordApExpenditure(
          evalResult.apCost,
          'Armor',
          `Learned Armor: ${item.name} (${evalResult.apCost} AP${evalResult.requiresGmApproval ? ' • 👑 GM Approval' : ''})`,
          1,
          'Manage Armor'
        );
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
    const apRefund = targetArmor?.ap_cost || 1;

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
        recordApExpenditure(-apRefund, 'Armor', `Unlearned Armor: ${armorName} (-${apRefund} AP Refunded)`, 1, 'Manage Armor');
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
  const [armorDomainFilter, setArmorDomainFilter] = useState<string>('ALL');
  const [armorFilter, setArmorFilter] = useState<string>('ALL');
  const [activeApCategory, setActiveApCategory] = useState<ApCostCategory>('all');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const availableDisciplines = useMemo(() => {
    const set = new Set<string>();
    armorCatalog.forEach((a) => {
      const d = a.domain || a.discipline;
      if (d && d.trim()) set.add(d.trim());
    });
    return Array.from(set).sort((a, b) => compareMsoItems({ name: a }, { name: b }, isGsUnlocked));
  }, [armorCatalog, isGsUnlocked]);

  const starredArmorCount = useMemo(() => {
    return armorCatalog.filter((a) => isItemStarred(a)).length;
  }, [armorCatalog, isItemStarred]);

  const wardrobeNamesSet = useMemo(() => new Set(wardrobe.map((w) => w.name.toLowerCase())), [wardrobe]);
  const filteredWardrobe = useMemo(() => {
    let list = wardrobe;
    if (leftSearchQuery.trim()) {
      const q = leftSearchQuery.toLowerCase().trim();
      list = wardrobe.filter((w) => w.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [wardrobe, leftSearchQuery, isGsUnlocked]);

  const filteredCatalogArmor = useMemo(() => {
    return armorCatalog
      .filter((item) => {
        if (localGenreFilter !== 'ALL' && !matchesGenre(item.genres, localGenreFilter as any)) return false;
        if (wardrobeNamesSet.has(item.name.toLowerCase())) return false;

        // 1. Domain Filter
        if (armorDomainFilter !== 'ALL') {
          const disc = (item.domain || item.discipline || '').toLowerCase().trim();
          if (disc !== armorDomainFilter.toLowerCase().trim()) return false;
        }

        // 2. AR / Starred Filter
        if (armorFilter === 'STARRED') {
          if (!isItemStarred(item)) return false;
        } else if (armorFilter !== 'ALL') {
          const itemAr = typeof item.ar === 'number' ? item.ar : parseInt(String(item.ar || item.requirement || '').replace(/[^0-9]/g, ''), 10);
          if (itemAr !== parseInt(armorFilter, 10)) return false;
        }

        // 3. Category Row (AP cost / Path / Req)
        const evalResult = getArmorEvalResult(item);
        if (!matchesApCategoryFilter(activeApCategory, evalResult)) return false;

        // 4. Search query
        if (rightSearchQuery.trim()) {
          const q = rightSearchQuery.toLowerCase().trim();
          return (
            item.name.toLowerCase().includes(q) ||
            (item.requirement || '').toLowerCase().includes(q) ||
            (item.notes || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [
    armorCatalog,
    wardrobeNamesSet,
    armorDomainFilter,
    armorFilter,
    activeApCategory,
    rightSearchQuery,
    getArmorEvalResult,
    isItemStarred,
    localGenreFilter,
    isGsUnlocked,
  ]);

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
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Armor SK Manager"
          >
            <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)] group-hover:scale-105 group-hover:border-amber-400 transition-all">
              <span className="text-base leading-none">🧥</span>
            </div>
            <h3 className="font-outfit font-extrabold text-sm tracking-widest text-amber-200 uppercase group-hover:text-white transition-colors flex items-center gap-1.5">
              <span>Armor SK</span>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-300 group-hover:translate-y-0.5 transition-all" />
            </h3>
          </button>
          <CardHelpButton ruleKey="col.armor.ar" />
        </div>

        {/* Manage Armor Action Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowManageModal(!showManageModal)}
            className={`p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group ${
              showManageModal
                ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300 hover:text-white'
            }`}
            title="Open Armor SK Manager"
          >
            <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
          </button>

          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div ref={modalRef} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300">🧥</div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">Armor SK Manager</h3>
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
                                <span className={`font-outfit font-bold text-sm inline-flex items-center align-baseline ${isGsUnlocked && isMsoEntry(item.name) ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                                  <span>{isGsUnlocked && isMsoEntry(item.name) ? `🌌 ${item.name}` : item.name}</span>
                                  <ItemNotesPopover notes={item.notes || armorCatalog.find((a) => a.name.toLowerCase() === item.name.toLowerCase())?.notes} itemName={item.name} inline />
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
                                <button onClick={() => handleDropFromWardrobe(item.name)} className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold rounded-lg">Forget</button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                              <span>AR: {item.ar} | MR: {item.mr}</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold">
                                {item.ap_cost || 1} AP
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* --- RIGHT COLUMN: STOCK CATALOG PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Stock Catalog Content */}
                    <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
                      {/* 1. 3-Dropdown Filter Strip (Genre, Domain, Filter) */}
                      <div className="grid grid-cols-3 gap-1.5 mb-1 shrink-0">
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
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-amber-500'
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
                            armorDomainFilter !== 'ALL' ? 'text-cyan-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                          }`}>
                            {armorDomainFilter !== 'ALL' && <span className="text-[7px]">●</span>} Domain
                          </span>
                          <select
                            value={armorDomainFilter}
                            onChange={(e) => setArmorDomainFilter(e.target.value)}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                              armorDomainFilter !== 'ALL'
                                ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-extrabold'
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-amber-500'
                            }`}
                          >
                            <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                            {availableDisciplines.map((d) => (
                              <option key={d} value={d} className="bg-slate-900 text-slate-200">
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Filter (Discrete AR Values 4, 6, 8, 10, 12, Starred) */}
                        <div className="flex flex-col min-w-0">
                          <span className={`text-[9px] uppercase tracking-wider mb-0.5 px-0.5 truncate transition-colors ${
                            armorFilter !== 'ALL' ? 'text-yellow-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                          }`}>
                            {armorFilter !== 'ALL' && <span className="text-[7px]">●</span>} Filter
                          </span>
                          <select
                            value={armorFilter}
                            onChange={(e) => setArmorFilter(e.target.value)}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                              armorFilter !== 'ALL'
                                ? 'bg-yellow-950/90 border-yellow-400 text-yellow-100 ring-1 ring-yellow-400/50 shadow-[0_0_12px_rgba(250,204,21,0.3)] font-extrabold'
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-amber-500'
                            }`}
                          >
                            <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                            <option value="STARRED" className="bg-slate-900 text-slate-200">⭐ Starred {starredArmorCount > 0 ? `(${starredArmorCount})` : ''}</option>
                            <option value="4" className="bg-slate-900 text-slate-200">🧥 AR 4</option>
                            <option value="6" className="bg-slate-900 text-slate-200">🧥 AR 6</option>
                            <option value="8" className="bg-slate-900 text-slate-200">🧥 AR 8</option>
                            <option value="10" className="bg-slate-900 text-slate-200">🧥 AR 10</option>
                            <option value="12" className="bg-slate-900 text-slate-200">🧥 AR 12</option>
                          </select>
                        </div>
                      </div>

                      {/* 2. Category Multi-Option Pill Switch (KISS Dyslexia-Friendly Standard) */}
                      <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md mb-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveApCategory('all')}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            activeApCategory === 'all'
                              ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          🌐 All
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveApCategory('1AP')}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            activeApCategory === '1AP'
                              ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          ⚡ 1AP (Path & Req)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveApCategory('2AP')}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            activeApCategory === '2AP'
                              ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          ⏳ 2AP (Path, ~Req)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveApCategory('3AP')}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            activeApCategory === '3AP'
                              ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          👑 3AP (~Path & Req)
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveApCategory('4AP')}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            activeApCategory === '4AP'
                              ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          ⚠️ 4AP (~Path, ~Req)
                        </button>
                      </div>

                      {/* Out-of-Path GM Notice Banner */}
                      {(activeApCategory === '3AP' || activeApCategory === '4AP') && (
                        <div className="mb-1 px-3 py-1.5 bg-indigo-950/70 border border-indigo-500/40 rounded-xl text-indigo-200 text-xs flex items-center gap-2 shrink-0">
                          <span>👑</span>
                          <span>
                            <strong>Out-of-Path:</strong> Costs +2 AP and requires GM Approval in campaign play.
                          </span>
                        </div>
                      )}

                      {/* 3. Search Bar + Dynamic Result Breadcrumb */}
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80 shrink-0">
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
                            {armorDomainFilter !== 'ALL' ? ` • ${armorDomainFilter}` : ''}
                            {armorFilter !== 'ALL' ? ` • ${armorFilter}` : ''}
                            {activeApCategory !== 'all' ? ` • ${activeApCategory}` : ''})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLocalGenreFilter(activeGenre || 'SciFi');
                              setArmorDomainFilter('ALL');
                              setArmorFilter('ALL');
                              setActiveApCategory('all');
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
                            const evalResult = getArmorEvalResult(item);
                            return (
                              <div
                                key={item.id || idx}
                                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-amber-500/40 transition-all shrink-0"
                              >
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-bold text-sm inline-flex items-center align-baseline ${isGsUnlocked && isMsoEntry(item.name) ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                                      <span>{isGsUnlocked && isMsoEntry(item.name) ? `🌌 ${item.name}` : item.name}</span>
                                      <ItemNotesPopover notes={item.notes} itemName={item.name} inline />
                                    </span>
                                    {/* AP Cost Badge */}
                                    <span
                                      className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded border ${
                                        evalResult.apCost === 1
                                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                          : evalResult.apCost === 2
                                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                          : evalResult.apCost === 3
                                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                                          : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                      }`}
                                    >
                                      {evalResult.apCost} AP {evalResult.requiresGmApproval ? '• 👑 GM' : evalResult.statDownscaled ? '• ⏳ ~Req' : '• Path'}
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
                                      className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                                        evalResult.apCost === 1
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 shadow-sm'
                                          : evalResult.apCost === 2
                                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50 shadow-sm'
                                          : evalResult.apCost === 3
                                          ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50 shadow-sm'
                                          : 'bg-rose-600/30 text-rose-200 border-rose-500/50 hover:bg-rose-600/50 shadow-sm'
                                      }`}
                                      title={`Learn ${item.name} for ${evalResult.apCost} AP${evalResult.requiresGmApproval ? ' (Requires GM Approval)' : ''}`}
                                    >
                                      + Learn ({evalResult.apCost} AP)
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                                  <span>Req: <strong className="text-slate-200">{item.requirement}</strong></span>
                                  <span>AR: <strong className="text-amber-300">{item.ar}</strong></span>
                                  <span>MR: <strong className="text-cyan-300">{item.mr}</strong></span>
                                  {evalResult.statDownscaled ? (
                                    <span className="text-[10px] text-amber-400 font-sans font-semibold">
                                      Downscaled (-2 AR)
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-400 font-sans font-bold">
                                      Qualified
                                    </span>
                                  )}
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
                    <span className="font-outfit font-bold text-slate-300">🧥 Armor SK Manager</span>
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
          <span
            className={`text-xs inline-flex items-center align-baseline min-w-[100px] max-w-full ${isGsUnlocked && isMsoEntry(armor.name) ? 'text-purple-300 font-bold' : 'font-semibold text-slate-100'}`}
            title={armor.name}
          >
            <span className="truncate">{isGsUnlocked && isMsoEntry(armor.name) ? `🌌 ${armor.name}` : armor.name}</span>
            <ItemNotesPopover notes={armor.notes || armorCatalog.find((a) => a.name.toLowerCase() === armor.name.toLowerCase())?.notes} itemName={armor.name} inline />
          </span>
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
