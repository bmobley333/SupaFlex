// src/store/useCharacterStore.ts
// Centralized Zustand store for active character, codex data, & Supabase sync

import { create } from 'zustand';
import { Character, CharacterSheetData, Power, MagicItem, Skillset } from '../types/game';
import { gameApi, createDefaultSheetData } from '../services/api';

interface CharacterStore {
  // State
  characters: Character[];
  activeCharacter: Character | null;
  powers: Power[];
  magicItems: MagicItem[];
  skillsets: Skillset[];
  isLoading: boolean;
  isSaving: boolean;
  dbConnected: boolean;
  error: string | null;

  // Player Login & Filtering State
  playerEmail: string;
  playerName: string;
  filterMode: 'my_heroes' | 'all_heroes';
  activeRole: 'player' | 'gm';
  activePartyId: string | null;
  tabSessionId: string;

  // Actions
  fetchInitialData: () => Promise<void>;
  selectCharacter: (id: number) => void;
  createNewCharacter: (name: string, characterClass?: string, race?: string) => Promise<Character | null>;
  updateActiveSheetData: (updater: (prev: CharacterSheetData) => CharacterSheetData) => void;
  updateActiveCharacterMeta: (updates: Partial<Character>) => void;
  saveActiveCharacter: () => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
  addSpark: (amount?: number) => void;
  spendMeta: () => void;
  resetSparks: () => void;
  setPlayerEmail: (email: string) => void;
  setPlayerName: (name: string) => void;
  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => void;
  setActiveRole: (role: 'player' | 'gm') => void;
  setActivePartyId: (partyId: string | null) => void;
  recordApExpenditure: (
    cost: number,
    category: 'Skills' | 'Weapons' | 'Armor' | 'Shields' | 'Powers' | 'Magic Items' | 'Attributes' | 'Focus Die' | 'Capstones' | 'Vitality' | 'GM Bonus' | 'Manual',
    description: string,
    tier: 1 | 2 | 3 | 'Creation' | 'Manual',
    source: string
  ) => void;
  revertApExpenditure: (entryId: string) => void;
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  activeCharacter: null,
  powers: [],
  magicItems: [],
  skillsets: [],
  isLoading: false,
  isSaving: false,
  dbConnected: false,
  error: null,

  tabSessionId: (() => {
    if (typeof window === 'undefined') return 'server_side';

    const windowKey = window.name;
    const storedTabId = sessionStorage.getItem('supaflex_tab_session_id');

    // If window.name matches storedTabId, this is an existing tab refresh/navigation
    if (windowKey && storedTabId && windowKey === `supaflex_win_${storedTabId}`) {
      return storedTabId;
    }

    // Otherwise, this is a NEW tab or DUPLICATED tab (Ctrl+D)!
    const newTabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    window.name = `supaflex_win_${newTabId}`;
    sessionStorage.setItem('supaflex_tab_session_id', newTabId);

    // Purge copied sessionStorage credentials so duplicated tabs require fresh re-login
    sessionStorage.removeItem('supaflex_player_email');
    sessionStorage.removeItem('supaflex_player_name');
    sessionStorage.removeItem('supaflex_active_party_id');
    sessionStorage.removeItem('supaflex_last_active_char_id');

    return newTabId;
  })(),

  playerEmail: typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_player_email') || '') : '',
  playerName: typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_player_name') || '') : '',
  filterMode: (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_filter_mode') as any) : null) || 'my_heroes',
  activeRole: (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_active_role') as 'player' | 'gm') : null) || 'player',
  activePartyId: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('supaflex_active_party_id') : null,

  setActiveRole: (role: 'player' | 'gm') => {
    sessionStorage.setItem('supaflex_active_role', role);
    set({ activeRole: role });
  },

  setActivePartyId: (partyId: string | null) => {
    if (partyId) {
      sessionStorage.setItem('supaflex_active_party_id', partyId);
    } else {
      sessionStorage.removeItem('supaflex_active_party_id');
    }
    set({ activePartyId: partyId });
  },

  fetchInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const isConnected = await gameApi.checkConnection();
      set({ dbConnected: isConnected });

      // Register window network status listeners for dynamic offline warning popups
      if (typeof window !== 'undefined' && !(window as any)._supaflex_network_listeners_bound) {
        (window as any)._supaflex_network_listeners_bound = true;
        window.addEventListener('online', async () => {
          const reconnected = await gameApi.checkConnection();
          set({ dbConnected: reconnected });
        });
        window.addEventListener('offline', () => {
          set({ dbConnected: false });
        });
      }

      if (!isConnected) {
        set({ isLoading: false, error: 'Database connection offline.' });
        return;
      }

      const [chars, powers, items, skillsets] = await Promise.all([
        gameApi.getCharacters(),
        gameApi.getPowers(),
        gameApi.getMagicItems(),
        gameApi.getSkillsets(),
      ]);

      const lastActiveIdStr = sessionStorage.getItem('supaflex_last_active_char_id');
      const lastActiveId = lastActiveIdStr ? Number(lastActiveIdStr) : null;
      let selectedChar = (lastActiveId ? chars.find((c) => c.id === lastActiveId) : null) || chars[0] || null;

      // If no character exists yet, auto-create a default Playtest hero
      if (!selectedChar && isConnected) {
        selectedChar = await gameApi.createCharacter('Hero of MetaScape', 'Vanguard', 'Human');
        chars.push(selectedChar);
      }

      if (selectedChar) {
        sessionStorage.setItem('supaflex_last_active_char_id', String(selectedChar.id));
      }

      set({
        characters: chars,
        activeCharacter: selectedChar,
        powers,
        magicItems: items,
        skillsets,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Failed to fetch character data.',
      });
    }
  },

  selectCharacter: async (id: number) => {
    sessionStorage.setItem('supaflex_last_active_char_id', String(id));
    const found = get().characters.find((c) => c.id === id);
    if (found) {
      set({ activeCharacter: { ...found } });
    }
    try {
      const updated = await gameApi.getCharacterById(id);
      if (updated) {
        set((state) => ({
          activeCharacter: updated,
          characters: state.characters.map((c) => (c.id === updated.id ? updated : c)),
        }));
      }
    } catch (err) {
      console.warn('Network fetch for character details failed:', err);
    }
  },

  createNewCharacter: async (name: string, characterClass = 'Adventurer', race = 'Human') => {
    set({ isSaving: true });
    try {
      const newChar = await gameApi.createCharacter(name, characterClass, race);
      set((state) => ({
        characters: [newChar, ...state.characters],
        activeCharacter: newChar,
        isSaving: false,
      }));
      sessionStorage.setItem('supaflex_last_active_char_id', String(newChar.id));
      return newChar;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to create character.' });
      return null;
    }
  },

  setPlayerEmail: (email: string) => {
    const trimmed = email.trim();
    sessionStorage.setItem('supaflex_player_email', trimmed);
    set({ playerEmail: trimmed });
  },

  setPlayerName: (name: string) => {
    const trimmed = name.trim();
    sessionStorage.setItem('supaflex_player_name', trimmed);
    set({ playerName: trimmed });
  },

  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => {
    sessionStorage.setItem('supaflex_filter_mode', mode);
    set({ filterMode: mode });
  },

  updateActiveSheetData: (updater) => {
    const active = get().activeCharacter;
    if (!active) return;

    const currentSheet = active.sheet_data || createDefaultSheetData();
    const updatedSheet = updater({ ...currentSheet });

    set((state) => {
      if (!state.activeCharacter) return state;
      const updatedActive = {
        ...state.activeCharacter,
        hp: updatedSheet.current_vitality,
        might: updatedSheet.attribute_dice.might,
        motion: updatedSheet.attribute_dice.motion,
        mind: updatedSheet.attribute_dice.mind,
        magic: updatedSheet.attribute_dice.magic,
        moxie: updatedSheet.attribute_dice.moxie,
        sheet_data: updatedSheet,
      };
      return {
        activeCharacter: updatedActive,
        characters: state.characters.map((c) => (c.id === updatedActive.id ? updatedActive : c)),
      };
    });
  },

  updateActiveCharacterMeta: (updates: Partial<Character>) => {
    set((state) => {
      if (!state.activeCharacter) return state;
      const updated = { ...state.activeCharacter, ...updates };
      return {
        activeCharacter: updated,
        characters: state.characters.map((c) => (c.id === updated.id ? updated : c)),
      };
    });
  },

  saveActiveCharacter: async () => {
    const active = get().activeCharacter;
    if (!active) return;
    set({ isSaving: true });
    try {
      const saved = await gameApi.updateCharacter(active.id, {
        name: active.name,
        class: active.class,
        race: active.race,
        hp: active.hp,
        might: active.might,
        motion: active.motion,
        mind: active.mind,
        magic: active.magic,
        moxie: active.moxie,
        skills: active.skills,
        inventory: active.inventory,
        owner_email: active.owner_email,
        sheet_data: active.sheet_data,
      });

      set((state) => ({
        activeCharacter: saved,
        characters: state.characters.map((c) => (c.id === saved.id ? saved : c)),
        isSaving: false,
      }));
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to save character.' });
    }
  },

  deleteCharacter: async (id: number) => {
    set({ isSaving: true });
    try {
      await gameApi.deleteCharacter(id);
      set((state) => {
        const remaining = state.characters.filter((c) => c.id !== id);
        return {
          isSaving: false,
          characters: remaining,
          activeCharacter: state.activeCharacter?.id === id ? remaining[0] || null : state.activeCharacter,
        };
      });
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to delete character.' });
    }
  },

  addSpark: (amount = 1) => {
    get().updateActiveSheetData((prev) => {
      const currentSparks = prev.sparks || 0;
      const nextSparks = Math.min(5, currentSparks + amount);
      return {
        ...prev,
        sparks: nextSparks,
        is_charged: nextSparks === 5,
      };
    });
  },

  spendMeta: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      sparks: 0,
      is_charged: false,
    }));
  },

  resetSparks: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      sparks: 0,
      is_charged: false,
    }));
  },

  recordApExpenditure: (cost, category, description, tier, source) => {
    get().updateActiveSheetData((prev) => {
      const log = prev.ap_log || [];
      const newEntry = {
        id: `ap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        category,
        cost,
        description,
        tier,
        source,
      };
      const updatedLog = [newEntry, ...log];
      const currentAp = typeof prev.ap === 'number' ? prev.ap : 1;
      const nextAp = Math.max(0, currentAp - cost);

      return {
        ...prev,
        ap: nextAp,
        ap_log: updatedLog,
      };
    });
  },

  revertApExpenditure: (entryId: string) => {
    get().updateActiveSheetData((prev) => {
      const log = prev.ap_log || [];
      const target = log.find((e) => e.id === entryId);
      if (!target) return prev;

      const updatedLog = log.filter((e) => e.id !== entryId);
      const currentAp = typeof prev.ap === 'number' ? prev.ap : 0;
      const nextAp = currentAp + target.cost;

      return {
        ...prev,
        ap: nextAp,
        ap_log: updatedLog,
      };
    });
  },
}));
