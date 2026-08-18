// src/components/modals/MasterArchitectDeskModal.tsx
// Master Architect Curation Desk: Exclusive admin promotion portal locked strictly to metascapegame@gmail.com.

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, RefreshCw, Star, Trash2, Award } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationItem, CustomCreationType } from '../../types/game';

interface MasterArchitectDeskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MasterArchitectDeskModal: React.FC<MasterArchitectDeskModalProps> = ({ isOpen, onClose }) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const isMasterArchitect = playerEmail?.toLowerCase().trim() === 'metascapegame@gmail.com';

  const [items, setItems] = useState<CustomCreationItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | CustomCreationType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'promoted' | 'unpromoted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAllItems = async () => {
    if (!isOpen || !isMasterArchitect) return;
    setIsLoading(true);
    try {
      const all = await gameApi.getAllCustomItems();
      setItems(all);
    } catch (err: any) {
      console.error('[MasterArchitectDeskModal] Error loading items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllItems();
    }
  }, [isOpen, playerEmail]);

  if (!isOpen || !isMasterArchitect) return null;

  const filteredItems = items.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (statusFilter === 'promoted' && !item.is_promoted) return false;
    if (statusFilter === 'unpromoted' && item.is_promoted) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchAuthor = item.author_name.toLowerCase().includes(q);
      const matchEmail = item.author_email.toLowerCase().includes(q);
      const matchEffect = (item.item_data?.effect || '').toLowerCase().includes(q);
      if (!matchName && !matchAuthor && !matchEmail && !matchEffect) return false;
    }
    return true;
  });

  const handlePromoteToMaster = async (item: CustomCreationItem) => {
    if (!window.confirm(`Promote '${item.name}' into the official Master MetaScape Database for ALL players worldwide?`)) {
      return;
    }

    try {
      await gameApi.promoteCustomItemToMaster(item);
      setFeedback({
        type: 'success',
        message: `🌟 Promoted '${item.name}' to official Master Canon! It is now live in Supabase for all campaigns.`,
      });
      loadAllItems();
    } catch (err: any) {
      console.error('[MasterArchitectDeskModal] Error promoting item:', err);
      setFeedback({ type: 'error', message: `Failed to promote: ${err.message || 'Database error'}` });
    }
  };

  const handleDelete = async (item: CustomCreationItem) => {
    if (!window.confirm(`Permanently remove '${item.name}' from the custom creation database?`)) return;

    try {
      await gameApi.deleteCustomItem(item.id);
      setFeedback({
        type: 'success',
        message: `Deleted '${item.name}'.`,
      });
      loadAllItems();
    } catch (err: any) {
      console.error('[MasterArchitectDeskModal] Error deleting item:', err);
      setFeedback({ type: 'error', message: 'Failed to delete item.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-5xl shadow-2xl shadow-amber-950/60 flex flex-col h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-500/30 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-lg text-amber-300 tracking-wide flex items-center gap-2">
                Master Architect Curation Desk
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-500/50 uppercase font-bold tracking-wider">
                  metascapegame@gmail.com
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Inspect, curate, & 1-click promote community creations into the official Master Database.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({items.length})
              </button>
              <button
                onClick={() => setStatusFilter('unpromoted')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'unpromoted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Candidate Drafts ({items.filter((i) => !i.is_promoted).length})
              </button>
              <button
                onClick={() => setStatusFilter('promoted')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'promoted' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Promoted to Canon ({items.filter((i) => i.is_promoted).length})
              </button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 flex-wrap">
              {(['all', 'power', 'power_table', 'relic', 'hardware', 'skill', 'skillset', 'weapon', 'armor', 'shield', 'gear', 'chaos_gem'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    typeFilter === t
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'all'
                    ? '🌐 All'
                    : t === 'power'
                    ? '🔥 Powers'
                    : t === 'power_table'
                    ? '📜 Tables'
                    : t === 'relic'
                    ? '🏺 Relics'
                    : t === 'hardware'
                    ? '⚙️ Hardware'
                    : t === 'skill'
                    ? '🎯 Skills'
                    : t === 'skillset'
                    ? '🎓 Skillsets'
                    : t === 'weapon'
                    ? '⚔️ Weapons'
                    : t === 'armor'
                    ? '🧥 Armor'
                    : t === 'shield'
                    ? '🛡️ Shields'
                    : t === 'gear'
                    ? '🎒 Gear'
                    : '💎 Chaos Gems'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search author, name, effect..."
              className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-amber-400 w-60"
            />
            <button
              onClick={loadAllItems}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-amber-300 transition-colors"
              title="Refresh desk"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-3 p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold animate-fadeIn shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Items Grid */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading community creations...</span>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    item.is_promoted
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-emerald-950/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-amber-500/40 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-outfit font-extrabold text-sm text-slate-100">{item.name}</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                          {item.type.toUpperCase()}
                        </span>
                        {item.is_promoted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                            🌟 Promoted Canon
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Author: <strong className="text-slate-200">{item.author_name}</strong> ({item.author_email})
                        {item.party_id ? ` • Party: ${item.party_id}` : ' • Personal'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.item_data?.action && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                          {item.item_data.action}
                        </span>
                      )}
                      {item.item_data?.usage && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {item.item_data.usage}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.item_data?.effect || 'No description'}</p>
                  {item.notes && <p className="text-[11px] text-slate-500 italic font-serif">"{item.notes}"</p>}

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 gap-2">
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete creation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {!item.is_promoted ? (
                      <button
                        onClick={() => handlePromoteToMaster(item)}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg border bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white border-amber-400/40 flex items-center gap-1.5 shadow-md cursor-pointer ml-auto"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-200" />
                        <span>Promote to Master Canon</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 ml-auto">
                        <Check className="w-4 h-4" /> Live in Official Ruleset
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs italic">
              <span>No custom creations found matching filter criteria.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Master Curation Items: {items.length}</span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
