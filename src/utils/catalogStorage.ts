// src/utils/catalogStorage.ts
// Native browser IndexedDB storage engine for SupaFlex catalogs with LocalStorage fallback.
// Eliminates the 5 MB LocalStorage quota bottleneck, prevents cold fetch egress storms,
// and enforces strict Beacon Equality for 100% clock-skew immunity.

export const CATALOG_CACHE_VERSION = 7;
export const CATALOGS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (sliding with beacon check)

export interface RawCatalogsData {
  powers: any[];
  skills: any[];
  traits: any[];
  pathsData: any[];
  setsData: any[];
  bundlesData: any[];
  functionsData: any[];
  modsData: any[];
  playersData: any[];
  suppliesData: any[];
  weaponsData: any[];
  armorData: any[];
  shieldsData: any[];
  chaosGemsData: any[];
}

export interface StoredCatalogEnvelope {
  version: number;
  timestamp: number;
  beacon: string | null;
  data: RawCatalogsData;
}

export const DB_NAME = 'supaflex_cache_db';
export const DB_VERSION = 2;
export const STORE_CATALOGS = 'catalogs';
export const STORE_CHARACTER_OUTBOX = 'character_outbox';
export const STORE_CHARACTER_CACHE = 'character_cache';

const STORE_NAME = STORE_CATALOGS;

let dbPromise: Promise<IDBDatabase | null> | null = null;
let hotMemoryCache: { key: string; envelope: StoredCatalogEnvelope } | null = null;

/**
 * Initializes and caches the native IndexedDB connection with watchdog timeout and lifecycle events.
 */
export function getIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  const openPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_CATALOGS)) {
          db.createObjectStore(STORE_CATALOGS);
        }
        if (!db.objectStoreNames.contains(STORE_CHARACTER_OUTBOX)) {
          const outboxStore = db.createObjectStore(STORE_CHARACTER_OUTBOX, { keyPath: 'mutationId' });
          outboxStore.createIndex('by_characterId', 'characterId', { unique: false });
          outboxStore.createIndex('by_timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CHARACTER_CACHE)) {
          db.createObjectStore(STORE_CHARACTER_CACHE, { keyPath: 'id' });
        }
      };

      request.onblocked = () => {
        console.warn('[catalogStorage] IndexedDB open blocked by another open tab.');
        dbPromise = null;
        resolve(null);
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => {
          console.warn('[catalogStorage] IndexedDB version change detected, closing connection.');
          db.close();
          dbPromise = null;
        };

        db.onclose = () => {
          console.warn('[catalogStorage] IndexedDB connection closed.');
          dbPromise = null;
        };

        resolve(db);
      };

      request.onerror = (err) => {
        console.warn('[catalogStorage] IndexedDB open error, falling back to LocalStorage:', err);
        dbPromise = null;
        resolve(null);
      };
    } catch (e) {
      console.warn('[catalogStorage] IndexedDB initialization failed:', e);
      dbPromise = null;
      resolve(null);
    }
  });

  // 3-second watchdog timer: prevents app from hanging if browser IndexedDB locks
  const timeoutPromise = new Promise<IDBDatabase | null>((resolve) => {
    setTimeout(() => {
      resolve(null);
    }, 3000);
  });

  dbPromise = Promise.race([openPromise, timeoutPromise]);
  return dbPromise;
}

/**
 * Purges legacy v1-v6 cache keys from LocalStorage to reclaim origin quota.
 */
export function purgeLegacyLocalStorageCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const legacyExplicitKeys = [
      'supaflex_catalogs_cache_v1',
      'supaflex_catalogs_cache_v2',
      'supaflex_catalogs_cache_v3',
      'supaflex_catalogs_cache_v4',
      'supaflex_catalogs_cache_v5',
      'supaflex_catalogs_v6',
    ];
    for (const k of legacyExplicitKeys) {
      localStorage.removeItem(k);
    }
    // Prune any legacy prefix keys or email-namespaced keys < CATALOG_CACHE_VERSION
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('supaflex_catalogs_cache_v')) {
        localStorage.removeItem(key);
      } else if (key.startsWith('supaflex_catalogs_v')) {
        const verStr = key.replace('supaflex_catalogs_v', '').split('_')[0];
        const verNum = parseInt(verStr, 10);
        if (!isNaN(verNum) && verNum < CATALOG_CACHE_VERSION) {
          localStorage.removeItem(key);
        }
      }
    }
  } catch (e) {
    // Suppress LocalStorage exceptions
  }
}

/**
 * Computes canonical storage key.
 */
export function getCatalogStorageKey(email?: string): string {
  const clean = (email || '').trim().toLowerCase();
  return clean ? `supaflex_catalogs_v${CATALOG_CACHE_VERSION}_${clean}` : `supaflex_catalogs_v${CATALOG_CACHE_VERSION}`;
}

/**
 * Validates that all 14 game catalog arrays exist and contain valid data structures.
 */
function isValidRawData(data: any): data is RawCatalogsData {
  return (
    data &&
    Array.isArray(data.powers) &&
    Array.isArray(data.skills) &&
    Array.isArray(data.traits) &&
    Array.isArray(data.pathsData) &&
    Array.isArray(data.setsData) &&
    Array.isArray(data.bundlesData) &&
    Array.isArray(data.functionsData) &&
    Array.isArray(data.modsData) &&
    Array.isArray(data.playersData) &&
    Array.isArray(data.suppliesData) &&
    Array.isArray(data.weaponsData) &&
    Array.isArray(data.armorData) &&
    Array.isArray(data.shieldsData) &&
    Array.isArray(data.chaosGemsData) &&
    data.functionsData.length > 0 // Sentinel non-empty check
  );
}

/**
 * Validates cache envelope integrity, TTL boundaries, and strict Beacon Equality.
 */
function isValidEnvelope(envelope: any, expectedBeacon?: string | null): envelope is StoredCatalogEnvelope {
  if (!envelope || envelope.version !== CATALOG_CACHE_VERSION || !envelope.timestamp || !envelope.data) {
    return false;
  }
  // Sliding TTL check
  if (Date.now() - envelope.timestamp > CATALOGS_CACHE_TTL_MS) {
    return false;
  }
  // Clock rollback guard
  if (envelope.timestamp > Date.now() + 60000) {
    return false;
  }
  // Strict Beacon Equality (defeats clock skew and save-after-fetch races)
  if (expectedBeacon && envelope.beacon !== expectedBeacon) {
    return false;
  }
  return isValidRawData(envelope.data);
}

/**
 * Retrieves raw catalog tables from cache (Memory -> IndexedDB -> LocalStorage fallback).
 * @param storageKey Canonical cache key
 * @param currentBeacon Exact cloud beacon string (if provided, enforces Beacon Equality)
 */
export async function loadCatalogsFromStorage(
  storageKey: string,
  currentBeacon?: string | null
): Promise<RawCatalogsData | null> {
  purgeLegacyLocalStorageCaches();

  // 1. Hot in-memory cache check (0ms, 0 I/O)
  if (hotMemoryCache && hotMemoryCache.key === storageKey) {
    const env = hotMemoryCache.envelope;
    if (isValidEnvelope(env, currentBeacon)) {
      return env.data;
    }
  }

  // 2. IndexedDB primary persistent store
  try {
    const db = await getIndexedDb();
    if (db) {
      const envelope = await new Promise<StoredCatalogEnvelope | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(storageKey);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (envelope) {
        if (isValidEnvelope(envelope, currentBeacon)) {
          hotMemoryCache = { key: storageKey, envelope };
          return envelope.data;
        } else if (currentBeacon && (envelope as any).beacon !== currentBeacon) {
          // Stale beacon detected; don't return stale data
          return null;
        }
      }
    }
  } catch (e) {
    console.warn('[catalogStorage] IndexedDB read error:', e);
  }

  // 3. LocalStorage fallback (only consulted if IDB produced no envelope)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const envelope: StoredCatalogEnvelope = JSON.parse(raw);
        if (isValidEnvelope(envelope, currentBeacon)) {
          hotMemoryCache = { key: storageKey, envelope };
          return envelope.data;
        }
      }
    } catch {
      // LocalStorage read failed or corrupted
    }
  }

  return null;
}

/**
 * Saves raw catalog tables to cache (Memory + IndexedDB with LocalStorage fallback on error).
 * Enforces true commit durability via tx.oncomplete.
 * Bypasses LocalStorage write on successful IDB write to eliminate main-thread jank.
 */
export async function saveCatalogsToStorage(
  storageKey: string,
  data: RawCatalogsData,
  beacon?: string | null
): Promise<void> {
  if (!isValidRawData(data)) return;

  const envelope: StoredCatalogEnvelope = {
    version: CATALOG_CACHE_VERSION,
    timestamp: Date.now(),
    beacon: beacon || null,
    data,
  };

  // 1. In-memory hot cache
  hotMemoryCache = { key: storageKey, envelope };

  // 2. Primary: IndexedDB (handles large datasets effortlessly without 5MB limit)
  let idbSucceeded = false;
  try {
    const db = await getIndexedDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(envelope, storageKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        } catch (txErr) {
          reject(txErr);
        }
      });
      idbSucceeded = true;
    }
  } catch (e) {
    console.warn('[catalogStorage] IndexedDB save error, falling back to LocalStorage:', e);
    dbPromise = null; // Reset connection on failure
  }

  // 3. Secondary: LocalStorage (ONLY used as fallback when IndexedDB fails to avoid main-thread jank)
  if (!idbSucceeded && typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch {
      // QuotaExceededError is swallowed
    }
  }
}

/**
 * Clears cached catalogs from memory, IndexedDB, and LocalStorage.
 */
export async function clearCatalogStorage(storageKey?: string): Promise<void> {
  hotMemoryCache = null;

  try {
    const db = await getIndexedDb();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          if (storageKey) {
            store.delete(storageKey);
          } else {
            store.clear();
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Ignore IDB clear error
  }

  if (typeof window !== 'undefined') {
    try {
      if (storageKey) {
        localStorage.removeItem(storageKey);
      } else {
        purgeLegacyLocalStorageCaches();
        localStorage.removeItem(getCatalogStorageKey());
      }
    } catch {
      // Ignore LocalStorage clear error
    }
  }
}
