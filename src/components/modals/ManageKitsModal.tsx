// src/components/modals/ManageKitsModal.tsx
import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Sparkles,
  Layers,
  Plus,
  Info,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import {
  AbilitySlot,
  TraitQuirkItem,
  calculateAvailableAp,
} from '../../types/game';
import { cleanKitName, matchesKitFilter } from '../../utils/kitUtils';
import { collectKitTraitGrants, applyKitTraitGrantsToSheet } from '../../utils/bundleGrants';

interface ManageKitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageKitsModal: React.FC<ManageKitsModalProps> = ({ isOpen, onClose }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const {
    activeCharacter,
    powers: stockPowersCatalog = [],
    skills: stockSkillsCatalog = [],
    traits: stockRulesCatalog = [],
    kits: stockKitsCatalog = [],
    updateActiveSheetData,
    updateActiveCharacterMeta,
    saveActiveCharacter,
    recordApExpenditure,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  const [rightActiveTab, setRightActiveTab] = useState<'in_kit' | 'out_of_kit' | 'kits_catalog'>('in_kit');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKitCategory, setSelectedKitCategory] = useState<string>('All');
  const [selectedExtraKitToBuy, setSelectedExtraKitToBuy] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Dynamic available kit categories from database
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    stockKitsCatalog.forEach((k) => {
      if (k.category && (k.category as string) !== '?') cats.add(k.category);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [stockKitsCatalog]);

  // Dynamic Race and Class Kits from Supabase public.kits table
  const raceKits = useMemo(() => {
    const fromDb = stockKitsCatalog.filter((k) => k.category === 'Race').map((k) => k.name);
    if (fromDb.length > 0) return fromDb.sort();
    return [
      'Dwarf',
      'Dwarf - Blackaxe Clan',
      'Elf',
      'Fairy',
      'Gnome',
      'Goblin',
      'Half-Orc',
      'Human',
      'Human - Bloodmarked',
      'Nelf',
      'Nymph',
      'Orc',
    ].sort();
  }, [stockKitsCatalog]);

  const classKits = useMemo(() => {
    const fromDb = stockKitsCatalog.filter((k) => k.category === 'Class').map((k) => k.name);
    if (fromDb.length > 0) return fromDb.sort();
    return [
      'Bard',
      'Form - Giant',
      'Form - Nymph',
      'Form - Pixie',
      'Healer',
      'Healer - Sun-Devoted',
      'Healer - Verdant Sentinel',
      'Mage - Elemental',
      'Mage - Geomancer',
      'Mage - Magnetic',
      'Mage - Void Magic',
      'Martial Artist - Blade Saint',
      'Monk',
      'Psionics',
      'Psionics - Sentinel',
      'Psychosomatics',
      'Starborn Ranger',
      'Thief - Assassin',
      'Trickster',
      'Unique - Bio Engineer',
      'Warrior',
      'Warrior - Aetherblade',
      'Warrior - Bloodfang Berserker',
      'Warrior - Cursed Spartan',
      'Warrior - Inferno Vanguard',
      'Warrior - Lifestealer',
      'Warrior - Punk',
      'Warrior - Ranger',
      'Warrior - Shield',
    ].sort();
  }, [stockKitsCatalog]);

  // Available AP calculation
  const availableAp = useMemo(() => {
    const sheet = activeCharacter?.sheet_data;
    return calculateAvailableAp(sheet?.level || 1, sheet);
  }, [activeCharacter?.sheet_data]);

  const activeRace = activeCharacter?.race || 'Human';
  const activeClass = activeCharacter?.class || (classKits[0] || 'Warrior');

  // Learned Kits list (Starting Race + Class + any learned extra kits)
  const learnedKits: string[] = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    const base = [activeRace, activeClass];
    const combined = Array.from(new Set([...base, ...fromSheet])).filter(Boolean);
    return combined;
  }, [activeRace, activeClass, activeCharacter?.sheet_data?.favorite_trait_kits]);

  // All known discovered kit names from catalogs
  const allDiscoveredKits = useMemo(() => {
    const kitSet = new Set<string>();
    stockKitsCatalog.forEach((k) => kitSet.add(k.name));
    stockPowersCatalog.forEach((p) => {
      if (p.kit) kitSet.add(cleanKitName(p.kit));
    });
    stockSkillsCatalog.forEach((s) => {
      if (s.kit) kitSet.add(cleanKitName(s.kit));
    });
    stockRulesCatalog.forEach((r) => {
      if (r.kit) kitSet.add(cleanKitName(r.kit));
    });

    return Array.from(kitSet).sort();
  }, [stockKitsCatalog, stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Extra learned kits (excluding active starting race and class)
  const extraLearnedKits: string[] = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    return fromSheet.filter((k) => k !== activeRace && k !== activeClass);
  }, [activeRace, activeClass, activeCharacter?.sheet_data?.favorite_trait_kits]);

  // Filtered kits available to buy / learn based on category selection
  const filteredKitsToBuy = useMemo(() => {
    return allDiscoveredKits
      .filter((k) => !learnedKits.includes(k))
      .filter((k) => {
        if (selectedKitCategory === 'All') return true;
        const match = stockKitsCatalog.find((sk) => sk.name.toLowerCase() === k.toLowerCase());
        return match?.category === selectedKitCategory;
      });
  }, [allDiscoveredKits, learnedKits, selectedKitCategory, stockKitsCatalog]);

  // In-Kit Elements
  const inKitElements = useMemo(() => {
    const elements: Array<{
      type: 'power' | 'skill' | 'rule';
      name: string;
      kit: string;
      cost: number;
      isTrait: boolean;
      description: string;
      raw: any;
    }> = [];

    learnedKits.forEach((kitName) => {
      // Powers
      stockPowersCatalog.forEach((p) => {
        if (p.kit && matchesKitFilter(p.kit, kitName)) {
          const isTrait = p.kit.toLowerCase().includes('{trait}') || p.kit.toLowerCase().includes('{trait1}');
          elements.push({
            type: 'power',
            name: p.name,
            kit: kitName,
            cost: isTrait ? 0 : 1,
            isTrait,
            description: p.effect || (p as any).notes || '',
            raw: p,
          });
        }
      });

      // Skills
      stockSkillsCatalog.forEach((s) => {
        if (s.kit && matchesKitFilter(s.kit, kitName)) {
          const isTrait = (s.kit || '').toLowerCase().includes('{trait}');
          elements.push({
            type: 'skill',
            name: s.name,
            kit: kitName,
            cost: isTrait ? 0 : 1,
            isTrait,
            description: s.notes || `${s.name} skill (${s.attribute})`,
            raw: s,
          });
        }
      });

      // Rules
      stockRulesCatalog.forEach((r) => {
        if (r.kit && matchesKitFilter(r.kit, kitName)) {
          const isTrait = (r.kit || '').toLowerCase().includes('{trait}');
          elements.push({
            type: 'rule',
            name: r.name,
            kit: kitName,
            cost: isTrait ? 0 : 1,
            isTrait,
            description: r.notes || r.effect || '',
            raw: r,
          });
        }
      });
    });

    return elements;
  }, [learnedKits, stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Filtered In-Kit Elements
  const filteredInKitElements = useMemo(() => {
    return inKitElements.filter((el) => {
      if (!matchesGenre(el.raw.genres || ['All'], activeGenre)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return el.name.toLowerCase().includes(q) || el.kit.toLowerCase().includes(q) || el.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [inKitElements, activeGenre, searchQuery]);

  // Out-of-Kit Elements
  const outOfKitElements = useMemo(() => {
    const elements: Array<{
      type: 'power' | 'skill' | 'rule';
      name: string;
      kit: string;
      cost: number;
      description: string;
      raw: any;
    }> = [];

    stockPowersCatalog.forEach((p) => {
      const kitName = cleanKitName(p.kit || 'General');
      if (!learnedKits.some((lk) => matchesKitFilter(kitName, lk))) {
        elements.push({
          type: 'power',
          name: p.name,
          kit: kitName,
          cost: 2, // 1 Base + 1 Surcharge
          description: p.effect || (p as any).notes || '',
          raw: p,
        });
      }
    });

    stockRulesCatalog.forEach((r) => {
      const kitName = cleanKitName(r.kit || 'General');
      if (!learnedKits.some((lk) => matchesKitFilter(kitName, lk))) {
        elements.push({
          type: 'rule',
          name: r.name,
          kit: kitName,
          cost: 2, // 1 Base + 1 Surcharge
          description: r.notes || '',
          raw: r,
        });
      }
    });

    return elements;
  }, [learnedKits, stockPowersCatalog, stockRulesCatalog]);

  // Filtered Out-of-Kit Elements
  const filteredOutOfKitElements = useMemo(() => {
    return outOfKitElements.filter((el) => {
      if (!matchesGenre(el.raw.genres || ['All'], activeGenre)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return el.name.toLowerCase().includes(q) || el.kit.toLowerCase().includes(q) || el.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [outOfKitElements, activeGenre, searchQuery]);

  // Handle changing Race Kit
  const handleSelectRaceKit = (newRace: string) => {
    if (!newRace || newRace === activeRace) return;
    updateActiveCharacterMeta({ race: newRace });
    const grants = collectKitTraitGrants(
      newRace,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    updateActiveSheetData((prev) => applyKitTraitGrantsToSheet(prev, grants));
    saveActiveCharacter();
    setFeedbackMsg(`✓ Race Kit updated to ${newRace}. Starting traits bundled!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle changing Class Kit
  const handleSelectClassKit = (newClass: string) => {
    if (!newClass || newClass === activeClass) return;
    updateActiveCharacterMeta({ class: newClass });
    const grants = collectKitTraitGrants(
      newClass,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    updateActiveSheetData((prev) => applyKitTraitGrantsToSheet(prev, grants));
    saveActiveCharacter();
    setFeedbackMsg(`✓ Class Kit updated to ${newClass}. In-kit elements unlocked!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle learning new Kit (4 AP or Free)
  const handleLearnNewKit = (cost: number) => {
    if (!selectedExtraKitToBuy) return;
    const clean = cleanKitName(selectedExtraKitToBuy);
    if (learnedKits.includes(clean)) {
      setFeedbackMsg(`⚠️ Already learned ${clean}.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }
    if (cost > 0 && availableAp < cost) {
      setFeedbackMsg(`❌ Not enough AP. Learning a new Kit requires ${cost} AP.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    // Record AP expenditure if cost > 0 or log free grant
    if (cost > 0) {
      recordApExpenditure(cost, 'Manual', `Learned New Kit: ${clean}`, 'Creation', 'Kits Hub');
    } else {
      recordApExpenditure(0, 'GM Bonus', `Learned Free Kit: ${clean}`, 'Creation', 'Kits Hub');
    }

    // Update favorite/learned kits array
    updateActiveSheetData((prev) => {
      const current = prev.favorite_trait_kits || [];
      if (current.includes(clean)) return prev;
      return {
        ...prev,
        favorite_trait_kits: [...current, clean],
      };
    });

    // Apply any 0 AP trait grants in the kit
    const grants = collectKitTraitGrants(
      clean,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    updateActiveSheetData((prev) => applyKitTraitGrantsToSheet(prev, grants));
    saveActiveCharacter();

    setSelectedExtraKitToBuy('');
    setFeedbackMsg(`🎉 Successfully learned Kit "${clean}" ${cost > 0 ? 'for 4 AP' : '(Free)'}!`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Handle learning an individual element
  const handleLearnElement = (el: { type: string; name: string; cost: number; kit: string; raw: any }) => {
    if (el.cost > 0 && availableAp < el.cost) {
      setFeedbackMsg(`❌ Not enough AP. Requires ${el.cost} AP.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    if (el.cost > 0) {
      recordApExpenditure(el.cost, el.type === 'power' ? 'Powers' : el.type === 'skill' ? 'Skills' : 'Manual', `Learned ${el.name} (${el.kit})`, 1, 'Kits Hub');
    }

    if (el.type === 'power') {
      updateActiveSheetData((prev) => {
        const codex = prev.character_power_codex || [];
        if (codex.some((p) => p.name.toLowerCase() === el.name.toLowerCase())) return prev;
        const newSlot: AbilitySlot = {
          select: false,
          name: el.raw.name,
          action: el.raw.action || 'A',
          usage: el.raw.usage || '1-Enc',
          effect: el.raw.effect || '',
          checked: [false, false, false, false, false],
          kit: el.kit,
          table_group: el.kit,
          discipline: el.raw.discipline,
        };
        return { ...prev, character_power_codex: [...codex, newSlot] };
      });
    } else if (el.type === 'skill') {
      updateActiveSheetData((prev) => {
        const skills = prev.known_individual_skills || [];
        if (skills.includes(el.name)) return prev;
        return { ...prev, known_individual_skills: [...skills, el.name] };
      });
    } else if (el.type === 'rule') {
      updateActiveSheetData((prev) => {
        const rules = prev.traits_quirks || [];
        if (rules.some((r) => r.name.toLowerCase() === el.name.toLowerCase())) return prev;
        const newRule: TraitQuirkItem = {
          name: el.raw.name,
          effect: el.raw.effect || '',
          notes: el.raw.notes || '',
          kit: el.kit,
          source: `${el.kit} Kit`,
          stat_hook: el.raw.stat_hook,
        };
        return { ...prev, traits_quirks: [...rules, newRule] };
      });
    }

    saveActiveCharacter();
    setFeedbackMsg(`✓ Learned "${el.name}" for ${el.cost} AP!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 rounded-3xl w-full max-w-5xl h-[88vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden relative"
      >
        {/* ================= 1. MODAL HEADER ================= */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-purple-950/80 border border-purple-500/50 text-purple-300 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <span className="text-xl leading-none">🎭</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-outfit font-black text-lg tracking-wider text-white uppercase">
                  Manage Kits
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-500/40 text-[11px] font-mono font-bold">
                  {learnedKits.length} Active Kits
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold">
                  Available AP: {availableAp}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Select starting Race & Class Kits, browse In-Kit element shopping (1 AP), or unlock new Kits (4 AP).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div className="bg-purple-950/90 border-b border-purple-500/40 px-4 py-2 text-xs font-mono font-bold text-purple-200 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* ================= 2. SPLIT-PANE BODY ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/30">
          
          {/* ================= LEFT COLUMN: ACTIVE LEARNED KITS (5 Cols) ================= */}
          <div className="md:col-span-5 flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-outfit font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Learned Kits ({learnedKits.length})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                2 Starting + Extra
              </span>
            </div>

            {/* 1. Single-Line Starting Race Kit */}
            <div className="flex items-center gap-2 p-2 bg-purple-950/20 border border-purple-500/30 rounded-xl">
              <label className="text-xs font-outfit font-bold text-purple-200 flex items-center gap-1 shrink-0 w-14">
                <span>🧬</span> Race
              </label>
              <select
                value={activeRace}
                onChange={(e) => handleSelectRaceKit(e.target.value)}
                className="flex-1 bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-purple-500 font-semibold"
              >
                {raceKits.map((r) => (
                  <option key={r} value={r}>
                    🧬 {r}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Single-Line Starting Class Kit */}
            <div className="flex items-center gap-2 p-2 bg-indigo-950/20 border border-indigo-500/30 rounded-xl">
              <label className="text-xs font-outfit font-bold text-indigo-200 flex items-center gap-1 shrink-0 w-14">
                <span>⚔️</span> Class
              </label>
              <select
                value={activeClass}
                onChange={(e) => handleSelectClassKit(e.target.value)}
                className="flex-1 bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-indigo-500 font-semibold"
              >
                {classKits.map((c) => (
                  <option key={c} value={c}>
                    ⚔️ {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Additional Kits Controls */}
            <div className="p-3 bg-amber-950/15 border border-amber-500/30 rounded-xl flex flex-col gap-2.5">
              <span className="text-xs font-outfit font-bold text-amber-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>✨</span> Additional Kits ({extraLearnedKits.length})
                </span>
                <span className="text-[10px] font-mono text-amber-300 font-normal">Available AP: {availableAp}</span>
              </span>

              {/* Line 1: Kit Category Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-300 shrink-0 w-22">
                  Kit Category
                </label>
                <select
                  value={selectedKitCategory}
                  onChange={(e) => {
                    setSelectedKitCategory(e.target.value);
                    setSelectedExtraKitToBuy('');
                  }}
                  className="flex-1 bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-amber-500 font-medium"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Line 2: New Kit Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-300 shrink-0 w-22">
                  New Kit
                </label>
                <select
                  value={selectedExtraKitToBuy}
                  onChange={(e) => setSelectedExtraKitToBuy(e.target.value)}
                  className="flex-1 bg-slate-900 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Kit to Learn --</option>
                  {filteredKitsToBuy.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons: Learn (4 AP) & Learn Free */}
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleLearnNewKit(4)}
                  disabled={!selectedExtraKitToBuy || availableAp < 4}
                  className="flex-1 py-1.5 px-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
                >
                  Learn (4 AP)
                </button>
                <button
                  type="button"
                  onClick={() => handleLearnNewKit(0)}
                  disabled={!selectedExtraKitToBuy}
                  className="flex-1 py-1.5 px-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
                >
                  Learn Free
                </button>
              </div>
            </div>

            {/* 4. Additional Learned Kits Cards List */}
            <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto">
              {extraLearnedKits.length > 0 ? (
                extraLearnedKits.map((k, idx) => {
                  const is4Ap = activeCharacter?.sheet_data?.ap_log?.some(
                    (e) => e && e.description?.includes(k) && e.cost === 4
                  );
                  return (
                    <div
                      key={`${k}_${idx}`}
                      className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between shadow-sm"
                    >
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <span>🎭</span> {k}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                          is4Ap
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                            : 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/40'
                        }`}
                      >
                        {is4Ap ? '✓ 4 AP' : '✓ Free'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 text-xs text-slate-500 italic text-center">
                  No additional kits learned yet.
                </div>
              )}
            </div>

          </div>

          {/* ================= RIGHT COLUMN: ELEMENT AP SHOP & CATALOG (7 Cols) ================= */}
          <div className="md:col-span-7 flex flex-col bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3.5 min-h-0 shadow-inner">
            
            {/* Navigation Tabs & Search */}
            <div className="flex flex-col gap-2.5 pb-2.5 mb-2 border-b border-slate-800 shrink-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRightActiveTab('in_kit')}
                    className={`py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      rightActiveTab === 'in_kit'
                        ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🌟</span>
                    <span>In-Kit Elements ({filteredInKitElements.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightActiveTab('out_of_kit')}
                    className={`py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      rightActiveTab === 'out_of_kit'
                        ? 'bg-slate-800 text-purple-300 border border-purple-500/40 shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🌐</span>
                    <span>Out-of-Kit (+1 AP)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightActiveTab('kits_catalog')}
                    className={`py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      rightActiveTab === 'kits_catalog'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🎭</span>
                    <span>Kits Directory</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={rightActiveTab === 'in_kit' ? "Filter In-Kit elements..." : "Search catalog..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900/90 text-xs pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-800 text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* TAB 1: IN-KIT ELEMENTS (1 AP / 2 AP / 0 AP TRAITS) */}
            {rightActiveTab === 'in_kit' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
                {filteredInKitElements.length > 0 ? (
                  filteredInKitElements.map((el, idx) => (
                    <div
                      key={`${el.name}_${idx}`}
                      className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/70 hover:border-purple-500/40 transition-all flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-outfit font-bold text-slate-100 flex items-center gap-1">
                            <span>{el.type === 'power' ? '🔥' : el.type === 'skill' ? '🎓' : '📜'}</span>
                            <span>{el.name}</span>
                          </span>
                          <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                            🎭 {el.kit}
                          </span>
                          {el.isTrait && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                              🧬 Trait (0 AP)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLearnElement(el)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-purple-200 bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Learn ({el.cost} AP)</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {el.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500 italic bg-slate-900/30 rounded-xl border border-slate-800/60 flex flex-col items-center justify-center gap-1">
                    <span>No matching In-Kit elements found.</span>
                    <span className="text-slate-600 text-[11px]">
                      Select your starting Race & Class or unlock new Kits to populate this list.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: OUT-OF-KIT ELEMENTS (+1 AP SURCHARGE) */}
            {rightActiveTab === 'out_of_kit' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
                <div className="p-2.5 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-400" />
                    Cross-Kit Learning (+1 AP Surcharge)
                  </span>
                  <span className="text-[10px] font-mono text-amber-300">
                    Requires GM Approval
                  </span>
                </div>

                {filteredOutOfKitElements.map((el, idx) => (
                  <div
                    key={`${el.name}_${idx}`}
                    className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/70 hover:border-amber-500/40 transition-all flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-outfit font-bold text-slate-100 flex items-center gap-1">
                          <span>{el.type === 'power' ? '🔥' : '📜'}</span>
                          <span>{el.name}</span>
                        </span>
                        <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          From: {el.kit}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLearnElement(el)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-200 bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Learn ({el.cost} AP)</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {el.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: KITS CATALOG */}
            {rightActiveTab === 'kits_catalog' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
                {allDiscoveredKits.map((kitName, idx) => {
                  const isLearned = learnedKits.includes(kitName);
                  return (
                    <div
                      key={`${kitName}_${idx}`}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isLearned
                          ? 'bg-purple-950/20 border-purple-500/40'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{isLearned ? '👑' : '🎭'}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-outfit font-bold text-slate-100">
                            {kitName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {isLearned ? 'Currently Known / In-Kit' : 'Available to Learn (4 AP)'}
                          </span>
                        </div>
                      </div>

                      {isLearned ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                          ✓ Learned
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExtraKitToBuy(kitName);
                              handleLearnNewKit(4);
                            }}
                            disabled={availableAp < 4}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-200 bg-amber-950/80 hover:bg-amber-900 disabled:opacity-40 border border-amber-500/40 shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>Learn (4 AP)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExtraKitToBuy(kitName);
                              handleLearnNewKit(0);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-200 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span>Learn Free</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* ================= 3. FOOTER ================= */}
        <div className="flex items-center justify-between p-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <span className="text-[11px] font-mono text-slate-400">
            Hero: <strong className="text-purple-300">{activeCharacter?.name}</strong> • Level {activeCharacter?.sheet_data?.level || 1}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
