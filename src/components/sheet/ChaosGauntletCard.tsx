// src/components/sheet/ChaosGauntletCard.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ChevronDown,
  X,
  AlertCircle,
  Sparkles,
  Trash2,
  Zap,
  Flame,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { ChaosGemSlot } from '../../types/game';

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

  // Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Global open event listener
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'chaos_gauntlet' || e.detail === 'gauntlet' || e.detail === 'chaosGems') {
        setShowManageModal(true);
      }
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  const handleCloseManageModal = () => {
    setShowManageModal(false);
    setConfirmRemovalSlotId(null);
    window.dispatchEvent(new CustomEvent('supaflex:close-manager'));
  };

  // Click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseManageModal();
      }
    };
    if (showManageModal) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageModal]);

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
      {/* Header Bar: Interactive Clickable Title + Pure Pencil Button (KISS) */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Chaos Gauntlet Manager"
          >
            <div className="p-1.5 rounded-xl bg-purple-950/90 border border-purple-500/50 text-purple-300 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.25)] group-hover:scale-105 group-hover:border-purple-400 transition-all">
              <span className="text-base leading-none">💎</span>
            </div>
            <h3 className="font-outfit font-extrabold text-sm tracking-widest text-purple-200 uppercase group-hover:text-white transition-colors flex items-center gap-1.5">
              <span>Chaos Gauntlet</span>
              <ChevronDown className="w-3.5 h-3.5 text-purple-400/70 group-hover:text-purple-300 group-hover:translate-y-0.5 transition-all" />
            </h3>
          </button>
          <CardHelpButton ruleKey="chaos_gauntlet.basics" />
        </div>

        {/* Minimalist Pencil Action Button */}
        <button
          type="button"
          onClick={() => setShowManageModal(!showManageModal)}
          className={`p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group ${
            showManageModal
              ? 'bg-purple-600/30 text-purple-200 border-purple-400 shadow-purple-500/30'
              : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-300 hover:text-white'
          }`}
          title="Open Chaos Gauntlet Manager"
        >
          <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
        </button>

        {/* CHAOS GAUNTLET MANAGER MODAL */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
            >
              {/* Modal Top Bar */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/30 text-purple-300">💎</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                        Chaos Gauntlet Manager
                      </h3>
                      <CardHelpButton ruleKey="chaos_gauntlet.basics" />
                    </div>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Review socketed chaos gems and shatter matrices to free conduits.
                    </p>
                  </div>
                </div>

                {/* Status Pill & Close */}
                <div className="flex items-center gap-3">
                  <div className="px-3.5 py-1 bg-purple-950/70 border border-purple-500/40 rounded-full font-mono font-bold text-xs text-purple-200 flex items-center gap-2 shadow-md">
                    <span>
                      Active Sockets: <strong className="text-purple-300">{equippedGemsCount}/6</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseManageModal}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: 6 Conduits in Responsive 2-Column Grid */}
              <div className="flex-1 min-h-0 p-4 overflow-y-auto bg-slate-950/30 no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {gauntletSlots.map((slot) => {
                    const isWrist = slot.slot_type === 'wrist';
                    const meta = SLOT_METADATA.find((m) => m.slot_id === slot.slot_id);
                    const hasGem = Boolean(slot.gem && slot.gem.name);

                    return (
                      <div
                        key={slot.slot_id}
                        className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                          hasGem
                            ? isWrist
                              ? 'bg-slate-900/90 border-amber-500/40 shadow-sm shadow-amber-950/20'
                              : 'bg-slate-900/90 border-slate-700/80 shadow-sm'
                            : 'bg-slate-950/40 border-dashed border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                              isWrist
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                                : 'bg-slate-950 text-slate-300 border-slate-800'
                            }`}>
                              {meta?.shortLabel || `Slot ${slot.slot_number}`}
                            </span>
                            {hasGem && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/70 text-purple-300 border border-purple-500/30">
                                {slot.gem!.action || 'F'} • {slot.gem!.usage ?? 3} Uses
                              </span>
                            )}
                          </div>

                          {hasGem && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemovalSlotId(slot.slot_id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-500/30"
                              title="Shatter & destroy socketed gem"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {hasGem ? (
                          <div className="flex flex-col gap-1">
                            <div className="font-outfit font-bold text-xs text-slate-100 flex items-center gap-1.5">
                              <span className="text-purple-400">💎</span>
                              <span className="text-slate-100">{slot.gem!.name}</span>
                              <ItemNotesPopover notes={(slot.gem as any).notes} itemName={slot.gem!.name} inline />
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug">
                              {slot.gem!.effect}
                            </p>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic py-1 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-slate-600" />
                            <span>Empty Conduit — Fused via Loot drops</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Bottom Footer Bar */}
              <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleCloseManageModal();
                    window.dispatchEvent(new CustomEvent('supaflex:open-loot-generator'));
                  }}
                  className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-outfit font-bold text-xs tracking-wide transition-all shadow-md shadow-purple-950/40 flex items-center gap-1.5 cursor-pointer border border-purple-400/40"
                  title="Open Loot Generator to roll for encounter treasure and Chaos Gems"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                  <span>🎲 Open Loot Generator</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseManageModal}
                  className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
                >
                  Done
                </button>
              </div>

              {/* Modal-Internal Shatter Confirmation Overlay */}
              {confirmRemovalSlotId && pendingRemovalSlot && (
                <div className="absolute inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                  <div className="bg-slate-900 border border-rose-500/60 rounded-2xl p-5 max-w-md w-full flex flex-col gap-3 shadow-2xl shadow-rose-950/50 animate-scaleIn">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-400">
                        <Flame className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-outfit font-bold text-sm text-slate-100">
                          Shatter '{pendingRemovalSlot.gem?.name}'?
                        </h4>
                        <span className="text-[11px] font-mono text-rose-300">
                          Conduit: {SLOT_METADATA.find((m) => m.slot_id === pendingRemovalSlot.slot_id)?.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Removing a socketed Chaos Gem permanently destroys it forever. It cannot be recovered or returned to inventory.
                    </p>
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setConfirmRemovalSlotId(null)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmRemove}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-md shadow-rose-950/40 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>💥 Confirm Shatter</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
                className={`px-2.5 py-1.5 min-h-[34px] rounded-xl border flex items-center justify-between gap-2.5 transition-all text-xs ${
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

                {/* 2. Gem Name (Truncates, Hover tooltip displays effect) */}
                <div className="flex-1 min-w-0 truncate" title={gem.effect ? `${gem.name}: ${gem.effect}` : gem.name}>
                  <span className="font-outfit font-bold text-xs text-slate-100 inline-flex items-center align-baseline gap-1 truncate max-w-full">
                    <span className="text-[11px] leading-none shrink-0">💎</span>
                    <span className="truncate">{gem.name}</span>
                    <ItemNotesPopover notes={(gem as any).notes} itemName={gem.name} inline />
                  </span>
                </div>

                {/* 3. Three Clickable Usage Checkboxes (ALWAYS 3) */}
                <div className="shrink-0 flex items-center gap-1 justify-center px-1">
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

                {/* 4. Action: Spark (Mega Slot Only) */}
                {isWrist && (
                  <div className="shrink-0 flex items-center">
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
                  </div>
                )}
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
