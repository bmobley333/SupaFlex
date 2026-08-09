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
import { InfoTooltip } from '../common/InfoTooltip';

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
    targetLevel: number;
  } | null>(null);

  if (!isOpen || !activeCharacter) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sheetData = activeCharacter.sheet_data || {};
  const level = sheetData.level || 1;
  const moxieDieStr = sheetData.attribute_dice?.moxie || activeCharacter.moxie || 'd8';
  const moxieDieSides = parseDieSides(moxieDieStr);

  // AP Calculation & Vit Bonus Breakdown
  const availableAp = calculateAvailableAp(level, sheetData);
  const apLog: ApLogEntry[] = Array.isArray(sheetData.ap_log) ? sheetData.ap_log : [];
  const vitalityApSpent = apLog.reduce(
    (sum: number, entry: ApLogEntry) => (entry && entry.category === 'Vitality' ? sum + (entry.cost || 0) : sum),
    0
  );
  const totalApVitBonus = vitalityApSpent * 2;

  // Decoupled Base Max Vit vs Total Max Vit
  const baseMaxVit = typeof sheetData.vitality_base_max === 'number'
    ? sheetData.vitality_base_max
    : Math.max(0, (sheetData.vitality_max || activeCharacter.hp || 10) - totalApVitBonus);

  const currentMaxVit = baseMaxVit + totalApVitBonus;
  const currentVit = sheetData.current_vitality ?? currentMaxVit;

  // Multi-Level Roll Queue Engine
  const lastVitRollLevel = typeof sheetData.last_vit_roll_level === 'number' ? sheetData.last_vit_roll_level : 1;
  const pendingLevels: number[] = [];
  for (let lvl = lastVitRollLevel + 1; lvl <= level; lvl++) {
    pendingLevels.push(lvl);
  }

  const isRollDoneThisLevel = pendingLevels.length === 0;
  const targetLevel = pendingLevels[0] || level;

  const targetDiceBracket = getMoxieDiceBracket(targetLevel);
  const baseMaxPossible = 10 + targetDiceBracket * moxieDieSides;
  const totalMaxPossible = baseMaxPossible + totalApVitBonus;

  // Handle Purchasing +2 Max Vit for 1 AP
  const handleBuyVit = () => {
    if (availableAp < 1) {
      showToast('Insufficient AP! Required: 1 AP.');
      return;
    }
    const newTotalMax = currentMaxVit + 2;
    updateActiveSheetData((prev) => ({
      ...prev,
      vitality_base_max: baseMaxVit,
      vitality_max: newTotalMax,
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
      current_vitality: currentMaxVit,
    }));
    saveActiveCharacter();
    showToast('Vitality fully restored to maximum!');
  };

  // Handle Interactive Auto-Roll for Vit Max
  const handleAutoRoll = () => {
    if (isRollDoneThisLevel) {
      showToast(`All level rolls up to Level ${level} are complete!`);
      return;
    }

    const rolls: number[] = [];
    let sum = 0;
    for (let i = 0; i < targetDiceBracket; i++) {
      const roll = Math.floor(Math.random() * moxieDieSides) + 1;
      rolls.push(roll);
      sum += roll;
    }

    const base = 10;
    const rolledBaseTotal = base + sum;
    const previousBaseMax = baseMaxVit;
    const newBaseMax = Math.max(previousBaseMax, rolledBaseTotal);
    const lucked = newBaseMax > previousBaseMax;
    const newTotalMax = newBaseMax + totalApVitBonus;

    setLastRollResult({
      rolls,
      sum,
      base,
      levelBonus: 0,
      total: rolledBaseTotal + totalApVitBonus,
      lucked,
      previousMax: previousBaseMax + totalApVitBonus,
      targetLevel,
    });

    updateActiveSheetData((prev) => ({
      ...prev,
      vitality_base_max: newBaseMax,
      vitality_max: newTotalMax,
      last_vit_roll_level: Math.max(lastVitRollLevel, targetLevel),
      current_vitality: Math.min(newTotalMax, (prev.current_vitality ?? currentMaxVit) + (newTotalMax - currentMaxVit)),
    }));
    saveActiveCharacter();

    if (lucked) {
      showToast(`🎲 Rolled ${rolls.join('+')} (${sum}) for Level ${targetLevel}! Max Vit upgraded to ${newTotalMax}!`);
    } else {
      showToast(`🎲 Level ${targetLevel} Roll: ${rolledBaseTotal} base vs previous ${previousBaseMax} base. Lucking kept higher Max Vit (${newTotalMax}).`);
    }
  };

  // Handle Manual Entry Override for target level
  const handleApplyManualInput = () => {
    if (isRollDoneThisLevel) {
      showToast(`All level rolls up to Level ${level} are complete!`);
      return;
    }

    const val = parseInt(manualInput, 10);
    if (isNaN(val) || val <= 0) {
      showToast('Please enter a valid positive number for Max Vitality roll.');
      return;
    }

    let rolledBase = val;
    if (val > baseMaxPossible && val > totalApVitBonus) {
      rolledBase = val - totalApVitBonus;
    }

    const newBaseMax = Math.max(baseMaxVit, rolledBase);
    const newTotalMax = newBaseMax + totalApVitBonus;

    updateActiveSheetData((prev) => ({
      ...prev,
      vitality_base_max: newBaseMax,
      vitality_max: newTotalMax,
      last_vit_roll_level: Math.max(lastVitRollLevel, targetLevel),
      current_vitality: Math.min(newTotalMax, (prev.current_vitality ?? currentMaxVit) + (newTotalMax - currentMaxVit)),
    }));
    saveActiveCharacter();
    showToast(`Manual roll for Level ${targetLevel} saved! Max Vit updated to ${newTotalMax}.`);
    setManualInput('');
  };

  const levelBrackets = [
    { range: 'Levels 1–3', bracket: 1, text: `10 + 1d(🫀${moxieDieSides})` },
    { range: 'Levels 4–8', bracket: 2, text: `10 + 2d(🫀${moxieDieSides})` },
    { range: 'Levels 9–15', bracket: 3, text: `10 + 3d(🫀${moxieDieSides})` },
    { range: 'Levels 16–24', bracket: 4, text: `10 + 4d(🫀${moxieDieSides})` },
    { range: 'Levels 25+', bracket: 5, text: `10 + 5d(🫀${moxieDieSides})` },
  ];

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

          <div className="flex items-center gap-3">
            {/* Header AP Pill Badge: Used X AP; Available Y AP */}
            <div className="px-3.5 py-1.5 bg-slate-950/80 rounded-full border border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-2 shadow-inner">
              <span className="text-slate-300">Used <span className="text-rose-400 font-extrabold">{vitalityApSpent} AP</span></span>
              <span className="text-slate-600">;</span>
              <span className="text-slate-300">Available <span className="text-emerald-400 font-extrabold">{availableAp} AP</span></span>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl font-bold px-3 py-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 2. Two-Pane Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 overflow-y-auto min-h-0">
          {/* PANE 1 (LEFT): Vit Roll Rules & Level Calculator (md:col-span-7) */}
          <div className="md:col-span-7 flex flex-col gap-5 md:border-r border-slate-800/80 md:pr-6 overflow-y-auto">
            {/* Free Per Level, Vitality Roll Section */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-outfit font-bold text-sm text-amber-400 flex items-center gap-2">
                  <span>🎲</span> Free Per Level, Vitality Roll
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded-full border border-emerald-500/30">
                  AP🧩 Free (0 AP Cost)
                </span>
              </div>

              {/* Formula Table with Active Bracket Highlighting */}
              <div className="space-y-1.5 font-mono text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                {levelBrackets.map((b) => {
                  const isActive = targetDiceBracket === b.bracket;
                  return (
                    <div
                      key={b.range}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition-all ${
                        isActive
                          ? 'bg-amber-950/50 border border-amber-500/50 text-amber-300 font-bold shadow-sm'
                          : 'text-slate-400 border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-sans font-semibold">
                        {isActive && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                        <span>{b.range}:</span>
                      </span>
                      <div className="text-right">
                        <span className={isActive ? 'text-amber-300 font-bold' : 'text-slate-300'}>{b.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-slate-400 text-[11px] italic">
                🍀 Roll a new Vit on level up and keep the higher of your old or new Max Vit.
              </p>
            </div>

            {/* Interactive Level Calculator & Auto-Roll Engine */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-indigo-300 flex items-center gap-2">
                <Dices className="w-4 h-4 text-indigo-400" />
                Level Vit Roll Calculator (Level {targetLevel})
              </h3>

              {/* Clean & Dense Unrolled Levels Status Card */}
              {pendingLevels.length > 1 && (
                <div className="px-3.5 py-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-indigo-300 font-bold font-mono">
                  <span>⚡ Unrolled Levels: {pendingLevels.join(', ')}</span>
                </div>
              )}

              {/* A + B = C Current Max Vit vs Max Possible Vit Grid */}
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Current Max Vit</span>
                  <div className="font-mono font-bold text-xs mt-1 flex items-center justify-center gap-1">
                    <span className="text-slate-300 font-semibold">{baseMaxVit}</span>
                    <span className="text-rose-400 font-semibold">+{totalApVitBonus}</span>
                    <span className="text-emerald-400 font-extrabold text-base ml-0.5">= {currentMaxVit}</span>
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Max Possible Vit</span>
                  <div className="font-mono font-bold text-xs mt-1 flex items-center justify-center gap-1">
                    <span className="text-slate-300 font-semibold">{baseMaxPossible}</span>
                    <span className="text-rose-400 font-semibold">+{totalApVitBonus}</span>
                    <span className="text-amber-400 font-extrabold text-base ml-0.5">= {totalMaxPossible}</span>
                  </div>
                </div>
              </div>

              {/* Manual Entry Section (Positioned Directly Above Auto-Roll Button) */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-300 block">
                    {isRollDoneThisLevel ? 'Manual Max Vit Override' : `Manual Roll Entry (Level ${targetLevel})`}
                  </span>
                  <InfoTooltip text={`Enter physical dice result for Level ${targetLevel}`} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    disabled={isRollDoneThisLevel}
                    placeholder="e.g. 18"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isRollDoneThisLevel && handleApplyManualInput()}
                    className="w-24 bg-slate-900 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 text-center placeholder:text-slate-600/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                  />
                  <button
                    onClick={handleApplyManualInput}
                    disabled={isRollDoneThisLevel}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Set
                  </button>
                </div>
              </div>

              {/* Roll Lock Banner (Image 4) OR Auto-Roll Launcher Button */}
              {isRollDoneThisLevel ? (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 animate-fadeIn shadow-sm">
                  <Check className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                  <span>Level {level} Vit Roll Completed (Unlocks at Level {level + 1})</span>
                </div>
              ) : (
                <button
                  onClick={handleAutoRoll}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-outfit font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.99]"
                >
                  <Dices className="w-5 h-5 animate-bounce" />
                  Auto-Roll Level {targetLevel} Max Vitality
                </button>
              )}

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
                      Level {lastRollResult.targetLevel} Roll: {targetDiceBracket}{moxieDieStr} [{lastRollResult.rolls.join(', ')}] = {lastRollResult.sum}
                    </span>
                    <span className="font-mono text-sm">Total: {lastRollResult.total}</span>
                  </div>
                  <div className="text-[11px] opacity-90 font-mono">
                    Breakdown: 10 (Base) + {lastRollResult.sum} (Dice) + {totalApVitBonus} (AP Vit Bonus) = {lastRollResult.total}
                  </div>
                  {lastRollResult.lucked ? (
                    <div className="font-bold text-emerald-400 flex items-center gap-1 pt-1 border-t border-emerald-500/30">
                      <Check className="w-4 h-4" /> Higher roll! Max Vitality upgraded to {lastRollResult.total}!
                    </div>
                  ) : (
                    <div className="text-slate-400 italic pt-1 border-t border-slate-800">
                      Lucking rule kept your higher previous Max Vit ({lastRollResult.previousMax}).
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PANE 2 (RIGHT): AP Vitality Boosts & Healing (md:col-span-5) */}
          <div className="md:col-span-5 flex flex-col gap-5 overflow-y-auto">
            {/* AP-Purchased Vitality Boost Card (De-duplicated & Top-Action Order) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-rose-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-rose-400" />
                AP Vitality Boosts
              </h3>

              {/* Top Action Row */}
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
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer shrink-0 active:scale-95"
                >
                  Buy +2 Vit (1 AP)
                </button>
              </div>

              {/* De-duplicated Breakdown Panel */}
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Base Vit (Before AP):</span>
                  <strong className="text-slate-100">{baseMaxVit} Vit</strong>
                </div>
                <div className="flex items-center justify-between text-rose-300">
                  <span>AP Vit Bonus:</span>
                  <strong className="text-rose-400">+{totalApVitBonus} Vit ({vitalityApSpent} AP spent)</strong>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold text-sm">
                  <span className="text-emerald-300">Final Max Vit:</span>
                  <span className="text-emerald-400 font-extrabold">{currentMaxVit} Vit</span>
                </div>
              </div>
            </div>

            {/* Healing Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-emerald-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Healing
              </h3>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Current Vitality</span>
                  <span className="font-mono text-base font-bold text-emerald-400">
                    {currentVit} / {currentMaxVit}
                  </span>
                </div>

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
