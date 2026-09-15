import React, { useState } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLinksModal } from '../modals/UniversalLinksModal';
import { calculateAvailableAp } from '../../types/game';

export interface CharacterCardProps {
  onOpenApManager?: () => void;
  className?: string;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ onOpenApManager, className = '' }) => {
  const { activeCharacter } = useCharacterStore();
  const [showDossierModal, setShowDossierModal] = useState(false);

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
  const heroName = activeCharacter.name || 'Hero';
  const level = sheet?.level ?? 1;
  const availableAp = calculateAvailableAp(level, sheet);

  const handleOpenApManager = () => {
    if (onOpenApManager) {
      onOpenApManager();
    } else {
      window.dispatchEvent(new CustomEvent('supaflex:open-manager', { detail: 'ap' }));
    }
  };

  return (
    <>
      <div className={`bg-gradient-to-b from-slate-800/40 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-slate-400/90 p-3.5 flex items-center justify-between transition-all gap-3 flex-wrap shadow-lg shadow-slate-950/20 ${className}`}>
        {/* Left Zone: Level & AP Identity & Informative Stat Pill */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="p-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)] shrink-0">
            <span className="text-base leading-none">⭐</span>
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="font-outfit font-bold text-sm tracking-wide text-slate-100 uppercase truncate flex items-center gap-1.5">
              <span className="text-slate-200 font-extrabold">Level & AP:</span>
              <span className="bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500 bg-clip-text text-transparent font-black tracking-wider">
                {heroName}
              </span>
            </h3>

            {/* ⭐ Level & AP Informative Pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-300 shadow-sm shrink-0 font-mono font-bold text-xs select-none"
              title={`Character Level ${level} with ${availableAp} Available AP`}
            >
              <span className="text-amber-200">Level {level}</span>
              <span className="text-amber-500/50">•</span>
              <span className="text-amber-300">AP {availableAp}</span>
            </div>
          </div>
        </div>

        {/* Right Zone: Dossier + Manage Level & AP Pencil Button */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDossierModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm cursor-pointer bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/35 text-purple-300 shadow-purple-950/40"
            title="Open Character Dossier"
          >
            <span className="text-xs">👤</span>
            <span className="font-outfit font-extrabold tracking-wide">Dossier</span>
          </button>

          {/* ✏️ Manage Level & AP Pencil Icon Button */}
          <button
            type="button"
            onClick={handleOpenApManager}
            className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm bg-amber-950/80 hover:bg-amber-900/90 border-amber-500/40 hover:border-amber-400 text-amber-200 hover:text-white cursor-pointer group"
            title="Manage Level & AP"
          >
            <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
          </button>
        </div>
      </div>

      {showDossierModal && (
        <UniversalLinksModal
          isOpen={showDossierModal}
          onClose={() => setShowDossierModal(false)}
          initialScope="character"
          initialTab="dossier"
          themeColor="indigo"
        />
      )}
    </>
  );
};

export const HeroHubCard = CharacterCard;
