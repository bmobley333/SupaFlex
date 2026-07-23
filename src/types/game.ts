// src/types/game.ts
// Strongly typed TypeScript models for SupaFlex DB tables & sheet JSONB data

export type AttributeKey = 'might' | 'motion' | 'mind' | 'magic' | 'moxie';
export type DieRating = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'Exhausted';

export interface AbilitySlot {
  select: boolean;
  name: string;
  action: 'AM' | 'A' | 'M' | 'P' | 'F' | '';
  usage: string;
  effect: string;
  checked: boolean[];
}

export interface EquipmentSlot {
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'gear';
  armor_bonus?: number;
  defense_bonus?: number;
  usage: string;
  effect: string;
  checked: boolean[];
}

export interface CharacterBio {
  backstory?: string;
  personality?: string;
  image_url?: string;
  notes?: string;
}

export interface CharacterSheetData {
  level: number;
  ap: number;
  vitality_max: number;
  current_vitality: number;
  wounds: number;
  max_wounds: number;
  defense: number;
  armor: number;
  max_powers: number;
  max_spells: number;
  attribute_dice: Record<AttributeKey, DieRating>;
  focus_die_current?: DieRating;
  focus_die_max?: DieRating;
  sparks?: number; // 0-5 Kinetic Sparks (5 Sparks = 1 Meta)
  is_charged?: boolean; // True when sparks === 5 (+1 to ALL rolls)
  luck?: number; // 0-5 Luck Pool (Default 3, Max 5)
  max_luck?: number; // Default 5
  known_skillsets: string[];
  power_slots: AbilitySlot[];
  spell_slots: AbilitySlot[];
  gear_slots: EquipmentSlot[];
  bio: CharacterBio;
}

export interface Player {
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

export interface Character {
  id: number;
  name: string;
  class: string | null;
  race: string | null;
  hp: number;
  inventory: any[];
  log: any[];
  updated_at: string;
  might: string | null;
  motion: string | null;
  mind: string | null;
  magic: string | null;
  moxie: string | null;
  skills: string[];
  owner_email: string | null;
  sheet_data: CharacterSheetData;
}

export interface Power {
  id: number;
  name: string;
  usage: string | null;
  action: string | null;
  effect: string | null;
  source: string | null;
  created_at: string;
  dropdown: string | null;
  sub: string | null;
  table_name: string | null;
}

export interface MagicItem {
  id: number;
  name: string;
  usage: string | null;
  action: string | null;
  effect: string | null;
  source: string | null;
  created_at: string;
  dropdown: string | null;
  sub: string | null;
  table_name: string | null;
}

export interface Skillset {
  id: number;
  name: string;
  skills: string[];
  source: string | null;
  created_at: string;
  dropdown: string | null;
  sub: string | null;
  table_name: string | null;
}
