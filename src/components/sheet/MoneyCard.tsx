// src/components/sheet/MoneyCard.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Coins,
  Search,
  Check,
  AlertCircle,
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
  const [inventorySearchQuery, setInventorySearchQuery] = useState<string>('');

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
    if (!inventorySearchQuery.trim()) return treasure;
    const query = inventorySearchQuery.toLowerCase();
    return treasure.filter((item) => item.name.toLowerCase().includes(query));
  }, [treasure, inventorySearchQuery]);

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
    setCustomQty(1);
  };

  // Update item attribute or quantity
  const handleUpdateTreasure = (id: string, updates: Partial<TreasureItem>) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: (prev.other_treasure || []).map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
    saveActiveCharacter();
  };

  // Remove treasure item
  const handleRemoveTreasure = (id: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: (prev.other_treasure || []).filter((t) => t.id !== id),
    }));
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between gap-3 transition-all">
      {/* Title & Quick Currency Counters */}
      <div className="flex items-center gap-3">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-amber-300 uppercase flex items-center gap-1.5 shrink-0">
          <span className="text-base">💰</span>
          Money
        </h3>

        {/* Gold & Silver Inline Counters */}
        <div className="flex items-center gap-3">
          {/* Gold Counter */}
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1 mr-1">
              <span>Gold</span>
              <span>🪙</span>
            </span>
            <input
              type="number"
              min="0"
              value={gold}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateActiveSheetData((prev) => ({
                  ...prev,
                  gold: isNaN(val) ? 0 : Math.max(0, val),
                }));
                saveActiveCharacter();
              }}
              className="w-12 bg-transparent text-amber-300 text-xs font-mono font-extrabold text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Silver Counter */}
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1 mr-1">
              <span>Silver</span>
              <span>🥈</span>
            </span>
            <input
              type="number"
              min="0"
              value={silver}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateActiveSheetData((prev) => ({
                  ...prev,
                  silver: isNaN(val) ? 0 : Math.max(0, val),
                }));
                saveActiveCharacter();
              }}
              className="w-12 bg-transparent text-slate-200 text-xs font-mono font-extrabold text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Manage Treasure Trigger Button & Total Value Pill */}
      <div className="flex items-center gap-2 shrink-0">
        {treasureTotalValue.totalSilver > 0 && (
          <div
            className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 bg-slate-950/80 rounded-md border border-slate-800 text-amber-300"
            title="Total Treasure Value (100s = 1g)"
          >
            <span>🪙 {treasureTotalValue.gold}g</span>
            <span>🥈 {treasureTotalValue.silver}s</span>
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
            }`}
            title="Manage ad-lib treasure and items"
          >
            <span className="font-outfit font-bold">Treasure</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {treasure.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

        {/* MASTER 2-COLUMN SPLIT-PANE GLASSMORPHIC MODAL */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-left"
            >
              {/* Pillar 1: Header Architecture */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300 flex items-center justify-center">
                    <span className="text-lg leading-none">💰</span>
                  </div>
                  <div>
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                      Treasure Manager
                    </h3>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Manage character gems, art, relics, and ad-lib treasure side-by-side with the treasure creator.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Pillar 2: 2-COLUMN SPLIT-PANE BODY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                
                {/* --- LEFT COLUMN: TREASURE INVENTORY PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  {/* Pane Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Gem className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-outfit font-bold uppercase tracking-wider text-amber-300">
                        Inventory
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                        {treasure.length}
                      </span>
                    </div>

                    {/* Inventory Search Filter */}
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={inventorySearchQuery}
                        onChange={(e) => setInventorySearchQuery(e.target.value)}
                        className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-amber-500 w-24 sm:w-28"
                      />
                    </div>
                  </div>

                  {/* Scrollable Inventory Items List */}
                  <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-1.5 min-h-0">
                    {filteredTreasure.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                        <Coins className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                        {inventorySearchQuery ? (
                          <span>No treasure matching "{inventorySearchQuery}"</span>
                        ) : (
                          <span>No extra treasure recorded yet.</span>
                        )}
                      </div>
                    ) : (
                      filteredTreasure.map((item) => (
                        <div
                          key={item.id}
                          className="p-2 bg-slate-900/90 rounded-lg border border-slate-800/90 flex items-center justify-between gap-2 hover:border-amber-500/40 transition-all shrink-0"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="number"
                              min="1"
                              value={item.qty || 1}
                              onChange={(e) =>
                                handleUpdateTreasure(item.id, {
                                  qty: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })
                              }
                              className="w-11 bg-slate-950 text-amber-300 text-xs font-mono font-extrabold px-1 py-1 rounded border border-slate-800 text-center outline-none focus:border-amber-500 shrink-0"
                              title="Quantity"
                            />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-semibold text-slate-100 truncate">
                                {item.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-amber-400 font-mono font-bold">
                                  {item.value} {item.currency}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRemoveTreasure(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all shrink-0"
                            title="Remove Treasure"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* --- RIGHT COLUMN: TREASURE CREATOR FORM PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
                    <span className="text-xs font-outfit font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Add Valuable / Gem
                    </span>
                  </div>

                  <form
                    onSubmit={handleCreateTreasure}
                    className="flex-1 flex flex-col justify-between mt-2.5 overflow-y-auto pr-1 gap-3"
                  >
                    <div className="flex flex-col gap-3">
                      {formError && (
                        <div className="p-2 bg-rose-950/60 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {/* Guardrail 1: Treasure Name */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                          Treasure Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Ruby Statue, Golden Goblet"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="bg-slate-900 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
                          required
                        />
                      </div>

                      {/* Guardrail 2: Quantity & Value Inputs */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Quantity */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                            Quantity <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={customQty}
                            onChange={(e) =>
                              setCustomQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                            }
                            className="bg-slate-900 text-amber-300 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 text-center"
                            required
                          />
                        </div>

                        {/* Value & Currency Unit */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                            Value per Item <span className="text-rose-400">*</span>
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={customValue}
                              onChange={(e) =>
                                setCustomValue(Math.max(1, parseInt(e.target.value, 10) || 1))
                              }
                              className="w-full bg-slate-900 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 text-center"
                              required
                            />
                            <select
                              value={customCurrency}
                              onChange={(e) => setCustomCurrency(e.target.value as 'gp' | 'sp')}
                              className="bg-slate-900 text-amber-300 font-mono font-bold text-xs px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
                            >
                              <option value="gp">gp</option>
                              <option value="sp">sp</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Custom Form Action Button */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={!customName.trim()}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-outfit font-bold text-xs px-4 py-2 rounded-lg border border-amber-400 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-md shadow-amber-950"
                      >
                        <Check className="w-4 h-4" />
                        Save Treasure & Add to Sheet
                      </button>
                    </div>
                  </form>
                </div>

              </div>

              {/* Pillar 3: Streamlined UI DRY Footer Architecture */}
              <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-slate-400 font-sans font-semibold text-[11px]">Total Treasure Value:</span>
                  <span>🪙 {treasureTotalValue.gold}g</span>
                  <span>🥈 {treasureTotalValue.silver}s</span>
                </div>

                <button
                  onClick={() => setShowManageModal(false)}
                  className="px-4 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
