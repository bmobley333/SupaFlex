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
import { GearPowersCard } from './GearPowersCard';
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
      <div id="card-skills" className="w-full scroll-mt-28">
        <SkillsetsPanel onTogglePosition={handleToggleTraitsSkillsPosition} isAtBottom={traitsSkillsAtBottom} />
      </div>
      <div id="card-traits" className="w-full scroll-mt-28">
        <TraitsQuirksCard onTogglePosition={handleToggleTraitsSkillsPosition} isAtBottom={traitsSkillsAtBottom} />
      </div>
    </div>
  );

  return (
    <div key={heroKey} className="flex flex-col gap-4 w-full max-w-[2500px] mx-auto pb-[60vh] relative">
      {/* Top Section: Character Card (Left) & Paths Card (Right) */}
      <div id="section-top-cards" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch scroll-mt-32">
        <div id="card-hero-hub" className="w-full h-full scroll-mt-28 flex flex-col">
          <HeroHubCard onOpenApManager={onOpenApManager} className="w-full h-full" />
        </div>
        <div id="card-paths" className="w-full h-full scroll-mt-28 flex flex-col">
          <PathsCard className="w-full h-full" />
        </div>
      </div>

      {/* Symmetrical 2-Column Capabilities Grid: Skills (Left) and Traits (Right) when at top */}
      {!traitsSkillsAtBottom && capabilitiesSection}

      {/* Responsive Combat & Protection Matrix: 2-Column (1366px Laptops) vs 3-Column (1920px+ Widescreen) */}
      <div id="section-combat-vitals" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 scroll-mt-32">
        {/* Column 1: Offense (Weapons & GM Monster Stats) */}
        <div className="flex flex-col gap-4">
          <div id="card-weapons" className="scroll-mt-28">
            <WeaponsCard />
          </div>
          <div id="card-monsters" className="scroll-mt-28">
            <GmMonsterTrackerHud />
          </div>
        </div>

        {/* Column 2: Protection (Armor with integrated MR, Shield, & Chaos Gauntlet) */}
        <div className="flex flex-col gap-4">
          <div id="card-armor" className="scroll-mt-28">
            <ArmorCard />
          </div>
          <div id="card-shield" className="scroll-mt-28">
            <ShieldCard />
          </div>
          <div id="card-chaos-gauntlet" className="scroll-mt-28">
            <ChaosGauntletCard />
          </div>
        </div>

        {/* Column 3: Survival (Vitality & Party Roster HUD) */}
        <div className="lg:col-span-2 xl:col-span-1 flex flex-col gap-4">
          <div id="card-vitals" className="scroll-mt-28">
            <VitalsHeader onOpenVitalityManager={onOpenVitalityManager} />
          </div>
          <div id="card-party" className="scroll-mt-28">
            <PartyRosterHud
              activeCharacter={activeCharacter}
              playerEmail={playerEmail}
              tabSessionId={tabSessionId}
              onOpenPartySelector={onOpenPartySelector}
            />
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Section: 🧿 GEAR POWERS & COMMERCE (Left) & 🔥 MY POWERS (Right) */}
      <div id="section-powers-magic" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start scroll-mt-32">
        {/* Column 1 (Left): Physical Commerce, Inventory & Gear Powers Combat Impacts */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-stretch">
            <div id="card-money" className="sm:col-span-7 flex scroll-mt-28">
              <MoneyCard className="w-full h-full" />
            </div>
            <div id="card-gear" className="sm:col-span-5 flex scroll-mt-28">
              <GearCard className="w-full h-full" />
            </div>
          </div>
          <div id="card-exotic-gear" className="scroll-mt-28">
            <GearPowersCard />
          </div>
        </div>

        {/* Column 2 (Right): My Powers */}
        <div id="card-powers" className="scroll-mt-28">
          <AbilitySlotsGrid title="MY POWERS" type="powers" />
        </div>
      </div>

      {/* Symmetrical 2-Column Capabilities Grid: Skills (Left) and Traits (Right) when relocated to bottom */}
      {traitsSkillsAtBottom && capabilitiesSection}

      {/* Quick Section Jump Navigation HUD Pill */}
      <SectionJumpHUD traitsSkillsAtBottom={traitsSkillsAtBottom} />
    </div>
  );
};
