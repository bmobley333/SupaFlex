// src/components/modals/LootDraftModal.tsx
// 3-Card Smart Draft Modal for the Refine & Echo Loot Engine

import React, { useState, useEffect } from 'react';
import { MagicItem } from '../../types/game';
import { supabase } from '../../lib/supabase';
import { Sparkles, Gem, RefreshCw } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { GearModFunctionTree } from '../common/GearModFunctionTree';
import { resolveLootAbilities, ACTION_BADGE_COLORS } from '../../utils/lootAbilityResolver';

interface LootDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName: string;
  stockMagicItems?: MagicItem[];
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
  stockMagicItems,
  onSelectReward,
  onDeconstructDraft,
}) => {
  const functionsCatalog = useCharacterStore((state) => state.functionsCatalog);
  const modsCatalog = useCharacterStore((state) => state.modsCatalog);
  const artifactsCatalog = useCharacterStore((state) => state.artifactsCatalog);
  const [slots, setSlots] = useState<DraftSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      generateDraftSlots();
    }
  }, [isOpen]);

  const generateDraftSlots = async () => {
    setIsLoading(true);

    try {
      // 1. Resolve true Artifact pool
      let pool: any[] = artifactsCatalog && artifactsCatalog.length > 0 ? artifactsCatalog : (stockMagicItems || []);

      // 2. SLOT 1: Rnd Artifact 1
      let slot1Item: any = null;
      if (pool.length > 0) {
        slot1Item = pool[Math.floor(Math.random() * pool.length)];
      } else {
        slot1Item = {
          name: 'Focus Ring',
          category: 'Artifact',
          effect: 'Grants +1 to all action rolls while focused.',
        };
      }

      // 3. SLOT 2: Rnd Artifact 2 (distinct from Slot 1 if pool allows)
      let slot2Item: any = null;
      const pool2Candidates = pool.filter((m) =>
        slot1Item && (m.id ? m.id !== slot1Item.id : m.name !== slot1Item.name)
      );
      const pool2 = pool2Candidates.length > 0 ? pool2Candidates : pool;
      if (pool2.length > 0) {
        slot2Item = pool2[Math.floor(Math.random() * pool2.length)];
      } else {
        slot2Item = {
          name: 'Amulet of Power',
          category: 'Artifact',
          effect: 'Adds d6 Bonus damage to elemental spells.',
        };
      }

      // 4. SLOT 3: TREASURE CACHE (Art & Gem roll)
      let slot3Item: any = null;
      try {
        const { data } = await supabase
          .from('treasure_entries')
          .select('*')
          .eq('table_key', 'art_gems');
        if (data && data.length > 0) {
          const entry = data[Math.floor(Math.random() * data.length)];
          slot3Item = {
            name: entry.result_name,
            category: 'Art & Gem',
            type: 'valuable',
            value: entry.val_formula || '10g',
            description: entry.notes || 'A fine cut gem or valuable artwork.',
          };
        }
      } catch {
        // Fallback
      }
      if (!slot3Item) {
        slot3Item = {
          name: 'Engraved Silver Chalice',
          category: 'Art & Gem',
          type: 'valuable',
          value: '10g',
          description: 'Intricately crafted silver chalice.',
        };
      }

      setSlots([
        {
          slotType: 'artifact',
          slotTitle: 'Rnd Artifact 1',
          slotBadge: '🔮 Artifact',
          item: slot1Item,
        },
        {
          slotType: 'artifact',
          slotTitle: 'Rnd Artifact 2',
          slotBadge: '🔮 Artifact',
          item: slot2Item,
        },
        {
          slotType: 'treasure',
          slotTitle: 'Treasure Cache',
          slotBadge: '🎨 Art & Gem',
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

                      {/* Collapsible 2-Level Tree Hierarchy Drawer */}
                      <GearModFunctionTree
                        hostItem={s.item}
                        modsCatalog={modsCatalog || []}
                        functionsCatalog={functionsCatalog || []}
                        isEditable={false}
                        className="mt-2.5"
                      />
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
