// src/components/common/PartyCharacterCard.tsx
import React from 'react';
import { PartySessionMember, CharacterSheetData } from '../../types/game';

interface PartyCharacterCardProps {
  member: PartySessionMember;
  playerNameOverride?: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  onNudgeUp?: () => void;
  onNudgeDown?: () => void;
  canNudgeUp?: boolean;
  canNudgeDown?: boolean;
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
  isDraggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
  onNudgeUp,
  onNudgeDown,
  canNudgeUp = false,
  canNudgeDown = false,
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
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative p-2.5 bg-slate-950/80 border rounded-xl space-y-1.5 transition-all font-outfit text-xs text-slate-200 ${
        isDragging
          ? 'opacity-40 border-cyan-500/80 bg-cyan-950/20 scale-[0.99]'
          : 'border-slate-800 hover:border-slate-700'
      }`}
      title={`(${playerFirstName}) ${charFirstName} ${race} ${charClass}, ${currentVit}/${maxVit} ${pct}%`}
    >
      {/* Ultra-thin 6px edge drag handle */}
      {isDraggable && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-slate-800/60 group-hover:bg-cyan-500/60 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder roster position"
        />
      )}

      {/* 
        Single-line layout for wide viewports, wrapped two-line layout for narrow sidebar panels.
        Blueprint 2.C Syntax: ([Player's First Name]) [Character's First Name] [Race] [Class], [Current Vit]/[Max Vit] [Vit %]% [vitality graphic]
      */}
      <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 leading-snug ${isDraggable ? 'pl-2' : ''}`}>
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

        {/* Right Segment: Vitality readout, bar graphic, & touch nudge arrows */}
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

          {/* Micro Nudge Arrows (Visible on card hover/focus) */}
          {(onNudgeUp || onNudgeDown) && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity ml-1">
              {onNudgeUp && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNudgeUp();
                  }}
                  disabled={!canNudgeUp}
                  className="px-1 py-0.2 text-[10px] font-bold text-slate-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-slate-400 bg-slate-900 border border-slate-700/60 rounded"
                  title="Move Up"
                >
                  ▲
                </button>
              )}
              {onNudgeDown && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNudgeDown();
                  }}
                  disabled={!canNudgeDown}
                  className="px-1 py-0.2 text-[10px] font-bold text-slate-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-slate-400 bg-slate-900 border border-slate-700/60 rounded"
                  title="Move Down"
                >
                  ▼
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
