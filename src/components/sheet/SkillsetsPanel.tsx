// src/components/sheet/SkillsetsPanel.tsx
import React from 'react';
import { BookOpen, Check } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { AttributeKey } from '../../types/game';

const EMOJI_MAP: Record<string, { key: AttributeKey; label: string; icon: string }> = {
  '💪': { key: 'might', label: 'Might', icon: '💪' },
  '🏃': { key: 'motion', label: 'Motion', icon: '🏃' },
  '👁️': { key: 'mind', label: 'Mind', icon: '👁️' },
  '✨': { key: 'magic', label: 'Magic', icon: '✨' },
  '🫀': { key: 'moxie', label: 'Moxie', icon: '🫀' },
};

export const SkillsetsPanel: React.FC = () => {
  const { activeCharacter, skillsets, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();
  const knownSkillsetNames = activeCharacter?.sheet_data?.known_skillsets || [];

  const handleToggleSkillset = (name: string) => {
    updateActiveSheetData((prev) => {
      const current = prev.known_skillsets || [];
      const updated = current.includes(name)
        ? current.filter((s) => s !== name)
        : [...current, name];
      return { ...prev, known_skillsets: updated };
    });
    saveActiveCharacter();
  };

  // Compile derived skills grouped by attribute emoji
  const compiledSkills: Record<AttributeKey, string[]> = {
    might: [],
    motion: [],
    mind: [],
    magic: [],
    moxie: [],
  };

  knownSkillsetNames.forEach((ksName) => {
    const ksObj = skillsets.find((s) => s.name === ksName);
    if (ksObj && Array.isArray(ksObj.skills)) {
      ksObj.skills.forEach((rawSkill) => {
        for (const [emoji, info] of Object.entries(EMOJI_MAP)) {
          if (rawSkill.includes(emoji)) {
            const cleanName = rawSkill.replace(emoji, '').trim();
            if (cleanName && !compiledSkills[info.key].includes(cleanName)) {
              compiledSkills[info.key].push(cleanName);
            }
          }
        }
      });
    }
  });

  // Sort each bucket alphabetically
  (Object.keys(compiledSkills) as AttributeKey[]).forEach((key) => {
    compiledSkills[key].sort();
  });

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400" />
          Skillsets
        </h3>
        <span className="text-[11px] text-slate-400 font-mono">
          {knownSkillsetNames.length} Selected
        </span>
      </div>

      {/* Skillset Selector Pills */}
      <div className="flex flex-wrap gap-2">
        {skillsets.map((ks) => {
          const isSelected = knownSkillsetNames.includes(ks.name);
          return (
            <button
              key={ks.id}
              onClick={() => handleToggleSkillset(ks.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-600/20'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 text-purple-400" />}
              {ks.name}
            </button>
          );
        })}
      </div>

      {/* Derived Skilled-At Attributes Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {Object.entries(EMOJI_MAP).map(([emoji, info]) => {
          const skillsList = compiledSkills[info.key];
          return (
            <div
              key={info.key}
              className="p-3 bg-slate-950/60 rounded-lg border border-slate-850 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{emoji}</span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {info.label} ({skillsList.length})
                </span>
              </div>
              {skillsList.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {skillsList.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 bg-slate-900 text-slate-200 text-[11px] font-medium rounded border border-slate-800"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic">No derived skills yet</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
