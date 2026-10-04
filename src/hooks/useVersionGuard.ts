// src/hooks/useVersionGuard.ts
// Comprehensive Version & Cache Freshness Guard for SupaFlex
// Tracks App.Vercel.SupaBase versioning (e.g. 3.627v.891s), detects new Vercel deployments,
// monitors Supabase Catalog Beacon sequence, and auto-reloads on outdated builds.

import { useState, useEffect, useCallback, useRef } from 'react';
import { gameApi } from '../services/api';
import { supabase } from '../lib/supabase';
import { clearCatalogStorage } from '../utils/catalogStorage';

export interface VersionInfo {
  appVersion: string;
  vercelBuild: string;
  supabaseBeacon: string;
  fullVersionString: string;
  gitCommit: string;
  builtAt: string;
  isOutdated: boolean;
  isChecking: boolean;
  lastChecked: number | null;
  forceReload: () => void;
  checkNow: () => Promise<void>;
}

export function useVersionGuard(): VersionInfo {
  const localAppVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '3';
  const localVercelBuild = typeof __VERCEL_BUILD__ !== 'undefined' ? __VERCEL_BUILD__ : '627v';
  const localGitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';
  const localBuiltAt = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';

  const [supabaseBeacon, setSupabaseBeacon] = useState<string>('891s');
  const [isOutdated, setIsOutdated] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef(0);

  const forceReload = useCallback(async () => {
    // Clear session caches, catalog storage, and force clean browser reload
    try {
      sessionStorage.removeItem('supaflex_catalogs_beacon');
      await clearCatalogStorage();
    } catch {}
    window.location.reload();
  }, []);

  const checkNow = useCallback(async () => {
    // Debounce to at most once per 10 seconds unless forced
    const now = Date.now();
    if (isCheckingRef.current || (now - lastCheckTimeRef.current < 10000)) {
      return;
    }

    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      // 1. Probe /version.json on Vercel with anti-cache timestamp
      const versionRes = await fetch(`/version.json?t=${now}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });

      if (versionRes.ok) {
        const remoteVersion = await versionRes.json();
        if (remoteVersion?.vercelBuild && remoteVersion.vercelBuild !== localVercelBuild) {
          console.warn(
            `[VersionGuard] New Vercel deployment detected! Local: ${localVercelBuild}, Remote: ${remoteVersion.vercelBuild}. Forcing immediate hard reload...`
          );
          setIsOutdated(true);
          // Immediate hard reload per Blake's approved directive
          forceReload();
          return;
        }
      }

      // 2. Probe Supabase Catalog Beacon sequence
      const beaconInfo = await gameApi.getCatalogBeaconInfo();
      if (beaconInfo.sequence) {
        setSupabaseBeacon(beaconInfo.sequence);
      }

      lastCheckTimeRef.current = Date.now();
      setLastChecked(lastCheckTimeRef.current);
    } catch (err) {
      console.warn('[VersionGuard] Freshness probe notice:', err);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [localVercelBuild, forceReload]);

  useEffect(() => {
    // 1. Initial check on mount
    checkNow();

    // 2. Visibility change: wakes from phone/tablet lock screen or tab hibernation
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Window focus
    const handleFocus = () => {
      checkNow();
    };
    window.addEventListener('focus', handleFocus);

    // 4. Periodic background check every 10 minutes (guarded by visibilityState to prevent background egress)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkNow();
      }
    }, 10 * 60 * 1000);

    // 5. Supabase Realtime broadcast listener for instant push invalidation
    const channel = supabase
      .channel('version_guard_beacon_listener')
      .on('broadcast', { event: 'catalog_version_updated' }, () => {
        checkNow();
      })
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [checkNow]);

  const fullVersionString = `${localAppVersion}.${localVercelBuild}.${supabaseBeacon}`;

  return {
    appVersion: localAppVersion,
    vercelBuild: localVercelBuild,
    supabaseBeacon,
    fullVersionString,
    gitCommit: localGitCommit,
    builtAt: localBuiltAt,
    isOutdated,
    isChecking,
    lastChecked,
    forceReload,
    checkNow,
  };
}
