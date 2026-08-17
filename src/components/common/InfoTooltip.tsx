// src/components/common/InfoTooltip.tsx
// Field guidance popover rendered via React Portal with viewport bounding-box collision detection.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  title?: string;
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, title, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: true,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 260;
    const estimatedHeight = title ? 85 : 65;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    // Horizontal boundary clamping
    if (left < 12) left = 12;
    if (left + popoverWidth > window.innerWidth - 12) {
      left = window.innerWidth - popoverWidth - 12;
    }

    let placeAbove = true;
    let top = rect.top - estimatedHeight - 8;
    if (top < 12) {
      // If there is insufficient space above, place cleanly below the trigger
      placeAbove = false;
      top = rect.bottom + 8;
    }

    setCoords({ top, left, placeAbove });
  }, [title]);

  const handleOpen = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // Close on outside interaction, escape, or window scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
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

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  const popoverContent = isOpen && typeof document !== 'undefined' ? (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
      }}
      className="w-64 p-2.5 bg-slate-900/95 border border-slate-700/90 rounded-xl shadow-2xl backdrop-blur-xl z-[99999] text-xs animate-in fade-in zoom-in-95 duration-100 pointer-events-none select-none"
    >
      {title && (
        <span className="font-outfit font-bold text-amber-300 block mb-1 text-[11px] uppercase tracking-wide">
          {title}
        </span>
      )}
      <p className="text-[11px] text-slate-200 leading-relaxed font-sans font-normal italic">
        {text}
      </p>
    </div>
  ) : null;

  return (
    <div className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        tabIndex={-1}
        onClick={handleToggle}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        className="p-0.5 text-slate-500 hover:text-amber-300 focus:text-amber-300 transition-colors cursor-pointer outline-none rounded shrink-0"
        aria-expanded={isOpen}
        aria-label="Field guidance information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {popoverContent && ReactDOM.createPortal(popoverContent, document.body)}
    </div>
  );
};
