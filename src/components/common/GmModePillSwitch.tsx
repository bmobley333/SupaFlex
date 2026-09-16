// src/components/common/GmModePillSwitch.tsx
// Dyslexia-Friendly Multi-Option Pill Switch for GM Design Mode vs Game Day Mode

import React, { useState } from 'react';
import { useAdventureStore } from '../../store/useAdventureStore';

interface GmModePillSwitchProps {
  className?: string;
}

export const GmModePillSwitch: React.FC<GmModePillSwitchProps> = ({ className = '' }) => {
  const sessionMode = useAdventureStore((state) => state.sessionMode);
  const setSessionMode = useAdventureStore((state) => state.setSessionMode);
  const revertGameDayToDesign = useAdventureStore((state) => state.revertGameDayToDesign);

  const [showRevertModal, setShowRevertModal] = useState(false);

  const handleDesignClick = () => {
    if (sessionMode === 'game_day') {
      setShowRevertModal(true);
    } else {
      setSessionMode('design');
    }
  };

  const handleConfirmRevert = () => {
    revertGameDayToDesign();
    setShowRevertModal(false);
  };

  const handleCancelRevert = () => {
    setShowRevertModal(false);
  };

  return (
    <>
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        {/* Dyslexia-Friendly Compact Side-by-Side Pill Switch */}
        <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0 w-[270px] whitespace-nowrap flex-nowrap">
          <button
            type="button"
            onClick={handleDesignClick}
            className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              sessionMode === 'design'
                ? 'bg-amber-600 text-white shadow-sm font-extrabold border border-amber-400/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            title="Design Mode: All changes, monsters & notes auto-save permanently to database"
          >
            <span>🛠️</span>
            <span>Design Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setSessionMode('game_day')}
            className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
              sessionMode === 'game_day'
                ? 'bg-emerald-600 text-white shadow-sm font-extrabold border border-emerald-400/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            title="Game Day Mode: Live combat scratchpad — in-memory changes; switching to Design Mode restores saved designs"
          >
            <span>🎲</span>
            <span>Game Day</span>
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
              <span className="text-emerald-400 font-bold">🎲 Game Day Mode:</span> Live combat scratchpad — in-memory changes; switching to Design Mode restores saved designs.
            </span>
          )}
        </div>
      </div>

      {/* Confirmation Warning Modal when moving from Game Day to Design Mode */}
      {showRevertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl text-slate-100 flex flex-col gap-4 font-outfit">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400 shrink-0">
                ⚠️
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-amber-400 font-outfit uppercase tracking-wider">
                  Revert to Design Mode?
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  Confirm scratchpad reset
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed space-y-2 shadow-inner">
              <p>
                Switching to <strong className="text-amber-300 font-bold">Design Mode</strong> will <strong className="text-rose-400 font-bold">discard all temporary Game Day scratchpad changes</strong> (monsters, combat notes, difficulty scaling, and live loot).
              </p>
              <p className="text-[11px] text-slate-400">
                Your saved database design will be 100% restored.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleCancelRevert}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>✕</span> Keep Playing (Game Day)
              </button>
              <button
                type="button"
                onClick={handleConfirmRevert}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🛠️</span> Discard & Return to Design Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
