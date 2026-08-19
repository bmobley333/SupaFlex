// src/components/header/AttributesRibbon.tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Sparkles, X } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey, DieRating } from '../../types/game';

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  abbr: string;
  emoji: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'magic', name: 'Magic', abbr: 'Magic', emoji: '✨' },
  { key: 'might', name: 'Might', abbr: 'Might', emoji: '💪' },
  { key: 'mind', name: 'Mind', abbr: 'Mind', emoji: '👁️' },
  { key: 'motion', name: 'Motion', abbr: 'Motion', emoji: '🏃' },
  { key: 'moxie', name: 'Moxie', abbr: 'Moxie', emoji: '🫀' },
];

const DIE_OPTIONS: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

const dieToNum = (die?: string): string => {
  if (!die) return '4';
  return die.replace(/^d/i, '');
};

interface AttributesRibbonProps {
  onOpenAttributeManager?: () => void;
}

export const AttributesRibbon: React.FC<AttributesRibbonProps> = ({
  onOpenAttributeManager,
}) => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  if (!activeCharacter) return null;

  const sheet = activeCharacter.sheet_data;
  const dice = sheet?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const handleAttributeDieChange = (attrKey: AttributeKey, newDie: DieRating) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      attribute_dice: {
        ...prev.attribute_dice,
        [attrKey]: newDie,
      },
    }));
    saveActiveCharacter();
  };

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <div
        onClick={() => {
          if (onOpenAttributeManager) {
            onOpenAttributeManager();
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className={`flex items-center gap-2.5 bg-slate-950/95 px-3 py-1 rounded-xl border transition-all cursor-pointer shadow-lg select-none ${
          isOpen
            ? 'border-indigo-400 shadow-indigo-500/30 bg-slate-900'
            : 'border-slate-800 hover:border-indigo-500/50 shadow-indigo-950/40'
        }`}
      >
        {ATTRIBUTES.map((attr, idx) => {
          const dieVal = dieToNum(dice[attr.key]);
          return (
            <React.Fragment key={attr.key}>
              {idx > 0 && <span className="text-slate-800 font-bold text-sm select-none">|</span>}
              <div className="flex flex-col items-center justify-center py-0.5 px-0.5 group cursor-pointer">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="text-xl leading-none drop-shadow-md select-none group-hover:scale-110 transition-transform">
                    {attr.emoji}
                  </span>
                  <span className="font-mono font-black text-lg text-cyan-300 tabular-nums select-none tracking-tight leading-none">
                    {dieVal}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-indigo-300/80 tracking-wider uppercase mt-1 leading-none select-none">
                  {attr.name}
                </span>
              </div>
            </React.Fragment>
          );
        })}
        <ChevronDown className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-0.5" />
      </div>

      {/* 🔮 Attributes Die Rating Configuration Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-80 p-3.5 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl shadow-indigo-950/60 backdrop-blur-xl animate-fadeIn flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
            <h4 className="font-outfit font-bold text-xs tracking-wider text-indigo-300 uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Attribute Die Ratings
            </h4>
            <button
              onClick={() => setIsOpen(false)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              title="Close popover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {ATTRIBUTES.map((attr) => {
              const currentDie = dice[attr.key] || 'd4';
              return (
                <div
                  key={attr.key}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{attr.emoji}</span>
                    <span className="font-outfit font-bold text-xs text-slate-100">{attr.name}</span>
                  </div>

                  <select
                    value={currentDie}
                    onChange={(e) => handleAttributeDieChange(attr.key, e.target.value as DieRating)}
                    className="bg-slate-900 text-indigo-300 font-mono font-extrabold text-xs px-2.5 py-1 rounded-md border border-indigo-500/30 outline-none cursor-pointer focus:border-indigo-400"
                  >
                    {DIE_OPTIONS.map((die) => (
                      <option key={die} value={die} className="bg-slate-900 text-slate-100">
                        {dieToNum(die)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {onOpenAttributeManager && (
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAttributeManager();
              }}
              className="w-full mt-1 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-lg font-outfit font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              ✨ Launch Full Attribute Manager
            </button>
          )}
        </div>
      )}
    </div>
  );
};
