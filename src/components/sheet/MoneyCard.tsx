// src/components/sheet/MoneyCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X, Coins } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { TreasureItem } from '../../types/game';

export const MoneyCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const sheet = activeCharacter?.sheet_data;

  const gold = sheet?.gold ?? 0;
  const silver = sheet?.silver ?? 0;
  const treasure: TreasureItem[] = sheet?.other_treasure || [];

  const [showManageModal, setShowManageModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemCurrency, setNewItemCurrency] = useState<'gp' | 'sp'>('gp');
  const modalRef = useRef<HTMLDivElement>(null);

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

  const handleGoldChange = (delta: number) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      gold: Math.max(0, (prev.gold ?? 0) + delta),
    }));
    saveActiveCharacter();
  };

  const handleSilverChange = (delta: number) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      silver: Math.max(0, (prev.silver ?? 0) + delta),
    }));
    saveActiveCharacter();
  };

  const handleAddTreasure = () => {
    if (!newItemName.trim()) return;
    const val = parseInt(newItemValue, 10) || 0;
    const newItem: TreasureItem = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newItemName.trim(),
      value: val,
      currency: newItemCurrency,
    };

    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: [...(prev.other_treasure || []), newItem],
    }));
    saveActiveCharacter();
    setNewItemName('');
    setNewItemValue('');
  };

  const handleRemoveTreasure = (id: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      other_treasure: (prev.other_treasure || []).filter((t) => t.id !== id),
    }));
    saveActiveCharacter();
  };

  // Calculate totals
  const totalOtherGp = treasure.reduce((acc, t) => (t.currency === 'gp' ? acc + t.value : acc), 0);
  const totalOtherSp = treasure.reduce((acc, t) => (t.currency === 'sp' ? acc + t.value : acc), 0);

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
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <span>Gold</span>
              <span>🪙</span>
            </span>
            <button
              onClick={() => handleGoldChange(-1)}
              className="w-4 h-4 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center border border-slate-700 ml-1"
            >
              -
            </button>
            <input
              type="number"
              min="0"
              value={gold}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateActiveSheetData((prev) => ({ ...prev, gold: isNaN(val) ? 0 : Math.max(0, val) }));
                saveActiveCharacter();
              }}
              className="w-10 bg-transparent text-amber-300 text-xs font-mono font-extrabold text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => handleGoldChange(1)}
              className="w-4 h-4 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center border border-slate-700"
            >
              +
            </button>
          </div>

          {/* Silver Counter */}
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <span>Silver</span>
              <span>🥈</span>
            </span>
            <button
              onClick={() => handleSilverChange(-1)}
              className="w-4 h-4 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-700 ml-1"
            >
              -
            </button>
            <input
              type="number"
              min="0"
              value={silver}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                updateActiveSheetData((prev) => ({ ...prev, silver: isNaN(val) ? 0 : Math.max(0, val) }));
                saveActiveCharacter();
              }}
              className="w-10 bg-transparent text-slate-200 text-xs font-mono font-extrabold text-center outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => handleSilverChange(1)}
              className="w-4 h-4 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center border border-slate-700"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Manage Treasure Trigger Button */}
      <div className="relative shrink-0">
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

        {/* Floating Manage Treasure Modal */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                    Ad-Lib Treasure & Valuables
                  </h3>
                </div>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 overflow-y-auto flex flex-col gap-4">
                {/* Total Treasure Summary */}
                <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-500/30 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Total Extra Treasure Value:</span>
                  <div className="text-xs font-mono font-extrabold flex items-center gap-3 text-slate-100">
                    <span className="text-amber-300">{totalOtherGp} gp</span>
                    <span>•</span>
                    <span className="text-slate-300">{totalOtherSp} sp</span>
                  </div>
                </div>

                {/* Add New Treasure Form */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Add Valuable / Gem</span>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="text"
                      placeholder="Treasure Name (e.g. Ruby Statue)"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      className="sm:col-span-2 bg-slate-900 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Value"
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      className="bg-slate-900 text-amber-300 text-xs px-2 py-1.5 rounded-lg border border-slate-700 font-mono outline-none text-center"
                    />
                    <select
                      value={newItemCurrency}
                      onChange={(e) => setNewItemCurrency(e.target.value as 'gp' | 'sp')}
                      className="bg-slate-900 text-slate-200 text-xs px-2 py-1.5 rounded-lg border border-slate-700 font-mono font-bold outline-none cursor-pointer"
                    >
                      <option value="gp">gp</option>
                      <option value="sp">sp</option>
                    </select>
                    <button
                      onClick={handleAddTreasure}
                      disabled={!newItemName.trim()}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-1.5 rounded-lg border border-amber-400 disabled:opacity-40 transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Treasure List */}
                {treasure.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    No extra treasure recorded yet. Add gems, statues, or relics above.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {treasure.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between hover:border-amber-500/40 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-100">{item.name}</span>
                          <span className="text-xs font-mono font-bold text-amber-300 px-2 py-0.5 bg-slate-900 rounded border border-slate-750">
                            {item.value} {item.currency}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveTreasure(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                          title="Remove Treasure"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
