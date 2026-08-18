// src/components/logs/AdventureLogs.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scroll,
  BookMarked,
  Check,
  Loader2,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';

export interface LogEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  completed?: boolean;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving';

export const AdventureLogs: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  const bioNotes = activeCharacter?.sheet_data?.bio?.notes || '';
  const backstory = activeCharacter?.sheet_data?.bio?.backstory || '';
  const personality = activeCharacter?.sheet_data?.bio?.personality || '';

  const [notesText, setNotesText] = useState(bioNotes);
  const [backstoryText, setBackstoryText] = useState(backstory);
  const [personalityText, setPersonalityText] = useState(personality);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const latestRef = useRef({ notes: bioNotes, backstory, personality });
  const activeCharRef = useRef(activeCharacter);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync ref with current state on every render
  useEffect(() => {
    latestRef.current = {
      notes: notesText,
      backstory: backstoryText,
      personality: personalityText,
    };
    activeCharRef.current = activeCharacter;
  }, [notesText, backstoryText, personalityText, activeCharacter]);

  // Re-initialize state when active character changes
  useEffect(() => {
    const curBio = activeCharacter?.sheet_data?.bio;
    const n = curBio?.notes || '';
    const b = curBio?.backstory || '';
    const p = curBio?.personality || '';

    setNotesText(n);
    setBackstoryText(b);
    setPersonalityText(p);
    latestRef.current = { notes: n, backstory: b, personality: p };
    setSaveStatus('saved');
  }, [activeCharacter?.id]);

  const flushAutoSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const current = latestRef.current;
    const savedBio = activeCharRef.current?.sheet_data?.bio;

    if (
      savedBio?.notes === current.notes &&
      savedBio?.backstory === current.backstory &&
      savedBio?.personality === current.personality
    ) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    try {
      updateActiveSheetData((prev) => ({
        ...prev,
        bio: {
          ...prev.bio,
          notes: current.notes,
          backstory: current.backstory,
          personality: current.personality,
        },
      }));
      await saveActiveCharacter();
      setSaveStatus('saved');
    } catch (err) {
      console.error('[AdventureLogs] Auto-save error:', err);
      setSaveStatus('unsaved');
    }
  }, [updateActiveSheetData, saveActiveCharacter]);

  const scheduleAutoSave = () => {
    setSaveStatus('unsaved');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushAutoSave();
    }, 2500);
  };

  const handleBlur = () => {
    if (saveStatus === 'unsaved') {
      flushAutoSave();
    }
  };

  // Flush unsaved changes on unmount (tab switch or exit)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const current = latestRef.current;
      const savedBio = activeCharRef.current?.sheet_data?.bio;
      if (
        savedBio?.notes !== current.notes ||
        savedBio?.backstory !== current.backstory ||
        savedBio?.personality !== current.personality
      ) {
        flushAutoSave();
      }
    };
  }, [flushAutoSave]);

  const renderStatusBadge = () => {
    if (saveStatus === 'saving') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs font-semibold transition-all">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving...</span>
        </div>
      );
    }
    if (saveStatus === 'unsaved') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs font-semibold transition-all">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Unsaved changes...</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-semibold transition-all">
        <Check className="w-3.5 h-3.5" />
        <span>All changes saved</span>
      </div>
    );
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
            {renderStatusBadge()}
          </div>

          <textarea
            value={notesText}
            onChange={(e) => {
              setNotesText(e.target.value);
              scheduleAutoSave();
            }}
            onBlur={handleBlur}
            className="w-full min-h-[520px] bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs leading-relaxed text-slate-200 outline-none focus:border-indigo-500 font-mono resize-y"
          />
        </div>
      </div>

      {/* Right Column (1/3): Hero Lore, Bio & Linked Documents */}
      <div className="flex flex-col gap-6">
        {/* Card 1: Hero Lore & Bio */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-indigo-400" />
              <h3 className="font-outfit font-bold text-base text-slate-100">Hero Lore & Bio</h3>
            </div>
            {renderStatusBadge()}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Backstory & Origin
              </label>
              <textarea
                value={backstoryText}
                onChange={(e) => {
                  setBackstoryText(e.target.value);
                  scheduleAutoSave();
                }}
                onBlur={handleBlur}
                className="w-full min-h-[110px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Personality & Mannerisms
              </label>
              <textarea
                value={personalityText}
                onChange={(e) => {
                  setPersonalityText(e.target.value);
                  scheduleAutoSave();
                }}
                onBlur={handleBlur}
                className="w-full min-h-[110px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-y"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
