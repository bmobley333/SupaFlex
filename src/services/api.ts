// src/services/api.ts
// Supabase Data Access Gateway for SupaFlex

import { supabase } from '../lib/supabase';
import { Character, Power, MagicItem, Skillset, CharacterSheetData } from '../types/game';

export const createDefaultSheetData = (): CharacterSheetData => ({
  level: 1,
  ap: 0,
  vitality_max: 10,
  current_vitality: 10,
  wounds: 0,
  max_wounds: 3,
  defense: 10,
  armor: 0,
  max_powers: 5,
  max_spells: 5,
  attribute_dice: {
    might: 'd6',
    motion: 'd6',
    mind: 'd4',
    magic: 'd4',
    moxie: 'd8',
  },
  focus_die_current: 'd4',
  focus_die_max: 'd4',
  sparks: 0,
  is_charged: false,
  known_skillsets: [],
  power_slots: Array.from({ length: 5 }, () => ({
    select: false,
    name: '',
    action: '',
    usage: '',
    effect: '',
    checked: [false, false, false],
  })),
  spell_slots: Array.from({ length: 5 }, () => ({
    select: false,
    name: '',
    action: '',
    usage: '',
    effect: '',
    checked: [false, false, false],
  })),
  gear_slots: [],
  bio: {
    backstory: '',
    personality: '',
    image_url: '',
    notes: '',
  },
});

export const gameApi = {
  // --- CHARACTERS ---
  async getCharacters(): Promise<Character[]> {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[gameApi] Error fetching characters:', error);
      throw error;
    }
    return (data || []) as Character[];
  },

  async getCharacterById(id: number): Promise<Character | null> {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[gameApi] Error fetching character ${id}:`, error);
      return null;
    }
    return data as Character;
  },

  async createCharacter(name: string, characterClass = 'Adventurer', race = 'Human'): Promise<Character> {
    const defaultSheet = createDefaultSheetData();
    const { data, error } = await supabase
      .from('characters')
      .insert({
        name,
        class: characterClass,
        race,
        hp: defaultSheet.vitality_max,
        might: 'd4',
        motion: 'd4',
        mind: 'd4',
        magic: 'd6',
        moxie: 'd8',
        skills: [],
        inventory: [],
        log: [],
        sheet_data: defaultSheet,
      })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating character:', error);
      throw error;
    }
    return data as Character;
  },

  async updateCharacter(id: number, updates: Partial<Character>): Promise<Character> {
    const { data, error } = await supabase
      .from('characters')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[gameApi] Error updating character ${id}:`, error);
      throw error;
    }
    return data as Character;
  },

  async deleteCharacter(id: number): Promise<void> {
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (error) {
      console.error(`[gameApi] Error deleting character ${id}:`, error);
      throw error;
    }
  },

  // --- POWERS & MAGIC ITEMS ---
  async getPowers(): Promise<Power[]> {
    const { data, error } = await supabase
      .from('powers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching powers:', error);
      return [];
    }
    return (data || []) as Power[];
  },

  async getMagicItems(): Promise<MagicItem[]> {
    const { data, error } = await supabase
      .from('magic_items')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching magic items:', error);
      return [];
    }
    return (data || []) as MagicItem[];
  },

  // --- SKILLSETS ---
  async getSkillsets(): Promise<Skillset[]> {
    const { data, error } = await supabase
      .from('skillsets')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching skillsets:', error);
      return [];
    }
    return (data || []) as Skillset[];
  },

  // --- HEALTH CHECK ---
  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await supabase.from('characters').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  },
};
