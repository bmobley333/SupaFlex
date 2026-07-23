import { useEffect, useState, useRef } from 'react';
import { Database, Shield, Zap, Activity, BookOpen, Users, Save, Loader2, ChevronDown, ChevronUp, Award, Star } from 'lucide-react';
import { useCharacterStore } from './store/useCharacterStore';
import { CharacterSheetView } from './components/sheet/CharacterSheetView';
import { ActionConsoleView } from './components/rolls/ActionConsoleView';
import { CodexView } from './components/codex/CodexView';
import { AdventureLogs } from './components/logs/AdventureLogs';
import { PlayerDirectoryView } from './components/directory/PlayerDirectoryView';
import { PersistentHeaderHUD } from './components/header/PersistentHeaderHUD';
import { HeroSelectorPopover } from './components/header/HeroSelectorPopover';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sheet' | 'rolls' | 'codex' | 'logs' | 'directory'>('sheet');
  const [newCharName, setNewCharName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSelectorBar, setShowSelectorBar] = useState(false);
  const [showLevelPopover, setShowLevelPopover] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const levelRef = useRef<HTMLDivElement>(null);

  const {
    characters,
    activeCharacter,
    isLoading,
    isSaving,
    dbConnected,
    playerEmail,
    filterMode,
    fetchInitialData,
    selectCharacter,
    createNewCharacter,
    saveActiveCharacter,
    updateActiveSheetData,
  } = useCharacterStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Click-outside listener for Hero Selector popover
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setShowSelectorBar(false);
      }
      if (levelRef.current && !levelRef.current.contains(event.target as Node)) {
        setShowLevelPopover(false);
      }
    };
    if (showSelectorBar || showLevelPopover) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [showSelectorBar, showLevelPopover]);

  const myHeroes = characters.filter((c) => {
    if (!playerEmail.trim()) return true;
    const owner = (c.owner_email || '').toLowerCase().trim();
    const current = playerEmail.toLowerCase().trim();
    return owner === current || !c.owner_email;
  });

  const displayedCharacters = filterMode === 'all_heroes' ? characters : myHeroes;

  // Auto-sync active character when switching filter mode or email
  useEffect(() => {
    if (displayedCharacters.length > 0) {
      const activeInDisplayed = activeCharacter && displayedCharacters.some((c) => c.id === activeCharacter.id);
      if (!activeInDisplayed) {
        selectCharacter(displayedCharacters[0].id);
      }
    }
  }, [filterMode, playerEmail, characters]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;
    await createNewCharacter(newCharName.trim());
    setNewCharName('');
    setShowCreateModal(false);
  };

  const currentLevel = activeCharacter?.sheet_data?.level || 1;
  const currentAp = activeCharacter?.sheet_data?.ap ?? currentLevel * 2;

  const handleLevelChange = (newLevel: number) => {
    const val = Math.max(1, Math.min(250, newLevel));
    updateActiveSheetData((prev) => ({
      ...prev,
      level: val,
      ap: val * 2,
    }));
    saveActiveCharacter();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 🌌 Navigation & Persistent HUD Header Bar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-4 py-2 flex flex-col gap-2">
        {/* Top Header Row (Brand/Hero Left, Centered Tab Bar, Actions Right) */}
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          {/* Left Zone: Logo, Hero Selector Trigger, & Level Popover Trigger */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌌</span>
              <h1 className="font-outfit text-lg font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                SUPAFLEX
              </h1>
            </div>

            {/* Relative wrapper for Hero Selector Trigger & Floating Popover */}
            <div className="relative" ref={selectorRef}>
              <button
                onClick={() => setShowSelectorBar(!showSelectorBar)}
                className="flex items-center gap-2 px-3 py-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-indigo-300 transition-all w-auto"
                title="Click to switch hero or edit identity"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="font-outfit font-extrabold text-slate-100 whitespace-nowrap">
                  {activeCharacter ? activeCharacter.name : 'Select Hero'}
                </span>
                {activeCharacter && (
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/35 text-purple-300 text-[10px] font-bold">
                      {activeCharacter.race || 'Human'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/35 text-indigo-300 text-[10px] font-bold">
                      {activeCharacter.class || 'Adventurer'}
                    </span>
                  </div>
                )}
                {showSelectorBar ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
                )}
              </button>

              {/* Absolute Floating Glass Popover Card */}
              {showSelectorBar && (
                <HeroSelectorPopover
                  onClose={() => setShowSelectorBar(false)}
                  onOpenCreateModal={() => setShowCreateModal(true)}
                />
              )}
            </div>

            {/* ⭐ Stylized Level Popover Trigger (Header Row 1) */}
            <div className="relative" ref={levelRef}>
              <button
                onClick={() => setShowLevelPopover(!showLevelPopover)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all border shadow-sm ${
                  showLevelPopover
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-amber-500/30'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/35 text-amber-300 shadow-amber-950/40'
                }`}
                title="Click to view or edit Hero Level and Action Points"
              >
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 shrink-0" />
                <span className="font-outfit tracking-wide">Lvl {currentLevel}</span>
                {showLevelPopover ? (
                  <ChevronUp className="w-3 h-3 text-amber-300 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
                )}
              </button>

              {/* 🌟 Level Edit Absolute Floating Glass Popover Card */}
              {showLevelPopover && (
                <div className="absolute top-full left-0 mt-2 z-50 w-64 p-3.5 bg-slate-900/95 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="font-outfit font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                      <Award className="w-4 h-4 text-amber-400" />
                      Hero Level & AP
                    </span>
                    <span className="font-mono text-xs text-slate-400 font-semibold">
                      AP: <span className="text-amber-300 font-bold">{currentAp}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-300">Level Rating</span>
                      <span className="text-[10px] text-slate-400 font-mono">1 - 250 Lvl</span>
                    </div>

                    <input
                      type="number"
                      min={1}
                      max={250}
                      value={currentLevel}
                      onChange={(e) => handleLevelChange(parseInt(e.target.value) || 1)}
                      className="w-16 bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 text-sm font-mono font-extrabold text-amber-300 text-center outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Zone: S-Tier Glassmorphic Pill Tab Navigation Bar */}
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
                onClick={() => setActiveTab('rolls')}
                className={`px-3 py-1 font-outfit font-extrabold text-xs tracking-wide rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'rolls'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Rolls
              </button>
              <button
                onClick={() => setActiveTab('codex')}
                className={`px-3 py-1 font-outfit font-extrabold text-xs tracking-wide rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'codex'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Codex
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
              <button
                onClick={() => setActiveTab('directory')}
                className={`px-3 py-1 font-outfit font-extrabold text-xs tracking-wide rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'directory'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Directory
              </button>
            </div>
          </nav>

          {/* Right Zone: Global Save & Database Indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={saveActiveCharacter}
              disabled={isSaving || !activeCharacter}
              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] font-semibold">
              <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className={dbConnected ? 'text-emerald-400' : 'text-rose-400'}>
                {dbConnected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Persistent Header HUD Ribbon - Sub-Header Row 2 (Only visible when on Sheet tab) */}
        {activeTab === 'sheet' && (
          <div className="w-full pt-1.5 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 animate-fadeIn">
            <PersistentHeaderHUD />
          </div>
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
            {/* Tab Panels */}
            <div className="flex-1">
              {activeTab === 'sheet' && <CharacterSheetView />}
              {activeTab === 'rolls' && <ActionConsoleView />}
              {activeTab === 'codex' && <CodexView />}
              {activeTab === 'logs' && <AdventureLogs />}
              {activeTab === 'directory' && <PlayerDirectoryView />}
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
                  placeholder="e.g., Kaelen the Sunweaver"
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

      {/* Footer */}
      <footer className="w-full py-3 px-6 border-t border-slate-900 text-center text-xs text-slate-600 font-medium">
        🌌 SupaFlex • Weaving Order from Chaos • Shanask Systems
      </footer>
    </div>
  );
}
