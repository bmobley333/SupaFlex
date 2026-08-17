// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Workshop: Craft custom Powers, Relics, Hardware, & Skillsets with zero global database pollution.

import React, { useState, useRef } from 'react';
import { X, Plus, Check, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem, Power, MagicItem, AbilitySlot } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';
import { getPowerReadyCategory } from '../../utils/readyMatrixSchedule';

interface PlayerWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSaved?: () => void;
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

export const AnvilIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 8c0-1.7 1.3-3 3-3h15v3c-1.5 0-3 1-3 2.5V13a4 4 0 0 1-3 3.9V19h2a1 1 0 0 1 1 1v1H6v-1a1 1 0 0 1 1-1h2v-2.1A4 4 0 0 1 6 13v-2.5C6 9 4.5 8 3 8z" />
  </svg>
);

export const PlayerWorkshopModal: React.FC<PlayerWorkshopModalProps> = ({ isOpen, onClose, onItemSaved }) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const playerName = useCharacterStore((state) => state.playerName);
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const characters = useCharacterStore((state) => state.characters);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const fetchInitialData = useCharacterStore((state) => state.fetchInitialData);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const saveActiveCharacter = useCharacterStore((state) => state.saveActiveCharacter);

  const isGm = activeRole === 'gm';

  // Form State
  const [creationType, setCreationType] = useState<CustomCreationType>('power');
  const [name, setName] = useState('');
  const [action, setAction] = useState('A');
  const [usage, setUsage] = useState('1-Enc');
  const [tier, setTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Minor');
  const [costVal, setCostVal] = useState<number>(10);
  const [costUnit, setCostUnit] = useState<'s' | 'g'>('g');
  const [skillsListStr, setSkillsListStr] = useState('');
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');
  const [alsoAddToSheet, setAlsoAddToSheet] = useState(true);
  const [selectedHeroId, setSelectedHeroId] = useState<number>(activeCharacter?.id || characters[0]?.id || 0);

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

  const handleResetForm = () => {
    setName('');
    setEffect('');
    setNotes('');
    setSkillsListStr('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Creation name is required.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const authorDisplayName = playerName?.trim() || playerEmail?.split('@')[0] || 'Hero';
    const tierIcon = tier === 'Minor' ? '🍺' : tier === 'Lesser' ? '🪄' : tier === 'Greater' ? '✨' : '💫';
    const categoryStr = creationType === 'relic' ? `${tierIcon} ${tier}` : creationType === 'power' ? 'Custom Power' : 'Custom Hardware';
    const costStr = creationType === 'hardware' ? `${costVal}${costUnit}` : undefined;

    const parsedSkills = skillsListStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const itemDataPayload: any = {
      action,
      usage,
      effect: effect.trim(),
      created_at: new Date().toISOString(),
    };

    if (creationType === 'hardware') {
      itemDataPayload.cost = costStr;
      itemDataPayload.is_hardware = true;
      itemDataPayload.slot_weight = (getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4);
    } else if (creationType === 'relic') {
      itemDataPayload.slot_weight = (getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4);
      itemDataPayload.is_hardware = false;
    } else if (creationType === 'skillset') {
      itemDataPayload.skills = parsedSkills;
    }

    try {
      // 1. Save to party_custom_items table (personal library + auto-approved for Party Mall if GM)
      const newCustomItem: Partial<CustomCreationItem> = {
        name: name.trim(),
        type: creationType,
        category: categoryStr,
        author_name: isGm ? `${authorDisplayName} (GM)` : authorDisplayName,
        author_email: playerEmail || 'guest@metascape.com',
        party_id: activePartyId || null,
        gm_approved: isGm ? true : false,
        item_data: itemDataPayload,
        notes: notes.trim() || undefined,
      };

      await gameApi.saveCustomItem(newCustomItem);

      // 2. Optionally inject directly into target character sheet
      const targetHero = isGm 
        ? characters.find((c) => c.id === Number(selectedHeroId)) || activeCharacter
        : activeCharacter;

      if (alsoAddToSheet && targetHero) {
        const isTargetActiveHero = targetHero.id === activeCharacter?.id;

        if (creationType === 'power') {
          const powerObj: Power = {
            id: Date.now(),
            name: `${name.trim()} v1`,
            base_name: name.trim(),
            version: 1,
            action,
            usage,
            effect: effect.trim(),
            source: isGm ? `GM Forge (${authorDisplayName})` : `Player Forge (${authorDisplayName})`,
            created_at: new Date().toISOString(),
          };

          const powerSlotObj: AbilitySlot = {
            select: true,
            name: `${name.trim()} v1`,
            base_name: name.trim(),
            version: 1,
            action: (action.toUpperCase() as any) || 'A',
            usage,
            effect: effect.trim(),
            checked: [false, false, false],
            is_readied: false,
            ready: getPowerReadyCategory(powerObj),
          };

          if (isTargetActiveHero) {
            updateActiveSheetData((prev) => {
              const existingVault = Array.isArray(prev.character_power_codex) ? prev.character_power_codex : [];
              const existingCustom = prev.custom_powers || [];
              return {
                ...prev,
                custom_powers: [...existingCustom, powerObj],
                character_power_codex: [...existingVault, powerSlotObj],
              };
            });
            saveActiveCharacter();
          } else {
            const currentSheet = targetHero.sheet_data || {};
            const existingVault = Array.isArray(currentSheet.character_power_codex) ? currentSheet.character_power_codex : [];
            const existingCustom = currentSheet.custom_powers || [];
            const updatedSheet = {
              ...currentSheet,
              custom_powers: [...existingCustom, powerObj],
              character_power_codex: [...existingVault, powerSlotObj],
            };
            await gameApi.updateCharacter(targetHero.id, { sheet_data: updatedSheet });
            await fetchInitialData({ silent: true });
          }
        } else if (creationType === 'relic' || creationType === 'hardware') {
          const magicItemObj: MagicItem = {
            id: Date.now(),
            name: name.trim(),
            action,
            usage,
            effect: effect.trim(),
            category: categoryStr,
            is_hardware: creationType === 'hardware',
            cost: costStr,
            slot_weight: (getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4),
            source: isGm ? `GM Forge (${authorDisplayName})` : `Player Forge (${authorDisplayName})`,
            created_at: new Date().toISOString(),
            notes: notes.trim() || undefined,
          };

          if (isTargetActiveHero) {
            updateActiveSheetData((prev) => {
              const currentVault: MagicItem[] = Array.isArray(prev.character_vault) ? prev.character_vault : [];
              const existingCustom = prev.custom_magic_items || [];
              return {
                ...prev,
                custom_magic_items: [...existingCustom, magicItemObj],
                character_vault: [...currentVault, magicItemObj],
              };
            });
            saveActiveCharacter();
          } else {
            const currentSheet = targetHero.sheet_data || {};
            const currentVault: MagicItem[] = Array.isArray(currentSheet.character_vault) ? currentSheet.character_vault : [];
            const existingCustom = currentSheet.custom_magic_items || [];
            const updatedSheet = {
              ...currentSheet,
              custom_magic_items: [...existingCustom, magicItemObj],
              character_vault: [...currentVault, magicItemObj],
            };
            await gameApi.updateCharacter(targetHero.id, { sheet_data: updatedSheet });
            await fetchInitialData({ silent: true });
          }
        }
      }

      setFeedback({
        type: 'success',
        message: isGm
          ? `👑 Successfully forged '${name.trim()}' and published live to Party Mall${activePartyId ? ` [${activePartyId}]` : ''}!${alsoAddToSheet && targetHero ? ` Granted to ${targetHero.name}'s sheet (0 AP).` : ''}`
          : `✅ Successfully forged '${name.trim()}' and saved to your Creations library!`,
      });

      handleResetForm();
      if (onItemSaved) onItemSaved();
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error forging item:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to save creation.'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-xl shadow-2xl shadow-amber-950/50 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AnvilIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide flex items-center gap-2">
                Player's Forge
                {isGm ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    👑 GM Mode {activePartyId ? `[Party: ${activePartyId}]` : ''}
                  </span>
                ) : (
                  activePartyId && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      Party: {activePartyId}
                    </span>
                  )
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {isGm 
                  ? "Craft custom Powers, Relics, Hardware & Skillsets with instant Party Mall auto-approval."
                  : "Craft custom Powers, Relics, Hardware & Skillsets."}
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

        {/* Form Body */}
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

          {/* Type Selector Multi-Option Pill Switch */}
          <div className="flex flex-col gap-1.5">
            <span className="font-bold text-slate-300 font-outfit uppercase tracking-wider text-[11px]">
              Creation Classification
            </span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => setCreationType('power')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  creationType === 'power'
                    ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🔥 Power
              </button>
              <button
                type="button"
                onClick={() => setCreationType('relic')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  creationType === 'relic'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🏺 Relic
              </button>
              <button
                type="button"
                onClick={() => setCreationType('hardware')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  creationType === 'hardware'
                    ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                ⚙️ Hardware
              </button>
              <button
                type="button"
                onClick={() => setCreationType('skillset')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  creationType === 'skillset'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🎓 Skillset
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-300">Creation Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                creationType === 'power'
                  ? 'e.g. Kinetic Repulsion, Void Tether...'
                  : creationType === 'relic'
                  ? 'e.g. Ring of the Sunken King...'
                  : creationType === 'hardware'
                  ? 'e.g. Sub-Dermal Comms Array...'
                  : 'e.g. Infiltration Ops...'
              }
              className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
              required
            />
          </div>

          {/* Hardware Cost Row */}
          {creationType === 'hardware' && (
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

          {/* Action, Usage, Tier Grid (For Non-Skillset) */}
          {creationType !== 'skillset' && (
            <div className={`grid ${creationType === 'relic' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
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

              {creationType === 'relic' && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Tier:</span>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1.5 rounded-lg outline-none cursor-pointer"
                  >
                    <option value="Minor">🍺 Minor</option>
                    <option value="Lesser">🪄 Lesser</option>
                    <option value="Greater">✨ Greater</option>
                    <option value="Epic">💫 Epic</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Skillset Included Skills */}
          {creationType === 'skillset' && (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-300">Included Skills (2–5 comma separated)</span>
              <input
                type="text"
                value={skillsListStr}
                onChange={(e) => setSkillsListStr(e.target.value)}
                placeholder="e.g. Stealth, Lockpicking, Sleight of Hand"
                className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                required
              />
            </div>
          )}

          {/* Effect Description */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="font-bold text-slate-300">
                {creationType === 'skillset' ? 'Skillset Description / Focus' : 'Effect Description'}
              </span>
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
              placeholder="Describe mechanical effect, damage dice, bonuses, or utility..."
              className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 resize-none"
              required
            />
          </div>

          {/* Optional Lore Notes */}
          <div className="flex flex-col gap-1">
            <span className="font-bold text-slate-300">Lore & Flavor Text (Optional)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Origins, creator flavor, background lore..."
              className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
            />
          </div>

          {/* Also Add to Sheet / Grant to Hero Checkbox & Selector */}
          {(activeCharacter || (isGm && characters.length > 0)) && (
            <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer hover:border-slate-700 transition-colors">
                <input
                  type="checkbox"
                  checked={alsoAddToSheet}
                  onChange={(e) => setAlsoAddToSheet(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 focus:ring-amber-400 cursor-pointer"
                />
                <span className="text-xs text-slate-200 font-semibold">
                  {isGm 
                    ? "Also inject directly into a Party Hero's sheet/vault (0 AP)" 
                    : `Also inject directly into active hero's vault/codex (${activeCharacter?.name || 'Active Hero'})`}
                </span>
              </label>

              {isGm && alsoAddToSheet && characters.length > 0 && (
                <div className="flex items-center gap-2 pl-6 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium shrink-0">Target Hero:</span>
                  <select
                    value={selectedHeroId}
                    onChange={(e) => setSelectedHeroId(Number(e.target.value))}
                    className="flex-1 bg-slate-900 text-slate-100 text-xs px-2.5 py-1 rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-semibold cursor-pointer"
                  >
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.class ? `(${c.class})` : ''} {c.id === activeCharacter?.id ? '⭐ (Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-50 text-white font-outfit font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmitting 
                  ? 'Forging Creation...' 
                  : isGm 
                  ? `👑 Forge & Publish ${name.trim() || 'Creation'} to Party Mall` 
                  : `Save ${name.trim() || 'Creation'} to My Creations Library`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
