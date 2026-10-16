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
  GripVertical,
  ArrowLeftRight,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  AttributeKey,
  DieRating,
  calculateAvailableAp,
  DEFAULT_UNASSIGNED_ATTRIBUTES,
  isStartingAttributesUnassigned,
  isValidStartingAttributeAssignment,
} from '../../types/game';
import { reconcileEquipmentOnAttributesChanged } from '../../utils/pathReconciliationUtils';

interface AttributeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  emoji: string;
  domains: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'magic', name: 'Magic', emoji: '✨', domains: 'Powers, Spellcraft & Supernatural' },
  { key: 'might', name: 'Might', emoji: '💪', domains: 'Melee Atk/Dmg, Armor & Block' },
  { key: 'mind', name: 'Mind', emoji: '👁️', domains: 'Shot Atk/Dmg, Tech & Perception' },
  { key: 'motion', name: 'Motion', emoji: '🏃', domains: 'Nish, Dodge, Stealth & Hurled' },
  { key: 'moxie', name: 'Moxie', emoji: '🫀', domains: 'Vitality, Stamina & Death Checks' },
];

interface StartingToken {
  id: string;
  die: DieRating;
}

const STARTING_TOKENS: StartingToken[] = [
  { id: 'tok-0', die: 'd4' },
  { id: 'tok-1', die: 'd4' },
  { id: 'tok-2', die: 'd6' },
  { id: 'tok-3', die: 'd6' },
  { id: 'tok-4', die: 'd8' },
];

export interface MilestoneTier {
  id: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  ceiling: Record<DieRating, number>;
  diceList: DieRating[];
  description: string;
}

export const MILESTONE_TIERS: MilestoneTier[] = [
  {
    id: 'lvl1',
    name: 'Level 1 (Starting)',
    minLevel: 1,
    maxLevel: 1,
    ceiling: { d4: 2, d6: 2, d8: 1, d10: 0, d12: 0, Exhausted: 0 },
    diceList: ['d4', 'd4', 'd6', 'd6', 'd8'],
    description: '4, 4, 6, 6, 8',
  },
  {
    id: 'lvl2',
    name: 'Level 2–9 Tier',
    minLevel: 2,
    maxLevel: 9,
    ceiling: { d4: 1, d6: 2, d8: 2, d10: 0, d12: 0, Exhausted: 0 },
    diceList: ['d4', 'd6', 'd6', 'd8', 'd8'],
    description: '4, 6, 6, 8, 8',
  },
  {
    id: 'lvl10',
    name: 'Level 10–24 Tier',
    minLevel: 10,
    maxLevel: 24,
    ceiling: { d4: 1, d6: 1, d8: 3, d10: 0, d12: 0, Exhausted: 0 },
    diceList: ['d4', 'd6', 'd8', 'd8', 'd8'],
    description: '4, 6, 8, 8, 8',
  },
  {
    id: 'lvl25',
    name: 'Level 25–49 Tier',
    minLevel: 25,
    maxLevel: 49,
    ceiling: { d4: 0, d6: 2, d8: 3, d10: 0, d12: 0, Exhausted: 0 },
    diceList: ['d6', 'd6', 'd8', 'd8', 'd8'],
    description: '6, 6, 8, 8, 8',
  },
  {
    id: 'lvl50',
    name: 'Level 50–74 Tier',
    minLevel: 50,
    maxLevel: 74,
    ceiling: { d4: 0, d6: 2, d8: 1, d10: 2, d12: 0, Exhausted: 0 },
    diceList: ['d6', 'd6', 'd8', 'd10', 'd10'],
    description: '6, 6, 8, 10, 10',
  },
  {
    id: 'lvl75',
    name: 'Level 75–99 Tier',
    minLevel: 75,
    maxLevel: 99,
    ceiling: { d4: 0, d6: 2, d8: 1, d10: 1, d12: 1, Exhausted: 0 },
    diceList: ['d6', 'd6', 'd8', 'd10', 'd12'],
    description: '6, 6, 8, 10, 12',
  },
  {
    id: 'lvl100',
    name: 'Level 100+ Tier (Hard Cap)',
    minLevel: 100,
    maxLevel: 999,
    ceiling: { d4: 0, d6: 1, d8: 1, d10: 1, d12: 2, Exhausted: 0 },
    diceList: ['d6', 'd8', 'd10', 'd12', 'd12'],
    description: '6, 8, 10, 12, 12 (Hard cap: Max 2 × 12)',
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

const getDieBadgeClasses = (die: DieRating, isHighlight = false): string => {
  switch (die) {
    case 'd4':
      return isHighlight
        ? 'bg-cyan-900 border-cyan-400 text-cyan-200'
        : 'bg-slate-900 border-cyan-500/40 text-cyan-300';
    case 'd6':
      return isHighlight
        ? 'bg-indigo-900 border-indigo-400 text-indigo-100'
        : 'bg-indigo-950/80 border-indigo-500/50 text-indigo-200';
    case 'd8':
      return isHighlight
        ? 'bg-amber-900 border-amber-400 text-amber-100'
        : 'bg-amber-950/80 border-amber-500/50 text-amber-300';
    case 'd10':
      return isHighlight
        ? 'bg-purple-900 border-purple-400 text-purple-100'
        : 'bg-purple-950/80 border-purple-500/50 text-purple-200';
    case 'd12':
      return isHighlight
        ? 'bg-emerald-900 border-emerald-400 text-emerald-100'
        : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300';
    default:
      return 'bg-slate-900 border-slate-700 text-slate-400';
  }
};

const getActiveMilestoneTier = (level: number): MilestoneTier => {
  if (level >= 100) return MILESTONE_TIERS[6];
  if (level >= 75) return MILESTONE_TIERS[5];
  if (level >= 50) return MILESTONE_TIERS[4];
  if (level >= 25) return MILESTONE_TIERS[3];
  if (level >= 10) return MILESTONE_TIERS[2];
  if (level >= 2) return MILESTONE_TIERS[1];
  return MILESTONE_TIERS[0];
};

const checkPoolFitsCeiling = (
  counts: Record<DieRating, number>,
  ceiling: Record<DieRating, number>
): { fits: boolean; reason?: string } => {
  const d12Count = counts.d12 || 0;
  const d10PlusCount = d12Count + (counts.d10 || 0);
  const d8PlusCount = d10PlusCount + (counts.d8 || 0);
  const d6PlusCount = d8PlusCount + (counts.d6 || 0);

  const maxD12 = ceiling.d12 || 0;
  const maxD10Plus = maxD12 + (ceiling.d10 || 0);
  const maxD8Plus = maxD10Plus + (ceiling.d8 || 0);
  const maxD6Plus = maxD8Plus + (ceiling.d6 || 0);

  if (d12Count > maxD12) {
    return { fits: false, reason: `Exceeds max 12s for current tier (Max: ${maxD12}× 12)` };
  }
  if (d10PlusCount > maxD10Plus) {
    return { fits: false, reason: `Exceeds max 10+ ratings for current tier (Max: ${maxD10Plus}× 10+)` };
  }
  if (d8PlusCount > maxD8Plus) {
    return { fits: false, reason: `Exceeds max 8+ ratings for current tier (Max: ${maxD8Plus}× 8+)` };
  }
  if (d6PlusCount > maxD6Plus) {
    return { fits: false, reason: `Exceeds max 6+ ratings for current tier (Max: ${maxD6Plus}× 6+)` };
  }
  return { fits: true };
};

export const AttributeManagerModal: React.FC<AttributeManagerModalProps> = ({ isOpen, onClose }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } =
    useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [incompleteWarning, setIncompleteWarning] = useState<string | null>(null);

  // --- Mode A: Starting Die Assignment State (All-or-Nothing 4, 4, 6, 6, 8) ---
  const [draftTokensByAttr, setDraftTokensByAttr] = useState<Partial<Record<AttributeKey, string>>>({});
  const [selectedTrayTokenId, setSelectedTrayTokenId] = useState<string | null>(null);
  const [draggedTokenPayload, setDraggedTokenPayload] = useState<{
    tokenId: string;
    sourceAttr?: AttributeKey;
  } | null>(null);
  const [dragOverAttr, setDragOverAttr] = useState<AttributeKey | null>(null);
  const [showLockInConfirm, setShowLockInConfirm] = useState(false);

  // --- Mode B: Progression Mode State (Upgrade & 1 AP Swap) ---
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    attrKey: AttributeKey;
    attrName: string;
    currentDie: DieRating;
    nextDie: DieRating;
    cost: number;
  } | null>(null);

  const [pendingSwap, setPendingSwap] = useState<{
    attr1Key: AttributeKey;
    attr1Name: string;
    attr1Emoji: string;
    die1: DieRating;
    attr2Key: AttributeKey;
    attr2Name: string;
    attr2Emoji: string;
    die2: DieRating;
  } | null>(null);

  const [swapSourceAttr, setSwapSourceAttr] = useState<AttributeKey | null>(null);
  const [draggedSwapAttr, setDraggedSwapAttr] = useState<AttributeKey | null>(null);

  // Character Sheet Data
  const sheetData: any = activeCharacter?.sheet_data || {};
  const level = sheetData.level || 1;
  const availableAp = calculateAvailableAp(level, sheetData);

  // Baseline Saved Assignments (Defaults to all 'd4' until starting assignment is locked in)
  const savedAttributeDice: Record<AttributeKey, DieRating> = useMemo(() => {
    if (!sheetData.attribute_dice) return { ...DEFAULT_UNASSIGNED_ATTRIBUTES };
    return {
      might: dieToNum(sheetData.attribute_dice.might) as DieRating,
      motion: dieToNum(sheetData.attribute_dice.motion) as DieRating,
      mind: dieToNum(sheetData.attribute_dice.mind) as DieRating,
      magic: dieToNum(sheetData.attribute_dice.magic) as DieRating,
      moxie: dieToNum(sheetData.attribute_dice.moxie) as DieRating,
    };
  }, [sheetData.attribute_dice]);

  const isUnassignedMode = useMemo(
    () => isStartingAttributesUnassigned(savedAttributeDice),
    [savedAttributeDice]
  );

  // Reset transient modal states on open or character switch
  useEffect(() => {
    if (isOpen) {
      setDraftTokensByAttr({});
      setSelectedTrayTokenId(null);
      setDraggedTokenPayload(null);
      setDragOverAttr(null);
      setShowLockInConfirm(false);
      setPendingUpgrade(null);
      setPendingSwap(null);
      setSwapSourceAttr(null);
      setDraggedSwapAttr(null);
      setIncompleteWarning(null);
    }
  }, [isOpen, activeCharacter?.id]);

  const activeMilestone = getActiveMilestoneTier(level);

  // Calculate Max Die Pool ceiling list for character's current level milestone
  const maxPoolCeilingList: DieRating[] = useMemo(() => {
    return [...activeMilestone.diceList].sort((a, b) => dieOrderValue(a) - dieOrderValue(b));
  }, [activeMilestone]);

  // Early return if modal is closed or activeCharacter is missing
  if (!isOpen || !activeCharacter) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ============================================================================
  // MODE A HELPERS: STARTING DIE POOL (4, 4, 6, 6, 8) DRAG & DROP
  // ============================================================================
  const usedTokenIds = new Set(Object.values(draftTokensByAttr).filter(Boolean) as string[]);
  const availableTrayTokens = STARTING_TOKENS.filter((t) => !usedTokenIds.has(t.id));
  const placedCount = usedTokenIds.size;

  const getTokenById = (tokenId?: string): StartingToken | undefined =>
    STARTING_TOKENS.find((t) => t.id === tokenId);

  const stagedStartingDiceMap: Partial<Record<AttributeKey, DieRating>> = {};
  for (const attr of ATTRIBUTES) {
    const tok = getTokenById(draftTokensByAttr[attr.key]);
    if (tok) {
      stagedStartingDiceMap[attr.key] = tok.die;
    }
  }

  const isStartingDraftComplete =
    placedCount === 5 && isValidStartingAttributeAssignment(stagedStartingDiceMap);

  const handleAssignTokenToAttribute = (
    targetAttr: AttributeKey,
    tokenId: string,
    sourceAttr?: AttributeKey
  ) => {
    setIncompleteWarning(null);
    setDraftTokensByAttr((prev) => {
      const next = { ...prev };
      const existingTargetToken = next[targetAttr];

      // Remove tokenId from any other attribute that might hold it
      for (const k of Object.keys(next) as AttributeKey[]) {
        if (next[k] === tokenId) {
          delete next[k];
        }
      }

      // If dragged from another attribute and target had a token, swap them
      if (sourceAttr && sourceAttr !== targetAttr && existingTargetToken) {
        next[sourceAttr] = existingTargetToken;
      }

      next[targetAttr] = tokenId;
      return next;
    });
    setSelectedTrayTokenId(null);
  };

  const handleRemoveTokenFromAttribute = (attrKey: AttributeKey) => {
    setIncompleteWarning(null);
    setDraftTokensByAttr((prev) => {
      const next = { ...prev };
      delete next[attrKey];
      return next;
    });
  };

  const handleResetStartingTray = () => {
    setDraftTokensByAttr({});
    setSelectedTrayTokenId(null);
    setIncompleteWarning(null);
    showToast('Starting die tray reset. All attributes remain at default 4.');
  };

  const handleConfirmStartingLockIn = () => {
    if (!isStartingDraftComplete) {
      setIncompleteWarning(
        'All five attributes must be assigned to the exact pool (4, 4, 6, 6, 8). Unassigned attributes revert to all 4s.'
      );
      return;
    }

    const finalAssignments: Record<AttributeKey, DieRating> = {
      magic: stagedStartingDiceMap.magic || 'd4',
      might: stagedStartingDiceMap.might || 'd4',
      mind: stagedStartingDiceMap.mind || 'd4',
      motion: stagedStartingDiceMap.motion || 'd4',
      moxie: stagedStartingDiceMap.moxie || 'd4',
    };

    const reconciliation = reconcileEquipmentOnAttributesChanged(
      sheetData,
      finalAssignments,
      activeCharacter
    );

    updateActiveSheetData(() => reconciliation.updatedSheetData);

    recordApExpenditure(
      0,
      'Attributes',
      `Initial Starting Attributes Assigned (0 AP): ✨${formatDieNum(finalAssignments.magic)} 💪${formatDieNum(finalAssignments.might)} 👁️${formatDieNum(finalAssignments.mind)} 🏃${formatDieNum(finalAssignments.motion)} 🫀${formatDieNum(finalAssignments.moxie)}`,
      'Creation',
      'Attribute Manager'
    );

    if (reconciliation.totalRefund > 0) {
      recordApExpenditure(
        0,
        'Weapons',
        `Requirement Met Auto-Refund: Surcharge Refunded (+${reconciliation.totalRefund} AP: ${reconciliation.refundLogDetails.join(', ')})`,
        1,
        'Attribute Manager'
      );
    }

    saveActiveCharacter();
    setShowLockInConfirm(false);
    setDraftTokensByAttr({});
    showToast('Starting Attributes (4, 4, 6, 6, 8) locked in for 0 AP!');
  };

  // ============================================================================
  // MODE B HELPERS: ACTIVE PROGRESSION (UPGRADE DIE & 1 AP SWAP)
  // ============================================================================
  const sortedAssignedPoolWithOwners = useMemo(() => {
    return ATTRIBUTES.map((attr) => ({
      key: attr.key,
      name: attr.name,
      emoji: attr.emoji,
      die: savedAttributeDice[attr.key],
    })).sort((a, b) => dieOrderValue(a.die) - dieOrderValue(b.die));
  }, [savedAttributeDice]);

  const currentPoolCounts: Record<DieRating, number> = {
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    Exhausted: 0,
  };
  sortedAssignedPoolWithOwners.forEach((item) => {
    if (currentPoolCounts[item.die] !== undefined) {
      currentPoolCounts[item.die]++;
    }
  });

  // Find which milestone level unlocks upgrading `currentDie` to `nextDie`
  const getUnlockLevelForUpgrade = (currentDie: DieRating): number | null => {
    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    if (!upgradeInfo) return null;

    const simulatedCounts = { ...currentPoolCounts };
    simulatedCounts[currentDie]--;
    simulatedCounts[upgradeInfo.next] = (simulatedCounts[upgradeInfo.next] || 0) + 1;

    for (const tier of MILESTONE_TIERS) {
      const check = checkPoolFitsCeiling(simulatedCounts, tier.ceiling);
      if (check.fits) {
        return tier.minLevel;
      }
    }
    return null;
  };

  const canUpgradeDieInPool = (currentDie: DieRating): {
    allowed: boolean;
    cost: number;
    nextDie?: DieRating;
    unlockLevel?: number | null;
    reason?: string;
    isCeilingCap?: boolean;
    isInsufficientAp?: boolean;
  } => {
    const upgradeInfo = DIE_UPGRADE_COSTS[currentDie];
    if (!upgradeInfo) {
      return { allowed: false, cost: 0, reason: 'Already at Max Rating (12)' };
    }

    const apCost = upgradeInfo.cost;
    const nextDie = upgradeInfo.next;

    const simulatedCounts = { ...currentPoolCounts };
    simulatedCounts[currentDie]--;
    simulatedCounts[nextDie] = (simulatedCounts[nextDie] || 0) + 1;

    const fitCheck = checkPoolFitsCeiling(simulatedCounts, activeMilestone.ceiling);
    if (!fitCheck.fits) {
      const unlockLvl = getUnlockLevelForUpgrade(currentDie);
      return {
        allowed: false,
        cost: apCost,
        nextDie,
        unlockLevel: unlockLvl,
        isCeilingCap: true,
        reason: unlockLvl
          ? `Unlocks at Level ${unlockLvl} (${fitCheck.reason})`
          : `Hard Ceiling Cap reached (${fitCheck.reason})`,
      };
    }

    if (availableAp < apCost) {
      return {
        allowed: false,
        cost: apCost,
        nextDie,
        isInsufficientAp: true,
        reason: `Insufficient AP: Requires ${apCost} AP (${availableAp} AP available)`,
      };
    }

    return { allowed: true, cost: apCost, nextDie };
  };

  // Initiate Swap Confirmation (Always 1 AP in Progression Mode)
  const handleRequestSwap = (attr1Key: AttributeKey, attr2Key: AttributeKey) => {
    setSwapSourceAttr(null);
    setDraggedSwapAttr(null);
    setDragOverAttr(null);

    if (attr1Key === attr2Key) return;
    const die1 = savedAttributeDice[attr1Key];
    const die2 = savedAttributeDice[attr2Key];

    const attr1 = ATTRIBUTES.find((a) => a.key === attr1Key)!;
    const attr2 = ATTRIBUTES.find((a) => a.key === attr2Key)!;

    if (die1 === die2) {
      showToast(`${attr1.name} and ${attr2.name} both have rating ${formatDieNum(die1)} — no swap needed.`);
      return;
    }

    if (availableAp < 1) {
      showToast(`Insufficient AP! Swapping two attributes requires 1 AP (Available: ${availableAp} AP).`);
      return;
    }

    setPendingSwap({
      attr1Key,
      attr1Name: attr1.name,
      attr1Emoji: attr1.emoji,
      die1,
      attr2Key,
      attr2Name: attr2.name,
      attr2Emoji: attr2.emoji,
      die2,
    });
  };

  const handleConfirmSwap = () => {
    if (!pendingSwap) return;
    const { attr1Key, attr1Name, die1, attr2Key, attr2Name, die2 } = pendingSwap;

    const newAssignments: Record<AttributeKey, DieRating> = {
      ...savedAttributeDice,
      [attr1Key]: die2,
      [attr2Key]: die1,
    };

    const reconciliation = reconcileEquipmentOnAttributesChanged(
      sheetData,
      newAssignments,
      activeCharacter
    );

    updateActiveSheetData(() => reconciliation.updatedSheetData);

    recordApExpenditure(
      1,
      'Attributes',
      `Attribute Swap: ${attr1Key.toUpperCase()} (${formatDieNum(die1)}) ↔ ${attr2Key.toUpperCase()} (${formatDieNum(die2)})`,
      1,
      'Attribute Manager'
    );

    if (reconciliation.totalRefund > 0) {
      recordApExpenditure(
        0,
        'Weapons',
        `Requirement Met Auto-Refund: Surcharge Refunded (+${reconciliation.totalRefund} AP: ${reconciliation.refundLogDetails.join(', ')})`,
        1,
        'Attribute Manager'
      );
    }

    saveActiveCharacter();
    setPendingSwap(null);

    if (reconciliation.totalRefund > 0) {
      showToast(
        `Swapped ${attr1Name} ↔ ${attr2Name} (1 AP)! • ✨ Requirement Met: +${reconciliation.totalRefund} AP Refunded!`
      );
    } else {
      showToast(
        `Swapped ${attr1Name} (${formatDieNum(die1)}) ↔ ${attr2Name} (${formatDieNum(die2)})! (1 AP deducted)`
      );
    }
  };

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

  const handleConfirmUpgrade = () => {
    if (!pendingUpgrade) return;
    const { attrKey, attrName, currentDie, nextDie, cost } = pendingUpgrade;

    const newAssignments: Record<AttributeKey, DieRating> = {
      ...savedAttributeDice,
      [attrKey]: nextDie,
    };

    const reconciliation = reconcileEquipmentOnAttributesChanged(
      sheetData,
      newAssignments,
      activeCharacter
    );

    updateActiveSheetData(() => reconciliation.updatedSheetData);

    recordApExpenditure(
      cost,
      'Attributes',
      `Die Increase: ${attrKey.toUpperCase()} ${formatDieNum(currentDie)} ➔ ${formatDieNum(nextDie)}`,
      2,
      'Attribute Manager'
    );

    if (reconciliation.totalRefund > 0) {
      recordApExpenditure(
        0,
        'Weapons',
        `Requirement Met Auto-Refund: Surcharge Refunded (+${reconciliation.totalRefund} AP: ${reconciliation.refundLogDetails.join(', ')})`,
        1,
        'Attribute Manager'
      );
    }

    saveActiveCharacter();
    setPendingUpgrade(null);

    if (reconciliation.totalRefund > 0) {
      showToast(
        `Increased ${attrName} to ${formatDieNum(nextDie)} (${cost} AP)! • ✨ Requirement Met: +${reconciliation.totalRefund} AP Refunded!`
      );
    } else {
      showToast(
        `Increased ${attrName} from ${formatDieNum(currentDie)} to ${formatDieNum(nextDie)}! (${cost} AP spent)`
      );
    }
  };

  // Safe Close Handler enforcing the All-or-Nothing Starting Assignment Rule
  const handleCloseModal = () => {
    if (isUnassignedMode && placedCount > 0) {
      setDraftTokensByAttr({});
      setSelectedTrayTokenId(null);
      setShowLockInConfirm(false);
      setIncompleteWarning(
        'Partial assignment reverted to all 4s! All 5 starting dice (4, 4, 6, 6, 8) must be assigned and locked in together. Click Done again to exit with all 4s.'
      );
      showToast('Partial assignment reverted to all 4s — assign all 5 dice (4, 4, 6, 6, 8) to lock in!');
      return;
    }
    setPendingUpgrade(null);
    setPendingSwap(null);
    setShowLockInConfirm(false);
    setSwapSourceAttr(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn cursor-pointer"
      onClick={handleCloseModal}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[60] px-4 py-2.5 rounded-xl bg-indigo-900 border border-indigo-400 text-indigo-100 shadow-2xl font-medium text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Modal Shell (Master 2-Column Split-Pane) */}
      <div
        ref={modalRef}
        className="relative w-full max-w-6xl h-[88vh] bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/80 flex flex-col overflow-hidden text-slate-100 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* POPOVER 1: CONFIRM STARTING ATTRIBUTE LOCK-IN (0 AP)                      */}
        {/* ========================================================================= */}
        {showLockInConfirm && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-slate-900 border border-emerald-500/50 rounded-2xl p-6 shadow-2xl shadow-emerald-950/80 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-outfit font-black text-lg text-slate-100 uppercase tracking-wide">
                    Lock In Starting Attributes
                  </h3>
                  <p className="text-xs text-emerald-400 font-semibold">
                    0 AP Initial Assignment (4, 4, 6, 6, 8)
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="grid grid-cols-5 gap-2 text-center">
                  {ATTRIBUTES.map((attr) => {
                    const die = stagedStartingDiceMap[attr.key] || 'd4';
                    return (
                      <div
                        key={attr.key}
                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-col items-center gap-1"
                      >
                        <span className="text-lg">{attr.emoji}</span>
                        <span className="text-[10px] font-outfit font-bold text-slate-300 uppercase">
                          {attr.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-black text-xs border ${getDieBadgeClasses(
                            die
                          )}`}
                        >
                          {formatDieNum(die)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 pt-1 leading-relaxed">
                  Locking in your initial attributes costs <strong className="text-emerald-400">0 AP</strong>. Once locked in, upgrading dice costs AP (2–8 AP) and swapping two attributes costs <strong className="text-amber-300">1 AP</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setShowLockInConfirm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Back to Edit
                </button>
                <button
                  onClick={handleConfirmStartingLockIn}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-outfit font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Lock In (0 AP)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* POPOVER 2: CONFIRM DIE INCREASE (2–8 AP)                                  */}
        {/* ========================================================================= */}
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
                  <p className="text-xs text-slate-400">Attribute Step-Up Confirmation</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <p>
                  Upgrading <strong className="text-indigo-300 font-bold">{pendingUpgrade.attrName}</strong> from{' '}
                  <span className="font-mono font-bold text-amber-400">{formatDieNum(pendingUpgrade.currentDie)}</span> to{' '}
                  <span className="font-mono font-bold text-emerald-400">{formatDieNum(pendingUpgrade.nextDie)}</span> will cost{' '}
                  <strong className="text-emerald-400 font-mono">{pendingUpgrade.cost} AP</strong>.
                </p>
                <p className="text-[11px] text-slate-400 italic">
                  Remaining AP after increase: {availableAp - pendingUpgrade.cost} AP.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setPendingUpgrade(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUpgrade}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-outfit font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  OK / Confirm ({pendingUpgrade.cost} AP)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* POPOVER 3: CONFIRM ATTRIBUTE SWAP (1 AP)                                  */}
        {/* ========================================================================= */}
        {pendingSwap && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl p-6 shadow-2xl shadow-amber-950/60 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-outfit font-black text-lg text-slate-100 uppercase tracking-wide">
                    Confirm Attribute Swap
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold">Cost: 1 AP</p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-3">
                <div className="flex items-center justify-between gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{pendingSwap.attr1Emoji}</span>
                    <div>
                      <div className="font-outfit font-bold text-slate-100">{pendingSwap.attr1Name}</div>
                      <div className="font-mono text-[11px]">
                        <span className="text-slate-400">{formatDieNum(pendingSwap.die1)}</span>{' '}
                        <span className="text-amber-400">➔</span>{' '}
                        <strong className="text-emerald-400 text-sm">{formatDieNum(pendingSwap.die2)}</strong>
                      </div>
                    </div>
                  </div>

                  <ArrowLeftRight className="w-4 h-4 text-amber-400 shrink-0" />

                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <div className="font-outfit font-bold text-slate-100">{pendingSwap.attr2Name}</div>
                      <div className="font-mono text-[11px]">
                        <span className="text-slate-400">{formatDieNum(pendingSwap.die2)}</span>{' '}
                        <span className="text-amber-400">➔</span>{' '}
                        <strong className="text-emerald-400 text-sm">{formatDieNum(pendingSwap.die1)}</strong>
                      </div>
                    </div>
                    <span className="text-xl">{pendingSwap.attr2Emoji}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  Swapping two Attribute ratings costs <strong className="text-amber-300">1 AP</strong>. Remaining AP after swap: {availableAp - 1} AP.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setPendingSwap(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwap}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-outfit font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Confirm Swap (1 AP)
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
                {isUnassignedMode && (
                  <span className="px-2.5 py-0.5 text-[10px] font-outfit font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/50 rounded-lg">
                    Step 1: Starting Assignment (0 AP)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {isUnassignedMode
                  ? 'Drag or tap all five starting dice (4, 4, 6, 6, 8) onto your Attributes below to unlock progression for '
                  : 'Upgrade attribute dice, drag attributes to swap (1 AP), and track level milestone ceilings for '}
                <strong className="text-indigo-300">{activeCharacter?.name || 'Hero'}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="px-3 py-1 bg-amber-950/60 border border-amber-500/50 rounded-xl font-mono font-black text-xs text-amber-300 shadow-sm flex items-center justify-center shrink-0">
              AP {availableAp}
            </div>
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
          {/* LEFT PANE (md:col-span-6): STARTING ASSIGNMENT OR ACTIVE PROGRESSION       */}
          {/* ========================================================================= */}
          <div className="md:col-span-6 flex flex-col p-5 bg-slate-900/60 overflow-y-auto max-h-full">
            {isUnassignedMode ? (
              /* --------------------------------------------------------------------- */
              /* MODE A: STARTING DIE POOL DRAG & DROP ASSIGNMENT (0 AP)               */
              /* --------------------------------------------------------------------- */
              <>
                {/* Draggable Starting Die Tray */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedTokenPayload?.sourceAttr) {
                      handleRemoveTokenFromAttribute(draggedTokenPayload.sourceAttr);
                    }
                    setDraggedTokenPayload(null);
                    setDragOverAttr(null);
                  }}
                  className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/40 mb-3 shadow-lg shrink-0 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-outfit font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      🎲 Starting Die Pool (4, 4, 6, 6, 8)
                    </span>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      {placedCount}/5 Placed • Cost: 0 AP
                    </span>
                  </div>

                  {/* Token Tray Box */}
                  <div className="min-h-[52px] flex items-center justify-center gap-3 flex-wrap bg-slate-900/90 p-2.5 rounded-xl border border-dashed border-slate-700">
                    {availableTrayTokens.length > 0 ? (
                      availableTrayTokens.map((tok) => {
                        const isSelected = selectedTrayTokenId === tok.id;
                        return (
                          <div
                            key={tok.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedTokenPayload({ tokenId: tok.id });
                              setSelectedTrayTokenId(tok.id);
                            }}
                            onDragEnd={() => {
                              setDraggedTokenPayload(null);
                              setDragOverAttr(null);
                            }}
                            onClick={() =>
                              setSelectedTrayTokenId((prev) => (prev === tok.id ? null : tok.id))
                            }
                            title="Drag onto an Attribute below (or click to select, then click an Attribute)"
                            className={`px-4 py-1.5 rounded-xl font-mono font-black text-base border-2 shadow-md cursor-grab active:cursor-grabbing select-none transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? 'ring-2 ring-amber-400 scale-110 bg-amber-900 border-amber-300 text-white'
                                : `${getDieBadgeClasses(tok.die, true)} hover:scale-105`
                            }`}
                          >
                            <GripVertical className="w-3.5 h-3.5 opacity-60" />
                            <span>{formatDieNum(tok.die)}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-xs font-outfit font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        All 5 starting dice staged! Click &ldquo;Lock In Starting Attributes&rdquo; below.
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">
                    <strong className="text-amber-300">All-or-Nothing Rule:</strong> Drag each die onto an Attribute below (or click a die, then click an Attribute). Until all 5 dice are assigned and locked in, all Attributes remain at default <strong className="text-slate-200 font-mono">4</strong>.
                  </p>
                </div>

                {/* Incomplete / Reverted Warning Banner */}
                {incompleteWarning && (
                  <div className="mb-3 p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs flex items-start gap-2 animate-fadeIn shrink-0">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{incompleteWarning}</span>
                  </div>
                )}

                {/* 5 Droppable Attribute Slots */}
                <div className="space-y-2 flex-1 min-h-0">
                  {ATTRIBUTES.map((attr) => {
                    const assignedTokenId = draftTokensByAttr[attr.key];
                    const assignedToken = getTokenById(assignedTokenId);
                    const isDragTarget = dragOverAttr === attr.key;

                    return (
                      <div
                        key={attr.key}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverAttr !== attr.key) setDragOverAttr(attr.key);
                        }}
                        onDragLeave={() => {
                          if (dragOverAttr === attr.key) setDragOverAttr(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverAttr(null);
                          if (draggedTokenPayload) {
                            handleAssignTokenToAttribute(
                              attr.key,
                              draggedTokenPayload.tokenId,
                              draggedTokenPayload.sourceAttr
                            );
                            setDraggedTokenPayload(null);
                          }
                        }}
                        onClick={() => {
                          if (selectedTrayTokenId) {
                            handleAssignTokenToAttribute(attr.key, selectedTrayTokenId);
                          } else if (!assignedToken && availableTrayTokens.length > 0) {
                            // Quick 1-click convenience: place the first available tray token
                            handleAssignTokenToAttribute(attr.key, availableTrayTokens[0].id);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs cursor-pointer ${
                          isDragTarget
                            ? 'bg-indigo-950/90 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                            : assignedToken
                            ? 'bg-slate-950/90 border-emerald-500/40 hover:border-emerald-400/60'
                            : selectedTrayTokenId
                            ? 'bg-slate-950/80 border-amber-500/40 hover:border-amber-400'
                            : 'bg-slate-950/70 border-slate-800 hover:border-indigo-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0">{attr.emoji}</span>
                          <div className="min-w-0">
                            <span className="font-outfit font-black text-sm uppercase text-slate-100 tracking-wider block">
                              {attr.name}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate block">
                              {attr.domains}
                            </span>
                          </div>
                        </div>

                        {/* Right Zone: Placed Die Token or Empty Drop Zone */}
                        {assignedToken ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.effectAllowed = 'move';
                                setDraggedTokenPayload({
                                  tokenId: assignedToken.id,
                                  sourceAttr: attr.key,
                                });
                              }}
                              onDragEnd={() => {
                                setDraggedTokenPayload(null);
                                setDragOverAttr(null);
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectedTrayTokenId) {
                                  handleAssignTokenToAttribute(attr.key, selectedTrayTokenId);
                                } else {
                                  handleRemoveTokenFromAttribute(attr.key);
                                }
                              }}
                              title="Drag to another Attribute to swap, or click to return to tray"
                              className={`px-3.5 py-1 rounded-xl font-mono font-black text-base border-2 shadow cursor-grab active:cursor-grabbing flex items-center gap-1.5 ${getDieBadgeClasses(
                                assignedToken.die,
                                true
                              )}`}
                            >
                              <GripVertical className="w-3.5 h-3.5 opacity-60" />
                              <span>{formatDieNum(assignedToken.die)}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTokenFromAttribute(attr.key);
                              }}
                              title="Return die to tray"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 text-slate-400 font-mono text-xs flex items-center gap-2 shrink-0">
                            <span>Drop Die</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                              Default: 4
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Bar: Reset Tray & Lock In Starting Attributes */}
                <div className="pt-3 mt-2 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetStartingTray}
                    disabled={placedCount === 0}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-outfit font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Tray
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isStartingDraftComplete) {
                        setIncompleteWarning(
                          `Only ${placedCount}/5 dice placed! You must assign all 5 dice (4, 4, 6, 6, 8) before locking in.`
                        );
                        return;
                      }
                      setShowLockInConfirm(true);
                    }}
                    className={`flex-1 py-2 px-4 rounded-xl font-outfit font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                      isStartingDraftComplete
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 shadow-emerald-950/60'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {isStartingDraftComplete ? (
                      <>
                        <Check className="w-4 h-4" />
                        Lock In Starting Attributes (0 AP)
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Assign All 5 Dice to Lock In ({placedCount}/5)
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* --------------------------------------------------------------------- */
              /* MODE B: ACTIVE PROGRESSION MODE (UPGRADE DIE & 1 AP DRAG/CLICK SWAP)  */
              /* --------------------------------------------------------------------- */
              <>
                {/* Dual Die Pool Header Card (Current Assigned Pool with Emoji Tags vs Max Ceiling) */}
                <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/30 mb-4 shadow-lg shrink-0 space-y-3">
                  {/* Row 1: Current Assigned Die Pool */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-outfit font-black text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-400" />
                        Current Assigned Die Pool
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Sorted Low ➔ High
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      {sortedAssignedPoolWithOwners.map((item) => (
                        <div
                          key={item.key}
                          title={`${item.name}: ${formatDieNum(item.die)}`}
                          className={`py-1 px-2 border font-mono font-black text-xs rounded-lg shadow-sm flex items-center justify-center gap-1 ${getDieBadgeClasses(
                            item.die
                          )}`}
                        >
                          <span className="text-sm">{item.emoji}</span>
                          <span>{formatDieNum(item.die)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Row 2: Max Die Pool at Level */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-outfit font-black text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        Max Die Pool at Level {level}
                      </span>
                      <span className="text-[10px] text-amber-400/80 font-mono font-bold">
                        {activeMilestone.name}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 bg-slate-900 p-2 rounded-lg border border-amber-500/20">
                      {maxPoolCeilingList.map((ceilingDie, idx) => {
                        const currentSlotDie = sortedAssignedPoolWithOwners[idx]?.die || 'd4';
                        const hasHeadroom = dieOrderValue(ceilingDie) > dieOrderValue(currentSlotDie);
                        return (
                          <div
                            key={idx}
                            title={
                              hasHeadroom
                                ? `Slot ${idx + 1} Ceiling: ${formatDieNum(ceilingDie)} (Upgrade available!)`
                                : `Slot ${idx + 1} Ceiling: ${formatDieNum(ceilingDie)}`
                            }
                            className={`py-1 px-2 font-mono font-black text-xs rounded-lg shadow-sm text-center border ${
                              hasHeadroom
                                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                                : 'bg-amber-950/50 border-amber-500/30 text-amber-200/80'
                            }`}
                          >
                            {formatDieNum(ceilingDie)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Section Title & Swap Instructions */}
                <div className="flex items-center justify-between mb-2.5 shrink-0">
                  <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                    Attribute Die Assignments
                  </span>
                  <span className="text-[11px] text-amber-300 font-semibold">
                    Drag Row or Click ⇄ to Swap: <strong className="font-mono">1 AP</strong>
                  </span>
                </div>

                {swapSourceAttr && (
                  <div className="mb-2.5 px-3 py-2 rounded-xl bg-amber-950/60 border border-amber-400/60 text-amber-200 text-xs flex items-center justify-between animate-fadeIn shrink-0">
                    <span>
                      Select another Attribute below to swap with{' '}
                      <strong className="text-white">
                        {ATTRIBUTES.find((a) => a.key === swapSourceAttr)?.name}
                      </strong>{' '}
                      (1 AP)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSwapSourceAttr(null)}
                      className="text-[11px] font-bold text-amber-300 hover:text-white underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* 5 Attribute Cards with Direct Drag-to-Swap & Explicit Increase Buttons */}
                <div className="space-y-2.5 flex-1 min-h-0">
                  {ATTRIBUTES.map((attr) => {
                    const assignedDie = savedAttributeDice[attr.key];
                    const upgradeValidation = canUpgradeDieInPool(assignedDie);
                    const isSwapSource = swapSourceAttr === attr.key;
                    const isDragOver = dragOverAttr === attr.key && draggedSwapAttr !== attr.key;

                    return (
                      <div
                        key={attr.key}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedSwapAttr(attr.key);
                        }}
                        onDragEnd={() => {
                          setDraggedSwapAttr(null);
                          setDragOverAttr(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedSwapAttr && draggedSwapAttr !== attr.key) {
                            setDragOverAttr(attr.key);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverAttr === attr.key) setDragOverAttr(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedSwapAttr && draggedSwapAttr !== attr.key) {
                            handleRequestSwap(draggedSwapAttr, attr.key);
                          }
                        }}
                        onClick={() => {
                          if (swapSourceAttr && swapSourceAttr !== attr.key) {
                            handleRequestSwap(swapSourceAttr, attr.key);
                          }
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs cursor-grab active:cursor-grabbing ${
                          isDragOver
                            ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                            : isSwapSource
                            ? 'bg-amber-950/50 border-amber-400 ring-1 ring-amber-400/40'
                            : swapSourceAttr
                            ? 'bg-slate-950/90 border-amber-500/40 hover:border-amber-400 cursor-pointer'
                            : 'bg-slate-950/80 border-slate-800 hover:border-indigo-500/40'
                        }`}
                      >
                        {/* Left Side: Grip + Emoji + Name + Assigned Die Pill */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                          <span className="text-2xl shrink-0">{attr.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-outfit font-black text-sm uppercase text-slate-100 tracking-wider">
                                {attr.name}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-sm border shadow-sm ${getDieBadgeClasses(
                                  assignedDie,
                                  true
                                )}`}
                              >
                                {formatDieNum(assignedDie)}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                              {attr.domains}
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Explicit Increase Button + 1-Click Swap Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          {upgradeValidation.allowed && upgradeValidation.nextDie ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenUpgradeConfirmation(attr.key, attr.name);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-outfit font-bold text-white transition-all shadow-md text-xs flex items-center gap-1.5 cursor-pointer"
                              title={`Step up ${attr.name} from ${formatDieNum(assignedDie)} to ${formatDieNum(
                                upgradeValidation.nextDie
                              )} (${upgradeValidation.cost} AP)`}
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>
                                {formatDieNum(assignedDie)} ➔ {formatDieNum(upgradeValidation.nextDie)} ({upgradeValidation.cost} AP)
                              </span>
                            </button>
                          ) : upgradeValidation.isInsufficientAp && upgradeValidation.nextDie ? (
                            <button
                              type="button"
                              disabled
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-500 border border-slate-700/60 font-outfit font-bold text-xs flex items-center gap-1 cursor-not-allowed opacity-80"
                              title={upgradeValidation.reason}
                            >
                              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                              <span>
                                {formatDieNum(assignedDie)} ➔ {formatDieNum(upgradeValidation.nextDie)} ({upgradeValidation.cost} AP)
                              </span>
                            </button>
                          ) : (
                            <span
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-slate-400 font-mono text-[11px] border border-slate-800 flex items-center gap-1"
                              title={upgradeValidation.reason}
                            >
                              {assignedDie === 'd12' ? (
                                '✨ Max 12'
                              ) : upgradeValidation.unlockLevel ? (
                                <>
                                  <Lock className="w-3 h-3 text-amber-400/80" />
                                  <span>Unlocks Lvl {upgradeValidation.unlockLevel}</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 text-slate-500" />
                                  <span>Ceiling Cap</span>
                                </>
                              )}
                            </span>
                          )}

                          {/* Tactile Swap Trigger Button (pairs with Drag-and-Drop) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!swapSourceAttr) {
                                setSwapSourceAttr(attr.key);
                              } else if (swapSourceAttr === attr.key) {
                                setSwapSourceAttr(null);
                              } else {
                                handleRequestSwap(swapSourceAttr, attr.key);
                              }
                            }}
                            title={
                              isSwapSource
                                ? 'Cancel Swap selection'
                                : swapSourceAttr
                                ? `Swap with ${ATTRIBUTES.find((a) => a.key === swapSourceAttr)?.name} (1 AP)`
                                : `Click (or drag row) to swap ${attr.name} with another Attribute (1 AP)`
                            }
                            className={`px-2.5 py-1.5 rounded-lg font-outfit font-bold text-xs border transition-all flex items-center gap-1 cursor-pointer ${
                              isSwapSource
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-extrabold shadow'
                                : swapSourceAttr
                                ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 hover:bg-amber-900'
                                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-indigo-500/40'
                            }`}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            <span>{isSwapSource ? 'Selected' : swapSourceAttr ? 'Swap Here' : 'Swap'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANE (md:col-span-6): STEP-UP COSTS & MILESTONE CEILING MATRIX      */}
          {/* ========================================================================= */}
          <div className="md:col-span-6 flex flex-col p-5 bg-slate-900/90 overflow-y-auto max-h-full space-y-4">
            {/* Step-Up & Swap AP Cost Quick Reference Card */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Attribute Step-Up & Swap AP Costs
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Tier 2 Progression
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-xs">
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-slate-200">4 ➔ 6</div>
                  <div className="text-[10px] text-emerald-400 font-extrabold">2 AP</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-slate-200">6 ➔ 8</div>
                  <div className="text-[10px] text-emerald-400 font-extrabold">4 AP</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-slate-200">8 ➔ 10</div>
                  <div className="text-[10px] text-emerald-400 font-extrabold">6 AP</div>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-slate-200">10 ➔ 12</div>
                  <div className="text-[10px] text-emerald-400 font-extrabold">8 AP</div>
                </div>
                <div className="p-1.5 rounded-lg bg-amber-950/30 border border-amber-500/30">
                  <div className="font-bold text-amber-300">Swap ⇄</div>
                  <div className="text-[10px] text-amber-400 font-extrabold">1 AP</div>
                </div>
              </div>
            </div>

            {/* Milestone Matrix Header */}
            <div className="flex items-center justify-between shrink-0">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                Level Milestone Die Pool Ceilings
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Current Level: <strong className="text-amber-300">{level}</strong>
              </span>
            </div>

            {/* Milestone Matrix Table */}
            <div className="space-y-2 flex-1 min-h-0">
              {MILESTONE_TIERS.map((tier) => {
                const isActive = activeMilestone.id === tier.id;

                return (
                  <div
                    key={tier.id}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isActive
                        ? 'bg-amber-950/40 border-amber-400 shadow-md shadow-amber-950/50 ring-1 ring-amber-400/40'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isActive ? (
                        <Check className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-800 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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
                        <p className="text-[10px] text-slate-400 font-mono">
                          Max Ratings: {tier.description}
                        </p>
                      </div>
                    </div>

                    {/* Visual Die Badges for the Milestone Tier */}
                    <div className="flex items-center gap-1 shrink-0">
                      {tier.diceList.map((d, i) => (
                        <span
                          key={i}
                          className={`w-6 h-6 rounded-md font-mono font-black text-[11px] border flex items-center justify-center ${
                            isActive
                              ? getDieBadgeClasses(d, true)
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {formatDieNum(d)}
                        </span>
                      ))}
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
