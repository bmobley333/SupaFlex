// src/components/sheet/HeroHubCard.tsx
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLinksDropdown } from '../hud/UniversalLinksDropdown';
import { UniversalLinksModal } from '../modals/UniversalLinksModal';

export const HeroHubCard: React.FC = () => {
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
  const bio = sheet?.bio || {};
  const hasBioStats = bio.height || bio.weight || bio.age;

  return (
    <>
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all gap-3 flex-wrap">
        {/* Left Zone: Hero Identity & Level */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-outfit font-bold text-sm tracking-wide text-slate-100 uppercase truncate">
              {heroName}
            </h3>

            <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-500/40 rounded-full font-mono text-[10px] font-extrabold shrink-0">
              Lvl {level}
            </span>

            {hasBioStats && (
              <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono truncate max-w-[180px]">
                {[bio.height, bio.weight, bio.age ? `Age ${bio.age}` : null]
                  .filter(Boolean)
                  .join(' • ')}
              </span>
            )}
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
