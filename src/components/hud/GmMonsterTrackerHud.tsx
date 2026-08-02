// src/components/hud/GmMonsterTrackerHud.tsx
import React, { useState, useEffect } from 'react';

export interface MonsterEntry {
  id: string;
  text: string;
}

const DEFAULT_MONSTERS: MonsterEntry[] = [
  { id: '1', text: 'Bandit Archer  ⚔️16 / 5 (1)  🧥14 / 1  ❤️8' },
  { id: '2', text: 'Goblin Chief   ⚔️18 / 6 (2)  🧥16 / 2  ❤️15' },
];

export const GmMonsterTrackerHud: React.FC = () => {
  const [monsters, setMonsters] = useState<MonsterEntry[]>(() => {
    try {
      const saved = localStorage.getItem('supaflex_gm_monster_stats');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load monster stats:', e);
    }
    return DEFAULT_MONSTERS;
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('supaflex_gm_monster_stats', JSON.stringify(monsters));
    } catch (e) {
      console.error('Failed to save monster stats:', e);
    }
  }, [monsters]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    const newItem: MonsterEntry = {
      id: Date.now().toString(),
      text: newText.trim(),
    };
    setMonsters((prev) => [...prev, newItem]);
    setNewText('');
    setIsAdding(false);
  };

  const handleStartEdit = (item: MonsterEntry) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    setMonsters((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text: editText.trim() } : m))
    );
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setMonsters((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all GM monster stat lines?')) {
      setMonsters([]);
    }
  };

  return (
    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👾</span> GM Monster Stats ({monsters.length})
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded text-[11px] font-bold transition-all cursor-pointer"
            title="Add a new monster stat line"
          >
            {isAdding ? '✕ Cancel' : '➕ Add Line'}
          </button>
          {monsters.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-2 py-0.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-700/50 rounded text-[11px] font-bold transition-all cursor-pointer"
              title="Clear all monster stats"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Add New Line Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g. Bandit Archer ⚔️16 / 5 (1) 🧥14 / 1 ❤️8"
            className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newText.trim()}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all cursor-pointer"
          >
            Save
          </button>
        </form>
      )}

      {/* Monster Lines List */}
      {monsters.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic p-2 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
          No active monster stats. Click "+ Add Line" to track GM encounter targets.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {monsters.map((m) =>
            editingId === m.id ? (
              <div key={m.id} className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-indigo-500/50">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-amber-200 outline-none"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(m.id)}
                  className="px-2.5 py-1 bg-emerald-600 text-white font-bold text-[11px] rounded hover:bg-emerald-500 transition cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-2.5 py-1 bg-slate-800 text-slate-300 font-bold text-[11px] rounded hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 p-2 bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 rounded-lg transition-all group"
              >
                <span className="font-mono text-xs font-semibold text-slate-200 truncate select-all">
                  {m.text}
                </span>
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => handleStartEdit(m)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded text-[11px] transition cursor-pointer"
                    title="Edit line"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded text-[11px] transition cursor-pointer"
                    title="Delete line"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
