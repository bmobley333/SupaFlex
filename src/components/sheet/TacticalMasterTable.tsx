// src/components/sheet/TacticalMasterTable.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCcw,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Pin,
  Lock,
  Unlock,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { CardHelpButton } from '../common/CardHelpButton';
import { isMsoEntry } from '../../utils/kitUtils';
import {
  TacticalRowItem,
  TacticalRowDomain,
  RndActionsSpentState,
  projectTacticalTableRows,
  isTacticalRowDimmed,
} from '../../utils/tacticalTableUtils';

export type RollColumnPlacement = 'split' | 'right';

const ACTION_BADGE_STYLES: Record<string, string> = {
  AM: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  A: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  M: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  P: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  F: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

const DOMAIN_LEFT_BORDER: Record<TacticalRowDomain, string> = {
  weapons: 'border-l-[3px] border-l-rose-500',
  powers: 'border-l-[3px] border-l-orange-500',
  exotics: 'border-l-[3px] border-l-cyan-400',
  chaos_gems: 'border-l-[3px] border-l-fuchsia-500',
  traits: 'border-l-[3px] border-l-purple-500',
  skills: 'border-l-[3px] border-l-indigo-500',
  divider: 'border-l-[3px] border-l-slate-700',
};

export const TacticalMasterTable: React.FC = () => {
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const {
    activeCharacter,
    weaponsCatalog,
    armorCatalog,
    shieldsCatalog,
    powers,
    magicItems,
    functionsCatalog,
    modsCatalog,
    traits,
    skills,
    updateActiveSheetData,
    saveActiveCharacter,
    toggleGearPowerUsage,
    setExoticGearManagerModalOpen,
  } = useCharacterStore();

  const sheetData = activeCharacter?.sheet_data;

  // Arrange mode toggle & Secondary Bench Tray accordion state
  const [isArrangeMode, setIsArrangeMode] = useState<boolean>(false);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Roll Column Placement preference ('split' = Option A, 'right' = Option B)
  const [rollPlacement, setRollPlacement] = useState<RollColumnPlacement>(() => {
    try {
      const saved = localStorage.getItem('supaflex_tactical_roll_cols');
      return saved === 'right' ? 'right' : 'split';
    } catch {
      return 'split';
    }
  });

  const handleSetRollPlacement = (mode: RollColumnPlacement) => {
    setRollPlacement(mode);
    try {
      localStorage.setItem('supaflex_tactical_roll_cols', mode);
    } catch {}
  };

  // Floating Extended Origin Popover State
  const [activeOriginPopover, setActiveOriginPopover] = useState<{
    row: TacticalRowItem;
    rect: DOMRect;
  } | null>(null);
  const originPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (originPopoverRef.current && !originPopoverRef.current.contains(e.target as Node)) {
        setActiveOriginPopover(null);
      }
    };
    if (activeOriginPopover) {
      document.addEventListener('mousedown', handlePointerDown);
    }
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [activeOriginPopover]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // Project all Primary, Secondary, and Pinnable Skill rows
  const { primaryRows, secondaryRows, allDerivedSkills, pinnedSkillKeys } = useMemo(() => {
    return projectTacticalTableRows(sheetData, {
      weaponsCatalog: weaponsCatalog || [],
      armorCatalog: armorCatalog || [],
      shieldsCatalog: shieldsCatalog || [],
      powersCatalog: powers || [],
      magicItemsCatalog: magicItems || [],
      functionsCatalog: functionsCatalog || [],
      modsCatalog: modsCatalog || [],
      traitsCatalog: traits || [],
      skillsCatalog: skills || [],
    });
  }, [
    sheetData,
    weaponsCatalog,
    armorCatalog,
    shieldsCatalog,
    powers,
    magicItems,
    functionsCatalog,
    modsCatalog,
    traits,
    skills,
  ]);

  const rndActions: RndActionsSpentState = useMemo(() => {
    return sheetData?.rnd_actions_spent || { am: false, a: false, m: false, p: false };
  }, [sheetData?.rnd_actions_spent]);

  // Toggle a Round Action (🔷: AM, A, M, P)
  const handleToggleRndAction = (key: 'am' | 'a' | 'm' | 'p', explicitValue?: boolean) => {
    updateActiveSheetData((prev) => {
      const current = prev.rnd_actions_spent || { am: false, a: false, m: false, p: false };
      const nextVal = explicitValue !== undefined ? explicitValue : !current[key];
      return {
        ...prev,
        rnd_actions_spent: {
          ...current,
          [key]: nextVal,
        },
      };
    });
    saveActiveCharacter();
  };

  // Reset Round (🔄 Reset Rnd): Clears AM, A, M, P AND unchecks all 1-Rnd usage boxes across Powers & Exotics
  const handleResetRnd = () => {
    updateActiveSheetData((prev) => {
      const resetSlotIfOneRnd = (s: any) => {
        if (!s || !s.usage) return s;
        if (/1-rnd/i.test(s.usage) && Array.isArray(s.checked) && s.checked.some(Boolean)) {
          return {
            ...s,
            checked: s.checked.map(() => false),
          };
        }
        return s;
      };

      const nextPowers = Array.isArray(prev.power_slots)
        ? prev.power_slots.map(resetSlotIfOneRnd)
        : prev.power_slots;
      const nextSpells = Array.isArray(prev.spell_slots)
        ? prev.spell_slots.map(resetSlotIfOneRnd)
        : prev.spell_slots;

      return {
        ...prev,
        rnd_actions_spent: { am: false, a: false, m: false, p: false },
        power_slots: nextPowers,
        spell_slots: nextSpells,
      };
    });
    saveActiveCharacter();
  };

  // Clear All Encounter & Round Uses across Powers & Exotics
  const handleClearAllEncounterUses = () => {
    updateActiveSheetData((prev) => {
      const clearChecks = (s: any) =>
        s && Array.isArray(s.checked) && s.checked.some(Boolean)
          ? { ...s, checked: s.checked.map(() => false) }
          : s;
      return {
        ...prev,
        rnd_actions_spent: { am: false, a: false, m: false, p: false },
        power_slots: Array.isArray(prev.power_slots)
          ? prev.power_slots.map(clearChecks)
          : prev.power_slots,
        spell_slots: Array.isArray(prev.spell_slots)
          ? prev.spell_slots.map(clearChecks)
          : prev.spell_slots,
      };
    });
    saveActiveCharacter();
  };

  // Auto-couple helper: maps 'AM' | 'A' | 'M' | 'P' to rnd_actions_spent property
  const applyCoupledRndActionOnCheck = (
    currentRnd: RndActionsSpentState | undefined,
    action: string,
    isNowChecked: boolean
  ): RndActionsSpentState => {
    const base = { ...(currentRnd || { am: false, a: false, m: false, p: false }) };
    const upper = (action || '').toUpperCase();
    if (upper === 'AM') base.am = isNowChecked;
    else if (upper === 'A') base.a = isNowChecked;
    else if (upper === 'M') base.m = isNowChecked;
    else if (upper === 'P') base.p = isNowChecked;
    return base;
  };

  // Toggle Usage Checkbox on a Row (with automatic 🔷 Rnd Action coupling!)
  const handleToggleRowCheckbox = (row: TacticalRowItem, boxIdx: number) => {
    const currentlyChecked = Boolean(row.checked && row.checked[boxIdx]);
    const willBeChecked = !currentlyChecked;

    if (row.domain === 'powers' && row.rawPowerSlot) {
      const targetName = row.rawPowerSlot.name;
      updateActiveSheetData((prev) => {
        const nextPowers = (prev.power_slots || []).map((slot) => {
          if (slot.name !== targetName) return slot;
          const nextChecked = Array.isArray(slot.checked) ? [...slot.checked] : [];
          while (nextChecked.length <= boxIdx) nextChecked.push(false);
          nextChecked[boxIdx] = willBeChecked;
          return { ...slot, checked: nextChecked };
        });
        return {
          ...prev,
          power_slots: nextPowers,
          rnd_actions_spent: applyCoupledRndActionOnCheck(
            prev.rnd_actions_spent,
            row.action,
            willBeChecked
          ),
        };
      });
      saveActiveCharacter();
    } else if (row.domain === 'exotics' && row.rawExoticSlot) {
      // Update exotic power usage + coupled round action
      toggleGearPowerUsage(row.rawExoticSlot.name, boxIdx);
      if (row.action === 'AM' || row.action === 'A' || row.action === 'M' || row.action === 'P') {
        const key = row.action.toLowerCase() as 'am' | 'a' | 'm' | 'p';
        handleToggleRndAction(key, willBeChecked);
      }
    } else if (row.domain === 'chaos_gems' && row.rawGemSlot) {
      const slotId = row.rawGemSlot.slot_id;
      const gemName = row.name;
      const currentChecked = Array.isArray(row.checked) ? [...row.checked] : [false, false, false];
      while (currentChecked.length < 3) currentChecked.push(false);
      currentChecked[boxIdx] = willBeChecked;
      const checkedCount = currentChecked.filter(Boolean).length;

      updateActiveSheetData((prev) => {
        const currentSlots = Array.isArray(prev.chaos_gauntlet_slots)
          ? prev.chaos_gauntlet_slots.map((s) => ({ ...s }))
          : [];
        const targetIdx = currentSlots.findIndex((s) => s.slot_id === slotId);
        if (targetIdx !== -1 && currentSlots[targetIdx].gem) {
          if (checkedCount >= 3) {
            currentSlots[targetIdx] = { ...currentSlots[targetIdx], gem: null };
          } else {
            currentSlots[targetIdx] = {
              ...currentSlots[targetIdx],
              gem: {
                ...currentSlots[targetIdx].gem!,
                checked: currentChecked,
                usage: Math.max(0, 3 - checkedCount),
              },
            };
          }
        }
        return { ...prev, chaos_gauntlet_slots: currentSlots };
      });
      saveActiveCharacter();
      if (checkedCount >= 3) {
        showToast(`💥 '${gemName}' reached 0 uses and shattered into dust!`);
      }
    }
  };

  // Ensure master_table_order is materialized from current primaryRows before mutating
  const getMaterializedPrimaryOrder = (): string[] => {
    return primaryRows.map((r) => r.rowKey);
  };

  // Insert a Blank / Label Divider Row at top of Primary Table
  const handleAddDividerRow = () => {
    const newKey = `div:${Date.now().toString(36)}:`;
    const currentOrder = getMaterializedPrimaryOrder();
    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: [newKey, ...currentOrder],
    }));
    saveActiveCharacter();
    setIsArrangeMode(true);
  };

  // Update Divider Row Label
  const handleUpdateDividerLabel = (oldRowKey: string, divId: string, newLabel: string) => {
    const cleanLabel = newLabel.replace(/[\r\n]/g, '');
    const updatedKey = `div:${divId}:${cleanLabel}`;
    const currentOrder = getMaterializedPrimaryOrder();
    const nextOrder = currentOrder.map((k) => (k === oldRowKey ? updatedKey : k));
    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: nextOrder,
    }));
    saveActiveCharacter();
  };

  // Delete Divider Row
  const handleDeleteDividerRow = (rowKey: string) => {
    const currentOrder = getMaterializedPrimaryOrder().filter((k) => k !== rowKey);
    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: currentOrder,
    }));
    saveActiveCharacter();
  };

  // Move Row Up / Down in Primary Table
  const handleMovePrimaryRow = (index: number, direction: -1 | 1) => {
    const currentOrder = getMaterializedPrimaryOrder();
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;
    const swapped = [...currentOrder];
    const temp = swapped[index];
    swapped[index] = swapped[targetIdx];
    swapped[targetIdx] = temp;

    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: swapped,
    }));
    saveActiveCharacter();
  };

  // Demote Row from Primary Table to Secondary (Bench) Table
  const handleBenchRow = (rowKey: string) => {
    const currentOrder = getMaterializedPrimaryOrder().filter((k) => k !== rowKey);
    updateActiveSheetData((prev) => {
      const currentBenched = Array.isArray(prev.master_table_benched)
        ? prev.master_table_benched
        : [];
      const nextBenched = currentBenched.includes(rowKey)
        ? currentBenched
        : [...currentBenched, rowKey];
      return {
        ...prev,
        master_table_order: currentOrder,
        master_table_benched: nextBenched,
      };
    });
    saveActiveCharacter();
  };

  // Promote Row from Secondary (Bench) Table back to Primary Table
  const handlePromoteRow = (rowKey: string) => {
    const currentOrder = getMaterializedPrimaryOrder();
    updateActiveSheetData((prev) => {
      const currentBenched = Array.isArray(prev.master_table_benched)
        ? prev.master_table_benched.filter((k) => k !== rowKey)
        : [];
      const nextOrder = currentOrder.includes(rowKey) ? currentOrder : [...currentOrder, rowKey];
      return {
        ...prev,
        master_table_order: nextOrder,
        master_table_benched: currentBenched,
      };
    });
    saveActiveCharacter();
  };

  // Pin / Unpin a Derived Skill into Primary Table
  const handleTogglePinSkill = (skillRowKey: string) => {
    const currentOrder = getMaterializedPrimaryOrder();
    const isAlreadyPinned = currentOrder.includes(skillRowKey);
    const nextOrder = isAlreadyPinned
      ? currentOrder.filter((k) => k !== skillRowKey)
      : [...currentOrder, skillRowKey];

    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: nextOrder,
      master_table_benched: (prev.master_table_benched || []).filter((k) => k !== skillRowKey),
    }));
    saveActiveCharacter();
  };

  // Launch Manager Modal for a Domain
  const handleOpenDomainManager = (
    managerKey: 'weapons' | 'powers' | 'exotics' | 'traits' | 'chaos_gauntlet' | 'skills'
  ) => {
    setActiveOriginPopover(null);
    if (managerKey === 'exotics') {
      setExoticGearManagerModalOpen(true);
    } else {
      window.dispatchEvent(new CustomEvent('supaflex:open-manager', { detail: managerKey }));
    }
  };

  // Render an Individual Tactical Row (Primary or Secondary)
  const renderTacticalRow = (
    row: TacticalRowItem,
    index: number,
    totalCount: number,
    isSecondary: boolean
  ) => {
    // 1. Custom Blank / Label Divider Row
    if (row.domain === 'divider') {
      const hasLabel = Boolean(row.dividerLabel && row.dividerLabel.trim() !== '');
      return (
        <div
          key={row.rowKey}
          className={`rounded-lg transition-all flex items-center justify-between gap-2 ${
            isArrangeMode
              ? 'px-2.5 py-1.5 bg-slate-900/90 border border-dashed border-amber-500/40'
              : hasLabel
              ? 'px-3 py-1 bg-slate-950/90 border-y border-slate-800/90 my-0.5'
              : 'h-3 bg-slate-950/30 border-b border-slate-800/40 my-0.5'
          }`}
        >
          {isArrangeMode ? (
            <>
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs text-amber-400 font-mono font-bold">──</span>
                <input
                  type="text"
                  defaultValue={row.dividerLabel || ''}
                  placeholder="Optional section label (leave blank for slim spacer row)..."
                  onBlur={(e) =>
                    handleUpdateDividerLabel(row.rowKey, row.dividerId || '0', e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="bg-slate-950 text-amber-200 text-xs font-outfit font-bold tracking-wider uppercase px-2 py-0.5 rounded border border-slate-700 focus:border-amber-400 outline-none flex-1 max-w-md"
                />
                <span className="text-xs text-amber-400 font-mono font-bold">──</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMovePrimaryRow(index, -1)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                  title="Move Divider Up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === totalCount - 1}
                  onClick={() => handleMovePrimaryRow(index, 1)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                  title="Move Divider Down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDividerRow(row.rowKey)}
                  className="p-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/30 cursor-pointer"
                  title="Delete Divider Row"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : hasLabel ? (
            <div className="w-full flex items-center gap-2">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-amber-500/40" />
              <span className="font-outfit font-black text-[11px] uppercase tracking-widest text-amber-300/90 px-2">
                {row.dividerLabel}
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-amber-500/40 to-amber-500/40" />
            </div>
          ) : null}
        </div>
      );
    }

    // 2. Standard Ability Row
    const { dimmed, reason } = isTacticalRowDimmed(row, rndActions);
    const borderClass = DOMAIN_LEFT_BORDER[row.domain] || 'border-l-[3px] border-l-slate-600';
    const isMso = isGsUnlocked && isMsoEntry(row.name);
    const actUpper = row.action;
    const actStyle =
      ACTION_BADGE_STYLES[actUpper] || 'bg-slate-900 text-slate-500 border-slate-800';

    // Shared Cell Sub-Renders
    const atkDefCell = (
      <div className="w-[62px] shrink-0 flex items-center justify-center">
        {row.atkDef ? (
          <span
            className="w-full py-0.5 px-1 bg-slate-900/95 border border-cyan-500/30 rounded text-[11px] font-mono font-extrabold text-cyan-200 text-center truncate shadow-inner"
            title={`Roll: ${row.atkDef}`}
          >
            {row.atkDef}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-700 select-none">-</span>
        )}
      </div>
    );

    const dmgCell = (
      <div className="w-[56px] shrink-0 flex items-center justify-center">
        {row.dmg ? (
          <span
            className={`w-full py-0.5 px-1 bg-slate-900/95 border rounded text-[11px] font-mono font-extrabold text-center truncate shadow-inner ${
              row.dmg === '❌'
                ? 'text-rose-400 border-rose-500/40'
                : 'text-rose-300 border-rose-500/30'
            }`}
            title={
              row.dmg === '❌'
                ? 'Special Damage: Governed by loaded ammunition type'
                : `Damage: ${row.dmg}`
            }
          >
            {row.dmg}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-700 select-none">-</span>
        )}
      </div>
    );

    const actionCell = (
      <div className="w-[34px] shrink-0 flex items-center justify-center">
        {actUpper ? (
          <button
            type="button"
            onClick={() => {
              if (actUpper === 'AM' || actUpper === 'A' || actUpper === 'M' || actUpper === 'P') {
                handleToggleRndAction(actUpper.toLowerCase() as 'am' | 'a' | 'm' | 'p');
              }
            }}
            className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded border uppercase transition-transform ${actStyle} ${
              actUpper !== 'F' ? 'cursor-pointer hover:scale-105' : 'cursor-default'
            }`}
            title={
              actUpper !== 'F'
                ? `Action: ${actUpper} (Click to toggle ${actUpper} in Rnd Actions tracker)`
                : 'Free Action (F)'
            }
          >
            {actUpper}
          </button>
        ) : (
          <span className="text-[10px] font-mono text-slate-700 select-none">-</span>
        )}
      </div>
    );

    const usesAndBoxesCell = (
      <div className="w-[92px] shrink-0 flex items-center justify-start gap-1">
        {row.usage ? (
          <span
            className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] font-mono text-slate-300 shrink-0"
            title={`Usage: ${row.usage}`}
          >
            {row.usage}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-slate-700 px-1 select-none">-</span>
        )}

        {row.usageCount > 0 && (
          <div className="flex items-center gap-1 ml-0.5">
            {Array.from({ length: row.usageCount }).map((_, bIdx) => {
              const isChecked = Boolean(row.checked && row.checked[bIdx]);
              return (
                <input
                  key={bIdx}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleRowCheckbox(row, bIdx)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                  title={`Use ${bIdx + 1} of ${row.usageCount} (Auto-checks ${
                    row.action || 'Action'
                  } in Rnd Tracker)`}
                />
              );
            })}
          </div>
        )}
      </div>
    );

    const nameAndEffectCell = (
      <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pr-1">
        <span
          className={`font-outfit font-bold text-xs leading-snug inline-flex items-center gap-1 ${
            isMso ? 'text-purple-300' : 'text-slate-100'
          }`}
        >
          <span>{isMso ? `🌌 ${row.name}` : row.name}</span>
          {row.subBadge && (
            <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.1 rounded bg-slate-900 text-indigo-300 border border-indigo-500/30">
              {row.subBadge}
            </span>
          )}
          <ItemNotesPopover notes={row.notes} itemName={row.name} inline />
        </span>

        {row.effect && (
          <span className="text-xs text-slate-300 font-sans leading-snug break-words">
            <span className="text-slate-600 mr-1 select-none">—</span>
            {row.effect}
          </span>
        )}
      </div>
    );

    return (
      <div
        key={row.rowKey}
        title={dimmed && reason ? reason : undefined}
        className={`px-2 py-1.5 bg-slate-950/75 rounded-lg border border-slate-800/90 ${borderClass} flex items-center gap-2 hover:border-slate-700 transition-all ${
          dimmed ? 'opacity-35 grayscale-[55%]' : 'opacity-100'
        }`}
      >
        {/* 1. Icon-Only Type Column (28px) with Extended Origin Popover */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setActiveOriginPopover((prev) =>
              prev?.row.rowKey === row.rowKey ? null : { row, rect }
            );
          }}
          className="w-6 h-6 shrink-0 rounded-md bg-slate-900/90 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-xs cursor-pointer transition-transform hover:scale-105"
          title={`${row.origin.categoryLabel} — Click for origin details & Manager link`}
        >
          <span>{row.icon}</span>
        </button>

        {/* 2. Dynamic Column Order: Split Rolls (Option A) vs Right Rolls (Option B) */}
        {rollPlacement === 'split' ? (
          <>
            {atkDefCell}
            {actionCell}
            {usesAndBoxesCell}
            {nameAndEffectCell}
            {dmgCell}
          </>
        ) : (
          <>
            {actionCell}
            {usesAndBoxesCell}
            {nameAndEffectCell}
            {atkDefCell}
            {dmgCell}
          </>
        )}

        {/* 3. Arrange Mode Controls (Move Up/Down, Bench/Promote, Unpin Skill) */}
        {isArrangeMode && (
          <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-800">
            {!isSecondary ? (
              <>
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMovePrimaryRow(index, -1)}
                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-25 cursor-pointer"
                  title="Move Row Up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === totalCount - 1}
                  onClick={() => handleMovePrimaryRow(index, 1)}
                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-25 cursor-pointer"
                  title="Move Row Down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                {row.domain === 'skills' ? (
                  <button
                    type="button"
                    onClick={() => handleTogglePinSkill(row.rowKey)}
                    className="px-1.5 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-[10px] font-bold cursor-pointer"
                    title="Unpin Skill from Tactical Table"
                  >
                    Unpin
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBenchRow(row.rowKey)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-amber-950/80 text-slate-400 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 text-[10px] font-bold cursor-pointer"
                    title="Move to Secondary / Non-Combat Tray at bottom"
                  >
                    ⬇️ Bench
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => handlePromoteRow(row.rowKey)}
                className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer"
                title="Promote back to Primary Tactical Table"
              >
                ⬆️ Primary
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-b from-rose-950/25 via-slate-900/95 to-slate-950/95 border border-slate-800 border-t-2 border-t-rose-500/90 rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-xl relative">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="px-3 py-2 rounded-xl bg-amber-950/90 border border-amber-500/60 text-amber-200 text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-amber-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP BAR: Title + 🔷 RND ACTIONS Tracker + Arrange / Reset Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/90">
        {/* Left: Title & Help */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-rose-950/90 border border-rose-500/50 text-rose-300 flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.25)]">
            <span className="text-sm leading-none">⚔️</span>
          </div>
          <h3 className="font-outfit font-black text-sm tracking-wider text-slate-100 uppercase">
            Tactical Table
          </h3>
          <CardHelpButton ruleKey="powers.basics" />
        </div>

        {/* Center: 🔷 RND ACTIONS Checkboxes + Reset Rnd */}
        <div className="flex items-center gap-1.5 bg-slate-950/90 border border-slate-800 px-2.5 py-1 rounded-xl shadow-inner flex-wrap">
          <span
            className="text-[11px] font-outfit font-extrabold uppercase tracking-wider text-cyan-300 mr-1 flex items-center gap-1"
            title="Round Actions (🔷): Check off spent actions (or click any row's usage box) to auto-dim unavailable rows this round"
          >
            <span>🔷</span> Rnd:
          </span>

          {(
            [
              { key: 'am', label: 'AM', title: 'Attack & Move Action (Dims AM, A, and M rows)' },
              { key: 'a', label: 'A', title: 'Attack Action (Dims A and AM rows)' },
              { key: 'm', label: 'M', title: 'Move Action (Dims M and AM rows)' },
              { key: 'p', label: 'P', title: 'Partial Action — 1 per Round (Dims P rows)' },
            ] as const
          ).map((act) => {
            const isChecked = Boolean(rndActions[act.key]);
            return (
              <label
                key={act.key}
                title={act.title}
                className={`px-2 py-0.5 rounded-lg border text-xs font-mono font-extrabold flex items-center gap-1.5 cursor-pointer select-none transition-all ${
                  isChecked
                    ? 'bg-slate-900 text-slate-400 border-slate-700 opacity-75'
                    : ACTION_BADGE_STYLES[act.label]
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleRndAction(act.key)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-rose-500 focus:ring-0 cursor-pointer accent-rose-500"
                />
                <span>{act.label}</span>
              </label>
            );
          })}

          <button
            type="button"
            onClick={handleResetRnd}
            className="ml-1 px-2 py-0.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-[11px] font-bold text-indigo-200 hover:text-white flex items-center gap-1 cursor-pointer transition-all shadow-sm"
            title="Reset Round: Unchecks AM, A, M, P and clears all 1-Rnd ability usage boxes"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Rnd</span>
          </button>

          <button
            type="button"
            onClick={handleClearAllEncounterUses}
            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-all"
            title="Clear ALL Encounter (1-Enc, 2-Enc, 3-Enc) and Round checkboxes"
          >
            <span>Clear Enc</span>
          </button>
        </div>

        {/* Right: + Divider & Arrange Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleAddDividerRow}
            className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer transition-all shadow-sm"
            title="Insert a Blank Spacer or Custom Label Divider Row"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Divider</span>
          </button>

          <button
            type="button"
            onClick={() => setIsArrangeMode((prev) => !prev)}
            className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
              isArrangeMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700/80'
            }`}
            title="Toggle Arrange Mode to reorder rows, edit dividers, pin skills, or switch Roll Column placement"
          >
            {isArrangeMode ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{isArrangeMode ? 'Done Arranging' : 'Arrange'}</span>
          </button>
        </div>
      </div>

      {/* ARRANGE MODE SUB-TOOLBAR: Roll Column Switch + Pin Skill Picker + Quick Managers */}
      {isArrangeMode && (
        <div className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          {/* 1. Dyslexia-Friendly KISS 2-Option Pill Switch: Split Rolls vs Right Rolls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Roll Columns:
            </span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => handleSetRollPlacement('split')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  rollPlacement === 'split'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Option A: Place Atk^Def before Act/Uses/Name and Dmg on the far right"
              >
                <span>↔️</span>
                <span>Split Rolls</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetRollPlacement('right')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  rollPlacement === 'right'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Option B: Start row with Act/Uses/Name and group Atk^Def + Dmg on the right"
              >
                <span>➡️</span>
                <span>Right Rolls</span>
              </button>
            </div>
          </div>

          {/* 2. Pin Derived Skill into Primary Table */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1">
              <Pin className="w-3 h-3" /> Pin Skill:
            </span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleTogglePinSkill(e.target.value);
                }
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-lg outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">+ Select Derived Skill to Pin/Unpin...</option>
              {allDerivedSkills.map((sk) => {
                const isPinned = pinnedSkillKeys.has(sk.rowKey);
                return (
                  <option key={sk.rowKey} value={sk.rowKey}>
                    {isPinned ? '📌 [Pinned] ' : '+ '}
                    {sk.name} ({sk.emoji}
                    {sk.dieRating})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Quick Open Domain Managers */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Manage:</span>
            {(
              [
                { key: 'weapons', icon: '⚔️', label: 'Weapons' },
                { key: 'powers', icon: '🔥', label: 'Powers' },
                { key: 'exotics', icon: '🧿', label: 'Exotics' },
                { key: 'traits', icon: '🧬', label: 'Traits' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => handleOpenDomainManager(m.key)}
                className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* COLUMN HEADERS */}
      <div className="px-2 py-1 bg-slate-950/90 rounded-lg border border-slate-800/80 flex items-center gap-2 text-[10px] font-outfit font-extrabold uppercase tracking-wider text-slate-400">
        <div className="w-6 shrink-0 text-center" title="Domain Icon (Click any icon for Origin & Manager)">
          🌟
        </div>
        {rollPlacement === 'split' ? (
          <>
            <div className="w-[62px] shrink-0 text-center text-cyan-300/90">Atk^Def</div>
            <div className="w-[34px] shrink-0 text-center">🔷</div>
            <div className="w-[92px] shrink-0 text-left pl-1">Uses 🔄</div>
            <div className="flex-1 min-w-0">Name — Effect</div>
            <div className="w-[56px] shrink-0 text-center text-rose-300/90">Dmg</div>
          </>
        ) : (
          <>
            <div className="w-[34px] shrink-0 text-center">🔷</div>
            <div className="w-[92px] shrink-0 text-left pl-1">Uses 🔄</div>
            <div className="flex-1 min-w-0">Name — Effect</div>
            <div className="w-[62px] shrink-0 text-center text-cyan-300/90">Atk^Def</div>
            <div className="w-[56px] shrink-0 text-center text-rose-300/90">Dmg</div>
          </>
        )}
        {isArrangeMode && <div className="w-28 shrink-0 text-right pr-1">Order</div>}
      </div>

      {/* PRIMARY TACTICAL TABLE ROWS */}
      <div className="flex flex-col gap-1.5">
        {primaryRows.length > 0 ? (
          primaryRows.map((row, idx) =>
            renderTacticalRow(row, idx, primaryRows.length, false)
          )
        ) : (
          <div className="p-6 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-500 italic text-center">
            No active abilities in Primary Table. Click Arrange above to manage or promote abilities.
          </div>
        )}
      </div>

      {/* SECONDARY / EXTRAS COLLAPSIBLE BENCH TRAY */}
      {(secondaryRows.length > 0 || isArrangeMode) && (
        <div className="mt-1 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setIsSecondaryOpen((prev) => !prev)}
            className="w-full px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300 cursor-pointer transition-all"
          >
            <div className="flex items-center gap-2">
              {isSecondaryOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>📦 Secondary & Non-Combat Bench</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-amber-300">
                {secondaryRows.length}
              </span>
            </div>
            <span className="text-[11px] font-normal text-slate-500">
              {isSecondaryOpen ? 'Click to collapse' : 'Click to expand benched abilities'}
            </span>
          </button>

          {isSecondaryOpen && (
            <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-slate-800/80 animate-fadeIn">
              {secondaryRows.length > 0 ? (
                secondaryRows.map((row, idx) =>
                  renderTacticalRow(row, idx, secondaryRows.length, true)
                )
              ) : (
                <p className="text-xs text-slate-500 italic py-2 px-2">
                  No abilities benched yet. In Arrange mode, click &quot;⬇️ Bench&quot; on any Primary row to move non-combat abilities here.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* PORTAL POPOVER FOR EXTENDED ORIGIN STACK & 1-CLICK MANAGER LAUNCHER */}
      {activeOriginPopover &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={originPopoverRef}
            style={{
              top: Math.min(window.innerHeight - 220, activeOriginPopover.rect.bottom + 6),
              left: Math.min(
                window.innerWidth - 300,
                Math.max(12, activeOriginPopover.rect.left)
              ),
            }}
            className="fixed z-[9999] w-72 bg-slate-950/95 border border-indigo-500/60 rounded-xl p-3 shadow-2xl backdrop-blur-xl text-xs flex flex-col gap-2 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-outfit font-extrabold text-slate-100 uppercase tracking-wider">
                {activeOriginPopover.row.origin.categoryLabel}
              </span>
              <button
                type="button"
                onClick={() => setActiveOriginPopover(null)}
                className="p-0.5 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-slate-300 font-mono">
              <div>
                <span className="text-slate-500">Ability: </span>
                <strong className="text-slate-100 font-sans">
                  {activeOriginPopover.row.name}
                </strong>
                {activeOriginPopover.row.origin.version &&
                  activeOriginPopover.row.origin.version > 1 && (
                    <span className="ml-1 text-indigo-300">
                      (v{activeOriginPopover.row.origin.version})
                    </span>
                  )}
              </div>
              {activeOriginPopover.row.origin.sourceGear && (
                <div>
                  <span className="text-slate-500">Source: </span>
                  <span className="text-cyan-300">
                    {activeOriginPopover.row.origin.sourceGear}
                  </span>
                </div>
              )}
              {activeOriginPopover.row.origin.sourceMod && (
                <div>
                  <span className="text-slate-500">Mod: </span>
                  <span className="text-teal-300">
                    {activeOriginPopover.row.origin.sourceMod}
                  </span>
                </div>
              )}
              {activeOriginPopover.row.origin.discipline && (
                <div>
                  <span className="text-slate-500">Discipline: </span>
                  <span className="text-orange-300">
                    {activeOriginPopover.row.origin.discipline}
                  </span>
                </div>
              )}
              {activeOriginPopover.row.origin.pathLabel && (
                <div>
                  <span className="text-slate-500">Path: </span>
                  <span className="text-amber-300">
                    {activeOriginPopover.row.origin.pathLabel}
                  </span>
                </div>
              )}
              {activeOriginPopover.row.origin.setsLabel && (
                <div>
                  <span className="text-slate-500">Sets: </span>
                  <span className="text-indigo-300">
                    {activeOriginPopover.row.origin.setsLabel}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                handleOpenDomainManager(activeOriginPopover.row.origin.managerEventKey)
              }
              className="mt-1 w-full py-1.5 px-3 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <span>✏️</span>
              <span>Open Manager Modal</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
