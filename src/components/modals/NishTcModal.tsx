import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Dices, Trash2 } from 'lucide-react';
import nishTcDataRaw from '../../data/nish_tc.json';

interface NishTcModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterName?: string;
}

export interface NishTcRollResult {
  id: string;
  type: 'tremendous' | 'critical';
  rollVal: number;
  name: string;
  effect: string;
  timestamp: string;
}

interface NishTcDataItem {
  id?: number;
  type: 'tremendous' | 'critical';
  roll_value: number;
  name: string;
  effect: string;
}

const LOCAL_NISH_TC: NishTcDataItem[] = nishTcDataRaw as NishTcDataItem[];

export const NishTcModal: React.FC<NishTcModalProps> = ({
  isOpen,
  onClose,
  characterName = 'Active Hero'
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [history, setHistory] = useState<NishTcRollResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const rollDice = (sides: number) => Math.floor(Math.random() * sides) + 1;

  const handleRoll = async (targetType: 'tremendous' | 'critical') => {
    setIsRolling(true);
    const rollVal = rollDice(50);

    let name = '';
    let effect = '';

    try {
      const { data, error } = await supabase
        .from('nish_tc')
        .select('*')
        .eq('type', targetType)
        .eq('roll_value', rollVal)
        .maybeSingle();

      if (!error && data && data.name && data.effect) {
        name = data.name;
        effect = data.effect;
      }
    } catch (err: any) {
      console.warn('Supabase nish_tc query notice:', err);
    }

    // If Supabase query failed or returned empty data, lookup in bundled local dataset
    if (!name || !effect) {
      const localMatch = LOCAL_NISH_TC.find(
        (item) => item.type === targetType && item.roll_value === rollVal
      );
      if (localMatch) {
        name = localMatch.name;
        effect = localMatch.effect;
      } else {
        name = `${targetType === 'tremendous' ? 'Tremendous' : 'Critical'} Result #${rollVal}`;
        effect =
          targetType === 'tremendous'
            ? 'Gain advantage or minor tactical bonus.'
            : 'Suffer minor penalty or complication.';
      }
    }

    const newResult: NishTcRollResult = {
      id: `nish-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: targetType,
      rollVal,
      name,
      effect,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setHistory((prev) => [newResult, ...prev]);
    showToast(`Rolled d50 #${rollVal}: ${name}`);
    setIsRolling(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2 rounded-xl font-extrabold text-xs shadow-xl animate-bounce border border-amber-300">
          ✨ {toastMessage}
        </div>
      )}

      {/* Main Modal Shell Container */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Modal Fixed Glass Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none">🌟</span>
            <div>
              <h3 className="text-xl font-extrabold text-amber-400 font-outfit tracking-wide flex items-center gap-2">
                Nish Tremendous & Critical Generator
              </h3>
              <p className="text-xs text-slate-400">
                Roll secret Tremendous or Critical Nish effects directly from Supabase.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal 2-Pane Blueprint Grid Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 min-h-0 overflow-hidden">
          
          {/* LEFT PANE (md:col-span-7): History Stream (Independent Scroll) */}
          <div className="md:col-span-7 flex flex-col h-full border-r border-slate-800/80 pr-6 min-h-0">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 shrink-0">
              <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span>📜 Recent Roll Log</span>
                <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded-md text-[10px]">
                  {history.length}
                </span>
              </span>

              {history.length > 0 && (
                <button
                  onClick={() => setHistory([])}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-900/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Log</span>
                </button>
              )}
            </div>

            {/* Results History Scrollable Container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-0">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-xl bg-slate-950/30">
                  <span className="text-3xl mb-2">🎲</span>
                  <p className="text-sm font-bold text-slate-400">No Nish rolls generated yet</p>
                  <p className="text-xs text-slate-500 max-w-xs mt-1">
                    Click <strong>Roll Tremendous</strong> or <strong>Roll Critical</strong> on the right to trigger a d50 secret outcome.
                  </p>
                </div>
              ) : (
                history.map((res) => (
                  <div
                    key={res.id}
                    className={`p-4 rounded-xl border transition-all ${
                      res.type === 'tremendous'
                        ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/30'
                        : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400 shadow-md shadow-rose-950/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                              res.type === 'tremendous'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {res.type === 'tremendous' ? '🌟 Tremendous Nish' : '💀 Critical Nish'} (d50 #{res.rollVal})
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono ml-auto">
                            {res.timestamp}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-100">{res.name}</h4>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{res.effect}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT PANE (md:col-span-5): Controls Card & Launchers (Independent Scroll) */}
          <div className="md:col-span-5 flex flex-col h-full space-y-6 overflow-y-auto pr-1 min-h-0">
            
            {/* Primary Action Button 1: Roll Tremendous Nish */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/30 space-y-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌟</span>
                <div>
                  <h4 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider font-outfit">
                    Tremendous Nish (d50)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    High-roll surge effect for natural 20 or critical success.
                  </p>
                </div>
              </div>

              <button
                disabled={isRolling}
                onClick={() => handleRoll('tremendous')}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:from-amber-600 text-slate-950 font-extrabold py-3.5 px-5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 border border-amber-300/40 cursor-pointer disabled:opacity-50"
              >
                <Dices className="w-4 h-4" />
                <span>🌟 Roll Tremendous Nish</span>
              </button>
            </div>

            {/* Primary Action Button 2: Roll Critical Nish */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-rose-500/30 space-y-3 shrink-0 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-xl">💀</span>
                <div>
                  <h4 className="text-sm font-extrabold text-rose-300 uppercase tracking-wider font-outfit">
                    Critical Nish (d50)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Complication or fumble effect for natural 1 or critical failure.
                  </p>
                </div>
              </div>

              <button
                disabled={isRolling}
                onClick={() => handleRoll('critical')}
                className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:from-rose-700 text-white font-extrabold py-3.5 px-5 rounded-xl text-sm transition-all shadow-lg shadow-rose-950/40 flex items-center justify-center gap-2 border border-rose-400/30 cursor-pointer disabled:opacity-50"
              >
                <Dices className="w-4 h-4" />
                <span>💀 Roll Critical Nish</span>
              </button>
            </div>

          </div>
        </div>

        {/* Modal Footer Context Bar with Standardized "Done" Button */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>Hero: <strong className="text-slate-200">{characterName}</strong></span>
          </div>
          
          <button 
            onClick={onClose} 
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
