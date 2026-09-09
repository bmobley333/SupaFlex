// src/components/modals/EmergencyHardwareShuntModal.tsx
// Master Modal Blueprint compliant Emergency Hardware Shunt Modal
// Hot-swap 1 Vault function into active combat loadout. Costs 1 Move Action [M] and 1 Luck Chit (🍀).

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, X, Search, Trash2, AlertTriangle, CheckCircle, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AbilitySlot, MagicItem } from '../../types/game';
import {
  calculateTotalLoadoutCapacity,
  calculateTotalLoadoutSlotsUsed,
  getItemSlotWeight,
} from '../../utils/loadoutCapacitySchedule';

interface EmergencyHardwareShuntModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyHardwareShuntModal: React.FC<EmergencyHardwareShuntModalProps> = ({ isOpen, onClose }) => {
  const { activeCharacter, executeHardwareShunt } = useCharacterStore();
  const [selectedVaultItem, setSelectedVaultItem] = useState<MagicItem | null>(null);
  const [removedSlotNames, setRemovedSlotNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sheet = activeCharacter?.sheet_data;

  // Stance & slot setup
  const activeStance: 'alpha' | 'beta' = sheet?.active_stance === 'beta' ? 'beta' : 'alpha';
  const slotKey = activeStance === 'beta' ? 'stance_beta_slots' : 'spell_slots';
  const rawActiveSlots: AbilitySlot[] = Array.isArray(sheet?.[slotKey]) ? (sheet[slotKey] as AbilitySlot[]) : [];
  const activeSlots = useMemo(() => {
    return rawActiveSlots.filter((s) => s && s.name && s.name.trim() !== '');
  }, [rawActiveSlots]);

  const vault: MagicItem[] = Array.isArray(sheet?.character_vault) ? sheet.character_vault : [];
  const coldStorage: string[] = Array.isArray(sheet?.cold_storage_functions) ? sheet.cold_storage_functions : [];
  const currentLuck: number = typeof sheet?.luck === 'number' ? sheet.luck : 3;

  // Capacity calculations
  const loadoutExpansions = typeof sheet?.loadout_expansions_purchased === 'number'
    ? sheet.loadout_expansions_purchased
    : (typeof sheet?.unlocked_loadout_slots === 'number'
      ? Math.max(0, Math.floor((sheet.unlocked_loadout_slots - 4) / 2))
      : 0);
  const totalLoadoutCapacity = calculateTotalLoadoutCapacity(loadoutExpansions);

  // Active slots still equipped (not marked for removal)
  const remainingActiveSlots = useMemo(() => {
    return activeSlots.filter((s) => !removedSlotNames.has(s.name.trim().toLowerCase()));
  }, [activeSlots, removedSlotNames]);

  const activeSlotsUsed = useMemo(() => {
    return calculateTotalLoadoutSlotsUsed(remainingActiveSlots);
  }, [remainingActiveSlots]);

  const incomingSlots = selectedVaultItem ? getItemSlotWeight(selectedVaultItem) : 0;
  const projectedTotalSlots = activeSlotsUsed + incomingSlots;
  const overage = Math.max(0, projectedTotalSlots - totalLoadoutCapacity);
  const isBalanced = projectedTotalSlots <= totalLoadoutCapacity;
  const hasLuckChit = currentLuck >= 1;

  // Available Vault functions (excluding cold storage and active stance slots)
  const availableVaultItems = useMemo(() => {
    const activeNames = new Set(activeSlots.map((s) => s.name.trim().toLowerCase()));
    return vault.filter((item) => {
      if (!item || !item.name) return false;
      if (coldStorage.includes(item.name)) return false;
      if (activeNames.has(item.name.trim().toLowerCase())) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (typeof item.effect === 'string' && item.effect.toLowerCase().includes(q))
      );
    });
  }, [vault, coldStorage, activeSlots, searchQuery]);

  if (!isOpen || !activeCharacter || !sheet) return null;

  // Mark an active function for removal (irreversible within this session)
  const handleRemoveSlot = (slotName: string) => {
    setRemovedSlotNames((prev) => {
      const next = new Set(prev);
      next.add(slotName.trim().toLowerCase());
      return next;
    });
  };

  // Select the single incoming vault item
  const handleSelectVaultItem = (item: MagicItem) => {
    setSelectedVaultItem(item);
    setErrorMessage(null);
  };

  // Execute Shunt
  const handleExecute = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedVaultItem) {
      setErrorMessage('Please select 1 Vault function to bring online.');
      return;
    }
    if (overage > 0) {
      setErrorMessage(`Loadout exceeds capacity by ${overage} slot(s). Remove active functions to balance.`);
      return;
    }
    if (!hasLuckChit) {
      setErrorMessage('Emergency Hardware Shunt requires 1 Luck Chit (🍀). You have 0.');
      return;
    }

    const outgoingNames = activeSlots
      .filter((s) => removedSlotNames.has(s.name.trim().toLowerCase()))
      .map((s) => s.name);

    const result = executeHardwareShunt(selectedVaultItem.name, outgoingNames);
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to execute Emergency Hardware Shunt.');
      return;
    }

    setSuccessMessage(
      `Emergency Shunt complete! ${selectedVaultItem.name} is now ONLINE. ${outgoingNames.length} function(s) placed in Cold Storage.`
    );
    setTimeout(() => {
      onClose();
      setSelectedVaultItem(null);
      setRemovedSlotNames(new Set());
      setSuccessMessage(null);
    }, 1000);
  };

  const handleModalClose = () => {
    setSelectedVaultItem(null);
    setRemovedSlotNames(new Set());
    setErrorMessage(null);
    setSuccessMessage(null);
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl border bg-cyan-950/80 border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-inner">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                  ⚡ Emergency Hardware Shunt
                </h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-500/40">
                  [M] Move Action
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/40">
                  🍀 1 Luck Chit
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hot-swap 1 Vault function into your active stance. Costs <strong className="text-emerald-300">1 Luck Chit</strong> for a <strong className="text-amber-300">[M] Move Action</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Luck Pool:</span>
              <span className={`font-extrabold ${hasLuckChit ? 'text-emerald-400' : 'text-rose-400'}`}>
                🍀 {currentLuck}
              </span>
            </div>
            <button
              type="button"
              onClick={handleModalClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Economy & Overage Instruction Ribbon */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-mono flex-wrap gap-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <span className="font-bold text-cyan-300">Workflow:</span>
            <span>1. Select 1 Vault function (Right)</span>
            <ArrowRight className="w-3 h-3 text-slate-500 inline" />
            <span>2. Remove active functions (Left) if over capacity</span>
            <ArrowRight className="w-3 h-3 text-slate-500 inline" />
            <span>3. Pay 1 Luck Chit (Bottom Right)</span>
          </div>
          <div className="text-[11px] text-rose-300 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Removed functions lock in Cold Storage</span>
          </div>
        </div>

        {/* Two-Pane Split Layout */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto min-h-0 text-xs">
          {/* PANE 1 (LEFT): Active Stance Loadout & Overage Resolution */}
          <div className="flex flex-col gap-2.5 min-h-0">
            <div className="flex items-center justify-between">
              <span className="font-outfit font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span>{activeStance === 'alpha' ? '🅰️' : '🅱️'}</span>
                <span>Active Loadout ({activeStance === 'alpha' ? 'Stance Alpha' : 'Stance Beta'})</span>
              </span>
              <span
                className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded border ${
                  overage > 0
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-950 border-slate-800 text-cyan-300'
                }`}
              >
                {projectedTotalSlots}/{totalLoadoutCapacity} Slots
              </span>
            </div>

            {/* High-Contrast Overage Alert Banner */}
            {overage > 0 ? (
              <div className="p-2.5 rounded-xl border border-rose-500/80 bg-rose-950/60 text-rose-200 text-xs flex items-center gap-2 shadow-inner animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="font-bold text-rose-300">
                    ⚠️ OVERLOAD: +{overage} Slot{overage > 1 ? 's' : ''} Overage!
                  </div>
                  <div className="text-[11px] text-rose-400">
                    Remove active functions below to balance your loadout before applying.
                  </div>
                </div>
              </div>
            ) : selectedVaultItem ? (
              <div className="p-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Loadout balanced! Ready to apply shunt ({projectedTotalSlots}/{totalLoadoutCapacity} Slots).</span>
              </div>
            ) : null}

            {/* Staged Incoming Vault Function Card */}
            {selectedVaultItem && (
              <div className="p-2.5 rounded-xl border border-cyan-500/60 bg-cyan-950/40 flex flex-col gap-1 shadow-md animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>INCOMING FROM VAULT (1 of 1)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedVaultItem(null)}
                    className="text-[11px] text-slate-400 hover:text-rose-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-100">{selectedVaultItem.name}</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-950 border border-cyan-500/40 text-cyan-300">
                    {incomingSlots === 0 ? '0 ⚙️ Utility' : `${incomingSlots} 🧿 Slots`}
                  </span>
                </div>
                {selectedVaultItem.effect && (
                  <p className="text-[11px] text-slate-400 line-clamp-2">{selectedVaultItem.effect}</p>
                )}
              </div>
            )}

            {/* Equipped Active Functions List */}
            <div className="flex-1 overflow-y-auto max-h-[340px] border border-slate-800/80 rounded-xl bg-slate-950/40 p-1.5 flex flex-col gap-1.5">
              {activeSlots.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No active functions equipped.</div>
              ) : (
                activeSlots.map((slot, sIdx) => {
                  const isRemoved = removedSlotNames.has(slot.name.trim().toLowerCase());
                  const weight = getItemSlotWeight(slot);

                  return (
                    <div
                      key={sIdx}
                      className={`p-2 rounded-xl border transition-all flex flex-col gap-1 ${
                        isRemoved
                          ? 'bg-slate-950/40 border-slate-800/50 opacity-40'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`font-bold text-xs flex items-center gap-1.5 ${isRemoved ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          <span>🧿</span> {slot.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-amber-300">
                            {weight === 0 ? '0 ⚙️' : `${weight} 🧿`}
                          </span>
                          {!isRemoved ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(slot.name)}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-rose-500/40 bg-rose-950/60 hover:bg-rose-900 text-rose-300 transition-all flex items-center gap-1 cursor-pointer"
                              title="Unslot this function (irreversible during this shunt)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove</span>
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                              🧊 Cold Storage
                            </span>
                          )}
                        </div>
                      </div>
                      {slot.effect && (
                        <p className={`text-[11px] line-clamp-2 leading-relaxed ${isRemoved ? 'text-slate-600 line-through' : 'text-slate-400'}`}>
                          {slot.effect}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANE 2 (RIGHT): Hardware Vault Catalog (1 Add Allowed) */}
          <div className="flex flex-col gap-2.5 min-h-0">
            <div className="flex items-center justify-between">
              <span className="font-outfit font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>📦</span> Hardware Vault Catalog
              </span>
              <span className="text-[11px] font-mono text-slate-400">{availableVaultItems.length} available</span>
            </div>

            {/* Search Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Vault functions..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Vault Functions List */}
            <div className="flex-1 overflow-y-auto max-h-[380px] border border-slate-800/80 rounded-xl bg-slate-950/40 p-1.5 flex flex-col gap-1.5">
              {availableVaultItems.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No matching functions in Vault.</div>
              ) : (
                availableVaultItems.map((item) => {
                  const isSelected = selectedVaultItem?.name === item.name;
                  const weight = getItemSlotWeight(item);

                  return (
                    <div
                      key={item.id || item.name}
                      className={`w-full p-2 rounded-xl border transition-all flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-100 shadow-md shadow-cyan-950/50'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <span>🧿</span> {item.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-cyan-300">
                            {weight === 0 ? '0 ⚙️' : `${weight} 🧿`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectVaultItem(item)}
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-cyan-600 text-white border-cyan-400 font-extrabold shadow-sm'
                                : 'bg-slate-950 text-cyan-300 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : '+ Add to Stance'}
                          </button>
                        </div>
                      </div>
                      {item.effect && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{item.effect}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Bar & Apply Action */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs flex-1">
            {errorMessage && (
              <div className="text-rose-400 flex items-center gap-1.5 font-bold animate-fadeIn">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="text-emerald-400 flex items-center gap-1.5 font-bold animate-fadeIn">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
            {!errorMessage && !successMessage && selectedVaultItem && (
              <div className="text-slate-300 flex items-center gap-1.5 flex-wrap">
                <span>Shunting:</span>
                <strong className="text-cyan-300">{selectedVaultItem.name}</strong>
                {removedSlotNames.size > 0 && (
                  <>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 inline" />
                    <span className="text-slate-400">Cold Storage:</span>
                    <strong className="text-amber-300">{removedSlotNames.size} function(s)</strong>
                  </>
                )}
              </div>
            )}
            {!errorMessage && !successMessage && !selectedVaultItem && (
              <div className="text-slate-500">
                Select 1 function from the Hardware Vault on the right to begin shunting.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleModalClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!selectedVaultItem || overage > 0 || !hasLuckChit}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                selectedVaultItem && isBalanced && hasLuckChit
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold shadow-emerald-950/60 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <span>🍀</span>
              <span>
                {!selectedVaultItem
                  ? 'Select 1 Vault Function'
                  : overage > 0
                  ? `Over Capacity (+${overage} Slots)`
                  : !hasLuckChit
                  ? 'Insufficient Luck (0 🍀)'
                  : 'Pay 1 Luck Chit & Apply Shunt'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
