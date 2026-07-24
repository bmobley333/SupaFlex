// src/components/sheet/TraitsCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, X, User } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CharacterBio } from '../../types/game';

export const TraitsCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const bio: CharacterBio = activeCharacter?.sheet_data?.bio || {};

  const [showManageModal, setShowManageModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowManageModal(false);
      }
    };
    if (showManageModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showManageModal]);

  const handleBioChange = (field: keyof CharacterBio, value: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      bio: {
        ...(prev.bio || {}),
        [field]: value,
      },
    }));
    saveActiveCharacter();
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3.5 flex items-center justify-between transition-all">
      {/* Title Header */}
      <h3 className="font-outfit font-bold text-sm tracking-widest text-purple-300 uppercase flex items-center gap-2">
        <span className="text-base">👤</span>
        Traits
      </h3>

      {/* Show Traits Trigger Button */}
      <div className="relative">
        <button
          onClick={() => setShowManageModal(!showManageModal)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
            showManageModal
              ? 'bg-purple-600/30 text-purple-200 border-purple-400 shadow-purple-500/30'
              : 'bg-purple-950/40 hover:bg-purple-900/50 border-purple-500/30 text-purple-300'
          }`}
          title="View and edit character traits"
        >
          <span className="font-outfit font-bold">Show Traits</span>
          {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Floating Manage Traits Modal */}
        {showManageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
            <div
              ref={modalRef}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide">
                    Character Traits & Demographics
                  </h3>
                </div>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 overflow-y-auto flex flex-col gap-4">
                {/* 3 Separated Physical Metric Cells (Hgt, Wgt, Age) */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Hgt (Height)</span>
                    <input
                      type="text"
                      placeholder="6'1&quot;"
                      value={bio.height || ''}
                      onChange={(e) => handleBioChange('height', e.target.value)}
                      className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Wgt (Weight)</span>
                    <input
                      type="text"
                      placeholder="185 lbs"
                      value={bio.weight || ''}
                      onChange={(e) => handleBioChange('weight', e.target.value)}
                      className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Age</span>
                    <input
                      type="text"
                      placeholder="28"
                      value={bio.age || ''}
                      onChange={(e) => handleBioChange('age', e.target.value)}
                      className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Full Horizontal Lines for Traits */}
                <div className="flex flex-col gap-3">
                  {/* Appearance */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Appearance</label>
                    <input
                      type="text"
                      placeholder="Rugged scar on left cheek, dark cloak, keen eyes..."
                      value={bio.appearance || ''}
                      onChange={(e) => handleBioChange('appearance', e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-purple-500 w-full"
                    />
                  </div>

                  {/* Positive Trait */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Positive Trait</label>
                    <input
                      type="text"
                      placeholder="Fiercely loyal to comrades, calm under pressure..."
                      value={bio.positive_trait || ''}
                      onChange={(e) => handleBioChange('positive_trait', e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-emerald-500 w-full"
                    />
                  </div>

                  {/* Negative Trait */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-rose-300 uppercase tracking-wider">Negative Trait</label>
                    <input
                      type="text"
                      placeholder="Overly stubborn, mistrustful of noble bloodlines..."
                      value={bio.negative_trait || ''}
                      onChange={(e) => handleBioChange('negative_trait', e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-rose-500 w-full"
                    />
                  </div>

                  {/* Flair */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-purple-300 uppercase tracking-wider">Flair</label>
                    <input
                      type="text"
                      placeholder="Flips a worn brass coin before making crucial decisions..."
                      value={bio.flair || ''}
                      onChange={(e) => handleBioChange('flair', e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-purple-500 w-full"
                    />
                  </div>

                  {/* Adventuring Goal */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-amber-300 uppercase tracking-wider">Adventuring Goal</label>
                    <textarea
                      rows={2}
                      placeholder="Reclaim the ancestral crown of Shanask and uncover the lost relic..."
                      value={bio.adventuring_goal || ''}
                      onChange={(e) => handleBioChange('adventuring_goal', e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-amber-500 w-full resize-none"
                    />
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Notes</label>
                    <textarea
                      rows={3}
                      placeholder="General campaign notes, secrets, contacts, and personal logs..."
                      value={bio.notes || ''}
                      onChange={(e) => handleBioChange('notes', e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-cyan-500 w-full resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
