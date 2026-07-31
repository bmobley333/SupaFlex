// src/components/modals/ApManagerModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Check,
  TrendingUp,
  Sparkles,
  Zap,
  Plus,
  RotateCcw,
  BookOpen,
  Award,
  Heart,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  AttributeKey,
  DieRating,
  ApLogEntry,
  calculateLifetimeAp,
  calculateSpentAp,
  calculateAvailableAp,
} from '../../types/game';

interface ApManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RightSubTab = 'STEP_UPS' | 'FOCUS_VIT' | 'CAPSTONES' | 'AUGMENTS' | 'MANUAL';

const ATR_STEP_UP_COSTS: Record<string, { next: DieRating; cost: number }> = {
  d4: { next: 'd6', cost: 2 },
  d6: { next: 'd8', cost: 4 },
  d8: { next: 'd10', cost: 6 },
  d10: { next: 'd12', cost: 8 },
};

const FOCUS_STEP_UP_COSTS: Record<string, { next: DieRating; cost: number; levelGate: number }> = {
  d4: { next: 'd6', cost: 2, levelGate: 1 },
  d6: { next: 'd8', cost: 4, levelGate: 15 },
  d8: { next: 'd10', cost: 6, levelGate: 35 },
  d10: { next: 'd12', cost: 8, levelGate: 60 },
};

const ATR_EMOJIS: Record<AttributeKey, string> = {
  might: '💪',
  motion: '🏃',
  mind: '👁️',
  magic: '✨',
  moxie: '🫀',
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
  'Manual',
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

export const ApManagerModal: React.FC<ApManagerModalProps> = ({ isOpen, onClose }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure, revertApExpenditure } =
    useCharacterStore();

  const [activeTab, setActiveTab] = useState<RightSubTab>('STEP_UPS');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Manual Custom Entry Form State
  const [manualCost, setManualCost] = useState<number>(1);
  const [manualCategory, setManualCategory] = useState<any>('Manual');
  const [manualDesc, setManualDesc] = useState<string>('');
  const [manualTier, setManualTier] = useState<any>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Augment Selector State
  const [selectedPowerForAugment, setSelectedPowerForAugment] = useState<string>('');
  const [augmentVector, setAugmentVector] = useState<string>('Vector 1: Punch (+1 Die Tier / +1 Target)');
  const [augmentNote, setAugmentNote] = useState<string>('');

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
  const freeTokens = sheetData.free_augment_tokens || 0;

  const lifetimeAp = calculateLifetimeAp(level);
  const spentAp = calculateSpentAp(apLog);
  const availableAp = calculateAvailableAp(level, apLog, sheetData.ap);

  const attributeDice = sheetData.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const rawFocus = sheetData.focus_die_max || sheetData.focus_die_current || 'd4';
  const focusDie = normalizeDie(rawFocus);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Filtered AP Log (Must be executed before any early return to comply with Rules of Hooks)
  const filteredLog = useMemo(() => {
    if (!Array.isArray(apLog)) return [];
    return apLog.filter((entry) => {
      if (!entry) return false;
      const cat = entry.category || 'Manual';
      const desc = entry.description || '';
      const src = entry.source || '';
      const matchesCat = selectedCategory === 'ALL' || cat === selectedCategory;
      const matchesSearch =
        desc.toLowerCase().includes((logSearchQuery || '').toLowerCase()) ||
        src.toLowerCase().includes((logSearchQuery || '').toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [apLog, selectedCategory, logSearchQuery]);

  if (!isOpen || !activeCharacter) return null;

  // Handle Attribute Die Step-Up
  const handleAtrStepUp = (attr: AttributeKey) => {
    const currentDie = normalizeDie(attributeDice[attr] || 'd4');
    const upgrade = ATR_STEP_UP_COSTS[currentDie];
    if (!upgrade) {
      showToast(`${attr.toUpperCase()} is already at maximum die (d12)!`);
      return;
    }
    if (availableAp < upgrade.cost) {
      showToast(`Insufficient AP! Required: ${upgrade.cost} AP, Available: ${availableAp} AP.`);
    }

    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: {
        ...(prev.attribute_dice || {}),
        [attr]: upgrade.next,
      },
    }));

    recordApExpenditure(
      upgrade.cost,
      'Attributes',
      `Step-Up ${attr.toUpperCase()} ${currentDie} ➔ ${upgrade.next}`,
      2,
      'Manage AP'
    );
    saveActiveCharacter();
    showToast(`Step-Up successful! ${attr.toUpperCase()} is now ${upgrade.next}.`);
  };

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

  // Handle Atr Reshuffle
  const handleAtrReshuffle = () => {
    if (availableAp < 1) {
      showToast('Insufficient AP! Required: 1 AP.');
    }
    recordApExpenditure(1, 'Attributes', 'Downtime Attribute Reshuffle', 1, 'Manage AP');
    saveActiveCharacter();
    showToast('Recorded 1 AP for Attribute Reshuffle. You may now swap your attribute dice!');
  };

  // Handle Tier 3 Capstones
  const handleBuyCapstone = (title: string, cost: number) => {
    if (availableAp < cost) {
      showToast(`Insufficient AP! Required: ${cost} AP, Available: ${availableAp} AP.`);
    }
    recordApExpenditure(cost, 'Capstones', `Unlocked Heroic Capstone: ${title}`, 3, 'Manage AP');
    saveActiveCharacter();
    showToast(`Unlocked Heroic Capstone: ${title}!`);
  };

  // Handle Augment Submission
  const handleApplyAugment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPowerForAugment) {
      showToast('Select a power or magic item to augment.');
      return;
    }

    const useToken = freeTokens > 0;
    const cost = useToken ? 0 : 1;

    if (!useToken && availableAp < 1) {
      showToast('Insufficient AP! Required: 1 AP.');
    }

    if (useToken) {
      updateActiveSheetData((prev) => ({
        ...prev,
        free_augment_tokens: Math.max(0, (prev.free_augment_tokens || 1) - 1),
      }));
    }

    const desc = `Augmented ${selectedPowerForAugment} (${augmentVector}) ${augmentNote ? `- ${augmentNote}` : ''} ${
      useToken ? '[Spent Augment Token]' : ''
    }`;

    recordApExpenditure(cost, 'Powers', desc, 1, 'Manage AP');
    saveActiveCharacter();
    setSelectedPowerForAugment('');
    setAugmentNote('');
    showToast(`Augment applied to ${selectedPowerForAugment}!`);
  };

  // Handle Manual Entry Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDesc.trim()) {
      showToast('Description is required for manual entry.');
      return;
    }
    recordApExpenditure(manualCost, manualCategory, manualDesc.trim(), manualTier, 'Manage AP');
    saveActiveCharacter();
    setManualDesc('');
    showToast('Manual AP entry recorded!');
  };

  const powerSlots = (sheetData.power_slots || []).filter(Boolean);

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
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="font-outfit font-black text-xl text-slate-100 tracking-wide flex items-center gap-2">
                🧩 SupaFlex AP Manager & Expenditure Log
              </h2>
              <p className="text-xs text-slate-400">
                Audit character progression, vertical stat step-ups, focus die, and capstones for{' '}
                <strong className="text-purple-300">{activeCharacter.name || 'Hero'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Split Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-slate-800">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: HERO AP STATUS BANNER & EXPENDITURE AUDIT LOG                */}
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

              {freeTokens > 0 && (
                <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Free Augment Tokens Available:
                  </span>
                  <span className="font-black text-amber-300 px-2 py-0.5 bg-amber-950 rounded border border-amber-500/40">
                    {freeTokens} Token{freeTokens > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col gap-2 mb-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  AP Expenditure Audit Log ({filteredLog.length})
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
                    placeholder="Search expenditure log..."
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
          {/* RIGHT COLUMN: ADVANCEMENT CENTER & SPENDING CATALOG                       */}
          {/* ========================================================================= */}
          <div className="w-1/2 flex flex-col p-5 bg-slate-900/90 overflow-hidden">
            {/* Right Pane Navigation Sub-Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-4 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('STEP_UPS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'STEP_UPS'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Stat Step-Ups
              </button>

              <button
                onClick={() => setActiveTab('FOCUS_VIT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'CAPSTONES'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                Capstones
              </button>

              <button
                onClick={() => setActiveTab('AUGMENTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'AUGMENTS'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Augments
              </button>

              <button
                onClick={() => setActiveTab('MANUAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-outfit transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'MANUAL'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Manual Entry
              </button>
            </div>

            {/* Sub-Tab Content Viewport */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {/* TAB 1: VERTICAL STAT STEP-UPS */}
              {activeTab === 'STEP_UPS' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">📈 Vertical Attribute Die Step-Ups (Tier 2)</p>
                    <p className="text-[11px] text-purple-300/80">
                      Step up individual attribute dice (d4➔d6: 2 AP, d6➔d8: 4 AP, d8➔d10: 6 AP, d10➔d12: 8 AP). Unlocks passive utility perks at d8 and master perks at d12.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {(['might', 'motion', 'mind', 'magic', 'moxie'] as AttributeKey[]).map((attr) => {
                      const currentDie = normalizeDie(attributeDice[attr] || 'd4');
                      const upgrade = ATR_STEP_UP_COSTS[currentDie];

                      return (
                        <div
                          key={attr}
                          className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{ATR_EMOJIS[attr]}</span>
                            <div>
                              <span className="font-outfit font-black text-sm uppercase text-slate-100 tracking-wider">
                                {attr}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-bold border border-purple-500/30">
                                  Current: {currentDie}
                                </span>
                                {upgrade && (
                                  <span className="text-[11px] text-slate-400">
                                    ➔ Next: <strong className="text-emerald-400">{upgrade.next}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            {upgrade ? (
                              <button
                                onClick={() => handleAtrStepUp(attr)}
                                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 font-outfit font-bold text-white transition-all shadow-md text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                Step-Up ({upgrade.cost} AP)
                              </button>
                            ) : (
                              <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 font-bold text-xs">
                                Max Die (d12)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: FOCUS DIE & VIT UPGRADES */}
              {activeTab === 'FOCUS_VIT' && (
                <div className="space-y-4">
                  {/* Focus Die Step-Up */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-outfit font-bold text-slate-100 text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                          Focus Die Step-Up (Tier 2)
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
                        Gain +2 Max Vitality (Tier 1)
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

                  {/* Attribute Reshuffle */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="font-outfit font-bold text-slate-100 text-sm flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-indigo-400" />
                        Attribute Reshuffle (Tier 1)
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Swap or reassign your attribute die array during milestone downtime.
                      </p>
                    </div>
                    <button
                      onClick={handleAtrReshuffle}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-outfit font-bold text-white transition-all shadow-md text-xs cursor-pointer"
                    >
                      Reshuffle (1 AP)
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: HEROIC CAPSTONES */}
              {activeTab === 'CAPSTONES' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">🏆 Tier 3 Heroic Capstones ("Saving" Tier)</p>
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

              {/* TAB 4: AUGMENT SYSTEM */}
              {activeTab === 'AUGMENTS' && (
                <form onSubmit={handleApplyAugment} className="space-y-4">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">⚡ 1-AP Augment System (Horizontal Vectors)</p>
                    <p className="text-[11px] text-purple-300/80">
                      Upgrade an existing Power or Magic Item along 1 of 4 non-hierarchical vectors (Punch, Compression, Twist, Frequency/Range).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Select Power or Item to Augment:</label>
                    <select
                      value={selectedPowerForAugment}
                      onChange={(e) => setSelectedPowerForAugment(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">-- Choose Equipped Ability --</option>
                      {powerSlots.map((slot: any, idx: number) => (
                        <option key={idx} value={slot?.name || `Ability ${idx + 1}`}>
                          {slot?.name || `Ability ${idx + 1}`} ({slot?.action || 'A'} / {slot?.usage || '1-Enc'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Augment Vector:</label>
                    <select
                      value={augmentVector}
                      onChange={(e) => setAugmentVector(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    >
                      <option value="Vector 1: Punch (+1 Die Tier / +1 Target)">Vector 1: Mechanical Punch (+1 Die Tier / +1 Target)</option>
                      <option value="Vector 2: Compression (AM->A->M->P->F - Max 1 Cap)">Vector 2: Action Compression (AM➔A➔M➔P➔F [Max 1 Cap])</option>
                      <option value="Vector 3: Twist (Affliction / Meta Gen on Miss)">Vector 3: Synergy / Affliction (Stun/Prone/Meta Gen)</option>
                      <option value="Vector 4: Usage (1-Enc -> 2-Enc -> 3-Enc / Range Shift)">Vector 4: Usage / Range Shift (1-Enc➔2-Enc➔3-Enc / Range)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Augment Notes & Twist Details:</label>
                    <input
                      type="text"
                      value={augmentNote}
                      onChange={(e) => setAugmentNote(e.target.value)}
                      placeholder="e.g. Uplift damage from d6 to d8..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-outfit font-black text-white text-xs tracking-wider transition-all shadow-lg cursor-pointer"
                  >
                    Apply Augment {freeTokens > 0 ? '(Free Token)' : '(1 AP)'}
                  </button>
                </form>
              )}

              {/* TAB 5: MANUAL ENTRY & GM GRANTS */}
              {activeTab === 'MANUAL' && (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                    <p className="font-bold mb-1">➕ Manual AP Adjustment & Custom Entry</p>
                    <p className="text-[11px] text-purple-300/80">
                      Record custom AP expenditures or GM grants directly into the character's audit log.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">AP Cost / Amount:</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={manualCost}
                        onChange={(e) => setManualCost(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Category:</label>
                      <select
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        {CATEGORIES.filter((c) => c !== 'ALL').map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Tier:</label>
                      <select
                        value={manualTier}
                        onChange={(e) => setManualTier(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                      >
                        <option value={1}>Tier 1 (Utility)</option>
                        <option value={2}>Tier 2 (Vertical)</option>
                        <option value={3}>Tier 3 (Capstone)</option>
                        <option value="Manual">Manual Grant</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Description:</label>
                    <input
                      type="text"
                      value={manualDesc}
                      onChange={(e) => setManualDesc(e.target.value)}
                      placeholder="e.g., GM Grant: Story Milestone Bonus..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-outfit font-black text-white text-xs tracking-wider transition-all shadow-lg cursor-pointer"
                  >
                    Record Entry
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Footer Bar (Master Blueprint Standard) */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-400" />
            All AP expenditures and log entries are automatically saved to hero sheet.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-outfit font-bold text-xs text-white shadow-lg transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
