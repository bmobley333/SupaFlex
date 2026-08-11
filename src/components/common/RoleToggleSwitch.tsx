// src/components/common/RoleToggleSwitch.tsx
// Dyslexia-Friendly Multi-Option Pill Switch for Player vs GM Role Selection

import React from 'react';

interface RoleToggleSwitchProps {
  activeRole: 'player' | 'gm';
  onRoleChange: (newRole: 'player' | 'gm') => void | Promise<void>;
  disabled?: boolean;
}

export const RoleToggleSwitch: React.FC<RoleToggleSwitchProps> = ({
  activeRole,
  onRoleChange,
  disabled = false,
}) => {
  const isGm = activeRole === 'gm';

  const handleSelectRole = async (targetRole: 'player' | 'gm') => {
    if (disabled || targetRole === activeRole) return;
    try {
      await onRoleChange(targetRole);
    } catch (err) {
      console.error('[RoleToggleSwitch] Failed to switch role:', err);
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelectRole('player')}
        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
          !isGm
            ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
      >
        👤 Player
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelectRole('gm')}
        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
          isGm
            ? 'bg-purple-600 text-white font-extrabold shadow-sm'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
      >
        👑 GM
      </button>
    </div>
  );
};
