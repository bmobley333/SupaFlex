// src/components/sheet/HardwareBundlesCard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  ChevronDown,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { ManageHardwareBundlesModal } from '../modals/ManageHardwareBundlesModal';
import { HardwareBundleItem } from '../../types/game';

export const HardwareBundlesCard: React.FC = () => {
  const { activeCharacter } = useCharacterStore();
  const [showManageModal, setShowManageModal] = useState<boolean>(false);
  const [visibilityFilter, setVisibilityFilter] = useState<'visible' | 'all'>('visible');

  // Listen for global manager open events
  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (e.detail === 'hardware_bundles' || e.detail === 'bundles') {
        setShowManageModal(true);
      }
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, []);

  // Sync Hardware Bundles from active character sheet_data
  const rawBundles = useMemo(() => {
    const list = activeCharacter?.sheet_data?.hardware_bundles;
    return Array.isArray(list) ? list : [];
  }, [activeCharacter?.sheet_data?.hardware_bundles]);

  const validBundles = useMemo(() => {
    return rawBundles.filter((b) => b && b.name && b.name.trim() !== '');
  }, [rawBundles]);

  const visibleBundles = useMemo(() => {
    return validBundles.filter((b) => !b.is_hidden);
  }, [validBundles]);

  const displayedBundles = useMemo(() => {
    return visibilityFilter === 'visible' ? visibleBundles : validBundles;
  }, [visibilityFilter, visibleBundles, validBundles]);

  return (
    <div className="bg-gradient-to-b from-cyan-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-cyan-500/90 p-4 flex flex-col gap-3 shadow-xl backdrop-blur-md relative overflow-hidden h-fit">
      {/* Standard Card Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title="Click to open Hardware Bundles Manager"
          >
            <div className="p-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)] group-hover:scale-105 group-hover:border-cyan-400 transition-all">
              <span className="text-base leading-none">⚙️</span>
            </div>
            <h3 className="font-outfit font-black text-sm tracking-wider text-slate-100 uppercase group-hover:text-cyan-200 transition-colors flex items-center gap-1.5">
              <span>Hardware Bundles</span>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400/70 group-hover:text-cyan-300 group-hover:translate-y-0.5 transition-all" />
            </h3>
          </button>
          <CardHelpButton ruleKey="gear" />
        </div>

        {/* Action Controls & Dyslexia-Friendly Visibility Pill Switch */}
        <div className="flex items-center gap-2 flex-wrap">
          {validBundles.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setVisibilityFilter('visible')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibilityFilter === 'visible'
                    ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Show only active hardware bundles"
              >
                <span>👁️</span>
                <span>Active ({visibleBundles.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setVisibilityFilter('all')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  visibilityFilter === 'all'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Show all hardware bundles"
              >
                <span>📦</span>
                <span>All ({validBundles.length})</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm bg-cyan-950/80 hover:bg-cyan-900/90 border-cyan-500/40 hover:border-cyan-400 text-cyan-200 hover:text-white cursor-pointer group"
            title="Manage Character Hardware Bundles"
          >
            <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
          </button>
        </div>
      </div>

      {/* High-Density Hardware Bundles List */}
      <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
        {displayedBundles.length > 0 ? (
          displayedBundles.map((b: HardwareBundleItem, idx: number) => {
            const isHidden = Boolean(b.is_hidden);

            return (
              <div
                key={`${b.name}_${idx}`}
                className={`p-3 rounded-xl border flex flex-col gap-2 shadow-sm transition-all ${
                  isHidden
                    ? 'bg-slate-950/40 border-slate-800/60 border-dashed opacity-75 hover:opacity-100'
                    : 'bg-slate-950/60 border-slate-850 hover:border-cyan-500/40'
                }`}
              >
                {/* Bundle Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-outfit font-bold text-xs text-cyan-300 block whitespace-normal break-words leading-tight">
                      {b.name}
                    </span>
                    {b.category && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                        {b.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bundle Description */}
                {b.description && (
                  <p className="text-xs text-slate-300 whitespace-normal break-words leading-relaxed font-sans">
                    {b.description}
                  </p>
                )}

                {/* Sub-Components / Installed Modules Badges */}
                {b.items && b.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/60">
                    {b.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-200 shadow-sm"
                        title={item.effect || item.notes || item.name}
                      >
                        <span className="text-xs">
                          {item.table === 'armor' ? '🛡️' : item.table === 'weapons' ? '⚔️' : item.usage ? '⚡' : '🔧'}
                        </span>
                        <span className="font-semibold">{item.name}</span>
                        {item.usage && (
                          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                            {item.usage}
                          </span>
                        )}
                        {item.action && (
                          <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                            {item.action}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-6 px-4 text-center rounded-xl bg-slate-950/30 border border-slate-850 border-dashed flex flex-col items-center justify-center gap-2">
            <Package className="w-7 h-7 text-slate-600" />
            <p className="text-xs text-slate-400 max-w-sm">
              No hardware bundles equipped. Click <span className="text-cyan-400 font-bold">✏️</span> above to equip powered armor suites, engineering toolkits, or cyber rigs.
            </p>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showManageModal && (
        <ManageHardwareBundlesModal
          isOpen={showManageModal}
          onClose={() => setShowManageModal(false)}
        />
      )}
    </div>
  );
};
