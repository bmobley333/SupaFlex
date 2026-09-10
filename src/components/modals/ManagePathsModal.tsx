// src/components/modals/ManagePathsModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Layers,
  Compass,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { calculateAvailableAp, Character } from '../../types/game';
import { cleanPathName, isMsoEntry, compareMsoOptions } from '../../utils/kitUtils';
import { collectPathTraitGrants, applyPathTraitGrantsToSheet } from '../../utils/bundleGrants';
import { reconcileAbilitiesOnPathAdded } from '../../utils/pathReconciliationUtils';
import { isGuildSpaceUnlocked } from '../../utils/guildspaceAuth';

interface ManagePathsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManagePathsModal: React.FC<ManagePathsModalProps> = ({ isOpen, onClose }) => {
  const {
    activeCharacter,
    powers: stockPowersCatalog = [],
    skills: stockSkillsCatalog = [],
    traits: stockRulesCatalog = [],
    kits: stockPathsCatalog = [],
    paths: pathsCatalog = [],
    activeRole,
    updateActiveSheetData,
    updateActiveCharacterMeta,
    saveActiveCharacter,
    recordApExpenditure,
  } = useCharacterStore();

  const resolvedPathsCatalog = useMemo(() => {
    return pathsCatalog.length > 0 ? pathsCatalog : stockPathsCatalog;
  }, [pathsCatalog, stockPathsCatalog]);

  const modalRef = useRef<HTMLDivElement>(null);

  // GuildSpace Setting Gate State
  const [isGsUnlocked, setIsGsUnlocked] = useState(isGuildSpaceUnlocked());
  const [selectedPathCategory, setSelectedPathCategory] = useState<string>('All');
  const [selectedExtraPathToBuy, setSelectedExtraPathToBuy] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleUnlock = () => setIsGsUnlocked(true);
    const handleLock = () => setIsGsUnlocked(false);

    window.addEventListener('supaflex:guildspace-unlocked', handleUnlock);
    window.addEventListener('supaflex:guildspace-locked', handleLock);

    return () => {
      window.removeEventListener('supaflex:guildspace-unlocked', handleUnlock);
      window.removeEventListener('supaflex:guildspace-locked', handleLock);
    };
  }, []);

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

  // Dynamic available path categories from database (excluding innate and non-purchasable universal)
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    resolvedPathsCatalog.forEach((k) => {
      const lower = (k.name || '').toLowerCase().trim();
      if (lower === 'base' || lower === 'universal') return;
      if (k.category && (k.category as string) !== '?') cats.add(k.category);
    });
    return ['All', ...Array.from(cats).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))];
  }, [resolvedPathsCatalog]);

  // Dynamic Race and Class Paths from Supabase public.paths / public.kits
  const racePaths = useMemo(() => {
    const fromDb = resolvedPathsCatalog.filter((k) => k.category === 'Race').map((k) => k.name);
    const list =
      fromDb.length > 0
        ? Array.from(new Set(fromDb))
        : ['Dwarf', 'Elf', 'Fairy', 'Gnome', 'Goblin', 'Half-Orc', 'Human', 'Nelf', 'Nymph', 'Orc'];
    return [...list].sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [resolvedPathsCatalog, isGsUnlocked]);

  const classPaths = useMemo(() => {
    const fromDb = resolvedPathsCatalog.filter((k) => k.category === 'Class').map((k) => k.name);
    const list =
      fromDb.length > 0
        ? Array.from(new Set(fromDb))
        : ['Adventurer', 'Warrior', 'Mage', 'Thief', 'Healer', 'Bard', 'Monk', 'Psionics'];
    return [...list].sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [resolvedPathsCatalog, isGsUnlocked]);

  // Available AP calculation
  const availableAp = useMemo(() => {
    const sheet = activeCharacter?.sheet_data;
    return calculateAvailableAp(sheet?.level || 1, sheet);
  }, [activeCharacter?.sheet_data]);

  const activeRace = activeCharacter?.race || 'Human';
  const activeClass = activeCharacter?.class || classPaths[0] || 'Warrior';

  // Learned Paths list (Starting Base + Race + Class + any learned extra paths)
  const learnedPaths: string[] = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    const base = ['Base', activeRace, activeClass];
    const combined = Array.from(new Set([...base, ...fromSheet])).filter(Boolean);
    return combined;
  }, [activeRace, activeClass, activeCharacter?.sheet_data?.favorite_trait_kits]);

  // All known discovered path names from catalogs
  const allDiscoveredPaths = useMemo(() => {
    const pathSet = new Set<string>();
    resolvedPathsCatalog.forEach((k) => pathSet.add(k.name));
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

    return Array.from(pathSet);
  }, [resolvedPathsCatalog, stockPathsCatalog, stockPowersCatalog, stockSkillsCatalog, stockRulesCatalog]);

  // Extra learned paths (excluding active starting base, universal, race, and class)
  const extraLearnedPaths: string[] = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    return fromSheet.filter((k) => {
      const lower = (k || '').toLowerCase().trim();
      return lower !== 'base' && lower !== 'universal' && k !== activeRace && k !== activeClass;
    });
  }, [activeRace, activeClass, activeCharacter?.sheet_data?.favorite_trait_kits]);

  const sortedExtraLearnedPaths = useMemo(() => {
    return [...extraLearnedPaths].sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [extraLearnedPaths, isGsUnlocked]);

  // Filtered paths available to buy / learn based on category selection (Universal & Base are excluded from purchase)
  const filteredPathsToBuy = useMemo(() => {
    return allDiscoveredPaths
      .filter((k) => {
        const lower = (k || '').toLowerCase().trim();
        return lower !== 'base' && lower !== 'universal' && !learnedPaths.includes(k);
      })
      .filter((k) => {
        if (selectedPathCategory === 'All') return true;
        const match =
          resolvedPathsCatalog.find((sk) => sk.name.toLowerCase() === k.toLowerCase()) ||
          stockPathsCatalog.find((sk) => sk.name.toLowerCase() === k.toLowerCase());
        return match?.category === selectedPathCategory;
      })
      .sort((a, b) => compareMsoOptions(a, b, isGsUnlocked));
  }, [allDiscoveredPaths, learnedPaths, selectedPathCategory, resolvedPathsCatalog, stockPathsCatalog, isGsUnlocked]);

  // Handle changing Race Path (GM only)
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
    const freeGrantNames = new Set([
      ...grants.powers.map((p) => p.name.toLowerCase().trim()),
      ...grants.traits.map((t) => t.name.toLowerCase().trim()),
    ]);
    const charWithNewRace: Character | null = activeCharacter
      ? { ...activeCharacter, race: newRace }
      : null;

    updateActiveSheetData((prev) => {
      const sheetWithGrants = applyPathTraitGrantsToSheet(prev, grants);
      const reconciliation = reconcileAbilitiesOnPathAdded(sheetWithGrants, newRace, charWithNewRace, freeGrantNames);
      if (reconciliation.totalRefund > 0) {
        recordApExpenditure(
          0,
          'Powers',
          `Path Mastery Auto-Credit: Selected Race ${newRace} (+${reconciliation.totalRefund} AP Refunded: ${reconciliation.refundLogDetails.join(', ')})`,
          1,
          'Paths Hub'
        );
      }
      return reconciliation.updatedSheetData;
    });

    saveActiveCharacter();
    setFeedbackMsg(`✓ Race Path updated to ${newRace}. Starting traits bundled!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle changing Class Path (GM only)
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
    const freeGrantNames = new Set([
      ...grants.powers.map((p) => p.name.toLowerCase().trim()),
      ...grants.traits.map((t) => t.name.toLowerCase().trim()),
    ]);
    const charWithNewClass: Character | null = activeCharacter
      ? { ...activeCharacter, class: newClass }
      : null;

    updateActiveSheetData((prev) => {
      const sheetWithGrants = applyPathTraitGrantsToSheet(prev, grants);
      const reconciliation = reconcileAbilitiesOnPathAdded(sheetWithGrants, newClass, charWithNewClass, freeGrantNames);
      if (reconciliation.totalRefund > 0) {
        recordApExpenditure(
          0,
          'Powers',
          `Path Mastery Auto-Credit: Selected Class ${newClass} (+${reconciliation.totalRefund} AP Refunded: ${reconciliation.refundLogDetails.join(', ')})`,
          1,
          'Paths Hub'
        );
      }
      return reconciliation.updatedSheetData;
    });

    saveActiveCharacter();
    setFeedbackMsg(`✓ Class Path updated to ${newClass}. In-path elements unlocked!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Handle learning new Path (4 AP or Free GM Grant)
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

    const grants = collectPathTraitGrants(
      clean,
      activeCharacter?.sheet_data?.level || 1,
      stockPowersCatalog,
      stockSkillsCatalog,
      stockRulesCatalog
    );
    const freeGrantNames = new Set([
      ...grants.powers.map((p) => p.name.toLowerCase().trim()),
      ...grants.traits.map((t) => t.name.toLowerCase().trim()),
    ]);

    let refundAmount = 0;
    updateActiveSheetData((prev) => {
      const currentList = Array.isArray(prev.favorite_trait_kits) ? prev.favorite_trait_kits : [];
      const updatedKits = Array.from(new Set([...currentList, clean]));
      const intermediateSheet = {
        ...prev,
        favorite_trait_kits: updatedKits,
      };
      const sheetWithGrants = applyPathTraitGrantsToSheet(intermediateSheet, grants);
      const charWithNewPath: Character | null = activeCharacter
        ? {
            ...activeCharacter,
            sheet_data: {
              ...activeCharacter.sheet_data,
              favorite_trait_kits: updatedKits,
            },
          }
        : null;

      const reconciliation = reconcileAbilitiesOnPathAdded(sheetWithGrants, clean, charWithNewPath, freeGrantNames);
      refundAmount = reconciliation.totalRefund;
      if (reconciliation.totalRefund > 0) {
        recordApExpenditure(
          0,
          'Powers',
          `Path Mastery Auto-Credit: Learned Path ${clean} (+${reconciliation.totalRefund} AP Refunded: ${reconciliation.refundLogDetails.join(', ')})`,
          1,
          'Paths Hub'
        );
      }
      return reconciliation.updatedSheetData;
    });

    saveActiveCharacter();
    setSelectedExtraPathToBuy('');
    if (refundAmount > 0) {
      setFeedbackMsg(`✓ Successfully unlocked Path: ${clean}! (+${refundAmount} AP Auto-Credited)`);
    } else {
      setFeedbackMsg(`✓ Successfully unlocked Path: ${clean}!`);
    }
    setTimeout(() => setFeedbackMsg(null), 3500);
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
                  Race • Class • Bonus Paths
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                View your active character paths and unlock new paths for your progression.
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
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
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
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-purple-400 hover:text-purple-200 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body: 2-Pane Architecture */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEFT PANE: Consolidated "My Paths" Card */}
          <div className="w-2/5 border-r border-slate-800/80 bg-slate-950/70 p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="p-4 bg-gradient-to-b from-slate-900/95 to-slate-950/95 rounded-2xl border border-purple-500/40 space-y-4 shadow-xl flex-1 flex flex-col">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/40">
                    <Compass className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="font-outfit font-black text-sm uppercase tracking-wider text-purple-200">
                    My Paths
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-500/40">
                  {4 + sortedExtraLearnedPaths.length} Active
                </span>
              </div>

              {/* Foundational Paths: Base, Race, Class & Universal */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Foundational Hero Paths
                </span>

                {/* Base Foundation */}
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/70 shadow-inner space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🥋</span>
                      <span>Base Path</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                      Innate
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs font-black inline-flex items-center align-baseline gap-1 text-slate-200">
                      <span>Base</span>
                      <ItemNotesPopover
                        notes={
                          resolvedPathsCatalog.find((p) => p.name.toLowerCase() === 'base')?.description ||
                          'Baseline universal physical capabilities and natural weapon/unarmored proficiencies common to all characters.'
                        }
                        itemName="Base Path"
                        inline
                      />
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">0 AP Inherent • 1 AP Proficiencies</span>
                  </div>
                </div>

                {/* Race Foundation */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-rose-950/30 to-slate-950/90 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.12)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🧬</span>
                      <span>Race Path</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40">
                      Race
                    </span>
                  </div>
                  {activeRole === 'gm' ? (
                    <select
                      value={activeRace}
                      onChange={(e) => handleSelectRacePath(e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-rose-500/40 rounded-lg px-2.5 py-1 text-xs text-rose-100 font-bold focus:outline-none focus:border-rose-400 cursor-pointer"
                    >
                      {racePaths.map((r) => (
                        <option
                          key={r}
                          value={r}
                          className={isMsoEntry(r) ? 'font-bold text-rose-300 bg-slate-900' : 'text-slate-100 bg-slate-950'}
                        >
                          {isMsoEntry(r) ? `🌌 ${r}` : r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center justify-between pt-0.5">
                      <span className={`text-xs font-black inline-flex items-center align-baseline gap-1 ${isMsoEntry(activeRace) ? 'text-rose-300' : 'text-rose-100'}`}>
                        <span>{isMsoEntry(activeRace) ? `🌌 ${activeRace}` : activeRace}</span>
                        <ItemNotesPopover notes={resolvedPathsCatalog.find((p) => p.name === activeRace)?.description || (resolvedPathsCatalog.find((p) => p.name === activeRace) as any)?.notes} itemName={activeRace} inline />
                      </span>
                      <span className="text-[10px] font-mono text-rose-400 font-semibold">0 AP Auto-Grant</span>
                    </div>
                  )}
                </div>

                {/* Class Foundation */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-purple-950/40 to-slate-950/90 border border-purple-500/50 shadow-[0_0_14px_rgba(168,85,247,0.18)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚔️</span>
                      <span>Class Path</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-200 border border-purple-500/50">
                      Class
                    </span>
                  </div>
                  {activeRole === 'gm' ? (
                    <select
                      value={activeClass}
                      onChange={(e) => handleSelectClassPath(e.target.value)}
                      className="w-full mt-1 bg-slate-900 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs text-purple-100 font-bold focus:outline-none focus:border-purple-400 cursor-pointer"
                    >
                      {classPaths.map((c) => (
                        <option
                          key={c}
                          value={c}
                          className={isMsoEntry(c) ? 'font-bold text-purple-300 bg-slate-900' : 'text-slate-100 bg-slate-950'}
                        >
                          {isMsoEntry(c) ? `🌌 ${c}` : c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center justify-between pt-0.5">
                      <span className={`text-xs font-black inline-flex items-center align-baseline gap-1 ${isMsoEntry(activeClass) ? 'text-purple-300' : 'text-purple-100'}`}>
                        <span>{isMsoEntry(activeClass) ? `🌌 ${activeClass}` : activeClass}</span>
                        <ItemNotesPopover notes={resolvedPathsCatalog.find((p) => p.name === activeClass)?.description || (resolvedPathsCatalog.find((p) => p.name === activeClass) as any)?.notes} itemName={activeClass} inline />
                      </span>
                      <span className="text-[10px] font-mono text-purple-300 font-semibold">In-Path Pricing</span>
                    </div>
                  )}
                </div>

                {/* Universal Foundation */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/30 to-slate-950/90 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.12)] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🌐</span>
                      <span>Universal Path</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      Universal
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs font-black inline-flex items-center align-baseline gap-1 text-cyan-100">
                      <span>Universal</span>
                      <ItemNotesPopover
                        notes={
                          resolvedPathsCatalog.find((p) => p.name.toLowerCase() === 'universal')?.description ||
                          'Heroic stunts, clutch fortune, and general utility abilities accessible to all adventurers.'
                        }
                        itemName="Universal Path"
                        inline
                      />
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 font-semibold">3 AP Self-Service • No GM Approval</span>
                  </div>
                </div>
              </div>

              {/* Learned Bonus Paths */}
              <div className="flex-1 flex flex-col min-h-0 space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    <span>Bonus Paths ({sortedExtraLearnedPaths.length})</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    🔒 Bound
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {sortedExtraLearnedPaths.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-400">No Bonus Paths</p>
                      <p className="text-[11px] text-slate-500">
                        Unlock new paths from the catalog on the right for 4 AP to expand your progression.
                      </p>
                    </div>
                  ) : (
                    sortedExtraLearnedPaths.map((pathName) => {
                      const isMso = isMsoEntry(pathName);
                      return (
                        <div
                          key={pathName}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            isMso
                              ? 'bg-purple-950/40 border-purple-500/40 shadow-sm'
                              : 'bg-slate-950/80 border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={isMso ? 'text-purple-400' : 'text-indigo-400'}>
                              {isMso ? '🌌' : '🧭'}
                            </span>
                            <span className={`text-xs font-bold inline-flex items-center align-baseline gap-1 truncate ${isMso ? 'text-purple-200' : 'text-slate-200'}`}>
                              <span className="truncate">{pathName}</span>
                              <ItemNotesPopover notes={resolvedPathsCatalog.find((p) => p.name === pathName)?.description || (resolvedPathsCatalog.find((p) => p.name === pathName) as any)?.notes} itemName={pathName} inline />
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-indigo-500/30 font-semibold">
                              Bonus
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                              🔒 Bound
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Path Catalog & Unlocking */}
          <div className="w-3/5 flex flex-col bg-slate-900/40 overflow-hidden">
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-purple-500/40 space-y-4 shadow-lg">
                {/* Header & Standard Cost */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span className="font-outfit font-black text-sm text-purple-200 uppercase tracking-wider">
                      Unlock New Path
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                      Standard Cost: 4 AP
                    </span>
                  </div>
                </div>

                {/* Permanent Acquisition Warning Banner */}
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-start gap-2.5 shadow-sm">
                  <span className="text-base leading-none">⚠️</span>
                  <div className="space-y-0.5">
                    <strong className="text-amber-300 font-bold block">Path Acquisition is Permanent</strong>
                    <p className="text-amber-200/90 text-[11px] leading-relaxed">
                      Once unlocked, paths are permanently bound to your hero and cannot be refunded or sold for AP.
                    </p>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Filter by Category</span>
                    <span className="text-[10px] font-mono text-slate-500">{availableCategories.length} Categories</span>
                  </label>
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
                </div>

                {/* Path Selection Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Select Path to Unlock</span>
                    <span className="text-[10px] font-mono text-purple-300 font-bold">
                      {filteredPathsToBuy.length} Available
                    </span>
                  </label>
                  <select
                    value={selectedExtraPathToBuy}
                    onChange={(e) => setSelectedExtraPathToBuy(e.target.value)}
                    className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-purple-400 cursor-pointer shadow-inner"
                  >
                    <option value="">-- Choose a Path ({filteredPathsToBuy.length} Available) --</option>
                    {filteredPathsToBuy.map((pathName) => {
                      const isMso = isMsoEntry(pathName);
                      return (
                        <option
                          key={pathName}
                          value={pathName}
                          className={isMso ? 'font-bold text-purple-300 bg-slate-900' : 'text-slate-100 bg-slate-950'}
                        >
                          {isMso ? `🌌 ${pathName}` : `🧭 ${pathName}`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Selected Path Details Card (if selected) */}
                {selectedExtraPathToBuy && (
                  <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-200 inline-flex items-center align-baseline gap-1.5">
                        <span>{isMsoEntry(selectedExtraPathToBuy) ? '🌌' : '🧭'}</span>
                        <span>{selectedExtraPathToBuy}</span>
                        <ItemNotesPopover notes={resolvedPathsCatalog.find((p) => p.name === selectedExtraPathToBuy)?.description || (resolvedPathsCatalog.find((p) => p.name === selectedExtraPathToBuy) as any)?.notes} itemName={selectedExtraPathToBuy} inline />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40">
                        {resolvedPathsCatalog.find((p) => p.name === selectedExtraPathToBuy)?.category || 'Path'}
                      </span>
                    </div>
                    {(() => {
                      const pathData = resolvedPathsCatalog.find((p) => p.name === selectedExtraPathToBuy);
                      const desc = pathData?.description || (pathData as any)?.notes;
                      return desc ? (
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {desc}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">
                          Unlocks in-path abilities, trait bundles, and mastery progressions for this path.
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={!selectedExtraPathToBuy || availableAp < 4}
                    onClick={() => handleLearnNewPath(4)}
                    className={`flex-1 py-2.5 px-4 rounded-xl font-outfit font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
                      selectedExtraPathToBuy && availableAp >= 4
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white cursor-pointer active:scale-95'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-purple-300" />
                    <span>Unlock Path (4 AP)</span>
                  </button>

                  {activeRole === 'gm' && (
                    <button
                      type="button"
                      disabled={!selectedExtraPathToBuy}
                      onClick={() => handleLearnNewPath(0)}
                      className={`py-2.5 px-4 rounded-xl font-outfit font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
                        selectedExtraPathToBuy
                          ? 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40 cursor-pointer'
                          : 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed'
                      }`}
                      title="Unlock as Free GM grant (0 AP)"
                    >
                      <span>🎁 Free GM Grant</span>
                    </button>
                  )}
                </div>
              </div>
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
