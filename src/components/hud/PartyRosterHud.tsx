// src/components/hud/PartyRosterHud.tsx
import React from 'react';
import { Character } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';

interface PartyRosterHudProps {
  activeCharacter: Character | null;
  playerEmail: string;
}

export const PartyRosterHud: React.FC<PartyRosterHudProps> = ({
  activeCharacter,
  playerEmail,
}) => {
  const storePlayerName = useCharacterStore((state) => state.playerName);

  // Extract User's First Name
  const getUserFirstName = (): string => {
    if (storePlayerName && storePlayerName.trim()) {
      return storePlayerName.trim().split(' ')[0];
    }
    if (playerEmail && playerEmail.includes('@')) {
      return playerEmail.split('@')[0];
    }
    return playerEmail || 'Player';
  };

  const userFirstName = getUserFirstName();

  if (!activeCharacter) {
    return (
      <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-2">
        <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👥</span> Party Roster
        </h3>
        <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg text-center">
          No hero selected. Load a hero to display party vitality status.
        </div>
      </div>
    );
  }

  // Extract Character FIRST Name Only
  const charFirstName = (activeCharacter.name || 'Hero').trim().split(' ')[0];

  const sheetData = activeCharacter.sheet_data || {};
  const currentVit = sheetData.current_vitality ?? activeCharacter.hp ?? 28;
  const maxVit = sheetData.vitality_max ?? 28;

  const pct = maxVit > 0 ? Math.min(100, Math.max(0, Math.round((currentVit / maxVit) * 100))) : 0;

  // Determine health bar color
  let barColorClass = 'bg-emerald-500';
  let badgeColorClass = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

  if (pct === 0) {
    barColorClass = 'bg-red-700';
    badgeColorClass = 'text-red-400 border-red-500/40 bg-red-500/10';
  } else if (pct < 25) {
    barColorClass = 'bg-red-500';
    badgeColorClass = 'text-red-400 border-red-500/40 bg-red-500/10';
  } else if (pct < 75) {
    barColorClass = 'bg-amber-500';
    badgeColorClass = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  }

  return (
    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👥</span> Party Roster (1)
        </h3>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          Active Party
        </span>
      </div>

      {/* Member Card */}
      <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2.5 hover:border-slate-700/80 transition-all">
        {/* User First Name & Character First Name */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="font-mono text-xs font-extrabold text-amber-300 shrink-0">
              [{userFirstName}]
            </span>
            <span className="font-outfit font-extrabold text-sm text-slate-100 truncate">
              {charFirstName}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/35 text-purple-300 text-[10px] font-bold">
              {activeCharacter.race || 'Human'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-[10px] font-bold">
              {activeCharacter.class || 'Adventurer'}
            </span>
          </div>
        </div>

        {/* Vitality Bar & Percentage Readout */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              ❤️ Vitality
            </span>
            <span className={`font-mono text-xs font-extrabold px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
              {currentVit} / {maxVit} ({pct}%)
            </span>
          </div>

          {/* Color-Coded Progress Bar */}
          <div className="w-full h-2.5 bg-slate-900 rounded-full border border-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-500 rounded-full ${barColorClass}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
