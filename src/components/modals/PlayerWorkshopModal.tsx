// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Workshop / Player's Forge: Craft custom Powers, Relics, Hardware, Skills, & Skillsets.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Check, AlertCircle } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';
import { InfoTooltip } from '../common/InfoTooltip';

interface PlayerWorkshopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemSaved?: () => void;
}

const ACTION_OPTIONS = ['AM', 'A', 'M', 'P', 'F'];

const USAGE_OPTIONS = [
  '1',
  '2',
  '3',
  '1-🍀',
  '1-⚡',
  '1-Enc',
  '2-Enc',
  '3-Enc',
  '1-Rnd',
];

const ATTRIBUTE_EFFECT_ICONS = [
  { label: 'Magic✨', name: 'Magic', icon: '✨' },
  { label: 'Might💪', name: 'Might', icon: '💪' },
  { label: 'Mind👁️', name: 'Mind', icon: '👁️' },
  { label: 'Motion🏃', name: 'Motion', icon: '🏃' },
  { label: 'Moxie🫀', name: 'Moxie', icon: '🫀' },
];

const SKILLSET_ATTRIBUTE_OPTIONS = [
  { label: 'Magic✨', icon: '✨' },
  { label: 'Might💪', icon: '💪' },
  { label: 'Mind👁️', icon: '👁️' },
  { label: 'Motion🏃', icon: '🏃' },
  { label: 'Moxie🫀', icon: '🫀' },
];

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
    className={`inline-flex items-center justify-center text-[10px] font-extrabold px-1.5 py-0.5 rounded transition-all select-none ${
      isValid
        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 shadow-sm'
        : 'bg-rose-950/80 text-rose-400 border border-rose-500/50 shadow-sm'
    }`}
    title={isValid ? 'Requirement fulfilled' : 'Required field'}
  >
    {isValid ? '✅' : '❌'}
  </span>
);

export const PlayerWorkshopModal: React.FC<PlayerWorkshopModalProps> = ({ isOpen, onClose, onItemSaved }) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const playerName = useCharacterStore((state) => state.playerName);
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const skills = useCharacterStore((state) => state.skills);
  const powers = useCharacterStore((state) => state.powers);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const saveActiveCharacter = useCharacterStore((state) => state.saveActiveCharacter);

  const isGm = activeRole === 'gm';

  // Form State
  const [creationType, setCreationType] = useState<CustomCreationType>('power');
  const [name, setName] = useState('');
  const [action, setAction] = useState('AM');
  const [usage, setUsage] = useState('1');
  const [tier, setTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Minor');
  const [costVal, setCostVal] = useState<number>(10);
  const [costUnit, setCostUnit] = useState<'s' | 'g'>('g');
  const [powerReady, setPowerReady] = useState<string>('primary_arsenal');
  const [skillAttribute, setSkillAttribute] = useState<string>('💪');
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Power & Power Table State
  const [selectedPowerTable, setSelectedPowerTable] = useState('');
  const [tableCategory, setTableCategory] = useState('');
  const [customCategoryInput, setCustomCategoryInput] = useState('');

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

  // Switch tabs and reset genres to none selected per directive
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
  const isTableCategoryValid =
    tableCategory.trim().length > 0 &&
    (tableCategory !== 'Custom' || customCategoryInput.trim().length > 0);
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
    if (creationType === 'power_table') {
      return isTableCategoryValid;
    }
    if (creationType === 'relic' || creationType === 'hardware' || creationType === 'chaos_gem') {
      return isEffectValid;
    }
    if (creationType === 'skill') {
      return isSkillAttributeValid;
    }
    if (creationType === 'skillset') {
      return isSkillsetSkillsValid;
    }
    if (creationType === 'weapon' || creationType === 'armor' || creationType === 'shield') {
      return costVal >= 1;
    }
    if (creationType === 'gear') {
      return isGearCategoryValid && costVal >= 1;
    }
    return false;
  }, [
    creationType,
    isNameValid,
    isGenresValid,
    isPowerTableValid,
    isTableCategoryValid,
    isEffectValid,
    isSkillAttributeValid,
    isSkillsetSkillsValid,
    isGearCategoryValid,
    costVal,
  ]);

  // Load custom items when modal is opened and reset genres to empty on open/blur
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

  // Aggregate all unique skills across stock database skills, custom sheet skills, and custom creations
  const availableSkillsCatalog = useMemo(() => {
    const map = new Map<string, string>(); // cleanNameKey -> formattedSkillString

    // 1. Stock database atomic skills
    if (Array.isArray(skills)) {
      skills.forEach((sk) => {
        const cleanKey = (sk.name || '').trim().toLowerCase();
        if (cleanKey && !map.has(cleanKey)) {
          map.set(cleanKey, `${sk.attribute} ${sk.name.trim()}`);
        }
      });
    }

    // 2. Character sheet custom skillsets & individual skills
    const customSkillsets = activeCharacter?.sheet_data?.custom_skillsets || [];
    customSkillsets.forEach((cs) => {
      if (Array.isArray(cs.skills)) {
        cs.skills.forEach((rawSkill: string) => {
          if (typeof rawSkill === 'string' && rawSkill.trim()) {
            const trimmed = rawSkill.trim();
            let cleanName = trimmed;
            for (const icon of ['✨', '💪', '👁️', '🏃', '🫀']) {
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
        for (const icon of ['✨', '💪', '👁️', '🏃', '🫀']) {
          cleanName = cleanName.replace(icon, '').trim();
        }
        if (cleanName && !map.has(cleanName.toLowerCase())) {
          map.set(cleanName.toLowerCase(), trimmed);
        }
      }
    });

    // 3. Custom creation skills & skillsets from API
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
            for (const icon of ['✨', '💪', '👁️', '🏃', '🫀']) {
              cleanName = cleanName.replace(icon, '').trim();
            }
            if (cleanName && !map.has(cleanName.toLowerCase())) {
              map.set(cleanName.toLowerCase(), trimmed);
            }
          }
        });
      }
    });

    // Sort alphabetically by clean skill name
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((entry) => entry[1]);
  }, [skills, activeCharacter, customSkillsList]);

  // Group all available power tables by Category for clean <optgroup> dropdown selection
  const groupedPowerTables = useMemo(() => {
    const groups: Record<string, { name: string }[]> = {};
    const tableNames = Array.from(new Set(powers.map((p) => p.table_group || p.table_name || 'General').filter(Boolean)));
    tableNames.sort((a, b) => a.localeCompare(b)).forEach((tblName) => {
      const sample = powers.find((p) => (p.table_group || p.table_name) === tblName);
      const cat = sample?.category || sample?.source || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ name: tblName });
    });
    return groups;
  }, [powers]);

  if (!isOpen) return null;

  const insertIconAtCursor = (iconStr: string) => {
    const textarea = effectTextareaRef.current;
    if (!textarea) {
      setEffect((prev) => (prev ? prev + iconStr : iconStr));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentVal = effect;
    const nextVal = currentVal.substring(0, start) + iconStr + currentVal.substring(end);
    setEffect(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + iconStr.length, start + iconStr.length);
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
    setEffect('');
    setNotes('');
    setSelectedGenres([]);
    setSelectedSkillsetSkills(['', '']);
    setSelectedPowerTable('');
    setTableCategory('');
    setCustomCategoryInput('');
    setAction('AM');
    setUsage('1');
    setTier('Minor');
    setCostVal(10);
    setCostUnit('g');
    setPowerReady('primary_arsenal');
    setSkillAttribute('💪');
    setWeaponTypeMode('Melee');
    setWeaponReqNum(4);
    setArmorReq('💪 4');
    setShieldReq('💪 4');
    setGearCategory('Adventure');
    setGearCategoryNewText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Creation name is required.' });
      return;
    }

    if (creationType === 'power_table') {
      const finalCategory = tableCategory === 'Custom' ? customCategoryInput.trim() : tableCategory.trim();
      if (!finalCategory) {
        setFeedback({ type: 'error', message: 'Please specify a category for this Power Table.' });
        return;
      }
      if (selectedGenres.length === 0) {
        setFeedback({
          type: 'error',
          message: 'Please select at least one compatible Genre (Medieval, Modern, or SciFi).',
        });
        return;
      }

      setIsSubmitting(true);
      setFeedback(null);

      try {
        const newTable = {
          name: name.trim(),
          category: finalCategory,
          genres: selectedGenres,
        };

        if (activeCharacter) {
          const currentCustom = activeCharacter.sheet_data?.custom_power_tables || [];
          if (!currentCustom.some((t: any) => t.name.toLowerCase() === name.trim().toLowerCase())) {
            updateActiveSheetData((prev) => ({
              ...prev,
              custom_power_tables: [...(prev.custom_power_tables || []), newTable],
            }));
            await saveActiveCharacter();
          }
        }

        setFeedback({
          type: 'success',
          message: isGm
            ? `📜 Successfully forged Power Table '${name.trim()}' [${finalCategory}] and published live!`
            : `📜 Successfully forged Power Table '${name.trim()}' [${finalCategory}]!`,
        });

        handleResetForm();
        if (onItemSaved) onItemSaved();
      } catch (err: any) {
        console.error('[PlayerWorkshopModal] Error forging power table:', err);
        setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to save power table.'}` });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (creationType === 'power') {
      if (!selectedPowerTable) {
        setFeedback({ type: 'error', message: 'Please select a required Power Table for this power.' });
        return;
      }
      if (!effect.trim()) {
        setFeedback({ type: 'error', message: 'Effect (rules) description is required.' });
        return;
      }
    } else if (creationType === 'skillset') {
      if (selectedSkillsetSkills.length < 2 || selectedSkillsetSkills.length > 5) {
        setFeedback({ type: 'error', message: 'A Skillset must contain between 2 and 5 skills.' });
        return;
      }
      for (let i = 0; i < selectedSkillsetSkills.length; i++) {
        if (!selectedSkillsetSkills[i]) {
          setFeedback({ type: 'error', message: `Please select a valid skill for slot #${i + 1}.` });
          return;
        }
      }
      const uniqueSelected = new Set(selectedSkillsetSkills);
      if (uniqueSelected.size !== selectedSkillsetSkills.length) {
        setFeedback({ type: 'error', message: 'Duplicate skills detected. Each skill in a skillset must be unique.' });
        return;
      }
    } else if (creationType === 'skill') {
      if (!skillAttribute) {
        setFeedback({ type: 'error', message: 'Please select a required attribute for this skill.' });
        return;
      }
    } else if (creationType === 'gear') {
      const finalGearCat = gearCategory === 'CUSTOM_NEW' ? gearCategoryNewText.trim() : gearCategory.trim();
      if (!finalGearCat) {
        setFeedback({ type: 'error', message: 'Please select or provide a category for this gear.' });
        return;
      }
    } else if (creationType === 'relic' || creationType === 'hardware' || creationType === 'chaos_gem') {
      if (!effect.trim()) {
        setFeedback({ type: 'error', message: 'Effect (rules) description is required.' });
        return;
      }
    }

    if (selectedGenres.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one compatible Genre (Medieval, Modern, or SciFi).',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const authorDisplayName = playerName?.trim() || playerEmail?.split('@')[0] || 'Hero';
    const tierIcon = tier === 'Minor' ? '🍺' : tier === 'Lesser' ? '🪄' : tier === 'Greater' ? '✨' : '💫';
    const samplePower = powers.find((p) => (p.table_group || p.table_name) === selectedPowerTable);
    const assignedCategory = samplePower?.category || samplePower?.source || 'Class';

    const categoryStr =
      creationType === 'relic'
        ? `${tierIcon} ${tier}`
        : creationType === 'power'
        ? assignedCategory
        : creationType === 'hardware'
        ? 'Custom Hardware'
        : creationType === 'skill'
        ? `${skillAttribute} Skill`
        : creationType === 'skillset'
        ? 'Custom Skillset'
        : creationType === 'weapon'
        ? weaponTypeMode
        : creationType === 'armor'
        ? 'Custom Armor'
        : creationType === 'shield'
        ? 'Custom Shield'
        : creationType === 'chaos_gem'
        ? '💎 Chaos Gem'
        : gearCategory === 'CUSTOM_NEW'
        ? gearCategoryNewText.trim()
        : gearCategory.trim();

    const costStr =
      creationType === 'hardware' ||
      creationType === 'weapon' ||
      creationType === 'armor' ||
      creationType === 'shield' ||
      creationType === 'gear'
        ? `${Math.max(1, costVal)}${costUnit}`
        : undefined;

    const formattedSkills =
      creationType === 'skillset'
        ? selectedSkillsetSkills.map((s) => s.trim()).filter(Boolean)
        : undefined;

    const itemDataPayload: any = {
      genres: selectedGenres,
      created_at: new Date().toISOString(),
    };

    if (creationType === 'power') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.ready = powerReady;
      itemDataPayload.ready_category = powerReady;
      itemDataPayload.table_group = selectedPowerTable;
      itemDataPayload.table = selectedPowerTable;
      itemDataPayload.category = assignedCategory;
    } else if (creationType === 'relic') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.slot_weight = getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4;
      itemDataPayload.is_hardware = false;
    } else if (creationType === 'hardware') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.cost = costStr;
      itemDataPayload.is_hardware = true;
      itemDataPayload.slot_weight = getItemSlotWeight({ name: name.trim(), category: categoryStr }) as 1 | 2 | 3 | 4;
    } else if (creationType === 'skill') {
      itemDataPayload.attribute = skillAttribute;
      itemDataPayload.formatted_skill = `${name.trim()} ${skillAttribute}`;
    } else if (creationType === 'skillset') {
      itemDataPayload.skills = formattedSkills;
    } else if (creationType === 'weapon') {
      let weaponReqStr = `💪 ${weaponReqNum}`;
      if (weaponTypeMode === 'Hurled') weaponReqStr = `🏃 ${weaponReqNum}`;
      if (weaponTypeMode === 'Shot') weaponReqStr = `👁️ ${weaponReqNum}`;
      if (weaponTypeMode === 'Melee, Hurled') weaponReqStr = `💪 ${weaponReqNum}, 🏃 ${weaponReqNum}`;

      const weaponAtkDmg = getWeaponAtkDmg(weaponTypeMode);
      const weaponMaxBlock = getWeaponMaxBlock(weaponTypeMode, weaponReqNum);
      itemDataPayload.type = weaponTypeMode;
      itemDataPayload.requirement = weaponReqStr;
      itemDataPayload.atk = weaponAtkDmg;
      itemDataPayload.dmg = weaponAtkDmg;
      itemDataPayload.max_block = weaponMaxBlock;
      itemDataPayload.cost = costStr;
    } else if (creationType === 'armor') {
      const armorAr = getArmorArStr(armorReq);
      const armorMr = getArmorMrStr(armorReq);
      itemDataPayload.requirement = armorReq;
      itemDataPayload.ar = armorAr;
      itemDataPayload.mr = armorMr;
      itemDataPayload.cost = costStr;
    } else if (creationType === 'shield') {
      const shieldMaxBlock = getShieldMaxBlockStr(shieldReq);
      const shieldMr = getShieldMrStr(shieldReq);
      itemDataPayload.requirement = shieldReq;
      itemDataPayload.max_block = shieldMaxBlock;
      itemDataPayload.mr = shieldMr;
      itemDataPayload.cost = costStr;
    } else if (creationType === 'gear') {
      const finalGearCat = gearCategory === 'CUSTOM_NEW' ? gearCategoryNewText.trim() : gearCategory.trim();
      itemDataPayload.category = finalGearCat;
      itemDataPayload.cost = costStr;
    } else if (creationType === 'chaos_gem') {
      itemDataPayload.action = 'F';
      itemDataPayload.usage = '3';
      itemDataPayload.effect = effect.trim();
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

      await gameApi.saveCustomItem(newCustomItem);

      // Attempt auxiliary creation in stock catalog tables
      try {
        if (creationType === 'weapon') {
          await gameApi.createWeapon({
            name: name.trim(),
            type: weaponTypeMode,
            requirement: itemDataPayload.requirement,
            atk: itemDataPayload.atk,
            dmg: itemDataPayload.dmg,
            max_block: itemDataPayload.max_block,
            cost: costStr || '1g',
          });
        } else if (creationType === 'armor') {
          await gameApi.createArmor({
            name: name.trim(),
            requirement: itemDataPayload.requirement,
            ar: itemDataPayload.ar,
            mr: itemDataPayload.mr,
            cost: costStr || '1g',
          });
        } else if (creationType === 'shield') {
          await gameApi.createShield({
            name: name.trim(),
            requirement: itemDataPayload.requirement,
            max_block: itemDataPayload.max_block,
            mr: itemDataPayload.mr,
            cost: costStr || '1g',
          });
        } else if (creationType === 'gear') {
          await gameApi.createGear({
            name: name.trim(),
            category: itemDataPayload.category,
            cost: costStr || '1s',
          });
        } else if (creationType === 'chaos_gem') {
          await gameApi.createChaosGem({
            name: name.trim(),
            effect: effect.trim(),
            genres: selectedGenres,
            notes: notes.trim() || undefined,
            action: 'F',
            usage: '3',
          });
        }
      } catch (catErr) {
        console.warn('[PlayerWorkshopModal] Direct catalog sync notice (RLS or duplicate):', catErr);
      }

      setFeedback({
        type: 'success',
        message: isGm
          ? `👑 Successfully forged '${name.trim()}' and published live to Party Mall${activePartyId ? ` [${activePartyId}]` : ''}!`
          : `✅ Successfully forged '${name.trim()}' and saved to your Creations library!`,
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-xl shadow-2xl shadow-amber-950/50 flex flex-col h-[660px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
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
                {isGm
                  ? 'Craft custom Powers, Relics, Hardware, Skills & Skillsets with instant Party Mall auto-approval.'
                  : 'Craft custom Powers, Relics, Hardware, Skills & Skillsets.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Classification Tabs (Multi-Option Pill Switch) */}
        <div className="px-5 pt-3 pb-2 bg-slate-950/40 border-b border-slate-800/80 shrink-0">
          <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap">
            <button
              type="button"
              onClick={() => handleSwitchTab('power')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'power'
                  ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🔥 Power
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('power_table')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'power_table'
                  ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              📜 Table
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('relic')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'relic'
                  ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🏺 Relic
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('hardware')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'hardware'
                  ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              ⚙️ Hardware
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('skill')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'skill'
                  ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🎯 Skill
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('skillset')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'skillset'
                  ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🎓 Skillset
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('weapon')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'weapon'
                  ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              ⚔️ Weapon
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('armor')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
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
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                creationType === 'shield'
                  ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🛡️ Shield
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('gear')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                creationType === 'gear'
                  ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🎒 Gear
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('chaos_gem')}
              className={`py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                creationType === 'chaos_gem'
                  ? 'bg-violet-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              💎 Chaos Gem
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto min-h-0 text-xs">
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

          {/* --- TAB 1: POWER MODE --- */}
          {creationType === 'power' && (
            <>
              {/* Row 1: Power Name + Power Table (Required) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Power Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom power." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Flame Surge, Astral Aegis"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Power Table (Required)</span>
                    <GuardrailBadge isValid={isPowerTableValid} />
                    <InfoTooltip text="Select the Power Table this power belongs to. This categorizes the power and establishes its table classification." />
                  </div>
                  <select
                    value={selectedPowerTable}
                    onChange={(e) => setSelectedPowerTable(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-semibold px-3 py-2 rounded-xl outline-none focus:border-amber-400 cursor-pointer"
                    required
                  >
                    <option value="">-- Select a Power Table --</option>
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
              </div>

              {/* Row 2: Action & Usage (2-col grid) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Action</span>
                    <InfoTooltip text="AM = Action/Move, A = Action, M = Move, P = Passive, F = Free." />
                  </div>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Usage</span>
                    <InfoTooltip text="Frequency of activation (e.g. 1, 2, 3, 1-🍀 Luck, 1-⚡ Instant, 1-Enc, 2-Enc, 3-Enc, 1-Rnd)." />
                  </div>
                  <select
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    {USAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Ready Category Selector Pill Switch */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Ready Category</span>
                  <InfoTooltip text="Classify this power for the Ready Matrix: Primary / Arsenal (attacks/damage), Mobility & Defense (movement/shields), or Support & Passives (buffs/utility)." />
                </div>
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
                            ? cat.id === 'primary_arsenal'
                              ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                              : cat.id === 'mobility_defense'
                              ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                              : 'bg-emerald-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* --- TAB 2: POWER TABLE MODE --- */}
          {creationType === 'power_table' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Power Table Name */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Power Table Name</span>
                  <GuardrailBadge isValid={isNameValid} />
                  <InfoTooltip text="Enter the unique name of your custom power table." />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chronomancer, Shadowblade, Vampire"
                  className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                  required
                />
              </div>

              {/* Table Category */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Table Category</span>
                  <GuardrailBadge isValid={isTableCategoryValid} />
                  <InfoTooltip text="Classify this power table (Class, Combat Style, Luck, Race, or Custom category)." />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={tableCategory}
                    onChange={(e) => setTableCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-semibold px-3 py-2 rounded-xl outline-none focus:border-amber-400 cursor-pointer flex-1"
                  >
                    <option value="">-- Select a Category --</option>
                    {['Class', 'Combat Style', 'Luck', 'Race', 'Custom'].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {tableCategory === 'Custom' && (
                    <input
                      type="text"
                      placeholder="Enter custom category..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 flex-1"
                      required
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 3: RELIC MODE --- */}
          {creationType === 'relic' && (
            <>
              {/* Row 1: Relic Name + Tier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Relic Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom relic." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ring of Celerity, Sunblade"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Tier</span>
                    <InfoTooltip text="Relic tier classification (Minor, Lesser, Greater, Epic)." />
                  </div>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="Minor">🍺 Minor</option>
                    <option value="Lesser">🪄 Lesser</option>
                    <option value="Greater">✨ Greater</option>
                    <option value="Epic">💫 Epic</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Action & Usage (2-col grid) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Action</span>
                    <InfoTooltip text="AM = Action/Move, A = Action, M = Move, P = Passive, F = Free." />
                  </div>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Usage</span>
                    <InfoTooltip text="Frequency of activation (e.g. 1, 2, 3, 1-🍀 Luck, 1-⚡ Instant, 1-Enc, 2-Enc, 3-Enc, 1-Rnd)." />
                  </div>
                  <select
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    {USAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* --- TAB 4: HARDWARE MODE --- */}
          {creationType === 'hardware' && (
            <>
              {/* Row 1: Hardware Name + Store Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Hardware Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom hardware item." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grappling Hook, Field Medic Kit"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-cyan-300">Store Cost</span>
                    <InfoTooltip text="Enter the purchase cost in silver or gold pieces." />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none focus:border-cyan-400 w-24"
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as 's' | 'g')}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer flex-1"
                    >
                      <option value="s">Silver (s)</option>
                      <option value="g">Gold (g)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Action & Usage (2-col grid) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Action</span>
                    <InfoTooltip text="AM = Action/Move, A = Action, M = Move, P = Passive, F = Free." />
                  </div>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    {ACTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Usage</span>
                    <InfoTooltip text="Frequency of activation (e.g. 1, 2, 3, 1-🍀 Luck, 1-⚡ Instant, 1-Enc, 2-Enc, 3-Enc, 1-Rnd)." />
                  </div>
                  <select
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer"
                  >
                    {USAGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* --- TAB 5: SKILL MODE --- */}
          {creationType === 'skill' && (
            <>
              {/* Row 1: Skill Name (Half-width) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Skill Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom skill." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acrobatics, Lockpicking"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Single Skill Attribute Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Required Attribute</span>
                  <GuardrailBadge isValid={isSkillAttributeValid} />
                  <InfoTooltip text="Assign exactly one core attribute icon (Magic✨, Might💪, Mind👁️, Motion🏃, Moxie🫀) to this skill." />
                </div>
                <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                  {SKILLSET_ATTRIBUTE_OPTIONS.map((attr) => {
                    const isSelected = skillAttribute === attr.icon;
                    return (
                      <button
                        key={attr.icon}
                        type="button"
                        onClick={() => setSkillAttribute(attr.icon)}
                        className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>{attr.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* --- TAB 6: SKILLSET MODE --- */}
          {creationType === 'skillset' && (
            <>
              {/* Row 1: Skillset Name (Half-width) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Skillset Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom skillset." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Infiltrator, Elementalist"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Dynamic Skills List (2 to 5 Required) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300 font-outfit uppercase tracking-wider text-[11px]">
                      Included Skills (2–5 Required)
                    </span>
                    <GuardrailBadge isValid={isSkillsetSkillsValid} />
                    <InfoTooltip text="Select 2 to 5 existing skills from the alphabetized catalog (stock, personal, and party creations) to compose this skillset." />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {selectedSkillsetSkills.length} of 5 Skills
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {selectedSkillsetSkills.map((skillVal, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center gap-2"
                    >
                      <span className="text-[11px] font-mono font-bold text-slate-500 w-5 shrink-0 text-center">
                        #{idx + 1}
                      </span>
                      <select
                        value={skillVal}
                        onChange={(e) => handleSelectSkill(idx, e.target.value)}
                        className="flex-1 bg-slate-900 text-slate-100 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-semibold min-w-0 cursor-pointer"
                        required
                      >
                        <option value="">
                          -- Select Skill #{idx + 1} {idx < 2 ? '(Required)' : ''} --
                        </option>
                        {availableSkillsCatalog.map((sk) => (
                          <option key={sk} value={sk}>
                            {sk}
                          </option>
                        ))}
                      </select>

                      {/* Remove Button */}
                      {selectedSkillsetSkills.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSkillsetRow(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-500/40 transition-colors shrink-0 cursor-pointer"
                          title="Remove skill"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {selectedSkillsetSkills.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddSkillsetRow}
                    className="py-1.5 px-3 rounded-xl border border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/40 hover:bg-slate-900 text-slate-300 hover:text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Skill ({selectedSkillsetSkills.length}/5)</span>
                  </button>
                )}
              </div>
            </>
          )}

          {/* --- TAB 7: WEAPON MODE --- */}
          {creationType === 'weapon' && (
            <>
              {/* Row 1: Weapon Name + Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Weapon Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom weapon." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Battle Greataxe, Elven Shortbow"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-rose-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Cost</span>
                    <InfoTooltip text="Purchase or craft cost in Gold (g) or Silver (s)." />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 bg-slate-950 text-rose-300 font-mono font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-rose-400 text-center"
                      required
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as 's' | 'g')}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer flex-1"
                    >
                      <option value="g">Gold (g 🪙)</option>
                      <option value="s">Silver (s 🥈)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Type Category + Req Rating # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Type Category</span>
                    <InfoTooltip text="Governs which attribute die scales attack and damage rolls." />
                  </div>
                  <select
                    value={weaponTypeMode}
                    onChange={(e) => setWeaponTypeMode(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 text-rose-300 text-xs font-semibold px-3 py-2 rounded-xl outline-none focus:border-rose-400 cursor-pointer"
                  >
                    <option value="Melee">Melee (Might 💪)</option>
                    <option value="Hurled">Hurled (Motion 🏃)</option>
                    <option value="Shot">Shot (Mind 👁️)</option>
                    <option value="Melee, Hurled">Melee & Hurled (💪 & 🏃)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Requirement Rating #</span>
                    <InfoTooltip text="Minimum attribute requirement to wield without penalty." />
                  </div>
                  <select
                    value={weaponReqNum}
                    onChange={(e) => setWeaponReqNum(parseInt(e.target.value, 10))}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none focus:border-rose-400 cursor-pointer"
                  >
                    {WEAPON_REQ_NUMBERS.map((num) => (
                      <option key={num} value={num}>
                        Rating {num} (d{num})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Read-Only Calculated Attributes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Atk/Dmg Attribute:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-rose-300 shadow-sm">
                    {getWeaponAtkDmg(weaponTypeMode)}
                  </div>
                </div>
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Block Cap:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-amber-300 shadow-sm">
                    {getWeaponMaxBlock(weaponTypeMode, weaponReqNum)}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- TAB 8: ARMOR MODE --- */}
          {creationType === 'armor' && (
            <>
              {/* Row 1: Armor Name + Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Armor Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom armor set." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dragonscale Hauberk, Stealth Bodysuit"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Cost</span>
                    <InfoTooltip text="Purchase or craft cost in Gold (g) or Silver (s)." />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 bg-slate-950 text-amber-300 font-mono font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 text-center"
                      required
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as 's' | 'g')}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer flex-1"
                    >
                      <option value="g">Gold (g 🪙)</option>
                      <option value="s">Silver (s 🥈)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Requirement Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Might Requirement</span>
                    <InfoTooltip text="Governs required Might rating to wear without encumbrance." />
                  </div>
                  <select
                    value={armorReq}
                    onChange={(e) => setArmorReq(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {ARMOR_REQ_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Read-Only Calculated Attributes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Armor Rating (AR):</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-amber-300 shadow-sm">
                    {getArmorArStr(armorReq)}
                  </div>
                </div>
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Movement Rate Mod (MR):</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-teal-300 shadow-sm">
                    {getArmorMrStr(armorReq)}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- TAB 9: SHIELD MODE --- */}
          {creationType === 'shield' && (
            <>
              {/* Row 1: Shield Name + Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Shield Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom shield." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aegis of Dawn, Heavy Tower Shield"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Cost</span>
                    <InfoTooltip text="Purchase or craft cost in Gold (g) or Silver (s)." />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 bg-slate-950 text-cyan-300 font-mono font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-cyan-400 text-center"
                      required
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as 's' | 'g')}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer flex-1"
                    >
                      <option value="g">Gold (g 🪙)</option>
                      <option value="s">Silver (s 🥈)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Requirement Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Might Requirement</span>
                    <InfoTooltip text="Governs required Might rating to equip this shield." />
                  </div>
                  <select
                    value={shieldReq}
                    onChange={(e) => setShieldReq(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {SHIELD_REQ_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Read-Only Calculated Attributes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Block Cap (Blk):</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-amber-300 shadow-sm">
                    🛡️{getShieldMaxBlockStr(shieldReq)}
                  </div>
                </div>
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Movement Rate Mod (MR):</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-teal-300 shadow-sm">
                    {getShieldMrStr(shieldReq)}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* --- TAB 10: GEAR MODE --- */}
          {creationType === 'gear' && (
            <>
              {/* Row 1: Gear Name + Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Gear Item Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your custom gear item." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Grappling Hook, Survival Kit"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-teal-400"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Cost</span>
                    <InfoTooltip text="Purchase or craft cost in Silver (s) or Gold (g)." />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={costVal}
                      onChange={(e) => setCostVal(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-24 bg-slate-950 text-teal-300 font-mono font-bold text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-teal-400 text-center"
                      required
                    />
                    <select
                      value={costUnit}
                      onChange={(e) => setCostUnit(e.target.value as 's' | 'g')}
                      className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer flex-1"
                    >
                      <option value="s">Silver (s 🥈)</option>
                      <option value="g">Gold (g 🪙)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 2: Category Selector / Custom New Category */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Gear Category</span>
                  <GuardrailBadge isValid={isGearCategoryValid} />
                  <InfoTooltip text="Select standard gear classification or define a new category." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={gearCategory}
                    onChange={(e) => setGearCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-teal-300 text-xs font-semibold px-3 py-2 rounded-xl outline-none focus:border-teal-400 cursor-pointer"
                  >
                    {GEAR_DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="CUSTOM_NEW">+ New Custom Category...</option>
                  </select>

                  {gearCategory === 'CUSTOM_NEW' && (
                    <input
                      type="text"
                      value={gearCategoryNewText}
                      onChange={(e) => setGearCategoryNewText(e.target.value)}
                      placeholder="Type custom category name..."
                      className="bg-slate-950 text-teal-300 text-xs px-3 py-2 rounded-xl border border-teal-500/50 outline-none focus:border-teal-400"
                      required
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* --- TAB 11: CHAOS GEM MODE --- */}
          {creationType === 'chaos_gem' && (
            <>
              {/* Row 1: Gem Name (Half-width) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-300">Chaos Gem Name</span>
                    <GuardrailBadge isValid={isNameValid} />
                    <InfoTooltip text="Enter the unique name of your volatile Chaos Gem." />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Gem of Temporal Surge, Void Ember"
                    className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-violet-400"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Read-Only Calculated Attributes / Rules */}
              <div className="grid grid-cols-2 gap-3">
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Action:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-violet-300 shadow-sm">
                    F (Free Action)
                  </div>
                </div>
                <div className="px-3.5 py-2 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-center justify-between shadow-inner select-none cursor-default">
                  <span className="text-[11px] font-bold text-slate-400">Durability / Uses:</span>
                  <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-extrabold text-amber-300 shadow-sm">
                    3 Uses (Shatters at 0)
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Effect (rules) (Power, Relic, Hardware, Chaos Gem) */}
          {(creationType === 'power' || creationType === 'relic' || creationType === 'hardware' || creationType === 'chaos_gem') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-300">Effect (rules)</span>
                  <GuardrailBadge isValid={isEffectValid} />
                  <InfoTooltip text="Describe mechanical rules, damage dice, bonuses, or utility." />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-bold mr-0.5">Insert Icon:</span>
                  {ATTRIBUTE_EFFECT_ICONS.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => insertIconAtCursor(item.icon)}
                      className="px-1.5 py-0.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-[11px] font-bold text-slate-200 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                      title={`Insert ${item.icon} at cursor`}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={effectTextareaRef}
                value={effect}
                onChange={(e) => setEffect(e.target.value)}
                rows={3}
                className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 resize-none"
                required
              />
            </div>
          )}

          {/* Visual Description / Notes */}
          {(creationType === 'relic' ||
            creationType === 'hardware' ||
            creationType === 'weapon' ||
            creationType === 'armor' ||
            creationType === 'shield' ||
            creationType === 'gear' ||
            creationType === 'chaos_gem') && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-300">Visual Description / Notes</span>
                <InfoTooltip text="Physical traits, materials, appearance, visual cues, or lore notes." />
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional lore, description, or crafting notes..."
                className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
              />
            </div>
          )}

          {/* Compatible Genres Multi-Select (Last Item Under Form Fields) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-300">Compatible Genres</span>
              <GuardrailBadge isValid={isGenresValid} />
              <InfoTooltip text="Select all campaign genres where this creation is available (Medieval, Modern, SciFi). At least one is required." />
            </div>
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              {GENRE_OPTIONS.map((g) => {
                const isSelected = selectedGenres.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleGenre(g.id)}
                    className={`flex-1 py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
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

          {/* Submit Button */}
          <div className="pt-2 mt-auto shrink-0">
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-amber-600 disabled:hover:to-amber-500 text-white font-outfit font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Forging Creation...'
                  : creationType === 'power_table'
                  ? isGm
                    ? `👑 Forge & Publish Table '${name.trim() || 'Table'}' to Catalog`
                    : `Save Table '${name.trim() || 'Table'}' to Catalog`
                  : isGm
                  ? `👑 Forge & Publish ${name.trim() || 'Creation'} to Party Mall`
                  : `Save ${name.trim() || 'Creation'} to My Creations Library`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
