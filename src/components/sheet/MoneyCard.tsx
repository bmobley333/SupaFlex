// src/components/sheet/MoneyCard.tsx
// Dedicated Card for Currency (Gold & Silver) and Treasure Valuables

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  Trash2,
  X,
  Search,
  Sparkles,
  Gem,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { TreasureItem } from '../../types/game';

/**
 * Parses treasure item value into total silver.
 * Gold (gp/g) = 100 silver. Silver (sp/s) = 1 silver.
 */
export const parseTreasureToSilver = (item: TreasureItem): number => {
  const qty = Math.max(1, item.qty || 1);
  const val = Math.max(0, item.value || 0);
  const isGold = item.currency === 'gp' || item.currency === 'g';
  const itemSilver = isGold ? val * 100 : val;
  return qty * itemSilver;
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

export const MoneyCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const gold = sheet?.gold ?? 0;
  const silver = sheet?.silver ?? 0;
  const treasure: TreasureItem[] = sheet?.other_treasure || [];

  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Search & Filter State
  const [treasureSearchQuery, setTreasureSearchQuery] = useState<string>('');

  // Custom Treasure Form State
  const [customName, setCustomName] = useState<string>('');
  const [customValue, setCustomValue] = useState<number>(10);
  const [customCurrency, setCustomCurrency] = useState<'gp' | 'sp'>('gp');
  const [customQty, setCustomQty] = useState<number>(1);
  const [formError, setFormError] = useState<string | null>(null);

  // Calculate total treasure value (gold & silver, 100s = 1g)
  const treasureTotalValue = useMemo(() => calculateTotalTreasureValue(treasure), [treasure]);

  // Click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowManageModal(false);
      }
    };
    if (showManageModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);

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

    const valInt = Math.max(1, customValue);
    const qtyInt = Math.max(1, customQty);

    const newItem: TreasureItem = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      value: valInt,
      currency: customCurrency,
      qty: qtyInt,
    };

    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: [...(prev.other_treasure || []), newItem],
    }));
    saveActiveCharacter();

    // Reset form
    setCustomName('');
    setCustomValue(10);
    setCustomCurrency('gp');
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

  return (
    <>
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all gap-3">
        {/* Left: Title & Quick Coin Displays */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-base">💰</span>
            <span className="font-outfit font-bold text-xs tracking-wider text-amber-300 uppercase">
              Money
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-950/80 border border-slate-800 rounded-lg text-amber-300">
              <span>Gold 🪙</span>
              <span className="text-white font-extrabold">{gold}</span>
            </div>

            <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-950/80 border border-slate-800 rounded-lg text-slate-300">
              <span>Silver 🥈</span>
              <span className="text-white font-extrabold">{silver}</span>
            </div>
          </div>
        </div>

        {/* Right: Treasure / Valuables Trigger Button */}
        <button
          type="button"
          onClick={() => setShowManageModal(true)}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1 shadow-sm bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/35 text-amber-300 cursor-pointer shrink-0"
          title="Manage Money & Valuables"
        >
          <span className="font-outfit font-bold">Treasure</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-amber-900/80 rounded text-amber-200">
            {treasure.length}
          </span>
          <ChevronDown className="w-3 h-3 text-amber-400" />
        </button>
      </div>

      {/* 💰 MONEY & TREASURE VALUABLES MODAL */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div
            ref={modalRef}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-left"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300 flex items-center justify-center">
                  <span className="text-lg leading-none">💰</span>
                </div>
                <div>
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                    Money & Valuables
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Manage currency, trade goods, precious gems, and treasure valuables.
                  </p>
                </div>
              </div>

              {/* Coin Totals Pill in Header */}
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

              <button
                onClick={() => setShowManageModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
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
                    filteredTreasure.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between gap-2 shadow-sm"
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-outfit font-bold text-xs text-slate-100 truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-amber-300/90 font-semibold">
                            {item.value} {item.currency === 'gp' ? '🪙 gp' : '🥈 sp'} each
                          </span>
                        </div>

                        {/* Qty & Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-1 py-0.5 text-xs font-mono font-bold">
                            <button
                              onClick={() => handleUpdateQty(item.id, -1)}
                              className="px-1 hover:text-amber-400 text-slate-400"
                            >
                              -
                            </button>
                            <span className="px-1 text-white">{item.qty || 1}</span>
                            <button
                              onClick={() => handleUpdateQty(item.id, 1)}
                              className="px-1 hover:text-amber-400 text-slate-400"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => handleDeleteTreasure(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete treasure item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
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

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-300">Value</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={customValue}
                        onChange={(e) => setCustomValue(parseInt(e.target.value) || 1)}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white text-center focus:outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-300">Currency</label>
                      <select
                        value={customCurrency}
                        onChange={(e) => setCustomCurrency(e.target.value as 'gp' | 'sp')}
                        className="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="gp">🪙 Gold (gp)</option>
                        <option value="sp">🥈 Silver (sp)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-300">Qty</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={customQty}
                        onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white text-center focus:outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {formError && (
                    <span className="text-xs text-rose-400 font-semibold">{formError}</span>
                  )}

                  <button
                    type="submit"
                    className="mt-2 py-2 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-md cursor-pointer font-outfit"
                  >
                    + Add Treasure Valuables
                  </button>
                </form>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-sans font-semibold text-[11px]">Treasure Total Value:</span>
                <span>🪙 {treasureTotalValue.gold}g</span>
                <span>•</span>
                <span>🥈 {treasureTotalValue.silver}s</span>
              </div>

              <button
                onClick={() => setShowManageModal(false)}
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
