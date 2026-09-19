// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowUpDown, StickyNote, Rocket, X } from 'lucide-react';
import { gameApi } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { Party, PartySessionMember, CharacterSheetData, SupabaseMonster } from '../../types/game';
import { parseMonsterLine, ParsedMonster, sortMonstersByPreset, MonsterSortPreset, resolveCodexMonsterNotes, getMonsterNish } from '../../utils/monsterStatParser';
import { PartyCharacterCard, resolveCharFirstName } from '../common/PartyCharacterCard';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { useRosterOrdering } from '../../hooks/useRosterOrdering';
import { MonsterManagerModal } from '../modals/MonsterManagerModal';
import { GmModePillSwitch } from '../common/GmModePillSwitch';
import { GmCompactDifficultyBar } from '../common/GmCompactDifficultyBar';
import { EncounterNavigationRibbon } from '../hud/EncounterNavigationRibbon';
import { EncounterLinksDropdown } from '../hud/EncounterLinksDropdown';
import { EncounterLootDropdown } from '../hud/EncounterLootDropdown';
import { useAdventureStore } from '../../store/useAdventureStore';

export interface GmRosterMonster {
  id: string;
  name: string;
  nish: number;
  coreStatsText: string;
  fullText: string;
}

export type GmUnifiedRosterItem =
  | { type: 'member'; id: string; member: PartySessionMember }
  | { type: 'monster'; id: string; monster: GmRosterMonster };

export function parseMonsterForGmRoster(raw: string, idPrefix = 'gm_mon_'): GmRosterMonster {
  const trimmed = (raw || '').trim();
  const monId = `${idPrefix}${Math.random().toString(36).substring(2, 9)}`;

  // Extract Nish (🚩\d+)
  const nishMatch = trimmed.match(/🚩\s*(\d+)/u);
  const nish = nishMatch ? parseInt(nishMatch[1], 10) : 10;

  // Extract Name (before first combat stat icon 🚩, 👣, ⚔️, ⚔, 🛡️, 🧥, ❤️)
  const firstIconMatch = trimmed.match(/[🚩👣⚔️⚔🛡️🧥❤️]/u);
  let rawName = trimmed;
  let afterName = '';
  if (firstIconMatch && firstIconMatch.index !== undefined) {
    rawName = trimmed.substring(0, firstIconMatch.index).trim();
    afterName = trimmed.substring(firstIconMatch.index).trim();
  }

  // Clean Name: remove leading numbers and text in parentheses
  const cleanName =
    rawName
      .replace(/^\d+\s*/, '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/[\:\–\-]+$/, '')
      .trim() || 'Monster';

  // Core Stats text: strip 🚩\s*\d+ so we don't duplicate the interactive 🚩 badge
  let statsPart = afterName.replace(/🚩\s*\d+\s*/u, '').trim();

  // Remove notes emojis: 📝, 📋, ✏️, ℹ️
  statsPart = statsPart.replace(/[📝📋✏️ℹ️]/gu, '');

  // Truncate any trailing text after closing attribute bracket: e.g. [✨9/💪15/👁️16/🏃24/🫀5]
  const attrEndMatch = statsPart.match(/(\[[^\]]*?(?:🫀|💖)[^\]]*?\])/u);
  if (attrEndMatch && attrEndMatch.index !== undefined) {
    const cutIndex = attrEndMatch.index + attrEndMatch[0].length;
    statsPart = statsPart.substring(0, cutIndex).trim();
  } else {
    // If no attribute block, truncate after vitality ❤️\d+
    const vitMatch = statsPart.match(/❤️\s*\d+/u);
    if (vitMatch && vitMatch.index !== undefined) {
      const cutIndex = vitMatch.index + vitMatch[0].length;
      statsPart = statsPart.substring(0, cutIndex).trim();
    }
  }

  return {
    id: monId,
    name: cleanName,
    nish,
    coreStatsText: statsPart,
    fullText: trimmed,
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
  const setEncounterMonsters = useAdventureStore((state) => state.setEncounterMonsters);
  const setEncounterNotes = useAdventureStore((state) => state.setEncounterNotes);
  const sessionMode = useAdventureStore((state) => state.sessionMode);
  const deployToLiveParty = useAdventureStore((state) => state.deployToLiveParty);

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

  // Inline Monster Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const handleDeleteMonster = (id: string) => {
    handleSaveMonsters(effectiveMonsters.filter((m) => m.id !== id));
  };

  const handleStartEdit = (m: ParsedMonster) => {
    setEditingId(m.id);
    setEditText(m.fullText || m.nameWithEquip);
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    const parsed = parseMonsterLine(editText.trim());
    const updated = effectiveMonsters.map((m) => (m.id === id ? { ...parsed, id, baseFullText: editText.trim() } : m));
    handleSaveMonsters(updated);
    setEditingId(null);
  };

  // Monster Nish Mode: 'all' | 'fastest'
  const monsterNishModeKey = `supaflex_gm_monster_nish_mode_${partyIdOrDef}`;
  const [monsterNishMode, setMonsterNishMode] = useState<'all' | 'fastest'>(() => {
    try {
      const saved = localStorage.getItem(monsterNishModeKey);
      if (saved === 'all' || saved === 'fastest') return saved;
    } catch {}
    return 'all';
  });

  const handleSetMonsterNishMode = (mode: 'all' | 'fastest') => {
    setMonsterNishMode(mode);
    try {
      localStorage.setItem(monsterNishModeKey, mode);
    } catch {}
  };

  // Pushed Monsters for GM Screen Party Roster
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

  // Re-sync pushed monsters and nish mode when selectedParty changes
  useEffect(() => {
    if (!selectedParty?.id) return;
    try {
      const savedMode = localStorage.getItem(`supaflex_gm_monster_nish_mode_${selectedParty.id}`);
      if (savedMode === 'all' || savedMode === 'fastest') setMonsterNishMode(savedMode);
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

  const toggleTurnMark = (id: string) => {
    setMarkedTurnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleResetTurnMarks = () => {
    setMarkedTurnIds([]);
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

  const handlePushToPlayers = async () => {
    if (!selectedParty?.id || sessionMode === 'design') return;
    setIsDeploying(true);
    try {
      await deployToLiveParty(selectedParty.id);

      // Ingest encounter monsters into GM Party Roster based on monsterNishMode
      if (effectiveMonsters.length > 0) {
        let selectedMonsters: ParsedMonster[] = [];
        if (monsterNishMode === 'fastest') {
          // Find single monster with maximum Nish
          let maxNish = -1;
          let topMonster: ParsedMonster | null = null;
          for (const m of effectiveMonsters) {
            const nish = getMonsterNish(m);
            if (nish > maxNish) {
              maxNish = nish;
              topMonster = m;
            }
          }
          if (topMonster) {
            selectedMonsters = [topMonster];
          }
        } else {
          selectedMonsters = effectiveMonsters;
        }

        const rosterMonsters: GmRosterMonster[] = selectedMonsters.map((m) =>
          parseMonsterForGmRoster(m.fullText || m.nameWithEquip || '', `gm_mon_${m.id}_`)
        );

        setPushedMonsters(rosterMonsters);
        try {
          localStorage.setItem(gmPushedMonstersKey, JSON.stringify(rosterMonsters));
        } catch {}
      }

      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 2000);
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
        const { roomCode } = await gameApi.checkoutPartyRoomCode(selectedParty.id);
        if (onRoomCodeReady) onRoomCodeReady(roomCode);
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
      gameApi.closePartyRoom(selectedParty.id).catch(console.error);
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

    // 2. Broadcast channel for instantaneous player arrival and vitals updates
    const broadcastChannel = supabase.channel(`party:${partyId}`);
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
      .on('broadcast', { event: 'party.joined' }, () => {
        loadSessionMembers(partyId, true);
      })
      .on('broadcast', { event: 'party.left' }, () => {
        loadSessionMembers(partyId, true);
      })
      .subscribe();

    // 3. Periodic polling fallback every 60 seconds (paused when tab hidden)
    const pollInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        loadSessionMembers(partyId, true);
      }
    }, 60000);

    return () => {
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
        {/* Left Column: Party Roster (4 cols) */}
        <div className="lg:col-span-4 flex flex-col lg:h-full lg:min-h-0">
          {/* Card 1: Party Roster */}
          <div className="bg-gradient-to-b from-sky-950/30 via-slate-900/90 to-slate-950/95 p-4 rounded-2xl border border-slate-800 border-t-2 border-t-sky-500/90 space-y-4 shadow-lg shadow-sky-950/20 flex flex-col lg:h-full lg:min-h-0">
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-3 shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-sky-950/90 border border-sky-500/50 text-sky-300 flex items-center justify-center shadow-[0_0_12px_rgba(14,165,233,0.25)]">
                  <span className="text-base leading-none">👥</span>
                </div>
                <h3 className="text-xs font-extrabold text-sky-200 uppercase tracking-wider font-outfit">
                  PARTY ROSTER ({orderedSessionMembers.length})
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
              </div>

              {/* Monster Nish: All / Fastest Pill Switch */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 font-outfit">Monster Nish:</span>
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => handleSetMonsterNishMode('all')}
                    className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      monsterNishMode === 'all'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border-transparent'
                    }`}
                  >
                    <span>🐉</span>
                    <span>All</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetMonsterNishMode('fastest')}
                    className={`px-2 py-0.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      monsterNishMode === 'fastest'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border-transparent'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Fastest</span>
                  </button>
                </div>
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
                          isMarked ? 'opacity-60 bg-slate-950/50' : ''
                        } ${
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

                            {/* Core stats text (no notes emoji, no trailing text after 🫀5]) */}
                            <span className="text-slate-300 font-medium text-[11px]">
                              {monster.coreStatsText}
                            </span>
                          </div>

                          {/* Right Segment: ONLY Dismiss (X) button! No health bar! */}
                          <div className="flex items-center shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDismissRosterMonster(monster.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-950/50 border border-transparent hover:border-red-500/40 rounded transition-all cursor-pointer"
                              title="Remove monster from Party Roster initiative (Encounter monster remains intact)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Adventure Encounters Suite (8 cols) */}
        <div className="lg:col-span-8 bg-gradient-to-b from-amber-950/30 via-slate-900/90 to-slate-950/95 p-4 rounded-2xl border border-slate-800 border-t-2 border-t-amber-500/90 shadow-lg shadow-amber-950/20 flex flex-col lg:h-full lg:min-h-0 font-outfit">
          {/* Scrollable Content Container for Right Pane */}
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-1.5 space-y-4">
            {/* Section Header: Adventure Encounters */}
            <div className="flex items-center gap-2.5 border-b border-amber-500/20 pb-2.5">
            <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)]">
              <span className="text-base leading-none">🗺️</span>
            </div>
            <h2 className="text-sm font-extrabold text-amber-200 uppercase tracking-wider font-outfit">
              Adventure Encounters
            </h2>
          </div>

          {/* Top Row: GM Session Mode Pill Switch (Design vs. Game Day) */}
          <GmModePillSwitch />

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
                ENCOUNTER MONSTERS ({effectiveMonsters.length})
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

            {/* Center: Push to Players Button (Disabled & Greyed Out in Design Mode) */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={handlePushToPlayers}
                disabled={sessionMode === 'design' || isDeploying || !selectedParty?.id}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md ${
                  sessionMode === 'design'
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 opacity-40 cursor-not-allowed'
                    : deploySuccess
                    ? 'bg-emerald-600 text-white border border-emerald-400/50 cursor-pointer'
                    : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border border-rose-400/40 shadow-rose-950/40 cursor-pointer'
                }`}
                title={
                  sessionMode === 'design'
                    ? 'Switch to Game Day mode to push encounter to live players'
                    : 'Broadcast active encounter monsters directly to players\' screens'
                }
              >
                <Rocket className={`w-3.5 h-3.5 ${isDeploying ? 'animate-bounce' : ''}`} />
                <span>{deploySuccess ? 'Pushed!' : 'Push to Players'}</span>
              </button>
            </div>

            {/* Right: Manage Monsters Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMonsterManagerOpen(true)}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition-all shrink-0 font-outfit cursor-pointer flex items-center gap-1"
              >
                <span>🐉</span>
                <span>Manage Encounter Monsters</span>
              </button>
            </div>
          </div>

          {/* Monster List View */}
          {effectiveMonsters.length === 0 ? (
            <div className="text-xs font-medium text-slate-400 italic p-8 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2 font-outfit">
              <div>No monsters in active encounter.</div>
              <div className="text-[11px] text-slate-500 font-outfit">
                Use the Adventure Ribbon above or click "🐉 Manage Encounter Monsters" to construct, paste statblocks, or pick codex monsters.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto max-h-[600px] pr-1">
              {effectiveMonsters.map((m) =>
                editingId === m.id ? (
                  <div key={m.id} className="p-2 bg-slate-950 border border-amber-500/60 rounded-lg flex items-center gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1 bg-slate-900 border border-amber-500/60 text-xs font-mono text-slate-100 px-2 py-1 rounded"
                    />
                    <button
                      onClick={() => handleSaveEdit(m.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <GmMonsterCard
                    key={m.id}
                    monster={mapToMonsterData(m)}
                    onEdit={() => handleStartEdit(m)}
                    onDelete={() => handleDeleteMonster(m.id)}
                  />
                )
              )}
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
        monsters={effectiveMonsters}
        onSaveMonsters={handleSaveMonsters}
        partyName={selectedParty?.name}
      />
    </div>
  );
};
