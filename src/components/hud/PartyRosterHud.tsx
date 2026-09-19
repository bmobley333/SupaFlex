// src/components/hud/PartyRosterHud.tsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, Users, ArrowUpDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { gameApi } from '../../services/api';
import { Character, PartySessionMember, CharacterSheetData } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';
import { PartyCharacterCard, resolveCharFirstName } from '../common/PartyCharacterCard';
import { useRosterOrdering } from '../../hooks/useRosterOrdering';

interface PartyRosterHudProps {
  activeCharacter: Character | null;
  playerEmail?: string;
  tabSessionId?: string;
  onOpenPartySelector?: () => void;
}

export const PartyRosterHud: React.FC<PartyRosterHudProps> = ({
  activeCharacter,
  playerEmail: _playerEmail,
  tabSessionId,
  onOpenPartySelector,
}) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const setActivePartyId = useCharacterStore((state) => state.setActivePartyId);
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [markedTurnIds, setMarkedTurnIds] = useState<string[]>([]);
  const [displayRoomCode, setDisplayRoomCode] = useState<string | null>(null);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Fast shallow comparison to prevent unnecessary DOM re-renders and card flickering
  const areMembersEqual = (a: PartySessionMember[], b: PartySessionMember[]) => {
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

  useEffect(() => {
    if (!activePartyId) {
      setSessionMembers([]);
      setMarkedTurnIds([]);
      setDisplayRoomCode(null);
      return;
    }

    const loadMembers = async () => {
      try {
        // 1. Verify that the GM party is still active, has a valid room code, and is not stale (>90s)
        let resolvedPartyId = activePartyId;
        if (activePartyId.length === 4) {
          const p = await gameApi.findActivePartyByRoomCode(activePartyId);
          if (!p) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('supaflex_active_party_id');
            setActivePartyId(null);
            return;
          }
          resolvedPartyId = p.id;
          setDisplayRoomCode(activePartyId.toUpperCase());
        } else {
          const { data: p } = await supabase
            .from('parties')
            .select('room_code, party_code, is_active, status, last_active_at')
            .eq('id', activePartyId)
            .maybeSingle();

          const lastActiveTime = p?.last_active_at ? new Date(p.last_active_at).getTime() : 0;
          const elapsedSeconds = (Date.now() - lastActiveTime) / 1000;
          const isStale = elapsedSeconds > 90;

          if (!p || !p.is_active || p.status === 'expired' || !p.room_code || isStale) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('supaflex_active_party_id');
            setActivePartyId(null);
            return;
          }

          const code = p?.room_code || p?.party_code;
          if (code) {
            setDisplayRoomCode(code.toUpperCase());
          }
        }

        const members = await gameApi.getPartySessionMembers(resolvedPartyId);

        // Verify active session with Supabase and self-heal missing DB session rows
        if (tabSessionId && activeCharacter?.id) {
          const isRegisteredInDb = members.some(
            (m) => m.tab_session_id === tabSessionId || Number(m.character_id) === Number(activeCharacter.id)
          );
          if (!isRegisteredInDb) {
            const playerEmail = useCharacterStore.getState().playerEmail;
            const isValid = await gameApi.ensureTabPartySession(resolvedPartyId, tabSessionId, activeCharacter.id, playerEmail);
            if (!isValid) {
              if (typeof window !== 'undefined') sessionStorage.removeItem('supaflex_active_party_id');
              setActivePartyId(null);
              return;
            }
            const updatedMembers = await gameApi.getPartySessionMembers(resolvedPartyId);
            setSessionMembers((prev) => (areMembersEqual(prev, updatedMembers) ? prev : updatedMembers));
            return;
          }
        }

        setSessionMembers((prev) => (areMembersEqual(prev, members) ? prev : members));
      } catch (err) {
        console.error('[PartyRosterHud] Failed to load session members:', err);
      }
    };

    loadMembers();

    // Subscribe to Realtime CDC strictly for INSERT and DELETE to ignore heartbeat UPDATE thrash
    const cdcChannel = supabase.channel(`roster_cdc_${activePartyId}`);
    cdcChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'party_session_members',
        },
        () => {
          loadMembers();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'party_session_members',
        },
        (payload: any) => {
          if (payload?.old?.tab_session_id === tabSessionId) {
            if (typeof window !== 'undefined') sessionStorage.removeItem('supaflex_active_party_id');
            setActivePartyId(null);
            return;
          }
          loadMembers();
        }
      )
      .subscribe();

    const broadcastChannel = supabase.channel(`party:${activePartyId}`);
    broadcastChannel
      .on('broadcast', { event: 'party.disbanded' }, () => {
        if (typeof window !== 'undefined') sessionStorage.removeItem('supaflex_active_party_id');
        setActivePartyId(null);
      })
      .on('broadcast', { event: 'party.closed' }, () => {
        if (typeof window !== 'undefined') sessionStorage.removeItem('supaflex_active_party_id');
        setActivePartyId(null);
      })
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
          loadMembers();
        }
      })
      .on('broadcast', { event: 'party_turn_marks_updated' }, (payload: any) => {
        const ids = payload?.payload?.markedTurnIds;
        if (Array.isArray(ids)) {
          setMarkedTurnIds(ids);
        }
      })
      .on('broadcast', { event: 'party.joined' }, () => {
        loadMembers();
      })
      .on('broadcast', { event: 'party.left' }, () => {
        loadMembers();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Request current round turn marks from GM
          broadcastChannel.send({
            type: 'broadcast',
            event: 'request_turn_marks',
            payload: { requester: tabSessionId || 'cs' },
          });
        }
      });

    // S-Tier Adaptive Polling: 60s fallback interval, muted when tab is inactive/hidden
    const pollInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        loadMembers();
      }
    }, 60000);

    return () => {
      supabase.removeChannel(cdcChannel);
      supabase.removeChannel(broadcastChannel);
      clearInterval(pollInterval);
    };
  }, [activePartyId, tabSessionId]);

  // Combine all session members with active character reactivity
  const allMembers = React.useMemo(() => {
    let foundSelf = false;
    const mapped = sessionMembers.map((m) => {
      if (activeCharacter && Number(m.character_id) === Number(activeCharacter.id)) {
        foundSelf = true;
        const curVit = activeCharacter.sheet_data?.current_vitality ?? activeCharacter.hp ?? 28;
        const maxVit = activeCharacter.sheet_data?.vitality_max ?? 28;
        const curNish = activeCharacter.sheet_data?.current_nish;
        return {
          ...m,
          character: {
            ...m.character,
            ...activeCharacter,
            current_vitality: curVit,
            vitality_max: maxVit,
            current_nish: curNish,
            sheet_data: {
              ...(m.character?.sheet_data || {}),
              ...(activeCharacter.sheet_data || {}),
              current_vitality: curVit,
              vitality_max: maxVit,
              current_nish: curNish,
            },
          } as any,
        };
      }
      return m;
    });

    // If active character is in a party but DB session member row is still resolving, synthesize self entry
    if (!foundSelf && activeCharacter && activePartyId) {
      const curVit = activeCharacter.sheet_data?.current_vitality ?? activeCharacter.hp ?? 28;
      const maxVit = activeCharacter.sheet_data?.vitality_max ?? 28;
      const curNish = activeCharacter.sheet_data?.current_nish;
      const selfMember: PartySessionMember = {
        id: `self_${activeCharacter.id}`,
        party_id: activePartyId,
        player_email: useCharacterStore.getState().playerEmail,
        character_id: activeCharacter.id,
        tab_session_id: tabSessionId || 'self_tab',
        joined_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        character: {
          ...activeCharacter,
          current_vitality: curVit,
          vitality_max: maxVit,
          current_nish: curNish,
          sheet_data: {
            ...(activeCharacter.sheet_data || {}),
            current_vitality: curVit,
            vitality_max: maxVit,
            current_nish: curNish,
          },
        } as any,
        player_first_name: useCharacterStore.getState().playerName || 'Player',
      };
      return [selfMember, ...mapped];
    }
    return mapped;
  }, [sessionMembers, activeCharacter, activePartyId, tabSessionId]);

  // Custom Local Storage Roster Ordering
  const storageKey = `supaflex_roster_order_${activeCharacter?.id || 'default'}`;
  const {
    orderedItems: orderedMembers,
    moveItem,
    nudgeItem,
    applyPreset,
    activePreset,
    draggedIndex,
    setDraggedIndex,
  } = useRosterOrdering<PartySessionMember>({
    items: allMembers,
    storageKey,
    getId: (m) => String(m.character_id || m.id),
    getName: (m) => resolveCharFirstName(m.character?.name || `Hero #${m.character_id}`),
    getVitPct: (m) => {
      const sheetData: Partial<CharacterSheetData> = m.character?.sheet_data || {};
      const current = (m.character as any)?.current_vitality ?? sheetData.current_vitality ?? m.character?.hp ?? 28;
      const max = (m.character as any)?.vitality_max ?? sheetData.vitality_max ?? 28;
      return max > 0 ? (current / max) * 100 : 0;
    },
    getNish: (m) => {
      const sheetData: Partial<CharacterSheetData> = m.character?.sheet_data || {};
      const nish = sheetData.current_nish ?? (m.character as any)?.current_nish ?? (m.character as any)?.initiative;
      return typeof nish === 'number' ? nish : parseInt(String(nish || 0), 10) || 0;
    },
  });

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    moveItem(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  return (
    <div className="bg-gradient-to-b from-sky-950/30 via-slate-900/90 to-slate-950/95 p-3.5 rounded-2xl border border-slate-800/90 border-t-2 border-t-sky-500/90 shadow-lg shadow-sky-950/20 space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-sky-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-sky-950/90 border border-sky-500/50 text-sky-300 flex items-center justify-center shadow-[0_0_10px_rgba(14,165,233,0.25)]">
            <span className="text-xs leading-none">👥</span>
          </div>
          <h3 className="text-xs font-extrabold text-sky-200 uppercase tracking-wider font-outfit">
            PARTY ROSTER ({orderedMembers.length})
          </h3>

          {/* Quick-Sort Presets Trigger */}
          {orderedMembers.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                className={`p-1 rounded text-xs transition-colors flex items-center gap-1 border ${
                  activePreset !== 'custom'
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Quick Sort Roster Presets"
              >
                <ArrowUpDown className="w-3 h-3" />
              </button>

              {/* Presets Dropdown */}
              {isSortMenuOpen && (
                <div
                  className="absolute left-0 mt-1 w-44 bg-slate-950 border border-slate-800 rounded-lg shadow-xl z-50 py-1 text-xs font-outfit"
                  onClick={() => setIsSortMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => applyPreset('custom')}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                      activePreset === 'custom' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <span>🎲</span> Custom Drag Order
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('alphabetical')}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                      activePreset === 'alphabetical' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <span>🔤</span> Alphabetical
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('nish_desc')}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                      activePreset === 'nish_desc' ? 'text-amber-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <span>🚩</span> Highest Nish First
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('vit_desc')}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                      activePreset === 'vit_desc' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <span>🫀</span> Highest Vit First
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('vit_asc')}
                    className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-900 flex items-center gap-2 ${
                      activePreset === 'vit_asc' ? 'text-cyan-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <span>🩸</span> Lowest Vit First
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive Manage Party Pill */}
        <button
          onClick={onOpenPartySelector || (() => {})}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border shadow-sm cursor-pointer ${
            activePartyId
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200 hover:border-cyan-400 shadow-cyan-950/40'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Click to manage active party session or join a new party"
        >
          <Users className={`w-3.5 h-3.5 ${activePartyId ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="font-outfit font-bold uppercase text-[11px]">Join Party:</span>
          <span className="font-mono font-extrabold text-xs">
            {displayRoomCode || (activePartyId ? activePartyId.slice(0, 4).toUpperCase() : '----')}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-0.5" />
        </button>
      </div>

      {/* Roster Cards List */}
      {orderedMembers.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
          No party members in session.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {orderedMembers.map((member, idx) => {
            const isSelf = Boolean(
              activeCharacter &&
                (Number(member.character_id) === Number(activeCharacter.id) ||
                  (tabSessionId && member.tab_session_id === tabSessionId))
            );
            const memberId = String(member.character_id || member.id);
            const isMarked = markedTurnIds.includes(memberId);
            return (
              <PartyCharacterCard
                key={member.id || member.character_id || `pm_${idx}`}
                member={member}
                isCurrentPlayer={isSelf}
                isTurnMarked={isMarked}
                isDraggable={orderedMembers.length > 1}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={() => setDraggedIndex(null)}
                isDragging={draggedIndex === idx}
                onNudgeUp={() => nudgeItem(idx, 'up')}
                onNudgeDown={() => nudgeItem(idx, 'down')}
                canNudgeUp={idx > 0}
                canNudgeDown={idx < orderedMembers.length - 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
