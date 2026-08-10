// src/components/sheet/WeaponsCard.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plus, X, Check, Swords, AlertCircle, Loader2, Search, Globe } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { RuleTooltip } from '../common/RuleTooltip';
import {
  WeaponSlot,
  SupabaseWeapon,
  WeaponVariantOption,
  splitWeaponIntoVariants,
  isWeaponVariantLearnable,
  calculateAvailableAp,
} from '../../types/game';

import { CardHelpButton } from '../common/CardHelpButton';

const DIE_SCALE = [4, 6, 8, 10, 12];
const REQ_NUMBERS = [4, 6, 8, 10, 12];

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

  // Right Pane View Tab: 'CATALOG' or 'CREATOR'
  const [activeRightTab, setActiveRightTab] = useState<'CATALOG' | 'CREATOR'>('CATALOG');

  // Supabase Weapons Catalog State
  const [supabaseWeapons, setSupabaseWeapons] = useState<SupabaseWeapon[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Dyslexia-Friendly UI Toggle: Default set to "Learnable Only" (true)
  const [learnableOnly, setLearnableOnly] = useState<boolean>(true);

  // Custom Weapon Creator Form State
  const [customName, setCustomName] = useState<string>('');
  const [customTypeMode, setCustomTypeMode] = useState<'Melee' | 'Hurled' | 'Shot' | 'Melee, Hurled'>('Melee');
  const [customReqNum, setCustomReqNum] = useState<number>(4);
  const [customCostVal, setCustomCostVal] = useState<number>(1);
  const [customCostUnit, setCustomCostUnit] = useState<'g' | 's'>('g');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Derived Auto-Filled Read-Only Attributes for Custom Weapon Creation
  const getDerivedAtkDmg = (typeMode: string): string => {
    if (typeMode === 'Melee, Hurled') return '💪, 🏃';
    if (typeMode === 'Hurled') return '🏃';
    if (typeMode === 'Shot') return '👁️';
    return '💪';
  };

  const getDerivedMaxBlock = (typeMode: string, reqNum: number): string => {
    if (typeMode.includes('Melee')) {
      return `🛡️${reqNum * 2}`;
    }
    return 'n/a';
  };

  const derivedAtkDmg = getDerivedAtkDmg(customTypeMode);
  const derivedMaxBlock = getDerivedMaxBlock(customTypeMode, customReqNum);

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
    const map = new Map<string, { baseName: string; slots: WeaponSlot[] }>();

    weapons.forEach((slot) => {
      const baseName = getBaseWeaponName(slot.name);
      const key = baseName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { baseName, slots: [] });
      }
      map.get(key)!.slots.push(slot);
    });

    return Array.from(map.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
  }, [weapons]);

  // Skilled weapon groups (groups containing at least 1 slot with sk === true)
  const skilledWeaponGroups = useMemo(() => {
    return groupedEquippedWeapons.filter((g) => g.slots.some((s) => s.sk));
  }, [groupedEquippedWeapons]);

  const skilledWeaponsCount = skilledWeaponGroups.length;
  const weaponApSpent = Math.max(0, skilledWeaponsCount - 1);
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
      };
    });

    const isEquippedAsSkilled = newSlots.some((s) => s.sk);

    updateActiveSheetData((prev) => {
      const existingNames = new Set((prev.weapons || []).map((w) => w.name.toLowerCase()));
      const filteredNewSlots = newSlots.filter((s) => !existingNames.has(s.name.toLowerCase()));
      if (filteredNewSlots.length > 0) {
        if (isEquippedAsSkilled) {
          const currentSkilledCount = skilledWeaponsCount;
          if (currentSkilledCount === 0) {
            recordApExpenditure(0, 'Weapons', `Learned Skilled Weapon: ${weapon.name} (1st Free Weapon)`, 1, 'Manage Weapons');
          } else {
            recordApExpenditure(1, 'Weapons', `Learned Skilled Weapon: ${weapon.name} (1 AP)`, 1, 'Manage Weapons');
          }
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
      if (skilledWeaponsCount > 1) {
        recordApExpenditure(-1, 'Weapons', `Unlearned Skilled Weapon: ${baseWeaponName} (-1 AP Refunded)`, 1, 'Manage Weapons');
      } else {
        recordApExpenditure(0, 'Weapons', `Unlearned Skilled Weapon: ${baseWeaponName} (0 AP - Free Slot Freed)`, 1, 'Manage Weapons');
      }
    } else {
      recordApExpenditure(0, 'Weapons', `Dropped Unskilled Weapon: ${baseWeaponName} (0 AP)`, 1, 'Manage Weapons');
    }

    saveActiveCharacter();
  };

  const handleCreateCustomWeapon = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = customName.trim();
    if (!trimmedName) {
      setFormError('Weapon name is required.');
      return;
    }

    const costInt = Math.max(1, customCostVal);
    const combinedCost = `${costInt}${customCostUnit}`;

    let reqStr = `💪 ${customReqNum}`;
    if (customTypeMode === 'Hurled') reqStr = `🏃 ${customReqNum}`;
    if (customTypeMode === 'Shot') reqStr = `👁️ ${customReqNum}`;
    if (customTypeMode === 'Melee, Hurled') reqStr = `💪 ${customReqNum}, 🏃 ${customReqNum}`;

    setIsSubmitting(true);
    try {
      let created: SupabaseWeapon;
      try {
        created = await gameApi.createWeapon({
          name: trimmedName,
          type: customTypeMode,
          requirement: reqStr,
          atk: derivedAtkDmg,
          dmg: derivedAtkDmg,
          max_block: derivedMaxBlock,
          cost: combinedCost,
        });
      } catch (dbErr: any) {
        console.warn('[WeaponsCard] Remote catalog insert restricted by RLS; generating local custom item:', dbErr);
        created = {
          id: Date.now(),
          name: trimmedName,
          type: customTypeMode,
          requirement: reqStr,
          atk: derivedAtkDmg,
          dmg: derivedAtkDmg,
          max_block: derivedMaxBlock,
          cost: combinedCost,
          created_at: new Date().toISOString(),
        };
      }

      setSupabaseWeapons((prev) => [...prev, created]);

      // Equip all variants of newly created weapon
      const variants = splitWeaponIntoVariants(created);
      if (variants.length > 0) {
        handleEquipWeapon(created, variants);
      }

      setCustomName('');
      setCustomTypeMode('Melee');
      setCustomReqNum(4);
      setCustomCostVal(1);
      setCustomCostUnit('g');
      setActiveRightTab('CATALOG');
    } catch (err: any) {
      console.error('Error creating custom weapon:', err);
      setFormError(err.message || 'Failed to create custom weapon.');
    } finally {
      setIsSubmitting(false);
    }
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

  // Set of lowercase equipped base weapon names for strict deduplication
  const equippedBaseNamesSet = useMemo(() => {
    const set = new Set<string>();
    weapons.forEach((w) => {
      const base = getBaseWeaponName(w.name).toLowerCase();
      if (base) set.add(base);
    });
    return set;
  }, [weapons]);

  // Filter stock catalog weapons for Right Column pane (strict deduplication)
  const filteredCatalogWeapons = useMemo(() => {
    return supabaseWeapons.filter((weapon) => {
      // 1. Strict Deduplication: If already equipped in arsenal, filter out of Stock Catalog
      if (equippedBaseNamesSet.has(weapon.name.toLowerCase())) {
        return false;
      }

      const variants = splitWeaponIntoVariants(weapon);
      const qualifying = variants.filter((v) => isWeaponVariantLearnable(v, attributeDice));

      // 2. Learnable toggle filter
      if (learnableOnly && qualifying.length === 0) {
        return false;
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
  }, [supabaseWeapons, equippedBaseNamesSet, learnableOnly, rightSearchQuery, attributeDice]);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3 h-fit">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-rose-300 uppercase flex items-center gap-2">
            <span className="text-base">⚔️</span>
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
                      <strong className="text-rose-300">
                        {weaponApSpent}
                        {skilledWeaponsCount >= 1 ? '+1Free' : ''} AP
                      </strong>
                      ; Available <strong className="text-emerald-400">{availableAp} AP</strong>
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
                          placeholder="Search..."
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

                                <button
                                  onClick={() => handleDropWeapon(group.baseName)}
                                  className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg transition-all shrink-0 flex items-center gap-1"
                                  title="Drop Weapon Arsenal"
                                >
                                  - Drop
                                </button>
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
                                        <span><RuleTooltip ruleKey="col.weapons.dmg">Dmg</RuleTooltip>: <strong className="text-rose-300">{calculatedDmg}</strong></span>
                                        <span>•</span>
                                        <span><RuleTooltip ruleKey="col.shields.block">Blk💪</RuleTooltip>: <strong className="text-amber-300">{item.max_blk === 'n/a' ? 'n/a' : getDieNum(attributeDice.might)}</strong></span>
                                        <span>•</span>
                                        <span><RuleTooltip ruleKey="col.shields.block">Max Blk</RuleTooltip>: <strong className="text-amber-300">{item.max_blk ?? 'n/a'}</strong></span>
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

                  {/* --- RIGHT COLUMN: STOCK CATALOG & CUSTOM CREATOR PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Sub-Tab Selector Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800 w-full">
                        <button
                          onClick={() => setActiveRightTab('CATALOG')}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'CATALOG'
                              ? 'bg-rose-600/30 text-rose-200 border border-rose-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5 text-rose-400" />
                          Stock Catalog ({filteredCatalogWeapons.length})
                        </button>

                        <button
                          onClick={() => setActiveRightTab('CREATOR')}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'CREATOR'
                              ? 'bg-rose-600/30 text-rose-200 border border-rose-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 text-rose-400" />
                          Custom Creator
                        </button>
                      </div>
                    </div>

                    {/* TAB 1: STOCK CATALOG VIEW */}
                    {activeRightTab === 'CATALOG' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2 gap-2 overflow-hidden">
                        {/* Search Filter Bar & Dyslexia-Friendly Peg-Slider Toggle */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {/* Search Filter Bar */}
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search weapons catalog..."
                              value={rightSearchQuery}
                              onChange={(e) => setRightSearchQuery(e.target.value)}
                              className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-rose-500 w-full"
                            />
                          </div>

                          {/* Dyslexia-Friendly UI Peg-Slider Toggle */}
                          <div className="flex items-center justify-between bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                            <span className="text-[11px] font-bold text-slate-400">Filter Mode:</span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setLearnableOnly(false)}
                                className={`text-xs font-bold transition-all cursor-pointer select-none ${
                                  !learnableOnly ? 'text-amber-300 opacity-100 font-extrabold scale-105' : 'text-slate-400 opacity-50 hover:opacity-80'
                                }`}
                              >
                                All Weapons
                              </button>
                              <div
                                onClick={() => setLearnableOnly(!learnableOnly)}
                                className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors p-0.5 border border-slate-700 ${
                                  learnableOnly ? 'bg-amber-600 border-amber-400' : 'bg-slate-800'
                                }`}
                                title="Toggle weapon learnability filter"
                              >
                                <div
                                  className={`w-5 h-5 rounded-full bg-slate-100 shadow-md transform transition-transform ${
                                    learnableOnly ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setLearnableOnly(true)}
                                className={`text-xs font-bold transition-all cursor-pointer select-none ${
                                  learnableOnly ? 'text-amber-300 opacity-100 font-extrabold scale-105' : 'text-slate-400 opacity-50 hover:opacity-80'
                                }`}
                              >
                                Learnable Only
                              </button>
                            </div>
                          </div>
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

                                    <button
                                      onClick={() => handleEquipWeapon(weapon, variants)}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                        isAnyLearnable
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 shadow-sm'
                                          : 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50 shadow-sm'
                                      }`}
                                      title={isAnyLearnable ? 'Equip as Trained/Skilled' : 'Equip as Unskilled'}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      + Equip
                                    </button>
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
                    )}

                    {/* TAB 2: CUSTOM CREATOR VIEW */}
                    {activeRightTab === 'CREATOR' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-y-auto">
                        <form
                          onSubmit={handleCreateCustomWeapon}
                          className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5" />
                              Create Custom Weapon
                            </span>
                            <span className="text-[10px] text-rose-400/70 font-mono">Guardrails Active</span>
                          </div>

                          {/* Line 1: Name & Two-Cell Cost Inputs */}
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-300">Weapon Name</span>
                              <input
                                type="text"
                                placeholder="e.g. Sunfire Glaive"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 outline-none w-full focus:border-rose-400"
                                required
                              />
                            </div>

                            {/* Two-Cell Cost Input */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-300 shrink-0">Cost:</span>
                              <input
                                type="number"
                                min="1"
                                value={customCostVal}
                                onChange={(e) => setCustomCostVal(parseInt(e.target.value, 10) || 1)}
                                className="bg-slate-950 text-slate-100 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none w-16 text-center focus:border-rose-400"
                                required
                              />
                              <select
                                value={customCostUnit}
                                onChange={(e) => setCustomCostUnit(e.target.value as 'g' | 's')}
                                className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                              >
                                <option value="g">g (Gold 🪙)</option>
                                <option value="s">s (Silver 🥈)</option>
                              </select>
                            </div>
                          </div>

                          {/* Line 2: Type Mode Select & Req Number Select */}
                          <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-300">Type Category</span>
                              <select
                                value={customTypeMode}
                                onChange={(e) => setCustomTypeMode(e.target.value as 'Melee' | 'Hurled' | 'Shot' | 'Melee, Hurled')}
                                className="bg-slate-950 border border-slate-700 text-rose-300 text-xs font-semibold px-2 py-1 rounded-lg outline-none focus:border-rose-400 cursor-pointer"
                              >
                                <option value="Melee">Melee (Might 💪)</option>
                                <option value="Hurled">Hurled (Motion 🏃)</option>
                                <option value="Shot">Shot (Mind 👁️)</option>
                                <option value="Melee, Hurled">Melee & Hurled (💪 & 🏃)</option>
                              </select>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-300">Req Rating #</span>
                              <select
                                value={customReqNum}
                                onChange={(e) => setCustomReqNum(parseInt(e.target.value, 10))}
                                className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                              >
                                {REQ_NUMBERS.map((num) => (
                                  <option key={num} value={num}>
                                    {num}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Line 3: Read-Only Calculated Cells */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400">Atk/Dmg:</span>
                              <span className="text-xs font-mono font-extrabold text-rose-300">{derivedAtkDmg}</span>
                            </div>

                            <div className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400">Max Blk:</span>
                              <span className="text-xs font-mono font-extrabold text-amber-300">{derivedMaxBlock}</span>
                            </div>
                          </div>

                          {/* Form Error Message */}
                          {formError && (
                            <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                              <span>{formError}</span>
                            </div>
                          )}

                          {/* Submit Button */}
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full mt-1 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4" />}
                            <span>Save & Equip Custom Weapon</span>
                          </button>
                        </form>
                      </div>
                    )}
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
              <span><RuleTooltip ruleKey="col.weapons.atr">Weapon Name</RuleTooltip></span>
              <span className="text-center"><RuleTooltip ruleKey="col.weapons.atr">Atk</RuleTooltip></span>
              <span className="text-center"><RuleTooltip ruleKey="col.weapons.dmg">Dmg</RuleTooltip></span>
              <span className="text-center"><RuleTooltip ruleKey="col.shields.block">Blk💪</RuleTooltip></span>
              <span className="text-center whitespace-nowrap"><RuleTooltip ruleKey="col.shields.block">Max Blk</RuleTooltip></span>
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

                  {/* Weapon Name Input (Read-Only) */}
                  <input
                    type="text"
                    value={item.name}
                    readOnly
                    className="bg-slate-900 text-slate-100 text-xs font-semibold px-2 py-1 rounded border border-slate-800 outline-none w-full min-w-[120px] max-w-[240px] cursor-default truncate"
                    title="Weapon name set via Manage Weapons modal"
                  />

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
                    title="Auto-updated Max Block based on equipped weapon"
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


