// src/components/rolls/RollHistoryLog.tsx
import React from 'react';
import { History, Trash2 } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { RollResult } from '../../lib/dice';

interface RollHistoryLogProps {
  recentRolls: RollResult[];
  onClearLocalHistory: () => void;
}

export const RollHistoryLog: React.FC<RollHistoryLogProps> = ({ recentRolls, onClearLocalHistory }) => {
  const { activeCharacter, updateActiveCharacterMeta, saveActiveCharacter } = useCharacterStore();
  const dbLogs: any[] = activeCharacter?.log || [];

  const handleClearAllLogs = () => {
    onClearLocalHistory();
    updateActiveCharacterMeta({ log: [] });
    saveActiveCharacter();
  };

  const combinedRolls = [...recentRolls];

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-outfit font-bold text-sm tracking-widest text-slate-300 uppercase flex items-center gap-2">
          <History className="w-4 h-4 text-purple-400" />
          Combat & Action Roll History
        </h3>
        <button
          onClick={handleClearAllLogs}
          className="px-2.5 py-1 bg-slate-950 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 text-xs font-semibold rounded border border-slate-800 flex items-center gap-1.5 transition-all"
        >
          <Trash2 className="w-3 h-3" />
          Clear Log
        </button>
      </div>

      {/* Log Feed List */}
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
        {combinedRolls.length === 0 && dbLogs.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No dice rolls recorded yet this session. Roll the die above to start logging outcomes!
          </p>
        ) : (
          combinedRolls.map((roll) => {
            const isCrit = roll.outcome === 'Critical Success';
            const isSuccess = roll.outcome === 'Success';
            const isPartial = roll.outcome === 'Partial Success';

            return (
              <div
                key={roll.id}
                className={`p-3 rounded-lg border flex flex-col gap-1 text-xs transition-all ${
                  isCrit
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : isSuccess
                    ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-200'
                    : isPartial
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>{new Date(roll.timestamp).toLocaleTimeString()}</span>
                  <span className="font-bold uppercase tracking-wider">{roll.outcome}</span>
                </div>
                <p className="font-medium">{roll.summary}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
