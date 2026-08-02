// src/services/api.ts
// Supabase Data Access Gateway for SupaFlex

import { supabase } from '../lib/supabase';
import { Character, Power, MagicItem, Skillset, CharacterSheetData, DieRating, SupabaseArmor, SupabaseWeapon, SupabaseShield, SupabaseGear } from '../types/game';

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

export const normalizeCharacterData = (c: Character): Character => {
  const defaultSheet = createDefaultSheetData();
  const rawSheet = (c.sheet_data || {}) as Partial<CharacterSheetData>;

  const vitalityMax = rawSheet.vitality_max ?? c.hp ?? 10;
  const currentVitality = rawSheet.current_vitality ?? c.hp ?? vitalityMax;

  const normalizedSheet: CharacterSheetData = {
    ...defaultSheet,
    ...rawSheet,
    vitality_max: vitalityMax,
    current_vitality: currentVitality,
    attribute_dice: {
      might: ((rawSheet.attribute_dice?.might || c.might || 'd4') as DieRating),
      motion: ((rawSheet.attribute_dice?.motion || c.motion || 'd4') as DieRating),
      mind: ((rawSheet.attribute_dice?.mind || c.mind || 'd4') as DieRating),
      magic: ((rawSheet.attribute_dice?.magic || c.magic || 'd4') as DieRating),
      moxie: ((rawSheet.attribute_dice?.moxie || c.moxie || 'd4') as DieRating),
    },
    known_skillsets: rawSheet.known_skillsets?.length ? rawSheet.known_skillsets : c.skills || [],
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

  async createCharacter(name: string, characterClass = 'Adventurer', race = 'Human', ownerEmail = 'TheBMobley@gmail.com'): Promise<Character> {
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
        owner_email: ownerEmail,
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

  // --- ARMOR CATALOG ---
  async getArmor(): Promise<SupabaseArmor[]> {
    const { data, error } = await supabase
      .from('armor')
      .select('*')
      .order('id', { ascending: true });

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
    const { data, error } = await supabase
      .from('weapons')
      .select('*')
      .order('id', { ascending: true });

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
    const { data, error } = await supabase
      .from('shields')
      .select('*')
      .order('id', { ascending: true });

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
    const { data, error } = await supabase
      .from('gear')
      .select('*')
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
  async getUserProfile(email: string): Promise<{ email: string; allow_cloning: boolean }> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase
      .from('players')
      .select('email, allow_cloning')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) {
      console.error('[gameApi] Error fetching player profile:', error);
    }

    if (data) {
      return { email: data.email, allow_cloning: data.allow_cloning ?? true };
    }

    // Auto-create profile if missing
    const { data: created, error: createError } = await supabase
      .from('players')
      .insert({ email: cleanEmail, allow_cloning: true })
      .select('email, allow_cloning')
      .single();

    if (createError) {
      console.error('[gameApi] Error creating player profile:', createError);
      return { email: cleanEmail, allow_cloning: true };
    }

    return { email: created.email, allow_cloning: created.allow_cloning ?? true };
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
      .or(`gm_email.eq.${cleanEmail},invited_emails.cs.{${cleanEmail}}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[gameApi] Error fetching parties:', error);
      return [];
    }

    return data || [];
  },

  async createParty(name: string, gmEmail: string, invitedEmails: string[]) {
    const cleanGm = gmEmail.trim().toLowerCase();
    const cleanInvites = invitedEmails.map(e => e.trim().toLowerCase()).filter(Boolean);

    const { data, error } = await supabase
      .from('parties')
      .insert({
        name: name.trim(),
        gm_email: cleanGm,
        invited_emails: cleanInvites,
      })
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error creating party:', error);
      throw error;
    }

    return data;
  },

  async joinPartySession(partyId: string, playerEmail: string, characterId: number, tabSessionId: string) {
    const cleanEmail = playerEmail.trim().toLowerCase();
    const { data, error } = await supabase
      .from('party_session_members')
      .upsert(
        {
          party_id: partyId,
          player_email: cleanEmail,
          character_id: characterId,
          tab_session_id: tabSessionId,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'party_id,tab_session_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[gameApi] Error joining party session:', error);
      throw error;
    }

    return data;
  },

  async leavePartySession(tabSessionId: string) {
    const { error } = await supabase
      .from('party_session_members')
      .delete()
      .eq('tab_session_id', tabSessionId);

    if (error) {
      console.error('[gameApi] Error leaving party session:', error);
    }
  },

  async getPartySessionMembers(partyId: string) {
    const { data, error } = await supabase
      .from('party_session_members')
      .select('*, character:characters(*)')
      .eq('party_id', partyId);

    if (error) {
      console.error('[gameApi] Error fetching party session members:', error);
      return [];
    }

    return data || [];
  },
};

