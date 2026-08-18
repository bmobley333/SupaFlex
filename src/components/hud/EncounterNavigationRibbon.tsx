// src/components/hud/EncounterNavigationRibbon.tsx
// High-Density Breadcrumb Navigation Ribbon with Centered Labels, Right-Adjacent Stepping & In-Dropdown CRUD

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Compass,
  Scroll,
  Swords,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Globe,
} from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLinksDropdown } from './UniversalLinksDropdown';

interface EncounterNavigationRibbonProps {
  partyId?: string;
  className?: string;
}

export const EncounterNavigationRibbon: React.FC<EncounterNavigationRibbonProps> = ({
  className = '',
}) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const adventures = useAdventureStore((state) => state.adventures);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());
  const activeMonsters = useAdventureStore((state) => state.getActiveMonsters());

  const selectAdventure = useAdventureStore((state) => state.selectAdventure);
  const selectAct = useAdventureStore((state) => state.selectAct);
  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const nextEncounter = useAdventureStore((state) => state.nextEncounter);
  const prevEncounter = useAdventureStore((state) => state.prevEncounter);

  const createAdventure = useAdventureStore((state) => state.createAdventure);
  const deleteAdventure = useAdventureStore((state) => state.deleteAdventure);
  const renameAdventure = useAdventureStore((state) => state.renameAdventure);
  const publishAdventure = useAdventureStore((state) => state.publishAdventure);

  const addAdventureLink = useAdventureStore((state) => state.addAdventureLink);
  const updateAdventureLink = useAdventureStore((state) => state.updateAdventureLink);
  const deleteAdventureLink = useAdventureStore((state) => state.deleteAdventureLink);
  const reorderAdventureLinkByIndex = useAdventureStore((state) => state.reorderAdventureLinkByIndex);

  const addAct = useAdventureStore((state) => state.addAct);
  const deleteAct = useAdventureStore((state) => state.deleteAct);
  const renameAct = useAdventureStore((state) => state.renameAct);
  const reorderActByIndex = useAdventureStore((state) => state.reorderActByIndex);

  const addEncounter = useAdventureStore((state) => state.addEncounter);
  const deleteEncounter = useAdventureStore((state) => state.deleteEncounter);
  const renameEncounter = useAdventureStore((state) => state.renameEncounter);
  const reorderEncounterByIndex = useAdventureStore((state) => state.reorderEncounterByIndex);

  // Dropdown open states
  const [isAdvMenuOpen, setIsAdvMenuOpen] = useState(false);
  const [isActMenuOpen, setIsActMenuOpen] = useState(false);
  const [isEncMenuOpen, setIsEncMenuOpen] = useState(false);

  const advMenuRef = useRef<HTMLDivElement>(null);
  const actMenuRef = useRef<HTMLDivElement>(null);
  const encMenuRef = useRef<HTMLDivElement>(null);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (advMenuRef.current && !advMenuRef.current.contains(e.target as Node)) {
        setIsAdvMenuOpen(false);
      }
      if (actMenuRef.current && !actMenuRef.current.contains(e.target as Node)) {
        setIsActMenuOpen(false);
      }
      if (encMenuRef.current && !encMenuRef.current.contains(e.target as Node)) {
        setIsEncMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const acts = activeAdv?.structure?.acts || [];
  const encounters = activeAct?.encounters || [];

  return (
    <div className={`flex flex-col gap-1.5 font-outfit ${className}`}>
      {/* Master Ribbon Bar */}
      <div className="flex flex-wrap items-end justify-between gap-2.5 bg-slate-950/90 border border-slate-800 p-2.5 rounded-xl backdrop-blur-md shadow-md">
        {/* Left: 3 Labeled Dropdowns + Right-Adjacent Stepper */}
        <div className="flex items-end flex-wrap gap-2 flex-1 min-w-[320px]">
          {/* 1. ADVENTURE Dropdown */}
          <div className="flex flex-col items-center gap-1 relative" ref={advMenuRef}>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 font-mono text-center">
              Adventure
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAdvMenuOpen(!isAdvMenuOpen);
                setIsActMenuOpen(false);
                setIsEncMenuOpen(false);
              }}
              className="px-2.5 py-1.5 bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 cursor-pointer min-w-[140px] max-w-[200px]"
              title={activeAdv ? `Adventure: ${activeAdv.title}` : 'Select Adventure'}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">{activeAdv?.title || 'No Adventure'}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
            </button>

            {isAdvMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
                {/* Pinned Top: Create New Adventure */}
                <button
                  type="button"
                  onClick={async () => {
                    const title = prompt('Enter new Adventure title:');
                    if (title?.trim()) {
                      await createAdventure(title.trim(), playerEmail || 'gm@metascape.com');
                      setIsAdvMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-indigo-950/60 text-indigo-300 font-bold border-b border-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>+ Create New Adventure</span>
                </button>

                {/* Adventure List */}
                <div className="max-h-52 overflow-y-auto py-1 space-y-0.5">
                  {adventures.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 italic text-center text-xs">
                      No adventures. Click "+ Create New" above.
                    </div>
                  ) : (
                    adventures.map((adv) => {
                      const isActive = adv.id === activeAdv?.id;
                      return (
                        <div
                          key={adv.id}
                          onClick={() => {
                            selectAdventure(adv.id);
                            setIsAdvMenuOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-1.5 cursor-pointer hover:bg-slate-900 transition ${
                            isActive ? 'bg-indigo-950/50 text-indigo-200 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span className="truncate flex-1">{adv.title}</span>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={async () => {
                                const newName = prompt('Rename Adventure:', adv.title);
                                if (newName?.trim()) {
                                  await renameAdventure(adv.id, newName.trim());
                                }
                              }}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                              title="Rename Adventure"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Delete adventure "${adv.title}"?`)) {
                                  await deleteAdventure(adv.id);
                                }
                              }}
                              className="p-1 hover:bg-rose-950/80 rounded text-slate-400 hover:text-rose-300"
                              title="Delete Adventure"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pinned Bottom: Publish Adventure to Supabase */}
                {activeAdv && (
                  <div className="border-t border-slate-800/80 p-2 bg-slate-900/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextState = !activeAdv.is_published;
                        await publishAdventure(activeAdv.id, nextState);
                      }}
                      className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeAdv.is_published
                          ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/40'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                      title="Publishes this adventure publicly to Supabase so other GMs can discover and clone it."
                    >
                      <Globe className="w-3 h-3" />
                      <span>{activeAdv.is_published ? 'Published to Community ✅' : 'Publish Adventure'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <span className="text-slate-600 font-bold text-xs pb-2">›</span>

          {/* 2. ACT Dropdown */}
          <div className="flex flex-col items-center gap-1 relative" ref={actMenuRef}>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 font-mono text-center">
              Act
            </span>
            <button
              type="button"
              onClick={() => {
                setIsActMenuOpen(!isActMenuOpen);
                setIsAdvMenuOpen(false);
                setIsEncMenuOpen(false);
              }}
              className="px-2.5 py-1.5 bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 cursor-pointer min-w-[130px] max-w-[190px]"
              title={activeAct ? `Act: ${activeAct.title}` : 'Select Act'}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Scroll className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{activeAct?.title || (activeAdv ? 'No Acts' : 'Select Adventure')}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
            </button>

            {isActMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-72 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
                {/* Pinned Top: Create New Act */}
                <button
                  type="button"
                  onClick={async () => {
                    if (activeAdv) {
                      const title = prompt('Enter new Act title:');
                      await addAct(activeAdv.id, title?.trim() || undefined);
                      setIsActMenuOpen(false);
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-amber-950/60 text-amber-300 font-bold border-b border-slate-800/80 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Create New Act</span>
                </button>

                {/* Acts List with In-Dropdown Up/Down, Edit, Delete */}
                <div className="max-h-52 overflow-y-auto py-1 space-y-0.5">
                  {acts.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 italic text-center text-xs">
                      No acts in this adventure. Click "+ Create New" above.
                    </div>
                  ) : (
                    acts.map((act, actIdx) => {
                      const isActive = act.id === activeAct?.id;
                      return (
                        <div
                          key={act.id}
                          onClick={() => {
                            selectAct(act.id);
                            setIsActMenuOpen(false);
                          }}
                          className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-1.5 cursor-pointer hover:bg-slate-900 transition ${
                            isActive ? 'bg-amber-950/50 text-amber-200 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span className="truncate flex-1">{act.title}</span>

                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Reorder Up */}
                            <button
                              type="button"
                              disabled={actIdx === 0}
                              onClick={() => activeAdv && reorderActByIndex(activeAdv.id, actIdx, actIdx - 1)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20"
                              title="Move Act Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>

                            {/* Reorder Down */}
                            <button
                              type="button"
                              disabled={actIdx === acts.length - 1}
                              onClick={() => activeAdv && reorderActByIndex(activeAdv.id, actIdx, actIdx + 1)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20"
                              title="Move Act Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>

                            {/* Rename */}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!activeAdv) return;
                                const newTitle = prompt('Rename Act:', act.title);
                                if (newTitle?.trim()) {
                                  await renameAct(activeAdv.id, act.id, newTitle.trim());
                                }
                              }}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                              title="Rename Act"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!activeAdv) return;
                                if (confirm(`Delete Act "${act.title}" and all its encounters?`)) {
                                  await deleteAct(activeAdv.id, act.id);
                                }
                              }}
                              className="p-1 hover:bg-rose-950/80 rounded text-slate-400 hover:text-rose-300"
                              title="Delete Act"
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

          <span className="text-slate-600 font-bold text-xs pb-2">›</span>

          {/* 3. ENCOUNTER Section + Right-Adjacent Stepper */}
          <div className="flex items-end gap-1.5">
            {/* Encounter Dropdown */}
            <div className="flex flex-col items-center gap-1 relative" ref={encMenuRef}>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-400 font-mono text-center">
                Encounter
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsEncMenuOpen(!isEncMenuOpen);
                  setIsAdvMenuOpen(false);
                  setIsActMenuOpen(false);
                }}
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
                <div className="absolute left-0 top-full mt-1 w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
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
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">({monsterCount}m)</span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Move Up */}
                              <button
                                type="button"
                                disabled={encIdx === 0}
                                onClick={() => activeAdv && activeAct && reorderEncounterByIndex(activeAdv.id, activeAct.id, encIdx, encIdx - 1)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20"
                                title="Move Encounter Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>

                              {/* Move Down */}
                              <button
                                type="button"
                                disabled={encIdx === encounters.length - 1}
                                onClick={() => activeAdv && activeAct && reorderEncounterByIndex(activeAdv.id, activeAct.id, encIdx, encIdx + 1)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20"
                                title="Move Encounter Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>

                              {/* Rename */}
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

                              {/* Delete */}
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

        {/* Right: Adventure Links Dropdown (Teal Theme) */}
        <UniversalLinksDropdown
          label="Adventure Links"
          links={activeAdv?.links || []}
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
  );
};



