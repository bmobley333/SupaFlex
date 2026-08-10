// src/components/modals/FocusManagerModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Target,
  Sparkles,
  ArrowDown,
  ArrowUp,
  RotateCcw,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { DieRating, calculateAvailableAp } from '../../types/game';
import { DIE_LADDER, stepDownDie, stepUpDie } from '../../lib/dice';
import { CardHelpButton } from '../common/CardHelpButton';

interface FocusManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FOCUS_STEP_UP_COSTS: Record<string, { next: DieRating; cost: number; levelGate: number }> = {
  d4: { next: 'd6', cost: 2, levelGate: 1 },
  d6: { next: 'd8', cost: 4, levelGate: 15 },
  d8: { next: 'd10', cost: 6, levelGate: 35 },
  d10: { next: 'd12', cost: 8, levelGate: 60 },
};

const normalizeDie = (die?: string): DieRating => {
  if (!die) return 'd4';
  const clean = die.toString().trim().toLowerCase();
  if (clean === 'exhausted') return 'Exhausted';
  if (clean.startsWith('d')) return clean as DieRating;
  return `d${clean}` as DieRating;
};

const dieToNum = (die: DieRating): string => {
  if (die === 'Exhausted') return '0';
  return die.replace('d', '');
};

export const FocusManagerModal: React.FC<FocusManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    activeCharacter,
    updateActiveSheetData,
    saveActiveCharacter,
    recordApExpenditure,
  } = useCharacterStore();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !activeCharacter) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sheetData: any = activeCharacter.sheet_data || {};
  const level = sheetData.level || 1;
  const availableAp = calculateAvailableAp(level, sheetData);

  const rawFocusCurrent = sheetData.focus_die_current || 'd4';
  const rawFocusMax = sheetData.focus_die_max || 'd4';

  const focusCurrentDie = normalizeDie(rawFocusCurrent);
  const focusMaxDie = normalizeDie(rawFocusMax);

  // Filter available die options for current setting (GUARDRAIL: No numbers past purchased max)
  const maxIdx = DIE_LADDER.indexOf(focusMaxDie === 'Exhausted' ? 'd4' : focusMaxDie);
  const allowedDieOptions: DieRating[] = DIE_LADDER.filter((_, idx) => idx <= (maxIdx !== -1 ? maxIdx : 0));

  // Reset Focus to Purchased Max
  const handleResetFocus = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_current: focusMaxDie,
    }));
    saveActiveCharacter();
    showToast(`Focus reset to purchased max (${dieToNum(focusMaxDie)})!`);
  };

  // Step Down Focus Die
  const handleStepDown = () => {
    const nextDie = stepDownDie(focusCurrentDie);
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_current: nextDie,
    }));
    saveActiveCharacter();
    showToast(`Focus stepped down to ${nextDie === 'Exhausted' ? 'Exhausted (0)' : nextDie}!`);
  };

  // Step Up Focus Die (up to purchased max)
  const handleStepUp = () => {
    const nextDie = stepUpDie(focusCurrentDie, focusMaxDie);
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_current: nextDie,
    }));
    saveActiveCharacter();
    showToast(`Focus stepped up to ${nextDie}!`);
  };

  // Directly Set Current Focus Die via Dropdown
  const handleSetCurrentDie = (newDie: DieRating) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_current: newDie,
    }));
    saveActiveCharacter();
    showToast(`Current Focus Die set to ${newDie}!`);
  };

  // AP Step-Up Focus Die Ceiling Purchase
  const handleFocusStepUpAp = () => {
    const costInfo = FOCUS_STEP_UP_COSTS[focusMaxDie];
    if (!costInfo) {
      showToast('Focus Die is already at maximum ceiling (d12)!');
      return;
    }

    if (level < costInfo.levelGate) {
      showToast(`Level Gate Locked! Required: Level ${costInfo.levelGate}+ (Current: Level ${level}).`);
      return;
    }

    if (availableAp < costInfo.cost) {
      showToast(`Insufficient AP! Required: ${costInfo.cost} AP (Available: ${availableAp} AP).`);
      return;
    }

    const nextMax = costInfo.next;

    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_max: nextMax,
      focus_die_current: nextMax,
    }));

    recordApExpenditure(
      costInfo.cost,
      'Focus Die',
      `Upgraded Focus Die Ceiling from ${focusMaxDie} ➔ ${nextMax}`,
      1,
      'Focus Manager'
    );

    saveActiveCharacter();
    showToast(`Upgraded Focus Die Ceiling to ${nextMax}!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/60 overflow-hidden flex flex-col"
      >
        {/* Toast Alert Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-purple-600 text-white text-xs font-bold font-outfit rounded-xl shadow-lg border border-purple-400 animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* 🖼️ HEADER STANDARD */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-2xl shrink-0">
              🎯
            </div>
            <div>
              <h2 className="text-xl font-bold font-outfit text-purple-400 flex items-center gap-2">
                Focus Manager
                <CardHelpButton ruleKey="focus.basics" />
              </h2>
              <p className="text-xs text-slate-400">
                Manage Focus Die status, spend/refill steps, full rest resets, & AP upgrades
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 📐 TWO-PANE GRID ARCHITECTURE */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* 📜 PANE 1 (LEFT - md:col-span-7): Focus Resource Deck & Quick Actions */}
          <div className="md:col-span-7 p-6 border-b md:border-b-0 md:border-r border-slate-800/80 overflow-y-auto space-y-5 bg-slate-900/40">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-purple-400" />
                Current Focus Status Deck
              </span>
              <span className="text-[11px] font-mono text-purple-300/80 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-md">
                Purchased Max: {dieToNum(focusMaxDie)} ({focusMaxDie})
              </span>
            </div>

            {/* Main Focus Rating Display Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/60 via-slate-950 to-slate-900 border border-purple-500/30 flex items-center justify-between shadow-xl">
              <div className="space-y-1">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  Active Focus Die
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-purple-100">
                    {dieToNum(focusCurrentDie)}
                  </span>
                  <span className="text-sm font-mono font-semibold text-purple-300">
                    ({focusCurrentDie})
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Resets to <strong className="text-purple-300">{focusMaxDie}</strong> upon Full Rest
                </p>
              </div>

              {/* Reset Focus Button */}
              <button
                onClick={handleResetFocus}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-outfit font-bold text-xs border border-purple-400/40 transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                title="Reset Focus Die to purchased maximum"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Focus</span>
              </button>
            </div>

            {/* Step Controls & Dropdown Section */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold font-outfit text-slate-200 uppercase tracking-wider">
                Direct Focus Controls
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStepDown}
                  className="p-3 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 active:bg-purple-950 text-purple-200 border border-purple-800/80 font-outfit font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  title="Spend / Step-Down 1 Focus Rating"
                >
                  <ArrowDown className="w-4 h-4 text-purple-400" />
                  <span>Spend / Step-Down</span>
                </button>

                <button
                  onClick={handleStepUp}
                  className="p-3 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 active:bg-purple-950 text-purple-200 border border-purple-800/80 font-outfit font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  title="Flood / Refill +1 Focus Rating (Up to Max)"
                >
                  <ArrowUp className="w-4 h-4 text-purple-400" />
                  <span>Flood / Refill</span>
                </button>
              </div>

              {/* Guardrailed Current Focus Die Selector */}
              <div className="pt-2 border-t border-slate-850 flex items-center justify-between gap-3">
                <label className="text-xs font-bold text-slate-300 font-outfit flex items-center gap-1.5">
                  <span>Set Current Focus Rating:</span>
                </label>

                <select
                  value={focusCurrentDie}
                  onChange={(e) => handleSetCurrentDie(e.target.value as DieRating)}
                  className="bg-slate-900 text-purple-200 font-mono font-bold text-xs px-3 py-1.5 rounded-lg border border-purple-700/60 outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="Exhausted" className="bg-slate-900 text-slate-400">
                    0 (Exhausted)
                  </option>
                  {allowedDieOptions.map((die) => (
                    <option key={die} value={die} className="bg-slate-900 text-slate-100">
                      {dieToNum(die)} ({die})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 🎛️ PANE 2 (RIGHT - md:col-span-5): AP Focus Die Upgrades */}
          <div className="md:col-span-5 p-6 overflow-y-auto space-y-5 bg-slate-900/90 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  AP Focus Die Upgrades
                </span>
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                  {availableAp} AP Available
                </span>
              </div>

              {/* AP Step-Up Card */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-outfit font-bold text-slate-100 text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Focus Die Step-Up
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Current Ceiling: <strong className="text-amber-300">{focusMaxDie}</strong>
                    </p>
                  </div>

                  {(() => {
                    const costInfo = FOCUS_STEP_UP_COSTS[focusMaxDie];
                    if (!costInfo) {
                      return (
                        <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 font-bold text-xs border border-slate-700/50">
                          Max Ceiling (d12)
                        </span>
                      );
                    }
                    const isLevelLocked = level < costInfo.levelGate;
                    const isApLocked = !isLevelLocked && availableAp < costInfo.cost;

                    if (isLevelLocked) {
                      return (
                        <button
                          disabled
                          onClick={handleFocusStepUpAp}
                          className="px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/60 text-slate-400 font-outfit font-bold text-xs cursor-not-allowed opacity-80"
                          title={`Level Gate Locked! Requires Level ${costInfo.levelGate}+ (Current: Level ${level}).`}
                        >
                          🔒 Locked (Lvl {costInfo.levelGate}+)
                        </button>
                      );
                    }

                    if (isApLocked) {
                      return (
                        <button
                          onClick={handleFocusStepUpAp}
                          className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-amber-900/60 text-amber-500/90 hover:text-amber-400 font-outfit font-bold text-xs cursor-pointer transition-colors"
                          title={`Insufficient AP! Requires ${costInfo.cost} AP (Available: ${availableAp} AP).`}
                        >
                          Need {costInfo.cost} AP
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={handleFocusStepUpAp}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer active:scale-95"
                      >
                        Upgrade ({costInfo.cost} AP)
                      </button>
                    );
                  })()}
                </div>

                {/* 4-Card Progression Visual Ladder */}
                <div className="grid grid-cols-2 gap-2 text-center text-[11px] pt-1">
                  {/* Tier 1: d4 -> d6 (Lvl 1+, 2 AP) */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      focusMaxDie === 'd4'
                        ? level >= 1
                          ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold shadow-sm shadow-amber-950'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-75'
                        : 'bg-slate-950/80 border-slate-850 text-slate-500'
                    }`}
                  >
                    <strong className="block text-slate-200">d4 ➔ d6</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {focusMaxDie === 'd4' && level < 1 ? '🔒 Lvl 1+' : 'Lvl 1+'} | 2 AP
                    </div>
                  </div>

                  {/* Tier 2: d6 -> d8 (Lvl 15+, 4 AP) */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      focusMaxDie === 'd6'
                        ? level >= 15
                          ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold shadow-sm shadow-amber-950'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-75'
                        : 'bg-slate-950/80 border-slate-850 text-slate-500'
                    }`}
                  >
                    <strong className="block text-slate-200">d6 ➔ d8</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {focusMaxDie === 'd6' && level < 15 ? '🔒 Lvl 15+' : 'Lvl 15+'} | 4 AP
                    </div>
                  </div>

                  {/* Tier 3: d8 -> d10 (Lvl 35+, 6 AP) */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      focusMaxDie === 'd8'
                        ? level >= 35
                          ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold shadow-sm shadow-amber-950'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-75'
                        : 'bg-slate-950/80 border-slate-850 text-slate-500'
                    }`}
                  >
                    <strong className="block text-slate-200">d8 ➔ d10</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {focusMaxDie === 'd8' && level < 35 ? '🔒 Lvl 35+' : 'Lvl 35+'} | 6 AP
                    </div>
                  </div>

                  {/* Tier 4: d10 -> d12 (Lvl 60+, 8 AP) */}
                  <div
                    className={`p-2.5 rounded-xl border transition-all ${
                      focusMaxDie === 'd10'
                        ? level >= 60
                          ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold shadow-sm shadow-amber-950'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-75'
                        : 'bg-slate-950/80 border-slate-850 text-slate-500'
                    }`}
                  >
                    <strong className="block text-slate-200">d10 ➔ d12</strong>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {focusMaxDie === 'd10' && level < 60 ? '🔒 Lvl 60+' : 'Lvl 60+'} | 8 AP
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🦶 FOOTER CONTEXT BAR & STANDARDIZED DONE BUTTON */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-outfit font-bold text-slate-200">{activeCharacter.name}</span>
            <span>•</span>
            <span className="font-mono text-purple-300">Level {level}</span>
            <span>•</span>
            <span className="font-mono text-amber-300">{availableAp} AP Available</span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
