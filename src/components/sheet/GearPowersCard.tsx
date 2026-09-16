// src/components/sheet/GearPowersCard.tsx
import React, { useState, useMemo } from 'react';
import { RotateCcw, Zap, ChevronDown, Sparkles } from 'lucide-react';
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
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  // Default all items to expanded (open) on page load. Keys in collapsedItems are explicitly closed.
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  const toggleItemExpanded = (key: string) => {
    setCollapsedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const {
    activeCharacter,
    modsCatalog,
    functionsCatalog,
    toggleGearPowerUsage,
    clearAllGearPowerUses,
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

        // 2. Direct inherent functions on chassis
        const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
        if (directFns.length > 0) return true;

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
        <div className="w-44 sm:w-52 md:w-64 shrink-0 flex flex-col gap-0.5">
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
        <div className="relative flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          {/* Interactive Clickable Title & Emoji */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
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
              onClick={() => setIsManageModalOpen(true)}
              className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300 hover:text-white"
              title="Open Exotic Gear Manager"
            >
              <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
            </button>
          </div>
        </div>

        {/* ================= 2. EXOTIC GEAR LIST ================= */}
        <div className="flex flex-col gap-2.5">
          {activeGearItems.length > 0 ? (
            activeGearItems.map((item) => {
              const hostName = item.name || '';
              const itemKey = item.id || item.name;
              const isExpanded = !collapsedItems[itemKey];

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

              return (
                <div key={itemKey} className="flex flex-col gap-1.5">
                  {/* Gear Item Pill Header (Dropdown Accordion Toggle) */}
                  <button
                    type="button"
                    onClick={() => toggleItemExpanded(itemKey)}
                    className="w-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 py-1.5 px-3 rounded-xl flex items-center justify-between text-xs font-bold text-slate-200 transition-all shadow-inner cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{item.name}</span>
                      {item.notes && item.notes.trim() ? (
                        <ItemNotesPopover notes={item.notes} itemName={item.name} inline />
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Contents when Expanded */}
                  {isExpanded && (
                    <div className="flex flex-col gap-3 pt-1 pb-1">
                      {/* LEVEL 1: Inherent Chassis Powers (No Mod) */}
                      {directFns.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {/* Mod Header: 📦 Inherent (No Mod) without ℹ️ icon */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 py-0.5 pl-1">
                            <span>📦 Inherent (No Mod)</span>
                          </div>

                          {/* Indented Power Cards (if any learned) */}
                          {directLearnedPowers.length > 0 && (
                            <div className="flex flex-col gap-2 pl-4 sm:pl-6 ml-2 border-l-2 border-slate-800/60 my-1">
                              {directLearnedPowers.map((fn) => renderPowerCard(fn))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* LEVEL 1: Installed Mods */}
                      {installedMods.map((mod) => {
                        const modFns = getFunctionsForMod(mod.name, functionsCatalog).sort((a, b) =>
                          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                        );
                        const modLearnedPowers = modFns.filter((fn) => isGearPowerLearned(fn.name, spellSlots));

                        return (
                          <div key={mod.id || mod.name} className="flex flex-col gap-1.5">
                            {/* Mod Header: Mod Name + ℹ️ only if note exists */}
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 py-0.5 pl-1">
                              <span className="text-indigo-300 font-mono">🔌 {mod.name}</span>
                              {mod.notes && mod.notes.trim() ? (
                                <ItemNotesPopover notes={mod.notes} itemName={mod.name} inline />
                              ) : null}
                            </div>

                            {/* Indented Power Cards (if any learned) */}
                            {modLearnedPowers.length > 0 && (
                              <div className="flex flex-col gap-2 pl-4 sm:pl-6 ml-2 border-l-2 border-slate-800/60 my-1">
                                {modLearnedPowers.map((fn) => renderPowerCard(fn))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-slate-950/40 border border-slate-800/60 rounded-xl">
              <Zap className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
              <p className="font-semibold text-xs text-slate-300">No Exotic Gear</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                Exotic gear chassis and mods provide specialized combat powers for 1 AP each.
              </p>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 transition shadow-sm cursor-pointer"
              >
                Open Exotic Gear Manager
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exotic Gear Manager Modal */}
      <ManageGearPowersModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </>
  );
};
