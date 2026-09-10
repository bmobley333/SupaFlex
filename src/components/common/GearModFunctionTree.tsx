// src/components/common/GearModFunctionTree.tsx
// Authoritative, DRY 2-level hierarchy tree (Chassis -> Mod -> Functions)
// Supports Standard Gear (with mods), Exotics, and Artifacts.

import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { ItemNotesPopover } from './ItemNotesPopover';
import { ModItem, FunctionItem, SimpleGearItem } from '../../types/game';
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

interface GearModFunctionTreeProps {
  hostItem: SimpleGearItem | any;
  modsCatalog: ModItem[];
  functionsCatalog: FunctionItem[];
  isEditable?: boolean;
  onPurchaseMod?: (modItem: ModItem, hostName: string, hostCategory?: string) => void;
  notEnoughMoneyTarget?: { id: string } | null;
  totalAvailableSilver?: number;
  isGsUnlocked?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const GearModFunctionTree: React.FC<GearModFunctionTreeProps> = ({
  hostItem,
  modsCatalog = [],
  functionsCatalog = [],
  isEditable = false,
  onPurchaseMod,
  notEnoughMoneyTarget,
  totalAvailableSilver = 0,
  isGsUnlocked = false,
  defaultExpanded = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  const hostName = hostItem?.name || hostItem?.title || '';

  // 1. Direct inherent functions belonging to the chassis without any mod
  const directFunctions = useMemo(() => {
    return getFunctionsForGearItem(hostName, functionsCatalog);
  }, [hostName, functionsCatalog]);

  // 2. Compatible mods from catalog
  const compatibleMods = useMemo(() => {
    return modsCatalog.filter((m) => isModCompatibleWithItem(m, hostItem));
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

  // Calculate total functions count (direct + installed mods' functions)
  const totalActiveFunctionsCount = useMemo(() => {
    let count = directFunctions.length;
    compatibleMods.forEach((m) => {
      if (installedModsSet.has(cleanBelongsToName(m.name))) {
        count += getFunctionsForMod(m.name, functionsCatalog).length;
      }
    });
    return count;
  }, [directFunctions, compatibleMods, installedModsSet, functionsCatalog]);

  // Case A: Pure simple gear with zero compatible mods and zero direct functions
  if (compatibleMods.length === 0 && directFunctions.length === 0) {
    return null;
  }

  const hasMods = compatibleMods.length > 0;
  const hasDirectFunctions = directFunctions.length > 0;

  return (
    <div className={`pt-1 border-t border-slate-800/60 flex flex-col gap-1.5 ${className}`}>
      {/* Accordion Toggle Bar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 text-[10px] font-mono transition text-slate-300 hover:text-white cursor-pointer select-none shadow-sm"
      >
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
              {totalActiveFunctionsCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-300 font-semibold">{totalActiveFunctionsCount} Functions</span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="font-bold text-slate-200">Inherent Functions:</span>
              <span className="text-emerald-400 font-semibold">{directFunctions.length} Installed</span>
            </>
          )}
        </div>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 2-Level Tree Expanded Container */}
      {isOpen && (
        <div className="flex flex-col gap-1.5 bg-slate-950/70 p-2 rounded-lg border border-slate-800/60 max-h-80 overflow-y-auto">
          {/* LEVEL 1: Inherent Chassis Functions (No Mod) Node */}
          {hasDirectFunctions && (
            <div className="flex flex-col py-0.5 border-b border-slate-800/40 last:border-none">
              {/* Single row on Level 1 */}
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
                {directFunctions.map((fn) => {
                  const actionUpper = fn.action ? fn.action.toUpperCase() : null;
                  const actionClass = actionUpper
                    ? ACTION_BADGE_COLORS[actionUpper] || 'bg-slate-800 text-slate-300 border-slate-700'
                    : null;

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
                        <div className="flex items-center gap-1 shrink-0">
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
                          {fn.tier && (
                            <span className="text-[8px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-900 text-cyan-300 border border-cyan-500/30">
                              {fn.tier}
                            </span>
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
          {compatibleMods.map((m) => {
            const isInstalled = installedModsSet.has(cleanBelongsToName(m.name));
            const modFunctions = getFunctionsForMod(m.name, functionsCatalog);
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
                {/* Level 1 Mod Row (Single Row for UI density) */}
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

                  {/* Level 1 Action/Status Badge */}
                  <div className="relative flex items-center shrink-0">
                    {isInstalled ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shrink-0">
                        Installed
                      </span>
                    ) : isEditable ? (
                      <>
                        {notEnoughMoneyTarget?.id === modKey && (
                          <div className="absolute bottom-full right-0 mb-1 z-30 px-2 py-0.5 bg-rose-950 border border-rose-500 rounded-lg shadow-xl text-[9px] font-bold text-rose-200 whitespace-nowrap animate-fadeIn flex items-center gap-1 pointer-events-none">
                            <span>❌ Not Enough Money</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onPurchaseMod) {
                              onPurchaseMod(m, hostName, hostItem.category || hostItem.item_type || 'Gear');
                            }
                          }}
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

                {/* LEVEL 2: Nested Functions under this Mod (Only if mod has functions!) */}
                {modFunctions.length > 0 && (
                  <div className="flex flex-col gap-1 pl-3 ml-2 border-l-2 border-slate-700/60 my-1">
                    {modFunctions.map((fn) => {
                      const actionUpper = fn.action ? fn.action.toUpperCase() : null;
                      const actionClass = actionUpper
                        ? ACTION_BADGE_COLORS[actionUpper] || 'bg-slate-800 text-slate-300 border-slate-700'
                        : null;

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
                            <div className="flex items-center gap-1 shrink-0">
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
                              {fn.tier && (
                                <span className="text-[8px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-900 text-cyan-300 border border-cyan-500/30">
                                  {fn.tier}
                                </span>
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