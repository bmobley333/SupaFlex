// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Party, PartySessionMember, SupabaseMonster, CharacterSheetData } from '../../types/game';
import { parseMonsterLine, parseMultiRowMonsterBlock, ParsedMonster, sortMonstersByPreset, MonsterSortPreset } from '../../utils/monsterStatParser';
import { PartyCharacterCard, resolveCharFirstName } from '../common/PartyCharacterCard';
import { GmMonsterCard, MonsterData } from '../common/GmMonsterCard';
import { useRosterOrdering } from '../../hooks/useRosterOrdering';

interface QuickAddState {
  name: string;
  gear: string;
  init: number;
  mr: number;
  atk: number;
  dmg: number;
  wounds: number;
  def: number;
  armor: number;
  vit: number;
  magic: number;
  might: number;
  mind: number;
  motion: number;
  moxie: number;
  abilities: string;
}

const DEFAULT_QUICK_ADD: QuickAddState = {
  name: 'Custom',
  gear: '',
  init: 15,
  mr: 8,
  atk: 15,
  dmg: 8,
  wounds: 1,
  def: 15,
  armor: 1,
  vit: 12,
  magic: 12,
  might: 12,
  mind: 12,
  motion: 12,
  moxie: 12,
  abilities: '',
};

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

  // Monster Roster State
  const [monsters, setMonsters] = useState<ParsedMonster[]>([]);
  const [monsterPreset, setMonsterPreset] = useState<MonsterSortPreset>(() => {
    try {
      const saved = localStorage.getItem(`supaflex_gm_monster_preset_${propActiveParty?.id || 'default'}`);
      if (saved && (saved === 'alphabetical' || saved === 'nish' || saved === 'vitality')) {
        return saved as MonsterSortPreset;
      }
    } catch (e) {}
    return 'alphabetical';
  });
  const [isMonsterSortMenuOpen, setIsMonsterSortMenuOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [supabaseMonsters, setSupabaseMonsters] = useState<SupabaseMonster[]>([]);
  const [codexSearch, setCodexSearch] = useState('');

  // Structured Quick Add State
  const [quickAdd, setQuickAdd] = useState<QuickAddState>(DEFAULT_QUICK_ADD);

  // Editing Monster State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleNumChange = (field: keyof QuickAddState, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setQuickAdd((prev) => ({ ...prev, [field]: num }));
  };

  const handleTextChange = (field: keyof QuickAddState, val: string) => {
    setQuickAdd((prev) => ({ ...prev, [field]: val }));
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
        // Report the authoritative room code up to App so the GM HUD always shows
        // the same code that is written to the DB (eliminates the stale-code bug).
        if (onRoomCodeReady) onRoomCodeReady(roomCode);
      } catch (err) {
        console.error('Failed to checkout room code:', err);
      }

      // Start 30s keep-alive heartbeat
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

  // Load Session Members & Active Monsters on Selected Party Change
  useEffect(() => {
    if (!selectedParty) return;

    loadSessionMembers(selectedParty.id, false);
    loadPartyMonsters(selectedParty.id);

    // 1. Subscribe to Postgres CDC changes for party_session_members
    const membersChannel = supabase
      .channel(`party_members:${selectedParty.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_session_members',
          filter: `party_id=eq.${selectedParty.id}`,
        },
        () => {
          loadSessionMembers(selectedParty.id, true);
        }
      )
      .subscribe();

    // 2. Subscribe to Realtime Broadcast events (monster roster + party member join/leave)
    const partyChannel = supabase
      .channel(`party:${selectedParty.id}`)
      .on('broadcast', { event: 'monster_roster_updated' }, (payload) => {
        if (payload?.payload?.monsters) {
          setMonsters(payload.payload.monsters);
        }
      })
      .on('broadcast', { event: 'party_members_updated' }, () => {
        loadSessionMembers(selectedParty.id, true);
      })
      .subscribe();

    // 3. Safety 5-second polling fallback for self-healing sync during tab backgrounding
    const pollInterval = setInterval(() => {
      loadSessionMembers(selectedParty.id, true);
    }, 5000);

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(partyChannel);
      clearInterval(pollInterval);
    };
  }, [selectedParty?.id]);

function areSessionMembersEqual(a: PartySessionMember[], b: PartySessionMember[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const m1 = a[i];
    const m2 = b[i];
    if (
      m1.id !== m2.id ||
      m1.character_id !== m2.character_id ||
      m1.player_email !== m2.player_email ||
      m1.character?.name !== m2.character?.name ||
      m1.character?.hp !== m2.character?.hp ||
      JSON.stringify(m1.character?.sheet_data) !== JSON.stringify(m2.character?.sheet_data)
    ) {
      return false;
    }
  }
  return true;
}

  const loadSessionMembers = async (partyId: string, isSilent = false) => {
    if (!isSilent && sessionMembers.length === 0) {
      setIsMembersLoading(true);
    }
    try {
      const members = await gameApi.getPartySessionMembers(partyId);
      setSessionMembers((prev) => {
        if (areSessionMembersEqual(prev, members)) {
          return prev;
        }
        return members;
      });
    } catch (e) {
      console.error('Failed to load session members:', e);
    } finally {
      if (!isSilent) {
        setIsMembersLoading(false);
      }
    }
  };

  const loadPartyMonsters = async (partyId: string) => {
    try {
      const activeList = await gameApi.getPartyMonsters(partyId);
      if (Array.isArray(activeList)) {
        setMonsters(sortMonstersByPreset(activeList, monsterPreset));
      }
    } catch (e) {
      console.error('Failed to load party monsters:', e);
    }
  };

  const handleSaveMonsters = async (updated: ParsedMonster[], presetOverride?: MonsterSortPreset) => {
    const activePreset = presetOverride || monsterPreset;
    const sorted = sortMonstersByPreset(updated, activePreset);
    setMonsters(sorted);
    if (selectedParty) {
      await gameApi.savePartyMonsters(selectedParty.id, sorted);
    } else {
      localStorage.setItem('supaflex_gm_monster_stats', JSON.stringify(sorted));
    }
  };

  const applyMonsterPreset = (preset: MonsterSortPreset) => {
    setMonsterPreset(preset);
    try {
      localStorage.setItem(`supaflex_gm_monster_preset_${selectedParty?.id || 'default'}`, preset);
    } catch (e) {}
    handleSaveMonsters(monsters, preset);
  };

  const handleAddQuickMonster = async () => {
    const nameStr = quickAdd.name.trim() || 'Custom';
    const gearStr = quickAdd.gear.trim() ? ` (${quickAdd.gear.trim()})` : '';
    const abStr = quickAdd.abilities.trim() ? ` (${quickAdd.abilities.trim()})` : '';

    const fullStatStr = `${nameStr}${gearStr} 🚩${quickAdd.init}, 👣${quickAdd.mr}, ⚔️${quickAdd.atk}/${quickAdd.dmg}(${quickAdd.wounds}), 🧥${quickAdd.def}/${quickAdd.armor}, ❤️${quickAdd.vit} – [✨${quickAdd.magic} / 💪${quickAdd.might} / 👁️${quickAdd.mind} / 🏃${quickAdd.motion} / 🫀${quickAdd.moxie}]${abStr}`;

    const parsed = parseMonsterLine(fullStatStr);
    const updated = [...monsters, parsed];
    setQuickAdd(DEFAULT_QUICK_ADD);
    await handleSaveMonsters(updated);
  };

  const handleParseAndAddPasteBlock = async () => {
    if (!pasteInputText.trim()) return;
    const parsedList = parseMultiRowMonsterBlock(pasteInputText);
    const updated = [...monsters, ...parsedList];
    setPasteInputText('');
    setIsPasteModalOpen(false);
    await handleSaveMonsters(updated);
  };

  const handleDeleteMonster = async (id: string) => {
    const updated = monsters.filter((m) => m.id !== id);
    await handleSaveMonsters(updated);
  };

  const handleStartEdit = (m: ParsedMonster) => {
    setEditingId(m.id);
    setEditText(m.fullText);
  };

  const handleSaveEdit = async (id: string) => {
    const updated = monsters.map((m) => {
      if (m.id === id) {
        return parseMonsterLine(editText);
      }
      return m;
    });
    setEditingId(null);
    setEditText('');
    await handleSaveMonsters(updated);
  };

  const formatStatWithIcon = (icon: string, val: string | undefined, defaultVal: string, iconRegex?: RegExp): string => {
    if (!val) return `${icon}${defaultVal}`;
    const trimmed = val.trim();
    const pattern = iconRegex || new RegExp(`^${icon}`, 'u');
    if (pattern.test(trimmed)) {
      return trimmed;
    }
    return `${icon}${trimmed}`;
  };

  const [isLoadingCodex, setIsLoadingCodex] = useState(false);

  const handleOpenCodex = async () => {
    setIsCodexOpen(true);
    setIsLoadingCodex(true);
    try {
      const list = await gameApi.getSupabaseMonsters();
      setSupabaseMonsters(list);
    } catch (e) {
      console.error('[GmWorkspaceView] Failed to fetch live Supabase monsters:', e);
    } finally {
      setIsLoadingCodex(false);
    }
  };

  const formatCanonicalAttributes = (rawAttr: string | undefined): string => {
    if (!rawAttr) return '✨10 / 💪10 / 👁️10 / 🏃10 / 🫀10';

    const magicMatch = rawAttr.match(/✨\s*(\d+)/u);
    const mightMatch = rawAttr.match(/💪\s*(\d+)/u);
    const mindMatch = rawAttr.match(/👁️\s*(\d+)/u);
    const motionMatch = rawAttr.match(/🏃\s*(\d+)/u);
    const moxieMatch = rawAttr.match(/(?:🫀|💖)\s*(\d+)/u);

    if (magicMatch || mightMatch || mindMatch || motionMatch || moxieMatch) {
      const magic = magicMatch ? magicMatch[1] : '10';
      const might = mightMatch ? mightMatch[1] : '10';
      const mind = mindMatch ? mindMatch[1] : '10';
      const motion = motionMatch ? motionMatch[1] : '10';
      const moxie = moxieMatch ? moxieMatch[1] : '10';
      return `✨${magic} / 💪${might} / 👁️${mind} / 🏃${motion} / 🫀${moxie}`;
    }

    const nums = rawAttr.match(/\d+/g) || [];
    if (nums.length >= 5) {
      const might = nums[0];
      const motion = nums[1];
      const mind = nums[2];
      const magic = nums[3];
      const moxie = nums[4];
      return `✨${magic} / 💪${might} / 👁️${mind} / 🏃${motion} / 🫀${moxie}`;
    }

    return '✨10 / 💪10 / 👁️10 / 🏃10 / 🫀10';
  };

  const handleAddCodexMonster = async (rawMonster: SupabaseMonster) => {
    const init = formatStatWithIcon('🚩', rawMonster.nish, '10');
    const mr = formatStatWithIcon('👣', rawMonster.mr, '10');
    const atk = formatStatWithIcon('⚔️', rawMonster.atk_dmg_ftg, '10/5(1)', /^(?:⚔️|⚔)/u);
    const def = formatStatWithIcon('🧥', rawMonster.dod_ar, '10/1', /^(?:🧥|🛡️)/u);
    const vit = formatStatWithIcon('❤️', rawMonster.vit, '10');
    const attrStr = ` – [${formatCanonicalAttributes(rawMonster.attributes)}]`;
    const abStr = rawMonster.abilities ? ` (${rawMonster.abilities})` : '';

    const fullStatStr = `${rawMonster.name || 'Monster'} ${init}, ${mr}, ${atk}, ${def}, ${vit}${attrStr}${abStr}`;
    const parsed = parseMonsterLine(fullStatStr);
    const updated = [...monsters, parsed];
    await handleSaveMonsters(updated);
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
    <div className="space-y-6 max-w-[2500px] mx-auto">
      {/* Main Grid: Party Roster (Left) vs Monster Roster (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Party Roster (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col">
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
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/80">
              Live Session
            </span>
          </div>

          {!selectedParty ? (
            <div className="text-xs font-medium text-slate-400 italic p-6 bg-slate-950/70 rounded-xl border border-slate-800 text-center">
              Initializing GM Screen...
            </div>
          ) : isMembersLoading ? (
            <div className="text-xs text-slate-400 italic text-center py-6">Loading party members...</div>
          ) : orderedSessionMembers.length === 0 ? (
            <div className="text-xs font-medium text-slate-400 italic p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-center space-y-1">
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

        {/* Right Column: Monster Roster (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-outfit">
                <span>🐉</span> MONSTER TRACKER ({monsters.length})
              </h3>
              {monsters.length > 1 && (
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsPasteModalOpen(true)}
                className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900/90 border border-amber-600/50 text-amber-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>📋</span> Paste Statblock
              </button>
              <button
                onClick={handleOpenCodex}
                className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900/90 border border-indigo-600/50 text-indigo-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
              >
                <span>📚</span> Pick Codex Monster
              </button>
              {monsters.length > 0 && (
                <button
                  onClick={() => handleSaveMonsters([])}
                  className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl transition-all"
                  title="Clear all active monsters"
                >
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>

          {/* Quick Structured Add Bar */}
          <div className="bg-slate-950/90 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono text-slate-200 shadow-inner">
            {/* Header Title */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider font-outfit flex items-center gap-1.5">
                <span>⚡</span> Quick Add Monster
              </span>
            </div>

            {/* Row 1: Name, Gear & Combat Stats */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-slate-400 font-sans font-bold text-[11px]">Name:</span>
              <input
                type="text"
                value={quickAdd.name}
                onChange={(e) => handleTextChange('name', e.target.value)}
                placeholder="Name"
                className="w-28 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-amber-300 font-bold focus:outline-none focus:border-amber-500/80"
              />

              <span className="text-slate-400 font-sans font-bold text-[11px]">Gear:</span>
              <input
                type="text"
                value={quickAdd.gear}
                onChange={(e) => handleTextChange('gear', e.target.value)}
                placeholder="Optional"
                className="w-28 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-300 focus:outline-none focus:border-indigo-500/80"
              />

              <span className="flex items-center gap-1">
                🚩
                <input
                  type="number"
                  min="0"
                  value={quickAdd.init}
                  onChange={(e) => handleNumChange('init', e.target.value)}
                  className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
              </span>

              <span className="flex items-center gap-1">
                👣
                <input
                  type="number"
                  min="0"
                  value={quickAdd.mr}
                  onChange={(e) => handleNumChange('mr', e.target.value)}
                  className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
              </span>

              <span className="flex items-center gap-0.5">
                ⚔️
                <input
                  type="number"
                  min="0"
                  value={quickAdd.atk}
                  onChange={(e) => handleNumChange('atk', e.target.value)}
                  className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
                /
                <input
                  type="number"
                  min="0"
                  value={quickAdd.dmg}
                  onChange={(e) => handleNumChange('dmg', e.target.value)}
                  className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
                (
                <input
                  type="number"
                  min="0"
                  value={quickAdd.wounds}
                  onChange={(e) => handleNumChange('wounds', e.target.value)}
                  className="w-9 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
                )
              </span>

              <span className="flex items-center gap-0.5">
                🧥
                <input
                  type="number"
                  min="0"
                  value={quickAdd.def}
                  onChange={(e) => handleNumChange('def', e.target.value)}
                  className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
                /
                <input
                  type="number"
                  min="0"
                  value={quickAdd.armor}
                  onChange={(e) => handleNumChange('armor', e.target.value)}
                  className="w-9 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
              </span>

              <span className="flex items-center gap-1">
                ❤️
                <input
                  type="number"
                  min="0"
                  value={quickAdd.vit}
                  onChange={(e) => handleNumChange('vit', e.target.value)}
                  className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center focus:outline-none focus:border-amber-500/80"
                />
              </span>
            </div>

            {/* Row 2: System Attributes, Abilities & + Add Button */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-1 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex items-center gap-0.5 text-amber-200/90 font-semibold">
                  – [✨
                  <input
                    type="number"
                    min="0"
                    value={quickAdd.magic}
                    onChange={(e) => handleNumChange('magic', e.target.value)}
                    className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center text-slate-200 focus:outline-none focus:border-amber-500/80"
                  />
                  /💪
                  <input
                    type="number"
                    min="0"
                    value={quickAdd.might}
                    onChange={(e) => handleNumChange('might', e.target.value)}
                    className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center text-slate-200 focus:outline-none focus:border-amber-500/80"
                  />
                  /👁️
                  <input
                    type="number"
                    min="0"
                    value={quickAdd.mind}
                    onChange={(e) => handleNumChange('mind', e.target.value)}
                    className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center text-slate-200 focus:outline-none focus:border-amber-500/80"
                  />
                  /🏃
                  <input
                    type="number"
                    min="0"
                    value={quickAdd.motion}
                    onChange={(e) => handleNumChange('motion', e.target.value)}
                    className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center text-slate-200 focus:outline-none focus:border-amber-500/80"
                  />
                  /🫀
                  <input
                    type="number"
                    min="0"
                    value={quickAdd.moxie}
                    onChange={(e) => handleNumChange('moxie', e.target.value)}
                    className="w-11 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-center text-slate-200 focus:outline-none focus:border-amber-500/80"
                  />
                  ]
                </span>

                <span className="text-slate-400 font-sans font-bold text-[11px]">Abilities:</span>
                <input
                  type="text"
                  value={quickAdd.abilities}
                  onChange={(e) => handleTextChange('abilities', e.target.value)}
                  placeholder="Optional (e.g. Cleave, Poison)"
                  className="w-56 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-300 italic focus:outline-none focus:border-indigo-500/80"
                />
              </div>

              <button
                onClick={handleAddQuickMonster}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1"
              >
                <span>+</span> Add Monster
              </button>
            </div>
          </div>

          {/* Monster List View */}
          {monsters.length === 0 ? (
            <div className="text-xs font-medium text-slate-400 italic p-8 bg-slate-950/60 rounded-xl border border-slate-800 text-center space-y-2">
              <div>No monsters in active roster.</div>
              <div className="text-[11px] text-slate-500">
                Use "Paste Statblock" or "Pick Codex Monster" to populate the live GM feed for your party.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto max-h-[600px] pr-1">
              {monsters.map((m) =>
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
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded"
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

      {/* Paste Multi-Row Statblock Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider font-outfit flex items-center gap-2">
                <span>📋</span> Paste Multi-Row Monster Statblock
              </h3>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste raw text from rules or custom statblocks below. Each row will be automatically parsed into GM full view and stripped for the Player reduced view.
            </p>

            <textarea
              rows={6}
              value={pasteInputText}
              onChange={(e) => setPasteInputText(e.target.value)}
              placeholder={`3 Can Clan Cutthroats (Light Leather, Daggers) 🚩14 👣12 ⚔16/10(2) 🧥14/1 ❤️10 – [✨10/💪14/👁️12/🏃14/🫀10] (Bleed: on crit, foe takes 1d4 extra dmg).\n2 Hired Thugs (Chain Vests, Clubs) 🚩12 👣10 ⚔15/12(2) 🧥14/2 ❤️12 – [✨10/💪16/👁️10/🏃12/🫀10] (Reckless Swing: dmg+2, Def–2 that rnd).`}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/80 placeholder-slate-600"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleParseAndAddPasteBlock}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow"
              >
                Parse & Add to Roster
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Monster Codex Picker Modal */}
      {isCodexOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-5 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-outfit flex items-center gap-2">
                <span>📚</span> Pick from Supabase Monster Codex
              </h3>
              <button
                onClick={() => setIsCodexOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={codexSearch}
              onChange={(e) => setCodexSearch(e.target.value)}
              placeholder="Search monsters by name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/80"
            />

            {isLoadingCodex ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs font-semibold text-slate-400 italic">
                Loading live Supabase Monster Codex...
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {supabaseMonsters
                  .filter((m) => !codexSearch || m.name?.toLowerCase().includes(codexSearch.toLowerCase()))
                  .map((m) => (
                    <div
                      key={m.id || m.name}
                      className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-indigo-500/50 transition-all"
                    >
                      <div>
                        <div className="font-bold text-xs text-amber-300">{m.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                          <span>{formatStatWithIcon('🚩', m.nish, '10')}</span>
                          <span>{formatStatWithIcon('👣', m.mr, '10')}</span>
                          <span>{formatStatWithIcon('⚔️', m.atk_dmg_ftg, '10/5(1)', /^(?:⚔️|⚔)/u)}</span>
                          <span>{formatStatWithIcon('🧥', m.dod_ar, '10/1', /^(?:🧥|🛡️)/u)}</span>
                          <span>{formatStatWithIcon('❤️', m.vit, '10')}</span>
                          <span className="text-amber-200/90 font-semibold">– [{formatCanonicalAttributes(m.attributes)}]</span>
                          {m.abilities && <span className="italic text-slate-400 font-sans">({m.abilities})</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddCodexMonster(m)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsCodexOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
