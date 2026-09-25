// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Forge: Master Modal Blueprint 2-Pane Architecture (Live Preview + Forge Controls)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Plus, Check, AlertCircle, Pencil, Trash2, RefreshCw, Search, ChevronDown, ArrowRight } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem, CustomCreationData, PathElementType, PathLinkedElement, StudioPower, StudioMod, SupabaseChaosGem, SetCategory, SupabaseSet, SetMemberItem, SupabasePath } from '../../types/game';
import { InfoTooltip } from '../common/InfoTooltip';
import { compareMsoOptions } from '../../utils/kitUtils';
import { parseCostToSilver } from '../../utils/moneyUtils';
import { isBelongsToMatch } from '../../utils/gearFunctionSync';
import { resolvePathElementsFromCatalogs } from '../../utils/pathApUtils';

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

export const getCategoryEmoji = (type?: string): string => {
  switch (type) {
    case 'set': return '🗂️';
    case 'power': return '🔥';
    case 'path': return '🧭';
    case 'skill': return '🎓';
    case 'skillset': return '🎓';
    case 'trait': return '🧬';
    case 'weapon':
    case 'weapon_skill': return '⚔️';
    case 'armor':
    case 'armor_skill': return '🥋';
    case 'paths_abilities': return '🧭';
    case 'shield':
    case 'shield_skill': return '🛡️';
    case 'gear': return '⚙️';
    case 'exotic': return '🧿';
    case 'artifact': return '🔮';
    case 'chaos_gem': return '💎';
    case 'kit': return '📦';
    default: return '✨';
  }
};

export const isGearType = (type?: string): boolean => {
  if (!type) return false;
  return ['gear', 'weapon', 'armor', 'shield', 'exotic', 'artifact'].includes(type);
};

export const isPathOrAbilityType = (type?: string): boolean => {
  if (!type) return false;
  return ['paths_abilities', 'path', 'power', 'skill', 'skillset', 'trait'].includes(type);
};

export const isCanonicalDbId = (id: string | number | undefined | null): boolean => {
  if (!id) return false;
  const str = String(id).trim();
  if (
    str.startsWith('pwr_') ||
    str.startsWith('fn_') ||
    str.startsWith('mod_') ||
    str.startsWith('new_') ||
    str.startsWith('temp_') ||
    str.startsWith('custom_')
  ) {
    return false;
  }
  const num = Number(str);
  return !isNaN(num) && Number.isInteger(num) && num > 0 && num < 1000000000;
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
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const skills = useCharacterStore((state) => state.skills);
  const paths = useCharacterStore((state) => state.paths);
  const powers = useCharacterStore((state) => state.powers);
  const traits = useCharacterStore((state) => state.traits);
  const weaponsCatalog = useCharacterStore((state) => state.weaponsCatalog);
  const armorCatalog = useCharacterStore((state) => state.armorCatalog);
  const shieldsCatalog = useCharacterStore((state) => state.shieldsCatalog);
  const suppliesCatalog = useCharacterStore((state) => state.suppliesCatalog);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const updateCanonicalCatalogItem = useCharacterStore((state) => state.updateCanonicalCatalogItem);
  const removeCanonicalCatalogItem = useCharacterStore((state) => state.removeCanonicalCatalogItem);
  const chaosGemsCatalog = useCharacterStore((state) => state.chaosGemsCatalog);
  const functionsCatalog = useCharacterStore((state) => state.functionsCatalog);
  const modsCatalog = useCharacterStore((state) => state.modsCatalog);
  const setsCatalog = useCharacterStore((state) => state.setsCatalog);
  const refreshCatalogs = useCharacterStore((state) => state.refreshCatalogs);

  const isMasterAccount = (playerEmail || '').toLowerCase().trim() === 'metascapegame@gmail.com';
  const [workshopMode, setWorkshopMode] = useState<'player' | 'designer'>('player');
  const isMetaScapeDesigner = isMasterAccount && workshopMode === 'designer';
  const [canonicalSelectedId, setCanonicalSelectedId] = useState<string | number | null>(null);
  const [originalCanonicalName, setOriginalCanonicalName] = useState<string>('');

  const isGm = activeRole === 'gm';

  // Form Core State
  const [creationType, setCreationType] = useState<CustomCreationType>('paths_abilities');
  const [name, setName] = useState('');
  const [action, setAction] = useState('AM');
  const [usage, setUsage] = useState('1-Enc');
  const [costGold, setCostGold] = useState<number>(10);
  const [costSilver, setCostSilver] = useState<number>(0);
  const [skillAttribute, setSkillAttribute] = useState<string>('💪');
  const [skillDiscipline, setSkillDiscipline] = useState<string>('General');
  const [skillDisciplineNewText, setSkillDisciplineNewText] = useState<string>('');
  const [pathCategory, setPathCategory] = useState<string>('General');
  const [pathCategoryNewText, setPathCategoryNewText] = useState<string>('');
  const [pathDescription, setPathDescription] = useState<string>('');
  const [linkedElements, setLinkedElements] = useState<PathLinkedElement[]>([]);
  const [effect, setEffect] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // Unified Paths & Abilities Studio State
  const [pathStudioMode, setPathStudioMode] = useState<'path' | 'standalone'>('path');
  const [pathDatabaseCategory] = useState<'path' | 'power' | 'trait' | 'skill'>('path');
  const [isCreatingNewPath, setIsCreatingNewPath] = useState<boolean>(false);
  const [isCreatingNewChaosGem, setIsCreatingNewChaosGem] = useState<boolean>(false);
  const [isCreatingNewGear, setIsCreatingNewGear] = useState<boolean>(false);
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [activePathSelection, setActivePathSelection] = useState<{
    type: 'path_root' | 'path_element' | 'path_set' | 'path_add_set' | 'path_add_element' | 'path' | 'ability';
    category?: string;
    id?: string | number;
    name?: string;
    element?: PathLinkedElement;
    set?: any;
    setItem?: any;
    setRecord?: any;
    index?: number;
    parentSkillSet?: string;
    isNew?: boolean;
    data?: any;
    source?: 'new' | 'existing';
  }>({ type: 'path_root' });
  const [unlinkWarningTarget, setUnlinkWarningTarget] = useState<{
    type: 'trait' | 'power' | 'skill';
    item: any;
    currentPath: string;
  } | null>(null);
  const [activeAbilityCategory, setActiveAbilityCategory] = useState<PathElementType>('power');

  // Standalone/Inline Ability Form States
  const [abilityFormName, setAbilityFormName] = useState<string>('');
  const [abilityFormAction, setAbilityFormAction] = useState<string>('AM');
  const [abilityFormUsage, setAbilityFormUsage] = useState<string>('1-Enc');
  const [abilityFormEffect, setAbilityFormEffect] = useState<string>('');
  const [abilityFormSkillAttribute, setAbilityFormSkillAttribute] = useState<string>('💪');
  const [abilityFormSkillDiscipline, setAbilityFormSkillDiscipline] = useState<string>('General');
  const [abilityFormSkillDisciplineNewText, setAbilityFormSkillDisciplineNewText] = useState<string>('');
  const [abilityFormSkillsetSkills, setAbilityFormSkillsetSkills] = useState<string[]>(['', '']);
  const [abilityFormNotes, setAbilityFormNotes] = useState<string>('');
  const [abilityFormGenres, setAbilityFormGenres] = useState<string[]>([]);

  // Authoritative Guardrail: Non-Designer accounts can NEVER enter standalone/Universal ability mode
  useEffect(() => {
    if (!isMetaScapeDesigner && pathStudioMode === 'standalone') {
      setPathStudioMode('path');
    }
  }, [isMetaScapeDesigner, pathStudioMode]);

  // --- Sets Studio State ---
  const [selectedSetCategory, setSelectedSetCategory] = useState<SetCategory>('Weapons');
  const [setDescription, setSetDescription] = useState<string>('');
  const [draftSetItems, setDraftSetItems] = useState<SetMemberItem[]>([]);
  const [basedOnSourceSets, setBasedOnSourceSets] = useState<string[]>([]);
  const [initialBaseItemIds, setInitialBaseItemIds] = useState<Set<string>>(new Set());
  const [initialExistingMemberIds, setInitialExistingMemberIds] = useState<Set<string>>(new Set());
  const [isCreatingNewSet, setIsCreatingNewSet] = useState<boolean>(false);
  const [selectedSetId, setSelectedSetId] = useState<string>('');
  const [activeSetSelection, setActiveSetSelection] = useState<{
    type: 'set_root' | 'set_member' | 'set_add_member';
    item?: SetMemberItem;
    index?: number;
  }>({ type: 'set_root' });
  const [setPathsIncluded, setSetPathsIncluded] = useState<string[]>([]);
  const [setsSearchQuery, setSetsSearchQuery] = useState<string>('');
  const [setsRightCatalogSearchQuery, setSetsRightCatalogSearchQuery] = useState<string>('');
  const [isSavingSet, setIsSavingSet] = useState<boolean>(false);
  const [selectedBaseSetName, setSelectedBaseSetName] = useState<string>('');
  const [baseSetMembers, setBaseSetMembers] = useState<SetMemberItem[]>([]);
  const [isLoadingBaseMembers, setIsLoadingBaseMembers] = useState<boolean>(false);

  // --- Paths Studio Expansion State (Phase 4) ---
  const [isAuthoringPathCustomAbility, setIsAuthoringPathCustomAbility] = useState<boolean>(false);
  const [customAbilityType, setCustomAbilityType] = useState<'trait' | 'power' | 'skill'>('power');
  const [customAbilityTag, setCustomAbilityTag] = useState<'Free' | '1 AP'>('1 AP');
  const [customAbilityName, setCustomAbilityName] = useState<string>('');
  const [customAbilityAction, setCustomAbilityAction] = useState<string>('AM');
  const [customAbilityUsage, setCustomAbilityUsage] = useState<string>('1-Enc');
  const [customAbilityEffect, setCustomAbilityEffect] = useState<string>('');
  const [customAbilityNotes, setCustomAbilityNotes] = useState<string>('');
  const [customAbilityAttribute, setCustomAbilityAttribute] = useState<string>('💪');
  const [customAbilityDiscipline, setCustomAbilityDiscipline] = useState<string>('General');

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

  // Unified Gear Studio State
  const [gearDatabaseChassis, setGearDatabaseChassis] = useState<'weapon' | 'armor' | 'shield' | 'supplies'>('weapon');

  // Authoritative Guardrail: Non-Master accounts can NEVER access the Canon scope
  useEffect(() => {
    if (!isMasterAccount && workshopMode === 'designer') {
      setWorkshopMode('player');
    }
  }, [isMasterAccount, workshopMode]);
  const [canonicalChaosGems, setCanonicalChaosGems] = useState<SupabaseChaosGem[]>([]);
  const [canonicalSearchQuery, setCanonicalSearchQuery] = useState<string>('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: string;
    id: string | number;
    name: string;
  } | null>(null);
  const [isDeletingCanonical, setIsDeletingCanonical] = useState<boolean>(false);
  const [costMode, setCostMode] = useState<'standard' | 'artifact'>('standard');
  const [activeStudioSelection, setActiveStudioSelection] = useState<{
    type: 'chassis' | 'mod' | 'power';
    id?: string;
    isNew?: boolean;
    parentType?: 'inherent' | 'mod';
    parentId?: string;
  }>({ type: 'chassis' });
  const [studioChassisType, setStudioChassisType] = useState<'weapon' | 'armor' | 'shield' | 'supplies'>('supplies');
  const [inherentPowers, setInherentPowers] = useState<StudioPower[]>([]);
  const [attachedMods, setAttachedMods] = useState<StudioMod[]>([]);
  const [isAuthoringNewMaster, setIsAuthoringNewMaster] = useState<boolean>(false);
  const [deletedPowerIds, setDeletedPowerIds] = useState<(string | number)[]>([]);
  const [deletedModIds, setDeletedModIds] = useState<(string | number)[]>([]);

  // Studio Mod Form Working State
  const [modFormId, setModFormId] = useState<string>('');
  const [modFormName, setModFormName] = useState<string>('');
  const [modFormGold, setModFormGold] = useState<number>(0);
  const [modFormSilver, setModFormSilver] = useState<number>(0);
  const [modFormNotes, setModFormNotes] = useState<string>('');

  // Studio Power Form Working State
  const [powerFormId, setPowerFormId] = useState<string>('');
  const [powerFormParentType, setPowerFormParentType] = useState<'inherent' | 'mod'>('inherent');
  const [powerFormParentId, setPowerFormParentId] = useState<string | undefined>(undefined);
  const [powerFormName, setPowerFormName] = useState<string>('');
  const [powerFormAction, setPowerFormAction] = useState<string>('AM');
  const [powerFormUsage, setPowerFormUsage] = useState<string>('1-Enc');
  const [powerFormEffect, setPowerFormEffect] = useState<string>('');
  const studioEffectTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Power Form Match & Collision Status
  const exactCanonPowerMatch = useMemo(() => {
    const clean = powerFormName.trim().toLowerCase();
    if (!clean) return null;
    return (functionsCatalog || []).find((fn) => (fn.name || '').trim().toLowerCase() === clean) || null;
  }, [functionsCatalog, powerFormName]);

  const isPowerFormExactMatch = useMemo(() => {
    if (!exactCanonPowerMatch) return false;
    const sameAction = (exactCanonPowerMatch.action || 'AM') === (powerFormAction || 'AM');
    const sameUsage = (exactCanonPowerMatch.usage || '1-Enc') === (powerFormUsage || '1-Enc');
    const sameEffect = (exactCanonPowerMatch.effect || '').trim().toLowerCase() === powerFormEffect.trim().toLowerCase();
    return sameAction && sameUsage && sameEffect;
  }, [exactCanonPowerMatch, powerFormAction, powerFormUsage, powerFormEffect]);

  const matchingCanonPowers = useMemo(() => {
    const clean = powerFormName.trim().toLowerCase();
    if (!clean || clean.length < 2) return [];
    return (functionsCatalog || [])
      .filter((fn) => (fn.name || '').trim().toLowerCase().includes(clean))
      .slice(0, 4);
  }, [functionsCatalog, powerFormName]);

  // Mod Form Match & Collision Status
  const modFormCostStr = useMemo(() => {
    if (modFormGold > 0 || modFormSilver > 0) {
      return `${modFormGold > 0 ? `${modFormGold}g` : ''}${modFormGold > 0 && modFormSilver > 0 ? ' ' : ''}${modFormSilver > 0 ? `${modFormSilver}s` : ''}`.trim();
    }
    return '0s';
  }, [modFormGold, modFormSilver]);

  const exactCanonModMatch = useMemo(() => {
    const clean = modFormName.trim().toLowerCase();
    if (!clean) return null;
    return (modsCatalog || []).find((m) => (m.name || '').trim().toLowerCase() === clean) || null;
  }, [modsCatalog, modFormName]);

  const isModFormExactMatch = useMemo(() => {
    if (!exactCanonModMatch) return false;
    const sameCost = (exactCanonModMatch.cost || '0s').trim().toLowerCase() === modFormCostStr.toLowerCase();
    return sameCost;
  }, [exactCanonModMatch, modFormCostStr]);

  const isSelfPowerEdit = useMemo(() => {
    if (!exactCanonPowerMatch || !powerFormId) return false;
    return String(exactCanonPowerMatch.id) === String(powerFormId);
  }, [exactCanonPowerMatch, powerFormId]);

  const isSelfModEdit = useMemo(() => {
    if (!exactCanonModMatch || !modFormId) return false;
    return String(exactCanonModMatch.id) === String(modFormId);
  }, [exactCanonModMatch, modFormId]);

  const matchingCanonMods = useMemo(() => {
    const clean = modFormName.trim().toLowerCase();
    if (!clean || clean.length < 2) return [];
    return (modsCatalog || [])
      .filter((m) => (m.name || '').trim().toLowerCase().includes(clean))
      .slice(0, 4);
  }, [modsCatalog, modFormName]);

  const handleStartAddInherentPower = () => {
    if (!isChassisComplete) return;
    setPowerFormId(`new_pwr_${Date.now()}`);
    setPowerFormParentType('inherent');
    setPowerFormParentId(undefined);
    setPowerFormName('');
    setPowerFormAction('AM');
    setPowerFormUsage('1-Enc');
    setPowerFormEffect('');
    setActiveStudioSelection({ type: 'power', parentType: 'inherent', id: 'new', isNew: true });
  };

  const handleStartEditInherentPower = (pwr: StudioPower) => {
    setPowerFormId(pwr.id);
    setPowerFormParentType('inherent');
    setPowerFormParentId(undefined);
    setPowerFormName(pwr.name);
    setPowerFormAction(pwr.action);
    setPowerFormUsage(pwr.usage);
    setPowerFormEffect(pwr.effect);
    setActiveStudioSelection({ type: 'power', parentType: 'inherent', id: pwr.id });
  };

  const handleDeleteInherentPower = async (pwrId: string) => {
    setInherentPowers((prev) => prev.filter((p) => p.id !== pwrId));
    const isExisting = isCanonicalDbId(pwrId);
    if (isExisting) {
      setDeletedPowerIds((prev) => [...prev, Number(pwrId)]);
    }

    const isHostSavedInDb = workshopMode === 'designer' && Boolean(canonicalSelectedId);
    const hostBelongsTo =
      studioChassisType === 'weapon'
        ? `Weapon: ${name.trim()}`
        : studioChassisType === 'armor'
        ? `Armor: ${name.trim()}`
        : studioChassisType === 'shield'
        ? `Shield: ${name.trim()}`
        : `Supplies: ${name.trim()}`;

    if (isHostSavedInDb && isExisting) {
      try {
        await gameApi.unlinkCanonicalGearPower(Number(pwrId), hostBelongsTo);
        await refreshCatalogs();
        setFeedback({
          type: 'success',
          message: `🗑️ Removed power from ${name.trim()} in Master Database!`,
        });
      } catch (err: any) {
        console.error('[handleDeleteInherentPower] Error unlinking power:', err);
      }
    }

    if (activeStudioSelection.type === 'power' && activeStudioSelection.id === pwrId) {
      setActiveStudioSelection({ type: 'chassis' });
    }
  };

  const handleStartAddMod = () => {
    if (!isChassisComplete) return;
    setModFormId(`new_mod_${Date.now()}`);
    setModFormName('');
    setModFormGold(0);
    setModFormSilver(0);
    setModFormNotes('');
    setActiveStudioSelection({ type: 'mod', id: 'new', isNew: true });
  };

  const handleStartEditMod = (mod: StudioMod) => {
    setModFormId(mod.id);
    setModFormName(mod.name);
    setModFormGold(mod.costGold);
    setModFormSilver(mod.costSilver);
    setModFormNotes(mod.notes);
    setActiveStudioSelection({ type: 'mod', id: mod.id });
  };

  const handleDeleteMod = async (modId: string) => {
    const modToDelete = attachedMods.find((m) => m.id === modId);
    if (modToDelete) {
      modToDelete.powers.forEach((p) => {
        if (isCanonicalDbId(p.id)) {
          setDeletedPowerIds((prev) => [...prev, Number(p.id)]);
        }
      });
    }
    const isExisting = isCanonicalDbId(modId);
    if (isExisting) {
      setDeletedModIds((prev) => [...prev, Number(modId)]);
    }
    setAttachedMods((prev) => prev.filter((m) => m.id !== modId));

    const isHostSavedInDb = workshopMode === 'designer' && Boolean(canonicalSelectedId);
    const hostBelongsTo =
      studioChassisType === 'weapon'
        ? `Weapon: ${name.trim()}`
        : studioChassisType === 'armor'
        ? `Armor: ${name.trim()}`
        : studioChassisType === 'shield'
        ? `Shield: ${name.trim()}`
        : `Supplies: ${name.trim()}`;

    if (isHostSavedInDb && isExisting) {
      try {
        await gameApi.unlinkCanonicalMod(Number(modId), hostBelongsTo);
        await refreshCatalogs();
        setFeedback({
          type: 'success',
          message: `🗑️ Removed mod from ${name.trim()} in Master Database!`,
        });
      } catch (err: any) {
        console.error('[handleDeleteMod] Error unlinking mod:', err);
      }
    }

    if (
      (activeStudioSelection.type === 'mod' && activeStudioSelection.id === modId) ||
      (activeStudioSelection.type === 'power' && activeStudioSelection.parentId === modId)
    ) {
      setActiveStudioSelection({ type: 'chassis' });
    }
  };

  const handleStartAddPowerToMod = (mod: StudioMod) => {
    if (!isChassisComplete) return;
    setPowerFormId(`new_pwr_${Date.now()}`);
    setPowerFormParentType('mod');
    setPowerFormParentId(mod.id);
    setPowerFormName('');
    setPowerFormAction('AM');
    setPowerFormUsage('1-Enc');
    setPowerFormEffect('');
    setActiveStudioSelection({ type: 'power', parentType: 'mod', parentId: mod.id, id: 'new', isNew: true });
  };

  const handleStartEditModPower = (mod: StudioMod, pwr: StudioPower) => {
    setPowerFormId(pwr.id);
    setPowerFormParentType('mod');
    setPowerFormParentId(mod.id);
    setPowerFormName(pwr.name);
    setPowerFormAction(pwr.action);
    setPowerFormUsage(pwr.usage);
    setPowerFormEffect(pwr.effect);
    setActiveStudioSelection({ type: 'power', parentType: 'mod', parentId: mod.id, id: pwr.id });
  };

  const handleDeleteModPower = (modId: string, pwrId: string) => {
    if (isCanonicalDbId(pwrId)) {
      setDeletedPowerIds((prev) => [...prev, Number(pwrId)]);
    }
    setAttachedMods((prev) =>
      prev.map((m) => (m.id === modId ? { ...m, powers: m.powers.filter((p) => p.id !== pwrId) } : m))
    );
    if (activeStudioSelection.type === 'power' && activeStudioSelection.id === pwrId) {
      setActiveStudioSelection({ type: 'chassis' });
    }
  };

  const handleSaveModForm = async () => {
    if (!modFormName.trim()) return;
    let resolvedId =
      exactCanonModMatch && isModFormExactMatch && exactCanonModMatch.id
        ? String(exactCanonModMatch.id)
        : modFormId || `new_mod_${Date.now()}`;

    const isHostSavedInDb = workshopMode === 'designer' && Boolean(canonicalSelectedId);
    const hostBelongsTo =
      studioChassisType === 'weapon'
        ? `Weapon: ${name.trim()}`
        : studioChassisType === 'armor'
        ? `Armor: ${name.trim()}`
        : studioChassisType === 'shield'
        ? `Shield: ${name.trim()}`
        : `Supplies: ${name.trim()}`;

    if (isHostSavedInDb) {
      try {
        setIsSubmitting(true);
        const modPayload = {
          name: modFormName.trim(),
          cost: modFormCostStr,
          notes: modFormNotes.trim() || null,
          belongs_to: hostBelongsTo,
          owner: 'Designer',
        };

        const isExistingModInDb = isCanonicalDbId(resolvedId);

        if (isExistingModInDb) {
          await gameApi.updateCanonicalMod(Number(resolvedId), modPayload);
          setFeedback({
            type: 'success',
            message: `👑 Updated Mod '${modPayload.name}' in Master Database!`,
          });
        } else {
          const created = await gameApi.saveCanonicalMod(modPayload);
          if (created?.id) {
            resolvedId = String(created.id);
            setModFormId(String(created.id));
          }
          setFeedback({
            type: 'success',
            message: `👑 Created and attached Mod '${modPayload.name}' to ${name.trim()} in Master Database!`,
          });
        }
        await refreshCatalogs();
      } catch (err: any) {
        console.error('[handleSaveModForm] Error saving mod to DB:', err);
        setFeedback({
          type: 'error',
          message: `❌ Error saving mod: ${err.message || 'Database update failed.'}`,
        });
      } finally {
        setIsSubmitting(false);
      }
    }

    setAttachedMods((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === modFormId || m.id === resolvedId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          id: resolvedId,
          name: modFormName.trim(),
          costGold: modFormGold,
          costSilver: modFormSilver,
          notes: modFormNotes.trim(),
        };
        return updated;
      }
      return [
        ...prev,
        {
          id: resolvedId,
          name: modFormName.trim(),
          costGold: modFormGold,
          costSilver: modFormSilver,
          notes: modFormNotes.trim(),
          powers: [],
        },
      ];
    });
    setActiveStudioSelection({ type: 'chassis' });
  };

  const handleSavePowerForm = async () => {
    if (!powerFormName.trim() || !powerFormEffect.trim()) return;
    let resolvedId =
      exactCanonPowerMatch && isPowerFormExactMatch && exactCanonPowerMatch.id
        ? String(exactCanonPowerMatch.id)
        : powerFormId || `new_pwr_${Date.now()}`;

    const isHostSavedInDb = workshopMode === 'designer' && Boolean(canonicalSelectedId);
    const hostBelongsTo =
      powerFormParentType === 'inherent'
        ? studioChassisType === 'weapon'
          ? `Weapon: ${name.trim()}`
          : studioChassisType === 'armor'
          ? `Armor: ${name.trim()}`
          : studioChassisType === 'shield'
          ? `Shield: ${name.trim()}`
          : `Supplies: ${name.trim()}`
        : `Mod: ${attachedMods.find((m) => m.id === powerFormParentId)?.name || 'Custom'}`;

    if (isHostSavedInDb) {
      try {
        setIsSubmitting(true);
        const pwrPayload = {
          name: powerFormName.trim(),
          action: powerFormAction || 'AM',
          usage: powerFormUsage || '1-Enc',
          effect: powerFormEffect.trim(),
          owner: 'Designer',
        };

        const isExistingPowerInDb = isCanonicalDbId(resolvedId);

        if (isExistingPowerInDb) {
          await gameApi.updateCanonicalGearPower(Number(resolvedId), {
            ...pwrPayload,
            belongs_to: hostBelongsTo,
          });
          setFeedback({
            type: 'success',
            message: `👑 Updated '${pwrPayload.name}' in Master Database!`,
          });
        } else {
          const created = await gameApi.saveCanonicalGearPower({
            ...pwrPayload,
            belongs_to: hostBelongsTo,
          });
          if (created?.id) {
            resolvedId = String(created.id);
            setPowerFormId(String(created.id));
          }
          setFeedback({
            type: 'success',
            message: `👑 Created and linked '${pwrPayload.name}' to ${name.trim()} in Master Database!`,
          });
        }
        await refreshCatalogs();
      } catch (err: any) {
        console.error('[handleSavePowerForm] Error saving power to DB:', err);
        setFeedback({
          type: 'error',
          message: `❌ Error saving power: ${err.message || 'Database update failed.'}`,
        });
      } finally {
        setIsSubmitting(false);
      }
    }

    const pwrObj: StudioPower = {
      id: resolvedId,
      name: powerFormName.trim(),
      action: powerFormAction,
      usage: powerFormUsage,
      effect: powerFormEffect.trim(),
    };

    if (powerFormParentType === 'inherent') {
      setInherentPowers((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === powerFormId || p.id === resolvedId);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = pwrObj;
          return updated;
        }
        return [...prev, pwrObj];
      });
    } else if (powerFormParentType === 'mod' && powerFormParentId) {
      setAttachedMods((prev) =>
        prev.map((m) => {
          if (m.id !== powerFormParentId) return m;
          const existingIdx = m.powers.findIndex((p) => p.id === powerFormId || p.id === resolvedId);
          let updatedPowers = [...m.powers];
          if (existingIdx >= 0) {
            updatedPowers[existingIdx] = pwrObj;
          } else {
            updatedPowers.push(pwrObj);
          }
          return { ...m, powers: updatedPowers };
        })
      );
    }
    setActiveStudioSelection({ type: 'chassis' });
  };

  const insertStudioPowerTextAtCursor = (insertStr: string) => {
    const textarea = studioEffectTextareaRef.current;
    if (!textarea) {
      setPowerFormEffect((prev) => (prev ? prev + insertStr : insertStr));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentVal = powerFormEffect;
    const nextVal = currentVal.substring(0, start) + insertStr + currentVal.substring(end);
    setPowerFormEffect(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertStr.length, start + insertStr.length);
    }, 0);
  };

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
    setCanonicalSelectedId(null);
    setOriginalCanonicalName('');
    setName('');
    setAction('AM');
    setUsage('1-Enc');
    setCostGold(10);
    setCostSilver(0);
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
    setStudioChassisType(gearDatabaseChassis);
    setCostMode('standard');
    setInherentPowers([]);
    setAttachedMods([]);
    setActiveStudioSelection({ type: 'chassis' });
    setPathStudioMode('path');
    setIsCreatingNewPath(false);
    setIsCreatingNewChaosGem(false);
    setIsCreatingNewGear(false);
    setSelectedPathId('');
    setActivePathSelection({ type: 'path_root' });
    setActiveAbilityCategory('power');
    setAbilityFormName('');
    setAbilityFormAction('AM');
    setAbilityFormUsage('1-Enc');
    setAbilityFormEffect('');
    setAbilityFormSkillAttribute('💪');
    setAbilityFormSkillDiscipline('General');
    setAbilityFormSkillDisciplineNewText('');
    setAbilityFormSkillsetSkills(['', '']);
    setAbilityFormNotes('');
    setAbilityFormGenres([]);
    setModFormId('');
    setModFormName('');
    setModFormGold(0);
    setModFormSilver(0);
    setModFormNotes('');
    setPowerFormId('');
    setPowerFormName('');
    setPowerFormAction('AM');
    setPowerFormUsage('1-Enc');
    setPowerFormEffect('');
    setIsAuthoringNewMaster(false);
    setDeletedPowerIds([]);
    setDeletedModIds([]);
    setIsCreatingNewSet(false);
    setSelectedSetId('');
    setSetDescription('');
    setDraftSetItems([]);
    setSelectedBaseSetName('');
    setBaseSetMembers([]);
    setBasedOnSourceSets([]);
    setInitialBaseItemIds(new Set());
    setInitialExistingMemberIds(new Set());
    setSetPathsIncluded([]);
    setSetsSearchQuery('');
    setSetsRightCatalogSearchQuery('');
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
    if (item.type) {
      if (isGearType(item.type)) {
        setCreationType('gear');
      } else if (isPathOrAbilityType(item.type)) {
        setCreationType('paths_abilities');
        if (item.type === 'path') {
          setPathStudioMode('path');
          setActivePathSelection({ type: 'path_root' });
          setIsCreatingNewPath(false);
          setSelectedPathId(`custom_${item.id}`);
        } else {
          setPathStudioMode('standalone');
          setActiveAbilityCategory(item.type as PathElementType);
          setActivePathSelection({ type: 'ability', category: item.type as PathElementType, id: item.id });
        }
      } else {
        setCreationType(item.type);
      }
    }
    setName(item.name || '');
    setNotes(item.item_data?.notes || item.notes || '');
    if (item.item_data?.genres && Array.isArray(item.item_data.genres)) {
      setSelectedGenres(item.item_data.genres);
    } else {
      setSelectedGenres([]);
    }

    const rawCost = item.item_data?.cost;
    if (item.type === 'artifact' || rawCost === 'Artifact') {
      setCostMode('artifact');
      setCostGold(10);
      setCostSilver(0);
    } else {
      setCostMode('standard');
      if (rawCost) {
        const totalSilver = parseCostToSilver(rawCost);
        setCostGold(Math.floor(totalSilver / 100));
        setCostSilver(totalSilver % 100);
      } else {
        setCostGold(10);
        setCostSilver(0);
      }
    }

    if (item.type === 'power') {
      setAction(item.item_data?.action || 'AM');
      setUsage(item.item_data?.usage || '1-Enc');
      setEffect(item.item_data?.effect || '');
      setAbilityFormName(item.name || '');
      setAbilityFormAction(item.item_data?.action || 'AM');
      setAbilityFormUsage(item.item_data?.usage || '1-Enc');
      setAbilityFormEffect(item.item_data?.effect || '');
      setAbilityFormGenres(item.item_data?.genres || []);
      setAbilityFormNotes(item.item_data?.notes || item.notes || '');
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
      const existingLinked = item.item_data?.linked_elements;
      const resolved = Array.isArray(existingLinked) && existingLinked.length > 0
        ? existingLinked
        : resolvePathElementsFromCatalogs(item.name || '', {
            setsCatalog,
            powers,
            skills,
            traits,
            weaponsCatalog,
            armorCatalog,
            shieldsCatalog,
          });
      setLinkedElements(resolved);
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
      setAbilityFormName(item.name || '');
      setAbilityFormSkillAttribute(item.item_data?.attribute || '💪');
      setAbilityFormSkillDiscipline(disc);
      setAbilityFormGenres(item.item_data?.genres || []);
      setAbilityFormNotes(item.item_data?.notes || item.notes || '');
    } else if (item.type === 'skillset') {
      const sks = Array.isArray(item.item_data?.skills) && item.item_data.skills.length > 0 ? item.item_data.skills : ['', ''];
      setSelectedSkillsetSkills(sks);
      setAbilityFormName(item.name || '');
      setAbilityFormSkillsetSkills(sks);
      setAbilityFormGenres(item.item_data?.genres || []);
      setAbilityFormNotes(item.item_data?.notes || item.notes || '');
    } else if (item.type === 'trait') {
      setEffect(item.item_data?.effect || '');
      setAbilityFormName(item.name || '');
      setAbilityFormEffect(item.item_data?.effect || '');
      setAbilityFormGenres(item.item_data?.genres || []);
      setAbilityFormNotes(item.item_data?.notes || item.notes || '');
    } else if (isGearType(item.type)) {
      const chassis: 'weapon' | 'armor' | 'shield' | 'supplies' =
        (item.item_data?.chassis_type as any) ||
        (item.type === 'weapon' ? 'weapon' : item.type === 'armor' ? 'armor' : item.type === 'shield' ? 'shield' : 'supplies');
      setStudioChassisType(chassis);

      // Inherent Powers
      if (Array.isArray(item.item_data?.inherent_powers)) {
        setInherentPowers(item.item_data.inherent_powers);
      } else if (item.item_data?.effect && (item.type === 'exotic' || item.type === 'artifact')) {
        setInherentPowers([
          {
            id: `pwr_legacy_${Date.now()}`,
            name: item.name || 'Inherent Power',
            action: item.item_data?.action || 'AM',
            usage: item.item_data?.usage || '1-Enc',
            effect: item.item_data.effect,
          },
        ]);
      } else {
        setInherentPowers([]);
      }

      // Modular Mods
      if (Array.isArray(item.item_data?.mods)) {
        setAttachedMods(item.item_data.mods);
      } else {
        setAttachedMods([]);
      }

      // Chassis Stats & Configuration
      const stats = item.item_data?.chassis_stats;
      if (chassis === 'weapon') {
        const wMode = (item.item_data?.type as any) || stats?.type || 'Melee';
        setWeaponTypeMode(wMode);
        const wReq = item.item_data?.requirement || stats?.requirement;
        if (wReq) {
          const numMatch = wReq.match(/\d+/);
          if (numMatch) setWeaponReqNum(parseInt(numMatch[0], 10));
        }
        const dom = item.item_data?.domain || stats?.domain || 'Archaic';
        if (availableWeaponDomains.includes(dom)) {
          setWeaponDomain(dom);
          setWeaponDomainNewText('');
        } else {
          setWeaponDomain('CUSTOM_NEW');
          setWeaponDomainNewText(dom);
        }
      } else if (chassis === 'armor') {
        const aReq = item.item_data?.requirement || stats?.requirement || '💪 4';
        setArmorReq(aReq);
      } else if (chassis === 'shield') {
        const sReq = item.item_data?.requirement || stats?.requirement || '💪 4';
        setShieldReq(sReq);
        const dom = item.item_data?.domain || stats?.domain || 'Archaic';
        if (availableShieldDomains.includes(dom)) {
          setShieldDomain(dom);
          setShieldDomainNewText('');
        } else {
          setShieldDomain('CUSTOM_NEW');
          setShieldDomainNewText(dom);
        }
      } else if (chassis === 'supplies') {
        const cat = item.item_data?.category || stats?.category || 'Adventure';
        if (GEAR_DEFAULT_CATEGORIES.includes(cat)) {
          setGearCategory(cat);
          setGearCategoryNewText('');
        } else {
          setGearCategory('CUSTOM_NEW');
          setGearCategoryNewText(cat);
        }
      }

      // Chassis Lore / Passive Effect
      setEffect(item.item_data?.effect || '');

      setActiveStudioSelection({ type: 'chassis' });
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

  const cleanEmail = (playerEmail || '').trim().toLowerCase();

  // Helper to determine scope: canon vs mine
  const getItemScope = (itemOwner?: string): 'canon' | 'mine' => {
    if (!itemOwner || itemOwner === 'Designer') return 'canon';
    const ownerClean = itemOwner.toLowerCase();
    if (cleanEmail && ownerClean === cleanEmail) return 'mine';
    return 'canon';
  };

  // Normalized Gear Item for UI List Rendering
  interface NormalizedGearItem {
    id: string | number;
    name: string;
    chassis: 'weapon' | 'armor' | 'shield' | 'supplies';
    cost?: string;
    requirement?: string;
    details: string;
    notes?: string;
    owner?: string;
    rawItem: any;
  }

  const allGearItems = useMemo<NormalizedGearItem[]>(() => {
    const list: NormalizedGearItem[] = [];
    (weaponsCatalog || []).forEach((w) => {
      list.push({
        id: w.id || w.name,
        name: w.name,
        chassis: 'weapon',
        cost: w.cost,
        requirement: w.requirement,
        details: `${w.type || 'Melee'} • Req: ${w.requirement || '💪 4'} • Dmg: ${w.dmg || 'd6'}`,
        notes: w.notes || undefined,
        owner: w.owner,
        rawItem: w,
      });
    });
    (armorCatalog || []).forEach((a) => {
      list.push({
        id: a.id || a.name,
        name: a.name,
        chassis: 'armor',
        cost: a.cost,
        requirement: a.requirement,
        details: `Req: ${a.requirement || '💪 4'} • AR: ${a.ar || '4'} • MR: ${a.mr || '👣12'}`,
        notes: a.notes || undefined,
        owner: a.owner,
        rawItem: a,
      });
    });
    (shieldsCatalog || []).forEach((s) => {
      list.push({
        id: s.id || s.name,
        name: s.name,
        chassis: 'shield',
        cost: s.cost,
        requirement: s.requirement,
        details: `Req: ${s.requirement || '💪 4'} • Block: ${s.max_block || '💪'}${s.mr ? ` • MR: ${s.mr}` : ''}`,
        notes: s.notes || undefined,
        owner: s.owner,
        rawItem: s,
      });
    });
    (suppliesCatalog || []).forEach((sup) => {
      list.push({
        id: sup.id || sup.name,
        name: sup.name,
        chassis: 'supplies',
        cost: sup.cost,
        details: sup.category || 'Supplies',
        notes: sup.notes || undefined,
        owner: sup.owner,
        rawItem: sup,
      });
    });
    (personalItems || []).forEach((pi) => {
      if (isGearType(pi.type) || pi.type === 'gear' || pi.type === 'exotic' || pi.type === 'artifact') {
        const chassis = (pi.item_data?.chassis_type || 'supplies') as 'weapon' | 'armor' | 'shield' | 'supplies';
        if (!list.some((existing) => existing.name.toLowerCase() === pi.name.toLowerCase())) {
          list.push({
            id: pi.id,
            name: pi.name,
            chassis: chassis,
            cost: pi.item_data?.cost,
            requirement: pi.item_data?.requirement,
            details: pi.item_data?.category || pi.type,
            notes: pi.item_data?.notes || pi.notes,
            owner: cleanEmail,
            rawItem: pi,
          });
        }
      }
    });
    return list;
  }, [weaponsCatalog, armorCatalog, shieldsCatalog, suppliesCatalog, personalItems, cleanEmail]);

  const myGearItems = useMemo(() => {
    return allGearItems.filter((it) => getItemScope(it.owner) === 'mine');
  }, [allGearItems, cleanEmail]);

  const filteredMyGearItems = useMemo(() => {
    let items = myGearItems.filter((it) => it.chassis === gearDatabaseChassis);
    const q = canonicalSearchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter((it) => it.name.toLowerCase().includes(q) || (it.notes && it.notes.toLowerCase().includes(q)));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [myGearItems, gearDatabaseChassis, canonicalSearchQuery]);

  const isUniversalPath = (name || '').trim().toLowerCase() === 'universal';

  const executeUnlinkPathElement = async (
    type: 'trait' | 'power' | 'skill',
    item: any,
    currentPathClean: string,
    toUniversal: boolean
  ) => {
    try {
      if (workshopMode === 'designer') {
        if (toUniversal) {
          await gameApi.setCanonicalElementPath(type, item.id, 'Universal');
          updateCanonicalCatalogItem(type, { ...item, path: 'Universal' });
          setFeedback({
            type: 'success',
            message: `Moved '${item.name}' to the Universal Path.`,
          });
        } else {
          const res = await gameApi.unlinkCanonicalPathElement(type, item.id, currentPathClean);
          if (res.updatedItem) {
            updateCanonicalCatalogItem(type, res.updatedItem);
          }
          setFeedback({
            type: 'success',
            message: `Unlinked '${item.name}' from ${currentPathClean}.`,
          });
        }
      } else {
        setFeedback({
          type: 'success',
          message: `Unlinked '${item.name}' from ${currentPathClean}.`,
        });
      }
    } catch (err: any) {
      console.error('[executeUnlinkPathElement] Error:', err);
      setFeedback({
        type: 'error',
        message: `Failed to unlink: ${err.message || err}`,
      });
    } finally {
      setUnlinkWarningTarget(null);
    }
  };

  const executeHardDeletePathElement = async (type: 'trait' | 'power' | 'skill', item: any) => {
    try {
      if (workshopMode === 'designer') {
        if (type === 'trait') await gameApi.deleteCanonicalTrait(item.id);
        else if (type === 'power') await gameApi.deleteCanonicalPower(item.id);
        else if (type === 'skill') await gameApi.deleteCanonicalSkill(item.id);
        removeCanonicalCatalogItem(type, item.id);
        setFeedback({
          type: 'success',
          message: `👑 Permanently deleted '${item.name}' from Supabase Master Database.`,
        });
      }
    } catch (err: any) {
      console.error('[executeHardDeletePathElement] Error:', err);
      setFeedback({
        type: 'error',
        message: `Failed to delete: ${err.message || err}`,
      });
    } finally {
      setUnlinkWarningTarget(null);
    }
  };

  // Normalized Chaos Gems for UI List Rendering
  const myGems = useMemo(() => {
    const list: any[] = [];
    (chaosGemsCatalog || []).forEach((g) => {
      if (getItemScope(g.owner) === 'mine') {
        list.push(g);
      }
    });
    (personalItems || []).forEach((pi) => {
      if (pi.type === 'chaos_gem') {
        if (!list.some((existing) => existing.name.toLowerCase() === pi.name.toLowerCase())) {
          list.push({
            id: pi.id,
            name: pi.name,
            action: pi.item_data?.action || 'F',
            usage: pi.item_data?.usage || '3 Uses',
            effect: pi.item_data?.effect || '',
            notes: pi.item_data?.notes || pi.notes,
            genres: pi.item_data?.genres,
            owner: cleanEmail,
            rawItem: pi,
          });
        }
      }
    });
    return list;
  }, [chaosGemsCatalog, personalItems, cleanEmail]);

  const filteredMyGems = useMemo(() => {
    let items = myGems;
    const q = canonicalSearchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter((g) => g.name.toLowerCase().includes(q) || (g.effect && g.effect.toLowerCase().includes(q)));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [myGems, canonicalSearchQuery]);

  const handleSwitchScope = (mode: 'player' | 'designer') => {
    setWorkshopMode(mode);
    handleResetForm();
    setCanonicalSearchQuery('');
    setCanonicalSelectedId(null);
    setSelectedPathId('');
  };

  const handleLoadTemplateIntoForge = (chassisOrType: string, item: any) => {
    if (chassisOrType === 'weapon') handlePopulateCanonicalWeapon(item);
    else if (chassisOrType === 'armor') handlePopulateCanonicalArmor(item);
    else if (chassisOrType === 'shield') handlePopulateCanonicalShield(item);
    else if (chassisOrType === 'supplies') handlePopulateCanonicalSupply(item);
    else if (chassisOrType === 'path') handlePopulateOfficialPath(item);
    else if (chassisOrType === 'power') handlePopulateCanonicalPower(item);
    else if (chassisOrType === 'trait') handlePopulateCanonicalTrait(item);
    else if (chassisOrType === 'skill') handlePopulateCanonicalSkill(item);
    else if (chassisOrType === 'chaos_gem') handlePopulateCanonicalChaosGem(item);

    // Detach canonical master id so it saves as player's own new creation
    setCanonicalSelectedId(null);
    setOriginalCanonicalName('');
    setName(`${item.name} (Custom)`);
  };

  const displayList = useMemo(() => {
    if (listFilterMode === 'all') {
      return sortedPersonalItems;
    }
    return sortedPersonalItems.filter((it) => it.type === creationType);
  }, [sortedPersonalItems, listFilterMode, creationType]);

  // Filtered custom paths created by the user for My Creations dropdown
  const myPathsList = useMemo(() => {
    const list: { id: string; name: string; category?: string; rawItem: any; source: 'supabase' | 'personal' }[] = [];
    (paths || []).forEach((p) => {
      if (getItemScope(p.owner) === 'mine') {
        list.push({
          id: `sp_${p.id || p.name}`,
          name: p.name,
          category: p.category || 'Path',
          rawItem: p,
          source: 'supabase',
        });
      }
    });
    (personalItems || []).forEach((it) => {
      if (it.type === 'path') {
        if (!list.some((existing) => existing.name.toLowerCase() === it.name.toLowerCase())) {
          list.push({
            id: `pi_${it.id}`,
            name: it.name,
            category: it.item_data?.category || 'Path',
            rawItem: it,
            source: 'personal',
          });
        }
      }
    });
    const q = canonicalSearchQuery.trim().toLowerCase();
    if (!q) return list.sort((a, b) => a.name.localeCompare(b.name));
    return list
      .filter((p) => p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [paths, personalItems, cleanEmail, canonicalSearchQuery]);

  // Canonical Search Filtered Lists (Designer Mode SupaBase)
  const filteredCanonicalWeapons = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (weaponsCatalog || []).filter((w) => getItemScope(w.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (w) =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.type || '').toLowerCase().includes(q) ||
        (w.requirement || '').toLowerCase().includes(q) ||
        (w.domain || '').toLowerCase().includes(q)
    );
  }, [weaponsCatalog, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalArmor = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (armorCatalog || []).filter((a) => getItemScope(a.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.requirement || '').toLowerCase().includes(q) ||
        (a.ar || '').toLowerCase().includes(q)
    );
  }, [armorCatalog, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalShields = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (shieldsCatalog || []).filter((s) => getItemScope(s.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.requirement || '').toLowerCase().includes(q) ||
        (s.domain || '').toLowerCase().includes(q)
    );
  }, [shieldsCatalog, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalSupplies = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (suppliesCatalog || []).filter((sup) => getItemScope(sup.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (sup) =>
        (sup.name || '').toLowerCase().includes(q) ||
        (sup.category || '').toLowerCase().includes(q) ||
        (sup.cost || '').toLowerCase().includes(q)
    );
  }, [suppliesCatalog, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalPaths = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (paths || []).filter((p) => getItemScope(p.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [paths, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalPowers = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (powers || []).filter((p) => getItemScope(p.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.action || '').toLowerCase().includes(q) ||
        (p.usage || '').toLowerCase().includes(q) ||
        (p.effect || '').toLowerCase().includes(q)
    );
  }, [powers, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalTraits = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (traits || []).filter((t) => getItemScope(t.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (t) =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.effect || '').toLowerCase().includes(q)
    );
  }, [traits, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalSkills = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const canonItems = (skills || []).filter((s) => getItemScope(s.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.discipline || '').toLowerCase().includes(q) ||
        (s.attribute || '').toLowerCase().includes(q)
    );
  }, [skills, canonicalSearchQuery, cleanEmail]);

  const filteredCanonicalChaosGems = useMemo(() => {
    const q = canonicalSearchQuery.trim().toLowerCase();
    const gemSource = chaosGemsCatalog && chaosGemsCatalog.length > 0 ? chaosGemsCatalog : canonicalChaosGems;
    const canonItems = (gemSource || []).filter((g) => getItemScope(g.owner) === 'canon');
    if (!q) return canonItems;
    return canonItems.filter(
      (g) =>
        (g.name || '').toLowerCase().includes(q) ||
        (g.effect || '').toLowerCase().includes(q) ||
        (g.notes || '').toLowerCase().includes(q)
    );
  }, [chaosGemsCatalog, canonicalChaosGems, canonicalSearchQuery, cleanEmail]);

  const handlePopulateOfficialPath = (official: any) => {
    setEditingItem(null);
    setIsCreatingNewPath(false);
    setSelectedPathId(`official_${official.id || official.name}`);
    if (workshopMode === 'designer') {
      setCanonicalSelectedId(official.id || official.name);
      setOriginalCanonicalName(official.name);
      setName(official.name);
    } else {
      setCanonicalSelectedId(null);
      setOriginalCanonicalName('');
      setName(`${official.name} (Custom)`);
    }
    setPathCategory(official.category || 'General');
    setPathCategoryNewText('');
    setPathDescription(official.description || '');
    const resolvedElements = Array.isArray(official.linked_elements) && official.linked_elements.length > 0
      ? official.linked_elements
      : resolvePathElementsFromCatalogs(official.name, {
          setsCatalog,
          powers,
          skills,
          traits,
          weaponsCatalog,
          armorCatalog,
          shieldsCatalog,
        });
    setLinkedElements(resolvedElements);
    setSelectedGenres(official.genres && official.genres.length > 0 ? official.genres : ['Medieval']);
    setActivePathSelection({ type: 'path_root' });
  };

  const handlePopulateCanonicalPower = (p: any) => {
    setCanonicalSelectedId(p.id || p.name);
    setOriginalCanonicalName(p.name || '');
    setName(p.name || '');
    setAbilityFormName(p.name || '');
    setAbilityFormAction(p.action || 'AM');
    setAbilityFormUsage(p.usage || '1-Enc');
    setAbilityFormEffect(p.effect || '');
    setAbilityFormNotes(p.notes || '');
    setAbilityFormGenres(Array.isArray(p.genres) ? p.genres : ['Medieval']);
    setActiveAbilityCategory('power');
    setPathStudioMode('standalone');
    setEditingItem(null);
  };

  const handlePopulateCanonicalTrait = (t: any) => {
    setCanonicalSelectedId(t.id || t.name);
    setOriginalCanonicalName(t.name || '');
    setName(t.name || '');
    setAbilityFormName(t.name || '');
    setAbilityFormEffect(t.effect || '');
    setAbilityFormNotes(t.notes || '');
    setAbilityFormGenres(Array.isArray(t.genres) ? t.genres : ['Medieval']);
    setActiveAbilityCategory('trait');
    setPathStudioMode('standalone');
    setEditingItem(null);
  };

  const handlePopulateCanonicalSkill = (s: any) => {
    setCanonicalSelectedId(s.id || s.name);
    setOriginalCanonicalName(s.name || '');
    setName(s.name || '');
    setAbilityFormName(s.name || '');
    setAbilityFormSkillAttribute(s.attribute || '💪');
    setAbilityFormSkillDiscipline(s.discipline || 'General');
    setAbilityFormNotes(s.notes || '');
    setAbilityFormGenres(Array.isArray(s.genres) ? s.genres : ['Medieval']);
    setActiveAbilityCategory('skill');
    setPathStudioMode('standalone');
    setEditingItem(null);
  };

  const loadGearInherentPowersAndMods = (item: any) => {
    // 1. If explicit powers/mods attached on custom element payload:
    if (item?.item_data?.inherent_powers || item?.inherent_powers) {
      const inh = (item.item_data?.inherent_powers || item.inherent_powers || []) as StudioPower[];
      const mds = (item.item_data?.mods || item.mods || []) as StudioMod[];
      return { inherent: inh, mods: mds };
    }

    // 2. Query functionsCatalog and modsCatalog using isBelongsToMatch:
    const itemName = item?.name || '';
    const inherent: StudioPower[] = [];
    if (itemName && functionsCatalog && functionsCatalog.length > 0) {
      functionsCatalog.forEach((fn) => {
        if (isBelongsToMatch(fn.belongs_to, itemName, true)) {
          inherent.push({
            id: String(fn.id || `fn_${fn.name}`),
            name: fn.name,
            action: fn.action || 'F',
            usage: fn.usage || '1-Enc',
            effect: fn.effect || '',
          });
        }
      });
    }

    const mods: StudioMod[] = [];
    if (itemName && modsCatalog && modsCatalog.length > 0) {
      modsCatalog.forEach((m) => {
        if (isBelongsToMatch(m.belongs_to, itemName, true)) {
          const modPowers: StudioPower[] = [];
          if (functionsCatalog && functionsCatalog.length > 0) {
            functionsCatalog.forEach((fn) => {
              if (isBelongsToMatch(fn.belongs_to, m.name, true)) {
                modPowers.push({
                  id: String(fn.id || `fn_${fn.name}`),
                  name: fn.name,
                  action: fn.action || 'F',
                  usage: fn.usage || '1-Enc',
                  effect: fn.effect || '',
                });
              }
            });
          }

          let gold = 0;
          let silver = 0;
          if (m.cost) {
            const mg = String(m.cost).match(/(\d+)\s*g/i);
            const ms = String(m.cost).match(/(\d+)\s*s/i);
            if (mg) gold = parseInt(mg[1], 10);
            if (ms) silver = parseInt(ms[1], 10);
          }

          mods.push({
            id: String(m.id || `mod_${m.name}`),
            name: m.name,
            costGold: gold,
            costSilver: silver,
            notes: m.notes || '',
            powers: modPowers,
          });
        }
      });
    }

    return { inherent, mods };
  };

  const handlePopulateCanonicalWeapon = (w: any) => {
    const isCustom = Boolean(w.item_data || w.author_email);
    if (isCustom) {
      setEditingItem(w);
      setCanonicalSelectedId(null);
      setOriginalCanonicalName('');
    } else {
      setEditingItem(null);
      setCanonicalSelectedId(w.id || w.name);
      setOriginalCanonicalName(w.name || '');
    }
    setName(w.name || '');
    setStudioChassisType('weapon');
    setWeaponTypeMode(w.type || 'Melee');
    setWeaponDomain(w.domain || 'Archaic');
    setNotes(w.notes || '');

    const isArt = (w.cost && String(w.cost).toLowerCase().includes('artifact')) || w.item_data?.cost === 'Artifact';
    setCostMode(isArt ? 'artifact' : 'standard');

    if (w.cost && !isArt) {
      const matchG = String(w.cost).match(/(\d+)\s*g/i);
      const matchS = String(w.cost).match(/(\d+)\s*s/i);
      setCostGold(matchG ? parseInt(matchG[1], 10) : 0);
      setCostSilver(matchS ? parseInt(matchS[1], 10) : 0);
    }
    if (w.requirement) {
      const numMatch = String(w.requirement).match(/\d+/);
      if (numMatch) setWeaponReqNum(parseInt(numMatch[0], 10));
    }

    const rawGenres = w.genres || w.item_data?.genres;
    setSelectedGenres(Array.isArray(rawGenres) && rawGenres.length > 0 ? rawGenres : ['Medieval']);

    const { inherent, mods } = loadGearInherentPowersAndMods(w);
    setInherentPowers(inherent);
    setAttachedMods(mods);
    setIsAuthoringNewMaster(false);
    setActiveStudioSelection({ type: 'chassis' });
  };

  const handlePopulateCanonicalArmor = (a: any) => {
    const isCustom = Boolean(a.item_data || a.author_email);
    if (isCustom) {
      setEditingItem(a);
      setCanonicalSelectedId(null);
      setOriginalCanonicalName('');
    } else {
      setEditingItem(null);
      setCanonicalSelectedId(a.id || a.name);
      setOriginalCanonicalName(a.name || '');
    }
    setName(a.name || '');
    setStudioChassisType('armor');
    setArmorReq(a.requirement || '💪 4');
    setNotes(a.notes || '');

    const isArt = (a.cost && String(a.cost).toLowerCase().includes('artifact')) || a.item_data?.cost === 'Artifact';
    setCostMode(isArt ? 'artifact' : 'standard');

    if (a.cost && !isArt) {
      const matchG = String(a.cost).match(/(\d+)\s*g/i);
      const matchS = String(a.cost).match(/(\d+)\s*s/i);
      setCostGold(matchG ? parseInt(matchG[1], 10) : 0);
      setCostSilver(matchS ? parseInt(matchS[1], 10) : 0);
    }

    const rawGenres = a.genres || a.item_data?.genres;
    setSelectedGenres(Array.isArray(rawGenres) && rawGenres.length > 0 ? rawGenres : ['Medieval']);

    const { inherent, mods } = loadGearInherentPowersAndMods(a);
    setInherentPowers(inherent);
    setAttachedMods(mods);
    setIsAuthoringNewMaster(false);
    setActiveStudioSelection({ type: 'chassis' });
  };

  const handlePopulateCanonicalShield = (s: any) => {
    const isCustom = Boolean(s.item_data || s.author_email);
    if (isCustom) {
      setEditingItem(s);
      setCanonicalSelectedId(null);
      setOriginalCanonicalName('');
    } else {
      setEditingItem(null);
      setCanonicalSelectedId(s.id || s.name);
      setOriginalCanonicalName(s.name || '');
    }
    setName(s.name || '');
    setStudioChassisType('shield');
    setShieldReq(s.requirement || '💪 4');
    setShieldDomain(s.domain || 'Archaic');
    setNotes(s.notes || '');

    const isArt = (s.cost && String(s.cost).toLowerCase().includes('artifact')) || s.item_data?.cost === 'Artifact';
    setCostMode(isArt ? 'artifact' : 'standard');

    if (s.cost && !isArt) {
      const matchG = String(s.cost).match(/(\d+)\s*g/i);
      const matchS = String(s.cost).match(/(\d+)\s*s/i);
      setCostGold(matchG ? parseInt(matchG[1], 10) : 0);
      setCostSilver(matchS ? parseInt(matchS[1], 10) : 0);
    }

    const rawGenres = s.genres || s.item_data?.genres;
    setSelectedGenres(Array.isArray(rawGenres) && rawGenres.length > 0 ? rawGenres : ['Medieval']);

    const { inherent, mods } = loadGearInherentPowersAndMods(s);
    setInherentPowers(inherent);
    setAttachedMods(mods);
    setIsAuthoringNewMaster(false);
    setActiveStudioSelection({ type: 'chassis' });
  };

  const handlePopulateCanonicalSupply = (sup: any) => {
    const isCustom = Boolean(sup.item_data || sup.author_email);
    if (isCustom) {
      setEditingItem(sup);
      setCanonicalSelectedId(null);
      setOriginalCanonicalName('');
    } else {
      setEditingItem(null);
      setCanonicalSelectedId(sup.id || sup.name);
      setOriginalCanonicalName(sup.name || '');
    }
    setName(sup.name || '');
    setStudioChassisType('supplies');
    setGearCategory(sup.category || 'Adventure');
    setNotes(sup.notes || '');

    const isArt = (sup.cost && String(sup.cost).toLowerCase().includes('artifact')) || sup.item_data?.cost === 'Artifact';
    setCostMode(isArt ? 'artifact' : 'standard');

    if (sup.cost && !isArt) {
      const matchG = String(sup.cost).match(/(\d+)\s*g/i);
      const matchS = String(sup.cost).match(/(\d+)\s*s/i);
      setCostGold(matchG ? parseInt(matchG[1], 10) : 0);
      setCostSilver(matchS ? parseInt(matchS[1], 10) : 0);
    }

    const rawGenres = sup.genres || sup.item_data?.genres;
    setSelectedGenres(Array.isArray(rawGenres) && rawGenres.length > 0 ? rawGenres : ['Medieval']);

    const { inherent, mods } = loadGearInherentPowersAndMods(sup);
    setInherentPowers(inherent);
    setAttachedMods(mods);
    setIsAuthoringNewMaster(false);
    setActiveStudioSelection({ type: 'chassis' });
  };

  const handlePopulateCanonicalChaosGem = (g: SupabaseChaosGem) => {
    setCanonicalSelectedId(g.id ? String(g.id) : g.name);
    setOriginalCanonicalName(g.name || '');
    setName(g.name || '');
    setAction(g.action || 'F');
    setUsage(g.usage || '3-Enc');
    setEffect(g.effect || '');
    setNotes(g.notes || '');
    setSelectedGenres(Array.isArray(g.genres) && g.genres.length > 0 ? g.genres : ['Fantasy']);
    setEditingItem(null);
    setIsAuthoringNewMaster(false);
  };

  const handleNewMasterEntry = () => {
    setCanonicalSelectedId(null);
    setOriginalCanonicalName('');
    setEditingItem(null);
    setIsAuthoringNewMaster(true);
    setDeletedPowerIds([]);
    setDeletedModIds([]);
    setName('');
    setEffect('');
    setNotes('');
    setAction('AM');
    setUsage('1-Enc');
    setSelectedGenres([]);
    setLinkedElements([]);
    setPathDescription('');
    setCostGold(10);
    setCostSilver(0);
    setInherentPowers([]);
    setAttachedMods([]);
    setAbilityFormName('');
    setAbilityFormEffect('');
    setAbilityFormNotes('');
    setFeedback({
      type: 'success',
      message: '✨ Authoring new canonical entry in SupaBase Master Database.',
    });
  };

  const handleCanonicalSearchEnter = (currentArea: 'gear' | 'paths_abilities' | 'chaos_gem') => {
    if (currentArea === 'gear') {
      if (gearDatabaseChassis === 'weapon' && filteredCanonicalWeapons.length === 1) {
        handlePopulateCanonicalWeapon(filteredCanonicalWeapons[0]);
      } else if (gearDatabaseChassis === 'armor' && filteredCanonicalArmor.length === 1) {
        handlePopulateCanonicalArmor(filteredCanonicalArmor[0]);
      } else if (gearDatabaseChassis === 'shield' && filteredCanonicalShields.length === 1) {
        handlePopulateCanonicalShield(filteredCanonicalShields[0]);
      } else if (gearDatabaseChassis === 'supplies' && filteredCanonicalSupplies.length === 1) {
        handlePopulateCanonicalSupply(filteredCanonicalSupplies[0]);
      }
    } else if (currentArea === 'paths_abilities') {
      if (pathDatabaseCategory === 'path' && filteredCanonicalPaths.length === 1) {
        handlePopulateOfficialPath(filteredCanonicalPaths[0]);
      } else if (pathDatabaseCategory === 'power' && filteredCanonicalPowers.length === 1) {
        handlePopulateCanonicalPower(filteredCanonicalPowers[0]);
      } else if (pathDatabaseCategory === 'trait' && filteredCanonicalTraits.length === 1) {
        handlePopulateCanonicalTrait(filteredCanonicalTraits[0]);
      } else if (pathDatabaseCategory === 'skill' && filteredCanonicalSkills.length === 1) {
        handlePopulateCanonicalSkill(filteredCanonicalSkills[0]);
      }
    } else if (currentArea === 'chaos_gem') {
      if (filteredCanonicalChaosGems.length === 1) {
        handlePopulateCanonicalChaosGem(filteredCanonicalChaosGems[0]);
      }
    }
  };

  const loadCanonicalChaosGems = async () => {
    try {
      const gems = await gameApi.getChaosGems();
      setCanonicalChaosGems(gems || []);
    } catch (err) {
      console.error('[PlayerWorkshopModal] Error loading canonical chaos gems:', err);
    }
  };

  const handleConfirmDeleteCanonical = async () => {
    if (!deleteConfirmTarget) return;
    const { type, id, name: targetName } = deleteConfirmTarget;
    setIsDeletingCanonical(true);

    try {
      if (type === 'path') {
        if ((targetName || '').toLowerCase() === 'universal' || (name || '').toLowerCase() === 'universal') {
          setFeedback({
            type: 'error',
            message: '🛡️ The Universal Path is a permanent core archetype and cannot be deleted.',
          });
          setDeleteConfirmTarget(null);
          return;
        }
        await gameApi.deleteCanonicalPath(id);
        removeCanonicalCatalogItem('path', id, targetName);
      } else if (type === 'power') {
        await gameApi.deleteCanonicalPower(id);
        removeCanonicalCatalogItem('power', id, targetName);
      } else if (type === 'trait') {
        await gameApi.deleteCanonicalTrait(id);
        removeCanonicalCatalogItem('trait', id, targetName);
      } else if (type === 'skill') {
        await gameApi.deleteCanonicalSkill(id);
        removeCanonicalCatalogItem('skill', id, targetName);
      } else if (type === 'chaos_gem') {
        await gameApi.deleteCanonicalChaosGem(id);
        setCanonicalChaosGems((prev) => prev.filter((g) => String(g.id) !== String(id) && g.name !== targetName));
        removeCanonicalCatalogItem('chaos_gem', id, targetName);
      } else if (type === 'weapon') {
        await gameApi.deleteCanonicalWeapon(id);
        removeCanonicalCatalogItem('weapon', id, targetName);
      } else if (type === 'armor') {
        await gameApi.deleteCanonicalArmor(id);
        removeCanonicalCatalogItem('armor', id, targetName);
      } else if (type === 'shield') {
        await gameApi.deleteCanonicalShield(id);
        removeCanonicalCatalogItem('shield', id, targetName);
      } else if (type === 'supplies' || type === 'gear') {
        await gameApi.deleteCanonicalGear(id);
        removeCanonicalCatalogItem('supplies', id, targetName);
      }

      // Automatically purge from all character sheets across the database
      const purgeRes = await gameApi.propagateCanonicalDeletionToAllCharacters({
        entityType: (type === 'gear' ? 'supplies' : type) as any,
        targetName,
        targetId: id,
      });

      handleResetForm();
      setDeleteConfirmTarget(null);
      setFeedback({
        type: 'success',
        message: `👑 Deleted '${targetName}' from Supabase & purged from ${purgeRes.purgedCharacterCount} character(s)!`,
      });
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error deleting canonical record:', err);
      setFeedback({
        type: 'error',
        message: `❌ Failed to delete from Supabase: ${err.message || 'Unknown database error'}`,
      });
    } finally {
      setIsDeletingCanonical(false);
    }
  };

  // Load custom items, personal items, and canonical gems when modal is opened
  useEffect(() => {
    if (isOpen) {
      loadPersonalItems();
      loadCanonicalChaosGems();
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

  // --- Sets Studio Constants & Helpers ---
  const SET_CATEGORIES: { id: SetCategory; label: string; icon: string }[] = [
    { id: 'Traits', label: 'Traits', icon: '🧬' },
    { id: 'Skills', label: 'Skills', icon: '🎯' },
    { id: 'Powers', label: 'Powers', icon: '⚡' },
    { id: 'Weapons', label: 'Weapons', icon: '⚔️' },
    { id: 'Armor & Shields', label: 'Armor & Shields', icon: '🛡️' },
  ];

  const convertCatalogItemToSetMember = (item: any, category: SetCategory): SetMemberItem => {
    if (category === 'Weapons') {
      return {
        id: String(item.id),
        name: item.name || '',
        category: 'Weapons',
        table: 'weapons',
        element_type: 'weapon',
        source_table: 'weapons',
        requirement: item.requirement || (item.hands ? `${item.hands}H` : ''),
        cost: item.cost || '',
        action: item.type || '',
        effect: item.mso ? `MSO: ${item.mso}` : (item.effect || ''),
        item_data: item,
      };
    } else if (category === 'Armor & Shields') {
      const isArmor = Boolean(item.armor_type || item.dr !== undefined);
      return {
        id: String(item.id),
        name: item.name || '',
        category: 'Armor & Shields',
        table: isArmor ? 'armor' : 'shields',
        element_type: isArmor ? 'armor' : 'shield',
        source_table: isArmor ? 'armor' : 'shields',
        requirement: item.requirement || item.armor_type || '',
        cost: item.cost || '',
        action: isArmor ? (item.armor_type || 'Armor') : 'Shield',
        effect: isArmor ? `DR: ${item.dr ?? 0}, Mob: ${item.mobility ?? 0}` : `Parry: ${item.parry ?? 0}`,
        item_data: item,
      };
    } else if (category === 'Powers') {
      return {
        id: String(item.id),
        name: item.name || '',
        category: 'Powers',
        table: 'powers',
        element_type: 'power',
        source_table: 'powers',
        action: item.action || '',
        usage: item.usage || '',
        requirement: item.tier ? `Tier ${item.tier}` : '',
        effect: item.effect || '',
        item_data: item,
      };
    } else if (category === 'Skills') {
      return {
        id: String(item.id),
        name: item.name || '',
        category: 'Skills',
        table: 'skills',
        element_type: 'skill',
        source_table: 'skills',
        action: item.attribute || '',
        requirement: item.discipline || '',
        effect: item.description || item.effect || '',
        item_data: item,
      };
    } else {
      // Traits
      return {
        id: String(item.id),
        name: item.name || '',
        category: 'Traits',
        table: 'traits',
        element_type: 'trait',
        source_table: 'traits',
        cost: item.cost || '',
        effect: item.effect || '',
        item_data: item,
      };
    }
  };

  const availableSetsForLeftPane = useMemo<SupabaseSet[]>(() => {
    if (!setsCatalog) return [];
    const query = setsSearchQuery.trim().toLowerCase();
    return setsCatalog.filter((s) => {
      const owner = (s.owner || 'Designer').toLowerCase();
      if (workshopMode === 'designer') {
        if (owner !== 'designer') return false;
      } else {
        const userClean = (playerEmail || 'guest@metascape.com').toLowerCase();
        if (owner !== userClean) return false;
      }
      if (query) {
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesCat = (s.category || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }
      return true;
    });
  }, [setsCatalog, setsSearchQuery, workshopMode, playerEmail]);

  const availableBasedOnSets = useMemo<SupabaseSet[]>(() => {
    if (!setsCatalog) return [];
    return setsCatalog.filter((s) => {
      if (s.category !== selectedSetCategory) return false;
      if (selectedSetId && String(s.id) === String(selectedSetId)) return false;
      return true;
    });
  }, [setsCatalog, selectedSetCategory, selectedSetId]);

  const draftSetItemIdSet = useMemo<Set<string>>(() => {
    return new Set(draftSetItems.map((m) => String(m.id)));
  }, [draftSetItems]);

  const isDuplicateClone = useMemo<boolean>(() => {
    if (basedOnSourceSets.length === 0 || initialBaseItemIds.size === 0) return false;
    if (draftSetItems.length !== initialBaseItemIds.size) return false;
    return draftSetItems.every((item) => initialBaseItemIds.has(String(item.id)));
  }, [basedOnSourceSets, initialBaseItemIds, draftSetItems]);

  const categoryCatalogItems = useMemo<any[]>(() => {
    if (selectedSetCategory === 'Weapons') {
      return weaponsCatalog || [];
    } else if (selectedSetCategory === 'Armor & Shields') {
      const armors = armorCatalog || [];
      const shields = shieldsCatalog || [];
      return [...armors, ...shields];
    } else if (selectedSetCategory === 'Powers') {
      return powers || [];
    } else if (selectedSetCategory === 'Skills') {
      return skills || [];
    } else if (selectedSetCategory === 'Traits') {
      return traits || [];
    }
    return [];
  }, [selectedSetCategory, weaponsCatalog, armorCatalog, shieldsCatalog, powers, skills, traits]);

  const filteredCategoryCatalog = useMemo<any[]>(() => {
    const query = setsRightCatalogSearchQuery.trim().toLowerCase();
    if (!query) return categoryCatalogItems;
    return categoryCatalogItems.filter((item) => {
      const nameMatch = (item.name || '').toLowerCase().includes(query);
      const effectMatch = (item.effect || item.description || '').toLowerCase().includes(query);
      const discMatch = (item.discipline || item.attribute || item.requirement || '').toLowerCase().includes(query);
      return nameMatch || effectMatch || discMatch;
    });
  }, [categoryCatalogItems, setsRightCatalogSearchQuery]);

  const handleResetSetSelection = () => {
    setSelectedSetId('');
    setIsCreatingNewSet(false);
    setName('');
    setSetDescription('');
    setSelectedGenres(['Medieval']);
    setSetPathsIncluded([]);
    setDraftSetItems([]);
    setSelectedBaseSetName('');
    setBaseSetMembers([]);
    setBasedOnSourceSets([]);
    setInitialBaseItemIds(new Set());
    setInitialExistingMemberIds(new Set());
    setActiveSetSelection({ type: 'set_root' });
  };

  const handleSelectSet = async (s: SupabaseSet) => {
    setSelectedSetId(s.id ? String(s.id) : '');
    setName(s.name || '');
    setSelectedSetCategory(s.category || 'Weapons');
    setSetDescription(s.description || '');
    setSelectedGenres(Array.isArray(s.genres) && s.genres.length > 0 ? s.genres : ['Medieval']);
    setSetPathsIncluded(Array.isArray(s.paths) ? s.paths : []);
    setIsCreatingNewSet(false);
    setSelectedBaseSetName('');
    setBaseSetMembers([]);
    setBasedOnSourceSets([]);
    setInitialBaseItemIds(new Set());
    setActiveSetSelection({ type: 'set_root' });
    try {
      const members = await gameApi.getSetMembers(s.name, s.category);
      setDraftSetItems(members);
      setInitialExistingMemberIds(new Set(members.map((m) => String(m.id))));
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Failed to load set members:', err);
      setFeedback({
        type: 'error',
        message: `Failed to load set items: ${err.message || 'Unknown error'}`,
      });
    }
  };

  const handleNewSet = () => {
    setSelectedSetId('');
    setName('');
    setSetDescription('');
    setSelectedGenres(['Medieval']);
    setSetPathsIncluded([]);
    setDraftSetItems([]);
    setSelectedBaseSetName('');
    setBaseSetMembers([]);
    setBasedOnSourceSets([]);
    setInitialBaseItemIds(new Set());
    setInitialExistingMemberIds(new Set());
    setIsCreatingNewSet(true);
    setActiveSetSelection({ type: 'set_root' });
  };

  const handleSwitchSetCategory = (newCat: SetCategory) => {
    if (newCat === selectedSetCategory) return;
    if (draftSetItems.length > 0) {
      const ok = window.confirm(
        `Changing category to '${newCat}' will clear the ${draftSetItems.length} current draft item(s). Continue?`
      );
      if (!ok) return;
    }
    setSelectedSetCategory(newCat);
    setDraftSetItems([]);
    setSelectedBaseSetName('');
    setBaseSetMembers([]);
    setBasedOnSourceSets([]);
    setInitialBaseItemIds(new Set());
  };

  const handleSelectBaseSet = async (baseName: string) => {
    setSelectedBaseSetName(baseName);
    if (!baseName) {
      setBaseSetMembers([]);
      return;
    }
    setIsLoadingBaseMembers(true);
    try {
      const members = await gameApi.getSetMembers(baseName, selectedSetCategory);
      setBaseSetMembers(members || []);
    } catch (err) {
      console.error('[PlayerWorkshopModal] Failed to load base set members:', err);
      setBaseSetMembers([]);
    } finally {
      setIsLoadingBaseMembers(false);
    }
  };

  const handleAddAllBaseSetMembers = () => {
    if (!baseSetMembers || baseSetMembers.length === 0) return;
    setDraftSetItems((prev) => {
      const existingIds = new Set(prev.map((i) => String(i.id)));
      const toAdd = baseSetMembers.filter((m) => !existingIds.has(String(m.id)));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  };

  const handleAddMemberToDraft = (m: SetMemberItem) => {
    if (draftSetItems.some((item) => String(item.id) === String(m.id))) return;
    setDraftSetItems((prev) => [...prev, m]);
  };

  const handleAddItemToDraft = (catalogItem: any) => {
    const member = convertCatalogItemToSetMember(catalogItem, selectedSetCategory);
    if (draftSetItems.some((m) => String(m.id) === String(member.id))) return;
    setDraftSetItems((prev) => [...prev, member]);
  };

  const handleRemoveItemFromDraft = (itemId: string) => {
    setDraftSetItems((prev) => prev.filter((m) => String(m.id) !== String(itemId)));
  };

  const handleSaveSet = async () => {
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Set name is required.' });
      return;
    }
    if (isDuplicateClone) {
      setFeedback({
        type: 'error',
        message: 'Duplicate Set Detected: An identical set already exists with these exact items. Please add, remove, or modify items before forging this set.',
      });
      return;
    }

    setIsSavingSet(true);
    try {
      const setOwner = workshopMode === 'designer' ? 'Designer' : (playerEmail || 'guest@metascape.com').toLowerCase();
      const payload: Partial<SupabaseSet> & { name: string; category: SetCategory } = {
        name: name.trim(),
        category: selectedSetCategory,
        description: setDescription.trim(),
        genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
        paths: setPathsIncluded,
        owner: setOwner,
      };

      let savedSet: SupabaseSet;
      if (selectedSetId && !isCreatingNewSet) {
        savedSet = await gameApi.updateSet(selectedSetId, payload);
      } else {
        savedSet = await gameApi.saveSet(payload);
        if (savedSet.id) {
          setSelectedSetId(String(savedSet.id));
          setIsCreatingNewSet(false);
        }
      }

      // Batch update underlying catalog items membership
      const memberItemIds = draftSetItems.map((m) => String(m.id));
      await gameApi.batchUpdateSetMembership(
        name.trim(),
        selectedSetCategory,
        memberItemIds
      );

      setInitialBaseItemIds(new Set());
      setBasedOnSourceSets([]);
      setInitialExistingMemberIds(new Set(draftSetItems.map((m) => String(m.id))));

      await refreshCatalogs();
      setFeedback({
        type: 'success',
        message: `✨ Set '${name.trim()}' successfully forged with ${draftSetItems.length} item(s)!`,
      });
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error saving set:', err);
      setFeedback({
        type: 'error',
        message: `Failed to save set: ${err.message || 'Unknown database error'}`,
      });
    } finally {
      setIsSavingSet(false);
    }
  };

  const handleDeleteCurrentSet = async () => {
    if (!selectedSetId) return;
    const ok = window.confirm(`Permanently delete set '${name}'? This will also remove the set tag from all ${draftSetItems.length} item(s).`);
    if (!ok) return;

    setIsSavingSet(true);
    try {
      await gameApi.batchUpdateSetMembership(name.trim(), selectedSetCategory, []);
      await gameApi.deleteSet(selectedSetId);
      await refreshCatalogs();
      handleResetSetSelection();
      setFeedback({
        type: 'success',
        message: `🗑️ Set '${name}' deleted and item references purged.`,
      });
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error deleting set:', err);
      setFeedback({
        type: 'error',
        message: `Failed to delete set: ${err.message || 'Unknown database error'}`,
      });
    } finally {
      setIsSavingSet(false);
    }
  };

  // Switch tabs cleanly
  const handleSwitchTab = (newType: CustomCreationType) => {
    if (newType !== creationType) {
      handleResetForm();
      setCreationType(newType);
      setCanonicalSearchQuery('');
      if (newType === 'gear' || newType === 'exotic' || newType === 'artifact') {
        setActiveStudioSelection({ type: 'chassis' });
        setStudioChassisType(gearDatabaseChassis);
      } else if (newType === 'set') {
        handleResetSetSelection();
      } else if (newType === 'paths_abilities' || newType === 'path') {
        setActivePathSelection({ type: 'path_root' });
      }
    }
  };

  // Active catalog for current creation type
  const currentActiveCatalog = useMemo<any[]>(() => {
    if (creationType === 'gear') {
      if (studioChassisType === 'weapon') return weaponsCatalog || [];
      if (studioChassisType === 'armor') return armorCatalog || [];
      if (studioChassisType === 'shield') return shieldsCatalog || [];
      if (studioChassisType === 'supplies') return suppliesCatalog || [];
    } else if (creationType === 'paths_abilities' || creationType === 'path') {
      return paths || [];
    } else if (creationType === 'chaos_gem') {
      return chaosGemsCatalog || [];
    } else if (creationType === 'set') {
      return setsCatalog || [];
    } else if (creationType === 'power') {
      return powers || [];
    } else if (creationType === 'trait') {
      return traits || [];
    } else if (creationType === 'skill') {
      return skills || [];
    }
    return [];
  }, [
    creationType,
    studioChassisType,
    weaponsCatalog,
    armorCatalog,
    shieldsCatalog,
    suppliesCatalog,
    paths,
    chaosGemsCatalog,
    setsCatalog,
    powers,
    traits,
    skills,
  ]);

  const getAutoVersionedName = (baseName: string, catalog: any[]): string => {
    const cleanBase = baseName.replace(/\s*\(v\d+\)$/i, '').trim();
    let v = 2;
    let candidate = `${cleanBase} (v${v})`;
    const exists = (cand: string) =>
      catalog.some((it) => (it.name || '').trim().toLowerCase() === cand.toLowerCase());
    while (exists(candidate)) {
      v++;
      candidate = `${cleanBase} (v${v})`;
    }
    return candidate;
  };

  // Real-Time Collision Status for Top-Level Name
  const topLevelCollision = useMemo<{
    isCollision: boolean;
    isCanonMatch: boolean;
    existingItemName?: string;
  }>(() => {
    const clean = name.trim().toLowerCase();
    if (!clean) return { isCollision: false, isCanonMatch: false };

    const match = currentActiveCatalog.find(
      (item) => (item.name || '').trim().toLowerCase() === clean
    );
    if (!match) return { isCollision: false, isCanonMatch: false };

    // If currently editing this exact item or set, not a collision
    if (creationType === 'set') {
      if (!isCreatingNewSet && selectedSetId && String(match.id) === String(selectedSetId)) {
        return { isCollision: false, isCanonMatch: false };
      }
    } else if (canonicalSelectedId && (String(match.id) === String(canonicalSelectedId) || match.name === originalCanonicalName)) {
      return { isCollision: false, isCanonMatch: false };
    }

    const itemOwner = (match.owner || 'Designer').toLowerCase();
    const isCanon = itemOwner === 'designer';

    if (workshopMode === 'designer') {
      if (isCanon) {
        return { isCollision: true, isCanonMatch: true, existingItemName: match.name };
      }
    } else {
      const userClean = (playerEmail || 'guest@metascape.com').toLowerCase();
      if (itemOwner === userClean) {
        return { isCollision: true, isCanonMatch: false, existingItemName: match.name };
      }
      if (isCanon) {
        return { isCollision: false, isCanonMatch: true, existingItemName: match.name };
      }
    }

    return { isCollision: false, isCanonMatch: false };
  }, [
    name,
    currentActiveCatalog,
    canonicalSelectedId,
    workshopMode,
    playerEmail,
    creationType,
    selectedSetId,
    isCreatingNewSet,
  ]);

  // Real-time Guardrail Validation Flags
  const isNameValid = name.trim().length > 0 && !topLevelCollision.isCollision;
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
  const isChassisComplete = useMemo(() => {
    if (!isNameValid || !isGenresValid) return false;
    const isCostModeValid = costMode === 'artifact' || isCostValid;
    if (!isCostModeValid) return false;
    if (studioChassisType === 'weapon') return isWeaponDomainValid;
    if (studioChassisType === 'shield') return isShieldDomainValid;
    if (studioChassisType === 'supplies') return isGearCategoryValid;
    return true;
  }, [
    isNameValid,
    isGenresValid,
    costMode,
    isCostValid,
    studioChassisType,
    isWeaponDomainValid,
    isShieldDomainValid,
    isGearCategoryValid,
  ]);
  const isPathReadyForAbilities =
    isNameValid && isPathCategoryValid && pathDescription.trim().length > 0;


  const isChaosGemActive = Boolean(
    canonicalSelectedId ||
    editingItem ||
    isCreatingNewChaosGem ||
    (workshopMode === 'designer' && isAuthoringNewMaster && creationType === 'chaos_gem')
  );

  const isGearActive = Boolean(
    canonicalSelectedId ||
    editingItem ||
    isCreatingNewGear ||
    (workshopMode === 'designer' && isAuthoringNewMaster && creationType === 'gear') ||
    (name.trim() && creationType === 'gear')
  );

  const isSetActive = Boolean(
    canonicalSelectedId ||
    editingItem ||
    isCreatingNewSet ||
    selectedSetId ||
    (workshopMode === 'designer' && isAuthoringNewMaster && creationType === 'set') ||
    (name.trim() && creationType === 'set')
  );

  const isPathActive = Boolean(
    canonicalSelectedId ||
    selectedPathId ||
    isCreatingNewPath ||
    editingItem ||
    name.trim()
  );

  const isFormValid = useMemo(() => {
    if (creationType === 'set') {
      return isNameValid && !isDuplicateClone;
    }
    if (creationType === 'paths_abilities') {
      if (pathStudioMode === 'path') {
        if (!isNameValid) return false;
        return isPathCategoryValid && pathDescription.trim().length > 0;
      } else {
        // standalone ability mode
        if (!abilityFormName.trim()) return false;
        if (activeAbilityCategory === 'power') return abilityFormEffect.trim().length > 0;
        if (activeAbilityCategory === 'trait') return abilityFormEffect.trim().length > 0;
        if (activeAbilityCategory === 'skill') {
          const isDiscValid =
            abilityFormSkillDiscipline === 'CUSTOM_NEW'
              ? abilityFormSkillDisciplineNewText.trim().length > 0
              : abilityFormSkillDiscipline.trim().length > 0;
          return !!abilityFormSkillAttribute && isDiscValid;
        }
        if (activeAbilityCategory === 'skillset') {
          return (
            abilityFormSkillsetSkills.length >= 2 &&
            abilityFormSkillsetSkills.every((s) => typeof s === 'string' && s.trim().length > 0)
          );
        }
        return true;
      }
    }

    if (!isNameValid) return false;
    if (!isGenresValid) return false;

    if (creationType === 'power') {
      return isEffectValid;
    }
    if (creationType === 'path') {
      return isPathCategoryValid && pathDescription.trim().length > 0;
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
    if (creationType === 'gear') {
      if (!isChassisComplete) return false;
      if (costMode === 'artifact') {
        const hasPowersOrMods = inherentPowers.length > 0 || attachedMods.length > 0 || effect.trim().length > 0;
        if (!hasPowersOrMods) return false;
      }
      return true;
    }
    if (creationType === 'relic' || creationType === 'hardware' || creationType === 'chaos_gem') {
      return isEffectValid;
    }
    return true;
  }, [
    creationType,
    pathStudioMode,
    abilityFormName,
    activeAbilityCategory,
    abilityFormEffect,
    abilityFormSkillAttribute,
    abilityFormSkillDiscipline,
    abilityFormSkillDisciplineNewText,
    abilityFormSkillsetSkills,
    costMode,
    studioChassisType,
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
    inherentPowers,
    attachedMods,
    effect,
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
    creationType === 'gear'
      ? costMode === 'artifact'
        ? 'Artifact'
        : costGold > 0 && costSilver > 0
        ? `${costGold}g ${costSilver}s`
        : costGold > 0
        ? `${costGold}g`
        : `${costSilver}s`
      : creationType === 'artifact'
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

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setFeedback(null);

    let categoryStr =
      creationType === 'power'
        ? 'Power'
        : creationType === 'path'
        ? finalPathCat
        : creationType === 'trait'
        ? 'Trait'
        : creationType === 'skill'
        ? finalSkillDisc
        : creationType === 'gear'
        ? studioChassisType === 'weapon'
          ? weaponTypeMode
          : studioChassisType === 'armor'
          ? 'Armor'
          : studioChassisType === 'shield'
          ? 'Shield'
          : finalGearCat
        : 'General';

    const itemDataPayload: CustomCreationData = {
      notes: notes.trim() || undefined,
      genres: selectedGenres,
      category: categoryStr,
      allow_cloning: true,
    };

    if (creationType === 'set') {
      await handleSaveSet();
      setIsSubmitting(false);
      return;
    }

    if (creationType === 'paths_abilities') {
      if (pathStudioMode === 'path') {
        categoryStr = finalPathCat;
        itemDataPayload.category = finalPathCat;
        itemDataPayload.description = pathDescription.trim();
        itemDataPayload.linked_elements = linkedElements;
        itemDataPayload.genres = selectedGenres;
        itemDataPayload.notes = notes.trim() || undefined;
      } else {
        itemDataPayload.genres =
          abilityFormGenres.length > 0
            ? abilityFormGenres
            : selectedGenres.length > 0
            ? selectedGenres
            : ['Fantasy', 'SciFi', 'Modern', 'Horror', 'Super'];
        itemDataPayload.notes = abilityFormNotes.trim() || undefined;
        if (activeAbilityCategory === 'power') {
          categoryStr = 'Power';
          itemDataPayload.action = abilityFormAction;
          itemDataPayload.usage = abilityFormUsage;
          itemDataPayload.effect = abilityFormEffect.trim();
          itemDataPayload.table = 'General';
          itemDataPayload.table_group = 'General';
        } else if (activeAbilityCategory === 'trait') {
          categoryStr = 'Trait';
          itemDataPayload.effect = abilityFormEffect.trim();
        } else if (activeAbilityCategory === 'skill') {
          const finalDisc =
            abilityFormSkillDiscipline === 'CUSTOM_NEW'
              ? abilityFormSkillDisciplineNewText.trim() || 'General'
              : abilityFormSkillDiscipline;
          categoryStr = finalDisc;
          itemDataPayload.attribute = abilityFormSkillAttribute;
          itemDataPayload.discipline = finalDisc;
          itemDataPayload.formatted_skill = `${abilityFormName.trim()} ${abilityFormSkillAttribute}`;
        } else if (activeAbilityCategory === 'skillset') {
          categoryStr = 'Skillset';
          itemDataPayload.skills = abilityFormSkillsetSkills.filter(Boolean);
        }
        itemDataPayload.category = categoryStr;
      }
    } else if (creationType === 'power') {
      itemDataPayload.action = action;
      itemDataPayload.usage = usage;
      itemDataPayload.effect = effect.trim();
      itemDataPayload.table = 'General';
      itemDataPayload.table_group = 'General';
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
    } else if (creationType === 'gear' || creationType === 'exotic' || creationType === 'artifact') {
      itemDataPayload.chassis_type = studioChassisType;
      itemDataPayload.cost = costMode === 'artifact' ? 'Artifact' : costStr;
      itemDataPayload.inherent_powers = inherentPowers;
      itemDataPayload.mods = attachedMods;
      itemDataPayload.effect = effect.trim() || undefined;

      if (studioChassisType === 'weapon') {
        itemDataPayload.chassis_stats = {
          type: weaponTypeMode,
          requirement: weaponReqStr,
          atk: getWeaponAtkDmg(weaponTypeMode),
          dmg: getWeaponAtkDmg(weaponTypeMode),
          max_block: getWeaponMaxBlock(weaponTypeMode, weaponReqNum),
          domain: finalWeaponDomain,
        };
        itemDataPayload.type = weaponTypeMode;
        itemDataPayload.requirement = weaponReqStr;
        itemDataPayload.atk = getWeaponAtkDmg(weaponTypeMode);
        itemDataPayload.dmg = getWeaponAtkDmg(weaponTypeMode);
        itemDataPayload.max_block = getWeaponMaxBlock(weaponTypeMode, weaponReqNum);
        itemDataPayload.domain = finalWeaponDomain;
      } else if (studioChassisType === 'armor') {
        itemDataPayload.chassis_stats = {
          requirement: armorReq,
          ar: getArmorArStr(armorReq),
          mr: getArmorMrStr(armorReq),
        };
        itemDataPayload.requirement = armorReq;
        itemDataPayload.ar = getArmorArStr(armorReq);
        itemDataPayload.mr = getArmorMrStr(armorReq);
      } else if (studioChassisType === 'shield') {
        itemDataPayload.chassis_stats = {
          requirement: shieldReq,
          max_block: getShieldMaxBlockStr(shieldReq),
          mr: getShieldMrStr(shieldReq),
          domain: finalShieldDomain,
        };
        itemDataPayload.requirement = shieldReq;
        itemDataPayload.max_block = getShieldMaxBlockStr(shieldReq);
        itemDataPayload.mr = getShieldMrStr(shieldReq);
        itemDataPayload.domain = finalShieldDomain;
      } else if (studioChassisType === 'supplies') {
        itemDataPayload.chassis_stats = {
          category: finalGearCat,
        };
        itemDataPayload.category = finalGearCat;
      }

      // Legacy fallback fields for simple display / listing
      const firstPwr = inherentPowers[0] || attachedMods[0]?.powers[0];
      if (firstPwr) {
        itemDataPayload.action = firstPwr.action;
        itemDataPayload.usage = firstPwr.usage;
        if (!itemDataPayload.effect) itemDataPayload.effect = firstPwr.effect;
      }
    } else if (creationType === 'chaos_gem') {
      itemDataPayload.action = 'F';
      itemDataPayload.usage = '3';
      itemDataPayload.effect = effect.trim();
    }

    const targetOwner = workshopMode === 'designer' ? 'Designer' : (playerEmail || 'guest@metascape.com');

    try {
      if (creationType === 'paths_abilities') {
        if (pathStudioMode === 'path') {
          const pathPayload = {
            name: name.trim(),
            category: finalPathCat,
            description: pathDescription.trim(),
            linked_elements: linkedElements,
            owner: targetOwner,
          };

          if (canonicalSelectedId) {
            await gameApi.updateCanonicalPath(canonicalSelectedId, pathPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'path',
                oldName: originalCanonicalName || name.trim(),
                updatedItem: { ...pathPayload, id: canonicalSelectedId },
              });
              setFeedback({
                type: 'success',
                message: `👑 Updated '${name.trim()}' in Master Database & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Updated '${name.trim()}' in your custom creations!`,
              });
            }
            updateCanonicalCatalogItem('path', { ...pathPayload, id: canonicalSelectedId }, originalCanonicalName);
            setOriginalCanonicalName(name.trim());
          } else {
            const created = await gameApi.saveCanonicalPath(pathPayload);
            updateCanonicalCatalogItem('path', created);
            setCanonicalSelectedId(created.id);
            setOriginalCanonicalName(created.name);
            setSelectedPathId(`official_${created.id || created.name}`);
            setIsCreatingNewPath(false);
            setFeedback({
              type: 'success',
              message: workshopMode === 'designer' ? `👑 Created '${created.name}' in Master Database Canon!` : `✅ Successfully forged '${created.name}' to your creations!`,
            });
          }
        } else {
          // Standalone ability
          if (activeAbilityCategory === 'power' || pathDatabaseCategory === 'power') {
            const powerPayload = {
              name: (abilityFormName.trim() || name.trim()),
              action: abilityFormAction,
              usage: abilityFormUsage,
              effect: abilityFormEffect.trim(),
              notes: abilityFormNotes.trim() || null,
              genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
              path: 'General',
              owner: targetOwner,
            };
            if (canonicalSelectedId) {
              await gameApi.updateCanonicalPower(canonicalSelectedId, powerPayload);
              if (workshopMode === 'designer') {
                const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                  entityType: 'power',
                  oldName: originalCanonicalName || powerPayload.name,
                  updatedItem: { ...powerPayload, id: canonicalSelectedId },
                });
                setFeedback({
                  type: 'success',
                  message: `👑 Updated Master Power '${powerPayload.name}' & propagated to ${propRes.updatedCount} active character(s)!`,
                });
              } else {
                setFeedback({
                  type: 'success',
                  message: `✅ Updated Power '${powerPayload.name}'!`,
                });
              }
              updateCanonicalCatalogItem('power', { ...powerPayload, id: canonicalSelectedId }, originalCanonicalName);
              setOriginalCanonicalName(powerPayload.name);
              setName(powerPayload.name);
            } else {
              const createdPower = await gameApi.saveCanonicalPower(powerPayload);
              if (workshopMode === 'designer') {
                const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                  entityType: 'power',
                  oldName: powerPayload.name,
                  updatedItem: createdPower,
                });
                setFeedback({
                  type: 'success',
                  message: `👑 Saved Master Power '${powerPayload.name}' & propagated to ${propRes.updatedCount} active character(s)!`,
                });
              } else {
                setFeedback({
                  type: 'success',
                  message: `✅ Successfully forged Power '${powerPayload.name}'!`,
                });
              }
              updateCanonicalCatalogItem('power', createdPower);
              setCanonicalSelectedId(createdPower.id);
              setOriginalCanonicalName(createdPower.name);
              setName(createdPower.name);
            }
            setAbilityFormName('');
            setAbilityFormEffect('');
            setAbilityFormNotes('');
          } else if (activeAbilityCategory === 'trait' || pathDatabaseCategory === 'trait') {
            const traitPayload = {
              name: (abilityFormName.trim() || name.trim()),
              effect: abilityFormEffect.trim(),
              notes: abilityFormNotes.trim() || '',
              genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
              path: 'General',
              owner: targetOwner,
            };
            if (canonicalSelectedId) {
              await gameApi.updateCanonicalTrait(canonicalSelectedId, traitPayload);
              if (workshopMode === 'designer') {
                const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                  entityType: 'trait',
                  oldName: originalCanonicalName || traitPayload.name,
                  updatedItem: { ...traitPayload, id: canonicalSelectedId },
                });
                setFeedback({
                  type: 'success',
                  message: `👑 Updated Master Trait '${traitPayload.name}' & propagated to ${propRes.updatedCount} active character(s)!`,
                });
              } else {
                setFeedback({
                  type: 'success',
                  message: `✅ Updated Trait '${traitPayload.name}'!`,
                });
              }
              updateCanonicalCatalogItem('trait', { ...traitPayload, id: canonicalSelectedId }, originalCanonicalName);
              setOriginalCanonicalName(traitPayload.name);
              setName(traitPayload.name);
            } else {
              const createdTrait = await gameApi.saveCanonicalTrait(traitPayload);
              if (workshopMode === 'designer') {
                const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                  entityType: 'trait',
                  oldName: traitPayload.name,
                  updatedItem: createdTrait,
                });
                setFeedback({
                  type: 'success',
                  message: `👑 Saved Master Trait '${traitPayload.name}' & propagated to ${propRes.updatedCount} active character(s)!`,
                });
              } else {
                setFeedback({
                  type: 'success',
                  message: `✅ Successfully forged Trait '${traitPayload.name}'!`,
                });
              }
              updateCanonicalCatalogItem('trait', createdTrait);
              setCanonicalSelectedId(createdTrait.id);
              setOriginalCanonicalName(createdTrait.name);
              setName(createdTrait.name);
            }
            setAbilityFormName('');
            setAbilityFormEffect('');
            setAbilityFormNotes('');
          } else if (activeAbilityCategory === 'skill' || pathDatabaseCategory === 'skill') {
            const skillPayload = {
              name: (abilityFormName.trim() || name.trim()),
              attribute: abilityFormSkillAttribute,
              discipline: abilityFormSkillDiscipline === 'CUSTOM_NEW' ? abilityFormSkillDisciplineNewText.trim() : abilityFormSkillDiscipline,
              notes: abilityFormNotes.trim() || '',
              genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
              owner: targetOwner,
            };
            if (canonicalSelectedId) {
              await gameApi.updateCanonicalSkill(canonicalSelectedId, skillPayload);
              if (workshopMode === 'designer') {
                const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                  entityType: 'skill',
                  oldName: originalCanonicalName || skillPayload.name,
                  updatedItem: { ...skillPayload, id: canonicalSelectedId },
                });
                setFeedback({
                  type: 'success',
                  message: `👑 Updated Master Skill '${skillPayload.name}' & propagated to ${propRes.updatedCount} character(s)!`,
                });
              } else {
                setFeedback({
                  type: 'success',
                  message: `✅ Updated Skill '${skillPayload.name}'!`,
                });
              }
              updateCanonicalCatalogItem('skill', { ...skillPayload, id: canonicalSelectedId }, originalCanonicalName);
              setOriginalCanonicalName(skillPayload.name);
              setName(skillPayload.name);
            } else {
              const createdSkill = await gameApi.saveCanonicalSkill(skillPayload);
              updateCanonicalCatalogItem('skill', createdSkill);
              setCanonicalSelectedId(createdSkill.id);
              setOriginalCanonicalName(createdSkill.name);
              setName(createdSkill.name);
              setFeedback({
                type: 'success',
                message: workshopMode === 'designer' ? `👑 Created Master Skill '${createdSkill.name}' in Supabase Canon!` : `✅ Successfully forged Skill '${createdSkill.name}'!`,
              });
            }
            setAbilityFormName('');
            setAbilityFormNotes('');
          }
        }
      } else if (creationType === 'chaos_gem') {
        const gemPayload = {
          name: name.trim(),
          effect: effect.trim(),
          genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
          notes: notes.trim() || '',
          action: action || 'F',
          usage: usage || '3',
          owner: targetOwner,
        };
        if (canonicalSelectedId) {
          await gameApi.updateCanonicalChaosGem(canonicalSelectedId, gemPayload);
          if (workshopMode === 'designer') {
            const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
              entityType: 'chaos_gem',
              oldName: originalCanonicalName || name.trim(),
              updatedItem: { ...gemPayload, id: canonicalSelectedId },
            });
            setFeedback({
              type: 'success',
              message: `👑 Updated Master Chaos Gem '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
            });
          } else {
            setFeedback({
              type: 'success',
              message: `✅ Updated Chaos Gem '${name.trim()}'!`,
            });
          }
          updateCanonicalCatalogItem('chaos_gem', { ...gemPayload, id: canonicalSelectedId }, originalCanonicalName);
          setCanonicalChaosGems((prev) =>
            prev.map((g) => (String(g.id) === String(canonicalSelectedId) ? { ...g, ...gemPayload } : g))
          );
          setOriginalCanonicalName(name.trim());
        } else {
          const savedGem = await gameApi.saveCanonicalChaosGem(gemPayload);
          if (workshopMode === 'designer') {
            const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
              entityType: 'chaos_gem',
              oldName: name.trim(),
              updatedItem: savedGem,
            });
            setFeedback({
              type: 'success',
              message: `👑 Saved Master Chaos Gem '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
            });
          } else {
            setFeedback({
              type: 'success',
              message: `✅ Successfully forged Chaos Gem '${name.trim()}'!`,
            });
          }
          updateCanonicalCatalogItem('chaos_gem', savedGem);
          setCanonicalChaosGems((prev) => [...prev, savedGem]);
          setCanonicalSelectedId(savedGem.id);
          setOriginalCanonicalName(savedGem.name);
        }
      } else if (creationType === 'gear') {
        if (studioChassisType === 'weapon') {
          const weaponPayload = {
            name: name.trim(),
            type: weaponTypeMode,
            requirement: weaponReqStr,
            atk: getWeaponAtkDmg(weaponTypeMode),
            dmg: getWeaponAtkDmg(weaponTypeMode),
            max_block: getWeaponMaxBlock(weaponTypeMode, weaponReqNum),
            cost: costStr,
            notes: notes.trim() || null,
            genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
            owner: targetOwner,
          };
          if (canonicalSelectedId) {
            await gameApi.updateCanonicalWeapon(canonicalSelectedId, weaponPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'weapon',
                oldName: originalCanonicalName || name.trim(),
                updatedItem: { ...weaponPayload, id: canonicalSelectedId },
              });
              setFeedback({
                type: 'success',
                message: `👑 Updated Master Weapon '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Updated Weapon '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('weapon', { ...weaponPayload, id: canonicalSelectedId }, originalCanonicalName);
            setOriginalCanonicalName(name.trim());
          } else {
            const savedW = await gameApi.saveCanonicalWeapon(weaponPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'weapon',
                oldName: name.trim(),
                updatedItem: savedW,
              });
              setFeedback({
                type: 'success',
                message: `👑 Saved Master Weapon '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Successfully forged Weapon '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('weapon', savedW);
            setCanonicalSelectedId(savedW.id);
            setOriginalCanonicalName(savedW.name);
          }
        } else if (studioChassisType === 'armor') {
          const armorPayload = {
            name: name.trim(),
            requirement: armorReq,
            ar: getArmorArStr(armorReq),
            mr: getArmorMrStr(armorReq),
            cost: costStr,
            notes: notes.trim() || null,
            genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
            owner: targetOwner,
          };
          if (canonicalSelectedId) {
            await gameApi.updateCanonicalArmor(canonicalSelectedId, armorPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'armor',
                oldName: originalCanonicalName || name.trim(),
                updatedItem: { ...armorPayload, id: canonicalSelectedId },
              });
              setFeedback({
                type: 'success',
                message: `👑 Updated Master Armor '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Updated Armor '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('armor', { ...armorPayload, id: canonicalSelectedId }, originalCanonicalName);
            setOriginalCanonicalName(name.trim());
          } else {
            const savedA = await gameApi.saveCanonicalArmor(armorPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'armor',
                oldName: name.trim(),
                updatedItem: savedA,
              });
              setFeedback({
                type: 'success',
                message: `👑 Saved Master Armor '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Successfully forged Armor '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('armor', savedA);
            setCanonicalSelectedId(savedA.id);
            setOriginalCanonicalName(savedA.name);
          }
        } else if (studioChassisType === 'shield') {
          const shieldPayload = {
            name: name.trim(),
            requirement: shieldReq,
            max_block: getShieldMaxBlockStr(shieldReq),
            mr: getShieldMrStr(shieldReq),
            cost: costStr,
            notes: notes.trim() || null,
            genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
            owner: targetOwner,
          };
          if (canonicalSelectedId) {
            await gameApi.updateCanonicalShield(canonicalSelectedId, shieldPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'shield',
                oldName: originalCanonicalName || name.trim(),
                updatedItem: { ...shieldPayload, id: canonicalSelectedId },
              });
              setFeedback({
                type: 'success',
                message: `👑 Updated Master Shield '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Updated Shield '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('shield', { ...shieldPayload, id: canonicalSelectedId }, originalCanonicalName);
            setOriginalCanonicalName(name.trim());
          } else {
            const savedS = await gameApi.saveCanonicalShield(shieldPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'shield',
                oldName: name.trim(),
                updatedItem: savedS,
              });
              setFeedback({
                type: 'success',
                message: `👑 Saved Master Shield '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Successfully forged Shield '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('shield', savedS);
            setCanonicalSelectedId(savedS.id);
            setOriginalCanonicalName(savedS.name);
          }
        } else if (studioChassisType === 'supplies') {
          const gearPayload = {
            name: name.trim(),
            category: finalGearCat,
            cost: costStr,
            notes: notes.trim() || null,
            genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
            owner: targetOwner,
          };
          if (canonicalSelectedId) {
            await gameApi.updateCanonicalGear(canonicalSelectedId, gearPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'gear',
                oldName: originalCanonicalName || name.trim(),
                updatedItem: { ...gearPayload, id: canonicalSelectedId },
              });
              setFeedback({
                type: 'success',
                message: `👑 Updated Master Gear '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Updated Gear '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('gear', { ...gearPayload, id: canonicalSelectedId }, originalCanonicalName);
            setOriginalCanonicalName(name.trim());
          } else {
            const savedG = await gameApi.saveCanonicalGear(gearPayload);
            if (workshopMode === 'designer') {
              const propRes = await gameApi.propagateCanonicalUpdateToAllCharacters({
                entityType: 'gear',
                oldName: name.trim(),
                updatedItem: savedG,
              });
              setFeedback({
                type: 'success',
                message: `👑 Saved Master Gear '${name.trim()}' & propagated to ${propRes.updatedCount} active character(s)!`,
              });
            } else {
              setFeedback({
                type: 'success',
                message: `✅ Successfully forged Gear '${name.trim()}'!`,
              });
            }
            updateCanonicalCatalogItem('gear', savedG);
            setCanonicalSelectedId(savedG.id);
            setOriginalCanonicalName(savedG.name);
          }
        }

        // Downstream sync for inherent powers and attached mods (Designer Mode)
        if (workshopMode === 'designer') {
          const hostBelongsTo =
            studioChassisType === 'weapon'
              ? `Weapon: ${name.trim()}`
              : studioChassisType === 'armor'
              ? `Armor: ${name.trim()}`
              : studioChassisType === 'shield'
              ? `Shield: ${name.trim()}`
              : `Supplies: ${name.trim()}`;

          // Unlink or delete staged deletions
          for (const pId of deletedPowerIds) {
            try {
              await gameApi.unlinkCanonicalGearPower(pId, hostBelongsTo);
            } catch (err) {
              console.warn('[handleSubmit] Error unlinking gear power:', err);
            }
          }
          for (const mId of deletedModIds) {
            try {
              await gameApi.unlinkCanonicalMod(mId, hostBelongsTo);
            } catch (err) {
              console.warn('[handleSubmit] Error unlinking mod:', err);
            }
          }
          setDeletedPowerIds([]);
          setDeletedModIds([]);

          // Sync inherent powers with Smart Deduplication
          for (const pwr of inherentPowers) {
            const isExisting = isCanonicalDbId(pwr.id);
            if (isExisting) {
              await gameApi.linkCanonicalGearPower(Number(pwr.id), hostBelongsTo);
              const pwrPayload = {
                name: pwr.name.trim(),
                action: pwr.action || 'AM',
                usage: pwr.usage || '1-Enc',
                effect: pwr.effect.trim(),
                owner: 'Designer',
              };
              await gameApi.updateCanonicalGearPower(Number(pwr.id), pwrPayload);
            } else {
              // Check if exact matching canonical power exists
              const matchingFn = (functionsCatalog || []).find(
                (fn) =>
                  fn.name.trim().toLowerCase() === pwr.name.trim().toLowerCase() &&
                  (fn.action || 'AM') === (pwr.action || 'AM') &&
                  (fn.usage || '1-Enc') === (pwr.usage || '1-Enc') &&
                  fn.effect.trim().toLowerCase() === pwr.effect.trim().toLowerCase()
              );

              if (matchingFn && matchingFn.id) {
                // Exact match: Auto-Link existing row without duplicate row!
                await gameApi.linkCanonicalGearPower(matchingFn.id, hostBelongsTo);
              } else {
                // Disambiguate if name matches an existing power with different stats
                let finalName = pwr.name.trim();
                const nameCollision = (functionsCatalog || []).find(
                  (fn) => fn.name.trim().toLowerCase() === pwr.name.trim().toLowerCase()
                );
                if (nameCollision && !finalName.includes(`(${name.trim()})`)) {
                  finalName = `${finalName} (${name.trim()})`;
                }
                const pwrPayload = {
                  name: finalName,
                  action: pwr.action || 'AM',
                  usage: pwr.usage || '1-Enc',
                  effect: pwr.effect.trim(),
                  belongs_to: hostBelongsTo,
                  owner: 'Designer',
                };
                await gameApi.saveCanonicalGearPower(pwrPayload);
              }
            }
          }

          // Sync attached mods and their child powers with Smart Deduplication
          for (const mod of attachedMods) {
            const modCostStr =
              mod.costGold > 0 || mod.costSilver > 0
                ? `${mod.costGold > 0 ? `${mod.costGold}g` : ''}${mod.costGold > 0 && mod.costSilver > 0 ? ' ' : ''}${mod.costSilver > 0 ? `${mod.costSilver}s` : ''}`.trim()
                : '0s';
            const isModExisting = isCanonicalDbId(mod.id);

            let resolvedModName = mod.name.trim();

            if (isModExisting) {
              await gameApi.linkCanonicalMod(Number(mod.id), hostBelongsTo);
              const modPayload = {
                name: mod.name.trim(),
                cost: modCostStr,
                notes: mod.notes?.trim() || null,
                owner: 'Designer',
              };
              await gameApi.updateCanonicalMod(Number(mod.id), modPayload);
            } else {
              const matchingMod = (modsCatalog || []).find(
                (m) =>
                  m.name.trim().toLowerCase() === mod.name.trim().toLowerCase() &&
                  (m.cost || '0s').trim().toLowerCase() === modCostStr.toLowerCase()
              );

              if (matchingMod && matchingMod.id) {
                await gameApi.linkCanonicalMod(matchingMod.id, hostBelongsTo);
              } else {
                const nameCollision = (modsCatalog || []).find(
                  (m) => m.name.trim().toLowerCase() === mod.name.trim().toLowerCase()
                );
                if (nameCollision && !resolvedModName.includes(`(${name.trim()})`)) {
                  resolvedModName = `${resolvedModName} (${name.trim()})`;
                }
                const modPayload = {
                  name: resolvedModName,
                  cost: modCostStr,
                  notes: mod.notes?.trim() || null,
                  belongs_to: hostBelongsTo,
                  owner: 'Designer',
                };
                await gameApi.saveCanonicalMod(modPayload);
              }
            }

            for (const cPwr of mod.powers) {
              const childHostBelongsTo = `Mod: ${resolvedModName}`;
              const isChildExisting = isCanonicalDbId(cPwr.id);
              if (isChildExisting) {
                await gameApi.linkCanonicalGearPower(Number(cPwr.id), childHostBelongsTo);
                const childPayload = {
                  name: cPwr.name.trim(),
                  action: cPwr.action || 'AM',
                  usage: cPwr.usage || '1-Enc',
                  effect: cPwr.effect.trim(),
                  owner: 'Designer',
                };
                await gameApi.updateCanonicalGearPower(Number(cPwr.id), childPayload);
              } else {
                const matchingFn = (functionsCatalog || []).find(
                  (fn) =>
                    fn.name.trim().toLowerCase() === cPwr.name.trim().toLowerCase() &&
                    (fn.action || 'AM') === (cPwr.action || 'AM') &&
                    (fn.usage || '1-Enc') === (cPwr.usage || '1-Enc') &&
                    fn.effect.trim().toLowerCase() === cPwr.effect.trim().toLowerCase()
                );

                if (matchingFn && matchingFn.id) {
                  await gameApi.linkCanonicalGearPower(matchingFn.id, childHostBelongsTo);
                } else {
                  let finalChildName = cPwr.name.trim();
                  const nameCollision = (functionsCatalog || []).find(
                    (fn) => fn.name.trim().toLowerCase() === cPwr.name.trim().toLowerCase()
                  );
                  if (nameCollision && !finalChildName.includes(`(${resolvedModName})`)) {
                    finalChildName = `${finalChildName} (${resolvedModName})`;
                  }
                  const childPayload = {
                    name: finalChildName,
                    action: cPwr.action || 'AM',
                    usage: cPwr.usage || '1-Enc',
                    effect: cPwr.effect.trim(),
                    belongs_to: childHostBelongsTo,
                    owner: 'Designer',
                  };
                  await gameApi.saveCanonicalGearPower(childPayload);
                }
              }
            }
          }
        }
      }

      await refreshCatalogs();
      if (onItemSaved) onItemSaved();
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error in save:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to save record.'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderGearHierarchyTree = (isCanonicalTab: boolean = false) => (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
      {/* 1. CHASSIS ROOT NODE CARD */}
      <div
        onClick={() => setActiveStudioSelection({ type: 'chassis' })}
        className={`p-3 rounded-xl border transition flex flex-col gap-1.5 cursor-pointer shadow-sm ${
          activeStudioSelection.type === 'chassis'
            ? 'bg-amber-950/30 border-amber-500/80 ring-1 ring-amber-500/40'
            : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">
              {studioChassisType === 'weapon'
                ? '⚔️'
                : studioChassisType === 'armor'
                ? '🥋'
                : studioChassisType === 'shield'
                ? '🛡️'
                : '🎒'}
            </span>
            <span className="font-bold text-slate-100 text-xs truncate">
              {name || 'Unnamed Chassis'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canonicalSelectedId && (
              <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.5 rounded">
                👑 ID: {canonicalSelectedId}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                costMode === 'artifact'
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
              }`}
            >
              {costMode === 'artifact' ? 'Artifact 🔮' : costStr}
            </span>
            {canonicalSelectedId && workshopMode === 'designer' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirmTarget({
                    type: studioChassisType,
                    id: canonicalSelectedId,
                    name: originalCanonicalName || name,
                  });
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-500/40 transition cursor-pointer"
                title="Delete from Supabase Master Database"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {isCanonicalTab && workshopMode !== 'designer' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const item =
                    studioChassisType === 'weapon'
                      ? (weaponsCatalog || []).find((w) => String(w.id) === String(canonicalSelectedId) || w.name === canonicalSelectedId)
                      : studioChassisType === 'armor'
                      ? (armorCatalog || []).find((a) => String(a.id) === String(canonicalSelectedId) || a.name === canonicalSelectedId)
                      : studioChassisType === 'shield'
                      ? (shieldsCatalog || []).find((s) => String(s.id) === String(canonicalSelectedId) || s.name === canonicalSelectedId)
                      : (suppliesCatalog || []).find((sup) => String(sup.id) === String(canonicalSelectedId) || sup.name === canonicalSelectedId);
                  if (item) handleLoadTemplateIntoForge(studioChassisType, item);
                }}
                className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                title="Load as customizable template into forge"
              >
                <span>🛠️</span>
                <span>Load into Forge</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="capitalize">
            {studioChassisType === 'supplies'
              ? `Supplies: ${finalGearCat}`
              : studioChassisType === 'weapon'
              ? `Weapon: ${weaponTypeMode}`
              : studioChassisType === 'armor'
              ? `Armor (${armorReq})`
              : `Shield (${shieldReq})`}
          </span>
          <span className="text-[10px] text-amber-400/80 font-mono font-bold">
            {activeStudioSelection.type === 'chassis' ? '● Active in Editor' : 'Click to Edit'}
          </span>
        </div>
      </div>

      {/* HIERARCHICAL TREE (Matching ManageGearPowersModal) */}
      <div className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-cyan-500/40 flex flex-col gap-3 pt-1 pb-1">
          {!isChassisComplete && (
            <div className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-300/90 flex items-center gap-1.5 leading-snug">
              <span>🔒</span>
              <span>Complete Chassis setup (Name, Genres) above to unlock Exotic Powers & Mods.</span>
            </div>
          )}

          {/* BRANCH 1: Inherent Chassis Powers (No Mod) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 py-0.5">
              <span className="text-xs font-bold text-amber-300 font-mono tracking-wide">
                Inherent (No Mod)
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-500/50 font-mono font-bold text-[10px] shadow-sm select-none">
                Installed
              </span>
            </div>

            {/* Indented Inherent Power Cards */}
            <div className="flex flex-col gap-1.5 pl-3.5 sm:pl-4">
              {inherentPowers.length > 0 ? (
                inherentPowers.map((pwr) => {
                  const isPwrSelected =
                    activeStudioSelection.type === 'power' &&
                    activeStudioSelection.parentType === 'inherent' &&
                    activeStudioSelection.id === pwr.id;
                  return (
                    <div
                      key={pwr.id}
                      onClick={() => handleStartEditInherentPower(pwr)}
                      className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 cursor-pointer ${
                        isPwrSelected
                          ? 'bg-rose-950/30 border-rose-500/80 ring-1 ring-rose-500/40'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs shrink-0">🔥</span>
                        <span className="font-bold text-slate-200 text-xs truncate">
                          {pwr.name || 'Unnamed Power'}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-bold shrink-0">
                          {pwr.action}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold shrink-0">
                          {pwr.usage}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteInherentPower(pwr.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                          title="Delete inherent power"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : null}

              <button
                type="button"
                onClick={handleStartAddInherentPower}
                disabled={!isChassisComplete}
                className={`py-1 px-2.5 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 select-none ${
                  isChassisComplete
                    ? 'bg-slate-950 hover:bg-slate-800 border-dashed border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 cursor-pointer'
                    : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                }`}
                title={
                  isChassisComplete
                    ? 'Add an inherent exotic power to this chassis'
                    : 'Complete Chassis setup first to add exotic powers'
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Exotic Power</span>
              </button>
            </div>
          </div>

          {/* BRANCH 2+: Modular Add-ons (Mods) */}
          {attachedMods.map((mod) => {
            const isModSelected =
              activeStudioSelection.type === 'mod' && activeStudioSelection.id === mod.id;
            const modCostStr =
              mod.costGold > 0 || mod.costSilver > 0
                ? `${mod.costGold > 0 ? `${mod.costGold}g` : ''}${mod.costGold > 0 && mod.costSilver > 0 ? ' ' : ''}${mod.costSilver > 0 ? `${mod.costSilver}s` : ''}`
                : '';

            return (
              <div key={mod.id} className="flex flex-col gap-2">
                {/* Mod Header Row: Name, Cost, Installed badge, Delete */}
                <div
                  onClick={() => handleStartEditMod(mod)}
                  className={`flex items-center justify-between gap-2 p-1.5 rounded-lg border transition cursor-pointer ${
                    isModSelected
                      ? 'bg-cyan-950/30 border-cyan-500/80 ring-1 ring-cyan-500/40'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs">⚙️</span>
                    <span className="text-xs font-bold text-cyan-200 font-mono tracking-wide truncate">
                      {mod.name || 'Unnamed Mod'}
                    </span>
                    {modCostStr && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-500/30 text-amber-300 font-mono text-[9px] font-bold">
                        {modCostStr}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 font-mono font-bold text-[10px] shadow-sm select-none">
                      Installed
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMod(mod.id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 border border-transparent hover:border-rose-500/40 rounded-lg transition-all cursor-pointer shadow-sm shrink-0"
                    title={`Delete mod '${mod.name}'`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Indented Powers under this Mod */}
                <div className="flex flex-col gap-1.5 pl-3.5 sm:pl-4">
                  {mod.powers.map((pwr) => {
                    const isModPwrSelected =
                      activeStudioSelection.type === 'power' &&
                      activeStudioSelection.parentType === 'mod' &&
                      activeStudioSelection.parentId === mod.id &&
                      activeStudioSelection.id === pwr.id;

                    return (
                      <div
                        key={pwr.id}
                        onClick={() => handleStartEditModPower(mod, pwr)}
                        className={`p-1.5 rounded-lg border transition flex items-center justify-between gap-1.5 cursor-pointer ${
                          isModPwrSelected
                            ? 'bg-rose-950/30 border-rose-500/80 ring-1 ring-rose-500/40'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] shrink-0">🔥</span>
                          <span className="font-semibold text-slate-200 text-xs truncate">
                            {pwr.name || 'Unnamed Power'}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-amber-300 font-bold shrink-0">
                            {pwr.action}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold shrink-0">
                            {pwr.usage}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModPower(mod.id, pwr.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer shrink-0"
                          title="Delete power from mod"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => handleStartAddPowerToMod(mod)}
                    disabled={!isChassisComplete}
                    className={`py-1 px-2 rounded border text-[10px] font-bold transition flex items-center justify-center gap-1 select-none ${
                      isChassisComplete
                        ? 'bg-slate-950 hover:bg-slate-800 border-dashed border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 cursor-pointer'
                        : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      isChassisComplete
                        ? `Add a power to mod '${mod.name}'`
                        : 'Complete Chassis setup first to add powers'
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Power to Mod</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* BOTTOM TREE ACTION: + Add Mod */}
          <button
            type="button"
            onClick={handleStartAddMod}
            disabled={!isChassisComplete}
            className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 select-none ${
              isChassisComplete
                ? 'bg-slate-950 hover:bg-slate-800 border-dashed border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 cursor-pointer'
                : 'bg-slate-950/50 border-dashed border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
            }`}
            title={
              isChassisComplete
                ? 'Add a modular hardware upgrade to this chassis'
                : 'Complete Chassis setup first to add mods'
            }
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Mod</span>
          </button>
        </div>
    </div>
  );

  // --- Phase 4 Forge Paths Studio Helpers & Memos ---
  const handleToggleLinkElement = (
    item: any,
    type: PathElementType,
    tag: 'Free' | '1 AP'
  ) => {
    const cleanItemName = (item.name || '').trim();
    if (!cleanItemName) return;

    setLinkedElements((prev) => {
      const existingIdx = prev.findIndex(
        (el) =>
          (el.name || '').toLowerCase().trim() === cleanItemName.toLowerCase() &&
          (el.type || el.element_type) === type
      );

      if (existingIdx >= 0) {
        // If clicking the same tag that it already has, remove it
        if (prev[existingIdx].tag === tag) {
          return prev.filter((_, idx) => idx !== existingIdx);
        }
        // If clicking different tag, flip tag
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          tag,
          isFree: tag === 'Free',
          is_free: tag === 'Free',
        };
        return updated;
      }

      // Add new
      const newItem: PathLinkedElement = {
        id: item.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: cleanItemName,
        type,
        element_type: type,
        tag,
        isFree: tag === 'Free',
        is_free: tag === 'Free',
        details: item.effect || item.notes || item.category || item.discipline || (type === 'set' ? `${item.items_count !== undefined ? `${item.items_count} items` : 'Set'}` : ''),
      };
      return [...prev, newItem];
    });
  };

  const handleToggleLinkedTag = (id: string | number, newTag: 'Free' | '1 AP') => {
    setLinkedElements((prev) =>
      prev.map((el) => {
        if (el.id === id || String(el.id) === String(id)) {
          return {
            ...el,
            tag: newTag,
            isFree: newTag === 'Free',
            is_free: newTag === 'Free',
          };
        }
        return el;
      })
    );
    setActivePathSelection((prev) => {
      if (prev.type === 'path_set' && (prev.setItem?.id === id || String(prev.setItem?.id) === String(id))) {
        return {
          ...prev,
          setItem: {
            ...prev.setItem,
            tag: newTag,
            isFree: newTag === 'Free',
            is_free: newTag === 'Free',
          },
        };
      }
      if (prev.type === 'path_element' && prev.element && (prev.element.id === id || String(prev.element.id) === String(id))) {
        return {
          ...prev,
          element: {
            ...prev.element,
            tag: newTag,
            isFree: newTag === 'Free',
            is_free: newTag === 'Free',
          } as PathLinkedElement,
        };
      }
      return prev;
    });
  };

  const handleRemoveLinkedElement = (id: string | number) => {
    setLinkedElements((prev) => prev.filter((el) => el.id !== id && String(el.id) !== String(id)));
  };

  const handleSelectBasedOnPath = (sourcePath: SupabasePath) => {
    if (!sourcePath) return;
    if (workshopMode === 'designer') {
      setName(getAutoVersionedName(sourcePath.name, paths || []));
    } else {
      setName(`${sourcePath.name} (Custom)`);
    }
    setPathCategory(sourcePath.category || 'General');
    setPathCategoryNewText('');
    setPathDescription(sourcePath.description || '');
    if (Array.isArray(sourcePath.genres) && sourcePath.genres.length > 0) {
      setSelectedGenres(sourcePath.genres);
    }
    if (Array.isArray(sourcePath.linked_elements) && sourcePath.linked_elements.length > 0) {
      setLinkedElements(JSON.parse(JSON.stringify(sourcePath.linked_elements)));
    } else {
      const resolved = resolvePathElementsFromCatalogs(sourcePath.name, {
        setsCatalog,
        powers,
        skills,
        traits,
        weaponsCatalog,
        armorCatalog,
        shieldsCatalog,
      });
      setLinkedElements(resolved);
    }
  };

  const handleSaveAndLinkCustomAbility = async () => {
    if (!customAbilityName.trim()) return;
    const pathNameToTag = name.trim() || 'Universal';
    const tag = customAbilityTag;
    const pathString = tag === 'Free' ? `${pathNameToTag} {Free}` : pathNameToTag;

    try {
      let createdItem: any = null;
      if (customAbilityType === 'trait') {
        const payload = {
          name: customAbilityName.trim(),
          effect: customAbilityEffect.trim(),
          notes: customAbilityNotes.trim() || undefined,
          path: pathString,
          genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
          owner: workshopMode === 'designer' ? 'Designer' : (playerEmail || 'guest@metascape.com'),
        };
        if (workshopMode === 'designer') {
          createdItem = await gameApi.saveCanonicalTrait(payload);
          updateCanonicalCatalogItem('trait', createdItem);
        } else {
          createdItem = await gameApi.saveCustomItem({
            type: 'trait',
            name: customAbilityName.trim(),
            category: 'Trait',
            author_name: activeCharacter?.name || 'Player',
            author_email: playerEmail || 'guest@metascape.com',
            item_data: payload,
          });
        }
      } else if (customAbilityType === 'power') {
        const payload = {
          name: customAbilityName.trim(),
          action: customAbilityAction,
          usage: customAbilityUsage,
          effect: customAbilityEffect.trim(),
          notes: customAbilityNotes.trim() || undefined,
          path: pathString,
          table: 'General',
          genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
          owner: workshopMode === 'designer' ? 'Designer' : (playerEmail || 'guest@metascape.com'),
        };
        if (workshopMode === 'designer') {
          createdItem = await gameApi.saveCanonicalPower(payload);
          updateCanonicalCatalogItem('power', createdItem);
        } else {
          createdItem = await gameApi.saveCustomItem({
            type: 'power',
            name: customAbilityName.trim(),
            category: 'Power',
            author_name: activeCharacter?.name || 'Player',
            author_email: playerEmail || 'guest@metascape.com',
            item_data: payload,
          });
        }
      } else if (customAbilityType === 'skill') {
        const payload = {
          name: customAbilityName.trim(),
          attribute: customAbilityAttribute,
          discipline: customAbilityDiscipline,
          notes: customAbilityNotes.trim() || undefined,
          path: pathString,
          genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
          owner: workshopMode === 'designer' ? 'Designer' : (playerEmail || 'guest@metascape.com'),
        };
        if (workshopMode === 'designer') {
          createdItem = await gameApi.saveCanonicalSkill(payload);
          updateCanonicalCatalogItem('skill', createdItem);
        } else {
          createdItem = await gameApi.saveCustomItem({
            type: 'skill',
            name: customAbilityName.trim(),
            category: customAbilityDiscipline,
            author_name: activeCharacter?.name || 'Player',
            author_email: playerEmail || 'guest@metascape.com',
            item_data: payload,
          });
        }
      }

      handleToggleLinkElement(
        {
          id: createdItem?.id || `${customAbilityType}_${Date.now()}`,
          name: customAbilityName.trim(),
          effect: customAbilityEffect.trim(),
          notes: customAbilityNotes.trim(),
        },
        customAbilityType,
        tag
      );

      setCustomAbilityName('');
      setCustomAbilityEffect('');
      setCustomAbilityNotes('');
      setIsAuthoringPathCustomAbility(false);
      setFeedback({
        type: 'success',
        message: `Forged and linked '${customAbilityName.trim()}' (${tag}) to path!`,
      });
    } catch (err: any) {
      console.error('[handleSaveAndLinkCustomAbility] Error:', err);
      setFeedback({
        type: 'error',
        message: `Failed to forge ability: ${err?.message || 'Unknown error'}`,
      });
    }
  };

  const PATH_ABILITY_CATEGORIES = [
    { id: 'trait', label: 'Traits', icon: '🧬', singular: 'Trait' },
    { id: 'power', label: 'Powers', icon: '⚡', singular: 'Power' },
    { id: 'skill', label: 'Skills', icon: '🎯', singular: 'Skill' },
    { id: 'weapon', label: 'Weapon Sk', icon: '⚔️', singular: 'Weapon Sk' },
    { id: 'armor_shield', label: 'Armor & Shield Sk', icon: '🛡️', singular: 'Armor & Shield Sk' },
  ] as const;

  const getLinkedElementCategory = useCallback((el: PathLinkedElement): 'trait' | 'power' | 'skill' | 'weapon' | 'armor_shield' => {
    const elType = (el.type || el.element_type || '').toLowerCase();
    if (elType === 'set') {
      const setRecord = (setsCatalog || []).find(
        (s) => String(s.id) === String(el.id) || (s.name && s.name.toLowerCase() === (el.name || '').toLowerCase())
      );
      const cat = (setRecord?.category || (el as any).category || el.details || '').toLowerCase();
      if (cat.includes('weapon')) return 'weapon';
      if (cat.includes('armor') || cat.includes('shield')) return 'armor_shield';
      if (cat.includes('power')) return 'power';
      if (cat.includes('skill')) return 'skill';
      if (cat.includes('trait')) return 'trait';
      return 'power';
    }
    if (elType === 'trait') return 'trait';
    if (elType === 'power') return 'power';
    if (elType === 'skill' || elType === 'skillset') return 'skill';
    if (elType === 'weapon') return 'weapon';
    if (elType === 'armor' || elType === 'shield' || elType === 'armor_shield') return 'armor_shield';
    return 'power';
  }, [setsCatalog]);

  const getElementSkillStats = useCallback((el?: PathLinkedElement | null) => {
    if (!el) return {};
    const cat = getLinkedElementCategory(el);
    const cleanName = (el.name || '').toLowerCase().trim();

    if (cat === 'weapon') {
      const found = (weaponsCatalog || []).find(
        (w) => (w.name || '').toLowerCase().trim() === cleanName || String(w.id) === String(el.id)
      );
      return {
        req: found?.requirement || el.item_data?.requirement,
        damage: found?.dmg || (found as any)?.damage || el.item_data?.damage || el.item_data?.dmg,
        type: found?.type || el.item_data?.type || 'Melee',
        action: (found as any)?.atk || (found as any)?.action || el.item_data?.action || el.item_data?.atk,
      };
    }
    if (cat === 'armor_shield') {
      const foundArmor = (armorCatalog || []).find(
        (a) => (a.name || '').toLowerCase().trim() === cleanName || String(a.id) === String(el.id)
      );
      const foundShield = (shieldsCatalog || []).find(
        (s) => (s.name || '').toLowerCase().trim() === cleanName || String(s.id) === String(el.id)
      );
      return {
        req: foundArmor?.requirement || foundShield?.requirement || el.item_data?.requirement,
        ar: foundArmor?.ar || el.item_data?.ar,
        max_block: foundShield?.max_block || el.item_data?.max_block,
      };
    }
    if (cat === 'power') {
      const found = (powers || []).find(
        (p) => (p.name || '').toLowerCase().trim() === cleanName || String(p.id) === String(el.id)
      );
      return {
        action: found?.action || el.item_data?.action,
        usage: found?.usage || el.item_data?.usage,
        req: (found as any)?.requirement || el.item_data?.requirement,
      };
    }
    if (cat === 'skill') {
      const found = (skills || []).find(
        (s) => (s.name || '').toLowerCase().trim() === cleanName || String(s.id) === String(el.id)
      );
      return {
        attribute: found?.attribute || el.item_data?.attribute,
        discipline: found?.discipline || el.item_data?.discipline,
      };
    }
    return {};
  }, [getLinkedElementCategory, weaponsCatalog, armorCatalog, shieldsCatalog, powers, skills]);

  const pathCategoryMembers = useMemo(() => {
    const groups: Record<
      'trait' | 'power' | 'skill' | 'weapon' | 'armor_shield',
      { sets: PathLinkedElement[]; elements: PathLinkedElement[] }
    > = {
      trait: { sets: [], elements: [] },
      power: { sets: [], elements: [] },
      skill: { sets: [], elements: [] },
      weapon: { sets: [], elements: [] },
      armor_shield: { sets: [], elements: [] },
    };
    (linkedElements || []).forEach((el) => {
      const cat = getLinkedElementCategory(el);
      const isSet = (el.type || el.element_type || '').toLowerCase() === 'set';
      if (isSet) {
        groups[cat].sets.push(el);
      } else {
        groups[cat].elements.push(el);
      }
    });
    return groups;
  }, [linkedElements, getLinkedElementCategory]);

  const activePathSetItems = useMemo(() => {
    if (activePathSelection.type !== 'path_set' || !activePathSelection.setItem) return [];
    const setItem = activePathSelection.setItem as any;
    if (Array.isArray(setItem.items) && setItem.items.length > 0) return setItem.items;
    const setRecord = (setsCatalog || []).find(
      (s) => String(s.id) === String(setItem.id) || s.name === setItem.name
    ) as any;
    if (setRecord && Array.isArray(setRecord.items)) return setRecord.items;
    return [];
  }, [activePathSelection, setsCatalog]);

  const [pathAddSetSearch, setPathAddSetSearch] = useState('');
  const availableSetsForPathCategory = useMemo(() => {
    if (activePathSelection.type !== 'path_add_set' || !activePathSelection.category) return [];
    const cat = activePathSelection.category;
    return (setsCatalog || []).filter((s) => {
      const c = (s.category || '').toLowerCase();
      if (cat === 'weapon') return c.includes('weapon');
      if (cat === 'armor_shield') return c.includes('armor') || c.includes('shield');
      if (cat === 'power') return c.includes('power');
      if (cat === 'skill') return c.includes('skill');
      if (cat === 'trait') return c.includes('trait');
      return true;
    });
  }, [activePathSelection, setsCatalog]);

  const filteredSetsForPathCategory = useMemo(() => {
    const q = pathAddSetSearch.trim().toLowerCase();
    if (!q) return availableSetsForPathCategory;
    return availableSetsForPathCategory.filter(
      (s) => (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)
    );
  }, [availableSetsForPathCategory, pathAddSetSearch]);

  const [pathAddElementSearch, setPathAddElementSearch] = useState('');
  const availableElementsForPathCategory = useMemo(() => {
    if (activePathSelection.type !== 'path_add_element' || !activePathSelection.category) return [];
    const cat = activePathSelection.category;
    if (cat === 'trait') {
      return (traits || []).map((t) => ({ ...t, _catalogType: 'trait' as PathElementType }));
    }
    if (cat === 'power') {
      return (powers || []).map((p) => ({ ...p, _catalogType: 'power' as PathElementType }));
    }
    if (cat === 'skill') {
      return (skills || []).map((s) => ({ ...s, _catalogType: 'skill' as PathElementType }));
    }
    if (cat === 'weapon') {
      return (weaponsCatalog || []).map((w) => ({ ...w, _catalogType: 'weapon' as PathElementType }));
    }
    if (cat === 'armor_shield') {
      const a = (armorCatalog || []).map((item) => ({ ...item, _catalogType: 'armor' as PathElementType }));
      const sh = (shieldsCatalog || []).map((item) => ({ ...item, _catalogType: 'shield' as PathElementType }));
      return [...a, ...sh];
    }
    return [];
  }, [activePathSelection, traits, powers, skills, weaponsCatalog, armorCatalog, shieldsCatalog]);

  const filteredElementsForPathCategory = useMemo(() => {
    const q = pathAddElementSearch.trim().toLowerCase();
    if (!q) return availableElementsForPathCategory;
    return availableElementsForPathCategory.filter((item: any) => {
      const n = (item.name || '').toLowerCase();
      const e = (item.effect || '').toLowerCase();
      const d = (item.description || '').toLowerCase();
      const req = (item.requirement || '').toLowerCase();
      return n.includes(q) || e.includes(q) || d.includes(q) || req.includes(q);
    });
  }, [availableElementsForPathCategory, pathAddElementSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-outfit">
      <div className={`bg-slate-900 border ${workshopMode === 'designer' ? 'border-amber-500/80 shadow-amber-950/70' : 'border-amber-500/40 shadow-amber-950/50'} rounded-2xl w-full max-w-5xl lg:max-w-6xl shadow-2xl flex flex-col h-[90vh] max-h-[92vh] overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border flex items-center justify-center text-xl ${
              workshopMode === 'designer'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {workshopMode === 'designer' ? '👑' : '♨️'}
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide flex items-center gap-2">
                Forge
                {workshopMode === 'designer' ? (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/50 uppercase tracking-wider font-mono">
                    👑 Designer Mode (Master Database Canon)
                  </span>
                ) : isGm ? (
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
                {workshopMode === 'designer'
                  ? 'Author, edit, & curate canonical Master Database records. Edits automatically propagate to all characters.'
                  : 'Craft custom Paths & Abilities, Chaos Gems, and Gear (including Exotics and Artifacts).'}
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

        {/* S-Tier 3-Pillar Master Navigation */}
        <div className="px-6 py-2 bg-slate-950/40 border-b border-slate-800/80 shrink-0 flex items-center justify-between gap-4">
          {/* Left: Sets Feeder & Pillar Navigation */}
          <div className="flex items-center gap-2">
            {/* Feeder Sub-Tab: Sets */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => handleSwitchTab('set')}
                className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  creationType === 'set'
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>🗂️</span>
                <span>Sets</span>
              </button>
            </div>

            {/* Feeder Indicator Arrow: Sets feed into Paths */}
            <div className="flex items-center text-slate-500 hover:text-indigo-400 transition-colors px-0.5" title="Sets feed into Paths">
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>

            {/* Core Creation Pillars: Paths, Chaos Gems, Gear */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => handleSwitchTab('paths_abilities')}
                className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  creationType === 'paths_abilities'
                    ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>🧭</span>
                <span>Paths</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('chaos_gem')}
                className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  creationType === 'chaos_gem'
                    ? 'bg-violet-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>💎</span>
                <span>Chaos Gems</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchTab('gear')}
                className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  creationType === 'gear'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>⚙️</span>
                <span>Gear</span>
              </button>
            </div>
          </div>

          {/* Right: Scope Switch (ONLY for metascapegame@gmail.com) */}
          {isMasterAccount && (
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              <button
                type="button"
                onClick={() => handleSwitchScope('player')}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  workshopMode === 'player'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Personal Creations mode (saves to Custom Elements / personal scope)"
              >
                <span>🎨</span>
                <span>My Creations</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchScope('designer')}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  workshopMode === 'designer'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm font-extrabold shadow-amber-950/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Master Database Canon mode (edits canonical Supabase records)"
              >
                <span>👑</span>
                <span>Canon</span>
              </button>
            </div>
          )}
        </div>

        {/* 2-Pane Grid Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
          {/* ========================================================================= */}
          {/* PANE 1 (LEFT): STUDIO BLUEPRINT TREE (GEAR) OR LIVE CARD PREVIEW          */}
          {/* ========================================================================= */}
          {creationType === 'gear' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Chassis Category Filter Switch */}
              <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setGearDatabaseChassis('weapon');
                    setStudioChassisType('weapon');
                    handleResetForm();
                  }}
                  className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    gearDatabaseChassis === 'weapon'
                      ? 'bg-orange-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  ⚔️ Weapons
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGearDatabaseChassis('armor');
                    setStudioChassisType('armor');
                    handleResetForm();
                  }}
                  className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    gearDatabaseChassis === 'armor'
                      ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  🥋 Armor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGearDatabaseChassis('shield');
                    setStudioChassisType('shield');
                    handleResetForm();
                  }}
                  className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    gearDatabaseChassis === 'shield'
                      ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  🛡️ Shields
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGearDatabaseChassis('supplies');
                    setStudioChassisType('supplies');
                    handleResetForm();
                  }}
                  className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    gearDatabaseChassis === 'supplies'
                      ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  🎒 Supplies
                </button>
              </div>

              {/* Header: Title / Count, Search Bar, and + New Button */}
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span>{workshopMode === 'designer' ? '👑' : '🎨'}</span>
                  <span>
                    {workshopMode === 'designer' ? 'Master ' : 'My '}
                    {gearDatabaseChassis === 'weapon'
                      ? 'Weapons'
                      : gearDatabaseChassis === 'armor'
                      ? 'Armor'
                      : gearDatabaseChassis === 'shield'
                      ? 'Shields'
                      : 'Supplies'}
                    {' '}(
                    {workshopMode === 'designer'
                      ? gearDatabaseChassis === 'weapon'
                        ? filteredCanonicalWeapons.length
                        : gearDatabaseChassis === 'armor'
                        ? filteredCanonicalArmor.length
                        : gearDatabaseChassis === 'shield'
                        ? filteredCanonicalShields.length
                        : filteredCanonicalSupplies.length
                      : filteredMyGearItems.length}
                    )
                  </span>
                </span>

                {/* Inline Search Bar */}
                <div className="flex-1 min-w-[120px] max-w-xs relative flex items-center">
                  <input
                    type="text"
                    value={canonicalSearchQuery}
                    onChange={(e) => setCanonicalSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCanonicalSearchEnter('gear');
                    }}
                    placeholder={`Search ${gearDatabaseChassis}...`}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                  {canonicalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCanonicalSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (workshopMode === 'designer') {
                      handleNewMasterEntry();
                    } else {
                      handleResetForm();
                    }
                    setStudioChassisType(gearDatabaseChassis);
                    setIsCreatingNewGear(true);
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                    workshopMode === 'designer'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {workshopMode === 'designer' ? '+ New Master Item' : '+ New Gear'}
                </button>
              </div>

              {/* Dropdown Selector */}
              <select
                value={canonicalSelectedId || (editingItem ? String(editingItem.id) : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleResetForm();
                    setStudioChassisType(gearDatabaseChassis);
                    setIsCreatingNewGear(false);
                    return;
                  }
                  setIsCreatingNewGear(false);
                  if (workshopMode === 'designer') {
                    if (gearDatabaseChassis === 'weapon') {
                      const item = (weaponsCatalog || []).find((w) => String(w.id) === val || w.name === val);
                      if (item) handlePopulateCanonicalWeapon(item);
                    } else if (gearDatabaseChassis === 'armor') {
                      const item = (armorCatalog || []).find((a) => String(a.id) === val || a.name === val);
                      if (item) handlePopulateCanonicalArmor(item);
                    } else if (gearDatabaseChassis === 'shield') {
                      const item = (shieldsCatalog || []).find((s) => String(s.id) === val || s.name === val);
                      if (item) handlePopulateCanonicalShield(item);
                    } else if (gearDatabaseChassis === 'supplies') {
                      const item = (suppliesCatalog || []).find((sup) => String(sup.id) === val || sup.name === val);
                      if (item) handlePopulateCanonicalSupply(item);
                    }
                  } else {
                    const item = filteredMyGearItems.find((it) => String(it.id) === val || it.name === val);
                    if (item) {
                      if (item.rawItem?.item_data) {
                        handlePopulateItemForEdit(item.rawItem);
                      } else {
                        if (item.chassis === 'weapon') handlePopulateCanonicalWeapon(item.rawItem);
                        else if (item.chassis === 'armor') handlePopulateCanonicalArmor(item.rawItem);
                        else if (item.chassis === 'shield') handlePopulateCanonicalShield(item.rawItem);
                        else if (item.chassis === 'supplies') handlePopulateCanonicalSupply(item.rawItem);
                      }
                    }
                  }
                }}
                className={`bg-slate-950 border text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer shrink-0 ${
                  workshopMode === 'designer' ? 'border-slate-700 text-amber-300' : 'border-slate-700 text-emerald-300'
                }`}
              >
                <option value="">
                  {canonicalSearchQuery
                    ? `-- Filtered (${
                        workshopMode === 'designer'
                          ? gearDatabaseChassis === 'weapon'
                            ? filteredCanonicalWeapons.length
                            : gearDatabaseChassis === 'armor'
                            ? filteredCanonicalArmor.length
                            : gearDatabaseChassis === 'shield'
                            ? filteredCanonicalShields.length
                            : filteredCanonicalSupplies.length
                          : filteredMyGearItems.length
                      } matches) --`
                    : `-- Choose ${workshopMode === 'designer' ? 'Master' : 'My'} ${
                        gearDatabaseChassis.charAt(0).toUpperCase() + gearDatabaseChassis.slice(1)
                      } (${
                        workshopMode === 'designer'
                          ? gearDatabaseChassis === 'weapon'
                            ? filteredCanonicalWeapons.length
                            : gearDatabaseChassis === 'armor'
                            ? filteredCanonicalArmor.length
                            : gearDatabaseChassis === 'shield'
                            ? filteredCanonicalShields.length
                            : filteredCanonicalSupplies.length
                          : filteredMyGearItems.length
                      }) --`}
                </option>
                {workshopMode === 'designer' ? (
                  <>
                    {gearDatabaseChassis === 'weapon' &&
                      filteredCanonicalWeapons.map((w) => (
                        <option key={w.id || w.name} value={w.id || w.name}>
                          {w.name} ({w.type || 'Melee'}{w.requirement ? `, ${w.requirement}` : ''})
                        </option>
                      ))}
                    {gearDatabaseChassis === 'armor' &&
                      filteredCanonicalArmor.map((a) => (
                        <option key={a.id || a.name} value={a.id || a.name}>
                          {a.name} ({a.requirement || 'No Req'}{a.ar ? `, AR ${a.ar}` : ''})
                        </option>
                      ))}
                    {gearDatabaseChassis === 'shield' &&
                      filteredCanonicalShields.map((s) => (
                        <option key={s.id || s.name} value={s.id || s.name}>
                          {s.name} ({s.requirement || 'No Req'})
                        </option>
                      ))}
                    {gearDatabaseChassis === 'supplies' &&
                      filteredCanonicalSupplies.map((sup) => {
                        const cat = (sup.category || 'Gear').trim();
                        const showCost = sup.cost && sup.cost.trim().toLowerCase() !== cat.toLowerCase();
                        return (
                          <option key={sup.id || sup.name} value={sup.id || sup.name}>
                            {sup.name} ({cat}{showCost ? `, ${sup.cost}` : ''})
                          </option>
                        );
                      })}
                  </>
                ) : (
                  filteredMyGearItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.details})
                    </option>
                  ))
                )}
              </select>

              {/* Gear Hierarchy Tree: Only rendered when an item is selected or + New Gear clicked */}
              {isGearActive ? (
                renderGearHierarchyTree(workshopMode === 'designer')
              ) : null}
            </div>
          ) : creationType === 'paths_abilities' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Header: Title / Count, Search Bar, and + New Button */}
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span>{workshopMode === 'designer' ? '👑' : '🎨'}</span>
                  <span>
                    {workshopMode === 'designer' ? 'Master Paths' : 'My Paths'} (
                    {workshopMode === 'designer' ? filteredCanonicalPaths.length : myPathsList.length})
                  </span>
                </span>

                {/* Inline Search Bar */}
                <div className="flex-1 min-w-[120px] max-w-xs relative flex items-center">
                  <input
                    type="text"
                    value={canonicalSearchQuery}
                    onChange={(e) => setCanonicalSearchQuery(e.target.value)}
                    placeholder={workshopMode === 'designer' ? "Search master paths..." : "Search my paths..."}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                  {canonicalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCanonicalSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (workshopMode === 'designer') {
                      handleNewMasterEntry();
                    } else {
                      handleResetForm();
                    }
                    setCreationType('paths_abilities');
                    setPathStudioMode('path');
                    setIsCreatingNewPath(true);
                    setCanonicalSelectedId('');
                    setSelectedPathId('');
                    setActivePathSelection({ type: 'path_root' });
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                    workshopMode === 'designer'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30'
                  }`}
                  title={workshopMode === 'designer' ? "Author a new canonical Master Path in Supabase" : "Create a new custom Path"}
                >
                  {workshopMode === 'designer' ? '+ New Master Path' : '+ New Path'}
                </button>
              </div>

              {/* Dropdown Selector */}
              <select
                value={canonicalSelectedId || selectedPathId || (editingItem ? String(editingItem.id) : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleResetForm();
                    setCreationType('paths_abilities');
                    setPathStudioMode('path');
                    setIsCreatingNewPath(false);
                    setSelectedPathId('');
                    return;
                  }
                  setIsCreatingNewPath(false);
                  setSelectedPathId(val);
                  if (workshopMode === 'designer') {
                    const p = (paths || []).find((item) => String(item.id) === val || item.name === val);
                    if (p) {
                      handlePopulateOfficialPath(p);
                      setActivePathSelection({ type: 'path_root' });
                    }
                  } else {
                    const found = myPathsList.find((p) => p.id === val || String(p.rawItem?.id) === val || p.name === val);
                    if (found) {
                      if (found.source === 'personal') {
                        handlePopulateItemForEdit(found.rawItem);
                      } else {
                        handlePopulateOfficialPath(found.rawItem);
                      }
                      setActivePathSelection({ type: 'path_root' });
                    }
                  }
                }}
                className={`bg-slate-950 border text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer shrink-0 ${
                  workshopMode === 'designer' ? 'border-slate-700 text-amber-300' : 'border-slate-700 text-blue-300'
                }`}
              >
                <option value="">
                  {canonicalSearchQuery
                    ? `-- Filtered (${
                        workshopMode === 'designer' ? filteredCanonicalPaths.length : myPathsList.length
                      } matches) --`
                    : `-- Choose ${workshopMode === 'designer' ? 'Master' : 'My'} Path (${
                        workshopMode === 'designer' ? (paths || []).length : myPathsList.length
                      } available) --`}
                </option>
                {workshopMode === 'designer'
                  ? filteredCanonicalPaths.map((p) => (
                      <option key={p.id || p.name} value={p.id || p.name}>
                        {p.name.toLowerCase() === 'universal' ? '🌐 ' : '🧭 '}
                        {p.name} ({p.category || 'General'})
                      </option>
                    ))
                  : myPathsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        🧭 {p.name} ({p.category || 'Path'})
                      </option>
                    ))}
              </select>

              {/* Active Draft Path Tree View (Always 100% Expanded, 0 Save Buttons) */}
              {isPathActive ? (
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-1">
                  {/* Tier 1: Path Root Card */}
                  <div
                    onClick={() => setActivePathSelection({ type: 'path_root' })}
                    className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer shadow-sm ${
                      activePathSelection.type === 'path_root'
                        ? 'bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/40'
                        : 'bg-slate-900/80 border-slate-800 hover:border-blue-500/40 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">🧭</span>
                      <span className="font-bold text-slate-100 text-xs truncate">
                        {name || 'Unnamed Path'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-300 border border-blue-500/40">
                        {finalPathCat}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        🧩 1 AP
                      </span>
                      {/* Delete Path trashcan if saved */}
                      {((canonicalSelectedId && workshopMode === 'designer' && !isUniversalPath) ||
                        (workshopMode === 'player' && (editingItem || canonicalSelectedId))) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmTarget({
                              type: 'path',
                              id: (editingItem ? editingItem.id : canonicalSelectedId) as string | number,
                              name: editingItem ? editingItem.name : (originalCanonicalName || name.trim()),
                            });
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-500/40 transition cursor-pointer"
                          title="Delete this Path"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tier 2 & 3: The 5 Always-Present Ability Categories Tree (Permanently Expanded) */}
                  <div className="ml-4 pl-3 border-l-2 border-blue-500/40 flex flex-col gap-3 pt-1 pb-1">
                    {PATH_ABILITY_CATEGORIES.map((cat) => {
                      const catData = pathCategoryMembers[cat.id];
                      const setsCount = catData.sets.length;
                      const indCount = catData.elements.length;

                      return (
                        <div key={cat.id} className="flex flex-col gap-1.5">
                          {/* Category Header */}
                          <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                            <span className="font-bold flex items-center gap-1.5 text-slate-200">
                              <span>{cat.icon}</span>
                              <span>{cat.label}</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({setsCount} {setsCount === 1 ? 'Set' : 'Sets'}, {indCount} {indCount === 1 ? 'Individual' : 'Individuals'})
                            </span>
                          </div>

                          {/* Indented Tier 3: Sets & Individuals & Add Buttons */}
                          <div className="ml-3 pl-2.5 border-l border-slate-800/80 flex flex-col gap-1.5">
                            {/* Linked Sets in this category */}
                            {catData.sets.map((setItem) => {
                              const isSelected =
                                activePathSelection.type === 'path_set' &&
                                String(activePathSelection.setItem?.id) === String(setItem.id);
                              const setRec = (setsCatalog || []).find(
                                (s) => String(s.id) === String(setItem.id) || s.name === setItem.name
                              );
                              const itemCount =
                                Array.isArray((setItem as any).items) && (setItem as any).items.length > 0
                                  ? (setItem as any).items.length
                                  : Array.isArray((setRec as any)?.items) && (setRec as any).items.length > 0
                                  ? (setRec as any).items.length
                                  : setRec?.items_count;

                              return (
                                <div
                                  key={String(setItem.id)}
                                  onClick={() => setActivePathSelection({ type: 'path_set', setItem, setRecord: setRec })}
                                  className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/40'
                                      : 'bg-gradient-to-r from-slate-900/90 to-slate-950/80 border-slate-800 border-l-2 border-l-amber-500/70 hover:border-slate-700 hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs shrink-0">🗂️</span>
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 font-extrabold uppercase shrink-0">
                                      SET
                                    </span>
                                    <span className="font-bold text-slate-200 text-xs truncate">
                                      {setItem.name}
                                    </span>
                                    {itemCount !== undefined && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                                        {itemCount} items
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {/* KISS Pill Switch for All Free vs All 1 AP */}
                                    <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner backdrop-blur-md">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleLinkedTag(setItem.id, 'Free')}
                                        className={`py-0.5 px-2 rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                                          setItem.tag === 'Free'
                                            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                        }`}
                                        title="All items in set are Free (0 AP)"
                                      >
                                        <span className="text-xs shrink-0 leading-none">🎁</span>
                                        <div className="flex flex-col items-center justify-center leading-none">
                                          <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85 leading-none">All</span>
                                          <span className="text-[9.5px] font-extrabold leading-none mt-0.5">Free</span>
                                        </div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleLinkedTag(setItem.id, '1 AP')}
                                        className={`py-0.5 px-2 rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                                          setItem.tag === '1 AP'
                                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                        }`}
                                        title="All items in set cost 1 AP each to acquire"
                                      >
                                        <span className="text-xs shrink-0 leading-none">🧩</span>
                                        <div className="flex flex-col items-center justify-center leading-none">
                                          <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85 leading-none">All</span>
                                          <span className="text-[9.5px] font-extrabold leading-none mt-0.5">1 AP</span>
                                        </div>
                                      </button>
                                    </div>

                                    {/* Trashcan Icon */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleRemoveLinkedElement(setItem.id);
                                        if (
                                          activePathSelection.type === 'path_set' &&
                                          String(activePathSelection.setItem?.id) === String(setItem.id)
                                        ) {
                                          setActivePathSelection({ type: 'path_root' });
                                        }
                                      }}
                                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                      title={`Remove ${setItem.name} from path`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Linked Individuals in this category */}
                            {catData.elements.map((element) => {
                              const isSelected =
                                activePathSelection.type === 'path_element' &&
                                String(activePathSelection.element?.id) === String(element.id);
                              const stats = getElementSkillStats(element);

                              return (
                                <div
                                  key={String(element.id)}
                                  onClick={() =>
                                    setActivePathSelection({ type: 'path_element', element, category: cat.id })
                                  }
                                  className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/40'
                                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs shrink-0">{cat.icon}</span>
                                    <span className="font-bold text-slate-200 text-xs truncate">
                                      {element.name}
                                    </span>
                                    {stats.req && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold shrink-0">
                                        {stats.req}
                                      </span>
                                    )}
                                    {stats.action && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-bold shrink-0">
                                        {stats.action}
                                      </span>
                                    )}
                                    {stats.usage && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-bold shrink-0">
                                        {stats.usage}
                                      </span>
                                    )}
                                    {stats.damage && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-rose-300 font-bold shrink-0">
                                        {stats.damage}
                                      </span>
                                    )}
                                    {stats.ar && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-purple-300 font-bold shrink-0">
                                        AR {stats.ar}
                                      </span>
                                    )}
                                    {stats.attribute && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold shrink-0">
                                        {stats.attribute}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {/* KISS Pill Switch for Free vs 1 AP */}
                                    <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner backdrop-blur-md">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleLinkedTag(element.id, 'Free')}
                                        className={`py-0.5 px-2 text-[10px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${
                                          element.tag === 'Free'
                                            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                        }`}
                                        title="Free (0 AP)"
                                      >
                                        <span>🎁</span>
                                        <span>Free</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleLinkedTag(element.id, '1 AP')}
                                        className={`py-0.5 px-2 text-[10px] font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${
                                          element.tag === '1 AP'
                                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                        }`}
                                        title="1 AP advancement"
                                      >
                                        <span>🧩</span>
                                        <span>1 AP</span>
                                      </button>
                                    </div>

                                    {/* Trashcan Icon */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleRemoveLinkedElement(element.id);
                                        if (
                                          activePathSelection.type === 'path_element' &&
                                          String(activePathSelection.element?.id) === String(element.id)
                                        ) {
                                          setActivePathSelection({ type: 'path_root' });
                                        }
                                      }}
                                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                      title={`Remove ${element.name} from path`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Action Buttons for this category */}
                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setActivePathSelection({ type: 'path_add_set', category: cat.id })
                                }
                                className="flex-1 py-1 px-2 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-950/60 hover:bg-slate-900 text-[11px] font-bold text-slate-400 hover:text-blue-300 transition flex items-center justify-center gap-1 cursor-pointer select-none"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Add {cat.singular} Set</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActivePathSelection({ type: 'path_add_element', category: cat.id })
                                }
                                className="flex-1 py-1 px-2 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/60 bg-slate-950/60 hover:bg-slate-900 text-[11px] font-bold text-slate-400 hover:text-blue-300 transition flex items-center justify-center gap-1 cursor-pointer select-none"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Add {cat.singular}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                  <span className="text-2xl mb-1.5">{workshopMode === 'designer' ? '👑' : '🧭'}</span>
                  <p className="font-semibold text-slate-400">
                    {workshopMode === 'designer' ? 'No Master Path Selected' : 'No Path Selected'}
                  </p>
                  <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                    {workshopMode === 'designer'
                      ? 'Pick a Master Path from the dropdown above to inspect and edit its Linked Sets and Abilities, or click "+ New Master Path" to author a new canonical path.'
                      : 'Pick a Path from your creations above or click "+ New Path" to forge a custom Path Archetype.'}
                  </p>
                </div>
              )}
            </div>
          ) : creationType === 'chaos_gem' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Header: Title / Count, Search Bar, and + New Button */}
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span>{workshopMode === 'designer' ? '👑' : '🎨'}</span>
                  <span>
                    {workshopMode === 'designer' ? 'Master Chaos Gems' : 'My Chaos Gems'} (
                    {workshopMode === 'designer' ? canonicalChaosGems.length : filteredMyGems.length})
                  </span>
                </span>

                {/* Inline Search Bar */}
                <div className="flex-1 min-w-[120px] max-w-xs relative flex items-center">
                  <input
                    type="text"
                    value={canonicalSearchQuery}
                    onChange={(e) => setCanonicalSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCanonicalSearchEnter('chaos_gem');
                    }}
                    placeholder={workshopMode === 'designer' ? "Search master gems..." : "Search my gems..."}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/80 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                  {canonicalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCanonicalSearchQuery('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (workshopMode === 'designer') {
                      handleNewMasterEntry();
                    } else {
                      handleResetForm();
                    }
                    setCreationType('chaos_gem');
                    setIsCreatingNewChaosGem(true);
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition cursor-pointer shrink-0 ${
                    workshopMode === 'designer'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30'
                  }`}
                >
                  {workshopMode === 'designer' ? '+ New Master Gem' : '+ New Chaos Gem'}
                </button>
              </div>

              {/* Dropdown Selector */}
              <select
                value={canonicalSelectedId || (editingItem ? String(editingItem.id) : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleResetForm();
                    setCreationType('chaos_gem');
                    setIsCreatingNewChaosGem(false);
                    return;
                  }
                  setIsCreatingNewChaosGem(false);
                  if (workshopMode === 'designer') {
                    const gem = (canonicalChaosGems || []).find((g) => String(g.id) === val || g.name === val);
                    if (gem) handlePopulateCanonicalChaosGem(gem);
                  } else {
                    const gem = filteredMyGems.find((g) => String(g.id) === val || g.name === val);
                    if (gem) {
                      if (gem.rawItem?.item_data) {
                        handlePopulateItemForEdit(gem.rawItem);
                      } else {
                        handlePopulateCanonicalChaosGem(gem);
                      }
                    }
                  }
                }}
                className={`bg-slate-950 border text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer shrink-0 ${
                  workshopMode === 'designer' ? 'border-slate-700 text-amber-300' : 'border-slate-700 text-violet-300'
                }`}
              >
                <option value="">
                  {canonicalSearchQuery
                    ? `-- Filtered (${
                        workshopMode === 'designer'
                          ? filteredCanonicalChaosGems.length
                          : filteredMyGems.length
                      } matches) --`
                    : `-- Choose ${workshopMode === 'designer' ? 'Master' : 'My'} Chaos Gem (${
                        workshopMode === 'designer'
                          ? canonicalChaosGems.length
                          : filteredMyGems.length
                      }) --`}
                </option>
                {workshopMode === 'designer'
                  ? filteredCanonicalChaosGems.map((g) => (
                      <option key={g.id || g.name} value={g.id || g.name}>
                        {g.name}
                      </option>
                    ))
                  : filteredMyGems.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.action || 'F'} • {g.usage || '3 Uses'})
                      </option>
                    ))}
              </select>

              {/* Live Card Preview & Actions: Rendered only when active */}
              {isChaosGemActive ? (
                <>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
                    <div className="p-4 rounded-xl bg-slate-900 border border-violet-500/40 shadow-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">💎</span>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-100 text-xs truncate">{name || 'Unnamed Chaos Gem'}</h4>
                            {canonicalSelectedId && (
                              <span className="text-[10px] text-amber-400 font-mono">
                                {workshopMode === 'designer' ? '👑 Master ID: ' : 'ID: '}{canonicalSelectedId}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/40 font-bold">
                            {action || 'F'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">
                            {usage || '3 Uses'}
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                        {effect || 'Socket activation effect will render here...'}
                      </div>
                      {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                    </div>
                  </div>

                  {/* Bottom Actions Row */}
                  <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                    {workshopMode === 'designer' && canonicalSelectedId && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 italic">
                          Edit details on right, then save.
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirmTarget({
                              type: 'chaos_gem',
                              id: canonicalSelectedId,
                              name: originalCanonicalName || name,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Delete this record from Supabase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete from SupaBase</span>
                        </button>
                      </div>
                    )}
                    {workshopMode === 'player' && (editingItem || canonicalSelectedId) && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-400 italic">
                          Editing personal creation
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirmTarget({
                              type: 'chaos_gem',
                              id: (editingItem ? editingItem.id : canonicalSelectedId) as string | number,
                              name: editingItem ? editingItem.name : name,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                          title="Delete this Chaos Gem"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Creation</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          ) : creationType === 'set' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Header: Title / Count, Search Bar, and + New Set Button */}
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                <span className="flex items-center gap-1.5 shrink-0">
                  <span>{workshopMode === 'designer' ? '👑' : '🎨'}</span>
                  <span>
                    {workshopMode === 'designer' ? 'Master Sets' : 'My Sets'} ({availableSetsForLeftPane.length})
                  </span>
                </span>

                {/* Inline Search Bar */}
                <div className="flex-1 min-w-[120px] max-w-xs relative flex items-center">
                  <input
                    type="text"
                    value={setsSearchQuery}
                    onChange={(e) => setSetsSearchQuery(e.target.value)}
                    placeholder={workshopMode === 'designer' ? 'Search master sets...' : 'Search my sets...'}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-7 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                  {setsSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSetsSearchQuery('')}
                      className="absolute right-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNewSet}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-[11px] shadow-sm shadow-indigo-950/40 transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Set</span>
                </button>
              </div>

              {/* Set Selector Dropdown */}
              <div className="relative shrink-0">
                <select
                  value={selectedSetId}
                  onChange={(e) => {
                    const found = setsCatalog?.find((s) => String(s.id) === e.target.value);
                    if (found) {
                      handleSelectSet(found);
                    } else if (e.target.value === '') {
                      handleResetSetSelection();
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 appearance-none focus:outline-none focus:border-indigo-500 transition cursor-pointer pr-8 font-medium"
                >
                  <option value="">-- Choose an existing set to inspect/edit --</option>
                  {availableSetsForLeftPane.map((s) => (
                    <option key={s.id || s.name} value={s.id ? String(s.id) : ''}>
                      {s.name} ({s.category}{s.items_count !== undefined ? ` • ${s.items_count} items` : ''})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Main Content Area */}
              {isSetActive ? (
                <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-y-auto pr-0.5">
                  {/* 1. SET ROOT NODE CARD */}
                  <div
                    onClick={() => setActiveSetSelection({ type: 'set_root' })}
                    className={`p-2.5 sm:p-3 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer shadow-sm ${
                      activeSetSelection.type === 'set_root'
                        ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                        : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">🗂️</span>
                      <span className="font-bold text-slate-100 text-xs truncate">
                        {name || 'Unnamed Set'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40">
                        {selectedSetCategory}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {draftSetItems.length} {draftSetItems.length === 1 ? 'item' : 'items'}
                      </span>
                      {selectedSetId && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCurrentSet();
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-500/40 transition cursor-pointer"
                          title="Delete Set"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. HIERARCHICAL TREE (PERMANENTLY EXPANDED) */}
                  <div className="ml-5 sm:ml-6 pl-3 sm:pl-4 border-l-2 border-indigo-500/40 flex flex-col gap-2 pt-1 pb-1">
                    {draftSetItems.length === 0 ? (
                      <div className="p-3 rounded-lg bg-slate-950/60 border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        Set is empty. Click "+ Add Item" below to browse catalog.
                      </div>
                    ) : (
                      draftSetItems.map((item, idx) => {
                        const isItemSelected =
                          activeSetSelection.type === 'set_member' && activeSetSelection.index === idx;
                        const isNewItem = Boolean(
                          selectedSetId && !isCreatingNewSet && !initialExistingMemberIds.has(String(item.id))
                        );
                        return (
                          <div
                            key={`${item.id}_${idx}`}
                            onClick={() => setActiveSetSelection({ type: 'set_member', item, index: idx })}
                            className={`p-2 rounded-lg border transition flex items-center justify-between gap-2 cursor-pointer ${
                              isItemSelected
                                ? isNewItem
                                  ? 'bg-emerald-950/60 border-emerald-400 ring-2 ring-emerald-400/60 shadow-[0_0_16px_rgba(16,185,129,0.25)]'
                                  : 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/40'
                                : isNewItem
                                ? 'bg-emerald-950/40 border-emerald-500/70 hover:bg-emerald-950/60 ring-1 ring-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs shrink-0">
                                {item.element_type === 'weapon' || item.table === 'weapons'
                                  ? '⚔️'
                                  : item.element_type === 'armor' || item.table === 'armor' || item.element_type === 'shield' || item.table === 'shields'
                                  ? '🛡️'
                                  : item.element_type === 'power' || item.table === 'powers'
                                  ? '⚡'
                                  : item.element_type === 'skill' || item.table === 'skills'
                                  ? '🎯'
                                  : '🧬'}
                              </span>
                              <span className={`text-xs truncate ${isNewItem ? 'font-black text-emerald-300' : 'font-bold text-slate-200'}`}>
                                {item.name}
                              </span>
                              {isNewItem && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black shadow-sm flex items-center gap-0.5 shrink-0">
                                  ✨ New
                                </span>
                              )}
                              {item.requirement && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold shrink-0">
                                  {item.requirement}
                                </span>
                              )}
                              {item.action && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-bold shrink-0">
                                  {item.action}
                                </span>
                              )}
                              {item.usage && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-bold shrink-0">
                                  {item.usage}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveItemFromDraft(String(item.id));
                                  if (activeSetSelection.type === 'set_member' && activeSetSelection.index === idx) {
                                    setActiveSetSelection({ type: 'set_root' });
                                  }
                                }}
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition cursor-pointer"
                                title={`Remove ${item.name} from set`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* + Add Item to Set Dashed Button */}
                    <button
                      type="button"
                      onClick={() => setActiveSetSelection({ type: 'set_add_member' })}
                      className="py-1 px-2.5 rounded-lg border border-dashed border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 hover:bg-slate-900 text-xs font-bold text-slate-400 hover:text-indigo-300 transition flex items-center justify-center gap-1.5 cursor-pointer select-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add {selectedSetCategory} Item</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">🗂️</span>
                  <p className="font-bold text-slate-300 text-sm">Forge Sets Studio</p>
                  <p className="text-[11px] mt-1 text-slate-500 max-w-sm">
                    Select a set from the dropdown above to inspect and edit its items, or click "+ New Set" to author a new collection.
                  </p>
                </div>
              )}
            </div>
          ) : (
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
        )}

          {/* ========================================================================= */}
          {/* PANE 2 (RIGHT): 3-MODE CONTEXTUAL STUDIO EDITOR OR FORGE FORM             */}
          {/* ========================================================================= */}
          {creationType === 'gear' ? (
            <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-900/60 p-5 overflow-y-auto gap-4 text-xs">
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

              {/* IDLE VIEW: NO GEAR CHOSEN */}
              {!isGearActive && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">⚙️</span>
                  <p className="font-bold text-slate-300 text-sm">Forge Gear Studio</p>
                  <p className="text-[11px] mt-1 text-slate-500 max-w-sm">
                    Select an item from the left pane or click "+ New Gear" to inspect and edit its equipment properties.
                  </p>
                </div>
              )}

              {/* MODE 1: CHASSIS EDITOR */}
              {isGearActive && activeStudioSelection.type === 'chassis' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📦</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          Equipment Chassis Configuration
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Configure baseline equipment form, category, base combat stats, lore, and pricing.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-mono text-[10px] font-bold">
                      Mode: Chassis
                    </span>
                  </div>

                  {/* Chassis Name */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Name</span>
                        <GuardrailBadge isValid={isNameValid} />
                        <InfoTooltip text="Enter the unique name of this equipment creation." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        studioChassisType === 'weapon'
                          ? 'e.g. Iron Longsword, Flametongue Blade...'
                          : studioChassisType === 'armor'
                          ? 'e.g. Leather Cuirass, Aegis Powered Exosuit...'
                          : studioChassisType === 'shield'
                          ? 'e.g. Wooden Heater, Bulwark of Dawn...'
                          : 'e.g. Explorer Pack, Wand of Fireballs...'
                      }
                      className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-500 transition shadow-inner font-semibold"
                    />
                    {topLevelCollision.isCollision && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            '{topLevelCollision.existingItemName}' already exists in {workshopMode === 'designer' ? 'Master Canon' : 'My Creations'}.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setName(getAutoVersionedName(name, currentActiveCatalog))}
                          className="px-2 py-0.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-500/60 text-amber-100 font-bold text-[10px] transition cursor-pointer shrink-0"
                        >
                          ⚡ Auto-Add (v2)
                        </button>
                      </div>
                    )}
                    {topLevelCollision.isCanonMatch && !topLevelCollision.isCollision && workshopMode === 'player' && (
                      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-300 text-xs">
                        <span>ℹ️</span>
                        <span className="truncate">
                          Matches Canon '{topLevelCollision.existingItemName}'. Your version will be forged as a personal custom creation.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Subtype & Baseline Stats Controls */}
                  {studioChassisType === 'weapon' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300">Type Mode</span>
                        <select
                          value={weaponTypeMode}
                          onChange={(e) => setWeaponTypeMode(e.target.value as any)}
                          className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                        >
                          <option value="Melee">Melee</option>
                          <option value="Hurled">Hurled</option>
                          <option value="Shot">Shot</option>
                          <option value="Melee, Hurled">Melee, Hurled</option>
                          <option value="Melee, Shot">Melee, Shot</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300">Requirement</span>
                        <select
                          value={weaponReqNum}
                          onChange={(e) => setWeaponReqNum(parseInt(e.target.value, 10))}
                          className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                        >
                          {WEAPON_REQ_NUMBERS.map((n) => (
                            <option key={n} value={n}>
                              💪 {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300">Domain</span>
                        <select
                          value={weaponDomain}
                          onChange={(e) => setWeaponDomain(e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                        >
                          {availableWeaponDomains.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                        <span>Atk / Dmg: <strong className="text-amber-300">{getWeaponAtkDmg(weaponTypeMode)}</strong></span>
                        <span>•</span>
                        <span>Max Block: <strong className="text-cyan-300">{getWeaponMaxBlock(weaponTypeMode, weaponReqNum)}</strong></span>
                      </div>
                    </div>
                  )}

                  {studioChassisType === 'armor' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300">Armor Requirement</span>
                        <select
                          value={armorReq}
                          onChange={(e) => setArmorReq(e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                        >
                          {ARMOR_REQ_OPTIONS.map((req) => (
                            <option key={req} value={req}>
                              {req}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                        <span>Armor Rating (AR): <strong className="text-amber-300">{getArmorArStr(armorReq)}</strong></span>
                        <span>•</span>
                        <span>MR: <strong className="text-cyan-300">{getArmorMrStr(armorReq)}</strong></span>
                      </div>
                    </div>
                  )}

                  {studioChassisType === 'shield' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300">Shield Requirement</span>
                        <select
                          value={shieldReq}
                          onChange={(e) => setShieldReq(e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                        >
                          {SHIELD_REQ_OPTIONS.map((req) => (
                            <option key={req} value={req}>
                              {req}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300">Shield Domain</span>
                        <select
                          value={shieldDomain}
                          onChange={(e) => setShieldDomain(e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                        >
                          {availableShieldDomains.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex items-center gap-3 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                        <span>Max Block: <strong className="text-cyan-300">{getShieldMaxBlockStr(shieldReq)}</strong></span>
                        <span>•</span>
                        <span>MR Penalty: <strong className="text-cyan-300">{getShieldMrStr(shieldReq)}</strong></span>
                      </div>
                    </div>
                  )}

                  {studioChassisType === 'supplies' && (
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-300">Supplies Category</span>
                      <select
                        value={gearCategory}
                        onChange={(e) => setGearCategory(e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl outline-none cursor-pointer"
                      >
                        {GEAR_DEFAULT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="Arcane Focus">Arcane Focus</option>
                        <option value="CUSTOM_NEW">+ Custom Category...</option>
                      </select>

                      {gearCategory === 'CUSTOM_NEW' && (
                        <input
                          type="text"
                          value={gearCategoryNewText}
                          onChange={(e) => setGearCategoryNewText(e.target.value)}
                          placeholder="Enter custom category name..."
                          className="mt-1 bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-teal-500/50 outline-none font-semibold"
                        />
                      )}
                    </div>
                  )}

                  {/* Cost & Classification Pill Switch */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Cost & Pricing</span>
                        <GuardrailBadge isValid={costMode === 'artifact' ? true : isCostValid} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {costMode === 'artifact' ? 'Priceless' : 'Required'}
                      </span>
                    </div>

                    {/* KISS Multi-Option Pill Switch */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setCostMode('standard')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          costMode === 'standard'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        🪙 Standard (g/s)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCostMode('artifact')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          costMode === 'artifact'
                            ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        🔮 Artifact (Priceless)
                      </button>
                    </div>

                    {costMode === 'standard' ? (
                      <CompactCostInput
                        gold={costGold}
                        silver={costSilver}
                        onGoldChange={setCostGold}
                        onSilverChange={setCostSilver}
                      />
                    ) : (
                      <div className="px-3 py-2 rounded-xl bg-purple-950/70 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-between">
                        <span>🔮 Artifact (Priceless Relic)</span>
                        <span className="text-[10px] font-mono text-purple-400">Locked to 'Artifact'</span>
                      </div>
                    )}
                  </div>

                  {/* Lore & Notes */}
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Lore & Flavor Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Origin story, historical background, craftsmanship notes..."
                      className="bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-amber-500 transition shadow-inner font-serif italic resize-y min-h-[48px]"
                    />
                  </div>

                  {/* Genres */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Target Genres</span>
                        <GuardrailBadge isValid={isGenresValid} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Select at least 1</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {GENRE_OPTIONS.map((g) => {
                        const isSelected = selectedGenres.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              setSelectedGenres((prev) =>
                                isSelected ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                              isSelected
                                ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>{g.icon}</span>
                            <span>{g.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick-Action Bar */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!isFormValid || isSubmitting}
                      className={`py-2 px-5 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                        isFormValid && !isSubmitting
                          ? costMode === 'artifact'
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 text-white cursor-pointer'
                            : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <AnvilIcon className="w-3.5 h-3.5" />
                      <span>
                        {isSubmitting
                          ? 'Saving...'
                          : workshopMode === 'designer' && canonicalSelectedId
                          ? '👑 Save Changes to Master Database'
                          : editingItem
                          ? '⚡ Update My Creation'
                          : workshopMode === 'designer'
                          ? '👑 Forge to Master Database'
                          : '⚡ Forge to My Creations'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: MOD EDITOR */}
              {isGearActive && activeStudioSelection.type === 'mod' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚙️</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          {modFormId && attachedMods.some((m) => m.id === modFormId)
                            ? `Edit Mod: ${modFormName || 'Unnamed Mod'}`
                            : 'New Modular Upgrade / Mod'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Define aftermarket hardware, modifications, or specialized attachments.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[10px] font-bold">
                      Mode: Mod
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">Mod Name</span>
                      <GuardrailBadge isValid={modFormName.trim().length > 0} />
                    </div>
                    <input
                      type="text"
                      value={modFormName}
                      onChange={(e) => setModFormName(e.target.value)}
                      placeholder="e.g. Jet Thrusters, Psionic Dampener, Heavy Plating"
                      className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-cyan-500 transition shadow-inner font-semibold"
                    />
                    {exactCanonModMatch && isModFormExactMatch && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-300 min-w-0">
                          <span>⚡</span>
                          <span className="font-bold truncate">Matches Canon Mod '{exactCanonModMatch.name}'</span>
                          <span className="font-mono text-[10px] text-emerald-400/80">({exactCanonModMatch.cost || '0s'})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-900/60 border border-emerald-600/50 text-emerald-200 font-bold text-[10px] shrink-0">
                          Auto-Link Ready (Zero Duplicate Rows)
                        </span>
                      </div>
                    )}
                    {isSelfModEdit && (
                      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 text-xs">
                        <span>👑</span>
                        <span className="font-semibold">Editing Master Database Mod (ID: {modFormId})</span>
                      </div>
                    )}
                    {exactCanonModMatch && !isModFormExactMatch && !isSelfModEdit && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Cost/Specs differ from canonical '{exactCanonModMatch.name}'.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setModFormName(`${exactCanonModMatch.name} (${name.trim() || 'Custom'})`)}
                          className="px-2 py-0.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-500/60 text-amber-100 font-bold text-[10px] transition cursor-pointer shrink-0"
                        >
                          Rename '{exactCanonModMatch.name} ({name.trim() || 'Custom'})'
                        </button>
                      </div>
                    )}
                    {matchingCanonMods.length > 0 && !exactCanonModMatch && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] text-slate-400 font-bold">Existing Canon:</span>
                        {matchingCanonMods.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setModFormName(m.name);
                              const parsed = parseCostToSilver(m.cost || '0s');
                              const g = Math.floor(parsed / 10);
                              const s = parsed % 10;
                              setModFormGold(g);
                              setModFormSilver(s);
                              setModFormNotes(m.notes || '');
                            }}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[10px] font-mono transition cursor-pointer"
                          >
                            ⚡ {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Mod Cost</span>
                    <CompactCostInput
                      gold={modFormGold}
                      silver={modFormSilver}
                      onGoldChange={setModFormGold}
                      onSilverChange={setModFormSilver}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300">Hardware Notes & Specs</span>
                    <textarea
                      value={modFormNotes}
                      onChange={(e) => setModFormNotes(e.target.value)}
                      rows={3}
                      placeholder="Technical details, mounting position, installation lore..."
                      className="bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-cyan-500 transition shadow-inner font-serif italic resize-y min-h-[48px]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleSaveModForm}
                      disabled={!modFormName.trim() || isSubmitting}
                      className={`py-2 px-5 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                        modFormName.trim() && !isSubmitting
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isSubmitting
                          ? 'Saving...'
                          : workshopMode === 'designer' && canonicalSelectedId
                          ? '💾 Save Mod to Master Database'
                          : '✓ Done Editing Mod'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveStudioSelection({ type: 'chassis' })}
                      className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                      Back to Chassis
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 3: EXOTIC POWER EDITOR */}
              {isGearActive && activeStudioSelection.type === 'power' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔥</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          {powerFormId &&
                          (inherentPowers.some((p) => p.id === powerFormId) ||
                            attachedMods.some((m) => m.powers.some((p) => p.id === powerFormId)))
                            ? `Edit Power: ${powerFormName || 'Unnamed Power'}`
                            : 'New Exotic Power'}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>Target:</span>
                          <span className="font-bold text-amber-300">
                            {powerFormParentType === 'inherent'
                              ? '⚡ Inherent Ability (Direct to Chassis)'
                              : `⚙️ Mod: ${attachedMods.find((m) => m.id === powerFormParentId)?.name || 'Mod'}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-rose-300 font-mono text-[10px] font-bold">
                      Mode: Power
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">Power Name</span>
                      <GuardrailBadge isValid={powerFormName.trim().length > 0} />
                    </div>
                    <input
                      type="text"
                      value={powerFormName}
                      onChange={(e) => setPowerFormName(e.target.value)}
                      placeholder="e.g. Fireball, Tactical Leap, Void Pulse, Healing Mist"
                      className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-rose-500 transition shadow-inner font-semibold"
                    />
                    {exactCanonPowerMatch && isPowerFormExactMatch && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-300 min-w-0">
                          <span>⚡</span>
                          <span className="font-bold truncate">Matches Canon Power '{exactCanonPowerMatch.name}'</span>
                          <span className="font-mono text-[10px] text-emerald-400/80">({exactCanonPowerMatch.action} | {exactCanonPowerMatch.usage})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-900/60 border border-emerald-600/50 text-emerald-200 font-bold text-[10px] shrink-0">
                          Auto-Link Ready (Zero Duplicate Rows)
                        </span>
                      </div>
                    )}
                    {isSelfPowerEdit && (
                      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 text-xs">
                        <span>👑</span>
                        <span className="font-semibold">Editing Master Database Power (ID: {powerFormId})</span>
                      </div>
                    )}
                    {exactCanonPowerMatch && !isPowerFormExactMatch && !isSelfPowerEdit && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Stats differ from canonical '{exactCanonPowerMatch.name}'.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPowerFormName(`${exactCanonPowerMatch.name} (${name.trim() || 'Custom'})`)}
                          className="px-2 py-0.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-500/60 text-amber-100 font-bold text-[10px] transition cursor-pointer shrink-0"
                        >
                          Rename '{exactCanonPowerMatch.name} ({name.trim() || 'Custom'})'
                        </button>
                      </div>
                    )}
                    {matchingCanonPowers.length > 0 && !exactCanonPowerMatch && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-[10px] text-slate-400 font-bold">Existing Canon:</span>
                        {matchingCanonPowers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setPowerFormName(p.name);
                              setPowerFormAction(p.action || 'AM');
                              setPowerFormUsage(p.usage || '1-Enc');
                              setPowerFormEffect(p.effect || '');
                            }}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-300 text-[10px] font-mono transition cursor-pointer"
                          >
                            ⚡ {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-slate-300">Action</span>
                      <select
                        value={powerFormAction}
                        onChange={(e) => setPowerFormAction(e.target.value)}
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
                        value={powerFormUsage}
                        onChange={(e) => setPowerFormUsage(e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono font-bold px-3 py-2 rounded-xl outline-none cursor-pointer"
                      >
                        {USAGE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Rules Effect with Quick Chips Ribbon */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Rules Effect Text</span>
                        <GuardrailBadge isValid={powerFormEffect.trim().length > 0} />
                        <InfoTooltip text="Use strict SupaFlex notation grammar: Attributes (✨💪👁️🏃🫀👣), Range bands, and AoE presets." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">KaTeX & Math Compliant</span>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                      {/* Attributes Quick Chips */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">Attributes:</span>
                        {ATTRIBUTE_CHIPS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => insertStudioPowerTextAtCursor(icon)}
                            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                            title={`Insert ${icon}`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>

                      {/* Range Bands */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">Range:</span>
                        {RANGE_BANDS.map((rng) => (
                          <button
                            key={rng.id}
                            type="button"
                            onClick={() => insertStudioPowerTextAtCursor(rng.text)}
                            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-[10px] font-mono transition cursor-pointer"
                            title={`Insert ${rng.text}`}
                          >
                            {rng.id}
                          </button>
                        ))}
                      </div>

                      {/* AoE Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">AoE:</span>
                        {AOE_PRESETS.map((aoe) => (
                          <button
                            key={aoe.id}
                            type="button"
                            onClick={() => insertStudioPowerTextAtCursor(aoe.text)}
                            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[10px] font-mono transition cursor-pointer"
                            title={`Insert ${aoe.text}`}
                          >
                            {aoe.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      ref={studioEffectTextareaRef}
                      value={powerFormEffect}
                      onChange={(e) => setPowerFormEffect(e.target.value)}
                      rows={3}
                      placeholder="e.g. Rng Medium; AoE 2r; 2d6 Burn. Target gains Prone."
                      className="bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-rose-500 transition font-mono leading-relaxed shadow-inner"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleSavePowerForm}
                      disabled={!powerFormName.trim() || !powerFormEffect.trim() || isSubmitting}
                      className={`py-2 px-5 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                        powerFormName.trim() && powerFormEffect.trim() && !isSubmitting
                          ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isSubmitting
                          ? 'Saving...'
                          : workshopMode === 'designer' && canonicalSelectedId
                          ? '💾 Save Power to Master Database'
                          : '✓ Done Editing Power'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveStudioSelection({ type: 'chassis' })}
                      className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                    >
                      Back to Chassis
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : creationType === 'paths_abilities' ? (
            <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-900/60 p-4 overflow-hidden gap-3 text-xs">
              {/* Feedback Alert if present */}
              {feedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fadeIn shrink-0 ${
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

              {!isPathActive ? (
                /* IDLE VIEW: NO PATH CHOSEN */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">🧭</span>
                  <p className="font-bold text-slate-300 text-sm">Forge Paths Studio</p>
                  <p className="text-[11px] mt-1 text-slate-500 max-w-sm">
                    Select a Path from the left pane or click "+ New Path" to inspect, link elements, or author custom abilities.
                  </p>
                </div>
              ) : activePathSelection.type === 'path_root' || activePathSelection.type === 'path' ? (
                /* ROUTE 1: PATH METADATA EDITOR & PERSISTENCE */
                <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-y-auto pr-1">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧭</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          {selectedPathId || editingItem ? `Edit Path: ${name || 'Unnamed Path'}` : 'New Path Archetype'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Configure path archetype metadata, category form, and lore.
                        </p>
                      </div>
                    </div>
                    {canonicalSelectedId && (
                      <span className="px-2 py-0.5 rounded bg-blue-950 border border-blue-700/60 text-blue-300 font-mono text-[10px] font-bold">
                        {workshopMode === 'designer' ? '👑 Master Path' : 'Archetype'}
                      </span>
                    )}
                  </div>

                  {/* Row 1: Path Name & Collision Badge */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300 text-xs">Path Name</span>
                        <GuardrailBadge isValid={isNameValid} />
                        <InfoTooltip text="Unique archetype name for this Path (e.g. Voidstalker, Iron Sentinel)." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isUniversalPath && workshopMode !== 'designer'}
                      placeholder="e.g. Voidstalker, Iron Sentinel, Starweaver..."
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-blue-400 shadow-inner disabled:opacity-60 disabled:cursor-not-allowed"
                      required
                    />
                    {topLevelCollision.isCollision && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs">
                        <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            '{topLevelCollision.existingItemName}' already exists in {workshopMode === 'designer' ? 'Master Canon' : 'My Creations'}.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setName(getAutoVersionedName(name, currentActiveCatalog))}
                          className="px-2 py-0.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-500/60 text-amber-100 font-bold text-[10px] transition cursor-pointer shrink-0"
                        >
                          ⚡ Auto-Add (v2)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Category & Based-On Template Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                    {/* Path Category */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-300 text-xs">Category</span>
                          <GuardrailBadge isValid={isPathCategoryValid} />
                        </div>
                      </div>
                      <select
                        value={pathCategory}
                        onChange={(e) => setPathCategory(e.target.value)}
                        disabled={isUniversalPath && workshopMode !== 'designer'}
                        className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl outline-none focus:border-blue-400 font-medium disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {availablePathCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="CUSTOM_NEW">+ Custom Category...</option>
                      </select>
                      {pathCategory === 'CUSTOM_NEW' && (
                        <input
                          type="text"
                          value={pathCategoryNewText}
                          onChange={(e) => setPathCategoryNewText(e.target.value)}
                          disabled={isUniversalPath && workshopMode !== 'designer'}
                          placeholder="Type custom category name..."
                          className="bg-slate-950 text-slate-100 text-xs px-2.5 py-1 rounded-xl border border-blue-500/60 outline-none"
                        />
                      )}
                    </div>

                    {/* Based-On Path Template */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-300 text-xs">Based-On Template</span>
                          <InfoTooltip text="Clone metadata and all linked elements from an existing Path." />
                        </div>
                      </div>
                      <select
                        onChange={(e) => {
                          const p = (paths || []).find((it) => String(it.id) === e.target.value || it.name === e.target.value);
                          if (p) handleSelectBasedOnPath(p);
                          e.target.value = '';
                        }}
                        defaultValue=""
                        className="bg-slate-950 border border-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-xl outline-none focus:border-blue-400 font-medium cursor-pointer"
                      >
                        <option value="" disabled>-- Clone from Path... --</option>
                        {(paths || []).map((p) => (
                          <option key={p.id || p.name} value={p.id || p.name}>
                            🧭 {p.name} ({p.category || 'General'}{Array.isArray(p.linked_elements) ? ` • ${p.linked_elements.length}` : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Description & Lore */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300 text-xs">Description & Lore</span>
                        <GuardrailBadge isValid={pathDescription.trim().length > 0} />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <textarea
                      value={pathDescription}
                      onChange={(e) => setPathDescription(e.target.value)}
                      disabled={isUniversalPath && workshopMode !== 'designer'}
                      rows={3}
                      placeholder="Flavor text describing this path's training, role, and key abilities..."
                      className="bg-slate-950 text-slate-100 text-xs p-2.5 rounded-xl border border-slate-700 outline-none focus:border-blue-400 shadow-inner resize-y min-h-[60px] leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                </div>
              ) : activePathSelection.type === 'path_set' ? (
                /* ROUTE 2: LINKED SET INSPECTOR & REDIRECT NOTICE */
                <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-y-auto pr-1">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🗂️</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          Linked Set: {activePathSelection.setItem?.name || 'Unnamed Set'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Inspect set composition and adjust acquisition tag in this path.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono text-[10px] font-bold">
                      Linked Set
                    </span>
                  </div>

                  {/* Prominent Redirect Notice Banner (Blake's Mandate) */}
                  <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">ℹ️</span>
                      <div>
                        <h4 className="text-xs font-bold text-indigo-200">
                          To edit a Set, use the Sets tab at the top of this screen.
                        </h4>
                        <p className="text-[10px] text-indigo-300/80">
                          Sets are modular collections. You can manage the items within this set in the Sets Studio.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleSwitchTab('set');
                        const targetSet = (setsCatalog || []).find(
                          (s) =>
                            String(s.id) === String(activePathSelection.setItem?.id) ||
                            s.name === activePathSelection.setItem?.name
                        );
                        if (targetSet) {
                          handleSelectSet(targetSet);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                    >
                      <span>🗂️</span>
                      <span>Open in Sets Studio</span>
                    </button>
                  </div>

                  {/* Path Tag Assignment */}
                  <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 shrink-0">
                    <span className="text-xs font-bold text-slate-300">Set Acquisition Tag (Applies to All Set Elements)</span>
                    <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md max-w-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleLinkedTag(activePathSelection.setItem.id, 'Free')}
                        className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activePathSelection.setItem?.tag === 'Free'
                            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                        title="All items in this set are Free (0 AP)"
                      >
                        <span>🎁</span>
                        <span>All Free (0 AP)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLinkedTag(activePathSelection.setItem.id, '1 AP')}
                        className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activePathSelection.setItem?.tag === '1 AP'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                        title="All items in this set cost 1 AP each to acquire"
                      >
                        <span>🧩</span>
                        <span>All 1 AP</span>
                      </button>
                    </div>
                  </div>

                  {/* Set Items Inspection */}
                  <div className="flex-1 flex flex-col min-h-0 gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        Items in this Set ({activePathSetItems.length})
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Read-Only Preview</span>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5">
                      {activePathSetItems.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-3">No items listed in this set.</p>
                      ) : (
                        activePathSetItems.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-col gap-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">{item.name}</span>
                              <div className="flex items-center gap-1.5 text-[10px]">
                                {item.requirement && (
                                  <span className="font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    {item.requirement}
                                  </span>
                                )}
                                {item.action && (
                                  <span className="text-cyan-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    {item.action}
                                  </span>
                                )}
                                {item.usage && (
                                  <span className="text-amber-300 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                    {item.usage}
                                  </span>
                                )}
                              </div>
                            </div>
                            {item.effect && (
                              <p className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">{item.effect}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : activePathSelection.type === 'path_element' ? (
                /* ROUTE 3: ABILITY INSPECTOR & PERMISSIONED EDIT */
                <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-y-auto pr-1">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getCategoryEmoji(activePathSelection.element?.type)}</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          {activePathSelection.element?.name || 'Linked Ability'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Inspect ability mechanics, requirements, and rules text.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px] font-bold capitalize">
                      {activePathSelection.element?.type || 'Ability'}
                    </span>
                  </div>

                  {/* Path Tag Assignment */}
                  <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 shrink-0">
                    <span className="text-xs font-bold text-slate-300">Path Acquisition Tag</span>
                    <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md max-w-xs">
                      <button
                        type="button"
                        onClick={() => activePathSelection.element && handleToggleLinkedTag(activePathSelection.element.id, 'Free')}
                        className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activePathSelection.element?.tag === 'Free'
                            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>🎁</span>
                        <span>Free (0 AP)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => activePathSelection.element && handleToggleLinkedTag(activePathSelection.element.id, '1 AP')}
                        className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activePathSelection.element?.tag === '1 AP'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>🧩</span>
                        <span>1 AP</span>
                      </button>
                    </div>
                  </div>

                  {/* Full Mechanics Inspection Card */}
                  {(() => {
                    const stats = getElementSkillStats(activePathSelection.element);
                    return (
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-slate-200 text-sm">{activePathSelection.element?.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                            🔒 Canonical Record (Read-Only)
                          </span>
                        </div>

                        {/* Stats Badges Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {stats.req && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Requirement</span>
                              <span className="font-bold text-slate-300 font-mono">{stats.req}</span>
                            </div>
                          )}
                          {stats.action && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Action</span>
                              <span className="font-bold text-cyan-400">{stats.action}</span>
                            </div>
                          )}
                          {stats.usage && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Usage</span>
                              <span className="font-bold text-amber-300">{stats.usage}</span>
                            </div>
                          )}
                          {stats.damage && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Damage</span>
                              <span className="font-bold text-rose-300 font-mono">{stats.damage}</span>
                            </div>
                          )}
                          {stats.ar && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">AR Rating</span>
                              <span className="font-bold text-purple-300 font-mono">{stats.ar}</span>
                            </div>
                          )}
                          {stats.attribute && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Attribute</span>
                              <span className="font-bold text-cyan-300">{stats.attribute}</span>
                            </div>
                          )}
                          {stats.discipline && (
                            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                              <span className="text-[10px] text-slate-500 block">Discipline</span>
                              <span className="font-bold text-indigo-300">{stats.discipline}</span>
                            </div>
                          )}
                        </div>

                        {/* Rules Effect */}
                        {(activePathSelection.element?.details || activePathSelection.element?.item_data?.effect) && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rules Effect</span>
                            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {activePathSelection.element?.item_data?.effect || activePathSelection.element?.details}
                            </div>
                          </div>
                        )}

                        {activePathSelection.element?.item_data?.notes && (
                          <p className="text-[11px] text-slate-500 italic">
                            "{activePathSelection.element?.item_data?.notes}"
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : activePathSelection.type === 'path_add_set' ? (
                /* ROUTE 4: FILTERED SET PICKER */
                <div className="flex-1 flex flex-col min-h-0 gap-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🗂️</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100 capitalize">
                          Add {activePathSelection.category === 'armor_shield' ? 'Armor & Shield' : activePathSelection.category} Set to Path
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Showing {filteredSetsForPathCategory.length} of {availableSetsForPathCategory.length} sets
                        </p>
                      </div>
                    </div>

                    <div className="relative w-56">
                      <input
                        type="text"
                        value={pathAddSetSearch}
                        onChange={(e) => setPathAddSetSearch(e.target.value)}
                        placeholder="Search sets..."
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-inner"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                      {pathAddSetSearch && (
                        <button
                          type="button"
                          onClick={() => setPathAddSetSearch('')}
                          className="absolute right-2.5 top-1.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sets List */}
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                    {filteredSetsForPathCategory.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 font-mono text-xs">
                        No sets found in this category. Author one in the Sets tab!
                      </div>
                    ) : (
                      filteredSetsForPathCategory.map((set) => {
                        const linkedInfo = (linkedElements || []).find(
                          (el) =>
                            (el.type === 'set' || el.element_type === 'set') &&
                            (String(el.id) === String(set.id) || el.name === set.name)
                        );
                        const isLinked = !!linkedInfo;

                        return (
                          <div
                            key={String(set.id)}
                            className={`p-3 rounded-xl border transition flex flex-col gap-2 ${
                              isLinked
                                ? 'bg-slate-950/90 border-blue-500/60 ring-1 ring-blue-500/30'
                                : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">🗂️</span>
                                <span className="font-bold text-slate-100 text-xs">{set.name}</span>
                                {set.items_count !== undefined && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                    {set.items_count} items
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 rounded">
                                {set.category}
                              </span>
                            </div>

                            {set.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                {set.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                              <span className="text-[10px] text-slate-500">
                                {isLinked ? `Currently Linked as ${linkedInfo.tag === 'Free' ? 'All Free' : 'All 1 AP'}` : 'Not linked to Path'}
                              </span>

                              {isLinked ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLinkedElement(linkedInfo.id)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove from Path</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLinkElement(set, 'set', 'Free')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/90 border border-emerald-500/40 hover:border-emerald-400 text-emerald-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Add entire set as All Free (0 AP)"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>🎁 All Free</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLinkElement(set, 'set', '1 AP')}
                                    className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/90 border border-amber-500/40 hover:border-amber-400 text-amber-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Add entire set as All 1 AP advancement"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>🧩 All 1 AP</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 flex items-center justify-end pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setActivePathSelection({ type: 'path_root' })}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : activePathSelection.type === 'path_add_element' ? (
                /* ROUTE 5: FILTERED ABILITY PICKER & IN-PLACE AUTHOR FORM */
                <div className="flex-1 flex flex-col min-h-0 gap-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {activePathSelection.category === 'trait'
                          ? '🧬'
                          : activePathSelection.category === 'power'
                          ? '⚡'
                          : activePathSelection.category === 'skill'
                          ? '🎯'
                          : activePathSelection.category === 'weapon'
                          ? '⚔️'
                          : '🛡️'}
                      </span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100 capitalize">
                          Add {activePathSelection.category === 'armor_shield' ? 'Armor & Shield Sk' : activePathSelection.category} to Path
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Showing {filteredElementsForPathCategory.length} of {availableElementsForPathCategory.length} abilities
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative w-48 sm:w-56">
                        <input
                          type="text"
                          value={pathAddElementSearch}
                          onChange={(e) => setPathAddElementSearch(e.target.value)}
                          placeholder="Search abilities..."
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-inner"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                        {pathAddElementSearch && (
                          <button
                            type="button"
                            onClick={() => setPathAddElementSearch('')}
                            className="absolute right-2.5 top-1.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {(activePathSelection.category === 'trait' ||
                        activePathSelection.category === 'power' ||
                        activePathSelection.category === 'skill') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAuthoringPathCustomAbility) {
                              setCustomAbilityType(activePathSelection.category as any);
                            }
                            setIsAuthoringPathCustomAbility(!isAuthoringPathCustomAbility);
                          }}
                          className={`py-1 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                            isAuthoringPathCustomAbility
                              ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300 hover:text-amber-200'
                          }`}
                        >
                          {isAuthoringPathCustomAbility ? (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>Close</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 text-amber-400" />
                              <span>✍️ Author</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* In-Place Custom Ability Drawer */}
                  {isAuthoringPathCustomAbility ? (
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">✍️</span>
                          <h4 className="font-outfit font-extrabold text-xs text-amber-300 capitalize">
                            Author Custom {customAbilityType} & Link to Path
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Target Path: <strong className="text-slate-200">{name.trim() || 'Active Path'}</strong>
                        </span>
                      </div>

                      {/* Tag Switch: Free vs 1 AP */}
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300 text-[11px]">Path Link Tag</span>
                        <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md max-w-xs">
                          <button
                            type="button"
                            onClick={() => setCustomAbilityTag('Free')}
                            className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              customAbilityTag === 'Free'
                                ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                          >
                            <span>🎁</span>
                            <span>Free</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomAbilityTag('1 AP')}
                            className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              customAbilityTag === '1 AP'
                                ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                            }`}
                          >
                            <span>🧩</span>
                            <span>1 AP</span>
                          </button>
                        </div>
                      </div>

                      {/* Ability Name */}
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300 text-[11px]">Ability Name</span>
                        <input
                          type="text"
                          value={customAbilityName}
                          onChange={(e) => setCustomAbilityName(e.target.value)}
                          placeholder="e.g. Shadow Step, Iron Fortitude, Arcane Sight..."
                          className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Power Controls */}
                      {customAbilityType === 'power' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-300 text-[11px]">Action</span>
                            <select
                              value={customAbilityAction}
                              onChange={(e) => setCustomAbilityAction(e.target.value)}
                              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-amber-400"
                            >
                              {ACTION_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-300 text-[11px]">Usage</span>
                            <select
                              value={customAbilityUsage}
                              onChange={(e) => setCustomAbilityUsage(e.target.value)}
                              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-amber-400"
                            >
                              {USAGE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Skill Controls */}
                      {customAbilityType === 'skill' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-300 text-[11px]">Attribute</span>
                            <div className="flex items-center gap-1.5">
                              {ATTRIBUTE_CHIPS.map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => setCustomAbilityAttribute(chip)}
                                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                                    customAbilityAttribute === chip
                                      ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400 font-bold'
                                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {chip}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-300 text-[11px]">Discipline</span>
                            <input
                              type="text"
                              value={customAbilityDiscipline}
                              onChange={(e) => setCustomAbilityDiscipline(e.target.value)}
                              placeholder="Discipline (e.g. Combat, Lore, General)..."
                              className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      )}

                      {/* Effect */}
                      {(customAbilityType === 'power' || customAbilityType === 'trait') && (
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-300 text-[11px]">Rules Effect</span>
                          <textarea
                            rows={3}
                            value={customAbilityEffect}
                            onChange={(e) => setCustomAbilityEffect(e.target.value)}
                            placeholder="Rules effect text..."
                            className="bg-slate-950 text-slate-100 text-xs p-2 rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-mono leading-relaxed"
                          />
                        </div>
                      )}

                      {/* Notes */}
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-slate-300 text-[11px]">Notes (Optional)</span>
                        <input
                          type="text"
                          value={customAbilityNotes}
                          onChange={(e) => setCustomAbilityNotes(e.target.value)}
                          placeholder="Optional notes or lore..."
                          className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-amber-400 font-serif italic"
                        />
                      </div>

                      {/* Drawer Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsAuthoringPathCustomAbility(false)}
                          className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveAndLinkCustomAbility}
                          disabled={!customAbilityName.trim() || isSubmitting}
                          className={`py-1.5 px-4 rounded-lg font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                            customAbilityName.trim() && !isSubmitting
                              ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white cursor-pointer'
                              : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSubmitting ? 'Saving...' : '💾 Save & Link to Path'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Catalog List */
                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-0">
                      {filteredElementsForPathCategory.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 font-mono text-xs">
                          No items match your search.
                        </div>
                      ) : (
                        filteredElementsForPathCategory.map((item: any) => {
                          const linkedInfo = (linkedElements || []).find(
                            (el) =>
                              (el.name || '').toLowerCase().trim() === (item.name || '').toLowerCase().trim() &&
                              el.type !== 'set' &&
                              el.element_type !== 'set'
                          );
                          const isLinked = !!linkedInfo;
                          const stats = {
                            req: item.requirement,
                            action: item.action,
                            usage: item.usage,
                            damage: item.damage,
                            ar: item.ar,
                            attribute: item.attribute,
                            discipline: item.discipline,
                          };

                          return (
                            <div
                              key={String(item.id || item.name)}
                              className={`p-3 rounded-xl border transition flex flex-col gap-1.5 ${
                                isLinked
                                  ? 'bg-slate-950/90 border-blue-500/60 ring-1 ring-blue-500/30'
                                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-slate-100 text-xs truncate">
                                    {item.name}
                                  </span>
                                  {stats.req && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300 font-bold shrink-0">
                                      {stats.req}
                                    </span>
                                  )}
                                  {stats.action && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-cyan-400 font-bold shrink-0">
                                      {stats.action}
                                    </span>
                                  )}
                                  {stats.usage && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-amber-300 font-bold shrink-0">
                                      {stats.usage}
                                    </span>
                                  )}
                                  {stats.damage && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-rose-300 font-bold shrink-0">
                                      {stats.damage}
                                    </span>
                                  )}
                                  {stats.ar && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-purple-300 font-bold shrink-0">
                                      AR {stats.ar}
                                    </span>
                                  )}
                                  {stats.attribute && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-cyan-300 font-bold shrink-0">
                                      {stats.attribute}
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] font-mono text-slate-500 capitalize shrink-0">
                                  {item._catalogType}
                                </span>
                              </div>

                              {item.effect && (
                                <p className="text-[11px] text-slate-400 font-mono line-clamp-2 leading-relaxed">
                                  {item.effect}
                                </p>
                              )}

                              {item.description && !item.effect && (
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                  {item.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                                <span className="text-[10px] text-slate-500">
                                  {isLinked ? `Currently Linked as ${linkedInfo.tag}` : 'Not linked to Path'}
                                </span>

                                {isLinked ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLinkedElement(linkedInfo.id)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove from Path</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleLinkElement(item, item._catalogType, 'Free')}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/90 border border-emerald-500/40 hover:border-emerald-400 text-emerald-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>🎁 Free</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleLinkElement(item, item._catalogType, '1 AP')}
                                      className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/90 border border-amber-500/40 hover:border-amber-400 text-amber-200 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>🧩 1 AP</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="shrink-0 flex items-center justify-end pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setActivePathSelection({ type: 'path_root' })}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}

            </div>
          ) : creationType === 'set' ? (
            <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-900/60 p-4 overflow-hidden gap-3 text-xs">
              {/* Feedback Alert if present */}
              {feedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold animate-fadeIn shrink-0 ${
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

              {!isSetActive ? null : (
                <>
                  {/* ROUTE 1: SET ROOT METADATA EDITOR */}
                  {activeSetSelection.type === 'set_root' && (
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
                        {/* Row 1: Name & Collision Badge */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-sm shrink-0">🗂️</span>
                              <span className="font-bold text-slate-300 text-xs whitespace-nowrap">Set Name</span>
                              <GuardrailBadge isValid={isNameValid} />
                              <InfoTooltip text="Unique name for this set collection." />
                            </div>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Masterwork Blades, Dragon Knight Armory, Elemental Evocations..."
                                className={`w-full bg-slate-950 border rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition shadow-inner font-semibold ${
                                  topLevelCollision.isCollision
                                    ? 'border-rose-500/80 focus:border-rose-400'
                                    : 'border-slate-700/80 focus:border-indigo-500'
                                }`}
                              />
                            </div>
                            {selectedSetId && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-700/60 text-amber-300 font-mono text-[10px] font-bold whitespace-nowrap">
                                  {workshopMode === 'designer' ? '👑 Canon Set' : 'Custom Set'}
                                </span>
                              </div>
                            )}
                          </div>
                          {topLevelCollision.isCollision && (
                            <p className="text-[10px] text-rose-400 font-medium pl-24">
                              ⚠️ A {topLevelCollision.isCanonMatch ? 'canonical' : 'custom'} entry named "{topLevelCollision.existingItemName}" already exists.
                            </p>
                          )}
                        </div>

                        {/* Row 2: Category Multi-Option Pill Switch */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 w-24 shrink-0">
                            <span className="font-bold text-slate-300 text-xs whitespace-nowrap">Category</span>
                            <InfoTooltip text="Homogeneous domain for all elements in this set." />
                          </div>
                          <div className="flex-1 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md overflow-x-auto">
                            {SET_CATEGORIES.map((cat) => {
                              const isCatActive = selectedSetCategory === cat.id;
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => handleSwitchSetCategory(cat.id)}
                                  className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${
                                    isCatActive
                                      ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
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

                        {/* Row 3: Genres Multi-Option Pill Switch (Directly Below Category) */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 w-24 shrink-0">
                            <span className="font-bold text-slate-300 text-xs whitespace-nowrap">Genres</span>
                            <InfoTooltip text="Compatible campaign genres for this set." />
                          </div>
                          <div className="flex-1 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
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

                  {/* Row 4: Description & Lore (Directly Below Genres) */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-xs">Description & Lore</span>
                      <span className="text-[10px] text-slate-500 font-mono">Theme & Tactical Lore</span>
                    </div>
                    <textarea
                      value={setDescription}
                      onChange={(e) => setSetDescription(e.target.value)}
                      rows={2}
                      placeholder="Theme, history, or tactical doctrine for this set..."
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition shadow-inner font-mono leading-relaxed"
                    />
                  </div>

                  {/* Row 5: Based On - Clone from Existing Set (Above Save Button) */}
                  <div className="flex flex-col gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-300">Based On (Clone From Existing Set)</span>
                        <InfoTooltip text="Select an existing set to inspect its members. Click ⬅️ to move individual items or ⬅️ All to move all items into your set." />
                      </div>
                      {selectedBaseSetName && baseSetMembers.length > 0 && (
                        <span className="px-2 py-0.2 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-bold">
                          {baseSetMembers.length} {baseSetMembers.length === 1 ? 'member' : 'members'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedBaseSetName}
                          onChange={(e) => handleSelectBaseSet(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 appearance-none focus:outline-none focus:border-indigo-500 transition cursor-pointer pr-8 font-medium"
                        >
                          <option value="">-- Choose a {selectedSetCategory} set to inspect/pull from... --</option>
                          {availableBasedOnSets.map((bs) => (
                            <option key={bs.id || bs.name} value={bs.name}>
                              {bs.name} ({bs.category}{bs.items_count !== undefined ? ` • ${bs.items_count} items` : ''})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddAllBaseSetMembers}
                        disabled={!selectedBaseSetName || baseSetMembers.length === 0 || isLoadingBaseMembers}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                          selectedBaseSetName && baseSetMembers.length > 0 && !isLoadingBaseMembers
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm font-extrabold cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                        }`}
                        title="Move all members from this set into your draft set"
                      >
                        <span>⬅️ All</span>
                      </button>
                    </div>

                    {/* Member Elements List */}
                    {isLoadingBaseMembers ? (
                      <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Loading set members...</span>
                      </div>
                    ) : selectedBaseSetName && baseSetMembers.length === 0 ? (
                      <div className="p-2.5 text-center text-xs text-slate-500 bg-slate-900/40 rounded-lg border border-slate-800/80">
                        No members found in set '{selectedBaseSetName}'.
                      </div>
                    ) : selectedBaseSetName && baseSetMembers.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1 mt-1">
                        {baseSetMembers.map((m, idx) => {
                          const isAlreadyInDraft = draftSetItems.some((d) => String(d.id) === String(m.id));
                          return (
                            <div
                              key={`${m.id}_${idx}`}
                              className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  disabled={isAlreadyInDraft}
                                  onClick={() => handleAddMemberToDraft(m)}
                                  className={`p-1 px-1.5 rounded text-xs font-bold transition flex items-center justify-center shrink-0 ${
                                    isAlreadyInDraft
                                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                                      : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-sm active:scale-95'
                                  }`}
                                  title={isAlreadyInDraft ? 'Already in Set' : 'Move to Set'}
                                >
                                  <span>⬅️</span>
                                </button>
                                <span className="font-bold text-slate-200 truncate">
                                  {m.name}
                                </span>
                                {m.requirement && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 shrink-0">
                                    {m.requirement}
                                  </span>
                                )}
                                {m.action && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-cyan-400 shrink-0">
                                    {m.action}
                                  </span>
                                )}
                                {m.usage && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-amber-300 shrink-0">
                                    {m.usage}
                                  </span>
                                )}
                                {m.effect && (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[160px] font-mono">
                                    {m.effect}
                                  </span>
                                )}
                              </div>
                              <div className="shrink-0">
                                {isAlreadyInDraft ? (
                                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                    ✓ In Set
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {m.table || selectedSetCategory}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>

                  {/* Anti-Duplicate-Clone Alert Banner */}
                  {isDuplicateClone && (
                    <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs flex items-center gap-2 animate-fadeIn shrink-0">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="leading-snug text-[11px]">
                        <strong>Duplicate Set Detected:</strong> An identical set already exists with these exact items. Please add, remove, or modify items before forging this set.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ROUTE 2: SET MEMBER INSPECTOR / EDITOR */}
              {activeSetSelection.type === 'set_member' && activeSetSelection.item && (
                <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {activeSetSelection.item.element_type === 'weapon' || activeSetSelection.item.table === 'weapons'
                          ? '⚔️'
                          : activeSetSelection.item.element_type === 'armor' || activeSetSelection.item.table === 'armor' || activeSetSelection.item.element_type === 'shield' || activeSetSelection.item.table === 'shields'
                          ? '🛡️'
                          : activeSetSelection.item.element_type === 'power' || activeSetSelection.item.table === 'powers'
                          ? '⚡'
                          : activeSetSelection.item.element_type === 'skill' || activeSetSelection.item.table === 'skills'
                          ? '🎯'
                          : '🧬'}
                      </span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          {activeSetSelection.item.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Member of <strong className="text-indigo-300">{name || 'Current Set'}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSetSelection({ type: 'set_root' })}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                    >
                      ← Back to Set Details
                    </button>
                  </div>

                  {/* Read-Only / Universal Mechanical Card */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                        {activeSetSelection.item.table || selectedSetCategory} Element
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        🔒 Canonical Record (Read-Only)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {activeSetSelection.item.requirement && (
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Requirement</span>
                          <span className="font-bold text-slate-200">{activeSetSelection.item.requirement}</span>
                        </div>
                      )}
                      {activeSetSelection.item.action && (
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Action</span>
                          <span className="font-bold text-cyan-400">{activeSetSelection.item.action}</span>
                        </div>
                      )}
                      {activeSetSelection.item.usage && (
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Usage</span>
                          <span className="font-bold text-amber-300">{activeSetSelection.item.usage}</span>
                        </div>
                      )}
                      {activeSetSelection.item.discipline && (
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Discipline</span>
                          <span className="font-bold text-purple-300">{activeSetSelection.item.discipline}</span>
                        </div>
                      )}
                    </div>

                    {activeSetSelection.item.effect && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Effect</span>
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {activeSetSelection.item.effect}
                        </div>
                      </div>
                    )}

                    {activeSetSelection.item.notes && (
                      <p className="text-[11px] text-slate-500 italic">
                        "{activeSetSelection.item.notes}"
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-auto pt-3 border-t border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        handleRemoveItemFromDraft(String(activeSetSelection.item?.id));
                        setActiveSetSelection({ type: 'set_root' });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove from Set</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSetSelection({ type: 'set_root' })}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      Done Inspecting
                    </button>
                  </div>
                </div>
              )}

              {/* ROUTE 3: CATEGORY CATALOG BROWSER (ADD TO SET) */}
              {activeSetSelection.type === 'set_add_member' && (
                <div className="flex-1 flex flex-col min-h-0 gap-3">
                  {/* Header: Category Title, Counter, and Search */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {selectedSetCategory === 'Weapons'
                          ? '⚔️'
                          : selectedSetCategory === 'Armor & Shields'
                          ? '🛡️'
                          : selectedSetCategory === 'Powers'
                          ? '⚡'
                          : selectedSetCategory === 'Skills'
                          ? '🎯'
                          : '🧬'}
                      </span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          Add {selectedSetCategory} to Set
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          Showing {filteredCategoryCatalog.length} of {categoryCatalogItems.length} items
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Search Input */}
                      <div className="relative w-56">
                        <input
                          type="text"
                          value={setsRightCatalogSearchQuery}
                          onChange={(e) => setSetsRightCatalogSearchQuery(e.target.value)}
                          placeholder={`Search ${selectedSetCategory.toLowerCase()}...`}
                          className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                        {setsRightCatalogSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSetsRightCatalogSearchQuery('')}
                            className="absolute right-2 top-1.5 text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveSetSelection({ type: 'set_root' })}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        Back
                      </button>
                    </div>
                  </div>

                  {/* Catalog Grid */}
                  <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2.5 pr-1">
                    {filteredCategoryCatalog.length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-slate-500 text-xs">
                        <span className="text-2xl mb-2">🔍</span>
                        <p className="font-bold text-slate-400">No matching items found</p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          Try adjusting your search filter or switch set category.
                        </p>
                      </div>
                    ) : (
                      filteredCategoryCatalog.map((item) => {
                        const inDraft = draftSetItemIdSet.has(String(item.id));
                        const member = convertCatalogItemToSetMember(item, selectedSetCategory);
                        return (
                          <div
                            key={String(item.id)}
                            className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition ${
                              inDraft
                                ? 'bg-slate-950/90 border-indigo-500/50 shadow-sm shadow-indigo-950/30'
                                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-bold text-slate-100 text-xs truncate">
                                  {item.name}
                                </span>
                                {item.owner === 'Designer' && (
                                  <span className="text-[9px] text-amber-400 font-mono px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/30 shrink-0">
                                    👑 Canon
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                {item.requirement && (
                                  <span className="font-mono text-slate-500">{item.requirement}</span>
                                )}
                                {item.action && (
                                  <span className="text-cyan-400 font-bold">{item.action}</span>
                                )}
                                {item.usage && (
                                  <span className="text-amber-300 font-bold">{item.usage}</span>
                                )}
                              </div>

                              {item.effect && (
                                <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-mono">
                                  {item.effect}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                              <span className="text-[9px] font-mono text-slate-500">
                                {member.table}
                              </span>
                              {inDraft ? (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromDraft(String(item.id))}
                                  className="px-2 py-0.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>In Set (Remove)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAddItemToDraft(item)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add to Set</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
          ) : (
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

            {/* IDLE VIEW: NO CHAOS GEM CHOSEN */}
            {creationType === 'chaos_gem' && !isChaosGemActive ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                <span className="text-3xl mb-2">💎</span>
                <p className="font-bold text-slate-300 text-sm">Forge Chaos Gems Studio</p>
                <p className="text-[11px] mt-1 text-slate-500 max-w-sm">
                  Select a Chaos Gem from the left pane or click "+ New Chaos Gem" to inspect and edit its socket properties.
                </p>
              </div>
            ) : (
              <>
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
              {topLevelCollision.isCollision && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300 min-w-0">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      '{topLevelCollision.existingItemName}' already exists in {workshopMode === 'designer' ? 'Master Canon' : 'My Creations'}.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setName(getAutoVersionedName(name, currentActiveCatalog))}
                    className="px-2 py-0.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-500/60 text-amber-100 font-bold text-[10px] transition cursor-pointer shrink-0"
                  >
                    ⚡ Auto-Add (v2)
                  </button>
                </div>
              )}
              {topLevelCollision.isCanonMatch && !topLevelCollision.isCollision && workshopMode === 'player' && (
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-300 text-xs">
                  <span>ℹ️</span>
                  <span className="truncate">
                    Matches Canon '{topLevelCollision.existingItemName}'. Your version will be forged as a personal custom creation.
                  </span>
                </div>
              )}
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
                    className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 resize-y min-h-[60px]"
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


            {/* RULES EFFECT TEXTAREA WITH QUICK-INSERT CHIPS */}
            {(creationType === 'power' ||
              creationType === 'trait' ||
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
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Forged in the ancient deeps of Shanask Loom..."
                className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 font-serif italic resize-y min-h-[48px]"
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

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-3 mt-auto">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                  isFormValid && !isSubmitting
                    ? 'bg-gradient-to-r from-violet-600 via-violet-500 to-violet-600 hover:from-violet-500 hover:to-violet-400 text-white shadow-violet-950/50 font-extrabold active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                }`}
              >
                {editingItem || canonicalSelectedId ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Forging...'
                        : workshopMode === 'designer'
                        ? 'Forge to Master Database 👑'
                        : isGm
                        ? 'Forge to My Creations 👑'
                        : 'Forge to My Creations'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetForm}
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Clear
              </button>

            </div>
            </>
            )}
          </form>
          )}
        </div>

        {/* Canonical Deletion Confirmation Dialog */}
        {deleteConfirmTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl shadow-rose-950/50 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xl">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-outfit font-extrabold text-sm text-slate-100">
                    Delete Canonical Master Record?
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    This action will permanently delete this item from the production Supabase database.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col gap-1">
                <div className="text-slate-400">
                  Entity Type: <strong className="text-amber-300 uppercase">{deleteConfirmTarget.type}</strong>
                </div>
                <div className="text-slate-400">
                  Name: <strong className="text-slate-200">{deleteConfirmTarget.name}</strong>
                </div>
                <div className="text-slate-400">
                  ID: <strong className="text-slate-300 font-mono">{String(deleteConfirmTarget.id)}</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  disabled={isDeletingCanonical}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCanonical}
                  disabled={isDeletingCanonical}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-rose-950/50 flex items-center gap-1.5"
                >
                  {isDeletingCanonical ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

                {/* Safe Unlink Modal: Permanent Delete (Last Path) Warning */}
        {unlinkWarningTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-slate-900 border border-amber-500/80 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-2xl">
                  ⚠️
                </div>
                <div>
                  <h3 className="font-outfit font-extrabold text-base text-amber-300">
                    Permanent Delete (Last Path)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    This element only belongs to Path '{unlinkWarningTarget.currentPath}'.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-col gap-2">
                <div className="text-slate-300">
                  <span className="text-slate-500">Item: </span>
                  <strong className="text-amber-300">{unlinkWarningTarget.item.name}</strong>
                  <span className="text-slate-500 font-mono text-[10px] ml-1.5 uppercase">({unlinkWarningTarget.type})</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Unlinking will remove its last path assignment. You can either move it to the <strong>Universal Path</strong> so it remains available across the game, or permanently delete it from the master database.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800 flex-wrap">
                <button
                  type="button"
                  onClick={() => setUnlinkWarningTarget(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    executeUnlinkPathElement(
                      unlinkWarningTarget.type,
                      unlinkWarningTarget.item,
                      unlinkWarningTarget.currentPath,
                      true
                    )
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-950/50 flex items-center gap-1.5"
                  title="Move this element to the Universal Path"
                >
                  <span>🌐</span>
                  <span>Move to Universal Path</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    executeHardDeletePathElement(unlinkWarningTarget.type, unlinkWarningTarget.item)
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-rose-950/50 flex items-center gap-1.5"
                  title="Permanently delete from database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Permanent Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Universal Modal Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800/80 shrink-0 flex items-center justify-end gap-3">
          {creationType === 'set' && isSetActive && (
            <button
              type="button"
              onClick={handleSaveSet}
              disabled={!isNameValid || isDuplicateClone || isSavingSet}
              className={`py-2 px-6 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-2 select-none shadow-md ${
                isNameValid && !isDuplicateClone && !isSavingSet
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-950/50 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              {isSavingSet ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Set...</span>
                </>
              ) : selectedSetId && !isCreatingNewSet ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{workshopMode === 'designer' ? '👑 Update Master Set' : 'Update Set'}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{workshopMode === 'designer' ? '👑 Forge Master Set' : 'Forge Set to My Creations'}</span>
                </>
              )}
            </button>
          )}

          {/* Conditional Save Path button */}
          {creationType === 'paths_abilities' && isPathActive && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isPathReadyForAbilities || isSubmitting || (isUniversalPath && workshopMode !== 'designer')}
              className={`py-2 px-6 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-2 select-none shadow-md ${
                isPathReadyForAbilities && !isSubmitting && (!isUniversalPath || workshopMode === 'designer')
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 hover:from-blue-500 hover:to-indigo-400 text-white shadow-blue-950/50 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Forging Path...</span>
                </>
              ) : (
                <>
                  <AnvilIcon className="w-4 h-4" />
                  <span>Forge Path</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
            title="Close Forge"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
