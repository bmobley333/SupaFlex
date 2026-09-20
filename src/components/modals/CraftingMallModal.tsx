// src/components/modals/CraftingMallModal.tsx
// Unified Player's Workshop: Master Modal Blueprint 2-Pane Architecture (My Creations + Clone from Player)

import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, Plus, AlertCircle, RefreshCw, Pencil, ArrowLeft, Search, Mail } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { 
  CustomCreationItem, 
  CustomCreationType, 
  Power, 
  MagicItem, 
  AbilitySlot, 
  WeaponSlot, 
  ArmorData, 
  ShieldData, 
  SimpleGearItem, 
  SupabaseChaosGem 
} from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';
import { getPowerReadyCategory } from '../../utils/readyMatrixSchedule';
import { ChaosGauntletSocketModal } from './ChaosGauntletSocketModal';

interface CraftingMallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenForge?: (itemToEdit?: CustomCreationItem) => void;
}

export const CraftingMallModal: React.FC<CraftingMallModalProps> = ({ 
  isOpen, 
  onClose, 
  onOpenForge 
}) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const playerName = useCharacterStore((state) => state.playerName);
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const saveActiveCharacter = useCharacterStore((state) => state.saveActiveCharacter);

  const isGm = activeRole === 'gm';

  // Category Filter State (Matching Image 3 from Forge)
  const [selectedCategory, setSelectedCategory] = useState<'all' | CustomCreationType>('all');
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');

  // Personal Items State (Left Pane)
  const [personalItems, setPersonalItems] = useState<CustomCreationItem[]>([]);
  const [allowCloning, setAllowCloning] = useState<boolean>(true);
  const [isLoadingPersonal, setIsLoadingPersonal] = useState(false);

  // Target Player Cloning State (Right Pane)
  const [targetEmail, setTargetEmail] = useState('');
  const [targetItems, setTargetItems] = useState<CustomCreationItem[]>([]);
  const [isSearchingTarget, setIsSearchingTarget] = useState(false);
  const [targetPrivacyStatus, setTargetPrivacyStatus] = useState<'idle' | 'allowed' | 'private' | 'not_found'>('idle');

  // Socketing Gem State
  const [socketingGem, setSocketingGem] = useState<SupabaseChaosGem | null>(null);

  // General Feedback Toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load personal creations
  const loadPersonalData = async () => {
    if (!isOpen || !playerEmail) return;
    setIsLoadingPersonal(true);
    try {
      const personal = await gameApi.getPersonalCustomItems(playerEmail);
      setPersonalItems(personal);
    } catch (err: any) {
      console.error('[CraftingMallModal] Error loading personal items:', err);
    } finally {
      setIsLoadingPersonal(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPersonalData();
      if (playerEmail) {
        gameApi.getUserProfile(playerEmail).then((prof) => {
          if (prof && typeof prof.allow_cloning === 'boolean') {
            setAllowCloning(prof.allow_cloning);
          }
        });
      }
    }
  }, [isOpen, playerEmail]);

  // Privacy Toggle Handler
  const handleToggleCloning = async (newVal: boolean) => {
    const prevVal = allowCloning;
    setAllowCloning(newVal);
    try {
      if (playerEmail) {
        await gameApi.updateProfilePrivacy(playerEmail, newVal);
        setFeedback({
          type: 'success',
          message: newVal
            ? '🧬 Workshop creations set to Allow Cloning (visible to other players).'
            : '🔒 Workshop creations set to Private Vault (hidden from other players).',
        });
      }
    } catch (err: any) {
      setAllowCloning(prevVal);
      setFeedback({
        type: 'error',
        message: 'Failed to update workshop privacy setting.',
      });
    }
  };

  // Search target email for clonable items
  const handleSearchTargetEmail = async () => {
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      setTargetItems([]);
      setTargetPrivacyStatus('idle');
      return;
    }
    setIsSearchingTarget(true);
    try {
      const profile = await gameApi.getUserProfile(email);
      if (!profile) {
        const items = await gameApi.getPersonalCustomItems(email);
        if (items.length === 0) {
          setTargetPrivacyStatus('not_found');
          setTargetItems([]);
        } else {
          setTargetPrivacyStatus('allowed');
          setTargetItems(items);
        }
      } else {
        if (profile.allow_cloning === false && !isGm) {
          setTargetPrivacyStatus('private');
          setTargetItems([]);
        } else {
          setTargetPrivacyStatus('allowed');
          const items = await gameApi.getPersonalCustomItems(email);
          setTargetItems(items);
        }
      }
    } catch (err: any) {
      console.error('[CraftingMallModal] Error loading target player vault:', err);
      setTargetPrivacyStatus('not_found');
      setTargetItems([]);
    } finally {
      setIsSearchingTarget(false);
    }
  };

  // Clone an item into personal library
  const handleCloneItem = async (item: CustomCreationItem) => {
    if (!playerEmail) {
      setFeedback({ type: 'error', message: 'You must have a player email to clone items.' });
      return;
    }

    try {
      const clonedPayload: Partial<CustomCreationItem> = {
        name: item.name,
        type: item.type,
        category: item.category,
        author_name: playerName || playerEmail,
        author_email: playerEmail,
        party_id: activePartyId || null,
        gm_approved: isGm,
        item_data: {
          ...item.item_data,
          cloned_from: targetEmail.trim(),
          cloned_from_author: item.author_name,
          cloned_at: new Date().toISOString(),
        },
        notes: item.notes,
        is_promoted: false,
      };

      await gameApi.saveCustomItem(clonedPayload);
      setFeedback({
        type: 'success',
        message: `🧬 Cloned '${item.name}' into your My Creations library!`,
      });
      loadPersonalData();
    } catch (err: any) {
      console.error('[CraftingMallModal] Error cloning item:', err);
      setFeedback({ type: 'error', message: 'Failed to clone item.' });
    }
  };

  // Delete an item from personal library
  const handleDeleteItem = async (item: CustomCreationItem) => {
    if (!window.confirm(`Delete '${item.name}' from your personal workshop library?`)) return;

    try {
      await gameApi.deleteCustomItem(item.id);
      setFeedback({
        type: 'success',
        message: `Deleted '${item.name}' from your personal creations.`,
      });
      loadPersonalData();
    } catch (err: any) {
      console.error('[CraftingMallModal] Error deleting item:', err);
      setFeedback({ type: 'error', message: 'Failed to delete creation.' });
    }
  };

  // Import to active Character Sheet
  const handleAcceptToHero = (item: CustomCreationItem) => {
    if (!activeCharacter) {
      setFeedback({ type: 'error', message: 'No active hero selected. Please open a character sheet first.' });
      return;
    }

    try {
      const { type, name, category, author_name, item_data, notes } = item;
      const action = item_data?.action || 'A';
      const usage = item_data?.usage || '1-Enc';
      const effect = item_data?.effect || '';

      if (type === 'power') {
        const powerObj: Power = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: `${name} v1`,
          base_name: name,
          version: 1,
          action,
          usage,
          effect,
          category: 'Custom',
          created_at: new Date().toISOString(),
        };

        const powerSlotObj: AbilitySlot = {
          select: true,
          name: `${name} v1`,
          base_name: name,
          version: 1,
          action: (action.toUpperCase() as any) || 'A',
          usage,
          effect,
          checked: [false, false, false],
          is_readied: false,
          ready: getPowerReadyCategory(powerObj),
        };

        updateActiveSheetData((prev) => {
          const existingVault = Array.isArray(prev.character_power_codex) ? prev.character_power_codex : [];
          const existingCustom = prev.custom_powers || [];
          return {
            ...prev,
            custom_powers: [...existingCustom, powerObj],
            character_power_codex: [...existingVault, powerSlotObj],
          };
        });
        saveActiveCharacter();
      } else if (type === 'exotic' || type === 'artifact' || type === 'relic' || type === 'hardware') {
        const magicItemObj: MagicItem = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name,
          action,
          usage,
          effect,
          category: category || (type === 'artifact' ? '🔮 Artifact' : '🧿 Exotic'),
          is_hardware: type === 'hardware',
          cost: item_data?.cost || (type === 'artifact' ? 'Artifact' : '10g'),
          slot_weight: (getItemSlotWeight({ name, category: category || '' }) as 1 | 2 | 3 | 4),
          source: `Workshop (${author_name})`,
          created_at: new Date().toISOString(),
          notes,
        };

        updateActiveSheetData((prev) => {
          const currentVault: MagicItem[] = Array.isArray(prev.character_vault) ? prev.character_vault : [];
          const existingCustom = prev.custom_magic_items || [];
          return {
            ...prev,
            custom_magic_items: [...existingCustom, magicItemObj],
            character_vault: [...currentVault, magicItemObj],
          };
        });
        saveActiveCharacter();
      } else if (type === 'skillset') {
        const skills = item_data?.skills || [];
        updateActiveSheetData((prev) => {
          const existingSkillsets = prev.known_skillsets || [];
          const existingCustom = prev.custom_skillsets || [];
          const customEntry = {
            id: Date.now(),
            name,
            skills,
            source: `Workshop (${author_name})`,
            created_at: new Date().toISOString(),
          };
          return {
            ...prev,
            custom_skillsets: [...existingCustom, customEntry as any],
            known_skillsets: Array.from(new Set([...existingSkillsets, name])),
          };
        });
        saveActiveCharacter();
      } else if (type === 'skill') {
        const formattedSkill = item_data?.formatted_skill || `${name} ${item_data?.attribute || '✨'}`;
        updateActiveSheetData((prev) => {
          const existingIndividual = prev.known_individual_skills || [];
          return {
            ...prev,
            known_individual_skills: Array.from(new Set([...existingIndividual, formattedSkill])),
          };
        });
        saveActiveCharacter();
      } else if (type === 'weapon') {
        const weaponObj: WeaponSlot = {
          id: `wpn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: name,
          sk: true,
          mhs: item_data?.type?.startsWith('H') ? 'H' : item_data?.type?.startsWith('S') ? 'S' : 'M',
          atk: item_data?.atk || '💪',
          dmg: item_data?.dmg || '💪',
          max_blk: item_data?.max_block || 'n/a',
          notes: notes || undefined,
        };
        updateActiveSheetData((prev) => {
          const existingWeapons = prev.weapons || [];
          return {
            ...prev,
            weapons: [...existingWeapons, weaponObj],
          };
        });
        saveActiveCharacter();
      } else if (type === 'armor') {
        const numericAr = parseInt((item_data?.ar || '1').replace(/[^\d]/g, ''), 10) || 1;
        const armorObj: ArmorData = {
          id: `arm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: name,
          requirement: item_data?.requirement || '💪 4',
          ar: numericAr,
          mr: item_data?.mr || '👣0',
          cost: item_data?.cost || '1g',
          notes: notes || undefined,
          sk: true,
        };
        updateActiveSheetData((prev) => {
          const existingWardrobe = prev.wardrobe || [];
          return {
            ...prev,
            wardrobe: [...existingWardrobe, armorObj],
          };
        });
        saveActiveCharacter();
      } else if (type === 'shield') {
        const shieldObj: ShieldData = {
          id: `shd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: name,
          requirement: item_data?.requirement || '💪 4',
          max_block: item_data?.max_block || '4',
          mr_adjustment: item_data?.mr || '👣0',
          cost: item_data?.cost || '1g',
          notes: notes || undefined,
          sk: true,
          equipped: false,
        };
        updateActiveSheetData((prev) => {
          const existingArmory = prev.armory || [];
          return {
            ...prev,
            armory: [...existingArmory, shieldObj],
          };
        });
        saveActiveCharacter();
      } else if (type === 'gear') {
        const gearObj: SimpleGearItem = {
          id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          qty: 1,
          name: name,
          category: item_data?.category || 'Adventuring',
          cost: item_data?.cost || '1s',
          notes: notes || undefined,
        };
        updateActiveSheetData((prev) => {
          const existingGear = prev.simple_gear || [];
          return {
            ...prev,
            simple_gear: [...existingGear, gearObj],
          };
        });
        saveActiveCharacter();
      } else if (type === 'chaos_gem') {
        const incomingGem: SupabaseChaosGem = {
          name,
          action: 'F',
          usage: '3',
          effect: item_data?.effect || '',
          genres: item_data?.genres,
          notes: notes,
        };
        setSocketingGem(incomingGem);
        return;
      }

      setFeedback({
        type: 'success',
        message: `✅ Successfully imported '${name}' into ${activeCharacter.name}'s sheet!`,
      });
    } catch (err: any) {
      console.error('[CraftingMallModal] Error importing to sheet:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to import creation.'}` });
    }
  };

  if (!isOpen) return null;

  // Filter personal items by category & search
  const filteredPersonalItems = personalItems.filter((item) => {
    if (selectedCategory !== 'all' && item.type !== selectedCategory) return false;
    if (personalSearchQuery.trim()) {
      const q = personalSearchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchEffect = (item.item_data?.effect || '').toLowerCase().includes(q);
      if (!matchName && !matchEffect) return false;
    }
    return true;
  });

  // Filter target player items by category
  const filteredTargetItems = targetItems.filter((item) => {
    if (selectedCategory !== 'all' && item.type !== selectedCategory) return false;
    return true;
  });

  const getCategoryEmoji = (t: string) => {
    switch (t) {
      case 'power': return '🔥';
      case 'path': return '🧭';
      case 'skill': return '🎓';
      case 'skillset': return '🎓';
      case 'trait': return '🧬';
      case 'chaos_gem': return '💎';
      case 'weapon': return '⚔️';
      case 'armor': return '🥋';
      case 'shield': return '🛡️';
      case 'gear': return '⚙️';
      case 'exotic': return '🧿';
      case 'artifact': return '🔮';
      case 'kit': return '📦';
      default: return '✨';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-outfit">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-6xl shadow-2xl shadow-amber-950/50 flex flex-col h-[90vh] max-h-[92vh] overflow-hidden">
        
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-lg flex items-center justify-center">
              🛠️
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide flex items-center gap-2">
                Workshop
                {isGm ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    👑 GM Mode
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
                Manage personal creations & clone authorized content from players.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Dyslexia-Friendly Multi-Option Pill Switch for Personal Vault Privacy */}
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => handleToggleCloning(false)}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !allowCloning
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Private Vault: Keep your custom creations private to your account"
              >
                🔒 Private Vault
              </button>
              <button
                type="button"
                onClick={() => handleToggleCloning(true)}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  allowCloning
                    ? 'bg-emerald-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
                title="Allow Cloning: Allow players to view and clone your creations"
              >
                🧬 Allow Cloning
              </button>
            </div>

            {/* Launch Forge Button */}
            {onOpenForge && (
              <button
                type="button"
                onClick={() => onOpenForge()}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/40 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Forge New Creation</span>
              </button>
            )}

            {/* Top Right Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Workshop"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MASTER CATEGORY FILTER BAR (Image 3: Two Symmetrical Rows Matching Forge) */}
        {/* ========================================================================= */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 shrink-0 flex flex-col gap-1.5">
          {/* Row 1: Capabilities */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-20 shrink-0">Capabilities:</span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'power' ? 'all' : 'power')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'power'
                    ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🔥 Powers
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'path' ? 'all' : 'path')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'path'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧭 Paths
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'skill' ? 'all' : 'skill')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'skill'
                    ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🎓 Skills
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'skillset' ? 'all' : 'skillset')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'skillset'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🎓 Skillsets
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'trait' ? 'all' : 'trait')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'trait'
                    ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧬 Traits
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'chaos_gem' ? 'all' : 'chaos_gem')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'chaos_gem'
                    ? 'bg-violet-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                💎 Chaos Gems
              </button>
            </div>
          </div>

          {/* Row 2: Equipment */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider w-20 shrink-0">Equipment:</span>
            <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'weapon' ? 'all' : 'weapon')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'weapon'
                    ? 'bg-orange-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                ⚔️ Weapons
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'armor' ? 'all' : 'armor')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'armor'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🥋 Armor
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'shield' ? 'all' : 'shield')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'shield'
                    ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🛡️ Shields
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'gear' ? 'all' : 'gear')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'gear'
                    ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                ⚙️ Gear
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'exotic' ? 'all' : 'exotic')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'exotic'
                    ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🧿 Exotics
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'artifact' ? 'all' : 'artifact')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'artifact'
                    ? 'bg-fuchsia-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🔮 Artifacts
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === 'kit' ? 'all' : 'kit')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'kit'
                    ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                📦 Kits
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-700 text-amber-300 border border-amber-500/40 shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                🌐 All
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2-PANE GRID BODY                                                          */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 flex-1 min-h-0 overflow-hidden bg-slate-950/40">
          
          {/* ----------------------------------------------------------------------- */}
          {/* PANE 1 (LEFT): MY CREATIONS                                             */}
          {/* ----------------------------------------------------------------------- */}
          <div className="lg:col-span-6 flex flex-col min-h-0 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <span>👤</span>
                  <span>My Creations</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                    {filteredPersonalItems.length}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={personalSearchQuery}
                    onChange={(e) => setPersonalSearchQuery(e.target.value)}
                    placeholder="Filter my items..."
                    className="pl-8 pr-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 w-36 sm:w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadPersonalData}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                  title="Refresh personal creations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPersonal ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* List of Personal Items */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 flex flex-col gap-2.5">
              {filteredPersonalItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">📦</span>
                  <p className="font-semibold text-slate-400">No creations found</p>
                  <p className="text-[11px] mt-1 text-slate-600 max-w-xs">
                    {selectedCategory !== 'all' 
                      ? `No ${selectedCategory} creations found in your library.`
                      : 'You have not created or cloned any items yet. Click "Forge New Creation" to begin.'}
                  </p>
                </div>
              ) : (
                filteredPersonalItems.map((item) => {
                  const action = item.item_data?.action || 'A';
                  const usage = item.item_data?.usage || '1-Enc';
                  const effect = item.item_data?.effect || '';
                  const cost = item.item_data?.cost || '1g';
                  const clonedFrom = item.item_data?.cloned_from;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/30 transition flex flex-col gap-2 shadow-sm"
                    >
                      {/* Item Header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-base shrink-0">{getCategoryEmoji(item.type)}</span>
                          <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase shrink-0">
                            {item.type}
                          </span>
                        </div>

                        {/* Action Icons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {activeCharacter && (
                            <button
                              type="button"
                              onClick={() => handleAcceptToHero(item)}
                              className="px-2 py-0.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-[10px] font-bold rounded-md transition cursor-pointer"
                              title="Import directly into active hero's sheet"
                            >
                              📥 To Sheet
                            </button>
                          )}
                          {onOpenForge && (
                            <button
                              type="button"
                              onClick={() => onOpenForge(item)}
                              className="p-1 rounded-md text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                              title="Edit in Forge"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            title="Delete creation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Chips / Stats */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        {item.type === 'power' || item.type === 'exotic' || item.type === 'artifact' ? (
                          <>
                            <span className="px-1.5 py-0.2 bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold rounded">
                              {action}
                            </span>
                            <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-bold rounded">
                              {usage}
                            </span>
                          </>
                        ) : null}
                        {cost && (
                          <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-500/30 text-amber-300 font-bold rounded">
                            {cost}
                          </span>
                        )}
                        {clonedFrom && (
                          <span className="px-1.5 py-0.2 bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-medium rounded truncate max-w-[200px]" title={`Cloned from ${clonedFrom}`}>
                            🧬 Cloned: {clonedFrom}
                          </span>
                        )}
                      </div>

                      {/* Effect Preview */}
                      {effect && (
                        <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] text-slate-300 font-mono leading-relaxed line-clamp-3">
                          {effect}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* PANE 2 (RIGHT): CLONE FROM PLAYER                                       */}
          {/* ----------------------------------------------------------------------- */}
          <div className="lg:col-span-6 flex flex-col min-h-0 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex flex-col gap-2 pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <span>🧬</span>
                  <span>Clone from Player</span>
                  {targetItems.length > 0 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300">
                      {filteredTargetItems.length}
                    </span>
                  )}
                </span>
              </div>

              {/* Universal Email Search Input */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchTargetEmail();
                    }}
                    placeholder="Enter player/GM email (e.g. friend@gmail.com)..."
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchTargetEmail}
                  disabled={isSearchingTarget}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-sm"
                >
                  <Search className={`w-3.5 h-3.5 ${isSearchingTarget ? 'animate-spin' : ''}`} />
                  <span>Load Vault</span>
                </button>
              </div>
            </div>

            {/* Target Vault Output Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto mt-3 pr-1 flex flex-col gap-2.5">
              {targetPrivacyStatus === 'idle' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">✉️</span>
                  <p className="font-semibold text-slate-400">Load Player Creations</p>
                  <p className="text-[11px] mt-1 text-slate-600 max-w-xs">
                    Type any SupaFlex player or GM email above to inspect their clonable library.
                  </p>
                </div>
              ) : targetPrivacyStatus === 'private' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-amber-400/80 text-xs bg-amber-950/20 rounded-xl border border-amber-500/30 m-4">
                  <span className="text-3xl mb-2">🔒</span>
                  <p className="font-bold text-amber-300">Vault Set to Private</p>
                  <p className="text-[11px] mt-1 text-amber-200/70 max-w-xs">
                    This player has marked their workshop library as Private Vault. Their creations cannot be viewed or cloned.
                  </p>
                </div>
              ) : targetPrivacyStatus === 'not_found' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="font-semibold text-slate-400">No creations found</p>
                  <p className="text-[11px] mt-1 text-slate-600 max-w-xs">
                    No custom items found for '{targetEmail}'. Verify the email address.
                  </p>
                </div>
              ) : filteredTargetItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                  <span className="text-3xl mb-2">📂</span>
                  <p className="font-semibold text-slate-400">No matching items</p>
                  <p className="text-[11px] mt-1 text-slate-600 max-w-xs">
                    This player has no creations matching the active category filter '{selectedCategory}'.
                  </p>
                </div>
              ) : (
                filteredTargetItems.map((item) => {
                  const action = item.item_data?.action || 'A';
                  const usage = item.item_data?.usage || '1-Enc';
                  const effect = item.item_data?.effect || '';
                  const cost = item.item_data?.cost || '1g';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 transition flex items-start gap-2.5 shadow-sm"
                    >
                      {/* Left Arrow Clone Button (FIRST Element on Each Entry) */}
                      <button
                        type="button"
                        onClick={() => handleCloneItem(item)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-indigo-950/50 cursor-pointer transition shrink-0 mt-0.5"
                        title="Clone this item into your My Creations"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Clone</span>
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-base shrink-0">{getCategoryEmoji(item.type)}</span>
                            <span className="font-bold text-slate-200 text-xs truncate">{item.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase shrink-0">
                              {item.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 italic truncate max-w-[120px]">
                            by {item.author_name}
                          </span>
                        </div>

                        {/* Chips / Stats */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          {item.type === 'power' || item.type === 'exotic' || item.type === 'artifact' ? (
                            <>
                              <span className="px-1.5 py-0.2 bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold rounded">
                                {action}
                              </span>
                              <span className="px-1.5 py-0.2 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 font-bold rounded">
                                {usage}
                              </span>
                            </>
                          ) : null}
                          {cost && (
                            <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-500/30 text-amber-300 font-bold rounded">
                              {cost}
                            </span>
                          )}
                        </div>

                        {/* Effect Preview */}
                        {effect && (
                          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] text-slate-300 font-mono leading-relaxed line-clamp-3">
                            {effect}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* FOOTER & DONE BUTTON                                                      */}
        {/* ========================================================================= */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          {/* Feedback Toast */}
          <div className="flex-1 min-w-0 pr-4">
            {feedback && (
              <div
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 truncate animate-fadeIn ${
                  feedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span className="truncate">{feedback.message}</span>
              </div>
            )}
          </div>

          {/* Standardized Done Button */}
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-6 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm shrink-0"
            title="Close Workshop"
          >
            Done
          </button>
        </div>

      </div>

      {/* Socketing Modal for Chaos Gems */}
      {socketingGem && (
        <ChaosGauntletSocketModal
          isOpen={true}
          onClose={() => setSocketingGem(null)}
          incomingGem={socketingGem}
          onSocketSuccess={(gemName) => {
            setFeedback({ type: 'success', message: `💎 Successfully socketed '${gemName}'!` });
            setSocketingGem(null);
          }}
        />
      )}
    </div>
  );
};
