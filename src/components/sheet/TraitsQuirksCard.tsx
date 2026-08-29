// src/components/sheet/TraitsQuirksCard.tsx
// High-Density Micro-Card for Passive Physiology, Background Traits, Flaws & Derived Stat Hooks

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { ManageTraitsModal } from '../modals/ManageTraitsModal';
import { TraitQuirkItem, calculateLiveSheetSpentAp } from '../../types/game';

export const TraitsQuirksCard: React.FC = () => {
  const { activeCharacter } = useCharacterStore();
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'trait' | 'flaw'>('all');

  // Listen for global manager event
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'traits') setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  const equippedTraits: TraitQuirkItem[] = useMemo(() => {
    return activeCharacter?.sheet_data?.traits_quirks || [];
  }, [activeCharacter?.sheet_data?.traits_quirks]);

  const { flawBonusAp, rawFlawPoints } = useMemo(() => {
    return calculateLiveSheetSpentAp(activeCharacter?.sheet_data);
  }, [activeCharacter?.sheet_data]);

  // Filtered traits for card display
  const filteredTraits = useMemo(() => {
    return equippedTraits.filter((t) => {
      if (!t) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'flaw') return (t.flaw_points || 0) > 0 || t.type === 'flaw';
      if (activeFilter === 'trait') return (t.type === 'trait' || !t.type) && (!t.flaw_points || t.flaw_points === 0);
      return true;
    });
  }, [equippedTraits, activeFilter]);

  const traitsCount = useMemo(
    () => equippedTraits.filter((t) => (t.type === 'trait' || !t.type) && (!t.flaw_points || t.flaw_points === 0)).length,
    [equippedTraits]
  );
  const flawsCount = useMemo(
    () => equippedTraits.filter((t) => (t.flaw_points || 0) > 0 || t.type === 'flaw').length,
    [equippedTraits]
  );

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
              Rules
            </h3>
            <CardHelpButton ruleKey="traits" />
          </div>

          {/* Flaw Bonus AP Indicator */}
          <div
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold ${
              rawFlawPoints > 0
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
            title={`Handicaps & Flaws grant bonus AP (up to +5 AP max). Current: +${rawFlawPoints} flaw points.`}
          >
            <span>⚠️ Flaw AP:</span>
            <strong className="text-amber-200">+{flawBonusAp}</strong>
            <span className="text-slate-500 text-[10px]">/ +5 Max</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="px-3.5 py-1.5 bg-purple-950/80 hover:bg-purple-900/90 text-purple-200 border border-purple-500/50 hover:border-purple-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Rules</span>
          </button>
        </div>
      </div>

      {/* KISS Multi-Option Pill Switch (2-Bucket: All, Traits, Flaws) */}
      <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span>🌐 All</span>
          <span className="text-[10px] font-mono opacity-80">({equippedTraits.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('trait')}
          className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeFilter === 'trait'
              ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span>🧬 Traits</span>
          <span className="text-[10px] font-mono opacity-80">({traitsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('flaw')}
          className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeFilter === 'flaw'
              ? 'bg-amber-600 text-white shadow-sm font-extrabold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span>⚠️ Flaws</span>
          <span className="text-[10px] font-mono opacity-80">({flawsCount})</span>
        </button>
      </div>

      {/* High-Density 2-Column Rules & Physiology Strip */}
      <div className="flex flex-col gap-2 flex-1 min-h-[140px] max-h-[420px] overflow-y-auto pr-1">
        {filteredTraits.length > 0 ? (
          filteredTraits.map((t, idx) => {
            const isFlaw = (t.flaw_points || 0) > 0 || t.type === 'flaw';

            return (
              <div
                key={`${t.name}_${idx}`}
                className={`p-2.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all ${
                  isFlaw
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-slate-950/60 border-slate-850 hover:border-slate-800'
                }`}
              >
                {/* 1. Name & Classification Column */}
                <div className="w-44 sm:w-48 shrink-0 flex flex-col gap-0.5">
                  <span className="font-outfit font-bold text-xs text-slate-100 block whitespace-normal break-words leading-tight">
                    {t.name}
                  </span>

                  {/* Category Classification Pill */}
                  {isFlaw ? (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/40 w-fit flex items-center gap-1 mt-0.5">
                      <span>⚠️</span> Flaw (+{t.flaw_points || 1} AP)
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 w-fit flex items-center gap-1 mt-0.5">
                      <span>🧬</span> Trait{t.source ? ` (${t.source})` : ''}
                    </span>
                  )}
                </div>

                {/* 2. Rule Description & Live Computed Stat Hook Column */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-xs text-slate-300 whitespace-normal break-words leading-relaxed font-sans">
                    {t.notes || (t as any).effect || 'No rule description'}
                  </p>
                  {t.stat_hook && (
                    <div className={`flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border w-fit shadow-inner ${
                      isFlaw
                        ? 'text-amber-300 bg-amber-950/60 border-amber-500/40'
                        : 'text-cyan-300 bg-cyan-950/40 border-cyan-500/30'
                    }`}>
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
              </div>
            );
          })
        ) : (
          <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500 italic text-center flex flex-col items-center justify-center gap-1.5 flex-1">
            <span>No rules or rule modifiers active.</span>
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer text-xs"
            >
              + Open Manage Rules to Select Archetypes & Rules
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
