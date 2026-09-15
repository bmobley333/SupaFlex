import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
        {/* Left Zone: Character Identity & Level/AP Trigger */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="p-1.5 rounded-xl bg-slate-855 border border-slate-600/50 text-slate-200 flex items-center justify-center shadow-[0_0_12px_rgba(148,163,184,0.2)] shrink-0">
            <span className="text-base leading-none">👤</span>
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="font-outfit font-bold text-sm tracking-wide text-slate-100 uppercase truncate">
              Character: {heroName}
            </h3>

            {/* ⭐ Level & AP Integrated Pill with Chevron Trigger */}
            <button
              type="button"
              onClick={handleOpenApManager}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded-lg text-amber-300 hover:text-amber-100 shadow-sm shrink-0 font-mono font-extrabold text-[11px] transition-all cursor-pointer"
              title="Manage Level & AP"
            >
              <span>Lvl {level}</span>
              <span className="text-amber-500/50">•</span>
              <span>AP {availableAp}</span>
              <ChevronDown className="w-3 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Right Zone: Dossier + Manage Level & AP Action Buttons */}
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

          {/* ⭐ Manage Level & AP Action Button (replaces Manage Paths) */}
          <button
            type="button"
            onClick={handleOpenApManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-500/50 hover:border-amber-400 shadow-amber-950/40"
            title="Manage Level, AP Allocations, and Historical Ledger"
          >
            <span className="text-xs">⭐</span>
            <span className="font-outfit font-black tracking-wide">Manage Level & AP</span>
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
