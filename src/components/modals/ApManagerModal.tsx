// src/components/modals/ApManagerModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Sparkles,
  RotateCcw,
  BookOpen,
  Award,
  Heart,
  Gift,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  DieRating,
  ApLogEntry,
  calculateLifetimeAp,
  calculateSpentAp,
  calculateAvailableAp,
  calculateGmBonusAp,
} from '../../types/game';

interface ApManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAttributeManager?: () => void;
}

type RightSubTab = 'FOCUS_VIT' | 'CAPSTONES' | 'GM_BONUS';

const FOCUS_STEP_UP_COSTS: Record<string, { next: DieRating; cost: number; levelGate: number }> = {
  d4: { next: 'd6', cost: 2, levelGate: 1 },
  d6: { next: 'd8', cost: 4, levelGate: 15 },
  d8: { next: 'd10', cost: 6, levelGate: 35 },
  d10: { next: 'd12', cost: 8, levelGate: 60 },
};

const CATEGORIES = [
  'ALL',
  'Skills',
  'Weapons',
  'Armor',
  'Shields',
  'Powers',
  'Magic Items',
  'Attributes',
  'Focus Die',
  'Capstones',
  'Vitality',
  'GM Bonus',
];

const normalizeDie = (die?: string): string => {
  if (!die) return 'd4';
  const clean = die.toString().trim().toLowerCase();
  if (clean.startsWith('d')) return clean;
  return `d${clean}`;
};

const formatDate = (ts?: string): string => {
  if (!ts) return 'N/A';
  try {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

export const ApManagerModal: React.FC<ApManagerModalProps> = ({ isOpen, onClose, onOpenAttributeManager }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure, revertApExpenditure } =
    useCharacterStore();

  const [activeTab, setActiveTab] = useState<RightSubTab>('FOCUS_VIT');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // GM Bonus Form State
  const [gmBonusAmount, setGmBonusAmount] = useState<number>(1);
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
  const spentAp = calculateSpentAp(apLog);
  const gmBonusAp = calculateGmBonusAp(apLog);
  const availableAp = calculateAvailableAp(level, apLog, sheetData.ap);

  const rawFocus = sheetData.focus_die_max || sheetData.focus_die_current || 'd4';
  const focusDie = normalizeDie(rawFocus);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Calculate AP totals per category for summary grid
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {
      Skills: 0,
      Weapons: 0,
      Armor: 0,
      Shields: 0,
      Powers: 0,
      'Magic Items': 0,
      Attributes: 0,
      'Focus Die': 0,
      Capstones: 0,
      'GM Bonus': 0,
    };

    if (Array.isArray(apLog)) {
      apLog.forEach((e) => {
        if (!e) return;
        const cat = e.category || 'Manual';
        const cost = typeof e.cost === 'number' && !isNaN(e.cost) ? e.cost : 0;
        if (cat === 'GM Bonus' || cat === 'Manual') {
          totals['GM Bonus'] = (totals['GM Bonus'] || 0) + cost;
        } else {
          totals[cat] = (totals[cat] || 0) + cost;
        }
      });
    }
    return totals;
  }, [apLog]);

  // Filtered AP Log
  const filteredLog = useMemo(() => {
    if (!Array.isArray(apLog)) return [];
    return apLog.filter((entry) => {
      if (!entry) return false;
      const cat = entry.category || 'Manual';
      const desc = entry.description || '';
      const src = entry.source || '';
      const matchesCat =
        selectedCategory === 'ALL' ||
        cat === selectedCategory ||
        (selectedCategory === 'GM Bonus' && (cat === 'GM Bonus' || cat === 'Manual'));
      const matchesSearch =
        desc.toLowerCase().includes((logSearchQuery || '').toLowerCase()) ||
        src.toLowerCase().includes((logSearchQuery || '').toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [apLog, selectedCategory, logSearchQuery]);

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

  // Handle Vit +2 Purchase
  const handleBuyVit = () => {
    if (availableAp < 1) {
      showToast('Insufficient AP! Required: 1 AP.');
      return;
    }
    updateActiveSheetData((prev) => ({
      ...prev,
      vitality_max: (prev.vitality_max || 10) + 2,
      current_vitality: (prev.current_vitality || 10) + 2,
    }));
    recordApExpenditure(1, 'Vitality', 'Purchased +2 Max Vitality', 1, 'Manage AP');
    saveActiveCharacter();
    showToast('Gained +2 Max Vitality!');
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
  const handleApplyGmBonus = (amount: number) => {
    if (amount === 0) return;
    const desc = gmBonusNote.trim()
      ? `GM Bonus: ${gmBonusNote.trim()} (${amount > 0 ? '+' : ''}${amount} AP)`
      : `GM AP Adjustment (${amount > 0 ? '+' : ''}${amount} AP)`;

    recordApExpenditure(amount, 'GM Bonus', desc, 'Manual', 'GM Grant');
    saveActiveCharacter();
    setGmBonusNote('');
    showToast(`Applied GM Bonus adjustment (${amount > 0 ? '+' : ''}${amount} AP)!`);
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
              </h2>
              <p className="text-xs text-slate-400">
                Audit character progression, AP logs, and capstones for{' '}
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
          {/* LEFT COLUMN: HERO AP STATUS & CATEGORY BREAKDOWN LOG                      */}
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

            {/* Category AP Breakdown Grid */}
            <div className="mb-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 shrink-0">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                Category AP Breakdown
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-[11px] text-center">
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">🥋 Skills</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Skills || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">⚔️ Weapons</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Weapons || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">🧥 Armor</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Armor || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">🛡️ Shields</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Shields || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">⚡ Powers</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Powers || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">✨ Attr</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Attributes || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">🎯 Focus</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals['Focus Die'] || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[9px] text-slate-400 block truncate">🏆 Capstones</span>
                  <span className="font-mono font-bold text-slate-200">{categoryTotals.Capstones || 0}</span>
                </div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 col-span-2">
                  <span className="text-[9px] text-amber-400 block truncate">🎁 GM Bonus</span>
                  <span className="font-mono font-bold text-amber-300">
                    {categoryTotals['GM Bonus'] > 0 ? `+${categoryTotals['GM Bonus']}` : categoryTotals['GM Bonus'] || 0} AP
                  </span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-2 mb-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  AP Log ({filteredLog.length})
                </span>
                <span className="text-[11px] text-slate-400">Click ↺ to revert & refund spend</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Search AP log..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Log Scrollable Container */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {filteredLog.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  No AP expenditures logged matching criteria.
                </div>
              ) : (
                filteredLog.map((entry) => (
                  <div
                    key={entry.id || Math.random().toString()}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/30 uppercase">
                          {entry.category || 'Manual'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatDate(entry.timestamp)}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">({entry.source || 'Manage AP'})</span>
                      </div>
                      <p className="font-medium text-slate-200 truncate">{entry.description || 'AP Expenditure'}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {entry.cost < 0 ? (
                        <span className="font-outfit font-black text-xs text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          +{Math.abs(entry.cost)} AP Refund
                        </span>
                      ) : entry.cost === 0 ? (
                        <span className="font-outfit font-black text-xs text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                          0 AP (Free)
                        </span>
                      ) : (
                        <span className="font-outfit font-black text-sm text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                          {entry.cost} AP
                        </span>
                      )}
                      <button
                        onClick={() => {
                          revertApExpenditure(entry.id);
                          saveActiveCharacter();
                          showToast(`Reverted entry & refunded ${entry.cost || 0} AP!`);
                        }}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 transition-colors cursor-pointer"
                        title="Revert entry and refund AP"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: STREAMLINED ADVANCEMENT & GM BONUS CENTER                   */}
          {/* ========================================================================= */}
          <div className="w-1/2 flex flex-col p-5 bg-slate-900/90 overflow-hidden">
            {/* Right Pane Navigation Sub-Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('FOCUS_VIT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'FOCUS_VIT'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Focus & Vit
              </button>

              <button
                onClick={() => setActiveTab('CAPSTONES')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              {/* TAB 1: FOCUS DIE & VIT UPGRADES */}
              {activeTab === 'FOCUS_VIT' && (
                <div className="space-y-4">
                  {/* Focus Die Step-Up */}
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

                  {/* Vitality Boost */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-outfit font-bold text-slate-100 text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-400" />
                        Gain +2 Max Vitality
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Permanently increases your maximum Vit by +2.</p>
                    </div>
                    <button
                      onClick={handleBuyVit}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer"
                    >
                      Buy +2 Vit (1 AP)
                    </button>
                  </div>

                  {/* Attribute Manager Launcher Link */}
                  {onOpenAttributeManager && (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div>
                        <h4 className="font-outfit font-bold text-slate-100 text-sm flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-indigo-400" />
                          Attribute Manager & Reshuffle
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Configure attribute die assignments, step up die pools, and view milestone ceilings.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenAttributeManager();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Attribute Manager
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HEROIC CAPSTONES */}
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

              {/* TAB 3: GM BONUS */}
              {activeTab === 'GM_BONUS' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">🎁 GM Bonus AP Adjustments</p>
                    <p className="text-[11px] text-purple-300/80">
                      Add GM quest bonus AP or apply manual AP adjustments to your hero's total pool.
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 block">Quick Presets:</span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleApplyGmBonus(1)}
                        className="px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        +1 Bonus AP
                      </button>
                      <button
                        onClick={() => handleApplyGmBonus(2)}
                        className="px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        +2 Bonus AP
                      </button>
                      <button
                        onClick={() => handleApplyGmBonus(5)}
                        className="px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        +5 Bonus AP
                      </button>
                      <button
                        onClick={() => handleApplyGmBonus(-1)}
                        className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        -1 AP Penalty
                      </button>
                      <button
                        onClick={() => handleApplyGmBonus(-2)}
                        className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        -2 AP Penalty
                      </button>
                      <button
                        onClick={() => handleApplyGmBonus(-5)}
                        className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer transition-all"
                      >
                        -5 AP Penalty
                      </button>
                    </div>
                  </div>

                  {/* Custom Note Adjustment Form */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-300 block">Custom Adjustment & Note:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={gmBonusAmount}
                        onChange={(e) => setGmBonusAmount(parseInt(e.target.value) || 0)}
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
                      onClick={() => handleApplyGmBonus(gmBonusAmount)}
                      disabled={gmBonusAmount === 0}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-outfit font-bold text-xs rounded-lg transition-all shadow cursor-pointer disabled:opacity-40"
                    >
                      Apply GM Adjustment ({gmBonusAmount > 0 ? '+' : ''}{gmBonusAmount} AP)
                    </button>
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
