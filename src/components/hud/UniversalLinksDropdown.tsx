// src/components/hud/UniversalLinksDropdown.tsx
// High-Density Parameterized Links Dropdown with In-Dropdown Micro-Form & Row Reorder Controls

import React, { useState, useRef, useEffect } from 'react';
import {
  Link2,
  ChevronDown,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  X,
} from 'lucide-react';
import { EncounterLink } from '../../types/adventures';

const formatUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export interface UniversalLinksDropdownProps {
  label: string; // e.g. "GM Links", "Adventure Links", "Encounter Links"
  links: EncounterLink[];
  onAddLink: (name: string, url: string) => Promise<void> | void;
  onUpdateLink: (linkId: string, name: string, url: string) => Promise<void> | void;
  onDeleteLink: (linkId: string) => Promise<void> | void;
  onReorderLinkByIndex?: (fromIdx: number, toIdx: number) => Promise<void> | void;
  disabled?: boolean;
  disabledTooltip?: string;
  topLabel?: string; // Optional uppercase header above button (e.g. for Adventure Ribbon)
  themeColor?: 'teal' | 'indigo' | 'amber' | 'cyan';
  className?: string;
}

export const UniversalLinksDropdown: React.FC<UniversalLinksDropdownProps> = ({
  label,
  links = [],
  onAddLink,
  onUpdateLink,
  onDeleteLink,
  onReorderLinkByIndex,
  disabled = false,
  disabledTooltip,
  topLabel,
  themeColor = 'teal',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Form states for creating / editing
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus when creating or editing
  useEffect(() => {
    if (isCreating || editingId) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isCreating, editingId]);

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormName('');
    setFormUrl('');
  };

  const handleStartEdit = (link: EncounterLink) => {
    setEditingId(link.id);
    setIsCreating(false);
    setFormName(link.name);
    setFormUrl(link.url);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormName('');
    setFormUrl('');
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName.trim() || !formUrl.trim()) return;

    const formattedUrl = formatUrl(formUrl);

    try {
      if (isCreating) {
        await onAddLink(formName.trim(), formattedUrl);
      } else if (editingId) {
        await onUpdateLink(editingId, formName.trim(), formattedUrl);
      }
      handleCancelForm();
    } catch (err) {
      console.error(`[UniversalLinksDropdown:${label}] Failed to save link:`, err);
    }
  };

  const handleOpenLink = (url: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteLink = async (link: EncounterLink) => {
    if (confirm(`Delete link "${link.name}"?`)) {
      try {
        await onDeleteLink(link.id);
      } catch (err) {
        console.error(`[UniversalLinksDropdown:${label}] Failed to delete link:`, err);
      }
    }
  };

  // Theme Styles
  const getThemeClasses = () => {
    switch (themeColor) {
      case 'indigo':
        return {
          btn: 'bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 border-indigo-500/40',
          icon: 'text-indigo-400',
          accent: 'text-indigo-300',
          hoverBg: 'hover:bg-indigo-950/60',
          borderActive: 'border-indigo-400',
          saveBtn: 'bg-indigo-600 hover:bg-indigo-500',
        };
      case 'amber':
        return {
          btn: 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border-amber-500/40',
          icon: 'text-amber-400',
          accent: 'text-amber-300',
          hoverBg: 'hover:bg-amber-950/60',
          borderActive: 'border-amber-400',
          saveBtn: 'bg-amber-600 hover:bg-amber-500',
        };
      case 'cyan':
        return {
          btn: 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border-cyan-500/40',
          icon: 'text-cyan-400',
          accent: 'text-cyan-300',
          hoverBg: 'hover:bg-cyan-950/60',
          borderActive: 'border-cyan-400',
          saveBtn: 'bg-cyan-600 hover:bg-cyan-500',
        };
      case 'teal':
      default:
        return {
          btn: 'bg-teal-950/70 hover:bg-teal-900/80 text-teal-200 border-teal-500/40',
          icon: 'text-teal-400',
          accent: 'text-teal-300',
          hoverBg: 'hover:bg-teal-950/60',
          borderActive: 'border-teal-400',
          saveBtn: 'bg-teal-600 hover:bg-teal-500',
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div className={`relative inline-flex flex-col items-center font-outfit ${className}`} ref={menuRef}>
      {/* Optional Top Label */}
      {topLabel && (
        <span className={`text-[11px] font-extrabold uppercase tracking-wider ${theme.icon} font-mono text-center mb-1`}>
          {topLabel}
        </span>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`px-2.5 py-1 ${theme.btn} border rounded-lg text-xs font-bold transition-all flex items-center justify-between gap-1.5 cursor-pointer min-w-[120px] max-w-[200px] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed`}
        title={disabled ? disabledTooltip || 'Disabled' : `${label} (${links.length})`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Link2 className={`w-3.5 h-3.5 ${theme.icon} shrink-0`} />
          <span className="truncate">
            {links.length > 0 ? `${label} (${links.length})` : label}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 ${theme.icon} shrink-0`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 text-xs">
          {/* Pinned Top: Create New Link Trigger (when not creating/editing) */}
          {!isCreating && !editingId && (
            <button
              type="button"
              onClick={handleStartCreate}
              className={`w-full text-left px-3 py-2 ${theme.hoverBg} ${theme.accent} font-bold border-b border-slate-800/80 flex items-center gap-1.5 cursor-pointer transition-colors`}
            >
              <Plus className={`w-3.5 h-3.5 ${theme.icon}`} />
              <span>+ Create New Link</span>
            </button>
          )}

          {/* Inline Create / Edit Micro-Form */}
          {(isCreating || editingId) && (
            <form onSubmit={handleSaveForm} className="p-2.5 border-b border-slate-800/80 bg-slate-900/70 space-y-2">
              <div className={`text-[10px] font-bold ${theme.accent} uppercase tracking-wider font-mono`}>
                {isCreating ? `➕ New ${label} Link` : `✏️ Edit ${label} Link`}
              </div>
              <input
                ref={nameInputRef}
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Link Name (e.g. Tactical Map)"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-400"
              />
              <input
                type="text"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="URL (e.g. https://...)"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-teal-400 font-mono"
              />
              <div className="flex items-center justify-end gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={!formName.trim() || !formUrl.trim()}
                  className={`px-2.5 py-1 ${theme.saveBtn} text-slate-950 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <Check className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          )}

          {/* Links List with In-Dropdown Up/Down, Edit, Delete */}
          <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
            {links.length === 0 ? (
              <div className="px-3 py-3 text-slate-500 italic text-center text-xs">
                No links configured. Click "+ Create New Link" above.
              </div>
            ) : (
              links.map((link, linkIdx) => {
                const isBeingEdited = editingId === link.id;
                return (
                  <div
                    key={link.id}
                    className={`w-full px-2.5 py-1.5 flex items-center justify-between gap-1.5 transition ${
                      isBeingEdited
                        ? `bg-slate-900/90 ${theme.accent} font-bold border-l-2 ${theme.borderActive}`
                        : `text-slate-300 hover:bg-slate-900/80 hover:${theme.accent}`
                    }`}
                  >
                    {/* Link Name with External Opener */}
                    <div
                      onClick={() => handleOpenLink(link.url)}
                      className="flex items-center gap-1.5 truncate flex-1 cursor-pointer group"
                      title={`Open: ${link.url}`}
                    >
                      <ExternalLink className={`w-3 h-3 ${theme.icon} opacity-70 group-hover:opacity-100 shrink-0 transition-opacity`} />
                      <span className="truncate group-hover:underline">{link.name}</span>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Move Up */}
                      {onReorderLinkByIndex && (
                        <button
                          type="button"
                          disabled={linkIdx === 0}
                          onClick={() => onReorderLinkByIndex(linkIdx, linkIdx - 1)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 transition-colors cursor-pointer"
                          title="Move Link Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                      )}

                      {/* Move Down */}
                      {onReorderLinkByIndex && (
                        <button
                          type="button"
                          disabled={linkIdx === links.length - 1}
                          onClick={() => onReorderLinkByIndex(linkIdx, linkIdx + 1)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 transition-colors cursor-pointer"
                          title="Move Link Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleStartEdit(link)}
                        className={`p-1 hover:bg-slate-800 rounded text-slate-400 hover:${theme.accent} transition-colors cursor-pointer`}
                        title="Edit Link Name & URL"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(link)}
                        className="p-1 hover:bg-rose-950/80 rounded text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                        title="Delete Link"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
