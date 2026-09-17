// src/components/sheet/GearPowersCard.tsx
import React, { useState, useMemo } from 'react';
import { RotateCcw, Zap, ChevronDown, Sparkles, Search, X } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ManageGearPowersModal } from '../modals/ManageGearPowersModal';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import {
  FunctionItem,
  SimpleGearItem,
  isGearPowerLearned,
  getLearnedGearPower,
  parseAbilityVersion,
} from '../../types/game';
import {
  cleanBelongsToName,
  getFunctionsForGearItem,
  getFunctionsForMod,
  isModCompatibleWithItem,
  isModFreeForHost,
} from '../../utils/gearFunctionSync';
import { ACTION_BADGE_COLORS } from '../../utils/lootAbilityResolver';

export type ExoticFilterMode = 'ALL' | 'MODS_WITH_POWERS' | 'POWERS_ONLY';
export type ExpandCollapseMode = 'expand' | 'collapse';

interface GearPowersCardProps {
  className?: string;
}

const parseUsageCount = (usage?: string): number => {
  if (!usage) return 0;
  const match = usage.trim().match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
};

const cleanName = (name: string) => (name || '').replace(/^[⭕\s]+/, '').trim();

export const GearPowersCard: React.FC<GearPowersCardProps> = ({ className = '' }) => {
  const [chassisSearch, setChassisSearch] = useState('');
  const [exoticFilter, setExoticFilter] = useState<ExoticFilterMode>('ALL');
  const [expandMode, setExpandMode] = useState<ExpandCollapseMode>('expand');
  // Explicit overrides for collapsed status. If key not present, falls back to expandMode === 'collapse'.
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  const toggleItemExpanded = (key: string) => {
    setCollapsedItems((prev) => {
      const isCurrentlyCollapsed = prev[key] !== undefined ? prev[key] : expandMode === 'collapse';
      return { ...prev, [key]: !isCurrentlyCollapsed };
    });
  };

  const {
    activeCharacter,
    modsCatalog,
    functionsCatalog,
    toggleGearPowerUsage,
    clearAllGearPowerUses,
    isExoticGearManagerModalOpen,
    setExoticGearManagerModalOpen,
    exoticGearManagerTargetItem,
  } = useCharacterStore();

  const sheet = activeCharacter?.sheet_data;
  const spellSlots = useMemo(() => (Array.isArray(sheet?.spell_slots) ? sheet.spell_slots : []), [sheet?.spell_slots]);
  const simpleGear = useMemo(() => (Array.isArray(sheet?.simple_gear) ? sheet.simple_gear : []), [sheet?.simple_gear]);

  // Filter owned gear to only those with inherent powers, installed mods, or learned powers (alphabetical A-Z)
  const activeGearItems = useMemo(() => {
    return simpleGear
      .filter((item: SimpleGearItem) => {
        const hostName = item.name || '';
        const cleanHost = cleanBelongsToName(hostName);

        // 1. Any learned slot explicitly rooted in this host gear
        if (spellSlots.some((s) => cleanBelongsToName(s.source_gear) === cleanHost)) {
          return true;
        }

        // 2. Direct inherent powers learned on this chassis
        const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
        if (directFns.some((fn) => isGearPowerLearned(fn.name, spellSlots))) return true;

        // 3. Installed aftermarket mods
        if (Array.isArray(item.installed_mods) && item.installed_mods.length > 0) return true;

        // 4. Compatible mods with inherent free status or installed mods with learned powers
        const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
        if (compMods.some((m) => isModFreeForHost(m, hostName))) return true;

        const installedSet = new Set((item.installed_mods || []).map(cleanBelongsToName));
        return compMods.some((m) => {
          if (!installedSet.has(cleanBelongsToName(m.name))) return false;
          return getFunctionsForMod(m.name, functionsCatalog).some((fn) => isGearPowerLearned(fn.name, spellSlots));
        });
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [simpleGear, functionsCatalog, modsCatalog, spellSlots]);

  // Visible exotic gear items filtered by search query and exotic filter mode
  const visibleGearItems = useMemo(() => {
    return activeGearItems.filter((item) => {
      const hostName = item.name || '';

      // 1. Chassis Search filter (main Exotic Gear Item name only)
      if (chassisSearch.trim()) {
        const q = chassisSearch.trim().toLowerCase();
        if (!hostName.toLowerCase().includes(q)) return false;
      }

      // 2. Direct inherent learned powers on chassis
      const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
      const hasDirectLearned = directFns.some((fn) => isGearPowerLearned(fn.name, spellSlots));

      // 3. Installed mods with learned powers
      const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
      const installedModsSet = new Set<string>();
      compMods.forEach((m) => {
        if (isModFreeForHost(m, hostName)) installedModsSet.add(cleanBelongsToName(m.name));
      });
      if (Array.isArray(item.installed_mods)) {
        item.installed_mods.forEach((mName) => installedModsSet.add(cleanBelongsToName(mName)));
      }
      const hasModLearned = compMods.some((m) => {
        if (!installedModsSet.has(cleanBelongsToName(m.name))) return false;
        return getFunctionsForMod(m.name, functionsCatalog).some((fn) => isGearPowerLearned(fn.name, spellSlots));
      });

      const hasAnyPowers = hasDirectLearned || hasModLearned;

      if (exoticFilter === 'MODS_WITH_POWERS') {
        // Inherent (No Mod) is treated as a mod; show if inherent has powers OR installed mods have powers
        return hasAnyPowers;
      }

      if (exoticFilter === 'POWERS_ONLY') {
        // Must have learned powers
        return hasAnyPowers;
      }

      return true; // 'ALL'
    });
  }, [activeGearItems, chassisSearch, exoticFilter, functionsCatalog, modsCatalog, spellSlots]);

  // Handler to expand or collapse all visible items under active filter
  const handleExpandCollapse = (mode: ExpandCollapseMode) => {
    setExpandMode(mode);
    setCollapsedItems((prev) => {
      const next = { ...prev };
      visibleGearItems.forEach((item) => {
        const key = item.id || item.name;
        next[key] = mode === 'collapse';
      });
      return next;
    });
  };

  // Handler when switching Exotic Filter dropdown
  const handleFilterChange = (newFilter: ExoticFilterMode) => {
    setExoticFilter(newFilter);
    setCollapsedItems((prev) => {
      const next = { ...prev };
      activeGearItems.forEach((item) => {
        const key = item.id || item.name;
        next[key] = expandMode === 'collapse';
      });
      return next;
    });
  };

  // Render individual power card (IDENTICAL to My Powers in AbilitySlotsGrid.tsx with narrowed Col 1)
  const renderPowerCard = (fn: FunctionItem) => {
    const cleaned = cleanName(fn.name);
    const { baseName, version: nameVersion } = parseAbilityVersion(cleaned);
    const learnedSlot = getLearnedGearPower(fn.name, spellSlots);
    const version = Math.max(nameVersion, learnedSlot?.version || 1);
    const actionUpper = (fn.action || '').toUpperCase();
    const actionClass = ACTION_BADGE_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
    const usageCount = parseUsageCount(fn.usage);

    const isFullySpent = (() => {
      if (!fn.usage || !fn.usage.includes('Enc')) return false;
      if (usageCount <= 0) return false;
      const checkedCount = (learnedSlot?.checked || []).filter(Boolean).length;
      return checkedCount >= usageCount;
    })();

    return (
      <div
        key={fn.id || fn.name}
        className={`p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all ${
          isFullySpent ? 'opacity-50 grayscale-[40%]' : ''
        }`}
      >
        {/* 1. Name Column with Version Badge (Narrowed exclusively to absorb left indent) */}
        <div className="w-32 sm:w-40 md:w-52 shrink-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-outfit font-bold text-xs leading-tight text-slate-100">
              {baseName}
            </span>
            {fn.notes && fn.notes.trim() ? (
              <ItemNotesPopover notes={fn.notes} itemName={baseName} inline />
            ) : null}
          </div>
          {version > 1 && (
            <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 w-fit flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
              v{version}
            </span>
          )}
        </div>

        {/* 2. Action Badge Column */}
        <div className="w-12 shrink-0 flex items-center justify-center">
          {actionUpper ? (
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${actionClass}`}>
              {actionUpper}
            </span>
          ) : (
            <span className="text-[10px] text-slate-700 font-mono">-</span>
          )}
        </div>

        {/* 3. Uses Text Column */}
        <div className="w-20 shrink-0 flex items-center justify-start">
          {fn.usage ? (
            <span
              className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 truncate"
              title={fn.usage}
            >
              {fn.usage}
            </span>
          ) : (
            <span className="text-[10px] text-slate-700 font-mono">-</span>
          )}
        </div>

        {/* 4. Checkboxes Column */}
        <div className="w-16 shrink-0 flex items-center gap-1 min-w-[64px]">
          {usageCount > 0 ? (
            Array.from({ length: usageCount }).map((_, bIdx) => {
              const isChecked = !!(learnedSlot?.checked && learnedSlot.checked[bIdx]);
              return (
                <input
                  key={bIdx}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleGearPowerUsage(fn.name, bIdx)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                  title={`Usage slot ${bIdx + 1}`}
                />
              );
            })
          ) : (
            <span className="text-[10px] text-slate-700 font-mono select-none">-</span>
          )}
        </div>

        {/* 5. Effect Description Column */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-300 whitespace-normal break-words leading-relaxed">
            {fn.effect || 'No effect description'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl ${className}`}>
        {/* ================= 1. CARD HEADER ================= */}
        <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-800/80">
          {/* Row 1: Title, Centered Clear Uses, Edit Pencil */}
          <div className="relative flex items-center justify-between gap-3">
            {/* Interactive Clickable Title & Emoji */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setExoticGearManagerModalOpen(true)}
                className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
                title="Click to open Exotic Gear Manager"
              >
                <div className="p-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)] group-hover:scale-105 group-hover:border-cyan-400 transition-all">
                  <span className="text-base leading-none">🧿</span>
                </div>
                <h3 className="font-outfit font-extrabold text-sm tracking-widest text-cyan-200 uppercase group-hover:text-white transition-colors">
                  Exotic Gear
                </h3>
              </button>
            </div>

            {/* Centered Clear Uses Button */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <button
                type="button"
                onClick={clearAllGearPowerUses}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm cursor-pointer whitespace-nowrap"
                title="Reset all tracked uses on learned gear powers"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Clear Uses</span>
              </button>
            </div>

            {/* Minimalist Pencil Action Button */}
            <div>
              <button
                type="button"
                onClick={() => setExoticGearManagerModalOpen(true)}
                className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300 hover:text-white"
                title="Open Exotic Gear Manager"
              >
                <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
              </button>
            </div>
          </div>

          {/* Row 2: Filtering Controls Strip (Chassis Search, Exotic Filter Dropdown, Expand/Collapse Pill Switch) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Chassis Search Box (Searches main Exotic Gear Chassis name only) */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={chassisSearch}
                  onChange={(e) => setChassisSearch(e.target.value)}
                  placeholder="Search chassis..."
                  className="pl-8 pr-7 py-1 text-xs font-medium rounded-lg bg-slate-950/80 border border-slate-750 focus:border-cyan-500/60 text-slate-200 placeholder-slate-500 outline-none transition-all shadow-inner w-32 sm:w-40 md:w-44 font-mono"
                />
                {chassisSearch && (
                  <button
                    type="button"
                    onClick={() => setChassisSearch('')}
                    className="absolute right-2 text-slate-500 hover:text-slate-300 p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* 2. Exotic Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-outfit font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap hidden sm:inline">
                  Exotic Filter:
                </span>
                <select
                  value={exoticFilter}
                  onChange={(e) => handleFilterChange(e.target.value as ExoticFilterMode)}
                  className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer transition-all shadow-sm ${
                    exoticFilter !== 'ALL'
                      ? 'bg-cyan-950/90 border-cyan-400 text-cyan-100 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-extrabold'
                      : 'bg-slate-950/80 border-slate-750 text-slate-300 hover:border-slate-600'
                  }`}
                  title="Filter exotic gear views"
                >
                  <option value="ALL">All</option>
                  <option value="MODS_WITH_POWERS">Mods with Powers</option>
                  <option value="POWERS_ONLY">Powers Only</option>
                </select>
              </div>
            </div>

            {/* 3. Dyslexia-Friendly Expand / Collapse Multi-Option Pill Switch */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => handleExpandCollapse('expand')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  expandMode === 'expand'
                    ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Expand all gear items matching the active filter"
              >
                <span>🔽</span>
                <span>Expand</span>
              </button>
              <button
                type="button"
                onClick={() => handleExpandCollapse('collapse')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  expandMode === 'collapse'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Collapse all gear items matching the active filter"
              >
                <span>🔼</span>
                <span>Collapse</span>
              </button>
            </div>
          </div>
        </div>

        {/* ================= 2. EXOTIC GEAR LIST ================= */}
        <div className="flex flex-col gap-2.5">
          {visibleGearItems.length > 0 ? (
            visibleGearItems.map((item) => {
              const hostName = item.name || '';
              const itemKey = item.id || item.name;
              const isExpanded = collapsedItems[itemKey] !== undefined ? !collapsedItems[itemKey] : expandMode === 'expand';

              // Direct inherent functions
              const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
              const directLearnedPowers = directFns.filter((fn) => isGearPowerLearned(fn.name, spellSlots));

              // Compatible & installed mods
              const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
              const installedModsSet = new Set<string>();
              compMods.forEach((m) => {
                if (isModFreeForHost(m, hostName)) {
                  installedModsSet.add(cleanBelongsToName(m.name));
                }
              });
              if (Array.isArray(item.installed_mods)) {
                item.installed_mods.forEach((modName: string) => {
                  installedModsSet.add(cleanBelongsToName(modName));
                });
              }

              // All installed mods (alphabetical)
              const installedMods = compMods
                .filter((m) => installedModsSet.has(cleanBelongsToName(m.name)))
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

              // Installed mods with learned powers (for MODS_WITH_POWERS)
              const modsToRender = exoticFilter === 'MODS_WITH_POWERS'
                ? installedMods.filter((mod) => {
                    const modFns = getFunctionsForMod(mod.name, functionsCatalog);
                    return modFns.some((fn) => isGearPowerLearned(fn.name, spellSlots));
                  })
                : installedMods;

              // Powers Only: direct flattened list of all learned powers (inherent + mods)
              const allDirectPowers = (() => {
                if (exoticFilter !== 'POWERS_ONLY') return [];
                const list: FunctionItem[] = [...directLearnedPowers];
                installedMods.forEach((mod) => {
                  const modFns = getFunctionsForMod(mod.name, functionsCatalog).sort((a, b) =>
                    (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                  );
                  modFns.forEach((fn) => {
                    if (isGearPowerLearned(fn.name, spellSlots)) {
                      list.push(fn);
                    }
                  });
                });
                return list;
              })();

              return (
                <div key={itemKey} className="flex flex-col gap-2 pb-2 border-b border-slate-800/40 last:border-none">
                  {/* Gear Item Pill Header (Compact w-fit with immediate chevron & Cyan Exotic Glow) */}
                  <button
                    type="button"
                    onClick={() => toggleItemExpanded(itemKey)}
                    className="w-fit inline-flex items-center gap-2 py-1.5 px-3 rounded-xl bg-cyan-950/90 hover:bg-cyan-900/90 border border-cyan-500/60 hover:border-cyan-400 text-xs font-bold text-cyan-100 transition-all shadow-[0_0_14px_rgba(6,182,212,0.25)] cursor-pointer select-none group"
                  >
                    <span className="truncate">{item.name}</span>
                    {item.notes && item.notes.trim() ? (
                      <ItemNotesPopover notes={item.notes} itemName={item.name} inline />
                    ) : null}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-200 transition-transform shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Contents: Vertical Guide Line from Gear Item down across all Mods */}
                  {isExpanded && (
                    <div className="ml-8 sm:ml-9 pl-4 sm:pl-5 border-l-2 border-cyan-500/40 flex flex-col gap-3 pt-1.5 pb-1">
                      {exoticFilter === 'POWERS_ONLY' ? (
                        /* POWERS ONLY: Direct flat power list under each chassis without mod subheaders */
                        <div className="flex flex-col gap-2">
                          {allDirectPowers.map((fn) => renderPowerCard(fn))}
                        </div>
                      ) : (
                        /* ALL or MODS_WITH_POWERS: Subheaders for Inherent and Mods */
                        <>
                          {/* LEVEL 1: Inherent Chassis Powers (No Mod) */}
                          {directLearnedPowers.length > 0 && (
                            <div className="flex flex-col gap-2">
                              {/* Mod Header: Inherent (No Mod) in Warm Amber without emoji */}
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-mono tracking-wide py-0.5">
                                <span>Inherent (No Mod)</span>
                              </div>

                              {/* Indented Power Cards (left border under 'h' in Inherent) */}
                              <div className="flex flex-col gap-2 pl-3.5 sm:pl-4">
                                {directLearnedPowers.map((fn) => renderPowerCard(fn))}
                              </div>
                            </div>
                          )}

                          {/* LEVEL 1: Installed Mods */}
                          {modsToRender.map((mod) => {
                            const modFns = getFunctionsForMod(mod.name, functionsCatalog).sort((a, b) =>
                              (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                            );
                            const modLearnedPowers = modFns.filter((fn) => isGearPowerLearned(fn.name, spellSlots));

                            return (
                              <div key={mod.id || mod.name} className="flex flex-col gap-2">
                                {/* Mod Header: Mod Name in Warm Amber without emoji + ℹ️ only if note exists */}
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-mono tracking-wide py-0.5">
                                  <span>{mod.name}</span>
                                  {mod.notes && mod.notes.trim() ? (
                                    <ItemNotesPopover notes={mod.notes} itemName={mod.name} inline />
                                  ) : null}
                                </div>

                                {/* Indented Power Cards (left border under 'h' in Inherent) */}
                                {modLearnedPowers.length > 0 && (
                                  <div className="flex flex-col gap-2 pl-3.5 sm:pl-4">
                                    {modLearnedPowers.map((fn) => renderPowerCard(fn))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-slate-950/40 border border-slate-800/60 rounded-xl">
              <Zap className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
              <p className="font-semibold text-xs text-slate-300">
                {chassisSearch
                  ? `No exotic gear matching "${chassisSearch}"`
                  : exoticFilter === 'MODS_WITH_POWERS'
                  ? 'No exotic gear with learned mod powers'
                  : exoticFilter === 'POWERS_ONLY'
                  ? 'No exotic gear with learned combat powers'
                  : 'No Exotic Gear'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                {chassisSearch
                  ? 'Try clearing or changing your chassis search query.'
                  : 'Exotic gear chassis and mods provide specialized combat powers for 1 AP each.'}
              </p>
              {chassisSearch ? (
                <button
                  type="button"
                  onClick={() => setChassisSearch('')}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition shadow-sm cursor-pointer"
                >
                  Clear Chassis Search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setExoticGearManagerModalOpen(true)}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 transition shadow-sm cursor-pointer"
                >
                  Open Exotic Gear Manager
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Exotic Gear Manager Modal */}
      {isExoticGearManagerModalOpen && (
        <ManageGearPowersModal
          isOpen={isExoticGearManagerModalOpen}
          onClose={() => setExoticGearManagerModalOpen(false)}
          initialTargetItem={exoticGearManagerTargetItem}
        />
      )}
    </>
  );
};
