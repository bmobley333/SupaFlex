// src/components/codex/CodexSearch.tsx
import React, { useState } from 'react';
import { Search, BookOpen, Filter, X } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { Power, MagicItem, Skillset } from '../../types/game';

type CategoryFilter = 'all' | 'powers' | 'items' | 'skillsets';

interface UnifiedCodexItem {
  id: string;
  type: 'power' | 'item' | 'skillset';
  name: string;
  sub?: string;
  source?: string;
  action?: string;
  usage?: string;
  effect?: string;
  skills?: string[];
  rawItem: Power | MagicItem | Skillset;
}

export const CodexSearch: React.FC = () => {
  const { powers, magicItems, skillsets } = useCharacterStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'meta' | '1-enc' | '1-rnd' | '1-luck'>('all');
  const [selectedItem, setSelectedItem] = useState<UnifiedCodexItem | null>(null);

  // Unify item collections
  const unifiedItems: UnifiedCodexItem[] = [
    ...powers.map((p) => ({
      id: `p_${p.id}`,
      type: 'power' as const,
      name: p.name,
      sub: p.sub || 'Power',
      source: p.source || 'Core Codex',
      action: p.action || '',
      usage: p.usage || '',
      effect: p.effect || '',
      rawItem: p,
    })),
    ...magicItems.map((m) => ({
      id: `m_${m.id}`,
      type: 'item' as const,
      name: m.name,
      sub: m.sub || 'Magic Item',
      source: m.source || 'Item Vault',
      action: m.action || '',
      usage: m.usage || '',
      effect: m.effect || '',
      rawItem: m,
    })),
    ...skillsets.map((s) => ({
      id: `s_${s.id}`,
      type: 'skillset' as const,
      name: s.name,
      sub: s.sub || 'Skillset',
      source: s.source || 'Skill Compendium',
      skills: s.skills || [],
      rawItem: s,
    })),
  ];

  // Filter items based on search term, category, and usage
  const filteredItems = unifiedItems.filter((item) => {
    const matchesCategory =
      category === 'all' ||
      (category === 'powers' && item.type === 'power') ||
      (category === 'items' && item.type === 'item') ||
      (category === 'skillsets' && item.type === 'skillset');

    const uLower = (item.usage || '').toLowerCase();
    const matchesUsage =
      usageFilter === 'all' ||
      (usageFilter === 'meta' && (uLower.includes('⚡') || uLower.includes('meta'))) ||
      (usageFilter === '1-enc' && uLower.includes('enc')) ||
      (usageFilter === '1-rnd' && uLower.includes('rnd')) ||
      (usageFilter === '1-luck' && uLower.includes('luck'));

    const termLower = searchTerm.toLowerCase().trim();
    if (!termLower) return matchesCategory && matchesUsage;

    const matchesSearch =
      item.name.toLowerCase().includes(termLower) ||
      (item.sub && item.sub.toLowerCase().includes(termLower)) ||
      (item.usage && item.usage.toLowerCase().includes(termLower)) ||
      (item.action && item.action.toLowerCase().includes(termLower)) ||
      (item.effect && item.effect.toLowerCase().includes(termLower)) ||
      (item.source && item.source.toLowerCase().includes(termLower)) ||
      (item.skills && item.skills.some((sk) => sk.toLowerCase().includes(termLower)));

    return matchesCategory && matchesUsage && matchesSearch;
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-5">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h3 className="font-outfit font-bold text-base text-slate-100">
            Codex Reference Library
          </h3>
        </div>

        {/* Search Input Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search powers, spells, items, skillsets..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category & Usage Filter Chips Bar */}
      <div className="flex flex-col gap-2.5 bg-slate-950/40 p-3 rounded-lg border border-slate-850">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {[
            { key: 'all', label: `All (${unifiedItems.length})` },
            { key: 'powers', label: `Powers ✨ (${powers.length})` },
            { key: 'items', label: `Magic Items 🔮 (${magicItems.length})` },
            { key: 'skillsets', label: `Skillsets 📚 (${skillsets.length})` },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key as CategoryFilter)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                category === cat.key
                  ? 'bg-indigo-600/25 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-750 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap border-t border-slate-850/60 pt-2">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
            ⚡ Usage Type:
          </span>
          {[
            { key: 'all', label: 'All Usages' },
            { key: 'meta', label: '⚡ Meta Burst (1-⚡)' },
            { key: '1-enc', label: '1-Enc / Encounter' },
            { key: '1-rnd', label: '1-Rnd / Round' },
            { key: '1-luck', label: '1-Luck Chit' },
          ].map((u) => (
            <button
              key={u.key}
              onClick={() => setUsageFilter(u.key as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                usageFilter === u.key
                  ? u.key === 'meta'
                    ? 'bg-amber-500/25 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20'
                    : 'bg-indigo-600/25 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-600/20'
                  : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-750 hover:text-slate-200'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count & Grid */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold text-slate-400">
          Showing {filteredItems.length} entries
        </span>

        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-850 text-xs text-slate-500 italic">
            No codex entries found matching "{searchTerm}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredItems.map((item) => {
              const isPower = item.type === 'power';
              const isItem = item.type === 'item';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-850 hover:border-indigo-500/50 hover:bg-slate-900/60 cursor-pointer transition-all flex flex-col gap-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-outfit font-bold text-xs text-slate-100 group-hover:text-indigo-300 transition-colors">
                      {item.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                        isPower
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                          : isItem
                          ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                          : 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>

                  {(item.action || item.usage) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.action && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                          {item.action}
                        </span>
                      )}
                      {item.usage && (
                        <span
                          className={`text-[10px] font-semibold truncate px-1.5 py-0.5 rounded border ${
                            item.usage.includes('⚡') || item.usage.toLowerCase().includes('meta')
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-sm shadow-amber-500/10'
                              : 'text-slate-400 bg-slate-900/50 border-slate-800'
                          }`}
                        >
                          {item.usage}
                        </span>
                      )}
                    </div>
                  )}

                  {item.effect && (
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed opacity-90">
                      {item.effect}
                    </p>
                  )}

                  {item.skills && (
                    <div className="flex flex-wrap gap-1">
                      {item.skills.slice(0, 4).map((sk, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-800">
                          {sk}
                        </span>
                      ))}
                      {item.skills.length > 4 && (
                        <span className="text-[10px] text-slate-500 font-bold">+{item.skills.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-label={selectedItem.name}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                  {selectedItem.type} Details
                </span>
                <h3 className="font-outfit font-bold text-lg text-slate-100">{selectedItem.name}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-300">
              {selectedItem.action && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">Action:</span>
                  <span className="font-mono font-bold text-indigo-300 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                    {selectedItem.action}
                  </span>
                </div>
              )}

              {selectedItem.usage && (
                <div>
                  <span className="font-bold text-slate-400">Usage:</span> {selectedItem.usage}
                </div>
              )}

              {selectedItem.effect && (
                <div>
                  <span className="font-bold text-slate-400 block mb-1">Effect Description:</span>
                  <p className="p-3 bg-slate-950/80 rounded-lg border border-slate-850 text-slate-200">
                    {selectedItem.effect}
                  </p>
                </div>
              )}

              {selectedItem.skills && selectedItem.skills.length > 0 && (
                <div>
                  <span className="font-bold text-slate-400 block mb-1.5">Included Skills:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.skills.map((sk, idx) => (
                      <span key={idx} className="px-2 py-1 bg-slate-950 text-slate-200 rounded border border-slate-800">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 text-[10px] text-slate-500 font-mono">
                Source: {selectedItem.source || 'MetaScape Codex'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
