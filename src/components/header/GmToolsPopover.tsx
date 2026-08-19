import React from 'react';
import { Crown, Dices, X, Brain, BookOpen, ExternalLink } from 'lucide-react';

interface GmToolsPopoverProps {
  onClose: () => void;
  onOpenLootGenerator: () => void;
  onOpenNishTcGenerator: () => void;
  onOpenCraftingMall?: () => void;
  onOpenMasterArchitectDesk?: () => void;
  isMasterArchitect?: boolean;
}

export const GmToolsPopover: React.FC<GmToolsPopoverProps> = ({
  onClose,
  onOpenLootGenerator,
  onOpenNishTcGenerator,
  onOpenCraftingMall,
  onOpenMasterArchitectDesk,
  isMasterArchitect = false,
}) => {
  return (
    <div className="absolute top-full right-0 mt-2 z-50 w-72 p-3.5 bg-slate-900/95 border border-amber-500/40 rounded-xl shadow-2xl shadow-amber-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-3 text-xs">
      {/* Popover Header */}
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
        <span className="font-outfit font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
          <Crown className="w-4 h-4 text-amber-400" />
          GM Control Tools
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
          title="Close GM tools menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tools List */}
      <div className="flex flex-col gap-2">
        {/* Tool 1: Nish T/C Generator */}
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

        {/* Tool 2: Random Loot Generator */}
        <button
          onClick={() => {
            onOpenLootGenerator();
            onClose();
          }}
          className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/50 transition-all text-left w-full cursor-pointer"
        >
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors shrink-0">
            <Dices className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="font-outfit font-bold text-slate-100 group-hover:text-amber-300 transition-colors truncate">
                Loot Table Roller
              </span>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded uppercase shrink-0">
                Loot
              </span>
            </div>
            <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors leading-tight mt-0.5">
              Roll gold, relics, weapons, & armor tables.
            </p>
          </div>
        </button>

        {/* Tool 3: Player's Workshop */}
        {onOpenCraftingMall && (
          <button
            onClick={() => {
              onOpenCraftingMall();
              onClose();
            }}
            className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/50 transition-all text-left w-full cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors shrink-0">
              🛠️
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-outfit font-bold text-slate-100 group-hover:text-amber-300 transition-colors truncate">
                  Workshop
                </span>
                <span className="text-[10px] font-bold text-amber-950 bg-amber-400 px-1.5 py-0.5 rounded uppercase shrink-0">
                  Workshop
                </span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors leading-tight mt-0.5">
                Browse personal creations, party mall, & forge new items / abilities.
              </p>
            </div>
          </button>
        )}

        {/* Link 1: SupaFlex Gemini Notebook */}
        <a
          href="https://notebooklm.google.com/notebook/8a1b90e8-17e0-44a2-a926-667dc08234a7"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
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
          className="group flex items-start gap-3 p-2.5 rounded-lg bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/50 transition-all text-left"
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

        {/* Tool 4: Master Architect Desk (Blake Exclusive) */}
        {isMasterArchitect && onOpenMasterArchitectDesk && (
          <button
            onClick={() => {
              onOpenMasterArchitectDesk();
              onClose();
            }}
            className="group flex items-start gap-3 p-2.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/60 hover:border-amber-400 transition-all text-left w-full cursor-pointer mt-1"
          >
            <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 group-hover:bg-amber-500/30 transition-colors shrink-0">
              🏰
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-outfit font-bold text-amber-200 group-hover:text-amber-100 transition-colors truncate">
                  Master Architect Desk
                </span>
                <span className="text-[10px] font-bold text-amber-950 bg-amber-300 px-1.5 py-0.5 rounded uppercase shrink-0">
                  Canon
                </span>
              </div>
              <p className="text-[11px] text-amber-200/70 group-hover:text-amber-100 transition-colors leading-tight mt-0.5">
                Curate & 1-click promote creations to Master DB.
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
};
