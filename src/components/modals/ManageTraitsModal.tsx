// src/components/modals/ManageTraitsModal.tsx
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
  BookOpen,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import {
  SupabaseRule,
  RuleItem,
  StatHookDefinition,
} from '../../types/game';
import { cleanKitName, sanitizeKitInput } from '../../utils/kitUtils';

interface ManageTraitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageTraitsModal: React.FC<ManageTraitsModalProps> = ({ isOpen, onClose }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const {
    activeCharacter,
    activeRole,
    traits: stockRulesCatalog = [],
    addTraitQuirk,
    removeTraitQuirk,
    toggleTraitVisibility,
    toggleStarTrait,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  // Left Pane Search State
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');

  // Right Pane Tab & Search State
  const [rightActiveTab, setRightActiveTab] = useState<'catalog' | 'forge'>('catalog');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');

  // Custom Forge Form State
  const [customName, setCustomName] = useState<string>('');
  const [customKit, setCustomKit] = useState<string>('Custom');
  const [customStatHookPreset, setCustomStatHookPreset] = useState<string>('none');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [forgeError, setForgeError] = useState<string | null>(null);

  const equippedRules: RuleItem[] = useMemo(() => {
    return activeCharacter?.sheet_data?.traits_quirks || [];
  }, [activeCharacter?.sheet_data?.traits_quirks]);

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

  // Filtered Equipped Rules
  const filteredEquippedRules = useMemo(() => {
    return equippedRules.filter((t) => {
      if (!t || !t.name) return false;
      if (!leftSearchQuery.trim()) return true;
      const q = leftSearchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.source || '').toLowerCase().includes(q)
      );
    });
  }, [equippedRules, leftSearchQuery]);

  // Standalone Stock Rules Catalog List
  const filteredCatalogRules = useMemo(() => {
    return stockRulesCatalog.filter((r) => {
      if (!matchesGenre(r.genres, activeGenre)) return false;
      if (catalogSearchQuery.trim()) {
        const q = catalogSearchQuery.toLowerCase();
        const ruleKit = r.kit || r.table_group || '';
        return (
          r.name.toLowerCase().includes(q) ||
          (r.notes || '').toLowerCase().includes(q) ||
          ruleKit.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [stockRulesCatalog, activeGenre, catalogSearchQuery]);

  const isRuleEquipped = (ruleName: string) => {
    return equippedRules.some((r) => r.name.toLowerCase() === ruleName.toLowerCase());
  };

  const isRuleStarred = (ruleIdOrName: number | string) => {
    const starredList = activeCharacter?.sheet_data?.starred_traits || [];
    return starredList.some((s) => String(s) === String(ruleIdOrName));
  };

  const handleEquipStockRule = (rule: SupabaseRule) => {
    if (isRuleEquipped(rule.name)) return;
    const ruleKit = rule.kit || rule.table_group;
    const item: RuleItem = {
      name: rule.name,
      effect: rule.effect || '',
      notes: rule.notes || '',
      stat_hook: rule.stat_hook || null,
      kit: ruleKit,
      table_group: ruleKit,
      source: ruleKit || 'Stock Rules',
    };
    addTraitQuirk(item);
  };

  const handleCreateCustomForge = (e: React.FormEvent) => {
    e.preventDefault();
    setForgeError(null);

    if (!customName.trim()) {
      setForgeError('Rule name is required.');
      return;
    }
    if (!customNotes.trim()) {
      setForgeError('Rule description/notes is required.');
      return;
    }

    let parsedHook: StatHookDefinition | null = null;
    if (customStatHookPreset === 'mind_ar') {
      parsedHook = { target: 'ar', type: 'mind_die' };
    } else if (customStatHookPreset === 'natural_ar_1') {
      parsedHook = { target: 'ar', type: 'flat_bonus', value: 1 };
    } else if (customStatHookPreset === 'mr_plus_1') {
      parsedHook = { target: 'mr', type: 'flat_bonus', value: 1 };
    } else if (customStatHookPreset === 'mr_minus_1') {
      parsedHook = { target: 'mr', type: 'flat_bonus', value: -1 };
    } else if (customStatHookPreset === 'luck_plus_1') {
      parsedHook = { target: 'luck', type: 'flat_bonus', value: 1 };
    } else if (customStatHookPreset === 'vit_minus_3') {
      parsedHook = { target: 'vitality', type: 'flat_bonus', value: -3 };
    }

    const kitValue = `${sanitizeKitInput(customKit.trim()) || 'Custom'}`;
    const newRuleItem: RuleItem = {
      name: customName.trim(),
      kit: kitValue,
      table_group: kitValue,
      notes: customNotes.trim(),
      source: 'Custom Forge',
      stat_hook: parsedHook,
    };

    addTraitQuirk(newRuleItem);

    // Reset Form
    setCustomName('');
    setCustomKit('Custom');
    setCustomStatHookPreset('none');
    setCustomNotes('');
    setRightActiveTab('catalog');
  };

  const handleRemoveRule = (rule: RuleItem) => {
    const isTrait =
      (rule.kit && rule.kit.includes('{Trait}')) ||
      (rule.source && rule.source.includes('Trait')) ||
      (rule.table_group && rule.table_group.includes('{Trait}'));

    if (isTrait && activeRole !== 'gm') {
      alert('Inherent traits (0 AP) are auto-taken and cannot be removed without GM approval. Switch to GM Mode to remove traits.');
      return;
    }
    removeTraitQuirk(rule.name);
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
              <span className="text-xl leading-none">📜</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-outfit font-black text-base text-slate-100 uppercase tracking-wide">
                  Manage Spec Rules
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40">
                  Active Rules: {equippedRules.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Equip spec rules, manage in-game sheet visibility, or forge custom rules & boons.
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
          
          {/* ================= LEFT COLUMN: EQUIPPED ACTIVE RULES PANE ================= */}
          <div className="flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-outfit font-bold text-xs text-slate-200 uppercase tracking-wider">
                  Equipped Rules ({equippedRules.length})
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
                placeholder="Filter active rules..."
                value={leftSearchQuery}
                onChange={(e) => setLeftSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 text-xs pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-800 text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Active Rules List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {filteredEquippedRules.length > 0 ? (
                filteredEquippedRules.map((rule, idx) => {
                  const isTrait =
                    (rule.kit && rule.kit.includes('{Trait}')) ||
                    (rule.source && rule.source.includes('Trait')) ||
                    (rule.table_group && rule.table_group.includes('{Trait}'));

                  return (
                    <div
                      key={`${rule.name}_${idx}`}
                      className="p-3 rounded-xl border flex flex-col gap-2 transition-all shadow-sm bg-slate-900/80 border-slate-800/80 hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-outfit font-bold text-slate-100 flex items-center gap-1">
                            <span>{isTrait ? '🧬' : '📜'}</span>
                            <span>{rule.name}</span>
                          </span>

                          {/* Clean Classification Pill */}
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-500/40">
                            {isTrait ? '🧬 Trait • ' : '📜 '}
                            {cleanKitName(rule.kit || rule.table_group || rule.source || 'General')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Visibility Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleTraitVisibility(rule.id || rule.name)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              rule.is_hidden
                                ? 'text-slate-400 bg-slate-900 border border-slate-800 hover:text-purple-300'
                                : 'text-purple-200 bg-purple-950/70 border border-purple-500/40 hover:bg-purple-900/80 shadow-sm'
                            }`}
                            title={rule.is_hidden ? 'Hidden from active character sheet. Click to make viewable.' : 'Visible on active character sheet. Click to hide.'}
                          >
                            {rule.is_hidden ? <EyeOff className="w-3 h-3 text-slate-400" /> : <Eye className="w-3 h-3 text-purple-300" />}
                            <span className="text-[10px] font-mono hidden sm:inline">{rule.is_hidden ? 'Hidden' : 'Viewable'}</span>
                          </button>

                          {/* Forget / Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveRule(rule)}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isTrait && activeRole !== 'gm'
                                ? 'text-slate-500 bg-slate-900 border border-slate-800 cursor-not-allowed opacity-60'
                                : 'text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/60'
                            }`}
                            title={isTrait && activeRole !== 'gm' ? 'Traits (0 AP) require GM approval to remove' : 'Remove Rule'}
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
                  <span>No active rules equipped.</span>
                  <span className="text-slate-600 text-[11px]">
                    Equip rules from the stock catalog on the right or forge custom rules.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: STOCK CATALOG & CUSTOM FORGE ================= */}
          <div className="flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner">
            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0 gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightActiveTab('catalog')}
                  className={`py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    rightActiveTab === 'catalog'
                      ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>📜 Stock Rules ({stockRulesCatalog.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRightActiveTab('forge')}
                className={`py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  rightActiveTab === 'forge'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ Custom Forge</span>
              </button>
            </div>

            {/* TAB 1: STANDALONE STOCK RULES CATALOG */}
            {rightActiveTab === 'catalog' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="relative mb-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search stock spec rules..."
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
                  {filteredCatalogRules.length > 0 ? (
                    filteredCatalogRules.map((rule) => {
                      const equipped = isRuleEquipped(rule.name);
                      const starred = isRuleStarred(rule.id || rule.name);

                      return (
                        <div
                          key={rule.id}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                            equipped
                              ? 'bg-purple-950/20 border-purple-500/40 opacity-80'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col gap-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-outfit font-black text-slate-100 flex items-center gap-1">
                                <span>📜</span>
                                <span>{rule.name}</span>
                              </span>

                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-500/40">
                                📜 {cleanKitName(rule.kit || rule.table_group || 'General')}
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
                                  : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                              }`}
                            >
                              {equipped ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Equipped</span>
                                </>
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
                      No stock rules found matching search.
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
                      Create Custom Spec Rule or Passive Boon
                    </span>
                  </div>

                  {/* Name & Kit */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-300 flex items-center">
                        Rule Name
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
                        Kit / Source
                        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Custom"
                        value={customKit}
                        onChange={(e) => setCustomKit(sanitizeKitInput(e.target.value))}
                        className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                      />
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

                  {/* Rule Description (Notes) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center">
                      Rule Description & Effect
                      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the rule exception, biological trait, or boon..."
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="bg-slate-950 text-xs px-3 py-2 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  {forgeError && (
                    <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{forgeError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full mt-2 py-2 px-4 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Save & Learn Custom Rule</span>
                  </button>
                </form>
              </div>
            )}
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
