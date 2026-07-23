// src/components/sheet/AbilitySlotsGrid.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, Search, X, Check } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AbilitySlot } from '../../types/game';

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

export const AbilitySlotsGrid: React.FC<AbilitySlotsGridProps> = ({ title, type }) => {
  const { activeCharacter, powers, magicItems, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const slotKey = type === 'powers' ? 'power_slots' : 'spell_slots';
  const slots: AbilitySlot[] = activeCharacter?.sheet_data?.[slotKey] || [];
  const catalogList = type === 'powers' ? powers : magicItems;

  const [showCatalogPopover, setShowCatalogPopover] = useState(false);
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

  const filteredCatalog = catalogList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = item.name.toLowerCase().includes(q);
    const actionMatch = (item.action || '').toLowerCase().includes(q);
    const usageMatch = (item.usage || '').toLowerCase().includes(q);
    const effectMatch = (item.effect || '').toLowerCase().includes(q);
    return nameMatch || actionMatch || usageMatch || effectMatch;
  });

  const sectionIcon = type === 'powers' ? '🔥' : '✨';
  const displayTitle = type === 'powers' ? 'POWERS' : title;

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
              <div className="absolute top-full right-0 mt-2 z-50 w-[440px] max-w-[92vw] p-4 bg-slate-900/95 border border-indigo-500/40 rounded-2xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
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

                {/* Scrollable Catalog List */}
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  {filteredCatalog.length > 0 ? (
                    filteredCatalog.map((item) => {
                      const cleaned = cleanName(item.name);
                      const isLearned = slots.some(
                        (s) => cleanName(s.name).toLowerCase() === cleaned.toLowerCase()
                      );
                      const actionUpper = (item.action || '').toUpperCase();
                      const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-2.5 ${
                            isLearned
                              ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100 shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-outfit font-bold text-xs text-slate-100 flex items-center gap-1">
                                {isLearned && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                {cleaned}
                              </span>
                              {actionUpper && (
                                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${actionClass}`}>
                                  {actionUpper}
                                </span>
                              )}
                              {item.usage && (
                                <span className="bg-slate-900 text-[10px] font-mono text-slate-400 px-1.5 py-0.2 rounded border border-slate-800">
                                  {item.usage}
                                </span>
                              )}
                            </div>
                            {item.effect && (
                              <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                                {item.effect}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleToggleCatalogAbility(item.name)}
                            className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg border shrink-0 transition-all ${
                              isLearned
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30 hover:text-rose-100'
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
                      No {type} match "{searchQuery}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Slots Table View */}
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
                {/* 1. Clean Name Column */}
                <div className="shrink-0 min-w-[130px] max-w-[190px]">
                  <span className="font-outfit font-bold text-xs text-slate-100 block truncate" title={cleaned}>
                    {cleaned}
                  </span>
                </div>

                {/* 2. Color-Coded Action Badge */}
                {actionUpper && (
                  <div className="shrink-0">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${actionClass}`}>
                      {actionUpper}
                    </span>
                  </div>
                )}

                {/* 3. Uses Text & Dynamic Checkboxes (1-3) */}
                <div className="flex items-center gap-2 shrink-0">
                  {slot.usage && (
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300">
                      {slot.usage}
                    </span>
                  )}
                  {usageCount > 0 && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: usageCount }).map((_, bIdx) => {
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
                      })}
                    </div>
                  )}
                </div>

                {/* 4. Effect Description (Auto-Wrapping Vertical Expansion) */}
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

