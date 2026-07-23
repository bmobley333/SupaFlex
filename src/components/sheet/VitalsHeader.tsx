// src/components/sheet/VitalsHeader.tsx
import React from 'react';
import { Heart, Shield, Award, Sparkles, Activity } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

export const VitalsHeader: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  if (!sheet) return null;

  const maxHp = sheet.vitality_max || activeCharacter?.hp || 10;
  const currentHp = sheet.current_vitality ?? maxHp;
  const wounds = sheet.wounds || 0;
  const maxWounds = sheet.max_wounds || 3;
  const level = sheet.level || 1;
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

  const handleLevelApChange = (field: 'level' | 'ap', val: number) => {
    updateActiveSheetData((prev) => {
      const nextVal = Math.max(0, val);
      if (field === 'level') {
        return { ...prev, level: nextVal, ap: nextVal * 2 };
      }
      return { ...prev, ap: nextVal };
    });
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3 flex flex-col gap-3">
      {/* Top Grid: Level, Vitality Max, Defense, Armor */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Level & AP */}
        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Level (AP: {sheet.ap ?? level * 2})</span>
              <span className="font-outfit font-extrabold text-xs text-slate-100">Lvl {level}</span>
            </div>
          </div>
          <input
            type="number"
            min={1}
            max={250}
            value={level}
            onChange={(e) => handleLevelApChange('level', parseInt(e.target.value) || 1)}
            className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono font-bold text-amber-300 text-center outline-none focus:border-amber-400"
          />
        </div>

        {/* Vitality Max */}
        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Vitality Max</span>
              <span className="font-outfit font-extrabold text-xs text-emerald-400">{maxHp} HP</span>
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
            className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono font-bold text-emerald-300 text-center outline-none focus:border-emerald-400"
          />
        </div>

        {/* Total Defense */}
        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Defense</span>
            <span className="font-outfit font-extrabold text-xs text-indigo-300">{sheet.defense || 10}</span>
          </div>
        </div>

        {/* Total Armor */}
        <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Armor</span>
              <span className="font-outfit font-extrabold text-xs text-cyan-300">+{sheet.armor || 0}</span>
            </div>
          </div>
          <select
            value={sheet.armor || 0}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              updateActiveSheetData((prev) => ({ ...prev, armor: val }));
              saveActiveCharacter();
            }}
            className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs font-mono font-bold text-cyan-300 outline-none focus:border-cyan-400"
            title="Armor Rating (Allowed values: 0, 4, 6, 8, 10, 12)"
          >
            <option value={0}>0</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
            <option value={12}>12</option>
          </select>
        </div>
      </div>

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
