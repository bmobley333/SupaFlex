// src/components/sheet/CharacterSheetView.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { HeroIdentityHeader } from './HeroIdentityHeader';
import { VitalsHeader } from './VitalsHeader';
import { AttributesPanel } from './AttributesPanel';
import { SkillsetsPanel } from './SkillsetsPanel';
import { AbilitySlotsGrid } from './AbilitySlotsGrid';
import { EquipmentGrid } from './EquipmentGrid';

export const CharacterSheetView: React.FC = () => {
  const { activeCharacter } = useCharacterStore();
  const heroKey = activeCharacter?.id ? `hero_${activeCharacter.id}` : 'no_hero';

  return (
    <div key={heroKey} className="flex flex-col gap-6 w-full max-w-[2500px] mx-auto">
      {/* Hero Identity Banner: Name, Class, Race, Owner */}
      <HeroIdentityHeader />

      {/* Top Banner: Vitals & Level Math */}
      <VitalsHeader />

      {/* Main Grid Layout: Left Column (Attributes + Skillsets), Right Column (Powers, Spells, Equipment) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1/3) */}
        <div className="flex flex-col gap-6">
          <AttributesPanel />
          <SkillsetsPanel />
        </div>

        {/* Right Column (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AbilitySlotsGrid title="Active Powers" type="powers" />
          <AbilitySlotsGrid title="Spellbook & Magic Spells" type="spells" />
          <EquipmentGrid />
        </div>
      </div>
    </div>
  );
};
