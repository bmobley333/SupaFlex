// src/components/sheet/VitalsHeader.tsx
import React from 'react';
import { Activity } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

export const VitalsHeader: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  if (!sheet) return null;

  const maxHp = sheet.vitality_max || activeCharacter?.hp || 10;
  const currentHp = sheet.current_vitality ?? maxHp;
  const wounds = sheet.wounds || 0;
  const maxWounds = sheet.max_wounds || 3;
  const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, (currentHp / maxHp) * 100)) : 100;

  const handleHpChange = (delta: number) => {
    updateActiveSheetData((prev) => {
      const nextHp = Math.max(0, Math.min(prev.vitality_max, prev.current_vitality + delta));
      return { ...prev, current_vitality: nextHp };
    });
    saveActiveCharacter();
  };

  const handleFullRest = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      current_vitality: prev.vitality_max,
      wounds: 0,
      focus_die_current: prev.focus_die_max || 'd4',
    }));
    saveActiveCharacter();
  };

  const handleWoundsChange = (newWounds: number) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      wounds: Math.max(0, Math.min(maxWounds, newWounds)),
    }));
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3 flex flex-col gap-3">
      {/* HP Progress Meter & Adjusters */}
      <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-850 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            Vitality
          </span>
          <span className="font-mono font-extrabold text-slate-100">
            {currentHp} / {maxHp} ({Math.round(hpPercent)}%)
          </span>
        </div>

        {/* HP Bar */}
        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>

        {/* Quick Adjustment Controls & Wounds */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleHpChange(-5)}
              className="px-2 py-0.5 bg-slate-850 hover:bg-slate-800 text-rose-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              -5
            </button>
            <button
              onClick={() => handleHpChange(-1)}
              className="px-2 py-0.5 bg-slate-850 hover:bg-slate-800 text-rose-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              -1
            </button>
            <button
              onClick={() => handleHpChange(1)}
              className="px-2 py-0.5 bg-slate-850 hover:bg-slate-800 text-emerald-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              +1
            </button>
            <button
              onClick={() => handleHpChange(5)}
              className="px-2 py-0.5 bg-slate-850 hover:bg-slate-800 text-emerald-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              +5
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Wounds Tracker */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold text-[11px]">Wounds:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: maxWounds }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWoundsChange(idx < wounds ? idx : idx + 1)}
                    className={`w-3.5 h-3.5 rounded-full border transition-all ${
                      idx < wounds
                        ? 'bg-rose-500 border-rose-400 shadow-sm shadow-rose-500/50'
                        : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                    }`}
                    title={`Wound ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleFullRest}
              className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded border border-emerald-500/30 transition-all"
            >
              Full Rest 🌿
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
