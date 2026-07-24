// src/components/sheet/CharacterSheetView.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { TraitsCard } from './TraitsCard';
import { MoneyCard } from './MoneyCard';
import { GearCard } from './GearCard';
import { SkillsetsPanel } from './SkillsetsPanel';
import { WeaponsCard } from './WeaponsCard';
import { ArmorCard } from './ArmorCard';
import { ShieldCard } from './ShieldCard';
import { MovementRateCard } from './MovementRateCard';
import { VitalsHeader } from './VitalsHeader';
import { AbilitySlotsGrid } from './AbilitySlotsGrid';

export const CharacterSheetView: React.FC = () => {
  const { activeCharacter } = useCharacterStore();
  const heroKey = activeCharacter?.id ? `hero_${activeCharacter.id}` : 'no_hero';

  return (
    <div key={heroKey} className="flex flex-col gap-4 w-full max-w-[2500px] mx-auto">
      {/* 3-Column Top Section: Traits (Left), Money (Center), Gear (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TraitsCard />
        <MoneyCard />
        <GearCard />
      </div>

      {/* Screen-Wide Section: Skillsets & Derived Skills Registry */}
      <SkillsetsPanel />

      {/* 2-Column Responsive Section: Weapons (Left) vs. Armor, Shield, Movement Rate & Vitality (Right Stack) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeaponsCard />
        <div className="flex flex-col gap-4">
          <ArmorCard />
          <ShieldCard />
          <MovementRateCard />
          <VitalsHeader />
        </div>
      </div>

      {/* 2-Column Responsive Section: 🔥 POWERS & ✨ MAGIC ITEMS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AbilitySlotsGrid title="POWERS" type="powers" />
        <AbilitySlotsGrid title="MAGIC ITEMS" type="spells" />
      </div>
    </div>
  );
};
