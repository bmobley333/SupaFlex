// src/components/sheet/GearPowersCard.tsx
import React, { useState, useMemo } from 'react';
import { RotateCcw, Zap } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { GearModFunctionTree } from '../common/GearModFunctionTree';
import { ManageGearPowersModal } from '../modals/ManageGearPowersModal';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { isGearPowerLearned } from '../../types/game';
import { cleanBelongsToName, getFunctionsForGearItem, getFunctionsForMod, isModCompatibleWithItem } from '../../utils/gearFunctionSync';

interface GearPowersCardProps {
  className?: string;
}

export const GearPowersCard: React.FC<GearPowersCardProps> = ({ className = '' }) => {
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

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

  // Filter owned gear to only those with at least 1 learned gear power (alphabetical A-Z)
  const activeGearItems = useMemo(() => {
    return simpleGear
      .filter((item) => {
        const hostName = item.name || '';
        const cleanHost = cleanBelongsToName(hostName);

        // Check if any learned slot explicitly names this host gear
        if (spellSlots.some((s) => cleanBelongsToName(s.source_gear) === cleanHost)) {
          return true;
        }

        const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
        if (directFns.some((fn) => isGearPowerLearned(fn.name, spellSlots))) return true;

        const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
        const installedSet = new Set((item.installed_mods || []).map(cleanBelongsToName));
        return compMods.some((m) => {
          if (!installedSet.has(cleanBelongsToName(m.name))) return false;
          return getFunctionsForMod(m.name, functionsCatalog).some((fn) => isGearPowerLearned(fn.name, spellSlots));
        });
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [simpleGear, functionsCatalog, modsCatalog, spellSlots]);

  return (
    <>
      <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl ${className}`}>
        {/* ================= 1. CARD HEADER ================= */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80 flex-wrap">
          {/* Interactive Clickable Title & Emoji */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
              title="Click to open Gear Powers Manager"
            >
              <div className="p-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)] group-hover:scale-105 group-hover:border-cyan-400 transition-all">
                <span className="text-base leading-none">🧿</span>
              </div>
              <h3 className="font-outfit font-extrabold text-sm tracking-widest text-cyan-200 uppercase group-hover:text-white transition-colors">
                Gear Powers
              </h3>
            </button>
          </div>

          {/* Action Buttons: Clear Uses & Canonical Pencil Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearAllGearPowerUses}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm cursor-pointer"
              title="Reset all tracked uses on learned gear powers"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Clear Uses</span>
            </button>

            {/* Minimalist Pencil Action Button */}
            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300 hover:text-white"
              title="Open Gear Powers Manager"
            >
              <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
            </button>
          </div>
        </div>

        {/* ================= 2. ACTIVE GEAR CARDS LIST ================= */}
        <div className="flex flex-col gap-3">
          {activeGearItems.length > 0 ? (
            activeGearItems.map((item) => {
              const hostName = item.name || '';
              // Count learned powers on this item
              const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
              const directCount = directFns.filter((fn) => isGearPowerLearned(fn.name, spellSlots)).length;
              const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
              const installedSet = new Set((item.installed_mods || []).map(cleanBelongsToName));
              const modCount = compMods.reduce((sum, m) => {
                if (!installedSet.has(cleanBelongsToName(m.name))) return sum;
                return sum + getFunctionsForMod(m.name, functionsCatalog).filter((fn) => isGearPowerLearned(fn.name, spellSlots)).length;
              }, 0);
              const itemTotalLearned = directCount + modCount;

              return (
                <div
                  key={item.id || item.name}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛡️</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          {item.name}
                          {item.notes && <ItemNotesPopover notes={item.notes} itemName={item.name} inline />}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          {item.category || item.item_type || 'Gear'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">
                      {itemTotalLearned} Learned
                    </span>
                  </div>

                  <GearModFunctionTree
                    hostItem={item}
                    modsCatalog={modsCatalog}
                    functionsCatalog={functionsCatalog}
                    mode="card"
                    learnedSlots={spellSlots}
                    onTogglePowerUsage={toggleGearPowerUsage}
                    defaultExpanded={true}
                  />
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-slate-950/40 border border-slate-800/60 rounded-xl">
              <Zap className="w-8 h-8 text-slate-600 mb-2 opacity-50" />
              <p className="font-semibold text-xs text-slate-300">No Gear Powers Learned</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                Gear powers cost 1 AP each and stem from your owned equipment chassis and installed mods.
              </p>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 transition shadow-sm cursor-pointer"
              >
                Open Gear Powers Manager
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Manage Gear Powers Modal */}
      <ManageGearPowersModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
      />
    </>
  );
};
