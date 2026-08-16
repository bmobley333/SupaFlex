// src/types/game.ts
// Strongly typed TypeScript models for SupaFlex DB tables & sheet JSONB data

export type AttributeKey = 'might' | 'motion' | 'mind' | 'magic' | 'moxie';
export type DieRating = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'Exhausted';
export type PowerReadyType = 'primary_arsenal' | 'mobility_defense' | 'support_passive' | 'contextual_passive';

export interface ReadySlotConfig {
  tier: number;
  totalSlots: number;
  maxArsenal: number;
  maxMobilityDefense: number;
  minFloor: number;
}

export interface AbilitySlot {
  select: boolean;
  name: string;
  action: 'AM' | 'A' | 'M' | 'P' | 'F' | '';
  usage: string;
  effect: string;
  checked: boolean[];
  version?: number;
  base_name?: string;
  ready?: PowerReadyType;
  is_readied?: boolean;
  notes?: string;
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

export interface WeaponSlot {
  id: string;
  name: string;
  sk: boolean;
  mhs: 'M' | 'H' | 'S';
  atk: string;
  dmg: string;
  max_blk: string;
  effect?: string;
  notes?: string;
}

export interface ArmorData {
  id?: string;
  name: string;
  sk?: boolean;
  block?: number;
  dodge?: number;
  ar: number;
  requirement?: string;
  mr?: string;
  cost?: string;
  effect?: string;
  notes?: string;
}

export interface SupabaseArmor {
  id?: number;
  name: string;
  genres?: string[];
  requirement: string;
  ar: string;
  mr: string;
  cost: string;
  notes?: string;
  pic?: string;
  created_at?: string;
}

export interface SupabaseGear {
  id?: number;
  category: string;
  genres?: string[];
  name: string;
  cost: string;
  action?: string;
  usage?: string;
  notes?: string;
  pic?: string;
  created_at?: string;
}

export interface SupabaseMonster {
  id?: number;
  name: string;
  genres?: string[];
  nish: string;
  mr: string;
  atk_dmg_ftg: string;
  dod_ar: string;
  vit: string;
  attributes?: string;
  abilities?: string;
  notes?: string;
  weapons?: string;
  armor?: string;
  created_at?: string;
}


export interface SupabaseChaosGem {
  id?: number;
  name: string;
  genres?: string[];
  action: string;
  usage: string;
  effect: string;
  notes?: string;
  pic?: string;
  created_at?: string;
}

export interface ChaosGemItem {
  id?: number;
  name: string;
  action: string;
  usage: number; // remaining uses (e.g. 3, 2, 1)
  max_usage: number; // starting max uses (e.g. 3)
  effect: string;
  genres?: string[];
}

export interface ChaosGemSlot {
  slot_id: string; // 'wrist' | 'finger_1' | 'finger_2' | 'finger_3' | 'finger_4' | 'finger_5'
  slot_type: 'wrist' | 'finger';
  slot_label: string; // 'Wrist (Mega Slot)', 'Thumb (Finger 1)', etc.
  gem: ChaosGemItem | null;
}

export const DEFAULT_CHAOS_GAUNTLET_SLOTS: ChaosGemSlot[] = [
  { slot_id: 'wrist', slot_type: 'wrist', slot_label: 'Wrist (Mega Slot)', gem: null },
  { slot_id: 'finger_1', slot_type: 'finger', slot_label: 'Thumb (Finger 1)', gem: null },
  { slot_id: 'finger_2', slot_type: 'finger', slot_label: 'Index (Finger 2)', gem: null },
  { slot_id: 'finger_3', slot_type: 'finger', slot_label: 'Middle (Finger 3)', gem: null },
  { slot_id: 'finger_4', slot_type: 'finger', slot_label: 'Ring (Finger 4)', gem: null },
  { slot_id: 'finger_5', slot_type: 'finger', slot_label: 'Pinky (Finger 5)', gem: null },
];

export const REQUIREMENT_TO_MR_MAP: Record<number, string> = {
  4: '👣8',
  6: '👣7',
  8: '👣6',
  10: '👣6',
  12: '👣5',
};

export const REQUIREMENT_TO_AR_MAP: Record<number, string> = {
  4: '🧥4',
  6: '🧥6',
  8: '🧥8',
  10: '🧥10',
  12: '🧥12',
};

export const getMrFromRequirement = (reqStr: string): string => {
  const match = reqStr.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return REQUIREMENT_TO_MR_MAP[num] || '👣8';
  }
  return '👣8';
};

export const getArFromRequirement = (reqStr: string): string => {
  const match = reqStr.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return REQUIREMENT_TO_AR_MAP[num] || '🧥4';
  }
  return '🧥4';
};

export interface SupabaseShield {
  id?: number;
  name: string;
  genres?: string[];
  requirement: string;
  max_block: string;
  mr: string;
  notes?: string;
  cost: string;
  created_at?: string;
}

export const REQUIREMENT_TO_SHIELD_MR_MAP: Record<number, string> = {
  4: '👣0',
  6: '👣-1',
  8: '👣-2',
  10: '👣-3',
  12: '👣-4',
};

export const REQUIREMENT_TO_SHIELD_MAX_BLOCK_MAP: Record<number, string> = {
  4: '🛡️12',
  6: '🛡️16',
  8: '🛡️20',
  10: '🛡️24',
  12: '🛡️28',
};

export const getShieldMrFromRequirement = (reqStr: string): string => {
  const match = reqStr.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return REQUIREMENT_TO_SHIELD_MR_MAP[num] || '👣0';
  }
  return '👣0';
};

export const getShieldMaxBlockFromRequirement = (reqStr: string): string => {
  const match = reqStr.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return REQUIREMENT_TO_SHIELD_MAX_BLOCK_MAP[num] || '🛡️12';
  }
  return '🛡️12';
};

export const isRequirementLearnable = (reqStr: string, attributeDice: Record<string, string>): boolean => {
  const match = reqStr.match(/\d+/);
  if (!match) return true;
  const reqNum = parseInt(match[0], 10);
  const mightRating = attributeDice?.might ? parseInt(attributeDice.might.replace('d', ''), 10) : 4;
  return mightRating >= reqNum;
};

export interface SupabaseWeapon {
  id?: number;
  name: string;
  genres?: string[];
  type: string;
  requirement: string;
  atk: string;
  dmg: string;
  max_block: string;
  cost: string;
  notes?: string;
  pic?: string;
  created_at?: string;
}

export interface WeaponVariantOption {
  weaponId?: number;
  name: string;
  variantType: 'Melee' | 'Hurled' | 'Shot';
  mhs: 'M' | 'H' | 'S';
  requirementEmoji: string;
  requirementNumber: number;
  requirementStr: string;
  atkEmoji: string;
  dmgEmoji: string;
  max_block: string;
  cost: string;
  rawType: string;
}

const parseAttributeNum = (dieRating?: string): number => {
  if (!dieRating) return 4;
  const num = parseInt(dieRating.replace('d', ''), 10);
  return isNaN(num) ? 4 : num;
};

export const isWeaponVariantLearnable = (
  variant: WeaponVariantOption,
  attributeDice: Record<string, string>
): boolean => {
  const reqNum = variant.requirementNumber;
  if (variant.variantType === 'Melee') {
    return parseAttributeNum(attributeDice.might) >= reqNum;
  }
  if (variant.variantType === 'Hurled') {
    return parseAttributeNum(attributeDice.motion) >= reqNum;
  }
  if (variant.variantType === 'Shot') {
    return parseAttributeNum(attributeDice.mind) >= reqNum;
  }
  return true;
};

export const splitWeaponIntoVariants = (weapon: SupabaseWeapon): WeaponVariantOption[] => {
  const types = (weapon.type || 'Melee').split(',').map((t) => t.trim());
  const reqParts = (weapon.requirement || '').split(',').map((r) => r.trim());

  return types.map((t, idx) => {
    let variantType: 'Melee' | 'Hurled' | 'Shot' = 'Melee';
    let mhs: 'M' | 'H' | 'S' = 'M';
    let emoji = '💪';

    if (t.toLowerCase() === 'hurled') {
      variantType = 'Hurled';
      mhs = 'H';
      emoji = '🏃';
    } else if (t.toLowerCase() === 'shot') {
      variantType = 'Shot';
      mhs = 'S';
      emoji = '👁️';
    }

    const specificReqStr = reqParts[idx] || reqParts[0] || `${emoji} 4`;
    const matchNum = specificReqStr.match(/\d+/);
    const reqNum = matchNum ? parseInt(matchNum[0], 10) : 4;

    let blockVal = weapon.max_block || 'n/a';
    if (variantType !== 'Melee') {
      blockVal = 'n/a';
    }

    return {
      weaponId: weapon.id,
      name: weapon.name,
      variantType,
      mhs,
      requirementEmoji: emoji,
      requirementNumber: reqNum,
      requirementStr: `${emoji} ${reqNum}`,
      atkEmoji: emoji,
      dmgEmoji: emoji,
      max_block: blockVal,
      cost: weapon.cost || '1g',
      rawType: weapon.type,
    };
  });
};



export interface ShieldData {
  id?: string;
  equipped: boolean;
  name: string;
  sk: boolean;
  max_block: number;
  requirement?: string;
  cost?: string;
  effect?: string;
  mr_adjustment?: string;
  notes?: string;
}

export interface MovementRateData {
  armored: number;
  shield: number | string;
}

export interface TreasureItem {
  id: string;
  name: string;
  value: number;
  currency: 'gp' | 'sp' | 'g' | 's';
  qty?: number;
  category?: string;
}

export interface SimpleGearItem {
  id: string;
  qty: number;
  name: string;
  category?: string;
  cost?: string;
  notes?: string;
}

export interface ApLogEntry {
  id: string;
  timestamp: string;
  category: 'Skills' | 'Weapons' | 'Armor' | 'Shields' | 'Powers' | 'Magic Items' | 'Attributes' | 'Focus Die' | 'Capstones' | 'Vitality' | 'GM Bonus' | 'Manual';
  cost: number;
  description: string;
  tier: 1 | 2 | 3 | 'Creation' | 'Manual';
  source: string;
}

export interface ExternalDocLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export interface GmDocLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  adventureTag?: string;
}

export interface CharacterBio {
  backstory?: string;
  personality?: string;
  image_url?: string;
  notes?: string;
  appearance?: string;
  positive_trait?: string;
  negative_trait?: string;
  flair?: string;
  adventuring_goal?: string;
  height?: string;
  weight?: string;
  age?: string;
  doc_links?: ExternalDocLink[];
}

export interface CustomSkillsetDefinition {
  id?: string | number;
  name: string;
  skills: string[];
  source?: string;
  created_at?: string;
}

export interface CharacterSheetData {
  level: number;
  ap: number;
  free_augment_tokens?: number;
  ap_log?: ApLogEntry[];
  vitality_max: number;
  vitality_base_max?: number;
  current_vitality: number;
  last_vit_roll_level?: number;
  wounds: number;
  max_wounds: number;
  defense: number;
  armor: number;
  max_powers: number;
  max_spells: number;
  attribute_dice: Record<AttributeKey, DieRating>;
  focus_die_current?: DieRating;
  focus_die_max?: DieRating;
  charges?: number; // 0-5 Charges (5 Charges = 1 Spark)
  is_sparked?: boolean; // True when charges === 5 (Fully Sparked: +1 to ALL rolls)
  sparks?: number; // Deprecated alias for charges
  is_charged?: boolean; // Deprecated alias for is_sparked
  luck?: number; // 0-5 Luck Pool (Default 3, Max 5)
  max_luck?: number; // Default 5
  gold?: number;
  silver?: number;
  other_treasure?: TreasureItem[];
  simple_gear?: SimpleGearItem[];
  known_skillsets: string[];
  known_individual_skills?: string[]; // Individually learned skills outside a skillset
  custom_skillsets?: CustomSkillsetDefinition[]; // Custom user-created skillsets
  favorite_power_tables?: string[]; // Favorited power tables (table_name strings)
  custom_power_tables?: { name: string; sub: string }[]; // Custom user-created power tables
  custom_powers?: Power[]; // Custom user-created powers
  custom_magic_items?: MagicItem[]; // Custom user-created magic items
  ability_overrides?: Record<string, { action?: string; usage?: string; effect?: string }>; // Player edits for existing stock abilities
  power_slots: AbilitySlot[];
  character_power_codex?: AbilitySlot[]; // Unlimited storage codex for un-readied powers (matching character_vault)
  tactical_pivot_used_in_encounter?: boolean; // True if player has executed their 1-per-encounter Tactical Pivot
  spell_slots: AbilitySlot[];
  gear_slots: EquipmentSlot[];
  weapons?: WeaponSlot[];
  armor_slot?: ArmorData;
  wardrobe?: ArmorData[];
  shield_slot?: ShieldData;
  armory?: ShieldData[];
  movement_rate?: MovementRateData;
  bio: CharacterBio;
  essence_core?: number; // 0-100 Essence Core Progress Ring
  character_vault?: MagicItem[]; // Unlimited storage vault for claimed Relics and Hardware
  unlocked_loadout_slots?: number; // Total active Loadout Slots capacity purchased with AP (default 3)
  unlocked_magic_slots?: number; // Deprecated alias for unlocked_loadout_slots
  starred_loadout_items?: (number | string)[]; // Starred Loadout Wishlist IDs
  starred_magic_items?: (number | string)[]; // Starred Magic Item Wishlist IDs (alias)
  starred_powers?: (number | string)[]; // Starred Powers Wishlist IDs
  starred_weapons?: (number | string)[]; // Starred Weapons Wishlist IDs
  starred_armor?: (number | string)[]; // Starred Armor Wishlist IDs
  starred_shields?: (number | string)[]; // Starred Shields Wishlist IDs
  starred_skillsets?: (number | string)[]; // Starred Skillsets Wishlist IDs/Names
  starred_skills?: (number | string)[]; // Starred Individual Skills Wishlist IDs/Names
  chaos_gauntlet_slots?: ChaosGemSlot[]; // 6 Chaos Gem Slots (1 Wrist Mega Slot + 5 Fingers)
  pity_level?: number; // 0-2 Draft Pity Escalator level
  pity_counters?: Record<string, number>; // Accumulated pity points
  rules_version?: number; // Schema rules version tracker
}

export interface Character {
  id: number;
  name: string;
  class: string;
  race: string;
  level: number;
  hp: number;
  might: string | null;
  motion: string | null;
  mind: string | null;
  magic: string | null;
  moxie: string | null;
  skills: string[];
  owner_email: string | null;
  sheet_data: CharacterSheetData;
  inventory?: any[];
  log?: any[];
  updated_at?: string;
}

export interface Power {
  id: number;
  name: string;
  genres?: string[];
  usage: string | null;
  action: string | null;
  effect: string | null;
  notes?: string;
  created_at: string;
  category?: string;
  ready?: PowerReadyType;
  sub?: string;
  table?: string;
  table_name?: string;
  source?: string;
  version?: number;
  base_name?: string;
}

export const calculateLifetimeAp = (level: number): number => {
  const numLevel = typeof level === 'number' && !isNaN(level) && level > 0 ? level : 1;
  return Math.max(2, numLevel * 2);
};

export const calculateLiveSheetSpentAp = (sheetData: any): { totalSpent: number; gmBonus: number; categories: Record<string, number> } => {
  if (!sheetData) return { totalSpent: 0, gmBonus: 0, categories: {} };

  const apLog: ApLogEntry[] = Array.isArray(sheetData.ap_log) ? sheetData.ap_log : [];

  const wardrobe = Array.isArray(sheetData.wardrobe) ? sheetData.wardrobe : [];
  const skilledArmor = wardrobe.filter((a: any) => a && a.sk);
  const armorNet = Math.max(0, (skilledArmor.length - 1) * 1);

  const sumLogCategory = (cat: string) =>
    apLog.reduce((sum, e) => (e && e.category === cat ? sum + (e.cost || 0) : sum), 0);

  const attributesNet = Math.max(0, sumLogCategory('Attributes'));
  const capstonesNet = Math.max(0, sumLogCategory('Capstones'));
  const focusNet = Math.max(0, sumLogCategory('Focus Die'));
  const gmBonus = apLog.reduce((sum, e) => (e && (e.category === 'GM Bonus' || e.category === 'Manual') ? sum + (e.cost || 0) : sum), 0);

  const powerSlots = (sheetData.power_slots || []).filter(Boolean);
  const totalPowerUnits = powerSlots.reduce((sum: number, slot: any) => sum + (slot?.version || 1), 0);
  const powersNet = Math.max(0, totalPowerUnits - 3);

  const unlockedMagicSlots = typeof sheetData.unlocked_magic_slots === 'number' ? sheetData.unlocked_magic_slots : 3;
  let magicSlotsApSpent = 0;
  for (let s = 4; s <= Math.min(15, unlockedMagicSlots); s++) {
    if (s <= 8) magicSlotsApSpent += 1;
    else if (s <= 12) magicSlotsApSpent += 2;
    else if (s <= 15) magicSlotsApSpent += 3;
  }

  const magicItemsNet = magicSlotsApSpent;

  const armory = Array.isArray(sheetData.armory) ? sheetData.armory : [];
  const skilledShields = armory.filter((s: any) => s && s.sk);
  const shieldsNet = Math.max(0, (skilledShields.length - 1) * 1);

  const knownSkillsets = Array.isArray(sheetData.known_skillsets) ? sheetData.known_skillsets : [];
  const knownIndivSkills = Array.isArray(sheetData.known_individual_skills) ? sheetData.known_individual_skills : [];
  const skillsetCost = Math.max(0, (knownSkillsets.length - 1) * 2);
  const indivCost = knownIndivSkills.length * 1;
  const skillsNet = skillsetCost + indivCost;

  const vitalityNet = Math.max(0, sumLogCategory('Vitality'));

  const weapons = Array.isArray(sheetData.weapons) ? sheetData.weapons : [];
  const skilledWeapons = weapons.filter((w: any) => w && w.sk);
  const weaponsNet = Math.max(0, (skilledWeapons.length - 1) * 1);

  const categories = {
    Armor: armorNet,
    Attributes: attributesNet,
    Capstones: capstonesNet,
    Focus: focusNet,
    'GM Bonus': gmBonus,
    'Magic Items': magicItemsNet,
    Powers: powersNet,
    Shields: shieldsNet,
    Skills: skillsNet,
    Vitality: vitalityNet,
    Weapons: weaponsNet,
  };

  const totalSpent =
    armorNet +
    attributesNet +
    capstonesNet +
    focusNet +
    magicItemsNet +
    powersNet +
    shieldsNet +
    skillsNet +
    vitalityNet +
    weaponsNet;

  return { totalSpent, gmBonus, categories };
};

export const parseAbilityVersion = (name: string): { baseName: string; version: number } => {
  if (!name) return { baseName: '', version: 1 };
  const match = name.match(/^(.*?)(?:\s+v(\d+))?$/i);
  if (match) {
    return {
      baseName: (match[1] || name).trim(),
      version: match[2] ? parseInt(match[2], 10) : 1,
    };
  }
  return { baseName: name.trim(), version: 1 };
};

export const calculateSpentAp = (logOrSheet?: any): number => {
  if (!logOrSheet) return 0;
  if (Array.isArray(logOrSheet)) {
    return logOrSheet.reduce((sum, entry) => {
      if (!entry) return sum;
      if (entry.category === 'GM Bonus' || entry.category === 'Manual') return sum;
      const cost = typeof entry.cost === 'number' && !isNaN(entry.cost) ? entry.cost : 0;
      return sum + cost;
    }, 0);
  }
  return calculateLiveSheetSpentAp(logOrSheet).totalSpent;
};

export const calculateGmBonusAp = (logOrSheet?: any): number => {
  if (!logOrSheet) return 0;
  if (Array.isArray(logOrSheet)) {
    return logOrSheet.reduce((sum, entry) => {
      if (!entry || (entry.category !== 'GM Bonus' && entry.category !== 'Manual')) return sum;
      const bonus = typeof entry.cost === 'number' && !isNaN(entry.cost) ? entry.cost : 0;
      return sum + bonus;
    }, 0);
  }
  return calculateLiveSheetSpentAp(logOrSheet).gmBonus;
};

export const calculateAvailableAp = (level: number, logOrSheet?: any, _rawApField?: number): number => {
  const lifetime = calculateLifetimeAp(level);
  let spent = 0;
  let gmBonus = 0;

  if (logOrSheet && typeof logOrSheet === 'object' && !Array.isArray(logOrSheet)) {
    const liveData = calculateLiveSheetSpentAp(logOrSheet);
    spent = liveData.totalSpent;
    gmBonus = liveData.gmBonus;
  } else {
    spent = calculateSpentAp(logOrSheet);
    gmBonus = calculateGmBonusAp(logOrSheet);
  }

  const calculated = lifetime + gmBonus - spent;
  return Math.max(0, calculated);
};

export const calculateMovementRate = (sheetData: any): { armored: number; shield: string | number } => {
  if (!sheetData) return { armored: 6, shield: 'n/a' };

  // 1. Armored MR Calculation
  const armorSlot = sheetData.armor_slot;
  let armoredMR = 6;

  if (
    armorSlot &&
    armorSlot.id !== 'arm_none' &&
    armorSlot.name &&
    armorSlot.name.toLowerCase() !== 'unarmored' &&
    armorSlot.name.toLowerCase() !== 'no armor'
  ) {
    const rawMr = armorSlot.mr || armorSlot.mr_adjustment || '';
    const mrMatch = String(rawMr).match(/\d+/);
    if (mrMatch) {
      armoredMR = parseInt(mrMatch[0], 10);
    }
  }

  if (
    typeof sheetData.movement_rate?.armored === 'number' &&
    !isNaN(sheetData.movement_rate.armored) &&
    (!armorSlot || !armorSlot.mr)
  ) {
    armoredMR = sheetData.movement_rate.armored;
  }

  // 2. Shield Drawn MR Calculation
  const shieldSlot = sheetData.shield_slot;
  const isShieldEquipped = Boolean(
    shieldSlot &&
      shieldSlot.id !== 'shd_none' &&
      shieldSlot.name &&
      shieldSlot.name.toLowerCase() !== 'none' &&
      shieldSlot.equipped !== false
  );

  let shieldDrawnMR: string | number = 'n/a';

  if (isShieldEquipped) {
    const mrAdjustmentStr = shieldSlot.mr_adjustment || shieldSlot.mr || shieldSlot.effect || '0';
    const match = String(mrAdjustmentStr).match(/-?\d+/);
    const penalty = match ? parseInt(match[0], 10) : 0;
    shieldDrawnMR = Math.max(0, armoredMR + penalty);
  }

  return { armored: armoredMR, shield: shieldDrawnMR };
};


export interface Player {
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}


export interface VaultItem {
  id: string;
  title: string;
  description: string;
  type: 'coins' | 'magic_item' | 'art_gem' | 'document' | 'junk' | 'quality' | 'special';
  rarity: 'Minor' | 'Lesser' | 'Greater' | 'Epic';
  essenceValue: number;
  coinsSilver?: number;
  coinsGold?: number;
  magicItem?: any;
  valuableName?: string;
  valuableVal?: string;
  passedBy: string;
  timestamp: string;
}

export interface MagicItem {
  id: number;
  name: string;
  genres?: string[];
  usage: string | null;
  action: string | null;
  effect: string | null;
  notes?: string;
  pic?: string;
  created_at: string;
  category?: string;
  sub?: string;
  table_name?: string;
  source?: string;
  version?: number;
  base_name?: string;
  slot_weight?: 1 | 2 | 3 | 4;
  rarity?: 'Minor' | 'Lesser' | 'Greater' | 'Relic' | 'Epic';
  cost?: string; // Optional cost for Hardware items
  is_hardware?: boolean; // True if purchased hardware item
}

/** Canonical S-Tier type aliases for Relic, Hardware, and Loadout */
export type Relic = MagicItem;

export interface HardwareItem extends MagicItem {
  cost: string; // Required cost (e.g. "150s", "2g")
  is_hardware: true;
}

export type LoadoutItem = MagicItem | HardwareItem;

export interface Skillset {
  id: number;
  name: string;
  genres?: string[];
  skills: string[];
  source: string | null;
  notes?: string;
  created_at: string;
}

export interface UserProfile {
  email: string;
  first_name?: string;
  last_name?: string;
  player_name?: string;
  allow_cloning: boolean;
  created_at?: string;
}

export interface Party {
  id: string;
  name: string;
  gm_email: string;
  invited_emails: string[];
  room_code?: string | null;
  is_active?: boolean;
  is_gm_swap_window_active?: boolean; // GM toggle for Character Vault swapping
  last_active_at?: string | null;
  created_at: string;
}

export interface PartySessionMember {
  id: string;
  party_id: string;
  player_email: string;
  character_id: number;
  tab_session_id: string;
  joined_at: string;
  last_seen: string;
  character?: Character;
  player_first_name?: string;
}

export type AuthMode = 'login' | 'signup' | 'reset_password' | 'profile';

