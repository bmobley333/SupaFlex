// src/components/common/GmThreatBar.tsx
// Universal, Reusable Threat & Difficulty Scaling Control (Presets + Badge + Precision Slider)

import React, { useState, useEffect, useRef } from 'react';
import { Sliders } from 'lucide-react';

export interface GmThreatBarProps {
  value: number;
  onChange: (newValue: number) => void;
  label?: string;
  compact?: boolean;
  className?: string;
  min?: number;
  max?: number;
}

export const getThreatBadgeInfo = (dif: number) => {
  if (dif < 7) return { text: 'Easy', badge: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/60' };
  if (dif <= 11) return { text: 'Normal', badge: 'text-amber-300 border-amber-500/40 bg-amber-950/60' };
  if (dif <= 15) return { text: 'Hard', badge: 'text-orange-300 border-orange-500/40 bg-orange-950/60' };
  if (dif <= 21) return { text: 'Deadly', badge: 'text-rose-300 border-rose-500/40 bg-rose-950/60' };
  return { text: 'Mythic', badge: 'text-purple-300 border-purple-500/40 bg-purple-950/60' };
};

export const THREAT_PRESETS = [
  { label: 'Easy', val: 6 },
  { label: 'Normal', val: 10 },
  { label: 'Hard', val: 14 },
  { label: 'Deadly', val: 18 },
  { label: 'Mythic', val: 22 },
];

export const GmThreatBar: React.FC<GmThreatBarProps> = ({
  value,
  onChange,
  label = 'Threat:',
  compact = false,
  className = '',
  min = 3,
  max = 25,
}) => {
  const [localVal, setLocalVal] = useState<number>(value);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const threat = getThreatBadgeInfo(localVal);

  const handlePresetClick = (presetVal: number) => {
    setLocalVal(presetVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onChange(presetVal);
  };

  const handleSliderChange = (newVal: number) => {
    setLocalVal(newVal);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onChange(newVal);
    }, 280);
  };

  if (compact) {
    return (
      <div className={`bg-slate-950/90 border border-slate-800 p-2 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs font-outfit ${className}`}>
        {/* Left: Label & Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-300 shrink-0">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span className="uppercase tracking-wide text-[10px] text-slate-400 font-mono font-extrabold">{label}</span>
          </div>

          <div className="flex items-center gap-0.5 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
            {THREAT_PRESETS.map((p) => {
              const isSelected = localVal === p.val;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePresetClick(p.val)}
                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm font-extrabold border border-purple-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={`Set Threat to ${p.val} (${p.label})`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Badge & Slider */}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-[280px] justify-end">
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-extrabold border shrink-0 ${threat.badge}`}>
            {threat.text} ({localVal})
          </span>

          <div className="flex items-center gap-1.5 flex-1 min-w-[90px]">
            <span className="text-[9px] font-mono text-slate-500 font-bold shrink-0">{min}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={localVal}
              onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
              title={`Threat Slider: ${localVal}`}
            />
            <span className="text-[9px] font-mono text-slate-500 font-bold shrink-0">{max}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-950/90 border border-slate-800/90 p-2 rounded-xl shadow-inner flex flex-wrap items-center justify-between gap-2.5 font-outfit ${className}`}>
      {/* Left: Threat Label */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 shrink-0">
        <Sliders className="w-3.5 h-3.5 text-purple-400" />
        <span className="uppercase tracking-wide text-[11px] text-slate-400 font-mono font-extrabold">{label}</span>
      </div>

      {/* Center: Quick Presets */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
        {THREAT_PRESETS.map((p) => {
          const isSelected = localVal === p.val;
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
          {threat.text} ({localVal})
        </span>

        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0">{min}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={localVal}
            onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
            title={`Master Difficulty Slider: ${localVal}`}
          />
          <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0">{max}</span>
        </div>
      </div>
    </div>
  );
};
