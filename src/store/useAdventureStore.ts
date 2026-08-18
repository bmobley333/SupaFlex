// src/store/useAdventureStore.ts
// Centralized Zustand store for GM Adventure, Act & Encounter pre-staging hierarchy & live play modes

import { create } from 'zustand';
import { GmAdventure, GmAct, GmEncounter, PreStagedMonster, GmSessionMode } from '../types/adventures';
import { gameApi } from '../services/api';
import { parseMonsterLine } from '../utils/monsterStatParser';
import { scaleParsedMonster } from '../utils/monsterStatScaler';

interface AdventureStoreState {
  adventures: GmAdventure[];
  activeAdventureId: string | null;
  activeActId: string | null;
  activeEncounterId: string | null;
  sessionMode: GmSessionMode;
  isLoading: boolean;

  // Game Day Temporary In-Memory Sandbox (encounterId -> monsters)
  gameDaySandbox: Record<string, PreStagedMonster[]>;

  // Getters / Selectors
  getActiveAdventure: () => GmAdventure | null;
  getActiveAct: () => GmAct | null;
  getActiveEncounter: () => GmEncounter | null;
  getActiveMonsters: () => PreStagedMonster[];

  // Mode & Navigation
  setSessionMode: (mode: GmSessionMode) => void;
  fetchAdventures: (gmEmail: string) => Promise<void>;
  selectAdventure: (adventureId: string) => void;
  selectAct: (actId: string) => void;
  selectEncounter: (encounterId: string) => void;
  nextEncounter: () => void;
  prevEncounter: () => void;

  // Adventure CRUD & Publishing
  createAdventure: (title: string, gmEmail: string, genre?: string) => Promise<GmAdventure | null>;
  updateAdventure: (id: string, updates: Partial<GmAdventure>) => Promise<void>;
  deleteAdventure: (id: string) => Promise<void>;
  renameAdventure: (id: string, newTitle: string) => Promise<void>;
  publishAdventure: (adventureId: string, isPublished: boolean) => Promise<void>;

  // Act CRUD & Reordering
  addAct: (adventureId: string, title?: string) => Promise<void>;
  updateAct: (adventureId: string, actId: string, updates: Partial<GmAct>) => Promise<void>;
  deleteAct: (adventureId: string, actId: string) => Promise<void>;
  renameAct: (adventureId: string, actId: string, newTitle: string) => Promise<void>;
  reorderActByIndex: (adventureId: string, fromIdx: number, toIdx: number) => Promise<void>;
  reorderActs: (adventureId: string, acts: GmAct[]) => Promise<void>;

  // Encounter CRUD & Reordering
  addEncounter: (adventureId: string, actId: string, title?: string) => Promise<void>;
  updateEncounter: (adventureId: string, actId: string, encounterId: string, updates: Partial<GmEncounter>) => Promise<void>;
  deleteEncounter: (adventureId: string, actId: string, encounterId: string) => Promise<void>;
  renameEncounter: (adventureId: string, actId: string, encounterId: string, newTitle: string) => Promise<void>;
  reorderEncounterByIndex: (adventureId: string, actId: string, fromIdx: number, toIdx: number) => Promise<void>;
  duplicateEncounter: (adventureId: string, actId: string, encounterId: string) => Promise<void>;
  reorderEncounters: (adventureId: string, actId: string, encounters: GmEncounter[]) => Promise<void>;

  // Tactical Notes & Live Monsters Manipulation
  setEncounterNotes: (notes: string) => void;
  setEncounterMonsters: (monsters: PreStagedMonster[]) => void;
  scaleEncounterDifficulty: (targetDif: number) => void;
  resetGameDayEncounter: () => void;
  deployToLiveParty: (partyId: string) => Promise<void>;
}

const STORAGE_ACTIVE_ADV = 'supaflex_active_adv_id';
const STORAGE_ACTIVE_ACT = 'supaflex_active_act_id';
const STORAGE_ACTIVE_ENC = 'supaflex_active_enc_id';
const STORAGE_SESSION_MODE = 'supaflex_gm_session_mode';

const getInitialSessionMode = (): GmSessionMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_SESSION_MODE);
    if (saved === 'design' || saved === 'game_day') return saved;
  }
  return 'design';
};

export const useAdventureStore = create<AdventureStoreState>((set, get) => ({
  adventures: [],
  activeAdventureId: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_ADV) : null,
  activeActId: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_ACT) : null,
  activeEncounterId: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_ENC) : null,
  sessionMode: getInitialSessionMode(),
  isLoading: false,
  gameDaySandbox: {},

  getActiveAdventure: () => {
    const { adventures, activeAdventureId } = get();
    if (!activeAdventureId) return adventures[0] || null;
    return adventures.find((a) => a.id === activeAdventureId) || null;
  },

  getActiveAct: () => {
    const adv = get().getActiveAdventure();
    if (!adv || !adv.structure?.acts?.length) return null;
    const { activeActId } = get();
    if (!activeActId) return adv.structure.acts[0] || null;
    return adv.structure.acts.find((act) => act.id === activeActId) || null;
  },

  getActiveEncounter: () => {
    const act = get().getActiveAct();
    if (!act || !act.encounters?.length) return null;
    const { activeEncounterId } = get();
    if (!activeEncounterId) return act.encounters[0] || null;
    return act.encounters.find((enc) => enc.id === activeEncounterId) || null;
  },

  getActiveMonsters: () => {
    const { sessionMode, gameDaySandbox } = get();
    const enc = get().getActiveEncounter();
    if (!enc) return [];

    if (sessionMode === 'game_day' && gameDaySandbox[enc.id]) {
      return gameDaySandbox[enc.id];
    }
    return enc.monsters || [];
  },

  setSessionMode: (mode: GmSessionMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_SESSION_MODE, mode);
    }
    set({ sessionMode: mode });
  },

  fetchAdventures: async (gmEmail: string) => {
    if (!gmEmail) return;
    set({ isLoading: true });
    try {
      let list = await gameApi.getAdventuresForUser(gmEmail);

      // If user has no adventures yet, auto-create a default adventure
      if (list.length === 0) {
        const created = await gameApi.createAdventure('The Lost Crypts', gmEmail, 'Medieval');
        if (created) {
          list = [created];
        }
      }

      set({ adventures: list });

      // Auto-validate and select first adventure/act/encounter if none selected or stale
      const currentAdvId = get().activeAdventureId;
      const targetAdv = list.find((a: GmAdventure) => a.id === currentAdvId) || list[0];

      if (targetAdv) {
        get().selectAdventure(targetAdv.id);
      }
    } catch (e) {
      console.error('[useAdventureStore] Error fetching adventures:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  selectAdventure: (adventureId: string) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_ADV, adventureId);
    }

    const firstAct = adv.structure?.acts?.[0];
    const firstEnc = firstAct?.encounters?.[0];

    const actId = firstAct ? firstAct.id : null;
    const encId = firstEnc ? firstEnc.id : null;

    if (typeof window !== 'undefined') {
      if (actId) localStorage.setItem(STORAGE_ACTIVE_ACT, actId);
      else localStorage.removeItem(STORAGE_ACTIVE_ACT);
      if (encId) localStorage.setItem(STORAGE_ACTIVE_ENC, encId);
      else localStorage.removeItem(STORAGE_ACTIVE_ENC);
    }

    set({
      activeAdventureId: adventureId,
      activeActId: actId,
      activeEncounterId: encId,
    });
  },

  selectAct: (actId: string) => {
    const adv = get().getActiveAdventure();
    if (!adv) return;

    const targetAct = adv.structure?.acts?.find((a) => a.id === actId);
    if (!targetAct) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_ACT, actId);
    }

    const firstEnc = targetAct.encounters?.[0];
    const encId = firstEnc ? firstEnc.id : null;

    if (typeof window !== 'undefined') {
      if (encId) localStorage.setItem(STORAGE_ACTIVE_ENC, encId);
      else localStorage.removeItem(STORAGE_ACTIVE_ENC);
    }

    set({
      activeActId: actId,
      activeEncounterId: encId,
    });
  },

  selectEncounter: (encounterId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTIVE_ENC, encounterId);
    }
    set({ activeEncounterId: encounterId });
  },

  nextEncounter: () => {
    const adv = get().getActiveAdventure();
    const act = get().getActiveAct();
    const enc = get().getActiveEncounter();
    if (!adv || !act || !enc || !act.encounters) return;

    const encIdx = act.encounters.findIndex((e) => e.id === enc.id);
    if (encIdx !== -1 && encIdx < act.encounters.length - 1) {
      // Next encounter in current act
      get().selectEncounter(act.encounters[encIdx + 1].id);
    } else {
      // Step to next Act's first encounter if available
      const acts = adv.structure?.acts || [];
      const actIdx = acts.findIndex((a) => a.id === act.id);
      if (actIdx !== -1 && actIdx < acts.length - 1) {
        const nextAct = acts[actIdx + 1];
        get().selectAct(nextAct.id);
      }
    }
  },

  prevEncounter: () => {
    const adv = get().getActiveAdventure();
    const act = get().getActiveAct();
    const enc = get().getActiveEncounter();
    if (!adv || !act || !enc || !act.encounters) return;

    const encIdx = act.encounters.findIndex((e) => e.id === enc.id);
    if (encIdx > 0) {
      // Previous encounter in current act
      get().selectEncounter(act.encounters[encIdx - 1].id);
    } else {
      // Step to previous Act's last encounter if available
      const acts = adv.structure?.acts || [];
      const actIdx = acts.findIndex((a) => a.id === act.id);
      if (actIdx > 0) {
        const prevAct = acts[actIdx - 1];
        if (prevAct.encounters?.length) {
          get().selectAct(prevAct.id);
          get().selectEncounter(prevAct.encounters[prevAct.encounters.length - 1].id);
        }
      }
    }
  },

  createAdventure: async (title: string, gmEmail: string, genre = 'Medieval') => {
    try {
      const created = await gameApi.createAdventure(title, gmEmail, genre);
      if (created) {
        set((state) => ({ adventures: [created, ...state.adventures] }));
        get().selectAdventure(created.id);
      }
      return created;
    } catch (e) {
      console.error('[useAdventureStore] Error creating adventure:', e);
      return null;
    }
  },

  updateAdventure: async (id: string, updates: Partial<GmAdventure>) => {
    try {
      const updated = await gameApi.updateAdventure(id, updates);
      if (updated) {
        set((state) => ({
          adventures: state.adventures.map((a) => (a.id === id ? { ...a, ...updated } : a)),
        }));
      }
    } catch (e) {
      console.error('[useAdventureStore] Error updating adventure:', e);
    }
  },

  deleteAdventure: async (id: string) => {
    try {
      const ok = await gameApi.deleteAdventure(id);
      if (ok) {
        set((state) => {
          const filtered = state.adventures.filter((a) => a.id !== id);
          return {
            adventures: filtered,
            activeAdventureId: filtered[0]?.id || null,
            activeActId: filtered[0]?.structure?.acts?.[0]?.id || null,
            activeEncounterId: filtered[0]?.structure?.acts?.[0]?.encounters?.[0]?.id || null,
          };
        });
        const remaining = get().adventures;
        if (remaining[0]) {
          get().selectAdventure(remaining[0].id);
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_ACTIVE_ADV);
            localStorage.removeItem(STORAGE_ACTIVE_ACT);
            localStorage.removeItem(STORAGE_ACTIVE_ENC);
          }
        }
      }
    } catch (e) {
      console.error('[useAdventureStore] Error deleting adventure:', e);
    }
  },

  renameAdventure: async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    await get().updateAdventure(id, { title: newTitle.trim() });
  },

  publishAdventure: async (adventureId: string, isPublished: boolean) => {
    await get().updateAdventure(adventureId, { is_published: isPublished });
  },

  renameAct: async (adventureId: string, actId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    await get().updateAct(adventureId, actId, { title: newTitle.trim() });
  },

  reorderActByIndex: async (adventureId: string, fromIdx: number, toIdx: number) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv || !adv.structure?.acts) return;
    const acts = [...adv.structure.acts];
    if (fromIdx < 0 || fromIdx >= acts.length || toIdx < 0 || toIdx >= acts.length) return;
    const [moved] = acts.splice(fromIdx, 1);
    acts.splice(toIdx, 0, moved);
    await get().reorderActs(adventureId, acts);
  },

  addAct: async (adventureId: string, title?: string) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const nowIso = new Date().toISOString();
    const actCount = (adv.structure?.acts?.length || 0) + 1;
    const newAct: GmAct = {
      id: `act_${Date.now()}`,
      title: title?.trim() || `Act ${actCount}`,
      description: '',
      encounters: [
        {
          id: `enc_${Date.now()}`,
          title: `Encounter 1`,
          notes: '',
          master_dif: 10,
          monsters: [],
          created_at: nowIso,
        },
      ],
      created_at: nowIso,
    };

    const updatedActs = [...(adv.structure?.acts || []), newAct];
    const newStructure = { ...adv.structure, acts: updatedActs };

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
      activeActId: newAct.id,
      activeEncounterId: newAct.encounters[0].id,
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  updateAct: async (adventureId: string, actId: string, updates: Partial<GmAct>) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const updatedActs = (adv.structure?.acts || []).map((act) => (act.id === actId ? { ...act, ...updates } : act));
    const newStructure = { ...adv.structure, acts: updatedActs };

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  deleteAct: async (adventureId: string, actId: string) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const updatedActs = (adv.structure?.acts || []).filter((act) => act.id !== actId);
    const newStructure = { ...adv.structure, acts: updatedActs };

    const remainingAct = updatedActs[0] || null;
    const remainingEnc = remainingAct?.encounters?.[0] || null;

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
      activeActId: get().activeActId === actId ? (remainingAct?.id || null) : get().activeActId,
      activeEncounterId: get().activeActId === actId ? (remainingEnc?.id || null) : get().activeEncounterId,
    }));

    if (get().activeActId === actId) {
      if (typeof window !== 'undefined') {
        if (remainingAct) localStorage.setItem(STORAGE_ACTIVE_ACT, remainingAct.id);
        else localStorage.removeItem(STORAGE_ACTIVE_ACT);
        if (remainingEnc) localStorage.setItem(STORAGE_ACTIVE_ENC, remainingEnc.id);
        else localStorage.removeItem(STORAGE_ACTIVE_ENC);
      }
    }

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  reorderActs: async (adventureId: string, acts: GmAct[]) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const newStructure = { ...adv.structure, acts };
    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  addEncounter: async (adventureId: string, actId: string, title?: string) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const act = (adv.structure?.acts || []).find((a) => a.id === actId);
    if (!act) return;

    const nowIso = new Date().toISOString();
    const encCount = (act.encounters?.length || 0) + 1;
    const newEnc: GmEncounter = {
      id: `enc_${Date.now()}`,
      title: title?.trim() || `Encounter ${encCount}`,
      notes: '',
      master_dif: 10,
      monsters: [],
      created_at: nowIso,
    };

    const updatedActs = (adv.structure?.acts || []).map((a) => {
      if (a.id !== actId) return a;
      return {
        ...a,
        encounters: [...(a.encounters || []), newEnc],
      };
    });

    const newStructure = { ...adv.structure, acts: updatedActs };

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
      activeEncounterId: newEnc.id,
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  updateEncounter: async (adventureId: string, actId: string, encounterId: string, updates: Partial<GmEncounter>) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const updatedActs = (adv.structure?.acts || []).map((a) => {
      if (a.id !== actId) return a;
      return {
        ...a,
        encounters: (a.encounters || []).map((e) => (e.id === encounterId ? { ...e, ...updates } : e)),
      };
    });

    const newStructure = { ...adv.structure, acts: updatedActs };

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  deleteEncounter: async (adventureId: string, actId: string, encounterId: string) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const updatedActs = (adv.structure?.acts || []).map((a) => {
      if (a.id !== actId) return a;
      return {
        ...a,
        encounters: (a.encounters || []).filter((e) => e.id !== encounterId),
      };
    });

    const newStructure = { ...adv.structure, acts: updatedActs };
    const currentAct = updatedActs.find((a) => a.id === actId);
    const remainingEnc = currentAct?.encounters?.[0] || null;

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
      activeEncounterId: get().activeEncounterId === encounterId ? (remainingEnc?.id || null) : get().activeEncounterId,
    }));

    if (get().activeEncounterId === encounterId) {
      if (typeof window !== 'undefined') {
        if (remainingEnc) localStorage.setItem(STORAGE_ACTIVE_ENC, remainingEnc.id);
        else localStorage.removeItem(STORAGE_ACTIVE_ENC);
      }
    }

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  duplicateEncounter: async (adventureId: string, actId: string, encounterId: string) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const act = (adv.structure?.acts || []).find((a) => a.id === actId);
    if (!act) return;

    const sourceEnc = (act.encounters || []).find((e) => e.id === encounterId);
    if (!sourceEnc) return;

    const nowIso = new Date().toISOString();
    const clonedEnc: GmEncounter = {
      ...sourceEnc,
      id: `enc_${Date.now()}`,
      title: `${sourceEnc.title} (Copy)`,
      created_at: nowIso,
      monsters: (sourceEnc.monsters || []).map((m) => ({ ...m, id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` })),
    };

    const updatedActs = (adv.structure?.acts || []).map((a) => {
      if (a.id !== actId) return a;
      return {
        ...a,
        encounters: [...(a.encounters || []), clonedEnc],
      };
    });

    const newStructure = { ...adv.structure, acts: updatedActs };

    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
      activeEncounterId: clonedEnc.id,
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  renameEncounter: async (adventureId: string, actId: string, encounterId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    await get().updateEncounter(adventureId, actId, encounterId, { title: newTitle.trim() });
  },

  reorderEncounterByIndex: async (adventureId: string, actId: string, fromIdx: number, toIdx: number) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv || !adv.structure?.acts) return;
    const act = adv.structure.acts.find((a) => a.id === actId);
    if (!act || !act.encounters) return;
    const encounters = [...act.encounters];
    if (fromIdx < 0 || fromIdx >= encounters.length || toIdx < 0 || toIdx >= encounters.length) return;
    const [moved] = encounters.splice(fromIdx, 1);
    encounters.splice(toIdx, 0, moved);
    await get().reorderEncounters(adventureId, actId, encounters);
  },

  reorderEncounters: async (adventureId: string, actId: string, encounters: GmEncounter[]) => {
    const adv = get().adventures.find((a) => a.id === adventureId);
    if (!adv) return;

    const updatedActs = (adv.structure?.acts || []).map((a) => {
      if (a.id !== actId) return a;
      return { ...a, encounters };
    });

    const newStructure = { ...adv.structure, acts: updatedActs };
    set((state) => ({
      adventures: state.adventures.map((a) => (a.id === adventureId ? { ...a, structure: newStructure } : a)),
    }));

    await get().updateAdventure(adventureId, { structure: newStructure });
  },

  setEncounterNotes: (notes: string) => {
    const { sessionMode, activeAdventureId, activeActId, activeEncounterId } = get();
    if (!activeAdventureId || !activeActId || !activeEncounterId) return;

    if (sessionMode === 'design') {
      get().updateEncounter(activeAdventureId, activeActId, activeEncounterId, {
        notes,
        tactical_notes: notes,
      });
    } else {
      const adv = get().getActiveAdventure();
      const act = get().getActiveAct();
      if (!adv || !act) return;
      const updatedAdv = {
        ...adv,
        structure: {
          ...adv.structure,
          acts: adv.structure.acts.map((a) =>
            a.id === act.id
              ? {
                  ...a,
                  encounters: a.encounters.map((e) =>
                    e.id === activeEncounterId ? { ...e, notes, tactical_notes: notes } : e
                  ),
                }
              : a
          ),
        },
      };
      set((state) => ({
        adventures: state.adventures.map((a) => (a.id === adv.id ? updatedAdv : a)),
      }));
    }
  },

  setEncounterMonsters: (monsters: PreStagedMonster[]) => {
    const { sessionMode, activeAdventureId, activeActId, activeEncounterId } = get();
    if (!activeAdventureId || !activeActId || !activeEncounterId) return;

    if (sessionMode === 'game_day') {
      // Update temporary sandbox only
      set((state) => ({
        gameDaySandbox: {
          ...state.gameDaySandbox,
          [activeEncounterId]: monsters,
        },
      }));
    } else {
      // Design Mode: Persist directly to adventure encounter structure
      get().updateEncounter(activeAdventureId, activeActId, activeEncounterId, { monsters });
    }
  },

  scaleEncounterDifficulty: (targetDif: number) => {
    const currentMonsters = get().getActiveMonsters();
    if (currentMonsters.length === 0) return;

    const scaled = currentMonsters.map((m) => {
      const baseText = m.baseFullText || m.fullText || m.nameWithEquip;
      const baseParsed = parseMonsterLine(baseText);
      const scaledMonster = scaleParsedMonster(baseParsed, targetDif);
      return {
        ...scaledMonster,
        id: m.id,
        baseFullText: baseText,
        scaled_dif: targetDif,
      };
    });

    const { sessionMode, activeAdventureId, activeActId, activeEncounterId } = get();
    if (!activeAdventureId || !activeActId || !activeEncounterId) return;

    if (sessionMode === 'game_day') {
      set((state) => ({
        gameDaySandbox: {
          ...state.gameDaySandbox,
          [activeEncounterId]: scaled,
        },
      }));
    } else {
      get().updateEncounter(activeAdventureId, activeActId, activeEncounterId, {
        master_dif: targetDif,
        monsters: scaled,
      });
    }
  },

  resetGameDayEncounter: () => {
    const enc = get().getActiveEncounter();
    if (!enc) return;

    set((state) => {
      const updatedSandbox = { ...state.gameDaySandbox };
      delete updatedSandbox[enc.id];
      return { gameDaySandbox: updatedSandbox };
    });
  },

  deployToLiveParty: async (partyId: string) => {
    const monsters = get().getActiveMonsters();
    if (!partyId) return;
    try {
      await gameApi.savePartyMonsters(partyId, monsters);
    } catch (e) {
      console.error('[useAdventureStore] Error deploying encounter to live party:', e);
    }
  },
}));
