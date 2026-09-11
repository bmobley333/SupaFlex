import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { calculateMovementRate } from '../../types/game';

const ARMORED_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0 to 12

export const MovementRateCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const [mrAdjInput, setMrAdjInput] = useState(() => {
    const v = sheet?.mr_adj;
    return v !== undefined && v !== 0 ? String(v) : '';
  });

  useEffect(() => {
    const v = sheet?.mr_adj;
    setMrAdjInput(v !== undefined && v !== 0 ? String(v) : '');
  }, [activeCharacter?.id, sheet?.mr_adj]);

  const derivedMR = calculateMovementRate(sheet);
  const armoredMR = Math.max(1, derivedMR.armored);
  const shieldDrawnMR = typeof derivedMR.shield === 'number' ? Math.max(1, derivedMR.shield) : derivedMR.shield;

  const handleManualArmoredChange = (newArmored: number) => {
    updateActiveSheetData((prev) => {
      const tempSheet = {
        ...prev,
        movement_rate: {
          ...(prev.movement_rate || { armored: 6, shield: 'n/a' }),
          armored: Math.max(1, newArmored),
        },
      };
      const recalculated = calculateMovementRate(tempSheet);
      return {
        ...prev,
        movement_rate: {
          armored: Math.max(1, recalculated.armored),
          shield: typeof recalculated.shield === 'number' ? Math.max(1, recalculated.shield) : recalculated.shield,
        },
      };
    });
    saveActiveCharacter();
  };

  const handleApplyMrAdj = () => {
    const trimmed = mrAdjInput.trim();
    const parsed = trimmed === '' ? 0 : parseInt(trimmed, 10);
    if (isNaN(parsed)) {
      const currentStored = sheet?.mr_adj;
      setMrAdjInput(currentStored !== undefined && currentStored !== 0 ? String(currentStored) : '');
      return;
    }

    const oldAdj = sheet?.mr_adj || 0;
    const delta = parsed - oldAdj;

    if (delta !== 0) {
      updateActiveSheetData((prev) => {
        const currentMr = prev.movement_rate || { armored: 6, shield: 'n/a' };
        const currentArmored = typeof currentMr.armored === 'number' ? currentMr.armored : 6;
        const newArmored = Math.max(1, currentArmored + delta);

        let newShield: number | string = currentMr.shield;
        if (typeof currentMr.shield === 'number') {
          newShield = Math.max(1, currentMr.shield + delta);
        } else if (typeof shieldDrawnMR === 'number') {
          newShield = Math.max(1, shieldDrawnMR + delta);
        }

        return {
          ...prev,
          mr_adj: parsed,
          movement_rate: {
            ...currentMr,
            armored: newArmored,
            shield: newShield,
          },
        };
      });
      saveActiveCharacter();
      setMrAdjInput(parsed !== 0 ? String(parsed) : (trimmed === '0' ? '0' : ''));
    } else {
      setMrAdjInput(parsed !== 0 ? String(parsed) : (trimmed === '0' ? '0' : ''));
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3 transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-teal-300 uppercase flex items-center gap-1.5">
          <span className="text-base">👣</span>
          MR
          <span className="text-xs font-normal text-slate-400 font-sans normal-case tracking-normal ml-1">
            (Movement Rate)
          </span>
        </h3>
      </div>

      {/* Card Content: Armored & Shield Movement Rate Fields */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Armored Field */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            Armored 👣
          </span>
          <select
            value={armoredMR}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10) || 0;
              handleManualArmoredChange(val);
            }}
            className="bg-slate-900 border border-slate-700 text-teal-300 text-xs font-mono font-extrabold px-2 py-1 rounded-lg outline-none focus:border-teal-400 cursor-pointer text-center"
          >
            {ARMORED_OPTIONS.map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        </div>

        {/* Shield Drawn Read-Only Display Box */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            Shield Drawn 👣
          </span>
          <div
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono font-extrabold text-teal-300 text-center"
            title="Auto-calculated Armored MR reduced by shield MR penalty (min 1)"
          >
            {shieldDrawnMR}
          </div>
        </div>

        {/* Adj [text box] */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-1.5 w-fit">
          <span className="text-[11px] font-bold text-slate-400">Adj</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="±0"
            value={mrAdjInput}
            onChange={(e) => setMrAdjInput(e.target.value)}
            onBlur={handleApplyMrAdj}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyMrAdj()}
            className="w-10 bg-slate-900 text-teal-300 text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 outline-none text-center focus:border-teal-500"
            title="Enter positive or negative integer for current Movement Rate modifier (hard floor 1)"
          />
        </div>
      </div>
    </div>
  );
};
