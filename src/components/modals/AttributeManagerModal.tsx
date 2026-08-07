// src/components/modals/AttributeManagerModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  RotateCcw,
  TrendingUp,
  Check,
  Award,
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
    description: '2x 4, 2x 6, 1x 8',
  },
  {
    id: 'lvl1_9',
    name: 'Level 1–9 Max',
    minLevel: 1,
    maxLevel: 9,
    ceiling: { d4: 1, d6: 2, d8: 2, d10: 0, d12: 0, Exhausted: 0 },
    description: '1x 4, 2x 6, 2x 8',
  },
  {
    id: 'lvl10',
    name: 'Level 10 Tier',
    minLevel: 10,
    maxLevel: 24,
    ceiling: { d4: 1, d6: 1, d8: 3, d10: 0, d12: 0, Exhausted: 0 },
    description: '1x 4, 1x 6, 3x 8',
  },
  {
    id: 'lvl25',
    name: 'Level 25 Tier',
    minLevel: 25,
    maxLevel: 49,
    ceiling: { d4: 0, d6: 2, d8: 1, d10: 2, d12: 0, Exhausted: 0 },
    description: '2x 6, 1x 8, 2x 10',
  },
  {
    id: 'lvl50',
    name: 'Level 50 Tier',
    minLevel: 50,
    maxLevel: 74,
    ceiling: { d4: 0, d6: 1, d8: 2, d10: 2, d12: 0, Exhausted: 0 },
    description: '1x 6, 2x 8, 2x 10',
  },
  {
    id: 'lvl75',
    name: 'Level 75 Tier',
    minLevel: 75,
    maxLevel: 99,
    ceiling: { d4: 0, d6: 1, d8: 1, d10: 2, d12: 1, Exhausted: 0 },
    description: '1x 6, 1x 8, 2x 10, 1x 12',
  },
  {
    id: 'lvl100',
    name: 'Level 100 Tier (Hard Cap)',
    minLevel: 100,
    maxLevel: 999,
    ceiling: { d4: 0, d6: 1, d8: 1, d10: 1, d12: 2, Exhausted: 0 },
    description: '1x 6, 1x 8, 1x 10, 2x 12 (Hard cap)',
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

const formatDieNum = (die?: string): string => {
  if (!die) return '4';
  const clean = die.toString().trim().toLowerCase();
  return clean.replace(/^d/, '');
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

  // State for "Increase Die" Confirmation Popover
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    attrKey: AttributeKey;
    attrName: string;
    currentDie: DieRating;
    nextDie: DieRating;
    cost: number;
  } | null>(null);

  // Character Sheet Data
  const sheetData: any = activeCharacter?.sheet_data || {};
  const level = sheetData.level || 1;

  const availableAp = calculateAvailableAp(level, sheetData);

  // Baseline Saved Assignments
  const savedAttributeDice: Record<AttributeKey, DieRating> = useMemo(() => {
    const defaultDice: Record<AttributeKey, DieRating> = {
      might: 'd6',
      motion: 'd6',
      mind: 'd8',
      magic: 'd4',
      moxie: 'd4',
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
  const activeMilestone = getActiveMilestoneTier(level);

  // Calculate Max Die Pool ceiling list for character's current level milestone
  const maxPoolCeilingList: DieRating[] = useMemo(() => {
    const list: DieRating[] = [];
    const dice: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];
    const targetCeiling = level === 1 ? MILESTONE_TIERS[1].ceiling : activeMilestone.ceiling;
    for (const d of dice) {
      const count = targetCeiling[d] || 0;
      for (let i = 0; i < count; i++) {
        list.push(d);
      }
    }
    return list.sort((a, b) => dieOrderValue(a) - dieOrderValue(b));
  }, [level, activeMilestone]);

  // Smart auto-initialization for default starting character pool
  useEffect(() => {
    if (!sheetData.attribute_dice && activeCharacter && isOpen) {
      const defaultStartingAssignments: Record<AttributeKey, DieRating> = {
        might: 'd6',
        motion: 'd6',
        mind: 'd8',
        magic: 'd4',
        moxie: 'd4',
      };
      updateActiveSheetData((prev) => ({
        ...prev,
        attribute_dice: defaultStartingAssignments,
      }));
      saveActiveCharacter();
    }
  }, [activeCharacter, sheetData.attribute_dice, isOpen]);

  // Early return if modal is closed or activeCharacter is missing
  if (!isOpen || !activeCharacter) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Derived current pool from saved assignments (sorted by die tier)
  const currentPoolList: DieRating[] = Object.values(savedAttributeDice).sort(
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

  // Handler to swap die assignment between two attributes immediately
  const handleAssignDie = (attr1Key: AttributeKey, attr2Key: AttributeKey) => {
    if (attr1Key === attr2Key) return;
    const die1 = savedAttributeDice[attr1Key];
    const die2 = savedAttributeDice[attr2Key];
    if (die1 === die2) return;

    const swapCost = level === 1 ? 0 : 1;
    if (swapCost > 0 && availableAp < swapCost) {
      showToast(`Insufficient AP! Swapping requires ${swapCost} AP (Available: ${availableAp} AP).`);
      return;
    }

    const newAssignments = {
      ...savedAttributeDice,
      [attr1Key]: die2,
      [attr2Key]: die1,
    };

    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: newAssignments,
    }));

    if (swapCost > 0) {
      recordApExpenditure(
        swapCost,
        'Attributes',
        `Attribute Swap: ${attr1Key.toUpperCase()} (${formatDieNum(die1)}) ↔ ${attr2Key.toUpperCase()} (${formatDieNum(die2)})`,
        1,
        'Attribute Manager'
      );
    }

    saveActiveCharacter();
    const attr1Name = ATTRIBUTES.find((a) => a.key === attr1Key)?.name || attr1Key;
    const attr2Name = ATTRIBUTES.find((a) => a.key === attr2Key)?.name || attr2Key;
    showToast(`Swapped ${attr1Name} (${formatDieNum(die1)}) ↔ ${attr2Name} (${formatDieNum(die2)})! ${swapCost > 0 ? '(1 AP deducted)' : '(Free)'}`);
  };

  // Determine if upgrading a die from currentDie to nextDie is free (Level 1 starting baseline) or costs AP
  const getUpgradeApCost = (currentDie: DieRating): number => {
    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    if (!upgradeInfo) return 0;

    const nextDie = upgradeInfo.next;

    if (currentDie === 'd4' && nextDie === 'd6') {
      const d6PlusCount = (currentPoolCounts.d6 || 0) + (currentPoolCounts.d8 || 0) + (currentPoolCounts.d10 || 0) + (currentPoolCounts.d12 || 0);
      if (d6PlusCount < 3) return 0; // Free upgrade towards Level 1 baseline [4, 4, 6, 6, 8]
    } else if (currentDie === 'd6' && nextDie === 'd8') {
      const d8PlusCount = (currentPoolCounts.d8 || 0) + (currentPoolCounts.d10 || 0) + (currentPoolCounts.d12 || 0);
      if (d8PlusCount < 1) return 0; // Free upgrade towards Level 1 baseline [4, 4, 6, 6, 8]
    }

    return upgradeInfo.cost;
  };

  // Ceiling Validation for Pool Upgrade (Cumulative High-Tier Limits)
  const canUpgradeDieInPool = (currentDie: DieRating): { allowed: boolean; cost: number; reason?: string } => {
    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    if (!upgradeInfo) {
      return { allowed: false, cost: 0, reason: 'Already at Max Rating (12)' };
    }

    const apCost = getUpgradeApCost(currentDie);
    if (availableAp < apCost) {
      return { allowed: false, cost: apCost, reason: `Requires ${apCost} AP (Available: ${availableAp} AP)` };
    }

    // Simulate upgrading one instance of `currentDie` to `upgradeInfo.next`
    const nextDie = upgradeInfo.next;
    const simulatedCounts = { ...currentPoolCounts };
    simulatedCounts[currentDie]--;
    simulatedCounts[nextDie] = (simulatedCounts[nextDie] || 0) + 1;

    // Validate simulatedCounts against active milestone ceiling
    const targetCeiling = level === 1 ? MILESTONE_TIERS[1].ceiling : activeMilestone.ceiling;

    const d12Count = simulatedCounts.d12 || 0;
    const d10PlusCount = d12Count + (simulatedCounts.d10 || 0);
    const d8PlusCount = d10PlusCount + (simulatedCounts.d8 || 0);
    const d6PlusCount = d8PlusCount + (simulatedCounts.d6 || 0);

    const maxD12 = targetCeiling.d12 || 0;
    const maxD10Plus = maxD12 + (targetCeiling.d10 || 0);
    const maxD8Plus = maxD10Plus + (targetCeiling.d8 || 0);
    const maxD6Plus = maxD8Plus + (targetCeiling.d6 || 0);

    if (d12Count > maxD12) {
      return { allowed: false, cost: apCost, reason: `Exceeds max 12 for Level ${level} (Ceiling Max: ${maxD12}x 12)` };
    }
    if (d10PlusCount > maxD10Plus) {
      return { allowed: false, cost: apCost, reason: `Exceeds max 10+ for Level ${level} (Ceiling Max: ${maxD10Plus}x 10+)` };
    }
    if (d8PlusCount > maxD8Plus) {
      return { allowed: false, cost: apCost, reason: `Exceeds max 8+ for Level ${level} (Ceiling Max: ${maxD8Plus}x 8+)` };
    }
    if (d6PlusCount > maxD6Plus) {
      return { allowed: false, cost: apCost, reason: `Exceeds max 6+ for Level ${level} (Ceiling Max: ${maxD6Plus}x 6+)` };
    }

    return { allowed: true, cost: apCost };
  };

  // Open "Increase Die" Confirmation Popover
  const handleOpenUpgradeConfirmation = (attrKey: AttributeKey, attrName: string) => {
    const currentDie = savedAttributeDice[attrKey];
    const validation = canUpgradeDieInPool(currentDie);

    if (!validation.allowed) {
      showToast(validation.reason || 'Upgrade not permitted.');
      return;
    }

    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    setPendingUpgrade({
      attrKey,
      attrName,
      currentDie,
      nextDie: upgradeInfo.next,
      cost: validation.cost,
    });
  };

  // Execute Confirmed Die Increase
  const handleConfirmUpgrade = () => {
    if (!pendingUpgrade) return;
    const { attrKey, attrName, currentDie, nextDie, cost } = pendingUpgrade;

    const newAssignments = {
      ...savedAttributeDice,
      [attrKey]: nextDie,
    };

    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: newAssignments,
    }));

    if (cost > 0) {
      recordApExpenditure(
        cost,
        'Attributes',
        `Die Increase: ${attrKey.toUpperCase()} ${formatDieNum(currentDie)} ➔ ${formatDieNum(nextDie)}`,
        2,
        'Attribute Manager'
      );
    }

    saveActiveCharacter();
    setPendingUpgrade(null);
    showToast(`Increased ${attrName} from ${formatDieNum(currentDie)} to ${formatDieNum(nextDie)}! (${cost > 0 ? `${cost} AP spent` : 'Free Starting Upgrade'})`);
  };

  const handleCloseModal = () => {
    setPendingUpgrade(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn cursor-pointer"
      onClick={handleCloseModal}
    >
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
        className="relative w-full max-w-6xl h-[88vh] bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/80 flex flex-col overflow-hidden text-slate-100 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* "Increase Die" Confirmation Popover Modal (Scoped inside modal shell) */}
        {pendingUpgrade && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-slate-900 border border-indigo-500/50 rounded-2xl p-6 shadow-2xl shadow-indigo-950 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-outfit font-black text-lg text-slate-100 uppercase tracking-wide">
                    Confirm Die Increase
                  </h3>
                  <p className="text-xs text-slate-400">Attribute Upgrade Confirmation</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <p>
                  Upgrading <strong className="text-indigo-300 font-bold">{pendingUpgrade.attrName}</strong> from{' '}
                  <span className="font-mono font-bold text-amber-400">{formatDieNum(pendingUpgrade.currentDie)}</span> to{' '}
                  <span className="font-mono font-bold text-emerald-400">{formatDieNum(pendingUpgrade.nextDie)}</span> will cost{' '}
                  <strong className="text-emerald-400 font-mono">
                    {pendingUpgrade.cost > 0 ? `${pendingUpgrade.cost} AP` : '0 AP (Free Baseline)'}
                  </strong>
                  .
                </p>
                {pendingUpgrade.cost > 0 && (
                  <p className="text-[11px] text-slate-400 italic">
                    Remaining AP after increase: {availableAp - pendingUpgrade.cost} AP.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingUpgrade(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmUpgrade();
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-outfit font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  OK / Confirm Increase
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Bar */}
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
                <strong className="text-indigo-300">{activeCharacter?.name || 'Hero'}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 bg-purple-950/80 border border-purple-500/40 rounded-full font-mono text-xs font-bold text-slate-200 shadow-md">
              Available <strong className="text-emerald-400 font-bold">{availableAp} AP</strong>
            </span>
            <button
              onClick={handleCloseModal}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
              title="Close Manager"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Column Split Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* ========================================================================= */}
          {/* LEFT PANE (md:col-span-6): DIE POOL ASSIGNMENT                            */}
          {/* ========================================================================= */}
          <div className="md:col-span-6 flex flex-col p-5 bg-slate-900/60 overflow-y-auto max-h-full">
            {/* Max Die Pool Header Card */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 mb-4 shadow-lg shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-outfit font-black text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Max Die Pool at Level {level}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeMilestone.name}
                </span>
              </div>

              {/* Pool Dice Visual Badges (Max Milestone Ceiling Dice) */}
              <div className="flex items-center gap-2 flex-wrap bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                {maxPoolCeilingList.map((die, idx) => (
                  <span
                    key={idx}
                    className="px-3.5 py-1 bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 font-mono font-black text-sm rounded-lg shadow-sm"
                  >
                    {formatDieNum(die)}
                  </span>
                ))}
              </div>
            </div>

            {/* Section Title & Guardrail Note */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                Attribute Die Assignments
              </span>
              <span className="text-[11px] text-amber-300 font-semibold">
                Swap: {level === 1 ? 'Free (Level 1)' : '1 AP'}
              </span>
            </div>

            {/* 5 Attribute Cards with Swap Dropdowns */}
            <div className="space-y-2.5 flex-1 min-h-0">
              {ATTRIBUTES.map((attr) => {
                const assignedDie = savedAttributeDice[attr.key];
                const upgradeValidation = canUpgradeDieInPool(assignedDie);

                return (
                  <div
                    key={attr.key}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{attr.emoji}</span>
                      <div>
                        <span className="font-outfit font-black text-sm uppercase text-slate-100 tracking-wider">
                          {attr.name}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          Assigned: <strong className="text-amber-300 font-mono font-bold text-sm">{formatDieNum(assignedDie)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Increase Die Button */}
                      {upgradeValidation.allowed ? (
                        <button
                          onClick={() => handleOpenUpgradeConfirmation(attr.key, attr.name)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-outfit font-bold text-white transition-all shadow-md text-xs flex items-center gap-1 cursor-pointer"
                          title={`Increase ${attr.name} (${upgradeValidation.cost > 0 ? `${upgradeValidation.cost} AP` : 'Free Baseline Upgrade'})`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          Increase Die
                        </button>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-lg bg-slate-900 text-slate-500 font-mono text-[10px] border border-slate-800"
                          title={upgradeValidation.reason}
                        >
                          {assignedDie === 'd12' ? 'Max 12' : 'Ceiling Cap'}
                        </span>
                      )}

                      {/* Swap Dropdown: Attribute AND its assigned Die */}
                      <select
                        value={attr.key}
                        onChange={(e) => handleAssignDie(attr.key, e.target.value as AttributeKey)}
                        className="bg-slate-900 text-amber-300 font-mono font-extrabold text-xs px-2.5 py-1.5 rounded-lg border border-indigo-500/40 outline-none cursor-pointer focus:border-amber-400 max-w-[140px] truncate"
                        title={`Swap ${attr.name} die with another attribute`}
                      >
                        <option value={attr.key} disabled>
                          Swap ↕
                        </option>
                        {ATTRIBUTES.filter((other) => other.key !== attr.key).map((other) => {
                          const otherDie = savedAttributeDice[other.key];
                          return (
                            <option key={other.key} value={other.key} className="bg-slate-900 text-slate-100">
                              Swap w/ {other.name} ({formatDieNum(otherDie)})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANE (md:col-span-6): MILESTONE MATRIX                              */}
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
          </div>
        </div>

        {/* Footer Context Bar & Mandatory Standardized `Done` Button */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Hero: <strong className="text-indigo-300">{activeCharacter?.name || 'Hero'}</strong>
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
              Pool: <strong className="text-slate-200 font-mono">[{currentPoolList.map((d) => formatDieNum(d)).join(', ')}]</strong>
            </span>
          </div>

          <button
            onClick={handleCloseModal}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
