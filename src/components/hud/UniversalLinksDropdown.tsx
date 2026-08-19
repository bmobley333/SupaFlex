// src/components/hud/UniversalLinksDropdown.tsx
// High-Density Parameterized Links Trigger Button that opens UniversalLinksModal

import React, { useState } from 'react';
import { Link2, ChevronDown } from 'lucide-react';
import { EncounterLink } from '../../types/adventures';
import { UniversalLinksModal } from '../modals/UniversalLinksModal';
import { useReceivedLinksStore } from '../../store/useReceivedLinksStore';

export interface UniversalLinksDropdownProps {
  label: string; // e.g. "GM Links", "Adventure Links", "Encounter Links", "Player Links", "Character Links"
  links: EncounterLink[];
  onAddLink: (name: string, url: string, tag?: string, desc?: string) => Promise<void> | void;
  onUpdateLink: (linkId: string, name: string, url: string, tag?: string, desc?: string) => Promise<void> | void;
  onDeleteLink: (linkId: string) => Promise<void> | void;
  onReorderLinkByIndex?: (fromIdx: number, toIdx: number) => Promise<void> | void;
  disabled?: boolean;
  disabledTooltip?: string;
  topLabel?: string; // Optional uppercase header above button (e.g. for Adventure Ribbon)
  themeColor?: 'teal' | 'indigo' | 'amber' | 'cyan' | 'rose' | 'emerald';
  className?: string;
}

export const UniversalLinksDropdown: React.FC<UniversalLinksDropdownProps> = ({
  label,
  links = [],
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onReorderLinkByIndex,
  disabled = false,
  disabledTooltip,
  topLabel,
  themeColor = 'teal',
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const unreadCount = useReceivedLinksStore((state) => state.unreadCount);

  const getThemeClasses = () => {
    switch (themeColor) {
      case 'rose':
        return {
          btn: 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border-rose-500/40',
          icon: 'text-rose-400',
          accent: 'text-rose-300',
          badge: 'bg-rose-900/80 text-rose-300 border-rose-700',
        };
      case 'cyan':
        return {
          btn: 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border-cyan-500/40',
          icon: 'text-cyan-400',
          accent: 'text-cyan-300',
          badge: 'bg-cyan-900/80 text-cyan-300 border-cyan-700',
        };
      case 'indigo':
        return {
          btn: 'bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 border-indigo-500/40',
          icon: 'text-indigo-400',
          accent: 'text-indigo-300',
          badge: 'bg-indigo-900/80 text-indigo-300 border-indigo-700',
        };
      case 'emerald':
        return {
          btn: 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 border-emerald-500/40',
          icon: 'text-emerald-400',
          accent: 'text-emerald-300',
          badge: 'bg-emerald-900/80 text-emerald-300 border-emerald-700',
        };
      case 'amber':
        return {
          btn: 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border-amber-500/40',
          icon: 'text-amber-400',
          accent: 'text-amber-300',
          badge: 'bg-amber-900/80 text-amber-300 border-amber-700',
        };
      case 'teal':
      default:
        return {
          btn: 'bg-teal-950/70 hover:bg-teal-900/80 text-teal-200 border-teal-500/40',
          icon: 'text-teal-400',
          accent: 'text-teal-300',
          badge: 'bg-teal-900/80 text-teal-300 border-teal-700',
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <>
      <div className={`flex flex-col items-center gap-1 relative ${className}`}>
        {topLabel && (
          <span className={`text-[11px] font-extrabold uppercase tracking-wider ${theme.accent} font-mono text-center`}>
            {topLabel}
          </span>
        )}

        {/* Main Trigger Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsModalOpen(true)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border shadow-sm relative ${
            disabled
              ? 'bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
              : theme.btn
          }`}
          title={disabled && disabledTooltip ? disabledTooltip : label}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Link2 className={`w-3.5 h-3.5 ${theme.icon} shrink-0`} />
            <span className="truncate">{label}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-1.5 py-0.2 border text-[10px] font-mono rounded font-extrabold ${theme.badge}`}>
              {links.length}
            </span>
            <ChevronDown className={`w-3 h-3 ${theme.icon}`} />
          </div>

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-slate-950 animate-pulse" title={`${unreadCount} unread received link(s)`} />
          )}
        </button>
      </div>

      {/* Universal Two-Pane Links Modal */}
      <UniversalLinksModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={label}
        links={links}
        onAddLink={onAddLink}
        onUpdateLink={onUpdateLink}
        onDeleteLink={onDeleteLink}
        onReorderLinkByIndex={onReorderLinkByIndex}
        themeColor={themeColor}
      />
    </>
  );
};
