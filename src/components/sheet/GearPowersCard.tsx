// src/components/sheet/GearPowersCard.tsx
import React, { useState, useMemo } from 'react';
import { RotateCcw, Settings, Zap } from 'lucide-react';
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

  // Filter owned gear to only those with at least 1 learned gear power
  const activeGearItems = useMemo(() => {
    return simpleGear.filter((item) => {
      const hostName = item.name || '';
      const directFns = getFunctionsForGearItem(hostName, functionsCatalog);
      if (directFns.some((fn) => isGearPowerLearned(fn.name, spellSlots))) return true;

      const compMods = modsCatalog.filter((m) => isModCompatibleWithItem(m, item));
      const installedSet = new Set((item.installed_mods || []).map(cleanBelongsToName));
      return compMods.some((m) => {
        if (!installedSet.has(cleanBelongsToName(m.name))) return false;
        return getFunctionsForMod(m.name, functionsCatalog).some((fn) => isGearPowerLearned(fn.name, spellSlots));
      });
    });
  }, [simpleGear, functionsCatalog, modsCatalog, spellSlots]);

  const totalLearnedPowersCount = spellSlots.length;

  return (
    <>
      <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl ${className}`}>
        {/* ================= 1. CARD HEADER ================= */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/80 flex-wrap">
          {/* Title & Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">🧿</span>
            <h3 className="font-outfit font-black text-sm text-slate-100 uppercase tracking-wider">
              Gear Powers
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
              {totalLearnedPowersCount} Powers Learned
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
              {activeGearItems.length} Host Items
            </span>
          </div>

          {/* Action Buttons: Clear Uses & Manage Gear Powers */}
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

            <button
              type="button"
              onClick={() => setIsManageModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 hover:text-white transition shadow-sm cursor-pointer"
              title="Open Gear Powers Manager to learn or refund powers"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Manage</span>
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
