// src/components/hud/GmFloatingNotesHud.tsx
// Non-blocking, draggable & resizable floating HUD window for Encounter Notes.
// Allows the GM to review and edit room notes anywhere on screen while freely
// interacting with the background encounter list and live combat roster.

import React, { useState, useRef, useEffect } from 'react';
import { Minimize2, Maximize2, X, StickyNote } from 'lucide-react';
import { GmEncounter } from '../../types/adventures';
import { GmEncounterNotesCard } from './GmEncounterNotesCard';

export interface FloatingWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GmFloatingNotesHudProps {
  isOpen: boolean;
  activeEncounter: GmEncounter | null;
  selectedPartyId?: string;
  onDock: () => void;
  onClose: () => void;
  initialBounds?: FloatingWindowBounds | null;
}

export const GmFloatingNotesHud: React.FC<GmFloatingNotesHudProps> = ({
  isOpen,
  activeEncounter,
  selectedPartyId,
  onDock,
  onClose,
  initialBounds,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  const getDefaultBounds = (): FloatingWindowBounds => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const isDesktop = screenW >= 1024;

    if (isDesktop) {
      // Anchored to lower right pane area roughly as in Image 1
      const colWidth = Math.min(680, Math.max(460, Math.round(screenW * 0.48)));
      const colX = Math.round(screenW * 0.5 + 12);
      const colY = Math.min(390, Math.max(280, Math.round(screenH * 0.42)));
      const colHeight = Math.min(520, Math.max(360, screenH - colY - 24));
      return {
        x: Math.max(10, Math.min(screenW - colWidth - 16, colX)),
        y: Math.max(10, Math.min(screenH - 120, colY)),
        width: colWidth,
        height: colHeight,
      };
    }

    return {
      x: 16,
      y: 120,
      width: Math.min(screenW - 32, 540),
      height: Math.min(screenH - 160, 480),
    };
  };

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (initialBounds) return { x: initialBounds.x, y: initialBounds.y };
    const def = getDefaultBounds();
    return { x: def.x, y: def.y };
  });

  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    if (initialBounds) return { width: initialBounds.width, height: initialBounds.height };
    const def = getDefaultBounds();
    return { width: def.width, height: def.height };
  });

  // When newly opened with explicit initialBounds, adopt them immediately
  useEffect(() => {
    if (isOpen && initialBounds) {
      setPosition({ x: initialBounds.x, y: initialBounds.y });
      setSize({ width: initialBounds.width, height: initialBounds.height });
    }
  }, [isOpen, initialBounds]);

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isResizingRef = useRef(false);
  const resizeDirRef = useRef<ResizeDirection>('se');
  const resizeStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

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
    if (isDraggingRef.current) {
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const currentWidth = isMinimized ? 320 : size.width;

      const nextX = Math.max(10, Math.min(winW - currentWidth - 10, e.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(10, Math.min(winH - 80, e.clientY - dragOffsetRef.current.y));

      setPosition({ x: nextX, y: nextY });
    } else if (isResizingRef.current) {
      const deltaX = e.clientX - resizeStartRef.current.mouseX;
      const deltaY = e.clientY - resizeStartRef.current.mouseY;
      const dir = resizeDirRef.current;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      const minW = 380;
      const minH = 260;

      let newX = resizeStartRef.current.startX;
      let newY = resizeStartRef.current.startY;
      let newW = resizeStartRef.current.startWidth;
      let newH = resizeStartRef.current.startHeight;

      // Horizontal Resize
      if (dir.includes('e')) {
        const maxW = winW - newX - 10;
        newW = Math.max(minW, Math.min(maxW, resizeStartRef.current.startWidth + deltaX));
      } else if (dir.includes('w')) {
        const rightEdge = resizeStartRef.current.startX + resizeStartRef.current.startWidth;
        const candidateW = resizeStartRef.current.startWidth - deltaX;
        if (candidateW < minW) {
          newW = minW;
          newX = rightEdge - minW;
        } else {
          const clampedX = Math.max(10, Math.min(rightEdge - minW, resizeStartRef.current.startX + deltaX));
          newW = rightEdge - clampedX;
          newX = clampedX;
        }
      }

      // Vertical Resize
      if (dir.includes('s')) {
        const maxH = winH - newY - 10;
        newH = Math.max(minH, Math.min(maxH, resizeStartRef.current.startHeight + deltaY));
      } else if (dir.includes('n')) {
        const bottomEdge = resizeStartRef.current.startY + resizeStartRef.current.startHeight;
        const candidateH = resizeStartRef.current.startHeight - deltaY;
        if (candidateH < minH) {
          newH = minH;
          newY = bottomEdge - minH;
        } else {
          const clampedY = Math.max(10, Math.min(bottomEdge - minH, resizeStartRef.current.startY + deltaY));
          newH = bottomEdge - clampedY;
          newY = clampedY;
        }
      }

      setPosition({ x: Math.round(newX), y: Math.round(newY) });
      setSize({ width: Math.round(newW), height: Math.round(newH) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
    if (isResizingRef.current) {
      isResizingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  const handleResizeStart = (e: React.PointerEvent, dir: ResizeDirection) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    resizeDirRef.current = dir;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
      startWidth: size.width,
      startHeight: size.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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
        width: isMinimized ? '320px' : `${size.width}px`,
        height: isMinimized ? 'auto' : `${size.height}px`,
      }}
      className={`z-40 font-outfit select-none transition-shadow ${
        isMinimized
          ? 'shadow-xl'
          : 'max-w-[96vw] max-h-[92vh] flex flex-col shadow-2xl relative'
      }`}
    >
      {/* Draggable & Resizable HUD Window Chassis */}
      <div className="bg-slate-950/95 border-2 border-indigo-500/60 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden h-full relative">
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
              fullHeight={true}
              className="border-none bg-transparent p-1 shadow-none flex-1"
            />
          </div>
        )}

        {/* Full 8-Direction Resizable Border Handles */}
        {!isMinimized && (
          <>
            {/* Top Border */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'n')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute -top-1 left-4 right-4 h-2.5 cursor-n-resize z-40 select-none hover:bg-indigo-500/20 transition-colors"
              title="Resize Top"
            />
            {/* Bottom Border */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 's')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute -bottom-1 left-4 right-4 h-2.5 cursor-s-resize z-40 select-none hover:bg-indigo-500/20 transition-colors"
              title="Resize Bottom"
            />
            {/* Left Border */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'w')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute top-4 bottom-4 -left-1 w-2.5 cursor-w-resize z-40 select-none hover:bg-indigo-500/20 transition-colors"
              title="Resize Left"
            />
            {/* Right Border */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'e')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute top-4 bottom-4 -right-1 w-2.5 cursor-e-resize z-40 select-none hover:bg-indigo-500/20 transition-colors"
              title="Resize Right"
            />
            {/* Top-Left Corner */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'nw')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute -top-1.5 -left-1.5 w-4 h-4 cursor-nw-resize z-50 select-none"
              title="Resize Top-Left"
            />
            {/* Top-Right Corner */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'ne')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 cursor-ne-resize z-50 select-none"
              title="Resize Top-Right"
            />
            {/* Bottom-Left Corner */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'sw')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute -bottom-1.5 -left-1.5 w-4 h-4 cursor-sw-resize z-50 select-none"
              title="Resize Bottom-Left"
            />
            {/* Bottom-Right Corner (with visual grip dots) */}
            <div
              onPointerDown={(e) => handleResizeStart(e, 'se')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 z-50 text-slate-500 hover:text-indigo-300 transition-colors select-none"
              title="Resize Bottom-Right"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current opacity-60 hover:opacity-100">
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="4" cy="8" r="1.2" />
                <circle cx="8" cy="4" r="1.2" />
                <circle cx="0" cy="8" r="1.2" />
                <circle cx="4" cy="4" r="1.2" />
                <circle cx="8" cy="0" r="1.2" />
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
