// src/components/modals/EmergencyHardwareShuntModal.tsx
// Fast in-combat drawer/modal for executing the Emergency Hardware Shunt (1 Spark or 1 Focus step)

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, ArrowRight, Search, CheckCircle, AlertTriangle, ShieldAlert, Cpu } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AbilitySlot, MagicItem } from '../../types/game';
import { stepDownDie } from '../../lib/dice';

interface EmergencyHardwareShuntModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyHardwareShuntModal: React.FC<EmergencyHardwareShuntModalProps> = ({ isOpen, onClose }) => {
  const { activeCharacter, executeHardwareShunt } = useCharacterStore();
  const [selectedVaultItem, setSelectedVaultItem] = useState<MagicItem | null>(null);
  const [selectedActiveSlot, setSelectedActiveSlot] = useState<AbilitySlot | null>(null);
  const [paymentType, setPaymentType] = useState<'spark' | 'focus'>('spark');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sheet = activeCharacter?.sheet_data;

  const charges = typeof sheet?.charges === 'number' ? sheet.charges : (sheet?.sparks || 0);
  const isSparked = sheet?.is_sparked || charges >= 5;
  const currentFocus = sheet?.focus_die_current || 'd4';
  const nextFocus = stepDownDie(currentFocus);
  const coldStorage = Array.isArray(sheet?.cold_storage_functions) ? sheet.cold_storage_functions : [];

  const rawActiveSlots: AbilitySlot[] = Array.isArray(sheet?.spell_slots) ? sheet.spell_slots : [];
  const activeSlots = useMemo(() => {
    return rawActiveSlots.filter((s) => s && s.name && s.name.trim() !== '');
  }, [rawActiveSlots]);

  const vault: MagicItem[] = Array.isArray(sheet?.character_vault) ? sheet.character_vault : [];

  // Available vault functions (excluding cold storage items)
  const availableVaultItems = useMemo(() => {
    return vault.filter((item) => {
      if (!item || !item.name) return false;
      if (coldStorage.includes(item.name)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (typeof item.effect === 'string' && item.effect.toLowerCase().includes(q))
      );
    });
  }, [vault, coldStorage, searchQuery]);

  if (!isOpen || !activeCharacter || !activeCharacter.sheet_data) return null;

  const handleExecute = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedVaultItem) {
      setErrorMessage('Please select a Vault function to bring online.');
      return;
    }
    if (!selectedActiveSlot) {
      setErrorMessage('Please select an active Function slot to replace.');
      return;
    }

    if (paymentType === 'spark' && !isSparked && charges < 5) {
      setErrorMessage('Insufficient charges for a Spark (requires 5⚡). Select Focus degradation instead.');
      return;
    }

    const result = executeHardwareShunt(selectedVaultItem.name, selectedActiveSlot.name, paymentType);
    if (!result.success) {
      setErrorMessage(result.error || 'Failed to execute Emergency Hardware Shunt.');
      return;
    }

    setSuccessMessage(`Emergency Shunt complete! ${selectedVaultItem.name} is now ONLINE. ${selectedActiveSlot.name} placed in Cold Storage.`);
    setTimeout(() => {
      onClose();
      setSelectedVaultItem(null);
      setSelectedActiveSlot(null);
      setSuccessMessage(null);
    }, 1200);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl border bg-cyan-950/80 border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-inner">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                ⚡ Emergency Hardware Shunt
              </h3>
              <p className="text-xs text-slate-400">
                Spend <strong className="text-amber-300">1 Full Spark (5⚡)</strong> or <strong className="text-purple-300">1 Focus Step Down</strong> to hot-swap a Vault function into your active slots.
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

        {/* Currency & Warning Strip */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs font-mono flex-wrap gap-2">
          {/* Payment Pill Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-bold text-[11px]">Pay With:</span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setPaymentType('spark')}
                disabled={charges < 5 && !isSparked}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  paymentType === 'spark'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : charges >= 5 || isSparked
                    ? 'text-slate-400 hover:text-slate-200 border border-transparent'
                    : 'text-slate-600 cursor-not-allowed border border-transparent'
                }`}
              >
                <span>⚡</span>
                <span>Spark ({charges}/5⚡)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('focus')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  paymentType === 'focus'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>🎯</span>
                <span>Focus ({currentFocus} ➔ {nextFocus})</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-rose-300 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Outgoing item locks into Cold Storage</span>
          </div>
        </div>

        {/* Modal Body: 2 Split Selector Columns */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto min-h-0 text-xs">
          {/* LEFT: Select Vault Item */}
          <div className="flex flex-col gap-2.5 min-h-0">
            <div className="flex items-center justify-between">
              <span className="font-outfit font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>📦</span> 1. Select Incoming Vault Function
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
                placeholder="Search functions..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-[260px] border border-slate-800/80 rounded-xl bg-slate-950/40 p-1.5 flex flex-col gap-1.5">
              {availableVaultItems.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No matching functions in Vault.</div>
              ) : (
                availableVaultItems.map((item) => {
                  const isSelected = selectedVaultItem?.name === item.name;
                  const weight = item.slot_weight ?? 1;
                  return (
                    <button
                      key={item.id || item.name}
                      type="button"
                      onClick={() => setSelectedVaultItem(item)}
                      className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-100 shadow-md shadow-cyan-950/50'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <span>🧿</span> {item.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-cyan-300">
                          {weight === 0 ? '0 ⚙️' : `${weight} 🧿`}
                        </span>
                      </div>
                      {item.effect && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{item.effect}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Select Active Slot to Replace */}
          <div className="flex flex-col gap-2.5 min-h-0">
            <div className="flex items-center justify-between">
              <span className="font-outfit font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span>🔄</span> 2. Select Slot to Replace
              </span>
              <span className="text-[11px] font-mono text-slate-400">{activeSlots.length} active</span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-800/80 rounded-xl bg-slate-950/40 p-1.5 flex flex-col gap-1.5">
              {activeSlots.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No active function slots available.</div>
              ) : (
                activeSlots.map((slot, sIdx) => {
                  const isSelected = selectedActiveSlot?.name === slot.name;
                  const weight = (slot as any).slot_weight ?? 1;
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setSelectedActiveSlot(slot)}
                      className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-amber-950/80 border-amber-500 text-amber-100 shadow-md shadow-amber-950/50'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs flex items-center gap-1.5">
                          <span>🧿</span> {slot.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 border border-slate-800 text-amber-300">
                          {weight === 0 ? '0 ⚙️' : `${weight} 🧿`}
                        </span>
                      </div>
                      {slot.effect && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{slot.effect}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer & Feedback */}
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
            {!errorMessage && !successMessage && selectedVaultItem && selectedActiveSlot && (
              <div className="text-slate-300 flex items-center gap-1.5">
                <span>Shunting:</span>
                <strong className="text-cyan-300">{selectedVaultItem.name}</strong>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 inline" />
                <span className="text-slate-400">Replaces:</span>
                <strong className="text-amber-300">{selectedActiveSlot.name}</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={!selectedVaultItem || !selectedActiveSlot}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                selectedVaultItem && selectedActiveSlot
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold shadow-cyan-900/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Execute Shunt</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
