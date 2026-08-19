// src/store/useReceivedLinksStore.ts
// Centralized store for received party links, in-app notifications, and realtime broadcast dispatching

import { create } from 'zustand';
import { EncounterLink, ReceivedLinkItem, SharedLinkDispatchPayload } from '../types/adventures';
import { supabase } from '../lib/supabase';

interface ReceivedLinksState {
  receivedLinks: ReceivedLinkItem[];
  unreadCount: number;

  // Actions
  loadReceivedLinks: (partyId?: string, characterId?: string) => void;
  addReceivedLink: (link: ReceivedLinkItem, partyId?: string, characterId?: string) => void;
  toggleReadStatus: (linkId: string, partyId?: string, characterId?: string) => void;
  markAsRead: (linkId: string, partyId?: string, characterId?: string) => void;
  markAllAsRead: (partyId?: string, characterId?: string) => void;
  deleteReceivedLink: (linkId: string, partyId?: string, characterId?: string) => void;
  clearReceivedLinks: (partyId?: string, characterId?: string) => void;

  // Realtime Dispatch
  dispatchLinksToParty: (
    links: EncounterLink[],
    options: {
      senderName: string;
      senderRole: 'gm' | 'player';
      targetType: 'all' | 'specific';
      targetCharacterIds?: string[];
      partyId: string;
    }
  ) => Promise<{ success: boolean; count: number }>;
}

const getStorageKey = (partyId?: string, characterId?: string): string => {
  const p = partyId || 'global';
  const c = characterId || 'all';
  return `supaflex_received_links_${p}_${c}`;
};

export const useReceivedLinksStore = create<ReceivedLinksState>((set) => ({
  receivedLinks: [],
  unreadCount: 0,

  loadReceivedLinks: (partyId?: string, characterId?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const key = getStorageKey(partyId, characterId);
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: ReceivedLinkItem[] = JSON.parse(saved);
        const unread = parsed.filter((l) => !l.isRead).length;
        set({ receivedLinks: parsed, unreadCount: unread });
        return;
      }
    } catch (e) {
      console.error('[useReceivedLinksStore] Error loading received links:', e);
    }
    set({ receivedLinks: [], unreadCount: 0 });
  },

  addReceivedLink: (link: ReceivedLinkItem, partyId?: string, characterId?: string) => {
    set((state) => {
      // Prevent duplicate link IDs
      if (state.receivedLinks.some((l) => l.id === link.id)) {
        return state;
      }
      const updated = [link, ...state.receivedLinks];
      const unread = updated.filter((l) => !l.isRead).length;

      if (typeof window !== 'undefined') {
        try {
          const key = getStorageKey(partyId, characterId);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {
          console.error('[useReceivedLinksStore] Error persisting received link:', e);
        }
      }

      return { receivedLinks: updated, unreadCount: unread };
    });
  },

  toggleReadStatus: (linkId: string, partyId?: string, characterId?: string) => {
    set((state) => {
      const updated = state.receivedLinks.map((l) =>
        l.id === linkId ? { ...l, isRead: !l.isRead } : l
      );
      const unread = updated.filter((l) => !l.isRead).length;
      if (typeof window !== 'undefined') {
        try {
          const key = getStorageKey(partyId, characterId);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }
      return { receivedLinks: updated, unreadCount: unread };
    });
  },

  markAsRead: (linkId: string, partyId?: string, characterId?: string) => {
    set((state) => {
      const updated = state.receivedLinks.map((l) =>
        l.id === linkId ? { ...l, isRead: true } : l
      );
      const unread = updated.filter((l) => !l.isRead).length;
      if (typeof window !== 'undefined') {
        try {
          const key = getStorageKey(partyId, characterId);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }
      return { receivedLinks: updated, unreadCount: unread };
    });
  },

  markAllAsRead: (partyId?: string, characterId?: string) => {
    set((state) => {
      const updated = state.receivedLinks.map((l) => ({ ...l, isRead: true }));
      if (typeof window !== 'undefined') {
        try {
          const key = getStorageKey(partyId, characterId);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }
      return { receivedLinks: updated, unreadCount: 0 };
    });
  },

  deleteReceivedLink: (linkId: string, partyId?: string, characterId?: string) => {
    set((state) => {
      const updated = state.receivedLinks.filter((l) => l.id !== linkId);
      const unread = updated.filter((l) => !l.isRead).length;
      if (typeof window !== 'undefined') {
        try {
          const key = getStorageKey(partyId, characterId);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }
      return { receivedLinks: updated, unreadCount: unread };
    });
  },

  clearReceivedLinks: (partyId?: string, characterId?: string) => {
    if (typeof window !== 'undefined') {
      try {
        const key = getStorageKey(partyId, characterId);
        localStorage.removeItem(key);
      } catch {}
    }
    set({ receivedLinks: [], unreadCount: 0 });
  },

  dispatchLinksToParty: async (links, options) => {
    if (!links || links.length === 0 || !options.partyId) {
      return { success: false, count: 0 };
    }

    const { senderName, senderRole, targetType, targetCharacterIds, partyId } = options;
    const channelName = `party:${partyId}`;
    const channel = supabase.channel(channelName);

    let sentCount = 0;
    try {
      for (const link of links) {
        const payload: SharedLinkDispatchPayload = {
          id: `share_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          link,
          senderName,
          senderRole,
          targetType,
          targetCharacterIds: targetType === 'specific' ? targetCharacterIds : undefined,
          dispatchedAt: new Date().toISOString(),
        };

        await channel.send({
          type: 'broadcast',
          event: 'party_link_shared',
          payload,
        });

        sentCount++;
      }

      return { success: true, count: sentCount };
    } catch (err) {
      console.error('[useReceivedLinksStore] Error broadcasting links to party:', err);
      return { success: false, count: sentCount };
    }
  },
}));
