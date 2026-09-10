// src/components/modals/LootDraftModal.tsx
// 3-Card Smart Draft Modal for the Refine & Echo Loot Engine

import React, { useState, useEffect } from 'react';
import { MagicItem } from '../../types/game';
import { supabase } from '../../lib/supabase';
import { Sparkles, Gem, RefreshCw, ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { resolveLootAbilities, ACTION_BADGE_COLORS } from '../../utils/lootAbilityResolver';

interface LootDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  draftTier?: 'Minor' | 'Lesser' | 'Greater' | 'Epic';
  stockMagicItems: MagicItem[];
  onSelectReward: (reward: { type: 'magic_item' | 'treasure'; data: any }) => Promise<boolean>;
  onDeconstructDraft: () => void;
}

interface DraftSlot {
  slotType: 'artifact' | 'treasure';
  slotTitle: string;
  slotBadge: string;
  item: any;
}

export const LootDraftModal: React.FC<LootDraftModalProps> = ({
  isOpen,
  onClose,
  characterName,
  draftTier = 'Lesser',
  stockMagicItems,
  onSelectReward,
  onDeconstructDraft,
}) => {
  const functionsCatalog = useCharacterStore((state) => state.functionsCatalog);
  const modsCatalog = useCharacterStore((state) => state.modsCatalog);
  const [slots, setSlots] = useState<DraftSlot[]>([]);
  const [expandedSlots, setExpandedSlots] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  const toggleExpandSlot = (index: number) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  useEffect(() => {
    if (isOpen) {
      generateDraftSlots();
    }
  }, [isOpen, draftTier]);

  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  const generateDraftSlots = async () => {
    setIsLoading(true);

    try {
      // 1. Filter matching tier items
      const tierItems = stockMagicItems.filter((m) =>
        ((m as any).category || m.name || '').toLowerCase().includes(draftTier.toLowerCase())
      );
      const pool = tierItems.length > 0 ? tierItems : stockMagicItems;

      // 2. SLOT 1: PRIMARY ARTIFACT (Arcane Artifact)
      let slot1Item: any = null;
      if (pool.length > 0) {
        slot1Item = pool[Math.floor(Math.random() * pool.length)];
      } else {
        slot1Item = {
          name: `${draftTier} Focus Ring`,
          category: draftTier,
          effect: 'Grants +1 to all action rolls while focused.',
        };
      }

      // 3. SLOT 2: SECONDARY ARTIFACT (Mystic Artifact - distinct from Slot 1 if pool allows)
      let slot2Item: any = null;
      const pool2Candidates = pool.filter((m) =>
        slot1Item && (m.id ? m.id !== slot1Item.id : m.name !== slot1Item.name)
      );
      const pool2 = pool2Candidates.length > 0 ? pool2Candidates : pool;
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
            description: 'Rare gemstone and heirloom.',
          };
        }
      } else {
        // Epic: Best of 3 Art & Gem rolls
        try {
          const { data } = await supabase
            .from('treasure_entries')
            .select('*')
            .eq('table_key', 'art_gems');
          if (data && data.length > 0) {
            const e1 = data[Math.floor(Math.random() * data.length)];
            slot3Item = {
              name: `Royal Treasure: ${e1.result_name}`,
              category: '💫 Master Art & Gem (Best of 3)',
              type: 'valuable',
              value: '50g',
              description: `Priceless historical heirloom: ${e1.result_name}.`,
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
          slotType: 'artifact',
          slotTitle: 'Rnd Artifact 1',
          slotBadge: `${draftTier} Rarity`,
          item: slot1Item,
        },
        {
          slotType: 'artifact',
          slotTitle: 'Rnd Artifact 2',
          slotBadge: `${draftTier} Rarity`,
          item: slot2Item,
        },
        {
          slotType: 'treasure',
          slotTitle: 'Treasure Cache',
          slotBadge: draftTier === 'Minor' ? 'Best of 2 Coins' : `Best of ${draftTier === 'Epic' ? 3 : draftTier === 'Greater' ? 2 : 1} Art/Gem`,
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
                Select <strong className="text-amber-300">1 (One) crafted reward</strong> for {(characterName || 'Hero').split(' ')[0]} or Deconstruct to cut Essence in half.
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
              {slots.map((s, idx) => {
                const isTreasure = s.slotType === 'treasure';
                const abilities = isTreasure
                  ? null
                  : resolveLootAbilities(s.item, functionsCatalog, modsCatalog);
                const isExpanded = expandedSlots.has(idx);
                const itemName = s.item?.name || s.item?.title || 'Reward';
                const notes = abilities?.primaryNotes || s.item?.notes || (isTreasure ? s.item?.description : null);
                const effectText = abilities?.primaryEffect || s.item?.effect;
                const hasExplicitEffect = !!effectText;
                const descriptionText = s.item?.description;
                const showSeparateDesc =
                  descriptionText &&
                  descriptionText.trim() !== '' &&
                  descriptionText.trim() !== effectText?.trim() &&
                  descriptionText.trim() !== notes?.trim();

                return (
                  <div
                    key={idx}
                    className="bg-slate-950/90 border border-slate-800 hover:border-amber-500/60 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all shadow-xl hover:shadow-amber-500/10 group"
                  >
                    <div>
                      {/* Slot Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                        <span className="font-outfit font-bold text-xs text-amber-400 flex items-center gap-1.5">
                          {idx === 0 && <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                          {idx === 1 && <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                          {idx === 2 && <Gem className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {s.slotTitle}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {s.slotBadge}
                        </span>
                      </div>

                      {/* Item Title Row + Notes Popover */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors inline-flex items-center align-baseline gap-1">
                          <span>{itemName}</span>
                          {notes && <ItemNotesPopover notes={notes} itemName={itemName} inline />}
                        </h4>
                      </div>

                      {/* Tactical Badges: Action & Usage */}
                      {abilities && (abilities.primaryAction || abilities.primaryUsage) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {abilities.primaryAction && (
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                ACTION_BADGE_COLORS[abilities.primaryAction] ||
                                'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              [{abilities.primaryAction}]
                            </span>
                          )}
                          {abilities.primaryUsage && (
                            <span className="bg-slate-900 text-[10px] font-mono font-bold text-amber-300 px-1.5 py-0.5 rounded border border-slate-800">
                              {abilities.primaryUsage}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Valuation Badge for Treasure/Coins */}
                      {isTreasure && s.item?.value && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 shadow-sm flex items-center gap-1">
                            <span>💎</span>
                            <span className="font-mono font-extrabold">{s.item.value}</span>
                          </span>
                        </div>
                      )}

                      {/* Exact Effect Box */}
                      {hasExplicitEffect ? (
                        <div className="bg-slate-900/85 border border-slate-800/80 p-2.5 rounded-lg text-xs text-amber-200/95 leading-relaxed font-sans mt-2.5 shadow-inner">
                          <span className="font-bold text-amber-400 font-mono text-[10px] uppercase tracking-wider block mb-0.5">
                            ⚡ Effect:
                          </span>
                          {effectText}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                          {descriptionText || notes || 'Enchanted reward.'}
                        </p>
                      )}

                      {/* Optional Lore/Description if distinct from Effect */}
                      {hasExplicitEffect && showSeparateDesc && (
                        <p className="text-[11px] text-slate-400 italic mt-2 leading-snug font-sans">
                          {descriptionText}
                        </p>
                      )}

                      {/* Collapsible Inherent Functions Drawer (Destron Armor Pattern) */}
                      {abilities && abilities.functions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleExpandSlot(idx)}
                            className="flex items-center justify-between w-full px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-mono transition text-slate-300 hover:text-white cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>⚡</span>
                              <span className="font-bold text-slate-200">Inherent Functions:</span>
                              <span className="text-emerald-400 font-semibold">
                                {abilities.functions.length} Installed
                              </span>
                            </div>
                            <ChevronDown
                              className={`w-3 h-3 text-slate-400 transition-transform ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {isExpanded && (
                            <div className="flex flex-col gap-1.5 bg-slate-900/70 p-2 rounded-lg border border-slate-800/60 max-h-48 overflow-y-auto">
                              {abilities.functions.map((fn) => {
                                const fnActionUpper = fn.action ? fn.action.toUpperCase() : null;
                                const fnActionClass = fnActionUpper
                                  ? ACTION_BADGE_COLORS[fnActionUpper] ||
                                    'bg-slate-800 text-slate-300 border-slate-700'
                                  : null;

                                return (
                                  <div
                                    key={fn.id || fn.name}
                                    className="py-1 border-b border-slate-800/40 last:border-none flex flex-col gap-1 text-[11px]"
                                  >
                                    <div className="flex items-center justify-between gap-1 flex-wrap">
                                      <span className="font-semibold text-emerald-300 inline-flex items-center align-baseline gap-1">
                                        <span>✓ {fn.name}</span>
                                        {fn.notes && (
                                          <ItemNotesPopover notes={fn.notes} itemName={fn.name} inline />
                                        )}
                                      </span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {fnActionUpper && (
                                          <span
                                            className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded border ${fnActionClass}`}
                                          >
                                            [{fnActionUpper}]
                                          </span>
                                        )}
                                        {fn.usage && (
                                          <span className="bg-slate-950 text-[9px] font-mono text-amber-300 px-1 py-0.2 rounded border border-slate-800">
                                            {fn.usage}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {fn.effect && (
                                      <p className="text-[10px] text-slate-300/90 leading-snug pl-2 border-l border-amber-500/30 font-sans">
                                        {fn.effect}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleClaimSlot(s)}
                      disabled={isClaiming}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md flex items-center justify-center cursor-pointer mt-2"
                    >
                      Claim
                    </button>
                  </div>
                );
              })}
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
