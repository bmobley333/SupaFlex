// src/components/sheet/ChaosGauntletCard.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  AlertCircle,
  Sparkles,
  Trash2,
  Zap,
  Flame,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  ChaosGemSlot,
} from '../../types/game';

// Standard 1-to-6 slot metadata mapping
const SLOT_METADATA = [
  { slot_id: 'finger_1', slot_number: 1, slot_type: 'finger' as const, label: 'Thumb (Slot 1)', shortLabel: '1️⃣ Thumb' },
  { slot_id: 'finger_2', slot_number: 2, slot_type: 'finger' as const, label: 'Index (Slot 2)', shortLabel: '2️⃣ Index' },
  { slot_id: 'finger_3', slot_number: 3, slot_type: 'finger' as const, label: 'Middle (Slot 3)', shortLabel: '3️⃣ Middle' },
  { slot_id: 'finger_4', slot_number: 4, slot_type: 'finger' as const, label: 'Ring (Slot 4)', shortLabel: '4️⃣ Ring' },
  { slot_id: 'finger_5', slot_number: 5, slot_type: 'finger' as const, label: 'Pinky (Slot 5)', shortLabel: '5️⃣ Pinky' },
  { slot_id: 'wrist', slot_number: 6, slot_type: 'wrist' as const, label: 'Mega Slot (Wrist)', shortLabel: '👑 Mega Slot' },
];

export const ChaosGauntletCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  // Normalize 6 ordered slots (Slots 1 to 6)
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

  const equippedGemsCount = useMemo(() => {
    return gauntletSlots.filter((s) => s.gem && s.gem.name && s.gem.name.trim() !== '').length;
  }, [gauntletSlots]);

  const occupiedSlots = useMemo(() => {
    return gauntletSlots.filter((s) => s.gem && s.gem.name && s.gem.name.trim() !== '');
  }, [gauntletSlots]);

  // Confirmation Modal State for Destroying on Removal
  const [confirmRemovalSlotId, setConfirmRemovalSlotId] = useState<string | null>(null);

  // Status/Toast Feedback Message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Handle Toggle Checkbox on a Socketed Gem (Auto-Shatter on 3rd Checked Box)
  const handleToggleCheckbox = (slotId: string, checkIndex: number) => {
    const slot = gauntletSlots.find((s) => s.slot_id === slotId);
    if (!slot || !slot.gem) return;

    const gemName = slot.gem.name;
    const currentChecked = Array.isArray(slot.gem.checked)
      ? [...slot.gem.checked]
      : [false, false, false];
    
    while (currentChecked.length < 3) currentChecked.push(false);

    currentChecked[checkIndex] = !currentChecked[checkIndex];
    const checkedCount = currentChecked.filter(Boolean).length;

    if (checkedCount >= 3) {
      // 3rd box checked -> Gem is shattered and removed!
      updateActiveSheetData((prev) => {
        const currentSlots = gauntletSlots.map((s) => ({ ...s }));
        const targetIdx = currentSlots.findIndex((s) => s.slot_id === slotId);
        if (targetIdx !== -1) {
          currentSlots[targetIdx] = {
            ...currentSlots[targetIdx],
            gem: null,
          };
        }
        return { ...prev, chaos_gauntlet_slots: currentSlots };
      });

      saveActiveCharacter();
      showToast(`💥 '${gemName}' reached 0 uses and shattered into dust!`, 'warning');
    } else {
      const remainingUsage = Math.max(0, 3 - checkedCount);
      updateActiveSheetData((prev) => {
        const currentSlots = gauntletSlots.map((s) => ({ ...s }));
        const targetIdx = currentSlots.findIndex((s) => s.slot_id === slotId);
        if (targetIdx !== -1 && currentSlots[targetIdx].gem) {
          currentSlots[targetIdx] = {
            ...currentSlots[targetIdx],
            gem: {
              ...currentSlots[targetIdx].gem!,
              checked: currentChecked,
              usage: remainingUsage,
            },
          };
        }
        return { ...prev, chaos_gauntlet_slots: currentSlots };
      });

      saveActiveCharacter();
    }
  };

  // Handle Spark Activation (Mega Slot only: consumes 5/5 Charges = 1 Full Spark)
  const handleSparkActivation = (slotId: string) => {
    const slot = gauntletSlots.find((s) => s.slot_id === slotId);
    if (!slot || !slot.gem) return;

    if (!isSparkReady) {
      showToast('⚠️ Requires a Full Spark (5/5 Charges)!', 'warning');
      return;
    }

    updateActiveSheetData((prev) => ({
      ...prev,
      charges: 0,
      sparks: 0,
      is_sparked: false,
      is_charged: false,
    }));
    saveActiveCharacter();
    showToast(`⚡ Mega Slot Activated: '${slot.gem.name}' triggered with Spark power!`, 'success');
  };

  // Handle Removal (Destroy Gem)
  const handleConfirmRemove = () => {
    if (!confirmRemovalSlotId) return;
    const targetSlotId = confirmRemovalSlotId;
    const slot = gauntletSlots.find((s) => s.slot_id === targetSlotId);
    const gemName = slot?.gem?.name || 'Chaos Gem';

    updateActiveSheetData((prev) => {
      const currentSlots = gauntletSlots.map((s) => ({ ...s }));
      const targetIdx = currentSlots.findIndex((s) => s.slot_id === targetSlotId);
      if (targetIdx !== -1) {
        currentSlots[targetIdx] = {
          ...currentSlots[targetIdx],
          gem: null,
        };
      }
      return { ...prev, chaos_gauntlet_slots: currentSlots };
    });

    saveActiveCharacter();
    setConfirmRemovalSlotId(null);
    showToast(`💥 Shattered & removed '${gemName}'.`, 'warning');
  };

  const currentCharges = activeCharacter?.sheet_data?.charges ?? activeCharacter?.sheet_data?.sparks ?? 0;
  const isSparkReady = currentCharges >= 5 || Boolean(activeCharacter?.sheet_data?.is_sparked);
  const pendingRemovalSlot = gauntletSlots.find((s) => s.slot_id === confirmRemovalSlotId);

  return (
    <div className="bg-gradient-to-b from-purple-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-purple-500/90 p-3.5 flex flex-col gap-2.5 transition-all shadow-lg shadow-purple-950/20">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-purple-950/90 border border-purple-500/50 text-purple-300 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.25)]">
            <span className="text-base leading-none">💎</span>
          </div>
          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-purple-200 uppercase">
            Chaos Gauntlet
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
              equippedGemsCount > 0
                ? 'bg-violet-950/80 text-violet-300 border-violet-500/40'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            {equippedGemsCount}/6 Active
          </span>
        </div>
      </div>

      {/* Card-Level Toast Feedback Notification */}
      {toastMessage && (
        <div
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-between gap-2 border animate-fadeIn ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : toastMessage.type === 'warning'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-sm shadow-rose-950/50'
              : 'bg-slate-900 text-slate-200 border-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'warning' ? (
              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
            title="Dismiss alert"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Inline Shatter Confirmation Modal */}
      {confirmRemovalSlotId && pendingRemovalSlot && (
        <div className="bg-rose-950/50 border border-rose-500/50 rounded-xl p-3 flex flex-col gap-2 animate-fadeIn shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
              <span className="font-outfit font-bold text-xs text-rose-200">
                Shatter '{pendingRemovalSlot.gem?.name}'?
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConfirmRemovalSlotId(null)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-rose-300/90 leading-tight">
            Removing a socketed Chaos Gem permanently destroys it forever. It cannot be recovered.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmRemovalSlotId(null)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRemove}
              className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm cursor-pointer"
            >
              💥 Confirm Shatter
            </button>
          </div>
        </div>
      )}

      {/* --- TABLE-LIKE SLOTS CONTAINER (OCCUPIED SLOTS) --- */}
      {occupiedSlots.length > 0 ? (
        <div className="flex flex-col gap-1">
          {occupiedSlots.map((slot) => {
            const isWrist = slot.slot_type === 'wrist';
            const gem = slot.gem!;
            const meta = SLOT_METADATA.find((m) => m.slot_id === slot.slot_id);

            return (
              <div
                key={slot.slot_id}
                className={`px-2.5 py-1 min-h-[34px] rounded-xl border flex items-center justify-between gap-2.5 transition-all text-xs ${
                  isWrist
                    ? 'bg-gradient-to-r from-amber-950/40 via-violet-950/20 to-slate-950/90 border-amber-500/50 shadow-sm shadow-amber-950/20 hover:border-amber-400'
                    : 'bg-slate-950/70 hover:bg-slate-950/90 border-slate-800/80 hover:border-slate-700 shadow-sm'
                }`}
              >
                {/* 1. Slot Identifier Badge */}
                <div className="shrink-0 flex items-center">
                  {isWrist ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold whitespace-nowrap shadow-inner">
                      {meta?.shortLabel || '👑 Mega Slot'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-mono font-bold whitespace-nowrap">
                      {meta?.shortLabel || `Slot ${slot.slot_number}`}
                    </span>
                  )}
                </div>

                {/* 2. Gem Name */}
                <div className="w-28 sm:w-36 shrink-0 truncate">
                  <span className="font-outfit font-bold text-xs text-slate-100 flex items-center gap-1">
                    <span className="text-[11px] leading-none">💎</span>
                    <span className="truncate" title={gem.name}>{gem.name}</span>
                  </span>
                </div>

                {/* 3. Three Clickable Usage Checkboxes (ALWAYS 3) */}
                <div className="w-16 shrink-0 flex items-center gap-1 justify-center">
                  {[0, 1, 2].map((bIdx) => {
                    const isChecked = !!(gem.checked && gem.checked[bIdx]);
                    return (
                      <input
                        key={bIdx}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheckbox(slot.slot_id, bIdx)}
                        className={`w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 focus:ring-0 cursor-pointer ${
                          isWrist
                            ? 'text-amber-400 accent-amber-400'
                            : 'text-violet-400 accent-violet-400'
                        }`}
                        title={`Use slot ${bIdx + 1} (${isChecked ? 'Used' : 'Available'})`}
                      />
                    );
                  })}
                </div>

                {/* 4. Wrappable Effect Description */}
                <div className="flex-1 min-w-0 pr-1">
                  <p
                    className="text-[11px] text-slate-300 leading-snug whitespace-normal break-words font-sans"
                    title={gem.effect}
                  >
                    {gem.effect}
                  </p>
                </div>

                {/* 5. Actions: Spark (Mega Slot) & Inline Shatter (Trash) */}
                <div className="shrink-0 flex items-center gap-1">
                  {isWrist && (
                    <button
                      type="button"
                      onClick={() => handleSparkActivation(slot.slot_id)}
                      disabled={!isSparkReady}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 flex items-center gap-1 transition-all shadow-sm ${
                        isSparkReady
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold border border-amber-200 shadow-md shadow-amber-500/50 animate-pulse cursor-pointer'
                          : 'bg-amber-950/20 text-amber-500/40 border border-amber-500/20 cursor-not-allowed opacity-30'
                      }`}
                      title={
                        isSparkReady
                          ? '⚡ Full Spark Ready! Activate Mega Slot without consuming gem durability (Consumes 5/5 Charges).'
                          : `Requires a Full Spark (5/5 Charges in Charge HUD, currently ${currentCharges}/5).`
                      }
                    >
                      <Zap className={`w-3 h-3 ${isSparkReady ? 'text-slate-950 fill-slate-950' : 'text-amber-500/40'}`} />
                      <span>Spark</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmRemovalSlotId(slot.slot_id)}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
                    title={`Shatter and destroy '${gem.name}' to free this conduit`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-3 px-4 bg-slate-950/40 rounded-xl border border-dashed border-slate-800/80 text-center text-xs text-slate-500 italic flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400/50" />
          <span>No Chaos Gems currently socketed. (Discovered via volatile loot drops)</span>
        </div>
      )}
    </div>
  );
};
