// src/components/hud/GmMonsterTrackerHud.tsx
// GM Monster Tracker HUD - Displays live monster encounter stats using GmMonsterCard / PlayerMonsterCard.

import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { PlayerMonsterCard } from '../common/PlayerMonsterCard';
import { parseMonsterLine } from '../../utils/monsterStatParser';

export interface MonsterEntry {
  id: string;
  name?: string;
  text?: string;
  fullText?: string;
  reducedText?: string;
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

export const GmMonsterTrackerHud: React.FC = () => {
  const activeRole = useCharacterStore((state) => state.activeRole);
  const [monsters, setMonsters] = useState<MonsterEntry[]>(() => {
    try {
      const saved = localStorage.getItem('supaflex_gm_monster_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Failed to load monster stats:', e);
    }
    return [];
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('supaflex_gm_monster_stats');
        if (saved) {
          setMonsters(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Error syncing monster stats:', e);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const mapToMonsterData = (m: MonsterEntry): MonsterData => {
    if (m.name) {
      return m as MonsterData;
    }
    // Parse raw text string if structured fields are not present
    const raw = m.fullText || m.text || m.reducedText || 'Monster';
    const parsed = parseMonsterLine(raw);

    // Extract numbers from parsed stats if possible
    const atkNums = parsed.attackStat.match(/\d+/g) || [];
    const defNums = parsed.defenseStat.match(/\d+/g) || [];
    const hpNums = parsed.vitalityStat.match(/\d+/g) || [];

    const notesMatch = raw.match(/(?:\]|❤️\s*\d+)\s*\((.*)\)$/);
    const attrMatch = raw.match(/\[✨\s*(\d+)\s*\/\s*💪\s*(\d+)\s*\/\s*👁️\s*(\d+)\s*\/\s*🏃\s*(\d+)\s*\/\s*(?:🫀|💖)\s*(\d+)\]/u);

    return {
      id: m.id,
      name: parsed.nameWithEquip || 'Monster',
      count: m.count || 1,
      equipment: m.equipment,
      initiative: m.initiative ?? 10,
      mr: m.mr ?? 10,
      attack: m.attack ?? (atkNums[0] ? parseInt(atkNums[0], 10) : 10),
      damage: m.damage ?? (atkNums[1] ? parseInt(atkNums[1], 10) : 10),
      min_wounds: m.min_wounds ?? (atkNums[2] ? parseInt(atkNums[2], 10) : 1),
      defense: m.defense ?? (defNums[0] ? parseInt(defNums[0], 10) : 10),
      armor: m.armor ?? (defNums[1] ? parseInt(defNums[1], 10) : 0),
      max_vit: m.max_vit ?? (hpNums[0] ? parseInt(hpNums[0], 10) : 10),
      current_vit: m.current_vit ?? (hpNums[0] ? parseInt(hpNums[0], 10) : 10),
      attributes: m.attributes || (attrMatch ? {
        magic: parseInt(attrMatch[1], 10),
        might: parseInt(attrMatch[2], 10),
        mind: parseInt(attrMatch[3], 10),
        motion: parseInt(attrMatch[4], 10),
        moxie: parseInt(attrMatch[5], 10),
      } : {
        magic: 10,
        might: 10,
        mind: 10,
        motion: 10,
        moxie: 10,
      }),
      gm_notes: m.gm_notes || (notesMatch ? notesMatch[1] : undefined),
    };
  };

  return (
    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-3 font-outfit">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👾</span> MONSTER TRACKER ({monsters.length})
        </h3>
      </div>

      {/* Monster Cards List / Empty State */}
      {monsters.length === 0 ? (
        <div className="text-xs font-semibold text-slate-500 italic p-3 bg-slate-950/60 rounded-xl border border-slate-800/50 text-center">
          No active monsters in encounter.
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {monsters.map((m) => {
            const data = mapToMonsterData(m);
            return activeRole === 'gm' ? (
              <GmMonsterCard key={m.id} monster={data} />
            ) : (
              <PlayerMonsterCard key={m.id} monster={data} />
            );
          })}
        </div>
      )}
    </div>
  );
};
