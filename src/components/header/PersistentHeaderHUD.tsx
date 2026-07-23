// src/components/header/PersistentHeaderHUD.tsx
import React, { useState } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey } from '../../types/game';

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  emoji: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'might', name: 'Might', emoji: '💪' },
  { key: 'motion', name: 'Motion', emoji: '🏃' },
  { key: 'mind', name: 'Mind', emoji: '👁️' },
  { key: 'magic', name: 'Magic', emoji: '✨' },
  { key: 'moxie', name: 'Moxie', emoji: '🫀' },
];

const dieToNum = (die?: string): string => {
  if (!die) return '4';
  return die.replace(/^d/i, '');
};

export const PersistentHeaderHUD: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const [showFocusPopover, setShowFocusPopover] = useState(false);
  const [showSparkPopover, setShowSparkPopover] = useState(false);

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
  const dice = sheet?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const focusCurrent = dieToNum(sheet?.focus_die_current || 'd4');
  const focusMax = dieToNum(sheet?.focus_die_max || 'd4');
  const sparks = sheet?.sparks ?? 0;
  const isCharged = sheet?.is_charged ?? false;

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

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* 5 Core Attributes Ribbon (Numbers Only) */}
      <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
        {ATTRIBUTES.map((attr, idx) => {
          const dieVal = dieToNum(dice[attr.key]);
          return (
            <React.Fragment key={attr.key}>
              {idx > 0 && <span className="text-slate-800 font-bold">|</span>}
              <div
                className="flex items-center gap-1 cursor-default hover:text-indigo-300 transition-colors"
                title={`${attr.name}: ${dieVal}`}
              >
                <span className="text-sm">{attr.emoji}</span>
                <span className="font-mono font-extrabold text-slate-100">{dieVal}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Focus Mini-Badge */}
      <div className="relative">
        <button
          onClick={() => setShowFocusPopover(!showFocusPopover)}
          className="flex items-center gap-1.5 px-2 py-1 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg text-xs font-semibold text-purple-200 transition-all"
          title="Click for Focus details"
        >
          <span className="text-purple-400 font-bold">🎯 Focus:</span>
          <span className="font-mono font-extrabold text-purple-100">{focusCurrent}</span>
          <span className="text-[10px] text-purple-400 font-mono">({focusMax})</span>
        </button>

        {showFocusPopover && (
          <div className="absolute top-full mt-1.5 left-0 z-50 w-56 p-2.5 bg-slate-900 border border-purple-500/40 rounded-lg shadow-xl text-xs flex flex-col gap-1.5 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="font-extrabold text-purple-300">🎯 Focus</span>
              <span className="font-mono text-[10px] text-slate-400">Current: {focusCurrent} / Max: {focusMax}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-tight">
              Focus scales your tactical actions. Steps down upon use, steps up when flooded.
            </p>
            <button
              onClick={() => setShowFocusPopover(false)}
              className="mt-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 text-right"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Spark Mini-Badge (Interactive Pegs & Charged Indicator) */}
      <div className="relative">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-950/40 border border-amber-500/30 rounded-lg text-xs">
          <span
            onClick={() => setShowSparkPopover(!showSparkPopover)}
            className="text-amber-400 font-bold uppercase text-[11px] cursor-pointer hover:text-amber-300"
            title="Click for Spark details"
          >
            ⚡ Spark:
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleSparkToggle(idx)}
                className={`w-3.5 h-3.5 rounded-full border transition-all ${
                  idx < sparks
                    ? 'bg-amber-400 border-amber-300 shadow-sm shadow-amber-400/50'
                    : 'bg-slate-950 border-slate-700 hover:border-amber-500/60'
                }`}
                title={`Toggle Spark ${idx + 1}`}
              />
            ))}
          </div>
          {isCharged && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold rounded border border-amber-400/40 animate-pulse">
              +1 ALL
            </span>
          )}
        </div>

        {showSparkPopover && (
          <div className="absolute top-full mt-1.5 left-0 z-50 w-56 p-2.5 bg-slate-900 border border-amber-500/40 rounded-lg shadow-xl text-xs flex flex-col gap-1.5 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <span className="font-extrabold text-amber-300">⚡ Spark Engine</span>
              <span className="font-mono text-[10px] text-amber-400">{sparks}/5 Sparks</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-tight">
              Earn sparks through combat momentum. At 5 Sparks, enter Charged state (+1 to all rolls).
            </p>
            <button
              onClick={() => setShowSparkPopover(false)}
              className="mt-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 text-right"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
