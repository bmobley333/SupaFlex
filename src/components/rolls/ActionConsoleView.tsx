// src/components/rolls/ActionConsoleView.tsx
import React, { useState } from 'react';
import { RollConsole } from './RollConsole';
import { RollHistoryLog } from './RollHistoryLog';
import { RollResult } from '../../lib/dice';
import { useCharacterStore } from '../../store/useCharacterStore';

export const ActionConsoleView: React.FC = () => {
  const [recentRolls, setRecentRolls] = useState<RollResult[]>([]);
  const { activeCharacter, updateActiveCharacterMeta, saveActiveCharacter } = useCharacterStore();

  const handleRollComplete = (result: RollResult) => {
    setRecentRolls((prev) => [result, ...prev]);

    // Persist roll outcome to active character's log JSONB in Supabase
    if (activeCharacter) {
      const currentLog = Array.isArray(activeCharacter.log) ? activeCharacter.log : [];
      const updatedLog = [result, ...currentLog].slice(0, 50); // Keep last 50 rolls
      updateActiveCharacterMeta({ log: updatedLog });
      saveActiveCharacter();
    }
  };

  const handleClearLocalHistory = () => {
    setRecentRolls([]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-[2500px] mx-auto">
      {/* Left Column (2/3): Interactive Roll Console */}
      <div className="lg:col-span-2">
        <RollConsole onRollComplete={handleRollComplete} />
      </div>

      {/* Right Column (1/3): Combat & Roll History Feed */}
      <div>
        <RollHistoryLog recentRolls={recentRolls} onClearLocalHistory={handleClearLocalHistory} />
      </div>
    </div>
  );
};
