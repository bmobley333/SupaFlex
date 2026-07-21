// src/components/logs/AdventureLogs.tsx
import React, { useState } from 'react';
import { Scroll, BookMarked, Save } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

export interface LogEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  completed?: boolean;
}

export const AdventureLogs: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  const bioNotes = activeCharacter?.sheet_data?.bio?.notes || '';
  const backstory = activeCharacter?.sheet_data?.bio?.backstory || '';
  const personality = activeCharacter?.sheet_data?.bio?.personality || '';

  const [notesText, setNotesText] = useState(bioNotes);
  const [backstoryText, setBackstoryText] = useState(backstory);
  const [personalityText, setPersonalityText] = useState(personality);

  const handleSaveBioLogs = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      bio: {
        ...prev.bio,
        notes: notesText,
        backstory: backstoryText,
        personality: personalityText,
      },
    }));
    saveActiveCharacter();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-[2500px] mx-auto">
      {/* Left Column (2/3): Session Journal & Quest Log */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-outfit font-bold text-base text-slate-100 flex items-center gap-2">
              <Scroll className="w-5 h-5 text-amber-400" />
              Adventure & Session Journal
            </h3>
            <button
              onClick={handleSaveBioLogs}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              Save Journal
            </button>
          </div>

          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="Record active campaign session notes, quest objectives, key NPCs encountered, and campaign milestones..."
            className="w-full min-h-[350px] bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs leading-relaxed text-slate-200 outline-none focus:border-indigo-500 font-mono resize-y"
          />
        </div>
      </div>

      {/* Right Column (1/3): Character Backstory & Personality Notes */}
      <div className="flex flex-col gap-6">
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <BookMarked className="w-5 h-5 text-indigo-400" />
            <h3 className="font-outfit font-bold text-base text-slate-100">Hero Lore & Bio</h3>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Backstory & Origin
              </label>
              <textarea
                value={backstoryText}
                onChange={(e) => setBackstoryText(e.target.value)}
                placeholder="Hero's origin story, homeland, and motivation..."
                className="w-full min-h-[120px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Personality & Mannerisms
              </label>
              <textarea
                value={personalityText}
                onChange={(e) => setPersonalityText(e.target.value)}
                placeholder="Key personality traits, flaws, ideals..."
                className="w-full min-h-[120px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            <button
              onClick={handleSaveBioLogs}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              Save Lore Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
