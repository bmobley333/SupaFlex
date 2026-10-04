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
  const initialVercelBuild = typeof __VERCEL_BUILD__ !== 'undefined' ? __VERCEL_BUILD__ : '632v';
  const initialGitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';
  const initialBuiltAt = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';

  const [vercelBuild, setVercelBuild] = useState<string>(initialVercelBuild);
  const [gitCommit, setGitCommit] = useState<string>(initialGitCommit);
  const [builtAt, setBuiltAt] = useState<string>(initialBuiltAt);

  const [supabaseBeacon, setSupabaseBeacon] = useState<string>('893s');
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
      // 1. Probe /version.json with anti-cache timestamp
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const isDev = import.meta.env.DEV || isLocalhost;

      const versionRes = await fetch(`/version.json?t=${now}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });

      if (versionRes.ok) {
        const remoteVersion = await versionRes.json();
        if (remoteVersion?.vercelBuild) {
          if (isDev) {
            // In dev / localhost: adopt the live metadata from public/version.json without hard-reloading
            setVercelBuild(remoteVersion.vercelBuild);
            if (remoteVersion.gitCommit) setGitCommit(remoteVersion.gitCommit);
            if (remoteVersion.builtAt) setBuiltAt(remoteVersion.builtAt);
          } else if (remoteVersion.vercelBuild !== vercelBuild) {
            console.warn(
              `[VersionGuard] New Vercel deployment detected! Local: ${vercelBuild}, Remote: ${remoteVersion.vercelBuild}.`
            );
            setIsOutdated(true);

            // Circuit breaker: prevent infinite reload loop if build number doesn't change after reload
            const lastReloadedBuild = sessionStorage.getItem('supaflex_last_reloaded_build');
            if (lastReloadedBuild !== remoteVersion.vercelBuild) {
              sessionStorage.setItem('supaflex_last_reloaded_build', remoteVersion.vercelBuild);
              forceReload();
              return;
            }
          }
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
  }, [vercelBuild, forceReload]);

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

  const fullVersionString = `${localAppVersion}.${vercelBuild}.${supabaseBeacon}`;

  return {
    appVersion: localAppVersion,
    vercelBuild,
    supabaseBeacon,
    fullVersionString,
    gitCommit,
    builtAt,
    isOutdated,
    isChecking,
    lastChecked,
    forceReload,
    checkNow,
  };
}
