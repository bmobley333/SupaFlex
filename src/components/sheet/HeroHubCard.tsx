import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLinksModal } from '../modals/UniversalLinksModal';
import { ManagePathsModal } from '../modals/ManagePathsModal';
import { ManageEquipmentKitsModal } from '../modals/ManageEquipmentKitsModal';

interface HeroHubCardProps {
  onOpenApManager?: () => void;
  className?: string;
}

export const HeroHubCard: React.FC<HeroHubCardProps> = ({ onOpenApManager, className = '' }) => {
  const { activeCharacter } = useCharacterStore();

  const [showDossierModal, setShowDossierModal] = useState(false);
  const [showPathsModal, setShowPathsModal] = useState(false);
  const [showEquipmentKitsModal, setShowEquipmentKitsModal] = useState(false);

  // Listen for global manager events
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'paths' || e.detail === 'kits') setShowPathsModal(true);
      if (e.detail === 'equipment_kits' || e.detail === 'hardware_bundles' || e.detail === 'bundles') {
        setShowEquipmentKitsModal(true);
      }
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
  const heroName = activeCharacter.name || 'Hero';
  const level = sheet?.level ?? 1;
  const race = activeCharacter.race || 'Human';
  const charClass = activeCharacter.class || 'Vanguard';

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
        {/* Left Zone: Hero Identity, Level/AP Trigger & Race/Class Pills */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="p-1.5 rounded-xl bg-slate-855 border border-slate-600/50 text-slate-200 flex items-center justify-center shadow-[0_0_12px_rgba(148,163,184,0.2)] shrink-0">
            <span className="text-base leading-none">👤</span>
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="font-outfit font-bold text-sm tracking-wide text-slate-100 uppercase truncate">
              {heroName}
            </h3>

            {/* ⭐ Level & AP Integrated Pill with Chevron Trigger */}
            <button
              type="button"
              onClick={handleOpenApManager}
              className="flex items-center gap-1 px-2 py-0.5 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 rounded-lg text-amber-300 hover:text-amber-100 shadow-sm shrink-0 font-mono font-extrabold text-[11px] transition-all cursor-pointer"
              title="Open Manage Level & AP Modal"
            >
              <span>Lvl {level}</span>
              <ChevronDown className="w-3 h-3 text-amber-400" />
            </button>

            {/* 🧬 Race & Class Path Pills */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowPathsModal(true)}
                className="px-2 py-0.5 rounded-full bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/35 hover:border-purple-400 text-purple-300 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                title="Manage Race Path in Paths Hub"
              >
                <span>🧬</span>
                <span>{race}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPathsModal(true)}
                className="px-2 py-0.5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/35 hover:border-indigo-400 text-indigo-300 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                title="Manage Class Path in Paths Hub"
              >
                <span>⚔️</span>
                <span>{charClass}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Zone: Dossier + Manage Paths + Manage Kits Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDossierModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm cursor-pointer bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/35 text-purple-300 shadow-purple-950/40"
            title="Open Character Dossier Editor in Links & Notes Hub"
          >
            <span className="text-xs">👤</span>
            <span className="font-outfit font-extrabold tracking-wide">Dossier</span>
          </button>

          {/* 🧭 Manage Paths Action Button */}
          <button
            type="button"
            onClick={() => setShowPathsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer bg-purple-950/80 hover:bg-purple-900/90 text-purple-200 border-purple-500/50 hover:border-purple-400 shadow-purple-950/40"
            title="Manage Starting Paths, In-Path AP Purchasing & Unlock New Disciplines"
          >
            <span className="text-xs">🧭</span>
            <span className="font-outfit font-black tracking-wide">Manage Paths</span>
          </button>

          {/* 🎒 Manage Kits Action Button */}
          <button
            type="button"
            onClick={() => setShowEquipmentKitsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-200 border-cyan-500/50 hover:border-cyan-400 shadow-cyan-950/40"
            title="Manage Equipment Suites, Hardware Packages & Survival Kits"
          >
            <span className="text-xs">🎒</span>
            <span className="font-outfit font-black tracking-wide">Manage Kits</span>
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

      {showPathsModal && (
        <ManagePathsModal
          isOpen={showPathsModal}
          onClose={() => setShowPathsModal(false)}
        />
      )}

      {showEquipmentKitsModal && (
        <ManageEquipmentKitsModal
          isOpen={showEquipmentKitsModal}
          onClose={() => setShowEquipmentKitsModal(false)}
        />
      )}
    </>
  );
};
