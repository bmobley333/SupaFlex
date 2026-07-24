// src/components/header/PersistentHeaderHUD.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Zap, ChevronDown, ChevronUp, Sparkles, X, Plus, Minus } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey, DieRating } from '../../types/game';
import { stepDownDie, stepUpDie } from '../../lib/dice';

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  abbr: string;
  emoji: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'magic', name: 'Magic', abbr: 'Magic', emoji: '✨' },
  { key: 'might', name: 'Might', abbr: 'Might', emoji: '💪' },
  { key: 'mind', name: 'Mind', abbr: 'Mind', emoji: '👁️' },
  { key: 'motion', name: 'Motion', abbr: 'Motion', emoji: '🏃' },
  { key: 'moxie', name: 'Moxie', abbr: 'Moxie', emoji: '🫀' },
];

const DIE_OPTIONS: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

const dieToNum = (die?: string): string => {
  if (!die) return '4';
  return die.replace(/^d/i, '');
};

export const PersistentHeaderHUD: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, spendMeta, resetSparks } = useCharacterStore();
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'attributes' | 'focus' | 'spark' | 'luck'>('none');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDrawer('none');
      }
    };
    if (activeDrawer !== 'none') {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [activeDrawer]);

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
  const dice = sheet?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const focusCurrentDie = sheet?.focus_die_current || 'd4';
  const focusMaxDie = sheet?.focus_die_max || 'd4';
  const focusCurrent = dieToNum(focusCurrentDie);
  const focusMax = dieToNum(focusMaxDie);
  const sparks = sheet?.sparks ?? 0;
  const isCharged = sheet?.is_charged ?? false;
  const luck = sheet?.luck ?? 3;
  const maxLuck = sheet?.max_luck ?? 5;

  const handleFocusStepDown = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_current: stepDownDie(prev.focus_die_current || 'd4'),
    }));
    saveActiveCharacter();
  };

  const handleFocusFlood = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_current: stepUpDie(prev.focus_die_current || 'd4', prev.focus_die_max || 'd4'),
    }));
    saveActiveCharacter();
  };

  const handleFocusMaxChange = (newMax: DieRating) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_max: newMax,
    }));
    saveActiveCharacter();
  };

  const handleAttributeDieChange = (attrKey: AttributeKey, newDie: DieRating) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: {
        ...prev.attribute_dice,
        [attrKey]: newDie,
      },
    }));
    saveActiveCharacter();
  };

  const handleSparkToggle = (index: number) => {
    const isFilled = index < sparks;
    let newSparks = index + 1;
    if (isFilled && index === sparks - 1) {
      newSparks = index;
    }
    const charged = newSparks === 5;
    updateActiveSheetData((prev) => ({
      ...prev,
      sparks: newSparks,
      is_charged: charged,
    }));
    saveActiveCharacter();
  };

  const handleLuckChange = (delta: number) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      luck: Math.max(0, Math.min(maxLuck, (prev.luck ?? 3) + delta)),
    }));
    saveActiveCharacter();
  };

  const toggleDrawer = (target: 'attributes' | 'focus' | 'spark' | 'luck') => {
    setActiveDrawer((prev) => (prev === target ? 'none' : target));
  };

  return (
    <div className="w-full flex items-center justify-between gap-4 flex-wrap" ref={containerRef}>
      {/* Left Zone: Prominent Attributes Engine Ribbon */}
      <div className="relative">
        <div
          onClick={() => toggleDrawer('attributes')}
          className={`flex items-center gap-3 bg-slate-950 px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-lg ${
            activeDrawer === 'attributes'
              ? 'border-indigo-400 shadow-indigo-500/30 bg-slate-900'
              : 'border-indigo-500/40 hover:border-indigo-400/60 shadow-indigo-950/40'
          }`}
          title="Click to configure attribute die ratings"
        >
          {ATTRIBUTES.map((attr, idx) => {
            const dieVal = dieToNum(dice[attr.key]);
            return (
              <React.Fragment key={attr.key}>
                {idx > 0 && <span className="text-slate-800 font-bold text-sm">|</span>}
                <div className="flex items-center gap-1.5 font-outfit">
                  <span className="font-mono font-black text-xs text-indigo-300 tracking-wider">
                    {attr.abbr}
                  </span>
                  <span className="text-base">{attr.emoji}</span>
                  <span className="font-mono font-extrabold text-slate-100 text-sm">
                    {dieVal}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
          <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-1" />
        </div>

        {/* 🔮 Attributes Die Rating Configuration Popover */}
        {activeDrawer === 'attributes' && (
          <div className="absolute top-full left-0 mt-2 z-50 w-80 p-3.5 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
              <h4 className="font-outfit font-bold text-xs tracking-wider text-indigo-300 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Attribute Die Ratings
              </h4>
              <button
                onClick={() => setActiveDrawer('none')}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                title="Close popover"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {ATTRIBUTES.map((attr) => {
                const currentDie = dice[attr.key] || 'd4';
                return (
                  <div
                    key={attr.key}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{attr.emoji}</span>
                      <span className="font-outfit font-bold text-xs text-slate-100">{attr.name}</span>
                    </div>

                    <select
                      value={currentDie}
                      onChange={(e) => handleAttributeDieChange(attr.key, e.target.value as DieRating)}
                      className="bg-slate-900 text-indigo-300 font-mono font-extrabold text-xs px-2.5 py-1 rounded-md border border-indigo-500/30 outline-none cursor-pointer focus:border-indigo-400"
                    >
                      {DIE_OPTIONS.map((die) => (
                        <option key={die} value={die} className="bg-slate-900 text-slate-100">
                          {dieToNum(die)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Center Zone: Centered Split-Pill Control Deck (Focus, Spark, Luck) */}
      <div className="flex-1 flex justify-center items-center gap-3 flex-wrap">
        {/* 🎯 Focus Split Pill Container & Floating Popover */}
        <div className="relative">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold transition-all ${
              activeDrawer === 'focus'
                ? 'bg-purple-900/60 border-purple-400 text-purple-100 shadow-sm shadow-purple-500/30'
                : 'bg-purple-950/40 border-purple-500/30 text-purple-200'
            }`}
          >
            <span className="text-purple-400 font-bold">🎯 Focus:</span>
            <span className="font-mono font-extrabold text-purple-100 mr-0.5">{focusCurrent}</span>

            {/* Inline Direct Manipulation Step-Down Button */}
            <button
              onClick={handleFocusStepDown}
              className="p-0.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 rounded border border-purple-800/80 transition-all hover:scale-105"
              title="Spend / Step Down 1 Focus rating"
            >
              <ArrowDown className="w-3 h-3" />
            </button>

            {/* Secondary Zone: Chevron Popover Trigger */}
            <button
              onClick={() => toggleDrawer('focus')}
              className="p-0.5 text-purple-400 hover:text-purple-200 transition-colors ml-0.5"
              title="Click to configure Focus Ladder & Max Rating"
            >
              {activeDrawer === 'focus' ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* 🎯 Focus Absolute Floating Glass Popover Card */}
          {activeDrawer === 'focus' && (
            <div className="absolute top-full left-0 mt-2 z-50 w-72 p-3 bg-slate-900/95 border border-purple-500/40 rounded-xl shadow-2xl shadow-purple-950/60 backdrop-blur-xl text-xs flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5">
                <span className="font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                  🎯 Focus Ladder
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-purple-100 font-extrabold">
                    {focusCurrent} <span className="text-[10px] text-slate-400 font-normal">(Max: {focusMax})</span>
                  </span>
                  <button
                    onClick={() => setActiveDrawer('none')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                    title="Close popover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleFocusStepDown}
                    title="Spend / Step Down Focus"
                    className="p-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 rounded border border-purple-800"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleFocusFlood}
                    title="Flood / +1 Step Focus"
                    className="p-1 bg-purple-950/60 hover:bg-purple-900 text-purple-300 rounded border border-purple-800"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-mono">Max:</span>
                  <select
                    value={focusMaxDie}
                    onChange={(e) => handleFocusMaxChange(e.target.value as DieRating)}
                    className="bg-slate-950 text-purple-300 font-mono font-bold text-xs px-2 py-0.5 rounded border border-purple-800 outline-none"
                  >
                    {DIE_OPTIONS.map((die) => (
                      <option key={die} value={die} className="bg-slate-900 text-slate-100">
                        {dieToNum(die)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🍀 Luck Split Pill Container & Floating Popover */}
        <div className="relative">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-semibold transition-all ${
              activeDrawer === 'luck'
                ? 'bg-emerald-900/60 border-emerald-400 text-emerald-100 shadow-sm shadow-emerald-500/30'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span>🍀</span> Luck:
            </span>
            <span className="font-mono font-extrabold text-emerald-100">{luck}</span>

            {/* Inline Direct Manipulation Step Down / Step Up Buttons */}
            <div className="flex items-center gap-0.5 ml-0.5">
              <button
                onClick={() => handleLuckChange(-1)}
                disabled={luck <= 0}
                className="p-0.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/80 transition-all disabled:opacity-30"
                title="Spend / -1 Luck"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleLuckChange(1)}
                disabled={luck >= maxLuck}
                className="p-0.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/80 transition-all disabled:opacity-30"
                title="Gain / +1 Luck"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Secondary Zone: Chevron Popover Trigger */}
            <button
              onClick={() => toggleDrawer('luck')}
              className="p-0.5 text-emerald-400 hover:text-emerald-200 transition-colors ml-0.5"
              title="Click to view Luck rules & controls"
            >
              {activeDrawer === 'luck' ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* 🍀 Luck Absolute Floating Glass Popover Card */}
          {activeDrawer === 'luck' && (
            <div className="absolute top-full left-0 mt-2 z-50 w-72 p-3.5 bg-slate-900/95 border border-emerald-500/40 rounded-xl shadow-2xl shadow-emerald-950/60 backdrop-blur-xl text-xs flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                <span className="font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                  🍀 Luck Pool
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-emerald-100 font-extrabold">
                    {luck} / {maxLuck}
                  </span>
                  <button
                    onClick={() => setActiveDrawer('none')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                    title="Close popover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed">
                Spend Luck to re-roll tests, avoid critical fumbles, or boost active skill rolls. Default: 3, Max: 5.
              </p>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-500/20">
                <span className="text-[10px] text-slate-400 font-mono">Adjust Pool:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleLuckChange(-1)}
                    disabled={luck <= 0}
                    className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800 text-xs font-bold disabled:opacity-40"
                  >
                    -1 Spend
                  </button>
                  <button
                    onClick={() => handleLuckChange(1)}
                    disabled={luck >= maxLuck}
                    className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800 text-xs font-bold disabled:opacity-40"
                  >
                    +1 Gain
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ⚡ Spark Split Pill Container (Clickable Lightning Bolts) & Floating Popover */}
        <div className="relative">
          <div
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-semibold transition-all ${
              activeDrawer === 'spark'
                ? 'bg-amber-900/60 border-amber-400 text-amber-100 shadow-sm shadow-amber-500/30'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
            }`}
          >
            <span className="text-amber-400 font-bold uppercase text-[11px]">⚡ Spark:</span>

            {/* Inline Direct Manipulation Clickable Lightning Bolt Icons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, idx) => {
                const isFilled = idx < sparks;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSparkToggle(idx)}
                    className={`p-0.5 rounded transition-all transform hover:scale-110 ${
                      isFilled
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                        : 'text-slate-700 hover:text-amber-500/60'
                    }`}
                    title={`Toggle Spark ${idx + 1}`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>

            {isCharged && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded border border-amber-400/40 animate-pulse ml-0.5">
                +1 ALL
              </span>
            )}

            {/* Secondary Zone: Chevron Popover Trigger */}
            <button
              onClick={() => toggleDrawer('spark')}
              className="p-0.5 text-amber-400 hover:text-amber-200 transition-colors ml-0.5"
              title="Click to configure Spark Engine & Spend Meta"
            >
              {activeDrawer === 'spark' ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* ⚡ Spark Absolute Floating Glass Popover Card */}
          {activeDrawer === 'spark' && (
            <div className="absolute top-full left-0 mt-2 z-50 w-80 p-3 bg-slate-900/95 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-950/60 backdrop-blur-xl text-xs flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <span className="font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Spark Engine ({sparks}/5)
                </span>
                <div className="flex items-center gap-2">
                  {isCharged && (
                    <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-outfit font-black text-[10px] rounded shadow animate-bounce">
                      ⚡ CHARGED!
                    </span>
                  )}
                  <button
                    onClick={() => setActiveDrawer('none')}
                    className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                    title="Close popover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 5-Peg Spark Meter */}
              <div className="flex items-center justify-between gap-1.5 bg-slate-950/80 px-2 py-1.5 rounded-lg border border-slate-800">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSparkToggle(idx)}
                    className={`w-6 h-6 rounded-md font-mono text-xs font-extrabold flex items-center justify-center transition-all ${
                      idx < sparks
                        ? 'bg-amber-500 text-slate-950 border border-amber-400 shadow-sm shadow-amber-500/40 opacity-100'
                        : 'bg-slate-950 text-slate-600 border border-slate-800 hover:border-amber-500/50 opacity-40'
                    }`}
                    title={`Toggle Spark peg ${idx + 1}`}
                  >
                    ⚡
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  onClick={() => {
                    spendMeta();
                    saveActiveCharacter();
                  }}
                  disabled={sparks < 5}
                  className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-semibold rounded border border-indigo-500/30 transition-all disabled:opacity-40"
                >
                  Spend Meta (1-⚡)
                </button>

                <button
                  onClick={() => {
                    resetSparks();
                    saveActiveCharacter();
                  }}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-400 text-xs font-mono rounded border border-slate-800"
                  title="Reset Sparks to 0"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Zone: Spacer for symmetry */}
      <div className="w-10 hidden md:block shrink-0" />
    </div>
  );
};


