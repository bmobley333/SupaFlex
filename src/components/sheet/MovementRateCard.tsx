// src/components/sheet/MovementRateCard.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { MovementRateData } from '../../types/game';

const ARMORED_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0 to 12

export const MovementRateCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  const mrData: MovementRateData = activeCharacter?.sheet_data?.movement_rate || {
    armored: 6,
    shield: 'n/a',
  };

  const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
  const isShieldEquipped = shieldSlot?.equipped ?? false;
  const armoredMR = mrData.armored ?? 6;

  let derivedShieldDrawnMR: string | number = 'n/a';
  if (isShieldEquipped) {
    const mrStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
    const match = mrStr.match(/-?\d+/);
    const penalty = match ? parseInt(match[0], 10) : 0;
    derivedShieldDrawnMR = Math.max(0, armoredMR + penalty);
  }

  const handleUpdate = (updates: Partial<MovementRateData>) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      movement_rate: {
        ...(prev.movement_rate || mrData),
        ...updates,
      },
    }));
    saveActiveCharacter();
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
            value={mrData.armored ?? 6}
            onChange={(e) => {
              const newArmored = parseInt(e.target.value, 10) || 0;
              let newShieldMR: string | number = 'n/a';
              if (isShieldEquipped) {
                const mrStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
                const match = mrStr.match(/-?\d+/);
                const penalty = match ? parseInt(match[0], 10) : 0;
                newShieldMR = Math.max(0, newArmored + penalty);
              }
              handleUpdate({ armored: newArmored, shield: newShieldMR });
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
            title="Auto-calculated Armored MR reduced by shield MR penalty (min 0)"
          >
            {derivedShieldDrawnMR}
          </div>
        </div>
      </div>
    </div>
  );
};
