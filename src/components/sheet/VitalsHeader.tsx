// src/components/sheet/VitalsHeader.tsx
// Vitality Header Component - Prominent Current Vitality readout, draggable progress bar, & quick adjusters.

import React, { useState, useRef } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';

interface VitalsHeaderProps {
  onOpenVitalityManager?: () => void;
}

export const VitalsHeader: React.FC<VitalsHeaderProps> = ({ onOpenVitalityManager }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const [damageInput, setDamageInput] = useState('');
  const [healInput, setHealInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  if (!sheet) return null;

  const maxVit = sheet.vitality_max || activeCharacter?.hp || 10;
  const currentVit = sheet.current_vitality ?? maxVit;
  const vitPercent = maxVit > 0 ? Math.min(100, Math.max(0, (currentVit / maxVit) * 100)) : 100;

  // Allow negative numbers by removing Math.max(0, ...), clamp only upper bound to maxVit
  const handleVitChange = (delta: number) => {
    updateActiveSheetData((prev) => {
      const nextVit = Math.min(prev.vitality_max, (prev.current_vitality ?? prev.vitality_max) + delta);
      return { ...prev, current_vitality: nextVit };
    });
    saveActiveCharacter();
  };

  const handleApplyDamage = () => {
    const val = parseInt(damageInput, 10);
    if (!isNaN(val) && val > 0) {
      handleVitChange(-val);
    }
    setDamageInput('');
  };

  const handleApplyHeal = () => {
    const val = parseInt(healInput, 10);
    if (!isNaN(val) && val > 0) {
      handleVitChange(val);
    }
    setHealInput('');
  };

  // Draggable Progress Bar Pointer Handlers
  const updateVitFromPointer = (clientX: number) => {
    if (!barRef.current || maxVit <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    const newVit = Math.round(ratio * maxVit);

    updateActiveSheetData((prev) => ({
      ...prev,
      current_vitality: newVit,
    }));
    saveActiveCharacter();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateVitFromPointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateVitFromPointer(e.clientX);
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
      {/* Header: Title & Manage Vitality Button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-emerald-300 uppercase flex items-center gap-2">
            <span className="text-base">❤️</span>
            Vitality
          </h3>
          <CardHelpButton ruleKey="vitality.death_checks" />
          {currentVit < 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-950 text-rose-300 rounded-full border border-rose-500/40 font-bold animate-pulse">
              Death Check / Negative
            </span>
          )}
        </div>

        <button
          onClick={onOpenVitalityManager}
          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold rounded-lg border border-rose-500/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:border-rose-500/50"
          title="Manage Max Vitality Rolls, AP Boosts, and Restoration"
        >
          <span className="text-xs">❤️</span>
          <span>Manage Vitality</span>
        </button>
      </div>

      {/* Main Stat Row: Prominent Current Vitality Display & Draggable Progress Bar */}
      <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          {/* Prominent Current Vitality on Left (Allows Negative Numbers) */}
          <div className="flex items-baseline gap-2 shrink-0">
            <span className={`text-2xl font-extrabold font-outfit ${
              currentVit < 0 ? 'text-rose-500' : vitPercent > 50 ? 'text-emerald-400' : vitPercent > 20 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {currentVit}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400">
              / {maxVit} ({currentVit < 0 ? '0' : Math.round(vitPercent)}%)
            </span>
          </div>

          {/* Interactive S-Tier Draggable Vitality Bar */}
          <div
            ref={barRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full max-w-[280px] h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 cursor-ew-resize select-none touch-none group transition-all hover:border-emerald-500/50"
            title="Click or drag left/right to adjust Vitality level"
          >
            <div
              className={`h-full transition-all duration-75 relative ${
                currentVit < 0 ? 'bg-rose-950/40' : vitPercent > 50 ? 'bg-emerald-500' : vitPercent > 20 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${currentVit < 0 ? 0 : vitPercent}%` }}
            >
              {/* Glowing Draggable Handle Knob */}
              {currentVit > 0 && (
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
              onClick={() => handleVitChange(-5)}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-mono font-bold rounded-lg border border-rose-500/30 transition-all"
            >
              -5
            </button>
            <button
              onClick={() => handleVitChange(-1)}
              className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-mono font-bold rounded-lg border border-rose-500/30 transition-all"
            >
              -1
            </button>
            <button
              onClick={() => handleVitChange(1)}
              className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-mono font-bold rounded-lg border border-emerald-500/30 transition-all"
            >
              +1
            </button>
            <button
              onClick={() => handleVitChange(5)}
              className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-mono font-bold rounded-lg border border-emerald-500/30 transition-all"
            >
              +5
            </button>
          </div>

          {/* Custom Math Inputs */}
          <div className="flex items-center gap-6">
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
