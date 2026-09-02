// src/components/modals/ManageEquipmentKitsModal.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  Package,
  Coins,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { HardwareBundleItem, SupabaseBundle } from '../../types/game';
import { parseCostToSilver, formatCostAbbreviated, deductFundsWithChange } from '../../utils/moneyUtils';

interface ManageEquipmentKitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageEquipmentKitsModal: React.FC<ManageEquipmentKitsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    activeCharacter,
    bundles: stockBundlesCatalog = [],
    addHardwareBundle,
    removeHardwareBundle,
    toggleHardwareBundleVisibility,
    updateActiveSheetData,
    saveActiveCharacter,
  } = useCharacterStore();

  const modalRef = useRef<HTMLDivElement>(null);

  // Left Pane Search State
  const [leftSearchQuery, setLeftSearchQuery] = useState<string>('');

  // Right Pane Filter & Search State
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sheetData: any = activeCharacter?.sheet_data || {};
  const currentGold = sheetData.gold || 0;
  const currentSilver = sheetData.silver || 0;

  // Current equipped kits on active character
  const equippedKits: HardwareBundleItem[] = useMemo(() => {
    const list = activeCharacter?.sheet_data?.hardware_bundles;
    return Array.isArray(list) ? list : [];
  }, [activeCharacter?.sheet_data?.hardware_bundles]);

  const equippedNamesSet = useMemo(() => {
    return new Set(equippedKits.map((b) => b.name.toLowerCase()));
  }, [equippedKits]);

  // Filtered Equipped Kits (Left Pane)
  const filteredEquippedKits = useMemo(() => {
    return equippedKits.filter((b) => {
      if (!b || !b.name) return false;
      if (!leftSearchQuery.trim()) return true;
      const q = leftSearchQuery.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q)
      );
    });
  }, [equippedKits, leftSearchQuery]);

  // Dynamic available categories from catalog
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    stockBundlesCatalog.forEach((b) => {
      if (b.category) cats.add(b.category);
    });
    return ['All', ...Array.from(cats).sort()];
  }, [stockBundlesCatalog]);

  // Filtered Catalog Kits (Right Pane)
  const filteredCatalogKits = useMemo(() => {
    return stockBundlesCatalog.filter((b) => {
      const matchesCat = selectedCategory === 'All' || b.category === selectedCategory;
      if (!matchesCat) return false;
      if (!catalogSearchQuery.trim()) return true;
      const q = catalogSearchQuery.toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q)
      );
    });
  }, [stockBundlesCatalog, selectedCategory, catalogSearchQuery]);

  // Equip kit handler (supports currency purchase if cost is set)
  const handleEquipKit = (bundle: SupabaseBundle) => {
    if (equippedNamesSet.has(bundle.name.toLowerCase())) return;

    const costSilver = parseCostToSilver(bundle.cost);
    if (costSilver > 0) {
      const deduction = deductFundsWithChange(currentGold, currentSilver, costSilver);
      if (!deduction.success) {
        setFeedbackMsg(`❌ Insufficient funds! Requires ${formatCostAbbreviated(costSilver)}.`);
        setTimeout(() => setFeedbackMsg(null), 3000);
        return;
      }
      updateActiveSheetData((prev) => ({
        ...prev,
        gold: deduction.newGold,
        silver: deduction.newSilver,
      }));
    }

    const newBundleItem: HardwareBundleItem = {
      id: bundle.id,
      name: bundle.name,
      category: bundle.category,
      description: bundle.description || '',
      is_hidden: false,
      source: 'Equipment Kit Catalog',
    };

    addHardwareBundle(newBundleItem);
    saveActiveCharacter();
    setFeedbackMsg(`✓ Equipped ${bundle.name}!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Remove kit handler
  const handleRemoveKit = (bundleNameOrId: string | number) => {
    removeHardwareBundle(bundleNameOrId);
  };

  // Toggle visibility handler
  const handleToggleHide = (bundleNameOrId: string | number) => {
    toggleHardwareBundleVisibility(bundleNameOrId);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up"
      >
        {/* ================= 1. MASTER HEADER ================= */}
        <div className="bg-slate-950/90 border-b border-slate-800 backdrop-blur-md px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <span className="text-xl leading-none">🎒</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-cyan-400 font-outfit uppercase tracking-wide flex items-center gap-2">
                <span>Equipment Kits</span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  Armor • Weapons • Survival • Tech
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Equip packaged gear suites, specialized hardware kits, survival bundles, and toolkits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Currency Ledger Badge */}
            <div className="px-3 py-1 bg-slate-900 border border-amber-500/40 rounded-xl font-mono font-extrabold text-xs text-amber-300 shadow-inner flex items-center gap-2">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentGold}g {currentSilver}s</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Message Bar */}
        {feedbackMsg && (
          <div className="px-4 py-1.5 bg-cyan-950/80 border-b border-cyan-500/40 text-xs text-cyan-200 font-bold flex items-center justify-between animate-fade-in shrink-0">
            <span>{feedbackMsg}</span>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-cyan-400 hover:text-cyan-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ================= 2. TWO-PANE GRID ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 bg-slate-900/40 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* ----- PANE 1 (LEFT): EQUIPPED KITS (7 cols) ----- */}
          <div className="md:col-span-7 flex flex-col min-h-0 p-6 gap-4 overflow-hidden">
            {/* Left Header & Search */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-outfit font-black text-sm uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <span>Equipped Equipment Kits</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                    {equippedKits.length}
                  </span>
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter equipped kits..."
                  value={leftSearchQuery}
                  onChange={(e) => setLeftSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>

            {/* Equipped Kits List */}
            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-2.5">
              {filteredEquippedKits.length > 0 ? (
                filteredEquippedKits.map((bundle, idx) => (
                  <div
                    key={`${bundle.name}_${idx}`}
                    className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all shadow-sm ${
                      bundle.is_hidden
                        ? 'bg-slate-950/40 border-slate-800 opacity-60'
                        : 'bg-slate-950/70 border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    {/* Bundle Top Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-outfit font-bold text-xs text-cyan-300 block whitespace-normal break-words">
                          🎒 {bundle.name}
                        </span>
                        {bundle.category && (
                          <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-cyan-950/90 text-cyan-400 border border-cyan-500/30">
                            {bundle.category}
                          </span>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleHide(bundle.id || bundle.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title={bundle.is_hidden ? 'Show on main sheet' : 'Hide from main sheet'}
                        >
                          {bundle.is_hidden ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveKit(bundle.id || bundle.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Unequip Kit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    {bundle.description && (
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {bundle.description}
                      </p>
                    )}

                    {/* Sub-Items Badges if present */}
                    {bundle.items && bundle.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-800/60">
                        {bundle.items.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-200"
                          >
                            <span>{item.table === 'armor' ? '🛡️' : item.usage ? '⚡' : '🔧'}</span>
                            <span className="font-semibold">{item.name}</span>
                            {item.usage && (
                              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                                {item.usage}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2">
                  <Package className="w-8 h-8 text-slate-600" />
                  <p className="max-w-xs">
                    {leftSearchQuery
                      ? 'No equipped kits match your filter.'
                      : 'No equipment kits currently equipped. Select a kit from the catalog on the right to equip.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ----- PANE 2 (RIGHT): CATALOG BROWSER (5 cols) ----- */}
          <div className="md:col-span-5 flex flex-col min-h-0 p-6 gap-4 bg-slate-950/30 overflow-hidden">
            {/* Right Header & Category Pills */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-outfit font-black text-sm uppercase tracking-wider text-slate-200">
                  Equipment Kits Catalog
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {filteredCatalogKits.length} available
                </span>
              </div>

              {/* Category Filter Pills (KISS Multi-Option Pill Switch) */}
              <div className="flex flex-wrap gap-1 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search catalog by name or description..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>
            </div>

            {/* Catalog List Stream */}
            <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-2.5">
              {filteredCatalogKits.length > 0 ? (
                filteredCatalogKits.map((bundle) => {
                  const isEquipped = equippedNamesSet.has(bundle.name.toLowerCase());
                  const costSilver = parseCostToSilver(bundle.cost);

                  return (
                    <div
                      key={bundle.id || bundle.name}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col gap-2 shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-100">{bundle.name}</span>
                            {bundle.category && (
                              <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                                {bundle.category}
                              </span>
                            )}
                            {costSilver > 0 && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                                {formatCostAbbreviated(costSilver)}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEquipKit(bundle)}
                          disabled={isEquipped}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            isEquipped
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 cursor-default'
                              : 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white shadow-sm cursor-pointer'
                          }`}
                        >
                          {isEquipped ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Equipped</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{costSilver > 0 ? `Buy (${formatCostAbbreviated(costSilver)})` : 'Equip'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {bundle.description && (
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                          {bundle.description}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No matching kits found in catalog.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= 3. FOOTER CONTEXT BAR ================= */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-outfit font-bold text-slate-300">
              Hero: <span className="text-cyan-300">{activeCharacter?.name || 'Unnamed Hero'}</span>
            </span>
            <span>•</span>
            <span className="font-mono">Total Equipped: {equippedKits.length}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-6 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Backward compatibility alias
export const ManageHardwareBundlesModal = ManageEquipmentKitsModal;
