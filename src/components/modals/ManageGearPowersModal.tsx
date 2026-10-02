// src/components/modals/ManageGearPowersModal.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Zap, Trash2, Pencil, Sparkles, Lock, Plus, ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ItemNotesPopover } from '../common/ItemNotesPopover';
import {
  calculateAvailableAp,
  isGearPowerLearned,
  getLearnedGearPower,
  cleanAbilityName,
  parseAbilityVersion,
  calculateVersionUpgradeCost,
  SimpleGearItem,
  AbilitySlot,
  ApLogEntry,
  FunctionItem,
  ModItem,
  MagicItem,
} from '../../types/game';
import {
  cleanBelongsToName,
  getFunctionsForGearItem,
  getFunctionsForMod,
  isModCompatibleWithItem,
  isModFreeForHost,
  isBelongsToMatch,
  reconcileCharacterVaultWithGear,
} from '../../utils/gearFunctionSync';
import { ACTION_BADGE_COLORS } from '../../utils/lootAbilityResolver';
import { parseCostToSilver, formatCostAbbreviated, deductFundsWithChange } from '../../utils/moneyUtils';
import { gameApi } from '../../services/api';

export type ExoticCategoryFilter = 'all' | 'supplies' | 'weapons' | 'armor' | 'shields';

interface ManageGearPowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetItem?: string | null;
}

const parseUsageCount = (usage?: string): number => {
  if (!usage) return 0;
  const match = usage.trim().match(/^([1-3])/);
  return match ? parseInt(match[1], 10) : 0;
};

const cleanName = (name: string) => (name || '').replace(/^[⭕\s]+/, '').trim();

const MAIN_ABILITY_ICONS = [
  { icon: '💪', label: 'Might' },
  { icon: '🏃', label: 'Agility' },
  { icon: '🧠', label: 'Wit' },
  { icon: '🫀', label: 'Spirit' },
  { icon: '⚡', label: 'Action' },
  { icon: '🛡️', label: 'Armor' },
  { icon: '🎯', label: 'Range' },
  { icon: '💥', label: 'Damage' },
  { icon: '⏱️', label: 'Duration' },
];

const ACTION_OPTIONS = ['AM', 'A', 'M', 'P', 'F'];
const USAGE_OPTIONS = [
  { value: '1-⚡', label: '1-⚡ (Bolt)' },
  { value: '1-🍀', label: '1-🍀 (Luck)' },
  { value: '1-Enc', label: '1-Enc' },
  { value: '2-Enc', label: '2-Enc' },
  { value: '3-Enc', label: '3-Enc' },
  { value: '1-Rnd', label: '1-Rnd' },
];

export const ManageGearPowersModal: React.FC<ManageGearPowersModalProps> = ({
  isOpen,
  onClose,
  initialTargetItem,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<ExoticCategoryFilter>('all');
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});

  // Version Editor Popover Drawer State
  const [isVersionEditorOpen, setIsVersionEditorOpen] = useState(false);
  const [veBaseName, setVeBaseName] = useState('');
  const [veNextVersion, setVeNextVersion] = useState(2);
  const [veTargetPower, setVeTargetPower] = useState<FunctionItem | null>(null);
  const [veHostGearName, setVeHostGearName] = useState('');
  const [veHostModName, setVeHostModName] = useState('');
  const [veAction, setVeAction] = useState('P');
  const [veUsage, setVeUsage] = useState('1-Enc');
  const [veEffect, setVeEffect] = useState('');
  const veEffectRef = useRef<HTMLTextAreaElement>(null);

  const toggleItemExpanded = (key: string) => {
    setCollapsedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const {
    activeCharacter,
    modsCatalog,
    functionsCatalog,
    weaponsCatalog,
    armorCatalog,
    shieldsCatalog,
    learnGearPower,
    unlearnGearPower,
    installModToGearItem,
    uninstallModFromGearItem,
    toggleGearPowerUsage,
    updateActiveSheetData,
    saveActiveCharacter,
    setGearManagerModalOpen,
    exoticGearManagerTargetItem,
  } = useCharacterStore();

  // Self-healing catalogs: ensure functions & mods are populated even if store cache was cold
  const [localFunctions, setLocalFunctions] = useState<FunctionItem[]>(functionsCatalog);
  const [localMods, setLocalMods] = useState<ModItem[]>(modsCatalog);

  useEffect(() => {
    if (functionsCatalog && functionsCatalog.length > 0) {
      setLocalFunctions(functionsCatalog);
    } else {
      gameApi.getGearPowers().then((data) => {
        if (data && data.length > 0) setLocalFunctions(data);
      });
    }
  }, [functionsCatalog]);

  useEffect(() => {
    if (modsCatalog && modsCatalog.length > 0) {
      setLocalMods(modsCatalog);
    } else {
      gameApi.getMods().then((data) => {
        if (data && data.length > 0) setLocalMods(data);
      });
    }
  }, [modsCatalog]);

  const effectiveFunctions = localFunctions.length > 0 ? localFunctions : functionsCatalog;
  const effectiveMods = localMods.length > 0 ? localMods : modsCatalog;

  // Close on Escape key (closes version drawer first if open, else modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isVersionEditorOpen) {
          setIsVersionEditorOpen(false);
        } else {
          handleCloseModal();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isVersionEditorOpen]);

  const handleCloseModal = () => {
    saveActiveCharacter();
    onClose();
  };

  const sheet = activeCharacter?.sheet_data;
  const gold = sheet?.gold || 0;
  const silver = sheet?.silver || 0;
  const totalSilver = gold * 100 + silver;
  const availableAp = sheet ? calculateAvailableAp(sheet.level || 1, sheet) : 0;
  const spellSlots = useMemo(() => (Array.isArray(sheet?.spell_slots) ? sheet.spell_slots : []), [sheet?.spell_slots]);
  const simpleGear = useMemo(() => (Array.isArray(sheet?.simple_gear) ? sheet.simple_gear : []), [sheet?.simple_gear]);

  // Resilient category resolver for host equipment
  const getItemCategoryType = useCallback(
    (item: SimpleGearItem): 'weapon' | 'armor' | 'shield' | 'supplies' => {
      const itemType = (item.item_type || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();

      if (
        itemType === 'weapon' ||
        cat.includes('weapon') ||
        (weaponsCatalog || []).some((w) => cleanBelongsToName(w.name) === cleanBelongsToName(item.name))
      ) {
        return 'weapon';
      }
      if (
        itemType === 'armor' ||
        cat.includes('armor') ||
        (armorCatalog || []).some((a) => cleanBelongsToName(a.name) === cleanBelongsToName(item.name))
      ) {
        return 'armor';
      }
      if (
        itemType === 'shield' ||
        cat.includes('shield') ||
        (shieldsCatalog || []).some((s) => cleanBelongsToName(s.name) === cleanBelongsToName(item.name))
      ) {
        return 'shield';
      }
      return 'supplies';
    },
    [weaponsCatalog, armorCatalog, shieldsCatalog]
  );

  // Drop gear item with AP refund for any learned powers on it
  const handleDropGearItem = (item: SimpleGearItem) => {
    const cleanHost = cleanBelongsToName(item.name);
    const directFns = getFunctionsForGearItem(item.name, effectiveFunctions);
    const directFnNames = new Set(directFns.map((f) => cleanAbilityName(f.name)));

    const compMods = effectiveMods.filter((m) => isModCompatibleWithItem(m, item));
    const modFnNames = new Set<string>();
    compMods.forEach((m) => {
      getFunctionsForMod(m.name, effectiveFunctions).forEach((f) => {
        modFnNames.add(cleanAbilityName(f.name));
      });
    });

    // Determine learned powers rooted in this gear item or installed mods
    const droppedSlots: AbilitySlot[] = [];
    const remainingSlots: AbilitySlot[] = [];

    spellSlots.forEach((slot) => {
      const slotTargetName = cleanAbilityName(slot.name);
      const slotBaseTarget = cleanAbilityName(slot.base_name);
      const slotSourceGearClean = cleanBelongsToName(slot.source_gear);

      const belongsToItem =
        slotSourceGearClean === cleanHost ||
        directFnNames.has(slotTargetName) ||
        directFnNames.has(slotBaseTarget) ||
        modFnNames.has(slotTargetName) ||
        modFnNames.has(slotBaseTarget) ||
        (Boolean((slot as any).source) && cleanBelongsToName((slot as any).source).includes(cleanHost));

      if (belongsToItem) {
        droppedSlots.push(slot);
      } else {
        remainingSlots.push(slot);
      }
    });

    const refundAp = droppedSlots.length;
    const refundEntry: ApLogEntry | null =
      refundAp > 0
        ? {
            id: `refund_gear_powers_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            cost: -refundAp,
            category: 'Exotics',
            description: `Refund ${refundAp} AP from dropped gear: ${item.name}`,
            tier: 'Manual',
            source: item.name,
            timestamp: new Date().toISOString(),
          }
        : null;

    const remainingGear = simpleGear.filter((g) => {
      if (g.id && item.id && g.id === item.id) return false;
      if (cleanBelongsToName(g.name) === cleanHost) return false;
      if (g.name && g.name.endsWith(`(${item.name})`)) return false;
      if (isBelongsToMatch(g.belongs_to, item.name, true)) return false;
      return true;
    });

    updateActiveSheetData((prev) => {
      const intermediateSheet = {
        ...prev,
        simple_gear: remainingGear,
        spell_slots: remainingSlots,
        ap_log: [
          ...(Array.isArray(prev.ap_log) ? prev.ap_log : []),
          ...(refundEntry ? [refundEntry] : []),
        ],
      };
      return reconcileCharacterVaultWithGear(intermediateSheet, effectiveFunctions, effectiveMods).updatedSheet;
    });
    saveActiveCharacter();
  };

  // Purchase unowned physical chassis into simple_gear
  const handleBuyHostItem = (item: SimpleGearItem) => {
    const costStr = item.cost || '1g';
    const costSilver = parseCostToSilver(costStr);
    const deduction = deductFundsWithChange(gold, silver, costSilver);

    if (!deduction.success) {
      alert(
        `Insufficient funds to purchase "${item.name}"!\n\n` +
        `Cost: ${formatCostAbbreviated(costStr)} (${costSilver}s)\n` +
        `Wallet: ${gold}g ${silver}s (${totalSilver}s)\n` +
        `Shortage: ${costSilver - totalSilver}s`
      );
      return;
    }

    const newPhysicalItem: SimpleGearItem = {
      id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: item.name,
      qty: 1,
      cost: costStr,
      category: item.category || (item.item_type === 'weapon' ? 'Weapons' : item.item_type === 'armor' ? 'Armor' : item.item_type === 'shield' ? 'Shields' : 'Gear'),
      item_type: item.item_type || 'gear',
      notes: item.notes,
      installed_mods: item.installed_mods || [],
    };

    updateActiveSheetData((prev) => {
      const intermediateSheet = {
        ...prev,
        gold: deduction.newGold,
        silver: deduction.newSilver,
        simple_gear: [...(prev.simple_gear || []), newPhysicalItem],
      };
      return reconcileCharacterVaultWithGear(intermediateSheet, effectiveFunctions, effectiveMods).updatedSheet;
    });
    saveActiveCharacter();
  };

  // Buy and install mod to gear item
  const handleBuyMod = (mod: ModItem, hostName: string) => {
    const res = installModToGearItem(mod, hostName);
    if (!res.success) {
      alert(res.error || 'Failed to install mod.');
    }
  };

  // Uninstall mod with AP refund for its learned powers (0 silver refund)
  const handleUninstallMod = (modName: string, hostName: string) => {
    const res = uninstallModFromGearItem(modName, hostName);
    if (!res.success) {
      alert(res.error || 'Failed to uninstall mod.');
    }
  };

  // Learn 1-AP combat power
  const handleLearnPower = (fn: FunctionItem, hostName: string, modName?: string) => {
    learnGearPower(fn, hostName, modName);
  };

  // Unlearn combat power and refund 1 AP
  const handleUnlearnPower = (powerName: string) => {
    unlearnGearPower(powerName);
  };

  // Open Version Editor popover drawer
  const handleOpenVersionEditor = (fn: FunctionItem, hostGearName: string, modName?: string) => {
    const cleaned = cleanName(fn.name);
    const { baseName, version: parsedVer } = parseAbilityVersion(cleaned);
    const learnedSlot = getLearnedGearPower(fn.name, spellSlots);
    const currentVer = Math.max(parsedVer, learnedSlot?.version || 1);
    const nextVer = currentVer + 1;

    setVeBaseName(baseName);
    setVeNextVersion(nextVer);
    setVeTargetPower(fn);
    setVeHostGearName(hostGearName);
    setVeHostModName(modName || '');
    setVeAction((fn.action || 'P').toUpperCase());
    setVeUsage(fn.usage || '1-Enc');
    setVeEffect(fn.effect || '');
    setIsVersionEditorOpen(true);
  };

  const insertIconAtCursor = (iconStr: string) => {
    const textarea = veEffectRef.current;
    if (!textarea) {
      setVeEffect((prev) => (prev ? prev + ' ' + iconStr : iconStr));
      return;
    }
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const updated = veEffect.substring(0, start) + iconStr + veEffect.substring(end);
    setVeEffect(updated);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + iconStr.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  // Save Version Editor upgrade (deducts (veNextVersion - 1) AP, writes to spell_slots and custom_magic_items)
  const handleSaveVersion = (e: React.FormEvent) => {
    e.preventDefault();
    const versionCost = calculateVersionUpgradeCost(veNextVersion);
    if (!veBaseName || availableAp < versionCost) return;

    const versionedName = `${veBaseName} v${veNextVersion}`;
    const newVaultItem: MagicItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: versionedName,
      base_name: veBaseName,
      version: veNextVersion,
      action: (veAction.toUpperCase() as any) || 'P',
      usage: veUsage,
      effect: veEffect.trim(),
      notes: veTargetPower?.notes || '',
      source: 'Custom Exotic Power Version',
      source_gear: veHostGearName,
      source_mod: veHostModName,
      category: 'Exotics',
      is_hardware: true,
      slot_weight: 1,
      checked_state: [false, false, false],
      created_at: new Date().toISOString(),
    };

    const newSlot: AbilitySlot = {
      select: true,
      name: versionedName,
      base_name: veBaseName,
      version: veNextVersion,
      action: (veAction.toUpperCase() as any) || 'P',
      usage: veUsage,
      effect: veEffect.trim(),
      checked: [false, false, false],
      notes: veTargetPower?.notes || '',
      source_gear: veHostGearName,
      source_mod: veHostModName,
      ap_cost: versionCost,
    };

    updateActiveSheetData((prev) => {
      const prevSlots = Array.isArray(prev.spell_slots) ? [...prev.spell_slots] : [];
      const prevCustom = Array.isArray(prev.custom_magic_items) ? [...prev.custom_magic_items] : [];

      const existingIdx = prevSlots.findIndex((s) => {
        const sBase = parseAbilityVersion((s as any).base_name || s.name).baseName.toLowerCase();
        return sBase === veBaseName.toLowerCase();
      });
      if (existingIdx >= 0) {
        prevSlots[existingIdx] = { ...prevSlots[existingIdx], ...newSlot };
      } else {
        prevSlots.push(newSlot);
      }

      const logEntry: ApLogEntry = {
        id: String(Date.now()),
        category: 'Exotics',
        description: `Created & Learned ${versionedName} (+${versionCost} AP)`,
        source: veHostGearName,
        tier: 1,
        cost: versionCost,
        timestamp: new Date().toISOString(),
      };

      return {
        ...prev,
        spell_slots: prevSlots,
        custom_magic_items: [...prevCustom, newVaultItem],
        ap_log: [...(Array.isArray(prev.ap_log) ? prev.ap_log : []), logEntry],
      };
    });

    saveActiveCharacter();
    setIsVersionEditorOpen(false);
  };

  // Candidate host items aggregated from simple_gear + learned weapons + learned armor + learned shields
  const candidateItems = useMemo(() => {
    interface ExoticHostItem extends SimpleGearItem {
      isHostOwned: boolean;
    }

    const pool: ExoticHostItem[] = [];
    const seen = new Set<string>();

    // 1. Physically owned gear in simple_gear
    simpleGear.forEach((g) => {
      if (!g || !g.name) return;
      const cleanBase = cleanBelongsToName(g.name.replace(/\s*\[[MHS]\]$/i, '').trim());
      seen.add(cleanBase);
      pool.push({
        ...g,
        isHostOwned: true,
      });
    });

    // 2. Learned weapons in sheet.weapons
    const learnedWeapons = Array.isArray(sheet?.weapons) ? sheet.weapons : [];
    learnedWeapons.forEach((w) => {
      if (!w || !w.name) return;
      const baseName = w.name.replace(/\s*\[[MHS]\]$/i, '').trim();
      const cleanBase = cleanBelongsToName(baseName);
      if (seen.has(cleanBase)) return;
      seen.add(cleanBase);

      const stock = (weaponsCatalog || []).find(
        (sw) => cleanBelongsToName(sw.name) === cleanBase
      );
      pool.push({
        id: `learned_weapon_${w.id || baseName}`,
        name: baseName,
        cost: w.cost || stock?.cost || '1g',
        notes: w.notes || stock?.notes,
        item_type: 'weapon',
        category: 'Weapons',
        qty: 0,
        isHostOwned: false,
      });
    });

    // 3. Learned armor in sheet.wardrobe
    const learnedArmor = Array.isArray(sheet?.wardrobe) ? sheet.wardrobe : [];
    learnedArmor.forEach((a) => {
      if (!a || !a.name) return;
      const cleanBase = cleanBelongsToName(a.name);
      if (seen.has(cleanBase)) return;
      seen.add(cleanBase);

      const stock = (armorCatalog || []).find(
        (sa) => cleanBelongsToName(sa.name) === cleanBase
      );
      pool.push({
        id: `learned_armor_${a.id || a.name}`,
        name: a.name,
        cost: a.cost || stock?.cost || '1g',
        notes: a.notes || stock?.notes,
        item_type: 'armor',
        category: 'Armor',
        qty: 0,
        isHostOwned: false,
      });
    });

    // 4. Learned shields in sheet.armory
    const learnedShields = Array.isArray(sheet?.armory) ? sheet.armory : [];
    learnedShields.forEach((s) => {
      if (!s || !s.name) return;
      const cleanBase = cleanBelongsToName(s.name);
      if (seen.has(cleanBase)) return;
      seen.add(cleanBase);

      const stock = (shieldsCatalog || []).find(
        (ss) => cleanBelongsToName(ss.name) === cleanBase
      );
      pool.push({
        id: `learned_shield_${s.id || s.name}`,
        name: s.name,
        cost: s.cost || stock?.cost || '1g',
        notes: s.notes || stock?.notes,
        item_type: 'shield',
        category: 'Shields',
        qty: 0,
        isHostOwned: false,
      });
    });

    return pool;
  }, [simpleGear, sheet?.weapons, sheet?.wardrobe, sheet?.armory, weaponsCatalog, armorCatalog, shieldsCatalog]);

  // Filter candidate gear to all exotic gear (gear with direct functions, compatible mods, or installed mods)
  const exoticGearItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return candidateItems
      .filter((item) => {
        const hostName = item.name || '';
        const cleanHost = cleanBelongsToName(hostName);
        const directFns = getFunctionsForGearItem(hostName, effectiveFunctions);
        const compMods = effectiveMods.filter((m) => isModCompatibleWithItem(m, item));
        const hasInstalledMods = Array.isArray(item.installed_mods) && item.installed_mods.length > 0;
        const hasLearnedSlot = spellSlots.some((s) => cleanBelongsToName(s.source_gear) === cleanHost);

        // Must have at least 1 mod (compatible or installed) or 1 exotic power
        const hasModsOrPowers = directFns.length > 0 || compMods.length > 0 || hasInstalledMods || hasLearnedSlot;
        if (!hasModsOrPowers) return false;

        // Category Tab filter check
        if (activeCategoryFilter !== 'all') {
          const catType = getItemCategoryType(item);
          if (activeCategoryFilter === 'weapons' && catType !== 'weapon') return false;
          if (activeCategoryFilter === 'armor' && catType !== 'armor') return false;
          if (activeCategoryFilter === 'shields' && catType !== 'shield') return false;
          if (activeCategoryFilter === 'supplies' && catType !== 'supplies') return false;
        }

        if (query) {
          const matchesHost = hostName.toLowerCase().includes(query);
          const matchesMod = compMods.some((m) => m.name.toLowerCase().includes(query));
          const matchesDirectFn = directFns.some((f) => f.name.toLowerCase().includes(query) || (f.effect || '').toLowerCase().includes(query));
          const matchesModFn = compMods.flatMap((m) => getFunctionsForMod(m.name, effectiveFunctions)).some((f) => f.name.toLowerCase().includes(query) || (f.effect || '').toLowerCase().includes(query));
          if (!matchesHost && !matchesMod && !matchesDirectFn && !matchesModFn) return false;
        }

        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [candidateItems, searchQuery, activeCategoryFilter, getItemCategoryType, effectiveMods, effectiveFunctions, spellSlots]);

  const targetItem = initialTargetItem || exoticGearManagerTargetItem;

  const resetAllExoticsFilters = useCallback(() => {
    setSearchQuery('');
    setActiveCategoryFilter('all');
  }, []);

  // Reset filters whenever Exotics Manager freshly opens to eliminate filter traps
  useEffect(() => {
    if (isOpen) {
      if (!targetItem) {
        resetAllExoticsFilters();
      } else {
        setSearchQuery('');
      }
    }
  }, [isOpen, targetItem, resetAllExoticsFilters]);

  // Auto-expand and scroll to target item when modal opens, auto-switching category if needed
  useEffect(() => {
    if (!isOpen || !targetItem) return;
    const cleanTarget = cleanBelongsToName(targetItem.replace(/\s*\[[MHS]\]$/i, '').trim());

    // If target item is filtered out by current activeCategoryFilter, auto-switch to its category
    const candidateMatch = candidateItems.find(
      (g) => cleanBelongsToName(g.name.replace(/\s*\[[MHS]\]$/i, '').trim()) === cleanTarget || g.id === targetItem
    );
    if (candidateMatch) {
      const targetCat = getItemCategoryType(candidateMatch);
      const isMismatch =
        (activeCategoryFilter === 'weapons' && targetCat !== 'weapon') ||
        (activeCategoryFilter === 'armor' && targetCat !== 'armor') ||
        (activeCategoryFilter === 'shields' && targetCat !== 'shield') ||
        (activeCategoryFilter === 'supplies' && targetCat !== 'supplies');
      if (isMismatch) {
        setActiveCategoryFilter(
          targetCat === 'weapon' ? 'weapons' : targetCat === 'armor' ? 'armor' : targetCat === 'shield' ? 'shields' : 'supplies'
        );
      }
    }

    const matched = exoticGearItems.find(
      (g) => cleanBelongsToName(g.name.replace(/\s*\[[MHS]\]$/i, '').trim()) === cleanTarget || g.id === targetItem
    );
    if (!matched) return;

    const itemKey = matched.id || matched.name;
    setCollapsedItems((prev) => ({ ...prev, [itemKey]: false }));

    const domId = `exotic-item-${(matched.name || matched.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const timer = setTimeout(() => {
      const el = document.getElementById(domId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [isOpen, targetItem, exoticGearItems, candidateItems, activeCategoryFilter, getItemCategoryType]);

  // Render individual power card
  const renderPowerCard = (
    fn: FunctionItem,
    hostName: string,
    modName?: string,
    isHostModInstalled: boolean = true,
    isHostOwned: boolean = true
  ) => {
    const cleaned = cleanName(fn.name);
    const { baseName, version: nameVersion } = parseAbilityVersion(cleaned);
    const isLearned = isGearPowerLearned(fn.name, spellSlots);
    const learnedSlot = getLearnedGearPower(fn.name, spellSlots);
    const version = Math.max(nameVersion, learnedSlot?.version || 1);
    const actionUpper = (fn.action || '').toUpperCase();
    const actionClass = ACTION_BADGE_COLORS[actionUpper] || 'bg-slate-800 text-slate-400 border-slate-700';
    const usageCount = parseUsageCount(fn.usage);

    const isFullySpent = (() => {
      if (!fn.usage || !fn.usage.includes('Enc')) return false;
      if (usageCount <= 0) return false;
      const checkedCount = (learnedSlot?.checked || []).filter(Boolean).length;
      return checkedCount >= usageCount;
    })();

    return (
      <div
        key={fn.id || fn.name}
        className={`p-3 bg-slate-950/60 rounded-xl border border-slate-850 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm hover:border-slate-800 transition-all ${
          isFullySpent ? 'opacity-50 grayscale-[40%]' : ''
        }`}
      >
        {/* 1. Name Column with Version Badge */}
        <div className="w-32 sm:w-40 md:w-48 shrink-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-outfit font-bold text-xs leading-tight text-slate-100">
              {baseName}
            </span>
            {fn.notes && fn.notes.trim() ? (
              <ItemNotesPopover notes={fn.notes} itemName={baseName} inline />
            ) : null}
          </div>
          {version > 1 && (
            <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40 w-fit flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
              v{version}
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
          {fn.usage ? (
            <span
              className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 truncate"
              title={fn.usage}
            >
              {fn.usage}
            </span>
          ) : (
            <span className="text-[10px] text-slate-700 font-mono">-</span>
          )}
        </div>

        {/* 4. Checkboxes Column */}
        <div className="w-16 shrink-0 flex items-center gap-1 min-w-[64px]">
          {usageCount > 0 ? (
            Array.from({ length: usageCount }).map((_, bIdx) => {
              const isChecked = !!(learnedSlot?.checked && learnedSlot.checked[bIdx]);
              return (
                <input
                  key={bIdx}
                  type="checkbox"
                  checked={isChecked}
                  disabled={!isLearned}
                  onChange={() => toggleGearPowerUsage(fn.name, bIdx)}
                  className={`w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-500 focus:ring-0 ${
                    isLearned ? 'cursor-pointer accent-indigo-500' : 'cursor-not-allowed opacity-40'
                  }`}
                  title={isLearned ? `Usage slot ${bIdx + 1}` : 'Power must be learned first'}
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
            {fn.effect || 'No effect description'}
          </p>
        </div>

        {/* 6. Action & Status Column */}
        <div className="shrink-0 flex items-center gap-2 justify-end min-w-[140px]">
          {isLearned ? (
            <>
              {/* Gold Known Badge */}
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/50 font-mono font-bold text-[10px] shadow-sm select-none">
                Known
              </span>

              {/* Version Editor Trigger Pencil */}
              <button
                type="button"
                onClick={() => handleOpenVersionEditor(fn, hostName, modName)}
                className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/60 border border-transparent hover:border-cyan-500/40 rounded-lg transition-all cursor-pointer shadow-sm"
                title={`Open Version Editor for ${baseName}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              {/* Unlearn Power Trashcan */}
              <button
                type="button"
                onClick={() => handleUnlearnPower(fn.name)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 border border-transparent hover:border-rose-500/40 rounded-lg transition-all cursor-pointer shadow-sm"
                title={`Unlearn ${fn.name} (refunds 1 AP)`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {!isHostOwned ? (
                /* Disabled Learn Button (Must own physical gear first) */
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800/60 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-50 flex items-center gap-1"
                  title={`Must own physical ${hostName} in Gear to learn powers`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Learn (1 AP)</span>
                </button>
              ) : isHostModInstalled ? (
                <>
                  {/* Green + Learn (1 AP) Button */}
                  <button
                    type="button"
                    onClick={() => handleLearnPower(fn, hostName, modName)}
                    disabled={availableAp < 1}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                      availableAp >= 1
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 cursor-pointer shadow-emerald-950/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                    }`}
                    title={availableAp >= 1 ? `Learn ${baseName} (1 AP)` : 'Insufficient AP (1 AP required)'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Learn (1 AP)</span>
                  </button>

                  {/* Version Editor Trigger Pencil */}
                  <button
                    type="button"
                    onClick={() => handleOpenVersionEditor(fn, hostName, modName)}
                    className="p-1.5 text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/60 border border-transparent hover:border-cyan-500/40 rounded-lg transition-all cursor-pointer shadow-sm"
                    title={`Open Version Editor for ${baseName}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                /* Disabled Learn Button (Mod must be installed first) */
                <button
                  type="button"
                  disabled
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800/60 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-50 flex items-center gap-1"
                  title={`Requires ${modName || 'mod'} to be installed first`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Learn (1 AP)</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        ref={modalRef}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] max-h-[820px] flex flex-col shadow-2xl overflow-hidden text-left relative"
      >
        {/* ================= 1. MODAL TOP BAR ================= */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              <span className="text-xl leading-none">🧿</span>
            </div>
            <div>
              <h3 className="font-outfit font-black text-base text-slate-100 uppercase tracking-wide">
                Exotics Manager
              </h3>
              <p className="text-xs text-slate-400">
                Manage your owned exotic chassis, buy compatible mods, and learn 1-AP combat powers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* AP Available Pill */}
            <div className="px-3 py-1 bg-amber-950/60 border border-amber-500/50 rounded-xl font-mono font-black text-xs text-amber-300 shadow-sm flex items-center justify-center shrink-0">
              ⚡ AP {availableAp}
            </div>

            {/* Funds Pill */}
            <div className="px-3 py-1 bg-teal-950/60 border border-teal-500/40 rounded-xl font-mono font-bold text-xs text-teal-300 shadow-sm flex items-center justify-center shrink-0">
              💰 {gold}g {silver}s
            </div>

            {/* Close X */}
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-all shrink-0 cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 2. SINGLE LARGE PANE BODY ================= */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0 relative">
          {/* Search Filter & Buy Gear Shortcut */}
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter exotic gear, mods, or powers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/90 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-800 text-white outline-none focus:border-cyan-500 transition-all placeholder:text-slate-500 shadow-inner"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                handleCloseModal();
                setGearManagerModalOpen(true);
              }}
              className="px-3 py-2 bg-teal-950/90 hover:bg-teal-900/90 border border-teal-500/50 hover:border-teal-400 text-teal-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 group"
              title="Open Gear Manager to purchase standard and exotic gear"
            >
              <span className="text-sm leading-none group-hover:rotate-12 transition-transform">⚙️</span>
              <span className="font-outfit uppercase tracking-wider text-[11px] font-extrabold">Buy Gear</span>
            </button>
          </div>

          {/* 2. Category Multi-Option Pill Switch (5 Tabs: All, Supplies, Weapons, Armor, Shields) */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md mb-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('all')}
              className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeCategoryFilter === 'all'
                  ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🌐 All
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('supplies')}
              className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeCategoryFilter === 'supplies'
                  ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🎒 Supplies
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('weapons')}
              className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeCategoryFilter === 'weapons'
                  ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              ⚔️ Weapons
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('armor')}
              className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeCategoryFilter === 'armor'
                  ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🥋 Armor
            </button>
            <button
              type="button"
              onClick={() => setActiveCategoryFilter('shields')}
              className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                activeCategoryFilter === 'shields'
                  ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🛡️ Shields
            </button>
          </div>

          {/* Scrollable Gear Chassis & Mods Tree */}
          <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 min-h-0">
            {exoticGearItems.length > 0 ? (
              exoticGearItems.map((item) => {
                const hostName = item.name || '';
                const itemKey = item.id || item.name;
                const isExpanded = !collapsedItems[itemKey];
                const domId = `exotic-item-${(item.name || item.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                // Direct inherent functions
                const directFns = getFunctionsForGearItem(hostName, effectiveFunctions).sort((a, b) =>
                  (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                );

                // Compatible mods
                const compMods = effectiveMods
                  .filter((m) => isModCompatibleWithItem(m, item))
                  .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

                // Installed & Removed mods resolution
                const installedModsSet = new Set<string>();
                compMods.forEach((m) => {
                  if (isModFreeForHost(m, hostName)) {
                    installedModsSet.add(cleanBelongsToName(m.name));
                  }
                });
                if (Array.isArray(item.installed_mods)) {
                  item.installed_mods.forEach((modName: string) => {
                    installedModsSet.add(cleanBelongsToName(modName));
                  });
                }
                if (Array.isArray(item.removed_mods)) {
                  item.removed_mods.forEach((modName: string) => {
                    installedModsSet.delete(cleanBelongsToName(modName));
                  });
                }

                return (
                  <div key={itemKey} id={domId} className="flex flex-col gap-2 pb-3 border-b border-slate-800/50 last:border-none scroll-mt-2">
                    {/* Gear Item Header Row: Compact w-fit Pill + Ownership badge / Buy button / Drop Chassis Trashcan */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => toggleItemExpanded(itemKey)}
                        className={`w-fit inline-flex items-center gap-2 py-1.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none group ${
                          item.isHostOwned
                            ? 'bg-cyan-950/90 hover:bg-cyan-900/90 border-cyan-500/60 hover:border-cyan-400 text-cyan-100 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                            : 'bg-slate-950/90 hover:bg-slate-900/90 border-amber-500/50 hover:border-amber-400 text-slate-200'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {item.notes && item.notes.trim() ? (
                          <ItemNotesPopover notes={item.notes} itemName={item.name} inline />
                        ) : null}
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-200 transition-transform shrink-0 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {!item.isHostOwned ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/50 font-mono font-bold text-[10px] shadow-sm select-none flex items-center gap-1">
                            <span>⚠️</span>
                            <span>Unowned in Gear</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => handleBuyHostItem(item)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 cursor-pointer shadow-emerald-950/30"
                            title={`Buy physical copy of ${item.name} for ${formatCostAbbreviated(item.cost || '1g')}`}
                          >
                            <span>🪙</span>
                            <span>Buy {formatCostAbbreviated(item.cost || '1g')}</span>
                          </button>
                        </div>
                      ) : (
                        /* Drop Chassis Trashcan */
                        <button
                          type="button"
                          onClick={() => handleDropGearItem(item)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 border border-transparent hover:border-rose-500/40 rounded-lg transition-all cursor-pointer shadow-sm"
                          title={`Delete ${item.name} (removes chassis and all mods/powers, refunds all AP spent on powers)`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Dropdown Contents: Vertical Guide Line from Gear Item down across all Mods */}
                    {isExpanded && (
                      <div className="ml-8 sm:ml-9 pl-4 sm:pl-5 border-l-2 border-cyan-500/40 flex flex-col gap-3.5 pt-1.5 pb-1">
                        {/* LEVEL 1: Inherent Chassis Powers (No Mod) */}
                        {directFns.length > 0 && (
                          <div className="flex flex-col gap-2">
                            {/* Mod Header: Inherent (No Mod) in Warm Amber + Inline Installed Badge */}
                            <div className="flex items-center gap-2.5 py-0.5">
                              <span className="text-xs font-bold text-amber-300 font-mono tracking-wide">
                                Inherent (No Mod)
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/50 font-mono font-bold text-[10px] shadow-sm select-none">
                                Installed
                              </span>
                            </div>

                            {/* Indented Power Cards (left border under 'h' in Inherent) */}
                            <div className="flex flex-col gap-2 pl-3.5 sm:pl-4">
                              {directFns.map((fn) => renderPowerCard(fn, hostName, undefined, true, item.isHostOwned))}
                            </div>
                          </div>
                        )}

                        {/* LEVEL 1: Compatible Mods */}
                        {compMods.map((mod) => {
                          const isInstalled = installedModsSet.has(cleanBelongsToName(mod.name));
                          const modCostSilver = parseCostToSilver(mod.cost);
                          const costFormatted = formatCostAbbreviated(mod.cost || '0s');
                          const canAfford = totalSilver >= modCostSilver;

                          const modFns = getFunctionsForMod(mod.name, effectiveFunctions).sort((a, b) =>
                            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
                          );

                          return (
                            <div key={mod.id || mod.name} className="flex flex-col gap-2">
                              {/* Mod Header Row: Inline Name, ℹ️, and Action Elements */}
                              <div className="flex items-center gap-2.5 py-0.5 flex-wrap">
                                <span className="text-xs font-bold text-amber-300 font-mono tracking-wide">
                                  {mod.name}
                                </span>
                                {mod.notes && mod.notes.trim() ? (
                                  <ItemNotesPopover notes={mod.notes} itemName={mod.name} inline />
                                ) : null}

                                {isInstalled ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    {/* Gold Installed Badge */}
                                    <span className="px-2 py-0.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/50 font-mono font-bold text-[10px] shadow-sm select-none">
                                      Installed
                                    </span>

                                    {/* Uninstall Mod Trashcan */}
                                    <button
                                      type="button"
                                      onClick={() => handleUninstallMod(mod.name, hostName)}
                                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 border border-transparent hover:border-rose-500/40 rounded-lg transition-all cursor-pointer shadow-sm"
                                      title={`Remove ${mod.name} (uninstalls mod, unlearns its powers, refunds AP)`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  /* Green + Buy [price] Button */
                                  <button
                                    type="button"
                                    onClick={() => handleBuyMod(mod, hostName)}
                                    disabled={!item.isHostOwned || !canAfford}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm ${
                                      item.isHostOwned && canAfford
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 cursor-pointer shadow-emerald-950/30'
                                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                                    }`}
                                    title={
                                      !item.isHostOwned
                                        ? `Must own physical ${hostName} in Gear to install mods`
                                        : canAfford
                                        ? `Buy and install ${mod.name} for ${costFormatted}`
                                        : `Insufficient funds (Requires ${costFormatted}, you have ${gold}g ${silver}s)`
                                    }
                                  >
                                    {!item.isHostOwned ? <Lock className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                    <span>Buy {costFormatted}</span>
                                  </button>
                                )}
                              </div>

                              {/* Indented Power Cards under this Mod */}
                              {modFns.length > 0 && (
                                <div className="flex flex-col gap-2 pl-3.5 sm:pl-4">
                                  {modFns.map((fn) => renderPowerCard(fn, hostName, mod.name, isInstalled, item.isHostOwned))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <Zap className="w-10 h-10 text-slate-600 mb-3 opacity-40" />
                <p className="font-bold text-sm text-slate-300">
                  {activeCategoryFilter !== 'all'
                    ? `No Exotic ${activeCategoryFilter.charAt(0).toUpperCase() + activeCategoryFilter.slice(1)} Found`
                    : 'No Exotic Gear Found'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  {activeCategoryFilter !== 'all'
                    ? `No owned or learned ${activeCategoryFilter} with tactical exotic powers or compatible mods were found.`
                    : 'No owned or learned weapons, armor, or gear items with tactical exotic powers or compatible mods were found matching your filter.'}
                </p>
                {(activeCategoryFilter !== 'all' || searchQuery) && (
                  <button
                    type="button"
                    onClick={resetAllExoticsFilters}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    🌐 Reset All Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ================= 3. RIGHT-HALF VERSION EDITOR POPOVER DRAWER ================= */}
          {isVersionEditorOpen && (
            <div className="absolute right-0 top-0 bottom-0 w-full md:w-1/2 bg-slate-900/98 border-l border-slate-800 shadow-2xl z-30 flex flex-col p-4 backdrop-blur-md animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Version Editor: {veBaseName} v{veNextVersion}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVersionEditorOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-rose-300 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Cancel Version Editing"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveVersion} className="flex-1 flex flex-col gap-3 pt-3 overflow-y-auto min-h-0">
                {/* Target Version Name Field */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-slate-300">Target Version Name</span>
                  <div className="relative">
                    <input
                      type="text"
                      value={`${veBaseName} v${veNextVersion}`}
                      readOnly
                      className="bg-slate-950/90 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-800 outline-none cursor-not-allowed w-full pl-8 shadow-inner"
                    />
                    <Lock className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Action & Usage Selectors */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300 shrink-0">Action:</span>
                    <select
                      value={veAction}
                      onChange={(e) => setVeAction(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none w-full cursor-pointer"
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300 shrink-0">Usage:</span>
                    <select
                      value={veUsage}
                      onChange={(e) => setVeUsage(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-2 py-1 rounded-lg outline-none w-full cursor-pointer"
                    >
                      {USAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Effect Description with Inline Icon Buttons */}
                <div className="flex flex-col gap-1 flex-1 min-h-[140px]">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-xs font-bold text-slate-300">Effect Description</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold mr-0.5">Insert:</span>
                      {MAIN_ABILITY_ICONS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => insertIconAtCursor(item.icon)}
                          className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                          title={`Insert ${item.icon} (${item.label}) at cursor`}
                        >
                          <span>{item.icon}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    ref={veEffectRef}
                    value={veEffect}
                    onChange={(e) => setVeEffect(e.target.value)}
                    rows={6}
                    className="flex-1 bg-slate-950 text-slate-100 text-xs p-3 rounded-lg border border-slate-700 outline-none focus:border-amber-400 resize-none font-sans leading-relaxed shadow-inner"
                    placeholder="Enter customized rules and effect..."
                    required
                  />
                </div>

                {/* Save & Learn Action Button */}
                {(() => {
                  const versionCost = calculateVersionUpgradeCost(veNextVersion);
                  return (
                    <button
                      type="submit"
                      disabled={availableAp < versionCost}
                      className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shrink-0 ${
                        availableAp < versionCost
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-950/40 border border-emerald-400/50'
                      }`}
                      title={
                        availableAp < versionCost
                          ? `Insufficient AP (${versionCost} AP required to create version)`
                          : `Save & Learn ${veBaseName} v${veNextVersion} (${versionCost} AP)`
                      }
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {availableAp < versionCost
                          ? `Insufficient AP (${availableAp} AP / ${versionCost} AP required)`
                          : `Save & Learn ${veBaseName} v${veNextVersion} (${versionCost} AP)`}
                      </span>
                    </button>
                  );
                })()}
              </form>
            </div>
          )}
        </div>

        {/* ================= 4. MODAL FOOTER ================= */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
