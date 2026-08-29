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
  Award,
  Layers,
  Trash2,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import {
  SupabaseRule,
  RuleItem,
  TraitType,
  StatHookDefinition,
  calculateLiveSheetSpentAp,
} from '../../types/game';
import { cleanKitName, isTraitItem, matchesKitFilter, sanitizeKitInput } from '../../utils/kitUtils';
import { collectKitTraitGrants, applyKitTraitGrantsToSheet } from '../../utils/bundleGrants';

interface ManageTraitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Canonical Lists of Hallmark Table Groups discovered across Supabase
const HALLMARK_RACES = [
  'Human',
  'Human - Bloodmarked',
  'Elf',
  'Dwarf',
  'Dwarf - Blackaxe Clan',
  'Orc',
  'Half-Orc',
  'Fairy',
  'Gnome',
  'Goblin',
  'Nelf',
  'Nymph',
  'Form - Giant',
  'Form - Nymph',
  'Form - Pixie',
];

const HALLMARK_CLASSES = [
  'Warrior',
  'Warrior - Ranger',
  'Warrior - Bloodfang Berserker',
  'Warrior - Aetherblade',
  'Warrior - Cursed Spartan',
  'Warrior - Inferno Vanguard',
  'Warrior - Lifestealer',
  'Warrior - Punk',
  'Warrior - Shield',
  'Mage - Elemental',
  'Mage - Geomancer',
  'Mage - Magnetic',
  'Mage - Void Magic',
  'Healer',
  'Healer - Sun-Devoted',
  'Healer - Verdant Sentinel',
  'Thief - Assassin',
  'Bard',
  'Monk',
  'Martial Artist - Blade Saint',
  'Starborn Ranger',
  'Trickster',
  'Unique - Bio Engineer',
];

const HALLMARK_STYLES = [
  'Single Weapon',
  'Dual Wield',
  'Weapon & Shield',
  'Martial Arts',
  'Luck',
  'Psionics',
  'Psionics - Sentinel',
  'Psychosomatics',
];

export const ManageTraitsModal: React.FC<ManageTraitsModalProps> = ({ isOpen, onClose }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const {
    activeCharacter,
    powers: stockPowersCatalog = [],
    skills: stockSkillsCatalog = [],
    traits: stockRulesCatalog = [],
    addTraitQuirk,
    removeTraitQuirk,
    toggleStarTrait,
    updateActiveSheetData,
    saveActiveCharacter,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  // Left Pane Search State
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');

  // Right Pane Tab & Search State
  const [rightActiveTab, setRightActiveTab] = useState<'archetypes' | 'catalog' | 'forge'>('archetypes');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [selectedKit, setSelectedKit] = useState<string>('Human');
  const [extraKitSelected, setExtraKitSelected] = useState<string>('');
  const [showGmWarning, setShowGmWarning] = useState<boolean>(false);

  // Custom Forge Form State
  const [customName, setCustomName] = useState<string>('');
  const [customType, setCustomType] = useState<TraitType>('trait');
  const [customKit, setCustomKit] = useState<string>('Custom');
  const [customFlawPoints, setCustomFlawPoints] = useState<number>(0);
  const [customStatHookPreset, setCustomStatHookPreset] = useState<string>('none');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [forgeError, setForgeError] = useState<string | null>(null);

  const equippedRules: RuleItem[] = useMemo(() => {
    return activeCharacter?.sheet_data?.traits_quirks || [];
  }, [activeCharacter?.sheet_data?.traits_quirks]);

  const { flawBonusAp } = useMemo(() => {
    return calculateLiveSheetSpentAp(activeCharacter?.sheet_data);
  }, [activeCharacter?.sheet_data]);

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

  // Filtered Active Rules for Left Pane
  const filteredEquippedRules = useMemo(() => {
    return equippedRules.filter((t) => {
      if (!t) return false;
      if (!leftSearchQuery.trim()) return true;
      const q = leftSearchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.source || '').toLowerCase().includes(q)
      );
    });
  }, [equippedRules, leftSearchQuery]);

  // All unique kits across all loaded catalogs
  const allDiscoveredKits = useMemo(() => {
    const set = new Set<string>();
    stockPowersCatalog.forEach((p) => {
      const k = p.kit || p.table_group;
      if (k) set.add(cleanKitName(k));
    });
    stockSkillsCatalog.forEach((s) => {
      const k = s.kit || s.table_group;
      if (k) set.add(cleanKitName(k));
    });
    stockRulesCatalog.forEach((r) => {
      const k = r.kit || r.table_group;
      if (k) set.add(cleanKitName(k));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Live Bundle Preview for Selected Kit
  const activeBundleGrants = useMemo(() => {
    if (!selectedKit) return null;
    return collectKitTraitGrants(
      selectedKit,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
  }, [selectedKit, activeCharacter?.sheet_data?.level, stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Check if a kit's bundle is currently equipped
  const isKitBundleEquipped = useMemo(() => {
    if (!activeBundleGrants || !activeCharacter?.sheet_data) return false;
    const sheet = activeCharacter.sheet_data;
    const targetKit = activeBundleGrants.kitName || activeBundleGrants.tableName;
    
    // Check if any rule or power from this kit is equipped
    const hasRule = (sheet.traits_quirks || []).some(
      (r) => matchesKitFilter(r.kit || r.table_group, targetKit)
    );
    const hasPower = (sheet.power_slots || []).concat(sheet.character_power_codex || []).some(
      (p) => matchesKitFilter(p.kit || p.table_group, targetKit)
    );
    const hasSkill = (sheet.known_individual_skills || []).some((sName) =>
      activeBundleGrants.skills.some((bs) => bs.name.toLowerCase() === sName.toLowerCase())
    );

    return hasRule || hasPower || hasSkill;
  }, [activeBundleGrants, activeCharacter?.sheet_data]);

  // Handler: Apply Kit Bundle to Sheet
  const handleApplyKitBundle = (kitName: string) => {
    if (!activeCharacter?.sheet_data) return;
    const grants = collectKitTraitGrants(
      kitName,
      activeCharacter.sheet_data.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );

    updateActiveSheetData((prev) => {
      return applyKitTraitGrantsToSheet(prev, grants);
    });
    saveActiveCharacter();
  };

  // Handler: Unbundle/Remove a kit's traits from sheet
  const handleUnbundleKit = (kitName: string) => {
    if (!activeCharacter?.sheet_data) return;
    const cleanTarget = cleanKitName(kitName);

    updateActiveSheetData((prev) => {
      const updated = { ...prev };
      // Remove rules
      updated.traits_quirks = (prev.traits_quirks || []).filter(
        (t) => !matchesKitFilter(t.kit || t.table_group, cleanTarget) && !(t.source || '').includes(cleanTarget)
      );
      // Remove powers
      updated.character_power_codex = (prev.character_power_codex || []).filter(
        (p) => !matchesKitFilter(p.kit || p.table_group, cleanTarget)
      );
      updated.power_slots = (prev.power_slots || []).filter(
        (p) => !matchesKitFilter(p.kit || p.table_group, cleanTarget)
      );
      // Remove skills
      const kitSkills = stockSkillsCatalog
        .filter((s) => isTraitItem(s) && matchesKitFilter(s.kit || s.table_group, cleanTarget))
        .map((s) => s.name.toLowerCase());
      updated.known_individual_skills = (prev.known_individual_skills || []).filter(
        (sName) => !kitSkills.includes(sName.toLowerCase())
      );
      return updated;
    });
    saveActiveCharacter();
  };

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
      type: rule.type,
      notes: rule.notes || '',
      flaw_points: rule.flaw_points || 0,
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

    const kitValue = `${sanitizeKitInput(customKit.trim()) || 'Custom'} {Trait}`;
    const newRuleItem: RuleItem = {
      name: customName.trim(),
      type: customType,
      kit: kitValue,
      table_group: kitValue,
      flaw_points: customType === 'flaw' ? customFlawPoints : 0,
      stat_hook: parsedHook,
      notes: customNotes.trim(),
      source: 'Custom Forge',
    };

    addTraitQuirk(newRuleItem);

    // Reset Form
    setCustomName('');
    setCustomType('trait');
    setCustomKit('Custom');
    setCustomFlawPoints(0);
    setCustomStatHookPreset('none');
    setCustomNotes('');
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
                  Active Rules: {equippedRules.length}
                </span>
                {flawBonusAp > 0 && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
                    ⚠️ Flaw Bonus: +{flawBonusAp} / +5 Max AP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Equip rules, select hallmark core kits to bundle starting traits, or forge custom rules & handicaps.
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
                  const isFlaw = (rule.flaw_points || 0) > 0 || rule.type === 'flaw';

                  return (
                    <div
                      key={`${rule.name}_${idx}`}
                      className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shadow-sm ${
                        isFlaw
                          ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                          : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-outfit font-bold text-slate-100 flex items-center gap-1">
                            <span>{isFlaw ? '⚠️' : '🧬'}</span>
                            <span>{rule.name}</span>
                          </span>

                          {/* Clean Classification Pill */}
                          {isFlaw ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-amber-900/60 text-amber-300 border border-amber-500/40">
                              Flaw (+{rule.flaw_points || 1} AP)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                              🧬 {cleanKitName(rule.kit || rule.table_group || rule.source || 'General')}
                            </span>
                          )}
                        </div>

                        {/* Forget / Remove Button */}
                        <button
                          type="button"
                          onClick={() => removeTraitQuirk(rule.name)}
                          className="px-2 py-1 rounded-lg text-xs font-bold text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/60 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          title="Remove Rule"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Forget</span>
                        </button>
                      </div>

                      {/* Rule Description */}
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {rule.notes}
                      </p>

                      {/* Stat Hook Badge */}
                      {rule.stat_hook && (
                        <div
                          className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border w-fit shadow-inner ${
                            isFlaw
                              ? 'text-amber-300 bg-amber-950/60 border-amber-500/40'
                              : 'text-cyan-300 bg-cyan-950/40 border-cyan-500/30'
                          }`}
                        >
                          <span>{isFlaw ? '⚠️' : '✨'}</span>
                          <span>
                            {rule.stat_hook.type === 'mind_die'
                              ? 'Base AR = Mind Die Rating'
                              : `${rule.stat_hook.value && rule.stat_hook.value > 0 ? '+' : ''}${
                                  rule.stat_hook.value
                                } ${rule.stat_hook.target.toUpperCase()}`}
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
                    Select Hallmark Core Kits on the right to bundle starting traits & rules.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: CORE KITS BUNDLER, STOCK CATALOG & CUSTOM FORGE ================= */}
          <div className="flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner">
            {/* Top Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 shrink-0 gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightActiveTab('archetypes')}
                  className={`py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    rightActiveTab === 'archetypes'
                      ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>🏛️ Core Kits</span>
                </button>

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

            {/* TAB 1: CORE KITS BUNDLER */}
            {rightActiveTab === 'archetypes' && (
              <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
                <div className="p-2.5 bg-purple-950/30 border border-purple-500/30 rounded-xl text-xs text-purple-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Award className="w-4 h-4 text-purple-400" />
                    Hallmark Core Kits
                  </span>
                  <span className="text-[11px] text-purple-300 font-mono">
                    Auto-bundles 0 AP starting traits
                  </span>
                </div>

                {/* 3 Hallmark Selectors: Race, Class, Style */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* 1. Race / Ancestry */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span>🧬</span> Race / Ancestry
                    </label>
                    <select
                      value={HALLMARK_RACES.includes(selectedKit) ? selectedKit : ''}
                      onChange={(e) => {
                        if (e.target.value) setSelectedKit(e.target.value);
                      }}
                      className="bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                    >
                      <option value="">-- Pick Race --</option>
                      {HALLMARK_RACES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Class */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span>⚔️</span> Class
                    </label>
                    <select
                      value={HALLMARK_CLASSES.includes(selectedKit) ? selectedKit : ''}
                      onChange={(e) => {
                        if (e.target.value) setSelectedKit(e.target.value);
                      }}
                      className="bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                    >
                      <option value="">-- Pick Class --</option>
                      {HALLMARK_CLASSES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Combat Style */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span>🎯</span> Combat Style
                    </label>
                    <select
                      value={HALLMARK_STYLES.includes(selectedKit) ? selectedKit : ''}
                      onChange={(e) => {
                        if (e.target.value) setSelectedKit(e.target.value);
                      }}
                      className="bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-white outline-none focus:border-purple-500"
                    >
                      <option value="">-- Pick Style --</option>
                      {HALLMARK_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Multiclass / Extra Kits Option (with GM Warning) */}
                <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      Multiclass / Custom Kit (GM Approval)
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {allDiscoveredKits.length} kits found
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={extraKitSelected}
                      onChange={(e) => {
                        setExtraKitSelected(e.target.value);
                        if (e.target.value) {
                          setSelectedKit(e.target.value);
                          setShowGmWarning(true);
                        }
                      }}
                      className="bg-slate-950 text-xs px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-amber-200 outline-none flex-1"
                    >
                      <option value="">-- Select Any Hallmark Kit --</option>
                      {allDiscoveredKits.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  {showGmWarning && (
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                      ⚠️ <strong>GM Approval Notice:</strong> Selecting additional hallmark kits grants starting traits for multiclass or hybrid heritages.
                    </div>
                  )}
                </div>

                {/* Live Bundle Preview Card for Current Selected Kit */}
                {activeBundleGrants && (
                  <div className="p-3.5 rounded-xl border border-purple-500/40 bg-purple-950/20 flex flex-col gap-2.5 shadow-md">
                    <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-outfit font-black text-white">
                          🏛️ {activeBundleGrants.kitName || activeBundleGrants.tableName}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                          {activeBundleGrants.powers.length + activeBundleGrants.skills.length + activeBundleGrants.traits.length} Starting Grants
                        </span>
                      </div>

                      {/* Action Button: Apply or Unbundle */}
                      {isKitBundleEquipped ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> Active
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnbundleKit(activeBundleGrants.kitName || activeBundleGrants.tableName)}
                            className="px-2.5 py-1 text-xs font-bold text-rose-300 bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/80 rounded-lg transition-all cursor-pointer"
                          >
                            Unbundle
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyKitBundle(activeBundleGrants.kitName || activeBundleGrants.tableName)}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>+ Apply Core Traits (Free)</span>
                        </button>
                      )}
                    </div>

                    {/* Breakdown of Granted Items */}
                    <div className="space-y-1.5 text-xs">
                      {/* 1. Powers */}
                      {activeBundleGrants.powers.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono font-bold text-cyan-300 uppercase">
                            ⚡ Powers ({activeBundleGrants.powers.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeBundleGrants.powers.map((p) => (
                              <span
                                key={p.name}
                                className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] flex items-center gap-1"
                              >
                                <span>⚡</span> {p.name} [{p.action}]
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 2. Skills */}
                      {activeBundleGrants.skills.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono font-bold text-amber-300 uppercase">
                            👁️ Skills ({activeBundleGrants.skills.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeBundleGrants.skills.map((s) => (
                              <span
                                key={s.name}
                                className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] flex items-center gap-1"
                              >
                                <span>{s.attribute || '👁️'}</span> {s.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. Rules & Traits */}
                      {activeBundleGrants.traits.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase">
                            📜 Rules & Adaptations ({activeBundleGrants.traits.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {activeBundleGrants.traits.map((t) => (
                              <span
                                key={t.name}
                                className="px-2 py-0.5 rounded bg-slate-900 text-slate-200 border border-slate-800 font-mono text-[11px] flex items-center gap-1"
                              >
                                <span>📜</span> {t.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeBundleGrants.powers.length === 0 &&
                        activeBundleGrants.skills.length === 0 &&
                        activeBundleGrants.traits.length === 0 && (
                          <p className="text-xs text-slate-400 italic">
                            No (Trait) items currently assigned to this table. Items can be added at any time.
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: STANDALONE STOCK RULES & FLAWS CATALOG */}
            {rightActiveTab === 'catalog' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="relative mb-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search stock rules & flaws..."
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
                      const isFlaw = (rule.flaw_points || 0) > 0 || rule.type === 'flaw';

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
                                {isFlaw ? '⚠️' : '🧬'}
                                <span>{rule.name}</span>
                              </span>

                              {isFlaw ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-amber-900/60 text-amber-300 border border-amber-500/40">
                                  Flaw (+{rule.flaw_points || 1} AP)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                                  🧬 {cleanKitName(rule.kit || rule.table_group || 'General')}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed font-sans">{rule.notes}</p>
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
                                <span>+ Take Flaw (+{rule.flaw_points || 1} AP)</span>
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

            {/* TAB 3: CUSTOM FORGE */}
            {rightActiveTab === 'forge' && (
              <div className="flex flex-col flex-1 min-h-0 pt-2 overflow-y-auto pr-1">
                <form onSubmit={handleCreateCustomForge} className="flex flex-col gap-3">
                  <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      Create Custom Rule, Biological Trait or Handicap
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
                        <option value="trait">📜 Rule (Physiology / Rule Exception / Background)</option>
                        <option value="flaw">⚠️ Flaw (Handicap with AP Refund)</option>
                      </select>
                    </div>
                  </div>

                  {/* Kit & Flaw Points */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <option value={0}>0 AP (Standard Rule)</option>
                        <option value={1}>+1 AP (Minor Flaw / Handicap)</option>
                        <option value={2}>+2 AP (Major Flaw / Handicap)</option>
                        <option value={3}>+3 AP (Severe Flaw / Handicap)</option>
                        <option value={4}>+4 AP (Crippling Flaw / Handicap)</option>
                        <option value={5}>+5 AP (Maximum Flaw Cap)</option>
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

                  {/* Rule Description (Notes) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center">
                      Rule Description & Effect
                      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer inline ml-1" />
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the rule exception, biological trait, or flaw penalty..."
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
            <span className="text-amber-300 font-mono font-bold">
              Flaw Bonus: +{flawBonusAp} / +5 Max AP
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

export const ManageRulesModal = ManageTraitsModal;
