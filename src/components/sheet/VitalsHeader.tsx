// src/components/sheet/VitalsHeader.tsx
import React, { useState } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';

export const VitalsHeader: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const [damageInput, setDamageInput] = useState('');
  const [healInput, setHealInput] = useState('');

  if (!sheet) return null;

  const maxHp = sheet.vitality_max || activeCharacter?.hp || 10;
  const currentHp = sheet.current_vitality ?? maxHp;
  const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, (currentHp / maxHp) * 100)) : 100;

  const handleHpChange = (delta: number) => {
    updateActiveSheetData((prev) => {
      const nextHp = Math.max(0, Math.min(prev.vitality_max, prev.current_vitality + delta));
      return { ...prev, current_vitality: nextHp };
    });
    saveActiveCharacter();
  };

  const handleFullHeal = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      current_vitality: prev.vitality_max,
    }));
    saveActiveCharacter();
  };

  const handleApplyDamage = () => {
    const val = parseInt(damageInput, 10);
    if (!isNaN(val) && val > 0) {
      handleHpChange(-val);
    }
    setDamageInput('');
  };

  const handleApplyHeal = () => {
    const val = parseInt(healInput, 10);
    if (!isNaN(val) && val > 0) {
      handleHpChange(val);
    }
    setHealInput('');
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      {/* Header: Title & Full Heal Button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-emerald-300 uppercase flex items-center gap-2">
          <span className="text-base">❤️</span>
          Vitality
        </h3>

        <button
          onClick={handleFullHeal}
          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 flex items-center gap-1 transition-all"
          title="Instantly restore Vitality to maximum"
        >
          <span>Full Heal</span>
          <span className="text-xs">💖</span>
        </button>
      </div>

      {/* Main Stat Row: Prominent Current HP Display & Progress Bar */}
      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          {/* Prominent Current Vitality on the Left */}
          <div className="flex items-baseline gap-2 shrink-0">
            <span className={`text-2xl font-extrabold font-outfit ${
              hpPercent > 50 ? 'text-emerald-400' : hpPercent > 20 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {currentHp}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              / {maxHp} ({Math.round(hpPercent)}%)
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
        </div>

        {/* Adjusters Row: Quick Buttons + Custom Inputs */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-slate-850">
          {/* Quick Adjustment Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleHpChange(-5)}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-mono font-bold rounded-lg border border-rose-500/30 transition-all"
            >
              -5
            </button>
            <button
              onClick={() => handleHpChange(-1)}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-mono font-bold rounded-lg border border-rose-500/30 transition-all"
            >
              -1
            </button>
            <button
              onClick={() => handleHpChange(1)}
              className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-mono font-bold rounded-lg border border-emerald-500/30 transition-all"
            >
              +1
            </button>
            <button
              onClick={() => handleHpChange(5)}
              className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-mono font-bold rounded-lg border border-emerald-500/30 transition-all"
            >
              +5
            </button>
          </div>

          {/* Custom Math Inputs: Wounded by & Healed by */}
          <div className="flex items-center gap-3">
            {/* Wounded by Input */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Wounded by:</span>
              <input
                type="number"
                min="1"
                placeholder="Amt"
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyDamage()}
                className="w-14 bg-slate-900 text-rose-300 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none text-center focus:border-rose-500"
              />
              <button
                onClick={handleApplyDamage}
                disabled={!damageInput || parseInt(damageInput, 10) <= 0}
                className="px-2 py-1 bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 text-xs font-bold rounded-lg border border-rose-500/40 disabled:opacity-40 transition-all"
              >
                Apply
              </button>
            </div>

            {/* Healed by Input */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Healed by:</span>
              <input
                type="number"
                min="1"
                placeholder="Amt"
                value={healInput}
                onChange={(e) => setHealInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyHeal()}
                className="w-14 bg-slate-900 text-emerald-300 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none text-center focus:border-emerald-500"
              />
              <button
                onClick={handleApplyHeal}
                disabled={!healInput || parseInt(healInput, 10) <= 0}
                className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 text-xs font-bold rounded-lg border border-emerald-500/40 disabled:opacity-40 transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
