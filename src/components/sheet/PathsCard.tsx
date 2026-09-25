// src/components/sheet/PathsCard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ManagePathsModal } from '../modals/ManagePathsModal';
import { isMsoEntry, cleanPathName } from '../../utils/kitUtils';
import { CardHelpButton } from '../common/CardHelpButton';
import { getCharacterKnownPaths, getCharacterKnownSets } from '../../utils/pathApUtils';

interface PathsCardProps {
  className?: string;
}

export const PathsCard: React.FC<PathsCardProps> = ({ className = '' }) => {
  const { activeCharacter, setsCatalog = [], paths: pathsCatalog = [] } = useCharacterStore();
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const [showPathsModal, setShowPathsModal] = useState(false);

  // Listen for global manager events
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'paths' || e.detail === 'kits') setShowPathsModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  const race = activeCharacter?.race || 'Human';
  const charClass = activeCharacter?.class || 'Warrior';
  const isRaceMso = isGsUnlocked && isMsoEntry(race);
  const isClassMso = isGsUnlocked && isMsoEntry(charClass);

  const shipOfficerPath = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    return fromSheet.find((k) => (k || '').toLowerCase().includes('ship officer'));
  }, [activeCharacter?.sheet_data?.favorite_trait_kits]);
  const isShipOfficerMso = isGsUnlocked && shipOfficerPath ? isMsoEntry(shipOfficerPath) : false;

  const extraLearnedPaths = useMemo(() => {
    const fromSheet: string[] = activeCharacter?.sheet_data?.favorite_trait_kits || [];
    return fromSheet.filter((k) => {
      const lower = (k || '').toLowerCase().trim();
      return lower !== 'base' && lower !== 'universal' && k !== race && k !== charClass && k !== shipOfficerPath;
    });
  }, [race, charClass, shipOfficerPath, activeCharacter?.sheet_data?.favorite_trait_kits]);

  const knownPaths = useMemo(() => getCharacterKnownPaths(activeCharacter), [activeCharacter]);
  const knownSets = useMemo(() => getCharacterKnownSets(knownPaths, setsCatalog, pathsCatalog), [knownPaths, setsCatalog, pathsCatalog]);

  if (!activeCharacter) return null;

  return (
    <>
      <div className={`bg-gradient-to-b from-purple-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-purple-500/90 p-3.5 flex items-center justify-between transition-all gap-3 flex-wrap shadow-lg shadow-slate-950/20 ${className}`}>
        {/* Left Zone: 🧭 Paths Header & Active Path Pills */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPathsModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left shrink-0"
            title="Click to open Paths Manager"
          >
            <div className="p-1.5 rounded-xl bg-purple-950/90 border border-purple-500/50 text-purple-300 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.25)] group-hover:scale-105 group-hover:border-purple-400 transition-all shrink-0">
              <span className="text-base leading-none">🧭</span>
            </div>
            <h3 className="font-outfit font-extrabold text-sm tracking-widest text-purple-200 uppercase group-hover:text-white transition-colors">
              Paths
            </h3>
          </button>

          <CardHelpButton ruleKey="paths.basics" />

          {/* Active Path Pills (Species, Class, and optional Ship Officer) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Species / Heritage Path */}
            <button
              type="button"
              onClick={() => setShowPathsModal(true)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                isRaceMso
                  ? 'bg-purple-950/80 hover:bg-purple-900 border border-purple-500/60 text-purple-300 font-extrabold'
                  : 'bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/35 hover:border-purple-400 text-purple-300'
              }`}
              title="Species / Heritage Path"
            >
              <span>{isRaceMso ? '🌌' : '🧬'}</span>
              <span>{race}</span>
            </button>

            {/* Class Path */}
            <button
              type="button"
              onClick={() => setShowPathsModal(true)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                isClassMso
                  ? 'bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/60 text-indigo-300 font-extrabold'
                  : 'bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/35 hover:border-indigo-400 text-indigo-300'
              }`}
              title="Class Path"
            >
              <span>{isClassMso ? '🌌' : '⚔️'}</span>
              <span>{charClass}</span>
            </button>

            {/* Ship Officer Path (only if active/learned) */}
            {shipOfficerPath && (
              <button
                type="button"
                onClick={() => setShowPathsModal(true)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                  isShipOfficerMso
                    ? 'bg-purple-950/80 hover:bg-purple-900 border border-purple-500/60 text-purple-300 font-extrabold'
                    : 'bg-indigo-950/50 hover:bg-indigo-900/60 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200'
                }`}
                title="Ship Officer Path"
              >
                <span>{isShipOfficerMso ? '🌌' : '🚀'}</span>
                <span>{shipOfficerPath}</span>
              </button>
            )}

            {/* Extra Learned Paths */}
            {extraLearnedPaths.map((extra) => {
              const isExtraMso = isGsUnlocked && isMsoEntry(extra);
              return (
                <button
                  key={extra}
                  type="button"
                  onClick={() => setShowPathsModal(true)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                    isExtraMso
                      ? 'bg-purple-950/80 hover:bg-purple-900 border border-purple-500/60 text-purple-300 font-extrabold'
                      : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300'
                  }`}
                  title={`Learned Path: ${extra}`}
                >
                  <span>{isExtraMso ? '🌌' : '🧭'}</span>
                  <span>{cleanPathName(extra)}</span>
                </button>
              );
            })}

            {/* Unlocked Sets Pill */}
            {knownSets.size > 0 && (
              <button
                type="button"
                onClick={() => setShowPathsModal(true)}
                className="px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300"
                title={`${knownSets.size} Sets Unlocked: ${Array.from(knownSets).slice(0, 5).join(', ')}${knownSets.size > 5 ? '...' : ''}`}
              >
                <span>🗂️</span>
                <span>{knownSets.size} Sets</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Zone: Edit Pencil Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPathsModal(true)}
            className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm bg-purple-950/80 hover:bg-purple-900/90 border-purple-500/40 hover:border-purple-400 text-purple-200 hover:text-white cursor-pointer group"
            title="Manage Paths (Species, Class, and Learned Paths)"
          >
            <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
          </button>
        </div>
      </div>

      {showPathsModal && (
        <ManagePathsModal
          isOpen={showPathsModal}
          onClose={() => setShowPathsModal(false)}
        />
      )}
    </>
  );
};
