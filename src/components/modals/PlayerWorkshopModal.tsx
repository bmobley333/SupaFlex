// src/components/modals/PlayerWorkshopModal.tsx
// Unified Player's Forge: Master Modal Blueprint 2-Pane Architecture (Live Preview + Forge Controls)

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Plus, Check, AlertCircle, Pencil, Trash2, RefreshCw, Search, ChevronDown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationType, CustomCreationItem, CustomCreationData, PathElementType, PathLinkedElement, StudioPower, StudioMod, SupabaseChaosGem } from '../../types/game';
import { InfoTooltip } from '../common/InfoTooltip';
import { compareMsoOptions } from '../../utils/kitUtils';
import { parseCostToSilver } from '../../utils/moneyUtils';
import { isBelongsToMatch } from '../../utils/gearFunctionSync';

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

export const getCategoryEmoji = (type?: string): string => {
  switch (type) {
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
  const [powerReady, setPowerReady] = useState<string>('primary_arsenal');
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
  const [pathStudioTab, setPathStudioTab] = useState<'current' | 'canon' | 'mine'>('current');
  const [pathDatabaseCategory, setPathDatabaseCategory] = useState<'path' | 'power' | 'trait' | 'skill'>('path');
  const [pathLibraryFilter, setPathLibraryFilter] = useState<'all' | 'path' | 'power' | 'skill' | 'skillset' | 'trait'>('all');
  const [isCreatingNewPath, setIsCreatingNewPath] = useState<boolean>(false);
  const [selectedPathId, setSelectedPathId] = useState<string>('');
  const [activePathSelection, setActivePathSelection] = useState<{
    type: 'path' | 'ability';
    category?: PathElementType;
    id?: string;
    name?: string;
    source?: 'new' | 'existing';
  }>({ type: 'path' });
  const [activeAbilityCategory, setActiveAbilityCategory] = useState<PathElementType>('power');
  const [abilitySourceMode, setAbilitySourceMode] = useState<'forge_new' | 'pick_existing'>('forge_new');
  const [abilityCatalogSearch, setAbilityCatalogSearch] = useState<string>('');

  // Standalone/Inline Ability Form States
  const [abilityFormName, setAbilityFormName] = useState<string>('');
  const [abilityFormAction, setAbilityFormAction] = useState<string>('AM');
  const [abilityFormUsage, setAbilityFormUsage] = useState<string>('1-Enc');
  const [abilityFormPowerReady, setAbilityFormPowerReady] = useState<string>('primary_arsenal');
  const [abilityFormEffect, setAbilityFormEffect] = useState<string>('');
  const [abilityFormSkillAttribute, setAbilityFormSkillAttribute] = useState<string>('💪');
  const [abilityFormSkillDiscipline, setAbilityFormSkillDiscipline] = useState<string>('General');
  const [abilityFormSkillDisciplineNewText, setAbilityFormSkillDisciplineNewText] = useState<string>('');
  const [abilityFormSkillsetSkills, setAbilityFormSkillsetSkills] = useState<string[]>(['', '']);
  const [abilityFormNotes, setAbilityFormNotes] = useState<string>('');
  const [abilityFormGenres, setAbilityFormGenres] = useState<string[]>([]);
  const abilityEffectTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Authoritative Guardrail: Non-Designer accounts can NEVER enter standalone/Universal ability mode
  useEffect(() => {
    if (!isMetaScapeDesigner && pathStudioMode === 'standalone') {
      setPathStudioMode('path');
    }
  }, [isMetaScapeDesigner, pathStudioMode]);

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
  const [studioTab, setStudioTab] = useState<'current' | 'canon' | 'mine'>('current');
  const [gearDatabaseChassis, setGearDatabaseChassis] = useState<'weapon' | 'armor' | 'shield' | 'supplies'>('weapon');
  const [gemStudioTab, setGemStudioTab] = useState<'current' | 'canon' | 'mine'>('current');

  // Authoritative Guardrail: Non-Designer accounts can NEVER access the Canon tab
  useEffect(() => {
    if (!isMetaScapeDesigner) {
      if (studioTab === 'canon') setStudioTab('current');
      if (pathStudioTab === 'canon') setPathStudioTab('current');
      if (gemStudioTab === 'canon') setGemStudioTab('current');
    }
  }, [isMetaScapeDesigner, studioTab, pathStudioTab, gemStudioTab]);
  const [canonicalChaosGems, setCanonicalChaosGems] = useState<SupabaseChaosGem[]>([]);
  const [canonicalSearchQuery, setCanonicalSearchQuery] = useState<string>('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: string;
    id: string | number;
    name: string;
  } | null>(null);
  const [isDeletingCanonical, setIsDeletingCanonical] = useState<boolean>(false);
  const [costMode, setCostMode] = useState<'standard' | 'artifact'>('standard');
  const [studioLibraryChassisFilter, setStudioLibraryChassisFilter] = useState<'all' | 'weapon' | 'armor' | 'shield' | 'supplies'>('all');
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
  const [isTreeExpanded, setIsTreeExpanded] = useState<boolean>(true);
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

  const matchingCanonMods = useMemo(() => {
    const clean = modFormName.trim().toLowerCase();
    if (!clean || clean.length < 2) return [];
    return (modsCatalog || [])
      .filter((m) => (m.name || '').trim().toLowerCase().includes(clean))
      .slice(0, 4);
  }, [modsCatalog, modFormName]);

  const handleStartAddInherentPower = () => {
    if (!isChassisComplete) return;
    setPowerFormId(Date.now().toString());
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

  const handleDeleteInherentPower = (pwrId: string) => {
    setInherentPowers((prev) => prev.filter((p) => p.id !== pwrId));
    if (!pwrId.startsWith('pwr_') && !pwrId.startsWith('fn_') && !isNaN(Number(pwrId))) {
      setDeletedPowerIds((prev) => [...prev, Number(pwrId)]);
    }
    if (activeStudioSelection.type === 'power' && activeStudioSelection.id === pwrId) {
      setActiveStudioSelection({ type: 'chassis' });
    }
  };

  const handleStartAddMod = () => {
    if (!isChassisComplete) return;
    setModFormId(Date.now().toString());
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

  const handleDeleteMod = (modId: string) => {
    const modToDelete = attachedMods.find((m) => m.id === modId);
    if (modToDelete) {
      modToDelete.powers.forEach((p) => {
        if (!p.id.startsWith('pwr_') && !p.id.startsWith('fn_') && !isNaN(Number(p.id))) {
          setDeletedPowerIds((prev) => [...prev, Number(p.id)]);
        }
      });
    }
    if (!modId.startsWith('mod_') && !isNaN(Number(modId))) {
      setDeletedModIds((prev) => [...prev, Number(modId)]);
    }
    setAttachedMods((prev) => prev.filter((m) => m.id !== modId));
    if (
      (activeStudioSelection.type === 'mod' && activeStudioSelection.id === modId) ||
      (activeStudioSelection.type === 'power' && activeStudioSelection.parentId === modId)
    ) {
      setActiveStudioSelection({ type: 'chassis' });
    }
  };

  const handleStartAddPowerToMod = (mod: StudioMod) => {
    if (!isChassisComplete) return;
    setPowerFormId(Date.now().toString());
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
    if (!pwrId.startsWith('pwr_') && !pwrId.startsWith('fn_') && !isNaN(Number(pwrId))) {
      setDeletedPowerIds((prev) => [...prev, Number(pwrId)]);
    }
    setAttachedMods((prev) =>
      prev.map((m) => (m.id === modId ? { ...m, powers: m.powers.filter((p) => p.id !== pwrId) } : m))
    );
    if (activeStudioSelection.type === 'power' && activeStudioSelection.id === pwrId) {
      setActiveStudioSelection({ type: 'chassis' });
    }
  };

  const handleSaveModForm = () => {
    if (!modFormName.trim()) return;
    const resolvedId =
      exactCanonModMatch && isModFormExactMatch && exactCanonModMatch.id
        ? String(exactCanonModMatch.id)
        : modFormId || Date.now().toString();

    setAttachedMods((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === modFormId);
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

  const handleSavePowerForm = () => {
    if (!powerFormName.trim() || !powerFormEffect.trim()) return;
    const resolvedId =
      exactCanonPowerMatch && isPowerFormExactMatch && exactCanonPowerMatch.id
        ? String(exactCanonPowerMatch.id)
        : powerFormId || Date.now().toString();

    const pwrObj: StudioPower = {
      id: resolvedId,
      name: powerFormName.trim(),
      action: powerFormAction,
      usage: powerFormUsage,
      effect: powerFormEffect.trim(),
    };

    if (powerFormParentType === 'inherent') {
      setInherentPowers((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === powerFormId);
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
          const existingIdx = m.powers.findIndex((p) => p.id === powerFormId);
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
    setStudioChassisType('supplies');
    setCostMode('standard');
    setStudioLibraryChassisFilter('all');
    setInherentPowers([]);
    setAttachedMods([]);
    setActiveStudioSelection({ type: 'chassis' });
    if (studioTab !== 'canon' && studioTab !== 'mine') {
      setStudioTab('current');
    }
    if (pathStudioTab !== 'canon' && pathStudioTab !== 'mine') {
      setPathStudioMode('path');
      setPathStudioTab('current');
    }
    if (gemStudioTab !== 'canon' && gemStudioTab !== 'mine') {
      setGemStudioTab('current');
    }
    setPathLibraryFilter('all');
    setIsCreatingNewPath(false);
    setSelectedPathId('');
    setActivePathSelection({ type: 'path' });
    setActiveAbilityCategory('power');
    setAbilitySourceMode('forge_new');
    setAbilityCatalogSearch('');
    setAbilityFormName('');
    setAbilityFormAction('AM');
    setAbilityFormUsage('1-Enc');
    setAbilityFormPowerReady('primary_arsenal');
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
        setPathStudioTab('current');
        if (item.type === 'path') {
          setPathStudioMode('path');
          setActivePathSelection({ type: 'path' });
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
      setPowerReady(item.item_data?.ready_category || 'primary_arsenal');
      setAbilityFormName(item.name || '');
      setAbilityFormAction(item.item_data?.action || 'AM');
      setAbilityFormUsage(item.item_data?.usage || '1-Enc');
      setAbilityFormEffect(item.item_data?.effect || '');
      setAbilityFormPowerReady(item.item_data?.ready_category || 'primary_arsenal');
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
      setStudioTab('current');
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
    return list;
  }, [weaponsCatalog, armorCatalog, shieldsCatalog, suppliesCatalog]);

  const myGearItems = useMemo(() => {
    return allGearItems.filter((it) => getItemScope(it.owner) === 'mine');
  }, [allGearItems, cleanEmail]);

  const myGearCount = myGearItems.length;

  const filteredMyGearItems = useMemo(() => {
    let items = myGearItems;
    if (studioLibraryChassisFilter !== 'all') {
      items = items.filter((it) => it.chassis === studioLibraryChassisFilter);
    }
    const q = canonicalSearchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter((it) => it.name.toLowerCase().includes(q) || (it.notes && it.notes.toLowerCase().includes(q)));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [myGearItems, studioLibraryChassisFilter, canonicalSearchQuery]);

  // Normalized Paths & Abilities for UI List Rendering
  interface NormalizedPathItem {
    id: string | number;
    name: string;
    type: 'path' | 'power' | 'skill' | 'trait';
    category?: string;
    details: string;
    notes?: string;
    owner?: string;
    rawItem: any;
  }

  const allPathAbilityItems = useMemo<NormalizedPathItem[]>(() => {
    const list: NormalizedPathItem[] = [];
    (paths || []).forEach((p) => {
      list.push({
        id: p.id || p.name,
        name: p.name,
        type: 'path',
        category: p.category || 'Path',
        details: `${p.category || 'General'} • ${((p as any).linked_elements || []).length} Elements`,
        notes: p.description,
        owner: p.owner,
        rawItem: p,
      });
    });
    (powers || []).forEach((p) => {
      list.push({
        id: p.id || p.name,
        name: p.name,
        type: 'power',
        category: p.category || 'Power',
        details: `${p.action || 'AM'} • ${p.usage || '1-Enc'}${p.ready ? ` • ${p.ready}` : ''}`,
        notes: p.effect || (p as any).notes,
        owner: p.owner,
        rawItem: p,
      });
    });
    (traits || []).forEach((t) => {
      list.push({
        id: t.id || t.name,
        name: t.name,
        type: 'trait',
        category: 'Trait',
        details: t.effect ? t.effect.slice(0, 60) : 'Trait',
        notes: t.notes,
        owner: t.owner,
        rawItem: t,
      });
    });
    (skills || []).forEach((s) => {
      list.push({
        id: s.id || s.name,
        name: s.name,
        type: 'skill',
        category: s.discipline || 'Skill',
        details: `${s.attribute} • ${s.discipline || 'General'}`,
        notes: s.notes,
        owner: s.owner,
        rawItem: s,
      });
    });
    return list;
  }, [paths, powers, traits, skills]);

  const myPathItems = useMemo(() => {
    return allPathAbilityItems.filter((it) => getItemScope(it.owner) === 'mine');
  }, [allPathAbilityItems, cleanEmail]);

  const myPathCount = myPathItems.length;

  const filteredMyPathItems = useMemo(() => {
    let items = myPathItems;
    if (pathLibraryFilter !== 'all') {
      items = items.filter((it) => it.type === pathLibraryFilter);
    }
    const q = canonicalSearchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter((it) => it.name.toLowerCase().includes(q) || (it.notes && it.notes.toLowerCase().includes(q)));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [myPathItems, pathLibraryFilter, canonicalSearchQuery]);

  // Normalized Chaos Gems for UI List Rendering
  const myGems = useMemo(() => {
    return (chaosGemsCatalog || []).filter((g) => getItemScope(g.owner) === 'mine');
  }, [chaosGemsCatalog, cleanEmail]);

  const myGemCount = myGems.length;

  const filteredMyGems = useMemo(() => {
    let items = myGems;
    const q = canonicalSearchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter((g) => g.name.toLowerCase().includes(q) || (g.effect && g.effect.toLowerCase().includes(q)));
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [myGems, canonicalSearchQuery]);

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
    if (isGearType(chassisOrType as any) || chassisOrType === 'supplies') {
      setStudioTab('current');
    } else if (chassisOrType === 'chaos_gem') {
      setGemStudioTab('current');
    } else {
      setPathStudioTab('current');
    }
  };

  const displayList = useMemo(() => {
    if (listFilterMode === 'all') {
      return sortedPersonalItems;
    }
    return sortedPersonalItems.filter((it) => it.type === creationType);
  }, [sortedPersonalItems, listFilterMode, creationType]);

  // Derive unique skillsets from atomic skills catalog
  const derivedSkillsets = useMemo(() => {
    const map = new Map<string, { id: string; name: string; skills: string[]; attribute?: string }>();
    (skills || []).forEach((sk) => {
      const sets = Array.isArray(sk.skillset) ? sk.skillset : sk.skillset ? [sk.skillset] : [];
      sets.forEach((setName) => {
        const clean = (setName || '').trim();
        if (!clean) return;
        if (!map.has(clean)) {
          map.set(clean, { id: `skillset_${clean}`, name: clean, skills: [], attribute: sk.attribute });
        }
        map.get(clean)!.skills.push(sk.name);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [skills]);

  // Aggregate all available paths for the Path selector dropdown
  const allAvailablePaths = useMemo(() => {
    const list: { id: string; name: string; category?: string; isCustom?: boolean; rawItem?: any }[] = [];
    (paths || []).forEach((p) => {
      const scope = getItemScope(p.owner);
      const isCustom = scope !== 'canon';
      const cat = isCustom
        ? scope === 'mine'
          ? `${p.category || 'Path'} (Personal)`
          : `${p.category || 'Path'} (Linked - ${p.owner})`
        : p.category || 'Official';
      list.push({
        id: isCustom ? `custom_${p.id || p.name}` : `official_${p.id || p.name}`,
        name: p.name,
        category: cat,
        isCustom,
        rawItem: p,
      });
    });
    return list;
  }, [paths, cleanEmail]);

  // Filtered catalog items for Link Existing Ability
  const filteredPathCatalogItems = useMemo(() => {
    const q = abilityCatalogSearch.toLowerCase().trim();

    if (activeAbilityCategory === 'power') {
      const allPowers: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      personalItems.filter((it) => it.type === 'power').forEach((p) => {
        const key = (p.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allPowers.push({
            id: p.id,
            name: p.name,
            type: 'power',
            details: `⭐ Personal • ${p.item_data?.action || 'AM'} • ${p.item_data?.usage || '1-Enc'} • ${p.item_data?.effect ? p.item_data.effect.slice(0, 50) : ''}`,
          });
        }
      });

      (powers || []).forEach((p) => {
        const key = (p.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allPowers.push({
            id: p.id ?? p.name,
            name: p.name,
            type: 'power',
            details: `${p.action || 'AM'} • ${p.usage || '1-Enc'} • ${p.effect ? p.effect.slice(0, 50) : ''}`,
          });
        }
      });

      if (!q) return allPowers;
      return allPowers.filter((p) => p.name.toLowerCase().includes(q) || p.details.toLowerCase().includes(q));
    }

    if (activeAbilityCategory === 'skill') {
      const allSkills: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      personalItems.filter((it) => it.type === 'skill').forEach((s) => {
        const key = (s.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allSkills.push({
            id: s.id,
            name: s.name,
            type: 'skill',
            details: `⭐ Personal • Attr: ${s.item_data?.attribute || '💪'} • ${s.item_data?.discipline || 'General'}`,
          });
        }
      });

      (skills || []).forEach((s) => {
        const key = (s.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allSkills.push({
            id: s.id ?? s.name,
            name: s.name,
            type: 'skill',
            details: `Attr: ${s.attribute || '💪'} • Disc: ${s.discipline || 'General'}`,
          });
        }
      });

      if (!q) return allSkills;
      return allSkills.filter((s) => s.name.toLowerCase().includes(q) || s.details.toLowerCase().includes(q));
    }

    if (activeAbilityCategory === 'skillset') {
      const allSets: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      personalItems.filter((it) => it.type === 'skillset').forEach((ss) => {
        const key = (ss.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          const count = Array.isArray(ss.item_data?.skills) ? ss.item_data.skills.length : 0;
          allSets.push({
            id: ss.id,
            name: ss.name,
            type: 'skillset',
            details: `⭐ Personal • ${count} Skills`,
          });
        }
      });

      derivedSkillsets.forEach((ss) => {
        const key = (ss.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allSets.push({
            id: ss.id,
            name: ss.name,
            type: 'skillset',
            details: `${ss.skills.length} Skills: ${ss.skills.slice(0, 3).join(', ')}...`,
          });
        }
      });

      if (!q) return allSets;
      return allSets.filter((s) => s.name.toLowerCase().includes(q) || s.details.toLowerCase().includes(q));
    }

    if (activeAbilityCategory === 'trait') {
      const allTraits: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      personalItems.filter((it) => it.type === 'trait').forEach((t) => {
        const key = (t.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allTraits.push({
            id: t.id,
            name: t.name,
            type: 'trait',
            details: `⭐ Personal • ${t.item_data?.effect ? t.item_data.effect.slice(0, 50) : ''}`,
          });
        }
      });

      (traits || []).forEach((t) => {
        const key = (t.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allTraits.push({
            id: t.id ?? t.name,
            name: t.name,
            type: 'trait',
            details: t.effect ? t.effect.slice(0, 60) : 'Trait effect...',
          });
        }
      });

      if (!q) return allTraits;
      return allTraits.filter((t) => t.name.toLowerCase().includes(q) || t.details.toLowerCase().includes(q));
    }

    if (activeAbilityCategory === 'weapon') {
      const allWeapons: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      (weaponsCatalog || []).forEach((w) => {
        const key = (w.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allWeapons.push({
            id: w.id ?? w.name,
            name: w.name,
            type: 'weapon',
            details: `${w.type || 'Melee'} • Req: ${w.requirement || '💪 4'} • Dmg: ${w.dmg || 'd6'}`,
          });
        }
      });

      if (!q) return allWeapons;
      return allWeapons.filter((w) => w.name.toLowerCase().includes(q) || w.details.toLowerCase().includes(q));
    }

    if (activeAbilityCategory === 'armor') {
      const allArmor: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      (armorCatalog || []).forEach((a) => {
        const key = (a.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allArmor.push({
            id: a.id ?? a.name,
            name: a.name,
            type: 'armor',
            details: `Req: ${a.requirement || '💪 4'} • AR: ${a.ar || '4'} • MR: ${a.mr || '👣12'}`,
          });
        }
      });

      if (!q) return allArmor;
      return allArmor.filter((a) => a.name.toLowerCase().includes(q) || a.details.toLowerCase().includes(q));
    }

    if (activeAbilityCategory === 'shield') {
      const allShields: { id: string | number; name: string; type: PathElementType; details: string }[] = [];
      const seen = new Set<string>();

      (shieldsCatalog || []).forEach((s) => {
        const key = (s.name || '').toLowerCase().trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          allShields.push({
            id: s.id ?? s.name,
            name: s.name,
            type: 'shield',
            details: `Req: ${s.requirement || '💪 4'} • Block: ${s.max_block || '🛡️12'} • MR: ${s.mr || '👣0'}`,
          });
        }
      });

      if (!q) return allShields;
      return allShields.filter((s) => s.name.toLowerCase().includes(q) || s.details.toLowerCase().includes(q));
    }

    return [];
  }, [
    activeAbilityCategory,
    abilityCatalogSearch,
    personalItems,
    powers,
    skills,
    traits,
    derivedSkillsets,
    weaponsCatalog,
    armorCatalog,
    shieldsCatalog,
  ]);

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

  const handleUpdateLinkedElements = async (elements: PathLinkedElement[]) => {
    setLinkedElements(elements);
    if (editingItem && editingItem.id) {
      try {
        const updatedItemData: CustomCreationData = {
          ...(editingItem.item_data || {}),
          linked_elements: elements,
        };
        const updated = await gameApi.updateCustomItem(editingItem.id, {
          ...editingItem,
          item_data: updatedItemData,
        });
        if (updated) {
          setEditingItem(updated);
        }
        loadPersonalItems();
        if (onItemSaved) onItemSaved();
      } catch (err) {
        console.error('[PlayerWorkshopModal] Error auto-persisting linked elements:', err);
      }
    }
  };

  const handleToggleLinkedElementFree = (idx: number, isFree: boolean) => {
    const copy = [...linkedElements];
    if (copy[idx]) {
      copy[idx] = { ...copy[idx], isFree, tag: isFree ? 'Free' : '1 AP' };
      handleUpdateLinkedElements(copy);
    }
  };

  const handleRemoveLinkedElement = (idx: number) => {
    const next = linkedElements.filter((_, i) => i !== idx);
    handleUpdateLinkedElements(next);
  };

  const handleLinkExistingItem = (item: { id: string | number; name: string; type: PathElementType; details?: string }) => {
    if (linkedElements.some((el) => (el.name || el.element_name || '').toLowerCase().trim() === item.name.toLowerCase().trim())) {
      return;
    }
    const next: PathLinkedElement[] = [
      ...linkedElements,
      {
        id: item.id,
        name: item.name,
        type: item.type,
        tag: '1 AP',
        isFree: false,
        details: item.details,
      },
    ];
    handleUpdateLinkedElements(next);
  };

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
    setLinkedElements(Array.isArray(official.linked_elements) ? official.linked_elements : []);
    setSelectedGenres(official.genres && official.genres.length > 0 ? official.genres : ['Medieval']);
    setActivePathSelection({ type: 'path' });
  };

  const handlePopulateCanonicalPower = (p: any) => {
    setCanonicalSelectedId(p.id || p.name);
    setOriginalCanonicalName(p.name || '');
    setName(p.name || '');
    setAbilityFormName(p.name || '');
    setAbilityFormAction(p.action || 'AM');
    setAbilityFormUsage(p.usage || '1-Enc');
    setAbilityFormPowerReady(p.ready || 'primary_arsenal');
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

  const handleSaveAndLinkAbility = async () => {
    if (!abilityFormName.trim()) return;
    setIsSubmitting(true);
    setFeedback(null);

    const abilityType = activeAbilityCategory;

    const abilityDataPayload: CustomCreationData = {
      notes: abilityFormNotes.trim() || undefined,
      genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
      category:
        abilityType === 'power'
          ? 'Power'
          : abilityType === 'trait'
          ? 'Trait'
          : abilityType === 'skill'
          ? abilityFormSkillDiscipline === 'CUSTOM_NEW'
            ? abilityFormSkillDisciplineNewText.trim()
            : abilityFormSkillDiscipline
          : 'General',
      allow_cloning: true,
    };

    let detailsSummary = '';

    if (abilityType === 'power') {
      abilityDataPayload.action = abilityFormAction;
      abilityDataPayload.usage = abilityFormUsage;
      abilityDataPayload.effect = abilityFormEffect.trim();
      abilityDataPayload.ready_category = abilityFormPowerReady;
      abilityDataPayload.table = 'General';
      abilityDataPayload.table_group = 'General';
      detailsSummary = `${abilityFormAction} • ${abilityFormUsage}`;
    } else if (abilityType === 'skill') {
      const disc =
        abilityFormSkillDiscipline === 'CUSTOM_NEW'
          ? abilityFormSkillDisciplineNewText.trim() || 'General'
          : abilityFormSkillDiscipline;
      abilityDataPayload.attribute = abilityFormSkillAttribute;
      abilityDataPayload.discipline = disc;
      abilityDataPayload.formatted_skill = `${abilityFormName.trim()} ${abilityFormSkillAttribute}`;
      detailsSummary = `Attr: ${abilityFormSkillAttribute} • ${disc}`;
    } else if (abilityType === 'skillset') {
      abilityDataPayload.skills = abilityFormSkillsetSkills.filter(Boolean);
      detailsSummary = `${abilityDataPayload.skills.length} Skills`;
    } else if (abilityType === 'trait') {
      abilityDataPayload.effect = abilityFormEffect.trim();
      detailsSummary = abilityFormEffect.slice(0, 50);
    }

    const targetOwner = workshopMode === 'designer' ? 'Designer' : (playerEmail || 'guest@metascape.com');

    try {
      let createdId: string | number = `link_${Date.now()}`;

      if (abilityType === 'power') {
        const powerPayload = {
          name: abilityFormName.trim(),
          action: abilityFormAction,
          usage: abilityFormUsage,
          effect: abilityFormEffect.trim(),
          ready: abilityFormPowerReady,
          notes: abilityFormNotes.trim() || null,
          genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
          path: name.trim() || 'General',
          category: 'Class',
          table_group: name.trim() || 'General',
          owner: targetOwner,
        };
        const createdPower = await gameApi.saveCanonicalPower(powerPayload);
        createdId = createdPower.id;
        if (workshopMode === 'designer') {
          await gameApi.propagateCanonicalUpdateToAllCharacters({
            entityType: 'power',
            oldName: abilityFormName.trim(),
            updatedItem: createdPower,
          });
        }
        updateCanonicalCatalogItem('power', createdPower);
      } else if (abilityType === 'trait') {
        const traitPayload = {
          name: abilityFormName.trim(),
          effect: abilityFormEffect.trim(),
          notes: abilityFormNotes.trim() || '',
          genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
          path: name.trim() || 'General',
          owner: targetOwner,
        };
        const createdTrait = await gameApi.saveCanonicalTrait(traitPayload);
        createdId = createdTrait.id;
        if (workshopMode === 'designer') {
          await gameApi.propagateCanonicalUpdateToAllCharacters({
            entityType: 'trait',
            oldName: abilityFormName.trim(),
            updatedItem: createdTrait,
          });
        }
        updateCanonicalCatalogItem('trait', createdTrait);
      } else if (abilityType === 'skill') {
        const disc =
          abilityFormSkillDiscipline === 'CUSTOM_NEW'
            ? abilityFormSkillDisciplineNewText.trim() || 'General'
            : abilityFormSkillDiscipline;
        const skillPayload = {
          name: abilityFormName.trim(),
          attribute: abilityFormSkillAttribute,
          discipline: disc,
          notes: abilityFormNotes.trim() || '',
          genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
          owner: targetOwner,
        };
        const createdSkill = await gameApi.saveCanonicalSkill(skillPayload);
        createdId = createdSkill.id;
        if (workshopMode === 'designer') {
          await gameApi.propagateCanonicalUpdateToAllCharacters({
            entityType: 'skill',
            oldName: abilityFormName.trim(),
            updatedItem: createdSkill,
          });
        }
        updateCanonicalCatalogItem('skill', createdSkill);
      }

      const newLink: PathLinkedElement = {
        id: String(createdId),
        name: abilityFormName.trim(),
        type: abilityType,
        isFree: false,
        details: detailsSummary,
        item_data: abilityDataPayload,
      };

      const nextLinked = [...linkedElements, newLink];
      setLinkedElements(nextLinked);

      if (canonicalSelectedId) {
        await gameApi.updateCanonicalPath(canonicalSelectedId, { linked_elements: nextLinked });
        updateCanonicalCatalogItem('path', { id: canonicalSelectedId, name, linked_elements: nextLinked });
      }

      setAbilityFormName('');
      setAbilityFormEffect('');
      setAbilityFormNotes('');
      setAbilityFormSkillsetSkills(['', '']);

      setFeedback({
        type: 'success',
        message: `Forged '${newLink.name}' and linked to ${name.trim() || 'Path'}!`,
      });

      if (workshopMode !== 'designer') {
        await refreshCatalogs();
      }
    } catch (err: any) {
      console.error('[PlayerWorkshopModal] Error creating and linking ability:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to save ability.'}` });
    } finally {
      setIsSubmitting(false);
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

  // Switch tabs cleanly
  const handleSwitchTab = (newType: CustomCreationType) => {
    if (newType !== creationType) {
      setCreationType(newType);
      setSelectedGenres([]);
      setFeedback(null);
      setEditingItem(null);
      setCanonicalSelectedId(null);
      setOriginalCanonicalName('');
      if (newType === 'gear' || newType === 'exotic' || newType === 'artifact') {
        setActiveStudioSelection({ type: 'chassis' });
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

    // If currently editing this exact item, not a collision
    if (canonicalSelectedId && String(match.id) === String(canonicalSelectedId)) {
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
    isNameValid && isGenresValid && isPathCategoryValid && pathDescription.trim().length > 0;

  const isPathLoaded = Boolean(
    !isCreatingNewPath && (selectedPathId || (editingItem && editingItem.type === 'path'))
  );
  const isPathIdle = !isCreatingNewPath && !isPathLoaded;

  const isFormValid = useMemo(() => {
    if (creationType === 'paths_abilities') {
      if (pathStudioMode === 'path') {
        if (!isNameValid) return false;
        if (!isGenresValid) return false;
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

  const insertAbilityTextAtCursor = (insertStr: string) => {
    const textarea = abilityEffectTextareaRef.current;
    if (!textarea) {
      setAbilityFormEffect((prev) => (prev ? prev + insertStr : insertStr));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentVal = abilityFormEffect;
    const nextVal = currentVal.substring(0, start) + insertStr + currentVal.substring(end);
    setAbilityFormEffect(nextVal);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          itemDataPayload.ready_category = abilityFormPowerReady;
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
            genres: selectedGenres.length > 0 ? selectedGenres : ['Medieval'],
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
              ready: abilityFormPowerReady,
              notes: abilityFormNotes.trim() || null,
              genres: abilityFormGenres.length > 0 ? abilityFormGenres : selectedGenres,
              path: 'General',
              category: 'Class',
              table_group: 'General',
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
            const isExisting = pwr.id && !pwr.id.startsWith('pwr_') && !pwr.id.startsWith('fn_') && !isNaN(Number(pwr.id));
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
            const isModExisting = mod.id && !mod.id.startsWith('mod_') && !isNaN(Number(mod.id));

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
              const isChildExisting = cPwr.id && !cPwr.id.startsWith('pwr_') && !cPwr.id.startsWith('fn_') && !isNaN(Number(cPwr.id));
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsTreeExpanded(!isTreeExpanded);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isTreeExpanded ? 'Collapse Mods & Powers' : 'Expand Mods & Powers'}
            >
              <ChevronDown
                className={`w-4 h-4 text-cyan-400 transition-transform ${
                  isTreeExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
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
      {isTreeExpanded && (
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
      )}
    </div>
  );

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
            {isMasterAccount && (
              <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md mr-1">
                <button
                  type="button"
                  onClick={() => {
                    setWorkshopMode('player');
                    handleResetForm();
                    setCanonicalSearchQuery('');
                    setStudioTab('current');
                    setPathStudioTab('current');
                    setGemStudioTab('current');
                  }}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    workshopMode === 'player'
                      ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                  title="Normal Player Forge (saves to Custom Elements)"
                >
                  <span>👤</span>
                  <span>Player Forge</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkshopMode('designer');
                    handleResetForm();
                  }}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    workshopMode === 'designer'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-sm font-extrabold shadow-amber-950/40'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                  title="Master Designer Mode (edits canonical Supabase database)"
                >
                  <span>👑</span>
                  <span>Designer Mode</span>
                </button>
              </div>
            )}
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
        <div className="px-6 py-2 bg-slate-950/40 border-b border-slate-800/80 shrink-0 flex items-center justify-between gap-2">
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

        {/* 2-Pane Grid Architecture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
          {/* ========================================================================= */}
          {/* PANE 1 (LEFT): STUDIO BLUEPRINT TREE (GEAR) OR LIVE CARD PREVIEW          */}
          {/* ========================================================================= */}
          {creationType === 'gear' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Studio Tab Switcher */}
              <div className="shrink-0 flex items-center justify-between gap-2">
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl inline-flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setStudioTab('current')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                      studioTab === 'current'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🛠️ Current
                  </button>
                  {isMetaScapeDesigner && (
                    <button
                      type="button"
                      onClick={() => setStudioTab('canon')}
                      className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                        studioTab === 'canon'
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      👑 Canon
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStudioTab('mine')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                      studioTab === 'mine'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🎨 My Creations ({myGearCount})
                  </button>
                </div>

                {editingItem && studioTab === 'current' && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition cursor-pointer shrink-0"
                    title="Start a new blank creation"
                  >
                    + New Blank
                  </button>
                )}
              </div>

              {studioTab === 'mine' ? (
                /* MY CREATIONS LIST VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                  {/* Chassis Category Filter Switch */}
                  <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md shrink-0">
                    <button
                      type="button"
                      onClick={() => setStudioLibraryChassisFilter('all')}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        studioLibraryChassisFilter === 'all'
                          ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🌐 All
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioLibraryChassisFilter('weapon')}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        studioLibraryChassisFilter === 'weapon'
                          ? 'bg-orange-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      ⚔️ Weapons
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioLibraryChassisFilter('armor')}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        studioLibraryChassisFilter === 'armor'
                          ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🥋 Armor
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioLibraryChassisFilter('shield')}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        studioLibraryChassisFilter === 'shield'
                          ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🛡️ Shields
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudioLibraryChassisFilter('supplies')}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        studioLibraryChassisFilter === 'supplies'
                          ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🎒 Supplies
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
                    {filteredMyGearItems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                        <span className="text-2xl mb-1.5">📦</span>
                        <p className="font-semibold text-slate-400">No gear creations found</p>
                        <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                          Click "Current" above to forge your first weapon, armor, shield, or supply.
                        </p>
                      </div>
                    ) : (
                      filteredMyGearItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.chassis === 'weapon') handlePopulateCanonicalWeapon(item.rawItem);
                            else if (item.chassis === 'armor') handlePopulateCanonicalArmor(item.rawItem);
                            else if (item.chassis === 'shield') handlePopulateCanonicalShield(item.rawItem);
                            else if (item.chassis === 'supplies') handlePopulateCanonicalSupply(item.rawItem);
                            setStudioTab('current');
                          }}
                          className="p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:border-amber-500/60 hover:bg-slate-900/90 transition flex flex-col gap-1.5 shadow-sm cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm shrink-0">
                                {item.chassis === 'weapon' ? '⚔️' : item.chassis === 'armor' ? '🥋' : item.chassis === 'shield' ? '🛡️' : '🎒'}
                              </span>
                              <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase shrink-0">
                                {item.chassis}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.chassis === 'weapon') handlePopulateCanonicalWeapon(item.rawItem);
                                  else if (item.chassis === 'armor') handlePopulateCanonicalArmor(item.rawItem);
                                  else if (item.chassis === 'shield') handlePopulateCanonicalShield(item.rawItem);
                                  else if (item.chassis === 'supplies') handlePopulateCanonicalSupply(item.rawItem);
                                  setStudioTab('current');
                                }}
                                className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                                title="Edit this creation"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmTarget({
                                    type: item.chassis,
                                    id: item.id,
                                    name: item.name,
                                  });
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                title="Delete this creation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {item.cost && (
                              <span className="px-1.5 py-0.2 bg-purple-950/80 border border-purple-500/30 text-purple-300 font-bold rounded">
                                {item.cost}
                              </span>
                            )}
                            <span className="text-slate-300">{item.details}</span>
                          </div>
                          {item.notes && (
                            <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800/80 text-[10px] text-slate-300 font-mono leading-tight line-clamp-2">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              ) : (isMetaScapeDesigner && studioTab === 'canon') ? (
                /* SUPABASE CANONICAL VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                  {/* Chassis Category Filter Switch */}
                  <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setGearDatabaseChassis('weapon');
                        handleResetForm();
                        setStudioChassisType('weapon');
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
                        handleResetForm();
                        setStudioChassisType('armor');
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
                        handleResetForm();
                        setStudioChassisType('shield');
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
                        handleResetForm();
                        setStudioChassisType('supplies');
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

                  {/* Dropdown Selector Header */}
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span>👑</span>
                      <span>
                        Master {gearDatabaseChassis === 'weapon' ? 'Weapons' : gearDatabaseChassis === 'armor' ? 'Armor' : gearDatabaseChassis === 'shield' ? 'Shields' : 'Supplies'}
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

                    {workshopMode === 'designer' && (
                      <button
                        type="button"
                        onClick={handleNewMasterEntry}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer shrink-0"
                      >
                        + New Master Item
                      </button>
                    )}
                  </div>

                  {/* Dropdown Selector */}
                  <select
                    value={canonicalSelectedId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        handleResetForm();
                        return;
                      }
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
                    }}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer shrink-0"
                  >
                    <option value="">
                      {canonicalSearchQuery
                        ? gearDatabaseChassis === 'weapon'
                          ? filteredCanonicalWeapons.length > 0
                            ? `-- Filtered (${filteredCanonicalWeapons.length} matches) --`
                            : `-- No matches for "${canonicalSearchQuery}" --`
                          : gearDatabaseChassis === 'armor'
                          ? filteredCanonicalArmor.length > 0
                            ? `-- Filtered (${filteredCanonicalArmor.length} matches) --`
                            : `-- No matches for "${canonicalSearchQuery}" --`
                          : gearDatabaseChassis === 'shield'
                          ? filteredCanonicalShields.length > 0
                            ? `-- Filtered (${filteredCanonicalShields.length} matches) --`
                            : `-- No matches for "${canonicalSearchQuery}" --`
                          : filteredCanonicalSupplies.length > 0
                          ? `-- Filtered (${filteredCanonicalSupplies.length} matches) --`
                          : `-- No matches for "${canonicalSearchQuery}" --`
                        : `-- Choose Canonical ${gearDatabaseChassis.charAt(0).toUpperCase() + gearDatabaseChassis.slice(1)} (${
                            gearDatabaseChassis === 'weapon'
                              ? filteredCanonicalWeapons.length
                              : gearDatabaseChassis === 'armor'
                              ? filteredCanonicalArmor.length
                              : gearDatabaseChassis === 'shield'
                              ? filteredCanonicalShields.length
                              : filteredCanonicalSupplies.length
                          }) --`}
                    </option>
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
                  </select>

                  {canonicalSelectedId || name.trim() || isAuthoringNewMaster ? (
                    renderGearHierarchyTree(true)
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                      <span className="text-2xl mb-1.5">👑</span>
                      <p className="font-semibold text-slate-400">No Master Item Selected</p>
                      <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                        {workshopMode === 'designer'
                          ? 'Pick an existing master item from the dropdown above to view, edit, or delete it, or click "+ New Master Item" to author a new canonical entry.'
                          : 'Pick an official canonical item from the dropdown above to view its stats or load it into your forge as a starting template.'}
                      </p>
                    </div>
                  )}
                </div>

              ) : (
                /* CURRENT ITEM HIERARCHY TREE VIEW */
                renderGearHierarchyTree(false)
              )}
            </div>
          ) : creationType === 'paths_abilities' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Studio Tab Switcher */}
              <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap">
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl inline-flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setPathStudioTab('current')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                      pathStudioTab === 'current'
                        ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🛠️ Current
                  </button>
                  {isMetaScapeDesigner && (
                    <button
                      type="button"
                      onClick={() => setPathStudioTab('canon')}
                      className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                        pathStudioTab === 'canon'
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      👑 Canon
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPathStudioTab('mine')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                      pathStudioTab === 'mine'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🎨 My Creations ({myPathCount})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle 2: Path vs Standalone (Only visible in Current mode for MetaScape Designer) */}
                  {pathStudioTab === 'current' && isMetaScapeDesigner && (
                    <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl inline-flex items-center gap-1 shadow-inner backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => {
                          setPathStudioMode('path');
                          setActivePathSelection({ type: 'path' });
                        }}
                        className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          pathStudioMode === 'path'
                            ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        🧭 Path
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPathStudioMode('standalone');
                          setActivePathSelection({ type: 'ability', category: activeAbilityCategory });
                        }}
                        className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          pathStudioMode === 'standalone'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        ⚡ Standalone
                      </button>
                    </div>
                  )}

                  {editingItem && pathStudioTab === 'current' && (
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition cursor-pointer shrink-0"
                      title="Start a new blank creation"
                    >
                      + New Blank
                    </button>
                  )}
                </div>
              </div>

              {pathStudioTab === 'mine' ? (
                /* MY CREATIONS LIST VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                  {/* Category Filter Switch */}
                  <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md shrink-0">
                    {(['all', 'path', 'power', 'skill', 'trait'] as const).map((filter) => {
                      const labels: Record<string, string> = {
                        all: '🌐 All',
                        path: '🧭 Paths',
                        power: '⚡ Powers',
                        skill: '🎯 Skills',
                        trait: '🧬 Traits',
                      };
                      return (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setPathLibraryFilter(filter)}
                          className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                            pathLibraryFilter === filter
                              ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          {labels[filter]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                    {filteredMyPathItems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                        <span className="text-2xl mb-1.5">🧭</span>
                        <p className="font-semibold text-slate-400">No creations found under this filter</p>
                        <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                          Click "Current" above to forge your first custom Path, Power, Trait, or Skill.
                        </p>
                      </div>
                    ) : (
                      filteredMyPathItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-900 transition-all flex flex-col gap-1.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">
                                {item.type === 'path' ? '🧭' : item.type === 'power' ? '⚡' : item.type === 'trait' ? '🧬' : '🎯'}
                              </span>
                              <span className="font-bold text-slate-100 text-xs truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-blue-300 font-mono font-bold uppercase">
                                {item.type}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.type === 'path') handlePopulateOfficialPath(item.rawItem);
                                  else if (item.type === 'power') handlePopulateCanonicalPower(item.rawItem);
                                  else if (item.type === 'trait') handlePopulateCanonicalTrait(item.rawItem);
                                  else if (item.type === 'skill') handlePopulateCanonicalSkill(item.rawItem);
                                  setPathStudioTab('current');
                                }}
                                className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                                title="Edit this creation"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmTarget({
                                    type: item.type,
                                    id: item.id,
                                    name: item.name,
                                  })
                                }
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                title="Delete creation"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {item.details && (
                            <div className="text-[10px] text-slate-300">
                              {item.details}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-[10px] text-slate-400 font-mono line-clamp-1">
                              {item.notes}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              ) : (isMetaScapeDesigner && pathStudioTab === 'canon') ? (
                /* SUPABASE CANONICAL VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                  {/* Category Filter Switch */}
                  <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-0.5 shadow-inner backdrop-blur-md shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPathDatabaseCategory('path');
                        handleResetForm();
                        setPathStudioMode('path');
                        setActivePathSelection({ type: 'path' });
                      }}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        pathDatabaseCategory === 'path'
                          ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🧭 Paths
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPathDatabaseCategory('power');
                        handleResetForm();
                        setPathStudioMode('standalone');
                        setActiveAbilityCategory('power');
                        setActivePathSelection({ type: 'ability', category: 'power' });
                      }}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        pathDatabaseCategory === 'power'
                          ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      ⚡ Powers
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPathDatabaseCategory('trait');
                        handleResetForm();
                        setPathStudioMode('standalone');
                        setActiveAbilityCategory('trait');
                        setActivePathSelection({ type: 'ability', category: 'trait' });
                      }}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        pathDatabaseCategory === 'trait'
                          ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🧬 Traits
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPathDatabaseCategory('skill');
                        handleResetForm();
                        setPathStudioMode('standalone');
                        setActiveAbilityCategory('skill');
                        setActivePathSelection({ type: 'ability', category: 'skill' });
                      }}
                      className={`flex-1 py-1 px-1 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        pathDatabaseCategory === 'skill'
                          ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      🎯 Skills
                    </button>
                  </div>

                  {/* Dropdown Selector Header */}
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span>👑</span>
                      <span>
                        Master {pathDatabaseCategory === 'path' ? 'Paths' : pathDatabaseCategory === 'power' ? 'Powers' : pathDatabaseCategory === 'trait' ? 'Traits' : 'Skills'}
                      </span>
                    </span>

                    {/* Inline Search Bar */}
                    <div className="flex-1 min-w-[120px] max-w-xs relative flex items-center">
                      <input
                        type="text"
                        value={canonicalSearchQuery}
                        onChange={(e) => setCanonicalSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCanonicalSearchEnter('paths_abilities');
                        }}
                        placeholder={`Search ${pathDatabaseCategory}...`}
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
                      onClick={handleNewMasterEntry}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer shrink-0"
                    >
                      + New Master Entry
                    </button>
                  </div>

                  {/* Dropdown Selector */}
                  <select
                    value={canonicalSelectedId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        handleResetForm();
                        return;
                      }
                      if (pathDatabaseCategory === 'path') {
                        const p = (paths || []).find((item) => String(item.id) === val || item.name === val);
                        if (p) handlePopulateOfficialPath(p);
                      } else if (pathDatabaseCategory === 'power') {
                        const p = (powers || []).find((item) => String(item.id) === val || item.name === val);
                        if (p) handlePopulateCanonicalPower(p);
                      } else if (pathDatabaseCategory === 'trait') {
                        const t = (traits || []).find((item) => String(item.id) === val || item.name === val);
                        if (t) handlePopulateCanonicalTrait(t);
                      } else if (pathDatabaseCategory === 'skill') {
                        const s = (skills || []).find((item) => String(item.id) === val || item.name === val);
                        if (s) handlePopulateCanonicalSkill(s);
                      }
                    }}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer shrink-0"
                  >
                    <option value="">
                      {canonicalSearchQuery
                        ? pathDatabaseCategory === 'path'
                          ? filteredCanonicalPaths.length > 0
                            ? `-- Filtered (${filteredCanonicalPaths.length} matches) --`
                            : `-- No matches for "${canonicalSearchQuery}" --`
                          : pathDatabaseCategory === 'power'
                          ? filteredCanonicalPowers.length > 0
                            ? `-- Filtered (${filteredCanonicalPowers.length} matches) --`
                            : `-- No matches for "${canonicalSearchQuery}" --`
                          : pathDatabaseCategory === 'trait'
                          ? filteredCanonicalTraits.length > 0
                            ? `-- Filtered (${filteredCanonicalTraits.length} matches) --`
                            : `-- No matches for "${canonicalSearchQuery}" --`
                          : filteredCanonicalSkills.length > 0
                          ? `-- Filtered (${filteredCanonicalSkills.length} matches) --`
                          : `-- No matches for "${canonicalSearchQuery}" --`
                        : `-- Choose Canonical ${pathDatabaseCategory.charAt(0).toUpperCase() + pathDatabaseCategory.slice(1)} (${
                            pathDatabaseCategory === 'path'
                              ? (paths || []).length
                              : pathDatabaseCategory === 'power'
                              ? (powers || []).length
                              : pathDatabaseCategory === 'trait'
                              ? (traits || []).length
                              : (skills || []).length
                          }) --`}
                    </option>
                    {pathDatabaseCategory === 'path' &&
                      filteredCanonicalPaths.map((p) => (
                        <option key={p.id || p.name} value={p.id || p.name}>
                          {p.name} ({p.category || 'General'})
                        </option>
                      ))}
                    {pathDatabaseCategory === 'power' &&
                      filteredCanonicalPowers.map((p) => (
                        <option key={p.id || p.name} value={p.id || p.name}>
                          {p.name} ({p.action || 'AM'}, {p.usage || 'Usage'})
                        </option>
                      ))}
                    {pathDatabaseCategory === 'trait' &&
                      filteredCanonicalTraits.map((t) => (
                        <option key={t.id || t.name} value={t.id || t.name}>
                          {t.name}
                        </option>
                      ))}
                    {pathDatabaseCategory === 'skill' &&
                      filteredCanonicalSkills.map((s) => (
                        <option key={s.id || s.name} value={s.id || s.name}>
                          {s.name} ({s.attribute || 'Attr'}, {s.discipline || 'General'})
                        </option>
                      ))}
                  </select>

                  {/* Canonical Item Preview Card */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
                    {canonicalSelectedId ? (
                      <div className="p-3.5 rounded-xl border border-amber-500/40 bg-slate-900/90 flex flex-col gap-2.5 shadow-lg shadow-amber-950/20">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">
                              {pathDatabaseCategory === 'path' ? '🧭' : pathDatabaseCategory === 'power' ? '⚡' : pathDatabaseCategory === 'trait' ? '🧬' : '🎯'}
                            </span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-100 text-xs truncate">
                                {pathDatabaseCategory === 'path' ? name : abilityFormName || 'Unnamed Entry'}
                              </h4>
                              <span className="text-[10px] text-amber-400 font-mono">👑 Master ID: {canonicalSelectedId}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 uppercase">
                            {pathDatabaseCategory}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 flex flex-col gap-1.5">
                          {pathDatabaseCategory === 'path' && (
                            <>
                              <div>Category: <strong className="text-amber-300">{finalPathCat}</strong></div>
                              {pathDescription && (
                                <p className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                                  {pathDescription}
                                </p>
                              )}
                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                <span className="font-bold text-slate-300">Linked Elements:</span>
                                <span className="font-mono text-amber-300">{linkedElements.length} elements</span>
                              </div>
                            </>
                          )}
                          {pathDatabaseCategory === 'power' && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 font-mono font-bold">{abilityFormAction}</span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono font-bold">{abilityFormUsage}</span>
                              </div>
                              {abilityFormEffect && (
                                <div className="p-2 rounded bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                                  {abilityFormEffect}
                                </div>
                              )}
                            </>
                          )}
                          {pathDatabaseCategory === 'trait' && (
                            <>
                              {abilityFormEffect && (
                                <div className="p-2 rounded bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                                  {abilityFormEffect}
                                </div>
                              )}
                            </>
                          )}
                          {pathDatabaseCategory === 'skill' && (
                            <div>
                              Attribute: <strong className="text-amber-300">{abilityFormSkillAttribute}</strong> • Discipline: <strong className="text-slate-200">{abilityFormSkillDiscipline}</strong>
                            </div>
                          )}
                          {((pathDatabaseCategory === 'path' ? notes : abilityFormNotes) || '').trim() && (
                            <p className="text-[10px] text-slate-400 italic font-serif border-t border-slate-800/80 pt-1">
                              "{pathDatabaseCategory === 'path' ? notes : abilityFormNotes}"
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                          {workshopMode === 'designer' ? (
                            <>
                              <span className="text-[10px] text-slate-400 italic">
                                Edit details in the right pane, then click Save.
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmTarget({
                                    type: pathDatabaseCategory,
                                    id: canonicalSelectedId,
                                    name: originalCanonicalName || (pathDatabaseCategory === 'path' ? name : abilityFormName),
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                                title="Delete this record from Supabase"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete from SupaBase</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-amber-300/80 font-medium">
                                👑 Official Canonical Item
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const item =
                                    pathDatabaseCategory === 'path'
                                      ? (paths || []).find((p) => String(p.id) === String(canonicalSelectedId) || p.name === canonicalSelectedId)
                                      : pathDatabaseCategory === 'power'
                                      ? (powers || []).find((p) => String(p.id) === String(canonicalSelectedId) || p.name === canonicalSelectedId)
                                      : pathDatabaseCategory === 'trait'
                                      ? (traits || []).find((t) => String(t.id) === String(canonicalSelectedId) || t.name === canonicalSelectedId)
                                      : (skills || []).find((s) => String(s.id) === String(canonicalSelectedId) || s.name === canonicalSelectedId);
                                  if (item) handleLoadTemplateIntoForge(pathDatabaseCategory, item);
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                                title="Load as customizable template into forge"
                              >
                                <span>🛠️</span>
                                <span>+ Load into Forge</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                        <span className="text-2xl mb-1.5">👑</span>
                        <p className="font-semibold text-slate-400">No Master Entry Selected</p>
                        <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                          {workshopMode === 'designer'
                            ? 'Pick an existing master entry from the dropdown above to view, edit, or delete it, or click "+ New Master Entry" to author a new canonical entry.'
                            : 'Pick an official canonical entry from the dropdown above to view its stats or load it into your forge as a starting template.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              ) : (
                /* CURRENT ITEM VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                  {pathStudioMode === 'path' ? (
                    <>
                      {/* Path Selection & Action Row */}
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                          <span>Select Path:</span>
                          <span className="text-[10px] text-slate-500">Pick to edit / clone</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              handleResetForm();
                              setCreationType('paths_abilities');
                              setPathStudioMode('path');
                              setIsCreatingNewPath(true);
                              setSelectedPathId('');
                              setActivePathSelection({ type: 'path' });
                            }}
                            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-sm ${
                              isCreatingNewPath
                                ? 'bg-blue-600 text-white shadow-blue-950/50 font-extrabold border border-blue-400/50'
                                : 'bg-slate-900/90 hover:bg-slate-800 text-blue-300 border border-slate-700 hover:border-blue-500/50'
                            }`}
                            title="Create a brand new Path Archetype"
                          >
                            <span>➕</span>
                            <span>New Path</span>
                          </button>
                          <select
                            value={selectedPathId}
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
                              if (val.startsWith('custom_')) {
                                const id = val.replace('custom_', '');
                                const found = personalItems.find((it) => it.id === id);
                                if (found) handlePopulateItemForEdit(found);
                              } else if (val.startsWith('official_')) {
                                const pathKey = val.replace('official_', '');
                                const found = paths.find((p) => (p.id && p.id === pathKey) || p.name === pathKey);
                                if (found) handlePopulateOfficialPath(found);
                              }
                            }}
                            className="flex-1 min-w-0 bg-slate-950 text-slate-200 text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-blue-500 font-medium truncate"
                          >
                            <option value="">Select an existing path...</option>
                            {allAvailablePaths.some((p) => p.isCustom) && (
                              <optgroup label="Personal Custom Paths">
                                {allAvailablePaths
                                  .filter((p) => p.isCustom)
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      ⭐ {p.name} ({p.category})
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                            <optgroup label="Official Paths">
                              {allAvailablePaths
                                .filter((p) => !p.isCustom)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    📜 {p.name} ({p.category})
                                  </option>
                                ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>

                      {isPathIdle ? (
                        /* STATE 1: IDLE / NO PATH CHOSEN (BLANK CANVAS) */
                        <div className="flex-1 min-h-0" />
                      ) : isCreatingNewPath ? (
                        /* STATE 2: CREATING NEW PATH (SHOW ONLY PATH CARD + BOTTOM SAVE PATH BUTTON) */
                        <>
                          {/* Master Path Card (Root Node) */}
                          <div
                            onClick={() => setActivePathSelection({ type: 'path' })}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer shrink-0 flex flex-col gap-2 ${
                              activePathSelection.type === 'path'
                                ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/40 ring-1 ring-blue-500'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🧭</span>
                                <div>
                                  <div className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                                    <span>{name.trim() || 'Untitled Path'}</span>
                                    <GuardrailBadge isValid={isNameValid} />
                                  </div>
                                  <div className="text-[11px] text-blue-300 font-medium">
                                    Category: {finalPathCat}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-200 border border-blue-500/40">
                                New Archetype
                              </span>
                            </div>

                            {pathDescription.trim() ? (
                              <div className="text-[11px] text-slate-400 line-clamp-2 italic">
                                "{pathDescription.trim()}"
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic">
                                (Fill in description and category on the right)
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
                              <span className="text-slate-500">Save path on the right to unlock abilities</span>
                              <span className="text-blue-400 font-medium">Editing Path Identity ✎</span>
                            </div>
                          </div>

                          {/* Blank Canvas */}
                          <div className="flex-1 min-h-0" />
                        </>
                      ) : (
                        /* STATE 3: PATH LOADED / SAVED (SHOW PATH CARD + +ABILITY BUTTON + LINKED ELEMENTS + BOTTOM BUTTON) */
                        <>
                          {/* Master Path Card (Root Node) */}
                          <div
                            onClick={() => setActivePathSelection({ type: 'path' })}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer shrink-0 flex flex-col gap-2 ${
                              activePathSelection.type === 'path'
                                ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-950/40 ring-1 ring-blue-500'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🧭</span>
                                <div>
                                  <div className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                                    <span>{name.trim() || 'Untitled Path'}</span>
                                    <GuardrailBadge isValid={isNameValid} />
                                  </div>
                                  <div className="text-[11px] text-blue-300 font-medium">
                                    Category: {finalPathCat}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-200 border border-blue-500/40">
                                Root Node
                              </span>
                            </div>

                            {pathDescription.trim() && (
                              <div className="text-[11px] text-slate-400 line-clamp-2 italic">
                                "{pathDescription.trim()}"
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-2 mt-1">
                              <span className="flex items-center gap-1 text-blue-300 font-semibold">
                                <span>⚡</span> {linkedElements.length} Linked Elements
                              </span>
                              <span className="text-blue-400">Click to edit Path Identity ✎</span>
                            </div>
                          </div>

                          {/* +Ability Action Button */}
                          <button
                            type="button"
                            onClick={() => setActivePathSelection({ type: 'ability', category: activeAbilityCategory })}
                            className="w-full py-2 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0 bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/50 cursor-pointer font-extrabold"
                            title="Open Ability Studio to forge or link abilities to this Path"
                          >
                            <span>➕</span>
                            <span>Ability</span>
                          </button>

                          {/* Linked Path Elements Tree */}
                          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                            <div className="flex items-center justify-between shrink-0">
                              <span className="font-bold text-xs text-slate-300 flex items-center gap-1.5">
                                <span>🔗</span>
                                <span>Linked Elements ({linkedElements.length})</span>
                              </span>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                              {linkedElements.length === 0 ? (
                                <div className="p-6 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-center flex flex-col items-center gap-2 text-slate-500">
                                  <span className="text-2xl">🧭</span>
                                  <p className="text-xs">No abilities or proficiencies linked yet.</p>
                                  <p className="text-[11px] text-slate-600">
                                    Click <strong className="text-blue-400">+Ability</strong> above to forge new abilities or link existing catalog elements.
                                  </p>
                                </div>
                              ) : (
                                linkedElements.map((el, idx) => {
                                  const elKey = el.element_name || el.name || `el_${idx}`;
                                  const elType = el.element_type || el.type || 'power';
                                  const isFree = Boolean(el.is_free || el.isFree);

                                  const typeLabels: Record<string, { label: string; color: string; icon: string }> = {
                                    power: { label: 'Power', color: 'bg-rose-950/60 border-rose-500/40 text-rose-300', icon: '⚡' },
                                    skill: { label: 'Skill', color: 'bg-amber-950/60 border-amber-500/40 text-amber-300', icon: '🎯' },
                                    skillset: { label: 'Skillset', color: 'bg-blue-950/60 border-blue-500/40 text-blue-300', icon: '📚' },
                                    trait: { label: 'Trait', color: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300', icon: '🧬' },
                                    weapon_skill: { label: 'Weapon Sk', color: 'bg-orange-950/60 border-orange-500/40 text-orange-300', icon: '⚔️' },
                                    armor_skill: { label: 'Armor Sk', color: 'bg-amber-950/60 border-amber-500/40 text-amber-300', icon: '🥋' },
                                    shield_skill: { label: 'Shield Sk', color: 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300', icon: '🛡️' },
                                  };
                                  const meta = typeLabels[elType] || { label: elType, color: 'bg-slate-800 text-slate-300 border-slate-700', icon: '✨' };

                                  return (
                                    <div
                                      key={`${elKey}_${idx}`}
                                      className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2 shadow-sm"
                                    >
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-xs">{meta.icon}</span>
                                          <span className="font-bold text-slate-100 text-xs truncate">{elKey}</span>
                                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${meta.color}`}>
                                            {meta.label}
                                          </span>
                                        </div>
                                        {el.details && (
                                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                            {el.details}
                                          </div>
                                        )}
                                      </div>

                                      {/* S-Tier Pill Switch: [ 1 AP | Free ] */}
                                      <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-lg flex items-center gap-0.5 shadow-inner shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleLinkedElementFree(idx, false)}
                                          className={`py-1 px-2 text-[10px] font-bold rounded transition-all cursor-pointer ${
                                            !isFree
                                              ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                          }`}
                                          title="Costs standard 1 AP to acquire"
                                        >
                                          1 AP
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleLinkedElementFree(idx, true)}
                                          className={`py-1 px-2 text-[10px] font-bold rounded transition-all cursor-pointer ${
                                            isFree
                                              ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                          }`}
                                          title="Granted free upon selecting this Path"
                                        >
                                          Free
                                        </button>
                                      </div>

                                      {/* Unlink Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveLinkedElement(idx)}
                                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                                        title="Unlink from Path"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Bottom Forge / Update Path Button */}
                          <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Status:</span>
                              {editingItem ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                  Editing Path
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-mono font-bold">New Path Creation</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={handleSubmit}
                              disabled={!isFormValid || isSubmitting}
                              className={`w-full py-2.5 px-4 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center justify-center gap-2 select-none shadow-md ${
                                isFormValid && !isSubmitting
                                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40 cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                              }`}
                            >
                              <AnvilIcon className="w-4 h-4" />
                              <span>
                                {isSubmitting
                                  ? 'Forging...'
                                  : editingItem
                                  ? 'Update Path Archetype'
                                  : 'Forge Path to My Creations'}
                              </span>
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    /* STANDALONE ABILITY MODE */
                    <div className="flex-1 flex flex-col gap-3 min-h-0">
                      <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-indigo-200 text-xs leading-relaxed">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-indigo-300">
                          <span>⚡</span>
                          <span>Standalone Ability Mode</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          You are forging an independent Ability (Power, Skill, Skillset, or Trait) that is not linked to any Path. It will be saved directly into your Custom Elements library and can be equipped by any character or linked to a Path later.
                        </p>
                      </div>

                      <div className="font-bold text-xs text-slate-300 flex items-center gap-1.5">
                        <span>⚒️</span>
                        <span>Ability Preview</span>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getCategoryEmoji(activeAbilityCategory)}</span>
                            <div>
                              <div className="font-bold text-slate-100 text-sm">
                                {abilityFormName.trim() || 'Untitled Ability'}
                              </div>
                              <div className="text-[10px] font-mono text-indigo-300">
                                {activeAbilityCategory.toUpperCase()}
                              </div>
                            </div>
                          </div>
                          <GuardrailBadge isValid={abilityFormName.trim().length > 0} />
                        </div>

                        {activeAbilityCategory === 'power' && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              Action: {abilityFormAction}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              Usage: {abilityFormUsage}
                            </span>
                          </div>
                        )}

                        {activeAbilityCategory === 'skill' && (
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 font-bold">
                              {abilityFormSkillAttribute}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {abilityFormSkillDiscipline}
                            </span>
                          </div>
                        )}

                        {activeAbilityCategory === 'skillset' && (
                          <div className="text-[11px] text-slate-400">
                            Skills: {abilityFormSkillsetSkills.filter(Boolean).join(', ') || 'None selected'}
                          </div>
                        )}

                        {abilityFormEffect.trim() && (
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap">
                            {abilityFormEffect.trim()}
                          </div>
                        )}
                      </div>

                      <div className="mt-auto shrink-0 pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!isFormValid || isSubmitting}
                          className={`w-full py-2.5 px-4 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center justify-center gap-2 select-none shadow-md ${
                            isFormValid && !isSubmitting
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-indigo-900/40 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                          }`}
                        >
                          <AnvilIcon className="w-4 h-4" />
                          <span>
                            {isSubmitting
                              ? 'Forging...'
                              : editingItem
                              ? `Update ${activeAbilityCategory.charAt(0).toUpperCase() + activeAbilityCategory.slice(1)}`
                              : `Forge ${activeAbilityCategory.charAt(0).toUpperCase() + activeAbilityCategory.slice(1)} to My Creations`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : creationType === 'chaos_gem' ? (
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-slate-950/50 p-4 overflow-hidden gap-3">
              {/* Studio Tab Switcher */}
              <div className="shrink-0 flex items-center justify-between gap-2">
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl inline-flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setGemStudioTab('current')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                      gemStudioTab === 'current'
                        ? 'bg-violet-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🛠️ Current
                  </button>
                  {isMetaScapeDesigner && (
                    <button
                      type="button"
                      onClick={() => setGemStudioTab('canon')}
                      className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                        gemStudioTab === 'canon'
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      👑 Canon
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setGemStudioTab('mine')}
                    className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                      gemStudioTab === 'mine'
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    🎨 My Creations ({myGemCount})
                  </button>
                </div>

                {editingItem && gemStudioTab === 'current' && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition cursor-pointer shrink-0"
                    title="Start a new blank creation"
                  >
                    + New Blank
                  </button>
                )}
              </div>

              {gemStudioTab === 'mine' ? (
                /* MY CREATIONS LIST VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
                    {filteredMyGems.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                        <span className="text-2xl mb-1.5">💎</span>
                        <p className="font-semibold text-slate-400">No chaos gem creations found</p>
                        <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                          Click "Current" above to forge your first custom Chaos Gem.
                        </p>
                      </div>
                    ) : (
                      filteredMyGems.map((item) => {
                        const isItemEditing = editingItem?.id === item.id || canonicalSelectedId === String(item.id);
                        const itemEffect = item.effect || '';

                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 shadow-sm cursor-pointer ${
                              isItemEditing
                                ? 'bg-violet-950/30 border-violet-500/80 ring-1 ring-violet-500/40'
                                : 'bg-slate-950/70 border-slate-800/80 hover:border-violet-500/40 hover:bg-slate-900/80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm shrink-0">💎</span>
                                <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase shrink-0">
                                  CHAOS GEM
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handlePopulateCanonicalChaosGem(item);
                                    setGemStudioTab('current');
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                                  title="Edit this chaos gem"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirmTarget({
                                      type: 'chaos_gem',
                                      id: item.id || item.name,
                                      name: item.name,
                                    })
                                  }
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                                  title="Delete this chaos gem"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                              <span className="px-1.5 py-0.2 bg-violet-950/80 border border-violet-500/30 text-violet-300 font-bold rounded">
                                {item.action || 'F'}
                              </span>
                              <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-500/30 text-amber-300 font-bold rounded">
                                {item.usage || '3 Uses'}
                              </span>
                            </div>
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

              ) : (isMetaScapeDesigner && gemStudioTab === 'canon') ? (
                /* SUPABASE CANONICAL VIEW */
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
                  {/* Dropdown Selector Header */}
                  <div className="flex items-center justify-between text-xs text-slate-300 font-bold shrink-0 gap-2">
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span>👑</span>
                      <span>Master Chaos Gems ({canonicalChaosGems.length})</span>
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
                        placeholder="Search chaos gems..."
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
                      onClick={handleNewMasterEntry}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer shrink-0"
                    >
                      + New Master Gem
                    </button>
                  </div>

                  {/* Dropdown Selector */}
                  <select
                    value={canonicalSelectedId || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        handleResetForm();
                        return;
                      }
                      const gem = (canonicalChaosGems || []).find((g) => String(g.id) === val || g.name === val);
                      if (gem) handlePopulateCanonicalChaosGem(gem);
                    }}
                    className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer shrink-0"
                  >
                    <option value="">
                      {canonicalSearchQuery
                        ? filteredCanonicalChaosGems.length > 0
                          ? `-- Filtered (${filteredCanonicalChaosGems.length} matches) --`
                          : `-- No matches for "${canonicalSearchQuery}" --`
                        : `-- Choose Canonical Chaos Gem (${canonicalChaosGems.length}) --`}
                    </option>
                    {filteredCanonicalChaosGems.map((g) => (
                      <option key={g.id || g.name} value={g.id || g.name}>
                        {g.name}
                      </option>
                    ))}
                  </select>

                  {/* Canonical Item Preview Card */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
                    {canonicalSelectedId ? (
                      <div className="p-3.5 rounded-xl border border-amber-500/40 bg-slate-900/90 flex flex-col gap-2.5 shadow-lg shadow-amber-950/20">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">💎</span>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-100 text-xs truncate">{name || 'Unnamed Chaos Gem'}</h4>
                              <span className="text-[10px] text-amber-400 font-mono">👑 Master ID: {canonicalSelectedId}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/40 font-bold">{action || 'F'}</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">{usage || '3 Uses'}</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-300 flex flex-col gap-1.5">
                          {effect && (
                            <div className="p-2 rounded bg-slate-950/90 border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                              {effect}
                            </div>
                          )}
                          {notes && (
                            <p className="text-[10px] text-slate-400 italic font-serif border-t border-slate-800/80 pt-1">
                              "{notes}"
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                          {workshopMode === 'designer' ? (
                            <>
                              <span className="text-[10px] text-slate-400 italic">
                                Edit details in the right pane, then click Save.
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
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-amber-300/80 font-medium">
                                👑 Official Canonical Item
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const gem = (canonicalChaosGems || []).find((g) => String(g.id) === String(canonicalSelectedId) || g.name === canonicalSelectedId);
                                  if (gem) handleLoadTemplateIntoForge('chaos_gem', gem);
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shrink-0"
                                title="Load as customizable template into forge"
                              >
                                <span>🛠️</span>
                                <span>+ Load into Forge</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                        <span className="text-2xl mb-1.5">👑</span>
                        <p className="font-semibold text-slate-400">No Master Gem Selected</p>
                        <p className="text-[10px] mt-0.5 text-slate-600 max-w-xs">
                          {workshopMode === 'designer'
                            ? 'Pick an existing master gem from the dropdown above to view, edit, or delete it, or click "+ New Master Gem" to author a new canonical entry.'
                            : 'Pick an official canonical gem from the dropdown above to view its stats or load it into your forge as a starting template.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* CURRENT ITEM LIVE CARD PREVIEW VIEW */
                <>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
                    <div className="p-4 rounded-xl bg-slate-900 border border-violet-500/40 shadow-xl flex flex-col gap-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="font-bold text-violet-200 text-sm font-outfit flex items-center gap-1.5">
                          <span>💎</span>
                          <span>{name || 'Unnamed Chaos Gem'}</span>
                        </span>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/40 font-bold">{action || 'F'}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">{usage || '3 Uses'}</span>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                        {effect || 'Socket activation effect will render here...'}
                      </div>
                      {notes && <p className="text-[10px] text-slate-500 italic font-serif">"{notes}"</p>}
                    </div>
                  </div>

                  {/* Bottom Forge Button */}
                  <div className="shrink-0 flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Status:</span>
                      {editingItem ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40">
                          Editing Creation
                        </span>
                      ) : canonicalSelectedId ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Editing Master Record
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">New Creation</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!isFormValid || isSubmitting}
                      className={`w-full py-2.5 px-4 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center justify-center gap-2 select-none shadow-md ${
                        isFormValid && !isSubmitting
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-900/40 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <AnvilIcon className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'Forging...'
                          : isMetaScapeDesigner && canonicalSelectedId
                          ? 'Update Canonical Master Record 👑'
                          : isMetaScapeDesigner
                          ? 'Forge New Canonical Master Record 👑'
                          : editingItem
                          ? 'Update Chaos Gem'
                          : 'Forge Chaos Gem to My Creations'}
                      </span>
                    </button>
                  </div>
                </>
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

              {/* MODE 1: CHASSIS EDITOR */}
              {activeStudioSelection.type === 'chassis' && (
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

                  {/* Chassis Category Pill Switch */}
                  <div className="flex flex-col gap-1.5">
                    <span className="font-bold text-slate-300">Chassis Category</span>
                    <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setStudioChassisType('weapon')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          studioChassisType === 'weapon'
                            ? 'bg-orange-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        ⚔️ Weapons
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioChassisType('armor')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          studioChassisType === 'armor'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        🥋 Armor
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioChassisType('shield')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          studioChassisType === 'shield'
                            ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        🛡️ Shields
                      </button>
                      <button
                        type="button"
                        onClick={() => setStudioChassisType('supplies')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          studioChassisType === 'supplies'
                            ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        🎒 Supplies
                      </button>
                    </div>
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
                      <span>{isSubmitting ? 'Forging...' : editingItem ? 'Update Gear' : 'Forge Gear to My Creations'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 2: MOD EDITOR */}
              {activeStudioSelection.type === 'mod' && (
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
                    {exactCanonModMatch && !isModFormExactMatch && (
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
                      disabled={!modFormName.trim()}
                      className={`py-2 px-5 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                        modFormName.trim()
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>💾 Done Editing Mod</span>
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
              {activeStudioSelection.type === 'power' && (
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
                    {exactCanonPowerMatch && !isPowerFormExactMatch && (
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
                      disabled={!powerFormName.trim() || !powerFormEffect.trim()}
                      className={`py-2 px-5 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                        powerFormName.trim() && powerFormEffect.trim()
                          ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>💾 Done Editing Power</span>
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

              {/* VIEW IDLE: BLANK CANVAS UNTIL PATH CHOSEN */}
              {pathStudioMode === 'path' && isPathIdle && (
                <div className="flex-1 min-h-0" />
              )}

              {/* VIEW A: PATH IDENTITY CONFIGURATION */}
              {pathStudioMode === 'path' && !isPathIdle && activePathSelection.type === 'path' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧭</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          Path Editor
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Configure Path archetype name, discipline category, lore description, and genres.
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-blue-300 font-mono text-[10px] font-bold">
                      Mode: Path Editor
                    </span>
                  </div>

                  {/* Path Name */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Path Name</span>
                        <GuardrailBadge isValid={isNameValid} />
                        <InfoTooltip text="Enter the archetype name of this Path (e.g. Shadowblade, Chronomancer)." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Voidstalker, Iron Sentinel, Starweaver..."
                      className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-blue-400 shadow-inner"
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

                  {/* Path Category */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Path Category / Discipline</span>
                        <GuardrailBadge isValid={isPathCategoryValid} />
                        <InfoTooltip text="Select the core discipline or theme for this Path." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={pathCategory}
                        onChange={(e) => setPathCategory(e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-blue-400 font-medium"
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
                          placeholder="Type custom category name..."
                          className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-blue-500/60 outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Path Description & Lore */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Description & Lore</span>
                        <GuardrailBadge isValid={pathDescription.trim().length > 0} />
                        <InfoTooltip text="Flavor text describing this path's training, role, and thematic identity." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <textarea
                      value={pathDescription}
                      onChange={(e) => setPathDescription(e.target.value)}
                      rows={3}
                      placeholder="e.g. Masters of planar shifting and void manipulation, the Voidstalker steps between shadows..."
                      className="bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-blue-400 shadow-inner resize-y min-h-[60px] leading-relaxed"
                      required
                    />
                  </div>

                  {/* Genres */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-300">Genres</span>
                        <GuardrailBadge isValid={isGenresValid} />
                        <InfoTooltip text="Select all genres where this Path is permitted." />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">Required</span>
                    </div>
                    <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap">
                      {GENRE_OPTIONS.map((g) => {
                        const isSelected = selectedGenres.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleToggleGenre(g.id)}
                            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
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

                  {/* Status & Save / Update Path Button (Image 3 relocated from Left Pane) */}
                  <div className="shrink-0 flex flex-col gap-2 pt-3 border-t border-slate-800/80 mt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Status:</span>
                      <span className={`text-[10px] font-mono font-bold ${isPathReadyForAbilities ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isPathReadyForAbilities ? 'Ready to Save' : 'Incomplete Requirements'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!isPathReadyForAbilities || isSubmitting}
                      className={`w-full py-2.5 px-4 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center justify-center gap-2 select-none shadow-md ${
                        isPathReadyForAbilities && !isSubmitting
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40 cursor-pointer font-extrabold'
                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                      }`}
                      title={
                        !isPathReadyForAbilities
                          ? 'Fill in Path Name, Category, Description, and Genre before saving'
                          : workshopMode === 'designer'
                          ? canonicalSelectedId
                            ? 'Update canonical Path in Master Database and propagate changes to characters'
                            : 'Create new canonical Path in Master Database'
                          : editingItem
                          ? 'Update Path Archetype'
                          : 'Save Path Archetype to unlock adding abilities'
                      }
                    >
                      <AnvilIcon className="w-4 h-4" />
                      <span>
                        {isSubmitting
                          ? 'Saving Path...'
                          : workshopMode === 'designer'
                          ? canonicalSelectedId
                            ? 'Update Master Path 👑'
                            : 'Create Master Path 👑'
                          : editingItem
                          ? 'Update Path Archetype'
                          : 'Save Path'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW B: ABILITY STUDIO */}
              {((pathStudioMode === 'path' && !isPathIdle && activePathSelection.type === 'ability') ||
                pathStudioMode === 'standalone') && (
                <div className="flex flex-col gap-4">
                  {/* Studio Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <div>
                        <h3 className="font-outfit font-extrabold text-sm text-slate-100">
                          {pathStudioMode === 'path'
                            ? `Link Abilities to ${name.trim() || 'Path'}`
                            : 'Standalone Ability Studio'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {pathStudioMode === 'path'
                            ? 'Forge new abilities or link existing powers, skills, and traits to this Path archetype.'
                            : 'Craft standalone abilities ready for character equipping or future path linkage.'}
                        </p>
                      </div>
                    </div>

                    {pathStudioMode === 'path' && (
                      <button
                        type="button"
                        onClick={() => setActivePathSelection({ type: 'path' })}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>⬅️</span>
                        <span>Path Identity</span>
                      </button>
                    )}
                  </div>

                  {/* Ability Categories 2-Row Switch */}
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-300">Ability Category</span>

                    {/* Row 1: Creatable Abilities */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('power')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'power'
                            ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>⚡</span>
                        <span>Powers</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('skill')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'skill'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>🎯</span>
                        <span>Skills</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('skillset')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'skillset'
                            ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>📚</span>
                        <span>Skillsets</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('trait')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'trait'
                            ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>🧬</span>
                        <span>Traits</span>
                      </button>
                    </div>

                    {/* Row 2: Equipment Skills (Pick-Existing-Only) */}
                    <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('weapon')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'weapon'
                            ? 'bg-orange-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>⚔️</span>
                        <span>Weapon Sk</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('armor')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'armor'
                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>🥋</span>
                        <span>Armor Sk</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveAbilityCategory('shield')}
                        className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          activeAbilityCategory === 'shield'
                            ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <span>🛡️</span>
                        <span>Shield Sk</span>
                      </button>
                    </div>
                  </div>

                  {/* If a Gear Skill category is selected */}
                  {(activeAbilityCategory === 'weapon' || activeAbilityCategory === 'armor' || activeAbilityCategory === 'shield') ? (
                    <div className="flex flex-col gap-3">
                      {/* Authoritative Gear Skills Banner */}
                      <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
                        <span className="text-base shrink-0">ℹ️</span>
                        <p className="leading-relaxed">
                          Gear proficiencies link existing equipment skills to this Path. To forge a new weapon, armor, or shield skill, use the ⚙️ Gear studio above.
                        </p>
                      </div>

                      {/* Search input */}
                      <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          value={abilityCatalogSearch}
                          onChange={(e) => setAbilityCatalogSearch(e.target.value)}
                          placeholder={`Search ${activeAbilityCategory} catalog...`}
                          className="bg-transparent text-slate-100 text-xs outline-none w-full"
                        />
                      </div>

                      {/* Catalog List */}
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {filteredPathCatalogItems.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-xs">
                            No matching {activeAbilityCategory} proficiencies found.
                          </div>
                        ) : (
                          filteredPathCatalogItems.map((item) => {
                            const isAlreadyLinked = linkedElements.some(
                              (el) => (el.name || el.element_name || '').toLowerCase().trim() === item.name.toLowerCase().trim()
                            );
                            return (
                              <div
                                key={item.id}
                                className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono truncate">{item.details}</span>
                                </div>

                                {isAlreadyLinked ? (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shrink-0">
                                    ✓ Linked
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleLinkExistingItem(item)}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shrink-0"
                                  >
                                    + Link to Path
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Creatable Ability Modes (power, skill, skillset, trait) */
                    <div className="flex flex-col gap-4">
                      {/* Source Mode Switch: Forge New vs Pick Existing */}
                      <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => setAbilitySourceMode('forge_new')}
                          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            abilitySourceMode === 'forge_new'
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <span>➕</span>
                          <span>Forge New {activeAbilityCategory.charAt(0).toUpperCase() + activeAbilityCategory.slice(1)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbilitySourceMode('pick_existing')}
                          className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            abilitySourceMode === 'pick_existing'
                              ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-slate-200 border border-transparent'
                          }`}
                        >
                          <span>🔍</span>
                          <span>Pick Existing</span>
                        </button>
                      </div>

                      {abilitySourceMode === 'pick_existing' ? (
                        /* PICK EXISTING CATALOG LIST */
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-700">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={abilityCatalogSearch}
                              onChange={(e) => setAbilityCatalogSearch(e.target.value)}
                              placeholder={`Search ${activeAbilityCategory}s...`}
                              className="bg-transparent text-slate-100 text-xs outline-none w-full"
                            />
                          </div>

                          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                            {filteredPathCatalogItems.length === 0 ? (
                              <div className="p-6 text-center text-slate-500 text-xs">
                                No matching {activeAbilityCategory}s found.
                              </div>
                            ) : (
                              filteredPathCatalogItems.map((item) => {
                                const isAlreadyLinked = linkedElements.some(
                                  (el) => (el.name || el.element_name || '').toLowerCase().trim() === item.name.toLowerCase().trim()
                                );
                                return (
                                  <div
                                    key={item.id}
                                    className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex flex-col min-w-0">
                                      <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono truncate">{item.details}</span>
                                    </div>

                                    {pathStudioMode === 'path' && (
                                      isAlreadyLinked ? (
                                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shrink-0">
                                          ✓ Linked
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleLinkExistingItem(item)}
                                          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shrink-0"
                                        >
                                          + Link to Path
                                        </button>
                                      )
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ) : (
                        /* FORGE NEW ABILITY FORM */
                        <div className="flex flex-col gap-3">
                          {/* Ability Name */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-300">
                                  {activeAbilityCategory.charAt(0).toUpperCase() + activeAbilityCategory.slice(1)} Name
                                </span>
                                <GuardrailBadge isValid={abilityFormName.trim().length > 0} />
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">Required</span>
                            </div>
                            <input
                              type="text"
                              value={abilityFormName}
                              onChange={(e) => setAbilityFormName(e.target.value)}
                              placeholder={`e.g. Void Blade, Astral Surge, Shadow Veil...`}
                              className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-purple-400 shadow-inner"
                            />
                          </div>

                          {/* POWER FIELDS */}
                          {activeAbilityCategory === 'power' && (
                            <div className="flex flex-col gap-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-slate-300">Action</span>
                                  <select
                                    value={abilityFormAction}
                                    onChange={(e) => setAbilityFormAction(e.target.value)}
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
                                    value={abilityFormUsage}
                                    onChange={(e) => setAbilityFormUsage(e.target.value)}
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
                                    const isSelected = abilityFormPowerReady === cat.id;
                                    return (
                                      <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setAbilityFormPowerReady(cat.id)}
                                        className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
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

                              {/* Effect with Quick Insert Presets */}
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-300">Effect Rules</span>
                                    <GuardrailBadge isValid={abilityFormEffect.trim().length > 0} />
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono">Required</span>
                                </div>

                                {/* Preset Tags */}
                                <div className="flex flex-col gap-1.5 mb-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">Attributes:</span>
                                    {ATTRIBUTE_CHIPS.map((chip) => (
                                      <button
                                        key={chip}
                                        type="button"
                                        onClick={() => insertAbilityTextAtCursor(chip)}
                                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-mono transition cursor-pointer"
                                      >
                                        {chip}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">AoE:</span>
                                    {AOE_PRESETS.map((aoe) => (
                                      <button
                                        key={aoe.id}
                                        type="button"
                                        onClick={() => insertAbilityTextAtCursor(aoe.text)}
                                        className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[10px] font-mono transition cursor-pointer"
                                      >
                                        {aoe.id}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <textarea
                                  ref={abilityEffectTextareaRef}
                                  value={abilityFormEffect}
                                  onChange={(e) => setAbilityFormEffect(e.target.value)}
                                  rows={3}
                                  placeholder="e.g. Rng Medium; AoE 2r; 2d6 Burn. Target gains Prone."
                                  className="bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-purple-400 shadow-inner resize-none font-mono leading-relaxed"
                                />
                              </div>
                            </div>
                          )}

                          {/* SKILL FIELDS */}
                          {activeAbilityCategory === 'skill' && (
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-slate-300">Governing Attribute</span>
                                <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                                  {ATTRIBUTE_CHIPS.map((attr) => {
                                    const isSelected = abilityFormSkillAttribute === attr;
                                    return (
                                      <button
                                        key={attr}
                                        type="button"
                                        onClick={() => setAbilityFormSkillAttribute(attr)}
                                        className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                                          isSelected
                                            ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                        }`}
                                      >
                                        {attr}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-slate-300">Discipline</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <select
                                    value={abilityFormSkillDiscipline}
                                    onChange={(e) => setAbilityFormSkillDiscipline(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:border-purple-400"
                                  >
                                    {availableSkillDisciplines.map((disc) => (
                                      <option key={disc} value={disc}>
                                        {disc}
                                      </option>
                                    ))}
                                    <option value="CUSTOM_NEW">+ Custom Discipline...</option>
                                  </select>
                                  {abilityFormSkillDiscipline === 'CUSTOM_NEW' && (
                                    <input
                                      type="text"
                                      value={abilityFormSkillDisciplineNewText}
                                      onChange={(e) => setAbilityFormSkillDisciplineNewText(e.target.value)}
                                      placeholder="Type custom discipline..."
                                      className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-purple-500/60 outline-none"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* SKILLSET FIELDS */}
                          {activeAbilityCategory === 'skillset' && (
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-300">Included Skills (min 2)</span>
                                <button
                                  type="button"
                                  onClick={() => setAbilityFormSkillsetSkills((prev) => [...prev, ''])}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 transition cursor-pointer"
                                >
                                  + Add Skill
                                </button>
                              </div>

                              <div className="space-y-2">
                                {abilityFormSkillsetSkills.map((sk, sIdx) => (
                                  <div key={sIdx} className="flex items-center gap-2">
                                    <select
                                      value={sk}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setAbilityFormSkillsetSkills((prev) => {
                                          const next = [...prev];
                                          next[sIdx] = val;
                                          return next;
                                        });
                                      }}
                                      className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-xl outline-none focus:border-purple-400"
                                    >
                                      <option value="">-- Select Skill --</option>
                                      {availableSkillsCatalog.map((catalogSkill) => (
                                        <option key={catalogSkill} value={catalogSkill}>
                                          {catalogSkill}
                                        </option>
                                      ))}
                                    </select>
                                    {abilityFormSkillsetSkills.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAbilityFormSkillsetSkills((prev) => prev.filter((_, i) => i !== sIdx));
                                        }}
                                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* TRAIT FIELDS */}
                          {activeAbilityCategory === 'trait' && (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-300">Passive / Trait Effect</span>
                                <span className="text-[10px] text-slate-500 font-mono">Required</span>
                              </div>
                              <textarea
                                value={abilityFormEffect}
                                onChange={(e) => setAbilityFormEffect(e.target.value)}
                                rows={3}
                                placeholder="e.g. Gain +1 to initiative. You can see in total magical darkness."
                                className="bg-slate-950 text-slate-100 text-xs p-3 rounded-xl border border-slate-700 outline-none focus:border-purple-400 shadow-inner resize-none leading-relaxed"
                              />
                            </div>
                          )}

                          {/* Notes */}
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-300">Notes</span>
                            <textarea
                              rows={2}
                              value={abilityFormNotes}
                              onChange={(e) => setAbilityFormNotes(e.target.value)}
                              placeholder="Optional notes or rule notes..."
                              className="bg-slate-950 text-slate-100 text-xs px-3 py-2 rounded-xl border border-slate-700 outline-none focus:border-amber-400 font-serif italic resize-y min-h-[48px]"
                            />
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                            {pathStudioMode === 'path' ? (
                              <button
                                type="button"
                                onClick={handleSaveAndLinkAbility}
                                disabled={!abilityFormName.trim() || isSubmitting}
                                className={`py-2 px-4 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                                  abilityFormName.trim() && !isSubmitting
                                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white cursor-pointer shadow-purple-950/40'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>⚡ Save & Link to Path</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!isFormValid || isSubmitting}
                                className={`py-2 px-4 rounded-xl font-outfit font-extrabold text-xs transition-all flex items-center gap-1.5 select-none shadow-md ${
                                  isFormValid && !isSubmitting
                                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white cursor-pointer shadow-indigo-950/40'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                                }`}
                              >
                                <AnvilIcon className="w-4 h-4" />
                                <span>{workshopMode === 'designer' ? '👑 Forge to Master Database' : '⚡ Forge to My Creations'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

        {/* Universal Modal Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800/80 shrink-0 flex items-center justify-end">
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
