// src/components/common/GmMinionVitSelector.tsx
// High-Density, Dyslexia-Friendly Minion Class & Vitality Selector Popover
// Supports 1-click card badge mode and inline edit-card button mode beside GmThreatStepper.

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

export interface GmMinionVitSelectorProps {
  currentVit?: number;
  baseVit?: number;
  minionVit?: number;
  value?: number;
  onSelect?: (newMinionVit: number | undefined) => void;
  onChange?: (newMinionVit: number | undefined) => void;
  variant?: 'badge' | 'button';
  className?: string;
  disabled?: boolean;
}

export const GmMinionVitSelector: React.FC<GmMinionVitSelectorProps> = ({
  currentVit,
  baseVit,
  minionVit,
  value,
  onSelect,
  onChange,
  variant = 'badge',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    placeAbove: true,
  });

  const effectiveMinionVit = minionVit !== undefined ? minionVit : value;
  const isMinion = typeof effectiveMinionVit === 'number' && effectiveMinionVit > 0;
  const effectiveCurrentVit = currentVit ?? (isMinion ? effectiveMinionVit : 10);
  const displayBaseVit = baseVit || (isMinion ? 10 : effectiveCurrentVit);

  // Position popover relative to trigger button
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 260;
    const popoverHeight = 150;

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
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (val: number | undefined, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelect) onSelect(val);
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const minionTooltip = isMinion
    ? `Minion Class (Locked Vit: ${effectiveMinionVit} • Threat-Level Immune) • Click to change`
    : `Vitality: ${effectiveCurrentVit} • Click to set Minion Class`;

  return (
    <>
      {variant === 'badge' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          title={minionTooltip}
          className={`shrink-0 inline-flex items-center gap-0.5 rounded transition-all cursor-pointer select-none leading-none ${
            isMinion
              ? 'bg-purple-950/50 border border-purple-500/50 hover:border-purple-400 text-purple-300 font-bold px-1.5 py-0.5 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
              : 'text-slate-300 hover:text-rose-300 hover:bg-slate-800/80 px-1 py-0.5 border border-transparent hover:border-slate-700/60'
          } ${className}`}
        >
          <span className="text-[11px] leading-none">{isMinion ? '💔' : '❤️'}</span>
          <span
            className={`text-[11px] tabular-nums ${
              isMinion ? 'font-extrabold text-purple-300' : 'font-mono'
            }`}
          >
            {isMinion ? effectiveMinionVit : effectiveCurrentVit}
          </span>
        </button>
      ) : (
        /* Button variant: used inside edit cards directly beside GmThreatStepper */
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          title={minionTooltip}
          className={`h-[29px] px-2.5 text-xs font-bold rounded-lg border inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none font-outfit shrink-0 ${
            isMinion
              ? 'bg-purple-950/90 text-purple-300 border-purple-500/50 hover:border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
              : 'bg-slate-900/90 text-rose-300/90 border-slate-800 hover:border-rose-500/50 hover:bg-slate-800/80'
          } ${className}`}
        >
          <span className="leading-none">{isMinion ? '💔' : '❤️'}</span>
          <span className="leading-none">
            {isMinion ? (
              <>
                Minion: <strong className="text-purple-200 font-black">{effectiveMinionVit}</strong>
              </>
            ) : (
              `Normal (${effectiveCurrentVit})`
            )}
          </span>
          <span className="text-[10px] text-slate-400 leading-none">▾</span>
        </button>
      )}

      {/* Floating Popover via Portal */}
      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '260px',
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-md font-outfit text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800/80">
              <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <span>❤️</span> Vitality & Minion Class
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Option 1: Normal Vitality */}
            <button
              type="button"
              onClick={(e) => handleSelect(undefined, e)}
              className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center justify-between border transition-all cursor-pointer ${
                !isMinion
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 shadow-sm font-extrabold'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-850 border-slate-800'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span>❤️</span> Normal Vitality
              </span>
              <span className="text-[11px] opacity-75 tabular-nums">
                {displayBaseVit} Vit
              </span>
            </button>

            {/* Section 2: Minion Class (1-5 Vit) */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80">
              <div className="text-[10px] font-bold text-purple-400/90 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>💔 Minion Class (Threat-Immune)</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800/90 p-1 rounded-xl flex items-center gap-1 shadow-inner">
                {[1, 2, 3, 4, 5].map((val) => {
                  const active = effectiveMinionVit === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={(e) => handleSelect(val, e)}
                      title={`Set to Minion with locked Vit ${val} (Threat-Level Immune)`}
                      className={`flex-1 py-1 px-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-0.5 cursor-pointer ${
                        active
                          ? 'bg-purple-600 text-white shadow-sm font-black border border-purple-400/60'
                          : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800/80 border border-transparent'
                      }`}
                    >
                      <span className="text-[10px]">💔</span>
                      <span className={active ? 'text-white font-black' : 'text-purple-300 font-extrabold'}>
                        {val}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer Explainer */}
            <p className="text-[9px] text-slate-500 text-center font-mono mt-2 leading-tight">
              Minion Vit is locked & immune to Threat Level scaling.
            </p>
          </div>,
          document.body
        )}
    </>
  );
};
