// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { gameApi } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { Party, PartySessionMember, SupabaseMonster } from '../../types/game';
import { parseMonsterLine, ParsedMonster, resolveCodexMonsterNotes, formatMonsterDataToStatblock, decomposeMonsterStatblock } from '../../utils/monsterStatParser';
import { PartyCharacterCard, resolveCharFirstName } from '../common/PartyCharacterCard';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { MonsterManagerModal } from '../modals/MonsterManagerModal';
import { GmThreatStepper } from '../common/GmThreatStepper';
import { GmMinionVitSelector } from '../common/GmMinionVitSelector';
import { scaleStatlineText, scaleStatByAnchor } from '../../utils/monsterStatScaler';
import { AdventureActBar } from '../hud/AdventureActBar';
import { EncounterSelectorBar } from '../hud/EncounterSelectorBar';
import { UniversalLinksDropdown } from '../hud/UniversalLinksDropdown';
import { UniversalLootDropdown } from '../hud/UniversalLootDropdown';
import { GmEncounterNotesCard } from '../hud/GmEncounterNotesCard';
import { GmFloatingNotesHud, FloatingWindowBounds } from '../hud/GmFloatingNotesHud';
import { useAdventureStore } from '../../store/useAdventureStore';
import { sanitizeRosterMonsters } from '../../utils/monsterSanitizer';

export interface GmRosterMonster {
  id: string;
  name: string;
  nish: number;
  coreStatsText: string;
  fullText: string;
  baseFullText?: string;
  scaled_dif?: number;
  minion_vit?: number;
  base_vit?: number;
  mr?: number;
  attack?: number;
  damage?: number;
  wounds?: string;
  defense?: number;
  armor?: number;
  max_vit?: number;
  attributes?: { magic: number; might: number; mind: number; motion: number; moxie: number };
  gear?: string;
  abilities?: string;
  gm_notes?: string;
}

export type GmUnifiedRosterItem =
  | { type: 'member'; id: string; member: PartySessionMember }
  | { type: 'monster'; id: string; monster: GmRosterMonster };

export function parseMonsterForGmRoster(
  raw: string,
  idPrefixOrId = 'gm_mon_',
  explicitId?: string,
  baseFullText?: string,
  scaled_dif?: number
): GmRosterMonster {
  const trimmed = (raw || '').trim();
  const monId = explicitId || `${idPrefixOrId}${Math.random().toString(36).substring(2, 9)}`;

  // Extract Name (before first combat stat icon 🚩, 👣, ⚔️, ⚔, 🛡️, 🧥, 🥋, ❤️, 💔)
  const firstIconMatch = trimmed.match(/[🚩👣🥊⚔️⚔🛡️🧥🥋❤️💔]/u);
  let rawName = trimmed;
  if (firstIconMatch && firstIconMatch.index !== undefined) {
    rawName = trimmed.substring(0, firstIconMatch.index).trim();
  }

  // Clean Name: remove leading punctuation/dashes, preserve numbers & equipment
  let cleanName =
    rawName
      .replace(/^[\:\–\-\s]+/, '')
      .replace(/[\:\–\-]+$/, '')
      .trim() || 'Monster';

  // Extract Gear (⚔️🧥) from () before 🚩
  let gear = '';
  const parenMatch = cleanName.match(/\(([^)]+)\)/);
  if (parenMatch) {
    gear = parenMatch[1].trim();
    cleanName = cleanName.replace(/\([^)]+\)/, '').replace(/\s+/g, ' ').trim();
  } else {
    const bracketMatch = cleanName.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      gear = bracketMatch[1].trim();
      cleanName = cleanName.replace(/\[[^\]]+\]/, '').replace(/\s+/g, ' ').trim();
    }
  }
  cleanName = cleanName.replace(/[\:\–\-]+$/, '').trim() || 'Monster';

  // Extract stats
  const initMatch = trimmed.match(/🚩\s*(\d+)/u);
  const nish = initMatch ? parseInt(initMatch[1], 10) : 10;

  const mrMatch = trimmed.match(/👣\s*(\d+)/u);
  const mr = mrMatch ? parseInt(mrMatch[1], 10) : 10;

  // Attack & Damage: match ⚔️ or ⚔
  const atkMatch = trimmed.match(/(?:⚔️|⚔)\s*(\d+)\s*\/\s*(\d+)(?:\s*\((\d+)\))?/u);
  const atk = atkMatch ? atkMatch[1] : '10';
  const dmg = atkMatch ? atkMatch[2] : '5';
  const wounds = atkMatch && atkMatch[3] ? `(${atkMatch[3]})` : '';

  // Defense & Armor: match 🧥 or 🛡️
  const defMatch = trimmed.match(/(?:🧥|🛡️)\s*(\d+)\s*\/\s*(\d+)/u);
  const def = defMatch ? defMatch[1] : '10';
  const arm = defMatch ? defMatch[2] : '0';

  // Vitality: match ❤️, ❤, or 💔
  const vitMatch = trimmed.match(/(?:❤️|❤|💔)\s*(\d+)/u);
  const vit = vitMatch ? vitMatch[1] : '10';
  const isMinionHeart = vitMatch ? vitMatch[0].startsWith('💔') : false;
  const minionVitVal = isMinionHeart && vitMatch ? parseInt(vitMatch[1], 10) : undefined;

  // Attributes: [✨.../💪.../👁️.../🏃.../(🫀|💖)...]
  const attrMatch = trimmed.match(/\[\s*✨\s*(\d+)\s*\/\s*💪\s*(\d+)\s*\/\s*(?:👁️|👁)\s*(\d+)\s*\/\s*🏃\s*(\d+)\s*\/\s*(🫀|💖)\s*(\d+)\s*\]/u);

  let attrBlock = '';
  if (attrMatch) {
    const magic = attrMatch[1];
    const might = attrMatch[2];
    const mind = attrMatch[3];
    const motion = attrMatch[4];
    const moxieIcon = attrMatch[5]; // preserves 💖 or 🫀 exactly
    const moxie = attrMatch[6];
    attrBlock = `– [✨${magic}/💪${might}/👁️${mind}/🏃${motion}/${moxieIcon}${moxie}]`;
  } else {
    // Fallback if bracket notation has non-standard tokens
    const rawAttrMatch = trimmed.match(/(\[[^\]]*?(?:🫀|💖)[^\]]*?\])/u);
    if (rawAttrMatch) {
      attrBlock = `– ${rawAttrMatch[1]}`;
    }
  }

  // Extract Abilities (🔥) from text after attributes
  let abilities = '';
  const attrEndMatch = trimmed.match(/(?:🫀|💖)\s*\d+\s*\]\s*(.*)$/u);
  if (attrEndMatch && attrEndMatch[1]) {
    let trailing = attrEndMatch[1].trim();
    const outerParen = trailing.match(/^\((.*)\)$/);
    if (outerParen) {
      trailing = outerParen[1].trim();
    }
    abilities = trailing;
  }

  // Canonical full-color emoji presentation:
  // ⚔️ (\u2694\uFE0F) and ❤️ / 💔 with standardized spacing
  const heartIcon = isMinionHeart ? '💔' : '❤️';
  const coreStatsText = `👣${mr} ⚔️${atk}/${dmg}${wounds} 🧥${def}/${arm} ${heartIcon}${vit} ${attrBlock}`.trim();

  return {
    id: monId,
    name: cleanName,
    nish,
    coreStatsText,
    fullText: trimmed,
    baseFullText: baseFullText || trimmed,
    scaled_dif: scaled_dif ?? 10,
    mr,
    attack: parseInt(atk, 10) || 10,
    damage: parseInt(dmg, 10) || 5,
    wounds,
    defense: parseInt(def, 10) || 10,
    armor: parseInt(arm, 10) || 0,
    max_vit: parseInt(vit, 10) || 10,
    minion_vit: minionVitVal,
    base_vit: isMinionHeart ? undefined : (parseInt(vit, 10) || 10),
    gear: gear || undefined,
    abilities: abilities || undefined,
    gm_notes: abilities || undefined,
    attributes: attrMatch ? {
      magic: parseInt(attrMatch[1], 10) || 10,
      might: parseInt(attrMatch[2], 10) || 10,
      mind: parseInt(attrMatch[3], 10) || 10,
      motion: parseInt(attrMatch[4], 10) || 10,
      moxie: parseInt(attrMatch[6], 10) || 10,
    } : {
      magic: 10, might: 10, mind: 10, motion: 10, moxie: 10,
    },
  };
}

interface GmWorkspaceViewProps {
  activeParty: Party | null;
  currentEmail: string;
  onOpenLaunchHub?: () => void;
  onSelectActiveParty?: (party: Party) => void;
  /** Called once the GM room code has been checked out from the DB so the header HUD can display it. */
  onRoomCodeReady?: (code: string) => void;
}

export const GmWorkspaceView: React.FC<GmWorkspaceViewProps> = ({
  activeParty: propActiveParty,
  currentEmail,
  onSelectActiveParty,
  onRoomCodeReady,
}) => {
  // GM Party State
  const [selectedParty, setSelectedParty] = useState<Party | null>(propActiveParty);
  const [supabaseMonsters, setSupabaseMonsters] = useState<SupabaseMonster[]>([]);

  useEffect(() => {
    gameApi.getSupabaseMonsters().then((data) => {
      if (data && data.length > 0) {
        setSupabaseMonsters(data);
      }
    });
  }, []);

  // Modal triggers
  const [isMonsterManagerOpen, setIsMonsterManagerOpen] = useState(false);

  // Adventure Store State
  const fetchAdventures = useAdventureStore((state) => state.fetchAdventures);
  const activeMonsters = useAdventureStore((state) => state.getActiveMonsters());
  const activeEncounter = useAdventureStore((state) => state.getActiveEncounter());
  const activeEncounterDifficulty = useAdventureStore((state) => state.getActiveEncounterDifficulty());
  const scaleEncounterDifficulty = useAdventureStore((state) => state.scaleEncounterDifficulty);
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeAdventure = useAdventureStore((state) => state.getActiveAdventure());
  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const updateEncounter = useAdventureStore((state) => state.updateEncounter);
  const setEncounterMonsters = useAdventureStore((state) => state.setEncounterMonsters);
  const resetEncounterAll = useAdventureStore((state) => state.resetEncounterAll);
  const addAdventureLink = useAdventureStore((state) => state.addAdventureLink);
  const updateAdventureLink = useAdventureStore((state) => state.updateAdventureLink);
  const deleteAdventureLink = useAdventureStore((state) => state.deleteAdventureLink);
  const reorderAdventureLinkByIndex = useAdventureStore((state) => state.reorderAdventureLinkByIndex);
  const addAdventureLoot = useAdventureStore((state) => state.addAdventureLoot);
  const deleteAdventureLoot = useAdventureStore((state) => state.deleteAdventureLoot);
  const clearAdventureLoot = useAdventureStore((state) => state.clearAdventureLoot);
  const sendLootToPartyVault = useAdventureStore((state) => state.sendLootToPartyVault);

  // Modal dual-targeting: 'roster' (live game Encounter Roster) vs 'adventure' (pre-staged adventure)
  const [monsterManagerTarget, setMonsterManagerTarget] = useState<'roster' | 'adventure'>('roster');
  const handleOpenMonsterManager = (target: 'roster' | 'adventure') => {
    setMonsterManagerTarget(target);
    setIsMonsterManagerOpen(true);
  };

  useEffect(() => {
    if (currentEmail) {
      fetchAdventures(currentEmail);
    }
  }, [currentEmail, fetchAdventures]);

  // Deploy / Push to Players state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  // Encounter View Mode: 'tree' (Act-Wide Encounter Tree) vs 'focus' (Room Focus Deck)
  const [encounterViewMode, setEncounterViewMode] = useState<'tree' | 'focus'>('tree');
  const [isNotesPoppedOut, setIsNotesPoppedOut] = useState(false);
  const notesDockRef = useRef<HTMLDivElement>(null);
  const [floatingNotesBounds, setFloatingNotesBounds] = useState<FloatingWindowBounds | null>(null);

  const handlePopOutNotes = () => {
    if (notesDockRef.current) {
      const rect = notesDockRef.current.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 100) {
        setFloatingNotesBounds({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    setIsNotesPoppedOut(true);
  };

  // Encounter sequential navigation within the active act
  const actEncounters = useMemo(() => activeAct?.encounters || [], [activeAct]);
  const currentEncounterIndex = useMemo(
    () => actEncounters.findIndex((e) => e.id === activeEncounter?.id),
    [actEncounters, activeEncounter]
  );
  const hasPrevEncounter = currentEncounterIndex > 0;
  const hasNextEncounter = currentEncounterIndex >= 0 && currentEncounterIndex < actEncounters.length - 1;
  const prevEncounter = hasPrevEncounter ? actEncounters[currentEncounterIndex - 1] : null;
  const nextEncounter = hasNextEncounter ? actEncounters[currentEncounterIndex + 1] : null;

  const handlePrevEncounter = () => {
    if (prevEncounter) {
      selectEncounter(prevEncounter.id);
    }
  };

  const handleNextEncounter = () => {
    if (nextEncounter) {
      selectEncounter(nextEncounter.id);
    }
  };

  // Inline Monster Edit State for Adventure Encounters (3-row layout)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEncounterId, setEditingEncounterId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editGearText, setEditGearText] = useState('');
  const [editAbilitiesText, setEditAbilitiesText] = useState('');
  const [editDif, setEditDif] = useState(10);
  const [editBaseText, setEditBaseText] = useState('');
  const [editMinionVit, setEditMinionVit] = useState<number | undefined>(undefined);

  // Effective monsters list displayed in the GM Monster Tracker strictly mirrors the active encounter
  const effectiveMonsters = activeMonsters;

  // Re-sync Monster Preset when selected party changes
  const handleSaveMonsters = (updated: ParsedMonster[]) => {
    const sorted = [...updated].sort((a, b) => {
      const nameA = (a.nameWithEquip || a.fullText || '').replace(/^[🚩👣⚔️⚔🛡️🧥❤️\:\–\-\s]+/, '').toLowerCase();
      const nameB = (b.nameWithEquip || b.fullText || '').replace(/^[🚩👣⚔️⚔🛡️🧥❤️\:\–\-\s]+/, '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    setEncounterMonsters(sorted);
  };

  const handleStartEdit = (m: ParsedMonster, encounterId?: string) => {
    setEditingEncounterId(encounterId || activeEncounter?.id || null);
    setEditingId(m.id);
    const raw = m.fullText || m.nameWithEquip || '';
    const decomposed = decomposeMonsterStatblock(raw);
    let gear = decomposed.gear || m.gear || '';
    let abilities = decomposed.abilities || m.abilities || m.codex_notes || '';

    // Auto-resolve from Supabase Codex if matching by name and missing
    const cleanMonsterName = (m.name || m.nameWithEquip || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim().toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => (sm.name || '').replace(/\s*\([^)]*\)/g, '').toLowerCase().trim() === cleanMonsterName
    );
    if (codexMatch) {
      if (!gear) gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ');
      if (!abilities) abilities = codexMatch.abilities || codexMatch.notes || '';
    }

    const currentStatline = decomposed.statline || raw;
    const baseStatline = m.baseFullText
      ? (decomposeMonsterStatblock(m.baseFullText).statline || m.baseFullText)
      : currentStatline;

    setEditText(currentStatline);
    setEditBaseText(baseStatline);
    setEditDif(m.scaled_dif || 10);
    setEditGearText(gear);
    setEditAbilitiesText(abilities);
    setEditMinionVit(m.minion_vit);
  };

  const handleEncounterMonsterThreatChange = (newDif: number) => {
    setEditDif(newDif);
    if (!editBaseText.trim()) return;
    if (newDif === 10) {
      setEditText(editBaseText);
    } else {
      const scaledLine = scaleStatlineText(editBaseText, newDif);
      setEditText(scaledLine);
    }
  };

  const handleSaveEdit = (encounterId: string, monsterId: string) => {
    if (!editText.trim()) return;
    const gearPart = editGearText.trim() ? ` (${editGearText.trim()})` : '';
    const abilitiesPart = editAbilitiesText.trim() ? ` (${editAbilitiesText.trim()})` : '';

    const iconPosMatch = editText.match(/[🚩👣🥊⚔️⚔🛡️🧥🥋❤️💔]/u);
    let reconstructed = '';
    if (iconPosMatch && iconPosMatch.index !== undefined) {
      const namePart = editText.substring(0, iconPosMatch.index).trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
      const statsPart = editText.substring(iconPosMatch.index).trim();
      reconstructed = `${namePart}${gearPart} ${statsPart}${abilitiesPart}`.trim();
    } else {
      reconstructed = `${editText.trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()}${gearPart}${abilitiesPart}`.trim();
    }

    const parsed = parseMonsterLine(reconstructed);
    parsed.gear = editGearText.trim() || undefined;
    parsed.abilities = editAbilitiesText.trim() || undefined;
    parsed.scaled_dif = editDif;
    parsed.baseFullText = editBaseText;

    if (typeof editMinionVit === 'number') {
      parsed.minion_vit = editMinionVit;
      parsed.vitalityStat = `💔${editMinionVit}`;
      if (parsed.fullText) {
        parsed.fullText = parsed.fullText.replace(/(?:❤️|💔)\s*\d+/, `💔${editMinionVit}`);
      }
    } else {
      parsed.minion_vit = undefined;
    }

    if (encounterId === activeEncounter?.id) {
      const updated = effectiveMonsters.map((m) =>
        m.id === monsterId ? { ...parsed, id: monsterId, baseFullText: editBaseText, scaled_dif: editDif } : m
      );
      handleSaveMonsters(updated);
    } else if (activeAdventure && activeAct) {
      const targetEnc = activeAct.encounters?.find((e) => e.id === encounterId);
      if (targetEnc) {
        const updated = (targetEnc.monsters || []).map((m) =>
          m.id === monsterId ? { ...parsed, id: monsterId, baseFullText: editBaseText, scaled_dif: editDif } : m
        );
        updateEncounter(activeAdventure.id, activeAct.id, encounterId, { monsters: updated });
      }
    }
    setEditingId(null);
    setEditingEncounterId(null);
  };

  const handleSetEncounterMonsterMinionVit = (
    encounterId: string,
    monsterId: string | number,
    minionVit: number | undefined
  ) => {
    const updateMonsterMinion = (m: ParsedMonster): ParsedMonster => {
      const updated = { ...m };
      if (typeof minionVit === 'number') {
        const hpNums = (m.vitalityStat || '').match(/\d+/);
        if (!updated.base_vit && hpNums) {
          updated.base_vit = parseInt(hpNums[0], 10);
        }
        updated.minion_vit = minionVit;
        updated.vitalityStat = `💔${minionVit}`;
        if (updated.fullText) {
          updated.fullText = updated.fullText.replace(/(?:❤️|💔)\s*\d+/, `💔${minionVit}`);
        }
      } else {
        const restoredVit = updated.base_vit || 10;
        updated.minion_vit = undefined;
        const scaledVit = updated.scaled_dif && updated.scaled_dif !== 10
          ? scaleStatByAnchor('max_vit', restoredVit, updated.scaled_dif)
          : restoredVit;
        updated.vitalityStat = `❤️${scaledVit}`;
        if (updated.fullText) {
          updated.fullText = updated.fullText.replace(/(?:❤️|💔)\s*\d+/, `❤️${scaledVit}`);
        }
      }
      return updated;
    };

    if (encounterId === activeEncounter?.id) {
      const updated = effectiveMonsters.map((m) =>
        m.id === monsterId ? updateMonsterMinion(m) : m
      );
      handleSaveMonsters(updated);
    } else if (activeAdventure && activeAct) {
      const targetEnc = activeAct.encounters?.find((e) => e.id === encounterId);
      if (targetEnc) {
        const updated = (targetEnc.monsters || []).map((m) =>
          m.id === monsterId ? updateMonsterMinion(m) : m
        );
        updateEncounter(activeAdventure.id, activeAct.id, encounterId, { monsters: updated });
      }
    }
  };

  const handleDeleteEncounterMonster = (encounterId: string, monsterId: string) => {
    if (encounterId === activeEncounter?.id) {
      handleSaveMonsters(effectiveMonsters.filter((m) => m.id !== monsterId));
    } else if (activeAdventure && activeAct) {
      const targetEnc = activeAct.encounters?.find((e) => e.id === encounterId);
      if (targetEnc) {
        const updated = (targetEnc.monsters || []).filter((m) => m.id !== monsterId);
        updateEncounter(activeAdventure.id, activeAct.id, encounterId, { monsters: updated });
      }
    }
  };

  // Pushed Monsters for GM Screen Encounter Roster
  const partyIdOrDef = selectedParty?.id || 'default';
  const gmPushedMonstersKey = `supaflex_gm_pushed_monsters_${partyIdOrDef}`;
  const [pushedMonsters, setPushedMonsters] = useState<GmRosterMonster[]>(() => {
    try {
      const saved = localStorage.getItem(gmPushedMonstersKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const healed = sanitizeRosterMonsters(parsed, undefined, parseMonsterForGmRoster);
          if (healed.didHeal) {
            localStorage.setItem(gmPushedMonstersKey, JSON.stringify(healed.monsters));
          }
          return healed.monsters;
        }
      }
    } catch {}
    return [];
  });

  // Re-sync pushed monsters when selectedParty changes
  useEffect(() => {
    if (!selectedParty?.id) return;
    try {
      const partyKey = `supaflex_gm_pushed_monsters_${selectedParty.id}`;
      const savedMons = localStorage.getItem(partyKey);
      if (savedMons) {
        const parsed = JSON.parse(savedMons);
        if (Array.isArray(parsed)) {
          const healed = sanitizeRosterMonsters(parsed, supabaseMonsters, parseMonsterForGmRoster);
          if (healed.didHeal) {
            localStorage.setItem(partyKey, JSON.stringify(healed.monsters));
          }
          setPushedMonsters(healed.monsters);
          return;
        }
      }
      setPushedMonsters([]);
    } catch {}
  }, [selectedParty?.id, supabaseMonsters]);

  // Self-healing sweep once Supabase monsters codex is loaded
  useEffect(() => {
    if (pushedMonsters.length > 0 && supabaseMonsters.length > 0) {
      const healed = sanitizeRosterMonsters(pushedMonsters, supabaseMonsters, parseMonsterForGmRoster);
      if (healed.didHeal) {
        setPushedMonsters(healed.monsters);
        try {
          localStorage.setItem(gmPushedMonstersKey, JSON.stringify(healed.monsters));
        } catch {}
      }
    }
  }, [supabaseMonsters]);

  // Turn Marked IDs (diagonal slash for turn tracking)
  const [markedTurnIds, setMarkedTurnIds] = useState<string[]>([]);
  const markedTurnIdsRef = useRef<string[]>([]);
  markedTurnIdsRef.current = markedTurnIds;
  const broadcastChannelRef = useRef<any>(null);

  const broadcastTurnMarks = (newMarks: string[]) => {
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'party_turn_marks_updated',
        payload: { markedTurnIds: newMarks },
      });
    } else if (selectedParty?.id) {
      const ch = supabase.channel(`party:${selectedParty.id}`);
      ch.send({
        type: 'broadcast',
        event: 'party_turn_marks_updated',
        payload: { markedTurnIds: newMarks },
      });
    }
  };

  const toggleTurnMark = (id: string) => {
    setMarkedTurnIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      broadcastTurnMarks(next);
      return next;
    });
  };

  const handleResetTurnMarks = () => {
    setMarkedTurnIds([]);
    broadcastTurnMarks([]);
  };

  const handleDismissRosterMonster = (monsterId: string) => {
    setPushedMonsters((prev) => {
      const next = prev.filter((m) => m.id !== monsterId);
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearRosterMonsters = () => {
    setPushedMonsters([]);
    try {
      localStorage.setItem(gmPushedMonstersKey, JSON.stringify([]));
    } catch {}
  };

  // Live Inline Editing for Encounter Roster Monsters (3-row layout)
  const [editingRosterMonsterId, setEditingRosterMonsterId] = useState<string | null>(null);
  const [rosterMonsterEditText, setRosterMonsterEditText] = useState('');
  const [rosterMonsterEditGear, setRosterMonsterEditGear] = useState('');
  const [rosterMonsterEditAbilities, setRosterMonsterEditAbilities] = useState('');
  const [rosterMonsterEditDif, setRosterMonsterEditDif] = useState(10);
  const [rosterMonsterEditBaseText, setRosterMonsterEditBaseText] = useState('');
  const [rosterMonsterEditMinionVit, setRosterMonsterEditMinionVit] = useState<number | undefined>(undefined);

  const handleStartRosterMonsterEdit = (monster: GmRosterMonster) => {
    setEditingRosterMonsterId(monster.id);
    const cleanMonName = (monster.name || 'Monster').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
    const raw = monster.fullText || `${cleanMonName}${monster.gear ? ` (${monster.gear})` : ''} 🚩${monster.nish} ${monster.coreStatsText}${monster.abilities ? ` (${monster.abilities})` : ''}`;
    const decomposed = decomposeMonsterStatblock(raw);
    let gear = decomposed.gear || monster.gear || '';
    let abilities = decomposed.abilities || monster.abilities || monster.gm_notes || '';

    // Codex fallback if missing
    const cleanName = cleanMonName.toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => (sm.name || '').replace(/\s*\([^)]*\)/g, '').toLowerCase().trim() === cleanName
    );
    if (codexMatch) {
      if (!gear) gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ');
      if (!abilities) abilities = codexMatch.abilities || codexMatch.notes || '';
    }

    const currentStatline = decomposed.statline || raw;
    const baseStatline = monster.baseFullText
      ? (decomposeMonsterStatblock(monster.baseFullText).statline || monster.baseFullText)
      : currentStatline;

    setRosterMonsterEditText(currentStatline);
    setRosterMonsterEditBaseText(baseStatline);
    setRosterMonsterEditDif(monster.scaled_dif || 10);
    setRosterMonsterEditGear(gear);
    setRosterMonsterEditAbilities(abilities);
    setRosterMonsterEditMinionVit(monster.minion_vit);
  };

  const handleRosterMonsterThreatChange = (newDif: number) => {
    setRosterMonsterEditDif(newDif);
    if (!rosterMonsterEditBaseText.trim()) return;
    if (newDif === 10) {
      setRosterMonsterEditText(rosterMonsterEditBaseText);
    } else {
      const scaledLine = scaleStatlineText(rosterMonsterEditBaseText, newDif);
      setRosterMonsterEditText(scaledLine);
    }
  };

  const handleSaveRosterMonsterEdit = (monsterId: string) => {
    if (!rosterMonsterEditText.trim()) return;
    const gearPart = rosterMonsterEditGear.trim() ? ` (${rosterMonsterEditGear.trim()})` : '';
    const abilitiesPart = rosterMonsterEditAbilities.trim() ? ` (${rosterMonsterEditAbilities.trim()})` : '';

    const iconPosMatch = rosterMonsterEditText.match(/[🚩👣🥊⚔️⚔🛡️🧥🥋❤️💔]/u);
    let reconstructed = '';
    if (iconPosMatch && iconPosMatch.index !== undefined) {
      const namePart = rosterMonsterEditText.substring(0, iconPosMatch.index).trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim();
      const statsPart = rosterMonsterEditText.substring(iconPosMatch.index).trim();
      reconstructed = `${namePart}${gearPart} ${statsPart}${abilitiesPart}`.trim();
    } else {
      reconstructed = `${rosterMonsterEditText.trim().replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()}${gearPart}${abilitiesPart}`.trim();
    }

    const parsed = parseMonsterForGmRoster(reconstructed, monsterId, monsterId);
    parsed.gear = rosterMonsterEditGear.trim() || undefined;
    parsed.abilities = rosterMonsterEditAbilities.trim() || undefined;
    parsed.scaled_dif = rosterMonsterEditDif;
    parsed.baseFullText = rosterMonsterEditBaseText;

    if (typeof rosterMonsterEditMinionVit === 'number') {
      parsed.minion_vit = rosterMonsterEditMinionVit;
      parsed.max_vit = rosterMonsterEditMinionVit;
      parsed.coreStatsText = parsed.coreStatsText.replace(/(?:❤️|💔)\s*\d+/, `💔${rosterMonsterEditMinionVit}`);
      parsed.fullText = parsed.fullText.replace(/(?:❤️|💔)\s*\d+/, `💔${rosterMonsterEditMinionVit}`);
    } else {
      parsed.minion_vit = undefined;
    }

    setPushedMonsters((prev) => {
      const next = prev.map((m) => (m.id === monsterId ? { ...parsed, id: monsterId, baseFullText: rosterMonsterEditBaseText, scaled_dif: rosterMonsterEditDif } : m));
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    setEditingRosterMonsterId(null);
  };

  const handleSetRosterMonsterMinionVit = (monsterId: string | number, minionVit: number | undefined) => {
    setPushedMonsters((prev) => {
      const next = prev.map((m) => {
        if (m.id !== monsterId) return m;
        const updated = { ...m };
        if (typeof minionVit === 'number') {
          if (!updated.base_vit && updated.max_vit) {
            updated.base_vit = updated.max_vit;
          }
          updated.minion_vit = minionVit;
          updated.max_vit = minionVit;
          updated.coreStatsText = updated.coreStatsText.replace(/(?:❤️|💔)\s*\d+/, `💔${minionVit}`);
          updated.fullText = updated.fullText.replace(/(?:❤️|💔)\s*\d+/, `💔${minionVit}`);
        } else {
          const restoredVit = updated.base_vit || 10;
          updated.minion_vit = undefined;
          const scaledVit = updated.scaled_dif && updated.scaled_dif !== 10
            ? scaleStatByAnchor('max_vit', restoredVit, updated.scaled_dif)
            : restoredVit;
          updated.max_vit = scaledVit;
          updated.coreStatsText = updated.coreStatsText.replace(/(?:❤️|💔)\s*\d+/, `❤️${scaledVit}`);
          updated.fullText = updated.fullText.replace(/(?:❤️|💔)\s*\d+/, `❤️${scaledVit}`);
        }
        return updated;
      });
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Add monster directly to live Encounter Roster (via ⬅️ on adventure monster cards)
  const handleAddMonsterToRoster = (m: ParsedMonster | MonsterData) => {
    const rawText = (m as any).fullText || (m as any).nameWithEquip || formatMonsterDataToStatblock(m as any);
    const cleanName = ((m as any).name || (m as any).nameWithEquip || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => sm.name?.toLowerCase().trim() === cleanName
    );
    let gear = (m as any).gear || (m as any).equipment;
    let abilities = (m as any).abilities || (m as any).gm_notes;
    if (codexMatch) {
      if (!gear) gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ');
      if (!abilities) abilities = codexMatch.abilities || codexMatch.notes;
    }
    const newRosterMonster = parseMonsterForGmRoster(rawText, `gm_mon_${Date.now()}_`);
    if (!newRosterMonster.gear && gear) newRosterMonster.gear = gear;
    if (!newRosterMonster.abilities && abilities) {
      newRosterMonster.abilities = abilities;
      newRosterMonster.gm_notes = abilities;
    }
    setPushedMonsters((prev) => {
      const next = [...prev, newRosterMonster];
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Add all monsters in an encounter directly to live Encounter Roster
  const handleAddAllMonstersToRoster = (enc: any) => {
    const monsters = enc?.monsters || [];
    if (monsters.length === 0) return;
    const newRosterMonsters = monsters.map((m: any, idx: number) => {
      const rawText = m.fullText || m.nameWithEquip || formatMonsterDataToStatblock(m);
      const mon = parseMonsterForGmRoster(
        rawText,
        'gm_mon_',
        `gm_mon_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`
      );
      const cleanName = (m.name || m.nameWithEquip || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const codexMatch = supabaseMonsters.find(
        (sm) => sm.name?.toLowerCase().trim() === cleanName
      );
      let gear = m.gear || m.equipment;
      let abilities = m.abilities || m.gm_notes;
      if (codexMatch) {
        if (!gear) gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ');
        if (!abilities) abilities = codexMatch.abilities || codexMatch.notes;
      }
      if (!mon.gear && gear) mon.gear = gear;
      if (!mon.abilities && abilities) {
        mon.abilities = abilities;
        mon.gm_notes = abilities;
      }
      return mon;
    });
    setPushedMonsters((prev) => {
      const next = [...prev, ...newRosterMonsters];
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Convert pushedMonsters to ParsedMonster[] format for MonsterManagerModal
  const rosterMonstersAsParsed: ParsedMonster[] = useMemo(() => {
    return pushedMonsters.map((m) => {
      const parsed = parseMonsterLine(
        m.fullText || `${m.name}${m.gear ? ` (${m.gear})` : ''} 🚩${m.nish} ${m.coreStatsText}${m.abilities ? ` (${m.abilities})` : ''}`
      );
      return {
        ...parsed,
        id: m.id,
        baseFullText: m.baseFullText || parsed.baseFullText || m.fullText,
        scaled_dif: m.scaled_dif ?? 10,
        gear: m.gear || parsed.gear,
        abilities: m.abilities || parsed.abilities || m.gm_notes,
      };
    });
  }, [pushedMonsters]);

  const handleSaveRosterMonstersFromModal = (updated: ParsedMonster[]) => {
    const newRoster: GmRosterMonster[] = updated.map((p) => {
      const mon = parseMonsterForGmRoster(
        p.fullText || p.nameWithEquip || '',
        p.id,
        p.id,
        p.baseFullText,
        p.scaled_dif
      );
      if (p.gear && !mon.gear) mon.gear = p.gear;
      if (p.abilities && !mon.abilities) {
        mon.abilities = p.abilities;
        mon.gm_notes = p.abilities;
      }
      return mon;
    });
    setPushedMonsters(newRoster);
    try {
      localStorage.setItem(gmPushedMonstersKey, JSON.stringify(newRoster));
    } catch {}
  };

  // Push exclusively what is currently in 👥&🐉 Encounter Roster to players' Monster Tracker HUD
  const handlePushToPlayers = async () => {
    if (!selectedParty?.id) return;
    setIsDeploying(true);
    try {
      const monstersToPush = pushedMonsters.map((mon) => ({
        id: mon.id,
        name: mon.name,
        initiative: mon.nish,
        mr: mon.mr ?? 10,
        attack: mon.attack ?? 10,
        damage: mon.damage ?? 5,
        defense: mon.defense ?? 10,
        armor: mon.armor ?? 0,
        max_vit: mon.max_vit ?? 10,
        current_vit: mon.max_vit ?? 10,
        attributes: mon.attributes ?? { magic: 10, might: 10, mind: 10, motion: 10, moxie: 10 },
        equipment: mon.gear,
        gear: mon.gear,
        abilities: mon.abilities,
        gm_notes: mon.abilities || mon.gm_notes,
        fullText: mon.fullText || `${mon.name}${mon.gear ? ` (${mon.gear})` : ''} 🚩${mon.nish} ${mon.coreStatsText}${mon.abilities ? ` (${mon.abilities})` : ''}`,
      }));

      await gameApi.savePartyMonsters(selectedParty.id, monstersToPush);

      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to push monsters to party:', err);
    } finally {
      setIsDeploying(false);
    }
  };

  // Party Session Roster State
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  // Combined Party Members + Pushed Monsters Roster
  const combinedRosterItems = useMemo<GmUnifiedRosterItem[]>(() => {
    const members: GmUnifiedRosterItem[] = sessionMembers.map((m) => ({
      type: 'member',
      id: String(m.character_id || m.id),
      member: m,
    }));
    const monsters: GmUnifiedRosterItem[] = pushedMonsters.map((mon) => ({
      type: 'monster',
      id: mon.id,
      monster: mon,
    }));
    return [...members, ...monsters];
  }, [sessionMembers, pushedMonsters]);

  // Always sorted: Nish order (descending) as primary, alphabetically (A-Z) within Nish ties
  const orderedSessionMembers = useMemo<GmUnifiedRosterItem[]>(() => {
    return [...combinedRosterItems].sort((a, b) => {
      // 1. Primary: Nish descending
      const nishA =
        a.type === 'member'
          ? (a.member.character?.sheet_data?.current_nish ??
            (a.member.character as any)?.current_nish ??
            (a.member.character as any)?.initiative ??
            10)
          : (a.monster.nish ?? 10);
      const nishB =
        b.type === 'member'
          ? (b.member.character?.sheet_data?.current_nish ??
            (b.member.character as any)?.current_nish ??
            (b.member.character as any)?.initiative ??
            10)
          : (b.monster.nish ?? 10);

      const numNishA = typeof nishA === 'number' ? nishA : parseInt(String(nishA || 0), 10) || 0;
      const numNishB = typeof nishB === 'number' ? nishB : parseInt(String(nishB || 0), 10) || 0;

      if (numNishB !== numNishA) {
        return numNishB - numNishA;
      }

      // 2. Secondary: Alphabetical (A-Z) by first name / monster clean name
      const nameA =
        a.type === 'member'
          ? resolveCharFirstName(a.member.character?.name || `Hero #${a.member.character_id}`)
          : a.monster.name;
      const nameB =
        b.type === 'member'
          ? resolveCharFirstName(b.member.character?.name || `Hero #${b.member.character_id}`)
          : b.monster.name;

      const nameDiff = nameA.localeCompare(nameB);
      if (nameDiff !== 0) return nameDiff;

      // 3. Deterministic tiebreaker: ID
      return a.id.localeCompare(b.id);
    });
  }, [combinedRosterItems]);

  // Load GM Parties on Mount
  useEffect(() => {
    loadParties();
  }, [currentEmail]);

  const loadParties = async () => {
    const effectiveEmail = (currentEmail || 'gm-guest@supaflex.internal').trim().toLowerCase();
    try {
      const data = await gameApi.getPartiesForUser(effectiveEmail);
      let gmParties = (data as Party[]).filter(
        (p) => (p.gm_email || '').toLowerCase() === effectiveEmail
      );
      if (gmParties.length === 0) {
        const created = await gameApi.createParty('GM Screen Party', effectiveEmail, []);
        gmParties = [created as Party];
      }
      const currentPartyMatches =
        selectedParty && (selectedParty.gm_email || '').toLowerCase() === effectiveEmail;

      if (!currentPartyMatches) {
        const matchingPropParty =
          propActiveParty && (propActiveParty.gm_email || '').toLowerCase() === effectiveEmail
            ? propActiveParty
            : null;
        const target = matchingPropParty || gmParties[0];
        setSelectedParty(target);
        if (onSelectActiveParty && target) onSelectActiveParty(target);
      }
    } catch (e) {
      console.error('Failed to load GM parties:', e);
    }
  };

  // Sync prop activeParty changes strictly when owned by current GM email
  useEffect(() => {
    if (propActiveParty) {
      const effectiveEmail = (currentEmail || '').trim().toLowerCase();
      if (!effectiveEmail || (propActiveParty.gm_email || '').toLowerCase() === effectiveEmail) {
        setSelectedParty(propActiveParty);
      }
    }
  }, [propActiveParty, currentEmail]);

  // Room Code Checkout & Heartbeat Lifecycle
  useEffect(() => {
    if (!selectedParty?.id) return;

    let heartbeatInterval: any = null;

    const initRoom = async () => {
      try {
        const { roomCode, isNewSession } = await gameApi.checkoutPartyRoomCode(selectedParty.id);
        if (onRoomCodeReady) onRoomCodeReady(roomCode);
        if (isNewSession) {
          setSessionMembers([]);
        }
      } catch (err) {
        console.error('Failed to checkout room code:', err);
        const fallback = selectedParty.room_code || selectedParty.party_code;
        if (fallback && onRoomCodeReady) {
          onRoomCodeReady(fallback);
        }
      }

      heartbeatInterval = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        gameApi.sendGmHeartbeat(selectedParty.id).catch(console.error);
      }, 30000);
    };

    initRoom();

    const handleBeforeUnload = () => {
      gameApi.closePartyRoomBeacon(selectedParty.id);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // NOTE: Do not close party room on component unmount; closures occur strictly on beforeunload or explicit GM action
    };
  }, [selectedParty?.id]);

  // Load Session Members on Selected Party Change & Subscribe to Realtime Updates
  useEffect(() => {
    if (!selectedParty?.id) return;
    const partyId = selectedParty.id;

    loadSessionMembers(partyId, false);

    // 1. Postgres CDC channel strictly for new players and leaves (ignoring heartbeat UPDATEs)
    const cdcChannel = supabase.channel(`gm_roster_cdc_${partyId}`);
    cdcChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_session_members',
        },
        () => {
          loadSessionMembers(partyId, true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'party_session_members',
        },
        () => {
          loadSessionMembers(partyId, true);
        }
      )
      .subscribe();

    // 2. Broadcast channel for instantaneous player arrival, vitals updates, and turn mark sync
    const broadcastChannel = supabase.channel(`party:${partyId}`);
    broadcastChannelRef.current = broadcastChannel;
    broadcastChannel
      .on('broadcast', { event: 'party_members_updated' }, (payload: any) => {
        // Instant optimistic vitals & nish update (< 50ms peer-to-peer sync, zero extra REST egress)
        const data = payload?.payload;
        if (data?.character_id && (data.current_vitality !== undefined || data.hp !== undefined || data.current_nish !== undefined)) {
          const charId = Number(data.character_id);
          const newCurrentVit = data.current_vitality ?? data.hp;
          const newMaxVit = data.vitality_max;
          const newNish = data.current_nish;
          setSessionMembers((prev) =>
            prev.map((m) => {
              if (Number(m.character_id) === charId && m.character) {
                const updatedSheet = {
                  ...(m.character.sheet_data || {}),
                  ...(newCurrentVit !== undefined ? { current_vitality: newCurrentVit } : {}),
                  ...(newMaxVit !== undefined ? { vitality_max: newMaxVit } : {}),
                  ...(newNish !== undefined ? { current_nish: newNish } : {}),
                };
                if (newNish === null) {
                  delete updatedSheet.current_nish;
                }
                const updatedChar = {
                  ...m.character,
                  ...(newCurrentVit !== undefined ? { hp: newCurrentVit, current_vitality: newCurrentVit } : {}),
                  ...(newMaxVit !== undefined ? { vitality_max: newMaxVit } : {}),
                  current_nish: newNish === null ? undefined : newNish ?? (m.character as any)?.current_nish,
                  sheet_data: updatedSheet,
                };
                return { ...m, character: updatedChar as any };
              }
              return m;
            })
          );
        } else {
          loadSessionMembers(partyId, true);
        }
      })
      .on('broadcast', { event: 'request_turn_marks' }, () => {
        broadcastTurnMarks(markedTurnIdsRef.current);
      })
      .on('broadcast', { event: 'party.joined' }, () => {
        loadSessionMembers(partyId, true);
        broadcastTurnMarks(markedTurnIdsRef.current);
      })
      .on('broadcast', { event: 'party.left' }, () => {
        loadSessionMembers(partyId, true);
      })
      .on('broadcast', { event: 'party.disbanded' }, () => {
        setSessionMembers([]);
      })
      .on('broadcast', { event: 'party.closed' }, () => {
        setSessionMembers([]);
      })
      .subscribe();

    // 3. Periodic polling fallback every 60 seconds (paused when tab hidden)
    const pollInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        loadSessionMembers(partyId, true);
      }
    }, 60000);

    return () => {
      broadcastChannelRef.current = null;
      supabase.removeChannel(cdcChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(pollInterval);
    };
  }, [selectedParty?.id]);

  const areGmMembersEqual = (a: PartySessionMember[], b: PartySessionMember[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const ma = a[i];
      const mb = b[i];
      if (ma.id !== mb.id || ma.character_id !== mb.character_id) return false;
      if (ma.player_first_name !== mb.player_first_name || ma.player_email !== mb.player_email) return false;
      const vitA = ma.character?.sheet_data?.current_vitality ?? ma.character?.hp;
      const vitB = mb.character?.sheet_data?.current_vitality ?? mb.character?.hp;
      if (vitA !== vitB) return false;
      const maxVitA = ma.character?.sheet_data?.vitality_max;
      const maxVitB = mb.character?.sheet_data?.vitality_max;
      if (maxVitA !== maxVitB) return false;
      const nishA = ma.character?.sheet_data?.current_nish ?? (ma.character as any)?.current_nish;
      const nishB = mb.character?.sheet_data?.current_nish ?? (mb.character as any)?.current_nish;
      if (nishA !== nishB) return false;
      if (ma.character?.name !== mb.character?.name) return false;
    }
    return true;
  };

  const loadSessionMembers = async (partyId: string, isSilent = false) => {
    if (!isSilent) setIsMembersLoading(true);
    try {
      const data = await gameApi.getPartySessionMembers(partyId);
      const newMembers = (data || []) as PartySessionMember[];
      setSessionMembers((prev) => (areGmMembersEqual(prev, newMembers) ? prev : newMembers));
    } catch (e) {
      console.error('Failed to load party members:', e);
    } finally {
      if (!isSilent) setIsMembersLoading(false);
    }
  };

  const handleDismissMember = async (member: PartySessionMember) => {
    if (!selectedParty?.id || !member.character_id) return;
    const charName = resolveCharFirstName(member.character?.name || `Hero #${member.character_id}`);
    const confirmed = window.confirm(`Remove "${charName}" from the live party?`);
    if (!confirmed) return;
    try {
      await gameApi.dismissPartyMember(selectedParty.id, member.character_id);
      setSessionMembers((prev) => prev.filter((m) => m.character_id !== member.character_id));
    } catch (err) {
      console.error('Failed to dismiss member:', err);
    }
  };

  const mapToMonsterData = (m: ParsedMonster): MonsterData => {
    const raw = m.fullText || m.nameWithEquip || 'Monster';
    const parsed = parseMonsterLine(raw);

    const initMatch = raw.match(/🚩\s*(\d+)/u);
    const mrMatch = raw.match(/👣\s*(\d+)/u);
    const atkNums = parsed.attackStat.match(/\d+/g) || [];
    const defNums = parsed.defenseStat.match(/\d+/g) || [];
    const hpNums = parsed.vitalityStat.match(/\d+/g) || [];
    const attrMatch = raw.match(/\[✨\s*(\d+)\s*\/\s*💪\s*(\d+)\s*\/\s*👁️\s*(\d+)\s*\/\s*🏃\s*(\d+)\s*\/\s*(?:🫀|💖)\s*(\d+)\]/u);

    // Resolve gear and abilities
    let gear = m.gear || parsed.gear || undefined;
    let abilities = m.abilities || parsed.abilities || undefined;

    // Auto-resolve from Supabase Codex if matching by name
    const cleanMonsterName = (parsed.name || parsed.nameWithEquip || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => sm.name?.toLowerCase().trim() === cleanMonsterName
    );
    if (codexMatch) {
      if (!gear) {
        gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ') || undefined;
      }
      if (!abilities) {
        abilities = codexMatch.abilities || undefined;
      }
    }

    // Resolve notes ONLY from Supabase Codex
    const codexNotes = m.codex_notes || abilities || (codexMatch ? codexMatch.notes || codexMatch.abilities : undefined) || resolveCodexMonsterNotes(parsed.nameWithEquip, supabaseMonsters);

    const finalCleanName = (parsed.name || parsed.nameWithEquip || m.name || 'Monster')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .trim() || 'Monster';

    return {
      id: m.id,
      name: finalCleanName,
      equipment: gear,
      gear: gear,
      abilities: abilities,
      initiative: initMatch ? parseInt(initMatch[1], 10) : 10,
      mr: mrMatch ? parseInt(mrMatch[1], 10) : 10,
      attack: atkNums[0] ? parseInt(atkNums[0], 10) : 10,
      damage: atkNums[1] ? parseInt(atkNums[1], 10) : 10,
      min_wounds: atkNums[2] ? parseInt(atkNums[2], 10) : 1,
      defense: defNums[0] ? parseInt(defNums[0], 10) : 10,
      armor: defNums[1] ? parseInt(defNums[1], 10) : 0,
      max_vit: m.minion_vit ? m.minion_vit : (hpNums[0] ? parseInt(hpNums[0], 10) : 10),
      current_vit: m.minion_vit ? m.minion_vit : (hpNums[0] ? parseInt(hpNums[0], 10) : 10),
      minion_vit: m.minion_vit,
      base_vit: m.base_vit ?? (m.minion_vit ? undefined : (hpNums[0] ? parseInt(hpNums[0], 10) : 10)),
      attributes: attrMatch ? {
        magic: parseInt(attrMatch[1], 10),
        might: parseInt(attrMatch[2], 10),
        mind: parseInt(attrMatch[3], 10),
        motion: parseInt(attrMatch[4], 10),
        moxie: parseInt(attrMatch[5], 10),
      } : {
        magic: 10,
        might: 10,
        mind: 10,
        motion: 10,
        moxie: 10,
      },
      gm_notes: codexNotes,
      is_codex: !!codexNotes || m.is_codex,
    };
  };

  const mapRosterMonsterToCardData = (monster: GmRosterMonster): MonsterData => {
    let gear = monster.gear;
    let abilities = monster.abilities;

    // Codex fallback if missing
    const cleanName = monster.name.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const codexMatch = supabaseMonsters.find(
      (sm) => sm.name?.toLowerCase().trim() === cleanName
    );
    if (codexMatch) {
      if (!gear) gear = [codexMatch.weapons, codexMatch.armor].filter(Boolean).join(', ') || undefined;
      if (!abilities) abilities = codexMatch.abilities || undefined;
    }

    const codexNotes = monster.gm_notes || abilities || (codexMatch ? codexMatch.notes || codexMatch.abilities : undefined) || resolveCodexMonsterNotes(monster.name, supabaseMonsters);

    const finalCleanName = (monster.name || 'Monster')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .trim() || 'Monster';

    return {
      id: monster.id,
      name: finalCleanName,
      equipment: gear,
      gear: gear,
      abilities: abilities,
      initiative: monster.nish,
      mr: monster.mr ?? 10,
      attack: monster.attack ?? 10,
      damage: monster.damage ?? 5,
      min_wounds: monster.wounds ? (parseInt(monster.wounds.replace(/\D/g, ''), 10) || 1) : 1,
      defense: monster.defense ?? 10,
      armor: monster.armor ?? 0,
      max_vit: monster.minion_vit ? monster.minion_vit : (monster.max_vit ?? 10),
      current_vit: monster.minion_vit ? monster.minion_vit : (monster.max_vit ?? 10),
      minion_vit: monster.minion_vit,
      base_vit: monster.base_vit ?? (monster.minion_vit ? undefined : (monster.max_vit ?? 10)),
      attributes: monster.attributes ?? { magic: 10, might: 10, mind: 10, motion: 10, moxie: 10 },
      gm_notes: codexNotes,
      is_codex: !!codexNotes,
    };
  };

  const renderMonsterRow = (m: any, encId: string) => {
    if (editingId === m.id && editingEncounterId === encId) {
      return (
        <div key={m.id} className="p-3 bg-slate-950 border border-rose-500/60 rounded-xl flex flex-col gap-2 font-mono w-full">
          {/* Row 1: Main Statline */}
          <input
            type="text"
            value={editText}
            onChange={(e) => {
              setEditText(e.target.value);
              setEditBaseText(e.target.value);
              setEditDif(10);
            }}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-rose-500"
            autoFocus
          />
          {/* Row 2: ⚔️🧥 Gear / Subtitle */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-amber-400 shrink-0 select-none">⚔️🧥:</span>
            <input
              type="text"
              value={editGearText}
              onChange={(e) => setEditGearText(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
            />
          </div>
          {/* Row 3: 🔥 Abilities / Special Notes */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-rose-400 shrink-0 select-none">🔥:</span>
            <input
              type="text"
              value={editAbilitiesText}
              onChange={(e) => setEditAbilitiesText(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-rose-500"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center gap-2">
              <GmThreatStepper
                value={editDif}
                onChange={handleEncounterMonsterThreatChange}
              />
              <GmMinionVitSelector
                variant="button"
                currentVit={editMinionVit ? editMinionVit : 10}
                baseVit={m.base_vit}
                minionVit={editMinionVit}
                onSelect={(newMinion) => setEditMinionVit(newMinion)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setEditingEncounterId(null);
                }}
                className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(encId, m.id)}
                className="px-3.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <GmMonsterCard
        key={m.id}
        monster={mapToMonsterData(m)}
        onAddToRoster={() => handleAddMonsterToRoster(m)}
        onEdit={() => handleStartEdit(m, encId)}
        onDelete={() => handleDeleteEncounterMonster(encId, m.id)}
        onSetMinionVit={(monId, newMinionVit) => handleSetEncounterMonsterMinionVit(encId, monId, newMinionVit)}
      />
    );
  };

  return (
    <div className="max-w-[2500px] mx-auto font-outfit lg:h-full lg:min-h-0 lg:flex lg:flex-col">
      {/* Main Grid: Party Roster (Left) vs Monster Roster (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:flex-1 lg:min-h-0">
        {/* Left Column: 👥&🐉 Encounter Roster (6 cols - 50/50 balanced layout) */}
        <div className="lg:col-span-6 flex flex-col lg:h-full lg:min-h-0">
          {/* Card 1: Encounter Roster */}
          <div className="bg-gradient-to-b from-sky-950/30 via-slate-900/90 to-slate-950/95 p-4 rounded-2xl border border-slate-800 border-t-2 border-t-sky-500/90 space-y-4 shadow-lg shadow-sky-950/20 flex flex-col lg:h-full lg:min-h-0">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-3 shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1.5 rounded-xl bg-sky-950/90 border border-sky-500/50 text-sky-300 flex items-center justify-center shadow-[0_0_12px_rgba(14,165,233,0.25)]">
                  <span className="text-base leading-none">👥&🐉</span>
                </div>
                <h3 className="text-xs font-extrabold text-sky-200 uppercase tracking-wider font-outfit">
                  Encounter Roster
                </h3>
                {/* 🔄 New Nish Round Reset Button */}
                <button
                  type="button"
                  onClick={handleResetTurnMarks}
                  className="px-2 py-1 bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 text-sky-300 hover:text-sky-100 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer ml-0.5"
                  title="Start new round: Clear all turn/nish marked-off slashes"
                >
                  <span>🔄</span>
                  <span>New Nish</span>
                </button>

                {/* Push 🐉s Button */}
                <button
                  type="button"
                  onClick={handlePushToPlayers}
                  disabled={isDeploying || !selectedParty?.id}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md cursor-pointer ml-1 ${
                    deploySuccess
                      ? 'bg-emerald-600 text-white border border-emerald-400/50'
                      : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border border-rose-400/40 shadow-rose-950/40'
                  }`}
                  title="Push current Encounter Roster monsters directly to players' Monster Tracker HUD"
                >
                  <span>{deploySuccess ? 'Pushed!' : 'Push 🐉s'}</span>
                </button>

              </div>

              {/* Right side of header: Remove 🐉s + Add 🐉 */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {/* Remove 🐉s Button */}
                <button
                  type="button"
                  onClick={handleClearRosterMonsters}
                  disabled={pushedMonsters.length === 0}
                  className="px-2.5 py-1 bg-slate-900/90 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Remove ALL monsters from the live Encounter Roster"
                >
                  <span>🗑️</span>
                  <span>Remove 🐉s</span>
                </button>

                {/* +🐉 Button */}
                <button
                  type="button"
                  onClick={() => handleOpenMonsterManager('roster')}
                  className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  title="Add monster directly into live Encounter Roster"
                >
                  <span>+🐉</span>
                </button>
              </div>
            </div>

            {!selectedParty ? (
              <div className="text-xs font-medium text-slate-400 italic p-6 bg-slate-950/70 rounded-xl border border-slate-800 text-center font-outfit">
                Initializing GM Screen...
              </div>
            ) : isMembersLoading ? (
              <div className="text-xs text-slate-400 italic text-center py-6 font-outfit">Loading party members...</div>
            ) : orderedSessionMembers.length === 0 ? (
              <div className="text-xs font-medium text-slate-400 italic p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-center space-y-1 font-outfit">
                <div>No players connected to "{selectedParty.name}" yet.</div>
                <div className="text-[10px] text-slate-500">
                  Invited emails: {selectedParty.invited_emails?.join(', ') || 'None'}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto lg:flex-1 lg:min-h-0 pr-1">
                {orderedSessionMembers.map((item) => {
                  if (item.type === 'member') {
                    const member = item.member;
                    const memberId = String(member.character_id || member.id);
                    const isMarked = markedTurnIds.includes(memberId);
                    return (
                      <div key={memberId} className="w-full max-w-[68%]">
                        <PartyCharacterCard
                          member={member}
                          isTurnMarked={isMarked}
                          onToggleTurnMark={() => toggleTurnMark(memberId)}
                          onDismiss={() => handleDismissMember(member)}
                        />
                      </div>
                    );
                  } else {
                    const monster = item.monster;
                    const isMarked = markedTurnIds.includes(monster.id);
                    return (
                      <div key={monster.id} className="w-full">
                        {editingRosterMonsterId === monster.id ? (
                          <div className="p-3 bg-slate-950 border border-rose-500/60 rounded-xl flex flex-col gap-2 font-mono w-full">
                            {/* Row 1: Main Statline */}
                            <input
                              type="text"
                              value={rosterMonsterEditText}
                              onChange={(e) => {
                                setRosterMonsterEditText(e.target.value);
                                setRosterMonsterEditBaseText(e.target.value);
                                setRosterMonsterEditDif(10);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-rose-500"
                              autoFocus
                            />
                            {/* Row 2: ⚔️🧥 Gear / Subtitle */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-400 shrink-0 select-none">⚔️🧥:</span>
                              <input
                                type="text"
                                value={rosterMonsterEditGear}
                                onChange={(e) => setRosterMonsterEditGear(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                              />
                            </div>
                            {/* Row 3: 🔥 Abilities / Special Notes */}
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-rose-400 shrink-0 select-none">🔥:</span>
                              <input
                                type="text"
                                value={rosterMonsterEditAbilities}
                                onChange={(e) => setRosterMonsterEditAbilities(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-rose-500"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                              <div className="flex items-center gap-2">
                                <GmThreatStepper
                                  value={rosterMonsterEditDif}
                                  onChange={handleRosterMonsterThreatChange}
                                />
                                <GmMinionVitSelector
                                  variant="button"
                                  currentVit={rosterMonsterEditMinionVit ? rosterMonsterEditMinionVit : (monster.max_vit ?? 10)}
                                  baseVit={monster.base_vit ?? (monster.minion_vit ? undefined : monster.max_vit)}
                                  minionVit={rosterMonsterEditMinionVit}
                                  onSelect={(newMinion) => setRosterMonsterEditMinionVit(newMinion)}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingRosterMonsterId(null)}
                                  className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveRosterMonsterEdit(monster.id)}
                                  className="px-3.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <GmMonsterCard
                            monster={mapRosterMonsterToCardData(monster)}
                            showDragonIcon
                            isTurnMarked={isMarked}
                            onToggleTurnMark={() => toggleTurnMark(monster.id)}
                            onEdit={() => handleStartRosterMonsterEdit(monster)}
                            onDelete={() => handleDismissRosterMonster(monster.id)}
                            onSetMinionVit={(monId, newMinionVit) => handleSetRosterMonsterMinionVit(monId, newMinionVit)}
                          />
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Adventure Encounters Suite (6 cols - 50/50 balanced layout) */}
        <div className="lg:col-span-6 bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950/95 p-4 rounded-2xl border border-slate-800 border-t-2 border-t-amber-500/90 shadow-lg shadow-amber-950/20 flex flex-col lg:h-full lg:min-h-0 font-outfit">
          {/* ====================================================================== */}
          {/* FROZEN CONTROLS ZONE: Vertically pinned Command Deck with Shelf Horizon*/}
          {/* ====================================================================== */}
          <div className="shrink-0 flex flex-col gap-2.5 bg-slate-950/95 backdrop-blur-md p-3 rounded-2xl border border-slate-800/90 border-b-2 border-b-amber-500/60 shadow-2xl shadow-black/60 relative z-30 mb-2">
            {/* 1. Main Adventure Header Row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              {/* Left Group: 🗺️ Icon + Adventure Title + Adventure Name Dropdown + Act Dropdown */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-2 shrink-0 self-end mb-1">
                  <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                    <span className="text-base leading-none">🗺️</span>
                  </div>
                  <h2 className="text-sm font-extrabold text-amber-200 uppercase tracking-wider font-outfit">
                    Adventure
                  </h2>
                </div>

                {/* Adventure & Act Selectors with Centered Labels Above */}
                <AdventureActBar />
              </div>

              {/* Distinct Vertical Separator */}
              <div className="hidden sm:block h-10 w-px bg-gradient-to-b from-slate-800 via-amber-500/40 to-slate-800 mx-1 shrink-0" />

              {/* Right Group: Stacked Notes & Loot (Notes on Top, Loot on Bottom) */}
              <div className="flex flex-col gap-1 items-end ml-auto shrink-0">
                {/* Notes Dropdown (Teal, DRY/KISS - "Adventure" removed) */}
                <UniversalLinksDropdown
                  label="Notes"
                  scope="adventure"
                  links={activeAdventure?.links || activeAdventure?.structure?.links || []}
                  disabled={!activeAdventure}
                  disabledTooltip="Select an adventure first"
                  themeColor="teal"
                  onAddLink={async (name, url) => {
                    if (!activeAdventure) return;
                    await addAdventureLink(activeAdventure.id, name, url);
                  }}
                  onUpdateLink={async (linkId, name, url) => {
                    if (!activeAdventure) return;
                    await updateAdventureLink(activeAdventure.id, linkId, name, url);
                  }}
                  onDeleteLink={async (linkId) => {
                    if (!activeAdventure) return;
                    await deleteAdventureLink(activeAdventure.id, linkId);
                  }}
                  onReorderLinkByIndex={async (fromIdx, toIdx) => {
                    if (!activeAdventure) return;
                    await reorderAdventureLinkByIndex(activeAdventure.id, fromIdx, toIdx);
                  }}
                />

                {/* Loot Dropdown (Yellow/Gold, DRY/KISS - "Adventure" removed) */}
                <UniversalLootDropdown
                  label="Loot"
                  loot={activeAdventure?.loot || activeAdventure?.structure?.loot || []}
                  disabled={!activeAdventure}
                  disabledTooltip="Select an adventure first"
                  themeColor="yellow"
                  onAddLoot={async (item) => {
                    if (!activeAdventure) return;
                    await addAdventureLoot(activeAdventure.id, item);
                  }}
                  onDeleteLoot={async (lootId) => {
                    if (!activeAdventure) return;
                    await deleteAdventureLoot(activeAdventure.id, lootId);
                  }}
                  onClearLoot={async () => {
                    if (!activeAdventure) return;
                    await clearAdventureLoot(activeAdventure.id);
                  }}
                  onSendToPartyVault={async (items, sourceLabel) => {
                    return await sendLootToPartyVault(items, selectedParty?.id || 'default', sourceLabel);
                  }}
                />
              </div>
            </div>

            {/* 2. Ad-Lib Encounter Reset Banner (when active encounter is Ad-Lib) */}
            {(activeEncounter?.is_adlib || activeEncounter?.title === 'Ad-Lib Encounter') && (
              <div className="flex items-center justify-between p-1.5 bg-rose-950/40 border border-rose-500/40 rounded-xl">
                <span className="text-xs text-rose-300 font-bold flex items-center gap-1.5 pl-1.5">
                  <span>⚡</span> Ad-Lib Encounter Active
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (!activeAdventure || !activeAct || !activeEncounter) return;
                    if (confirm('Reset all Encounter Monsters, Loot, and Notes to empty for this Ad-Lib Encounter?')) {
                      await resetEncounterAll(activeAdventure.id, activeAct.id, activeEncounter.id);
                    }
                  }}
                  className="px-2.5 py-0.5 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/60 hover:border-rose-400 text-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow cursor-pointer"
                  title="Reset all Encounter Monsters, Encounter Loot, and Encounter Notes to empty"
                >
                  <RotateCcw className="w-3 h-3 text-rose-400" />
                  <span>Reset Ad-Lib Encounter 🧹</span>
                </button>
              </div>
            )}

            {/* Encounters Header Controls with Inline Threat Level Stepper */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* Left: 🐉 Title, Encounter Selector Bar & Inline Threat Stepper */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="p-1 rounded-lg bg-rose-950/90 border border-rose-500/50 text-rose-300 flex items-center justify-center shadow-[0_0_10px_rgba(244,63,94,0.25)]">
                  <span className="text-xs leading-none">🐉</span>
                </div>
                <h3 className="text-xs font-extrabold text-rose-200 uppercase tracking-wider font-outfit shrink-0">
                  Encounters
                </h3>

                {/* Encounter Selector Dropdown & Stepper */}
                <EncounterSelectorBar />

                {/* High-Density Inline Threat Level Stepper */}
                <GmThreatStepper
                  value={activeEncounterDifficulty}
                  onChange={scaleEncounterDifficulty}
                />
              </div>

              {/* Right: Encounter List vs Room Focus Switch */}
              <div className="flex items-center gap-2 shrink-0 ml-auto flex-wrap">
                {/* Dyslexia-Friendly Multi-Option Pill Switch: Encounter List vs Room Focus */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setEncounterViewMode('tree')}
                    className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      encounterViewMode === 'tree'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                    title="View all encounters and monsters across the active act"
                  >
                    <span>🐉</span>
                    <span>Encounter List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEncounterViewMode('focus')}
                    disabled={!activeEncounter}
                    className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      encounterViewMode === 'focus'
                        ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title="Focus on active room monsters and full-height encounter notes"
                  >
                    <span>🏰</span>
                    <span>Room Focus</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================================== */}
          {/* CONTENT ZONE: Encounter Room Tree OR Room Focus Deck                   */}
          {/* ====================================================================== */}
          {encounterViewMode === 'focus' ? (
            <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-2.5 pt-2">
              {!activeEncounter ? (
                <div className="text-xs font-medium text-slate-400 italic p-8 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2 font-outfit">
                  <div>No active encounter selected.</div>
                  <button
                    type="button"
                    onClick={() => setEncounterViewMode('tree')}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Return to Encounter List
                  </button>
                </div>
              ) : (
                <>
                  {/* Tier 1: Active Encounter Command Horizon & Monster Shelf */}
                  <div className="shrink-0 flex flex-col gap-2 p-2.5 bg-rose-950/80 border border-rose-500/80 rounded-xl shadow-md shadow-rose-950/40 text-rose-200 font-outfit">
                    {/* Header Bar */}
                    <div className="relative flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">🏰</span>
                        <span className="font-extrabold text-xs truncate text-red-400">
                          {activeEncounter.title || 'Untitled Encounter'}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-500/50 shrink-0 flex items-center gap-1 shadow-sm">
                          <span>👑</span>
                          <span>Active Room</span>
                        </span>
                        {/* Encounter Navigation Stepper */}
                        <div className="flex items-center gap-0.5 bg-slate-950/80 border border-rose-500/30 rounded-lg p-0.5 shadow-inner shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrevEncounter();
                            }}
                            disabled={!hasPrevEncounter}
                            className="w-5 h-5 flex items-center justify-center text-xs font-black rounded text-rose-300 hover:text-white hover:bg-rose-900/60 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-rose-300 transition-all cursor-pointer disabled:cursor-not-allowed leading-none"
                            title={hasPrevEncounter ? `Previous Room: ${prevEncounter?.title}` : 'No previous room'}
                          >
                            &lt;
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNextEncounter();
                            }}
                            disabled={!hasNextEncounter}
                            className="w-5 h-5 flex items-center justify-center text-xs font-black rounded text-rose-300 hover:text-white hover:bg-rose-900/60 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-rose-300 transition-all cursor-pointer disabled:cursor-not-allowed leading-none"
                            title={hasNextEncounter ? `Next Room: ${nextEncounter?.title}` : 'No next room'}
                          >
                            &gt;
                          </button>
                        </div>
                      </div>

                      {/* Centered "Add all X monsters" or "(No monsters staged)" */}
                      <div className="pointer-events-auto">
                        {(activeEncounter.monsters || []).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleAddAllMonstersToRoster(activeEncounter)}
                            className="px-2.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100 border border-rose-500/40 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                            title={
                              (activeEncounter.monsters || []).length === 1
                                ? 'Copy the 1 monster to 👥&🐉 Encounter Roster'
                                : `Copy all ${(activeEncounter.monsters || []).length} monsters to 👥&🐉 Encounter Roster`
                            }
                          >
                            <span>⬅️</span>
                            <span>
                              {(activeEncounter.monsters || []).length === 1
                                ? 'Add the 1 monster'
                                : `Add all ${(activeEncounter.monsters || []).length} monsters`}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic select-none">
                            (No monsters staged)
                          </span>
                        )}
                      </div>

                      {/* Right Controls: +🐉 Monster button */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenMonsterManager('adventure')}
                          className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                          title="Add or manage monsters for this encounter"
                        >
                          <span>+🐉</span>
                        </button>
                      </div>
                    </div>

                    {/* Staged Monsters Shelf */}
                    {(activeEncounter.monsters || []).length > 0 ? (
                      <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-1.5 border-l-2 border-rose-500/40 pl-3 ml-2 mt-1">
                        {[...(activeEncounter.monsters || [])]
                          .sort((a, b) => {
                            const nameA = (a.fullText || a.nameWithEquip || (a as any).name || '').replace(/^[🚩👣⚔️⚔🛡️🧥❤️\:\–\-\s]+/, '').toLowerCase();
                            const nameB = (b.fullText || b.nameWithEquip || (b as any).name || '').replace(/^[🚩👣⚔️⚔🛡️🧥❤️\:\–\-\s]+/, '').toLowerCase();
                            return nameA.localeCompare(nameB);
                          })
                          .map((m) => renderMonsterRow(m, activeEncounter.id))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic py-1.5 px-3 bg-slate-950/60 rounded-lg border border-slate-900 text-center font-outfit">
                        No monsters staged for this encounter. Click <span className="text-rose-300 font-bold">+🐉</span> above to stage opponents.
                      </div>
                    )}
                  </div>

                  {/* Tier 2: Encounter Notes Deck */}
                  {isNotesPoppedOut ? (
                    <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center p-6 bg-slate-950/80 border border-dashed border-indigo-500/40 rounded-xl text-center gap-2">
                      <span className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                        <span>🗗</span> Encounter Notes are floating in HUD
                      </span>
                      <p className="text-xs text-slate-400 max-w-sm font-outfit">
                        Notes window is detached and floating on screen. You can drag it anywhere or dock it back here.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNotesPoppedOut(false)}
                        className="mt-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <span>🗖 Dock Notes Here</span>
                      </button>
                    </div>
                  ) : (
                    <div ref={notesDockRef} className="flex-1 min-h-0 flex flex-col">
                      <GmEncounterNotesCard
                        activeEncounter={activeEncounter}
                        selectedPartyId={selectedParty?.id}
                        isPoppedOut={false}
                        onTogglePopOut={handlePopOutNotes}
                        fullHeight={true}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1.5 space-y-3 pt-3">
              {/* Act-Wide Encounter Monsters Tree */}
              {!activeAct || (activeAct.encounters || []).length === 0 ? (
                <div className="text-xs font-medium text-slate-400 italic p-8 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2 font-outfit">
                  <div>No encounters in active act.</div>
                  <div className="text-[11px] text-slate-500 font-outfit">
                    Use the Adventure Selectors above to add acts and encounters.
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {(activeAct.encounters || []).map((enc) => {
                    const isCurrentEncounter = enc.id === activeEncounter?.id;
                    const monCount = (enc.monsters || []).length;
                    const sortedMonsters = [...(enc.monsters || [])].sort((a, b) => {
                      const nameA = (a.fullText || a.nameWithEquip || (a as any).name || '').replace(/^[🚩👣⚔️⚔🛡️🧥❤️\:\–\-\s]+/, '').toLowerCase();
                      const nameB = (b.fullText || b.nameWithEquip || (b as any).name || '').replace(/^[🚩👣⚔️⚔🛡️🧥❤️\:\–\-\s]+/, '').toLowerCase();
                      return nameA.localeCompare(nameB);
                    });

                    return (
                      <div key={enc.id} className="flex flex-col">
                        {/* Level 1: Encounter Chassis Pill with 3-Zone Flex Layout (Zero-Collision) */}
                        <div
                          className={`flex items-center justify-between p-2 rounded-xl border text-xs font-outfit gap-2 transition-all ${
                            isCurrentEncounter
                              ? 'bg-rose-950/80 border-rose-500/80 shadow-md shadow-rose-950/40 text-rose-200'
                              : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        >
                          {/* Zone 1 (Left): 🏰 Room Title & Active Room Badge + Stepper / Set Active */}
                          <div
                            className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer group"
                            onClick={() => selectEncounter(enc.id)}
                            title="Click to select this encounter as the Active Room"
                          >
                            <span className="text-sm shrink-0">🏰</span>
                            <span
                              className={`font-extrabold text-xs truncate min-w-0 transition-colors ${
                                isCurrentEncounter ? 'text-red-400' : 'text-slate-300 group-hover:text-red-400'
                              }`}
                            >
                              {enc.title || 'Untitled Encounter'}
                            </span>
                            {isCurrentEncounter ? (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-500/50 shrink-0 flex items-center gap-1 shadow-sm">
                                  <span>👑</span>
                                  <span>Active Room</span>
                                </span>
                                {/* Encounter Navigation Stepper */}
                                <div className="flex items-center gap-0.5 bg-slate-950/80 border border-rose-500/30 rounded-lg p-0.5 shadow-inner shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePrevEncounter();
                                    }}
                                    disabled={!hasPrevEncounter}
                                    className="w-5 h-5 flex items-center justify-center text-xs font-black rounded text-rose-300 hover:text-white hover:bg-rose-900/60 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-rose-300 transition-all cursor-pointer disabled:cursor-not-allowed leading-none"
                                    title={hasPrevEncounter ? `Previous Room: ${prevEncounter?.title}` : 'No previous room'}
                                  >
                                    &lt;
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNextEncounter();
                                    }}
                                    disabled={!hasNextEncounter}
                                    className="w-5 h-5 flex items-center justify-center text-xs font-black rounded text-rose-300 hover:text-white hover:bg-rose-900/60 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-rose-300 transition-all cursor-pointer disabled:cursor-not-allowed leading-none"
                                    title={hasNextEncounter ? `Next Room: ${nextEncounter?.title}` : 'No next room'}
                                  >
                                    &gt;
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectEncounter(enc.id);
                                }}
                                className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-900/90 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/50 shrink-0 flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                                title="Click to select this encounter as the Active Room"
                              >
                                <span>🎯</span>
                                <span>Set Active</span>
                              </button>
                            )}
                          </div>

                          {/* Zone 2 (Center): Dedicated Monster Button or (No monsters staged) */}
                          <div className="shrink-0 px-2 flex items-center justify-center">
                            {monCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddAllMonstersToRoster(enc);
                                }}
                                className="px-2.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100 border border-rose-500/40 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                title={
                                  monCount === 1
                                    ? 'Copy the 1 monster to 👥&🐉 Encounter Roster'
                                    : `Copy all ${monCount} monsters to 👥&🐉 Encounter Roster`
                                }
                              >
                                <span>⬅️</span>
                                <span>{monCount === 1 ? 'Add the 1 monster' : `Add all ${monCount} monsters`}</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic select-none">
                                (No monsters staged)
                              </span>
                            )}
                          </div>

                          {/* Zone 3 (Right): Notes Button + +🐉 Monster Manager Button */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectEncounter(enc.id);
                                setEncounterViewMode('focus');
                              }}
                              className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-100 border border-amber-500/40 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                              title="Open Encounter Notes in Room Focus mode"
                            >
                              <span>📝</span>
                              <span>Notes</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectEncounter(enc.id);
                                handleOpenMonsterManager('adventure');
                              }}
                              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-100 border border-rose-500/40 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                              title={`Add or manage monsters for ${enc.title || 'this encounter'}`}
                            >
                              <span>+🐉</span>
                            </button>
                          </div>
                        </div>

                        {/* Level 2: Nested Monsters with Vertical Line Indentation */}
                        {monCount > 0 && (
                          <div className="flex flex-col gap-1.5 pl-3 ml-3 border-l-2 border-rose-500/40 my-1.5">
                            {sortedMonsters.map((m) => renderMonsterRow(m, enc.id))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Master Monster Manager Modal */}
      <MonsterManagerModal
        isOpen={isMonsterManagerOpen}
        onClose={() => setIsMonsterManagerOpen(false)}
        monsters={monsterManagerTarget === 'roster' ? rosterMonstersAsParsed : effectiveMonsters}
        onSaveMonsters={monsterManagerTarget === 'roster' ? handleSaveRosterMonstersFromModal : handleSaveMonsters}
        partyName={selectedParty?.name}
        title={monsterManagerTarget === 'roster' ? 'Encounter Roster (Live Game)' : 'Adventure Encounter Monsters'}
      />

      {/* Floating Non-Modal Encounter Notes HUD */}
      <GmFloatingNotesHud
        isOpen={isNotesPoppedOut}
        activeEncounter={activeEncounter}
        selectedPartyId={selectedParty?.id}
        initialBounds={floatingNotesBounds}
        onDock={() => {
          setIsNotesPoppedOut(false);
          setEncounterViewMode('focus');
        }}
        onClose={() => setIsNotesPoppedOut(false)}
      />
    </div>
  );
};
