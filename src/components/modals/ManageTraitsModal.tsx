// src/components/modals/ManageTraitsModal.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Sparkles,
  Star,
  Check,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import {
  SupabaseTrait,
  TraitItem,
  calculateAvailableAp,
} from '../../types/game';
import { cleanKitName, isMsoEntry, compareMsoItems, compareMsoOptions } from '../../utils/kitUtils';
import { getCharacterKnownPaths, isItemInPath } from '../../utils/pathApUtils';

interface ManageTraitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageTraitsModal: React.FC<ManageTraitsModalProps> = ({ isOpen, onClose }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const {
    activeCharacter,
    activeRole,
    traits: stockRulesCatalog = [],
    addTraitQuirk,
    removeTraitQuirk,
    toggleTraitVisibility,
    toggleStarTrait,
    recordApExpenditure,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  // Left Pane Search State
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');

  // Right Pane Catalog Filter States
  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [localDomainFilter, setLocalDomainFilter] = useState<string>('ALL');
  const [traitTypeFilter, setTraitTypeFilter] = useState<'ALL' | 'STARRED'>('ALL');
  const [traitCategoryFilter, setTraitCategoryFilter] = useState<'all' | 'in_path' | 'out_of_path'>('all');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');

  // Sync genre filter when modal opens
  useEffect(() => {
    if (isOpen && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [isOpen, activeGenre]);

  const equippedRules: TraitItem[] = useMemo(() => {
    return activeCharacter?.sheet_data?.traits_quirks || [];
  }, [activeCharacter?.sheet_data?.traits_quirks]);

  const knownPaths = useMemo(() => getCharacterKnownPaths(activeCharacter), [activeCharacter]);

  const isTraitInherent = useCallback((rule: SupabaseTrait | TraitItem): boolean => {
    const kitStr = (rule.kit || rule.table_group || (rule as any).source || '').toLowerCase();
    return kitStr.includes('{perk}') || kitStr.includes('{trait}') || kitStr.includes('perk') || kitStr.includes('trait');
  }, []);

  const isTraitInPath = useCallback((rule: SupabaseTrait | TraitItem): boolean => {
    const pathVal = rule.path || rule.kit || rule.table_group || (rule as any).discipline;
    return isItemInPath(pathVal, knownPaths);
  }, [knownPaths]);

  const getTraitApCost = useCallback((rule: SupabaseTrait | TraitItem): number => {
    if (isTraitInherent(rule)) return 0;
    if (isTraitInPath(rule)) return 1;
    return 3;
  }, [isTraitInherent, isTraitInPath]);

  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

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

  // Unique domains / kits for Dropdown 2
  const uniqueDomains = useMemo(() => {
    const set = new Set<string>();
    stockRulesCatalog.forEach((r) => {
      if (r.discipline?.trim()) set.add(r.discipline.trim());
      if (r.kit?.trim()) set.add(cleanKitName(r.kit.trim()));
    });
    return Array.from(set).sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [stockRulesCatalog, isGsUnlocked]);

  // Filtered Equipped Rules (Left Column)
  const filteredEquippedRules = useMemo(() => {
    return equippedRules
      .filter((t) => {
        if (!t || !t.name) return false;
        if (!leftSearchQuery.trim()) return true;
        const q = leftSearchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q) ||
          (t.source || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [equippedRules, leftSearchQuery, isGsUnlocked]);

  const isRuleEquipped = (ruleName: string) => {
    return equippedRules.some((r) => r.name.toLowerCase() === ruleName.toLowerCase());
  };

  const isRuleStarred = useCallback((ruleIdOrName: number | string) => {
    const starredList = activeCharacter?.sheet_data?.starred_traits || [];
    return starredList.some((s) => String(s) === String(ruleIdOrName));
  }, [activeCharacter?.sheet_data?.starred_traits]);

  const starredTraitsCount = useMemo(() => {
    return stockRulesCatalog.filter((r) => isRuleStarred(r.id || r.name)).length;
  }, [stockRulesCatalog, isRuleStarred]);

  // Filtered Stock Rules Catalog (Right Column)
  const filteredCatalogRules = useMemo(() => {
    return stockRulesCatalog
      .filter((r) => {
        // 1. Genre Filter
        if (localGenreFilter !== 'ALL' && !matchesGenre(r.genres, localGenreFilter as any)) {
          return false;
        }

        // 2. Domain / Kit Filter
        if (localDomainFilter !== 'ALL') {
          const disc = (r.discipline || '').toLowerCase();
          const kit = cleanKitName(r.kit || r.table_group || '').toLowerCase();
          const target = localDomainFilter.toLowerCase();
          if (disc !== target && kit !== target && !kit.includes(target)) {
            return false;
          }
        }

        // 3. Filter Dropdown (Starred)
        if (traitTypeFilter === 'STARRED') {
          if (!isRuleStarred(r.id || r.name)) return false;
        }

        // 4. Category Switch (All, In-Path, Out-of-Path)
        if (traitCategoryFilter === 'in_path') {
          if (!isTraitInPath(r)) return false;
        } else if (traitCategoryFilter === 'out_of_path') {
          if (isTraitInPath(r)) return false;
        }

        // 5. Search Query
        if (catalogSearchQuery.trim()) {
          const q = catalogSearchQuery.toLowerCase().trim();
          const ruleKit = r.kit || r.table_group || '';
          return (
            r.name.toLowerCase().includes(q) ||
            (r.notes || '').toLowerCase().includes(q) ||
            (r.effect || '').toLowerCase().includes(q) ||
            ruleKit.toLowerCase().includes(q) ||
            (r.discipline || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => compareMsoItems(a, b, isGsUnlocked));
  }, [stockRulesCatalog, localGenreFilter, localDomainFilter, traitTypeFilter, traitCategoryFilter, catalogSearchQuery, isTraitInherent, isTraitInPath, isRuleStarred, isGsUnlocked]);

  const handleEquipStockRule = (rule: SupabaseTrait) => {
    if (isRuleEquipped(rule.name)) return;
    const inPath = isTraitInPath(rule);
    const inherent = isTraitInherent(rule);
    const cost = inherent ? 0 : inPath ? 1 : 3;

    if (!inPath && !inherent && activeRole !== 'gm') {
      const confirmed = window.confirm(
        `⚠️ Out-of-Path Trait: "${rule.name}" is outside your character's known paths.\n\nLearning it costs 3 AP and requires GM approval. Proceed?`
      );
      if (!confirmed) return;
    }

    const ruleKit = rule.kit || rule.table_group;
    const item: TraitItem = {
      name: rule.name,
      effect: rule.effect || '',
      notes: rule.notes || '',
      stat_hook: rule.stat_hook || null,
      kit: ruleKit,
      table_group: ruleKit,
      source: ruleKit || 'Stock Traits',
      path: rule.path,
      ap_cost: cost,
    };
    addTraitQuirk(item);
    if (cost > 0) {
      recordApExpenditure(cost, 'Skills', `Learned Trait: ${rule.name} (${cost} AP)`, 1, 'Manage Traits');
    }
  };

  const handleRemoveRule = (rule: TraitItem) => {
    const inherent = isTraitInherent(rule);
    if (inherent && activeRole !== 'gm') {
      alert('Inherent traits (0 AP) are auto-taken and cannot be removed without GM approval. Switch to GM Mode to remove traits.');
      return;
    }
    removeTraitQuirk(rule.name);
    const cost = typeof rule.ap_cost === 'number' && rule.ap_cost > 0 ? rule.ap_cost : (inherent ? 0 : 1);
    if (cost > 0) {
      recordApExpenditure(-cost, 'Skills', `Removed Trait: ${rule.name} (-${cost} AP Refunded)`, 1, 'Manage Traits');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[88vh] max-h-[720px] flex flex-col shadow-2xl overflow-hidden text-left"
      >
        {/* ================= 1. MODAL TOP BAR ================= */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/90 border border-purple-500/40 text-purple-300 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.25)]">
              <span className="text-xl leading-none">🧬</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-outfit font-black text-base text-slate-100 uppercase tracking-wide">
                  Manage Traits
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40">
                  Traits {equippedRules.length}; Available <strong className="text-emerald-400">{availableAp} AP</strong>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Equip traits and manage in-game sheet visibility.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= 2. SPLIT-PANE 2-COLUMN BODY ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
          
          {/* ================= LEFT COLUMN: EQUIPPED ACTIVE TRAITS PANE ================= */}
          <div className="flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-outfit font-bold text-xs text-slate-200 uppercase tracking-wider">
                  Equipped Traits ({equippedRules.length})
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {filteredEquippedRules.length} Visible
              </span>
            </div>

            {/* Simple Quick Search Bar */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter active traits..."
                value={leftSearchQuery}
                onChange={(e) => setLeftSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 text-xs pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-800 text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Active Rules List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {filteredEquippedRules.length > 0 ? (
                filteredEquippedRules.map((rule, idx) => {
                  const inherent = isTraitInherent(rule);
                  const isMso = isGsUnlocked && isMsoEntry(rule.name);
                  const costBadge = typeof rule.ap_cost === 'number'
                    ? (rule.ap_cost === 0 ? '0 AP (Free)' : `${rule.ap_cost} AP`)
                    : (inherent ? '0 AP (Free)' : '1 AP');

                  return (
                    <div
                      key={`${rule.name}_${idx}`}
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shadow-sm ${
                        isMso
                          ? 'bg-purple-950/20 border-purple-500/40 hover:border-purple-400/60'
                          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-outfit font-bold inline-flex items-center align-baseline gap-1 ${isMso ? 'text-purple-300' : 'text-slate-100'}`}>
                            <span>{isMso ? '🌌' : '🧬'}</span>
                            <span>{rule.name}</span>
                            <ItemNotesPopover notes={rule.notes || rule.effect} itemName={rule.name} inline />
                          </span>

                          {/* AP Badge */}
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                            costBadge.includes('0')
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                              : costBadge.includes('3')
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                              : 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                          }`}>
                            {costBadge}
                          </span>

                          {/* Clean Classification Pill */}
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-500/40">
                            🧬 {cleanKitName(rule.kit || rule.table_group || rule.source || 'General')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Dyslexia-Friendly KISS Visibility Pill Switch (Viewable / Hidden) */}
                          <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md">
                            <button
                              type="button"
                              onClick={() => {
                                if (rule.is_hidden) toggleTraitVisibility(rule.id || rule.name);
                              }}
                              className={`py-1 px-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                !rule.is_hidden
                                  ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
                              }`}
                              title="Trait is visible on active character sheet"
                            >
                              <span>👁️</span>
                              <span>Viewable</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!rule.is_hidden) toggleTraitVisibility(rule.id || rule.name);
                              }}
                              className={`py-1 px-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                rule.is_hidden
                                  ? 'bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm font-extrabold'
                                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
                              }`}
                              title="Trait is hidden from active character sheet (read-once)"
                            >
                              <span>🙈</span>
                              <span>Hidden</span>
                            </button>
                          </div>

                          {/* Forget / Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rule)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              inherent && activeRole !== 'gm'
                                ? 'text-slate-500 bg-slate-900 border border-slate-800 cursor-not-allowed opacity-60'
                                : 'text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/60'
                            }`}
                            title={inherent && activeRole !== 'gm' ? 'Inherent Traits (0 AP) require GM approval to remove' : 'Remove Trait'}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Forget</span>
                          </button>
                        </div>
                      </div>

                      {/* Rule Description */}
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {rule.notes || rule.effect}
                      </p>

                      {/* Stat Hook Badge */}
                      {rule.stat_hook && (
                        <div className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border w-fit shadow-inner text-cyan-300 bg-cyan-950/40 border-cyan-500/30">
                          <Sparkles className="w-2.5 h-2.5 shrink-0" />
                          <span>
                            {rule.stat_hook.type === 'mind_die'
                              ? 'Base AR = Mind Die Rating'
                              : `${rule.stat_hook.value && rule.stat_hook.value > 0 ? '+' : ''}${
                                  rule.stat_hook.value
                                } ${rule.stat_hook.target?.toUpperCase()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-900/30 rounded-xl border border-slate-800/60 flex flex-col items-center justify-center gap-1">
                  <span>No active traits equipped.</span>
                  <span className="text-slate-600 text-[11px]">
                    Equip traits from the stock catalog on the right.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: STANDARDIZED 3-ROW CATALOG PANE ================= */}
          <div className="flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner gap-2.5">
            {/* ROW 1: 3 Dropdowns (Genre, Domain, Filter) */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              {/* Dropdown 1: Genre */}
              <select
                value={localGenreFilter}
                onChange={(e) => setLocalGenreFilter(e.target.value)}
                className="bg-slate-900 text-amber-300 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500 cursor-pointer w-full truncate shadow-sm"
              >
                <option value="ALL">🌐 All Genres</option>
                <option value="Medieval">🏰 Medieval</option>
                <option value="Modern">⚙️ Modern</option>
                <option value="SciFi">🚀 SciFi</option>
              </select>

              {/* Dropdown 2: Domain */}
              <select
                value={localDomainFilter}
                onChange={(e) => setLocalDomainFilter(e.target.value)}
                className="bg-slate-900 text-cyan-300 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500 cursor-pointer w-full truncate shadow-sm"
              >
                <option value="ALL">🌐 All Domains</option>
                {uniqueDomains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {/* Dropdown 3: Filter (Starred) */}
              <select
                value={traitTypeFilter}
                onChange={(e) => setTraitTypeFilter(e.target.value as any)}
                className="bg-slate-900 text-purple-300 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500 cursor-pointer w-full truncate shadow-sm"
              >
                <option value="ALL">🌐 All Traits</option>
                <option value="STARRED">⭐ Starred ({starredTraitsCount})</option>
              </select>
            </div>

            {/* ROW 2: KISS Dyslexia-Friendly Multi-Option Pill Switch */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => setTraitCategoryFilter('all')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  traitCategoryFilter === 'all'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🌐 All
              </button>
              <button
                type="button"
                onClick={() => setTraitCategoryFilter('in_path')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  traitCategoryFilter === 'in_path'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧬 In-Path (1 AP / Free)
              </button>
              <button
                type="button"
                onClick={() => setTraitCategoryFilter('out_of_path')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  traitCategoryFilter === 'out_of_path'
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                👑 Out-of-Path (3 AP)
              </button>
            </div>

            {/* Out-of-Path GM Notice Banner */}
            {traitCategoryFilter === 'out_of_path' && (
              <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2 text-xs text-amber-200 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="leading-tight">
                  <strong>👑 Out-of-Path Acquisition:</strong> Traits outside known character paths cost <strong>3 AP</strong> and require GM approval.
                </span>
              </div>
            )}

            {/* ROW 3: Search Bar + Dynamic Result Count */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search stock traits, perks, notes..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 text-slate-200 text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                />
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                {filteredCatalogRules.length} {filteredCatalogRules.length === 1 ? 'item' : 'items'}
              </div>
            </div>

            {/* Zero Matches Feedback & 1-Click Reset */}
            {filteredCatalogRules.length === 0 && (
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-purple-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                <span className="text-purple-300 font-semibold">
                  0 traits match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                  {localDomainFilter !== 'ALL' ? ` • ${localDomainFilter}` : ''}
                  {traitTypeFilter !== 'ALL' ? ` • ${traitTypeFilter}` : ''})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalGenreFilter(activeGenre || 'SciFi');
                    setLocalDomainFilter('ALL');
                    setTraitTypeFilter('ALL');
                    setTraitCategoryFilter('all');
                    setCatalogSearchQuery('');
                  }}
                  className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            )}

            {/* Scrollable Catalog List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {filteredCatalogRules.map((rule) => {
                const equipped = isRuleEquipped(rule.name);
                const starred = isRuleStarred(rule.id || rule.name);
                const isMso = isGsUnlocked && isMsoEntry(rule.name);
                const inPath = isTraitInPath(rule);
                const inherent = isTraitInherent(rule);
                const apCost = getTraitApCost(rule);

                return (
                  <div
                    key={rule.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                      equipped
                        ? 'bg-purple-950/20 border-purple-500/40 opacity-80'
                        : isMso
                        ? 'bg-purple-950/20 border-purple-500/30 hover:border-purple-500/50'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-outfit font-black inline-flex items-center align-baseline gap-1 ${isMso ? 'text-purple-300' : 'text-slate-100'}`}>
                          <span>{isMso ? '🌌' : '🧬'}</span>
                          <span>{rule.name}</span>
                          <ItemNotesPopover notes={rule.notes || rule.effect} itemName={rule.name} inline />
                        </span>

                        {/* AP Badge */}
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                          inherent
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                            : inPath
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                        }`}>
                          {inherent ? '0 AP (Free)' : inPath ? '1 AP' : '👑 3 AP'}
                        </span>

                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-500/40">
                          🧬 {cleanKitName(rule.kit || rule.table_group || 'General')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">{rule.notes || rule.effect}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleStarTrait(rule.id)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          starred
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                        }`}
                        title="Star favorite"
                      >
                        <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>

                      <button
                        type="button"
                        disabled={equipped}
                        onClick={() => handleEquipStockRule(rule)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow transition-all ${
                          equipped
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            : !inPath && !inherent
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer font-extrabold'
                            : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                        }`}
                      >
                        {equipped ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Equipped</span>
                          </>
                        ) : (
                          <span>+ Learn ({inherent ? 'Free' : `${apCost} AP`})</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ================= 3. FOOTER CONTEXT BAR ================= */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-outfit font-bold text-slate-300">
              Hero: <span className="text-purple-300">{activeCharacter?.name || 'Unnamed Hero'}</span>
            </span>
            <span>•</span>
            <span className="font-mono">Total Equipped: {equippedRules.length}</span>
          </div>

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

export const ManageSpecRulesModal = ManageTraitsModal;
export const ManageRulesModal = ManageTraitsModal;
