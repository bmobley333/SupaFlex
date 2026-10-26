// src/components/sheet/PinnedDefenseRibbon.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ArmorData, MovementRateData, ShieldData } from '../../types/game';
import { resolveStatHooks } from '../../utils/statHooks';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { CardHelpButton } from '../common/CardHelpButton';
import { isMsoEntry } from '../../utils/kitUtils';
import { getDieNumFromStr } from '../../utils/tacticalTableUtils';

export const PinnedDefenseRibbon: React.FC = () => {
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
    </div>
  );
};
