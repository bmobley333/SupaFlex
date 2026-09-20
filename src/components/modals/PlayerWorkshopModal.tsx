// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Forge: Master Modal Blueprint 2-Pane Architecture (Live Preview + Forge Controls)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Check, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem, CustomCreationData } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';
import { InfoTooltip } from '../common/InfoTooltip';
import { compareMsoOptions } from '../../utils/kitUtils';

interface PlayerWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSaved?: () => void;
  onOpenWorkshop?: () => void;
  initialItem?: CustomCreationItem | null;
}

// Canonical SupaFlex Rules Constants
const ACTION_OPTIONS = [
  { id: 'AM', label: 'AM (Attack & Move)' },
  { id: 'A', label: 'A (Attack)' },
  { id: 'M', label: 'M (Move)' },
  { id: 'P', label: 'P (Partial)' },
  { id: 'F', label: 'F (Free)' },
];

const USAGE_OPTIONS = [
  { id: '1-🍀', label: '1-🍀 (1-Luck)' },
  { id: '1-⚡', label: '1-⚡ (1-Bolt)' },
  { id: '1-Enc', label: '1-Enc (1/Encounter)' },
  { id: '2-Enc', label: '2-Enc (2/Encounter)' },
  { id: '3-Enc', label: '3-Enc (3/Encounter - Max)' },
  { id: '1-Rnd', label: '1-Rnd (1/Round)' },
];

// 7 Canonical Range Bands
const RANGE_BANDS = [
  { id: 'Touch', label: 'Touch', text: 'Rng Touch; ' },
  { id: '1sq', label: '1sq', text: 'Rng 1sq; ' },
  { id: '2sq', label: '2sq', text: 'Rng 2sq; ' },
  { id: 'Short', label: 'Short (≤6sq)', text: 'Rng Short; ' },
  { id: 'Medium', label: 'Medium (≤12sq)', text: 'Rng Medium; ' },
  { id: 'Long', label: 'Long (≤24sq)', text: 'Rng Long; ' },
  { id: 'Extreme', label: 'Extreme (≥25sq)', text: 'Rng Extreme; ' },
];

// Canonical AoE Formats
const AOE_PRESETS = [
  { id: 'AoE 1r', text: 'AoE 1r; ' },
  { id: 'AoE 2r', text: 'AoE 2r; ' },
  { id: 'AoE 3r', text: 'AoE 3r; ' },
  { id: 'AoE 2x2', text: 'AoE 2x2; ' },
  { id: 'AoE 3x3', text: 'AoE 3x3; ' },
];

// Attributes Without Labels per Directive
const ATTRIBUTE_CHIPS = ['✨', '💪', '👁️', '🏃', '🫀', '👣'];

const POWER_READY_CATEGORIES = [
  { id: 'primary_arsenal', label: 'Primary / Arsenal', icon: '⚔️' },
  { id: 'mobility_defense', label: 'Mobility & Defense', icon: '🛡️' },
  { id: 'support_passive', label: 'Support & Passives', icon: '✨' },
];

const GENRE_OPTIONS = [
  { id: 'Medieval', label: 'Medieval', icon: '🏰' },
  { id: 'Modern', label: 'Modern', icon: '🏙️' },
  { id: 'SciFi', label: 'SciFi', icon: '🚀' },
];

const WEAPON_REQ_NUMBERS = [4, 6, 8, 10, 12];
const ARMOR_REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];
const SHIELD_REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];

const GEAR_DEFAULT_CATEGORIES = [
  'Adventure',
  'Clothing',
  'Containers',
  'General',
  'Lighting',
  'Lodging',
  'Medical',
  'Provisions',
  'Storage',
  'Survival',
  'Tools',
];

const KIT_DEFAULT_CATEGORIES = [
  'Medical',
  'Survival',
  'Tools',
  'Engineering',
  'Infiltration',
  'General',
];

const PATH_CATEGORIES = ['Race', 'Class', 'Origin', 'General'];

const getWeaponAtkDmg = (typeMode: string): string => {
  if (typeMode === 'Melee, Hurled') return '💪, 🏃';
  if (typeMode === 'Hurled') return '🏃';
  if (typeMode === 'Shot') return '👁️';
  return '💪';
};

const getWeaponMaxBlock = (typeMode: string, reqNum: number): string => {
  if (typeMode.includes('Melee')) {
    return `🛡️${reqNum * 2}`;
  }
  return 'n/a';
};

const getArmorArStr = (req: string): string => {
  if (req.includes('12')) return '12';
  if (req.includes('10')) return '10';
  if (req.includes('8')) return '8';
  if (req.includes('6')) return '6';
  return '4';
};

const getArmorMrStr = (req: string): string => {
  if (req.includes('12')) return '-2';
  if (req.includes('10')) return '-2';
  if (req.includes('8')) return '-1';
  if (req.includes('6')) return '-1';
  return '-0';
};

const getShieldMaxBlockStr = (req: string): string => {
  if (req.includes('12')) return '12';
  if (req.includes('10')) return '10';
  if (req.includes('8')) return '8';
  if (req.includes('6')) return '6';
  return '4';
};

const getShieldMrStr = (req: string): string => {
  if (req.includes('12')) return '-2';
  if (req.includes('10')) return '-2';
  if (req.includes('8')) return '-1';
  if (req.includes('6')) return '-1';
  return '-0';
};

export const AnvilIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 8c0-1.7 1.3-3 3-3h15v3c-1.5 0-3 1-3 2.5V13a4 4 0 0 1-3 3.9V19h2a1 1 0 0 1 1 1v1H6v-1a1 1 0 0 1 1-1h2v-2.1A4 4 0 0 1 6 13v-2.5C6 9 4.5 8 3 8z" />
  </svg>
);

export const GuardrailBadge: React.FC<{ isValid: boolean }> = ({ isValid }) => (
  <span
    className={`inline-flex items-center justify-center text-[10px] font-extrabold px-1.5 py-0.2 rounded transition-all select-none ${
      isValid
        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 shadow-sm'
        : 'bg-rose-950/80 text-rose-400 border border-rose-500/50 shadow-sm'
    }`}
    title={isValid ? 'Requirement fulfilled' : 'Required field'}
  >
    {isValid ? '✅' : '❌'}
  </span>
);

export const PlayerWorkshopModal: React.FC<PlayerWorkshopModalProps> = ({ 
  isOpen, 
  onClose, 
  onItemSaved,
  onOpenWorkshop,
  initialItem,
}) => {
  const isGsUnlocked = useCharacterStore((state) => state.isGuildSpaceUnlocked);
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const playerName = useCharacterStore((state) => state.playerName);
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const skills = useCharacterStore((state) => state.skills);
  const powers = useCharacterStore((state) => state.powers);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);

  const isGm = activeRole === 'gm';

  // Form Core State
  const [creationType, setCreationType] = useState<CustomCreationType>('power');
  const [name, setName] = useState('');
  const [action, setAction] = useState('AM');
  const [usage, setUsage] = useState('1-Enc');
  const [tier, setTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Minor');
  const [costVal, setCostVal] = useState<number>(10);
  const [costUnit, setCostUnit] = useState<'s' | 'g'>('g');
  const [powerReady, setPowerReady] = useState<string>('primary_arsenal');
  const [skillAttribute, setSkillAttribute] = useState<string>('💪');
  const [skillDiscipline, setSkillDiscipline] = useState<string>('General');
  const [traitCost, setTraitCost] = useState<string>('1 AP');
  const [pathCategory, setPathCategory] = useState<string>('General');
  const [pathDescription, setPathDescription] = useState<string>('');
  const [kitCategory, setKitCategory] = useState<string>('Survival');
  const [kitDescription, setKitDescription] = useState<string>('');
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Power & Power Table State
  const [selectedPowerTable, setSelectedPowerTable] = useState('');

  // Skillset State (2 to 5 selected existing skill strings)
  const [selectedSkillsetSkills, setSelectedSkillsetSkills] = useState<string[]>(['', '']);

  // Weapon State
  const [weaponTypeMode, setWeaponTypeMode] = useState<'Melee' | 'Hurled' | 'Shot' | 'Melee, Hurled'>('Melee');
  const [weaponReqNum, setWeaponReqNum] = useState<number>(4);

  // Armor State
  const [armorReq, setArmorReq] = useState<string>('💪 4');

  // Shield State
  const [shieldReq, setShieldReq] = useState<string>('💪 4');

  // Gear State
  const [gearCategory, setGearCategory] = useState<string>('Adventure');
  const [gearCategoryNewText, setGearCategoryNewText] = useState<string>('');

  // Custom skills loaded from database / API
  const [customSkillsList, setCustomSkillsList] = useState<CustomCreationItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const effectTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-populate form if opened with an editing item
  useEffect(() => {
    if (isOpen && initialItem) {
      if (initialItem.type) setCreationType(initialItem.type);
      if (initialItem.name) setName(initialItem.name);
      if (initialItem.item_data?.effect) setEffect(initialItem.item_data.effect);
      if (initialItem.item_data?.action) setAction(initialItem.item_data.action);
      if (initialItem.item_data?.usage) setUsage(initialItem.item_data.usage);
      if (initialItem.item_data?.tier) setTier(initialItem.item_data.tier as any);
      if (initialItem.item_data?.notes) setNotes(initialItem.item_data.notes);
      else if (initialItem.notes) setNotes(initialItem.notes);
      if (initialItem.item_data?.genres && Array.isArray(initialItem.item_data.genres)) {
        setSelectedGenres(initialItem.item_data.genres);
      }
      if (initialItem.item_data?.attribute) setSkillAttribute(initialItem.item_data.attribute);
      if (initialItem.item_data?.category) {
        setPathCategory(initialItem.item_data.category);
        setKitCategory(initialItem.item_data.category);
        setGearCategory(initialItem.item_data.category);
      }
    }
  }, [isOpen, initialItem]);

  // Switch tabs cleanly
  const handleSwitchTab = (newType: CustomCreationType) => {
    if (newType !== creationType) {
      setCreationType(newType);
      setSelectedGenres([]);
      setFeedback(null);
    }
  };

  // Real-time Guardrail Validation Flags
  const isNameValid = name.trim().length > 0;
  const isPowerTableValid = selectedPowerTable.trim().length > 0;
  const isEffectValid = effect.trim().length > 0;
  const isGenresValid = selectedGenres.length > 0;
  const isSkillAttributeValid = !!skillAttribute && skillAttribute.trim().length > 0;
  const isSkillsetSkillsValid =
    selectedSkillsetSkills.length >= 2 &&
    selectedSkillsetSkills.length <= 5 &&
    selectedSkillsetSkills.every((s) => typeof s === 'string' && s.trim().length > 0);
  const isGearCategoryValid =
    gearCategory === 'CUSTOM_NEW' ? gearCategoryNewText.trim().length > 0 : gearCategory.trim().length > 0;

  const isFormValid = useMemo(() => {
    if (!isNameValid) return false;
    if (!isGenresValid) return false;

    if (creationType === 'power') {
      return isPowerTableValid && isEffectValid;
    }
    if (creationType === 'path') {
      return pathDescription.trim().length > 0;
    }
    if (creationType === 'skill') {
      return isSkillAttributeValid;
    }
    if (creationType === 'skillset') {
      return isSkillsetSkillsValid;
    }
    if (creationType === 'trait') {
      return isEffectValid;
    }
    if (creationType === 'weapon' || creationType === 'armor' || creationType === 'shield') {
      return costVal >= 1;
    }
    if (creationType === 'gear') {
      return isGearCategoryValid && costVal >= 1;
    }
    if (creationType === 'exotic' || creationType === 'artifact' || creationType === 'relic' || creationType === 'hardware' || creationType === 'chaos_gem') {
      return isEffectValid;
    }
    if (creationType === 'kit') {
      return kitDescription.trim().length > 0 && costVal >= 1;
    }
    return true;
  }, [
    creationType,
    isNameValid,
    isGenresValid,
    isPowerTableValid,
    isEffectValid,
    isSkillAttributeValid,
    isSkillsetSkillsValid,
    isGearCategoryValid,
    pathDescription,
    kitDescription,
    costVal,
  ]);

  // Load custom items when modal is opened
  useEffect(() => {
    if (isOpen) {
      setSelectedGenres([]);
      setFeedback(null);
      const loadCustomItems = async () => {
        try {
          const [personal, all] = await Promise.all([
            playerEmail ? gameApi.getPersonalCustomItems(playerEmail) : Promise.resolve([]),
            gameApi.getAllCustomItems(),
          ]);
          const customSkills = [...personal, ...all].filter((it) => it.type === 'skill' || it.type === 'skillset');
          setCustomSkillsList(customSkills);
        } catch (err) {
          console.error('[PlayerWorkshopModal] Error loading custom skills for catalog:', err);
        }
      };
      loadCustomItems();
    } else {
      setSelectedGenres([]);
      setFeedback(null);
    }
  }, [isOpen, playerEmail, activePartyId]);

  // Aggregate all unique skills
  const availableSkillsCatalog = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(skills)) {
      skills.forEach((sk) => {
        const cleanKey = (sk.name || '').trim().toLowerCase();
        if (cleanKey && !map.has(cleanKey)) {
          map.set(cleanKey, `${sk.attribute} ${sk.name.trim()}`);
        }
      });
    }

    const customSkillsets = activeCharacter?.sheet_data?.custom_skillsets || [];
    customSkillsets.forEach((cs) => {
      if (Array.isArray(cs.skills)) {
        cs.skills.forEach((rawSkill: string) => {
          if (typeof rawSkill === 'string' && rawSkill.trim()) {
            const trimmed = rawSkill.trim();
            let cleanName = trimmed;
            for (const icon of ATTRIBUTE_CHIPS) {
              cleanName = cleanName.replace(icon, '').trim();
            }
            if (cleanName && !map.has(cleanName.toLowerCase())) {
              map.set(cleanName.toLowerCase(), trimmed);
            }
          }
        });
      }
    });

    const individualSkills = activeCharacter?.sheet_data?.known_individual_skills || [];
    individualSkills.forEach((rawSkill) => {
      if (typeof rawSkill === 'string' && rawSkill.trim()) {
        const trimmed = rawSkill.trim();
        let cleanName = trimmed;
        for (const icon of ATTRIBUTE_CHIPS) {
          cleanName = cleanName.replace(icon, '').trim();
        }
        if (cleanName && !map.has(cleanName.toLowerCase())) {
          map.set(cleanName.toLowerCase(), trimmed);
        }
      }
    });

    customSkillsList.forEach((it) => {
      if (it.type === 'skill' && it.name) {
        const attr = it.item_data?.attribute || '✨';
        const formatted = it.item_data?.formatted_skill || `${it.name.trim()} ${attr}`;
        const cleanName = it.name.trim();
        if (cleanName && !map.has(cleanName.toLowerCase())) {
          map.set(cleanName.toLowerCase(), formatted);
        }
      } else if (it.type === 'skillset' && Array.isArray(it.item_data?.skills)) {
        it.item_data.skills.forEach((rawSkill: string) => {
          if (typeof rawSkill === 'string' && rawSkill.trim()) {
            const trimmed = rawSkill.trim();
            let cleanName = trimmed;
            for (const icon of ATTRIBUTE_CHIPS) {
              cleanName = cleanName.replace(icon, '').trim();
            }
            if (cleanName && !map.has(cleanName.toLowerCase())) {
              map.set(cleanName.toLowerCase(), trimmed);
            }
          }
        });
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => compareMsoOptions(a[1], b[1], isGsUnlocked))
      .map((entry) => entry[1]);
  }, [skills, activeCharacter, customSkillsList, isGsUnlocked]);

  // Group power tables
  const groupedPowerTables = useMemo(() => {
    const groups: Record<string, { name: string }[]> = {};
    const tableNames = Array.from(new Set(powers.map((p) => p.kit || p.table_group || p.table_name || 'General').filter(Boolean)));
    tableNames.sort((a, b) => compareMsoOptions(a, b, isGsUnlocked)).forEach((tblName) => {
      const sample = powers.find((p) => (p.kit || p.table_group || p.table_name) === tblName);
      const cat = sample?.category || sample?.discipline || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ name: tblName });
    });
    return groups;
  }, [powers, isGsUnlocked]);

  if (!isOpen) return null;

  const insertTextAtCursor = (insertStr: string) => {
    const textarea = effectTextareaRef.current;
    if (!textarea) {
      setEffect((prev) => (prev ? prev + insertStr : insertStr));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentVal = effect;
    const nextVal = currentVal.substring(0, start) + insertStr + currentVal.substring(end);
    setEffect(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertStr.length, start + insertStr.length);
    }, 0);
  };

  const handleAddSkillsetRow = () => {
    if (selectedSkillsetSkills.length < 5) {
      setSelectedSkillsetSkills((prev) => [...prev, '']);
    }
  };

  const handleRemoveSkillsetRow = (index: number) => {
    if (selectedSkillsetSkills.length > 2) {
      setSelectedSkillsetSkills((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSelectSkill = (index: number, skillVal: string) => {
    setSelectedSkillsetSkills((prev) => {
      const next = [...prev];
      next[index] = skillVal;
      return next;
    });
  };

  const handleToggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId) ? prev.filter((g) => g !== genreId) : [...prev, genreId]
    );
  };

  const handleResetForm = () => {
    setName('');
    setAction('AM');
    setUsage('1-Enc');
    setTier('Minor');
    setCostVal(10);
    setCostUnit('g');
    setPowerReady('primary_arsenal');
    setSkillAttribute('💪');
    setSkillDiscipline('General');
    setTraitCost('1 AP');
    setPathCategory('General');
    setPathDescription('');
    setKitCategory('Survival');
    setKitDescription('');
    setEffect('');
    setNotes('');
    setSelectedGenres([]);
    setSelectedPowerTable('');
    setSelectedSkillsetSkills(['', '']);
    setWeaponTypeMode('Melee');
    setWeaponReqNum(4);
    setArmorReq('💪 4');
    setShieldReq('💪 4');
    setGearCategory('Adventure');
    setGearCategoryNewText('');
  };

  const costStr = creationType === 'artifact' ? 'Artifact' : `${costVal}${costUnit}`;

  let weaponReqStr = `💪 ${weaponReqNum}`;
  if (weaponTypeMode === 'Hurled') weaponReqStr = `🏃 ${weaponReqNum}`;
  if (weaponTypeMode === 'Shot') weaponReqStr = `👁️ ${weaponReqNum}`;
  if (weaponTypeMode === 'Melee, Hurled') weaponReqStr = `💪 ${weaponReqNum}, 🏃 ${weaponReqNum}`;

  const finalGearCat = gearCategory === 'CUSTOM_NEW' ? gearCategoryNewText.trim() || 'Custom' : gearCategory;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setFeedback(null);

    const authorDisplayName = playerName || playerEmail?.split('@')[0] || 'Unknown Forger';
    const categoryStr =
      creationType === 'power'
        ? selectedPowerTable
        : creationType === 'path'
        ? pathCategory
        : creationType === 'trait'
        ? 'Trait'
        : creationType === 'skill'
        ? skillDiscipline
        : creationType === 'weapon'
        ? weaponTypeMode
        : creationType === 'armor'
        ? 'Armor'
        : creationType === 'shield'
        ? 'Shield'
        : creationType === 'gear'
        ? finalGearCat
        : creationType === 'kit'
        ? kitCategory
        : tier;

    const itemDataPayload: CustomCreationData = {
      notes: notes.trim() || undefined,
      genres: selectedGenres,
      category: categoryStr,
      allow_cloning: true,
    };

    if (creationType === 'power') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.table = selectedPowerTable;
      itemDataPayload.table_group = selectedPowerTable;
      itemDataPayload.ready_category = powerReady;
    } else if (creationType === 'path') {
      itemDataPayload.category = pathCategory;
      itemDataPayload.description = pathDescription.trim();
    } else if (creationType === 'trait') {
      itemDataPayload.effect = effect.trim();
      itemDataPayload.cost = traitCost;
    } else if (creationType === 'skill') {
      itemDataPayload.attribute = skillAttribute;
      itemDataPayload.discipline = skillDiscipline;
      itemDataPayload.formatted_skill = `${name.trim()} ${skillAttribute}`;
    } else if (creationType === 'skillset') {
      itemDataPayload.skills = selectedSkillsetSkills.filter(Boolean);
    } else if (creationType === 'weapon') {
      itemDataPayload.type = weaponTypeMode;
      itemDataPayload.requirement = weaponReqStr;
      itemDataPayload.atk = getWeaponAtkDmg(weaponTypeMode);
      itemDataPayload.dmg = getWeaponAtkDmg(weaponTypeMode);
      itemDataPayload.max_block = getWeaponMaxBlock(weaponTypeMode, weaponReqNum);
      itemDataPayload.cost = costStr;
    } else if (creationType === 'armor') {
      itemDataPayload.requirement = armorReq;
      itemDataPayload.ar = getArmorArStr(armorReq);
      itemDataPayload.mr = getArmorMrStr(armorReq);
      itemDataPayload.cost = costStr;
    } else if (creationType === 'shield') {
      itemDataPayload.requirement = shieldReq;
      itemDataPayload.max_block = getShieldMaxBlockStr(shieldReq);
      itemDataPayload.mr = getShieldMrStr(shieldReq);
      itemDataPayload.cost = costStr;
    } else if (creationType === 'gear') {
      itemDataPayload.category = finalGearCat;
      itemDataPayload.cost = costStr;
    } else if (creationType === 'exotic') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.cost = costStr;
      itemDataPayload.tier = tier;
      itemDataPayload.slot_weight = (getItemSlotWeight({ name: name.trim(), category: tier }) as 1 | 2 | 3 | 4);
    } else if (creationType === 'artifact') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.cost = 'Artifact';
      itemDataPayload.tier = tier;
      itemDataPayload.slot_weight = (getItemSlotWeight({ name: name.trim(), category: tier }) as 1 | 2 | 3 | 4);
    } else if (creationType === 'chaos_gem') {
      itemDataPayload.action = 'F';
      itemDataPayload.usage = '3';
      itemDataPayload.effect = effect.trim();
    } else if (creationType === 'kit') {
      itemDataPayload.category = kitCategory;
      itemDataPayload.description = kitDescription.trim();
      itemDataPayload.cost = costStr;
    }

    try {
      const newCustomItem: Partial<CustomCreationItem> = {
        name: name.trim(),
        type: creationType,
        category: categoryStr,
        author_name: isGm ? `${authorDisplayName} (GM)` : authorDisplayName,
        author_email: playerEmail || 'guest@metascape.com',
        party_id: activePartyId || null,
        gm_approved: isGm ? true : false,
        item_data: itemDataPayload,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      if (initialItem && initialItem.id) {
        await gameApi.updateCustomItem(initialItem.id, newCustomItem);
      } else {
        await gameApi.saveCustomItem(newCustomItem);
      }

      setFeedback({
        type: 'success',
        message: `✅ Successfully forged '${name.trim()}' to your Custom Elements library!`,
      });

      handleResetForm();
      if (onItemSaved) onItemSaved();
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error forging item:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to save creation.'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-outfit">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-5xl lg:max-w-6xl shadow-2xl shadow-amber-950/50 flex flex-col h-[90vh] max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <AnvilIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide flex items-center gap-2">
                Forge
                {isGm ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    👑 GM Mode {activePartyId ? `[Party: ${activePartyId}]` : ''}
                  </span>
                ) : (
                  activePartyId && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      Party: {activePartyId}
                    </span>
                  )
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Craft custom Powers, Paths, Skills, Traits, Weapons, Armor, Shields, Gear, Exotics & Artifacts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenWorkshop && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWorkshop();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-amber-600/30 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Go to Workshop (Browse personal creations & clone from players)"
              >
                <span>🛠️</span>
                <span>To Workshop</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Forge"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Classification Tabs (Two Symmetrical Rows matching Character Sheet Cards) */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 shrink-0 flex flex-col gap-1.5">
          {/* Row 1: Capabilities & Powers */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-20 shrink-0">Capabilities:</span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap">
              <button
                type="button"
                onClick={() => handleSwitchTab('power')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'power'
                    ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🔥 Powers
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('path')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'path'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧭 Paths
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('skill')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'skill'
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🎓 Skills
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('skillset')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'skillset'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🎓 Skillsets
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('trait')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'trait'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧬 Traits
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('chaos_gem')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'chaos_gem'
                    ? 'bg-violet-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                💎 Chaos Gems
              </button>
            </div>
          </div>

          {/* Row 2: Equipment & Gear */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-20 shrink-0">Equipment:</span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap">
              <button
                type="button"
                onClick={() => handleSwitchTab('weapon')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'weapon'
                    ? 'bg-orange-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                ⚔️ Weapons
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('armor')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'armor'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧥 Armor
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('shield')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'shield'
                    ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🛡️ Shields
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('gear')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'gear'
                    ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                ⚙️ Gear
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('exotic')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'exotic'
                    ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧿 Exotics
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('artifact')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'artifact'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🔮 Artifacts
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('kit')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  creationType === 'kit'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                📦 Kits
              </button>
            </div>
          </div>
        </div>

        {/* 2-Pane Grid Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
          {/* ========================================================================= */}
          {/* PANE 1 (LEFT): LIVE CARD PREVIEW & CANONICAL NOTATION CHEAT SHEET         */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-5 overflow-y-auto gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>⚒️</span> Live Card Preview
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Character Sheet Parity</span>
            </div>

            {/* Dynamic Card Preview Container */}
            <div className="flex-1 flex flex-col justify-start">
              {creationType === 'power' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/40 shadow-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-rose-200 truncate">{name || 'Unnamed Power'}</span>
                    <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">{action}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">{usage}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span>Path: <strong className="text-slate-200">{selectedPowerTable || 'General'}</strong></span>
                    <span>•</span>
                    <span className="capitalize">{powerReady.replace('_', ' ')}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {effect || 'Effect rules syntax will render here...'}
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'path' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/40 shadow-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-purple-200 text-sm font-outfit flex items-center gap-1.5">
                      <span>🧭</span>
                      <span>{name || 'Unnamed Path'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                      {pathCategory} Path
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {pathDescription || 'Path description, heritage lore, and capabilities...'}
                  </p>
                </div>
              )}

              {creationType === 'skill' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/40 shadow-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-indigo-200 text-sm font-outfit flex items-center gap-1.5">
                      <span>🎓</span>
                      <span>{name || 'Unnamed Skill'}</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-500/40 text-xs font-extrabold">
                      {skillAttribute}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Discipline: <strong className="text-slate-200">{skillDiscipline}</strong>
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'skillset' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 shadow-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-200 text-sm font-outfit flex items-center gap-1.5">
                      <span>🎓</span>
                      <span>{name || 'Unnamed Skillset'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      {selectedSkillsetSkills.filter(Boolean).length} Skills
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSkillsetSkills.filter(Boolean).map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-200 border border-emerald-500/30 text-[11px] font-semibold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {creationType === 'trait' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/40 shadow-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-purple-200 text-sm font-outfit flex items-center gap-1.5">
                      <span>🧬</span>
                      <span>{name || 'Unnamed Trait'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                      {traitCost}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {effect || 'Trait mechanical effects...'}
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'weapon' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-orange-500/40 shadow-xl flex flex-col gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-100 text-sm font-outfit">{name || 'Unnamed Weapon'}</span>
                    <span className="px-2 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-500/40 text-[10px]">{weaponTypeMode}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Req: <strong className="text-slate-100">{weaponReqStr}</strong></div>
                    <div>Cost: <strong className="text-amber-300">{costStr}</strong></div>
                    <div>Atk: <strong className="text-amber-300">{getWeaponAtkDmg(weaponTypeMode)}</strong></div>
                    <div>Dmg: <strong className="text-rose-300">d{getWeaponAtkDmg(weaponTypeMode)}</strong></div>
                    <div>Block: <strong className="text-cyan-300">{getWeaponMaxBlock(weaponTypeMode, weaponReqNum)}</strong></div>
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic mt-1 font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'armor' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 shadow-xl flex flex-col gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-100 text-sm font-outfit">{name || 'Unnamed Armor'}</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[10px]">Armor SK</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Req: <strong className="text-slate-100">{armorReq}</strong></div>
                    <div>Cost: <strong className="text-amber-300">{costStr}</strong></div>
                    <div>AR: <strong className="text-amber-300">🧥 {getArmorArStr(armorReq)}</strong></div>
                    <div>MR: <strong className="text-cyan-300">👣 {getArmorMrStr(armorReq)}</strong></div>
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic mt-1 font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'shield' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-xl flex flex-col gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-100 text-sm font-outfit">{name || 'Unnamed Shield'}</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-[10px]">Shield SK</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>Req: <strong className="text-slate-100">{shieldReq}</strong></div>
                    <div>Cost: <strong className="text-amber-300">{costStr}</strong></div>
                    <div>Max Block: <strong className="text-cyan-300">{getShieldMaxBlockStr(shieldReq)}</strong></div>
                    <div>MR Adj: <strong className="text-cyan-300">👣 {getShieldMrStr(shieldReq)}</strong></div>
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic mt-1 font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'gear' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-teal-500/40 shadow-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-100 text-sm font-outfit">{name || 'Unnamed Gear'}</span>
                    <span className="px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-500/40 text-[10px]">{finalGearCat}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span>Category: <strong className="text-teal-300">{finalGearCat}</strong></span>
                    <span>Cost: <strong className="text-amber-300">{costStr}</strong></span>
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic mt-1 font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'exotic' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-cyan-200">{name || 'Unnamed Exotic'}</span>
                    <div className="flex items-center gap-1 text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">{tier} 🧿</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">{action}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">{usage}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Cost: <strong className="text-amber-300">{costStr}</strong></span>
                    <span>Loadout: <strong className="text-cyan-300">{getItemSlotWeight({ name, category: tier })} Slot(s)</strong></span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {effect || 'Effect rules text...'}
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic">"{notes}"</p>}
                </div>
              )}

              {creationType === 'artifact' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/40 shadow-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-purple-200">{name || 'Unnamed Artifact'}</span>
                    <div className="flex items-center gap-1 text-[10px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-bold">{tier} 🔮</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">{action}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">{usage}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-500/30 text-purple-300 font-bold text-[10px]">Cost: Artifact</span>
                    <span>Loadout: <strong className="text-purple-300">{getItemSlotWeight({ name, category: tier })} Slot(s)</strong></span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {effect || 'Effect rules text...'}
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic">"{notes}"</p>}
                </div>
              )}

              {creationType === 'chaos_gem' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-violet-500/40 shadow-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-violet-200 text-sm font-outfit flex items-center gap-1.5">
                      <span>💎</span>
                      <span>{name || 'Unnamed Chaos Gem'}</span>
                    </span>
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/40 font-bold">F</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">3 Uses</span>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                    {effect || 'Socket activation effect will render here...'}
                  </div>
                  {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                </div>
              )}

              {creationType === 'kit' && (
                <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 shadow-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-amber-200 text-sm font-outfit flex items-center gap-1.5">
                      <span>📦</span>
                      <span>{name || 'Unnamed Kit'}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      {costStr}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">Category: <strong className="text-amber-300">{kitCategory}</strong></div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">{kitDescription || 'Kit description and equipment bundle contents...'}</p>
                  {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PANE 2 (RIGHT): FORGE CONTROLS & FORM INPUTS                              */}
          {/* ========================================================================= */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 flex flex-col min-h-0 bg-slate-900/60 p-5 overflow-y-auto gap-4 text-xs">
            {/* Feedback Alert */}
            {feedback && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fadeIn ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                }`}
              >
                {feedback.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* Row 1: Item Name */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Name</span>
                  <GuardrailBadge isValid={isNameValid} />
                  <InfoTooltip text="Enter the unique name of this creation." />
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Required</span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. Flame Surge, Astral Greatsword, Voidrunner Plate...`}
                className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                required
              />
            </div>

            {/* CREATION-SPECIFIC CONTROLS */}
            {/* A. POWERS */}
            {creationType === 'power' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-300">Path / Table</span>
                      <GuardrailBadge isValid={isPowerTableValid} />
                    </div>
                    <select
                      value={selectedPowerTable}
                      onChange={(e) => setSelectedPowerTable(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-xl outline-none focus:border-amber-400 cursor-pointer"
                      required
                    >
                      <option value="">-- Select Table --</option>
                      {Object.entries(groupedPowerTables).map(([category, tables]) => (
                        <optgroup key={category} label={category}>
                          {tables.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Action</span>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Usage</span>
                    <select
                      value={usage}
                      onChange={(e) => setUsage(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                    >
                      {USAGE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Ready Category</span>
                  <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                    {POWER_READY_CATEGORIES.map((cat) => {
                      const isSelected = powerReady === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setPowerReady(cat.id)}
                          className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* B. PATHS */}
            {creationType === 'path' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Path Category</span>
                  <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                    {PATH_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPathCategory(cat)}
                        className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                          pathCategory === cat
                            ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Path Description & Lore</span>
                    <GuardrailBadge isValid={pathDescription.trim().length > 0} />
                  </div>
                  <textarea
                    rows={4}
                    value={pathDescription}
                    onChange={(e) => setPathDescription(e.target.value)}
                    placeholder="Describe this Path, training archetype, and key abilities..."
                    className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>
            )}

            {/* C. SKILLS */}
            {creationType === 'skill' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Assigned Attribute</span>
                  <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                    {['✨', '💪', '👁️', '🏃', '🫀'].map((attr) => (
                      <button
                        key={attr}
                        type="button"
                        onClick={() => setSkillAttribute(attr)}
                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                          skillAttribute === attr
                            ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        {attr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Discipline</span>
                  <select
                    value={skillDiscipline}
                    onChange={(e) => setSkillDiscipline(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="General">General</option>
                    <option value="Martial">Martial</option>
                    <option value="Arcane">Arcane</option>
                    <option value="Roguish">Roguish</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>
              </div>
            )}

            {/* D. SKILLSETS */}
            {creationType === 'skillset' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Select Included Skills (2–5)</span>
                  <GuardrailBadge isValid={isSkillsetSkillsValid} />
                </div>
                {selectedSkillsetSkills.map((skVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={skVal}
                      onChange={(e) => handleSelectSkill(idx, e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Skill {idx + 1} --</option>
                      {availableSkillsCatalog.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {selectedSkillsetSkills.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSkillsetRow(idx)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {selectedSkillsetSkills.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddSkillsetRow}
                    className="self-start text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Skill ({selectedSkillsetSkills.length}/5)</span>
                  </button>
                )}
              </div>
            )}

            {/* E. TRAITS */}
            {creationType === 'trait' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">AP Cost</span>
                  <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                    {['0 AP', '1 AP', '2 AP', '3 AP', '4 AP'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setTraitCost(c)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                          traitCost === c
                            ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* F. WEAPONS */}
            {creationType === 'weapon' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Type</span>
                  <select
                    value={weaponTypeMode}
                    onChange={(e) => setWeaponTypeMode(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 text-orange-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="Melee">Melee</option>
                    <option value="Shot">Shot</option>
                    <option value="Hurled">Hurled</option>
                    <option value="Melee, Hurled">Melee, Hurled</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Requirement</span>
                  <select
                    value={weaponReqNum}
                    onChange={(e) => setWeaponReqNum(parseInt(e.target.value, 10))}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {WEAPON_REQ_NUMBERS.map((n) => (
                      <option key={n} value={n}>
                        Requirement: {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 bg-slate-950 text-slate-100 text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 outline-none"
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as any)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="g">g (Gold)</option>
                      <option value="s">s (Silver)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* G. ARMOR */}
            {creationType === 'armor' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Armor Weight / Requirement</span>
                  <select
                    value={armorReq}
                    onChange={(e) => setArmorReq(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {ARMOR_REQ_OPTIONS.map((req) => (
                      <option key={req} value={req}>
                        {req} (AR: 🧥{getArmorArStr(req)} | MR: 👣{getArmorMrStr(req)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 bg-slate-950 text-slate-100 text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 outline-none"
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as any)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="g">g (Gold)</option>
                      <option value="s">s (Silver)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* H. SHIELDS */}
            {creationType === 'shield' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Shield Size / Requirement</span>
                  <select
                    value={shieldReq}
                    onChange={(e) => setShieldReq(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {SHIELD_REQ_OPTIONS.map((req) => (
                      <option key={req} value={req}>
                        {req} (Max Block: 🛡️{getShieldMaxBlockStr(req)} | MR Adj: 👣{getShieldMrStr(req)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 bg-slate-950 text-slate-100 text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 outline-none"
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as any)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="g">g (Gold)</option>
                      <option value="s">s (Silver)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* I. GEAR */}
            {creationType === 'gear' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Category</span>
                  <select
                    value={gearCategory}
                    onChange={(e) => setGearCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-teal-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {GEAR_DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="CUSTOM_NEW">+ Add Custom Category</option>
                  </select>
                  {gearCategory === 'CUSTOM_NEW' && (
                    <input
                      type="text"
                      value={gearCategoryNewText}
                      onChange={(e) => setGearCategoryNewText(e.target.value)}
                      placeholder="Enter custom category name..."
                      className="mt-1 bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-teal-500/50 outline-none"
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 bg-slate-950 text-slate-100 text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 outline-none"
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as any)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="s">s (Silver)</option>
                      <option value="g">g (Gold)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* J. EXOTICS & ARTIFACTS */}
            {(creationType === 'exotic' || creationType === 'artifact') && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Combat Tier</span>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="Minor">Minor 🍺 (1 Slot)</option>
                    <option value="Lesser">Lesser 🪄 (2 Slots)</option>
                    <option value="Greater">Greater 🪬 (3 Slots)</option>
                    <option value="Epic">Epic 💫 (4 Slots)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Action</span>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Usage</span>
                  <select
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {USAGE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  {creationType === 'artifact' ? (
                    <div className="px-3 py-2 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-300 font-bold text-center">
                      Artifact
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={costVal}
                        onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 bg-slate-950 text-slate-100 text-xs font-semibold px-2 py-2 rounded-xl border border-slate-700 outline-none"
                      />
                      <select
                        value={costUnit}
                        onChange={(e) => setCostUnit(e.target.value as any)}
                        className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-2 py-2 rounded-xl outline-none cursor-pointer"
                      >
                        <option value="g">g</option>
                        <option value="s">s</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* K. KITS */}
            {creationType === 'kit' && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Kit Category</span>
                    <select
                      value={kitCategory}
                      onChange={(e) => setKitCategory(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                    >
                      {KIT_DEFAULT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Cost</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        value={costVal}
                        onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-20 bg-slate-950 text-slate-100 text-xs font-semibold px-2.5 py-2 rounded-xl border border-slate-700 outline-none"
                      />
                      <select
                        value={costUnit}
                        onChange={(e) => setCostUnit(e.target.value as any)}
                        className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                      >
                        <option value="g">g (Gold)</option>
                        <option value="s">s (Silver)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Bundle Contents & Description</span>
                    <GuardrailBadge isValid={kitDescription.trim().length > 0} />
                  </div>
                  <textarea
                    rows={3}
                    value={kitDescription}
                    onChange={(e) => setKitDescription(e.target.value)}
                    placeholder="List the bundle contents and equipment included in this kit..."
                    className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>
            )}

            {/* RULES EFFECT TEXTAREA WITH QUICK-INSERT CHIPS */}
            {(creationType === 'power' ||
              creationType === 'trait' ||
              creationType === 'exotic' ||
              creationType === 'artifact' ||
              creationType === 'chaos_gem') && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Effect Rules Syntax</span>
                    <GuardrailBadge isValid={isEffectValid} />
                    <InfoTooltip text="Use strict SupaFlex notation grammar. Attributes: ✨💪👁️🏃🫀👣. Range: Touch, 1sq, 2sq, Short, Medium, Long, Extreme. AoE: AoE [#]r or [#]x[#]." />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">KaTeX & Math Compliant</span>
                </div>

                {/* Quick Insert Ribbon */}
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                  {/* Attributes Quick Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">Attributes:</span>
                    {ATTRIBUTE_CHIPS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => insertTextAtCursor(icon)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                        title={`Insert ${icon}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>

                  {/* Range Bands Quick Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">Range:</span>
                    {RANGE_BANDS.map((rng) => (
                      <button
                        key={rng.id}
                        type="button"
                        onClick={() => insertTextAtCursor(rng.text)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-cyan-950/70 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 text-[10px] font-mono transition cursor-pointer"
                        title={`Insert ${rng.label}`}
                      >
                        {rng.id}
                      </button>
                    ))}
                  </div>

                  {/* AoE Quick Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">AoE:</span>
                    {AOE_PRESETS.map((aoe) => (
                      <button
                        key={aoe.id}
                        type="button"
                        onClick={() => insertTextAtCursor(aoe.text)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-rose-950/70 border border-slate-700 hover:border-rose-500/50 text-rose-300 text-[10px] font-mono transition cursor-pointer"
                      >
                        {aoe.id}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  ref={effectTextareaRef}
                  rows={3}
                  value={effect}
                  onChange={(e) => setEffect(e.target.value)}
                  placeholder="e.g. Rng Short; target makes 🏃^14 save or suffers d💪 dmg and Prone."
                  className="bg-slate-950 text-slate-100 text-xs font-mono px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                  required
                />
              </div>
            )}

            {/* Notes Column (Lore / Background) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-300">Item Lore & Notes</span>
                <InfoTooltip text="Optional lore, tactical notes, or historical context. Displayed via the inline ℹ️ indicator." />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Forged in the ancient deeps of Shanask Loom..."
                className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-amber-400 font-serif"
              />
            </div>

            {/* Compatible Genres */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Compatible Genres</span>
                  <GuardrailBadge isValid={isGenresValid} />
                  <InfoTooltip text="Select at least one genre where this item is permitted." />
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Required</span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                {GENRE_OPTIONS.map((g) => {
                  const isSelected = selectedGenres.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => handleToggleGenre(g.id)}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <span>{g.icon}</span>
                      <span>{g.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-3 mt-auto">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                  isFormValid && !isSubmitting
                    ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 shadow-amber-950/50 font-extrabold active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Forging...'
                    : isGm
                    ? 'Forge & Publish to Party Mall 👑'
                    : 'Forge & Save to Workshop Library'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                title="Close Forge"
              >
                Done
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
