// src/components/sheet/AbilitySlotsGrid.tsx
import React from 'react';
import { Zap, ArrowUpDown, Plus, Trash2, Sparkles } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AbilitySlot } from '../../types/game';

interface AbilitySlotsGridProps {
  title: string;
  type: 'powers' | 'spells';
}

const ACTION_COLORS: Record<string, string> = {
  AM: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  A: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  M: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  P: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  F: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

const ACTION_ORDER: Record<string, number> = {
  AM: 0,
  A: 1,
  M: 2,
  P: 3,
  F: 4,
};

export const AbilitySlotsGrid: React.FC<AbilitySlotsGridProps> = ({ title, type }) => {
  const { activeCharacter, powers, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const slotKey = type === 'powers' ? 'power_slots' : 'spell_slots';
  const slots: AbilitySlot[] = activeCharacter?.sheet_data?.[slotKey] || [];

  const handleSlotChange = (index: number, updates: Partial<AbilitySlot>) => {
    updateActiveSheetData((prev) => {
      const updatedSlots = [...(prev[slotKey] || [])];
      updatedSlots[index] = { ...updatedSlots[index], ...updates };
      return { ...prev, [slotKey]: updatedSlots };
    });
    saveActiveCharacter();
  };

  const handleCheckboxToggle = (slotIndex: number, checkIndex: number) => {
    updateActiveSheetData((prev) => {
      const updatedSlots = [...(prev[slotKey] || [])];
      const targetSlot = { ...updatedSlots[slotIndex] };
      const newChecked = [...(targetSlot.checked || [false, false, false])];
      newChecked[checkIndex] = !newChecked[checkIndex];
      targetSlot.checked = newChecked;
      updatedSlots[slotIndex] = targetSlot;
      return { ...prev, [slotKey]: updatedSlots };
    });
    saveActiveCharacter();
  };

  const handleSelectPowerFromDb = (slotIndex: number, powerName: string) => {
    const foundPower = powers.find((p) => p.name === powerName);
    if (foundPower) {
      handleSlotChange(slotIndex, {
        name: foundPower.name,
        action: (foundPower.action?.toUpperCase() as any) || '',
        usage: foundPower.usage || '',
        effect: foundPower.effect || '',
      });
    } else {
      handleSlotChange(slotIndex, { name: powerName });
    }
  };

  const handleSortSlots = () => {
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];
      const sorted = current.sort((a, b) => {
        const orderA = ACTION_ORDER[a.action?.toUpperCase() || ''] ?? 99;
        const orderB = ACTION_ORDER[b.action?.toUpperCase() || ''] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
      return { ...prev, [slotKey]: sorted };
    });
    saveActiveCharacter();
  };

  const handleAddSlot = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      [slotKey]: [
        ...(prev[slotKey] || []),
        { select: false, name: '', action: '', usage: '', effect: '', checked: [false, false, false] },
      ],
    }));
    saveActiveCharacter();
  };

  const handleRemoveSlot = (index: number) => {
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];
      current.splice(index, 1);
      return { ...prev, [slotKey]: current };
    });
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          {type === 'powers' ? (
            <Zap className="w-4 h-4 text-amber-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-cyan-400" />
          )}
          {title}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSortSlots}
            className="px-2.5 py-1 bg-slate-950 text-slate-300 hover:text-slate-100 text-xs font-semibold rounded border border-slate-800 flex items-center gap-1.5 transition-all"
            title="Sort by Action Economy (AM -> A -> M -> P -> F)"
          >
            <ArrowUpDown className="w-3 h-3 text-indigo-400" />
            Sort
          </button>
          <button
            onClick={handleAddSlot}
            className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded border border-indigo-500/30 flex items-center gap-1 transition-all"
          >
            <Plus className="w-3 h-3" />
            Add Row
          </button>
        </div>
      </div>

      {/* Slots Table */}
      <div className="flex flex-col gap-2 overflow-x-auto">
        {slots.map((slot, index) => {
          const actionUpper = (slot.action || '').toUpperCase();
          const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

          return (
            <div
              key={index}
              className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
            >
              {/* Name & DB Selector */}
              <div className="flex items-center gap-2 w-full md:w-1/3">
                <select
                  value={slot.name}
                  onChange={(e) => handleSelectPowerFromDb(index, e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none w-full focus:border-indigo-500"
                >
                  <option value="">Custom Ability / Select DB...</option>
                  {slot.name && !powers.some((p) => p.name === slot.name) && (
                    <option value={slot.name} className="bg-slate-900 text-indigo-300 font-bold">
                      {slot.name}
                    </option>
                  )}
                  {powers.map((p) => (
                    <option key={p.id} value={p.name} className="bg-slate-900 text-slate-100">
                      {p.name} [{p.action || 'Custom'}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Badges Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={actionUpper}
                  onChange={(e) => handleSlotChange(index, { action: e.target.value as any })}
                  className={`text-xs font-mono font-bold px-2 py-1 rounded border outline-none cursor-pointer ${actionClass}`}
                >
                  <option value="" className="bg-slate-900 text-slate-100">Act?</option>
                  <option value="AM" className="bg-slate-900 text-amber-300">AM</option>
                  <option value="A" className="bg-slate-900 text-rose-300">A</option>
                  <option value="M" className="bg-slate-900 text-indigo-300">M</option>
                  <option value="P" className="bg-slate-900 text-emerald-300">P</option>
                  <option value="F" className="bg-slate-900 text-purple-300">F</option>
                </select>
              </div>

              {/* Effect Description */}
              <input
                type="text"
                placeholder="Ability effect or usage..."
                value={slot.effect || ''}
                onChange={(e) => handleSlotChange(index, { effect: e.target.value })}
                className="bg-slate-900 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 outline-none flex-1 w-full focus:border-indigo-500"
              />

              {/* 3 Usages Tracker Checkboxes */}
              <div className="flex items-center gap-1.5">
                {(slot.checked || [false, false, false]).map((isChecked, bIdx) => (
                  <input
                    key={bIdx}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleCheckboxToggle(index, bIdx)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                  />
                ))}
              </div>

              {/* Remove Row Button */}
              <button
                onClick={() => handleRemoveSlot(index)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                title="Delete Row"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
