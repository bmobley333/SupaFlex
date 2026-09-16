// src/components/common/GearModFunctionTree.tsx
// Authoritative, DRY 2-level hierarchy tree (Chassis -> Mod -> Functions)
// Supports Standard Gear (with mods), Exotics, and Artifacts.

import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { ItemNotesPopover } from './ItemNotesPopover';
import {
  ModItem,
  GearPowerItem,
  FunctionItem,
  SimpleGearItem,
  AbilitySlot,
  isGearPowerLearned,
  getLearnedGearPower,
} from '../../types/game';
import {
  cleanBelongsToName,
  isModFreeForHost,
  isModCompatibleWithItem,
  getFunctionsForMod,
  getFunctionsForGearItem,
} from '../../utils/gearFunctionSync';
import { ACTION_BADGE_COLORS } from '../../utils/lootAbilityResolver';
import { isMsoEntry } from '../../utils/kitUtils';
import { parseCostToSilver, formatCostAbbreviated } from '../../utils/moneyUtils';

export type GearTreeMode = 'card' | 'manager-active' | 'manager-catalog' | 'gear-manager';

export interface GearModFunctionTreeProps {
  hostItem: SimpleGearItem | any;
  modsCatalog: ModItem[];
  functionsCatalog: FunctionItem[];
  mode?: GearTreeMode;
  isEditable?: boolean;
  onPurchaseMod?: (modItem: ModItem, hostName: string, hostCategory?: string) => void;
  notEnoughMoneyTarget?: { id: string } | null;
  totalAvailableSilver?: number;
  availableAp?: number;
  isGsUnlocked?: boolean;
  defaultExpanded?: boolean;
  className?: string;
  learnedSlots?: AbilitySlot[];
  onLearnPower?: (power: GearPowerItem, hostName: string, modName?: string) => void;
  onUnlearnPower?: (powerName: string) => void;
  onTogglePowerUsage?: (powerName: string, boxIndex: number) => void;
}

const parseUsageCount = (usage?: string): number => {
  if (!usage) return 0;
  const match = usage.trim().match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
};

export const GearModFunctionTree: React.FC<GearModFunctionTreeProps> = ({
  hostItem,
  modsCatalog = [],
  functionsCatalog = [],
  mode = 'gear-manager',
  isEditable: _isEditable = false,
  onPurchaseMod,
  notEnoughMoneyTarget,
  totalAvailableSilver = 0,
  availableAp = 0,
  isGsUnlocked = false,
  defaultExpanded = false,
  className = '',
  learnedSlots = [],
  onLearnPower,
  onUnlearnPower,
  onTogglePowerUsage,
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  const hostName = hostItem?.name || hostItem?.title || '';

  // 1. Direct inherent functions belonging to the chassis without any mod (alphabetical A-Z)
  const directFunctions = useMemo(() => {
    const fns = getFunctionsForGearItem(hostName, functionsCatalog);
    return [...fns].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [hostName, functionsCatalog]);

  // 2. Compatible mods from catalog (alphabetical A-Z)
  const compatibleMods = useMemo(() => {
    const mods = modsCatalog.filter((m) => isModCompatibleWithItem(m, hostItem));
    return [...mods].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [modsCatalog, hostItem]);

  // 3. Installed mods resolution
  const installedModsSet = useMemo(() => {
    const set = new Set<string>();
    // Add inherent free mods
    compatibleMods.forEach((m) => {
      if (isModFreeForHost(m, hostName)) {
        set.add(cleanBelongsToName(m.name));
      }
    });
    // Add aftermarket installed mods stored on the hostItem
    if (Array.isArray(hostItem?.installed_mods)) {
      hostItem.installed_mods.forEach((modName: string) => {
        set.add(cleanBelongsToName(modName));
      });
    }
    return set;
  }, [compatibleMods, hostName, hostItem?.installed_mods]);

  // Counts
  const installedModsCount = useMemo(() => {
    return compatibleMods.filter((m) => installedModsSet.has(cleanBelongsToName(m.name))).length;
  }, [compatibleMods, installedModsSet]);

  const availableModsCount = compatibleMods.length - installedModsCount;

  // 4. Mode-specific filtered items
  const directLearnedPowers = useMemo(() => {
    return directFunctions.filter((fn) => isGearPowerLearned(fn.name, learnedSlots));
  }, [directFunctions, learnedSlots]);

  const modsWithLearnedPowers = useMemo(() => {
    return compatibleMods.filter((m) => {
      const isInstalled = installedModsSet.has(cleanBelongsToName(m.name));
      if (!isInstalled) return false;
      const modFns = getFunctionsForMod(m.name, functionsCatalog);
      return modFns.some((fn) => isGearPowerLearned(fn.name, learnedSlots));
    });
  }, [compatibleMods, installedModsSet, functionsCatalog, learnedSlots]);

  const totalLearnedOnItem = useMemo(() => {
    let count = directLearnedPowers.length;
    modsWithLearnedPowers.forEach((m) => {
      count += getFunctionsForMod(m.name, functionsCatalog).filter((fn) =>
        isGearPowerLearned(fn.name, learnedSlots)
      ).length;
    });
    return count;
  }, [directLearnedPowers, modsWithLearnedPowers, functionsCatalog, learnedSlots]);

  // If in 'card' or 'manager-active' mode and no learned powers exist on this gear item, do not render
  if ((mode === 'card' || mode === 'manager-active') && totalLearnedOnItem === 0) {
    return null;
  }

  // Pure simple gear with zero compatible mods and zero direct functions
  if (compatibleMods.length === 0 && directFunctions.length === 0) {
    return null;
  }

  const hasMods = compatibleMods.length > 0;

  // Header Title & Stats depending on mode
  const renderHeaderStats = () => {
    if (mode === 'card') {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>🧿</span>
          <span className="font-bold text-slate-200">Installed Mods:</span>
          <span className="text-emerald-400 font-semibold">{modsWithLearnedPowers.length} Active</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-300 font-semibold">{totalLearnedOnItem} Powers Learned</span>
        </div>
      );
    }

    if (mode === 'manager-active') {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>🛡️</span>
          <span className="font-bold text-slate-200">{hostName}</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-semibold">{modsWithLearnedPowers.length} Mods</span>
          <span className="text-slate-600">•</span>
          <span className="text-amber-300 font-semibold">{totalLearnedOnItem} Active Powers</span>
        </div>
      );
    }

    if (mode === 'manager-catalog') {
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>⚙️</span>
          <span className="font-bold text-slate-200">{hostName}</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-semibold">{installedModsCount} Installed</span>
          {availableModsCount > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-indigo-300 font-semibold">{availableModsCount} Available</span>
            </>
          )}
          {totalLearnedOnItem > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-amber-300 font-semibold">{totalLearnedOnItem} Learned</span>
            </>
          )}
        </div>
      );
    }

    // Default 'gear-manager'
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span>{hasMods ? '🔌' : '⚡'}</span>
        {hasMods ? (
          <>
            <span className="font-bold text-slate-200">Compatible Mods:</span>
            <span className="text-emerald-400 font-semibold">{installedModsCount} Installed</span>
            {availableModsCount > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-indigo-300 font-semibold">{availableModsCount} Available</span>
              </>
            )}
            {totalLearnedOnItem > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-amber-300 font-semibold">{totalLearnedOnItem} Powers</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="font-bold text-slate-200">Inherent Gear Powers:</span>
            <span className="text-emerald-400 font-semibold">{directFunctions.length} Installed</span>
          </>
        )}
      </div>
    );
  };

  const isCardOrActiveMode = mode === 'card' || mode === 'manager-active';
  const visibleDirectFunctions = isCardOrActiveMode ? directLearnedPowers : directFunctions;
  const visibleMods = isCardOrActiveMode ? modsWithLearnedPowers : compatibleMods;

  return (
    <div className={`pt-1 border-t border-slate-800/60 flex flex-col gap-1.5 ${className}`}>
      {/* Accordion Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 text-[10px] font-mono transition text-slate-300 hover:text-white cursor-pointer select-none shadow-sm"
      >
        {renderHeaderStats()}
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 2-Level Tree Expanded Container */}
      {isOpen && (
        <div className="flex flex-col gap-1.5 bg-slate-950/70 p-2 rounded-lg border border-slate-800/60 max-h-96 overflow-y-auto">
          {/* LEVEL 1: Inherent Chassis Powers (No Mod) Node */}
          {visibleDirectFunctions.length > 0 && (
            <div className="flex flex-col py-0.5 border-b border-slate-800/40 last:border-none">
              <div className="flex items-center justify-between py-0.5 text-[10px] text-emerald-400">
                <span className="inline-flex items-center align-baseline gap-1 font-mono font-bold truncate">
                  <span>📦 Inherent (No Mod)</span>
                  {hostItem.notes && (
                    <ItemNotesPopover notes={hostItem.notes} itemName={hostName} inline />
                  )}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                  Installed
                </span>
              </div>

              {/* LEVEL 2: Nested Inherent Functions */}
              <div className="flex flex-col gap-1 pl-3 ml-2 border-l-2 border-slate-700/60 my-1">
                {visibleDirectFunctions.map((fn) => {
                  const actionUpper = fn.action ? fn.action.toUpperCase() : null;
                  const actionClass = actionUpper
                    ? ACTION_BADGE_COLORS[actionUpper] || 'bg-slate-800 text-slate-300 border-slate-700'
                    : null;
                  const isLearned = isGearPowerLearned(fn.name, learnedSlots);
                  const learnedSlot = getLearnedGearPower(fn.name, learnedSlots);
                  const usageCount = parseUsageCount(fn.usage);

                  return (
                    <div
                      key={fn.id || fn.name}
                      className="py-1 border-b border-slate-800/30 last:border-none flex flex-col gap-0.5 text-[10px]"
                    >
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <span className="font-semibold text-emerald-300 inline-flex items-center align-baseline gap-1">
                          <span>⚡ {fn.name}</span>
                          {fn.notes && <ItemNotesPopover notes={fn.notes} itemName={fn.name} inline />}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {actionUpper && (
                            <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${actionClass}`}>
                              [{actionUpper}]
                            </span>
                          )}
                          {fn.usage && (
                            <span className="bg-slate-900 text-[8px] font-mono text-amber-300 px-1 py-0.2 rounded border border-slate-800">
                              {fn.usage}
                            </span>
                          )}

                          {/* Mode-specific actions */}
                          {mode === 'card' && usageCount > 0 && (
                            <div className="flex items-center gap-1 ml-1 shrink-0">
                              {Array.from({ length: usageCount }).map((_, bIdx) => {
                                const isChecked = !!(learnedSlot?.checked && learnedSlot.checked[bIdx]);
                                return (
                                  <input
                                    key={bIdx}
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => onTogglePowerUsage && onTogglePowerUsage(fn.name, bIdx)}
                                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                                    title={`Usage ${bIdx + 1} of ${usageCount} (${fn.usage})`}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {mode === 'manager-active' && (
                            <button
                              type="button"
                              onClick={() => onUnlearnPower && onUnlearnPower(fn.name)}
                              className="px-2 py-0.5 rounded font-bold transition text-[9px] border cursor-pointer bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200 shadow-sm"
                              title={`Unlearn ${fn.name} and refund 1 AP`}
                            >
                              Unlearn (1 AP)
                            </button>
                          )}

                          {(mode === 'manager-catalog' || mode === 'gear-manager') && (
                            <>
                              {isLearned ? (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                                  ✓ Known (1 AP)
                                </span>
                              ) : onLearnPower ? (
                                <button
                                  type="button"
                                  disabled={availableAp < 1}
                                  onClick={() => onLearnPower(fn, hostName, '')}
                                  className={`px-2 py-0.5 rounded font-bold transition text-[9px] border cursor-pointer ${
                                    availableAp >= 1
                                      ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/40 text-emerald-200 shadow-sm'
                                      : 'bg-slate-800/80 text-slate-500 border-slate-700/80 opacity-60 cursor-not-allowed'
                                  }`}
                                  title={availableAp >= 1 ? `Learn ${fn.name} for 1 AP` : 'Need at least 1 AP to learn'}
                                >
                                  + Learn (1 AP)
                                </button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                      {fn.effect && (
                        <p className="text-[9px] text-amber-200/90 leading-snug pl-2 border-l border-amber-500/30 font-sans">
                          {fn.effect}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEVEL 1: Compatible Mods Nodes */}
          {visibleMods.map((m) => {
            const isInstalled = installedModsSet.has(cleanBelongsToName(m.name));
            const rawModFunctions = [...getFunctionsForMod(m.name, functionsCatalog)].sort((a, b) =>
              (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
            );
            const modFunctions = isCardOrActiveMode
              ? rawModFunctions.filter((fn) => isGearPowerLearned(fn.name, learnedSlots))
              : rawModFunctions;
            const modKey = String(m.id || m.name);
            const isMsoMod = isGsUnlocked && isMsoEntry(m.name);

            const modCostSilver = parseCostToSilver(m.cost);
            const canAffordMod = modCostSilver <= totalAvailableSilver;
            const formattedCost =
              (m.cost || '').toLowerCase() === 'artifact' ? 'Artifact' : formatCostAbbreviated(m.cost || '0s');

            return (
              <div
                key={modKey}
                className="flex flex-col py-0.5 border-b border-slate-800/40 last:border-none"
              >
                {/* Level 1 Mod Row */}
                <div className="flex items-center justify-between py-1 text-[10px] gap-2">
                  <span
                    className={`inline-flex items-center align-baseline gap-1 font-mono truncate ${
                      isInstalled
                        ? 'text-emerald-400 font-semibold'
                        : isMsoMod
                        ? 'text-purple-300 font-medium'
                        : 'text-indigo-300 font-medium'
                    }`}
                  >
                    <span>{isInstalled ? `✓ ${m.name}` : `🔌 ${m.name} (${m.cost || '0s'})`}</span>
                    {m.notes && <ItemNotesPopover notes={m.notes} itemName={m.name} inline />}
                  </span>

                  {/* Level 1 Mod Action / Status Badge */}
                  <div className="relative flex items-center shrink-0">
                    {isInstalled ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                        Installed
                      </span>
                    ) : onPurchaseMod ? (
                      <>
                        {notEnoughMoneyTarget?.id === modKey && (
                          <div className="absolute bottom-full right-0 mb-1 z-30 px-2 py-0.5 bg-rose-950 border border-rose-500 rounded-lg shadow-xl text-[9px] font-bold text-rose-200 whitespace-nowrap animate-fadeIn flex items-center gap-1 pointer-events-none">
                            <span>❌ Not Enough Money</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => onPurchaseMod(m, hostName, hostItem.category || hostItem.item_type || 'Gear')}
                          className={`px-2 py-0.5 rounded font-bold transition text-[9px] border cursor-pointer ${
                            !canAffordMod
                              ? 'bg-slate-800/80 text-slate-500 border-slate-700/80 opacity-60'
                              : isMsoMod
                              ? 'bg-purple-950/80 hover:bg-purple-900 border-purple-500/40 text-purple-200 shadow-sm'
                              : 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-500/40 text-indigo-200 shadow-sm'
                          }`}
                          title={
                            canAffordMod
                              ? `Install ${m.name} for ${m.cost || '0s'}`
                              : `Not Enough Money (Costs ${m.cost || '0s'}, you have ${totalAvailableSilver}s)`
                          }
                        >
                          +Mod [{formattedCost}]
                        </button>
                      </>
                    ) : (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900 text-indigo-300 border border-indigo-500/30 shrink-0">
                        +{formattedCost}
                      </span>
                    )}
                  </div>
                </div>

                {/* LEVEL 2: Nested Functions under this Mod */}
                {modFunctions.length > 0 && (
                  <div className="flex flex-col gap-1 pl-3 ml-2 border-l-2 border-slate-700/60 my-1">
                    {modFunctions.map((fn) => {
                      const actionUpper = fn.action ? fn.action.toUpperCase() : null;
                      const actionClass = actionUpper
                        ? ACTION_BADGE_COLORS[actionUpper] || 'bg-slate-800 text-slate-300 border-slate-700'
                        : null;
                      const isLearned = isGearPowerLearned(fn.name, learnedSlots);
                      const learnedSlot = getLearnedGearPower(fn.name, learnedSlots);
                      const usageCount = parseUsageCount(fn.usage);

                      return (
                        <div
                          key={fn.id || fn.name}
                          className={`py-1 border-b border-slate-800/30 last:border-none flex flex-col gap-0.5 text-[10px] ${
                            isInstalled ? '' : 'opacity-65'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span
                              className={`font-semibold inline-flex items-center align-baseline gap-1 ${
                                isInstalled ? 'text-emerald-300' : 'text-slate-400 italic'
                              }`}
                            >
                              <span>⚡ {fn.name}</span>
                              {fn.notes && <ItemNotesPopover notes={fn.notes} itemName={fn.name} inline />}
                              {!isInstalled && (
                                <span className="text-[8px] font-mono text-slate-500 font-normal">
                                  (Preview)
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {actionUpper && (
                                <span
                                  className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${actionClass}`}
                                >
                                  [{actionUpper}]
                                </span>
                              )}
                              {fn.usage && (
                                <span className="bg-slate-900 text-[8px] font-mono text-amber-300 px-1 py-0.2 rounded border border-slate-800">
                                  {fn.usage}
                                </span>
                              )}

                              {/* Mode-specific actions */}
                              {mode === 'card' && isInstalled && usageCount > 0 && (
                                <div className="flex items-center gap-1 ml-1 shrink-0">
                                  {Array.from({ length: usageCount }).map((_, bIdx) => {
                                    const isChecked = !!(learnedSlot?.checked && learnedSlot.checked[bIdx]);
                                    return (
                                      <input
                                        key={bIdx}
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => onTogglePowerUsage && onTogglePowerUsage(fn.name, bIdx)}
                                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                                        title={`Usage ${bIdx + 1} of ${usageCount} (${fn.usage})`}
                                      />
                                    );
                                  })}
                                </div>
                              )}

                              {mode === 'manager-active' && isInstalled && (
                                <button
                                  type="button"
                                  onClick={() => onUnlearnPower && onUnlearnPower(fn.name)}
                                  className="px-2 py-0.5 rounded font-bold transition text-[9px] border cursor-pointer bg-rose-950/80 hover:bg-rose-900 border-rose-500/40 text-rose-200 shadow-sm"
                                  title={`Unlearn ${fn.name} and refund 1 AP`}
                                >
                                  Unlearn (1 AP)
                                </button>
                              )}

                              {(mode === 'manager-catalog' || mode === 'gear-manager') && (
                                <>
                                  {isLearned ? (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                                      ✓ Known (1 AP)
                                    </span>
                                  ) : !isInstalled ? (
                                    <span
                                      className="text-[9px] font-mono text-slate-500 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 shrink-0"
                                      title={`Install "${m.name}" to unlock this power`}
                                    >
                                      Mod Required
                                    </span>
                                  ) : onLearnPower ? (
                                    <button
                                      type="button"
                                      disabled={availableAp < 1}
                                      onClick={() => onLearnPower(fn, hostName, m.name)}
                                      className={`px-2 py-0.5 rounded font-bold transition text-[9px] border cursor-pointer ${
                                        availableAp >= 1
                                          ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/40 text-emerald-200 shadow-sm'
                                          : 'bg-slate-800/80 text-slate-500 border-slate-700/80 opacity-60 cursor-not-allowed'
                                      }`}
                                      title={availableAp >= 1 ? `Learn ${fn.name} for 1 AP` : 'Need at least 1 AP to learn'}
                                    >
                                      + Learn (1 AP)
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                          {fn.effect && (
                            <p className="text-[9px] text-amber-200/90 leading-snug pl-2 border-l border-amber-500/30 font-sans">
                              {fn.effect}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};