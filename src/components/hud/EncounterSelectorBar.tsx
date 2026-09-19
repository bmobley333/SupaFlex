// src/components/hud/EncounterSelectorBar.tsx
// High-Density Encounter Selector Dropdown & Stepper for Title Bars

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Plus,
  Swords,
  Trash2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';

interface EncounterSelectorBarProps {
  className?: string;
}

export const EncounterSelectorBar: React.FC<EncounterSelectorBarProps> = ({ className = '' }) => {
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());
  const activeMonsters = useAdventureStore((state) => state.getActiveMonsters());

  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const ensureAdLibEncounter = useAdventureStore((state) => state.ensureAdLibEncounter);
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
    <div className={`flex items-center gap-1.5 font-outfit ${className}`}>
      {/* Encounter Dropdown */}
      <div className="relative" ref={encMenuRef}>
        <button
          type="button"
          onClick={() => setIsEncMenuOpen(!isEncMenuOpen)}
          className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 cursor-pointer max-w-[210px] shadow-sm"
          title={activeEnc ? `Encounter: ${activeEnc.title}` : 'Select Encounter'}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate text-red-400 font-extrabold">{activeEnc?.title || (activeAct ? 'No Encounters' : 'Select Act')}</span>
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
    </div>
  );
};
