// src/components/sheet/AttributesPanel.tsx
import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey, DieRating } from '../../types/game';

interface AttributeConfig {
  key: AttributeKey;
  name: string;
  emoji: string;
  desc: string;
}

const ATTRIBUTES: AttributeConfig[] = [
  { key: 'might', name: 'Might', emoji: '💪', desc: 'Physical strength & melee combat' },
  { key: 'motion', name: 'Motion', emoji: '🏃', desc: 'Agility, evasion & stealth' },
  { key: 'mind', name: 'Mind', emoji: '👁️', desc: 'Knowledge, perception & tactical awareness' },
  { key: 'magic', name: 'Magic', emoji: '✨', desc: 'Arcane power & spellcasting focus' },
  { key: 'moxie', name: 'Moxie', emoji: '🫀', desc: 'Willpower, endurance & vitality scaling' },
];

const DIE_OPTIONS: DieRating[] = ['d4', 'd6', 'd8', 'd10', 'd12'];

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
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Core Attributes
        </h3>
        <span className="text-[11px] text-slate-400 font-mono">Die Ratings</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {ATTRIBUTES.map((attr) => {
          const currentDie = dice[attr.key] || 'd4';
          return (
            <div
              key={attr.key}
              className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-850 hover:border-slate-750 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{attr.emoji}</span>
                <div>
                  <span className="font-outfit font-bold text-sm text-slate-100 block">{attr.name}</span>
                  <span className="text-[11px] text-slate-400 block leading-tight">{attr.desc}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={currentDie}
                  onChange={(e) => handleDieChange(attr.key, e.target.value as DieRating)}
                  className="bg-slate-900 text-indigo-300 font-mono font-extrabold text-xs px-3 py-1.5 rounded-lg border border-indigo-500/30 outline-none cursor-pointer focus:border-indigo-400"
                >
                  {DIE_OPTIONS.map((die) => (
                    <option key={die} value={die} className="bg-slate-900 text-slate-100">
                      {die}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
