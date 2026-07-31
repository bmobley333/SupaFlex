// src/components/modals/AttributeManagerModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  RotateCcw,
  TrendingUp,
  Check,
  Award,
  Zap,
  Shield,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  AttributeKey,
  DieRating,
  calculateAvailableAp,
} from '../../types/game';

interface AttributeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  emoji: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'magic', name: 'Magic', emoji: '✨' },
  { key: 'might', name: 'Might', emoji: '💪' },
  { key: 'mind', name: 'Mind', emoji: '👁️' },
  { key: 'motion', name: 'Motion', emoji: '🏃' },
  { key: 'moxie', name: 'Moxie', emoji: '🫀' },
];

export interface MilestoneTier {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  ceiling: Record<DieRating, number>;
  description: string;
}

export const MILESTONE_TIERS: MilestoneTier[] = [
  {
    id: 'lvl1',
    name: 'Level 1 (Starting)',
    minLevel: 1,
    maxLevel: 1,
    ceiling: { d4: 2, d6: 2, d8: 1, d10: 0, d12: 0, Exhausted: 0 },
    description: '2x d4, 2x d6, 1x d8',
  },
  {
    id: 'lvl1_9',
    name: 'Level 1–9 Max',
    minLevel: 1,
    maxLevel: 9,
    ceiling: { d4: 1, d6: 2, d8: 2, d10: 0, d12: 0, Exhausted: 0 },
    description: '1x d4, 2x d6, 2x d8',
  },
  {
    id: 'lvl10',
    name: 'Level 10 Tier',
    minLevel: 10,
    maxLevel: 24,
    ceiling: { d4: 1, d6: 1, d8: 3, d10: 0, d12: 0, Exhausted: 0 },
    description: '1x d4, 1x d6, 3x d8',
  },
  {
    id: 'lvl25',
    name: 'Level 25 Tier',
    minLevel: 25,
    maxLevel: 49,
    ceiling: { d4: 0, d6: 2, d8: 1, d10: 2, d12: 0, Exhausted: 0 },
    description: '2x d6, 1x d8, 2x d10',
  },
  {
    id: 'lvl50',
    name: 'Level 50 Tier',
    minLevel: 50,
    maxLevel: 74,
    ceiling: { d4: 0, d6: 1, d8: 2, d10: 2, d12: 0, Exhausted: 0 },
    description: '1x d6, 2x d8, 2x d10',
  },
  {
    id: 'lvl75',
    name: 'Level 75 Tier',
    minLevel: 75,
    maxLevel: 99,
    ceiling: { d4: 0, d6: 1, d8: 1, d10: 2, d12: 1, Exhausted: 0 },
    description: '1x d6, 1x d8, 2x d10, 1x d12',
  },
  {
    id: 'lvl100',
    name: 'Level 100 Tier (Hard Cap)',
    minLevel: 100,
    maxLevel: 999,
    ceiling: { d4: 0, d6: 1, d8: 1, d10: 1, d12: 2, Exhausted: 0 },
    description: '1x d6, 1x d8, 1x d10, 2x d12 (Hard cap)',
  },
];

const DIE_UPGRADE_COSTS: Record<string, { next: DieRating; cost: number }> = {
  d4: { next: 'd6', cost: 2 },
  d6: { next: 'd8', cost: 4 },
  d8: { next: 'd10', cost: 6 },
  d10: { next: 'd12', cost: 8 },
};

const dieToNum = (die?: string): string => {
  if (!die) return 'd4';
  const clean = die.toString().trim().toLowerCase();
  return clean.startsWith('d') ? clean : `d${clean}`;
};

const dieOrderValue = (die: DieRating): number => {
  switch (die) {
    case 'd4': return 4;
    case 'd6': return 6;
    case 'd8': return 8;
    case 'd10': return 10;
    case 'd12': return 12;
    default: return 0;
  }
};

const getActiveMilestoneTier = (level: number): MilestoneTier => {
  if (level >= 100) return MILESTONE_TIERS[6];
  if (level >= 75) return MILESTONE_TIERS[5];
  if (level >= 50) return MILESTONE_TIERS[4];
  if (level >= 25) return MILESTONE_TIERS[3];
  if (level >= 10) return MILESTONE_TIERS[2];
  if (level > 1) return MILESTONE_TIERS[1];
  return MILESTONE_TIERS[0];
};

export const AttributeManagerModal: React.FC<AttributeManagerModalProps> = ({ isOpen, onClose }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } =
    useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Character Sheet Data
  const sheetData: any = activeCharacter?.sheet_data || {};
  const level = sheetData.level || 1;

  const availableAp = calculateAvailableAp(level, sheetData);

  // Baseline Saved Assignments
  const savedAttributeDice: Record<AttributeKey, DieRating> = useMemo(() => {
    const defaultDice: Record<AttributeKey, DieRating> = {
      might: 'd4',
      motion: 'd4',
      mind: 'd8',
      magic: 'd6',
      moxie: 'd6',
    };
    if (!sheetData.attribute_dice) return defaultDice;
    return {
      might: dieToNum(sheetData.attribute_dice.might) as DieRating,
      motion: dieToNum(sheetData.attribute_dice.motion) as DieRating,
      mind: dieToNum(sheetData.attribute_dice.mind) as DieRating,
      magic: dieToNum(sheetData.attribute_dice.magic) as DieRating,
      moxie: dieToNum(sheetData.attribute_dice.moxie) as DieRating,
    };
  }, [sheetData.attribute_dice]);

  // Local Draft Assignments state for drag/swap re-allocation
  const [draftAssignments, setDraftAssignments] = useState<Record<AttributeKey, DieRating>>(savedAttributeDice);

  // Sync draft assignments whenever saved assignments change
  useEffect(() => {
    setDraftAssignments(savedAttributeDice);
  }, [savedAttributeDice]);

  // Click Outside Listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (!isOpen || !activeCharacter) return null;

  const activeMilestone = getActiveMilestoneTier(level);

  // Derived current pool from draft assignments (sorted by die tier)
  const currentPoolList: DieRating[] = Object.values(draftAssignments).sort(
    (a, b) => dieOrderValue(a) - dieOrderValue(b)
  );

  // Count occurrences of each die in the current pool
  const currentPoolCounts: Record<DieRating, number> = {
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    Exhausted: 0,
  };
  currentPoolList.forEach((d) => {
    if (currentPoolCounts[d] !== undefined) {
      currentPoolCounts[d]++;
    }
  });

  // Check if draft assignments differ from saved baseline
  const isAssignmentChanged = ATTRIBUTES.some(
    (attr) => draftAssignments[attr.key] !== savedAttributeDice[attr.key]
  );

  // Handler to swap die assignment between attributes (guaranteeing exact pool match)
  const handleAssignDie = (targetAttr: AttributeKey, newDie: DieRating) => {
    const currentDieOfTarget = draftAssignments[targetAttr];
    if (currentDieOfTarget === newDie) return;

    // Find another attribute that currently holds `newDie` to swap with
    const swapAttrKey = (Object.keys(draftAssignments) as AttributeKey[]).find(
      (key) => key !== targetAttr && draftAssignments[key] === newDie
    );

    if (swapAttrKey) {
      setDraftAssignments((prev) => ({
        ...prev,
        [targetAttr]: newDie,
        [swapAttrKey]: currentDieOfTarget,
      }));
    }
  };

  // Execute 1 AP Attribute Reshuffle
  const handleApplyReshuffle = () => {
    if (!isAssignmentChanged) {
      showToast('No assignment changes to apply.');
      return;
    }

    if (availableAp < 1) {
      showToast('Insufficient AP! Required: 1 AP for Attribute Reshuffle.');
      return;
    }

    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: draftAssignments,
    }));

    recordApExpenditure(
      1,
      'Attributes',
      `Downtime Attribute Reshuffle (${Object.entries(draftAssignments)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')})`,
      1,
      'Attribute Manager'
    );

    saveActiveCharacter();
    showToast('Attribute Reshuffle applied! (1 AP deducted)');
  };

  // Reset Draft Assignments back to saved baseline
  const handleResetDraft = () => {
    setDraftAssignments(savedAttributeDice);
  };

  // Ceiling Validation for Pool Upgrade
  const canUpgradeDieInPool = (currentDie: DieRating): { allowed: boolean; reason?: string } => {
    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    if (!upgradeInfo) {
      return { allowed: false, reason: 'Already at Max Die Rating (d12)' };
    }

    if (availableAp < upgradeInfo.cost) {
      return { allowed: false, reason: `Requires ${upgradeInfo.cost} AP (Available: ${availableAp} AP)` };
    }

    // Simulate upgrading one instance of `currentDie` to `upgradeInfo.next`
    const nextDie = upgradeInfo.next;
    const simulatedCounts = { ...currentPoolCounts };
    simulatedCounts[currentDie]--;
    simulatedCounts[nextDie]++;

    // Validate simulatedCounts against active milestone ceiling
    const targetCeiling = level === 1 ? MILESTONE_TIERS[1].ceiling : activeMilestone.ceiling;

    const diceRatings: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];
    for (const d of diceRatings) {
      if (simulatedCounts[d] > (targetCeiling[d] || 0)) {
        return {
          allowed: false,
          reason: `Exceeds max allowed ${d} for Level ${level} (Ceiling Max: ${targetCeiling[d] || 0}x ${d})`,
        };
      }
    }

    return { allowed: true };
  };

  // Upgrade a die in the pool & attribute assignment
  const handleUpgradeDieInPool = (attrKey: AttributeKey) => {
    const currentDie = draftAssignments[attrKey];
    const validation = canUpgradeDieInPool(currentDie);

    if (!validation.allowed) {
      showToast(validation.reason || 'Upgrade not permitted.');
      return;
    }

    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    const nextDie = upgradeInfo.next;

    const newAssignments = {
      ...draftAssignments,
      [attrKey]: nextDie,
    };

    setDraftAssignments(newAssignments);

    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: newAssignments,
    }));

    recordApExpenditure(
      upgradeInfo.cost,
      'Attributes',
      `Die Pool Upgrade: ${attrKey.toUpperCase()} ${currentDie} ➔ ${nextDie}`,
      2,
      'Attribute Manager'
    );

    saveActiveCharacter();
    showToast(`Upgraded ${attrKey.toUpperCase()} to ${nextDie}! (${upgradeInfo.cost} AP spent)`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-indigo-900 border border-indigo-400 text-indigo-100 shadow-2xl font-medium text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          {toastMessage}
        </div>
      )}

      {/* Main Modal Shell (Master 2-Column Split-Pane) */}
      <div
        ref={modalRef}
        className="w-full max-w-6xl h-[88vh] bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/80 flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header Bar (Standard Blueprint Header) */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-outfit font-black text-xl text-amber-400 tracking-wide flex items-center gap-2">
                ✨ Attribute Manager
              </h2>
              <p className="text-xs text-slate-400">
                Configure attribute die assignments, upgrade die pools, and track milestone ceilings for{' '}
                <strong className="text-indigo-300">{activeCharacter.name || 'Hero'}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 bg-purple-950/80 border border-purple-500/40 rounded-full font-mono text-xs font-bold text-slate-200 shadow-md">
              Available <strong className="text-emerald-400 font-bold">{availableAp} AP</strong>
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Close Manager"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Column Split Body (Blueprint Section 2) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* ========================================================================= */}
          {/* LEFT PANE (md:col-span-6): DIE POOL ASSIGNMENT & RESHUFFLE                */}
          {/* ========================================================================= */}
          <div className="md:col-span-6 flex flex-col p-5 bg-slate-900/60 overflow-y-auto max-h-full">
            {/* Active Unlocked Die Pool Header Card */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 mb-4 shadow-lg shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-outfit font-black text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Unlocked Die Pool (5 Dice)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Level <strong className="text-amber-300">{level}</strong> Pool
                </span>
              </div>

              {/* Pool Dice Visual Badges */}
              <div className="flex items-center gap-2 flex-wrap bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                {currentPoolList.map((die, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 font-mono font-black text-xs rounded-lg shadow-sm"
                  >
                    {die}
                  </span>
                ))}
              </div>
            </div>

            {/* Section Title & Guardrail Note */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                Attribute Die Assignments (Guardrailed)
              </span>
              <span className="text-[11px] text-amber-300 font-semibold">Reshuffle: 1 AP</span>
            </div>

            {/* 5 Attribute Cards with Swap Dropdowns */}
            <div className="space-y-2.5 flex-1 min-h-0">
              {ATTRIBUTES.map((attr) => {
                const assignedDie = draftAssignments[attr.key];
                const savedDie = savedAttributeDice[attr.key];
                const isModified = assignedDie !== savedDie;
                const upgradeValidation = canUpgradeDieInPool(assignedDie);

                return (
                  <div
                    key={attr.key}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isModified
                        ? 'bg-purple-950/40 border-purple-500/60 shadow-md shadow-purple-950/40'
                        : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{attr.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-outfit font-black text-sm uppercase text-slate-100 tracking-wider">
                            {attr.name}
                          </span>
                          {isModified && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Modified
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Assigned: <strong className="text-indigo-300 font-mono">{assignedDie}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Upgrade Step-Up Button */}
                      {upgradeValidation.allowed ? (
                        <button
                          onClick={() => handleUpgradeDieInPool(attr.key)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-outfit font-bold text-white transition-all shadow-md text-xs flex items-center gap-1 cursor-pointer"
                          title={`Upgrade ${attr.name} (${DIE_UPGRADE_COSTS[assignedDie]?.cost} AP)`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{DIE_UPGRADE_COSTS[assignedDie]?.cost} AP
                        </button>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-lg bg-slate-900 text-slate-500 font-mono text-[10px] border border-slate-800"
                          title={upgradeValidation.reason}
                        >
                          {assignedDie === 'd12' ? 'Max d12' : 'Ceiling Cap'}
                        </span>
                      )}

                      {/* Swap Dropdown enforcing Pool Permutations */}
                      <select
                        value={assignedDie}
                        onChange={(e) => handleAssignDie(attr.key, e.target.value as DieRating)}
                        className="bg-slate-900 text-amber-300 font-mono font-extrabold text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/40 outline-none cursor-pointer focus:border-amber-400"
                        title="Swap assigned die with another attribute in your pool"
                      >
                        {Array.from(new Set(currentPoolList)).map((die) => (
                          <option key={die} value={die} className="bg-slate-900 text-slate-100">
                            {die}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions Bar for Left Pane */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={handleResetDraft}
                disabled={!isAssignmentChanged}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition-all disabled:opacity-40"
              >
                Reset Assignment
              </button>

              <button
                onClick={handleApplyReshuffle}
                disabled={!isAssignmentChanged || availableAp < 1}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-outfit font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Apply Reshuffle (1 AP)
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANE (md:col-span-6): MILESTONE MATRIX & AP UPGRADE CENTER         */}
          {/* ========================================================================= */}
          <div className="md:col-span-6 flex flex-col p-5 bg-slate-900/90 overflow-y-auto max-h-full">
            {/* Header / Context */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Level Milestone Die Pool Ceilings
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Current Level: <strong className="text-amber-300">{level}</strong>
              </span>
            </div>

            {/* Milestone Matrix Table */}
            <div className="space-y-2 mb-5">
              {MILESTONE_TIERS.map((tier) => {
                const isActive = activeMilestone.id === tier.id;

                return (
                  <div
                    key={tier.id}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between text-xs ${
                      isActive
                        ? 'bg-amber-950/40 border-amber-400 shadow-md shadow-amber-950/50 ring-1 ring-amber-400/40'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-800 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-outfit font-bold ${
                              isActive ? 'text-amber-300 text-sm' : 'text-slate-300'
                            }`}
                          >
                            {tier.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider">
                              ACTIVE TIER
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">{tier.description}</p>
                      </div>
                    </div>

                    <div className="text-right font-mono text-[11px] font-bold">
                      {isActive ? (
                        <span className="text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                          Active Ceiling
                        </span>
                      ) : (
                        <span className="text-slate-500">Tier Ceiling</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Die Pool AP Upgrade Reference & Rules Card */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 mt-auto shrink-0">
              <h4 className="font-outfit font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-purple-400" />
                Die Pool Upgrade AP Costs
              </h4>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-slate-300 font-bold">d4 ➔ d6</span>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 rounded font-extrabold border border-purple-500/30">
                    2 AP
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-slate-300 font-bold">d6 ➔ d8</span>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 rounded font-extrabold border border-purple-500/30">
                    4 AP
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-slate-300 font-bold">d8 ➔ d10</span>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 rounded font-extrabold border border-purple-500/30">
                    6 AP
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-slate-300 font-bold">d10 ➔ d12</span>
                  <span className="px-2 py-0.5 bg-purple-950 text-purple-300 rounded font-extrabold border border-purple-500/30">
                    8 AP
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                💡 <strong className="text-slate-300">Guardrail Rule:</strong> Die upgrades improve an existing die in your pool up to the max allowed die pool ceiling for your character level. Upgrading dice automatically updates your assigned attributes.
              </div>
            </div>
          </div>
        </div>

        {/* Footer Context Bar & Mandatory Standardized `Done` Button (Blueprint Section 4) */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Hero: <strong className="text-indigo-300">{activeCharacter.name}</strong>
            </span>
            <span className="text-slate-700 font-bold">|</span>
            <span>
              Level: <strong className="text-amber-300">{level}</strong>
            </span>
            <span className="text-slate-700 font-bold">|</span>
            <span>
              Available AP: <strong className="text-emerald-400 font-mono">{availableAp}</strong>
            </span>
            <span className="text-slate-700 font-bold">|</span>
            <span>
              Pool: <strong className="text-slate-200 font-mono">[{currentPoolList.join(', ')}]</strong>
            </span>
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
