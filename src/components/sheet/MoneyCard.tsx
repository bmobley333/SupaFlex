// src/components/sheet/MoneyCard.tsx
// Dedicated Card for Currency (Gold & Silver) and Treasure Valuables

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Trash2,
  X,
  Search,
  Sparkles,
  Gem,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { TreasureItem } from '../../types/game';

/**
 * Extracts unit Gold, unit Silver, and total unit Silver (1g = 100s) for a single TreasureItem.
 * Supports both dual gold/silver fields and legacy value/currency fields.
 */
export const getTreasureUnitGoldSilver = (item: TreasureItem) => {
  if (item.gold !== undefined || item.silver !== undefined) {
    const rawGold = Math.max(0, item.gold || 0);
    const rawSilver = Math.max(0, item.silver || 0);
    const unitSilver = rawGold * 100 + rawSilver;
    return {
      gold: Math.floor(unitSilver / 100),
      silver: unitSilver % 100,
      unitSilver,
    };
  }
  const val = Math.max(0, item.value || 0);
  const isGold = item.currency === 'gp' || item.currency === 'g' || !item.currency;
  const unitSilver = isGold ? val * 100 : val;
  return {
    gold: Math.floor(unitSilver / 100),
    silver: unitSilver % 100,
    unitSilver,
  };
};

export const formatGoldSilverLabel = (goldAmt: number, silverAmt: number): string => {
  if (goldAmt > 0 && silverAmt > 0) {
    return `🪙 ${goldAmt}g 🥈 ${silverAmt}s`;
  }
  if (goldAmt > 0) {
    return `🪙 ${goldAmt}g`;
  }
  return `🥈 ${silverAmt}s`;
};

/**
 * Parses treasure item stack value into total silver.
 * Gold (gp/g) = 100 silver. Silver (sp/s) = 1 silver.
 */
export const parseTreasureToSilver = (item: TreasureItem): number => {
  const qty = Math.max(1, item.qty || 1);
  const { unitSilver } = getTreasureUnitGoldSilver(item);
  return qty * unitSilver;
};

/**
 * Calculates total gold and silver value across all treasure items.
 * Enforces 100s = 1g rule so silver never exceeds 99s.
 */
export const calculateTotalTreasureValue = (treasureList: TreasureItem[]) => {
  let totalSilver = 0;
  for (const item of treasureList) {
    totalSilver += parseTreasureToSilver(item);
  }
  const gold = Math.floor(totalSilver / 100);
  const silver = totalSilver % 100;
  return { gold, silver, totalSilver };
};

interface MoneyCardProps {
  className?: string;
}

export const MoneyCard: React.FC<MoneyCardProps> = ({ className = '' }) => {
  const {
    activeCharacter,
    updateActiveSheetData,
    saveActiveCharacter,
    isMoneyValuablesModalOpen,
    setMoneyValuablesModalOpen,
    setGearManagerModalOpen,
  } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const gold = sheet?.gold ?? 5;
  const silver = sheet?.silver ?? 50;
  const treasure: TreasureItem[] = sheet?.other_treasure || [];

  const modalRef = useRef<HTMLDivElement>(null);

  // Search & Filter State
  const [treasureSearchQuery, setTreasureSearchQuery] = useState<string>('');

  // Custom Treasure Form State (Dual Gold & Silver starting at 0 in each)
  const [customName, setCustomName] = useState<string>('');
  const [customGold, setCustomGold] = useState<number>(0);
  const [customSilver, setCustomSilver] = useState<number>(0);
  const [customQty, setCustomQty] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Calculate total treasure value (gold & silver, 100s = 1g)
  const treasureTotalValue = useMemo(() => calculateTotalTreasureValue(treasure), [treasure]);

  // Click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setMoneyValuablesModalOpen(false);
      }
    };
    if (isMoneyValuablesModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoneyValuablesModalOpen, setMoneyValuablesModalOpen]);

  // Filtered active character treasure inventory
  const filteredTreasure = useMemo(() => {
    if (!treasureSearchQuery.trim()) return treasure;
    const query = treasureSearchQuery.toLowerCase();
    return treasure.filter((item) => item.name.toLowerCase().includes(query));
  }, [treasure, treasureSearchQuery]);

  // Add new treasure item
  const handleCreateTreasure = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = customName.trim();
    if (!trimmedName) {
      setFormError('Treasure name is required.');
      return;
    }

    const goldInt = Math.max(0, customGold || 0);
    const silverInt = Math.max(0, customSilver || 0);
    if (goldInt <= 0 && silverInt <= 0) {
      setFormError('Enter at least 1 Gold or 1 Silver value.');
      return;
    }

    const qtyInt = Math.max(1, customQty || 1);
    const normalizedUnitSilver = goldInt * 100 + silverInt;

    const newItem: TreasureItem = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      gold: Math.floor(normalizedUnitSilver / 100),
      silver: normalizedUnitSilver % 100,
      value: silverInt === 0 ? goldInt : normalizedUnitSilver,
      currency: silverInt === 0 ? 'gp' : 'sp',
      qty: qtyInt,
    };

    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: [...(prev.other_treasure || []), newItem],
    }));
    saveActiveCharacter();

    // Reset form back to 0 Gold & 0 Silver
    setCustomName('');
    setCustomGold(0);
    setCustomSilver(0);
    setCustomQty(1);
    setFormError(null);
  };

  const handleDeleteTreasure = (id: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: (prev.other_treasure || []).filter((t) => t.id !== id),
    }));
    saveActiveCharacter();
  };

  const handleUpdateQty = (id: string, delta: number) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: (prev.other_treasure || []).map((t) => {
        if (t.id === id) {
          const newQty = Math.max(1, (t.qty || 1) + delta);
          return { ...t, qty: newQty };
        }
        return t;
      }),
    }));
    saveActiveCharacter();
  };

  const handleSellTreasure = (item: TreasureItem, sellQty: number) => {
    const currentQty = Math.max(1, item.qty || 1);
    const actualSellQty = Math.min(currentQty, Math.max(1, sellQty));
    const { unitSilver } = getTreasureUnitGoldSilver(item);
    const saleSilver = unitSilver * actualSellQty;

    updateActiveSheetData((prev) => {
      const prevGold = prev.gold ?? 5;
      const prevSilver = prev.silver ?? 50;
      const addedGold = Math.floor(saleSilver / 100);
      const addedSilver = saleSilver % 100;
      const totalSilverPool = prevSilver + addedSilver;
      const newGold = prevGold + addedGold + Math.floor(totalSilverPool / 100);
      const newSilver = totalSilverPool % 100;

      const currentList = prev.other_treasure || [];
      const updatedTreasure =
        actualSellQty >= currentQty
          ? currentList.filter((t) => t.id !== item.id)
          : currentList.map((t) =>
              t.id === item.id ? { ...t, qty: currentQty - actualSellQty } : t
            );

      return {
        ...prev,
        gold: newGold,
        silver: newSilver,
        other_treasure: updatedTreasure,
      };
    });
    saveActiveCharacter();
  };

  return (
    <>
      <div className={`bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-amber-400/90 p-3 flex items-center justify-between transition-all gap-2.5 flex-wrap shadow-lg shadow-amber-950/20 ${className}`}>
        {/* Left: Title */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMoneyValuablesModalOpen(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Money & Valuables Manager"
          >
            <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)] group-hover:scale-105 group-hover:border-amber-400 transition-all">
              <span className="text-base leading-none">💰</span>
            </div>
            <span className="font-outfit font-extrabold text-xs tracking-wider text-amber-200 uppercase group-hover:text-white transition-colors">
              Money & Valuables
            </span>
          </button>
        </div>

        {/* Center: Quick Coin Displays */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold flex-1 min-w-0 flex-wrap">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-950/80 border border-slate-800 rounded-lg text-amber-300 shrink-0">
            <span>Gold 🪙</span>
            <span className="text-white font-extrabold">{gold}</span>
          </div>

          <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300 shrink-0">
            <span>Silver 🥈</span>
            <span className="text-white font-extrabold">{silver}</span>
          </div>
        </div>

        {/* Right: Treasure / Valuables Action Button */}
        <button
          type="button"
          onClick={() => setMoneyValuablesModalOpen(true)}
          className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm bg-amber-950/80 hover:bg-amber-900/90 border-amber-500/40 hover:border-amber-400 text-amber-200 hover:text-white cursor-pointer shrink-0 group"
          title="Open Money & Valuables Manager"
        >
          <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
        </button>
      </div>

      {/* 💰 MONEY & TREASURE VALUABLES MODAL */}
      {isMoneyValuablesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-left"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2.5 shrink-0">
              {/* Top Row: Title/Subtitle on Left, GO TO: GEAR MANAGER + X in Upper Right */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                    <span className="text-lg leading-none">💰</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                      Money & Valuables Manager
                    </h3>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Manage currency, trade goods, precious gems, and treasure valuables.
                    </p>
                  </div>
                </div>

                {/* Upper Right: GO TO: GEAR MANAGER adjacent to Close X */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMoneyValuablesModalOpen(false);
                      setGearManagerModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-teal-950/90 hover:bg-teal-900/90 border border-teal-500/50 hover:border-teal-400 text-teal-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 group"
                    title="Jump directly to Gear Manager"
                  >
                    <span className="text-teal-300/90 font-outfit uppercase tracking-wider text-[10px] font-extrabold">Go to:</span>
                    <span className="text-sm leading-none group-hover:scale-110 transition-transform">⚙️</span>
                    <span className="font-outfit uppercase tracking-wider text-[11px] font-extrabold">Gear Manager</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMoneyValuablesModalOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
                    title="Close Money & Valuables Manager"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Coin Totals Pill */}
              <div className="flex items-center">
                <div className="flex items-center gap-3 px-3 py-1 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-300">Gold 🪙:</span>
                    <input
                      type="number"
                      min="0"
                      value={gold}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        updateActiveSheetData((prev) => ({ ...prev, gold: val }));
                        saveActiveCharacter();
                      }}
                      className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-300">Silver 🥈:</span>
                    <input
                      type="number"
                      min="0"
                      value={silver}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        updateActiveSheetData((prev) => ({ ...prev, silver: val }));
                        saveActiveCharacter();
                      }}
                      className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2-Column Split-Pane Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
              {/* Left Pane: Treasure Inventory */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Gem className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-outfit font-bold uppercase tracking-wider text-amber-300">
                      Valuables ({treasure.length})
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={treasureSearchQuery}
                      onChange={(e) => setTreasureSearchQuery(e.target.value)}
                      className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-amber-500 w-24 sm:w-28"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2 min-h-0">
                  {filteredTreasure.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                      <Gem className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                      <span>No treasure valuables found. Add items on the right.</span>
                    </div>
                  ) : (
                    filteredTreasure.map((item) => {
                      const qty = Math.max(1, item.qty || 1);
                      const unit = getTreasureUnitGoldSilver(item);
                      const stackSilver = qty * unit.unitSilver;
                      const stackGold = Math.floor(stackSilver / 100);
                      const stackRemSilver = stackSilver % 100;

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2 shadow-sm flex-wrap"
                        >
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300/90 font-semibold flex-wrap">
                              <span>{formatGoldSilverLabel(unit.gold, unit.silver)} each</span>
                              {qty > 1 && (
                                <span className="text-emerald-300/90">
                                  • Total: {formatGoldSilverLabel(stackGold, stackRemSilver)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Sell Buttons, Qty & Delete */}
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {qty > 1 && (
                              <button
                                type="button"
                                onClick={() => handleSellTreasure(item, 1)}
                                className="px-2 py-1 rounded-lg bg-amber-950/90 hover:bg-amber-800/90 border border-amber-500/50 hover:border-amber-400 text-amber-200 hover:text-white text-[11px] font-outfit font-extrabold tracking-wide transition-all cursor-pointer shadow-sm"
                                title={`Sell 1 ${item.name} for ${formatGoldSilverLabel(unit.gold, unit.silver)}`}
                              >
                                🪙 Sell 1
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSellTreasure(item, qty)}
                              className="px-2 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-800/90 border border-emerald-500/50 hover:border-emerald-400 text-emerald-200 hover:text-white text-[11px] font-outfit font-extrabold tracking-wide transition-all cursor-pointer shadow-sm"
                              title={`Sell all (${qty}× ${item.name}) for ${formatGoldSilverLabel(stackGold, stackRemSilver)}`}
                            >
                              🪙 Sell All
                            </button>

                            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-1 py-0.5 text-xs font-mono font-bold">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, -1)}
                                className="px-1 hover:text-amber-400 text-slate-400 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="px-1 text-white">{qty}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(item.id, 1)}
                                className="px-1 hover:text-amber-400 text-slate-400 cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteTreasure(item.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete treasure item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pinned Valuables Total Value Footer inside Left-Pane Card */}
                <div className="mt-2 pt-2.5 border-t border-slate-800/80 flex items-center justify-between shrink-0">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono font-bold text-amber-300 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 w-full">
                    <span className="text-slate-400 font-sans font-semibold text-[11px]">Valuables Total Value:</span>
                    <div className="flex items-center gap-2">
                      <span>🪙 {treasureTotalValue.gold}g</span>
                      <span>•</span>
                      <span>🥈 {treasureTotalValue.silver}s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Pane: Custom Treasure Creator Form */}
              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 flex flex-col h-full min-h-0 overflow-y-auto shadow-inner">
                <h4 className="font-outfit font-bold text-xs uppercase tracking-wider text-amber-300 pb-2 border-b border-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Add Custom Valuables / Gems
                </h4>

                <form onSubmit={handleCreateTreasure} className="flex flex-col gap-3 mt-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-300">Valuable Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flawless Ruby, Silver Chalice..."
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Dual Gold & Silver Card (Matching Top Header UI, Scoped to New Valuable) */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-300">Unit Value (Each)</label>
                    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs font-bold shadow-inner">
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-300">Gold 🪙:</span>
                        <input
                          type="number"
                          min="0"
                          value={customGold}
                          onChange={(e) => setCustomGold(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300">Silver 🥈:</span>
                        <input
                          type="number"
                          min="0"
                          value={customSilver}
                          onChange={(e) => setCustomSilver(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold outline-none focus:border-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Inline Quantity Input */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs font-bold shadow-inner">
                    <label className="text-xs font-sans font-bold text-slate-300">Quantity (Qty):</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={customQty}
                      onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-white font-bold outline-none focus:border-amber-500"
                    />
                  </div>

                  {formError && (
                    <span className="text-xs text-rose-400 font-semibold">{formError}</span>
                  )}

                  <button
                    type="submit"
                    className="mt-1 py-2 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-md cursor-pointer font-outfit"
                  >
                    + Add Treasure Valuables
                  </button>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setMoneyValuablesModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700 transition shadow-sm cursor-pointer text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
