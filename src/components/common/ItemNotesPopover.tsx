// src/components/common/ItemNotesPopover.tsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: true,
  });

  const cleanNotes = notes ? notes.trim() : '';

  // Update popover position based on trigger element bounding box
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = 160;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    // Boundary collision checks (horizontal)
    if (left < 12) left = 12;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }

    let placeAbove = true;
    let top = rect.top - popoverHeight - 8;
    if (top < 12) {
      // Not enough space above, place below trigger
      placeAbove = false;
      top = rect.bottom + 8;
    }

    setCoords({ top, left, placeAbove });
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close popover when clicking outside or scrolling
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        updatePosition();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  if (!cleanNotes) {
    return null;
  }

  const popoverContent = isOpen ? (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      className="w-72 p-3 bg-slate-950/95 border border-indigo-500/60 rounded-xl shadow-2xl backdrop-blur-md z-[9999] text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
    >
      {/* Popover Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
        <span className="font-bold text-indigo-300 flex items-center gap-1.5 font-outfit text-xs truncate max-w-[210px]">
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
    </div>
  ) : null;

  return (
    <div className={`inline-flex items-center align-middle shrink-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="p-0.5 text-xs select-none transition-transform hover:scale-125 cursor-pointer focus:outline-none inline-flex items-center justify-center shrink-0"
        title={`View notes for ${itemName}`}
        aria-label={`View notes for ${itemName}`}
      >
        ℹ️
      </button>

      {typeof document !== 'undefined' && isOpen && ReactDOM.createPortal(popoverContent, document.body)}
    </div>
  );
};
