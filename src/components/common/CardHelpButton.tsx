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

  // Helper to format inline AP cost badges like (1 AP), (2 AP), (1–2 AP), (2–8 AP), (5–8 AP)
  const formatTextWithApBadges = (text: string) => {
    const apRegex = /(\(\s*[\d–\-]+\s*AP\s*\))/gi;
    const parts = text.split(apRegex);
    return parts.map((part, idx) => {
      if (apRegex.test(part)) {
        const cleanCost = part.replace(/[()]/g, '').trim();
        return (
          <span
            key={idx}
            className="ml-1 inline-flex items-center px-1.5 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-500/40 rounded text-[10px] font-mono font-bold leading-none shadow-sm"
          >
            {cleanCost}
          </span>
        );
      }
      return part;
    });
  };

  const renderFormattedSummary = (summaryText: string) => {
    const lines = summaryText.split('\n');
    const isStructured = lines.some((l) => l.trim().startsWith('•') || l.trim().startsWith('-') || l.toLowerCase().includes('gain 2 ap') || l.trim().endsWith(':'));

    if (!isStructured) {
      return (
        <div className="text-slate-200 leading-relaxed mb-3 text-[12px] whitespace-pre-line font-sans select-text">
          {summaryText}
        </div>
      );
    }

    return (
      <div className="space-y-1.5 mb-3 text-[12px] text-slate-200 select-text">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          // Top Milestone Banner
          if (trimmed.toLowerCase().startsWith('gain 2 ap') || (trimmed.toLowerCase().startsWith('gain') && trimmed.toLowerCase().includes('ap per level'))) {
            return (
              <div key={idx} className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 rounded-lg text-amber-300 font-bold text-xs flex items-center justify-between shadow-sm mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm">🧩</span> {trimmed}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded font-semibold">Milestone</span>
              </div>
            );
          }

          // Section Category Headers
          if (trimmed.endsWith(':') || trimmed === 'Free Level Advancement') {
            return (
              <div key={idx} className="pt-2 pb-0.5 text-amber-400 font-bold text-[11.5px] uppercase tracking-wider border-b border-amber-500/25 mb-1 flex items-center gap-1.5">
                <span>⚡</span> {formatTextWithApBadges(trimmed)}
              </div>
            );
          }

          // Bullet Item Lines
          if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            const cleanLine = trimmed.replace(/^[•\-]\s*/, '');
            const separatorIdx = cleanLine.indexOf('—') !== -1 ? cleanLine.indexOf('—') : cleanLine.indexOf('-');
            const itemLabel = separatorIdx !== -1 ? cleanLine.substring(0, separatorIdx).trim() : cleanLine.trim();
            const itemContent = separatorIdx !== -1 ? cleanLine.substring(separatorIdx + 1).trim() : null;

            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1 leading-snug">
                <span className="text-amber-400 font-bold text-xs leading-none mt-0.5">•</span>
                <div className="flex-1">
                  {itemContent ? (
                    <>
                      <span className="font-semibold text-slate-100 mr-1">
                        {itemLabel} —
                      </span>
                      <span className="text-slate-300">
                        {formatTextWithApBadges(itemContent)}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-100">
                      {formatTextWithApBadges(cleanLine)}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          // Fallback line
          return (
            <p key={idx} className="text-slate-300 leading-snug">
              {formatTextWithApBadges(line)}
            </p>
          );
        })}
      </div>
    );
  };

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
        <div className="absolute right-0 mt-2 w-80 sm:w-[440px] max-w-[92vw] max-h-[75vh] overflow-y-auto p-4 rounded-xl bg-slate-900/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl text-xs z-50 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
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

          {renderFormattedSummary(rule.summary)}

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between sticky bottom-0 bg-slate-900/90 backdrop-blur-md pb-0.5 z-10">
            <a
              href="https://notebook.google.com/notebook/8a1b90e8-17e0-44a2-a926-667dc08234a7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-sky-400 hover:text-sky-300 hover:underline"
            >
              <span>✨</span> Gemini Notebook ↗
            </a>
            <a
              href={playerGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-amber-400 hover:text-amber-300 hover:underline"
            >
              <span>📖</span> Full Rules Chapter ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

