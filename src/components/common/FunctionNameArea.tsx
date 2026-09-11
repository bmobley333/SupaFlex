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

  const pillThemeClass = useMemo(() => {
    switch (gearIcon) {
      case '⚔️':
        return 'bg-rose-950/40 text-rose-200 border-rose-500/40';
      case '🛡️':
        return 'bg-cyan-950/40 text-cyan-200 border-cyan-500/40';
      case '🧥':
        return 'bg-slate-900/70 text-slate-200 border-slate-600/40';
      case '🔮':
        return 'bg-purple-950/40 text-purple-200 border-purple-500/40';
      case '🎒':
      default:
        return 'bg-amber-950/40 text-amber-200 border-amber-500/40';
    }
  }, [gearIcon]);

  return (
    <div className={`min-w-0 font-outfit text-xs sm:text-sm text-slate-100 leading-normal ${className}`}>
      {/* 1. Prefix: Star Button + Oval Gear Pill + Arrow (Bound non-breaking) */}
      <span className="inline-flex items-center gap-1.5 align-middle mr-1.5 shrink-0 whitespace-nowrap">
        {starButton}

        {gearName && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold border backdrop-blur-sm shadow-sm inline-flex items-center gap-1 shrink-0 ${pillThemeClass}`}
            title={`Belongs to: ${gearName}`}
          >
            <span className="leading-none text-[11px]">{gearIcon}</span>
            <span className="truncate max-w-[140px] sm:max-w-[200px]">{gearName}</span>
          </span>
        )}

        {gearName && (
          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
        )}
      </span>

      {/* 2. Function Name (Flows naturally inline with prefix) */}
      <span className={`font-bold align-middle ${isGsUnlocked && isMso ? 'text-purple-300' : 'text-slate-100'}`}>
        {formattedFnName}
      </span>

      {/* 3. Function Notes Popover */}
      {resolvedNotes && (
        <ItemNotesPopover notes={resolvedNotes} itemName={displayFnName} inline />
      )}

      {/* 4. Version Badge (if v2+) */}
      {version > 1 && (
        <span className="inline-flex items-center gap-0.5 align-middle ml-1.5 text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 shrink-0">
          <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
          v{version}
        </span>
      )}
    </div>
  );
};
