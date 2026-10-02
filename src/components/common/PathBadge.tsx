// src/components/common/PathBadge.tsx
import React from 'react';

export interface PathBadgeProps {
  pathName: string;
  category: 'Class' | 'Race' | 'Bonus' | 'Innate' | 'Universal';
  className?: string;
}

const CATEGORY_STYLES: Record<PathBadgeProps['category'], string> = {
  Innate: 'bg-slate-900 text-slate-300 border-slate-700',
  Race: 'bg-rose-950 text-rose-300 border-rose-500/40',
  Class: 'bg-purple-950 text-purple-200 border-purple-500/50',
  Universal: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
  Bonus: 'bg-slate-900 text-indigo-300 border-indigo-500/30 font-semibold',
};

export const PathBadge: React.FC<PathBadgeProps> = ({
  pathName,
  category,
  className = '',
}) => {
  const styleClasses = CATEGORY_STYLES[category] || CATEGORY_STYLES.Bonus;

  return (
    <span
      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 shrink-0 select-none shadow-sm ${styleClasses} ${className}`}
      title={`Granted by ${category} Path: ${pathName}`}
    >
      <span className="shrink-0 leading-none">🧭</span>
      <span className="truncate">{pathName}</span>
    </span>
  );
};
