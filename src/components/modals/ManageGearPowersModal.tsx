// src/components/modals/ManageGearPowersModal.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Zap, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { GearModFunctionTree } from '../common/GearModFunctionTree';
import { calculateAvailableAp, isGearPowerLearned, cleanAbilityName, SimpleGearItem, AbilitySlot, ApLogEntry, FunctionItem, ModItem } from '../../types/game';
import {
  cleanBelongsToName,
  getFunctionsForGearItem,
  getFunctionsForMod,
  isModCompatibleWithItem,
  isModFreeForHost,
  isBelongsToMatch,
  reconcileCharacterVaultWithGear,
} from '../../utils/gearFunctionSync';
import { gameApi } from '../../services/api';

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
    updateActiveSheetData,
    saveActiveCharacter,
  } = useCharacterStore();

  // Self-healing catalogs: ensure functions & mods are populated even if store cache was cold
  const [localFunctions, setLocalFunctions] = useState<FunctionItem[]>(functionsCatalog);
  const [localMods, setLocalMods] = useState<ModItem[]>(modsCatalog);

  useEffect(() => {
    if (functionsCatalog && functionsCatalog.length > 0) {
      setLocalFunctions(functionsCatalog);
    } else {
      gameApi.getGearPowers().then((data) => {
        if (data && data.length > 0) setLocalFunctions(data);
      });
    }
  }, [functionsCatalog]);

  useEffect(() => {
    if (modsCatalog && modsCatalog.length > 0) {
      setLocalMods(modsCatalog);
    } else {
      gameApi.getMods().then((data) => {
        if (data && data.length > 0) setLocalMods(data);
      });
    }
  }, [modsCatalog]);

  const effectiveFunctions = localFunctions.length > 0 ? localFunctions : functionsCatalog;
  const effectiveMods = localMods.length > 0 ? localMods : modsCatalog;

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

  // Drop gear item with AP refund for any learned powers on it
  const handleDropGearItem = (item: SimpleGearItem) => {
    const cleanHost = cleanBelongsToName(item.name);
    const directFns = getFunctionsForGearItem(item.name, effectiveFunctions);
    const directFnNames = new Set(directFns.map((f) => cleanAbilityName(f.name)));

    const compMods = effectiveMods.filter((m) => isModCompatibleWithItem(m, item));
    const modFnNames = new Set<string>();
    compMods.forEach((m) => {
      getFunctionsForMod(m.name, effectiveFunctions).forEach((f) => {
        modFnNames.add(cleanAbilityName(f.name));
      });
    });

    // Determine learned powers rooted in this gear item or installed mods
    const droppedSlots: AbilitySlot[] = [];
    const remainingSlots: AbilitySlot[] = [];

    spellSlots.forEach((slot) => {
      const slotTargetName = cleanAbilityName(slot.name);
      const slotBaseTarget = cleanAbilityName(slot.base_name);
      const slotSourceGearClean = cleanBelongsToName(slot.source_gear);

      const belongsToItem =
        slotSourceGearClean === cleanHost ||
        directFnNames.has(slotTargetName) ||
        directFnNames.has(slotBaseTarget) ||
        modFnNames.has(slotTargetName) ||
        modFnNames.has(slotBaseTarget) ||
        (Boolean((slot as any).source) && cleanBelongsToName((slot as any).source).includes(cleanHost));

      if (belongsToItem) {
        droppedSlots.push(slot);
      } else {
        remainingSlots.push(slot);
      }
    });

    const refundAp = droppedSlots.length;
    const refundEntry: ApLogEntry | null =
      refundAp > 0
        ? {
            id: `refund_gear_powers_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            cost: -refundAp,
            category: 'Gear Powers',
            description: `Refund ${refundAp} AP from dropped gear: ${item.name}`,
            tier: 'Manual',
            source: item.name,
            timestamp: new Date().toISOString(),
          }
        : null;

    const remainingGear = simpleGear.filter((g) => {
      if (g.id && item.id && g.id === item.id) return false;
      if (cleanBelongsToName(g.name) === cleanHost) return false;
      if (g.name && g.name.endsWith(`(${item.name})`)) return false;
      if (isBelongsToMatch(g.belongs_to, item.name, true)) return false;
      return true;
    });

    updateActiveSheetData((prev) => {
      const intermediateSheet = {
        ...prev,
        simple_gear: remainingGear,
        spell_slots: remainingSlots,
        ap_log: [
          ...(Array.isArray(prev.ap_log) ? prev.ap_log : []),
          ...(refundEntry ? [refundEntry] : []),
        ],
      };
      return reconcileCharacterVaultWithGear(intermediateSheet, effectiveFunctions, effectiveMods).updatedSheet;
    });
    saveActiveCharacter();
  };

  // Owned gear with installed mods OR at least one learned power for the left column (alphabetical A-Z)
  const leftGearItems = useMemo(() => {
    const query = leftSearch.trim().toLowerCase();
    return simpleGear
      .filter((item) => {
        const hostName = item.name || '';
        const cleanHost = cleanBelongsToName(hostName);

        // 1. Check installed mods (user explicitly owns mods on this gear item)
        const compMods = effectiveMods.filter((m) => isModCompatibleWithItem(m, item));
        const installedSet = new Set((item.installed_mods || []).map(cleanBelongsToName));
        const hasInstalledMods =
          (Array.isArray(item.installed_mods) && item.installed_mods.length > 0) ||
          compMods.some((m) => isModFreeForHost(m, hostName));

        // 2. Check learned powers rooted in this gear item or installed mods
        const hasDirectSlot = spellSlots.some((s) => cleanBelongsToName(s.source_gear) === cleanHost);
        const directFns = getFunctionsForGearItem(hostName, effectiveFunctions);
        const directLearned = directFns.some((fn) => isGearPowerLearned(fn.name, spellSlots));

        const modLearned = compMods.some((m) => {
          if (!installedSet.has(cleanBelongsToName(m.name))) return false;
          return getFunctionsForMod(m.name, effectiveFunctions).some((fn) => isGearPowerLearned(fn.name, spellSlots));
        });

        const hasAnyActive = hasInstalledMods || hasDirectSlot || directLearned || modLearned;
        if (!hasAnyActive) return false;

        if (query) {
          const matchesHost = hostName.toLowerCase().includes(query);
          const matchesModName = compMods.some(
            (m) => installedSet.has(cleanBelongsToName(m.name)) && m.name.toLowerCase().includes(query)
          );
          const matchesDirectFn = directFns.some((fn) => fn.name.toLowerCase().includes(query));
          const matchesModPower = compMods.some((m) =>
            installedSet.has(cleanBelongsToName(m.name)) &&
            getFunctionsForMod(m.name, effectiveFunctions).some((fn) => fn.name.toLowerCase().includes(query))
          );
          if (!matchesHost && !matchesModName && !matchesDirectFn && !matchesModPower) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [simpleGear, leftSearch, spellSlots, effectiveFunctions, effectiveMods]);

  // Owned gear that has mods and/or gear powers for the right "My Exotic Gear" column (alphabetical A-Z)
  const rightGearItems = useMemo(() => {
    const query = rightSearch.trim().toLowerCase();
    return simpleGear
      .filter((item) => {
        const hostName = item.name || '';
        const directFns = getFunctionsForGearItem(hostName, effectiveFunctions);
        const compMods = effectiveMods.filter((m) => isModCompatibleWithItem(m, item));
        const hasInstalledMods = Array.isArray(item.installed_mods) && item.installed_mods.length > 0;

        // Must have at least 1 mod (compatible or installed) or 1 gear power
        const hasModsOrPowers = directFns.length > 0 || compMods.length > 0 || hasInstalledMods;
        if (!hasModsOrPowers) return false;

        if (query) {
          const matchesHost = hostName.toLowerCase().includes(query);
          const matchesMod = compMods.some((m) => m.name.toLowerCase().includes(query));
          const matchesDirectFn = directFns.some((f) => f.name.toLowerCase().includes(query));
          const matchesModFn = compMods.flatMap((m) => getFunctionsForMod(m.name, effectiveFunctions)).some((f) => f.name.toLowerCase().includes(query));
          if (!matchesHost && !matchesMod && !matchesDirectFn && !matchesModFn) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [simpleGear, rightSearch, effectiveMods, effectiveFunctions]);

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
                      <span className="flex items-center gap-1.5 truncate">
                        <span>🛡️</span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          {item.category || item.item_type || 'Gear'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDropGearItem(item)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors cursor-pointer"
                          title={`Drop ${item.name} (refunds AP for any learned powers)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <GearModFunctionTree
                      hostItem={item}
                      modsCatalog={effectiveMods}
                      functionsCatalog={effectiveFunctions}
                      mode="manager-active"
                      availableAp={availableAp}
                      learnedSlots={spellSlots}
                      onLearnPower={(fn, hostName, modName) => learnGearPower(fn, hostName, modName)}
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
                      <span className="flex items-center gap-1.5 truncate">
                        <span>⚙️</span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          {item.category || item.item_type || 'Gear'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDropGearItem(item)}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-colors cursor-pointer"
                          title={`Drop ${item.name} (refunds AP for any learned powers)`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <GearModFunctionTree
                      hostItem={item}
                      modsCatalog={effectiveMods}
                      functionsCatalog={effectiveFunctions}
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
