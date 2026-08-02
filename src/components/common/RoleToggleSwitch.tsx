// src/components/common/RoleToggleSwitch.tsx
// Dyslexia-Friendly Peg-Slider Toggle for Player vs Game Master Role Selection

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

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetRole = e.target.checked ? 'gm' : 'player';
    try {
      await onRoleChange(targetRole);
    } catch (err) {
      console.error('[RoleToggleSwitch] Failed to switch role:', err);
      // State rollback is handled by keeping activeRole prop unchanged in parent
    }
  };

  return (
    <div className="flex items-center gap-3 bg-slate-950/90 px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-inner">
      <span
        className={`text-xs font-extrabold transition-all duration-300 flex items-center gap-1.5 select-none ${
          !isGm ? 'text-cyan-400 opacity-100 scale-105' : 'text-slate-400 opacity-50'
        }`}
      >
        <span>👤</span> Player
      </span>

      <label className="relative inline-block w-12 h-6.5 cursor-pointer m-0">
        <input
          type="checkbox"
          checked={isGm}
          onChange={handleToggle}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gradient-to-r after:from-amber-400 after:to-amber-500 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:bg-amber-950/90 border border-slate-700 peer-checked:border-amber-500/80 shadow-md"></div>
      </label>

      <span
        className={`text-xs font-extrabold transition-all duration-300 flex items-center gap-1.5 select-none ${
          isGm ? 'text-amber-400 opacity-100 scale-105' : 'text-slate-400 opacity-50'
        }`}
      >
        <span>👑</span> Game Master
      </span>
    </div>
  );
};
