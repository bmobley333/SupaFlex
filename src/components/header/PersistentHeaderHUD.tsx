// src/components/header/PersistentHeaderHUD.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Zap, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'attributes' | 'focus' | 'spark'>('none');
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

  const toggleDrawer = (target: 'attributes' | 'focus' | 'spark') => {
    setActiveDrawer((prev) => (prev === target ? 'none' : target));
  };

  return (
    <div className="w-full flex items-center justify-between gap-4 flex-wrap" ref={containerRef}>
      {/* Left Zone: Prominent, High-Contrast Attributes Engine Ribbon */}
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

      {/* Center Zone: Centered Focus & Spark Buttons */}
      <div className="flex-1 flex justify-center items-center gap-3">
        {/* Focus Relative Container & Floating Popover */}
        <div className="relative">
          <button
            onClick={() => toggleDrawer('focus')}
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-semibold transition-all ${
              activeDrawer === 'focus'
                ? 'bg-purple-900/60 border-purple-400 text-purple-100 shadow-sm shadow-purple-500/30'
                : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-200'
            }`}
            title="Click to toggle Focus Drawer"
          >
            <span className="text-purple-400 font-bold">🎯 Focus:</span>
            <span className="font-mono font-extrabold text-purple-100">{focusCurrent}</span>
            <span className="text-[10px] text-purple-400 font-mono">({focusMax})</span>
            {activeDrawer === 'focus' ? (
              <ChevronUp className="w-3.5 h-3.5 text-purple-300" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
            )}
          </button>

          {/* 🎯 Focus Absolute Floating Glass Popover Card */}
          {activeDrawer === 'focus' && (
            <div className="absolute top-full left-0 mt-2 z-50 w-72 p-3 bg-slate-900/95 border border-purple-500/40 rounded-xl shadow-2xl shadow-purple-950/60 backdrop-blur-xl text-xs flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5">
                <span className="font-extrabold text-purple-300 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                  🎯 Focus Ladder
                </span>
                <span className="font-mono text-xs text-purple-100 font-extrabold">
                  {focusCurrent} <span className="text-[10px] text-slate-400 font-normal">(Max: {focusMax})</span>
                </span>
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

        {/* Spark Relative Container & Floating Popover */}
        <div className="relative">
          <button
            onClick={() => toggleDrawer('spark')}
            className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg text-xs font-semibold transition-all ${
              activeDrawer === 'spark'
                ? 'bg-amber-900/60 border-amber-400 text-amber-100 shadow-sm shadow-amber-500/30'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-200'
            }`}
            title="Click to toggle Spark Drawer"
          >
            <span className="text-amber-400 font-bold uppercase text-[11px]">⚡ Spark:</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, idx) => (
                <span
                  key={idx}
                  className={`w-2.5 h-2.5 rounded-full border transition-all ${
                    idx < sparks
                      ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-400/50'
                      : 'bg-slate-950 border-slate-700'
                  }`}
                />
              ))}
            </div>
            {isCharged && (
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded border border-amber-400/40 animate-pulse">
                +1 ALL
              </span>
            )}
            {activeDrawer === 'spark' ? (
              <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          {/* ⚡ Spark Absolute Floating Glass Popover Card */}
          {activeDrawer === 'spark' && (
            <div className="absolute top-full left-0 mt-2 z-50 w-80 p-3 bg-slate-900/95 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-950/60 backdrop-blur-xl text-xs flex flex-col gap-2.5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                <span className="font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1 text-[11px]">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Spark Engine ({sparks}/5)
                </span>
                {isCharged && (
                  <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 font-outfit font-black text-[10px] rounded shadow animate-bounce">
                    ⚡ CHARGED!
                  </span>
                )}
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

