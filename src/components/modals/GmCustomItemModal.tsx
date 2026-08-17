// src/components/modals/GmCustomItemModal.tsx
// Game Master Custom Item Workshop: Forge custom Relics & Hardware, save to DB or inject into player Vaults.

import React, { useState, useRef } from 'react';
import { X, Wrench, Plus, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { MagicItem } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';

interface GmCustomItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_OPTIONS = ['A', 'P', 'F', 'R', 'S'];
const USAGE_OPTIONS = [
  { value: '1', label: '1 - Flat 1 Use' },
  { value: '2', label: '2 - Flat 2 Uses' },
  { value: '3', label: '3 - Flat 3 Uses' },
  { value: '1-Enc', label: '1-Enc - Once per Encounter' },
  { value: '1-Day', label: '1-Day - Once per Day' },
  { value: 'P', label: 'P - Passive Continuous' },
];

const MAIN_ABILITY_ICONS = [
  { icon: '⚔️', label: 'Attack' },
  { icon: '🛡️', label: 'Defense' },
  { icon: '🎯', label: 'Ranged' },
  { icon: '👁️', label: 'Perception' },
  { icon: '🏃', label: 'Movement' },
  { icon: '💥', label: 'Blast' },
  { icon: '✨', label: 'Magic' },
  { icon: '🌀', label: 'Status' },
  { icon: '❤️', label: 'Healing' },
  { icon: '⚡', label: 'Instant' },
  { icon: '💎', label: 'Gem' },
];

export const GmCustomItemModal: React.FC<GmCustomItemModalProps> = ({ isOpen, onClose }) => {
  const characters = useCharacterStore((state) => state.characters);
  const fetchInitialData = useCharacterStore((state) => state.fetchInitialData);

  // Form State
  const [itemType, setItemType] = useState<'relic' | 'hardware'>('relic');
  const [destination, setDestination] = useState<'database' | 'player_vault'>('database');
  const [selectedCharId, setSelectedCharId] = useState<number>(characters[0]?.id || 0);

  const [name, setName] = useState('');
  const [action, setAction] = useState('A');
  const [usage, setUsage] = useState('1-Enc');
  const [tier, setCreateTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Minor');
  const [costVal, setCostVal] = useState<number>(10);
  const [costUnit, setCostUnit] = useState<'s' | 'g'>('g');
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const effectTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const insertIconAtCursor = (iconStr: string) => {
    const textarea = effectTextareaRef.current;
    if (!textarea) {
      setEffect((prev) => prev + iconStr);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = effect;
    const nextVal = currentVal.substring(0, start) + iconStr + currentVal.substring(end);
    setEffect(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + iconStr.length, start + iconStr.length);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Item name is required.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const isHardware = itemType === 'hardware';
    const tierIcon = tier === 'Minor' ? '🍺' : tier === 'Lesser' ? '🪄' : tier === 'Greater' ? '✨' : '💫';
    const categoryStr = `${tierIcon} ${tier}`;
    const costStr = isHardware ? `${costVal}${costUnit}` : undefined;

    try {
      if (destination === 'database') {
        const table = isHardware ? 'hardware' : 'relics';
        const payload: any = {
          name: name.trim(),
          category: categoryStr,
          action,
          usage,
          effect: effect.trim(),
          notes: notes.trim() || undefined,
          genres: ['Universal'],
          created_at: new Date().toISOString(),
        };
        if (isHardware) {
          payload.cost = costStr;
        }

        const { error } = await supabase.from(table).insert([payload]);
        if (error) throw error;

        await fetchInitialData({ silent: true });
        setFeedback({ type: 'success', message: `✅ Successfully forged and saved '${name.trim()}' to Master ${isHardware ? 'Hardware' : 'Relics'} Database!` });
        setName('');
        setEffect('');
        setNotes('');
      } else {
        // Destination: Grant directly to Player Vault
        const targetChar = characters.find((c) => c.id === selectedCharId);
        if (!targetChar) {
          throw new Error('Target character not found.');
        }

        const currentSheet = targetChar.sheet_data || {};
        const currentVault: MagicItem[] = Array.isArray(currentSheet.character_vault) ? currentSheet.character_vault : [];

        const magicItemObj: MagicItem = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: name.trim(),
          usage,
          action,
          effect: effect.trim(),
          source: isHardware ? 'GM Custom Hardware' : 'GM Custom Relic',
          created_at: new Date().toISOString(),
          category: categoryStr,
          slot_weight: (getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4),
          is_hardware: isHardware,
          cost: costStr,
          notes: notes.trim() || undefined,
        };

        const updatedVault = [...currentVault, magicItemObj];
        const updatedSheet = {
          ...currentSheet,
          character_vault: updatedVault,
        };

        await gameApi.updateCharacter(targetChar.id, {
          sheet_data: updatedSheet,
        });

        await fetchInitialData({ silent: true });
        setFeedback({
          type: 'success',
          message: `✅ Granted '${name.trim()}' directly into ${targetChar.name}'s Vault (0 AP)!`,
        });
        setName('');
        setEffect('');
        setNotes('');
      }
    } catch (err: any) {
      console.error('[GmCustomItemModal] Error forging item:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to forge item.'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-xl shadow-2xl shadow-amber-950/50 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide">
                GM Item Workshop
              </h3>
              <p className="text-xs text-slate-400">
                Forge custom Relics & Hardware for the campaign.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto min-h-0 text-xs">
          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fadeIn ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Section 1: Item Classification Multi-Option Pill Switch */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold text-slate-300 font-outfit uppercase tracking-wider text-[11px]">
              Item Classification
            </span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setItemType('relic')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  itemType === 'relic'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🏺 Relic (Loot Drop)
              </button>
              <button
                type="button"
                onClick={() => setItemType('hardware')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  itemType === 'hardware'
                    ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                ⚙️ Hardware (Tech Catalog)
              </button>
            </div>
          </div>

          {/* Section 2: Destination Target Multi-Option Pill Switch */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold text-slate-300 font-outfit uppercase tracking-wider text-[11px]">
              Destination Target
            </span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setDestination('database')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  destination === 'database'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                💾 Master Supabase Catalog
              </button>
              <button
                type="button"
                onClick={() => setDestination('player_vault')}
                className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  destination === 'player_vault'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                👤 Grant to Hero Vault
              </button>
            </div>
          </div>

          {/* Target Hero Selector (if player_vault selected) */}
          {destination === 'player_vault' && (
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-emerald-500/30">
              <span className="font-bold text-emerald-300 shrink-0">Target Hero:</span>
              <select
                value={selectedCharId}
                onChange={(e) => setSelectedCharId(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-bold px-3 py-1.5 rounded-lg outline-none flex-1 cursor-pointer"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    👤 {c.name} ({c.class || 'Hero'}, Lvl {c.level || 1})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Item Name */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-300">Item Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Plasma Disruptor, Ring of Featherfall..."
              className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
              required
            />
          </div>

          {/* Store Cost Row (Hardware Only) */}
          {itemType === 'hardware' && (
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-cyan-500/30">
              <span className="font-bold text-cyan-300 shrink-0">Store Cost:</span>
              <input
                type="number"
                min={1}
                value={costVal}
                onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono font-bold px-2 py-1 rounded outline-none w-20"
              />
              <select
                value={costUnit}
                onChange={(e) => setCostUnit(e.target.value as 's' | 'g')}
                className="bg-slate-900 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded outline-none cursor-pointer"
              >
                <option value="s">Silver (s)</option>
                <option value="g">Gold (g)</option>
              </select>
              <span className="text-[11px] text-slate-400 italic">
                ({costUnit === 'g' ? `${costVal * 100}s equivalent` : `${Math.floor(costVal / 100)}g ${costVal % 100}s`})
              </span>
            </div>
          )}

          {/* Action, Usage, Tier Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-300">Action:</span>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-300">Usage:</span>
              <select
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer"
              >
                {USAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-300">Tier:</span>
              <select
                value={tier}
                onChange={(e) => setCreateTier(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer"
              >
                <option value="Minor">🍺 Minor</option>
                <option value="Lesser">🪄 Lesser</option>
                <option value="Greater">✨ Greater</option>
                <option value="Epic">💫 Epic</option>
              </select>
            </div>
          </div>

          {/* Effect Description */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-bold text-slate-300">Effect Description</span>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold mr-0.5">Insert Icon:</span>
                {MAIN_ABILITY_ICONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => insertIconAtCursor(item.icon)}
                    className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                    title={`Insert ${item.icon} (${item.label}) at cursor`}
                  >
                    <span>{item.icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <textarea
              ref={effectTextareaRef}
              value={effect}
              onChange={(e) => setEffect(e.target.value)}
              rows={3}
              placeholder="Describe mechanical effect, damage, bonuses, or utility..."
              className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 resize-none"
              required
            />
          </div>

          {/* Optional Lore / Notes */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-300">GM Notes / Flavor Text (Optional)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Flavor lore, history, creator notes..."
              className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-outfit font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Forging Item...'
                  : destination === 'database'
                  ? `Forge & Save to Master ${itemType === 'hardware' ? 'Hardware' : 'Relics'} Table`
                  : `Forge & Grant to ${characters.find((c) => c.id === selectedCharId)?.name || 'Hero'}'s Vault`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
