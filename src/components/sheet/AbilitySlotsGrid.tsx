import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown, Search, X, Plus, Edit2, Lock, Sparkles, Flame, Star, RotateCcw, CheckCircle, Zap, Trash2, AlertCircle, Check, ArrowUpDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useGenreStore, matchesGenre } from '../../store/useGenreStore';
import { CardHelpButton } from '../common/CardHelpButton';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import { QuickDeckBar } from '../common/QuickDeckBar';
import { AbilitySlot, Power, MagicItem, calculateAvailableAp, getCategorySlotWeight } from '../../types/game';
import {
  calculateTotalLoadoutCapacity,
  getApCostForNextExpansion,
  calculateSpentApOnLoadoutExpansions,
  calculateTotalLoadoutSlotsUsed,
  getItemSlotWeight,
  generateLoadoutScheduleRows,
} from '../../utils/loadoutCapacitySchedule';
import { getPowerReadyCategory } from '../../utils/readyMatrixSchedule';
import { calculatePowersKnownApCost, getPowersSoftTaxBracket } from '../../utils/powersApTaxSchedule';
import { parseCostToSilver, formatCostAbbreviated, deductFundsWithChange } from '../../utils/moneyUtils';
import { cleanKitName, isTraitItem, getKitMinLevel } from '../../utils/kitUtils';

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
const USAGE_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '1-⚡', label: '1-⚡' },
  { value: '1-🍀', label: '1-🍀' },
  { value: '1-Enc', label: '1-Enc' },
  { value: '2-Enc', label: '2-Enc' },
  { value: '3-Enc', label: '3-Enc' },
  { value: '1-Rnd', label: '1-Rnd' },
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

const getMagicItemTierBadge = (itemObj: any, catalog?: any[]): { label: string; icon: string; style: string; slotsText: string } => {
  if (!itemObj) return { label: 'Minor', icon: '🍺', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40', slotsText: '1 Slot' };

  let subStr = itemObj.category || itemObj.rarity || '';

  if (!subStr && catalog && catalog.length > 0) {
    const rawName = itemObj.name || itemObj.title || '';
    const baseName = parseAbilityVersion(cleanName(rawName)).baseName.toLowerCase();
    const found = catalog.find((c) => {
      const cBase = parseAbilityVersion(cleanName(c.name || '')).baseName.toLowerCase();
      return cBase === baseName || cleanName(c.name || '').toLowerCase().includes(baseName);
    });
    if (found) {
      subStr = found.category || found.rarity || '';
    }
  }

  const str = `${itemObj.rarity || ''} ${subStr} ${itemObj.name || itemObj.title || ''}`.toLowerCase();

  if (str.includes('relic') || str.includes('epic') || str.includes('artifact') || str.includes('💫')) {
    return { label: 'Epic', icon: '💫', style: 'bg-amber-950/80 text-amber-300 border-amber-500/40', slotsText: '4 Slots' };
  }
  if (str.includes('greater') || str.includes('🪬')) {
    return { label: 'Greater', icon: '🪬', style: 'bg-purple-950/80 text-purple-300 border-purple-500/40', slotsText: '3 Slots' };
  }
  if (str.includes('lesser') || str.includes('🪄')) {
    return { label: 'Lesser', icon: '🪄', style: 'bg-blue-950/80 text-blue-300 border-blue-500/40', slotsText: '2 Slots' };
  }
  return { label: 'Minor', icon: '🍺', style: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40', slotsText: '1 Slot' };
};

const formatTableNameDisplay = (tblName: string): string => {
  if (!tblName) return '';
  const clean = tblName
    .replace(/Artifact🌀/g, 'Epic💫')
    .replace(/Artifact/g, 'Epic')
    .replace(/🌀/g, '💫');
  if (clean === 'Minor' || clean.toLowerCase() === 'minor') return '🍺 Minor (1 Slot)';
  if (clean === 'Lesser' || clean.toLowerCase() === 'lesser') return '🪄 Lesser (2 Slots)';
  if (clean === 'Greater' || clean.toLowerCase() === 'greater') return '🪬 Greater (3 Slots)';
  if (clean === 'Epic' || clean.toLowerCase() === 'epic') return '💫 Epic (4 Slots)';
  return clean;
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
  const activeGenre = useGenreStore((state) => state.activeGenre);
  const {
    activeCharacter,
    powers,
    magicItems,
    updateActiveSheetData,
    saveActiveCharacter,
    recordApExpenditure,
    toggleReadyPower,
    abilitySortMode,
    abilityActionFilter,
    setAbilitySortMode,
    setAbilityActionFilter,
  } = useCharacterStore();
  const sheetData: any = activeCharacter?.sheet_data || {};
  const slotKey = type === 'powers' ? 'power_slots' : 'spell_slots';
  const rawSlots: AbilitySlot[] = (activeCharacter?.sheet_data?.[slotKey as keyof typeof activeCharacter.sheet_data] as AbilitySlot[]) || [];
  const slots: AbilitySlot[] = useMemo(() => {
    return rawSlots.filter((s) => s && s.name && s.name.trim() !== '');
  }, [rawSlots]);
  const stockCatalog = type === 'powers' ? powers : magicItems;

  // Active Highest-Version Display Slots (max version per baseName)
  const activeDisplaySlots = useMemo(() => {
    return pruneLesserPowerVersions(slots);
  }, [slots]);

  // Loadout Expansions & Universal Capacity
  const loadoutExpansions = typeof sheetData.loadout_expansions_purchased === 'number'
    ? sheetData.loadout_expansions_purchased
    : (typeof sheetData.unlocked_loadout_slots === 'number'
      ? Math.max(0, Math.floor((sheetData.unlocked_loadout_slots - 4) / 2))
      : (typeof sheetData.unlocked_magic_slots === 'number'
        ? Math.max(0, sheetData.unlocked_magic_slots - 3)
        : 0));

  const totalLoadoutCapacity = useMemo(() => {
    return calculateTotalLoadoutCapacity(loadoutExpansions);
  }, [loadoutExpansions]);

  const totalUsedLoadoutSlots = useMemo(() => {
    return calculateTotalLoadoutSlotsUsed(slots);
  }, [slots]);

  const nextLoadoutExpansionCost = getApCostForNextExpansion(loadoutExpansions);
  const totalLoadoutApSpent = calculateSpentApOnLoadoutExpansions(loadoutExpansions);

  // Powers / Spells AP Metrics
  const apSpent = useMemo(() => {
    if (type === 'powers') {
      return calculatePowersKnownApCost(activeDisplaySlots.length);
    }
    return totalLoadoutApSpent;
  }, [type, activeDisplaySlots.length, totalLoadoutApSpent]);

  const availableAp = calculateAvailableAp(
    activeCharacter?.sheet_data?.level || 1,
    activeCharacter?.sheet_data
  );

  const handleUnlockLoadoutExpansion = async () => {
    if (availableAp < nextLoadoutExpansionCost) {
      setCatalogFeedback({
        type: 'error',
        message: `Insufficient AP (${availableAp} AP available, ${nextLoadoutExpansionCost} AP required for +2 Slots).`,
      });
      return;
    }

    const newExpansions = loadoutExpansions + 1;
    const newTotalSlots = calculateTotalLoadoutCapacity(newExpansions);

    updateActiveSheetData((prev) => ({
      ...prev,
      loadout_expansions_purchased: newExpansions,
      unlocked_loadout_slots: newTotalSlots,
      unlocked_magic_slots: newTotalSlots,
    }));

    recordApExpenditure(
      nextLoadoutExpansionCost,
      'Loadout Slots' as any,
      `Unlocked Loadout Capacity (${newTotalSlots} Slots)`,
      1,
      'Loadout Manager'
    );

    await saveActiveCharacter();

    setCatalogFeedback({
      type: 'success',
      message: `Successfully expanded Loadout Capacity to ${newTotalSlots} Slots!`,
    });
  };

  const cardContainerRef = useRef<HTMLDivElement>(null);
  const prevTopRef = useRef<number | null>(null);

  const handleSetActionFilter = (filter: 'ALL' | 'AM' | 'A' | 'M' | 'P' | 'F') => {
    if (cardContainerRef.current) {
      prevTopRef.current = cardContainerRef.current.getBoundingClientRect().top;
    }
    setAbilityActionFilter(filter);
  };

  const handleSetSortMode = (mode: 'action' | 'name') => {
    if (cardContainerRef.current) {
      prevTopRef.current = cardContainerRef.current.getBoundingClientRect().top;
    }
    setAbilitySortMode(mode);
  };

  useLayoutEffect(() => {
    if (prevTopRef.current !== null && cardContainerRef.current) {
      const currentTop = cardContainerRef.current.getBoundingClientRect().top;
      const delta = currentTop - prevTopRef.current;
      if (Math.abs(delta) > 0.5) {
        window.scrollBy(0, delta);
      }
      prevTopRef.current = null;
    }
  }, [abilityActionFilter, abilitySortMode]);

  const [isSortPopoverOpen, setIsSortPopoverOpen] = useState(false);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [readyFeedback, setReadyFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [catalogFeedback, setCatalogFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [catalogReadyFilter, setCatalogReadyFilter] = useState<'all' | 'primary_arsenal' | 'mobility_defense' | 'support_passive'>('all');
  const [activeTableName, setActiveTableName] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      if (type === 'powers' && e.detail === 'powers') setShowManageModal(true);
      if (type === 'spells' && (e.detail === 'spells' || e.detail === 'magicItems')) setShowManageModal(true);
    };
    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    return () => window.removeEventListener('supaflex:open-manager' as any, handleOpen);
  }, [type]);
  
  // Search Filters for Left and Right Panes
  const [leftSearchQuery, setLeftSearchQuery] = useState('');
  const [rightSearchQuery, setRightSearchQuery] = useState('');
  
  // Right Pane Active View: 'VAULT' | 'CODEX' | 'CATALOG' | 'SLOTS' | 'CREATOR' | 'EDITOR'
  const [activeRightTab, setActiveRightTab] = useState<'VAULT' | 'CODEX' | 'CATALOG' | 'SLOTS' | 'CREATOR' | 'EDITOR'>(
    type === 'spells' ? 'VAULT' : 'CATALOG'
  );

  const modalRef = useRef<HTMLDivElement>(null);

  // Custom Power Form State
  const [createName, setCreateName] = useState('');
  const [createAction, setCreateAction] = useState('A');
  const [createUsage, setCreateUsage] = useState('1');
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
    setCreateUsage(item.usage || '1');
    setCreateEffect(item.effect || '');

    setActiveRightTab('EDITOR');
  };

  const handleUpdatePinnedTables = (tables: string[]) => {
    if (type === 'powers') {
      updateActiveSheetData((prev) => ({
        ...prev,
        favorite_power_tables: tables,
      }));
    } else {
      updateActiveSheetData((prev) => ({
        ...prev,
        favorite_hardware_tables: tables,
      }));
    }
    saveActiveCharacter();
  };

  const handleToggleFavoriteTable = (tableName: string) => {
    if (!tableName || tableName === 'ALL' || tableName === 'STARRED') return;
    const isPinned = pinnedTableNames.includes(tableName);
    if (isPinned) {
      const updated = pinnedTableNames.filter((t) => t !== tableName);
      handleUpdatePinnedTables(updated);
      if (effectiveActiveTable === tableName) {
        setActiveTableName(updated.length > 0 ? updated[0] : 'ALL');
      }
    } else {
      if (pinnedTableNames.length >= 8) {
        setCatalogFeedback({ type: 'error', message: 'Quick Deck is full! Maximum 8 pinned tables allowed.' });
        return;
      }
      const updated = [...pinnedTableNames, tableName];
      handleUpdatePinnedTables(updated);
    }
  };

  const handleCloseManageModal = () => {
    setShowManageModal(false);
    window.dispatchEvent(new CustomEvent('supaflex:close-manager'));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseManageModal();
      }
    };
    if (showManageModal) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showManageModal]);

  useEffect(() => {
    const handleClickOutsideSort = (event: MouseEvent) => {
      if (sortPopoverRef.current && !sortPopoverRef.current.contains(event.target as Node)) {
        setIsSortPopoverOpen(false);
      }
    };
    if (isSortPopoverOpen) document.addEventListener('mousedown', handleClickOutsideSort);
    return () => document.removeEventListener('mousedown', handleClickOutsideSort);
  }, [isSortPopoverOpen]);

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

  // Check if an item is starred in character sheet wishlist
  const isItemStarred = useCallback(
    (targetItem: Power | MagicItem | AbilitySlot) => {
      const targetStarredKey = type === 'powers' ? 'starred_powers' : 'starred_magic_items';
      const starredList = activeCharacter?.sheet_data?.[targetStarredKey] || [];
      if (!starredList.length) return false;

      const rawName = targetItem.name || '';
      const cleaned = cleanName(rawName);
      const { baseName } = parseAbilityVersion(cleaned);
      const targetId = (targetItem as any).id;

      // Find stock catalog match if target is a learned slot
      const catalogMatch = fullCatalog.find(
        (c) =>
          cleanName(c.name).toLowerCase() === cleaned.toLowerCase() ||
          (c.base_name && c.base_name.toLowerCase() === baseName.toLowerCase())
      );

      return starredList.some((k) => {
        const kStr = String(k);
        if (targetId && kStr === String(targetId)) return true;
        if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return true;
        if (kStr === String(rawName)) return true;
        if (kStr === String(cleaned)) return true;
        if (kStr === String(baseName)) return true;
        return false;
      });
    },
    [activeCharacter?.sheet_data, fullCatalog, type]
  );

  // Toggle Starred Wishlist Item
  const handleToggleStarItem = (targetItem: Power | MagicItem | AbilitySlot) => {
    const rawName = targetItem.name || '';
    const cleaned = cleanName(rawName);
    const { baseName } = parseAbilityVersion(cleaned);

    const catalogMatch = fullCatalog.find(
      (c) =>
        cleanName(c.name).toLowerCase() === cleaned.toLowerCase() ||
        (c.base_name && c.base_name.toLowerCase() === baseName.toLowerCase())
    );

    const itemKey = (targetItem as any).id || (catalogMatch ? catalogMatch.id : null) || baseName || rawName;
    const targetStarredKey = type === 'powers' ? 'starred_powers' : 'starred_magic_items';

    updateActiveSheetData((prev) => {
      const currentStarred = prev[targetStarredKey] || [];
      const currentlyStarred = isItemStarred(targetItem);
      let updated: (string | number)[];

      if (currentlyStarred) {
        updated = currentStarred.filter((k) => {
          const kStr = String(k);
          if ((targetItem as any).id && kStr === String((targetItem as any).id)) return false;
          if (catalogMatch && catalogMatch.id && kStr === String(catalogMatch.id)) return false;
          if (kStr === String(rawName)) return false;
          if (kStr === String(cleaned)) return false;
          if (kStr === String(baseName)) return false;
          return true;
        });
      } else {
        updated = currentStarred.some((k) => String(k) === String(itemKey))
          ? currentStarred
          : [...currentStarred, itemKey];
      }

      return {
        ...prev,
        [targetStarredKey]: updated,
      };
    });
    saveActiveCharacter();
  };

  // Learn an ability from catalog into active sheet slots or Vault
  const handleLearnAbility = (item: Power | MagicItem) => {
    const { baseName, version } = parseAbilityVersion(item.name);

    // 1. Spells / Loadout Mode (Hardware Catalog Purchase)
    if (type === 'spells') {
      const rawCost = (item as any).cost;
      const itemCostSilver = parseCostToSilver(rawCost);
      const costAbbrev = formatCostAbbreviated(rawCost);

      const curGold = activeCharacter?.sheet_data?.gold ?? 0;
      const curSilver = activeCharacter?.sheet_data?.silver ?? 0;
      const deductRes = deductFundsWithChange(curGold, curSilver, itemCostSilver);

      if (!deductRes.success) {
        setCatalogFeedback({
          type: 'error',
          message: `Insufficient funds! "${cleanName(item.name)}" costs ${costAbbrev} (${itemCostSilver}s), but you have ${formatCostAbbreviated(deductRes.totalAvailableSilver)} (${deductRes.totalAvailableSilver}s). Need ${deductRes.shortfallSilver}s more.`,
        });
        return;
      }

      let alreadyOwned = false;
      let addedSuccessfully = false;

      updateActiveSheetData((prev) => {
        const currentVault: MagicItem[] = Array.isArray(prev.character_vault) ? prev.character_vault : [];
        const exists = currentVault.some((v) => cleanName(v.name).toLowerCase() === cleanName(item.name).toLowerCase());
        if (exists) {
          alreadyOwned = true;
          return prev;
        }

        const prevGold = prev.gold ?? 0;
        const prevSilver = prev.silver ?? 0;
        const reDeduct = deductFundsWithChange(prevGold, prevSilver, itemCostSilver);
        if (!reDeduct.success) {
          return prev;
        }

        addedSuccessfully = true;

        const vaultItem: MagicItem = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: cleanName(item.name),
          base_name: baseName,
          version: version,
          action: item.action || 'P',
          usage: item.usage || '1-Enc',
          effect: item.effect || '',
          notes: (item as any).notes,
          source: (item as any).source || 'Hardware Purchase',
          created_at: new Date().toISOString(),
          category: (item as any).category || null,
          cost: (item as any).cost,
          is_hardware: true,
          slot_weight: (getItemSlotWeight(item) as 1 | 2 | 3 | 4),
        };

        return {
          ...prev,
          gold: reDeduct.newGold,
          silver: reDeduct.newSilver,
          character_vault: [...currentVault, vaultItem],
        };
      });
      saveActiveCharacter();

      if (alreadyOwned) {
        setCatalogFeedback({
          type: 'error',
          message: `"${cleanName(item.name)}" is already in your Vault!`,
        });
      } else if (addedSuccessfully) {
        setCatalogFeedback({
          type: 'success',
          message: `Purchased "${cleanName(item.name)}" for ${costAbbrev} and added to Vault! (Remaining: ${deductRes.newGold}g ${deductRes.newSilver}s)`,
        });
        setTimeout(() => setCatalogFeedback(null), 4000);
      }
      return;
    }

    // 2. Powers Mode (Learn/Upgrade with AP)
    updateActiveSheetData((prev) => {
      const currentSlots: AbilitySlot[] = Array.isArray(prev.power_slots) ? prev.power_slots : [];
      const currentVault: AbilitySlot[] = Array.isArray(prev.character_power_codex) ? prev.character_power_codex : [];
      const combinedOld = [...currentSlots, ...currentVault];
      const oldTotalUnits = calculateTotalPowerUnits(pruneLesserPowerVersions(combinedOld));
      const oldApSpent = oldTotalUnits;

      const newPower: AbilitySlot = {
        select: true,
        name: cleanName(item.name),
        base_name: baseName,
        version: version,
        action: (item.action?.toUpperCase() as any) || 'A',
        usage: item.usage || '1-Enc',
        effect: item.effect || '',
        checked: [false, false, false],
        is_readied: false,
        ready: getPowerReadyCategory(item),
      };

      const readiedIndex = currentSlots.findIndex(
        (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === baseName.toLowerCase()
      );
      const vaultIndex = currentVault.findIndex(
        (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === baseName.toLowerCase()
      );

      let updatedSlots = [...currentSlots];
      let updatedVault = [...currentVault];
      let isUpgrade = false;

      if (readiedIndex >= 0) {
        const oldVersion = parseAbilityVersion(currentSlots[readiedIndex].name).version;
        if (version > oldVersion) {
          updatedSlots[readiedIndex] = { ...newPower, is_readied: true };
          isUpgrade = true;
        } else {
          return prev;
        }
      } else if (vaultIndex >= 0) {
        const oldVersion = parseAbilityVersion(currentVault[vaultIndex].name).version;
        if (version > oldVersion) {
          updatedVault[vaultIndex] = newPower;
          isUpgrade = true;
        } else {
          return prev;
        }
      } else {
        // Brand new learned power -> add to Vault (un-readied)
        updatedVault.push(newPower);
      }

      const combinedNew = [...updatedSlots, ...updatedVault];
      const prunedCombined = pruneLesserPowerVersions(combinedNew);
      const newTotalUnits = calculateTotalPowerUnits(prunedCombined);
      const newApSpent = newTotalUnits;
      const apDiff = newApSpent - oldApSpent;

      const logAction = isUpgrade ? 'Upgraded Power' : 'Learned Power';

      if (apDiff > 0) {
        recordApExpenditure(apDiff, 'Powers', `${logAction}: ${cleanName(item.name)} (+${apDiff} AP)`, 1, 'Manage Powers');
      }

      return {
        ...prev,
        power_slots: updatedSlots,
        character_power_codex: updatedVault,
      };
    });
    saveActiveCharacter();
  };

  // Drop / Un-learn an ability from the character's active roster
  const handleForgetAbility = (abilityName: string) => {
    const { baseName: targetBaseName } = parseAbilityVersion(abilityName);
    updateActiveSheetData((prev) => {
      const current = [...(prev[slotKey] || [])];

      if (type === 'powers') {
        const currentSlots: AbilitySlot[] = Array.isArray(prev.power_slots) ? prev.power_slots : [];
        const currentVault: AbilitySlot[] = Array.isArray(prev.character_power_codex) ? prev.character_power_codex : [];
        const combinedOld = [...currentSlots, ...currentVault];
        const oldTotalUnits = calculateTotalPowerUnits(pruneLesserPowerVersions(combinedOld));
        const oldApSpent = oldTotalUnits;

        const updatedSlots = currentSlots.filter(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() !== targetBaseName.toLowerCase()
        );
        const updatedVault = currentVault.filter(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() !== targetBaseName.toLowerCase()
        );

        const combinedNew = [...updatedSlots, ...updatedVault];
        const prunedCombined = pruneLesserPowerVersions(combinedNew);
        const newTotalUnits = calculateTotalPowerUnits(prunedCombined);
        const newApSpent = newTotalUnits;
        const apRefund = oldApSpent - newApSpent;

        if (apRefund > 0) {
          recordApExpenditure(-apRefund, 'Powers', `Unlearned Power: ${cleanName(abilityName)} (-${apRefund} AP Refunded)`, 1, 'Manage Powers');
        }

        return {
          ...prev,
          power_slots: updatedSlots,
          character_power_codex: updatedVault,
        };
      } else {
        const targetSlot = current.find(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === targetBaseName.toLowerCase()
        );
        const updated = current.filter(
          (s) => parseAbilityVersion(s.name).baseName.toLowerCase() !== targetBaseName.toLowerCase()
        );

        if (targetSlot) {
          const currentVault = Array.isArray(prev.character_vault) ? prev.character_vault : [];
          // Recover tier metadata from catalog for round-trip preservation
          const catalogMatch = fullCatalog.find((c) => {
            const cBase = parseAbilityVersion(cleanName(c.name || '')).baseName.toLowerCase();
            const tBase = parseAbilityVersion(cleanName(targetSlot.name)).baseName.toLowerCase();
            return cBase === tBase || cleanName(c.name || '').toLowerCase().includes(tBase);
          });
          const vaultItem: MagicItem = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            name: targetSlot.name,
            usage: targetSlot.usage,
            action: targetSlot.action,
            effect: targetSlot.effect,
            source: 'Unequipped from Loadout',
            created_at: new Date().toISOString(),
            category: catalogMatch?.category || (targetSlot as any).category || null,
            slot_weight: (getItemSlotWeight(targetSlot) as 1 | 2 | 3 | 4),
          };
          return { ...prev, [slotKey]: updated, character_vault: [...currentVault, vaultItem] };
        }
        return { ...prev, [slotKey]: updated };
      }
    });
    saveActiveCharacter();
  };

  const handleEquipVaultItem = (vaultItem: MagicItem) => {
    const weight = vaultItem.slot_weight || getCategorySlotWeight(vaultItem.category || vaultItem.rarity);
    const currentSlots = Array.isArray(sheetData.spell_slots) ? sheetData.spell_slots : [];
    const activeSlotsUsed = calculateTotalLoadoutSlotsUsed(currentSlots);

    if (activeSlotsUsed + weight > totalLoadoutCapacity) {
      alert(`❌ Insufficient Loadout Capacity! Active loadout is ${activeSlotsUsed}/${totalLoadoutCapacity} slots. Item requires ${weight} slots. Unlock +2 Loadout Slots in the Buy Slots tab or header button.`);
      return;
    }

    updateActiveSheetData((prev) => {
      const currentVault = Array.isArray(prev.character_vault) ? prev.character_vault : [];
      const currentSlots = Array.isArray(prev.spell_slots) ? prev.spell_slots : [];

      const newVault = currentVault.filter((v) => v.id !== vaultItem.id && v.name !== vaultItem.name);
      const newSlot: any = {
        select: true,
        name: vaultItem.name,
        base_name: vaultItem.base_name || cleanName(vaultItem.name),
        version: vaultItem.version || 1,
        action: (vaultItem.action?.toUpperCase() as any) || 'P',
        usage: vaultItem.usage || '1-Enc',
        effect: vaultItem.effect || '',
        checked: [false, false, false],
        // Preserve tier metadata for round-trip slot weight resolution
        category: vaultItem.category || null,
        slot_weight: weight,
      };

      return {
        ...prev,
        character_vault: newVault,
        spell_slots: [...currentSlots, newSlot],
      };
    });
    saveActiveCharacter();
  };

  // Custom Creation Save Handler (Strictly for Powers)
  const handleSaveCustomAbility = () => {
    if (!createName.trim()) return;
    const rawClean = cleanName(createName.trim());
    const { baseName, version } = parseAbilityVersion(rawClean);
    const versionedName = `${baseName} v${version}`;

    const newItem: Power = {
      id: Date.now(),
      name: versionedName,
      base_name: baseName,
      version: version,
      action: createAction,
      usage: createUsage,
      effect: createEffect.trim(),
      category: 'Custom',
      created_at: new Date().toISOString(),
    };

    updateActiveSheetData((prev) => {
      const customKey = type === 'powers' ? 'custom_powers' : 'custom_magic_items';
      const existingCustom = prev[customKey] || [];
      const updatedCustom = [...existingCustom, newItem];

      const currentSlots: AbilitySlot[] = Array.isArray(prev.power_slots) ? prev.power_slots : [];
      const currentVault: AbilitySlot[] = Array.isArray(prev.character_power_codex) ? prev.character_power_codex : [];
      const combinedOld = [...currentSlots, ...currentVault];
      const oldTotalUnits = calculateTotalPowerUnits(pruneLesserPowerVersions(combinedOld));
      const oldApSpent = oldTotalUnits;

      const newPower: AbilitySlot = {
        select: true,
        name: versionedName,
        base_name: baseName,
        version: version,
        action: (createAction.toUpperCase() as any) || 'A',
        usage: createUsage,
        effect: createEffect.trim(),
        checked: [false, false, false],
        is_readied: false,
        ready: getPowerReadyCategory(newItem),
      };

      const existingReadiedIdx = currentSlots.findIndex(
        (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === baseName.toLowerCase()
      );
      const existingVaultIdx = currentVault.findIndex(
        (s) => parseAbilityVersion(s.name).baseName.toLowerCase() === baseName.toLowerCase()
      );

      let updatedSlots = [...currentSlots];
      let updatedVault = [...currentVault];
      let isUpgrade = false;

      if (existingReadiedIdx >= 0) {
        updatedSlots[existingReadiedIdx] = { ...newPower, is_readied: true };
        isUpgrade = true;
      } else if (existingVaultIdx >= 0) {
        updatedVault[existingVaultIdx] = newPower;
        isUpgrade = true;
      } else {
        updatedVault.push(newPower);
      }

      const combinedNew = [...updatedSlots, ...updatedVault];
      const prunedCombined = pruneLesserPowerVersions(combinedNew);
      const newTotalUnits = calculateTotalPowerUnits(prunedCombined);
      const newApSpent = newTotalUnits;
      const apDiff = newApSpent - oldApSpent;

      const logAction = isUpgrade ? 'Upgraded Power' : 'Created & Learned Power';

      if (apDiff > 0) {
        recordApExpenditure(apDiff, 'Powers', `${logAction}: ${versionedName} (+${apDiff} AP)`, 1, 'Manage Powers');
      }

      return {
        ...prev,
        [customKey]: updatedCustom,
        power_slots: updatedSlots,
        character_power_codex: updatedVault,
      };
    });
    saveActiveCharacter();

    setCreateName('');
    setCreateAction('A');
    setCreateUsage('1');
    setCreateEffect('');
    setIsVersionEditMode(false);
    setActiveRightTab('CATALOG');
  };

  const [localGenreFilter, setLocalGenreFilter] = useState<string>(activeGenre || 'SciFi');
  const [hardwareTierFilter, setHardwareTierFilter] = useState<'ALL' | 'Minor' | 'Lesser' | 'Greater' | 'Epic'>('ALL');

  // Keep local genre synced to active campaign setting when modal opens
  useEffect(() => {
    if (showManageModal && activeGenre) {
      setLocalGenreFilter(activeGenre);
    }
  }, [showManageModal, activeGenre]);

  // Filter catalog items by Category & Deduplication & Genre Scope
  const categoryFilteredCatalog = useMemo(() => {
    return fullCatalog.filter((item) => {
      // 0. Local Genre Scope Filtering
      if (localGenreFilter !== 'ALL' && !matchesGenre(item.genres, localGenreFilter as any)) {
        return false;
      }

      // 1. Deduplication: Filter out items already in the character's learned roster
      if (knownAbilityNamesSet.has(cleanName(item.name).toLowerCase())) {
        return false;
      }

      if (type !== 'powers') {
        // Loadout Mode (Hardware Catalog): Exclusively Hardware items (Relics are only found via Loot Rolls)
        const isHw = !!((item as any).is_hardware || (item as any).cost);
        if (!isHw) {
          return false;
        }
      }
      return true;
    });
  }, [fullCatalog, knownAbilityNamesSet, type, localGenreFilter]);

  const groupedTables = useMemo(() => {
    const acc = categoryFilteredCatalog.reduce((map, item) => {
      let rawTableName = (item as any).kit || (item as any).table_group || (item as any).table || (item as any).table_name;
      let tableName = cleanKitName(rawTableName);
      if (!tableName) {
        tableName = type === 'powers' ? 'General Powers' : 'Tech Hardware';
      }
      if (!map[tableName]) map[tableName] = [];
      map[tableName].push(item);
      return map;
    }, {} as Record<string, (Power | MagicItem)[]>);

    if (type === 'powers') {
      customPowerTables.forEach((tbl) => {
        if (localGenreFilter !== 'ALL' && !matchesGenre((tbl as any).genres, localGenreFilter as any)) return;
        if (!acc[tbl.name]) {
          acc[tbl.name] = [];
        }
      });
    }

    return acc;
  }, [categoryFilteredCatalog, type, customPowerTables, localGenreFilter]);

  const starredCatalogItems = useMemo(() => {
    return fullCatalog.filter((item) => isItemStarred(item));
  }, [fullCatalog, isItemStarred]);

  const availableTableNames = useMemo(() => {
    const keys = Object.keys(groupedTables);
    return keys.sort((a, b) => a.localeCompare(b));
  }, [groupedTables]);

  const pinnedTableNames: string[] = useMemo(() => {
    if (type === 'powers') {
      const favs: string[] = sheetData.favorite_power_tables || [];
      if (favs.length === 0) {
        const luckTbl = availableTableNames.find((t) => t.toLowerCase().includes('luck'));
        return luckTbl ? [luckTbl] : availableTableNames.slice(0, 8);
      }
      return favs.filter((t) => availableTableNames.includes(t)).slice(0, 8);
    } else {
      const favs: string[] = sheetData.favorite_hardware_tables || [];
      if (favs.length === 0) {
        return availableTableNames.slice(0, 8);
      }
      return favs.filter((t) => availableTableNames.includes(t)).slice(0, 8);
    }
  }, [type, sheetData.favorite_power_tables, sheetData.favorite_hardware_tables, availableTableNames]);

  const effectiveActiveTable = useMemo(() => {
    if (activeTableName === 'ALL') return 'ALL';
    if (activeTableName === 'STARRED') return 'STARRED';
    if (activeTableName && availableTableNames.includes(activeTableName)) {
      return activeTableName;
    }
    if (pinnedTableNames.length > 0) {
      return pinnedTableNames[0];
    }
    return 'ALL';
  }, [activeTableName, availableTableNames, pinnedTableNames]);

  const activeTableAbilities = useMemo(() => {
    if (effectiveActiveTable === 'ALL') {
      return categoryFilteredCatalog;
    }
    if (effectiveActiveTable === 'STARRED') {
      return starredCatalogItems;
    }
    return effectiveActiveTable ? groupedTables[effectiveActiveTable] || [] : [];
  }, [effectiveActiveTable, groupedTables, categoryFilteredCatalog, starredCatalogItems]);

  const filteredCatalogAbilities = useMemo(() => {
    return activeTableAbilities.filter((item) => {
      // 1. Ready category filter for Powers mode
      if (type === 'powers' && catalogReadyFilter !== 'all') {
        const cat = getPowerReadyCategory(item);
        if (cat !== catalogReadyFilter) return false;
      }

      // 2. Hardware Tier filter for Loadout mode
      if (type === 'spells' && hardwareTierFilter !== 'ALL') {
        const rawCat = ((item as any).category || (item as any).tier || (item as any).sub || '').toLowerCase();
        if (!rawCat.includes(hardwareTierFilter.toLowerCase())) {
          return false;
        }
      }

      if (!rightSearchQuery.trim()) return true;
      const q = rightSearchQuery.toLowerCase().trim();
      const nameMatch = item.name.toLowerCase().includes(q);
      const actionMatch = (item.action || '').toLowerCase().includes(q);
      const usageMatch = (item.usage || '').toLowerCase().includes(q);
      const effectMatch = (item.effect || '').toLowerCase().includes(q);
      const notesMatch = ((item as any).notes || '').toLowerCase().includes(q);
      return nameMatch || actionMatch || usageMatch || effectMatch || notesMatch;
    });
  }, [activeTableAbilities, rightSearchQuery, type, catalogReadyFilter, hardwareTierFilter]);

  const groupedFilteredAbilities = useMemo(() => {
    const map: Record<string, (Power | MagicItem)[]> = {};
    filteredCatalogAbilities.forEach((item) => {
      let rawTbl = (item as any).kit || (item as any).table_group || (item as any).table || (item as any).table_name;
      let tbl = cleanKitName(rawTbl);
      if (!tbl) {
        tbl = type === 'powers' ? 'General Powers' : 'Tech Hardware';
      }
      if (!map[tbl]) map[tbl] = [];
      map[tbl].push(item);
    });
    return map;
  }, [filteredCatalogAbilities, type]);

  const sortedGroupedTableKeys = useMemo(() => {
    const keys = Object.keys(groupedFilteredAbilities);
    if (type === 'spells') {
      const order = ['Minor', 'Lesser', 'Greater', 'Epic'];
      return keys.sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    return keys.sort((a, b) => a.localeCompare(b));
  }, [groupedFilteredAbilities, type]);

  // Filtered learned roster for Left Column search (Highest Version Only)
  const filteredRoster = useMemo(() => {
    const roster = type === 'powers' ? activeDisplaySlots : slots;
    return roster.filter((s) => {
      if (type === 'powers' && catalogReadyFilter !== 'all') {
        const cat = getPowerReadyCategory(s);
        if (cat !== catalogReadyFilter) return false;
      }
      if (!leftSearchQuery.trim()) return true;
      const q = leftSearchQuery.toLowerCase().trim();
      return cleanName(s.name).toLowerCase().includes(q) || (s.effect || '').toLowerCase().includes(q);
    });
  }, [type, activeDisplaySlots, slots, leftSearchQuery, catalogReadyFilter]);

  const sectionIcon = type === 'powers' ? '🔥' : '🧿';
  const displayTitle = title || (type === 'powers' ? 'POWERS' : 'FUNCTIONS');

  // Action Economy or Alphabetical Sorting for Active Sheet (with Action Channel Filtering for Powers & Loadout)
  const sortedSlots = useMemo(() => {
    let list = type === 'powers' ? activeDisplaySlots : slots;
    if (abilityActionFilter !== 'ALL') {
      list = list.filter((s) => (s.action || '').toUpperCase() === abilityActionFilter);
    }
    return [...list].sort((a, b) => {
      if (abilitySortMode === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      const orderA = ACTION_ORDER[a.action?.toUpperCase() || ''] ?? 99;
      const orderB = ACTION_ORDER[b.action?.toUpperCase() || ''] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [activeDisplaySlots, slots, type, abilitySortMode, abilityActionFilter]);

  return (
    <div
      ref={cardContainerRef}
      className={`rounded-2xl border border-slate-800 border-t-2 p-4 flex flex-col gap-4 shadow-lg ${
      type === 'powers'
        ? 'bg-gradient-to-b from-orange-950/30 via-slate-900/90 to-slate-950/95 border-t-orange-500/90 shadow-orange-950/20'
        : 'bg-gradient-to-b from-pink-950/30 via-slate-900/90 to-slate-950/95 border-t-pink-500/90 shadow-pink-950/20'
    }`}>
      {/* Header: Title, Icon, & Master Manager Trigger Button */}
      <div className={`flex items-center justify-between border-b pb-2.5 gap-2 ${
        type === 'powers' ? 'border-orange-500/20' : 'border-pink-500/20'
      }`}>
        <div className="flex items-center gap-2.5 shrink-0 justify-start">
          <button
            type="button"
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 group cursor-pointer focus:outline-none select-none text-left"
            title={`Click to open ${type === 'powers' ? 'Powers' : 'Loadout'} Manager`}
          >
            <div className={`p-1.5 rounded-xl border flex items-center justify-center shrink-0 group-hover:scale-105 transition-all ${
              type === 'powers'
                ? 'bg-orange-950/90 border-orange-500/50 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.25)] group-hover:border-orange-400'
                : 'bg-pink-950/90 border-pink-500/50 text-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.25)] group-hover:border-pink-400'
            }`}>
              <span className="text-base leading-none whitespace-nowrap flex items-center gap-0.5">{sectionIcon}</span>
            </div>
            <h3 className={`font-outfit font-extrabold text-sm tracking-widest uppercase flex items-center gap-1.5 group-hover:text-white transition-colors ${
              type === 'powers' ? 'text-orange-200' : 'text-pink-200'
            }`}>
              <span>{displayTitle}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-all group-hover:translate-y-0.5 ${
                type === 'powers' ? 'text-orange-400/70 group-hover:text-orange-300' : 'text-pink-400/70 group-hover:text-pink-300'
              }`} />
            </h3>
          </button>
          <CardHelpButton ruleKey={type === 'powers' ? 'powers.basics' : 'magic_items.basics'} />
        </div>

        {/* Center Actions: Sort Popover, Action Channel Filter, & Clear Uses */}
        <div className="flex items-center justify-center gap-2 flex-1 flex-nowrap overflow-x-auto no-scrollbar">
          {/* Sort Action Channel / Alphabetical Popover Trigger */}
          <div className="relative shrink-0" ref={sortPopoverRef}>
            <button
              type="button"
              onClick={() => setIsSortPopoverOpen(!isSortPopoverOpen)}
              className={`p-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center shadow-sm cursor-pointer border ${
                isSortPopoverOpen || abilitySortMode === 'name'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-amber-950/40'
                  : 'bg-slate-950/60 hover:bg-slate-800 border-slate-700/80 text-slate-400 hover:text-slate-100'
              }`}
              title={abilitySortMode === 'action' ? 'Sort: Action Sort (AM ➔ A ➔ M ➔ P ➔ F)' : 'Sort: By Name (A ➔ Z)'}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>

            {/* Sort Popover Dropdown */}
            {isSortPopoverOpen && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-slate-700/90 rounded-xl p-1 shadow-2xl backdrop-blur-md min-w-[160px] flex flex-col gap-1 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => {
                    handleSetSortMode('action');
                    setIsSortPopoverOpen(false);
                  }}
                  className={`w-full py-1.5 px-2.5 text-xs rounded-lg transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    abilitySortMode === 'action'
                      ? 'bg-amber-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Action Sort</span>
                  </span>
                  {abilitySortMode === 'action' && <Check className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSetSortMode('name');
                    setIsSortPopoverOpen(false);
                  }}
                  className={`w-full py-1.5 px-2.5 text-xs rounded-lg transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    abilitySortMode === 'name'
                      ? 'bg-amber-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>🔤</span>
                    <span>By Name Sort</span>
                  </span>
                  {abilitySortMode === 'name' && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {/* Action Channel Filter Pill Switch (All, AM, A, M, P, F) */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md shrink-0">
            {(['ALL', 'AM', 'A', 'M', 'P', 'F'] as const).map((filterOpt) => {
              const isSelected = abilityActionFilter === filterOpt;
              const activeColor =
                filterOpt === 'ALL'
                  ? 'bg-amber-600 text-white font-extrabold shadow-sm'
                  : filterOpt === 'AM'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : filterOpt === 'A'
                  ? 'bg-rose-600 text-white font-black shadow-sm'
                  : filterOpt === 'M'
                  ? 'bg-indigo-600 text-white font-black shadow-sm'
                  : filterOpt === 'P'
                  ? 'bg-emerald-600 text-white font-black shadow-sm'
                  : 'bg-purple-600 text-white font-black shadow-sm';

              return (
                <button
                  key={filterOpt}
                  type="button"
                  onClick={() => handleSetActionFilter(filterOpt)}
                  className={`py-0.5 px-2 text-[11px] font-mono rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? activeColor
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                  title={
                    filterOpt === 'ALL'
                      ? 'Show all abilities'
                      : `Show only ${filterOpt} action channel abilities`
                  }
                >
                  {filterOpt === 'ALL' ? 'All' : filterOpt}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleClearAllUses}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950/60 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-slate-100 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
            title={`Uncheck all ${type === 'powers' ? 'power' : 'loadout item'} usage checkboxes`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-outfit text-[11px] font-bold">Clear Uses</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowManageModal(!showManageModal)}
              className={`p-1.5 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center shadow-sm cursor-pointer group ${
                showManageModal
                  ? type === 'powers'
                    ? 'bg-amber-600/30 text-amber-200 border-amber-400 shadow-amber-500/30'
                    : 'bg-cyan-600/30 text-cyan-200 border-cyan-400 shadow-cyan-500/30'
                  : type === 'powers'
                  ? 'bg-amber-950/40 hover:bg-amber-900/50 border-amber-500/30 text-amber-300 hover:text-white'
                  : 'bg-cyan-950/40 hover:bg-cyan-900/50 border-cyan-500/30 text-cyan-300 hover:text-white'
              }`}
              title={`Open ${type === 'powers' ? 'Powers' : 'Loadout'} Manager`}
            >
              <span className="text-xs group-hover:rotate-12 transition-transform">✏️</span>
            </button>

          {/* MASTER 2-COLUMN SPLIT-PANE MANAGER MODAL */}
          {showManageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
              <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[88vh] max-h-[680px] flex flex-col shadow-2xl overflow-hidden text-xs"
              >
                {/* Modal Top Bar */}
                <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/80 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className={`p-2 rounded-xl border flex items-center justify-center shrink-0 ${
                        type === 'powers' ? 'bg-amber-950/80 border-amber-500/30 text-amber-300' : 'bg-cyan-950/80 border-cyan-500/30 text-cyan-300'
                      }`}>
                        <span className="text-lg leading-none whitespace-nowrap flex items-center gap-0.5">{sectionIcon}</span>
                      </div>
                      <div>
                        <h3 className="font-outfit font-bold text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                          {type === 'powers' ? 'Powers Manager' : 'Functions Manager'}
                        </h3>
                        <p className="text-xs text-slate-400 hidden sm:block">
                          {type === 'powers'
                            ? 'Manage character powers side-by-side with the SupaFlex stock catalog and custom creator.'
                            : 'Manage active Function Slots (🧿) moving abilities between the Vault and your active slots.'}
                        </p>
                      </div>
                    </div>

                    {/* Center: Top-Center Header Status Pill */}
                    {type === 'powers' && (
                      <div className="px-3.5 py-1 bg-amber-950/70 border border-amber-500/40 rounded-full font-mono font-bold text-xs text-amber-200 flex items-center gap-2 shadow-md">
                        <span>
                          Learned <strong className="text-amber-300">{activeDisplaySlots.length} Powers</strong>; Invested{' '}
                          <strong className="text-rose-300">{apSpent} AP</strong>; Available{' '}
                          <strong className="text-emerald-400">{availableAp} AP</strong>
                        </span>
                      </div>
                    )}

                    <button
                      onClick={handleCloseManageModal}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 2-COLUMN SPLIT-PANE BODY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 flex-1 min-h-0 overflow-hidden bg-slate-900/40">
                  
                  {/* --- LEFT COLUMN: ACTIVE LOADOUT ONLY --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80 shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Flame className={`w-4 h-4 ${type === 'powers' ? 'text-amber-400' : 'text-pink-400'}`} />
                        <span className={`text-xs font-outfit font-bold uppercase tracking-wider ${type === 'powers' ? 'text-amber-300' : 'text-pink-300'}`}>
                          {type === 'powers' ? 'Ready Powers' : '💍 Active Loadout'}
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
                          value={leftSearchQuery}
                          onChange={(e) => setLeftSearchQuery(e.target.value)}
                          className="bg-slate-900 text-slate-200 text-[11px] pl-6 pr-2 py-0.5 rounded border border-slate-700 outline-none focus:border-amber-500 w-24 sm:w-28"
                        />
                      </div>
                    </div>

                    {/* Left Pane Slots Status Pill (Loadout Mode) */}
                    {type === 'spells' && (() => {
                      const remainingSlots = Math.max(0, totalLoadoutCapacity - totalUsedLoadoutSlots);
                      return (
                        <div className="mt-2.5 px-3 py-1.5 bg-slate-900/90 border border-cyan-500/40 rounded-xl text-xs font-mono flex items-center justify-between gap-2 shadow-inner shrink-0">
                          <span className="text-cyan-300 font-bold flex items-center gap-1">💍 Loadout Slots:</span>
                          <div className="flex items-center gap-2 text-[11px] font-bold">
                            <span className="text-slate-300">Capacity <strong className="text-slate-100">{totalLoadoutCapacity}</strong></span>
                            <span className="text-slate-600">|</span>
                            <span className={totalUsedLoadoutSlots > totalLoadoutCapacity ? "text-rose-400" : "text-amber-300"}>
                              Used <strong className={totalUsedLoadoutSlots > totalLoadoutCapacity ? "text-rose-300 font-extrabold" : "text-amber-200"}>{totalUsedLoadoutSlots}</strong>
                            </span>
                            <span className="text-slate-600">|</span>
                            <span className={remainingSlots > 0 ? "text-emerald-400" : "text-rose-400"}>
                              Remaining <strong className="text-emerald-300">{remainingSlots}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Left Pane Slots Status Pill (Powers Mode: Progressive Soft Tax) */}
                    {type === 'powers' && (() => {
                      const powerCount = activeDisplaySlots.length;
                      const totalApInvested = calculatePowersKnownApCost(powerCount);
                      const bracket = getPowersSoftTaxBracket(powerCount);
                      return (
                        <div className="mt-2.5 px-3 py-1.5 bg-slate-900/90 border border-amber-500/40 rounded-xl text-xs font-mono flex items-center justify-between gap-2 shadow-inner shrink-0 flex-wrap">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="text-amber-300">🔥 Learned: <strong className="text-white">{powerCount} Powers</strong></span>
                            <span className="text-slate-600">|</span>
                            <span className="text-emerald-400">AP Invested: <strong className="text-emerald-300">{totalApInvested} AP</strong></span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-amber-500/30">
                            {bracket.tierName} (+{bracket.costPerNextPower} AP/power)
                          </span>
                        </div>
                      );
                    })()}

                    {/* Scrollable Active Loadout List */}
                    <div className="flex-1 overflow-y-auto pr-1 mt-2.5 flex flex-col gap-2.5 min-h-0">
                      {filteredRoster.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                          <Flame className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                          {leftSearchQuery ? (
                            <span>No active items matching "{leftSearchQuery}"</span>
                          ) : (
                            <span>
                              {type === 'powers'
                                ? 'No powers readied yet. Select from Codex or Catalog on the right.'
                                : 'No active loadout items equipped. Select items from Vault (Tab 1 on right) to equip.'}
                            </span>
                          )}
                        </div>
                      ) : (
                        filteredRoster.map((item, idx) => {
                          const cleaned = cleanName(item.name);
                          const { baseName, version } = parseAbilityVersion(cleaned);
                          const cat = type === 'powers' ? getPowerReadyCategory(item) : null;
                          const actionUpper = (item.action || '').toUpperCase();
                          const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                          return (
                            <div
                              key={item.name + idx}
                              className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all shrink-0 hover:border-slate-700"
                            >
                              <div className="flex items-start justify-between border-b border-slate-800/80 pb-2 gap-2">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-outfit font-bold text-sm text-slate-100">{baseName}</span>
                                    {type !== 'powers' && (() => {
                                      const resolvedNotes =
                                        (item as any).notes ||
                                        (fullCatalog.find(
                                          (c) =>
                                            c.name.toLowerCase() === baseName.toLowerCase() ||
                                            c.name.toLowerCase() === cleanName(item.name).toLowerCase()
                                        ) as any)?.notes;
                                      return <ItemNotesPopover notes={resolvedNotes} itemName={baseName} />;
                                    })()}
                                    {version > 1 && (
                                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                        v{version}
                                      </span>
                                    )}
                                    {type === 'powers' && cat && (
                                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                        cat === 'primary_arsenal'
                                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                          : cat === 'mobility_defense'
                                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                      }`}>
                                        {cat === 'primary_arsenal' ? '⚔️ Primary' : cat === 'mobility_defense' ? '👣 Mobility' : '🎓 Support (0)'}
                                      </span>
                                    )}
                                  </div>
                                  {type === 'spells' && (() => {
                                    const badge = getMagicItemTierBadge(item, fullCatalog);
                                    if (!badge) return null;
                                    return (
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border w-fit flex items-center gap-1 ${badge.style}`}>
                                        <span>{badge.icon}</span>
                                        <span>{badge.label}</span>
                                        <span className="opacity-90 font-extrabold font-mono">({badge.slotsText})</span>
                                      </span>
                                    );
                                  })()}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1">
                                    {actionUpper && (
                                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${actionClass}`}>
                                        {actionUpper}
                                      </span>
                                    )}
                                    {item.usage && (
                                      <span className="bg-slate-950 text-[10px] font-mono text-amber-300 px-1.5 py-0.5 rounded border border-slate-800">
                                        {item.usage}
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleStarItem(item)}
                                    className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                      isItemStarred(item)
                                        ? 'text-amber-400'
                                        : 'text-slate-600 hover:text-amber-400'
                                    }`}
                                    title={isItemStarred(item) ? 'Starred Favorite' : 'Star to add to Starred Favorites'}
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isItemStarred(item) ? 'fill-amber-400' : ''}`} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleLaunchVersionEditor(item)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors shrink-0"
                                    title={`Version edit ${baseName}`}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {type === 'powers' ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleForgetAbility(item.name)}
                                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                        title="Forget Power permanently"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleForgetAbility(item.name)}
                                      className="px-2 py-1 bg-pink-950/60 text-pink-300 border border-pink-500/40 hover:bg-pink-900/80 text-xs font-bold rounded-lg transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                                      title="Send item back to Character Vault"
                                    >
                                      <span>➡️ Send to Vault</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="text-xs pt-1">
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

                  {/* --- RIGHT COLUMN: TABS INTERFACE --- */}
                  <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 flex flex-col h-full min-h-0 overflow-hidden shadow-inner">
                    {/* Pane Sub-Tab Header */}
                    <div className="flex border-b border-slate-800 mb-4 shrink-0">
                      {type === 'spells' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isVersionEditMode) setIsVersionEditMode(false);
                            setActiveRightTab('VAULT');
                          }}
                          className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'VAULT'
                              ? 'border-cyan-400 text-cyan-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          🏺 Vault ({(Array.isArray(sheetData.character_vault) ? sheetData.character_vault.length : 0)})
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isVersionEditMode) setIsVersionEditMode(false);
                          setActiveRightTab('CATALOG');
                        }}
                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'CATALOG'
                            ? type === 'powers'
                              ? 'border-amber-400 text-amber-400'
                              : 'border-cyan-400 text-cyan-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {type === 'powers'
                          ? `🌐 Catalog (${filteredCatalogAbilities.length})`
                          : `⚙️ Hardware Catalog (${filteredCatalogAbilities.length})`}
                      </button>

                      {type === 'spells' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isVersionEditMode) setIsVersionEditMode(false);
                            setActiveRightTab('SLOTS');
                          }}
                          className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'SLOTS'
                              ? 'border-indigo-400 text-indigo-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ⚡ Buy Slots
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isVersionEditMode) setIsVersionEditMode(false);
                          setActiveRightTab('CREATOR');
                        }}
                        className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeRightTab === 'CREATOR'
                            ? type === 'powers'
                              ? 'border-amber-400 text-amber-400'
                              : 'border-cyan-400 text-cyan-400'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        ✨ Custom Creator
                      </button>

                      {isVersionEditMode && (
                        <button
                          type="button"
                          onClick={() => setActiveRightTab('EDITOR')}
                          className={`flex-1 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            activeRightTab === 'EDITOR'
                              ? 'border-violet-400 text-violet-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ✨ Version Editor
                        </button>
                      )}
                    </div>

                    {/* TAB: POWER CODEX VIEW (powers mode) */}
                    {activeRightTab === 'CODEX' && type === 'powers' && (() => {
                      const codexList: AbilitySlot[] = Array.isArray(sheetData.character_power_codex) ? sheetData.character_power_codex : [];
                      const filteredCodex = codexList.filter((p) => {
                        if (catalogReadyFilter !== 'all') {
                          const cat = getPowerReadyCategory(p);
                          if (cat !== catalogReadyFilter) return false;
                        }
                        if (!rightSearchQuery.trim()) return true;
                        const q = rightSearchQuery.toLowerCase().trim();
                        return (p.name || '').toLowerCase().includes(q) || (p.effect || '').toLowerCase().includes(q);
                      });

                      return (
                        <div className="flex flex-col gap-2.5 flex-1 min-h-0 mt-2.5">
                          {readyFeedback && (
                            <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 shrink-0 ${
                              readyFeedback.type === 'error'
                                ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
                            }`}>
                              <span>{readyFeedback.message}</span>
                              <button onClick={() => setReadyFeedback(null)} className="text-slate-400 hover:text-slate-100">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs flex items-center justify-between gap-2 shrink-0">
                            <span className="text-slate-400">
                              Un-readied powers stored in character Vault.
                            </span>
                            <span className="font-mono text-amber-300 font-bold">{filteredCodex.length} in Vault</span>
                          </div>

                          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                            {filteredCodex.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                                <span>No un-readied powers in Vault. Learn powers from Catalog or unready active powers on the left.</span>
                              </div>
                            ) : (
                              filteredCodex.map((p, pIdx) => {
                                const cleaned = cleanName(p.name);
                                const { baseName, version } = parseAbilityVersion(cleaned);
                                const cat = getPowerReadyCategory(p);
                                const actionUpper = (p.action || '').toUpperCase();
                                const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';

                                return (
                                  <div
                                    key={p.name + pIdx}
                                    className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all shrink-0 hover:border-slate-700"
                                  >
                                    <div className="flex items-start justify-between border-b border-slate-800/80 pb-2 gap-2">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-outfit font-bold text-sm text-slate-100">{baseName}</span>
                                          {version > 1 && (
                                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                              v{version}
                                            </span>
                                          )}
                                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                            cat === 'primary_arsenal'
                                              ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                                              : cat === 'mobility_defense'
                                              ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                                              : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                                          }`}>
                                            {cat === 'primary_arsenal' ? '⚔️ Primary' : cat === 'mobility_defense' ? '👣 Mobility/Def' : '🎓 Support (0)'}
                                          </span>
                                          {actionUpper && (
                                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${actionClass}`}>
                                              {actionUpper}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleLaunchVersionEditor(p)}
                                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition-colors"
                                          title="Open Version Editor"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const res = toggleReadyPower(p.name);
                                            if (!res.success) {
                                              setReadyFeedback({ type: 'error', message: res.error || 'Failed to ready power.' });
                                            } else {
                                              setReadyFeedback({ type: 'success', message: `Readied ${p.name}!` });
                                              setTimeout(() => setReadyFeedback(null), 2000);
                                            }
                                          }}
                                          className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                                          <span>Ready</span>
                                        </button>
                                      </div>
                                    </div>

                                    <div className="text-xs pt-1">
                                      <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                                        {p.effect || 'No description'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* TAB 1: CHARACTER VAULT VIEW (spells mode) */}
                    {activeRightTab === 'VAULT' && type === 'spells' && (() => {
                      const vaultList: MagicItem[] = Array.isArray(sheetData.character_vault) ? sheetData.character_vault : [];
                      const filteredVault = rightSearchQuery.trim()
                        ? vaultList.filter((v) => (v.name || '').toLowerCase().includes(rightSearchQuery.toLowerCase()) || (v.effect || '').toLowerCase().includes(rightSearchQuery.toLowerCase()))
                        : vaultList;

                      return (
                        <div className="flex flex-col gap-2.5 flex-1 min-h-0 mt-2.5">
                          {/* Search Bar for Vault */}
                          <div className="shrink-0">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={rightSearchQuery}
                                onChange={(e) => setRightSearchQuery(e.target.value)}
                                className="bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1 rounded-lg border border-slate-700 outline-none focus:border-pink-500 w-full"
                              />
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 min-h-0">
                            {filteredVault.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-xs italic gap-1">
                                <Sparkles className="w-8 h-8 text-slate-700 opacity-60 stroke-[1.5]" />
                                {rightSearchQuery ? (
                                  <span>No items matching "{rightSearchQuery}" in Vault.</span>
                                ) : (
                                  <span>Vault is empty. Claim items from Catalog (Tab 2) or Loot Generator.</span>
                                )}
                              </div>
                            ) : (
                              filteredVault.map((item, idx) => {
                                const weight = getItemSlotWeight(item);
                                const badge = getMagicItemTierBadge(item, fullCatalog);
                                return (
                                  <div
                                    key={item.id || item.name + idx}
                                    className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all shrink-0 hover:border-slate-700"
                                  >
                                    <div className="flex items-start justify-between border-b border-slate-800/80 pb-2 gap-2">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-outfit font-bold text-sm text-slate-100">{item.name}</span>
                                          <ItemNotesPopover notes={(item as any).notes || (fullCatalog.find((c) => c.name.toLowerCase() === cleanName(item.name).toLowerCase()) as any)?.notes} itemName={item.name} />
                                        </div>
                                        {badge && (
                                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border w-fit flex items-center gap-1 ${badge.style}`}>
                                            <span>{badge.icon}</span>
                                            <span>{badge.label}</span>
                                            <span className="opacity-90 font-extrabold font-mono">({badge.slotsText})</span>
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleEquipVaultItem(item)}
                                        className="px-2.5 py-1 rounded-lg text-xs font-outfit font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                        Equip ({weight} Slot{weight > 1 ? 's' : ''})
                                      </button>
                                    </div>
                                    <div className="text-xs pt-1">
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
                      );
                    })()}

                    {/* TAB: BUY SLOTS (Uncapped Soft-Slope Loadout Capacity Engine) */}
                    {activeRightTab === 'SLOTS' && type === 'spells' && (() => {
                      const scheduleRows = generateLoadoutScheduleRows(12);

                      return (
                        <div className="flex flex-col gap-3 flex-1 min-h-0 mt-2.5 overflow-y-auto pr-1">
                          {/* Top Status Header Pill */}
                          <div className="px-3.5 py-1.5 bg-pink-950/70 border border-pink-500/40 rounded-full font-mono font-bold text-xs text-pink-200 flex items-center justify-between shadow-md shrink-0 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span>Capacity <strong className="text-pink-300">{totalLoadoutCapacity} Slots</strong></span>
                              <span className="text-pink-500/60">•</span>
                              <span>Used <strong className="text-amber-300">{totalUsedLoadoutSlots} Slots</strong></span>
                              <span className="text-pink-500/60">•</span>
                              <span>Spent <strong className="text-rose-400">{totalLoadoutApSpent} AP</strong></span>
                            </div>
                            <div>
                              <span>Available <strong className="text-emerald-400">{availableAp} AP</strong></span>
                            </div>
                          </div>

                          {/* Upgrade Action Box */}
                          <div className="p-3 bg-slate-900/90 rounded-xl border border-pink-500/40 flex items-center justify-between gap-3 shrink-0 shadow-md">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-pink-400" />
                                <span className="font-outfit font-bold text-sm text-slate-100">
                                  Next Expansion: +2 Slots ({totalLoadoutCapacity + 2} Total Capacity)
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Expansion #{loadoutExpansions + 1} | Cost: <strong className="text-amber-300">{nextLoadoutExpansionCost} AP</strong> (Uncapped Expansion)
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={availableAp < nextLoadoutExpansionCost}
                              onClick={handleUnlockLoadoutExpansion}
                              className={`px-3 py-1.5 rounded-xl font-outfit font-bold text-xs flex items-center gap-1.5 shadow-md transition-all shrink-0 ${
                                availableAp >= nextLoadoutExpansionCost
                                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white cursor-pointer active:scale-95'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                              <span>Unlock +2 Slots ({nextLoadoutExpansionCost} AP)</span>
                            </button>
                          </div>

                          {/* Complete Slot Progression & AP Cost Schedule Table */}
                          <div className="flex flex-col gap-1.5 shrink-0 pb-2">
                            <div className="flex items-center justify-between px-1">
                              <span className="font-outfit font-bold text-xs uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                                <span>📜</span> Uncapped Loadout Capacity Schedule
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">Master Blueprint Schedule</span>
                            </div>

                            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80 shadow-inner">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-mono uppercase text-[10px]">
                                  <tr>
                                    <th className="py-1.5 px-2.5">Expansion Level</th>
                                    <th className="py-1.5 px-2.5">Total Capacity</th>
                                    <th className="py-1.5 px-2.5">Step Cost</th>
                                    <th className="py-1.5 px-2.5">Cumulative AP</th>
                                    <th className="py-1.5 px-2.5 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono">
                                  {scheduleRows.map((row, idx) => {
                                    const isCurrent = totalLoadoutCapacity === row.totalSlots;
                                    const isUnlocked = totalLoadoutCapacity >= row.totalSlots;
                                    const isNextTarget = row.step === loadoutExpansions + 1;

                                    return (
                                      <tr
                                        key={idx}
                                        className={`transition-colors ${
                                          isCurrent
                                            ? 'bg-pink-950/40 text-pink-100 font-bold border-l-2 border-l-pink-400'
                                            : isUnlocked
                                            ? 'text-slate-300 bg-slate-900/30'
                                            : 'text-slate-500'
                                        }`}
                                      >
                                        <td className="py-1.5 px-2.5 flex items-center gap-1.5">
                                          {isCurrent && <span className="text-pink-400 text-xs">⭐</span>}
                                          <span>{row.label}</span>
                                        </td>
                                        <td className="py-1.5 px-2.5 font-bold">{row.totalSlots} Slots</td>
                                        <td className="py-1.5 px-2.5">{row.step === 0 ? '0 AP (Baseline)' : `${row.apCost} AP (+2 Slots)`}</td>
                                        <td className="py-1.5 px-2.5 text-purple-300 font-bold">{row.cumulativeAp} AP</td>
                                        <td className="py-1.5 px-2.5 text-right">
                                          {isUnlocked ? (
                                            <span className="text-emerald-400 font-bold flex items-center justify-end gap-1">
                                              <CheckCircle className="w-3 h-3 text-emerald-400" /> Unlocked
                                            </span>
                                          ) : isNextTarget ? (
                                            <span className="text-pink-300 font-bold">⚡ Next Target</span>
                                          ) : (
                                            <span className="text-slate-500">Uncapped Pool</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* TAB 2: STOCK CATALOG VIEW */}
                    {activeRightTab === 'CATALOG' && (
                      <div className="flex-1 flex flex-col min-h-0 mt-2 gap-2 overflow-hidden">
                        {/* Hardware Catalog Info Banner (Spells/Loadout Mode) */}
                        {type === 'spells' && (
                          <div className="bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-xl flex items-center justify-between shadow-inner backdrop-blur-md shrink-0">
                            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-outfit">
                              ⚙️ Purchasable Hardware Catalog
                            </span>
                          </div>
                        )}

                        {/* Universal Quick Deck Bar & Search */}
                        <div className="flex flex-col gap-2 shrink-0">
                          {/* 1. DENSE DROPDOWN FACET TOOLBAR */}
                          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                            {/* Local Genre Selector Dropdown */}
                            <select
                              value={localGenreFilter}
                              onChange={(e) => setLocalGenreFilter(e.target.value)}
                              className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 cursor-pointer flex-1 min-w-[110px]"
                            >
                              <option value="ALL">🌐 All Genres</option>
                              <option value="Medieval">🏰 Medieval</option>
                              <option value="Modern">⚙️ Modern</option>
                              <option value="SciFi">🚀 SciFi</option>
                            </select>

                            {/* Hardware Tier Facet Dropdown (Loadout / Spells mode) */}
                            {type === 'spells' && (
                              <select
                                value={hardwareTierFilter}
                                onChange={(e) => setHardwareTierFilter(e.target.value as any)}
                                className="bg-slate-900 text-cyan-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-cyan-500 cursor-pointer flex-1 min-w-[120px]"
                              >
                                <option value="ALL">🌐 All Tiers</option>
                                <option value="Epic">💎 Epic (4 Slots)</option>
                                <option value="Greater">🥇 Greater (3 Slots)</option>
                                <option value="Lesser">🥈 Lesser (2 Slots)</option>
                                <option value="Minor">🥉 Minor (1 Slot)</option>
                              </select>
                            )}

                            {/* Powers Ready Category Dropdown (Powers mode) */}
                            {type === 'powers' && (
                              <select
                                value={catalogReadyFilter}
                                onChange={(e) => setCatalogReadyFilter(e.target.value as any)}
                                className="bg-slate-900 text-amber-300 text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-500 cursor-pointer flex-1 min-w-[130px]"
                              >
                                <option value="all">🌐 All Power Types</option>
                                <option value="mobility_defense">🛡️ Mobility & Defense</option>
                                <option value="primary_arsenal">⚔️ Primary Arsenal</option>
                                <option value="support_passive">✨ Support & Context</option>
                              </select>
                            )}
                          </div>

                          {/* 2. Universal Quick Deck Bar */}
                          <QuickDeckBar
                            domain={type === 'powers' ? 'powers' : 'hardware'}
                            activeTable={effectiveActiveTable || 'ALL'}
                            onSelectTable={setActiveTableName}
                            pinnedTables={pinnedTableNames}
                            onUpdatePinnedTables={handleUpdatePinnedTables}
                            catalogItems={categoryFilteredCatalog}
                            customTables={type === 'powers' ? customPowerTables : []}
                            starredCount={starredCatalogItems.length}
                            colorTheme={type === 'powers' ? 'amber' : 'cyan'}
                            totalCatalogCount={categoryFilteredCatalog.length}
                            placeholderText={type === 'powers' ? '➕ Pin Power Table' : '➕ Pin Hardware Table'}
                          />

                          {/* 3. SEARCH BAR + DYNAMIC RESULT BREADCRUMB */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={rightSearchQuery}
                                onChange={(e) => setRightSearchQuery(e.target.value)}
                                placeholder={`Search ${
                                  effectiveActiveTable && effectiveActiveTable !== 'ALL' && effectiveActiveTable !== 'STARRED'
                                    ? formatTableNameDisplay(effectiveActiveTable)
                                    : type === 'powers'
                                    ? 'all powers'
                                    : 'hardware catalog'
                                }...`}
                                className={`bg-slate-900 text-slate-200 text-xs pl-8 pr-2 py-1.5 rounded-lg border border-slate-700 outline-none w-full ${
                                  type === 'powers' ? 'focus:border-amber-500' : 'focus:border-cyan-500'
                                }`}
                              />
                            </div>
                            <div className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono font-bold text-slate-300 shrink-0">
                              {filteredCatalogAbilities.length} {filteredCatalogAbilities.length === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </div>

                        {/* Zero Matches Feedback & 1-Click Reset */}
                        {filteredCatalogAbilities.length === 0 && (
                          <div className="p-3.5 bg-slate-950/60 rounded-xl border border-amber-500/30 text-xs text-center flex flex-col items-center gap-2 shrink-0 my-1">
                            <span className="text-amber-300 font-semibold">
                              0 items match active filters ({localGenreFilter !== 'ALL' ? localGenreFilter : 'All Genres'}
                              {type === 'spells' && hardwareTierFilter !== 'ALL' ? ` • ${hardwareTierFilter}` : ''}
                              {effectiveActiveTable !== 'ALL' && effectiveActiveTable !== 'STARRED' ? ` • ${effectiveActiveTable}` : ''})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalGenreFilter(activeGenre || 'SciFi');
                                if (type === 'spells') setHardwareTierFilter('ALL');
                                if (type === 'powers') setCatalogReadyFilter('all');
                                setActiveTableName('ALL');
                                setRightSearchQuery('');
                              }}
                              className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        )}

                        {/* Catalog Action Feedback Banner */}
                        {catalogFeedback && (
                          <div
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 shrink-0 transition-all ${
                              catalogFeedback.type === 'error'
                                ? 'bg-rose-950/90 border-rose-500/60 text-rose-200 shadow-md shadow-rose-950/50'
                                : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200 shadow-md shadow-emerald-950/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {catalogFeedback.type === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              ) : (
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              <span className="font-medium">{catalogFeedback.message}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCatalogFeedback(null)}
                              className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 transition-colors"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Scrollable Catalog Abilities List Grouped Per Table */}
                        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
                          {sortedGroupedTableKeys.length > 0 ? (
                            sortedGroupedTableKeys.map((tableName) => {
                              const tablePowers = groupedFilteredAbilities[tableName] || [];
                              if (tablePowers.length === 0) return null;

                              return (
                                <div key={tableName} className="flex flex-col gap-2 shrink-0">
                                  {/* Table Section Header Banner */}
                                  <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between shadow-sm shrink-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs font-bold text-amber-300 font-outfit uppercase tracking-wide truncate">
                                        📁 {formatTableNameDisplay(tableName)}
                                      </span>
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800">
                                        {tablePowers.length}
                                      </span>
                                    </div>

                                    {type === 'powers' && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleFavoriteTable(tableName)}
                                        className={`p-1 rounded-lg border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
                                          pinnedTableNames.includes(tableName)
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                                            : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-amber-400'
                                        }`}
                                        title={
                                          pinnedTableNames.includes(tableName)
                                            ? 'Remove table from Quick Deck'
                                            : 'Pin table to Quick Deck'
                                        }
                                      >
                                        <Star
                                          className={`w-3.5 h-3.5 ${
                                            pinnedTableNames.includes(tableName) ? 'fill-amber-400 text-amber-400' : ''
                                          }`}
                                        />
                                      </button>
                                    )}
                                  </div>

                                  {/* Table Powers Cards */}
                                  <div className="flex flex-col gap-2">
                                    {tablePowers.map((item, idx) => {
                                      const { baseName, version } = parseAbilityVersion(item.name);
                                      const actionUpper = (item.action || '').toUpperCase();
                                      const isSpells = type === 'spells';
                                      const rawCost = (item as any).cost;
                                      const itemCostSilver = isSpells ? parseCostToSilver(rawCost) : 0;
                                      const costAbbrev = isSpells ? formatCostAbbreviated(rawCost) : '';

                                      const curGold = sheetData.gold ?? 0;
                                      const curSilver = sheetData.silver ?? 0;
                                      const totalCharSilver = curGold * 100 + curSilver;
                                      const hasFunds = isSpells ? totalCharSilver >= itemCostSilver : true;
                                      const charLevel = sheetData.level || 1;
                                      const itemMinLevel = getKitMinLevel(item);
                                      const isLevelLocked = itemMinLevel > charLevel;

                                      return (
                                        <div
                                          key={item.id || idx}
                                          className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shrink-0 ${
                                            isLevelLocked
                                              ? 'bg-slate-950/40 border-slate-850 opacity-75'
                                              : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/40'
                                          }`}
                                        >
                                          {/* Header Row: Name, Version, Action & Usage (Adjacent), Buttons */}
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-bold text-sm text-slate-100">{baseName}</span>
                                              {type !== 'powers' && (
                                                <ItemNotesPopover notes={(item as any).notes} itemName={baseName} />
                                              )}
                                              {isSpells && (
                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                                                  {((item as any).category || (item as any).tier || 'Minor').replace(/[^\w\s\(\)]/g, '').trim()}
                                                </span>
                                              )}
                                              {isTraitItem(item) && (
                                                <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                                  <span>🧬</span> Trait {itemMinLevel > 1 ? `(Lvl ${itemMinLevel})` : '(Free)'}
                                                </span>
                                              )}
                                              {isLevelLocked && !isTraitItem(item) && (
                                                <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                                                  <span>🔒</span> Lvl {itemMinLevel}
                                                </span>
                                              )}
                                              {version > 1 && (
                                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                                                  v{version}
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              {/* Action & Usage side-by-side */}
                                              <div className="flex items-center gap-1">
                                                {actionUpper && (
                                                  <span
                                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                                      ACTION_COLORS[actionUpper] || 'bg-slate-800'
                                                    }`}
                                                  >
                                                    {actionUpper}
                                                  </span>
                                                )}
                                                {item.usage && (
                                                  <span className="bg-slate-950 text-[10px] font-mono text-amber-300 px-1.5 py-0.5 rounded border border-slate-800">
                                                    {item.usage}
                                                  </span>
                                                )}
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => handleToggleStarItem(item)}
                                                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                                                  isItemStarred(item)
                                                    ? 'text-amber-400'
                                                    : 'text-slate-600 hover:text-amber-400'
                                                }`}
                                                title={
                                                  isItemStarred(item) ? 'Starred Favorite' : 'Star to add to Starred Favorites'
                                                }
                                              >
                                                <Star
                                                  className={`w-3.5 h-3.5 ${
                                                    isItemStarred(item) ? 'fill-amber-400' : ''
                                                  }`}
                                                />
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!isLevelLocked) handleLearnAbility(item);
                                                }}
                                                disabled={isLevelLocked}
                                                className={`px-3 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all shrink-0 ${
                                                  isLevelLocked
                                                    ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed opacity-60'
                                                    : isSpells
                                                    ? hasFunds
                                                      ? 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 cursor-pointer'
                                                      : 'bg-rose-600/30 text-rose-200 border-rose-500/50 hover:bg-rose-600/50 cursor-pointer'
                                                    : isTraitItem(item)
                                                    ? 'bg-emerald-600/40 text-emerald-200 border-emerald-500/60 hover:bg-emerald-600/60 shadow-sm cursor-pointer'
                                                    : 'bg-emerald-600/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-600/50 cursor-pointer'
                                                }`}
                                                title={
                                                  isLevelLocked
                                                    ? `Requires Character Level ${itemMinLevel}`
                                                    : isSpells
                                                    ? hasFunds
                                                      ? `Purchase for ${costAbbrev} and add to Vault`
                                                      : `Insufficient funds! Requires ${costAbbrev} (${itemCostSilver}s). You have ${formatCostAbbreviated(
                                                          totalCharSilver
                                                        )} (${totalCharSilver}s).`
                                                    : isTraitItem(item)
                                                    ? 'Learn Free Starting Trait to Vault'
                                                    : 'Learn Power to Vault'
                                                }
                                              >
                                                {isLevelLocked
                                                  ? `🔒 Lvl ${itemMinLevel}`
                                                  : isSpells
                                                  ? `+ Add to Vault [${costAbbrev}]`
                                                  : isTraitItem(item)
                                                  ? '+ Learn Trait (0 AP)'
                                                  : '+ Learn to Vault'}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Sub-Row: Effect */}
                                          <div className="text-xs text-slate-300 pt-1">
                                            <p className="text-[11px] leading-relaxed font-sans">
                                              {item.effect || 'No description'}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
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

                    {/* TAB 3: VERSION EDITOR VIEW (dynamically visible when pencil icon is clicked) */}
                    {activeRightTab === 'EDITOR' && (
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
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              Version Editor: {versionEditBaseName} v{versionEditNextVersion}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsVersionEditMode(false);
                                setActiveRightTab('CATALOG');
                              }}
                              className="text-slate-400 hover:text-rose-300 text-xs font-bold transition-colors"
                              title="Cancel Version Editing"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-slate-300">Target Version Name</span>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={createName}
                                  readOnly
                                  className="bg-slate-900/90 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-800 outline-none cursor-not-allowed w-full pl-8"
                                />
                                <Lock className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              </div>
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
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
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
                            <Sparkles className="w-4 h-4" />
                            <span>Save & Learn {createName} to Vault</span>
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
                      {type === 'powers' ? '🔥 Powers Manager' : '💍 Loadout Manager'}
                    </span>
                  </div>
                  
                  {/* Standardized Master Blueprint Done Footer Button */}
                  <button 
                    onClick={handleCloseManageModal} 
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

      {/* Main Character Sheet Card View */}
      <div className="flex flex-col gap-2 min-h-[260px]">
        {sortedSlots.length > 0 ? (
          sortedSlots.map((slot, index) => {
            const cleaned = cleanName(slot.name);
            const { baseName, version } = parseAbilityVersion(cleaned);
            const actionUpper = (slot.action || '').toUpperCase();
            const actionClass = ACTION_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
            const usageCount = parseUsageCount(slot.usage);

            const isFullySpent = (() => {
              if (!slot.usage || !slot.usage.includes('Enc')) return false;
              if (usageCount <= 0) return false;
              const checkedCount = (slot.checked || []).filter(Boolean).length;
              return checkedCount >= usageCount;
            })();

            return (
              <div
                key={(slot as any).id || `${slot.name}_${index}`}
                className={`p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all ${
                  isFullySpent ? 'opacity-50 grayscale-[40%]' : ''
                }`}
              >
                {/* 1. Name Column with Version Badge */}
                <div className="w-36 sm:w-44 shrink-0 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-outfit font-bold text-xs text-slate-100 block whitespace-normal break-words leading-tight">
                      {baseName}
                    </span>
                    <ItemNotesPopover notes={slot.notes || (fullCatalog.find((c) => c.name.toLowerCase() === baseName.toLowerCase()) as any)?.notes} itemName={baseName} />
                  </div>
                  {version > 1 && (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 w-fit flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                      v{version}
                    </span>
                  )}
                  {type === 'spells' && (() => {
                    const badge = getMagicItemTierBadge(slot, fullCatalog);
                    if (!badge) return null;
                    return (
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border w-fit flex items-center gap-1 mt-0.5 ${badge.style}`}>
                        <span>{badge.icon}</span>
                        <span>{badge.label}</span>
                        <span className="opacity-90 font-extrabold font-mono">({badge.slotsText})</span>
                      </span>
                    );
                  })()}
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
            {abilityActionFilter !== 'ALL'
              ? `No ${abilityActionFilter} action ${type === 'powers' ? 'powers' : 'loadout items'} learned or visible.`
              : type === 'powers'
              ? 'No powers learned yet. Click "Powers Manager" above to browse the catalog.'
              : 'No loadout items equipped yet. Click "Loadout Manager" above to select abilities.'}
          </div>
        )}
      </div>
    </div>
  );
};
