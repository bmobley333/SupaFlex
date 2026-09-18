// src/components/common/NishInputPill.tsx
// S-Tier KISS & DRY Interactive Nish Area: Roll Button (2H20 + d🏃x) + Direct Number Input
import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { rollNish } from '../../lib/dice';

interface NishInputPillProps {
  onOpenNishTc?: () => void;
}

export const NishInputPill: React.FC<NishInputPillProps> = ({ onOpenNishTc }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const [isRolling, setIsRolling] = useState(false);
  const [tcStatus, setTcStatus] = useState<'tremendous' | 'critical' | null>(null);

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

    if (result.isTremendous) {
      setTcStatus('tremendous');
    } else if (result.isCritical) {
      setTcStatus('critical');
    } else {
      setTcStatus(null);
    }

    setInputValue(String(result.total));

    updateActiveSheetData((prev) => ({
      ...prev,
      current_nish: result.total,
    }));
    saveActiveCharacter();

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
      saveActiveCharacter();
      setTcStatus(null);
      return;
    }

    const parsed = parseInt(trimmed, 10);
    const valToSave = isNaN(parsed) ? trimmed : parsed;

    updateActiveSheetData((prev) => ({
      ...prev,
      current_nish: valToSave,
    }));
    saveActiveCharacter();
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
        className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold transition-all bg-amber-950/40 border-amber-500/30 text-amber-200 hover:border-amber-400 ${
          tcStatus === 'tremendous'
            ? 'ring-1 ring-amber-400 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
            : tcStatus === 'critical'
            ? 'ring-1 ring-rose-500 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
            : ''
        }`}
      >
        <button
          type="button"
          onClick={handleRoll}
          disabled={isRolling}
          className={`font-bold flex items-center gap-1 text-amber-400 hover:text-amber-200 transition-colors cursor-pointer select-none ${
            isRolling ? 'opacity-50 animate-pulse' : ''
          }`}
          title="Click to roll Nish (2H20 + d🏃x)"
        >
          <span className="text-xs leading-none">🚩</span>
          <span>Nish:</span>
        </button>

        <input
          type="text"
          inputMode="numeric"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          placeholder="—"
          className="w-10 bg-slate-900/90 border border-slate-700/60 rounded px-1 py-0.5 text-center font-mono font-black text-xs text-amber-100 focus:border-amber-400 focus:bg-slate-950 outline-none select-all transition-colors"
          title="Current Nish initiative (Click 'Nish' to roll 2H20 + d🏃x, or type manual roll)"
        />

        {tcStatus && onOpenNishTc && (
          <button
            type="button"
            onClick={onOpenNishTc}
            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider animate-pulse transition-all cursor-pointer ${
              tcStatus === 'tremendous'
                ? 'bg-amber-500 text-slate-950 border border-amber-400 shadow-sm'
                : 'bg-rose-600 text-white border border-rose-400 shadow-sm'
            }`}
            title={`Natural ${tcStatus === 'tremendous' ? '20 Tremendous' : '1 Critical'} Nish! Click to open Nish T/C Generator`}
          >
            {tcStatus === 'tremendous' ? 'T' : 'C'}
          </button>
        )}
      </div>
    </div>
  );
};
