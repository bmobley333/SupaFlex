// src/components/modals/VitalityManagerModal.tsx
import React, { useState } from 'react';
import {
  X,
  Heart,
  Dices,
  Sparkles,
  TrendingUp,
  Check,
  Zap,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ApLogEntry, calculateAvailableAp } from '../../types/game';

interface VitalityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Calculates Moxie Dice Bracket (N) based on character Level
 * Levels 1–3: 1d
 * Levels 4–8: 2d
 * Levels 9–15: 3d
 * Levels 16–24: 4d
 * Levels 25+: 5d (HARD CAP)
 */
const getMoxieDiceBracket = (level: number): number => {
  if (level <= 3) return 1;
  if (level <= 8) return 2;
  if (level <= 15) return 3;
  if (level <= 24) return 4;
  return 5;
};

/**
 * Extracts numeric die size from die string (e.g. 'd8' -> 8, 'd6' -> 6)
 */
const parseDieSides = (dieStr: string | null | undefined): number => {
  if (!dieStr) return 8; // Default d8
  const match = dieStr.match(/d(\d+)/i);
  return match ? parseInt(match[1], 10) : 8;
};

export const VitalityManagerModal: React.FC<VitalityManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    activeCharacter,
    updateActiveSheetData,
    saveActiveCharacter,
    recordApExpenditure,
  } = useCharacterStore();

  const [manualInput, setManualInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastRollResult, setLastRollResult] = useState<{
    rolls: number[];
    sum: number;
    base: number;
    levelBonus: number;
    total: number;
    lucked: boolean;
    previousMax: number;
  } | null>(null);

  if (!isOpen || !activeCharacter) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sheetData = activeCharacter.sheet_data || {};
  const currentMaxVit = sheetData.vitality_max || activeCharacter.hp || 10;
  const currentVit = sheetData.current_vitality ?? currentMaxVit;
  const level = sheetData.level || 1;
  const moxieDieStr = sheetData.attribute_dice?.moxie || activeCharacter.moxie || 'd8';
  const moxieDieSides = parseDieSides(moxieDieStr);
  const diceBracket = getMoxieDiceBracket(level);

  // AP Calculation
  const availableAp = calculateAvailableAp(level, sheetData);
  const apLog: ApLogEntry[] = Array.isArray(sheetData.ap_log) ? sheetData.ap_log : [];
  const vitalityApSpent = apLog.reduce(
    (sum: number, entry: ApLogEntry) => (entry && entry.category === 'Vitality' ? sum + (entry.cost || 0) : sum),
    0
  );
  const totalApVitBonus = vitalityApSpent * 2;

  // Handle Purchasing +2 Max Vit for 1 AP
  const handleBuyVit = () => {
    if (availableAp < 1) {
      showToast('Insufficient AP! Required: 1 AP.');
      return;
    }
    updateActiveSheetData((prev) => ({
      ...prev,
      vitality_max: (prev.vitality_max || 10) + 2,
      current_vitality: (prev.current_vitality || 10) + 2,
    }));
    recordApExpenditure(1, 'Vitality', 'Purchased +2 Max Vitality', 1, 'Vitality Manager');
    saveActiveCharacter();
    showToast('Gained +2 Max Vitality!');
  };

  // Handle Full Heal Action
  const handleFullHeal = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      current_vitality: prev.vitality_max || 10,
    }));
    saveActiveCharacter();
    showToast('Vitality fully restored to maximum!');
  };

  // Handle Interactive Auto-Roll for Vit Max
  const handleAutoRoll = () => {
    const rolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < diceBracket; i++) {
      const roll = Math.floor(Math.random() * moxieDieSides) + 1;
      rolls.push(roll);
      sum += roll;
    }

    const base = 10;
    const levelBonus = level * 2;
    const rolledTotal = base + sum + levelBonus;
    const previousMax = currentMaxVit;
    const newMax = Math.max(previousMax, rolledTotal);
    const lucked = newMax > previousMax;

    setLastRollResult({
      rolls,
      sum,
      base,
      levelBonus,
      total: rolledTotal,
      lucked,
      previousMax,
    });

    if (lucked) {
      updateActiveSheetData((prev) => ({
        ...prev,
        vitality_max: newMax,
        current_vitality: (prev.current_vitality ?? previousMax) === previousMax ? newMax : (prev.current_vitality ?? previousMax),
      }));
      saveActiveCharacter();
      showToast(`🎲 Rolled ${rolls.join('+')} (${sum})! Max Vitality increased to ${newMax}!`);
    } else {
      showToast(`🎲 Rolled ${rolledTotal} vs Current ${previousMax}. Lucking kept your higher Max Vit (${previousMax}).`);
    }
  };

  // Handle Manual Entry Override
  const handleApplyManualInput = () => {
    const val = parseInt(manualInput, 10);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid positive number for Max Vitality.');
      return;
    }
    updateActiveSheetData((prev) => ({
      ...prev,
      vitality_max: val,
    }));
    saveActiveCharacter();
    showToast(`Max Vitality manually set to ${val}.`);
    setManualInput('');
  };

  return (
    <div
      role="dialog"
      aria-label="Vitality Manager"
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn relative">
        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl z-50 animate-fadeIn flex items-center gap-2 border border-indigo-400">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 1. Header Standard */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-400 text-2xl shadow-inner">
              ❤️
            </div>
            <div>
              <h2 className="text-xl font-bold font-outfit text-rose-400 flex items-center gap-2">
                Vitality Manager
              </h2>
              <p className="text-xs text-slate-400">
                Manage Max Vitality Rolls, AP Boosts, and Vitality Restoration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-3 py-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 2. Two-Pane Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 overflow-y-auto min-h-0">
          {/* PANE 1 (LEFT): Vit Roll Rules & Level Calculator (md:col-span-7) */}
          <div className="md:col-span-7 flex flex-col gap-5 md:border-r border-slate-800/80 md:pr-6 overflow-y-auto">
            {/* Step 2 Read-Only Rules Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-outfit font-bold text-sm text-amber-400 flex items-center gap-2">
                  <span>🎲</span> Step 2 — Vit❤️ Roll
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-500/30">
                  AP🧩 Free (0 AP Cost)
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <p className="font-semibold text-slate-200">
                  <strong>Vit❤️ Max Roll Protocol:</strong> On each Level⭐, roll for new maximum Vit❤️ using your Moxie🫀 rating.
                </p>

                {/* Formula Highlight Box */}
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-amber-300 text-center">
                  Max Vit = 10 + N × d(Moxie🫀) + (Level × 2)
                </div>

                {/* Dice Bracket Table */}
                <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-2.5 space-y-1 text-[11px]">
                  <div className="font-bold text-slate-400 border-b border-slate-800 pb-1 mb-1">
                    Moxie Dice Bracket (N) (Capped at 5d):
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300 font-mono">
                    <div>Levels 1–3: <span className="text-amber-400">1d(Moxie)</span></div>
                    <div>Levels 4–8: <span className="text-amber-400">2d(Moxie)</span></div>
                    <div>Levels 9–15: <span className="text-amber-400">3d(Moxie)</span></div>
                    <div>Levels 16–24: <span className="text-amber-400">4d(Moxie)</span></div>
                    <div className="col-span-2">Levels 25+: <span className="text-amber-400 font-bold">5d(Moxie)</span> <span className="text-[10px] text-rose-400">(HARD CAP — Prevents late-game HP bloat)</span></div>
                  </div>
                </div>

                <p className="text-slate-400 text-[11px] italic">
                  🍀 <strong>"Lucking" Max Vit❤️:</strong> Roll a new number and keep the better of the old Vit❤️ or the new Vit❤️. If your Moxie🫀 rating increases, use the upgraded Moxie die in future rolls.
                </p>
              </div>
            </div>

            {/* Interactive Level Calculator & Auto-Roll Engine */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-indigo-300 flex items-center gap-2">
                <Dices className="w-4 h-4 text-indigo-400" />
                Level Vit Roll Calculator (Level {level})
              </h3>

              {/* Current Character Bracket Specs */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Character Level</span>
                  <span className="font-mono font-bold text-slate-100 text-sm">{level}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Moxie Rating</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">🫀 {moxieDieStr}</span>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Roll Formula</span>
                  <span className="font-mono font-bold text-amber-400 text-xs">10 + {diceBracket}{moxieDieStr} + {level * 2}</span>
                </div>
              </div>

              {/* Auto-Roll Launcher Button */}
              <button
                onClick={handleAutoRoll}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-outfit font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.99]"
              >
                <Dices className="w-5 h-5 animate-bounce" />
                Auto-Roll Level {level} Max Vitality
              </button>

              {/* Roll Result Display Banner */}
              {lastRollResult && (
                <div className={`p-3 rounded-xl border flex flex-col gap-1 text-xs animate-fadeIn ${
                  lastRollResult.lucked
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Roll Results: {diceBracket}{moxieDieStr} [{lastRollResult.rolls.join(', ')}] = {lastRollResult.sum}
                    </span>
                    <span className="font-mono text-sm">Total: {lastRollResult.total}</span>
                  </div>
                  <div className="text-[11px] opacity-90 font-mono">
                    Breakdown: 10 (Base) + {lastRollResult.sum} (Dice) + {lastRollResult.levelBonus} (Level Bonus) = {lastRollResult.total}
                  </div>
                  {lastRollResult.lucked ? (
                    <div className="font-bold text-emerald-400 flex items-center gap-1 pt-1 border-t border-emerald-500/30">
                      <Check className="w-4 h-4" /> Higher roll! Max Vitality upgraded from {lastRollResult.previousMax} to {lastRollResult.total}!
                    </div>
                  ) : (
                    <div className="text-slate-400 italic pt-1 border-t border-slate-800">
                      Lucking rule kept your higher previous Max Vit ({lastRollResult.previousMax}).
                    </div>
                  )}
                </div>
              )}

              {/* Manual Override Section */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-300 block">Manual Max Vit Override</span>
                  <span className="text-[10px] text-slate-500">Directly set custom Max Vitality</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    placeholder={`Current: ${currentMaxVit}`}
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyManualInput()}
                    className="w-24 bg-slate-900 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={handleApplyManualInput}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-all cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PANE 2 (RIGHT): AP Vitality Boosts & Restoration (md:col-span-5) */}
          <div className="md:col-span-5 flex flex-col gap-5 overflow-y-auto">
            {/* AP-Purchased Vitality Boost Card (Image 1 Area) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-rose-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-rose-400" />
                AP Vitality Boosts
              </h3>

              {/* TOTAL +Vit Gained Running Total Read-Only Box (Image 1 Header) */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between text-xs">
                <span className="font-bold text-rose-300 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" />
                  TOTAL +Vit Gained:
                </span>
                <span className="font-black text-rose-300 font-mono text-xs px-2.5 py-1 bg-rose-950 rounded-lg border border-rose-500/40">
                  +{totalApVitBonus} Max Vit ({vitalityApSpent} AP spent)
                </span>
              </div>

              {/* Purchase Card (Image 1 Body) */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-outfit font-bold text-slate-100 text-xs flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    Gain +2 Max Vitality
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Permanently increases your maximum Vit by +2.</p>
                </div>
                <button
                  onClick={handleBuyVit}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer shrink-0"
                >
                  Buy +2 Vit (1 AP)
                </button>
              </div>
            </div>

            {/* Vitality Restoration / Full Heal Card (Image 2 Area) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-emerald-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Vitality Restoration
              </h3>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Vitality</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {currentVit} / {currentMaxVit}
                  </span>
                </div>

                {/* Relocated Image 2 Button: Full Heal 💖 */}
                <button
                  onClick={handleFullHeal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-outfit font-bold rounded-xl border border-emerald-400/40 flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-95"
                  title="Instantly restore Vitality to maximum"
                >
                  <span>Full Heal</span>
                  <span className="text-sm">💖✨</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Footer Context Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-bold text-slate-200">Hero: {activeCharacter.name}</span>
            <span>Level {level}</span>
            <span className="text-amber-400 font-mono font-bold">AP Available: {availableAp}</span>
            <span className="text-rose-400 font-mono">Max Vit: {currentMaxVit}</span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
