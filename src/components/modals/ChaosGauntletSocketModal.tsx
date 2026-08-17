// src/components/modals/ChaosGauntletSocketModal.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Trash2,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  ChaosGemSlot,
  ChaosGemItem,
  SupabaseChaosGem,
} from '../../types/game';

interface ChaosGauntletSocketModalProps {
  isOpen: boolean;
  incomingGem: SupabaseChaosGem | null;
  onClose: () => void;
  onSocketSuccess: (gemName: string, slotLabel: string) => void;
}

const SLOT_METADATA = [
  { slot_id: 'finger_1', slot_number: 1, slot_type: 'finger' as const, label: 'Thumb (Slot 1)', shortLabel: '1️⃣ Thumb' },
  { slot_id: 'finger_2', slot_number: 2, slot_type: 'finger' as const, label: 'Index (Slot 2)', shortLabel: '2️⃣ Index' },
  { slot_id: 'finger_3', slot_number: 3, slot_type: 'finger' as const, label: 'Middle (Slot 3)', shortLabel: '3️⃣ Middle' },
  { slot_id: 'finger_4', slot_number: 4, slot_type: 'finger' as const, label: 'Ring (Slot 4)', shortLabel: '4️⃣ Ring' },
  { slot_id: 'finger_5', slot_number: 5, slot_type: 'finger' as const, label: 'Pinky (Slot 5)', shortLabel: '5️⃣ Pinky' },
  { slot_id: 'wrist', slot_number: 6, slot_type: 'wrist' as const, label: 'Mega Slot (Wrist)', shortLabel: '👑 Mega Slot' },
];

export const ChaosGauntletSocketModal: React.FC<ChaosGauntletSocketModalProps> = ({
  isOpen,
  incomingGem,
  onClose,
  onSocketSuccess,
}) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const modalRef = useRef<HTMLDivElement>(null);

  // Normalize 6 ordered slots
  const gauntletSlots: ChaosGemSlot[] = useMemo(() => {
    const raw = activeCharacter?.sheet_data?.chaos_gauntlet_slots;
    const existingMap = new Map<string, ChaosGemSlot>();
    if (Array.isArray(raw)) {
      raw.forEach((s) => {
        if (s && s.slot_id) {
          existingMap.set(s.slot_id, s);
        }
      });
    }

    return SLOT_METADATA.map((meta) => {
      const found = existingMap.get(meta.slot_id);
      return {
        slot_id: meta.slot_id,
        slot_type: meta.slot_type,
        slot_number: meta.slot_number,
        slot_label: meta.label,
        gem: found?.gem || null,
      };
    });
  }, [activeCharacter?.sheet_data?.chaos_gauntlet_slots]);

  // Default selected slot: first empty slot, or slot 1 if all full
  const [selectedSlotId, setSelectedSlotId] = useState<string>('finger_1');

  useEffect(() => {
    if (isOpen) {
      const firstEmpty = gauntletSlots.find((s) => !s.gem || !s.gem.name);
      if (firstEmpty) {
        setSelectedSlotId(firstEmpty.slot_id);
      } else {
        setSelectedSlotId('finger_1');
      }
    }
  }, [isOpen, gauntletSlots]);

  if (!isOpen || !incomingGem) return null;

  const targetSlot = gauntletSlots.find((s) => s.slot_id === selectedSlotId);
  const targetMeta = SLOT_METADATA.find((m) => m.slot_id === selectedSlotId);
  const isTargetOccupied = Boolean(targetSlot?.gem && targetSlot.gem.name);
  const isWrist = targetSlot?.slot_type === 'wrist';

  // Handle Socketing Commit
  const handleCommitSocket = async () => {
    if (!incomingGem || !targetSlot) return;

    const newGem: ChaosGemItem = {
      id: incomingGem.id,
      name: incomingGem.name,
      action: incomingGem.action || 'F',
      usage: 3,
      max_usage: 3,
      effect: incomingGem.effect,
      genres: incomingGem.genres,
      checked: [false, false, false],
    };

    updateActiveSheetData((prev) => {
      const currentSlots = gauntletSlots.map((s) => ({ ...s }));
      const targetIdx = currentSlots.findIndex((s) => s.slot_id === selectedSlotId);
      if (targetIdx !== -1) {
        currentSlots[targetIdx] = {
          ...currentSlots[targetIdx],
          gem: newGem,
        };
      }
      return { ...prev, chaos_gauntlet_slots: currentSlots };
    });

    await saveActiveCharacter();
    onSocketSuccess(incomingGem.name, targetMeta?.label || 'Gauntlet Conduit');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Top Bar */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-500/40 text-violet-300 flex items-center justify-center shadow-inner">
              <span className="text-xl leading-none">💎</span>
            </div>
            <div>
              <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                Socket Volatile Chaos Gem
              </h3>
              <p className="text-xs text-amber-400/90 font-medium">
                ⚠️ Volatile energy lattice: Must be socketed immediately into a conduit or it will destabilize and dissolve!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            title="Discard volatile gem & close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-COLUMN MASTER SPLIT-PANE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 flex-1 min-h-0 overflow-y-auto bg-slate-900/40 custom-scrollbar">
          
          {/* --- LEFT COLUMN: GAUNTLET CONDUITS (SLOTS 1-6) --- */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3.5 flex flex-col justify-between shadow-inner gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs font-outfit font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  Select Target Conduit (1–6)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {gauntletSlots.filter(s => s.gem && s.gem.name).length}/6 Occupied
                </span>
              </div>

              {/* 6 Conduit Slot Buttons */}
              <div className="flex flex-col gap-1.5">
                {SLOT_METADATA.map((meta) => {
                  const isSelected = selectedSlotId === meta.slot_id;
                  const slotObj = gauntletSlots.find((s) => s.slot_id === meta.slot_id);
                  const isOccupied = Boolean(slotObj?.gem && slotObj.gem.name);
                  const isWristSlot = meta.slot_type === 'wrist';

                  return (
                    <button
                      key={meta.slot_id}
                      type="button"
                      onClick={() => {
                        setSelectedSlotId(meta.slot_id);
                      }}
                      className={`px-3 py-2 rounded-xl border transition-all flex items-center justify-between text-left cursor-pointer ${
                        isSelected
                          ? isWristSlot
                            ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/40 shadow-md shadow-amber-950/40'
                            : 'bg-violet-950/40 border-violet-400 ring-2 ring-violet-400/40 shadow-md shadow-violet-950/40'
                          : isOccupied
                          ? 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600'
                          : 'bg-slate-950/60 border-dashed border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                          isWristSlot
                            ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}>
                          {meta.shortLabel}
                        </span>

                        <div className="truncate">
                          {isOccupied ? (
                            <span className="font-outfit font-bold text-xs text-slate-100 flex items-center gap-1 truncate">
                              <span>💎</span>
                              <span className="truncate">{slotObj?.gem?.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 italic">
                              ✨ Empty Conduit
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 ml-2">
                        {isOccupied ? (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30">
                            {slotObj?.gem?.usage ?? 3}/3 Uses
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                            Available ✨
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Overwrite Confirmation Alert if Target Occupied */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              {isTargetOccupied && (
                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-2.5 flex items-start gap-2 text-xs text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold block">Conduit Occupied:</span>
                    <span>
                      Socketing here will <strong className="text-rose-300 font-extrabold underline">shatter & destroy</strong> '{targetSlot?.gem?.name}' forever!
                    </span>
                  </div>
                </div>
              )}

              {/* Primary Socket Button */}
              <button
                type="button"
                onClick={handleCommitSocket}
                className={`w-full py-2.5 px-4 rounded-xl font-outfit font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                  isWrist
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-amber-200 shadow-amber-950/50 font-extrabold animate-pulse'
                    : 'bg-gradient-to-r from-violet-600 via-violet-500 to-violet-600 hover:from-violet-500 hover:to-violet-400 text-white border border-violet-400 shadow-violet-950/50'
                }`}
              >
                <Zap className="w-4 h-4 shrink-0" />
                <span>
                  Socket into {targetMeta?.shortLabel} {isWrist ? '(Mega Slot)' : ''}
                </span>
              </button>
            </div>
          </div>

          {/* --- RIGHT COLUMN: LOOTED GEM STAGING & EFFECT --- */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 flex flex-col justify-between shadow-inner gap-3">
            <div className="flex flex-col gap-3">
              {/* Header Badge */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <span className="text-xs font-outfit font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span>💎</span>
                  Looted Primordial Gem
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  ⚡ [F] Free Action • 1/Rnd
                </span>
              </div>

              {/* Gem Title & Genres */}
              <div>
                <h4 className="font-outfit font-extrabold text-lg text-slate-100 flex items-center gap-2">
                  <span>💎</span>
                  <span>{incomingGem.name}</span>
                </h4>
                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {(incomingGem.genres || ['Medieval', 'Modern', 'SciFi']).map((g) => (
                    <span
                      key={g}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
                    >
                      {g}
                    </span>
                  ))}
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-500/40">
                    Durability: 3 Uses
                  </span>
                </div>
              </div>

              {/* Gem Effect Box */}
              <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-3.5 flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Effect Description:
                </span>
                <p className="text-xs text-slate-200 font-sans leading-relaxed">
                  {incomingGem.effect}
                </p>
              </div>

              {/* Flavor / Mechanics Note */}
              <div className="bg-slate-900/40 rounded-xl border border-slate-800/60 p-2.5 text-[11px] text-slate-400 italic">
                {incomingGem.notes || 'Volatile Chaos Gem. Channeled through the Gauntlet conduits as a Free Action. Shatters into cosmic dust at 0 uses.'}
              </div>
            </div>

            {/* Drop & Shatter Action Button */}
            <div className="pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                title="Discard and permanently destroy this volatile gem"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>💥 Drop & Destroy Gem (Do Not Socket)</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
