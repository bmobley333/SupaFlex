// src/components/sheet/VitalsHeader.tsx
import React from 'react';
import { Heart, Shield, Award, Sparkles, Activity } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

export const VitalsHeader: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  if (!sheet) return null;

  const currentHp = sheet.current_vitality;
  const maxHp = sheet.vitality_max;
  const wounds = sheet.wounds;
  const maxWounds = sheet.max_wounds || 3;
  const level = sheet.level || 1;

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

  const handleLevelApChange = (field: 'level' | 'ap', val: number) => {
    updateActiveSheetData((prev) => {
      const nextVal = Math.max(0, val);
      if (field === 'level') {
        return { ...prev, level: nextVal, ap: nextVal }; // AP matches level in Flex system
      }
      return { ...prev, ap: nextVal };
    });
    saveActiveCharacter();
  };

  const hpPercent = Math.min(100, Math.max(0, (currentHp / maxHp) * 100));

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Top Banner: Level, AP, Defense, Armor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Level & AP */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Level & AP</span>
              <span className="font-outfit font-extrabold text-sm text-slate-100">Level {level}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={250}
              value={level}
              onChange={(e) => handleLevelApChange('level', parseInt(e.target.value) || 1)}
              className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-amber-300 text-center outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Vitality Max */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Vitality Max</span>
              <span className="font-outfit font-extrabold text-sm text-emerald-400">{maxHp} HP</span>
            </div>
          </div>
          <input
            type="number"
            min={1}
            value={maxHp}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 10;
              updateActiveSheetData((prev) => ({ ...prev, vitality_max: val }));
              saveActiveCharacter();
            }}
            className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-emerald-300 text-center outline-none focus:border-emerald-400"
          />
        </div>

        {/* Total Defense */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Defense</span>
            <span className="font-outfit font-extrabold text-sm text-indigo-300">{sheet.defense || 10}</span>
          </div>
        </div>

        {/* Total Armor */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Armor</span>
            <span className="font-outfit font-extrabold text-sm text-cyan-300">+{sheet.armor || 0}</span>
          </div>
        </div>
      </div>

      {/* HP Progress Meter & Adjusters */}
      <div className="p-3.5 bg-slate-950/80 rounded-lg border border-slate-850 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-400" />
            Current Vitality
          </span>
          <span className="font-mono font-extrabold text-slate-100">
            {currentHp} / {maxHp} ({Math.round(hpPercent)}%)
          </span>
        </div>

        {/* HP Bar */}
        <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${hpPercent}%` }}
          />
        </div>

        {/* Quick Adjustment Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleHpChange(-5)}
              className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-rose-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              -5
            </button>
            <button
              onClick={() => handleHpChange(-1)}
              className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-rose-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              -1
            </button>
            <button
              onClick={() => handleHpChange(1)}
              className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-emerald-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              +1
            </button>
            <button
              onClick={() => handleHpChange(5)}
              className="px-2 py-1 bg-slate-850 hover:bg-slate-800 text-emerald-400 text-xs font-mono font-bold rounded border border-slate-700"
            >
              +5
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Wounds Tracker */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-semibold text-[11px]">Wounds:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: maxWounds }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleWoundsChange(idx < wounds ? idx : idx + 1)}
                    className={`w-4 h-4 rounded-full border transition-all ${
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
              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded border border-emerald-500/30 transition-all"
            >
              Full Rest 🌿
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
