// src/components/common/GmThreatStepper.tsx
// High-Density, Ultra-Compact Threat Level Stepper Badge ([-] [ ⚡ Threat Level (+/-N) ] [+])

import React from 'react';
import { Minus, Plus, Zap } from 'lucide-react';

export interface GmThreatStepperProps {
  value: number; // Master Dif (3 to 25, default 10)
  onChange: (newValue: number) => void;
  label?: string; // Default: 'Threat Level'
  className?: string;
  min?: number;
  max?: number;
}

export const GmThreatStepper: React.FC<GmThreatStepperProps> = ({
  value,
  onChange,
  label = 'Threat Level',
  className = '',
  min = 3,
  max = 25,
}) => {
  const delta = value - 10;

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value > min) {
      onChange(Math.max(min, value - 1));
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value < max) {
      onChange(Math.min(max, value + 1));
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (delta !== 0) {
      onChange(10);
    }
  };

  // Dynamic contextual badge color styling
  let badgeStyle = 'bg-slate-900 text-amber-300/90 border-amber-500/30 hover:border-amber-500/60 shadow-sm';
  if (delta < 0) {
    badgeStyle = 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 hover:border-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
  } else if (delta > 0 && delta <= 5) {
    badgeStyle = 'bg-orange-950/90 text-orange-300 border-orange-500/40 hover:border-orange-500/70 shadow-[0_0_8px_rgba(249,115,22,0.2)]';
  } else if (delta > 5 && delta <= 11) {
    badgeStyle = 'bg-rose-950/90 text-rose-300 border-rose-500/40 hover:border-rose-500/70 shadow-[0_0_10px_rgba(244,63,94,0.25)]';
  } else if (delta > 11) {
    badgeStyle = 'bg-purple-950/90 text-purple-300 border-purple-500/40 hover:border-purple-500/70 shadow-[0_0_10px_rgba(168,85,247,0.3)]';
  }

  // Label formatting
  let displayLabel = label;
  if (delta > 0) {
    displayLabel = `${label}+${delta}`;
  } else if (delta < 0) {
    displayLabel = `${label}${delta}`;
  }

  const tooltipText =
    delta !== 0
      ? `${label} ${delta > 0 ? `+${delta}` : delta} (Dif ${value}) • Click to reset to baseline (10)`
      : `${label} (Baseline Dif 10)`;

  return (
    <div
      className={`inline-flex items-center bg-slate-950/90 border border-slate-800/80 p-0.5 rounded-lg shadow-inner gap-0.5 font-outfit select-none shrink-0 ${className}`}
    >
      {/* Decrement Button */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
        title="Decrease Threat Level (-1)"
      >
        <Minus className="w-3 h-3" />
      </button>

      {/* Center Stepper Badge (Click to reset to baseline) */}
      <button
        type="button"
        onClick={handleReset}
        className={`px-2 py-0.5 text-[11px] font-bold rounded-md border flex items-center gap-1 transition-all cursor-pointer ${badgeStyle}`}
        title={tooltipText}
      >
        <Zap className="w-2.5 h-2.5 shrink-0 opacity-80" />
        <span className="leading-none whitespace-nowrap">{displayLabel}</span>
      </button>

      {/* Increment Button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
        title="Increase Threat Level (+1)"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};
