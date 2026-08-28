// src/components/sheet/TraitsQuirksCard.tsx
// High-Density Micro-Card for Passive Racial Traits, Unique Quirks, Flaws & Derived Stat Hooks

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { ManageTraitsModal } from '../modals/ManageTraitsModal';
import { TraitQuirkItem, calculateLiveSheetSpentAp } from '../../types/game';

const ACTION_COLORS: Record<string, string> = {
  P: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  F: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  A: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
  M: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
  AM: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
};

const parseUsageCount = (usageStr?: string | null): number => {
  if (!usageStr) return 0;
  const lower = usageStr.toLowerCase();
  if (lower.includes('passive') || lower.includes('infinite') || lower.includes('unlimited') || lower === '-') return 0;
  const match = usageStr.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);
  return 0;
};

export const TraitsQuirksCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'trait' | 'quirk' | 'flaw'>('all');

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

  // Handle Usage Checkbox Toggle
  const handleCheckboxToggle = (trait: TraitQuirkItem, boxIdx: number) => {
    updateActiveSheetData((prev) => {
      const currentTraits: TraitQuirkItem[] = Array.isArray(prev.traits_quirks) ? prev.traits_quirks : [];
      const updated = currentTraits.map((t) => {
        if ((t.id && t.id === trait.id) || t.name.toLowerCase() === trait.name.toLowerCase()) {
          const currentChecked = Array.isArray(t.checked) ? [...t.checked] : [];
          currentChecked[boxIdx] = !currentChecked[boxIdx];
          return { ...t, checked: currentChecked };
        }
        return t;
      });
      return {
        ...prev,
        traits_quirks: updated,
      };
    });
    saveActiveCharacter();
  };

  // Filtered traits for card display
  const filteredTraits = useMemo(() => {
    return equippedTraits.filter((t) => {
      if (!t) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'flaw') return (t.flaw_points || 0) > 0 || t.action === 'F';
      if (activeFilter === 'trait') return t.type === 'trait' && (!t.flaw_points || t.flaw_points === 0);
      if (activeFilter === 'quirk') return t.type === 'quirk' && (!t.flaw_points || t.flaw_points === 0);
      return true;
    });
  }, [equippedTraits, activeFilter]);

  const traitsCount = useMemo(
    () => equippedTraits.filter((t) => t.type === 'trait' && (!t.flaw_points || t.flaw_points === 0)).length,
    [equippedTraits]
  );
  const quirksCount = useMemo(
    () => equippedTraits.filter((t) => t.type === 'quirk' && (!t.flaw_points || t.flaw_points === 0)).length,
    [equippedTraits]
  );
  const flawsCount = useMemo(
    () => equippedTraits.filter((t) => (t.flaw_points || 0) > 0 || t.action === 'F').length,
    [equippedTraits]
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md relative overflow-hidden flex-1">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">🧬</span>
          <h3 className="text-xs font-outfit font-black tracking-wider text-slate-100 uppercase">
            Traits & Quirks
          </h3>

          {/* Flaw Bonus AP Indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono font-bold ${
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
          <CardHelpButton ruleKey="traits" />

          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="px-3 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/50 hover:border-purple-400 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Traits</span>
          </button>
        </div>
      </div>

      {/* KISS Multi-Option Pill Switch */}
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
          onClick={() => setActiveFilter('quirk')}
          className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeFilter === 'quirk'
              ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <span>✨ Quirks</span>
          <span className="text-[10px] font-mono opacity-80">({quirksCount})</span>
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

      {/* Traits List Grid - 5-Column High-Density Row Layout matching Power Slots */}
      <div className="flex flex-col gap-2 flex-1 min-h-[140px] max-h-[420px] overflow-y-auto pr-1">
        {filteredTraits.length > 0 ? (
          filteredTraits.map((t, idx) => {
            const isFlaw = (t.flaw_points || 0) > 0 || t.action === 'F';
            const actionUpper = (t.action || (isFlaw ? 'F' : 'P')).toUpperCase();
            const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
            const usageCount = parseUsageCount(t.usage);

            return (
              <div
                key={`${t.name}_${idx}`}
                className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all"
              >
                {/* 1. Name Column with Category Pill Below */}
                <div className="w-36 sm:w-44 shrink-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-outfit font-bold text-xs text-slate-100 block whitespace-normal break-words leading-tight">
                      {t.name}
                    </span>
                    {t.notes && <ItemNotesPopover notes={t.notes} itemName={t.name} />}
                  </div>

                  {/* Category Pill directly below name */}
                  {isFlaw ? (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/40 w-fit flex items-center gap-1">
                      <span>⚠️</span> Flaw (+{t.flaw_points || 1} AP)
                    </span>
                  ) : t.type === 'quirk' ? (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-500/40 w-fit flex items-center gap-1">
                      <span>✨</span> Quirk
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 w-fit flex items-center gap-1">
                      <span>🧬</span> Trait{t.source ? ` (${t.source})` : ''}
                    </span>
                  )}
                </div>

                {/* 2. Action Badge Column */}
                <div className="w-12 shrink-0 flex items-center justify-center">
                  {actionUpper ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${actionClass}`}>
                      {actionUpper}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono">-</span>
                  )}
                </div>

                {/* 3. Uses Text Column */}
                <div className="w-20 shrink-0 flex items-center justify-start">
                  {t.usage ? (
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 truncate" title={t.usage}>
                      {t.usage}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono">Passive</span>
                  )}
                </div>

                {/* 4. Checkboxes Column */}
                <div className="w-16 shrink-0 flex items-center gap-1 min-w-[64px]">
                  {usageCount > 0 ? (
                    Array.from({ length: usageCount }).map((_, bIdx) => {
                      const isChecked = !!(t.checked && t.checked[bIdx]);
                      return (
                        <input
                          key={bIdx}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(t, bIdx)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-500 focus:ring-0 cursor-pointer accent-purple-500"
                          title={`Usage slot ${bIdx + 1}`}
                        />
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono select-none">-</span>
                  )}
                </div>

                {/* 5. Effect Description Column with Stat Hooks */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-xs text-slate-300 whitespace-normal break-words leading-relaxed">
                    {t.effect || 'No effect description'}
                  </p>
                  {t.stat_hook && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30 w-fit">
                      <Sparkles className="w-2.5 h-2.5 shrink-0" />
                      <span>
                        {t.stat_hook.type === 'mind_die' && 'Base AR dynamically hooked to Mind Die'}
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
          <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500 italic text-center flex flex-col items-center justify-center gap-1.5 flex-1">
            <span>No traits or quirks in this view.</span>
            <button
              type="button"
              onClick={() => setShowManageModal(true)}
              className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer text-xs"
            >
              + Browse Catalog to Learn Traits & Handicaps
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
