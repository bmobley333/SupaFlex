// src/components/modals/TacticalPivotModal.tsx
// Fast in-combat drawer/modal for executing the 1-per-encounter Tactical Pivot (1 Spark)

import React, { useState, useMemo } from 'react';
import { Zap, X, ArrowRight, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AbilitySlot } from '../../types/game';
import { getPowerReadyCategory } from '../../utils/readyMatrixSchedule';

interface TacticalPivotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TacticalPivotModal: React.FC<TacticalPivotModalProps> = ({ isOpen, onClose }) => {
  const { activeCharacter, executeTacticalPivot } = useCharacterStore();
  const [selectedCodexPower, setSelectedCodexPower] = useState<AbilitySlot | null>(null);
  const [selectedReadySlot, setSelectedReadySlot] = useState<AbilitySlot | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !activeCharacter || !activeCharacter.sheet_data) return null;

  const sheet = activeCharacter.sheet_data;

  const charges = typeof sheet.charges === 'number' ? sheet.charges : (sheet.sparks || 0);
  const isSparked = sheet.is_sparked || charges >= 5;
  const pivotUsed = Boolean(sheet.tactical_pivot_used_in_encounter);

  const powerSlots: AbilitySlot[] = Array.isArray(sheet.power_slots) ? sheet.power_slots : [];
  const codex: AbilitySlot[] = Array.isArray(sheet.character_power_codex) ? sheet.character_power_codex : [];

  // Tactical active slots that can be replaced (excluding passives)
  const activeTacticalSlots = useMemo(() => {
    return powerSlots.filter((p) => p && p.name && getPowerReadyCategory(p) !== 'contextual_passive');
  }, [powerSlots]);

  // Unreadied tactical codex powers available to swap in
  const availableCodexPowers = useMemo(() => {
    return codex.filter((p) => {
      if (!p || !p.name) return false;
      const cat = getPowerReadyCategory(p);
      if (cat === 'contextual_passive') return false; // Passives are always active (0 cost)
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.effect || '').toLowerCase().includes(q);
    });
  }, [codex, searchQuery]);

  const handleExecute = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedCodexPower) {
      setErrorMessage('Please select a Codex power to swap in.');
      return;
    }
    if (!selectedReadySlot) {
      setErrorMessage('Please select an active Ready Slot to replace.');
      return;
    }

    const result = executeTacticalPivot(selectedCodexPower.name, selectedReadySlot.name);
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to execute Tactical Pivot.');
      return;
    }

    setSuccessMessage(`Successfully swapped ${selectedCodexPower.name} into your active matrix!`);
    setTimeout(() => {
      onClose();
      setSelectedCodexPower(null);
      setSelectedReadySlot(null);
      setSuccessMessage(null);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl border bg-amber-950/80 border-amber-500/40 text-amber-300 flex items-center justify-center shadow-inner">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                ⚡ Tactical Pivot (In-Combat Swap)
              </h3>
              <p className="text-xs text-slate-400">
                Spend <strong className="text-amber-300">1 Free Action (F) + 1 Spark (5⚡)</strong> to swap 1 un-readied Vault power into your active Ready Matrix.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Strip */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs font-mono flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Spark Status:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold border ${
              isSparked
                ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
            }`}>
              ⚡ {charges}/5 Charges {isSparked ? '(Spark Ready!)' : '(Insufficient Charges)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">Usage:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold border ${
              pivotUsed
                ? 'bg-rose-950/60 border-rose-500/30 text-rose-300'
                : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
            }`}>
              {pivotUsed ? '❌ Used This Encounter' : '✅ Ready (1-Enc)'}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Incoming Vault Power */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-outfit font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  1. Choose Vault Power to Swap IN
                </span>
                <span className="text-[10px] font-mono text-slate-400">({availableCodexPowers.length} Available)</span>
              </div>

              <div className="relative">
                <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter vault powers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 text-xs pl-6 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {availableCodexPowers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No un-readied tactical powers in your Vault.
                  </div>
                ) : (
                  availableCodexPowers.map((p) => {
                    const cat = getPowerReadyCategory(p);
                    const isSelected = selectedCodexPower?.name === p.name;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setSelectedCodexPower(p)}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-950/80 border-amber-400 text-amber-100 shadow-md ring-1 ring-amber-400'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-xs font-bold">
                          <span className="flex items-center gap-1">
                            {cat === 'primary_arsenal' ? '⚔️' : '👣'} {p.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                            [{p.action || 'A'}]
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{p.effect}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 2: Outgoing Active Slot */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-inner">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-outfit font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  2. Choose Active Slot to Replace (OUT)
                </span>
                <span className="text-[10px] font-mono text-slate-400">({activeTacticalSlots.length} Active)</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {activeTacticalSlots.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No active tactical powers to replace.
                  </div>
                ) : (
                  activeTacticalSlots.map((p) => {
                    const cat = getPowerReadyCategory(p);
                    const isSelected = selectedReadySlot?.name === p.name;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setSelectedReadySlot(p)}
                        className={`w-full text-left p-2 rounded-lg border transition-all flex flex-col gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-100 shadow-md ring-1 ring-cyan-400'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-xs font-bold">
                          <span className="flex items-center gap-1">
                            {cat === 'primary_arsenal' ? '⚔️' : '👣'} {p.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                            [{p.action || 'A'}]
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{p.effect}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {selectedCodexPower && selectedReadySlot ? (
              <span className="font-mono text-slate-200 flex items-center gap-1.5">
                <span className="text-amber-300">{selectedCodexPower.name}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-cyan-300">{selectedReadySlot.name}</span>
              </span>
            ) : (
              <span>Select both a Codex power and an active slot above to proceed.</span>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedCodexPower || !selectedReadySlot || !isSparked || pivotUsed}
            onClick={handleExecute}
            className={`px-4 py-2 rounded-xl text-xs font-outfit font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
              !selectedCodexPower || !selectedReadySlot || !isSparked || pivotUsed
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-500/30'
            }`}
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            Execute Tactical Pivot (1⚡)
          </button>
        </div>
      </div>
    </div>
  );
};
