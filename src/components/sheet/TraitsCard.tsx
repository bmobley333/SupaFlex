// src/components/sheet/TraitsCard.tsx
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { UniversalLinksModal } from '../modals/UniversalLinksModal';

export const TraitsCard: React.FC = () => {
  const [showTraitsModal, setShowTraitsModal] = useState(false);

  return (
    <>
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all">
        {/* Title Header */}
        <h3 className="font-outfit font-bold text-sm tracking-widest text-purple-300 uppercase flex items-center gap-2">
          <span className="text-base">👤</span>
          Traits
        </h3>

        {/* Show Traits Trigger Button */}
        <button
          type="button"
          onClick={() => setShowTraitsModal(true)}
          className="px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-300 cursor-pointer"
          title="Open Character Traits & Demographics Editor in Links & Notes Hub"
        >
          <span className="font-outfit font-bold">Show Traits</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
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
