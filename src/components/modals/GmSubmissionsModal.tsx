// src/components/modals/GmSubmissionsModal.tsx
// GM Screen: Review and approve party member custom submissions for the Crafting Mall.

import React, { useState, useEffect } from 'react';
import { X, Inbox, Check, AlertCircle, RefreshCw, Crown } from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { gameApi } from '../../services/api';
import { CustomCreationItem } from '../../types/game';

interface GmSubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GmSubmissionsModal: React.FC<GmSubmissionsModalProps> = ({ isOpen, onClose }) => {
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const playerEmail = useCharacterStore((state) => state.playerEmail);

  const [submissions, setSubmissions] = useState<CustomCreationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadSubmissions = async () => {
    if (!isOpen || !activePartyId) return;
    setIsLoading(true);
    try {
      const pending = await gameApi.getPendingPartySubmissions(activePartyId);
      setSubmissions(pending);
    } catch (err: any) {
      console.error('[GmSubmissionsModal] Error loading submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSubmissions();
    }
  }, [isOpen, activePartyId]);

  if (!isOpen) return null;

  const handleApprove = async (item: CustomCreationItem) => {
    try {
      await gameApi.updateCustomItem(item.id, {
        gm_approved: true,
        approved_by_gm_email: playerEmail || undefined,
      });

      setFeedback({
        type: 'success',
        message: `👑 Approved '${item.name}' for Party [${activePartyId}]! It is now live in the Crafting Mall.`,
      });
      loadSubmissions();
    } catch (err: any) {
      console.error('[GmSubmissionsModal] Error approving item:', err);
      setFeedback({ type: 'error', message: 'Failed to approve submission.' });
    }
  };

  const handleReject = async (item: CustomCreationItem) => {
    if (!window.confirm(`Reject '${item.name}' and return it to ${item.author_name}'s personal library?`)) return;

    try {
      await gameApi.updateCustomItem(item.id, {
        party_id: null,
        gm_approved: false,
      });

      setFeedback({
        type: 'success',
        message: `Returned '${item.name}' to ${item.author_name}'s personal drafts.`,
      });
      loadSubmissions();
    } catch (err: any) {
      console.error('[GmSubmissionsModal] Error rejecting item:', err);
      setFeedback({ type: 'error', message: 'Failed to reject submission.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl w-full max-w-2xl shadow-2xl shadow-amber-950/50 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-outfit font-extrabold text-base text-amber-300 tracking-wide flex items-center gap-2">
                Player Submissions Queue
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  Room: {activePartyId || 'None'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Review and approve custom player creations for your campaign's Crafting Mall.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-3 p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold animate-fadeIn shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* List Body */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Checking pending submissions...</span>
            </div>
          ) : submissions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {submissions.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 rounded-xl flex flex-col gap-2.5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-outfit font-extrabold text-sm text-slate-100">{item.name}</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                          {item.type.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-300 font-semibold">
                        Submitted by {item.author_name} ({item.author_email})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.item_data?.action && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300">
                          {item.item_data.action}
                        </span>
                      )}
                      {item.item_data?.usage && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {item.item_data.usage}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.item_data?.effect || 'No description provided.'}</p>
                  {item.notes && <p className="text-[11px] text-slate-500 italic font-serif">"{item.notes}"</p>}

                  <div className="flex items-center justify-end gap-2 border-t border-slate-800/80 pt-2.5">
                    <button
                      onClick={() => handleReject(item)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/40 transition-colors cursor-pointer"
                    >
                      Reject Draft
                    </button>
                    <button
                      onClick={() => handleApprove(item)}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg border bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white border-amber-400/40 flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      <span>Approve for Party Mall</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs italic gap-1">
              <span>No pending player submissions for Party Room [{activePartyId || 'None'}].</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Pending Submissions: {submissions.length}</span>
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
