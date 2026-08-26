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
  const [sessionMembers, setSessionMembers] = useState<PartySessionMember[]>([]);
  const [displayRoomCode, setDisplayRoomCode] = useState<string | null>(null);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  useEffect(() => {
    if (!activePartyId) {
      setSessionMembers([]);
      setDisplayRoomCode(null);
      return;
    }

    const loadMembers = async () => {
      try {
        const members = await gameApi.getPartySessionMembers(activePartyId);

        // Fetch friendly 4-character room code from database for active UUID session
        if (activePartyId.length === 4) {
          setDisplayRoomCode(activePartyId.toUpperCase());
        } else {
          const { data: p } = await supabase.from('parties').select('room_code').eq('id', activePartyId).maybeSingle();
          if (p?.room_code) {
            setDisplayRoomCode(p.room_code.toUpperCase());
          }
        }

        // Verify active session with Supabase and self-heal missing DB session rows
        if (tabSessionId && activeCharacter?.id) {
          const isRegisteredInDb = members.some((m) => m.tab_session_id === tabSessionId);
          if (!isRegisteredInDb) {
            const playerEmail = useCharacterStore.getState().playerEmail;
            await gameApi.ensureTabPartySession(activePartyId, tabSessionId, activeCharacter.id, playerEmail);
            const updatedMembers = await gameApi.getPartySessionMembers(activePartyId);
            setSessionMembers(updatedMembers);
            return;
          }
        }

        setSessionMembers(members);
      } catch (err) {
        console.error('[PartyRosterHud] Failed to load session members:', err);
      }
    };

    loadMembers();

    // Subscribe to Realtime CDC & Broadcast for active party members
    const cdcChannel = supabase.channel(`roster_cdc_${activePartyId}`);
    cdcChannel
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

    const broadcastChannel = supabase.channel(`party:${activePartyId}`);
    broadcastChannel
      .on('broadcast', { event: 'party_members_updated' }, () => {
        loadMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cdcChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [activePartyId, tabSessionId]);

  // Filter out current active character ($N - 1$)
  const otherMembers = sessionMembers.filter((m) => {
    if (!activeCharacter) return true;
    return String(m.character_id) !== String(activeCharacter.id);
  });

  // Custom Local Storage Roster Ordering
  const storageKey = `supaflex_roster_order_${activeCharacter?.id || 'default'}`;
  const {
    orderedItems: orderedOtherMembers,
    moveItem,
    nudgeItem,
    applyPreset,
    activePreset,
    draggedIndex,
    setDraggedIndex,
  } = useRosterOrdering<PartySessionMember>({
    items: otherMembers,
    storageKey,
    getId: (m) => String(m.character_id || m.id),
    getName: (m) => resolveCharFirstName(m.character?.name || `Hero #${m.character_id}`),
    getVitPct: (m) => {
      const sheetData: Partial<CharacterSheetData> = m.character?.sheet_data || {};
      const current = sheetData.current_vitality ?? m.character?.hp ?? 28;
      const max = sheetData.vitality_max ?? 28;
      return max > 0 ? (current / max) * 100 : 0;
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
            PARTY ROSTER ({orderedOtherMembers.length})
          </h3>

          {/* Quick-Sort Presets Trigger */}
          {orderedOtherMembers.length > 1 && (
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
          <span className="font-outfit font-bold uppercase text-[11px]">Manage Party:</span>
          <span className="font-mono font-extrabold text-xs">
            {displayRoomCode || (activePartyId ? activePartyId.slice(0, 4).toUpperCase() : '----')}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-0.5" />
        </button>
      </div>

      {/* Roster Cards List */}
      {orderedOtherMembers.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic p-3 bg-slate-950/40 rounded-lg border border-slate-800/50 text-center">
          No other party members in session.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
          {orderedOtherMembers.map((member, idx) => (
            <PartyCharacterCard
              key={member.id || member.character_id || `pm_${idx}`}
              member={member}
              isDraggable={orderedOtherMembers.length > 1}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={() => setDraggedIndex(null)}
              isDragging={draggedIndex === idx}
              onNudgeUp={() => nudgeItem(idx, 'up')}
              onNudgeDown={() => nudgeItem(idx, 'down')}
              canNudgeUp={idx > 0}
              canNudgeDown={idx < orderedOtherMembers.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
