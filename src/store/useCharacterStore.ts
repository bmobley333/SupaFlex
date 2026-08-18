import { create } from 'zustand';
import { Character, CharacterSheetData, Power, MagicItem, Skillset, PowerTable, EncounterLink } from '../types/game';
import { gameApi, createDefaultSheetData } from '../services/api';
import { migrateCharacterMagicItemsToVault } from '../utils/magicSlotSchedule';
import { migrateCharacterPowersToCodex, validateReadyMatrix, getPowerReadyCategory } from '../utils/readyMatrixSchedule';

const getInitialPlayerLinks = (email?: string): EncounterLink[] => {
  if (typeof window !== 'undefined') {
    try {
      const em = email || sessionStorage.getItem('supaflex_player_email') || 'default';
      const saved = localStorage.getItem(`supaflex_player_links_${em}`);
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return [];
};

interface CharacterStore {
  // State
  characters: Character[];
  activeCharacter: Character | null;
  powers: Power[];
  powerTables: PowerTable[];
  magicItems: MagicItem[];
  skillsets: Skillset[];
  isLoading: boolean;
  isSaving: boolean;
  dbConnected: boolean;
  error: string | null;

  // Player Login & Filtering State
  playerEmail: string;
  playerName: string;
  filterMode: 'my_heroes' | 'all_heroes';
  activeRole: 'player' | 'gm';
  activePartyId: string | null;
  tabSessionId: string;

  // Actions
  fetchInitialData: (options?: { silent?: boolean }) => Promise<void>;
  selectCharacter: (id: number) => void;
  createNewCharacter: (name: string, characterClass?: string, race?: string) => Promise<Character | null>;
  updateActiveSheetData: (updater: (prev: CharacterSheetData) => CharacterSheetData) => void;
  updateActiveCharacterMeta: (updates: Partial<Character>) => void;
  saveActiveCharacter: () => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
  addCharge: (amount?: number) => void;
  spendSpark: () => void;
  resetCharges: () => void;
  addSpark: (amount?: number) => void;
  spendMeta: () => void;
  resetSparks: () => void;
  toggleReadyPower: (powerName: string) => { success: boolean; error?: string };
  executeTacticalPivot: (unreadyPowerName: string, readyPowerName: string) => { success: boolean; error?: string };
  resetTacticalPivot: () => void;
  setPlayerEmail: (email: string) => void;
  setPlayerName: (name: string) => void;
  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => void;
  setActiveRole: (role: 'player' | 'gm') => void;
  setActivePartyId: (partyId: string | null) => void;
  setPowerTables: (tables: PowerTable[]) => void;
  addPowerTable: (table: PowerTable) => void;
  recordApExpenditure: (
    cost: number,
    category: 'Skills' | 'Weapons' | 'Armor' | 'Shields' | 'Powers' | 'Magic Items' | 'Attributes' | 'Focus Die' | 'Capstones' | 'Vitality' | 'GM Bonus' | 'Manual',
    description: string,
    tier: 1 | 2 | 3 | 'Creation' | 'Manual',
    source: string
  ) => void;
  revertApExpenditure: (entryId: string) => void;
  syncSheetRulesToDatabase: () => Promise<{ updatedCount: number; preservedCount: number }>;

  // Player Links (Account-Wide)
  playerLinks: EncounterLink[];
  fetchPlayerLinks: () => void;
  addPlayerLink: (name: string, url: string) => void;
  updatePlayerLink: (linkId: string, name: string, url: string) => void;
  deletePlayerLink: (linkId: string) => void;
  reorderPlayerLinkByIndex: (fromIdx: number, toIdx: number) => void;

  // Character Links (Character-Specific)
  addCharacterLink: (name: string, url: string) => void;
  updateCharacterLink: (linkId: string, name: string, url: string) => void;
  deleteCharacterLink: (linkId: string) => void;
  reorderCharacterLinkByIndex: (fromIdx: number, toIdx: number) => void;
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  activeCharacter: null,
  powers: [],
  powerTables: [],
  magicItems: [],
  skillsets: [],
  isLoading: false,
  isSaving: false,
  dbConnected: false,
  error: null,

  tabSessionId: (() => {
    if (typeof window === 'undefined') return 'server_side';

    const windowKey = window.name;
    const storedTabId = sessionStorage.getItem('supaflex_tab_session_id');

    // If window.name matches storedTabId, this is an existing tab refresh/navigation
    if (windowKey && storedTabId && windowKey === `supaflex_win_${storedTabId}`) {
      return storedTabId;
    }

    // Otherwise, this is a NEW tab or DUPLICATED tab (Ctrl+D)!
    const newTabId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    window.name = `supaflex_win_${newTabId}`;
    sessionStorage.setItem('supaflex_tab_session_id', newTabId);

    // Purge copied sessionStorage credentials so duplicated tabs require fresh re-login
    sessionStorage.removeItem('supaflex_player_email');
    sessionStorage.removeItem('supaflex_player_name');
    sessionStorage.removeItem('supaflex_active_party_id');
    sessionStorage.removeItem('supaflex_last_active_char_id');

    return newTabId;
  })(),

  playerEmail: typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_player_email') || '') : '',
  playerName: typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_player_name') || '') : '',
  filterMode: (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_filter_mode') as any) : null) || 'my_heroes',
  activeRole: (typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('supaflex_active_role') as 'player' | 'gm') : null) || 'player',
  activePartyId: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('supaflex_active_party_id') : null,
  playerLinks: getInitialPlayerLinks(),

  setActiveRole: (role: 'player' | 'gm') => {
    sessionStorage.setItem('supaflex_active_role', role);
    set({ activeRole: role });
  },

  setActivePartyId: (partyId: string | null) => {
    if (partyId) {
      sessionStorage.setItem('supaflex_active_party_id', partyId);
    } else {
      sessionStorage.removeItem('supaflex_active_party_id');
    }
    set({ activePartyId: partyId });
  },

  setPowerTables: (tables: PowerTable[]) => {
    set({ powerTables: tables });
  },

  addPowerTable: (table: PowerTable) => {
    set((state) => {
      const exists = state.powerTables.some((t) => t.name.toLowerCase() === table.name.toLowerCase());
      if (exists) {
        return {
          powerTables: state.powerTables.map((t) => (t.name.toLowerCase() === table.name.toLowerCase() ? { ...t, ...table } : t)),
        };
      }
      const updated = [...state.powerTables, table];
      updated.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
      return { powerTables: updated };
    });
  },

  fetchInitialData: async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent || get().characters.length > 0;
    if (!isSilent) {
      set({ isLoading: true, error: null });
    }
    try {
      const isConnected = await gameApi.checkConnection();
      set({ dbConnected: isConnected });

      // Register window network status listeners for dynamic offline warning popups
      if (typeof window !== 'undefined' && !(window as any)._supaflex_net_listeners_registered) {
        (window as any)._supaflex_net_listeners_registered = true;
        window.addEventListener('online', () => {
          set({ dbConnected: true });
        });
        window.addEventListener('offline', () => {
          set({ dbConnected: false });
        });
      }

      if (!isConnected) {
        set({ isLoading: false, error: 'Database connection offline.' });
        return;
      }

      const [chars, powers, powerTables, items, skillsets] = await Promise.all([
        gameApi.getCharacters(),
        gameApi.getPowers(),
        gameApi.getPowerTables(),
        gameApi.getMagicItems(),
        gameApi.getSkillsets(),
      ]);

      const currentActive = get().activeCharacter;
      let selectedChar: Character | null = null;

      if (currentActive && chars.some((c) => c.id === currentActive.id)) {
        const freshChar = chars.find((c) => c.id === currentActive.id)!;
        const migratedSheet = migrateCharacterPowersToCodex(migrateCharacterMagicItemsToVault(freshChar.sheet_data));
        // Preserve active character object and unsaved local edits if present
        selectedChar = {
          ...freshChar,
          sheet_data: currentActive.sheet_data ? currentActive.sheet_data : migratedSheet,
        };
      } else {
        const lastActiveIdStr = sessionStorage.getItem('supaflex_last_active_char_id');
        const lastActiveId = lastActiveIdStr ? Number(lastActiveIdStr) : null;
        selectedChar = (lastActiveId ? chars.find((c) => c.id === lastActiveId) : null) || chars[0] || null;

        // If no character exists yet, auto-create a default Playtest hero
        if (!selectedChar && isConnected) {
          selectedChar = await gameApi.createCharacter('Hero of MetaScape', 'Vanguard', 'Human');
          chars.push(selectedChar);
        }

        if (selectedChar) {
          const migratedSheet = migrateCharacterPowersToCodex(migrateCharacterMagicItemsToVault(selectedChar.sheet_data));
          selectedChar = { ...selectedChar, sheet_data: migratedSheet };
          sessionStorage.setItem('supaflex_last_active_char_id', String(selectedChar.id));
        }
      }

      set({
        characters: chars,
        activeCharacter: selectedChar,
        powers,
        powerTables,
        magicItems: items,
        skillsets,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Failed to fetch character data.',
      });
    }
  },

  selectCharacter: async (id: number) => {
    sessionStorage.setItem('supaflex_last_active_char_id', String(id));
    const found = get().characters.find((c) => c.id === id);
    if (found) {
      const migratedFoundSheet = migrateCharacterPowersToCodex(migrateCharacterMagicItemsToVault(found.sheet_data));
      const migratedFound = { ...found, sheet_data: migratedFoundSheet };
      set({ activeCharacter: migratedFound });
    }
    try {
      const updated = await gameApi.getCharacterById(id);
      if (updated) {
        const migratedSheet = migrateCharacterPowersToCodex(migrateCharacterMagicItemsToVault(updated.sheet_data));
        const migratedChar = { ...updated, sheet_data: migratedSheet };
        set((state) => ({
          activeCharacter: migratedChar,
          characters: state.characters.map((c) => (c.id === updated.id ? migratedChar : c)),
        }));
      }
    } catch (err) {
      console.warn('Network fetch for character details failed:', err);
    }
  },

  createNewCharacter: async (name: string, characterClass = 'Adventurer', race = 'Human') => {
    set({ isSaving: true });
    try {
      const ownerEmail = get().playerEmail || undefined;
      const newChar = await gameApi.createCharacter(name, characterClass, race, ownerEmail);
      set((state) => ({
        characters: [newChar, ...state.characters],
        activeCharacter: newChar,
        isSaving: false,
      }));
      sessionStorage.setItem('supaflex_last_active_char_id', String(newChar.id));
      return newChar;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to create character.' });
      return null;
    }
  },

  setPlayerEmail: (email: string) => {
    const trimmed = email.trim();
    sessionStorage.setItem('supaflex_player_email', trimmed);
    set({ playerEmail: trimmed });
  },

  setPlayerName: (name: string) => {
    const trimmed = name.trim();
    sessionStorage.setItem('supaflex_player_name', trimmed);
    set({ playerName: trimmed });
  },

  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => {
    sessionStorage.setItem('supaflex_filter_mode', mode);
    set({ filterMode: mode });
  },

  updateActiveSheetData: (updater) => {
    const active = get().activeCharacter;
    if (!active) return;

    const currentSheet = active.sheet_data || createDefaultSheetData();
    const updatedSheet = updater({ ...currentSheet });

    set((state) => {
      if (!state.activeCharacter) return state;
      const updatedActive = {
        ...state.activeCharacter,
        hp: updatedSheet.current_vitality,
        might: updatedSheet.attribute_dice.might,
        motion: updatedSheet.attribute_dice.motion,
        mind: updatedSheet.attribute_dice.mind,
        magic: updatedSheet.attribute_dice.magic,
        moxie: updatedSheet.attribute_dice.moxie,
        sheet_data: updatedSheet,
      };
      return {
        activeCharacter: updatedActive,
        characters: state.characters.map((c) => (c.id === updatedActive.id ? updatedActive : c)),
      };
    });
  },

  updateActiveCharacterMeta: (updates: Partial<Character>) => {
    set((state) => {
      if (!state.activeCharacter) return state;
      const updated = { ...state.activeCharacter, ...updates };
      return {
        activeCharacter: updated,
        characters: state.characters.map((c) => (c.id === updated.id ? updated : c)),
      };
    });
  },

  saveActiveCharacter: async () => {
    const active = get().activeCharacter;
    if (!active) return;
    set({ isSaving: true });
    try {
      const saved = await gameApi.updateCharacter(active.id, {
        name: active.name,
        class: active.class,
        race: active.race,
        hp: active.hp,
        might: active.might,
        motion: active.motion,
        mind: active.mind,
        magic: active.magic,
        moxie: active.moxie,
        skills: active.skills,
        inventory: active.inventory,
        owner_email: active.owner_email,
        sheet_data: active.sheet_data,
      });

      set((state) => ({
        activeCharacter: saved,
        characters: state.characters.map((c) => (c.id === saved.id ? saved : c)),
        isSaving: false,
      }));
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to save character.' });
    }
  },

  deleteCharacter: async (id: number) => {
    set({ isSaving: true });
    try {
      await gameApi.deleteCharacter(id);
      set((state) => {
        const remaining = state.characters.filter((c) => c.id !== id);
        return {
          isSaving: false,
          characters: remaining,
          activeCharacter: state.activeCharacter?.id === id ? remaining[0] || null : state.activeCharacter,
        };
      });
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to delete character.' });
    }
  },

  addCharge: (amount = 1) => {
    get().updateActiveSheetData((prev) => {
      const currentCharges = prev.charges ?? prev.sparks ?? 0;
      const nextCharges = Math.min(5, currentCharges + amount);
      const isSparked = nextCharges === 5;
      return {
        ...prev,
        charges: nextCharges,
        is_sparked: isSparked,
        sparks: nextCharges,
        is_charged: isSparked,
      };
    });
  },

  spendSpark: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      charges: 0,
      is_sparked: false,
      sparks: 0,
      is_charged: false,
    }));
  },

  resetCharges: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      charges: 0,
      is_sparked: false,
      sparks: 0,
      is_charged: false,
    }));
  },

  addSpark: (amount = 1) => get().addCharge(amount),
  spendMeta: () => get().spendSpark(),
  resetSparks: () => get().resetCharges(),

  toggleReadyPower: (powerName: string) => {
    const active = get().activeCharacter;
    if (!active || !active.sheet_data) return { success: false, error: 'No active character.' };

    const sheet = active.sheet_data;
    const powerSlots = Array.isArray(sheet.power_slots) ? [...sheet.power_slots] : [];
    const codex = Array.isArray(sheet.character_power_codex) ? [...sheet.character_power_codex] : [];

    // Case 1: Power is currently in power_slots (Active Matrix) -> Unready to Codex
    const readiedIndex = powerSlots.findIndex((p) => p && p.name && p.name.trim().toLowerCase() === powerName.trim().toLowerCase());
    if (readiedIndex >= 0) {
      const [removed] = powerSlots.splice(readiedIndex, 1);
      const unreadied = { ...removed, is_readied: false };
      codex.push(unreadied);

      get().updateActiveSheetData((prev) => ({
        ...prev,
        power_slots: powerSlots,
        character_power_codex: codex,
      }));
      return { success: true };
    }

    // Case 2: Power is currently in character_power_codex -> Ready into Matrix
    const codexIndex = codex.findIndex((p) => p && p.name && p.name.trim().toLowerCase() === powerName.trim().toLowerCase());
    if (codexIndex >= 0) {
      const targetPower = codex[codexIndex];
      const cat = getPowerReadyCategory(targetPower);

      // Support & Passives cost 0 slots, always allowed
      if (cat === 'support_passive' || (cat as any) === 'contextual_passive') {
        const [removed] = codex.splice(codexIndex, 1);
        powerSlots.push({ ...removed, is_readied: true, ready: 'support_passive' });

        get().updateActiveSheetData((prev) => ({
          ...prev,
          power_slots: powerSlots,
          character_power_codex: codex,
        }));
        return { success: true };
      }

      // Tactical power -> validate against Tier capacity and caps
      const testSlots = [...powerSlots, { ...targetPower, is_readied: true, ready: cat }];
      const validation = validateReadyMatrix(testSlots, sheet.level);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const [removed] = codex.splice(codexIndex, 1);
      powerSlots.push({ ...removed, is_readied: true, ready: cat });

      get().updateActiveSheetData((prev) => ({
        ...prev,
        power_slots: powerSlots,
        character_power_codex: codex,
      }));
      return { success: true };
    }

    return { success: false, error: `Power "${powerName}" not found in active sheet or Vault.` };
  },

  executeTacticalPivot: (unreadyPowerName: string, readyPowerName: string) => {
    const active = get().activeCharacter;
    if (!active || !active.sheet_data) return { success: false, error: 'No active character.' };

    const sheet = active.sheet_data;
    if (sheet.tactical_pivot_used_in_encounter) {
      return { success: false, error: 'Tactical Pivot has already been used in this encounter (1 per encounter).' };
    }

    const charges = typeof sheet.charges === 'number' ? sheet.charges : (sheet.sparks || 0);
    const isSparked = sheet.is_sparked || charges >= 5;
    if (!isSparked && charges < 5) {
      return { success: false, error: 'Tactical Pivot requires 1 Full Spark (5 Charges).' };
    }

    const powerSlots = Array.isArray(sheet.power_slots) ? [...sheet.power_slots] : [];
    const codex = Array.isArray(sheet.character_power_codex) ? [...sheet.character_power_codex] : [];

    const codexIdx = codex.findIndex((p) => p && p.name && p.name.trim().toLowerCase() === unreadyPowerName.trim().toLowerCase());
    const readyIdx = powerSlots.findIndex((p) => p && p.name && p.name.trim().toLowerCase() === readyPowerName.trim().toLowerCase());

    if (codexIdx < 0) return { success: false, error: `Codex power "${unreadyPowerName}" not found.` };
    if (readyIdx < 0) return { success: false, error: `Ready power "${readyPowerName}" not found.` };

    const incomingPower = codex[codexIdx];
    const outgoingPower = powerSlots[readyIdx];

    const newPowerSlots = [...powerSlots];
    newPowerSlots[readyIdx] = { ...incomingPower, is_readied: true, ready: getPowerReadyCategory(incomingPower) };

    const validation = validateReadyMatrix(newPowerSlots, sheet.level);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const newCodex = [...codex];
    newCodex[codexIdx] = { ...outgoingPower, is_readied: false, ready: getPowerReadyCategory(outgoingPower) };

    const remainingCharges = Math.max(0, charges - 5);

    get().updateActiveSheetData((prev) => ({
      ...prev,
      power_slots: newPowerSlots,
      character_power_codex: newCodex,
      charges: remainingCharges,
      sparks: remainingCharges,
      is_sparked: remainingCharges >= 5,
      is_charged: remainingCharges >= 5,
      tactical_pivot_used_in_encounter: true,
    }));

    return { success: true };
  },

  resetTacticalPivot: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      tactical_pivot_used_in_encounter: false,
    }));
  },

  recordApExpenditure: (cost, category, description, tier, source) => {
    get().updateActiveSheetData((prev) => {
      const log = prev.ap_log || [];
      const newEntry = {
        id: `ap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        category,
        cost,
        description,
        tier,
        source,
      };
      const updatedLog = [newEntry, ...log];
      const currentAp = typeof prev.ap === 'number' ? prev.ap : 1;
      const nextAp = Math.max(0, currentAp - cost);

      return {
        ...prev,
        ap: nextAp,
        ap_log: updatedLog,
      };
    });
  },

  revertApExpenditure: (entryId: string) => {
    get().updateActiveSheetData((prev) => {
      const log = prev.ap_log || [];
      const target = log.find((e) => e.id === entryId);
      if (!target) return prev;

      const updatedLog = log.filter((e) => e.id !== entryId);
      const currentAp = typeof prev.ap === 'number' ? prev.ap : 0;
      const nextAp = currentAp + target.cost;

      return {
        ...prev,
        ap: nextAp,
        ap_log: updatedLog,
      };
    });
  },

  syncSheetRulesToDatabase: async () => {
    const active = get().activeCharacter;
    if (!active || !active.sheet_data) return { updatedCount: 0, preservedCount: 0 };

    let updatedCount = 0;
    let preservedCount = 0;

    try {
      const [powers, magicItems, weapons, armor, shields] = await Promise.all([
        gameApi.getPowers().catch(() => []),
        gameApi.getMagicItems().catch(() => []),
        gameApi.getWeapons().catch(() => []),
        gameApi.getArmor().catch(() => []),
        gameApi.getShields().catch(() => []),
      ]);

      const sheet = active.sheet_data;

      // Powers & Spells
      const updateAbilitySlots = (slots: any[]) => {
        return (slots || []).map((slot: any) => {
          if (!slot || !slot.name || (slot.version && slot.version > 1)) {
            if (slot && slot.name) preservedCount++;
            return slot;
          }
          const match = powers.find((p: any) => p.name.trim().toLowerCase() === slot.name.trim().toLowerCase());
          if (match) {
            updatedCount++;
            return {
              ...slot,
              action: match.action || slot.action,
              usage: match.usage || slot.usage,
              effect: match.effect || slot.effect,
            };
          }
          preservedCount++;
          return slot;
        });
      };

      // Magic Items / Gear
      const updatedGearSlots = (sheet.gear_slots || []).map((item: any) => {
        if (!item || !item.name || (item.version && item.version > 1)) {
          if (item && item.name) preservedCount++;
          return item;
        }
        const match = magicItems.find((m: any) => m.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          return {
            ...item,
            usage: match.usage || item.usage,
            effect: match.effect || item.effect,
          };
        }
        preservedCount++;
        return item;
      });

      // Weapons
      const updatedWeapons = (sheet.weapons || []).map((w: any) => {
        if (!w || !w.name) return w;
        const match = weapons.find((masterW: any) => masterW.name.trim().toLowerCase() === w.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          return {
            ...w,
            atk: match.atk || w.atk,
            dmg: match.dmg || w.dmg,
            max_blk: match.max_block || w.max_blk,
          };
        }
        preservedCount++;
        return w;
      });

      // Armor
      let updatedArmor = sheet.armor_slot;
      if (sheet.armor_slot && sheet.armor_slot.name && sheet.armor_slot.name !== 'Unarmored') {
        const match = armor.find((a: any) => a.name.trim().toLowerCase() === sheet.armor_slot!.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          updatedArmor = {
            ...sheet.armor_slot,
            ar: parseInt(String(match.ar).replace(/[^\d]/g, ''), 10) || sheet.armor_slot.ar,
            mr: match.mr || sheet.armor_slot.mr,
            requirement: match.requirement || sheet.armor_slot.requirement,
            cost: match.cost || sheet.armor_slot.cost,
          };
        } else {
          preservedCount++;
        }
      }

      // Shield
      let updatedShield = sheet.shield_slot;
      if (sheet.shield_slot && sheet.shield_slot.name) {
        const match = shields.find((s: any) => s.name.trim().toLowerCase() === sheet.shield_slot!.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          const shieldBlockNum = typeof match.max_block === 'number' ? match.max_block : parseInt(String(match.max_block).replace(/[^\d]/g, ''), 10);
          updatedShield = {
            ...sheet.shield_slot,
            max_block: shieldBlockNum || sheet.shield_slot.max_block,
            mr_adjustment: match.mr || sheet.shield_slot.mr_adjustment,
            requirement: match.requirement || sheet.shield_slot.requirement,
            cost: match.cost || sheet.shield_slot.cost,
          };
        } else {
          preservedCount++;
        }
      }

      get().updateActiveSheetData((prev) => ({
        ...prev,
        power_slots: updateAbilitySlots(prev.power_slots),
        spell_slots: updateAbilitySlots(prev.spell_slots),
        gear_slots: updatedGearSlots,
        weapons: updatedWeapons,
        armor_slot: updatedArmor,
        shield_slot: updatedShield,
      }));

      await get().saveActiveCharacter();
      return { updatedCount, preservedCount };
    } catch (err) {
      console.error('Error syncing sheet rules:', err);
      return { updatedCount: 0, preservedCount: 0 };
    }
  },

  // --- PLAYER LINKS (Account-Wide) ---
  fetchPlayerLinks: () => {
    const email = get().playerEmail || 'default';
    try {
      const saved = localStorage.getItem(`supaflex_player_links_${email}`);
      if (saved) {
        set({ playerLinks: JSON.parse(saved) });
        return;
      }
    } catch {}
    set({ playerLinks: [] });
  },

  addPlayerLink: (name: string, url: string) => {
    const email = get().playerEmail || 'default';
    const newLink: EncounterLink = {
      id: `pl_link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      url: url.trim(),
      created_at: new Date().toISOString(),
    };
    const updated = [...get().playerLinks, newLink];
    set({ playerLinks: updated });
    try {
      localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(updated));
    } catch {}
  },

  updatePlayerLink: (linkId: string, name: string, url: string) => {
    const email = get().playerEmail || 'default';
    const updated = get().playerLinks.map((l) =>
      l.id === linkId ? { ...l, name: name.trim(), url: url.trim() } : l
    );
    set({ playerLinks: updated });
    try {
      localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(updated));
    } catch {}
  },

  deletePlayerLink: (linkId: string) => {
    const email = get().playerEmail || 'default';
    const updated = get().playerLinks.filter((l) => l.id !== linkId);
    set({ playerLinks: updated });
    try {
      localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(updated));
    } catch {}
  },

  reorderPlayerLinkByIndex: (fromIdx: number, toIdx: number) => {
    const email = get().playerEmail || 'default';
    const links = [...get().playerLinks];
    if (fromIdx < 0 || fromIdx >= links.length || toIdx < 0 || toIdx >= links.length) return;
    const [moved] = links.splice(fromIdx, 1);
    links.splice(toIdx, 0, moved);
    set({ playerLinks: links });
    try {
      localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(links));
    } catch {}
  },

  // --- CHARACTER LINKS (Character-Specific) ---
  addCharacterLink: (name: string, url: string) => {
    const newLink: EncounterLink = {
      id: `char_link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      url: url.trim(),
      created_at: new Date().toISOString(),
    };
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: [...(prev.character_links || []), newLink],
    }));
    get().saveActiveCharacter();
  },

  updateCharacterLink: (linkId: string, name: string, url: string) => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: (prev.character_links || []).map((l) =>
        l.id === linkId ? { ...l, name: name.trim(), url: url.trim() } : l
      ),
    }));
    get().saveActiveCharacter();
  },

  deleteCharacterLink: (linkId: string) => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: (prev.character_links || []).filter((l) => l.id !== linkId),
    }));
    get().saveActiveCharacter();
  },

  reorderCharacterLinkByIndex: (fromIdx: number, toIdx: number) => {
    const charLinks = get().activeCharacter?.sheet_data?.character_links || [];
    if (fromIdx < 0 || fromIdx >= charLinks.length || toIdx < 0 || toIdx >= charLinks.length) return;
    const links = [...charLinks];
    const [moved] = links.splice(fromIdx, 1);
    links.splice(toIdx, 0, moved);
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: links,
    }));
    get().saveActiveCharacter();
  },
}));
