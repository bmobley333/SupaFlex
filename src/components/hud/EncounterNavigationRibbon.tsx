// src/components/hud/EncounterNavigationRibbon.tsx
// High-Density Breadcrumb Navigation Ribbon for rapid Adventure > Act > Encounter switching

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Rocket,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Compass,
  Scroll,
  Swords,
  Check,
} from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';

interface EncounterNavigationRibbonProps {
  partyId?: string;
  onOpenStagingModal: () => void;
  className?: string;
}

export const EncounterNavigationRibbon: React.FC<EncounterNavigationRibbonProps> = ({
  partyId,
  onOpenStagingModal,
  className = '',
}) => {
  const adventures = useAdventureStore((state) => state.adventures);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());
  const activeMonsters = useAdventureStore((state) => state.getActiveMonsters());
  const sessionMode = useAdventureStore((state) => state.sessionMode);

  const selectAdventure = useAdventureStore((state) => state.selectAdventure);
  const selectAct = useAdventureStore((state) => state.selectAct);
  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const nextEncounter = useAdventureStore((state) => state.nextEncounter);
  const prevEncounter = useAdventureStore((state) => state.prevEncounter);
  const deployToLiveParty = useAdventureStore((state) => state.deployToLiveParty);
  const resetGameDayEncounter = useAdventureStore((state) => state.resetGameDayEncounter);

  // Dropdown Open States
  const [isAdvMenuOpen, setIsAdvMenuOpen] = useState(false);
  const [isActMenuOpen, setIsActMenuOpen] = useState(false);
  const [isEncMenuOpen, setIsEncMenuOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

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

  const handleDeploy = async () => {
    if (!partyId) return;
    setIsDeploying(true);
    try {
      await deployToLiveParty(partyId);
      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 2000);
    } finally {
      setIsDeploying(false);
    }
  };

  const acts = activeAdv?.structure?.acts || [];
  const encounters = activeAct?.encounters || [];

  return (
    <div className={`flex flex-col gap-2 font-outfit ${className}`}>
      {/* Top Row: Breadcrumb Dropdowns & Stepping Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 p-2 rounded-xl backdrop-blur-md shadow-sm">
        {/* Left: Breadcrumbs Navigation */}
        <div className="flex items-center flex-wrap gap-1.5 flex-1 min-w-[300px]">
          {/* 1. Adventure Dropdown */}
          <div className="relative" ref={advMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsAdvMenuOpen(!isAdvMenuOpen);
                setIsActMenuOpen(false);
                setIsEncMenuOpen(false);
              }}
              className="px-2.5 py-1 bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 border border-indigo-500/40 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer max-w-[170px] truncate"
              title={activeAdv ? `Adventure: ${activeAdv.title}` : 'Select Adventure'}
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{activeAdv?.title || 'Adventure'}</span>
              <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
            </button>

            {isAdvMenuOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-slate-500 font-bold border-b border-slate-800/80">
                  Select Adventure
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {adventures.map((adv) => (
                    <button
                      key={adv.id}
                      type="button"
                      onClick={() => {
                        selectAdventure(adv.id);
                        setIsAdvMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-slate-900 flex items-center justify-between gap-2 ${
                        adv.id === activeAdv?.id ? 'text-indigo-300 font-bold bg-indigo-950/40' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate">{adv.title}</span>
                      {adv.id === activeAdv?.id && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-800/80 pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdvMenuOpen(false);
                      onOpenStagingModal();
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-900 text-indigo-400 text-[11px] font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Manage / New Adventure...
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="text-slate-600 font-bold text-xs">›</span>

          {/* 2. Act / Chapter Dropdown */}
          <div className="relative" ref={actMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsActMenuOpen(!isActMenuOpen);
                setIsAdvMenuOpen(false);
                setIsEncMenuOpen(false);
              }}
              className="px-2.5 py-1 bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer max-w-[160px] truncate"
              title={activeAct ? `Act/Chapter: ${activeAct.title}` : 'Select Act'}
            >
              <Scroll className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{activeAct?.title || 'Act / Chapter'}</span>
              <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
            </button>

            {isActMenuOpen && (
              <div className="absolute left-0 mt-1 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-slate-500 font-bold border-b border-slate-800/80">
                  Select Act / Chapter
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {acts.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => {
                        selectAct(act.id);
                        setIsActMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-slate-900 flex items-center justify-between gap-2 ${
                        act.id === activeAct?.id ? 'text-amber-300 font-bold bg-amber-950/40' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate">{act.title}</span>
                      {act.id === activeAct?.id && <Check className="w-3 h-3 text-amber-400 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-800/80 pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsActMenuOpen(false);
                      onOpenStagingModal();
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-900 text-amber-400 text-[11px] font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Manage / Add Act...
                  </button>
                </div>
              </div>
            )}
          </div>

          <span className="text-slate-600 font-bold text-xs">›</span>

          {/* 3. Encounter Dropdown */}
          <div className="relative" ref={encMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsEncMenuOpen(!isEncMenuOpen);
                setIsAdvMenuOpen(false);
                setIsActMenuOpen(false);
              }}
              className="px-2.5 py-1 bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border border-rose-500/40 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer max-w-[210px] truncate"
              title={activeEnc ? `Encounter: ${activeEnc.title}` : 'Select Encounter'}
            >
              <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{activeEnc?.title || 'Encounter'}</span>
              <span className="px-1.5 py-0.2 bg-rose-900/80 border border-rose-700 text-[10px] font-mono rounded text-rose-300">
                {activeMonsters.length}
              </span>
              <ChevronDown className="w-3 h-3 text-rose-400 shrink-0" />
            </button>

            {isEncMenuOpen && (
              <div className="absolute left-0 mt-1 w-64 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-slate-500 font-bold border-b border-slate-800/80">
                  Select Encounter
                </div>
                <div className="max-h-52 overflow-y-auto py-1">
                  {encounters.map((enc) => {
                    const count = enc.monsters?.length || 0;
                    return (
                      <button
                        key={enc.id}
                        type="button"
                        onClick={() => {
                          selectEncounter(enc.id);
                          setIsEncMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-900 flex items-center justify-between gap-2 ${
                          enc.id === activeEnc?.id ? 'text-rose-300 font-bold bg-rose-950/40' : 'text-slate-300'
                        }`}
                      >
                        <span className="truncate">{enc.title}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400">({count} m)</span>
                          {enc.id === activeEnc?.id && <Check className="w-3 h-3 text-rose-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-slate-800/80 pt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEncMenuOpen(false);
                      onOpenStagingModal();
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-slate-900 text-rose-400 text-[11px] font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Plus className="w-3 h-3" /> Manage / Add Encounter...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Room Stepping & Action Launchers */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Stepping Buttons */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-lg p-0.5 shadow-inner">
            <button
              type="button"
              onClick={prevEncounter}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title="Previous Encounter (Room Step Back)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="h-3 w-[1px] bg-slate-800 mx-0.5" />
            <button
              type="button"
              onClick={nextEncounter}
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title="Next Encounter (Room Step Forward)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Game Day Reset Button (Visible only in Game Day mode) */}
          {sessionMode === 'game_day' && (
            <button
              type="button"
              onClick={resetGameDayEncounter}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Reset live combat scratchpad back to original encounter template"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset</span>
            </button>
          )}

          {/* 🚀 Deploy to Live Party Button */}
          <button
            type="button"
            onClick={handleDeploy}
            disabled={isDeploying || !partyId}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
              deploySuccess
                ? 'bg-emerald-600 text-white border border-emerald-400/50'
                : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border border-rose-400/40 shadow-rose-950/40'
            }`}
            title="Push this encounter's monsters to the Live Party Screen & Broadcast to Players"
          >
            <Rocket className={`w-3.5 h-3.5 ${isDeploying ? 'animate-bounce' : ''}`} />
            <span>{deploySuccess ? 'Deployed!' : 'Deploy to Live'}</span>
          </button>

          {/* 🎛️ Stage / Edit Studio Modal Launcher */}
          <button
            type="button"
            onClick={onOpenStagingModal}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
            title="Open Master Adventure & Encounter Staging Studio"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Stage / Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
