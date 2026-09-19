import React from 'react';
import { PartySessionMember, CharacterSheetData } from '../../types/game';
import { X } from 'lucide-react';

interface PartyCharacterCardProps {
  member: PartySessionMember;
  playerNameOverride?: string;
  isCurrentPlayer?: boolean;
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
  onDismiss?: () => void;
  isTurnMarked?: boolean;
  onToggleTurnMark?: () => void;
}

/**
 * Resolves player's first name strictly from full name input or email handle.
 * Never returns literal "empty".
 */
export const resolvePlayerFirstName = (rawName?: string, email?: string): string => {
  if (rawName && rawName.trim() && rawName.trim().toLowerCase() !== 'empty') {
    const trimmed = rawName.trim();
    if (trimmed.includes('@')) {
      const handle = trimmed.split('@')[0]?.trim();
      if (handle) return handle;
    }
    const parts = trimmed.split(/\s+/);
    if (parts[0]) return parts[0];
  }
  if (email && email.trim()) {
    const handle = email.split('@')[0]?.trim();
    if (handle) return handle;
  }
  return 'Player';
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
  isCurrentPlayer = false,
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
  onDismiss,
  isTurnMarked = false,
  onToggleTurnMark,
}) => {
  const char = member.character;
  const playerFirstName = resolvePlayerFirstName(playerNameOverride || member.player_first_name, member.player_email);
  const charFirstName = resolveCharFirstName(char?.name || `Hero #${member.character_id}`);
  const race = char?.race || 'Human';
  const charClass = char?.class || 'Adventurer';

  const sheetData: Partial<CharacterSheetData> = char?.sheet_data || {};
  const currentNishVal = sheetData.current_nish ?? (char as any)?.current_nish ?? (char as any)?.initiative;
  const currentNishDisplay =
    currentNishVal !== undefined && currentNishVal !== null && String(currentNishVal).trim() !== ''
      ? String(currentNishVal)
      : '—';
  const currentVit = (char as any)?.current_vitality ?? sheetData.current_vitality ?? char?.hp ?? 28;
  const maxVit = (char as any)?.vitality_max ?? sheetData.vitality_max ?? 28;
  const pct = maxVit > 0 ? Math.min(100, Math.max(0, Math.round((currentVit / maxVit) * 100))) : 0;

  // Color indicator classes based on Vit %: Green = 100%, Red = 50% or less, Orange = between 50% and 100%
  let barColorClass = 'bg-emerald-500';
  let badgeColorClass = 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
  let dotColorClass = 'bg-emerald-400';

  if (pct <= 50) {
    barColorClass = 'bg-rose-500';
    badgeColorClass = 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    dotColorClass = 'bg-rose-400';
  } else if (pct < 100) {
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
        isTurnMarked ? 'opacity-60 bg-slate-950/50' : ''
      } ${
        isDragging
          ? 'opacity-40 border-cyan-500/80 bg-cyan-950/20 scale-[0.99]'
          : 'border-slate-800 hover:border-slate-700'
      }`}
      title={`[Nish: ${currentNishDisplay}] (${playerFirstName}) ${charFirstName} ${race} ${charClass}, ${currentVit}/${maxVit} ${pct}%`}
    >
      {/* Ultra-thin 6px edge drag handle */}
      {isDraggable && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-slate-800/60 group-hover:bg-cyan-500/60 cursor-grab active:cursor-grabbing transition-colors"
          title="Drag to reorder roster position"
        />
      )}

      {/* 
        S-Tier Party Member Card Layout:
        - Row 1 Right Segment: Vitality readout, pulse dot, and health bar are flush right.
        - Left Segment: [🚩 Nish Badge / Turn-Mark Button FIRST (Columnar)], [Self Emoji 👤], Player Name, Character Name, Race, Class.
      */}
      <div className={`flex items-start justify-between gap-2 leading-snug ${isDraggable ? 'pl-2' : ''}`}>
        {/* Left Segment: [🚩 Nish Badge FIRST], [Self Emoji 👤], Player Name, Character Name, Race, Class */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap font-bold text-slate-100">
          {/* 🚩 VERY FIRST ITEM: Interactive fixed-width Nish Badge / Turn-Mark Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleTurnMark) onToggleTurnMark();
            }}
            className={`relative font-mono text-[11px] font-black min-w-[40px] justify-center px-1.5 py-0.5 rounded border shrink-0 shadow-sm flex items-center gap-0.5 transition-all overflow-hidden ${
              onToggleTurnMark ? 'cursor-pointer' : 'cursor-default'
            } ${
              isTurnMarked
                ? 'border-slate-700/60 bg-slate-900/90 text-slate-500 opacity-60'
                : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:border-amber-400 hover:bg-amber-500/25'
            }`}
            title={
              onToggleTurnMark
                ? isTurnMarked
                  ? `Initiative: ${currentNishDisplay} (Turn Completed - Click to unmark)`
                  : `Initiative: ${currentNishDisplay} (Click to mark turn completed)`
                : `Initiative (Nish): ${currentNishDisplay}${isTurnMarked ? ' (Turn Completed)' : ''}`
            }
          >
            <span className="text-[10px] leading-none">🚩</span>
            <span className="tabular-nums">{currentNishDisplay}</span>

            {/* Diagonal Red Slash Line when Turn is Marked Off */}
            {isTurnMarked && (
              <span
                className="absolute inset-0 pointer-events-none flex items-center justify-center"
                aria-hidden="true"
              >
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <line
                    x1="12"
                    y1="88"
                    x2="88"
                    y2="12"
                    stroke="#ef4444"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            )}
          </button>

          {/* 👤 Fast-Find Self Indicator: Rendered immediately after Nish badge for active player */}
          {isCurrentPlayer && (
            <span
              className="text-xs leading-none shrink-0 select-none"
              title="Your Character"
            >
              👤
            </span>
          )}

          <span
            className={`font-mono font-extrabold text-xs shrink-0 ${
              isCurrentPlayer ? 'text-emerald-400' : 'text-amber-300'
            }`}
          >
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

        {/* Right Segment: Vitality readout & fixed-width bar graphic - Anchored Flush Right */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto pt-0.5">
          <span className={`font-mono text-[11px] font-extrabold min-w-[64px] text-center px-1.5 py-0.5 rounded border shrink-0 ${badgeColorClass}`}>
            {currentVit}/{maxVit} {pct}%
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${dotColorClass} animate-pulse shrink-0`} />
            <div className="w-16 h-2 bg-slate-900 rounded-full border border-slate-800 overflow-hidden shrink-0" title={`${pct}% Vitality remaining`}>
              <div
                className={`h-full transition-all duration-500 rounded-full ${barColorClass}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hover Action Toolbar: Overlaid smoothly on hover without consuming idle layout width */}
      {(onNudgeUp || onNudgeDown || onDismiss) && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-950/95 border border-slate-700/80 rounded-lg px-1.5 py-0.5 shadow-lg flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-10 backdrop-blur-sm">
          {onNudgeUp && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNudgeUp();
              }}
              disabled={!canNudgeUp}
              className="px-1 py-0.5 text-[10px] font-bold text-slate-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-slate-400 bg-slate-900 border border-slate-700/60 rounded cursor-pointer"
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
              className="px-1 py-0.5 text-[10px] font-bold text-slate-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-slate-400 bg-slate-900 border border-slate-700/60 rounded cursor-pointer"
              title="Move Down"
            >
              ▼
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-0.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 border border-transparent hover:border-red-500/40 rounded transition-all cursor-pointer ml-0.5"
              title="Dismiss from Party"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
