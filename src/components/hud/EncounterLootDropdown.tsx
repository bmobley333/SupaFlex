// src/components/hud/EncounterLootDropdown.tsx
// High-Density Encounter Loot Dropdown for GM Encounter Notes

import React from 'react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useCharacterStore } from '../../store/useCharacterStore';
import { UniversalLootDropdown } from './UniversalLootDropdown';

interface EncounterLootDropdownProps {
  partyId?: string;
  className?: string;
}

export const EncounterLootDropdown: React.FC<EncounterLootDropdownProps> = ({ partyId, className = '' }) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());

  const addEncounterLoot = useAdventureStore((state) => state.addEncounterLoot);
  const deleteEncounterLoot = useAdventureStore((state) => state.deleteEncounterLoot);
  const clearEncounterLoot = useAdventureStore((state) => state.clearEncounterLoot);
  const sendLootToPartyVault = useAdventureStore((state) => state.sendLootToPartyVault);

  const loot = activeEnc?.loot || [];

  return (
    <UniversalLootDropdown
      label="GM Loot: Encounter"
      loot={loot}
      disabled={!activeEnc}
      disabledTooltip="Select an encounter first"
      themeColor="amber"
      className={className}
      onAddLoot={async (item) => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await addEncounterLoot(activeAdv.id, activeAct.id, activeEnc.id, item);
      }}
      onDeleteLoot={async (lootId) => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await deleteEncounterLoot(activeAdv.id, activeAct.id, activeEnc.id, lootId);
      }}
      onClearLoot={async () => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await clearEncounterLoot(activeAdv.id, activeAct.id, activeEnc.id);
      }}
      onSendToPartyVault={async (items, sourceLabel) => {
        const resolvedLabel = sourceLabel || `Encounter: ${activeEnc?.title || 'Battle'}`;
        return await sendLootToPartyVault(items, partyId || activePartyId || 'default', resolvedLabel);
      }}
    />
  );
};
