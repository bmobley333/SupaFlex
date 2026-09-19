// src/components/hud/EncounterNavigationRibbon.tsx
// High-Density Tactical Toolbar for Adventure Loot, Adventure Notes, and Ad-Lib Reset

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLinksDropdown } from './UniversalLinksDropdown';
import { UniversalLootDropdown } from './UniversalLootDropdown';

export { AdventureActBar } from './AdventureActBar';
export { EncounterSelectorBar } from './EncounterSelectorBar';

interface EncounterNavigationRibbonProps {
  partyId?: string;
  className?: string;
}

export const EncounterNavigationRibbon: React.FC<EncounterNavigationRibbonProps> = ({
  partyId,
  className = '',
}) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());

  const resetEncounterAll = useAdventureStore((state) => state.resetEncounterAll);

  const addAdventureLink = useAdventureStore((state) => state.addAdventureLink);
  const updateAdventureLink = useAdventureStore((state) => state.updateAdventureLink);
  const deleteAdventureLink = useAdventureStore((state) => state.deleteAdventureLink);
  const reorderAdventureLinkByIndex = useAdventureStore((state) => state.reorderAdventureLinkByIndex);

  const addAdventureLoot = useAdventureStore((state) => state.addAdventureLoot);
  const deleteAdventureLoot = useAdventureStore((state) => state.deleteAdventureLoot);
  const clearAdventureLoot = useAdventureStore((state) => state.clearAdventureLoot);
  const sendLootToPartyVault = useAdventureStore((state) => state.sendLootToPartyVault);

  return (
    <div className={`flex flex-col gap-1.5 font-outfit ${className}`}>
      {/* Master Ribbon Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/90 border border-slate-800 p-2 rounded-xl backdrop-blur-md shadow-md">
        {/* Left Section: Ad-Lib Encounter Reset Button (Visible when Ad-Lib Encounter is active) */}
        <div className="flex items-center gap-2">
          {(activeEnc?.is_adlib || activeEnc?.title === 'Ad-Lib Encounter') && (
            <button
              type="button"
              onClick={async () => {
                if (!activeAdv || !activeAct || !activeEnc) return;
                if (confirm('Reset all Encounter Monsters, Loot, and Notes to empty for this Ad-Lib Encounter?')) {
                  await resetEncounterAll(activeAdv.id, activeAct.id, activeEnc.id);
                }
              }}
              className="px-3 py-1 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/60 hover:border-rose-400 text-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg cursor-pointer h-[32px]"
              title="Reset all Encounter Monsters, Encounter Loot, and Encounter Notes to empty"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Ad-Lib Encounter 🧹</span>
            </button>
          )}
        </div>

        {/* Right Section: Adventure Loot Dropdown + Adventure Notes Dropdown */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Adventure Loot Dropdown (Amber Theme) */}
          <UniversalLootDropdown
            label="Adventure Loot"
            loot={activeAdv?.loot || activeAdv?.structure?.loot || []}
            disabled={!activeAdv}
            disabledTooltip="Select an adventure first"
            themeColor="amber"
            onAddLoot={async (item) => {
              if (!activeAdv) return;
              await addAdventureLoot(activeAdv.id, item);
            }}
            onDeleteLoot={async (lootId) => {
              if (!activeAdv) return;
              await deleteAdventureLoot(activeAdv.id, lootId);
            }}
            onClearLoot={async () => {
              if (!activeAdv) return;
              await clearAdventureLoot(activeAdv.id);
            }}
            onSendToPartyVault={async (items, sourceLabel) => {
              return await sendLootToPartyVault(items, partyId || activePartyId || 'default', sourceLabel);
            }}
          />

          {/* Adventure Notes Dropdown (Teal Theme) */}
          <UniversalLinksDropdown
            label="Adventure Notes"
            links={activeAdv?.links || activeAdv?.structure?.links || []}
            disabled={!activeAdv}
            disabledTooltip="Select an adventure first"
            themeColor="teal"
            onAddLink={async (name, url) => {
              if (!activeAdv) return;
              await addAdventureLink(activeAdv.id, name, url);
            }}
            onUpdateLink={async (linkId, name, url) => {
              if (!activeAdv) return;
              await updateAdventureLink(activeAdv.id, linkId, name, url);
            }}
            onDeleteLink={async (linkId) => {
              if (!activeAdv) return;
              await deleteAdventureLink(activeAdv.id, linkId);
            }}
            onReorderLinkByIndex={async (fromIdx, toIdx) => {
              if (!activeAdv) return;
              await reorderAdventureLinkByIndex(activeAdv.id, fromIdx, toIdx);
            }}
          />
        </div>
      </div>
    </div>
  );
};
