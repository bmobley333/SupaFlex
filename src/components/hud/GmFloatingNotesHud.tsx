// src/components/hud/GmFloatingNotesHud.tsx
// Non-blocking, draggable floating HUD window for Encounter Notes.
// Allows the GM to review and edit room notes anywhere on screen while freely
// interacting with the background encounter list and live combat roster.

import React, { useState, useRef, useEffect } from 'react';
import { Minimize2, Maximize2, X, StickyNote } from 'lucide-react';
import { GmEncounter } from '../../types/adventures';
import { GmEncounterNotesCard } from './GmEncounterNotesCard';

interface GmFloatingNotesHudProps {
  isOpen: boolean;
  activeEncounter: GmEncounter | null;
  selectedPartyId?: string;
  onDock: () => void;
  onClose: () => void;
}

export const GmFloatingNotesHud: React.FC<GmFloatingNotesHudProps> = ({
  isOpen,
  activeEncounter,
  selectedPartyId,
  onDock,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Default to right side of screen, below the header
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return {
      x: Math.max(20, screenW - 580),
      y: 110,
    };
  });

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Handle Drag Start
  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't drag if clicking buttons inside the header
    if ((e.target as HTMLElement).closest('button')) return;

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const width = isMinimized ? 320 : 540;

    const nextX = Math.max(10, Math.min(winW - width - 10, e.clientX - dragOffsetRef.current.x));
    const nextY = Math.max(10, Math.min(winH - 100, e.clientY - dragOffsetRef.current.y));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    }
  };

  // Keyboard shortcut: ESC closes the floating window
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className={`z-40 font-outfit select-none transition-shadow ${
        isMinimized
          ? 'w-80 shadow-xl'
          : 'w-[540px] max-w-[94vw] h-[520px] max-h-[82vh] flex flex-col shadow-2xl'
      }`}
    >
      {/* Draggable HUD Window Chassis */}
      <div className="bg-slate-950/95 border-2 border-indigo-500/60 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden h-full">
        {/* Top Window Bar (Drag Handle) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="px-3 py-2 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-b border-indigo-500/40 flex items-center justify-between cursor-move shrink-0"
        >
          {/* Left: Drag Grip + Title */}
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="text-slate-500 hover:text-slate-300 font-mono text-xs cursor-grab active:cursor-grabbing select-none">
              ⠿
            </span>
            <div className="p-1 rounded-md bg-indigo-950 border border-indigo-500/50 text-indigo-300 flex items-center justify-center shrink-0">
              <StickyNote className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold text-indigo-200 truncate">
              {activeEncounter ? activeEncounter.title : 'Encounter Notes'}
            </span>
          </div>

          {/* Right Window Controls: Minimize, Dock, Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Minimize / Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 text-slate-400 hover:text-indigo-200 hover:bg-indigo-950/60 rounded transition-all cursor-pointer"
              title={isMinimized ? "Expand window" : "Minimize to capsule"}
            >
              {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Dock Back into Pane Button */}
            <button
              type="button"
              onClick={onDock}
              className="px-2 py-0.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-indigo-100 border border-indigo-500/50 rounded text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              title="Dock back into right pane"
            >
              <span>🗖 Dock</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-rose-300 hover:bg-rose-950/50 rounded transition-all cursor-pointer"
              title="Close floating notes"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Window Content Body (when not minimized) */}
        {!isMinimized && (
          <div className="flex-1 min-h-0 overflow-y-auto p-2 bg-slate-950 flex flex-col select-text">
            <GmEncounterNotesCard
              activeEncounter={activeEncounter}
              selectedPartyId={selectedPartyId}
              isPoppedOut={true}
              onDock={onDock}
              fullHeight={true}
              className="border-none bg-transparent p-1 shadow-none flex-1"
            />
          </div>
        )}
      </div>
    </div>
  );
};
