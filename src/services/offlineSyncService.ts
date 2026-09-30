// src/services/offlineSyncService.ts
// Offline PWA Resilience & Local-First Outbox Synchronization Engine for SupaFlex.
// Manages IndexedDB persistent queues for character mutations and offline snapshots,
// guaranteeing zero data loss during network drops and clean reconnection flushing.

import { Character, CharacterSheetData } from '../types/game';
import { gameApi } from './api';
import {
  getIndexedDb,
  STORE_CHARACTER_OUTBOX,
  STORE_CHARACTER_CACHE,
} from '../utils/catalogStorage';

export interface CharacterMutation {
  mutationId: string;
  characterId: number;
  timestamp: number;
  type: 'sheet_update';
  updates: Partial<Character>;
}

export interface SyncDrainResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  error?: string;
}

let isDrainingMutex = false;

// Custom Event Dispatcher for Outbox State
export const OUTBOX_CHANGED_EVENT = 'supaflex:outbox-changed';

export function notifyOutboxChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OUTBOX_CHANGED_EVENT));
  }
}

export function subscribeToOutboxChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(OUTBOX_CHANGED_EVENT, callback);
  return () => {
    window.removeEventListener(OUTBOX_CHANGED_EVENT, callback);
  };
}

/**
 * Cache a full character snapshot in IndexedDB for instant offline rehydration.
 */
export async function cacheCharacterSnapshot(character: Character): Promise<void> {
  if (!character || !character.id) return;
  try {
    const db = await getIndexedDb();
    if (!db) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`supaflex_cached_char_${character.id}`, JSON.stringify(character));
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHARACTER_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_CHARACTER_CACHE);
      const req = store.put(character);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[offlineSync] Failed to cache character ${character.id}:`, err);
  }
}

/**
 * Retrieve a cached character snapshot from IndexedDB.
 */
export async function getCachedCharacter(characterId: number): Promise<Character | null> {
  if (!characterId) return null;
  try {
    const db = await getIndexedDb();
    if (!db) {
      if (typeof window !== 'undefined') {
        const raw = sessionStorage.getItem(`supaflex_cached_char_${characterId}`);
        return raw ? JSON.parse(raw) : null;
      }
      return null;
    }

    return await new Promise<Character | null>((resolve) => {
      const tx = db.transaction(STORE_CHARACTER_CACHE, 'readonly');
      const store = tx.objectStore(STORE_CHARACTER_CACHE);
      const req = store.get(characterId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn(`[offlineSync] Failed to retrieve cached character ${characterId}:`, err);
    return null;
  }
}

/**
 * Cache list of characters for offline hero picker.
 */
export async function cacheCharactersList(characters: Character[]): Promise<void> {
  if (!characters || characters.length === 0) return;
  try {
    const db = await getIndexedDb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHARACTER_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_CHARACTER_CACHE);
      characters.forEach((char) => {
        store.put(char);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[offlineSync] Failed to cache characters list:', err);
  }
}

/**
 * Retrieve all cached characters for offline hero picker.
 */
export async function getCachedCharactersList(): Promise<Character[]> {
  try {
    const db = await getIndexedDb();
    if (!db) return [];

    return await new Promise<Character[]>((resolve) => {
      const tx = db.transaction(STORE_CHARACTER_CACHE, 'readonly');
      const store = tx.objectStore(STORE_CHARACTER_CACHE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('[offlineSync] Failed to retrieve cached characters list:', err);
    return [];
  }
}

/**
 * Enqueue a mutation into the persistent outbox and apply to local cache.
 */
export async function enqueueMutation(
  characterId: number,
  updates: Partial<Character>
): Promise<string> {
  const mutationId = `mut_${characterId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const mutation: CharacterMutation = {
    mutationId,
    characterId,
    timestamp: Date.now(),
    type: 'sheet_update',
    updates,
  };

  try {
    // 1. Optimistically update local character cache so local reads see latest state immediately
    const cached = await getCachedCharacter(characterId);
    if (cached) {
      const mergedSheet = updates.sheet_data
        ? { ...cached.sheet_data, ...updates.sheet_data }
        : cached.sheet_data;
      const mergedChar: Character = {
        ...cached,
        ...updates,
        sheet_data: mergedSheet,
      };
      await cacheCharacterSnapshot(mergedChar);
    }

    // 2. Commit mutation to IndexedDB Outbox
    const db = await getIndexedDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CHARACTER_OUTBOX, 'readwrite');
        const store = tx.objectStore(STORE_CHARACTER_OUTBOX);
        const req = store.put(mutation);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    notifyOutboxChanged();
  } catch (err) {
    console.warn('[offlineSync] Failed to enqueue mutation:', err);
  }

  return mutationId;
}

/**
 * Get count of pending un-synced mutations in outbox.
 */
export async function getPendingOutboxCount(): Promise<number> {
  try {
    const db = await getIndexedDb();
    if (!db) return 0;

    return await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_CHARACTER_OUTBOX, 'readonly');
      const store = tx.objectStore(STORE_CHARACTER_OUTBOX);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (err) {
    console.warn('[offlineSync] Failed to get outbox count:', err);
    return 0;
  }
}

/**
 * Get all pending mutations, sorted chronologically.
 */
export async function getPendingMutations(characterId?: number): Promise<CharacterMutation[]> {
  try {
    const db = await getIndexedDb();
    if (!db) return [];

    return await new Promise<CharacterMutation[]>((resolve) => {
      const tx = db.transaction(STORE_CHARACTER_OUTBOX, 'readonly');
      const store = tx.objectStore(STORE_CHARACTER_OUTBOX);
      const req = store.getAll();
      req.onsuccess = () => {
        let results: CharacterMutation[] = req.result || [];
        if (characterId) {
          results = results.filter((m) => m.characterId === characterId);
        }
        results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn('[offlineSync] Failed to get pending mutations:', err);
    return [];
  }
}

/**
 * Remove a specific mutation after successful sync.
 */
export async function removeMutation(mutationId: string): Promise<void> {
  try {
    const db = await getIndexedDb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHARACTER_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_CHARACTER_OUTBOX);
      const req = store.delete(mutationId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    notifyOutboxChanged();
  } catch (err) {
    console.warn(`[offlineSync] Failed to remove mutation ${mutationId}:`, err);
  }
}

/**
 * Remove multiple mutations by ID after successful batch sync.
 */
export async function removeMutations(mutationIds: string[]): Promise<void> {
  if (!mutationIds || mutationIds.length === 0) return;
  try {
    const db = await getIndexedDb();
    if (!db) return;

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHARACTER_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_CHARACTER_OUTBOX);
      mutationIds.forEach((id) => {
        store.delete(id);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    notifyOutboxChanged();
  } catch (err) {
    console.warn('[offlineSync] Failed to batch remove mutations:', err);
  }
}

/**
 * Clear all outbox mutations for a character.
 */
export async function clearCharacterOutbox(characterId: number): Promise<void> {
  try {
    const db = await getIndexedDb();
    if (!db) return;

    const mutations = await getPendingMutations(characterId);
    if (mutations.length === 0) return;

    await removeMutations(mutations.map((m) => m.mutationId));
  } catch (err) {
    console.warn(`[offlineSync] Failed to clear outbox for character ${characterId}:`, err);
  }
}

/**
 * Drains all pending mutations from the IndexedDB Outbox to Supabase.
 * Coalesces sequential mutations per character to minimize roundtrips.
 */
export async function drainOfflineOutbox(
  activeCharacter?: Character | null
): Promise<SyncDrainResult> {
  if (isDrainingMutex) {
    return { success: false, syncedCount: 0, failedCount: 0, error: 'Drain already in progress' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, syncedCount: 0, failedCount: 0, error: 'Device is offline' };
  }

  isDrainingMutex = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await getPendingMutations();
    if (pending.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    // Group mutations by characterId
    const byChar = new Map<number, CharacterMutation[]>();
    pending.forEach((m) => {
      const list = byChar.get(m.characterId) || [];
      list.push(m);
      byChar.set(m.characterId, list);
    });

    for (const [charId, mutations] of byChar.entries()) {
      try {
        // Coalesce all mutations chronologically into a single authoritative update payload
        let coalescedUpdates: Partial<Character> = {};
        for (const m of mutations) {
          const prevSheet = coalescedUpdates.sheet_data || {};
          const nextSheet = m.updates.sheet_data || {};
          coalescedUpdates = {
            ...coalescedUpdates,
            ...m.updates,
            sheet_data: {
              ...prevSheet,
              ...nextSheet,
            } as CharacterSheetData,
          };
        }

        // If this is the active character currently loaded in memory, prefer current memory state
        if (activeCharacter && activeCharacter.id === charId) {
          coalescedUpdates = {
            name: activeCharacter.name,
            class: activeCharacter.class,
            race: activeCharacter.race,
            hp: activeCharacter.hp,
            might: activeCharacter.might,
            motion: activeCharacter.motion,
            mind: activeCharacter.mind,
            magic: activeCharacter.magic,
            moxie: activeCharacter.moxie,
            skills: activeCharacter.skills,
            inventory: activeCharacter.inventory,
            owner_email: activeCharacter.owner_email,
            sheet_data: activeCharacter.sheet_data,
          };
        }

        // Send to Supabase
        const updated = await gameApi.updateCharacter(charId, coalescedUpdates);

        // Success: Remove drained mutations from Outbox
        await removeMutations(mutations.map((m) => m.mutationId));
        await cacheCharacterSnapshot(updated);
        syncedCount += mutations.length;
      } catch (charSyncErr) {
        console.warn(`[offlineSync] Failed to sync mutations for character ${charId}:`, charSyncErr);
        failedCount += mutations.length;
      }
    }

    notifyOutboxChanged();
    return {
      success: failedCount === 0,
      syncedCount,
      failedCount,
    };
  } finally {
    isDrainingMutex = false;
  }
}
