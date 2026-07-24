// src/components/sheet/GearCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X, Wrench } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { SimpleGearItem } from '../../types/game';

export const GearCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const gearList: SimpleGearItem[] = activeCharacter?.sheet_data?.simple_gear || [];

  const [showManageModal, setShowManageModal] = useState(false);
  const [newQty, setNewQty] = useState('1');
  const [newName, setNewName] = useState('');
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

  const handleAddGear = () => {
    if (!newName.trim()) return;
    const qtyVal = parseInt(newQty, 10) || 1;
    const newItem: SimpleGearItem = {
      id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      qty: qtyVal,
      name: newName.trim(),
    };

    updateActiveSheetData((prev) => ({
      ...prev,
      simple_gear: [...(prev.simple_gear || []), newItem],
    }));
    saveActiveCharacter();
    setNewName('');
    setNewQty('1');
  };

  const handleUpdateGear = (id: string, updates: Partial<SimpleGearItem>) => {
    updateActiveSheetData((prev) => {
      const updated = (prev.simple_gear || []).map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      return { ...prev, simple_gear: updated };
    });
    saveActiveCharacter();
  };

  const handleRemoveGear = (id: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      simple_gear: (prev.simple_gear || []).filter((item) => item.id !== id),
    }));
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all">
      {/* Title Header */}
      <h3 className="font-outfit font-bold text-sm tracking-widest text-cyan-300 uppercase flex items-center gap-2">
        <span className="text-base">🧰</span>
        Gear
      </h3>

      {/* Manage Gear Trigger Button */}
      <div className="relative">
        <button
          onClick={() => setShowManageModal(!showManageModal)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
            showManageModal
              ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
              : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
          }`}
          title="Manage gear inventory"
        >
          <span className="font-outfit font-bold">Manage Gear</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
            {gearList.length}
          </span>
          {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Floating Manage Gear Modal */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                    Adventuring Gear Inventory
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
                {/* Add New Gear Item */}
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Add Equipment / Item</span>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className="bg-slate-900 text-cyan-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono font-bold outline-none text-center"
                    />
                    <input
                      type="text"
                      placeholder="Item Name / Description (e.g. 50ft Grappling Rope)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="sm:col-span-3 bg-slate-900 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleAddGear}
                      disabled={!newName.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-1.5 rounded-lg border border-cyan-400 disabled:opacity-40 transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Gear List Rows */}
                {gearList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2 text-center">
                    No specific gear listed. Standard adventuring kit assumed.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {gearList.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between gap-3 hover:border-cyan-500/40 transition-all"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[11px] font-bold text-slate-400">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              handleUpdateGear(item.id, { qty: parseInt(e.target.value, 10) || 1 })
                            }
                            className="w-14 bg-slate-900 text-cyan-300 text-xs font-mono font-extrabold px-2 py-1 rounded-lg border border-slate-800 text-center outline-none focus:border-cyan-500"
                          />
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateGear(item.id, { name: e.target.value })}
                            className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-800 outline-none focus:border-cyan-500 flex-1"
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveGear(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                          title="Remove Item"
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
