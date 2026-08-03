// src/components/header/AccountPillButton.tsx
import React from 'react';
import { Character } from '../../types/game';

interface AccountPillButtonProps {
  email: string;
  activeCharacter: Character | null;
  isGmMode: boolean;
  onOpenLaunchHub: () => void;
}

export const AccountPillButton: React.FC<AccountPillButtonProps> = ({
  email,
  activeCharacter,
  isGmMode,
  onOpenLaunchHub,
}) => {
  return (
    <button
      onClick={onOpenLaunchHub}
      className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl text-xs transition-all shadow-sm group cursor-pointer"
      title="Click to open Launch & Account Hub (Manage Characters, Auth, Inspect & Parties)"
    >
      <span className="font-mono text-amber-300 font-bold truncate max-w-[180px]">
        {email || 'Guest'}
      </span>

      {!isGmMode && (
        <>
          <span className="text-slate-500 font-bold">,</span>
          <span className="font-outfit font-extrabold text-slate-100 whitespace-nowrap flex items-center gap-1.5">
            {activeCharacter ? activeCharacter.name : 'Select Hero'}
          </span>
          {activeCharacter && (
            <div className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/35 text-purple-300 text-[10px] font-bold">
                {activeCharacter.race || 'Human'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-[10px] font-bold">
                {activeCharacter.class || 'Adventurer'}
              </span>
            </div>
          )}
        </>
      )}

      <span className="text-slate-400 group-hover:text-amber-400 transition-colors ml-1 text-xs">
        ⚙️
      </span>
    </button>
  );
};
