// src/components/sheet/PinnedDefenseRibbon.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import {
  ArmorData,
  MovementRateData,
  ShieldData,
  getPendingVitalityRollLevels,
} from '../../types/game';
import { resolveStatHooks } from '../../utils/statHooks';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { CardHelpButton } from '../common/CardHelpButton';
import { isMsoEntry } from '../../utils/kitUtils';
import { getDieNumFromStr } from '../../utils/tacticalTableUtils';

interface PinnedDefenseRibbonProps {
  onOpenVitalityManager?: () => void;
}

export const PinnedDefenseRibbon: React.FC<PinnedDefenseRibbonProps> = ({
  onOpenVitalityManager,
}) => {
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const {
    activeCharacter,
    armorCatalog,
    shieldsCatalog,
    updateActiveSheetData,
    saveActiveCharacter,
  } = useCharacterStore();

  const sheetData = activeCharacter?.sheet_data;
  const statHooks = useMemo(() => resolveStatHooks(sheetData), [sheetData]);

  // 0. Compact Vitality State & Handlers
  const [damageInput, setDamageInput] = useState('');
  const [healInput, setHealInput] = useState('');
  const [vitAdjInput, setVitAdjInput] = useState(() => {
    const v = sheetData?.vit_adj;
    return v !== undefined && v !== 0 ? String(v) : '';
  });
  const [isDraggingVit, setIsDraggingVit] = useState(false);
  const vitBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = sheetData?.vit_adj;
    setVitAdjInput(v !== undefined && v !== 0 ? String(v) : '');
  }, [activeCharacter?.id, sheetData?.vit_adj]);

  const maxVit = sheetData?.vitality_max || activeCharacter?.hp || 10;
  const currentVit = sheetData?.current_vitality ?? maxVit;
  const vitPercent = maxVit > 0 ? Math.min(100, Math.max(0, (currentVit / maxVit) * 100)) : 100;
  const pendingVitLevels = useMemo(
    () => (sheetData ? getPendingVitalityRollLevels(sheetData, activeCharacter?.hp) : []),
    [sheetData, activeCharacter?.hp]
  );
  const hasPendingVitRoll = pendingVitLevels.length > 0;

  const handleVitChange = (delta: number) => {
    updateActiveSheetData((prev) => {
      const nextVit = Math.min(
        prev.vitality_max,
        (prev.current_vitality ?? prev.vitality_max) + delta
      );
      return { ...prev, current_vitality: nextVit };
    });
    saveActiveCharacter();
  };

  const handleApplyDamage = () => {
    const val = parseInt(damageInput, 10);
    if (!isNaN(val) && val > 0) {
      handleVitChange(-val);
    }
    setDamageInput('');
  };

  const handleApplyHeal = () => {
    const val = parseInt(healInput, 10);
    if (!isNaN(val) && val > 0) {
      handleVitChange(val);
    }
    setHealInput('');
  };

  const handleApplyVitAdj = () => {
    if (!sheetData) return;
    const trimmed = vitAdjInput.trim();
    const parsed = trimmed === '' ? 0 : parseInt(trimmed, 10);
    if (isNaN(parsed)) {
      const currentStored = sheetData.vit_adj;
      setVitAdjInput(currentStored !== undefined && currentStored !== 0 ? String(currentStored) : '');
      return;
    }

    const oldAdj = sheetData.vit_adj || 0;
    const delta = parsed - oldAdj;

    if (delta !== 0) {
      const currentMax = sheetData.vitality_max || 10;
      const currentVal = sheetData.current_vitality ?? currentMax;
      const newMax = Math.max(1, currentMax + delta);
      const actualDelta = newMax - currentMax;
      const newCurrent = currentVal + actualDelta;
      const newAdj = oldAdj + actualDelta;

      updateActiveSheetData((prev) => ({
        ...prev,
        vit_adj: newAdj,
        vitality_max: newMax,
        current_vitality: newCurrent,
      }));
      saveActiveCharacter();
      setVitAdjInput(newAdj !== 0 ? String(newAdj) : trimmed === '0' ? '0' : '');
    } else {
      setVitAdjInput(parsed !== 0 ? String(parsed) : trimmed === '0' ? '0' : '');
    }
  };

  const updateVitFromPointer = (clientX: number, shouldSave: boolean = false) => {
    if (!vitBarRef.current || maxVit <= 0) return;
    const rect = vitBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = x / rect.width;
    const newVit = Math.round(ratio * maxVit);

    updateActiveSheetData((prev) => ({
      ...prev,
      current_vitality: newVit,
    }));
    if (shouldSave) {
      saveActiveCharacter();
    }
  };

  const handleVitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingVit(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateVitFromPointer(e.clientX, false);
  };

  const handleVitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingVit) {
      updateVitFromPointer(e.clientX, false);
    }
  };

  const handleVitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingVit) {
      setIsDraggingVit(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      updateVitFromPointer(e.clientX, true);
    }
  };

  const handleVitPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingVit) {
      setIsDraggingVit(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      saveActiveCharacter();
    }
  };

  const attributeDice = (sheetData?.attribute_dice || {
    might: 'd8',
    motion: 'd8',
    mind: 'd6',
    magic: 'd4',
    moxie: 'd4',
  }) as Record<string, string>;

  const derivedDodge = getDieNumFromStr(attributeDice.motion);
  const derivedBlock = getDieNumFromStr(attributeDice.might);

  // 1. Armor State
  const armor: ArmorData = sheetData?.armor_slot || {
    id: 'arm_none',
    name: 'Unarmored',
    sk: true,
    ar: 0,
    requirement: '💪 4',
    mr: '👣8',
  };
  const armorNotes = useMemo(() => {
    return (
      armor.notes ||
      (armorCatalog || []).find((a) => a.name.toLowerCase() === armor.name.toLowerCase())?.notes
    );
  }, [armor.name, armor.notes, armorCatalog]);

  const computedArDisplay = useMemo(() => {
    const rawVal =
      (statHooks.effectiveArOverride !== undefined
        ? statHooks.effectiveArOverride
        : armor.ar ?? 0) + statHooks.arBonus;
    const numericVal =
      typeof rawVal === 'number'
        ? rawVal
        : parseInt(String(rawVal).replace(/[^0-9]/g, ''), 10);
    return numericVal > 0 ? `d${numericVal}` : '0';
  }, [armor.ar, statHooks.arBonus, statHooks.effectiveArOverride]);

  // 2. Shield State
  const shield: ShieldData = sheetData?.shield_slot || {
    id: 'shd_default',
    equipped: false,
    name: 'Round Shield',
    sk: true,
    requirement: '💪 4',
    max_block: 12,
    mr_adjustment: '👣0',
    cost: '5g',
  };
  const shieldNotes = useMemo(() => {
    return (
      shield.notes ||
      (shieldsCatalog || []).find((s) => s.name.toLowerCase() === shield.name.toLowerCase())?.notes
    );
  }, [shield.name, shield.notes, shieldsCatalog]);

  // 3. Movement Rate State
  const mrData: MovementRateData = sheetData?.movement_rate || {
    armored: 6,
    shield: 'n/a',
  };

  const [mrAdjInput, setMrAdjInput] = useState(() => {
    const v = sheetData?.mr_adj;
    return v !== undefined && v !== 0 ? String(v) : '';
  });

  useEffect(() => {
    const v = sheetData?.mr_adj;
    setMrAdjInput(v !== undefined && v !== 0 ? String(v) : '');
  }, [activeCharacter?.id, sheetData?.mr_adj]);

  const isShieldEquipped = shield?.equipped ?? false;
  let derivedShieldDrawn: string | number = 'n/a';
  if (isShieldEquipped) {
    const mrAdjustmentStr = shield?.mr_adjustment || shield?.effect || '';
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
      const currentStored = sheetData?.mr_adj;
      setMrAdjInput(currentStored !== undefined && currentStored !== 0 ? String(currentStored) : '');
      return;
    }

    const oldAdj = sheetData?.mr_adj || 0;
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
    }
    setMrAdjInput(parsed !== 0 ? String(parsed) : trimmed === '0' ? '0' : '');
  };

  // 4. Socketed Chaos Gems Count
  const equippedGemsCount = useMemo(() => {
    const slots = sheetData?.chaos_gauntlet_slots;
    if (!Array.isArray(slots)) return 0;
    return slots.filter((s) => s && s.gem && s.gem.name && s.gem.name.trim() !== '').length;
  }, [sheetData?.chaos_gauntlet_slots]);

  const openManager = (key: 'armor' | 'shields' | 'chaos_gauntlet') => {
    window.dispatchEvent(new CustomEvent('supaflex:open-manager', { detail: key }));
  };

  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-2">
      {/* 1. ARMOR & DODGE SEGMENT */}
      <div className="flex items-center gap-2 bg-slate-950/90 border border-amber-500/30 rounded-xl px-2.5 py-1 shadow-inner">
        <button
          type="button"
          onClick={() => openManager('armor')}
          className="flex items-center gap-1.5 group cursor-pointer text-left"
          title="Open Armor Manager"
        >
          <span className="text-sm group-hover:scale-110 transition-transform">🧥</span>
          <div
            className={`w-4 h-4 flex items-center justify-center rounded border shrink-0 ${
              armor.sk ?? true
                ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60'
                : 'bg-rose-950/80 text-rose-400 border-rose-500/60'
            }`}
            title={(armor.sk ?? true) ? 'Skilled Armor' : 'Unskilled Armor'}
          >
            {(armor.sk ?? true) ? (
              <Check className="w-3 h-3 stroke-[3]" />
            ) : (
              <X className="w-3 h-3 stroke-[3]" />
            )}
          </div>
          <span
            className={`text-xs font-bold truncate max-w-[150px] group-hover:text-amber-200 transition-colors ${
              isGsUnlocked && isMsoEntry(armor.name) ? 'text-purple-300' : 'text-slate-100'
            }`}
          >
            {isGsUnlocked && isMsoEntry(armor.name) ? `🌌 ${armor.name}` : armor.name}
          </span>
        </button>
        <ItemNotesPopover notes={armorNotes} itemName={armor.name} inline />

        <div className="h-3.5 w-[1px] bg-slate-800 mx-0.5" />

        <div
          className="flex items-center gap-1 text-xs"
          title="Dodge Defense rating (derived from Motion 🏃)"
        >
          <span className="text-slate-400 font-semibold text-[11px]">Dodge🏃</span>
          <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono font-extrabold text-amber-300">
            {derivedDodge}
          </span>
        </div>

        <div
          className="flex items-center gap-1 text-xs"
          title={
            statHooks.effectiveArOverride !== undefined || statHooks.arBonus !== 0
              ? 'Armor Rating modified by active Trait Hook'
              : 'Equipped Armor Rating (exploding die)'
          }
        >
          <span className="text-slate-400 font-semibold text-[11px]">AR🧥</span>
          <span
            className={`px-1.5 py-0.5 bg-slate-900 border rounded font-mono font-extrabold ${
              statHooks.effectiveArOverride !== undefined || statHooks.arBonus !== 0
                ? 'text-cyan-300 border-purple-500/50'
                : 'text-amber-300 border-slate-800'
            }`}
          >
            {computedArDisplay}
          </span>
        </div>

        <button
          type="button"
          onClick={() => openManager('armor')}
          className="p-0.5 px-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/30 text-[10px] cursor-pointer transition-colors"
          title="Open Armor Manager"
        >
          ✏️
        </button>
      </div>

      {/* 2. SHIELD & BLOCK SEGMENT */}
      <div className="flex items-center gap-2 bg-slate-950/90 border border-cyan-500/30 rounded-xl px-2.5 py-1 shadow-inner">
        <button
          type="button"
          onClick={() => openManager('shields')}
          className="flex items-center gap-1.5 group cursor-pointer text-left"
          title="Open Shields Manager"
        >
          <span className="text-sm group-hover:scale-110 transition-transform">🛡️</span>
          {shield.equipped ? (
            <>
              <div
                className={`w-4 h-4 flex items-center justify-center rounded border shrink-0 ${
                  shield.sk
                    ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/60'
                    : 'bg-rose-950/80 text-rose-400 border-rose-500/60'
                }`}
                title={shield.sk ? 'Skilled Shield' : 'Unskilled Shield'}
              >
                {shield.sk ? (
                  <Check className="w-3 h-3 stroke-[3]" />
                ) : (
                  <X className="w-3 h-3 stroke-[3]" />
                )}
              </div>
              <span
                className={`text-xs font-bold truncate max-w-[140px] group-hover:text-cyan-200 transition-colors ${
                  isGsUnlocked && isMsoEntry(shield.name) ? 'text-purple-300' : 'text-slate-100'
                }`}
              >
                {isGsUnlocked && isMsoEntry(shield.name) ? `🌌 ${shield.name}` : shield.name}
              </span>
            </>
          ) : (
            <span className="text-xs italic text-slate-500 group-hover:text-slate-300 transition-colors">
              No Shield
            </span>
          )}
        </button>

        {shield.equipped && (
          <>
            <ItemNotesPopover notes={shieldNotes} itemName={shield.name} inline />
            <div className="h-3.5 w-[1px] bg-slate-800 mx-0.5" />
            <div
              className="flex items-center gap-1 text-xs"
              title="Shield Block rating (derived from Might 💪)"
            >
              <span className="text-slate-400 font-semibold text-[11px]">Blk💪</span>
              <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono font-extrabold text-amber-300">
                {derivedBlock}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs" title="Equipped Shield Block Cap">
              <span className="text-slate-400 font-semibold text-[11px]">Cap</span>
              <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono font-extrabold text-cyan-300">
                {shield.max_block ?? 'n/a'}
              </span>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={() => openManager('shields')}
          className="p-0.5 px-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 text-[10px] cursor-pointer transition-colors"
          title="Open Shields Manager"
        >
          ✏️
        </button>
      </div>

      {/* 3. MOVEMENT RATE (👣 MR) SEGMENT */}
      <div className="flex items-center gap-2 bg-slate-950/90 border border-teal-500/30 rounded-xl px-2.5 py-1 shadow-inner">
        <span className="text-sm" title="Movement Rate (MR)">
          👣
        </span>
        <div className="flex items-center gap-1 text-xs" title="Armored Movement Rate">
          <span className="text-slate-400 font-semibold text-[11px]">MR</span>
          <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono font-extrabold text-teal-300">
            {Math.max(1, (mrData.armored ?? 6) + statHooks.mrBonus)}
          </span>
        </div>

        {isShieldEquipped && (
          <div className="flex items-center gap-1 text-xs" title="Shield Drawn Movement Rate">
            <span className="text-slate-400 font-semibold text-[11px]">Shld👣</span>
            <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 rounded font-mono font-extrabold text-teal-300">
              {derivedShieldDrawn}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 text-xs" title="Manual MR Adjustment">
          <span className="text-slate-500 font-semibold text-[10px]">Adj</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="±0"
            value={mrAdjInput}
            onChange={(e) => setMrAdjInput(e.target.value)}
            onBlur={handleApplyMrAdj}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyMrAdj()}
            className="w-8 bg-slate-900 text-teal-300 text-xs font-mono font-bold px-1 py-0.5 rounded border border-slate-700 outline-none text-center focus:border-teal-500"
          />
        </div>
        <CardHelpButton ruleKey="movement_rate.basics" />
      </div>

      {/* 4. CHAOS GAUNTLET QUICK LAUNCHER */}
      <button
        type="button"
        onClick={() => openManager('chaos_gauntlet')}
        className="flex items-center gap-1.5 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/40 rounded-xl px-2.5 py-1 text-xs font-bold text-purple-200 hover:text-white transition-all cursor-pointer shadow-sm"
        title="Open Chaos Gauntlet & Gems Manager"
      >
        <span>💎</span>
        <span className="font-outfit uppercase tracking-wider text-[11px]">Gauntlet</span>
        <span className="px-1.5 py-0.2 bg-slate-950 rounded border border-purple-500/40 font-mono text-[10px] text-purple-300">
          {equippedGemsCount}/6
        </span>
      </button>

      {/* 5. COMPACT VITALITY (❤️ VIT) CAPSULE */}
      <div
        className={`flex items-center gap-1.5 bg-slate-950/90 border rounded-xl px-2.5 py-1 shadow-inner transition-all ${
          hasPendingVitRoll
            ? 'border-amber-500/70 ring-1 ring-amber-500/30'
            : currentVit <= 0
            ? 'border-rose-500/70 ring-1 ring-rose-500/30'
            : 'border-emerald-500/35'
        }`}
      >
        {/* Heart + Current/Max Vit Readout */}
        <button
          type="button"
          onClick={onOpenVitalityManager}
          className="flex items-center gap-1 group cursor-pointer text-left shrink-0"
          title="Click to open Vitality Manager"
        >
          <span className="text-sm group-hover:scale-110 transition-transform">❤️</span>
          <span
            className={`text-xs font-extrabold font-outfit tabular-nums ${
              currentVit < 0
                ? 'text-rose-500'
                : vitPercent >= 100
                ? 'text-emerald-400'
                : vitPercent <= 50
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}
          >
            {currentVit}
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-400 tabular-nums">
            /{maxVit}
          </span>
        </button>

        {/* Mini Draggable Progress Bar */}
        <div
          ref={vitBarRef}
          onPointerDown={handleVitPointerDown}
          onPointerMove={handleVitPointerMove}
          onPointerUp={handleVitPointerUp}
          onPointerCancel={handleVitPointerCancel}
          className="relative w-14 h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 cursor-ew-resize select-none touch-none group transition-all hover:border-emerald-500/50 shrink-0"
          title={`Vitality: ${currentVit}/${maxVit} (${currentVit < 0 ? 0 : Math.round(vitPercent)}%) — Drag left/right to adjust`}
        >
          <div
            className={`h-full relative ${
              isDraggingVit ? 'transition-none' : 'transition-all duration-150'
            } ${
              currentVit < 0
                ? 'bg-rose-950/40'
                : vitPercent >= 100
                ? 'bg-emerald-500'
                : vitPercent <= 50
                ? 'bg-rose-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${currentVit < 0 ? 0 : vitPercent}%` }}
          />
        </div>

        {/* Conditional Pending Level-Up Roll or Death/Unconsciousness Badge */}
        {hasPendingVitRoll && (
          <button
            type="button"
            onClick={onOpenVitalityManager}
            className="px-1.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/50 rounded font-outfit font-extrabold text-[10px] uppercase tracking-wider animate-pulse cursor-pointer shrink-0"
            title={
              pendingVitLevels.length > 1
                ? `Click to roll ${pendingVitLevels.length} pending Free Per Level Vitality Rolls (Levels ${pendingVitLevels.join(', ')})`
                : `Click to roll your Level ${pendingVitLevels[0]} Free Per Level Vitality Roll (0 AP)`
            }
          >
            ⚠️ Roll{pendingVitLevels.length > 1 ? ` ×${pendingVitLevels.length}` : ''}
          </button>
        )}
        {currentVit <= 0 && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-950 text-rose-300 rounded border border-rose-500/40 font-bold animate-pulse shrink-0"
            title={`Vit <= 0 Affliction Order: 1. Bleed (-1 Vit on Nish) -> 2. Resist Death (🫀^${-currentVit + 5}) -> 3. Resist Unconsciousness (🫀^${-currentVit + 10})`}
          >
            💀🫀^{-currentVit + 5} 💫🫀^{-currentVit + 10}
          </span>
        )}

        <div className="h-3.5 w-[1px] bg-slate-800 mx-0.5 shrink-0" />

        {/* Quick Step Buttons (-5, -1, +1, +5) */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => handleVitChange(-5)}
            className="px-1.5 py-0.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[10px] font-mono font-bold rounded border border-rose-500/30 cursor-pointer transition-colors"
            title="Wound -5 Vit"
          >
            -5
          </button>
          <button
            type="button"
            onClick={() => handleVitChange(-1)}
            className="px-1.5 py-0.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[10px] font-mono font-bold rounded border border-rose-500/30 cursor-pointer transition-colors"
            title="Wound -1 Vit"
          >
            -1
          </button>
          <button
            type="button"
            onClick={() => handleVitChange(1)}
            className="px-1.5 py-0.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 text-[10px] font-mono font-bold rounded border border-emerald-500/30 cursor-pointer transition-colors"
            title="Heal +1 Vit"
          >
            +1
          </button>
          <button
            type="button"
            onClick={() => handleVitChange(5)}
            className="px-1.5 py-0.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 text-[10px] font-mono font-bold rounded border border-emerald-500/30 cursor-pointer transition-colors"
            title="Heal +5 Vit"
          >
            +5
          </button>
        </div>

        {/* Compact Wound (-) and Heal (+) Micro Inputs */}
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min="1"
            placeholder="-W"
            value={damageInput}
            onChange={(e) => setDamageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyDamage();
                e.currentTarget.blur();
              }
            }}
            onBlur={handleApplyDamage}
            className="w-8 bg-slate-900 text-rose-300 placeholder:text-rose-400/50 text-[10px] font-mono font-bold px-1 py-0.5 rounded border border-slate-700 outline-none text-center focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title="Wounded by: Type damage amount and press Enter or click away"
          />
          <input
            type="number"
            min="1"
            placeholder="+H"
            value={healInput}
            onChange={(e) => setHealInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleApplyHeal();
                e.currentTarget.blur();
              }
            }}
            onBlur={handleApplyHeal}
            className="w-8 bg-slate-900 text-emerald-300 placeholder:text-emerald-400/50 text-[10px] font-mono font-bold px-1 py-0.5 rounded border border-slate-700 outline-none text-center focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            title="Healed by: Type heal amount and press Enter or click away"
          />
        </div>

        {/* Max Vit Adj Input */}
        <div className="flex items-center gap-1 text-xs shrink-0" title="Max Vitality Modifier (Adj)">
          <span className="text-slate-500 font-semibold text-[10px]">Adj</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="±0"
            value={vitAdjInput}
            onChange={(e) => setVitAdjInput(e.target.value)}
            onBlur={handleApplyVitAdj}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyVitAdj()}
            className="w-8 bg-slate-900 text-emerald-300 text-xs font-mono font-bold px-1 py-0.5 rounded border border-slate-700 outline-none text-center focus:border-emerald-500"
          />
        </div>

        <CardHelpButton ruleKey="vitality.death_checks" />

        <button
          type="button"
          onClick={onOpenVitalityManager}
          className="p-0.5 px-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-[10px] cursor-pointer transition-colors shrink-0"
          title="Open Vitality Manager"
        >
          ✏️
        </button>
      </div>
    </div>
  );
};
