import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore } from '../../store/useGenreStore';
import { gameApi } from '../../services/api';
import { LootDraftModal } from './LootDraftModal';
import { EchoVaultModal } from './EchoVaultModal';
import { ChaosGauntletSocketModal } from './ChaosGauntletSocketModal';
import { VaultItem, SupabaseChaosGem } from '../../types/game';

export interface MoveToSheetPayload {
  title: string;
  categoryKey: string;
  description?: string;
  coinsSilver?: number;
  coinsGold?: number;
  valuableVal?: string;
  valuableCurrency?: 'gp' | 'sp';
  magicItem?: any;
  type?: string;
}

interface LootGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  currentSilver: number;
  currentGold: number;
  onMoveToSheet: (payload: MoveToSheetPayload) => Promise<boolean>;
}

export interface RollResult {
  id: string;
  tableKey: string;
  tableName: string;
  rollVal: number;
  title: string;
  description: string;
  type: 'coins' | 'magic_item' | 'art_gem' | 'document' | 'junk' | 'quality' | 'special' | 'chaos_gem';
  categoryKey?: string;
  coinsSilver?: number;
  coinsGold?: number;
  magicItem?: any;
  chaosGem?: SupabaseChaosGem;
  valuableName?: string;
  valuableVal?: string;
  valuableCurrency?: 'gp' | 'sp';
  valueText?: string;
  claimed?: boolean;
}

/**
 * Parses and evaluates dice formulas for art & gem values (e.g. "2d6g", "1d4+1g", "10g", "3g")
 */
export const parseAndEvaluateFormula = (formula: string): { value: number; currency: 'gp' | 'sp'; text: string } => {
  if (!formula || formula.trim() === '') return { value: 1, currency: 'gp', text: '1g' };
  
  const clean = formula.trim().toLowerCase();
  
  // Match dice patterns like 2d6g, 1d4+1g, 1d6s, 1d20g, etc.
  const diceMatch = clean.match(/^(\d+)?d(\d+)(?:\+(\d+))?\s*([gs])$/);
  if (diceMatch) {
    const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
    const sides = parseInt(diceMatch[2], 10);
    const bonus = diceMatch[3] ? parseInt(diceMatch[3], 10) : 0;
    const unit = diceMatch[4] === 's' ? 'sp' : 'gp';
    
    let total = bonus;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    const unitSuffix = unit === 'sp' ? 's' : 'g';
    return { value: total, currency: unit, text: `${total}${unitSuffix}` };
  }
  
  // Match flat values like 10g, 4g, 5s
  const flatMatch = clean.match(/^(\d+)\s*([gs])$/);
  if (flatMatch) {
    const val = parseInt(flatMatch[1], 10);
    const unit = flatMatch[2] === 's' ? 'sp' : 'gp';
    const unitSuffix = unit === 'sp' ? 's' : 'g';
    return { value: val, currency: unit, text: `${val}${unitSuffix}` };
  }
  
  // Fallback if purely numeric
  const num = parseInt(clean, 10);
  if (!isNaN(num)) {
    return { value: num, currency: 'gp', text: `${num}g` };
  }
  
  return { value: 5, currency: 'gp', text: '5g' };
};

export const CATEGORY_OPTIONS = [
  { key: 'coins', label: '🪙 Coins (s/g)' },
  { key: 'chaos_gems', label: '💎 Chaos Gem (Volatile)' },
  { key: 'hardware', label: '⚙️ Hardware Device' },
  { key: 'magic_Minor', label: '🍺 Minor Relic' },
  { key: 'magic_Lesser', label: '🪄 Lesser Relic' },
  { key: 'magic_Greater', label: '✨ Greater Relic' },
  { key: 'magic_Epic', label: '💫 Epic Relic' },
  { key: 'gear_quality', label: '🧰 Gear Quality + Item' },
  { key: 'art_gems', label: '🎨 Art & Gems' },
  { key: 'curios', label: '📜 Curios & Documents' },
  { key: 'junk', label: '🗑️ Junk & One-Offs' }
];

export const LootGeneratorModal: React.FC<LootGeneratorModalProps> = ({
  isOpen,
  onClose,
  characterName,
  currentSilver,
  currentGold,
  onMoveToSheet
}) => {
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const saveActiveCharacter = useCharacterStore((state) => state.saveActiveCharacter);
  const magicItems = useCharacterStore((state) => state.magicItems);
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeGenre = useGenreStore((state) => state.activeGenre);

  const [isGmMode, setIsGmMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('coins');
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<RollResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [socketingItem, setSocketingItem] = useState<{ res: RollResult; gem: SupabaseChaosGem } | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'GENERATOR' | 'VAULT'>('GENERATOR');
  const [lastDraftTier, setLastDraftTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Lesser');
  const [partyVault, setPartyVault] = useState<VaultItem[]>([]);

  const essenceCore = activeCharacter?.sheet_data?.essence_core || 0;
  const starredItemIds = activeCharacter?.sheet_data?.starred_magic_items || [];

  useEffect(() => {
    if (isOpen) {
      const partyId = activePartyId || 'default';
      const storageKey = `supaflex_party_echo_vault_${partyId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setPartyVault(JSON.parse(saved));
        } catch {}
      }
    }
  }, [activePartyId, isOpen]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleModeToggle = (gmMode: boolean) => {
    setIsGmMode(gmMode);
    setResults([]); // Auto-clear history on mode switch per blueprint directive
  };

  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  // Evaluates coin rolls cleanly without generating raw formula strings
  const evaluateCoins = (formula: string): { silver: number; gold: number } => {
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
      s = rollDice(10);
    }

    return { silver: s, gold: g };
  };

  // Fetch random magic item
  const fetchRandomMagicItem = async (rarity: string) => {
    const isEpicTier = rarity.toLowerCase() === 'epic' || rarity.toLowerCase() === 'artifact';
    const cleanRarity = isEpicTier ? 'Epic' : rarity;
    
    try {
      let data: any[] | null = null;
      if (isEpicTier) {
        const { data: epicData } = await supabase
          .from('relics')
          .select('*')
          .or('category.ilike.%Epic%,category.ilike.%Artifact%');
        data = epicData;
      } else {
        const { data: tierData } = await supabase
          .from('relics')
          .select('*')
          .ilike('category', `%${rarity}%`);
        data = tierData;
      }

      if (!data || data.length === 0) {
        // In-memory catalog fallback from Zustand store
        const catalogPool = (magicItems || []).filter((m: any) => {
          const mSub = (m.category || '').toLowerCase();
          return isEpicTier
            ? mSub.includes('epic') || mSub.includes('artifact')
            : mSub.includes(rarity.toLowerCase());
        });

        if (catalogPool.length > 0) {
          const picked = catalogPool[Math.floor(Math.random() * catalogPool.length)];
          return {
            ...picked,
            description: picked.effect || (picked as any).notes || (picked as any).description || `Enchanted ${cleanRarity} relic.`
          };
        }
        return { name: `${cleanRarity} Relic`, category: cleanRarity, description: `Mystical ${cleanRarity.toLowerCase()} relic of power.` };
      }

      const picked = data[Math.floor(Math.random() * data.length)];
      return {
        ...picked,
        description: picked.effect || (picked as any).notes || (picked as any).description || `Enchanted ${cleanRarity} relic.`
      };
    } catch {
      return { name: `${cleanRarity} Relic Focus`, sub: cleanRarity, description: `Enchanted ${cleanRarity.toLowerCase()} relic focus.` };
    }
  };

  // Fetch random hardware item from Supabase hardware table
  const fetchRandomHardwareItem = async () => {
    try {
      const { data } = await supabase.from('hardware').select('*');
      if (data && data.length > 0) {
        const picked = data[Math.floor(Math.random() * data.length)];
        return {
          ...picked,
          is_hardware: true,
          description: picked.effect || picked.notes || picked.description || 'Advanced technological device.'
        };
      }
    } catch {
      // Fallback
    }
    return { name: 'Communicator', category: '🍺 Minor', is_hardware: true, cost: '1g', description: 'Text, audio, and audiovisual comms.' };
  };

  // Fetch random gear item from Supabase gear table for Quality combination
  const fetchRandomGearItem = async () => {
    try {
      const { data } = await supabase.from('gear').select('*');
      if (data && data.length > 0) {
        const filtered = data.filter(g => !g.category.includes('💰') && !g.category.includes('Quality') && !g.category.includes('Art') && !g.category.includes('Curios') && !g.category.includes('Junk'));
        const pool = filtered.length > 0 ? filtered : data;
        return pool[Math.floor(Math.random() * pool.length)];
      }
    } catch {
      // Fallback
    }
    return { name: 'Iron Lantern', cost: '5s' };
  };

  // Master d100 Roll Handler (Direct from Supabase loot_main)
  const handleRollMasterD100 = async () => {
    setIsRolling(true);
    const d100 = rollDice(100);
    
    try {
      const { data: entries, error } = await supabase
        .from('loot_main')
        .select('*')
        .lte('range_min', d100)
        .gte('range_max', d100);

      if (error) throw error;

      const entry = entries && entries.length > 0 ? entries[0] : null;
      const resList: RollResult[] = [];

      if (!entry) {
        resList.push({
          id: `res-${Date.now()}`,
          tableKey: 'loot_main',
          tableName: 'Nothing Found',
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
            tableKey: 'loot_main',
            tableName: 'Nothing Found',
            rollVal: d100,
            title: entry.result_name,
            description: entry.notes || 'Empty container.',
            type: 'nothing' as any
          });
        } else if (rType === 'currency') {
          const evalC = evaluateCoins(entry.val_formula || '1d6s');
          const coinText = [evalC.silver > 0 ? `${evalC.silver}s` : '', evalC.gold > 0 ? `${evalC.gold}g` : ''].filter(Boolean).join(', ');
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'loot_main',
            tableName: '🪙 Coins',
            rollVal: d100,
            title: `Coins 💰 (${coinText || '0s'})`,
            description: 'A small leather pouch containing minted currency.',
            type: 'coins',
            coinsSilver: evalC.silver,
            coinsGold: evalC.gold
          });
        } else if (rType === 'chaos_gem') {
          const gem = await gameApi.getRandomChaosGem(activeGenre);
          if (gem) {
            resList.push({
              id: `res-${Date.now()}`,
              tableKey: 'loot_main',
              categoryKey: 'chaos_gems',
              tableName: '💎 Chaos Gem (Volatile)',
              rollVal: d100,
              title: gem.name,
              description: gem.effect || gem.notes || 'Volatile Chaos Gem. Must be socketed into your Gauntlet upon claiming or discarded.',
              type: 'chaos_gem',
              chaosGem: gem,
            });
          }
        } else if (rType === 'hardware') {
          const hw = await fetchRandomHardwareItem();
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'loot_main',
            categoryKey: 'hardware',
            tableName: '⚙️ Hardware Device',
            rollVal: d100,
            title: hw.name,
            description: hw.description || hw.effect || 'Advanced technological hardware item.',
            type: 'magic_item',
            magicItem: hw
          });
        } else if (rType === 'magic_item') {
          const rawRarity = entry.subtable_key?.replace('magic_', '') || 'Lesser';
          const rarity = (rawRarity.toLowerCase() === 'artifact' || rawRarity.toLowerCase() === 'epic') ? 'Epic' : rawRarity;
          const item = await fetchRandomMagicItem(rarity);
          const iconStr = rarity === 'Minor' ? '🍺' : rarity === 'Lesser' ? '🪄' : rarity === 'Greater' ? '✨' : '💫';
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'loot_main',
            tableName: `${iconStr} ${rarity} Relic`,
            rollVal: d100,
            title: `${item.name}`,
            description: item.description || item.notes || `Mystical ${item.category} item.`,
            type: 'magic_item',
            magicItem: item
          });
        } else if (rType === 'art_gem' || rType === 'subtable' || rType === 'curio' || rType === 'junk' || rType === 'item') {
          const subKey = entry.subtable_key || (rType === 'art_gem' ? 'art_gems' : rType === 'curio' ? 'curios' : rType === 'junk' ? 'junk' : 'art_gems');
          const subRoll = rollDice(8);
          const { data: subEntries } = await supabase
            .from('treasure_entries')
            .select('*')
            .eq('table_key', subKey)
            .lte('range_min', subRoll)
            .gte('range_max', subRoll);

          const subEntry = subEntries && subEntries.length > 0 ? subEntries[0] : null;
          const badgeLabel = subKey === 'art_gems' ? '🎨 Art & Gems' : subKey === 'curios' ? '📜 Curio' : subKey === 'junk' ? '🗑️ Junk' : '🏺 Collectible';
          const cleanDesc = subEntry ? (subEntry.notes || subEntry.result_name) : (entry.notes || 'A rare collectible item.');
          
          const rawFormula = subEntry ? (subEntry.val_formula || entry.val_formula) : entry.val_formula;
          const isArtGemItem = rType === 'art_gem' || subKey === 'art_gems';
          const evalVal = isArtGemItem ? parseAndEvaluateFormula(rawFormula || '2d6g') : null;

          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'loot_main',
            categoryKey: subKey,
            tableName: badgeLabel,
            rollVal: d100,
            title: subEntry ? subEntry.result_name : entry.result_name,
            description: cleanDesc,
            type: isArtGemItem ? 'art_gem' : subKey === 'curios' ? 'document' : 'junk',
            valuableName: subEntry ? subEntry.result_name : entry.result_name,
            valuableVal: evalVal ? String(evalVal.value) : (subEntry ? subEntry.val_formula : '1g'),
            valuableCurrency: evalVal ? evalVal.currency : 'gp',
            valueText: evalVal ? evalVal.text : undefined
          });
        } else if (rType === 'special') {
          if (entry.range_min >= 96 && entry.range_min <= 99) {
            const r1 = await handleTargetedRoll('art_gems', false);
            const r2 = await fetchRandomMagicItem('Lesser');
            if (r1) resList.push(r1);
            resList.push({
              id: `res-${Date.now()}-2`,
              tableKey: 'loot_main',
              tableName: '🪄 Double Roll Relic',
              rollVal: d100,
              title: `${r2.name}`,
              description: r2.description || `Enchanted relic.`,
              type: 'magic_item',
              magicItem: r2
            });
          } else {
            const artItem = await fetchRandomMagicItem('Epic');
            const evalC = evaluateCoins('1d100g');
            resList.push({
              id: `res-${Date.now()}-epic1`,
              tableKey: 'loot_main',
              tableName: '💫 Epic Relic',
              rollVal: 100,
              title: `${artItem.name}`,
              description: artItem.description || 'Legendary epic item of massive power.',
              type: 'magic_item',
              magicItem: artItem
            });
            resList.push({
              id: `res-${Date.now()}-epic2`,
              tableKey: 'loot_main',
              tableName: '👑 Gold Hoard',
              rollVal: 100,
              title: `Gold Hoard 💰 (${evalC.gold}g)`,
              description: 'A overflowing chest of sparkling gold coins.',
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

  // Targeted Subtable Roll Handler with Clean Flavor Texts
  const handleTargetedRoll = async (tableKey: string, append = true) => {
    setIsRolling(true);
    try {
      let diceMax = 8;
      if (tableKey === 'curios' || tableKey === 'junk') diceMax = 6;
      
      if (tableKey === 'gear_quality') {
        const gearItem = await fetchRandomGearItem();
        const dVal = rollDice(8);
        const { data: entries } = await supabase
          .from('treasure_entries')
          .select('*')
          .eq('table_key', 'gear_quality')
          .lte('range_min', dVal)
          .gte('range_max', dVal);

        const qEntry = entries && entries.length > 0 ? entries[0] : { result_name: 'Standard Quality', notes: 'Standard condition' };
        const combinedName = `${qEntry.result_name} ${gearItem.name}`;
        const cleanDesc = `${qEntry.notes || 'Crafted with distinct detail.'} Base item: ${gearItem.name}.`;
        
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey: 'gear_quality',
          tableName: '🧰 Gear Quality',
          rollVal: dVal,
          title: `${combinedName}`,
          description: cleanDesc,
          type: 'art_gem',
          valuableName: combinedName,
          valuableVal: gearItem.cost || '1g'
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
      } else if (tableKey.startsWith('magic_')) {
        const rawRarity = tableKey.replace('magic_', '');
        const rarity = (rawRarity.toLowerCase() === 'artifact' || rawRarity.toLowerCase() === 'epic') ? 'Epic' : rawRarity;
        const item = await fetchRandomMagicItem(rarity);
        const badgeLabel = rarity === 'Minor' ? '🍺 Minor Relic' : rarity === 'Lesser' ? '🪄 Lesser Relic' : rarity === 'Greater' ? '✨ Greater Relic' : '💫 Epic Relic';
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey,
          tableName: badgeLabel,
          rollVal: 1,
          title: `${item.name}`,
          description: item.description || `Mystical ${rarity.toLowerCase()} relic.`,
          type: 'magic_item',
          magicItem: item
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
      } else if (tableKey === 'hardware') {
        const hw = await fetchRandomHardwareItem();
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey: 'hardware',
          categoryKey: 'hardware',
          tableName: '⚙️ Hardware Device',
          rollVal: 1,
          title: hw.name,
          description: hw.description || hw.effect || 'Advanced technological hardware item.',
          type: 'magic_item',
          magicItem: hw
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
      } else if (tableKey === 'chaos_gems') {
        const gem = await gameApi.getRandomChaosGem(activeGenre);
        if (gem) {
          const resObj: RollResult = {
            id: `res-${Date.now()}`,
            tableKey: 'chaos_gems',
            categoryKey: 'chaos_gems',
            tableName: '💎 Chaos Gem (Volatile)',
            rollVal: rollDice(20),
            title: gem.name,
            description: gem.effect || gem.notes || 'Volatile Chaos Gem. Must be socketed into your Gauntlet upon claiming or discarded.',
            type: 'chaos_gem',
            chaosGem: gem,
          };
          if (append) setResults(prev => [resObj, ...prev]);
          return resObj;
        }
        return null;
      } else if (tableKey === 'coins') {
        const evalC = evaluateCoins('2d6x10s+1d4g');
        const coinText = [evalC.silver > 0 ? `${evalC.silver}s` : '', evalC.gold > 0 ? `${evalC.gold}g` : ''].filter(Boolean).join(', ');
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey: 'coins',
          tableName: '🪙 Coins',
          rollVal: 1,
          title: `Coins 💰 (${coinText})`,
          description: 'A heavy leather coin pouch found among the loot.',
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
        const badgeLabel = tableKey === 'art_gems' ? '🎨 Art & Gems' : tableKey === 'curios' ? '📜 Curios' : '🗑️ Junk';
        const cleanDesc = entry ? (entry.notes || entry.result_name) : 'An interesting item found in the container.';
        
        const evalVal = tableKey === 'art_gems' && entry ? parseAndEvaluateFormula(entry.val_formula || '2d6g') : null;

        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey,
          categoryKey: tableKey,
          tableName: badgeLabel,
          rollVal: dVal,
          title: entry ? entry.result_name : 'Targeted Item',
          description: cleanDesc,
          type: tableKey === 'art_gems' ? 'art_gem' : tableKey === 'curios' ? 'document' : 'junk',
          valuableName: entry ? entry.result_name : 'Targeted Item',
          valuableVal: evalVal ? String(evalVal.value) : (entry ? entry.val_formula : '1g'),
          valuableCurrency: evalVal ? evalVal.currency : 'gp',
          valueText: evalVal ? evalVal.text : undefined
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

  // GM Hoard Presets
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

  // Claim Handlers
  const handleClaimChaosGem = async (res: RollResult) => {
    if (res.claimed) return;
    let gem = res.chaosGem;
    if (!gem) {
      const fetched = await gameApi.getRandomChaosGem(activeGenre);
      if (fetched) gem = fetched;
    }
    if (gem) {
      setSocketingItem({ res, gem });
    } else {
      showToast('Could not load Chaos Gem data.');
    }
  };

  const handleSocketSuccess = (gemName: string, slotLabel: string) => {
    if (socketingItem) {
      socketingItem.res.claimed = true;
      setResults([...results]);
      setSocketingItem(null);
      showToast(`💎 Socketed '${gemName}' into ${slotLabel}!`);
    }
  };

  const handleSocketCancel = () => {
    if (socketingItem) {
      socketingItem.res.claimed = true;
      setResults([...results]);
      setSocketingItem(null);
      showToast('💥 Volatile Chaos Gem was discarded and dissolved into cosmic dust.');
    }
  };

  const handleDropResult = (res: RollResult) => {
    if (res.claimed) return;
    res.claimed = true;
    setResults([...results]);
    showToast(`💥 Discarded '${res.title}'.`);
  };

  // Unified Claim Handler
  const claimMoveToSheet = async (res: RollResult) => {
    if (res.claimed) return;
    if (res.type === 'chaos_gem') {
      handleClaimChaosGem(res);
      return;
    }
    const ok = await onMoveToSheet({
      title: res.title,
      categoryKey: res.categoryKey || (res.type === 'art_gem' ? 'art_gems' : res.tableKey) || '',
      description: res.description,
      coinsSilver: res.coinsSilver,
      coinsGold: res.coinsGold,
      valuableVal: res.valuableVal,
      valuableCurrency: res.valuableCurrency || 'gp',
      magicItem: res.magicItem,
      type: res.type,
    });

    if (ok) {
      res.claimed = true;
      setResults([...results]);
      const isMagic = res.type === 'magic_item' || !!res.magicItem || (res.categoryKey && res.categoryKey.startsWith('magic_'));
      showToast(isMagic ? `✅ Saved '${res.title}' to ${characterName}'s Character Vault! (0 AP)` : `✅ Moved '${res.title}' to ${characterName}'s Sheet!`);
    } else {
      showToast(`❌ Failed to move '${res.title}' to Sheet.`);
    }
  };

  const handleRefineResult = (res: RollResult) => {
    if (res.claimed) return;

    let fillPercentage = 8; // Default / Minor / Standard drop

    if (res.type === 'chaos_gem') {
      fillPercentage = 15;
    } else if (res.tableName.includes('Lesser') || (res.type === 'magic_item' && !res.tableName.includes('Greater') && !res.tableName.includes('Epic') && !res.tableName.includes('Artifact'))) {
      fillPercentage = 12;
    } else if (res.tableName.includes('Greater')) {
      fillPercentage = 25;
    } else if (res.tableName.includes('Artifact') || res.tableName.includes('Epic')) {
      fillPercentage = 50;
    }

    const currentEssence = activeCharacter?.sheet_data?.essence_core || 0;
    const newEssence = Math.min(100, currentEssence + fillPercentage);

    updateActiveSheetData((prev) => ({
      ...prev,
      essence_core: newEssence,
    }));
    saveActiveCharacter();

    res.claimed = true;
    setResults([...results]);

    showToast(`⚡ Refined '${res.title}' into +${fillPercentage}% Essence (${newEssence}% Total)!`);

    if (newEssence >= 15) {
      if (newEssence >= 100) setLastDraftTier('Epic');
      else if (newEssence >= 50) setLastDraftTier('Greater');
      else if (newEssence >= 25) setLastDraftTier('Lesser');
      else setLastDraftTier('Minor');
    }
  };

  const handlePassResult = (res: RollResult) => {
    if (res.claimed) return;

    const partyId = activePartyId || 'default';
    const storageKey = `supaflex_party_echo_vault_${partyId}`;
    const existingVaultStr = localStorage.getItem(storageKey);
    const existingVault: VaultItem[] = existingVaultStr ? JSON.parse(existingVaultStr) : [];

    let tierRarity: 'Minor' | 'Lesser' | 'Greater' | 'Epic' = 'Lesser';
    if (res.tableName.includes('Minor')) tierRarity = 'Minor';
    if (res.tableName.includes('Greater')) tierRarity = 'Greater';
    if (res.tableName.includes('Artifact') || res.tableName.includes('Epic')) tierRarity = 'Epic';

    const newItem: VaultItem = {
      id: `vlt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: res.title,
      description: res.description,
      type: res.type,
      rarity: tierRarity,
      essenceValue: tierRarity === 'Minor' ? 8 : tierRarity === 'Lesser' ? 12 : tierRarity === 'Greater' ? 25 : 50,
      coinsSilver: res.coinsSilver,
      coinsGold: res.coinsGold,
      magicItem: res.magicItem,
      valuableName: res.valuableName,
      valuableVal: res.valuableVal,
      passedBy: characterName,
      timestamp: new Date().toISOString(),
    };

    const updatedVault = [newItem, ...existingVault];
    localStorage.setItem(storageKey, JSON.stringify(updatedVault));
    setPartyVault(updatedVault);

    res.claimed = true;
    setResults([...results]);
    showToast(`📥 Passed '${res.title}' to Party Echo Vault!`);
  };

  const handleSelectDraftReward = async (reward: { type: 'magic_item' | 'treasure'; data: any }) => {
    let categoryKey = 'magic_Lesser';
    if (reward.data?.type === 'coins') {
      categoryKey = 'coins';
    } else if (reward.type === 'treasure' || reward.data?.type === 'valuable') {
      categoryKey = 'art_gems';
    } else {
      categoryKey = lastDraftTier === 'Minor' ? 'magic_Minor' : lastDraftTier === 'Greater' ? 'magic_Greater' : lastDraftTier === 'Epic' ? 'magic_Epic' : 'magic_Lesser';
    }

    const ok = await onMoveToSheet({
      title: reward.data?.name || 'Draft Reward',
      categoryKey,
      description: reward.data?.description,
      coinsSilver: reward.data?.silver,
      coinsGold: reward.data?.gold,
      valuableVal: reward.data?.value,
      magicItem: reward.type === 'magic_item' ? reward.data : undefined,
      type: reward.type,
    });

    if (ok) {
      showToast(`✅ Claimed Draft Reward '${reward.data?.name || 'Reward'}' to Sheet!`);
    }

    const draftCost = lastDraftTier === 'Minor' ? 15 : lastDraftTier === 'Lesser' ? 25 : lastDraftTier === 'Greater' ? 50 : 100;
    updateActiveSheetData((prev) => ({
      ...prev,
      essence_core: Math.min(100, Math.max(0, (prev.essence_core || 0) - draftCost)),
    }));
    saveActiveCharacter();

    return ok;
  };

  const handleDeconstructDraft = () => {
    updateActiveSheetData((prev) => {
      const current = prev.essence_core || 0;
      const halved = Math.floor(current / 2);
      return {
        ...prev,
        essence_core: halved,
        pity_level: ((prev.pity_level || 0) + 1) % 3,
      };
    });
    saveActiveCharacter();
    showToast(`♻️ Draft Deconstructed! Essence cut in half.`);
  };

  const handleClaimVaultItem = async (item: VaultItem): Promise<boolean> => {
    let categoryKey = 'gear_quality';
    if (item.type === 'coins' || item.coinsSilver || item.coinsGold) categoryKey = 'coins';
    else if (item.magicItem) categoryKey = `magic_${item.rarity}`;
    else categoryKey = 'art_gems';

    const ok = await onMoveToSheet({
      title: item.title,
      categoryKey,
      description: item.description,
      coinsSilver: item.coinsSilver,
      coinsGold: item.coinsGold,
      valuableVal: item.valuableVal,
      magicItem: item.magicItem,
      type: item.type,
    });

    if (ok) {
      const partyId = activePartyId || 'default';
      const storageKey = `supaflex_party_echo_vault_${partyId}`;
      const updated = partyVault.filter((v) => v.id !== item.id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setPartyVault(updated);
      showToast(`✅ Claimed '${item.title}' from Echo Vault!`);
    }
    return ok;
  };

  const handleTriggerRestSweep = async () => {
    if (partyVault.length === 0) return;
    const partyId = activePartyId || 'default';
    const storageKey = `supaflex_party_echo_vault_${partyId}`;
    const totalEssence = partyVault.reduce((acc, item) => acc + (item.essenceValue || 25), 0);
    const share = Math.round(totalEssence / 4);

    updateActiveSheetData((prev) => ({
      ...prev,
      essence_core: Math.min(100, (prev.essence_core || 0) + share),
    }));

    localStorage.removeItem(storageKey);
    setPartyVault([]);
    showToast(`🔥 Rest Sweep Completed! +${share}% Essence deposited to all party members!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-sm font-bold text-center animate-bounce shrink-0">
            {toastMessage}
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h2 className="text-xl font-bold text-amber-400">Loot Generator</h2>
              <p className="text-xs text-slate-400">Master Blueprint Two-Pane Interactive Loot Engine</p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body: Two-Pane Master Blueprint Grid with Independent Pane Scrollbars */}
        <div className="flex-1 p-6 bg-slate-900/40 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden min-h-0">
          
          {/* LEFT PANE (md:col-span-7): Generated Loot Results Stream (Independent Scroll) */}
          <div className="md:col-span-7 flex flex-col h-full border-b md:border-b-0 md:border-r border-slate-800/80 md:pr-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 shrink-0 mb-3">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span>📜</span> Generated Loot Stream ({results.length})
              </span>
              {results.length > 0 && (
                <button 
                  onClick={() => setResults([])} 
                  className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 font-semibold text-xs px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>🗑️</span> Clear History
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                <span className="text-4xl mb-3">🎲</span>
                <p className="text-sm font-semibold text-slate-400">No loot generated yet.</p>
                <p className="text-xs text-slate-500 mt-1">Use the control panel on the right to roll!</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {results.map((res) => (
                  <div 
                    key={res.id} 
                    className={`p-3 rounded-xl border transition-all ${
                      res.claimed 
                        ? 'bg-slate-950/60 border-slate-800 opacity-60' 
                        : 'bg-slate-800/80 border-slate-700/80 hover:border-amber-500/50 shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left Column: Line 1 Badges, Line 2 Title (Wrapping), Line 3 Description */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        {/* Line 1: Category & Value Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-950 border border-slate-700 text-amber-400 shadow-sm shrink-0">
                            {res.tableName}
                          </span>
                          {res.valueText && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/40 text-amber-300 shadow-sm flex items-center gap-1 shrink-0">
                              <span>💎</span>
                              <span className="font-mono font-extrabold">{res.valueText}</span>
                            </span>
                          )}
                        </div>

                        {/* Line 2: Item Title (Always below badges, full wrap) */}
                        <h4 className="text-sm font-bold text-slate-100 leading-snug break-words">
                          {res.title}
                        </h4>

                        {/* Line 3: Description */}
                        {res.description && (
                          <p className="text-[11px] text-slate-300 leading-snug font-sans break-words">
                            {res.description}
                          </p>
                        )}
                      </div>

                      {/* Right Column: 1-Click Action Buttons (Strictly Top-Aligned) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-start pt-0.5">
                        {res.claimed ? (
                          <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            ✅ Claimed
                          </span>
                        ) : res.type === 'chaos_gem' ? (
                          <>
                            <button
                              onClick={() => handleClaimChaosGem(res)}
                              className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer border border-violet-400/40"
                              title="Socket volatile Chaos Gem into Gauntlet conduit"
                            >
                              <span>💎</span>
                              <span>Socket</span>
                            </button>

                            <button
                              onClick={() => handleRefineResult(res)}
                              className="bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-xs font-bold px-2 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Disenchant loot drop into personal Essence Core (+15%)"
                            >
                              🧪 Disenchant
                            </button>

                            <button
                              onClick={() => handlePassResult(res)}
                              className="bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 text-xs font-bold px-2 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Pass item to Party Echo Vault for off-turn/rest claiming"
                            >
                              ➡️ Party
                            </button>

                            <button
                              onClick={() => handleDropResult(res)}
                              className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-xs font-bold px-2 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Drop and destroy volatile gem"
                            >
                              💥 Drop
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => claimMoveToSheet(res)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center justify-center cursor-pointer"
                              title="Claim item to character sheet"
                            >
                              Claim
                            </button>

                            {/* 🧪 Disenchant & ➡️ Party Buttons */}
                            <button
                              onClick={() => handleRefineResult(res)}
                              className="bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-xs font-bold px-2 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Disenchant loot drop into personal Essence Core (+8% to +50%)"
                            >
                              🧪 Disenchant
                            </button>
                            <button
                              onClick={() => handlePassResult(res)}
                              className="bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 text-xs font-bold px-2 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Pass item to Party Echo Vault for off-turn/rest claiming"
                            >
                              ➡️ Party
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT PANE (md:col-span-5): Alchemy Essence Flask & Dual Tab Controls (Independent Scroll) */}
          <div className="md:col-span-5 flex flex-col h-full space-y-4 overflow-y-auto pr-1">
            
            {/* Position #1: Right Pane Tab Navigation Bar */}
            <div className="flex border-b border-slate-800 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setActiveRightTab('GENERATOR')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeRightTab === 'GENERATOR'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                🎲 Generator
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('VAULT')}
                className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeRightTab === 'VAULT'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📥 Party Vault ({partyVault.length})
              </button>
            </div>

            {/* TAB 1: GENERATOR CONTROLS */}
            {activeRightTab === 'GENERATOR' && (
              <div className="space-y-4 flex-1">
                {/* Position #2: Alchemy Essence Flask Visual Component with Tier-Threshold Craft Button */}
                {(() => {
                  const qualifiedTier: { name: 'Minor' | 'Lesser' | 'Greater' | 'Epic'; cost: number } | null =
                    essenceCore >= 100
                      ? { name: 'Epic', cost: 100 }
                      : essenceCore >= 50
                      ? { name: 'Greater', cost: 50 }
                      : essenceCore >= 25
                      ? { name: 'Lesser', cost: 25 }
                      : essenceCore >= 15
                      ? { name: 'Minor', cost: 15 }
                      : null;

                  return (
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shadow-inner shrink-0">
                      <div className="flex items-center gap-3">
                        {/* Visual Flask / Vial */}
                        <div
                          onClick={() => {
                            if (qualifiedTier) {
                              setLastDraftTier(qualifiedTier.name);
                              setIsDraftOpen(true);
                            }
                          }}
                          className={`relative w-9 h-14 rounded-b-full border-2 bg-slate-900 overflow-hidden flex flex-col justify-end transition-all shadow-lg shrink-0 ${
                            qualifiedTier
                              ? 'border-amber-400 shadow-amber-500/50 animate-pulse cursor-pointer'
                              : 'border-slate-700'
                          }`}
                          title={qualifiedTier ? `Click to draft a ${qualifiedTier.name} relic!` : 'Disenchant loot drops to fill Essence Flask'}
                        >
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-1.5 bg-slate-800 border-b border-slate-700 z-10"></div>
                          <div
                            className="w-full bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-300 transition-all duration-700 ease-out relative"
                            style={{ height: `${Math.min(100, Math.max(0, essenceCore))}%` }}
                          >
                            <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 animate-pulse"></div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Essence</h4>
                            {qualifiedTier && (
                              <span className="text-[9px] bg-amber-400 text-slate-950 font-extrabold px-1.5 py-0.2 rounded uppercase animate-bounce">
                                {qualifiedTier.name} Qualified!
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5 font-mono font-bold">
                            {essenceCore}% Full
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {qualifiedTier ? `Craft ${qualifiedTier.name} (${qualifiedTier.cost}% essence)` : 'Disenchant items to fill flask'}
                          </p>
                        </div>
                      </div>

                      {qualifiedTier && (
                        <button
                          onClick={() => {
                            setLastDraftTier(qualifiedTier.name);
                            setIsDraftOpen(true);
                          }}
                          className="bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md shadow-amber-500/20 animate-pulse cursor-pointer shrink-0 flex items-center gap-1"
                        >
                          <span>✨</span>
                          <span>Craft {qualifiedTier.name}</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Mode Switcher Multi-Option Pill Switch */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0">
                  <button
                    type="button"
                    onClick={() => handleModeToggle(false)}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isGmMode
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🛡️ Player Single Roll
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeToggle(true)}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isGmMode
                        ? 'bg-indigo-600 text-white font-extrabold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    👑 GM Hoard Mode
                  </button>
                </div>

                {/* GM Hoard Mode Section */}
                {isGmMode && (
                  <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300">👑 GM Hoard Generator Presets:</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        disabled={isRolling}
                        onClick={() => handleGmHoardPreset('minion')}
                        className="bg-indigo-900/50 hover:bg-indigo-800/70 border border-indigo-700 text-indigo-200 py-2 px-3 rounded-lg font-semibold text-xs transition-all text-left"
                      >
                        🐀 Minion Corpse (Coins + Junk)
                      </button>
                      <button
                        disabled={isRolling}
                        onClick={() => handleGmHoardPreset('boss')}
                        className="bg-indigo-900/70 hover:bg-indigo-700/80 border border-indigo-600 text-indigo-100 py-2 px-3 rounded-lg font-semibold text-xs transition-all text-left"
                      >
                        🛡️ Elite Boss Chest (Coins + Gem + Lesser)
                      </button>
                      <button
                        disabled={isRolling}
                        onClick={() => handleGmHoardPreset('dragon')}
                        className="bg-amber-600/30 hover:bg-amber-500/40 border border-amber-500/60 text-amber-200 py-2 px-3 rounded-lg font-semibold text-xs transition-all text-left"
                      >
                        🐉 Dragon Vault (Master + Greater + Artifact)
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Action Button: Image 1 Style "🎲 Random Loot" */}
                <div className="space-y-2 shrink-0">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Primary Master Engine
                  </span>
                  <button
                    disabled={isRolling}
                    onClick={handleRollMasterD100}
                    className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-extrabold py-3.5 px-6 rounded-xl text-base transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 border border-amber-300/40 cursor-pointer"
                  >
                    <span className="text-xl">🎲</span>
                    <span>Random Loot</span>
                  </button>
                </div>

                {/* Category Dropdown & Adjacent "Roll" Button */}
                <div className="space-y-2 pt-2 border-t border-slate-800 shrink-0">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Targeted Sub-Table Launcher
                  </span>
                  <div className="flex gap-2">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-amber-400"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={isRolling}
                      onClick={() => handleTargetedRoll(selectedCategory)}
                      className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0"
                    >
                      <span>🎲</span>
                      <span>Roll</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EMBEDDED PARTY VAULT */}
            {activeRightTab === 'VAULT' && (
              <div className="space-y-3 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 shrink-0">
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📥</span> Shared Party Echo Stash
                  </span>
                  {partyVault.length > 0 && (
                    <button
                      onClick={handleTriggerRestSweep}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                      title="Convert all remaining vault items into equal party Essence"
                    >
                      <span>🔥</span>
                      <span>Rest Sweep</span>
                    </button>
                  )}
                </div>

                {partyVault.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl bg-slate-950/30 text-center p-4">
                    <span className="text-3xl mb-2">📥</span>
                    <p className="text-xs font-semibold text-slate-400">Party Vault is Empty</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Items passed by party members during encounters will appear here for off-turn claiming!
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    {partyVault.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-all flex items-start justify-between gap-3 shadow-md"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                              {item.rarity} (+{item.essenceValue}%)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">from {item.passedBy}</span>
                          </div>
                          <h5 className="text-xs font-bold text-slate-100">{item.title}</h5>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
                        </div>

                        <button
                          onClick={() => handleClaimVaultItem(item)}
                          className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all shadow-md shrink-0 cursor-pointer"
                        >
                          Claim
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Modal Footer Status Bar with Standardized "Done" Button */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>Hero: <strong className="text-slate-200">{characterName}</strong></span>
            <span>•</span>
            <span>Wallet: <strong className="text-amber-300">{currentSilver}s</strong>, <strong className="text-amber-400">{currentGold}g</strong></span>
          </div>
          
          {/* Standardized Master Blueprint Done Footer Button */}
          <button 
            onClick={onClose} 
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>

      {/* 3-Card Smart Draft Modal */}
      <LootDraftModal
        isOpen={isDraftOpen}
        onClose={() => setIsDraftOpen(false)}
        characterName={characterName}
        draftTier={lastDraftTier}
        starredItemIds={starredItemIds}
        stockMagicItems={magicItems}
        onSelectReward={handleSelectDraftReward}
        onDeconstructDraft={handleDeconstructDraft}
      />

      {/* Async Echo Vault Modal */}
      <EchoVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        characterName={characterName}
        vaultItems={partyVault}
        onClaimVaultItem={handleClaimVaultItem}
        onTriggerRestSweep={handleTriggerRestSweep}
      />

      {/* Volatile Chaos Gauntlet Socketing Modal */}
      <ChaosGauntletSocketModal
        isOpen={!!socketingItem}
        incomingGem={socketingItem?.gem || null}
        onClose={handleSocketCancel}
        onSocketSuccess={handleSocketSuccess}
      />
    </div>
  );
};
