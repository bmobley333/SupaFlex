// src/components/modals/UniversalLootModal.tsx
// Two-Pane Master Blueprint Modal for Adventure & Encounter Loot Staging, d100 Rolling & Party Vault Delivery

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

type LootCategoryTab = 'random' | 'armor' | 'chaos_gems' | 'coins' | 'gear' | 'hardware' | 'relics' | 'shields' | 'weapons';

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
  const activePartyId = useCharacterStore((state) => state.activePartyId);

  // Form & Drawer states
  const [activeCategoryTab, setActiveCategoryTab] = useState<LootCategoryTab>('random');
  const [searchQuery, setSearchQuery] = useState('');
  const [targetPlayer, setTargetPlayer] = useState('Party');
  const [quickRollTargetPlayer, setQuickRollTargetPlayer] = useState('Party');
  const [coinsTargetPlayer, setCoinsTargetPlayer] = useState('Party');
  const [customItemTargetPlayer, setCustomItemTargetPlayer] = useState('Party');
  const [rollCount, setRollCount] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom Coin / Valuable Form state
  const [customSilver, setCustomSilver] = useState('');
  const [customGold, setCustomGold] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customVal, setCustomVal] = useState('');

  // Catalog Cache state
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Load catalog items on tab switch
  useEffect(() => {
    if (!isOpen || activeCategoryTab === 'random' || activeCategoryTab === 'coins') return;

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

  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  // Evaluate coin formula string into concrete silver and gold numbers
  const evaluateCoinFormula = (formula: string): { silver: number; gold: number } => {
    let s = 0;
    let g = 0;

    if (formula === '1d6s') {
      s = rollDice(6);
    } else if (formula === '1d20s') {
      s = rollDice(20);
    } else if (formula === '1d100s') {
      s = rollDice(100);
    } else if (formula === '1d4g') {
      g = rollDice(4);
    } else if (formula === '2d6x10s+1d4g') {
      s = (rollDice(6) + rollDice(6)) * 10;
      g = rollDice(4);
    } else if (formula === '1d100g') {
      g = rollDice(100);
    } else {
      const matchS = formula.match(/(\d+)d(\d+)s/i);
      const matchG = formula.match(/(\d+)d(\d+)g/i);
      if (matchS) {
        const count = parseInt(matchS[1], 10) || 1;
        const sides = parseInt(matchS[2], 10) || 6;
        for (let i = 0; i < count; i++) s += rollDice(sides);
      }
      if (matchG) {
        const count = parseInt(matchG[1], 10) || 1;
        const sides = parseInt(matchG[2], 10) || 4;
        for (let i = 0; i < count; i++) g += rollDice(sides);
      }
      if (!matchS && !matchG) {
        s = rollDice(10);
      }
    }

    return { silver: s, gold: g };
  };

  // Helper to autonomously resolve a loot_main row into one or more concrete subtable items
  const resolveLootRow = async (
    entry: any,
    target: string,
    depth: number = 0
  ): Promise<Omit<StagedLootItem, 'id' | 'created_at'>[]> => {
    const items: Omit<StagedLootItem, 'id' | 'created_at'>[] = [];
    if (!entry) return items;

    const rType = entry.result_type;
    const subKey = entry.subtable_key;

    // 1. Currency
    if (rType === 'currency' || subKey === 'loot_coins') {
      const coins = evaluateCoinFormula(entry.val_formula || '1d20s');
      const labelParts = [
        coins.gold > 0 ? `${coins.gold}g` : '',
        coins.silver > 0 ? `${coins.silver}s` : '',
      ].filter(Boolean);
      items.push({
        title: `Coins 💰 (${labelParts.join(', ') || '1s'})`,
        categoryKey: 'coins',
        coinsSilver: coins.silver,
        coinsGold: coins.gold,
        description: `Pouch of minted currency (${entry.val_formula || 'mixed'}).`,
        targetPlayer: target,
      });
      return items;
    }

    // 2. Junk / Funny One-Off
    if (rType === 'junk' || subKey === 'junk') {
      const roll = rollDice(6);
      const { data: subEntries } = await supabase
        .from('treasure_entries')
        .select('*')
        .eq('table_key', 'junk')
        .lte('range_min', roll)
        .gte('range_max', roll);

      const sub = subEntries && subEntries.length > 0 ? subEntries[0] : null;
      items.push({
        title: sub ? sub.result_name : 'Flavorful Junk Trinket',
        categoryKey: 'gear',
        description: sub ? (sub.notes || 'Odd novelty or funny one-off trinket.') : 'Unusual trinket found in the dungeon.',
        valuableVal: sub?.val_formula || '0g',
        targetPlayer: target,
      });
      return items;
    }

    // 3. Curios, Maps & Documents
    if (rType === 'curio' || subKey === 'curios') {
      const roll = rollDice(6);
      const { data: subEntries } = await supabase
        .from('treasure_entries')
        .select('*')
        .eq('table_key', 'curios')
        .lte('range_min', roll)
        .gte('range_max', roll);

      const sub = subEntries && subEntries.length > 0 ? subEntries[0] : null;
      items.push({
        title: sub ? sub.result_name : 'Cryptic Document / Map',
        categoryKey: 'gear',
        description: sub ? (sub.notes || 'Intriguing document or plot hook.') : 'Ancient parchment with faded markings.',
        targetPlayer: target,
      });
      return items;
    }

    // 4. Art Objects & Gems
    if (rType === 'art_gem' || subKey === 'art_gems') {
      const roll = rollDice(8);
      const { data: subEntries } = await supabase
        .from('treasure_entries')
        .select('*')
        .eq('table_key', 'art_gems')
        .lte('range_min', roll)
        .gte('range_max', roll);

      const sub = subEntries && subEntries.length > 0 ? subEntries[0] : null;
      const rawFormula = sub?.val_formula || entry.val_formula || '2d6g';
      const evaluated = parseAndEvaluateFormula(rawFormula);

      items.push({
        title: sub ? sub.result_name : 'Artistic Valuables',
        categoryKey: 'art_gems',
        valuableVal: evaluated.text,
        description: sub ? (sub.notes || `Valuable art piece worth ${evaluated.text}.`) : `Precious artwork worth ${evaluated.text}.`,
        targetPlayer: target,
      });
      return items;
    }

    // 5. Collectible / Antique
    if (rType === 'item' && (entry.result_name.toLowerCase().includes('collectible') || entry.result_name.toLowerCase().includes('antique'))) {
      const goldVal = rollDice(20);
      items.push({
        title: 'Antique Collectible',
        categoryKey: 'art_gems',
        valuableVal: `${goldVal}g`,
        description: `Rare collectible artifact or antique valued at ${goldVal} gold.`,
        targetPlayer: target,
      });
      return items;
    }

    // 6. Hardware Device
    if (rType === 'hardware' || subKey === 'hardware') {
      const { data: hwItems } = await supabase.from('hardware').select('*');
      const picked = hwItems && hwItems.length > 0 ? hwItems[Math.floor(Math.random() * hwItems.length)] : null;

      items.push({
        title: picked?.name || 'Technological Hardware Device',
        categoryKey: 'hardware',
        description: picked?.description || picked?.effect || 'Advanced technological device with mechanical utility.',
        targetPlayer: target,
      });
      return items;
    }

    // 7. Magic Item / Relic (Minor, Lesser, Greater, Epic)
    if (rType === 'magic_item' || entry.result_name.toLowerCase().includes('magic') || entry.result_name.toLowerCase().includes('relic')) {
      let rarity: 'Minor' | 'Lesser' | 'Greater' | 'Epic' = 'Lesser';
      const rawName = (entry.result_name + ' ' + (subKey || '')).toLowerCase();
      if (rawName.includes('minor')) rarity = 'Minor';
      else if (rawName.includes('greater')) rarity = 'Greater';
      else if (rawName.includes('epic') || rawName.includes('artifact')) rarity = 'Epic';

      let query = supabase.from('relics').select('*');
      if (rarity === 'Epic') {
        query = query.or('category.ilike.%Epic%,category.ilike.%Artifact%');
      } else {
        query = query.ilike('category', `%${rarity}%`);
      }

      const { data: relics } = await query;
      const picked = relics && relics.length > 0 ? relics[Math.floor(Math.random() * relics.length)] : null;

      items.push({
        title: picked?.name || `${rarity} Relic`,
        categoryKey: `magic_${rarity}`,
        rarity,
        description: picked?.effect || picked?.description || `Enchanted ${rarity} relic.`,
        magicItem: picked,
        targetPlayer: target,
      });
      return items;
    }

    // 8. Chaos Gem (Volatile)
    if (rType === 'chaos_gem' || subKey === 'chaos_gems') {
      const { data: gems } = await supabase.from('chaos_gems').select('*');
      const picked = gems && gems.length > 0 ? gems[Math.floor(Math.random() * gems.length)] : null;

      items.push({
        title: picked ? `Chaos Gem: ${picked.name}` : 'Volatile Chaos Gem',
        categoryKey: 'chaos_gems',
        description: picked ? `Action: ${picked.action || 'F'}. ${picked.effect}` : 'Volatile primordial gem conduit.',
        chaosGem: picked,
        targetPlayer: target,
      });
      return items;
    }

    // 9. Special: Double Roll (96-99)
    if (rType === 'special' && entry.range_min >= 96 && entry.range_min <= 99) {
      if (depth < 2) {
        for (let j = 0; j < 2; j++) {
          const subD100 = Math.floor(Math.random() * 95) + 1;
          const { data: subEntries } = await supabase
            .from('loot_main')
            .select('*')
            .lte('range_min', subD100)
            .gte('range_max', subD100);
          if (subEntries && subEntries.length > 0) {
            const subResolved = await resolveLootRow(subEntries[0], target, depth + 1);
            items.push(...subResolved);
          }
        }
      }
      return items;
    }

    // 10. Special: Epic Hoard (100)
    if (rType === 'special' && entry.range_min === 100) {
      // 1 Epic Magic Item
      const { data: epics } = await supabase
        .from('relics')
        .select('*')
        .or('category.ilike.%Epic%,category.ilike.%Artifact%');
      const epicPicked = epics && epics.length > 0 ? epics[Math.floor(Math.random() * epics.length)] : null;

      items.push({
        title: epicPicked?.name || 'Epic Artifact',
        categoryKey: 'magic_Epic',
        rarity: 'Epic',
        description: epicPicked?.effect || epicPicked?.description || 'Legendary artifact of immense power.',
        magicItem: epicPicked,
        targetPlayer: target,
      });

      // 1d100 Gold Coins
      const goldRoll = rollDice(100);
      items.push({
        title: `Gold Hoard 👑 (${goldRoll}g)`,
        categoryKey: 'coins',
        coinsSilver: 0,
        coinsGold: goldRoll,
        description: 'An overflowing chest of sparkling gold coins.',
        targetPlayer: target,
      });

      // 1 Additional Roll on loot_main (1..95)
      const bonusD100 = Math.floor(Math.random() * 95) + 1;
      const { data: bonusEntries } = await supabase
        .from('loot_main')
        .select('*')
        .lte('range_min', bonusD100)
        .gte('range_max', bonusD100);
      if (bonusEntries && bonusEntries.length > 0) {
        const bonusResolved = await resolveLootRow(bonusEntries[0], target, depth + 1);
        items.push(...bonusResolved);
      }

      return items;
    }

    // 11. Nothing Found (01-08)
    if (rType === 'nothing') {
      items.push({
        title: 'Empty Pouch (Dust & Cobwebs)',
        categoryKey: 'gear',
        description: 'An old weathered pouch containing only dust and lint.',
        valuableVal: '0g',
        targetPlayer: target,
      });
      return items;
    }

    // 12. Fallback
    items.push({
      title: entry.result_name || 'Adventuring Item',
      categoryKey: 'gear',
      description: entry.notes || 'Useful adventuring item.',
      targetPlayer: target,
    });
    return items;
  };

  // Quick Roll d100 Random Loot into Staged List (strictly fulfills exact requested count)
  const handleQuickRoll = async (count: number = 1) => {
    setIsRolling(true);
    const addedItems: Omit<StagedLootItem, 'id' | 'created_at'>[] = [];
    const target = quickRollTargetPlayer.trim() || 'Party';
    let safetyAttempts = 0;

    try {
      while (addedItems.length < count && safetyAttempts < 30) {
        safetyAttempts++;
        const d100 = Math.floor(Math.random() * 100) + 1;
        const { data: entries } = await supabase
          .from('loot_main')
          .select('*')
          .lte('range_min', d100)
          .gte('range_max', d100);

        const entry = entries && entries.length > 0 ? entries[0] : null;
        if (!entry) continue;

        const resolved = await resolveLootRow(entry, target, 0);
        for (const item of resolved) {
          if (addedItems.length < count) {
            await onAddLoot(item);
            addedItems.push(item);
          }
        }
      }

      if (addedItems.length === 1) {
        showToast(`🎲 Rolled: ${addedItems[0].title}`);
      } else if (addedItems.length > 1) {
        showToast(`🎲 Rolled exactly ${addedItems.length} items into Stash!`);
      } else {
        showToast('⚠️ No items found on roll.');
      }
    } catch (e) {
      console.error(e);
      showToast('⚠️ Error rolling random loot.');
    } finally {
      setIsRolling(false);
    }
  };

  // Quick Add Die Roll Accumulator
  const handleQuickAdd = (type: 'gold' | 'silver', sides: number) => {
    const roll = Math.floor(Math.random() * sides) + 1;
    if (type === 'gold') {
      const current = parseInt(customGold, 10) || 0;
      const total = current + roll;
      setCustomGold(String(total));
      showToast(`🎲 Rolled +${roll}g (1d${sides})! Total Gold: ${total}g`);
    } else {
      const current = parseInt(customSilver, 10) || 0;
      const total = current + roll;
      setCustomSilver(String(total));
      showToast(`🎲 Rolled +${roll}s (1d${sides})! Total Silver: ${total}s`);
    }
  };

  // Add Coins Loot
  const handleAddCoinsLoot = async () => {
    const s = parseInt(customSilver, 10) || 0;
    const g = parseInt(customGold, 10) || 0;

    if (s === 0 && g === 0) {
      showToast('⚠️ Please enter or roll gold/silver amounts.');
      return;
    }

    await onAddLoot({
      title: `${g > 0 ? `${g} Gold ` : ''}${s > 0 ? `${s} Silver` : ''}`.trim() || '0 Coins',
      categoryKey: 'coins',
      coinsSilver: s,
      coinsGold: g,
      description: `Coin reward (${g}g, ${s}s)`,
      targetPlayer: coinsTargetPlayer,
    });
    setCustomSilver('');
    setCustomGold('');
    showToast(`🪙 Added Coins to staged loot!`);
  };

  // Add Custom Item Loot (Art, Curio, Special Treasure)
  const handleAddCustomItemLoot = async () => {
    if (!customTitle.trim()) {
      showToast('⚠️ Please enter an item title.');
      return;
    }

    await onAddLoot({
      title: customTitle.trim(),
      categoryKey: customVal.trim() ? 'art_gems' : 'curios',
      valuableVal: customVal.trim() ? `${customVal.trim()}g` : undefined,
      targetPlayer: customItemTargetPlayer,
    });
    setCustomTitle('');
    setCustomVal('');
    showToast(`📜 Added "${customTitle.trim()}" to staged loot!`);
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
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
                {subtitle || 'Loot Staging & Delivery Engine'}
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
                <span>📦</span> Loot Stash ({loot.length})
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
                        {item.targetPlayer && item.targetPlayer !== 'Party' ? (
                          <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                            🎯 Target: {item.targetPlayer}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                            🎯 Target: Party
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

          {/* RIGHT PANE (md:col-span-7): 1-Click Roller, Category Swapper, and Custom Generators */}
          <div className="md:col-span-7 flex flex-col h-full overflow-hidden space-y-3 pr-1 min-h-0">
            {/* Catalog Browser / Custom Creation Section */}
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              
              {/* Zone 1: Category Multi-Option Pill Switch */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap shrink-0">
                {[
                  { key: 'random', label: '🎲 Random' },
                  { key: 'armor', label: '🧥 Armor' },
                  { key: 'chaos_gems', label: '💎 Chaos Gem' },
                  { key: 'coins', label: '🪙 Coins/Val' },
                  { key: 'gear', label: '🎒 Gear' },
                  { key: 'hardware', label: '⚙️ Hardware' },
                  { key: 'relics', label: '🪄 Relic' },
                  { key: 'shields', label: '🛡️ Shield' },
                  { key: 'weapons', label: '⚔️ Weapon' },
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

              {/* Zone 2: Dynamic Category Content */}
              {activeCategoryTab === 'random' ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3 pr-1">
                  {/* Card: 1-Click Master Roll Deck */}
                  <div className="bg-slate-950/90 p-4 rounded-xl border border-amber-500/30 space-y-4 shadow-md">
                    <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🎲</span> 1-Click Random Loot Matrix
                      </span>
                    </div>

                    {/* Same-Row Roll Action, Qty, and Target Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickRoll(rollCount)}
                        disabled={isRolling}
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-amber-950/50 flex items-center justify-center gap-2 cursor-pointer border border-amber-400 min-w-[170px]"
                      >
                        <Dice5 className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                        <span>
                          {isRolling
                            ? `Rolling ${rollCount} Items...`
                            : `🎲 ${rollCount > 1 ? `Roll (${rollCount}x)` : 'Roll'} Random to Stash`}
                        </span>
                      </button>

                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 shrink-0 shadow-inner">
                        <span className="text-[11px] text-amber-400 font-bold font-mono">Qty:</span>
                        <select
                          value={rollCount}
                          onChange={(e) => setRollCount(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                          className="bg-slate-900 text-amber-300 font-extrabold font-mono text-xs outline-none cursor-pointer border-none"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                            <option key={n} value={n} className="bg-slate-950 text-slate-100 font-bold">
                              {n}x
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Target Selector */}
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0">
                        <span className="text-[11px] text-slate-400 font-bold px-1">for:</span>
                        <button
                          type="button"
                          onClick={() => setQuickRollTargetPlayer('Party')}
                          className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                            quickRollTargetPlayer === 'Party' || !quickRollTargetPlayer.trim()
                              ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-400 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          🌐 Party
                        </button>
                        <input
                          type="text"
                          placeholder='or custom tag (e.g. "Blake")...'
                          value={quickRollTargetPlayer === 'Party' ? '' : quickRollTargetPlayer}
                          onChange={(e) => setQuickRollTargetPlayer(e.target.value.trim() ? e.target.value : 'Party')}
                          className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeCategoryTab === 'coins' ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3 pr-1">
                  {/* Card 1: Currency & Dice Deck (Amber / Gold Theme) */}
                  <div className="bg-slate-950/90 p-4 rounded-xl border border-amber-500/30 space-y-3 shadow-md">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🪙</span> Coins
                      </span>
                    </div>

                    {/* Inline Quick Add Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-300 shrink-0 flex items-center gap-1">
                        <span>⚡</span> Quick Add:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { type: 'gold' as const, sides: 100, label: '+d100g' },
                          { type: 'gold' as const, sides: 50, label: '+d50g' },
                          { type: 'gold' as const, sides: 10, label: '+d10g' },
                          { type: 'silver' as const, sides: 100, label: '+d100s' },
                          { type: 'silver' as const, sides: 50, label: '+d50s' },
                        ].map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => handleQuickAdd(p.type, p.sides)}
                            className="px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-mono font-bold transition cursor-pointer"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gold (Left) & Silver (Right) Numeric Integer Inputs */}
                    <div className="flex gap-3">
                      <div className="flex-1 flex items-center bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2">
                        <span className="text-amber-400 text-sm mr-2 font-bold font-mono">g</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Gold (g)"
                          value={customGold}
                          onChange={(e) => setCustomGold(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-transparent text-xs text-slate-100 outline-none font-mono"
                        />
                      </div>
                      <div className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
                        <span className="text-slate-400 text-sm mr-2 font-bold font-mono">s</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Silver (s)"
                          value={customSilver}
                          onChange={(e) => setCustomSilver(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-transparent text-xs text-slate-100 outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Card 1 Bottom Action Shelf: Add Coins to Stash */}
                    <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAddCoinsLoot}
                        className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Coins to Stash</span>
                      </button>
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0">
                        <span className="text-[11px] text-slate-400 font-bold px-1">for:</span>
                        <button
                          type="button"
                          onClick={() => setCoinsTargetPlayer('Party')}
                          className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                            coinsTargetPlayer === 'Party' || !coinsTargetPlayer.trim()
                              ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-400 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          🌐 Party
                        </button>
                        <input
                          type="text"
                          placeholder='or custom tag (e.g. "Blake")...'
                          value={coinsTargetPlayer === 'Party' ? '' : coinsTargetPlayer}
                          onChange={(e) => setCoinsTargetPlayer(e.target.value.trim() ? e.target.value : 'Party')}
                          className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Custom Art / Curio Document / Special Treasure (Cyan / Sapphire Theme) */}
                  <div className="bg-slate-950/90 p-4 rounded-xl border border-cyan-500/30 space-y-3 shadow-md">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-1 border-b border-cyan-500/20">
                      <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span>💎</span> Art, Gems, Jewelry, Curio Documents, etc.
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Item Title (e.g. Flawless Star Sapphire, Royal Letter)"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
                      />
                      <div className="w-28 flex items-center bg-slate-900 border border-cyan-500/40 rounded-xl px-2.5 py-2">
                        <span className="text-cyan-400 text-xs mr-1 font-bold font-mono">g</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Val (g)"
                          value={customVal}
                          onChange={(e) => setCustomVal(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full bg-transparent text-xs text-cyan-300 font-mono outline-none"
                        />
                      </div>
                    </div>

                    {/* Card 2 Bottom Action Shelf: Add Custom Item to Stash */}
                    <div className="flex items-center gap-2 pt-2 border-t border-cyan-500/20 flex-wrap">
                      <button
                        type="button"
                        onClick={handleAddCustomItemLoot}
                        className="flex-1 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Custom Item to Stash</span>
                      </button>
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1 shrink-0">
                        <span className="text-[11px] text-slate-400 font-bold px-1">for:</span>
                        <button
                          type="button"
                          onClick={() => setCustomItemTargetPlayer('Party')}
                          className={`px-2 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 border ${
                            customItemTargetPlayer === 'Party' || !customItemTargetPlayer.trim()
                              ? 'bg-cyan-500 text-slate-950 font-extrabold border-cyan-400 shadow-sm'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          🌐 Party
                        </button>
                        <input
                          type="text"
                          placeholder='or custom tag (e.g. "Blake")...'
                          value={customItemTargetPlayer === 'Party' ? '' : customItemTargetPlayer}
                          onChange={(e) => setCustomItemTargetPlayer(e.target.value.trim() ? e.target.value : 'Party')}
                          className="w-36 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Searchable Catalog Browser with Inline Target Controls */
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl p-2 shrink-0">
                    <Search className="w-4 h-4 text-slate-400 ml-1 shrink-0" />
                    <input
                      type="text"
                      placeholder={`Search ${activeCategoryTab}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-slate-100 outline-none"
                    />
                    <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2 shrink-0">
                      <span className="text-[11px] text-slate-400 font-bold">for:</span>
                      <button
                        type="button"
                        onClick={() => setTargetPlayer('Party')}
                        className={`px-2 py-0.5 text-xs font-bold rounded-lg transition cursor-pointer border ${
                          targetPlayer === 'Party' || !targetPlayer.trim()
                            ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        🌐 Party
                      </button>
                      <input
                        type="text"
                        placeholder='custom tag...'
                        value={targetPlayer === 'Party' ? '' : targetPlayer}
                        onChange={(e) => setTargetPlayer(e.target.value.trim() ? e.target.value : 'Party')}
                        className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none"
                      />
                    </div>
                  </div>

                  {isLoadingCatalog ? (
                    <div className="py-12 text-center text-slate-400 text-xs">Loading items from catalog...</div>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">No matching items found.</div>
                  ) : (
                    <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
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
    </div>,
    document.body
  );
};
