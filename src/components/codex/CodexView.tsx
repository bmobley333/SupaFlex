// src/components/codex/CodexView.tsx
import React from 'react';
import { ExternalLink, BookOpen, Brain } from 'lucide-react';
import { CodexSearch } from './CodexSearch';
import { BuildCustomizer } from './BuildCustomizer';

export const CodexView: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 w-full max-w-[2500px] mx-auto">
      {/* 📚 External Knowledge Quick-Launch Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gemini Notebook Card */}
        <a
          href="https://notebooklm.google.com/notebook/8a1b90e8-17e0-44a2-a926-667dc08234a7"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between p-4 rounded-xl bg-slate-900/80 hover:bg-purple-950/30 border border-purple-500/30 hover:border-purple-400/60 shadow-lg transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-400 group-hover:bg-purple-500/20 group-hover:scale-105 transition-all">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-sm text-slate-100 group-hover:text-purple-300 transition-colors flex items-center gap-2">
                SupaFlex Gemini Notebook
              </h3>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                Interactive AI rules & lore Q&A assistant in NotebookLM
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 ml-2" />
        </a>

        {/* Official Rules Website Card */}
        <a
          href="https://bmobley333.github.io/MetaScape-VitePress-GitHub-Pages/player-guide/supaflex/rules.html"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between p-4 rounded-xl bg-slate-900/80 hover:bg-indigo-950/30 border border-indigo-500/30 hover:border-indigo-400/60 shadow-lg transition-all"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-sm text-slate-100 group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                SupaFlex Official Website
              </h3>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                Full online player guide, equipment catalogs, & bestiary
              </p>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 ml-2" />
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Searchable Codex Reference */}
        <div className="lg:col-span-2">
          <CodexSearch />
        </div>

        {/* Right Column (1/3): Build Customizer & Content Creator */}
        <div>
          <BuildCustomizer />
        </div>
      </div>
    </div>
  );
};

