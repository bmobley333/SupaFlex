// src/components/common/GmMonsterCard.tsx
// GM Monster Card - Single-line high-density layout with full combat specs, alphabetical attributes, & private GM notes.

import React, { useState } from 'react';
import { ItemNotesPopover } from './ItemNotesPopover';
import { formatMonsterDataToStatblock, MonsterStatData } from '../../utils/monsterStatParser';

export interface MonsterData extends MonsterStatData {
  id: string | number;
}

interface GmMonsterCardProps {
  monster: MonsterData;
  onEdit?: (monster: MonsterData) => void;
  onDelete?: (id: string | number) => void;
  onAddToRoster?: (monster: MonsterData) => void;
}

export const GmMonsterCard: React.FC<GmMonsterCardProps> = ({ monster, onEdit, onDelete, onAddToRoster }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const statblock = formatMonsterDataToStatblock(monster);
    navigator.clipboard.writeText(statblock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const countPrefix = monster.count && monster.count > 1 ? `${monster.count} ` : '';
  const equipStr = monster.equipment ? ` (${monster.equipment})` : '';

  const initVal = monster.initiative ?? 10;
  const mrVal = monster.mr ?? 10;
  const atkVal = monster.attack ?? 10;
  const dmgVal = monster.damage ?? 10;
  const defVal = monster.defense ?? 10;
  const armorVal = monster.armor ?? 0;
  const maxVitVal = monster.max_vit ?? 10;

  const attrs = monster.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;


  return (
    <div className="bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono shadow-sm flex flex-wrap items-center justify-between gap-x-3 gap-y-1 transition-all">
      {/* Main Content: Left Arrow (if provided), Name, Combat Specs, and Alphabetical System Attributes */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
        {onAddToRoster && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToRoster(monster);
            }}
            className="text-xs text-amber-300 hover:text-amber-100 hover:scale-110 active:scale-95 transition-all cursor-pointer select-none shrink-0"
            title="Copy monster to 👥&🐉 Encounter Roster"
            aria-label="Copy to Encounter Roster"
          >
            ⬅️
          </button>
        )}
        <span className="font-bold text-amber-300 text-xs shrink-0 inline-flex items-center align-baseline gap-1">
          <span>{countPrefix}{monster.name}{equipStr}</span>
          <ItemNotesPopover notes={monster.gm_notes} itemName={monster.name} inline />
        </span>

        {/* Combat Metrics */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-300 text-[11px] shrink-0">
          <span>🚩{initVal}</span>
          <span>👣{mrVal}</span>
          <span>⚔️{atkVal}/{dmgVal}</span>
          <span>🧥{defVal}/{armorVal}</span>
          <span>❤️{maxVitVal}</span>
        </div>

        {/* System Attributes (Strict Alphabetical Order: ✨ Magic, 💪 Might, 👁️ Mind, 🏃 Motion, 🫀 Moxie) */}
        <span className="text-amber-200/90 font-semibold text-[11px] shrink-0">
          – [✨{magic}/💪{might}/👁️{mind}/🏃{motion}/🫀{moxie}]
        </span>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 shrink-0 select-none">
        <button
          type="button"
          onClick={handleCopy}
          className="text-slate-400 hover:text-amber-300 p-0.5 rounded transition-colors text-xs cursor-pointer select-none"
          title={copied ? "Copied clean statblock!" : "Copy Statblock (Clipboard)"}
          aria-label="Copy Monster Statblock"
        >
          {copied ? '✅' : '📋'}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(monster)}
            className="text-slate-400 hover:text-amber-400 p-0.5 rounded transition-colors text-xs cursor-pointer select-none"
            title="Edit Monster"
            aria-label="Edit Monster"
          >
            ✏️
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(monster.id)}
            className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors text-xs cursor-pointer select-none"
            title="Delete Monster"
            aria-label="Delete Monster"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
};
