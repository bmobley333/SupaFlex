// src/components/common/GmMonsterCard.tsx
// GM Monster Card - High-density layout with full combat specs, down chevron disclosure (⚔️🧥 & 🔥), & private GM notes.

import React, { useState } from 'react';
import { ItemNotesPopover } from './ItemNotesPopover';
import { GmMinionVitSelector } from './GmMinionVitSelector';
import { MonsterStatData } from '../../utils/monsterStatParser';

export interface MonsterData extends MonsterStatData {
  id: string | number;
}

interface GmMonsterCardProps {
  monster: MonsterData;
  onEdit?: (monster: MonsterData) => void;
  onDelete?: (id: string | number) => void;
  onAddToRoster?: (monster: MonsterData) => void;
  onSetMinionVit?: (monsterId: string | number, minionVit: number | undefined) => void;
  isTurnMarked?: boolean;
  onToggleTurnMark?: () => void;
  showDragonIcon?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export const GmMonsterCard: React.FC<GmMonsterCardProps> = ({
  monster,
  onEdit,
  onDelete,
  onAddToRoster,
  onSetMinionVit,
  isTurnMarked,
  onToggleTurnMark,
  showDragonIcon,
  isSelected,
  onToggleSelect,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const countPrefix = monster.count && monster.count > 1 ? `${monster.count} ` : '';
  let extractedNameGear = '';
  const parenMatch = (monster.name || '').match(/\(([^)]+)\)/);
  if (parenMatch) {
    extractedNameGear = parenMatch[1].trim();
  } else {
    const bracketMatch = (monster.name || '').match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      extractedNameGear = bracketMatch[1].trim();
    }
  }

  const gearText = monster.gear || monster.equipment || extractedNameGear;
  const cleanName = (monster.name || 'Monster')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || 'Monster';

  const initVal = monster.initiative ?? 10;
  const mrVal = monster.mr ?? 10;
  const atkVal = monster.attack ?? 10;
  const dmgVal = monster.damage ?? 10;
  const woundsVal = monster.min_wounds && monster.min_wounds > 1 ? `(${monster.min_wounds})` : '';
  const defVal = monster.defense ?? 10;
  const armorVal = monster.armor ?? 0;
  const isMinion = typeof monster.minion_vit === 'number' && monster.minion_vit > 0;
  const maxVitVal = isMinion ? monster.minion_vit! : (monster.max_vit ?? monster.current_vit ?? 10);

  const attrs = monster.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;

  const abilitiesText = monster.abilities || '';
  const notesText = monster.gm_notes || abilitiesText || '';

  return (
    <div
      onDoubleClick={(e) => {
        e.preventDefault();
        setIsExpanded((prev) => !prev);
      }}
      className={`border rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono shadow-sm flex flex-col gap-1 transition-all w-full cursor-pointer select-none ${
        isSelected
          ? 'bg-purple-950/40 border-purple-500/70 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
          : 'bg-slate-900/90 border-rose-500/30 hover:border-rose-500/50'
      }`}
    >
      {/* Main Row */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 w-full">
        {/* Main Content */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0 accent-purple-600"
              title={isSelected ? 'Deselect monster' : 'Select monster for batch Threat scaling'}
            />
          )}

          {showDragonIcon && (
            <span className="text-xs leading-none shrink-0 select-none">🐉</span>
          )}
          {onAddToRoster && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToRoster(monster);
              }}
              className="text-xs text-rose-300 hover:text-rose-100 hover:scale-110 active:scale-95 transition-all cursor-pointer select-none shrink-0"
              title="Copy monster to 👥&🐉 Encounter Roster"
              aria-label="Copy to Encounter Roster"
            >
              ⬅️
            </button>
          )}

          <span
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="font-extrabold text-rose-200 hover:text-rose-100 hover:underline tracking-wide text-xs shrink-0 cursor-pointer select-none"
            title={isExpanded ? 'Click to collapse details' : 'Click to expand details'}
          >
            {countPrefix}{cleanName}
          </span>

          {/* Initiative Button or Static Display */}
          {onToggleTurnMark ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTurnMark();
              }}
              className={`relative font-mono text-[11px] font-black min-w-[40px] justify-center px-1.5 py-0.5 rounded border shrink-0 shadow-sm flex items-center gap-0.5 cursor-pointer transition-all overflow-hidden ${
                isTurnMarked
                  ? 'border-slate-700/60 bg-slate-900/90 text-slate-500 opacity-60'
                  : 'border-rose-500/50 bg-rose-500/15 text-rose-300 hover:border-rose-400 hover:bg-rose-500/25'
              }`}
              title={
                isTurnMarked
                  ? `Initiative: ${initVal} (Turn Completed - Click to unmark)`
                  : `Initiative: ${initVal} (Click to mark turn completed)`
              }
            >
              <span className="text-[10px] leading-none">🚩</span>
              <span className="tabular-nums">{initVal}</span>
              {isTurnMarked && (
                <span className="absolute inset-0 pointer-events-none flex items-center justify-center" aria-hidden="true">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <line x1="12" y1="88" x2="88" y2="12" stroke="#ef4444" strokeWidth="14" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </button>
          ) : (
            <span className="text-slate-300 text-[11px] shrink-0">🚩{initVal}</span>
          )}

          {/* Combat Metrics */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-300 text-[11px] shrink-0">
            <span>👣{mrVal}</span>
            <span>⚔️{atkVal}/{dmgVal}{woundsVal}</span>
            <span>🧥{defVal}/{armorVal}</span>
            {onSetMinionVit ? (
              <GmMinionVitSelector
                currentVit={maxVitVal}
                baseVit={monster.base_vit ?? (isMinion ? undefined : maxVitVal)}
                minionVit={monster.minion_vit}
                onSelect={(newMinionVit) => onSetMinionVit(monster.id, newMinionVit)}
              />
            ) : isMinion ? (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 border border-purple-500/50 font-bold shadow-[0_0_8px_rgba(168,85,247,0.25)]"
                title={`Minion Class (Locked Vit: ${monster.minion_vit} • Threat-Level Immune)`}
              >
                <span className="text-[11px] leading-none">💔</span>
                <span className="text-[11px] font-extrabold text-purple-300 tabular-nums">{monster.minion_vit}</span>
              </span>
            ) : (
              <span>❤️{maxVitVal}</span>
            )}
          </div>

          {/* System Attributes (Strict Alphabetical Order: ✨ Magic, 💪 Might, 👁️ Mind, 🏃 Motion, 🫀 Moxie) */}
          <span className="text-amber-300/90 font-semibold text-[11px] shrink-0">
            – [✨{magic}/💪{might}/👁️{mind}/🏃{motion}/🫀{moxie}]
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 select-none">
          <ItemNotesPopover notes={notesText} itemName={cleanName} />
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(monster);
              }}
              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors text-xs cursor-pointer select-none"
              title="Edit Monster"
              aria-label="Edit Monster"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(monster.id);
              }}
              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors text-xs cursor-pointer select-none"
              title="Delete Monster"
              aria-label="Delete Monster"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Expanded Accordion Rows: ⚔️🧥 and 🔥 */}
      {isExpanded && (
        <div className="w-full pt-1.5 mt-0.5 border-t border-rose-900/40 text-[11px] font-mono space-y-1 text-slate-300 animate-in fade-in duration-150">
          <div className="flex items-start gap-1.5 leading-snug">
            <span className="text-amber-400 font-bold shrink-0 select-none">⚔️🧥:</span>
            <span className="text-slate-200 break-words">{gearText}</span>
          </div>
          <div className="flex items-start gap-1.5 leading-snug">
            <span className="text-rose-400 font-bold shrink-0 select-none">🔥:</span>
            <span className="text-slate-200 break-words">{abilitiesText || notesText}</span>
          </div>
        </div>
      )}
    </div>
  );
};
