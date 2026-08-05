// src/components/common/PartyCharacterCard.tsx
import React from 'react';
import { PartySessionMember, CharacterSheetData } from '../../types/game';

interface PartyCharacterCardProps {
  member: PartySessionMember;
  playerNameOverride?: string;
}

/**
 * Resolves player's first name strictly from full name input.
 * Blueprint Section 2.C: ([Player's First Name derived from player's full name (NOT email)])
 * If name is blank or missing, returns "empty".
 */
export const resolvePlayerFirstName = (rawName?: string): string => {
  if (!rawName) return 'empty';
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.includes('@')) return 'empty';

  const parts = trimmed.split(/\s+/);
  return parts[0] || 'empty';
};

/**
 * Extracts character's first name from full character name.
 */
export const resolveCharFirstName = (rawCharName?: string): string => {
  if (!rawCharName) return 'Hero';
  const trimmed = rawCharName.trim();
  if (!trimmed) return 'Hero';
  const parts = trimmed.split(/\s+/);
  return parts[0] || 'Hero';
};

export const PartyCharacterCard: React.FC<PartyCharacterCardProps> = ({
  member,
  playerNameOverride,
}) => {
  const char = member.character;
  const playerFirstName = resolvePlayerFirstName(playerNameOverride || member.player_first_name);
  const charFirstName = resolveCharFirstName(char?.name || `Hero #${member.character_id}`);
  const race = char?.race || 'Human';
  const charClass = char?.class || 'Adventurer';

  const sheetData: Partial<CharacterSheetData> = char?.sheet_data || {};
  const currentVit = sheetData.current_vitality ?? char?.hp ?? 28;
  const maxVit = sheetData.vitality_max ?? 28;
  const pct = maxVit > 0 ? Math.min(100, Math.max(0, Math.round((currentVit / maxVit) * 100))) : 0;

  // Color indicator classes based on Vit %
  let barColorClass = 'bg-emerald-500';
  let badgeColorClass = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  let dotColorClass = 'bg-emerald-400';

  if (pct < 25) {
    barColorClass = 'bg-red-500';
    badgeColorClass = 'text-red-400 border-red-500/40 bg-red-500/10';
    dotColorClass = 'bg-red-400';
  } else if (pct < 75) {
    barColorClass = 'bg-amber-500';
    badgeColorClass = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    dotColorClass = 'bg-amber-400';
  }

  return (
    <div
      className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700 transition-all font-outfit text-xs text-slate-200"
      title={`(${playerFirstName}) ${charFirstName} ${race} ${charClass}, ${currentVit}/${maxVit} ${pct}%`}
    >
      {/* 
        Single-line layout for wide viewports, wrapped two-line layout for narrow sidebar panels.
        Blueprint 2.C Syntax: ([Player's First Name]) [Character's First Name] [Race] [Class], [Current Vit]/[Max Vit] [Vit %]% [vitality graphic]
        Example: (Blake) Ogluck Human Monk, 12/24 50% [🟧 50% Bar]
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 leading-snug">
        {/* Left Segment: Player Name, Character Name, Race, Class, and Trailing Comma */}
        <div className="flex items-center gap-1.5 flex-wrap font-bold text-slate-100">
          <span className="font-mono text-amber-300 font-extrabold text-xs">
            ({playerFirstName})
          </span>
          <span className="text-slate-100 font-extrabold text-xs">
            {charFirstName}
          </span>
          <span className="text-purple-300 font-semibold text-[11px]">
            {race}
          </span>
          <span className="text-indigo-300 font-semibold text-[11px]">
            {charClass},
          </span>
        </div>

        {/* Right Segment: Vitality numerical readout & vitality bar graphic */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded border ${badgeColorClass}`}>
            {currentVit}/{maxVit} {pct}%
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${dotColorClass} animate-pulse shrink-0`} />
            <div className="w-12 h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden shrink-0">
              <div
                className={`h-full transition-all duration-500 rounded-full ${barColorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
