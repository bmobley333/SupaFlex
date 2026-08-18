// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Link2 } from 'lucide-react';
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
  const monsterStorageKey = `supaflex_gm_monsters_${partyIdOrDef}`;
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

  // Active Encounter Monsters State
  const [monsters, setMonsters] = useState<ParsedMonster[]>(() => {
    try {
      const saved = localStorage.getItem(monsterStorageKey);
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
  const setEncounterMonsters = useAdventureStore((state) => state.setEncounterMonsters);

  useEffect(() => {
    if (currentEmail) {
      fetchAdventures(currentEmail);
    }
  }, [currentEmail, fetchAdventures]);

  // Inline Monster Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Effective monsters list displayed in the GM Monster Tracker
  const effectiveMonsters = activeMonsters.length > 0 ? activeMonsters : monsters;

  // Re-sync GM Document Links, Adventure Tags & Monsters when selected party changes
  useEffect(() => {
    try {
      const savedLinks = localStorage.getItem(`supaflex_gm_doc_links_${selectedParty?.id || 'default'}`);
      setGmDocLinks(savedLinks ? JSON.parse(savedLinks) : []);

      const savedTags = localStorage.getItem(`supaflex_gm_tags_${selectedParty?.id || 'default'}`);
      setAdventureTags(savedTags ? JSON.parse(savedTags) : []);

      const savedMonsters = localStorage.getItem(`supaflex_gm_monsters_${selectedParty?.id || 'default'}`);
      setMonsters(savedMonsters ? JSON.parse(savedMonsters) : []);

      const savedPreset = localStorage.getItem(`supaflex_gm_monster_preset_${selectedParty?.id || 'default'}`);
      if (savedPreset && (savedPreset === 'alphabetical' || savedPreset === 'nish' || savedPreset === 'vitality')) {
        setMonsterPreset(savedPreset as MonsterSortPreset);
      }
    } catch (e) {
      setGmDocLinks([]);
      setAdventureTags([]);
      setMonsters([]);
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
    setMonsters(sorted);
    if (selectedParty?.id) {
      gameApi.savePartyMonsters(selectedParty.id, sorted);
    }
    try {
      localStorage.setItem(monsterStorageKey, JSON.stringify(sorted));
    } catch (err) {
      console.error('[GmWorkspaceView] LocalStorage monsters save error:', err);
    }
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

        {/* Right Column: Monster Tracker & Adventure Staging (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col font-outfit">
          {/* Top Row: GM Session Mode Pill Switch (Design vs. Game Day) */}
          <GmModePillSwitch />

          {/* Staged Encounter Navigation Ribbon */}
          <EncounterNavigationRibbon
            partyId={selectedParty?.id}
          />

          {/* On-Screen Master Difficulty Scaling Bar */}
          <GmCompactDifficultyBar />

          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3 pt-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-outfit">
                <span>🐉</span> MONSTER TRACKER ({effectiveMonsters.length})
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMonsterManagerOpen(true)}
                className="px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition-all shrink-0 font-outfit cursor-pointer"
              >
                Manage Monsters
              </button>
            </div>
          </div>

          {/* Monster List View */}
          {effectiveMonsters.length === 0 ? (
            <div className="text-xs font-medium text-slate-400 italic p-8 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2 font-outfit">
              <div>No monsters in active roster.</div>
              <div className="text-[11px] text-slate-500 font-outfit">
                Use the Adventure Ribbon above or click "Manage Monsters" to construct, paste statblocks, or pick codex monsters.
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
