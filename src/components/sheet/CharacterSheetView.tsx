// src/components/sheet/CharacterSheetView.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { HeroHubCard } from './HeroHubCard';
import { MoneyCard } from './MoneyCard';
import { GearCard } from './GearCard';
import { SkillsetsPanel } from './SkillsetsPanel';
import { WeaponsCard } from './WeaponsCard';
import { ArmorCard } from './ArmorCard';
import { ShieldCard } from './ShieldCard';
import { ChaosGauntletCard } from './ChaosGauntletCard';
import { VitalsHeader } from './VitalsHeader';
import { AbilitySlotsGrid } from './AbilitySlotsGrid';
import { SectionJumpHUD } from './SectionJumpHUD';
import { GmMonsterTrackerHud } from '../hud/GmMonsterTrackerHud';
import { PartyRosterHud } from '../hud/PartyRosterHud';

interface CharacterSheetViewProps {
  onOpenVitalityManager?: () => void;
  onOpenPartySelector?: () => void;
  onOpenApManager?: () => void;
  tabSessionId?: string;
}

export const CharacterSheetView: React.FC<CharacterSheetViewProps> = ({
  onOpenVitalityManager,
  onOpenPartySelector,
  onOpenApManager,
  tabSessionId,
}) => {
  const { activeCharacter, playerEmail } = useCharacterStore();
  const heroKey = activeCharacter?.id ? `hero_${activeCharacter.id}` : 'no_hero';

  return (
    <div key={heroKey} className="flex flex-col gap-4 w-full max-w-[2500px] mx-auto pb-16 relative">
      {/* High-Density Top Section: Hero Hub (Left), Money (Center), Gear (Right) */}
      <div id="section-top-cards" className="flex flex-wrap items-center gap-4 scroll-mt-32">
        <div className="flex-[2] min-w-[340px]">
          <HeroHubCard onOpenApManager={onOpenApManager} />
        </div>
        <div className="flex-1 min-w-[260px]">
          <MoneyCard />
        </div>
        <div className="flex-initial min-w-[180px]">
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

        {/* Column 2: Protection (Armor with integrated MR, Shield, & Chaos Gauntlet) */}
        <div className="flex flex-col gap-4">
          <ArmorCard />
          <ShieldCard />
          <ChaosGauntletCard />
        </div>

        {/* Column 3: Survival (Vitality & Party Roster HUD) */}
        <div className="lg:col-span-2 xl:col-span-1 flex flex-col gap-4">
          <VitalsHeader onOpenVitalityManager={onOpenVitalityManager} />
          <PartyRosterHud
            activeCharacter={activeCharacter}
            playerEmail={playerEmail}
            tabSessionId={tabSessionId}
            onOpenPartySelector={onOpenPartySelector}
          />
        </div>
      </div>

      {/* 2-Column Responsive Section: 🔥 POWERS & ⚡ LOADOUT (Relics & Hardware) */}
      <div id="section-powers-magic" className="grid grid-cols-1 lg:grid-cols-2 gap-4 scroll-mt-32">
        <AbilitySlotsGrid title="POWERS" type="powers" />
        <AbilitySlotsGrid title="LOADOUT (Relics & Hardware)" type="spells" />
      </div>

      {/* Quick Section Jump Navigation HUD Pill */}
      <SectionJumpHUD />
    </div>
  );
};
