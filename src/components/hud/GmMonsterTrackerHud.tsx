// src/components/hud/GmMonsterTrackerHud.tsx
// GM & Player Monster Tracker HUD - Displays live monster encounter stats using GmMonsterCard / PlayerMonsterCard.

import React, { useState, useEffect } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { PlayerMonsterCard } from '../common/PlayerMonsterCard';
import { parseMonsterLine, sortMonstersAlphabetically } from '../../utils/monsterStatParser';
import { gameApi } from '../../services/api';
import { supabase } from '../../lib/supabase';

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
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const [monsters, setMonsters] = useState<MonsterEntry[]>([]);

  useEffect(() => {
    // When role is player and NOT in an active party, Monster Tracker MUST be strictly empty.
    if (activeRole === 'player' && !activePartyId) {
      setMonsters([]);
      return;
    }

    let isMounted = true;

    const loadMonsters = async () => {
      if (activeRole === 'player' && activePartyId) {
        try {
          const list = await gameApi.getPartyMonsters(activePartyId);
          if (isMounted && Array.isArray(list)) {
            setMonsters(list);
          }
        } catch (err) {
          console.error('[GmMonsterTrackerHud] Error loading party monsters:', err);
        }
      } else {
        // GM Mode or fallback local state
        try {
          const saved = localStorage.getItem('supaflex_gm_monster_stats');
          if (saved && isMounted) {
            const parsed = JSON.parse(saved);
            setMonsters(Array.isArray(parsed) ? parsed : []);
          }
        } catch (e) {
          console.error('Failed to load monster stats:', e);
        }
      }
    };

    loadMonsters();

    // Set up Realtime Broadcast channel when joined to a party
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (activeRole === 'player' && activePartyId) {
      channel = supabase.channel(`party_monsters_hud_${activePartyId}`);
      channel
        .on('broadcast', { event: 'monster_roster_updated' }, (payload) => {
          if (isMounted && payload?.payload?.monsters) {
            setMonsters(payload.payload.monsters);
          }
        })
        .subscribe();
    }

    // Storage listener fallback for local browser tabs
    const handleStorageChange = () => {
      if (activeRole === 'gm') {
        try {
          const saved = localStorage.getItem('supaflex_gm_monster_stats');
          if (saved && isMounted) {
            setMonsters(JSON.parse(saved));
          }
        } catch (e) {
          console.error('Error syncing monster stats:', e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeRole, activePartyId]);

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
    <div className="bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950/95 p-3.5 rounded-2xl border border-slate-800/90 border-t-2 border-t-amber-500/90 shadow-lg shadow-amber-950/20 space-y-3 font-outfit">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.25)]">
            <span className="text-xs leading-none">🐉</span>
          </div>
          <h3 className="text-xs font-extrabold text-amber-200 uppercase tracking-wider font-outfit">
            MONSTER TRACKER ({monsters.length})
          </h3>
        </div>
      </div>

      {/* Monster Cards List / Empty State */}
      {monsters.length === 0 ? (
        <div className="text-xs font-semibold text-slate-500 italic p-3 bg-slate-950/60 rounded-xl border border-slate-800/50 text-center">
          No active monsters in encounter.
        </div>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {sortMonstersAlphabetically(monsters).map((m) => {
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
