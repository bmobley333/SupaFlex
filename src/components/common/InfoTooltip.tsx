// src/components/common/InfoTooltip.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  title?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, title }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        tabIndex={-1}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="p-0.5 text-slate-500 hover:text-purple-300 focus:text-purple-300 transition-colors cursor-pointer outline-none rounded shrink-0"
        title="Hover or click for field guidance"
        aria-label="Field information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-xl backdrop-blur-md z-50 text-xs animate-fadeIn pointer-events-none"
        >
          {title && (
            <span className="font-outfit font-bold text-purple-300 block mb-1 text-[11px] uppercase tracking-wide">
              {title}
            </span>
          )}
          <p className="text-[11px] text-slate-200 leading-relaxed font-sans font-normal italic">
            {text}
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
};
