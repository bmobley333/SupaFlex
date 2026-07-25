import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface LootGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  currentSilver: number;
  currentGold: number;
  onClaimCoins: (addSilver: number, addGold: number) => Promise<boolean>;
  onClaimMagicItem: (item: any, autoEquip: boolean) => Promise<boolean>;
  onClaimValuable: (name: string, val: string) => Promise<boolean>;
}

export interface RollResult {
  id: string;
  tableKey: string;
  tableName: string;
  rollVal: number;
  title: string;
  description: string;
  type: 'coins' | 'magic_item' | 'art_gem' | 'document' | 'junk' | 'quality' | 'special';
  coinsSilver?: number;
  coinsGold?: number;
  magicItem?: any;
  valuableName?: string;
  valuableVal?: string;
  claimed?: boolean;
}

export const LootGeneratorModal: React.FC<LootGeneratorModalProps> = ({
  isOpen,
  onClose,
  characterName,
  currentSilver,
  currentGold,
  onClaimCoins,
  onClaimMagicItem,
  onClaimValuable
}) => {
  const [isGmMode, setIsGmMode] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<RollResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper dice roller
  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  // Dice parser for coin formulas like 1d6, 1d20, 1d100, 2d6x10s+1d4g
  const evaluateCoins = (formula: string): { silver: number; gold: number; breakdown: string } => {
    let s = 0;
    let g = 0;
    let desc = formula;

    if (formula === '1d6s') {
      const r = rollDice(6);
      s = r;
      desc = `1d6(s) = ${r}s`;
    } else if (formula === '1d20s') {
      const r = rollDice(20);
      s = r;
      desc = `1d20(s) = ${r}s`;
    } else if (formula === '1d100s') {
      const r = rollDice(100);
      s = r;
      desc = `1d100(s) = ${r}s`;
    } else if (formula === '1d4g') {
      const r = rollDice(4);
      g = r;
      desc = `1d4(g) = ${r}g`;
    } else if (formula === '2d6x10s+1d4g') {
      const d1 = rollDice(6);
      const d2 = rollDice(6);
      const sVal = (d1 + d2) * 10;
      const gVal = rollDice(4);
      s = sVal;
      g = gVal;
      desc = `2d6(${d1}+${d2}=${d1+d2}) × 10 = ${sVal}s + 1d4(${gVal}) = ${gVal}g`;
    } else if (formula === '1d100g') {
      const r = rollDice(100);
      g = r;
      desc = `1d100(g) = ${r}g`;
    } else {
      s = rollDice(10);
      desc = `Standard pouch = ${s}s`;
    }

    return { silver: s, gold: g, breakdown: desc };
  };

  // Fetch random magic item by rarity
  const fetchRandomMagicItem = async (rarity: string) => {
    try {
      const { data, error } = await supabase
        .from('magic_items')
        .select('*')
        .ilike('category', `%${rarity}%`);
      
      if (error || !data || data.length === 0) {
        // Fallback fetch all
        const { data: allData } = await supabase.from('magic_items').select('*');
        if (allData && allData.length > 0) {
          return allData[Math.floor(Math.random() * allData.length)];
        }
        return { name: `${rarity} Magic Item`, category: rarity, description: 'Mystical artifact of power.' };
      }

      return data[Math.floor(Math.random() * data.length)];
    } catch {
      return { name: `${rarity} Magic Wand`, category: rarity, description: 'Enchanted magic focus.' };
    }
  };

  // Execute Master d100 Loot Roll
  const handleRollMasterD100 = async () => {
    setIsRolling(true);
    const d100 = rollDice(100);
    
    try {
      const { data: entries } = await supabase
        .from('treasure_entries')
        .select('*')
        .eq('table_key', 'master_d100')
        .lte('range_min', d100)
        .gte('range_max', d100);

      const entry = entries && entries.length > 0 ? entries[0] : null;
      const resList: RollResult[] = [];

      if (!entry) {
        resList.push({
          id: `res-${Date.now()}`,
          tableKey: 'master_d100',
          tableName: 'Master d100 Table',
          rollVal: d100,
          title: 'Nothing Found',
          description: 'No loot present in this container.',
          type: 'nothing' as any
        });
      } else {
        const rType = entry.result_type;

        if (rType === 'nothing') {
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'master_d100',
            tableName: 'Master d100 Table',
            rollVal: d100,
            title: entry.result_name,
            description: entry.notes || 'Empty container.',
            type: 'nothing' as any
          });
        } else if (rType === 'currency') {
          const evalC = evaluateCoins(entry.val_formula || '1d6s');
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'master_d100',
            tableName: 'Master d100 Table',
            rollVal: d100,
            title: `Coins 💰 (${evalC.silver > 0 ? evalC.silver + 's' : ''} ${evalC.gold > 0 ? evalC.gold + 'g' : ''})`,
            description: `Formula: ${evalC.breakdown}`,
            type: 'coins',
            coinsSilver: evalC.silver,
            coinsGold: evalC.gold
          });
        } else if (rType === 'magic_item') {
          const rarity = entry.subtable_key?.replace('magic_', '') || 'Lesser';
          const item = await fetchRandomMagicItem(rarity);
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'master_d100',
            tableName: 'Master d100 Table',
            rollVal: d100,
            title: `${entry.result_name}: ${item.name}`,
            description: item.description || item.notes || `Category: ${item.category}`,
            type: 'magic_item',
            magicItem: item
          });
        } else if (rType === 'art_gem' || rType === 'subtable') {
          const subKey = entry.subtable_key || 'art_gems';
          const subRoll = rollDice(8);
          const { data: subEntries } = await supabase
            .from('treasure_entries')
            .select('*')
            .eq('table_key', subKey)
            .lte('range_min', subRoll)
            .gte('range_max', subRoll);

          const subEntry = subEntries && subEntries.length > 0 ? subEntries[0] : null;
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'master_d100',
            tableName: 'Master d100 Table',
            rollVal: d100,
            title: subEntry ? subEntry.result_name : entry.result_name,
            description: subEntry ? `Value/Formula: ${subEntry.val_formula || '—'} (${subEntry.notes || ''})` : entry.notes,
            type: rType === 'art_gem' ? 'art_gem' : 'junk',
            valuableName: subEntry ? subEntry.result_name : entry.result_name,
            valuableVal: subEntry ? subEntry.val_formula : '1g'
          });
        } else if (rType === 'special') {
          if (entry.range_min >= 96 && entry.range_min <= 99) {
            // Double Roll
            const r1 = await handleTargetedRoll('art_gems', false);
            const r2 = await fetchRandomMagicItem('Lesser');
            if (r1) resList.push(r1);
            resList.push({
              id: `res-${Date.now()}-2`,
              tableKey: 'master_d100',
              tableName: 'Master d100 Table',
              rollVal: d100,
              title: `Double Roll Magic: ${r2.name}`,
              description: r2.description || `Category: ${r2.category}`,
              type: 'magic_item',
              magicItem: r2
            });
          } else {
            // Epic Hoard
            const artItem = await fetchRandomMagicItem('Artifact');
            const evalC = evaluateCoins('1d100g');
            resList.push({
              id: `res-${Date.now()}-epic1`,
              tableKey: 'master_d100',
              tableName: 'Epic Hoard 👑',
              rollVal: 100,
              title: `Artifact 💫: ${artItem.name}`,
              description: artItem.description || 'Legendary artifact of massive power.',
              type: 'magic_item',
              magicItem: artItem
            });
            resList.push({
              id: `res-${Date.now()}-epic2`,
              tableKey: 'master_d100',
              tableName: 'Epic Hoard 👑',
              rollVal: 100,
              title: `Gold Hoard 💰 (${evalC.gold}g)`,
              description: `Rolled 1d100 Gold = ${evalC.gold}g`,
              type: 'coins',
              coinsSilver: 0,
              coinsGold: evalC.gold
            });
          }
        }
      }

      setResults(prev => [...resList, ...prev]);
    } catch (e: any) {
      showToast(`Error rolling loot: ${e.message}`);
    } finally {
      setIsRolling(false);
    }
  };

  // Execute Targeted Subtable Roll
  const handleTargetedRoll = async (tableKey: string, append = true) => {
    setIsRolling(true);
    try {
      let diceMax = 8;
      if (tableKey === 'curios' || tableKey === 'junk') diceMax = 6;
      if (tableKey.startsWith('magic_')) {
        const rarity = tableKey.replace('magic_', '');
        const item = await fetchRandomMagicItem(rarity);
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey,
          tableName: `${rarity} Magic Item`,
          rollVal: 1,
          title: `${rarity} Magic Item: ${item.name}`,
          description: item.description || `Category: ${item.category}`,
          type: 'magic_item',
          magicItem: item
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
      } else if (tableKey === 'coins') {
        const evalC = evaluateCoins('2d6x10s+1d4g');
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey: 'coins',
          tableName: 'Coins Purse',
          rollVal: 1,
          title: `Coins 💰 (${evalC.silver}s + ${evalC.gold}g)`,
          description: `Breakdown: ${evalC.breakdown}`,
          type: 'coins',
          coinsSilver: evalC.silver,
          coinsGold: evalC.gold
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
      } else {
        const dVal = rollDice(diceMax);
        const { data: entries } = await supabase
          .from('treasure_entries')
          .select('*')
          .eq('table_key', tableKey)
          .lte('range_min', dVal)
          .gte('range_max', dVal);

        const entry = entries && entries.length > 0 ? entries[0] : null;
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey,
          tableName: tableKey.toUpperCase(),
          rollVal: dVal,
          title: entry ? entry.result_name : 'Targeted Result',
          description: entry ? `Value: ${entry.val_formula || '—'} (${entry.notes || ''})` : 'Result found.',
          type: tableKey === 'art_gems' ? 'art_gem' : tableKey === 'curios' ? 'document' : 'junk',
          valuableName: entry ? entry.result_name : 'Targeted Item',
          valuableVal: entry ? entry.val_formula : '1g'
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
      }
    } catch (e: any) {
      showToast(`Targeted roll error: ${e.message}`);
      return null;
    } finally {
      setIsRolling(false);
    }
  };

  // GM Hoard Generator Presets
  const handleGmHoardPreset = async (preset: 'minion' | 'boss' | 'dragon') => {
    setIsRolling(true);
    try {
      if (preset === 'minion') {
        await handleTargetedRoll('coins', true);
        await handleTargetedRoll('junk', true);
      } else if (preset === 'boss') {
        await handleTargetedRoll('coins', true);
        await handleTargetedRoll('art_gems', true);
        await handleTargetedRoll('magic_Lesser', true);
      } else if (preset === 'dragon') {
        await handleRollMasterD100();
        await handleTargetedRoll('magic_Greater', true);
        await handleTargetedRoll('magic_Artifact', true);
      }
    } finally {
      setIsRolling(false);
    }
  };

  // Action Claim Handlers
  const claimCoins = async (res: RollResult) => {
    if (res.claimed) return;
    const s = res.coinsSilver || 0;
    const g = res.coinsGold || 0;
    const ok = await onClaimCoins(s, g);
    if (ok) {
      res.claimed = true;
      setResults([...results]);
      showToast(`✅ Claimed +${s}s, +${g}g directly to ${characterName}'s Wallet!`);
    } else {
      showToast(`❌ Failed to claim coins. State reverted.`);
    }
  };

  const claimMagicItem = async (res: RollResult, autoEquip: boolean) => {
    if (res.claimed || !res.magicItem) return;
    const ok = await onClaimMagicItem(res.magicItem, autoEquip);
    if (ok) {
      res.claimed = true;
      setResults([...results]);
      showToast(`✅ Claimed '${res.magicItem.name}' ${autoEquip ? '& Equipped ' : ''}to ${characterName}!`);
    } else {
      showToast(`❌ Failed to claim magic item. State reverted.`);
    }
  };

  const claimValuable = async (res: RollResult) => {
    if (res.claimed) return;
    const name = res.valuableName || res.title;
    const val = res.valuableVal || '1g';
    const ok = await onClaimValuable(name, val);
    if (ok) {
      res.claimed = true;
      setResults([...results]);
      showToast(`✅ Claimed '${name}' (${val}) to Valuables List!`);
    } else {
      showToast(`❌ Failed to claim valuable. State reverted.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-sm font-bold text-center animate-bounce">
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h2 className="text-xl font-bold text-amber-400">Random Loot & Treasure Generator</h2>
              <p className="text-xs text-slate-400">1-Click Automated Treasure Roll & Sheet Claim Engine</p>
            </div>
          </div>
          
          {/* Dyslexic-Friendly Side-Labeled Peg Slider */}
          <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className={`text-xs font-bold transition-opacity ${!isGmMode ? 'text-amber-400 opacity-100' : 'text-slate-500 opacity-50'}`}>
              Player Single Roll
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isGmMode} 
                onChange={() => setIsGmMode(!isGmMode)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-amber-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
            <span className={`text-xs font-bold transition-opacity ${isGmMode ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-50'}`}>
              GM Hoard Mode
            </span>
          </div>

          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/40">
          
          {/* GM Hoard Selector Bar */}
          {isGmMode ? (
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-300">👑 GM Hoard Generator Presets:</span>
                <span className="text-xs text-slate-400">Generate multi-item loot hoards instantly</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  disabled={isRolling}
                  onClick={() => handleGmHoardPreset('minion')}
                  className="bg-indigo-900/50 hover:bg-indigo-800/70 border border-indigo-700 text-indigo-200 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2"
                >
                  🐀 Minion Corpse (Coins + Junk)
                </button>
                <button
                  disabled={isRolling}
                  onClick={() => handleGmHoardPreset('boss')}
                  className="bg-indigo-900/70 hover:bg-indigo-700/80 border border-indigo-600 text-indigo-100 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2"
                >
                  🛡️ Elite Boss Chest (Coins + Gem + Lesser)
                </button>
                <button
                  disabled={isRolling}
                  onClick={() => handleGmHoardPreset('dragon')}
                  className="bg-amber-600/30 hover:bg-amber-500/40 border border-amber-500/60 text-amber-200 py-2.5 px-3 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2"
                >
                  🐉 Dragon Vault (Master + Greater + Artifact)
                </button>
              </div>
            </div>
          ) : (
            /* Player Target Chips Bar */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-400">🎲 Master & Targeted Roll Launchers:</span>
                <span className="text-xs text-slate-400">Click any chip to trigger instant loot roll</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isRolling}
                  onClick={handleRollMasterD100}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                >
                  🎲 Roll Master d100
                </button>

                <button disabled={isRolling} onClick={() => handleTargetedRoll('coins')} className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  🪙 Coins
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('magic_Minor')} className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  🍺 Minor Magic
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('magic_Lesser')} className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  🪄 Lesser Magic
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('magic_Greater')} className="bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  ✨ Greater Magic
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('magic_Artifact')} className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  💫 Artifact
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('gear_quality')} className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  🧰 Quality
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('art_gems')} className="bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  🎨 Art & Gems
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('curios')} className="bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  📜 Curios
                </button>
                <button disabled={isRolling} onClick={() => handleTargetedRoll('junk')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  🗑️ Junk
                </button>
              </div>
            </div>
          )}

          {/* Results Output List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Generated Loot Results ({results.length})
              </span>
              {results.length > 0 && (
                <button onClick={() => setResults([])} className="text-xs text-slate-500 hover:text-slate-300">
                  Clear History
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                <span className="text-3xl block mb-2">🎲</span>
                <p className="text-sm">No loot generated yet. Click any button above to roll!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((res) => (
                  <div 
                    key={res.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      res.claimed 
                        ? 'bg-slate-950/60 border-slate-800 opacity-60' 
                        : 'bg-slate-800/80 border-slate-700/80 hover:border-amber-500/50 shadow-lg'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400">
                            {res.tableName}
                          </span>
                          <span className="text-xs text-slate-400">Rolled: {res.rollVal}</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-100">{res.title}</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{res.description}</p>
                      </div>

                      {/* 1-Click Claim Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {res.claimed ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-3 py-1.5 rounded-lg">
                            ✓ Claimed to Sheet
                          </span>
                        ) : (
                          <>
                            {res.type === 'coins' && (
                              <button
                                onClick={() => claimCoins(res)}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-2 rounded-lg transition-all"
                              >
                                🪙 +Add Coins to Wallet
                              </button>
                            )}

                            {res.type === 'magic_item' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => claimMagicItem(res, false)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                                >
                                  🎒 Add to Inventory
                                </button>
                                <button
                                  onClick={() => claimMagicItem(res, true)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                                >
                                  ⚔️ Add & Equip
                                </button>
                              </div>
                            )}

                            {(res.type === 'art_gem' || res.type === 'junk' || res.type === 'document') && (
                              <button
                                onClick={() => claimValuable(res)}
                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all"
                              >
                                💎 +Add to Valuables
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Status Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Hero: <strong className="text-slate-200">{characterName}</strong></span>
            <span>•</span>
            <span>Wallet: <strong className="text-amber-300">{currentSilver}s</strong>, <strong className="text-amber-400">{currentGold}g</strong></span>
          </div>
          <button onClick={onClose} className="hover:text-slate-200 transition-colors">
            Close Modal
          </button>
        </div>

      </div>
    </div>
  );
};
