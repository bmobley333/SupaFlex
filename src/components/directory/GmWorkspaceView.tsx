// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Link2, StickyNote, Rocket } from 'lucide-react';
import { gameApi } from '../../services/api';
import { Party, PartySessionMember, CharacterSheetData, GmDocLink } from '../../types/game';
import { parseMonsterLine, ParsedMonster, sortMonstersByPreset, MonsterSortPreset } from '../../utils/monsterStatParser';
import { PartyCharacterCard, resolveCharFirstName } from '../common/PartyCharacterCard';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { useRosterOrdering } from '../../hooks/useRosterOrdering';
import { LinksManagerModal } from '../modals/LinksManagerModal';
import { MonsterManagerModal } from '../modals/MonsterManagerModal';
import { GmModePillSwitch } from '../common/GmModePillSwitch';
import { GmCompactDifficultyBar } from '../common/GmCompactDifficultyBar';
import { EncounterNavigationRibbon } from '../hud/EncounterNavigationRibbon';
import { useAdventureStore } from '../../store/useAdventureStore';

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

  // Storage Keys
  const partyIdOrDef = selectedParty?.id || 'default';
  const gmDocLinksStorageKey = `supaflex_gm_doc_links_${partyIdOrDef}`;
  const gmTagsStorageKey = `supaflex_gm_tags_${partyIdOrDef}`;
  const monsterPresetKey = `supaflex_gm_monster_preset_${partyIdOrDef}`;

  // GM Document Vault & Adventure Tagging State
  const [gmDocLinks, setGmDocLinks] = useState<GmDocLink[]>(() => {
    try {
      const saved = localStorage.getItem(gmDocLinksStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [adventureTags, setAdventureTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(gmTagsStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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
  const [isLinksManagerOpen, setIsLinksManagerOpen] = useState(false);
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

  const handlePushToPlayers = async () => {
    if (!selectedParty?.id || sessionMode === 'design') return;
    setIsDeploying(true);
    try {
      await deployToLiveParty(selectedParty.id);
      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 2000);
    } finally {
      setIsDeploying(false);
    }
  };

  // Notes Textarea Ref & Icon Insertion
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const ATTRIBUTE_EFFECT_ICONS = [
    { label: 'Magic ✨', icon: '✨' },
    { label: 'Might 💪', icon: '💪' },
    { label: 'Mind 👁️', icon: '👁️' },
    { label: 'Motion 🏃', icon: '🏃' },
    { label: 'Moxie 🫀', icon: '🫀' },
  ];

  const insertIconAtNotesCursor = (iconStr: string) => {
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

  // Inline Monster Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Effective monsters list displayed in the GM Monster Tracker strictly mirrors the active encounter
  const effectiveMonsters = activeMonsters;

  // Re-sync GM Document Links & Adventure Tags when selected party changes
  useEffect(() => {
    try {
      const savedLinks = localStorage.getItem(`supaflex_gm_doc_links_${selectedParty?.id || 'default'}`);
      setGmDocLinks(savedLinks ? JSON.parse(savedLinks) : []);

      const savedTags = localStorage.getItem(`supaflex_gm_tags_${selectedParty?.id || 'default'}`);
      setAdventureTags(savedTags ? JSON.parse(savedTags) : []);

      const savedPreset = localStorage.getItem(`supaflex_gm_monster_preset_${selectedParty?.id || 'default'}`);
      if (savedPreset && (savedPreset === 'alphabetical' || savedPreset === 'nish' || savedPreset === 'vitality')) {
        setMonsterPreset(savedPreset as MonsterSortPreset);
      }
    } catch (e) {
      setGmDocLinks([]);
      setAdventureTags([]);
    }
  }, [selectedParty?.id]);

  // Persistence Helpers
  const persistGmDocLinks = (updated: GmDocLink[]) => {
    setGmDocLinks(updated);
    try {
      localStorage.setItem(gmDocLinksStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.error('[GmWorkspaceView] LocalStorage doc links save error:', err);
    }
  };

  const persistAdventureTags = (updated: string[]) => {
    setAdventureTags(updated);
    try {
      localStorage.setItem(gmTagsStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.error('[GmWorkspaceView] LocalStorage tags save error:', err);
    }
  };

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

  // Party Session Roster State
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [isGmSortMenuOpen, setIsGmSortMenuOpen] = useState(false);

  const gmPartyStorageKey = `supaflex_gm_roster_order_${selectedParty?.id || 'default'}`;
  const {
    orderedItems: orderedSessionMembers,
    moveItem: movePartyItem,
    nudgeItem: nudgePartyItem,
    applyPreset: applyPartyPreset,
    activePreset: gmPartyPreset,
    draggedIndex: partyDraggedIndex,
    setDraggedIndex: setPartyDraggedIndex,
  } = useRosterOrdering<PartySessionMember>({
    items: sessionMembers,
    storageKey: gmPartyStorageKey,
    getId: (m) => String(m.character_id || m.id),
    getName: (m) => resolveCharFirstName(m.character?.name || `Hero #${m.character_id}`),
    getVitPct: (m) => {
      const sheetData: Partial<CharacterSheetData> = m.character?.sheet_data || {};
      const current = sheetData.current_vitality ?? m.character?.hp ?? 28;
      const max = sheetData.vitality_max ?? 28;
      return max > 0 ? (current / max) * 100 : 0;
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
    if (currentEmail) {
      loadParties();
    }
  }, [currentEmail]);

  const loadParties = async () => {
    if (!currentEmail) return;
    try {
      const data = await gameApi.getPartiesForUser(currentEmail);
      let gmParties = (data as Party[]).filter(
        (p) => (p.gm_email || '').toLowerCase() === currentEmail.toLowerCase()
      );
      if (gmParties.length === 0) {
        const created = await gameApi.createParty('GM Screen Party', currentEmail, []);
        gmParties = [created as Party];
      }
      if (!selectedParty) {
        const first = propActiveParty || gmParties[0];
        setSelectedParty(first);
        if (onSelectActiveParty) onSelectActiveParty(first);
      }
    } catch (e) {
      console.error('Failed to load GM parties:', e);
    }
  };

  // Sync prop activeParty changes
  useEffect(() => {
    if (propActiveParty) {
      setSelectedParty(propActiveParty);
    }
  }, [propActiveParty]);

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
      }

      heartbeatInterval = setInterval(() => {
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
      gameApi.closePartyRoom(selectedParty.id).catch(console.error);
    };
  }, [selectedParty?.id]);

  // Load Session Members on Selected Party Change
  useEffect(() => {
    if (!selectedParty) return;
    loadSessionMembers(selectedParty.id, false);
  }, [selectedParty?.id]);

  const loadSessionMembers = async (partyId: string, isSilent = false) => {
    if (!isSilent) setIsMembersLoading(true);
    try {
      const data = await gameApi.getPartySessionMembers(partyId);
      setSessionMembers((data || []) as PartySessionMember[]);
    } catch (e) {
      console.error('Failed to load party members:', e);
    } finally {
      if (!isSilent) setIsMembersLoading(false);
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
    const notesMatch = raw.match(/(?:\]|❤️\s*\d+)\s*\((.*)\)$/);

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
      gm_notes: notesMatch ? notesMatch[1] : undefined,
    };
  };

  return (
    <div className="space-y-6 max-w-[2500px] mx-auto font-outfit">
      {/* Main Grid: Party Roster (Left) vs Monster Roster (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Party Roster + LINKS (4 cols) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          {/* Card 1: Party Roster */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-2 font-outfit">
                  <span>👥</span> PARTY ROSTER ({orderedSessionMembers.length})
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
              </div>
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/80 font-outfit">
                Live Session
              </span>
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
              <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1">
                {orderedSessionMembers.map((member, idx) => (
                  <PartyCharacterCard
                    key={member.id || member.character_id || `pm_${idx}`}
                    member={member}
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
                  />
                ))}
              </div>
            )}
          </div>

          {/* Card 2: LINKS (High-Density Summary Bar & Manage Links Modal Launcher) */}
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2 shadow-lg flex flex-col font-outfit">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-teal-400" />
                <h3 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-outfit">
                  LINKS ({gmDocLinks.length})
                </h3>
              </div>

              <button
                onClick={() => setIsLinksManagerOpen(true)}
                className="px-2.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-600/30 text-xs font-bold rounded-lg transition-all shrink-0 font-outfit"
              >
                Manage Links
              </button>
            </div>

            <p className="text-xs text-slate-400 font-outfit">
              {gmDocLinks.length === 0
                ? 'No GM document links configured.'
                : `${gmDocLinks.length} GM external link${gmDocLinks.length === 1 ? '' : 's'} configured.`}
            </p>
          </div>
        </div>

        {/* Right Column: Adventure Encounters Suite (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col font-outfit">
          {/* Section Header: Adventure Encounters */}
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2.5">
            <span className="text-lg">🗺️</span>
            <h2 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider font-outfit">
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 pt-1">
            {/* Left: Title & Quick Sort */}
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-outfit">
                <span>🐉</span> ENCOUNTER MONSTERS ({effectiveMonsters.length})
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
          <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-xl shadow-inner flex flex-col gap-2 font-outfit mt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                <span>Encounter Notes</span>
                {activeEncounter && (
                  <span className="text-slate-400 font-normal">({activeEncounter.title})</span>
                )}
              </h4>

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
            </div>
            <textarea
              ref={notesTextareaRef}
              rows={3}
              value={activeEncounter?.notes || activeEncounter?.tactical_notes || ''}
              onChange={(e) => setEncounterNotes(e.target.value)}
              placeholder={
                activeEncounter
                  ? 'e.g. Floor spikes trigger on round 2; 2 skeleton archers on catwalks; secret door behind altar...'
                  : 'Select or create an encounter above to write notes...'
              }
              disabled={!activeEncounter}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500/80 transition placeholder:text-slate-600 disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {/* Master Links Manager Modal */}
      <LinksManagerModal
        isOpen={isLinksManagerOpen}
        onClose={() => setIsLinksManagerOpen(false)}
        mode="gm"
        gmLinks={gmDocLinks}
        onSaveGmLinks={persistGmDocLinks}
        adventureTags={adventureTags}
        onSaveAdventureTags={persistAdventureTags}
        partyName={selectedParty?.name}
      />

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
