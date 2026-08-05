// src/services/api.ts
// Supabase Data Access Gateway for SupaFlex

import { supabase } from '../lib/supabase';
import { Character, Power, MagicItem, Skillset, CharacterSheetData, DieRating, SupabaseArmor, SupabaseWeapon, SupabaseShield, SupabaseGear, SupabaseMonster } from '../types/game';
import { generateRoomId, sanitizeRoomCodeInput } from '../utils/roomId';

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
  async getUserProfile(email: string): Promise<{ email: string; allow_cloning: boolean; player_name?: string; first_name?: string; last_name?: string }> {
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
      return {
        email: data.email,
        allow_cloning: data.allow_cloning ?? true,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        player_name: fullName,
      };
    }

    // Auto-create profile if missing
    const { data: created, error: createError } = await supabase
      .from('players')
      .insert({ email: cleanEmail, allow_cloning: true })
      .select('email, allow_cloning, first_name, last_name')
      .single();

    if (createError) {
      console.error('[gameApi] Error creating player profile:', createError);
      return { email: cleanEmail, allow_cloning: true };
    }

    const createdFullName = [created.first_name, created.last_name].filter(Boolean).join(' ').trim();
    return {
      email: created.email,
      allow_cloning: created.allow_cloning ?? true,
      first_name: created.first_name || '',
      last_name: created.last_name || '',
      player_name: createdFullName,
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

  async updatePlayerName(email: string, playerName: string): Promise<boolean> {
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
      .gte('last_seen', activeCutoff);

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

    return Array.from(memberMap.values());
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
};

