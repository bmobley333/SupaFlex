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
  version?: number;
  base_name?: string;
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
}

export interface SupabaseArmor {
  id?: number;
  name: string;
  requirement: string;
  ar: string;
  mr: string;
  cost: string;
  created_at?: string;
}

export interface SupabaseGear {
  id?: number;
  category: string;
  name: string;
  cost: string;
  created_at?: string;
}

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
  requirement: string;
  max_block: string;
  mr: string;
  description?: string;
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
  type: string;
  requirement: string;
  atk: string;
  dmg: string;
  max_block: string;
  cost: string;
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
}

export interface CharacterSheetData {
  level: number;
  ap: number;
  free_augment_tokens?: number;
  ap_log?: ApLogEntry[];
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
  gold?: number;
  silver?: number;
  other_treasure?: TreasureItem[];
  simple_gear?: SimpleGearItem[];
  known_skillsets: string[];
  known_individual_skills?: string[]; // Individually learned skills outside a skillset
  favorite_power_tables?: string[]; // Favorited power tables (table_name strings)
  custom_power_tables?: { name: string; sub: string }[]; // Custom user-created power tables
  custom_powers?: Power[]; // Custom user-created powers
  custom_magic_items?: MagicItem[]; // Custom user-created magic items
  ability_overrides?: Record<string, { action?: string; usage?: string; effect?: string }>; // Player edits for existing stock abilities
  power_slots: AbilitySlot[];
  spell_slots: AbilitySlot[];
  gear_slots: EquipmentSlot[];
  weapons?: WeaponSlot[];
  armor_slot?: ArmorData;
  wardrobe?: ArmorData[];
  shield_slot?: ShieldData;
  armory?: ShieldData[];
  movement_rate?: MovementRateData;
  bio: CharacterBio;
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

  const magicItems = Array.isArray(sheetData.custom_magic_items) ? sheetData.custom_magic_items : [];
  const magicItemsNet = magicItems.length * 1;

  const powerSlots = (sheetData.power_slots || []).filter(Boolean);
  const totalPowerUnits = powerSlots.reduce((sum: number, slot: any) => sum + (slot?.version || 1), 0);
  const powersNet = Math.max(0, totalPowerUnits - 3);

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
  version?: number;
  base_name?: string;
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
  version?: number;
  base_name?: string;
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
