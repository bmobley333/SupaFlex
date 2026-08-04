// src/components/hud/PartyRosterHud.tsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Character, PartySessionMember } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';
import { PartyCharacterCard } from '../common/PartyCharacterCard';

interface PartyRosterHudProps {
  activeCharacter: Character | null;
  playerEmail: string;
  onOpenPartySelector?: () => void;
}

export const PartyRosterHud: React.FC<PartyRosterHudProps> = ({
  activeCharacter,
  playerEmail,
  onOpenPartySelector,
}) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);

  useEffect(() => {
    if (!activePartyId) {
      setSessionMembers([]);
      return;
    }

    const loadMembers = async () => {
      try {
        const members = await gameApi.getPartySessionMembers(activePartyId);
        setSessionMembers(members);
      } catch (err) {
        console.error('[PartyRosterHud] Failed to load session members:', err);
      }
    };

    loadMembers();

    // Subscribe to Realtime CDC & Broadcast for active party members
    const cdcChannel = supabase
      .channel(`roster_cdc_${activePartyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_session_members',
          filter: `party_id=eq.${activePartyId}`,
        },
        () => {
          loadMembers();
        }
      )
      .subscribe();

    const broadcastChannel = supabase
      .channel(`party:${activePartyId}`)
      .on('broadcast', { event: 'party_members_updated' }, () => {
        loadMembers();
      })
      .subscribe();

    const pollInterval = setInterval(() => {
      loadMembers();
    }, 5000);

    return () => {
      supabase.removeChannel(cdcChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(pollInterval);
    };
  }, [activePartyId]);

  // Filter out current user's active character ($N - 1$)
  const otherMembers = sessionMembers.filter((m) => {
    const isSameEmail = m.player_email?.toLowerCase().trim() === playerEmail?.toLowerCase().trim();
    const isSameChar = activeCharacter && m.character_id === activeCharacter.id;
    return !isSameEmail && !isSameChar;
  });

  return (
    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800/90 shadow-sm space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
          <span>👥</span> PARTY ROSTER ({otherMembers.length})
        </h3>

        {/* Interactive Manage Party Pill (Replaces static Party Session badge) */}
        <button
          onClick={onOpenPartySelector}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border shadow-sm cursor-pointer ${
            activePartyId
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200 hover:border-cyan-400 shadow-cyan-950/40'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Click to manage active party session or join a new party"
        >
          <Users className={`w-3.5 h-3.5 ${activePartyId ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="font-outfit font-bold uppercase text-[11px]">Manage Party:</span>
          <span className="font-mono font-extrabold text-xs">
            {activePartyId || '----'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-0.5" />
        </button>
      </div>

      {/* Roster Cards List */}
      {otherMembers.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
          No other party members in session.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {otherMembers.map((member, idx) => (
            <PartyCharacterCard key={member.id || member.character_id || `pm_${idx}`} member={member} />
          ))}
        </div>
      )}
    </div>
  );
};
