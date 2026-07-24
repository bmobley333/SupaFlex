import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X, Check, Star, Plus, Edit2, Lock, Save, GitBranch, Sparkles } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AbilitySlot, Power, MagicItem } from '../../types/game';

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
const PRIMARY_ATTRIBUTE_ICONS = [
  { label: 'Might', icon: '💪' },
  { label: 'Motion', icon: '🏃' },
  { label: 'Mind', icon: '👁️' },
  { label: 'Magic', icon: '✨' },
  { label: 'Moxie', icon: '🫀' },
];

const cleanName = (name: string) => {
  return name.replace(/\s*\[[A-Z]+\]$/i, '').trim();
};

const parseUsageCount = (usage?: string): number => {
  if (!usage) return 0;
  const match = usage.trim().match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
};

// Helper: Parse base name and version integer (e.g. "Deadeye Shot v2" -> { baseName: "Deadeye Shot", version: 2 })
const parseAbilityVersion = (name: string): { baseName: string; version: number } => {
  const cleaned = cleanName(name);
  const match = cleaned.match(/^(.*?)(?:\s+v(\d+))$/i);
  if (match) {
    return {
      baseName: match[1].trim(),
      version: parseInt(match[2], 10),
    };
  }
  return {
    baseName: cleaned,
    version: 1,
  };
};

const POWER_CATEGORY_BUTTONS = [
  { id: 'class', label: 'Class', icon: '👤' },
  { id: 'race', label: 'Racial', icon: '🧬' },
  { id: 'combat style', label: 'Combat Styles', icon: '⚔️' },
  { id: 'luck', label: 'Luck', icon: '🍀' },
  { id: 'favorites', label: 'Favorites', icon: '⭐' },
  { id: 'all', label: 'ALL', icon: '🌐' },
];

export const AbilitySlotsGrid: React.FC<AbilitySlotsGridProps> = ({ title, type }) => {
  const { activeCharacter, powers, magicItems, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const slotKey = type === 'powers' ? 'power_slots' : 'spell_slots';
  const slots: AbilitySlot[] = activeCharacter?.sheet_data?.[slotKey] || [];
  const favoriteTables: string[] = activeCharacter?.sheet_data?.favorite_power_tables || [];
  const stockCatalog = type === 'powers' ? powers : magicItems;

  const [showCatalogPopover, setShowCatalogPopover] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Creation Form State
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [isVersionUpgrade, setIsVersionUpgrade] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createAction, setCreateAction] = useState('A');
  const [createUsage, setCreateUsage] = useState('1-Enc');
  const [createEffect, setCreateEffect] = useState('');
  const createEffectRef = useRef<HTMLTextAreaElement>(null);

  // Inline Editing Form State
  const [editingAbilityName, setEditingAbilityName] = useState<string | null>(null);
  const [editAction, setEditAction] = useState('A');
  const [editUsage, setEditUsage] = useState('1-Enc');
  const [editEffect, setEditEffect] = useState('');
  const editEffectRef = useRef<HTMLTextAreaElement>(null);

  // History Accordion Open State
  const [expandedHistoryBases, setExpandedHistoryBases] = useState<string[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowCatalogPopover(false);
      }
    };
    if (showCatalogPopover) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showCatalogPopover]);

  const handleCheckboxToggle = (slotIndex: number, checkIndex: number) => {
    updateActiveSheetData((prev) => {
      const updatedSlots = [...(prev[slotKey] || [])];
      const targetSlot = { ...updatedSlots[slotIndex] };
      const newChecked = [...(targetSlot.checked || [false, false, false])];
      newChecked[checkIndex] = !newChecked[checkIndex];
      targetSlot.checked = newChecked;
      updatedSlots[slotIndex] = targetSlot;
      return { ...prev, [slotKey]: updatedSlots };
    });
    saveActiveCharacter();
  };

  const handleToggleFavoriteTable = (tableName: string) => {
    updateActiveSheetData((prev) => {
      const current = prev.favorite_power_tables || [];
      const updated = current.includes(tableName)
        ? current.filter((t) => t !== tableName)
        : [...current, tableName];
      return { ...prev, favorite_power_tables: updated };
    });
    saveActiveCharacter();
  };

  const toggleHistoryAccordion = (baseName: string) => {
    setExpandedHistoryBases((prev) =>
      prev.includes(baseName) ? prev.filter((b) => b !== baseName) : [...prev, baseName]
    );
  };

  const handleOpenCustomCreation = () => {
    setCreateName('');
    setCreateAction('A');
    setCreateUsage('1-Enc');
    setCreateEffect('');
    setIsVersionUpgrade(false);
    setIsCreatingCustom(true);
  };

  // Cursor-aware icon insertion helper
  const handleInsertIcon = (
    emoji: string,
    ref: React.RefObject<HTMLTextAreaElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!ref.current) return;
    const { selectionStart, selectionEnd } = ref.current;
    const val = ref.current.value;
    const newText = val.slice(0, selectionStart) + emoji + val.slice(selectionEnd);
    if (newText.length <= 450) {
      setter(newText);
      setTimeout(() => {
        if (ref.current) {
          ref.current.focus();
          const newPos = selectionStart + emoji.length;
          ref.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    }
  };

  // Custom Items & Ability Overrides
  const customItems: (Power | MagicItem)[] =
    type === 'powers'
      ? activeCharacter?.sheet_data?.custom_powers || []
      : activeCharacter?.sheet_data?.custom_magic_items || [];

  const abilityOverrides = activeCharacter?.sheet_data?.ability_overrides || {};

  // Combine stock catalog with custom created items and apply overrides
  const fullCatalog = [...stockCatalog, ...customItems].map((item) => {
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

  const handleToggleCatalogAbility = (abilityName: string) => {
    const foundItem = fullCatalog.find((p) => cleanName(p.name).toLowerCase() === cleanName(abilityName).toLowerCase());
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];
      const existingIndex = current.findIndex(
        (s) => cleanName(s.name).toLowerCase() === cleanName(abilityName).toLowerCase()
      );

      if (existingIndex >= 0) {
        current.splice(existingIndex, 1);
      } else if (foundItem) {
        const { baseName, version } = parseAbilityVersion(foundItem.name);
        current.push({
          select: true,
          name: cleanName(foundItem.name),
          base_name: baseName,
          version: version,
          action: (foundItem.action?.toUpperCase() as any) || '',
          usage: foundItem.usage || '',
          effect: foundItem.effect || '',
          checked: [false, false, false],
        });
      }
      return { ...prev, [slotKey]: current };
    });
    saveActiveCharacter();
  };

  // Custom Creation Save Handler (Auto-Versions to v1 or keeps user v#)
  const handleSaveCustomAbility = () => {
    if (!createName.trim()) return;
    const rawClean = cleanName(createName.trim());
    const { baseName, version } = parseAbilityVersion(rawClean);
    const versionedName = `${baseName} v${version}`;

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
      table_name: type === 'powers' ? '📁 Custom Powers' : '📁 Custom Magic Items',
    };

    updateActiveSheetData((prev) => {
      const customKey = type === 'powers' ? 'custom_powers' : 'custom_magic_items';
      const existingCustom = prev[customKey] || [];
      const updatedCustom = [...existingCustom, newItem];

      // Auto-learn newly created custom ability
      const currentSlots = [...(prev[slotKey] || [])];
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
    });
    saveActiveCharacter();

    // Reset creation form
    setCreateName('');
    setCreateAction('A');
    setCreateUsage('1-Enc');
    setCreateEffect('');
    setIsVersionUpgrade(false);
    setIsCreatingCustom(false);
    setActiveTableName(type === 'powers' ? '📁 Custom Powers' : '📁 Custom Magic Items');
  };

  // 1-Click Version Upgrade Handler (Pre-fills creation form with v{N+1} and locks name)
  const handleStartUpgrade = (item: Power | MagicItem) => {
    const { baseName, version } = parseAbilityVersion(item.name);
    const nextVersion = version + 1;
    setCreateName(`${baseName} v${nextVersion}`);
    setCreateAction(item.action || 'A');
    setCreateUsage(item.usage || '1-Enc');
    setCreateEffect(item.effect || '');
    setIsVersionUpgrade(true);
    setIsCreatingCustom(true);
  };

  // Inline Edit Handlers
  const handleStartEdit = (item: Power | MagicItem) => {
    const cleaned = cleanName(item.name);
    setEditingAbilityName(cleaned);
    setEditAction(item.action || 'A');
    setEditUsage(item.usage || '1-Enc');
    setEditEffect(item.effect || '');
  };

  const handleSaveEdit = (originalName: string) => {
    const cleaned = cleanName(originalName);
    updateActiveSheetData((prev) => {
      const overrides = { ...(prev.ability_overrides || {}) };
      overrides[cleaned] = {
        action: editAction,
        usage: editUsage,
        effect: editEffect.trim(),
      };

      // Also update in custom items if it's a custom created item
      const customKey = type === 'powers' ? 'custom_powers' : 'custom_magic_items';
      const existingCustom = [...(prev[customKey] || [])];
      const customIndex = existingCustom.findIndex(
        (c) => cleanName(c.name).toLowerCase() === cleaned.toLowerCase()
      );
      if (customIndex >= 0) {
        existingCustom[customIndex] = {
          ...existingCustom[customIndex],
          action: editAction,
          usage: editUsage,
          effect: editEffect.trim(),
        };
      }

      // Also update active slots if currently learned
      const currentSlots = [...(prev[slotKey] || [])];
      const slotIndex = currentSlots.findIndex(
        (s) => cleanName(s.name).toLowerCase() === cleaned.toLowerCase()
      );
      if (slotIndex >= 0) {
        currentSlots[slotIndex] = {
          ...currentSlots[slotIndex],
          action: (editAction.toUpperCase() as any) || '',
          usage: editUsage,
          effect: editEffect.trim(),
        };
      }

      return {
        ...prev,
        ability_overrides: overrides,
        [customKey]: existingCustom,
        [slotKey]: currentSlots,
      };
    });
    saveActiveCharacter();
    setEditingAbilityName(null);
  };

  // 1. Filter catalog items by selected Category (Powers mode)
  const categoryFilteredCatalog = fullCatalog.filter((item) => {
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

  // 2. Group items under category by table_name
  const groupedTables = categoryFilteredCatalog.reduce((acc, item) => {
    const tableName = item.table_name || (type === 'powers' ? 'General Powers' : 'General Magic Items');
    if (!acc[tableName]) acc[tableName] = [];
    acc[tableName].push(item);
    return acc;
  }, {} as Record<string, (Power | MagicItem)[]>);

  // 3. Extract table names and filter by left pane tableSearchQuery
  const allTableNames = Object.keys(groupedTables);
  const filteredTableNames = allTableNames.filter((t) =>
    t.toLowerCase().includes(tableSearchQuery.toLowerCase().trim())
  );

  // 4. Effective active table (auto-select first in list if activeTableName is invalid/unselected)
  const effectiveActiveTable =
    activeTableName && filteredTableNames.includes(activeTableName)
      ? activeTableName
      : filteredTableNames[0] || null;

  // 5. Abilities for active table filtered by right pane searchQuery
  const activeTableAbilities = effectiveActiveTable ? groupedTables[effectiveActiveTable] || [] : [];
  const filteredAbilities = activeTableAbilities.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = item.name.toLowerCase().includes(q);
    const actionMatch = (item.action || '').toLowerCase().includes(q);
    const usageMatch = (item.usage || '').toLowerCase().includes(q);
    const effectMatch = (item.effect || '').toLowerCase().includes(q);
    return nameMatch || actionMatch || usageMatch || effectMatch;
  });

  // 6. Master-Child Grouping by baseName for Popover View (Highest version as Master Row)
  const groupedByBaseName = filteredAbilities.reduce((acc, item) => {
    const { baseName } = parseAbilityVersion(item.name);
    if (!acc[baseName]) acc[baseName] = [];
    acc[baseName].push(item);
    return acc;
  }, {} as Record<string, (Power | MagicItem)[]>);

  const sectionIcon = type === 'powers' ? '🔥' : '✨';
  const displayTitle = title || (type === 'powers' ? 'POWERS' : 'MAGIC ITEMS');

  // Automatic Highest-Version Active Sheet Display (ALWAYS max(version) per baseName)
  const highestVersionSlotsMap = slots.reduce((acc, slot) => {
    const { baseName, version } = parseAbilityVersion(slot.name);
    const existing = acc[baseName];
    if (!existing || version > parseAbilityVersion(existing.name).version) {
      acc[baseName] = slot;
    }
    return acc;
  }, {} as Record<string, AbilitySlot>);

  const activeDisplaySlots = Object.values(highestVersionSlotsMap);

  // Automatic Default Action Economy Sorting for Active Sheet
  const sortedSlots = [...activeDisplaySlots].sort((a, b) => {
    const orderA = ACTION_ORDER[a.action?.toUpperCase() || ''] ?? 99;
    const orderB = ACTION_ORDER[b.action?.toUpperCase() || ''] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Header: Title, Icon, & Catalog Trigger */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <span className="text-base">{sectionIcon}</span>
          {displayTitle}
        </h3>

        <div className="flex items-center gap-2">
          {/* Relative wrapper for Manage Catalog Popover */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowCatalogPopover(!showCatalogPopover)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-sm ${
                showCatalogPopover
                  ? type === 'powers'
                    ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                    : 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
                  : type === 'powers'
                  ? 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300'
                  : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300'
              }`}
              title={`Click to browse and manage ${type}`}
            >
              <span className="font-outfit font-bold">
                Manage {type === 'powers' ? 'Powers' : 'Magic Items'}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-slate-950 rounded text-slate-200">
                {sortedSlots.length}/{fullCatalog.length}
              </span>
              {showCatalogPopover ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>

            {/* Catalog Viewport-Centered Floating Glass Modal (Master-Detail Split Pane Option A - 960px Width, Zero Viewport Clipping) */}
            {showCatalogPopover && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn overflow-y-auto"
                onClick={() => setShowCatalogPopover(false)}
              >
                <div
                  className="w-[960px] max-w-[96vw] max-h-[90vh] p-4 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/80 backdrop-blur-xl flex flex-col gap-3 text-xs overflow-x-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                    <span className="font-outfit font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                      <span className="text-sm">{sectionIcon}</span>
                      {type === 'powers' ? 'Powers Catalog' : 'Magic Items Catalog'} ({sortedSlots.length} Active Learned)
                    </span>
                    <button
                      onClick={() => setShowCatalogPopover(false)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                      title="Close popover"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Sub-Category Choice Buttons Row (Powers Mode Only) */}
                  {type === 'powers' && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 border-b border-slate-800 pb-2.5">
                      {POWER_CATEGORY_BUTTONS.map((cat) => {
                        const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();
                        return (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategory(cat.id);
                              setActiveTableName(null);
                            }}
                            className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 shadow-sm ${
                              isSelected
                                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400 shadow-indigo-500/20'
                                : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            <span className="text-sm">{cat.icon}</span>
                            <span className="truncate">{cat.label}</span>
                            {cat.id === 'favorites' && favoriteTables.length > 0 && (
                              <span className="text-[10px] font-mono font-extrabold px-1 py-0.2 bg-slate-900 rounded text-amber-300">
                                ({favoriteTables.length})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Master-Detail Split Pane Container */}
                  <div className="flex flex-col md:flex-row gap-3 min-h-[380px] max-h-[440px]">
                    {/* LEFT MASTER PANE: Table Selection Index (Auto-Wrapping Table Names) */}
                    <div className="w-full md:w-64 shrink-0 flex flex-col gap-2 border-b md:border-b-0 md:border-r border-slate-800 pb-2 md:pb-0 md:pr-3">
                      <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 focus-within:border-indigo-500/50">
                        <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <input
                          type="text"
                          value={tableSearchQuery}
                          onChange={(e) => setTableSearchQuery(e.target.value)}
                          placeholder="Search tables..."
                          className="bg-transparent text-xs font-semibold text-slate-200 outline-none w-full placeholder:text-slate-500"
                        />
                        {tableSearchQuery && (
                          <button onClick={() => setTableSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
                        {filteredTableNames.length > 0 ? (
                          filteredTableNames.map((tblName) => {
                            const itemsInTbl = groupedTables[tblName] || [];
                            const learnedCount = itemsInTbl.filter((item) =>
                              slots.some((s) => cleanName(s.name).toLowerCase() === cleanName(item.name).toLowerCase())
                            ).length;
                            const isSelected = effectiveActiveTable === tblName;
                            const isFavorited = favoriteTables.includes(tblName);

                            return (
                              <div
                                key={tblName}
                                onClick={() => setActiveTableName(tblName)}
                                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-2 text-xs ${
                                  isSelected
                                    ? 'bg-indigo-950/80 border-indigo-500/60 text-indigo-200 shadow-sm font-bold'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                }`}
                              >
                                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                  <span className="shrink-0 text-xs mt-0.5">📁</span>
                                  <span className="font-outfit text-xs whitespace-normal break-words leading-tight text-left">
                                    {tblName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <span className="text-[10px] font-mono text-slate-400">
                                    ({learnedCount}/{itemsInTbl.length})
                                  </span>
                                  {type === 'powers' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleFavoriteTable(tblName);
                                      }}
                                      className="p-1 hover:bg-slate-800 rounded transition-colors"
                                      title={isFavorited ? 'Remove from Favorite Tables' : 'Add to Favorite Tables'}
                                    >
                                      <Star
                                        className={`w-3 h-3 ${
                                          isFavorited ? 'fill-amber-400 text-amber-400' : 'text-slate-500 hover:text-amber-400'
                                        }`}
                                      />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-3 text-center text-slate-500 italic text-xs">
                            {selectedCategory === 'favorites'
                              ? 'No favorite tables starred.'
                              : `No tables match "${tableSearchQuery}"`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT DETAIL PANE: Active Table Ability Work Area & Version Tree */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0 pl-0 md:pl-1">
                      {/* Active Table Header Bar with ➕ Create Custom Button */}
                      <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm gap-2">
                        <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-2 flex-1 min-w-0">
                          <span className="shrink-0">📁</span>
                          <span className="whitespace-normal break-words leading-tight">
                            {effectiveActiveTable || (type === 'powers' ? 'Powers' : 'Magic Items')}
                          </span>
                          {effectiveActiveTable && groupedTables[effectiveActiveTable] && (
                            <span className="text-slate-400 text-[10px] font-mono shrink-0">
                              ({Object.keys(groupedByBaseName).length} Master Abilities)
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={handleOpenCustomCreation}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 shadow-sm bg-indigo-950/40 hover:bg-indigo-900/50 border-indigo-500/30 text-indigo-300"
                            title={`Create custom ${type === 'powers' ? 'power' : 'magic item'}`}
                          >
                            <Plus className="w-3 h-3" />
                            Custom
                          </button>

                          {type === 'powers' && effectiveActiveTable && (
                            <button
                              onClick={() => handleToggleFavoriteTable(effectiveActiveTable)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                favoriteTables.includes(effectiveActiveTable)
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300 hover:border-amber-500/30'
                              }`}
                              title={
                                favoriteTables.includes(effectiveActiveTable)
                                  ? 'Remove from Favorite Tables'
                                  : 'Add to Favorite Tables'
                              }
                            >
                              <Star
                                className={`w-3 h-3 ${
                                  favoriteTables.includes(effectiveActiveTable) ? 'fill-amber-400 text-amber-400' : ''
                                }`}
                              />
                              {favoriteTables.includes(effectiveActiveTable) ? 'Favorite' : 'Favorite'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Custom Ability Creation Drawer Form */}
                      {isCreatingCustom && (
                        <div className="p-3 bg-slate-950/90 rounded-xl border border-indigo-500/40 flex flex-col gap-2.5 shadow-lg">
                          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1.5">
                            <span className="font-outfit font-extrabold text-xs text-indigo-300 flex items-center gap-1.5">
                              ➕ {isVersionUpgrade ? 'Upgrade Ability Version' : `Create Custom ${type === 'powers' ? 'Power' : 'Magic Item'}`}
                            </span>
                            <button onClick={() => setIsCreatingCustom(false)} className="text-slate-400 hover:text-slate-200">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            {isVersionUpgrade ? (
                              <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-indigo-500/40 text-xs font-bold text-slate-100 flex items-center gap-1.5 flex-1 select-none">
                                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{createName}</span>
                                <span className="text-[10px] text-amber-300 font-mono font-normal">(Auto-Generated Version)</span>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                placeholder="Custom Name (e.g. Arcane Bolt)..."
                                className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 text-xs text-slate-100 outline-none focus:border-indigo-400 flex-1"
                              />
                            )}

                            <div className="flex items-center gap-1.5">
                              <select
                                value={createAction}
                                onChange={(e) => setCreateAction(e.target.value)}
                                className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-indigo-300 font-mono outline-none"
                              >
                                {ACTION_OPTIONS.map((a) => (
                                  <option key={a} value={a}>{a}</option>
                                ))}
                              </select>
                              <select
                                value={createUsage}
                                onChange={(e) => setCreateUsage(e.target.value)}
                                className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-300 font-mono outline-none"
                              >
                                {USAGE_OPTIONS.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Primary Icon Insertion Bar */}
                          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 font-bold px-1">Insert Icon:</span>
                            {PRIMARY_ATTRIBUTE_ICONS.map(({ label, icon }) => (
                              <button
                                key={label}
                                type="button"
                                onClick={() => handleInsertIcon(icon, createEffectRef, setCreateEffect)}
                                className="px-1.5 py-0.5 bg-slate-950 hover:bg-indigo-950/80 text-xs rounded border border-slate-800 text-slate-200 transition-colors flex items-center gap-1"
                                title={`Insert ${label} (${icon})`}
                              >
                                <span>{icon}</span>
                                <span className="text-[10px] hidden sm:inline">{label}</span>
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-col gap-1">
                            <textarea
                              ref={createEffectRef}
                              value={createEffect}
                              onChange={(e) => setCreateEffect(e.target.value.slice(0, 450))}
                              placeholder="Effect description..."
                              rows={2}
                              className="bg-slate-900 p-2 rounded-lg border border-slate-700 text-xs text-slate-200 outline-none focus:border-indigo-400 resize-none"
                            />
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={createEffect.length >= 450 ? 'text-rose-400 font-bold' : createEffect.length >= 360 ? 'text-amber-400' : 'text-slate-500'}>
                                {createEffect.length} / 450 max chars
                              </span>
                              <button
                                onClick={handleSaveCustomAbility}
                                disabled={!createName.trim()}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                              >
                                <Save className="w-3 h-3" /> Save Version
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Ability Search Filter Bar inside Active Table */}
                      <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 focus-within:border-indigo-500/50">
                        <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={`Search abilities in ${effectiveActiveTable || 'catalog'}...`}
                          className="bg-transparent text-xs font-semibold text-slate-200 outline-none w-full placeholder:text-slate-500"
                        />
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Scrollable Ability List for Active Table (Optimized Card Proportions & Read-Only Version Names) */}
                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
                        {effectiveActiveTable && groupedTables[effectiveActiveTable] ? (
                          Object.keys(groupedByBaseName).length > 0 ? (
                            Object.entries(groupedByBaseName).map(([baseName, baseItems]) => {
                              // Sort versions descending (v3, v2, v1)
                              const sortedVersions = [...baseItems].sort((a, b) => {
                                const vA = parseAbilityVersion(a.name).version;
                                const vB = parseAbilityVersion(b.name).version;
                                return vB - vA;
                              });

                              const masterItem = sortedVersions[0];
                              const masterVer = parseAbilityVersion(masterItem.name).version;
                              const historyItems = sortedVersions.slice(1);
                              const isHistoryExpanded = expandedHistoryBases.includes(baseName);

                              const masterCleaned = cleanName(masterItem.name);
                              const isMasterLearned = slots.some(
                                (s) => cleanName(s.name).toLowerCase() === masterCleaned.toLowerCase()
                              );
                              const isEditingMaster = editingAbilityName?.toLowerCase() === masterCleaned.toLowerCase();
                              const masterActionUpper = (masterItem.action || '').toUpperCase();
                              const masterActionClass =
                                ACTION_COLORS[masterActionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                              return (
                                <div key={baseName} className="flex flex-col gap-1 rounded-xl bg-slate-950/40 p-1 border border-slate-850">
                                  {/* MASTER ROW (Highest Version) */}
                                  {isEditingMaster ? (
                                    <div className="p-3 bg-slate-950/90 rounded-xl border border-amber-500/40 flex flex-col gap-2.5 shadow-md">
                                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                                        <div className="flex items-center gap-1.5">
                                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                                          <span className="font-outfit font-bold text-xs text-slate-100">
                                            {masterCleaned} <span className="text-[10px] text-slate-400 font-normal">(Name Locked)</span>
                                          </span>
                                        </div>
                                        <button onClick={() => setEditingAbilityName(null)} className="text-slate-400 hover:text-slate-200">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-slate-400 font-bold">Action:</label>
                                        <select
                                          value={editAction}
                                          onChange={(e) => setEditAction(e.target.value)}
                                          className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-indigo-300 font-mono outline-none"
                                        >
                                          {ACTION_OPTIONS.map((a) => (
                                            <option key={a} value={a}>{a}</option>
                                          ))}
                                        </select>

                                        <label className="text-[10px] text-slate-400 font-bold ml-2">Usage:</label>
                                        <select
                                          value={editUsage}
                                          onChange={(e) => setEditUsage(e.target.value)}
                                          className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-300 font-mono outline-none"
                                        >
                                          {USAGE_OPTIONS.map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Primary Icon Insertion Bar */}
                                      <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                                        <span className="text-[10px] text-slate-400 font-bold px-1">Insert Icon:</span>
                                        {PRIMARY_ATTRIBUTE_ICONS.map(({ label, icon }) => (
                                          <button
                                            key={label}
                                            type="button"
                                            onClick={() => handleInsertIcon(icon, editEffectRef, setEditEffect)}
                                            className="px-1.5 py-0.5 bg-slate-950 hover:bg-indigo-950/80 text-xs rounded border border-slate-800 text-slate-200 transition-colors flex items-center gap-1"
                                            title={`Insert ${label} (${icon})`}
                                          >
                                            <span>{icon}</span>
                                            <span className="text-[10px] hidden sm:inline">{label}</span>
                                          </button>
                                        ))}
                                      </div>

                                      <div className="flex flex-col gap-1">
                                        <textarea
                                          ref={editEffectRef}
                                          value={editEffect}
                                          onChange={(e) => setEditEffect(e.target.value.slice(0, 450))}
                                          rows={2}
                                          className="bg-slate-900 p-2 rounded-lg border border-slate-700 text-xs text-slate-200 outline-none focus:border-amber-400 resize-none"
                                        />
                                        <div className="flex items-center justify-between text-[10px]">
                                          <span className={editEffect.length >= 450 ? 'text-rose-400 font-bold' : editEffect.length >= 360 ? 'text-amber-400' : 'text-slate-500'}>
                                            {editEffect.length} / 450 max chars
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            <button onClick={() => setEditingAbilityName(null)} className="px-2.5 py-1 text-slate-400 hover:text-slate-200">
                                              Cancel
                                            </button>
                                            <button
                                              onClick={() => handleSaveEdit(masterCleaned)}
                                              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                                            >
                                              <Save className="w-3 h-3" /> Save Changes
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                                        isMasterLearned
                                          ? 'bg-indigo-950/50 border-indigo-500/50 text-indigo-100 shadow-sm'
                                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                                      }`}
                                    >
                                      {/* Slimmed Name Column (w-28 sm:w-32) with Version Badge */}
                                      <div className="w-28 sm:w-32 shrink-0 flex items-start gap-1">
                                        {isMasterLearned && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />}
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                          <span className="font-outfit font-bold text-xs text-slate-100 whitespace-normal break-words leading-tight">
                                            {baseName}
                                          </span>
                                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 w-fit flex items-center gap-1">
                                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                                            v{masterVer} Active
                                          </span>
                                        </div>
                                      </div>

                                      {/* Action Badge */}
                                      <div className="w-8 shrink-0 flex justify-center mt-0.5">
                                        {masterActionUpper ? (
                                          <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${masterActionClass}`}>
                                            {masterActionUpper}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-700 font-mono">-</span>
                                        )}
                                      </div>

                                      {/* Usage Pill */}
                                      <div className="w-14 shrink-0 flex justify-start mt-0.5">
                                        {masterItem.usage ? (
                                          <span
                                            className="bg-slate-900 text-[10px] font-mono text-slate-300 px-1 py-0.2 rounded border border-slate-800 truncate"
                                            title={masterItem.usage}
                                          >
                                            {masterItem.usage}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-slate-700 font-mono">-</span>
                                        )}
                                      </div>

                                      {/* Expanded Effect Description Column (flex-1 min-w-0 pr-2) */}
                                      <div className="flex-1 min-w-0 text-[11px] text-slate-300 leading-relaxed whitespace-normal break-words pr-2">
                                        {masterItem.effect || 'No effect description'}
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                        <button
                                          onClick={() => handleStartUpgrade(masterItem)}
                                          className="px-1.5 py-0.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 rounded text-[9px] font-bold transition-colors flex items-center gap-0.5"
                                          title={`Upgrade to v${masterVer + 1}`}
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                          v{masterVer + 1}
                                        </button>
                                        <button
                                          onClick={() => handleStartEdit(masterItem)}
                                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                                          title="Edit Master Version"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleToggleCatalogAbility(masterItem.name)}
                                          className={`px-2 py-0.5 text-[10px] font-extrabold rounded-lg border transition-all ${
                                            isMasterLearned
                                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                              : 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50'
                                          }`}
                                        >
                                          {isMasterLearned ? 'Forget' : '+ Learn'}
                                        </button>
                                        {historyItems.length > 0 && (
                                          <button
                                            onClick={() => toggleHistoryAccordion(baseName)}
                                            className={`p-1 rounded text-[10px] font-bold border transition-colors flex items-center gap-0.5 ${
                                              isHistoryExpanded
                                                ? 'bg-indigo-900/60 text-indigo-200 border-indigo-400'
                                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                            }`}
                                            title="View historical versions"
                                          >
                                            <GitBranch className="w-3 h-3 text-indigo-400" />
                                            <span>{historyItems.length}</span>
                                            {isHistoryExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* HISTORICAL VERSION SUB-ROWS (Indented Tree Branch) */}
                                  {historyItems.length > 0 && isHistoryExpanded && (
                                    <div className="pl-4 border-l-2 border-indigo-500/30 ml-3 py-1 flex flex-col gap-1.5">
                                      {historyItems.map((histItem) => {
                                        const histCleaned = cleanName(histItem.name);
                                        const histVer = parseAbilityVersion(histItem.name).version;
                                        const isHistLearned = slots.some(
                                          (s) => cleanName(s.name).toLowerCase() === histCleaned.toLowerCase()
                                        );
                                        const isEditingHist = editingAbilityName?.toLowerCase() === histCleaned.toLowerCase();
                                        const histActionUpper = (histItem.action || '').toUpperCase();
                                        const histActionClass =
                                          ACTION_COLORS[histActionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                                        if (isEditingHist) {
                                          return (
                                            <div key={histItem.id} className="p-3 bg-slate-950/90 rounded-xl border border-amber-500/40 flex flex-col gap-2.5 shadow-md">
                                              <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                                                <div className="flex items-center gap-1.5">
                                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                  <span className="font-outfit font-bold text-xs text-slate-100">
                                                    {histCleaned} <span className="text-[10px] text-slate-400 font-normal">(Name Locked)</span>
                                                  </span>
                                                </div>
                                                <button onClick={() => setEditingAbilityName(null)} className="text-slate-400 hover:text-slate-200">
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              </div>

                                              <div className="flex items-center gap-2">
                                                <label className="text-[10px] text-slate-400 font-bold">Action:</label>
                                                <select
                                                  value={editAction}
                                                  onChange={(e) => setEditAction(e.target.value)}
                                                  className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-indigo-300 font-mono outline-none"
                                                >
                                                  {ACTION_OPTIONS.map((a) => (
                                                    <option key={a} value={a}>{a}</option>
                                                  ))}
                                                </select>

                                                <label className="text-[10px] text-slate-400 font-bold ml-2">Usage:</label>
                                                <select
                                                  value={editUsage}
                                                  onChange={(e) => setEditUsage(e.target.value)}
                                                  className="bg-slate-900 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-300 font-mono outline-none"
                                                >
                                                  {USAGE_OPTIONS.map((u) => (
                                                    <option key={u} value={u}>{u}</option>
                                                  ))}
                                                </select>
                                              </div>

                                              <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                                                <span className="text-[10px] text-slate-400 font-bold px-1">Insert Icon:</span>
                                                {PRIMARY_ATTRIBUTE_ICONS.map(({ label, icon }) => (
                                                  <button
                                                    key={label}
                                                    type="button"
                                                    onClick={() => handleInsertIcon(icon, editEffectRef, setEditEffect)}
                                                    className="px-1.5 py-0.5 bg-slate-950 hover:bg-indigo-950/80 text-xs rounded border border-slate-800 text-slate-200 transition-colors flex items-center gap-1"
                                                  >
                                                    <span>{icon}</span>
                                                    <span className="text-[10px] hidden sm:inline">{label}</span>
                                                  </button>
                                                ))}
                                              </div>

                                              <div className="flex flex-col gap-1">
                                                <textarea
                                                  ref={editEffectRef}
                                                  value={editEffect}
                                                  onChange={(e) => setEditEffect(e.target.value.slice(0, 450))}
                                                  rows={2}
                                                  className="bg-slate-900 p-2 rounded-lg border border-slate-700 text-xs text-slate-200 outline-none focus:border-amber-400 resize-none"
                                                />
                                                <div className="flex items-center justify-between text-[10px]">
                                                  <span className={editEffect.length >= 450 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                                                    {editEffect.length} / 450 max chars
                                                  </span>
                                                  <div className="flex items-center gap-1.5">
                                                    <button onClick={() => setEditingAbilityName(null)} className="px-2.5 py-1 text-slate-400 hover:text-slate-200">
                                                      Cancel
                                                    </button>
                                                    <button
                                                      onClick={() => handleSaveEdit(histCleaned)}
                                                      className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm"
                                                    >
                                                      <Save className="w-3 h-3" /> Save Changes
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }

                                        return (
                                          <div
                                            key={histItem.id}
                                            className={`p-2 rounded-lg border transition-all flex items-start justify-between gap-2 opacity-85 hover:opacity-100 ${
                                              isHistLearned
                                                ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
                                                : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:border-slate-750'
                                            }`}
                                          >
                                            <div className="w-28 sm:w-32 shrink-0 flex items-start gap-1">
                                              <span className="text-slate-500 text-xs mt-0.5">└─</span>
                                              <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                                                  v{histVer}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="w-8 shrink-0 flex justify-center mt-0.5">
                                              {histActionUpper ? (
                                                <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${histActionClass}`}>
                                                  {histActionUpper}
                                                </span>
                                              ) : (
                                                <span className="text-[10px] text-slate-700 font-mono">-</span>
                                              )}
                                            </div>

                                            <div className="w-14 shrink-0 flex justify-start mt-0.5">
                                              {histItem.usage ? (
                                                <span className="bg-slate-900 text-[10px] font-mono text-slate-400 px-1 py-0.2 rounded border border-slate-800 truncate" title={histItem.usage}>
                                                  {histItem.usage}
                                                </span>
                                              ) : (
                                                <span className="text-[10px] text-slate-700 font-mono">-</span>
                                              )}
                                            </div>

                                            <div className="flex-1 min-w-0 text-[10px] text-slate-400 leading-normal whitespace-normal break-words pr-2">
                                              {histItem.effect || 'No effect description'}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                              <button
                                                onClick={() => handleStartEdit(histItem)}
                                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                                                title="Edit Historical Version"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={() => handleToggleCatalogAbility(histItem.name)}
                                                className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-all ${
                                                  isHistLearned
                                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                                                }`}
                                              >
                                                {isHistLearned ? 'Forget' : '+ Learn'}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center text-slate-500 italic text-xs">
                              No abilities match "{searchQuery}" in {effectiveActiveTable}.
                            </div>
                          )
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 italic text-xs">
                            {selectedCategory === 'favorites' && favoriteTables.length === 0 ? (
                              <p>No favorite tables starred yet. Star any table in Class, Racial, or Combat Styles to add it here!</p>
                            ) : (
                              <p>Select a table from the list on the left to view its abilities or click ➕ Custom to create one.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invariant Column Alignment Active Slots Table View (Automatically Displays Highest Version for Active Play) */}
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
                {/* 1. Fixed Clean Name Column with Auto-Wrapping and Version Badge */}
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

                {/* 2. Invariant Action Badge Column (Fixed w-12 for 'AM' alignment) */}
                <div className="w-12 shrink-0 flex items-center justify-center">
                  {actionUpper ? (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${actionClass}`}>
                      {actionUpper}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono">-</span>
                  )}
                </div>

                {/* 3. Invariant Uses Text Column (Fixed w-20 for '1-Luck🍀' alignment) */}
                <div className="w-20 shrink-0 flex items-center justify-start">
                  {slot.usage ? (
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 truncate" title={slot.usage}>
                      {slot.usage}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono">-</span>
                  )}
                </div>

                {/* 4. Invariant Checkboxes Column (Fixed w-16 for 3 checkboxes with spacer fallback) */}
                <div className="w-16 shrink-0 flex items-center gap-1 min-w-[64px]">
                  {usageCount > 0 ? (
                    Array.from({ length: usageCount }).map((_, bIdx) => {
                      const isChecked = !!(slot.checked && slot.checked[bIdx]);
                      return (
                        <input
                          key={bIdx}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(index, bIdx)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
                          title={`Usage slot ${bIdx + 1}`}
                        />
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-slate-700 font-mono select-none">-</span>
                  )}
                </div>

                {/* 5. Invariant Effect Description Column */}
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
