// src/components/sheet/WeaponsCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, X, Check, Swords, Loader2, Search, Star } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import {
  WeaponSlot,
  SupabaseWeapon,
  WeaponVariantOption,
  splitWeaponIntoVariants,
  isWeaponVariantLearnable,
  calculateAvailableAp,
} from '../../types/game';

import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';

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

  if (cleanName.includes('improvised')) {
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

  if (cleanName.includes('brawl') || cleanName.includes('unarmed')) {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

export const WeaponsCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
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

  const handleWeaponChange = (id: string, updates: Partial<WeaponSlot>) => {
    updateActiveSheetData((prev) => {
      const updated = (prev.weapons || []).map((w) => (w.id === id ? { ...w, ...updates } : w));
      return { ...prev, updates: updated };
    });
    saveActiveCharacter();
  };

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

    return Array.from(map.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
  }, [weapons, supabaseWeapons]);

  // Skilled weapon groups (groups containing at least 1 slot with sk === true)
  const skilledWeaponGroups = useMemo(() => {
    return groupedEquippedWeapons.filter((g) => g.slots.some((s) => s.sk));
  }, [groupedEquippedWeapons]);

  const skilledWeaponsCount = skilledWeaponGroups.length;
  const weaponApSpent = skilledWeaponsCount * 1;
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  // Equip all variants of a weapon to the character sheet
  const handleEquipWeapon = (weapon: SupabaseWeapon, variantsToEquip: WeaponVariantOption[]) => {
    const newSlots: WeaponSlot[] = variantsToEquip.map((variant) => {
      const calculatedAtk = calculateWeaponAtk(variant.name, variant.mhs, attributeDice);
      const calculatedDmg = calculateWeaponDmg(variant.name, variant.mhs, attributeDice);
      const cleanBlockNum = variant.max_block ? variant.max_block.replace('🛡️', '') : 'n/a';
      const isLearnable = isWeaponVariantLearnable(variant, attributeDice);
      const slotName = weapon.type.includes(',') ? `${variant.name} (${variant.variantType})` : variant.name;

      return {
        id: `wep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: slotName,
        sk: isLearnable, // Skilled if learnable, Unskilled if requirements unmet
        mhs: variant.mhs,
        atk: String(calculatedAtk),
        dmg: String(calculatedDmg),
        max_blk: cleanBlockNum,
        effect: `${variant.variantType} Weapon (Req ${variant.requirementStr}, Cost ${variant.cost})`,
        notes: weapon.notes,
      };
    });

    const isEquippedAsSkilled = newSlots.some((s) => s.sk);

    updateActiveSheetData((prev) => {
      const existingNames = new Set((prev.weapons || []).map((w) => w.name.toLowerCase()));
      const filteredNewSlots = newSlots.filter((s) => !existingNames.has(s.name.toLowerCase()));
      if (filteredNewSlots.length > 0) {
        if (isEquippedAsSkilled) {
          recordApExpenditure(1, 'Weapons', `Learned Skilled Weapon: ${weapon.name} (1 AP)`, 1, 'Manage Weapons');
        } else {
          recordApExpenditure(0, 'Weapons', `Equipped Unskilled Weapon: ${weapon.name} (0 AP - Unskilled)`, 1, 'Manage Weapons');
        }
      }
      return {
        ...prev,
        weapons: [...(prev.weapons || []), ...filteredNewSlots].sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
    saveActiveCharacter();
  };

  // Un-equip all variants matching a base weapon name
  const handleDropWeapon = (baseWeaponName: string) => {
    const targetGroup = groupedEquippedWeapons.find(
      (g) => g.baseName.toLowerCase() === baseWeaponName.toLowerCase()
    );
    const wasSkilled = targetGroup ? targetGroup.slots.some((s) => s.sk) : false;

    updateActiveSheetData((prev) => ({
      ...prev,
      weapons: (prev.weapons || [])
        .filter((w) => getBaseWeaponName(w.name).toLowerCase() !== baseWeaponName.toLowerCase())
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));

    if (wasSkilled) {
      recordApExpenditure(-1, 'Weapons', `Unlearned Skilled Weapon: ${baseWeaponName} (-1 AP Refunded)`, 1, 'Manage Weapons');
    } else {
      recordApExpenditure(0, 'Weapons', `Dropped Unskilled Weapon: ${baseWeaponName} (0 AP)`, 1, 'Manage Weapons');
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

  const [skillFilterMode, setSkillFilterMode] = useState<'all' | 'skilled' | 'unskilled'>('skilled');
  const [weaponFilterCategory, setWeaponFilterCategory] = useState<
    'all' | 'starred' | 'melee' | 'hurled' | 'shot' | 'unarmed'
  >('all');

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
    return supabaseWeapons.filter((weapon) => {
      // 0. Global Genre Scope Filtering
      if (!matchesGenre(weapon.genres, activeGenre)) {
        return false;
      }

      // 1. Strict Deduplication: If already equipped in arsenal, filter out of Stock Catalog
      if (equippedBaseNamesSet.has(weapon.name.toLowerCase())) {
        return false;
      }

      const variants = splitWeaponIntoVariants(weapon);
      const qualifying = variants.filter((v) => isWeaponVariantLearnable(v, attributeDice));
      const isAnyLearnable = qualifying.length > 0;

      // 1.5. Skill Filter (All vs Skilled vs Unskilled)
      if (skillFilterMode === 'skilled' && !isAnyLearnable) {
        return false;
      }
      if (skillFilterMode === 'unskilled' && isAnyLearnable) {
        return false;
      }

      // 2. Category / Filter mode
      if (weaponFilterCategory === 'starred' && !isItemStarred(weapon)) {
        return false;
      }
      if (weaponFilterCategory === 'melee') {
        const t = (weapon.type || '').toLowerCase();
        const n = (weapon.name || '').toLowerCase();
        if (!t.includes('melee') && !n.includes('melee')) return false;
      }
      if (weaponFilterCategory === 'hurled') {
        const t = (weapon.type || '').toLowerCase();
        const n = (weapon.name || '').toLowerCase();
        if (!t.includes('hurled') && !n.includes('hurled')) return false;
      }
      if (weaponFilterCategory === 'shot') {
        const t = (weapon.type || '').toLowerCase();
        const n = (weapon.name || '').toLowerCase();
        if (!t.includes('shot') && !n.includes('shot')) return false;
      }
      if (weaponFilterCategory === 'unarmed') {
        const t = (weapon.type || '').toLowerCase();
        const n = (weapon.name || '').toLowerCase();
        const isUnarmedMatch = ['brawl', 'improvised', 'throw object', 'unarmed'].some(
          (k) => t.includes(k) || n.includes(k)
        );
        if (!isUnarmedMatch) return false;
      }

      // 3. Search filter
      if (rightSearchQuery.trim()) {
        const q = rightSearchQuery.toLowerCase().trim();
        const matchesName = weapon.name.toLowerCase().includes(q);
        const matchesType = (weapon.type || '').toLowerCase().includes(q);
        return matchesName || matchesType;
      }

      return true;
    });
  }, [supabaseWeapons, equippedBaseNamesSet, skillFilterMode, weaponFilterCategory, rightSearchQuery, attributeDice, isItemStarred, activeGenre]);

  return (
    <div className="bg-gradient-to-b from-rose-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-rose-500/90 p-4 flex flex-col gap-3 h-fit shadow-lg shadow-rose-950/20">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-300 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.25)]">
            <span className="text-base leading-none">⚔️</span>
          </div>
          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-rose-200 uppercase flex items-center gap-2">
            Weapons
          </h3>
          <CardHelpButton ruleKey="weapons.basics" />
        </div>

        {/* Manage Weapons Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-rose-600/30 text-rose-200 border-rose-400 shadow-rose-500/30'
                : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/30 text-rose-300'
            }`}
            title="Manage and equip weapons catalog"
          >
            <span className="font-outfit font-bold">Manage Weapons</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {weapons.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Manage Weapons Master 2-Column Split-Pane Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Top Bar */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-300 flex items-center justify-center">
                      <span className="text-lg leading-none">⚔️</span>
                    </div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        Weapons Manager
                      </h3>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage character weapons and arsenal side-by-side with stock catalog.
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
                          Equipped Arsenal
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
                                  <span className="font-outfit font-bold text-sm text-slate-100">{group.baseName}</span>
                                  <ItemNotesPopover notes={group.notes} itemName={group.baseName} />
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
                                    type="button"
                                    onClick={() => handleToggleStarItem({ name: group.baseName })}
                                    className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                      isItemStarred({ name: group.baseName })
                                        ? 'text-amber-400'
                                        : 'text-slate-600 hover:text-amber-400'
                                    }`}
                                    title={isItemStarred({ name: group.baseName }) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isItemStarred({ name: group.baseName }) ? 'fill-amber-400' : ''}`} />
                                  </button>
                                  <button
                                    onClick={() => handleDropWeapon(group.baseName)}
                                    className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg transition-all shrink-0 flex items-center gap-1"
                                    title="Drop Weapon Arsenal"
                                  >
                                    Forget
                                  </button>
                                </div>
                              </div>

                              {/* Variant Sub-Rows */}
                              <div className="flex flex-col gap-1.5 pt-0.5">
                                {group.slots.map((item) => {
                                  const calculatedAtk = calculateWeaponAtk(item.name, item.mhs, attributeDice);
                                  const calculatedDmg = calculateWeaponDmg(item.name, item.mhs, attributeDice);
                                  const variantLabel = item.name.includes('(')
                                    ? item.name.substring(item.name.indexOf('(') + 1, item.name.indexOf(')'))
                                    : item.mhs === 'H' ? 'Hurled' : item.mhs === 'S' ? 'Shot' : 'Melee';

                                  return (
                                    <div
                                      key={item.id}
                                      className="p-2 rounded-lg border bg-slate-950/60 border-slate-850 flex items-center justify-between text-xs font-mono"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-300 w-16">{variantLabel}:</span>
                                        {item.sk ? (
                                          <span className="text-[10px] font-sans font-bold text-emerald-400">Skilled</span>
                                        ) : (
                                          <span className="text-[10px] font-sans font-semibold text-amber-400">Unskilled</span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                                        <span>Atk: <strong className="text-rose-300">{calculatedAtk}</strong></span>
                                        <span>•</span>
                                        <span>Dmg: <strong className="text-rose-300">{calculatedDmg}</strong></span>
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
                    {/* Catalog Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0">
                      <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        🌐 Stock Catalog ({filteredCatalogWeapons.length})
                      </span>
                    </div>

                    {/* Stock Catalog Content */}
                    <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
                      {/* 1. KISS Multi-Option Pill Switch: All / Skilled / Unskilled */}
                      <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0">
                        <button
                          type="button"
                          onClick={() => setSkillFilterMode('all')}
                          className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            skillFilterMode === 'all'
                              ? 'bg-slate-800 text-slate-100 border border-slate-600 shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          🌐 All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkillFilterMode('skilled')}
                          className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            skillFilterMode === 'skilled'
                              ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          🎓 Skilled
                        </button>
                        <button
                          type="button"
                          onClick={() => setSkillFilterMode('unskilled')}
                          className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            skillFilterMode === 'unskilled'
                              ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          ⚪ Unskilled
                        </button>
                      </div>

                      {/* 2. Search & Category Filter Bar (Directly above card list) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={rightSearchQuery}
                            onChange={(e) => setRightSearchQuery(e.target.value)}
                            placeholder="Search weapons or type..."
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-rose-500 w-full"
                          />
                        </div>

                        <select
                          value={weaponFilterCategory}
                          onChange={(e) => setWeaponFilterCategory(e.target.value as any)}
                          className="bg-slate-900 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 outline-none focus:border-rose-500 max-w-[180px] truncate cursor-pointer"
                        >
                          <option value="all">🌐 All Weapons</option>
                          <option value="starred">⭐ Starred Favorites ({starredWeaponsCount})</option>
                          <option value="melee">🗡️ Melee</option>
                          <option value="hurled">🪓 Hurled</option>
                          <option value="shot">🏹 Shot</option>
                          <option value="unarmed">🥊 Unarmed</option>
                        </select>
                      </div>

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
                            const qualifyingVariants = variants.filter((v) => isWeaponVariantLearnable(v, attributeDice));
                            const isAnyLearnable = qualifyingVariants.length > 0;
                            const rawTypesList = (weapon.type || 'Melee').split(',').map((t) => t.trim());

                            return (
                              <div
                                key={weapon.id || idx}
                                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-rose-500/40 transition-all shrink-0"
                              >
                                {/* Card Header Row: Name, Type Badges, Cost, SINGLE + Equip Button */}
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-100">{weapon.name}</span>
                                    <ItemNotesPopover notes={weapon.notes} itemName={weapon.name} />
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
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-200 border border-slate-750">
                                      {weapon.cost}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleStarItem(weapon)}
                                      className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                        isItemStarred(weapon)
                                          ? 'text-amber-400'
                                          : 'text-slate-600 hover:text-amber-400'
                                      }`}
                                      title={isItemStarred(weapon) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${isItemStarred(weapon) ? 'fill-amber-400' : ''}`} />
                                    </button>
                                    <button
                                      onClick={() => handleEquipWeapon(weapon, variants)}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                        isAnyLearnable
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 shadow-sm'
                                          : 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50 shadow-sm'
                                      }`}
                                      title={isAnyLearnable ? 'Equip as Trained/Skilled' : 'Equip as Unskilled'}
                                    >
                                      + Learn
                                    </button>
                                  </div>
                                </div>

                                {/* Variant Stats Sub-Rows */}
                                <div className="flex flex-col gap-1.5 pt-0.5">
                                  {variants.map((v) => {
                                    const calculatedAtk = calculateWeaponAtk(v.name, v.mhs, attributeDice);
                                    const calculatedDmg = calculateWeaponDmg(v.name, v.mhs, attributeDice);
                                    const qualifies = isWeaponVariantLearnable(v, attributeDice);

                                    return (
                                      <div
                                        key={v.variantType}
                                        className={`p-2 rounded-lg border flex items-center justify-between text-xs font-mono transition-all ${
                                          qualifies
                                            ? 'bg-slate-900/80 border-slate-800'
                                            : 'bg-slate-950/40 border-slate-850 opacity-60'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-300 w-16">{v.variantType}:</span>
                                          <span>Req: <strong className="text-slate-200">{v.requirementStr}</strong></span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <span>Atk: <strong className="text-rose-200">{calculatedAtk}</strong></span>
                                          <span>•</span>
                                          <span>Dmg: <strong className="text-rose-300">{calculatedDmg}</strong></span>
                                          <span>•</span>
                                          <span>Blk: <strong className="text-amber-300">{v.max_block}</strong></span>
                                          {qualifies ? (
                                            <span className="text-[10px] text-emerald-400 font-sans font-bold flex items-center gap-0.5 ml-1">
                                              Qualified
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-amber-400/80 font-sans font-semibold ml-1">
                                              Unskilled Fallback
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
                    <span className="font-outfit font-bold text-slate-300">⚔️ Weapons Manager</span>
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

          {/* Weapons Rows (Sorted Alphabetically) */}
          {[...weapons]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => {
              const calculatedAtk = calculateWeaponAtk(item.name, item.mhs, attributeDice);
              const calculatedDmg = calculateWeaponDmg(item.name, item.mhs, attributeDice);
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
                  {/* Sk Checkbox / Red X Toggle */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => handleWeaponChange(item.id, { sk: !item.sk })}
                      className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-pointer shrink-0 ${
                        item.sk
                          ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm hover:bg-cyan-600/50'
                          : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md hover:bg-rose-900/90'
                      }`}
                      title={item.sk ? 'Skilled (Click to mark Unskilled)' : 'Unskilled (Click to mark Skilled)'}
                    >
                      {item.sk ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </button>
                  </div>

                  {/* Color-Coded M/H/S Category Display Box (Read-Only) */}
                  <div
                    className={`text-xs font-bold px-1 py-1 rounded border text-center cursor-default transition-all ${selectClass}`}
                    title="Weapon category set via Manage Weapons modal"
                  >
                    {catKey === 'M' ? 'Melee' : catKey === 'H' ? 'Hurled' : 'Shot'}
                  </div>

                  {/* Weapon Name (Unboxed Clean Text) + Notes Popover */}
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="font-semibold text-slate-100 text-xs truncate min-w-[100px]" title={item.name}>
                      {item.name}
                    </span>
                    {(() => {
                      const baseName = getBaseWeaponName(item.name);
                      const resolvedNotes = item.notes || supabaseWeapons.find((w) => w.name.toLowerCase() === baseName.toLowerCase())?.notes;
                      return <ItemNotesPopover notes={resolvedNotes} itemName={item.name} />;
                    })()}
                  </div>

                  {/* Atk Cell */}
                  <div
                    className="bg-slate-950 border border-slate-800 text-rose-200 text-xs font-mono font-extrabold text-center py-1 rounded"
                    title="Auto-updated from character attributes (-1d for Improvised Weapon)"
                  >
                    {calculatedAtk}
                  </div>

                  {/* Dmg Cell */}
                  <div
                    className="bg-slate-950 border border-slate-800 text-rose-300 text-xs font-mono font-extrabold text-center py-1 rounded"
                    title="Auto-updated from character attributes (-1d for Brawl / Unarmed)"
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


