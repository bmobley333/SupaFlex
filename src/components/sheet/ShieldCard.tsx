// src/components/sheet/ShieldCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, X, Check, Search, ShieldAlert, Loader2, Star, Trash2, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { compareMsoItems, isMsoEntry } from '../../utils/kitUtils';
import {
  ShieldData,
  SupabaseShield,
  calculateAvailableAp,
  calculateMovementRate,
} from '../../types/game';
import {
  getCharacterKnownPaths,
  evaluateItemAp,
  matchesApCategoryFilter,
  ApCostCategory,
  ApEvaluationResult,
} from '../../utils/pathApUtils';

export const ShieldCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
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

  const knownPaths = useMemo(() => getCharacterKnownPaths(activeCharacter), [activeCharacter]);

  const getShieldEvalResult = useCallback(
    (item: SupabaseShield): ApEvaluationResult => {
      return evaluateItemAp(item.path, item.requirement, attributeDice, knownPaths, undefined);
    },
    [knownPaths, attributeDice]
  );

  const isShieldSkilled = (item: ShieldData): boolean => {
    if (!item || item.id === 'shd_none') return false;
    return item.sk ?? true;
  };

  const skilledShieldList = useMemo(() => {
    return armory.filter(isShieldSkilled);
  }, [armory]);

  const skilledShieldCount = skilledShieldList.length;
  const shieldApSpent = useMemo(() => {
    return skilledShieldList.reduce((acc, item) => acc + (item.ap_cost || 1), 0);
  }, [skilledShieldList]);
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


  const handleAddToArmory = (item: SupabaseShield) => {
    const evalResult = getShieldEvalResult(item);

    if (evalResult.requiresGmApproval) {
      const confirmed = window.confirm(
        `Learning "${item.name}" is Out-of-Path and costs ${evalResult.apCost} AP.\n\nOut-of-Path equipment requires GM approval in campaign play. Proceed with learning?`
      );
      if (!confirmed) return;
    }

    let blockVal = parseInt((item.max_block || '12').replace(/\D/g, ''), 10) || 12;
    if (!evalResult.meetsReq) {
      blockVal = Math.max(4, blockVal - 4);
    }

    const apCost = evalResult.apCost;
    const canAfford = availableAp >= apCost;
    const isSkilled = canAfford;

    const newShieldItem: ShieldData = {
      id: `shd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      equipped: true,
      name: item.name,
      sk: isSkilled,
      max_block: blockVal,
      requirement: item.requirement,
      mr_adjustment: item.mr,
      cost: item.cost,
      notes: item.notes,
      ap_cost: evalResult.apCost,
      effect: `${evalResult.apCost} AP${evalResult.statDownscaled ? ' (Downscaled -4 Blk)' : ''}`,
    };

    updateActiveSheetData((prev) => {
      const existingArmory = prev.armory || armory;
      const isAlreadyInArmory = existingArmory.some(
        (s) => s.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!isAlreadyInArmory && isSkilled) {
        recordApExpenditure(
          evalResult.apCost,
          'Shields',
          `Learned Shield: ${item.name} (${evalResult.apCost} AP${evalResult.requiresGmApproval ? ' • 👑 GM Approval' : ''})`,
          1,
          'Manage Shields'
        );
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

    if (!isSkilled) {
      window.alert(
        `Learned "${item.name}" as Unskilled!\n\nYou have ${availableAp} AP available, but becoming Skilled requires ${apCost} AP.\n\nYou can toggle this to Skilled in the Shield SK Manager once you have enough AP.`
      );
    }
  };

  // Toggle Skilled (SK) state for a shield in armory
  const handleToggleSkShield = (item: ShieldData, wantSkilled: boolean) => {
    const isCurrentlySkilled = isShieldSkilled(item);
    if (isCurrentlySkilled === wantSkilled) return;

    const apCost = item.ap_cost || 1;

    if (wantSkilled) {
      if (availableAp < apCost) {
        window.alert(
          `Cannot mark "${item.name}" as Skilled!\n\nRequires ${apCost} AP, but you only have ${availableAp} AP available.`
        );
        return;
      }

      updateActiveSheetData((prev) => {
        const updatedArmory = (prev.armory || armory).map((s) =>
          s.name.toLowerCase() === item.name.toLowerCase() ? { ...s, sk: true } : s
        );
        let nextShieldSlot = prev.shield_slot;
        if (prev.shield_slot && prev.shield_slot.name.toLowerCase() === item.name.toLowerCase()) {
          nextShieldSlot = { ...prev.shield_slot, sk: true };
        }
        const updatedSheet = {
          ...prev,
          shield_slot: nextShieldSlot,
          armory: updatedArmory,
        };
        return {
          ...updatedSheet,
          movement_rate: calculateMovementRate(updatedSheet),
        };
      });
      recordApExpenditure(
        apCost,
        'Shields',
        `Learned Shield Proficiency: ${item.name} (${apCost} AP)`,
        1,
        'Manage Shields'
      );
      saveActiveCharacter();
    } else {
      updateActiveSheetData((prev) => {
        const updatedArmory = (prev.armory || armory).map((s) =>
          s.name.toLowerCase() === item.name.toLowerCase() ? { ...s, sk: false } : s
        );
        let nextShieldSlot = prev.shield_slot;
        if (prev.shield_slot && prev.shield_slot.name.toLowerCase() === item.name.toLowerCase()) {
          nextShieldSlot = { ...prev.shield_slot, sk: false };
        }
        const updatedSheet = {
          ...prev,
          shield_slot: nextShieldSlot,
          armory: updatedArmory,
        };
        return {
          ...updatedSheet,
          movement_rate: calculateMovementRate(updatedSheet),
        };
      });
      recordApExpenditure(
        -apCost,
        'Shields',
        `Marked Shield as Unskilled: ${item.name} (-${apCost} AP Refunded)`,
        1,
        'Manage Shields'
      );
      saveActiveCharacter();
    }
  };

  const handleDropFromArmory = (shieldName: string) => {
    const targetShield = armory.find((s) => s.name.toLowerCase() === shieldName.toLowerCase());
    const wasSkilled = targetShield ? isShieldSkilled(targetShield) : false;
    const apRefund = targetShield?.ap_cost || 1;

    updateActiveSheetData((prev) => {
      const updatedArmory = (prev.armory || armory).filter((s) => s.name.toLowerCase() !== shieldName.toLowerCase());
      let nextActiveShield = prev.shield_slot;
      if (shield.name.toLowerCase() === shieldName.toLowerCase()) {
        nextActiveShield = updatedArmory.length > 0
          ? { ...updatedArmory[0], equipped: true }
          : { id: 'shd_none', equipped: false, name: 'None', sk: true, max_block: 0 };
      }

      if (wasSkilled) {
        recordApExpenditure(-apRefund, 'Shields', `Unlearned Shield: ${shieldName} (-${apRefund} AP Refunded)`, 1, 'Manage Shields');
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
  const [shieldDomainFilter, setShieldDomainFilter] = useState<string>('ALL');
  const [shieldFilter, setShieldFilter] = useState<string>('ALL');
  const [activeApCategory, setActiveApCategory] = useState<ApCostCategory>('all');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const uniqueShieldDomains = useMemo(() => {
    const set = new Set<string>();
    shieldCatalog.forEach((s) => {
      const d = s.domain || s.discipline;
      if (d && d.trim()) set.add(d.trim());
    });
    return Array.from(set).sort((a, b) => compareMsoItems({ name: a }, { name: b }, isGsUnlocked));
  }, [shieldCatalog, isGsUnlocked]);

  const starredShieldsCount = useMemo(() => {
    return shieldCatalog.filter((s) => isItemStarred(s)).length;
  }, [shieldCatalog, isItemStarred]);

  const armoryNamesSet = useMemo(() => new Set(armory.map((s) => s.name.toLowerCase())), [armory]);
  const filteredArmory = useMemo(() => {
    let list = armory;
    if (leftSearchQuery.trim()) {
      list = armory.filter((s) => s.name.toLowerCase().includes(leftSearchQuery.toLowerCase().trim()));
    }
    return [...list].sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [armory, leftSearchQuery, isGsUnlocked]);

  const filteredCatalogShields = useMemo(() => {
    return shieldCatalog
      .filter((item) => {
        if (localGenreFilter !== 'ALL' && !matchesGenre(item.genres, localGenreFilter as any)) return false;
        if (armoryNamesSet.has(item.name.toLowerCase())) return false;

        // 1. Domain Filter
        if (shieldDomainFilter !== 'ALL') {
          const disc = (item.domain || item.discipline || '').toLowerCase().trim();
          if (disc !== shieldDomainFilter.toLowerCase().trim()) return false;
        }

        // 2. Shield / Block / Requirement Filter (4, 6, 8, 10, 12, Starred)
        if (shieldFilter === 'STARRED') {
          if (!isItemStarred(item)) return false;
        } else if (shieldFilter !== 'ALL') {
          const reqNum = parseInt(String(item.requirement || '').replace(/[^0-9]/g, ''), 10);
          if (reqNum !== parseInt(shieldFilter, 10)) return false;
        }

        // 3. Category Row (AP cost / Path / Req)
        const evalResult = getShieldEvalResult(item);
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
    shieldCatalog,
    armoryNamesSet,
    shieldDomainFilter,
    shieldFilter,
    activeApCategory,
    rightSearchQuery,
    getShieldEvalResult,
    isItemStarred,
    localGenreFilter,
    isGsUnlocked,
  ]);

  return (
    <div className="bg-gradient-to-b from-cyan-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-cyan-500/90 p-4 flex flex-col gap-3 shadow-lg shadow-cyan-950/20">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Shield SK Manager"
          >
            <div className="p-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)] group-hover:scale-105 group-hover:border-cyan-400 transition-all">
              <span className="text-base leading-none">🛡️</span>
            </div>
            <h3 className="font-outfit font-extrabold text-sm tracking-widest text-cyan-200 uppercase group-hover:text-white transition-colors flex items-center gap-1.5">
              <span>Shield SK</span>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400/70 group-hover:text-cyan-300 group-hover:translate-y-0.5 transition-all" />
            </h3>
          </button>
          <CardHelpButton ruleKey="col.shields.block" />
          {!shield.equipped && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded-full border border-slate-800">
              No Shield Equipped
            </span>
          )}
        </div>

        {/* Manage Shields Action Button */}
        <button
          type="button"
          onClick={() => setShowManageModal(!showManageModal)}
          className={`p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group ${
            showManageModal
              ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
              : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300 hover:text-white'
          }`}
          title="Open Shield SK Manager"
        >
          <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
        </button>

        {/* Master 2-Column Split-Pane Manager Modal */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Top Bar */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">🛡️</div>
                  <div>
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Shield SK Manager
                    </h3>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Manage character shield block proficiencies and combat defensive techniques.
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
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
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
                        Proficiencies
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
                                  className={`px-2 py-0.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                                    isActive
                                      ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 shadow-sm'
                                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  <span className="text-[10px]">{isActive ? '●' : '○'}</span>
                                  <span>{isActive ? 'Active' : 'Equip'}</span>
                                </button>
                                <span className={`font-outfit font-bold text-sm inline-flex items-center align-baseline ${isGsUnlocked && isMsoEntry(item.name) ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                                  <span>{isGsUnlocked && isMsoEntry(item.name) ? `🌌 ${item.name}` : item.name}</span>
                                  <ItemNotesPopover notes={item.notes || shieldCatalog.find((s) => s.name.toLowerCase() === item.name.toLowerCase())?.notes} itemName={item.name} inline />
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                                  {item.ap_cost || 1} AP
                                </span>
                                {/* Option A: KISS Micro Multi-Option Pill Switch SK [✓ | ✗] */}
                                <div className="flex items-center gap-0.5 bg-slate-950/80 border border-slate-800/90 rounded-lg p-0.5 shadow-inner">
                                  <span className="text-[10px] font-mono font-extrabold text-slate-400 pl-1 pr-0.5 select-none">
                                    SK
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSkShield(item, true)}
                                    className={`p-1 rounded transition-all cursor-pointer ${
                                      isShieldSkilled(item)
                                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                    }`}
                                    title={isShieldSkilled(item) ? 'Skilled' : `Click to mark Skilled (${item.ap_cost || 1} AP)`}
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSkShield(item, false)}
                                    className={`p-1 rounded transition-all cursor-pointer ${
                                      !isShieldSkilled(item)
                                        ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                    }`}
                                    title={!isShieldSkilled(item) ? 'Unskilled' : `Click to mark Unskilled (Refund ${item.ap_cost || 1} AP)`}
                                  >
                                    <X className="w-3 h-3 stroke-[3]" />
                                  </button>
                                </div>

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
                                  onClick={() => handleDropFromArmory(item.name)}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Forget shield proficiency"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono pt-0.5 text-slate-300">
                              <span>Req: <strong className="text-slate-200">{item.requirement || '💪 4'}</strong></span>
                              <span>Blk: <strong className="text-amber-300">🛡️{item.max_block}</strong></span>
                              <span>MR: <strong className="text-cyan-300">{item.mr_adjustment || '👣0'}</strong></span>
                              <span className={`text-[10px] font-sans font-bold ${
                                (item.ap_cost === 1 || item.ap_cost === 2) ? 'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {item.ap_cost === 1 ? 'In-Path (Skilled)' : item.ap_cost === 2 ? 'In-Path (-4 Blk)' : item.ap_cost === 3 ? 'Out-Path (Skilled)' : 'Out-Path (-4 Blk)'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- RIGHT COLUMN: STOCK CATALOG PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  {/* Stock Catalog Content */}
                  <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
                    {/* 1. DENSE 3-DROPDOWN ROW (Genre, Domain, Filter) */}
                    <div className="grid grid-cols-3 gap-1.5 shrink-0">
                      {/* Genre Dropdown */}
                      <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">
                          Genre
                        </span>
                        <select
                          value={localGenreFilter}
                          onChange={(e) => setLocalGenreFilter(e.target.value)}
                          className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                            localGenreFilter !== 'ALL'
                              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-extrabold'
                              : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-cyan-500'
                          }`}
                        >
                          <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                          <option value="Medieval" className="bg-slate-900 text-slate-200">🏰 Med</option>
                          <option value="Modern" className="bg-slate-900 text-slate-200">⚙️ Mod</option>
                          <option value="SciFi" className="bg-slate-900 text-slate-200">🚀 SciFi</option>
                        </select>
                      </div>

                      {/* Domain Dropdown */}
                      <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">
                          Domain
                        </span>
                        <select
                          value={shieldDomainFilter}
                          onChange={(e) => setShieldDomainFilter(e.target.value)}
                          className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                            shieldDomainFilter !== 'ALL'
                              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-extrabold'
                              : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-cyan-500'
                          }`}
                        >
                          <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                          {uniqueShieldDomains.map((dom) => (
                            <option key={dom} value={dom} className="bg-slate-900 text-slate-200">
                              {dom}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Filter Dropdown (Block / Starred) */}
                      <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 gap-1.5 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">
                          Filter
                        </span>
                        <select
                          value={shieldFilter}
                          onChange={(e) => setShieldFilter(e.target.value)}
                          className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                            shieldFilter !== 'ALL'
                              ? 'bg-yellow-950/90 border-yellow-400 text-yellow-100 ring-1 ring-yellow-400/50 shadow-[0_0_12px_rgba(250,204,21,0.3)] font-extrabold'
                              : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-cyan-500'
                          }`}
                        >
                          <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                          <option value="STARRED" className="bg-slate-900 text-slate-200">⭐ Starred {starredShieldsCount > 0 ? `(${starredShieldsCount})` : ''}</option>
                          <option value="4" className="bg-slate-900 text-slate-200">🛡️ Blk 4</option>
                          <option value="6" className="bg-slate-900 text-slate-200">🛡️ Blk 6</option>
                          <option value="8" className="bg-slate-900 text-slate-200">🛡️ Blk 8</option>
                          <option value="10" className="bg-slate-900 text-slate-200">🛡️ Blk 10</option>
                          <option value="12" className="bg-slate-900 text-slate-200">🛡️ Blk 12</option>
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
                            ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm font-extrabold'
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
                      <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2 text-xs text-amber-200 shrink-0">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="leading-tight">
                          <strong>👑 Out-of-Path Acquisitions:</strong> cost more AP AND require GM Approval.
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
                          {shieldDomainFilter !== 'ALL' ? ` • ${shieldDomainFilter}` : ''}
                          {shieldFilter !== 'ALL' ? ` • ${shieldFilter}` : ''}
                          {activeApCategory !== 'all' ? ` • ${activeApCategory}` : ''})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalGenreFilter(activeGenre || 'SciFi');
                            setShieldDomainFilter('ALL');
                            setShieldFilter('ALL');
                            setActiveApCategory('all');
                            setRightSearchQuery('');
                          }}
                          className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                        >
                          Reset All Filters
                        </button>
                      </div>
                    )}

                    {/* Scrollable Catalog List */}
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                      {isLoadingCatalog ? (
                        <div className="h-full flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>Loading SupaFlex shields catalog...</span>
                        </div>
                      ) : filteredCatalogShields.length > 0 ? (
                        filteredCatalogShields.map((item, idx) => {
                          const evalResult = getShieldEvalResult(item);

                          return (
                            <div
                              key={item.id || idx}
                              className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-cyan-500/40 transition-all shrink-0"
                            >
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-bold text-sm inline-flex items-center align-baseline ${isGsUnlocked && isMsoEntry(item.name) ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                                    <span>{isGsUnlocked && isMsoEntry(item.name) ? `🌌 ${item.name}` : item.name}</span>
                                    <ItemNotesPopover notes={item.notes} itemName={item.name} inline />
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
                                <span>Blk: <strong className="text-amber-300">{item.max_block}</strong></span>
                                <span>MR: <strong className="text-cyan-300">{item.mr}</strong></span>
                                {evalResult.statDownscaled ? (
                                  <span className="text-[10px] text-amber-400 font-sans font-semibold">
                                    Downscaled (-4 Blk)
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
                  <span className="font-outfit font-bold text-slate-300">Shield SK Manager</span>
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
          {/* Read-Only Sk Indicator (Managed via Shield SK Manager) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-300 select-none">
              Sk
            </span>
            <div
              className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-default select-none shrink-0 ${
                shield.sk
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm'
                  : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md'
              }`}
              title={shield.sk ? 'Skilled (Manage in Shield SK Manager)' : 'Unskilled (Manage in Shield SK Manager)'}
            >
              {shield.sk ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <X className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </div>
          </div>

          {/* Shield Name (Unboxed Clean Text) + Notes Popover */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[130px] pr-1">
            <span
              className={`text-xs inline-flex items-center align-baseline min-w-[100px] max-w-full ${isGsUnlocked && isMsoEntry(shield.name) ? 'text-purple-300 font-bold' : 'font-semibold text-slate-100'}`}
              title={shield.name}
            >
              <span className="truncate">{isGsUnlocked && isMsoEntry(shield.name) ? `🌌 ${shield.name}` : shield.name}</span>
              <ItemNotesPopover notes={shield.notes || shieldCatalog.find((s) => s.name.toLowerCase() === shield.name.toLowerCase())?.notes} itemName={shield.name} inline />
            </span>
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
