// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Workshop / Player's Forge: Craft custom Powers, Relics, Hardware, & Skillsets.

import React, { useState, useRef } from 'react';
import { X, Plus, Check, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';

interface PlayerWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSaved?: () => void;
}

interface SkillsetItem {
  name: string;
  attribute: string;
}

const ACTION_OPTIONS = ['AM', 'A', 'M', 'P', 'F'];

const USAGE_OPTIONS = [
  '1',
  '2',
  '3',
  '1-🍀',
  '1-⚡',
  '1-Enc',
  '2-Enc',
  '3-Enc',
  '1-Rnd',
];

const ATTRIBUTE_EFFECT_ICONS = [
  { label: 'Magic✨', name: 'Magic', icon: '✨' },
  { label: 'Might💪', name: 'Might', icon: '💪' },
  { label: 'Mind👁️', name: 'Mind', icon: '👁️' },
  { label: 'Motion🏃', name: 'Motion', icon: '🏃' },
  { label: 'Moxie🫀', name: 'Moxie', icon: '🫀' },
];

const SKILLSET_ATTRIBUTE_OPTIONS = [
  { label: 'Magic✨', icon: '✨' },
  { label: 'Might💪', icon: '💪' },
  { label: 'Mind👁️', icon: '👁️' },
  { label: 'Motion🏃', icon: '🏃' },
  { label: 'Moxie🫀', icon: '🫀' },
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
  const activeRole = useCharacterStore((state) => state.activeRole);

  const isGm = activeRole === 'gm';

  // Form State
  const [creationType, setCreationType] = useState<CustomCreationType>('power');
  const [name, setName] = useState('');
  const [action, setAction] = useState('AM');
  const [usage, setUsage] = useState('1');
  const [tier, setTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Minor');
  const [costVal, setCostVal] = useState<number>(10);
  const [costUnit, setCostUnit] = useState<'s' | 'g'>('g');
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');

  // Skillset State (2 to 5 items with required attribute)
  const [skillsetItems, setSkillsetItems] = useState<SkillsetItem[]>([
    { name: '', attribute: '✨' },
    { name: '', attribute: '💪' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const effectTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!isOpen) return null;

  const insertIconAtCursor = (iconStr: string) => {
    const textarea = effectTextareaRef.current;
    if (!textarea) {
      setEffect((prev) => (prev ? prev + iconStr : iconStr));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentVal = effect;
    const nextVal = currentVal.substring(0, start) + iconStr + currentVal.substring(end);
    setEffect(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + iconStr.length, start + iconStr.length);
    }, 0);
  };

  const handleAddSkillsetItem = () => {
    if (skillsetItems.length < 5) {
      setSkillsetItems((prev) => [...prev, { name: '', attribute: '✨' }]);
    }
  };

  const handleRemoveSkillsetItem = (index: number) => {
    if (skillsetItems.length > 2) {
      setSkillsetItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleUpdateSkillName = (index: number, skillName: string) => {
    setSkillsetItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: skillName };
      return next;
    });
  };

  const handleUpdateSkillAttribute = (index: number, attrIcon: string) => {
    setSkillsetItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], attribute: attrIcon };
      return next;
    });
  };

  const handleResetForm = () => {
    setName('');
    setEffect('');
    setNotes('');
    setSkillsetItems([
      { name: '', attribute: '✨' },
      { name: '', attribute: '💪' },
    ]);
    setAction('AM');
    setUsage('1');
    setTier('Minor');
    setCostVal(10);
    setCostUnit('g');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Creation name is required.' });
      return;
    }

    if (creationType === 'skillset') {
      if (skillsetItems.length < 2 || skillsetItems.length > 5) {
        setFeedback({ type: 'error', message: 'A Skillset must contain between 2 and 5 skills.' });
        return;
      }
      for (let i = 0; i < skillsetItems.length; i++) {
        if (!skillsetItems[i].name.trim()) {
          setFeedback({ type: 'error', message: `Skill #${i + 1} name cannot be empty.` });
          return;
        }
        if (!skillsetItems[i].attribute) {
          setFeedback({ type: 'error', message: `Skill #${i + 1} must have a required attribute icon selected.` });
          return;
        }
      }
    } else {
      if (!effect.trim()) {
        setFeedback({ type: 'error', message: 'Effect description is required.' });
        return;
      }
    }

    setIsSubmitting(true);
    setFeedback(null);

    const authorDisplayName = playerName?.trim() || playerEmail?.split('@')[0] || 'Hero';
    const tierIcon = tier === 'Minor' ? '🍺' : tier === 'Lesser' ? '🪄' : tier === 'Greater' ? '✨' : '💫';
    const categoryStr =
      creationType === 'relic'
        ? `${tierIcon} ${tier}`
        : creationType === 'power'
        ? 'Custom Power'
        : creationType === 'hardware'
        ? 'Custom Hardware'
        : 'Custom Skillset';
    const costStr = creationType === 'hardware' ? `${costVal}${costUnit}` : undefined;

    const formattedSkills =
      creationType === 'skillset'
        ? skillsetItems.map((item) => `${item.name.trim()} ${item.attribute}`)
        : undefined;

    const itemDataPayload: any = {
      created_at: new Date().toISOString(),
    };

    if (creationType !== 'skillset') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
    }

    if (creationType === 'hardware') {
      itemDataPayload.cost = costStr;
      itemDataPayload.is_hardware = true;
      itemDataPayload.slot_weight = getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4;
    } else if (creationType === 'relic') {
      itemDataPayload.slot_weight = getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4;
      itemDataPayload.is_hardware = false;
    } else if (creationType === 'skillset') {
      itemDataPayload.skills = formattedSkills;
    }

    try {
      const newCustomItem: Partial<CustomCreationItem> = {
        name: name.trim(),
        type: creationType,
        category: categoryStr,
        author_name: isGm ? `${authorDisplayName} (GM)` : authorDisplayName,
        author_email: playerEmail || 'guest@metascape.com',
        party_id: activePartyId || null,
        gm_approved: isGm ? true : false,
        item_data: itemDataPayload,
        notes: (creationType === 'relic' || creationType === 'hardware') && notes.trim() ? notes.trim() : undefined,
      };

      await gameApi.saveCustomItem(newCustomItem);

      setFeedback({
        type: 'success',
        message: isGm
          ? `👑 Successfully forged '${name.trim()}' and published live to Party Mall${activePartyId ? ` [${activePartyId}]` : ''}!`
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
                  ? 'Craft custom Powers, Relics, Hardware & Skillsets with instant Party Mall auto-approval.'
                  : 'Craft custom Powers, Relics, Hardware & Skillsets.'}
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

          {/* Action, Usage, Tier Grid (For Non-Skillset: Power, Relic, Hardware) */}
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
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
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
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
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

          {/* Skillset Dynamic Skill Items List (2 to 5 with required attribute icon) */}
          {creationType === 'skillset' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 font-outfit uppercase tracking-wider text-[11px]">
                  Included Skills (2–5 Required)
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {skillsetItems.length} of 5 Skills
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {skillsetItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-[11px] font-mono font-bold text-slate-500 w-4 shrink-0 text-center">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateSkillName(idx, e.target.value)}
                        placeholder={`Skill ${idx + 1} name (e.g. Stealth, Lockpicking)`}
                        className="flex-1 bg-slate-900 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-semibold min-w-0"
                        required
                      />
                    </div>

                    {/* Single-Choice Attribute Selector Pills */}
                    <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex items-center gap-0.5 shrink-0">
                      {SKILLSET_ATTRIBUTE_OPTIONS.map((attr) => (
                        <button
                          key={attr.icon}
                          type="button"
                          onClick={() => handleUpdateSkillAttribute(idx, attr.icon)}
                          className={`py-1 px-1.5 text-[11px] font-bold rounded transition-all flex items-center justify-center gap-0.5 cursor-pointer ${
                            item.attribute === attr.icon
                              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 border-transparent'
                          }`}
                          title={`Assign ${attr.label}`}
                        >
                          <span>{attr.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Remove Button */}
                    {skillsetItems.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSkillsetItem(idx)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/40 transition-colors shrink-0 cursor-pointer self-end sm:self-center"
                        title="Remove skill"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {skillsetItems.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddSkillsetItem}
                  className="py-1.5 px-3 rounded-xl border border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/40 hover:bg-slate-900 text-slate-300 hover:text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Skill ({skillsetItems.length}/5)</span>
                </button>
              )}
            </div>
          )}

          {/* Effect Description (Power, Relic, Hardware) */}
          {creationType !== 'skillset' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="font-bold text-slate-300">Effect Description</span>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold mr-0.5">Insert Icon:</span>
                  {ATTRIBUTE_EFFECT_ICONS.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => insertIconAtCursor(item.icon)}
                      className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      title={`Insert ${item.icon} at cursor`}
                    >
                      <span>{item.label}</span>
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
          )}

          {/* Visual Description (Relic & Hardware Only) */}
          {(creationType === 'relic' || creationType === 'hardware') && (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-300">Visual Description</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Ornate bronze band with azure runes, sleek matte-black titanium weave..."
                className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
              />
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
