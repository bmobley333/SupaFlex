import React, { useState, useRef, useEffect } from 'react';
import { useRulesHelp } from '../../hooks/useRulesHelp';

interface CardHelpButtonProps {
  ruleKey: string;
  buttonLabel?: string;
  align?: 'left' | 'right' | 'auto';
}

export const CardHelpButton: React.FC<CardHelpButtonProps> = ({
  ruleKey,
  buttonLabel = '?',
  align = 'auto',
}) => {
  const { rule } = useRulesHelp(ruleKey);
  const [isOpen, setIsOpen] = useState(false);
  const [calculatedAlign, setCalculatedAlign] = useState<'left' | 'right'>('right');
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [activeTabIdx, setActiveTabIdx] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
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

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (align === 'left') {
        setCalculatedAlign('left');
      } else if (align === 'right') {
        setCalculatedAlign('right');
      } else {
        setCalculatedAlign(rect.left < window.innerWidth / 2 ? 'left' : 'right');
      }
    }
    setIsOpen(!isOpen);
    setActiveTabIdx(0);
  };

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

  // Helper to parse <!-- tab: [Title] --> blocks
  const parseTabs = (text: string) => {
    const tabRegex = /<!--\s*tab:\s*([^>]+?)\s*-->/gi;
    const matches = [...text.matchAll(tabRegex)];
    if (matches.length === 0) return null;

    const tabs: { label: string; content: string }[] = [];
    for (let i = 0; i < matches.length; i++) {
      const label = matches[i][1].trim();
      const startIdx = matches[i].index! + matches[i][0].length;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;
      const content = text.substring(startIdx, endIdx).trim();
      tabs.push({ label, content });
    }
    return tabs;
  };

  const renderTable = (tableLines: string[], keyPrefix: string | number) => {
    const parsedRows = tableLines.map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
    );

    // Filter out delimiter rows like | :--- | :--- |
    const contentRows = parsedRows.filter((r) => !r.every((cell) => /^[\s:\-]+$/.test(cell)));
    if (contentRows.length === 0) return null;

    const headers = contentRows[0];
    const bodyRows = contentRows.slice(1);

    return (
      <div key={keyPrefix} className="overflow-x-auto my-2 rounded-lg border border-slate-700/80 bg-slate-950/60 shadow-sm custom-scrollbar">
        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-700/80 text-amber-300 font-bold uppercase tracking-wider">
              {headers.map((h, i) => (
                <th key={i} className="px-2.5 py-1.5 border-r border-slate-800/80 last:border-r-0 whitespace-nowrap">
                  {formatTextWithApBadges(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {bodyRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-900/40 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1.5 border-r border-slate-800/60 last:border-r-0 leading-relaxed">
                    {formatTextWithApBadges(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFormattedSummary = (summaryText: string) => {
    const lines = summaryText.split('\n');
    const isStructured = lines.some((l) => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().startsWith('|') || l.toLowerCase().includes('gain 2 ap') || l.trim().endsWith(':') || l.trim() === 'Rolls' || l.trim() === 'Action');

    if (!isStructured) {
      return (
        <div className="text-slate-200 leading-relaxed mb-3 text-[12px] whitespace-pre-line font-sans select-text">
          {summaryText}
        </div>
      );
    }

    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        elements.push(<div key={`blank-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // Markdown Table Block Detection
      if (trimmed.startsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        elements.push(renderTable(tableLines, `table-${i}`));
        continue;
      }

      // Top Milestone Banner
      if (trimmed.toLowerCase().startsWith('gain 2 ap') || (trimmed.toLowerCase().startsWith('gain') && trimmed.toLowerCase().includes('ap per level'))) {
        elements.push(
          <div key={i} className="px-3 py-1.5 bg-amber-500/15 border border-amber-500/40 rounded-lg text-amber-300 font-bold text-xs flex items-center justify-between shadow-sm mb-2">
            <span className="flex items-center gap-1.5">
              <span className="text-sm">🧩</span> {trimmed}
            </span>
            <span className="text-[10px] uppercase font-mono tracking-wider bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded font-semibold">Milestone</span>
          </div>
        );
        i++;
        continue;
      }

      // Section Category Headers
      if (trimmed.endsWith(':') || trimmed === 'Free Level Advancement' || trimmed === 'Rolls' || trimmed === 'Action' || trimmed === 'Multi Attacking' || trimmed === 'Opportunity Attacks' || trimmed === 'Blocking Melee') {
        const cleanTitle = trimmed.endsWith(':') ? trimmed.slice(0, -1) : trimmed;
        elements.push(
          <div key={i} className="pt-2 pb-0.5 text-amber-400 font-bold text-[11.5px] uppercase tracking-wider border-b border-amber-500/25 mb-1 flex items-center gap-1.5">
            <span>⚡</span> {formatTextWithApBadges(cleanTitle)}
          </div>
        );
        i++;
        continue;
      }

      // Bullet Item Lines
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        const cleanLine = trimmed.replace(/^[•\-]\s*/, '');
        const separatorIdx = cleanLine.indexOf('—') !== -1 ? cleanLine.indexOf('—') : cleanLine.indexOf('-');
        const itemLabel = separatorIdx !== -1 ? cleanLine.substring(0, separatorIdx).trim() : cleanLine.trim();
        const itemContent = separatorIdx !== -1 ? cleanLine.substring(separatorIdx + 1).trim() : null;

        elements.push(
          <div key={i} className="flex items-start gap-1.5 pl-1 leading-snug">
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
        i++;
        continue;
      }

      // Fallback line
      elements.push(
        <p key={i} className="text-slate-300 leading-snug">
          {formatTextWithApBadges(line)}
        </p>
      );
      i++;
    }

    return (
      <div className="space-y-1.5 mb-3 text-[12px] text-slate-200 select-text">
        {elements}
      </div>
    );
  };

  const tabs = parseTabs(rule.summary);

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title={`View ${rule.title} Rules`}
        className="w-5 h-5 rounded-full bg-slate-800/80 hover:bg-amber-600/80 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-bold flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div
          className={`absolute ${calculatedAlign === 'left' ? 'left-0' : 'right-0'} mt-2 w-80 sm:w-[440px] max-w-[calc(100vw-2rem)] max-h-[75vh] overflow-y-auto p-4 rounded-xl bg-slate-900/95 border border-amber-500/50 shadow-2xl backdrop-blur-xl text-xs z-50 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar`}
        >
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2 mb-2 sticky top-0 bg-slate-900/90 backdrop-blur-md pt-0.5 z-10">
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

          {tabs && (
            <div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-2 mb-3 sticky top-8 bg-slate-900/90 backdrop-blur-md z-10">
              {tabs.map((tab, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTabIdx(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    activeTabIdx === idx
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {tabs
            ? renderFormattedSummary(tabs[activeTabIdx]?.content || '')
            : renderFormattedSummary(rule.summary)}

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

