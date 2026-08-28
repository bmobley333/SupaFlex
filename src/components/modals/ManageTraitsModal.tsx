// src/components/modals/ManageTraitsModal.tsx
// Master Modal Blueprint Specification compliant modal for Managing, Browsing, and Creating Traits, Quirks & Flaws

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  AlertCircle,
  Sparkles,
  Star,
  Check,
  Info,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { QuickDeckBar } from '../common/QuickDeckBar';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import {
  SupabaseTrait,
  TraitQuirkItem,
  TraitType,
  StatHookDefinition,
  calculateLiveSheetSpentAp,
} from '../../types/game';

interface ManageTraitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  P: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
  F: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  A: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
  M: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
  AM: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
};

export const ManageTraitsModal: React.FC<ManageTraitsModalProps> = ({ isOpen, onClose }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const {
    activeCharacter,
    traits: stockTraitsCatalog,
    addTraitQuirk,
    removeTraitQuirk,
    toggleStarTrait,
    updateActiveSheetData,
    saveActiveCharacter,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  // Left Pane Filter & Search State
  const [activeLeftFilter, setActiveLeftFilter] = useState<'all' | 'trait' | 'quirk' | 'flaw'>('all');
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');

  // Right Pane Tab & Search State
  const [rightActiveTab, setRightActiveTab] = useState<'catalog' | 'forge'>('catalog');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [selectedTableGroup, setSelectedTableGroup] = useState<string | null>(null);

  // Custom Forge Form State
  const [customName, setCustomName] = useState<string>('');
  const [customType, setCustomType] = useState<TraitType>('trait');
  const [customTableGroup, setCustomTableGroup] = useState<string>('Custom');
  const [customFlawPoints, setCustomFlawPoints] = useState<number>(0);
  const [customStatHookPreset, setCustomStatHookPreset] = useState<string>('none');
  const [customAction, setCustomAction] = useState<string>('P');
  const [customUsage, setCustomUsage] = useState<string>('Passive');
  const [customEffect, setCustomEffect] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [forgeError, setForgeError] = useState<string | null>(null);

  const equippedTraits: TraitQuirkItem[] = useMemo(() => {
    return activeCharacter?.sheet_data?.traits_quirks || [];
  }, [activeCharacter?.sheet_data?.traits_quirks]);

  const { flawBonusAp, rawFlawPoints } = useMemo(() => {
    return calculateLiveSheetSpentAp(activeCharacter?.sheet_data);
  }, [activeCharacter?.sheet_data]);

  const favoriteTraitTables: string[] = useMemo(() => {
    return activeCharacter?.sheet_data?.favorite_trait_tables || [];
  }, [activeCharacter?.sheet_data?.favorite_trait_tables]);

  const handleUpdatePinnedTraitTables = (tables: string[]) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      favorite_trait_tables: tables,
    }));
    saveActiveCharacter();
  };

  const starredTraitsCount = useMemo(() => {
    return (activeCharacter?.sheet_data?.starred_traits || []).length;
  }, [activeCharacter?.sheet_data?.starred_traits]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered Active Traits for Left Pane
  const filteredEquippedTraits = useMemo(() => {
    return equippedTraits.filter((t) => {
      if (!t) return false;
      const matchesSearch =
        !leftSearchQuery.trim() ||
        t.name.toLowerCase().includes(leftSearchQuery.toLowerCase()) ||
        t.effect.toLowerCase().includes(leftSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (activeLeftFilter === 'all') return true;
      if (activeLeftFilter === 'flaw') return (t.flaw_points || 0) > 0 || t.action === 'F';
      if (activeLeftFilter === 'trait') return t.type === 'trait' && (!t.flaw_points || t.flaw_points === 0);
      if (activeLeftFilter === 'quirk') return t.type === 'quirk' && (!t.flaw_points || t.flaw_points === 0);
      return true;
    });
  }, [equippedTraits, leftSearchQuery, activeLeftFilter]);

  // Filtered Catalog Traits for Right Pane
  const filteredCatalogTraits = useMemo(() => {
    return stockTraitsCatalog.filter((t) => {
      if (!matchesGenre(t.genres, activeGenre)) return false;
      if (selectedTableGroup && t.table_group !== selectedTableGroup) return false;
      if (catalogSearchQuery.trim()) {
        const q = catalogSearchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.effect.toLowerCase().includes(q) ||
          (t.table_group || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [stockTraitsCatalog, activeGenre, selectedTableGroup, catalogSearchQuery]);

  const isTraitEquipped = (traitName: string) => {
    return equippedTraits.some((t) => t.name.toLowerCase() === traitName.toLowerCase());
  };

  const isTraitStarred = (idOrName: number | string) => {
    const starred = activeCharacter?.sheet_data?.starred_traits || [];
    return starred.includes(idOrName);
  };

  // Equip Stock Trait
  const handleEquipStockTrait = (trait: SupabaseTrait) => {
    if (isTraitEquipped(trait.name)) return;

    let parsedHook: StatHookDefinition | undefined = undefined;
    if (trait.stat_hook) {
      parsedHook =
        typeof trait.stat_hook === 'string'
          ? JSON.parse(trait.stat_hook)
          : trait.stat_hook;
    }

    const newItem: TraitQuirkItem = {
      id: trait.id,
      name: trait.name,
      type: trait.type || 'trait',
      action: trait.action || 'P',
      usage: trait.usage || 'Passive',
      effect: trait.effect,
      source: trait.table_group || 'Catalog',
      flaw_points: trait.flaw_points || 0,
      stat_hook: parsedHook,
      notes: trait.notes || undefined,
    };

    addTraitQuirk(newItem);
  };

  // Create & Equip Custom Trait from Forge
  const handleCreateCustomForge = (e: React.FormEvent) => {
    e.preventDefault();
    setForgeError(null);

    if (!customName.trim()) {
      setForgeError('Trait name is required.');
      return;
    }

    if (!customEffect.trim()) {
      setForgeError('Trait mechanical effect description is required.');
      return;
    }

    let parsedHook: StatHookDefinition | undefined = undefined;
    if (customStatHookPreset === 'mind_ar') {
      parsedHook = { type: 'mind_die', target: 'ar', effectDescription: 'Base AR = Mind Die Rating' };
    } else if (customStatHookPreset === 'natural_ar_1') {
      parsedHook = { type: 'flat_bonus', target: 'ar', value: 1, effectDescription: '+1 Natural AR Bonus' };
    } else if (customStatHookPreset === 'mr_plus_1') {
      parsedHook = { type: 'flat_bonus', target: 'mr', value: 1, effectDescription: '+1 Movement Rate' };
    } else if (customStatHookPreset === 'mr_minus_1') {
      parsedHook = { type: 'flat_bonus', target: 'mr', value: -1, effectDescription: '-1 Movement Rate' };
    } else if (customStatHookPreset === 'luck_plus_1') {
      parsedHook = { type: 'flat_bonus', target: 'luck', value: 1, effectDescription: '+1 Max Luck' };
    } else if (customStatHookPreset === 'vit_minus_3') {
      parsedHook = { type: 'flat_bonus', target: 'vitality', value: -3, effectDescription: '-3 Max Vitality' };
    }

    const newItem: TraitQuirkItem = {
      id: Date.now(),
      name: customName.trim(),
      type: customType,
      action: customAction,
      usage: customUsage,
      effect: customEffect.trim(),
      source: customTableGroup.trim() || 'Custom',
      flaw_points: customFlawPoints,
      stat_hook: parsedHook,
      notes: customNotes.trim() || undefined,
    };

    addTraitQuirk(newItem);

    // Reset Form
    setCustomName('');
    setCustomType('trait');
    setCustomTableGroup('Custom');
    setCustomFlawPoints(0);
    setCustomStatHookPreset('none');
    setCustomAction('P');
    setCustomUsage('Passive');
    setCustomEffect('');
    setCustomNotes('');
    setRightActiveTab('catalog');
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] max-h-[900px] flex flex-col overflow-hidden animate-fadeIn"
      >
        {/* ================= 1. HEADER STANDARD ================= */}
        <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧬</span>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold font-outfit text-purple-400">
                  Manage Traits & Quirks
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-lg border text-xs font-mono font-bold ${
                    rawFlawPoints > 0
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                  title="Handicaps grant bonus AP up to +5 max"
                >
                  ⚠️ Flaw Bonus AP: +{flawBonusAp} / +5 Max
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Select passive racial adaptations, unique traits, quirks, and handicaps for {activeCharacter?.name || 'Hero'}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 2. TWO-PANE GRID ARCHITECTURE ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 min-h-0 overflow-hidden">
          {/* ================= PANE 1 (LEFT): EQUIPPED TRAITS ================= */}
          <div className="md:col-span-5 flex flex-col border-r border-slate-800/80 pr-6 min-h-0 overflow-hidden">
            {/* Header & Item Count */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <span className="text-xs font-outfit font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>📜</span> Equipped ({equippedTraits.length})
              </span>
              <span className="text-[11px] font-mono text-purple-300 font-bold">
                {equippedTraits.length} Active
              </span>
            </div>

            {/* Filter Switches */}
            <div className="py-2.5 flex flex-col gap-2 shrink-0">
              {/* Category Filter Pills */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveLeftFilter('all')}
                  className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeLeftFilter === 'all'
                      ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🌐 All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftFilter('trait')}
                  className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeLeftFilter === 'trait'
                      ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🧬 Traits</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftFilter('quirk')}
                  className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeLeftFilter === 'quirk'
                      ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>✨ Quirks</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftFilter('flaw')}
                  className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeLeftFilter === 'flaw'
                      ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>⚠️ Flaws</span>
                </button>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter active..."
                  value={leftSearchQuery}
                  onChange={(e) => setLeftSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Scrollable Equipped Traits List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {filteredEquippedTraits.length > 0 ? (
                filteredEquippedTraits.map((t, idx) => {
                  const isFlaw = (t.flaw_points || 0) > 0 || t.action === 'F';
                  const actionUpper = (t.action || (isFlaw ? 'F' : 'P')).toUpperCase();
                  const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                  return (
                    <div
                      key={`${t.name}_${idx}`}
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shadow-sm ${
                        isFlaw
                          ? 'bg-amber-950/20 border-amber-500/30'
                          : t.type === 'quirk'
                          ? 'bg-indigo-950/20 border-indigo-500/30'
                          : 'bg-slate-950/80 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-outfit font-bold text-slate-100">
                              {t.name}
                            </span>
                            {t.notes && <ItemNotesPopover notes={t.notes} itemName={t.name} />}
                          </div>

                          {/* Classification Pill */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {isFlaw ? (
                              <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <span>⚠️</span> Flaw (+{t.flaw_points || 1} AP)
                              </span>
                            ) : t.type === 'quirk' ? (
                              <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                                <span>✨</span> Quirk
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <span>🧬</span> Trait{t.source ? ` (${t.source})` : ''}
                              </span>
                            )}

                            {/* Action & Usage Badges */}
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${actionClass}`}>
                              {actionUpper}
                            </span>
                            <span className="bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800 text-[9px] font-mono text-slate-300">
                              {t.usage || 'Passive'}
                            </span>
                          </div>
                        </div>

                        {/* Standardized 'Forget' Drop Action Button */}
                        <button
                          type="button"
                          onClick={() => removeTraitQuirk(t.id || t.name)}
                          className="bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 hover:border-rose-400 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                          title="Remove from character sheet"
                        >
                          Forget
                        </button>
                      </div>

                      {/* Stat Hook Annotation if active */}
                      {t.stat_hook && (
                        <div className="flex items-center gap-1 text-[10px] font-mono font-semibold text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span>
                            {t.stat_hook.type === 'mind_die' && 'Stat Hook: Base AR = Mind Die Rating'}
                            {t.stat_hook.type === 'flat_bonus' &&
                              `Stat Hook: ${t.stat_hook.value && t.stat_hook.value > 0 ? '+' : ''}${
                                t.stat_hook.value
                              } ${t.stat_hook.target.toUpperCase()}`}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{t.effect}</p>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800">
                  No traits equipped in this filter category. Browse the catalog or create a custom trait on the right.
                </div>
              )}
            </div>
          </div>

          {/* ================= PANE 2 (RIGHT): CATALOG & CUSTOM FORGE ================= */}
          <div className="md:col-span-7 flex flex-col min-h-0 overflow-hidden">
            {/* Standardized Sub-Tab Bar */}
            <div className="flex border-b border-slate-800 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => setRightActiveTab('catalog')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightActiveTab === 'catalog'
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🌐</span>
                <span>Stock Catalog</span>
                <span className="text-[10px] font-mono opacity-80">({stockTraitsCatalog.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setRightActiveTab('forge')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightActiveTab === 'forge'
                    ? 'border-purple-400 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>✨</span>
                <span>Custom Forge</span>
              </button>
            </div>

            {/* TAB 1: STOCK CATALOG */}
            {rightActiveTab === 'catalog' && (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* QuickDeck Table Switcher */}
                <div className="shrink-0 mb-3">
                  <QuickDeckBar
                    domain="traits"
                    activeTable={selectedTableGroup || 'ALL'}
                    onSelectTable={(tbl) => setSelectedTableGroup(tbl === 'ALL' ? null : tbl)}
                    pinnedTables={favoriteTraitTables}
                    onUpdatePinnedTables={handleUpdatePinnedTraitTables}
                    catalogItems={stockTraitsCatalog}
                    starredCount={starredTraitsCount}
                    colorTheme="purple"
                    totalCatalogCount={stockTraitsCatalog.length}
                    placeholderText="➕ Pin Trait Table"
                  />
                </div>

                {/* Search Row */}
                <div className="flex items-center gap-2 mb-3 shrink-0">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search stock traits..."
                      value={catalogSearchQuery}
                      onChange={(e) => setCatalogSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Catalog Traits Grid */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
                  {filteredCatalogTraits.length > 0 ? (
                    filteredCatalogTraits.map((trait) => {
                      const equipped = isTraitEquipped(trait.name);
                      const starred = isTraitStarred(trait.id || trait.name);
                      const isFlaw = (trait.flaw_points || 0) > 0 || trait.action === 'F';
                      const actionUpper = (trait.action || (isFlaw ? 'F' : 'P')).toUpperCase();
                      const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                      return (
                        <div
                          key={trait.id}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                            equipped
                              ? 'bg-purple-950/20 border-purple-500/40 opacity-80'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-outfit font-black text-slate-100 flex items-center gap-1">
                                {isFlaw ? '⚠️' : trait.type === 'quirk' ? '✨' : '🧬'}
                                <span>{trait.name}</span>
                              </span>

                              {/* Classification Pill */}
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase ${
                                  isFlaw
                                    ? 'bg-amber-900/60 text-amber-300 border border-amber-500/40'
                                    : trait.type === 'quirk'
                                    ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-500/40'
                                    : 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {isFlaw ? `Flaw (+${trait.flaw_points || 1} AP)` : trait.type}
                              </span>

                              {/* Action & Usage */}
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase ${actionClass}`}>
                                {actionUpper}
                              </span>
                              <span className="bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800 text-[9px] font-mono text-slate-400">
                                {trait.usage || 'Passive'}
                              </span>

                              {trait.table_group && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  [{trait.table_group}]
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed font-sans">{trait.effect}</p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleStarTrait(trait.id)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                starred
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                              }`}
                              title="Star favorite"
                            >
                              <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>

                            {/* Standardized '+ Learn' Catalog Action Button */}
                            <button
                              type="button"
                              disabled={equipped}
                              onClick={() => handleEquipStockTrait(trait)}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow transition-all ${
                                equipped
                                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                  : isFlaw
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                                  : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                              }`}
                            >
                              {equipped ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Equipped</span>
                                </>
                              ) : isFlaw ? (
                                <span>+ Take Flaw (+{trait.flaw_points || 1} AP)</span>
                              ) : (
                                <span>+ Learn</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-900/40 rounded-xl border border-slate-800">
                      No stock traits found matching current table and genre filters.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CUSTOM FORGE */}
            {rightActiveTab === 'forge' && (
              <div className="flex flex-col flex-1 min-h-0 pt-2 overflow-y-auto pr-1">
                <form onSubmit={handleCreateCustomForge} className="flex flex-col gap-3">
                  <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Create Custom Trait, Quirk or Handicap
                    </span>
                  </div>

                  {/* Name & Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center">
                        Name
                        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Iron Will..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center">
                        Classification Type
                        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                      </label>
                      <select
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value as TraitType)}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-purple-200 outline-none"
                      >
                        <option value="trait">🧬 Trait (Racial / Biological Adaptation)</option>
                        <option value="quirk">✨ Quirk (Unique Mechanics / Rule Exception)</option>
                      </select>
                    </div>
                  </div>

                  {/* Category & Flaw Points */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center">
                        Table Group / Source
                        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Custom"
                        value={customTableGroup}
                        onChange={(e) => setCustomTableGroup(e.target.value)}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center">
                        Flaw Points (Bonus AP)
                        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                      </label>
                      <select
                        value={customFlawPoints}
                        onChange={(e) => setCustomFlawPoints(parseInt(e.target.value, 10))}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-amber-300 font-mono outline-none"
                      >
                        <option value={0}>0 AP (Standard Trait / Quirk)</option>
                        <option value={1}>+1 AP (Minor Flaw / Handicap)</option>
                        <option value={2}>+2 AP (Major Flaw / Handicap)</option>
                        <option value={3}>+3 AP (Severe Flaw / Handicap)</option>
                        <option value={4}>+4 AP (Crippling Flaw / Handicap)</option>
                        <option value={5}>+5 AP (Maximum Flaw Cap)</option>
                      </select>
                    </div>
                  </div>

                  {/* Action & Usage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300">Action Type</label>
                      <select
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-200 outline-none"
                      >
                        <option value="P">P (Passive)</option>
                        <option value="F">F (Free Action / Flaw)</option>
                        <option value="A">A (Attack Action)</option>
                        <option value="M">M (Move Action)</option>
                        <option value="AM">AM (Attack + Move Action)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300">Usage Standard</label>
                      <select
                        value={customUsage}
                        onChange={(e) => setCustomUsage(e.target.value)}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-200 outline-none"
                      >
                        <option value="Passive">Passive</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="1-🍀">1-🍀 (Luck)</option>
                        <option value="1-⚡">1-⚡ (Spark)</option>
                        <option value="1-Enc">1-Enc</option>
                        <option value="2-Enc">2-Enc</option>
                        <option value="3-Enc">3-Enc</option>
                        <option value="1-Rnd">1-Rnd</option>
                      </select>
                    </div>
                  </div>

                  {/* Stat Hook Preset */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center">
                      Derived Stat Hook (Optional Dynamic Calculation)
                      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                    </label>
                    <select
                      value={customStatHookPreset}
                      onChange={(e) => setCustomStatHookPreset(e.target.value)}
                      className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-cyan-200 outline-none"
                    >
                      <option value="none">None (Purely Narrative / Tactical Rule)</option>
                      <option value="mind_ar">🧥 Base AR = Mind Die Rating (Impossible Robes)</option>
                      <option value="natural_ar_1">🧥 +1 Natural AR Bonus (Tough Hide / Scales)</option>
                      <option value="mr_plus_1">👣 +1 Movement Rate (Swift Step)</option>
                      <option value="mr_minus_1">👣 -1 Movement Rate (Limping Gait / Heavy Frame)</option>
                      <option value="luck_plus_1">🍀 +1 Max Luck Pool (Fortune's Child)</option>
                      <option value="vit_minus_3">❤️ -3 Max Vitality Penalty (Glass Cannon)</option>
                    </select>
                  </div>

                  {/* Effect Description */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center">
                      Mechanical Effect
                      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={customEffect}
                      onChange={(e) => setCustomEffect(e.target.value)}
                      className="bg-slate-950 text-xs px-3 py-2 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  {/* Notes / Lore */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center">
                      Lore & Adjudication Notes (Optional)
                      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                    </label>
                    <input
                      type="text"
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 outline-none focus:border-purple-500"
                    />
                  </div>

                  {forgeError && (
                    <div className="p-2 bg-rose-950/50 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{forgeError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="mt-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <span>Save & Learn Custom Trait</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* ================= 4. FOOTER CONTEXT BAR & STANDARDIZED DONE BUTTON ================= */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-outfit font-bold text-slate-300">
              Hero: <span className="text-purple-300">{activeCharacter?.name || 'Unnamed Hero'}</span>
            </span>
            <span>•</span>
            <span className="text-amber-300 font-mono font-bold">
              Flaw Bonus: +{flawBonusAp} / +5 Max AP
            </span>
            <span>•</span>
            <span className="font-mono">Total Equipped: {equippedTraits.length}</span>
          </div>

          {/* Standardized Master Blueprint Done Footer Button */}
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
