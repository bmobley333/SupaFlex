import { useEffect, useState } from 'react';
import { Database, Shield, Zap, Activity, BookOpen, Plus, Save, UserCheck, Loader2 } from 'lucide-react';
import { useCharacterStore } from './store/useCharacterStore';
import { CharacterSheetView } from './components/sheet/CharacterSheetView';
import { ActionConsoleView } from './components/rolls/ActionConsoleView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sheet' | 'rolls' | 'codex' | 'logs'>('sheet');
  const [newCharName, setNewCharName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    characters,
    activeCharacter,
    isLoading,
    isSaving,
    dbConnected,
    fetchInitialData,
    selectCharacter,
    createNewCharacter,
    saveActiveCharacter,
  } = useCharacterStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCharName.trim()) return;
    await createNewCharacter(newCharName.trim());
    setNewCharName('');
    setShowCreateModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 🌌 Navigation & Header Branding Bar */}
      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌌</span>
          <div>
            <h1 className="font-outfit text-xl font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              SUPAFLEX
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">MetaScape Playtest Suite v2.0</p>
          </div>
        </div>

        {/* Active Character Selector & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {activeCharacter && (
            <div className="flex items-center gap-2 bg-slate-950/60 p-1.5 rounded-lg border border-slate-800">
              <UserCheck className="w-4 h-4 text-indigo-400 ml-1.5" />
              <select
                value={activeCharacter.id}
                onChange={(e) => selectCharacter(Number(e.target.value))}
                className="bg-transparent text-sm font-semibold text-slate-200 border-none outline-none cursor-pointer pr-2"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                    {c.name} ({c.class || 'Adventurer'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/30 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Hero
          </button>

          <button
            onClick={saveActiveCharacter}
            disabled={isSaving || !activeCharacter}
            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          {/* Database Connection Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-semibold">
            <Database className={`w-3.5 h-3.5 ${dbConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-slate-400">DB:</span>
            <span className={dbConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {dbConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* 🚀 Main Layout Shell */}
      <main className="flex-1 w-full max-w-[2500px] mx-auto p-4 md:p-6 flex flex-col gap-6">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[400px]">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm font-medium text-slate-400">Connecting to MetaScape Supabase Gateway...</p>
          </div>
        ) : (
          <>
            {/* Navigation Tabs Bar */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
              <button
                onClick={() => setActiveTab('sheet')}
                className={`px-5 py-2.5 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'sheet'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                Character Sheet
              </button>
              <button
                onClick={() => setActiveTab('rolls')}
                className={`px-5 py-2.5 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'rolls'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-4 h-4" />
                Dice Roll Console
              </button>
              <button
                onClick={() => setActiveTab('codex')}
                className={`px-5 py-2.5 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'codex'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Codex Search
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-5 py-2.5 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'logs'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4" />
                Adventure Logs
              </button>
            </div>

            {/* Tab Panels */}
            <div className="flex-1">
              {activeTab === 'sheet' && <CharacterSheetView />}
              {activeTab === 'rolls' && <ActionConsoleView />}

              {activeTab === 'codex' && (
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 flex flex-col gap-4">
                  <h2 className="font-outfit font-bold text-base text-slate-200">Codex Search</h2>
                  <p className="text-xs text-slate-400">
                    Searchable game codex for skillsets, powers, and magic items will be integrated in Phase 4.
                  </p>
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 flex flex-col gap-4">
                  <h2 className="font-outfit font-bold text-base text-slate-200">Adventure Logs</h2>
                  <p className="text-xs text-slate-400">
                    Session logs and quest notes will be integrated in Phase 5.
                  </p>
                </div>
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
