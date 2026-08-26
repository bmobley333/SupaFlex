// src/components/common/GenrePillSwitch.tsx
// KISS Multi-Option Pill Switch for Genre Selection with Dynamic GuildSpace Support

import React, { useState, useEffect } from 'react';
import { useGenreStore, GenreType } from '../../store/useGenreStore';
import { isGuildSpaceUnlocked } from '../../utils/guildspaceAuth';

interface GenrePillSwitchProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const GenrePillSwitch: React.FC<GenrePillSwitchProps> = ({ className = '', size = 'md' }) => {
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const setActiveGenre = useGenreStore((state) => state.setActiveGenre);
  const [hasGuildSpace, setHasGuildSpace] = useState(isGuildSpaceUnlocked());

  useEffect(() => {
    const handleUnlock = () => setHasGuildSpace(true);
    const handleLock = () => {
      setHasGuildSpace(false);
      if (activeGenre === 'GuildSpace') {
        setActiveGenre('All');
      }
    };

    window.addEventListener('supaflex:guildspace-unlocked', handleUnlock);
    window.addEventListener('supaflex:guildspace-locked', handleLock);

    return () => {
      window.removeEventListener('supaflex:guildspace-unlocked', handleUnlock);
      window.removeEventListener('supaflex:guildspace-locked', handleLock);
    };
  }, [activeGenre, setActiveGenre]);

  const options: { id: GenreType; label: string; icon: string }[] = [
    { id: 'Medieval', label: 'Medieval', icon: '🏰' },
    { id: 'Modern', label: 'Modern', icon: '⚙️' },
    { id: 'SciFi', label: 'SciFi', icon: '🚀' },
    ...(hasGuildSpace ? [{ id: 'GuildSpace' as GenreType, label: 'GuildSpace', icon: '🌌' }] : []),
    { id: 'All', label: 'All', icon: '🌐' },
  ];

  const paddingClass = size === 'sm' ? 'py-1 px-2 text-[11px]' : 'py-1.5 px-3 text-xs';

  return (
    <div className={`bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md ${className}`}>
      {options.map((opt) => {
        const isActive = activeGenre === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setActiveGenre(opt.id)}
            className={`flex-1 ${paddingClass} font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isActive
                ? opt.id === 'GuildSpace'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border border-purple-400/50 shadow-md font-extrabold'
                  : 'bg-amber-600 text-white border border-amber-400/50 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
