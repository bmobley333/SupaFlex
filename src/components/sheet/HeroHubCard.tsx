import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { calculateAvailableAp } from '../../types/game';
import { CardHelpButton } from '../common/CardHelpButton';

export interface CharacterCardProps {
  onOpenApManager?: () => void;
  className?: string;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ onOpenApManager, className = '' }) => {
  const { activeCharacter } = useCharacterStore();

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
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
    <div className={`bg-gradient-to-b from-slate-800/40 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-slate-400/90 p-3.5 flex items-center justify-between transition-all gap-3 flex-wrap shadow-lg shadow-slate-950/20 ${className}`}>
      {/* Left Zone: Level & AP Identity & Informative Stat Pills */}
      <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
        <button
          type="button"
          onClick={handleOpenApManager}
          className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left shrink-0"
          title="Click to open Manage Level & AP"
        >
          <div className="p-1.5 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)] group-hover:scale-105 group-hover:border-amber-400 transition-all shrink-0">
            <span className="text-base leading-none">⭐</span>
          </div>

          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-amber-200 uppercase group-hover:text-white transition-colors shrink-0 flex items-center gap-1.5">
            <span>Level & AP</span>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-300 group-hover:translate-y-0.5 transition-all" />
          </h3>
        </button>

        <CardHelpButton ruleKey="leveling.advancement_steps" />

        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">

          {/* ⭐ Level Informative Pill */}
          <div
            className="px-2.5 py-1 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-200 shadow-sm shrink-0 font-mono font-bold text-xs select-none"
            title={`Character Level ${level}`}
          >
            <span>Level {level}</span>
          </div>

          {/* ⭐ AP Informative Pill */}
          <div
            className="px-2.5 py-1 bg-amber-950/50 border border-amber-500/50 rounded-lg text-amber-300 shadow-sm shrink-0 font-mono font-black text-xs select-none"
            title={`Available Action Points: ${availableAp}`}
          >
            <span>AP {availableAp}</span>
          </div>
        </div>
      </div>

      {/* Right Zone: Manage Level & AP Pencil Button */}
      <div className="flex items-center gap-2 shrink-0">
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
  );
};

export const HeroHubCard = CharacterCard;
