// src/components/hud/GmEncounterNotesCard.tsx
// Modular, High-Density Encounter Notes Card with Dyslexia-Friendly Controls,
// Markdown-style formatting, Icon insertion, Loot & Links dropdowns, and Pop-out HUD support.

import React, { useState, useRef } from 'react';
import { StickyNote, ExternalLink } from 'lucide-react';
import { GmEncounter } from '../../types/adventures';
import { EncounterLootDropdown } from './EncounterLootDropdown';
import { EncounterLinksDropdown } from './EncounterLinksDropdown';
import { useAdventureStore } from '../../store/useAdventureStore';

interface GmEncounterNotesCardProps {
  activeEncounter: GmEncounter | null;
  selectedPartyId?: string;
  isPoppedOut?: boolean;
  onTogglePopOut?: () => void;
  fullHeight?: boolean;
  className?: string;
}

const ATTRIBUTE_EFFECT_ICONS = [
  { label: 'Magic ✨', icon: '✨' },
  { label: 'Might 💪', icon: '💪' },
  { label: 'Mind 👁️', icon: '👁️' },
  { label: 'Motion 🏃', icon: '🏃' },
  { label: 'Moxie 🫀', icon: '🫀' },
];

export const GmEncounterNotesCard: React.FC<GmEncounterNotesCardProps> = ({
  activeEncounter,
  selectedPartyId,
  isPoppedOut = false,
  onTogglePopOut,
  fullHeight = false,
  className = '',
}) => {
  const [notesMode, setNotesMode] = useState<'view' | 'edit'>('view');
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const setEncounterNotes = useAdventureStore((state) => state.setEncounterNotes);

  const insertIconAtNotesCursor = (iconStr: string) => {
    if (notesMode !== 'edit') {
      setNotesMode('edit');
    }
    const currentNotes = activeEncounter?.notes || activeEncounter?.tactical_notes || '';
    const textarea = notesTextareaRef.current;
    if (!textarea) {
      setEncounterNotes(currentNotes + iconStr);
      return;
    }
    const start = textarea.selectionStart ?? currentNotes.length;
    const end = textarea.selectionEnd ?? currentNotes.length;
    const nextVal = currentNotes.substring(0, start) + iconStr + currentNotes.substring(end);
    setEncounterNotes(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + iconStr.length, start + iconStr.length);
    }, 0);
  };

  const renderFormattedEncounterNotes = (rawText: string) => {
    if (!rawText || !rawText.trim()) {
      return (
        <span className="text-slate-500 italic text-xs">
          No notes for this encounter. Click to add notes...
        </span>
      );
    }

    const lines = rawText.split(/\r?\n/);
    return (
      <div className="space-y-1 text-slate-200 font-sans text-xs leading-relaxed select-text">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          if (trimmed === '---') {
            return <div key={idx} className="border-t border-slate-800/80 my-2" />;
          }

          // Major Section Headers: Room Description, Tactical Encounter Notes, Overview
          if (
            trimmed === 'Room Description:' ||
            trimmed === 'Tactical Encounter Notes:' ||
            trimmed.startsWith('Overview:') ||
            trimmed.startsWith('Act I:') ||
            trimmed.startsWith('Act II:') ||
            trimmed.startsWith('Act III:') ||
            trimmed.startsWith('Act IV:')
          ) {
            return (
              <div
                key={idx}
                className="text-sky-300 font-extrabold text-xs tracking-wider uppercase border-b border-sky-900/40 pb-0.5 mt-2 mb-1 flex items-center gap-1.5"
              >
                <span>{trimmed}</span>
              </div>
            );
          }

          // Prompt Keywords: "• Scene:", "• GM Notes:", "• Objective:", "• Opponents:", "• Reward:", "• Treasure:", "• Trap:", "• Puzzle:", "• Special:"
          const kwMatch = trimmed.match(
            /^(?:[•\-\*]\s*)?(Scene|GM Notes|Objective|Opponents|Reward|Treasure|Trap|Puzzle|Special|Puzzle \/ Trap \/ Reward):\s*(.*)$/i
          );
          if (kwMatch) {
            const kw = kwMatch[1];
            const rest = kwMatch[2];
            return (
              <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                <span className="font-extrabold text-sky-400 shrink-0 font-sans tracking-wide">
                  • {kw}:
                </span>
                {rest && <span className="text-slate-200">{rest}</span>}
              </div>
            );
          }

          // Monster Sub-lines: "  - 2 Ogrind Guards: ...", "Station Commander Klyss: ..."
          const monMatch = trimmed.match(
            /^(?:[•\-\*○]\s*)?(\d+(?:-\d+)?\s+[A-Za-z0-9 '–\-]+(?:\([^\)]+\))?|Station Commander Klyss[^\:]*|Overseer Ketone[^\:]*|Paralith Captain):\s*(.*)$/
          );
          if (monMatch) {
            const mName = monMatch[1];
            const mRest = monMatch[2];
            return (
              <div key={idx} className="pl-4 flex items-start gap-1.5 leading-relaxed">
                <span className="font-bold text-amber-300 shrink-0 font-sans">
                  - {mName}:
                </span>
                <span className="text-slate-300">{mRest}</span>
              </div>
            );
          }

          // Standard text line
          return (
            <div key={idx} className="text-slate-200 leading-relaxed">
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  const notesContent = activeEncounter?.notes || activeEncounter?.tactical_notes || '';

  return (
    <div
      className={`bg-slate-950/90 border border-slate-800 border-t-2 border-t-rose-500/50 p-3.5 rounded-xl shadow-inner flex flex-col gap-2.5 font-outfit ${
        fullHeight ? 'flex-1 min-h-0' : ''
      } ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        {/* Left: Title + View/Edit Dyslexia-Friendly Pill Switch */}
        <div className="flex items-center gap-3 flex-wrap">
          <h4 className="text-xs font-extrabold text-rose-200 uppercase tracking-wider flex items-center gap-2 font-mono">
            <div className="p-1 rounded-lg bg-rose-950/90 border border-rose-500/40 text-rose-300 flex items-center justify-center shadow-sm">
              <StickyNote className="w-3.5 h-3.5" />
            </div>
            <span>Encounter Notes</span>
            {activeEncounter && (
              <span className="text-slate-400 font-normal">({activeEncounter.title})</span>
            )}
          </h4>

          {/* Dyslexia-Friendly Multi-Option Pill Switch: View vs Edit */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
            <button
              type="button"
              onClick={() => setNotesMode('view')}
              className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                notesMode === 'view'
                  ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              👁️ View
            </button>
            <button
              type="button"
              onClick={() => setNotesMode('edit')}
              className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                notesMode === 'edit'
                  ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              ✏️ Edit
            </button>
          </div>
        </div>

        {/* Right Controls: Insert Icons + Loot + Links + Pop-Out / Dock */}
        <div className="flex items-center gap-3 flex-wrap ml-auto">
          {/* Insert Icon Buttons */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-400 font-bold mr-0.5 font-mono">Insert Icon:</span>
            {ATTRIBUTE_EFFECT_ICONS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => insertIconAtNotesCursor(item.icon)}
                disabled={!activeEncounter}
                className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title={`Insert ${item.icon} into Encounter Notes`}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* High-Density Encounter Loot Dropdown + Encounter Links Dropdown */}
          <div className="flex items-center gap-2">
            <EncounterLootDropdown partyId={selectedPartyId} />
            <EncounterLinksDropdown />
          </div>

          {/* Pop-Out Affordance (Only shown when docked in pane) */}
          {!isPoppedOut && onTogglePopOut && (
            <button
              type="button"
              onClick={onTogglePopOut}
              className="px-2 py-1 bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 hover:text-indigo-100 border border-indigo-500/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              title="Pop out notes into a floating, draggable HUD window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pop Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Formatted View vs Raw Edit Body */}
      {notesMode === 'view' ? (
        <div
          onClick={() => setNotesMode('edit')}
          title="Click anywhere to edit notes"
          className={`w-full overflow-y-auto bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-sans leading-relaxed cursor-pointer hover:border-slate-700/80 transition-colors shadow-inner select-text ${
            fullHeight ? 'flex-1 min-h-[160px]' : 'min-h-[100px] max-h-80'
          }`}
        >
          {renderFormattedEncounterNotes(notesContent)}
        </div>
      ) : (
        <textarea
          ref={notesTextareaRef}
          rows={fullHeight ? 10 : 4}
          value={notesContent}
          onChange={(e) => setEncounterNotes(e.target.value)}
          placeholder={
            activeEncounter
              ? 'e.g. Floor spikes trigger on round 2; 2 skeleton archers on catwalks; secret door behind altar...'
              : 'Select or create an encounter above to write notes...'
          }
          disabled={!activeEncounter}
          className={`w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500/80 transition placeholder:text-slate-600 disabled:opacity-40 leading-relaxed ${
            fullHeight ? 'flex-1 min-h-[160px] resize-none' : ''
          }`}
        />
      )}
    </div>
  );
};
