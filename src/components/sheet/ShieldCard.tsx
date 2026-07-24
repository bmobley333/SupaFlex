// src/components/sheet/ShieldCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, ShieldAlert, Plus, Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import {
  ShieldData,
  SupabaseShield,
  getShieldMrFromRequirement,
  getShieldMaxBlockFromRequirement,
  isRequirementLearnable,
} from '../../types/game';

const REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];

export const ShieldCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const shield: ShieldData = activeCharacter?.sheet_data?.shield_slot || {
    equipped: false,
    name: 'Round Shield',
    sk: true,
    max_block: 12,
  };

  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Catalog State
  const [shieldCatalog, setShieldCatalog] = useState<SupabaseShield[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);

  // Dyslexia-Friendly UI Toggle: Default set to "Learnable Only" (true)
  const [learnableOnly, setLearnableOnly] = useState<boolean>(true);

  // Custom Shield Creator Form State
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [newShieldName, setNewShieldName] = useState<string>('');
  const [newShieldReq, setNewShieldReq] = useState<string>('💪 4');
  const [newShieldCostVal, setNewShieldCostVal] = useState<number>(1);
  const [newShieldCostUnit, setNewShieldCostUnit] = useState<'g' | 's'>('g');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Derived Auto-Filled Read-Only Attributes for Custom Shield Creation
  const derivedMaxBlockStr = getShieldMaxBlockFromRequirement(newShieldReq);
  const derivedMrStr = getShieldMrFromRequirement(newShieldReq);

  // Fetch shields catalog from Supabase on modal opening
  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getShields()
        .then((data) => {
          setShieldCatalog(data);
        })
        .catch((err) => {
          console.error('Failed to load shields catalog:', err);
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

  const handleShieldUpdate = (updates: Partial<ShieldData>) => {
    updateActiveSheetData((prev) => {
      const updatedShield = { ...(prev.shield_slot || shield), ...updates };
      return {
        ...prev,
        shield_slot: updatedShield,
      };
    });
    saveActiveCharacter();
  };

  const handleMrUpdate = (mrShieldVal: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      movement_rate: {
        ...(prev.movement_rate || { armored: 6, shield: 'n/a' }),
        shield: mrShieldVal,
      },
    }));
    saveActiveCharacter();
  };

  const handleEquipSupabaseShield = (item: SupabaseShield) => {
    const blockMatch = item.max_block ? item.max_block.match(/\d+/) : null;
    const numericBlock = blockMatch ? parseInt(blockMatch[0], 10) : 12;

    handleShieldUpdate({
      name: item.name,
      sk: true,
      max_block: numericBlock,
      equipped: true,
      effect: item.description || `Shield (Req ${item.requirement}, Cost ${item.cost})`,
    });
    handleMrUpdate(item.mr || '👣0');
    setShowManageModal(false);
  };

  const handleUnequipShield = () => {
    handleShieldUpdate({ equipped: false });
    handleMrUpdate('n/a');
    setShowManageModal(false);
  };

  const handleCreateShield = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = newShieldName.trim();
    if (!trimmedName) {
      setFormError('Shield name is required.');
      return;
    }

    const costInt = Math.max(1, newShieldCostVal);
    const combinedCost = `${costInt}${newShieldCostUnit}`;

    setIsSubmitting(true);
    try {
      const created = await gameApi.createShield({
        name: trimmedName,
        requirement: newShieldReq,
        max_block: derivedMaxBlockStr,
        mr: derivedMrStr,
        cost: combinedCost,
      });

      setShieldCatalog((prev) => [...prev, created]);
      handleEquipSupabaseShield(created);

      setNewShieldName('');
      setNewShieldReq('💪 4');
      setNewShieldCostVal(1);
      setNewShieldCostUnit('g');
      setShowCreator(false);
    } catch (err: any) {
      console.error('Error creating custom shield:', err);
      setFormError(err.message || 'Failed to create custom shield in Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedShields = shieldCatalog.filter((item) => {
    if (learnableOnly) {
      return isRequirementLearnable(item.requirement, attributeDice);
    }
    return true;
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3 transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-cyan-300 uppercase flex items-center gap-2">
            <span className="text-base">🛡️</span>
            Shield
          </h3>
          {!shield.equipped && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded-full border border-slate-800">
              No Shield Equipped
            </span>
          )}
        </div>

        {/* Manage Shields Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
                : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
            }`}
            title="Manage equipped shield catalog"
          >
            <span className="font-outfit font-bold">Manage Shields</span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Manage Shields Floating Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Manage Shields Catalog
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCreator(!showCreator)}
                      className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-bold rounded-lg border border-cyan-500/40 flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {showCreator ? 'Hide Creator' : 'Create Custom Shield'}
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
                  {/* Active Unequip Action if equipped */}
                  {shield.equipped && (
                    <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛡️</span>
                        <div>
                          <span className="font-bold text-xs text-slate-100 block">{shield.name}</span>
                          <span className="text-[11px] text-cyan-300 font-mono">Currently Equipped (Max Blk: {shield.max_block})</span>
                        </div>
                      </div>
                      <button
                        onClick={handleUnequipShield}
                        className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/40 flex items-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Unequip Shield
                      </button>
                    </div>
                  )}

                  {/* Custom Shield Creator Form */}
                  {showCreator && (
                    <form
                      onSubmit={handleCreateShield}
                      className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl flex flex-col gap-3 animate-fadeIn"
                    >
                      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          Create Custom Ad-Lib Shield
                        </span>
                        <span className="text-[10px] text-cyan-400/70">Guardrails Enforced</span>
                      </div>

                      {/* Line 1: Name & Two-Cell Cost Inputs */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Name</span>
                          <input
                            type="text"
                            value={newShieldName}
                            onChange={(e) => setNewShieldName(e.target.value)}
                            placeholder="e.g. Runed Aegis"
                            className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 outline-none w-full focus:border-cyan-400"
                            required
                          />
                        </div>
                        {/* Two-Cell Cost Input */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-slate-300">Cost</span>
                          <input
                            type="number"
                            min="1"
                            value={newShieldCostVal}
                            onChange={(e) => setNewShieldCostVal(parseInt(e.target.value, 10) || 1)}
                            className="bg-slate-950 text-slate-100 text-xs font-mono font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none w-14 text-center focus:border-cyan-400"
                            required
                          />
                          <select
                            value={newShieldCostUnit}
                            onChange={(e) => setNewShieldCostUnit(e.target.value as 'g' | 's')}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="g">g (Gold 🪙)</option>
                            <option value="s">s (Silver 🥈)</option>
                          </select>
                        </div>
                      </div>

                      {/* Line 2: Requirement Select -> Read-Only Max Block & MR */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300 shrink-0">Req</span>
                          <select
                            value={newShieldReq}
                            onChange={(e) => setNewShieldReq(e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {REQ_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Read-Only Max Block Cell */}
                        <div
                          className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0"
                          title="Auto-filled read-only Max Block mapped from requirement"
                        >
                          <span className="text-[11px] font-bold text-slate-400">Max Blk</span>
                          <span className="text-xs font-mono font-extrabold text-cyan-300">{derivedMaxBlockStr}</span>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase ml-1">(Auto)</span>
                        </div>

                        {/* Read-Only MR Drawn Adjustment Cell */}
                        <div
                          className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5 shrink-0"
                          title="Auto-filled read-only Movement Rate Drawn adjustment mapped from requirement"
                        >
                          <span className="text-[11px] font-bold text-slate-400">MR Drawn</span>
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
                        className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4" />}
                        <span>Save & Equip Shield</span>
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
                        All Shields
                      </button>
                      <div
                        onClick={() => setLearnableOnly(!learnableOnly)}
                        className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors p-0.5 border border-slate-700 ${
                          learnableOnly ? 'bg-amber-600 border-amber-400' : 'bg-slate-800'
                        }`}
                        title="Toggle shield learnability filter"
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
                      <span>Shields ({displayedShields.length})</span>
                      {isLoadingCatalog && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
                    </span>
                  </div>

                  {/* Catalog Cards List */}
                  <div className="flex flex-col gap-2">
                    {displayedShields.map((item, idx) => {
                      const isEquipped = shield.equipped && shield.name.toLowerCase() === item.name.toLowerCase();
                      const qualifies = isRequirementLearnable(item.requirement, attributeDice);

                      return (
                        <div
                          key={item.id || idx}
                          className={`p-3 bg-slate-950/60 rounded-xl border flex items-center justify-between transition-all ${
                            !qualifies ? 'border-slate-800/40 opacity-70' : 'border-slate-800 hover:border-cyan-500/40'
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-100">{item.name}</span>
                              {isEquipped && (
                                <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded font-mono">
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
                              <span>Max Blk: <strong className="text-cyan-300">{item.max_block}</strong></span>
                              <span>•</span>
                              <span>MR Drawn: <strong className="text-teal-300">{item.mr}</strong></span>
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
                            onClick={() => handleEquipSupabaseShield(item)}
                            disabled={isEquipped || !qualifies}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                              isEquipped
                                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-default'
                                : !qualifies
                                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border-cyan-500/40'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isEquipped ? 'Equipped' : 'Equip'}
                          </button>
                        </div>
                      );
                    })}

                    {!isLoadingCatalog && displayedShields.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-500">
                        {learnableOnly
                          ? 'No learnable shields meet your current Might rating.'
                          : 'No shields found in Supabase catalog.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single-Row Shield Controls (Visible when equipped) */}
      {shield.equipped && (
        <div className="flex items-center gap-3 pt-1 animate-fadeIn">
          {/* Sk Label + Checkbox */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label htmlFor="shield-sk" className="text-xs font-bold text-slate-300 cursor-pointer">
              Sk
            </label>
            <input
              type="checkbox"
              checked={shield.sk}
              onChange={(e) => handleShieldUpdate({ sk: e.target.checked })}
              className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-900 cursor-pointer"
              id="shield-sk"
            />
          </div>

          {/* Name Text Input */}
          <input
            type="text"
            value={shield.name}
            onChange={(e) => handleShieldUpdate({ name: e.target.value })}
            placeholder="Shield Name (e.g. Round Shield)"
            className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 outline-none w-full max-w-[240px] focus:border-cyan-500"
          />

          {/* Max Block Read-Only Display Box */}
          <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-slate-300">Max Block</span>
            <span className="text-sm">🛡️</span>
            <div
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-extrabold text-cyan-300 text-center"
              title="Auto-filled Max Block from equipped shield"
            >
              {shield.max_block || 12}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
