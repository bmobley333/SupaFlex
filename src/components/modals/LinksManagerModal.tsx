// src/components/modals/LinksManagerModal.tsx
// Unified Master Modal for Managing External Links & Vaults across Player & GM modes

import React, { useState } from 'react';
import {
  Link2,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  Tag,
  Globe,
  FileText,
  Plus,
} from 'lucide-react';
import { ExternalDocLink, GmDocLink } from '../../types/game';

interface LinksManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'player' | 'gm';
  // Player Link Props
  playerLinks?: ExternalDocLink[];
  onSavePlayerLinks?: (links: ExternalDocLink[]) => void;
  // GM Link & Tag Props
  gmLinks?: GmDocLink[];
  onSaveGmLinks?: (links: GmDocLink[]) => void;
  adventureTags?: string[];
  onSaveAdventureTags?: (tags: string[]) => void;
  // Context info for footer
  heroName?: string;
  partyName?: string;
}

const formatUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const getDomainLabel = (rawUrl: string): string => {
  try {
    const formatted = formatUrl(rawUrl);
    const parsed = new URL(formatted);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'link';
  }
};

export const LinksManagerModal: React.FC<LinksManagerModalProps> = ({
  isOpen,
  onClose,
  mode,
  playerLinks = [],
  onSavePlayerLinks,
  gmLinks = [],
  onSaveGmLinks,
  adventureTags = [],
  onSaveAdventureTags,
  heroName,
  partyName,
}) => {
  // Form states for creating links
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newTag, setNewTag] = useState('General');
  const [newDesc, setNewDesc] = useState('');

  // Form state for editing links
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editTag, setEditTag] = useState('General');
  const [editDesc, setEditDesc] = useState('');

  // Form state for creating GM adventure tags
  const [newTagName, setNewTagName] = useState('');

  // Filter state for GM mode: 'ALL', 'GENERAL', or specific tag string
  const [activeTagFilter, setActiveTagFilter] = useState<string>('ALL');

  // Expanded card state
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // Compute unified list
  const isGm = mode === 'gm';

  const filteredLinks = isGm
    ? gmLinks.filter((link) => {
        if (activeTagFilter === 'ALL') return true;
        if (activeTagFilter === 'GENERAL') return !link.adventureTag || link.adventureTag === 'General';
        return link.adventureTag === activeTagFilter;
      })
    : playerLinks;

  // Add Link Handler
  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    const formatted = formatUrl(newUrl);

    if (isGm) {
      const newGmObj: GmDocLink = {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        url: formatted,
        adventureTag: newTag || 'General',
        description: newDesc.trim() || undefined,
      };
      if (onSaveGmLinks) {
        onSaveGmLinks([newGmObj, ...gmLinks]);
      }
    } else {
      const newPlayerObj: ExternalDocLink = {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        url: formatted,
        description: newDesc.trim() || undefined,
      };
      if (onSavePlayerLinks) {
        onSavePlayerLinks([newPlayerObj, ...playerLinks]);
      }
    }

    setNewTitle('');
    setNewUrl('');
    setNewTag('General');
    setNewDesc('');
  };

  // Edit Handlers
  const handleStartEdit = (id: string, title: string, url: string, tag: string = 'General', desc?: string) => {
    setEditingId(id);
    setEditTitle(title);
    setEditUrl(url);
    setEditTag(tag);
    setEditDesc(desc || '');
  };

  const handleSaveEdit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editUrl.trim()) return;

    const formatted = formatUrl(editUrl);

    if (isGm) {
      const updated = gmLinks.map((item) =>
        item.id === id
          ? {
              ...item,
              title: editTitle.trim(),
              url: formatted,
              adventureTag: editTag || 'General',
              description: editDesc.trim() || undefined,
            }
          : item
      );
      if (onSaveGmLinks) onSaveGmLinks(updated);
    } else {
      const updated = playerLinks.map((item) =>
        item.id === id
          ? {
              ...item,
              title: editTitle.trim(),
              url: formatted,
              description: editDesc.trim() || undefined,
            }
          : item
      );
      if (onSavePlayerLinks) onSavePlayerLinks(updated);
    }

    setEditingId(null);
  };

  // Delete Handler
  const handleDeleteLink = (id: string) => {
    if (isGm) {
      if (onSaveGmLinks) onSaveGmLinks(gmLinks.filter((item) => item.id !== id));
    } else {
      if (onSavePlayerLinks) onSavePlayerLinks(playerLinks.filter((item) => item.id !== id));
    }
  };

  // Adventure Tag Handlers
  const handleCreateTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed || adventureTags.includes(trimmed) || trimmed.toLowerCase() === 'general') return;
    if (onSaveAdventureTags) {
      onSaveAdventureTags([...adventureTags, trimmed]);
    }
    setNewTagName('');
  };

  const handleDeleteTag = (tagToDelete: string) => {
    if (onSaveAdventureTags) {
      onSaveAdventureTags(adventureTags.filter((t) => t !== tagToDelete));
    }
    if (activeTagFilter === tagToDelete) {
      setActiveTagFilter('ALL');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full flex flex-col max-h-[90vh] shadow-2xl overflow-hidden font-outfit">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/30 text-teal-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-400 tracking-wide flex items-center gap-2">
                Manage Links
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 font-bold border border-slate-700">
                  {isGm ? gmLinks.length : playerLinks.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {isGm
                  ? 'View, open, add, tag, edit, and organize GM external documents and lore vaults.'
                  : 'View, open, add, edit, and organize external character backgrounds, notes, or Google Docs.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2.5 py-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Two-Pane Grid Architecture */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40 flex-1 overflow-hidden">
          {/* Left Pane (md:col-span-7): Active Links Roster */}
          <div className="md:col-span-7 border-r border-slate-800/80 pr-6 flex flex-col gap-3 min-h-0">
            {/* Header & Tag Filter Bar */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-teal-300 uppercase tracking-wider flex items-center gap-2">
                  <span>📂</span> CONSTRUCTED LINKS ({filteredLinks.length})
                </h3>
              </div>

              {/* GM Adventure Tag Filter Pills */}
              {isGm && adventureTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Filter:</span>
                  <button
                    onClick={() => setActiveTagFilter('ALL')}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all ${
                      activeTagFilter === 'ALL'
                        ? 'bg-teal-500/30 text-teal-200 border-teal-500/60'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    All ({gmLinks.length})
                  </button>
                  <button
                    onClick={() => setActiveTagFilter('GENERAL')}
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all ${
                      activeTagFilter === 'GENERAL'
                        ? 'bg-teal-500/30 text-teal-200 border-teal-500/60'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    General ({gmLinks.filter((l) => !l.adventureTag || l.adventureTag === 'General').length})
                  </button>
                  {adventureTags.map((tag) => {
                    const count = gmLinks.filter((l) => l.adventureTag === tag).length;
                    const isSelected = activeTagFilter === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setActiveTagFilter(tag)}
                        className={`px-2 py-0.5 text-[11px] font-bold rounded-md border transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-amber-500/30 text-amber-200 border-amber-500/60'
                            : 'bg-slate-950 text-amber-400/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span>🏷️ {tag}</span>
                        <span className="text-[10px] font-mono opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scrollable Link Roster */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {filteredLinks.length === 0 ? (
                <div className="p-8 bg-slate-950/40 rounded-xl border border-slate-800/80 text-center flex flex-col items-center gap-2">
                  <Globe className="w-8 h-8 text-slate-600" />
                  <p className="text-xs text-slate-400 font-medium">No external document links found.</p>
                  <p className="text-[11px] text-slate-500">Use the right-hand panel to construct your first link.</p>
                </div>
              ) : (
                filteredLinks.map((link) => {
                  const gmLink = isGm ? (link as GmDocLink) : null;
                  const isEditing = editingId === link.id;
                  const isExpanded = !!expandedIds[link.id];
                  const domain = getDomainLabel(link.url);
                  const tagLabel = gmLink?.adventureTag || 'General';

                  if (isEditing) {
                    return (
                      <form
                        key={link.id}
                        onSubmit={(e) => handleSaveEdit(link.id, e)}
                        className="p-3.5 bg-slate-950/90 rounded-xl border border-amber-500/60 flex flex-col gap-2.5"
                      >
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-outfit">
                          Edit Document Link
                        </span>

                        <input
                          type="text"
                          required
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-outfit"
                        />
                        <input
                          type="text"
                          required
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-amber-500"
                        />

                        {isGm && (
                          <select
                            value={editTag}
                            onChange={(e) => setEditTag(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500 font-outfit"
                          >
                            <option value="General">General (Untagged)</option>
                            {adventureTags.map((t) => (
                              <option key={t} value={t}>
                                🏷️ {t}
                              </option>
                            ))}
                          </select>
                        )}

                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-sans"
                        />

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={link.id}
                      className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all hover:border-slate-700"
                    >
                      {/* Title & Primary Action Row */}
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-outfit font-bold text-sm text-slate-100 hover:text-teal-300 transition-colors flex items-center gap-1.5 truncate"
                          title="Open document in new tab"
                        >
                          <span className="truncate">{link.title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        </a>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-600/30 text-xs font-bold rounded-lg transition-all flex items-center gap-1 font-outfit"
                            title="Open link in new browser tab"
                          >
                            <span>Open</span>
                          </a>
                          {link.description && (
                            <button
                              onClick={() => toggleExpand(link.id)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                              title={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(link.id, link.title, link.url, gmLink?.adventureTag, link.description)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors"
                            title="Edit document link"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLink(link.id)}
                            className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 transition-colors"
                            title="Delete document link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isGm && (
                          <span
                            className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                              tagLabel === 'General'
                                ? 'bg-slate-900 text-slate-400 border-slate-800'
                                : 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                            }`}
                          >
                            🏷️ {tagLabel}
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {domain}
                        </span>
                      </div>

                      {/* Expandable Description & Raw URL */}
                      {(isExpanded || !link.description) && (
                        <div className="pt-2 border-t border-slate-800/60 text-xs flex flex-col gap-1">
                          {link.description && (
                            <p className="text-xs text-slate-300 leading-relaxed font-sans">{link.description}</p>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono truncate">{link.url}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane (md:col-span-5): Link Creator & Tag Manager */}
          <div className="md:col-span-5 flex flex-col gap-5 overflow-y-auto pr-1">
            {/* Form 1: Add New Link */}
            <form onSubmit={handleAddLink} className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                <FileText className="w-4 h-4 text-teal-400" />
                Construct New Link
              </span>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-1">
                  Document Title *
                  <span title="e.g. Backstory, Quest Log, Strahd Castle Map">
                    <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-teal-500 font-outfit"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-1">
                  Document URL *
                  <span title="e.g. docs.google.com/document/d/... or notion.so/...">
                    <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono outline-none focus:border-teal-500"
                />
              </div>

              {isGm && (
                <div>
                  <label className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-1">
                    Adventure Tag
                    <span title="Categorize under a specific adventure tag">
                      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                    </span>
                  </label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-teal-500 font-outfit"
                  >
                    <option value="General">General (Untagged)</option>
                    {adventureTags.map((t) => (
                      <option key={t} value={t}>
                        🏷️ {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-teal-500 font-sans"
                />
              </div>

              <button
                type="submit"
                className="mt-1 w-full py-2 bg-teal-600/30 text-teal-200 border border-teal-500/50 hover:bg-teal-600/50 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Save & Link Document
              </button>
            </form>

            {/* Form 2: GM Adventure Tag Manager */}
            {isGm && (
              <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                  <Tag className="w-4 h-4 text-amber-400" />
                  Manage Adventure Tags
                </span>

                <form onSubmit={handleCreateTag} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-1">
                      New Tag Name *
                      <span title="e.g. Curse of Strahd, Lost Citadel">
                        <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-500 font-outfit"
                    />
                  </div>
                  <button
                    type="submit"
                    className="mt-5 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-600/30 text-xs font-bold rounded-lg transition-all"
                  >
                    Save Tag
                  </button>
                </form>

                {/* Active Tag Pills */}
                {adventureTags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800">
                    {adventureTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded-lg text-xs font-mono flex items-center gap-1"
                      >
                        <span>🏷️ {tag}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag)}
                          className="hover:text-rose-400 transition-colors ml-0.5 font-bold"
                          title={`Delete tag "${tag}"`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0 font-outfit">
          <div>
            {isGm ? (
              <span>GM Mode • Party: <strong className="text-amber-300">{partyName || 'Active Campaign'}</strong></span>
            ) : (
              <span>Hero: <strong className="text-teal-300">{heroName || 'Adventurer'}</strong></span>
            )}
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
