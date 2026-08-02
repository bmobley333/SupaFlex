// src/components/hud/GmMonsterTrackerHud.tsx
import React, { useState, useEffect } from 'react';

export interface MonsterEntry {
  id: string;
  text: string;
}

export const GmMonsterTrackerHud: React.FC = () => {
  const [monsters] = useState<MonsterEntry[]>(() => {
    try {
      const saved = localStorage.getItem('supaflex_gm_monster_stats');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Purge legacy mock items saved during initial testing
        if (
          Array.isArray(parsed) &&
          parsed.some((m: any) => m.text?.includes('Bandit Archer') || m.text?.includes('Goblin Chief'))
        ) {
          localStorage.removeItem('supaflex_gm_monster_stats');
          return [];
        }
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error('Failed to load monster stats:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('supaflex_gm_monster_stats', JSON.stringify(monsters));
    } catch (e) {
      console.error('Failed to save monster stats:', e);
    }
  }, [monsters]);

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
          {monsters.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 p-2 bg-slate-950/70 border border-slate-800/80 rounded-lg"
            >
              <span className="font-mono text-xs font-semibold text-slate-200 truncate select-all">
                {m.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
