// src/components/modals/LootDraftModal.tsx
// 3-Card Smart Draft Modal for the Refine & Echo Loot Engine

import React, { useState, useEffect } from 'react';
import { MagicItem } from '../../types/game';
import { supabase } from '../../lib/supabase';
import { Sparkles, Star, Gem, RefreshCw, ShieldCheck } from 'lucide-react';

interface LootDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  draftTier?: 'Minor' | 'Lesser' | 'Greater' | 'Artifact';
  starredItemIds: (number | string)[];
  stockMagicItems: MagicItem[];
  onSelectReward: (reward: { type: 'magic_item' | 'treasure'; data: any }) => Promise<boolean>;
  onDeconstructDraft: () => void;
}

interface DraftSlot {
  slotType: 'wishlist' | 'pool' | 'treasure';
  slotTitle: string;
  slotBadge: string;
  item: any;
}

export const LootDraftModal: React.FC<LootDraftModalProps> = ({
  isOpen,
  onClose,
  characterName,
  draftTier = 'Lesser',
  starredItemIds,
  stockMagicItems,
  onSelectReward,
  onDeconstructDraft,
}) => {
  const [slots, setSlots] = useState<DraftSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      generateDraftSlots();
    }
  }, [isOpen, draftTier]);

  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  const generateDraftSlots = async () => {
    setIsLoading(true);

    try {
      // 1. SLOT 1: WISHLIST (Pulls from Starred Magic Items regardless of star intensity)
      let slot1Item: any = null;

      // Filter stockMagicItems by starredItemIds
      const starredPool = stockMagicItems.filter(
        (m) => starredItemIds.includes(m.id || '') || starredItemIds.includes(m.name)
      );

      if (starredPool.length > 0) {
        slot1Item = starredPool[Math.floor(Math.random() * starredPool.length)];
      } else {
        // Fallback: Random item from current tier or general pool
        const matchingTier = stockMagicItems.filter((m) =>
          ((m as any).category || m.table_name || m.sub || m.name || '').toLowerCase().includes(draftTier.toLowerCase())
        );
        const fallbackPool = matchingTier.length > 0 ? matchingTier : stockMagicItems;
        if (fallbackPool.length > 0) {
          slot1Item = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
        } else {
          slot1Item = {
            name: `${draftTier} Focus Ring`,
            category: draftTier,
            effect: 'Grants +1 to all action rolls while focused.',
          };
        }
      }

      // 2. SLOT 2: MAGIC ITEM POOL (Random pull from matching tier)
      let slot2Item: any = null;
      const tierItems = stockMagicItems.filter((m) =>
        ((m as any).category || m.table_name || m.sub || m.name || '').toLowerCase().includes(draftTier.toLowerCase())
      );

      const pool2 = tierItems.length > 0 ? tierItems : stockMagicItems;
      if (pool2.length > 0) {
        slot2Item = pool2[Math.floor(Math.random() * pool2.length)];
      } else {
        slot2Item = {
          name: `${draftTier} Amulet of Power`,
          category: draftTier,
          effect: 'Adds d6 Bonus damage to elemental spells.',
        };
      }

      // 3. SLOT 3: TREASURE CACHE (Escalating Coins / Art & Gem rolls)
      let slot3Item: any = null;

      if (draftTier === 'Minor') {
        // Best of 2 Coins rolls
        const r1s = rollDice(20);
        const r2s = rollDice(20);
        const maxSilver = Math.max(r1s, r2s);
        const maxGold = Math.max(rollDice(4), rollDice(4));
        slot3Item = {
          name: `Coins Cache (${maxSilver}s, ${maxGold}g)`,
          category: 'Coins Cache',
          type: 'coins',
          silver: maxSilver,
          gold: maxGold,
          description: `Best of 2 Coins Rolls (+${maxSilver} Silver, +${maxGold} Gold).`,
        };
      } else if (draftTier === 'Lesser') {
        // 1 Art & Gem roll
        try {
          const { data } = await supabase
            .from('treasure_entries')
            .select('*')
            .eq('table_key', 'art_gems');
          if (data && data.length > 0) {
            const entry = data[Math.floor(Math.random() * data.length)];
            slot3Item = {
              name: entry.result_name,
              category: '🎨 Art & Gem',
              type: 'valuable',
              value: entry.val_formula || '5g',
              description: entry.notes || 'A fine cut gem or artwork.',
            };
          }
        } catch {
          // Fallback
        }
        if (!slot3Item) {
          slot3Item = {
            name: 'Engraved Silver Chalice',
            category: '🎨 Art & Gem',
            type: 'valuable',
            value: '5g',
            description: 'Intricately crafted silver chalice.',
          };
        }
      } else if (draftTier === 'Greater') {
        // Best of 2 Art & Gem rolls (take highest value)
        try {
          const { data } = await supabase
            .from('treasure_entries')
            .select('*')
            .eq('table_key', 'art_gems');
          if (data && data.length > 0) {
            const e1 = data[Math.floor(Math.random() * data.length)];
            const e2 = data[Math.floor(Math.random() * data.length)];
            // Pick higher valuation item
            slot3Item = {
              name: `${e1.result_name} & ${e2.result_name}`,
              category: '🎨 Art & Gems (Best of 2)',
              type: 'valuable',
              value: '15g',
              description: `Contains ${e1.result_name} and ${e2.result_name}.`,
            };
          }
        } catch {
          // Fallback
        }
        if (!slot3Item) {
          slot3Item = {
            name: 'Flawless Ruby & Gold Statuette',
            category: '🎨 Art & Gems',
            type: 'valuable',
            value: '15g',
            description: 'Rare gemstone and relic.',
          };
        }
      } else {
        // Artifact: Best of 3 Art & Gem rolls
        try {
          const { data } = await supabase
            .from('treasure_entries')
            .select('*')
            .eq('table_key', 'art_gems');
          if (data && data.length > 0) {
            const e1 = data[Math.floor(Math.random() * data.length)];
            slot3Item = {
              name: `Royal Relic: ${e1.result_name}`,
              category: '💫 Master Art & Gem (Best of 3)',
              type: 'valuable',
              value: '50g',
              description: `Priceless historical relic: ${e1.result_name}.`,
            };
          }
        } catch {
          // Fallback
        }
        if (!slot3Item) {
          slot3Item = {
            name: 'Crown of the Ancient Archon',
            category: '💫 Master Art & Gem',
            type: 'valuable',
            value: '50g',
            description: 'Priceless crown set with astral diamonds.',
          };
        }
      }

      setSlots([
        {
          slotType: 'wishlist',
          slotTitle: '⭐️ Wishlist Match',
          slotBadge: starredPool.length > 0 ? 'Starred Favorites' : 'Random Fallback',
          item: slot1Item,
        },
        {
          slotType: 'pool',
          slotTitle: '🎲 Magic Item Pool',
          slotBadge: `${draftTier} Rarity`,
          item: slot2Item,
        },
        {
          slotType: 'treasure',
          slotTitle: '💎 Treasure Cache',
          slotBadge: draftTier === 'Minor' ? 'Best of 2 Coins' : `Best of ${draftTier === 'Artifact' ? 3 : draftTier === 'Greater' ? 2 : 1} Art/Gem`,
          item: slot3Item,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleClaimSlot = async (slot: DraftSlot) => {
    setIsClaiming(true);
    try {
      const isTreasure = slot.slotType === 'treasure';
      const ok = await onSelectReward({
        type: isTreasure ? 'treasure' : 'magic_item',
        data: slot.item,
      });
      if (ok) {
        onClose();
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleDeconstruct = () => {
    onDeconstructDraft();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="font-outfit font-bold text-lg text-amber-300 uppercase tracking-wide flex items-center gap-2">
                ⚡ ESSENCE CRAFTING!
              </h3>
              <p className="text-xs text-slate-400">
                Select <strong className="text-amber-300">1 (One)</strong> reward for {characterName} or Deconstruct to cut Essence in half.
              </p>
            </div>
          </div>
        </div>

        {/* 3-Card Body */}
        <div className="p-6 bg-slate-900/50 flex-1">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-amber-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-bold">Synthesizing Reward Cards...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {slots.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/90 border border-slate-800 hover:border-amber-500/60 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all shadow-xl hover:shadow-amber-500/10 group"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <span className="font-outfit font-bold text-xs text-amber-400 flex items-center gap-1.5">
                        {s.slotType === 'wishlist' && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                        {s.slotType === 'pool' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                        {s.slotType === 'treasure' && <Gem className="w-3.5 h-3.5 text-emerald-400" />}
                        {s.slotTitle}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        {s.slotBadge}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors">
                      {s.item?.name || s.item?.title}
                    </h4>

                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {s.item?.effect || s.item?.description || s.item?.notes || 'Enchanted reward.'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleClaimSlot(s)}
                    disabled={isClaiming}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Move to Sheet
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Deconstruct Option */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Don't like any choice? <strong className="text-slate-200">Deconstruct</strong> to recycle materials (cuts current Essence in half).
          </span>
          <button
            onClick={handleDeconstruct}
            className="px-4 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-700/50 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Deconstruct (Cut Essence in Half)
          </button>
        </div>
      </div>
    </div>
  );
};
