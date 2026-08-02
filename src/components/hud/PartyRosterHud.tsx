// src/components/hud/PartyRosterHud.tsx
import React from 'react';
import { Character, PartySessionMember } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';

interface PartyRosterHudProps {
  activeCharacter: Character | null;
  playerEmail: string;
  partyMembers?: PartySessionMember[];
}

export const PartyRosterHud: React.FC<PartyRosterHudProps> = ({
  activeCharacter,
  playerEmail,
  partyMembers = [],
}) => {
  const storePlayerName = useCharacterStore((state) => state.playerName);

  // Extract User's First Name
  const getUserFirstName = (email?: string, name?: string): string => {
    if (name && name.trim()) {
      return name.trim().split(' ')[0];
    }
    if (storePlayerName && storePlayerName.trim()) {
      return storePlayerName.trim().split(' ')[0];
    }
    const targetEmail = email || playerEmail;
    if (targetEmail && targetEmail.includes('@')) {
      return targetEmail.split('@')[0];
    }
    return targetEmail || 'Player';
  };

  // Filter out current user's own character/email
  const otherMembers = partyMembers.filter((m) => {
    const isSameEmail = m.player_email?.toLowerCase().trim() === playerEmail?.toLowerCase().trim();
    const isSameChar = activeCharacter && m.character_id === activeCharacter.id;
    return !isSameEmail && !isSameChar;
  });

  return (
    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👥</span> Party Roster ({otherMembers.length})
        </h3>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          Party Session
        </span>
      </div>

      {/* Roster Cards List */}
      {otherMembers.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
          No other party members in session.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {otherMembers.map((member) => {
            const char = member.character;
            const charFirstName = char?.name ? char.name.trim().split(' ')[0] : 'Hero';
            const userFirstName = getUserFirstName(member.player_email);

            const sheetData: any = char?.sheet_data || {};
            const currentVit = sheetData.current_vitality ?? char?.hp ?? 28;
            const maxVit = sheetData.vitality_max ?? 28;
            const pct = maxVit > 0 ? Math.min(100, Math.max(0, Math.round((currentVit / maxVit) * 100))) : 0;

            let barColorClass = 'bg-emerald-500';
            let badgeColorClass = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

            if (pct < 25) {
              barColorClass = 'bg-red-500';
              badgeColorClass = 'text-red-400 border-red-500/40 bg-red-500/10';
            } else if (pct < 75) {
              barColorClass = 'bg-amber-500';
              badgeColorClass = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
            }

            return (
              <div
                key={member.id || member.character_id}
                className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-2 hover:border-slate-700/80 transition-all"
              >
                {/* Row 1: User First Name & Character FIRST Name Only */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-mono text-xs font-extrabold text-amber-300 shrink-0">
                    [{userFirstName}]
                  </span>
                  <span className="font-outfit font-extrabold text-sm text-slate-100 truncate">
                    {charFirstName}
                  </span>
                </div>

                {/* Row 2: Badges (Race & Class) + Vitality Label & Readout */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/35 text-purple-300 text-[10px] font-bold">
                      {char?.race || 'Human'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-[10px] font-bold">
                      {char?.class || 'Adventurer'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">❤️</span>
                    <span className={`font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
                      {currentVit} / {maxVit} ({pct}%)
                    </span>
                  </div>
                </div>

                {/* Row 3: Color-Coded Progress Bar */}
                <div className="w-full h-2 bg-slate-900 rounded-full border border-slate-800/80 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${barColorClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
