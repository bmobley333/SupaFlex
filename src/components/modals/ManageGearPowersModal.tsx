// src/components/modals/ManageGearPowersModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Zap } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { GearModFunctionTree } from '../common/GearModFunctionTree';
import { calculateAvailableAp, isGearPowerLearned } from '../../types/game';
import { cleanBelongsToName, getFunctionsForGearItem, getFunctionsForMod, isModCompatibleWithItem } from '../../utils/gearFunctionSync';

interface ManageGearPowersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageGearPowersModal: React.FC<ManageGearPowersModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');

  const {
    activeCharacter,
    modsCatalog,
    functionsCatalog,
    learnGearPower,
    unlearnGearPower,
    installModToGearItem,
  } = useCharacterStore();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sheet = activeCharacter?.sheet_data;
  const gold = sheet?.gold || 0;
  const silver = sheet?.silver || 0;
  const totalSilver = gold * 100 + silver;
  const availableAp = sheet ? calculateAvailableAp(sheet.level || 1, sheet) : 0;
  const spellSlots = useMemo(() => (Array.isArray(sheet?.spell_slots) ? sheet.spell_slots : []), [sheet?.spell_slots]);
  const simpleGear = useMemo(() => (Array.isArray(sheet?.simple_gear) ? sheet.simple_gear : []), [sheet?.simple_gear]);

  // Owned gear with at least one learned power for the left column (alphabetical A-Z)
  const leftGearItems = useMemo(() => {
    const query = leftSearch.trim().toLowerCase();
    return simpleGear
      .filter((item) => {
        const hostName = item.name || '';
        const cleanHost = cleanBelongsToName(hostName);

        // Check if any learned slot explicitly names this host gear
        const hasDirectSlot = spellSlots.some((s) => cleanBelongsToName(s.source_gear) === cleanHost);
        const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
        const directLearned = directFns.some((fn) => isGearPowerLearned(fn.name, spellSlots));

        const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
        const installedSet = new Set((item.installed_mods || []).map(cleanBelongsToName));
        const modLearned = compMods.some((m) => {
          if (!installedSet.has(cleanBelongsToName(m.name))) return false;
          return getFunctionsForMod(m.name, functionsCatalog).some((fn) => isGearPowerLearned(fn.name, spellSlots));
        });

        const hasAnyLearned = hasDirectSlot || directLearned || modLearned;
        if (!hasAnyLearned) return false;

        if (query) {
          const matchesHost = hostName.toLowerCase().includes(query);
          const matchesDirectFn = directFns.some(
            (fn) => isGearPowerLearned(fn.name, spellSlots) && fn.name.toLowerCase().includes(query)
          );
          const matchesModPower = compMods.some((m) =>
            installedSet.has(cleanBelongsToName(m.name)) &&
            getFunctionsForMod(m.name, functionsCatalog).some(
              (fn) => isGearPowerLearned(fn.name, spellSlots) && fn.name.toLowerCase().includes(query)
            )
          );
          if (!matchesHost && !matchesDirectFn && !matchesModPower) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [simpleGear, leftSearch, spellSlots, functionsCatalog, modsCatalog]);

  // Owned gear that has mods and/or gear powers for the right "My Exotic Gear" column (alphabetical A-Z)
  const rightGearItems = useMemo(() => {
    const query = rightSearch.trim().toLowerCase();
    return simpleGear
      .filter((item) => {
        const hostName = item.name || '';
        const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
        const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));

        // Must have at least 1 mod or 1 gear power
        const hasModsOrPowers = directFns.length > 0 || compMods.length > 0;
        if (!hasModsOrPowers) return false;

        if (query) {
          const matchesHost = hostName.toLowerCase().includes(query);
          const matchesMod = compMods.some((m) => m.name.toLowerCase().includes(query));
          const matchesDirectFn = directFns.some((f) => f.name.toLowerCase().includes(query));
          const matchesModFn = compMods.flatMap((m) => getFunctionsForMod(m.name, functionsCatalog)).some((f) => f.name.toLowerCase().includes(query));
          if (!matchesHost && !matchesMod && !matchesDirectFn && !matchesModFn) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [simpleGear, rightSearch, modsCatalog, functionsCatalog]);

  const totalLearnedCount = spellSlots.length;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] max-h-[820px] flex flex-col shadow-2xl overflow-hidden text-left"
      >
        {/* ================= 1. MODAL TOP BAR ================= */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              <span className="text-xl leading-none">🧿</span>
            </div>
            <div>
              <h3 className="font-outfit font-black text-base text-slate-100 uppercase tracking-wide">
                Gear Powers Manager
              </h3>
              <p className="text-xs text-slate-400">
                Learn 1-AP combat powers rooted in your owned gear chassis and installed mods.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* AP Available Pill */}
            <div className="px-3 py-1 bg-amber-950/60 border border-amber-500/50 rounded-xl font-mono font-black text-xs text-amber-300 shadow-sm flex items-center justify-center shrink-0">
              ⚡ AP {availableAp}
            </div>

            {/* Funds Pill */}
            <div className="px-3 py-1 bg-teal-950/60 border border-teal-500/40 rounded-xl font-mono font-bold text-xs text-teal-300 shadow-sm flex items-center justify-center shrink-0">
              💰 {gold}g {silver}s
            </div>

            {/* Close X */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 2. 2-COLUMN MAIN BODY ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 flex-1 overflow-hidden min-h-0">
          {/* ================= LEFT COLUMN: ACTIVE GEAR POWERS ================= */}
          <div className="flex flex-col bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">⚡</span>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Active Gear Powers
                </h4>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {totalLearnedCount} Learned
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter active gear powers..."
                value={leftSearch}
                onChange={(e) => setLeftSearch(e.target.value)}
                className="w-full bg-slate-900/90 text-xs pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-800 text-white outline-none focus:border-cyan-500 transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
              {leftGearItems.length > 0 ? (
                leftGearItems.map((item) => (
                  <div
                    key={item.id || item.name}
                    className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span>🛡️</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {item.category || item.item_type || 'Gear'}
                      </span>
                    </div>
                    <GearModFunctionTree
                      hostItem={item}
                      modsCatalog={modsCatalog}
                      functionsCatalog={functionsCatalog}
                      mode="manager-active"
                      learnedSlots={spellSlots}
                      onUnlearnPower={unlearnGearPower}
                      defaultExpanded={true}
                    />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-500 text-xs px-4">
                  <Zap className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
                  <p className="font-semibold text-slate-400">No active gear powers learned yet.</p>
                  <p className="text-[11px] mt-1 text-slate-500">
                    Browse your owned gear in the catalog on the right and click "Learn (1 AP)" to activate powers.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: GEAR POWERS CATALOG ================= */}
          <div className="flex flex-col bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 overflow-hidden min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">🧿</span>
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  My Exotic Gear
                </h4>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                {rightGearItems.length} Exotic Items
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter exotic gear, mods, or powers..."
                value={rightSearch}
                onChange={(e) => setRightSearch(e.target.value)}
                className="w-full bg-slate-900/90 text-xs pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-800 text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
              {rightGearItems.length > 0 ? (
                rightGearItems.map((item) => (
                  <div
                    key={item.id || item.name}
                    className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 flex flex-col gap-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span className="flex items-center gap-1.5">
                        <span>⚙️</span>
                        <span>{item.name}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {item.category || item.item_type || 'Gear'}
                      </span>
                    </div>
                    <GearModFunctionTree
                      hostItem={item}
                      modsCatalog={modsCatalog}
                      functionsCatalog={functionsCatalog}
                      mode="manager-catalog"
                      isEditable={true}
                      totalAvailableSilver={totalSilver}
                      availableAp={availableAp}
                      learnedSlots={spellSlots}
                      onPurchaseMod={(mod) => installModToGearItem(mod, item.name)}
                      onLearnPower={(fn, hostName, modName) => learnGearPower(fn, hostName, modName)}
                      defaultExpanded={true}
                    />
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-500 text-xs px-4">
                  <p className="font-semibold text-slate-400">No owned exotic gear items found.</p>
                  <p className="text-[11px] mt-1 text-slate-500">
                    Purchase weapons, armor, shields, or gear with mods/powers from the Gear Manager, or discover exotic loot!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= 3. FOOTER ================= */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
