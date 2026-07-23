// src/components/sheet/AbilitySlotsGrid.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Search, X, Check, Star } from 'lucide-react';
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

  const handleSortSlots = () => {
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];
      const sorted = current.sort((a, b) => {
        const orderA = ACTION_ORDER[a.action?.toUpperCase() || ''] ?? 99;
        const orderB = ACTION_ORDER[b.action?.toUpperCase() || ''] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
      return { ...prev, [slotKey]: sorted };
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

  // Filter catalog items by search query and category
  const filteredCatalog = catalogList.filter((item) => {
    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(q);
      const actionMatch = (item.action || '').toLowerCase().includes(q);
      const usageMatch = (item.usage || '').toLowerCase().includes(q);
      const effectMatch = (item.effect || '').toLowerCase().includes(q);
      const tableMatch = (item.table_name || '').toLowerCase().includes(q);
      if (!nameMatch && !actionMatch && !usageMatch && !effectMatch && !tableMatch) return false;
    }

    // 2. Sub-Category / Favorites Filter (Powers)
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

  // Group filtered items by table_name
  const groupedByTable = filteredCatalog.reduce((acc, item) => {
    const tableName = item.table_name || 'General Abilities';
    if (!acc[tableName]) acc[tableName] = [];
    acc[tableName].push(item);
    return acc;
  }, {} as Record<string, (Power | MagicItem)[]>);

  const sectionIcon = type === 'powers' ? '🔥' : '✨';
  const displayTitle = title || (type === 'powers' ? 'POWERS' : 'MAGIC ITEMS');

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      {/* Header: Title, Icon, Sort & Catalog Trigger */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <span className="text-base">{sectionIcon}</span>
          {displayTitle}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSortSlots}
            className="px-2.5 py-1 bg-slate-950 text-slate-300 hover:text-slate-100 text-xs font-semibold rounded-lg border border-slate-800 flex items-center gap-1.5 transition-all shadow-sm"
            title="Sort by Action Economy (AM -> A -> M -> P -> F)"
          >
            <ArrowUpDown className="w-3 h-3 text-indigo-400" />
            Sort
          </button>

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

            {/* Catalog Absolute Floating Glass Popover Card */}
            {showCatalogPopover && (
              <div className="absolute top-full right-0 mt-2 z-50 w-[480px] max-w-[92vw] p-4 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
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

                {/* Sub-Category Choice Buttons Row (Image 2 - without the word "Powers") */}
                {type === 'powers' && (
                  <div className="grid grid-cols-3 gap-1.5 border-b border-slate-800 pb-2.5">
                    {POWER_CATEGORY_BUTTONS.map((cat) => {
                      const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 shadow-sm ${
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

                {/* Search Filter Bar */}
                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800 focus-within:border-indigo-500/50">
                  <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${type} by name, action, usage, or effect...`}
                    className="bg-transparent text-xs font-semibold text-slate-200 outline-none w-full placeholder:text-slate-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Scrollable Catalog Grouped by table_name */}
                <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                  {Object.keys(groupedByTable).length > 0 ? (
                    Object.entries(groupedByTable).map(([tableName, items]) => {
                      const isFavorited = favoriteTables.includes(tableName);
                      return (
                        <div key={tableName} className="flex flex-col gap-1.5">
                          {/* Distinctive Table Header with Ability Count & Favorite Toggle */}
                          <div className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                            <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                              <span>📁</span>
                              {tableName} ({items.length} Abilities)
                            </span>
                            {type === 'powers' && (
                              <button
                                onClick={() => handleToggleFavoriteTable(tableName)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  isFavorited
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300 hover:border-amber-500/30'
                                }`}
                                title={isFavorited ? 'Remove from Favorite Tables' : 'Add to Favorite Tables'}
                              >
                                <Star
                                  className={`w-3 h-3 ${
                                    isFavorited ? 'fill-amber-400 text-amber-400' : ''
                                  }`}
                                />
                                {isFavorited ? 'Favorite' : 'Favorite'}
                              </button>
                            )}
                          </div>

                          {/* Items under this table_name (DRY - no repeated table name in rows) */}
                          <div className="flex flex-col gap-1.5 pl-1">
                            {items.map((item) => {
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
                                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                                    isLearned
                                      ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100 shadow-sm'
                                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  {/* Name Column */}
                                  <div className="w-32 sm:w-36 shrink-0 flex items-center gap-1 min-w-0">
                                    {isLearned && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                    <span className="font-outfit font-bold text-xs text-slate-100 truncate" title={cleaned}>
                                      {cleaned}
                                    </span>
                                  </div>

                                  {/* Action Badge */}
                                  <div className="w-10 shrink-0 flex justify-center">
                                    {actionUpper ? (
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${actionClass}`}>
                                        {actionUpper}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-700 font-mono">-</span>
                                    )}
                                  </div>

                                  {/* Usage Pill */}
                                  <div className="w-16 shrink-0 flex justify-start">
                                    {item.usage ? (
                                      <span className="bg-slate-900 text-[10px] font-mono text-slate-300 px-1.5 py-0.2 rounded border border-slate-800 truncate" title={item.usage}>
                                        {item.usage}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-700 font-mono">-</span>
                                    )}
                                  </div>

                                  {/* Effect Description */}
                                  <div className="flex-1 min-w-0 text-[11px] text-slate-300 leading-normal truncate" title={item.effect || ''}>
                                    {item.effect || 'No effect description'}
                                  </div>

                                  {/* + Learn / Forget Button */}
                                  <button
                                    onClick={() => handleToggleCatalogAbility(item.name)}
                                    className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border shrink-0 transition-all ${
                                      isLearned
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                        : 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50'
                                    }`}
                                  >
                                    {isLearned ? 'Forget' : '+ Learn'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-500 italic text-xs">
                      No {type} match "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invariant Column Alignment Active Slots Table View */}
      <div className="flex flex-col gap-2">
        {slots.length > 0 ? (
          slots.map((slot, index) => {
            const cleaned = cleanName(slot.name);
            const actionUpper = (slot.action || '').toUpperCase();
            const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
            const usageCount = parseUsageCount(slot.usage);

            return (
              <div
                key={index}
                className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all"
              >
                {/* 1. Fixed Clean Name Column */}
                <div className="w-36 sm:w-44 shrink-0">
                  <span className="font-outfit font-bold text-xs text-slate-100 block truncate" title={cleaned}>
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

                {/* 5. Invariant Effect Description Column (Exact Same Offset Across All Rows!) */}
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
