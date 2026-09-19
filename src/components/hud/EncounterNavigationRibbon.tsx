// src/components/hud/EncounterNavigationRibbon.tsx
// High-Density Breadcrumb Navigation Ribbon focused on Encounter Selection, Stepping, Loot & Notes

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Swords,
  Trash2,
  Edit2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLinksDropdown } from './UniversalLinksDropdown';
import { UniversalLootDropdown } from './UniversalLootDropdown';

export { AdventureActBar } from './AdventureActBar';

interface EncounterNavigationRibbonProps {
  partyId?: string;
  className?: string;
}

export const EncounterNavigationRibbon: React.FC<EncounterNavigationRibbonProps> = ({
  partyId,
  className = '',
}) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());
  const activeMonsters = useAdventureStore((state) => state.getActiveMonsters());

  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const nextEncounter = useAdventureStore((state) => state.nextEncounter);
  const prevEncounter = useAdventureStore((state) => state.prevEncounter);
  const resetEncounterAll = useAdventureStore((state) => state.resetEncounterAll);
  const ensureAdLibEncounter = useAdventureStore((state) => state.ensureAdLibEncounter);

  const addAdventureLink = useAdventureStore((state) => state.addAdventureLink);
  const updateAdventureLink = useAdventureStore((state) => state.updateAdventureLink);
  const deleteAdventureLink = useAdventureStore((state) => state.deleteAdventureLink);
  const reorderAdventureLinkByIndex = useAdventureStore((state) => state.reorderAdventureLinkByIndex);

  const addAdventureLoot = useAdventureStore((state) => state.addAdventureLoot);
  const deleteAdventureLoot = useAdventureStore((state) => state.deleteAdventureLoot);
  const clearAdventureLoot = useAdventureStore((state) => state.clearAdventureLoot);
  const sendLootToPartyVault = useAdventureStore((state) => state.sendLootToPartyVault);

  const addEncounter = useAdventureStore((state) => state.addEncounter);
  const deleteEncounter = useAdventureStore((state) => state.deleteEncounter);
  const renameEncounter = useAdventureStore((state) => state.renameEncounter);
  const reorderEncounterByIndex = useAdventureStore((state) => state.reorderEncounterByIndex);

  const [isEncMenuOpen, setIsEncMenuOpen] = useState(false);
  const encMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (encMenuRef.current && !encMenuRef.current.contains(e.target as Node)) {
        setIsEncMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const encounters = activeAct?.encounters || [];

  return (
    <div className={`flex flex-col gap-1.5 font-outfit ${className}`}>
      {/* Master Ribbon Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl backdrop-blur-md shadow-md">
        {/* Left: Encounter Dropdown + Stepper */}
        <div className="flex items-center flex-wrap gap-2 flex-1 min-w-[260px]">
          <div className="flex items-center gap-1.5">
            {/* Encounter Dropdown */}
            <div className="relative" ref={encMenuRef}>
              <button
                type="button"
                onClick={() => setIsEncMenuOpen(!isEncMenuOpen)}
                className="px-2.5 py-1.5 bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 cursor-pointer min-w-[150px] max-w-[230px]"
                title={activeEnc ? `Encounter: ${activeEnc.title}` : 'Select Encounter'}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{activeEnc?.title || (activeAct ? 'No Encounters' : 'Select Act')}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-1.5 py-0.2 bg-rose-900/80 border border-rose-700 text-[10px] font-mono rounded text-rose-300 font-bold">
                    {activeMonsters.length}
                  </span>
                  <ChevronDown className="w-3 h-3 text-rose-400" />
                </div>
              </button>

              {isEncMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
                  {/* Pinned Top: Create New Encounter */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (activeAdv && activeAct) {
                        const title = prompt('Enter new Encounter title:');
                        await addEncounter(activeAdv.id, activeAct.id, title?.trim() || undefined);
                        setIsEncMenuOpen(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-950/60 text-rose-300 font-bold border-b border-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-400" />
                    <span>+ Create New Encounter</span>
                  </button>

                  {/* Pinned Permanent: Ad-Lib Encounter */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (activeAdv && activeAct) {
                        await ensureAdLibEncounter(activeAdv.id, activeAct.id);
                        setIsEncMenuOpen(false);
                      }
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-rose-950/60 text-amber-300 font-bold border-b border-slate-800/80 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>🎲 Ad-Lib Encounter</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                      Permanent
                    </span>
                  </button>

                  {/* Encounters List with Reorder Up/Down, Edit, Delete */}
                  <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                    {encounters.length === 0 ? (
                      <div className="px-3 py-2 text-slate-500 italic text-center text-xs">
                        No encounters in this act. Click "+ Create New" above.
                      </div>
                    ) : (
                      encounters.map((enc, encIdx) => {
                        const isActive = enc.id === activeEnc?.id;
                        const monsterCount = enc.monsters?.length || 0;
                        return (
                          <div
                            key={enc.id}
                            onClick={() => {
                              selectEncounter(enc.id);
                              setIsEncMenuOpen(false);
                            }}
                            className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-1.5 cursor-pointer hover:bg-slate-900 transition ${
                              isActive ? 'bg-rose-950/50 text-rose-200 font-bold' : 'text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1">
                              <span className="truncate">{enc.title}</span>
                              <span className="text-[10px] px-1 py-0.2 bg-slate-800 rounded font-mono text-slate-400">
                                {monsterCount}m
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={encIdx === 0}
                                onClick={() => activeAdv && activeAct && reorderEncounterByIndex(activeAdv.id, activeAct.id, encIdx, encIdx - 1)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20"
                                title="Move Encounter Up"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                disabled={encIdx === encounters.length - 1}
                                onClick={() => activeAdv && activeAct && reorderEncounterByIndex(activeAdv.id, activeAct.id, encIdx, encIdx + 1)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20"
                                title="Move Encounter Down"
                              >
                                ↓
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (!activeAdv || !activeAct) return;
                                  const newTitle = prompt('Rename Encounter:', enc.title);
                                  if (newTitle?.trim()) {
                                    await renameEncounter(activeAdv.id, activeAct.id, enc.id, newTitle.trim());
                                  }
                                }}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                                title="Rename Encounter"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (!activeAdv || !activeAct) return;
                                  if (confirm(`Delete Encounter "${enc.title}"?`)) {
                                    await deleteEncounter(activeAdv.id, activeAct.id, enc.id);
                                  }
                                }}
                                className="p-1 hover:bg-rose-950/80 rounded text-slate-400 hover:text-rose-300"
                                title="Delete Encounter"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Prev / Next Encounter Stepper (Directly to the RIGHT of Encounter Dropdown) */}
            <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 shadow-inner">
              <button
                type="button"
                onClick={prevEncounter}
                disabled={!activeEnc}
                className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer text-xs font-bold flex items-center gap-0.5 disabled:opacity-30"
                title="Previous Encounter (Traverses across Acts)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <div className="h-3.5 w-[1px] bg-slate-800 mx-0.5" />
              <button
                type="button"
                onClick={nextEncounter}
                disabled={!activeEnc}
                className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer text-xs font-bold flex items-center gap-0.5 disabled:opacity-30"
                title="Next Encounter (Traverses across Acts)"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Center Section: Ad-Lib Encounter Reset Button (Visible when Ad-Lib Encounter is active) */}
        {(activeEnc?.is_adlib || activeEnc?.title === 'Ad-Lib Encounter') && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={async () => {
                if (!activeAdv || !activeAct || !activeEnc) return;
                if (confirm('Reset all Encounter Monsters, Loot, and Notes to empty for this Ad-Lib Encounter?')) {
                  await resetEncounterAll(activeAdv.id, activeAct.id, activeEnc.id);
                }
              }}
              className="px-3 py-1 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/60 hover:border-rose-400 text-rose-200 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer h-[38px] min-w-[150px]"
              title="Reset all Encounter Monsters, Encounter Loot, and Encounter Notes to empty"
            >
              <div className="flex items-center gap-1 text-rose-300 font-extrabold text-[11px] uppercase tracking-wider">
                <RotateCcw className="w-3 h-3 text-rose-400" />
                <span>Ad-Lib Encounter</span>
              </div>
              <span className="text-[10px] font-bold text-rose-400/90 font-mono">Reset All 🧹</span>
            </button>
          </div>
        )}

        {/* Right Section: Adventure Loot Dropdown + Adventure Notes Dropdown */}
        <div className="flex items-center gap-2">
          {/* Adventure Loot Dropdown (Amber Theme) */}
          <UniversalLootDropdown
            label="Adventure Loot"
            loot={activeAdv?.loot || activeAdv?.structure?.loot || []}
            disabled={!activeAdv}
            disabledTooltip="Select an adventure first"
            themeColor="amber"
            onAddLoot={async (item) => {
              if (!activeAdv) return;
              await addAdventureLoot(activeAdv.id, item);
            }}
            onDeleteLoot={async (lootId) => {
              if (!activeAdv) return;
              await deleteAdventureLoot(activeAdv.id, lootId);
            }}
            onClearLoot={async () => {
              if (!activeAdv) return;
              await clearAdventureLoot(activeAdv.id);
            }}
            onSendToPartyVault={async (items, sourceLabel) => {
              return await sendLootToPartyVault(items, partyId || activePartyId || 'default', sourceLabel);
            }}
          />

          {/* Adventure Notes Dropdown (Teal Theme) */}
          <UniversalLinksDropdown
            label="Adventure Notes"
            links={activeAdv?.links || activeAdv?.structure?.links || []}
            disabled={!activeAdv}
            disabledTooltip="Select an adventure first"
            themeColor="teal"
            onAddLink={async (name, url) => {
              if (!activeAdv) return;
              await addAdventureLink(activeAdv.id, name, url);
            }}
            onUpdateLink={async (linkId, name, url) => {
              if (!activeAdv) return;
              await updateAdventureLink(activeAdv.id, linkId, name, url);
            }}
            onDeleteLink={async (linkId) => {
              if (!activeAdv) return;
              await deleteAdventureLink(activeAdv.id, linkId);
            }}
            onReorderLinkByIndex={async (fromIdx, toIdx) => {
              if (!activeAdv) return;
              await reorderAdventureLinkByIndex(activeAdv.id, fromIdx, toIdx);
            }}
          />
        </div>
      </div>
    </div>
  );
};
