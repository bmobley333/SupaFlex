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
  GripVertical,
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

const applyCoupledRndAction = (
  current: RndActionsSpentState,
  key: 'am' | 'a' | 'm' | 'p',
  nextVal: boolean
): RndActionsSpentState => {
  if (key === 'am') {
    return {
      ...current,
      am: nextVal,
      a: nextVal,
      m: nextVal,
    };
  }
  if (key === 'a') {
    const curM = !!current.m;
    return {
      ...current,
      a: nextVal,
      am: nextVal && curM,
    };
  }
  if (key === 'm') {
    const curA = !!current.a;
    return {
      ...current,
      m: nextVal,
      am: curA && nextVal,
    };
  }
  return {
    ...current,
    p: nextVal,
  };
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

  // Arrange mode toggle, Drag-and-Drop state & Secondary Bench Tray accordion state
  const [isArrangeMode, setIsArrangeMode] = useState<boolean>(false);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

  // Toggle a Round Action (🔷: AM, A, M, P) with AM <-> A+M coupling
  const handleToggleRndAction = (key: 'am' | 'a' | 'm' | 'p', explicitValue?: boolean) => {
    updateActiveSheetData((prev) => {
      const current = prev.rnd_actions_spent || { am: false, a: false, m: false, p: false };
      const nextVal = explicitValue !== undefined ? explicitValue : !current[key];
      return {
        ...prev,
        rnd_actions_spent: applyCoupledRndAction(current, key, nextVal),
      };
    });
    saveActiveCharacter();
  };

  // Reset Round (🔄 Reset Rnd): Clears AM, A, M, P AND unchecks all 1-Rnd usage boxes across Powers & Exotics
  const handleResetRound = () => {
    updateActiveSheetData((prev) => {
      const resetSlotIfRnd = (slot: any) => {
        const u = (slot.usage || '').toLowerCase();
        if (u.includes('rnd') || u.includes('round')) {
          return {
            ...slot,
            checked: (slot.checked || []).map(() => false),
          };
        }
        return slot;
      };
      return {
        ...prev,
        rnd_actions_spent: { am: false, a: false, m: false, p: false },
        power_slots: (prev.power_slots || []).map(resetSlotIfRnd),
        spell_slots: (prev.spell_slots || []).map(resetSlotIfRnd),
      };
    });
    saveActiveCharacter();
    showToast('🔄 New Round: Cleared Round Actions (AM/A/M/P) & 1-Rnd Uses.');
  };

  // Clear Encounter Uses (Clears all power_slots and spell_slots checkboxes + Round Actions)
  const handleClearEncounterUses = () => {
    updateActiveSheetData((prev) => ({
      ...prev,
      rnd_actions_spent: { am: false, a: false, m: false, p: false },
      power_slots: (prev.power_slots || []).map((s) => ({
        ...s,
        checked: (s.checked || []).map(() => false),
      })),
      spell_slots: (prev.spell_slots || []).map((s) => ({
        ...s,
        checked: (s.checked || []).map(() => false),
      })),
    }));
    saveActiveCharacter();
    showToast('✨ Cleared all Encounter & Round Usage checkboxes.');
  };

  // Coupled Usage Box Click Handler: Toggles row usage box AND auto-checks/unchecks corresponding Round Action (🔷)
  const handleToggleRowUsageBox = (row: TacticalRowItem, boxIdx: number) => {
    const wasChecked = !!(row.checked && row.checked[boxIdx]);
    const nextChecked = !wasChecked;
    const act = (row.action || '').toUpperCase();
    const rndKey =
      act === 'AM'
        ? 'am'
        : act === 'A'
        ? 'a'
        : act === 'M'
        ? 'm'
        : act === 'P'
        ? 'p'
        : null;

    if (row.domain === 'powers' && row.rawPowerSlot) {
      const targetName = row.rawPowerSlot.name;
      updateActiveSheetData((prev) => {
        const currentRnd = prev.rnd_actions_spent || { am: false, a: false, m: false, p: false };
        const updatedPowers = (prev.power_slots || []).map((s) => {
          if (s.name !== targetName) return s;
          const nextArr = Array.isArray(s.checked) ? [...s.checked] : [false, false, false];
          nextArr[boxIdx] = nextChecked;
          return { ...s, checked: nextArr };
        });
        return {
          ...prev,
          power_slots: updatedPowers,
          rnd_actions_spent: rndKey
            ? applyCoupledRndAction(currentRnd, rndKey, nextChecked)
            : currentRnd,
        };
      });
      saveActiveCharacter();
      return;
    }

    if (row.domain === 'exotics' && row.rawExoticSlot) {
      toggleGearPowerUsage(row.rawExoticSlot.name, boxIdx);
      if (rndKey) {
        handleToggleRndAction(rndKey, nextChecked);
      }
      return;
    }

    if (row.domain === 'chaos_gems' && row.rawGemSlot) {
      const slotId = row.rawGemSlot.slot_id;
      const gemName = row.name;
      const currentArr = Array.isArray(row.checked) ? [...row.checked] : [false, false, false];
      currentArr[boxIdx] = nextChecked;
      const allThreeChecked =
        currentArr.length >= 3 && currentArr[0] && currentArr[1] && currentArr[2];

      if (allThreeChecked) {
        const confirmed = window.confirm(
          `💎 All 3 charges of '${gemName}' have been spent!\n\nShatter and remove '${gemName}' from your Chaos Gauntlet now?`
        );
        if (confirmed) {
          updateActiveSheetData((prev) => ({
            ...prev,
            chaos_gauntlet_slots: (prev.chaos_gauntlet_slots || []).map((s) =>
              s.slot_id === slotId ? { ...s, gem: null } : s
            ),
          }));
          saveActiveCharacter();
          showToast(`💥 Shattered & removed '${gemName}'.`);
          return;
        }
      }

      updateActiveSheetData((prev) => ({
        ...prev,
        chaos_gauntlet_slots: (prev.chaos_gauntlet_slots || []).map((s) =>
          s.slot_id === slotId && s.gem
            ? { ...s, gem: { ...s.gem, checked: currentArr } }
            : s
        ),
      }));
      saveActiveCharacter();
    }
  };

  // Ensure master_table_order is hydrated with current primaryRows before mutating order
  const getHydratedPrimaryOrder = useCallback((): string[] => {
    return primaryRows.map((r) => r.rowKey);
  }, [primaryRows]);

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    const order = getHydratedPrimaryOrder();
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;
    const nextOrder = [...order];
    const [moved] = nextOrder.splice(index, 1);
    nextOrder.splice(targetIdx, 0, moved);

    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: nextOrder,
    }));
    saveActiveCharacter();
  };

  // Drag-and-Drop Row Reordering Handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (!isArrangeMode) return;
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (!isArrangeMode || draggedIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    if (!isArrangeMode || draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const order = getHydratedPrimaryOrder();
    if (draggedIdx >= 0 && draggedIdx < order.length && dropIndex >= 0 && dropIndex < order.length) {
      const nextOrder = [...order];
      const [moved] = nextOrder.splice(draggedIdx, 1);
      nextOrder.splice(dropIndex, 0, moved);
      updateActiveSheetData((prev) => ({
        ...prev,
        master_table_order: nextOrder,
      }));
      saveActiveCharacter();
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleInsertDivider = (afterIndex?: number, withLabel?: boolean) => {
    let label = '';
    if (withLabel) {
      const input = window.prompt('Enter section label header (leave blank for a thin rule line):', '⚔️ PRIMARY OFFENSE');
      if (input === null) return;
      label = input.trim();
    }
    const divKey = `div:${Date.now().toString(36)}:${label}`;
    const order = getHydratedPrimaryOrder();
    const insertPos = afterIndex !== undefined ? afterIndex + 1 : order.length;
    const nextOrder = [...order];
    nextOrder.splice(insertPos, 0, divKey);

    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: nextOrder,
    }));
    saveActiveCharacter();
  };

  const handleEditDividerLabel = (row: TacticalRowItem) => {
    const nextLabel = window.prompt('Edit section label (leave blank for a thin rule line):', row.dividerLabel || '');
    if (nextLabel === null) return;
    const newKey = `div:${row.dividerId || Date.now().toString(36)}:${nextLabel.trim()}`;
    const order = getHydratedPrimaryOrder().map((k) => (k === row.rowKey ? newKey : k));
    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: order,
    }));
    saveActiveCharacter();
  };

  const handleDeleteDivider = (rowKey: string) => {
    const order = getHydratedPrimaryOrder().filter((k) => k !== rowKey);
    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: order,
    }));
    saveActiveCharacter();
  };

  const handleBenchRow = (rowKey: string) => {
    const order = getHydratedPrimaryOrder().filter((k) => k !== rowKey);
    updateActiveSheetData((prev) => {
      const currentBenched = Array.isArray(prev.master_table_benched) ? prev.master_table_benched : [];
      const nextBenched = currentBenched.includes(rowKey) ? currentBenched : [...currentBenched, rowKey];
      return {
        ...prev,
        master_table_order: order,
        master_table_benched: nextBenched,
      };
    });
    saveActiveCharacter();
  };

  const handlePromoteFromBench = (rowKey: string) => {
    const order = [...getHydratedPrimaryOrder(), rowKey];
    updateActiveSheetData((prev) => {
      const currentBenched = Array.isArray(prev.master_table_benched) ? prev.master_table_benched : [];
      return {
        ...prev,
        master_table_order: order,
        master_table_benched: currentBenched.filter((k) => k !== rowKey),
      };
    });
    saveActiveCharacter();
  };

  const handleTogglePinSkill = (skillRowKey: string) => {
    const order = getHydratedPrimaryOrder();
    const isCurrentlyPinned = pinnedSkillKeys.has(skillRowKey);
    const nextOrder = isCurrentlyPinned
      ? order.filter((k) => k !== skillRowKey)
      : [...order, skillRowKey];

    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: nextOrder,
    }));
    saveActiveCharacter();
  };

  const handleResetOrderToDefault = () => {
    if (!window.confirm('Reset Tactical Table row order to default category order (and clear custom dividers)?')) {
      return;
    }
    updateActiveSheetData((prev) => ({
      ...prev,
      master_table_order: [],
    }));
    saveActiveCharacter();
  };

  const handleOpenRowManager = (row: TacticalRowItem) => {
    setActiveOriginPopover(null);
    const key = row.origin.managerEventKey;
    if (key === 'exotics') {
      setExoticGearManagerModalOpen(true, row.origin.sourceGear || null);
      return;
    }
    window.dispatchEvent(new CustomEvent('supaflex:open-manager', { detail: key }));
  };

  // Highlight inline Atk/Roll/Blk formulas (cyan) and Dmg dice (amber) inside Effect text
  const renderHighlightedEffect = (effectText: string) => {
    if (!effectText) return <span className="text-slate-600 italic">—</span>;
    const tokenRegex =
      /((?:Atk|Roll|Blk)\s*(?:💪|🏃|👁️|✨|🫀)\d+|\b(?:💪|🏃|👁️|✨|🫀)\s*\^\s*(?:💪|🏃|👁️|✨|🫀|Prone|Dodge|Block|Parry|Will|Fort|Ref|\d+)|\bd\d+x?\s*Dmg\b|\bDmg\s*(?:d\d+x?|❌))/gi;
    const parts = effectText.split(tokenRegex);
    return parts.map((part, i) => {
      if (!part) return null;
      if (/^(?:Atk|Roll|Blk)\s*(?:💪|🏃|👁️|✨|🫀)\d+/i.test(part) || /\^/.test(part)) {
        return (
          <span key={i} className="font-mono font-bold text-cyan-300">
            {part}
          </span>
        );
      }
      if (/dmg/i.test(part)) {
        return (
          <span key={i} className="font-mono font-bold text-amber-300">
            {part}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  const renderTableRow = (row: TacticalRowItem, idx: number, isSecondary: boolean) => {
    const dimmed = !isSecondary && isTacticalRowDimmed(row, rndActions);
    const isMso = isGsUnlocked && isMsoEntry(row.name);
    const totalCols = 4 + (isArrangeMode ? 1 : 0);

    // Custom Blank / Label Divider Row
    if (row.domain === 'divider') {
      return (
        <tr
          key={row.rowKey}
          draggable={isArrangeMode && !isSecondary}
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => handleDragOver(e, idx)}
          onDrop={(e) => handleDrop(e, idx)}
          onDragEnd={handleDragEnd}
          className={`bg-slate-950/95 border-y border-slate-800/90 transition-all ${
            dragOverIdx === idx && draggedIdx !== idx ? 'ring-1 ring-amber-400 bg-amber-500/15' : ''
          }`}
        >
          <td colSpan={totalCols} className="px-3 py-1">
            <div className="flex items-center justify-between gap-2">
              {row.dividerLabel ? (
                <div className="flex items-center gap-2 w-full">
                  <span className="text-[10px] font-outfit font-black uppercase tracking-widest text-amber-300/90 whitespace-nowrap">
                    {row.dividerLabel}
                  </span>
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-amber-500/40 to-transparent" />
                </div>
              ) : (
                <div className="h-[2px] w-full bg-slate-800/90 rounded-full my-1" />
              )}

              {isArrangeMode && (
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="p-0.5 text-slate-500 hover:text-amber-300 cursor-grab active:cursor-grabbing"
                    title="Drag to reorder divider"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMoveRow(idx, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveRow(idx, 'down')}
                    disabled={idx === primaryRows.length - 1}
                    className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditDividerLabel(row)}
                    className="p-0.5 px-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] text-amber-300 border border-slate-700 cursor-pointer"
                    title="Edit Divider Label"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDivider(row.rowKey)}
                    className="p-0.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 cursor-pointer"
                    title="Remove Divider"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr
        key={row.rowKey}
        draggable={isArrangeMode && !isSecondary}
        onDragStart={(e) => handleDragStart(e, idx)}
        onDragOver={(e) => handleDragOver(e, idx)}
        onDrop={(e) => handleDrop(e, idx)}
        onDragEnd={handleDragEnd}
        className={`border-b border-slate-800/70 transition-all hover:bg-slate-800/35 ${
          DOMAIN_LEFT_BORDER[row.domain]
        } ${dimmed ? 'opacity-40 bg-slate-950/80' : 'bg-slate-900/40'} ${
          dragOverIdx === idx && draggedIdx !== idx ? 'ring-1 ring-amber-400 bg-amber-500/15' : ''
        } ${isArrangeMode && !isSecondary ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* 1. TYPE ICON CELL (28px, Icon-Only, Click opens Extended Origin Popover) */}
        <td className="w-7 px-1 py-1.5 text-center align-middle shrink-0">
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setActiveOriginPopover((prev) =>
                prev?.row.rowKey === row.rowKey ? null : { row, rect }
              );
            }}
            className="w-6 h-6 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 flex items-center justify-center text-xs cursor-pointer transition-transform hover:scale-110 mx-auto"
            title={`${row.origin.categoryLabel} — Click for origin details & Manager`}
          >
            <span>{row.icon}</span>
          </button>
        </td>

        {/* 2. ACTION (🔷) CELL */}
        <td className="w-11 px-1 py-1.5 text-center align-middle whitespace-nowrap">
          {row.action ? (
            <button
              type="button"
              onClick={() => {
                const act = row.action.toLowerCase();
                if (act === 'am' || act === 'a' || act === 'm' || act === 'p') {
                  handleToggleRndAction(act as 'am' | 'a' | 'm' | 'p');
                }
              }}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono font-extrabold cursor-pointer transition-transform active:scale-95 ${
                ACTION_BADGE_STYLES[row.action] || 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title={
                row.action === 'A'
                  ? 'Attack Action (A) — Click to mark spent this Round'
                  : row.action === 'M'
                  ? 'Move Action (M) — Click to mark spent this Round'
                  : row.action === 'AM'
                  ? 'Full-Round Action (AM) — Click to mark AM, A & M spent this Round'
                  : row.action === 'P'
                  ? 'Partial Action (P, 1/Rnd) — Click to mark spent this Round'
                  : 'Free Action (F)'
              }
            >
              {row.action}
            </button>
          ) : (
            <span className="text-[10px] font-mono text-slate-700 select-none">—</span>
          )}
        </td>

        {/* 3. USES (🔄) & COUPLED CHECKBOXES CELL */}
        <td className="w-28 px-1.5 py-1.5 align-middle whitespace-nowrap">
          {row.usage || row.usageCount > 0 ? (
            <div className="flex items-center gap-1.5">
              {row.usage && (
                <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                  {row.usage}
                </span>
              )}
              {row.usageCount > 0 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: row.usageCount }).map((_, bIdx) => {
                    const isChecked = !!(row.checked && row.checked[bIdx]);
                    return (
                      <input
                        key={bIdx}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRowUsageBox(row, bIdx)}
                        className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                        title={`Use ${bIdx + 1} of ${row.usageCount} (auto-marks ${row.action || 'Action'} spent)`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-mono text-slate-700 select-none"></span>
          )}
        </td>

        {/* 4. UNIFIED NAME — EFFECT CELL */}
        <td className="px-2 py-1.5 align-middle text-xs leading-snug min-w-[240px]">
          <div className="inline">
            <span
              className={`font-outfit font-extrabold ${
                dimmed
                  ? 'line-through text-slate-400'
                  : isMso
                  ? 'text-purple-300'
                  : 'text-slate-100'
              }`}
            >
              {isMso ? `🌌 ${row.name}` : row.name}
            </span>
            {row.subBadge && (
              <span className="ml-1.5 px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-[9px] font-mono font-bold text-slate-400 align-middle">
                {row.subBadge}
              </span>
            )}
            <ItemNotesPopover notes={row.notes} itemName={row.name} inline />
            <span className="mx-1.5 text-slate-600 select-none">—</span>
            <span className="text-slate-300">{renderHighlightedEffect(row.effect)}</span>
          </div>
        </td>

        {/* 5. ARRANGE MODE CONTROLS (Icon-Only + Drag Handle) */}
        {isArrangeMode && (
          <td className="w-28 px-1.5 py-1.5 text-right align-middle whitespace-nowrap">
            {!isSecondary ? (
              <div className="flex items-center justify-end gap-1">
                <span
                  className="p-0.5 text-slate-500 hover:text-amber-300 cursor-grab active:cursor-grabbing"
                  title="Drag row to reorder"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => handleMoveRow(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer border border-slate-800"
                  title="Move Row Up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveRow(idx, 'down')}
                  disabled={idx === primaryRows.length - 1}
                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer border border-slate-800"
                  title="Move Row Down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertDivider(idx, true)}
                  className="p-1 rounded bg-slate-950 hover:bg-slate-800 text-[10px] font-bold text-amber-300 border border-slate-800 cursor-pointer"
                  title="Insert Blank or Label Divider below this row"
                >
                  ➕
                </button>
                {row.domain === 'skills' ? (
                  <button
                    type="button"
                    onClick={() => handleTogglePinSkill(row.rowKey)}
                    className="p-1 rounded bg-indigo-950/70 hover:bg-indigo-900 text-[10px] font-bold text-indigo-300 border border-indigo-500/40 cursor-pointer"
                    title="Unpin Skill from Tactical Table"
                  >
                    📌
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBenchRow(row.rowKey)}
                    className="p-1 rounded bg-slate-950 hover:bg-amber-950/60 text-[10px] font-bold text-slate-300 hover:text-amber-200 border border-slate-800 cursor-pointer"
                    title="Move to Secondary & Non-Combat Bench"
                  >
                    📥
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handlePromoteFromBench(row.rowKey)}
                className="p-1 rounded bg-emerald-950/70 hover:bg-emerald-900 text-[10px] font-bold text-emerald-300 border border-emerald-500/40 cursor-pointer"
                title="Restore to Primary Tactical Table"
              >
                📤
              </button>
            )}
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="bg-gradient-to-b from-amber-950/20 via-slate-900/95 to-slate-950/95 rounded-2xl border border-slate-800 border-t-2 border-t-amber-500/90 p-3 flex flex-col gap-2.5 shadow-xl relative">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-between animate-fadeIn">
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

      {/* TOP BAR: Title + Coupled Round Action Tracker (🔷 AM / A / M / P) + Arrange Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        {/* Left: Table Title & Help */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-950/90 border border-amber-500/50 text-amber-300 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <span className="text-sm leading-none">⚔️</span>
          </div>
          <h3 className="font-outfit font-extrabold text-sm tracking-widest text-amber-200 uppercase">
            Tactical Table
          </h3>
          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400">
            {primaryRows.filter((r) => r.domain !== 'divider').length} Active
          </span>
          <CardHelpButton ruleKey="powers.basics" />
        </div>

        {/* Center: Coupled Round Action Tracker (🔷 AM, A, M, P + Reset Rnd + Clear Enc) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1 shadow-inner">
          <span
            className="text-[11px] font-outfit font-bold text-slate-300 mr-0.5 select-none"
            title="Round Actions Spent — Checking any box dims unavailable actions in the table below"
          >
            🔷 Rnd:
          </span>

          {(
            [
              { key: 'am', label: 'AM', title: 'Full-Round Action (AM) — Also checks A & M', color: 'text-amber-300 border-amber-500/40 bg-amber-950/40' },
              { key: 'a', label: 'A', title: 'Attack Action (A)', color: 'text-rose-300 border-rose-500/40 bg-rose-950/40' },
              { key: 'm', label: 'M', title: 'Move Action (M)', color: 'text-indigo-300 border-indigo-500/40 bg-indigo-950/40' },
              { key: 'p', label: 'P', title: 'Partial Action (P, 1/Rnd)', color: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40' },
            ] as const
          ).map((act) => {
            const isChecked = !!rndActions[act.key];
            return (
              <label
                key={act.key}
                title={act.title}
                className={`px-1.5 py-0.5 rounded-lg border text-[11px] font-mono font-extrabold flex items-center gap-1 cursor-pointer select-none transition-all ${
                  isChecked
                    ? 'bg-slate-900 text-slate-400 border-slate-700 ring-1 ring-amber-500/40'
                    : act.color
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleRndAction(act.key)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                />
                <span>{act.label}</span>
              </label>
            );
          })}

          <button
            type="button"
            onClick={handleResetRound}
            className="px-2 py-0.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-500/40 text-[11px] font-bold text-indigo-200 hover:text-white flex items-center gap-1 cursor-pointer transition-colors ml-0.5"
            title="Reset Round: Unchecks AM/A/M/P and resets all 1-Rnd usage checkboxes"
          >
            <RotateCcw className="w-3 h-3 text-indigo-300" />
            <span>Reset Rnd</span>
          </button>

          <button
            type="button"
            onClick={handleClearEncounterUses}
            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-300 hover:text-white cursor-pointer transition-colors"
            title="Clear all Encounter (1-Enc, 2-Enc, 3-Enc) and Round checkboxes"
          >
            Clear Enc
          </button>
        </div>

        {/* Right: Dyslexia-Friendly Lock / Arrange Pill Switch */}
        <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setIsArrangeMode(false)}
            className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              !isArrangeMode
                ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Play</span>
          </button>
          <button
            type="button"
            onClick={() => setIsArrangeMode(true)}
            className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              isArrangeMode
                ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Unlock className="w-3 h-3" />
            <span>Arrange</span>
          </button>
        </div>
      </div>

      {/* ARRANGE MODE TOOLBAR */}
      {isArrangeMode && (
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300/90 mr-1">
              Drag ⠿ or use arrows to reorder:
            </span>
            <button
              type="button"
              onClick={() => handleInsertDivider(undefined, false)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
              title="Insert a thin horizontal blank separator row"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>➖ Blank Line</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertDivider(undefined, true)}
              className="px-2.5 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 border border-amber-500/40 text-xs font-bold text-amber-200 flex items-center gap-1 cursor-pointer"
              title="Insert a custom named section header row"
            >
              <Plus className="w-3.5 h-3.5 text-amber-300" />
              <span>🏷️ Label Header</span>
            </button>

            {/* Pin Individual Skill Quick-Selector */}
            {allDerivedSkills.length > 0 && (
              <div className="flex items-center gap-1 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-2 py-0.5">
                <Pin className="w-3 h-3 text-indigo-300" />
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleTogglePinSkill(e.target.value);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-indigo-200 outline-none cursor-pointer"
                  title="Pin or unpin a derived skill onto the Primary Tactical Table"
                >
                  <option value="" className="bg-slate-950 text-slate-300">
                    + 📌 Pin Skill ({pinnedSkillKeys.size}/{allDerivedSkills.length})
                  </option>
                  {allDerivedSkills.map((sk) => {
                    const isPinned = pinnedSkillKeys.has(sk.rowKey);
                    return (
                      <option key={sk.rowKey} value={sk.rowKey} className="bg-slate-950 text-slate-100">
                        {isPinned ? '✓ Pinned: ' : '+ Pin: '}
                        {sk.name} ({sk.emoji}
                        {sk.dieRating})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleResetOrderToDefault}
              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-[11px] font-bold text-slate-400 hover:text-rose-200 cursor-pointer"
              title="Reset row order to default category order"
            >
              Reset Order
            </button>
          </div>

          {/* Quick Open Domain Managers Bar */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1">
              Open Manager:
            </span>
            {(
              [
                { label: '⚔️ Weapons', key: 'weapons' },
                { label: '🔥 Powers', key: 'powers' },
                { label: '🧿 Exotics', key: 'exotics' },
                { label: '💎 Gems', key: 'chaos_gauntlet' },
                { label: '🧬 Traits', key: 'traits' },
                { label: '🎓 Skills', key: 'skills' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => {
                  if (m.key === 'exotics') {
                    setExoticGearManagerModalOpen(true);
                  } else {
                    window.dispatchEvent(new CustomEvent('supaflex:open-manager', { detail: m.key }));
                  }
                }}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 hover:text-white cursor-pointer transition-colors"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRIMARY TACTICAL TABLE (4 Ultra-Dense Columns) */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-slate-950/60">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-[10px] font-outfit font-extrabold uppercase tracking-wider text-slate-400 select-none">
              <th className="w-7 px-1 py-1.5 text-center" title="Domain Type (Click icon for Origin & Manager)">
                Type
              </th>
              <th className="w-11 px-1 py-1.5 text-center" title="Action Economy (AM, A, M, P, F)">
                🔷
              </th>
              <th className="w-28 px-1.5 py-1.5" title="Usage Limit & Coupled Checkboxes">
                Uses 🔄
              </th>
              <th className="px-2 py-1.5">Name — Effect</th>
              {isArrangeMode && <th className="w-28 px-1.5 py-1.5 text-right">Arrange</th>}
            </tr>
          </thead>
          <tbody>
            {primaryRows.length > 0 ? (
              primaryRows.map((row, idx) => renderTableRow(row, idx, false))
            ) : (
              <tr>
                <td
                  colSpan={4 + (isArrangeMode ? 1 : 0)}
                  className="p-6 text-center text-xs text-slate-500 italic"
                >
                  No active combat abilities in Primary Table. Switch to Arrange mode or open a Manager to equip weapons, powers, exotics, or traits.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SECONDARY & NON-COMBAT BENCH TRAY (Collapsible Bottom Accordion) */}
      {(secondaryRows.length > 0 || isArrangeMode) && (
        <div className="border border-slate-800/80 rounded-xl bg-slate-950/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsSecondaryOpen(!isSecondaryOpen)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-xs font-outfit font-bold text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {isSecondaryOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>📦 Secondary & Non-Combat Bench ({secondaryRows.length})</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {isSecondaryOpen ? 'Click to collapse' : 'Click to view benched abilities'}
            </span>
          </button>

          {isSecondaryOpen && (
            <div className="border-t border-slate-800/80 overflow-x-auto">
              {secondaryRows.length > 0 ? (
                <table className="w-full border-collapse text-left">
                  <tbody>
                    {secondaryRows.map((row, idx) => renderTableRow(row, idx, true))}
                  </tbody>
                </table>
              ) : (
                <div className="p-3 text-center text-xs text-slate-500 italic">
                  No abilities currently on the Secondary Bench. In Arrange mode, click 📥 on any non-combat ability to park it here.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXTENDED ORIGIN POPOVER (Rendered via Portal on Type Icon Click) */}
      {activeOriginPopover &&
        createPortal(
          <div
            ref={originPopoverRef}
            style={{
              top: `${Math.min(window.innerHeight - 230, activeOriginPopover.rect.bottom + 6)}px`,
              left: `${Math.max(12, Math.min(window.innerWidth - 300, activeOriginPopover.rect.left))}px`,
            }}
            className="fixed z-50 w-72 bg-slate-950/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs flex flex-col gap-2 animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-outfit font-extrabold text-amber-300">
                {activeOriginPopover.row.origin.categoryLabel}
              </span>
              <button
                type="button"
                onClick={() => setActiveOriginPopover(null)}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-500 font-semibold">Ability: </span>
                <span className="font-bold text-slate-100">{activeOriginPopover.row.name}</span>
                {activeOriginPopover.row.origin.version && activeOriginPopover.row.origin.version > 1 && (
                  <span className="ml-1 text-amber-300 font-mono">
                    (v{activeOriginPopover.row.origin.version})
                  </span>
                )}
              </div>
              {activeOriginPopover.row.origin.sourceGear && (
                <div>
                  <span className="text-slate-500 font-semibold">Source: </span>
                  <span className="text-cyan-300 font-semibold">
                    {activeOriginPopover.row.origin.sourceGear}
                  </span>
                </div>
              )}
              {activeOriginPopover.row.origin.sourceMod && (
                <div>
                  <span className="text-slate-500 font-semibold">Mod: </span>
                  <span className="text-indigo-300 font-semibold">
                    {activeOriginPopover.row.origin.sourceMod}
                  </span>
                </div>
              )}
              {activeOriginPopover.row.origin.discipline && (
                <div>
                  <span className="text-slate-500 font-semibold">Discipline: </span>
                  <span>{activeOriginPopover.row.origin.discipline}</span>
                </div>
              )}
              {activeOriginPopover.row.origin.pathLabel && (
                <div>
                  <span className="text-slate-500 font-semibold">Path: </span>
                  <span className="text-purple-300">{activeOriginPopover.row.origin.pathLabel}</span>
                </div>
              )}
              {activeOriginPopover.row.origin.setsLabel && (
                <div>
                  <span className="text-slate-500 font-semibold">Sets: </span>
                  <span className="text-emerald-300">{activeOriginPopover.row.origin.setsLabel}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleOpenRowManager(activeOriginPopover.row)}
              className="mt-1 w-full py-1.5 px-3 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/50 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>✏️ Open {activeOriginPopover.row.origin.managerEventKey.replace('_', ' ').toUpperCase()} Manager</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
