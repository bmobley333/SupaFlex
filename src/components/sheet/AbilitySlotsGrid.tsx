// src/components/sheet/AbilitySlotsGrid.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X, Check, Star } from 'lucide-react';
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

const cleanName = (name: string) => {
  return name.replace(/\s*\[[A-Z]+\]$/i, '').trim();
};

const parseUsageCount = (usage?: string): number => {
  if (!usage) return 0;
  const match = usage.trim().match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
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
  const catalogList = type === 'powers' ? powers : magicItems;

  const [showCatalogPopover, setShowCatalogPopover] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTableName, setActiveTableName] = useState<string | null>(null);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const handleToggleCatalogAbility = (abilityName: string) => {
    const foundItem = catalogList.find((p) => p.name === abilityName);
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];
      const existingIndex = current.findIndex(
        (s) => cleanName(s.name).toLowerCase() === cleanName(abilityName).toLowerCase()
      );

      if (existingIndex >= 0) {
        current.splice(existingIndex, 1);
      } else if (foundItem) {
        current.push({
          select: true,
          name: cleanName(foundItem.name),
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

  // 1. Filter catalog items by selected Category (Powers mode)
  const categoryFilteredCatalog = catalogList.filter((item) => {
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

  const sectionIcon = type === 'powers' ? '🔥' : '✨';
  const displayTitle = title || (type === 'powers' ? 'POWERS' : 'MAGIC ITEMS');

  // Automatic Default Action Economy Sorting (AM -> A -> M -> P -> F -> Alphabetical)
  const sortedSlots = [...slots].sort((a, b) => {
    const orderA = ACTION_ORDER[a.action?.toUpperCase() || ''] ?? 99;
    const orderB = ACTION_ORDER[b.action?.toUpperCase() || ''] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Header: Title, Icon, & Catalog Trigger (Sort is now always-on default) */}
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
                {slots.length}/{catalogList.length}
              </span>
              {showCatalogPopover ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>

            {/* Catalog Absolute Floating Glass Popover Card (Master-Detail Split Pane Option A - 840px Width) */}
            {showCatalogPopover && (
              <div className="absolute top-full right-0 mt-2 z-50 w-[840px] max-w-[95vw] p-4 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                  <span className="font-outfit font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                    <span className="text-sm">{sectionIcon}</span>
                    {type === 'powers' ? 'Powers Catalog' : 'Magic Items Catalog'} ({slots.length} Learned)
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

                  {/* RIGHT DETAIL PANE: Active Table Ability Work Area (Auto-Wrapping Names & Effects) */}
                  <div className="flex-1 flex flex-col gap-2 min-w-0 pl-0 md:pl-1">
                    {effectiveActiveTable && groupedTables[effectiveActiveTable] ? (
                      <>
                        {/* Active Table Header Bar */}
                        <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm gap-2">
                          <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-2 flex-1 min-w-0">
                            <span className="shrink-0">📁</span>
                            <span className="whitespace-normal break-words leading-tight">{effectiveActiveTable}</span>
                            <span className="text-slate-400 text-[10px] font-mono shrink-0">
                              ({groupedTables[effectiveActiveTable].length} Abilities)
                            </span>
                          </span>

                          {type === 'powers' && (
                            <button
                              onClick={() => handleToggleFavoriteTable(effectiveActiveTable)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 shrink-0 ${
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

                        {/* Ability Search Filter Bar inside Active Table */}
                        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 focus-within:border-indigo-500/50">
                          <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={`Search abilities in ${effectiveActiveTable}...`}
                            className="bg-transparent text-xs font-semibold text-slate-200 outline-none w-full placeholder:text-slate-500"
                          />
                          {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Scrollable Ability List for Active Table */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
                          {filteredAbilities.length > 0 ? (
                            filteredAbilities.map((item) => {
                              const cleaned = cleanName(item.name);
                              const isLearned = slots.some(
                                (s) => cleanName(s.name).toLowerCase() === cleaned.toLowerCase()
                              );
                              const actionUpper = (item.action || '').toUpperCase();
                              const actionClass =
                                ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                              return (
                                <div
                                  key={item.id}
                                  className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2.5 ${
                                    isLearned
                                      ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100 shadow-sm'
                                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  {/* Auto-Wrapping Name Column */}
                                  <div className="w-36 sm:w-40 shrink-0 flex items-start gap-1">
                                    {isLearned && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />}
                                    <span className="font-outfit font-bold text-xs text-slate-100 whitespace-normal break-words leading-tight">
                                      {cleaned}
                                    </span>
                                  </div>

                                  {/* Action Badge */}
                                  <div className="w-8 shrink-0 flex justify-center mt-0.5">
                                    {actionUpper ? (
                                      <span className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded border ${actionClass}`}>
                                        {actionUpper}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-700 font-mono">-</span>
                                    )}
                                  </div>

                                  {/* Usage Pill */}
                                  <div className="w-14 shrink-0 flex justify-start mt-0.5">
                                    {item.usage ? (
                                      <span
                                        className="bg-slate-900 text-[10px] font-mono text-slate-300 px-1 py-0.2 rounded border border-slate-800 truncate"
                                        title={item.usage}
                                      >
                                        {item.usage}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-700 font-mono">-</span>
                                    )}
                                  </div>

                                  {/* Auto-Wrapping Effect Description */}
                                  <div className="flex-1 min-w-0 text-[11px] text-slate-300 leading-relaxed whitespace-normal break-words">
                                    {item.effect || 'No effect description'}
                                  </div>

                                  {/* + Learn / Forget Button */}
                                  <button
                                    onClick={() => handleToggleCatalogAbility(item.name)}
                                    className={`px-2 py-0.5 text-[10px] font-extrabold rounded-lg border shrink-0 transition-all mt-0.5 ${
                                      isLearned
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                        : 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50'
                                    }`}
                                  >
                                    {isLearned ? 'Forget' : '+ Learn'}
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center text-slate-500 italic text-xs">
                              No abilities match "{searchQuery}" in {effectiveActiveTable}.
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 italic text-xs">
                        {selectedCategory === 'favorites' && favoriteTables.length === 0 ? (
                          <p>No favorite tables starred yet. Star any table in Class, Racial, or Combat Styles to add it here!</p>
                        ) : (
                          <p>Select a table from the list on the left to view its abilities.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invariant Column Alignment Active Slots Table View (Automatically Sorted) */}
      <div className="flex flex-col gap-2">
        {sortedSlots.length > 0 ? (
          sortedSlots.map((slot, index) => {
            const cleaned = cleanName(slot.name);
            const actionUpper = (slot.action || '').toUpperCase();
            const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
            const usageCount = parseUsageCount(slot.usage);

            return (
              <div
                key={index}
                className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all"
              >
                {/* 1. Fixed Clean Name Column with Auto-Wrapping */}
                <div className="w-36 sm:w-44 shrink-0">
                  <span className="font-outfit font-bold text-xs text-slate-100 block whitespace-normal break-words leading-tight">
                    {cleaned}
                  </span>
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
