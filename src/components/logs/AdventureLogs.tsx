// src/components/logs/AdventureLogs.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Scroll,
  BookMarked,
  Check,
  Loader2,
  Link2,
  ExternalLink,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  Info,
} from 'lucide-react';
import { useCharacterStore } from '../../store/useCharacterStore';
import { ExternalDocLink } from '../../types/game';

export interface LogEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  completed?: boolean;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving';

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

export const AdventureLogs: React.FC = () => {
  const { activeCharacter, updateActiveSheetData, saveActiveCharacter } = useCharacterStore();

  const bioNotes = activeCharacter?.sheet_data?.bio?.notes || '';
  const backstory = activeCharacter?.sheet_data?.bio?.backstory || '';
  const personality = activeCharacter?.sheet_data?.bio?.personality || '';
  const initialDocLinks = activeCharacter?.sheet_data?.bio?.doc_links || [];

  const [notesText, setNotesText] = useState(bioNotes);
  const [backstoryText, setBackstoryText] = useState(backstory);
  const [personalityText, setPersonalityText] = useState(personality);
  const [docLinks, setDocLinks] = useState<ExternalDocLink[]>(initialDocLinks);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // External Links Form & Expansion State
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const latestRef = useRef({ notes: bioNotes, backstory, personality, docLinks: initialDocLinks });
  const activeCharRef = useRef(activeCharacter);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync ref with current state on every render
  useEffect(() => {
    latestRef.current = {
      notes: notesText,
      backstory: backstoryText,
      personality: personalityText,
      docLinks,
    };
    activeCharRef.current = activeCharacter;
  }, [notesText, backstoryText, personalityText, docLinks, activeCharacter]);

  // Re-initialize state when active character changes
  useEffect(() => {
    const curBio = activeCharacter?.sheet_data?.bio;
    const n = curBio?.notes || '';
    const b = curBio?.backstory || '';
    const p = curBio?.personality || '';
    const dl = curBio?.doc_links || [];

    setNotesText(n);
    setBackstoryText(b);
    setPersonalityText(p);
    setDocLinks(dl);
    latestRef.current = { notes: n, backstory: b, personality: p, docLinks: dl };
    setSaveStatus('saved');
  }, [activeCharacter?.id]);

  const flushAutoSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const current = latestRef.current;
    const savedBio = activeCharRef.current?.sheet_data?.bio;

    if (
      savedBio?.notes === current.notes &&
      savedBio?.backstory === current.backstory &&
      savedBio?.personality === current.personality &&
      JSON.stringify(savedBio?.doc_links || []) === JSON.stringify(current.docLinks)
    ) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    try {
      updateActiveSheetData((prev) => ({
        ...prev,
        bio: {
          ...prev.bio,
          notes: current.notes,
          backstory: current.backstory,
          personality: current.personality,
          doc_links: current.docLinks,
        },
      }));
      await saveActiveCharacter();
      setSaveStatus('saved');
    } catch (err) {
      console.error('[AdventureLogs] Auto-save error:', err);
      setSaveStatus('unsaved');
    }
  }, [updateActiveSheetData, saveActiveCharacter]);

  const scheduleAutoSave = () => {
    setSaveStatus('unsaved');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      flushAutoSave();
    }, 2500);
  };

  const handleBlur = () => {
    if (saveStatus === 'unsaved') {
      flushAutoSave();
    }
  };

  // Direct persistence for explicit CRUD actions on Document Links
  const persistDocLinks = (updatedLinks: ExternalDocLink[]) => {
    setDocLinks(updatedLinks);
    setSaveStatus('saving');
    updateActiveSheetData((prev) => ({
      ...prev,
      bio: {
        ...prev.bio,
        notes: notesText,
        backstory: backstoryText,
        personality: personalityText,
        doc_links: updatedLinks,
      },
    }));
    saveActiveCharacter()
      .then(() => setSaveStatus('saved'))
      .catch((err) => {
        console.error('[AdventureLogs] Direct doc link save error:', err);
        setSaveStatus('unsaved');
      });
  };

  // Flush unsaved changes on unmount (tab switch or exit)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const current = latestRef.current;
      const savedBio = activeCharRef.current?.sheet_data?.bio;
      if (
        savedBio?.notes !== current.notes ||
        savedBio?.backstory !== current.backstory ||
        savedBio?.personality !== current.personality ||
        JSON.stringify(savedBio?.doc_links || []) !== JSON.stringify(current.docLinks)
      ) {
        flushAutoSave();
      }
    };
  }, [flushAutoSave]);

  // CRUD Handlers for Document Links
  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    const formatted = formatUrl(newUrl);
    const newLinkObj: ExternalDocLink = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      url: formatted,
      description: newDesc.trim() || undefined,
    };

    const updated = [newLinkObj, ...docLinks];
    persistDocLinks(updated);

    // Reset Form
    setNewTitle('');
    setNewUrl('');
    setNewDesc('');
    setIsAddingLink(false);
  };

  const handleStartEdit = (link: ExternalDocLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditDesc(link.description || '');
  };

  const handleSaveEdit = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editUrl.trim()) return;

    const formatted = formatUrl(editUrl);
    const updated = docLinks.map((item) =>
      item.id === id
        ? {
            ...item,
            title: editTitle.trim(),
            url: formatted,
            description: editDesc.trim() || undefined,
          }
        : item
    );

    persistDocLinks(updated);
    setEditingId(null);
  };

  const handleDeleteLink = (id: string) => {
    const updated = docLinks.filter((item) => item.id !== id);
    persistDocLinks(updated);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderStatusBadge = () => {
    if (saveStatus === 'saving') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs font-semibold transition-all">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving...</span>
        </div>
      );
    }
    if (saveStatus === 'unsaved') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs font-semibold transition-all">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Unsaved changes...</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-semibold transition-all">
        <Check className="w-3.5 h-3.5" />
        <span>All changes saved</span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full max-w-[2500px] mx-auto">
      {/* Left Column (2/3): Session Journal & Quest Log */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-outfit font-bold text-base text-slate-100 flex items-center gap-2">
              <Scroll className="w-5 h-5 text-amber-400" />
              Adventure & Session Journal
            </h3>
            {renderStatusBadge()}
          </div>

          <textarea
            value={notesText}
            onChange={(e) => {
              setNotesText(e.target.value);
              scheduleAutoSave();
            }}
            onBlur={handleBlur}
            className="w-full min-h-[520px] bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs leading-relaxed text-slate-200 outline-none focus:border-indigo-500 font-mono resize-y"
          />
        </div>
      </div>

      {/* Right Column (1/3): Hero Lore, Bio & Linked Documents */}
      <div className="flex flex-col gap-6">
        {/* Card 1: Hero Lore & Bio */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-indigo-400" />
              <h3 className="font-outfit font-bold text-base text-slate-100">Hero Lore & Bio</h3>
            </div>
            {renderStatusBadge()}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Backstory & Origin
              </label>
              <textarea
                value={backstoryText}
                onChange={(e) => {
                  setBackstoryText(e.target.value);
                  scheduleAutoSave();
                }}
                onBlur={handleBlur}
                className="w-full min-h-[110px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Personality & Mannerisms
              </label>
              <textarea
                value={personalityText}
                onChange={(e) => {
                  setPersonalityText(e.target.value);
                  scheduleAutoSave();
                }}
                onBlur={handleBlur}
                className="w-full min-h-[110px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 outline-none focus:border-indigo-500 resize-y"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Linked Documents & Vaults (Full CRUD & Expandable) */}
        <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-teal-400" />
              <h3 className="font-outfit font-bold text-base text-slate-100">Linked Documents & Vaults</h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 font-bold border border-slate-700">
                {docLinks.length}
              </span>
            </div>
            <button
              onClick={() => setIsAddingLink(!isAddingLink)}
              className="px-2.5 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-600/30 text-xs font-bold rounded-lg transition-all shrink-0"
            >
              {isAddingLink ? 'Cancel' : '+ Add Link'}
            </button>
          </div>

          {/* Add Link Form Drawer */}
          {isAddingLink && (
            <form onSubmit={handleAddLink} className="p-3.5 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-3">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                Add External Document Link
              </span>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-1">
                  Document Title *
                  <span title="e.g. Character Backstory, GM Campaign Notes, Obsidian Vault">
                    <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-pointer" />
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-teal-500"
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
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingLink(false)}
                  className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 bg-teal-600/30 text-teal-200 border border-teal-500/50 hover:bg-teal-600/50 text-xs font-bold rounded-lg transition-all"
                >
                  Save & Link Document
                </button>
              </div>
            </form>
          )}

          {/* Links Roster */}
          <div className="flex flex-col gap-2.5 max-h-[450px] overflow-y-auto pr-1">
            {docLinks.length === 0 ? (
              <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/80 text-center flex flex-col items-center gap-1.5">
                <Globe className="w-6 h-6 text-slate-600" />
                <p className="text-xs text-slate-400 font-medium">No external document links added yet.</p>
                <p className="text-[11px] text-slate-500">Link Google Docs, Obsidian notes, PDFs, or GM lore folders above.</p>
              </div>
            ) : (
              docLinks.map((link) => {
                const isEditing = editingId === link.id;
                const isExpanded = !!expandedIds[link.id];
                const domain = getDomainLabel(link.url);

                if (isEditing) {
                  return (
                    <form
                      key={link.id}
                      onSubmit={(e) => handleSaveEdit(link.id, e)}
                      className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-col gap-2.5"
                    >
                      <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Edit Document Link</span>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        required
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 text-xs font-bold rounded-lg"
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
                    className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-2 transition-all hover:border-slate-700"
                  >
                    {/* Header Row: Title, Domain Badge, Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-outfit font-bold text-xs text-slate-100 hover:text-teal-300 transition-colors flex items-center gap-1.5 truncate"
                          title="Open document in new tab"
                        >
                          <span>{link.title}</span>
                          <ExternalLink className="w-3 h-3 text-teal-400 shrink-0" />
                        </a>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                          {domain}
                        </span>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-600/30 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1"
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
                          onClick={() => handleStartEdit(link)}
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

                    {/* Expandable Description & URL Body */}
                    {(isExpanded || !link.description) && (
                      <div className="flex flex-col gap-1 pt-1 border-t border-slate-800/60 text-xs">
                        {link.description && (
                          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{link.description}</p>
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
      </div>
    </div>
  );
};
