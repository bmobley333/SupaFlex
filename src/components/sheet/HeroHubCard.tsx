// src/components/sheet/HeroHubCard.tsx
import React, { useState } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { UniversalLinksDropdown } from '../hud/UniversalLinksDropdown';
import { UniversalLinksModal } from '../modals/UniversalLinksModal';

interface HeroHubCardProps {
  onOpenApManager?: () => void;
}

export const HeroHubCard: React.FC<HeroHubCardProps> = ({ onOpenApManager }) => {
  const {
    activeCharacter,
    addCharacterLink,
    updateCharacterLink,
    deleteCharacterLink,
    reorderCharacterLinkByIndex,
  } = useCharacterStore();

  const [showTraitsModal, setShowTraitsModal] = useState(false);

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
  const heroName = activeCharacter.name || 'Hero';
  const level = sheet?.level ?? 1;
  const race = activeCharacter.race || 'Human';
  const charClass = activeCharacter.class || 'Adventurer';

  const handleOpenApManager = () => {
    if (onOpenApManager) {
      onOpenApManager();
    } else {
      window.dispatchEvent(new CustomEvent('supaflex:open-manager', { detail: 'ap' }));
    }
  };

  return (
    <>
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all gap-3 flex-wrap">
        {/* Left Zone: Hero Identity, Level/AP Trigger & Race/Class Pills */}
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h3 className="font-outfit font-bold text-sm tracking-wide text-slate-100 uppercase truncate">
              {heroName}
            </h3>

            {/* ⭐ Level & AP Integrated Pill with Help & Chevron Trigger */}
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-300 shadow-sm shrink-0">
              <button
                type="button"
                onClick={handleOpenApManager}
                className="font-mono font-extrabold text-[11px] hover:text-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                title="Open Manage Level & AP Modal"
              >
                <span>Lvl {level}</span>
                <ChevronDown className="w-3 h-3 text-amber-400" />
              </button>
              <div className="h-3 w-[1px] bg-amber-500/30 mx-0.5 shrink-0" />
              <CardHelpButton ruleKey="leveling.advancement_steps" />
            </div>

            {/* 🧬 Race & Class Pills */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/35 text-purple-300 text-[10px] font-bold">
                {race}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-[10px] font-bold">
                {charClass}
              </span>
            </div>
          </div>
        </div>

        {/* Right Zone: Traits Quick Launch + Character Links & Notes Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowTraitsModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border shadow-sm cursor-pointer bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/35 text-purple-300 shadow-purple-950/40"
            title="Open Character Traits & Demographics Editor in Links & Notes Hub"
          >
            <span className="text-xs">👤</span>
            <span className="font-outfit font-extrabold tracking-wide">Traits</span>
          </button>

          <UniversalLinksDropdown
            label="Character Links"
            links={sheet?.character_links || []}
            themeColor="teal"
            onAddLink={addCharacterLink}
            onUpdateLink={updateCharacterLink}
            onDeleteLink={deleteCharacterLink}
            onReorderLinkByIndex={reorderCharacterLinkByIndex}
          />
        </div>
      </div>

      {showTraitsModal && (
        <UniversalLinksModal
          isOpen={showTraitsModal}
          onClose={() => setShowTraitsModal(false)}
          initialScope="character"
          initialTab="trait"
          themeColor="indigo"
        />
      )}
    </>
  );
};
