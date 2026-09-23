// src/components/modals/CraftingMallModal.tsx
// Unified Player's Workshop: 3-Pillar Universal Hierarchy & Subscription Hub

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Trash2, 
  Pencil, 
  Search, 
  Mail, 
  AlertTriangle, 
  Check, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { 
  CustomCreationItem, 
  Power, 
  SupabaseTrait, 
  SupabaseSkill, 
  SupabasePath, 
  SupabaseChaosGem, 
  SupabaseWeapon, 
  SupabaseArmor, 
  SupabaseShield, 
  SupabaseSupply 
} from '../../types/game';

interface CraftingMallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenForge?: (itemToEdit?: CustomCreationItem) => void;
}

interface ItemToDelete {
  type: 'path' | 'power' | 'trait' | 'skill' | 'chaos_gem' | 'weapon' | 'armor' | 'shield' | 'supply';
  id: string | number;
  name: string;
}

export const CraftingMallModal: React.FC<CraftingMallModalProps> = ({ 
  isOpen, 
  onClose, 
  onOpenForge 
}) => {
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const playerName = useCharacterStore((state) => state.playerName);
  const activeRole = useCharacterStore((state) => state.activeRole);
  
  // Scoped Catalogs from Store
  const paths: SupabasePath[] = useCharacterStore((state) => state.paths) || [];
  const powers: Power[] = useCharacterStore((state) => state.powers) || [];
  const traits: SupabaseTrait[] = useCharacterStore((state) => state.traits) || [];
  const skills: SupabaseSkill[] = useCharacterStore((state) => state.skills) || [];
  const chaosGems: SupabaseChaosGem[] = useCharacterStore((state) => state.chaosGemsCatalog) || [];
  const weapons: SupabaseWeapon[] = useCharacterStore((state) => state.weaponsCatalog) || [];
  const armor: SupabaseArmor[] = useCharacterStore((state) => state.armorCatalog) || [];
  const shields: SupabaseShield[] = useCharacterStore((state) => state.shieldsCatalog) || [];
  const supplies: SupabaseSupply[] = useCharacterStore((state) => state.suppliesCatalog) || [];
  
  // Subscription State & Actions
  const playerSubscriptions: string[] = useCharacterStore((state) => state.playerSubscriptions) || [];
  const subscribeToAuthor = useCharacterStore((state) => state.subscribeToAuthor);
  const unsubscribeFromAuthor = useCharacterStore((state) => state.unsubscribeFromAuthor);
  const refreshCatalogs = useCharacterStore((state) => state.refreshCatalogs);

  const isGm = activeRole === 'gm';
  const cleanPlayerEmail = (playerEmail || '').toLowerCase().trim();
  const isMasterAccount = cleanPlayerEmail === 'metascapegame@gmail.com';

  // Modal State
  const [allowSubscriptions, setAllowSubscriptions] = useState<boolean>(true);
  const [personalSearchQuery, setPersonalSearchQuery] = useState('');
  const [subscribedSearchQuery, setSubscribedSearchQuery] = useState('');
  const [selectedAuthorFilter, setSelectedAuthorFilter] = useState<'all' | string>('all');
  
  // Subscribe Input & Feedback State
  const [targetEmailInput, setTargetEmailInput] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<{ type: 'error' | 'warning'; message: string } | null>(null);

  // Deletion Modal State
  const [itemToDelete, setItemToDelete] = useState<ItemToDelete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // General Toast Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Collapsible Section State (Default all expanded)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Load User Privacy Setting
  useEffect(() => {
    if (isOpen && cleanPlayerEmail) {
      gameApi.getUserProfile(cleanPlayerEmail).then((prof) => {
        if (prof) {
          const isAllowed = prof.allow_subscriptions ?? prof.allow_cloning ?? true;
          setAllowSubscriptions(isAllowed);
        }
      });
    }
  }, [isOpen, cleanPlayerEmail]);

  // Handle Privacy Toggle (KISS Multi-Option Pill Switch)
  const handleToggleSubscriptions = async (newVal: boolean) => {
    const prevVal = allowSubscriptions;
    setAllowSubscriptions(newVal);
    try {
      if (cleanPlayerEmail) {
        await gameApi.updateProfilePrivacy(cleanPlayerEmail, newVal);
        setFeedback({
          type: 'success',
          message: newVal
            ? '🔗 Workshop creations set to Allow Subscriptions (visible to subscribed players).'
            : '🔒 Workshop creations set to Private Vault (hidden from other players).',
        });
      }
    } catch (err: any) {
      setAllowSubscriptions(prevVal);
      setFeedback({
        type: 'error',
        message: 'Failed to update workshop privacy setting.',
      });
    }
  };

  // Subscribe Handler with Existence Verification
  const handleSubscribe = async () => {
    const emailToSub = targetEmailInput.trim().toLowerCase();
    if (!emailToSub) return;
    
    if (emailToSub === cleanPlayerEmail) {
      setSubscriptionError({
        type: 'warning',
        message: 'You cannot subscribe to your own Google account.',
      });
      return;
    }

    const alreadySubbed = playerSubscriptions.some(
      s => s.toLowerCase() === emailToSub
    );
    if (alreadySubbed) {
      setSubscriptionError({
        type: 'warning',
        message: `You are already subscribed to ${emailToSub}.`,
      });
      return;
    }

    setIsSubscribing(true);
    setSubscriptionError(null);

    try {
      const verification = await gameApi.verifyAccountExists(emailToSub);
      if (!verification.exists) {
        setSubscriptionError({
          type: 'error',
          message: `⚠️ Google Account "${emailToSub}" not found.`,
        });
        return;
      }

      if (!verification.allowSubscriptions && !isGm) {
        setSubscriptionError({
          type: 'warning',
          message: `🔒 "${emailToSub}" has set their vault to Private and is not accepting subscriptions.`,
        });
        return;
      }

      await subscribeToAuthor(emailToSub);
      setTargetEmailInput('');
      setFeedback({
        type: 'success',
        message: `Successfully subscribed to ${verification.playerName || emailToSub}!`,
      });
    } catch (err: any) {
      setSubscriptionError({
        type: 'error',
        message: 'Failed to subscribe. Please try again.',
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  // Unsubscribe Handler
  const handleUnsubscribe = async (authorEmail: string) => {
    const cleanAuthor = authorEmail.trim().toLowerCase();
    try {
      await unsubscribeFromAuthor(cleanAuthor);
      if (selectedAuthorFilter.toLowerCase() === cleanAuthor) {
        setSelectedAuthorFilter('all');
      }
      setFeedback({
        type: 'success',
        message: `Unsubscribed from ${cleanAuthor}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to unsubscribe from ${cleanAuthor}.`,
      });
    }
  };

  // Helper: Open Forge in active edit mode for a specific creation
  const handleEditItemInForge = (
    type: 'path' | 'power' | 'trait' | 'skill' | 'chaos_gem' | 'weapon' | 'armor' | 'shield' | 'supply',
    rawItem: any
  ) => {
    if (!onOpenForge) return;

    const baseMeta = {
      author_name: playerName || cleanPlayerEmail,
      author_email: cleanPlayerEmail,
      gm_approved: isMasterAccount,
      created_at: rawItem.created_at || new Date().toISOString(),
    };

    let forgeItem: CustomCreationItem;

    if (type === 'path') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'path',
        notes: rawItem.description,
        item_data: {
          category: rawItem.category || 'General',
          description: rawItem.description || '',
          linked_elements: rawItem.linked_elements || [],
        },
      };
    } else if (type === 'power') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'power',
        notes: rawItem.notes || rawItem.effect,
        item_data: {
          action: rawItem.action || 'AM',
          usage: rawItem.usage || '1-Enc',
          effect: rawItem.effect || '',
          ready_category: rawItem.category || 'primary_arsenal',
          genres: rawItem.genres || [],
          path: rawItem.path || 'Universal',
          notes: rawItem.notes || '',
        },
      };
    } else if (type === 'trait') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'trait',
        notes: rawItem.notes,
        item_data: {
          effect: rawItem.effect || '',
          genres: rawItem.genres || [],
          path: rawItem.path || 'Universal',
          notes: rawItem.notes || '',
        },
      };
    } else if (type === 'skill') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'skill',
        notes: rawItem.notes,
        item_data: {
          attribute: rawItem.attribute || '💪',
          discipline: rawItem.discipline || 'General',
          skillset: rawItem.skillset || [],
          path: rawItem.path || 'Universal',
          notes: rawItem.notes || '',
        },
      };
    } else if (type === 'chaos_gem') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'chaos_gem',
        notes: rawItem.notes,
        item_data: {
          action: rawItem.action || 'F',
          usage: rawItem.usage || '1-Enc',
          effect: rawItem.effect || '',
          genres: rawItem.genres || [],
          notes: rawItem.notes || '',
        },
      };
    } else if (type === 'weapon') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'weapon',
        item_data: {
          chassis_type: 'weapon',
          ...rawItem,
        },
      };
    } else if (type === 'armor') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'armor',
        item_data: {
          chassis_type: 'armor',
          ...rawItem,
        },
      };
    } else if (type === 'shield') {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'shield',
        item_data: {
          chassis_type: 'shield',
          ...rawItem,
        },
      };
    } else {
      forgeItem = {
        ...baseMeta,
        id: String(rawItem.id ?? rawItem.name),
        name: rawItem.name,
        type: 'gear',
        item_data: {
          chassis_type: 'supplies',
          ...rawItem,
        },
      };
    }

    onOpenForge(forgeItem);
  };

  // Direct Deletion Execution
  const handleExecuteDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const { type, id, name } = itemToDelete;
      let ok = false;
      if (type === 'path') ok = await gameApi.deleteCanonicalPath(id);
      else if (type === 'power') ok = await gameApi.deleteCanonicalPower(id);
      else if (type === 'trait') ok = await gameApi.deleteCanonicalTrait(id);
      else if (type === 'skill') ok = await gameApi.deleteCanonicalSkill(id);
      else if (type === 'chaos_gem') ok = await gameApi.deleteCanonicalChaosGem(id);
      else if (type === 'weapon') ok = await gameApi.deleteCanonicalWeapon(id);
      else if (type === 'armor') ok = await gameApi.deleteCanonicalArmor(id);
      else if (type === 'shield') ok = await gameApi.deleteCanonicalShield(id);
      else if (type === 'supply') ok = await gameApi.deleteCanonicalGear(id);

      if (ok) {
        await refreshCatalogs();
        setFeedback({ type: 'success', message: `🗑️ Successfully deleted "${name}".` });
      } else {
        setFeedback({ type: 'error', message: `Failed to delete "${name}".` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error executing delete.' });
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  // =========================================================================
  // DATA DERIVATION: LEFT PANE ("My Creations")
  // =========================================================================
  const myData = useMemo(() => {
    const isOwner = (o?: string | null) => (o || '').toLowerCase().trim() === cleanPlayerEmail;

    const myPaths = paths.filter((p: SupabasePath) => isOwner(p.owner));
    const myPowers = powers.filter((p: Power) => isOwner(p.owner));
    const myTraits = traits.filter((t: SupabaseTrait) => isOwner(t.owner));
    const mySkills = skills.filter((s: SupabaseSkill) => isOwner(s.owner));
    const myGems = chaosGems.filter((g: SupabaseChaosGem) => isOwner(g.owner));
    const myWeapons = weapons.filter((w: SupabaseWeapon) => isOwner(w.owner));
    const myArmor = armor.filter((a: SupabaseArmor) => isOwner(a.owner));
    const myShields = shields.filter((s: SupabaseShield) => isOwner(s.owner));
    const mySupplies = supplies.filter((g: SupabaseSupply) => isOwner(g.owner));

    const totalCount = 
      myPaths.length + 
      myPowers.length + 
      myTraits.length + 
      mySkills.length + 
      myGems.length + 
      myWeapons.length + 
      myArmor.length + 
      myShields.length + 
      mySupplies.length;

    return {
      paths: myPaths,
      powers: myPowers,
      traits: myTraits,
      skills: mySkills,
      gems: myGems,
      weapons: myWeapons,
      armor: myArmor,
      shields: myShields,
      supplies: mySupplies,
      totalCount,
    };
  }, [paths, powers, traits, skills, chaosGems, weapons, armor, shields, supplies, cleanPlayerEmail]);

  // =========================================================================
  // DATA DERIVATION: RIGHT PANE ("Subscriptions")
  // =========================================================================
  const subscribedData = useMemo(() => {
    const subscribedEmails = playerSubscriptions.map((s: string) => s.toLowerCase().trim());
    
    const isSubscribedOwner = (o?: string | null) => {
      if (!o) return false;
      const cleanO = o.toLowerCase().trim();
      if (selectedAuthorFilter !== 'all') {
        return cleanO === selectedAuthorFilter.toLowerCase().trim();
      }
      return subscribedEmails.includes(cleanO);
    };

    const subPaths = paths.filter((p: SupabasePath) => isSubscribedOwner(p.owner));
    const subPowers = powers.filter((p: Power) => isSubscribedOwner(p.owner));
    const subTraits = traits.filter((t: SupabaseTrait) => isSubscribedOwner(t.owner));
    const subSkills = skills.filter((s: SupabaseSkill) => isSubscribedOwner(s.owner));
    const subGems = chaosGems.filter((g: SupabaseChaosGem) => isSubscribedOwner(g.owner));
    const subWeapons = weapons.filter((w: SupabaseWeapon) => isSubscribedOwner(w.owner));
    const subArmor = armor.filter((a: SupabaseArmor) => isSubscribedOwner(a.owner));
    const subShields = shields.filter((s: SupabaseShield) => isSubscribedOwner(s.owner));
    const subSupplies = supplies.filter((g: SupabaseSupply) => isSubscribedOwner(g.owner));

    const totalCount = 
      subPaths.length + 
      subPowers.length + 
      subTraits.length + 
      subSkills.length + 
      subGems.length + 
      subWeapons.length + 
      subArmor.length + 
      subShields.length + 
      subSupplies.length;

    return {
      paths: subPaths,
      powers: subPowers,
      traits: subTraits,
      skills: subSkills,
      gems: subGems,
      weapons: subWeapons,
      armor: subArmor,
      shields: subShields,
      supplies: subSupplies,
      totalCount,
    };
  }, [
    paths, 
    powers, 
    traits, 
    skills, 
    chaosGems, 
    weapons, 
    armor, 
    shields, 
    supplies, 
    playerSubscriptions, 
    selectedAuthorFilter
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-7xl h-[92vh] max-h-[950px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* ========================================================================= */}
        {/* TOP MODAL HEADER                                                          */}
        {/* ========================================================================= */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black shrink-0 text-lg">
              🛠️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-100 font-outfit tracking-wide">
                  Workshop
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {cleanPlayerEmail || 'Guest'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage personal creations & subscriptions to other players' creations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Launch Forge Button */}
            {onOpenForge && (
              <button
                type="button"
                onClick={() => onOpenForge()}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-950/40 shrink-0"
              >
                <span>♨️</span>
                <span>To Forge</span>
              </button>
            )}

            {/* Close Button */}
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
        {/* 2-PANE WORKSHOP GRID (Left: My Creations, Right: Subscriptions)            */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 overflow-hidden">
          
          {/* ========================================================================= */}
          {/* PANE 1 (LEFT): MY CREATIONS (Strictly Personal, Editable, Deletable)       */}
          {/* ========================================================================= */}
          <div className="flex flex-col min-h-0 bg-slate-950/30 overflow-hidden">
            {/* Header */}
            <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🎨</span>
                  <span className="font-extrabold text-sm text-slate-200 font-outfit">My Creations</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {myData.totalCount}
                  </span>
                </div>

                {/* Dyslexia-Friendly KISS Multi-Option Pill Switch: Private vs Allow Subscriptions */}
                <div className="bg-slate-950/80 border border-slate-800/80 p-0.5 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => handleToggleSubscriptions(false)}
                    className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      !allowSubscriptions
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                    title="Private: Keep your creations private to you"
                  >
                    🔒 Private
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSubscriptions(true)}
                    className={`py-1 px-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      allowSubscriptions
                        ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                    title="Allow Subscriptions: Allow other players to subscribe to your creations"
                  >
                    🔗 Allow Subscriptions
                  </button>
                </div>
              </div>

              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter my items..."
                  value={personalSearchQuery}
                  onChange={(e) => setPersonalSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Tree Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {myData.totalCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-2">
                  <div className="text-3xl">📦</div>
                  <div className="font-bold text-slate-300 text-sm">No personal creations yet</div>
                  <p className="text-xs max-w-sm">
                    Open the Forge to author custom Paths, Abilities, Chaos Gems, or Gear under your Google account.
                  </p>
                  {onOpenForge && (
                    <button
                      type="button"
                      onClick={() => onOpenForge()}
                      className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl transition cursor-pointer"
                    >
                      ♨️ Open Forge
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Pillar 1: 🧭 Paths */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('my_paths')}
                      className="w-full px-3.5 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedSections['my_paths'] ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm">🧭</span>
                        <span className="font-extrabold text-xs text-blue-300 uppercase tracking-wider">Paths ({myData.paths.length})</span>
                      </div>
                    </button>

                    {!collapsedSections['my_paths'] && (
                      <div className="p-3 space-y-3">
                        {myData.paths.length === 0 ? (
                          <div className="text-xs text-slate-500 italic pl-2">No custom Paths created yet.</div>
                        ) : (
                          myData.paths
                            .filter((p: SupabasePath) => !personalSearchQuery || p.name.toLowerCase().includes(personalSearchQuery.toLowerCase()))
                            .map((path: SupabasePath) => {
                              // Match abilities under this path
                              const pathTraits = myData.traits.filter((t: SupabaseTrait) => t.path === path.name);
                              const pathPowers = myData.powers.filter((p: Power) => p.path === path.name);
                              const pathSkills = myData.skills.filter((s: SupabaseSkill) => s.path === path.name);

                              return (
                                <div key={path.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-3 space-y-2">
                                  {/* Path Header */}
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-extrabold text-xs text-slate-100 truncate">{path.name}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30 shrink-0">
                                        {path.category || 'Path'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleEditItemInForge('path', path)}
                                        className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded cursor-pointer transition"
                                        title="Edit Path in Forge"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setItemToDelete({ type: 'path', id: path.id, name: path.name })}
                                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer transition"
                                        title="Delete Path"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {path.description && (
                                    <div className="text-[11px] text-slate-400 line-clamp-2">{path.description}</div>
                                  )}

                                  {/* Nested Traits */}
                                  {pathTraits.length > 0 && (
                                    <div className="pl-3 border-l border-slate-800 space-y-1">
                                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>🧬</span> Traits ({pathTraits.length})
                                      </div>
                                      {pathTraits.map((t: SupabaseTrait) => (
                                        <div key={t.id} className="flex items-center justify-between py-0.5 group">
                                          <div className="text-xs text-slate-300 truncate pr-2">
                                            <span className="font-semibold text-slate-200">{t.name}</span>: <span className="text-slate-400 text-[11px]">{t.effect?.slice(0, 50)}...</span>
                                          </div>
                                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleEditItemInForge('trait', t)}
                                              className="p-0.5 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                              title="Edit Trait"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setItemToDelete({ type: 'trait', id: t.id, name: t.name })}
                                              className="p-0.5 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                              title="Delete Trait"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Nested Powers */}
                                  {pathPowers.length > 0 && (
                                    <div className="pl-3 border-l border-slate-800 space-y-1">
                                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>⚡</span> Powers ({pathPowers.length})
                                      </div>
                                      {pathPowers.map((p: Power) => (
                                        <div key={p.id} className="flex items-center justify-between py-0.5 group">
                                          <div className="text-xs text-slate-300 truncate pr-2">
                                            <span className="font-semibold text-slate-200">{p.name}</span>
                                            <span className="text-[10px] text-slate-500 ml-1.5">[{p.action || 'AM'} • {p.usage || '1-Enc'}]</span>
                                          </div>
                                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleEditItemInForge('power', p)}
                                              className="p-0.5 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                              title="Edit Power"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setItemToDelete({ type: 'power', id: p.id, name: p.name })}
                                              className="p-0.5 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                              title="Delete Power"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Nested Skills */}
                                  {pathSkills.length > 0 && (
                                    <div className="pl-3 border-l border-slate-800 space-y-1">
                                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>🎯</span> Skills ({pathSkills.length})
                                      </div>
                                      {pathSkills.map((s: SupabaseSkill) => (
                                        <div key={s.id} className="flex items-center justify-between py-0.5 group">
                                          <div className="text-xs text-slate-300 truncate pr-2">
                                            <span className="font-semibold text-slate-200">{s.name}</span>
                                            <span className="text-[10px] text-slate-500 ml-1.5">({s.attribute || '💪'})</span>
                                          </div>
                                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleEditItemInForge('skill', s)}
                                              className="p-0.5 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                              title="Edit Skill"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setItemToDelete({ type: 'skill', id: s.id, name: s.name })}
                                              className="p-0.5 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                              title="Delete Skill"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pillar 2: 💎 Chaos Gems */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('my_gems')}
                      className="w-full px-3.5 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedSections['my_gems'] ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm">💎</span>
                        <span className="font-extrabold text-xs text-violet-300 uppercase tracking-wider">Chaos Gems ({myData.gems.length})</span>
                      </div>
                    </button>

                    {!collapsedSections['my_gems'] && (
                      <div className="p-3 space-y-2">
                        {myData.gems.length === 0 ? (
                          <div className="text-xs text-slate-500 italic pl-2">No custom Chaos Gems created yet.</div>
                        ) : (
                          myData.gems
                            .filter(g => !personalSearchQuery || g.name.toLowerCase().includes(personalSearchQuery.toLowerCase()))
                            .map(g => (
                              <div key={g.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2.5 flex items-center justify-between gap-3 group">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-xs text-slate-100 truncate">{g.name}</div>
                                  <div className="text-[11px] text-slate-400 line-clamp-1">{g.effect}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItemInForge('chaos_gem', g)}
                                    className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded cursor-pointer transition"
                                    title="Edit Chaos Gem"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemToDelete({ type: 'chaos_gem', id: String(g.id ?? g.name), name: g.name })}
                                    className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded cursor-pointer transition"
                                    title="Delete Chaos Gem"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pillar 3: ⚙️ Gear */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('my_gear')}
                      className="w-full px-3.5 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedSections['my_gear'] ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm">⚙️</span>
                        <span className="font-extrabold text-xs text-amber-300 uppercase tracking-wider">
                          Gear ({myData.weapons.length + myData.armor.length + myData.shields.length + myData.supplies.length})
                        </span>
                      </div>
                    </button>

                    {!collapsedSections['my_gear'] && (
                      <div className="p-3 space-y-3">
                        {/* Weapons */}
                        {myData.weapons.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">⚔️ Weapons ({myData.weapons.length})</div>
                            {myData.weapons.map(w => (
                              <div key={w.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{w.name}</div>
                                  <div className="text-[10px] text-slate-400">Atk: {w.atk || '0'} • Dmg: {w.dmg || '0'} • {w.type || 'Melee'}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItemInForge('weapon', w)}
                                    className="p-1 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemToDelete({ type: 'weapon', id: String(w.id ?? w.name), name: w.name })}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Armor */}
                        {myData.armor.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">🥋 Armor ({myData.armor.length})</div>
                            {myData.armor.map(a => (
                              <div key={a.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{a.name}</div>
                                  <div className="text-[10px] text-slate-400">AR: {a.ar || '0'} • Req: {a.requirement || '💪 4'}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItemInForge('armor', a)}
                                    className="p-1 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemToDelete({ type: 'armor', id: String(a.id ?? a.name), name: a.name })}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Shields */}
                        {myData.shields.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">🛡️ Shields ({myData.shields.length})</div>
                            {myData.shields.map(s => (
                              <div key={s.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{s.name}</div>
                                  <div className="text-[10px] text-slate-400">Max Block: {s.max_block || '0'} • Req: {s.requirement || '💪 4'}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItemInForge('shield', s)}
                                    className="p-1 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemToDelete({ type: 'shield', id: String(s.id ?? s.name), name: s.name })}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Supplies */}
                        {myData.supplies.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">🏕️ Supplies ({myData.supplies.length})</div>
                            {myData.supplies.map(sup => (
                              <div key={sup.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{sup.name}</div>
                                  <div className="text-[10px] text-slate-400">Category: {sup.category || 'Adventure'} • Cost: {sup.cost || '10s'}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditItemInForge('supply', sup)}
                                    className="p-1 text-slate-400 hover:text-amber-400 rounded cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setItemToDelete({ type: 'supply', id: String(sup.id ?? sup.name), name: sup.name })}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {myData.weapons.length === 0 && myData.armor.length === 0 && myData.shields.length === 0 && myData.supplies.length === 0 && (
                          <div className="text-xs text-slate-500 italic pl-2">No custom Gear items created yet.</div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PANE 2 (RIGHT): SUBSCRIPTIONS TO OTHER PLAYERS (Read-Only 3-Pillar Tree)  */}
          {/* ========================================================================= */}
          <div className="flex flex-col min-h-0 bg-slate-950/50 overflow-hidden">
            {/* Header & Subscription Box */}
            <div className="p-3.5 bg-slate-950/70 border-b border-slate-800 flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔗</span>
                  <span className="font-extrabold text-sm text-slate-200 font-outfit">Subscribe to Player</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {subscribedData.totalCount}
                  </span>
                </div>
                {playerSubscriptions.length > 0 && (
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter subscriptions..."
                      value={subscribedSearchQuery}
                      onChange={(e) => setSubscribedSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Email Subscription Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    placeholder="Enter player/GM Google email (e.g. friend@gmail.com)..."
                    value={targetEmailInput}
                    onChange={(e) => {
                      setTargetEmailInput(e.target.value);
                      if (subscriptionError) setSubscriptionError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubscribe();
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 placeholder:text-slate-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={!targetEmailInput.trim() || isSubscribing}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm ${
                    targetEmailInput.trim() && !isSubscribing
                      ? 'bg-blue-600 hover:bg-blue-500 text-white font-extrabold shadow-blue-950/50'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                  }`}
                >
                  {isSubscribing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>🔗</span>
                  )}
                  <span>Subscribe</span>
                </button>
              </div>

              {/* Alert Feedback Banner */}
              {subscriptionError && (
                <div className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 border font-medium ${
                  subscriptionError.type === 'error'
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{subscriptionError.message}</span>
                </div>
              )}

              {/* Subscriptions Author Bar */}
              {playerSubscriptions.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedAuthorFilter('all')}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      selectedAuthorFilter === 'all'
                        ? 'bg-blue-600 text-white font-extrabold shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>🌐 All Subscriptions</span>
                    <span className="text-[10px] opacity-75">({subscribedData.totalCount})</span>
                  </button>

                  {playerSubscriptions.map((authorEmail: string) => {
                    const isSelected = selectedAuthorFilter.toLowerCase() === authorEmail.toLowerCase();
                    return (
                      <div
                        key={authorEmail}
                        className={`inline-flex items-center rounded-lg text-xs border transition overflow-hidden ${
                          isSelected
                            ? 'bg-blue-950/80 border-blue-500 text-blue-200 font-extrabold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedAuthorFilter(authorEmail)}
                          className="py-1 pl-2.5 pr-1.5 cursor-pointer flex items-center gap-1"
                        >
                          <span>👤</span>
                          <span className="truncate max-w-[120px]">{authorEmail}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnsubscribe(authorEmail)}
                          className="py-1 pr-2 pl-1 hover:text-rose-400 hover:bg-slate-800/80 transition cursor-pointer text-slate-500"
                          title={`Unsubscribe from ${authorEmail}`}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Read-Only Subscribed 3-Pillar Tree */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {playerSubscriptions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-2">
                  <div className="text-3xl">📬</div>
                  <div className="font-bold text-slate-300 text-sm">No active subscriptions</div>
                  <p className="text-xs max-w-sm">
                    Type a friend or GM's Google email above and click "Subscribe" to access their custom creations.
                  </p>
                </div>
              ) : subscribedData.totalCount === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 gap-2">
                  <div className="text-3xl">📭</div>
                  <div className="font-bold text-slate-300 text-sm">No creations found</div>
                  <p className="text-xs max-w-sm">
                    The subscribed author(s) have not authored any creations yet.
                  </p>
                </div>
              ) : (
                <>
                  {/* Pillar 1: 🧭 Paths */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('sub_paths')}
                      className="w-full px-3.5 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedSections['sub_paths'] ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm">🧭</span>
                        <span className="font-extrabold text-xs text-blue-300 uppercase tracking-wider">Subscribed Paths ({subscribedData.paths.length})</span>
                      </div>
                    </button>

                    {!collapsedSections['sub_paths'] && (
                      <div className="p-3 space-y-3">
                        {subscribedData.paths.length === 0 ? (
                          <div className="text-xs text-slate-500 italic pl-2">No subscribed Paths available.</div>
                        ) : (
                          subscribedData.paths
                            .filter((p: SupabasePath) => !subscribedSearchQuery || p.name.toLowerCase().includes(subscribedSearchQuery.toLowerCase()))
                            .map((path: SupabasePath) => {
                              const pathTraits = subscribedData.traits.filter((t: SupabaseTrait) => t.path === path.name);
                              const pathPowers = subscribedData.powers.filter((p: Power) => p.path === path.name);
                              const pathSkills = subscribedData.skills.filter((s: SupabaseSkill) => s.path === path.name);

                              return (
                                <div key={path.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-3 space-y-2">
                                  {/* Path Header */}
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-extrabold text-xs text-slate-100 truncate">{path.name}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30 shrink-0">
                                        {path.category || 'Path'}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                      👤 {path.owner}
                                    </span>
                                  </div>

                                  {path.description && (
                                    <div className="text-[11px] text-slate-400 line-clamp-2">{path.description}</div>
                                  )}

                                  {/* Subscribed Traits */}
                                  {pathTraits.length > 0 && (
                                    <div className="pl-3 border-l border-slate-800 space-y-1">
                                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>🧬</span> Traits ({pathTraits.length})
                                      </div>
                                      {pathTraits.map((t: SupabaseTrait) => (
                                        <div key={t.id} className="text-xs text-slate-300 py-0.5">
                                          <span className="font-semibold text-slate-200">{t.name}</span>: <span className="text-slate-400 text-[11px]">{t.effect?.slice(0, 60)}...</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Subscribed Powers */}
                                  {pathPowers.length > 0 && (
                                    <div className="pl-3 border-l border-slate-800 space-y-1">
                                      <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>⚡</span> Powers ({pathPowers.length})
                                      </div>
                                      {pathPowers.map((p: Power) => (
                                        <div key={p.id} className="text-xs text-slate-300 py-0.5">
                                          <span className="font-semibold text-slate-200">{p.name}</span>
                                          <span className="text-[10px] text-slate-500 ml-1.5">[{p.action || 'AM'} • {p.usage || '1-Enc'}]</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Subscribed Skills */}
                                  {pathSkills.length > 0 && (
                                    <div className="pl-3 border-l border-slate-800 space-y-1">
                                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                        <span>🎯</span> Skills ({pathSkills.length})
                                      </div>
                                      {pathSkills.map((s: SupabaseSkill) => (
                                        <div key={s.id} className="text-xs text-slate-300 py-0.5">
                                          <span className="font-semibold text-slate-200">{s.name}</span>
                                          <span className="text-[10px] text-slate-500 ml-1.5">({s.attribute || '💪'})</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pillar 2: 💎 Chaos Gems */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('sub_gems')}
                      className="w-full px-3.5 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedSections['sub_gems'] ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm">💎</span>
                        <span className="font-extrabold text-xs text-violet-300 uppercase tracking-wider">Subscribed Chaos Gems ({subscribedData.gems.length})</span>
                      </div>
                    </button>

                    {!collapsedSections['sub_gems'] && (
                      <div className="p-3 space-y-2">
                        {subscribedData.gems.length === 0 ? (
                          <div className="text-xs text-slate-500 italic pl-2">No subscribed Chaos Gems.</div>
                        ) : (
                          subscribedData.gems
                            .filter(g => !subscribedSearchQuery || g.name.toLowerCase().includes(subscribedSearchQuery.toLowerCase()))
                            .map(g => (
                              <div key={g.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2.5 flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-xs text-slate-100 truncate">{g.name}</div>
                                  <div className="text-[11px] text-slate-400 line-clamp-1">{g.effect}</div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                  👤 {g.owner}
                                </span>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pillar 3: ⚙️ Gear */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection('sub_gear')}
                      className="w-full px-3.5 py-2 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between text-left cursor-pointer hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-2">
                        {collapsedSections['sub_gear'] ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm">⚙️</span>
                        <span className="font-extrabold text-xs text-amber-300 uppercase tracking-wider">
                          Subscribed Gear ({subscribedData.weapons.length + subscribedData.armor.length + subscribedData.shields.length + subscribedData.supplies.length})
                        </span>
                      </div>
                    </button>

                    {!collapsedSections['sub_gear'] && (
                      <div className="p-3 space-y-3">
                        {/* Subscribed Weapons */}
                        {subscribedData.weapons.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">⚔️ Weapons ({subscribedData.weapons.length})</div>
                            {subscribedData.weapons.map(w => (
                              <div key={w.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{w.name}</div>
                                  <div className="text-[10px] text-slate-400">Atk: {w.atk || '0'} • Dmg: {w.dmg || '0'} • {w.type || 'Melee'}</div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">👤 {w.owner}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subscribed Armor */}
                        {subscribedData.armor.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">🥋 Armor ({subscribedData.armor.length})</div>
                            {subscribedData.armor.map(a => (
                              <div key={a.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{a.name}</div>
                                  <div className="text-[10px] text-slate-400">AR: {a.ar || '0'} • Req: {a.requirement || '💪 4'}</div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">👤 {a.owner}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subscribed Shields */}
                        {subscribedData.shields.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">🛡️ Shields ({subscribedData.shields.length})</div>
                            {subscribedData.shields.map(s => (
                              <div key={s.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{s.name}</div>
                                  <div className="text-[10px] text-slate-400">Max Block: {s.max_block || '0'} • Req: {s.requirement || '💪 4'}</div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">👤 {s.owner}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subscribed Supplies */}
                        {subscribedData.supplies.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">🏕️ Supplies ({subscribedData.supplies.length})</div>
                            {subscribedData.supplies.map(sup => (
                              <div key={sup.id} className="border border-slate-800 rounded-lg bg-slate-950/60 p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-slate-200 truncate">{sup.name}</div>
                                  <div className="text-[10px] text-slate-400">Category: {sup.category || 'Adventure'} • Cost: {sup.cost || '10s'}</div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0">👤 {sup.owner}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DELETE CONFIRMATION MODAL OVERLAY                                         */}
        {/* ========================================================================= */}
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-100 font-outfit">Confirm Deletion</h3>
                  <p className="text-xs text-slate-400">This action will remove the creation permanently.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300">
                Are you sure you want to delete <span className="font-extrabold text-rose-300">"{itemToDelete.name}"</span>? Any character currently linking to this custom element will retain their snapshot copy.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/50 transition cursor-pointer flex items-center gap-1.5"
                >
                  {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete Creation</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TOAST FEEDBACK NOTIFICATION                                               */}
        {/* ========================================================================= */}
        {feedback && (
          <div className={`absolute bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl border flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950 border-rose-500/50 text-rose-200'
          }`}>
            {feedback.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="ml-2 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
