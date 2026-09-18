// src/components/modals/ResolveBaseItemModal.tsx
// High-Density, Dyslexia-Friendly Modal to resolve [Weapon], [Armor], and [Shield] template items
// into concrete Non-Artifact items (Standard Gear and Exotics).

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check, Shield, Sword, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import {
  TemplateBracketType,
  getTemplateBracketType,
  replaceTemplateBracket,
  getNonArtifactCandidates,
  CatalogCollection,
} from '../../utils/templateItemResolver';
import { ItemNotesPopover } from '../common/ItemNotesPopover';

export interface ResolveBaseItemModalProps {
  isOpen: boolean;
  templateName: string;
  catalogs: CatalogCollection;
  isGsUnlocked?: boolean;
  characterName?: string;
  onConfirm: (resolvedName: string, selectedBaseItem: any) => void;
  onCancel: () => void;
}

type FilterScope = 'all' | 'standard' | 'exotic';

export const ResolveBaseItemModal: React.FC<ResolveBaseItemModalProps> = ({
  isOpen,
  templateName,
  catalogs,
  isGsUnlocked = false,
  characterName = 'Hero',
  onConfirm,
  onCancel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const bracketType: TemplateBracketType = useMemo(() => {
    return getTemplateBracketType(templateName) || 'weapon';
  }, [templateName]);

  // Reset state whenever modal opens or template changes
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setFilterScope('all');
      setSelectedItem(null);
    }
  }, [isOpen, templateName]);

  // Handle ESC key to cancel
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Fetch all valid non-artifact candidates
  const allCandidates = useMemo(() => {
    return getNonArtifactCandidates(bracketType, catalogs, isGsUnlocked);
  }, [bracketType, catalogs, isGsUnlocked]);

  // Helper to determine if a candidate item is an Exotic chassis
  const isCandidateExotic = useCallback((item: any): boolean => {
    if (!item) return false;
    if (item.is_exotic) return true;
    const cat = String(item.category || '').toLowerCase();
    if (cat.includes('exotic')) return true;
    if (item.effect && String(item.effect).trim() !== '') return true;
    return false;
  }, []);

  // Filter candidates by search and scope
  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((item) => {
      // 1. Scope filter
      const isExotic = isCandidateExotic(item);
      if (filterScope === 'standard' && isExotic) return false;
      if (filterScope === 'exotic' && !isExotic) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = (item.name || '').toLowerCase().includes(query);
        const catMatch = (item.category || item.type || '').toLowerCase().includes(query);
        const noteMatch = (item.notes || item.effect || '').toLowerCase().includes(query);
        if (!nameMatch && !catMatch && !noteMatch) return false;
      }

      return true;
    });
  }, [allCandidates, filterScope, searchQuery, isCandidateExotic]);

  // Live preview of the resolved item name
  const resolvedPreviewName = useMemo(() => {
    if (!selectedItem) return templateName;
    return replaceTemplateBracket(templateName, selectedItem.name);
  }, [templateName, selectedItem]);

  if (!isOpen) return null;

  const headerIcon =
    bracketType === 'weapon' ? (
      <Sword className="w-5 h-5 text-amber-400" />
    ) : bracketType === 'armor' ? (
      <Shield className="w-5 h-5 text-emerald-400" />
    ) : (
      <ShieldCheck className="w-5 h-5 text-cyan-400" />
    );

  const bracketLabel =
    bracketType === 'weapon' ? 'Weapon' : bracketType === 'armor' ? 'Armor' : 'Shield';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 shrink-0">
              {headerIcon}
            </div>
            <div className="min-w-0">
              <h3 className="font-outfit font-extrabold text-base text-slate-100 truncate flex items-center gap-2">
                <span>Choose Base {bracketLabel}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-500/30 font-mono">
                  {templateName}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Select any Non-Artifact {bracketLabel.toLowerCase()} (Standard or Exotic) to permanently name this template.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0 cursor-pointer"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Dynamic Preview Banner */}
        <div className="px-5 py-2.5 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] shrink-0">
              Resulting Name:
            </span>
            <span
              className={`font-mono font-extrabold text-sm truncate px-2.5 py-1 rounded-lg border ${
                selectedItem
                  ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-900 text-amber-300 border-amber-500/30'
              }`}
            >
              {resolvedPreviewName}
            </span>
          </div>
          {selectedItem && (
            <span className="text-[10px] text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Selected: {selectedItem.name}
            </span>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center gap-2.5">
          {/* Dyslexia-Friendly KISS Multi-Option Pill Switch */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`flex-1 sm:flex-none py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> All ({allCandidates.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('standard')}
              className={`flex-1 sm:flex-none py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                filterScope === 'standard'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Standard
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('exotic')}
              className={`flex-1 sm:flex-none py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                filterScope === 'exotic'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Exotics
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${allCandidates.length} base ${bracketLabel.toLowerCase()}s...`}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Candidate Items List */}
        <div className="p-3 bg-slate-900/50 flex-1 overflow-y-auto min-h-0 space-y-1.5">
          {filteredCandidates.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-1.5">
              <Search className="w-6 h-6 text-slate-600" />
              <span>No matching base {bracketLabel.toLowerCase()}s found.</span>
            </div>
          ) : (
            filteredCandidates.map((item) => {
              const isSelected = selectedItem?.name === item.name;
              const isExotic = isCandidateExotic(item);
              const costStr = item.cost || '0s';

              return (
                <div
                  key={item.id || item.name}
                  onClick={() => setSelectedItem(item)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 text-amber-100 shadow-md ring-1 ring-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:bg-slate-950/90'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : 'border-slate-700 bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-100 truncate">{item.name}</span>
                        {isExotic && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold">
                            🧿 Exotic
                          </span>
                        )}
                        {item.category && (
                          <span className="text-[10px] text-slate-400 font-medium truncate">
                            {item.category}
                          </span>
                        )}
                        <ItemNotesPopover
                          notes={item.notes || item.effect || ''}
                          itemName={item.name}
                          inline
                        />
                      </div>
                      {(item.notes || item.effect) && (
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {item.notes || item.effect}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {costStr && costStr !== '0s' && (
                      <span className="text-[10px] font-mono font-semibold text-slate-400">
                        {costStr}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 truncate">
            {selectedItem ? (
              <span>
                Resolving as: <strong className="text-emerald-300">{resolvedPreviewName}</strong>
              </span>
            ) : (
              <span className="text-amber-400/90 italic">
                * Please select a base {bracketLabel.toLowerCase()} to continue.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedItem}
              onClick={() => {
                if (selectedItem) {
                  onConfirm(resolvedPreviewName, selectedItem);
                }
              }}
              className={`px-4 py-1.5 text-xs font-extrabold rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                selectedItem
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 shadow-emerald-950/50'
                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              Claim to {characterName}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
