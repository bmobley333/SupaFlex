// src/components/header/AccountPillButton.tsx
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AccountPillButtonProps {
  email: string;
  isGmMode: boolean;
  onOpenLaunchHub: () => void;
}

export const AccountPillButton: React.FC<AccountPillButtonProps> = ({
  email,
  isGmMode,
  onOpenLaunchHub,
}) => {
  return (
    <button
      onClick={onOpenLaunchHub}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl text-xs transition-all shadow-sm group cursor-pointer"
      title="Click to open Launch & Account Hub (Manage Characters, Auth, Inspect & Parties)"
    >
      <span className="font-mono text-amber-300 font-bold truncate max-w-[200px]">
        {email || 'Guest'}
      </span>

      {isGmMode && (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider font-outfit">
          GM Mode
        </span>
      )}

      <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0" />
    </button>
  );
};
