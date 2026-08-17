// src/components/sheet/ChaosGauntletCard.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  Search,
  AlertCircle,
  Loader2,
  Sparkles,
  Trash2,
  Zap,
  Flame,
  HelpCircle,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre, GenreType } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import {
  ChaosGemSlot,
  ChaosGemItem,
  SupabaseChaosGem,
} from '../../types/game';

// Standard 1-to-6 slot metadata mapping
const SLOT_METADATA = [
  { slot_id: 'finger_1', slot_number: 1, slot_type: 'finger' as const, label: 'Thumb (Slot 1)', shortLabel: '1️⃣ Thumb', pillLabel: 'Slot 1 (Thumb)' },
  { slot_id: 'finger_2', slot_number: 2, slot_type: 'finger' as const, label: 'Index (Slot 2)', shortLabel: '2️⃣ Index', pillLabel: 'Slot 2 (Index)' },
  { slot_id: 'finger_3', slot_number: 3, slot_type: 'finger' as const, label: 'Middle (Slot 3)', shortLabel: '3️⃣ Middle', pillLabel: 'Slot 3 (Middle)' },
  { slot_id: 'finger_4', slot_number: 4, slot_type: 'finger' as const, label: 'Ring (Slot 4)', shortLabel: '4️⃣ Ring', pillLabel: 'Slot 4 (Ring)' },
  { slot_id: 'finger_5', slot_number: 5, slot_type: 'finger' as const, label: 'Pinky (Slot 5)', shortLabel: '5️⃣ Pinky', pillLabel: 'Slot 5 (Pinky)' },
  { slot_id: 'wrist', slot_number: 6, slot_type: 'wrist' as const, label: 'Mega Slot (Wrist)', shortLabel: '👑 Mega Slot', pillLabel: '👑 Mega Slot' },
];

export const ChaosGauntletCard: React.FC = () => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
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

  const [showModal, setShowModal] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Catalog State
  const [catalog, setCatalog] = useState<SupabaseChaosGem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<GenreType>(activeGenre || 'All');
  const [selectedTargetSlotId, setSelectedTargetSlotId] = useState<string>('finger_1');

  // Confirmation Modal State for Destroying on Removal
  const [confirmRemovalSlotId, setConfirmRemovalSlotId] = useState<string | null>(null);

  // Status/Toast Feedback Message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  // Fetch catalog on modal open
  useEffect(() => {
    if (showModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getChaosGems()
        .then((data) => {
          setCatalog(data);
        })
        .catch((err) => {
          console.error('[ChaosGauntletCard] Failed to load chaos gems catalog:', err);
        })
        .finally(() => {
          setIsLoadingCatalog(false);
        });
    }
  }, [showModal]);

  // Filter Catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((gem) => {
      // 1. Genre match
      const genreOk =
        selectedGenreFilter === 'All' ? true : matchesGenre(gem.genres, selectedGenreFilter);
      if (!genreOk) return false;

      // 2. Search query match
      if (!catalogSearchQuery.trim()) return true;
      const q = catalogSearchQuery.toLowerCase().trim();
      return (
        gem.name.toLowerCase().includes(q) ||
        (gem.effect && gem.effect.toLowerCase().includes(q))
      );
    });
  }, [catalog, selectedGenreFilter, catalogSearchQuery]);

  // Handle Socketing a Gem into a Specific Slot
  const handleEquipGem = (targetSlotId: string, gem: SupabaseChaosGem) => {
    const newGem: ChaosGemItem = {
      id: gem.id,
      name: gem.name,
      action: gem.action || 'F',
      usage: 3,
      max_usage: 3,
      effect: gem.effect,
      genres: gem.genres,
      checked: [false, false, false],
    };

    updateActiveSheetData((prev) => {
      const currentSlots = gauntletSlots.map((s) => ({ ...s }));
      const targetIdx = currentSlots.findIndex((s) => s.slot_id === targetSlotId);
      if (targetIdx !== -1) {
        currentSlots[targetIdx] = {
          ...currentSlots[targetIdx],
          gem: newGem,
        };
      }
      return { ...prev, chaos_gauntlet_slots: currentSlots };
    });

    saveActiveCharacter();
  };

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
    showToast(`💥 Removed and shattered '${gemName}'.`, 'warning');
  };

  const currentCharges = activeCharacter?.sheet_data?.charges ?? activeCharacter?.sheet_data?.sparks ?? 0;
  const isSparkReady = currentCharges >= 5 || Boolean(activeCharacter?.sheet_data?.is_sparked);
  const activeSelectedSlot = gauntletSlots.find((s) => s.slot_id === selectedTargetSlotId);
  const activeSelectedMeta = SLOT_METADATA.find((m) => m.slot_id === selectedTargetSlotId);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex flex-col gap-2.5 transition-all shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">💎</span>
          <h3 className="font-outfit font-bold text-sm tracking-widest text-violet-300 uppercase">
            Chaos Gauntlet
          </h3>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block">
            (1 Free Action/Rnd)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Manage Gauntlet Button */}
          <button
            type="button"
            onClick={() => setShowModal(!showModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
              showModal
                ? 'bg-violet-600/30 text-violet-200 border-violet-400 shadow-violet-500/30'
                : 'bg-violet-950/40 hover:bg-violet-900/50 border-violet-500/30 text-violet-300'
            }`}
            title="Open Chaos Gauntlet Manager to socket or remove gems"
          >
            <span className="font-outfit font-bold">Manage</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                equippedGemsCount > 0
                  ? 'bg-violet-900/80 text-violet-200 border-violet-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              {equippedGemsCount}/6
            </span>
            {showModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
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

      {/* --- TABLE-LIKE SLOTS CONTAINER (ONLY OCCUPIED SLOTS) --- */}
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

                {/* 5. Spark Action (Mega Slot Only) */}
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
        <div className="py-2 px-3 bg-slate-950/40 rounded-xl border border-slate-850 text-center text-xs text-slate-500 italic">
          No Chaos Gems currently socketed. Click <span className="text-violet-300 font-semibold not-italic">Manage</span> to socket gems.
        </div>
      )}

      {/* --- 2-COLUMN MASTER SPLIT-PANE MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[88vh] max-h-[700px] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Modal Top Bar */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-500/30 text-violet-300 flex items-center justify-center shadow-inner">
                  <span className="text-lg leading-none">💎</span>
                </div>
                <div>
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    Chaos Gauntlet Manager
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Socket volatile Chaos Gems into the 5 Finger conduits or Wrist Mega Slot. (Free Action • 1/Rnd • Destroyed at 0 uses)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toast Feedback Notification */}
            {toastMessage && (
              <div
                className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b animate-fadeIn ${
                  toastMessage.type === 'success'
                    ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
                    : toastMessage.type === 'warning'
                    ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
                    : 'bg-slate-900 text-slate-200 border-slate-700'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{toastMessage.text}</span>
              </div>
            )}

            {/* 2-COLUMN SPLIT-PANE BODY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
              
              {/* --- LEFT COLUMN: SOCKET SELECTOR & ACTIVE SLOT INSPECTOR --- */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner gap-2.5">
                {/* Pane Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-outfit font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                      Active Sockets ({equippedGemsCount}/6)
                    </span>
                  </div>
                </div>

                {/* 6-SLOT SELECTOR RIBBON */}
                <div className="flex flex-col gap-1 shrink-0 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-inner">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    🎯 Select Target Conduit:
                  </span>
                  <div className="grid grid-cols-3 gap-1 mt-0.5">
                    {SLOT_METADATA.map((meta) => {
                      const isSelected = selectedTargetSlotId === meta.slot_id;
                      const slotObj = gauntletSlots.find((s) => s.slot_id === meta.slot_id);
                      const isOccupied = Boolean(slotObj?.gem);
                      const isWrist = meta.slot_type === 'wrist';

                      return (
                        <button
                          key={meta.slot_id}
                          type="button"
                          onClick={() => setSelectedTargetSlotId(meta.slot_id)}
                          className={`py-1.5 px-1 text-[11px] rounded-lg border transition-all flex flex-col items-center justify-center cursor-pointer ${
                            isWrist
                              ? isOccupied
                                ? 'bg-amber-600 text-white border-amber-400 font-extrabold shadow-sm'
                                : 'bg-slate-950/80 text-amber-300 border-amber-500/30 hover:border-amber-400 hover:bg-slate-900 font-semibold'
                              : isOccupied
                              ? 'bg-slate-800 text-slate-100 border-slate-600 font-bold shadow-sm'
                              : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700 hover:bg-slate-900 font-normal'
                          } ${
                            isSelected
                              ? isWrist
                                ? 'ring-2 ring-amber-300 border-amber-300 shadow-md shadow-amber-950/60'
                                : 'ring-2 ring-cyan-400 border-cyan-300 shadow-md shadow-cyan-950/60'
                              : 'ring-0'
                          }`}
                          title={`Select ${meta.label} (${isOccupied ? 'Occupied 💎' : 'Empty ✨'})`}
                        >
                          <span className="font-outfit font-bold">{meta.slot_number === 6 ? '👑 Mega Slot' : `Slot ${meta.slot_number}`}</span>
                          <span className="text-[9.5px] opacity-80">
                            {isOccupied ? '💎 In Use' : '✨ Empty'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SELECTED SLOT INSPECTOR CARD */}
                <div className="flex-1 overflow-y-auto min-h-0 bg-slate-900/60 rounded-xl border border-slate-800 p-3 flex flex-col justify-between custom-scrollbar">
                  {activeSelectedSlot?.gem ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Slot Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          activeSelectedSlot.slot_type === 'wrist'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-200 border-slate-700'
                        }`}>
                          {activeSelectedMeta?.label}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                          ⚡ Free Action [F]
                        </span>
                      </div>

                      {/* Gem Title & Checkboxes */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-outfit font-bold text-sm text-slate-100 block">
                            💎 {activeSelectedSlot.gem.name}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {(activeSelectedSlot.gem.genres || []).map((g) => (
                              <span key={g} className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 3 Checkboxes */}
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((bIdx) => {
                            const isChecked = !!(activeSelectedSlot.gem?.checked && activeSelectedSlot.gem.checked[bIdx]);
                            return (
                              <input
                                key={bIdx}
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleCheckbox(activeSelectedSlot.slot_id, bIdx)}
                                className={`w-4 h-4 rounded border-slate-600 bg-slate-950 cursor-pointer ${
                                  activeSelectedSlot.slot_type === 'wrist' ? 'accent-amber-400' : 'accent-violet-400'
                                }`}
                              />
                            );
                          })}
                          <span className="text-[11px] font-mono text-slate-400 ml-1">
                            {activeSelectedSlot.gem.usage}/3
                          </span>
                        </div>
                      </div>

                      {/* Clean Read-Only Effect Description */}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                          Effect:
                        </span>
                        <p className="text-xs text-slate-200 font-sans leading-relaxed">
                          {activeSelectedSlot.gem.effect}
                        </p>
                      </div>

                      {/* Inspector Action Controls */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-800 mt-2">
                        {activeSelectedSlot.slot_type === 'wrist' ? (
                          <button
                            type="button"
                            onClick={() => handleSparkActivation(activeSelectedSlot.slot_id)}
                            disabled={!isSparkReady}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
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
                            <Zap className={`w-3.5 h-3.5 ${isSparkReady ? 'text-slate-950 fill-slate-950' : 'text-amber-500/40'}`} />
                            <span>Spark Trigger (5 Charges)</span>
                          </button>
                        ) : <div />}

                        <button
                          type="button"
                          onClick={() => setConfirmRemovalSlotId(activeSelectedSlot.slot_id)}
                          className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          title="Remove and permanently shatter this gem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove & Shatter</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1.5">
                      <Sparkles className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                      <span className="font-semibold text-slate-400 not-italic">
                        {activeSelectedMeta?.label} is currently empty.
                      </span>
                      <span>Select any Chaos Gem from the catalog on the right to socket it into this conduit.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- RIGHT COLUMN: STOCK CHAOS GEMS CATALOG --- */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                {/* Catalog Header & Filters */}
                <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-800/80 shrink-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-outfit font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      📖 Chaos Gems Catalog
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                      {filteredCatalog.length} available
                    </span>
                  </div>

                  {/* Search and Genre Filters */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search gems or effects..."
                        value={catalogSearchQuery}
                        onChange={(e) => setCatalogSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-cyan-500 transition-all placeholder:text-slate-600"
                      />
                    </div>

                    {/* Genre Selector */}
                    <select
                      value={selectedGenreFilter}
                      onChange={(e) => setSelectedGenreFilter(e.target.value as GenreType)}
                      className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-cyan-500 cursor-pointer"
                    >
                      <option value="All">All Genres</option>
                      <option value="Medieval">Medieval</option>
                      <option value="Modern">Modern</option>
                      <option value="SciFi">SciFi</option>
                    </select>
                  </div>
                </div>

                {/* Catalog List */}
                <div className="flex-1 overflow-y-auto min-h-0 mt-2 pr-1 flex flex-col gap-2 custom-scrollbar">
                  {isLoadingCatalog ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      <span className="text-xs">Loading Chaos Gems database...</span>
                    </div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs italic">
                      No Chaos Gems found matching your criteria.
                    </div>
                  ) : (
                    filteredCatalog.map((gem) => {
                      const isOccupiedTarget = Boolean(activeSelectedSlot?.gem);

                      return (
                        <div
                          key={gem.id || gem.name}
                          className="p-2.5 bg-slate-900/80 hover:bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-1.5 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-outfit font-bold text-xs text-slate-100 block group-hover:text-cyan-300 transition-colors">
                                💎 {gem.name}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                {(gem.genres || []).map((g) => (
                                  <span
                                    key={g}
                                    className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-850"
                                  >
                                    {g}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Primary Button: Socket to Active Target Slot */}
                            <button
                              type="button"
                              onClick={() => handleEquipGem(selectedTargetSlotId, gem)}
                              className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                            >
                              <span>
                                {isOccupiedTarget ? `Replace in ${activeSelectedMeta?.pillLabel}` : `Socket into ${activeSelectedMeta?.pillLabel}`}
                              </span>
                            </button>
                          </div>

                          {/* Effect (Clean, Read-Only, Flat text without bright input-like border) */}
                          <p className="text-xs text-slate-300 leading-relaxed font-sans pt-0.5">
                            {gem.effect}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px]">Chaos Gems provide instant tactical surges. 1 Free Action activation allowed per round.</span>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DESTRUCTION WARNING MODAL */}
      {confirmRemovalSlotId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Flame className="w-6 h-6 shrink-0 animate-pulse" />
              <h4 className="font-outfit font-bold text-base text-rose-200 uppercase tracking-wide">
                Permanent Destruction Warning
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-rose-950/20 p-3 rounded-xl border border-rose-500/30">
              Chaos Gems are bound to the gauntlet's energy lattice. <strong>Removing a socketed gem immediately shatters and destroys it forever.</strong> It cannot be recovered or stored in inventory.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemovalSlotId(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 border border-rose-400 shadow-md shadow-rose-950 transition-all cursor-pointer"
              >
                Confirm & Shatter Gem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
