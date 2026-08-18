// src/components/common/GmCompactDifficultyBar.tsx
// High-Density On-Screen Master Difficulty Scaling Bar for the GM Screen

import React, { useState, useEffect, useRef } from 'react';
import { Sliders } from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';

interface GmCompactDifficultyBarProps {
  className?: string;
}

export const GmCompactDifficultyBar: React.FC<GmCompactDifficultyBarProps> = ({ className = '' }) => {
  const activeEncounter = useAdventureStore((state) => state.getActiveEncounter());
  const scaleEncounterDifficulty = useAdventureStore((state) => state.scaleEncounterDifficulty);

  const initialDif = activeEncounter?.master_dif || 10;
  const [localDif, setLocalDif] = useState<number>(initialDif);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with encounter change
  useEffect(() => {
    setLocalDif(activeEncounter?.master_dif || 10);
  }, [activeEncounter?.id, activeEncounter?.master_dif]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const getThreatLabel = (dif: number) => {
    if (dif < 7) return { text: 'Easy', badge: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/60' };
    if (dif <= 11) return { text: 'Standard', badge: 'text-amber-300 border-amber-500/40 bg-amber-950/60' };
    if (dif <= 15) return { text: 'Hard', badge: 'text-orange-300 border-orange-500/40 bg-orange-950/60' };
    if (dif <= 21) return { text: 'Deadly', badge: 'text-rose-300 border-rose-500/40 bg-rose-950/60' };
    return { text: 'Mythic', badge: 'text-purple-300 border-purple-500/40 bg-purple-950/60' };
  };

  const threat = getThreatLabel(localDif);

  const handlePresetClick = (presetVal: number) => {
    setLocalDif(presetVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    scaleEncounterDifficulty(presetVal);
  };

  const handleSliderChange = (newVal: number) => {
    setLocalDif(newVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      scaleEncounterDifficulty(newVal);
    }, 280);
  };

  return (
    <div className={`bg-slate-950/90 border border-slate-800/90 p-2 rounded-xl shadow-inner flex flex-wrap items-center justify-between gap-2.5 font-outfit ${className}`}>
      {/* Left: Threat Label */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 shrink-0">
        <Sliders className="w-3.5 h-3.5 text-purple-400" />
        <span className="uppercase tracking-wide text-[11px] text-slate-400 font-mono font-extrabold">Threat:</span>
      </div>

      {/* Center: Quick Presets (Auto-Applies) */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
        {[
          { label: 'Easy', val: 6 },
          { label: 'Base', val: 10 },
          { label: 'Hard', val: 14 },
          { label: 'Deadly', val: 18 },
          { label: 'Mythic', val: 22 },
        ].map((p) => {
          const isSelected = localDif === p.val;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => handlePresetClick(p.val)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded transition-all cursor-pointer ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-sm font-extrabold border border-purple-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title={`Auto-scale encounter to Dif ${p.val} (${p.label})`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Right: Threat Badge & Fine-Tuning Slider */}
      <div className="flex items-center gap-2.5 flex-1 min-w-[220px] max-w-[340px] justify-end">
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-extrabold border shrink-0 ${threat.badge}`}>
          {threat.text} ({localDif})
        </span>

        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0">3</span>
          <input
            type="range"
            min={3}
            max={25}
            step={1}
            value={localDif}
            onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            title={`Master Difficulty Slider: ${localDif}`}
          />
          <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0">25</span>
        </div>
      </div>
    </div>
  );
};
