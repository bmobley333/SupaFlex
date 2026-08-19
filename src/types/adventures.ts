// src/types/adventures.ts
// Strongly typed models for GM Adventure, Act & Encounter pre-staging hierarchy

import { ParsedMonster } from '../utils/monsterStatParser';

export type GmSessionMode = 'design' | 'game_day';

export interface PreStagedMonster extends ParsedMonster {
  count?: number;
  custom_notes?: string;
  scaled_dif?: number;
}

export const LINK_CATEGORIES = [
  'Audio / Ambience',
  'External / Web',
  'Interactive Tool',
  'Lore / Narrative',
  'Map / Spatial',
  'Rules / Reference',
  'Video / Media',
  'Visual / Handout',
] as const;

export type LinkCategory = typeof LINK_CATEGORIES[number];

export interface LinkCategoryMeta {
  icon: string;
  description: string;
  badgeStyle: string;
}

export const LINK_CATEGORY_METADATA: Record<LinkCategory, LinkCategoryMeta> = {
  'Audio / Ambience': {
    icon: '🎵',
    description: 'Music, background tracks, SFX, ambient soundscapes',
    badgeStyle: 'text-violet-300 bg-violet-950/80 border-violet-700/60',
  },
  'External / Web': {
    icon: '🌐',
    description: 'General URLs, shared drives, community links, generic docs',
    badgeStyle: 'text-blue-300 bg-blue-950/80 border-blue-700/60',
  },
  'Interactive Tool': {
    icon: '🛠️',
    description: 'Calculators, character builders, encounter trackers, dice rollers',
    badgeStyle: 'text-amber-300 bg-amber-950/80 border-amber-700/60',
  },
  'Lore / Narrative': {
    icon: '📜',
    description: 'Worldbuilding, history, NPC dossiers, timelines, factions',
    badgeStyle: 'text-emerald-300 bg-emerald-950/80 border-emerald-700/60',
  },
  'Map / Spatial': {
    icon: '🗺️',
    description: 'Battlemaps, regional maps, world atlases, dungeon schematics',
    badgeStyle: 'text-teal-300 bg-teal-950/80 border-teal-700/60',
  },
  'Rules / Reference': {
    icon: '⚖️',
    description: 'System references, mechanics, spell/feat tables, stat blocks',
    badgeStyle: 'text-indigo-300 bg-indigo-950/80 border-indigo-700/60',
  },
  'Video / Media': {
    icon: '🎬',
    description: 'Tutorials, animated cutscenes, session recordings, streaming links',
    badgeStyle: 'text-rose-300 bg-rose-950/80 border-rose-700/60',
  },
  'Visual / Handout': {
    icon: '🖼️',
    description: 'Character portraits, item cards, scene concept art, player handouts',
    badgeStyle: 'text-cyan-300 bg-cyan-950/80 border-cyan-700/60',
  },
};

export const normalizeLinkCategory = (tag?: string): LinkCategory => {
  if (!tag) return 'External / Web';
  const clean = tag.trim();
  if (LINK_CATEGORIES.includes(clean as LinkCategory)) {
    return clean as LinkCategory;
  }
  const lower = clean.toLowerCase();
  if (lower.includes('audio') || lower.includes('music') || lower.includes('sound') || lower.includes('sfx')) return 'Audio / Ambience';
  if (lower.includes('tool') || lower.includes('calc') || lower.includes('dice')) return 'Interactive Tool';
  if (lower.includes('lore') || lower.includes('story') || lower.includes('bio') || lower.includes('history')) return 'Lore / Narrative';
  if (lower.includes('map') || lower.includes('spatial') || lower.includes('dungeon')) return 'Map / Spatial';
  if (lower.includes('rule') || lower.includes('srd') || lower.includes('ref') || lower.includes('spell') || lower.includes('stat')) return 'Rules / Reference';
  if (lower.includes('video') || lower.includes('stream') || lower.includes('media') || lower.includes('youtube')) return 'Video / Media';
  if (lower.includes('handout') || lower.includes('art') || lower.includes('image') || lower.includes('portrait') || lower.includes('visual')) return 'Visual / Handout';
  return 'External / Web';
};

export interface EncounterLink {
  id: string;              // UUID or nanoid
  name: string;            // e.g. "Dungeon Map" or "Puzzle Clue"
  url?: string;            // e.g. "https://..." (optional for text notes)
  categoryTag?: LinkCategory | string;
  description?: string;    // Optional context or text note content
  isNote?: boolean;        // true if entry is a text note
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
  links?: EncounterLink[];
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
