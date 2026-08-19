// src/components/hud/UniversalLootDropdown.tsx
// High-Density Parameterized Loot Dropdown with Quick d100 Roll, Catalog Picker & 1-Click Party Vault Delivery

import React, { useState, useRef, useEffect } from 'react';
import {
  Coins,
  ChevronDown,
  Plus,
  Trash2,
  Dice5,
  Send,
  X,
  Search,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StagedLootItem } from '../../types/adventures';
import { useCharacterStore } from '../../store/useCharacterStore';
import { parseAndEvaluateFormula } from '../modals/LootGeneratorModal';

export interface UniversalLootDropdownProps {
  label: string; // e.g. "Adventure Loot", "Encounter Loot"
  loot: StagedLootItem[];
  onAddLoot: (item: Omit<StagedLootItem, 'id' | 'created_at'>) => Promise<void> | void;
  onDeleteLoot: (lootId: string) => Promise<void> | void;
  onClearLoot?: () => Promise<void> | void;
  onSendToPartyVault: (items: StagedLootItem[], sourceLabel: string) => Promise<boolean | void>;
  disabled?: boolean;
  disabledTooltip?: string;
  topLabel?: string;
  themeColor?: 'amber' | 'cyan' | 'rose' | 'indigo' | 'emerald';
  className?: string;
}

type LootCategoryTab = 'coins' | 'weapons' | 'armor' | 'shields' | 'gear' | 'relics' | 'hardware' | 'chaos_gems';

export const UniversalLootDropdown: React.FC<UniversalLootDropdownProps> = ({
  label,
  loot = [],
  onAddLoot,
  onDeleteLoot,
  onClearLoot,
  onSendToPartyVault,
  disabled = false,
  disabledTooltip,
  topLabel,
  themeColor = 'amber',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeCharacter = useCharacterStore((state) => state.activeCharacter);

  // Form & Drawer states
  const [isAdding, setIsAdding] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<LootCategoryTab>('coins');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetPlayer, setTargetPlayer] = useState('Party');
  const [isRolling, setIsRolling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom Coin / Valuable Form state
  const [customSilver, setCustomSilver] = useState('');
  const [customGold, setCustomGold] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [customDesc, setCustomDesc] = useState('');

  // Catalog Cache state
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load catalog items on tab switch
  useEffect(() => {
    if (!isOpen || !isAdding) return;
    if (activeCategoryTab === 'coins') return;

    const loadCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        let tableName = 'gear';
        if (activeCategoryTab === 'weapons') tableName = 'weapons';
        else if (activeCategoryTab === 'armor') tableName = 'armor';
        else if (activeCategoryTab === 'shields') tableName = 'shields';
        else if (activeCategoryTab === 'relics') tableName = 'relics';
        else if (activeCategoryTab === 'hardware') tableName = 'hardware';
        else if (activeCategoryTab === 'chaos_gems') tableName = 'chaos_gems';

        const { data, error } = await supabase.from(tableName).select('*');
        if (!error && data) {
          setCatalogItems(data);
        } else {
          setCatalogItems([]);
        }
      } catch {
        setCatalogItems([]);
      } finally {
        setIsLoadingCatalog(false);
      }
    };

    loadCatalog();
  }, [isOpen, isAdding, activeCategoryTab]);

  // Quick Roll d100 Random Loot into Staged List
  const handleQuickRoll = async () => {
    setIsRolling(true);
    const d100 = Math.floor(Math.random() * 100) + 1;
    try {
      const { data: entries } = await supabase
        .from('loot_main')
        .select('*')
        .lte('range_min', d100)
        .gte('range_max', d100);

      const entry = entries && entries.length > 0 ? entries[0] : null;

      if (!entry) {
        showToast(`🎲 Rolled ${d100}: Nothing found`);
        return;
      }

      let stagedItem: Omit<StagedLootItem, 'id' | 'created_at'>;

      if (entry.result_type === 'currency' || entry.subtable_key === 'loot_coins') {
        const formula = entry.val_formula || '1d20s';
        const s = formula.includes('s') ? Math.floor(Math.random() * 20) + 1 : 0;
        const g = formula.includes('g') ? Math.floor(Math.random() * 4) + 1 : 0;
        stagedItem = {
          title: `${s > 0 ? `${s}s ` : ''}${g > 0 ? `${g}g` : ''}`.trim() || '5s',
          categoryKey: 'coins',
          coinsSilver: s,
          coinsGold: g,
          description: `Random coin pouch (${formula})`,
          targetPlayer,
        };
      } else if (entry.result_type === 'magic_item' || entry.result_name.toLowerCase().includes('relic')) {
        let rarity: 'Minor' | 'Lesser' | 'Greater' | 'Epic' = 'Lesser';
        if (entry.result_name.toLowerCase().includes('minor')) rarity = 'Minor';
        else if (entry.result_name.toLowerCase().includes('greater')) rarity = 'Greater';
        else if (entry.result_name.toLowerCase().includes('epic') || entry.result_name.toLowerCase().includes('artifact')) rarity = 'Epic';

        const { data: relics } = await supabase.from('relics').select('*').ilike('category', `%${rarity}%`);
        const picked = relics && relics.length > 0 ? relics[Math.floor(Math.random() * relics.length)] : null;

        stagedItem = {
          title: picked?.name || `${rarity} Relic`,
          categoryKey: `magic_${rarity}`,
          rarity,
          description: picked?.effect || picked?.description || `Enchanted ${rarity} relic.`,
          magicItem: picked,
          targetPlayer,
        };
      } else if (entry.result_type === 'chaos_gem') {
        const { data: gems } = await supabase.from('chaos_gems').select('*');
        const picked = gems && gems.length > 0 ? gems[Math.floor(Math.random() * gems.length)] : null;

        stagedItem = {
          title: picked ? `Chaos Gem: ${picked.name}` : 'Volatile Chaos Gem',
          categoryKey: 'chaos_gems',
          description: picked ? `Action: ${picked.action || 'F'}. ${picked.effect}` : 'Volatile gem conduit.',
          chaosGem: picked,
          targetPlayer,
        };
      } else if (entry.result_type === 'art_gem' || entry.subtable_key === 'loot_art_gems') {
        const formula = entry.val_formula || '2d6g';
        const evaluated = parseAndEvaluateFormula(formula);
        stagedItem = {
          title: entry.result_name || 'Jeweled Bauble',
          categoryKey: 'art_gems',
          valuableVal: evaluated.text,
          description: `Art object worth ${evaluated.text}`,
          targetPlayer,
        };
      } else {
        stagedItem = {
          title: entry.result_name,
          categoryKey: 'gear',
          description: entry.notes || 'Useful adventuring item',
          targetPlayer,
        };
      }

      await onAddLoot(stagedItem);
      showToast(`🎲 Added "${stagedItem.title}" to ${label}!`);
    } catch (e) {
      console.error('[UniversalLootDropdown] Error rolling loot:', e);
      showToast('⚠️ Error rolling random loot.');
    } finally {
      setIsRolling(false);
    }
  };

  // Add Custom Coin / Valuable
  const handleAddCustomLoot = async () => {
    const s = parseInt(customSilver, 10) || 0;
    const g = parseInt(customGold, 10) || 0;

    if (s > 0 || g > 0) {
      await onAddLoot({
        title: `${g > 0 ? `${g} Gold ` : ''}${s > 0 ? `${s} Silver` : ''}`.trim(),
        categoryKey: 'coins',
        coinsSilver: s,
        coinsGold: g,
        description: customDesc.trim() || `Coin reward (${g}g, ${s}s)`,
        targetPlayer,
      });
      setCustomSilver('');
      setCustomGold('');
      setCustomDesc('');
      showToast(`🪙 Added Coins to ${label}!`);
      return;
    }

    if (customTitle.trim()) {
      await onAddLoot({
        title: customTitle.trim(),
        categoryKey: customVal.trim() ? 'art_gems' : 'curios',
        valuableVal: customVal.trim() || undefined,
        description: customDesc.trim() || undefined,
        targetPlayer,
      });
      setCustomTitle('');
      setCustomVal('');
      setCustomDesc('');
      showToast(`📜 Added "${customTitle.trim()}" to ${label}!`);
    }
  };

  // Add Selected Catalog Item
  const handleAddCatalogItem = async (item: any) => {
    let categoryKey = activeCategoryTab as string;
    let rarity: 'Minor' | 'Lesser' | 'Greater' | 'Epic' | undefined = undefined;

    if (activeCategoryTab === 'relics') {
      const cat = (item.category || '').toLowerCase();
      if (cat.includes('epic') || cat.includes('artifact')) rarity = 'Epic';
      else if (cat.includes('greater')) rarity = 'Greater';
      else if (cat.includes('minor')) rarity = 'Minor';
      else rarity = 'Lesser';
    }

    await onAddLoot({
      title: item.name,
      categoryKey,
      rarity,
      description: item.effect || item.notes || item.description || (item.requirement ? `Req: ${item.requirement}` : undefined),
      magicItem: activeCategoryTab === 'relics' ? item : undefined,
      chaosGem: activeCategoryTab === 'chaos_gems' ? item : undefined,
      item_data: item,
      targetPlayer,
    });

    showToast(`➕ Added "${item.name}" to ${label}!`);
  };

  // 1-Click Send All Staged Loot to Party Vault
  const handleSendAllToVault = async () => {
    if (loot.length === 0) return;
    const ok = await onSendToPartyVault(loot, label);
    if (ok !== false) {
      if (onClearLoot) await onClearLoot();
      showToast(`🚀 All ${loot.length} items sent to Party Vault!`);
    }
  };

  // Send Individual Item to Party Vault
  const handleSendSingleToVault = async (item: StagedLootItem) => {
    const ok = await onSendToPartyVault([item], label);
    if (ok !== false) {
      await onDeleteLoot(item.id);
      showToast(`🎁 "${item.title}" sent to Party Vault!`);
    }
  };

  // Filter Catalog Items by Search
  const filteredCatalog = catalogItems.filter((i) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (i.name || '').toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.effect || '').toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q)
    );
  });

  const getThemeClasses = () => {
    switch (themeColor) {
      case 'rose':
        return {
          btn: 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border-rose-500/40',
          icon: 'text-rose-400',
          accent: 'text-rose-300',
          badge: 'bg-rose-900/80 text-rose-300 border-rose-700',
        };
      case 'cyan':
        return {
          btn: 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border-cyan-500/40',
          icon: 'text-cyan-400',
          accent: 'text-cyan-300',
          badge: 'bg-cyan-900/80 text-cyan-300 border-cyan-700',
        };
      case 'indigo':
        return {
          btn: 'bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 border-indigo-500/40',
          icon: 'text-indigo-400',
          accent: 'text-indigo-300',
          badge: 'bg-indigo-900/80 text-indigo-300 border-indigo-700',
        };
      case 'emerald':
        return {
          btn: 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-200 border-emerald-500/40',
          icon: 'text-emerald-400',
          accent: 'text-emerald-300',
          badge: 'bg-emerald-900/80 text-emerald-300 border-emerald-700',
        };
      case 'amber':
      default:
        return {
          btn: 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border-amber-500/40',
          icon: 'text-amber-400',
          accent: 'text-amber-300',
          badge: 'bg-amber-900/80 text-amber-300 border-amber-700',
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div className={`flex flex-col items-center gap-1 relative ${className}`} ref={menuRef}>
      {topLabel && (
        <span className={`text-[11px] font-extrabold uppercase tracking-wider ${theme.accent} font-mono text-center`}>
          {topLabel}
        </span>
      )}

      {/* Main Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer border shadow-sm ${
          disabled
            ? 'bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed opacity-50'
            : theme.btn
        }`}
        title={disabled && disabledTooltip ? disabledTooltip : label}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Coins className={`w-3.5 h-3.5 ${theme.icon} shrink-0`} />
          <span className="truncate">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-1.5 py-0.2 border text-[10px] font-mono rounded font-extrabold ${theme.badge}`}>
            {loot.length}
          </span>
          <ChevronDown className={`w-3 h-3 ${theme.icon}`} />
        </div>
      </button>

      {/* Dropdown Menu Container */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-96 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[580px] text-slate-100 font-sans text-xs">
          
          {/* Toast Banner */}
          {toastMessage && (
            <div className="bg-amber-500 text-slate-950 font-bold px-3 py-1 text-center text-[11px] animate-fadeIn shrink-0">
              {toastMessage}
            </div>
          )}

          {/* Header Bar */}
          <div className="px-3 py-2 border-b border-slate-800/90 bg-slate-900/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{label} ({loot.length})</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action Bar: Roll Random & Add Item Toggle */}
          <div className="p-2 border-b border-slate-800 bg-slate-950/90 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isRolling}
              onClick={handleQuickRoll}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer disabled:opacity-50"
              title="Quick roll d100 random loot into staged list"
            >
              <Dice5 className={`w-3.5 h-3.5 ${isRolling ? 'animate-spin' : ''}`} />
              <span>{isRolling ? 'Rolling...' : '🎲 Roll Random'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className={`py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1 text-xs cursor-pointer border ${
                isAdding
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'Close Drawer' : '➕ Add Item'}</span>
            </button>
          </div>

          {/* ADD ITEM DRAWER */}
          {isAdding && (
            <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-col gap-2 shrink-0 max-h-72 overflow-y-auto">
              {/* Category Pills */}
              <div className="flex flex-wrap gap-1">
                {[
                  { key: 'coins', label: '🪙 Coins/Val' },
                  { key: 'relics', label: '🪄 Relic' },
                  { key: 'weapons', label: '⚔️ Weapon' },
                  { key: 'armor', label: '🧥 Armor' },
                  { key: 'shields', label: '🛡️ Shield' },
                  { key: 'gear', label: '🎒 Gear' },
                  { key: 'hardware', label: '⚙️ Hardw' },
                  { key: 'chaos_gems', label: '💎 Gem' },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setActiveCategoryTab(cat.key as LootCategoryTab);
                      setSearchQuery('');
                    }}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer border ${
                      activeCategoryTab === cat.key
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Target Recipient Selector */}
              <div className="flex items-center gap-1.5 text-[11px] bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-bold shrink-0">🎯 Recipient:</span>
                <select
                  value={targetPlayer}
                  onChange={(e) => setTargetPlayer(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 outline-none font-semibold"
                >
                  <option value="Party">🌐 Party (Shared Stash)</option>
                  {activeCharacter?.name && (
                    <option value={activeCharacter.name}>👤 {activeCharacter.name}</option>
                  )}
                </select>
              </div>

              {/* COIN / VALUABLE FORM */}
              {activeCategoryTab === 'coins' ? (
                <div className="space-y-2 pt-1">
                  {/* Preset Buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {[
                      { s: 50, g: 0, label: '+50s' },
                      { s: 100, g: 0, label: '+100s' },
                      { s: 0, g: 10, label: '+10g' },
                      { s: 0, g: 50, label: '+50g' },
                      { s: 0, g: 100, label: '+100g' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setCustomSilver(p.s ? String(p.s) : '');
                          setCustomGold(p.g ? String(p.g) : '');
                        }}
                        className="px-2 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 rounded text-[10px] font-mono font-bold"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Silver & Gold Inputs */}
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                      <span className="text-slate-400 text-xs mr-1">🪙</span>
                      <input
                        type="number"
                        placeholder="Silver (s)"
                        value={customSilver}
                        onChange={(e) => setCustomSilver(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                      <span className="text-amber-400 text-xs mr-1">💰</span>
                      <input
                        type="number"
                        placeholder="Gold (g)"
                        value={customGold}
                        onChange={(e) => setCustomGold(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-100 outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Or Custom Valuable Document */}
                  <div className="border-t border-slate-800 pt-1.5 space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">
                      Or Custom Art / Curio Document:
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Item Title (e.g. Ruby Ring, Map)"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Val (e.g. 50g)"
                        value={customVal}
                        onChange={(e) => setCustomVal(e.target.value)}
                        className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Optional notes or description..."
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomLoot}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all text-xs flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <span>➕ Add Custom Loot to Stash</span>
                  </button>
                </div>
              ) : (
                /* CATALOG BROWSER */
                <div className="space-y-2 pt-1">
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-2 py-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                    <input
                      type="text"
                      placeholder={`Search ${activeCategoryTab}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-100 outline-none"
                    />
                  </div>

                  {isLoadingCatalog ? (
                    <div className="py-4 text-center text-slate-400 text-xs">Loading items...</div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="py-4 text-center text-slate-500 text-xs">No matching items found.</div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {filteredCatalog.slice(0, 30).map((item) => (
                        <div
                          key={item.id || item.name}
                          className="p-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-xs text-slate-200 truncate">{item.name}</h5>
                            {item.category && (
                              <span className="text-[9px] text-amber-400/80 font-mono">
                                {item.category}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddCatalogItem(item)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded transition shadow-sm shrink-0 cursor-pointer"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STAGED LOOT LIST */}
          <div className="flex-1 p-2.5 overflow-y-auto space-y-2 min-h-24 max-h-72">
            {loot.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40 flex flex-col items-center gap-1.5 text-slate-500">
                <Coins className="w-7 h-7 text-slate-600 mb-0.5" />
                <p className="text-xs font-semibold text-slate-400">No staged loot in this stash.</p>
                <p className="text-[10px] text-slate-500">
                  Click "+ Add Item" or "🎲 Roll Random" above to stage loot!
                </p>
              </div>
            ) : (
              loot.map((item) => (
                <div
                  key={item.id}
                  className="p-2 bg-slate-900/90 border border-slate-800 rounded-xl flex items-start justify-between gap-2 hover:border-slate-700 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-slate-950 border border-slate-700 text-amber-400">
                        {item.categoryKey}
                      </span>
                      {item.valuableVal && (
                        <span className="text-[9px] font-mono font-bold px-1 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          {item.valuableVal}
                        </span>
                      )}
                      {item.targetPlayer && item.targetPlayer !== 'Party' && (
                        <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800">
                          For: {item.targetPlayer}
                        </span>
                      )}
                    </div>
                    <h5 className="font-bold text-xs text-slate-100 truncate">{item.title}</h5>
                    {item.description && (
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-tight">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-start pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleSendSingleToVault(item)}
                      className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10px] rounded transition shadow-sm cursor-pointer flex items-center gap-1"
                      title="Send this item to Party Echo Vault"
                    >
                      <Send className="w-2.5 h-2.5" />
                      <span>Vault</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLoot(item.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                      title="Delete staged item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Bar: 1-Click Send All to Party Vault */}
          {loot.length > 0 && (
            <div className="p-2 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-mono">
                Total Staged: <strong className="text-slate-200">{loot.length}</strong>
              </span>
              <button
                type="button"
                onClick={handleSendAllToVault}
                className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Send all staged loot items directly to the live Party Echo Vault"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Send ALL to Party Vault</span>
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
