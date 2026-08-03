import React from 'react';
import { ExternalLink, BookOpen, Brain, Dices, X } from 'lucide-react';

interface ResourcesPopoverProps {
  onClose: () => void;
  onOpenLootGenerator?: () => void;
  onOpenApManager?: () => void;
  onOpenNishTcGenerator?: () => void;
  isGmMode?: boolean;
}

export const ResourcesPopover: React.FC<ResourcesPopoverProps> = ({ 
  onClose, 
  onOpenLootGenerator, 
  onOpenApManager,
  onOpenNishTcGenerator,
  isGmMode = false,
}) => {
  return (
    <div className="absolute top-full right-0 mt-2 z-50 w-72 p-3.5 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
      {/* Popover Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="font-outfit font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          SupaFlex Resources
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          title="Close resources menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Links & Tools List */}
      <div className="flex flex-col gap-2">
        {/* Tool 0: Manage AP (Action Points - Player Mode Only) */}
        {!isGmMode && onOpenApManager && (
          <button
            onClick={() => {
              onOpenApManager();
              onClose();
            }}
            className="group flex items-start gap-3 p-2.5 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/40 hover:border-purple-400 transition-all text-left w-full cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 group-hover:bg-purple-500/30 group-hover:text-purple-200 transition-colors shrink-0 font-bold">
              🧩
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-outfit font-bold text-purple-200 group-hover:text-purple-100 transition-colors truncate">
                  Manage AP
                </span>
                <span className="text-[10px] font-bold text-purple-950 bg-purple-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                  AP Log
                </span>
              </div>
              <p className="text-[11px] text-purple-200/70 group-hover:text-purple-100 transition-colors leading-tight mt-0.5">
                Audit expenditures, step-up stats, & spend AP.
              </p>
            </div>
          </button>
        )}

        {/* Tool 1: Nish T/C Generator */}
        {onOpenNishTcGenerator && (
          <button
            onClick={() => {
              onOpenNishTcGenerator();
              onClose();
            }}
            className="group flex items-start gap-3 p-2.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/40 hover:border-rose-400 transition-all text-left w-full cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 group-hover:bg-rose-500/30 group-hover:text-rose-200 transition-colors shrink-0">
              🌟
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-outfit font-bold text-rose-200 group-hover:text-rose-100 transition-colors truncate">
                  Nish T/C Generator
                </span>
                <span className="text-[10px] font-bold text-rose-950 bg-rose-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                  Nish
                </span>
              </div>
              <p className="text-[11px] text-rose-200/70 group-hover:text-rose-100 transition-colors leading-tight mt-0.5">
                Roll secret Tremendous or Critical Nish effects.
              </p>
            </div>
          </button>
        )}

        {/* Tool 2: Random Loot Generator */}
        {onOpenLootGenerator && (
          <button
            onClick={() => {
              onOpenLootGenerator();
              onClose();
            }}
            className="group flex items-start gap-3 p-2.5 rounded-lg bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/40 hover:border-amber-400 transition-all text-left w-full cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 group-hover:bg-amber-500/30 group-hover:text-amber-200 transition-colors shrink-0">
              <Dices className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-outfit font-bold text-amber-200 group-hover:text-amber-100 transition-colors truncate">
                  Loot Generator
                </span>
                <span className="text-[10px] font-bold text-amber-950 bg-amber-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                  Tool
                </span>
              </div>
              <p className="text-[11px] text-amber-200/70 group-hover:text-amber-100 transition-colors leading-tight mt-0.5">
                Roll master & targeted loot + 1-click sheet claim.
              </p>
            </div>
          </button>
        )}


        {/* Link 1: SupaFlex Gemini Notebook */}
        <a
          href="https://notebooklm.google.com/notebook/8a1b90e8-17e0-44a2-a926-667dc08234a7"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 transition-all text-left"
        >
          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:bg-purple-500/20 group-hover:text-purple-300 transition-colors shrink-0">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="font-outfit font-bold text-slate-100 group-hover:text-purple-300 transition-colors truncate">
                Gemini Notebook
              </span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-purple-400 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors leading-tight mt-0.5">
              AI Rulebook & Lore Q&A assistant in NotebookLM.
            </p>
          </div>
        </a>

        {/* Link 2: SupaFlex Official Website */}
        <a
          href="https://bmobley333.github.io/MetaScape-VitePress-GitHub-Pages/player-guide/supaflex/rules.html"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 transition-all text-left"
        >
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="font-outfit font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                Official Website
              </span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors leading-tight mt-0.5">
              Complete SupaFlex rules, bestiary, & gear guide.
            </p>
          </div>
        </a>
      </div>
    </div>
  );
};
