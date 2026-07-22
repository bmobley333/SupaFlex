// src/components/sheet/EquipmentGrid.tsx
import React from 'react';
import { ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { EquipmentSlot } from '../../types/game';

export const EquipmentGrid: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const gearSlots: EquipmentSlot[] = activeCharacter?.sheet_data?.gear_slots || [];

  const handleGearChange = (index: number, updates: Partial<EquipmentSlot>) => {
    updateActiveSheetData((prev) => {
      const updatedSlots = [...(prev.gear_slots || [])];
      updatedSlots[index] = { ...updatedSlots[index], ...updates };
      return { ...prev, gear_slots: updatedSlots };
    });
    saveActiveCharacter();
  };

  const handleAddGear = () => {
    updateActiveSheetData((prev) => {
      const updatedSlots: EquipmentSlot[] = [
        ...(prev.gear_slots || []),
        { name: '', type: 'gear', armor_bonus: 0, defense_bonus: 0, usage: '', effect: '', checked: [false, false, false] },
      ];
      return { ...prev, gear_slots: updatedSlots };
    });
    saveActiveCharacter();
  };

  const handleRemoveGear = (index: number) => {
    updateActiveSheetData((prev) => {
      const updatedSlots = [...(prev.gear_slots || [])];
      updatedSlots.splice(index, 1);
      return { ...prev, gear_slots: updatedSlots };
    });
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          Equipment & Inventory Slots
        </h3>
        <button
          onClick={handleAddGear}
          className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded border border-indigo-500/30 flex items-center gap-1 transition-all"
        >
          <Plus className="w-3 h-3" />
          Add Item
        </button>
      </div>

      {/* Equipment List */}
      <div className="flex flex-col gap-2">
        {gearSlots.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-2">No equipment added yet. Click 'Add Item' to equip weapons or armor.</p>
        ) : (
          gearSlots.map((item, index) => (
            <div
              key={index}
              className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex flex-col md:flex-row items-start md:items-center gap-3"
            >
              {/* Item Name */}
              <input
                type="text"
                placeholder="Item Name (e.g. Iron Shield)"
                value={item.name}
                onChange={(e) => handleGearChange(index, { name: e.target.value })}
                className="bg-slate-900 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none w-full md:w-1/3 focus:border-indigo-500"
              />

              {/* Type Dropdown */}
              <select
                value={item.type}
                onChange={(e) => handleGearChange(index, { type: e.target.value as any })}
                className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="weapon">Weapon ⚔️</option>
                <option value="armor">Armor 🛡️</option>
                <option value="consumable">Consumable 🧪</option>
                <option value="gear">Gear 🎒</option>
              </select>

              {/* Armor Bonus */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Armor:</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={item.armor_bonus || 0}
                  onChange={(e) => handleGearChange(index, { armor_bonus: parseInt(e.target.value) || 0 })}
                  className="w-12 bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-center rounded py-1 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Defense Bonus */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Def+:</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={item.defense_bonus || 0}
                  onChange={(e) => handleGearChange(index, { defense_bonus: parseInt(e.target.value) || 0 })}
                  className="w-12 bg-slate-900 border border-slate-800 text-indigo-300 font-mono text-center rounded py-1 outline-none focus:border-indigo-500"
                />
              </div>

              {/* Effect */}
              <input
                type="text"
                placeholder="Effect or stats..."
                value={item.effect || ''}
                onChange={(e) => handleGearChange(index, { effect: e.target.value })}
                className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none flex-1 w-full focus:border-indigo-500"
              />

              {/* Delete Button */}
              <button
                onClick={() => handleRemoveGear(index)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                title="Remove Item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
