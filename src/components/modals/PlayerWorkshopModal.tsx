// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Forge: Master Modal Blueprint 2-Pane Architecture (Live Preview + Forge Controls)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Check, AlertCircle, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem, CustomCreationData, PathLinkedElement } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';
import { InfoTooltip } from '../common/InfoTooltip';
import { compareMsoOptions } from '../../utils/kitUtils';
import { parseCostToSilver } from '../../utils/moneyUtils';
import { LinkPathElementsModal } from './LinkPathElementsModal';

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

// 8 Canonical Range Bands
const RANGE_BANDS = [
  { id: 'Touch', label: 'Touch (≤1 sq)', text: 'Rng Touch; ' },
  { id: '1sq', label: '1sq', text: 'Rng 1sq; ' },
  { id: '2sq', label: '2sq', text: 'Rng 2sq; ' },
  { id: '3sq', label: '3sq', text: 'Rng 3sq; ' },
  { id: 'Short', label: 'Short (≤6 sq)', text: 'Rng Short; ' },
  { id: 'Medium', label: 'Medium (≤12 sq)', text: 'Rng Medium; ' },
  { id: 'Long', label: 'Long (≤24 sq)', text: 'Rng Long; ' },
  { id: 'Extreme', label: 'Extreme (≥25 sq)', text: 'Rng Extreme; ' },
];

// AoE Presets (Only [#]r and [#]x[#] allowed)
const AOE_PRESETS = [
  { id: 'AoE 1r', text: 'AoE 1r; ' },
  { id: 'AoE 2r', text: 'AoE 2r; ' },
  { id: 'AoE 3r', text: 'AoE 3r; ' },
  { id: 'AoE 2x2', text: 'AoE 2x2; ' },
  { id: 'AoE 3x3', text: 'AoE 3x3; ' },
  { id: 'AoE 4x4', text: 'AoE 4x4; ' },
];

// Attributes Without Labels per Directive
const ATTRIBUTE_CHIPS = ['✨', '💪', '👁️', '🏃', '🫀', '👣'];

const POWER_READY_CATEGORIES = [
  { id: 'primary_arsenal', label: 'Primary / Arsenal', icon: '⚔️' },
  { id: 'mobility_defense', label: 'Mobility & Defense', icon: '🛡️' },
  { id: 'support_passive', label: 'Support & Passives', icon: '✨' },
];

const GENRE_OPTIONS = [
  { id: 'Medieval', label: 'Medieval', icon: '⚔️' },
  { id: 'Modern', label: 'Modern', icon: '🏙️' },
  { id: 'SciFi', label: 'SciFi', icon: '🚀' },
];

const WEAPON_REQ_NUMBERS = [4, 6, 8, 10, 12];
const ARMOR_REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];
const SHIELD_REQ_OPTIONS = ['💪 4', '💪 6', '💪 8', '💪 10', '💪 12'];

const GEAR_DEFAULT_CATEGORIES = [
  'Adventure',
  'Communication',
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
  if (typeMode === 'Melee, Shot') return '💪, 👁️';
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
  if (req.includes('12')) return '👣8';
  if (req.includes('10')) return '👣9';
  if (req.includes('8')) return '👣10';
  if (req.includes('6')) return '👣11';
  return '👣12';
};

const getShieldMaxBlockStr = (req: string): string => {
  if (req.includes('12')) return '🛡️28';
  if (req.includes('10')) return '🛡️24';
  if (req.includes('8')) return '🛡️20';
  if (req.includes('6')) return '🛡️16';
  return '🛡️12';
};

const getShieldMrStr = (req: string): string => {
  if (req.includes('12')) return '👣-4';
  if (req.includes('10')) return '👣-3';
  if (req.includes('8')) return '👣-2';
  if (req.includes('6')) return '👣-1';
  return '👣0';
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

export const getCategoryEmoji = (type: CustomCreationType): string => {
  switch (type) {
    case 'power': return '🔥';
    case 'path': return '🧭';
    case 'skill': return '🎓';
    case 'skillset': return '🎓';
    case 'trait': return '🧬';
    case 'weapon': return '⚔️';
    case 'armor': return '🥋';
    case 'shield': return '🛡️';
    case 'gear': return '⚙️';
    case 'exotic': return '🧿';
    case 'artifact': return '🔮';
    case 'chaos_gem': return '💎';
    case 'kit': return '📦';
    default: return '✨';
  }
};

export const CompactCostInput: React.FC<{
  gold: number;
  silver: number;
  onGoldChange: (val: number) => void;
  onSilverChange: (val: number) => void;
}> = ({ gold, silver, onGoldChange, onSilverChange }) => (
  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded-xl shadow-inner">
    <input
      type="number"
      min={0}
      value={gold === 0 ? '' : gold}
      onChange={(e) => onGoldChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
      className="w-12 bg-transparent text-slate-100 text-xs font-bold text-right outline-none"
      placeholder="0"
      title="Gold amount"
    />
    <span className="text-amber-400 font-extrabold text-xs select-none">g</span>
    <span className="text-slate-600 font-bold select-none">•</span>
    <input
      type="number"
      min={0}
      value={silver === 0 ? '' : silver}
      onChange={(e) => onSilverChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
      className="w-12 bg-transparent text-slate-100 text-xs font-bold text-right outline-none"
      placeholder="0"
      title="Silver amount"
    />
    <span className="text-slate-300 font-extrabold text-xs select-none">s</span>
  </div>
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
  const paths = useCharacterStore((state) => state.paths);
  const weaponsCatalog = useCharacterStore((state) => state.weaponsCatalog);
  const shieldsCatalog = useCharacterStore((state) => state.shieldsCatalog);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);

  const isGm = activeRole === 'gm';

  // Form Core State
  const [creationType, setCreationType] = useState<CustomCreationType>('power');
  const [name, setName] = useState('');
  const [action, setAction] = useState('AM');
  const [usage, setUsage] = useState('1-Enc');
  const [tier, setTier] = useState<'Minor' | 'Lesser' | 'Greater' | 'Epic'>('Minor');
  const [costGold, setCostGold] = useState<number>(10);
  const [costSilver, setCostSilver] = useState<number>(0);
  const [powerReady, setPowerReady] = useState<string>('primary_arsenal');
  const [skillAttribute, setSkillAttribute] = useState<string>('💪');
  const [skillDiscipline, setSkillDiscipline] = useState<string>('General');
  const [skillDisciplineNewText, setSkillDisciplineNewText] = useState<string>('');
  const [pathCategory, setPathCategory] = useState<string>('General');
  const [pathCategoryNewText, setPathCategoryNewText] = useState<string>('');
  const [pathDescription, setPathDescription] = useState<string>('');
  const [linkedElements, setLinkedElements] = useState<PathLinkedElement[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Skillset State (2+ selected existing skill strings)
  const [selectedSkillsetSkills, setSelectedSkillsetSkills] = useState<string[]>(['', '']);

  // Weapon State
  const [weaponTypeMode, setWeaponTypeMode] = useState<'Melee' | 'Hurled' | 'Shot' | 'Melee, Hurled' | 'Melee, Shot'>('Melee');
  const [weaponReqNum, setWeaponReqNum] = useState<number>(4);
  const [weaponDomain, setWeaponDomain] = useState<string>('Archaic');
  const [weaponDomainNewText, setWeaponDomainNewText] = useState<string>('');

  // Armor State
  const [armorReq, setArmorReq] = useState<string>('💪 4');

  // Shield State
  const [shieldReq, setShieldReq] = useState<string>('💪 4');
  const [shieldDomain, setShieldDomain] = useState<string>('Archaic');
  const [shieldDomainNewText, setShieldDomainNewText] = useState<string>('');

  // Gear State
  const [gearCategory, setGearCategory] = useState<string>('Adventure');
  const [gearCategoryNewText, setGearCategoryNewText] = useState<string>('');

  // Custom skills loaded from database / API
  const [customSkillsList, setCustomSkillsList] = useState<CustomCreationItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Personal Creations State (Left Pane A-Z List)
  const [personalItems, setPersonalItems] = useState<CustomCreationItem[]>([]);
  const [isLoadingPersonal, setIsLoadingPersonal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<CustomCreationItem | null>(null);
  const [listFilterMode, setListFilterMode] = useState<'tab' | 'all'>('tab');

  const effectTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPersonalItems = async () => {
    if (!isOpen || !playerEmail) return;
    setIsLoadingPersonal(true);
    try {
      const items = await gameApi.getPersonalCustomItems(playerEmail);
      setPersonalItems(items);
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error loading personal items:', err);
    } finally {
      setIsLoadingPersonal(false);
    }
  };

  const handleResetForm = () => {
    setEditingItem(null);
    setName('');
    setAction('AM');
    setUsage('1-Enc');
    setTier('Minor');
    setCostGold(10);
    setCostSilver(0);
    setPowerReady('primary_arsenal');
    setSkillAttribute('💪');
    setSkillDiscipline('General');
    setSkillDisciplineNewText('');
    setPathCategory('General');
    setPathCategoryNewText('');
    setPathDescription('');
    setLinkedElements([]);
    setEffect('');
    setNotes('');
    setSelectedGenres([]);
    setSelectedSkillsetSkills(['', '']);
    setWeaponTypeMode('Melee');
    setWeaponReqNum(4);
    setWeaponDomain('Archaic');
    setWeaponDomainNewText('');
    setArmorReq('💪 4');
    setShieldReq('💪 4');
    setShieldDomain('Archaic');
    setShieldDomainNewText('');
    setGearCategory('Adventure');
    setGearCategoryNewText('');
    setFeedback(null);
  };

  // Distinct Path Categories from Supabase paths table + defaults
  const availablePathCategories = useMemo(() => {
    const cats = new Set<string>();
    if (Array.isArray(paths)) {
      paths.forEach((p) => {
        if (p.category && typeof p.category === 'string') cats.add(p.category.trim());
      });
    }
    ['Class', 'Race', 'Origin', 'General', 'Combat Style', 'Specialist', 'Ship Officer', 'Innate', 'Universal'].forEach((c) => cats.add(c));
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [paths]);

  // Distinct Skill Disciplines from Supabase skills table + defaults
  const availableSkillDisciplines = useMemo(() => {
    const discs = new Set<string>();
    if (Array.isArray(skills)) {
      skills.forEach((s) => {
        if (s.discipline && typeof s.discipline === 'string') discs.add(s.discipline.trim());
      });
    }
    ['General', 'Martial', 'Arcane', 'Roguish', 'Technical', 'BioTech', 'Covert', 'CyberTech', 'Medical', 'Physical', 'Psionics', 'Somatics', 'Tech', 'Universal', 'Void Magic'].forEach((d) => discs.add(d));
    return Array.from(discs).sort((a, b) => a.localeCompare(b));
  }, [skills]);

  // Distinct Weapon Domains from Supabase weapons table + defaults
  const availableWeaponDomains = useMemo(() => {
    const doms = new Set<string>();
    if (Array.isArray(weaponsCatalog)) {
      weaponsCatalog.forEach((w) => {
        if (w.domain && typeof w.domain === 'string') doms.add(w.domain.trim());
      });
    }
    ['Archaic', 'BioTech', 'CyberTech', 'Tech', 'Void Magic', 'Psionics', 'Somatics'].forEach((d) => doms.add(d));
    return Array.from(doms).sort((a, b) => a.localeCompare(b));
  }, [weaponsCatalog]);

  // Distinct Shield Domains from Supabase shields table + defaults
  const availableShieldDomains = useMemo(() => {
    const doms = new Set<string>();
    if (Array.isArray(shieldsCatalog)) {
      shieldsCatalog.forEach((s) => {
        if (s.domain && typeof s.domain === 'string') doms.add(s.domain.trim());
      });
    }
    ['Archaic', 'Tech'].forEach((d) => doms.add(d));
    return Array.from(doms).sort((a, b) => a.localeCompare(b));
  }, [shieldsCatalog]);

  const handlePopulateItemForEdit = (item: CustomCreationItem) => {
    setEditingItem(item);
    setFeedback(null);
    if (item.type) setCreationType(item.type);
    setName(item.name || '');
    setNotes(item.item_data?.notes || item.notes || '');
    if (item.item_data?.genres && Array.isArray(item.item_data.genres)) {
      setSelectedGenres(item.item_data.genres);
    } else {
      setSelectedGenres([]);
    }

    if (item.item_data?.cost) {
      const totalSilver = parseCostToSilver(item.item_data.cost);
      setCostGold(Math.floor(totalSilver / 100));
      setCostSilver(totalSilver % 100);
    } else {
      setCostGold(10);
      setCostSilver(0);
    }

    if (item.type === 'power') {
      setAction(item.item_data?.action || 'AM');
      setUsage(item.item_data?.usage || '1-Enc');
      setEffect(item.item_data?.effect || '');
      setPowerReady(item.item_data?.ready_category || 'primary_arsenal');
    } else if (item.type === 'path') {
      const cat = item.item_data?.category || 'General';
      if (availablePathCategories.includes(cat)) {
        setPathCategory(cat);
        setPathCategoryNewText('');
      } else {
        setPathCategory('CUSTOM_NEW');
        setPathCategoryNewText(cat);
      }
      setPathDescription(item.item_data?.description || '');
      setLinkedElements(item.item_data?.linked_elements || []);
    } else if (item.type === 'skill') {
      setSkillAttribute(item.item_data?.attribute || '💪');
      const disc = item.item_data?.discipline || 'General';
      if (availableSkillDisciplines.includes(disc)) {
        setSkillDiscipline(disc);
        setSkillDisciplineNewText('');
      } else {
        setSkillDiscipline('CUSTOM_NEW');
        setSkillDisciplineNewText(disc);
      }
    } else if (item.type === 'skillset') {
      if (Array.isArray(item.item_data?.skills) && item.item_data.skills.length > 0) {
        setSelectedSkillsetSkills(item.item_data.skills);
      } else {
        setSelectedSkillsetSkills(['', '']);
      }
    } else if (item.type === 'trait') {
      setEffect(item.item_data?.effect || '');
    } else if (item.type === 'weapon') {
      setWeaponTypeMode((item.item_data?.type as any) || 'Melee');
      const dom = item.item_data?.domain || 'Archaic';
      if (availableWeaponDomains.includes(dom)) {
        setWeaponDomain(dom);
        setWeaponDomainNewText('');
      } else {
        setWeaponDomain('CUSTOM_NEW');
        setWeaponDomainNewText(dom);
      }
      if (item.item_data?.requirement) {
        const numMatch = item.item_data.requirement.match(/\d+/);
        if (numMatch) setWeaponReqNum(parseInt(numMatch[0], 10));
      }
    } else if (item.type === 'armor') {
      if (item.item_data?.requirement) setArmorReq(item.item_data.requirement);
    } else if (item.type === 'shield') {
      if (item.item_data?.requirement) setShieldReq(item.item_data.requirement);
      const dom = item.item_data?.domain || 'Archaic';
      if (availableShieldDomains.includes(dom)) {
        setShieldDomain(dom);
        setShieldDomainNewText('');
      } else {
        setShieldDomain('CUSTOM_NEW');
        setShieldDomainNewText(dom);
      }
    } else if (item.type === 'gear') {
      if (item.item_data?.category) setGearCategory(item.item_data.category);
    } else if (item.type === 'exotic') {
      setAction(item.item_data?.action || 'AM');
      setUsage(item.item_data?.usage || '1-Enc');
      setTier((item.item_data?.tier as any) || 'Minor');
      setEffect(item.item_data?.effect || '');
    } else if (item.type === 'artifact') {
      setAction(item.item_data?.action || 'AM');
      setUsage(item.item_data?.usage || '1-Enc');
      setTier((item.item_data?.tier as any) || 'Minor');
      setEffect(item.item_data?.effect || '');
    } else if (item.type === 'chaos_gem') {
      setEffect(item.item_data?.effect || '');
    }
  };

  const handleDeleteItem = async (item: CustomCreationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete '${item.name}' from your personal library?`)) return;

    try {
      await gameApi.deleteCustomItem(item.id);
      setFeedback({
        type: 'success',
        message: `Deleted '${item.name}' from your personal creations.`,
      });
      if (editingItem?.id === item.id) {
        handleResetForm();
      }
      loadPersonalItems();
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error deleting item:', err);
      setFeedback({ type: 'error', message: 'Failed to delete creation.' });
    }
  };

  const sortedPersonalItems = useMemo(() => {
    return [...personalItems].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [personalItems]);

  const displayList = useMemo(() => {
    if (listFilterMode === 'all') {
      return sortedPersonalItems;
    }
    return sortedPersonalItems.filter((it) => it.type === creationType);
  }, [sortedPersonalItems, listFilterMode, creationType]);

  // Load custom items and personal items when modal is opened
  useEffect(() => {
    if (isOpen) {
      loadPersonalItems();
      if (initialItem) {
        handlePopulateItemForEdit(initialItem);
      } else {
        handleResetForm();
      }
    } else {
      setSelectedGenres([]);
      setFeedback(null);
      setEditingItem(null);
    }
  }, [isOpen, initialItem, playerEmail]);

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
  const isEffectValid = effect.trim().length > 0;
  const isGenresValid = selectedGenres.length > 0;
  const isSkillAttributeValid = !!skillAttribute && skillAttribute.trim().length > 0;
  const isSkillsetSkillsValid =
    selectedSkillsetSkills.length >= 2 &&
    selectedSkillsetSkills.every((s) => typeof s === 'string' && s.trim().length > 0);
  const isGearCategoryValid =
    gearCategory === 'CUSTOM_NEW' ? gearCategoryNewText.trim().length > 0 : gearCategory.trim().length > 0;
  const isPathCategoryValid =
    pathCategory === 'CUSTOM_NEW' ? pathCategoryNewText.trim().length > 0 : pathCategory.trim().length > 0;
  const isSkillDisciplineValid =
    skillDiscipline === 'CUSTOM_NEW' ? skillDisciplineNewText.trim().length > 0 : skillDiscipline.trim().length > 0;
  const isWeaponDomainValid =
    weaponDomain === 'CUSTOM_NEW' ? weaponDomainNewText.trim().length > 0 : weaponDomain.trim().length > 0;
  const isShieldDomainValid =
    shieldDomain === 'CUSTOM_NEW' ? shieldDomainNewText.trim().length > 0 : shieldDomain.trim().length > 0;
  const isCostValid = costGold > 0 || costSilver > 0;

  const isFormValid = useMemo(() => {
    if (!isNameValid) return false;
    if (!isGenresValid) return false;

    if (creationType === 'power') {
      return isEffectValid;
    }
    if (creationType === 'path') {
      return isPathCategoryValid && pathDescription.trim().length > 0 && linkedElements.length > 0;
    }
    if (creationType === 'skill') {
      return isSkillAttributeValid && isSkillDisciplineValid;
    }
    if (creationType === 'skillset') {
      return isSkillsetSkillsValid;
    }
    if (creationType === 'trait') {
      return isEffectValid;
    }
    if (creationType === 'weapon') {
      return isCostValid && isWeaponDomainValid;
    }
    if (creationType === 'armor') {
      return isCostValid;
    }
    if (creationType === 'shield') {
      return isCostValid && isShieldDomainValid;
    }
    if (creationType === 'gear') {
      return isGearCategoryValid && isCostValid;
    }
    if (creationType === 'exotic') {
      return isEffectValid && isCostValid;
    }
    if (creationType === 'artifact' || creationType === 'relic' || creationType === 'hardware' || creationType === 'chaos_gem') {
      return isEffectValid;
    }
    return true;
  }, [
    creationType,
    isNameValid,
    isGenresValid,
    isEffectValid,
    isSkillAttributeValid,
    isSkillDisciplineValid,
    isSkillsetSkillsValid,
    isGearCategoryValid,
    isPathCategoryValid,
    isWeaponDomainValid,
    isShieldDomainValid,
    isCostValid,
    pathDescription,
    linkedElements.length,
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
    setSelectedSkillsetSkills((prev) => [...prev, '']);
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

  const costStr =
    creationType === 'artifact'
      ? 'Artifact'
      : costGold > 0 && costSilver > 0
      ? `${costGold}g ${costSilver}s`
      : costGold > 0
      ? `${costGold}g`
      : `${costSilver}s`;

  let weaponReqStr = `💪 ${weaponReqNum}`;
  if (weaponTypeMode === 'Hurled') weaponReqStr = `🏃 ${weaponReqNum}`;
  if (weaponTypeMode === 'Shot') weaponReqStr = `👁️ ${weaponReqNum}`;
  if (weaponTypeMode === 'Melee, Hurled') weaponReqStr = `💪 ${weaponReqNum}, 🏃 ${weaponReqNum}`;
  if (weaponTypeMode === 'Melee, Shot') weaponReqStr = `💪 ${weaponReqNum}, 👁️ ${weaponReqNum}`;

  const finalGearCat = gearCategory === 'CUSTOM_NEW' ? gearCategoryNewText.trim() || 'Custom' : gearCategory;
  const finalPathCat = pathCategory === 'CUSTOM_NEW' ? pathCategoryNewText.trim() || 'General' : pathCategory;
  const finalSkillDisc = skillDiscipline === 'CUSTOM_NEW' ? skillDisciplineNewText.trim() || 'General' : skillDiscipline;
  const finalWeaponDomain = weaponDomain === 'CUSTOM_NEW' ? weaponDomainNewText.trim() || 'Archaic' : weaponDomain;
  const finalShieldDomain = shieldDomain === 'CUSTOM_NEW' ? shieldDomainNewText.trim() || 'Archaic' : shieldDomain;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setFeedback(null);

    const authorDisplayName = playerName || playerEmail?.split('@')[0] || 'Unknown Forger';
    const categoryStr =
      creationType === 'power'
        ? 'Power'
        : creationType === 'path'
        ? finalPathCat
        : creationType === 'trait'
        ? 'Trait'
        : creationType === 'skill'
        ? finalSkillDisc
        : creationType === 'weapon'
        ? weaponTypeMode
        : creationType === 'armor'
        ? 'Armor'
        : creationType === 'shield'
        ? 'Shield'
        : creationType === 'gear'
        ? finalGearCat
        : creationType === 'exotic'
        ? 'Exotic'
        : creationType === 'artifact'
        ? 'Artifact'
        : 'General';

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
      itemDataPayload.table = 'General';
      itemDataPayload.table_group = 'General';
      itemDataPayload.ready_category = powerReady;
    } else if (creationType === 'path') {
      itemDataPayload.category = finalPathCat;
      itemDataPayload.description = pathDescription.trim();
      itemDataPayload.linked_elements = linkedElements;
    } else if (creationType === 'trait') {
      itemDataPayload.effect = effect.trim();
    } else if (creationType === 'skill') {
      itemDataPayload.attribute = skillAttribute;
      itemDataPayload.discipline = finalSkillDisc;
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
      itemDataPayload.domain = finalWeaponDomain;
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
      itemDataPayload.domain = finalShieldDomain;
    } else if (creationType === 'gear') {
      itemDataPayload.category = finalGearCat;
      itemDataPayload.cost = costStr;
    } else if (creationType === 'exotic') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.cost = costStr;
    } else if (creationType === 'artifact') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.cost = 'Artifact';
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

      if (editingItem && editingItem.id) {
        await gameApi.updateCustomItem(editingItem.id, newCustomItem);
        setFeedback({
          type: 'success',
          message: `✅ Updated '${name.trim()}' in your Custom Elements library!`,
        });
      } else {
        await gameApi.saveCustomItem(newCustomItem);
        setFeedback({
          type: 'success',
          message: `✅ Successfully forged '${name.trim()}' to your Custom Elements library!`,
        });
      }

      handleResetForm();
      loadPersonalItems();
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
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl">
              ♨️
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
          {/* Row 1: Abilities & Powers */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-20 shrink-0">Abilities:</span>
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

          {/* Row 2: Gear */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-20 shrink-0">Gear:</span>
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
                ⚙️ Standard Gear
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
            </div>
          </div>
        </div>

        {/* 2-Pane Grid Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
          {/* ========================================================================= */}
          {/* PANE 1 (LEFT): FROZEN LIVE CARD PREVIEW + A-Z CREATIONS/CLONES LIST       */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
            {/* FROZEN TOP SECTION: LIVE CARD PREVIEW */}
            <div className="shrink-0 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span>⚒️</span> Live Card Preview
                  </span>
                  {editingItem ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Editing
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono">Character Sheet Parity</span>
                  )}
                </div>
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition cursor-pointer"
                    title="Clear editor to start a new blank creation"
                  >
                    + New Blank
                  </button>
                )}
              </div>

              {/* Dynamic Card Preview Container (Scrolls internally if long, keeps top frozen) */}
              <div className="max-h-[210px] overflow-y-auto pr-1 flex flex-col justify-start">
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
                      <span className="capitalize">{powerReady.replace('_', ' ')}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                      {effect || 'Effect rules syntax will render here...'}
                    </div>
                    {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                  </div>
                )}

                {creationType === 'path' && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/40 shadow-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-purple-200 text-sm font-outfit flex items-center gap-1.5">
                        <span>🧭</span>
                        <span>{name || 'Unnamed Path'}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                        {finalPathCat} Path
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {pathDescription || 'Path description, heritage lore, and capabilities...'}
                    </p>

                    {/* Linked Elements Stream Preview */}
                    <div className="pt-2 border-t border-slate-800 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-purple-300 flex items-center gap-1">
                          <span>🧭</span>
                          <span>Linked Elements ({linkedElements.length})</span>
                        </span>
                        {linkedElements.length === 0 && (
                          <span className="text-[10px] text-amber-400 font-semibold animate-pulse">
                            Required (None Linked)
                          </span>
                        )}
                      </div>
                      {linkedElements.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                          {linkedElements.map((el) => (
                            <span
                              key={el.id}
                              className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-bold text-slate-200 flex items-center gap-1 shadow-sm"
                            >
                              <span>{getCategoryEmoji(el.type)}</span>
                              <span>{el.name}</span>
                              <span
                                className={`ml-0.5 px-1 py-0.2 rounded text-[9px] font-extrabold ${
                                  el.tag === 'Free'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                }`}
                              >
                                {el.tag === 'Free' ? '{Free}' : '1 AP'}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">
                          No elements linked yet. Click "Link Elements to Path" below to add powers, skills, traits, and proficiencies.
                        </p>
                      )}
                    </div>
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
                      Discipline: <strong className="text-slate-200">{finalSkillDisc}</strong>
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
                        Trait
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
                      <div>Domain: <strong className="text-amber-300">{finalWeaponDomain}</strong></div>
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
                      <span className="font-bold text-slate-100 text-sm font-outfit">{name || 'Unnamed Standard Gear'}</span>
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
              </div>
            </div>

            {/* SEPARATOR & CREATED/CLONED CARDS HEADER */}
            <div className="border-t border-slate-800/80 pt-2 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-outfit font-extrabold text-xs text-slate-200 flex items-center gap-1.5">
                  <span>📚</span>
                  <span>My Creations / Clones</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                  {displayList.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Option A Toggle: Current Tab vs All */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setListFilterMode('tab')}
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                      listFilterMode === 'tab'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Filter to creations matching active tab"
                  >
                    Tab ({sortedPersonalItems.filter((it) => it.type === creationType).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListFilterMode('all')}
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all cursor-pointer ${
                      listFilterMode === 'all'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Show all creations across all categories"
                  >
                    All ({sortedPersonalItems.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={loadPersonalItems}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  title="Refresh creations library"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingPersonal ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* SCROLLABLE A-Z CREATED/CLONED CARDS LIST */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
              {displayList.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                  <span className="text-2xl mb-1.5">📦</span>
                  <p className="font-semibold text-slate-400">No creations found</p>
                  <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                    {listFilterMode === 'tab'
                      ? `No ${creationType} creations made or cloned yet.`
                      : 'You have not created or cloned any items yet.'}
                  </p>
                </div>
              ) : (
                displayList.map((item) => {
                  const isItemEditing = editingItem?.id === item.id;
                  const itemAction = item.item_data?.action || 'A';
                  const itemUsage = item.item_data?.usage || '1-Enc';
                  const itemEffect = item.item_data?.effect || '';
                  const itemCost = item.item_data?.cost;
                  const itemReq = item.item_data?.requirement;
                  const itemTier = item.item_data?.tier;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handlePopulateItemForEdit(item)}
                      className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 shadow-sm cursor-pointer ${
                        isItemEditing
                          ? 'bg-amber-950/30 border-amber-500/80 ring-1 ring-amber-500/40'
                          : 'bg-slate-950/70 border-slate-800/80 hover:border-amber-500/40 hover:bg-slate-900/80'
                      }`}
                    >
                      {/* Top Row: Emoji + Name + Type Tag + Actions */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm shrink-0">{getCategoryEmoji(item.type)}</span>
                          <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase shrink-0">
                            {item.type}
                          </span>
                        </div>

                        {/* Actions: Pencil & Trash */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePopulateItemForEdit(item);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                            title="Edit this card"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(item, e)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Delete this card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Row: Attribute / Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        {item.type === 'power' || item.type === 'exotic' || item.type === 'artifact' ? (
                          <>
                            <span className="px-1.5 py-0.2 bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold rounded">
                              {itemAction}
                            </span>
                            <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-bold rounded">
                              {itemUsage}
                            </span>
                          </>
                        ) : null}
                        {itemTier && (
                          <span className="px-1.5 py-0.2 bg-purple-950/80 border border-purple-500/30 text-purple-300 font-bold rounded">
                            {itemTier}
                          </span>
                        )}
                        {itemReq && (
                          <span className="px-1.5 py-0.2 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded">
                            {itemReq}
                          </span>
                        )}
                        {itemCost && (
                          <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-500/30 text-amber-300 font-bold rounded">
                            {itemCost}
                          </span>
                        )}
                        {item.item_data?.domain && (
                          <span className="px-1.5 py-0.2 bg-amber-950/60 border border-amber-600/30 text-amber-200 font-medium rounded">
                            {item.item_data.domain}
                          </span>
                        )}
                        {item.item_data?.cloned_from && (
                          <span className="px-1.5 py-0.2 bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-medium rounded truncate max-w-[150px]">
                            🧬 Cloned: {item.item_data.cloned_from}
                          </span>
                        )}
                      </div>

                      {/* Bottom Row: Effect Snippet */}
                      {itemEffect && (
                        <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800/80 text-[10px] text-slate-300 font-mono leading-tight line-clamp-2">
                          {itemEffect}
                        </div>
                      )}
                    </div>
                  );
                })
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Path Category</span>
                    <GuardrailBadge isValid={isPathCategoryValid} />
                  </div>
                  <select
                    value={pathCategory}
                    onChange={(e) => setPathCategory(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-purple-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="CUSTOM_NEW">➕ New Category...</option>
                    {availablePathCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {pathCategory === 'CUSTOM_NEW' && (
                    <input
                      type="text"
                      value={pathCategoryNewText}
                      onChange={(e) => setPathCategoryNewText(e.target.value)}
                      placeholder="Enter new category name..."
                      className="mt-1 bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-purple-500/50 outline-none"
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Path Description & Lore</span>
                    <GuardrailBadge isValid={pathDescription.trim().length > 0} />
                  </div>
                  <textarea
                    rows={3}
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
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Discipline</span>
                    <GuardrailBadge isValid={isSkillDisciplineValid} />
                  </div>
                  <select
                    value={skillDiscipline}
                    onChange={(e) => setSkillDiscipline(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-indigo-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="CUSTOM_NEW">➕ New Discipline...</option>
                    {availableSkillDisciplines.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {skillDiscipline === 'CUSTOM_NEW' && (
                    <input
                      type="text"
                      value={skillDisciplineNewText}
                      onChange={(e) => setSkillDisciplineNewText(e.target.value)}
                      placeholder="Enter new discipline name..."
                      className="mt-1 bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-indigo-500/50 outline-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* D. SKILLSETS */}
            {creationType === 'skillset' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">Select Included Skills (2+)</span>
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
                <button
                  type="button"
                  onClick={handleAddSkillsetRow}
                  className="self-start text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Skill ({selectedSkillsetSkills.length})</span>
                </button>
              </div>
            )}

            {/* E. TRAITS (Traits do not have an AP cost) */}

            {/* F. WEAPONS */}
            {creationType === 'weapon' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                    <option value="Melee, Shot">Melee, Shot</option>
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
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Domain</span>
                    <GuardrailBadge isValid={isWeaponDomainValid} />
                  </div>
                  <select
                    value={weaponDomain}
                    onChange={(e) => setWeaponDomain(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="CUSTOM_NEW">➕ New Domain...</option>
                    {availableWeaponDomains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {weaponDomain === 'CUSTOM_NEW' && (
                    <input
                      type="text"
                      value={weaponDomainNewText}
                      onChange={(e) => setWeaponDomainNewText(e.target.value)}
                      placeholder="Enter new domain name..."
                      className="mt-1 bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-amber-500/50 outline-none"
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <CompactCostInput
                    gold={costGold}
                    silver={costSilver}
                    onGoldChange={setCostGold}
                    onSilverChange={setCostSilver}
                  />
                </div>
              </div>
            )}

            {/* G. ARMOR */}
            {creationType === 'armor' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Armor Stats</span>
                  <select
                    value={armorReq}
                    onChange={(e) => setArmorReq(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {ARMOR_REQ_OPTIONS.map((req) => (
                      <option key={req} value={req}>
                        {req} (AR: 🧥{getArmorArStr(req)} | MR: {getArmorMrStr(req)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <CompactCostInput
                    gold={costGold}
                    silver={costSilver}
                    onGoldChange={setCostGold}
                    onSilverChange={setCostSilver}
                  />
                </div>
              </div>
            )}

            {/* H. SHIELDS */}
            {creationType === 'shield' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Shield Stats</span>
                  <select
                    value={shieldReq}
                    onChange={(e) => setShieldReq(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    {SHIELD_REQ_OPTIONS.map((req) => (
                      <option key={req} value={req}>
                        {req} (Max Block: {getShieldMaxBlockStr(req)} | MR Adj: {getShieldMrStr(req)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Domain</span>
                    <GuardrailBadge isValid={isShieldDomainValid} />
                  </div>
                  <select
                    value={shieldDomain}
                    onChange={(e) => setShieldDomain(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                  >
                    <option value="CUSTOM_NEW">➕ New Domain...</option>
                    {availableShieldDomains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {shieldDomain === 'CUSTOM_NEW' && (
                    <input
                      type="text"
                      value={shieldDomainNewText}
                      onChange={(e) => setShieldDomainNewText(e.target.value)}
                      placeholder="Enter new domain name..."
                      className="mt-1 bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-cyan-500/50 outline-none"
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-slate-300">Cost</span>
                  <CompactCostInput
                    gold={costGold}
                    silver={costSilver}
                    onGoldChange={setCostGold}
                    onSilverChange={setCostSilver}
                  />
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
                    <option value="CUSTOM_NEW">➕ Add Custom Category...</option>
                    {GEAR_DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
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
                  <CompactCostInput
                    gold={costGold}
                    silver={costSilver}
                    onGoldChange={setCostGold}
                    onSilverChange={setCostSilver}
                  />
                </div>
              </div>
            )}

            {/* J. EXOTICS & ARTIFACTS */}
            {(creationType === 'exotic' || creationType === 'artifact') && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <CompactCostInput
                      gold={costGold}
                      silver={costSilver}
                      onGoldChange={setCostGold}
                      onSilverChange={setCostSilver}
                    />
                  )}
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
                    <span className="font-bold text-slate-300">Effect</span>
                    <GuardrailBadge isValid={isEffectValid} />
                    <InfoTooltip text="Use strict SupaFlex notation grammar. Attributes: ✨💪👁️🏃🫀👣. Range: Touch (≤1 sq), 1sq, 2sq, 3sq, Short (≤6 sq), Medium (≤12 sq), Long (≤24 sq), Extreme (≥25 sq). AoE: AoE [#]r or [#]x[#]." />
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
                <span className="font-bold text-slate-300">Lore & Notes</span>
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
                  <span className="font-bold text-slate-300">Genres - select ALL that could apply</span>
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

            {/* Path Link Elements Action Card (Required for Path) */}
            {creationType === 'path' && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-purple-950/30 border border-purple-500/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-purple-200 text-xs flex items-center gap-1">
                      <span>🧭</span>
                      <span>Link Elements to Path</span>
                    </span>
                    <GuardrailBadge isValid={linkedElements.length > 0} />
                  </div>
                  <span className="text-[10px] text-purple-300 font-mono">
                    {linkedElements.length} Linked (Required)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  A path must have at least 1 linked element (Powers, Skills, Skillsets, Traits, or Gear Skills).
                </p>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/50 cursor-pointer active:scale-[0.98]"
                >
                  <span>🧭 Manage Linked Elements</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-purple-950/80 text-purple-200 text-[10px]">
                    {linkedElements.length}
                  </span>
                </button>
              </div>
            )}

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
                    ? 'Forge to My Creations 👑'
                    : 'Forge to My Creations'}
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

      {isLinkModalOpen && (
        <LinkPathElementsModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          pathName={name}
          linkedElements={linkedElements}
          onUpdateLinkedElements={setLinkedElements}
        />
      )}
    </div>
  );
};
