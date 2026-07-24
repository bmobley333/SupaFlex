// src/components/sheet/MovementRateCard.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { MovementRateData } from '../../types/game';

const INTEGER_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0 to 12

export const MovementRateCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  const mrData: MovementRateData = activeCharacter?.sheet_data?.movement_rate || {
    armored: 6,
    shield: 0,
  };

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
      <div className="grid grid-cols-2 gap-4 pt-1">
        {/* Armored Field */}
        <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            Armored
          </span>
          <select
            value={mrData.armored ?? 6}
            onChange={(e) => handleUpdate({ armored: parseInt(e.target.value, 10) || 0 })}
            className="bg-slate-900 border border-slate-700 text-teal-300 text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg outline-none focus:border-teal-400 cursor-pointer text-center"
          >
            {INTEGER_OPTIONS.map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        </div>

        {/* Shield Field */}
        <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            Shield Drawn
          </span>
          <select
            value={mrData.shield ?? 0}
            onChange={(e) => handleUpdate({ shield: parseInt(e.target.value, 10) || 0 })}
            className="bg-slate-900 border border-slate-700 text-teal-300 text-xs font-mono font-extrabold px-3 py-1.5 rounded-lg outline-none focus:border-teal-400 cursor-pointer text-center"
          >
            {INTEGER_OPTIONS.map((val) => (
              <option key={val} value={val}>
                {val}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
