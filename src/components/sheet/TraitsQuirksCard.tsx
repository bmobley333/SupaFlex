import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { ManageTraitsModal } from '../modals/ManageTraitsModal';
import { TraitQuirkItem } from '../../types/game';
import { cleanKitName } from '../../utils/kitUtils';

export const TraitsQuirksCard: React.FC = () => {
  const { activeCharacter, toggleTraitVisibility } = useCharacterStore();
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [visibilityFilter, setVisibilityFilter] = useState<'visible' | 'all'>('visible');

  // Listen for global manager event
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'traits' || e.detail === 'spec_rules') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  const equippedTraits: TraitQuirkItem[] = useMemo(() => {
    return activeCharacter?.sheet_data?.traits_quirks || [];
  }, [activeCharacter?.sheet_data?.traits_quirks]);

  const validTraits = useMemo(() => {
    return (equippedTraits || []).filter((t): t is TraitQuirkItem => Boolean(t && t.name));
  }, [equippedTraits]);

  const visibleTraits = useMemo(() => {
    return validTraits.filter((t) => !t.is_hidden);
  }, [validTraits]);

  const displayedTraits = useMemo(() => {
    return visibilityFilter === 'visible' ? visibleTraits : validTraits;
  }, [visibilityFilter, visibleTraits, validTraits]);

  return (
    <div className="bg-gradient-to-b from-purple-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-purple-500/90 p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md relative overflow-hidden flex-1">
      {/* Standard Card Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-950/90 border border-purple-500/50 text-purple-300 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.25)]">
            <span className="text-base leading-none">📜</span>
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-outfit font-black text-sm tracking-wider text-slate-100 uppercase">
              Spec Rules
            </h3>
            <CardHelpButton ruleKey="traits" />
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40">
            {validTraits.length} Rules
          </span>
        </div>

        {/* Action Controls & Dyslexia-Friendly Visibility Pill Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          {validTraits.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setVisibilityFilter('visible')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibilityFilter === 'visible'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Show only active reference rules on main sheet"
              >
                <span>👁️</span>
                <span>Active ({visibleTraits.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibilityFilter('all')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibilityFilter === 'all'
                    ? 'bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Show all rules including read-once/hidden background rules"
              >
                <span>📜</span>
                <span>All ({validTraits.length})</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900/90 text-purple-200 border border-purple-500/50 hover:border-purple-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Manage Character Spec Rules"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Rules</span>
          </button>
        </div>
      </div>

      {/* High-Density 2-Column Rules Strip */}
      <div className="flex flex-col gap-2 flex-1 min-h-[140px] max-h-[420px] overflow-y-auto pr-1">
        {displayedTraits.length > 0 ? (
          displayedTraits.map((t, idx) => {
            const isTrait =
              (t.kit && t.kit.includes('{Trait}')) ||
              (t.source && t.source.includes('Trait')) ||
              (t.table_group && t.table_group.includes('{Trait}'));
            const originTag = cleanKitName(t.kit || t.table_group || t.source || 'General');
            const isHidden = Boolean(t.is_hidden);

            return (
              <div
                key={`${t.name}_${idx}`}
                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all ${
                  isHidden
                    ? 'bg-slate-950/40 border-slate-800/60 border-dashed opacity-75 hover:opacity-100'
                    : 'bg-slate-950/60 border-slate-850 hover:border-slate-800'
                }`}
              >
                {/* 1. Name & Classification Column */}
                <div className="w-44 sm:w-48 shrink-0 flex flex-col gap-0.5">
                  <span className="font-outfit font-bold text-xs text-slate-100 block whitespace-normal break-words leading-tight">
                    {t.name}
                  </span>

                  {/* Clean Category Classification Pill & Hidden Tag */}
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-purple-950/90 text-purple-300 border border-purple-500/40 w-fit flex items-center gap-1">
                      <span>{isTrait ? '🧬 Trait •' : '📜'}</span> {originTag}
                    </span>

                    {isHidden && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-700/80 w-fit flex items-center gap-1">
                        <span>🙈</span> Hidden
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Rule Description & Live Computed Stat Hook Column */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-xs text-slate-300 whitespace-normal break-words leading-relaxed font-sans">
                    {t.notes || (t as any).effect || 'No rule description'}
                  </p>
                  {t.stat_hook && (
                    <div className="flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border w-fit shadow-inner text-cyan-300 bg-cyan-950/40 border-cyan-500/30">
                      <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      <span>
                        {t.stat_hook.type === 'mind_die' && 'Base AR dynamically set to Mind Die'}
                        {t.stat_hook.type === 'flat_bonus' &&
                          `Stat Hook: ${t.stat_hook.value && t.stat_hook.value > 0 ? '+' : ''}${
                            t.stat_hook.value
                          } ${t.stat_hook.target.toUpperCase()}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Single-Click Visibility Toggle Action Button */}
                <div className="shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => toggleTraitVisibility(t.id || t.name)}
                    className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isHidden
                        ? 'bg-slate-900/90 text-slate-400 hover:text-purple-300 border-slate-800 hover:border-purple-500/50'
                        : 'bg-purple-950/70 text-purple-200 hover:text-white border-purple-500/40 hover:bg-purple-900/80 shadow-sm'
                    }`}
                    title={isHidden ? 'Rule is hidden from active sheet. Click to make viewable.' : 'Rule is visible on active sheet. Click to hide (read-once).'}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-mono hidden md:inline">Hidden</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-purple-300" />
                        <span className="text-[10px] font-mono hidden md:inline">Viewable</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        ) : validTraits.length > 0 ? (
          <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs text-slate-400 text-center flex flex-col items-center justify-center gap-2 flex-1">
            <span className="font-mono text-slate-300">All {validTraits.length} rules are currently set to hidden (read-once).</span>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setVisibilityFilter('all')}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                📜 Show All Rules ({validTraits.length})
              </button>
              <button
                type="button"
                onClick={() => setShowManageModal(true)}
                className="px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-500/50 rounded-lg text-xs font-bold cursor-pointer transition-all"
              >
                + Manage Rules
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500 italic text-center flex flex-col items-center justify-center gap-1.5 flex-1">
            <span>No active spec rules.</span>
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer text-xs"
            >
              + Open Manage Rules to Learn Stock Rules & Boons
            </button>
          </div>
        )}
      </div>

      {/* Modal Drawer */}
      <ManageTraitsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
      />
    </div>
  );
};
