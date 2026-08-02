// src/components/hud/GmMonsterTrackerHud.tsx
import React, { useState, useEffect } from 'react';
import { parseMonsterLine } from '../../utils/monsterStatParser';

export interface MonsterEntry {
  id: string;
  text?: string;
  fullText?: string;
  reducedText?: string;
}

export const GmMonsterTrackerHud: React.FC = () => {
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

  return (
    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👾</span> GM Monster Stats ({monsters.length})
        </h3>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          GM Live Feed
        </span>
      </div>

      {/* Monster Lines List / Empty State */}
      {monsters.length === 0 ? (
        <div className="text-xs font-semibold text-slate-400 italic p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center">
          No GM monsters at this time.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {monsters.map((m) => {
            const displayText = m.reducedText || (m.fullText ? parseMonsterLine(m.fullText).reducedText : m.text || '');
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 p-2 bg-slate-950/70 border border-slate-800/80 rounded-lg"
              >
                <span className="font-mono text-xs font-semibold text-slate-200 truncate select-all">
                  {displayText}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
