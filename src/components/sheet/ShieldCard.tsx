// src/components/sheet/ShieldCard.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, Check, Plus, Search, Globe, ShieldAlert, Loader2, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CardHelpButton } from '../common/CardHelpButton';
import { RuleTooltip } from '../common/RuleTooltip';
import {
  ShieldData,
  SupabaseShield,
  getShieldMrFromRequirement,
  getShieldMaxBlockFromRequirement,
  isRequirementLearnable,
  calculateAvailableAp,
} from '../../types/game';

const REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];

export const ShieldCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();

  const shield: ShieldData = activeCharacter?.sheet_data?.shield_slot || {
    id: 'shd_default',
    equipped: false,
    name: 'Round Shield',
    sk: true,
    requirement: '💪 4',
    max_block: 12,
    mr_adjustment: '👣0',
    cost: '5g',
  };

  const armory: ShieldData[] = useMemo(() => {
    const list = activeCharacter?.sheet_data?.armory;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return shield.equipped ? [shield] : [];
  }, [activeCharacter?.sheet_data?.armory, shield]);

  const attributeDice = (activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const getDieNum = (dieRating?: string): number => {
    if (!dieRating) return 4;
    const num = parseInt(dieRating.replace('d', ''), 10);
    return isNaN(num) ? 4 : num;
  };

  const derivedBlock = getDieNum(attributeDice.might);

  const isShieldSkilled = (item: ShieldData): boolean => {
    if (!item || item.id === 'shd_none') return false;
    if (item.sk === true) return true;
    if (item.sk === false) return false;
    return isRequirementLearnable(item.requirement || '💪 4', attributeDice);
  };

  const skilledShieldList = useMemo(() => {
    return armory.filter(isShieldSkilled);
  }, [armory, attributeDice]);

  const skilledShieldCount = skilledShieldList.length;
  const shieldApSpent = skilledShieldCount;
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');
  const [rightSearchQuery, setRightSearchQuery] = useState<string>('');
  const [activeRightTab, setActiveRightTab] = useState<'CATALOG' | 'CREATOR'>('CATALOG');

  const [shieldCatalog, setShieldCatalog] = useState<SupabaseShield[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [learnableOnly, setLearnableOnly] = useState<boolean>(true);

  const [newShieldName, setNewShieldName] = useState<string>('');
  const [newShieldReq, setNewShieldReq] = useState<string>('💪 4');
  const [newShieldCostVal, setNewShieldCostVal] = useState<number>(1);
  const [newShieldCostUnit, setNewShieldCostUnit] = useState<'g' | 's'>('g');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const derivedMaxBlockStr = getShieldMaxBlockFromRequirement(newShieldReq);
  const derivedMrStr = getShieldMrFromRequirement(newShieldReq);

  useEffect(() => {
    if (showManageModal) {
      setIsLoadingCatalog(true);
      gameApi
        .getShields()
        .then(setShieldCatalog)
        .catch(console.error)
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageModal]);

  const updateMovementForShield = (mrAdjustmentStr?: string, equipped: boolean = true) => {
    const mrMatch = (mrAdjustmentStr || '👣0').match(/-?\d+/);
    const penalty = mrMatch ? parseInt(mrMatch[0], 10) : 0;
    const armoredMR = activeCharacter?.sheet_data?.movement_rate?.armored ?? 6;
    const calculatedShieldDrawn = equipped ? Math.max(0, armoredMR + penalty) : 'n/a';

    updateActiveSheetData((prev) => ({
      ...prev,
      movement_rate: {
        ...(prev.movement_rate || { armored: 6, shield: 'n/a' }),
        shield: String(calculatedShieldDrawn),
      },
    }));
  };

  const handleSelectActiveShield = (selectedShield: ShieldData) => {
    const equippedShield = { ...selectedShield, equipped: true };
    updateActiveSheetData((prev) => ({
      ...prev,
      shield_slot: equippedShield,
      armory: (prev.armory || armory).map((s) => ({
        ...s,
        equipped: s.name.toLowerCase() === selectedShield.name.toLowerCase(),
      })),
    }));
    updateMovementForShield(selectedShield.mr_adjustment, true);
    saveActiveCharacter();
  };

  const handleSkToggle = (skChecked: boolean) => {
    const updatedShield = { ...shield, sk: skChecked };
    updateActiveSheetData((prev) => ({
      ...prev,
      shield_slot: updatedShield,
      armory: (prev.armory || armory).map((item) =>
        item.name.toLowerCase() === shield.name.toLowerCase() ? { ...item, sk: skChecked } : item
      ),
    }));
    saveActiveCharacter();
  };

  const handleAddToArmory = (item: SupabaseShield) => {
    const isLearnable = isRequirementLearnable(item.requirement, attributeDice);
    const newShieldItem: ShieldData = {
      id: `shd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      equipped: true,
      name: item.name,
      sk: isLearnable,
      max_block: parseInt((item.max_block || '12').replace(/\D/g, ''), 10) || 12,
      requirement: item.requirement,
      mr_adjustment: item.mr,
      cost: item.cost,
    };
    updateActiveSheetData((prev) => {
      const existingArmory = prev.armory || armory;
      const isAlreadyInArmory = existingArmory.some(
        (s) => s.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!isAlreadyInArmory) {
        if (isLearnable) {
          recordApExpenditure(1, 'Shields', `Learned Skilled Shield: ${item.name} (1 AP)`, 1, 'Manage Shields');
        } else {
          recordApExpenditure(0, 'Shields', `Added Unskilled Shield: ${item.name} (0 AP - Unskilled)`, 1, 'Manage Shields');
        }
      }
      return {
        ...prev,
        shield_slot: newShieldItem,
        armory: [...(prev.armory || armory).filter((s) => s.name.toLowerCase() !== item.name.toLowerCase()), newShieldItem],
      };
    });
    updateMovementForShield(item.mr, true);
    saveActiveCharacter();
  };

  const handleDropFromArmory = (shieldName: string) => {
    const targetShield = armory.find((s) => s.name.toLowerCase() === shieldName.toLowerCase());
    const wasSkilled = targetShield ? isShieldSkilled(targetShield) : false;

    updateActiveSheetData((prev) => {
      const updatedArmory = (prev.armory || armory).filter((s) => s.name.toLowerCase() !== shieldName.toLowerCase());
      let nextActiveShield = prev.shield_slot;
      if (shield.name.toLowerCase() === shieldName.toLowerCase()) {
        nextActiveShield = updatedArmory.length > 0
          ? { ...updatedArmory[0], equipped: true }
          : { id: 'shd_none', equipped: false, name: 'None', sk: true, max_block: 0 };
      }

      if (wasSkilled) {
        recordApExpenditure(-1, 'Shields', `Unlearned Skilled Shield: ${shieldName} (-1 AP Refunded)`, 1, 'Manage Shields');
      } else {
        recordApExpenditure(0, 'Shields', `Dropped Unskilled Shield: ${shieldName} (0 AP)`, 1, 'Manage Shields');
      }

      return {
        ...prev,
        shield_slot: nextActiveShield,
        armory: updatedArmory,
      };
    });
    if (shield.name.toLowerCase() === shieldName.toLowerCase()) {
      const nextShield = armory.find((s) => s.name.toLowerCase() !== shieldName.toLowerCase());
      updateMovementForShield(nextShield?.mr_adjustment, !!nextShield);
    }
    saveActiveCharacter();
  };

  const handleCreateShield = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = newShieldName.trim();
    if (!trimmedName) {
      setFormError('Shield name is required.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await gameApi.createShield({
        name: trimmedName,
        requirement: newShieldReq,
        max_block: derivedMaxBlockStr,
        mr: derivedMrStr,
        cost: `${Math.max(1, newShieldCostVal)}${newShieldCostUnit}`,
      });
      setShieldCatalog((prev) => [...prev, created]);
      handleAddToArmory(created);
      setNewShieldName('');
      setNewShieldReq('💪 4');
      setNewShieldCostVal(1);
      setNewShieldCostUnit('g');
      setActiveRightTab('CATALOG');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create shield.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const armoryNamesSet = useMemo(() => new Set(armory.map((s) => s.name.toLowerCase())), [armory]);
  const filteredArmory = useMemo(
    () => armory.filter((s) => s.name.toLowerCase().includes(leftSearchQuery.toLowerCase().trim())),
    [armory, leftSearchQuery]
  );
  const filteredCatalogShields = useMemo(
    () =>
      shieldCatalog.filter(
        (item) =>
          !armoryNamesSet.has(item.name.toLowerCase()) &&
          (!learnableOnly || isRequirementLearnable(item.requirement, attributeDice)) &&
          item.name.toLowerCase().includes(rightSearchQuery.toLowerCase().trim())
      ),
    [shieldCatalog, armoryNamesSet, learnableOnly, rightSearchQuery, attributeDice]
  );

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-3">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="font-outfit font-bold text-sm tracking-widest text-cyan-300 uppercase flex items-center gap-2">
            <span className="text-base">🛡️</span> Shield
          </h3>
          <CardHelpButton ruleKey="col.shields.block" />
          {!shield.equipped && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-950 text-slate-400 rounded-full border border-slate-800">
              No Shield Equipped
            </span>
          )}
        </div>

        {/* Trigger Button */}
        <button
          onClick={() => setShowManageModal(!showManageModal)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm ${
            showManageModal
              ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400'
              : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <span className="font-outfit">Manage Shields</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
            {armory.length}
          </span>
          {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Master 2-Column Split-Pane Manager Modal */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Top Bar */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">🛡️</div>
                  <div>
                    <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                      Shields Manager
                    </h3>
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Manage character shield armory side-by-side with stock catalog.
                    </p>
                  </div>
                </div>

                {/* KISS Top-Center Header Status Pill */}
                <div className="px-3.5 py-1 bg-cyan-950/70 border border-cyan-500/40 rounded-full font-mono font-bold text-xs text-cyan-200 flex items-center gap-2 shadow-md">
                  <span>
                    Skilled <strong className="text-cyan-300">{skilledShieldCount}</strong>; Used{' '}
                    <strong className="text-rose-300">{shieldApSpent} AP</strong>; Available{' '}
                    <strong className="text-emerald-400">{availableAp} AP</strong>
                  </span>
                </div>

                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 2-Column Split-Pane Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                
                {/* --- LEFT COLUMN: ARMORY PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-outfit font-bold uppercase tracking-wider text-cyan-300">
                        Armory
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                        {armory.length}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search..."
                        value={leftSearchQuery}
                        onChange={(e) => setLeftSearchQuery(e.target.value)}
                        className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-cyan-500 w-24 sm:w-28"
                      />
                    </div>
                  </div>

                  {/* Scrollable Armory Items */}
                  <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2.5 min-h-0">
                    {filteredArmory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                        <ShieldAlert className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                        <span>No shields in armory. Select from catalog on the right.</span>
                      </div>
                    ) : (
                      filteredArmory.map((item) => {
                        const isActive = shield.equipped && shield.name.toLowerCase() === item.name.toLowerCase();
                        const isLearnable = item.requirement
                          ? isRequirementLearnable(item.requirement, attributeDice)
                          : true;

                        return (
                          <div
                            key={item.id || item.name}
                            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shrink-0 ${
                              isActive
                                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md shadow-cyan-500/10'
                                : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/30'
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSelectActiveShield(item)}
                                  className={`px-2 py-0.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all ${
                                    isActive
                                      ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 shadow-sm'
                                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                                  }`}
                                >
                                  <span className="text-[10px]">{isActive ? '●' : '○'}</span>
                                  <span>{isActive ? 'Active' : 'Equip'}</span>
                                </button>
                                <span className="font-outfit font-bold text-sm text-slate-100">{item.name}</span>
                              </div>

                              <button
                                onClick={() => handleDropFromArmory(item.name)}
                                className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg transition-all shrink-0"
                              >
                                - Drop
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-xs font-mono pt-0.5 text-slate-300">
                              <span>Req: <strong className="text-slate-200">{item.requirement || '💪 4'}</strong></span>
                              <span>Blk: <strong className="text-amber-300">🛡️{item.max_block}</strong></span>
                              <span>MR: <strong className="text-cyan-300">{item.mr_adjustment || '👣0'}</strong></span>
                              {isLearnable ? (
                                <span className="text-[10px] text-emerald-400 font-sans font-bold">Skilled</span>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-sans font-semibold">Unskilled</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* --- RIGHT COLUMN: STOCK CATALOG & CREATOR PANE --- */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800 w-full">
                      <button
                        onClick={() => setActiveRightTab('CATALOG')}
                        className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'CATALOG'
                            ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        Stock Catalog ({filteredCatalogShields.length})
                      </button>

                      <button
                        onClick={() => setActiveRightTab('CREATOR')}
                        className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'CREATOR'
                            ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 text-cyan-400" />
                        Custom Creator
                      </button>
                    </div>
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
                            className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 w-full"
                          />
                        </div>

                        {/* Dyslexia-Friendly Peg-Slider Toggle */}
                        <div className="flex items-center justify-between bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
                          <span className="text-[11px] font-bold text-slate-400">Filter Mode:</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setLearnableOnly(false)}
                              className={`text-xs font-bold cursor-pointer select-none ${
                                !learnableOnly ? 'text-cyan-300 opacity-100 font-extrabold' : 'text-slate-400 opacity-50'
                              }`}
                            >
                              All Shields
                            </button>
                            <div
                              onClick={() => setLearnableOnly(!learnableOnly)}
                              className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors p-0.5 border border-slate-700 ${
                                learnableOnly ? 'bg-cyan-600 border-cyan-400' : 'bg-slate-800'
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
                                learnableOnly ? 'text-cyan-300 opacity-100 font-extrabold' : 'text-slate-400 opacity-50'
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
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            <span>Loading SupaFlex shields catalog...</span>
                          </div>
                        ) : filteredCatalogShields.length > 0 ? (
                          filteredCatalogShields.map((item, idx) => {
                            const qualifies = isRequirementLearnable(item.requirement, attributeDice);

                            return (
                              <div
                                key={item.id || idx}
                                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-cyan-500/40 transition-all shrink-0"
                              >
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-slate-100">{item.name}</span>
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-200 border border-slate-750">
                                      {item.cost}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => handleAddToArmory(item)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                      qualifies
                                        ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 shadow-sm'
                                        : 'bg-amber-600/30 text-amber-200 border-amber-500/50 hover:bg-amber-600/50 shadow-sm'
                                    }`}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    + Add to Armory
                                  </button>
                                </div>

                                <div className="flex items-center justify-between text-xs font-mono pt-0.5 text-slate-400">
                                  <span>Req: <strong className="text-slate-200">{item.requirement}</strong></span>
                                  <span>Blk: <strong className="text-amber-300">{item.max_block}</strong></span>
                                  <span>MR: <strong className="text-cyan-300">{item.mr}</strong></span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic py-6 text-center">
                            No shields match "{rightSearchQuery}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeRightTab === 'CREATOR' && (
                    <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-y-auto">
                      <form
                        onSubmit={handleCreateShield}
                        className="p-3 bg-cyan-950/20 border border-cyan-500/30 rounded-xl flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" />
                            Create Custom Shield
                          </span>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-slate-300">Shield Name</span>
                            <input
                              type="text"
                              placeholder="e.g. Aegis Bulwark"
                              value={newShieldName}
                              onChange={(e) => setNewShieldName(e.target.value)}
                              className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-400"
                              required
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-300 shrink-0">Cost:</span>
                            <input
                              type="number"
                              min="1"
                              value={newShieldCostVal}
                              onChange={(e) => setNewShieldCostVal(parseInt(e.target.value, 10) || 1)}
                              className="bg-slate-950 text-slate-100 text-xs font-mono font-bold px-2 py-1 rounded-lg border border-slate-700 outline-none w-16 text-center focus:border-cyan-400"
                              required
                            />
                            <select
                              value={newShieldCostUnit}
                              onChange={(e) => setNewShieldCostUnit(e.target.value as 'g' | 's')}
                              className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none focus:border-cyan-400 cursor-pointer"
                            >
                              <option value="g">g (Gold 🪙)</option>
                              <option value="s">s (Silver 🥈)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                          <span className="text-xs font-bold text-slate-300">Req Rating</span>
                          <select
                            value={newShieldReq}
                            onChange={(e) => setNewShieldReq(e.target.value)}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none focus:border-cyan-400 cursor-pointer"
                          >
                            {REQ_OPTIONS.map((req) => (
                              <option key={req} value={req}>
                                {req}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Max Block:</span>
                            <span className="text-xs font-mono font-extrabold text-amber-300">{derivedMaxBlockStr}</span>
                          </div>

                          <div className="px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">MR Penalty:</span>
                            <span className="text-xs font-mono font-extrabold text-cyan-300">{derivedMrStr}</span>
                          </div>
                        </div>

                        {formError && (
                          <div className="p-2 bg-rose-950/40 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{formError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full mt-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                        >
                          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4" />}
                          <span>Save & Equip Custom Shield</span>
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Status Bar with Standardized "Done" Button (Full Width) */}
              <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🛡️</span>
                  <span className="font-outfit font-bold text-slate-300">Shields Manager</span>
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

      {/* Main Character Sheet Card View */}
      {shield.equipped ? (
        <div className="flex items-center gap-3 pt-1 animate-fadeIn">
          {/* Sk Checkbox / Red X Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-xs font-bold text-slate-300 cursor-pointer">
              Sk
            </label>
            <button
              type="button"
              onClick={() => handleSkToggle(!shield.sk)}
              className={`w-5 h-5 flex items-center justify-center rounded border transition-all cursor-pointer shrink-0 ${
                shield.sk
                  ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60 shadow-sm hover:bg-cyan-600/50'
                  : 'bg-rose-950/80 text-rose-400 border-rose-500/60 shadow-md hover:bg-rose-900/90'
              }`}
              title={shield.sk ? 'Skilled (Click to mark Unskilled)' : 'Unskilled (Click to mark Skilled)'}
            >
              {shield.sk ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <X className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </button>
          </div>

          {/* Name Text Input (Read-Only) */}
          <input
            type="text"
            value={shield.name}
            readOnly
            placeholder="Shield Name (e.g. Round Shield)"
            className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-800 outline-none w-full max-w-[240px] cursor-default"
            title="Shield name set via Manage Shields modal"
          />

          {/* Block Cell (Auto-Updated from Might) */}
          <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-300"><RuleTooltip ruleKey="col.shields.block">Block</RuleTooltip></span>
              <span className="text-sm">💪</span>
            </div>
            <div
              className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
              title="Auto-updated matching Character Might rating"
            >
              {derivedBlock}
            </div>
          </div>

          {/* Max Block Read-Only Display Box */}
          <div className="px-3 py-2 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-slate-300"><RuleTooltip ruleKey="col.shields.block">Max Block</RuleTooltip></span>
            <div
              className="w-10 bg-slate-900 border border-slate-800 rounded py-1 text-xs font-mono font-extrabold text-amber-300 text-center"
              title="Auto-updated matching equipped shield Max Block"
            >
              {shield.max_block ?? 'n/a'}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic py-1">
          No shield currently equipped. Use "Manage Shields" to select or equip a shield.
        </p>
      )}
    </div>
  );
};
