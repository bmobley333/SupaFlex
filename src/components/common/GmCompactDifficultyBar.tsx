// src/components/common/GmCompactDifficultyBar.tsx
// High-Density On-Screen Master Difficulty Scaling Bar for the GM Screen

import React from 'react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { GmThreatBar } from './GmThreatBar';

interface GmCompactDifficultyBarProps {
  className?: string;
}

export const GmCompactDifficultyBar: React.FC<GmCompactDifficultyBarProps> = ({ className = '' }) => {
  const activeEncounterDifficulty = useAdventureStore((state) => state.getActiveEncounterDifficulty());
  const scaleEncounterDifficulty = useAdventureStore((state) => state.scaleEncounterDifficulty);

  return (
    <GmThreatBar
      value={activeEncounterDifficulty}
      onChange={scaleEncounterDifficulty}
      label="Threat:"
      className={className}
    />
  );
};
