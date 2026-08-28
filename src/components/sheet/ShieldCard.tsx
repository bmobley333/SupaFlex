// src/components/sheet/ShieldCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, X, Check, Search, ShieldAlert, Loader2, Star } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { QuickDeckBar } from '../common/QuickDeckBar';
import {
  ShieldData,
  SupabaseShield,
  isRequirementLearnable,
  calculateAvailableAp,
  calculateMovementRate,
} from '../../types/game';

export const ShieldCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();

  const shield: ShieldData = activeCharacter?.sheet_data?.shield_slot || {
    id: 'shd_default',
    equipped: false,
    name: 'Round Shield',
    sk: true,
    requirement: '💪 4',
    max_block: 12,
    mr_adjustment: '👣0',
    cost: '5g',
  };

  const armory: ShieldData[] = useMemo(() => {
    const list = activeCharacter?.sheet_data?.armory;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return shield.equipped ? [shield] : [];
  }, [activeCharacter?.sheet_data?.armory, shield]);

  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const getDieNum = (dieRating?: string): number => {
    if (!dieRating) return 4;
    const num = parseInt(dieRating.replace('d', ''), 10);
    return isNaN(num) ? 4 : num;
  };

  const derivedBlock = getDieNum(attributeDice.might);

  const isShieldSkilled = (item: ShieldData): boolean => {
    if (!item || item.id === 'shd_none') return false;
    if (item.sk === true) return true;
    if (item.sk === false) return false;
    return isRequirementLearnable(item.requirement || '💪 4', attributeDice);
  };

  const skilledShieldList = useMemo(() => {
    return armory.filter(isShieldSkilled);
  }, [armory, attributeDice]);

  const skilledShieldCount = skilledShieldList.length;
  const shieldApSpent = skilledShieldCount;
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'shields') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');
  const [shieldCatalog, setShieldCatalog] = useState<SupabaseShield[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getShields()
        .then(setShieldCatalog)
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageModal]);


  const handleSelectActiveShield = (selectedShield: ShieldData) => {
    const equippedShield = { ...selectedShield, equipped: true };
    updateActiveSheetData((prev) => {
      const updatedSheet = {
        ...prev,
        shield_slot: equippedShield,
        armory: (prev.armory || armory).map((s) => ({
          ...s,
          equipped: s.name.toLowerCase() === selectedShield.name.toLowerCase(),
        })),
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };

  const handleSkToggle = (skChecked: boolean) => {
    const updatedShield = { ...shield, sk: skChecked };
    updateActiveSheetData((prev) => {
      const updatedSheet = {
        ...prev,
        shield_slot: updatedShield,
        armory: (prev.armory || armory).map((item) =>
          item.name.toLowerCase() === shield.name.toLowerCase() ? { ...item, sk: skChecked } : item
        ),
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };

  const handleAddToArmory = (item: SupabaseShield) => {
    const isLearnable = isRequirementLearnable(item.requirement, attributeDice);
    const newShieldItem: ShieldData = {
      id: `shd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      equipped: true,
      name: item.name,
      sk: isLearnable,
      max_block: parseInt((item.max_block || '12').replace(/\D/g, ''), 10) || 12,
      requirement: item.requirement,
      mr_adjustment: item.mr,
      cost: item.cost,
      notes: item.notes,
    };
    updateActiveSheetData((prev) => {
      const existingArmory = prev.armory || armory;
      const isAlreadyInArmory = existingArmory.some(
        (s) => s.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!isAlreadyInArmory) {
        if (isLearnable) {
          recordApExpenditure(1, 'Shields', `Learned Skilled Shield: ${item.name} (1 AP)`, 1, 'Manage Shields');
        } else {
          recordApExpenditure(0, 'Shields', `Added Unskilled Shield: ${item.name} (0 AP - Unskilled)`, 1, 'Manage Shields');
        }
      }
      const updatedSheet = {
        ...prev,
        shield_slot: newShieldItem,
        armory: [...(prev.armory || armory).filter((s) => s.name.toLowerCase() !== item.name.toLowerCase()), newShieldItem],
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };

  const handleDropFromArmory = (shieldName: string) => {
    const targetShield = armory.find((s) => s.name.toLowerCase() === shieldName.toLowerCase());
    const wasSkilled = targetShield ? isShieldSkilled(targetShield) : false;

    updateActiveSheetData((prev) => {
      const updatedArmory = (prev.armory || armory).filter((s) => s.name.toLowerCase() !== shieldName.toLowerCase());
      let nextActiveShield = prev.shield_slot;
      if (shield.name.toLowerCase() === shieldName.toLowerCase()) {
        nextActiveShield = updatedArmory.length > 0
          ? { ...updatedArmory[0], equipped: true }
          : { id: 'shd_none', equipped: false, name: 'None', sk: true, max_block: 0 };
      }

      if (wasSkilled) {
        recordApExpenditure(-1, 'Shields', `Unlearned Skilled Shield: ${shieldName} (-1 AP Refunded)`, 1, 'Manage Shields');
      } else {
        recordApExpenditure(0, 'Shields', `Dropped Unskilled Shield: ${shieldName} (0 AP)`, 1, 'Manage Shields');
      }

      const updatedSheet = {
        ...prev,
        shield_slot: nextActiveShield,
        armory: updatedArmory,
      };
      return {
        ...updatedSheet,
        movement_rate: calculateMovementRate(updatedSheet),
      };
    });
    saveActiveCharacter();
  };



  // Check if shield item is starred
  const isItemStarred = useCallback(
    (targetItem: SupabaseShield | ShieldData | { name: string; id?: number | string }) => {
      const starredList = activeCharacter?.sheet_data?.starred_shields || [];
      if (!starredList.length) return false;

      const rawName = targetItem.name || '';
      const targetId = (targetItem as any).id;

      const catalogMatch = shieldCatalog.find(
        (s) => s.name.toLowerCase() === rawName.toLowerCase()
      );

      return starredList.some((k) => {
        const kStr = String(k);
        if (targetId && kStr === String(targetId)) return true;
        if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return true;
        if (kStr === String(rawName)) return true;
        return false;
      });
    },
    [activeCharacter?.sheet_data?.starred_shields, shieldCatalog]
  );

  // Toggle Starred Shield Item
  const handleToggleStarItem = (targetItem: SupabaseShield | ShieldData | { name: string; id?: number | string }) => {
    const rawName = targetItem.name || '';
    const catalogMatch = shieldCatalog.find(
      (s) => s.name.toLowerCase() === rawName.toLowerCase()
    );

    const itemKey = (targetItem as any).id || (catalogMatch ? catalogMatch.id : null) || rawName;

    updateActiveSheetData((prev) => {
      const currentStarred = prev.starred_shields || [];
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
        starred_shields: updated,
      };
    });
    saveActiveCharacter();
  };

  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [skillFilterMode, setSkillFilterMode] = useState<'all' | 'skilled' | 'unskilled'>('all');
  const [activeShieldTable, setActiveShieldTable] = useState<string>('ALL');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const favoriteShieldTables: string[] = useMemo(() => {
    const favs = activeCharacter?.sheet_data?.favorite_shield_tables;
    if (Array.isArray(favs) && favs.length > 0) {
      return favs;
    }
    return [];
  }, [activeCharacter?.sheet_data?.favorite_shield_tables]);

  const handleUpdatePinnedShieldTables = (tables: string[]) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      favorite_shield_tables: tables,
    }));
    saveActiveCharacter();
  };

  const starredShieldsCount = useMemo(() => {
    return shieldCatalog.filter((s) => isItemStarred(s)).length;
  }, [shieldCatalog, isItemStarred]);

  const armoryNamesSet = useMemo(() => new Set(armory.map((s) => s.name.toLowerCase())), [armory]);
  const filteredArmory = useMemo(
    () => armory.filter((s) => s.name.toLowerCase().includes(leftSearchQuery.toLowerCase().trim())),
    [armory, leftSearchQuery]
  );
  const filteredCatalogShields = useMemo(() => {
    return shieldCatalog.filter((item) => {
      if (localGenreFilter !== 'ALL' && !matchesGenre(item.genres, localGenreFilter as any)) return false;
      if (armoryNamesSet.has(item.name.toLowerCase())) return false;

      const isLearnable = isRequirementLearnable(item.requirement, attributeDice);
      if (skillFilterMode === 'skilled' && !isLearnable) return false;
      if (skillFilterMode === 'unskilled' && isLearnable) return false;

      // Table Quick Deck Filter
      if (activeShieldTable === 'STARRED' && !isItemStarred(item)) return false;
      if (activeShieldTable !== 'ALL' && activeShieldTable !== 'STARRED') {
        const tbl = (item.table_group || (item as any).category || '').toLowerCase();
        const activeLower = activeShieldTable.toLowerCase();
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
  }, [shieldCatalog, armoryNamesSet, skillFilterMode, activeShieldTable, rightSearchQuery, attributeDice, isItemStarred, localGenreFilter]);

  return (
    <div className="bg-gradient-to-b from-cyan-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-cyan-500/90 p-4 flex flex-col gap-3 shadow-lg shadow-cyan-950/20">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <span className="text-base leading-none">🛡️</span>
          </div>
          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-cyan-200 uppercase">
            Shield
          </h3>
          <CardHelpButton ruleKey="col.shields.block" />
          {!shield.equipped && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded-full border border-slate-800">
              No Shield Equipped
            </span>
          )}
        </div>

        {/* Trigger Button */}
        <button
          onClick={() => setShowManageModal(!showManageModal)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm ${
            showManageModal
              ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400'
              : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <span className="font-outfit">Manage Shields</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
            {armory.length}
          </span>
          {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Master 2-Column Split-Pane Manager Modal */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Top Bar */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">🛡️</div>
                  <div>
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Shields Manager
                    </h3>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Manage character shield armory side-by-side with stock catalog.
                    </p>
                  </div>
                </div>

                {/* KISS Top-Center Header Status Pill */}
                <div className="px-3.5 py-1 bg-cyan-950/70 border border-cyan-500/40 rounded-full font-mono font-bold text-xs text-cyan-200 flex items-center gap-2 shadow-md">
                  <span>
                    Skilled <strong className="text-cyan-300">{skilledShieldCount}</strong>; Used{' '}
                    <strong className="text-rose-300">{shieldApSpent} AP</strong>; Available{' '}
                    <strong className="text-emerald-400">{availableAp} AP</strong>
                  </span>
                </div>

                <button
                  onClick={handleCloseManageModal}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2-Column Split-Pane Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                
                {/* --- LEFT COLUMN: ARMORY PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-outfit font-bold uppercase tracking-wider text-cyan-300">
                        Armory
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                        {armory.length}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={leftSearchQuery}
                        onChange={(e) => setLeftSearchQuery(e.target.value)}
                        className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-cyan-500 w-24 sm:w-28"
                      />
                    </div>
                  </div>

                  {/* Scrollable Armory Items */}
                  <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2.5 min-h-0">
                    {filteredArmory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                        <ShieldAlert className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                        <span>No shields in armory. Select from catalog on the right.</span>
                      </div>
                    ) : (
                      filteredArmory.map((item) => {
                        const isActive = shield.equipped && shield.name.toLowerCase() === item.name.toLowerCase();
                        const isLearnable = item.requirement
                          ? isRequirementLearnable(item.requirement, attributeDice)
                          : true;

                        return (
                          <div
                            key={item.id || item.name}
                            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shrink-0 ${
                              isActive
                                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                                : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSelectActiveShield(item)}
                                  className={`px-2 py-0.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all ${
                                    isActive
                                      ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 shadow-sm'
                                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  <span className="text-[10px]">{isActive ? '●' : '○'}</span>
                                  <span>{isActive ? 'Active' : 'Equip'}</span>
                                </button>
                                <span className="font-outfit font-bold text-sm text-slate-100">{item.name}</span>
                                <ItemNotesPopover notes={item.notes || shieldCatalog.find((s) => s.name.toLowerCase() === item.name.toLowerCase())?.notes} itemName={item.name} />
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
                                  onClick={() => handleDropFromArmory(item.name)}
                                  className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg transition-all shrink-0"
                                >
                                  Forget
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono pt-0.5 text-slate-300">
                              <span>Req: <strong className="text-slate-200">{item.requirement || '💪 4'}</strong></span>
                              <span>Blk: <strong className="text-amber-300">🛡️{item.max_block}</strong></span>
                              <span>MR: <strong className="text-cyan-300">{item.mr_adjustment || '👣0'}</strong></span>
                              {isLearnable ? (
                                <span className="text-[10px] text-emerald-400 font-sans font-bold">Skilled</span>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-sans font-semibold">Unskilled</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- RIGHT COLUMN: STOCK CATALOG PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  {/* Catalog Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      🌐 Stock Catalog ({filteredCatalogShields.length})
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
                        className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 cursor-pointer flex-1 min-w-[110px]"
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
                        className="bg-slate-900 text-emerald-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 cursor-pointer flex-1 min-w-[130px]"
                      >
                        <option value="all">🌐 All Qualifications</option>
                        <option value="skilled">🎓 Skilled Only</option>
                        <option value="unskilled">⚪ Unskilled Only</option>
                      </select>
                    </div>

                    {/* 2. Universal Quick Deck Bar */}
                    <QuickDeckBar
                      domain="shields"
                      activeTable={activeShieldTable}
                      onSelectTable={setActiveShieldTable}
                      pinnedTables={favoriteShieldTables}
                      onUpdatePinnedTables={handleUpdatePinnedShieldTables}
                      catalogItems={shieldCatalog}
                      starredCount={starredShieldsCount}
                      colorTheme="cyan"
                      totalCatalogCount={shieldCatalog.length}
                      placeholderText="➕ Pin Shield Table"
                    />

                    {/* 3. Search Bar + Dynamic Result Breadcrumb */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={rightSearchQuery}
                          onChange={(e) => setRightSearchQuery(e.target.value)}
                          placeholder="Search shields, requirements, notes..."
                          className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 w-full"
                        />
                      </div>
                      <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                        {filteredCatalogShields.length} {filteredCatalogShields.length === 1 ? 'item' : 'items'}
                      </div>
                    </div>

                    {/* Zero Matches Feedback & 1-Click Reset */}
                    {filteredCatalogShields.length === 0 && !isLoadingCatalog && (
                      <div className="p-3.5 bg-slate-950/60 rounded-xl border border-cyan-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                        <span className="text-cyan-300 font-semibold">
                          0 shields match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                          {skillFilterMode !== 'all' ? ` • ${skillFilterMode}` : ''}
                          {activeShieldTable !== 'ALL' && activeShieldTable !== 'STARRED' ? ` • ${activeShieldTable}` : ''})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalGenreFilter(activeGenre || 'SciFi');
                            setSkillFilterMode('all');
                            setActiveShieldTable('ALL');
                            setRightSearchQuery('');
                          }}
                          className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        >
                          Reset All Filters
                        </button>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                      {isLoadingCatalog ? (
                        <div className="h-full flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>Loading SupaFlex shields catalog...</span>
                        </div>
                      ) : filteredCatalogShields.length > 0 ? (
                        filteredCatalogShields.map((item, idx) => {
                          const qualifies = isRequirementLearnable(item.requirement, attributeDice);

                          return (
                            <div
                              key={item.id || idx}
                              className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-cyan-500/40 transition-all shrink-0"
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
                                    onClick={() => handleAddToArmory(item)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                      qualifies
                                        ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 shadow-sm'
                                        : 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50 shadow-sm'
                                    }`}
                                    title={qualifies ? 'Learn shield with skilled training' : 'Equip shield as unskilled'}
                                  >
                                    + Learn
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs font-mono pt-0.5 text-slate-400">
                                <span>Req: <strong className="text-slate-200">{item.requirement}</strong></span>
                                <span>Blk: <strong className="text-amber-300">{item.max_block}</strong></span>
                                <span>MR: <strong className="text-cyan-300">{item.mr}</strong></span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-slate-500 italic py-6 text-center">
                          No shields match "{rightSearchQuery}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Status Bar with Standardized "Done" Button (Full Width) */}
              <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🛡️</span>
                  <span className="font-outfit font-bold text-slate-300">Shields Manager</span>
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

      {/* Main Character Sheet Card View */}
      {shield.equipped ? (
        <div className="flex flex-wrap items-center gap-2.5 pt-1 animate-fadeIn">
          {/* Sk Checkbox / Red X Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-xs font-bold text-slate-300 cursor-pointer">
              Sk
            </label>
            <button
              type="button"
              onClick={() => handleSkToggle(!shield.sk)}
              className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-pointer shrink-0 ${
                shield.sk
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm hover:bg-cyan-600/50'
                  : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md hover:bg-rose-900/90'
              }`}
              title={shield.sk ? 'Skilled (Click to mark Unskilled)' : 'Unskilled (Click to mark Skilled)'}
            >
              {shield.sk ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <X className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </button>
          </div>

          {/* Shield Name (Unboxed Clean Text) + Notes Popover */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[130px] pr-1">
            <span className="font-semibold text-slate-100 text-xs truncate min-w-[100px]" title={shield.name}>
              {shield.name}
            </span>
            <ItemNotesPopover notes={shield.notes || shieldCatalog.find((s) => s.name.toLowerCase() === shield.name.toLowerCase())?.notes} itemName={shield.name} />
          </div>

          {/* Block Cell (Auto-Updated from Might) */}
          <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-300">Block</span>
              <span className="text-sm">💪</span>
            </div>
            <div
              className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
              title="Auto-updated matching Character Might rating"
            >
              {derivedBlock}
            </div>
          </div>

          {/* Max Block Read-Only Display Box */}
          <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-slate-300">Block Cap</span>
            <div
              className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
              title="Auto-updated matching equipped shield Block Cap"
            >
              {shield.max_block ?? 'n/a'}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic py-1">
          No shield currently equipped. Use "Manage Shields" to select or equip a shield.
        </p>
      )}
    </div>
  );
};
