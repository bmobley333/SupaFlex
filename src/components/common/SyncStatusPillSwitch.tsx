// src/components/common/SyncStatusPillSwitch.tsx
// Reactive Status Pill & Offline Outbox Monitor for SupaFlex.
// In compact mode (default), renders a sleek, single-button reactive pill:
//   🟢 Synced (Connected to cloud, 0 pending)
//   🟡 [N] Queued / Offline (Edits saved locally in IndexedDB; click flushes outbox)
//   🔄 Syncing (Active network drain in progress)
// In full mode, renders the 3-option side-by-side diagnostic bar.

import React, { useState } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';

export interface SyncStatusPillSwitchProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const SyncStatusPillSwitch: React.FC<SyncStatusPillSwitchProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const dbConnected = useCharacterStore((state) => state.dbConnected);
  const pendingOutboxCount = useCharacterStore((state) => state.pendingOutboxCount);
  const isSyncingOutbox = useCharacterStore((state) => state.isSyncingOutbox);
  const flushPendingOutbox = useCharacterStore((state) => state.flushPendingOutbox);
  const fetchInitialData = useCharacterStore((state) => state.fetchInitialData);
  const refreshCatalogs = useCharacterStore((state) => state.refreshCatalogs);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  const isOnlineAndSynced = dbConnected && pendingOutboxCount === 0 && !isSyncingOutbox && !isRefreshing;
  const isQueuedOrOffline = !dbConnected || pendingOutboxCount > 0;

  const handleLiveClick = async () => {
    if (isRefreshing || isSyncingOutbox) return;
    setIsRefreshing(true);
    try {
      if (pendingOutboxCount > 0) {
        await flushPendingOutbox();
      }
      await refreshCatalogs();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2500);
    } catch (e) {
      console.warn('[SyncStatusPillSwitch] Refresh catalogs failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleQueueClick = async () => {
    if (pendingOutboxCount > 0) {
      await flushPendingOutbox();
    } else {
      await fetchInitialData({ silent: true });
    }
  };

  const handleSyncClick = async () => {
    await flushPendingOutbox();
  };

  // 🌟 Compact Reactive Pill (Default for CS & GM Mode)
  if (variant === 'compact') {
    if (isSyncingOutbox || isRefreshing) {
      return (
        <button
          type="button"
          disabled
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-400/60 text-indigo-200 text-xs font-bold shadow-sm shadow-indigo-950/40 animate-pulse cursor-wait shrink-0 transition-all ${className}`}
          title="Synchronizing pending changes and refreshing catalogs with Supabase cloud..."
        >
          <span className="text-xs animate-spin">🔄</span>
          <span>Syncing</span>
        </button>
      );
    }

    if (justRefreshed) {
      return (
        <button
          type="button"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-400 text-emerald-200 text-xs font-extrabold shadow-sm shadow-emerald-900/40 cursor-default shrink-0 transition-all animate-fadeIn ${className}`}
          title="All catalogs and changes successfully synchronized with Supabase."
        >
          <span className="text-xs text-emerald-400 font-bold">✓</span>
          <span>Synced</span>
        </button>
      );
    }

    if (isQueuedOrOffline) {
      return (
        <button
          type="button"
          onClick={handleQueueClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 hover:border-amber-400 text-amber-300 text-xs font-extrabold shadow-sm shadow-amber-950/40 cursor-pointer shrink-0 transition-all ${
            pendingOutboxCount > 0 ? 'animate-pulse' : ''
          } ${className}`}
          title={
            pendingOutboxCount > 0
              ? `${pendingOutboxCount} local mutation(s) saved in IndexedDB outbox. Click to flush sync to Supabase.`
              : 'Device is offline. Local changes will be safely saved to IndexedDB. Click to test reconnection.'
          }
        >
          <span className="text-xs">🟡</span>
          <span>{pendingOutboxCount > 0 ? `${pendingOutboxCount} Queued` : 'Offline'}</span>
        </button>
      );
    }

    // Default Connected & Synced state
    return (
      <button
        type="button"
        onClick={handleLiveClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 hover:border-emerald-400/60 text-emerald-300 text-xs font-bold shadow-sm shadow-emerald-950/30 cursor-pointer shrink-0 transition-all ${className}`}
        title="Connected to Supabase (0 pending changes). Catalogs cached locally. Click to force fresh catalog & cloud sync."
      >
        <span className="text-xs">🟢</span>
        <span>Synced</span>
      </button>
    );
  }

  // 🛠️ Full 3-Option Diagnostic Switch (Legacy / Debug variant)
  return (
    <div
      className={`bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0 ${className}`}
      title="SupaFlex Connection & Offline Persistence Outbox"
    >
      {/* 🟢 Synced Option */}
      <button
        type="button"
        onClick={handleLiveClick}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
          isOnlineAndSynced
            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
        title="Connected to Supabase (0 pending changes). Click to force fresh catalog & cloud sync."
      >
        <span>{isRefreshing ? '🔄' : justRefreshed ? '✓' : '🟢'}</span>
        <span>{isRefreshing ? 'Syncing...' : justRefreshed ? 'Updated!' : 'Synced'}</span>
      </button>

      {/* 🟡 Queued / Offline Option */}
      <button
        type="button"
        onClick={handleQueueClick}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
          isQueuedOrOffline && !isSyncingOutbox
            ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
        title={
          pendingOutboxCount > 0
            ? `${pendingOutboxCount} local mutation(s) saved in IndexedDB outbox. Click to sync.`
            : 'Device is offline. Local changes will be saved to IndexedDB.'
        }
      >
        <span>🟡</span>
        <span>{pendingOutboxCount > 0 ? `${pendingOutboxCount} Queued` : 'Offline'}</span>
      </button>

      {/* 🔄 Sync Action Option */}
      <button
        type="button"
        onClick={handleSyncClick}
        disabled={isSyncingOutbox}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
          isSyncingOutbox
            ? 'bg-indigo-600 text-white shadow-sm font-extrabold animate-pulse'
            : 'text-slate-400 hover:text-slate-200 border border-transparent disabled:opacity-50'
        }`}
        title="Flush offline outbox and synchronize state with Supabase"
      >
        <span>🔄</span>
        <span>{isSyncingOutbox ? 'Syncing' : 'Sync'}</span>
      </button>
    </div>
  );
};
