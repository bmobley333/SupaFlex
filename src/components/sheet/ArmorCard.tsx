// src/components/sheet/ArmorCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Check, Shirt, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import {
  ArmorData,
  MovementRateData,
  SupabaseArmor,
  getMrFromRequirement,
  getArFromRequirement,
  isRequirementLearnable,
} from '../../types/game';

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

const REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];

export const ArmorCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const armor: ArmorData = activeCharacter?.sheet_data?.armor_slot || {
    name: 'Studded Leather',
    block: 8,
    dodge: 8,
    ar: 6,
  };

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

  // Block ALWAYS equals Might rating, Dodge ALWAYS equals Motion rating
  const derivedBlock = getDieNum(attributeDice.might);
  const derivedDodge = getDieNum(attributeDice.motion);

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Catalog State
  const [armorCatalog, setArmorCatalog] = useState<SupabaseArmor[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Dyslexia-Friendly UI Toggle: Default set to "Learnable Only" (true)
  const [learnableOnly, setLearnableOnly] = useState<boolean>(true);

  // Custom Armor Creator Form State
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [newArmorName, setNewArmorName] = useState<string>('');
  const [newArmorReq, setNewArmorReq] = useState<string>('💪 4');
  const [newArmorCostVal, setNewArmorCostVal] = useState<number>(1);
  const [newArmorCostUnit, setNewArmorCostUnit] = useState<'g' | 's'>('g');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-calculated read-only AR and MR derived directly from Requirement
  const derivedArStr = getArFromRequirement(newArmorReq);
  const derivedMrStr = getMrFromRequirement(newArmorReq);

  // Fetch armor catalog from Supabase on modal opening
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getArmor()
        .then((data) => {
          setArmorCatalog(data);
        })
        .catch((err) => {
          console.error('Failed to load armor catalog:', err);
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

  const handleArmorUpdate = (updates: Partial<ArmorData>) => {
    updateActiveSheetData((prev) => {
      const updatedArmor = { ...(prev.armor_slot || armor), ...updates };
      const updatedAr = updates.ar !== undefined ? updates.ar : prev.armor;
      return {
        ...prev,
        armor_slot: updatedArmor,
        armor: updatedAr ?? prev.armor,
      };
    });
    saveActiveCharacter();
  };

  const handleMrUpdate = (updates: Partial<MovementRateData>) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      movement_rate: {
        ...(prev.movement_rate || mrData),
        ...updates,
      },
    }));
    saveActiveCharacter();
  };

  const handleEquipSupabaseArmor = (item: SupabaseArmor) => {
    const arMatch = item.ar ? item.ar.match(/\d+/) : null;
    const numericAr = arMatch ? parseInt(arMatch[0], 10) : 0;

    const mrMatch = item.mr ? item.mr.match(/\d+/) : null;
    const numericMr = mrMatch ? parseInt(mrMatch[0], 10) : 6;

    const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
    let newShieldMR: string | number = 'n/a';
    if (shieldSlot?.equipped) {
      const mrStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
      const match = mrStr.match(/-?\d+/);
      const penalty = match ? parseInt(match[0], 10) : 0;
      newShieldMR = Math.max(0, numericMr + penalty);
    }

    handleArmorUpdate({ name: item.name, ar: numericAr });
    handleMrUpdate({ armored: numericMr, shield: newShieldMR });
    setShowManageModal(false);
  };

  const handleCreateArmor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = newArmorName.trim();
    if (!trimmedName) {
      setFormError('Armor name is required.');
      return;
    }

    const costInt = Math.max(1, newArmorCostVal);
    const combinedCost = `${costInt}${newArmorCostUnit}`;

    setIsSubmitting(true);
    try {
      const created = await gameApi.createArmor({
        name: trimmedName,
        requirement: newArmorReq,
        ar: derivedArStr,
        mr: derivedMrStr,
        cost: combinedCost,
      });

      setArmorCatalog((prev) => [...prev, created]);
      handleEquipSupabaseArmor(created);

      setNewArmorName('');
      setNewArmorReq('💪 4');
      setNewArmorCostVal(1);
      setNewArmorCostUnit('g');
      setShowCreator(false);
    } catch (err: any) {
      console.error('Error creating custom armor:', err);
      setFormError(err.message || 'Failed to create custom armor in Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedArmor = armorCatalog.filter((item) => {
    if (learnableOnly) {
      return isRequirementLearnable(item.requirement, attributeDice);
    }
    return true;
  });

  const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
  const isShieldEquipped = shieldSlot?.equipped ?? false;
  let derivedShieldDrawn: string | number = 'n/a';
  if (isShieldEquipped) {
    const mrStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
    const match = mrStr.match(/-?\d+/);
    const penalty = match ? parseInt(match[0], 10) : 0;
    derivedShieldDrawn = Math.max(0, (mrData.armored ?? 6) + penalty);
  }

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-amber-300 uppercase flex items-center gap-2">
          <span className="text-base">🧥</span>
          Armor
        </h3>

        {/* Manage Armor Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
            }`}
            title="Manage equipped armor catalog"
          >
            <span className="font-outfit font-bold">Manage Armor</span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Manage Armor Floating Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-amber-400" />
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Manage Armor Catalog
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreator(!showCreator)}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showCreator ? 'Hide Creator' : 'Create Custom Armor'}
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
                  {/* Custom Armor Creator Form */}
                  {showCreator && (
                    <form
                      onSubmit={handleCreateArmor}
                      className="p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl flex flex-col gap-3 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          Create Custom Ad-Lib Armor
                        </span>
                        <span className="text-[10px] text-amber-400/70">Guardrails Enforced</span>
                      </div>

                      {/* Line 1: Name & Two-Cell Cost Inputs */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Name</span>
                          <input
                            type="text"
                            value={newArmorName}
                            onChange={(e) => setNewArmorName(e.target.value)}
                            placeholder="e.g. Dragonscale Mail"
                            className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 outline-none w-full focus:border-amber-400"
                            required
                          />
                        </div>
                        {/* Two-Cell Cost Input */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-slate-300">Cost</span>
                          <input
                            type="number"
                            min="1"
                            value={newArmorCostVal}
                            onChange={(e) => setNewArmorCostVal(parseInt(e.target.value, 10) || 1)}
                            className="bg-slate-950 text-slate-100 text-xs font-mono font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none w-14 text-center focus:border-amber-400"
                            required
                          />
                          <select
                            value={newArmorCostUnit}
                            onChange={(e) => setNewArmorCostUnit(e.target.value as 'g' | 's')}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="g">g (Gold 🪙)</option>
                            <option value="s">s (Silver 🥈)</option>
                          </select>
                        </div>
                      </div>

                      {/* Line 2: Requirement Select -> Read-Only AR & MR */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Req</span>
                          <select
                            value={newArmorReq}
                            onChange={(e) => setNewArmorReq(e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {REQ_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Read-Only AR Cell */}
                        <div
                          className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0"
                          title="Auto-filled read-only AR mapped from requirement"
                        >
                          <span className="text-[11px] font-bold text-slate-400">AR</span>
                          <span className="text-xs font-mono font-extrabold text-amber-300">{derivedArStr}</span>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase ml-1">(Auto)</span>
                        </div>

                        {/* Read-Only MR Cell */}
                        <div
                          className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0"
                          title="Auto-filled read-only MR mapped from requirement"
                        >
                          <span className="text-[11px] font-bold text-slate-400">MR</span>
                          <span className="text-xs font-mono font-extrabold text-teal-300">{derivedMrStr}</span>
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
                        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Plus className="w-4 h-4" />}
                        <span>Save & Equip Armor</span>
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
                        All Armor
                      </button>
                      <div
                        onClick={() => setLearnableOnly(!learnableOnly)}
                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors p-0.5 border border-slate-700 ${
                          learnableOnly ? 'bg-amber-600 border-amber-400' : 'bg-slate-800'
                        }`}
                        title="Toggle armor learnability filter"
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
                      <span>Armor Sets ({displayedArmor.length})</span>
                      {isLoadingCatalog && <Loader2 className="w-4 h-4 animate-spin text-amber-400" />}
                    </span>
                  </div>

                  {/* Catalog Cards List */}
                  <div className="flex flex-col gap-2">
                    {displayedArmor.map((item, idx) => {
                      const isEquipped = armor.name.toLowerCase() === item.name.toLowerCase();
                      const qualifies = isRequirementLearnable(item.requirement, attributeDice);

                      return (
                        <div
                          key={item.id || idx}
                          className={`p-3 bg-slate-950/60 rounded-xl border flex items-center justify-between transition-all ${
                            !qualifies ? 'border-slate-800/40 opacity-70' : 'border-slate-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-100">{item.name}</span>
                              {isEquipped && (
                                <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-mono">
                                  Equipped
                                </span>
                              )}
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-200 border border-slate-750">
                                {item.cost}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                              <span>Req: <strong className="text-slate-200">{item.requirement}</strong></span>
                              <span>•</span>
                              <span>AR: <strong className="text-amber-300">{item.ar}</strong></span>
                              <span>•</span>
                              <span>MR: <strong className="text-teal-300">{item.mr}</strong></span>
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

                          <button
                            onClick={() => handleEquipSupabaseArmor(item)}
                            disabled={isEquipped || !qualifies}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                              isEquipped
                                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-default'
                                : !qualifies
                                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                        </div>
                      );
                    })}

                    {!isLoadingCatalog && displayedArmor.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-500">
                        {learnableOnly
                          ? 'No learnable armor sets meet your current Might rating.'
                          : 'No armor sets found in Supabase catalog.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Armor Row 1: Name (Bounded max width to prevent stretching) */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-300 tracking-wide w-12 shrink-0">Name</span>
        <input
          type="text"
          value={armor.name}
          onChange={(e) => handleArmorUpdate({ name: e.target.value })}
          placeholder="Armor Name (e.g. Studded Leather)"
          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 outline-none w-full max-w-[240px] focus:border-amber-500"
        />
      </div>

      {/* Armor Row 2: Block 💪 (Might), Dodge 🏃 (Motion), AR 🧥 */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Block Cell (Auto-Updated from Might) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
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

        {/* Dodge Cell (Auto-Updated from Motion) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
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

        {/* AR Cell (Auto-Updated Read-Only Display Box) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">AR</span>
            <span className="text-sm">🧥</span>
          </div>
          <div
            className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
            title="Auto-updated matching equipped armor AR rating"
          >
            {armor.ar ?? 0}
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
          <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2 w-fit">
            <span className="text-[11px] font-bold text-slate-300">Armored 👣</span>
            <div
              className="w-9 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
              title="Auto-updated matching equipped armor Armored Movement Rate"
            >
              {mrData.armored ?? 6}
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
