import { useEffect, useState } from 'react';
import { Database, Shield, Zap, Activity, BookOpen, Users, Plus, Save, UserCheck, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useCharacterStore } from './store/useCharacterStore';
import { CharacterSheetView } from './components/sheet/CharacterSheetView';
import { ActionConsoleView } from './components/rolls/ActionConsoleView';
import { CodexView } from './components/codex/CodexView';
import { AdventureLogs } from './components/logs/AdventureLogs';
import { PlayerDirectoryView } from './components/directory/PlayerDirectoryView';
import { PersistentHeaderHUD } from './components/header/PersistentHeaderHUD';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sheet' | 'rolls' | 'codex' | 'logs' | 'directory'>('sheet');
  const [newCharName, setNewCharName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSelectorBar, setShowSelectorBar] = useState(false);

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
    setPlayerEmail,
    setFilterMode,
  } = useCharacterStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 🌌 Navigation & Persistent HUD Header Bar */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-4 py-2 flex flex-col gap-2">
        {/* Top Header Row (Brand/Hero Left, Centered Tab Bar, Actions Right) */}
        <div className="w-full flex items-center justify-between gap-4 flex-wrap">
          {/* Left Zone: Logo & Hero Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🌌</span>
              <h1 className="font-outfit text-lg font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                SUPAFLEX
              </h1>
            </div>

            <button
              onClick={() => setShowSelectorBar(!showSelectorBar)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-indigo-300 transition-all"
              title="Click to switch hero or player email"
            >
              <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-extrabold text-slate-100">
                {activeCharacter ? activeCharacter.name : 'Select Hero'}
              </span>
              {activeCharacter?.class && (
                <span className="text-[10px] text-slate-400 font-mono">({activeCharacter.class})</span>
              )}
              {showSelectorBar ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
            </button>
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

        {/* Collapsible Hero & Player Selector Drawer */}
        {showSelectorBar && (
          <div className="w-full pt-2 pb-1 border-t border-slate-800/80 flex items-center gap-3 flex-wrap animate-fadeIn">
            {/* Player Email Login Input */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Player:</span>
              <input
                type="email"
                value={playerEmail}
                onChange={(e) => setPlayerEmail(e.target.value)}
                placeholder="player@email.com"
                className="bg-transparent text-xs font-mono font-bold text-indigo-300 outline-none w-40 focus:text-indigo-200"
              />
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setFilterMode('my_heroes')}
                className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all ${
                  filterMode === 'my_heroes'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 opacity-100'
                    : 'text-slate-500 border border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                My Heroes ({myHeroes.length})
              </button>
              <button
                onClick={() => setFilterMode('all_heroes')}
                className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all ${
                  filterMode === 'all_heroes'
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 opacity-100'
                    : 'text-slate-500 border border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                All Heroes ({characters.length})
              </button>
            </div>

            {/* Active Character Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
              <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={activeCharacter && displayedCharacters.some((c) => c.id === activeCharacter.id) ? activeCharacter.id : ''}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val) selectCharacter(val);
                }}
                className="bg-transparent text-xs font-semibold text-slate-200 border-none outline-none cursor-pointer pr-1"
              >
                {displayedCharacters.length > 0 ? (
                  displayedCharacters.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                      {c.name} ({c.class || 'Adventurer'}) {c.owner_email ? `— ${c.owner_email}` : ''}
                    </option>
                  ))
                ) : (
                  <option value="" className="bg-slate-900 text-amber-300 italic">
                    No heroes for {playerEmail || 'this player'}
                  </option>
                )}
              </select>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/30 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              New Hero
            </button>
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
