// src/components/sheet/AttributesPanel.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey, DieRating } from '../../types/game';

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  emoji: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'might', name: 'Might', emoji: '💪' },
  { key: 'motion', name: 'Motion', emoji: '🏃' },
  { key: 'mind', name: 'Mind', emoji: '👁️' },
  { key: 'magic', name: 'Magic', emoji: '✨' },
  { key: 'moxie', name: 'Moxie', emoji: '🫀' },
];

const DIE_OPTIONS: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];
const dieToNum = (die: string): string => die.replace(/^d/i, '');

export const AttributesPanel: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const dice = activeCharacter?.sheet_data?.attribute_dice || {
    might: 'd4',
    motion: 'd4',
    mind: 'd4',
    magic: 'd6',
    moxie: 'd8',
  };

  const handleDieChange = (attrKey: AttributeKey, newDie: DieRating) => {
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
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="font-outfit font-bold text-xs tracking-widest text-slate-300 uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Attributes
        </h3>
      </div>

      <div className="flex flex-col gap-1.5">
        {ATTRIBUTES.map((attr) => {
          const currentDie = dice[attr.key] || 'd4';
          return (
            <div
              key={attr.key}
              className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/60 rounded-lg border border-slate-850 hover:border-slate-750 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{attr.emoji}</span>
                <span className="font-outfit font-bold text-xs text-slate-100">{attr.name}</span>
              </div>

              <select
                value={currentDie}
                onChange={(e) => handleDieChange(attr.key, e.target.value as DieRating)}
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
    </div>
  );
};

