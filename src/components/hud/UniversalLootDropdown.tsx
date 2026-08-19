// src/components/hud/UniversalLootDropdown.tsx
// High-Density Parameterized Loot Trigger Button that opens UniversalLootModal

import React, { useState } from 'react';
import { Coins, ChevronDown } from 'lucide-react';
import { StagedLootItem } from '../../types/adventures';
import { UniversalLootModal } from '../modals/UniversalLootModal';

export interface UniversalLootDropdownProps {
  label: string; // e.g. "Adventure Loot", "Encounter Loot"
  loot: StagedLootItem[];
  onAddLoot: (item: Omit<StagedLootItem, 'id' | 'created_at'>) => Promise<void> | void;
  onDeleteLoot: (lootId: string) => Promise<void> | void;
  onClearLoot?: () => Promise<void> | void;
  onSendToPartyVault: (items: StagedLootItem[], sourceLabel: string) => Promise<boolean | void>;
  disabled?: boolean;
  disabledTooltip?: string;
  topLabel?: string;
  themeColor?: 'amber' | 'cyan' | 'rose' | 'indigo' | 'emerald';
  className?: string;
}

export const UniversalLootDropdown: React.FC<UniversalLootDropdownProps> = ({
  label,
  loot = [],
  onAddLoot,
  onDeleteLoot,
  onClearLoot,
  onSendToPartyVault,
  disabled = false,
  disabledTooltip,
  topLabel,
  themeColor = 'amber',
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      default:
        return {
          btn: 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border-amber-500/40',
          icon: 'text-amber-400',
          accent: 'text-amber-300',
          badge: 'bg-amber-900/80 text-amber-300 border-amber-700',
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
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border shadow-sm ${
            disabled
              ? 'bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
              : theme.btn
          }`}
          title={disabled && disabledTooltip ? disabledTooltip : label}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Coins className={`w-3.5 h-3.5 ${theme.icon} shrink-0`} />
            <span className="truncate">{label}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-1.5 py-0.2 border text-[10px] font-mono rounded font-extrabold ${theme.badge}`}>
              {loot.length}
            </span>
            <ChevronDown className={`w-3 h-3 ${theme.icon}`} />
          </div>
        </button>
      </div>

      {/* Universal Two-Pane Loot Modal */}
      <UniversalLootModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={label}
        loot={loot}
        onAddLoot={onAddLoot}
        onDeleteLoot={onDeleteLoot}
        onClearLoot={onClearLoot}
        onSendToPartyVault={onSendToPartyVault}
        themeColor={themeColor}
      />
    </>
  );
};
