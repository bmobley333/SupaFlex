// src/components/modals/ApManagerModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Award,
  Heart,
  Gift,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import {
  DieRating,
  ApLogEntry,
  calculateLifetimeAp,
  calculateLiveSheetSpentAp,
  calculateAvailableAp,
  parseAbilityVersion,
} from '../../types/game';

interface ApManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAttributeManager?: () => void;
  onOpenVitalityManager?: () => void;
}

type RightSubTab = 'FOCUS' | 'VITALITY' | 'CAPSTONES' | 'GM_BONUS';

const FOCUS_STEP_UP_COSTS: Record<string, { next: DieRating; cost: number; levelGate: number }> = {
  d4: { next: 'd6', cost: 2, levelGate: 1 },
  d6: { next: 'd8', cost: 4, levelGate: 15 },
  d8: { next: 'd10', cost: 6, levelGate: 35 },
  d10: { next: 'd12', cost: 8, levelGate: 60 },
};

const normalizeDie = (die?: string): string => {
  if (!die) return 'd4';
  const clean = die.toString().trim().toLowerCase();
  if (clean.startsWith('d')) return clean;
  return `d${clean}`;
};

export const ApManagerModal: React.FC<ApManagerModalProps> = ({
  isOpen,
  onClose,
  onOpenAttributeManager: _onOpenAttributeManager,
  onOpenVitalityManager,
}) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure, revertApExpenditure } =
    useCharacterStore();

  const [activeTab, setActiveTab] = useState<RightSubTab>('FOCUS');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // GM Bonus Form State
  const [gmBonusAmountInput, setGmBonusAmountInput] = useState<string>('1');
  const [gmBonusNote, setGmBonusNote] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

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

  const sheetData: any = activeCharacter?.sheet_data || {};
  const level = sheetData.level || 1;
  const apLog: ApLogEntry[] = Array.isArray(sheetData.ap_log) ? sheetData.ap_log : [];

  const lifetimeAp = calculateLifetimeAp(level);
  const liveApData = calculateLiveSheetSpentAp(sheetData);
  const spentAp = liveApData.totalSpent;
  const gmBonusAp = liveApData.gmBonus;
  const availableAp = calculateAvailableAp(level, sheetData);

  const rawFocus = sheetData.focus_die_max || sheetData.focus_die_current || 'd4';
  const focusDie = normalizeDie(rawFocus);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Compute live current sheet cost details for each category in ALPHABETICAL order
  const categoryBreakdownList = useMemo(() => {
    const knownSkillsets = Array.isArray(sheetData.known_skillsets) ? sheetData.known_skillsets : [];
    const knownIndivSkills = Array.isArray(sheetData.known_individual_skills) ? sheetData.known_individual_skills : [];
    const skillsetCost = Math.max(0, (knownSkillsets.length - 1) * 2);
    const indivCost = knownIndivSkills.length * 1;
    const skillsNet = skillsetCost + indivCost;

    const weapons = Array.isArray(sheetData.weapons) ? sheetData.weapons : [];
    const skilledWeapons = weapons.filter((w: any) => w && w.sk);
    const weaponsNet = Math.max(0, (skilledWeapons.length - 1) * 1);

    const wardrobe = Array.isArray(sheetData.wardrobe) ? sheetData.wardrobe : [];
    const skilledArmor = wardrobe.filter((a: any) => a && a.sk);
    const armorNet = Math.max(0, (skilledArmor.length - 1) * 1);

    const armory = Array.isArray(sheetData.armory) ? sheetData.armory : [];
    const skilledShields = armory.filter((s: any) => s && s.sk);
    const shieldsNet = Math.max(0, (skilledShields.length - 1) * 1);

    const powerSlots = (sheetData.power_slots || []).filter(Boolean);
    const totalPowerUnits = powerSlots.reduce((sum: number, slot: any) => sum + (slot?.version || 1), 0);
    const powersNet = Math.max(0, totalPowerUnits - 3);

    const magicItemSlots = (sheetData.spell_slots || []).filter(
      (s: any) => s && s.name && s.name.trim() !== ''
    );
    const magicItemsNet = magicItemSlots.reduce((sum: number, slot: any) => {
      const v = typeof slot.version === 'number' && slot.version > 0
        ? slot.version
        : (parseAbilityVersion(slot.name).version || 1);
      return sum + Math.max(0, v - 1);
    }, 0);

    const sumLogCategory = (cat: string) =>
      apLog.reduce((sum, e) => (e && e.category === cat ? sum + (e.cost || 0) : sum), 0);

    const attributesNet = Math.max(0, sumLogCategory('Attributes'));
    const focusNet = Math.max(0, sumLogCategory('Focus Die'));
    const vitalityNet = Math.max(0, sumLogCategory('Vitality'));
    const capstonesNet = Math.max(0, sumLogCategory('Capstones'));

    return [
      {
        id: 'armor',
        name: 'Armor',
        emoji: '🧥',
        netAp: armorNet,
        badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-500/30',
        details: [
          { label: `Skilled Armor in Wardrobe (${skilledArmor.length})`, value: `${armorNet} AP (1st Free)` },
        ],
      },
      {
        id: 'attributes',
        name: 'Attributes',
        emoji: '✨',
        netAp: attributesNet,
        badgeColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-500/30',
        details: [
          { label: `Die Pool Upgrades (Attribute Manager)`, value: `${attributesNet} AP` },
        ],
      },
      {
        id: 'capstones',
        name: 'Capstones',
        emoji: '🏆',
        netAp: capstonesNet,
        badgeColor: 'text-amber-300 bg-amber-950/60 border-amber-500/30',
        details: [
          { label: `Heroic Capstones Unlocked`, value: `${capstonesNet} AP` },
        ],
      },
      {
        id: 'focus',
        name: 'Focus',
        emoji: '🎯',
        netAp: focusNet,
        badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-500/30',
        details: [
          { label: `Focus Die Rating (${focusDie})`, value: `${focusNet} AP` },
        ],
      },
      {
        id: 'gmBonus',
        name: 'GM Bonus',
        emoji: '🎁',
        netAp: gmBonusAp,
        badgeColor: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/30',
        details: [
          { label: `Active GM Grants & Adjustments`, value: `${gmBonusAp > 0 ? '+' : ''}${gmBonusAp} AP` },
        ],
      },
      {
        id: 'magicItems',
        name: 'Magic Items',
        emoji: '💎',
        netAp: magicItemsNet,
        badgeColor: 'text-pink-300 bg-pink-950/60 border-pink-500/30',
        details: [
          { label: `Magic Item Upgrades (v2+ Version Edits)`, value: `${magicItemsNet} AP (Base v1 Free)` },
        ],
      },
      {
        id: 'powers',
        name: 'Powers',
        emoji: '⚡',
        netAp: powersNet,
        badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
        details: [
          { label: `Learned Powers (${powerSlots.length})`, value: `${totalPowerUnits} Total Power Units` },
          { label: `Free Power Allowance`, value: `-3 AP Free` },
        ],
      },
      {
        id: 'shields',
        name: 'Shields',
        emoji: '🛡️',
        netAp: shieldsNet,
        badgeColor: 'text-cyan-300 bg-cyan-950/60 border-cyan-500/30',
        details: [
          { label: `Skilled Shields in Armory (${skilledShields.length})`, value: `${shieldsNet} AP (1st Free)` },
        ],
      },
      {
        id: 'skills',
        name: 'Skills',
        emoji: '🥋',
        netAp: skillsNet,
        badgeColor: 'text-indigo-300 bg-indigo-950/60 border-indigo-500/30',
        details: [
          { label: `SkillSets (${knownSkillsets.length} learned)`, value: `${skillsetCost} AP (1st Free)` },
          { label: `Individual Skills (${knownIndivSkills.length} learned)`, value: `${indivCost} AP (1 AP each)` },
        ],
      },
      {
        id: 'vitality',
        name: 'Vitality',
        emoji: '❤️',
        netAp: vitalityNet,
        badgeColor: 'text-rose-400 bg-rose-950/60 border-rose-500/30',
        details: [
          { label: `Permanent +2 Max Vit Boosts (${vitalityNet} purchases)`, value: `${vitalityNet} AP (+${vitalityNet * 2} Vit)` },
        ],
      },
      {
        id: 'weapons',
        name: 'Weapons',
        emoji: '⚔️',
        netAp: weaponsNet,
        badgeColor: 'text-purple-300 bg-purple-950/60 border-purple-500/30',
        details: [
          { label: `Skilled Weapons Equipped (${skilledWeapons.length})`, value: `${weaponsNet} AP (1st Free)` },
        ],
      },
    ];
  }, [sheetData, apLog, focusDie, gmBonusAp]);

  if (!isOpen || !activeCharacter) return null;

  // Handle Focus Die Step-Up
  const handleFocusStepUp = () => {
    const upgrade = FOCUS_STEP_UP_COSTS[focusDie];
    if (!upgrade) {
      showToast('Focus die is already at max (d12)!');
      return;
    }
    if (level < upgrade.levelGate) {
      showToast(`Level Gate locked! Level ${upgrade.levelGate}+ required (Current: Level ${level}).`);
      return;
    }
    if (availableAp < upgrade.cost) {
      showToast(`Insufficient AP! Required: ${upgrade.cost} AP, Available: ${availableAp} AP.`);
      return;
    }

    updateActiveSheetData((prev) => ({
      ...prev,
      focus_die_max: upgrade.next,
      focus_die_current: upgrade.next,
    }));

    recordApExpenditure(
      upgrade.cost,
      'Focus Die',
      `Upgraded Focus Die ${focusDie} ➔ ${upgrade.next}`,
      2,
      'Manage AP'
    );
    saveActiveCharacter();
    showToast(`Focus die upgraded to ${upgrade.next}!`);
  };

  // Handle Tier 3 Capstones
  const handleBuyCapstone = (title: string, cost: number) => {
    if (availableAp < cost) {
      showToast(`Insufficient AP! Required: ${cost} AP, Available: ${availableAp} AP.`);
      return;
    }
    recordApExpenditure(cost, 'Capstones', `Unlocked Heroic Capstone: ${title}`, 3, 'Manage AP');
    saveActiveCharacter();
    showToast(`Unlocked Heroic Capstone: ${title}!`);
  };

  // Handle GM Bonus Submission
  const handleApplyGmBonus = () => {
    const parsedAmount = parseInt(gmBonusAmountInput, 10);
    if (isNaN(parsedAmount) || parsedAmount === 0) return;
    const desc = gmBonusNote.trim()
      ? `GM Bonus: ${gmBonusNote.trim()} (${parsedAmount > 0 ? '+' : ''}${parsedAmount} AP)`
      : `GM AP Adjustment (${parsedAmount > 0 ? '+' : ''}${parsedAmount} AP)`;

    recordApExpenditure(parsedAmount, 'GM Bonus', desc, 'Manual', 'GM Grant');
    saveActiveCharacter();
    setGmBonusNote('');
    showToast(`Applied GM Bonus adjustment (${parsedAmount > 0 ? '+' : ''}${parsedAmount} AP)!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-indigo-900 border border-indigo-400 text-indigo-100 shadow-2xl font-medium text-xs flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          {toastMessage}
        </div>
      )}

      {/* Main Modal Shell (Master 2-Column Split-Pane) */}
      <div
        ref={modalRef}
        className="w-full max-w-6xl h-[88vh] bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/80 flex flex-col overflow-hidden text-slate-100"
      >
        {/* Header Bar: 🧩 is the ONLY icon in the title bar */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="font-outfit font-black text-xl text-slate-100 tracking-wide flex items-center gap-2">
                🧩 Manage AP
                <CardHelpButton ruleKey="leveling.advancement_steps" />
              </h2>
              <p className="text-xs text-slate-400">
                Audit character progression, AP costs, and capstones for{' '}
                <strong className="text-purple-300">{activeCharacter.name || 'Hero'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
            title="Close Manage AP"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Split Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-slate-800">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: HERO AP STATUS BANNER & INTERACTIVE CATEGORY BREAKDOWN       */}
          {/* ========================================================================= */}
          <div className="w-1/2 flex flex-col p-5 bg-slate-900/60 overflow-hidden">
            {/* Status Banner */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 mb-4 shadow-lg shrink-0">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Level⭐
                  </span>
                  <span className="font-outfit font-black text-lg text-amber-300">{level}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Lifetime AP
                  </span>
                  <span className="font-outfit font-black text-lg text-purple-300">{lifetimeAp}</span>
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Total Spent
                  </span>
                  <span className="font-outfit font-black text-lg text-rose-400">{spentAp}</span>
                </div>

                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/50">
                  <span className="text-[10px] font-extrabold text-purple-300 uppercase tracking-wider block">
                    Available AP
                  </span>
                  <span className="font-outfit font-black text-xl text-emerald-400">{availableAp}</span>
                </div>
              </div>

              {gmBonusAp !== 0 && (
                <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Gift className="w-4 h-4 text-amber-400" />
                    GM Bonus AP Adjustments:
                  </span>
                  <span className="font-black text-amber-300 px-2 py-0.5 bg-amber-950 rounded border border-amber-500/40 font-mono">
                    {gmBonusAp > 0 ? `+${gmBonusAp}` : gmBonusAp} AP
                  </span>
                </div>
              )}
            </div>

            {/* Category AP Breakdown Title & Subtitle */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-purple-300">
                Category AP Breakdown
              </span>
              <span className="text-[11px] text-slate-400">Click a category card for cost details</span>
            </div>

            {/* Interactive Category Line-Card List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {categoryBreakdownList.map((cat) => {
                const isExpanded = expandedCategory === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'bg-slate-950 border-purple-500/60 shadow-md shadow-purple-950/40'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Line-Card Header Bar */}
                    <div
                      onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                      className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{cat.emoji}</span>
                        <span className="font-outfit font-bold text-sm text-slate-100">{cat.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-lg border font-mono font-bold text-xs ${cat.badgeColor}`}>
                          {cat.id === 'gmBonus' && cat.netAp > 0 ? `+${cat.netAp}` : cat.netAp} AP
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-purple-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Inline Expanded Cost Details */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 bg-slate-900/50 space-y-1.5 text-xs text-slate-300">
                        {cat.details.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-slate-850">
                            <span className="text-slate-400 font-medium">{item.label}</span>
                            <span className="font-mono font-bold text-indigo-300">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: STREAMLINED ADVANCEMENT & GM BONUS CENTER                   */}
          {/* ========================================================================= */}
          <div className="w-1/2 flex flex-col p-5 bg-slate-900/90 overflow-hidden">
            {/* Right Pane Navigation Sub-Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('FOCUS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'FOCUS'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Focus Die
              </button>

              <button
                onClick={() => setActiveTab('VITALITY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'VITALITY'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                Vitality
              </button>

              <button
                onClick={() => setActiveTab('CAPSTONES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'CAPSTONES'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Capstones
              </button>

              <button
                onClick={() => setActiveTab('GM_BONUS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'GM_BONUS'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gift className="w-3.5 h-3.5" />
                GM Bonus
              </button>
            </div>

            {/* Sub-Tab Content Viewport */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {/* TAB 1: FOCUS DIE STEP-UP */}
              {activeTab === 'FOCUS' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-outfit font-bold text-slate-100 text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          Focus Die Step-Up
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Current Focus Die Ceiling: <strong className="text-amber-300">{focusDie}</strong>
                        </p>
                      </div>

                      {FOCUS_STEP_UP_COSTS[focusDie] ? (
                        <button
                          onClick={handleFocusStepUp}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer"
                        >
                          Upgrade ({FOCUS_STEP_UP_COSTS[focusDie].cost} AP)
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 font-bold text-xs">
                          Max Ceiling (d12)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                      <div className={`p-2 rounded-lg border ${focusDie === 'd4' ? 'bg-amber-950/40 border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <strong>d4 ➔ d6</strong>
                        <div className="text-[10px]">Level 1+ | 2 AP</div>
                      </div>
                      <div className={`p-2 rounded-lg border ${focusDie === 'd6' ? 'bg-amber-950/40 border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <strong>d6 ➔ d8</strong>
                        <div className="text-[10px]">Level 15+ | 4 AP</div>
                      </div>
                      <div className={`p-2 rounded-lg border ${focusDie === 'd8' ? 'bg-amber-950/40 border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <strong>d8 ➔ d10</strong>
                        <div className="text-[10px]">Level 35+ | 6 AP</div>
                      </div>
                      <div className={`p-2 rounded-lg border ${focusDie === 'd10' ? 'bg-amber-950/40 border-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <strong>d10 ➔ d12</strong>
                        <div className="text-[10px]">Level 60+ | 8 AP</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VITALITY BOOST */}
              {activeTab === 'VITALITY' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-950/90 border border-rose-500/30 flex items-center justify-between shadow-xl">
                    <div className="space-y-1">
                      <h4 className="font-outfit font-bold text-rose-300 text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-400" />
                        Open Vitality Manager
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Access Level Vit rolls, AP boosts (+2 Vit for 1 AP), auto-roll calculator, and restoration controls.
                      </p>
                    </div>
                    {onOpenVitalityManager && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenVitalityManager();
                        }}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 font-outfit font-bold text-white transition-all shadow-lg text-xs cursor-pointer flex items-center gap-2 shrink-0 active:scale-95"
                      >
                        <span>Open Manager</span>
                        <span>❤️</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: HEROIC CAPSTONES */}
              {activeTab === 'CAPSTONES' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">🏆 Heroic Capstones ("Saving" Tier)</p>
                    <p className="text-[11px] text-purple-300/80">
                      High-cost capstones designed for build-defining investment and long-term saving anticipation.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-outfit font-bold text-amber-300 text-sm">Master Technique (5 AP)</h4>
                      <button
                        onClick={() => handleBuyCapstone('Master Technique', 5)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-outfit font-bold text-white transition-all text-xs cursor-pointer"
                      >
                        Unlock (5 AP)
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Combine two known Powers into a single combined-action deployment during combat.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-outfit font-bold text-amber-300 text-sm">Second Reaction (6 AP)</h4>
                      <button
                        onClick={() => handleBuyCapstone('Second Reaction', 6)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-outfit font-bold text-white transition-all text-xs cursor-pointer"
                      >
                        Unlock (6 AP)
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Gain an additional Reaction action per combat round (increases reaction ceiling to 2).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-outfit font-bold text-amber-300 text-sm">Heroic Passive (8 AP)</h4>
                      <button
                        onClick={() => handleBuyCapstone('Heroic Passive', 8)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-outfit font-bold text-white transition-all text-xs cursor-pointer"
                      >
                        Unlock (8 AP)
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Unlock a signature, narrative-defining passive power or capstone immunity.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 4: GM BONUS */}
              {activeTab === 'GM_BONUS' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">🎁 GM Bonus AP Adjustments</p>
                    <p className="text-[11px] text-purple-300/80">
                      Add GM quest bonus AP or apply manual AP adjustments to your hero's total pool.
                    </p>
                  </div>

                  {/* TOTAL AP Adjustment Read-Only Box */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-200 flex items-center gap-2">
                      <Gift className="w-4 h-4 text-amber-400" />
                      TOTAL AP Adjustment:
                    </span>
                    <span className="font-black font-mono text-amber-300 text-sm px-3 py-1 bg-amber-950 rounded-lg border border-amber-500/40">
                      {gmBonusAp > 0 ? `+${gmBonusAp}` : gmBonusAp} AP
                    </span>
                  </div>

                  {/* Custom Note Adjustment Form */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 block">Custom Adjustment & Note:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={gmBonusAmountInput}
                        onChange={(e) => setGmBonusAmountInput(e.target.value)}
                        placeholder="AP (+/-)"
                        className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-amber-300 font-mono font-bold outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        value={gmBonusNote}
                        onChange={(e) => setGmBonusNote(e.target.value)}
                        placeholder="Reason (e.g. GM Quest Award)..."
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 outline-none focus:border-purple-500"
                      />
                    </div>
                    <button
                      onClick={handleApplyGmBonus}
                      disabled={!gmBonusAmountInput || isNaN(parseInt(gmBonusAmountInput, 10)) || parseInt(gmBonusAmountInput, 10) === 0}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-outfit font-bold text-xs rounded-lg transition-all shadow cursor-pointer disabled:opacity-40"
                    >
                      Apply GM Adjustment
                    </button>
                  </div>

                  {/* Quick Log of GM Entries */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <span className="text-xs font-bold text-slate-300 block">GM Adjustment History:</span>
                    {apLog.filter((e) => e && (e.category === 'GM Bonus' || e.category === 'Manual')).length === 0 ? (
                      <div className="p-4 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                        No GM AP adjustments logged yet.
                      </div>
                    ) : (
                      apLog
                        .filter((e) => e && (e.category === 'GM Bonus' || e.category === 'Manual'))
                        .map((entry) => (
                          <div
                            key={entry.id || Math.random().toString()}
                            className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-200 truncate">{entry.description || 'GM AP Adjustment'}</p>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs border ${
                                entry.cost > 0
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                  : 'bg-rose-950 text-rose-300 border-rose-500/30'
                              }`}>
                                {entry.cost > 0 ? `+${entry.cost}` : entry.cost} AP
                              </span>
                              <button
                                onClick={() => {
                                  revertApExpenditure(entry.id);
                                  saveActiveCharacter();
                                  showToast('Reverted GM adjustment!');
                                }}
                                className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 transition-colors cursor-pointer"
                                title="Revert & Delete GM Adjustment"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Context Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Hero: <strong className="text-purple-300">{activeCharacter.name}</strong>
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
