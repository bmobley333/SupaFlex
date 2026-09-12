// src/components/sheet/WeaponsCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, X, Check, Swords, Loader2, Search, Star, Trash2, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import {
  WeaponSlot,
  SupabaseWeapon,
  WeaponVariantOption,
  splitWeaponIntoVariants,
  calculateAvailableAp,
} from '../../types/game';

import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { compareMsoItems, compareMsoOptions, isMsoEntry } from '../../utils/kitUtils';
import {
  getCharacterKnownPaths,
  evaluateItemAp,
  matchesApCategoryFilter,
  ApCostCategory,
  ApEvaluationResult,
  isItemInPath,
  isItemRequirementMet,
} from '../../utils/pathApUtils';

const DIE_SCALE = [4, 6, 8, 10, 12];

const MHS_COLORS: Record<string, { select: string; badge: string }> = {
  M: {
    select: 'bg-rose-950/80 text-rose-300 border-rose-500/40 focus:border-rose-400',
    badge: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
  },
  H: {
    select: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 focus:border-emerald-400',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
  },
  S: {
    select: 'bg-amber-950/80 text-amber-300 border-amber-500/40 focus:border-amber-400',
    badge: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
  },
};

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

const getStepDownDie = (num: number): number => {
  const idx = DIE_SCALE.indexOf(num);
  if (idx > 0) return DIE_SCALE[idx - 1];
  return 4;
};

const calculateWeaponAtk = (name: string, mhsCategory: string, attributeDice: Record<string, string>): number => {
  const cleanName = (name || '').toLowerCase();
  let baseVal = getDieNum(attributeDice?.might);
  const cat = (mhsCategory || '').trim().toLowerCase();
  if (cat.startsWith('h')) {
    baseVal = getDieNum(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNum(attributeDice?.mind);
  }

  if (cleanName.includes('throw object') || cleanName === 'throw') {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

const calculateWeaponDmg = (name: string, mhsCategory: string, attributeDice: Record<string, string>): number => {
  const cleanName = (name || '').toLowerCase();
  let baseVal = getDieNum(attributeDice?.might);
  const cat = (mhsCategory || '').trim().toLowerCase();
  if (cat.startsWith('h')) {
    baseVal = getDieNum(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNum(attributeDice?.mind);
  }

  if (cleanName.includes('brawl') || cleanName.includes('unarmed') || cleanName.includes('improvised')) {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

export const WeaponsCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();
  const rawWeapons: WeaponSlot[] = activeCharacter?.sheet_data?.weapons || [];
  const weapons: WeaponSlot[] = useMemo(() => {
    return rawWeapons.filter((w) => w && w.name && w.name.trim() !== '');
  }, [rawWeapons]);
  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'weapons') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  // Search filter states for split panes
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');

  // Supabase Weapons Catalog State
  const [supabaseWeapons, setSupabaseWeapons] = useState<SupabaseWeapon[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);


  // Helper to extract base name from slot name like "Hand Axe (Melee)" -> "Hand Axe"
  const getBaseWeaponName = (slotName: string): string => {
    return (slotName || '').replace(/\s*\([^)]+\)$/, '').trim();
  };

  // Fetch weapons catalog from Supabase on modal opening
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getWeapons()
        .then((data) => {
          setSupabaseWeapons(data);
        })
        .catch((err) => {
          console.error('Failed to load weapons catalog:', err);
        })
        .finally(() => {
          setIsLoadingCatalog(false);
        });
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
    if (showManageModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);


  // Group active equipped weapon slots by base weapon name for Left Column pane
  const groupedEquippedWeapons = useMemo(() => {
    const map = new Map<string, { baseName: string; slots: WeaponSlot[]; notes?: string }>();

    weapons.forEach((slot) => {
      const baseName = getBaseWeaponName(slot.name);
      const key = baseName.toLowerCase();
      const stockMatch = supabaseWeapons.find((w) => w.name.toLowerCase() === key);
      const resolvedNotes = slot.notes || stockMatch?.notes;

      if (!map.has(key)) {
        map.set(key, { baseName, slots: [], notes: resolvedNotes });
      } else if (!map.get(key)!.notes && resolvedNotes) {
        map.get(key)!.notes = resolvedNotes;
      }
      map.get(key)!.slots.push(slot);
    });

    return Array.from(map.values()).sort((a, b) => compareMsoItems({ name: a.baseName }, { name: b.baseName }, isGsUnlocked));
  }, [weapons, supabaseWeapons, isGsUnlocked]);

  // Skilled weapon groups (groups containing at least 1 slot with sk === true)
  const skilledWeaponGroups = useMemo(() => {
    return groupedEquippedWeapons.filter((g) => g.slots.some((s) => s.sk));
  }, [groupedEquippedWeapons]);

  const skilledWeaponsCount = skilledWeaponGroups.length;
  const weaponApSpent = useMemo(() => {
    return skilledWeaponGroups.reduce((acc, g) => {
      const groupCost = g.slots.reduce((max, s) => Math.max(max, s.ap_cost || 1), 1);
      return acc + groupCost;
    }, 0);
  }, [skilledWeaponGroups]);

  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const knownPaths = useMemo(() => getCharacterKnownPaths(activeCharacter), [activeCharacter]);

  const getWeaponEvalResult = useCallback(
    (weapon: SupabaseWeapon): ApEvaluationResult => {
      const inPath = isItemInPath(weapon.path, knownPaths);
      const variants = splitWeaponIntoVariants(weapon);
      const anyMeetsReq = variants.some((v) => isItemRequirementMet(v.requirementStr, attributeDice, v.variantType));

      if (inPath && anyMeetsReq) {
        return { inPath: true, meetsReq: true, category: '1AP', apCost: 1, requiresGmApproval: false, statDownscaled: false };
      } else if (inPath && !anyMeetsReq) {
        return { inPath: true, meetsReq: false, category: '2AP', apCost: 2, requiresGmApproval: false, statDownscaled: false };
      } else if (!inPath && anyMeetsReq) {
        return { inPath: false, meetsReq: true, category: '3AP', apCost: 3, requiresGmApproval: true, statDownscaled: false };
      } else {
        return { inPath: false, meetsReq: false, category: '4AP', apCost: 4, requiresGmApproval: true, statDownscaled: false };
      }
    },
    [knownPaths, attributeDice]
  );

  // Equip all variants of a weapon to the character sheet
  const handleEquipWeapon = (weapon: SupabaseWeapon, variantsToEquip: WeaponVariantOption[]) => {
    const evalResult = getWeaponEvalResult(weapon);

    if (evalResult.requiresGmApproval) {
      const confirmed = window.confirm(
        `Learning "${weapon.name}" is Out-of-Path and costs ${evalResult.apCost} AP.\n\nOut-of-Path equipment requires GM approval in campaign play. Proceed with learning?`
      );
      if (!confirmed) return;
    }

    const apCost = evalResult.apCost;
    const canAfford = availableAp >= apCost;
    const isSkilled = canAfford;

    const newSlots: WeaponSlot[] = variantsToEquip.map((variant) => {
      const calculatedAtk = calculateWeaponAtk(variant.name, variant.mhs, attributeDice);
      const isSpecialDmg = variant.dmg === '❌' || weapon.dmg === '❌';
      const calculatedDmg = isSpecialDmg ? '❌' : String(calculateWeaponDmg(variant.name, variant.mhs, attributeDice));

      const cleanBlockNum = variant.max_block ? variant.max_block.replace('🛡️', '') : 'n/a';
      const slotName = weapon.type.includes(',') ? `${variant.name} (${variant.variantType})` : variant.name;

      return {
        id: `wep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: slotName,
        sk: isSkilled,
        mhs: variant.mhs,
        atk: String(calculatedAtk),
        dmg: calculatedDmg,
        max_blk: cleanBlockNum,
        effect: `${variant.variantType} Weapon (${evalResult.apCost} AP, Req ${variant.requirementStr})`,
        notes: weapon.notes,
        ap_cost: evalResult.apCost,
      };
    });

    updateActiveSheetData((prev) => {
      const existingNames = new Set((prev.weapons || []).map((w) => w.name.toLowerCase()));
      const filteredNewSlots = newSlots.filter((s) => !existingNames.has(s.name.toLowerCase()));
      if (filteredNewSlots.length > 0 && isSkilled) {
        recordApExpenditure(
          evalResult.apCost,
          'Weapons',
          `Learned Weapon: ${weapon.name} (${evalResult.apCost} AP${evalResult.requiresGmApproval ? ' • 👑 GM Approval' : ''})`,
          1,
          'Manage Weapons'
        );
      }
      return {
        ...prev,
        weapons: [...(prev.weapons || []), ...filteredNewSlots].sort((a, b) => compareMsoItems(a, b, isGsUnlocked)),
      };
    });
    saveActiveCharacter();

    if (!isSkilled) {
      window.alert(
        `Learned "${weapon.name}" as Unskilled!\n\nYou have ${availableAp} AP available, but becoming Skilled requires ${apCost} AP.\n\nYou can toggle this to Skilled in the Weapon SK Manager once you have enough AP.`
      );
    }
  };

  // Toggle Skilled (SK) state for an entire weapon group
  const handleToggleSkWeaponGroup = (baseWeaponName: string, wantSkilled: boolean) => {
    const targetGroup = groupedEquippedWeapons.find(
      (g) => g.baseName.toLowerCase() === baseWeaponName.toLowerCase()
    );
    if (!targetGroup) return;

    const currentlySkilled = targetGroup.slots.some((s) => s.sk);
    if (currentlySkilled === wantSkilled) return;

    const groupCost = targetGroup.slots.reduce((max, s) => Math.max(max, s.ap_cost || 1), 1);

    if (wantSkilled) {
      if (availableAp < groupCost) {
        window.alert(
          `Cannot mark "${baseWeaponName}" as Skilled!\n\nRequires ${groupCost} AP, but you only have ${availableAp} AP available.`
        );
        return;
      }

      updateActiveSheetData((prev) => ({
        ...prev,
        weapons: (prev.weapons || []).map((w) =>
          getBaseWeaponName(w.name).toLowerCase() === baseWeaponName.toLowerCase()
            ? { ...w, sk: true }
            : w
        ),
      }));
      recordApExpenditure(
        groupCost,
        'Weapons',
        `Learned Weapon Proficiency: ${baseWeaponName} (${groupCost} AP)`,
        1,
        'Manage Weapons'
      );
      saveActiveCharacter();
    } else {
      updateActiveSheetData((prev) => ({
        ...prev,
        weapons: (prev.weapons || []).map((w) =>
          getBaseWeaponName(w.name).toLowerCase() === baseWeaponName.toLowerCase()
            ? { ...w, sk: false }
            : w
        ),
      }));
      recordApExpenditure(
        -groupCost,
        'Weapons',
        `Marked Weapon as Unskilled: ${baseWeaponName} (-${groupCost} AP Refunded)`,
        1,
        'Manage Weapons'
      );
      saveActiveCharacter();
    }
  };

  // Un-equip all variants matching a base weapon name
  const handleDropWeapon = (baseWeaponName: string) => {
    const targetGroup = groupedEquippedWeapons.find(
      (g) => g.baseName.toLowerCase() === baseWeaponName.toLowerCase()
    );
    const wasSkilled = targetGroup ? targetGroup.slots.some((s) => s.sk) : false;
    const apRefund = targetGroup ? (targetGroup.slots.find((s) => s.ap_cost)?.ap_cost || 1) : 1;

    updateActiveSheetData((prev) => ({
      ...prev,
      weapons: (prev.weapons || [])
        .filter((w) => getBaseWeaponName(w.name).toLowerCase() !== baseWeaponName.toLowerCase())
        .sort((a, b) => compareMsoItems(a, b, isGsUnlocked)),
    }));

    if (wasSkilled) {
      recordApExpenditure(-apRefund, 'Weapons', `Unlearned Weapon: ${baseWeaponName} (-${apRefund} AP Refunded)`, 1, 'Manage Weapons');
    }

    saveActiveCharacter();
  };





  // Filtered grouped equipped weapons for Left Column search
  const filteredGroupedEquippedWeapons = useMemo(() => {
    if (!leftSearchQuery.trim()) return groupedEquippedWeapons;
    const q = leftSearchQuery.toLowerCase().trim();
    return groupedEquippedWeapons.filter(
      (g) =>
        g.baseName.toLowerCase().includes(q) ||
        g.slots.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [groupedEquippedWeapons, leftSearchQuery]);

  // Check if a weapon is starred
  const isItemStarred = useCallback(
    (targetItem: SupabaseWeapon | WeaponSlot | { name: string; id?: number | string }) => {
      const starredList = activeCharacter?.sheet_data?.starred_weapons || [];
      if (!starredList.length) return false;

      const rawName = targetItem.name || '';
      const baseName = getBaseWeaponName(rawName);
      const targetId = (targetItem as any).id;

      const catalogMatch = supabaseWeapons.find(
        (w) =>
          w.name.toLowerCase() === rawName.toLowerCase() ||
          w.name.toLowerCase() === baseName.toLowerCase()
      );

      return starredList.some((k) => {
        const kStr = String(k);
        if (targetId && kStr === String(targetId)) return true;
        if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return true;
        if (kStr === String(rawName)) return true;
        if (kStr === String(baseName)) return true;
        return false;
      });
    },
    [activeCharacter?.sheet_data?.starred_weapons, supabaseWeapons]
  );

  // Toggle Starred Weapon
  const handleToggleStarItem = (targetItem: SupabaseWeapon | WeaponSlot | { name: string; id?: number | string }) => {
    const rawName = targetItem.name || '';
    const baseName = getBaseWeaponName(rawName);

    const catalogMatch = supabaseWeapons.find(
      (w) =>
        w.name.toLowerCase() === rawName.toLowerCase() ||
        w.name.toLowerCase() === baseName.toLowerCase()
    );

    const itemKey = (targetItem as any).id || (catalogMatch ? catalogMatch.id : null) || baseName || rawName;

    updateActiveSheetData((prev) => {
      const currentStarred = prev.starred_weapons || [];
      const currentlyStarred = isItemStarred(targetItem);
      let updated: (string | number)[];

      if (currentlyStarred) {
        updated = currentStarred.filter((k) => {
          const kStr = String(k);
          if ((targetItem as any).id && kStr === String((targetItem as any).id)) return false;
          if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return false;
          if (kStr === String(rawName)) return false;
          if (kStr === String(baseName)) return false;
          return true;
        });
      } else {
        updated = currentStarred.some((k) => String(k) === String(itemKey))
          ? currentStarred
          : [...currentStarred, itemKey];
      }

      return {
        ...prev,
        starred_weapons: updated,
      };
    });
    saveActiveCharacter();
  };

  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [weaponDisciplineFilter, setWeaponDisciplineFilter] = useState<string>('ALL');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<string>('ALL');
  const [activeApCategory, setActiveApCategory] = useState<ApCostCategory>('all');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  const availableDisciplines = useMemo(() => {
    const set = new Set<string>();
    supabaseWeapons.forEach((w) => {
      const d = w.domain || w.discipline;
      if (d && d.trim()) {
        set.add(d.trim());
      }
    });
    return Array.from(set).sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [supabaseWeapons, isGsUnlocked]);

  const starredWeaponsCount = useMemo(() => {
    return supabaseWeapons.filter((w) => isItemStarred(w)).length;
  }, [supabaseWeapons, isItemStarred]);

  // Set of lowercase equipped base weapon names for strict deduplication
  const equippedBaseNamesSet = useMemo(() => {
    const set = new Set<string>();
    weapons.forEach((w) => {
      const base = getBaseWeaponName(w.name).toLowerCase();
      if (base) set.add(base);
    });
    return set;
  }, [weapons]);

  // Filter stock catalog weapons for Right Column pane (strict deduplication & genre filtering)
  const filteredCatalogWeapons = useMemo(() => {
    return supabaseWeapons
      .filter((weapon) => {
        // 0. Local Setting Scope Filtering
        if (localGenreFilter !== 'ALL' && !matchesGenre(weapon.genres, localGenreFilter as any)) {
          return false;
        }

        // 1. Strict Deduplication: If already equipped in arsenal, filter out of Stock Catalog
        if (equippedBaseNamesSet.has(weapon.name.toLowerCase())) {
          return false;
        }

        // 1.2. Domain / Discipline Dropdown Filter
        if (weaponDisciplineFilter !== 'ALL') {
          const disc = (weapon.domain || weapon.discipline || '').toLowerCase().trim();
          if (disc !== weaponDisciplineFilter.toLowerCase().trim()) {
            return false;
          }
        }

        // 1.3. Filter Dropdown (Types & Starred)
        if (weaponTypeFilter === 'STARRED') {
          if (!isItemStarred(weapon)) return false;
        } else if (weaponTypeFilter !== 'ALL') {
          const rawType = (weapon.type || '').toLowerCase().trim();
          const nameLower = weapon.name.toLowerCase();
          if (weaponTypeFilter === 'Melee, Hurled') {
            if (!(rawType.includes('melee') && rawType.includes('hurled'))) return false;
          } else if (weaponTypeFilter === 'Melee, Shot') {
            if (!(rawType.includes('melee') && rawType.includes('shot'))) return false;
          } else if (weaponTypeFilter === 'Melee') {
            if (!rawType.includes('melee') || rawType.includes('hurled') || rawType.includes('shot')) return false;
          } else if (weaponTypeFilter === 'Hurled') {
            if (!rawType.includes('hurled') || rawType.includes('melee') || rawType.includes('shot')) return false;
          } else if (weaponTypeFilter === 'Shot') {
            if (!rawType.includes('shot') || rawType.includes('melee') || rawType.includes('hurled')) return false;
          } else if (weaponTypeFilter === 'Unarmed') {
            if (!rawType.includes('unarmed') && !nameLower.includes('brawl') && !nameLower.includes('unarmed')) return false;
          } else {
            if (!rawType.includes(weaponTypeFilter.toLowerCase())) return false;
          }
        }

        // 2. Category Row AP / Path / Req filter
        const evalResult = getWeaponEvalResult(weapon);
        if (!matchesApCategoryFilter(activeApCategory, evalResult)) {
          return false;
        }

        // 3. Search filter
        if (rightSearchQuery.trim()) {
          const q = rightSearchQuery.toLowerCase().trim();
          const matchesName = weapon.name.toLowerCase().includes(q);
          const matchesType = (weapon.type || '').toLowerCase().includes(q);
          const matchesNotes = (weapon.notes || '').toLowerCase().includes(q);
          return matchesName || matchesType || matchesNotes;
        }

        return true;
      })
      .sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [
    supabaseWeapons,
    equippedBaseNamesSet,
    activeApCategory,
    weaponDisciplineFilter,
    weaponTypeFilter,
    rightSearchQuery,
    getWeaponEvalResult,
    isItemStarred,
    localGenreFilter,
    isGsUnlocked,
  ]);

  return (
    <div className="bg-gradient-to-b from-rose-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-rose-500/90 p-4 flex flex-col gap-3 h-fit shadow-lg shadow-rose-950/20">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Weapon SK Manager"
          >
            <div className="p-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-300 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.25)] group-hover:scale-105 group-hover:border-rose-400 transition-all">
              <span className="text-base leading-none">⚔️</span>
            </div>
            <h3 className="font-outfit font-extrabold text-sm tracking-widest text-rose-200 uppercase group-hover:text-white transition-colors flex items-center gap-1.5">
              <span>Weapon SK</span>
              <ChevronDown className="w-3.5 h-3.5 text-rose-400/70 group-hover:text-rose-300 group-hover:translate-y-0.5 transition-all" />
            </h3>
          </button>
          <CardHelpButton ruleKey="weapons.basics" />
        </div>

        {/* Manage Weapons Action Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowManageModal(!showManageModal)}
            className={`p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group ${
              showManageModal
                ? 'bg-rose-600/30 text-rose-200 border-rose-400 shadow-rose-500/30'
                : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/30 text-rose-300 hover:text-white'
            }`}
            title="Open Weapon SK Manager"
          >
            <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
          </button>

          {/* Manage Weapons Master 2-Column Split-Pane Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Top Bar */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-300 flex items-center justify-center">
                      <span className="text-lg leading-none">⚔️</span>
                    </div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        Weapon SK Manager
                      </h3>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage character weapon proficiencies and combat skills side-by-side with stock catalog.
                      </p>
                    </div>
                  </div>

                  {/* KISS Top-Center Header Status Pill */}
                  <div className="px-3.5 py-1 bg-purple-950/70 border border-purple-500/40 rounded-full font-mono font-bold text-xs text-purple-200 flex items-center gap-2 shadow-md">
                    <span>
                      Skilled <strong className="text-purple-300">{skilledWeaponsCount}</strong>; Used{' '}
                      <strong className="text-rose-300">{weaponApSpent} AP</strong>; Available{' '}
                      <strong className="text-emerald-400">{availableAp} AP</strong>
                    </span>
                  </div>

                  <button
                    onClick={handleCloseManageModal}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 2-COLUMN SPLIT-PANE BODY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  
                  {/* --- LEFT COLUMN: EQUIPPED ARSENAL PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Swords className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-outfit font-bold uppercase tracking-wider text-rose-300">
                          Proficiencies
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                          {groupedEquippedWeapons.length}
                        </span>
                      </div>

                      {/* Arsenal Search Filter */}
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={leftSearchQuery}
                          onChange={(e) => setLeftSearchQuery(e.target.value)}
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-rose-500 w-24 sm:w-28"
                        />
                      </div>
                    </div>

                    {/* Scrollable Arsenal Items List */}
                    <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2.5 min-h-0">
                      {filteredGroupedEquippedWeapons.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                          <Swords className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                          {leftSearchQuery ? (
                            <span>No weapons matching "{leftSearchQuery}"</span>
                          ) : (
                            <span>No weapons equipped yet. Select from catalog on the right.</span>
                          )}
                        </div>
                      ) : (
                        filteredGroupedEquippedWeapons.map((group) => {
                          const isGroupSkilled = group.slots.some((s) => s.sk);
                          const groupCost = group.slots.reduce((max, s) => Math.max(max, s.ap_cost || 1), 1);
                          const rawTypesList = Array.from(
                            new Set(
                              group.slots.map((s) =>
                                s.mhs === 'H' ? 'Hurled' : s.mhs === 'S' ? 'Shot' : 'Melee'
                              )
                            )
                          );

                          return (
                            <div
                              key={group.baseName}
                              className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-rose-500/40 transition-all shrink-0"
                            >
                              {/* Card Header Row: Base Name, Type Badges, SINGLE - Drop Button */}
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-outfit font-bold text-sm inline-flex items-center align-baseline ${isGsUnlocked && isMsoEntry(group.baseName) ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                                    <span>{isGsUnlocked && isMsoEntry(group.baseName) ? `🌌 ${group.baseName}` : group.baseName}</span>
                                    <ItemNotesPopover notes={group.notes} itemName={group.baseName} inline />
                                  </span>
                                  {rawTypesList.map((t) => {
                                    const catKey = t.startsWith('H') ? 'H' : t.startsWith('S') ? 'S' : 'M';
                                    const badgeClass = MHS_COLORS[catKey]?.badge || MHS_COLORS.M.badge;
                                    return (
                                      <span
                                        key={t}
                                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeClass}`}
                                      >
                                        {t}
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Option A: KISS Micro Multi-Option Pill Switch SK [✓ | ✗] */}
                                  <div className="flex items-center gap-0.5 bg-slate-950/80 border border-slate-800/90 rounded-lg p-0.5 shadow-inner">
                                    <span className="text-[10px] font-mono font-extrabold text-slate-400 pl-1 pr-0.5 select-none">
                                      SK
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSkWeaponGroup(group.baseName, true)}
                                      className={`p-1 rounded transition-all cursor-pointer ${
                                        isGroupSkilled
                                          ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                          : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                      }`}
                                      title={isGroupSkilled ? 'Skilled' : `Click to mark Skilled (${groupCost} AP)`}
                                    >
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSkWeaponGroup(group.baseName, false)}
                                      className={`p-1 rounded transition-all cursor-pointer ${
                                        !isGroupSkilled
                                          ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                                          : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                      }`}
                                      title={!isGroupSkilled ? 'Unskilled' : `Click to mark Unskilled (Refund ${groupCost} AP)`}
                                    >
                                      <X className="w-3 h-3 stroke-[3]" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDropWeapon(group.baseName)}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                    title="Forget weapon proficiency"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Variant Sub-Rows */}
                              <div className="flex flex-col gap-1.5 pt-0.5">
                                {group.slots.map((item) => {
                                  const calculatedAtk = calculateWeaponAtk(item.name, item.mhs, attributeDice);
                                  const isSpecialDmg = item.dmg === '❌';
                                  const calculatedDmg = isSpecialDmg ? '❌' : String(calculateWeaponDmg(item.name, item.mhs, attributeDice));
                                  const variantLabel = item.name.includes('(')
                                    ? item.name.substring(item.name.indexOf('(') + 1, item.name.indexOf(')'))
                                    : item.mhs === 'H' ? 'Hurled' : item.mhs === 'S' ? 'Shot' : 'Melee';

                                  return (
                                    <div
                                      key={item.id}
                                      className="p-2 rounded-lg border bg-slate-950/60 border-slate-850 flex items-center justify-between text-xs font-mono"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-300 w-16">{variantLabel}:</span>
                                        {item.sk ? (
                                          <span className="text-[10px] font-sans font-bold text-emerald-400">Skilled</span>
                                        ) : (
                                          <span className="text-[10px] font-sans font-semibold text-amber-400">Unskilled</span>
                                        )}
                                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-slate-300 font-bold">
                                          {item.ap_cost || 1} AP
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                                        <span>Atk: <strong className="text-rose-300">{calculatedAtk}</strong></span>
                                        <span>•</span>
                                        <span>Dmg: <strong className={isSpecialDmg ? "text-rose-400 font-black text-xs" : "text-rose-300"} title={isSpecialDmg ? "Special Damage: Governed by loaded ammunition type from Equipment" : undefined}>{calculatedDmg}</strong></span>
                                        <span>•</span>
                                        <span>Blk💪: <strong className="text-amber-300">{item.max_blk === 'n/a' ? 'n/a' : getDieNum(attributeDice.might)}</strong></span>
                                        <span>•</span>
                                        <span>Blk Cap: <strong className="text-amber-300">{item.max_blk ?? 'n/a'}</strong></span>
                                      </div>
                                    </div>
                                  );
                                })}
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
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-rose-500'
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
                            weaponDisciplineFilter !== 'ALL' ? 'text-cyan-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                          }`}>
                            {weaponDisciplineFilter !== 'ALL' && <span className="text-[7px]">●</span>} Domain
                          </span>
                          <select
                            value={weaponDisciplineFilter}
                            onChange={(e) => setWeaponDisciplineFilter(e.target.value)}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                              weaponDisciplineFilter !== 'ALL'
                                ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-extrabold'
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-rose-500'
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

                        {/* 3. Filter (Types & Starred) */}
                        <div className="flex flex-col min-w-0">
                          <span className={`text-[9px] uppercase tracking-wider mb-0.5 px-0.5 truncate transition-colors ${
                            weaponTypeFilter !== 'ALL' ? 'text-yellow-400 font-black flex items-center gap-0.5' : 'text-slate-400 font-bold'
                          }`}>
                            {weaponTypeFilter !== 'ALL' && <span className="text-[7px]">●</span>} Filter
                          </span>
                          <select
                            value={weaponTypeFilter}
                            onChange={(e) => setWeaponTypeFilter(e.target.value)}
                            className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer truncate transition-all ${
                              weaponTypeFilter !== 'ALL'
                                ? 'bg-yellow-950/90 border-yellow-400 text-yellow-100 ring-1 ring-yellow-400/50 shadow-[0_0_12px_rgba(250,204,21,0.3)] font-extrabold'
                                : 'bg-slate-900 border-slate-700 text-slate-200 focus:border-rose-500'
                            }`}
                          >
                            <option value="ALL" className="bg-slate-900 text-slate-200">🌐 All</option>
                            <option value="STARRED" className="bg-slate-900 text-slate-200">⭐ Starred ({starredWeaponsCount})</option>
                            <option value="Unarmed" className="bg-slate-900 text-slate-200">🥊 Unarmed</option>
                            <option value="Hurled" className="bg-slate-900 text-slate-200">🪓 Hurled</option>
                            <option value="Melee" className="bg-slate-900 text-slate-200">🗡️ Melee</option>
                            <option value="Melee, Hurled" className="bg-slate-900 text-slate-200">⚔️ Melee, Hurled</option>
                            <option value="Melee, Shot" className="bg-slate-900 text-slate-200">🏹 Melee, Shot</option>
                            <option value="Shot" className="bg-slate-900 text-slate-200">🎯 Shot</option>
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
                            placeholder="Search weapons, types, notes..."
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500 w-full"
                          />
                        </div>
                        <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                          {filteredCatalogWeapons.length} {filteredCatalogWeapons.length === 1 ? 'item' : 'items'}
                        </div>
                      </div>

                      {/* Zero Matches Feedback & 1-Click Reset */}
                      {filteredCatalogWeapons.length === 0 && !isLoadingCatalog && (
                        <div className="p-3.5 bg-slate-950/60 rounded-xl border border-rose-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                          <span className="text-rose-300 font-semibold">
                            0 weapons match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                            {weaponDisciplineFilter !== 'ALL' ? ` • ${weaponDisciplineFilter}` : ''}
                            {weaponTypeFilter !== 'ALL' ? ` • ${weaponTypeFilter}` : ''}
                            {activeApCategory !== 'all' ? ` • ${activeApCategory}` : ''})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setLocalGenreFilter(activeGenre || 'SciFi');
                              setWeaponDisciplineFilter('ALL');
                              setWeaponTypeFilter('ALL');
                              setActiveApCategory('all');
                              setRightSearchQuery('');
                            }}
                            className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </div>
                      )}

                      {/* Scrollable Catalog List */}
                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                        {isLoadingCatalog ? (
                          <div className="h-full flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                            <span>Loading SupaFlex weapons catalog...</span>
                          </div>
                        ) : filteredCatalogWeapons.length > 0 ? (
                          filteredCatalogWeapons.map((weapon, idx) => {
                            const variants = splitWeaponIntoVariants(weapon);
                            const evalResult = getWeaponEvalResult(weapon);
                            const rawTypesList = (weapon.type || 'Melee').split(',').map((t) => t.trim());

                            return (
                              <div
                                key={weapon.id || idx}
                                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-rose-500/40 transition-all shrink-0"
                              >
                                {/* Card Header Row: Leading Star, Name, Type Badges, Cost, SINGLE + Equip Button */}
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStarItem(weapon)}
                                      className={`p-1 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                                        isItemStarred(weapon)
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-amber-300 hover:border-slate-700'
                                      }`}
                                      title={isItemStarred(weapon) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isItemStarred(weapon) ? 'fill-amber-400 text-amber-400' : ''}`} />
                                    </button>
                                    <span className={`font-bold text-sm inline-flex items-center align-baseline ${isGsUnlocked && isMsoEntry(weapon.name) ? 'text-purple-300 font-bold' : 'text-slate-100'}`}>
                                      <span>{isGsUnlocked && isMsoEntry(weapon.name) ? `🌌 ${weapon.name}` : weapon.name}</span>
                                      <ItemNotesPopover notes={weapon.notes} itemName={weapon.name} inline />
                                    </span>
                                    {rawTypesList.map((t) => {
                                      const catKey = t.startsWith('H') ? 'H' : t.startsWith('S') ? 'S' : 'M';
                                      const badgeClass = MHS_COLORS[catKey]?.badge || MHS_COLORS.M.badge;
                                      return (
                                        <span
                                          key={t}
                                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeClass}`}
                                        >
                                          {t}
                                        </span>
                                      );
                                    })}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => handleEquipWeapon(weapon, variants)}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                                        evalResult.apCost === 1
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 shadow-sm'
                                          : evalResult.apCost === 2
                                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50 shadow-sm'
                                          : evalResult.apCost === 3
                                          ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50 shadow-sm'
                                          : 'bg-rose-600/30 text-rose-200 border-rose-500/50 hover:bg-rose-600/50 shadow-sm'
                                      }`}
                                      title={`Learn ${weapon.name} for ${evalResult.apCost} AP${evalResult.requiresGmApproval ? ' (Requires GM Approval)' : ''}`}
                                    >
                                      + Learn ({evalResult.apCost} AP)
                                    </button>
                                  </div>
                                </div>

                                {/* Variant Stats Sub-Rows */}
                                <div className="flex flex-col gap-1.5 pt-0.5">
                                  {variants.map((v) => {
                                    const variantEval = evaluateItemAp(weapon.path, v.requirementStr, attributeDice, knownPaths, v.variantType);
                                    const calculatedAtk = calculateWeaponAtk(v.name, v.mhs, attributeDice);
                                    const isSpecialDmg = v.dmg === '❌' || weapon.dmg === '❌';
                                    const calculatedDmg = isSpecialDmg ? '❌' : String(calculateWeaponDmg(v.name, v.mhs, attributeDice));

                                    return (
                                      <div
                                        key={v.variantType}
                                        className={`p-2 rounded-lg border flex items-center justify-between text-xs font-mono transition-all ${
                                          variantEval.meetsReq
                                            ? 'bg-slate-900/80 border-slate-800'
                                            : 'bg-slate-950/40 border-slate-850 opacity-75'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-300 w-16">{v.variantType}:</span>
                                          <span>Req: <strong className="text-slate-200">{v.requirementStr}</strong></span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <span>Atk: <strong className="text-rose-200">{calculatedAtk}</strong></span>
                                          <span>•</span>
                                          <span>Dmg: <strong className={isSpecialDmg ? "text-rose-400 font-black text-xs" : "text-rose-300"} title={isSpecialDmg ? "Special Damage: Governed by loaded ammunition type from Equipment" : undefined}>{calculatedDmg}</strong></span>
                                          <span>•</span>
                                          <span>Blk: <strong className="text-amber-300">{v.max_block}</strong></span>
                                          {variantEval.meetsReq && (
                                            <span className="text-[10px] text-emerald-400 font-sans font-bold flex items-center gap-0.5 ml-1">
                                              Qualified
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic py-6 text-center">
                            No weapons match "{rightSearchQuery}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Status Bar with Standardized "Done" Button */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-outfit font-bold text-slate-300">⚔️ Weapon SK Manager</span>
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

      {/* Weapons Table View on Active Character Sheet */}
      {weapons.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-3 text-center">
          No weapons equipped. Click "Manage Weapons" above to add weapons to your arsenal.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-x-auto pb-1">
          <div className="min-w-[500px] flex flex-col gap-1.5">
            {/* Table Header Row */}
            <div className="grid grid-cols-[34px_68px_1fr_48px_48px_56px_60px] gap-2 items-center px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
              <span className="text-center">Sk</span>
              <span className="text-center">M/H/S</span>
              <span>Weapon Name</span>
              <span className="text-center">Atk</span>
              <span className="text-center">Dmg</span>
              <span className="text-center">Blk💪</span>
              <span className="text-center whitespace-nowrap">Blk Cap</span>
            </div>

          {/* Weapons Rows (Sorted Alphabetically with MSO Priority) */}
          {[...weapons]
            .sort((a, b) => compareMsoItems(a, b, isGsUnlocked))
            .map((item) => {
              const isMso = isMsoEntry(item.name);
              const calculatedAtk = calculateWeaponAtk(item.name, item.mhs, attributeDice);
              const isSpecialDmg = item.dmg === '❌';
              const calculatedDmg = isSpecialDmg ? '❌' : String(calculateWeaponDmg(item.name, item.mhs, attributeDice));
              const catKey = (item.mhs as string).startsWith('H') || (item.mhs as string) === 'Hurled'
                ? 'H'
                : (item.mhs as string).startsWith('S') || (item.mhs as string) === 'Shot'
                ? 'S'
                : 'M';
              const selectClass = MHS_COLORS[catKey]?.select || MHS_COLORS.M.select;

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[34px_68px_1fr_48px_48px_56px_60px] gap-2 items-center px-2 py-1.5 bg-slate-950/60 rounded-lg border border-slate-850 hover:border-slate-750 transition-all"
                >
                  {/* Read-Only Sk Indicator (Managed via Weapon SK Manager) */}
                  <div className="flex justify-center">
                    <div
                      className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-default select-none shrink-0 ${
                        item.sk
                          ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm'
                          : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md'
                      }`}
                      title={item.sk ? 'Skilled (Manage in Weapon SK Manager)' : 'Unskilled (Manage in Weapon SK Manager)'}
                    >
                      {item.sk ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                  </div>

                  {/* Color-Coded M/H/S Category Display Box (Read-Only) */}
                  <div
                    className={`text-xs font-bold px-1 py-1 rounded border text-center cursor-default transition-all ${selectClass}`}
                    title="Weapon category set via Manage Weapons modal"
                  >
                    {catKey === 'M' ? 'Melee' : catKey === 'H' ? 'Hurled' : 'Shot'}
                  </div>

                  {/* Weapon Name (Unboxed Clean Text) + Notes Popover */}
                  <div className="flex items-center min-w-0 pr-1">
                    <span
                      className={`text-xs inline-flex items-center align-baseline min-w-[100px] max-w-full ${isGsUnlocked && isMso ? 'text-purple-300 font-bold' : 'font-semibold text-slate-100'}`}
                      title={item.name}
                    >
                      <span className="truncate">{isGsUnlocked && isMso ? `🌌 ${item.name}` : item.name}</span>
                      {(() => {
                        const baseName = getBaseWeaponName(item.name);
                        const resolvedNotes = item.notes || supabaseWeapons.find((w) => w.name.toLowerCase() === baseName.toLowerCase())?.notes;
                        return <ItemNotesPopover notes={resolvedNotes} itemName={item.name} inline />;
                      })()}
                    </span>
                  </div>

                  {/* Atk Cell */}
                  <div
                    className="bg-slate-950 border border-slate-800 text-rose-200 text-xs font-mono font-extrabold text-center py-1 rounded"
                    title="Auto-updated from character attributes (-1d for Throw Object)"
                  >
                    {calculatedAtk}
                  </div>

                  {/* Dmg Cell */}
                  <div
                    className={`bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-center py-1 rounded flex items-center justify-center ${
                      isSpecialDmg ? 'text-rose-400 font-black text-xs' : 'text-rose-300'
                    }`}
                    title={
                      isSpecialDmg
                        ? 'Special Damage: Governed by loaded ammunition type from Equipment'
                        : 'Auto-updated from character attributes (-1d for Brawl / Unarmed / Improvised Weapon)'
                    }
                  >
                    {calculatedDmg}
                  </div>

                  {/* Blk💪 Cell */}
                  <div
                    className="bg-slate-950 border border-slate-800 text-amber-300 text-xs font-mono font-extrabold text-center py-1 rounded"
                    title="Auto-updated Block rating based on character Might"
                  >
                    {item.max_blk === 'n/a' ? 'n/a' : getDieNum(attributeDice.might)}
                  </div>

                  {/* Max Blk Read-Only Display Box */}
                  <div
                    className="bg-slate-950 border border-slate-800 text-amber-300 text-xs font-mono font-extrabold text-center py-1 rounded"
                    title="Auto-updated Block Cap based on equipped weapon"
                  >
                    {item.max_blk ?? 'n/a'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


