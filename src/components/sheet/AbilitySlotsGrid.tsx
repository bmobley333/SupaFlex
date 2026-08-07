import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search, X, Plus, Edit2, Lock, Sparkles, Globe, Flame, Star, RotateCcw } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { AbilitySlot, Power, MagicItem, calculateAvailableAp } from '../../types/game';

interface AbilitySlotsGridProps {
  title: string;
  type: 'powers' | 'spells';
}

const ACTION_COLORS: Record<string, string> = {
  AM: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  A: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  M: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  P: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  F: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

const ACTION_ORDER: Record<string, number> = {
  AM: 0,
  A: 1,
  M: 2,
  P: 3,
  F: 4,
};

const ACTION_OPTIONS = ['AM', 'A', 'M', 'P', 'F'];
const USAGE_OPTIONS = ['1-Enc', '2-Enc', '3-Enc', '1', '1-Luck🍀', '1-Charge⚡'];

const POWER_CATEGORY_BUTTONS = [
  { id: 'all', label: 'All Categories', icon: '🌐' },
  { id: 'class', label: 'Class', icon: '👤' },
  { id: 'race', label: 'Racial', icon: '🧬' },
  { id: 'combat style', label: 'Combat Styles', icon: '⚔️' },
  { id: 'luck', label: 'Luck', icon: '🍀' },
  { id: 'favorites', label: 'Favorites', icon: '⭐' },
];

const MAIN_ABILITY_ICONS = [
  { icon: '✨', label: 'Magic' },
  { icon: '💪', label: 'Might' },
  { icon: '👁️', label: 'Mind' },
  { icon: '🏃', label: 'Motion' },
  { icon: '🫀', label: 'Moxie' },
  { icon: '🍀', label: 'Luck' },
];

const cleanName = (name: string) => name.replace(/\s*\[[A-Z]+\]$/i, '').trim();

const parseUsageCount = (usage?: string): number => {
  if (!usage) return 0;
  const match = usage.trim().match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
};

const parseAbilityVersion = (name: string): { baseName: string; version: number } => {
  const cleaned = cleanName(name);
  const match = cleaned.match(/^(.*?)(?:\s+v(\d+))$/i);
  return match ? { baseName: match[1].trim(), version: parseInt(match[2], 10) } : { baseName: cleaned, version: 1 };
};

const pruneLesserPowerVersions = (abilitySlots: AbilitySlot[]): AbilitySlot[] => {
  const highestMap = abilitySlots.reduce((acc, slot) => {
    const { baseName, version } = parseAbilityVersion(slot.name);
    const key = baseName.toLowerCase();
    const existing = acc[key];
    if (!existing || version > parseAbilityVersion(existing.name).version) {
      acc[key] = slot;
    }
    return acc;
  }, {} as Record<string, AbilitySlot>);
  return Object.values(highestMap);
};

const calculateTotalPowerUnits = (abilitySlots: AbilitySlot[]): number => {
  const pruned = pruneLesserPowerVersions(abilitySlots);
  return pruned.reduce((sum, slot) => {
    const { version } = parseAbilityVersion(slot.name);
    return sum + (version || 1);
  }, 0);
};

export const AbilitySlotsGrid: React.FC<AbilitySlotsGridProps> = ({ title, type }) => {
  const { activeCharacter, powers, magicItems, updateActiveSheetData, saveActiveCharacter, recordApExpenditure } = useCharacterStore();
  const slotKey = type === 'powers' ? 'power_slots' : 'spell_slots';
  const rawSlots: AbilitySlot[] = (activeCharacter?.sheet_data?.[slotKey as keyof typeof activeCharacter.sheet_data] as AbilitySlot[]) || [];
  const slots: AbilitySlot[] = useMemo(() => {
    return rawSlots.filter((s) => s && s.name && s.name.trim() !== '');
  }, [rawSlots]);
  const favoriteTables: string[] = activeCharacter?.sheet_data?.favorite_power_tables || [];
  const stockCatalog = type === 'powers' ? powers : magicItems;

  // Active Highest-Version Display Slots (max version per baseName)
  const activeDisplaySlots = useMemo(() => {
    return pruneLesserPowerVersions(slots);
  }, [slots]);

  // Powers AP Metrics (Version-based cumulative AP units: v1=1 AP, v2=2 AP, v5=5 AP; 3 Free AP Allowance)
  const totalPowerUnits = useMemo(() => {
    return calculateTotalPowerUnits(slots);
  }, [slots]);

  const apSpent = Math.max(0, totalPowerUnits - 3);
  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('class');
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  
  // Search Filters for Left and Right Panes
  const [leftSearchQuery, setLeftSearchQuery] = useState('');
  const [rightSearchQuery, setRightSearchQuery] = useState('');
  
  // Right Pane Active View: 'CATALOG' or 'CREATOR'
  const [activeRightTab, setActiveRightTab] = useState<'CATALOG' | 'CREATOR'>('CATALOG');

  const modalRef = useRef<HTMLDivElement>(null);

  // Custom / Version Creation Form State
  const [createName, setCreateName] = useState('');
  const [createAction, setCreateAction] = useState('A');
  const [createUsage, setCreateUsage] = useState('1-Enc');
  const [createEffect, setCreateEffect] = useState('');
  const createEffectRef = useRef<HTMLTextAreaElement>(null);

  // Version Editor Mode State
  const [isVersionEditMode, setIsVersionEditMode] = useState(false);
  const [versionEditBaseName, setVersionEditBaseName] = useState('');
  const [versionEditNextVersion, setVersionEditNextVersion] = useState(1);

  const insertIconAtCursor = (iconStr: string) => {
    const textarea = createEffectRef.current;
    if (!textarea) {
      setCreateEffect((prev) => (prev ? prev + ' ' + iconStr : iconStr));
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const updated = createEffect.substring(0, start) + iconStr + createEffect.substring(end);
    setCreateEffect(updated);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + iconStr.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const handleLaunchVersionEditor = (item: Power | MagicItem | AbilitySlot) => {
    const cleaned = cleanName(item.name);
    const { baseName, version } = parseAbilityVersion(cleaned);
    const nextVer = version + 1;
    const nextVersionedName = `${baseName} v${nextVer}`;

    setIsVersionEditMode(true);
    setVersionEditBaseName(baseName);
    setVersionEditNextVersion(nextVer);

    setCreateName(nextVersionedName);
    setCreateAction(item.action || 'A');
    setCreateUsage(item.usage || '1-Enc');
    setCreateEffect(item.effect || '');

    setActiveRightTab('CREATOR');
  };

  const handleToggleFavoriteTable = (tableName: string) => {
    if (!tableName) return;
    updateActiveSheetData((prev) => {
      const currentFavs: string[] = prev.favorite_power_tables || [];
      const isFav = currentFavs.includes(tableName);
      const updatedFavs = isFav
        ? currentFavs.filter((t) => t !== tableName)
        : [...currentFavs, tableName];
      return {
        ...prev,
        favorite_power_tables: updatedFavs,
      };
    });
    saveActiveCharacter();
  };

  // Custom Power Table Creation State (Powers Mode Only)
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSub, setNewTableSub] = useState('class');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowManageModal(false);
      }
    };
    if (showManageModal) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageModal]);

  const handleCheckboxToggle = (targetSlot: AbilitySlot, checkIndex: number) => {
    updateActiveSheetData((prev) => {
      const updatedSlots = [...(prev[slotKey] || [])];
      const realIndex = updatedSlots.findIndex(
        (s) => s.name === targetSlot.name || ((s as any).id && (s as any).id === (targetSlot as any).id)
      );
      if (realIndex === -1) return prev;

      const slotToUpdate = { ...updatedSlots[realIndex] };
      const newChecked = [...(slotToUpdate.checked || [false, false, false])];
      newChecked[checkIndex] = !newChecked[checkIndex];
      slotToUpdate.checked = newChecked;
      updatedSlots[realIndex] = slotToUpdate;
      return { ...prev, [slotKey]: updatedSlots };
    });
    saveActiveCharacter();
  };

  const handleClearAllUses = () => {
    updateActiveSheetData((prev) => {
      const currentSlots = prev[slotKey] || [];
      if (currentSlots.length === 0) return prev;

      const clearedSlots = currentSlots.map((slot: any) => ({
        ...slot,
        checked: [false, false, false],
      }));

      return {
        ...prev,
        [slotKey]: clearedSlots,
      };
    });
    saveActiveCharacter();
  };

  const handleSaveCustomTable = () => {
    if (!newTableName.trim()) return;
    const rawClean = newTableName.trim();
    const cleanTblName = rawClean.startsWith('📁') ? rawClean : `📁 ${rawClean}`;

    updateActiveSheetData((prev) => {
      const existing = prev.custom_power_tables || [];
      const updated = [...existing.filter((t) => t.name !== cleanTblName), { name: cleanTblName, sub: newTableSub }];
      return { ...prev, custom_power_tables: updated };
    });
    saveActiveCharacter();

    setActiveTableName(cleanTblName);
    setIsCreatingTable(false);
    setNewTableName('');
  };

  // Custom Items & Ability Overrides
  const customItems: (Power | MagicItem)[] =
    type === 'powers'
      ? activeCharacter?.sheet_data?.custom_powers || []
      : activeCharacter?.sheet_data?.custom_magic_items || [];

  const customPowerTables = activeCharacter?.sheet_data?.custom_power_tables || [];
  const abilityOverrides = activeCharacter?.sheet_data?.ability_overrides || {};

  // Combine stock catalog with custom created items and apply overrides
  const fullCatalog = useMemo(() => {
    return [...stockCatalog, ...customItems].map((item) => {
      const cleaned = cleanName(item.name);
      const override = abilityOverrides[cleaned];
      const { baseName, version } = parseAbilityVersion(cleaned);
      const itemObj = {
        ...item,
        base_name: baseName,
        version: version,
      };
      if (!override) return itemObj;
      return {
        ...itemObj,
        action: override.action ?? itemObj.action,
        usage: override.usage ?? itemObj.usage,
        effect: override.effect ?? itemObj.effect,
      };
    });
  }, [stockCatalog, customItems, abilityOverrides]);

  // Set of lowercase known ability names for strict catalog deduplication
  const knownAbilityNamesSet = useMemo(() => {
    return new Set(slots.map((s) => cleanName(s.name).toLowerCase()));
  }, [slots]);

  // Learn an ability from catalog into active sheet slots
  const handleLearnAbility = (item: Power | MagicItem) => {
    const { baseName, version } = parseAbilityVersion(item.name);
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];

      if (type === 'powers') {
        const oldTotalUnits = calculateTotalPowerUnits(current);
        const oldApSpent = Math.max(0, oldTotalUnits - 3);

        const existingIndex = current.findIndex(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === baseName.toLowerCase()
        );

        const newSlot: AbilitySlot = {
          select: true,
          name: cleanName(item.name),
          base_name: baseName,
          version: version,
          action: (item.action?.toUpperCase() as any) || 'A',
          usage: item.usage || '1-Enc',
          effect: item.effect || '',
          checked: [false, false, false],
        };

        if (existingIndex >= 0) {
          const oldVersion = parseAbilityVersion(current[existingIndex].name).version;
          if (version > oldVersion) {
            current[existingIndex] = newSlot;
          } else {
            return prev;
          }
        } else {
          current.push(newSlot);
        }

        const prunedCurrent = pruneLesserPowerVersions(current);
        const newTotalUnits = calculateTotalPowerUnits(prunedCurrent);
        const newApSpent = Math.max(0, newTotalUnits - 3);
        const apDiff = newApSpent - oldApSpent;

        const isUpgrade = existingIndex >= 0;
        const logAction = isUpgrade ? 'Upgraded Power' : 'Learned Power';

        if (apDiff > 0) {
          recordApExpenditure(apDiff, 'Powers', `${logAction}: ${cleanName(item.name)} (+${apDiff} AP)`, 1, 'Manage Powers');
        } else {
          recordApExpenditure(0, 'Powers', `${logAction}: ${cleanName(item.name)} (0 AP - Covered by Free AP)`, 1, 'Manage Powers');
        }

        return { ...prev, [slotKey]: prunedCurrent };
      } else {
        const existingIndex = current.findIndex(
          (s) => cleanName(s.name).toLowerCase() === cleanName(item.name).toLowerCase()
        );
        if (existingIndex < 0) {
          current.push({
            select: true,
            name: cleanName(item.name),
            base_name: baseName,
            version: version,
            action: (item.action?.toUpperCase() as any) || 'A',
            usage: item.usage || '1-Enc',
            effect: item.effect || '',
            checked: [false, false, false],
          });
          recordApExpenditure(1, 'Magic Items', `Acquired Magic Item: ${cleanName(item.name)}`, 1, 'Manage Magic Items');
        }
        return { ...prev, [slotKey]: current };
      }
    });
    saveActiveCharacter();
  };

  // Drop / Un-learn an ability from the character's active roster
  const handleForgetAbility = (abilityName: string) => {
    const { baseName: targetBaseName } = parseAbilityVersion(abilityName);
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];

      if (type === 'powers') {
        const oldTotalUnits = calculateTotalPowerUnits(current);
        const oldApSpent = Math.max(0, oldTotalUnits - 3);

        const updated = current.filter(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() !== targetBaseName.toLowerCase()
        );
        const prunedUpdated = pruneLesserPowerVersions(updated);

        const newTotalUnits = calculateTotalPowerUnits(prunedUpdated);
        const newApSpent = Math.max(0, newTotalUnits - 3);
        const apRefund = oldApSpent - newApSpent;

        if (apRefund > 0) {
          recordApExpenditure(-apRefund, 'Powers', `Unlearned Power: ${cleanName(abilityName)} (-${apRefund} AP Refunded)`, 1, 'Manage Powers');
        } else {
          recordApExpenditure(0, 'Powers', `Unlearned Power: ${cleanName(abilityName)} (0 AP - Free Slot Freed)`, 1, 'Manage Powers');
        }

        return { ...prev, [slotKey]: prunedUpdated };
      } else {
        const updated = current.filter(
          (s) => cleanName(s.name).toLowerCase() !== cleanName(abilityName).toLowerCase()
        );
        return { ...prev, [slotKey]: updated };
      }
    });
    saveActiveCharacter();
  };

  // Custom Creation Save Handler
  const handleSaveCustomAbility = () => {
    if (!createName.trim()) return;
    const rawClean = cleanName(createName.trim());
    const { baseName, version } = parseAbilityVersion(rawClean);
    const versionedName = `${baseName} v${version}`;
    const targetTable = activeTableName || (type === 'powers' ? '📁 Custom Powers' : '📁 Custom Magic Items');

    const newItem: Power | MagicItem = {
      id: Date.now(),
      name: versionedName,
      base_name: baseName,
      version: version,
      action: createAction,
      usage: createUsage,
      effect: createEffect.trim(),
      source: 'Custom',
      created_at: new Date().toISOString(),
      dropdown: null,
      sub: type === 'powers' ? 'class' : null,
      table_name: targetTable,
    };

    updateActiveSheetData((prev) => {
      const customKey = type === 'powers' ? 'custom_powers' : 'custom_magic_items';
      const existingCustom = prev[customKey] || [];
      const updatedCustom = [...existingCustom, newItem];

      const currentSlots = [...(prev[slotKey] || [])];

      if (type === 'powers') {
        const oldTotalUnits = calculateTotalPowerUnits(currentSlots);
        const oldApSpent = Math.max(0, oldTotalUnits - 3);

        const existingIndex = currentSlots.findIndex(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === baseName.toLowerCase()
        );

        const newSlot: AbilitySlot = {
          select: true,
          name: versionedName,
          base_name: baseName,
          version: version,
          action: (createAction.toUpperCase() as any) || 'A',
          usage: createUsage,
          effect: createEffect.trim(),
          checked: [false, false, false],
        };

        if (existingIndex >= 0) {
          currentSlots[existingIndex] = newSlot;
        } else {
          currentSlots.push(newSlot);
        }

        const prunedSlots = pruneLesserPowerVersions(currentSlots);
        const newTotalUnits = calculateTotalPowerUnits(prunedSlots);
        const newApSpent = Math.max(0, newTotalUnits - 3);
        const apDiff = newApSpent - oldApSpent;

        const isUpgrade = existingIndex >= 0;
        const logAction = isUpgrade ? 'Upgraded Power' : 'Created & Learned Power';

        if (apDiff > 0) {
          recordApExpenditure(apDiff, 'Powers', `${logAction}: ${versionedName} (+${apDiff} AP)`, 1, 'Manage Powers');
        } else {
          recordApExpenditure(0, 'Powers', `${logAction}: ${versionedName} (0 AP - Covered by Free AP)`, 1, 'Manage Powers');
        }

        return {
          ...prev,
          [customKey]: updatedCustom,
          [slotKey]: prunedSlots,
        };
      } else {
        const existingIndex = currentSlots.findIndex(
          (s) => cleanName(s.name).toLowerCase() === versionedName.toLowerCase()
        );
        if (existingIndex < 0) {
          currentSlots.push({
            select: true,
            name: versionedName,
            base_name: baseName,
            version: version,
            action: (createAction.toUpperCase() as any) || 'A',
            usage: createUsage,
            effect: createEffect.trim(),
            checked: [false, false, false],
          });
        }
        return {
          ...prev,
          [customKey]: updatedCustom,
          [slotKey]: currentSlots,
        };
      }
    });
    saveActiveCharacter();

    setCreateName('');
    setCreateAction('A');
    setCreateUsage('1-Enc');
    setCreateEffect('');
    setIsVersionEditMode(false);
    setActiveRightTab('CATALOG');
  };

  // Filter catalog items by Category & Deduplication
  const categoryFilteredCatalog = useMemo(() => {
    return fullCatalog.filter((item) => {
      // 1. Deduplication: Filter out items already in the character's learned roster
      if (knownAbilityNamesSet.has(cleanName(item.name).toLowerCase())) {
        return false;
      }

      if (type === 'powers') {
        if (selectedCategory === 'favorites') {
          return Boolean(item.table_name && favoriteTables.includes(item.table_name));
        } else if (selectedCategory !== 'all') {
          const itemSub = (item.sub || '').toLowerCase();
          return itemSub.includes(selectedCategory.toLowerCase());
        }
      }
      return true;
    });
  }, [fullCatalog, knownAbilityNamesSet, type, selectedCategory, favoriteTables]);

  const groupedTables = useMemo(() => {
    const acc = categoryFilteredCatalog.reduce((map, item) => {
      const tableName = item.table_name || (type === 'powers' ? 'General Powers' : 'General Magic Items');
      if (!map[tableName]) map[tableName] = [];
      map[tableName].push(item);
      return map;
    }, {} as Record<string, (Power | MagicItem)[]>);

    if (type === 'powers') {
      customPowerTables.forEach((tbl) => {
        if (selectedCategory === 'favorites') {
          if (favoriteTables.includes(tbl.name) && !acc[tbl.name]) {
            acc[tbl.name] = [];
          }
        } else if (selectedCategory === 'all' || tbl.sub.toLowerCase().includes(selectedCategory.toLowerCase())) {
          if (!acc[tbl.name]) {
            acc[tbl.name] = [];
          }
        }
      });
    }

    return acc;
  }, [categoryFilteredCatalog, type, customPowerTables, selectedCategory, favoriteTables]);

  const availableTableNames = useMemo(() => Object.keys(groupedTables), [groupedTables]);

  const effectiveActiveTable = useMemo(() => {
    if (activeTableName === 'ALL') return 'ALL';
    if (activeTableName && availableTableNames.includes(activeTableName)) {
      return activeTableName;
    }
    return 'ALL';
  }, [activeTableName, availableTableNames]);

  const activeTableAbilities = useMemo(() => {
    if (effectiveActiveTable === 'ALL') {
      return categoryFilteredCatalog;
    }
    return effectiveActiveTable ? groupedTables[effectiveActiveTable] || [] : [];
  }, [effectiveActiveTable, groupedTables, categoryFilteredCatalog]);

  const filteredCatalogAbilities = useMemo(() => {
    return activeTableAbilities.filter((item) => {
      if (!rightSearchQuery.trim()) return true;
      const q = rightSearchQuery.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(q);
      const actionMatch = (item.action || '').toLowerCase().includes(q);
      const usageMatch = (item.usage || '').toLowerCase().includes(q);
      const effectMatch = (item.effect || '').toLowerCase().includes(q);
      return nameMatch || actionMatch || usageMatch || effectMatch;
    });
  }, [activeTableAbilities, rightSearchQuery]);

  // Filtered learned roster for Left Column search (Highest Version Only)
  const filteredRoster = useMemo(() => {
    const roster = type === 'powers' ? activeDisplaySlots : slots;
    if (!leftSearchQuery.trim()) return roster;
    const q = leftSearchQuery.toLowerCase().trim();
    return roster.filter((s) => cleanName(s.name).toLowerCase().includes(q) || (s.effect || '').toLowerCase().includes(q));
  }, [type, activeDisplaySlots, slots, leftSearchQuery]);

  const sectionIcon = type === 'powers' ? '🔥' : '✨';
  const displayTitle = title || (type === 'powers' ? 'POWERS' : 'MAGIC ITEMS');

  // Default Action Economy Sorting for Active Sheet
  const sortedSlots = useMemo(() => {
    return [...activeDisplaySlots].sort((a, b) => {
      const orderA = ACTION_ORDER[a.action?.toUpperCase() || ''] ?? 99;
      const orderB = ACTION_ORDER[b.action?.toUpperCase() || ''] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeDisplaySlots]);

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Header: Title, Icon, & Master Manager Trigger Button */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 flex-1 justify-start">
          <h3 className={`font-outfit font-bold text-sm tracking-widest uppercase flex items-center gap-2 ${
            type === 'powers' ? 'text-amber-300' : 'text-cyan-300'
          }`}>
            <span className="text-base">{sectionIcon}</span>
            {displayTitle}
          </h3>
          <CardHelpButton ruleKey={type === 'powers' ? 'powers.basics' : 'magic_items.basics'} />
        </div>

        {/* Clear Uses Button (Centered to align closer to the uses column) */}
        <div className="flex items-center justify-center flex-1">
          <button
            type="button"
            onClick={handleClearAllUses}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950/60 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title={`Uncheck all ${type === 'powers' ? 'power' : 'magic item'} usage checkboxes`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-outfit text-[11px] font-bold">Clear Uses</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 flex-1">
          <div className="relative">
          <button
            onClick={() => setShowManageModal(!showManageModal)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
              showManageModal
                ? type === 'powers'
                  ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                  : 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
                : type === 'powers'
                ? 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
                : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
            }`}
            title={`Manage ${type === 'powers' ? 'powers' : 'magic items'} roster and catalog`}
          >
            <span className="font-outfit font-bold">
              Manage {type === 'powers' ? 'Powers' : 'Magic Items'}
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
              {slots.length}
            </span>
            {showManageModal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* MASTER 2-COLUMN SPLIT-PANE MANAGER MODAL */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] max-h-[640px] flex flex-col shadow-2xl overflow-hidden text-xs"
              >
                {/* Modal Top Bar */}
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className={`p-2 rounded-xl border flex items-center justify-center ${
                      type === 'powers' ? 'bg-amber-950/80 border-amber-500/30 text-amber-300' : 'bg-cyan-950/80 border-cyan-500/30 text-cyan-300'
                    }`}>
                      <span className="text-lg leading-none">{sectionIcon}</span>
                    </div>
                    <div>
                      <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                        {type === 'powers' ? 'Powers Manager' : 'Magic Items Manager'}
                      </h3>
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Manage character {type === 'powers' ? 'powers' : 'magic items'} side-by-side with the SupaFlex stock catalog and custom creator.
                      </p>
                    </div>
                  </div>

                  {/* Center: KISS Top-Center Header Status Pill */}
                  {type === 'powers' && (
                    <div className="px-3.5 py-1 bg-amber-950/70 border border-amber-500/40 rounded-full font-mono font-bold text-xs text-amber-200 flex items-center gap-2 shadow-md">
                      <span>
                        Learned <strong className="text-amber-300">{totalPowerUnits}</strong>; Used{' '}
                        <strong className="text-rose-300">
                          {apSpent}
                          {totalPowerUnits > 0 ? `+${Math.min(3, totalPowerUnits)}Free` : ''} AP
                        </strong>
                        ; Available <strong className="text-emerald-400">{availableAp} AP</strong>
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setShowManageModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 2-COLUMN SPLIT-PANE BODY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  
                  {/* --- LEFT COLUMN: LEARNED ABILITIES ROSTER --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Flame className={`w-4 h-4 ${type === 'powers' ? 'text-amber-400' : 'text-cyan-400'}`} />
                        <span className={`text-xs font-outfit font-bold uppercase tracking-wider ${type === 'powers' ? 'text-amber-300' : 'text-cyan-300'}`}>
                          Learned {type === 'powers' ? 'Powers' : 'Magic Items'}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-900 rounded text-slate-300 border border-slate-800">
                          {type === 'powers' ? activeDisplaySlots.length : slots.length}
                        </span>
                      </div>

                      {/* Roster Search Filter */}
                      <div className="relative">
                        <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search learned..."
                          value={leftSearchQuery}
                          onChange={(e) => setLeftSearchQuery(e.target.value)}
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-amber-500 w-24 sm:w-28"
                        />
                      </div>
                    </div>

                    {/* Scrollable Learned Abilities List */}
                    <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2.5 min-h-0">
                      {filteredRoster.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                          <Flame className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                          {leftSearchQuery ? (
                            <span>No abilities matching "{leftSearchQuery}"</span>
                          ) : (
                            <span>No {type} learned yet. Select from catalog on the right.</span>
                          )}
                        </div>
                      ) : (
                        filteredRoster.map((item, idx) => {
                          const cleaned = cleanName(item.name);
                          const { baseName, version } = parseAbilityVersion(cleaned);
                          const actionUpper = (item.action || '').toUpperCase();
                          const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                          return (
                            <div
                              key={item.name + idx}
                              className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all shrink-0 hover:border-slate-700"
                            >
                              {/* Header Row: Name, Action, Usage, Drop Button */}
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-outfit font-bold text-sm text-slate-100">{baseName}</span>
                                  {version > 1 && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                      v{version}
                                    </span>
                                  )}
                                  {actionUpper && (
                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${actionClass}`}>
                                      {actionUpper}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleLaunchVersionEditor(item)}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                                    title={`Create version ${version + 1} of ${baseName}`}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleForgetAbility(item.name)}
                                    className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 text-xs font-bold rounded-lg transition-all shrink-0"
                                    title="Forget ability"
                                  >
                                    - Forget
                                  </button>
                                </div>
                              </div>

                              {/* Sub-Row: Usage & Effect */}
                              <div className="flex flex-col gap-1 text-xs">
                                {item.usage && (
                                  <span className="bg-slate-950 text-[10px] font-mono text-amber-300 px-2 py-0.5 rounded border border-slate-800 w-fit">
                                    {item.usage}
                                  </span>
                                )}
                                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                                  {item.effect || 'No description'}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* --- RIGHT COLUMN: STOCK CATALOG & CUSTOM CREATOR PANE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Sub-Tab Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 p-0.5 bg-slate-900 rounded-lg border border-slate-800 w-full">
                        <button
                          onClick={() => setActiveRightTab('CATALOG')}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'CATALOG'
                              ? type === 'powers'
                                ? 'bg-amber-600/30 text-amber-200 border border-amber-500/40 shadow-sm'
                                : 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5 text-amber-400" />
                          Stock Catalog ({filteredCatalogAbilities.length})
                        </button>

                        <button
                          onClick={() => {
                            if (activeRightTab === 'CREATOR' && isVersionEditMode) {
                              setIsVersionEditMode(false);
                              setCreateName('');
                              setCreateAction('A');
                              setCreateUsage('1-Enc');
                              setCreateEffect('');
                            }
                            setActiveRightTab('CREATOR');
                          }}
                          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'CREATOR'
                              ? type === 'powers'
                                ? 'bg-amber-600/30 text-amber-200 border border-amber-500/40 shadow-sm'
                                : 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5 text-amber-400" />
                          {isVersionEditMode ? `Version Editor (v${versionEditNextVersion})` : 'Custom Creator'}
                        </button>
                      </div>
                    </div>

                    {/* TAB 1: STOCK CATALOG VIEW */}
                    {activeRightTab === 'CATALOG' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2 gap-2 overflow-hidden">
                        {/* Category Dropdown (Powers Mode Only) */}
                        {type === 'powers' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-slate-400 shrink-0">Category:</span>
                            <select
                              value={selectedCategory}
                              onChange={(e) => {
                                const newCat = e.target.value;
                                setSelectedCategory(newCat);
                                if (newCat === 'all') {
                                  setActiveTableName('ALL');
                                } else {
                                  setActiveTableName(null);
                                }
                              }}
                              className="bg-slate-900 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 outline-none flex-1 min-w-0 truncate cursor-pointer"
                            >
                              {POWER_CATEGORY_BUTTONS.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.icon} {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Table Selector Dropdown & + Table Button */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-400 shrink-0">Table:</span>
                          <select
                            value={effectiveActiveTable || 'ALL'}
                            onChange={(e) => setActiveTableName(e.target.value)}
                            className="bg-slate-900 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 outline-none flex-1 min-w-0 truncate cursor-pointer"
                          >
                            <option value="ALL">🌐 All Tables ({categoryFilteredCatalog.length})</option>
                            {availableTableNames.map((tblName) => (
                              <option key={tblName} value={tblName}>
                                📁 {tblName} ({groupedTables[tblName]?.length || 0})
                              </option>
                            ))}
                          </select>
                          {type === 'powers' && effectiveActiveTable && (
                            <button
                              type="button"
                              onClick={() => handleToggleFavoriteTable(effectiveActiveTable)}
                              className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center shrink-0 ${
                                favoriteTables.includes(effectiveActiveTable)
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                                  : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-amber-400'
                              }`}
                              title={favoriteTables.includes(effectiveActiveTable) ? 'Remove table from Favorites' : 'Save table to Favorites'}
                            >
                              <Star className={`w-3.5 h-3.5 ${favoriteTables.includes(effectiveActiveTable) ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                          )}
                          {type === 'powers' && (
                            <button
                              onClick={() => setIsCreatingTable(true)}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 shrink-0 transition-colors flex items-center gap-1 shadow-sm"
                              title="Create custom table"
                            >
                              <Plus className="w-3 h-3" />
                              Table
                            </button>
                          )}
                        </div>

                        {/* Inline Table Creator Drawer */}
                        {type === 'powers' && isCreatingTable && (
                          <div className="p-2.5 bg-slate-950/90 rounded-xl border border-amber-500/40 flex flex-col gap-2 shadow-md shrink-0">
                            <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                              <span className="font-outfit font-bold text-[11px] text-amber-300 flex items-center gap-1">
                                📁 Create Custom Table
                              </span>
                              <button onClick={() => setIsCreatingTable(false)} className="text-slate-400 hover:text-slate-200">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={newTableName}
                              onChange={(e) => setNewTableName(e.target.value)}
                              placeholder="Table Name..."
                              className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-100 outline-none focus:border-amber-400"
                            />
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] text-slate-400 font-bold">Category:</label>
                              <select
                                value={newTableSub}
                                onChange={(e) => setNewTableSub(e.target.value)}
                                className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-[10px] text-amber-300 outline-none flex-1 font-semibold"
                              >
                                <option value="class">👤 Class</option>
                                <option value="racial">🧬 Racial</option>
                                <option value="combat_styles">⚔️ Combat Styles</option>
                                <option value="luck">🍀 Luck</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button onClick={() => setIsCreatingTable(false)} className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200">
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveCustomTable}
                                disabled={!newTableName.trim()}
                                className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-[10px] rounded transition-all shadow-sm"
                              >
                                Save Table
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Search Bar */}
                        <div className="shrink-0">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder={`Search catalog ${type === 'powers' ? 'powers' : 'magic items'}...`}
                              value={rightSearchQuery}
                              onChange={(e) => setRightSearchQuery(e.target.value)}
                              className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-amber-500 w-full"
                            />
                          </div>
                        </div>

                        {/* Scrollable Catalog Abilities List */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                          {filteredCatalogAbilities.length > 0 ? (
                            filteredCatalogAbilities.map((item, idx) => {
                              const { baseName, version } = parseAbilityVersion(item.name);
                              const actionUpper = (item.action || '').toUpperCase();

                              return (
                                <div
                                  key={item.id || idx}
                                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-2 hover:border-amber-500/40 transition-all shrink-0"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-sm text-slate-100">{baseName}</span>
                                      {version > 1 && (
                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                          v{version}
                                        </span>
                                      )}
                                      {actionUpper && (
                                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${ACTION_COLORS[actionUpper] || 'bg-slate-800'}`}>
                                          {actionUpper}
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => handleLearnAbility(item)}
                                      className="px-3 py-1 text-xs font-bold rounded-lg border bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 flex items-center gap-1 transition-all shrink-0"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      + Learn
                                    </button>
                                  </div>

                                  <div className="flex flex-col gap-1 text-xs text-slate-300">
                                    {item.usage && (
                                      <span className="bg-slate-900 text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 w-fit">
                                        {item.usage}
                                      </span>
                                    )}
                                    <p className="text-[11px] leading-relaxed font-sans">{item.effect || 'No description'}</p>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-500 italic py-6 text-center">
                              No catalog abilities match search/filters in {effectiveActiveTable || 'catalog'}.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* TAB 2: CUSTOM CREATOR VIEW */}
                    {activeRightTab === 'CREATOR' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2.5 overflow-y-auto">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveCustomAbility();
                          }}
                          className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-xl flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                              {isVersionEditMode ? (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  Version Editor: {versionEditBaseName} v{versionEditNextVersion}
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                                  Custom Creator
                                </>
                              )}
                            </span>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-300">Ability Name</span>
                              {isVersionEditMode ? (
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={createName}
                                    readOnly
                                    className="bg-slate-900/90 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-800 outline-none cursor-not-allowed w-full pl-8"
                                  />
                                  <Lock className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="e.g. Arcane Surge v1"
                                  value={createName}
                                  onChange={(e) => setCreateName(e.target.value)}
                                  className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
                                  required
                                />
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300 shrink-0">Action:</span>
                                <select
                                  value={createAction}
                                  onChange={(e) => setCreateAction(e.target.value)}
                                  className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none w-full"
                                >
                                  {ACTION_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-300 shrink-0">Usage:</span>
                                <select
                                  value={createUsage}
                                  onChange={(e) => setCreateUsage(e.target.value)}
                                  className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none w-full"
                                >
                                  {USAGE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 pt-1">
                              <div className="flex items-center justify-between flex-wrap gap-1">
                                <span className="text-xs font-bold text-slate-300">Effect Description</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-[10px] text-slate-400 font-bold mr-0.5">Insert Icon:</span>
                                  {MAIN_ABILITY_ICONS.map((item) => (
                                    <button
                                      key={item.label}
                                      type="button"
                                      onClick={() => insertIconAtCursor(item.icon)}
                                      className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                      title={`Insert ${item.icon} (${item.label}) at cursor`}
                                    >
                                      <span>{item.icon}</span>
                                      <span className="hidden sm:inline text-[9px] text-slate-300">{item.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <textarea
                                ref={createEffectRef}
                                value={createEffect}
                                onChange={(e) => setCreateEffect(e.target.value)}
                                placeholder="Describe the mechanical effects of this custom ability..."
                                rows={3}
                                className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400 resize-none"
                                required
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full mt-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{isVersionEditMode ? `Save & Learn ${createName}` : 'Save & Learn Custom Ability'}</span>
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer Status Bar with Standardized "Done" Button */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-outfit font-bold text-slate-300">
                      {type === 'powers' ? '⚡ Powers Manager' : '✨ Magic Items Manager'}
                    </span>
                  </div>
                  
                  {/* Standardized Master Blueprint Done Footer Button */}
                  <button 
                    onClick={() => setShowManageModal(false)} 
                    className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Main Character Sheet Card View: Entire List of Learned Abilities */}
      <div className="flex flex-col gap-2">
        {sortedSlots.length > 0 ? (
          sortedSlots.map((slot, index) => {
            const cleaned = cleanName(slot.name);
            const { baseName, version } = parseAbilityVersion(cleaned);
            const actionUpper = (slot.action || '').toUpperCase();
            const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
            const usageCount = parseUsageCount(slot.usage);

            return (
              <div
                key={index}
                className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all"
              >
                {/* 1. Name Column with Version Badge */}
                <div className="w-36 sm:w-44 shrink-0 flex flex-col gap-0.5">
                  <span className="font-outfit font-bold text-xs text-slate-100 block whitespace-normal break-words leading-tight">
                    {baseName}
                  </span>
                  {version > 1 && (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 w-fit flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                      v{version} Active
                    </span>
                  )}
                </div>

                {/* 2. Action Badge Column */}
                <div className="w-12 shrink-0 flex items-center justify-center">
                  {actionUpper ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${actionClass}`}>
                      {actionUpper}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono">-</span>
                  )}
                </div>

                {/* 3. Uses Text Column */}
                <div className="w-20 shrink-0 flex items-center justify-start">
                  {slot.usage ? (
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 truncate" title={slot.usage}>
                      {slot.usage}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono">-</span>
                  )}
                </div>

                {/* 4. Checkboxes Column */}
                <div className="w-16 shrink-0 flex items-center gap-1 min-w-[64px]">
                  {usageCount > 0 ? (
                    Array.from({ length: usageCount }).map((_, bIdx) => {
                      const isChecked = !!(slot.checked && slot.checked[bIdx]);
                      return (
                        <input
                          key={bIdx}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(slot, bIdx)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                          title={`Usage slot ${bIdx + 1}`}
                        />
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono select-none">-</span>
                  )}
                </div>

                {/* 5. Effect Description Column */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 whitespace-normal break-words leading-relaxed">
                    {slot.effect || 'No effect description'}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 bg-slate-950/40 rounded-lg border border-slate-850 text-xs text-slate-500 italic text-center">
            No {type === 'powers' ? 'powers' : 'magic items'} learned yet. Click "Manage {type === 'powers' ? 'Powers' : 'Magic Items'}" above to select abilities.
          </div>
        )}
      </div>
    </div>
  );
};
