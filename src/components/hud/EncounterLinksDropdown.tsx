// src/components/hud/EncounterLinksDropdown.tsx
// High-Density Encounter Links Dropdown for GM Encounter Notes

import React from 'react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { UniversalLinksDropdown } from './UniversalLinksDropdown';

interface EncounterLinksDropdownProps {
  className?: string;
}

export const EncounterLinksDropdown: React.FC<EncounterLinksDropdownProps> = ({ className = '' }) => {
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());

  const addEncounterLink = useAdventureStore((state) => state.addEncounterLink);
  const updateEncounterLink = useAdventureStore((state) => state.updateEncounterLink);
  const deleteEncounterLink = useAdventureStore((state) => state.deleteEncounterLink);
  const reorderEncounterLinkByIndex = useAdventureStore((state) => state.reorderEncounterLinkByIndex);

  const links = activeEnc?.links || [];

  return (
    <UniversalLinksDropdown
      label="Encounter Links"
      links={links}
      disabled={!activeEnc}
      disabledTooltip="Select an encounter first"
      themeColor="teal"
      className={className}
      onAddLink={async (name, url) => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await addEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, name, url);
      }}
      onUpdateLink={async (linkId, name, url) => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await updateEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, linkId, name, url);
      }}
      onDeleteLink={async (linkId) => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await deleteEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, linkId);
      }}
      onReorderLinkByIndex={async (fromIdx, toIdx) => {
        if (!activeAdv || !activeAct || !activeEnc) return;
        await reorderEncounterLinkByIndex(activeAdv.id, activeAct.id, activeEnc.id, fromIdx, toIdx);
      }}
    />
  );
};
