import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { TraitsCard } from './TraitsCard';
import { MoneyCard } from './MoneyCard';
import { GearCard } from './GearCard';
import { SkillsetsPanel } from './SkillsetsPanel';
import { WeaponsCard } from './WeaponsCard';
import { ArmorCard } from './ArmorCard';
import { ShieldCard } from './ShieldCard';
import { VitalsHeader } from './VitalsHeader';
import { AbilitySlotsGrid } from './AbilitySlotsGrid';
import { SectionJumpHUD } from './SectionJumpHUD';
import { GmMonsterTrackerHud } from '../hud/GmMonsterTrackerHud';
import { PartyRosterHud } from '../hud/PartyRosterHud';

interface CharacterSheetViewProps {
  onOpenVitalityManager?: () => void;
  onOpenPartySelector?: () => void;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  onOpenVitalityManager,
  onOpenPartySelector,
}) => {
  const { activeCharacter, playerEmail } = useCharacterStore();
  const heroKey = activeCharacter?.id ? `hero_${activeCharacter.id}` : 'no_hero';

  return (
    <div key={heroKey} className="flex flex-col gap-4 w-full max-w-[2500px] mx-auto pb-16 relative">

      {/* Collision-Free Responsive Top Section: Traits (Left), Money (Center), Gear (Right) */}
      <div id="section-top-cards" className="flex flex-wrap items-center gap-4 scroll-mt-32">
        <div className="flex-1 min-w-[200px]">
          <TraitsCard />
        </div>
        <div className="flex-[2] min-w-[380px]">
          <MoneyCard />
        </div>
        <div className="flex-1 min-w-[200px]">
          <GearCard />
        </div>
      </div>

      {/* Screen-Wide Section: Skillsets & Derived Skills Registry */}
      <div id="section-skillsets" className="scroll-mt-32">
        <SkillsetsPanel />
      </div>

      {/* Responsive Combat & Protection Matrix: 2-Column (1366px Laptops) vs 3-Column (1920px+ Widescreen) */}
      <div id="section-combat-vitals" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 scroll-mt-32">
        {/* Column 1: Offense (Weapons & GM Monster Stats) */}
        <div className="flex flex-col gap-4">
          <WeaponsCard />
          <GmMonsterTrackerHud />
        </div>

        {/* Column 2: Protection (Armor with integrated MR & Shield) */}
        <div className="flex flex-col gap-4">
          <ArmorCard />
          <ShieldCard />
        </div>

        {/* Column 3: Survival (Vitality & Party Roster HUD) */}
        <div className="lg:col-span-2 xl:col-span-1 flex flex-col gap-4">
          <VitalsHeader onOpenVitalityManager={onOpenVitalityManager} />
          <PartyRosterHud
            activeCharacter={activeCharacter}
            playerEmail={playerEmail}
            onOpenPartySelector={onOpenPartySelector}
          />
        </div>
      </div>

      {/* 2-Column Responsive Section: 🔥 POWERS & ✨ MAGIC ITEMS */}
      <div id="section-powers-magic" className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-32">
        <AbilitySlotsGrid title="POWERS" type="powers" />
        <AbilitySlotsGrid title="MAGIC ITEMS" type="spells" />
      </div>

      {/* Quick Section Jump Navigation HUD Pill */}
      <SectionJumpHUD />
    </div>
  );
};
