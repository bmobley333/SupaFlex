// src/components/sheet/CharacterSheetView.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { HeroHubCard } from './HeroHubCard';
import { MoneyCard } from './MoneyCard';
import { GearCard } from './GearCard';
import { TraitsQuirksCard } from './TraitsQuirksCard';
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
      <div id="section-top-cards" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch scroll-mt-32">
        <div className="lg:col-span-12 xl:col-span-5 2xl:col-span-6 flex">
          <HeroHubCard onOpenApManager={onOpenApManager} className="w-full h-full" />
        </div>
        <div className="lg:col-span-7 xl:col-span-4 2xl:col-span-4 flex">
          <MoneyCard className="w-full h-full" />
        </div>
        <div className="lg:col-span-5 xl:col-span-3 2xl:col-span-2 flex">
          <GearCard className="w-full h-full" />
        </div>
      </div>

      {/* Symmetrical 2-Column Capabilities Grid: Core Traits (Left) and Skills (Right) */}
      <div id="section-capabilities" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start scroll-mt-32">
        <TraitsQuirksCard />
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

      {/* 2-Column Responsive Section: 🔥 POWERS & 🧿💍 LOADOUT (Exotics & Artifacts) */}
      <div id="section-powers-magic" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start scroll-mt-32">
        <AbilitySlotsGrid title="POWERS" type="powers" />
        <AbilitySlotsGrid title="LOADOUT (Exotics & Artifacts)" type="spells" />
      </div>

      {/* Quick Section Jump Navigation HUD Pill */}
      <SectionJumpHUD />
    </div>
  );
};
