// src/components/header/GmHeaderHUD.tsx
import React, { useState } from 'react';
import { Crown, Copy, Check, RefreshCw } from 'lucide-react';

interface GmHeaderHUDProps {
  activeRoomCode: string | null;
  onCopyRoomCode?: () => void;
  onResetRoomCode?: () => void;
  className?: string;
}

export const GmHeaderHUD: React.FC<GmHeaderHUDProps> = ({
  activeRoomCode,
  onCopyRoomCode,
  onResetRoomCode,
  className = '',
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
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      {/* 👑 GM Screen Badge */}
      <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-950/80 to-slate-900 px-3 py-1 rounded-xl border border-amber-500/50 shadow-md shadow-amber-950/40 shrink-0">
        <Crown className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-outfit font-black text-xs uppercase tracking-wider text-amber-400 whitespace-nowrap">
          GM Screen
        </span>
      </div>

      {/* Party ID Pill */}
      <div className="flex items-center gap-1.5 bg-slate-950/90 border border-amber-500/50 px-2.5 py-1 rounded-xl shadow-inner shrink-0">
        <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider font-outfit whitespace-nowrap">
          Party ID:
        </span>
        <span className="font-mono text-xs font-black tracking-widest text-amber-300 bg-slate-900 px-2 py-0.5 rounded-md border border-amber-500/40 shadow-sm">
          {activeRoomCode || '....'}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          title="Copy Party ID to Clipboard"
          className="p-1 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 rounded transition-all cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {onResetRoomCode && (
          <button
            type="button"
            onClick={onResetRoomCode}
            title="Generate New Party ID"
            className="p-1 text-xs text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

