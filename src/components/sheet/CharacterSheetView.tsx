// src/components/sheet/CharacterSheetView.tsx
import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { HeroHubCard } from './HeroHubCard';
import { PathsCard } from './PathsCard';
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

  const [traitsSkillsAtBottom, setTraitsSkillsAtBottom] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem('supaflex_traits_skills_bottom') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleTraitsSkillsPosition = React.useCallback(() => {
    setTraitsSkillsAtBottom((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('supaflex_traits_skills_bottom', String(next));
      } catch {}
      return next;
    });
    setTimeout(() => {
      const el = document.getElementById('section-capabilities');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }, []);

  const capabilitiesSection = (
    <div id="section-capabilities" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start scroll-mt-32">
      <SkillsetsPanel onTogglePosition={handleToggleTraitsSkillsPosition} isAtBottom={traitsSkillsAtBottom} />
      <TraitsQuirksCard onTogglePosition={handleToggleTraitsSkillsPosition} isAtBottom={traitsSkillsAtBottom} />
    </div>
  );

  return (
    <div key={heroKey} className="flex flex-col gap-4 w-full max-w-[2500px] mx-auto pb-[60vh] relative">
      {/* Top Section: Character Card (Left) & Paths Card (Right) */}
      <div id="section-top-cards" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch scroll-mt-32">
        <HeroHubCard onOpenApManager={onOpenApManager} className="w-full h-full" />
        <PathsCard className="w-full h-full" />
      </div>

      {/* Symmetrical 2-Column Capabilities Grid: Skills (Left) and Traits (Right) when at top */}
      {!traitsSkillsAtBottom && capabilitiesSection}

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

      {/* 2-Column Responsive Section: 🧿 EXOTIC GEAR POWERS & COMMERCE (Left) & 🔥 MY POWERS (Right) */}
      <div id="section-powers-magic" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start scroll-mt-32">
        {/* Column 1 (Left): Physical Commerce, Inventory & Exotic Combat Impacts */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
            <div className="sm:col-span-7 flex">
              <MoneyCard className="w-full h-full" />
            </div>
            <div className="sm:col-span-5 flex">
              <GearCard className="w-full h-full" />
            </div>
          </div>
          <AbilitySlotsGrid title="EXOTIC GEAR POWERS" type="spells" />
        </div>

        {/* Column 2 (Right): My Powers */}
        <AbilitySlotsGrid title="MY POWERS" type="powers" />
      </div>

      {/* Symmetrical 2-Column Capabilities Grid: Skills (Left) and Traits (Right) when relocated to bottom */}
      {traitsSkillsAtBottom && capabilitiesSection}

      {/* Quick Section Jump Navigation HUD Pill */}
      <SectionJumpHUD traitsSkillsAtBottom={traitsSkillsAtBottom} />
    </div>
  );
};
