// src/components/sheet/VitalsHeader.tsx
import React, { useState, useRef } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';

export const VitalsHeader: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const [damageInput, setDamageInput] = useState('');
  const [healInput, setHealInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  if (!sheet) return null;

  const maxHp = sheet.vitality_max || activeCharacter?.hp || 10;
  const currentHp = sheet.current_vitality ?? maxHp;
  const hpPercent = maxHp > 0 ? Math.min(100, Math.max(0, (currentHp / maxHp) * 100)) : 100;

  // Allow negative numbers by removing Math.max(0, ...), clamp only upper bound to maxHp
  const handleHpChange = (delta: number) => {
    updateActiveSheetData((prev) => {
      const nextHp = Math.min(prev.vitality_max, (prev.current_vitality ?? prev.vitality_max) + delta);
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

  // Draggable Progress Bar Pointer Handlers
  const updateHpFromPointer = (clientX: number) => {
    if (!barRef.current || maxHp <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    const newHp = Math.round(ratio * maxHp);

    updateActiveSheetData((prev) => ({
      ...prev,
      current_vitality: newHp,
    }));
    saveActiveCharacter();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateHpFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateHpFromPointer(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      {/* Header: Title & Full Heal Button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-emerald-300 uppercase flex items-center gap-2">
            <span className="text-base">❤️</span>
            Vitality
          </h3>
          {currentHp < 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-950 text-rose-300 rounded-full border border-rose-500/40 font-bold animate-pulse">
              Death Check / Negative
            </span>
          )}
        </div>

        <button
          onClick={handleFullHeal}
          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 flex items-center gap-1 transition-all"
          title="Instantly restore Vitality to maximum"
        >
          <span>Full Heal</span>
          <span className="text-xs">💖</span>
        </button>
      </div>

      {/* Main Stat Row: Prominent Current HP Display & Draggable Progress Bar */}
      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          {/* Prominent Current Vitality on the Left (Allows Negative Numbers) */}
          <div className="flex items-baseline gap-2 shrink-0">
            <span className={`text-2xl font-extrabold font-outfit ${
              currentHp < 0 ? 'text-rose-500' : hpPercent > 50 ? 'text-emerald-400' : hpPercent > 20 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {currentHp}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              / {maxHp} ({currentHp < 0 ? '0' : Math.round(hpPercent)}%)
            </span>
          </div>

          {/* Interactive S-Tier Draggable HP Bar */}
          <div
            ref={barRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 cursor-ew-resize select-none touch-none group transition-all hover:border-emerald-500/50"
            title="Click or drag left/right to adjust Vitality level"
          >
            <div
              className={`h-full transition-all duration-75 relative ${
                currentHp < 0 ? 'bg-rose-950/40' : hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${currentHp < 0 ? 0 : hpPercent}%` }}
            >
              {/* Glowing Draggable Handle Knob */}
              {currentHp > 0 && (
                <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/90 rounded-full shadow-lg shadow-emerald-500/80 group-hover:scale-125 transition-transform" />
              )}
            </div>
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

          {/* Custom Math Inputs: Wounded by & Healed by (UI DRY: Enter key submit, hidden spinners, no Apply buttons, expanded gap-6) */}
          <div className="flex items-center gap-6">
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
                className="w-14 bg-slate-900 text-rose-300 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none text-center focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Type number and press Enter to apply damage"
              />
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
                className="w-14 bg-slate-900 text-emerald-300 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none text-center focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Type number and press Enter to apply healing"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
