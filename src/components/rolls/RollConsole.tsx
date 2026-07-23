// src/components/rolls/RollConsole.tsx
import React, { useState } from 'react';
import { Dices, Sparkles, CheckSquare, Zap } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey, DieRating } from '../../types/game';
import { executeHybridRoll, RollResult } from '../../lib/dice';

interface RollConsoleProps {
  onRollComplete: (result: RollResult) => void;
}

interface AttributeOpt {
  key: AttributeKey;
  name: string;
  emoji: string;
}

const ATTRIBUTES: AttributeOpt[] = [
  { key: 'magic', name: 'Magic', emoji: '✨' },
  { key: 'might', name: 'Might', emoji: '💪' },
  { key: 'mind', name: 'Mind', emoji: '👁️' },
  { key: 'motion', name: 'Motion', emoji: '🏃' },
  { key: 'moxie', name: 'Moxie', emoji: '🫀' },
];

export const RollConsole: React.FC<RollConsoleProps> = ({ onRollComplete }) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  const sheet = activeCharacter?.sheet_data;
  const diceRatings = sheet?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const [selectedAttrKey, setSelectedAttrKey] = useState<AttributeKey>('might');
  const [skillBonus, setSkillBonus] = useState<number>(0);
  const [modifier, setModifier] = useState<number>(0);
  const [dcTarget, setDcTarget] = useState<number>(12);
  const [selectedAbilitySlotIndex, setSelectedAbilitySlotIndex] = useState<number | null>(null);
  const [consumeUsageBox, setConsumeUsageBox] = useState<boolean>(true);
  const [spendFocus, setSpendFocus] = useState<boolean>(false);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);

  const activeAttr = ATTRIBUTES.find((a) => a.key === selectedAttrKey) || ATTRIBUTES[0];
  const dieRating: DieRating = diceRatings[selectedAttrKey] || 'd4';
  const currentFocusDie = sheet?.focus_die_current || 'd4';

  // Compile active character abilities (powers + spells)
  const populatedPowers = (sheet?.power_slots || []).map((s, idx) => ({ ...s, slotType: 'power' as const, index: idx }));
  const populatedSpells = (sheet?.spell_slots || []).map((s, idx) => ({ ...s, slotType: 'spell' as const, index: idx }));
  const allAbilities = [...populatedPowers, ...populatedSpells].filter((s) => s.name && s.name.trim().length > 0);

  const selectedAbility = selectedAbilitySlotIndex !== null ? allAbilities[selectedAbilitySlotIndex] : null;

  const handleTriggerRoll = () => {
    setIsRolling(true);

    setTimeout(() => {
      const mode = skillBonus === 4 ? 'advantage' : skillBonus === 2 ? 'skilled' : 'unskilled';
      const result = executeHybridRoll({
        attribute: selectedAttrKey,
        attributeName: activeAttr.name,
        dieRating,
        mode,
        skillBonus,
        modifier,
        difficultyTarget: dcTarget,
        abilityName: selectedAbility?.name,
        spendFocus,
        currentFocusDie,
      });

      setLastRoll(result);
      setIsRolling(false);
      onRollComplete(result);

      // Auto-step down Focus Die if spent
      if (result.newFocusDie) {
        updateActiveSheetData((prev) => ({
          ...prev,
          focus_die_current: result.newFocusDie,
        }));
        saveActiveCharacter();
      }

      // Auto-consume usage box on character sheet if selected
      if (selectedAbility && consumeUsageBox) {
        updateActiveSheetData((prev) => {
          const slotKey = selectedAbility.slotType === 'power' ? 'power_slots' : 'spell_slots';
          const updatedSlots = [...(prev[slotKey] || [])];
          const targetSlot = { ...updatedSlots[selectedAbility.index] };
          const checkedArr = [...(targetSlot.checked || [false, false, false])];

          // Find first unchecked box and check it
          const firstUnchecked = checkedArr.findIndex((c) => !c);
          if (firstUnchecked !== -1) {
            checkedArr[firstUnchecked] = true;
            targetSlot.checked = checkedArr;
            updatedSlots[selectedAbility.index] = targetSlot;
          }

          return { ...prev, [slotKey]: updatedSlots };
        });
        saveActiveCharacter();
      }
    }, 250);
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-outfit font-bold text-base text-slate-100 flex items-center gap-2">
          <Dices className="w-5 h-5 text-indigo-400" />
          Action Console & Dice Roller
        </h3>
        <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/25">
          Active Die: {dieRating}
        </span>
      </div>

      {/* Attribute Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          1. Select Attribute
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {ATTRIBUTES.map((attr) => {
            const isSelected = attr.key === selectedAttrKey;
            const attrDie = diceRatings[attr.key] || 'd4';
            return (
              <button
                key={attr.key}
                onClick={() => setSelectedAttrKey(attr.key)}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  isSelected
                    ? 'bg-indigo-600/25 border-indigo-500 text-slate-100 shadow-md shadow-indigo-600/20'
                    : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-750 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">{attr.emoji}</span>
                  <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                    {attrDie}
                  </span>
                </div>
                <span className="font-outfit font-bold text-xs">{attr.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Skill Training & Modifier Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Skill Bonus */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            2. Skill Training
          </label>
          <div className="flex items-center gap-1.5">
            {[
              { label: 'Unskilled (+0)', val: 0 },
              { label: 'Skilled (+2)', val: 2 },
              { label: 'Expert (+4)', val: 4 },
            ].map((s) => (
              <button
                key={s.val}
                onClick={() => setSkillBonus(s.val)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  skillBonus === s.val
                    ? 'bg-purple-600/25 border-purple-500 text-purple-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Flat Modifier */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            3. Additional Modifier
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={modifier}
              onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-100 outline-none focus:border-indigo-500"
              placeholder="+0"
            />
          </div>
        </div>

        {/* Target DC */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            4. Target DC
          </label>
          <select
            value={dcTarget}
            onChange={(e) => setDcTarget(parseInt(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-indigo-500"
          >
            <option value={8}>DC 8 (Easy)</option>
            <option value={12}>DC 12 (Moderate)</option>
            <option value={15}>DC 15 (Hard)</option>
            <option value={18}>DC 18 (Very Hard)</option>
            <option value={22}>DC 22 (Heroic)</option>
          </select>
        </div>
      </div>

      {/* Ability Trigger & Usage Consumption */}
      {allAbilities.length > 0 && (
        <div className="p-3.5 bg-slate-950/60 rounded-lg border border-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-2/3">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <select
              value={selectedAbilitySlotIndex !== null ? selectedAbilitySlotIndex : ''}
              onChange={(e) =>
                setSelectedAbilitySlotIndex(e.target.value !== '' ? parseInt(e.target.value) : null)
              }
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg outline-none focus:border-indigo-500"
            >
              <option value="">No Ability Triggered (Standard Roll)</option>
              {allAbilities.map((ab, idx) => (
                <option key={idx} value={idx}>
                  {ab.name} [{ab.action || 'Ability'}] ({ab.slotType})
                </option>
              ))}
            </select>
          </div>

          {selectedAbility && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={consumeUsageBox}
                onChange={(e) => setConsumeUsageBox(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
              />
              <span className="flex items-center gap-1">
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                Consume Usage Box
              </span>
            </label>
          )}
        </div>
      )}

      {/* Focus Die Spend Option */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-purple-500/30 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-bold text-purple-300 cursor-pointer">
          <input
            type="checkbox"
            checked={spendFocus}
            disabled={currentFocusDie === 'Exhausted'}
            onChange={(e) => setSpendFocus(e.target.checked)}
            className="w-4 h-4 rounded border-purple-700 bg-slate-900 text-purple-500 focus:ring-0 cursor-pointer"
          />
          <span className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-purple-400" />
            Spend Focus Die on this roll ({currentFocusDie !== 'Exhausted' ? `Current: ${currentFocusDie}` : 'EXHAUSTED'})
          </span>
        </label>
        {currentFocusDie !== 'Exhausted' && (
          <span className="text-[10px] font-mono text-purple-300/80 italic font-semibold">
            Remains same on 1 or Max; steps down otherwise
          </span>
        )}
      </div>

      {/* Roll Action Button */}
      <button
        onClick={handleTriggerRoll}
        disabled={isRolling}
        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-outfit font-extrabold text-sm tracking-wider uppercase rounded-xl border border-indigo-400/30 shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Dices className={`w-5 h-5 ${isRolling ? 'animate-spin' : ''}`} />
        {isRolling ? 'Rolling Dice...' : `Roll ${dieRating} for ${activeAttr.name}`}
      </button>

      {/* Die Outcome Result Card */}
      {lastRoll && (
        <div
          className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
            lastRoll.outcome === 'Critical Success'
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : lastRoll.outcome === 'Success'
              ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200'
              : lastRoll.outcome === 'Partial Success'
              ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-outfit font-extrabold text-base uppercase tracking-wider">
              {lastRoll.outcome}
            </span>
            <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-900/80 rounded border border-slate-800">
              Total {lastRoll.total} vs DC {lastRoll.request.difficultyTarget}
            </span>
          </div>
          <p className="text-xs leading-relaxed opacity-90">{lastRoll.summary}</p>
        </div>
      )}
    </div>
  );
};
