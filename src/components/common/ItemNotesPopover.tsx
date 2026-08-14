// src/components/common/ItemNotesPopover.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Info, X } from 'lucide-react';

interface ItemNotesPopoverProps {
  notes?: string | null;
  itemName: string;
  className?: string;
}

export const ItemNotesPopover: React.FC<ItemNotesPopoverProps> = ({
  notes,
  itemName,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanNotes = notes ? notes.trim() : '';

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!cleanNotes) {
    return null;
  }

  return (
    <div ref={containerRef} className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-0.5 text-indigo-400/80 hover:text-indigo-300 transition-colors rounded hover:bg-indigo-950/60 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50 inline-flex items-center justify-center shrink-0"
        title={`View notes for ${itemName}`}
        aria-label={`View notes for ${itemName}`}
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 md:w-72 p-3 bg-slate-950/95 border border-indigo-500/50 rounded-xl shadow-2xl backdrop-blur-md z-[100] text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5 font-outfit text-xs truncate max-w-[200px]">
              <span>📜</span> {itemName}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Notes Content */}
          <div className="text-slate-300 text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
            {cleanNotes}
          </div>

          {/* Bottom Caret Pointer */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-slate-950/95 pointer-events-none" />
        </div>
      )}
    </div>
  );
};
