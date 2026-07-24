// src/components/sheet/WeaponsCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Minus, X, Swords, AlertCircle, Loader2, Check } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import {
  WeaponSlot,
  SupabaseWeapon,
  WeaponVariantOption,
  splitWeaponIntoVariants,
  isWeaponVariantLearnable,
} from '../../types/game';

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
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const weapons: WeaponSlot[] = activeCharacter?.sheet_data?.weapons || [];
  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Supabase Weapons Catalog State
  const [supabaseWeapons, setSupabaseWeapons] = useState<SupabaseWeapon[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Dyslexia-Friendly UI Toggle: Default set to "Learnable Only" (true)
  const [learnableOnly, setLearnableOnly] = useState<boolean>(true);

  // Custom Weapon Creator Form State
  const [showCreator, setShowCreator] = useState<boolean>(false);
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

  const handleWeaponChange = (id: string, updates: Partial<WeaponSlot>) => {
    updateActiveSheetData((prev) => {
      const updated = (prev.weapons || []).map((w) => (w.id === id ? { ...w, ...updates } : w));
      return { ...prev, weapons: updated };
    });
    saveActiveCharacter();
  };

  // Equip all qualifying variants for a weapon
  const handleEquipWeapon = (weapon: SupabaseWeapon, qualifyingVariants: WeaponVariantOption[]) => {
    const newSlots: WeaponSlot[] = qualifyingVariants.map((variant) => {
      const calculatedAtk = calculateWeaponAtk(variant.name, variant.mhs, attributeDice);
      const calculatedDmg = calculateWeaponDmg(variant.name, variant.mhs, attributeDice);
      const cleanBlockNum = variant.max_block ? variant.max_block.replace('🛡️', '') : 'n/a';

      return {
        id: `wep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: weapon.type.includes(',') ? `${variant.name} (${variant.variantType})` : variant.name,
        sk: true,
        mhs: variant.mhs,
        atk: String(calculatedAtk),
        dmg: String(calculatedDmg),
        max_blk: cleanBlockNum,
        effect: `${variant.variantType} Weapon (Req ${variant.requirementStr}, Cost ${variant.cost})`,
      };
    });

    updateActiveSheetData((prev) => ({
      ...prev,
      weapons: [...(prev.weapons || []), ...newSlots].sort((a, b) => a.name.localeCompare(b.name)),
    }));
    saveActiveCharacter();
  };

  // Un-equip all variants of a weapon
  const handleDropWeapon = (weaponName: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      weapons: (prev.weapons || [])
        .filter((w) => !w.name.toLowerCase().startsWith(weaponName.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
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
      const created = await gameApi.createWeapon({
        name: trimmedName,
        type: customTypeMode,
        requirement: reqStr,
        atk: derivedAtkDmg,
        dmg: derivedAtkDmg,
        max_block: derivedMaxBlock,
        cost: combinedCost,
      });

      setSupabaseWeapons((prev) => [...prev, created]);

      // Equip qualifying variants
      const variants = splitWeaponIntoVariants(created);
      const qualifying = variants.filter((v) => isWeaponVariantLearnable(v, attributeDice));
      if (qualifying.length > 0) {
        handleEquipWeapon(created, qualifying);
      }

      setCustomName('');
      setCustomTypeMode('Melee');
      setCustomReqNum(4);
      setCustomCostVal(1);
      setCustomCostUnit('g');
      setShowCreator(false);
    } catch (err: any) {
      console.error('Error creating custom weapon:', err);
      setFormError(err.message || 'Failed to create custom weapon in Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter weapons list for display
  const displayedWeapons = supabaseWeapons.filter((weapon) => {
    const variants = splitWeaponIntoVariants(weapon);
    const qualifying = variants.filter((v) => isWeaponVariantLearnable(v, attributeDice));
    if (learnableOnly) {
      return qualifying.length > 0;
    }
    return true;
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3 h-fit">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-rose-300 uppercase flex items-center gap-2">
          <span className="text-base">⚔️</span>
          Weapons
        </h3>

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

          {/* Manage Weapons Floating Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-rose-400" />
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Manage Weapons Catalog
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreator(!showCreator)}
                      className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/40 flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showCreator ? 'Hide Creator' : 'Create Custom Weapon'}
                    </button>
                    <button
                      onClick={() => setShowManageModal(false)}
                      className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Modal Scrollable Content */}
                <div className="p-4 overflow-y-auto flex flex-col gap-4">
                  {/* Custom Weapon Creator Form */}
                  {showCreator && (
                    <form
                      onSubmit={handleCreateCustomWeapon}
                      className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl flex flex-col gap-3 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          Create Custom Ad-Lib Weapon
                        </span>
                        <span className="text-[10px] text-rose-400/70">Guardrails Enforced</span>
                      </div>

                      {/* Line 1: Name & Two-Cell Cost Inputs */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Name</span>
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-slate-300">Cost</span>
                          <input
                            type="number"
                            min="1"
                            value={customCostVal}
                            onChange={(e) => setCustomCostVal(parseInt(e.target.value, 10) || 1)}
                            className="bg-slate-950 text-slate-100 text-xs font-mono font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none w-14 text-center focus:border-rose-400"
                            required
                          />
                          <select
                            value={customCostUnit}
                            onChange={(e) => setCustomCostUnit(e.target.value as 'g' | 's')}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="g">g (Gold 🪙)</option>
                            <option value="s">s (Silver 🥈)</option>
                          </select>
                        </div>
                      </div>

                      {/* Line 2: Type Mode Select & Req Number Select */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Type</span>
                          <select
                            value={customTypeMode}
                            onChange={(e) => setCustomTypeMode(e.target.value as any)}
                            className="bg-slate-950 border border-slate-700 text-rose-300 text-xs font-semibold px-2 py-1.5 rounded-lg outline-none focus:border-rose-400 cursor-pointer"
                          >
                            <option value="Melee">Melee (Might 💪)</option>
                            <option value="Hurled">Hurled (Motion 🏃)</option>
                            <option value="Shot">Shot (Mind 👁️)</option>
                            <option value="Melee, Hurled">Melee & Hurled (💪 & 🏃)</option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Req #</span>
                          <select
                            value={customReqNum}
                            onChange={(e) => setCustomReqNum(parseInt(e.target.value, 10))}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {REQ_NUMBERS.map((num) => (
                              <option key={num} value={num}>
                                {num}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Read-Only Atk / Dmg Cell */}
                        <div
                          className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0"
                          title="Auto-filled read-only Atk & Dmg matching type emoji"
                        >
                          <span className="text-[11px] font-bold text-slate-400">Atk/Dmg</span>
                          <span className="text-xs font-mono font-extrabold text-rose-300">{derivedAtkDmg}</span>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase ml-1">(Auto)</span>
                        </div>

                        {/* Read-Only Max Block Cell */}
                        <div
                          className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0"
                          title="Auto-filled read-only Max Block (2x Requirement # for Melee)"
                        >
                          <span className="text-[11px] font-bold text-slate-400">Max Blk</span>
                          <span className="text-xs font-mono font-extrabold text-amber-300">{derivedMaxBlock}</span>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase ml-1">(Auto)</span>
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
                        className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4" />}
                        <span>Save & Equip Custom Weapon</span>
                      </button>
                    </form>
                  )}

                  {/* Catalog Utility Row: Dyslexia-Friendly Peg-Slider Toggle & Count */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                    {/* Dyslexia-Friendly UI Peg-Slider Toggle */}
                    <div className="flex items-center gap-3 bg-slate-950/80 px-3.5 py-2 rounded-xl border border-slate-800 shadow-inner">
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

                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <span>Weapons ({displayedWeapons.length})</span>
                      {isLoadingCatalog && <Loader2 className="w-4 h-4 animate-spin text-rose-400" />}
                    </span>
                  </div>

                  {/* Catalog Cards List (1 Card Per Full-Width Row) */}
                  <div className="flex flex-col gap-2.5">
                    {displayedWeapons.map((weapon, idx) => {
                      const variants = splitWeaponIntoVariants(weapon);
                      const qualifyingVariants = variants.filter((v) => isWeaponVariantLearnable(v, attributeDice));

                      const isAnyEquipped = weapons.some((w) =>
                        w.name.toLowerCase().startsWith(weapon.name.toLowerCase())
                      );

                      const rawTypesList = (weapon.type || 'Melee').split(',').map((t) => t.trim());

                      return (
                        <div
                          key={weapon.id || idx}
                          className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-rose-500/40 transition-all"
                        >
                          {/* Card Header Row: Name, Type Badges, Cost, Equip/Drop Button */}
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

                            {isAnyEquipped ? (
                              <button
                                onClick={() => handleDropWeapon(weapon.name)}
                                className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/40 flex items-center gap-1 transition-all shrink-0"
                              >
                                <Minus className="w-3.5 h-3.5" />
                                - Drop
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEquipWeapon(weapon, qualifyingVariants)}
                                disabled={qualifyingVariants.length === 0}
                                className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/40 disabled:opacity-40 flex items-center gap-1 transition-all shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                + Equip
                              </button>
                            )}
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
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        Qualified
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-rose-400/80 font-sans font-semibold ml-1">
                                        Req Unmet
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {!isLoadingCatalog && displayedWeapons.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-500">
                        {learnableOnly
                          ? 'No learnable weapons meet your current attribute ratings.'
                          : 'No weapons found in Supabase catalog.'}
                      </div>
                    )}
                  </div>
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
        <div className="flex flex-col gap-1.5 overflow-x-auto">
          {/* Table Header Row */}
          <div className="grid grid-cols-[36px_92px_1fr_54px_54px_68px] gap-2 items-center px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
            <span className="text-center">Sk</span>
            <span className="text-center">M/H/S</span>
            <span>Weapon Name</span>
            <span className="text-center">Atk</span>
            <span className="text-center">Dmg</span>
            <span className="text-center">Max Blk</span>
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
                  className="grid grid-cols-[36px_92px_1fr_54px_54px_68px] gap-2 items-center px-2 py-1.5 bg-slate-950/60 rounded-lg border border-slate-850 hover:border-slate-750 transition-all"
                >
                  {/* Sk Checkbox */}
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={item.sk}
                      onChange={(e) => handleWeaponChange(item.id, { sk: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20 bg-slate-900 cursor-pointer"
                      title="Trained / Skill Check"
                    />
                  </div>

                  {/* Color-Coded M/H/S Full-Name Dropdown */}
                  <select
                    value={catKey}
                    onChange={(e) => handleWeaponChange(item.id, { mhs: e.target.value as 'M' | 'H' | 'S' })}
                    className={`text-xs font-bold px-1 py-1 rounded border outline-none text-center cursor-pointer transition-all ${selectClass}`}
                  >
                    <option value="M" className="bg-slate-900 text-rose-300">Melee</option>
                    <option value="H" className="bg-slate-900 text-emerald-300">Hurled</option>
                    <option value="S" className="bg-slate-900 text-amber-300">Shot</option>
                  </select>

                  {/* Weapon Name Input */}
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleWeaponChange(item.id, { name: e.target.value })}
                    className="bg-slate-900 text-slate-100 text-xs font-semibold px-2 py-1 rounded border border-slate-800 outline-none focus:border-rose-500 w-full max-w-[240px]"
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
      )}
    </div>
  );
};
