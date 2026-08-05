// src/components/common/GmMonsterCard.tsx
// GM Monster Card - Single-line high-density layout with full combat specs, alphabetical attributes, & private GM notes.

import React from 'react';

export interface MonsterData {
  id: string | number;
  name: string;
  count?: number;
  equipment?: string;
  initiative?: number;
  mr?: number;
  attack?: number;
  damage?: number;
  min_wounds?: number;
  defense?: number;
  armor?: number;
  max_vit?: number;
  current_vit?: number;
  attributes?: {
    magic?: number;
    might?: number;
    mind?: number;
    motion?: number;
    moxie?: number;
  };
  gm_notes?: string;
}

interface GmMonsterCardProps {
  monster: MonsterData;
  onEdit?: (monster: MonsterData) => void;
  onDelete?: (id: string | number) => void;
}

export const GmMonsterCard: React.FC<GmMonsterCardProps> = ({ monster, onEdit, onDelete }) => {
  const countPrefix = monster.count && monster.count > 1 ? `${monster.count} ` : '';
  const equipStr = monster.equipment ? ` (${monster.equipment})` : '';

  const initVal = monster.initiative ?? 10;
  const mrVal = monster.mr ?? 10;
  const atkVal = monster.attack ?? 10;
  const dmgVal = monster.damage ?? 10;
  const minWoundsVal = monster.min_wounds ?? 1;
  const defVal = monster.defense ?? 10;
  const armorVal = monster.armor ?? 0;
  const maxVitVal = monster.max_vit ?? 10;

  const attrs = monster.attributes || {};
  const magic = attrs.magic ?? 10;
  const might = attrs.might ?? 10;
  const mind = attrs.mind ?? 10;
  const motion = attrs.motion ?? 10;
  const moxie = attrs.moxie ?? 10;

  const notesStr = monster.gm_notes ? ` (${monster.gm_notes})` : '';

  return (
    <div className="bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono shadow-sm flex flex-wrap items-center justify-between gap-x-3 gap-y-1 transition-all">
      {/* Main Content: Name, Combat Specs, and Alphabetical System Attributes */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
        <span className="font-bold text-amber-300 text-xs shrink-0">
          {countPrefix}{monster.name}{equipStr}
        </span>

        {/* Combat Metrics */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-300 text-[11px] shrink-0">
          <span>🚩{initVal}</span>
          <span>👣{mrVal}</span>
          <span>⚔️{atkVal}/{dmgVal}({minWoundsVal})</span>
          <span>🧥{defVal}/{armorVal}</span>
          <span>❤️{maxVitVal}</span>
        </div>

        {/* System Attributes (Strict Alphabetical Order: ✨ Magic, 💪 Might, 👁️ Mind, 🏃 Motion, 🫀 Moxie) */}
        <span className="text-amber-200/90 font-semibold text-[11px] shrink-0">
          – [✨{magic}/💪{might}/👁️{mind}/🏃{motion}/🫀{moxie}]
        </span>

        {/* Private GM Notes */}
        {notesStr && <span className="italic text-slate-400 text-[11px] truncate">{notesStr}</span>}
      </div>

      {/* Action Controls */}
      {(onEdit || onDelete) && (
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(monster)}
              className="text-slate-400 hover:text-amber-400 p-0.5 rounded transition-colors text-xs"
              title="Edit Monster"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(monster.id)}
              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors text-xs"
              title="Delete Monster"
            >
              🗑️
            </button>
          )}
        </div>
      )}
    </div>
  );
};
