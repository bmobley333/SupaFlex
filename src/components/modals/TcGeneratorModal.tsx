// src/components/modals/TcGeneratorModal.tsx
// Tremendous & Critical Generator Modal
// Supports 6 combat categories (Nish, Melee, Hurled, Shot, Dodge, Block) grouped into 3 domains
// Instantaneous 0ms local lookups with Supabase public.tc fallback

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Dices, Trash2 } from 'lucide-react';
import tcDataRaw from '../../data/tc_data.json';

export type TcCategory = 'Nish' | 'Melee' | 'Hurled' | 'Shot' | 'Dodge' | 'Block';

interface TcDataItem {
  id?: number;
  category: TcCategory;
  type: 'tremendous' | 'critical';
  roll_value: number;
  name: string;
  effect: string;
}

const LOCAL_TC_DATA: TcDataItem[] = tcDataRaw as TcDataItem[];

export interface TcRollResult {
  id: string;
  category: TcCategory;
  type: 'tremendous' | 'critical';
  rollVal: number;
  name: string;
  effect: string;
  timestamp: string;
}

export interface TcGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName?: string;
  initialCategory?: TcCategory;
  autoRollType?: 'tremendous' | 'critical' | null;
  autoRollCount?: number;
}

const CATEGORY_META: Record<TcCategory, { label: string; icon: string; activeColor: string; activeText: string }> = {
  Nish: { label: 'Nish', icon: '🚩', activeColor: 'bg-amber-500', activeText: 'text-slate-950 font-extrabold' },
  Melee: { label: 'Melee', icon: '⚔️', activeColor: 'bg-rose-600', activeText: 'text-white font-extrabold' },
  Hurled: { label: 'Hurled', icon: '🎯', activeColor: 'bg-orange-600', activeText: 'text-white font-extrabold' },
  Shot: { label: 'Shot', icon: '🏹', activeColor: 'bg-emerald-600', activeText: 'text-white font-extrabold' },
  Dodge: { label: 'Dodge', icon: '💨', activeColor: 'bg-cyan-600', activeText: 'text-white font-extrabold' },
  Block: { label: 'Block', icon: '🛡️', activeColor: 'bg-indigo-600', activeText: 'text-white font-extrabold' },
};

export const TcGeneratorModal: React.FC<TcGeneratorModalProps> = ({
  isOpen,
  onClose,
  characterName = 'Active Hero',
  initialCategory = 'Nish',
  autoRollType,
  autoRollCount = 1,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<TcCategory>(initialCategory);
  const [isRolling, setIsRolling] = useState(false);
  const [history, setHistory] = useState<TcRollResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasAutoRolledRef = useRef(false);

  // Sync category if initialCategory changes on open
  useEffect(() => {
    if (isOpen && initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [isOpen, initialCategory]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  const handleRoll = async (
    targetType: 'tremendous' | 'critical',
    category: TcCategory = selectedCategory,
    count: number = 1
  ) => {
    setIsRolling(true);
    const newResults: TcRollResult[] = [];

    for (let c = 0; c < count; c++) {
      const rollVal = rollDice(50);
      let name = '';
      let effect = '';

      // 1. Instant local lookup in bundled dataset (0ms latency, zero egress)
      const localMatch = LOCAL_TC_DATA.find(
        (item) => item.category === category && item.type === targetType && item.roll_value === rollVal
      );
      if (localMatch) {
        name = localMatch.name;
        effect = localMatch.effect;
      } else {
        // 2. Fallback to Supabase public.tc table
        try {
          const { data, error } = await supabase
            .from('tc')
            .select('name, effect')
            .eq('category', category)
            .eq('type', targetType)
            .eq('roll_value', rollVal)
            .maybeSingle();

          if (!error && data && data.name && data.effect) {
            name = data.name;
            effect = data.effect;
          }
        } catch (err: any) {
          console.warn('Supabase tc query notice:', err);
        }
      }

      // 3. Fallback generic text if both fail
      if (!name || !effect) {
        name = `${category} ${targetType === 'tremendous' ? 'Tremendous' : 'Critical'} #${rollVal}`;
        effect =
          targetType === 'tremendous'
            ? `Gain tactical advantage or extra surge effect on ${category}.`
            : `Suffer complication or tactical mishap on ${category}.`;
      }

      newResults.push({
        id: `tc-${Date.now()}-${c}-${Math.random().toString(36).substr(2, 4)}`,
        category,
        type: targetType,
        rollVal,
        name,
        effect,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }

    setHistory((prev) => [...newResults, ...prev]);

    if (count > 1) {
      showToast(`Rolled 2x Double ${targetType === 'tremendous' ? 'Tremendous' : 'Critical'} on ${category}!`);
    } else if (newResults[0]) {
      showToast(`Rolled ${category} d50 #${newResults[0].rollVal}: ${newResults[0].name}`);
    }
    setIsRolling(false);
  };

  // Auto-roll upon modal opening if autoRollType is provided
  useEffect(() => {
    if (isOpen && autoRollType && !hasAutoRolledRef.current) {
      hasAutoRolledRef.current = true;
      const cat = initialCategory || 'Nish';
      setSelectedCategory(cat);
      handleRoll(autoRollType, cat, autoRollCount || 1);
    }
    if (!isOpen) {
      hasAutoRolledRef.current = false;
    }
  }, [isOpen, autoRollType, autoRollCount, initialCategory]);

  // Filter history to current active category
  const filteredHistory = useMemo(() => {
    return history.filter((res) => res.category === selectedCategory);
  }, [history, selectedCategory]);

  if (!isOpen) return null;

  const currentMeta = CATEGORY_META[selectedCategory];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl font-extrabold text-xs shadow-xl animate-bounce border border-amber-300">
          ✨ {toastMessage}
        </div>
      )}

      {/* Main Modal Shell Container */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Fixed Glass Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl select-none">🎲</span>
              <div>
                <h3 className="text-xl font-extrabold text-amber-400 font-outfit tracking-wide flex items-center gap-2">
                  Tremendous & Critical Generator
                </h3>
                <p className="text-xs text-slate-400">
                  Roll Tremendous or Critical effects across Initiative, Attacks, and Defenses.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 🌟 KISS Multi-Option Pill Switch with 3 Clear Combat Groups */}
          <div className="bg-slate-950/90 border border-slate-800/90 p-1.5 rounded-xl flex items-center justify-between flex-wrap gap-2 shadow-inner">
            {/* Group 1: Nish (Initiative) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('Nish')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'Nish'
                    ? `${CATEGORY_META.Nish.activeColor} ${CATEGORY_META.Nish.activeText} shadow-sm`
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>🚩</span>
                <span>Nish</span>
              </button>
            </div>

            {/* Divider 1 */}
            <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

            {/* Group 2: Attacks (Melee, Hurled, Shot) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('Melee')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'Melee'
                    ? `${CATEGORY_META.Melee.activeColor} ${CATEGORY_META.Melee.activeText} shadow-sm`
                    : 'text-slate-400 hover:text-rose-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>⚔️</span>
                <span>Melee</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('Hurled')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'Hurled'
                    ? `${CATEGORY_META.Hurled.activeColor} ${CATEGORY_META.Hurled.activeText} shadow-sm`
                    : 'text-slate-400 hover:text-orange-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>🎯</span>
                <span>Hurled</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('Shot')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'Shot'
                    ? `${CATEGORY_META.Shot.activeColor} ${CATEGORY_META.Shot.activeText} shadow-sm`
                    : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>🏹</span>
                <span>Shot</span>
              </button>
            </div>

            {/* Divider 2 */}
            <div className="h-4 w-px bg-slate-800 shrink-0 hidden sm:block" />

            {/* Group 3: Defenses (Dodge, Block) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('Dodge')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'Dodge'
                    ? `${CATEGORY_META.Dodge.activeColor} ${CATEGORY_META.Dodge.activeText} shadow-sm`
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>💨</span>
                <span>Dodge</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('Block')}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCategory === 'Block'
                    ? `${CATEGORY_META.Block.activeColor} ${CATEGORY_META.Block.activeText} shadow-sm`
                    : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <span>🛡️</span>
                <span>Block</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal 2-Pane Blueprint Grid Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 min-h-0 overflow-hidden">
          {/* LEFT PANE (md:col-span-7): History Stream (Category Filtered) */}
          <div className="md:col-span-7 flex flex-col h-full border-r border-slate-800/80 pr-6 min-h-0">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 shrink-0">
              <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>📜 {selectedCategory} Roll Log</span>
                <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded-md text-[10px]">
                  {filteredHistory.length}
                </span>
              </span>

              {filteredHistory.length > 0 && (
                <button
                  onClick={() => setHistory((prev) => prev.filter((r) => r.category !== selectedCategory))}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-900/50 transition-colors cursor-pointer"
                  title={`Clear ${selectedCategory} roll history`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear {selectedCategory} Log</span>
                </button>
              )}
            </div>

            {/* Results History Scrollable Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0">
              {filteredHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                  <span className="text-3xl mb-2">{currentMeta.icon}</span>
                  <p className="text-sm font-bold text-slate-400">No {selectedCategory} rolls generated yet</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Click <strong>Roll Tremendous {selectedCategory}</strong> or <strong>Roll Critical {selectedCategory}</strong> on the right to trigger a d50 outcome.
                  </p>
                </div>
              ) : (
                filteredHistory.map((res) => (
                  <div
                    key={res.id}
                    className={`p-4 rounded-xl border transition-all ${
                      res.type === 'tremendous'
                        ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/30'
                        : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400 shadow-md shadow-rose-950/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              res.type === 'tremendous'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {res.type === 'tremendous' ? `🌟 Tremendous ${res.category}` : `💀 Critical ${res.category}`} (d50 #{res.rollVal})
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono ml-auto">
                            {res.timestamp}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-100">{res.name}</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{res.effect}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANE (md:col-span-5): Controls Card & Launchers */}
          <div className="md:col-span-5 flex flex-col h-full space-y-6 overflow-y-auto pr-1 min-h-0">
            {/* Primary Action Button 1: Roll Tremendous {Category} */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/30 space-y-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌟</span>
                <div>
                  <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider font-outfit">
                    Tremendous {selectedCategory} (d50)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    High-roll surge effect for natural 20 or critical success on {selectedCategory}.
                  </p>
                </div>
              </div>

              <button
                disabled={isRolling}
                onClick={() => handleRoll('tremendous')}
                className={`w-full py-3 px-4 rounded-xl font-outfit font-extrabold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  isRolling
                    ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20 hover:shadow-amber-500/40 hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                <Dices className="w-4 h-4" />
                <span>Roll Tremendous {selectedCategory}</span>
              </button>
            </div>

            {/* Primary Action Button 2: Roll Critical {Category} */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-rose-500/30 space-y-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">💀</span>
                <div>
                  <h4 className="text-sm font-extrabold text-rose-300 uppercase tracking-wider font-outfit">
                    Critical {selectedCategory} (d50)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Complication or fumble effect for natural 1 or critical failure on {selectedCategory}.
                  </p>
                </div>
              </div>

              <button
                disabled={isRolling}
                onClick={() => handleRoll('critical')}
                className={`w-full py-3 px-4 rounded-xl font-outfit font-extrabold text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  isRolling
                    ? 'bg-rose-600/50 text-rose-200 cursor-not-allowed animate-pulse'
                    : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-500/20 hover:shadow-rose-500/40 hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                <Dices className="w-4 h-4" />
                <span>Roll Critical {selectedCategory}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Glass Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-400">
            Hero: <strong className="text-slate-200">{characterName}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// Backward-compatibility export
export const NishTcModal = TcGeneratorModal;
