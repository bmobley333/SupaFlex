// src/components/modals/UniversalLootModal.tsx
// Two-Pane Master Blueprint Modal for Adventure & Encounter Loot Staging, d100 Rolling & Party Vault Delivery

import React, { useState, useEffect } from 'react';
import {
  Coins,
  Dice5,
  Plus,
  Trash2,
  Send,
  Search,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StagedLootItem } from '../../types/adventures';
import { useCharacterStore } from '../../store/useCharacterStore';
import { parseAndEvaluateFormula } from './LootGeneratorModal';

export interface UniversalLootModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string; // e.g. "Adventure Loot", "Encounter Loot: Crypt Skeletons"
  subtitle?: string;
  loot: StagedLootItem[];
  onAddLoot: (item: Omit<StagedLootItem, 'id' | 'created_at'>) => Promise<void> | void;
  onDeleteLoot: (lootId: string) => Promise<void> | void;
  onClearLoot?: () => Promise<void> | void;
  onSendToPartyVault: (items: StagedLootItem[], sourceLabel: string) => Promise<boolean | void>;
  themeColor?: 'amber' | 'cyan' | 'rose' | 'indigo' | 'emerald';
}

type LootCategoryTab = 'coins' | 'weapons' | 'armor' | 'shields' | 'gear' | 'relics' | 'hardware' | 'chaos_gems';

export const UniversalLootModal: React.FC<UniversalLootModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  loot = [],
  onAddLoot,
  onDeleteLoot,
  onClearLoot,
  onSendToPartyVault,
}) => {
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const activePartyId = useCharacterStore((state) => state.activePartyId);

  // Form & Drawer states
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load catalog items on tab switch
  useEffect(() => {
    if (!isOpen || activeCategoryTab === 'coins') return;

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
  }, [isOpen, activeCategoryTab]);

  if (!isOpen) return null;

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
      showToast(`🎲 Added "${stagedItem.title}" to staged loot!`);
    } catch (e) {
      console.error('[UniversalLootModal] Error rolling loot:', e);
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
      showToast(`🪙 Added Coins to staged loot!`);
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
      showToast(`📜 Added "${customTitle.trim()}" to staged loot!`);
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

    showToast(`➕ Added "${item.name}" to staged loot!`);
  };

  // 1-Click Send All Staged Loot to Party Vault
  const handleSendAllToVault = async () => {
    if (loot.length === 0) return;
    const ok = await onSendToPartyVault(loot, title);
    if (ok !== false) {
      if (onClearLoot) await onClearLoot();
      showToast(`🚀 All ${loot.length} items sent to Party Vault!`);
    }
  };

  // Send Individual Item to Party Vault
  const handleSendSingleToVault = async (item: StagedLootItem) => {
    const ok = await onSendToPartyVault([item], title);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-sm font-bold text-center animate-bounce shrink-0 shadow-md">
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
                  {loot.length} Staged
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {subtitle || 'Master Blueprint Two-Pane Loot Staging & Delivery Engine'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Two-Pane Master Grid with Independent Scrollbars */}
        <div className="flex-1 p-6 bg-slate-900/40 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden min-h-0">
          
          {/* LEFT PANE (md:col-span-5): Staged Loot Items Stream */}
          <div className="md:col-span-5 flex flex-col h-full border-b md:border-b-0 md:border-r border-slate-800/80 md:pr-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0 mb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span>📦</span> Staged Loot Stream ({loot.length})
              </span>
              {loot.length > 0 && onClearLoot && (
                <button
                  onClick={onClearLoot}
                  className="text-rose-400 hover:text-rose-300 text-xs font-semibold hover:bg-rose-950/40 px-2 py-0.5 rounded transition cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Prominent Send ALL to Party Vault Button */}
            {loot.length > 0 && (
              <div className="mb-3 shrink-0">
                <button
                  type="button"
                  onClick={handleSendAllToVault}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-lg shadow-cyan-950/50 flex items-center justify-center gap-2 cursor-pointer border border-cyan-400/40"
                  title="Send all staged loot items directly to the live Party Echo Vault"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>🚀 Send ALL ({loot.length}) to Party Vault</span>
                </button>
              </div>
            )}

            {/* Staged Items List */}
            {loot.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30 text-center p-6">
                <Coins className="w-10 h-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-slate-400">No loot staged in this stash.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Use the control panel on the right to roll random drops or add catalog items!
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
                {loot.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl flex items-start justify-between gap-3 hover:border-slate-700 shadow-md transition"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400">
                          {item.categoryKey}
                        </span>
                        {item.valuableVal && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            {item.valuableVal}
                          </span>
                        )}
                        {item.targetPlayer && item.targetPlayer !== 'Party' && (
                          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                            For: {item.targetPlayer}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-100 leading-snug">{item.title}</h4>
                      {item.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-start pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleSendSingleToVault(item)}
                        className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1"
                        title="Send this item to Party Echo Vault"
                      >
                        <Send className="w-3 h-3" />
                        <span>Vault</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLoot(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition cursor-pointer"
                        title="Delete staged item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT PANE (md:col-span-7): Loot Creation, d100 Roller & Catalog Deck */}
          <div className="md:col-span-7 flex flex-col h-full space-y-4 overflow-y-auto pr-2">
            
            {/* Action 1: 1-Click Roll Random Loot (d100 Engine) */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎲</span> Instant d100 Loot Engine
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">Rolls against Master loot_main table</span>
              </div>
              <button
                type="button"
                disabled={isRolling}
                onClick={handleQuickRoll}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold py-3 px-5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-indigo-400/30"
              >
                <Dice5 className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                <span>{isRolling ? 'Rolling on Master Tables...' : '🎲 1-Click Roll Random Loot into Stash'}</span>
              </button>
            </div>

            {/* Action 2: Add Specific Item Suite */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>➕</span> Add Specific Item to Stash
                </span>
              </div>

              {/* Zone 1: Category Multi-Option Pill Switch */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap shrink-0">
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
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      activeCategoryTab === cat.key
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Zone 2: Recipient Target Selector */}
              <div className="flex items-center gap-2 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800 shrink-0">
                <span className="text-slate-400 font-bold shrink-0">🎯 Recipient Target:</span>
                <select
                  value={targetPlayer}
                  onChange={(e) => setTargetPlayer(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 outline-none font-semibold"
                >
                  <option value="Party">🌐 Party (Shared Stash)</option>
                  {activeCharacter?.name && (
                    <option value={activeCharacter.name}>👤 {activeCharacter.name}</option>
                  )}
                </select>
              </div>

              {/* Zone 3: Dynamic Category Content */}
              {activeCategoryTab === 'coins' ? (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 shrink-0">
                  <span className="text-xs font-bold text-amber-400 block">Custom Currency Reward</span>
                  
                  {/* Preset 1-Click Buttons */}
                  <div className="flex gap-1.5 flex-wrap">
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
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Silver & Gold Numeric Inputs */}
                  <div className="flex gap-3">
                    <div className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                      <span className="text-slate-400 text-sm mr-2">🪙</span>
                      <input
                        type="number"
                        placeholder="Silver (s)"
                        value={customSilver}
                        onChange={(e) => setCustomSilver(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-100 outline-none font-mono"
                      />
                    </div>
                    <div className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                      <span className="text-amber-400 text-sm mr-2">💰</span>
                      <input
                        type="number"
                        placeholder="Gold (g)"
                        value={customGold}
                        onChange={(e) => setCustomGold(e.target.value)}
                        className="w-full bg-transparent text-xs text-slate-100 outline-none font-mono"
                      />
                    </div>
                  </div>

                  {/* Custom Art / Curio Document */}
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <span className="text-xs text-slate-400 font-bold block">
                      Or Custom Art, Curio Document, or Special Treasure:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Item Title (e.g. Flawless Star Sapphire, Royal Letter)"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 250g)"
                        value={customVal}
                        onChange={(e) => setCustomVal(e.target.value)}
                        className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Optional effect, lore, or tactical description..."
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomLoot}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Custom Loot to Stash</span>
                  </button>
                </div>
              ) : (
                /* Searchable Catalog Browser */
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 shrink-0">
                    <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      placeholder={`Search ${activeCategoryTab}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-100 outline-none"
                    />
                  </div>

                  {isLoadingCatalog ? (
                    <div className="py-12 text-center text-slate-400 text-xs">Loading items from catalog...</div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">No matching items found.</div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-64">
                      {filteredCatalog.slice(0, 50).map((item) => (
                        <div
                          key={item.id || item.name}
                          className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-amber-500/40 transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h5 className="font-bold text-xs text-slate-100 truncate">{item.name}</h5>
                              {item.category && (
                                <span className="text-[10px] text-amber-400/80 font-mono">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            {(item.effect || item.description || item.notes) && (
                              <p className="text-[10px] text-slate-400 line-clamp-1">
                                {item.effect || item.description || item.notes}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddCatalogItem(item)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shadow-sm shrink-0 cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

        </div>

        {/* Modal Footer Status Bar with Standardized "Done" Button */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>Staged Items: <strong className="text-slate-200">{loot.length}</strong></span>
            <span>•</span>
            <span>Party Vault: <strong className="text-cyan-300">Party #{activePartyId || 'Default'}</strong></span>
          </div>
          
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-6 py-1.5 rounded-xl border border-slate-700/80 transition shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
