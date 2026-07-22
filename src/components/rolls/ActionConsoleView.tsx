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

    // Calculate earned Sparks from roll events per SupaFlex Rules SoT:
    // 1 Spark for Tremendous (nat 20), 1 Spark for Critical (nat 1), +1 per Exploding Die
    const isTremendous = result.keptD20 === 20 || result.d20Rolls.includes(20);
    const isCritical = result.keptD20 === 1;
    const atrExplosions = result.attributeRoll?.explosionCount || 0;
    const focusExplosions = result.focusRoll?.explosionCount || 0;

    const earnedSparks = (isTremendous ? 1 : 0) + (isCritical ? 1 : 0) + atrExplosions + focusExplosions;

    if (earnedSparks > 0) {
      useCharacterStore.getState().addSpark(earnedSparks);
    }

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
