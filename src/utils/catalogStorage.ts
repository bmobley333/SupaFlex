// src/utils/catalogStorage.ts
// Native browser IndexedDB storage engine for SupaFlex catalogs with LocalStorage fallback.
// Eliminates the 5 MB LocalStorage quota bottleneck and prevents cold fetch egress storms.

export const CATALOG_CACHE_VERSION = 6;
export const CATALOGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  data: RawCatalogsData;
}

const DB_NAME = 'supaflex_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'catalogs';

let dbPromise: Promise<IDBDatabase | null> | null = null;
let hotMemoryCache: { key: string; envelope: StoredCatalogEnvelope } | null = null;

/**
 * Initializes and caches the native IndexedDB connection.
 */
function getIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.warn('[catalogStorage] IndexedDB open error, falling back to LocalStorage:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('[catalogStorage] IndexedDB initialization failed:', e);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Purges legacy v1-v5 cache keys from LocalStorage to reclaim origin quota.
 */
export function purgeLegacyLocalStorageCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = [
      'supaflex_catalogs_cache_v1',
      'supaflex_catalogs_cache_v2',
      'supaflex_catalogs_cache_v3',
      'supaflex_catalogs_cache_v4',
      'supaflex_catalogs_cache_v5',
    ];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
    // Also prune any email-namespaced v1-v5 keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('supaflex_catalogs_cache_v')) {
        const verStr = key.replace('supaflex_catalogs_cache_v', '').split('_')[0];
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
 * Retrieves raw catalog tables from cache (Memory -> IndexedDB -> LocalStorage).
 */
export async function loadCatalogsFromStorage(
  storageKey: string,
  minTimestamp?: number
): Promise<RawCatalogsData | null> {
  purgeLegacyLocalStorageCaches();

  // 1. Hot in-memory cache check (0ms, 0 I/O)
  if (hotMemoryCache && hotMemoryCache.key === storageKey) {
    const env = hotMemoryCache.envelope;
    if (
      env.version === CATALOG_CACHE_VERSION &&
      Date.now() - env.timestamp <= CATALOGS_CACHE_TTL_MS &&
      (!minTimestamp || env.timestamp >= minTimestamp) &&
      isValidRawData(env.data)
    ) {
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
        } catch {
          resolve(null);
        }
      });

      if (envelope && isValidEnvelope(envelope, minTimestamp)) {
        hotMemoryCache = { key: storageKey, envelope };
        return envelope.data;
      }
    }
  } catch (e) {
    console.warn('[catalogStorage] IndexedDB read error:', e);
  }

  // 3. LocalStorage fallback
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const envelope: StoredCatalogEnvelope = JSON.parse(raw);
        if (isValidEnvelope(envelope, minTimestamp)) {
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
 * Saves raw catalog tables to cache (Memory + IndexedDB + LocalStorage fallback).
 */
export async function saveCatalogsToStorage(
  storageKey: string,
  data: RawCatalogsData
): Promise<void> {
  if (!isValidRawData(data)) return;

  const envelope: StoredCatalogEnvelope = {
    version: CATALOG_CACHE_VERSION,
    timestamp: Date.now(),
    data,
  };

  // 1. In-memory hot cache
  hotMemoryCache = { key: storageKey, envelope };

  // 2. Primary: IndexedDB (handles large datasets effortlessly without 5MB limit)
  try {
    const db = await getIndexedDb();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(envelope, storageKey);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        } catch (txErr) {
          reject(txErr);
        }
      });
    }
  } catch (e) {
    console.warn('[catalogStorage] IndexedDB save error:', e);
  }

  // 3. Secondary: LocalStorage (best effort, ignore quota errors)
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch {
      // QuotaExceededError is harmless since IndexedDB has already persisted the data
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

function isValidRawData(data: any): data is RawCatalogsData {
  return (
    data &&
    Array.isArray(data.powers) &&
    Array.isArray(data.functionsData) &&
    data.functionsData.length > 0 &&
    Array.isArray(data.suppliesData) &&
    Array.isArray(data.weaponsData) &&
    Array.isArray(data.armorData) &&
    Array.isArray(data.shieldsData)
  );
}

function isValidEnvelope(envelope: any, minTimestamp?: number): envelope is StoredCatalogEnvelope {
  if (!envelope || envelope.version !== CATALOG_CACHE_VERSION || !envelope.timestamp || !envelope.data) {
    return false;
  }
  if (Date.now() - envelope.timestamp > CATALOGS_CACHE_TTL_MS) {
    return false;
  }
  if (minTimestamp && envelope.timestamp < minTimestamp) {
    return false;
  }
  return isValidRawData(envelope.data);
}
