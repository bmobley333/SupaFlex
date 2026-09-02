// src/components/modals/ManagePathsModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Sparkles,
  Layers,
  Plus,
  Compass,
  Info,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import {
  AbilitySlot,
  TraitQuirkItem,
  calculateAvailableAp,
} from '../../types/game';
import { cleanPathName, matchesPathFilter } from '../../utils/kitUtils';
import { collectPathTraitGrants, applyPathTraitGrantsToSheet } from '../../utils/bundleGrants';

interface ManagePathsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManagePathsModal: React.FC<ManagePathsModalProps> = ({ isOpen, onClose }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const {
    activeCharacter,
    powers: stockPowersCatalog = [],
    skills: stockSkillsCatalog = [],
    traits: stockRulesCatalog = [],
    kits: stockPathsCatalog = [],
    updateActiveSheetData,
    updateActiveCharacterMeta,
    saveActiveCharacter,
    recordApExpenditure,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  const [rightActiveTab, setRightActiveTab] = useState<'in_path' | 'out_of_path' | 'paths_catalog'>('in_path');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPathCategory, setSelectedPathCategory] = useState<string>('All');
  const [selectedExtraPathToBuy, setSelectedExtraPathToBuy] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dynamic available path categories from database
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    stockPathsCatalog.forEach((k) => {
      if (k.category && (k.category as string) !== '?') cats.add(k.category);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [stockPathsCatalog]);

  // Dynamic Race and Class Paths from Supabase public.paths / public.kits
  const racePaths = useMemo(() => {
    const fromDb = stockPathsCatalog.filter((k) => k.category === 'Race').map((k) => k.name);
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
  }, [stockPathsCatalog]);

  const classPaths = useMemo(() => {
    const fromDb = stockPathsCatalog.filter((k) => k.category === 'Class').map((k) => k.name);
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
  }, [stockPathsCatalog]);

  // Available AP calculation
  const availableAp = useMemo(() => {
    const sheet = activeCharacter?.sheet_data;
    return calculateAvailableAp(sheet?.level || 1, sheet);
  }, [activeCharacter?.sheet_data]);

  const activeRace = activeCharacter?.race || 'Human';
  const activeClass = activeCharacter?.class || (classPaths[0] || 'Warrior');

  // Learned Paths list (Starting Race + Class + any learned extra paths)
  const learnedPaths: string[] = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    const base = [activeRace, activeClass];
    const combined = Array.from(new Set([...base, ...fromSheet])).filter(Boolean);
    return combined;
  }, [activeRace, activeClass, activeCharacter?.sheet_data?.favorite_trait_kits]);

  // All known discovered path names from catalogs
  const allDiscoveredPaths = useMemo(() => {
    const pathSet = new Set<string>();
    stockPathsCatalog.forEach((k) => pathSet.add(k.name));
    stockPowersCatalog.forEach((p) => {
      if (p.kit) pathSet.add(cleanPathName(p.kit));
    });
    stockSkillsCatalog.forEach((s) => {
      if (s.kit) pathSet.add(cleanPathName(s.kit));
    });
    stockRulesCatalog.forEach((r) => {
      if (r.kit) pathSet.add(cleanPathName(r.kit));
    });

    return Array.from(pathSet).sort();
  }, [stockPathsCatalog, stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Extra learned paths (excluding active starting race and class)
  const extraLearnedPaths: string[] = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    return fromSheet.filter((k) => k !== activeRace && k !== activeClass);
  }, [activeRace, activeClass, activeCharacter?.sheet_data?.favorite_trait_kits]);

  // Filtered paths available to buy / learn based on category selection
  const filteredPathsToBuy = useMemo(() => {
    return allDiscoveredPaths
      .filter((k) => !learnedPaths.includes(k))
      .filter((k) => {
        if (selectedPathCategory === 'All') return true;
        const match = stockPathsCatalog.find((sk) => sk.name.toLowerCase() === k.toLowerCase());
        return match?.category === selectedPathCategory;
      });
  }, [allDiscoveredPaths, learnedPaths, selectedPathCategory, stockPathsCatalog]);

  // In-Path Elements
  const inPathElements = useMemo(() => {
    const elements: Array<{
      type: 'power' | 'skill' | 'rule';
      name: string;
      path: string;
      cost: number;
      isTrait: boolean;
      description: string;
      raw: any;
    }> = [];

    learnedPaths.forEach((pathName) => {
      // Powers
      stockPowersCatalog.forEach((p) => {
        if (p.kit && matchesPathFilter(p.kit, pathName)) {
          const isTrait = p.kit.toLowerCase().includes('{trait}') || p.kit.toLowerCase().includes('{trait1}');
          elements.push({
            type: 'power',
            name: p.name,
            path: pathName,
            cost: isTrait ? 0 : 1,
            isTrait,
            description: p.effect || (p as any).notes || '',
            raw: p,
          });
        }
      });

      // Skills
      stockSkillsCatalog.forEach((s) => {
        if (s.kit && matchesPathFilter(s.kit, pathName)) {
          const isTrait = (s.kit || '').toLowerCase().includes('{trait}');
          elements.push({
            type: 'skill',
            name: s.name,
            path: pathName,
            cost: isTrait ? 0 : 1,
            isTrait,
            description: s.notes || `${s.name} skill (${s.attribute})`,
            raw: s,
          });
        }
      });

      // Rules
      stockRulesCatalog.forEach((r) => {
        if (r.kit && matchesPathFilter(r.kit, pathName)) {
          const isTrait = (r.kit || '').toLowerCase().includes('{trait}');
          elements.push({
            type: 'rule',
            name: r.name,
            path: pathName,
            cost: isTrait ? 0 : 1,
            isTrait,
            description: r.notes || r.effect || '',
            raw: r,
          });
        }
      });
    });

    return elements;
  }, [learnedPaths, stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Filtered In-Path Elements
  const filteredInPathElements = useMemo(() => {
    return inPathElements.filter((el) => {
      if (!matchesGenre(el.raw.genres || ['All'], activeGenre)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return el.name.toLowerCase().includes(q) || el.path.toLowerCase().includes(q) || el.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [inPathElements, activeGenre, searchQuery]);

  // Out-of-Path Elements
  const outOfPathElements = useMemo(() => {
    const elements: Array<{
      type: 'power' | 'skill' | 'rule';
      name: string;
      path: string;
      cost: number;
      description: string;
      raw: any;
    }> = [];

    stockPowersCatalog.forEach((p) => {
      const pathName = cleanPathName(p.kit || 'General');
      if (!learnedPaths.some((lk) => matchesPathFilter(pathName, lk))) {
        elements.push({
          type: 'power',
          name: p.name,
          path: pathName,
          cost: 2, // 1 Base + 1 Surcharge
          description: p.effect || (p as any).notes || '',
          raw: p,
        });
      }
    });

    stockRulesCatalog.forEach((r) => {
      const pathName = cleanPathName(r.kit || 'General');
      if (!learnedPaths.some((lk) => matchesPathFilter(pathName, lk))) {
        elements.push({
          type: 'rule',
          name: r.name,
          path: pathName,
          cost: 2, // 1 Base + 1 Surcharge
          description: r.notes || '',
          raw: r,
        });
      }
    });

    return elements;
  }, [learnedPaths, stockPowersCatalog, stockRulesCatalog]);

  // Filtered Out-of-Path Elements
  const filteredOutOfPathElements = useMemo(() => {
    return outOfPathElements.filter((el) => {
      if (!matchesGenre(el.raw.genres || ['All'], activeGenre)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return el.name.toLowerCase().includes(q) || el.path.toLowerCase().includes(q) || el.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [outOfPathElements, activeGenre, searchQuery]);

  // Handle changing Race Path
  const handleSelectRacePath = (newRace: string) => {
    if (!newRace || newRace === activeRace) return;
    updateActiveCharacterMeta({ race: newRace });
    const grants = collectPathTraitGrants(
      newRace,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    updateActiveSheetData((prev) => applyPathTraitGrantsToSheet(prev, grants));
    saveActiveCharacter();
    setFeedbackMsg(`✓ Race Path updated to ${newRace}. Starting traits bundled!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle changing Class Path
  const handleSelectClassPath = (newClass: string) => {
    if (!newClass || newClass === activeClass) return;
    updateActiveCharacterMeta({ class: newClass });
    const grants = collectPathTraitGrants(
      newClass,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    updateActiveSheetData((prev) => applyPathTraitGrantsToSheet(prev, grants));
    saveActiveCharacter();
    setFeedbackMsg(`✓ Class Path updated to ${newClass}. In-path elements unlocked!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle learning new Path (4 AP or Free)
  const handleLearnNewPath = (cost: number) => {
    if (!selectedExtraPathToBuy) return;
    const clean = cleanPathName(selectedExtraPathToBuy);
    if (learnedPaths.includes(clean)) {
      setFeedbackMsg(`⚠️ Already learned ${clean}.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }
    if (cost > 0 && availableAp < cost) {
      setFeedbackMsg(`❌ Not enough AP. Learning a new Path requires ${cost} AP.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    if (cost > 0) {
      recordApExpenditure(cost, 'Manual', `Learned New Path: ${clean}`, 'Creation', 'Paths Hub');
    } else {
      recordApExpenditure(0, 'GM Bonus', `Learned Free Path: ${clean}`, 'Creation', 'Paths Hub');
    }

    updateActiveSheetData((prev) => {
      const currentList = Array.isArray(prev.favorite_trait_kits) ? prev.favorite_trait_kits : [];
      return {
        ...prev,
        favorite_trait_kits: Array.from(new Set([...currentList, clean])),
      };
    });

    const grants = collectPathTraitGrants(
      clean,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    updateActiveSheetData((prev) => applyPathTraitGrantsToSheet(prev, grants));

    saveActiveCharacter();
    setSelectedExtraPathToBuy('');
    setFeedbackMsg(`✓ Successfully unlocked Path: ${clean}!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle deleting learned extra path
  const handleRemoveExtraPath = (pathName: string) => {
    updateActiveSheetData((prev) => {
      const currentList = Array.isArray(prev.favorite_trait_kits) ? prev.favorite_trait_kits : [];
      return {
        ...prev,
        favorite_trait_kits: currentList.filter((k) => k !== pathName),
      };
    });
    saveActiveCharacter();
    setFeedbackMsg(`✓ Removed Path: ${pathName}`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Equip In-Path / Out-of-Path Perk to Sheet
  const handleEquipElement = (el: { type: 'power' | 'skill' | 'rule'; name: string; path: string; cost: number; raw: any }) => {
    if (el.cost > 0 && availableAp < el.cost) {
      setFeedbackMsg(`❌ Insufficient AP! Requires ${el.cost} AP.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    if (el.type === 'power') {
      const currentSlots: AbilitySlot[] = activeCharacter?.sheet_data?.power_slots || [];
      const alreadyHas = currentSlots.some((s) => (s?.name || '').toLowerCase() === el.name.toLowerCase());
      if (alreadyHas) {
        setFeedbackMsg(`⚠️ Power "${el.name}" is already learned!`);
        setTimeout(() => setFeedbackMsg(null), 3000);
        return;
      }
      if (el.cost > 0) {
        recordApExpenditure(el.cost, 'Powers', `Learned Power: ${el.name} (${el.path})`, 1, 'Paths Hub');
      }
      const newSlot: any = {
        name: el.name,
        action: (el.raw.action || 'AM') as any,
        usage: el.raw.usage || '1-Enc',
        effect: el.raw.effect || '',
        checked: [false, false, false],
        version: 1,
        source: el.path,
      };
      updateActiveSheetData((prev) => ({
        ...prev,
        power_slots: [...(prev.power_slots || []), newSlot],
      }));
    } else if (el.type === 'skill') {
      const currentIndiv: string[] = activeCharacter?.sheet_data?.known_individual_skills || [];
      if (currentIndiv.includes(el.name)) {
        setFeedbackMsg(`⚠️ Skill "${el.name}" is already learned!`);
        setTimeout(() => setFeedbackMsg(null), 3000);
        return;
      }
      if (el.cost > 0) {
        recordApExpenditure(el.cost, 'Skills', `Learned Skill: ${el.name} (${el.path})`, 1, 'Paths Hub');
      }
      updateActiveSheetData((prev) => ({
        ...prev,
        known_individual_skills: [...currentIndiv, el.name],
      }));
    } else if (el.type === 'rule') {
      const currentRules: TraitQuirkItem[] = activeCharacter?.sheet_data?.traits_quirks || [];
      const alreadyHas = currentRules.some((r) => r.name.toLowerCase() === el.name.toLowerCase());
      if (alreadyHas) {
        setFeedbackMsg(`⚠️ Trait "${el.name}" is already equipped!`);
        setTimeout(() => setFeedbackMsg(null), 3000);
        return;
      }
      if (el.cost > 0) {
        recordApExpenditure(el.cost, 'Manual', `Equipped Trait: ${el.name} (${el.path})`, 1, 'Paths Hub');
      }
      const newRule: TraitQuirkItem = {
        id: el.raw.id || Date.now(),
        name: el.name,
        notes: el.raw.notes || el.raw.effect || '',
        source: el.path,
        is_hidden: false,
        created_at: new Date().toISOString(),
      };
      updateActiveSheetData((prev) => ({
        ...prev,
        traits_quirks: [...currentRules, newRule],
      }));
    }

    saveActiveCharacter();
    setFeedbackMsg(`✓ Successfully learned ${el.name}!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        ref={modalRef}
        className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-purple-500/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-purple-950/90 border border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
              <Compass className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-outfit font-black text-lg text-purple-200 tracking-wide uppercase flex items-center gap-2">
                <span>Manage Paths</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40">
                  Race • Class • Disciplines
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Select your starting hero progression paths, in-path perks, and unlock bonus disciplines.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Available AP Badge */}
            <div className="px-3 py-1 bg-slate-900 border border-amber-500/40 rounded-xl font-mono font-extrabold text-xs text-amber-300 shadow-inner flex items-center gap-1.5">
              <span>⚡ Available:</span>
              <strong className="text-amber-200">{availableAp} AP</strong>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Message Bar */}
        {feedbackMsg && (
          <div className="px-4 py-1.5 bg-purple-950/80 border-b border-purple-500/40 text-xs text-purple-200 font-bold flex items-center justify-between animate-fade-in shrink-0">
            <span>{feedbackMsg}</span>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-purple-400 hover:text-purple-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body: 2-Pane Architecture */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEFT PANE: Active Character Starting Paths & Learned Disciplines */}
          <div className="w-2/5 border-r border-slate-800/80 bg-slate-950/60 p-4 flex flex-col gap-4 overflow-y-auto">
            {/* Starting Paths Selector Card */}
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-purple-500/30 space-y-3 shadow-md">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <Compass className="w-4 h-4 text-purple-400" />
                <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-purple-300">
                  Starting Hero Paths
                </span>
              </div>

              {/* Race Path Dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>🧬 Race Path</span>
                  <span className="text-[10px] text-purple-400 font-mono">0 AP Auto-Grant</span>
                </label>
                <select
                  value={activeRace}
                  onChange={(e) => handleSelectRacePath(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-purple-400"
                >
                  {racePaths.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Path Dropdown */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>⚔️ Class Path</span>
                  <span className="text-[10px] text-purple-400 font-mono">In-Path AP Pricing</span>
                </label>
                <select
                  value={activeClass}
                  onChange={(e) => handleSelectClassPath(e.target.value)}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-purple-400"
                >
                  {classPaths.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Learned Extra Paths / Disciplines */}
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Learned Bonus Paths ({extraLearnedPaths.length})</span>
                </span>
              </div>

              {extraLearnedPaths.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic py-1">
                  No additional paths learned. Unlock paths in the Path Catalog tab for 4 AP.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {extraLearnedPaths.map((pathName) => (
                    <div
                      key={pathName}
                      className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <span>🧭 {pathName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraPath(pathName)}
                        className="text-indigo-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                        title="Remove learned path"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Paths Summary Roster */}
            <div className="flex-1 flex flex-col min-h-0 space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
                Active Paths Roster
              </span>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {learnedPaths.map((lp, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-purple-400">🧭</span>
                      <span className="font-bold text-slate-200">{lp}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-purple-300 border border-purple-500/30 font-bold">
                      {lp === activeRace ? 'Race' : lp === activeClass ? 'Class' : 'Bonus'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Tabs for In-Path Perks, Out-of-Path Perks & Path Catalog */}
          <div className="w-3/5 flex flex-col bg-slate-900/40 overflow-hidden">
            {/* Right Pane Tab Navigation Bar */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRightActiveTab('in_path')}
                  className={`px-3 py-1.5 rounded-lg font-outfit font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    rightActiveTab === 'in_path'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>In-Path Perks ({inPathElements.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightActiveTab('out_of_path')}
                  className={`px-3 py-1.5 rounded-lg font-outfit font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    rightActiveTab === 'out_of_path'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Out-of-Path (+1 AP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightActiveTab('paths_catalog')}
                  className={`px-3 py-1.5 rounded-lg font-outfit font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                    rightActiveTab === 'paths_catalog'
                      ? 'bg-purple-700 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Unlock Paths (4 AP)</span>
                </button>
              </div>

              {/* Search Bar for Perks */}
              {rightActiveTab !== 'paths_catalog' && (
                <div className="relative flex-1 max-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search perks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 p-4 overflow-y-auto min-h-0 space-y-2">
              {/* TAB 1: IN-PATH PERKS */}
              {rightActiveTab === 'in_path' && (
                <>
                  {filteredInPathElements.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs italic">
                      <Compass className="w-8 h-8 text-slate-700 mb-2 stroke-[1.5]" />
                      <span>No in-path perks match your current search.</span>
                    </div>
                  ) : (
                    filteredInPathElements.map((el, idx) => (
                      <div
                        key={el.name + idx}
                        className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-purple-500/40 flex items-start justify-between gap-3 shadow-md transition-all"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-outfit font-bold text-sm text-slate-100">{el.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-500/30">
                              🧭 {el.path}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 uppercase">
                              {el.type}
                            </span>
                            {el.isTrait && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                                0 AP Starting Trait
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{el.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEquipElement(el)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-outfit font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Learn ({el.cost === 0 ? 'Free' : `${el.cost} AP`})</span>
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: OUT-OF-PATH PERKS */}
              {rightActiveTab === 'out_of_path' && (
                <>
                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-center gap-2 mb-2 shrink-0">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>
                      Out-of-Path perks incur a <strong>+1 AP cross-discipline surcharge</strong>.
                    </span>
                  </div>

                  {filteredOutOfPathElements.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs italic">
                      <Sparkles className="w-8 h-8 text-slate-700 mb-2 stroke-[1.5]" />
                      <span>No out-of-path perks found.</span>
                    </div>
                  ) : (
                    filteredOutOfPathElements.map((el, idx) => (
                      <div
                        key={el.name + idx}
                        className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-indigo-500/40 flex items-start justify-between gap-3 shadow-md transition-all"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-outfit font-bold text-sm text-slate-100">{el.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                              🧭 {el.path}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800 uppercase">
                              {el.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{el.description}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEquipElement(el)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-outfit font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Learn ({el.cost} AP)</span>
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 3: UNLOCK NEW PATHS (4 AP) */}
              {rightActiveTab === 'paths_catalog' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-purple-500/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-outfit font-extrabold text-sm text-purple-200 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>Unlock New Discipline or Path</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        Standard Cost: 4 AP
                      </span>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap gap-1">
                      {availableCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedPathCategory(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                            selectedPathCategory === cat
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Path Selection Dropdown */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Select Path to Unlock
                      </label>
                      <select
                        value={selectedExtraPathToBuy}
                        onChange={(e) => setSelectedExtraPathToBuy(e.target.value)}
                        className="w-full bg-slate-900 border border-purple-500/40 rounded-lg px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-purple-400"
                      >
                        <option value="">-- Choose a Path ({filteredPathsToBuy.length} Available) --</option>
                        {filteredPathsToBuy.map((pathName) => (
                          <option key={pathName} value={pathName}>
                            🧭 {pathName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={!selectedExtraPathToBuy || availableAp < 4}
                        onClick={() => handleLearnNewPath(4)}
                        className={`flex-1 py-2 px-3 rounded-xl font-outfit font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all ${
                          selectedExtraPathToBuy && availableAp >= 4
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-purple-300" />
                        <span>Unlock Path (4 AP)</span>
                      </button>

                      <button
                        type="button"
                        disabled={!selectedExtraPathToBuy}
                        onClick={() => handleLearnNewPath(0)}
                        className={`py-2 px-3 rounded-xl font-outfit font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                          selectedExtraPathToBuy
                            ? 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40 cursor-pointer'
                            : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed'
                        }`}
                        title="Unlock as Free GM grant (0 AP)"
                      >
                        <span>🎁 Free GM Grant</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Backward compatibility alias
export const ManageKitsModal = ManagePathsModal;
