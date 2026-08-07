// src/components/sheet/ArmorCard.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, Check, Shirt, Plus, Search, Loader2, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CardHelpButton } from '../common/CardHelpButton';
import { RuleTooltip } from '../common/RuleTooltip';
import {
  ArmorData,
  MovementRateData,
  SupabaseArmor,
  getMrFromRequirement,
  getArFromRequirement,
  isRequirementLearnable,
  calculateAvailableAp,
} from '../../types/game';

const getDieNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

const REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];

export const ArmorCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();

  const armor: ArmorData = activeCharacter?.sheet_data?.armor_slot || {
    id: 'arm_default',
    name: 'Studded Leather',
    sk: true,
    block: 8,
    dodge: 8,
    ar: 6,
    requirement: '💪 4',
    mr: '👣7',
    cost: '15g',
  };

  const wardrobe: ArmorData[] = useMemo(() => {
    const list = activeCharacter?.sheet_data?.wardrobe;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return [armor];
  }, [activeCharacter?.sheet_data?.wardrobe, armor]);

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

  const derivedDodge = getDieNum(attributeDice.motion);

  const isArmorSkilled = (item: ArmorData): boolean => {
    if (!item || item.id === 'arm_none') return false;
    if (item.sk === true) return true;
    if (item.sk === false) return false;
    return isRequirementLearnable(item.requirement || '💪 4', attributeDice);
  };

  const skilledArmorList = useMemo(() => {
    return wardrobe.filter(isArmorSkilled);
  }, [wardrobe, attributeDice]);

  const skilledArmorCount = skilledArmorList.length;
  const armorApSpent = Math.max(0, skilledArmorCount - 1);
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');
  const [activeRightTab, setActiveRightTab] = useState<'CATALOG' | 'CREATOR'>('CATALOG');

  const [armorCatalog, setArmorCatalog] = useState<SupabaseArmor[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [learnableOnly, setLearnableOnly] = useState<boolean>(true);

  const [newArmorName, setNewArmorName] = useState<string>('');
  const [newArmorReq, setNewArmorReq] = useState<string>('💪 4');
  const [newArmorCostVal, setNewArmorCostVal] = useState<number>(1);
  const [newArmorCostUnit, setNewArmorCostUnit] = useState<'g' | 's'>('g');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const derivedArStr = getArFromRequirement(newArmorReq);
  const derivedMrStr = getMrFromRequirement(newArmorReq);

  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getArmor()
        .then((data) => setArmorCatalog(data))
        .catch((err) => console.error('Failed to load armor catalog:', err))
        .finally(() => setIsLoadingCatalog(false));
    }
  }, [showManageModal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowManageModal(false);
      }
    };
    if (showManageModal) document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);

  const updateMovementForArmor = (mrStr?: string) => {
    const mrMatch = mrStr ? mrStr.match(/\d+/) : null;
    const numericMr = mrMatch ? parseInt(mrMatch[0], 10) : 6;
    const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
    let newShieldMR: string | number = 'n/a';
    if (shieldSlot?.equipped) {
      const mrAdjustmentStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
      const match = mrAdjustmentStr.match(/-?\d+/);
      const penalty = match ? parseInt(match[0], 10) : 0;
      newShieldMR = Math.max(0, numericMr + penalty);
    }
    updateActiveSheetData((prev) => ({
      ...prev,
      movement_rate: {
        ...(prev.movement_rate || mrData),
        armored: numericMr,
        shield: newShieldMR,
      },
    }));
  };

  const handleSelectActiveArmor = (selectedArmor: ArmorData) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      armor_slot: selectedArmor,
      armor: selectedArmor.ar,
    }));
    updateMovementForArmor(selectedArmor.mr);
    saveActiveCharacter();
  };

  const handleSkToggle = (skChecked: boolean) => {
    const updatedArmor = { ...armor, sk: skChecked };
    updateActiveSheetData((prev) => {
      const updatedWardrobe = (prev.wardrobe || wardrobe).map((item) =>
        item.name.toLowerCase() === armor.name.toLowerCase() ? { ...item, sk: skChecked } : item
      );
      return {
        ...prev,
        armor_slot: updatedArmor,
        wardrobe: updatedWardrobe,
      };
    });
    saveActiveCharacter();
  };

  const handleAddToWardrobe = (item: SupabaseArmor) => {
    const arMatch = item.ar ? item.ar.match(/\d+/) : null;
    const numericAr = arMatch ? parseInt(arMatch[0], 10) : 4;
    const isLearnable = isRequirementLearnable(item.requirement, attributeDice);
    const newArmorItem: ArmorData = {
      id: `arm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: item.name,
      sk: isLearnable,
      ar: numericAr,
      requirement: item.requirement,
      mr: item.mr,
      cost: item.cost,
    };
    updateActiveSheetData((prev) => {
      const existingWardrobe = prev.wardrobe || wardrobe;
      const isAlreadyInWardrobe = existingWardrobe.some(
        (w) => w.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!isAlreadyInWardrobe) {
        if (isLearnable) {
          const currentSkilledCount = skilledArmorCount;
          if (currentSkilledCount === 0) {
            recordApExpenditure(0, 'Armor', `Learned Skilled Armor: ${item.name} (1st Free Armor)`, 1, 'Manage Armor');
          } else {
            recordApExpenditure(1, 'Armor', `Learned Skilled Armor: ${item.name} (1 AP)`, 1, 'Manage Armor');
          }
        } else {
          recordApExpenditure(0, 'Armor', `Added Unskilled Armor: ${item.name} (0 AP - Unskilled)`, 1, 'Manage Armor');
        }
      }
      const updatedWardrobe = isAlreadyInWardrobe ? existingWardrobe : [...existingWardrobe, newArmorItem];
      return {
        ...prev,
        armor_slot: newArmorItem,
        armor: numericAr,
        wardrobe: updatedWardrobe,
      };
    });
    updateMovementForArmor(item.mr);
    saveActiveCharacter();
  };

  const handleDropFromWardrobe = (armorName: string) => {
    const targetArmor = wardrobe.find((w) => w.name.toLowerCase() === armorName.toLowerCase());
    const wasSkilled = targetArmor ? isArmorSkilled(targetArmor) : false;

    updateActiveSheetData((prev) => {
      const existingWardrobe = prev.wardrobe || wardrobe;
      const updatedWardrobe = existingWardrobe.filter((w) => w.name.toLowerCase() !== armorName.toLowerCase());
      let nextActiveArmor = prev.armor_slot;
      if (armor.name.toLowerCase() === armorName.toLowerCase()) {
        nextActiveArmor = updatedWardrobe.length > 0 ? updatedWardrobe[0] : {
          id: 'arm_none',
          name: 'Unarmored',
          sk: true,
          ar: 0,
          requirement: '💪 4',
          mr: '👣8',
        };
      }

      if (wasSkilled) {
        if (skilledArmorCount > 1) {
          recordApExpenditure(-1, 'Armor', `Unlearned Skilled Armor: ${armorName} (-1 AP Refunded)`, 1, 'Manage Armor');
        } else {
          recordApExpenditure(0, 'Armor', `Unlearned Skilled Armor: ${armorName} (0 AP - Free Slot Freed)`, 1, 'Manage Armor');
        }
      } else {
        recordApExpenditure(0, 'Armor', `Dropped Unskilled Armor: ${armorName} (0 AP)`, 1, 'Manage Armor');
      }

      return {
        ...prev,
        armor_slot: nextActiveArmor,
        armor: nextActiveArmor ? nextActiveArmor.ar : 0,
        wardrobe: updatedWardrobe,
      };
    });
    saveActiveCharacter();
  };

  const handleCreateArmor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = newArmorName.trim();
    if (!trimmedName) { setFormError('Name required.'); return; }
    const combinedCost = `${Math.max(1, newArmorCostVal)}${newArmorCostUnit}`;
    setIsSubmitting(true);
    try {
      let created: SupabaseArmor;
      try {
        created = await gameApi.createArmor({
          name: trimmedName,
          requirement: newArmorReq,
          ar: derivedArStr,
          mr: derivedMrStr,
          cost: combinedCost,
        });
      } catch (dbErr: any) {
        console.warn('[ArmorCard] Remote catalog insert restricted by RLS; generating local custom item:', dbErr);
        created = {
          id: Date.now(),
          name: trimmedName,
          requirement: newArmorReq,
          ar: derivedArStr,
          mr: derivedMrStr,
          cost: combinedCost,
          created_at: new Date().toISOString(),
        };
      }
      setArmorCatalog((prev) => [...prev, created]);
      handleAddToWardrobe(created);
      setNewArmorName('');
      setNewArmorReq('💪 4');
      setNewArmorCostVal(1);
      setNewArmorCostUnit('g');
      setActiveRightTab('CATALOG');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const wardrobeNamesSet = useMemo(() => new Set(wardrobe.map((w) => w.name.toLowerCase())), [wardrobe]);
  const filteredWardrobe = useMemo(() => {
    if (!leftSearchQuery.trim()) return wardrobe;
    const q = leftSearchQuery.toLowerCase().trim();
    return wardrobe.filter((w) => w.name.toLowerCase().includes(q));
  }, [wardrobe, leftSearchQuery]);
  const filteredCatalogArmor = useMemo(() => {
    return armorCatalog.filter((item) => {
      if (wardrobeNamesSet.has(item.name.toLowerCase())) return false;
      if (learnableOnly && !isRequirementLearnable(item.requirement, attributeDice)) return false;
      if (rightSearchQuery.trim()) {
        const q = rightSearchQuery.toLowerCase().trim();
        return item.name.toLowerCase().includes(q) || (item.requirement || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [armorCatalog, wardrobeNamesSet, learnableOnly, rightSearchQuery, attributeDice]);

  const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
  const isShieldEquipped = shieldSlot?.equipped ?? false;
  let derivedShieldDrawn: string | number = 'n/a';
  if (isShieldEquipped) {
    const mrAdjustmentStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
    const match = mrAdjustmentStr.match(/-?\d+/);
    const penalty = match ? parseInt(match[0], 10) : 0;
    const armoredMR = mrData.armored ?? 6;
    derivedShieldDrawn = Math.max(0, armoredMR + penalty);
  }

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-amber-300 uppercase flex items-center gap-2">
            <span className="text-base">🧥</span> Armor
          </h3>
          <CardHelpButton ruleKey="col.armor.ar" />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal ? 'bg-amber-600/30 text-amber-200 border-amber-400' : 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
            }`}
          >
            <span className="font-outfit font-bold">Manage Armor</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {wardrobe.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div ref={modalRef} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-500/30 text-amber-300">🧥</div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">Armor Manager</h3>
                    </div>
                  </div>

                  {/* KISS Top-Center Header Status Pill */}
                  <div className="px-3.5 py-1 bg-amber-950/70 border border-amber-500/40 rounded-full font-mono font-bold text-xs text-amber-200 flex items-center gap-2 shadow-md">
                    <span>
                      Skilled <strong className="text-amber-300">{skilledArmorCount}</strong>; Used{' '}
                      <strong className="text-rose-300">
                        {armorApSpent}
                        {skilledArmorCount >= 1 ? '+1Free' : ''} AP
                      </strong>
                      ; Available <strong className="text-emerald-400">{availableAp} AP</strong>
                    </span>
                  </div>

                  <button onClick={() => setShowManageModal(false)} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 shrink-0"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                      <div className="flex items-center gap-1.5"><Shirt className="w-4 h-4 text-amber-400" /><span className="text-xs font-outfit font-bold uppercase tracking-wider text-amber-300">Armory</span></div>
                      <div className="relative"><Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search..." value={leftSearchQuery} onChange={(e) => setLeftSearchQuery(e.target.value)} className="bg-slate-900 text-slate-200 text-[11px] pl-6 py-0.5 rounded border border-slate-700 w-24" /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto mt-2.5 flex flex-col gap-2.5">
                      {filteredWardrobe.map((item) => {
                        const isActive = armor.name.toLowerCase() === item.name.toLowerCase();
                        return (
                          <div key={item.id} className={`p-3 rounded-xl border flex flex-col gap-2 ${isActive ? 'bg-amber-950/40 border-amber-500/60' : 'bg-slate-900/90 border-slate-800'}`}>
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                              <div className="flex items-center gap-2"><button type="button" onClick={() => handleSelectActiveArmor(item)} className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${isActive ? 'bg-emerald-600/30 text-emerald-200' : 'bg-slate-950 text-slate-400'}`}>{isActive ? '● Active' : '○ Wear'}</button><span className="font-outfit font-bold text-sm text-slate-100">{item.name}</span></div>
                              <button onClick={() => handleDropFromWardrobe(item.name)} className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold rounded-lg">- Drop</button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400"><span><RuleTooltip ruleKey="col.armor.ar">AR</RuleTooltip>: {item.ar} | MR: {item.mr}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden">
                    <div className="flex p-0.5 bg-slate-900 rounded-lg border border-slate-800">
                      <button onClick={() => setActiveRightTab('CATALOG')} className={`flex-1 py-1 rounded-md text-xs font-bold ${activeRightTab === 'CATALOG' ? 'bg-amber-600/30 text-amber-200' : 'text-slate-400'}`}>Catalog</button>
                      <button onClick={() => setActiveRightTab('CREATOR')} className={`flex-1 py-1 rounded-md text-xs font-bold ${activeRightTab === 'CREATOR' ? 'bg-amber-600/30 text-amber-200' : 'text-slate-400'}`}>Creator</button>
                    </div>
                    {activeRightTab === 'CATALOG' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2 gap-2 overflow-hidden">
                        <div className="flex flex-col gap-2 shrink-0">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="Search catalog..."
                              value={rightSearchQuery}
                              onChange={(e) => setRightSearchQuery(e.target.value)}
                              className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-amber-500 w-full"
                            />
                          </div>

                          {/* Dyslexia-Friendly UI Peg-Slider Toggle */}
                          <div className="flex items-center justify-between bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                            <span className="text-[11px] font-bold text-slate-400">Filter Mode:</span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setLearnableOnly(false)}
                                className={`text-xs font-bold cursor-pointer select-none ${
                                  !learnableOnly ? 'text-amber-300 opacity-100 font-extrabold' : 'text-slate-400 opacity-50'
                                }`}
                              >
                                All Armor
                              </button>
                              <div
                                onClick={() => setLearnableOnly(!learnableOnly)}
                                className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors p-0.5 border border-slate-700 ${
                                  learnableOnly ? 'bg-amber-600 border-amber-400' : 'bg-slate-800'
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-full bg-slate-100 shadow-md transform transition-transform ${
                                    learnableOnly ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setLearnableOnly(true)}
                                className={`text-xs font-bold cursor-pointer select-none ${
                                  learnableOnly ? 'text-amber-300 opacity-100 font-extrabold' : 'text-slate-400 opacity-50'
                                }`}
                              >
                                Learnable Only
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                          {isLoadingCatalog ? (
                            <div className="h-full flex items-center justify-center p-6 text-slate-400 text-xs gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                              <span>Loading catalog...</span>
                            </div>
                          ) : filteredCatalogArmor.length > 0 ? (
                            filteredCatalogArmor.map((item, idx) => {
                              const qualifies = isRequirementLearnable(item.requirement, attributeDice);
                              return (
                                <div
                                  key={item.id || idx}
                                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-amber-500/40 transition-all shrink-0"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-sm text-slate-100">{item.name}</span>
                                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-200 border border-slate-750">
                                        {item.cost}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleAddToWardrobe(item)}
                                      className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                        qualifies
                                          ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50'
                                          : 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50'
                                      }`}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      + Add to Armory
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                                    <span>Req: <strong className="text-slate-200">{item.requirement}</strong></span>
                                    <span>AR: <strong className="text-amber-300">{item.ar}</strong></span>
                                    <span>MR: <strong className="text-cyan-300">{item.mr}</strong></span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 italic py-6 text-center">
                              No armor sets match catalog search.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {activeRightTab === 'CREATOR' && (
                      <form onSubmit={handleCreateArmor} className="mt-3 p-3 bg-amber-950/20 rounded-xl border border-amber-500/30 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Create Custom Armor</span>
                        </div>
                        <input type="text" placeholder="Armor Name" value={newArmorName} onChange={(e) => setNewArmorName(e.target.value)} className="bg-slate-950 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-white outline-none focus:border-amber-400" required />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-300">Requirement</span>
                          <select value={newArmorReq} onChange={(e) => setNewArmorReq(e.target.value)} className="bg-slate-950 text-xs px-2 py-1 rounded border border-slate-700 text-amber-300 outline-none">
                            {REQ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between"><span>AR:</span><strong className="text-amber-300">{derivedArStr}</strong></div>
                          <div className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between"><span>MR:</span><strong className="text-cyan-300">{derivedMrStr}</strong></div>
                        </div>
                        {formError && (
                          <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300 text-xs flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{formError}</span>
                          </div>
                        )}
                        <button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 shadow">
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          <span>Save & Equip Armor</span>
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Modal Footer Status Bar with Standardized "Done" Button */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-outfit font-bold text-slate-300">🧥 Armor Manager</span>
                  </div>
                  
                  {/* Standardized Master Blueprint Done Footer Button */}
                  <button 
                    onClick={() => setShowManageModal(false)} 
                    className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Character Sheet Card View - High Density Single Line */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 animate-fadeIn">
        {/* Sk Checkbox / Red X Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="text-xs font-bold text-slate-300 cursor-pointer">
            Sk
          </label>
          <button
            type="button"
            onClick={() => handleSkToggle(!(armor.sk ?? true))}
            className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-pointer shrink-0 ${
              (armor.sk ?? true)
                ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm hover:bg-cyan-600/50'
                : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md hover:bg-rose-900/90'
            }`}
            title={(armor.sk ?? true) ? 'Skilled (Click to mark Unskilled)' : 'Unskilled (Click to mark Skilled)'}
          >
            {(armor.sk ?? true) ? (
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            ) : (
              <X className="w-3.5 h-3.5 stroke-[3]" />
            )}
          </button>
        </div>

        {/* Armor Name Input (Read-Only) */}
        <input
          type="text"
          value={armor.name}
          readOnly
          placeholder="Armor Name (e.g. Studded Leather)"
          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 outline-none flex-1 min-w-[130px] max-w-[240px] cursor-default truncate"
          title="Armor name set via Manage Armor modal"
        />

        {/* Dodge Cell (Auto-Updated from Motion) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300"><RuleTooltip ruleKey="col.weapons.range">Dodge</RuleTooltip></span>
            <span className="text-sm">🏃</span>
          </div>
          <div
            className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
            title="Auto-updated matching Character Motion rating"
          >
            {derivedDodge}
          </div>
        </div>

        {/* AR Cell (Auto-Updated Read-Only Display Box) */}
        <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300"><RuleTooltip ruleKey="col.armor.ar">AR</RuleTooltip></span>
            <span className="text-sm">🧥</span>
          </div>
          <div
            className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
            title="Auto-updated matching equipped armor AR rating"
          >
            {armor.ar ?? 0}
          </div>
        </div>
      </div>

      {/* Integrated Movement Rate (MR) Footer Sub-Card */}
      <div className="pt-2.5 mt-1 border-t border-slate-800/80 flex flex-col gap-2">
        <span className="font-outfit font-bold text-teal-300 flex items-center gap-1.5 uppercase tracking-wider text-xs">
          <span>👣</span> <RuleTooltip ruleKey="col.weapons.range">MR</RuleTooltip> <span className="text-[10px] text-slate-400 normal-case font-normal">(Movement Rate)</span>
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {/* Armored MR Box */}
          <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2 w-fit">
            <span className="text-[11px] font-bold text-slate-300"><RuleTooltip ruleKey="col.armor.ar">Armored</RuleTooltip> 👣</span>
            <div
              className="w-9 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
              title="Auto-updated matching equipped armor Armored Movement Rate"
            >
              {mrData.armored ?? 6}
            </div>
          </div>

          {/* Shield Drawn MR Box */}
          <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2 w-fit">
            <span className="text-[11px] font-bold text-slate-300">Shield Drawn 👣</span>
            <div
              className="px-2 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
              title="Auto-calculated Armored MR reduced by shield MR penalty (min 0)"
            >
              {derivedShieldDrawn}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
