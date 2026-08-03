// src/components/directory/GmWorkspaceView.tsx
// Game Master Command Console: Party Roster, Party Management & Monster Roster View

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Party, PartySessionMember } from '../../types/game';
import { parseMonsterLine, parseMultiRowMonsterBlock, ParsedMonster } from '../../utils/monsterStatParser';

interface GmWorkspaceViewProps {
  activeParty: Party | null;
  currentEmail: string;
  onOpenLaunchHub?: () => void;
  onSelectActiveParty?: (party: Party) => void;
}

export const GmWorkspaceView: React.FC<GmWorkspaceViewProps> = ({
  activeParty: propActiveParty,
  currentEmail,
  onSelectActiveParty,
}) => {
  // GM Party State
  const [selectedParty, setSelectedParty] = useState<Party | null>(propActiveParty);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Party Session Roster State
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);

  // Monster Roster State
  const [monsters, setMonsters] = useState<ParsedMonster[]>([]);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteInputText, setPasteInputText] = useState('');
  const [isCodexOpen, setIsCodexOpen] = useState(false);
  const [supabaseMonsters, setSupabaseMonsters] = useState<any[]>([]);
  const [codexSearch, setCodexSearch] = useState('');

  // Inline Quick Add State
  const [quickAddText, setQuickAddText] = useState('');

  // Editing Monster State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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
        setActiveRoomCode(roomCode);
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
      setActiveRoomCode(null);
    };
  }, [selectedParty?.id]);

  const handleResetRoomCode = async () => {
    if (!selectedParty?.id) return;
    try {
      const { roomCode } = await gameApi.checkoutPartyRoomCode(selectedParty.id);
      setActiveRoomCode(roomCode);
    } catch (err) {
      console.error('Failed to reset room code:', err);
    }
  };

  const handleCopyRoomCode = () => {
    if (!activeRoomCode) return;
    navigator.clipboard.writeText(activeRoomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Load Session Members & Active Monsters on Selected Party Change
  useEffect(() => {
    if (!selectedParty) return;

    loadSessionMembers(selectedParty.id);
    loadPartyMonsters(selectedParty.id);

    // Subscribe to Party Session Members changes
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
          loadSessionMembers(selectedParty.id);
        }
      )
      .subscribe();

    // Subscribe to Realtime Monster updates
    const monsterChannel = supabase
      .channel(`party:${selectedParty.id}`)
      .on('broadcast', { event: 'monster_roster_updated' }, (payload) => {
        if (payload?.payload?.monsters) {
          setMonsters(payload.payload.monsters);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(membersChannel);
      supabase.removeChannel(monsterChannel);
    };
  }, [selectedParty?.id]);

  const loadSessionMembers = async (partyId: string) => {
    setIsMembersLoading(true);
    try {
      const members = await gameApi.getPartySessionMembers(partyId);
      setSessionMembers(members);
    } catch (e) {
      console.error('Failed to load session members:', e);
    } finally {
      setIsMembersLoading(false);
    }
  };

  const loadPartyMonsters = async (partyId: string) => {
    try {
      const activeList = await gameApi.getPartyMonsters(partyId);
      if (Array.isArray(activeList)) {
        setMonsters(activeList);
      }
    } catch (e) {
      console.error('Failed to load party monsters:', e);
    }
  };

  const handleSaveMonsters = async (updated: ParsedMonster[]) => {
    setMonsters(updated);
    if (selectedParty) {
      await gameApi.savePartyMonsters(selectedParty.id, updated);
    } else {
      localStorage.setItem('supaflex_gm_monster_stats', JSON.stringify(updated));
    }
  };

  const handleAddQuickMonster = async () => {
    if (!quickAddText.trim()) return;
    const parsed = parseMonsterLine(quickAddText.trim());
    const updated = [...monsters, parsed];
    setQuickAddText('');
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

  const handleOpenCodex = async () => {
    setIsCodexOpen(true);
    if (supabaseMonsters.length === 0) {
      const list = await gameApi.getSupabaseMonsters();
      setSupabaseMonsters(list);
    }
  };

  const handleAddCodexMonster = async (rawMonster: any) => {
    const fullStatStr = `${rawMonster.name || 'Monster'} 🚩${rawMonster.init || 10} 👣${
      rawMonster.mv || 10
    } ⚔️${rawMonster.atk || '10/5(1)'} 🧥${rawMonster.ar || '10/1'} ❤️${rawMonster.hp || 10}`;
    const parsed = parseMonsterLine(fullStatStr);
    const updated = [...monsters, parsed];
    await handleSaveMonsters(updated);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/90 border border-amber-500/30 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-400 shadow-inner">
            👑
          </div>
          <div>
            <h1 className="text-xl font-black text-amber-400 uppercase tracking-wider font-outfit">
              GM Screen
            </h1>
          </div>
        </div>

        {/* Active Room ID Badge (High Visibility Monospace Display) */}
        {selectedParty && (
          <div className="flex items-center gap-2 bg-slate-950/90 border border-amber-500/50 px-3.5 py-1.5 rounded-xl shadow-inner">
            <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider font-outfit">
              Party ID:
            </span>
            <span className="font-mono text-base font-black tracking-widest text-amber-300 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-amber-500/40 shadow-sm">
              {activeRoomCode || '....'}
            </span>
            <button
              onClick={handleCopyRoomCode}
              title="Copy Party ID to Clipboard"
              className="p-1 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 rounded transition-all"
            >
              {copiedCode ? '✅' : '📋'}
            </button>
            <button
              onClick={handleResetRoomCode}
              title="Generate New Party ID"
              className="p-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all"
            >
              🔄
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Party Roster (Left) vs Monster Roster (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Party Roster (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-2 font-outfit">
              <span>👥</span> PARTY ROSTER ({sessionMembers.length})
            </h3>
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
          ) : sessionMembers.length === 0 ? (
            <div className="text-xs font-medium text-slate-400 italic p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-center space-y-1">
              <div>No players connected to "{selectedParty.name}" yet.</div>
              <div className="text-[10px] text-slate-500">
                Invited emails: {selectedParty.invited_emails?.join(', ') || 'None'}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1">
              {sessionMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 bg-slate-950/80 border border-slate-800/90 rounded-xl space-y-1.5 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100 font-outfit">
                      {member.character?.name || `Hero #${member.character_id}`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {member.character?.class || 'Adventurer'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{member.player_email}</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Online
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Monster Roster (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-lg flex flex-col">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2 font-outfit">
              <span>👾</span> MONSTER ROSTER ({monsters.length})
            </h3>

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

          {/* Quick Single Line Add Bar */}
          <div className="flex items-center gap-2 bg-slate-950/90 p-2 rounded-xl border border-slate-800">
            <input
              type="text"
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddQuickMonster()}
              placeholder="Quick add: 2 Hired Thugs ⚔15/12(2) 🛡️14/2 ❤️12"
              className="flex-1 bg-transparent border-none text-xs text-slate-100 placeholder-slate-500 focus:outline-none px-2"
            />
            <button
              onClick={handleAddQuickMonster}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all"
            >
              + Add
            </button>
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
            <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
              {monsters.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-all"
                >
                  {editingId === m.id ? (
                    <div className="flex items-center gap-2">
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
                    <>
                      {/* GM View: Full Statblock */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="text-xs font-extrabold text-amber-300 font-mono select-all">
                            <span className="text-[10px] text-amber-500 uppercase font-sans mr-2 px-1.5 py-0.2 bg-amber-950/80 rounded border border-amber-800/80">
                              GM Full
                            </span>
                            {m.fullText}
                          </div>

                          {/* Reduced Player View Preview */}
                          <div className="text-[11px] font-semibold text-slate-400 font-mono select-all">
                            <span className="text-[9px] text-cyan-400 uppercase font-sans mr-2 px-1 py-0.1 bg-cyan-950/80 rounded border border-cyan-800/80">
                              Player View
                            </span>
                            {m.reducedText}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(m)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-xs"
                            title="Edit Monster"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteMonster(m.id)}
                            className="p-1 hover:bg-slate-800 text-rose-400 hover:text-rose-300 rounded text-xs"
                            title="Delete Monster"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
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
              placeholder={`3 Can Clan Cutthroats (Light Leather, Daggers) 🚩14 👣12 ⚔16/10(2) 🛡️14/1 ❤️10 – [💪14/🏃14/👁️12/✨10] (Bleed: on crit, foe takes 1d4 extra dmg).\n2 Hired Thugs (Chain Vests, Clubs) 🚩12 👣10 ⚔15/12(2) 🛡️14/2 ❤️12 – [💪16/🏃12/👁️10/✨10] (Reckless Swing: dmg+2, Def–2 that rnd).`}
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

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {supabaseMonsters
                .filter((m) => !codexSearch || m.name?.toLowerCase().includes(codexSearch.toLowerCase()))
                .map((m) => (
                  <div
                    key={m.id || m.name}
                    className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800/80 rounded-xl hover:border-indigo-500/50 transition-all"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-200">{m.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        ⚔️{m.atk || '10/5'} | 🧥{m.ar || '10/1'} | ❤️{m.hp || 10}
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
