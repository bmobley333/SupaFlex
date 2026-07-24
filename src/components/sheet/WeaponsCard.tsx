// src/components/sheet/WeaponsCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, X, Swords } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { WeaponSlot } from '../../types/game';

const DIE_SCALE = [4, 6, 8, 10, 12];
const MAX_BLK_OPTIONS = ['n/a', '6', '8', '12', '16', '20', '24'];

const MHS_COLORS: Record<string, { select: string; badge: string }> = {
  M: {
    select: 'bg-rose-950/80 text-rose-300 border-rose-500/40 focus:border-rose-400',
    badge: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
  },
  H: {
    select: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 focus:border-emerald-400',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
  },
  S: {
    select: 'bg-amber-950/80 text-amber-300 border-amber-500/40 focus:border-amber-400',
    badge: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
  },
};

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

const getStepDownDie = (num: number): number => {
  const idx = DIE_SCALE.indexOf(num);
  if (idx > 0) return DIE_SCALE[idx - 1];
  return 4; // minimum 4
};

const calculateWeaponAtk = (name: string, mhsCategory: string, attributeDice: Record<string, string>): number => {
  const cleanName = (name || '').toLowerCase();
  let baseVal = getDieNum(attributeDice?.might);
  const cat = (mhsCategory || '').trim().toLowerCase();
  if (cat.startsWith('h')) {
    baseVal = getDieNum(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNum(attributeDice?.mind);
  }

  // Improvised weapons step down Atk by -1d (minimum 4)
  if (cleanName.includes('improvised')) {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

const calculateWeaponDmg = (name: string, mhsCategory: string, attributeDice: Record<string, string>): number => {
  const cleanName = (name || '').toLowerCase();
  let baseVal = getDieNum(attributeDice?.might);
  const cat = (mhsCategory || '').trim().toLowerCase();
  if (cat.startsWith('h')) {
    baseVal = getDieNum(attributeDice?.motion);
  } else if (cat.startsWith('s')) {
    baseVal = getDieNum(attributeDice?.mind);
  }

  // Brawl / Unarmed weapons step down Dmg by -1d (minimum 4)
  if (cleanName.includes('brawl') || cleanName.includes('unarmed')) {
    return getStepDownDie(baseVal);
  }
  return baseVal;
};

const STOCK_WEAPONS: Omit<WeaponSlot, 'id'>[] = [
  { name: 'Shortsword', sk: true, mhs: 'M', atk: '8', dmg: '8', max_blk: '6', effect: 'Light Melee Sword' },
  { name: 'Broadsword', sk: true, mhs: 'M', atk: '8', dmg: '8', max_blk: '8', effect: 'Standard One-Handed Sword' },
  { name: 'Greatsword', sk: true, mhs: 'M', atk: '8', dmg: '8', max_blk: '16', effect: 'Two-Handed Heavy Cleaver' },
  { name: 'Dagger', sk: false, mhs: 'M', atk: '8', dmg: '8', max_blk: '6', effect: 'Concealable Finesse Blade' },
  { name: 'Brawl / Unarmed', sk: false, mhs: 'M', atk: '8', dmg: '6', max_blk: '6', effect: 'Unarmed Combat (-1d Dmg)' },
  { name: 'Javelin', sk: true, mhs: 'H', atk: '8', dmg: '8', max_blk: '6', effect: 'Hurled Spear' },
  { name: 'Longbow', sk: true, mhs: 'S', atk: '6', dmg: '6', max_blk: 'n/a', effect: 'Shot Ranged Bow' },
  { name: 'Improvised Weapon', sk: false, mhs: 'M', atk: '6', dmg: '8', max_blk: '6', effect: 'Ad-lib Object (-1d Atk)' },
];

export const WeaponsCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const weapons: WeaponSlot[] = activeCharacter?.sheet_data?.weapons || [];
  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const [showManageModal, setShowManageModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMhs, setCustomMhs] = useState<'M' | 'H' | 'S'>('M');
  const [customMaxBlk, setCustomMaxBlk] = useState('6');
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

  const handleWeaponChange = (id: string, updates: Partial<WeaponSlot>) => {
    updateActiveSheetData((prev) => {
      const updated = (prev.weapons || []).map((w) => (w.id === id ? { ...w, ...updates } : w));
      return { ...prev, weapons: updated };
    });
    saveActiveCharacter();
  };

  const handleAddWeapon = (weapon: Omit<WeaponSlot, 'id'>) => {
    const newWeapon: WeaponSlot = {
      ...weapon,
      id: `wep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    };
    updateActiveSheetData((prev) => ({
      ...prev,
      weapons: [...(prev.weapons || []), newWeapon],
    }));
    saveActiveCharacter();
  };

  const handleRemoveWeapon = (id: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      weapons: (prev.weapons || []).filter((w) => w.id !== id),
    }));
    saveActiveCharacter();
  };

  const handleCreateCustom = () => {
    if (!customName.trim()) return;
    const atkVal = calculateWeaponAtk(customName.trim(), customMhs, attributeDice);
    const dmgVal = calculateWeaponDmg(customName.trim(), customMhs, attributeDice);
    handleAddWeapon({
      name: customName.trim(),
      sk: true,
      mhs: customMhs,
      atk: String(atkVal),
      dmg: String(dmgVal),
      max_blk: customMaxBlk,
    });
    setCustomName('');
    setCustomMaxBlk('6');
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-rose-300 uppercase flex items-center gap-2">
          <span className="text-base">⚔️</span>
          Weapons
        </h3>

        {/* Manage Weapons Trigger Button */}
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? 'bg-rose-600/30 text-rose-200 border-rose-400 shadow-rose-500/30'
                : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/30 text-rose-300'
            }`}
            title="Manage and equip weapons"
          >
            <span className="font-outfit font-bold">Manage Weapons</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {weapons.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Manage Weapons Floating Modal */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-rose-400" />
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Manage Weapons Catalog
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
                  {/* Create Custom Weapon */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-300">Create Custom Weapon</span>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <input
                        type="text"
                        placeholder="Weapon Name"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="sm:col-span-2 bg-slate-900 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-rose-500"
                      />
                      <select
                        value={customMhs}
                        onChange={(e) => setCustomMhs(e.target.value as any)}
                        className={`text-xs px-2 py-1.5 rounded-lg border font-mono font-bold outline-none cursor-pointer transition-all ${
                          MHS_COLORS[customMhs]?.select || MHS_COLORS.M.select
                        }`}
                      >
                        <option value="M" className="bg-slate-900 text-rose-300">Melee (Might)</option>
                        <option value="H" className="bg-slate-900 text-emerald-300">Hurled (Motion)</option>
                        <option value="S" className="bg-slate-900 text-amber-300">Shot (Mind)</option>
                      </select>
                      <select
                        value={customMaxBlk}
                        onChange={(e) => setCustomMaxBlk(e.target.value)}
                        className="bg-slate-900 text-slate-300 text-xs px-2 py-1.5 rounded-lg border border-slate-700 font-mono outline-none"
                      >
                        {MAX_BLK_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            Max Blk: {opt}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleCreateCustom}
                        disabled={!customName.trim()}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-1.5 rounded-lg border border-rose-400 disabled:opacity-40 transition-all flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Stock Weapons Catalog */}
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Standard Weapons Arsenal</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {STOCK_WEAPONS.map((wep, idx) => {
                        const calculatedAtk = calculateWeaponAtk(wep.name, wep.mhs, attributeDice);
                        const calculatedDmg = calculateWeaponDmg(wep.name, wep.mhs, attributeDice);
                        const catKey = wep.mhs.startsWith('H') ? 'H' : wep.mhs.startsWith('S') ? 'S' : 'M';
                        const badgeClass = MHS_COLORS[catKey]?.badge || MHS_COLORS.M.badge;

                        return (
                          <div
                            key={idx}
                            className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between hover:border-rose-500/40 transition-all"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-100">{wep.name}</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${badgeClass}`}>
                                  {wep.mhs === 'M' ? 'Melee' : wep.mhs === 'H' ? 'Hurled' : 'Shot'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                <span>Atk: {calculatedAtk}</span>
                                <span>•</span>
                                <span>Dmg: {calculatedDmg}</span>
                                <span>•</span>
                                <span>Blk: {wep.max_blk}</span>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleAddWeapon({
                                  ...wep,
                                  atk: String(calculatedAtk),
                                  dmg: String(calculatedDmg),
                                })
                              }
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold rounded-lg border border-rose-500/40 flex items-center gap-1 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Equip
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Weapons Table View */}
      {weapons.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-3 text-center">
          No weapons equipped. Click "Manage Weapons" above to add weapons to your arsenal.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-x-auto">
          {/* Table Header Row */}
          <div className="grid grid-cols-[36px_92px_1fr_54px_54px_68px_32px] gap-2 items-center px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/80">
            <span className="text-center">Sk</span>
            <span className="text-center">M/H/S</span>
            <span>Weapon Name</span>
            <span className="text-center">Atk</span>
            <span className="text-center">Dmg</span>
            <span className="text-center">Max Blk</span>
            <span></span>
          </div>

          {/* Weapons Rows */}
          {weapons.map((item) => {
            const calculatedAtk = calculateWeaponAtk(item.name, item.mhs, attributeDice);
            const calculatedDmg = calculateWeaponDmg(item.name, item.mhs, attributeDice);
            const catKey = (item.mhs as string).startsWith('H') || (item.mhs as string) === 'Hurled'
              ? 'H'
              : (item.mhs as string).startsWith('S') || (item.mhs as string) === 'Shot'
              ? 'S'
              : 'M';
            const selectClass = MHS_COLORS[catKey]?.select || MHS_COLORS.M.select;

            return (
              <div
                key={item.id}
                className="grid grid-cols-[36px_92px_1fr_54px_54px_68px_32px] gap-2 items-center px-2 py-1.5 bg-slate-950/60 rounded-lg border border-slate-850 hover:border-slate-750 transition-all"
              >
                {/* Sk Checkbox */}
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={item.sk}
                    onChange={(e) => handleWeaponChange(item.id, { sk: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-rose-500 focus:ring-rose-500/20 bg-slate-900 cursor-pointer"
                    title="Trained / Skill Check"
                  />
                </div>

                {/* Color-Coded M/H/S Full-Name Dropdown */}
                <select
                  value={catKey}
                  onChange={(e) => handleWeaponChange(item.id, { mhs: e.target.value as 'M' | 'H' | 'S' })}
                  className={`text-xs font-bold px-1 py-1 rounded border outline-none text-center cursor-pointer transition-all ${selectClass}`}
                >
                  <option value="M" className="bg-slate-900 text-rose-300">Melee</option>
                  <option value="H" className="bg-slate-900 text-emerald-300">Hurled</option>
                  <option value="S" className="bg-slate-900 text-amber-300">Shot</option>
                </select>

                {/* Weapon Name Input */}
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => handleWeaponChange(item.id, { name: e.target.value })}
                  className="bg-slate-900 text-slate-100 text-xs font-semibold px-2 py-1 rounded border border-slate-800 outline-none focus:border-rose-500 w-full"
                />

                {/* Atk Cell (Auto-Updated: Might -1d for Improvised, full rating otherwise) */}
                <div
                  className="bg-slate-950 border border-slate-800 text-rose-200 text-xs font-mono font-extrabold text-center py-1 rounded"
                  title="Auto-updated from character attributes (-1d for Improvised Weapon)"
                >
                  {calculatedAtk}
                </div>

                {/* Dmg Cell (Auto-Updated: Might -1d for Brawl / Unarmed, full rating otherwise) */}
                <div
                  className="bg-slate-950 border border-slate-800 text-rose-300 text-xs font-mono font-extrabold text-center py-1 rounded"
                  title="Auto-updated from character attributes (-1d for Brawl / Unarmed)"
                >
                  {calculatedDmg}
                </div>

                {/* Max Blk Dropdown */}
                <select
                  value={item.max_blk ?? '6'}
                  onChange={(e) => handleWeaponChange(item.id, { max_blk: e.target.value })}
                  className="bg-slate-900 text-slate-200 text-xs font-mono font-extrabold px-1 py-1 rounded border border-slate-800 outline-none text-center focus:border-rose-500 cursor-pointer"
                >
                  {MAX_BLK_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                {/* Delete Button */}
                <button
                  onClick={() => handleRemoveWeapon(item.id)}
                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all flex justify-center"
                  title="Remove Weapon"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
