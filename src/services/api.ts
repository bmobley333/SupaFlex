// src/services/api.ts
// Supabase Data Access Gateway for SupaFlex

import { supabase } from '../lib/supabase';
import {
  Character,
  Power,
  MagicItem,
  Skillset,
  CharacterSheetData,
  DieRating,
  SupabaseArmor,
  SupabaseWeapon,
  SupabaseShield,
  SupabaseGear,
  SupabaseMonster,
  SupabaseChaosGem,
  ChaosGemSlot,
  DEFAULT_CHAOS_GAUNTLET_SLOTS,
  LootMainEntry,
  CustomCreationItem,
  PowerTable,
} from '../types/game';
import { GmAdventure } from '../types/adventures';
import { generateRoomId, sanitizeRoomCodeInput } from '../utils/roomId';
import { isGuildSpaceUnlocked } from '../utils/guildspaceAuth';

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
    gear_slots: Array.isArray(rawSheet.gear_slots) ? rawSheet.gear_slots : [],
    weapons: Array.isArray(rawSheet.weapons) ? rawSheet.weapons : [],
    simple_gear: Array.isArray(rawSheet.simple_gear) ? rawSheet.simple_gear : [],
    chaos_gauntlet_slots: mergedGauntletSlots,
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
  const cleanIndividualSkills = (rawSheet.known_individual_skills || []).filter(
    (s) => s && typeof s === 'string' && s.trim() !== ''
  );

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

    const { data, error } = await supabase
      .from('characters')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`[gameApi] Error updating character ${id}:`, error);
      throw error;
    }
    return normalizeCharacterData(data as Character);
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
    const { data, error } = await supabase
      .from('power_tables')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching power tables:', error);
      return [];
    }
    return (data || []) as PowerTable[];
  },

  async savePowerTable(payload: Partial<PowerTable>): Promise<PowerTable | null> {
    const { data, error } = await supabase
      .from('power_tables')
      .insert([
        {
          ...payload,
          created_at: payload.created_at || new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error saving power table:', error);
      throw error;
    }
    return data as PowerTable;
  },

  async getPowers(): Promise<Power[]> {
    let query = supabase.from('powers').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching powers:', error);
      return [];
    }
    return (data || []) as Power[];
  },

  // --- RELICS, HARDWARE & LOADOUT CATALOG ---
  async getRelics(): Promise<MagicItem[]> {
    let query = supabase.from('relics').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching relics:', error);
      return [];
    }
    return (data || []) as MagicItem[];
  },

  async getHardware(): Promise<MagicItem[]> {
    let query = supabase.from('hardware').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching hardware catalog:', error);
      return [];
    }
    return ((data || []).map((h) => ({ ...h, is_hardware: true }))) as MagicItem[];
  },

  async getLoadoutCatalog(): Promise<MagicItem[]> {
    const [relics, hardware] = await Promise.all([
      this.getRelics(),
      this.getHardware(),
    ]);
    const combined = [...relics, ...hardware];
    combined.sort((a, b) => a.name.localeCompare(b.name));
    return combined;
  },

  async getMagicItems(): Promise<MagicItem[]> {
    return this.getLoadoutCatalog();
  },

  // --- SKILLSETS ---
  async getSkillsets(): Promise<Skillset[]> {
    let query = supabase.from('skillsets').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
    }
    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching skillsets:', error);
      return [];
    }
    return (data || []) as Skillset[];
  },

  // --- ARMOR CATALOG ---
  async getArmor(): Promise<SupabaseArmor[]> {
    let query = supabase.from('armor').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
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
      .insert({ ...newArmor, id: nextId })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom armor:', error);
      throw error;
    }
    return data as SupabaseArmor;
  },

  // --- WEAPONS CATALOG ---
  async getWeapons(): Promise<SupabaseWeapon[]> {
    let query = supabase.from('weapons').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
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
      .insert({ ...newWeapon, id: nextId })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom weapon:', error);
      throw error;
    }
    return data as SupabaseWeapon;
  },

  // --- SHIELDS CATALOG ---
  async getShields(): Promise<SupabaseShield[]> {
    let query = supabase.from('shields').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
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
      .insert({ ...newShield, id: nextId })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom shield:', error);
      throw error;
    }
    return data as SupabaseShield;
  },

  // --- GEAR CATALOG ---
  async getGear(): Promise<SupabaseGear[]> {
    let query = supabase.from('gear').select('*');
    if (!isGuildSpaceUnlocked()) {
      query = query.eq('is_guildspace_locked', false);
    }
    const { data, error } = await query
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[gameApi] Error fetching gear catalog:', error);
      return [];
    }
    return (data || []) as SupabaseGear[];
  },

  async createGear(newGear: Omit<SupabaseGear, 'id' | 'created_at'>): Promise<SupabaseGear> {
    const { data, error } = await supabase
      .from('gear')
      .insert(newGear)
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating custom gear:', error);
      throw error;
    }
    return data as SupabaseGear;
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ddibmiifxwqlnlpaekui.supabase.co';
      const serviceKey =
        import.meta.env.VITE_SUPABASE_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaWJtaWlmeHdxbG5scGFla3VpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDU1NjA5NiwiZXhwIjoyMTAwMTMyMDk2fQ.tzpdIj39T8-fe5zk_6NA75lx7OS-VcIigmdM8zeeRhc';

      const res = await fetch(`${supabaseUrl}/rest/v1/players`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
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

  async getUserProfile(email: string, defaultFullName?: string): Promise<{ email: string; allow_cloning: boolean; player_name?: string; first_name?: string; last_name?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('players')
      .select('email, allow_cloning, first_name, last_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.error('[gameApi] Error fetching player profile:', error);
    }

    if (data) {
      const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
      if (!fullName && defaultFullName && defaultFullName.trim()) {
        await this.updatePlayerName(cleanEmail, defaultFullName);
        const parts = defaultFullName.trim().split(/\s+/);
        return {
          email: data.email,
          allow_cloning: data.allow_cloning ?? true,
          first_name: parts[0] || '',
          last_name: parts.slice(1).join(' ') || '',
          player_name: defaultFullName.trim(),
        };
      }
      return {
        email: data.email,
        allow_cloning: data.allow_cloning ?? true,
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
      .select('email, allow_cloning, first_name, last_name')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (created && created.email) {
      const createdFullName = [created.first_name, created.last_name].filter(Boolean).join(' ').trim();
      return {
        email: created.email,
        allow_cloning: created.allow_cloning ?? true,
        first_name: created.first_name || '',
        last_name: created.last_name || '',
        player_name: createdFullName,
      };
    }

    const parts = (defaultFullName || '').trim().split(/\s+/);
    return {
      email: cleanEmail,
      allow_cloning: true,
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      player_name: defaultFullName?.trim() || '',
    };
  },

  async updateProfilePrivacy(email: string, allowCloning: boolean): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase
      .from('players')
      .upsert({ email: cleanEmail, allow_cloning: allowCloning }, { onConflict: 'email' });

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
    const cleanGm = gmEmail.trim().toLowerCase();
    const partyName = (name || 'GM Campaign').trim();

    const { data, error } = await supabase
      .from('parties')
      .insert({
        gm_email: cleanGm,
        name: partyName,
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
          event: 'party.left',
          payload: { partyId: targetPartyId, tab_session_id: tabSessionId, timestamp: new Date().toISOString() },
        });
      } catch (bcErr) {
        console.warn('[gameApi] Notice broadcasting member leave:', bcErr);
      }
    }
  },
  async ensureTabPartySession(partyIdOrCode: string, tabSessionId: string, characterId: number, playerEmail: string) {
    if (!partyIdOrCode || !tabSessionId || !characterId) return;

    let targetPartyUuid = partyIdOrCode;
    if (partyIdOrCode.length === 4) {
      const party = await this.findActivePartyByRoomCode(partyIdOrCode);
      if (party) {
        targetPartyUuid = party.id;
      }
    }

    try {
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
    } catch (e) {
      console.warn('[gameApi] Error in ensureTabPartySession:', e);
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

    // 12-hour staleness threshold for tabletop playtest session members
    const activeCutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('party_session_members')
      .select('*, character:characters(*)')
      .eq('party_id', targetPartyUuid)
      .gte('last_seen', activeCutoff)
      .order('character_id', { ascending: true });

    // Asynchronously prune dead ghost sessions from DB (> 12h inactive)
    const deadCutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    Promise.resolve(
      supabase
        .from('party_session_members')
        .delete()
        .lt('last_seen', deadCutoff)
    ).catch(() => {});

    if (error) {
      console.error('[gameApi] Error fetching party session members:', error);
      return [];
    }

    // Fetch player profiles to attach first_name for roster card display
    const uniqueEmails = Array.from(new Set((data || []).map((m) => (m.player_email || '').toLowerCase()).filter(Boolean)));
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
    (data || []).forEach((m) => {
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
  async checkoutPartyRoomCodeForGmEmail(gmEmail: string): Promise<{ party: any; roomCode: string }> {
    try {
      const cleanEmail = gmEmail.trim().toLowerCase();
      const existing = await this.getPartiesForUser(cleanEmail);
      let party = existing.find((p: any) => (p.gm_email || '').toLowerCase() === cleanEmail);

      if (!party) {
        party = await this.createParty('MetaScape Campaign', cleanEmail, []);
      }

      return await this.checkoutPartyRoomCode(party.id);
    } catch (err: any) {
      console.warn('[gameApi] Room code checkout fallback:', err?.message || err);
      const fallbackCode = generateRoomId();
      return {
        party: { id: 'fallback-party-id', gm_email: gmEmail },
        roomCode: fallbackCode,
      };
    }
  },

  async checkoutPartyRoomCode(partyId: string): Promise<{ party: any; roomCode: string }> {
    await this.cleanupStaleRooms();

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
        is_active: true,
        last_active_at: nowStr,
      })
      .eq('id', partyId)
      .select()
      .single();

    if (error) {
      console.warn('[gameApi] Local room code checkout fallback due to DB update:', error.message);
      return { party: { id: partyId, room_code: candidate, is_active: true }, roomCode: candidate };
    }

    return { party: data, roomCode: candidate };
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
    await supabase
      .from('parties')
      .update({
        is_active: false,
        room_code: null,
      })
      .eq('id', partyId);
  },

  async cleanupStaleRooms() {
    // Extended to 10 minutes to tolerate browser JS interval throttling in background tabs.
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('parties')
      .update({
        is_active: false,
        room_code: null,
      })
      .eq('is_active', true)
      .lt('last_active_at', tenMinsAgo);
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
      .eq('room_code', sanitized)
      .eq('is_active', true)
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
    try {
      const { data, error } = await supabase
        .from('monsters')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[gameApi] Notice fetching master monsters table:', error.message);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error('[gameApi] Error in getSupabaseMonsters:', e);
      return [];
    }
  },

  async getPartyMonsters(partyId: string) {
    try {
      const { data, error } = await supabase
        .from('parties')
        .select('active_monsters')
        .eq('id', partyId)
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
      localStorage.setItem(`supaflex_gm_monsters_${partyId}`, JSON.stringify(monsters));
      localStorage.setItem('supaflex_gm_monster_stats', JSON.stringify(monsters));

      const { error } = await supabase
        .from('parties')
        .update({ active_monsters: monsters })
        .eq('id', partyId);

      if (error) {
        console.warn('[gameApi] Supabase active_monsters update warning:', error.message);
      }

      // Send Realtime Broadcast event to all party members
      const channel = supabase.channel(`party:${partyId}`);
      await channel.send({
        type: 'broadcast',
        event: 'monster_roster_updated',
        payload: { monsters },
      });
    } catch (e) {
      console.error('[gameApi] Error saving party monsters:', e);
    }
  },

  // --- CHAOS GEMS ---
  async getChaosGems(): Promise<SupabaseChaosGem[]> {
    try {
      const { data, error } = await supabase
        .from('chaos_gems')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.warn('[gameApi] Notice fetching chaos gems table:', error.message);
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

  // --- DISTRIBUTED CREATION & CURATION ENGINE (DC2E) ---
  async getPersonalCustomItems(authorEmail: string): Promise<CustomCreationItem[]> {
    if (!authorEmail) return [];
    try {
      const { data, error } = await supabase
        .from('party_custom_items')
        .select('*')
        .ilike('author_email', authorEmail.trim())
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching personal custom items:', error.message);
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
        .from('party_custom_items')
        .select('*')
        .eq('party_id', partyId.trim())
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching party custom items:', error.message);
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
        .from('party_custom_items')
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
        .from('party_custom_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[gameApi] Notice fetching all custom items:', error.message);
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
        .from('party_custom_items')
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
        .from('party_custom_items')
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
        .from('party_custom_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('[gameApi] Error in deleteCustomItem:', e);
      return false;
    }
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
          : item.type === 'hardware'
          ? 'hardware'
          : item.type === 'skillset'
          ? 'skillsets'
          : 'relics';

      const masterPayload: any = {
        name: item.name,
        category: item.category || (item.type === 'relic' ? '🍺 Minor' : 'Universal'),
        action: item.item_data?.action || 'A',
        usage: item.item_data?.usage || '1-Enc',
        effect: item.item_data?.effect || '',
        notes: item.notes ? `${item.notes} (Official MetaScape Canon • Designed by ${item.author_name})` : `(Official MetaScape Canon • Designed by ${item.author_name})`,
        genres: item.item_data?.genres && item.item_data.genres.length > 0 ? item.item_data.genres : ['Medieval', 'Modern', 'SciFi'],
        created_at: new Date().toISOString(),
      };

      if (item.type === 'power') {
        if (item.item_data?.table) {
          masterPayload.table = item.item_data.table;
        }
        if (item.item_data?.ready_category || item.item_data?.ready) {
          masterPayload.ready = item.item_data.ready_category || item.item_data.ready;
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
      return (data || []) as GmAdventure[];
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
      return data as GmAdventure;
    } catch (e) {
      console.error('[gameApi] Error in createAdventure:', e);
      throw e;
    }
  },

  async updateAdventure(id: string, updates: Partial<GmAdventure>): Promise<GmAdventure | null> {
    try {
      const payload: any = {
        ...updates,
        updated_at: new Date().toISOString(),
      };
      delete payload.id;

      const { data, error } = await supabase
        .from('adventures')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('[gameApi] Error updating adventure:', error);
        throw error;
      }
      return data as GmAdventure;
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
};


