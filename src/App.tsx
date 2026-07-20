import { useState } from 'react';
import { Database, Shield, Zap, Sparkles, Activity, Layers } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sheet' | 'rolls' | 'logs'>('sheet');
  const [dbStatus] = useState<'online' | 'offline'>('online'); // Mock database check
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* 🌌 Navigation & Header Branding Bar */}
      <header className="w-full glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌌</span>
          <h1 className="font-outfit text-xl font-extrabold tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            SUPAFLEX
          </h1>
          <div className="hidden sm:flex items-center gap-2 ml-4 px-2.5 py-1 bg-slate-900/60 rounded-full border border-slate-800 text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></span>
            Flex v2.0
          </div>
        </div>

        {/* Database Status Indicator & Connections */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/80 rounded-lg border border-slate-800 text-xs font-semibold">
            <Database className={`w-3.5 h-3.5 ${dbStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="text-slate-400">Database:</span>
            <span className={dbStatus === 'online' ? 'text-emerald-400' : 'text-rose-400'}>
              {dbStatus === 'online' ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* 🚀 Main Layout Shell */}
      <main className="flex-1 w-full max-w-[2500px] mx-auto p-6 md:p-8 flex flex-col gap-6">
        
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`px-5 py-3 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
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
            className={`px-5 py-3 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'rolls'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-4 h-4" />
            Dice Roll Console
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-5 py-3 font-outfit font-semibold text-sm tracking-wide border-b-2 transition-all flex items-center gap-2 ${
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
          {activeTab === 'sheet' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Attributes & Vitals */}
              <div className="flex flex-col gap-6">
                
                {/* Attributes Panel */}
                <div className="bg-slate-900/40 rounded-xl border border-slate-850 p-5 flex flex-col gap-4">
                  <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-400 uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    Core Attributes
                  </h3>
                  
                  <div className="flex flex-col gap-3">
                    {[
                      { name: 'Might', emoji: '💪', score: 'B2', rating: 3 },
                      { name: 'Motion', emoji: '🏃', score: 'C1', rating: 2 },
                      { name: 'Mind', emoji: '👁️', score: 'A1', rating: 4 },
                      { name: 'Magic', emoji: '✨', score: 'D1', rating: 1 },
                      { name: 'Moxie', emoji: '🫀', score: 'S1', rating: 5 },
                    ].map((attr) => (
                      <div key={attr.name} className="flex items-center justify-between p-3 bg-slate-950/40 rounded-lg border border-slate-900">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{attr.emoji}</span>
                          <span className="font-semibold text-sm text-slate-200">{attr.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/25">
                            {attr.score}
                          </span>
                          <span className="font-mono text-sm font-semibold text-slate-400">
                            Rating: {attr.rating}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vitals Panel */}
                <div className="bg-slate-900/40 rounded-xl border border-slate-850 p-5 flex flex-col gap-4">
                  <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-400 uppercase">
                    ❤️ Vitality & Status
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 p-3.5 bg-slate-950/40 rounded-lg border border-slate-900 flex flex-col gap-1">
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Vitality Points</span>
                      <span className="text-2xl font-outfit font-extrabold text-emerald-400">32 / 32</span>
                    </div>
                    <div className="flex-1 p-3.5 bg-slate-950/40 rounded-lg border border-slate-900 flex flex-col gap-1">
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Wounds</span>
                      <span className="text-2xl font-outfit font-extrabold text-rose-400">0 / 3</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle/Right Columns Placeholder */}
              <div className="lg:col-span-2 bg-slate-900/20 rounded-xl border border-slate-850 border-dashed p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
                <Layers className="w-10 h-10 text-slate-600 animate-pulse" />
                <div>
                  <h3 className="font-outfit font-bold text-base text-slate-300">SupaFlex Playtest Dashboard</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md">
                    Boilerplate scaffold completed. Once database migrations are executed, dynamic spellbooks, weapon grids, and roll integrations will render here.
                  </p>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'rolls' && (
            <div className="bg-slate-900/40 rounded-xl border border-slate-850 p-6 flex flex-col gap-4">
              <h2 className="font-outfit font-bold text-base text-slate-300">Dice Roll Console</h2>
              <p className="text-sm text-slate-500">WebSocket roll triggers and Broadcast Channel roll logs will appear here.</p>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-slate-900/40 rounded-xl border border-slate-850 p-6 flex flex-col gap-4">
              <h2 className="font-outfit font-bold text-base text-slate-300">Adventure Logs</h2>
              <p className="text-sm text-slate-500">Syncing notes directly with the Google Doc presentation layer.</p>
            </div>
          )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="w-full py-4 px-6 border-t border-slate-900 text-center text-xs text-slate-600 font-medium">
        🌌 SupaFlex • Weaving Order from Chaos • Shanask Systems
      </footer>
    </div>
  );
}
