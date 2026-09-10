// src/components/modals/CharacterPartyModal.tsx
// Dedicated per-character tabletop party session modal.
// Triggered directly from the Character Sheet Party Roster header.

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Character, Party, PartySessionMember } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';
import { sanitizeRoomCodeInput, isValidRoomCodeFormat } from '../../utils/roomId';
import { resolveCharFirstName, resolvePlayerFirstName } from '../common/PartyCharacterCard';
import { Users, LogOut, Copy, Check, ShieldAlert, Sparkles, X } from 'lucide-react';

interface CharacterPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCharacter: Character | null;
  tabSessionId: string;
  currentEmail: string | null;
  onPartyChanged?: () => void;
}

export const CharacterPartyModal: React.FC<CharacterPartyModalProps> = ({
  isOpen,
  onClose,
  activeCharacter,
  tabSessionId,
  currentEmail,
  onPartyChanged,
}) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const setActivePartyId = useCharacterStore((state) => state.setActivePartyId);

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeParty, setActiveParty] = useState<Party | null>(null);
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened and not connected
  useEffect(() => {
    if (isOpen && !activePartyId) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, activePartyId]);

  // Load active party details and session members when joined
  useEffect(() => {
    if (!isOpen || !activePartyId) {
      setActiveParty(null);
      setSessionMembers([]);
      return;
    }

    let isMounted = true;

    const loadPartyDetails = async () => {
      try {
        const { data: p } = await supabase
          .from('parties')
          .select('*')
          .eq('id', activePartyId)
          .maybeSingle();

        if (isMounted && p) {
          setActiveParty(p as Party);
        }

        const members = await gameApi.getPartySessionMembers(activePartyId);
        if (isMounted) {
          setSessionMembers(members);
        }
      } catch (err) {
        console.error('[CharacterPartyModal] Error loading party details:', err);
      }
    };

    loadPartyDetails();

    // Subscribe to realtime roster updates
    const cdcChannel = supabase.channel(`modal_roster_cdc_${activePartyId}`);
    cdcChannel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'party_session_members' },
        () => loadPartyDetails()
      )
      .subscribe();

    const broadcastChannel = supabase.channel(`party:${activePartyId}`);
    broadcastChannel
      .on('broadcast', { event: 'party_members_updated' }, () => loadPartyDetails())
      .on('broadcast', { event: 'party.joined' }, () => loadPartyDetails())
      .on('broadcast', { event: 'party.left' }, () => loadPartyDetails())
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(cdcChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [isOpen, activePartyId]);

  if (!isOpen) return null;

  const charName = activeCharacter?.name || 'Your Hero';
  const charFirstName = resolveCharFirstName(charName);
  const activeCode = activeParty?.room_code || activeParty?.party_code || (activePartyId ? activePartyId.slice(0, 4).toUpperCase() : '');

  const handleCopyCode = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleJoinParty = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeCharacter?.id) {
      setErrorMsg('No active character selected for this tab.');
      return;
    }

    const sanitized = sanitizeRoomCodeInput(roomCodeInput);
    if (!isValidRoomCodeFormat(sanitized)) {
      setErrorMsg('Please enter a valid 4-character Party ID (e.g. ZK35).');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsJoining(true);

    try {
      const email = (currentEmail || 'guest@supaflex.internal').trim().toLowerCase();
      const { party } = await gameApi.joinPartyByRoomCode(sanitized, email, activeCharacter.id, tabSessionId);

      setActivePartyId(party.id);
      setActiveParty(party);
      setSuccessMsg(`Successfully joined party "${party.name}" (ID: ${sanitized}) as ${charFirstName}!`);
      setRoomCodeInput('');
      if (onPartyChanged) onPartyChanged();
    } catch (err: any) {
      console.error('[CharacterPartyModal] Error joining party:', err);
      setErrorMsg(err.message || 'Failed to join party room.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveParty = async () => {
    if (!activePartyId) return;

    setIsLeaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await gameApi.leavePartySession(tabSessionId, activePartyId);
      setActivePartyId(null);
      setActiveParty(null);
      setSessionMembers([]);
      setSuccessMsg(`Disconnected ${charFirstName} from party session.`);
      if (onPartyChanged) onPartyChanged();
    } catch (err: any) {
      console.error('[CharacterPartyModal] Error leaving party:', err);
      setErrorMsg('Failed to leave party cleanly.');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn font-outfit">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-md w-full shadow-2xl text-slate-100 flex flex-col overflow-hidden border-t-2 border-t-cyan-500/90">
        {/* Header */}
        <div className="bg-slate-900/95 border-b border-slate-800 px-5 py-3.5 flex items-start justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-base font-extrabold text-cyan-300 flex items-center gap-2 font-outfit tracking-wide">
              <Users className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Party Session — {charFirstName}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live tabletop session connection for this browser tab
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Notifications */}
          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ACTIVE SESSION STATE */}
          {activePartyId ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Active Session Card */}
              <div className="p-4 bg-slate-950/90 border border-cyan-500/40 rounded-xl space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
                      Connected to Party
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 truncate max-w-[160px]" title={activeParty?.name || ''}>
                    {activeParty?.name || 'Active Campaign'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Party ID:</span>
                    <span className="font-mono text-base font-black tracking-widest text-amber-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-500/50 shadow-sm">
                      {activeCode || '....'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                      title="Copy Party ID to Clipboard"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLeaveParty}
                    disabled={isLeaving}
                    className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-500/50 hover:border-red-400 text-red-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                    title="Leave party session"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-400" />
                    <span>{isLeaving ? 'Leaving...' : 'Leave Party'}</span>
                  </button>
                </div>
              </div>

              {/* Connected Roster Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Connected Heroes</span>
                    <span className="text-emerald-400 font-extrabold font-mono">
                      ● LIVE ({sessionMembers.length})
                    </span>
                  </h4>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {sessionMembers.length === 0 ? (
                    <div className="text-xs text-slate-500 italic p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-center">
                      Loading session members...
                    </div>
                  ) : (
                    sessionMembers.map((m) => {
                      const isThisTab = m.tab_session_id === tabSessionId;
                      const memberCharName = m.character?.name || `Hero #${m.character_id}`;
                      const memberPlayer = resolvePlayerFirstName(m.player_first_name) !== 'empty'
                        ? resolvePlayerFirstName(m.player_first_name)
                        : (m.player_email?.split('@')[0] || 'Player');

                      return (
                        <div
                          key={m.id || m.character_id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            isThisTab
                              ? 'bg-cyan-950/30 border-cyan-500/50 shadow-sm'
                              : 'bg-slate-950/70 border-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                            <span className="font-extrabold text-slate-100 truncate">
                              {memberCharName}
                            </span>
                            {isThisTab && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shrink-0">
                                This Tab
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400 shrink-0 ml-2">
                            ({memberPlayer})
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* NOT CONNECTED: JOIN PARTY FORM */
            <form onSubmit={handleJoinParty} className="space-y-4 animate-fadeIn">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <label className="block text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                  Enter 4-Character Party ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    maxLength={4}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="ZK35"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-base font-black text-center tracking-widest text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 uppercase transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isJoining || roomCodeInput.length !== 4}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>{isJoining ? 'Joining...' : 'Join Party'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Enter the 4-character Party ID from your GM to connect <span className="text-amber-300 font-bold">{charFirstName}</span> to the live combat roster and monster tracker.
                </p>
              </div>

              {/* Multi-Tab Info Card */}
              <div className="p-3 bg-slate-950/40 border border-slate-800/60 rounded-xl text-[11px] text-slate-400 space-y-1 leading-relaxed">
                <div className="font-bold text-slate-300 flex items-center gap-1.5">
                  <span>💡</span> Multi-Character & Multi-Tab Support
                </div>
                <div>
                  Each browser tab is an independent tabletop session. You can open multiple tabs under your Google account to run multiple heroes in the same party or test encounters!
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950/80 border-t border-slate-800/80 px-5 py-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
