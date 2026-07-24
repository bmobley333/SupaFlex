// src/components/sheet/ArmorCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, Check, Shirt } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ArmorData, MovementRateData } from '../../types/game';

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

const ARMORED_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0 to 12
const SHIELD_OPTIONS: (number | string)[] = ['n/a', ...Array.from({ length: 13 }, (_, i) => i)];

const STOCK_ARMOR: ArmorData[] = [
  { name: 'Leather Coat / Jerkin', block: 8, dodge: 8, ar: 4, effect: 'Light Armor' },
  { name: 'Studded Leather', block: 8, dodge: 8, ar: 6, effect: 'Reinforced Light Armor' },
  { name: 'Chainmail Hauberk', block: 8, dodge: 8, ar: 8, effect: 'Medium Ring Armor' },
  { name: 'Full Plate Armor', block: 8, dodge: 8, ar: 12, effect: 'Heavy Knight Armor' },
];

export const ArmorCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const armor: ArmorData = activeCharacter?.sheet_data?.armor_slot || {
    name: 'Studded Leather',
    block: 8,
    dodge: 8,
    ar: 6,
  };

  const mrData: MovementRateData = activeCharacter?.sheet_data?.movement_rate || {
    armored: 6,
    shield: 'n/a',
  };

  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  // Block ALWAYS equals Might rating, Dodge ALWAYS equals Motion rating
  const derivedBlock = getDieNum(attributeDice.might);
  const derivedDodge = getDieNum(attributeDice.motion);

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

  const handleArmorUpdate = (updates: Partial<ArmorData>) => {
    updateActiveSheetData((prev) => {
      const updatedArmor = { ...(prev.armor_slot || armor), ...updates };
      const updatedAr = updates.ar !== undefined ? updates.ar : prev.armor;
      return {
        ...prev,
        armor_slot: updatedArmor,
        armor: updatedAr ?? prev.armor,
      };
    });
    saveActiveCharacter();
  };

  const handleMrUpdate = (updates: Partial<MovementRateData>) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      movement_rate: {
        ...(prev.movement_rate || mrData),
        ...updates,
      },
    }));
    saveActiveCharacter();
  };

  const handleEquipStockArmor = (selected: ArmorData) => {
    handleArmorUpdate({ name: selected.name, ar: selected.ar });
    setShowManageModal(false);
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-amber-300 uppercase flex items-center gap-2">
          <span className="text-base">🧥</span>
          Armor
        </h3>

        {/* Manage Armor Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
            }`}
            title="Manage equipped armor"
          >
            <span className="font-outfit font-bold">Manage Armor</span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Manage Armor Floating Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-amber-400" />
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Manage Armor Catalog
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
                <div className="p-4 overflow-y-auto flex flex-col gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Standard Armor Sets</span>
                  <div className="flex flex-col gap-2">
                    {STOCK_ARMOR.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between hover:border-amber-500/40 transition-all"
                      >
                        <div>
                          <span className="font-bold text-xs text-slate-100 block">{item.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                            <span>Block 💪: {derivedBlock}</span>
                            <span>•</span>
                            <span>Dodge 🏃: {derivedDodge}</span>
                            <span>•</span>
                            <span className="text-amber-300">AR 🧥: {item.ar}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => handleEquipStockArmor(item)}
                          className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold rounded-lg border border-amber-500/40 flex items-center gap-1 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
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

      {/* Armor Row 1: Name (Bounded max width to prevent stretching) */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-300 tracking-wide w-12 shrink-0">Name</span>
        <input
          type="text"
          value={armor.name}
          onChange={(e) => handleArmorUpdate({ name: e.target.value })}
          placeholder="Armor Name (e.g. Studded Leather)"
          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 outline-none w-full max-w-[240px] focus:border-amber-500"
        />
      </div>

      {/* Armor Row 2: Block 💪 (Might), Dodge 🏃 (Motion), AR 🧥 (Dropdown) */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Block Cell (Auto-Updated from Might) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">Block</span>
            <span className="text-sm">💪</span>
          </div>
          <div
            className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
            title="Auto-updated matching Character Might rating"
          >
            {derivedBlock}
          </div>
        </div>

        {/* Dodge Cell (Auto-Updated from Motion) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">Dodge</span>
            <span className="text-sm">🏃</span>
          </div>
          <div
            className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
            title="Auto-updated matching Character Motion rating"
          >
            {derivedDodge}
          </div>
        </div>

        {/* AR Cell (Player Selectable Dropdown) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 w-fit">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300">AR</span>
            <span className="text-sm">🧥</span>
          </div>
          <select
            value={armor.ar}
            onChange={(e) => handleArmorUpdate({ ar: parseInt(e.target.value) || 0 })}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono font-extrabold text-amber-300 text-center outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value={0}>0</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
            <option value={12}>12</option>
          </select>
        </div>
      </div>

      {/* Integrated Movement Rate (MR) Footer */}
      <div className="pt-2 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <span className="font-outfit font-bold text-teal-300 flex items-center gap-1.5 uppercase tracking-wider text-xs">
          <span>👣</span> MR <span className="text-[10px] text-slate-400 normal-case font-normal">(Movement Rate)</span>
        </span>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-300">Armored</span>
            <select
              value={mrData.armored ?? 6}
              onChange={(e) => handleMrUpdate({ armored: parseInt(e.target.value, 10) || 0 })}
              className="bg-slate-900 border border-slate-700 text-teal-300 text-xs font-mono font-extrabold px-1.5 py-0.5 rounded outline-none focus:border-teal-400 cursor-pointer text-center"
            >
              {ARMORED_OPTIONS.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
          <div className="px-2.5 py-1 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-300">Shield Drawn</span>
            <select
              value={mrData.shield ?? 'n/a'}
              onChange={(e) => {
                const val = e.target.value;
                handleMrUpdate({ shield: val === 'n/a' ? 'n/a' : parseInt(val, 10) || 0 });
              }}
              className="bg-slate-900 border border-slate-700 text-teal-300 text-xs font-mono font-extrabold px-1.5 py-0.5 rounded outline-none focus:border-teal-400 cursor-pointer text-center"
            >
              {SHIELD_OPTIONS.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
