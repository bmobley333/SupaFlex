// src/components/modals/PartyManagerModal.tsx
import React, { useState, useEffect } from 'react';
import { gameApi } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { Character, Party, PartySessionMember } from '../../types/game';

interface PartyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string | null;
  userCharacters: Character[];
  tabSessionId: string;
}

export const PartyManagerModal: React.FC<PartyManagerModalProps> = ({
  isOpen,
  onClose,
  currentEmail,
  userCharacters,
  tabSessionId,
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [activeCharId, setActiveCharId] = useState<number | null>(null);

  // New Party Form
  const [newPartyName, setNewPartyName] = useState('');
  const [invitedEmails, setInvitedEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentEmail) {
      loadParties();
    }
  }, [isOpen, currentEmail]);

  useEffect(() => {
    if (!selectedParty) return;

    loadSessionMembers(selectedParty.id);

    // Real-time subscription to party_session_members changes
    const channel = supabase
      .channel(`party:${selectedParty.id}`)
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedParty]);

  const loadParties = async () => {
    if (!currentEmail) return;
    try {
      const data = await gameApi.getPartiesForUser(currentEmail);
      setParties(data as Party[]);
      if (data.length > 0 && !selectedParty) {
        setSelectedParty(data[0] as Party);
      }
    } catch (err) {
      console.error('Error loading parties:', err);
    }
  };

  const loadSessionMembers = async (partyId: string) => {
    try {
      const members = await gameApi.getPartySessionMembers(partyId);
      setSessionMembers(members as PartySessionMember[]);
    } catch (err) {
      console.error('Error loading session members:', err);
    }
  };

  if (!isOpen) return null;

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const emailList = invitedEmails.split(',').map((e) => e.trim()).filter(Boolean);
      const newParty = await gameApi.createParty(newPartyName, currentEmail, emailList);
      setSuccessMsg(`Party '${newPartyName}' created successfully!`);
      setNewPartyName('');
      setInvitedEmails('');
      await loadParties();
      setSelectedParty(newParty as Party);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create party.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinParty = async () => {
    if (!selectedParty || !currentEmail || !activeCharId) return;

    setErrorMsg(null);
    try {
      await gameApi.joinPartySession(selectedParty.id, currentEmail, activeCharId, tabSessionId);
      setSuccessMsg('Joined party in this browser tab!');
      await loadSessionMembers(selectedParty.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join party.');
    }
  };

  const handleLeaveParty = async () => {
    if (!selectedParty) return;
    try {
      await gameApi.leavePartySession(tabSessionId);
      await loadSessionMembers(selectedParty.id);
      setSuccessMsg('Left party session for this browser tab.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to leave party.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 relative max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2 mb-2">
          ⚔️ Party Management & Sessions
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Group players into Parties and join active sessions per browser tab.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/60 border border-red-500/50 rounded text-red-200 text-sm">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-900/60 border border-emerald-500/50 rounded text-emerald-200 text-sm font-semibold">
            {successMsg}
          </div>
        )}

        {!currentEmail ? (
          <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-300 font-semibold mb-2">Please sign in to manage or join parties.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1">
            {/* Left Column: Party Creation & List */}
            <div className="space-y-4">
              <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                  👑 Create New Party (GM)
                </h3>
                <form onSubmit={handleCreateParty} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Party Name</label>
                    <input
                      type="text"
                      required
                      value={newPartyName}
                      onChange={(e) => setNewPartyName(e.target.value)}
                      placeholder="e.g. Friday Dungeon Crawl"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Player Emails (Comma Separated)
                    </label>
                    <input
                      type="text"
                      value={invitedEmails}
                      onChange={(e) => setInvitedEmails(e.target.value)}
                      placeholder="playerA@gmail.com, playerB@gmail.com"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-sm text-slate-100"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 text-slate-950 font-bold text-xs rounded transition"
                  >
                    {loading ? 'Creating...' : 'Create Party'}
                  </button>
                </form>
              </div>

              {/* Active Parties List */}
              <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 space-y-2">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Your Parties</h3>
                {parties.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No parties found.</p>
                ) : (
                  <div className="space-y-1.5">
                    {parties.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedParty(p)}
                        className={`w-full text-left p-2.5 rounded border transition flex justify-between items-center text-xs ${
                          selectedParty?.id === p.id
                            ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-400">GM: {p.gm_email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Tab Join & Active Roster */}
            <div className="space-y-4">
              {selectedParty ? (
                <>
                  <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 space-y-3">
                    <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                      Join '{selectedParty.name}' (This Tab)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Select which of your characters joins the party session in this browser tab.
                    </p>

                    <div className="space-y-2">
                      <select
                        value={activeCharId || ''}
                        onChange={(e) => setActiveCharId(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100"
                      >
                        <option value="">-- Select Character --</option>
                        {userCharacters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Lvl {c.sheet_data?.level || 1})
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-2">
                        <button
                          onClick={handleJoinParty}
                          disabled={!activeCharId}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded transition"
                        >
                          Join Party Session
                        </button>

                        <button
                          onClick={handleLeaveParty}
                          className="px-3 py-2 bg-red-800/80 hover:bg-red-700 text-white font-semibold text-xs rounded transition"
                        >
                          Leave Session
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Active Session Roster */}
                  <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700 space-y-3">
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex justify-between items-center">
                      <span>Active Party Roster</span>
                      <span className="text-xs text-emerald-400 font-normal">● Live ({sessionMembers.length})</span>
                    </h3>

                    {sessionMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No characters currently active in party session.</p>
                    ) : (
                      <div className="space-y-2">
                        {sessionMembers.map((m) => (
                          <div
                            key={m.id}
                            className={`p-2.5 rounded border flex justify-between items-center text-xs ${
                              m.tab_session_id === tabSessionId
                                ? 'bg-amber-950/60 border-amber-600/80 text-amber-200'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-100 flex items-center gap-1.5">
                                🛡️ {m.character?.name || `Character #${m.character_id}`}
                                {m.tab_session_id === tabSessionId && (
                                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-950 px-1.5 py-0.2 rounded border border-amber-700">
                                    This Tab
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">Player: {m.player_email}</div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                                Might {m.character?.might || 'd6'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-slate-400 text-xs">Select or create a party on the left to manage sessions.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
