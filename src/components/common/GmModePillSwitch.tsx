// src/components/common/GmModePillSwitch.tsx
// Dyslexia-Friendly Multi-Option Pill Switch for GM Design Mode vs Game Day Mode

import React from 'react';
import { useAdventureStore } from '../../store/useAdventureStore';

interface GmModePillSwitchProps {
  className?: string;
}

export const GmModePillSwitch: React.FC<GmModePillSwitchProps> = ({ className = '' }) => {
  const sessionMode = useAdventureStore((state) => state.sessionMode);
  const setSessionMode = useAdventureStore((state) => state.setSessionMode);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Dyslexia-Friendly Compact Side-by-Side Pill Switch */}
      <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0 w-[240px]">
        <button
          type="button"
          onClick={() => setSessionMode('design')}
          className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            sessionMode === 'design'
              ? 'bg-amber-600 text-white shadow-sm font-extrabold border border-amber-400/40'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Design Mode: All changes, monsters & notes auto-save permanently to database"
        >
          <span>🛠️</span> Design Mode
        </button>

        <button
          type="button"
          onClick={() => setSessionMode('game_day')}
          className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            sessionMode === 'game_day'
              ? 'bg-emerald-600 text-white shadow-sm font-extrabold border border-emerald-400/40'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Game Day Mode: Live combat scratchpad. Changes are temporary and reset when closed"
        >
          <span>🎲</span> Game Day
        </button>
      </div>

      {/* Explainer Subtext listed to the right */}
      <div className="text-xs font-medium text-slate-300 flex items-center gap-1 font-outfit flex-1 min-w-[260px]">
        {sessionMode === 'design' ? (
          <span className="text-amber-300/90 flex items-center gap-1">
            <span className="text-amber-400 font-bold">🛠️ Design Mode:</span> All changes, monsters & notes auto-save permanently to database.
          </span>
        ) : (
          <span className="text-emerald-300/90 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">🎲 Game Day Mode:</span> Live combat scratchpad — temporary in-memory changes that reset when closed.
          </span>
        )}
      </div>
    </div>
  );
};
