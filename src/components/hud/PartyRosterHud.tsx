// src/components/hud/PartyRosterHud.tsx
import React from 'react';
import { Character, PartySessionMember } from '../../types/game';
import { PartyCharacterCard } from '../common/PartyCharacterCard';

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
          {otherMembers.map((member) => (
            <PartyCharacterCard key={member.id || member.character_id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
};
