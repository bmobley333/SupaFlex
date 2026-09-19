// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUpDown, StickyNote, ChevronDown, ChevronRight } from 'lucide-react';
import { gameApi } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { Party, PartySessionMember, CharacterSheetData, SupabaseMonster } from '../../types/game';
import { parseMonsterLine, ParsedMonster, sortMonstersByPreset, MonsterSortPreset, resolveCodexMonsterNotes, formatMonsterDataToStatblock } from '../../utils/monsterStatParser';
import { PartyCharacterCard, resolveCharFirstName } from '../common/PartyCharacterCard';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { useRosterOrdering } from '../../hooks/useRosterOrdering';
import { MonsterManagerModal } from '../modals/MonsterManagerModal';
import { GmCompactDifficultyBar } from '../common/GmCompactDifficultyBar';
import { EncounterNavigationRibbon } from '../hud/EncounterNavigationRibbon';
import { AdventureActBar } from '../hud/AdventureActBar';
import { EncounterLinksDropdown } from '../hud/EncounterLinksDropdown';
import { EncounterLootDropdown } from '../hud/EncounterLootDropdown';
import { useAdventureStore } from '../../store/useAdventureStore';

export interface GmRosterMonster {
  id: string;
  name: string;
  nish: number;
  coreStatsText: string;
  fullText: string;
  mr?: number;
  attack?: number;
  damage?: number;
  defense?: number;
  armor?: number;
  max_vit?: number;
  attributes?: { magic: number; might: number; mind: number; motion: number; moxie: number };
}

export type GmUnifiedRosterItem =
  | { type: 'member'; id: string; member: PartySessionMember }
  | { type: 'monster'; id: string; monster: GmRosterMonster };

export function parseMonsterForGmRoster(
  raw: string,
  idPrefixOrId = 'gm_mon_',
  explicitId?: string
): GmRosterMonster {
  const trimmed = (raw || '').trim();
  const monId = explicitId || `${idPrefixOrId}${Math.random().toString(36).substring(2, 9)}`;

  // Extract Name (before first combat stat icon 🚩, 👣, ⚔️, ⚔, 🛡️, 🧥, ❤️)
  const firstIconMatch = trimmed.match(/[🚩👣⚔️⚔🛡️🧥❤️]/u);
  let rawName = trimmed;
  if (firstIconMatch && firstIconMatch.index !== undefined) {
    rawName = trimmed.substring(0, firstIconMatch.index).trim();
  }

  // Clean Name: remove leading punctuation/dashes, preserve numbers & equipment
  const cleanName =
    rawName
      .replace(/^[\:\–\-\s]+/, '')
      .replace(/[\:\–\-]+$/, '')
      .trim() || 'Monster';

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

  // Vitality: match ❤️ or ❤
  const vitMatch = trimmed.match(/(?:❤️|❤)\s*(\d+)/u);
  const vit = vitMatch ? vitMatch[1] : '10';

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

  // Canonical full-color emoji presentation:
  // ⚔️ (\u2694\uFE0F) and ❤️ (\u2764\uFE0F) with standardized spacing
  const coreStatsText = `👣${mr} ⚔️${atk}/${dmg}${wounds} 🧥${def}/${arm} ❤️${vit} ${attrBlock}`.trim();

  return {
    id: monId,
    name: cleanName,
    nish,
    coreStatsText,
    fullText: trimmed,
    mr,
    attack: parseInt(atk, 10) || 10,
    damage: parseInt(dmg, 10) || 5,
    defense: parseInt(def, 10) || 10,
    armor: parseInt(arm, 10) || 0,
    max_vit: parseInt(vit, 10) || 10,
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

  // Storage Keys
  const partyIdOrDef = selectedParty?.id || 'default';
  const monsterPresetKey = `supaflex_gm_monster_preset_${partyIdOrDef}`;

  const [monsterPreset, setMonsterPreset] = useState<MonsterSortPreset>(() => {
    try {
      const saved = localStorage.getItem(monsterPresetKey);
      if (saved && (saved === 'alphabetical' || saved === 'nish' || saved === 'vitality')) {
        return saved as MonsterSortPreset;
      }
    } catch {}
    return 'alphabetical';
  });

  const [isMonsterSortMenuOpen, setIsMonsterSortMenuOpen] = useState(false);

  // Modal triggers
  const [isMonsterManagerOpen, setIsMonsterManagerOpen] = useState(false);

  // Adventure Store State
  const fetchAdventures = useAdventureStore((state) => state.fetchAdventures);
  const activeMonsters = useAdventureStore((state) => state.getActiveMonsters());
  const activeEncounter = useAdventureStore((state) => state.getActiveEncounter());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeAdventure = useAdventureStore((state) => state.getActiveAdventure());
  const selectEncounter = useAdventureStore((state) => state.selectEncounter);
  const updateEncounter = useAdventureStore((state) => state.updateEncounter);
  const setEncounterMonsters = useAdventureStore((state) => state.setEncounterMonsters);
  const setEncounterNotes = useAdventureStore((state) => state.setEncounterNotes);

  // Modal dual-targeting: 'roster' (live game Encounter Roster) vs 'adventure' (pre-staged adventure)
  const [monsterManagerTarget, setMonsterManagerTarget] = useState<'roster' | 'adventure'>('roster');
  const handleOpenMonsterManager = (target: 'roster' | 'adventure') => {
    setMonsterManagerTarget(target);
    setIsMonsterManagerOpen(true);
  };

  // Encounter Collapse State (default expanded)
  const [collapsedEncounters, setCollapsedEncounters] = useState<Record<string, boolean>>({});
  const toggleEncounterCollapse = (encId: string) => {
    setCollapsedEncounters((prev) => ({ ...prev, [encId]: !prev[encId] }));
  };

  // Total monsters across all encounters in active act
  const totalActMonsters = useMemo(() => {
    if (!activeAct?.encounters) return 0;
    return activeAct.encounters.reduce((acc, enc) => acc + (enc.monsters?.length || 0), 0);
  }, [activeAct]);

  useEffect(() => {
    if (currentEmail) {
      fetchAdventures(currentEmail);
    }
  }, [currentEmail, fetchAdventures]);

  // Deploy / Push to Players state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  // Notes Textarea Ref & Formatting Mode
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [notesMode, setNotesMode] = useState<'view' | 'edit'>('view');

  const ATTRIBUTE_EFFECT_ICONS = [
    { label: 'Magic ✨', icon: '✨' },
    { label: 'Might 💪', icon: '💪' },
    { label: 'Mind 👁️', icon: '👁️' },
    { label: 'Motion 🏃', icon: '🏃' },
    { label: 'Moxie 🫀', icon: '🫀' },
  ];

  const insertIconAtNotesCursor = (iconStr: string) => {
    if (notesMode !== 'edit') {
      setNotesMode('edit');
    }
    const currentNotes = activeEncounter?.notes || activeEncounter?.tactical_notes || '';
    const textarea = notesTextareaRef.current;
    if (!textarea) {
      setEncounterNotes(currentNotes + iconStr);
      return;
    }
    const start = textarea.selectionStart ?? currentNotes.length;
    const end = textarea.selectionEnd ?? currentNotes.length;
    const nextVal = currentNotes.substring(0, start) + iconStr + currentNotes.substring(end);
    setEncounterNotes(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + iconStr.length, start + iconStr.length);
    }, 0);
  };

  const renderFormattedEncounterNotes = (rawText: string) => {
    if (!rawText || !rawText.trim()) {
      return (
        <span className="text-slate-500 italic text-xs">
          No notes for this encounter. Click to add notes...
        </span>
      );
    }

    const lines = rawText.split(/\r?\n/);
    return (
      <div className="space-y-1 text-slate-200 font-sans text-xs leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={idx} className="h-1.5" />;
          }

          if (trimmed === '---') {
            return <div key={idx} className="border-t border-slate-800/80 my-2" />;
          }

          // Major Section Headers: Room Description, Tactical Encounter Notes, Overview
          if (
            trimmed === 'Room Description:' ||
            trimmed === 'Tactical Encounter Notes:' ||
            trimmed.startsWith('Overview:') ||
            trimmed.startsWith('Act I:') ||
            trimmed.startsWith('Act II:') ||
            trimmed.startsWith('Act III:') ||
            trimmed.startsWith('Act IV:')
          ) {
            return (
              <div
                key={idx}
                className="text-sky-300 font-extrabold text-xs tracking-wider uppercase border-b border-sky-900/40 pb-0.5 mt-2 mb-1 flex items-center gap-1.5"
              >
                <span>{trimmed}</span>
              </div>
            );
          }

          // Prompt Keywords: "• Scene:", "• GM Notes:", "• Objective:", "• Opponents:", "• Reward:", "• Treasure:", "• Trap:", "• Puzzle:", "• Special:"
          const kwMatch = trimmed.match(
            /^(?:[•\-\*]\s*)?(Scene|GM Notes|Objective|Opponents|Reward|Treasure|Trap|Puzzle|Special|Puzzle \/ Trap \/ Reward):\s*(.*)$/i
          );
          if (kwMatch) {
            const kw = kwMatch[1];
            const rest = kwMatch[2];
            return (
              <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                <span className="font-extrabold text-sky-400 shrink-0 font-sans tracking-wide">
                  • {kw}:
                </span>
                {rest && <span className="text-slate-200">{rest}</span>}
              </div>
            );
          }

          // Monster Sub-lines: "  - 2 Ogrind Guards: ...", "Station Commander Klyss: ..."
          const monMatch = trimmed.match(
            /^(?:[•\-\*○]\s*)?(\d+(?:-\d+)?\s+[A-Za-z0-9 '–\-]+(?:\([^\)]+\))?|Station Commander Klyss[^\:]*|Overseer Ketone[^\:]*|Paralith Captain):\s*(.*)$/
          );
          if (monMatch) {
            const mName = monMatch[1];
            const mRest = monMatch[2];
            return (
              <div key={idx} className="pl-4 flex items-start gap-1.5 leading-relaxed">
                <span className="font-bold text-amber-300 shrink-0 font-sans">
                  - {mName}:
                </span>
                <span className="text-slate-300">{mRest}</span>
              </div>
            );
          }

          // Standard text line
          return (
            <div key={idx} className="text-slate-200 leading-relaxed">
              {line}
            </div>
          );
        })}
      </div>
    );
  };

  // Inline Monster Edit State for Adventure Encounters
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEncounterId, setEditingEncounterId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Effective monsters list displayed in the GM Monster Tracker strictly mirrors the active encounter
  const effectiveMonsters = activeMonsters;

  // Re-sync Monster Preset when selected party changes
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem(`supaflex_gm_monster_preset_${selectedParty?.id || 'default'}`);
      if (savedPreset && (savedPreset === 'alphabetical' || savedPreset === 'nish' || savedPreset === 'vitality')) {
        setMonsterPreset(savedPreset as MonsterSortPreset);
      }
    } catch (e) {}
  }, [selectedParty?.id]);

  const handleSaveMonsters = (updated: ParsedMonster[]) => {
    const sorted = sortMonstersByPreset(updated, monsterPreset);
    setEncounterMonsters(sorted);
  };

  const applyMonsterPreset = (preset: MonsterSortPreset) => {
    setMonsterPreset(preset);
    try {
      localStorage.setItem(monsterPresetKey, preset);
    } catch {}
    handleSaveMonsters(sortMonstersByPreset(effectiveMonsters, preset));
    setIsMonsterSortMenuOpen(false);
  };

  const handleStartEdit = (m: ParsedMonster, encounterId?: string) => {
    setEditingEncounterId(encounterId || activeEncounter?.id || null);
    setEditingId(m.id);
    setEditText(m.fullText || m.nameWithEquip);
  };

  const handleSaveEdit = (encounterId: string, monsterId: string) => {
    if (!editText.trim()) return;
    const parsed = parseMonsterLine(editText.trim());
    
    if (encounterId === activeEncounter?.id) {
      const updated = effectiveMonsters.map((m) =>
        m.id === monsterId ? { ...parsed, id: monsterId, baseFullText: editText.trim() } : m
      );
      handleSaveMonsters(updated);
    } else if (activeAdventure && activeAct) {
      const targetEnc = activeAct.encounters?.find((e) => e.id === encounterId);
      if (targetEnc) {
        const updated = (targetEnc.monsters || []).map((m) =>
          m.id === monsterId ? { ...parsed, id: monsterId, baseFullText: editText.trim() } : m
        );
        updateEncounter(activeAdventure.id, activeAct.id, encounterId, { monsters: updated });
      }
    }
    setEditingId(null);
    setEditingEncounterId(null);
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
  const gmPushedMonstersKey = `supaflex_gm_pushed_monsters_${partyIdOrDef}`;
  const [pushedMonsters, setPushedMonsters] = useState<GmRosterMonster[]>(() => {
    try {
      const saved = localStorage.getItem(gmPushedMonstersKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Re-sync pushed monsters when selectedParty changes
  useEffect(() => {
    if (!selectedParty?.id) return;
    try {
      const savedMons = localStorage.getItem(`supaflex_gm_pushed_monsters_${selectedParty.id}`);
      if (savedMons) {
        const parsed = JSON.parse(savedMons);
        if (Array.isArray(parsed)) setPushedMonsters(parsed);
      } else {
        setPushedMonsters([]);
      }
    } catch {}
  }, [selectedParty?.id]);

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

  // Live Inline Editing for Encounter Roster Monsters
  const [editingRosterMonsterId, setEditingRosterMonsterId] = useState<string | null>(null);
  const [rosterMonsterEditText, setRosterMonsterEditText] = useState('');

  const handleStartRosterMonsterEdit = (monster: GmRosterMonster) => {
    setEditingRosterMonsterId(monster.id);
    setRosterMonsterEditText(monster.fullText || `${monster.name} 🚩${monster.nish} ${monster.coreStatsText}`);
  };

  const handleSaveRosterMonsterEdit = (monsterId: string) => {
    if (!rosterMonsterEditText.trim()) return;
    const parsed = parseMonsterForGmRoster(rosterMonsterEditText.trim(), monsterId, monsterId);
    setPushedMonsters((prev) => {
      const next = prev.map((m) => (m.id === monsterId ? { ...parsed, id: monsterId } : m));
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
    setEditingRosterMonsterId(null);
  };

  // Add monster directly to live Encounter Roster (via ⬅️ on adventure monster cards)
  const handleAddMonsterToRoster = (m: ParsedMonster | MonsterData) => {
    const rawText = (m as any).fullText || (m as any).nameWithEquip || formatMonsterDataToStatblock(m as any);
    const newRosterMonster = parseMonsterForGmRoster(rawText, `gm_mon_${Date.now()}_`);
    setPushedMonsters((prev) => {
      const next = [...prev, newRosterMonster];
      try {
        localStorage.setItem(gmPushedMonstersKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Convert pushedMonsters to ParsedMonster[] format for MonsterManagerModal
  const rosterMonstersAsParsed: ParsedMonster[] = useMemo(() => {
    return pushedMonsters.map((m) => {
      const parsed = parseMonsterLine(m.fullText || `${m.name} 🚩${m.nish} ${m.coreStatsText}`);
      return { ...parsed, id: m.id };
    });
  }, [pushedMonsters]);

  const handleSaveRosterMonstersFromModal = (updated: ParsedMonster[]) => {
    const newRoster: GmRosterMonster[] = updated.map((p) =>
      parseMonsterForGmRoster(p.fullText || p.nameWithEquip || '', p.id, p.id)
    );
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
        fullText: mon.fullText || `${mon.name} 🚩${mon.nish} ${mon.coreStatsText}`,
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
  const [isGmSortMenuOpen, setIsGmSortMenuOpen] = useState(false);

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

  const gmPartyStorageKey = `supaflex_gm_roster_order_${selectedParty?.id || 'default'}`;
  const {
    orderedItems: orderedSessionMembers,
    moveItem: movePartyItem,
    nudgeItem: nudgePartyItem,
    applyPreset: applyPartyPreset,
    activePreset: gmPartyPreset,
    draggedIndex: partyDraggedIndex,
    setDraggedIndex: setPartyDraggedIndex,
  } = useRosterOrdering<GmUnifiedRosterItem>({
    items: combinedRosterItems,
    storageKey: gmPartyStorageKey,
    defaultPreset: 'nish_desc',
    isMonster: (item) => item.type === 'monster',
    getId: (item) => item.id,
    getName: (item) =>
      item.type === 'member'
        ? resolveCharFirstName(item.member.character?.name || `Hero #${item.member.character_id}`)
        : item.monster.name,
    getVitPct: (item) => {
      if (item.type === 'member') {
        const sheetData: Partial<CharacterSheetData> = item.member.character?.sheet_data || {};
        const current = (item.member.character as any)?.current_vitality ?? sheetData.current_vitality ?? item.member.character?.hp ?? 28;
        const max = (item.member.character as any)?.vitality_max ?? sheetData.vitality_max ?? 28;
        return max > 0 ? (current / max) * 100 : 0;
      }
      return 100;
    },
    getNish: (item) => {
      if (item.type === 'member') {
        const sheetData: Partial<CharacterSheetData> = item.member.character?.sheet_data || {};
        const nish = sheetData.current_nish ?? (item.member.character as any)?.current_nish ?? (item.member.character as any)?.initiative;
        return typeof nish === 'number' ? nish : parseInt(String(nish || 0), 10) || 0;
      }
      return item.monster.nish;
    },
  });

  const handlePartyDragStart = (e: React.DragEvent, index: number) => {
    setPartyDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handlePartyDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handlePartyDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (partyDraggedIndex === null) return;
    movePartyItem(partyDraggedIndex, dropIndex);
    setPartyDraggedIndex(null);
  };

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

    // Resolve notes ONLY from Supabase Codex
    const codexNotes = m.codex_notes || resolveCodexMonsterNotes(parsed.nameWithEquip, supabaseMonsters);

    return {
      id: m.id,
      name: parsed.nameWithEquip || 'Monster',
      initiative: initMatch ? parseInt(initMatch[1], 10) : 10,
      mr: mrMatch ? parseInt(mrMatch[1], 10) : 10,
      attack: atkNums[0] ? parseInt(atkNums[0], 10) : 10,
      damage: atkNums[1] ? parseInt(atkNums[1], 10) : 10,
      min_wounds: atkNums[2] ? parseInt(atkNums[2], 10) : 1,
      defense: defNums[0] ? parseInt(defNums[0], 10) : 10,
      armor: defNums[1] ? parseInt(defNums[1], 10) : 0,
      max_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
      current_vit: hpNums[0] ? parseInt(hpNums[0], 10) : 10,
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
                {orderedSessionMembers.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsGmSortMenuOpen(!isGmSortMenuOpen)}
                      className={`p-1 rounded text-xs transition-colors flex items-center gap-1 border ${
                        gmPartyPreset !== 'custom'
                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                      title="Quick Sort GM Roster Presets"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>

                    {isGmSortMenuOpen && (
                      <div
                        className="absolute left-0 mt-1 w-44 bg-slate-950 border border-slate-800 rounded-lg shadow-xl z-50 py-1 text-xs font-outfit"
                        onClick={() => setIsGmSortMenuOpen(false)}
                      >
                        <button
                          type="button"
                          onClick={() => applyPartyPreset('custom')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            gmPartyPreset === 'custom' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🎲</span> Custom Drag Order
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPartyPreset('alphabetical')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            gmPartyPreset === 'alphabetical' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🔤</span> Alphabetical
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPartyPreset('nish_desc')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            gmPartyPreset === 'nish_desc' ? 'text-amber-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🚩</span> Highest Nish First
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPartyPreset('vit_desc')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            gmPartyPreset === 'vit_desc' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🫀</span> Highest Vit First
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPartyPreset('vit_asc')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            gmPartyPreset === 'vit_asc' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🩸</span> Lowest Vit First
                        </button>
                      </div>
                    )}
                  </div>
                )}

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

              {/* Right side of header: +🐉 Button to open MonsterManagerModal for live roster */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => handleOpenMonsterManager('roster')}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
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
                {orderedSessionMembers.map((item, idx) => {
                  if (item.type === 'member') {
                    const member = item.member;
                    const memberId = String(member.character_id || member.id);
                    const isMarked = markedTurnIds.includes(memberId);
                    return (
                      <PartyCharacterCard
                        key={memberId}
                        member={member}
                        isTurnMarked={isMarked}
                        onToggleTurnMark={() => toggleTurnMark(memberId)}
                        isDraggable={orderedSessionMembers.length > 1}
                        onDragStart={(e) => handlePartyDragStart(e, idx)}
                        onDragOver={handlePartyDragOver}
                        onDrop={(e) => handlePartyDrop(e, idx)}
                        onDragEnd={() => setPartyDraggedIndex(null)}
                        isDragging={partyDraggedIndex === idx}
                        onNudgeUp={() => nudgePartyItem(idx, 'up')}
                        onNudgeDown={() => nudgePartyItem(idx, 'down')}
                        canNudgeUp={idx > 0}
                        canNudgeDown={idx < orderedSessionMembers.length - 1}
                        onDismiss={() => handleDismissMember(member)}
                      />
                    );
                  } else {
                    const monster = item.monster;
                    const isMarked = markedTurnIds.includes(monster.id);
                    return (
                      <div
                        key={monster.id}
                        draggable={orderedSessionMembers.length > 1}
                        onDragStart={(e) => handlePartyDragStart(e, idx)}
                        onDragOver={handlePartyDragOver}
                        onDrop={(e) => handlePartyDrop(e, idx)}
                        onDragEnd={() => setPartyDraggedIndex(null)}
                        className={`group relative p-2.5 bg-slate-950/80 border rounded-xl space-y-1.5 transition-all font-outfit text-xs text-slate-200 border-amber-900/40 hover:border-amber-700/60 bg-gradient-to-r from-amber-950/20 via-slate-950/80 to-slate-950/90 ${
                          partyDraggedIndex === idx
                            ? 'opacity-40 border-cyan-500/80 bg-cyan-950/20 scale-[0.99]'
                            : ''
                        }`}
                      >
                        {orderedSessionMembers.length > 1 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-amber-800/40 group-hover:bg-amber-500/60 cursor-grab active:cursor-grabbing transition-colors"
                            title="Drag to reorder roster position"
                          />
                        )}

                        {editingRosterMonsterId === monster.id ? (
                          <div className="p-1.5 bg-slate-950 border border-amber-500/60 rounded-lg flex items-center gap-2 w-full font-mono">
                            <input
                              type="text"
                              value={rosterMonsterEditText}
                              onChange={(e) => setRosterMonsterEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRosterMonsterEdit(monster.id);
                                if (e.key === 'Escape') setEditingRosterMonsterId(null);
                              }}
                              className="flex-1 bg-slate-900 border border-amber-500/60 text-xs text-slate-100 px-2 py-1 rounded"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRosterMonsterEdit(monster.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRosterMonsterId(null)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={`flex items-center justify-between gap-2 leading-snug ${orderedSessionMembers.length > 1 ? 'pl-2' : ''}`}>
                            {/* Left Segment: 🐉 [Monster Name] [🚩 Nish Button] [Core Stats] */}
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap font-bold text-slate-100">
                              <span className="text-xs leading-none shrink-0 select-none">🐉</span>
                              <span className="text-amber-200 font-extrabold text-xs shrink-0">
                                {monster.name}
                              </span>

                              {/* Clickable Monster Nish Button with diagonal slash */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTurnMark(monster.id);
                                }}
                                className={`relative font-mono text-[11px] font-black min-w-[40px] justify-center px-1.5 py-0.5 rounded border shrink-0 shadow-sm flex items-center gap-0.5 cursor-pointer transition-all overflow-hidden ${
                                  isMarked
                                    ? 'border-slate-700/60 bg-slate-900/90 text-slate-500 opacity-60'
                                    : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:border-amber-400 hover:bg-amber-500/25'
                                }`}
                                title={
                                  isMarked
                                    ? `Initiative: ${monster.nish} (Turn Completed - Click to unmark)`
                                    : `Initiative: ${monster.nish} (Click to mark turn completed)`
                                }
                              >
                                <span className="text-[10px] leading-none">🚩</span>
                                <span className="tabular-nums">{monster.nish}</span>

                                {/* Diagonal Red Slash Line */}
                                {isMarked && (
                                  <span
                                    className="absolute inset-0 pointer-events-none flex items-center justify-center"
                                    aria-hidden="true"
                                  >
                                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                                      <line
                                        x1="12"
                                        y1="88"
                                        x2="88"
                                        y2="12"
                                        stroke="#ef4444"
                                        strokeWidth="14"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </span>
                                )}
                              </button>

                              {/* Core stats text */}
                              <span className="text-slate-300 font-medium text-[11px]">
                                {monster.coreStatsText}
                              </span>
                            </div>

                            {/* Right Segment: Edit ✏️ and Trashcan 🗑️ */}
                            <div className="flex items-center gap-1 shrink-0 ml-auto select-none">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRosterMonsterEdit(monster);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-300 hover:bg-amber-950/50 rounded transition-all cursor-pointer text-xs"
                                title="Edit monster stats inline"
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDismissRosterMonster(monster.id);
                                }}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 rounded transition-all cursor-pointer text-xs"
                                title="Remove monster from Encounter Roster"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
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
          {/* Pinned Title Bar (Never scrolls off screen) */}
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 shrink-0 flex-wrap gap-2 relative z-30">
            <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
              <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)] shrink-0">
                <span className="text-base leading-none">🗺️</span>
              </div>
              <h3 className="text-xs font-extrabold text-amber-200 uppercase tracking-wider font-outfit shrink-0">
                Adventure
              </h3>

              {/* Pinned Adventure & Act Selectors */}
              <AdventureActBar />
            </div>
          </div>

          {/* Scrollable Content Container for Right Pane */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1.5 space-y-4 pt-3">
            {/* Staged Encounter Navigation Ribbon */}
            <EncounterNavigationRibbon />

            {/* On-Screen Master Difficulty Scaling Bar */}
            <GmCompactDifficultyBar />

            {/* Encounter Monsters Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-3 pt-1">
              {/* Left: Title & Quick Sort */}
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                  <span className="text-xs leading-none">🐉</span>
                </div>
                <h3 className="text-xs font-extrabold text-amber-200 uppercase tracking-wider font-outfit">
                  ENCOUNTER MONSTERS {activeAct ? `(${totalActMonsters})` : ''}
                </h3>
                {effectiveMonsters.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsMonsterSortMenuOpen(!isMonsterSortMenuOpen)}
                      className={`p-1 rounded text-xs transition-colors flex items-center gap-1 border ${
                        monsterPreset !== 'alphabetical'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                      title="Quick Sort Monster Presets"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>

                    {isMonsterSortMenuOpen && (
                      <div
                        className="absolute left-0 mt-1 w-44 bg-slate-950 border border-slate-800 rounded-lg shadow-xl z-50 py-1 text-xs font-outfit"
                        onClick={() => setIsMonsterSortMenuOpen(false)}
                      >
                        <button
                          type="button"
                          onClick={() => applyMonsterPreset('alphabetical')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            monsterPreset === 'alphabetical' ? 'text-amber-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🔤</span> Alphabetical
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMonsterPreset('nish')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            monsterPreset === 'nish' ? 'text-amber-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>🚩</span> Nish
                        </button>
                        <button
                          type="button"
                          onClick={() => applyMonsterPreset('vitality')}
                          className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                            monsterPreset === 'vitality' ? 'text-amber-400 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <span>❤️</span> Vitality
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: +🐉 Button to open MonsterManagerModal for active encounter */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={() => handleOpenMonsterManager('adventure')}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  title="Add or manage monsters for the active adventure encounter"
                >
                  <span>+🐉</span>
                </button>
              </div>
            </div>

            {/* Act-Wide Encounter Monsters Tree (Exotic Gear / Mod Tree Chassis Architecture) */}
            {!activeAct || (activeAct.encounters || []).length === 0 ? (
              <div className="text-xs font-medium text-slate-400 italic p-8 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2 font-outfit">
                <div>No encounters in active act.</div>
                <div className="text-[11px] text-slate-500 font-outfit">
                  Use the Adventure Ribbon above to add acts and encounters.
                </div>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {(activeAct.encounters || []).map((enc) => {
                  const isCurrentEncounter = enc.id === activeEncounter?.id;
                  const isCollapsed = !!collapsedEncounters[enc.id];
                  const monCount = (enc.monsters || []).length;

                  return (
                    <div key={enc.id} className="flex flex-col">
                      {/* Level 1: Encounter Chassis Pill */}
                      <div
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-outfit transition-all ${
                          isCurrentEncounter
                            ? 'bg-amber-950/80 border-amber-500/80 shadow-md shadow-amber-950/40 text-amber-200'
                            : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          onClick={() => selectEncounter(enc.id)}
                          title="Click to select this encounter as active"
                        >
                          <span className="text-sm shrink-0">🏰</span>
                          <span className="font-extrabold text-xs truncate">
                            {enc.title || 'Untitled Encounter'}
                          </span>
                          {isCurrentEncounter && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                              Active Room
                            </span>
                          )}
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-700/60 shrink-0">
                            {monCount} {monCount === 1 ? 'monster' : 'monsters'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleEncounterCollapse(enc.id)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors shrink-0 cursor-pointer ml-2"
                          title={isCollapsed ? 'Expand encounter monsters' : 'Collapse encounter monsters'}
                        >
                          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Level 2: Nested Monsters with Vertical Line Indentation */}
                      {!isCollapsed && (
                        <div className="flex flex-col gap-1.5 pl-3 ml-3 border-l-2 border-amber-500/40 my-1.5">
                          {monCount === 0 ? (
                            <div className="text-[11px] font-medium text-slate-500 italic py-1 pl-1">
                              (No monsters staged for this encounter)
                            </div>
                          ) : (
                            (enc.monsters || []).map((m) =>
                              editingId === m.id && editingEncounterId === enc.id ? (
                                <div key={m.id} className="p-2 bg-slate-950 border border-amber-500/60 rounded-lg flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="flex-1 bg-slate-900 border border-amber-500/60 text-xs font-mono text-slate-100 px-2 py-1 rounded"
                                  />
                                  <button
                                    onClick={() => handleSaveEdit(enc.id, m.id)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingEncounterId(null);
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <GmMonsterCard
                                  key={m.id}
                                  monster={mapToMonsterData(m)}
                                  onAddToRoster={() => handleAddMonsterToRoster(m)}
                                  onEdit={() => handleStartEdit(m, enc.id)}
                                  onDelete={() => handleDeleteEncounterMonster(enc.id, m.id)}
                                />
                              )
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          {/* Permanent Always-Open Encounter Notes Card */}
          <div className="bg-slate-950/90 border border-slate-800 border-t-2 border-t-amber-500/50 p-3.5 rounded-xl shadow-inner flex flex-col gap-2.5 font-outfit mt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h4 className="text-xs font-extrabold text-amber-200 uppercase tracking-wider flex items-center gap-2 font-mono">
                  <div className="p-1 rounded-lg bg-amber-950/90 border border-amber-500/40 text-amber-300 flex items-center justify-center shadow-sm">
                    <StickyNote className="w-3.5 h-3.5" />
                  </div>
                  <span>Encounter Notes</span>
                  {activeEncounter && (
                    <span className="text-slate-400 font-normal">({activeEncounter.title})</span>
                  )}
                </h4>

                {/* Dyslexia-Friendly Multi-Option Pill Switch: View vs Edit */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setNotesMode('view')}
                    className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      notesMode === 'view'
                        ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    👁️ View
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesMode('edit')}
                    className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      notesMode === 'edit'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    ✏️ Edit
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Insert Icon Buttons */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold mr-0.5 font-mono">Insert Icon:</span>
                  {ATTRIBUTE_EFFECT_ICONS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => insertIconAtNotesCursor(item.icon)}
                      disabled={!activeEncounter}
                      className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title={`Insert ${item.icon} into Encounter Notes`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* High-Density Encounter Loot Dropdown + Encounter Links Dropdown */}
                <div className="flex items-center gap-2">
                  <EncounterLootDropdown partyId={selectedParty?.id} />
                  <EncounterLinksDropdown />
                </div>
              </div>
            </div>

            {/* Formatted View vs Raw Edit */}
            {notesMode === 'view' ? (
              <div
                onClick={() => setNotesMode('edit')}
                title="Click anywhere to edit notes"
                className="w-full min-h-[100px] max-h-80 overflow-y-auto bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-sans leading-relaxed cursor-pointer hover:border-slate-700/80 transition-colors shadow-inner select-text"
              >
                {renderFormattedEncounterNotes(activeEncounter?.notes || activeEncounter?.tactical_notes || '')}
              </div>
            ) : (
              <textarea
                ref={notesTextareaRef}
                rows={4}
                value={activeEncounter?.notes || activeEncounter?.tactical_notes || ''}
                onChange={(e) => setEncounterNotes(e.target.value)}
                placeholder={
                  activeEncounter
                    ? 'e.g. Floor spikes trigger on round 2; 2 skeleton archers on catwalks; secret door behind altar...'
                    : 'Select or create an encounter above to write notes...'
                }
                disabled={!activeEncounter}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500/80 transition placeholder:text-slate-600 disabled:opacity-40 leading-relaxed"
              />
            )}
          </div>
        </div>
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
    </div>
  );
};
