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
  categoryTag?: string;    // e.g. "Handout", "Map", "Lore", "Art", "Tool", "General"
  description?: string;    // Optional context or notes
  created_at?: string;
}

export interface ReceivedLinkItem extends EncounterLink {
  senderName: string;
  senderRole: 'gm' | 'player';
  targetType: 'all' | 'specific';
  isRead?: boolean;
  receivedAt: string;
}

export interface SharedLinkDispatchPayload {
  id: string;
  link: EncounterLink;
  senderName: string;
  senderRole: 'gm' | 'player';
  targetType: 'all' | 'specific';
  targetCharacterIds?: string[]; // Empty if targetType === 'all'
  dispatchedAt: string;
}

export interface StagedLootItem {
  id: string;                      // UUID or nanoid
  title: string;                   // e.g. "Flametongue Longsword", "100 Gold Coins"
  categoryKey: string;             // 'weapons' | 'armor' | 'shields' | 'gear' | 'relics' | 'hardware' | 'chaos_gems' | 'coins' | 'art_gems' | 'curios' | 'junk'
  rarity?: 'Minor' | 'Lesser' | 'Greater' | 'Epic';
  description?: string;            // Effect / Rules / Visual details
  coinsSilver?: number;            // Silver coins
  coinsGold?: number;              // Gold coins
  valuableVal?: string;            // e.g. "250g"
  magicItem?: any;                 // Full relic payload
  chaosGem?: any;                  // Full chaos gem payload
  item_data?: any;                 // Generic item data payload (weapon, armor, shield, gear)
  targetPlayer?: string;           // Optional targeted player name / 'Party'
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
  loot?: StagedLootItem[]; // Encounter-specific pre-staged loot
  is_adlib?: boolean;      // Permanent Ad-Lib encounter flag
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
  links?: EncounterLink[]; // Adventure-specific URL links
  loot?: StagedLootItem[];  // Adventure-level staged loot (Ad-lib / Character creation)
  structure: AdventureStructure;
  created_at?: string;
  updated_at?: string;
}
