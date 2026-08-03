// src/components/header/GmHeaderHUD.tsx
import React, { useState } from 'react';
import { Crown, Copy, Check, RefreshCw } from 'lucide-react';

interface GmHeaderHUDProps {
  activeRoomCode: string | null;
  onCopyRoomCode?: () => void;
  onResetRoomCode?: () => void;
}

export const GmHeaderHUD: React.FC<GmHeaderHUDProps> = ({
  activeRoomCode,
  onCopyRoomCode,
  onResetRoomCode,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (onCopyRoomCode) {
      onCopyRoomCode();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (activeRoomCode) {
      navigator.clipboard.writeText(activeRoomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full pt-1.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 animate-fadeIn">
      {/* Left Zone: GM Screen Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-950/80 to-slate-900 px-3 py-1 rounded-xl border border-amber-500/50 shadow-md shadow-amber-950/40">
          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-outfit font-black text-xs uppercase tracking-wider text-amber-400">
            GM Screen
          </span>
        </div>
      </div>

      {/* Right Zone: Party Room ID & Quick Controls */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-950/90 border border-amber-500/50 px-3 py-1 rounded-xl shadow-inner">
          <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider font-outfit">
            Party ID:
          </span>
          <span className="font-mono text-xs font-black tracking-widest text-amber-300 bg-slate-900 px-2 py-0.5 rounded-md border border-amber-500/40 shadow-sm">
            {activeRoomCode || '....'}
          </span>

          <button
            onClick={handleCopy}
            title="Copy Party ID to Clipboard"
            className="p-1 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 rounded transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {onResetRoomCode && (
            <button
              onClick={onResetRoomCode}
              title="Generate New Party ID"
              className="p-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
