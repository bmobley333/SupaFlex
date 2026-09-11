// src/components/common/FunctionNameArea.tsx
import React, { useMemo } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ItemNotesPopover } from './ItemNotesPopover';
import { AbilitySlot, MagicItem, FunctionItem, ModItem, Character } from '../../types/game';
import {
  resolveFunctionItemInfo,
  cleanSourceText,
  cleanGearTextKeepMso,
} from '../../utils/functionSourceHelper';
import { isMsoEntry } from '../../utils/kitUtils';

interface FunctionNameAreaProps {
  item: AbilitySlot | MagicItem | FunctionItem | any;
  gearName?: string | null;
  gearIcon?: string;
  fnName?: string;
  version?: number;
  notes?: string | null;
  functionsCatalog?: FunctionItem[];
  modsCatalog?: ModItem[];
  activeCharacter?: Character | null;
  isGsUnlocked?: boolean;
  starButton?: React.ReactNode;
  className?: string;
}

export const FunctionNameArea: React.FC<FunctionNameAreaProps> = ({
  item,
  gearName: propGearName,
  gearIcon: propGearIcon,
  fnName: propFnName,
  version: propVersion,
  notes: propNotes,
  functionsCatalog = [],
  modsCatalog = [],
  activeCharacter,
  isGsUnlocked = false,
  starButton,
  className = '',
}) => {
  // Resolve gear & function info if not explicitly passed
  const resolvedInfo = useMemo(() => {
    if (propFnName !== undefined) {
      return {
        gearName: propGearName ?? null,
        gearIcon: propGearIcon ?? '🎒',
        cleanFnName: propFnName,
        version: propVersion ?? 1,
      };
    }
    return resolveFunctionItemInfo(item, functionsCatalog, modsCatalog, activeCharacter);
  }, [item, propGearName, propGearIcon, propFnName, propVersion, functionsCatalog, modsCatalog, activeCharacter]);

  const rawGearName = resolvedInfo.gearName;
  const gearName = rawGearName ? cleanGearTextKeepMso(rawGearName) : null;
  const gearIcon = resolvedInfo.gearIcon || '🎒';
  const rawFnName = resolvedInfo.cleanFnName;
  const version = resolvedInfo.version || 1;

  // De-duplication Rule: If gear name and function name are identical (e.g. Banner of Eternity)
  // reduce the function name to the literal word "Function"
  const isIdenticalName = useMemo(() => {
    if (!gearName || !rawFnName) return false;
    const cleanG = cleanSourceText(gearName).toLowerCase();
    const cleanF = cleanSourceText(rawFnName).toLowerCase();
    return cleanG === cleanF;
  }, [gearName, rawFnName]);

  const displayFnName = isIdenticalName ? 'Function' : rawFnName;

  // Resolved notes: strictly the FUNCTION's notes
  const resolvedNotes = useMemo(() => {
    if (propNotes !== undefined) return propNotes;
    if (item?.notes && String(item.notes).trim()) return item.notes;
    // Look up function notes in catalog
    const matchedCatalog = functionsCatalog.find(
      (f) =>
        f.name.toLowerCase() === rawFnName.toLowerCase() ||
        f.name.toLowerCase() === cleanSourceText(item?.name || '').toLowerCase()
    );
    return matchedCatalog?.notes || null;
  }, [propNotes, item?.notes, item?.name, rawFnName, functionsCatalog]);

  const isMso = isMsoEntry(displayFnName);
  const formattedFnName = isGsUnlocked && isMso ? `🌌 ${displayFnName}` : displayFnName;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap min-w-0 ${className}`}>
      {/* 1. Optional Star Button (for modal views) */}
      {starButton}

      {/* 2. Glassmorphic Gear Name Pill */}
      {gearName && (
        <span
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 shrink-0 shadow-sm"
          title={`Belongs to: ${gearName}`}
        >
          <span>{gearIcon}</span>
          <span className="truncate max-w-[150px] sm:max-w-[220px]">{gearName}</span>
        </span>
      )}

      {/* 3. Right Arrow Icon */}
      {gearName && (
        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 inline" />
      )}

      {/* 4. Function Name + Notes Popover */}
      <span className="font-outfit font-bold text-xs sm:text-sm text-slate-100 inline-flex items-center align-baseline">
        <span className={isGsUnlocked && isMso ? 'text-purple-300' : ''}>{formattedFnName}</span>
        {resolvedNotes && (
          <ItemNotesPopover notes={resolvedNotes} itemName={displayFnName} inline />
        )}
      </span>

      {/* 5. Version Badge (if v2+) */}
      {version > 1 && (
        <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 shrink-0 flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
          v{version}
        </span>
      )}
    </div>
  );
};
