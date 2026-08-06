import React, { useState, useRef, useEffect } from 'react';
import { useRulesHelp } from '../../hooks/useRulesHelp';

interface CardHelpButtonProps {
  ruleKey: string;
  buttonLabel?: string;
}

export const CardHelpButton: React.FC<CardHelpButtonProps> = ({
  ruleKey,
  buttonLabel = '?',
}) => {
  const { rule } = useRulesHelp(ruleKey);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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

  if (!rule) return null;

  const BASE_PLAYER_GUIDE_URL = 'https://bmobley333.github.io/MetaScape-VitePress-GitHub-Pages/player-guide/supaflex/rules.html';
  const rawAnchor = rule.anchor || '';
  const formattedAnchor = rawAnchor ? (rawAnchor.startsWith('#') ? rawAnchor : `#${rawAnchor}`) : '';
  const playerGuideUrl = `${BASE_PLAYER_GUIDE_URL}${formattedAnchor}`;

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`View ${rule.title} Rules`}
        className="w-5 h-5 rounded-full bg-slate-800/80 hover:bg-amber-600/80 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-[440px] max-w-[92vw] max-h-[75vh] overflow-y-auto p-4 rounded-xl bg-slate-900/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2.5 sticky top-0 bg-slate-900/90 backdrop-blur-md pt-0.5 z-10">
            <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
              <span>📖</span> {rule.title}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 font-bold px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="text-slate-200 leading-relaxed mb-3 text-[12px] whitespace-pre-line font-sans select-text">
            {rule.summary}
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end sticky bottom-0 bg-slate-900/90 backdrop-blur-md pb-0.5">
            <a
              href={playerGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-400 hover:text-amber-300 hover:underline"
            >
              Full Rules Chapter ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

