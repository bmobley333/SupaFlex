// src/components/modals/EchoVaultModal.tsx
// Asynchronous Party Stash & Shared Vault for the Refine & Echo Loot Engine

import React from 'react';
import { VaultItem } from '../../types/game';
import { Archive, ShieldCheck, Flame, X, Sparkles } from 'lucide-react';

interface EchoVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  vaultItems: VaultItem[];
  onClaimVaultItem: (item: VaultItem) => Promise<boolean>;
  onTriggerRestSweep: () => Promise<void>;
}

export const EchoVaultModal: React.FC<EchoVaultModalProps> = ({
  isOpen,
  onClose,
  characterName,
  vaultItems,
  onClaimVaultItem,
  onTriggerRestSweep,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-outfit font-bold text-lg text-cyan-300 uppercase tracking-wide flex items-center gap-2">
                📥 Async Echo Vault (Party Shared Stash)
              </h3>
              <p className="text-xs text-slate-400">
                Shared loot pool for the active party ({vaultItems.length} items waiting). Unclaimed items auto-dissolve into equal party Essence at Rest.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Vault Items List */}
        <div className="p-6 bg-slate-900/40 flex-1 overflow-y-auto min-h-0 space-y-3">
          {vaultItems.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/30 flex flex-col items-center gap-2">
              <Archive className="w-10 h-10 text-slate-600 mb-1" />
              <p className="text-sm font-semibold text-slate-400">The Echo Vault is currently empty.</p>
              <p className="text-xs text-slate-500">
                When party members click "Pass" on loot drop cards, items will appear here!
              </p>
            </div>
          ) : (
            vaultItems.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-cyan-500/40 transition-all shadow-md"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      {item.rarity}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      Passed by <strong className="text-slate-200">{item.passedBy}</strong>
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 truncate">{item.title}</h4>
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{item.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onClaimVaultItem(item)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Claim to {characterName}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Bar with Rest Sweep Trigger */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Rest Auto-Sweep converts all vault items into equal party Essence.
          </span>
          <button
            onClick={onTriggerRestSweep}
            disabled={vaultItems.length === 0}
            className="px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Trigger Rest Sweep
          </button>
        </div>
      </div>
    </div>
  );
};
