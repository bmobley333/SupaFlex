// src/components/sheet/ShieldCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ShieldData } from '../../types/game';

const SHIELD_BLOCK_OPTIONS = [12, 16, 20, 24, 28];

const STOCK_SHIELDS: Omit<ShieldData, 'equipped'>[] = [
  { name: 'Wooden Buckler', sk: false, max_block: 12, effect: 'Light Parry Shield' },
  { name: 'Iron Heater Shield', sk: true, max_block: 16, effect: 'Standard Combat Shield' },
  { name: 'Tower Shield', sk: true, max_block: 24, effect: 'Heavy Coverage Greatshield' },
];

export const ShieldCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const shield: ShieldData = activeCharacter?.sheet_data?.shield_slot || {
    equipped: false,
    name: 'Iron Shield',
    sk: true,
    max_block: 16,
  };

  const [showManageModal, setShowManageModal] = useState(false);
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

  const handleShieldUpdate = (updates: Partial<ShieldData>) => {
    updateActiveSheetData((prev) => {
      const updatedShield = { ...(prev.shield_slot || shield), ...updates };
      return {
        ...prev,
        shield_slot: updatedShield,
      };
    });
    saveActiveCharacter();
  };

  const handleEquipStockShield = (selected: Omit<ShieldData, 'equipped'>) => {
    handleShieldUpdate({ ...selected, equipped: true });
    setShowManageModal(false);
  };

  const handleUnequipShield = () => {
    handleShieldUpdate({ equipped: false });
    setShowManageModal(false);
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3 transition-all">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-cyan-300 uppercase flex items-center gap-2">
            <span className="text-base">🛡️</span>
            Shield
          </h3>
          {!shield.equipped && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded-full border border-slate-800">
              No Shield Equipped
            </span>
          )}
        </div>

        {/* Manage Shields Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
                : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
            }`}
            title="Manage equipped shield"
          >
            <span className="font-outfit font-bold">Manage Shields</span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Manage Shields Floating Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Manage Shields Catalog
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
                  {/* Active Unequip Action if equipped */}
                  {shield.equipped && (
                    <div className="p-3 bg-cyan-950/40 rounded-xl border border-cyan-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛡️</span>
                        <div>
                          <span className="font-bold text-xs text-slate-100 block">{shield.name}</span>
                          <span className="text-[11px] text-cyan-300 font-mono">Currently Equipped</span>
                        </div>
                      </div>
                      <button
                        onClick={handleUnequipShield}
                        className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/40 flex items-center gap-1 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Unequip Shield
                      </button>
                    </div>
                  )}

                  {/* Stock Shields List */}
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Standard Shields</span>
                  <div className="flex flex-col gap-2">
                    {STOCK_SHIELDS.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between hover:border-cyan-500/40 transition-all"
                      >
                        <div>
                          <span className="font-bold text-xs text-slate-100 block">{item.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                            <span>Max Block 🛡️: {item.max_block}</span>
                            <span>•</span>
                            <span>{item.effect}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleEquipStockShield(item)}
                          className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-bold rounded-lg border border-cyan-500/40 flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Equip
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single-Row Shield Controls (Visible when equipped) */}
      {shield.equipped && (
        <div className="flex items-center gap-3 pt-1 animate-fadeIn">
          {/* Sk Label + Checkbox (Left of Name) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label htmlFor="shield-sk" className="text-xs font-bold text-slate-300 cursor-pointer">
              Sk
            </label>
            <input
              type="checkbox"
              checked={shield.sk}
              onChange={(e) => handleShieldUpdate({ sk: e.target.checked })}
              className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500/20 bg-slate-900 cursor-pointer"
              id="shield-sk"
            />
          </div>

          {/* Name Text Input (Center - Bounded max width to prevent stretching) */}
          <input
            type="text"
            value={shield.name}
            onChange={(e) => handleShieldUpdate({ name: e.target.value })}
            placeholder="Shield Name (e.g. Wooden Buckler)"
            className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 outline-none w-full max-w-[240px] focus:border-cyan-500"
          />

          {/* Max Block Dropdown (Right side: 12, 16, 20, 24, 28) */}
          <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-slate-300">Max Block</span>
            <span className="text-sm">🛡️</span>
            <select
              value={shield.max_block || 16}
              onChange={(e) => handleShieldUpdate({ max_block: parseInt(e.target.value) || 16 })}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-extrabold text-cyan-300 text-center outline-none focus:border-cyan-400 cursor-pointer"
            >
              {SHIELD_BLOCK_OPTIONS.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
