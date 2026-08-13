import { useEffect, useState, useRef, useMemo } from 'react';
import { Database, Shield, Activity, BookOpen, Loader2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { supabase } from './lib/supabase';
import { gameApi } from './services/api';
import { Character, TreasureItem, SimpleGearItem, MagicItem } from './types/game';
import { getItemSlotWeight } from './utils/magicSlotSchedule';
import { useCharacterStore } from './store/useCharacterStore';
import { CharacterSheetView } from './components/sheet/CharacterSheetView';
import { AdventureLogs } from './components/logs/AdventureLogs';
import { GmWorkspaceView } from './components/directory/GmWorkspaceView';
import { PersistentHeaderHUD } from './components/header/PersistentHeaderHUD';
import { AccountPillButton } from './components/header/AccountPillButton';
import { GmHeaderHUD } from './components/header/GmHeaderHUD';
import { ResourcesPopover } from './components/header/ResourcesPopover';
import { LootGeneratorModal } from './components/modals/LootGeneratorModal';
import { NishTcModal } from './components/modals/NishTcModal';
import { ApManagerModal } from './components/modals/ApManagerModal';
import { AttributeManagerModal } from './components/modals/AttributeManagerModal';
import { VitalityManagerModal } from './components/modals/VitalityManagerModal';
import { FocusManagerModal } from './components/modals/FocusManagerModal';
import { UnifiedLaunchHubModal } from './components/modals/UnifiedLaunchHubModal';
import { ErrorBoundary } from './components/modals/ErrorBoundary';
import { CardHelpButton } from './components/common/CardHelpButton';
import { UpdatePasswordModal } from './components/modals/UpdatePasswordModal';
import { resolveCharFirstName } from './components/common/PartyCharacterCard';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sheet' | 'logs'>('sheet');
  const [newCharName, setNewCharName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSelectorBar, setShowSelectorBar] = useState(false);
  const [showResourcesPopover, setShowResourcesPopover] = useState(false);
  const [showLootGeneratorModal, setShowLootGeneratorModal] = useState(false);
  const [showNishTcModal, setShowNishTcModal] = useState(false);
  const [showApManagerModal, setShowApManagerModal] = useState(false);
  const [showAttributeManagerModal, setShowAttributeManagerModal] = useState(false);
  const [showVitalityManagerModal, setShowVitalityManagerModal] = useState(false);
  const [showFocusManagerModal, setShowFocusManagerModal] = useState(false);
  const [openedFromApManager, setOpenedFromApManager] = useState(false);

  useEffect(() => {
    const handleOpen = () => setOpenedFromApManager(true);
    const handleClose = () => {
      setOpenedFromApManager((prev) => {
        if (prev) {
          setShowApManagerModal(true);
        }
        return false;
      });
    };

    window.addEventListener('supaflex:open-manager' as any, handleOpen);
    window.addEventListener('supaflex:close-manager' as any, handleClose);
    return () => {
      window.removeEventListener('supaflex:open-manager' as any, handleOpen);
      window.removeEventListener('supaflex:close-manager' as any, handleClose);
    };
  }, []);

  // Unified Launch Hub & Party Session State
  const [showUnifiedLaunchHubModal, setShowUnifiedLaunchHubModal] = useState(false);
  const [launchHubInitialTab, setLaunchHubInitialTab] = useState<'account' | 'inspect' | 'party'>('account');
  const [showUpdatePasswordModal, setShowUpdatePasswordModal] = useState(false);

  // GM Screen Active Room Code State
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);

  const tabSessionId = useCharacterStore((state) => state.tabSessionId);

  const selectorRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef<HTMLDivElement>(null);

  const {
    characters,
    activeCharacter,
    isLoading,
    dbConnected,
    playerEmail,
    activeRole,
    fetchInitialData,
    selectCharacter,
    createNewCharacter,
    saveActiveCharacter,
    updateActiveSheetData,
    setPlayerEmail,
    setPlayerName,
  } = useCharacterStore();

  useEffect(() => {
    fetchInitialData();

    const resolveGoogleName = (user: any): string => {
      if (!user?.user_metadata) return '';
      const meta = user.user_metadata;
      if (meta.full_name) return meta.full_name.trim();
      if (meta.name) return meta.name.trim();
      const parts = [meta.given_name, meta.family_name].filter(Boolean);
      if (parts.length > 0) return parts.join(' ').trim();
      return '';
    };

    const handleAuthUser = async (userEmail: string, googleName: string) => {
      setPlayerEmail(userEmail);
      const profile = await gameApi.getUserProfile(userEmail, googleName);
      if (profile.player_name) {
        setPlayerName(profile.player_name);
      } else if (googleName) {
        setPlayerName(googleName);
      }

      const { tabSessionId, activePartyId, activeCharacter } = useCharacterStore.getState();
      if (activePartyId && tabSessionId && activeCharacter?.id) {
        gameApi.ensureTabPartySession(activePartyId, tabSessionId, activeCharacter.id, userEmail).catch(console.error);
      }
    };

    // Restore existing Supabase Auth Session on mount (e.g., after Google OAuth redirect)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        const userEmail = user.email.trim().toLowerCase();
        const userName = resolveGoogleName(user);
        handleAuthUser(userEmail, userName);
      }
    });

    // Auth state listener — Handles OAuth logins, PASSWORD_RECOVERY redirect & URL cleanup.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        const userEmail = session.user.email.trim().toLowerCase();
        const userName = resolveGoogleName(session.user);
        await handleAuthUser(userEmail, userName);
        fetchInitialData();
      }

      if (event === 'PASSWORD_RECOVERY') {
        setShowUpdatePasswordModal(true);
      }
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token')) {
        if (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=recovery')) {
          setShowUpdatePasswordModal(true);
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchInitialData, setPlayerEmail, setPlayerName]);

  const activePartyId = useCharacterStore((state) => state.activePartyId);

  // Dynamic Browser Tab Title Lifecycle
  useEffect(() => {
    if (activeRole === 'gm') {
      document.title = 'SupaFlex GM Screen';
    } else if (activeCharacter?.name) {
      const charFirstName = resolveCharFirstName(activeCharacter.name);
      document.title = `SupaFlex ${charFirstName}`;
    } else {
      document.title = 'SupaFlex Companion';
    }
  }, [activeRole, activeCharacter?.name]);

  // Player Party Session Heartbeat & Window Unload Life-cycle
  useEffect(() => {
    if (!activePartyId || !tabSessionId) return;

    // Send immediate heartbeat on mount/party join
    gameApi.sendPlayerHeartbeat(tabSessionId).catch(console.error);

    // 15-second heartbeat loop
    const interval = setInterval(() => {
      gameApi.sendPlayerHeartbeat(tabSessionId).catch(console.error);
    }, 15000);

    const handleBeforeUnload = () => {
      gameApi.leavePartySession(tabSessionId, activePartyId).catch(console.error);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activePartyId, tabSessionId]);

  // NOTE: GM Room Code Checkout & Heartbeat have been moved entirely to GmWorkspaceView
  // to eliminate the double-checkout race condition that caused the stale Party ID bug.
  // GmWorkspaceView is the single authority: it checks out the room code on mount and
  // reports it back via the onRoomCodeReady callback prop.

  // Click-outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowSelectorBar(false);
      }
      if (resourcesRef.current && !resourcesRef.current.contains(event.target as Node)) {
        setShowResourcesPopover(false);
      }
    };
    if (showSelectorBar || showResourcesPopover) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showSelectorBar, showResourcesPopover]);

  const myHeroes = useMemo(() => {
    return characters
      .filter((c: Character) => {
        if (!playerEmail.trim()) return false;
        const owner = (c.owner_email || '').toLowerCase().trim();
        const current = playerEmail.toLowerCase().trim();
        return owner === current;
      })
      .sort((a: Character, b: Character) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [characters, playerEmail]);

  // Unauthenticated Login Guard: Auto-open modal and clear active character when signed out
  useEffect(() => {
    if (!playerEmail.trim()) {
      setShowUnifiedLaunchHubModal(true);
      if (activeCharacter !== null) {
        useCharacterStore.setState({ activeCharacter: null });
      }
    }
  }, [playerEmail, activeCharacter]);

  // Auto-sync active character when authenticated
  useEffect(() => {
    if (!playerEmail.trim()) return;

    if (myHeroes.length > 0) {
      const activeInMyHeroes = activeCharacter && myHeroes.some((c) => c.id === activeCharacter.id);
      if (!activeInMyHeroes) {
        selectCharacter(myHeroes[0].id);
      }
    }
  }, [myHeroes, activeCharacter, playerEmail, selectCharacter]);

  // Unified Move to Sheet Claim Handler

  const handleMoveToSheet = async (itemPayload: {
    title: string;
    categoryKey: string;
    description?: string;
    coinsSilver?: number;
    coinsGold?: number;
    valuableVal?: string;
    valuableCurrency?: 'gp' | 'sp';
    magicItem?: any;
    type?: string;
  }): Promise<boolean> => {
    if (!activeCharacter) return false;

    try {
      const category = itemPayload.categoryKey || '';
      const isMagic = category.startsWith('magic_') || itemPayload.type === 'magic_item' || !!itemPayload.magicItem;
      const isArtGems = category === 'art_gems' || itemPayload.type === 'art_gem';

      if (isMagic) {
        const m = itemPayload.magicItem || {};
        const magicItemObj: MagicItem = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          name: m.name || itemPayload.title || 'Magic Item',
          usage: m.usage || '1-Enc',
          action: m.action || 'P',
          effect: m.effect || m.description || itemPayload.description || '',
          source: m.source || 'Loot Claim',
          created_at: new Date().toISOString(),
          category: m.category || category || 'Magic Item',
          slot_weight: (getItemSlotWeight({ ...m, name: itemPayload.title, category }) as 1 | 2 | 3 | 4),
        };

        updateActiveSheetData((prev) => ({
          ...prev,
          character_vault: [...(prev.character_vault || []), magicItemObj],
        }));
      } else if (category === 'coins' || itemPayload.coinsSilver || itemPayload.coinsGold) {
        const s = itemPayload.coinsSilver || 0;
        const g = itemPayload.coinsGold || 0;
        updateActiveSheetData((prev) => ({
          ...prev,
          silver: (prev.silver || 0) + s,
          gold: (prev.gold || 0) + g,
        }));
      } else if (isArtGems) {
        const numVal = parseInt(itemPayload.valuableVal || '5', 10) || 5;
        const currency = itemPayload.valuableCurrency || 'gp';
        const treasureItem: TreasureItem = {
          id: `treasure-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: itemPayload.title || 'Art & Gem Treasure',
          value: numVal,
          currency: currency,
          category: 'Art & Gems',
          qty: 1,
        };

        updateActiveSheetData((prev) => ({
          ...prev,
          other_treasure: [...(prev.other_treasure || []), treasureItem],
        }));
      } else {
        const gearCat = category === 'gear_quality' ? 'Quality Gear' : category === 'curios' ? 'Curios & Documents' : 'Junk';
        const gearItem: SimpleGearItem = {
          id: `gear-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: itemPayload.title || 'Adventure Item',
          qty: 1,
          category: gearCat,
        };

        updateActiveSheetData((prev) => ({
          ...prev,
          simple_gear: [...(prev.simple_gear || []), gearItem],
        }));
      }

      await saveActiveCharacter();
      return true;
    } catch {
      return false;
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;
    await createNewCharacter(newCharName.trim());
    setNewCharName('');
    setShowCreateModal(false);
  };

  const currentLevel = activeCharacter?.sheet_data?.level || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Persistent Header */}
      <header className="sticky top-0 z-30 w-full bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-[2500px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            {/* 🌌 Stylized SupaFlex Brand Logo & Title */}
            <div className="flex items-center gap-2 pr-1">
              <span className="text-xl">🌌</span>
              <h1 className="font-outfit text-lg font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                SUPAFLEX
              </h1>
            </div>

            {/* Account Pill Button (Simplified in GM Mode) */}
            <AccountPillButton
              email={playerEmail}
              activeCharacter={activeCharacter}
              isGmMode={activeRole === 'gm'}
              onOpenLaunchHub={() => setShowUnifiedLaunchHubModal(true)}
            />

            {/* ⭐ Stylized Level & AP Trigger (Header Row 1 - Player Mode Only) */}
            {activeRole !== 'gm' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold transition-all bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/35 text-amber-300 shadow-amber-950/40">
                <button
                  onClick={() => setShowApManagerModal(true)}
                  className="text-amber-400 font-bold flex items-center gap-1.5 hover:text-amber-200 transition-colors cursor-pointer"
                  title="Open Manage Level & AP Modal"
                >
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 shrink-0" />
                  <span className="font-outfit tracking-wide">Level & AP</span>
                </button>

                <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 font-mono font-extrabold text-amber-100 text-[11px] shrink-0">
                  Lvl {currentLevel}
                </span>

                <div className="h-3.5 w-[1px] bg-amber-500/30 mx-0.5 shrink-0" />

                <div className="flex items-center gap-0.5">
                  <CardHelpButton ruleKey="leveling.advancement_steps" />
                  <button
                    onClick={() => setShowApManagerModal(true)}
                    className="p-1 text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 rounded-md transition-colors cursor-pointer"
                    title="Open Manage Level & AP Modal"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Center Zone: S-Tier Glassmorphic Pill Tab Navigation Bar (Player Mode Only) */}
          {activeRole !== 'gm' && (
            <nav className="flex-1 flex justify-center min-w-[280px]">
              <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl shadow-inner backdrop-blur-md">
                <button
                  onClick={() => setActiveTab('sheet')}
                  className={`px-3 py-1 font-outfit font-extrabold text-xs tracking-wide rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'sheet'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Sheet
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1 font-outfit font-extrabold text-xs tracking-wide rounded-lg transition-all flex items-center gap-1.5 ${
                    activeTab === 'logs'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  Logs
                </button>
              </div>
            </nav>
          )}

          {/* Right Zone: Resources Popover & Database Indicator */}
          <div className="flex items-center gap-2">
            {/* 📚 Resources Popover Trigger */}
            <div className="relative" ref={resourcesRef}>

              <button
                onClick={() => setShowResourcesPopover(!showResourcesPopover)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                  showResourcesPopover
                    ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-indigo-500/30'
                    : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/35 text-indigo-300 shadow-indigo-950/40'
                }`}
                title="SupaFlex Gemini Notebook & Official Rules Website"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-outfit font-extrabold tracking-wide">Resources</span>
                {showResourcesPopover ? (
                  <ChevronUp className="w-3 h-3 text-indigo-300 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
                )}
              </button>

              {/* 📚 Resources Floating Glass Popover Card */}
              {showResourcesPopover && (
                <ResourcesPopover 
                  onClose={() => setShowResourcesPopover(false)} 
                  onOpenLootGenerator={() => setShowLootGeneratorModal(true)}
                  onOpenNishTcGenerator={() => setShowNishTcModal(true)}
                  isGmMode={activeRole === 'gm'}
                />
              )}
            </div>

            {!dbConnected && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-950/80 rounded-lg border border-rose-500/50 text-rose-300 text-xs font-semibold animate-pulse shadow-md shadow-rose-950/50">
                <Database className="w-3.5 h-3.5 text-rose-400" />
                <span>Offline</span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-Header Row 2: GM Header Ribbon vs Player Attribute HUD */}
        {activeRole === 'gm' ? (
          <GmHeaderHUD
            activeRoomCode={activeRoomCode}
          />
        ) : (
          activeTab === 'sheet' && (
            <div className="w-full pt-1.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 animate-fadeIn">
              <PersistentHeaderHUD
                onOpenAttributeManager={() => setShowAttributeManagerModal(true)}
                onOpenFocusManager={() => setShowFocusManagerModal(true)}
              />
            </div>
          )
        )}
      </header>

      {/* 🚀 Main Layout Shell */}
      <main className="flex-1 w-full max-w-[2500px] mx-auto p-3 md:p-4 flex flex-col gap-4">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-[300px]">
            <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
            <p className="text-xs font-medium text-slate-400">Loading...</p>
          </div>
        ) : (
          <>
            {/* Main View Shell: GM Workspace vs Player Sheet & Tabs */}
            <div className="flex-1">
              {activeRole === 'gm' ? (
                <GmWorkspaceView
                  activeParty={null}
                  currentEmail={playerEmail}
                  onOpenLaunchHub={() => setShowUnifiedLaunchHubModal(true)}
                  onRoomCodeReady={(code) => setActiveRoomCode(code)}
                />
              ) : (
                <>
                  {activeTab === 'sheet' && (
                    <CharacterSheetView
                      onOpenVitalityManager={() => setShowVitalityManagerModal(true)}
                      onOpenPartySelector={() => {
                        setLaunchHubInitialTab('party');
                        setShowUnifiedLaunchHubModal(true);
                      }}
                      tabSessionId={tabSessionId}
                    />
                  )}
                  {activeTab === 'logs' && <AdventureLogs />}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* Hero Creation Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-label="Create New Hero"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 flex flex-col gap-4">
            <h3 className="font-outfit font-bold text-lg text-slate-100">Create New Hero</h3>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Character Name</label>
                <input
                  type="text"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCharName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  Create Hero
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 💰 Random Loot Generator Modal */}
      <LootGeneratorModal
        isOpen={showLootGeneratorModal}
        onClose={() => setShowLootGeneratorModal(false)}
        characterName={activeCharacter?.name || 'Hero'}
        currentSilver={activeCharacter?.sheet_data?.silver || 0}
        currentGold={activeCharacter?.sheet_data?.gold || 0}
        onMoveToSheet={handleMoveToSheet}
      />

      {/* 🧩 AP Manager Modal */}
      <ErrorBoundary fallbackTitle="AP Manager Error" onClose={() => setShowApManagerModal(false)}>
        <ApManagerModal
          isOpen={showApManagerModal}
          onClose={() => setShowApManagerModal(false)}
          onOpenAttributeManager={() => {
            setOpenedFromApManager(true);
            setShowApManagerModal(false);
            setShowAttributeManagerModal(true);
          }}
          onOpenVitalityManager={() => {
            setOpenedFromApManager(true);
            setShowApManagerModal(false);
            setShowVitalityManagerModal(true);
          }}
          onOpenFocusManager={() => {
            setOpenedFromApManager(true);
            setShowApManagerModal(false);
            setShowFocusManagerModal(true);
          }}
        />
      </ErrorBoundary>

      {/* ✨ Attribute Manager Modal */}
      <ErrorBoundary fallbackTitle="Attribute Manager Error" onClose={() => setShowAttributeManagerModal(false)}>
        <AttributeManagerModal
          isOpen={showAttributeManagerModal}
          onClose={() => {
            setShowAttributeManagerModal(false);
            if (openedFromApManager) {
              setOpenedFromApManager(false);
              setShowApManagerModal(true);
            }
          }}
        />
      </ErrorBoundary>

      {/* 🌟 Nish Tremendous & Critical Generator Modal */}
      <ErrorBoundary fallbackTitle="Nish T/C Generator Error" onClose={() => setShowNishTcModal(false)}>
        <NishTcModal
          isOpen={showNishTcModal}
          onClose={() => setShowNishTcModal(false)}
          characterName={activeCharacter?.name || 'Active Hero'}
        />
      </ErrorBoundary>

      {/* ❤️ Vitality Manager Modal */}
      <ErrorBoundary fallbackTitle="Vitality Manager Error" onClose={() => setShowVitalityManagerModal(false)}>
        <VitalityManagerModal
          isOpen={showVitalityManagerModal}
          onClose={() => {
            setShowVitalityManagerModal(false);
            if (openedFromApManager) {
              setOpenedFromApManager(false);
              setShowApManagerModal(true);
            }
          }}
        />
      </ErrorBoundary>

      {/* 🎯 Focus Manager Modal */}
      <ErrorBoundary fallbackTitle="Focus Manager Error" onClose={() => setShowFocusManagerModal(false)}>
        <FocusManagerModal
          isOpen={showFocusManagerModal}
          onClose={() => {
            setShowFocusManagerModal(false);
            if (openedFromApManager) {
              setOpenedFromApManager(false);
              setShowApManagerModal(true);
            }
          }}
        />
      </ErrorBoundary>

      {/* 🌌 Unified Launch & Account Hub Modal */}
      <ErrorBoundary fallbackTitle="Launch Hub Error" onClose={() => setShowUnifiedLaunchHubModal(false)}>
        <UnifiedLaunchHubModal
          isOpen={showUnifiedLaunchHubModal}
          onClose={() => setShowUnifiedLaunchHubModal(false)}
          currentEmail={playerEmail}
          activeCharacter={activeCharacter}
          userCharacters={myHeroes}
          tabSessionId={tabSessionId}
          initialTab={launchHubInitialTab}
          onSelectCharacter={selectCharacter}
          onCreateNewCharacter={createNewCharacter}
          onLoginSuccess={(email) => {
            setPlayerEmail(email);
            sessionStorage.setItem('supaflex_player_email', email);
            fetchInitialData();
          }}
          onLogout={() => {
            setPlayerEmail('');
            setActiveRoomCode(null);
            sessionStorage.removeItem('supaflex_player_email');
            sessionStorage.removeItem('supaflex_auth_token');
            sessionStorage.removeItem('supaflex_tab_jwt');
            useCharacterStore.setState({ activeCharacter: null });
            setShowUnifiedLaunchHubModal(true);
          }}
          onCharacterCloned={(clonedChar) => {
            fetchInitialData();
            selectCharacter(clonedChar.id);
          }}
          onRefreshCharacters={fetchInitialData}
        />
      </ErrorBoundary>


      {/* 🔐 Password Reset Modal */}
      <UpdatePasswordModal
        isOpen={showUpdatePasswordModal}
        onClose={() => setShowUpdatePasswordModal(false)}
      />

      {/* Footer */}
      <footer className="w-full py-3 px-6 border-t border-slate-900 text-center text-xs text-slate-600 font-medium">
        🌌 SupaFlex • Weaving Order from Chaos • Shanask Systems
      </footer>
    </div>
  );
}
