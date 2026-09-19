// src/components/common/NishInputPill.tsx
// S-Tier KISS & DRY Interactive Nish Area: Tactile Roll Button (2H20 + d🏃x), Direct Number Input,
// Automated Sparks Accumulation, and TT / CC / Cancellation Handling
import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { rollNish } from '../../lib/dice';

interface NishInputPillProps {
  onOpenNishTc?: (type: 'tremendous' | 'critical', count?: number) => void;
}

export const NishInputPill: React.FC<NishInputPillProps> = ({ onOpenNishTc }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const [isRolling, setIsRolling] = useState(false);
  const [tcData, setTcData] = useState<{
    type: 'tremendous' | 'critical';
    count: number;
    label: string;
  } | null>(null);

  const sheet = activeCharacter?.sheet_data;
  const currentNish = sheet?.current_nish;
  const motionDie = sheet?.attribute_dice?.motion || 'd4';

  const [inputValue, setInputValue] = useState<string>(() => {
    return currentNish !== undefined && currentNish !== null ? String(currentNish) : '';
  });

  useEffect(() => {
    setInputValue(currentNish !== undefined && currentNish !== null ? String(currentNish) : '');
  }, [currentNish, activeCharacter?.id]);

  const handleRoll = () => {
    setIsRolling(true);
    const result = rollNish(motionDie);

    // 1. Automated Sparks Generation:
    // +1 Spark for ANY natural 20 or 1 on either d20, plus +1 Spark per explosion of the Motion die
    let sparksEarned = 0;
    for (const val of result.d20Rolls) {
      if (val === 20 || val === 1) {
        sparksEarned++;
      }
    }
    if (result.motionRoll.explosionCount > 0) {
      sparksEarned += result.motionRoll.explosionCount;
    }

    const currentCharges = sheet?.charges ?? sheet?.sparks ?? 0;
    const newCharges = Math.min(5, currentCharges + sparksEarned);
    const sparked = newCharges === 5;

    // 2. Tremendous / Critical / Double / Cancellation Evaluation:
    const num20s = result.d20Rolls.filter((v) => v === 20).length;
    const num1s = result.d20Rolls.filter((v) => v === 1).length;

    if (num20s === 2) {
      setTcData({ type: 'tremendous', count: 2, label: 'TT' });
    } else if (num1s === 2) {
      setTcData({ type: 'critical', count: 2, label: 'CC' });
    } else if (num20s === 1 && num1s === 1) {
      // Cancellation Rule: One of each cancels out (T + C = nothing)
      setTcData(null);
    } else if (num20s === 1) {
      setTcData({ type: 'tremendous', count: 1, label: 'T' });
    } else if (num1s === 1) {
      setTcData({ type: 'critical', count: 1, label: 'C' });
    } else {
      setTcData(null);
    }

    setInputValue(String(result.total));

    updateActiveSheetData((prev) => ({
      ...prev,
      current_nish: result.total,
      ...(sparksEarned > 0
        ? {
            charges: newCharges,
            sparks: newCharges,
            is_sparked: sparked,
            is_charged: sparked,
          }
        : {}),
    }));
    saveActiveCharacter(true);

    setTimeout(() => {
      setIsRolling(false);
    }, 200);
  };

  const handleCommit = () => {
    const trimmed = inputValue.trim();
    if (trimmed === '') {
      updateActiveSheetData((prev) => {
        const next = { ...prev };
        delete next.current_nish;
        return next;
      });
      saveActiveCharacter(true);
      setTcData(null);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    const valToSave = isNaN(parsed) ? trimmed : parsed;

    updateActiveSheetData((prev) => ({
      ...prev,
      current_nish: valToSave,
    }));
    saveActiveCharacter(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="relative flex items-center">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 border rounded-lg text-xs font-semibold transition-all bg-amber-950/40 border-amber-500/30 text-amber-200 hover:border-amber-400 ${
          tcData?.type === 'tremendous'
            ? 'ring-1 ring-amber-400 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
            : tcData?.type === 'critical'
            ? 'ring-1 ring-rose-500 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
            : ''
        }`}
      >
        {/* Tactile Button with Defined Border */}
        <button
          type="button"
          onClick={handleRoll}
          disabled={isRolling}
          className={`px-2 py-0.5 rounded-md border font-extrabold flex items-center gap-1 select-none cursor-pointer shadow-sm transition-all ${
            isRolling
              ? 'opacity-50 animate-pulse bg-amber-900/50 border-amber-500/50 text-amber-200'
              : 'bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 hover:text-amber-100 border-amber-500/50 hover:border-amber-400 active:scale-95'
          }`}
          title="Click to roll Nish (2H20 + d🏃x)"
        >
          <span className="text-xs leading-none">🚩</span>
          <span className="tracking-wide">Nish</span>
        </button>

        {/* Numeric / Manual Text Input */}
        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          placeholder="—"
          className="w-10 bg-slate-900/90 border border-slate-700/60 rounded px-1 py-0.5 text-center font-mono font-black text-xs text-amber-100 focus:border-amber-400 focus:bg-slate-950 outline-none select-all transition-colors"
          title="Current Nish initiative (Click 'Nish' button to roll 2H20 + d🏃x, or type manual roll)"
        />

        {/* T, TT, C, or CC Trigger Pill Button */}
        {tcData && onOpenNishTc && (
          <button
            type="button"
            onClick={() => onOpenNishTc(tcData.type, tcData.count)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider animate-pulse transition-all cursor-pointer shadow-sm ${
              tcData.type === 'tremendous'
                ? 'bg-amber-500 text-slate-950 border border-amber-300 hover:bg-amber-400'
                : 'bg-rose-600 text-white border border-rose-400 hover:bg-rose-500'
            }`}
            title={
              tcData.count === 2
                ? `Double ${tcData.type === 'tremendous' ? 'Tremendous (Two 20s)' : 'Critical (Two 1s)'}! Click to roll 2 ${tcData.type} effects`
                : `Natural ${tcData.type === 'tremendous' ? '20 Tremendous' : '1 Critical'}! Click to roll ${tcData.type} effect`
            }
          >
            {tcData.label}
          </button>
        )}
      </div>
    </div>
  );
};
