// src/components/common/SyncStatusPillSwitch.tsx
// Dyslexia-Friendly KISS Multi-Option Pill Switch for SupaFlex Network & Offline Outbox Status.
// Follows strict user rules: Side-by-side states, single icon standard, dynamic highlighting,
// and zero central slider graphics.

import React from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';

interface SyncStatusPillSwitchProps {
  className?: string;
}

export const SyncStatusPillSwitch: React.FC<SyncStatusPillSwitchProps> = ({ className = '' }) => {
  const dbConnected = useCharacterStore((state) => state.dbConnected);
  const pendingOutboxCount = useCharacterStore((state) => state.pendingOutboxCount);
  const isSyncingOutbox = useCharacterStore((state) => state.isSyncingOutbox);
  const flushPendingOutbox = useCharacterStore((state) => state.flushPendingOutbox);
  const fetchInitialData = useCharacterStore((state) => state.fetchInitialData);

  const isOnlineAndSynced = dbConnected && pendingOutboxCount === 0 && !isSyncingOutbox;
  const isQueuedOrOffline = !dbConnected || pendingOutboxCount > 0;

  const handleLiveClick = async () => {
    try {
      await fetchInitialData({ silent: true });
    } catch (e) {
      console.warn('[SyncStatusPillSwitch] Connection check failed:', e);
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

  return (
    <div
      className={`bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0 ${className}`}
      title="SupaFlex Connection & Offline Persistence Outbox"
    >
      {/* 🟢 Live Option */}
      <button
        type="button"
        onClick={handleLiveClick}
        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
          isOnlineAndSynced
            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
            : 'text-slate-400 hover:text-slate-200 border border-transparent'
        }`}
        title="Connected to cloud database (0 pending changes)"
      >
        <span>🟢</span>
        <span>Live</span>
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
