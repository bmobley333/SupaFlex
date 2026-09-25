import { supabase, supabaseUrl, supabaseKey } from '../lib/supabase';
import {
  Character,
  Power,
  MagicItem,
  SupabaseSkill,
  SupabaseTrait,
  CharacterSheetData,
  DieRating,
  SupabaseArmor,
  SupabaseWeapon,
  SupabaseShield,
  SupabaseSupply,
  SupabaseMonster,
  SupabaseChaosGem,
  ChaosGemSlot,
  DEFAULT_CHAOS_GAUNTLET_SLOTS,
  LootMainEntry,
  CustomCreationItem,
  PowerTable,
  SupabasePath,
  PathLinkedElement,
  SupabaseSet,
  SetCategory,
  SetMemberItem,
  SupabaseKit,
  SupabaseBundle,
  FunctionItem,
  GearPowerItem,
  ModItem,
  PlayerRecord,
} from '../types/game';
import { GmAdventure } from '../types/adventures';
import { generateRoomId, sanitizeRoomCodeInput } from '../utils/roomId';
import { isGuildSpaceUnlocked } from '../utils/guildspaceAuth';
import { resolveArtifactCatalog, CatalogArtifact, ArtifactTier } from '../utils/artifactCatalogResolver';
import { resolveExoticCatalog, CatalogExotic, ExoticTier } from '../utils/exoticCatalogResolver';
import { updateCharacterSheetCanonicalItem, removeCharacterSheetCanonicalItem, CanonicalPropagationParams, CanonicalEntityType } from '../utils/canonicalPropagation';
import { isBelongsToMatch, splitBelongsToTargets, cleanBelongsToName } from '../utils/gearFunctionSync';
import { parseItemPaths, isPathStringMatch } from '../utils/pathApUtils';
import { cleanPathName } from '../utils/kitUtils';

export interface CatalogScope {
  userEmail?: string;
  subscribedEmails?: string[];
}

export function applyOwnerScope(query: any, scope?: CatalogScope): any {
  if (!scope || (!scope.userEmail && (!scope.subscribedEmails || scope.subscribedEmails.length === 0))) {
    return query.eq('owner', 'Designer');
  }

  const allowedOwners = ['Designer'];
  if (scope.userEmail && scope.userEmail.trim()) {
    allowedOwners.push(scope.userEmail.trim().toLowerCase());
  }
  if (Array.isArray(scope.subscribedEmails)) {
    for (const sub of scope.subscribedEmails) {
      if (sub && sub.trim()) {
        const cleanSub = sub.trim().toLowerCase();
        if (!allowedOwners.includes(cleanSub)) {
          allowedOwners.push(cleanSub);
        }
      }
    }
  }

  return query.in('owner', allowedOwners);
}

let cachedSupabaseMonsters: SupabaseMonster[] | null = null;

const DEFAULT_UNARMORED_SLOT = {
  id: 'arm_none',
  name: 'Unarmored',
  sk: true,
  ar: 0,
  requirement: '💪 4',
  mr: '👣8',
};

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
  armor_slot: DEFAULT_UNARMORED_SLOT,
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
  essence_core: 0,
  known_skillsets: [],
  power_slots: [],
  character_power_codex: [],
  tactical_pivot_used_in_encounter: false,
  spell_slots: [],
  stance_beta_slots: [],
  active_stance: 'alpha',
  stance_switch_count: 0,
  cold_storage_functions: [],
  loadout_expansions_purchased: 0,
  unlocked_loadout_slots: 5,
  gear_slots: [],
  chaos_gauntlet_slots: DEFAULT_CHAOS_GAUNTLET_SLOTS,
  bio: {
    backstory: '',
    personality: '',
    image_url: '',
    notes: '',
  },
});

export function ensureLatestSheetSchema(rawSheet: any): CharacterSheetData {
  const defaultSheet = createDefaultSheetData();
  if (!rawSheet || typeof rawSheet !== 'object') {
    return defaultSheet;
  }

  const rawGauntletSlots = Array.isArray(rawSheet.chaos_gauntlet_slots) ? rawSheet.chaos_gauntlet_slots : [];
  const mergedGauntletSlots: ChaosGemSlot[] = DEFAULT_CHAOS_GAUNTLET_SLOTS.map((defSlot) => {
    const found = rawGauntletSlots.find((s: any) => s && s.slot_id === defSlot.slot_id);
    return found ? { ...defSlot, ...found } : defSlot;
  });

  // Deep-merge fallback to guarantee no missing properties cause runtime exceptions
  return {
    ...defaultSheet,
    ...rawSheet,
    essence_core: rawSheet.essence_core ?? defaultSheet.essence_core ?? 0,
    attribute_dice: {
      ...defaultSheet.attribute_dice,
      ...(rawSheet.attribute_dice || {}),
    },
    bio: {
      ...defaultSheet.bio,
      ...(rawSheet.bio || {}),
    },
    known_skillsets: Array.isArray(rawSheet.known_skillsets) ? rawSheet.known_skillsets : [],
    power_slots: Array.isArray(rawSheet.power_slots) ? rawSheet.power_slots : [],
    character_power_codex: Array.isArray(rawSheet.character_power_codex) ? rawSheet.character_power_codex : [],
    tactical_pivot_used_in_encounter: rawSheet.tactical_pivot_used_in_encounter ?? false,
    spell_slots: Array.isArray(rawSheet.spell_slots) ? rawSheet.spell_slots : [],
    stance_beta_slots: Array.isArray(rawSheet.stance_beta_slots) ? rawSheet.stance_beta_slots : [],
    active_stance: rawSheet.active_stance === 'beta' ? 'beta' : 'alpha',
    stance_switch_count: typeof rawSheet.stance_switch_count === 'number' ? rawSheet.stance_switch_count : 0,
    cold_storage_functions: Array.isArray(rawSheet.cold_storage_functions) ? rawSheet.cold_storage_functions : [],
    character_vault: Array.isArray(rawSheet.character_vault) ? rawSheet.character_vault : [],
    gear_slots: Array.isArray(rawSheet.gear_slots) ? rawSheet.gear_slots : [],
    weapons: Array.isArray(rawSheet.weapons) ? rawSheet.weapons : [],
    simple_gear: Array.isArray(rawSheet.simple_gear) ? rawSheet.simple_gear : [],
    chaos_gauntlet_slots: mergedGauntletSlots,
    loadout_expansions_purchased: typeof rawSheet.loadout_expansions_purchased === 'number'
      ? rawSheet.loadout_expansions_purchased
      : (typeof rawSheet.unlocked_loadout_slots === 'number'
        ? Math.max(0, rawSheet.unlocked_loadout_slots - 5)
        : (typeof rawSheet.unlocked_magic_slots === 'number'
          ? Math.max(0, rawSheet.unlocked_magic_slots - 5)
          : 0)),
    unlocked_loadout_slots: typeof rawSheet.unlocked_loadout_slots === 'number'
      ? Math.max(5, rawSheet.unlocked_loadout_slots)
      : (typeof rawSheet.loadout_expansions_purchased === 'number'
        ? 5 + rawSheet.loadout_expansions_purchased
        : 5),
  };
}

export const normalizeCharacterData = (c: Character): Character => {
  const rawSheet = ensureLatestSheetSchema(c.sheet_data);

  const vitalityMax = rawSheet.vitality_max ?? c.hp ?? 10;
  const currentVitality = rawSheet.current_vitality ?? c.hp ?? vitalityMax;

  // Filter out any blank/empty legacy objects where name is empty or whitespace
  const cleanPowerSlots = (rawSheet.power_slots || []).filter((s) => s && s.name && s.name.trim() !== '');
  const cleanSpellSlots = (rawSheet.spell_slots || []).filter((s) => s && s.name && s.name.trim() !== '');
  const cleanWeapons = (rawSheet.weapons || []).filter((w) => w && w.name && w.name.trim() !== '');
  const cleanSimpleGear = (rawSheet.simple_gear || []).filter((g) => g && g.name && g.name.trim() !== '');
  const cleanSkillsets = (rawSheet.known_skillsets?.length ? rawSheet.known_skillsets : c.skills || []).filter(
    (s) => s && typeof s === 'string' && s.trim() !== ''
  );
  const rawIndiv = (rawSheet.known_individual_skills || []).filter(
    (s) => s && typeof s === 'string' && s.trim() !== ''
  );
  const indivSeen = new Set<string>();
  const cleanIndividualSkills: string[] = [];
  for (const sk of rawIndiv) {
    const normalized = sk.trim().toLowerCase() === 'nish (mso)' ? 'Nish' : sk.trim();
    if (!indivSeen.has(normalized.toLowerCase())) {
      indivSeen.add(normalized.toLowerCase());
      cleanIndividualSkills.push(normalized);
    }
  }

  const normalizedSheet: CharacterSheetData = {
    ...rawSheet,
    vitality_max: vitalityMax,
    current_vitality: currentVitality,
    armor_slot: rawSheet.armor_slot || DEFAULT_UNARMORED_SLOT,
    power_slots: cleanPowerSlots,
    spell_slots: cleanSpellSlots,
    weapons: cleanWeapons,
    simple_gear: cleanSimpleGear,
    known_skillsets: cleanSkillsets,
    known_individual_skills: cleanIndividualSkills,
    attribute_dice: {
      might: ((rawSheet.attribute_dice?.might || c.might || 'd4') as DieRating),
      motion: ((rawSheet.attribute_dice?.motion || c.motion || 'd4') as DieRating),
      mind: ((rawSheet.attribute_dice?.mind || c.mind || 'd4') as DieRating),
      magic: ((rawSheet.attribute_dice?.magic || c.magic || 'd4') as DieRating),
      moxie: ((rawSheet.attribute_dice?.moxie || c.moxie || 'd4') as DieRating),
    },
  };

  return {
    ...c,
    hp: vitalityMax,
    might: normalizedSheet.attribute_dice.might,
    motion: normalizedSheet.attribute_dice.motion,
    mind: normalizedSheet.attribute_dice.mind,
    magic: normalizedSheet.attribute_dice.magic,
    moxie: normalizedSheet.attribute_dice.moxie,
    sheet_data: normalizedSheet,
  };
};

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
    return (data || []).map((c: any) => normalizeCharacterData(c as Character));
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
    return data ? normalizeCharacterData(data as Character) : null;
  },

  async createCharacter(name: string, characterClass = 'Adventurer', race = 'Human', ownerEmail?: string): Promise<Character> {
    const defaultSheet = createDefaultSheetData();
    let resolvedEmail = ownerEmail?.trim();
    if (!resolvedEmail) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedEmail = authData?.user?.email || 'metascapegame@gmail.com';
    }

    const cleanEmail = resolvedEmail.trim().toLowerCase();
    await this.ensurePlayerProfile(cleanEmail);

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
        owner_email: cleanEmail,
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

  async getCharactersSummary(): Promise<Character[]> {
    const { data, error } = await supabase
      .from('characters')
      .select('id, name, class, race, hp, might, motion, mind, magic, moxie, skills, inventory, owner_email, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[gameApi] Error fetching characters summary:', error);
      throw error;
    }
    return (data || []).map((c: any) => normalizeCharacterData(c as Character));
  },

  async updateCharacter(id: number, updates: Partial<Character>): Promise<Character> {
    const payload: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.sheet_data) {
      const sd = updates.sheet_data as CharacterSheetData;
      if (sd.vitality_max !== undefined) payload.hp = sd.vitality_max;
      if (sd.attribute_dice) {
        if (sd.attribute_dice.might) payload.might = sd.attribute_dice.might;
        if (sd.attribute_dice.motion) payload.motion = sd.attribute_dice.motion;
        if (sd.attribute_dice.mind) payload.mind = sd.attribute_dice.mind;
        if (sd.attribute_dice.magic) payload.magic = sd.attribute_dice.magic;
        if (sd.attribute_dice.moxie) payload.moxie = sd.attribute_dice.moxie;
      }
      if (sd.known_skillsets) payload.skills = sd.known_skillsets;
      if (sd.gear_slots) payload.inventory = sd.gear_slots;
    }

    // Project scalar columns only to eliminate redundant 70 KB response egress per save
    const { data, error } = await supabase
      .from('characters')
      .update(payload)
      .eq('id', id)
      .select('id, name, class, race, hp, might, motion, mind, magic, moxie, skills, inventory, owner_email, updated_at')
      .single();

    if (error) {
      console.error(`[gameApi] Error updating character ${id}:`, error);
      throw error;
    }
    const merged: Character = {
      ...(data as any),
      sheet_data: (updates.sheet_data || payload.sheet_data || {}) as any,
    };
    return normalizeCharacterData(merged);
  },

  async deleteCharacter(id: number): Promise<void> {
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (error) {
      console.error(`[gameApi] Error deleting character ${id}:`, error);
      throw error;
    }
  },

  // --- POWERS & POWER TABLES ---
  async getPowerTables(): Promise<PowerTable[]> {
    return [];
  },

  async savePowerTable(_payload: Partial<PowerTable>): Promise<PowerTable | null> {
    return null;
  },

  async getPowers(scope?: CatalogScope): Promise<Power[]> {
    let query = supabase.from('powers').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching powers:', error);
      return [];
    }
    return (data || []) as Power[];
  },

  // --- ARTIFACTS, EXOTICS & LOADOUT CATALOG ---
  async getArtifacts(scope?: CatalogScope): Promise<CatalogArtifact[]> {
    const isGs = isGuildSpaceUnlocked();

    let suppliesQuery = applyOwnerScope(supabase.from('supplies').select('*').or('category.ilike.artifact,cost.ilike.artifact'), scope);
    let weaponsQuery = applyOwnerScope(supabase.from('weapons').select('*').ilike('cost', 'artifact'), scope);
    let armorQuery = applyOwnerScope(supabase.from('armor').select('*').ilike('cost', 'artifact'), scope);
    let shieldsQuery = applyOwnerScope(supabase.from('shields').select('*').ilike('cost', 'artifact'), scope);

    if (!isGs) {
      suppliesQuery = suppliesQuery.not('name', 'ilike', '%(mso)%');
      weaponsQuery = weaponsQuery.not('name', 'ilike', '%(mso)%');
      armorQuery = armorQuery.not('name', 'ilike', '%(mso)%');
      shieldsQuery = shieldsQuery.not('name', 'ilike', '%(mso)%');
    }

    const [suppliesRes, weaponsRes, armorRes, shieldsRes, fnsRes] = await Promise.all([
      suppliesQuery.order('name', { ascending: true }),
      weaponsQuery.order('name', { ascending: true }),
      armorQuery.order('name', { ascending: true }),
      shieldsQuery.order('name', { ascending: true }),
      this.getFunctions(scope),
    ]);

    const { allArtifacts } = resolveArtifactCatalog(
      suppliesRes.data || [],
      weaponsRes.data || [],
      armorRes.data || [],
      shieldsRes.data || [],
      fnsRes || []
    );

    return allArtifacts;
  },

  async getArtifactsByTier(tier: ArtifactTier, scope?: CatalogScope): Promise<CatalogArtifact[]> {
    const artifacts = await this.getArtifacts(scope);
    return artifacts.filter((a) => a.artifact_tier === tier);
  },

  async getRelics(scope?: CatalogScope): Promise<MagicItem[]> {
    return this.getArtifacts(scope);
  },

  async getExotics(scope?: CatalogScope): Promise<CatalogExotic[]> {
    const isGs = isGuildSpaceUnlocked();

    let suppliesQuery = applyOwnerScope(supabase.from('supplies').select('*').neq('category', 'Artifact').neq('cost', 'Artifact'), scope);
    let weaponsQuery = applyOwnerScope(supabase.from('weapons').select('*').neq('cost', 'Artifact'), scope);
    let armorQuery = applyOwnerScope(supabase.from('armor').select('*').neq('cost', 'Artifact'), scope);
    let shieldsQuery = applyOwnerScope(supabase.from('shields').select('*').neq('cost', 'Artifact'), scope);

    if (!isGs) {
      suppliesQuery = suppliesQuery.not('name', 'ilike', '%(mso)%');
      weaponsQuery = weaponsQuery.not('name', 'ilike', '%(mso)%');
      armorQuery = armorQuery.not('name', 'ilike', '%(mso)%');
      shieldsQuery = shieldsQuery.not('name', 'ilike', '%(mso)%');
    }

    const [suppliesRes, weaponsRes, armorRes, shieldsRes, fnsRes, modsRes] = await Promise.all([
      suppliesQuery.order('name', { ascending: true }),
      weaponsQuery.order('name', { ascending: true }),
      armorQuery.order('name', { ascending: true }),
      shieldsQuery.order('name', { ascending: true }),
      this.getFunctions(scope),
      this.getMods(scope),
    ]);

    const { allExotics } = resolveExoticCatalog(
      suppliesRes.data || [],
      weaponsRes.data || [],
      armorRes.data || [],
      shieldsRes.data || [],
      fnsRes || [],
      modsRes || []
    );

    return allExotics;
  },

  async getExoticsByTier(tier: ExoticTier, scope?: CatalogScope): Promise<CatalogExotic[]> {
    const exotics = await this.getExotics(scope);
    return exotics.filter((e) => e.exotic_tier === tier);
  },

  async getGearPowers(scope?: CatalogScope): Promise<GearPowerItem[]> {
    let query = supabase.from('gear_powers').select('*');
    query = applyOwnerScope(query, scope);
    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      console.error('[gameApi] Error fetching gear powers catalog:', error);
      return [];
    }
    return (data || []) as GearPowerItem[];
  },

  async getFunctions(scope?: CatalogScope): Promise<FunctionItem[]> {
    return this.getGearPowers(scope);
  },

  async getMods(scope?: CatalogScope): Promise<ModItem[]> {
    let query = supabase.from('mods').select('*');
    query = applyOwnerScope(query, scope);
    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      console.error('[gameApi] Error fetching mods catalog:', error);
      return [];
    }
    return (data || []) as ModItem[];
  },

  async getHardware(scope?: CatalogScope): Promise<MagicItem[]> {
    return this.getExotics(scope);
  },

  async getLoadoutCatalog(scope?: CatalogScope): Promise<MagicItem[]> {
    const [artifacts, exotics] = await Promise.all([
      this.getArtifacts(scope),
      this.getExotics(scope),
    ]);
    const combined = [...artifacts, ...exotics];
    combined.sort((a, b) => a.name.localeCompare(b.name));
    return combined;
  },

  async getMagicItems(scope?: CatalogScope): Promise<MagicItem[]> {
    return this.getLoadoutCatalog(scope);
  },

  // --- SKILLS & SKILLSETS ---
  async getSkills(scope?: CatalogScope): Promise<SupabaseSkill[]> {
    let query = supabase.from('skills').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching skills:', error);
      return [];
    }
    return (data || []) as SupabaseSkill[];
  },

  // --- TRAITS & RULE MODIFIERS ---
  async getTraits(scope?: CatalogScope): Promise<SupabaseTrait[]> {
    let query = supabase.from('traits').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      try {
        let fallbackQuery = supabase.from('spec_rules').select('*');
        fallbackQuery = applyOwnerScope(fallbackQuery, scope);
        const fallback = await fallbackQuery;
        if (fallback.data) return fallback.data as SupabaseTrait[];
      } catch (_) {}
      console.error('[gameApi] Error fetching traits:', error);
      return [];
    }
    return (data || []) as SupabaseTrait[];
  },

  async getSpecRules(): Promise<SupabaseTrait[]> {
    return this.getTraits();
  },

  async getRules(): Promise<SupabaseTrait[]> {
    return this.getTraits();
  },

  async createTrait(newTrait: Omit<SupabaseTrait, 'id' | 'created_at'>): Promise<SupabaseTrait> {
    const { data: maxRows } = await supabase
      .from('traits')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    const nextId = maxRows && maxRows.length > 0 && maxRows[0].id ? maxRows[0].id + 1 : 1;

    const { data, error } = await supabase
      .from('traits')
      .insert({ ...newTrait, id: nextId })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom trait:', error);
      throw error;
    }
    return data as SupabaseTrait;
  },

  async createSpecRule(newRule: Omit<SupabaseTrait, 'id' | 'created_at'>): Promise<SupabaseTrait> {
    return this.createTrait(newRule);
  },

  async createRule(newRule: Omit<SupabaseTrait, 'id' | 'created_at'>): Promise<SupabaseTrait> {
    return this.createTrait(newRule);
  },

  // --- PATHS CATALOG (AP Character Suites) ---
  async getPaths(scope?: CatalogScope): Promise<SupabasePath[]> {
    let query = supabase.from('paths').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      // Fallback for legacy schema
      let fallbackQuery = supabase.from('kits').select('*');
      fallbackQuery = applyOwnerScope(fallbackQuery, scope);
      if (!isGuildSpaceUnlocked()) {
        fallbackQuery = fallbackQuery.not('name', 'ilike', '%(mso)%');
      }
      const fallback = await fallbackQuery.order('name', { ascending: true });
      if (fallback.data) return fallback.data as SupabasePath[];
      console.error('[gameApi] Error fetching paths catalog:', error);
      return [];
    }
    return (data || []) as SupabasePath[];
  },

  // --- SETS CATALOG (Capability Suites: Traits, Skills, Powers, Weapons, Armor & Shields) ---
  async getSets(scope?: CatalogScope): Promise<SupabaseSet[]> {
    let query = supabase.from('sets').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      console.error('[gameApi] Error fetching sets catalog:', error);
      return [];
    }
    return (data || []) as SupabaseSet[];
  },

  // --- SET MEMBERSHIP METHODS ---
  async getSetMembers(setName: string, category: SetCategory): Promise<SetMemberItem[]> {
    if (!setName || !setName.trim()) return [];
    const cleanName = setName.trim();
    const members: SetMemberItem[] = [];

    try {
      const cat = (category || '').toLowerCase();
      if (cat.includes('weapon')) {
        const { data, error } = await supabase
          .from('weapons')
          .select('*')
          .contains('sets', [cleanName]);
        if (!error && data) {
          data.forEach((w) => {
            members.push({
              id: w.id,
              name: w.name,
              category: 'Weapons',
              table: 'weapons',
              requirement: w.requirement,
              action: w.type,
              usage: w.atk,
              effect: w.dmg,
              notes: w.notes,
              domain: w.domain,
              sets: w.sets || [],
              ...w,
            });
          });
        }
      } else if (cat.includes('armor') || cat.includes('shield')) {
        const [armorRes, shieldRes] = await Promise.all([
          supabase.from('armor').select('*').contains('sets', [cleanName]),
          supabase.from('shields').select('*').contains('sets', [cleanName]),
        ]);
        if (armorRes.data) {
          armorRes.data.forEach((a) => {
            members.push({
              id: a.id,
              name: a.name,
              category: 'Armor & Shields',
              table: 'armor',
              requirement: a.requirement,
              action: `AR ${a.ar}`,
              usage: `MR ${a.mr}`,
              effect: a.notes,
              notes: a.notes,
              domain: a.domain,
              sets: a.sets || [],
              ...a,
            });
          });
        }
        if (shieldRes.data) {
          shieldRes.data.forEach((s) => {
            members.push({
              id: s.id,
              name: s.name,
              category: 'Armor & Shields',
              table: 'shields',
              requirement: s.requirement,
              action: `Block ${s.max_block}`,
              usage: `MR ${s.mr}`,
              effect: s.notes,
              notes: s.notes,
              domain: s.domain,
              sets: s.sets || [],
              ...s,
            });
          });
        }
      } else if (cat.includes('power')) {
        const { data, error } = await supabase
          .from('powers')
          .select('*')
          .contains('sets', [cleanName]);
        if (!error && data) {
          data.forEach((p) => {
            members.push({
              id: p.id,
              name: p.name,
              category: 'Powers',
              table: 'powers',
              action: p.action,
              usage: p.usage,
              effect: p.effect,
              notes: p.notes,
              discipline: p.discipline,
              sets: p.sets || [],
              ...p,
            });
          });
        }
      } else if (cat.includes('skill')) {
        const { data, error } = await supabase
          .from('skills')
          .select('*')
          .contains('sets', [cleanName]);
        if (!error && data) {
          data.forEach((s) => {
            members.push({
              id: s.id,
              name: s.name,
              category: 'Skills',
              table: 'skills',
              attribute: s.attribute,
              discipline: s.discipline,
              notes: s.notes,
              sets: s.sets || [],
              ...s,
            });
          });
        }
      } else if (cat.includes('trait')) {
        const { data, error } = await supabase
          .from('traits')
          .select('*')
          .contains('sets', [cleanName]);
        if (!error && data) {
          data.forEach((t) => {
            members.push({
              id: t.id,
              name: t.name,
              category: 'Traits',
              table: 'traits',
              effect: t.effect,
              notes: t.notes,
              discipline: t.discipline,
              cost: t.cost,
              sets: t.sets || [],
              ...t,
            });
          });
        }
      }
    } catch (err) {
      console.error(`[gameApi] Error fetching members for set '${cleanName}':`, err);
    }

    return members;
  },

  async batchUpdateSetMembership(
    setName: string,
    category: SetCategory,
    targetMemberIds: (string | number)[]
  ): Promise<boolean> {
    if (!setName || !setName.trim()) return false;
    const cleanName = setName.trim();
    const targetSet = new Set(targetMemberIds.map((id) => String(id)));
    const cat = (category || '').toLowerCase();

    const targetTables: ('weapons' | 'armor' | 'shields' | 'powers' | 'skills' | 'traits')[] = [];
    if (cat.includes('weapon')) targetTables.push('weapons');
    else if (cat.includes('armor') || cat.includes('shield')) targetTables.push('armor', 'shields');
    else if (cat.includes('power')) targetTables.push('powers');
    else if (cat.includes('skill')) targetTables.push('skills');
    else if (cat.includes('trait')) targetTables.push('traits');

    try {
      for (const table of targetTables) {
        // 1. Find all items currently containing setName
        const { data: existingItems, error: fetchErr } = await supabase
          .from(table)
          .select('id, sets')
          .contains('sets', [cleanName]);
        if (fetchErr) {
          console.error(`[batchUpdateSetMembership] Error querying ${table}:`, fetchErr);
          continue;
        }

        // Remove setName from items no longer in targetMemberIds
        for (const item of existingItems || []) {
          if (!targetSet.has(String(item.id))) {
            const nextSets = (item.sets || []).filter((s: string) => s !== cleanName);
            await supabase.from(table).update({ sets: nextSets }).eq('id', item.id);
          }
        }

        // 2. Add setName to items in targetMemberIds that are in this table
        if (targetMemberIds.length > 0) {
          const { data: targetsToAdd, error: addQueryErr } = await supabase
            .from(table)
            .select('id, sets')
            .in('id', targetMemberIds);
          if (!addQueryErr && targetsToAdd) {
            for (const item of targetsToAdd) {
              const currentSets: string[] = item.sets || [];
              if (!currentSets.includes(cleanName)) {
                await supabase.from(table).update({ sets: [...currentSets, cleanName] }).eq('id', item.id);
              }
            }
          }
        }
      }
      return true;
    } catch (err) {
      console.error(`[batchUpdateSetMembership] Error updating set membership for '${cleanName}':`, err);
      return false;
    }
  },

  async mergeMultipleSets(sourceSetNames: string[], category: SetCategory): Promise<SetMemberItem[]> {
    if (!sourceSetNames || sourceSetNames.length === 0) return [];
    const aggregated: SetMemberItem[] = [];
    const seenKeys = new Set<string>();

    for (const sName of sourceSetNames) {
      if (!sName || !sName.trim()) continue;
      const members = await this.getSetMembers(sName, category);
      for (const m of members) {
        const key = `${m.table}_${m.id}_${m.name.toLowerCase().trim()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          aggregated.push(m);
        }
      }
    }
    return aggregated;
  },

  async checkDuplicateSet(
    category: SetCategory,
    candidateMemberIds: (string | number)[],
    baseSetNames?: string[]
  ): Promise<{ isDuplicate: boolean; duplicateSetName?: string }> {
    if (!candidateMemberIds) return { isDuplicate: false };
    const candSet = new Set(candidateMemberIds.map((id) => String(id)));

    // Check against specific base sets if provided
    if (baseSetNames && baseSetNames.length > 0) {
      // Check multi-merge exact match
      const mergedMembers = await this.mergeMultipleSets(baseSetNames, category);
      if (mergedMembers.length === candSet.size && candSet.size > 0) {
        const mergedIds = new Set(mergedMembers.map((m) => String(m.id)));
        const allMatch = Array.from(candSet).every((id) => mergedIds.has(id));
        if (allMatch) {
          return {
            isDuplicate: true,
            duplicateSetName: baseSetNames.length === 1 ? baseSetNames[0] : baseSetNames.join(' + '),
          };
        }
      }
    }

    // Also check against all existing sets in this category
    const allSets = await this.getSets();
    const catSets = allSets.filter(
      (s) => s.category?.toLowerCase() === (category || '').toLowerCase()
    );

    for (const existingSet of catSets) {
      const existingMembers = await this.getSetMembers(existingSet.name, category);
      if (existingMembers.length === candSet.size && candSet.size > 0) {
        const existingIds = new Set(existingMembers.map((m) => String(m.id)));
        const allMatch = Array.from(candSet).every((id) => existingIds.has(id));
        if (allMatch) {
          return { isDuplicate: true, duplicateSetName: existingSet.name };
        }
      }
    }

    return { isDuplicate: false };
  },

  // --- KITS CATALOG (Equipment & Hardware Suites) ---
  async getKits(scope?: CatalogScope): Promise<SupabasePath[]> {
    // For backwards compatibility with existing UI stores that call getKits() for Race/Class paths
    return this.getPaths(scope);
  },

  // --- EQUIPMENT KITS & BUNDLES CATALOG ---
  async getBundles(scope?: CatalogScope): Promise<SupabaseBundle[]> {
    let query = supabase.from('kits').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) {
      console.error('[gameApi] Error fetching kits catalog:', error);
      return [];
    }
    return (data || []) as SupabaseBundle[];
  },

  async getEquipmentKits(scope?: CatalogScope): Promise<SupabaseKit[]> {
    return this.getBundles(scope);
  },

  // --- ARMOR CATALOG ---
  async getArmor(scope?: CatalogScope): Promise<SupabaseArmor[]> {
    let query = supabase.from('armor').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching armor catalog:', error);
      return [];
    }
    return (data || []) as SupabaseArmor[];
  },

  async createArmor(newArmor: Omit<SupabaseArmor, 'id' | 'created_at'>): Promise<SupabaseArmor> {
    const { data: maxRows } = await supabase
      .from('armor')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    const nextId = maxRows && maxRows.length > 0 && maxRows[0].id ? maxRows[0].id + 1 : 1;

    const { data, error } = await supabase
      .from('armor')
      .insert({ ...newArmor, id: nextId, owner: newArmor.owner || 'Designer' })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom armor:', error);
      throw error;
    }
    return data as SupabaseArmor;
  },

  // --- WEAPONS CATALOG ---
  async getWeapons(scope?: CatalogScope): Promise<SupabaseWeapon[]> {
    let query = supabase.from('weapons').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching weapons catalog:', error);
      return [];
    }
    return (data || []) as SupabaseWeapon[];
  },

  async createWeapon(newWeapon: Omit<SupabaseWeapon, 'id' | 'created_at'>): Promise<SupabaseWeapon> {
    const { data: maxRows } = await supabase
      .from('weapons')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    const nextId = maxRows && maxRows.length > 0 && maxRows[0].id ? maxRows[0].id + 1 : 1;

    const { data, error } = await supabase
      .from('weapons')
      .insert({ ...newWeapon, id: nextId, owner: newWeapon.owner || 'Designer' })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom weapon:', error);
      throw error;
    }
    return data as SupabaseWeapon;
  },

  // --- SHIELDS CATALOG ---
  async getShields(scope?: CatalogScope): Promise<SupabaseShield[]> {
    let query = supabase.from('shields').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching shields catalog:', error);
      return [];
    }
    return (data || []) as SupabaseShield[];
  },

  async createShield(newShield: Omit<SupabaseShield, 'id' | 'created_at'>): Promise<SupabaseShield> {
    const { data: maxRows } = await supabase
      .from('shields')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    const nextId = maxRows && maxRows.length > 0 && maxRows[0].id ? maxRows[0].id + 1 : 1;

    const { data, error } = await supabase
      .from('shields')
      .insert({ ...newShield, id: nextId, owner: newShield.owner || 'Designer' })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom shield:', error);
      throw error;
    }
    return data as SupabaseShield;
  },

  // --- SUPPLIES & GEAR CATALOG ---
  async getEquipment(scope?: CatalogScope): Promise<SupabaseSupply[]> {
    return this.getSupplies(scope);
  },

  async getGear(scope?: CatalogScope): Promise<SupabaseSupply[]> {
    return this.getSupplies(scope);
  },

  async getSupplies(scope?: CatalogScope): Promise<SupabaseSupply[]> {
    let query = supabase.from('supplies').select('*');
    query = applyOwnerScope(query, scope);
    if (!isGuildSpaceUnlocked()) {
      query = query.not('name', 'ilike', '%(mso)%');
    }
    const { data, error } = await query
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching supplies catalog:', error);
      return [];
    }
    return (data || []) as SupabaseSupply[];
  },

  async getChaosGems(scope?: CatalogScope): Promise<SupabaseChaosGem[]> {
    try {
      let query = supabase.from('chaos_gems').select('*');
      query = applyOwnerScope(query, scope);
      const { data, error } = await query.order('name', { ascending: true });
      if (error) {
        console.error('[gameApi] Error fetching chaos gems catalog:', error);
        return [];
      }
      return (data || []).map((item: any) => ({
        ...item,
        genres: Array.isArray(item.genres)
          ? item.genres
          : typeof item.genres === 'string'
          ? JSON.parse(item.genres || '[]')
          : ['Medieval', 'Modern', 'SciFi'],
      }));
    } catch (e) {
      console.error('[gameApi] Error in getChaosGems:', e);
      return [];
    }
  },

  async createGear(newGear: Omit<SupabaseSupply, 'id' | 'created_at'>): Promise<SupabaseSupply> {
    return this.createSupply(newGear);
  },

  async createSupply(newSupply: Omit<SupabaseSupply, 'id' | 'created_at'>): Promise<SupabaseSupply> {
    const { data, error } = await supabase
      .from('supplies')
      .insert(newSupply)
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom supply:', error);
      throw error;
    }
    return data as SupabaseSupply;
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

  // --- USER PROFILE & PRIVACY ---
  async ensurePlayerProfile(email: string, defaultName?: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return false;

    const parts = (defaultName || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    // 1. Primary Attempt: Standard Supabase client upsert
    const { error: upsertErr } = await supabase
      .from('players')
      .upsert(
        { email: cleanEmail, first_name: firstName, last_name: lastName, allow_cloning: true },
        { onConflict: 'email' }
      );

    if (!upsertErr) return true;

    console.warn('[gameApi] Notice ensuring player profile via standard client (likely RLS restriction), initiating service-role fallback:', upsertErr);

    // 2. Fail-Safe Service-Role REST Fallback
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/players`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          email: cleanEmail,
          first_name: firstName,
          last_name: lastName,
          allow_cloning: true,
        }),
      });

      if (res.ok) {
        console.log('[gameApi] Service-role fallback successfully auto-provisioned player profile for:', cleanEmail);
        return true;
      } else {
        const errText = await res.text();
        console.error('[gameApi] Service-role fallback failed:', res.status, errText);
      }
    } catch (fallbackErr) {
      console.error('[gameApi] Error during service-role fallback:', fallbackErr);
    }

    return false;
  },

  async getUserProfile(email: string, defaultFullName?: string): Promise<{ email: string; allow_cloning: boolean; allow_subscriptions: boolean; player_name?: string; first_name?: string; last_name?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('players')
      .select('email, allow_cloning, allow_subscriptions, first_name, last_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.error('[gameApi] Error fetching player profile:', error);
    }

    if (data) {
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
      const allowSub = data.allow_subscriptions ?? data.allow_cloning ?? true;
      if (!fullName && defaultFullName && defaultFullName.trim()) {
        await this.updatePlayerName(cleanEmail, defaultFullName);
        const parts = defaultFullName.trim().split(/\s+/);
        return {
          email: data.email,
          allow_cloning: data.allow_cloning ?? true,
          allow_subscriptions: allowSub,
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' ') || '',
          player_name: defaultFullName.trim(),
        };
      }
      return {
        email: data.email,
        allow_cloning: data.allow_cloning ?? true,
        allow_subscriptions: allowSub,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        player_name: fullName,
      };
    }

    // Try RPC fallback (for target player clone permission checks under strict RLS)
    try {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_player_cloning_profile', { target_email: cleanEmail });
      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0 && rpcRows[0]) {
        const targetProf = rpcRows[0];
        return {
          email: targetProf.email || cleanEmail,
          allow_cloning: targetProf.allow_cloning ?? true,
          allow_subscriptions: targetProf.allow_subscriptions ?? targetProf.allow_cloning ?? true,
          player_name: targetProf.player_name || '',
        };
      }
    } catch (rpcErr) {
      console.warn('[gameApi] RPC fallback check failed for:', cleanEmail, rpcErr);
    }

    // Auto-create profile if missing using fail-safe provisioner
    await this.ensurePlayerProfile(cleanEmail, defaultFullName);

    const { data: created } = await supabase
      .from('players')
      .select('email, allow_cloning, allow_subscriptions, first_name, last_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (created && created.email) {
      const createdFullName = [created.first_name, created.last_name].filter(Boolean).join(' ').trim();
      return {
        email: created.email,
        allow_cloning: created.allow_cloning ?? true,
        allow_subscriptions: created.allow_subscriptions ?? created.allow_cloning ?? true,
        first_name: created.first_name || '',
        last_name: created.last_name || '',
        player_name: createdFullName,
      };
    }

    const parts = (defaultFullName || '').trim().split(/\s+/);
    return {
      email: cleanEmail,
      allow_cloning: true,
      allow_subscriptions: true,
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      player_name: defaultFullName?.trim() || '',
    };
  },

  async verifyAccountExists(email: string): Promise<{ exists: boolean; allowSubscriptions: boolean; playerName?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { exists: false, allowSubscriptions: false };

    try {
      // 1. Check players table directly
      const { data: player, error } = await supabase
        .from('players')
        .select('email, first_name, last_name, allow_cloning, allow_subscriptions')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (!error && player) {
        const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ').trim();
        const allowSub = player.allow_subscriptions ?? player.allow_cloning ?? true;
        return {
          exists: true,
          allowSubscriptions: Boolean(allowSub),
          playerName: fullName || cleanEmail,
        };
      }

      // 2. Check if the author has any creations in canonical tables
      const { count: powersCount } = await supabase
        .from('powers')
        .select('id', { count: 'exact', head: true })
        .ilike('owner', cleanEmail);

      if ((powersCount || 0) > 0) {
        return { exists: true, allowSubscriptions: true, playerName: cleanEmail };
      }

      const { count: pathsCount } = await supabase
        .from('paths')
        .select('id', { count: 'exact', head: true })
        .ilike('owner', cleanEmail);

      if ((pathsCount || 0) > 0) {
        return { exists: true, allowSubscriptions: true, playerName: cleanEmail };
      }

      return { exists: false, allowSubscriptions: false };
    } catch (e) {
      console.error('[gameApi] Error in verifyAccountExists:', e);
      return { exists: false, allowSubscriptions: false };
    }
  },

  async updateProfilePrivacy(email: string, allowCloning: boolean): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase
      .from('players')
      .upsert({ email: cleanEmail, allow_cloning: allowCloning, allow_subscriptions: allowCloning }, { onConflict: 'email' });

    if (error) {
      console.error('[gameApi] Error updating profile privacy:', error);
      return false;
    }
    return true;
  },

  async updatePlayerName(email: string, playerName: string, tabSessionId?: string, activePartyId?: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const trimmed = playerName.trim();
    const parts = trimmed.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const { error } = await supabase
      .from('players')
      .upsert({ email: cleanEmail, first_name: firstName, last_name: lastName }, { onConflict: 'email' });

    if (error) {
      console.error('[gameApi] Error updating player name:', error);
      return false;
    }

    if (tabSessionId) {
      const nowStr = new Date().toISOString();
      await supabase
        .from('party_session_members')
        .update({ player_email: cleanEmail, last_seen: nowStr })
        .eq('tab_session_id', tabSessionId);
    }

    if (activePartyId) {
      try {
        const channel = supabase.channel(`party:${activePartyId}`);
        await channel.send({
          type: 'broadcast',
          event: 'party_members_updated',
          payload: { partyId: activePartyId, player_email: cleanEmail, first_name: firstName, timestamp: new Date().toISOString() },
        });
      } catch (bcErr) {
        console.warn('[gameApi] Notice broadcasting player name update:', bcErr);
      }
    }

    return true;
  },

  async getPlayers(): Promise<PlayerRecord[]> {
    const { data, error } = await supabase
      .from('players')
      .select('email, first_name, last_name, allow_cloning, created_at')
      .not('email', 'ilike', 'system_%')
      .order('last_name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching players:', error);
      return [];
    }
    return (data || []) as PlayerRecord[];
  },

  async getCatalogBeacon(): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('players')
        .select('first_name')
        .eq('email', 'system_catalogs_version@supaflex.local')
        .maybeSingle();
      return data?.first_name || null;
    } catch {
      return null;
    }
  },

  async updateCatalogBeacon(): Promise<string> {
    const nowIso = new Date().toISOString();
    try {
      await supabase
        .from('players')
        .upsert({
          email: 'system_catalogs_version@supaflex.local',
          first_name: nowIso,
          last_name: 'catalog_beacon_v1',
        });

      const ch = supabase.channel('system_catalogs_global');
      await ch.send({
        type: 'broadcast',
        event: 'catalog_version_updated',
        payload: { timestamp: nowIso },
      });
    } catch (e) {
      console.warn('[gameApi] Notice updating catalog beacon:', e);
    }
    return nowIso;
  },

  // --- CHARACTERS BY OWNER ---
  async getCharactersByOwner(ownerEmail: string): Promise<Character[]> {
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('owner_email', cleanEmail)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[gameApi] Error fetching characters for owner:', error);
      throw error;
    }

    return (data || []).map(normalizeCharacterData);
  },

  // --- CHARACTER CLONING ---
  async cloneCharacterToUser(sourceCharacter: Character, targetEmail: string): Promise<Character> {
    const cleanEmail = targetEmail.trim().toLowerCase();
    await this.ensurePlayerProfile(cleanEmail);

    // 1. Check target user's existing character names to resolve collision
    const existingChars = await this.getCharactersByOwner(cleanEmail);
    const existingNames = new Set(existingChars.map(c => c.name.toLowerCase()));

    let newName = sourceCharacter.name;
    if (existingNames.has(newName.toLowerCase())) {
      let candidate = `${sourceCharacter.name} (Copy)`;
      let counter = 2;
      while (existingNames.has(candidate.toLowerCase())) {
        candidate = `${sourceCharacter.name} (Copy ${counter})`;
        counter++;
      }
      newName = candidate;
    }

    // 2. Clone fields
    const { data, error } = await supabase
      .from('characters')
      .insert({
        name: newName,
        class: sourceCharacter.class || '',
        race: sourceCharacter.race || '',
        hp: sourceCharacter.hp || 10,
        might: sourceCharacter.might || 'd6',
        motion: sourceCharacter.motion || 'd6',
        mind: sourceCharacter.mind || 'd4',
        magic: sourceCharacter.magic || 'd4',
        moxie: sourceCharacter.moxie || 'd8',
        skills: sourceCharacter.skills || [],
        inventory: sourceCharacter.inventory || [],
        log: sourceCharacter.log || [],
        sheet_data: sourceCharacter.sheet_data || {},
        owner_email: cleanEmail,
      })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error cloning character:', error);
      throw error;
    }

    return normalizeCharacterData(data as Character);
  },

  // --- PARTIES & MULTI-TAB SESSIONS ---
  async getPartiesForUser(userEmail: string) {
    const cleanEmail = userEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .eq('gm_email', cleanEmail)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[gameApi] Error fetching parties:', error);
      return [];
    }

    return data || [];
  },

  async createParty(name: string, gmEmail: string, _invitedEmails: string[] = []) {
    const cleanGm = (gmEmail || 'gm-guest@supaflex.internal').trim().toLowerCase();
    const partyName = (name || 'GM Campaign').trim();
    const code = generateRoomId();

    const { data, error } = await supabase
      .from('parties')
      .insert({
        gm_email: cleanGm,
        name: partyName,
        party_code: code,
        room_code: code,
        status: 'active',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating party:', error);
      throw error;
    }

    return data;
  },

  async joinPartySession(partyIdOrCode: string, playerEmail: string, characterId: number, tabSessionId: string) {
    const cleanEmail = playerEmail.trim().toLowerCase();

    // Call Atomic DB Function (RPC) to guarantee atomic deletion of stale tab/character sessions and fresh insert
    let partyUuid: string | null = null;
    try {
      const { data: rpcPartyUuid, error: rpcErr } = await supabase.rpc('join_party_session_atomic', {
        p_party_code: partyIdOrCode,
        p_email: cleanEmail,
        p_char_id: characterId,
        p_tab_id: tabSessionId,
      });

      if (!rpcErr && rpcPartyUuid) {
        partyUuid = rpcPartyUuid;
      }
    } catch (rpcCatch) {
      console.warn('[gameApi] join_party_session_atomic RPC fallback:', rpcCatch);
    }

    // Direct fallback if RPC is not deployed yet in dev
    if (!partyUuid) {
      let targetPartyUuid = partyIdOrCode;

      if (partyIdOrCode.length === 4) {
        const party = await this.findActivePartyByRoomCode(partyIdOrCode);
        if (party) {
          targetPartyUuid = party.id;
        }
      }

      await supabase
        .from('party_session_members')
        .delete()
        .or(`tab_session_id.eq.${tabSessionId},character_id.eq.${characterId}`);

      const { error } = await supabase
        .from('party_session_members')
        .insert({
          party_id: targetPartyUuid,
          player_email: cleanEmail,
          character_id: characterId,
          tab_session_id: tabSessionId,
          last_seen: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[gameApi] Error joining party session:', error);
        throw error;
      }
      partyUuid = targetPartyUuid;
    }

    // Broadcast WebSocket event on single canonical channel: party:${partyUuid} (Blueprint Section 2.D)
    try {
      const channelUuid = supabase.channel(`party:${partyUuid}`);
      await channelUuid.send({
        type: 'broadcast',
        event: 'party_members_updated',
        payload: { partyId: partyUuid, character_id: characterId, tab_session_id: tabSessionId, timestamp: new Date().toISOString() },
      });
      await channelUuid.send({
        type: 'broadcast',
        event: 'party.joined',
        payload: { partyId: partyUuid, character_id: characterId, tab_session_id: tabSessionId, timestamp: new Date().toISOString() },
      });
    } catch (bcErr) {
      console.warn('[gameApi] Notice broadcasting member join:', bcErr);
    }

    return { party_uuid: partyUuid, tab_session_id: tabSessionId, character_id: characterId };
  },

  async leavePartySession(tabSessionId: string, partyId?: string) {
    let targetPartyId = partyId;
    if (!targetPartyId) {
      const { data } = await supabase
        .from('party_session_members')
        .select('party_id')
        .eq('tab_session_id', tabSessionId)
        .maybeSingle();
      if (data) targetPartyId = (data as any).party_id;
    }

    const { error } = await supabase
      .from('party_session_members')
      .delete()
      .eq('tab_session_id', tabSessionId);

    if (error) {
      console.error('[gameApi] Error leaving party session:', error);
    } else if (targetPartyId) {
      try {
        const channel = supabase.channel(`party:${targetPartyId}`);
        await channel.send({
          type: 'broadcast',
          event: 'party_members_updated',
          payload: { partyId: targetPartyId, tab_session_id: tabSessionId, timestamp: new Date().toISOString() },
        });
        await channel.send({
          type: 'broadcast',
          event: 'party.left',
          payload: { partyId: targetPartyId, tab_session_id: tabSessionId, timestamp: new Date().toISOString() },
        });
      } catch (bcErr) {
        console.warn('[gameApi] Notice broadcasting member leave:', bcErr);
      }
    }
  },

  async dismissPartyMember(partyId: string, characterId: number) {
    if (!partyId || !characterId) return;

    let targetUuid = partyId;
    if (partyId.length === 4) {
      const p = await this.findActivePartyByRoomCode(partyId);
      if (p) targetUuid = p.id;
    }

    const { error } = await supabase
      .from('party_session_members')
      .delete()
      .eq('character_id', characterId);

    if (error) {
      console.error('[gameApi] Error dismissing party member:', error);
      throw error;
    }

    try {
      const channel = supabase.channel(`party:${targetUuid}`);
      await channel.send({
        type: 'broadcast',
        event: 'party_members_updated',
        payload: { partyId: targetUuid, character_id: characterId, timestamp: new Date().toISOString() },
      });
      await channel.send({
        type: 'broadcast',
        event: 'party.left',
        payload: { partyId: targetUuid, character_id: characterId, timestamp: new Date().toISOString() },
      });
    } catch (e) {
      console.warn('[gameApi] Notice broadcasting dismiss:', e);
    }
  },

  async ensureTabPartySession(partyIdOrCode: string, tabSessionId: string, characterId: number, playerEmail: string): Promise<boolean> {
    if (!partyIdOrCode || !tabSessionId || !characterId) return false;

    let targetPartyUuid = partyIdOrCode;
    if (partyIdOrCode.length === 4) {
      const party = await this.findActivePartyByRoomCode(partyIdOrCode);
      if (party) {
        targetPartyUuid = party.id;
      } else {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('supaflex_active_party_id');
        }
        return false;
      }
    }

    try {
      // 1. Verify that the GM party is still active, has a valid room code, and is not stale (>90s absence/power loss)
      const { data: partyRecord } = await supabase
        .from('parties')
        .select('id, is_active, status, room_code, last_active_at')
        .eq('id', targetPartyUuid)
        .maybeSingle();

      const lastActiveTime = partyRecord?.last_active_at ? new Date(partyRecord.last_active_at).getTime() : 0;
      const elapsedSeconds = (Date.now() - lastActiveTime) / 1000;
      const isStale = elapsedSeconds > 90;

      if (!partyRecord || !partyRecord.is_active || partyRecord.status === 'expired' || !partyRecord.room_code || isStale) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('supaflex_active_party_id');
        }
        return false;
      }

      const { data } = await supabase
        .from('party_session_members')
        .select('id')
        .eq('party_id', targetPartyUuid)
        .eq('tab_session_id', tabSessionId)
        .maybeSingle();

      if (!data) {
        console.log(`[gameApi] Self-healing session for tab ${tabSessionId} in party ${targetPartyUuid}...`);
        await this.joinPartySession(targetPartyUuid, playerEmail || 'player', characterId, tabSessionId);
      } else {
        await this.sendPlayerHeartbeat(tabSessionId);
      }
      return true;
    } catch (e) {
      console.warn('[gameApi] Error in ensureTabPartySession:', e);
      return false;
    }
  },

  async getPartySessionMembers(partyIdOrCode: string) {
    if (!partyIdOrCode) return [];

    let targetPartyUuid = partyIdOrCode;

    if (partyIdOrCode.length === 4) {
      const party = await this.findActivePartyByRoomCode(partyIdOrCode);
      if (party) {
        targetPartyUuid = party.id;
      }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPartyUuid);

    let query = supabase
      .from('party_session_members')
      .select('id, party_id, character_id, player_email, tab_session_id, last_seen, character:characters(id, name, race, class, hp, current_vitality:sheet_data->current_vitality, vitality_max:sheet_data->vitality_max, current_nish:sheet_data->current_nish)')
      .order('character_id', { ascending: true });

    if (isUuid) {
      query = query.eq('party_id', targetPartyUuid);
    } else {
      query = query.eq('party_code', targetPartyUuid.toUpperCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[gameApi] Error fetching party session members:', error);
      return [];
    }

    // Fetch player profiles to attach first_name for roster card display
    const uniqueEmails = Array.from(new Set((data || []).map((m: any) => (m.player_email || '').toLowerCase()).filter(Boolean)));
    const playerProfileMap = new Map<string, string>();
    if (uniqueEmails.length > 0) {
      const { data: playersData } = await supabase
        .from('players')
        .select('email, first_name')
        .in('email', uniqueEmails);
      (playersData || []).forEach((p) => {
        if (p.email && p.first_name) {
          playerProfileMap.set(p.email.toLowerCase(), p.first_name);
        }
      });
    }

    // Strict deduplication by character_id (keeping newest last_seen row)
    const memberMap = new Map<number, any>();
    (data || []).forEach((m: any) => {
      // Normalize character vitals and nish for 100% backward compatibility with components reading sheet_data
      if (m.character) {
        const curVit = m.character.current_vitality ?? m.character.hp ?? 28;
        const maxVit = m.character.vitality_max ?? 28;
        const rawNish = m.character.current_nish ?? (m.character as any)?.sheet_data?.current_nish;
        const curNish = rawNish !== undefined && rawNish !== null && String(rawNish).trim() !== '' ? rawNish : undefined;
        m.character.sheet_data = {
          ...(m.character.sheet_data || {}),
          current_vitality: curVit,
          vitality_max: maxVit,
          ...(curNish !== undefined ? { current_nish: curNish } : {}),
        };
        m.character.current_vitality = curVit;
        m.character.vitality_max = maxVit;
        if (curNish !== undefined) {
          (m.character as any).current_nish = curNish;
        }
      }

      const existing = memberMap.get(m.character_id);
      if (!existing || new Date(m.last_seen) > new Date(existing.last_seen)) {
        const emailKey = (m.player_email || '').toLowerCase();
        memberMap.set(m.character_id, {
          ...m,
          player_first_name: playerProfileMap.get(emailKey) || '',
        });
      }
    });

    // 100% deterministic backend sorting by character_id
    const sortedMembers = Array.from(memberMap.values()).sort((a, b) =>
      Number(a.character_id || 0) - Number(b.character_id || 0)
    );
    return sortedMembers;
  },

  async sendPlayerHeartbeat(tabSessionId: string) {
    if (!tabSessionId) return;

    try {
      const { error: rpcErr } = await supabase.rpc('send_player_heartbeat_atomic', {
        p_tab_id: tabSessionId,
      });
      if (!rpcErr) return;
    } catch (e) {
      // Fall through to direct table update if RPC fails
    }

    const nowStr = new Date().toISOString();
    await supabase
      .from('party_session_members')
      .update({ last_seen: nowStr })
      .eq('tab_session_id', tabSessionId);
  },

  async verifyActivePartySession(partyIdOrCode: string, tabSessionId: string): Promise<boolean> {
    if (!partyIdOrCode || !tabSessionId) return false;
    try {
      let targetPartyUuid = partyIdOrCode;

      if (partyIdOrCode.length === 4) {
        const party = await this.findActivePartyByRoomCode(partyIdOrCode);
        if (!party) return false;
        targetPartyUuid = party.id;
      } else {
        const { data: p } = await supabase.from('parties').select('room_code, is_active').eq('id', partyIdOrCode).maybeSingle();
        if (!p || !p.is_active) return false;
      }

      // Check if this tab is registered in party_session_members under targetPartyUuid
      const { data: memberData, error: memberErr } = await supabase
        .from('party_session_members')
        .select('id')
        .eq('party_id', targetPartyUuid)
        .eq('tab_session_id', tabSessionId)
        .maybeSingle();

      if (memberErr) {
        console.warn('[gameApi] Error querying memberData in verifyActivePartySession:', memberErr);
        return false;
      }

      return !!memberData;
    } catch (err) {
      console.warn('[gameApi] Exception verifying party session:', err);
      return false;
    }
  },

  // --- ROOM CODES & DISCONNECT HEARTBEAT ---
  async disbandPartySession(partyId: string) {
    if (!partyId) return;
    try {
      const channel = supabase.channel(`party:${partyId}`);
      await channel.send({
        type: 'broadcast',
        event: 'party.disbanded',
        payload: { partyId, timestamp: new Date().toISOString() },
      });
      await channel.send({
        type: 'broadcast',
        event: 'party.closed',
        payload: { partyId, timestamp: new Date().toISOString() },
      });
    } catch (e) {
      console.warn('[gameApi] Notice broadcasting party disband:', e);
    }

    try {
      await supabase
        .from('party_session_members')
        .delete()
        .eq('party_id', partyId);
    } catch (e) {
      console.warn('[gameApi] Error clearing party session members:', e);
    }
  },

  async checkoutPartyRoomCodeForGmEmail(gmEmail: string, forceNew: boolean = false): Promise<{ party: any; roomCode: string; isNewSession?: boolean }> {
    try {
      const cleanEmail = gmEmail.trim().toLowerCase();
      const existing = await this.getPartiesForUser(cleanEmail);
      let party = existing.find((p: any) => (p.gm_email || '').toLowerCase() === cleanEmail);

      if (!party) {
        party = await this.createParty('MetaScape Campaign', cleanEmail, []);
      }

      return await this.checkoutPartyRoomCode(party.id, forceNew);
    } catch (err: any) {
      console.warn('[gameApi] Room code checkout fallback:', err?.message || err);
      const fallbackCode = generateRoomId();
      return {
        party: { id: 'fallback-party-id', gm_email: gmEmail },
        roomCode: fallbackCode,
        isNewSession: true,
      };
    }
  },

  async checkoutPartyRoomCode(partyId: string, forceNew: boolean = false): Promise<{ party: any; roomCode: string; isNewSession: boolean }> {
    await this.cleanupStaleRooms();

    const { data: existingParty } = await supabase
      .from('parties')
      .select('*')
      .eq('id', partyId)
      .maybeSingle();

    const lastActiveTime = existingParty?.last_active_at ? new Date(existingParty.last_active_at).getTime() : 0;
    const elapsedSeconds = (Date.now() - lastActiveTime) / 1000;
    const isStale = elapsedSeconds > 90; // GM absence / power outage > 90s
    const isInactive = !existingParty?.is_active || !existingParty?.room_code || existingParty?.status === 'expired';
    const existingCode = existingParty?.room_code || existingParty?.party_code;

    // Quick F5 reload (<90 seconds): If active, valid code, and within threshold, preserve table & connected players
    if (!forceNew && !isStale && !isInactive && existingCode && existingCode.trim().length === 4) {
      await this.sendGmHeartbeat(partyId);
      return { party: existingParty, roomCode: existingCode.trim().toUpperCase(), isNewSession: false };
    }

    // New Session: Clean up previous session members and broadcast disband to lingering tabs
    await this.disbandPartySession(partyId);

    let attempts = 0;
    let candidate = '';
    let isCollision = true;

    while (isCollision && attempts < 10) {
      candidate = generateRoomId();
      attempts++;
      const { data } = await supabase
        .from('parties')
        .select('id')
        .eq('room_code', candidate)
        .eq('is_active', true);

      if (!data || data.length === 0) {
        isCollision = false;
      }
    }

    const nowStr = new Date().toISOString();
    const { data, error } = await supabase
      .from('parties')
      .update({
        room_code: candidate,
        party_code: candidate,
        status: 'active',
        is_active: true,
        last_active_at: nowStr,
      })
      .eq('id', partyId)
      .select()
      .single();

    if (error) {
      console.warn('[gameApi] Local room code checkout fallback due to DB update:', error.message);
      return { party: { id: partyId, room_code: candidate, party_code: candidate, is_active: true }, roomCode: candidate, isNewSession: true };
    }

    return { party: data, roomCode: candidate, isNewSession: true };
  },

  async sendGmHeartbeat(partyId: string) {
    const nowStr = new Date().toISOString();
    await supabase
      .from('parties')
      .update({
        is_active: true,
        last_active_at: nowStr,
      })
      .eq('id', partyId);
  },

  async closePartyRoom(partyId: string) {
    await this.disbandPartySession(partyId);
    await supabase
      .from('parties')
      .update({
        is_active: false,
        room_code: null,
        status: 'expired',
      })
      .eq('id', partyId);
  },

  closePartyRoomBeacon(partyId: string) {
    if (!partyId) return;
    try {
      // 1. Wipe party session members
      fetch(`${supabaseUrl}/rest/v1/party_session_members?party_id=eq.${encodeURIComponent(partyId)}`, {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        keepalive: true,
      }).catch(() => {});

      // 2. Mark party inactive/expired
      fetch(`${supabaseUrl}/rest/v1/parties?id=eq.${encodeURIComponent(partyId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ is_active: false, room_code: null, status: 'expired' }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {
      console.warn('[gameApi] Beacon error closing party room:', e);
    }
  },

  async cleanupStaleRooms() {
    const ninetySecsAgo = new Date(Date.now() - 90 * 1000).toISOString();
    try {
      const { data: staleParties } = await supabase
        .from('parties')
        .select('id')
        .eq('is_active', true)
        .lt('last_active_at', ninetySecsAgo);

      if (staleParties && staleParties.length > 0) {
        const ids = staleParties.map((p) => p.id);
        await supabase
          .from('party_session_members')
          .delete()
          .in('party_id', ids);

        await supabase
          .from('parties')
          .update({
            is_active: false,
            room_code: null,
            status: 'expired',
          })
          .in('id', ids);
      }
    } catch (e) {
      console.warn('[gameApi] Error cleaning up stale rooms:', e);
    }
  },

  async findActivePartyByRoomCode(rawCode: string) {
    const sanitized = sanitizeRoomCodeInput(rawCode);
    if (!sanitized || sanitized.length !== 4) return null;

    // NOTE: cleanupStaleRooms() has been intentionally removed from the player join path.
    // Calling it here was nuking rooms at the exact moment a player tried to join if the
    // GM heartbeat was even slightly late. Cleanup now only runs from checkoutPartyRoomCode
    // (GM-side) where it is appropriate.

    const { data, error } = await supabase
      .from('parties')
      .select('*')
      .or(`room_code.eq.${sanitized},party_code.eq.${sanitized}`)
      .neq('status', 'expired')
      .order('last_active_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[gameApi] Error finding party by room code:', error);
      return null;
    }

    return data;
  },

  async joinPartyByRoomCode(rawCode: string, playerEmail: string, characterId: number, tabSessionId: string) {
    const party = await this.findActivePartyByRoomCode(rawCode);
    if (!party) {
      throw new Error(`Party ID "${rawCode.toUpperCase()}" not found or has been closed by the GM.`);
    }

    const sessionMember = await this.joinPartySession(party.id, playerEmail, characterId, tabSessionId);
    return { party, sessionMember };
  },

  // --- MONSTER ROSTER SYNC & BROADCAST ---
  async getSupabaseMonsters(): Promise<SupabaseMonster[]> {
    if (cachedSupabaseMonsters && cachedSupabaseMonsters.length > 0) {
      return cachedSupabaseMonsters;
    }
    if (typeof window !== 'undefined') {
      try {
        const local = localStorage.getItem('supaflex_monsters_cache');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedSupabaseMonsters = parsed;
            return parsed;
          }
        }
      } catch {}
    }
    try {
      const { data, error } = await supabase
        .from('monsters')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[gameApi] Notice fetching master monsters table:', error.message);
        return [];
      }

      cachedSupabaseMonsters = (data as SupabaseMonster[]) || [];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('supaflex_monsters_cache', JSON.stringify(cachedSupabaseMonsters));
        } catch {}
      }
      return cachedSupabaseMonsters;
    } catch (e) {
      console.error('[gameApi] Error in getSupabaseMonsters:', e);
      return [];
    }
  },

  async getPartyMonsters(partyId: string) {
    try {
      let targetUuid = partyId;
      if (partyId && partyId.length === 4) {
        const p = await this.findActivePartyByRoomCode(partyId);
        if (p) targetUuid = p.id;
      }

      const { data, error } = await supabase
        .from('parties')
        .select('active_monsters')
        .eq('id', targetUuid)
        .single();

      if (error) {
        console.warn('[gameApi] Notice fetching party active monsters:', error.message);
        const fallback = localStorage.getItem(`supaflex_gm_monsters_${partyId}`);
        return fallback ? JSON.parse(fallback) : [];
      }

      return data?.active_monsters || [];
    } catch (e) {
      console.error('[gameApi] Error in getPartyMonsters:', e);
      return [];
    }
  },

  async savePartyMonsters(partyId: string, monsters: any[]) {
    try {
      let targetUuid = partyId;
      if (partyId && partyId.length === 4) {
        const p = await this.findActivePartyByRoomCode(partyId);
        if (p) targetUuid = p.id;
      }

      localStorage.setItem(`supaflex_gm_monsters_${partyId}`, JSON.stringify(monsters));
      localStorage.setItem(`supaflex_gm_monsters_${targetUuid}`, JSON.stringify(monsters));
      localStorage.setItem('supaflex_gm_monster_stats', JSON.stringify(monsters));

      const { error } = await supabase
        .from('parties')
        .update({ active_monsters: monsters })
        .eq('id', targetUuid);

      if (error) {
        console.warn('[gameApi] Supabase active_monsters update warning:', error.message);
      }

      // Send Realtime Broadcast event to all party members across all channel aliases
      const channelsToNotify = new Set<string>();
      channelsToNotify.add(`party:${targetUuid}`);
      channelsToNotify.add(`party:${partyId}`);
      channelsToNotify.add(`party_monsters_hud_${targetUuid}`);
      channelsToNotify.add(`party_monsters_hud_${partyId}`);

      for (const ch of channelsToNotify) {
        try {
          const channel = supabase.channel(ch);
          await channel.send({
            type: 'broadcast',
            event: 'monster_roster_updated',
            payload: { monsters },
          });
        } catch {}
      }
    } catch (e) {
      console.error('[gameApi] Error saving party monsters:', e);
    }
  },



  async getRandomChaosGem(genre?: string): Promise<SupabaseChaosGem | null> {
    try {
      const allGems = await this.getChaosGems();
      if (!allGems || allGems.length === 0) return null;
      const filtered = (!genre || genre === 'All')
        ? allGems
        : allGems.filter(g => !g.genres || g.genres.length === 0 || g.genres.includes(genre) || g.genres.includes('All'));
      const pool = filtered.length > 0 ? filtered : allGems;
      return pool[Math.floor(Math.random() * pool.length)];
    } catch (e) {
      console.error('[gameApi] Error in getRandomChaosGem:', e);
      return null;
    }
  },

  async createChaosGem(gem: Partial<SupabaseChaosGem>): Promise<SupabaseChaosGem | null> {
    try {
      const payload: any = {
        name: gem.name,
        effect: gem.effect || '',
        genres: gem.genres && gem.genres.length > 0 ? gem.genres : ['Medieval', 'Modern', 'SciFi'],
        notes: gem.notes || null,
        action: gem.action || 'F',
        usage: gem.usage || '3',
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('chaos_gems')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.warn('[gameApi] Warning inserting into chaos_gems:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('[gameApi] Error in createChaosGem:', e);
      return null;
    }
  },

  async createPower(power: any): Promise<Power | null> {
    try {
      const payload: any = {
        name: power.name,
        action: power.action || 'A',
        usage: power.usage || '1-Enc',
        effect: power.effect || '',
        genres: power.genres && power.genres.length > 0 ? power.genres : ['Medieval', 'Modern', 'SciFi'],
        path: power.path || 'General',
        discipline: power.discipline || 'Universal',
        notes: power.notes || null,
        category: power.category || 'Class',
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('powers').insert([payload]).select('*').single();
      if (error) {
        console.warn('[gameApi] Warning inserting into powers:', error.message);
        return null;
      }
      return data as Power;
    } catch (e) {
      console.error('[gameApi] Error in createPower:', e);
      return null;
    }
  },

  async createPath(pathItem: { name: string; category?: string; description?: string }): Promise<any | null> {
    try {
      const payload = {
        name: pathItem.name,
        category: pathItem.category || 'General',
        description: pathItem.description || '',
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('paths').insert([payload]).select('*').single();
      if (error) {
        console.warn('[gameApi] Warning inserting into paths:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('[gameApi] Error in createPath:', e);
      return null;
    }
  },

  async createSkill(skill: { name: string; attribute: string; sets?: string[]; skillset?: string[]; genres?: string[]; notes?: string; discipline?: string }): Promise<any | null> {
    try {
      const payload = {
        name: skill.name,
        attribute: skill.attribute,
        sets: skill.sets || skill.skillset || ['General'],
        genres: skill.genres && skill.genres.length > 0 ? skill.genres : ['Medieval', 'Modern', 'SciFi'],
        notes: skill.notes || null,
        discipline: skill.discipline || 'General',
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('skills').insert([payload]).select('*').single();
      if (error) {
        console.warn('[gameApi] Warning inserting into skills:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('[gameApi] Error in createSkill:', e);
      return null;
    }
  },

  async createGearPower(gearPower: { name: string; action?: string; usage?: string; effect: string; tier?: string; belongs_to?: string; genres?: string[]; notes?: string }): Promise<any | null> {
    try {
      const payload = {
        name: gearPower.name,
        action: gearPower.action || 'F',
        usage: gearPower.usage || '1-Enc',
        effect: gearPower.effect,
        tier: gearPower.tier || null,
        belongs_to: gearPower.belongs_to || '',
        genres: gearPower.genres && gearPower.genres.length > 0 ? gearPower.genres : ['Medieval', 'Modern', 'SciFi'],
        notes: gearPower.notes || null,
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('gear_powers').insert([payload]).select('*').single();
      if (error) {
        console.warn('[gameApi] Warning inserting into gear_powers:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('[gameApi] Error in createGearPower:', e);
      return null;
    }
  },

  async createKit(kitItem: { name: string; category?: string; description?: string; cost?: string; genres?: string[]; notes?: string }): Promise<any | null> {
    try {
      const payload = {
        name: kitItem.name,
        category: kitItem.category || 'General',
        description: kitItem.description || '',
        cost: kitItem.cost || '1g',
        genres: kitItem.genres && kitItem.genres.length > 0 ? kitItem.genres : ['Medieval', 'Modern', 'SciFi'],
        notes: kitItem.notes || null,
        domain: 'Tech',
        created_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('kits').insert([payload]).select('*').single();
      if (error) {
        console.warn('[gameApi] Warning inserting into kits:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('[gameApi] Error in createKit:', e);
      return null;
    }
  },

  // --- MASTER LOOT MATRIX (LOOT_MAIN) ---
  async getLootMainEntries(): Promise<LootMainEntry[]> {
    try {
      const { data, error } = await supabase
        .from('loot_main')
        .select('*')
        .order('range_min', { ascending: true });

      if (error) {
        console.warn('[gameApi] Notice fetching loot_main table:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('[gameApi] Error in getLootMainEntries:', e);
      return [];
    }
  },

  // --- S-TIER LINK-ONLY SUBSCRIPTION ENGINE ---
  async getSubscriptionsForUser(subscriberEmail: string): Promise<string[]> {
    if (!subscriberEmail) return [];
    try {
      const cleanEmail = subscriberEmail.trim().toLowerCase();
      const { data, error } = await supabase
        .from('player_subscriptions')
        .select('target_author_email')
        .ilike('subscriber_email', cleanEmail);
      if (error) {
        console.warn('[gameApi] Notice fetching subscriptions:', error.message);
        return [];
      }
      return (data || []).map((r: any) => r.target_author_email.trim().toLowerCase());
    } catch (e) {
      console.error('[gameApi] Error in getSubscriptionsForUser:', e);
      return [];
    }
  },

  async addSubscription(subscriberEmail: string, targetAuthorEmail: string): Promise<boolean> {
    if (!subscriberEmail || !targetAuthorEmail) return false;
    try {
      const cleanSub = subscriberEmail.trim().toLowerCase();
      const cleanTarget = targetAuthorEmail.trim().toLowerCase();
      if (cleanSub === cleanTarget) return false; // Cannot subscribe to self
      const { error } = await supabase
        .from('player_subscriptions')
        .upsert(
          [{ subscriber_email: cleanSub, target_author_email: cleanTarget }],
          { onConflict: 'subscriber_email,target_author_email' }
        );
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('[gameApi] Error in addSubscription:', e);
      return false;
    }
  },

  async removeSubscription(subscriberEmail: string, targetAuthorEmail: string): Promise<boolean> {
    if (!subscriberEmail || !targetAuthorEmail) return false;
    try {
      const cleanSub = subscriberEmail.trim().toLowerCase();
      const cleanTarget = targetAuthorEmail.trim().toLowerCase();
      const { error } = await supabase
        .from('player_subscriptions')
        .delete()
        .ilike('subscriber_email', cleanSub)
        .ilike('target_author_email', cleanTarget);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('[gameApi] Error in removeSubscription:', e);
      return false;
    }
  },

  // --- DISTRIBUTED CREATION & CURATION ENGINE (DC2E) ---
  async getPersonalCustomItems(authorEmail: string): Promise<CustomCreationItem[]> {
    if (!authorEmail) return [];
    try {
      const { data, error } = await supabase
        .from('custom_elements')
        .select('*')
        .ilike('author_email', authorEmail.trim())
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching personal custom elements:', error.message);
        return [];
      }
      return (data || []) as CustomCreationItem[];
    } catch (e) {
      console.error('[gameApi] Error in getPersonalCustomItems:', e);
      return [];
    }
  },

  async getPartyCustomItems(partyId: string, gmEmail?: string): Promise<CustomCreationItem[]> {
    if (!partyId) return [];
    try {
      const { data, error } = await supabase
        .from('custom_elements')
        .select('*')
        .eq('party_id', partyId.trim())
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching party custom elements:', error.message);
        return [];
      }

      const allPartyItems = (data || []) as CustomCreationItem[];
      // Role-Aware Filter: Items approved by GM, OR authored by the active GM (auto-approved)
      return allPartyItems.filter((item) => {
        if (item.gm_approved) return true;
        if (gmEmail && item.author_email?.toLowerCase().trim() === gmEmail.toLowerCase().trim()) {
          return true;
        }
        return false;
      });
    } catch (e) {
      console.error('[gameApi] Error in getPartyCustomItems:', e);
      return [];
    }
  },

  async getPendingPartySubmissions(partyId: string): Promise<CustomCreationItem[]> {
    if (!partyId) return [];
    try {
      const { data, error } = await supabase
        .from('custom_elements')
        .select('*')
        .eq('party_id', partyId.trim())
        .eq('gm_approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching pending party submissions:', error.message);
        return [];
      }
      return (data || []) as CustomCreationItem[];
    } catch (e) {
      console.error('[gameApi] Error in getPendingPartySubmissions:', e);
      return [];
    }
  },

  async getAllCustomItems(): Promise<CustomCreationItem[]> {
    try {
      const { data, error } = await supabase
        .from('custom_elements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching all custom elements:', error.message);
        return [];
      }
      return (data || []) as CustomCreationItem[];
    } catch (e) {
      console.error('[gameApi] Error in getAllCustomItems:', e);
      return [];
    }
  },

  async saveCustomItem(payload: Partial<CustomCreationItem>): Promise<CustomCreationItem | null> {
    try {
      const { data, error } = await supabase
        .from('custom_elements')
        .insert([
          {
            ...payload,
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data as CustomCreationItem;
    } catch (e) {
      console.error('[gameApi] Error in saveCustomItem:', e);
      throw e;
    }
  },

  async updateCustomItem(id: string, updates: Partial<CustomCreationItem>): Promise<CustomCreationItem | null> {
    try {
      const { data, error } = await supabase
        .from('custom_elements')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CustomCreationItem;
    } catch (e) {
      console.error('[gameApi] Error in updateCustomItem:', e);
      throw e;
    }
  },

  async deleteCustomItem(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('custom_elements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('[gameApi] Error in deleteCustomItem:', e);
      return false;
    }
  },

  // Aliases for Custom Elements
  async getPersonalCustomElements(authorEmail: string): Promise<CustomCreationItem[]> {
    return this.getPersonalCustomItems(authorEmail);
  },
  async saveCustomElement(payload: Partial<CustomCreationItem>): Promise<CustomCreationItem | null> {
    return this.saveCustomItem(payload);
  },
  async updateCustomElement(id: string, updates: Partial<CustomCreationItem>): Promise<CustomCreationItem | null> {
    return this.updateCustomItem(id, updates);
  },
  async deleteCustomElement(id: string): Promise<boolean> {
    return this.deleteCustomItem(id);
  },

  async promoteCustomItemToMaster(item: CustomCreationItem): Promise<boolean> {
    try {
      if (item.type === 'power_table') {
        const tablePayload = {
          name: item.name,
          category: item.category || 'Class',
          genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
          author_name: item.author_name,
          author_email: item.author_email,
          gm_approved: true,
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from('power_tables').insert([tablePayload]);
        if (insertError) throw insertError;
        await this.updateCustomItem(item.id, { is_promoted: true });
        return true;
      }

      if (item.type === 'weapon') {
        const weaponPayload = {
          name: item.name,
          type: item.item_data?.type || 'Melee',
          requirement: item.item_data?.requirement || '💪 4',
          atk: item.item_data?.atk || '💪',
          dmg: item.item_data?.dmg || '💪',
          max_block: item.item_data?.max_block || 'n/a',
          cost: item.item_data?.cost || '1g',
          notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
          genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from('weapons').insert([weaponPayload]);
        if (insertError) throw insertError;
        await this.updateCustomItem(item.id, { is_promoted: true });
        return true;
      }

      if (item.type === 'armor') {
        const armorPayload = {
          name: item.name,
          requirement: item.item_data?.requirement || '💪 4',
          ar: item.item_data?.ar || '4',
          mr: item.item_data?.mr || '-0',
          cost: item.item_data?.cost || '1g',
          notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
          genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from('armor').insert([armorPayload]);
        if (insertError) throw insertError;
        await this.updateCustomItem(item.id, { is_promoted: true });
        return true;
      }

      if (item.type === 'shield') {
        const shieldPayload = {
          name: item.name,
          requirement: item.item_data?.requirement || '💪 4',
          max_block: item.item_data?.max_block || '4',
          mr: item.item_data?.mr || '-0',
          cost: item.item_data?.cost || '1g',
          notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
          genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from('shields').insert([shieldPayload]);
        if (insertError) throw insertError;
        await this.updateCustomItem(item.id, { is_promoted: true });
        return true;
      }

      if (item.type === 'gear') {
        const gearPayload = {
          name: item.name,
          category: item.category || item.item_data?.category || 'Adventure',
          cost: item.item_data?.cost || '1s',
          notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
          genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from('gear').insert([gearPayload]);
        if (insertError) throw insertError;
        await this.updateCustomItem(item.id, { is_promoted: true });
        return true;
      }

      if (item.type === 'chaos_gem') {
        const chaosGemPayload: any = {
          name: item.name,
          effect: item.item_data?.effect || '',
          genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
          notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
          action: 'F',
          usage: '3',
          created_at: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from('chaos_gems').insert([chaosGemPayload]);
        if (insertError) throw insertError;
        await this.updateCustomItem(item.id, { is_promoted: true });
        return true;
      }

      const targetTable =
        item.type === 'power'
          ? 'powers'
          : (item.type === 'hardware' || item.type === 'exotic')
          ? 'exotics'
          : item.type === 'skillset'
          ? 'skillsets'
          : 'artifacts';

      const masterPayload: any = {
        name: item.name,
        category: item.category || (item.type === 'relic' ? 'Artifact' : 'Universal'),
        action: item.item_data?.action || 'A',
        usage: item.item_data?.usage || '1-Enc',
        effect: item.item_data?.effect || '',
        notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
        genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
        created_at: new Date().toISOString(),
      };

      if (item.type === 'power') {
        const assignedKit = item.item_data?.kit || item.item_data?.table_group || item.item_data?.table;
        if (assignedKit) {
          masterPayload.kit = assignedKit;
          masterPayload.table_group = assignedKit;
        }
      }
      if (item.type === 'hardware' && item.item_data?.cost) {
        masterPayload.cost = item.item_data.cost;
      }
      if (item.type === 'skillset' && item.item_data?.skills) {
        masterPayload.skills = item.item_data.skills;
      }

      const { error: insertError } = await supabase.from(targetTable).insert([masterPayload]);
      if (insertError) throw insertError;

      // Mark as promoted
      await this.updateCustomItem(item.id, { is_promoted: true });
      return true;
    } catch (e) {
      console.error('[gameApi] Error promoting custom item to master:', e);
      throw e;
    }
  },

  // --- GM ADVENTURES & ENCOUNTER PRE-STAGING ---
  async getAdventuresForUser(gmEmail: string): Promise<GmAdventure[]> {
    try {
      const cleanEmail = (gmEmail || '').trim().toLowerCase();
      const { data, error } = await supabase
        .from('adventures')
        .select('*')
        .or(`gm_email.ilike.${cleanEmail},gm_email.eq.metascapegame@gmail.com`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching adventures:', error.message);
        return [];
      }
      return (data || []).map((adv: any) => ({
        ...adv,
        links: adv.links || adv.structure?.links || [],
        loot: adv.loot || adv.structure?.loot || [],
      })) as GmAdventure[];
    } catch (e) {
      console.error('[gameApi] Error in getAdventuresForUser:', e);
      return [];
    }
  },

  async createAdventure(title: string, gmEmail: string, genre = 'Medieval'): Promise<GmAdventure | null> {
    try {
      const cleanEmail = (gmEmail || '').trim().toLowerCase();
      const nowIso = new Date().toISOString();
      const defaultStructure = {
        acts: [],
        links: [],
        loot: [],
      };

      const payload = {
        title: title.trim(),
        gm_email: cleanEmail,
        genre,
        is_active: true,
        structure: defaultStructure,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data, error } = await supabase
        .from('adventures')
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        console.error('[gameApi] Error creating adventure:', error);
        throw error;
      }
      const created = data as GmAdventure;
      return {
        ...created,
        links: created.links || created.structure?.links || [],
        loot: created.loot || created.structure?.loot || [],
      };
    } catch (e) {
      console.error('[gameApi] Error in createAdventure:', e);
      throw e;
    }
  },

  async updateAdventure(id: string, updates: Partial<GmAdventure>): Promise<GmAdventure | null> {
    try {
      // Build safe database payload containing only valid columns in public.adventures
      const safePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const allowedColumns = ['title', 'description', 'genre', 'is_active', 'is_published', 'gm_email', 'structure'];
      for (const col of allowedColumns) {
        if ((updates as any)[col] !== undefined) {
          safePayload[col] = (updates as any)[col];
        }
      }

      // If updates includes links or loot, ensure they are synced inside safePayload.structure
      if (updates.links !== undefined || updates.loot !== undefined) {
        const existingStructure = safePayload.structure || updates.structure || {};
        safePayload.structure = {
          ...existingStructure,
          ...(updates.links !== undefined ? { links: updates.links } : {}),
          ...(updates.loot !== undefined ? { loot: updates.loot } : {}),
        };
      }

      const { data, error } = await supabase
        .from('adventures')
        .update(safePayload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[gameApi] Error updating adventure:', error);
        throw error;
      }
      const updated = data as GmAdventure;
      return {
        ...updated,
        links: updates.links || updated.links || updated.structure?.links || [],
        loot: updates.loot || updated.loot || updated.structure?.loot || [],
      };
    } catch (e) {
      console.error('[gameApi] Error in updateAdventure:', e);
      throw e;
    }
  },

  async deleteAdventure(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('adventures')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[gameApi] Error deleting adventure:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('[gameApi] Error in deleteAdventure:', e);
      return false;
    }
  },

  // ==========================================
  // --- DESIGNER MODE: CANONICAL MASTER CRUD ---
  // Locked strictly to metascapegame@gmail.com via PostgreSQL RLS
  // ==========================================

  // 1. PATHS
  async syncPathLinkedSets(
    pathName: string,
    currentElements: PathLinkedElement[],
    previousElements?: PathLinkedElement[]
  ): Promise<boolean> {
    if (!pathName || !pathName.trim()) return false;
    const cleanPath = pathName.trim();

    try {
      // 1. Current linked sets map: SetName (lowercase) -> { originalName: string, tag: 'Free' | '1 AP' }
      const currentSetMap = new Map<string, { name: string; tag: string }>();
      (currentElements || [])
        .filter((el) => (el.type || el.element_type) === 'set' && el.name)
        .forEach((el) => {
          currentSetMap.set(el.name.trim().toLowerCase(), {
            name: el.name.trim(),
            tag: el.tag === 'Free' ? 'Free' : '1 AP',
          });
        });

      // 2. Previous linked sets (lowercase)
      const prevSetNames = new Set<string>();
      if (previousElements && previousElements.length > 0) {
        previousElements
          .filter((el) => (el.type || el.element_type) === 'set' && el.name)
          .forEach((el) => prevSetNames.add(el.name.trim().toLowerCase()));
      }

      // 3. For any sets that were unlinked: strip this path from set.paths
      for (const oldLowerName of prevSetNames) {
        if (!currentSetMap.has(oldLowerName)) {
          const { data: setItem, error: fetchErr } = await supabase
            .from('sets')
            .select('id, paths')
            .ilike('name', oldLowerName)
            .maybeSingle();

          if (!fetchErr && setItem && Array.isArray(setItem.paths)) {
            const nextPaths = setItem.paths.filter((p: string) => !isPathStringMatch(p, cleanPath));
            await supabase.from('sets').update({ paths: nextPaths }).eq('id', setItem.id);
          }
        }
      }

      // 4. For all currently linked sets: ensure pathName (with or without {Free}) is present
      for (const [, setInfo] of currentSetMap.entries()) {
        const { data: setItem, error: fetchErr } = await supabase
          .from('sets')
          .select('id, paths')
          .ilike('name', setInfo.name)
          .maybeSingle();

        if (!fetchErr && setItem) {
          const existingPaths: string[] = Array.isArray(setItem.paths) ? setItem.paths : [];
          const targetEntry = setInfo.tag === 'Free' ? `${cleanPath} {Free}` : cleanPath;

          // Remove any existing variant of this path
          const nextPaths = existingPaths.filter((p: string) => !isPathStringMatch(p, cleanPath));
          nextPaths.push(targetEntry);

          await supabase.from('sets').update({ paths: nextPaths }).eq('id', setItem.id);
        }
      }

      return true;
    } catch (err) {
      console.error(`[syncPathLinkedSets] Error synchronizing sets for path '${cleanPath}':`, err);
      return false;
    }
  },

  async syncPathLinkedIndividuals(
    pathName: string,
    currentElements: PathLinkedElement[],
    previousElements?: PathLinkedElement[]
  ): Promise<boolean> {
    if (!pathName || !pathName.trim()) return false;
    const cleanPath = cleanPathName(pathName).trim();

    try {
      // 1. Group current individual elements by table
      const currentByTable: Record<string, Map<string, { name: string; tag: string }>> = {
        powers: new Map(),
        skills: new Map(),
        traits: new Map(),
        weapons: new Map(),
        armor: new Map(),
        shields: new Map(),
      };

      (currentElements || [])
        .filter((el) => (el.type || el.element_type) !== 'set')
        .forEach((el) => {
          const rawType = (el.type || el.element_type || '').toLowerCase();
          let table = '';
          if (rawType === 'power') table = 'powers';
          else if (rawType === 'skill') table = 'skills';
          else if (rawType === 'trait') table = 'traits';
          else if (rawType === 'weapon') table = 'weapons';
          else if (rawType === 'armor') table = 'armor';
          else if (rawType === 'shield') table = 'shields';

          if (table && el.id) {
            currentByTable[table].set(String(el.id), {
              name: (el.name || '').trim(),
              tag: el.tag === 'Free' ? 'Free' : '1 AP',
            });
          }
        });

      // 2. Group previous individual elements by table
      const prevByTable: Record<string, Map<string, string>> = {
        powers: new Map(),
        skills: new Map(),
        traits: new Map(),
        weapons: new Map(),
        armor: new Map(),
        shields: new Map(),
      };

      if (previousElements && previousElements.length > 0) {
        previousElements
          .filter((el) => (el.type || el.element_type) !== 'set')
          .forEach((el) => {
            const rawType = (el.type || el.element_type || '').toLowerCase();
            let table = '';
            if (rawType === 'power') table = 'powers';
            else if (rawType === 'skill') table = 'skills';
            else if (rawType === 'trait') table = 'traits';
            else if (rawType === 'weapon') table = 'weapons';
            else if (rawType === 'armor') table = 'armor';
            else if (rawType === 'shield') table = 'shields';

            if (table && el.id) {
              prevByTable[table].set(String(el.id), (el.name || '').trim());
            }
          });
      }

      // 3. For any items that were unlinked: remove this path from item.path
      for (const [table, prevMap] of Object.entries(prevByTable)) {
        for (const [itemId] of prevMap.entries()) {
          if (!currentByTable[table].has(itemId)) {
            const { data: item, error: fetchErr } = await supabase
              .from(table)
              .select('id, path')
              .eq('id', itemId)
              .maybeSingle();

            if (!fetchErr && item && item.path) {
              const itemPaths = parseItemPaths(item.path);
              const nextPaths = itemPaths.filter((p) => !isPathStringMatch(p, cleanPath));
              const newPathVal =
                nextPaths.length === 0
                  ? table === 'powers' ? 'General' : ''
                  : nextPaths.length === 1
                  ? nextPaths[0]
                  : JSON.stringify(nextPaths);
              await supabase.from(table).update({ path: newPathVal }).eq('id', item.id);
            }
          }
        }
      }

      // 4. For currently linked items: ensure pathName (with or without {Free}) is present in item.path
      for (const [table, currMap] of Object.entries(currentByTable)) {
        for (const [itemId, info] of currMap.entries()) {
          const { data: item, error: fetchErr } = await supabase
            .from(table)
            .select('id, path')
            .eq('id', itemId)
            .maybeSingle();

          if (!fetchErr && item) {
            const existingRaw = item.path || '';
            const existingPaths = parseItemPaths(existingRaw);
            const targetEntry = info.tag === 'Free' ? `${cleanPath} {Free}` : cleanPath;

            const alreadyHasExact = existingPaths.some((p) => {
              if (!isPathStringMatch(p, cleanPath)) return false;
              const hasFree =
                p.toLowerCase().includes('{free}') ||
                p.toLowerCase().includes('{free1}') ||
                p.toLowerCase().includes('{trait}');
              return (info.tag === 'Free') === hasFree;
            });

            if (!alreadyHasExact) {
              const nextPaths = existingPaths.filter((p) => !isPathStringMatch(p, cleanPath));
              nextPaths.push(targetEntry);
              const newPathVal = nextPaths.length === 1 ? nextPaths[0] : JSON.stringify(nextPaths);
              await supabase.from(table).update({ path: newPathVal }).eq('id', item.id);
            }
          }
        }
      }

      return true;
    } catch (err) {
      console.error(`[syncPathLinkedIndividuals] Error synchronizing items for path '${cleanPath}':`, err);
      return false;
    }
  },

  async saveCanonicalPath(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('paths')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;

    if (data && Array.isArray(payload.linked_elements)) {
      await Promise.all([
        this.syncPathLinkedSets(data.name, payload.linked_elements),
        this.syncPathLinkedIndividuals(data.name, payload.linked_elements),
      ]);
    }
    return data;
  },

  async updateCanonicalPath(id: string | number, payload: any): Promise<any> {
    // Fetch existing path first to get previous linked_elements
    const { data: existing } = await supabase
      .from('paths')
      .select('name, linked_elements')
      .eq('id', id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('paths')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    if (data && Array.isArray(payload.linked_elements)) {
      const prevElements = existing ? existing.linked_elements : undefined;
      await Promise.all([
        this.syncPathLinkedSets(
          data.name || (existing ? existing.name : ''),
          payload.linked_elements,
          prevElements
        ),
        this.syncPathLinkedIndividuals(
          data.name || (existing ? existing.name : ''),
          payload.linked_elements,
          prevElements
        ),
      ]);
    }
    return data;
  },

  async deleteCanonicalPath(id: string | number): Promise<boolean> {
    const { data: existing } = await supabase
      .from('paths')
      .select('name, linked_elements')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('paths').delete().eq('id', id);
    if (error) throw error;

    if (existing && existing.name) {
      await Promise.all([
        this.syncPathLinkedSets(existing.name, [], existing.linked_elements),
        this.syncPathLinkedIndividuals(existing.name, [], existing.linked_elements),
      ]);
    }
    return true;
  },

  // 1b. SETS
  async saveSet(payload: Partial<SupabaseSet> & { name: string; category: SetCategory }): Promise<SupabaseSet> {
    const owner = payload.owner || 'Designer';
    const { data, error } = await supabase
      .from('sets')
      .insert([{ ...payload, owner, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data as SupabaseSet;
  },

  async updateSet(id: string | number, payload: Partial<SupabaseSet>): Promise<SupabaseSet> {
    const { data, error } = await supabase
      .from('sets')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as SupabaseSet;
  },

  async deleteSet(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('sets').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async saveCanonicalSet(payload: any): Promise<any> {
    return this.saveSet({ ...payload, owner: payload.owner || 'Designer' });
  },

  async updateCanonicalSet(id: string | number, payload: any): Promise<any> {
    return this.updateSet(id, payload);
  },

  async deleteCanonicalSet(id: string | number): Promise<boolean> {
    return this.deleteSet(id);
  },

  // 2. POWERS
  async saveCanonicalPower(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('powers')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalPower(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('powers')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalPower(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('powers').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 3. WEAPONS
  async saveCanonicalWeapon(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('weapons')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalWeapon(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('weapons')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalWeapon(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('weapons').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 4. ARMOR
  async saveCanonicalArmor(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('armor')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalArmor(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('armor')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalArmor(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('armor').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 5. SHIELDS
  async saveCanonicalShield(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('shields')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalShield(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('shields')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalShield(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('shields').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 6. GEAR / SUPPLIES
  async saveCanonicalGear(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('supplies')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalGear(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('supplies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalGear(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('supplies').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 7. TRAITS
  async saveCanonicalTrait(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('traits')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalTrait(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('traits')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalTrait(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('traits').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 8. CHAOS GEMS
  async saveCanonicalChaosGem(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('chaos_gems')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalChaosGem(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('chaos_gems')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalChaosGem(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('chaos_gems').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 9. SKILLS
  async saveCanonicalSkill(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('skills')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalSkill(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('skills')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalSkill(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('skills').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async unlinkCanonicalPathElement(
    entityType: 'power' | 'trait' | 'skill',
    id: string | number,
    pathNameToRemove: string
  ): Promise<{ remainingPaths: string[]; wasLastPath: boolean; updatedItem?: any }> {
    const table = entityType === 'power' ? 'powers' : entityType === 'trait' ? 'traits' : 'skills';
    const { data: existing, error: fetchErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) throw fetchErr || new Error('Item not found');

    const itemPaths = parseItemPaths(existing.path);
    const remaining = itemPaths.filter((p) => !isPathStringMatch(p, pathNameToRemove));

    if (remaining.length === 0) {
      return { remainingPaths: [], wasLastPath: true, updatedItem: existing };
    }

    const newPathVal = remaining.length === 1 ? remaining[0] : JSON.stringify(remaining);
    const { data: updated, error: updateErr } = await supabase
      .from(table)
      .update({ path: newPathVal })
      .eq('id', id)
      .select('*')
      .single();
    if (updateErr) throw updateErr;

    return { remainingPaths: remaining, wasLastPath: false, updatedItem: updated };
  },

  async setCanonicalElementPath(
    entityType: 'power' | 'trait' | 'skill',
    id: string | number,
    newPath: string
  ): Promise<any> {
    const table = entityType === 'power' ? 'powers' : entityType === 'trait' ? 'traits' : 'skills';
    const { data, error } = await supabase
      .from(table)
      .update({ path: newPath })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  // 10. MODS
  async saveCanonicalMod(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('mods')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalMod(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('mods')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalMod(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('mods').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async linkCanonicalMod(id: string | number, hostBelongsTo: string): Promise<any> {
    const { data: existing, error: fetchErr } = await supabase
      .from('mods')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;
    if (!existing) throw new Error(`Mod with ID ${id} not found.`);

    if (!isBelongsToMatch(existing.belongs_to, hostBelongsTo)) {
      const parts = splitBelongsToTargets(existing.belongs_to);
      parts.push(hostBelongsTo);
      const newBelongsTo = parts.join(', ');
      const { data: updated, error: updateErr } = await supabase
        .from('mods')
        .update({ belongs_to: newBelongsTo })
        .eq('id', id)
        .select('*')
        .single();
      if (updateErr) throw updateErr;
      return updated;
    }
    return existing;
  },

  async unlinkCanonicalMod(id: string | number, hostBelongsTo: string): Promise<boolean> {
    const { data: existing, error: fetchErr } = await supabase
      .from('mods')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return false;

    const parts = splitBelongsToTargets(existing.belongs_to);
    const cleanHost = cleanBelongsToName(hostBelongsTo);
    const remaining = parts.filter((p) => cleanBelongsToName(p) !== cleanHost);

    if (remaining.length === 0) {
      return this.deleteCanonicalMod(id);
    } else {
      const newBelongsTo = remaining.join(', ');
      const { error: updateErr } = await supabase
        .from('mods')
        .update({ belongs_to: newBelongsTo })
        .eq('id', id);
      if (updateErr) throw updateErr;
      return true;
    }
  },

  // 11. GEAR POWERS
  async saveCanonicalGearPower(payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('gear_powers')
      .insert([{ ...payload, owner: payload.owner || 'Designer', created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async updateCanonicalGearPower(id: string | number, payload: any): Promise<any> {
    const { data, error } = await supabase
      .from('gear_powers')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCanonicalGearPower(id: string | number): Promise<boolean> {
    const { error } = await supabase.from('gear_powers').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async linkCanonicalGearPower(id: string | number, hostBelongsTo: string): Promise<any> {
    const { data: existing, error: fetchErr } = await supabase
      .from('gear_powers')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr) throw fetchErr;
    if (!existing) throw new Error(`Gear power with ID ${id} not found.`);

    if (!isBelongsToMatch(existing.belongs_to, hostBelongsTo)) {
      const parts = splitBelongsToTargets(existing.belongs_to);
      parts.push(hostBelongsTo);
      const newBelongsTo = parts.join(', ');
      const { data: updated, error: updateErr } = await supabase
        .from('gear_powers')
        .update({ belongs_to: newBelongsTo })
        .eq('id', id)
        .select('*')
        .single();
      if (updateErr) throw updateErr;
      return updated;
    }
    return existing;
  },

  async unlinkCanonicalGearPower(id: string | number, hostBelongsTo: string): Promise<boolean> {
    const { data: existing, error: fetchErr } = await supabase
      .from('gear_powers')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return false;

    const parts = splitBelongsToTargets(existing.belongs_to);
    const cleanHost = cleanBelongsToName(hostBelongsTo);
    const remaining = parts.filter((p) => cleanBelongsToName(p) !== cleanHost);

    if (remaining.length === 0) {
      return this.deleteCanonicalGearPower(id);
    } else {
      const newBelongsTo = remaining.join(', ');
      const { error: updateErr } = await supabase
        .from('gear_powers')
        .update({ belongs_to: newBelongsTo })
        .eq('id', id);
      if (updateErr) throw updateErr;
      return true;
    }
  },

  // 12. ACTIVE PROPAGATION ENGINE
  async propagateCanonicalUpdateToAllCharacters(
    params: CanonicalPropagationParams
  ): Promise<{ updatedCount: number; errors: string[] }> {
    const { entityType, oldName, updatedItem } = params;
    if (!oldName || !updatedItem) {
      return { updatedCount: 0, errors: [] };
    }

    try {
      // Fetch all character sheet records
      const { data: allChars, error: fetchErr } = await supabase
        .from('characters')
        .select('id, name, sheet_data');

      if (fetchErr) throw fetchErr;
      if (!allChars || allChars.length === 0) {
        return { updatedCount: 0, errors: [] };
      }

      let updatedCount = 0;
      const errors: string[] = [];

      for (const char of allChars) {
        if (!char.sheet_data) continue;
        const { updatedSheet, wasModified } = updateCharacterSheetCanonicalItem(
          char.sheet_data,
          entityType,
          oldName,
          updatedItem
        );

        if (wasModified) {
          const { error: updateErr } = await supabase
            .from('characters')
            .update({ sheet_data: updatedSheet, updated_at: new Date().toISOString() })
            .eq('id', char.id);

          if (updateErr) {
            console.error(`[gameApi] Propagation error for character ${char.id} (${char.name}):`, updateErr);
            errors.push(`${char.name || char.id}: ${updateErr.message}`);
          } else {
            updatedCount++;
          }
        }
      }

      return { updatedCount, errors };
    } catch (e: any) {
      console.error('[gameApi] Error in propagateCanonicalUpdateToAllCharacters:', e);
      return { updatedCount: 0, errors: [e.message || 'Propagation failed'] };
    }
  },

  async propagateCanonicalDeletionToAllCharacters(params: {
    entityType: CanonicalEntityType;
    targetName: string;
    targetId?: string | number;
  }): Promise<{ purgedCharacterCount: number; errors: string[] }> {
    const { entityType, targetName, targetId } = params;
    if (!targetName) {
      return { purgedCharacterCount: 0, errors: [] };
    }

    try {
      // Fetch all character sheet records
      const { data: allChars, error: fetchErr } = await supabase
        .from('characters')
        .select('id, name, sheet_data');

      if (fetchErr) throw fetchErr;
      if (!allChars || allChars.length === 0) {
        return { purgedCharacterCount: 0, errors: [] };
      }

      let purgedCharacterCount = 0;
      const errors: string[] = [];

      for (const char of allChars) {
        if (!char.sheet_data) continue;
        const { updatedSheet, wasModified } = removeCharacterSheetCanonicalItem(
          char.sheet_data,
          entityType,
          targetName,
          targetId
        );

        if (wasModified) {
          const { error: updateErr } = await supabase
            .from('characters')
            .update({ sheet_data: updatedSheet, updated_at: new Date().toISOString() })
            .eq('id', char.id);

          if (updateErr) {
            console.error(`[gameApi] Deletion propagation error for character ${char.id} (${char.name}):`, updateErr);
            errors.push(`${char.name || char.id}: ${updateErr.message}`);
          } else {
            purgedCharacterCount++;
          }
        }
      }

      return { purgedCharacterCount, errors };
    } catch (e: any) {
      console.error('[gameApi] Error in propagateCanonicalDeletionToAllCharacters:', e);
      return { purgedCharacterCount: 0, errors: [e.message || 'Deletion propagation failed'] };
    }
  },
};


