// src/components/common/PlayerMonsterCard.tsx
// Player Monster Card - Sanitized player view excluding private GM notes, initiative, MR, and attributes.

import React from 'react';
import { MonsterData } from './GmMonsterCard';

interface PlayerMonsterCardProps {
  monster: MonsterData;
}

export const PlayerMonsterCard: React.FC<PlayerMonsterCardProps> = ({ monster }) => {
  const equipStr = monster.equipment ? ` (${monster.equipment})` : '';
  const atkVal = monster.attack ?? 10;
  const dmgVal = monster.damage ?? 10;
  const defVal = monster.defense ?? 10;
  const armorVal = monster.armor ?? 0;
  const maxVitVal = monster.max_vit ?? 10;

  const cleanName = (monster.name || '').replace(/^\d+\s*/, '');

  return (
    <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-2.5 text-xs text-slate-200 font-mono shadow-sm flex flex-wrap items-center justify-start gap-x-4 gap-y-1">
      <span className="font-bold text-slate-100">
        {cleanName}{equipStr}
      </span>
      <div className="flex items-center gap-3 text-slate-300">
        <span>⚔️{atkVal}/{dmgVal}</span>
        <span>🧥{defVal}/{armorVal}</span>
        <span>❤️{maxVitVal}</span>
      </div>
    </div>
  );
};
