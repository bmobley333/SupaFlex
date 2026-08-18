// src/types/adventures.ts
// Strongly typed models for GM Adventure, Act & Encounter pre-staging hierarchy

import { ParsedMonster } from '../utils/monsterStatParser';

export type GmSessionMode = 'design' | 'game_day';

export interface PreStagedMonster extends ParsedMonster {
  count?: number;
  custom_notes?: string;
  scaled_dif?: number;
}

export interface EncounterLink {
  id: string;              // UUID or nanoid
  name: string;            // e.g. "Dungeon Map"
  url: string;             // e.g. "https://..."
  created_at?: string;
}

export interface GmEncounter {
  id: string;              // UUID or nanoid
  title: string;           // e.g. "Room 4: Skeleton Crypt Guard"
  notes?: string;          // Tactical GM notes, room traps, terrain effects
  tactical_notes?: string; // Explicit tactical notes
  master_dif?: number;     // Encounter Difficulty rating (default 10)
  links?: EncounterLink[]; // Encounter-specific URL links
  monsters: PreStagedMonster[];
  created_at?: string;
}

export interface GmAct {
  id: string;              // UUID or nanoid
  title: string;           // e.g. "Act 1: The Crypts of Morzan"
  description?: string;    // Story synopsis / act goals
  encounters: GmEncounter[];
  created_at?: string;
}

export interface AdventureStructure {
  acts: GmAct[];
}

export interface GmAdventure {
  id: string;              // UUID
  gm_email: string;
  title: string;           // e.g. "The Sunken Citadel"
  description?: string;
  genre?: string;
  is_active?: boolean;
  is_published?: boolean;  // Whether published to Supabase community
  structure: AdventureStructure;
  created_at?: string;
  updated_at?: string;
}
