import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Sparkles, Archive } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { LootDraftModal } from './LootDraftModal';
import { EchoVaultModal } from './EchoVaultModal';
import { VaultItem } from '../../types/game';

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

export const CATEGORY_OPTIONS = [
  { key: 'coins', label: '🪙 Coins (s/g)' },
  { key: 'magic_Minor', label: '🍺 Minor Magic Item' },
  { key: 'magic_Lesser', label: '🪄 Lesser Magic Item' },
  { key: 'magic_Greater', label: '✨ Greater Magic Item' },
  { key: 'magic_Artifact', label: '💫 Artifact Magic Item' },
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
  onClaimCoins,
  onClaimMagicItem,
  onClaimValuable
}) => {
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const magicItems = useCharacterStore((state) => state.magicItems);
  const activePartyId = useCharacterStore((state) => state.activePartyId);

  const [isGmMode, setIsGmMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('coins');
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<RollResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [lastDraftTier, setLastDraftTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Artifact'>('Lesser');
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
    try {
      const { data, error } = await supabase
        .from('magic_items')
        .select('*')
        .or(`sub.ilike.%${rarity}%,table_name.ilike.%${rarity}%`);
      
      if (error || !data || data.length === 0) {
        const { data: tierFallback } = await supabase
          .from('magic_items')
          .select('*')
          .ilike('sub', `%${rarity}%`);
        
        if (tierFallback && tierFallback.length > 0) {
          return tierFallback[Math.floor(Math.random() * tierFallback.length)];
        }
        return { name: `${rarity} Magic Item`, sub: rarity, description: 'Mystical artifact of power.' };
      }

      return data[Math.floor(Math.random() * data.length)];
    } catch {
      return { name: `${rarity} Magic Focus`, sub: rarity, description: 'Enchanted magic focus.' };
    }
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

  // Master d100 Roll Handler
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
            tableKey: 'master_d100',
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
            tableKey: 'master_d100',
            tableName: '🪙 Coins',
            rollVal: d100,
            title: `Coins 💰 (${coinText || '0s'})`,
            description: 'A small leather pouch containing minted currency.',
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
            tableName: `✨ ${rarity} Magic Item`,
            rollVal: d100,
            title: `${item.name}`,
            description: item.description || item.notes || `Mystical ${item.category} item.`,
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
          const badgeLabel = subKey === 'art_gems' ? '🎨 Art & Gems' : subKey === 'curios' ? '📜 Curio' : '🗑️ Junk';
          const cleanDesc = subEntry ? (subEntry.notes || subEntry.result_name) : (entry.notes || 'A rare collectible item.');
          resList.push({
            id: `res-${Date.now()}`,
            tableKey: 'master_d100',
            tableName: badgeLabel,
            rollVal: d100,
            title: subEntry ? subEntry.result_name : entry.result_name,
            description: cleanDesc,
            type: rType === 'art_gem' ? 'art_gem' : 'junk',
            valuableName: subEntry ? subEntry.result_name : entry.result_name,
            valuableVal: subEntry ? subEntry.val_formula : '1g'
          });
        } else if (rType === 'special') {
          if (entry.range_min >= 96 && entry.range_min <= 99) {
            const r1 = await handleTargetedRoll('art_gems', false);
            const r2 = await fetchRandomMagicItem('Lesser');
            if (r1) resList.push(r1);
            resList.push({
              id: `res-${Date.now()}-2`,
              tableKey: 'master_d100',
              tableName: '🪄 Double Roll Magic',
              rollVal: d100,
              title: `${r2.name}`,
              description: r2.description || `Enchanted magic item.`,
              type: 'magic_item',
              magicItem: r2
            });
          } else {
            const artItem = await fetchRandomMagicItem('Artifact');
            const evalC = evaluateCoins('1d100g');
            resList.push({
              id: `res-${Date.now()}-epic1`,
              tableKey: 'master_d100',
              tableName: '💫 Artifact Magic Item',
              rollVal: 100,
              title: `${artItem.name}`,
              description: artItem.description || 'Legendary artifact of massive power.',
              type: 'magic_item',
              magicItem: artItem
            });
            resList.push({
              id: `res-${Date.now()}-epic2`,
              tableKey: 'master_d100',
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
        const rarity = tableKey.replace('magic_', '');
        const item = await fetchRandomMagicItem(rarity);
        const badgeLabel = rarity === 'Minor' ? '🍺 Minor Magic' : rarity === 'Lesser' ? '🪄 Lesser Magic' : rarity === 'Greater' ? '✨ Greater Magic' : '💫 Artifact';
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey,
          tableName: badgeLabel,
          rollVal: 1,
          title: `${item.name}`,
          description: item.description || `Mystical ${rarity.toLowerCase()} magic item.`,
          type: 'magic_item',
          magicItem: item
        };
        if (append) setResults(prev => [resObj, ...prev]);
        return resObj;
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
        const resObj: RollResult = {
          id: `res-${Date.now()}`,
          tableKey,
          tableName: badgeLabel,
          rollVal: dVal,
          title: entry ? entry.result_name : 'Targeted Item',
          description: cleanDesc,
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

  const handleRefineResult = (res: RollResult) => {
    if (res.claimed) return;

    let fillPercentage = 15;
    let tierRarity: 'Minor' | 'Lesser' | 'Greater' | 'Artifact' = 'Minor';

    if (res.tableName.includes('Lesser') || res.type === 'magic_item') {
      fillPercentage = 25;
      tierRarity = 'Lesser';
    }
    if (res.tableName.includes('Greater')) {
      fillPercentage = 50;
      tierRarity = 'Greater';
    }
    if (res.tableName.includes('Artifact') || res.tableName.includes('Epic')) {
      fillPercentage = 100;
      tierRarity = 'Artifact';
    }

    const currentEssence = activeCharacter?.sheet_data?.essence_core || 0;
    const newEssence = Math.min(100, currentEssence + fillPercentage);

    updateActiveSheetData((prev) => ({
      ...prev,
      essence_core: newEssence,
    }));

    res.claimed = true;
    setResults([...results]);

    showToast(`⚡ Refined '${res.title}' into +${fillPercentage}% Essence (${newEssence}% Total)!`);

    if (newEssence >= 100) {
      setLastDraftTier(tierRarity);
      setIsDraftOpen(true);
    }
  };

  const handlePassResult = (res: RollResult) => {
    if (res.claimed) return;

    const partyId = activePartyId || 'default';
    const storageKey = `supaflex_party_echo_vault_${partyId}`;
    const existingVaultStr = localStorage.getItem(storageKey);
    const existingVault: VaultItem[] = existingVaultStr ? JSON.parse(existingVaultStr) : [];

    let tierRarity: 'Minor' | 'Lesser' | 'Greater' | 'Artifact' = 'Lesser';
    if (res.tableName.includes('Minor')) tierRarity = 'Minor';
    if (res.tableName.includes('Greater')) tierRarity = 'Greater';
    if (res.tableName.includes('Artifact')) tierRarity = 'Artifact';

    const newItem: VaultItem = {
      id: `vlt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: res.title,
      description: res.description,
      type: res.type,
      rarity: tierRarity,
      essenceValue: tierRarity === 'Minor' ? 15 : tierRarity === 'Lesser' ? 25 : tierRarity === 'Greater' ? 50 : 100,
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
    if (reward.data?.type === 'coins') {
      const s = reward.data.silver || 0;
      const g = reward.data.gold || 0;
      await onClaimCoins(s, g);
      showToast(`✅ Claimed Draft Reward +${s}s, +${g}g!`);
    } else if (reward.type === 'treasure' || reward.data?.type === 'valuable') {
      const name = reward.data.name || 'Valuable Treasure';
      const val = reward.data.value || '10g';
      await onClaimValuable(name, val);
      showToast(`✅ Claimed Draft Reward '${name}' (${val})!`);
    } else {
      await onClaimMagicItem(reward.data, false);
      showToast(`✅ Claimed Draft Reward '${reward.data.name}'!`);
    }

    updateActiveSheetData((prev) => ({
      ...prev,
      essence_core: Math.max(0, (prev.essence_core || 0) - 100),
    }));

    return true;
  };

  const handleDeconstructDraft = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      essence_core: Math.min(100, (prev.essence_core || 0) - 75),
      pity_level: ((prev.pity_level || 0) + 1) % 3,
    }));
    showToast(`♻️ Draft Deconstructed! +25% Essence refunded to Core.`);
  };

  const handleClaimVaultItem = async (item: VaultItem): Promise<boolean> => {
    let ok = false;
    if (item.type === 'coins') {
      ok = await onClaimCoins(item.coinsSilver || 0, item.coinsGold || 0);
    } else if (item.magicItem) {
      ok = await onClaimMagicItem(item.magicItem, false);
    } else {
      ok = await onClaimValuable(item.title, item.valuableVal || '5g');
    }

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

          <div className="flex items-center gap-3">
            {/* Essence Core Meter */}
            <button
              type="button"
              onClick={() => {
                if (essenceCore >= 100) setIsDraftOpen(true);
              }}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono font-bold text-xs transition-all shadow-md ${
                essenceCore >= 100
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse cursor-pointer'
                  : 'bg-slate-950/80 border-slate-700 text-amber-300'
              }`}
              title={essenceCore >= 100 ? 'Click to trigger 3-Card Draft!' : 'Refine unwanted loot to fill Essence Core'}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Core: {essenceCore}%</span>
              {essenceCore >= 100 && (
                <span className="text-[10px] bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded uppercase font-sans">
                  Draft Ready!
                </span>
              )}
            </button>

            {/* Echo Vault Button */}
            <button
              type="button"
              onClick={() => setIsVaultOpen(true)}
              className="px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/40 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              title="Open Party Shared Echo Vault"
            >
              <Archive className="w-4 h-4 text-cyan-400" />
              <span>Vault ({partyVault.length})</span>
            </button>

            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors ml-2"
            >
              ×
            </button>
          </div>
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
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
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
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-700 text-amber-400 shadow-sm">
                            {res.tableName}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-100">{res.title}</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{res.description}</p>
                      </div>

                      {/* 1-Click Claim & Refine Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {res.claimed ? (
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-800 px-3 py-1 rounded-lg">
                            ✓ Claimed / Refined
                          </span>
                        ) : (
                          <>
                            {res.type === 'coins' && (
                              <button
                                onClick={() => claimCoins(res)}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-amber-500/20"
                              >
                                🪙 +Add Coins
                              </button>
                            )}

                            {res.type === 'magic_item' && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => claimMagicItem(res, false)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
                                >
                                  🎒 Inventory
                                </button>
                                <button
                                  onClick={() => claimMagicItem(res, true)}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
                                >
                                  ⚔️ Equip
                                </button>
                              </div>
                            )}

                            {(res.type === 'art_gem' || res.type === 'junk' || res.type === 'document') && (
                              <button
                                onClick={() => claimValuable(res)}
                                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                              >
                                💎 +Add Valuables
                              </button>
                            )}

                            {/* ⚡ Refine & 📥 Pass Buttons */}
                            <button
                              onClick={() => handleRefineResult(res)}
                              className="bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 text-xs font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Disenchant loot drop into personal Essence Core (+15% to +100%)"
                            >
                              ⚡ Refine
                            </button>
                            <button
                              onClick={() => handlePassResult(res)}
                              className="bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 text-xs font-bold px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                              title="Pass item to Party Echo Vault for off-turn/rest claiming"
                            >
                              📥 Pass
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

          {/* RIGHT PANE (md:col-span-5): Control Panel & Roll Launchers (Independent Scroll) */}
          <div className="md:col-span-5 flex flex-col h-full space-y-5 overflow-y-auto pr-1">
            
            {/* Mode Switcher Peg Slider */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between shrink-0">
              <span className={`text-xs font-bold transition-opacity ${!isGmMode ? 'text-amber-400 opacity-100' : 'text-slate-500 opacity-50'}`}>
                Player Single Roll
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isGmMode} 
                  onChange={(e) => handleModeToggle(e.target.checked)}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-amber-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
              <span className={`text-xs font-bold transition-opacity ${isGmMode ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-50'}`}>
                GM Hoard Mode
              </span>
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
    </div>
  );
};
