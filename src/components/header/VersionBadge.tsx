// src/components/header/VersionBadge.tsx
// Displays the tri-part version (App.Vercel.SupaBase, e.g. 3.627v.891s) in the top header.
// Includes diagnostic inspection popover, manual freshness check, and hard cache clear.

import React, { useState, useRef, useEffect } from 'react';
import { useVersionGuard } from '../../hooks/useVersionGuard';
import { RefreshCw, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface VersionBadgeProps {
  className?: string;
}

export const VersionBadge: React.FC<VersionBadgeProps> = ({ className = '' }) => {
  const {
    appVersion,
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
  } = useVersionGuard();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const shortCommit = gitCommit && gitCommit !== 'dev' ? gitCommit.substring(0, 7) : 'dev';
  const formattedBuildDate = builtAt ? new Date(builtAt).toLocaleString() : 'Local Dev';
  const formattedLastChecked = lastChecked ? new Date(lastChecked).toLocaleTimeString() : 'Just now';

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      {/* 🏷️ Header Pill Switch Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border text-xs font-mono font-bold tracking-tight shadow-sm transition-all cursor-pointer shrink-0 select-none ${
          isOutdated
            ? 'border-amber-500/80 bg-amber-950/40 text-amber-300 animate-pulse'
            : isOpen
            ? 'border-indigo-500/80 text-indigo-300 bg-slate-900 shadow-indigo-950/40'
            : 'border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-slate-100'
        }`}
        title="App Version • Vercel Build • Supabase Beacon (Click to inspect or force cache refresh)"
      >
        <span className="text-xs">🏷️</span>
        <span className="font-semibold">{fullVersionString}</span>
        {isChecking ? (
          <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" />
        ) : isOutdated ? (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
        ) : null}
      </button>

      {/* 🔍 S-Tier Diagnostic & Cache Management Popover */}
      {isOpen && (
        <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-50 w-80 bg-slate-950/95 border border-slate-800 rounded-2xl p-4 shadow-2xl shadow-black/80 backdrop-blur-xl text-xs space-y-3 font-sans animate-fadeIn">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-850">
            <div className="flex items-center gap-2">
              <span className="text-sm">🏷️</span>
              <span className="font-outfit font-black text-slate-200 text-sm tracking-wide">
                Build & Cache Status
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Diagnostic Grid */}
          <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-3 space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Full Version:</span>
              <span className="font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                {fullVersionString}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">App Core:</span>
              <span className="text-slate-200">v{appVersion}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Vercel Build:</span>
              <span className="text-indigo-300">
                {vercelBuild} <span className="text-slate-500">({shortCommit})</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Supabase Beacon:</span>
              <span className="text-emerald-300">{supabaseBeacon}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans">Built At:</span>
              <span className="text-slate-400 truncate max-w-[150px]" title={formattedBuildDate}>
                {formattedBuildDate}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800">
              <span className="text-slate-400 font-sans">Freshness Check:</span>
              <span className="text-slate-400">{formattedLastChecked}</span>
            </div>
          </div>

          {/* Status Alert Banner */}
          {isOutdated ? (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/60 text-amber-200 text-[11px] leading-tight">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">New Build Available</p>
                <p className="text-amber-300/80 mt-0.5">
                  A newer deployment was detected on Vercel. Reload to update.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Current build and local cache are synchronized.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={checkNow}
              disabled={isChecking}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-slate-650 text-slate-200 font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Check Vercel and Supabase for updates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>Check</span>
            </button>

            <button
              type="button"
              onClick={forceReload}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/60 hover:border-indigo-400 text-indigo-200 font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-950/50"
              title="Clears IndexedDB catalog cache and forces immediate page reload"
            >
              <span>⚡</span>
              <span>Force Reload</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
