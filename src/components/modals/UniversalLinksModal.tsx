// src/components/modals/UniversalLinksModal.tsx
// Master-Detail Links & Notes Hub: Left-Pane Item List & Dispatcher, Right-Pane Spacious Tabbed Editor

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Link2,
  ExternalLink,
  Plus,
  Trash2,
  Search,
  Send,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Share2,
  Users,
  User,
  Inbox,
  BookmarkPlus,
  CheckSquare,
  Square,
  Loader2,
  Crown,
  Map,
  Swords,
  Scroll,
  FileText,
  Copy,
  RotateCcw,
  Mail,
  MailOpen,
} from 'lucide-react';
import {
  EncounterLink,
  ReceivedLinkItem,
  LINK_CATEGORIES,
  LinkCategory,
  LINK_CATEGORY_METADATA,
  normalizeLinkCategory,
} from '../../types/adventures';
import { CharacterBio } from '../../types/game';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useReceivedLinksStore } from '../../store/useReceivedLinksStore';
import { gameApi } from '../../services/api';
import { InfoTooltip } from '../common/InfoTooltip';

export type LinkScope = 'gm' | 'adventure' | 'encounter' | 'player' | 'character' | 'received';
export type EditorTab = 'link' | 'note' | 'dossier' | 'trait';

export interface UniversalLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScope?: LinkScope;
  initialTab?: EditorTab;
  themeColor?: 'teal' | 'indigo' | 'amber' | 'cyan' | 'rose' | 'emerald';
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

export const UniversalLinksModal: React.FC<UniversalLinksModalProps> = ({
  isOpen,
  onClose,
  initialScope,
  initialTab,
}) => {
  // Store hooks
  const activePartyId = useCharacterStore((state) => state.activePartyId);
  const activeRole = useCharacterStore((state) => state.activeRole);
  const activeCharacter = useCharacterStore((state) => state.activeCharacter);
  const playerEmail = useCharacterStore((state) => state.playerEmail);
  const playerLinks = useCharacterStore((state) => state.playerLinks);
  const addPlayerLink = useCharacterStore((state) => state.addPlayerLink);
  const updatePlayerLink = useCharacterStore((state) => state.updatePlayerLink);
  const deletePlayerLink = useCharacterStore((state) => state.deletePlayerLink);
  const reorderPlayerLinkByIndex = useCharacterStore((state) => state.reorderPlayerLinkByIndex);
  const addCharacterLink = useCharacterStore((state) => state.addCharacterLink);
  const updateCharacterLink = useCharacterStore((state) => state.updateCharacterLink);
  const deleteCharacterLink = useCharacterStore((state) => state.deleteCharacterLink);
  const reorderCharacterLinkByIndex = useCharacterStore((state) => state.reorderCharacterLinkByIndex);
  const updateActiveSheetData = useCharacterStore((state) => state.updateActiveSheetData);
  const saveActiveCharacter = useCharacterStore((state) => state.saveActiveCharacter);

  const gmLinks = useAdventureStore((state) => state.gmLinks);
  const activeAdv = useAdventureStore((state) => state.getActiveAdventure());
  const activeAct = useAdventureStore((state) => state.getActiveAct());
  const activeEnc = useAdventureStore((state) => state.getActiveEncounter());
  const addGmLink = useAdventureStore((state) => state.addGmLink);
  const updateGmLink = useAdventureStore((state) => state.updateGmLink);
  const deleteGmLink = useAdventureStore((state) => state.deleteGmLink);
  const reorderGmLinkByIndex = useAdventureStore((state) => state.reorderGmLinkByIndex);
  const addAdventureLink = useAdventureStore((state) => state.addAdventureLink);
  const updateAdventureLink = useAdventureStore((state) => state.updateAdventureLink);
  const deleteAdventureLink = useAdventureStore((state) => state.deleteAdventureLink);
  const reorderAdventureLinkByIndex = useAdventureStore((state) => state.reorderAdventureLinkByIndex);
  const addEncounterLink = useAdventureStore((state) => state.addEncounterLink);
  const updateEncounterLink = useAdventureStore((state) => state.updateEncounterLink);
  const deleteEncounterLink = useAdventureStore((state) => state.deleteEncounterLink);
  const reorderEncounterLinkByIndex = useAdventureStore((state) => state.reorderEncounterLinkByIndex);

  const receivedLinks = useReceivedLinksStore((state) => state.receivedLinks);
  const unreadCount = useReceivedLinksStore((state) => state.unreadCount);
  const loadReceivedLinks = useReceivedLinksStore((state) => state.loadReceivedLinks);
  const toggleReadStatus = useReceivedLinksStore((state) => state.toggleReadStatus);
  const markAsRead = useReceivedLinksStore((state) => state.markAsRead);
  const markAllAsRead = useReceivedLinksStore((state) => state.markAllAsRead);
  const deleteReceivedLink = useReceivedLinksStore((state) => state.deleteReceivedLink);
  const clearReceivedLinks = useReceivedLinksStore((state) => state.clearReceivedLinks);
  const dispatchLinksToParty = useReceivedLinksStore((state) => state.dispatchLinksToParty);

  // Active Scope State
  const defaultScope: LinkScope = activeRole === 'gm' ? 'gm' : 'player';
  const [currentScope, setCurrentScope] = useState<LinkScope>(initialScope || defaultScope);

  // Target Scope for saving received items (e.g. 'gm' | 'adventure' | 'encounter' | 'player' | 'character')
  const [receivedTargetScope, setReceivedTargetScope] = useState<string>('auto');

  // Editor Tab State (for Right Pane)
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>(initialTab || 'link');

  const bio: CharacterBio = activeCharacter?.sheet_data?.bio || {};

  const handleBioChange = (field: keyof CharacterBio, value: string) => {
    updateActiveSheetData((prev) => ({
      ...prev,
      bio: {
        ...(prev.bio || {}),
        [field]: value,
      },
    }));
    saveActiveCharacter();
  };

  // Sync initial scope & tab on modal open or role change
  useEffect(() => {
    if (isOpen) {
      if (initialScope) {
        setCurrentScope(initialScope);
      } else {
        setCurrentScope(activeRole === 'gm' ? 'gm' : 'player');
      }
      if (initialTab) {
        setActiveEditorTab(initialTab);
      }
    }
  }, [isOpen, initialScope, initialTab, activeRole]);

  // Form states for creating / editing links
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTag, setFormTag] = useState<LinkCategory>('External / Web');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for creating / editing notes
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTag, setNoteTag] = useState<LinkCategory>('Lore / Narrative');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Selected received item for inspection in Received Scope
  const [selectedReceivedId, setSelectedReceivedId] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');

  // Dispatch / Share states
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [sendToAllParty, setSendToAllParty] = useState(true);
  const [selectedRecipientCharacterIds, setSelectedRecipientCharacterIds] = useState<string[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [partyMembers, setPartyMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const noteTitleInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load received links on modal open
  useEffect(() => {
    if (isOpen) {
      loadReceivedLinks(activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined);
    }
  }, [isOpen, activePartyId, activeCharacter?.id, loadReceivedLinks]);

  // Load party members for dispatcher
  useEffect(() => {
    if (!isOpen || !activePartyId) return;

    const fetchMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const members = await gameApi.getPartySessionMembers(activePartyId);
        setPartyMembers(members || []);
      } catch (err) {
        console.error('[UniversalLinksModal] Error fetching party members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [isOpen, activePartyId]);

  // Derive active links, active titles, and action handlers based on currentScope
  const scopeData = useMemo(() => {
    switch (currentScope) {
      case 'gm':
        return {
          title: 'GM Global Links & Notes',
          subtitle: 'Universal Campaign & Reference Links',
          links: gmLinks,
          icon: <Crown className="w-5 h-5 text-amber-400" />,
          activeColor: 'bg-teal-600',
          accentText: 'text-teal-300',
          badgeStyle: 'bg-teal-950/80 text-teal-300 border-teal-500/40',
          isDisabled: false,
          disabledReason: '',
          onAdd: async (name: string, url: string, tag?: string, desc?: string) => {
            await addGmLink(name, url, tag, desc);
          },
          onUpdate: async (id: string, name: string, url: string, tag?: string, desc?: string) => {
            await updateGmLink(id, name, url, tag, desc);
          },
          onDelete: async (id: string) => {
            await deleteGmLink(id);
          },
          onReorder: async (fromIdx: number, toIdx: number) => {
            await reorderGmLinkByIndex(fromIdx, toIdx);
          },
        };
      case 'adventure':
        return {
          title: 'Adventure Links & Notes',
          subtitle: activeAdv ? activeAdv.title : 'No Active Adventure Selected',
          links: activeAdv?.links || [],
          icon: <Map className="w-5 h-5 text-indigo-400" />,
          activeColor: 'bg-indigo-600',
          accentText: 'text-indigo-300',
          badgeStyle: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
          isDisabled: !activeAdv,
          disabledReason: 'Select or create an adventure in GM Screen to manage Adventure Links & Notes.',
          onAdd: async (name: string, url: string, tag?: string, desc?: string) => {
            if (!activeAdv) return;
            await addAdventureLink(activeAdv.id, name, url, tag, desc);
          },
          onUpdate: async (id: string, name: string, url: string, tag?: string, desc?: string) => {
            if (!activeAdv) return;
            await updateAdventureLink(activeAdv.id, id, name, url, tag, desc);
          },
          onDelete: async (id: string) => {
            if (!activeAdv) return;
            await deleteAdventureLink(activeAdv.id, id);
          },
          onReorder: async (fromIdx: number, toIdx: number) => {
            if (!activeAdv) return;
            await reorderAdventureLinkByIndex(activeAdv.id, fromIdx, toIdx);
          },
        };
      case 'encounter':
        return {
          title: 'Encounter Links & Notes',
          subtitle: activeEnc ? `${activeAdv?.title || 'Adv'} > ${activeEnc.title}` : 'No Active Encounter Selected',
          links: activeEnc?.links || [],
          icon: <Swords className="w-5 h-5 text-amber-400" />,
          activeColor: 'bg-amber-600',
          accentText: 'text-amber-300',
          badgeStyle: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
          isDisabled: !activeEnc || !activeAdv || !activeAct,
          disabledReason: 'Select an encounter in GM Screen to manage Encounter-specific links & notes.',
          onAdd: async (name: string, url: string, tag?: string, desc?: string) => {
            if (!activeAdv || !activeAct || !activeEnc) return;
            await addEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, name, url, tag, desc);
          },
          onUpdate: async (id: string, name: string, url: string, tag?: string, desc?: string) => {
            if (!activeAdv || !activeAct || !activeEnc) return;
            await updateEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, id, name, url, tag, desc);
          },
          onDelete: async (id: string) => {
            if (!activeAdv || !activeAct || !activeEnc) return;
            await deleteEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, id);
          },
          onReorder: async (fromIdx: number, toIdx: number) => {
            if (!activeAdv || !activeAct || !activeEnc) return;
            await reorderEncounterLinkByIndex(activeAdv.id, activeAct.id, activeEnc.id, fromIdx, toIdx);
          },
        };
      case 'player':
        return {
          title: 'Player Global Links & Notes',
          subtitle: playerEmail ? `Account: ${playerEmail}` : 'Account-Wide Player Links & Notes',
          links: playerLinks,
          icon: <User className="w-5 h-5 text-cyan-400" />,
          activeColor: 'bg-cyan-600',
          accentText: 'text-cyan-300',
          badgeStyle: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
          isDisabled: false,
          disabledReason: '',
          onAdd: async (name: string, url: string, tag?: string, desc?: string) => {
            addPlayerLink(name, url, tag, desc);
          },
          onUpdate: async (id: string, name: string, url: string, tag?: string, desc?: string) => {
            updatePlayerLink(id, name, url, tag, desc);
          },
          onDelete: async (id: string) => {
            deletePlayerLink(id);
          },
          onReorder: async (fromIdx: number, toIdx: number) => {
            reorderPlayerLinkByIndex(fromIdx, toIdx);
          },
        };
      case 'character':
        return {
          title: 'Character Links & Notes',
          subtitle: activeCharacter ? activeCharacter.name : 'No Active Hero Selected',
          links: activeCharacter?.sheet_data?.character_links || [],
          icon: <Scroll className="w-5 h-5 text-indigo-400" />,
          activeColor: 'bg-indigo-600',
          accentText: 'text-indigo-300',
          badgeStyle: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
          isDisabled: !activeCharacter,
          disabledReason: 'Select or load a hero character to manage character-specific links & notes.',
          onAdd: async (name: string, url: string, tag?: string, desc?: string) => {
            addCharacterLink(name, url, tag, desc);
          },
          onUpdate: async (id: string, name: string, url: string, tag?: string, desc?: string) => {
            updateCharacterLink(id, name, url, tag, desc);
          },
          onDelete: async (id: string) => {
            deleteCharacterLink(id);
          },
          onReorder: async (fromIdx: number, toIdx: number) => {
            reorderCharacterLinkByIndex(fromIdx, toIdx);
          },
        };
      case 'received':
      default:
        return {
          title: 'Received Links, Notes & Handouts',
          subtitle: 'Real-Time In-Session Shared Links & Notes Inbox',
          links: receivedLinks,
          icon: <Inbox className="w-5 h-5 text-emerald-400" />,
          activeColor: 'bg-emerald-600',
          accentText: 'text-emerald-300',
          badgeStyle: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
          isDisabled: false,
          disabledReason: '',
          onAdd: async () => {},
          onUpdate: async () => {},
          onDelete: async () => {},
          onReorder: undefined,
        };
    }
  }, [
    currentScope,
    gmLinks,
    activeAdv,
    activeAct,
    activeEnc,
    playerLinks,
    activeCharacter,
    playerEmail,
    receivedLinks,
    addGmLink,
    updateGmLink,
    deleteGmLink,
    reorderGmLinkByIndex,
    addAdventureLink,
    updateAdventureLink,
    deleteAdventureLink,
    reorderAdventureLinkByIndex,
    addEncounterLink,
    updateEncounterLink,
    deleteEncounterLink,
    reorderEncounterLinkByIndex,
    addPlayerLink,
    updatePlayerLink,
    deletePlayerLink,
    reorderPlayerLinkByIndex,
    addCharacterLink,
    updateCharacterLink,
    deleteCharacterLink,
    reorderCharacterLinkByIndex,
  ]);

  const handleStartEdit = (link: EncounterLink) => {
    const isNote = !link.url || !link.url.trim() || link.isNote;
    setEditingId(link.id);
    setIsEditingNote(!!isNote);

    if (isNote) {
      setActiveEditorTab('note');
      setNoteTitle(link.name);
      setNoteContent(link.description || '');
      setNoteTag(normalizeLinkCategory(link.categoryTag));
      if (noteTitleInputRef.current) {
        noteTitleInputRef.current.focus();
      }
    } else {
      setActiveEditorTab('link');
      setFormName(link.name);
      setFormUrl(link.url || '');
      setFormTag(normalizeLinkCategory(link.categoryTag));
      setFormDesc(link.description || '');
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }
  };

  const handleResetEditor = () => {
    setEditingId(null);
    setIsEditingNote(false);
    setFormName('');
    setFormUrl('');
    setFormTag('External / Web');
    setFormDesc('');
    setNoteTitle('');
    setNoteContent('');
    setNoteTag('Lore / Narrative');
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName.trim() || !formUrl.trim() || isSubmitting || scopeData.isDisabled) return;

    setIsSubmitting(true);
    const formattedUrl = formatUrl(formUrl);

    try {
      if (editingId && !isEditingNote) {
        await scopeData.onUpdate(editingId, formName.trim(), formattedUrl, formTag, formDesc.trim());
        showToast(`Updated "${formName.trim()}"`);
      } else {
        await scopeData.onAdd(formName.trim(), formattedUrl, formTag, formDesc.trim());
        showToast(`Added link "${formName.trim()}"`);
      }
      handleResetEditor();
    } catch (err) {
      console.error('[UniversalLinksModal] Error saving link:', err);
      showToast('Failed to save link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim() || isSubmittingNote || scopeData.isDisabled) return;

    setIsSubmittingNote(true);

    try {
      if (editingId && isEditingNote) {
        await scopeData.onUpdate(editingId, noteTitle.trim(), '', noteTag, noteContent.trim());
        showToast(`Updated note "${noteTitle.trim()}"`);
      } else {
        await scopeData.onAdd(noteTitle.trim(), '', noteTag, noteContent.trim());
        showToast(`Added note "${noteTitle.trim()}"`);
      }
      handleResetEditor();
    } catch (err) {
      console.error('[UniversalLinksModal] Error saving note:', err);
      showToast('Failed to save note.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDelete = async (link: EncounterLink) => {
    if (confirm(`Delete item "${link.name}"?`)) {
      try {
        await scopeData.onDelete(link.id);
        setSelectedLinkIds((prev) => prev.filter((id) => id !== link.id));
        if (editingId === link.id) {
          handleResetEditor();
        }
        showToast(`Deleted "${link.name}"`);
      } catch (err) {
        console.error('[UniversalLinksModal] Error deleting item:', err);
      }
    }
  };

  const handleOpenLink = (url?: string, receivedId?: string) => {
    if (!url) return;
    if (receivedId) {
      markAsRead(receivedId);
    }
    window.open(formatUrl(url), '_blank', 'noopener,noreferrer');
  };

  const handleCopyNoteText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('📋 Copied note to clipboard!');
  };

  const handleSaveReceivedToTargetScope = async (item: ReceivedLinkItem, targetScopeOverride?: string) => {
    try {
      const catTag = normalizeLinkCategory(item.categoryTag);
      let target = targetScopeOverride || receivedTargetScope;

      // Auto-fallback determination
      if (target === 'auto') {
        if (activeRole === 'gm') {
          target = activeEnc ? 'encounter' : activeAdv ? 'adventure' : 'gm';
        } else {
          target = activeCharacter ? 'character' : 'player';
        }
      }

      if (activeRole === 'gm') {
        if (target === 'encounter' && activeAdv && activeAct && activeEnc) {
          await addEncounterLink(activeAdv.id, activeAct.id, activeEnc.id, item.name, item.url || '', catTag, item.description);
          showToast(`✨ Saved copy of "${item.name}" to Encounter "${activeEnc.title}"!`);
        } else if (target === 'adventure' && activeAdv) {
          await addAdventureLink(activeAdv.id, item.name, item.url || '', catTag, item.description);
          showToast(`✨ Saved copy of "${item.name}" to Adventure "${activeAdv.title}"!`);
        } else {
          await addGmLink(item.name, item.url || '', catTag, item.description);
          showToast(`✨ Saved copy of "${item.name}" to GM Global Scope!`);
        }
      } else {
        if (target === 'character' && activeCharacter) {
          addCharacterLink(item.name, item.url || '', catTag, item.description);
          showToast(`✨ Saved copy of "${item.name}" to Character "${activeCharacter.name}"!`);
        } else {
          addPlayerLink(item.name, item.url || '', catTag, item.description);
          showToast(`✨ Saved copy of "${item.name}" to Player Scope!`);
        }
      }
    } catch (err) {
      console.error('[UniversalLinksModal] Error saving received item:', err);
      showToast('Failed to save item copy.');
    }
  };

  // Toggle link selection for dispatch
  const handleToggleSelectLink = (linkId: string) => {
    setSelectedLinkIds((prev) =>
      prev.includes(linkId) ? prev.filter((id) => id !== linkId) : [...prev, linkId]
    );
  };

  const isDossierVisibleInLeftPane =
    currentScope === 'character' &&
    !!activeCharacter &&
    (!searchQuery ||
      'character dossier'.includes(searchQuery.toLowerCase()) ||
      'dossier'.includes(searchQuery.toLowerCase()) ||
      (bio.appearance && bio.appearance.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bio.positive_trait && bio.positive_trait.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bio.negative_trait && bio.negative_trait.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bio.flair && bio.flair.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bio.adventuring_goal && bio.adventuring_goal.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bio.notes && bio.notes.toLowerCase().includes(searchQuery.toLowerCase()))) &&
    (selectedTagFilter === 'ALL' || selectedTagFilter === 'Lore / Narrative');

  const handleSelectAllLinks = () => {
    const totalVisibleCount = filteredLinks.length + (isDossierVisibleInLeftPane ? 1 : 0);
    if (selectedLinkIds.length === totalVisibleCount && totalVisibleCount > 0) {
      setSelectedLinkIds([]);
    } else {
      const allIds = filteredLinks.map((l) => l.id);
      if (isDossierVisibleInLeftPane) {
        allIds.push('__char_dossier__');
      }
      setSelectedLinkIds(allIds);
    }
  };

  const handleToggleRecipient = (charId: string) => {
    setSelectedRecipientCharacterIds((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  };

  // Dispatch selected links to party
  const handleDispatchSelected = async () => {
    if (selectedLinkIds.length === 0) {
      showToast('Please select at least 1 item to share.');
      return;
    }
    if (!activePartyId) {
      showToast('No active party room connected.');
      return;
    }

    const isDossierSelected = selectedLinkIds.includes('__char_dossier__') || selectedLinkIds.includes('__char_traits__');
    const standardLinksToSend = scopeData.links.filter((l) => selectedLinkIds.includes(l.id));

    let linksToSend = [...standardLinksToSend];

    if (isDossierSelected && activeCharacter) {
      const charBio = activeCharacter.sheet_data?.bio || {};
      const dossierMarkdownLines = [
        `### 👤 ${activeCharacter.name || 'Hero'} — Dossier`,
        '',
        `- **Height:** ${charBio.height || '—'} | **Weight:** ${charBio.weight || '—'} | **Age:** ${charBio.age || '—'}`,
        `- **Appearance:** ${charBio.appearance || '—'}`,
        `- **Positive Trait:** ${charBio.positive_trait || '—'}`,
        `- **Negative Trait:** ${charBio.negative_trait || '—'}`,
        `- **Flair:** ${charBio.flair || '—'}`,
        `- **Adventuring Goal:** ${charBio.adventuring_goal || '—'}`,
        `- **Notes:** ${charBio.notes || '—'}`,
      ].join('\n');

      const dossierLinkItem: EncounterLink = {
        id: `dossier_${activeCharacter.id}_${Date.now()}`,
        name: `${activeCharacter.name || 'Hero'} - Dossier`,
        description: dossierMarkdownLines,
        categoryTag: 'Lore / Narrative',
        isNote: true,
        created_at: new Date().toISOString(),
      };

      linksToSend = [dossierLinkItem, ...linksToSend];
    }

    if (linksToSend.length === 0) return;

    setIsDispatching(true);
    const senderName =
      activeRole === 'gm'
        ? '👑 GM'
        : activeCharacter?.name
        ? `${activeCharacter.name}`
        : playerEmail || 'Player';

    const result = await dispatchLinksToParty(linksToSend, {
      senderName,
      senderRole: activeRole === 'gm' ? 'gm' : 'player',
      targetType: sendToAllParty ? 'all' : 'specific',
      targetCharacterIds: sendToAllParty ? undefined : selectedRecipientCharacterIds,
      partyId: activePartyId,
    });

    setIsDispatching(false);
    if (result.success) {
      showToast(`🚀 Dispatched ${result.count} item(s) to ${sendToAllParty ? 'Entire Party' : `${selectedRecipientCharacterIds.length} member(s)`}!`);
      setSelectedLinkIds([]);
      setShowMemberPicker(false);
    } else {
      showToast('Failed to dispatch items.');
    }
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    return scopeData.links.filter((link) => {
      const matchSearch =
        !searchQuery ||
        link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.url && link.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (link.categoryTag && link.categoryTag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (link.description && link.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((link as ReceivedLinkItem).senderName &&
          (link as ReceivedLinkItem).senderName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTag =
        currentScope === 'received' ||
        selectedTagFilter === 'ALL' ||
        normalizeLinkCategory(link.categoryTag) === selectedTagFilter;

      return matchSearch && matchTag;
    });
  }, [scopeData.links, searchQuery, selectedTagFilter, currentScope]);

  // Selected received item for inspection
  const activeReceivedItem = useMemo(() => {
    if (currentScope !== 'received') return null;
    if (selectedReceivedId) {
      const found = (receivedLinks as ReceivedLinkItem[]).find((r) => r.id === selectedReceivedId);
      if (found) return found;
    }
    return (receivedLinks[0] as ReceivedLinkItem) || null;
  }, [currentScope, selectedReceivedId, receivedLinks]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-outfit">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border border-emerald-500/80 text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl animate-slideDown flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/90 shrink-0 gap-4">
          {/* Left Zone: Icon + Title + Count Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
              {scopeData.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base tracking-wide text-white uppercase font-outfit">
                  {scopeData.title}
                </h2>
                <span className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${scopeData.badgeStyle}`}>
                  {scopeData.links.length} Items
                </span>
              </div>
            </div>
          </div>

          {/* Center Zone: Role-Aware KISS Multi-Option Pill Switch + Sub-text directly below pill */}
          <div className="flex flex-col items-center gap-1 flex-1 max-w-xl">
            <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
              {activeRole === 'gm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScope('gm');
                      handleResetEditor();
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentScope === 'gm'
                        ? 'bg-teal-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>GM ({gmLinks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScope('adventure');
                      handleResetEditor();
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentScope === 'adventure'
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>Adventure ({activeAdv?.links?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScope('encounter');
                      handleResetEditor();
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentScope === 'encounter'
                        ? 'bg-amber-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Encounter ({activeEnc?.links?.length || 0})</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScope('player');
                      handleResetEditor();
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentScope === 'player'
                        ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Player ({playerLinks.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentScope('character');
                      handleResetEditor();
                    }}
                    className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      currentScope === 'character'
                        ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Scroll className="w-3.5 h-3.5" />
                    <span>Character ({activeCharacter?.sheet_data?.character_links?.length || 0})</span>
                  </button>
                </>
              )}

              {/* Received Tab (Universal) */}
              <button
                type="button"
                onClick={() => {
                  setCurrentScope('received');
                  handleResetEditor();
                }}
                className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer relative ${
                  currentScope === 'received'
                    ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>Received ({receivedLinks.length})</span>
                {unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Sub-text positioned directly below pill toggle area */}
            <p className="text-[11px] text-slate-400 font-mono tracking-wide truncate max-w-md text-center">
              {scopeData.subtitle}
            </p>
          </div>

          {/* Right Zone: Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Two-Pane Master-Detail Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* ======================================================================== */}
          {/* LEFT PANE: Master List & Bottom Dispatcher Shelf (w-[400px])             */}
          {/* ======================================================================== */}
          <div className="w-[400px] border-r border-slate-800 bg-slate-950/40 p-3.5 flex flex-col gap-2.5 overflow-hidden shrink-0">
            {/* Search & Select All Controls */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder={currentScope === 'received' ? 'Search received items...' : 'Search links & notes...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {currentScope === 'received' ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={unreadCount === 0}
                    onClick={() => markAllAsRead(activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined)}
                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="Mark all as read"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark Read</span>
                  </button>
                  <button
                    type="button"
                    disabled={receivedLinks.length === 0}
                    onClick={() => {
                      if (confirm('Clear all received items from inbox?')) {
                        clearReceivedLinks(activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined);
                        showToast('Cleared inbox.');
                      }
                    }}
                    className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-lg transition cursor-pointer disabled:opacity-40"
                    title="Clear Inbox"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectAllLinks}
                  className="px-2 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="Select / Unselect All for Sharing"
                >
                  {selectedLinkIds.length === filteredLinks.length && filteredLinks.length > 0 ? (
                    <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{selectedLinkIds.length === filteredLinks.length && filteredLinks.length > 0 ? 'Deselect' : 'Select All'}</span>
                </button>
              )}
            </div>

            {/* Tag Filter Pills */}
            {currentScope !== 'received' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter('ALL')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer shrink-0 ${
                    selectedTagFilter === 'ALL'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  ALL ({scopeData.links.length})
                </button>
                {LINK_CATEGORIES.map((cat) => {
                  const count = scopeData.links.filter((l) => normalizeLinkCategory(l.categoryTag) === cat).length;
                  if (count === 0 && selectedTagFilter !== cat) return null;
                  const meta = LINK_CATEGORY_METADATA[cat];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedTagFilter(cat)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 shrink-0 ${
                        selectedTagFilter === cat
                          ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                      }`}
                      title={meta.description}
                    >
                      <span>{meta.icon}</span>
                      <span>{cat.split(' ')[0]}</span>
                      <span className="font-mono opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Scrollable Master List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
              {currentScope !== 'received' ? (
                filteredLinks.length === 0 && !isDossierVisibleInLeftPane ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-950/30 rounded-xl border border-slate-800/60 text-center">
                    <Link2 className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No items in {scopeData.title.split('&')[0]}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {scopeData.isDisabled ? scopeData.disabledReason : 'Use the editor on the right to create links or notes.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Pinned Character Dossier Card (Character Scope Only) */}
                    {isDossierVisibleInLeftPane && (
                      <div
                        onClick={() => {
                          setActiveEditorTab('dossier');
                          setEditingId(null);
                          setIsEditingNote(false);
                        }}
                        className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 shadow-sm cursor-pointer ${
                          activeEditorTab === 'dossier' || activeEditorTab === 'trait'
                            ? 'bg-purple-950/40 border-purple-500/60 ring-1 ring-purple-500/40'
                            : selectedLinkIds.includes('__char_dossier__') || selectedLinkIds.includes('__char_traits__')
                            ? 'bg-purple-950/30 border-purple-500/50'
                            : 'bg-slate-950/80 border-purple-900/40 hover:border-purple-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectLink('__char_dossier__');
                              }}
                              className="p-0.5 text-slate-400 hover:text-purple-300 transition cursor-pointer shrink-0"
                              title={selectedLinkIds.includes('__char_dossier__') || selectedLinkIds.includes('__char_traits__') ? 'Deselect dossier' : 'Select dossier for sharing'}
                            >
                              {selectedLinkIds.includes('__char_dossier__') || selectedLinkIds.includes('__char_traits__') ? (
                                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>

                            <span className="text-sm">👤</span>
                            <span className="font-bold text-xs text-white truncate font-outfit">
                              Character Dossier
                            </span>
                          </div>

                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 shrink-0">
                            Dossier
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate pl-6 font-sans">
                          {bio.appearance || bio.positive_trait || bio.adventuring_goal || 'Height, Weight, Age, Appearance, Dossier & Notes'}
                        </p>
                      </div>
                    )}

                    {filteredLinks.map((link, idx) => {
                    const isSelected = selectedLinkIds.includes(link.id);
                    const isEditing = editingId === link.id;
                    const isNote = !link.url || !link.url.trim() || link.isNote;
                    const domain = link.url ? getDomainLabel(link.url) : null;
                    const normalizedTag = normalizeLinkCategory(link.categoryTag);
                    const meta = LINK_CATEGORY_METADATA[normalizedTag] || LINK_CATEGORY_METADATA['External / Web'];

                    return (
                      <div
                        key={link.id}
                        onClick={() => handleStartEdit(link)}
                        className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 shadow-sm cursor-pointer ${
                          isEditing
                            ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/40'
                            : isSelected
                            ? 'bg-cyan-950/30 border-cyan-500/50'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSelectLink(link.id);
                              }}
                              className="p-0.5 text-slate-400 hover:text-cyan-300 transition cursor-pointer shrink-0"
                              title={isSelected ? 'Deselect item' : 'Select item for sharing'}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400" />
                              )}
                            </button>

                            <span className="text-xs font-bold text-white truncate max-w-[180px]">
                              {link.name}
                            </span>

                            {isNote ? (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded border border-emerald-500/40 bg-emerald-950/80 text-emerald-300 flex items-center gap-0.5 shrink-0">
                                <FileText className="w-2.5 h-2.5 text-emerald-400" />
                                <span>Note</span>
                              </span>
                            ) : (
                              <span
                                className={`text-[9px] font-mono px-1 py-0.2 rounded border flex items-center gap-0.5 shrink-0 ${meta.badgeStyle}`}
                                title={meta.description}
                              >
                                <span>{meta.icon}</span>
                                <span>{normalizedTag.split('/')[0].trim()}</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {scopeData.onReorder && (
                              <div className="flex items-center gap-0.5 mr-0.5 bg-slate-900 border border-slate-800 rounded p-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => scopeData.onReorder && scopeData.onReorder(idx, idx - 1)}
                                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                                  title="Move up"
                                >
                                  <ArrowUp className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === scopeData.links.length - 1}
                                  onClick={() => scopeData.onReorder && scopeData.onReorder(idx, idx + 1)}
                                  className="p-0.5 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                                  title="Move down"
                                >
                                  <ArrowDown className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}

                            {link.url ? (
                              <button
                                type="button"
                                onClick={() => handleOpenLink(link.url)}
                                className="p-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 rounded transition cursor-pointer"
                                title="Open link in new tab"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCopyNoteText(link.description || link.name)}
                                className="p-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded transition cursor-pointer"
                                title="Copy note text"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(link)}
                              className="p-1 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Snippet / Context */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                          <span className="truncate flex-1">
                            {link.description ? link.description : link.url || 'No content preview'}
                          </span>
                          {domain && <span className="text-slate-500 font-mono shrink-0">{domain}</span>}
                        </div>
                      </div>
                    );
                  })}
                  </>
                )
              ) : (
                /* Received Feed List */
                filteredLinks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-950/30 rounded-xl border border-slate-800/60 text-center">
                    <Inbox className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No received items in your inbox</p>
                  </div>
                ) : (
                  filteredLinks.map((item) => {
                    const receivedItem = item as ReceivedLinkItem;
                    const isSelected = activeReceivedItem?.id === receivedItem.id;
                    const isNote = !receivedItem.url || !receivedItem.url.trim() || receivedItem.isNote;
                    const normalizedTag = normalizeLinkCategory(receivedItem.categoryTag);
                    const meta = LINK_CATEGORY_METADATA[normalizedTag] || LINK_CATEGORY_METADATA['External / Web'];

                    return (
                      <div
                        key={receivedItem.id}
                        onClick={() => {
                          setSelectedReceivedId(receivedItem.id);
                          markAsRead(receivedItem.id, activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined);
                        }}
                        className={`p-2.5 rounded-xl border transition flex flex-col gap-1.5 shadow-sm cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40'
                            : !receivedItem.isRead
                            ? 'bg-slate-950 border-cyan-500/60'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {!receivedItem.isRead && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                            )}
                            <span className="text-xs font-bold text-white truncate max-w-[160px]">
                              {receivedItem.name}
                            </span>
                            {isNote ? (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded border border-emerald-500/40 bg-emerald-950/80 text-emerald-300 shrink-0">
                                Note
                              </span>
                            ) : (
                              <span className={`text-[9px] font-mono px-1 py-0.2 rounded border ${meta.badgeStyle} shrink-0`}>
                                {meta.icon}
                              </span>
                            )}
                          </div>

                          {/* Quick Card Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Read/Unread Toggle */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReadStatus(receivedItem.id, activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined);
                              }}
                              className={`p-1 rounded transition cursor-pointer ${
                                receivedItem.isRead
                                  ? 'text-slate-500 hover:text-cyan-300 hover:bg-slate-800'
                                  : 'text-cyan-400 hover:text-cyan-200 bg-cyan-950/60'
                              }`}
                              title={receivedItem.isRead ? 'Mark as Unread' : 'Mark as Read'}
                            >
                              {receivedItem.isRead ? <Mail className="w-3 h-3" /> : <MailOpen className="w-3 h-3" />}
                            </button>

                            {/* Quick Save Copy to Active Scope */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveReceivedToTargetScope(receivedItem);
                              }}
                              className="p-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded transition cursor-pointer"
                              title="Save copy to active scope"
                            >
                              <BookmarkPlus className="w-3 h-3" />
                            </button>

                            {/* Open or Copy */}
                            {receivedItem.url ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenLink(receivedItem.url!, receivedItem.id);
                                }}
                                className="p-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 rounded transition cursor-pointer"
                                title="Open link"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyNoteText(receivedItem.description || '');
                                }}
                                className="p-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded transition cursor-pointer"
                                title="Copy note text"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}

                            {/* Dismiss */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteReceivedLink(receivedItem.id, activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined);
                                showToast('Dismissed received item.');
                              }}
                              className="p-1 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Dismiss from inbox"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                          <span className="truncate flex-1">
                            {receivedItem.description || receivedItem.url || 'No content preview'}
                          </span>
                          <span className="text-[9px] font-mono text-indigo-300 shrink-0">
                            From: {receivedItem.senderName}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>

            {/* Bottom Shelf: Compact Party Dispatcher (for active scopes) */}
            {currentScope !== 'received' && (
              <div className="bg-slate-950/90 border border-slate-800 p-2 rounded-xl flex flex-col gap-1.5 shadow-inner shrink-0 mt-auto">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1 shrink-0">
                    <Share2 className="w-3 h-3 text-cyan-400" />
                    <span>{selectedLinkIds.length} Selected</span>
                  </span>

                  {/* Destination Pill Switch */}
                  <div className="bg-slate-900/90 border border-slate-800 p-0.5 rounded-lg flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSendToAllParty(true);
                        setShowMemberPicker(false);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        sendToAllParty
                          ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Users className="w-3 h-3" />
                      <span>Party</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSendToAllParty(false);
                        setShowMemberPicker(true);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        !sendToAllParty
                          ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <User className="w-3 h-3" />
                      <span>Members</span>
                    </button>
                  </div>
                </div>

                {/* Member Multi-Select List */}
                {!sendToAllParty && showMemberPicker && (
                  <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg max-h-24 overflow-y-auto flex flex-col gap-1">
                    {isLoadingMembers ? (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 py-0.5">
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                        <span>Loading members...</span>
                      </div>
                    ) : partyMembers.length === 0 ? (
                      <span className="text-[10px] text-slate-500 italic p-1">No other members online</span>
                    ) : (
                      partyMembers.map((member) => {
                        const charName = member.character?.name || member.player_email || 'Hero';
                        const charId = String(member.character_id || member.id);
                        const isChosen = selectedRecipientCharacterIds.includes(charId);
                        return (
                          <button
                            key={charId}
                            type="button"
                            onClick={() => handleToggleRecipient(charId)}
                            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center justify-between transition cursor-pointer ${
                              isChosen
                                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-extrabold'
                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            <span>{charName}</span>
                            {isChosen ? (
                              <Check className="w-3 h-3 text-cyan-400" />
                            ) : (
                              <Plus className="w-3 h-3 text-slate-600" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Dispatch Button */}
                <button
                  type="button"
                  disabled={selectedLinkIds.length === 0 || isDispatching || !activePartyId}
                  onClick={handleDispatchSelected}
                  className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer font-outfit"
                >
                  {isDispatching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isDispatching ? 'Sharing...' : 'Share Items to Party'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ======================================================================== */}
          {/* RIGHT PANE: Spacious Tabbed Editor Workspace (Flex-1)                    */}
          {/* ======================================================================== */}
          <div className="flex-1 p-5 flex flex-col bg-slate-900 min-h-0 overflow-hidden">
            {currentScope !== 'received' ? (
              <div className="h-full flex flex-col gap-3.5 min-h-0">
                {/* Editor Header: Tab Switcher + Reset / New Item Action */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0 gap-3">
                  {/* KISS Multi-Option Tab Switcher */}
                  <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveEditorTab('link');
                        if (editingId && isEditingNote) {
                          handleResetEditor();
                        }
                      }}
                      className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeEditorTab === 'link'
                          ? 'bg-cyan-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Link Editor</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveEditorTab('note');
                        if (editingId && !isEditingNote) {
                          handleResetEditor();
                        }
                      }}
                      className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeEditorTab === 'note'
                          ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Note Editor</span>
                    </button>

                    {currentScope === 'character' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveEditorTab('dossier');
                          setEditingId(null);
                          setIsEditingNote(false);
                        }}
                        className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeEditorTab === 'dossier' || activeEditorTab === 'trait'
                            ? 'bg-purple-600 text-white shadow-sm font-extrabold'
                            : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Dossier Editor</span>
                      </button>
                    )}
                  </div>

                  {/* Edit State Badge & Reset Button */}
                  <div className="flex items-center gap-2">
                    {editingId && (
                      <span className="px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold font-mono">
                        Editing Item
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleResetEditor}
                      className="px-2.5 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Clear form / New item"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                      <span>New / Reset</span>
                    </button>
                  </div>
                </div>

                {/* Tab 1: Spacious Link Editor */}
                {activeEditorTab === 'link' && (
                  <form onSubmit={handleSaveForm} className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
                    {/* Row 1: Link Title (Left) & Category Tag (Right) */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300">Link Title</label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          required
                          disabled={scopeData.isDisabled}
                          placeholder="e.g. Tactical Combat Map"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-40"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300">Category Tag</label>
                        <select
                          value={formTag}
                          disabled={scopeData.isDisabled}
                          onChange={(e) => setFormTag(e.target.value as LinkCategory)}
                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-40"
                        >
                          {LINK_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {LINK_CATEGORY_METADATA[cat].icon} {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Target URL */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <label className="text-xs font-bold text-slate-300">Target URL</label>
                      <input
                        type="text"
                        required
                        disabled={scopeData.isDisabled}
                        placeholder="https://..."
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-40"
                      />
                    </div>

                    {/* Row 3: Context / Optional Notes (Compact 2-row initial height, user expandable) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-300">Context / Optional Notes</label>
                      <textarea
                        rows={2}
                        disabled={scopeData.isDisabled}
                        placeholder="Brief context notes or descriptions..."
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-y min-h-[58px] max-h-[220px] font-sans disabled:opacity-40"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 shrink-0">
                      <button
                        type="submit"
                        disabled={isSubmitting || scopeData.isDisabled}
                        className={`py-2 px-6 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                          editingId && !isEditingNote
                            ? 'bg-amber-600 hover:bg-amber-500 text-white font-extrabold'
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold'
                        } disabled:opacity-40`}
                      >
                        {editingId && !isEditingNote ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span>{editingId && !isEditingNote ? 'Save Changes' : '+ Add Link'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Tab 2: Spacious Note Editor with HUGE Multiline Textarea */}
                {activeEditorTab === 'note' && (
                  <form onSubmit={handleSaveNote} className="flex-1 flex flex-col gap-3 min-h-0">
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300">Note Title</label>
                        <input
                          ref={noteTitleInputRef}
                          type="text"
                          required
                          disabled={scopeData.isDisabled}
                          placeholder="e.g. Crypt Puzzle Clue, House Rules"
                          value={noteTitle}
                          onChange={(e) => setNoteTitle(e.target.value)}
                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-40"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-300">Category Tag</label>
                        <select
                          value={noteTag}
                          disabled={scopeData.isDisabled}
                          onChange={(e) => setNoteTag(e.target.value as LinkCategory)}
                          className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-40"
                        >
                          {LINK_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {LINK_CATEGORY_METADATA[cat].icon} {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Massive comfortable textarea for long-form lore/notes */}
                    <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                      <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span>Note Content / Body</span>
                        <span className="text-[11px] text-slate-500 font-normal">Supports long-form markdown, clues, and paste</span>
                      </label>
                      <textarea
                        required
                        disabled={scopeData.isDisabled}
                        placeholder="Type or paste long-form note text, clues, lore, NPC dialogues, encounter briefings, or custom house rules here..."
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        className="w-full flex-1 p-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none font-sans leading-relaxed disabled:opacity-40"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 shrink-0">
                      <button
                        type="submit"
                        disabled={isSubmittingNote || scopeData.isDisabled}
                        className={`py-2 px-6 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer ${
                          editingId && isEditingNote
                            ? 'bg-amber-600 hover:bg-amber-500 text-white font-extrabold'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold'
                        } disabled:opacity-40`}
                      >
                        {editingId && isEditingNote ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span>{editingId && isEditingNote ? 'Save Changes' : '+ Add Note'}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Tab 3: Dossier Editor (Character Scope Only) */}
                {(activeEditorTab === 'dossier' || activeEditorTab === 'trait') && (
                  <div className="flex-1 flex flex-col gap-3.5 min-h-0 overflow-y-auto pr-1">
                    <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-purple-400" />
                        <h4 className="font-outfit font-bold text-xs text-purple-300 uppercase tracking-wider">
                          Character Dossier ({activeCharacter?.name || 'Active Hero'})
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Auto-saved to Character Sheet
                      </span>
                    </div>

                    {/* 3 Physical Metric Cells (Hgt, Wgt, Age) */}
                    <div className="grid grid-cols-3 gap-3 shrink-0">
                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Hgt (Height)</span>
                        <input
                          type="text"
                          value={bio.height || ''}
                          placeholder="e.g. 5'11&quot;"
                          onChange={(e) => handleBioChange('height', e.target.value)}
                          className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                        />
                      </div>

                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Wgt (Weight)</span>
                        <input
                          type="text"
                          value={bio.weight || ''}
                          placeholder="e.g. 175 lbs"
                          onChange={(e) => handleBioChange('weight', e.target.value)}
                          className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                        />
                      </div>

                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-1">
                        <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Age</span>
                        <input
                          type="text"
                          value={bio.age || ''}
                          placeholder="e.g. 28"
                          onChange={(e) => handleBioChange('age', e.target.value)}
                          className="bg-slate-900 text-slate-100 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    {/* Full Horizontal Fields */}
                    <div className="flex flex-col gap-3">
                      {/* Appearance */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Appearance</label>
                          <InfoTooltip text="Physical description (e.g. Rugged scar on left cheek, dark cloak, keen eyes...)" />
                        </div>
                        <input
                          type="text"
                          value={bio.appearance || ''}
                          placeholder="Physical description..."
                          onChange={(e) => handleBioChange('appearance', e.target.value)}
                          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-purple-500 w-full"
                        />
                      </div>

                      {/* Positive Trait */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Positive Trait</label>
                          <InfoTooltip text="Key strength or virtue (e.g. Fiercely loyal to comrades, calm under pressure...)" />
                        </div>
                        <input
                          type="text"
                          value={bio.positive_trait || ''}
                          placeholder="Key strength or virtue..."
                          onChange={(e) => handleBioChange('positive_trait', e.target.value)}
                          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-emerald-500 w-full"
                        />
                      </div>

                      {/* Negative Trait */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-rose-300 uppercase tracking-wider">Negative Trait</label>
                          <InfoTooltip text="Character flaw or weakness (e.g. Overly stubborn, mistrustful of noble bloodlines...)" />
                        </div>
                        <input
                          type="text"
                          value={bio.negative_trait || ''}
                          placeholder="Character flaw or weakness..."
                          onChange={(e) => handleBioChange('negative_trait', e.target.value)}
                          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-rose-500 w-full"
                        />
                      </div>

                      {/* Flair */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-purple-300 uppercase tracking-wider">Flair</label>
                          <InfoTooltip text="Unique signature quirk or habit (e.g. Flips a worn brass coin before making crucial decisions...)" />
                        </div>
                        <input
                          type="text"
                          value={bio.flair || ''}
                          placeholder="Unique signature quirk or habit..."
                          onChange={(e) => handleBioChange('flair', e.target.value)}
                          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-purple-500 w-full"
                        />
                      </div>

                      {/* Adventuring Goal */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-amber-300 uppercase tracking-wider">Adventuring Goal</label>
                          <InfoTooltip text="Long-term quest or narrative drive (e.g. Reclaim the ancestral crown of Shanask...)" />
                        </div>
                        <textarea
                          rows={2}
                          value={bio.adventuring_goal || ''}
                          placeholder="Long-term quest or narrative drive..."
                          onChange={(e) => handleBioChange('adventuring_goal', e.target.value)}
                          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-amber-500 w-full resize-none"
                        />
                      </div>

                      {/* Notes */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Notes</label>
                          <InfoTooltip text="General campaign notes, secrets, contacts, and personal logs..." />
                        </div>
                        <textarea
                          rows={3}
                          value={bio.notes || ''}
                          placeholder="General campaign notes, secrets, contacts, and personal logs..."
                          onChange={(e) => handleBioChange('notes', e.target.value)}
                          className="bg-slate-950 text-slate-100 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-800 outline-none focus:border-cyan-500 w-full resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Received Item Detailed Inspector */
              activeReceivedItem ? (
                <div className="h-full flex flex-col gap-4 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Inbox className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{activeReceivedItem.name}</h3>
                        <span className="text-xs text-indigo-300 font-mono">From: {activeReceivedItem.senderName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Destination Scope Dropdown */}
                      <select
                        value={receivedTargetScope}
                        onChange={(e) => setReceivedTargetScope(e.target.value)}
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer font-bold"
                      >
                        {activeRole === 'gm' ? (
                          <>
                            <option value="gm">👑 GM Global Scope</option>
                            {activeAdv && <option value="adventure">🗺️ Adventure: {activeAdv.title}</option>}
                            {activeAdv && activeEnc && <option value="encounter">⚔️ Encounter: {activeEnc.title}</option>}
                          </>
                        ) : (
                          <>
                            <option value="player">👤 Player Account Scope</option>
                            {activeCharacter && <option value="character">📜 Character: {activeCharacter.name}</option>}
                          </>
                        )}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleSaveReceivedToTargetScope(activeReceivedItem)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>Save Copy</span>
                      </button>

                      {/* Read/Unread Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleReadStatus(activeReceivedItem.id, activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined)}
                        className={`p-1.5 border rounded-lg transition cursor-pointer ${
                          activeReceivedItem.isRead
                            ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-cyan-300'
                            : 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                        }`}
                        title={activeReceivedItem.isRead ? 'Mark as Unread' : 'Mark as Read'}
                      >
                        {activeReceivedItem.isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          deleteReceivedLink(activeReceivedItem.id, activePartyId || undefined, activeCharacter?.id ? String(activeCharacter.id) : undefined);
                          showToast('Dismissed received item.');
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-900 border border-slate-800 rounded-lg transition cursor-pointer"
                        title="Dismiss from inbox"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {activeReceivedItem.url && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                      <span className="text-xs font-mono text-cyan-300 truncate flex-1">{activeReceivedItem.url}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenLink(activeReceivedItem.url!, activeReceivedItem.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Link</span>
                      </button>
                    </div>
                  )}

                  {activeReceivedItem.description && (
                    <div className="flex-1 flex flex-col gap-1.5 min-h-[200px]">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                        <span>Content / Text</span>
                        <button
                          type="button"
                          onClick={() => handleCopyNoteText(activeReceivedItem.description || '')}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3 text-emerald-400" />
                          <span>Copy Text</span>
                        </button>
                      </div>
                      <div className="flex-1 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans overflow-y-auto">
                        {activeReceivedItem.description}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Inbox className="w-12 h-12 mb-2 text-slate-700" />
                  <p className="text-sm font-bold text-slate-400">No received item selected</p>
                  <p className="text-xs text-slate-500 mt-1">Select an item from the inbox on the left to inspect and save it.</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Modal Footer Status Bar with Standardized "Done" Button */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Active Scope: <strong className="text-slate-200 font-bold">{scopeData.title}</strong>
            </span>
            <span>•</span>
            <span>
              Total Scope Items: <strong className="text-cyan-300 font-bold">{scopeData.links.length}</strong>
            </span>
            {activePartyId && (
              <>
                <span>•</span>
                <span>
                  Party Room: <strong className="text-indigo-300 font-bold">#{activePartyId.slice(0, 6).toUpperCase()}</strong>
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-6 py-1.5 rounded-xl border border-slate-700/80 transition shadow-sm cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
