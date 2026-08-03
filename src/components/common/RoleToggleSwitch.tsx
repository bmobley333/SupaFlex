// src/components/common/RoleToggleSwitch.tsx
// Dyslexia-Friendly Peg-Slider Toggle for Player vs GM Role Selection

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
    }
  };

  return (
    <div className="flex items-center gap-2.5 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner shrink-0">
      <span
        className={`text-xs font-extrabold transition-all duration-300 flex items-center gap-1 select-none ${
          !isGm ? 'text-cyan-400 opacity-100' : 'text-slate-400 opacity-50'
        }`}
      >
        <span>👤</span> Player
      </span>

      <label className="relative inline-flex items-center w-[46px] h-[24px] cursor-pointer m-0 shrink-0">
        <input
          type="checkbox"
          checked={isGm}
          onChange={handleToggle}
          disabled={disabled}
          className="sr-only peer"
        />
        <span className="absolute inset-0 bg-slate-800 border border-slate-700 peer-checked:bg-amber-950/90 peer-checked:border-amber-500/80 rounded-full transition-colors duration-300"></span>
        <span className="absolute left-[3px] top-[3px] w-[18px] h-[18px] bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-transform duration-300 ease-in-out peer-checked:translate-x-[22px] shadow-sm"></span>
      </label>

      <span
        className={`text-xs font-extrabold transition-all duration-300 flex items-center gap-1 select-none ${
          isGm ? 'text-amber-400 opacity-100' : 'text-slate-400 opacity-50'
        }`}
      >
        <span>👑</span> GM
      </span>
    </div>
  );
};
