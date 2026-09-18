// src/components/sheet/MovementCard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { MovementRateData } from '../../types/game';
import { resolveStatHooks } from '../../utils/statHooks';

export const MovementCard: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const statHooks = useMemo(() => resolveStatHooks(activeCharacter?.sheet_data), [activeCharacter?.sheet_data]);

  const mrData: MovementRateData = activeCharacter?.sheet_data?.movement_rate || {
    armored: 6,
    shield: 'n/a',
  };

  const [mrAdjInput, setMrAdjInput] = useState(() => {
    const v = activeCharacter?.sheet_data?.mr_adj;
    return v !== undefined && v !== 0 ? String(v) : '';
  });

  useEffect(() => {
    const v = activeCharacter?.sheet_data?.mr_adj;
    setMrAdjInput(v !== undefined && v !== 0 ? String(v) : '');
  }, [activeCharacter?.id, activeCharacter?.sheet_data?.mr_adj]);

  const shieldSlot = activeCharacter?.sheet_data?.shield_slot;
  const isShieldEquipped = shieldSlot?.equipped ?? false;
  let derivedShieldDrawn: string | number = 'n/a';
  if (isShieldEquipped) {
    const mrAdjustmentStr = shieldSlot?.mr_adjustment || shieldSlot?.effect || '';
    const match = mrAdjustmentStr.match(/-?\d+/);
    const penalty = match ? parseInt(match[0], 10) : 0;
    const armoredMR = mrData.armored ?? 6;
    derivedShieldDrawn = Math.max(1, armoredMR + penalty);
  } else if (typeof mrData.shield === 'number') {
    derivedShieldDrawn = Math.max(1, mrData.shield);
  }

  const handleApplyMrAdj = () => {
    const trimmed = mrAdjInput.trim();
    const parsed = trimmed === '' ? 0 : parseInt(trimmed, 10);
    if (isNaN(parsed)) {
      const currentStored = activeCharacter?.sheet_data?.mr_adj;
      setMrAdjInput(currentStored !== undefined && currentStored !== 0 ? String(currentStored) : '');
      return;
    }

    const oldAdj = activeCharacter?.sheet_data?.mr_adj || 0;
    const delta = parsed - oldAdj;

    if (delta !== 0) {
      updateActiveSheetData((prev) => {
        const currentMr = prev.movement_rate || { armored: 6, shield: 'n/a' };
        const currentArmored = typeof currentMr.armored === 'number' ? currentMr.armored : 6;
        const newArmored = Math.max(1, currentArmored + delta);

        let newShield: number | string = currentMr.shield;
        if (typeof currentMr.shield === 'number') {
          newShield = Math.max(1, currentMr.shield + delta);
        } else if (typeof derivedShieldDrawn === 'number') {
          newShield = Math.max(1, derivedShieldDrawn + delta);
        }

        return {
          ...prev,
          mr_adj: parsed,
          movement_rate: {
            ...currentMr,
            armored: newArmored,
            shield: newShield,
          },
        };
      });
      saveActiveCharacter();
      setMrAdjInput(parsed !== 0 ? String(parsed) : (trimmed === '0' ? '0' : ''));
    } else {
      setMrAdjInput(parsed !== 0 ? String(parsed) : (trimmed === '0' ? '0' : ''));
    }
  };

  return (
    <div className="bg-gradient-to-b from-teal-950/30 via-slate-900/90 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-teal-500/90 p-4 flex flex-col gap-3 shadow-lg shadow-teal-950/20">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-teal-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-teal-950/90 border border-teal-500/50 text-teal-300 flex items-center justify-center shadow-[0_0_12px_rgba(20,184,166,0.25)]">
            <span className="text-base leading-none">👣</span>
          </div>
          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-teal-200 uppercase">
            Movement Rate (MR)
          </h3>
          <CardHelpButton ruleKey="movement_rate.basics" />
        </div>

        {/* Jump d👣 Pill Badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-teal-500/40 text-teal-300 text-xs font-mono font-bold shadow-sm"
          title="Jump distance is d👣 (rolls d(MR) ≤ MR based on active MR: Armored or Shield Drawn). Standing Jump: d👣 (M action) | Running Jump: MR + d👣 (AM action)"
        >
          <span className="text-[11px] text-slate-300 font-sans font-semibold">Jump</span>
          <span className="text-amber-300 font-extrabold tracking-wide">d👣</span>
        </div>
      </div>

      {/* Main Card View: 3-Box Metric Strip */}
      <div className="flex flex-wrap items-center gap-3 pt-0.5 animate-fadeIn">
        {/* Armored MR Box */}
        <div
          className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 w-fit ${
            statHooks.mrBonus !== 0 ? 'bg-purple-950/40 border-purple-500/50' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-300">Armored 👣</span>
          <div
            className="w-9 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
            title={
              statHooks.mrBonus !== 0
                ? `Modified by active trait hook (${statHooks.mrBonus >= 0 ? '+' : ''}${statHooks.mrBonus} MR)`
                : 'Auto-updated matching equipped armor Armored Movement Rate'
            }
          >
            {Math.max(1, (mrData.armored ?? 6) + statHooks.mrBonus)}
          </div>
        </div>

        {/* Shield Drawn MR Box */}
        <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-2 w-fit">
          <span className="text-[11px] font-bold text-slate-300">Shield Drawn 👣</span>
          <div
            className="px-2 bg-slate-900 border border-slate-800 rounded py-0.5 text-xs font-mono font-extrabold text-teal-300 text-center"
            title="Auto-calculated Armored MR reduced by shield MR penalty (min 1)"
          >
            {derivedShieldDrawn}
          </div>
        </div>

        {/* Adj [text box] */}
        <div className="px-3 py-1.5 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center gap-1.5 w-fit">
          <span className="text-[11px] font-bold text-slate-400">Adj</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="±0"
            value={mrAdjInput}
            onChange={(e) => setMrAdjInput(e.target.value)}
            onBlur={handleApplyMrAdj}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyMrAdj()}
            className="w-10 bg-slate-900 text-teal-300 text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-slate-700 outline-none text-center focus:border-teal-500"
            title="Enter positive or negative integer for current Movement Rate modifier (hard floor 1)"
          />
        </div>
      </div>
    </div>
  );
};
