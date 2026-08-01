import React from 'react';
import { useRulesHelp } from '../../hooks/useRulesHelp';

interface RuleTooltipProps {
  ruleKey: string;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackSummary?: string;
}

export const RuleTooltip: React.FC<RuleTooltipProps> = ({
  ruleKey,
  children,
  fallbackTitle,
  fallbackSummary,
}) => {
  const { rule } = useRulesHelp(ruleKey);

  const title = rule?.title || fallbackTitle || 'Rules Note';
  const summary = rule?.summary || fallbackSummary || 'Hover for critical rule context.';

  return (
    <span className="relative group inline-block cursor-help border-b border-dotted border-amber-400/60 hover:border-amber-300">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 w-60 p-2.5 rounded-md bg-slate-900/95 border border-amber-500/40 text-slate-100 text-xs shadow-2xl backdrop-blur-md hidden group-hover:block z-50 transition-opacity duration-150">
        <span className="block font-bold text-amber-300 mb-1 border-b border-slate-700/60 pb-0.5">
          {title}
        </span>
        <span className="block leading-relaxed text-slate-300 text-[11px]">
          {summary}
        </span>
      </span>
    </span>
  );
};
