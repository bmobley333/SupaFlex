// src/components/directory/PlayerDirectoryView.tsx
import React, { useRef } from 'react';
import { Users, UserCheck, Copy, Download, Upload, Trash2, Heart, Award } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';

export const PlayerDirectoryView: React.FC = () => {
  const {
    characters,
    activeCharacter,
    selectCharacter,
    deleteCharacter,
    createNewCharacter,
    fetchInitialData,
  } = useCharacterStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloneCharacter = async (charToClone: any) => {
    const clonedName = `${charToClone.name} (Copy)`;
    const newChar = await createNewCharacter(clonedName, charToClone.class, charToClone.race);
    if (newChar && charToClone.sheet_data) {
      await gameApi.updateCharacter(newChar.id, {
        sheet_data: charToClone.sheet_data,
        inventory: charToClone.inventory || [],
        log: charToClone.log || [],
      });
      await fetchInitialData();
    }
  };

  const handleExportJson = (charToExport: any) => {
    const jsonStr = JSON.stringify(charToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${charToExport.name.replace(/\s+/g, '_')}_sheet.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && parsed.name) {
          const imported = await createNewCharacter(
            parsed.name,
            parsed.class || 'Adventurer',
            parsed.race || 'Human'
          );
          if (imported && parsed.sheet_data) {
            await gameApi.updateCharacter(imported.id, {
              sheet_data: parsed.sheet_data,
              inventory: parsed.inventory || [],
              log: parsed.log || [],
            });
            await fetchInitialData();
          }
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error('Error importing JSON character:', err);
    }
  };

  const handleDeleteClick = async (id: number, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete character "${name}"?`);
    if (confirmed) {
      await deleteCharacter(id);
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-5 w-full max-w-[2500px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-outfit font-bold text-base text-slate-100">
              Player Directory & Party Roster
            </h3>
            <p className="text-xs text-slate-400">
              Compare stats, switch active heroes, clone character templates, or export JSON backups.
            </p>
          </div>
        </div>

        {/* Import JSON Action */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={handleImportJsonClick}
            className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold rounded-lg border border-indigo-500/30 transition-all flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Import Character JSON
          </button>
        </div>
      </div>

      {/* Roster Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {characters.map((char) => {
          const isActive = activeCharacter?.id === char.id;
          const sheet = char.sheet_data;
          const dice = sheet?.attribute_dice || {
            might: 'd4',
            motion: 'd4',
            mind: 'd4',
            magic: 'd6',
            moxie: 'd8',
          };

          return (
            <div
              key={char.id}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-4 transition-all ${
                isActive
                  ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-600/15'
                  : 'bg-slate-950/60 border-slate-850 hover:border-slate-750'
              }`}
            >
              <div className="flex flex-col gap-3">
                {/* Header Info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-outfit font-bold text-base text-slate-100 flex items-center gap-2">
                      {char.name}
                      {isActive && (
                        <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                          Active
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Level {sheet?.level || 1} • {char.race || 'Human'} {char.class || 'Adventurer'}
                    </p>
                  </div>
                </div>

                {/* Stat Badges */}
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-center flex flex-col items-center">
                    <Heart className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Vitality</span>
                    <span className="font-mono text-xs font-bold text-emerald-300">
                      {sheet?.current_vitality || 10}/{sheet?.vitality_max || 10}
                    </span>
                  </div>

                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-center flex flex-col items-center">
                    <Award className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold">AP</span>
                    <span className="font-mono text-xs font-bold text-amber-300">{sheet?.ap || 0}</span>
                  </div>

                  <div className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-center flex flex-col items-center">
                    <span className="text-xs mb-0.5">🛡️</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Def/Arm</span>
                    <span className="font-mono text-xs font-bold text-indigo-300">
                      {sheet?.defense || 10}/+{sheet?.armor || 0}
                    </span>
                  </div>
                </div>

                {/* Dice Ratings summary */}
                <div className="flex items-center justify-around p-2 bg-slate-900/50 rounded-lg border border-slate-850 font-mono text-[11px]">
                  <span>💪 {dice.might}</span>
                  <span>🏃 {dice.motion}</span>
                  <span>👁️ {dice.mind}</span>
                  <span>✨ {dice.magic}</span>
                  <span>🫀 {dice.moxie}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 border-t border-slate-850 pt-3">
                {!isActive ? (
                  <button
                    onClick={() => selectCharacter(char.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Switch
                  </button>
                ) : (
                  <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
                    <UserCheck className="w-4 h-4" /> Selected
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCloneCharacter(char)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-all"
                    title="Clone / Duplicate Template"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleExportJson(char)}
                    className="p-1.5 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-all"
                    title="Export to JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(char.id, char.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                    title="Delete Character"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
