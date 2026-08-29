import React, { useState, useEffect } from 'react';
import { X, Send, Check, Trash2, Plus, AlertCircle, RefreshCw, Crown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationItem, CustomCreationType, Power, MagicItem, AbilitySlot, WeaponSlot, ArmorData, ShieldData, SimpleGearItem, SupabaseChaosGem } from '../../types/game';
import { getItemSlotWeight } from '../../utils/magicSlotSchedule';
import { getPowerReadyCategory } from '../../utils/readyMatrixSchedule';
import { ChaosGauntletSocketModal } from './ChaosGauntletSocketModal';

interface CraftingMallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorkshop?: () => void;
}

export const CraftingMallModal: React.FC<CraftingMallModalProps> = ({ isOpen, onClose, onOpenWorkshop }) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const saveActiveCharacter = useCharacterStore((state) => state.saveActiveCharacter);

  const isGm = activeRole === 'gm';

  const [activeTab, setActiveTab] = useState<'my_creations' | 'party_mall' | 'showcase' | 'submissions'>('my_creations');
  const [typeFilter, setTypeFilter] = useState<'all' | CustomCreationType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [personalItems, setPersonalItems] = useState<CustomCreationItem[]>([]);
  const [partyItems, setPartyItems] = useState<CustomCreationItem[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<CustomCreationItem[]>([]);
  const [submissionItems, setSubmissionItems] = useState<CustomCreationItem[]>([]);
  const [socketingGem, setSocketingGem] = useState<SupabaseChaosGem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const [personal, all] = await Promise.all([
        playerEmail ? gameApi.getPersonalCustomItems(playerEmail) : Promise.resolve([]),
        gameApi.getAllCustomItems(),
      ]);

      setPersonalItems(personal);
      setShowcaseItems(all.filter((item) => item.is_promoted));

      if (activePartyId) {
        // Party items: filtered by party_id and (gm_approved OR author is active GM)
        const [partyResult, pendingResult] = await Promise.all([
          gameApi.getPartyCustomItems(activePartyId),
          isGm ? gameApi.getPendingPartySubmissions(activePartyId) : Promise.resolve([]),
        ]);
        setPartyItems(partyResult);
        setSubmissionItems(pendingResult);
      } else {
        setPartyItems([]);
        setSubmissionItems([]);
      }
    } catch (err: any) {
      console.error('[CraftingMallModal] Error loading items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, playerEmail, activePartyId]);

  if (!isOpen) return null;

  // Active items list based on tab
  const currentList =
    activeTab === 'my_creations'
      ? personalItems
      : activeTab === 'party_mall'
      ? partyItems
      : activeTab === 'showcase'
      ? showcaseItems
      : submissionItems;

  const filteredItems = currentList.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(query);
      const matchAuthor = item.author_name.toLowerCase().includes(query);
      const matchEffect = (item.item_data?.effect || '').toLowerCase().includes(query);
      if (!matchName && !matchAuthor && !matchEffect) return false;
    }
    return true;
  });

  const handleAcceptToHero = (item: CustomCreationItem) => {
    if (!activeCharacter) {
      setFeedback({ type: 'error', message: 'No active hero selected. Please select a character sheet first.' });
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
      } else if (type === 'relic' || type === 'hardware') {
        const magicItemObj: MagicItem = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name,
          action,
          usage,
          effect,
          category: category || (type === 'relic' ? '🍺 Minor' : 'Custom Hardware'),
          is_hardware: type === 'hardware',
          cost: item_data?.cost,
          slot_weight: (getItemSlotWeight({ name, category: category || '' }) as 1 | 2 | 3 | 4),
          source: `Crafting Mall (${author_name})`,
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
            source: `Crafting Mall (${author_name})`,
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
        message: `✅ Successfully imported '${name}' into ${activeCharacter.name}'s sheet! (0 AP)`,
      });
    } catch (err: any) {
      console.error('[CraftingMallModal] Error importing to sheet:', err);
      setFeedback({ type: 'error', message: `❌ Error: ${err.message || 'Failed to import creation.'}` });
    }
  };

  const handleSubmitToGm = async (item: CustomCreationItem) => {
    if (!activePartyId) {
      setFeedback({ type: 'error', message: 'You are not currently in an active party session.' });
      return;
    }

    try {
      await gameApi.updateCustomItem(item.id, {
        party_id: activePartyId,
        gm_approved: false,
      });

      setFeedback({
        type: 'success',
        message: `📤 Submitted '${item.name}' to Party [${activePartyId}] GM review queue!`,
      });
      loadData();
    } catch (err: any) {
      console.error('[CraftingMallModal] Error submitting to GM:', err);
      setFeedback({ type: 'error', message: 'Failed to submit to GM queue.' });
    }
  };

  const handleDeleteItem = async (item: CustomCreationItem) => {
    if (!window.confirm(`Delete '${item.name}' from your personal workshop library?`)) return;

    try {
      await gameApi.deleteCustomItem(item.id);
      setFeedback({
        type: 'success',
        message: `Deleted '${item.name}' from your personal creations.`,
      });
      loadData();
    } catch (err: any) {
      console.error('[CraftingMallModal] Error deleting item:', err);
      setFeedback({ type: 'error', message: 'Failed to delete creation.' });
    }
  };

  const handleApproveSubmission = async (item: CustomCreationItem) => {
    try {
      await gameApi.updateCustomItem(item.id, {
        gm_approved: true,
        approved_by_gm_email: playerEmail || undefined,
      });

      setFeedback({
        type: 'success',
        message: `👑 Approved '${item.name}' for Party [${activePartyId}]! It is now live in the Party Mall.`,
      });
      loadData();
    } catch (err: any) {
      console.error('[CraftingMallModal] Error approving submission:', err);
      setFeedback({ type: 'error', message: 'Failed to approve submission.' });
    }
  };

  const handleRejectSubmission = async (item: CustomCreationItem) => {
    if (!window.confirm(`Reject '${item.name}' and return it to ${item.author_name}'s personal library?`)) return;

    try {
      await gameApi.updateCustomItem(item.id, {
        party_id: null,
        gm_approved: false,
      });

      setFeedback({
        type: 'success',
        message: `Returned '${item.name}' to ${item.author_name}'s personal drafts.`,
      });
      loadData();
    } catch (err: any) {
      console.error('[CraftingMallModal] Error rejecting submission:', err);
      setFeedback({ type: 'error', message: 'Failed to reject submission.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-4xl shadow-2xl shadow-amber-950/50 flex flex-col h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-lg flex items-center justify-center">
              🛠️
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide flex items-center gap-2">
                Workshop
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  {isGm 
                    ? (activePartyId ? `👑 GM Mode: Party ${activePartyId}` : '👑 GM Mode') 
                    : (activePartyId ? `Party Room: ${activePartyId}` : 'Solo Mode')}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Browse personal craftings, party-approved creations, & master showcase items.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenWorkshop && (
              <button
                onClick={() => {
                  onOpenWorkshop();
                }}
                className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/50 text-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Forge New Creation</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Tabs (Multi-Option Pill Switch) */}
        <div className="px-6 pt-3 pb-2 bg-slate-950/40 border-b border-slate-800/80 shrink-0">
          <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setActiveTab('my_creations')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'my_creations'
                  ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              👤 My Creations ({personalItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('party_mall')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'party_mall'
                  ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🏛️ Party Mall ({partyItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('showcase')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'showcase'
                  ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              🌟 Hall of Fame ({showcaseItems.length})
            </button>
            {isGm && (
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'submissions'
                    ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                    : 'text-rose-400 hover:text-rose-200 border border-transparent'
                }`}
              >
                📥 Player Submissions ({submissionItems.length})
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Contextual Subtitle Banner */}
        <div className="px-6 py-2 bg-slate-950/70 border-b border-slate-800/80 text-xs text-center shrink-0">
          {activeTab === 'my_creations' && (
            <p className="text-amber-300/90 font-semibold tracking-wide flex items-center justify-center gap-1.5 animate-fadeIn">
              <span>👤</span>
              <span>Items & Abilities I've forged.</span>
            </p>
          )}
          {activeTab === 'party_mall' && (
            <p className="text-indigo-300/90 font-semibold tracking-wide flex items-center justify-center gap-1.5 animate-fadeIn">
              <span>🏛️</span>
              <span>GM approved Craftings available to the GM's party.</span>
            </p>
          )}
          {activeTab === 'showcase' && (
            <p className="text-emerald-300/90 font-semibold tracking-wide flex items-center justify-center gap-1.5 animate-fadeIn">
              <span>🌟</span>
              <span>Designer approved for ALL players. These are now incorporated fully into SupaFlex and available to everyone.</span>
            </p>
          )}
          {activeTab === 'submissions' && (
            <p className="text-rose-300/90 font-semibold tracking-wide flex items-center justify-center gap-1.5 animate-fadeIn">
              <span>📥</span>
              <span>Review & approve party member custom drafts for this campaign's Party Mall.</span>
            </p>
          )}
        </div>

        {/* Secondary Filter & Search Bar */}
        <div className="px-6 py-2.5 bg-slate-950/30 border-b border-slate-800/60 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          {/* Sub-Filters */}
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', 'power', 'power_table', 'relic', 'hardware', 'skill', 'skillset', 'weapon', 'armor', 'shield', 'gear', 'chaos_gem'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  typeFilter === t
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {t === 'all'
                  ? '🌐 All'
                  : t === 'power'
                  ? '🔥 Powers'
                  : t === 'power_table'
                  ? '📜 Tables'
                  : t === 'relic'
                  ? '🏺 Relics'
                  : t === 'hardware'
                  ? '⚙️ Hardware'
                  : t === 'skill'
                  ? '🎯 Skills'
                  : t === 'skillset'
                  ? '🎓 Skillsets'
                  : t === 'weapon'
                  ? '⚔️ Weapons'
                  : t === 'armor'
                  ? '🧥 Armor'
                  : t === 'shield'
                  ? '🛡️ Shields'
                  : t === 'gear'
                  ? '🎒 Gear'
                  : '💎 Chaos Gems'}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, author, or effect..."
              className="bg-slate-950 text-slate-100 text-xs px-3 py-1.5 rounded-xl border border-slate-700 outline-none focus:border-amber-400 w-64"
            />
            <button
              onClick={loadData}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-amber-300 transition-colors"
              title="Refresh creations list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-3 p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold animate-fadeIn shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Items Grid Body */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Loading Crafting Mall catalog...</span>
            </div>
          ) : filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredItems.map((item) => {
                const isPower = item.type === 'power';
                const isTable = item.type === 'power_table';
                const isRelic = item.type === 'relic';
                const isHardware = item.type === 'hardware';
                const isSkill = item.type === 'skill';
                const isSkillset = item.type === 'skillset';
                const isWeapon = item.type === 'weapon';
                const isArmor = item.type === 'armor';
                const isShield = item.type === 'shield';
                const isGear = item.type === 'gear';
                const isChaosGem = item.type === 'chaos_gem';

                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 rounded-xl flex flex-col justify-between gap-2.5 transition-all shadow-md"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-outfit font-extrabold text-sm text-slate-100 truncate">
                            {item.name}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                              isPower
                                ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                                : isTable
                                ? 'bg-violet-950 text-violet-300 border-violet-500/40'
                                : isRelic
                                ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                                : isHardware
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                                : isSkill
                                ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                                : isSkillset
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                : isWeapon
                                ? 'bg-orange-950 text-orange-300 border-orange-500/40'
                                : isArmor
                                ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                                : isShield
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-500/40'
                                : isGear
                                ? 'bg-teal-950 text-teal-300 border-teal-500/40'
                                : 'bg-violet-950 text-violet-300 border-violet-500/40'
                            }`}
                          >
                            {isPower
                              ? '🔥 Power'
                              : isTable
                              ? '📜 Table'
                              : isRelic
                              ? '🏺 Relic'
                              : isHardware
                              ? '⚙️ Hardware'
                              : isSkill
                              ? '🎯 Skill'
                              : isSkillset
                              ? '🎓 Skillset'
                              : isWeapon
                              ? '⚔️ Weapon'
                              : isArmor
                              ? '🧥 Armor'
                              : isShield
                              ? '🛡️ Shield'
                              : isGear
                              ? '🎒 Gear'
                              : '💎 Chaos Gem'}
                          </span>
                        </div>

                        {/* Attribution & Status Subtitle */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                          <span>By {item.author_name}</span>
                          {item.gm_approved && (
                            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                              • <Check className="w-3 h-3" /> GM Approved
                            </span>
                          )}
                          {item.is_promoted && (
                            <span className="text-amber-300 font-bold flex items-center gap-0.5">
                              • 🌟 Official Canon
                            </span>
                          )}
                          {item.item_data?.cost && (
                            <span className="text-cyan-300 font-mono font-bold">• {item.item_data.cost}</span>
                          )}
                        </div>
                      </div>

                      {/* Action & Usage Pill */}
                      {!isSkillset && !isSkill && !isWeapon && !isArmor && !isShield && !isGear && !isChaosGem && (
                        <div className="flex items-center gap-1 shrink-0">
                          {item.item_data?.action && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-amber-300">
                              {item.item_data.action}
                            </span>
                          )}
                          {item.item_data?.usage && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                              {item.item_data.usage}
                            </span>
                          )}
                        </div>
                      )}
                      {isChaosGem && (
                        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/40 font-bold">
                            F
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">
                            3 Uses
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Effect / Description */}
                    <div className="text-xs text-slate-300">
                      {isSkillset && item.item_data?.skills ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-bold">Included Skills:</span>
                          <div className="flex flex-wrap gap-1">
                            {item.item_data.skills.map((s: string) => (
                              <span key={s} className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-500/30 text-[10px]">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : isSkill ? (
                        <p className="text-[11px] leading-relaxed font-sans text-amber-200">
                          Assigned Attribute: <span className="font-bold">{item.item_data?.attribute || '✨'}</span>
                        </p>
                      ) : isWeapon ? (
                        <div className="flex flex-col gap-1 text-[11px] font-mono text-slate-300">
                          <div className="flex items-center justify-between">
                            <span>Type: <strong className="text-orange-300">{item.item_data?.type || 'Melee'}</strong></span>
                            <span>Req: <strong className="text-slate-200">{item.item_data?.requirement || '💪 4'}</strong></span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Atk: <strong className="text-amber-300">{item.item_data?.atk || '💪'}</strong></span>
                            <span>Dmg: <strong className="text-rose-300">{item.item_data?.dmg || '💪'}</strong></span>
                            <span>Blk: <strong className="text-cyan-300">{item.item_data?.max_block || 'n/a'}</strong></span>
                          </div>
                        </div>
                      ) : isArmor ? (
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                          <span>Req: <strong className="text-slate-200">{item.item_data?.requirement || '💪 4'}</strong></span>
                          <span>AR: <strong className="text-amber-300">{item.item_data?.ar || '1'}</strong></span>
                          <span>MR: <strong className="text-cyan-300">{item.item_data?.mr || '👣0'}</strong></span>
                        </div>
                      ) : isShield ? (
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                          <span>Req: <strong className="text-slate-200">{item.item_data?.requirement || '💪 4'}</strong></span>
                          <span>Blk: <strong className="text-amber-300">{item.item_data?.max_block || '4'}</strong></span>
                          <span>MR: <strong className="text-cyan-300">{item.item_data?.mr || '👣0'}</strong></span>
                        </div>
                      ) : isGear ? (
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                          <span>Category: <strong className="text-teal-300">{item.item_data?.category || 'Adventuring'}</strong></span>
                          <span>Cost: <strong className="text-amber-300">{item.item_data?.cost || '1s'}</strong></span>
                        </div>
                      ) : (
                        <p className="text-[11px] leading-relaxed font-sans">{item.item_data?.effect || 'No description provided.'}</p>
                      )}
                      {item.notes && (
                        <p className="text-[10px] text-slate-500 italic mt-1 font-serif">"{item.notes}"</p>
                      )}
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 gap-2 mt-1">
                      {activeTab === 'my_creations' && (
                        <div className="flex items-center gap-1.5">
                          {activePartyId && !item.gm_approved && (
                            <button
                              onClick={() => handleSubmitToGm(item)}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg border bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border-indigo-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                              title="Submit draft to active party GM for approval"
                            >
                              <Send className="w-3 h-3" />
                              <span>Submit to GM</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete creation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {activeTab === 'submissions' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApproveSubmission(item)}
                            className="px-3 py-1 text-xs font-bold rounded-lg border bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border-emerald-500/50 flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-300" />
                            <span>Approve to Party Mall</span>
                          </button>
                          <button
                            onClick={() => handleRejectSubmission(item)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg border bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-500/40 transition-colors cursor-pointer"
                          >
                            <span>Return to Drafts</span>
                          </button>
                        </div>
                      )}

                      {activeTab !== 'my_creations' && activeTab !== 'submissions' && <div />}

                      <button
                        onClick={() => handleAcceptToHero(item)}
                        className="px-3 py-1 text-xs font-bold rounded-lg border bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border-emerald-500/50 flex items-center gap-1 transition-all shadow-sm cursor-pointer ml-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isChaosGem ? 'Socket to Gauntlet' : `Accept to ${activeCharacter?.name ? `${activeCharacter.name}'s Sheet` : 'Sheet (0 AP)'}`}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs italic gap-1">
              <span>
                {activeTab === 'submissions'
                  ? 'No pending player submissions found for this campaign room.'
                  : `No creations found matching filters in ${
                      activeTab === 'my_creations' ? 'My Creations' : activeTab === 'party_mall' ? 'Party Mall' : 'Hall of Fame'
                    }.`}
              </span>
              {activeTab === 'my_creations' && (
                <button
                  onClick={() => {
                    if (onOpenWorkshop) onOpenWorkshop();
                  }}
                  className="text-amber-400 hover:underline font-bold not-italic mt-1"
                >
                  + Forge your first custom creation in Forge
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Status */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-outfit font-bold text-slate-300">
              Active Hero: {activeCharacter?.name || 'None Selected'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Volatile Chaos Gauntlet Socketing Modal */}
      <ChaosGauntletSocketModal
        isOpen={!!socketingGem}
        incomingGem={socketingGem}
        onClose={() => setSocketingGem(null)}
        onSocketSuccess={(gemName, slotName) => {
          setSocketingGem(null);
          setFeedback({
            type: 'success',
            message: `💎 Successfully socketed '${gemName}' into ${slotName}!`,
          });
        }}
      />
    </div>
  );
};
