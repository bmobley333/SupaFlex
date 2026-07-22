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
  filterMode: 'my_heroes' | 'all_heroes';

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
  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => void;
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

  playerEmail: localStorage.getItem('supaflex_player_email') || 'TheBMobley@gmail.com',
  filterMode: (localStorage.getItem('supaflex_filter_mode') as any) || 'my_heroes',

  fetchInitialData: async () => {
    set({ isLoading: true, error: null });
    try {
      const isConnected = await gameApi.checkConnection();
      set({ dbConnected: isConnected });

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

      let selectedChar = chars[0] || null;

      // If no character exists yet, auto-create a default Playtest hero
      if (!selectedChar && isConnected) {
        selectedChar = await gameApi.createCharacter('Hero of MetaScape', 'Vanguard', 'Human');
        chars.push(selectedChar);
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
        error: err.message || 'Failed to fetch data from Supabase.',
      });
    }
  },

  selectCharacter: async (id: number) => {
    const found = get().characters.find((c) => c.id === id);
    if (found) {
      set({ activeCharacter: { ...found } });
    }
    try {
      const fresh = await gameApi.getCharacterById(id);
      if (fresh) {
        set((state) => ({
          activeCharacter: fresh,
          characters: state.characters.map((c) => (c.id === id ? fresh : c)),
        }));
      }
    } catch (err) {
      console.warn('[selectCharacter] Hydration fallback to cached hero:', err);
    }
  },

  createNewCharacter: async (name: string, characterClass = 'Adventurer', race = 'Human') => {
    set({ isSaving: true, error: null });
    try {
      const email = get().playerEmail || 'TheBMobley@gmail.com';
      const newChar = await gameApi.createCharacter(name, characterClass, race, email);
      set((state) => ({
        characters: [newChar, ...state.characters],
        activeCharacter: newChar,
        isSaving: false,
      }));
      return newChar;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to create character.' });
      return null;
    }
  },

  setPlayerEmail: (email: string) => {
    const trimmed = email.trim();
    localStorage.setItem('supaflex_player_email', trimmed);
    set({ playerEmail: trimmed });
  },

  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => {
    localStorage.setItem('supaflex_filter_mode', mode);
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

  updateActiveCharacterMeta: (updates) => {
    set((state) => {
      if (!state.activeCharacter) return state;
      const updatedActive = { ...state.activeCharacter, ...updates };
      return {
        activeCharacter: updatedActive,
        characters: state.characters.map((c) => (c.id === updatedActive.id ? updatedActive : c)),
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
}));

