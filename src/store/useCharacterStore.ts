import { create } from 'zustand';
import { Character, CharacterSheetData, Power, MagicItem, AbilitySlot, SupabaseSkill, SupabaseTrait, SupabaseKit, SupabasePath, SupabaseSet, SupabaseBundle, SupabaseSupply, SupabaseWeapon, SupabaseArmor, SupabaseShield, SupabaseChaosGem, TraitQuirkItem, HardwareBundleItem, EncounterLink, FunctionItem, GearPowerItem, ModItem, PlayerRecord, ApLogEntry, isGearPowerLearned, cleanAbilityName, calculateAvailableAp } from '../types/game';
import { gameApi, createDefaultSheetData, CatalogScope } from '../services/api';
import { migrateCharacterMagicItemsToVault } from '../utils/magicSlotSchedule';
import { migrateCharacterPowersToCodex } from '../utils/readyMatrixSchedule';
import { isGuildSpaceUnlocked } from '../utils/guildspaceAuth';
import { reconcileCharacterVaultWithGear, cleanBelongsToName, getFunctionsForMod } from '../utils/gearFunctionSync';
import { parseCostToSilver, deductFundsWithChange } from '../utils/moneyUtils';
import { reconcileCharacterFreeTraits } from '../utils/pathReconciliationUtils';
import { reconcileCanonicalSnapshots, updateCharacterSheetCanonicalItem, removeCharacterSheetCanonicalItem, CanonicalEntityType } from '../utils/canonicalPropagation';
import { applyEntityHydration } from '../utils/entityHydration';
import { CatalogArtifact, ArtifactTier } from '../utils/artifactCatalogResolver';
import { CatalogExotic, ExoticTier } from '../utils/exoticCatalogResolver';
import { getTabSessionId } from '../utils/tabSession';
import { supabase } from '../lib/supabase';

const CATALOGS_CACHE_KEY = 'supaflex_catalogs_cache_v5';
const CATALOGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CatalogsCachePayload {
  version: number;
  timestamp: number;
  data: {
    powers: Power[];
    items: MagicItem[];
    skills: SupabaseSkill[];
    traits: SupabaseTrait[];
    pathsData: SupabasePath[];
    setsData?: SupabaseSet[];
    bundlesData: SupabaseBundle[];
    functionsData: FunctionItem[];
    modsData: ModItem[];
    artifactsData: CatalogArtifact[];
    exoticsData: CatalogExotic[];
    playersData: PlayerRecord[];
    suppliesData: SupabaseSupply[];
    weaponsData: SupabaseWeapon[];
    armorData: SupabaseArmor[];
    shieldsData: SupabaseShield[];
    chaosGemsData: SupabaseChaosGem[];
  };
}

export function getCatalogCacheKey(email?: string): string {
  const cleanEmail = (email || '').trim().toLowerCase();
  return cleanEmail ? `${CATALOGS_CACHE_KEY}_${cleanEmail}` : CATALOGS_CACHE_KEY;
}

function hydrateSetsWithCounts(
  rawSets: SupabaseSet[] | undefined | null,
  allItemsPool: any[]
): SupabaseSet[] {
  if (!rawSets || rawSets.length === 0) return [];
  const counts: Record<string, number> = {};
  for (const item of allItemsPool) {
    if (Array.isArray(item?.sets)) {
      for (const s of item.sets) {
        const key = (s || '').trim().toLowerCase();
        if (key) counts[key] = (counts[key] || 0) + 1;
      }
    }
  }
  return rawSets.map((set) => {
    const key = (set.name || '').trim().toLowerCase();
    return {
      ...set,
      items_count: counts[key] || 0,
    };
  });
}

function loadCatalogsFromCache(minTimestamp?: number, email?: string): CatalogsCachePayload['data'] | null {
  if (typeof window === 'undefined') return null;
  try {
    // Purge old v1, v2, v3, and v4 cache if present
    localStorage.removeItem('supaflex_catalogs_cache_v1');
    localStorage.removeItem('supaflex_catalogs_cache_v2');
    localStorage.removeItem('supaflex_catalogs_cache_v3');
    localStorage.removeItem('supaflex_catalogs_cache_v4');

    const cacheKey = getCatalogCacheKey(email);
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed: CatalogsCachePayload = JSON.parse(raw);
    if (!parsed || parsed.version !== 5 || !parsed.timestamp || !parsed.data) return null;
    // Auto-invalidate if functionsData or suppliesData is empty or missing (e.g. following database migration)
    if (!Array.isArray(parsed.data.functionsData) || parsed.data.functionsData.length === 0 || !Array.isArray(parsed.data.suppliesData)) {
      return null;
    }
    if (Date.now() - parsed.timestamp > CATALOGS_CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    // Auto-invalidate if cloud beacon is newer than cached timestamp
    if (minTimestamp && parsed.timestamp < minTimestamp) {
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.warn('[CatalogsCache] Error reading cache:', e);
    return null;
  }
}

function saveCatalogsToCache(data: CatalogsCachePayload['data'], email?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: CatalogsCachePayload = {
      version: 5,
      timestamp: Date.now(),
      data,
    };
    const cacheKey = getCatalogCacheKey(email);
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch (e) {
    console.warn('[CatalogsCache] Error writing cache:', e);
  }
}

let characterSaveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSaveResolvers: Array<() => void> = [];

const getInitialPlayerLinks = (email?: string): EncounterLink[] => {
  if (typeof window !== 'undefined') {
    try {
      const em = email || sessionStorage.getItem('supaflex_player_email') || '';
      if (!em) return [];
      const saved = localStorage.getItem(`supaflex_player_links_${em}`);
      if (saved) return JSON.parse(saved);
    } catch {}
  }
  return [];
};

const sanitizeNishSkills = (sheet: CharacterSheetData): CharacterSheetData => {
  if (!sheet) return sheet;
  const indiv = sheet.known_individual_skills;
  if (!Array.isArray(indiv) || !indiv.some((s) => s && s.toLowerCase().includes('nish (mso)'))) {
    return sheet;
  }
  const seen = new Set<string>();
  const sanitized: string[] = [];
  for (const s of indiv) {
    if (!s) continue;
    const clean = s.trim().toLowerCase() === 'nish (mso)' ? 'Nish' : s.trim();
    if (!seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      sanitized.push(clean);
    }
  }
  return { ...sheet, known_individual_skills: sanitized };
};

interface CharacterStore {
  // State
  characters: Character[];
  activeCharacter: Character | null;
  players: PlayerRecord[];
  powers: Power[];
  magicItems: MagicItem[];
  artifactsCatalog: CatalogArtifact[];
  exoticsCatalog: CatalogExotic[];
  skills: SupabaseSkill[];
  traits: SupabaseTrait[];
  paths: SupabasePath[];
  setsCatalog: SupabaseSet[];
  equipmentKits: SupabaseKit[];
  kits: SupabaseKit[];
  bundles: SupabaseBundle[];
  functionsCatalog: FunctionItem[];
  modsCatalog: ModItem[];
  suppliesCatalog: SupabaseSupply[];
  weaponsCatalog: SupabaseWeapon[];
  armorCatalog: SupabaseArmor[];
  shieldsCatalog: SupabaseShield[];
  chaosGemsCatalog: SupabaseChaosGem[];
  isLoading: boolean;
  isSaving: boolean;
  dbConnected: boolean;
  isGuildSpaceUnlocked: boolean;
  error: string | null;

  // Artifact & Exotic Selector Helpers
  getArtifactsByTier: (tier: ArtifactTier) => CatalogArtifact[];
  getExoticsByTier: (tier: ExoticTier) => CatalogExotic[];

  // Player Login & Filtering State
  playerEmail: string;
  playerName: string;
  playerSubscriptions: string[];
  filterMode: 'my_heroes' | 'all_heroes';
  activeRole: 'player' | 'gm';
  activePartyId: string | null;
  tabSessionId: string;

  // Modal Navigation State
  isGearManagerModalOpen: boolean;
  setGearManagerModalOpen: (open: boolean) => void;
  isExoticGearManagerModalOpen: boolean;
  setExoticGearManagerModalOpen: (open: boolean, targetItem?: string | null) => void;
  exoticGearManagerTargetItem: string | null;
  setExoticGearManagerTargetItem: (target: string | null) => void;

  // Actions
  fetchInitialData: (options?: { silent?: boolean; forceRefresh?: boolean }) => Promise<void>;
  refreshCatalogs: () => Promise<void>;
  subscribeToAuthor: (email: string) => Promise<void>;
  unsubscribeFromAuthor: (email: string) => Promise<void>;
  selectCharacter: (id: number) => void;
  createNewCharacter: (name: string, characterClass?: string, race?: string) => Promise<Character | null>;
  updateActiveSheetData: (updater: (prev: CharacterSheetData) => CharacterSheetData) => void;
  updateActiveCharacterMeta: (updates: Partial<Character>) => void;
  saveActiveCharacter: (immediate?: boolean) => Promise<void>;
  deleteCharacter: (id: number) => Promise<void>;
  addCharge: (amount?: number) => void;
  spendSpark: () => void;
  spendBolt: () => void;
  spendLuckForBolt: () => { success: boolean; error?: string };
  resetCharges: () => void;
  addSpark: (amount?: number) => void;
  spendMeta: () => void;
  resetSparks: () => void;
  resetEncounterSubstitutions: () => void;
  toggleReadyPower: (powerName: string) => { success: boolean; error?: string };
  executeTacticalPivot: (unreadyPowerName: string, readyPowerName: string, useLuckInsteadOfBolt?: boolean) => { success: boolean; error?: string };
  resetTacticalPivot: () => void;
  switchFunctionStance: (targetStance: 'alpha' | 'beta') => { success: boolean; cost: 'M' | 'AM'; error?: string };
  executeHardwareShunt: (vaultItemName: string, outgoingSlotNames: string[]) => { success: boolean; error?: string };
  resetStanceSwitches: () => void;
  setPlayerEmail: (email: string) => void;
  setPlayerName: (name: string) => void;
  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => void;
  setActiveRole: (role: 'player' | 'gm') => void;
  setActivePartyId: (partyId: string | null) => void;
  recordApExpenditure: (
    cost: number,
    category: 'Skills' | 'Weapons' | 'Armor' | 'Shields' | 'Powers' | 'Magic Items' | 'Gear Powers' | 'Attributes' | 'Focus Die' | 'Capstones' | 'Vitality' | 'GM Bonus' | 'Manual',
    description: string,
    tier: 1 | 2 | 3 | 'Creation' | 'Manual',
    source: string
  ) => void;
  revertApExpenditure: (entryId: string) => void;
  syncSheetRulesToDatabase: () => Promise<{ updatedCount: number; preservedCount: number }>;
  updateCanonicalCatalogItem: (type: string, item: any, oldName?: string) => void;
  removeCanonicalCatalogItem: (type: string, id: string | number, name?: string) => void;

  // Player Links (Account-Wide)
  playerLinks: EncounterLink[];
  fetchPlayerLinks: () => void;
  addPlayerLink: (name: string, url: string, tag?: string, desc?: string) => void;
  updatePlayerLink: (linkId: string, name: string, url: string, tag?: string, desc?: string) => void;
  deletePlayerLink: (linkId: string) => void;
  reorderPlayerLinkByIndex: (fromIdx: number, toIdx: number) => void;

  // Character Links (Character-Specific)
  addCharacterLink: (name: string, url: string, tag?: string, desc?: string) => void;
  updateCharacterLink: (linkId: string, name: string, url: string, tag?: string, desc?: string) => void;
  deleteCharacterLink: (linkId: string) => void;
  reorderCharacterLinkByIndex: (fromIdx: number, toIdx: number) => void;

  // Traits & Quirks Actions
  addTraitQuirk: (trait: TraitQuirkItem) => void;
  removeTraitQuirk: (traitNameOrId: string | number, forceGmOverride?: boolean) => boolean;
  toggleTraitVisibility: (traitNameOrId: string | number) => void;
  toggleStarTrait: (id: string | number) => void;
  toggleFavoriteTraitTable: (tableGroup: string) => void;
  toggleFavoriteTraitKit: (kitName: string) => void;

  // Hardware Bundles Actions
  addHardwareBundle: (bundle: HardwareBundleItem) => void;
  removeHardwareBundle: (bundleNameOrId: string | number) => void;
  toggleHardwareBundleVisibility: (bundleNameOrId: string | number) => void;

  // Gear Powers Actions (1 AP Universal Learning)
  learnGearPower: (power: GearPowerItem, hostGearName: string, hostModName?: string) => boolean;
  unlearnGearPower: (powerName: string) => void;
  toggleGearPowerUsage: (powerName: string, checkIndex: number) => void;
  clearAllGearPowerUses: () => void;
  installModToGearItem: (modItem: ModItem, hostName: string) => { success: boolean; error?: string };
  uninstallModFromGearItem: (modName: string, hostName: string) => { success: boolean; error?: string; refundedAp?: number };

  // Shared Ability Sort & Filter State (Powers & Loadout)
  abilitySortMode: 'action' | 'name';
  abilityActionFilter: 'ALL' | 'AM' | 'A' | 'M' | 'P' | 'F';
  setAbilitySortMode: (mode: 'action' | 'name') => void;
  setAbilityActionFilter: (filter: 'ALL' | 'AM' | 'A' | 'M' | 'P' | 'F') => void;
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  activeCharacter: null,
  players: [],
  powers: [],
  magicItems: [],
  artifactsCatalog: [],
  exoticsCatalog: [],
  skills: [],
  traits: [],
  paths: [],
  setsCatalog: [],
  equipmentKits: [],
  kits: [],
  bundles: [],
  functionsCatalog: [],
  modsCatalog: [],
  suppliesCatalog: [],
  weaponsCatalog: [],
  armorCatalog: [],
  shieldsCatalog: [],
  chaosGemsCatalog: [],
  isLoading: false,
  isSaving: false,
  dbConnected: false,
  isGuildSpaceUnlocked: isGuildSpaceUnlocked(),
  error: null,

  tabSessionId: getTabSessionId(),
  playerSubscriptions: [],

  playerEmail: (() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('supaflex_player_email') || '';
  })(),
  playerName: (() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('supaflex_player_name') || '';
  })(),
  filterMode: 'my_heroes',
  activeRole: (() => {
    if (typeof window === 'undefined') return 'player';
    return (sessionStorage.getItem('supaflex_active_role') as 'player' | 'gm') || 'player';
  })(),
  activePartyId: (() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('supaflex_active_party_id') || null;
  })(),
  playerLinks: getInitialPlayerLinks(),

  // Modal Navigation State
  isGearManagerModalOpen: false,
  setGearManagerModalOpen: (open: boolean) => set({ isGearManagerModalOpen: open }),
  isExoticGearManagerModalOpen: false,
  setExoticGearManagerModalOpen: (open: boolean, targetItem: string | null = null) =>
    set({ isExoticGearManagerModalOpen: open, exoticGearManagerTargetItem: targetItem }),
  exoticGearManagerTargetItem: null,
  setExoticGearManagerTargetItem: (target: string | null) => set({ exoticGearManagerTargetItem: target }),

  getArtifactsByTier: (tier: ArtifactTier) => {
    return (get().artifactsCatalog || []).filter((a) => a.artifact_tier === tier);
  },

  getExoticsByTier: (tier: ExoticTier) => {
    return (get().exoticsCatalog || []).filter((e) => e.exotic_tier === tier);
  },

  fetchInitialData: async (options?: { silent?: boolean; forceRefresh?: boolean }) => {
    const isSilent = options?.silent === true;
    if (!isSilent) {
      set({ isLoading: true, error: null });
    }
    try {
      const isConnected = await gameApi.checkConnection();
      set({ dbConnected: isConnected });

      // Register window network status listeners for dynamic offline warning popups and GuildSpace lock/unlock catalog reloads
      if (typeof window !== 'undefined' && !(window as any)._supaflex_net_listeners_registered) {
        (window as any)._supaflex_net_listeners_registered = true;
        window.addEventListener('online', () => {
          set({ dbConnected: true });
        });
        window.addEventListener('offline', () => {
          set({ dbConnected: false });
        });
        window.addEventListener('supaflex:guildspace-unlocked', () => {
          set({ isGuildSpaceUnlocked: true });
          get().fetchInitialData({ silent: true });
        });
        window.addEventListener('supaflex:guildspace-locked', () => {
          set({ isGuildSpaceUnlocked: false });
          get().fetchInitialData({ silent: true });
        });
      }

      if (!isConnected) {
        set({ isLoading: false, error: 'Database connection offline.' });
        return;
      }

      let chars: Character[];
      let powers: Power[];
      let items: MagicItem[];
      let skills: SupabaseSkill[];
      let traits: SupabaseTrait[];
      let pathsData: SupabasePath[];
      let setsData: SupabaseSet[];
      let bundlesData: SupabaseBundle[];
      let functionsData: FunctionItem[];
      let modsData: ModItem[];
      let artifactsData: CatalogArtifact[];
      let exoticsData: CatalogExotic[];
      let playersData: PlayerRecord[];
      let suppliesData: SupabaseSupply[];
      let weaponsData: SupabaseWeapon[];
      let armorData: SupabaseArmor[];
      let shieldsData: SupabaseShield[];
      let chaosGemsData: SupabaseChaosGem[];

      const email = (get().playerEmail || (typeof window !== 'undefined' ? sessionStorage.getItem('supaflex_player_email') || '' : '')).trim().toLowerCase();

      // Fetch player subscriptions if email is present
      let userSubscriptions: string[] = [];
      if (email) {
        try {
          userSubscriptions = await gameApi.getSubscriptionsForUser(email);
        } catch (subErr) {
          console.warn('[Store] Error fetching player subscriptions:', subErr);
        }
      }

      const catalogScope: CatalogScope = {
        userEmail: email,
        subscribedEmails: userSubscriptions,
      };

      // Check 40-byte cloud beacon to detect if Antigravity / admin pushed database adjustments
      const beaconTimeStr = await gameApi.getCatalogBeacon();
      const beaconTime = beaconTimeStr ? new Date(beaconTimeStr).getTime() : 0;
      const cached = !options?.forceRefresh ? loadCatalogsFromCache(beaconTime, email) : null;

      if (cached) {
        // Fast path: Instant load from localStorage (0 REST calls, 0 egress)
        powers = cached.powers;
        items = cached.items;
        skills = cached.skills;
        traits = cached.traits;
        pathsData = cached.pathsData;
        setsData = cached.setsData || [];
        bundlesData = cached.bundlesData;
        functionsData = cached.functionsData;
        modsData = cached.modsData;
        artifactsData = cached.artifactsData;
        exoticsData = cached.exoticsData;
        playersData = cached.playersData;
        suppliesData = cached.suppliesData || [];
        weaponsData = cached.weaponsData || [];
        armorData = cached.armorData || [];
        shieldsData = cached.shieldsData || [];
        chaosGemsData = cached.chaosGemsData || [];

        chars = await gameApi.getCharactersSummary();
      } else {
        // Cold fetch: Download all catalogs from Supabase and cache locally
        const [
          fetchedChars,
          fetchedPowers,
          fetchedItems,
          fetchedSkills,
          fetchedTraits,
          fetchedPaths,
          fetchedSets,
          fetchedBundles,
          fetchedFunctions,
          fetchedMods,
          fetchedArtifacts,
          fetchedExotics,
          fetchedPlayers,
          fetchedSupplies,
          fetchedWeapons,
          fetchedArmor,
          fetchedShields,
          fetchedChaosGems,
        ] = await Promise.all([
          gameApi.getCharactersSummary(),
          gameApi.getPowers(catalogScope),
          gameApi.getMagicItems(catalogScope),
          gameApi.getSkills(catalogScope),
          gameApi.getTraits(catalogScope),
          gameApi.getPaths(catalogScope),
          gameApi.getSets(catalogScope),
          gameApi.getBundles(catalogScope),
          gameApi.getFunctions(catalogScope),
          gameApi.getMods(catalogScope),
          gameApi.getArtifacts(catalogScope),
          gameApi.getExotics(catalogScope),
          gameApi.getPlayers(),
          gameApi.getSupplies(catalogScope),
          gameApi.getWeapons(catalogScope),
          gameApi.getArmor(catalogScope),
          gameApi.getShields(catalogScope),
          gameApi.getChaosGems(catalogScope),
        ]);

        chars = fetchedChars;
        powers = fetchedPowers;
        items = fetchedItems;
        skills = fetchedSkills;
        traits = fetchedTraits;
        pathsData = fetchedPaths;
        setsData = fetchedSets || [];
        bundlesData = fetchedBundles;
        functionsData = fetchedFunctions;
        modsData = fetchedMods;
        artifactsData = fetchedArtifacts;
        exoticsData = fetchedExotics;
        playersData = fetchedPlayers;
        suppliesData = fetchedSupplies || [];
        weaponsData = fetchedWeapons || [];
        armorData = fetchedArmor || [];
        shieldsData = fetchedShields || [];
        chaosGemsData = fetchedChaosGems || [];

        saveCatalogsToCache({
          powers,
          items,
          skills,
          traits,
          pathsData,
          setsData,
          bundlesData,
          functionsData,
          modsData,
          artifactsData,
          exoticsData,
          playersData,
          suppliesData,
          weaponsData,
          armorData,
          shieldsData,
          chaosGemsData,
        }, email);
      }

      const allCatalogItemsPool = [
        ...(weaponsData || []),
        ...(armorData || []),
        ...(shieldsData || []),
        ...(powers || []),
        ...(skills || []),
        ...(traits || []),
        ...(functionsData || []),
      ];
      const hydratedSetsCatalog = hydrateSetsWithCounts(setsData, allCatalogItemsPool);

      // If unauthenticated, do not select any character
      if (!email) {
        set({
          characters: chars,
          activeCharacter: null,
          players: playersData || [],
          powers,
          magicItems: items,
          artifactsCatalog: artifactsData || [],
          exoticsCatalog: exoticsData || [],
          skills,
          traits,
          paths: pathsData,
          setsCatalog: hydratedSetsCatalog,
          equipmentKits: bundlesData,
          kits: pathsData as any,
          bundles: bundlesData,
          functionsCatalog: functionsData || [],
          modsCatalog: modsData || [],
          suppliesCatalog: suppliesData || [],
          weaponsCatalog: weaponsData || [],
          armorCatalog: armorData || [],
          shieldsCatalog: shieldsData || [],
          chaosGemsCatalog: chaosGemsData || [],
          playerSubscriptions: userSubscriptions,
          isLoading: false,
        });
        return;
      }

      const isMaster = email === 'metascapegame@gmail.com';
      const myHeroes = chars.filter((c) => (c.owner_email || '').trim().toLowerCase() === email);
      const eligiblePool = isMaster ? chars : myHeroes;
      const currentActive = get().activeCharacter;
      let selectedChar: Character | null = null;

      const reconcileSheet = (rawSheet: CharacterSheetData, char: Character | null): CharacterSheetData => {
        const cleanedSheet = sanitizeNishSkills(rawSheet);
        const migrated = migrateCharacterPowersToCodex(migrateCharacterMagicItemsToVault(cleanedSheet));
        const vaultReconciled = reconcileCharacterVaultWithGear(migrated, functionsData || [], modsData || []).updatedSheet;
        const canonicalReconciled = reconcileCanonicalSnapshots(vaultReconciled, {
          powers,
          weapons: weaponsData,
          armor: armorData,
          shields: shieldsData,
          traits,
          supplies: suppliesData,
        }).updatedSheetData;
        const pathReconciled = reconcileCharacterFreeTraits(canonicalReconciled, char, traits).updatedSheetData;
        return applyEntityHydration(pathReconciled, {
          powers,
          weapons: weaponsData,
          armor: armorData,
          shields: shieldsData,
          supplies: suppliesData,
          traits,
        });
      };

      let targetCandidate: Character | null = null;
      if (currentActive && eligiblePool.some((c) => c.id === currentActive.id)) {
        targetCandidate = eligiblePool.find((c) => c.id === currentActive.id)!;
      } else {
        const lastActiveId = sessionStorage.getItem('supaflex_last_active_char_id');
        const lastActiveChar = eligiblePool.find((c) => String(c.id) === lastActiveId);
        if (lastActiveChar) {
          targetCandidate = lastActiveChar;
        } else if (myHeroes.length > 0) {
          targetCandidate = myHeroes[0];
        }
      }

      if (targetCandidate) {
        // Download full sheet_data only for the single active hero on boot (97% bandwidth reduction)
        const fullChar = (currentActive && currentActive.id === targetCandidate.id && currentActive.sheet_data)
          ? currentActive
          : await gameApi.getCharacterById(targetCandidate.id);

        if (fullChar) {
          const migratedSheet = reconcileSheet(fullChar.sheet_data, fullChar);
          selectedChar = {
            ...fullChar,
            sheet_data: migratedSheet,
          };
        }
      }

      set({
        characters: chars,
        activeCharacter: selectedChar,
        players: playersData || [],
        powers,
        magicItems: items,
        artifactsCatalog: artifactsData || [],
        exoticsCatalog: exoticsData || [],
        skills,
        traits,
        paths: pathsData,
        setsCatalog: hydratedSetsCatalog,
        equipmentKits: bundlesData,
        kits: pathsData as any,
        bundles: bundlesData,
        functionsCatalog: functionsData || [],
        modsCatalog: modsData || [],
        suppliesCatalog: suppliesData || [],
        weaponsCatalog: weaponsData || [],
        armorCatalog: armorData || [],
        shieldsCatalog: shieldsData || [],
        chaosGemsCatalog: chaosGemsData || [],
        playerSubscriptions: userSubscriptions,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Failed to fetch character data.',
      });
    }
  },

  subscribeToAuthor: async (email: string) => {
    const playerEmail = get().playerEmail;
    if (!playerEmail || !email) return;
    const ok = await gameApi.addSubscription(playerEmail, email);
    if (ok) {
      const subs = await gameApi.getSubscriptionsForUser(playerEmail);
      set({ playerSubscriptions: subs });
      await get().refreshCatalogs();
    }
  },

  unsubscribeFromAuthor: async (email: string) => {
    const playerEmail = get().playerEmail;
    if (!playerEmail || !email) return;
    const ok = await gameApi.removeSubscription(playerEmail, email);
    if (ok) {
      const subs = await gameApi.getSubscriptionsForUser(playerEmail);
      set({ playerSubscriptions: subs });
      await get().refreshCatalogs();
    }
  },


  selectCharacter: async (id: number) => {
    sessionStorage.setItem('supaflex_last_active_char_id', String(id));
    const functionsCatalog = get().functionsCatalog;
    const modsCatalog = get().modsCatalog;
    const reconcileSheet = (rawSheet: CharacterSheetData, char: Character | null): CharacterSheetData => {
      const cleanedSheet = sanitizeNishSkills(rawSheet);
      const migrated = migrateCharacterPowersToCodex(migrateCharacterMagicItemsToVault(cleanedSheet));
      const vaultReconciled = reconcileCharacterVaultWithGear(migrated, functionsCatalog, modsCatalog).updatedSheet;
      const canonicalReconciled = reconcileCanonicalSnapshots(vaultReconciled, {
        powers: get().powers,
        weapons: get().weaponsCatalog,
        armor: get().armorCatalog,
        shields: get().shieldsCatalog,
        traits: get().traits,
        supplies: get().suppliesCatalog,
      }).updatedSheetData;
      const pathReconciled = reconcileCharacterFreeTraits(canonicalReconciled, char, get().traits).updatedSheetData;
      return applyEntityHydration(pathReconciled, {
        powers: get().powers,
        weapons: get().weaponsCatalog,
        armor: get().armorCatalog,
        shields: get().shieldsCatalog,
        supplies: get().suppliesCatalog,
        traits: get().traits,
      });
    };

    const found = get().characters.find((c) => c.id === id);
    if (found) {
      const migratedFoundSheet = reconcileSheet(found.sheet_data, found);
      const migratedFound = { ...found, sheet_data: migratedFoundSheet };
      set({ activeCharacter: migratedFound });
    }
    try {
      const updated = await gameApi.getCharacterById(id);
      if (updated) {
        const migratedSheet = reconcileSheet(updated.sheet_data, updated);
        const migratedChar = { ...updated, sheet_data: migratedSheet };
        set((state) => ({
          activeCharacter: migratedChar,
          characters: state.characters.map((c) => (c.id === updated.id ? migratedChar : c)),
        }));
      }
    } catch (err) {
      console.warn('Network fetch for character details failed:', err);
    }
  },

  createNewCharacter: async (name: string, characterClass = 'Adventurer', race = 'Human') => {
    set({ isSaving: true });
    try {
      const ownerEmail = get().playerEmail || undefined;
      const newChar = await gameApi.createCharacter(name, characterClass, race, ownerEmail);
      set((state) => ({
        characters: [newChar, ...state.characters],
        activeCharacter: newChar,
        isSaving: false,
      }));
      sessionStorage.setItem('supaflex_last_active_char_id', String(newChar.id));
      return newChar;
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to create character.' });
      return null;
    }
  },

  setPlayerEmail: (email: string) => {
    const trimmed = email.trim();
    if (trimmed) {
      sessionStorage.setItem('supaflex_player_email', trimmed);
    } else {
      sessionStorage.removeItem('supaflex_player_email');
    }
    set({ playerEmail: trimmed });
    get().fetchPlayerLinks();
    get().fetchInitialData({ silent: true });
  },

  setPlayerName: (name: string) => {
    const trimmed = name.trim();
    if (trimmed) {
      sessionStorage.setItem('supaflex_player_name', trimmed);
    } else {
      sessionStorage.removeItem('supaflex_player_name');
    }
    set({ playerName: trimmed });
  },

  setFilterMode: (mode: 'my_heroes' | 'all_heroes') => {
    sessionStorage.setItem('supaflex_filter_mode', mode);
    set({ filterMode: mode });
  },

  setActiveRole: (role: 'player' | 'gm') => {
    sessionStorage.setItem('supaflex_active_role', role);
    set({ activeRole: role });
  },

  setActivePartyId: (partyId: string | null) => {
    if (typeof window !== 'undefined') {
      if (partyId) sessionStorage.setItem('supaflex_active_party_id', partyId);
      else sessionStorage.removeItem('supaflex_active_party_id');
    }
    set({ activePartyId: partyId });
  },

  updateActiveSheetData: (updater) => {
    const active = get().activeCharacter;
    if (!active) return;

    const currentSheet = active.sheet_data || createDefaultSheetData();
    const updatedSheet = updater({ ...currentSheet });

    set((state) => {
      if (!state.activeCharacter) return state;
      const updatedActive = {
        ...state.activeCharacter,
        hp: updatedSheet.current_vitality,
        might: updatedSheet.attribute_dice.might,
        motion: updatedSheet.attribute_dice.motion,
        mind: updatedSheet.attribute_dice.mind,
        magic: updatedSheet.attribute_dice.magic,
        moxie: updatedSheet.attribute_dice.moxie,
        sheet_data: updatedSheet,
      };
      return {
        activeCharacter: updatedActive,
        characters: state.characters.map((c) => (c.id === updatedActive.id ? updatedActive : c)),
      };
    });
  },

  updateActiveCharacterMeta: (updates: Partial<Character>) => {
    set((state) => {
      if (!state.activeCharacter) return state;
      const updated = { ...state.activeCharacter, ...updates };
      return {
        activeCharacter: updated,
        characters: state.characters.map((c) => (c.id === updated.id ? updated : c)),
      };
    });
  },

  saveActiveCharacter: async (immediate: boolean = false) => {
    return new Promise<void>((resolve) => {
      pendingSaveResolvers.push(resolve);

      const executeSave = async () => {
        if (characterSaveDebounceTimer) {
          clearTimeout(characterSaveDebounceTimer);
          characterSaveDebounceTimer = null;
        }
        const resolversToNotify = [...pendingSaveResolvers];
        pendingSaveResolvers = [];

        const active = get().activeCharacter;
        if (!active) {
          resolversToNotify.forEach((r) => r());
          return;
        }
        set({ isSaving: true });
        try {
          const saved = await gameApi.updateCharacter(active.id, {
            name: active.name,
            class: active.class,
            race: active.race,
            hp: active.hp,
            might: active.might,
            motion: active.motion,
            mind: active.mind,
            magic: active.magic,
            moxie: active.moxie,
            skills: active.skills,
            inventory: active.inventory,
            owner_email: active.owner_email,
            sheet_data: active.sheet_data,
          });

          set((state) => ({
            activeCharacter: saved,
            characters: state.characters.map((c) => (c.id === saved.id ? saved : c)),
            isSaving: false,
          }));

          // Instant optimistic vitals & nish broadcast to active party members (< 50ms peer-to-peer sync)
          const activePartyId = get().activePartyId;
          if (activePartyId) {
            try {
              const curVit = saved.sheet_data?.current_vitality ?? saved.hp ?? 28;
              const maxVit = saved.sheet_data?.vitality_max ?? 28;
              const curNish = saved.sheet_data?.current_nish ?? null;
              const channel = supabase.channel(`party:${activePartyId}`);
              channel.send({
                type: 'broadcast',
                event: 'party_members_updated',
                payload: {
                  partyId: activePartyId,
                  character_id: saved.id,
                  current_vitality: curVit,
                  vitality_max: maxVit,
                  current_nish: curNish,
                  hp: curVit,
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (bcErr) {
              console.warn('[useCharacterStore] Notice broadcasting vitals update:', bcErr);
            }
          }
        } catch (err: any) {
          set({ isSaving: false, error: err.message || 'Failed to save character.' });
        } finally {
          resolversToNotify.forEach((r) => r());
        }
      };

      if (immediate) {
        executeSave();
      } else {
        if (characterSaveDebounceTimer) {
          clearTimeout(characterSaveDebounceTimer);
        }
        characterSaveDebounceTimer = setTimeout(executeSave, 350);
      }
    });
  },

  refreshCatalogs: async () => {
    const email = (get().playerEmail || '').trim().toLowerCase();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getCatalogCacheKey(email));
      localStorage.removeItem(CATALOGS_CACHE_KEY);
    }
    await get().fetchInitialData({ silent: true, forceRefresh: true });
  },

  deleteCharacter: async (id: number) => {
    set({ isSaving: true });
    try {
      await gameApi.deleteCharacter(id);
      set((state) => {
        const remaining = state.characters.filter((c) => c.id !== id);
        return {
          isSaving: false,
          characters: remaining,
          activeCharacter: state.activeCharacter?.id === id ? remaining[0] || null : state.activeCharacter,
        };
      });
    } catch (err: any) {
      set({ isSaving: false, error: err.message || 'Failed to delete character.' });
    }
  },

  addCharge: (amount = 1) => {
    get().updateActiveSheetData((prev) => {
      const currentCharges = prev.charges ?? prev.sparks ?? 0;
      const nextCharges = Math.min(5, currentCharges + amount);
      const isSparked = nextCharges === 5;
      return {
        ...prev,
        charges: nextCharges,
        is_sparked: isSparked,
        sparks: nextCharges,
        is_charged: isSparked,
      };
    });
  },

  spendSpark: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      charges: 0,
      is_sparked: false,
      sparks: 0,
      is_charged: false,
    }));
  },

  resetCharges: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      charges: 0,
      is_sparked: false,
      sparks: 0,
      is_charged: false,
    }));
  },

  addSpark: (amount = 1) => get().addCharge(amount),
  spendMeta: () => get().spendSpark(),
  spendBolt: () => get().spendSpark(),
  resetSparks: () => get().resetCharges(),

  spendLuckForBolt: () => {
    const active = get().activeCharacter;
    if (!active || !active.sheet_data) return { success: false, error: 'No active character.' };

    const sheet = active.sheet_data;
    if (sheet.luck_bolt_sub_used_in_encounter) {
      return { success: false, error: 'Luck-for-Bolt substitution has already been used in this encounter (1 per encounter).' };
    }

    const currentLuck = sheet.luck ?? 0;
    if (currentLuck <= 0) {
      return { success: false, error: 'Insufficient Luck chits to substitute for a Bolt.' };
    }

    const nextLuck = Math.max(0, currentLuck - 1);
    get().updateActiveSheetData((prev) => ({
      ...prev,
      luck: nextLuck,
      luck_bolt_sub_used_in_encounter: true,
    }));

    return { success: true };
  },

  resetEncounterSubstitutions: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      luck_bolt_sub_used_in_encounter: false,
    }));
  },

  toggleReadyPower: (_powerName: string) => {
    // Deprecated: In MetaScape, all learned powers are always available on the character sheet.
    return { success: true };
  },

  executeTacticalPivot: (_unreadyPowerName: string, _readyPowerName: string, _useLuckInsteadOfBolt: boolean = false) => {
    // Deprecated: All learned powers are always available, eliminating between-combat power swaps.
    return { success: true };
  },

  resetTacticalPivot: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      tactical_pivot_used_in_encounter: false,
      luck_bolt_sub_used_in_encounter: false,
    }));
  },

  // @deprecated Dual combat stances removed in favor of single Active Exotic Powers loadout
  switchFunctionStance: (_targetStance: 'alpha' | 'beta') => {
    return { success: true, cost: 'M' as const };
  },

  executeHardwareShunt: (vaultItemName: string, outgoingSlotNames: string[]) => {
    const active = get().activeCharacter;
    if (!active || !active.sheet_data) return { success: false, error: 'No active character.' };

    const sheet = active.sheet_data;
    const currentLuck = typeof sheet.luck === 'number' ? sheet.luck : 3;
    if (currentLuck < 1) {
      return { success: false, error: 'Emergency Hardware Shunt requires 1 Luck Chit (🍀).' };
    }

    const slotKey = 'spell_slots';
    const currentSlots: AbilitySlot[] = Array.isArray(sheet[slotKey]) ? [...(sheet[slotKey] as AbilitySlot[])] : [];
    const currentVault: MagicItem[] = Array.isArray(sheet.character_vault) ? [...sheet.character_vault] : [];

    const vaultIdx = currentVault.findIndex(
      (v) => v && v.name && v.name.trim().toLowerCase() === vaultItemName.trim().toLowerCase()
    );
    if (vaultIdx < 0) return { success: false, error: `Vault item "${vaultItemName}" not found.` };

    const incomingVault = currentVault[vaultIdx];

    // Remove outgoing slots
    const outgoingSet = new Set(outgoingSlotNames.map((n) => n.trim().toLowerCase()));
    const filteredSlots = currentSlots.filter(
      (s) => s && s.name && !outgoingSet.has(s.name.trim().toLowerCase())
    );

    // Create incoming slot
    const newSlot: any = {
      select: true,
      name: incomingVault.name,
      base_name: incomingVault.base_name || incomingVault.name.replace(/\s*\[[A-Z]+\]$/i, '').trim(),
      version: incomingVault.version || 1,
      action: (incomingVault.action?.toUpperCase() as any) || 'P',
      usage: incomingVault.usage || '1-Enc',
      effect: incomingVault.effect || '',
      checked: incomingVault.checked_state || [false, false, false],
      notes: incomingVault.notes,
      source: incomingVault.source,
      source_gear: (incomingVault as any).source_gear,
      source_mod: (incomingVault as any).source_mod,
      category: incomingVault.category || null,
      slot_weight: incomingVault.slot_weight ?? 1,
    };
    filteredSlots.push(newSlot);

    // Update Cold Storage with all removed functions
    const coldStorage = Array.isArray(sheet.cold_storage_functions) ? [...sheet.cold_storage_functions] : [];
    outgoingSlotNames.forEach((name) => {
      if (name && !coldStorage.includes(name)) {
        coldStorage.push(name);
      }
    });

    const nextLuck = Math.max(0, currentLuck - 1);

    get().updateActiveSheetData((prev) => ({
      ...prev,
      [slotKey]: filteredSlots,
      cold_storage_functions: coldStorage,
      luck: nextLuck,
    }));
    get().saveActiveCharacter();

    return { success: true };
  },

  resetStanceSwitches: () => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      stance_switch_count: 0,
      cold_storage_functions: [],
    }));
  },

  recordApExpenditure: (cost, category, description, tier, source) => {
    get().updateActiveSheetData((prev) => {
      const log = prev.ap_log || [];
      const newEntry = {
        id: `ap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString(),
        category,
        cost,
        description,
        tier,
        source,
      };
      const updatedLog = [newEntry, ...log];
      const currentAp = typeof prev.ap === 'number' ? prev.ap : 1;
      const nextAp = Math.max(0, currentAp - cost);

      return {
        ...prev,
        ap: nextAp,
        ap_log: updatedLog,
      };
    });
  },

  revertApExpenditure: (entryId: string) => {
    get().updateActiveSheetData((prev) => {
      const log = prev.ap_log || [];
      const target = log.find((e) => e.id === entryId);
      if (!target) return prev;

      const updatedLog = log.filter((e) => e.id !== entryId);
      const currentAp = typeof prev.ap === 'number' ? prev.ap : 0;
      const nextAp = currentAp + target.cost;

      return {
        ...prev,
        ap: nextAp,
        ap_log: updatedLog,
      };
    });
  },

  syncSheetRulesToDatabase: async () => {
    const active = get().activeCharacter;
    if (!active || !active.sheet_data) return { updatedCount: 0, preservedCount: 0 };

    let updatedCount = 0;
    let preservedCount = 0;

    try {
      const [powers, magicItems, weapons, armor, shields] = await Promise.all([
        gameApi.getPowers().catch(() => []),
        gameApi.getMagicItems().catch(() => []),
        gameApi.getWeapons().catch(() => []),
        gameApi.getArmor().catch(() => []),
        gameApi.getShields().catch(() => []),
      ]);

      const sheet = active.sheet_data;

      // Powers & Spells
      const updateAbilitySlots = (slots: any[]) => {
        return (slots || []).map((slot: any) => {
          if (!slot || !slot.name || (slot.version && slot.version > 1)) {
            if (slot && slot.name) preservedCount++;
            return slot;
          }
          const match = powers.find((p: any) => p.name.trim().toLowerCase() === slot.name.trim().toLowerCase());
          if (match) {
            updatedCount++;
            return {
              ...slot,
              action: match.action || slot.action,
              usage: match.usage || slot.usage,
              effect: match.effect || slot.effect,
            };
          }
          preservedCount++;
          return slot;
        });
      };

      // Magic Items / Gear
      const updatedGearSlots = (sheet.gear_slots || []).map((item: any) => {
        if (!item || !item.name || (item.version && item.version > 1)) {
          if (item && item.name) preservedCount++;
          return item;
        }
        const match = magicItems.find((m: any) => m.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          return {
            ...item,
            usage: match.usage || item.usage,
            effect: match.effect || item.effect,
          };
        }
        preservedCount++;
        return item;
      });

      // Weapons
      const updatedWeapons = (sheet.weapons || []).map((w: any) => {
        if (!w || !w.name) return w;
        const match = weapons.find((masterW: any) => masterW.name.trim().toLowerCase() === w.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          return {
            ...w,
            atk: match.atk || w.atk,
            dmg: match.dmg || w.dmg,
            max_blk: match.max_block || w.max_blk,
          };
        }
        preservedCount++;
        return w;
      });

      // Armor
      let updatedArmor = sheet.armor_slot;
      if (sheet.armor_slot && sheet.armor_slot.name && sheet.armor_slot.name !== 'Unarmored') {
        const match = armor.find((a: any) => a.name.trim().toLowerCase() === sheet.armor_slot!.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          updatedArmor = {
            ...sheet.armor_slot,
            ar: parseInt(String(match.ar).replace(/[^\d]/g, ''), 10) || sheet.armor_slot.ar,
            mr: match.mr || sheet.armor_slot.mr,
            requirement: match.requirement || sheet.armor_slot.requirement,
            cost: match.cost || sheet.armor_slot.cost,
          };
        } else {
          preservedCount++;
        }
      }

      // Shield
      let updatedShield = sheet.shield_slot;
      if (sheet.shield_slot && sheet.shield_slot.name) {
        const match = shields.find((s: any) => s.name.trim().toLowerCase() === sheet.shield_slot!.name.trim().toLowerCase());
        if (match) {
          updatedCount++;
          const shieldBlockNum = typeof match.max_block === 'number' ? match.max_block : parseInt(String(match.max_block).replace(/[^\d]/g, ''), 10);
          updatedShield = {
            ...sheet.shield_slot,
            max_block: shieldBlockNum || sheet.shield_slot.max_block,
            mr_adjustment: match.mr || sheet.shield_slot.mr_adjustment,
            requirement: match.requirement || sheet.shield_slot.requirement,
            cost: match.cost || sheet.shield_slot.cost,
          };
        } else {
          preservedCount++;
        }
      }

      get().updateActiveSheetData((prev) => ({
        ...prev,
        power_slots: updateAbilitySlots(prev.power_slots),
        spell_slots: updateAbilitySlots(prev.spell_slots),
        gear_slots: updatedGearSlots,
        weapons: updatedWeapons,
        armor_slot: updatedArmor,
        shield_slot: updatedShield,
      }));

      await get().saveActiveCharacter();
      return { updatedCount, preservedCount };
    } catch (err) {
      console.error('Error syncing sheet rules:', err);
      return { updatedCount: 0, preservedCount: 0 };
    }
  },

  // --- DESIGNER MODE CATALOG FRESHNESS ---
  updateCanonicalCatalogItem: (type: string, item: any, oldName?: string) => {
    const cleanOld = (oldName || item.name || '').trim().toLowerCase();
    const cleanNew = (item.name || '').trim();

    if (type === 'power') {
      const updated = get().powers.map((p) =>
        (p.name || '').trim().toLowerCase() === cleanOld ? { ...p, ...item } : p
      );
      if (!updated.some((p) => (p.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ powers: updated });
    } else if (type === 'path') {
      const updated = get().paths.map((p) =>
        (p.name || '').trim().toLowerCase() === cleanOld || String(p.id) === String(item.id)
          ? { ...p, ...item }
          : p
      );
      if (!updated.some((p) => (p.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ paths: updated });
    } else if (type === 'weapon') {
      const updated = get().weaponsCatalog.map((w) =>
        (w.name || '').trim().toLowerCase() === cleanOld ? { ...w, ...item } : w
      );
      if (!updated.some((w) => (w.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ weaponsCatalog: updated });
    } else if (type === 'armor') {
      const updated = get().armorCatalog.map((a) =>
        (a.name || '').trim().toLowerCase() === cleanOld ? { ...a, ...item } : a
      );
      if (!updated.some((a) => (a.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ armorCatalog: updated });
    } else if (type === 'shield') {
      const updated = get().shieldsCatalog.map((s) =>
        (s.name || '').trim().toLowerCase() === cleanOld ? { ...s, ...item } : s
      );
      if (!updated.some((s) => (s.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ shieldsCatalog: updated });
    } else if (type === 'gear' || type === 'supplies') {
      const updated = get().suppliesCatalog.map((g) =>
        (g.name || '').trim().toLowerCase() === cleanOld ? { ...g, ...item } : g
      );
      if (!updated.some((g) => (g.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ suppliesCatalog: updated });
    } else if (type === 'trait') {
      const updated = get().traits.map((t) =>
        (t.name || '').trim().toLowerCase() === cleanOld ? { ...t, ...item } : t
      );
      if (!updated.some((t) => (t.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ traits: updated });
    } else if (type === 'skill') {
      const updated = get().skills.map((s) =>
        (s.name || '').trim().toLowerCase() === cleanOld || String(s.id) === String(item.id)
          ? { ...s, ...item }
          : s
      );
      if (!updated.some((s) => (s.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ skills: updated });
    } else if (type === 'chaos_gem' || type === 'chaos_gems') {
      const updated = get().chaosGemsCatalog.map((cg) =>
        (cg.name || '').trim().toLowerCase() === cleanOld || String(cg.id) === String(item.id)
          ? { ...cg, ...item }
          : cg
      );
      if (!updated.some((cg) => (cg.name || '').trim().toLowerCase() === cleanNew.toLowerCase())) {
        updated.push(item);
      }
      set({ chaosGemsCatalog: updated });
    }

    if (typeof window !== 'undefined') {
      const email = (get().playerEmail || '').trim().toLowerCase();
      localStorage.removeItem(getCatalogCacheKey(email));
      localStorage.removeItem(CATALOGS_CACHE_KEY);
    }

    // Immediately re-reconcile active character in memory if open
    const activeChar = get().activeCharacter;
    if (activeChar && activeChar.sheet_data) {
      let currentSheet = activeChar.sheet_data;
      if (oldName || item.name) {
        const propRes = updateCharacterSheetCanonicalItem(
          currentSheet,
          type as CanonicalEntityType,
          oldName || item.name,
          item
        );
        if (propRes.wasModified) {
          currentSheet = propRes.updatedSheet;
        }
      }

      const { updatedSheetData, modifiedCount } = reconcileCanonicalSnapshots(
        currentSheet,
        {
          powers: get().powers,
          weapons: get().weaponsCatalog,
          armor: get().armorCatalog,
          shields: get().shieldsCatalog,
          traits: get().traits,
          supplies: get().suppliesCatalog,
        }
      );

      if (modifiedCount > 0 || currentSheet !== activeChar.sheet_data) {
        set({ activeCharacter: { ...activeChar, sheet_data: updatedSheetData } });
      }
    }
  },

  removeCanonicalCatalogItem: (type: string, id: string | number, name?: string) => {
    const cleanName = (name || '').trim().toLowerCase();
    const strId = String(id);

    if (type === 'power') {
      set({ powers: get().powers.filter((p) => String(p.id) !== strId && (p.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'path') {
      set({ paths: get().paths.filter((p) => String(p.id) !== strId && (p.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'weapon') {
      set({ weaponsCatalog: get().weaponsCatalog.filter((w) => String(w.id) !== strId && (w.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'armor') {
      set({ armorCatalog: get().armorCatalog.filter((a) => String(a.id) !== strId && (a.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'shield') {
      set({ shieldsCatalog: get().shieldsCatalog.filter((s) => String(s.id) !== strId && (s.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'gear' || type === 'supplies') {
      set({ suppliesCatalog: get().suppliesCatalog.filter((g) => String(g.id) !== strId && (g.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'trait') {
      set({ traits: get().traits.filter((t) => String(t.id) !== strId && (t.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'skill') {
      set({ skills: get().skills.filter((s) => String(s.id) !== strId && (s.name || '').trim().toLowerCase() !== cleanName) });
    } else if (type === 'chaos_gem' || type === 'chaos_gems') {
      set({ chaosGemsCatalog: get().chaosGemsCatalog.filter((cg) => String(cg.id) !== strId && (cg.name || '').trim().toLowerCase() !== cleanName) });
    }

    if (typeof window !== 'undefined') {
      const email = (get().playerEmail || '').trim().toLowerCase();
      localStorage.removeItem(getCatalogCacheKey(email));
      localStorage.removeItem(CATALOGS_CACHE_KEY);
    }

    // Immediately purge from active character in memory if open
    const activeChar = get().activeCharacter;
    if (activeChar && activeChar.sheet_data) {
      const { updatedSheet, wasModified } = removeCharacterSheetCanonicalItem(
        activeChar.sheet_data,
        type as CanonicalEntityType,
        name || '',
        id
      );
      if (wasModified) {
        set({ activeCharacter: { ...activeChar, sheet_data: updatedSheet } });
      }
    }
  },

  // --- PLAYER LINKS (Account-Wide) ---
  fetchPlayerLinks: () => {
    const email = (get().playerEmail || '').trim().toLowerCase();
    if (!email) {
      set({ playerLinks: [] });
      return;
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`supaflex_player_links_${email}`);
        if (saved) {
          set({ playerLinks: JSON.parse(saved) });
          return;
        }
      } catch {}
    }
    set({ playerLinks: [] });
  },

  addPlayerLink: (name: string, url: string, tag?: string, desc?: string) => {
    const email = (get().playerEmail || '').trim().toLowerCase();
    const newLink: EncounterLink = {
      id: `pl_link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      url: url ? url.trim() : undefined,
      categoryTag: tag || 'General',
      description: desc?.trim() || undefined,
      isNote: !url || !url.trim(),
      created_at: new Date().toISOString(),
    };
    const updated = [...get().playerLinks, newLink];
    set({ playerLinks: updated });
    if (email) {
      try {
        localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(updated));
      } catch {}
    }
  },

  updatePlayerLink: (linkId: string, name: string, url: string, tag?: string, desc?: string) => {
    const email = (get().playerEmail || '').trim().toLowerCase();
    const updated = get().playerLinks.map((l) =>
      l.id === linkId
        ? {
            ...l,
            name: name.trim(),
            url: url ? url.trim() : undefined,
            categoryTag: tag || l.categoryTag || 'General',
            description: desc !== undefined ? desc.trim() : l.description,
            isNote: !url || !url.trim(),
          }
        : l
    );
    set({ playerLinks: updated });
    if (email) {
      try {
        localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(updated));
      } catch {}
    }
  },

  deletePlayerLink: (linkId: string) => {
    const email = (get().playerEmail || '').trim().toLowerCase();
    const updated = get().playerLinks.filter((l) => l.id !== linkId);
    set({ playerLinks: updated });
    if (email) {
      try {
        localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(updated));
      } catch {}
    }
  },

  reorderPlayerLinkByIndex: (fromIdx: number, toIdx: number) => {
    const email = (get().playerEmail || '').trim().toLowerCase();
    const links = [...get().playerLinks];
    if (fromIdx < 0 || fromIdx >= links.length || toIdx < 0 || toIdx >= links.length) return;
    const [moved] = links.splice(fromIdx, 1);
    links.splice(toIdx, 0, moved);
    set({ playerLinks: links });
    if (email) {
      try {
        localStorage.setItem(`supaflex_player_links_${email}`, JSON.stringify(links));
      } catch {}
    }
  },

  // --- CHARACTER LINKS & NOTES (Character-Specific) ---
  addCharacterLink: (name: string, url: string, tag?: string, desc?: string) => {
    const newLink: EncounterLink = {
      id: `char_link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      url: url ? url.trim() : undefined,
      categoryTag: tag || 'General',
      description: desc?.trim() || undefined,
      isNote: !url || !url.trim(),
      created_at: new Date().toISOString(),
    };
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: [...(prev.character_links || []), newLink],
    }));
    get().saveActiveCharacter();
  },

  updateCharacterLink: (linkId: string, name: string, url: string, tag?: string, desc?: string) => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: (prev.character_links || []).map((l) =>
        l.id === linkId
          ? {
              ...l,
              name: name.trim(),
              url: url ? url.trim() : undefined,
              categoryTag: tag || l.categoryTag || 'General',
              description: desc !== undefined ? desc.trim() : l.description,
              isNote: !url || !url.trim(),
            }
          : l
      ),
    }));
    get().saveActiveCharacter();
  },

  deleteCharacterLink: (linkId: string) => {
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: (prev.character_links || []).filter((l) => l.id !== linkId),
    }));
    get().saveActiveCharacter();
  },

  reorderCharacterLinkByIndex: (fromIdx: number, toIdx: number) => {
    const charLinks = get().activeCharacter?.sheet_data?.character_links || [];
    if (fromIdx < 0 || fromIdx >= charLinks.length || toIdx < 0 || toIdx >= charLinks.length) return;
    const links = [...charLinks];
    const [moved] = links.splice(fromIdx, 1);
    links.splice(toIdx, 0, moved);
    get().updateActiveSheetData((prev) => ({
      ...prev,
      character_links: links,
    }));
    get().saveActiveCharacter();
  },

  // --- TRAITS & QUIRKS ACTIONS ---
  addTraitQuirk: (trait: TraitQuirkItem) => {
    get().updateActiveSheetData((prev) => {
      const existing = prev.traits_quirks || [];
      const alreadyHas = existing.some((t) => (t.id && trait.id && t.id === trait.id) || t.name.toLowerCase() === trait.name.toLowerCase());
      if (alreadyHas) return prev;
      return {
        ...prev,
        traits_quirks: [...existing, trait],
      };
    });
    get().saveActiveCharacter();
  },

  removeTraitQuirk: (traitNameOrId: string | number, forceGmOverride = false): boolean => {
    const activeRole = get().activeRole;
    const existing = get().activeCharacter?.sheet_data?.traits_quirks || [];
    const target = existing.find((t) =>
      typeof traitNameOrId === 'number' ? t.id === traitNameOrId : t.name === traitNameOrId || t.id === traitNameOrId
    );

    // Paid traits (ap_cost > 0) are learned/purchased abilities and can always be removed by the player.
    const isPaid = typeof target?.ap_cost === 'number' && target.ap_cost > 0;

    const isInherentTrait =
      !isPaid &&
      target &&
      (target.ap_cost === 0 ||
        (target.path && (target.path.includes('{Free}') || target.path.includes('{Perk}') || target.path.includes('{Trait}'))) ||
        (target.kit && (target.kit.includes('{Free}') || target.kit.includes('{Perk}') || target.kit.includes('{Trait}'))) ||
        (target.source && (target.source.includes('{Free}') || target.source.includes('{Perk}') || target.source.includes('{Trait}'))) ||
        (target.table_group && (target.table_group.includes('{Free}') || target.table_group.includes('{Perk}') || target.table_group.includes('{Trait}'))));

    if (isInherentTrait && activeRole !== 'gm' && !forceGmOverride) {
      alert('Inherent traits (0 AP) are auto-taken and cannot be removed without GM approval. Switch to GM Mode to remove traits.');
      return false;
    }

    get().updateActiveSheetData((prev) => {
      const prevExisting = prev.traits_quirks || [];
      return {
        ...prev,
        traits_quirks: prevExisting.filter((t) => {
          if (typeof traitNameOrId === 'number') {
            return t.id !== traitNameOrId;
          }
          return t.name !== traitNameOrId && t.id !== traitNameOrId;
        }),
      };
    });
    get().saveActiveCharacter();
    return true;
  },

  toggleTraitVisibility: (traitNameOrId: string | number) => {
    get().updateActiveSheetData((prev) => {
      const existing = prev.traits_quirks || [];
      const updated = existing.map((t) => {
        const matches = (typeof traitNameOrId === 'number' && t.id === traitNameOrId) ||
          t.name === traitNameOrId ||
          t.id === traitNameOrId;
        if (matches) {
          return {
            ...t,
            is_hidden: !t.is_hidden,
          };
        }
        return t;
      });
      return {
        ...prev,
        traits_quirks: updated,
      };
    });
    get().saveActiveCharacter();
  },

  toggleStarTrait: (id: string | number) => {
    get().updateActiveSheetData((prev) => {
      const current = prev.starred_traits || [];
      const isStarred = current.includes(id);
      return {
        ...prev,
        starred_traits: isStarred ? current.filter((x) => x !== id) : [...current, id],
      };
    });
    get().saveActiveCharacter();
  },

  toggleFavoriteTraitTable: (tableGroup: string) => {
    get().toggleFavoriteTraitKit(tableGroup);
  },

  toggleFavoriteTraitKit: (kitName: string) => {
    get().updateActiveSheetData((prev) => {
      const currentKits: string[] = prev.favorite_trait_kits || prev.favorite_trait_tables || [];
      const isFav = currentKits.includes(kitName);
      const nextList = isFav ? currentKits.filter((x: string) => x !== kitName) : [...currentKits, kitName];
      return {
        ...prev,
        favorite_trait_kits: nextList,
        favorite_trait_tables: nextList,
      };
    });
    get().saveActiveCharacter();
  },

  // --- HARDWARE BUNDLES ACTIONS ---
  addHardwareBundle: (bundle: HardwareBundleItem) => {
    get().updateActiveSheetData((prev) => {
      const existing = prev.hardware_bundles || [];
      const alreadyHas = existing.some(
        (b) => (b.id && bundle.id && b.id === bundle.id) || b.name.toLowerCase() === bundle.name.toLowerCase()
      );
      if (alreadyHas) return prev;
      return {
        ...prev,
        hardware_bundles: [...existing, bundle],
      };
    });
    get().saveActiveCharacter();
  },

  removeHardwareBundle: (bundleNameOrId: string | number) => {
    get().updateActiveSheetData((prev) => {
      const existing = prev.hardware_bundles || [];
      return {
        ...prev,
        hardware_bundles: existing.filter((b) => {
          if (typeof bundleNameOrId === 'number' || (typeof bundleNameOrId === 'string' && bundleNameOrId.length > 20)) {
            return b.id !== bundleNameOrId && b.name !== bundleNameOrId;
          }
          return b.name.toLowerCase() !== String(bundleNameOrId).toLowerCase();
        }),
      };
    });
    get().saveActiveCharacter();
  },

  toggleHardwareBundleVisibility: (bundleNameOrId: string | number) => {
    get().updateActiveSheetData((prev) => {
      const existing = prev.hardware_bundles || [];
      const updated = existing.map((b) => {
        const matches =
          b.id === bundleNameOrId ||
          b.name.toLowerCase() === String(bundleNameOrId).toLowerCase();
        if (matches) {
          return {
            ...b,
            is_hidden: !b.is_hidden,
          };
        }
        return b;
      });
      return {
        ...prev,
        hardware_bundles: updated,
      };
    });
    get().saveActiveCharacter();
  },

  learnGearPower: (power: GearPowerItem, hostGearName: string, hostModName?: string) => {
    const active = get().activeCharacter;
    if (!active) return false;
    const currentSheet = active.sheet_data || createDefaultSheetData();
    const availableAp = calculateAvailableAp(currentSheet.level || 1, currentSheet);
    if (availableAp < 1) return false;

    const currentSpellSlots: AbilitySlot[] = Array.isArray(currentSheet.spell_slots) ? [...currentSheet.spell_slots] : [];
    if (isGearPowerLearned(power.name, currentSpellSlots)) return true;

    const parseUsageCount = (usage?: string): number => {
      if (!usage) return 0;
      const match = usage.trim().match(/^([1-3])/);
      return match ? parseInt(match[1], 10) : 0;
    };
    const usageCount = parseUsageCount(power.usage);

    const newSlot: AbilitySlot = {
      select: false,
      name: power.name,
      action: (power.action || 'P') as any,
      usage: power.usage || '1-Enc',
      effect: power.effect || '',
      checked: usageCount > 0 ? Array(usageCount).fill(false) : [],
      notes: power.notes || '',
      ap_cost: 1,
      source_gear: hostGearName,
      source_mod: hostModName || '',
    };

    const newLogEntry: ApLogEntry = {
      id: String(Date.now()),
      category: 'Gear Powers',
      description: `Learned ${power.name}`,
      source: hostGearName,
      tier: 1,
      cost: 1,
      timestamp: new Date().toISOString(),
    };

    const currentLog: ApLogEntry[] = Array.isArray(currentSheet.ap_log) ? [...currentSheet.ap_log] : [];

    get().updateActiveSheetData((sheet) => ({
      ...sheet,
      spell_slots: [...currentSpellSlots, newSlot],
      ap_log: [...currentLog, newLogEntry],
    }));
    get().saveActiveCharacter();
    return true;
  },

  unlearnGearPower: (powerName: string) => {
    const active = get().activeCharacter;
    if (!active) return;
    const currentSheet = active.sheet_data || createDefaultSheetData();
    const currentSpellSlots: AbilitySlot[] = Array.isArray(currentSheet.spell_slots) ? [...currentSheet.spell_slots] : [];
    
    const target = cleanAbilityName(powerName);
    const filtered = currentSpellSlots.filter(
      (s) => cleanAbilityName(s.name) !== target && cleanAbilityName(s.base_name) !== target
    );
    if (filtered.length === currentSpellSlots.length) return;

    const newLogEntry: ApLogEntry = {
      id: String(Date.now()),
      category: 'Gear Powers',
      description: `Refunded ${powerName}`,
      source: 'Refund',
      tier: 1,
      cost: -1,
      timestamp: new Date().toISOString(),
    };

    const currentLog: ApLogEntry[] = Array.isArray(currentSheet.ap_log) ? [...currentSheet.ap_log] : [];

    get().updateActiveSheetData((sheet) => ({
      ...sheet,
      spell_slots: filtered,
      ap_log: [...currentLog, newLogEntry],
    }));
    get().saveActiveCharacter();
  },

  toggleGearPowerUsage: (powerName: string, checkIndex: number) => {
    const active = get().activeCharacter;
    if (!active) return;
    const currentSheet = active.sheet_data || createDefaultSheetData();
    const currentSpellSlots: AbilitySlot[] = Array.isArray(currentSheet.spell_slots) ? [...currentSheet.spell_slots] : [];
    const target = cleanAbilityName(powerName);
    const slotIdx = currentSpellSlots.findIndex(
      (s) => cleanAbilityName(s.name) === target || cleanAbilityName(s.base_name) === target
    );
    if (slotIdx === -1) return;

    const slotToUpdate = { ...currentSpellSlots[slotIdx] };
    const newChecked = [...(slotToUpdate.checked || [false, false, false])];
    newChecked[checkIndex] = !newChecked[checkIndex];
    slotToUpdate.checked = newChecked;
    currentSpellSlots[slotIdx] = slotToUpdate;

    get().updateActiveSheetData((sheet) => ({
      ...sheet,
      spell_slots: currentSpellSlots,
    }));
    get().saveActiveCharacter();
  },

  clearAllGearPowerUses: () => {
    const active = get().activeCharacter;
    if (!active) return;
    const currentSheet = active.sheet_data || createDefaultSheetData();
    const currentSpellSlots: AbilitySlot[] = Array.isArray(currentSheet.spell_slots) ? currentSheet.spell_slots : [];
    const cleared = currentSpellSlots.map((s) => ({
      ...s,
      checked: Array.isArray(s.checked) ? s.checked.map(() => false) : [false, false, false],
    }));

    get().updateActiveSheetData((sheet) => ({
      ...sheet,
      spell_slots: cleared,
    }));
    get().saveActiveCharacter();
  },

  installModToGearItem: (modItem: ModItem, hostName: string) => {
    const active = get().activeCharacter;
    if (!active) return { success: false, error: 'No active character' };
    const currentSheet = active.sheet_data || createDefaultSheetData();
    const gold = currentSheet.gold || 0;
    const silver = currentSheet.silver || 0;
    const costInSilver = parseCostToSilver(modItem.cost || '0s');

    const deduction = deductFundsWithChange(gold, silver, costInSilver);
    if (!deduction.success) {
      return { success: false, error: 'Not enough money' };
    }

    const currentGear = [...(currentSheet.simple_gear || [])];
    const hostIdx = currentGear.findIndex(
      (g) => cleanBelongsToName(g.name) === cleanBelongsToName(hostName)
    );
    if (hostIdx === -1) return { success: false, error: 'Host gear item not found' };

    const host = currentGear[hostIdx];
    const installedMods = new Set<string>(host.installed_mods || []);
    if (installedMods.has(modItem.name)) {
      return { success: true };
    }
    installedMods.add(modItem.name);

    // If previously marked removed, restore it
    const cleanModName = cleanBelongsToName(modItem.name);
    const updatedRemoved = (host.removed_mods || []).filter(
      (m) => cleanBelongsToName(m) !== cleanModName
    );

    currentGear[hostIdx] = {
      ...host,
      installed_mods: Array.from(installedMods),
      removed_mods: updatedRemoved,
    };

    get().updateActiveSheetData((sheet) => ({
      ...sheet,
      simple_gear: currentGear,
      gold: deduction.newGold,
      silver: deduction.newSilver,
    }));
    get().saveActiveCharacter();
    return { success: true };
  },

  uninstallModFromGearItem: (modName: string, hostName: string) => {
    const active = get().activeCharacter;
    if (!active) return { success: false, error: 'No active character' };
    const currentSheet = active.sheet_data || createDefaultSheetData();

    const currentGear = [...(currentSheet.simple_gear || [])];
    const hostIdx = currentGear.findIndex(
      (g) => cleanBelongsToName(g.name) === cleanBelongsToName(hostName)
    );
    if (hostIdx === -1) return { success: false, error: 'Host gear item not found' };

    const host = currentGear[hostIdx];
    const cleanTargetMod = cleanBelongsToName(modName);

    // 1. Remove from installed_mods
    const updatedInstalled = (host.installed_mods || []).filter(
      (m) => cleanBelongsToName(m) !== cleanTargetMod
    );

    // 2. Add to removed_mods (overrides inherent free mods)
    const removedSet = new Set((host.removed_mods || []).map(cleanBelongsToName));
    removedSet.add(cleanTargetMod);

    currentGear[hostIdx] = {
      ...host,
      installed_mods: updatedInstalled,
      removed_mods: Array.from(removedSet),
    };

    // 3. Find powers belonging to this mod and unlearn them with AP refund
    const effectiveFunctions = get().functionsCatalog || [];
    const modFns = getFunctionsForMod(modName, effectiveFunctions);
    const modFnNames = new Set(modFns.map((fn) => cleanAbilityName(fn.name)));

    const currentSpellSlots: AbilitySlot[] = Array.isArray(currentSheet.spell_slots) ? [...currentSheet.spell_slots] : [];
    const unlearnedSlots: AbilitySlot[] = [];
    const remainingSpellSlots: AbilitySlot[] = [];

    currentSpellSlots.forEach((slot) => {
      const slotName = cleanAbilityName(slot.name);
      const slotBase = cleanAbilityName(slot.base_name);
      const slotMod = cleanBelongsToName((slot as any).source_mod);
      const matchesMod =
        slotMod === cleanTargetMod ||
        modFnNames.has(slotName) ||
        modFnNames.has(slotBase);

      if (matchesMod) {
        unlearnedSlots.push(slot);
      } else {
        remainingSpellSlots.push(slot);
      }
    });

    const refundAp = unlearnedSlots.length;
    const refundLogEntry: ApLogEntry | null =
      refundAp > 0
        ? {
            id: `refund_mod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            category: 'Gear Powers',
            description: `Refund ${refundAp} AP from removed mod: ${modName}`,
            source: hostName,
            tier: 1,
            cost: -refundAp,
            timestamp: new Date().toISOString(),
          }
        : null;

    const currentLog = Array.isArray(currentSheet.ap_log) ? currentSheet.ap_log : [];

    get().updateActiveSheetData((sheet) => ({
      ...sheet,
      simple_gear: currentGear,
      spell_slots: remainingSpellSlots,
      ap_log: refundLogEntry ? [...currentLog, refundLogEntry] : currentLog,
    }));
    get().saveActiveCharacter();
    return { success: true, refundedAp: refundAp };
  },



  // Shared Ability Sort & Filter State & Setters
  abilitySortMode: 'action',
  abilityActionFilter: 'ALL',
  setAbilitySortMode: (mode: 'action' | 'name') => set({ abilitySortMode: mode }),
  setAbilityActionFilter: (filter: 'ALL' | 'AM' | 'A' | 'M' | 'P' | 'F') => set({ abilityActionFilter: filter }),
}));
